/* BotAI.js — adversário controlado pelo computador.
   Lances: minimax alfa-beta com quiescência (capturas) e aprofundamento iterativo com limite de tempo.
   Fácil = profundidade 1 com ruído · Médio = 2 · Difícil = 3.
   Cartas: heurísticas simples (equipar a melhor peça, armadilhas nas casas por onde o inimigo passa,
   respostas na Chain para proteger peças valiosas). Não vê as armadilhas nem a mão do adversário. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const Cards = () => YC.Cards;
  const E = () => YC.CardEffects;
  const PV = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE = 100000;
  const LEVELS = {
    easy: { label: 'Fácil', depth: 1, noise: 60, ms: 300, skip: 0.45, actions: 1 },
    medium: { label: 'Médio', depth: 2, noise: 18, ms: 900, skip: 0.15, actions: 2 },
    hard: { label: 'Difícil', depth: 3, noise: 4, ms: 1800, skip: 0, actions: 2 }
  };

  class Bot {
    constructor({ team, level = 'medium', delay = 450, seed = 7 }) {
      this.team = team;
      this.cfg = LEVELS[level] || LEVELS.medium;
      this.delay = delay;
      this.rand = YC.mulberry32(seed);
      this.isHuman = false;
    }

    wait(ms) { return ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve(); }

    async playTurn(m) {
      const team = this.team;
      await this.wait(this.delay);
      for (let i = 0; i < this.cfg.actions && m.state.actionsLeft > 0 && !m.over && m.state.phase === 'PREP'; i++) {
        const act = this.chooseAction(m);
        if (!act) break;
        if (!(await m.dispatch({ ...act, team }))) break;
        await this.wait(this.delay);
      }
      if (m.over || m.state.phase !== 'PREP' || m.state.active !== team) return;
      if (m.state.mustPass) { await m.dispatch({ type: 'PASS', team }); return; }
      const mv = this.bestMove(m);
      if (!mv) { await m.dispatch({ type: 'AUTO_MOVE', team }); return; }
      const ok = await m.dispatch({ type: 'MOVE', team, from: mv.from, to: mv.to, promo: mv.promo || undefined, lance: mv.flag === 'r' || undefined });
      if (!ok && !m.over && m.state.phase === 'PREP') await m.dispatch({ type: 'AUTO_MOVE', team });
    }

    // ───────────── avaliação e pesquisa ─────────────
    evaluate(pos, side, turn) {
      let score = 0, material = 0;
      const b = pos.board;
      for (let sq = 0; sq < 64; sq++) {
        const p = b[sq];
        if (p && p.type !== 'k' && p.type !== 'p') material += PV[p.type];
      }
      for (let sq = 0; sq < 64; sq++) {
        const p = b[sq];
        if (!p) continue;
        const r = sq >> 3, c = sq & 7, real = p.morphUntil ? p.morphFrom : p.type;
        let v = PV[real] * (p.morphUntil ? 0.85 : 1);
        const center = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));
        if (p.type === 'p') v += (p.color === 'w' ? 6 - r : r - 1) * (material < 2600 ? 14 : 7) + (c > 1 && c < 6 ? 4 : 0);
        else if (p.type === 'n' || p.type === 'b') v += center * 10;
        else if (p.type === 'q') v += center * 3;
        else if (p.type === 'k' && material > 2600) v += (r === (p.color === 'w' ? 7 : 0) ? 12 : -28) + (c === 4 || c === 3 ? -6 : 6);
        else if (p.type === 'k') v += center * 8;
        if (p.shield) v += 120;
        v += p.equips.length * 60;
        if (p.frozenUntil > turn) v -= 50;
        score += p.color === side ? v : -v;
      }
      return score;
    }

    order(moves) {
      const key = (m) => (m.captured ? 10 * PV[m.captured.type] - PV[m.piece.type] / 10 + 10000 : 0) + (m.promo === 'q' ? 9000 : 0);
      return moves.sort((a, b) => key(b) - key(a));
    }

    /** Limite por tempo (jogo) ou por nós (simulações, para serem reprodutíveis). */
    timeUp() {
      ++this.nodes;
      if (this.cfg.maxNodes) { if (this.nodes > this.cfg.maxNodes) this.stop = true; }
      else if ((this.nodes & 511) === 0 && Date.now() > this.deadline) this.stop = true;
      return this.stop;
    }

    negamax(pos, side, depth, alpha, beta, turn, ply) {
      if (this.timeUp()) return 0;
      if (depth <= 0) return this.quiesce(pos, side, alpha, beta, turn, 3);
      const moves = C().legalMoves(pos, side, { turn });
      if (!moves.length) {
        if (C().inCheck(pos, side)) return -MATE + ply;
        return C().legalMoves(pos, side, {}).length ? this.evaluate(pos, side, turn) : 0;
      }
      this.order(moves);
      for (const mv of moves) {
        const u = C().makeMove(pos, mv);
        const score = -this.negamax(pos, C().other(side), depth - 1, -beta, -alpha, turn + 1, ply + 1) + this.trapRisk(mv, side);
        C().unmakeMove(pos, u);
        if (this.stop) return 0;
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }

    quiesce(pos, side, alpha, beta, turn, qd) {
      const stand = this.evaluate(pos, side, turn);
      if (qd <= 0 || this.timeUp()) return stand;
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      const caps = this.order(C().legalMoves(pos, side, { turn }).filter((m) => m.captured && !m.captured.shield));
      for (const mv of caps) {
        const u = C().makeMove(pos, mv);
        const score = -this.quiesce(pos, C().other(side), -beta, -alpha, turn + 1, qd - 1);
        C().unmakeMove(pos, u);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }

    /** Casas com armadilha conhecida: as minhas (o inimigo evita) e as inimigas reveladas. */
    trapRisk(mv, side) {
      if (mv.captured || mv.flag === 'r') return 0;
      const t = this.knownTraps.get(mv.to);
      return t && t !== side ? -220 : 0;
    }

    bestMove(m) {
      const pos = m.pos, team = this.team, turn = m.state.turnCount;
      this.knownTraps = new Map(m.traps.filter((t) => t.owner === team || t.revealed).map((t) => [t.sq, t.owner]));
      const moves = this.order(C().legalMoves(pos, team, { turn }));
      if (!moves.length) return null;
      this.deadline = Date.now() + this.cfg.ms;
      this.stop = false;
      this.nodes = 0;
      const enemySet = m.players[C().other(team)].zone.length;
      let best = moves[0];
      for (let depth = 1; depth <= this.cfg.depth; depth++) {
        let bestScore = -Infinity, bestHere = null;
        for (const mv of moves) {
          let score;
          if (mv.captured && mv.captured.shield) {
            mv.captured.shield = false;
            score = -this.negamax(pos, C().other(team), depth - 1, -Infinity, Infinity, turn + 1, 1) - 20;
            mv.captured.shield = true;
          } else {
            const u = C().makeMove(pos, mv);
            score = -this.negamax(pos, C().other(team), depth - 1, -Infinity, Infinity, turn + 1, 1);
            C().unmakeMove(pos, u);
          }
          if (this.stop) break;
          score += this.trapRisk(mv, team) + (this.rand() - 0.5) * this.cfg.noise;
          if (mv.captured && enemySet) score -= Math.min(PV[mv.piece.type], 900) * 0.03 * enemySet;
          if (score > bestScore) { bestScore = score; bestHere = mv; }
        }
        if (this.stop && depth > 1) break;
        if (bestHere) best = bestHere;
        moves.sort((a, b) => (a === best ? -1 : b === best ? 1 : 0));
      }
      return best;
    }

    // ───────────── cartas na preparação ─────────────
    chooseAction(m) {
      const team = this.team, p = m.players[team];
      if (this.rand() < this.cfg.skip * 0.5) return null;
      const cands = [];
      for (const inst of p.hand) {
        const def = Cards().get(inst.id);
        if (def.kind === 'EQUIP') {
          for (const sq of E().equipTargets(m, team, def)) cands.push({ score: this.equipScore(m, def, m.pieceAt(sq), sq), act: { type: 'EQUIP', uid: inst.uid, sq } });
        } else if (def.kind === 'GRID') {
          if (m.traps.filter((t) => t.owner === team).length >= Cards().RULES.MAX_GRID_TRAPS) continue;
          const sq = this.bestTrapSquare(m, def);
          if (sq >= 0) cands.push({ score: 34 + (def.rarity === 'LEGENDARY' ? 12 : 0), act: { type: 'SET_TRAP', uid: inst.uid, sq } });
        } else {
          if (def.kind === 'QUICK') {
            const q = this.quickPlay(m, def, inst.uid);
            if (q) cands.push(q);
          }
          if (p.zone.length < Cards().RULES.ZONE_SLOTS) cands.push({ score: def.kind === 'QUICK' ? 22 : 40, act: { type: 'SET_CARD', uid: inst.uid } });
        }
      }
      for (const z of p.zone) {
        const def = Cards().get(z.inst.id);
        if (def.kind === 'QUICK' && z.setTurn < m.state.turnCount) { const q = this.quickPlay(m, def, z.inst.uid); if (q) cands.push(q); }
      }
      if (!cands.length) return null;
      for (const c of cands) c.score += this.rand() * 8;
      cands.sort((a, b) => b.score - a.score);
      return cands[0].score >= 18 ? cands[0].act : null;
    }

    equipScore(m, def, piece, sq) {
      const r = sq >> 3, adv = piece.color === 'w' ? 6 - r : r - 1;
      const base = { p: 14, n: 34, b: 34, r: 36, q: 46 }[piece.type] || 10;
      const attacked = C().isAttacked(m.pos, sq, C().other(piece.color));
      switch (def.id) {
        case 'eq_espada_ganancia': return base + 6;
        case 'eq_botas_vento': return 18 + adv * 6;
        case 'eq_mola_canguru': {
          const before = C().legalMovesFrom(m.pos, sq).length;
          piece.equips.push(def.id);
          const after = C().legalMovesFrom(m.pos, sq).length;
          piece.equips.pop();
          return 16 + (after - before) * 5;
        }
        case 'eq_aura_glacial': return base + 4;
        case 'eq_cetro_usurpador': return 50 + adv * 6;
        case 'eq_armadura_espinhos': return base + (attacked ? 16 : 0);
        case 'eq_lanca_telescopica': {
          piece.equips.push(def.id);
          const hits = C().legalMovesFrom(m.pos, sq).filter((mv) => mv.flag === 'r').reduce((s, mv) => Math.max(s, PV[mv.captured.type]), 0);
          piece.equips.pop();
          return 20 + hits / 12;
        }
        case 'eq_capa_magnetica': {
          const pawnHit = C().attackersOf(m.pos, sq, C().other(piece.color)).some((a) => m.pieceAt(a).type === 'p');
          return (pawnHit ? 55 : 10) + base / 4;
        }
        default: return this.equipScore2(m, def, piece, sq, base, attacked);
      }
    }

    bestTrapSquare(m, def) {
      const team = this.team, enemy = C().other(team);
      const heat = new Array(64).fill(0);
      // o X Assinala Tesouro é para as próprias peças pisarem
      for (const mv of C().pseudoMoves(m.pos, def && def.allyStep ? team : enemy, {})) if (!m.pos.board[mv.to]) heat[mv.to] += 3 + PV[mv.piece.type] / 300;
      let best = -1, bestScore = -1;
      for (const sq of E().trapSquares(m, team)) {
        const r = sq >> 3, c = sq & 7;
        const center = 3.5 - Math.max(Math.abs(r - 3.5), Math.abs(c - 3.5));
        const nearEnemy = enemy === 'w' ? r >= 3 : r <= 4;
        const score = heat[sq] * 2 + center * 3 + (nearEnemy ? 2 : 0) + this.rand() * 2;
        if (score > bestScore) { bestScore = score; best = sq; }
      }
      return best;
    }

    quickPlay(m, def, uid) {
      const team = this.team;
      if (!E().canActivate(m, team, def)) return null;
      if (def.id === 'ct_quebra_escudo') {
        const hit = C().legalMoves(m.pos, team, { turn: m.state.turnCount }).some((mv) => mv.captured && mv.captured.shield && PV[mv.captured.type] >= 300);
        return hit ? { score: 70, act: { type: 'ACTIVATE', uid } } : null;
      }
      if (def.target === 'STEAL') {
        const pair = this.bestSteal(m);
        return pair ? { score: 30 + pair.value, act: { type: 'ACTIVATE', uid, target: { from: pair.from, to: pair.to } } } : null;
      }
      if (def.id === 'ct_emp_cartoon') {
        const known = m.traps.filter((t) => t.owner !== team && t.revealed);
        return known.length ? { score: 48, act: { type: 'ACTIVATE', uid, target: { sq: known[0].sq } } } : null;
      }
      return this.quickPlay2(m, def, uid);
    }

    bestSteal(m) {
      const rv = { COMMON: 6, RARE: 12, EPIC: 20, LEGENDARY: 30 };
      let best = null;
      for (const pr of E().stealPairs(m, this.team)) {
        const value = rv[Cards().get(pr.id).rarity] + PV[m.pieceAt(pr.to).type] / 100;
        if (!best || value > best.value) best = { ...pr, value };
      }
      return best;
    }

    // ───────────── respostas na Chain ─────────────
    async respondChain(ctx) {
      await this.wait(Math.min(this.delay, 350));
      const m = ctx.match, team = this.team;
      if (this.rand() < this.cfg.skip) return null;
      const pick = (ids) => {
        for (const id of ids) { const o = ctx.options.find((x) => x.id === id); if (o) return o; }
        return null;
      };
      const val = (p) => (p ? PV[m.realType(p)] : 0);
      let o = null;
      if (ctx.window === 'CAPTURE') {
        const ev = ctx.event, v = val(ev.target);
        if (v >= 300 || this.rand() < 0.2) {
          o = pick(ev.attacker.type !== 'k' && val(ev.attacker) >= 300 ? ['rt_espelho_magico', 'rt_escudo_divino', 'rt_troca_dubles', 'rt_fumaca_ninja'] : ['rt_escudo_divino', 'rt_fumaca_ninja', 'rt_troca_dubles', 'rt_espelho_magico']);
        }
      } else if (ctx.window === 'DESTROYED') {
        o = pick(['rt_vampiro_energia']) || (E().shieldCandidates(m, team).some((p) => val(p) >= 300) ? pick(['rt_cupula_dupla']) : null);
      } else if (ctx.window === 'CHECK') {
        o = pick(['rt_alarme_real']);
      } else if (ctx.window === 'LINK') {
        o = this.linkResponse(m, ctx, pick, val) || this.counterNew(ctx);
      }
      if (!o && ctx.window !== 'LINK') o = this.pickNew(ctx);
      if (!o) return null;
      if (o.def.target) { const tg = this.targetFor(m, o.def); return tg ? { uid: o.uid, target: tg } : null; }
      return { uid: o.uid };
    }

    linkResponse(m, ctx, pick, val) {
      const top = ctx.top, team = this.team;
      const cheap = ['ct_tesoura_corta_fio', 'ct_reverso_tempo', 'ct_julgamento_cartoon', 'ct_confisco_real', 'ct_apito_juiz'];
      if (top.kind === 'GRID') {
        const piece = top.event && top.event.piece;
        const lethal = ['gt_guilhotina_bigorna', 'gt_raio_encolhedor', 'gt_buraco_minhoca'].includes(top.def.id) || (top.def.id === 'gt_mina_repulsora' && piece && piece.type === 'p');
        if (piece && (val(piece) >= 300 || lethal)) return pick(cheap);
        return null;
      }
      if (top.kind === 'REACTIVE') {
        const ev = top.event;
        if (ev && ev.type === 'CAPTURE' && val(ev.target) >= 300) return pick(cheap) || (top.def.shieldCard ? pick(['ct_quebra_escudo']) : null);
        if (top.def.id === 'rt_cupula_dupla') return pick(['ct_quebra_escudo']);
        return null;
      }
      if (top.kind === 'EQUIP') {
        const r = top.def.rarity;
        return r === 'EPIC' || r === 'LEGENDARY' ? pick(['ct_confisco_real', 'ct_apito_juiz']) : null;
      }
      // o adversário anulou uma carta minha: vale a pena o Apito se a minha carta era boa
      const mine = top.targetLink;
      if (mine && mine.team === team && Cards().RARITY[mine.def.rarity].order >= 1) return pick(['ct_apito_juiz']);
      return null;
    }
  }

  YC.BotAI = { Bot, LEVELS, create: (opts) => new Bot(opts) };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
