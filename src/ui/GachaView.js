/* GachaView.js — Loja: pacotinho de 5 cartas por 100 de ouro (pacote de foil com medalhão do cavalo) e a abertura
   em ritual tátil (docs/DIRECAO-DE-ARTE.md, secção Pacote): o pacote voa para o centro a rodar e achata; uma costura
   tracejada com uma faísca na cor da melhor raridade; rasgar (clique ou arrastar) → pausa de impacto de 90 ms → a
   aba voa e o invólucro cai com faíscas; 5 cartas de costas em leque (as mais raras no fim; ao passar o rato no verso
   acende-se a aura da raridade, GachaFX); revelar uma a uma com escalada por raridade (Comum rápida … Lendária com carimbo "LENDÁRIA!", vídeo e chuva dourada); "Revelar tudo". */
(function (YC) {
  'use strict';

  const E = () => YC.Economy;
  const RAY = { COMMON: '#F8FAFC', RARE: '#00B4D8', EPIC: '#9333EA', LEGENDARY: '#FFB703' };
  const RANK = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3 };
  const esc = (s) => YC.HoloCard.esc(s);
  const G = () => window.gsap;
  const calm = () => YC.reducedMotion();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const tw = (el, vars) => new Promise((res) => (G() ? G().to(el, { ...vars, onComplete: res }) : res()));
  const backUrl = () => (YC.ART && YC.ART.cardBack ? YC.asset(YC.ART.cardBack) : '');
  const packHTML = (cls = '') => `<div class="pack ${cls}"><div class="pack-fin top"></div><div class="pack-body">`
    + `<div class="pack-medal" style="background-image:url('${backUrl()}')"></div><div class="pack-title">Chess-Gi-Oh!</div><div class="pack-ribbon">5 CARTAS</div><div class="pack-shine"></div>`
    + `</div><div class="pack-fin bottom"></div></div>`;

  // faíscas, tremor, anéis, raios, clarão, confetes e a aura das cartas de costas: GachaFX.js
  const F = () => YC.GachaFX;
  const sparks = (...a) => F().sparks(...a);
  const shake = (...a) => F().shake(...a);

  const View = {
    render(root) {
      const p = YC.ProfileStore.profile, I = (n, o) => YC.Icon(n, o), D = I('dust', { size: 16 });
      const epicIn = Math.max(1, E().EPIC_PITY + 1 - p.pityEpic);
      const legIn = Math.max(1, E().LEGEND_HARD - p.pityLegendary);
      const can = p.gold >= E().PACK_COST;
      root.innerHTML = `
        <div class="shop">
          <section class="shop-pack">
            <div class="pack-stage">${packHTML('idle')}</div>
            <button class="btn big" data-a="open" ${can ? '' : 'disabled'}>Abrir pacotinho <span class="coin-pill gold">${I('coin')}${E().PACK_COST}</span></button>
            <p class="muted">${can ? `Tens ${p.gold} de ouro: dá para ${Math.floor(p.gold / E().PACK_COST)} pacote(s).` : `Faltam ${E().PACK_COST - p.gold} de ouro: ganha partidas para receber mais.`}</p>
          </section>
          <section class="panel shop-info">
            <div class="panel-head">${I('chest')}<h2>Probabilidades</h2></div>
            <table class="rates"><tr><th></th><th>Cartas 1–4</th><th>Carta 5</th><th>Cópias</th><th>Duplicada</th></tr>
              <tr class="r-c"><td>${I('gemCommon', { size: 16 })}Comum</td><td>65%</td><td>—</td><td>2</td><td>+10 ${D}</td></tr>
              <tr class="r-r"><td>${I('gemRare', { size: 16 })}Rara</td><td>25%</td><td>78%</td><td>2</td><td>+30 ${D}</td></tr>
              <tr class="r-e"><td>${I('gemEpic', { size: 16 })}Épica</td><td>8%</td><td>18%</td><td>2</td><td>+100 ${D}</td></tr>
              <tr class="r-l"><td>${I('crown', { size: 16 })}Lendária</td><td>2%</td><td>4%</td><td>1</td><td>+300 ${D}</td></tr></table>
            <h2>Garantias</h2>
            <div class="pity"><span>Épica garantida em</span><b>${epicIn} pacote(s)</b><div class="bar"><i style="width:${(p.pityEpic / E().EPIC_PITY) * 100}%"></i></div></div>
            <div class="pity"><span>Lendária garantida em</span><b>${legIn} pacote(s)</b><div class="bar gold"><i style="width:${(p.pityLegendary / (E().LEGEND_HARD - 1)) * 100}%"></i></div></div>
            <p class="muted small">A partir do 15.º pacote sem Lendária a probabilidade sobe 15% por pacote. As cartas a mais do máximo viram Poeira Estelar, que serve para criar a carta que quiseres em <b>Baralhos</b>.</p>
            <p class="muted small">Pacotes abertos: ${p.stats.packs}</p>
          </section>
        </div>`;
      root.querySelector('[data-a="open"]').onclick = () => View.open(root);
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
      const g = G(), S = (n) => YC.Sound.play(n);
      const best = cards.reduce((b, c) => (RANK[c.rarity] > RANK[b] ? c.rarity : b), 'COMMON');
      const color = RAY[best];
      const ov = document.createElement('div');
      ov.className = 'gacha-overlay';
      ov.style.setProperty('--ray', color);
      ov.innerHTML = `<div class="god-rays"></div><div class="gacha-center">${packHTML()}<div class="rip-line"></div><div class="rip-spark"></div></div>
        <div class="rip-hint">${YC.Icon('arrow', { size: 20 })}Clica ou arrasta pela costura para rasgar</div>
        <div class="gacha-cards"></div>
        <div class="gacha-btns"><button class="btn secondary" data-a="all" hidden>Revelar tudo</button><button class="btn" data-a="done" hidden>Continuar</button></div>`;
      document.body.appendChild(ov);
      const center = ov.querySelector('.gacha-center'), pack = ov.querySelector('.pack'), rays = ov.querySelector('.god-rays');
      const line = ov.querySelector('.rip-line'), spark = ov.querySelector('.rip-spark'), hint = ov.querySelector('.rip-hint');

      // 1) antecipação: escurece, o pacote voa para o centro a dar uma volta e achata ao aterrar
      if (g) {
        g.fromTo(ov, { opacity: 0 }, { opacity: 1, duration: 0.2 });
        await tw(pack, { startAt: { y: 320, scale: 0.55, rotationY: 0 }, y: 0, scale: 1, rotationY: calm() ? 0 : 360, duration: 0.36, ease: 'expo.out' });
        S('hop');
        await tw(pack, { scaleX: 1.08, scaleY: 0.92, duration: 0.06, ease: 'power2.out' });
        await tw(pack, { scaleX: 1, scaleY: 1, duration: 0.12, ease: 'power2.out' });
      }
      // a costura com a faísca da cor da melhor carta (o primeiro aviso do que vem)
      if (g) {
        g.to([line, hint], { opacity: 1, duration: 0.2 });
        g.fromTo(spark, { opacity: 1, x: 6 }, { x: 214, duration: 0.9, ease: 'sine.inOut', repeat: -1, yoyo: true });
        g.to(pack, { y: -6, duration: 1.4, ease: 'sine.inOut', repeat: -1, yoyo: true });
      }
      const qx = g && g.quickTo(pack, 'rotationY', { duration: 0.3, ease: 'power3' }), qy = g && g.quickTo(pack, 'rotationX', { duration: 0.3, ease: 'power3' });
      const tilt = (e) => { if (!qx) return; const r = center.getBoundingClientRect(); qx(((e.clientX - r.left) / r.width - 0.5) * 22); qy(-((e.clientY - r.top) / r.height - 0.5) * 14); };
      ov.addEventListener('pointermove', tilt);

      // 2) rasgar: clique (corte automático em 320 ms) ou arrastar ao longo da costura
      await new Promise((done) => {
        let x0 = null, ripped = false;
        const finish = () => { if (ripped) return; ripped = true; done(); };
        pack.style.cursor = 'grab';
        pack.addEventListener('pointerdown', (e) => { x0 = e.clientX; pack.setPointerCapture(e.pointerId); });
        pack.addEventListener('pointermove', (e) => {
          if (x0 == null || !g) return;
          const k = Math.min(1, Math.max(0, (e.clientX - x0) / 180));
          g.set(spark, { x: 6 + k * 208 });
          if (k >= 0.95) finish();
        });
        pack.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) < 12) finish(); x0 = null; });
        pack.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') finish(); });
        pack.tabIndex = 0;
      });
      ov.removeEventListener('pointermove', tilt);
      S('gacha_tear');
      if (g) {
        g.killTweensOf([spark, pack]);
        g.to(hint, { opacity: 0, duration: 0.15 });
        g.set(pack, { rotationX: 0, rotationY: 0, y: 0 });
        // o corte corre a costura e o pacote vibra cada vez mais
        const vib = { k: 0 };
        await tw(vib, { k: 1, duration: calm() ? 0.01 : 0.32, ease: 'power1.in', onUpdate: () => { g.set(spark, { x: 6 + vib.k * 208 }); g.set(pack, { x: (Math.random() - 0.5) * (2 + vib.k * 8) }); } });
        g.set(pack, { x: 0 });
      }
      // pausa de impacto (hit-stop): tudo parado 90 ms
      await wait(90);
      // a aba de cima voa, o invólucro cai; faíscas e tremor conforme a melhor carta
      const top = pack.cloneNode(true);
      top.classList.add('pack-top');
      center.appendChild(top);
      top.style.cssText = 'position:absolute;inset:0;margin:auto;clip-path:inset(0 0 calc(100% - 46px) 0)';
      pack.style.clipPath = 'inset(46px 0 0 0)';
      g && g.set([line, spark], { opacity: 0 });
      const r = pack.getBoundingClientRect();
      const n = { COMMON: 12, RARE: 12, EPIC: 24, LEGENDARY: 40 }[best];
      sparks(ov, r.left + r.width / 2, r.top + 46, color, n, best === 'LEGENDARY' ? 260 : 170);
      shake(center, { COMMON: 0, RARE: 0, EPIC: 5, LEGENDARY: 9 }[best]);
      S(best === 'LEGENDARY' || best === 'EPIC' ? 'reveal_epic' : 'reveal_rare');
      if (g) {
        if (best === 'LEGENDARY') g.fromTo(rays, { opacity: 0, scale: 0.4 }, { opacity: 0.9, scale: 1, duration: 0.5, ease: 'expo.out' });
        else if (best !== 'COMMON') g.fromTo(rays, { opacity: 0, scale: 0.4 }, { opacity: 0.55, scale: 1, duration: 0.5, ease: 'expo.out' });
        g.to(rays, { rotation: 360, duration: 24, repeat: -1, ease: 'none' });
        g.to(top, { y: -140, rotation: 18, x: 40, opacity: 0, duration: 0.42, ease: 'power2.out' });
        await tw(pack, { y: 320, opacity: 0, duration: 0.4, ease: 'power2.in' });
      }
      pack.remove(); top.remove();

      // 3) as 5 cartas de costas, em leque; as mais raras ficam para o fim (posições 4 e 5)
      const order = cards.map((c, i) => ({ c, i })).sort((a, b) => RANK[a.c.rarity] - RANK[b.c.rarity] || a.i - b.i).map((x) => x.c);
      const row = ov.querySelector('.gacha-cards');
      const slots = order.map((c, i) => {
        const wrap = document.createElement('div');
        wrap.className = 'gacha-slot';
        const el = YC.HoloCard.create(c.id, { size: 'lg', faceDown: true, autoplay: c.rarity === 'LEGENDARY' });
        el.classList.add(`glow-${c.rarity}`);
        wrap.appendChild(el);
        row.appendChild(wrap);
        if (g) g.fromTo(wrap, { y: 260, rotation: (i - 2) * 12, opacity: 0, scale: 0.6 }, { y: 0, rotation: (i - 2) * 2.5, opacity: 1, scale: 1, duration: 0.44, delay: i * 0.065, ease: 'expo.out' });
        setTimeout(() => S('card_flip'), i * 65);
        const slot = { c, el, wrap, shown: false };
        F().attach(slot, ov);                  // aura da raridade ao passar o rato no verso
        el.addEventListener('click', () => View.reveal(slot, ov, slots));
        return slot;
      });
      await wait(450);
      const allBtn = ov.querySelector('[data-a="all"]'), doneBtn = ov.querySelector('[data-a="done"]');
      allBtn.hidden = false;
      allBtn.onclick = async () => {
        allBtn.hidden = true;
        for (const s of slots) { if (s.shown) continue; await View.reveal(s, ov, slots, true); }
      };
      await new Promise((resolve) => { doneBtn.onclick = resolve; View.onAllShown = () => { allBtn.hidden = true; doneBtn.hidden = false; }; });
      if (g) await tw(ov, { opacity: 0, duration: 0.16 });
      ov.remove();
    },

    /** Revela uma carta com a coreografia da sua raridade. fast: dentro do "Revelar tudo". */
    async reveal(slot, ov, slots, fast) {
      if (slot.shown || slot.busy) return;
      slot.busy = true;
      const g = G(), { c, el, wrap } = slot, tilt = el.querySelector('.hc-tilt'), S = (n) => YC.Sound.play(n);
      const flip = (ms) => { tilt.style.transition = `transform ${ms}ms var(--ease-out-snappy)`; el.classList.remove('face-down'); setTimeout(() => { tilt.style.transition = ''; }, ms + 20); };
      const at = () => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
      const R = c.rarity, col = RAY[R], w = el.getBoundingClientRect().width, fx = F();
      if (!g || calm()) { flip(120); }
      else if (R === 'COMMON') {
        fx.hot(slot, ov, false);
        S('card_flip');
        await tw(el, { y: -12, duration: 0.07 });
        flip(200); await wait(200);
        fx.ring(ov, ...at(), '#F8FAFC', w * 1.7, 0.42, 4);
        fx.shine(el);
        await tw(el, { y: 0, duration: 0.08 });
      } else if (R === 'RARE') {
        // a aura azul acende, a carta salta e vira com um anel e faíscas
        fx.hot(slot, ov, true);
        S('reveal_rare');
        await tw(el, { y: -20, scale: 1.08, duration: 0.14, ease: 'power2.out' });
        flip(240); await wait(240);
        fx.ring(ov, ...at(), col, w * 2.2, 0.5, 6);
        sparks(ov, ...at(), col, 12, 140);
        fx.shine(el);
        await tw(el, { y: 0, scale: 1, duration: 0.16, ease: 'power2.out' });
      } else if (R === 'EPIC') {
        // carga roxa (a luz é sugada e a carta encolhe a tremer) → salta, vira, raios, dois anéis e "ÉPICA!"
        fx.hot(slot, ov, true);
        S('charge');
        fx.implode(ov, ...at(), col, 16, 0.34, w * 1.3);
        await tw(el, { scale: 0.9, duration: fast ? 0.18 : 0.32, ease: 'power2.in', onUpdate: () => g.set(el, { x: (Math.random() - 0.5) * 7 }) });
        S('reveal_epic');
        g.to(el, { x: 0, scale: 1.2, y: -18, duration: 0.2, ease: 'expo.out' });
        flip(190); await wait(190);
        await wait(60);                       // hit-stop
        const [x, y] = at();
        fx.burst(ov, x, y, col, w * 3.6, 0.85);
        fx.ring(ov, x, y, col, w * 2.6, 0.55, 7);
        setTimeout(() => fx.ring(ov, x, y, '#E9D5FF', w * 1.9, 0.45, 4), 90);
        fx.flash(ov, 'rgba(168, 85, 247, .45)', 0.6, 0.35);
        sparks(ov, x, y, col, 26, 180);
        shake(ov.querySelector('.gacha-cards'), 5);
        fx.shine(el);
        fx.stamp(ov, 'ÉPICA!', { cls: 'epic', x, y: y - w * 0.95, hold: fast ? 350 : 650 });
        await tw(el, { scale: 1, y: 0, duration: 0.3, ease: 'power3.out' });
      } else {
        // Lendária: a carta arde e treme no lugar (a luz dourada é sugada), voa para o centro, vira com clarão,
        // raios gigantes, anéis, carimbo com o nome, faíscas, tremor e chuva de confetes dourados
        fx.hot(slot, ov, true);
        const rays = ov.querySelector('.god-rays');
        S('hover_legendary');
        fx.implode(ov, ...at(), col, 24, 0.45, w * 1.5);
        await tw(el, { scale: 0.94, duration: fast ? 0.22 : 0.5, ease: 'power1.in', onUpdate: () => g.set(el, { x: (Math.random() - 0.5) * 8, rotation: (Math.random() - 0.5) * 3 }) });
        g.to(rays, { opacity: 1, duration: 0.26 });
        const [cx, cy] = at();
        const dx = innerWidth / 2 - cx + g.getProperty(el, 'x'), dy = innerHeight / 2 - cy + g.getProperty(el, 'y');
        wrap.style.zIndex = 5;
        await tw(el, { x: dx, y: dy, scale: 1.15, rotation: 0, duration: 0.3, ease: 'power3.inOut' });
        S('reveal_legend');
        g.to(el, { scale: 1.4, duration: 0.24, ease: 'expo.out' });
        flip(240); await wait(240);
        const X = innerWidth / 2, Y = innerHeight / 2;
        fx.flash(ov, 'rgba(255, 236, 170, .95)', 0.8, 0.55);
        fx.burst(ov, X, Y, col, Math.max(innerWidth, innerHeight) * 0.9, 1.2);
        fx.ring(ov, X, Y, col, w * 3.4, 0.65, 9);
        setTimeout(() => fx.ring(ov, X, Y, '#FFF3B0', w * 2.4, 0.5, 5), 110);
        fx.stamp(ov, 'LENDÁRIA!', { sub: c.name, x: X, y: el.getBoundingClientRect().top - 10, hold: fast ? 700 : 1300 });
        await wait(80);                       // hit-stop
        sparks(ov, X, Y, col, 44, 320);
        shake(ov, 9);
        fx.shine(el);
        fx.rain(ov, ['#FFB703', '#FFD166', '#FFF3B0', '#F8FAFC', '#FB8500'], fast ? 40 : 70, 1.8);
        await wait(fast ? 800 : 1500);
        await tw(el, { x: 0, y: 0, scale: 1, duration: 0.42, ease: 'power3.out' });
        wrap.style.zIndex = '';
      }
      fx.hot(slot, ov, false);
      el.classList.add('gx-done');            // fica um brilho calmo da raridade por trás da carta revelada
      const tag = document.createElement('div');
      tag.className = `gacha-tag ${c.dupe ? 'dupe' : c.isNew ? 'new' : ''}`;
      tag.innerHTML = c.dupe ? `Duplicada: +${c.dust} ${YC.Icon('dust', { size: 16 })}` : c.isNew ? `${YC.Icon('star', { size: 16 })}Nova!` : '+1 cópia';
      wrap.appendChild(tag);
      if (g) g.fromTo(tag, { scale: 0, rotation: -12 }, { scale: 1, rotation: -4, duration: 0.24, ease: 'back.out(2.4)' });
      slot.shown = true; slot.busy = false;
      if (fast && R !== 'LEGENDARY') await wait(90 - 60);
      if (slots.every((s) => s.shown) && View.onAllShown) View.onAllShown();
    }
  };

  View.esc = esc;
  YC.GachaView = View;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
