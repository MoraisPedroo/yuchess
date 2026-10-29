/* PlayMenu.js — o que o botão JOGAR abre: duas opções lado a lado, "Contra o bot" (offline: nível e relógio)
   e "Online" (ranqueada, sala privada ou código — só com conta Google; o conteúdo é do OnlineLobby).
   Também abre direto no Online pelo botão da conta e pelos links ?sala=CÓDIGO. */
(function (YC) {
  'use strict';

  const I = (n, o) => YC.Icon(n, o);
  const CLOCKS = [[5, '5 min'], [10, '10 min'], [0, 'Sem limite']];
  const LEVELS = [['easy', 'Fácil', 'Joga ao calhas de vez em quando.'], ['medium', 'Médio', 'Pensa 2 lances à frente.'], ['hard', 'Difícil', 'Pensa 3 lances e usa bem as cartas.']];

  const Menu = {
    modal: null, tab: 'bot',

    open(tab) {
      const Hub = YC.Hub;
      Menu.tab = tab || Hub.mode || 'bot';
      if (Menu.modal) Menu.modal.close();
      Menu.modal = YC.UI.modal(`<h2 class="pm-title">Como queres jogar?</h2>
        <div class="pm-tabs">
          <button class="pm-tab" data-t="bot">${I('robot', { size: 34 })}<span><b>Contra o bot</b><small>Offline · ganha ouro e poeira</small></span></button>
          <button class="pm-tab" data-t="online">${I('globe', { size: 34 })}<span><b>Online</b><small>Ranqueada ou com um amigo</small></span></button>
        </div>
        <div class="pm-body"></div>`, { cls: 'play-menu', onClose: () => { Menu.modal = null; } });
      Menu.modal.el.querySelectorAll('.pm-tab').forEach((b) => b.onclick = () => Menu.show(b.dataset.t));
      Menu.show(Menu.tab);
    },

    close() { if (Menu.modal) Menu.modal.close(); },

    show(tab) {
      const el = Menu.modal && Menu.modal.el;
      if (!el) return;
      Menu.tab = tab;
      YC.Hub.mode = tab; YC.Hub.save();
      el.querySelectorAll('.pm-tab').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
      const body = el.querySelector('.pm-body');
      if (tab === 'bot') return Menu.renderBot(body);
      body.innerHTML = '<div class="online-box"></div>';
      YC.OnlineLobby.render(body.querySelector('.online-box'));
    },

    renderBot(body) {
      const Hub = YC.Hub, lvl = LEVELS.find((l) => l[0] === Hub.level) || LEVELS[1];
      const p = YC.ProfileStore.profile, deck = YC.Economy.activeDeck(p), v = YC.Economy.validateDeck(p, deck.cards);
      body.innerHTML = `<div class="pm-bot">
          <div class="pick-row"><span class="muted">Nível</span>${LEVELS.map(([id, label, tip]) => `<button class="chip ${Hub.level === id ? 'on' : ''}" data-level="${id}" title="${tip}">${label}</button>`).join('')}</div>
          <div class="pick-row"><span class="muted">${I('timer', { size: 18 })} Relógio</span>${CLOCKS.map(([c, label]) => `<button class="chip ${Hub.clock === c ? 'on' : ''}" data-clock="${c}">${label}</button>`).join('')}</div>
          <p class="muted small">${lvl[2]} Vitória: +120 ouro e +25 poeira. Baralho: «${YC.HoloCard.esc(deck.name)}».</p>
          ${v.ok ? '' : `<p class="warn">${I('warn', { size: 16 })} ${YC.HoloCard.esc(v.errors[0])}</p>`}
          <button class="btn big pm-go" data-a="bot" ${v.ok ? '' : 'disabled'}>${I('play', { size: 24 })}Jogar contra o bot</button>
        </div>`;
      body.querySelectorAll('[data-level]').forEach((b) => b.onclick = () => { Hub.level = b.dataset.level; Hub.save(); Menu.renderBot(body); });
      body.querySelectorAll('[data-clock]').forEach((b) => b.onclick = () => { Hub.clock = Number(b.dataset.clock); Hub.save(); Menu.renderBot(body); });
      body.querySelector('[data-a="bot"]').onclick = () => { Menu.close(); Hub.app.startBot(Hub.level, Hub.clock); };
    }
  };

  YC.PlayMenu = Menu;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
