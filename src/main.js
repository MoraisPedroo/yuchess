/* main.js — arranque: perfil, som, hub, partidas contra o bot e online, recompensas. */
(function (YC) {
  'use strict';

  const BOT_RARITY = { easy: 'RARE', medium: 'EPIC', hard: 'LEGENDARY' };
  const BOT_NAMES = { easy: 'Bot Peãozinho', medium: 'Bot Cavaleiro', hard: 'Bot Grão-Mestre' };

  const App = {
    match: null, ui: null, online: null,

    boot() {
      document.body.insertAdjacentHTML('afterbegin', YC.PieceArt.defs());
      YC.ProfileStore.load();
      try { YC.FX.speed = localStorage.getItem('chessgioh.speed') === 'fast' ? YC.FX.FAST : YC.FX.NORMAL; } catch (e) { /* */ }
      window.addEventListener('pointerdown', () => YC.Sound.init(), { passive: true });
      YC.Hub.init(App);
      const code = new URLSearchParams(location.search).get('sala');
      YC.Hub.show(code ? 'online' : 'arena');
      if (code) YC.OnlineLobby.pendingCode = code.toUpperCase();
      YC.OnlineLobby.autoConnect();
    },

    inMatch() { return !!(App.match && !App.match.over); },

    leaveMatch(resign) {
      if (App.match && !App.match.over && resign) {
        if (App.online) App.online.resign(); else App.match.resign(App.ui.viewer);
      }
      if (App.match) App.match.aborted = true;
      if (App.online) { App.online.close(); App.online = null; }
      if (App.ui) { App.ui.unmount(); App.ui = null; }
      document.querySelectorAll('.end-back').forEach((e) => e.remove());
      App.match = null;
    },

    newUI() {
      App.leaveMatch(false);
      const ui = new YC.MatchUI({ root: document.getElementById('screen-match'), onExit: () => { App.leaveMatch(false); YC.Hub.show('arena'); } });
      App.ui = ui;
      return ui;
    },

    /** Partida contra o bot com o baralho ativo. */
    startBot(level = 'medium', clockMin = 10) {
      const p = YC.ProfileStore.profile, deck = YC.Economy.activeDeck(p);
      const v = YC.Economy.validateDeck(p, deck.cards);
      if (!v.ok) { YC.UI.toast(`Baralho inválido: ${v.errors[0]}`, true); YC.Hub.show('decks'); return; }
      const rng = YC.mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);
      const me = rng() < 0.5 ? 'w' : 'b', bot = YC.other(me);
      const botDeck = YC.Economy.randomDeck(rng, { maxRarity: BOT_RARITY[level] });
      const bus = new YC.EventBus();
      const decks = { [me]: deck.cards.slice(), [bot]: botDeck };
      const names = { [me]: p.displayName, [bot]: BOT_NAMES[level] };
      const match = new YC.Match({ bus, seed: Math.floor(rng() * 2 ** 31), decks, names, mode: 'BOT' });
      const ui = App.newUI();
      App.match = match;
      ui.mount({ match, viewer: me, clockMs: clockMin * 60000, labels: { [me]: 'Tu', [bot]: `Bot · ${YC.BotAI.LEVELS[level].label}` } });
      match.agents[me] = ui.createHumanAgent(me);
      match.agents[bot] = YC.BotAI.create({ team: bot, level, delay: 1100, seed: Math.floor(rng() * 1e6) });
      ui.onGameOver = ({ winner }) => App.reward(winner, me, match);
      ui.onRematch = () => App.startBot(level, clockMin);
      YC.Hub.show('match');
      YC.UI.toast(me === 'w' ? 'Jogas com as Brancas: começas tu!' : 'Jogas com as Pretas: o bot começa.');
      match.start().catch((err) => console.error('[partida]', err));
    },

    reward(winner, me, match) {
      if (match.aborted) return null;
      const outcome = winner === me ? 'WIN' : winner === 'DRAW' ? 'DRAW' : 'LOSS';
      const r = YC.ProfileStore.update((p) => YC.Economy.reward(p, outcome, match.state.ownTurns[me]));
      return r;
    },

    /** Partida online a partir de uma sala do Firestore (chamado pelo OnlineLobby). */
    async startOnline(room, profile) {
      const ui = App.newUI();
      ui.bus = new YC.EventBus();
      const og = new YC.OnlineGame({ match: room, profile, ui });
      App.online = og;
      const game = await og.start();
      App.match = game;
      const opp = og.opp;
      ui.mount({ match: game, viewer: og.team, online: og, labels: { [og.team]: `${profile.rating} pts`, [og.oppTeam]: `${opp.rating} pts` } });
      ui.onGameOver = async ({ winner }) => {
        const base = App.reward(winner, og.team, game) || {};
        const rr = await og.finish(winner);
        let rating = '';
        if (rr && rr.delta != null) rating = `Rating ${rr.before} → ${rr.before + rr.delta} (${rr.delta >= 0 ? '+' : ''}${rr.delta})`;
        else if (rr && rr.pending) rating = 'Rating: à espera da confirmação do adversário…';
        else if (rr && rr.conflict) rating = 'Rating: os resultados não coincidem (não contou).';
        return { ...base, rating };
      };
      YC.Hub.show('match');
      YC.UI.toast(og.team === 'w' ? 'Jogas com as Brancas: começas tu!' : 'Jogas com as Pretas.');
      game.start().catch((err) => console.error('[online]', err));
    }
  };

  YC.App = App;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.boot());
  else App.boot();
})(window.YC = window.YC || {});
