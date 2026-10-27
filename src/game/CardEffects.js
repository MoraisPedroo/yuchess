/* CardEffects.js — condições e efeitos das 31 cartas originais (as da expansão estão em CardEffects2.js e
   CardEffects3.js, chamados daqui). Os dados estão em Cards.js / CardsNew.js; aqui decide-se quando cada carta
   pode ser usada e o que faz ao resolver na Chain. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const R = () => YC.Cards.RULES;
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const sqName = (sq) => C().sqName(sq);
  const name = (p) => YC.PIECE_NAME[p.type];

  const E = {
    VAL,

    canEquip(def, piece, team, sq) {
      return !!piece && !!def && def.kind === 'EQUIP' && (!team || piece.color === team) && piece.type !== 'k'
        && def.pieces.includes(piece.type) && piece.equips.length < R().MAX_EQUIPS && !piece.equips.includes(def.id)
        && (sq == null || YC.CardEffects3.canEquip(def, piece, sq));
    },

    equipTargets(m, team, def) {
      const out = [];
      for (let sq = 0; sq < 64; sq++) if (E.canEquip(def, m.pos.board[sq], team, sq)) out.push(sq);
      return out;
    },

    /** Casas vazias (e não bloqueadas) das filas 3 a 6 sem armadilha própria. */
    trapSquares(m, team) {
      const out = [];
      for (let sq = 16; sq < 48; sq++) if (!m.pos.board[sq] && !m.trapAt(sq, team) && !C().isBlocked(m.pos, sq)) out.push(sq);
      return out;
    },

    stealPick(from, to, team) {
      return from.equips.find((id) => E.canEquip(YC.Cards.get(id), to, team)) || null;
    },

    /** Pares possíveis para o Íman. Fora do próprio turno não pode pôr o Rei de quem joga em xeque
        (ex.: dar o Cetro a um Peão ao lado do Rei inimigo a meio do lance dele). */
    stealPairs(m, team) {
      const out = [], b = m.pos.board, enemy = m.other(team), guard = m.state.active !== team;
      for (let f = 0; f < 64; f++) {
        const ep = b[f];
        if (!ep || ep.color === team || !ep.equips.length) continue;
        for (let t = 0; t < 64; t++) {
          const mine = b[t];
          if (!mine || mine.color !== team) continue;
          const id = E.stealPick(ep, mine, team);
          if (!id) continue;
          if (guard) {
            const i = ep.equips.indexOf(id);
            ep.equips.splice(i, 1); mine.equips.push(id);
            const bad = C().inCheck(m.pos, enemy);
            mine.equips.pop(); ep.equips.splice(i, 0, id);
            if (bad) continue;
          }
          out.push({ from: f, to: t, id });
        }
      }
      return out;
    },

    enemyShields(m, team) { return m.pos.board.filter((p) => p && p.color !== team && p.shield).length; },

    validTarget(m, team, def, target) {
      if (!def.target) return true;
      return YC.CardEffects2.validTarget(m, team, def, target);
    },

    /** Magia Rápida ativada na própria preparação: só se fizer alguma coisa. */
    canActivate(m, team, def) {
      if (def.target === 'STEAL') return E.stealPairs(m, team).length > 0;
      if (def.id === 'ct_emp_cartoon') return m.traps.length > 0;
      if (def.id === 'ct_quebra_escudo') return E.enemyShields(m, team) > 0;
      return !!YC.CardEffects2.canActivate(m, team, def);
    },

    canRespondToLink(m, team, def, top) {
      if (top.negated) return false;
      if (def.kind === 'COUNTER') return def.negates.includes(top.kind);
      if (def.id === 'ct_quebra_escudo') return E.enemyShields(m, team) > 0 || !!top.def.shieldCard || !!top.def.shield;
      return E.canActivate(m, team, def);
    },

    canRespondToEvent(m, team, def, ev) {
      const lock = m.state.shieldLock[team] === m.state.turnCount;
      switch (def.id) {
        case 'rt_escudo_divino': return ev.target.color === team && !lock;
        case 'rt_espelho_magico': return ev.target.color === team;
        case 'rt_fumaca_ninja': return ev.target.color === team && E.dodgeSquare(m, ev) >= 0;
        case 'rt_troca_dubles': return ev.target.color === team && 'nbrq'.includes(ev.target.type) && !!E.substitutePawn(m, team);
        case 'rt_alarme_real': return ev.team === team && ev.checkers.length > 0;
        case 'rt_vampiro_energia': return ev.team === team && m.players[team].deck.length > 0 && (!def.majorOnly || 'nbrq'.includes(m.realType(ev.piece)));
        case 'rt_cupula_dupla': return ev.team === team && !lock && E.shieldCandidates(m, team).length > 0;
        default: return YC.CardEffects2.canRespondToEvent(m, team, def, ev);
      }
    },

    /** Casa adjacente vazia para a Bomba de Fumo: de preferência uma que não esteja atacada.
        Simula o resultado completo (esquiva + o atacante a ocupar a casa) para ninguém acabar em xeque. */
    dodgeSquare(m, ev) {
      const piece = ev.target, from = m.sqOf(piece), attacker = ev.attacker;
      if (from < 0) return -1;
      const enemy = m.other(piece.color), pos = m.pos;
      const moves = attacker && ev.move && ev.move.flag !== 'r' && m.sqOf(attacker) === ev.from;
      const [r, c] = C().rc(from);
      let fallback = -1;
      for (const [dr, dc] of C().KING) {
        const to = C().at(r + dr, c + dc);
        if (to < 0 || to === ev.to || pos.board[to]) continue;
        if (piece.type === 'p' && (to >> 3 === 0 || to >> 3 === 7)) continue;
        const saved = pos.board.slice();
        pos.board[from] = null; pos.board[to] = piece;
        if (moves) { pos.board[ev.from] = null; pos.board[ev.to] = attacker; }
        const legal = !C().inCheck(pos, piece.color) && !C().inCheck(pos, enemy);
        const safe = legal && !C().isAttacked(pos, to, enemy);
        saved.forEach((q, i) => { pos.board[i] = q; });
        if (safe) return to;
        if (legal && fallback < 0) fallback = to;
      }
      return fallback;
    },

    /** Peão aliado menos avançado que pode morrer sem expor o Rei (Boneco de Testes). */
    substitutePawn(m, team) {
      const list = [];
      for (let sq = 0; sq < 64; sq++) {
        const p = m.pos.board[sq];
        if (p && p.color === team && p.type === 'p' && m.canRemove(p)) list.push({ p, sq });
      }
      list.sort((a, b) => (team === 'w' ? b.sq - a.sq : a.sq - b.sq));
      return list.length ? list[0].p : null;
    },

    shieldCandidates(m, team) {
      const list = [];
      m.pos.board.forEach((p, sq) => { if (p && p.color === team && p.type !== 'k' && !p.shield) list.push({ p, sq }); });
      list.sort((a, b) => VAL[m.realType(b.p)] - VAL[m.realType(a.p)] || a.sq - b.sq);
      return list.map((x) => x.p);
    },

    wormholeSquare(m, piece, sq) {
      const list = [];
      const [r0, c0] = C().rc(sq);
      for (let r = 0; r < 8; r++) {
        for (const c of [0, 7]) {
          const to = r * 8 + c;
          if (to === sq || m.pos.board[to]) continue;
          if (piece.type === 'p' && (r === 0 || r === 7)) continue;
          list.push({ to, d: (r - r0) ** 2 + (c - c0) ** 2 });
        }
      }
      list.sort((a, b) => b.d - a.d || a.to - b.to);
      const ok = list.find((x) => m.canRelocate(piece, x.to));
      return ok ? ok.to : -1;
    },

    async pushBack(m, piece, ev) {
      const sq = m.sqOf(piece);
      const [r, c] = C().rc(sq), [fr, fc] = C().rc(ev.from);
      const to = C().at(r + Math.sign(fr - r), c + Math.sign(fc - c));
      if (to < 0 || to === sq || (piece.type === 'p' && (to >> 3 === 0 || to >> 3 === 7))) return m.bus.emitAsync('piece:bump', { piece, sq });
      return m.relocate(piece, to, 'push');
    },

    // ───────────── resolução ─────────────
    async resolve(m, l) {
      const def = l.def, team = l.team, enemy = m.other(team);
      if (l.kind === 'EQUIP') {
        const piece = m.pieceById(l.target && l.target.pieceId);
        if (!E.canEquip(def, piece, team, m.sqOf(piece))) { m.say(`${def.name} falhou: a peça já não serve.`, team, { card: def.id }); return; }
        piece.equips.push(def.id);
        l.keep = true;
        const sq = m.sqOf(piece);
        m.say(`${def.name} equipada: ${name(piece)} em ${sqName(sq)}.`, team, { card: def.id, sq, pieceId: piece.id });
        await m.bus.emitAsync('equip:attach', { piece, sq, card: def, inst: l.inst, team });
        await YC.CardEffects3.onEquip(m, piece, def);
        if (def.shield) await m.giveShield(piece, def.id);
        return;
      }
      if (l.kind === 'GRID') return E.resolveGrid(m, l);
      if (l.kind === 'REACTIVE') return E.resolveReactive(m, l);
      if (l.kind === 'COUNTER') {
        const t = l.targetLink;
        if (!t || t.negated) return;
        t.negated = true;
        if (def.toDeck) t.toDeck = true;
        m.say(`${def.name} anulou "${t.def.name}"!`, team, { card: def.id });
        await m.bus.emitAsync('chain:negate', { link: t, by: l });
        if (def.draw) await m.draw(team, def.draw, 'card');
        if (def.reveal) {
          const hidden = m.traps.find((x) => x.owner === enemy && !x.revealed);
          if (hidden) { hidden.revealed = true; m.say(`Armadilha inimiga revelada em ${sqName(hidden.sq)}.`, team, { card: hidden.id, uid: hidden.uid, sq: hidden.sq }); await m.bus.emitAsync('trap:reveal', { trap: hidden }); }
        }
        if (def.freeze && t.event && t.event.target && m.sqOf(t.event.target) >= 0) await m.freeze(t.event.target, 1, def.id);
        return YC.CardEffects2.counterExtra(m, l, t);
      }
      return E.resolveQuick(m, l);
    },

    async resolveGrid(m, l) {
      const ev = l.event, piece = ev.piece, id = l.def.id;
      const sq = m.sqOf(piece);
      if (sq < 0) return;
      m.say(`${l.def.name} apanhou ${YC.PIECE_FEM[piece.type] ? 'a' : 'o'} ${name(piece)} em ${sqName(sq)}!`, l.team, { card: id, uid: l.inst && l.inst.uid, sq, pieceId: piece.id });
      switch (id) {
        case 'gt_mina_repulsora':
          if (piece.type === 'p') return m.removeOrFreeze(piece, id);
          await E.pushBack(m, piece, ev);
          return m.freeze(piece, 1, id);
        case 'gt_jaula_estatica': return m.freeze(piece, 2, id);
        case 'gt_guilhotina_bigorna': {
          const near = YC.CardEffects3.around(m, sq, l.team);
          await m.removeOrFreeze(piece, id);
          for (const q of near) if (m.sqOf(q) >= 0) await m.freeze(q, 1, id);
          return;
        }
        case 'gt_pantano_chiclete': {
          if (piece.equips.length) {
            const ids = piece.equips.splice(0);
            m.players[piece.color].gy.push(...ids);
            await m.bus.emitAsync('equip:strip', { piece, sq, ids });
          }
          return m.freeze(piece, 1, id);
        }
        case 'gt_mola_retorno': return m.relocate(piece, ev.from, 'eject');
        case 'gt_raio_encolhedor':
          if (piece.type === 'k' || piece.type === 'p') return m.bus.emitAsync('piece:immune', { piece, sq });
          piece.morphFrom = piece.type;
          piece.type = 'p';
          piece.morphUntil = m.untilTurn(piece.color, 2);
          return m.bus.emitAsync('piece:morph', { piece, sq });
        case 'gt_buraco_minhoca': {
          const to = E.wormholeSquare(m, piece, sq);
          return to >= 0 ? m.relocate(piece, to, 'teleport') : m.bus.emitAsync('piece:bump', { piece, sq });
        }
        case 'gt_bomba_tinta':
          await E.pushBack(m, piece, ev);
          return m.draw(l.team, 1, 'card');
        default: return YC.CardEffects3.resolveGrid(m, l);
      }
    },

    async resolveReactive(m, l) {
      const ev = l.event, team = l.team, id = l.def.id;
      switch (id) {
        case 'rt_escudo_divino':
          if (m.state.shieldLock[team] === m.state.turnCount) return m.bus.emitAsync('shield:blocked', { piece: ev.target, sq: m.sqOf(ev.target) });
          ev.negated = true;
          return m.bus.emitAsync('shield:divine', { piece: ev.target, sq: m.sqOf(ev.target), attackerSq: m.sqOf(ev.attacker) });
        case 'rt_espelho_magico':
          ev.negated = true;
          await m.bus.emitAsync('mirror:bounce', { from: m.sqOf(ev.target), to: m.sqOf(ev.attacker) });
          if (ev.attacker.type !== 'k') await m.removeOrFreeze(ev.attacker, id);
          return;
        case 'rt_fumaca_ninja': {
          const to = E.dodgeSquare(m, ev);
          if (to < 0) return;
          if (await m.relocate(ev.target, to, 'dodge')) ev.dodged = true;
          return;
        }
        case 'rt_troca_dubles': {
          const pawn = E.substitutePawn(m, team);
          if (!pawn) return;
          await m.bus.emitAsync('dummy:swap', { piece: ev.target, sq: m.sqOf(ev.target), pawnSq: m.sqOf(pawn) });
          await m.destroyPiece(pawn, id);
          ev.negated = true;
          return;
        }
        case 'rt_alarme_real':
          for (const c of ev.checkers) if (m.sqOf(c) >= 0) await m.freeze(c, 2, id);
          return m.draw(team, 1, 'card');
        case 'rt_vampiro_energia': return m.draw(team, 2, 'card');
        case 'rt_cupula_dupla':
          for (const p of E.shieldCandidates(m, team).slice(0, 2)) await m.giveShield(p, id);
          return;
        default: return YC.CardEffects2.resolveReactive(m, l);
      }
    },

    async resolveQuick(m, l) {
      const team = l.team, enemy = m.other(team), id = l.def.id;
      if (id === 'ct_ima_equipamento') {
        const from = m.pieceAt(l.target.from), to = m.pieceAt(l.target.to);
        if (!from || !to || from.color === team || to.color !== team) return;
        const eq = E.stealPick(from, to, team);
        if (!eq) return;
        from.equips.splice(from.equips.indexOf(eq), 1);
        to.equips.push(eq);
        m.say(`Íman! Roubou ${YC.Cards.get(eq).name}.`, team, { card: eq, sq: l.target.to, pieceId: to.id });
        return m.bus.emitAsync('equip:steal', { from: l.target.from, to: l.target.to, id: eq, team });
      }
      if (id === 'ct_emp_cartoon') {
        const [r, c] = C().rc(l.target.sq);
        const hits = m.traps.filter((t) => { const [tr, tc] = C().rc(t.sq); return Math.abs(tr - r) <= 1 && Math.abs(tc - c) <= 1; });
        await m.bus.emitAsync('emp:blast', { sq: l.target.sq, hits: hits.map((t) => t.sq), team });
        for (const t of hits) {
          m.traps.splice(m.traps.indexOf(t), 1);
          m.players[t.owner].gy.push(t.id);
          await m.bus.emitAsync('trap:destroy', { sq: t.sq, trap: t, cause: 'emp' });
        }
        m.say(hits.length ? `Pulso EMP destruiu ${hits.length} armadilha(s).` : 'O Pulso EMP não encontrou armadilhas.', team, { card: id, sq: l.target.sq });
        return;
      }
      if (id === 'ct_quebra_escudo') {
        m.state.shieldLock[enemy] = m.state.turnCount;
        for (let sq = 0; sq < 64; sq++) {
          const p = m.pos.board[sq];
          if (p && p.color === enemy && p.shield) { p.shield = false; await m.bus.emitAsync('shield:shatter', { piece: p, sq, cause: id }); }
        }
        m.say('Britadeira! Escudos inimigos furados.', team, { card: id });
        return;
      }
      return YC.CardEffects2.resolveQuick(m, l);
    }
  };

  YC.CardEffects = E;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
