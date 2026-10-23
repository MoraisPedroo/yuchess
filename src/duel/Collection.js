/* Collection.js — economia do Speed Duel: Moedas de Tinta, pacotinhos (3 cartas, 100 moedas),
   probabilidades N 60% / E 25% / L 11% / UR 4% com pity (1 UR garantida a cada 10 pacotes),
   coleção, baralho ativo de 12 e "Auto-Completar Deck Mais Forte". Guarda tudo no localStorage. */
(function (YC) {
  'use strict';

  const KEY = 'chess-oh.duel.v1';
  const PACK_COST = 100, PACK_SIZE = 3, PITY = 10;
  const REWARD = { win: 150, loss: 40 };
  const D = () => YC.DuelCards;

  const SPELL_POWER = {
    tinta_rubra: 700, apito_guarda: 650, tonel_espinafre: 500, casca_banana: 900, cortina_fumo: 600, troca_chapeu: 450,
    luva_boxe: 850, inversao_polaridade: 600, compra_gananciosa: 600, bigorna_ceu: 900, alcapao_teatro: 850,
    espelho_tinta: 750, censura_diretor: 900, roleta_rei_dado: 1300, ressurreicao_celuloide: 1200, dinamite_acme: 1300,
    julgamento_solene: 1400, penalidade_maxima: 2200, parry_absoluto: 2400, xeque_mate_diabo: 1100
  };

  function countIds(ids) { const o = {}; for (const id of ids) o[id] = (o[id] || 0) + 1; return o; }

  const Collection = {
    KEY, PACK_COST, PACK_SIZE, PITY, REWARD,

    newSave() {
      return { v: 1, coins: 600, owned: countIds(D().STARTER_DECK), deck: D().STARTER_DECK.slice(), packsSinceUR: 0, packsOpened: 0, wins: 0, losses: 0 };
    },

    load() {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (raw && raw.v === 1 && raw.owned && Array.isArray(raw.deck)) return raw;
      } catch (e) { /* armazenamento indisponível */ }
      return Collection.newSave();
    },

    save(data) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
    },

    rollRarity(rand) {
      const r = rand();
      if (r < 0.04) return 'UR';
      if (r < 0.15) return 'L';
      if (r < 0.40) return 'E';
      return 'N';
    },

    randomOfRarity(rarity, rand) {
      const list = D().CARDS.filter((c) => c.rarity === rarity);
      return list[Math.floor(rand() * list.length)].id;
    },

    /** Abre um pacote (altera `save`). Devolve { cards, best, pity }. */
    openPack(save, rand = Math.random) {
      if (save.coins < PACK_COST) throw new Error('Moedas de Tinta insuficientes.');
      save.coins -= PACK_COST;
      const rarities = Array.from({ length: PACK_SIZE }, () => Collection.rollRarity(rand));
      let pity = false;
      if (!rarities.includes('UR') && save.packsSinceUR >= PITY - 1) { rarities[PACK_SIZE - 1] = 'UR'; pity = true; }
      const cards = rarities.map((r) => Collection.randomOfRarity(r, rand));
      for (const id of cards) save.owned[id] = (save.owned[id] || 0) + 1;
      save.packsOpened++;
      save.packsSinceUR = rarities.includes('UR') ? 0 : save.packsSinceUR + 1;
      const order = ['N', 'E', 'L', 'UR'];
      const best = rarities.reduce((a, b) => (order.indexOf(b) > order.indexOf(a) ? b : a), 'N');
      return { cards, best, pity };
    },

    power(id) {
      const c = D().BY_ID[id];
      if (c.category !== 'MONSTER') return SPELL_POWER[id] || 500;
      const bonus = { N: 0, E: 150, L: 400, UR: 700 }[c.rarity];
      return c.atk + c.def * 0.25 + bonus - D().tributesFor(c) * 650;
    },

    /** Melhor baralho de 12 a partir das cartas possuídas, com peças suficientes para tributar. */
    autoDeck(owned) {
      const copies = [];
      for (const [id, n] of Object.entries(owned)) {
        const c = D().BY_ID[id];
        if (!c) continue;
        const max = Math.min(n, D().RARITY[c.rarity].max);
        for (let i = 0; i < max; i++) copies.push({ id, c, score: Collection.power(id) - i * 60 });
      }
      copies.sort((a, b) => b.score - a.score);
      const deck = [];
      const take = (pred, limit) => {
        for (const x of copies) {
          if (deck.length >= 12 || limit <= 0) break;
          if (x.taken || !pred(x.c)) continue;
          x.taken = true; deck.push(x.id); limit--;
        }
      };
      const lvl = (c) => (c.category === 'MONSTER' ? D().tributesFor(c) : -1);
      take((c) => lvl(c) === 0, 6);
      take((c) => lvl(c) === 2, 2);
      take((c) => lvl(c) === 1, 3 - deck.filter((id) => lvl(D().BY_ID[id]) === 2).length);
      take((c) => c.category !== 'MONSTER', 5);
      take((c) => lvl(c) === 0, 12);
      take(() => true, 12);
      return deck.slice(0, 12);
    },

    validate(save, ids = save.deck) { return D().validateDeck(ids, save.owned); },

    /** Recompensa pós-duelo (Moedas de Tinta). */
    reward(save, won) {
      const coins = won ? REWARD.win : REWARD.loss;
      save.coins += coins;
      if (won) save.wins++; else save.losses++;
      return coins;
    },

    /** Baralho do Rei Dado: pacotes simulados (mais quanto mais vitórias tiveres) + o melhor deck. */
    aiDeck(rand, wins = 0) {
      const fake = Collection.newSave();
      fake.coins = 1e9;
      const packs = 5 + Math.min(12, wins * 2);
      for (let i = 0; i < packs; i++) Collection.openPack(fake, rand);
      return Collection.autoDeck(fake.owned);
    }
  };

  YC.Collection = Collection;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
