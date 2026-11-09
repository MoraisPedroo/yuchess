/* Hub.js — barra de topo (conta, ouro, poeira, som), doca de navegação e o ecrã Arena (hub de ação ao estilo
   Supercell: pódio dos melhores jogadores, palco com as peças 3D, baralho ativo e o botão JOGAR, que abre o
   PlayMenu — contra o bot ou online; o antigo separador Online vive agora aí). Mudar de ecrã
   é uma transição curta: o ecrã antigo sai para o lado oposto ao separador escolhido e o novo entra em escada. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const I = (n, o) => YC.Icon(n, o);
  const ORDER = ['shop', 'decks', 'arena'];
  const RANK = { LEGENDARY: 3, EPIC: 2, RARE: 1, COMMON: 0 };
  const G = () => window.gsap;

  const Hub = {
    tab: 'arena',
    level: 'medium',
    clock: 10,
    mode: 'bot',

    init(app) {
      Hub.app = app;
      try {
        Hub.level = localStorage.getItem('chessgioh.level') || 'medium';
        const c = localStorage.getItem('chessgioh.clock');
        if (c != null) Hub.clock = Number(c) || 0;
        Hub.mode = localStorage.getItem('chessgioh.mode') === 'online' ? 'online' : 'bot';
      } catch (e) { /* */ }
      document.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', I(el.dataset.icon, { size: 26 })));
      document.querySelectorAll('#dock .tab').forEach((b) => b.addEventListener('click', () => Hub.go(b.dataset.tab)));
      document.querySelector('#topnav .logo').addEventListener('click', () => Hub.go('arena'));
      const mute = document.getElementById('btn-mute');
      const paint = () => { mute.innerHTML = I(YC.Sound.muted ? 'soundOff' : 'soundOn', { size: 24 }); mute.title = YC.Sound.muted ? 'Som desligado' : 'Som ligado'; };
      mute.addEventListener('click', () => { YC.Sound.setMuted(!YC.Sound.muted); paint(); });
      paint();
      Hub.paintMute = paint;
      const gear = document.getElementById('btn-settings');
      gear.innerHTML = I('gear', { size: 24 });
      gear.addEventListener('click', () => Hub.settings());
      YC.ProfileStore.onChange(() => { Hub.renderNav(); if (Hub.tab === 'arena') Hub.renderArena(); });
      // o Three.js chega depois (módulo): quando chegar, as fotos das peças passam a ser 3D
      window.addEventListener('yc-three-ready', () => Hub.warmPortraits());
      if (window.THREE) Hub.warmPortraits();
      if (YC.MenuBackdrop) YC.MenuBackdrop.init();
      Hub.renderNav();
    },

    async go(tab) {
      if (Hub.tab === 'match' && tab !== 'match' && Hub.app.inMatch()) {
        const ok = await YC.UI.confirm('Sair da partida?', 'Se saíres agora, desistes e perdes a partida.', 'Sair e desistir');
        if (!ok) return;
        Hub.app.leaveMatch(true);
      }
      if (tab !== Hub.tab && YC.Sound) YC.Sound.play('click');
      Hub.show(tab);
    },

    show(tab) {
      if (tab === 'online') { Hub.show('arena'); return YC.PlayMenu.open('online'); }
      const prev = Hub.tab, g = G(), token = (Hub.token = (Hub.token || 0) + 1);
      const old = document.querySelector('.screen.active'), next = document.getElementById(`screen-${tab}`);
      const dir = Math.sign(ORDER.indexOf(tab) - ORDER.indexOf(prev)) || 1;
      const swap = () => {
        if (token !== Hub.token) return;
        if (old && g) g.set(old.children, { clearProps: 'transform,opacity' });
        Hub.tab = tab;
        document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s === next));
        document.querySelectorAll('#dock .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
        document.body.classList.toggle('in-match', tab === 'match');
        document.body.classList.toggle('has-match', !!(Hub.app && Hub.app.inMatch()) && tab !== 'match');
        if (YC.MenuBackdrop) YC.MenuBackdrop.screen(tab);
        if (tab === 'arena') Hub.renderArena();
        if (tab === 'shop') YC.GachaView.render(next);
        if (tab === 'decks') YC.DeckBuilderView.render(next);
        window.scrollTo(0, 0);
        if (g && tab !== 'match' && next.children.length && !YC.reducedMotion()) {
          g.fromTo(next.children, { x: 48 * dir, opacity: 0 }, { x: 0, opacity: 1, duration: 0.22, stagger: 0.035, ease: 'expo.out', clearProps: 'transform,opacity' });
        }
      };
      // o ecrã antigo sai em 110 ms para o lado contrário (não na entrada/saída da partida)
      if (old && old !== next && g && prev !== 'match' && tab !== 'match' && old.children.length) {
        g.to(old.children, { x: -48 * dir, opacity: 0, duration: 0.11, ease: 'power2.in', onComplete: swap });
      } else swap();
    },

    renderNav() {
      const p = YC.ProfileStore.profile;
      document.querySelector('#topnav .wallet').innerHTML =
        `<span class="coin-pill gold" title="Moedas de Ouro: compram pacotinhos">${I('coin')}${p.gold}</span>`
        + `<span class="coin-pill dust" title="Poeira Estelar: cria cartas na oficina">${I('dust')}${p.stardust}</span>`;
      const acc = document.querySelector('#topnav .account');
      const user = YC.Firebase && YC.Firebase.ready ? YC.Firebase.user : null;
      const cloud = { syncing: I('sync', { size: 14 }), ok: I('cloud', { size: 14 }), error: I('warn', { size: 14 }) }[YC.ProfileStore.cloud] || '';
      acc.innerHTML = `<div class="avatar">${user && user.photoURL ? `<img src="${esc(user.photoURL)}" alt="">` : esc((p.displayName || 'D')[0].toUpperCase())}</div>`
        + `<div class="acc-txt"><b>${esc(p.displayName)}</b><small>${user ? (user.isAnonymous ? 'Convidado' : 'Google') : 'Só neste navegador'} ${cloud}</small></div>`;
      acc.onclick = () => YC.PlayMenu.open('online');
    },

    renderArena() {
      const root = document.getElementById('screen-arena');
      const p = YC.ProfileStore.profile, deck = YC.Economy.activeDeck(p), E = YC.Economy;
      const v = E.validateDeck(p, deck.cards);
      const st = p.stats || {}, games = (st.wins || 0) + (st.losses || 0) + (st.draws || 0);
      const AH = YC.ArenaHero;
      // cliente ao estilo do LoL (docs/RELATORIO-TELAS.md): vídeo atrás (MenuBackdrop), personagem em destaque ao
      // centro, cartaz e pódio à esquerda, baralho e JOGAR à direita
      root.innerHTML = `
        <div class="home">
          <aside class="arena-left">${AH ? AH.banner() : ''}<div class="arena-side panel arena-rank"></div></aside>
          <section class="arena-hero">${AH ? AH.html() : ''}</section>
          <aside class="arena-play">
            <div class="panel deck-dock">
              <div class="panel-head">${I('cards')}<h3>${esc(deck.name)}</h3><span class="deck-n ${v.ok ? 'ok' : ''}">${deck.cards.length}/${YC.Cards.RULES.DECK_SIZE}</span></div>
              <div class="tray dock-cards"></div>
              ${v.ok ? '' : `<p class="warn">${I('warn', { size: 16 })} ${esc(v.errors[0])}</p>`}
              <div class="row-btns tight"><button class="btn small secondary" data-a="decks">Editar baralho</button><button class="btn small secondary" data-a="rules">${I('info', { size: 18 })}Como se joga</button></div>
            </div>
            <div class="play-wrap"><button class="play-btn" data-a="play"><i class="play-sheen"></i>${I('play', { size: 28, fill: '#0F141C' })}<span>JOGAR</span></button></div>
            <p class="arena-tally">${I('trophy', { size: 18 })}<b>${st.wins || 0}</b> vitórias · <b>${games}</b> partidas</p>
          </aside>
        </div>`;
      const dc = root.querySelector('.dock-cards');
      [...deck.cards].sort((a, b) => RANK[YC.Cards.get(b).rarity] - RANK[YC.Cards.get(a).rarity]).slice(0, 4)
        .forEach((id) => { const c = YC.HoloCard.create(id, { size: 'xs', static: true }); YC.CardZoom.attach(c, id); dc.appendChild(c); });
      if (AH) { AH.mount(root.querySelector('.arena-hero')); AH.bindBanner(root, Hub.go); }
      YC.ArenaRanking.render(root.querySelector('.arena-rank'));
      root.querySelector('[data-a="play"]').onclick = () => YC.PlayMenu.open();
      root.querySelector('[data-a="decks"]').onclick = () => Hub.go('decks');
      root.querySelector('[data-a="rules"]').onclick = () => Hub.rules();
      const g = G();
      if (g && !YC.reducedMotion()) {
        g.fromTo(root.querySelectorAll('.arena-left > *'), { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: 'expo.out', delay: 0.08, clearProps: 'transform,opacity' });
        g.fromTo(root.querySelectorAll('.arena-play > *'), { x: 40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: 'expo.out', delay: 0.1, clearProps: 'transform,opacity' });
      }
    },

    /** Liga o renderer das fotos 3D das peças nos menus (o ecrã VS e o perfil usam-nas). */
    warmPortraits() {
      if (YC.Portraits3D) YC.Portraits3D.useOwn();
    },

    rules() {
      YC.UI.modal(`<h2>Como se joga</h2>
        <ol class="rules-list">
          <li><b>Xadrez normal.</b> Ganha quem der xeque-mate. Afogamento, repetição tripla e 50 lances dão empate.</li>
          <li><b>Baralho de 22 cartas.</b> Começas com 3 na mão (máx. 5) e compras 1 no início de cada turno (só as Brancas não compram no 1.º). Perder um Cavalo, Bispo, Torre ou Dama dá-te 1 carta.</li>
          <li><b>Até 2 ações de carta por turno</b>, antes do lance: <em>equipar</em> uma peça, <em>esconder</em> uma Armadilha de Casa (máx. 3) ou <em>virar</em> uma carta na Zona de Armadilhas.</li>
          <li><b>Armadilhas de Casa</b> disparam quando uma peça inimiga pisa a casa. <b>Reativas</b> e <b>Counter-Traps</b> ficam viradas na Zona e respondem a partir do turno seguinte.</li>
          <li><b>Chain:</b> cada carta ativada pode levar resposta de uma carta de velocidade igual ou maior. Velocidade 1 (Equipamentos) não responde a nada; Velocidade 2 (Magias Rápidas) responde a 1 e 2; Velocidade 3 (Counter-Traps) responde a tudo. As Armadilhas disparam sozinhas. Resolve-se do último elo para o primeiro. O Rei é imune a congelar e a ser destruído.</li>
        </ol>`, { cls: 'rules-modal' });
    },

    /** Definições: som, velocidade das animações e "Reduzir movimento" (desligado por omissão). */
    settings() {
      const row = (key, title, sub, on) => `<label class="set-row"><span><b>${title}</b><small>${sub}</small></span>
        <button class="toggle ${on ? 'on' : ''}" data-set="${key}" role="switch" aria-checked="${on}"><i></i></button></label>`;
      const fast = YC.FX.speed > YC.FX.NORMAL;
      const m = YC.UI.modal(`<h2>Definições</h2>
        ${row('sound', 'Som', 'Efeitos sonoros do jogo.', !YC.Sound.muted)}
        ${row('fast', 'Animações rápidas', 'Lances e cartas mais depressa.', fast)}
        ${row('reduce', 'Reduzir movimento', 'Sem tremores, rodopios nem transições longas.', YC.reducedMotion())}`, { cls: 'settings-modal' });
      m.el.querySelectorAll('[data-set]').forEach((b) => b.addEventListener('click', (e) => {
        e.preventDefault();
        const on = !b.classList.contains('on');
        b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
        if (b.dataset.set === 'sound') { YC.Sound.setMuted(!on); Hub.paintMute(); }
        if (b.dataset.set === 'fast') { YC.FX.speed = on ? YC.FX.FAST : YC.FX.NORMAL; try { localStorage.setItem('chessgioh.speed', on ? 'fast' : 'normal'); } catch (err) { /* */ } }
        if (b.dataset.set === 'reduce') YC.setReducedMotion(on);
        if (YC.Sound) YC.Sound.play('click');
      }));
    },

    save() {
      try { localStorage.setItem('chessgioh.level', Hub.level); localStorage.setItem('chessgioh.clock', Hub.clock); localStorage.setItem('chessgioh.mode', Hub.mode); } catch (e) { /* */ }
    }
  };

  YC.Hub = Hub;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
