/* UnoEconomy.js — baralho partilhado, mãos, pilha central P_central e o predicado de
   correspondência M(Ci, Ctopo) que desbloqueia a fase de movimento no tabuleiro. */
(function (YC) {
  'use strict';

  const START_HAND = 5;
  const HAND_MAX = 8;
  const TIER_LOW = ['PAWN', 'KNIGHT', 'BISHOP'];
  const TIER_MID = ['PAWN', 'KNIGHT', 'BISHOP', 'ROOK'];

  function emptyBoost() {
    return { atk: 0, tempShield: 0, shield: 0, heal: 0, overdrive: false, pierce: false, step: false };
  }

  class UnoEconomy {
    constructor(bus, rng) {
      this.bus = bus;
      this.rng = rng;
      this.deck = [];
      this.discard = [];
      this.graveyard = [];
      this.hands = { WHITE: [], BLACK: [] };
      this.activeColor = null;
    }

    reset() {
      this.deck = this.rng.shuffle(YC.CardDatabase.buildDeck());
      this.discard = [];
      this.graveyard = [];
      this.hands = { WHITE: [], BLACK: [] };
      for (let i = 0; i < START_HAND; i++) { this.draw('WHITE', 1, true); this.draw('BLACK', 1, true); }
      // Carta inicial: a primeira carta número básica do baralho.
      const idx = this.deck.findIndex((c) => c.basic && c.uno.symbol === 'NUMBER' && c.uno.value !== '0');
      const starter = this.deck.splice(idx, 1)[0];
      this.discard.push(starter);
      this.activeColor = starter.uno.color;
    }

    get top() { return this.discard[this.discard.length - 1] || null; }
    hand(team) { return this.hands[team]; }
    findInHand(team, uid) { return this.hands[team].find((c) => c.uid === uid) || null; }

    removeFromHand(team, uid) {
      const i = this.hands[team].findIndex((c) => c.uid === uid);
      return i >= 0 ? this.hands[team].splice(i, 1)[0] : null;
    }

    reshuffle() {
      const top = this.discard.pop();
      const pool = [...this.discard, ...this.graveyard];
      pool.forEach((c) => { c.turnSet = null; c.owner = null; c.isActivatedInCurrentChain = false; });
      this.deck = this.rng.shuffle(pool);
      this.discard = top ? [top] : [];
      this.graveyard = [];
      this.bus.emit('DECK_RESHUFFLED', { size: this.deck.length });
    }

    draw(team, n = 1, silent = false) {
      const drawn = [];
      for (let i = 0; i < n; i++) {
        if (this.hands[team].length >= HAND_MAX) break;
        if (!this.deck.length) this.reshuffle();
        if (!this.deck.length) break;
        const card = this.deck.pop();
        card.owner = team;
        this.hands[team].push(card);
        drawn.push(card);
      }
      if (!silent && drawn.length) this.bus.emit('CARDS_DRAWN', { team, cards: drawn });
      return drawn;
    }

    /** M(Ci, Ctopo) ⇔ cor igual ∨ valor igual ∨ Ci curinga ∨ topo curinga sem cor escolhida. */
    matches(card) {
      const top = this.top;
      if (!top) return true;
      if (card.uno.color === 'W') return true;
      if (top.uno.color === 'W' && !this.activeColor) return true;
      return card.uno.color === this.activeColor || card.uno.value === top.uno.value;
    }

    placeOnDiscard(card, chosenColor) {
      card.turnSet = null;
      this.discard.push(card);
      this.activeColor = card.uno.color === 'W' ? (chosenColor || 'R') : card.uno.color;
    }

    toGraveyard(card) {
      if (!card) return;
      card.turnSet = null;
      card.isActivatedInCurrentChain = false;
      this.graveyard.push(card);
    }

    discardRandom(team, n) {
      const lost = [];
      for (let i = 0; i < n && this.hands[team].length; i++) {
        const card = this.hands[team].splice(this.rng.int(this.hands[team].length), 1)[0];
        this.toGraveyard(card);
        lost.push(card);
      }
      return lost;
    }

    /** Converte a carta descartada numa permissão de movimento + bónus (matriz de conversão tática). */
    permissionFor(card) {
      const { color, value } = card.uno;
      const boost = emptyBoost();
      let allowed = 'ALL', zero = false;
      const n = /^[0-9]$/.test(value) ? Number(value) : null;
      if (color === 'W') allowed = 'ALL';
      else if (n === 0) zero = true;
      else if (n >= 1 && n <= 3) { allowed = TIER_LOW; boost.tempShield = 10 * n; }
      else if (n >= 4 && n <= 6) { allowed = TIER_MID; boost.atk = 10 * n; }
      else if (n >= 7) { boost.overdrive = true; boost.pierce = true; }
      else if (value === 'SKIP') allowed = ['PAWN', 'KNIGHT'];
      else if (value === 'REVERSE') allowed = ['BISHOP', 'ROOK'];
      else if (value === 'DRAW2') allowed = ['PAWN'];

      if (color === 'R') boost.atk += 20;
      if (color === 'B') boost.shield += 25;
      if (color === 'G') boost.heal += 30;
      if (color === 'Y') boost.step = true;
      return { source: 'CARD', cardUid: card.uid, color, value, allowed, zero, boost, used: false };
    }

    fallbackPermission(board, team, turn) {
      const perm = { source: 'FALLBACK', color: null, value: null, allowed: ['PAWN'], zero: false, boost: emptyBoost(), used: false };
      const pawnsCanMove = board.pieces(team).some((p) => p.type === 'PAWN' && board.getValidMoves(p, perm, turn).length);
      if (!pawnsCanMove) perm.allowed = ['PAWN', 'KING'];
      return perm;
    }
  }

  UnoEconomy.emptyBoost = emptyBoost;
  UnoEconomy.HAND_MAX = HAND_MAX;
  YC.UnoEconomy = UnoEconomy;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
