/* GachaShop.js — "Inkwell Booster Shop": pacotes de 3 cartas por 100 Moedas de Tinta.
   Abertura: o pacote treme, rasga com um feixe da cor da maior raridade (dourado = Lendária,
   arco-íris = Ultra-Rara), explode em estrelas e mostra 3 cartas viradas que giram ao clicar. */
(function (YC) {
  'use strict';

  const C = () => YC.Collection;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => YC.DuelCardView.esc(s);

  const PACK_SVG = `<svg viewBox="0 0 200 290" class="pack-svg" aria-label="Pacotinho Inkwell Booster">
    <defs><linearGradient id="foil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C83E3B"/><stop offset="0.5" stop-color="#E5A93C"/><stop offset="1" stop-color="#8f2a24"/></linearGradient>
      <clipPath id="pack-clip"><rect x="14" y="36" width="172" height="232"/></clipPath></defs>
    <path class="pack-top" d="M14,14 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 v22 h-172 z" fill="#8f2a24" stroke="#141210" stroke-width="4" stroke-linejoin="round"/>
    <rect x="14" y="36" width="172" height="232" fill="url(#foil)" stroke="#141210" stroke-width="5"/>
    <g opacity="0.25" clip-path="url(#pack-clip)">${Array.from({ length: 12 }, (_, i) => `<path d="M100,150 L${100 + 160 * Math.cos(i * 0.5236)},${150 + 160 * Math.sin(i * 0.5236)} L${100 + 160 * Math.cos(i * 0.5236 + 0.26)},${150 + 160 * Math.sin(i * 0.5236 + 0.26)} Z" fill="#FFF8E7"/>`).join('')}</g>
    <ellipse cx="100" cy="150" rx="66" ry="54" fill="#FFF8E7" stroke="#141210" stroke-width="5"/>
    <g transform="translate(40 108)">${YC.DuelArt ? YC.DuelArt.emblem('tinta_rubra').replace('<svg viewBox="0 0 120 90" class="dart" aria-hidden="true">', '<svg viewBox="0 0 120 90" width="120" height="90">') : ''}</g>
    <text x="100" y="72" text-anchor="middle" font-family="Rye, Georgia, serif" font-size="24" fill="#FFF8E7" stroke="#141210" stroke-width="1.5">INKWELL</text>
    <text x="100" y="230" text-anchor="middle" font-family="Rye, Georgia, serif" font-size="22" fill="#FFF8E7" stroke="#141210" stroke-width="1.5">BOOSTER</text>
    <text x="100" y="254" text-anchor="middle" font-family="'Special Elite', monospace" font-size="13" fill="#141210">3 CARTAS · SPEED DUEL</text>
    <path d="M14,268 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8 l8,8 l8,-8" fill="none" stroke="#141210" stroke-width="4"/>
  </svg>`;

  class GachaShop {
    constructor({ audio, vfx, onChange }) { this.audio = audio; this.vfx = vfx; this.onChange = onChange; this.busy = false; }

    render(host, save) {
      this.host = host; this.save = save;
      const left = C().PITY - save.packsSinceUR;
      host.innerHTML = `<div class="shop">
        <div class="pack-stage"><div class="pack idle">${PACK_SVG}</div></div>
        <div class="shop-info">
          <h2>Loja de Pacotinhos</h2>
          <p>Cada pacote traz <b>3 cartas</b> e custa <b>${C().PACK_COST} 🪙</b>.</p>
          <table class="odds"><tbody>
            <tr class="r-N"><td>Normal</td><td>60%</td></tr><tr class="r-E"><td>Épico</td><td>25%</td></tr>
            <tr class="r-L"><td>Lendário</td><td>11%</td></tr><tr class="r-UR"><td>Ultra-Raro</td><td>4%</td></tr></tbody></table>
          <p class="pity">Pity: Ultra-Rara garantida ${left <= 1 ? '<b>no próximo pacote!</b>' : `daqui a <b>${left}</b> pacotes`}.</p>
          <button class="btn-big" data-buy ${save.coins < C().PACK_COST ? 'disabled' : ''}>Comprar Pacote (${C().PACK_COST} 🪙)</button>
          <p class="shop-note">${save.coins < C().PACK_COST ? 'Moedas insuficientes: ganha duelos (+150) ou perde com estilo (+40).' : `Tens ${save.coins} 🪙 · ${save.packsOpened} pacotes abertos.`}</p>
        </div></div>`;
      host.querySelector('[data-buy]').addEventListener('click', () => this.buy());
    }

    async buy() {
      if (this.busy) return;
      let result;
      try { result = C().openPack(this.save); } catch (err) { this.vfx.bigWord('SEM MOEDAS!', 'trap'); return; }
      C().save(this.save);
      this.busy = true;
      this.audio.playCoin();
      if (this.onChange) this.onChange();
      try { await this.animate(result); } finally { this.busy = false; this.render(this.host, this.save); if (this.onChange) this.onChange(); }
    }

    async animate({ cards, best, pity }) {
      const ov = document.createElement('div');
      ov.className = `gacha-open beam-${best}`;
      ov.innerHTML = `<div class="gacha-pack shaking">${PACK_SVG}</div><div class="gacha-beam"></div><div class="gacha-cards"></div>
        <div class="gacha-foot"><button class="btn-big alt" data-all>Revelar todas</button><button class="btn-big" data-done hidden>Continuar</button></div>
        ${pity ? '<div class="gacha-pity">PITY! Ultra-Rara garantida</div>' : ''}`;
      document.getElementById('screen-root').appendChild(ov);
      for (let i = 0; i < 6; i++) { this.audio.playTick(); await wait(140); }
      ov.querySelector('.gacha-pack').classList.add('torn');
      this.audio.playPackRip();
      if (best === 'L' || best === 'UR') this.audio.playBrassParryFanfare();
      const r = ov.querySelector('.gacha-pack').getBoundingClientRect();
      this.vfx.spawnCartoonExplosion(r.left + r.width / 2, r.top + 30, best === 'UR' ? '#ff8fc8' : best === 'L' ? '#F1C40F' : best === 'E' ? '#9B59B6' : '#F4E7C5', best === 'UR' ? 'ULTRA!' : best === 'L' ? 'LENDÁRIA!' : 'RIIIP!');
      await wait(650);
      ov.classList.add('reveal');
      const row = ov.querySelector('.gacha-cards');
      let flipped = 0;
      const done = ov.querySelector('[data-done]');
      const flip = (fc, id) => {
        if (fc.classList.contains('flipped')) return;
        fc.classList.add('flipped');
        flipped++;
        const card = YC.DuelCards.BY_ID[id];
        this.audio.playCardFlip();
        if (card.rarity === 'UR') { this.audio.playVictory(); this.vfx.triggerScreenShake(12, 400); }
        else if (card.rarity === 'L') this.audio.playFanfareShort();
        const rr = fc.getBoundingClientRect();
        if (card.rarity === 'L' || card.rarity === 'UR') this.vfx.spawnCartoonExplosion(rr.left + rr.width / 2, rr.top + rr.height / 2, card.rarity === 'UR' ? '#ff8fc8' : '#F1C40F', card.rarity);
        if (flipped === cards.length) { done.hidden = false; ov.querySelector('[data-all]').hidden = true; }
      };
      cards.forEach((id, i) => {
        const card = YC.DuelCards.BY_ID[id];
        const fc = document.createElement('div');
        fc.className = `flip-card r-${card.rarity}`;
        fc.style.animationDelay = `${i * 0.12}s`;
        fc.innerHTML = '<div class="flip-inner"><div class="flip-back"></div><div class="flip-front"></div></div>';
        fc.querySelector('.flip-back').appendChild(YC.DuelCardView.createBack());
        fc.querySelector('.flip-front').appendChild(YC.DuelCardView.create(card));
        fc.querySelector('.flip-front').insertAdjacentHTML('beforeend', `<span class="new-tag">${esc(YC.DuelCards.RARITY[card.rarity].label)}</span>`);
        fc.addEventListener('click', () => flip(fc, id));
        row.appendChild(fc);
      });
      ov.querySelector('[data-all]').addEventListener('click', async () => {
        for (const [i, fc] of [...row.children].entries()) { flip(fc, cards[i]); await wait(260); }
      });
      await new Promise((res) => done.addEventListener('click', res));
      ov.remove();
    }
  }

  YC.GachaShop = GachaShop;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
