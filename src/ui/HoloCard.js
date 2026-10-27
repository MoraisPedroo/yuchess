/* HoloCard.js — carta 3D com inclinação holográfica (perspective 1000px, ±11°) e moldura por raridade:
   Comum (mate cinzento), Rara (azul metálico), Épica (holográfica color-dodge), Lendária (folha dourada + partículas).
   As variáveis --rx/--ry/--mx/--my/--hue seguem o rato e alimentam o CSS em styles/cards.css. */
(function (YC) {
  'use strict';

  const TILT = 11;
  const SS_LABEL = { 1: 'Velocidade 1', 2: 'Velocidade 2', 3: 'Velocidade 3' };

  function esc(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

  function faceHTML(card) {
    const R = YC.Cards.RARITY[card.rarity];
    return `<div class="hc-face">`
      + `<div class="hc-head"><span class="hc-name">${esc(card.name)}</span><span class="hc-ss" title="${SS_LABEL[card.ss]}">${card.ss}</span></div>`
      + `<div class="hc-art" style="--c1:${card.theme.primary};--c2:${card.theme.secondary}"><div class="hc-rays"></div>${YC.ItemToken ? YC.ItemToken.cardArt(card) : YC.CardArt.svg(card)}</div>`
      + `<div class="hc-type"><span class="hc-kind k-${card.kind}">${YC.Cards.KIND_LABEL[card.kind]}</span><span class="hc-gem" title="${R.label}"></span></div>`
      + `<div class="hc-text">${esc(card.text)}</div>`
      + `<div class="hc-holo"></div><div class="hc-glare"></div>`
      + (card.rarity === 'LEGENDARY' ? '<div class="hc-sparkles"><i></i><i></i><i></i><i></i><i></i><i></i></div>' : '')
      + `</div>`;
  }

  const BACK = '<div class="hc-back"><div class="hc-back-inner"><div class="hc-back-logo">Chess<br>Gi-Oh!</div></div></div>';

  /** Cria o elemento de uma carta. opts: { size: 'sm'|'md'|'lg'|'xl', back, faceDown, static, uid } */
  function create(id, opts = {}) {
    const card = YC.Cards.get(id);
    const el = document.createElement('div');
    el.className = `hcard r-${card.rarity} k-${card.kind} size-${opts.size || 'md'}${opts.faceDown ? ' face-down' : ''}`;
    el.dataset.id = id;
    if (opts.uid) el.dataset.uid = opts.uid;
    el.innerHTML = `<div class="hc-tilt">${faceHTML(card)}${BACK}</div>`;
    if (!opts.static) attachTilt(el);
    return el;
  }

  /** Só o verso (cartas do adversário, baralho). */
  function back(size = 'sm') {
    const el = document.createElement('div');
    el.className = `hcard size-${size} only-back`;
    el.innerHTML = `<div class="hc-tilt">${BACK.replace('hc-back', 'hc-back solo')}</div>`;
    return el;
  }

  function attachTilt(el) {
    const tilt = el.querySelector('.hc-tilt');
    let raf = 0;
    const set = (x, y) => {
      el.style.setProperty('--rx', `${(-(y - 0.5) * 2 * TILT).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((x - 0.5) * 2 * TILT).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      el.style.setProperty('--hue', `${Math.round(x * 220 + y * 140)}deg`);
    };
    el.addEventListener('pointermove', (ev) => {
      if (ev.pointerType === 'touch') return;
      const r = tilt.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height));
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { set(x, y); el.classList.add('tilting'); });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      el.classList.remove('tilting');
      set(0.5, 0.5);
    });
  }

  YC.HoloCard = { create, back, faceHTML, esc };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
