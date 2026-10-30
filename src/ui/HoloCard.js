/* HoloCard.js — carta de "cartão laminado" (docs/DIRECAO-DE-ARTE.md) com inclinação 3D (±11°): chassis com aba
   inferior na cor do tipo, janela da arte, medalhão de velocidade (V1 seta, V2 asas, V3 relâmpago), fita com nome
   e tipo, caixa de regras rebaixada e placa de raridade com insígnias (● / ◆◆ / ✦✦✦ / coroa). Foil só nas Épicas e
   Lendárias. As variáveis --rx/--ry/--mx/--my/--hue seguem o rato e alimentam o CSS em styles/cards.css. */
(function (YC) {
  'use strict';

  const TILT = 11;
  const SS_LABEL = { 1: 'Velocidade 1', 2: 'Velocidade 2', 3: 'Velocidade 3' };
  const SPEED_ICON = { 1: 'chevron', 2: 'wings', 3: 'bolt' };

  /** A velocidade explicada (Chain): o que esta carta pode responder e quem lhe pode responder. Uma carta só responde a
      outra de velocidade igual ou menor, e nunca com Velocidade 1 (ChainResolver.linkOptions). */
  const SPEED_HOW = {
    EQUIP: 'Joga-se na tua vez e abre a Chain; não responde a cartas.',
    GRID: 'Dispara sozinha quando uma peça inimiga pisa a casa; não responde a cartas.',
    REACTIVE: 'Dispara sozinha quando acontece o que diz o texto (captura, destruição ou xeque); não responde a cartas.',
    QUICK: 'Responde a cartas de Velocidade 1 e 2 (Equipamentos, Armadilhas e outras Magias Rápidas), mas não a Counter-Traps.',
    COUNTER: 'A mais rápida: responde a qualquer carta (Velocidade 1, 2 ou 3).'
  };
  function speedInfo(card) {
    const by = card.ss >= 3 ? 'Só outra carta de Velocidade 3 (Counter-Trap) lhe pode responder.'
      : 'O adversário pode responder-lhe com Velocidade 2 (Magia Rápida) ou 3 (Counter-Trap).';
    return { title: SS_LABEL[card.ss], can: SPEED_HOW[card.kind] || '', by };
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch])); }

  function faceHTML(card, opts = {}) {
    const R = YC.Cards.RARITY[card.rarity];
    // vídeo do objeto (só Lendárias, assets/video): toca ao passar o rato, no zoom e na Chain
    const vid = opts.size !== 'xs' && opts.size !== 'sm' && YC.ItemToken && YC.ItemToken.video(card);
    const video = vid ? `<video class="hc-video" muted loop playsinline preload="none" data-src="${vid}"></video>` : '';
    // Lendária ainda sem vídeo: o objeto ganha vida em CSS (flutua, brilho a pulsar, estrelinhas) nos mesmos sítios
    const alive = !vid && card.rarity === 'LEGENDARY' && opts.size !== 'xs' && opts.size !== 'sm' ? '<div class="hc-alive"><i></i><i></i><i></i><i></i></div>' : '';
    // nomes compridos ("Botas de Vento Supersónico") encolhem a letra em vez de ficarem cortados
    const len = card.name.length, fit = len > 25 ? ' n-xxl' : len > 21 ? ' n-xl' : len > 15 ? ' n-l' : '';
    const ic = (n, o) => (YC.Icon ? YC.Icon(n, o) : '');
    // insígnias de raridade (dupla codificação: forma e número, não só cor)
    const gems = { COMMON: ic('gemCommon'), RARE: ic('gemRare'), EPIC: ic('gemEpic').repeat(3), LEGENDARY: ic('crown') }[card.rarity];
    return `<div class="hc-face">`
      + `<div class="hc-art" style="--c1:${card.theme.primary};--c2:${card.theme.secondary}"><div class="hc-rays"></div>${YC.ItemToken ? YC.ItemToken.cardArt(card) : YC.CardArt.svg(card)}${video}${alive}</div>`
      + `<div class="hc-speed s${card.ss}" title="${esc(`${SS_LABEL[card.ss]}: ${speedInfo(card).can} ${speedInfo(card).by}`)}">${ic(SPEED_ICON[card.ss])}<b>${card.ss}</b></div>`
      + `<div class="hc-ribbon"><span class="hc-name${fit}">${esc(card.name)}</span><span class="hc-kind">${YC.Cards.KIND_LABEL[card.kind]}</span></div>`
      + `<div class="hc-text">${esc(card.text)}</div>`
      + `<div class="hc-rar" title="${R.label}">${gems}</div>`
      + `<div class="hc-holo"></div><div class="hc-glare"></div>`
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
    } else if (el.querySelector('.hc-alive')) {
      if (opts.autoplay) el.classList.add('aplay');
      else { el.addEventListener('mouseenter', () => el.classList.add('aplay')); el.addEventListener('mouseleave', () => el.classList.remove('aplay')); }
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

  YC.HoloCard = { create, back, faceHTML, esc, playVideo, stopVideo, speedInfo };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
