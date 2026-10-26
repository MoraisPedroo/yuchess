/* ChainResolver.js — pilha de resposta (Chain) com Velocidades 1, 2 e 3, resolvida em LIFO.
   Regra de encadeamento: Velocidade(novo) ≥ max(2, Velocidade(topo)); os jogadores alternam; máximo 8 elos.
   Respostas possíveis: cartas viradas na Zona (sem "enjoo": viradas num turno anterior)
   e, no próprio turno, Magias Rápidas da mão. Janelas de evento: CAPTURE, DESTROYED, CHECK. */
(function (YC) {
  'use strict';

  const Cards = () => YC.Cards;
  const E = () => YC.CardEffects;

  const Chain = {
    /** Cria um elo a partir de uma carta já retirada da mão/Zona. */
    link(m, team, inst, target, from, event) {
      const def = Cards().get(inst.id);
      return { team, inst, def, kind: def.kind, ss: def.ss, target: target || null, from, event: event || null, negated: false, keep: false, toDeck: false };
    },

    /** Cartas de `team` que podem responder ao elo do topo. */
    linkOptions(m, team, top) {
      const out = [], p = m.players[team], s = m.state;
      if (top.team === team) return out;
      const consider = (inst, from) => {
        const def = Cards().get(inst.id);
        if (def.ss < Math.max(2, top.ss)) return;
        if (def.kind !== 'COUNTER' && def.kind !== 'QUICK') return;
        if (!E().canRespondToLink(m, team, def, top)) return;
        out.push({ uid: inst.uid, id: inst.id, def, from, needsTarget: !!def.target });
      };
      for (const z of p.zone) if (z.setTurn < s.turnCount) consider(z.inst, 'zone');
      if (s.active === team) for (const c of p.hand) if (Cards().get(c.id).kind === 'QUICK') consider(c, 'hand');
      return out;
    },

    /** Armadilhas Reativas viradas que reagem a um evento (captura, destruição, xeque). */
    eventOptions(m, team, event) {
      const out = [], p = m.players[team];
      for (const z of p.zone) {
        if (z.setTurn >= m.state.turnCount) continue;
        const def = Cards().get(z.inst.id);
        if (def.kind !== 'REACTIVE' || def.trigger !== event.type) continue;
        if (E().canRespondToEvent(m, team, def, event)) out.push({ uid: z.inst.uid, id: z.inst.id, def, from: 'zone', needsTarget: false });
      }
      return out;
    },

    takeCard(m, team, uid) {
      const p = m.players[team];
      const zi = p.zone.findIndex((z) => z.inst.uid === uid);
      if (zi >= 0) return { inst: p.zone.splice(zi, 1)[0].inst, from: 'zone' };
      const hi = p.hand.findIndex((c) => c.uid === uid);
      return hi >= 0 ? { inst: p.hand.splice(hi, 1)[0], from: 'hand' } : null;
    },

    /** Pergunta ao agente (humano, IA ou rede) e valida a resposta de forma determinística. */
    async ask(m, team, ctx) {
      if (m.over) return null;
      const agent = m.agents[team];
      let resp = null;
      try { resp = agent && agent.respondChain ? await agent.respondChain({ ...ctx, team, match: m }) : null; }
      catch (err) { console.error('[chain] resposta', err); resp = null; }
      if (m.over || !resp) return null;
      if (typeof resp === 'string') resp = { uid: resp };
      const opt = ctx.options.find((o) => o.uid === resp.uid);
      if (!opt) return null;
      if (opt.needsTarget && !E().validTarget(m, team, opt.def, resp.target)) return null;
      return { uid: resp.uid, target: resp.target || null };
    },

    async run(m, first) {
      const chain = [first];
      m.chain = chain;
      first.index = 1;
      await m.bus.emitAsync('chain:link', { link: first, chain });
      let responder = m.other(first.team);
      while (chain.length < Cards().RULES.CHAIN_MAX && !m.over) {
        const top = chain[chain.length - 1];
        const options = Chain.linkOptions(m, responder, top);
        if (!options.length) break;
        const resp = await Chain.ask(m, responder, { window: 'LINK', top, chain, options });
        if (!resp) break;
        const card = Chain.takeCard(m, responder, resp.uid);
        const next = Chain.link(m, responder, card.inst, resp.target, card.from, top.event);
        next.targetLink = top;
        next.index = chain.length + 1;
        chain.push(next);
        await m.bus.emitAsync('chain:link', { link: next, chain });
        responder = m.other(responder);
      }
      for (let i = chain.length - 1; i >= 0 && !m.over; i--) {
        const l = chain[i];
        if (l.negated) {
          await m.bus.emitAsync('chain:fizzle', { link: l, chain });
        } else {
          await m.bus.emitAsync('chain:resolve', { link: l, chain });
          await E().resolve(m, l, chain);
        }
        Chain.discard(m, l);
      }
      m.chain = null;
      await m.bus.emitAsync('chain:end', { chain });
    },

    discard(m, l) {
      if (l.keep) return;
      const owner = m.players[l.team];
      if (l.toDeck) { owner.deck.unshift(l.inst); return; }
      owner.gy.push(l.inst.id);
    },

    async eventWindow(m, type, team, event) {
      if (m.over) return false;
      const options = Chain.eventOptions(m, team, event);
      if (!options.length) return false;
      const resp = await Chain.ask(m, team, { window: type, event, options, chain: [] });
      if (!resp) return false;
      const card = Chain.takeCard(m, team, resp.uid);
      await Chain.run(m, Chain.link(m, team, card.inst, null, card.from, event));
      return true;
    },

    /** Janelas de "peça destruída" acumuladas durante uma resolução. */
    async flushPending(m) {
      while (m.pending.length && !m.over) {
        const w = m.pending.shift();
        await Chain.eventWindow(m, w.type, w.team, w);
      }
    }
  };

  YC.ChainResolver = Chain;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
