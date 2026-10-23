/* DeckBuilder.js — "Montar Deck": coleção à esquerda, baralho ativo (exatamente 12) à direita.
   Limites por raridade: N 3 · E 2 · L 2 · UR 1, e nunca mais cópias do que as que tens. */
(function (YC) {
  'use strict';

  const D = () => YC.DuelCards;
  const esc = (s) => YC.DuelCardView.esc(s);
  const ORDER = { UR: 0, L: 1, E: 2, N: 3 };

  class DeckBuilder {
    constructor({ audio, onChange }) { this.audio = audio; this.onChange = onChange; this.filter = { rarity: 'ALL', cat: 'ALL' }; }

    render(host, save) {
      this.host = host; this.save = save;
      const owned = Object.keys(save.owned).filter((id) => save.owned[id] > 0).length;
      host.innerHTML = `<div class="builder">
        <section class="builder-coll">
          <div class="builder-head"><h2>A tua coleção <small>${owned}/40 cartas diferentes</small></h2>
            <div class="chips" data-f="rarity">${['ALL', 'N', 'E', 'L', 'UR'].map((r) => `<button class="chip${this.filter.rarity === r ? ' on' : ''}" data-v="${r}">${r === 'ALL' ? 'Todas' : r}</button>`).join('')}</div>
            <div class="chips" data-f="cat">${[['ALL', 'Tudo'], ['MONSTER', 'Peças'], ['SPELL', 'Feitiços'], ['TRAP', 'Armadilhas']].map(([v, l]) => `<button class="chip${this.filter.cat === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>
          <div class="coll-grid"></div>
        </section>
        <section class="builder-deck">
          <h2>Deck ativo <b class="deck-count"></b></h2>
          <ol class="deck-list"></ol>
          <ul class="deck-errors"></ul>
          <div class="builder-actions"><button class="btn-big" data-auto>Auto-Completar Deck Mais Forte</button><button class="btn-big alt" data-clear>Limpar</button></div>
          <p class="builder-note">Clica numa carta da coleção para a pôr no deck; clica no deck para a tirar. Fica guardado automaticamente.</p>
        </section></div>`;
      host.querySelectorAll('.chips').forEach((box) => box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (!b) return;
        this.filter[box.dataset.f] = b.dataset.v;
        this.render(host, save);
      }));
      host.querySelector('[data-auto]').addEventListener('click', () => { save.deck = YC.Collection.autoDeck(save.owned); this.commit(); this.audio.playCoin(); });
      host.querySelector('[data-clear]').addEventListener('click', () => { save.deck = []; this.commit(); });
      this.renderGrid();
      this.renderDeck();
    }

    inDeck(id) { return this.save.deck.filter((x) => x === id).length; }

    renderGrid() {
      const grid = this.host.querySelector('.coll-grid'), save = this.save, f = this.filter;
      grid.innerHTML = '';
      const list = D().CARDS.filter((c) => (f.rarity === 'ALL' || c.rarity === f.rarity) &&
        (f.cat === 'ALL' || (f.cat === 'SPELL' ? ['SPELL', 'QUICK_SPELL'].includes(c.category) : f.cat === 'TRAP' ? ['TRAP', 'COUNTER_TRAP'].includes(c.category) : c.category === f.cat)))
        .sort((a, b) => ORDER[a.rarity] - ORDER[b.rarity] || a.num - b.num);
      for (const c of list) {
        const have = save.owned[c.id] || 0;
        const el = YC.DuelCardView.create(c, { small: true, count: have, locked: !have });
        const used = this.inDeck(c.id);
        if (used) el.insertAdjacentHTML('beforeend', `<span class="in-deck">${used} no deck</span>`);
        el.addEventListener('click', () => this.add(c.id));
        grid.appendChild(el);
      }
    }

    renderDeck() {
      const save = this.save, host = this.host;
      const v = D().validateDeck(save.deck, save.owned);
      host.querySelector('.deck-count').textContent = `${save.deck.length}/12`;
      host.querySelector('.deck-count').className = `deck-count${v.ok ? ' ok' : ''}`;
      const sorted = save.deck.map((id, i) => ({ id, i, c: D().BY_ID[id] })).sort((a, b) => ORDER[a.c.rarity] - ORDER[b.c.rarity] || a.c.num - b.c.num);
      host.querySelector('.deck-list').innerHTML = sorted.map(({ id, i, c }) =>
        `<li class="r-${c.rarity} c-${c.color}" data-i="${i}"><span class="rar">${c.rarity}</span><span class="nm">${esc(c.name)}</span>${c.category === 'MONSTER' ? `<small>${c.atk}/${c.def}</small>` : `<small>${esc(D().CATEGORY_LABEL[c.category])}</small>`}<b>×</b></li>`).join('')
        || '<li class="empty">Deck vazio. Usa o Auto-Completar ou clica nas cartas.</li>';
      host.querySelectorAll('.deck-list [data-i]').forEach((li) => li.addEventListener('click', () => { save.deck.splice(Number(li.dataset.i), 1); this.commit(); this.audio.playClick(); }));
      host.querySelector('.deck-errors').innerHTML = v.ok ? '<li class="ok">✔ Deck válido: pronto para duelar!</li>' : v.errors.map((e) => `<li>${esc(e)}</li>`).join('');
    }

    add(id) {
      const save = this.save, c = D().BY_ID[id];
      const have = save.owned[id] || 0, used = this.inDeck(id), max = D().RARITY[c.rarity].max;
      let why = '';
      if (!have) why = 'Ainda não tens esta carta: abre pacotes na Loja.';
      else if (save.deck.length >= 12) why = 'O deck já tem 12 cartas.';
      else if (used >= Math.min(max, have)) why = used >= max ? `Máximo de ${max} cópias (${D().RARITY[c.rarity].label}).` : `Só tens ${have}.`;
      if (why) { const t = document.getElementById('toast'); t.textContent = why; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); return; }
      save.deck.push(id);
      this.audio.playCardSet();
      this.commit();
    }

    commit() {
      YC.Collection.save(this.save);
      this.renderGrid();
      this.renderDeck();
      if (this.onChange) this.onChange();
    }
  }

  YC.DeckBuilder = DeckBuilder;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
