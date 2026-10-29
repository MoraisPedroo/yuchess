/* CardEffects2.js — Magias Rápidas e Counter-Traps da expansão (CardsNew.js); as Reativas estão em CardReactives.js.
   Alvos: targetSpec() diz que casas se podem escolher (1 casa, ou 2 seguidas: peça + destino/par) e serve
   o motor (validTarget), o ecrã (MatchInput/MatchDrag) e o bot. As Armadilhas de Casa e os Equipamentos
   estão em CardEffects3.js. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const R = () => YC.Cards.RULES;
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const name = (p) => YC.PIECE_NAME[p.type];
  const sqName = (sq) => C().sqName(sq);
  const frozen = (m, p) => p.frozenUntil > m.state.turnCount;

  const E2 = {
    // ───────────── alvos ─────────────
    pieces(m, fn) { const out = []; m.pos.board.forEach((p, sq) => { if (p && fn(p, sq)) out.push(sq); }); return out; },
    mine(m, team, fn = () => true) { return E2.pieces(m, (p, sq) => p.color === team && !p.untargetable && fn(p, sq)); },
    theirs(m, team, fn = () => true) { return E2.pieces(m, (p, sq) => p.color !== team && p.type !== 'k' && !p.untargetable && fn(p, sq)); },
    relRank(p, sq) { return p.color === 'w' ? 8 - (sq >> 3) : (sq >> 3) + 1; },

    /** Primeira peça inimiga (exceto o Rei) em cada direção ortogonal (Nevasca em Spray). */
    lineHits(m, sq, team) {
      const out = [], [r, c] = C().rc(sq);
      for (const [dr, dc] of C().ORTHO) {
        for (let k = 1; k < 8; k++) {
          const t = C().at(r + dr * k, c + dc * k);
          if (t < 0) break;
          const q = m.pos.board[t];
          if (!q) continue;
          if (q.color !== team && q.type !== 'k' && !q.untargetable) out.push(q);
          break;
        }
      }
      return out;
    },

    /** Destinos do Cabo de Tirolesa: a casa da borda em cada direção, com o caminho livre. */
    zipTargets(m, from) {
      const p = m.pieceAt(from), out = [], [r, c] = C().rc(from);
      for (const [dr, dc] of C().KING) {
        let last = -1;
        for (let k = 1; k < 8; k++) {
          const t = C().at(r + dr * k, c + dc * k);
          if (t < 0) break;
          if (!m.freeFor(p, t)) { last = -1; break; }
          last = t;
        }
        if (last >= 0 && m.canRelocate(p, last)) out.push(last);
      }
      return out;
    },

    heliTargets(m, from) {
      const p = m.pieceAt(from), out = [];
      for (let sq = 0; sq < 64; sq++) {
        const rank = E2.relRank(p, sq);
        if ((rank === 1 && p.type !== 'p') || rank === 2) if (m.freeFor(p, sq) && m.canRelocate(p, sq)) out.push(sq);
      }
      return out;
    },

    swapTargets(m, from) {
      const a = m.pieceAt(from), [r, c] = C().rc(from), out = [];
      for (const [dr, dc] of C().KING) {
        const t = C().at(r + dr, c + dc), b = m.pieceAt(t);
        if (b && !b.untargetable && m.canSwap(a, b)) out.push(t);
      }
      return out;
    },

    /** { two, first: [casas], second(from) → [casas], mark: 'pick' | 'trap' } ou null se a carta não tem alvo. */
    targetSpec(m, team, def) {
      const one = (first, mark = 'pick') => ({ two: false, first, second: () => [], mark });
      const two = (second) => ({ two: true, first: E2.mine(m, team, (p, sq) => p.type !== 'k' && second(sq).length > 0), second, mark: 'pick' });
      const shieldOk = m.state.shieldLock[team] !== m.state.turnCount;
      switch (def.id) {
        case 'ct_emp_cartoon': return one(m.pos.board.map((_, i) => i), 'trap');
        case 'ct_ima_equipamento': {
          const pairs = YC.CardEffects.stealPairs(m, team);
          return { two: true, first: [...new Set(pairs.map((p) => p.from))], second: (f) => [...new Set(pairs.filter((p) => p.from === f).map((p) => p.to))], mark: 'pick',
            choose: (f, t) => pairs.filter((p) => p.from === f && p.to === t).map((p) => p.id) };
        }
        case 'qs_sopro_invernal': return one(E2.theirs(m, team, (p) => !p.equips.length));
        case 'qs_raio_desestabilizador': return one(E2.theirs(m, team, (p) => !p.noCap));
        case 'qs_arremesso_ancora': return one(E2.theirs(m, team));
        case 'qs_congelador_relampago': return one(E2.mine(m, team, (p, sq) => E2.lineHits(m, sq, team).length > 0));
        case 'qs_ajuste_calibragem': return one(E2.mine(m, team, (p) => p.type !== 'k'));
        case 'qs_sobrecarga_reator': return one(E2.mine(m, team, (p) => p.equips.length > 0));
        case 'qs_transmutacao_peao': return one(E2.mine(m, team, (p) => p.type === 'p' && !p.morphUntil));
        case 'qs_soro_crescimento': return one(E2.mine(m, team, (p, sq) => p.type === 'p' && !p.morphUntil && E2.relRank(p, sq) >= 6));
        case 'qs_escolta_armada': return one(E2.mine(m, team, (p) => p.type === 'p' && (shieldOk || !p.dash)));
        case 'qs_bloqueio_tatico': return shieldOk ? one(E2.mine(m, team, (p, sq) => p.type !== 'k' && (!p.shield || !!E2.shieldNeighbour(m, sq)))) : one([]);
        case 'qs_intimacao_urgente': return one(m.pos.board.map((p, i) => (p || C().isBlocked(m.pos, i) ? -1 : i)).filter((i) => i >= 0), 'trap');
        case 'qs_cambalhota_maluca': return two((f) => E2.swapTargets(m, f));
        case 'qs_cabo_aco_voador': { const s = (f) => (m.pieceAt(f).type === 'p' ? [] : E2.zipTargets(m, f)); return two(s); }
        case 'qs_helicoptero_apoio': return two((f) => E2.heliTargets(m, f));
        default: return null;
      }
    },

    validTarget(m, team, def, target) {
      const spec = E2.targetSpec(m, team, def);
      if (!spec) return true;
      if (!target) return false;
      if (spec.two) {
        if (!spec.first.includes(target.from) || !spec.second(target.from).includes(target.to)) return false;
        return !target.id || !spec.choose || spec.choose(target.from, target.to).includes(target.id);
      }
      return Number.isInteger(target.sq) && spec.first.includes(target.sq);
    },

    shieldNeighbour(m, sq) {
      const [r, c] = C().rc(sq);
      let best = null;
      for (const [dr, dc] of C().KING) {
        const q = m.pieceAt(C().at(r + dr, c + dc)), p = m.pieceAt(sq);
        if (q && q.color === p.color && q.type !== 'k' && !q.shield && (!best || VAL[q.type] > VAL[best.type])) best = q;
      }
      return best;
    },

    /** Magias Rápidas novas: só se ativam se fizerem alguma coisa. */
    canActivate(m, team, def) {
      if (def.ownTurn && m.state.active !== team) return false;
      const p = m.players[team], enemy = m.other(team);
      if (def.target && def.target !== 'SQUARE') { const s = E2.targetSpec(m, team, def); return !!s && s.first.length > 0; }
      switch (def.id) {
        case 'qs_intimacao_urgente': return E2.targetSpec(m, team, def).first.length > 0;
        case 'qs_recauchutagem_express': return m.lastInGy(team, ['EQUIP']) >= 0 && p.hand.length < R().MAX_HAND;
        case 'qs_inspecao_tributaria': return m.traps.some((t) => t.owner === enemy);
        case 'qs_saque_rapido': return p.deck.length > 0;
        default: return null;
      }
    },

    async resolveQuick(m, l) {
      const team = l.team, enemy = m.other(team), def = l.def, id = def.id, t = l.target || {};
      if (def.target && !E2.validTarget(m, team, def, t)) { m.say(`${def.name} falhou: o alvo já não serve.`, team, { card: id }); return; }
      const piece = t.sq != null ? m.pieceAt(t.sq) : t.from != null ? m.pieceAt(t.from) : null;
      const say = (text, sq) => m.say(text, team, { card: id, sq });
      switch (id) {
        case 'qs_sopro_invernal': say(`Brisa Polar: ${name(piece)} congelad${YC.PIECE_FEM[piece.type] ? 'a' : 'o'}.`, t.sq); return m.freeze(piece, 1, id);
        case 'qs_congelador_relampago':
          say('Nevasca em Spray!', t.sq);
          for (const q of E2.lineHits(m, t.sq, team)) await m.freeze(q, 1, id);
          return;
        case 'qs_ajuste_calibragem': {
          piece.trapProof = true;
          say(`Óleo Turbo: ${name(piece)} não ativa armadilhas neste turno.`, t.sq);
          const [r, c] = C().rc(t.sq);
          for (const tr of m.traps) {
            const [tr0, tc0] = C().rc(tr.sq);
            if (tr.owner === enemy && !tr.revealed && Math.abs(tr0 - r) <= 1 && Math.abs(tc0 - c) <= 1) { tr.revealed = true; await m.bus.emitAsync('trap:reveal', { trap: tr }); }
          }
          return;
        }
        case 'qs_sobrecarga_reator':
          await m.stripEquips(piece, 1);
          say('Sobrecarga! Escudos para as Torres e Damas.', t.sq);
          for (const q of m.pos.board.slice()) if (q && q.color === team && (q.type === 'r' || q.type === 'q')) await m.giveShield(q, id);
          return m.addActions(team, 1);
        case 'qs_recauchutagem_express': await m.recoverFromGy(team, ['EQUIP']); return m.addActions(team, 1);
        case 'qs_cambalhota_maluca': say('Malabarismo: duas peças trocaram de lugar.', t.to); return m.swapPieces(piece, m.pieceAt(t.to), 'swap');
        case 'qs_cabo_aco_voador': say(`Tirolesa: ${name(piece)} voou para ${sqName(t.to)}.`, t.to); return m.relocate(piece, t.to, 'zip');
        case 'qs_helicoptero_apoio': say(`Helicóptero: ${name(piece)} resgatad${YC.PIECE_FEM[piece.type] ? 'a' : 'o'} para ${sqName(t.to)}.`, t.to); return m.relocate(piece, t.to, 'fly');
        case 'qs_transmutacao_peao': say('Elixir: o Peão virou Cavalo durante 2 turnos.', t.sq); return m.morphTo(piece, 'n', 2, id);
        case 'qs_raio_desestabilizador': say(`Raio Quântico: ${name(piece)} não pode capturar.`, t.sq); return m.setStatus(piece, 'noCap', 1, id);
        case 'qs_soro_crescimento': return m.promoteNow(piece, id);
        case 'qs_intimacao_urgente': say(`Intimação: ${sqName(t.sq)} bloqueada.`, t.sq); return m.blockSquare(t.sq, 2, enemy, id);
        case 'qs_inspecao_tributaria': {
          const list = m.traps.filter((x) => x.owner === enemy);
          for (const tr of list) if (!tr.revealed) { tr.revealed = true; await m.bus.emitAsync('trap:reveal', { trap: tr }); }
          const center = (sq) => { const [r, c] = C().rc(sq); return Math.abs(r - 3.5) + Math.abs(c - 3.5); };
          const out = list.slice().sort((a, b) => center(a.sq) - center(b.sq) || a.sq - b.sq)[0];
          if (out) {
            m.traps.splice(m.traps.indexOf(out), 1);
            m.players[out.owner].banished.push(out.id);
            say(`Auditoria: "${YC.Cards.get(out.id).name}" saiu do jogo.`, out.sq);
            await m.bus.emitAsync('trap:destroy', { sq: out.sq, trap: out, cause: 'banish' });
          }
          return m.draw(team, 1, 'card');
        }
        case 'qs_saque_rapido': await m.draw(team, 2, 'card'); return m.discardWeakest(team);
        case 'qs_arremesso_ancora': say(`Âncora: ${name(piece)} arrastad${YC.PIECE_FEM[piece.type] ? 'a' : 'o'} para trás.`, t.sq); await m.pushHome(piece, 2, 'push'); return m.freeze(piece, 1, id);
        case 'qs_escolta_armada':
          piece.dash = true;
          say('Escolta: o Peão pode avançar 2 casas.', t.sq);
          return m.giveShield(piece, id);
        case 'qs_bloqueio_tatico': return m.giveShield(piece.shield ? E2.shieldNeighbour(m, t.sq) : piece, id);
      }
    },

    // ───────────── Counter-Traps: o que fazem depois de anular ─────────────
    async counterExtra(m, l, t) {
      const def = l.def, team = l.team, enemy = m.other(team);
      if (def.freezeRandom) {
        const list = m.pos.board.filter((p) => p && p.color === enemy && p.type !== 'k' && !p.untargetable);
        if (list.length) await m.freeze(list[m.rng.int(list.length)], def.freezeRandom, def.id);
      }
      if (def.shatter) for (const p of m.pos.board.slice()) if (p && p.color === enemy) await m.shatter(p, def.id);
      if (def.revealAll) for (const tr of m.traps) if (tr.owner === enemy && !tr.revealed) { tr.revealed = true; await m.bus.emitAsync('trap:reveal', { trap: tr }); }
      if (def.freezeEquipTarget && t.kind === 'EQUIP') { const p = m.pieceById(t.target && t.target.pieceId); if (p) await m.freeze(p, def.freezeEquipTarget, def.id); }
      if (def.actionsMinus) { await m.addActions(enemy, -def.actionsMinus); m.say('O adversário fica sem cartas no próximo turno.', team, { card: def.id }); }
      if (def.stripAll) for (const p of m.pos.board.slice()) if (p && p.color === enemy && p.equips.length) await m.stripEquips(p);
    }
  };

  YC.CardEffects2 = E2;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
