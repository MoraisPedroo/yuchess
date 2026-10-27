/* GachaView.js — Loja: pacotinho de 5 cartas por 100 de ouro, com coreografia em 4 atos (GSAP):
   1) o pacote salta e treme (mais forte se houver Épica/Lendária); 2) raios de luz da cor da melhor raridade;
   3) a aba rasga-se com confetes; 4) as 5 cartas abrem em leque e viram-se ao clicar (NOVA! / duplicada → Poeira). */
(function (YC) {
  'use strict';

  const E = () => YC.Economy;
  const RAY = { COMMON: '#C9D3E0', RARE: '#5FA2FF', EPIC: '#C58AF9', LEGENDARY: '#FCC934' };
  const esc = (s) => YC.HoloCard.esc(s);
  // baú desenhado no Gemini (assets/items/treasure_chest.png) por cima do logótipo, se existir
  const chest = () => ((YC.ITEM_ART || []).includes('TREASURE_CHEST') ? `<img class="pack-art" src="${YC.asset('assets/items/treasure_chest.png')}" alt="" draggable="false">` : '');
  const packHTML = (cls = '') => `<div class="pack ${cls}"><div class="pack-flap"></div><div class="pack-body">${chest()}<div class="pack-logo">Chess<br><span>Gi-Oh!</span></div><div class="pack-sub">5 cartas · 1 Rara ou melhor</div><div class="pack-shine"></div></div></div>`;

  const View = {
    render(root) {
      const p = YC.ProfileStore.profile;
      const epicIn = Math.max(1, E().EPIC_PITY + 1 - p.pityEpic);
      const legIn = Math.max(1, E().LEGEND_HARD - p.pityLegendary);
      root.innerHTML = `
        <div class="shop">
          <section class="shop-pack">
            <div class="pack-stage">${packHTML('idle')}</div>
            <button class="btn big" data-a="open" ${p.gold < E().PACK_COST ? 'disabled' : ''}>Abrir pacotinho · <span class="coin-pill gold"><i></i>${E().PACK_COST}</span></button>
            <p class="muted">${p.gold < E().PACK_COST ? 'Sem ouro suficiente: ganha partidas para receber mais.' : `Tens ${p.gold} de ouro: dá para ${Math.floor(p.gold / E().PACK_COST)} pacote(s).`}</p>
          </section>
          <section class="panel shop-info">
            <h2>Probabilidades</h2>
            <table class="rates"><tr><th></th><th>Cartas 1–4</th><th>Carta 5</th><th>Cópias</th><th>Duplicada</th></tr>
              <tr class="r-c"><td>Comum</td><td>65%</td><td>—</td><td>2</td><td>+10 ✨</td></tr>
              <tr class="r-r"><td>Rara</td><td>25%</td><td>78%</td><td>2</td><td>+30 ✨</td></tr>
              <tr class="r-e"><td>Épica</td><td>8%</td><td>18%</td><td>2</td><td>+100 ✨</td></tr>
              <tr class="r-l"><td>Lendária</td><td>2%</td><td>4%</td><td>1</td><td>+300 ✨</td></tr></table>
            <h2>Pity (azar compensado)</h2>
            <div class="pity"><span>Épica garantida em</span><b>${epicIn} pacote(s)</b><div class="bar"><i style="width:${(p.pityEpic / E().EPIC_PITY) * 100}%"></i></div></div>
            <div class="pity"><span>Lendária garantida em</span><b>${legIn} pacote(s)</b><div class="bar gold"><i style="width:${(p.pityLegendary / (E().LEGEND_HARD - 1)) * 100}%"></i></div></div>
            <p class="muted small">A partir do 15.º pacote sem Lendária a probabilidade sobe 15% por pacote. As cartas a mais do máximo viram Poeira Estelar, que serve para criar a carta que quiseres em <b>Baralhos</b>.</p>
            <p class="muted small">Pacotes abertos: ${p.stats.packs}</p>
          </section>
        </div>`;
      root.querySelector('[data-a="open"]').onclick = () => View.open(root);
      const pack = root.querySelector('.pack');
      if (window.gsap) window.gsap.to(pack, { y: -10, rotation: 1.5, duration: 1.6, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    },

    async open(root) {
      let cards;
      try { cards = YC.ProfileStore.update((p) => E().openPack(p)); }
      catch (err) { YC.UI.toast(err.message, true); return; }
      YC.Sound.init();
      await View.ceremony(cards);
      View.render(root);
    },

    async ceremony(cards) {
      const FX = YC.FX, g = window.gsap;
      const order = YC.Cards.RARITY;
      const best = cards.reduce((b, c) => (order[c.rarity].order > order[b].order ? c.rarity : b), 'COMMON');
      const ov = document.createElement('div');
      ov.className = 'gacha-overlay';
      ov.innerHTML = `<div class="god-rays" style="--ray:${RAY[best]}"></div><div class="gacha-center">${packHTML()}</div><div class="gacha-cards"></div>
        <div class="gacha-btns"><button class="btn ghost" data-a="all" hidden>Revelar todas</button><button class="btn" data-a="done" hidden>Continuar</button></div>`;
      document.body.appendChild(ov);
      const pack = ov.querySelector('.pack'), rays = ov.querySelector('.god-rays');
      const strong = best === 'EPIC' || best === 'LEGENDARY';
      // Ato 1: o pacote entra com squash & stretch e treme
      if (g) {
        await FX.fromTo(pack, { y: 400, scale: 0.4, rotation: -20 }, { y: 0, scale: 1, rotation: 0, duration: 0.6, ease: 'back.out(1.6)' });
        await FX.to(pack, { scaleX: 1.15, scaleY: 0.85, duration: 0.12, yoyo: true, repeat: 1 });
        const shakes = strong ? 14 : 8;
        for (let i = 0; i < shakes; i++) await FX.to(pack, { rotation: (i % 2 ? 1 : -1) * (3 + i * (strong ? 1.1 : 0.6)), x: (i % 2 ? 1 : -1) * (2 + i), duration: 0.05 });
        FX.set(pack, { rotation: 0, x: 0 });
      }
      // Ato 2: raios de luz
      YC.Sound.play(strong ? 'reveal_epic' : 'reveal_rare');
      if (g) { FX.fromTo(rays, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.6 }); g.to(rays, { rotation: 360, duration: 14, repeat: -1, ease: 'none' }); }
      await FX.wait(350);
      // Ato 3: a aba rasga-se
      YC.Sound.play('gacha_tear');
      const flap = pack.querySelector('.pack-flap');
      if (g) await FX.to(flap, { y: -160, x: 90, rotation: 50, opacity: 0, duration: 0.5, ease: 'power2.out' });
      FX.confetti({ particleCount: strong ? 220 : 110, colors: best === 'LEGENDARY' ? ['#FCC934', '#fff3b0', '#FA903E'] : undefined });
      if (g) await FX.to(pack, { y: 260, scale: 0.6, opacity: 0, duration: 0.45, ease: 'back.in(1.4)' });
      pack.remove();
      // Ato 4: as 5 cartas em leque, viradas para baixo
      const row = ov.querySelector('.gacha-cards');
      const els = cards.map((c, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'gacha-slot';
        const el = YC.HoloCard.create(c.id, { size: 'lg', faceDown: true });
        el.classList.add(`glow-${c.rarity}`);
        wrap.appendChild(el);
        row.appendChild(wrap);
        if (g) FX.fromTo(wrap, { y: 300, rotation: (i - 2) * 14, opacity: 0, scale: 0.5 }, { y: 0, rotation: (i - 2) * 3, opacity: 1, scale: 1, duration: 0.55, delay: i * 0.12, ease: 'back.out(1.7)' });
        let shown = false;
        const reveal = async () => {
          if (shown) return; shown = true;
          YC.Sound.play(c.rarity === 'LEGENDARY' ? 'reveal_legend' : c.rarity === 'EPIC' ? 'reveal_epic' : c.rarity === 'RARE' ? 'reveal_rare' : 'card_flip');
          el.classList.remove('face-down');
          if (g) await FX.fromTo(el, { scale: 1 }, { scale: 1.12, duration: 0.55, ease: 'back.out(1.8)', yoyo: true, repeat: 1 });
          if (c.rarity === 'EPIC' || c.rarity === 'LEGENDARY') {
            const r = el.getBoundingClientRect();
            FX.confetti({ particleCount: c.rarity === 'LEGENDARY' ? 160 : 70, spread: 70, origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }, colors: c.rarity === 'LEGENDARY' ? ['#FCC934', '#fff', '#FA903E'] : ['#C58AF9', '#F538A0', '#fff'] });
          }
          const tag = document.createElement('div');
          tag.className = `gacha-tag ${c.dupe ? 'dupe' : c.isNew ? 'new' : ''}`;
          tag.textContent = c.dupe ? `DUPLICADA → +${c.dust} ✨` : c.isNew ? 'NOVA!' : '+1 cópia';
          wrap.appendChild(tag);
          if (g) FX.fromTo(tag, { scale: 0, rotation: -20 }, { scale: 1, rotation: -6, duration: 0.4, ease: 'back.out(3)' });
          if (els.every((x) => x.shown())) { ov.querySelector('[data-a="all"]').hidden = true; ov.querySelector('[data-a="done"]').hidden = false; }
        };
        el.addEventListener('click', reveal);
        return { reveal, shown: () => shown };
      });
      await FX.wait(800);
      const allBtn = ov.querySelector('[data-a="all"]');
      allBtn.hidden = false;
      allBtn.onclick = async () => { for (const e of els) { e.reveal(); await FX.wait(220); } };
      await new Promise((resolve) => { ov.querySelector('[data-a="done"]').onclick = resolve; });
      if (g) await FX.to(ov, { opacity: 0, duration: 0.3 });
      ov.remove();
    }
  };

  View.esc = esc;
  YC.GachaView = View;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
