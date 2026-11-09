/* QueueBar.js — a barra "A procurar partida…" que fica à vista enquanto navegas nos menus (Arena, Loja, Baralhos),
   como no cliente do LoL (docs/RELATORIO-TELAS.md, secção E): pulso, tempo a contar, cancelar. Na sala privada mostra
   o código. Clicar no texto abre o Online (PlayMenu). Escondida na partida e por baixo dos ecrãs inteiros. */
(function (YC) {
  'use strict';

  let el = null, tick = 0;
  const fmt = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  const QB = {
    /** w: { ranked, id, created } (o Lobby.waiting). */
    show(w) {
      QB.hide(true);
      el = document.createElement('div');
      el.className = 'qb';
      el.innerHTML = `<i class="qb-pulse"></i>
        <button class="qb-txt"><b>${w.ranked ? 'A procurar partida ranqueada…' : `Sala privada ${YC.HoloCard.esc(w.id)} · à espera`}</b><small><span class="qb-time">00:00</span>${w.ranked ? ' · podes ver a Loja e os Baralhos' : ' · partilha o código'}</small></button>
        <button class="qb-x" aria-label="Cancelar a procura" title="Cancelar">${YC.Icon('close', { size: 18 })}</button>`;
      document.body.appendChild(el);
      const time = el.querySelector('.qb-time');
      const paint = () => { time.textContent = fmt(Date.now() - w.created); };
      paint();
      tick = setInterval(paint, 1000);
      el.querySelector('.qb-txt').onclick = () => YC.PlayMenu && YC.PlayMenu.open('online');
      el.querySelector('.qb-x').onclick = async () => {
        if (YC.Sound) YC.Sound.play('click');
        await YC.OnlineLobby.stopWaiting();
        if (YC.OnlineLobby.current === 'waiting') YC.OnlineLobby.view('home');
      };
      if (window.gsap && !YC.reducedMotion()) window.gsap.fromTo(el, { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.26, ease: 'back.out(1.4)' });
    },

    hide(now) {
      clearInterval(tick);
      const e = el;
      el = null;
      if (!e) return;
      if (!now && window.gsap && !YC.reducedMotion()) window.gsap.to(e, { y: -20, opacity: 0, duration: 0.16, onComplete: () => e.remove() });
      else e.remove();
    }
  };

  YC.QueueBar = QB;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
