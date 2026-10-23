/* DuelState.js — estado do Speed Duel e cálculo de ATK/DEF.
   Arena: 4000 LP, 3 Zonas de Peças, 3 Zonas de Suporte (backrow), baralho de 12, mão inicial de 4.
   Instâncias de carta: { uid, id, owner, ... } — o motor nunca altera as definições do catálogo. */
(function (YC) {
  'use strict';

  const START_LP = 4000;
  const HAND_START = 4;
  const ZONES = 3;

  const def = (inst) => YC.DuelCards.BY_ID[inst.id];

  function newPlayer(team, name, deckIds, rng, uidPrefix) {
    let n = 0;
    const deck = deckIds.map((id) => ({ uid: `${uidPrefix}${++n}`, id, owner: team }));
    rng.shuffle(deck);
    return {
      team, name, lp: START_LP, deck, hand: [], gy: [],
      monsters: new Array(ZONES).fill(null), backrow: new Array(ZONES).fill(null),
      summonTurn: -1, trapLockTurn: -1,
      stats: { damageDealt: 0, kills: 0, summons: 0, cards: 0, traps: 0, counters: 0, cutIns: 0 }
    };
  }

  /** Limpa os marcadores de campo quando a carta sai (vai para a mão, cemitério ou baralho). */
  function resetInst(inst) {
    for (const k of ['position', 'summonTurn', 'attacks', 'posChangedTurn', 'mods', 'stunUntil', 'starDone', 'effectTurn', 'setTurn', 'revealed', 'zone']) delete inst[k];
    return inst;
  }

  function activeMods(g, inst, stat) {
    let sum = 0;
    for (const m of inst.mods || []) if (m.stat === stat && (m.perm || m.turn === g.state.turnCount)) sum += m.amount;
    return sum;
  }

  function rawStats(g, inst) {
    const c = def(inst);
    let atk = (c.atk || 0) + activeMods(g, inst, 'atk');
    let dfn = (c.def || 0) + activeMods(g, inst, 'def');
    if (c.id === 'peao_caneca' && g.state.pile.color === 'R') atk += 300;
    return { atk, def: dfn };
  }

  /** ATK/DEF efetivos (Inversão de Polaridade troca os dois até ao fim do turno). */
  function stats(g, inst) {
    const s = rawStats(g, inst);
    if (g.state.polarityTurn === g.state.turnCount) return { atk: Math.max(0, s.def), def: Math.max(0, s.atk) };
    return { atk: Math.max(0, s.atk), def: Math.max(0, s.def) };
  }

  const DuelState = {
    START_LP, HAND_START, ZONES, def, newPlayer, resetInst, stats,
    atk: (g, inst) => stats(g, inst).atk,
    dfn: (g, inst) => stats(g, inst).def,
    isStunned: (g, inst) => (inst.stunUntil || 0) > g.state.turnCount,
    hasDebuff: (g, inst) => (inst.stunUntil || 0) > g.state.turnCount || (inst.mods || []).some((m) => m.amount < 0 && (m.perm || m.turn === g.state.turnCount)),
    monstersOf: (g, team) => g.state.players[team].monsters.filter(Boolean),
    backrowOf: (g, team) => g.state.players[team].backrow.filter(Boolean),

    /** Procura uma instância em qualquer zona. */
    locate(g, uid) {
      for (const team of YC.TEAMS) {
        const p = g.state.players[team];
        for (const zone of ['hand', 'monsters', 'backrow', 'gy', 'deck']) {
          const i = p[zone].findIndex((x) => x && x.uid === uid);
          if (i >= 0) return { inst: p[zone][i], team, zone, index: i, player: p };
        }
      }
      return null;
    },

    /** Combinação Uno com a pilha (cor ou símbolo iguais; Curingas não dão Sintonia). */
    sintonia(g, card) {
      const pile = g.state.pile;
      return card.color !== 'W' && (card.color === pile.color || (!!pile.symbol && card.symbol === pile.symbol));
    },

    /** Protegido de Armadilhas Normais (Cavalo Fantasma com a pilha Azul). */
    trapImmune(g, inst) {
      return !!inst && inst.id === 'cavalo_fantasma' && g.state.pile.color === 'B';
    },

    maxAttacks(g, inst) {
      return inst.id === 'cavalo_valquiria' && g.state.pile.color === 'Y' ? 2 : 1;
    },

    /** Cor mais comum na mão (escolha automática de cor para Curingas em resposta). */
    favouriteColor(g, team) {
      const n = { R: 0, B: 0, G: 0, Y: 0 };
      for (const c of g.state.players[team].hand) { const col = def(c).color; if (n[col] != null) n[col]++; }
      return Object.keys(n).sort((a, b) => n[b] - n[a] || 'RBGY'.indexOf(a) - 'RBGY'.indexOf(b))[0];
    }
  };

  YC.DuelState = DuelState;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
