/* ArenaHero.js — a personagem em destaque na Arena (como a arte de campeão no cliente do LoL, docs/RELATORIO-TELAS.md,
   secção E): a ilustração da Ultimate grande ao centro, por cima do vídeo de fundo, com paralaxe (MenuBackdrop),
   a respirar devagar, e uma placa com o nome e setas para escolher outra das 14. A escolha fica no navegador
   (chessgioh.fav); por omissão é a primeira Ultimate desbloqueada, senão a Akane. E o cartaz "Em destaque" da
   coluna da esquerda (a fusão Akaito, com o vídeo de entrada a tocar ao passar o rato). Só visual. */
(function (YC) {
  'use strict';

  const KEY = 'chessgioh.fav';
  const esc = (s) => YC.HoloCard.esc(s);
  const I = (n, o) => YC.Icon(n, o);

  const AH = {
    /** As 13 personagens das Lendárias e a fusão: [{ d, ids }]. */
    list() {
      const U = YC.Ultimate;
      if (!U) return [];
      const out = Object.values(U.DEFS).map((d) => ({ d, ids: [d.id] }));
      for (const f of U.FUSIONS || []) out.push({ d: f, ids: f.ids });
      return out;
    },

    unlocked(e) {
      const p = YC.ProfileStore.profile;
      return e.ids.every((id) => YC.Economy.hasUltimate(p, id));
    },

    index() {
      const L = AH.list();
      let fav = null;
      try { fav = localStorage.getItem(KEY); } catch (e) { /* */ }
      let i = L.findIndex((e) => e.d.icon === fav);
      if (i < 0) i = L.findIndex(AH.unlocked);
      return Math.max(0, i);
    },

    current() { return AH.list()[AH.index()] || null; },

    html() {
      const e = AH.current();
      if (!e) return '';
      return `<div class="ah-par"><div class="ah-glow"></div><div class="ah-fig"><img class="ah-art" alt="" draggable="false"></div></div>
        <div class="ah-plate">
          <button class="ah-nav prev" data-step="-1" aria-label="Personagem anterior">${I('chevron', { size: 22 })}</button>
          <div class="ah-name"><small></small><b></b><span></span></div>
          <button class="ah-nav next" data-step="1" aria-label="Personagem seguinte">${I('chevron', { size: 22 })}</button>
        </div>`;
    },

    /** Liga a personagem dentro de `box` (o centro da Arena). */
    mount(box) {
      if (!box || !AH.current()) return;
      AH.box = box;
      box.querySelectorAll('.ah-nav').forEach((b) => b.addEventListener('click', () => AH.step(Number(b.dataset.step))));
      AH.paint(0);
      if (YC.MenuBackdrop) YC.MenuBackdrop.parallax(box.querySelector('.ah-par'), 24, 12);
    },

    step(k) {
      const L = AH.list(), i = (AH.index() + k + L.length) % L.length;
      try { localStorage.setItem(KEY, L[i].d.icon); } catch (e) { /* */ }
      if (YC.Sound) YC.Sound.play('click');
      AH.paint(k);
    },

    /** Mostra a personagem atual; dir: de que lado entra (0 = entrada na Arena). */
    paint(dir) {
      const box = AH.box, e = AH.current();
      if (!box || !box.isConnected || !e) return;
      const d = e.d, on = AH.unlocked(e), art = box.querySelector('.ah-art'), g = window.gsap;
      box.style.setProperty('--c1', d.c1);
      box.style.setProperty('--c2', d.c2);
      box.querySelector('.ah-name small').innerHTML = on ? `${I('star', { size: 14 })}Ultimate desbloqueada` : `${I('lock', { size: 14 })}Ultimate por desbloquear`;
      box.querySelector('.ah-name b').textContent = d.name;
      box.querySelector('.ah-name span').textContent = d.title;
      box.classList.toggle('locked', !on);
      const show = () => {
        art.src = YC.Ultimate.hero(d);
        if (!g || YC.reducedMotion()) return;
        g.fromTo(art, { x: dir ? 70 * dir : -60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.5, ease: 'expo.out' });
        g.fromTo(box.querySelector('.ah-name'), { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'power3.out' });
      };
      if (dir && g && !YC.reducedMotion() && art.getAttribute('src')) g.to(art, { x: -50 * dir, opacity: 0, duration: 0.14, ease: 'power2.in', onComplete: show });
      else show();
    },

    /** Cartaz "Em destaque" (coluna da esquerda): a fusão, com o vídeo de entrada ao passar o rato. */
    banner() {
      const U = YC.Ultimate, f = U && (U.FUSIONS || [])[0];
      if (!f) return '';
      return `<section class="feature-banner" style="--c1:${f.c1};--c2:${f.c2}">
        <div class="fb-art"><img src="${U.hero(f)}" alt=""><video muted loop playsinline preload="none" data-src="${U.video(f, 'summon')}"></video></div>
        <div class="fb-txt"><small>${I('star', { size: 14 })}Em destaque · Fusão</small><b>${esc(f.name)}, ${esc(f.title)}</b>
          <p>Equipa o Cetro Usurpador e o Escudo Tático na mesma peça: a Akane e o Kaito juntam-se.</p>
          <button class="btn small secondary" data-a="ults">Ver Ultimates</button></div>
      </section>`;
    },

    bindBanner(root, go) {
      const b = root.querySelector('.feature-banner');
      if (!b) return;
      const v = b.querySelector('video');
      b.addEventListener('pointerenter', () => {
        if (YC.reducedMotion()) return;
        if (!v.getAttribute('src')) v.src = v.dataset.src;
        v.play().then(() => b.classList.add('playing')).catch(() => {});
      });
      b.addEventListener('pointerleave', () => { v.pause(); b.classList.remove('playing'); });
      b.querySelector('[data-a="ults"]').onclick = () => go('decks');
    }
  };

  YC.ArenaHero = AH;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
