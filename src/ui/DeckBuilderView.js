/* DeckBuilderView.js — Baralhos: coleção (com filtros e oficina de criação com Poeira Estelar)
   à esquerda e o baralho de 22 à direita. Validação: 22 cartas, máx. 2 cópias (1 Lendária), máx. 3 Lendárias. */
(function (YC) {
  'use strict';

  const E = () => YC.Economy;
  const SIZE = () => YC.Cards.RULES.DECK_SIZE;
  const esc = (s) => YC.HoloCard.esc(s);
  const KINDS = [['ALL', 'Todas'], ['EQUIP', 'Equipamentos'], ['GRID', 'Armadilhas de Casa'], ['REACTIVE', 'Reativas'], ['COUNTER', 'Counter-Traps'], ['QUICK', 'Magias Rápidas']];
  const NEW = () => View.newSet || (View.newSet = new Set((YC.CARDS_NEW || []).map((n) => n[0])));
  const FAMS = [['ALL', 'Todas as famílias'], ['classic', 'Clássicas'], ['gelo', 'Criogenia'], ['oficina', 'Oficina'], ['circo', 'Circo'], ['lab', 'Laboratório'], ['tribunal', 'Tribunal'], ['sucata', 'Sucata & Piratas'], ['policia', 'Polícia']];
  const RARS = [['ALL', 'Todas as raridades'], ['LEGENDARY', 'Lendárias', 'crown'], ['EPIC', 'Épicas', 'gemEpic'], ['RARE', 'Raras', 'gemRare'], ['COMMON', 'Comuns', 'gemCommon']];

  /** Chips de raridade com quantas dessa raridade já tens (cartas diferentes) / o total. */
  function rarChips(p) {
    return RARS.map(([k, l, ic]) => {
      const all = YC.Cards.LIST.filter((c) => k === 'ALL' || c.rarity === k);
      const have = all.filter((c) => E().owned(p, c.id) > 0).length;
      return `<button class="chip r-chip ${View.rar === k ? 'on' : 'dark'}" data-rar="${k}" data-r="${k}">${ic ? YC.Icon(ic, { size: 16 }) : ''}${l}<small>${have}/${all.length}</small></button>`;
    }).join('');
  }

  const View = {
    filter: 'ALL',
    fam: 'ALL',
    rar: 'ALL',
    mine: false,
    draft: null,

    load() {
      const p = YC.ProfileStore.profile, d = E().activeDeck(p);
      View.draft = { id: d.id, name: d.name, cards: d.cards.slice() };
    },

    render(root) {
      View.root = root || View.root;
      YC.CardZoom.hide();
      if (!View.draft) View.load();
      const p = YC.ProfileStore.profile, d = View.draft;
      const v = E().validateDeck(p, d.cards);
      View.root.innerHTML = `
        <div class="builder">
          <section class="panel coll">
            <div class="coll-head"><h2>Coleção</h2><span class="coin-pill dust"><i></i>${p.stardust}</span></div>
            <div class="filters">${KINDS.map(([k, l]) => `<button class="chip ${View.filter === k ? 'on' : 'dark'}" data-f="${k}">${l}</button>`).join('')}</div>
            <div class="filters fams">${FAMS.map(([k, l]) => `<button class="chip ${View.fam === k ? 'on' : 'dark'}" data-fam="${k}">${l}</button>`).join('')}<button class="chip ${View.mine ? 'on' : 'dark'}" data-mine="1">Só as minhas</button></div>
            <div class="filters rars">${rarChips(p)}</div>
            <div class="coll-grid"></div>
          </section>
          <section class="panel deck">
            <div class="deck-head">
              <select class="deck-pick">${p.decks.map((x) => `<option value="${esc(x.id)}" ${x.id === d.id ? 'selected' : ''}>${esc(x.name)}${x.id === p.activeDeckId ? ' (em uso)' : ''}</option>`).join('')}<option value="__new">+ Novo baralho</option></select>
              <input class="text-in deck-name" maxlength="24" value="${esc(d.name)}">
              <button class="icon-btn deck-del" data-a="del" title="Apagar baralho" aria-label="Apagar baralho">${YC.Icon('trash', { size: 22 })}</button>
            </div>
            <div class="deck-count ${d.cards.length === SIZE() ? 'ok' : ''}">${d.cards.length}/${SIZE()}</div>
            <div class="deck-grid"></div>
            <ul class="deck-errors">${v.errors.slice(0, 3).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
            <div class="deck-btns">
              <button class="btn small green" data-a="save">Guardar</button>
              <button class="btn small" data-a="use" ${v.ok ? '' : 'disabled'}>${p.activeDeckId === d.id ? 'Em uso' : 'Usar nas partidas'}</button>
              <button class="btn small violet" data-a="auto">Auto-completar</button>
              <button class="btn small ghost" data-a="clear">Esvaziar</button>
            </div>
          </section>
        </div>`;
      View.fillCollection(p);
      View.fillDeck();
      const r = View.root;
      r.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { View.filter = b.dataset.f; View.render(); });
      r.querySelectorAll('[data-fam]').forEach((b) => b.onclick = () => { View.fam = b.dataset.fam; View.render(); });
      r.querySelectorAll('[data-rar]').forEach((b) => b.onclick = () => { View.rar = b.dataset.rar; View.render(); });
      r.querySelector('[data-mine]').onclick = () => { View.mine = !View.mine; View.render(); };
      r.querySelector('.deck-pick').onchange = (e) => View.pick(e.target.value);
      r.querySelector('.deck-name').oninput = (e) => { View.draft.name = e.target.value; };
      r.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => View.act(b.dataset.a));
    },

    fillCollection(p) {
      const grid = View.root.querySelector('.coll-grid');
      const order = YC.Cards.RARITY;
      const list = YC.Cards.LIST.filter((c) => (View.filter === 'ALL' || c.kind === View.filter)
        && (View.fam === 'ALL' || (View.fam === 'classic' ? !NEW().has(c.id) : c.family === View.fam))
        && (View.rar === 'ALL' || c.rarity === View.rar)
        && (!View.mine || E().owned(p, c.id) > 0))
        .sort((a, b) => order[a.rarity].order - order[b.rarity].order || a.kind.localeCompare(b.kind));
      for (const c of list) {
        const owned = E().owned(p, c.id), inDeck = View.draft.cards.filter((x) => x === c.id).length;
        const cell = document.createElement('div');
        cell.className = 'coll-cell';
        const el = YC.HoloCard.create(c.id, { size: 'md' });
        if (!owned) el.classList.add('locked');
        el.insertAdjacentHTML('beforeend', `<span class="count-badge">${inDeck}/${owned}</span>`);
        el.onclick = () => View.add(c.id);
        YC.CardZoom.attach(el, c.id, { width: 300 });
        cell.appendChild(el);
        if (owned < E().cap(c.id)) {
          const cost = E().craftCost(c.id);
          const b = document.createElement('button');
          b.className = `btn small ${p.stardust >= cost ? 'violet' : 'ghost'}`;
          b.innerHTML = `Criar · ${cost} ${YC.Icon('dust', { size: 18 })}`;
          b.disabled = p.stardust < cost;
          b.onclick = (e) => { e.stopPropagation(); View.craft(c.id); };
          cell.appendChild(b);
        }
        grid.appendChild(cell);
      }
    },

    fillDeck() {
      const grid = View.root.querySelector('.deck-grid');
      const order = YC.Cards.RARITY;
      const cards = View.draft.cards.slice().sort((a, b) => YC.Cards.get(a).kind.localeCompare(YC.Cards.get(b).kind) || order[YC.Cards.get(b).rarity].order - order[YC.Cards.get(a).rarity].order);
      for (let i = 0; i < SIZE(); i++) {
        const slot = document.createElement('div');
        slot.className = 'deck-slot';
        if (cards[i]) {
          const el = YC.HoloCard.create(cards[i], { size: 'xs', static: true });
          el.title = 'Clica para tirar do baralho';
          YC.CardZoom.attach(el, cards[i], { side: 'left', width: 300 });
          el.onclick = () => View.remove(cards[i]);
          slot.appendChild(el);
        }
        grid.appendChild(slot);
      }
    },

    add(id) {
      const p = YC.ProfileStore.profile, d = View.draft;
      const n = d.cards.filter((x) => x === id).length, c = YC.Cards.get(id);
      if (d.cards.length >= SIZE()) return YC.UI.toast(`O baralho já tem ${SIZE()} cartas.`, true);
      if (n >= E().owned(p, id)) return YC.UI.toast(E().owned(p, id) ? 'Não tens mais cópias desta carta.' : 'Ainda não tens esta carta: abre pacotes ou cria-a.', true);
      if (n >= E().cap(id)) return YC.UI.toast(`Máximo ${E().cap(id)} cópia(s) por baralho.`, true);
      if (c.rarity === 'LEGENDARY' && d.cards.filter((x) => YC.Cards.get(x).rarity === 'LEGENDARY').length >= YC.Cards.RULES.MAX_LEGENDARIES) return YC.UI.toast(`Máximo ${YC.Cards.RULES.MAX_LEGENDARIES} Lendárias por baralho.`, true);
      d.cards.push(id);
      YC.Sound.play('card_flip');
      View.render();
    },

    remove(id) {
      const i = View.draft.cards.indexOf(id);
      if (i >= 0) View.draft.cards.splice(i, 1);
      YC.Sound.play('click');
      View.render();
    },

    pick(id) {
      const p = YC.ProfileStore.profile;
      if (id === '__new') View.draft = { id: `d${Date.now().toString(36)}`, name: `Baralho ${p.decks.length + 1}`, cards: [] };
      else { const d = p.decks.find((x) => x.id === id); View.draft = { id: d.id, name: d.name, cards: d.cards.slice() }; }
      View.render();
    },

    craft(id) {
      try {
        YC.ProfileStore.update((p) => E().craft(p, id));
        YC.Sound.play('reveal_rare');
        YC.UI.toast(`Criaste ${YC.Cards.get(id).name}!`);
      } catch (err) { YC.UI.toast(err.message, true); }
      View.render();
    },

    async act(a) {
      const d = View.draft;
      if (a === 'save') {
        YC.ProfileStore.update((p) => E().saveDeck(p, d));
        return YC.UI.toast('Baralho guardado.') || View.render();
      }
      if (a === 'use') {
        YC.ProfileStore.update((p) => { E().saveDeck(p, d); p.activeDeckId = d.id; });
        YC.UI.toast(`«${d.name}» vai ser usado nas partidas.`);
        return View.render();
      }
      if (a === 'auto') {
        d.cards = E().autoDeck(YC.ProfileStore.profile);
        YC.Sound.play('magic_zap');
        return View.render();
      }
      if (a === 'clear') { d.cards = []; return View.render(); }
      if (a === 'del') {
        if (!(await YC.UI.confirm('Apagar baralho?', `«${esc(d.name)}» vai desaparecer.`, 'Apagar'))) return;
        try { YC.ProfileStore.update((p) => E().deleteDeck(p, d.id)); } catch (err) { return YC.UI.toast(err.message, true); }
        View.load();
        View.render();
      }
    }
  };

  YC.DeckBuilderView = View;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
