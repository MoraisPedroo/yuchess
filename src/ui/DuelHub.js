/* DuelHub.js — ecrã central do Speed Duel com abas: Menu Principal, Loja de Pacotinhos,
   Montar Deck (12 Cartas) e Iniciar Duelo. Mostra as Moedas de Tinta sempre visíveis. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.DuelCardView.esc(s);

  const DUEL_RULES = `<h2>Speed Duel · Regras</h2>
    <div class="rules-grid">
      <section><h3>A arena</h3><p>Cada duelista começa com <b>4000 LP</b>, um baralho de <b>12 cartas</b> e <b>4 na mão</b>; compra 1 por turno (quem começa não compra no 1.º turno). Há <b>3 Zonas de Peças</b> e <b>3 Zonas de Suporte</b> por lado. Sem cartas para comprar, perdes 500 LP (Fadiga).</p>
        <p><b>Pilha Uno:</b> cada carta jogada muda a cor/símbolo da pilha. Se jogares uma carta da <b>mesma cor ou símbolo</b>, ganhas <b>Sintonia</b>: peças +300 ATK neste turno; feitiços sem custo dão +300 ATK às tuas peças; counters com custo ficam grátis.</p></section>
      <section><h3>Invocar e lutar</h3><p><b>1 Invocação Normal por turno</b>, em Ataque ou Defesa. Nível 5–6 pede 1 Tributo; Nível 7+ pede 2.</p>
        <ul><li><b>ATK vs ATK:</b> a mais fraca é destruída e o dono perde a diferença.</li>
        <li><b>ATK vs DEF:</b> se o ATK for maior, a defensora é destruída sem dano (exceto Dano Perfurante); se for menor, o atacante faz BOING! e o dono perde DEF − ATK.</li>
        <li><b>Ataque direto</b> quando o rival não tem peças.</li></ul><p>No 1.º turno do duelo não há batalha.</p></section>
      <section><h3>Chain e Spell Speed</h3><p>Invocar, ativar ou atacar abre uma <b>Chain</b>. O rival pode responder com cartas viradas (a partir do turno seguinte a virá-las) ou Feitiços Rápidos. <b>SS1</b> inicia, <b>SS2</b> responde, <b>SS3</b> (Counter Traps) só aceita outra SS3. Resolve do último elo para o primeiro.</p>
        <p>Cartas <b>Lendárias</b> e <b>Ultra-Raras</b> disparam um <b>Cut-In</b> do duelista.</p></section>
    </div>`;

  class DuelHub {
    constructor({ audio, vfx, onDuelAI, onOnline, onChess, onBack }) {
      Object.assign(this, { audio, vfx, onDuelAI, onOnline, onChess, onBack });
      this.tab = 'menu';
      this.shop = new YC.GachaShop({ audio, vfx, onChange: () => this.renderCoins() });
      this.builder = new YC.DeckBuilder({ audio, onChange: () => this.renderCoins() });
    }

    open(tab) {
      this.save = YC.Collection.load();
      if (tab) this.tab = tab;
      if (!this.node) {
        this.node = document.createElement('div');
        this.node.className = 'screen hub-screen';
        this.node.innerHTML = `<div class="curtain-l"></div><div class="curtain-r"></div><div class="hub-card">
          <header class="hub-head"><h1>SPEED DUEL <span>Xadrez · Uno · Duel Links</span></h1>
            <div class="coins" title="Moedas de Tinta">🪙 <b></b><small>Moedas de Tinta</small></div>
            <button class="btn-link" data-back>← Título</button></header>
          <nav class="hub-tabs">${[['menu', 'Menu Principal'], ['shop', 'Loja de Pacotinhos'], ['deck', 'Montar Deck (12)'], ['duel', 'Iniciar Duelo']]
            .map(([k, l]) => `<button data-tab="${k}">${l}</button>`).join('')}</nav>
          <div class="hub-body"></div></div>`;
        document.getElementById('screen-root').appendChild(this.node);
        this.node.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { this.audio.playClick(); this.show(b.dataset.tab); }));
        this.node.querySelector('[data-back]').addEventListener('click', () => { this.close(); this.onBack(); });
      }
      this.show(this.tab);
    }

    close() { if (this.node) { this.node.remove(); this.node = null; } }

    renderCoins() { if (this.node) this.node.querySelector('.coins b').textContent = this.save.coins; }

    show(tab) {
      this.tab = tab;
      this.node.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
      const body = this.node.querySelector('.hub-body');
      body.scrollTop = 0;
      this.renderCoins();
      if (tab === 'shop') return this.shop.render(body, this.save);
      if (tab === 'deck') return this.builder.render(body, this.save);
      if (tab === 'duel') return this.renderDuel(body);
      return this.renderMenu(body);
    }

    renderMenu(body) {
      const s = this.save;
      const kinds = Object.keys(s.owned).filter((id) => s.owned[id] > 0).length;
      const urs = YC.DuelCards.CARDS.filter((c) => c.rarity === 'UR' && s.owned[c.id]).length;
      body.innerHTML = `<div class="hub-menu">
        <div class="hub-hero"></div>
        <div class="hub-buttons">
          <button class="btn-big" data-go="ai">⚔ Duelo contra o Rei Dado</button>
          <button class="btn-big gold" data-go="online">🌐 Duelo Online · ranqueada e salas</button>
          <button class="btn-big alt" data-go="shop">🎁 Abrir pacotinhos</button>
          <button class="btn-big alt" data-go="rules">📜 Regras do Speed Duel</button>
          <div class="hub-classic"><span>Xadrez clássico 8×8:</span><button class="btn small" data-go="chessAI">vs King Dice</button><button class="btn small" data-go="chessHot">2 jogadores</button></div>
        </div>
        <div class="hub-stats">
          <div><b>${s.wins}</b><small>vitórias</small></div><div><b>${s.losses}</b><small>derrotas</small></div>
          <div><b>${kinds}/40</b><small>coleção</small></div><div><b>${urs}/6</b><small>Ultra-Raras</small></div><div><b>${s.packsOpened}</b><small>pacotes</small></div>
        </div></div>`;
      const hero = body.querySelector('.hub-hero');
      ['dama_soberana', 'rei_dado_supremo', 'dragao_tres_cabecas'].forEach((id, i) => {
        const el = YC.DuelCardView.create(YC.DuelCards.BY_ID[id], { small: true, locked: !s.owned[id] });
        el.style.setProperty('--i', i);
        hero.appendChild(el);
      });
      body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
    }

    renderDuel(body) {
      const s = this.save, v = YC.Collection.validate(s);
      body.innerHTML = `<div class="hub-duel">
        <h2>Iniciar Duelo</h2>
        <p>${v.ok ? 'O teu deck de 12 cartas está pronto.' : 'O teu deck ainda não é válido:'}</p>
        ${v.ok ? '' : `<ul class="deck-errors">${v.errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>`}
        <div class="deck-strip"></div>
        <div class="hub-buttons row">
          <button class="btn-big" data-go="ai" ${v.ok ? '' : 'disabled'}>⚔ Duelar contra o Rei Dado</button>
          <button class="btn-big gold" data-go="online" ${v.ok ? '' : 'disabled'}>🌐 Duelo Online</button>
          <button class="btn-big alt" data-go="deck">Montar Deck</button>
        </div>
        <p class="builder-note">Vitória: +${YC.Collection.REWARD.win} 🪙 · Derrota: +${YC.Collection.REWARD.loss} 🪙. O Rei Dado fica mais forte à medida que ganhas.</p></div>`;
      const strip = body.querySelector('.deck-strip');
      for (const id of s.deck) strip.appendChild(YC.DuelCardView.create(YC.DuelCards.BY_ID[id], { tiny: true }));
      body.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => this.go(b.dataset.go)));
    }

    go(where) {
      this.audio.playClick();
      if (where === 'shop' || where === 'deck') return this.show(where);
      if (where === 'rules') return DuelHub.showRules();
      const v = YC.Collection.validate(this.save);
      if ((where === 'ai' || where === 'online') && !v.ok) { this.show('duel'); return; }
      this.close();
      if (where === 'ai') this.onDuelAI(this.save);
      if (where === 'online') this.onOnline(this.save);
      if (where === 'chessAI') this.onChess('AI');
      if (where === 'chessHot') this.onChess('HOTSEAT');
    }
  }

  DuelHub.showRules = function () {
    const m = document.createElement('div');
    m.className = 'modal rules-modal';
    m.innerHTML = `<div class="modal-card wide">${DUEL_RULES}<div class="modal-actions"><button class="btn-big">Entendido!</button></div></div>`;
    document.getElementById('modal-root').appendChild(m);
    m.querySelector('button').addEventListener('click', () => m.remove());
  };
  YC.DuelHub = DuelHub;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
