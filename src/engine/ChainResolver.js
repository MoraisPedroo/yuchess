/* ChainResolver.js — pilha LIFO estilo Yu-Gi-Oh! com Spell Speeds 1/2/3.
   Estados: Idle → ChainBuilding → WaitingForResponse → ChainResolving → Idle.
   Invariantes: Set Sickness, custo pago no anúncio, bloqueio durante a resolução, L_max = 8. */
(function (YC) {
  'use strict';

  const MAX_CHAIN = 8;
  let linkSeq = 0;

  class ChainResolver {
    constructor(game) {
      this.game = game;
      this.status = 'Idle';
      this.stack = [];
      this.priority = null;
      this.consecutivePasses = 0;
    }

    static makeLink(kind, owner, extra) {
      return { id: `l_${++linkSeq}`, kind, owner, negated: false, index: 0, ...extra };
    }

    addChainLink(link) {
      if (this.status === 'ChainResolving') throw new Error('ChainResolving Lock: a pilha está a resolver.');
      if (this.stack.length >= MAX_CHAIN) throw new Error('Limite de Chain atingido (8 elos).');
      link.index = this.stack.length + 1;
      this.stack.push(link);
      this.game.bus.emit('CHAIN_UPDATED', { stack: this.stack, status: this.status });
    }

    top() { return this.stack[this.stack.length - 1] || null; }

    /** Condição de ativação de uma carta face ao elo do topo. */
    conditionMet(card, top, team) {
      const g = this.game;
      const defender = top.kind === 'MOVE' && top.move.defenderUid ? g.board.getPiece(top.move.defenderUid) : null;
      switch (card.yugioh.triggerCondition) {
        case 'ON_CHAIN_LINK_ADDED': return true;
        case 'ON_ATTACK_DECLARED': return !!defender && defender.team === team;
        case 'ON_ROYAL_TARGETED': return !!defender && defender.team === team && (defender.type === 'KING' || defender.type === 'QUEEN');
        case 'ON_TRAP_ACTIVATED': return top.kind === 'TRAP';
        case 'ON_OPPONENT_UNO_MATCH': return top.kind === 'UNO_PLAY';
        case 'ON_SPELL_OR_TRAP': return top.kind === 'UNO_PLAY' || top.kind === 'TRAP' || top.kind === 'CARD';
        case 'ON_OPPONENT_RESPONSE': return top.kind === 'CARD' && this.stack.some((l) => l.kind === 'MOVE' && l.owner === team);
        default: return false;
      }
    }

    canPayCost(card, team) {
      const g = this.game;
      if (!card.cost) return true;
      if (card.cost.type === 'KING_HP') { const k = g.board.king(team); return !!k && k.hp > card.cost.amount; }
      if (card.cost.type === 'DISCARD') return g.uno.hand(team).filter((c) => c.uid !== card.uid).length >= card.cost.amount;
      return true;
    }

    async payCost(card, team) {
      const g = this.game;
      if (!card.cost) return true;
      if (!this.canPayCost(card, team)) return false;
      if (card.cost.type === 'KING_HP') {
        await g.damagePiece(g.board.king(team), card.cost.amount, { ignoreShield: true, source: 'Custo', cost: true });
      } else if (card.cost.type === 'DISCARD') {
        for (let i = 0; i < card.cost.amount; i++) {
          const hand = g.uno.hand(team).filter((c) => c.uid !== card.uid);
          const pick = hand.find((c) => c.basic) || hand[0];
          g.uno.removeFromHand(team, pick.uid);
          g.uno.toGraveyard(pick);
          g.log(`Custo: ${g.teamName(team)} descarta ${pick.name}.`);
        }
      }
      return true;
    }

    /** Respostas legais: SS ≥ 2, SS ≥ SS do topo, condição cumprida, custo pagável, Set Sickness. */
    legalResponses(team) {
      const g = this.game, top = this.top();
      if (!top || top.owner === team || this.stack.length >= MAX_CHAIN) return [];
      const turn = g.state.turnCount;
      const out = [];
      const consider = (card, from, slot) => {
        const ss = card.yugioh.spellSpeed;
        if (ss < 2 || ss < top.ss || card.isActivatedInCurrentChain) return;
        if (!this.conditionMet(card, top, team) || !this.canPayCost(card, team)) return;
        out.push({ card, from, slot });
      };
      g.state.players[team].support.forEach((card, slot) => {
        if (card && card.turnSet != null && turn > card.turnSet) consider(card, 'SUPPORT', slot);
      });
      if (g.state.active === team) {
        g.uno.hand(team).forEach((card) => { if (card.yugioh.cardType === 'QUICK_SPELL') consider(card, 'HAND', -1); });
      }
      return out;
    }

    /** Corre uma Chain completa a partir de CL1 e devolve a pilha resolvida. */
    async run(firstLink) {
      const g = this.game;
      if (this.status !== 'Idle') throw new Error('Já existe uma Chain ativa.');
      this.stack = [];
      this.status = 'ChainBuilding';
      this.addChainLink(firstLink);
      await g.bus.emitAsync('CHAIN_LINK_ADDED', { link: firstLink, stack: this.stack });

      let priority = YC.other(firstLink.owner);
      this.consecutivePasses = 0;
      while (this.consecutivePasses < 2 && this.stack.length < MAX_CHAIN && !g.state.winner) {
        this.status = 'WaitingForResponse';
        this.priority = priority;
        g.bus.emit('PRIORITY_CHANGED', { team: priority, stack: this.stack });
        const options = this.legalResponses(priority);
        let chosen = null;
        if (options.length) {
          const uid = await g.agents[priority].respondChain({ game: g, team: priority, options, stack: this.stack, top: this.top() });
          chosen = options.find((o) => o.card.uid === uid) || null;
        }
        if (!chosen || !(await this.payCost(chosen.card, priority))) {
          this.consecutivePasses++;
          priority = YC.other(priority);
          continue;
        }
        const card = chosen.card;
        if (chosen.from === 'SUPPORT') g.state.players[priority].support[chosen.slot] = null;
        else g.uno.removeFromHand(priority, card.uid);
        card.isActivatedInCurrentChain = true;
        if (card.yugioh.cardType === 'COUNTER_TRAP') g.state.stats[priority].counters++;
        const link = ChainResolver.makeLink('CARD', priority, {
          card, ss: card.yugioh.spellSpeed, label: card.name, targets: {}
        });
        this.status = 'ChainBuilding';
        this.addChainLink(link);
        g.log(`🔗 CL${link.index}: ${g.teamName(priority)} ativa "${card.name}" (SS${link.ss}).`);
        await g.bus.emitAsync('CARD_ACTIVATED', { card, team: priority, link });
        await g.bus.emitAsync('CHAIN_LINK_ADDED', { link, stack: this.stack });
        this.consecutivePasses = 0;
        priority = YC.other(priority);
      }

      // ── Resolução inversa LIFO: CLn → CLn-1 → … → CL1 ──
      this.status = 'ChainResolving';
      this.priority = null;
      await g.bus.emitAsync('CHAIN_RESOLVING', { stack: this.stack });
      for (let i = this.stack.length - 1; i >= 0; i--) {
        const link = this.stack[i];
        await g.bus.emitAsync('CHAIN_LINK_RESOLVING', { link, index: i, stack: this.stack });
        if (link.negated) {
          g.log(`✖ CL${link.index} (${link.label}) foi anulado.`);
          continue;
        }
        await g.resolveLink(link, this.stack, i);
        if (g.state.winner) break;
      }
      for (const link of this.stack) {
        if (link.kind === 'CARD') g.uno.toGraveyard(link.card);
        if (link.card) link.card.isActivatedInCurrentChain = false;
      }
      const resolved = this.stack;
      this.stack = [];
      this.status = 'Idle';
      g.bus.emit('CHAIN_UPDATED', { stack: this.stack, status: this.status });
      await g.bus.emitAsync('CHAIN_CLEARED', { resolved });
      return resolved;
    }
  }

  ChainResolver.MAX_CHAIN = MAX_CHAIN;
  YC.ChainResolver = ChainResolver;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
