/* BotCards.js — o bot com as cartas da expansão (acrescenta métodos ao Bot do BotAI):
   pontuação dos Equipamentos novos, Magias Rápidas com alvo (via CardEffects2.targetSpec) e respostas
   das Reativas e Counter-Traps novas. Usa Math.random/this.rand: o bot não faz parte do estado da partida. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const E2 = () => YC.CardEffects2;
  const PV = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const OLD = new Set(['rt_escudo_divino', 'rt_espelho_magico', 'rt_fumaca_ninja', 'rt_troca_dubles', 'rt_alarme_real', 'rt_vampiro_energia', 'rt_cupula_dupla']);
  const SHIELDED = ['eq_cubo_armadura', 'eq_chassi_reforcado', 'eq_colete_balas', 'eq_sirene_perseguicao', 'eq_escudo_choque'];
  const MOBILITY = ['eq_patins_gelo', 'eq_braco_mutante', 'eq_sirene_perseguicao', 'eq_sapato_palhaco'];

  Object.assign(YC.BotAI.Bot.prototype, {
    mobility(m, def, piece, sq) {
      const before = C().legalMovesFrom(m.pos, sq).length;
      piece.equips.push(def.id);
      const after = C().legalMovesFrom(m.pos, sq).length;
      piece.equips.pop();
      return after - before;
    },

    equipScore2(m, def, piece, sq, base, attacked) {
      const enemy = C().other(piece.color), near = YC.CardEffects3.around(m, sq, piece.color);
      const adv = E2().relRank(piece, sq);
      let s = base;
      if (SHIELDED.includes(def.id)) s += piece.shield ? -8 : attacked ? 20 : 8;
      if (MOBILITY.includes(def.id)) s += this.mobility(m, def, piece, sq) * 5;
      switch (def.id) {
        case 'eq_exoesqueleto_tita': return 46 + adv * 4;
        case 'eq_elixir_mutacao_total': return 80;
        case 'eq_escudo_choque': return s + 14;
        case 'eq_balanca_justica': return attacked ? 20 : 44;
        case 'eq_trono_glaciar': return s + 10 + near.length * 8;
        case 'eq_soprador_nevada': return s + 6 + near.length * 6;
        case 'eq_chave_inglesa_turbo': return 14 + near.filter((q) => q.equips.length).length * 12;
        case 'eq_distintivo_fiscal': return 18;
        case 'eq_papagaio_vigia': return attacked ? 10 : 24;
        case 'eq_saco_pilhagem': return 18 + adv * 4;
        case 'eq_bussola_tesouro': return s + 12;
        case 'eq_megafone_ordem': return s + near.length * 6;
        case 'eq_canhao_homem_bala': return s + 10;
        case 'eq_tubo_ensaio_toxico': return 16 + (attacked ? 18 : 0);
        case 'eq_broca_perfuradora': return s + 6 + (m.pos.board.some((q) => q && q.color === enemy && q.shield) ? 16 : 0);
        default: return s;
      }
    },

    /** Alvo e pontuação de uma Magia Rápida nova (null = não vale a pena). */
    quickChoice(m, def) {
      const team = this.team, enemy = C().other(team), spec = E2().targetSpec(m, team, def);
      const val = (sq) => PV[m.pieceAt(sq).type] || 0;
      const attacked = (sq) => C().isAttacked(m.pos, sq, m.pieceAt(sq).color === team ? enemy : team);
      const top = (list, f) => list.map((sq) => ({ sq, s: f(sq) })).sort((a, b) => b.s - a.s)[0];
      const one = (f, min = 18) => { if (!spec || !spec.first.length) return null; const b = top(spec.first, f); return b && b.s >= min ? { score: b.s, target: { sq: b.sq } } : null; };
      const two = (pickFrom, pickTo, min = 18) => {
        if (!spec || !spec.first.length) return null;
        const f = top(spec.first, pickFrom);
        if (!f || f.s < min) return null;
        const t = top(spec.second(f.sq), (to) => pickTo(f.sq, to));
        return t ? { score: f.s, target: { from: f.sq, to: t.sq } } : null;
      };
      const threat = (sq) => C().legalMovesFrom(m.pos, sq, {}).some((mv) => mv.captured && PV[mv.captured.type] >= 300);
      switch (def.id) {
        case 'qs_sopro_invernal': case 'qs_arremesso_ancora': return one((sq) => 14 + val(sq) / 25 + (threat(sq) ? 14 : 0));
        case 'qs_raio_desestabilizador': return one((sq) => (threat(sq) ? 26 + val(sq) / 40 : 8));
        case 'qs_congelador_relampago': return one((sq) => 12 + E2().lineHits(m, sq, team).reduce((a, q) => a + PV[q.type] / 40, 0));
        case 'qs_ajuste_calibragem': return one(() => 12 + this.rand() * 10);
        case 'qs_sobrecarga_reator': { const n = m.pos.board.filter((q) => q && q.color === team && (q.type === 'r' || q.type === 'q') && !q.shield).length; return one(() => 14 + n * 8); }
        case 'qs_recauchutagem_express': return { score: 30, target: null };
        case 'qs_inspecao_tributaria': return { score: 34, target: null };
        case 'qs_saque_rapido': return { score: m.players[team].hand.length <= 3 ? 26 : 12, target: null };
        case 'qs_intimacao_urgente': {
          const k = C().kingSquare(m.pos, enemy), [kr, kc] = C().rc(k);
          return one((sq) => { const [r, c] = C().rc(sq); return Math.max(Math.abs(r - kr), Math.abs(c - kc)) === 1 ? 22 : 8 + this.rand() * 8; });
        }
        case 'qs_transmutacao_peao': return one((sq) => 12 + this.rand() * 10);
        case 'qs_soro_crescimento': return one(() => 70);
        case 'qs_escolta_armada': return one((sq) => 12 + E2().relRank(m.pieceAt(sq), sq) * 2 + (attacked(sq) ? 10 : 0));
        case 'qs_bloqueio_tatico': return one((sq) => (attacked(sq) ? 18 + val(sq) / 40 : 8));
        case 'qs_cambalhota_maluca': return two(() => 10 + this.rand() * 12, () => this.rand());
        case 'qs_cabo_aco_voador': return two((sq) => (attacked(sq) ? 18 + val(sq) / 40 : 6 + this.rand() * 8), (f, to) => (C().isAttacked(m.pos, to, enemy) ? 0 : 1) + this.rand());
        case 'qs_helicoptero_apoio': return two((sq) => (attacked(sq) && val(sq) >= 300 ? 20 + val(sq) / 40 : 6), (f, to) => (C().isAttacked(m.pos, to, enemy) ? 0 : 1) + this.rand());
        default: return null;
      }
    },

    quickPlay2(m, def, uid) {
      if (!YC.CardEffects.canActivate(m, this.team, def)) return null;
      const c = this.quickChoice(m, def);
      if (!c) return null;
      return { score: c.score, act: c.target ? { type: 'ACTIVATE', uid, target: c.target } : { type: 'ACTIVATE', uid } };
    },

    /** Alvo para uma carta com alvo usada como resposta (Íman, EMP e as novas). */
    targetFor(m, def) {
      if (def.target === 'STEAL') { const pr = this.bestSteal(m); return pr ? { from: pr.from, to: pr.to } : null; }
      if (def.id === 'ct_emp_cartoon') { const t = m.traps.find((x) => x.owner !== this.team && x.revealed); return t ? { sq: t.sq } : null; }
      const c = this.quickChoice(m, def);
      return c && c.target ? c.target : null;
    },

    /** Reativas novas: o bot usa-as com gosto (são a graça das cartas). */
    pickNew(ctx) {
      const m = ctx.match, opts = ctx.options.filter((o) => !OLD.has(o.id));
      if (!opts.length) return null;
      if (ctx.window === 'CAPTURE') {
        const v = PV[m.realType(ctx.event.target)] || 0;
        return v >= 300 || this.rand() < 0.45 ? opts[0] : null;
      }
      return this.rand() < 0.85 ? opts[0] : null;
    },

    /** Counter-Traps novas: anulam cartas de Rara para cima, Armadilhas de Casa em peças valiosas, ou às vezes ao acaso. */
    counterNew(ctx) {
      const m = ctx.match, top = ctx.top;
      const opts = ctx.options.filter((o) => o.def.kind === 'COUNTER' && !['ct_tesoura_corta_fio', 'ct_reverso_tempo', 'ct_julgamento_cartoon', 'ct_confisco_real', 'ct_apito_juiz'].includes(o.id));
      if (!opts.length || top.team === this.team) return null;
      const piece = top.event && (top.event.piece || top.event.target);
      const big = piece && piece.color === this.team && PV[m.realType(piece)] >= 300;
      const rare = YC.Cards.RARITY[top.def.rarity].order >= 1;
      return big || rare || this.rand() < 0.35 ? opts[0] : null;
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
