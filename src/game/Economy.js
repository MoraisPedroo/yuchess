/* Economy.js — perfil do jogador, pacotinhos (gacha), pity, duplicados → Poeira Estelar, criação de cartas,
   validação de baralhos e recompensas. Funções puras sobre o objeto `profile` (guardado pelo ProfileStore). */
(function (YC) {
  'use strict';

  const Cards = () => YC.Cards;
  const RATES_MAIN = [['COMMON', 0.65], ['RARE', 0.25], ['EPIC', 0.08], ['LEGENDARY', 0.02]];
  const RATES_LAST = [['RARE', 0.78], ['EPIC', 0.18], ['LEGENDARY', 0.04]];

  const Economy = {
    PACK_COST: 100,
    PACK_SIZE: 5,
    START_GOLD: 500,
    START_DUST: 200,
    WIN: { gold: 120, stardust: 25 },
    LOSS: { gold: 40, stardust: 0 },
    DRAW: { gold: 60, stardust: 10 },
    LOSS_MIN_TURNS: 5,
    EPIC_PITY: 4,
    LEGEND_SOFT: 15,
    LEGEND_HARD: 20,

    newProfile(name = 'Duelista') {
      const inventory = {};
      for (const id of Cards().STARTER_DECK) inventory[id] = (inventory[id] || 0) + 1;
      return {
        version: 3, displayName: name, gold: Economy.START_GOLD, stardust: Economy.START_DUST, inventory,
        decks: [{ id: 'inicial', name: 'Baralho Inicial', cards: Cards().STARTER_DECK.slice() }],
        activeDeckId: 'inicial', pityEpic: 0, pityLegendary: 0,
        stats: { wins: 0, losses: 0, draws: 0, packs: 0 }, updatedAt: 0
      };
    },

    normalize(p) {
      const base = Economy.newProfile(p && p.displayName);
      const out = { ...base, ...(p || {}) };
      out.inventory = { ...(p && p.inventory ? p.inventory : base.inventory) };
      out.stats = { ...base.stats, ...(p && p.stats) };
      out.decks = Array.isArray(out.decks) && out.decks.length ? out.decks : base.decks;
      if (!out.decks.find((d) => d.id === out.activeDeckId)) out.activeDeckId = out.decks[0].id;
      if (!(out.version >= 2)) Economy.migrate22(out);
      if (!(out.version >= 3)) Economy.giveStarter(out);
      return out;
    },

    /** Perfis da versão 1 (baralhos de 12): oferece as cartas do baralho inicial novo que faltem
        e completa cada baralho até 22 com cartas da coleção. Pode correr mais de uma vez sem dar nada a mais. */
    migrate22(p) {
      Economy.giveStarter(p);
      p.decks = p.decks.map((d) => ({ ...d, cards: Economy.fillDeck(p, (d.cards || []).filter((id) => Cards().get(id))) }));
      p.version = 2;
    },

    /** Versão 3 (expansão de 120 cartas): oferece as cartas do baralho inicial novo que faltem (sem duplicar). */
    giveStarter(p) {
      const need = {};
      for (const id of Cards().STARTER_DECK) need[id] = (need[id] || 0) + 1;
      for (const [id, n] of Object.entries(need)) if (Economy.owned(p, id) < n) p.inventory[id] = n;
      p.version = Math.max(p.version || 1, 3);
    },

    /** Completa um baralho até ao tamanho certo com cartas da coleção (raridade primeiro, mistura de tipos). */
    fillDeck(p, cards) {
      const R = Cards().RULES, out = cards.slice(0, R.DECK_SIZE);
      const n = (id) => out.filter((x) => x === id).length;
      let legends = out.filter((id) => Cards().get(id).rarity === 'LEGENDARY').length;
      for (const id of Economy.autoDeck(p, () => 0.5).concat(Object.keys(p.inventory))) {
        if (out.length >= R.DECK_SIZE) break;
        const c = Cards().get(id);
        if (!c || n(id) >= Math.min(Economy.owned(p, id), Economy.cap(id))) continue;
        if (c.rarity === 'LEGENDARY') { if (legends >= R.MAX_LEGENDARIES) continue; legends++; }
        out.push(id);
      }
      return out;
    },

    cap(id) { return Cards().RARITY[Cards().get(id).rarity].cap; },
    owned(p, id) { return p.inventory[id] || 0; },
    activeDeck(p) { return p.decks.find((d) => d.id === p.activeDeckId) || p.decks[0]; },

    pickRarity(rng, table) {
      let x = rng();
      for (const [r, w] of table) { if (x < w) return r; x -= w; }
      return table[table.length - 1][0];
    },

    /** Raridade de cada uma das 5 cartas, com pity épico (rígido) e lendário (suave a partir do 15.º, rígido no 20.º). */
    rollRarities(p, rng) {
      const out = [];
      for (let i = 0; i < 4; i++) out.push(Economy.pickRarity(rng, RATES_MAIN));
      const n = p.pityLegendary + 1;
      let last;
      if (n >= Economy.LEGEND_HARD) last = 'LEGENDARY';
      else if (n >= Economy.LEGEND_SOFT && rng() < 0.04 + 0.15 * (n - Economy.LEGEND_SOFT + 1)) last = 'LEGENDARY';
      else if (p.pityEpic >= Economy.EPIC_PITY) last = rng() < 0.9 ? 'EPIC' : 'LEGENDARY';
      else last = Economy.pickRarity(rng, RATES_LAST);
      out.push(last);
      return out;
    },

    /** Abre um pacotinho: cobra 100 de ouro, atualiza inventário, pity e poeira. */
    openPack(p, rng = Math.random) {
      if (p.gold < Economy.PACK_COST) throw new Error('Ouro insuficiente: precisas de 100 moedas.');
      p.gold -= Economy.PACK_COST;
      const cards = Economy.rollRarities(p, rng).map((rarity) => {
        // Épicas e Lendárias: primeiro as que ainda não tens no máximo (proteção contra duplicados)
        const all = Cards().byRarity(rarity), fresh = all.filter((c) => Economy.owned(p, c.id) < Economy.cap(c.id));
        const pool = (rarity === 'EPIC' || rarity === 'LEGENDARY') && fresh.length ? fresh : all;
        const def = pool[Math.floor(rng() * pool.length)];
        const have = Economy.owned(p, def.id);
        const res = { id: def.id, rarity, isNew: have === 0, dupe: false, dust: 0 };
        if (have >= Economy.cap(def.id)) {
          res.dupe = true;
          res.dust = Cards().RARITY[rarity].dust;
          p.stardust += res.dust;
        } else {
          p.inventory[def.id] = have + 1;
        }
        return res;
      });
      const has = (r) => cards.some((c) => c.rarity === r);
      p.pityEpic = has('EPIC') || has('LEGENDARY') ? 0 : p.pityEpic + 1;
      p.pityLegendary = has('LEGENDARY') ? 0 : p.pityLegendary + 1;
      p.stats.packs++;
      return cards;
    },

    // ── Ultimates: animação especial de uma Lendária (só visual), desbloqueada com ouro por quem tem a carta.
    //    Ficam em p.stats.ultimates (o "stats" já é gravado na nuvem e as regras não validam o conteúdo). ──
    ULTIMATES: { eq_cetro_usurpador: 1000 },
    ultimateCost(id) { return Economy.ULTIMATES[id] || 0; },
    hasUltimate(p, id) { return !!(p.stats && p.stats.ultimates && p.stats.ultimates.includes(id)); },
    unlockUltimate(p, id) {
      const cost = Economy.ultimateCost(id);
      if (!cost) throw new Error('Esta carta não tem animação Ultimate.');
      if (Economy.hasUltimate(p, id)) throw new Error('Já desbloqueaste esta Ultimate.');
      if (Economy.owned(p, id) < 1) throw new Error('Primeiro tens de ter a carta: abre pacotes ou cria-a.');
      if (p.gold < cost) throw new Error(`Precisas de ${cost} de ouro.`);
      p.gold -= cost;
      p.stats.ultimates = [...(p.stats.ultimates || []), id];
      return id;
    },

    craftCost(id) { return Cards().RARITY[Cards().get(id).rarity].craft; },
    canCraft(p, id) { return Economy.owned(p, id) < Economy.cap(id) && p.stardust >= Economy.craftCost(id); },
    craft(p, id) {
      if (Economy.owned(p, id) >= Economy.cap(id)) throw new Error('Já tens o máximo de cópias desta carta.');
      const cost = Economy.craftCost(id);
      if (p.stardust < cost) throw new Error(`Precisas de ${cost} de Poeira Estelar.`);
      p.stardust -= cost;
      p.inventory[id] = Economy.owned(p, id) + 1;
    },

    /** Exatamente 22 (RULES.DECK_SIZE), cartas que tens, máx. 2 cópias (1 se Lendária) e máx. 3 Lendárias. */
    validateDeck(p, cards, { ignoreOwnership = false } = {}) {
      const R = Cards().RULES, errors = [], count = {};
      for (const id of cards) count[id] = (count[id] || 0) + 1;
      if (cards.length !== R.DECK_SIZE) errors.push(`O baralho tem ${cards.length} cartas: precisa de exatamente ${R.DECK_SIZE}.`);
      let legends = 0;
      for (const [id, n] of Object.entries(count)) {
        const def = Cards().get(id);
        if (!def) { errors.push(`Carta desconhecida: ${id}.`); continue; }
        if (def.rarity === 'LEGENDARY') legends += n;
        if (n > Economy.cap(id)) errors.push(`${def.name}: máximo ${Economy.cap(id)} cópia(s).`);
        if (!ignoreOwnership && p && n > Economy.owned(p, id)) errors.push(`${def.name}: só tens ${Economy.owned(p, id)}.`);
      }
      if (legends > R.MAX_LEGENDARIES) errors.push(`Máximo ${R.MAX_LEGENDARIES} Lendárias por baralho.`);
      return { ok: errors.length === 0, errors };
    },

    saveDeck(p, deck) {
      const i = p.decks.findIndex((d) => d.id === deck.id);
      const clean = { id: deck.id || `d${Date.now().toString(36)}`, name: String(deck.name || 'Baralho').slice(0, 24), cards: deck.cards.slice() };
      if (i >= 0) p.decks[i] = clean; else p.decks.push(clean);
      return clean;
    },

    deleteDeck(p, id) {
      if (p.decks.length <= 1) throw new Error('Precisas de ter pelo menos um baralho.');
      p.decks = p.decks.filter((d) => d.id !== id);
      if (p.activeDeckId === id) p.activeDeckId = p.decks[0].id;
    },

    /** Recompensa no fim da partida (derrota só paga se jogaste pelo menos 5 turnos). */
    reward(p, outcome, ownTurns) {
      let r = { gold: 0, stardust: 0 };
      if (outcome === 'WIN') { r = { ...Economy.WIN }; p.stats.wins++; }
      else if (outcome === 'DRAW') { r = { ...Economy.DRAW }; p.stats.draws++; }
      else { p.stats.losses++; if (ownTurns >= Economy.LOSS_MIN_TURNS) r = { ...Economy.LOSS }; }
      p.gold += r.gold;
      p.stardust += r.stardust;
      return r;
    },

    /** Melhor baralho possível com a coleção (raridade primeiro, com mistura de tipos). */
    autoDeck(p, rng = Math.random) {
      const R = Cards().RULES, order = Cards().RARITY;
      const pool = [];
      for (const [id, n] of Object.entries(p.inventory)) for (let i = 0; i < Math.min(n, Economy.cap(id)); i++) pool.push(Cards().get(id));
      pool.sort((a, b) => order[b.rarity].order - order[a.rarity].order || rng() - 0.5);
      const want = { EQUIP: 6, GRID: 7, REACTIVE: 4, COUNTER: 2, QUICK: 3 };
      const deck = [];
      let legends = 0;
      const tryAdd = (c) => {
        if (deck.length >= R.DECK_SIZE) return;
        if (c.rarity === 'LEGENDARY' && legends >= R.MAX_LEGENDARIES) return;
        deck.push(c.id);
        if (c.rarity === 'LEGENDARY') legends++;
      };
      const rest = [];
      for (const c of pool) { if (want[c.kind] > 0) { want[c.kind]--; tryAdd(c); } else rest.push(c); }
      for (const c of rest) tryAdd(c);
      return deck;
    },

    /** Baralho aleatório válido (simulações e decks do bot). */
    randomDeck(rng, { maxRarity = 'LEGENDARY' } = {}) {
      const order = Cards().RARITY, lim = order[maxRarity].order;
      const pool = [];
      for (const c of Cards().LIST) if (order[c.rarity].order <= lim) for (let i = 0; i < Economy.cap(c.id); i++) pool.push(c);
      rng.shuffle ? rng.shuffle(pool) : pool.sort(() => rng() - 0.5);
      const deck = [];
      let legends = 0;
      for (const c of pool) {
        if (deck.length >= Cards().RULES.DECK_SIZE) break;
        if (c.rarity === 'LEGENDARY') { if (legends >= Cards().RULES.MAX_LEGENDARIES) continue; legends++; }
        deck.push(c.id);
      }
      return deck;
    }
  };

  YC.Economy = Economy;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
