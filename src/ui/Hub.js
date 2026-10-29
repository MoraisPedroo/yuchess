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
      // o Three.js chega depois (módulo): quando chegar, o palco da Arena passa a ter as peças 3D
      window.addEventListener('yc-three-ready', () => { if (Hub.tab === 'arena') Hub.renderStage(); });
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

    /** As 3 melhores cartas do baralho ativo (para o expositor do palco). */
    featured(deck) {
      const ids = [...new Set(deck.cards)];
      return ids.sort((a, b) => RANK[YC.Cards.get(b).rarity] - RANK[YC.Cards.get(a).rarity]).slice(0, 3);
    },

    renderArena() {
      const root = document.getElementById('screen-arena');
      const p = YC.ProfileStore.profile, deck = YC.Economy.activeDeck(p), E = YC.Economy;
      const v = E.validateDeck(p, deck.cards);
      const st = p.stats || {}, games = (st.wins || 0) + (st.losses || 0) + (st.draws || 0);
      root.innerHTML = `
        <div class="home">
          <aside class="arena-side panel arena-rank"></aside>
          <section class="arena-stage">
            <div class="stage-cards"></div>
            <div class="pedestal"><div class="pedestal-board"></div>
              <button class="stage-piece sp-k" title="Clica para saltar"></button>
              <button class="stage-piece sp-n" title="Clica para saltar"></button>
            </div>
            <div class="league-plate">${I('trophy', { size: 30 })}<div><b>Arena dos Brinquedos</b><small>${st.wins || 0} vitórias · ${games} partidas</small></div></div>
          </section>
          <aside class="arena-play">
            <div class="panel deck-dock">
              <div class="panel-head">${I('cards')}<h3>${esc(deck.name)}</h3><span class="deck-n ${v.ok ? 'ok' : ''}">${deck.cards.length}/${YC.Cards.RULES.DECK_SIZE}</span></div>
              <div class="tray dock-cards"></div>
              ${v.ok ? '' : `<p class="warn">${I('warn', { size: 16 })} ${esc(v.errors[0])}</p>`}
              <div class="row-btns tight"><button class="btn small secondary" data-a="decks">Editar baralho</button><button class="btn small secondary" data-a="rules">${I('info', { size: 18 })}Como se joga</button></div>
            </div>
            <button class="btn big play-btn" data-a="play">${I('play', { size: 26 })}JOGAR</button>
          </aside>
        </div>`;
      const dc = root.querySelector('.dock-cards');
      [...deck.cards].sort((a, b) => RANK[YC.Cards.get(b).rarity] - RANK[YC.Cards.get(a).rarity]).slice(0, 4)
        .forEach((id) => { const c = YC.HoloCard.create(id, { size: 'xs', static: true }); YC.CardZoom.attach(c, id); dc.appendChild(c); });
      const sc = root.querySelector('.stage-cards');
      // expositor: a melhor carta ao meio, as outras inclinadas dos lados
      const best = Hub.featured(deck), order = best.length === 3 ? [best[1], best[0], best[2]] : best;
      order.forEach((id, i) => {
        const slot = document.createElement('div');
        slot.className = `stage-slot s${best.length === 1 ? 1 : i}`;
        slot.appendChild(YC.HoloCard.create(id, { size: 'md', autoplay: YC.Cards.get(id).rarity === 'LEGENDARY' }));
        sc.appendChild(slot);
      });
      Hub.renderStage();
      YC.ArenaRanking.render(root.querySelector('.arena-rank'));
      root.querySelector('[data-a="play"]').onclick = () => YC.PlayMenu.open();
      root.querySelector('[data-a="decks"]').onclick = () => Hub.go('decks');
      root.querySelector('[data-a="rules"]').onclick = () => Hub.rules();
      const g = G();
      if (g) g.fromTo(root.querySelectorAll('.stage-cards .hcard'), { y: 40, opacity: 0, rotation: 0 }, { y: 0, opacity: 1, duration: 0.42, stagger: 0.06, ease: 'expo.out', delay: 0.1, clearProps: 'transform,opacity' });
    },

    /** Pedestal com o Rei branco e o Cavalo preto em 3D (fotos + sprite sheet do salto ao clicar). */
    renderStage() {
      const P = YC.Portraits3D, root = document.getElementById('screen-arena');
      // Rei branco e Dama preta (o Cavalo, visto de frente na foto, parecia uma Torre)
      const slots = [['.sp-k', 'k', 'w'], ['.sp-n', 'q', 'b']];
      const has3D = P && P.useOwn();
      for (const [sel, t, c] of slots) {
        const el = root.querySelector(sel);
        if (!el) continue;
        el.innerHTML = `<div class="squash">${has3D ? YC.pieceHTML(t, c) : YC.PieceArt.svg(t, c)}</div>`;
        if (!has3D) continue;
        const box = el.firstChild;
        P.sprite(t, c, null, true);
        el.onclick = () => { if (YC.Sound) YC.Sound.play('hop'); P.play(box, t, c, 'once'); };
        el.onpointerenter = () => P.play(box, t, c, 'once');
      }
    },

    rules() {
      YC.UI.modal(`<h2>Como se joga</h2>
        <ol class="rules-list">
          <li><b>Xadrez normal.</b> Ganha quem der xeque-mate. Afogamento, repetição tripla e 50 lances dão empate.</li>
          <li><b>Baralho de 22 cartas.</b> Começas com 3 na mão (máx. 5) e compras 1 no início de cada turno (só as Brancas não compram no 1.º). Perder um Cavalo, Bispo, Torre ou Dama dá-te 1 carta.</li>
          <li><b>Até 2 ações de carta por turno</b>, antes do lance: <em>equipar</em> uma peça, <em>esconder</em> uma Armadilha de Casa (máx. 3) ou <em>virar</em> uma carta na Zona de Armadilhas.</li>
          <li><b>Armadilhas de Casa</b> disparam quando uma peça inimiga pisa a casa. <b>Reativas</b> e <b>Counter-Traps</b> ficam viradas na Zona e respondem a partir do turno seguinte.</li>
          <li><b>Chain:</b> cada carta ativada pode levar resposta (Velocidade 1 → 2 → 3). Resolve-se do último elo para o primeiro. O Rei é imune a congelar e a ser destruído.</li>
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
