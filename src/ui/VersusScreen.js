/* VersusScreen.js — ecrã "VS" à entrada da partida (docs/DIRECAO-DE-ARTE.md, Ecrãs): duas placas inclinadas de
   plástico entram dos lados e batem no centro aos 520 ms (tremor curto), carimbo "VS" dourado, ~0,7 s para ler os
   dois jogadores, e as placas abrem-se para mostrar o tabuleiro. YC.VS.run(info, mount): mount() corre com as
   placas fechadas, por isso a partida monta-se por trás sem se ver o "salto". */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const plate = (p, side) => `<div class="vs-door ${side}"><div class="vs-p">
      <div class="vs-ava ${p.color}">${YC.pieceHTML('k', p.color, 'bust')}</div>
      <b>${esc(p.name)}</b><small>${esc(p.sub || '')}</small></div></div>`;

  const VS = {
    /** info: { left: {name, sub, color}, right: {name, sub, color} } (esquerda = tu). */
    async run(info, mount) {
      const g = window.gsap;
      if (!g || YC.reducedMotion()) { await mount(); return; }
      const el = document.createElement('div');
      el.className = 'vs';
      el.innerHTML = `${plate(info.left, 'l')}${plate(info.right, 'r')}<div class="vs-seam"></div><div class="vs-stamp">VS</div>`;
      document.body.appendChild(el);
      const [L, R] = el.querySelectorAll('.vs-door'), stamp = el.querySelector('.vs-stamp'), seam = el.querySelector('.vs-seam');
      const S = (n) => YC.Sound && YC.Sound.play(n);
      // as placas entram (200 → 520 ms) e batem no centro
      g.set(stamp, { scale: 2.2, opacity: 0 });
      g.set(seam, { opacity: 0 });
      await Promise.all([
        g.fromTo(L, { xPercent: -110 }, { xPercent: 0, duration: 0.32, delay: 0.2, ease: 'power3.in' }),
        g.fromTo(R, { xPercent: 110 }, { xPercent: 0, duration: 0.32, delay: 0.2, ease: 'power3.in' })
      ]);
      g.set(seam, { opacity: 1 });
      S('hop');
      g.fromTo(el, { x: -5, y: 3 }, { x: 0, y: 0, duration: 0.2, ease: 'power2.out' });
      await mount();   // a partida monta-se por trás das placas
      S('reveal_rare');
      await g.to(stamp, { scale: 1, opacity: 1, duration: 0.14, ease: 'power3.in' });
      g.fromTo(el, { x: 4, y: -3 }, { x: 0, y: 0, duration: 0.18, ease: 'power2.out' });
      await wait(700);
      // abrem-se para mostrar o tabuleiro
      S('card_flip');
      g.to(stamp, { scale: 0.6, opacity: 0, duration: 0.2, ease: 'power2.in' });
      g.set(seam, { opacity: 0 });
      await Promise.all([
        g.to(L, { xPercent: -110, duration: 0.3, ease: 'power2.in' }),
        g.to(R, { xPercent: 110, duration: 0.3, ease: 'power2.in' })
      ]);
      el.remove();
    }
  };

  YC.VS = VS;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
