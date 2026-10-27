/* HoloCard.js — carta 3D com inclinação holográfica (perspective 1000px, ±11°) e moldura por raridade:
   Comum (mate cinzento), Rara (azul metálico), Épica (holográfica color-dodge), Lendária (folha dourada + partículas).
   As variáveis --rx/--ry/--mx/--my/--hue seguem o rato e alimentam o CSS em styles/cards.css. */
(function (YC) {
  'use strict';

  const TILT = 11;
  const SS_LABEL = { 1: 'Velocidade 1', 2: 'Velocidade 2', 3: 'Velocidade 3' };

  function esc(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

  function faceHTML(card, opts = {}) {
    const R = YC.Cards.RARITY[card.rarity];
    // vídeo do objeto (só Lendárias, assets/video): toca ao passar o rato, no zoom e na Chain
    const vid = opts.size !== 'xs' && opts.size !== 'sm' && YC.ItemToken && YC.ItemToken.video(card);
    const video = vid ? `<video class="hc-video" muted loop playsinline preload="none" data-src="${vid}"></video>` : '';
    return `<div class="hc-face">`
      + `<div class="hc-head"><span class="hc-name">${esc(card.name)}</span><span class="hc-ss" title="${SS_LABEL[card.ss]}">${card.ss}</span></div>`
      + `<div class="hc-art" style="--c1:${card.theme.primary};--c2:${card.theme.secondary}"><div class="hc-rays"></div>${YC.ItemToken ? YC.ItemToken.cardArt(card) : YC.CardArt.svg(card)}${video}</div>`
      + `<div class="hc-type"><span class="hc-kind k-${card.kind}">${YC.Cards.KIND_LABEL[card.kind]}</span><span class="hc-gem" title="${R.label}"></span></div>`
      + `<div class="hc-text">${esc(card.text)}</div>`
      + `<div class="hc-holo"></div><div class="hc-glare"></div>`
      + (card.rarity === 'LEGENDARY' ? '<div class="hc-sparkles"><i></i><i></i><i></i><i></i><i></i><i></i></div>' : '')
      + `</div>`;
  }

  // verso desenhado no Gemini (assets/cards/back.png); sem ele fica o verso em CSS com o logótipo
  const BACK_CSS = '<div class="hc-back"><div class="hc-back-inner"><div class="hc-back-logo">Chess<br>Gi-Oh!</div></div></div>';
  const backHTML = (solo) => {
    const art = YC.ART && YC.ART.cardBack;
    if (!art) return solo ? BACK_CSS.replace('hc-back', 'hc-back solo') : BACK_CSS;
    return `<div class="hc-back art${solo ? ' solo' : ''}" style="background-image:url('${YC.asset(art)}')"></div>`;
  };

  /** Cria o elemento de uma carta. opts: { size: 'sm'|'md'|'lg'|'xl', back, faceDown, static, uid } */
  function create(id, opts = {}) {
    const card = YC.Cards.get(id);
    const el = document.createElement('div');
    el.className = `hcard r-${card.rarity} k-${card.kind} size-${opts.size || 'md'}${opts.faceDown ? ' face-down' : ''}`;
    el.dataset.id = id;
    if (opts.uid) el.dataset.uid = opts.uid;
    el.innerHTML = `<div class="hc-tilt">${faceHTML(card, opts)}${backHTML(false)}</div>`;
    if (!opts.static) attachTilt(el);
    if (el.querySelector('.hc-video')) {
      if (opts.autoplay) playVideo(el);
      else { el.addEventListener('mouseenter', () => playVideo(el)); el.addEventListener('mouseleave', () => stopVideo(el)); }
    }
    return el;
  }

  /** Começa o vídeo da carta (só aparece quando já está a tocar, para não piscar a preto). */
  function playVideo(el) {
    const v = el.querySelector('.hc-video');
    if (!v) return;
    if (!v.src) { v.src = v.dataset.src; v.addEventListener('playing', () => el.classList.add('vplay')); }
    v.muted = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }
  function stopVideo(el) {
    const v = el.querySelector('.hc-video');
    if (!v) return;
    v.pause();
    el.classList.remove('vplay');
  }

  /** Só o verso (cartas do adversário, baralho). */
  function back(size = 'sm') {
    const el = document.createElement('div');
    el.className = `hcard size-${size} only-back`;
    el.innerHTML = `<div class="hc-tilt">${backHTML(true)}</div>`;
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

  YC.HoloCard = { create, back, faceHTML, esc, playVideo, stopVideo };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
