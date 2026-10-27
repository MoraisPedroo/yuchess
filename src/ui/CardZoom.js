/* CardZoom.js — zoom das cartas ao passar o rato (estilo Hearthstone): mostra a carta grande, legível e
   holográfica ao lado do elemento (Zona, Chain, armadilhas, medalhas). Na mão o zoom é feito no próprio sítio (CSS). */
(function (YC) {
  'use strict';

  const Zoom = {
    el: null,
    timer: 0,
    W: 270,

    attach(target, id, opts = {}) {
      target.addEventListener('mouseenter', () => Zoom.show(target, typeof id === 'function' ? id() : id, opts));
      target.addEventListener('mouseleave', () => Zoom.hide());
      target.addEventListener('pointerdown', () => Zoom.hide());
    },

    /** opts: side ('auto'|'left'|'right'), delay (ms), caption (texto por baixo da carta, ex.: onde ela está),
        width (px), avoid (retângulo que a carta não pode tapar, ex.: a casa marcada no tabuleiro). */
    show(target, id, { side = 'auto', delay = 80, caption = '', width = Zoom.W, avoid = null } = {}) {
      clearTimeout(Zoom.timer);
      if (!id || matchMedia('(hover: none)').matches) return;
      Zoom.timer = setTimeout(() => {
        Zoom.remove();
        const wrap = document.createElement('div');
        wrap.className = 'card-zoom';
        const card = YC.HoloCard.create(id, { size: 'xl', static: true, autoplay: true });
        card.style.setProperty('--cw', `${width}px`);
        wrap.style.width = `${width}px`;
        wrap.appendChild(card);
        if (caption) wrap.insertAdjacentHTML('beforeend', `<div class="cz-cap">📍 ${YC.HoloCard.esc(caption)}</div>`);
        document.body.appendChild(wrap);
        const r = target.getBoundingClientRect(), w = width, h = w * 1.4 + (caption ? 50 : 0), gap = 18;
        let x;
        if (side === 'left' || (side === 'auto' && r.right + gap + w > innerWidth)) x = r.left - gap - w;
        else x = r.right + gap;
        x = Math.max(8, Math.min(innerWidth - w - 8, x));
        let y = Math.max(8, Math.min(innerHeight - h - 8, r.top + r.height / 2 - h / 2));
        // não tapar o que se quer ver (o tabuleiro ou a casa marcada): ao lado dele, por cima ou por baixo
        const hits = (px, py) => avoid && px < avoid.right + 6 && px + w > avoid.left - 6 && py < avoid.bottom + 6 && py + h > avoid.top - 6;
        if (hits(x, y)) {
          const sides = [[avoid.right + gap, y], [avoid.left - gap - w, y]];
          if (side === 'left' || (side === 'auto' && r.left + r.width / 2 < (avoid.left + avoid.right) / 2)) sides.reverse();
          const cand = [...sides, [x, avoid.top - gap - h], [x, avoid.bottom + gap]];
          const ok = cand.find(([px, py]) => px >= 8 && px + w <= innerWidth - 8 && py >= 8 && py + h <= innerHeight - 8);
          if (ok) [x, y] = ok;
        }
        wrap.style.left = `${x}px`; wrap.style.top = `${y}px`;
        Zoom.el = wrap;
        if (window.gsap) window.gsap.fromTo(wrap, { opacity: 0, scale: 0.7, y: 14 }, { opacity: 1, scale: 1, y: 0, duration: 0.26, ease: 'back.out(1.8)' });
      }, delay);
    },

    hide() { clearTimeout(Zoom.timer); Zoom.remove(true); },

    remove(fade) {
      const e = Zoom.el;
      Zoom.el = null;
      if (!e) return;
      if (fade && window.gsap) window.gsap.to(e, { opacity: 0, scale: 0.92, duration: 0.12, onComplete: () => e.remove() });
      else e.remove();
    }
  };

  YC.CardZoom = Zoom;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
