/* SplashScreen.js — ecrã de entrada ao estilo do ecrã de login do cliente do LoL (docs/RELATORIO-TELAS.md, secção F,
   ecrã 1): por cima do vídeo de fundo dos menus (MenuBackdrop), o logótipo cai com mola, aparece o nome do jogador e
   "Clica para começar"; o clique (ou Enter/Espaço) desbloqueia o som do navegador e a Arena entra. Aparece uma vez
   por sessão do separador (sessionStorage) e não aparece nos links de sala (?sala=). Só visual. */
(function (YC) {
  'use strict';

  const KEY = 'chessgioh.splash';
  const esc = (s) => YC.HoloCard.esc(s);

  const Splash = {
    /** Mostra o ecrã de entrada se for a primeira vez nesta sessão; resolve quando o jogador entra. */
    show() {
      let seen = false;
      try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) { /* */ }
      if (seen || /[?&]sala=/.test(location.search)) return Promise.resolve();
      try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* */ }
      const g = window.gsap, calm = YC.reducedMotion(), p = YC.ProfileStore.profile;
      const el = document.createElement('div');
      el.className = 'splash';
      el.innerHTML = `<div class="sp-shade"></div>
        <div class="sp-logo"><b>Chess-Gi-Oh!</b><small>Cartoon Edition</small></div>
        <p class="sp-tag">Xadrez a sério. Cartas com truques. Personagens com Ultimates.</p>
        <button class="sp-go"><span>Clica para começar</span></button>
        <p class="sp-who">A jogar como <b>${esc(p.displayName || 'Duelista')}</b></p>`;
      document.body.appendChild(el);
      document.body.classList.add('splash-open');
      if (g && !calm) {
        g.fromTo(el.querySelector('.sp-logo'), { y: -140, scale: 1.25, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.7, delay: 0.15, ease: 'back.out(1.6)' });
        g.fromTo(el.querySelectorAll('.sp-tag, .sp-go, .sp-who'), { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.1, delay: 0.55, ease: 'expo.out' });
      }
      return new Promise((resolve) => {
        const go = () => {
          removeEventListener('keydown', key);
          el.removeEventListener('pointerdown', go);
          if (YC.Sound) { if (YC.Sound.init) YC.Sound.init(); YC.Sound.play('vs_riser'); }
          document.body.classList.remove('splash-open');
          const done = () => { el.remove(); resolve(); };
          if (g && !calm) g.to(el, { opacity: 0, scale: 1.06, duration: 0.45, ease: 'power2.in', onComplete: done });
          else done();
        };
        const key = (e) => { if (e.key === 'Enter' || e.key === ' ') go(); };
        addEventListener('keydown', key);
        el.addEventListener('pointerdown', go);
      });
    }
  };

  YC.Splash = Splash;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
