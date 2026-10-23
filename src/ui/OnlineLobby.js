/* OnlineLobby.js — "Salão online": login (Google ou convidado), perfil e rating, fila ranqueada,
   salas privadas por código/link e classificação. Quando a partida arranca chama onMatchStart. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.CardView.escape(s);
  const FB = () => YC.Firebase;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  class OnlineLobby {
    constructor({ audio, onMatchStart, onBack }) {
      this.audio = audio;
      this.onMatchStart = onMatchStart;
      this.onBack = onBack;
      this.node = null;
      this.profile = null;
      this.waiting = null;
      this.prefill = '';
    }

    async open(prefillCode = '') {
      this.prefill = (prefillCode || '').toUpperCase();
      if (!this.node) {
        this.node = document.createElement('div');
        this.node.className = 'screen lobby-screen';
        this.node.innerHTML = `<div class="curtain-l"></div><div class="curtain-r"></div>
          <div class="lobby-card"><header><h2>Salão Online</h2><button class="btn-link" data-back>← Voltar</button></header><div class="lobby-body"></div></div>`;
        document.getElementById('screen-root').appendChild(this.node);
        this.node.querySelector('[data-back]').addEventListener('click', () => this.back());
      }
      this.view('loading');
      try {
        await FB().load();
      } catch (err) {
        this.view('error', `Não consegui carregar o Firebase: ${FB().explain(err)}`);
        return;
      }
      if (this.unsubUser) this.unsubUser();
      this.unsubUser = FB().onUser((user) => this.onUser(user));
    }

    async back() {
      await this.stopWaiting();
      this.close();
      if (this.onBack) this.onBack();
    }

    close() {
      if (this.unsubUser) { this.unsubUser(); this.unsubUser = null; }
      if (this.node) { this.node.remove(); this.node = null; }
    }

    body() { return this.node.querySelector('.lobby-body'); }

    async onUser(user) {
      if (!this.node) return;
      if (!user) { this.profile = null; this.view('signin'); return; }
      this.view('loading', 'A abrir o teu perfil…');
      try {
        const wanted = this.pendingName || '';
        this.profile = await YC.Ranking.ensureProfile(user, wanted);
        this.profile.guest = user.isAnonymous;
        YC.Ranking.settlePending(user.uid).then((n) => { if (n) this.refreshProfile(); }).catch(() => {});
        this.view('home');
        if (this.prefill) { const code = this.prefill; this.prefill = ''; this.joinByCode(code); }
      } catch (err) {
        this.view('error', FB().explain(err));
      }
    }

    async refreshProfile() {
      const p = await YC.Ranking.getProfile(this.profile.uid);
      if (p) { this.profile = { ...p, guest: this.profile.guest }; if (this.current === 'home') this.view('home'); }
    }

    // ── Vistas ──
    view(name, arg) {
      if (!this.node) return;
      this.current = name;
      const b = this.body();
      if (name === 'loading') b.innerHTML = `<div class="lobby-center"><div class="spinner"></div><p>${esc(arg || 'A ligar ao Firebase…')}</p></div>`;
      if (name === 'error') {
        b.innerHTML = `<div class="lobby-center"><p class="lobby-error">${esc(arg)}</p><button class="btn-big" data-retry>Tentar de novo</button></div>`;
        b.querySelector('[data-retry]').addEventListener('click', () => this.open(this.prefill));
      }
      if (name === 'signin') this.viewSignin(b);
      if (name === 'home') this.viewHome(b);
      if (name === 'waiting') this.viewWaiting(b, arg);
    }

    viewSignin(b) {
      b.innerHTML = `<div class="lobby-signin">
        <p>Joga contra pessoas reais. A <b>ranqueada</b> é em Speed Duel e mexe no teu rating; as <b>salas privadas</b> servem para jogar com amigos por código (Speed Duel ou Xadrez clássico).</p>
        <label for="lobby-name">Nome no placar</label>
        <input id="lobby-name" maxlength="20" autocomplete="nickname" placeholder="ex.: Pedro">
        <div class="lobby-row"><button class="btn-big" data-google>Entrar com Google</button><button class="btn-big alt" data-guest>Jogar como convidado</button></div>
        <p class="lobby-note">Convidados jogam salas privadas. A ranqueada precisa de conta Google.</p>
        <p class="lobby-error" hidden></p></div>`;
      const err = b.querySelector('.lobby-error');
      const go = async (fn) => {
        this.pendingName = b.querySelector('#lobby-name').value;
        err.hidden = true;
        try { await fn(); } catch (e) { err.textContent = FB().explain(e); err.hidden = false; }
      };
      b.querySelector('[data-google]').addEventListener('click', () => go(() => FB().signInGoogle()));
      b.querySelector('[data-guest]').addEventListener('click', () => go(() => FB().signInGuest()));
    }

    viewHome(b) {
      const p = this.profile;
      b.innerHTML = `
        <div class="lobby-profile">
          <div class="lobby-who">
            <label for="lobby-rename">Nome</label>
            <div class="lobby-row tight"><input id="lobby-rename" maxlength="20" value="${esc(p.name)}"><button class="btn small" data-rename>Guardar</button></div>
            <small>${p.guest ? 'Convidado (só salas privadas)' : 'Conta Google'}</small>
          </div>
          <div class="lobby-rating"><b>${p.rating}</b><small>rating</small></div>
          <div class="lobby-record">${p.wins}V · ${p.losses}D · ${p.draws}E<small>${p.games} ranqueadas</small></div>
        </div>
        <p class="lobby-deck">${this.deckOk() ? '🃏 Deck de Speed Duel pronto (12 cartas).' : '⚠ O teu deck de Speed Duel não é válido: monta-o em Speed Duel → Montar Deck. Até lá só podes jogar Xadrez clássico.'}</p>
        <div class="lobby-actions">
          <button class="btn-big" data-ranked ${p.guest || !this.deckOk() ? 'disabled' : ''}>⚔ Ranqueada · Speed Duel</button>
          <div class="lobby-private"><label for="lobby-mode">Sala privada</label>
            <div class="lobby-row tight"><select id="lobby-mode"><option value="DUEL"${this.deckOk() ? '' : ' disabled'}>Speed Duel</option><option value="CHESS"${this.deckOk() ? '' : ' selected'}>Xadrez clássico 8×8</option></select>
            <button class="btn-big alt" data-private>Criar</button></div></div>
          <div class="lobby-join"><label for="lobby-code">Código da sala</label>
            <div class="lobby-row tight"><input id="lobby-code" maxlength="5" autocomplete="off" placeholder="ABCDE"><button class="btn-big alt" data-join>Entrar</button></div></div>
        </div>
        <p class="lobby-error" hidden></p>
        <h3>Classificação</h3>
        <ol class="leaderboard"><li class="empty">A carregar…</li></ol>
        <button class="btn-link" data-signout>Terminar sessão</button>`;
      const err = b.querySelector('.lobby-error');
      this.showError = (msg) => { err.textContent = msg; err.hidden = !msg; };
      b.querySelector('[data-rename]').addEventListener('click', async () => {
        try { this.profile.name = await YC.Ranking.rename(p.uid, b.querySelector('#lobby-rename').value); this.showError(''); this.audio.playCoin(); }
        catch (e) { this.showError(e.code ? FB().explain(e) : e.message); }
      });
      b.querySelector('[data-ranked]').addEventListener('click', () => this.queueRanked());
      b.querySelector('[data-private]').addEventListener('click', () => this.createPrivate(b.querySelector('#lobby-mode').value));
      b.querySelector('[data-join]').addEventListener('click', () => this.joinByCode(b.querySelector('#lobby-code').value));
      b.querySelector('#lobby-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') this.joinByCode(e.target.value); });
      b.querySelector('[data-signout]').addEventListener('click', () => FB().signOut());
      this.loadLeaderboard(b.querySelector('.leaderboard'));
    }

    async loadLeaderboard(list) {
      try {
        const rows = await YC.Ranking.leaderboard(30);
        if (!list.isConnected) return;
        list.innerHTML = rows.length
          ? rows.map((r, i) => `<li class="${r.uid === this.profile.uid ? 'me' : ''}"><span class="pos">${i + 1}</span><span class="nm">${esc(r.name)}</span><b>${r.rating}</b><small>${r.wins}V ${r.losses}D ${r.draws}E</small></li>`).join('')
          : '<li class="empty">Ainda ninguém jogou ranqueadas. Sê o primeiro!</li>';
      } catch (err) {
        if (list.isConnected) list.innerHTML = `<li class="empty">${esc(FB().explain(err))}</li>`;
      }
    }

    viewWaiting(b, w) {
      const link = `${location.origin}${location.pathname}?sala=${w.id || ''}`;
      b.innerHTML = w.ranked
        ? `<div class="lobby-center"><div class="spinner"></div><h3>À procura de adversário…</h3><p>Rating ${this.profile.rating}. Assim que alguém entrar na fila, a partida começa.</p>
           <button class="btn-big alt" data-cancel>Cancelar</button></div>`
        : `<div class="lobby-center"><h3>Sala privada</h3><p>Partilha o código ou o link com o teu adversário:</p>
           <div class="code-box">${esc(w.id)}</div>
           <div class="lobby-row tight"><input id="lobby-link" readonly value="${esc(link)}"><button class="btn small" data-copy>Copiar link</button></div>
           <div class="spinner"></div><p>À espera que entre…</p><button class="btn-big alt" data-cancel>Cancelar</button></div>`;
      b.querySelector('[data-cancel]').addEventListener('click', async () => { await this.stopWaiting(); this.view('home'); });
      const copy = b.querySelector('[data-copy]');
      if (copy) copy.addEventListener('click', async () => {
        const input = b.querySelector('#lobby-link');
        try { await navigator.clipboard.writeText(input.value); copy.textContent = 'Copiado!'; }
        catch (e) { input.select(); copy.textContent = 'Seleciona e copia'; }
      });
    }

    // ── Salas ──
    deck() { return YC.Collection.load().deck; }
    deckOk() { return YC.Online.validDeck(this.deck()); }

    async createPrivate(mode = 'DUEL') {
      try {
        const id = await YC.Online.createRoom(this.profile, false, { mode, deck: this.deck() });
        this.waitFor(id, false);
      } catch (err) { this.showError(FB().explain(err)); }
    }

    async joinByCode(code) {
      code = String(code || '').toUpperCase().trim();
      if (code.length !== 5) { if (this.showError) this.showError('O código tem 5 letras.'); return; }
      try {
        const id = await YC.Online.joinRoom(code, this.profile, { deck: this.deckOk() ? this.deck() : null });
        await this.launch(id);
      } catch (err) { if (this.showError) this.showError(err.code ? FB().explain(err) : err.message); }
    }

    async queueRanked() {
      if (this.profile.guest) return;
      this.view('loading', 'A procurar adversário…');
      try {
        const joined = await YC.Online.findRanked(this.profile, null, this.deck());
        if (joined) { await this.launch(joined); return; }
        const id = await YC.Online.createRoom(this.profile, true, { mode: 'DUEL', deck: this.deck() });
        this.waitFor(id, true);
      } catch (err) { this.view('home'); this.showError(FB().explain(err)); }
    }

    /** Fica à espera na própria sala; na ranqueada continua a procurar salas mais antigas. */
    waitFor(id, ranked) {
      const w = { id, ranked, created: Date.now() };
      this.waiting = w;
      this.view('waiting', w);
      w.hb = setInterval(() => YC.Online.heartbeat(id, this.profile.uid), 10000);
      w.unsub = YC.Online.watch(id, (m) => {
        if (this.waiting !== w || !m) return;
        if (m.status === 'playing') { this.clearWaiting(w); this.launch(id); }
      });
      if (ranked) {
        w.scan = setInterval(async () => {
          if (this.waiting !== w || w.scanning) return;
          w.scanning = true;
          try {
            const other = await YC.Online.findRanked(this.profile, w.created, this.deck());
            if (other && this.waiting === w) { this.clearWaiting(w); await YC.Online.cancelWaiting(id); await this.launch(other); }
          } finally { w.scanning = false; }
        }, 6000);
      }
      w.unload = () => YC.Online.cancelWaiting(id);
      window.addEventListener('beforeunload', w.unload);
    }

    clearWaiting(w) {
      if (!w) return;
      clearInterval(w.hb); clearInterval(w.scan);
      if (w.unsub) w.unsub();
      window.removeEventListener('beforeunload', w.unload);
      if (this.waiting === w) this.waiting = null;
    }

    async stopWaiting() {
      const w = this.waiting;
      if (!w) return;
      this.clearWaiting(w);
      await YC.Online.cancelWaiting(w.id);
    }

    async launch(id) {
      this.view('loading', 'Adversário encontrado! A preparar o palco…');
      this.audio.playCoin();
      let match = null;
      for (let i = 0; i < 10 && !(match && match.black); i++) {
        const snap = await FB().F.getDoc(YC.Online.matchRef(id));
        match = snap.exists() ? { id, ...snap.data() } : null;
        if (!(match && match.black)) await wait(400);
      }
      if (!match || !match.black) { this.view('error', 'A sala desapareceu antes de começar.'); return; }
      const profile = this.profile;
      this.close();
      this.onMatchStart(match, profile);
    }
  }

  YC.OnlineLobby = OnlineLobby;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
