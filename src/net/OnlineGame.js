/* OnlineGame.js — liga uma sala do Firestore a um Match: sessão lockstep, batimento, relógio de 2 min
   por turno (ao esgotar joga-se um lance automático), vitória por abandono, "claims" e acerto do rating.
   A interface (MatchUI) fornece: bus, toast(), cancelMode(), renderOnline(), createHumanAgent(team).
   O relógio que aparece no topo da arena vem de `turnLeft()`. */
(function (YC) {
  'use strict';

  const TURN_MS = 120000;
  const FB = () => YC.Firebase;

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
      if (this.ranked) {
        try { this.escrowed = await YC.Ranking.escrow(m, this.uid); }
        catch (err) { ui.toast(`Ranking indisponível: ${FB().explain(err)}`); console.warn('[ranking] escrow', err); }
      }
      return game;
    }

    oppStatus() {
      const seen = FB().millis(this.match.lastSeen && this.match.lastSeen[this.opp.uid]);
      return { name: this.opp.name, rating: this.opp.rating, online: !seen || Date.now() - seen < 60000 };
    }

    clockText() {
      const s = this.game && this.game.state;
      if (!s || s.winner || s.active !== this.team || !this.deadline) return '';
      const left = Math.max(0, Math.ceil((this.deadline - Date.now()) / 1000));
      return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    }

    /** Tempo que falta no turno de quem está a jogar (os dois lados contam desde que viram o turno começar). */
    turnLeft() { return this.turnStart ? Math.max(0, TURN_MS - (Date.now() - this.turnStart)) : TURN_MS; }

    canClaimForfeit() {
      const s = this.game && this.game.state;
      return !!s && !s.winner && s.active === this.oppTeam && YC.Online.stallMs(this.match, this.uid) > YC.Online.FORFEIT_MS + 3000;
    }

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
      this.ui.renderOnline();
    }

    async claimForfeit() {
      if (!this.canClaimForfeit()) return false;
      try {
        await YC.Online.forfeit(this.match.id, this.uid, this.team);
        this.match.forfeit = { by: this.uid };
        this.game.resign(this.oppTeam, 'Abandono');
        this.session.inbox.interrupt();
        return true;
      } catch (err) {
        this.ui.toast(`Ainda não dá para reclamar: ${FB().explain(err)}`);
        return false;
      }
    }

    resign() { this.session.resign(); }

    /** No fim: regista a "claim" e acerta o rating. winner: 'w' | 'b' | 'DRAW'. */
    async finish(winner) {
      clearInterval(this.tick);
      const m = this.match, uid = this.uid;
      const claim = winner === 'DRAW' ? 'DRAW' : YC.TEAM_NAME[winner];
      if (!(m.claims && m.claims[uid])) {
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
          if (outcome === 'WIN' && YC.Online.stallMs(mm, uid) > YC.Online.FORFEIT_MS + 3000) {
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
      if (this.session) this.session.close();
    }
  }

  OnlineGame.TURN_MS = TURN_MS;
  YC.OnlineGame = OnlineGame;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
