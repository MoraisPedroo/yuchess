/* main.js — arranque: monta os palcos (xadrez e Speed Duel), liga áudio/VFX, título, hub e ciclo de partidas.
   Cada partida recebe um "bus" com portão: eventos de uma partida abandonada nunca chegam ao ecrã.
   Xadrez e duelo têm barramentos separados, para que cada interface só ouça o seu jogo. */
(function (YC) {
  'use strict';

  const SETTINGS_KEY = 'chess-oh.settings.v1';
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const defaults = { music: true, sfx: true, film: !reduced, boil: !reduced, fast: reduced };
  function loadSettings() {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (e) { return { ...defaults }; }
  }
  function saveSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* armazenamento indisponível */ } }

  const settings = loadSettings();
  const front = new YC.EventBus();      // xadrez clássico
  const duelFront = new YC.EventBus();  // Speed Duel
  const vfx = new YC.VFXPostProcessor();
  vfx.mount();
  const audio = new YC.VintageAudioSynth();
  const animator = new YC.PieceFactory.IdleAnimator();
  vfx.onTick(() => animator.tick());
  const renderer = new YC.CupheadSVGRenderer({ bus: front, vfx, audio, animator });
  renderer.mount(document.getElementById('board'));
  const ui = new YC.UIManager({ bus: front, renderer, vfx, audio });
  ui.mount();
  const duelUI = new YC.DuelUI({ bus: duelFront, vfx, audio, animator });
  duelUI.mount(document.getElementById('duel'));

  let current = null;
  let currentMode = 'AI';
  let titleNode = null;
  let lobby = null;
  let hub = null;

  function showView(kind) {
    document.getElementById('app').hidden = kind === 'DUEL';
    document.getElementById('duel').hidden = kind !== 'DUEL';
  }

  function layout() {
    if (document.getElementById('app').hidden) return;
    const table = document.getElementById('table');
    const opp = document.getElementById('opp-strip');
    const frame = 52;
    const h = table.clientHeight - opp.offsetHeight - frame - 10;
    const w = table.clientWidth - frame - 8;
    const sq = Math.max(34, Math.floor(Math.min(h, w) / 8));
    renderer.setSquareSize(sq);
    ui.scheduleRender();
  }
  window.addEventListener('resize', () => { layout(); duelUI.scheduleRender(); });

  // ── Definições ──
  function applySettings() {
    audio.setMusic(settings.music);
    audio.setSfx(settings.sfx);
    vfx.setFilm(settings.film);
    vfx.setBoiling(settings.boil);
    renderer.speed = settings.fast ? 0.55 : 1;
    duelUI.arena.speed = renderer.speed;
    const map = { 'btn-music': 'music', 'btn-sfx': 'sfx', 'btn-film': 'film', 'btn-boil': 'boil', 'btn-speed': 'fast' };
    for (const [id, key] of Object.entries(map)) document.getElementById(id).classList.toggle('on', !!settings[key]);
  }
  const toggles = { 'btn-music': 'music', 'btn-sfx': 'sfx', 'btn-film': 'film', 'btn-boil': 'boil', 'btn-speed': 'fast' };
  for (const [id, key] of Object.entries(toggles)) {
    document.getElementById(id).addEventListener('click', () => {
      settings[key] = !settings[key];
      saveSettings(settings);
      applySettings();
      audio.playClick();
    });
  }
  document.getElementById('btn-rules').addEventListener('click', () => {
    if ((current && current.kind === 'DUEL') || hub) YC.DuelHub.showRules(); else YC.Screens.rules();
  });
  document.getElementById('btn-menu').addEventListener('click', async () => {
    const wasDuel = !!(current && current.kind === 'DUEL');
    if (current && !current.state.winner) {
      const text = current.online ? 'Sair para o menu? Na partida online isso conta como desistência.' : 'Sair para o menu? A partida atual perde-se.';
      if (!(await confirmBox(text))) return;
      if (current.online) current.online.resign();
    }
    if (wasDuel) openHub(); else showTitle();
  });
  document.getElementById('btn-resign').addEventListener('click', async () => {
    if (!current || !current.online || current.state.winner) return;
    if (await confirmBox('Desistir desta partida? Contas como derrota.')) current.online.resign();
  });

  function confirmBox(text) {
    return new Promise((resolve) => {
      const m = document.createElement('div');
      m.className = 'modal';
      m.innerHTML = `<div class="modal-card"><h2>${YC.CardView.escape(text)}</h2><div class="modal-actions"><button class="btn-big" data-y>Sim</button><button class="btn-big alt" data-n>Não</button></div></div>`;
      document.getElementById('modal-root').appendChild(m);
      m.querySelector('[data-y]').addEventListener('click', () => { m.remove(); resolve(true); });
      m.querySelector('[data-n]').addEventListener('click', () => { m.remove(); resolve(false); });
    });
  }

  /** Bus com portão: só a partida atual fala com o ecrã certo (xadrez ou duelo). */
  function gatedBus(token, kind) {
    const target = kind === 'DUEL' ? duelFront : front;
    return {
      emit: (t, p) => { if (current === token.game) target.emit(t, p); },
      emitAsync: (t, p) => (current === token.game ? target.emitAsync(t, p) : Promise.resolve()),
      on: () => () => {}, off: () => {}
    };
  }

  function stopCurrent() {
    if (current) {
      if (current.online) current.online.close();
      current.abort();
    }
    current = null;
    document.getElementById('modal-root').innerHTML = '';
    document.getElementById('fx-layer').innerHTML = '';
    document.getElementById('turn-pill').innerHTML = '';
    document.getElementById('btn-resign').hidden = true;
  }

  function closeOverlays() {
    if (lobby) { lobby.close(); lobby = null; }
    if (hub) { hub.close(); hub = null; }
  }

  function showTitle() {
    stopCurrent();
    closeOverlays();
    document.documentElement.classList.remove('slowmo');
    if (titleNode) titleNode.remove();
    titleNode = YC.Screens.title({
      onStart: (mode) => (mode === 'ONLINE' ? openLobby() : mode === 'DUEL' ? openHub() : startGame(mode)),
      onRules: () => YC.Screens.rules()
    });
  }

  async function startAudio() {
    await audio.init();
    applySettings();
    audio.startGramophoneAmbience();
    audio.startSwingLoop(124);
  }
  // Se a página abriu por um link de sala, o áudio arranca no primeiro clique.
  document.addEventListener('pointerdown', () => { startAudio().catch(() => {}); }, { once: true });

  async function closeTitle() {
    if (!titleNode) return;
    const ir = await YC.Screens.iris(true);
    titleNode.remove(); titleNode = null;
    ir.remove();
  }

  // ── Xadrez clássico ──
  async function launch(game, intro = true) {
    current = game;
    showView('CHESS');
    game.wait = (ms) => new Promise((r) => setTimeout(r, ms * renderer.speed));
    game.setup();
    renderer.setFlip(game.localTeam === 'BLACK');
    renderer.bindGame(game);
    ui.bindGame(game);
    layout();
    if (intro) await YC.Screens.intro(audio);
    if (current !== game) return;
    game.log(game.mode === 'ONLINE'
      ? `Partida online: jogas com as ${YC.TEAM_LABEL[game.localTeam]}. As Brancas começam.`
      : 'O espetáculo começa! Joga uma carta que combine com a pilha para mexer as peças.', 'turn');
    await game.start();
  }

  async function startGame(mode) {
    currentMode = mode;
    await startAudio();
    audio.playCoin();
    stopCurrent();
    closeOverlays();
    await closeTitle();
    document.documentElement.classList.remove('slowmo');
    const token = {};
    const names = mode === 'AI' ? { WHITE: 'Brancas', BLACK: 'King Dice' } : { WHITE: 'Brancas', BLACK: 'Pretas' };
    const game = new YC.GameController({ bus: gatedBus(token, 'CHESS'), mode, names });
    token.game = game;
    game.agents.WHITE = ui.createHumanAgent('WHITE');
    game.agents.BLACK = mode === 'AI' ? new YC.KingDiceAI('BLACK', { delay: 750 }) : ui.createHumanAgent('BLACK');
    await launch(game);
  }

  // ── Speed Duel ──
  async function openHub(tab) {
    startAudio().catch(() => {});
    stopCurrent();
    closeOverlays();
    await closeTitle();
    showView('DUEL');
    hub = new YC.DuelHub({
      audio, vfx,
      onDuelAI: (save) => { hub = null; startDuelAI(save); },
      onOnline: () => { hub = null; openLobby(); },
      onChess: (mode) => { hub = null; startGame(mode); },
      onBack: () => { hub = null; showTitle(); }
    });
    hub.open(tab);
  }

  async function launchDuel(game, intro = true) {
    current = game;
    showView('DUEL');
    game.wait = (ms) => new Promise((r) => setTimeout(r, ms * renderer.speed));
    game.setup();
    duelUI.bindGame(game);
    if (intro) await YC.Screens.intro(audio);
    if (current !== game) return;
    game.log(game.mode === 'ONLINE' ? 'Duelo online! 4000 LP para cada lado.' : 'Hora do duelo! 4000 LP, baralho de 12 cartas. Boa sorte contra o Rei Dado.', 'turn');
    await game.start();
  }

  async function startDuelAI(save) {
    currentMode = 'DUEL';
    stopCurrent();
    closeOverlays();
    audio.playCoin();
    const token = {};
    const game = new YC.DuelController({
      bus: gatedBus(token, 'DUEL'), mode: 'AI', names: { WHITE: 'Duelista', BLACK: 'Rei Dado' },
      decks: { WHITE: save.deck.slice(), BLACK: YC.Collection.aiDeck(Math.random, save.wins) }
    });
    token.game = game;
    game.agents.WHITE = duelUI.createHumanAgent('WHITE');
    game.agents.BLACK = new YC.DuelAI('BLACK', { delay: 700 });
    await launchDuel(game);
  }

  // ── Modo online (Firebase) ──
  async function openLobby(code) {
    currentMode = 'ONLINE';
    startAudio().catch(() => {});
    stopCurrent();
    closeOverlays();
    await closeTitle();
    lobby = new YC.OnlineLobby({ audio, onMatchStart: (match, profile) => { lobby = null; startOnline(match, profile); }, onBack: () => { lobby = null; showTitle(); } });
    lobby.open(code);
  }

  async function startOnline(match, profile) {
    stopCurrent();
    document.documentElement.classList.remove('slowmo');
    const isDuel = match.mode !== 'CHESS';
    const token = {};
    const online = new YC.OnlineGame({ match, profile, ui: isDuel ? duelUI : ui, bus: gatedBus(token, isDuel ? 'DUEL' : 'CHESS') });
    const game = await online.start();
    token.game = game;
    if (match.id && history.replaceState) history.replaceState(null, '', location.pathname);
    if (isDuel) await launchDuel(game); else await launch(game);
  }

  // ── Fim de partida ──
  function duelSummary(game, winner, viewerWon) {
    const st = game.state, W = st.players.WHITE.stats, B = st.players.BLACK.stats;
    const me = game.localTeam || 'WHITE';
    const mine = st.players[me];
    const score = (viewerWon ? 50 : 0) + Math.round(mine.lp / 100) + mine.stats.kills * 4 + mine.stats.cutIns * 3 - Math.max(0, st.turnCount - 10);
    const rank = winner === 'DRAW' ? 'C' : !viewerWon ? (mine.lp > 0 ? 'C' : 'D') : score >= 95 ? 'S' : score >= 75 ? 'A' : score >= 55 ? 'B' : 'C';
    const rows = [['Turnos jogados', st.turnCount, ''], ['LP restantes', st.players.WHITE.lp, st.players.BLACK.lp], ['Dano causado', W.damageDealt, B.damageDealt],
      ['Peças destruídas em batalha', W.kills, B.kills], ['Invocações', W.summons, B.summons], ['Armadilhas / Counters', `${W.traps}/${W.counters}`, `${B.traps}/${B.counters}`], ['Cut-Ins', W.cutIns, B.cutIns]];
    return { rows, rank };
  }

  const onPhase = ({ phase }) => {
    if (phase === 'GAME_OVER') { YC.Screens.closeChainWindow(); ui.cancelMode(); duelUI.cancelMode(); }
  };
  front.on('PHASE_CHANGED', onPhase);
  duelFront.on('PHASE_CHANGED', onPhase);

  async function onGameOver({ winner, stats, game }) {
    if (game !== current) return;
    document.documentElement.classList.add('slowmo');
    const rating = game.online ? game.online.finish(winner) : null;
    await YC.Screens.wait(1100);
    const viewerWon = game.localTeam ? winner === game.localTeam : game.mode === 'AI' ? winner === 'WHITE' : winner !== 'DRAW';
    if (viewerWon) audio.playVictory(); else audio.playDefeat();
    document.documentElement.classList.remove('slowmo');
    let extra = {};
    if (game.kind === 'DUEL') {
      extra = duelSummary(game, winner, viewerWon);
      if (game.mode !== 'HOTSEAT') {
        const save = YC.Collection.load();
        extra.coins = YC.Collection.reward(save, viewerWon);
        YC.Collection.save(save);
        audio.playCoin();
      }
    }
    const choice = await YC.Screens.knockout({ winner, viewerWon, stats, game, rating, ...extra });
    if (game.online) { if (choice === 'again') openLobby(); else showTitle(); return; }
    if (game.kind === 'DUEL') { if (choice === 'again') openHub('duel'); else openHub('menu'); return; }
    if (choice === 'again') startGame(currentMode); else showTitle();
  }
  front.on('GAME_OVER', onGameOver);
  duelFront.on('GAME_OVER', onGameOver);

  applySettings();
  layout();
  showTitle();
  const roomParam = new URLSearchParams(location.search).get('sala');
  if (roomParam) openLobby(roomParam);
  YC.app = { get game() { return current; }, settings, audio, vfx, renderer, ui, duelUI, front, duelFront, openHub };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
