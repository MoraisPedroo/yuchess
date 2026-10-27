/* ItemToken.js — a carta "vira objeto": ficha flutuante com a ilustração do objeto da carta (a bomba, as botas…),
   sombra no chão e aura na cor da carta. Usa o PNG de assets/items/ quando existe (arte gerada) e, senão, o
   SVG de CardArt. Serve ao arrastar cartas (MatchDrag) e nas animações de equipar/armar (Anim3DCards). */
(function (YC) {
  'use strict';

  const G = () => window.gsap;
  const speed = () => (YC.FX && YC.FX.speed) || 1;

  const Item = {
    /** Ícones (theme.icon) com imagem em assets/items/<icon em minúsculas>.png. */
    IMG: new Set(YC.ITEM_ART || []),

    /** URL da imagem do objeto (ou null se só houver o SVG). No ficheiro único do build vem embutida. */
    src(def) {
      const icon = def.theme.icon;
      if (!Item.IMG.has(icon)) return null;
      return (YC.ITEM_ART_DATA && YC.ITEM_ART_DATA[icon]) || `assets/items/${icon.toLowerCase()}.png`;
    },

    art(def) {
      const u = Item.src(def);
      return u ? `<img class="it-img" src="${u}" alt="" draggable="false">` : `<div class="it-svg">${YC.CardArt.svg(def)}</div>`;
    },

    /** Ilustração dentro da carta: a imagem do objeto se existir, senão o SVG. */
    cardArt(def) {
      const u = Item.src(def);
      return u ? `<img class="card-icon hc-item" src="${u}" alt="" draggable="false">` : YC.CardArt.svg(def);
    },

    /** Fonte para desenhar em canvas (texturas 3D): PNG ou SVG em data URL. */
    canvasSrc(def) {
      return Item.src(def) || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(YC.CardArt.svg(def).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
    },

    create(def, { size = 96 } = {}) {
      const el = document.createElement('div');
      el.className = `item-token k-${def.kind}`;
      el.style.setProperty('--ic', def.theme.primary);
      el.style.setProperty('--ic2', def.theme.secondary);
      el.style.setProperty('--is', `${size}px`);
      el.innerHTML = `<i class="it-shadow"></i><i class="it-aura"></i><div class="it-bob">${Item.art(def)}</div>`;
      return el;
    },

    /** Nuvem de brilhos (a transformação carta ↔ objeto). */
    puff(parent, color = '#FFD700', x = 0, y = 0) {
      const p = document.createElement('div');
      p.className = 'it-puff';
      p.style.left = `${x}px`; p.style.top = `${y}px`;
      p.style.setProperty('--c', color);
      let dots = '';
      for (let i = 0; i < 10; i++) dots += `<i style="--a:${i * 36 + Math.random() * 20}deg;--d:${38 + Math.random() * 30}px"></i>`;
      p.innerHTML = `<b></b>${dots}`;
      parent.appendChild(p);
      setTimeout(() => p.remove(), 700);
    },

    /** Voo em arco de um elemento fixo (centro → centro). Devolve uma promessa. */
    fly(el, from, to, { duration = 0.6, scale0 = 1, scale1 = 1, lift = 80 } = {}) {
      const g = G();
      const p0 = { x: from.x, y: from.y }, p2 = { x: to.x, y: to.y };
      const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - lift };
      const place = (t) => {
        const u = 1 - t, x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
        if (g) g.set(el, { x, y, scale: scale0 + (scale1 - scale0) * t }); else el.style.transform = `translate(${x}px, ${y}px)`;
      };
      place(0);
      if (!g) { place(1); return Promise.resolve(); }
      const o = { t: 0 };
      return new Promise((res) => g.to(o, { t: 1, duration: duration / speed(), ease: 'power2.inOut', onUpdate: () => place(o.t), onComplete: res }));
    },

    center(r) { return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  };

  YC.ItemToken = Item;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
