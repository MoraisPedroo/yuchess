/* MoveResolver.js — resolve um lance de xadrez com as interrupções das cartas:
   1) captura declarada → janela das Armadilhas Reativas do defensor (Chain);
   2) Escudo da peça alvo (estilhaça e o atacante volta para trás);
   3) o lance acontece; morte da peça capturada (Espada, Armadura, compra de recuperação);
   4) Armadilha de Casa escondida no destino → Chain; 5) Aura Glacial;
   6) janelas de "peça destruída" e de xeque (Guarda-Costas do Rei). */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const Chain = () => YC.ChainResolver;

  const MR = {
    async execute(m, mv) {
      const s = m.state, piece = mv.piece, team = piece.color, enemy = m.other(team);
      s.phase = 'RESOLVE';
      m.say(C().moveLabel(mv), team, { move: { from: mv.from, to: mv.to, piece: piece.type, capture: !!mv.captured }, pieceId: piece.id });
      let move = mv;
      if (mv.captured) {
        const done = await MR.declareCapture(m, mv);
        if (done === true) return MR.finish(m, team);
        if (done) move = done;
      }
      const target = move.captured;
      const capSq = target ? (move.flag === 'e' ? move.to + (team === 'w' ? 8 : -8) : move.to) : -1;
      C().makeMove(m.pos, move);
      s.movedThisTurn = true;
      await m.bus.emitAsync('piece:move', { move, piece, from: move.from, to: move.to, captured: target, capSq, team });
      if (move.promo) {
        m.say(`Promoção: ${YC.PIECE_NAME[move.promo]}!`, team, { sq: move.to, pieceId: piece.id });
        await m.bus.emitAsync('piece:promote', { piece, sq: move.to });
      }
      if (target) await MR.onCapture(m, piece, target, capSq);

      // Armadilha de Casa escondida onde o lance acabou (só em casa vazia)
      if (!target && move.flag !== 'r' && move.flag !== 'miss') {
        const spots = move.flag === 'k' ? [[move.to, move.from], [move.rookTo, move.rookFrom]] : [[move.to, move.from]];
        for (const [sq, from] of spots) {
          const trap = m.trapAt(sq, enemy);
          if (trap) { await MR.springTrap(m, trap, m.pieceAt(sq), from); break; }
        }
      }

      // Coroa da Aura Glacial
      const at = m.sqOf(piece);
      if (at >= 0 && C().has(piece, 'eq_aura_glacial') && !m.over) {
        const victim = MR.auraTarget(m, piece, at);
        if (victim) { await m.bus.emitAsync('aura:pulse', { sq: at, team }); await m.freeze(victim, 1, 'eq_aura_glacial'); }
      }
      return MR.finish(m, team);
    },

    /** Devolve true se o lance acabou ali (anulado/escudo), um lance novo (esquiva) ou false (captura segue). */
    async declareCapture(m, mv) {
      const team = mv.piece.color, enemy = m.other(team), piece = mv.piece, target = mv.captured;
      const targetSq = m.sqOf(target);
      const ev = { type: 'CAPTURE', team: enemy, attacker: piece, target, from: mv.from, to: mv.to, targetSq, move: mv, negated: false, dodged: false };
      await m.bus.emitAsync('capture:declare', ev);
      await Chain().eventWindow(m, 'CAPTURE', enemy, ev);
      if (m.over) return true;
      const spentLance = () => { if (mv.flag === 'r') piece.lanceUsed = true; };
      if (m.sqOf(piece) < 0) { spentLance(); return true; }
      if (ev.negated) {
        spentLance();
        m.say('O ataque foi travado e o atacante voltou para trás.', team);
        await m.bus.emitAsync('capture:snapback', { piece, from: mv.from, to: ev.to, targetSq: m.sqOf(target) });
        return true;
      }
      if (ev.dodged) {
        if (mv.flag === 'r') { spentLance(); await m.bus.emitAsync('capture:miss', { piece, from: mv.from, to: mv.to }); return true; }
        if (m.pieceAt(mv.to)) { await m.bus.emitAsync('capture:snapback', { piece, from: mv.from, to: mv.to }); return true; }
        return { ...mv, captured: null, flag: mv.flag === 'jc' ? 'j' : 'n' };
      }
      if (target.shield) {
        target.shield = false;
        spentLance();
        m.say(`O Escudo ${YC.PIECE_FEM[target.type] ? 'da' : 'do'} ${YC.PIECE_NAME[target.type]} estilhaçou!`, enemy);
        await m.bus.emitAsync('shield:shatter', { piece: target, sq: targetSq, attackerSq: mv.from, cause: 'hit' });
        await m.bus.emitAsync('capture:snapback', { piece, from: mv.from, to: mv.to, targetSq });
        return true;
      }
      return false;
    },

    async onCapture(m, attacker, target, sq) {
      const team = attacker.color;
      m.players[team].stats.captures++;
      await m.bus.emitAsync('piece:captured', { piece: target, sq, by: attacker });
      const thorns = C().has(target, 'eq_armadura_espinhos');
      await m.afterDeath(target, sq, 'capture');
      if (C().has(attacker, 'eq_espada_ganancia') && m.sqOf(attacker) >= 0) {
        m.say('Espada da Ganância: +1 carta!', team);
        await m.bus.emitAsync('equip:proc', { piece: attacker, sq: m.sqOf(attacker), id: 'eq_espada_ganancia' });
        await m.draw(team, 1, 'card');
      }
      if (thorns && attacker.type !== 'k' && m.sqOf(attacker) >= 0) {
        m.say('Armadura de Cacto: o atacante explodiu com ela!', target.color);
        await m.bus.emitAsync('equip:proc', { piece: attacker, sq: m.sqOf(attacker), id: 'eq_armadura_espinhos' });
        await m.removeOrFreeze(attacker, 'eq_armadura_espinhos');
      }
    },

    async springTrap(m, trap, piece, from) {
      m.traps.splice(m.traps.indexOf(trap), 1);
      const ev = { type: 'STEP', piece, sq: trap.sq, from, team: piece.color };
      await m.bus.emitAsync('trap:trigger', { trap, sq: trap.sq, piece });
      const link = Chain().link(m, trap.owner, { uid: trap.uid, id: trap.id, owner: trap.owner }, { sq: trap.sq }, 'board', ev);
      link.trap = trap;
      await Chain().run(m, link);
    },

    auraTarget(m, piece, at) {
      const [r, c] = C().rc(at);
      let best = null, bestV = -1;
      for (const [dr, dc] of C().ORTHO) {
        const q = m.pieceAt(C().at(r + dr, c + dc));
        if (!q || q.color === piece.color || q.type === 'k') continue;
        const v = YC.CardEffects.VAL[m.realType(q)];
        if (v > bestV) { best = q; bestV = v; }
      }
      return best;
    },

    async finish(m, team) {
      const enemy = m.other(team);
      await Chain().flushPending(m);
      if (!m.over && C().inCheck(m.pos, enemy)) {
        const kingSq = C().kingSquare(m.pos, enemy);
        const checkers = C().attackersOf(m.pos, kingSq, team, true).map((sq) => m.pieceAt(sq));
        m.say('Xeque!', team);
        await m.bus.emitAsync('check', { team: enemy, kingSq, checkers });
        await Chain().eventWindow(m, 'CHECK', enemy, { type: 'CHECK', team: enemy, kingSq, checkers });
        await Chain().flushPending(m);
      }
      m.endMove();
    }
  };

  YC.MoveResolver = MR;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
