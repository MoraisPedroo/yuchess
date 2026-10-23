/* DuelChain.js — pilha LIFO do Speed Duel com Spell Speeds 1/2/3.
   Elos: SUMMON, ACTIVATE (feitiço/armadilha/counter), EFFECT (peça), ATTACK e EVENT (peça destruída).
   Só se responde ao elo do adversário; SS3 só aceita SS3; máximo de 8 elos. */
(function (YC) {
  'use strict';

  const MAX_CHAIN = 8;
  let seq = 0;
  const def = (inst) => YC.DuelCards.BY_ID[inst.id];

  class DuelChain {
    constructor(game) {
      this.game = game;
      this.status = 'Idle';
      this.stack = [];
    }

    static link(kind, owner, extra) {
      return { id: `dl_${++seq}`, kind, owner, ss: 1, negated: false, index: 0, ...extra };
    }

    top() { return this.stack[this.stack.length - 1] || null; }

    push(link) {
      if (this.status === 'ChainResolving') throw new Error('ChainResolving Lock');
      if (this.stack.length >= MAX_CHAIN) throw new Error('Chain cheia (8 elos).');
      link.index = this.stack.length + 1;
      this.stack.push(link);
      this.game.bus.emit('CHAIN_UPDATED', { stack: this.stack, status: this.status });
    }

    /** Opções de resposta de `team` ao elo do topo. */
    legalResponses(team) {
      const g = this.game, s = g.state, top = this.top();
      if (!top || top.owner === team || this.stack.length >= MAX_CHAIN) return [];
      const p = s.players[team];
      const trapsLocked = p.trapLockTurn === s.turnCount;
      const out = [];
      const consider = (inst, from) => {
        const c = def(inst);
        if (c.ss < 2 || c.ss < top.ss) return;
        if (trapsLocked && (c.category === 'TRAP' || c.category === 'COUNTER_TRAP')) return;
        if (!YC.DuelEffects.responds(g, team, inst, top) || !YC.DuelEffects.costPayable(g, team, inst)) return;
        out.push({ id: inst.uid, inst, card: c, from, label: c.name });
      };
      for (const b of p.backrow) if (b && b.setTurn < s.turnCount) consider(b, 'BACKROW');
      if (s.active === team) for (const h of p.hand) if (def(h).category === 'QUICK_SPELL') consider(h, 'HAND');
      for (const m of p.monsters) {
        if (m && def(m).effect === 'QUICK' && m.effectTurn !== s.turnCount && !YC.DuelState.isStunned(g, m) && top.ss <= 2) {
          out.push({ id: m.uid, inst: m, card: def(m), from: 'FIELD', label: `${def(m).name} (efeito)` });
        }
      }
      return out;
    }

    async run(first) {
      const g = this.game;
      if (this.status !== 'Idle') throw new Error('Já existe uma Chain ativa.');
      this.stack = [];
      this.status = 'ChainBuilding';
      this.push(first);
      await g.bus.emitAsync('CHAIN_LINK_ADDED', { link: first, stack: this.stack });
      let priority = YC.other(first.owner), passes = 0;
      while (passes < 2 && this.stack.length < MAX_CHAIN && !g.state.winner) {
        this.status = 'WaitingForResponse';
        g.bus.emit('PRIORITY_CHANGED', { team: priority, stack: this.stack });
        const options = this.legalResponses(priority);
        let chosen = null;
        if (options.length) {
          const uid = await g.agents[priority].respondChain({ game: g, team: priority, options, stack: this.stack, top: this.top() });
          chosen = options.find((o) => o.id === uid) || null;
        }
        if (!chosen) { passes++; priority = YC.other(priority); continue; }
        const link = await g.activateResponse(priority, chosen);
        this.status = 'ChainBuilding';
        this.push(link);
        await g.bus.emitAsync('CHAIN_LINK_ADDED', { link, stack: this.stack });
        passes = 0;
        priority = YC.other(priority);
      }
      this.status = 'ChainResolving';
      await g.bus.emitAsync('CHAIN_RESOLVING', { stack: this.stack });
      for (let i = this.stack.length - 1; i >= 0; i--) {
        const link = this.stack[i];
        await g.bus.emitAsync('CHAIN_LINK_RESOLVING', { link, index: i, stack: this.stack });
        await g.resolveLink(link, this.stack, i);
        if (g.state.winner) break;
      }
      // Se o duelo acabou a meio, as cartas que ficaram na pilha vão para o Cemitério.
      for (const l of this.stack) {
        if ((l.kind === 'ACTIVATE' || l.kind === 'SUMMON') && !YC.DuelState.locate(g, l.inst.uid)) {
          g.player(l.inst.owner).gy.push(YC.DuelState.resetInst(l.inst));
        }
      }
      const resolved = this.stack;
      this.stack = [];
      this.status = 'Idle';
      g.bus.emit('CHAIN_UPDATED', { stack: this.stack, status: this.status });
      await g.bus.emitAsync('CHAIN_CLEARED', { resolved });
      return resolved;
    }
  }

  DuelChain.MAX_CHAIN = MAX_CHAIN;
  YC.DuelChain = DuelChain;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
