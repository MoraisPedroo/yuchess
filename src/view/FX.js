/* FX.js — efeitos visuais "juicy" com GSAP (com alternativa instantânea se o GSAP não carregar):
   estrelas de banda desenhada (POW!/BAM!/TRAP!), partículas, estilhaços com gravidade, ondas,
   tremor de ecrã, carimbo NEGADO!, relâmpago em zigue-zague, faixas, cartas a voar em curva e confetes. */
(function (YC) {
  'use strict';

  const G = () => (typeof window !== 'undefined' ? window.gsap : null);
  const COLORS = ['#FCC934', '#F538A0', '#12B5CB', '#7B42F6', '#FA903E', '#81C995'];

  function starPath(points, R, r) {
    let d = '';
    for (let i = 0; i < points * 2; i++) {
      const a = (Math.PI * i) / points - Math.PI / 2, rr = i % 2 ? r : R * (0.92 + ((i * 37) % 9) / 60);
      d += `${i ? 'L' : 'M'}${(Math.cos(a) * rr).toFixed(1)} ${(Math.sin(a) * rr).toFixed(1)}`;
    }
    return `${d}Z`;
  }

  function el(cls, parent, html) {
    const e = document.createElement('div');
    e.className = cls;
    if (html) e.innerHTML = html;
    (parent || document.body).appendChild(e);
    return e;
  }

  const FX = {
    speed: 1,
    COLORS,
    starPath,

    wait(ms) { return new Promise((r) => setTimeout(r, ms / FX.speed)); },

    /** gsap.to como promessa. Sem GSAP aplica o estado final. */
    to(target, vars) {
      return new Promise((resolve) => {
        const g = G();
        if (!g || !target) { FX.setFinal(target, vars); resolve(); return; }
        g.to(target, { ...vars, duration: (vars.duration ?? 0.3) / FX.speed, delay: (vars.delay || 0) / FX.speed, onComplete: resolve });
      });
    },

    fromTo(target, from, to) {
      return new Promise((resolve) => {
        const g = G();
        if (!g || !target) { FX.setFinal(target, to); resolve(); return; }
        g.fromTo(target, from, { ...to, duration: (to.duration ?? 0.3) / FX.speed, delay: (to.delay || 0) / FX.speed, onComplete: resolve });
      });
    },

    set(target, vars) { const g = G(); if (g && target) g.set(target, vars); else FX.setFinal(target, vars); },

    setFinal(target, vars) {
      if (!target || !vars) return;
      const list = target.length !== undefined && !target.style ? Array.from(target) : [target];
      for (const t of list) {
        if (!t || !t.style) continue;
        if ('opacity' in vars) t.style.opacity = vars.opacity;
        if ('left' in vars) t.style.left = vars.left;
        if ('top' in vars) t.style.top = vars.top;
      }
    },

    /** Linha do tempo GSAP (thenable). Sem GSAP devolve uma que só chama as funções. */
    timeline() {
      const g = G();
      if (g) return g.timeline({ defaults: { ease: 'power2.out' } }).timeScale(FX.speed);
      const fake = { to: () => fake, fromTo: () => fake, set: () => fake, add: () => fake, call: (fn) => { fn(); return fake; }, then: (r) => Promise.resolve().then(r) };
      return fake;
    },

    size(layer) { return layer ? layer.clientWidth || 400 : 400; },

    burst(layer, x, y, text, { fill = '#FCC934', size = 1, textColor = '#fff', hold = 0.45 } = {}) {
      const b = el('burst', layer, `<svg viewBox="-50 -50 100 100"><path d="${starPath(16, 49, 31)}" fill="${fill}" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>`
        + `<path d="${starPath(16, 34, 22)}" fill="#fff" opacity=".35"/></svg><b style="color:${textColor}">${text}</b>`);
      b.style.left = `${x}%`; b.style.top = `${y}%`; b.style.width = `${26 * size}%`;
      FX.set(b, { xPercent: -50, yPercent: -50, scale: 0, rotation: -40 });
      const tl = FX.timeline();
      tl.to(b, { scale: 1, rotation: 0, duration: 0.32, ease: 'back.out(3)' })
        .to(b, { scale: 1.12, duration: 0.12, yoyo: true, repeat: 1, ease: 'sine.inOut' })
        .to(b, { scale: 0.4, opacity: 0, duration: 0.22, delay: hold, ease: 'back.in(2)' })
        .call(() => b.remove());
      return tl;
    },

    popText(layer, x, y, text, color = '#FCC934') {
      const t = el('pop-text', layer, text);
      t.style.left = `${x}%`; t.style.top = `${y}%`; t.style.color = color;
      FX.set(t, { xPercent: -50, yPercent: -50, scale: 0.3 });
      const tl = FX.timeline();
      tl.to(t, { scale: 1, y: -FX.size(layer) * 0.06, duration: 0.35, ease: 'back.out(2.5)' })
        .to(t, { opacity: 0, y: -FX.size(layer) * 0.12, duration: 0.4, delay: 0.5 })
        .call(() => t.remove());
      return tl;
    },

    particles(layer, x, y, { n = 14, colors = COLORS, spread = 0.13, gravity = true, size = 10, shape = 'dot' } = {}) {
      const W = FX.size(layer), g = G();
      for (let i = 0; i < n; i++) {
        const p = el('particle', layer);
        p.style.left = `${x}%`; p.style.top = `${y}%`;
        const s = size * (0.6 + Math.random() * 0.8);
        p.style.width = p.style.height = `${s}px`;
        p.style.marginLeft = p.style.marginTop = `${-s / 2}px`;
        p.style.background = colors[i % colors.length];
        if (shape === 'star') { p.style.borderRadius = '0'; p.style.clipPath = 'polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)'; p.style.border = 'none'; }
        if (!g) { p.remove(); continue; }
        const a = Math.random() * Math.PI * 2, d = W * spread * (0.4 + Math.random() * 0.8);
        const dur = (0.6 + Math.random() * 0.4) / FX.speed;
        g.to(p, { x: Math.cos(a) * d, duration: dur, ease: 'power2.out' });
        g.to(p, { keyframes: gravity ? [{ y: Math.sin(a) * d - W * 0.05, duration: dur * 0.45, ease: 'power2.out' }, { y: Math.sin(a) * d + W * 0.08, duration: dur * 0.55, ease: 'power2.in' }] : [{ y: Math.sin(a) * d, duration: dur, ease: 'power2.out' }] });
        g.to(p, { opacity: 0, scale: 0.3, rotation: Math.random() * 360, duration: dur * 0.5, delay: dur * 0.55, onComplete: () => p.remove() });
      }
    },

    shards(layer, x, y, color = '#8FE3F0') {
      const W = FX.size(layer), g = G();
      for (let i = 0; i < 8; i++) {
        const s = el('shard', layer);
        s.style.left = `${x}%`; s.style.top = `${y}%`;
        s.style.background = `linear-gradient(135deg, #fff, ${color})`;
        if (!g) { s.remove(); continue; }
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4, d = W * (0.07 + Math.random() * 0.06);
        g.set(s, { xPercent: -50, yPercent: -50, rotation: Math.random() * 180 });
        g.to(s, { x: Math.cos(a) * d * 1.4, rotation: '+=' + (200 + Math.random() * 300), duration: 0.9 / FX.speed, ease: 'power1.out' });
        g.to(s, { keyframes: [{ y: Math.sin(a) * d - W * 0.06, duration: 0.3 / FX.speed, ease: 'power2.out' }, { y: W * 0.18, duration: 0.6 / FX.speed, ease: 'power2.in' }] });
        g.to(s, { opacity: 0, duration: 0.3 / FX.speed, delay: 0.65 / FX.speed, onComplete: () => s.remove() });
      }
    },

    ring(layer, x, y, color = '#FCC934', size = 0.3) {
      const r = el('ring-fx', layer);
      const W = FX.size(layer) * size;
      r.style.left = `${x}%`; r.style.top = `${y}%`; r.style.width = r.style.height = `${W}px`; r.style.setProperty('--c', color);
      return FX.fromTo(r, { scale: 0.15, opacity: 1, xPercent: -50, yPercent: -50 }, { scale: 1.6, opacity: 0, duration: 0.55, ease: 'power2.out' }).then(() => r.remove());
    },

    shake(target, power = 8, times = 6) {
      const g = G();
      if (!g || !target) return Promise.resolve();
      return new Promise((resolve) => {
        const tl = g.timeline({ onComplete: () => { g.set(target, { x: 0, y: 0 }); resolve(); } });
        for (let i = 0; i < times; i++) tl.to(target, { x: (Math.random() - 0.5) * power * 2, y: (Math.random() - 0.5) * power, duration: 0.04, ease: 'none' });
      });
    },

    /** Carimbo NEGADO! (escala 3,5 → 1, rotação −12°). */
    stamp(text = 'NEGADO!', color = '#D93025') {
      const s = el('stamp', document.body, text);
      s.style.color = color; s.style.borderColor = color;
      const tl = FX.timeline();
      tl.fromTo(s, { xPercent: -50, yPercent: -50, scale: 3.5, rotation: 8, opacity: 0 }, { scale: 1, rotation: -12, opacity: 1, duration: 0.32, ease: 'expo.in' })
        .call(() => { YC.Sound && YC.Sound.play('negate_stamp'); FX.shake(document.getElementById('match-stage') || document.body, 12, 6); })
        .to(s, { scale: 1.05, duration: 0.08, yoyo: true, repeat: 1 })
        .to(s, { opacity: 0, scale: 0.9, duration: 0.3, delay: 0.55 })
        .call(() => s.remove());
      return tl;
    },

    /** Relâmpago em zigue-zague entre dois retângulos do ecrã. */
    lightning(a, b, color = '#FCC934') {
      const svgNS = 'http://www.w3.org/2000/svg';
      const wrap = document.createElementNS(svgNS, 'svg');
      wrap.setAttribute('class', 'bolt-fx');
      wrap.setAttribute('width', '100%'); wrap.setAttribute('height', '100%');
      const x1 = a.left + a.width / 2, y1 = a.top + a.height / 2, x2 = b.left + b.width / 2, y2 = b.top + b.height / 2;
      let pts = `${x1},${y1}`;
      const n = 9;
      for (let i = 1; i < n; i++) {
        const t = i / n, nx = -(y2 - y1), ny = x2 - x1, len = Math.hypot(nx, ny) || 1;
        const off = (i % 2 ? 1 : -1) * (14 + Math.random() * 16);
        pts += ` ${x1 + (x2 - x1) * t + (nx / len) * off},${y1 + (y2 - y1) * t + (ny / len) * off}`;
      }
      pts += ` ${x2},${y2}`;
      wrap.innerHTML = `<polyline points="${pts}" fill="none" stroke="#111" stroke-width="13" stroke-linejoin="round"/>`
        + `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="7" stroke-linejoin="round" style="filter:drop-shadow(0 0 8px ${color})"/>`;
      document.body.appendChild(wrap);
      const tl = FX.timeline();
      tl.fromTo(wrap, { opacity: 0 }, { opacity: 1, duration: 0.05, repeat: 3, yoyo: true }).to(wrap, { opacity: 0, duration: 0.25, delay: 0.25 }).call(() => wrap.remove());
      return tl;
    },

    /** Faixa grande a atravessar o ecrã (vez, xeque, fim). */
    banner(text, { sub = '', color = '#FCC934', hold = 0.75, parent } = {}) {
      const b = el('banner', parent || document.body, `<div class="banner-band" style="--c:${color}"><b>${text}</b>${sub ? `<small>${sub}</small>` : ''}</div>`);
      const band = b.firstChild;
      const tl = FX.timeline();
      tl.fromTo(band, { xPercent: -120, skewX: -18 }, { xPercent: 0, skewX: -8, duration: 0.42, ease: 'back.out(1.6)' })
        .to(band, { xPercent: 4, duration: hold, ease: 'none' })
        .to(band, { xPercent: 130, skewX: -18, duration: 0.35, ease: 'back.in(1.4)' })
        .call(() => b.remove());
      return tl;
    },

    /** Carta a voar em curva (bezier quadrática) entre dois retângulos do ecrã. */
    flyCard(cardEl, from, to, { duration = 0.6, spin = 0, endScale = null, arc = 0.35 } = {}) {
      const g = G();
      const w0 = from.width, w1 = to.width;
      cardEl.style.position = 'fixed'; cardEl.style.left = '0'; cardEl.style.top = '0'; cardEl.style.zIndex = 70; cardEl.style.pointerEvents = 'none';
      cardEl.style.setProperty('--cw', `${w0}px`);
      document.body.appendChild(cardEl);
      const p0 = { x: from.left, y: from.top }, p2 = { x: to.left + (to.width - w0) / 2, y: to.top + (to.height - w0 * 1.4) / 2 };
      const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - Math.abs(p2.x - p0.x) * arc - 60 };
      const s1 = endScale != null ? endScale : w1 / w0;
      const place = (t) => {
        const u = 1 - t;
        const x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
        const s = 1 + (s1 - 1) * t;
        cardEl.style.transform = `translate(${x}px, ${y}px) scale(${s}) rotate(${spin * t}deg)`;
        cardEl.style.transformOrigin = '50% 50%';
      };
      place(0);
      if (!g) { place(1); return Promise.resolve(cardEl); }
      const proxy = { t: 0 };
      return new Promise((resolve) => g.to(proxy, { t: 1, duration: duration / FX.speed, ease: 'power2.inOut', onUpdate: () => place(proxy.t), onComplete: () => resolve(cardEl) }));
    },

    confetti(opts = {}) {
      if (typeof window === 'undefined' || !window.confetti) return;
      window.confetti({ particleCount: 140, spread: 95, startVelocity: 42, origin: { y: 0.55 }, colors: COLORS, scalar: 1.1, ...opts });
    }
  };

  YC.FX = FX;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
