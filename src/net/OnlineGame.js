/* OnlineGame.js — liga uma sala do Firestore a um Match: sessão lockstep, batimento, relógio de 2 min por turno
   (ao esgotar, o jogo de quem está a jogar faz um lance automático), vitória por abandono, "claims" e rating.
   Abandono (automático): se o jogo está parado à espera do adversário há 2:30 desde o nosso último envio (o tempo
   dele acabou e o jogo dele não jogou sozinho — fechou o separador, ficou sem rede…) ou se ele está sem sinal há
   1:30, ganhamos sozinhos (Online.forfeit; as regras do Firestore confirmam com o relógio do servidor). Quem perde
   por abandono, se voltar, vê a partida acabar (mensagem FORFEIT). Fechar a página a meio conta como desistir.
   A interface (MatchUI) fornece: bus, toast(), cancelMode(), renderOnline(), createHumanAgent(team). */
(function (YC) {
  'use strict';

  const TURN_MS = 120000;
  const RETRY_MS = 5000;
  const FB = () => YC.Firebase;
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  class OnlineGame {
    constructor({ match, profile, ui }) {
      this.match = match;
      this.profile = profile;
      this.ui = ui;
      this.uid = profile.uid;
      this.team = match.white.uid === profile.uid ? 'w' : 'b';
      this.oppTeam = YC.other(this.team);
      this.escrowed = false;
      this.turnKey = null;
      this.deadline = 0;
      this.closed = false;
      this.nextClaim = 0;
    }

    get opp() { return this.team === 'w' ? this.match.black : this.match.white; }
    get ranked() { return !!this.match.ranked; }

    /** Cria o Match ligado à rede (quem chama faz `game.start()`). */
    async start() {
      const m = this.match, ui = this.ui;
      const game = new YC.Match({
        bus: ui.bus, seed: m.seed, mode: 'ONLINE',
        decks: { w: m.white.deck, b: m.black.deck }, names: { w: m.white.name, b: m.black.name }
      });
      this.game = game;
      game.online = this;
      this.transport = new YC.Online.FirestoreTransport(m.id, this.uid, YC.TEAM_NAME[this.team]);
      this.transport.onMatch = (mm) => { this.match = { ...this.match, ...mm, id: m.id }; ui.renderOnline(); };
      this.transport.onError = (err) => ui.toast(`Ligação: ${FB().explain(err)}`);
      this.session = new YC.LockstepSession({
        game, localTeam: this.team, transport: this.transport, localAgent: ui.createHumanAgent(this.team),
        onDesync: (info) => { console.warn('[online] dessincronização', info); ui.toast('Os dois jogos divergiram. Vê a consola para detalhes.'); }
      }).attach();
      YC.Online.heartbeat(m.id, this.uid);
      this.hb = setInterval(() => YC.Online.heartbeat(m.id, this.uid), 20000);
      this.tick = setInterval(() => this.onTick(), 1000);
      // fechar ou recarregar a página a meio da partida conta como desistir (o adversário ganha logo, sem esperar)
      this.onHide = () => { if (!this.closed && !game.state.winner) this.session.resign(); };
      window.addEventListener('pagehide', this.onHide);
      if (this.ranked) {
        try { this.escrowed = await YC.Ranking.escrow(m, this.uid); }
        catch (err) { ui.toast(`Ranking indisponível: ${FB().explain(err)}`); console.warn('[ranking] escrow', err); }
      }
      return game;
    }

    // ───────────── estado do adversário ─────────────
    /** Há quanto tempo o jogo está parado à espera do adversário (0 se não está). */
    waitMs() { return this.session ? this.session.waitMs() : 0; }
    goneMs() { return YC.Online.goneMs(this.match, this.uid); }

    /** Já podemos ganhar por abandono? Só quando estamos mesmo à espera dele. */
    abandonDue() {
      const s = this.game && this.game.state, w = this.waitMs();
      return !!s && !s.winner && !this.closed && w > 0 && (w > YC.Online.FORFEIT_MS || this.goneMs() > YC.Online.GONE_MS);
    }

    /** Quanto falta para ganhar por abandono (ms), depois de o tempo dele acabar ou de ficar sem sinal; senão null. */
    abandonLeft() {
      const w = this.waitMs(), gone = this.goneMs();
      if (!w || (w < TURN_MS && gone < 45000)) return null;
      return Math.max(0, Math.min(YC.Online.FORFEIT_MS - w, gone >= 45000 ? YC.Online.GONE_MS - gone : Infinity));
    }

    oppStatus() {
      const gone = this.goneMs(), left = this.abandonLeft(), off = gone > 60000;
      let state = off ? `sem sinal há ${fmt(gone)}` : 'ligado';
      if (left != null) state = `${off ? 'sem sinal' : 'não joga'} · ganhas em ${fmt(left)}`;
      return { name: this.opp.name, rating: this.opp.rating, online: !off, state };
    }

    clockText() {
      const s = this.game && this.game.state;
      if (!s || s.winner || s.active !== this.team || !this.deadline) return '';
      return fmt(this.deadline - Date.now());
    }

    /** Tempo que falta no turno de quem está a jogar (os dois lados contam desde que viram o turno começar). */
    turnLeft() { return this.turnStart ? Math.max(0, TURN_MS - (Date.now() - this.turnStart)) : TURN_MS; }

    canClaimForfeit() { return this.abandonDue(); }

    onTick() {
      const g = this.game, s = g && g.state;
      if (!s || s.winner || this.closed) return;
      const key = `${s.turnCount}:${s.active}`;
      if (key !== this.turnKey) { this.turnKey = key; this.turnStart = Date.now(); this.deadline = s.active === this.team ? Date.now() + TURN_MS : 0; }
      if (s.active === this.team && this.deadline && Date.now() > this.deadline && !g.busy && s.phase === 'PREP') {
        this.ui.cancelMode();
        this.ui.toast('Tempo esgotado: foi jogado um lance automático.');
        g.dispatch({ type: 'AUTO_MOVE', team: this.team });
      }
      // o tempo do adversário acabou e o jogo dele não jogou: avisa uma vez e, chegada a hora, ganha sozinho
      const since = this.session.waitSince;
      if (since && this.waitMs() > TURN_MS + 2000 && this.warned !== since) {
        this.warned = since;
        this.ui.toast(`O tempo do adversário acabou. Se não jogar em ${fmt(YC.Online.FORFEIT_MS - this.waitMs())}, ganhas por abandono.`);
      }
      if (this.abandonDue() && !this.claiming && Date.now() >= this.nextClaim) this.claimForfeit(true);
      this.ui.renderOnline();
    }

    /** Vitória por abandono (automática no onTick; o botão "Reclamar vitória" chama-a à mão). */
    async claimForfeit(auto = false) {
      if (!this.abandonDue() || this.claiming) return false;
      this.claiming = true;
      try {
        await YC.Online.forfeit(this.match.id, this.uid, this.team);
        this.match.forfeit = { by: this.uid };
        if (this.game.state.winner) return true;
        this.ui.toast('O adversário abandonou a partida: ganhaste!');
        this.game.resign(this.oppTeam, 'Abandono');
        this.session.inbox.interrupt();
        return true;
      } catch (err) {
        // as regras do servidor ainda não aceitam (relógios desacertados): tenta outra vez daqui a pouco
        this.nextClaim = Date.now() + RETRY_MS;
        if (!auto) this.ui.toast(`Ainda não dá para reclamar: ${FB().explain(err)}`);
        return false;
      } finally {
        this.claiming = false;
      }
    }

    resign() { this.session.resign(); }

    /** No fim: regista a "claim" e acerta o rating. winner: 'w' | 'b' | 'DRAW'. */
    async finish(winner) {
      clearInterval(this.tick);
      const m = this.match, uid = this.uid;
      const claim = winner === 'DRAW' ? 'DRAW' : YC.TEAM_NAME[winner];
      // quem desistiu já registou a claim com a desistência (no mesmo pedido)
      if (!(m.claims && m.claims[uid]) && !this.session.resigned) {
        try { await YC.Online.claim(m.id, uid, claim); } catch (err) { console.warn('[online] claim', err); }
      }
      if (!this.ranked || !this.escrowed) return null;
      const before = YC.Ranking.sides(m, uid).me.rating;
      const outcome = winner === this.team ? 'WIN' : winner === 'DRAW' ? 'DRAW' : 'LOSS';
      try {
        if (outcome === 'LOSS') return { before, delta: await YC.Ranking.settle(this.match, uid, 'LOSS') };
        const until = Date.now() + 200000;
        while (Date.now() < until && !this.closed) {
          const mm = this.match, theirs = mm.claims && mm.claims[this.opp.uid];
          const forfeitMine = mm.forfeit && mm.forfeit.by === uid;
          if (theirs === claim || forfeitMine) return { before, delta: await YC.Ranking.settle(mm, uid, outcome) };
          if (theirs && theirs !== claim) return { before, delta: null, conflict: true };
          // ganhámos, mas o adversário saiu sem confirmar: abandono (depois de 2:30 do nosso último lance ou 1:30 sem sinal)
          const quiet = Date.now() - (this.transport.lastSent || Date.now());
          if (outcome === 'WIN' && !mm.forfeit && (quiet > YC.Online.FORFEIT_MS || this.goneMs() > YC.Online.GONE_MS)) {
            try { await YC.Online.forfeit(mm.id, uid, this.team); this.match.forfeit = { by: uid }; } catch (err) { /* ainda cedo */ }
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        console.warn('[ranking] settle', err);
        return { before, delta: null, error: FB().explain(err) };
      }
      return { before, delta: null, pending: true };
    }

    close() {
      this.closed = true;
      clearInterval(this.hb);
      clearInterval(this.tick);
      window.removeEventListener('pagehide', this.onHide);
      if (this.session) this.session.close();
    }
  }

  OnlineGame.TURN_MS = TURN_MS;
  YC.OnlineGame = OnlineGame;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
