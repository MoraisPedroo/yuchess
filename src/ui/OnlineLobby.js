/* OnlineLobby.js — a parte "Online" do menu JOGAR (PlayMenu): login com Google (obrigatório para jogar online),
   rating, fila ranqueada e salas privadas por código/link. A classificação está no pódio da Arena (ArenaRanking).
   Ao entrar, o perfil da coleção passa a gravar no Firestore. */
(function (YC) {
  'use strict';

  const FB = () => YC.Firebase;
  const esc = (s) => YC.HoloCard.esc(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const FLAG = 'chessgioh.fb';

  const Lobby = {
    root: null, profile: null, waiting: null, current: 'idle', pendingCode: '', unsubUser: null,

    /** Se o jogador já usou o online, liga-se em segundo plano (para sincronizar a coleção). */
    autoConnect() {
      let used = false;
      try { used = localStorage.getItem(FLAG) === '1'; } catch (e) { /* */ }
      if (used || Lobby.pendingCode) Lobby.connect().catch(() => {});
    },

    async connect() {
      await FB().load();
      try { localStorage.setItem(FLAG, '1'); } catch (e) { /* */ }
      if (!Lobby.unsubUser) Lobby.unsubUser = FB().onUser((u) => Lobby.onUser(u));
    },

    render(root) {
      Lobby.root = root;
      if (!FB().ready || !Lobby.unsubUser) {
        Lobby.view('loading', 'A ligar ao online…');
        Lobby.connect().then(() => { if (Lobby.current === 'loading' && !FB().user) Lobby.view('signin'); })
          .catch((err) => Lobby.view('error', `Não consegui ligar: ${FB().explain(err)}`));
        return;
      }
      const guest = FB().user && FB().user.isAnonymous;
      Lobby.view(Lobby.profile && !guest ? (Lobby.waiting ? 'waiting' : 'home') : FB().user && !guest ? 'loading' : 'signin', Lobby.waiting);
    },

    async onUser(user) {
      YC.ProfileStore.attach(user).then(() => YC.Hub.renderNav());
      YC.Hub.renderNav();
      if (!user) { Lobby.profile = null; return Lobby.view('signin'); }
      if (user.isAnonymous) { Lobby.profile = null; return Lobby.view('signin'); }   // online só com conta Google
      Lobby.view('loading', 'A abrir o teu perfil…');
      try {
        Lobby.profile = await YC.Ranking.ensureProfile(user, Lobby.pendingName || YC.ProfileStore.profile.displayName);
        Lobby.profile.guest = user.isAnonymous;
        YC.Ranking.settlePending(user.uid).then((n) => { if (n) Lobby.refresh(); }).catch(() => {});
        Lobby.view('home');
        if (Lobby.pendingCode) { const c = Lobby.pendingCode; Lobby.pendingCode = ''; Lobby.joinByCode(c); }
      } catch (err) { Lobby.view('error', FB().explain(err)); }
    },

    async refresh() {
      const p = await YC.Ranking.getProfile(Lobby.profile.uid);
      if (p) { Lobby.profile = { ...p, guest: Lobby.profile.guest }; if (Lobby.current === 'home') Lobby.view('home'); }
    },

    body() {
      if (!Lobby.root || !Lobby.root.isConnected) return null;
      let b = Lobby.root.querySelector('.lobby');
      if (!b) { Lobby.root.innerHTML = '<div class="lobby"></div>'; b = Lobby.root.querySelector('.lobby'); }
      return b;
    },

    view(name, arg) {
      Lobby.current = name;
      const b = Lobby.body();
      if (!b) return;
      if (name === 'loading') b.innerHTML = `<div class="lobby-center"><div class="spinner"></div><p>${esc(arg || 'A carregar…')}</p></div>`;
      if (name === 'error') { b.innerHTML = `<div class="lobby-center"><p class="lobby-error">${esc(arg)}</p><button class="btn" data-a="retry">Tentar de novo</button></div>`; b.querySelector('[data-a="retry"]').onclick = () => Lobby.render(Lobby.root); }
      if (name === 'signin') Lobby.viewSignin(b);
      if (name === 'home') Lobby.viewHome(b);
      if (name === 'waiting') Lobby.viewWaiting(b, arg || Lobby.waiting);
    },

    viewSignin(b) {
      const guest = FB().user && FB().user.isAnonymous;
      b.innerHTML = `<div class="ol-sign">
          <div class="ol-sign-ico">${YC.Icon('globe', { size: 44 })}</div>
          <h3>Entra para jogar online</h3>
          <p>O online precisa de uma <b>conta Google</b>: o teu rating fica no pódio e a coleção e os baralhos ficam guardados na nuvem.</p>
          <label class="lbl">Nome no pódio</label><input class="text-in" id="lobby-name" maxlength="20" value="${esc(YC.ProfileStore.profile.displayName)}">
          <button class="btn big ol-google" data-a="google">${YC.Icon('play', { size: 22 })}${guest ? 'Ligar a minha conta Google' : 'Entrar com Google'}</button>
          <p class="lobby-error" hidden></p></div>`;
      const err = b.querySelector('.lobby-error');
      b.querySelector('[data-a="google"]').onclick = async () => {
        Lobby.pendingName = b.querySelector('#lobby-name').value;
        YC.ProfileStore.update((p) => { if (Lobby.pendingName.trim().length >= 2) p.displayName = Lobby.pendingName.trim().slice(0, 20); });
        err.hidden = true;
        try { await (guest ? FB().linkGoogle() : FB().signInGoogle()); } catch (e) { err.textContent = FB().explain(e); err.hidden = false; }
      };
    },

    viewHome(b) {
      const p = Lobby.profile, letter = esc((String(p.name || '?').trim()[0] || '?').toUpperCase());
      b.innerHTML = `
        <div class="ol-me">
          <span class="rk-ava big">${letter}</span>
          <div class="ol-name"><div class="row-btns tight"><input class="text-in" id="lobby-rename" maxlength="20" value="${esc(p.name)}" aria-label="Nome"><button class="icon-btn" data-a="rename" title="Guardar nome">${YC.Icon('check', { size: 20 })}</button></div>
            <small>${p.wins}V · ${p.losses}D · ${p.draws}E · coleção ${YC.ProfileStore.cloud === 'ok' ? 'guardada na nuvem' : 'a sincronizar…'}</small></div>
          <div class="ol-elo"><b>${p.rating}</b><small>Elo</small></div>
        </div>
        <div class="ol-actions">
          <button class="btn big ol-ranked" data-a="ranked">${YC.Icon('swords', { size: 26 })}<span>Ranqueada<small>Ganha ou perde Elo</small></span></button>
          <button class="btn big secondary ol-private" data-a="private">${YC.Icon('cards', { size: 24 })}<span>Sala privada<small>Joga com um amigo</small></span></button>
        </div>
        <div class="ol-join tray"><label class="lbl" for="lobby-code">Tens um código?</label><input class="text-in code-in" id="lobby-code" maxlength="5" placeholder="ABCDE" autocomplete="off"><button class="btn" data-a="join">Entrar</button></div>
        <p class="muted small">Jogas com o baralho «${esc(YC.Economy.activeDeck(YC.ProfileStore.profile).name)}». Cada turno tem 2 minutos.</p>
        <p class="lobby-error" hidden></p>
        <button class="btn small ghost ol-out" data-a="signout">Terminar sessão</button>`;
      const err = b.querySelector('.lobby-error');
      Lobby.showError = (msg) => { err.textContent = msg; err.hidden = !msg; };
      const on = (a, fn) => { const el = b.querySelector(`[data-a="${a}"]`); if (el) el.onclick = fn; };
      on('rename', async () => {
        try { Lobby.profile.name = await YC.Ranking.rename(p.uid, b.querySelector('#lobby-rename').value); YC.ProfileStore.update((pp) => { pp.displayName = Lobby.profile.name; }); Lobby.showError(''); YC.UI.toast('Nome guardado.'); }
        catch (e) { Lobby.showError(e.code ? FB().explain(e) : e.message); }
      });
      on('ranked', () => Lobby.queueRanked());
      on('private', () => Lobby.createPrivate());
      on('join', () => Lobby.joinByCode(b.querySelector('#lobby-code').value));
      b.querySelector('#lobby-code').onkeydown = (e) => { if (e.key === 'Enter') Lobby.joinByCode(e.target.value); };
      on('signout', () => FB().signOut());
    },

    viewWaiting(b, w) {
      if (!w) return Lobby.view('home');
      const link = `${location.origin}${location.pathname}?sala=${w.id}`;
      b.innerHTML = w.ranked
        ? `<div class="lobby-center"><div class="spinner"></div><h3>À procura de adversário…</h3><p>Rating ${Lobby.profile.rating}. Assim que alguém entrar na fila, a partida começa.</p><button class="btn ghost" data-a="cancel">Cancelar</button></div>`
        : `<div class="lobby-center"><h3>Sala privada</h3><p>Partilha o código ou o link:</p><div class="code-box">${esc(w.id)}</div>
           <div class="row-btns tight"><input class="text-in" id="lobby-link" readonly value="${esc(link)}"><button class="btn small" data-a="copy">Copiar link</button></div>
           <div class="spinner"></div><p>À espera do adversário…</p><button class="btn ghost" data-a="cancel">Cancelar</button></div>`;
      b.querySelector('[data-a="cancel"]').onclick = async () => { await Lobby.stopWaiting(); Lobby.view('home'); };
      const copy = b.querySelector('[data-a="copy"]');
      if (copy) copy.onclick = async () => {
        try { await navigator.clipboard.writeText(link); copy.textContent = 'Copiado!'; } catch (e) { b.querySelector('#lobby-link').select(); copy.textContent = 'Seleciona e copia'; }
      };
    },

    deck() {
      const p = YC.ProfileStore.profile, d = YC.Economy.activeDeck(p), v = YC.Economy.validateDeck(p, d.cards);
      if (!v.ok) { YC.UI.toast(`O teu baralho ativo não é válido: ${v.errors[0]}`, true); return null; }
      return d.cards.slice();
    },

    async createPrivate() {
      const deck = Lobby.deck(); if (!deck) return;
      try { Lobby.waitFor(await YC.Online.createRoom(Lobby.profile, false, deck), false); }
      catch (err) { Lobby.showError(FB().explain(err)); }
    },

    async joinByCode(code) {
      code = String(code || '').toUpperCase().trim();
      if (code.length !== 5) { if (Lobby.showError) Lobby.showError('O código tem 5 letras.'); return; }
      const deck = Lobby.deck(); if (!deck) return;
      try { await Lobby.launch(await YC.Online.joinRoom(code, Lobby.profile, deck)); }
      catch (err) { if (Lobby.showError) Lobby.showError(err.code ? FB().explain(err) : err.message); }
    },

    async queueRanked() {
      if (Lobby.profile.guest) return;
      const deck = Lobby.deck(); if (!deck) return;
      Lobby.view('loading', 'A procurar adversário…');
      try {
        const joined = await YC.Online.findRanked(Lobby.profile, deck);
        if (joined) return Lobby.launch(joined);
        Lobby.waitFor(await YC.Online.createRoom(Lobby.profile, true, deck), true);
      } catch (err) { Lobby.view('home'); Lobby.showError(FB().explain(err)); }
    },

    waitFor(id, ranked) {
      const w = { id, ranked, created: Date.now() };
      Lobby.waiting = w;
      Lobby.view('waiting', w);
      w.hb = setInterval(() => YC.Online.heartbeat(id, Lobby.profile.uid), 10000);
      w.unsub = YC.Online.watch(id, (m) => {
        if (Lobby.waiting !== w || !m) return;
        if (m.status === 'playing') { Lobby.clearWaiting(w); Lobby.launch(id); }
      });
      if (ranked) {
        w.scan = setInterval(async () => {
          if (Lobby.waiting !== w || w.scanning) return;
          w.scanning = true;
          try {
            const other = await YC.Online.findRanked(Lobby.profile, Lobby.deck() || [], w.created);
            if (other && Lobby.waiting === w) { Lobby.clearWaiting(w); await YC.Online.cancelWaiting(id); await Lobby.launch(other); }
          } finally { w.scanning = false; }
        }, 6000);
      }
      w.unload = () => YC.Online.cancelWaiting(id);
      window.addEventListener('beforeunload', w.unload);
    },

    clearWaiting(w) {
      if (!w) return;
      clearInterval(w.hb); clearInterval(w.scan);
      if (w.unsub) w.unsub();
      window.removeEventListener('beforeunload', w.unload);
      if (Lobby.waiting === w) Lobby.waiting = null;
    },

    async stopWaiting() {
      const w = Lobby.waiting;
      if (!w) return;
      Lobby.clearWaiting(w);
      await YC.Online.cancelWaiting(w.id);
    },

    async launch(id) {
      Lobby.view('loading', 'Adversário encontrado! A preparar o tabuleiro…');
      YC.Sound.play('turn');
      let match = null;
      for (let i = 0; i < 10 && !(match && match.black); i++) {
        const snap = await FB().F.getDoc(YC.Online.matchRef(id));
        match = snap.exists() ? { id, ...snap.data() } : null;
        if (!(match && match.black)) await wait(400);
      }
      if (!match || !match.black) return Lobby.view('error', 'A sala desapareceu antes de começar.');
      Lobby.view('home');
      if (YC.PlayMenu) YC.PlayMenu.close();
      if (YC.ArenaRanking) YC.ArenaRanking.at = 0;
      await YC.App.startOnline(match, Lobby.profile);
    }
  };

  YC.OnlineLobby = Lobby;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
