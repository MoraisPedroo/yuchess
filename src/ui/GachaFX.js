/* GachaFX.js — efeitos da abertura do pacote (usados pelo GachaView).
   Aura de raridade nas cartas de costas ao passar o rato (antes de virar): Comum só um contorno claro, Rara brilho
   azul com faíscas a subir, Épica brilho roxo com raios a rodar e a carta a levitar, Lendária a arder em dourado
   (línguas de fogo à volta, raios duplos, estrelas a subir, a carta a tremer e o fundo a aquecer), cada uma com som.
   E as peças das revelações: faíscas, anéis de choque, raios, clarão, reflexo na face, carga, confetes e carimbo. */
(function (YC) {
  'use strict';

  const G = () => window.gsap;
  const calm = () => YC.reducedMotion();
  const rnd = (a, b) => a + Math.random() * (b - a);
  const MOTES = { COMMON: 0, RARE: 7, EPIC: 12, LEGENDARY: 18 };
  const HEAT = { EPIC: 'rgba(147, 51, 234, .16)', LEGENDARY: 'rgba(255, 183, 3, .24)' };

  /** Línguas de fogo da Lendária: pontos do contorno da carta (em --cw), viradas para fora e um pouco para cima. */
  function flames() {
    const pts = [];
    for (let i = 0; i < 5; i++) pts.push([-0.4 + i * 0.2, -0.64]);
    for (let i = 0; i < 4; i++) { const y = -0.5 + i * 0.34; pts.push([-0.45, y], [0.45, y]); }
    for (let i = 0; i < 3; i++) pts.push([-0.3 + i * 0.3, 0.64]);
    return pts.map(([x, y]) => {
      const a = Math.atan2(x / 0.5, -(y / 0.7 - 0.9)) * 180 / Math.PI;
      return `<i style="translate:calc(var(--cw) * ${x.toFixed(2)}) calc(var(--cw) * ${y.toFixed(2)});rotate:${a.toFixed(0)}deg;`
        + `animation-delay:${(-rnd(0, 0.5)).toFixed(2)}s;--fs:${rnd(0.85, 1.25).toFixed(2)}"></i>`;
    }).join('');
  }

  function auraHTML(R) {
    const big = R === 'EPIC' || R === 'LEGENDARY';
    return `<div class="gx-aura gx-${R}">${big ? '<i class="gx-rays"></i>' : ''}${R === 'LEGENDARY' ? '<i class="gx-rays b"></i>' : ''}`
      + `<i class="gx-glow"></i>${R === 'LEGENDARY' ? `<span class="gx-flames">${flames()}</span>` : ''}</div>`;
  }

  function frontHTML(R) {
    let m = '';
    for (let i = 0; i < MOTES[R]; i++) {
      m += `<i style="--x:${rnd(-0.6, 0.6).toFixed(2)};--d:${(-rnd(0, 2.2)).toFixed(2)}s;--t:${rnd(1.3, 2.3).toFixed(2)}s;--s:${rnd(0.6, 1.25).toFixed(2)}"></i>`;
    }
    return m ? `<div class="gx-front gx-${R}">${m}</div>` : '';
  }

  /** Põe a aura e as faíscas na carta de costas e liga o "passar o rato" (com o som da raridade). */
  function attach(slot, ov) {
    const { el, c } = slot, R = c.rarity;
    el.insertAdjacentHTML('afterbegin', auraHTML(R));
    el.insertAdjacentHTML('beforeend', frontHTML(R));
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'touch' || slot.shown || slot.busy || !el.classList.contains('face-down')) return;
      hot(slot, ov, true);
      const now = performance.now();
      if (!slot.hoverT || now - slot.hoverT > 900) { slot.hoverT = now; YC.Sound.play(`hover_${R.toLowerCase()}`); }
    });
    el.addEventListener('pointerleave', () => { if (!slot.busy && !slot.shown) hot(slot, ov, false); });
  }

  /** Acende/apaga a aura de uma carta (e o fundo aquece nas Épicas e Lendárias). */
  function hot(slot, ov, on) {
    slot.el.classList.toggle('gx-hot', on);
    const heat = HEAT[slot.c.rarity];
    if (!heat) return;
    if (on) ov.style.setProperty('--heat', heat);
    ov.classList.toggle('gx-heat', on);
  }

  /** Elemento por trás das cartas (anéis, raios), para não tapar a face que acabou de virar. */
  function under(ov, node) {
    const ref = ov.querySelector('.gacha-cards');
    if (ref) ov.insertBefore(node, ref); else ov.appendChild(node);
    return node;
  }

  function disc(cls, x, y, size, css = '') {
    const d = document.createElement('i');
    d.className = cls;
    d.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;${css}`;
    return d;
  }

  const FX = {
    attach, hot,

    /** Faíscas de vinil (estrelas e quadrados com contorno) numa explosão curta, em coordenadas do ecrã. */
    sparks(parent, x, y, color, n, spread = 160) {
      const g = G();
      if (!g || calm()) return;
      for (let i = 0; i < n; i++) {
        const s = document.createElement('i');
        const star = i % 3 === 0;
        s.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:${star ? 14 : 9}px;height:${star ? 14 : 9}px;margin:-7px 0 0 -7px;z-index:6;pointer-events:none;`
          + (star ? `background:${color};clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%)`
            : `background:${color};border:2px solid #0F141C;border-radius:3px`);
        parent.appendChild(s);
        const a = Math.random() * Math.PI * 2, d = spread * (0.45 + Math.random() * 0.75);
        g.fromTo(s, { x: 0, y: 0, scale: 1.2, rotation: 0 }, { x: Math.cos(a) * d, y: Math.sin(a) * d + 30, scale: 0.2, rotation: 200 + Math.random() * 200, duration: 0.42 + Math.random() * 0.25, ease: 'expo.out', onComplete: () => s.remove() });
      }
    },

    /** Tremor curto (nunca dos botões), amortecido: 6 abanões a diminuir. */
    shake(el, px) {
      const g = G();
      if (!g || !px || calm()) return;
      const tl = g.timeline({ onComplete: () => g.set(el, { x: 0, y: 0 }) });
      for (let i = 0; i < 6; i++) {
        const k = px * (1 - i / 6);
        tl.to(el, { x: (i % 2 ? 1 : -1) * k, y: (Math.random() - 0.5) * k, duration: 0.03, ease: 'none' });
      }
      tl.to(el, { x: 0, y: 0, duration: 0.04 });
    },

    /** Anel de choque que cresce e desaparece. */
    ring(ov, x, y, color, size = 300, dur = 0.5, w = 6) {
      const g = G();
      if (!g || calm()) return;
      const r = under(ov, disc('gx-ring', x, y, size, `border-width:${w}px;--c:${color}`));
      g.fromTo(r, { scale: 0.15, opacity: 1 }, { scale: 1, opacity: 0, duration: dur, ease: 'expo.out', onComplete: () => r.remove() });
    },

    /** Estrela de raios por trás da carta, a abrir e a rodar. */
    burst(ov, x, y, color, size = 560, dur = 0.8) {
      const g = G();
      if (!g || calm()) return;
      const b = under(ov, disc('gx-burst', x, y, size, `--c:${color}`));
      g.fromTo(b, { scale: 0.3, rotation: 0, opacity: 1 }, { scale: 1.15, rotation: 50, opacity: 0, duration: dur, ease: 'power2.out', onComplete: () => b.remove() });
    },

    /** Clarão radial no ecrã inteiro. */
    flash(ov, color, peak = 0.6, dur = 0.45) {
      const g = G();
      if (!g || calm()) return;
      const f = document.createElement('i');
      f.className = 'gx-flash';
      f.style.setProperty('--c', color);
      ov.appendChild(f);
      g.fromTo(f, { opacity: peak }, { opacity: 0, duration: dur, ease: 'power2.out', onComplete: () => f.remove() });
    },

    /** Reflexo de luz que atravessa a face da carta. */
    shine(el) {
      const face = el.querySelector('.hc-face');
      if (!face || calm()) return;
      const s = document.createElement('i');
      s.className = 'gx-shine';
      face.appendChild(s);
      setTimeout(() => s.remove(), 900);
    },

    /** Carga: pontos de luz sugados para a carta. */
    implode(ov, x, y, color, n = 14, dur = 0.4, spread = 220) {
      const g = G();
      if (!g || calm()) return;
      for (let i = 0; i < n; i++) {
        const p = document.createElement('i');
        p.className = 'gx-dot';
        p.style.cssText = `left:${x}px;top:${y}px;--c:${color}`;
        ov.appendChild(p);
        const a = Math.random() * Math.PI * 2, d = spread * rnd(0.55, 1);
        g.fromTo(p, { x: Math.cos(a) * d, y: Math.sin(a) * d, opacity: 0, scale: 1.3 },
          { x: 0, y: 0, opacity: 1, scale: 0.3, duration: dur * rnd(0.7, 1), delay: rnd(0, dur * 0.3), ease: 'power2.in', onComplete: () => p.remove() });
      }
    },

    /** Chuva de confetes de vinil (retângulos com contorno e estrelas) do topo do ecrã. */
    rain(ov, colors, n = 60, dur = 1.8) {
      const g = G();
      if (!g || calm()) return;
      for (let i = 0; i < n; i++) {
        const p = document.createElement('i');
        const w = rnd(9, 15), star = i % 4 === 0;
        p.className = `gx-confetti${star ? ' star' : ''}`;
        p.style.cssText = `left:${rnd(0, innerWidth)}px;width:${w}px;height:${star ? w : w * rnd(0.45, 0.7)}px;background:${colors[i % colors.length]}`;
        ov.appendChild(p);
        g.to(p, { y: innerHeight + 60, x: rnd(-90, 90), rotation: rnd(-540, 540), rotationX: rnd(0, 720), duration: dur * rnd(0.75, 1.25), delay: rnd(0, dur * 0.45), ease: 'power1.in', onComplete: () => p.remove() });
      }
    },

    /** Carimbo ("LENDÁRIA!", "ÉPICA!"). Com x/y fica com o fundo em (x, y) — por cima da carta — sem sair do ecrã;
        sem eles fica no topo ao centro. Desaparece sozinho depois de `hold` ms. */
    stamp(ov, text, { cls = '', sub = '', x = null, y = null, hold = 900 } = {}) {
      const g = G();
      const s = document.createElement('div');
      s.className = `legend-stamp ${cls}${x != null ? ' at' : ''}`;
      s.innerHTML = `${text}${sub ? `<small>${YC.HoloCard.esc(sub)}</small>` : ''}`;
      ov.appendChild(s);
      if (x != null) { s.style.left = `${x}px`; s.style.top = `${Math.max(y, s.offsetHeight + 8)}px`; }
      if (!g) { setTimeout(() => s.remove(), hold); return s; }
      g.fromTo(s, { scale: 2.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.14, ease: 'power3.in' });
      g.to(s, { opacity: 0, y: -20, duration: 0.22, delay: hold / 1000, onComplete: () => s.remove() });
      return s;
    }
  };

  YC.GachaFX = FX;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
