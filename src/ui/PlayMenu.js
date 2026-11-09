/* PlayMenu.js — o que o botão JOGAR abre: o ecrã "Escolhe o modo" ao estilo do cliente do LoL (docs/RELATORIO-TELAS.md,
   secção F, ecrã 3), por cima do vídeo de fundo dos menus. Dois mosaicos grandes com arte das personagens:
   "Contra o bot" (a personagem muda com o nível: Lola, Riku, Goro) e "Online" (Akane e Kaito), e ao lado o painel do
   modo escolhido: nível e relógio do bot, ou o OnlineLobby (ranqueada, sala privada ou código — só com conta Google).
   Também abre direto no Online pelo botão da conta e pelos links ?sala=CÓDIGO. Esc ou "Voltar" fecha. */
(function (YC) {
  'use strict';

  const I = (n, o) => YC.Icon(n, o);
  const esc = (s) => YC.HoloCard.esc(s);
  const CLOCKS = [[5, '5 min'], [10, '10 min'], [0, 'Sem limite']];
  const LEVELS = [['easy', 'Fácil', 'Joga ao calhas de vez em quando.'], ['medium', 'Médio', 'Pensa 2 lances à frente.'], ['hard', 'Difícil', 'Pensa 3 lances e usa bem as cartas.']];
  const heroOf = (icon) => {
    const U = YC.Ultimate;
    return U && (Object.values(U.DEFS).find((d) => d.icon === icon) || (U.FUSIONS || []).find((f) => f.icon === icon));
  };
  const art = (icon, cls = '') => { const d = heroOf(icon); return d ? `<img class="${cls}" src="${YC.Ultimate.hero(d)}" alt="" draggable="false">` : ''; };

  const Menu = {
    modal: null, tab: 'bot',

    open(tab) {
      const Hub = YC.Hub;
      Menu.tab = tab || Hub.mode || 'bot';
      if (Menu.modal) Menu.modal.close(true);
      const el = document.createElement('div');
      el.className = 'ms';
      el.setAttribute('role', 'dialog');
      el.innerHTML = `<header class="ms-head"><button class="ms-back">${I('chevron', { size: 20 })}Voltar</button><h2>Escolhe o modo</h2></header>
        <div class="ms-body">
          <div class="ms-tiles">
            <button class="ms-tile" data-t="bot" style="--c1:#FB8500;--c2:#FFB703">
              <div class="ms-art bot"></div>
              <div class="ms-cap">${I('robot', { size: 34 })}<span><b>Contra o bot</b><small>Offline · ganha ouro e poeira</small></span></div>
            </button>
            <button class="ms-tile" data-t="online" style="--c1:#00B4D8;--c2:#D90429">
              <div class="ms-art duo">${art('royal_scepter', 'a')}${art('escudo_antitumulto', 'b')}</div>
              <div class="ms-cap">${I('globe', { size: 34 })}<span><b>Online</b><small>Ranqueada (Elo) ou com um amigo</small></span></div>
            </button>
          </div>
          <aside class="ms-panel"><div class="pm-body"></div></aside>
        </div>`;
      document.body.appendChild(el);
      document.body.classList.add('ms-open');
      let closed = false;
      const key = (e) => { if (e.key === 'Escape') close(); };
      const close = (now) => {
        if (closed) return;
        closed = true;
        removeEventListener('keydown', key);
        Menu.modal = null;
        document.body.classList.remove('ms-open');
        const g = window.gsap;
        if (g && !now && !YC.reducedMotion()) g.to(el, { opacity: 0, duration: 0.16, ease: 'power1.in', onComplete: () => el.remove() });
        else el.remove();
      };
      addEventListener('keydown', key);
      el.querySelector('.ms-back').onclick = () => close();
      el.querySelectorAll('.ms-tile').forEach((b) => b.onclick = () => { if (YC.Sound) YC.Sound.play('click'); Menu.show(b.dataset.t); });
      Menu.modal = { el, close };
      Menu.show(Menu.tab);
      const g = window.gsap;
      if (g && !YC.reducedMotion()) {
        g.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.18 });
        g.fromTo(el.querySelectorAll('.ms-tile'), { y: 40, scale: 0.96, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.38, stagger: 0.06, ease: 'expo.out', clearProps: 'transform,opacity' });
        g.fromTo(el.querySelector('.ms-panel'), { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.36, delay: 0.1, ease: 'expo.out', clearProps: 'transform,opacity' });
      }
      if (YC.Sound) YC.Sound.play('whoosh');
    },

    close() { if (Menu.modal) Menu.modal.close(); },

    show(tab) {
      const el = Menu.modal && Menu.modal.el;
      if (!el) return;
      Menu.tab = tab;
      YC.Hub.mode = tab; YC.Hub.save();
      el.querySelectorAll('.ms-tile').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
      Menu.paintBotArt();
      const body = el.querySelector('.pm-body');
      if (tab === 'bot') return Menu.renderBot(body);
      body.innerHTML = '<div class="online-box"></div>';
      YC.OnlineLobby.render(body.querySelector('.online-box'));
    },

    /** O mosaico do bot mostra a personagem do nível escolhido. */
    paintBotArt() {
      const box = Menu.modal && Menu.modal.el.querySelector('.ms-art.bot');
      const icon = YC.VS && YC.VS.botArt && YC.VS.botArt[YC.Hub.level];
      if (box && box.dataset.icon !== icon) { box.dataset.icon = icon; box.innerHTML = art(icon); }
    },

    renderBot(body) {
      const Hub = YC.Hub, lvl = LEVELS.find((l) => l[0] === Hub.level) || LEVELS[1];
      const p = YC.ProfileStore.profile, deck = YC.Economy.activeDeck(p), v = YC.Economy.validateDeck(p, deck.cards);
      body.innerHTML = `<div class="pm-bot">
          <h3 class="ms-ptitle">${I('robot', { size: 24 })}Contra o bot</h3>
          <div class="pick-row"><span class="muted">Nível</span>${LEVELS.map(([id, label, tip]) => `<button class="chip ${Hub.level === id ? 'on' : ''}" data-level="${id}" title="${tip}">${label}</button>`).join('')}</div>
          <div class="pick-row"><span class="muted">${I('timer', { size: 18 })} Relógio</span>${CLOCKS.map(([c, label]) => `<button class="chip ${Hub.clock === c ? 'on' : ''}" data-clock="${c}">${label}</button>`).join('')}</div>
          <p class="muted small">${lvl[2]} Vitória: +120 ouro e +25 poeira. Baralho: «${esc(deck.name)}».</p>
          ${v.ok ? '' : `<p class="warn">${I('warn', { size: 16 })} ${esc(v.errors[0])}</p>`}
          <div class="play-wrap"><button class="play-btn pm-go" data-a="bot" ${v.ok ? '' : 'disabled'}><i class="play-sheen"></i>${I('play', { size: 26, fill: '#0F141C' })}<span>JOGAR</span></button></div>
        </div>`;
      body.querySelectorAll('[data-level]').forEach((b) => b.onclick = () => { Hub.level = b.dataset.level; Hub.save(); Menu.paintBotArt(); Menu.renderBot(body); });
      body.querySelectorAll('[data-clock]').forEach((b) => b.onclick = () => { Hub.clock = Number(b.dataset.clock); Hub.save(); Menu.renderBot(body); });
      body.querySelector('[data-a="bot"]').onclick = () => { Menu.close(); Hub.app.startBot(Hub.level, Hub.clock); };
    }
  };

  YC.PlayMenu = Menu;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
