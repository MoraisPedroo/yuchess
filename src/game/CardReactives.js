/* CardReactives.js — Armadilhas Reativas da expansão (acrescenta métodos ao YC.CardEffects2):
   quando cada uma pode responder (captura declarada, peça destruída, xeque) e o que faz ao resolver. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const R = () => YC.Cards.RULES;
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const name = (p) => YC.PIECE_NAME[p.type];
  const sqName = (sq) => C().sqName(sq);
  const frozen = (m, p) => p.frozenUntil > m.state.turnCount;
  const E2 = YC.CardEffects2;

  Object.assign(E2, {
    // ───────────── Armadilhas Reativas ─────────────
    /** Peça tua mais barata (exceto o Rei) que pode trocar com a atacada (Ilusão de Espelhos). */
    swapPartner(m, ev) {
      let best = null;
      for (const p of m.pos.board) {
        if (!p || p.color !== ev.target.color || p === ev.target || p.type === 'k' || !m.canSwap(ev.target, p)) continue;
        if (!best || VAL[p.type] < VAL[best.type]) best = p;
      }
      return best;
    },

    /** Casa vazia segura (não atacada) do próprio lado para o Truque de Desaparecimento. */
    vanishSquare(m, ev) {
      const p = ev.target, enemy = m.other(p.color);
      let fallback = -1;
      for (let i = 0; i < 64; i++) {
        const sq = p.color === 'w' ? 63 - i : i;
        if (E2.relRank(p, sq) > 4 || !m.freeFor(p, sq) || !m.canRelocate(p, sq)) continue;
        const saved = m.pos.board.slice(), from = m.sqOf(p);
        m.pos.board[from] = null; m.pos.board[sq] = p;
        const safe = !C().isAttacked(m.pos, sq, enemy);
        saved.forEach((q, i) => { m.pos.board[i] = q; });
        if (safe) return sq;
        if (fallback < 0) fallback = sq;
      }
      return fallback;
    },

    /** Casas onde uma Torre tapa o xeque (entre o Rei e quem o ataca em linha) ou, senão, ao lado do Rei. */
    cordonPlan(m, team, ev) {
      const king = ev.kingSq, out = [], [kr, kc] = C().rc(king);
      const enemy = m.other(team);
      for (const ch of ev.checkers) {
        const cs = m.sqOf(ch);
        if (cs < 0 || ch.type === 'n' || ch.type === 'p') continue;
        const [cr, cc] = C().rc(cs), dr = Math.sign(cr - kr), dc = Math.sign(cc - kc);
        for (let k = 1; ; k++) { const s = C().at(kr + dr * k, kc + dc * k); if (s < 0 || s === cs) break; out.push(s); }
      }
      for (const [dr, dc] of C().KING) { const s = C().at(kr + dr, kc + dc); if (s >= 0 && !out.includes(s)) out.push(s); }
      const before = C().attackersOf(m.pos, king, enemy, true).length;
      for (const sq of out) {
        for (const rook of m.pos.board) {
          if (!rook || rook.color !== team || rook.type !== 'r' || rook.untargetable || !m.freeFor(rook, sq)) continue;
          const from = m.sqOf(rook), saved = m.pos.board.slice();
          m.pos.board[from] = null; m.pos.board[sq] = rook;
          const after = C().attackersOf(m.pos, king, enemy, true).length;
          const hitsActive = m.state.active !== team && C().inCheck(m.pos, m.state.active);
          saved.forEach((q, i) => { m.pos.board[i] = q; });
          if (after <= before && !hitsActive) return { rook, sq };
        }
      }
      return null;
    },

    canPushAway(m, piece, fromSq) {
      const sq = m.sqOf(piece);
      if (sq < 0 || piece.type === 'k') return false;
      const [r, c] = C().rc(sq), [r0, c0] = C().rc(fromSq), t = C().at(r + Math.sign(r - r0), c + Math.sign(c - c0));
      return m.freeFor(piece, t) && m.canRelocate(piece, t);
    },

    canRespondToEvent(m, team, def, ev) {
      const enemy = m.other(team), mine = ev.team === team, by = ev.by, alive = (p) => !!p && m.sqOf(p) >= 0;
      switch (def.id) {
        case 'rt_congelamento_defesa': return ev.target.color === team && ev.target.type === 'p';
        case 'rt_fusao_engenhocas': return ev.target.color === team && ev.target.equips.length > 0;
        case 'rt_troca_truque': return ev.target.color === team && !!E2.swapPartner(m, ev);
        case 'rt_truque_desaparecer': return ev.target.color === team && E2.vanishSquare(m, ev) >= 0;
        case 'rt_pele_borracha': return ev.target.color === team;
        case 'rt_injuncao_suprema': return ev.target.color === team;
        case 'rt_canhoneio_bordo': return ev.target.color === team && 'nbrq'.includes(m.realType(ev.target));
        case 'rt_estatua_gelo': case 'rt_algemas_rapidas': return mine && ev.cause === 'capture' && alive(by) && by.type !== 'k';
        case 'rt_mandado_apreensao': return mine && ev.cause === 'capture' && alive(by) && by.equips.length > 0;
        case 'rt_troca_pecas_express': return mine && (ev.equips || []).some((id) => m.players[team].gy.includes(id) && YC.CardEffects.equipTargets(m, team, YC.Cards.get(id)).length > 0);
        case 'rt_reacao_quimica_cadeia': return mine && E2.theirs(m, team, (p) => 'nbrq'.includes(p.type)).length > 0;
        case 'rt_seguro_naufragio': return mine && m.lastInGy(team, ['EQUIP', 'QUICK']) >= 0 && m.players[team].hand.length < R().MAX_HAND;
        case 'rt_reciclagem_turbo': return mine && (m.players[team].deck.length > 0 || m.players[enemy].hand.length > 0);
        case 'rt_buzina_estridente': return mine && ev.checkers.some((c) => E2.canPushAway(m, c, ev.kingSq));
        case 'rt_antidoto_emergencia': return mine && (m.pos.board.some((p) => p && p.color === team && (frozen(m, p) || p.morphUntil)) || YC.CardEffects.shieldCandidates(m, team).length > 0);
        case 'rt_habeas_corpus': return mine && alive(ev.mover) && ev.checkers.includes(ev.mover) && ev.mover.type !== 'k' && m.canRelocate(ev.mover, ev.moverFrom) && m.freeFor(ev.mover, ev.moverFrom);
        case 'rt_cordao_seguranca': return mine && !!E2.cordonPlan(m, team, ev);
        default: return false;
      }
    },

    async resolveReactive(m, l) {
      const ev = l.event, team = l.team, enemy = m.other(team), id = l.def.id, by = ev.by;
      const say = (text, sq) => m.say(text, team, { card: id, sq });
      switch (id) {
        case 'rt_congelamento_defesa': ev.negated = true; return m.freeze(ev.attacker, 1, id);
        case 'rt_fusao_engenhocas': await m.stripEquips(ev.target, 1); ev.negated = true; return m.draw(team, 1, 'card');
        case 'rt_troca_truque': { const b = E2.swapPartner(m, ev); if (b && await m.swapPieces(ev.target, b, 'swap')) ev.negated = true; return; }
        case 'rt_truque_desaparecer': {
          const to = E2.vanishSquare(m, ev);
          if (to >= 0 && await m.relocate(ev.target, to, 'teleport')) ev.negated = true;
          return m.freeze(ev.attacker, 2, id);
        }
        case 'rt_pele_borracha': ev.negated = true; await m.giveShield(ev.target, id); return m.pushAway(ev.attacker, m.sqOf(ev.target), 2, 'push');
        case 'rt_injuncao_suprema':
          ev.negated = true;
          if (ev.attacker.type !== 'k') await m.removeOrFreeze(ev.attacker, id);
          return m.discardRandom(enemy, 1, id);
        case 'rt_canhoneio_bordo': ev.negated = true; await m.pushAway(ev.attacker, m.sqOf(ev.target), 2, 'push'); return m.draw(team, 1, 'card');
        case 'rt_estatua_gelo': if (by.type !== 'p') await m.morphTo(by, 'p', 2, id); return m.freeze(by, 2, id);
        case 'rt_algemas_rapidas': return m.freeze(by, 2, id);
        case 'rt_mandado_apreensao': await m.stripEquips(by, 1); return m.draw(team, 1, 'card');
        case 'rt_troca_pecas_express':
          for (const eid of ev.equips || []) {
            const gy = m.players[team].gy, i = gy.lastIndexOf(eid), def = YC.Cards.get(eid);
            const sq = i >= 0 ? YC.CardEffects.equipTargets(m, team, def).sort((a, b) => VAL[m.pieceAt(b).type] - VAL[m.pieceAt(a).type])[0] : undefined;
            if (sq == null) continue;
            gy.splice(i, 1);
            m.pieceAt(sq).equips.push(eid);
            say(`${def.name} passou para ${name(m.pieceAt(sq))} em ${sqName(sq)}.`, sq);
            await m.bus.emitAsync('equip:transfer', { piece: m.pieceAt(sq), sq, id: eid });
          }
          return;
        case 'rt_reacao_quimica_cadeia': {
          const list = E2.theirs(m, team, (p) => 'nbrq'.includes(p.type)).sort((a, b) => VAL[m.pieceAt(b).type] - VAL[m.pieceAt(a).type] || a - b);
          return list.length ? m.morphTo(m.pieceAt(list[0]), 'p', 2, id) : null;
        }
        case 'rt_seguro_naufragio': return m.recoverFromGy(team, ['EQUIP', 'QUICK']);
        case 'rt_reciclagem_turbo': await m.draw(team, 2, 'card'); return m.discardRandom(enemy, 1, id);
        case 'rt_buzina_estridente':
          for (const c of ev.checkers) if (E2.canPushAway(m, c, ev.kingSq)) await m.pushAway(c, ev.kingSq, 1, 'push');
          return;
        case 'rt_antidoto_emergencia':
          for (let sq = 0; sq < 64; sq++) {
            const p = m.pos.board[sq];
            if (!p || p.color !== team) continue;
            if (frozen(m, p)) { p.frozenUntil = 0; await m.bus.emitAsync('piece:thaw', { piece: p, sq }); }
            if (p.morphUntil) {
              // fora da vez, voltar à forma original não pode dar xeque a quem está a jogar
              const now = p.type; p.type = p.morphFrom;
              const bad = team !== m.state.active && C().inCheck(m.pos, m.state.active);
              p.type = now;
              if (!bad) await m.unmorph(p, sq);
            }
          }
          { const best = YC.CardEffects.shieldCandidates(m, team)[0]; if (best) await m.giveShield(best, id); }
          return;
        case 'rt_habeas_corpus': say('Despejo! A peça voltou para trás.', ev.moverFrom); await m.relocate(ev.mover, ev.moverFrom, 'eject'); return m.draw(team, 1, 'card');
        case 'rt_cordao_seguranca': {
          const plan = E2.cordonPlan(m, team, ev);
          if (!plan) return;
          const from = m.sqOf(plan.rook);
          m.pos.board[from] = null; m.pos.board[plan.sq] = plan.rook;
          say(`Cordão de Polícia: a Torre saltou para ${sqName(plan.sq)}.`, plan.sq);
          await m.bus.emitAsync('piece:relocate', { piece: plan.rook, from, to: plan.sq, style: 'teleport' });
          return m.giveShield(plan.rook, id);
        }
      }
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
