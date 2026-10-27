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

    show(target, id, { side = 'auto', delay = 80 } = {}) {
      clearTimeout(Zoom.timer);
      if (!id || matchMedia('(hover: none)').matches) return;
      Zoom.timer = setTimeout(() => {
        Zoom.remove();
        const wrap = document.createElement('div');
        wrap.className = 'card-zoom';
        const card = YC.HoloCard.create(id, { size: 'xl', static: true, autoplay: true });
        card.style.setProperty('--cw', `${Zoom.W}px`);
        wrap.appendChild(card);
        document.body.appendChild(wrap);
        const r = target.getBoundingClientRect(), w = Zoom.W, h = w * 1.4, gap = 18;
        let x;
        if (side === 'left' || (side === 'auto' && r.right + gap + w > innerWidth)) x = r.left - gap - w;
        else x = r.right + gap;
        x = Math.max(8, Math.min(innerWidth - w - 8, x));
        const y = Math.max(8, Math.min(innerHeight - h - 8, r.top + r.height / 2 - h / 2));
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
