/* Hub.js — barra de topo (ouro, poeira, som, conta) e o ecrã Arena (jogar contra o bot, online, baralho ativo, regras). */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const CLOCKS = [[5, '5 min'], [10, '10 min'], [0, 'Sem limite']];
  const LEVELS = [['easy', 'Fácil', 'Joga ao calhas de vez em quando.'], ['medium', 'Médio', 'Pensa 2 lances à frente.'], ['hard', 'Difícil', 'Pensa 3 lances e usa bem as cartas.']];

  const Hub = {
    tab: 'arena',
    level: 'medium',
    clock: 10,

    init(app) {
      Hub.app = app;
      try {
        Hub.level = localStorage.getItem('chessgioh.level') || 'medium';
        const c = localStorage.getItem('chessgioh.clock');
        if (c != null) Hub.clock = Number(c) || 0;
      } catch (e) { /* */ }
      document.querySelectorAll('#topnav .tab').forEach((b) => b.addEventListener('click', () => Hub.go(b.dataset.tab)));
      document.querySelector('#topnav .logo').addEventListener('click', () => Hub.go('arena'));
      const mute = document.getElementById('btn-mute');
      const paint = () => { mute.textContent = YC.Sound.muted ? '🔇' : '🔊'; mute.classList.toggle('on', !YC.Sound.muted); };
      mute.addEventListener('click', () => { YC.Sound.setMuted(!YC.Sound.muted); paint(); });
      paint();
      YC.ProfileStore.onChange(() => { Hub.renderNav(); if (Hub.tab === 'arena') Hub.renderArena(); });
      Hub.renderNav();
    },

    async go(tab) {
      if (Hub.tab === 'match' && tab !== 'match' && Hub.app.inMatch()) {
        const ok = await YC.UI.confirm('Sair da partida?', 'Se saíres agora, desistes e perdes a partida.', 'Sair e desistir');
        if (!ok) return;
        Hub.app.leaveMatch(true);
      }
      Hub.show(tab);
    },

    show(tab) {
      Hub.tab = tab;
      document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${tab}`));
      document.querySelectorAll('#topnav .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
      document.body.classList.toggle('in-match', tab === 'match');
      if (tab === 'arena') Hub.renderArena();
      if (tab === 'shop') YC.GachaView.render(document.getElementById('screen-shop'));
      if (tab === 'decks') YC.DeckBuilderView.render(document.getElementById('screen-decks'));
      if (tab === 'online') YC.OnlineLobby.render(document.getElementById('screen-online'));
      window.scrollTo(0, 0);
    },

    renderNav() {
      const p = YC.ProfileStore.profile;
      document.querySelector('#topnav .wallet').innerHTML =
        `<span class="coin-pill gold" title="Moedas de Ouro: compram pacotinhos"><i></i>${p.gold}</span>`
        + `<span class="coin-pill dust" title="Poeira Estelar: cria cartas na oficina"><i></i>${p.stardust}</span>`;
      const acc = document.querySelector('#topnav .account');
      const user = YC.Firebase && YC.Firebase.ready ? YC.Firebase.user : null;
      const cloud = { off: '', syncing: '⟳', ok: '☁', error: '⚠' }[YC.ProfileStore.cloud] || '';
      acc.innerHTML = `<div class="avatar">${user && user.photoURL ? `<img src="${esc(user.photoURL)}" alt="">` : esc((p.displayName || 'D')[0].toUpperCase())}</div>`
        + `<div class="acc-txt"><b>${esc(p.displayName)}</b><small>${user ? (user.isAnonymous ? 'Convidado' : 'Google') : 'Só neste navegador'} ${cloud}</small></div>`;
      acc.onclick = () => Hub.go('online');
    },

    renderArena() {
      const root = document.getElementById('screen-arena');
      const p = YC.ProfileStore.profile, deck = YC.Economy.activeDeck(p);
      const v = YC.Economy.validateDeck(p, deck.cards);
      root.innerHTML = `
        <section class="hero">
          <div class="hero-txt">
            <h1>Xadrez a sério.<br><span>Cartas com truques.</span></h1>
            <p>Jogas xadrez com as regras normais — xeque, roque, en passant, promoção, xeque-mate — e antes de cada lance podes usar até 2 cartas: equipar peças, esconder armadilhas no tabuleiro ou guardar respostas para travar o adversário.</p>
            <div class="hero-btns"><button class="btn big" data-a="bot">▶ Jogar contra o bot</button><button class="btn big pink" data-a="online">⚔ Online</button></div>
          </div>
          <div class="hero-art">
            <div class="hero-piece p1">${YC.PieceArt.svg('q', 'w')}</div>
            <div class="hero-piece p2">${YC.PieceArt.svg('n', 'b')}</div>
            <div class="hero-piece p3">${YC.PieceArt.svg('k', 'w')}</div>
            <div class="hero-card"></div>
          </div>
        </section>
        <section class="arena-grid">
          <div class="panel mode-card">
            <h2>🤖 Contra o bot</h2>
            <div class="levels">${LEVELS.map(([id, label, tip]) => `<button class="chip ${Hub.level === id ? 'on' : ''}" data-level="${id}" title="${tip}">${label}</button>`).join('')}</div>
            <p class="muted">${LEVELS.find((l) => l[0] === Hub.level)[2]} Vitória: +120 ouro e +25 poeira.</p>
            <div class="levels"><span class="muted">⏱ Relógio:</span>${CLOCKS.map(([v, label]) => `<button class="chip ${Hub.clock === v ? 'on' : 'dark'}" data-clock="${v}">${label}</button>`).join('')}</div>
            <button class="btn" data-a="bot">Jogar!</button>
          </div>
          <div class="panel mode-card">
            <h2>🌐 Multijogador</h2>
            <p class="muted">Ranqueada com rating Elo (conta Google) ou sala privada com um código para jogar com um amigo.</p>
            <div class="hero-btns"><button class="btn teal" data-a="online">Ranqueada</button><button class="btn violet" data-a="online">Sala privada</button></div>
          </div>
          <div class="panel mode-card deck-card">
            <h2>🃏 ${esc(deck.name)}</h2>
            <div class="mini-deck"></div>
            ${v.ok ? '' : `<p class="warn">${esc(v.errors[0])}</p>`}
            <button class="btn small violet" data-a="decks">Editar baralho</button>
          </div>
        </section>
        <section class="panel rules">
          <h2>Como se joga</h2>
          <ol>
            <li><b>Xadrez normal.</b> Ganha quem der xeque-mate. Afogamento, repetição tripla e 50 lances dão empate.</li>
            <li><b>Baralho de 12 cartas.</b> Começas com 3 na mão (máx. 5) e compras 1 no início de cada turno (só as Brancas não compram no 1.º). Perder um Cavalo, Bispo, Torre ou Dama dá-te 1 carta.</li>
            <li><b>Até 2 ações de carta por turno</b>, antes do lance: <em>equipar</em> uma peça, <em>esconder</em> uma Armadilha de Casa (máx. 3) ou <em>virar</em> uma carta na Zona de Armadilhas.</li>
            <li><b>Armadilhas de Casa</b> disparam quando uma peça inimiga pisa a casa. <b>Reativas</b> e <b>Counter-Traps</b> ficam viradas na Zona e respondem a partir do turno seguinte.</li>
            <li><b>Chain:</b> cada carta ativada pode levar resposta (Velocidade 1 → 2 → 3). Resolve-se do último elo para o primeiro. O Rei é imune a congelar e a ser destruído.</li>
          </ol>
        </section>`;
      const md = root.querySelector('.mini-deck');
      deck.cards.forEach((id) => { const c = YC.HoloCard.create(id, { size: 'xs', static: true }); md.appendChild(c); });
      const hc = YC.HoloCard.create('rt_espelho_magico', { size: 'lg', autoplay: true });
      root.querySelector('.hero-card').appendChild(hc);
      root.querySelectorAll('[data-level]').forEach((b) => b.onclick = () => { Hub.level = b.dataset.level; try { localStorage.setItem('chessgioh.level', Hub.level); } catch (e) { /* */ } Hub.renderArena(); });
      root.querySelectorAll('[data-clock]').forEach((b) => b.onclick = () => { Hub.clock = Number(b.dataset.clock); try { localStorage.setItem('chessgioh.clock', Hub.clock); } catch (e) { /* */ } Hub.renderArena(); });
      root.querySelectorAll('[data-a="bot"]').forEach((b) => b.onclick = () => Hub.app.startBot(Hub.level, Hub.clock));
      root.querySelectorAll('[data-a="online"]').forEach((b) => b.onclick = () => Hub.go('online'));
      root.querySelectorAll('[data-a="decks"]').forEach((b) => b.onclick = () => Hub.go('decks'));
      if (window.gsap) {
        window.gsap.fromTo(root.querySelectorAll('.hero-piece'), { y: 30, opacity: 0, scale: 0.6 }, { y: 0, opacity: 1, scale: 1, duration: 0.7, stagger: 0.12, ease: 'back.out(2)' });
        window.gsap.fromTo(root.querySelectorAll('.mode-card'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(1.6)', delay: 0.15 });
      }
    }
  };

  YC.Hub = Hub;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
