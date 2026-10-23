/* KingDiceAI.js — oponente heurístico ("King Dice AI"): avalia cada carta Uno pela melhor jogada
   que desbloqueia, planta armadilhas nas rotas de ataque e reage na Chain com SS2/SS3.
   Joga limpo: nunca olha para as armadilhas ocultas nem para a mão do adversário. */
(function (YC) {
  'use strict';

  const V = (p) => YC.CardDatabase.pieceBaseStats[p.type].value;
  const KEEP = { COUNTER_TRAP: 22, QUICK_SPELL: 9, SPATIAL_TRAP: 9 };

  class KingDiceAI {
    constructor(team, opts = {}) {
      this.team = team;
      this.delay = opts.delay != null ? opts.delay : 700;
      this.noise = opts.noise != null ? opts.noise : 2.5;
      this.rand = opts.rand || Math.random;
      this.aggression = opts.aggression != null ? opts.aggression : 1.6;
    }

    // ── Turno completo ──
    async playTurn(g) {
      const team = this.team, turn = g.state.turnCount;
      const mine = () => !g.state.winner && g.state.turnCount === turn && g.state.active === team;
      await g.wait(this.delay);
      if (!mine()) return;

      let plan = this.planUno(g);
      await this.maybeSet(g, plan);
      for (let attempt = 0; attempt < 2 && mine() && g.state.phase === 'UNO_CARD_PHASE'; attempt++) {
        if (attempt > 0) plan = this.planUno(g);
        if (plan.kind === 'CARD' && g.uno.findInHand(team, plan.card.uid)) {
          if (plan.sovereign) await g.dispatch({ type: 'ARM_SOVEREIGNTY', team });
          const ok = await g.dispatch({ type: 'PLAY_UNO_CARD', team, cardUid: plan.card.uid, chosenColor: plan.color, targetUid: plan.targetUid });
          if (!ok) break;
        } else break;
      }
      if (mine() && g.state.phase === 'UNO_CARD_PHASE') await g.dispatch({ type: 'FALLBACK_DRAW', team });

      if (mine() && g.state.phase === 'BOARD_ACTION_PHASE') {
        await g.wait(this.delay * 0.8);
        const best = this.bestMove(g, g.state.permission);
        if (best && best.score > -40) {
          const ok = await g.dispatch({ type: 'DECLARE_MOVE', team, pieceUid: best.piece.uid, to: best.move.to });
          if (!ok && mine()) await g.dispatch({ type: 'END_TURN', team });
        } else if (mine()) await g.dispatch({ type: 'END_TURN', team });
      }
      if (mine() && g.state.phase === 'BONUS_STEP') {
        await g.wait(this.delay * 0.5);
        const step = this.bestBonusStep(g);
        await g.dispatch(step ? { type: 'BONUS_STEP', team, to: step } : { type: 'SKIP_BONUS', team });
      }
      if (mine() && g.state.phase !== 'END_PHASE') await g.dispatch({ type: 'END_TURN', team });
    }

    // ── Escolha da carta Uno ──
    planUno(g) {
      const team = this.team, hand = g.uno.hand(team);
      const canSov = g.canUseSovereignty(team);
      const options = [];
      for (const card of hand) {
        const matches = g.uno.matches(card);
        if (!matches && !canSov) continue;
        const perm = g.uno.permissionFor(card);
        for (const eff of card.yugioh.cardType === 'NORMAL_SPELL' ? card.effects : []) {
          if (eff.op === 'BUFF_ACTIVE_PIECE') perm.boost[eff.stat === 'heal' ? 'heal' : eff.stat] += eff.amount;
          if (eff.op === 'PIERCE_SHIELD') perm.boost.pierce = true;
        }
        const need = g.targetRequirement(card, team);
        const target = need ? this.chooseTarget(g, card, need) : null;
        if (need && need.candidates.length && !target) continue;
        const best = this.bestMove(g, perm);
        let score = (best ? best.score : -15) + this.cardEffectValue(g, card, target) - (KEEP[card.yugioh.cardType] || 0);
        if (card.uno.color === 'W') score -= 8;
        if (!matches) score -= 45 + Math.max(0, 20 - g.state.turnCount);
        options.push({ kind: 'CARD', card, score, sovereign: !matches, targetUid: target ? target.uid : null,
          color: card.uno.color === 'W' ? g.suggestColor(team, card.uid) : null });
      }
      const fperm = g.uno.fallbackPermission(g.board, team, g.state.turnCount);
      const fb = this.bestMove(g, fperm);
      options.push({ kind: 'FALLBACK', score: (fb ? fb.score : -10) + (hand.length < 3 ? 6 : 0) });
      options.sort((a, b) => b.score - a.score);
      return options[0];
    }

    cardEffectValue(g, card, target) {
      const team = this.team, enemy = YC.other(team), b = g.board;
      let v = 0;
      if (card.uno.color !== 'W') {
        if (card.uno.value === 'SKIP' && target) v += V(target) * 0.25 + 4;
        if (card.uno.value === 'REVERSE' && target) v += 4;
        if (card.uno.value === 'DRAW2') v += 12;
      }
      if (card.yugioh.cardType !== 'NORMAL_SPELL') return v;
      for (const eff of card.effects) {
        if (eff.op === 'FIELD_DAMAGE') v += b.pieces(enemy).filter((p) => !eff.pieceTypes || eff.pieceTypes.includes(p.type)).length * eff.amount * 0.35;
        if (eff.op === 'FIELD_HEAL') v += b.pieces(team).reduce((s, p) => s + Math.min(eff.amount, p.maxHp - p.hp), 0) * 0.3;
        if (eff.op === 'DRAW_CARDS') v += 6 * eff.amount;
        if (eff.op === 'DISCARD_RANDOM') v += 5 * eff.amount;
        if (eff.op === 'REVIVE') v += b.graveyard[team].some((p) => p.type === 'PAWN') ? 10 : -5;
        if (eff.op === 'DESTROY_ENEMY_TRAP') v += b.trapsOf(enemy).length ? 12 : 0;
        if (eff.op === 'DEAL_DAMAGE' && target) v += eff.amount * 0.4;
      }
      return v;
    }

    chooseTarget(g, card, need) {
      const b = g.board, king = b.king(this.team);
      const list = need.candidates.filter((p) => !b.isStunned(p, g.state.turnCount + 1));
      if (!list.length) return need.candidates[0] || null;
      const score = (p) => {
        if (card.uno.value === 'SKIP') return V(p) + (king && b.canReach(p, king.row, king.col) ? 80 : 0);
        return p.team !== this.team ? Math.abs(p.atk - p.shield) + V(p) * 0.1 : -1;
      };
      return list.slice().sort((a, c) => score(c) - score(a))[0];
    }

    // ── Avaliação de movimentos ──
    bestMove(g, perm) {
      let best = null;
      for (const piece of g.board.pieces(this.team)) {
        for (const move of g.board.getValidMoves(piece, perm, g.state.turnCount)) {
          const score = this.scoreMove(g, piece, move, perm.boost) + this.rand() * this.noise;
          if (!best || score > best.score) best = { piece, move, score };
        }
      }
      return best;
    }

    /** Pior dano esperado se `piece` ficar em `sq` (ignora permissões futuras). */
    dangerAt(g, piece, sq) {
      let worst = 0;
      for (const t of g.board.threatsTo(sq[0], sq[1], piece.team, piece.uid)) {
        const dmg = Math.max(0, g.combat.effectiveAtk(t) - (piece.shield + piece.tempShield));
        const val = dmg >= piece.hp ? V(piece) * (piece.type === 'KING' ? 0.12 : 1) : dmg * V(piece) / piece.maxHp;
        worst = Math.max(worst, val);
      }
      return worst;
    }

    threatValue(g, piece, sq) {
      const ghost = { ...piece, row: sq[0], col: sq[1] };
      let v = 0;
      for (const e of g.board.pieces(YC.other(piece.team))) {
        if (g.board.canReach(ghost, e.row, e.col, piece.uid)) v += e.type === 'KING' ? 45 : V(e) * 0.15;
      }
      return v;
    }

    scoreMove(g, piece, move, boost) {
      const b = g.board, team = this.team;
      if (move.type === 'ATTACK') {
        const def = b.getPiece(move.defenderUid);
        const pv = g.combat.preview(piece, def, move, b, g.state.turnCount, boost);
        if (pv.defenderDestroyed) return def.type === 'KING' ? 1e5 : V(def) * 1.2 + 15 - this.dangerAt(g, piece, move.to) * 0.6;
        let s = pv.damage * (def.type === 'KING' ? 1.5 : V(def) / def.maxHp) + pv.blocked * 0.12;
        if (pv.attackerDestroyed) s -= V(piece) * 1.1 + 10;
        else {
          s -= (pv.retaliation ? pv.retaliation.damage : 0) * V(piece) / piece.maxHp * 0.8;
          s -= this.dangerAt(g, piece, pv.bounceTo) * 0.4;
        }
        return s;
      }
      const to = move.to;
      if (move.type === 'SWAP') return 0.5;
      if (move.type === 'CASTLE') return 7;
      let s = (3.5 - Math.abs(3.5 - to[1])) * 0.5 + (3.5 - Math.abs(3.5 - to[0])) * 0.3;
      if (piece.type === 'PAWN') {
        const adv = team === 'BLACK' ? to[0] - piece.row : piece.row - to[0];
        s += adv * 1.4 + ((team === 'BLACK' ? to[0] === 7 : to[0] === 0) ? 70 : 0);
      }
      if (piece.type === 'KING') s -= 5;
      const foe = b.king(YC.other(team));
      if (foe && piece.type !== 'PAWN' && piece.type !== 'KING') {
        s += (b.distance([piece.row, piece.col], [foe.row, foe.col]) - b.distance(to, [foe.row, foe.col])) * this.aggression;
      }
      s += this.threatValue(g, piece, to) * 0.3;
      s -= this.dangerAt(g, piece, to) * 0.75;
      s += this.dangerAt(g, piece, [piece.row, piece.col]) * 0.5;
      return s;
    }

    bestBonusStep(g) {
      const piece = g.board.getPiece(g.state.bonusPieceUid);
      if (!piece) return null;
      const stay = -this.dangerAt(g, piece, [piece.row, piece.col]);
      let best = null, bestScore = stay + 1;
      for (const sq of g.bonusSteps(piece)) {
        const s = -this.dangerAt(g, piece, sq) + this.threatValue(g, piece, sq) * 0.2;
        if (s > bestScore) { best = sq; bestScore = s; }
      }
      return best;
    }

    // ── Colocação de cartas ──
    async maybeSet(g, plan) {
      const team = this.team;
      const hand = g.uno.hand(team).filter((c) => !(plan.card && c.uid === plan.card.uid));
      const free = g.state.players[team].support.indexOf(null);
      const counter = hand.find((c) => c.yugioh.cardType === 'COUNTER_TRAP');
      if (counter && free >= 0) return g.dispatch({ type: 'SET_SUPPORT', team, cardUid: counter.uid, slot: free });
      const trap = hand.find((c) => c.yugioh.cardType === 'SPATIAL_TRAP');
      if (trap && g.board.trapsOf(team).length < YC.BoardEngine.MAX_BOARD_TRAPS) {
        const sq = this.bestTrapSquare(g);
        if (sq) return g.dispatch({ type: 'SET_TRAP', team, cardUid: trap.uid, row: sq[0], col: sq[1] });
      }
      const quick = hand.find((c) => c.yugioh.cardType === 'QUICK_SPELL' && c.yugioh.triggerCondition !== 'ON_OPPONENT_RESPONSE');
      if (quick && free >= 0 && hand.length >= 3) return g.dispatch({ type: 'SET_SUPPORT', team, cardUid: quick.uid, slot: free });
      return false;
    }

    /** Casas da própria metade por onde as peças inimigas provavelmente vão passar. */
    bestTrapSquare(g) {
      const b = g.board, team = this.team, heat = new Map();
      const key = (r, c) => r * 8 + c;
      for (const p of b.pieces(YC.other(team))) {
        for (const m of b.getValidMoves(p, null, null)) {
          for (const i of b.trapCheckIndices(p, m)) {
            const [r, c] = m.rayPath[i];
            heat.set(key(r, c), (heat.get(key(r, c)) || 0) + 2 + V(p) / 25);
          }
        }
      }
      const royal = b.pieces(team).filter((p) => p.type === 'KING' || p.type === 'QUEEN');
      let best = null, bestScore = -Infinity;
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        if (!b.canSetTrapAt(team, r, c)) continue;
        let s = (heat.get(key(r, c)) || 0) + (3.5 - Math.abs(3.5 - c)) * 0.6 + this.rand();
        if ((r === 3 || r === 4) && (c === 3 || c === 4)) s += 3;
        if (royal.some((p) => b.distance([p.row, p.col], [r, c]) === 1)) s += 2;
        if (s > bestScore) { best = [r, c]; bestScore = s; }
      }
      return best;
    }

    // ── Reação na Chain (SS2 / SS3) ──
    linkThreat(g, top) {
      const b = g.board;
      if (top.kind === 'MOVE') {
        if (!top.move.defenderUid) return 3;
        const att = b.getPiece(top.move.pieceUid), def = b.getPiece(top.move.defenderUid);
        if (!att || !def) return 0;
        const pv = g.combat.preview(att, def, top.move.move, b, g.state.turnCount, g.state.permission && g.state.permission.boost);
        if (pv.defenderDestroyed) return def.type === 'KING' ? 999 : V(def) * 1.2 + 10;
        return pv.damage * (def.type === 'KING' ? 1.2 : V(def) / def.maxHp) + (pv.attackerDestroyed ? -10 : 0);
      }
      if (top.kind === 'UNO_PLAY') {
        const c = top.card;
        let t = c.uno.color === 'W' ? 12 : /[789]/.test(c.uno.value) ? 10 : 4;
        if (c.yugioh.cardType === 'NORMAL_SPELL' && c.effects.length) t += 8;
        return t;
      }
      if (top.kind === 'TRAP') {
        const p = b.getPiece(top.trap.triggeringUid);
        const dmg = top.card.effects.filter((e) => e.op === 'DEAL_DAMAGE').reduce((s, e) => s + e.amount, 0);
        const stun = top.card.effects.some((e) => e.op === 'APPLY_STATUS') ? 8 : 0;
        return p ? (dmg >= p.hp ? V(p) : dmg * V(p) / p.maxHp) + stun + 6 : 5;
      }
      if (top.kind === 'CARD') return top.card.effects.some((e) => e.op === 'NEGATE_CHAIN_LINK') ? 30 : 9;
      return 0;
    }

    responseValue(g, card, top) {
      const b = g.board, ops = card.effects.map((e) => e.op);
      const threat = this.linkThreat(g, top);
      if (ops.includes('NEGATE_CHAIN_LINK')) {
        let cost = 6;
        if (card.cost && card.cost.type === 'KING_HP') { const k = b.king(this.team); cost = k && k.hp > 90 ? card.cost.amount * 0.5 : card.cost.amount * 1.6; }
        return threat - cost - KEEP.COUNTER_TRAP * 0.5;
      }
      const eff = card.effects[0];
      if (top.kind === 'MOVE' && top.move.defenderUid && (eff.target === 'DEFENDER' || eff.target === 'ATTACKER')) {
        const att = b.getPiece(top.move.pieceUid), def = b.getPiece(top.move.defenderUid);
        if (eff.target === 'ATTACKER') return att && eff.amount >= att.hp ? V(att) + 10 : Math.min(threat, 20) + 2;
        return def && def.type === 'KING' ? threat * 0.6 + 6 : threat * 0.5 + 2;
      }
      if (eff.target === 'TRIGGERING_PIECE') return threat * 0.6;
      if (eff.target === 'MY_MOVING_PIECE') return 11;
      if (eff.op === 'DISCARD_RANDOM') return 12;
      return 0;
    }

    async respondChain({ game, options, top }) {
      let best = null, bestScore = 10;
      for (const opt of options) {
        const s = this.responseValue(game, opt.card, top);
        if (s > bestScore) { best = opt; bestScore = s; }
      }
      await game.wait(best ? this.delay * 0.6 : 0);
      return best ? best.card.uid : null;
    }
  }

  YC.KingDiceAI = KingDiceAI;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
