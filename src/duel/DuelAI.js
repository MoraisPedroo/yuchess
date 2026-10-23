/* DuelAI.js — o "Rei Dado" no Speed Duel: invoca a melhor peça (tributando as fracas), usa feitiços
   quando mudam uma batalha, vira armadilhas, ataca onde ganha e responde na Chain quando compensa.
   Não espreita a mão nem as cartas viradas do adversário (exceto as reveladas pelo Holofote). */
(function (YC) {
  'use strict';

  const S = () => YC.DuelState;
  const Fx = () => YC.DuelEffects;
  const def = (inst) => YC.DuelCards.BY_ID[inst.id];

  class DuelAI {
    constructor(team, opts = {}) {
      this.team = team;
      this.delay = opts.delay != null ? opts.delay : 650;
      this.rand = opts.rand || Math.random;
    }

    value(g, m) { return S().atk(g, m) + S().dfn(g, m) * 0.3 + def(m).level * 60; }

    async playTurn(g) {
      const team = this.team, turn = g.state.turnCount;
      const mine = () => !g.state.winner && !g.aborted && g.state.turnCount === turn && g.state.active === team;
      await g.wait(this.delay);
      for (let i = 0; i < 14 && mine() && g.state.phase === 'MAIN'; i++) {
        const act = this.mainAction(g);
        if (!act) break;
        await g.wait(this.delay * 0.7);
        if (!mine() || !(await g.dispatch({ ...act, team }))) break;
      }
      if (mine() && g.canEnterBattle(team) && this.attackPlan(g)) {
        await g.dispatch({ type: 'GO_BATTLE', team });
        for (let i = 0; i < 8 && mine() && g.state.phase === 'BATTLE'; i++) {
          const pre = this.battleBoost(g);
          if (pre) { await g.wait(this.delay * 0.5); if (!(await g.dispatch({ ...pre, team }))) break; continue; }
          const atk = this.attackPlan(g);
          if (!atk) break;
          await g.wait(this.delay);
          if (!mine() || !(await g.dispatch({ type: 'ATTACK', team, ...atk }))) break;
        }
      }
      if (mine()) await g.dispatch({ type: 'END_TURN', team });
    }

    // ── Fase principal ──
    mainAction(g) {
      return this.summonAction(g) || this.spellAction(g) || this.effectAction(g) || this.setAction(g) || this.positionAction(g);
    }

    foeMaxAtk(g) {
      return Math.max(0, ...S().monstersOf(g, YC.other(this.team)).filter((m) => m.position === 'ATK').map((m) => S().atk(g, m)));
    }

    summonAction(g) {
      const team = this.team, p = g.player(team);
      let best = null;
      for (const inst of p.hand) {
        if (!g.canNormalSummon(team, inst)) continue;
        const c = def(inst);
        let need = YC.DuelCards.tributesFor(c);
        const own = S().monstersOf(g, team).sort((a, b) => this.value(g, a) - this.value(g, b));
        let tributes = own.slice(0, need);
        if (c.id === 'dama_sereia') {
          const blue = own.find((m) => def(m).color === 'B');
          if (blue) { tributes = [blue]; need = 1; }
        }
        if (tributes.length < need) continue;
        const lost = tributes.reduce((s, m) => s + Math.max(S().atk(g, m), S().dfn(g, m) * 0.7), 0);
        let score = c.atk + c.def * 0.2 + (S().sintonia(g, c) ? 300 : 0) - lost * 0.6;
        if (need === 0) score += 150;
        if (score <= 0 && need > 0) continue;
        if (!best || score > best.score) best = { inst, tributes, score, c };
      }
      if (!best) return null;
      const foeMax = this.foeMaxAtk(g);
      const atkPos = best.c.atk >= foeMax || best.c.atk >= best.c.def || !S().monstersOf(g, YC.other(team)).length;
      const foe = S().monstersOf(g, YC.other(team)).sort((a, b) => S().atk(g, b) - S().atk(g, a));
      return {
        type: 'NORMAL_SUMMON', uid: best.inst.uid, position: atkPos ? 'ATK' : 'DEF',
        tributes: best.tributes.map((t) => t.uid), color: S().favouriteColor(g, team), targetUid: foe[0] ? foe[0].uid : null
      };
    }

    /** Melhor peça aliada capaz de atacar (para buffs). */
    bestAttacker(g) {
      const team = this.team;
      return S().monstersOf(g, team).filter((m) => m.position === 'ATK' && !S().isStunned(g, m)).sort((a, b) => S().atk(g, b) - S().atk(g, a))[0] || null;
    }

    wouldWinWith(g, bonus) {
      const a = this.bestAttacker(g);
      if (!a) return null;
      const av = S().atk(g, a);
      for (const t of S().monstersOf(g, YC.other(this.team))) {
        const tv = t.position === 'ATK' ? S().atk(g, t) : S().dfn(g, t);
        if (av <= tv && av + bonus > tv) return a;
      }
      return null;
    }

    spellAction(g) {
      const team = this.team, p = g.player(team), foe = g.player(YC.other(team));
      const canAttackSoon = g.state.turnCount > 1;
      for (const inst of p.hand.concat(p.backrow.filter(Boolean))) {
        if (!Fx().canActivate(g, team, inst)) continue;
        const c = def(inst);
        const act = (targets = {}, extra = {}) => ({ type: 'ACTIVATE', uid: inst.uid, targets, color: S().favouriteColor(g, team), ...extra });
        switch (c.id) {
          case 'tinta_rubra': { const a = canAttackSoon && this.wouldWinWith(g, 500); if (a) return act({ monsterUid: a.uid }); break; }
          case 'xeque_mate_diabo': { const a = canAttackSoon && this.bestAttacker(g); if (a) return act({ monsterUid: a.uid }); break; }
          case 'apito_guarda': {
            const mine = this.bestAttacker(g), myAtk = mine ? S().atk(g, mine) : 0;
            const t = foe.monsters.filter((m) => m && m.position === 'ATK').sort((a, b) => S().atk(g, b) - S().atk(g, a))[0];
            if (t && S().atk(g, t) >= myAtk) return act({ monsterUid: t.uid });
            break;
          }
          case 'tonel_espinafre': {
            const sick = S().monstersOf(g, team).find((m) => S().hasDebuff(g, m));
            if (p.lp <= 3200 || sick) return act({ monsterUid: sick ? sick.uid : null });
            break;
          }
          case 'troca_chapeu': {
            if (p.deck.length < 2 || p.hand.length < 3) break;
            const junk = p.hand.filter((x) => x.uid !== inst.uid).sort((a, b) => YC.Collection.power(a.id) - YC.Collection.power(b.id))[0];
            if (junk) return act({ discardUid: junk.uid });
            break;
          }
          case 'compra_gananciosa': if (p.deck.length >= 1) return act(); break;
          case 'ressurreicao_celuloide': {
            const t = Fx().candidates(g, team, 'GY_MONSTER').sort((a, b) => def(b).atk - def(a).atk)[0];
            if (t && def(t).atk >= 1400) return act({ gyUid: t.uid });
            break;
          }
          case 'roleta_rei_dado': if (S().backrowOf(g, YC.other(team)).length) return act(); break;
          case 'penalidade_maxima': if (this.foeMaxAtk(g) >= 1800 || S().monstersOf(g, YC.other(team)).some((m) => S().atk(g, m) >= 2000)) return act(); break;
          default: break;
        }
      }
      return null;
    }

    effectAction(g) {
      const team = this.team, p = g.player(team);
      for (const m of p.monsters) {
        if (!m || !Fx().monsterEffectReady(g, team, m)) continue;
        if (m.id === 'torre_locomotiva') {
          const red = Fx().candidates(g, team, 'HAND_RED').sort((a, b) => YC.Collection.power(a.id) - YC.Collection.power(b.id))[0];
          if (red && YC.Collection.power(red.id) < 1200) return { type: 'MONSTER_EFFECT', uid: m.uid, targets: { discardUid: red.uid } };
        }
        if (m.id === 'bispo_arcanjo') {
          const pawn = Fx().candidates(g, team, 'GY_PAWN2')[0];
          if (pawn) return { type: 'MONSTER_EFFECT', uid: m.uid, targets: { choice: 'REVIVE', gyUid: pawn.uid } };
          if (p.lp < 3800) return { type: 'MONSTER_EFFECT', uid: m.uid, targets: { choice: 'HEAL' } };
        }
      }
      return null;
    }

    setAction(g) {
      const team = this.team, p = g.player(team);
      const inst = p.hand.find((c) => g.canSet(team, c));
      return inst ? { type: 'SET_CARD', uid: inst.uid } : null;
    }

    positionAction(g) {
      const team = this.team, foeMax = this.foeMaxAtk(g);
      for (const m of S().monstersOf(g, team)) {
        if (!g.canChangePosition(team, m)) continue;
        const a = S().atk(g, m), d = S().dfn(g, m);
        if (m.position === 'ATK' && foeMax > a && d > a && d >= foeMax * 0.8) return { type: 'CHANGE_POSITION', uid: m.uid };
        if (m.position === 'DEF' && a > foeMax && a >= d) return { type: 'CHANGE_POSITION', uid: m.uid };
      }
      return null;
    }

    // ── Batalha ──
    battleBoost(g) {
      const team = this.team, p = g.player(team);
      for (const m of p.monsters) {
        if (m && m.id === 'rei_dado_supremo' && Fx().monsterEffectReady(g, team, m) && g.attackOptions(team, m).targets.length + (g.attackOptions(team, m).direct ? 1 : 0) > 0) {
          return { type: 'MONSTER_EFFECT', uid: m.uid, targets: {} };
        }
      }
      for (const inst of p.hand.concat(p.backrow.filter(Boolean))) {
        if (inst.id === 'luva_boxe' && Fx().canActivate(g, team, inst)) {
          const a = this.wouldWinWith(g, 700);
          if (a) return { type: 'ACTIVATE', uid: inst.uid, targets: { monsterUid: a.uid } };
        }
      }
      return null;
    }

    attackPlan(g) {
      const team = this.team;
      let best = null;
      for (const m of S().monstersOf(g, team)) {
        const opts = g.attackOptions(team, m, { planning: true });
        const av = S().atk(g, m);
        if (opts.direct) {
          const foeHas = S().monstersOf(g, YC.other(team)).length > 0;
          const score = (foeHas ? av / 2 : av) + 200;
          if (!best || score > best.score) best = { uid: m.uid, targetUid: null, score };
        }
        for (const t of opts.targets) {
          let score;
          if (t.position === 'ATK') {
            const tv = S().atk(g, t);
            if (av > tv) score = this.value(g, t) + (av - tv);
            else if (av === tv && this.value(g, t) > this.value(g, m)) score = this.value(g, t) - this.value(g, m);
            else continue;
          } else {
            const dv = S().dfn(g, t);
            if (av <= dv) continue;
            if (t.id === 'peao_lata' && def(m).level <= 3) continue;
            score = this.value(g, t) * 0.8 + (m.id === 'cavalo_molas' ? av - dv : 0);
          }
          if (!best || score > best.score) best = { uid: m.uid, targetUid: t.uid, score };
        }
      }
      return best ? { uid: best.uid, targetUid: best.targetUid } : null;
    }

    // ── Chain ──
    /** Resultado previsto de um ataque (para decidir respostas). */
    predict(g, top) {
      const A = top.attackerUid && S().locate(g, top.attackerUid);
      if (!A) return { lossValue: 0 };
      const av = S().atk(g, A.inst);
      if (!top.targetUid) return { direct: av, lossValue: av };
      const T = S().locate(g, top.targetUid);
      if (!T) return { lossValue: 0 };
      const t = T.inst, tv = t.position === 'ATK' ? S().atk(g, t) : S().dfn(g, t);
      if (av > tv) return { destroys: true, lossValue: this.value(g, t) + (t.position === 'ATK' ? av - tv : 0) };
      return { lossValue: 0 };
    }

    async respondChain({ game: g, options, top }) {
      let best = null, bestScore = 0;
      const lp = g.player(this.team).lp;
      for (const o of options) {
        const id = o.inst.id;
        let s = 0;
        const threat = top.kind === 'ATTACK' ? this.predict(g, top).lossValue : 0;
        const playRarity = top.inst ? def(top.inst).rarity : 'N';
        const bigPlay = top.inst && (playRarity === 'L' || playRarity === 'UR' || (def(top.inst).atk || 0) >= 2400);
        switch (id) {
          case 'casca_banana': s = threat >= 900 ? threat : 0; break;
          case 'cortina_fumo': {
            const T = top.targetUid && S().locate(g, top.targetUid), A = S().locate(g, top.attackerUid);
            if (T && A && T.inst.position === 'DEF') { const dv = S().dfn(g, T.inst), av = S().atk(g, A.inst); s = av > dv && av <= dv + 600 ? 1000 : 0; }
            break;
          }
          case 'luva_boxe': {
            const T = top.targetUid && S().locate(g, top.targetUid), A = S().locate(g, top.attackerUid);
            if (T && A && T.team === this.team && T.inst.position === 'ATK') { const av = S().atk(g, A.inst), tv = S().atk(g, T.inst); s = av > tv && tv + 700 > av ? 1200 : 0; }
            break;
          }
          case 'bigorna_ceu': case 'espelho_tinta': case 'dinamite_acme': s = 1000; break;
          case 'alcapao_teatro': s = top.inst && def(top.inst).atk >= 1300 ? 900 : 0; break;
          case 'censura_diretor': s = lp > 1500 ? 800 : 0; break;
          case 'julgamento_solene': s = lp >= 2000 && (bigPlay || threat >= 2000) ? 1500 : 0; break;
          case 'parry_absoluto': s = threat >= 1400 || bigPlay ? 2000 : 0; break;
          case 'roleta_rei_dado': s = S().backrowOf(g, YC.other(this.team)).length ? 700 : 0; break;
          case 'penalidade_maxima': s = S().monstersOf(g, YC.other(this.team)).some((m) => S().atk(g, m) >= 2000) ? 1500 : 0; break;
          case 'rei_dado_supremo': s = top.kind === 'ATTACK' && (top.attackerUid === o.inst.uid || top.targetUid === o.inst.uid) ? 900 : 0; break;
          default: s = 0;
        }
        s += this.rand() * 10;
        if (s > bestScore) { best = o; bestScore = s; }
      }
      await g.wait(best ? this.delay * 0.6 : 0);
      return best && bestScore >= 300 ? best.id : null;
    }
  }

  YC.DuelAI = DuelAI;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
