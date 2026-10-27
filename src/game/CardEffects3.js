/* CardEffects3.js — Armadilhas de Casa e Equipamentos da expansão (CardsNew.js).
   Equipamentos: ao equipar (onEquip), no início do turno do dono (turnStart), depois de a peça se mexer
   (afterMove), ao capturar (onCapture) e quando o Escudo estilhaça (shieldBreak). As regras de movimento
   (Patins, Exoesqueleto, Sapatos, Braço, Sirene, Colete, Broca, Escudo de Choque) estão no ChessRules. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const has = (p, id) => C().has(p, id);
  const sqName = (sq) => C().sqName(sq);
  const sgn = Math.sign;

  /** Peças inimigas de `team` à volta de `sq` (8 casas; ortho = só as 4 ortogonais), sem o Rei. */
  function around(m, sq, team, ortho) {
    const out = [], [r, c] = C().rc(sq);
    for (const [dr, dc] of ortho ? C().ORTHO : C().KING) {
      const q = m.pieceAt(C().at(r + dr, c + dc));
      if (q && q.color !== team && q.type !== 'k') out.push(q);
    }
    return out;
  }
  const best = (list) => list.slice().sort((a, b) => VAL[b.type] - VAL[a.type])[0] || null;

  const E3 = {
    around,

    // ───────────── Armadilhas de Casa ─────────────
    async resolveGrid(m, l) {
      const ev = l.event, piece = ev.piece, id = l.def.id, owner = l.team;
      const sq = m.sqOf(piece);
      if (sq < 0) return;
      const [r, c] = C().rc(sq), [fr, fc] = C().rc(ev.from);
      const dir = [sgn(r - fr), sgn(c - fc)];
      const adjFreeze = async (n) => { for (const q of around(m, m.sqOf(piece) >= 0 ? m.sqOf(piece) : sq, owner)) await m.freeze(q, n, id); };
      switch (id) {
        case 'gt_poca_escorregadia': await m.pushDir(piece, dir[0], dir[1], 1, 'slide'); return m.freeze(piece, 1, id);
        case 'gt_iceberg_surpresa': await m.shatter(piece, id); await m.freeze(piece, 2, id); return m.setStatus(piece, 'silenced', 2, id);
        case 'gt_avalancha_neve': await m.freeze(piece, 2, id); return adjFreeze(1);
        case 'gt_esteira_rolante': return m.pushDir(piece, dir[0], dir[1], 2, 'slide');
        case 'gt_prensa_hidraulica': await m.stripEquips(piece); await m.shatter(piece, id); return m.freeze(piece, 1, id);
        case 'gt_triturador_sucata':
          if (piece.type === 'p') return m.removeOrFreeze(piece, id);
          await m.stripEquips(piece, 1);
          return m.draw(owner, 2, 'card');
        case 'gt_torta_creme': return m.setStatus(piece, 'noCap', 2, id);
        case 'gt_alcapao_palco': {
          const home = piece.home;
          const to = home != null && home !== sq && m.freeFor(piece, home) && m.canRelocate(piece, home) ? home : ev.from;
          return m.relocate(piece, to, 'eject');
        }
        case 'gt_argola_fogo': await m.shatter(piece, id); await m.pushDir(piece, -dir[0], -dir[1], 2, 'push'); return m.freeze(piece, 1, id);
        case 'gt_gas_sonifero': await m.freeze(piece, 1, id); return adjFreeze(1);
        case 'gt_armadilha_clones': {
          if (piece.type !== 'p') await m.morphTo(piece, 'p', 2, id);
          const enemy = piece.color, cands = [];
          for (const [dr, dc] of C().KING) {
            const s = C().at(r + dr, c + dc);
            if (s >= 0 && !m.pos.board[s] && !C().isBlocked(m.pos, s) && s >> 3 !== 0 && s >> 3 !== 7) cands.push(s);
          }
          const ok = cands.filter((s) => owner === m.state.active || !C().exposesKing(m.pos, m.state.active, (b) => { b[s] = { color: owner, type: 'p', equips: [] }; }));
          const safe = ok.find((s) => !C().isAttacked(m.pos, s, enemy));
          const at = safe != null ? safe : ok[0];
          if (at != null && await m.spawnPawn(owner, at, id)) m.say(`Câmara de Clonagem: Peão novo em ${sqName(at)}.`, owner, { card: id, sq: at });
          return;
        }
        case 'gt_lodo_radioativo': await m.stripEquips(piece); await m.shatter(piece, id); return piece.type === 'p' ? null : m.morphTo(piece, 'p', 2, id);
        case 'gt_zona_multa': return m.discardRandom(piece.color, 1, id);
        case 'gt_cela_detencao': await m.freeze(piece, 2, id); return m.setStatus(piece, 'untargetable', 2, id);
        case 'gt_barril_polvora': return piece.type === 'p' ? m.removeOrFreeze(piece, id) : m.freeze(piece, 1, id);
        case 'gt_mapa_naufragio': return m.draw(owner, 2, 'card');
        case 'gt_tubarao_mar': return piece.type === 'q' ? m.freeze(piece, 2, id) : m.removeOrFreeze(piece, id);
        case 'gt_barricada_picos': await m.shatter(piece, id); return m.freeze(piece, 1, id);
        case 'gt_cone_sinalizacao': {
          // desvia para o lado (perpendicular à direção em que vinha), de preferência para o centro
          const side = Math.abs(dir[0]) >= Math.abs(dir[1]) ? [[0, c < 4 ? 1 : -1], [0, c < 4 ? -1 : 1]] : [[r < 4 ? 1 : -1, 0], [r < 4 ? -1 : 1, 0]];
          for (const [dr, dc] of side) if (await E3.tryPush(m, piece, dr, dc)) break;
          if (!m.pos.board[sq]) await m.blockSquare(sq, 2, piece.color, id);
          return;
        }
        case 'gt_rede_captura': await m.freeze(piece, 2, id); await m.stripEquips(piece); return m.shatter(piece, id);
      }
    },

    /** Empurra 1 casa só se der (sem o "bump" de falhar), para escolher entre lados. */
    async tryPush(m, piece, dr, dc) {
      const [r, c] = C().rc(m.sqOf(piece)), to = C().at(r + dr, c + dc);
      if (!m.freeFor(piece, to) || !m.canRelocate(piece, to)) return false;
      return m.relocate(piece, to, 'push');
    },

    // ───────────── Equipamentos ─────────────
    canEquip(def, piece, sq) {
      if (piece.untargetable) return false;
      if (def.minRank && YC.CardEffects2.relRank(piece, sq) < def.minRank) return false;
      return true;
    },

    async onEquip(m, piece, def) {
      if (def.id === 'eq_elixir_mutacao_total' && piece.type === 'p') {
        piece.type = 'q'; piece.morphUntil = 0; piece.morphFrom = null;
        m.say('Soro da Mutação Alfa: o Peão é agora uma Dama!', piece.color, { card: def.id, sq: m.sqOf(piece), pieceId: piece.id });
        await m.bus.emitAsync('piece:promote', { piece, sq: m.sqOf(piece), cause: def.id });
      }
    },

    /** Início do turno de `team`: Soprador de Nevasca e Papagaio (de a1 para h8). */
    async turnStart(m, team) {
      for (const sq of YC.CardEffects2.pieces(m, (p) => p.color === team && p.equips.length > 0).sort((a, b) => b - a)) {
        const p = m.pieceAt(sq);
        if (!p || m.over) continue;
        if (has(p, 'eq_soprador_nevada')) {
          const v = best(around(m, sq, team));
          if (v) { m.say('Soprador de Nevasca!', team, { card: 'eq_soprador_nevada', sq }); await m.freeze(v, 1, 'eq_soprador_nevada'); }
        }
        if (has(p, 'eq_papagaio_vigia')) {
          const top = m.players[team].deck[0];
          if (top && YC.Cards.get(top.id).kind === 'EQUIP') { m.say('O Papagaio encontrou um Equipamento no topo do baralho!', team, { card: 'eq_papagaio_vigia', sq }); await m.draw(team, 1, 'card'); }
        }
      }
    },

    /** Depois de a peça equipada se mexer (já na casa nova). */
    async afterMove(m, piece) {
      const team = piece.color;
      let sq = m.sqOf(piece);
      if (sq < 0 || !piece.equips.length || m.over) return;
      const proc = (id) => m.bus.emitAsync('equip:proc', { piece, sq: m.sqOf(piece), id });
      if (has(piece, 'eq_trono_glaciar')) {
        const list = around(m, sq, team);
        if (list.length) { await proc('eq_trono_glaciar'); for (const q of list) await m.freeze(q, 1, 'eq_trono_glaciar'); }
      }
      if (has(piece, 'eq_chave_inglesa_turbo')) {
        const v = best(around(m, sq, team, true).filter((q) => q.equips.length));
        if (v) { await proc('eq_chave_inglesa_turbo'); await m.stripEquips(v, 1); }
      }
      if (has(piece, 'eq_distintivo_fiscal')) {
        const [r, c] = C().rc(sq);
        const list = m.pos.board.filter((q) => { if (!q || q.color === team || !q.equips.length || q.silenced) return false; const [qr, qc] = C().rc(m.sqOf(q)); return Math.max(Math.abs(qr - r), Math.abs(qc - c)) <= 2; });
        if (list.length) { await proc('eq_distintivo_fiscal'); for (const q of list) await m.setStatus(q, 'silenced', 1, 'eq_distintivo_fiscal'); }
      }
      if (has(piece, 'eq_saco_pilhagem') && !piece.sackUsed && YC.CardEffects2.relRank(piece, sq) >= 5) {
        piece.sackUsed = true;
        await proc('eq_saco_pilhagem');
        m.say('Saco de Dobrões: +2 cartas!', team, { card: 'eq_saco_pilhagem', sq });
        await m.draw(team, 2, 'card');
        await m.giveShield(piece, 'eq_saco_pilhagem');
      }
      if (has(piece, 'eq_megafone_ordem')) {
        const list = around(m, sq, team);
        if (list.length) { await proc('eq_megafone_ordem'); for (const q of list) await m.pushAway(q, m.sqOf(piece), 1, 'push'); }
      }
      if (has(piece, 'eq_canhao_homem_bala') && !piece.cannonUsed) await E3.cannon(m, piece);
    },

    /** Canhão de Circo: lança o Peão ao lado que for mais longe (até 3 casas em frente; promove na última fila). */
    async cannon(m, piece) {
      const sq = m.sqOf(piece), [r, c] = C().rc(sq), d = piece.color === 'w' ? -1 : 1, last = piece.color === 'w' ? 0 : 7;
      let pick = null;
      for (const [dr, dc] of C().KING) {
        const ps = C().at(r + dr, c + dc), p = m.pieceAt(ps);
        if (!p || p.color !== piece.color || p.type !== 'p') continue;
        const [pr, pc] = C().rc(ps);
        let to = -1;
        for (let k = 1; k <= 3; k++) {
          const t = C().at(pr + d * k, pc);
          if (t < 0 || m.pos.board[t] || C().isBlocked(m.pos, t)) break;
          if (m.canRelocate(p, t)) to = t;
        }
        if (to >= 0 && (!pick || Math.abs((to >> 3) - pr) > pick.dist)) pick = { p, to, dist: Math.abs((to >> 3) - pr) };
      }
      if (!pick) return;
      piece.cannonUsed = true;
      m.say(`Canhão de Circo! O Peão voou para ${sqName(pick.to)}.`, piece.color, { card: 'eq_canhao_homem_bala', sq: pick.to });
      await m.relocate(pick.p, pick.to, 'fly');
      if (pick.to >> 3 === last) await m.promoteNow(pick.p, 'eq_canhao_homem_bala');
    },

    /** Depois de uma captura (a peça capturada já morreu). `from` = casa de onde o atacante saiu;
        `dead` = Equipamentos que a peça capturada tinha. */
    async onCapture(m, attacker, target, capSq, from, dead = []) {
      const team = attacker.color, enemy = m.other(team);
      const alive = () => m.sqOf(attacker) >= 0;
      const proc = (id) => m.bus.emitAsync('equip:proc', { piece: attacker, sq: m.sqOf(attacker), id });
      if (dead.includes('eq_tubo_ensaio_toxico') && attacker.type !== 'k' && alive()) {
        m.say('Frasco de Ácido: o atacante foi destruído!', target.color, { card: 'eq_tubo_ensaio_toxico' });
        await m.bus.emitAsync('equip:proc', { piece: attacker, sq: m.sqOf(attacker), id: 'eq_tubo_ensaio_toxico' });
        await m.removeOrFreeze(attacker, 'eq_tubo_ensaio_toxico');
      }
      if (!alive()) return;
      if (has(attacker, 'eq_bussola_tesouro') && m.players[enemy].deck.length) { await proc('eq_bussola_tesouro'); await m.stealTop(enemy, team); }
      if (has(attacker, 'eq_gancho_pirata') && from >= 0 && m.freeFor({ type: 'p' }, from)) {
        const pawn = around(m, m.sqOf(attacker), team).find((q) => q.type === 'p' && m.canRelocate(q, from));
        if (pawn) { await proc('eq_gancho_pirata'); await m.relocate(pawn, from, 'pull'); }
      }
      if (has(attacker, 'eq_monociclo_acrobata')) {
        const at = m.sqOf(attacker);
        if (C().isAttacked(m.pos, at, enemy)) {
          const [r, c] = C().rc(at);
          for (const [dr, dc] of C().KING) {
            const t = C().at(r + dr, c + dc);
            if (!m.freeFor(attacker, t) || !m.canRelocate(attacker, t)) continue;
            const saved = m.pos.board.slice();
            m.pos.board[at] = null; m.pos.board[t] = attacker;
            const safe = !C().isAttacked(m.pos, t, enemy);
            saved.forEach((q, i) => { m.pos.board[i] = q; });
            if (safe) { await proc('eq_monociclo_acrobata'); await m.relocate(attacker, t, 'dodge'); break; }
          }
        }
      }
    },

    /** O Escudo de `target` estilhaçou com o ataque de `attacker` (Cubo de Gelo Protetor). */
    async shieldBreak(m, target, attacker) {
      if (has(target, 'eq_cubo_armadura') && m.sqOf(attacker) >= 0) {
        m.say('Cubo de Gelo: o atacante ficou congelado!', target.color, { card: 'eq_cubo_armadura' });
        await m.freeze(attacker, 1, 'eq_cubo_armadura');
      }
    }
  };

  YC.CardEffects3 = E3;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
