/* main.js — arranque: monta o palco, liga áudio/VFX ao EventBus, ecrã de título e ciclo de partidas.
   Cada partida recebe um "bus" com portão: eventos de uma partida abandonada nunca chegam ao ecrã. */
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
  const front = new YC.EventBus();
  const vfx = new YC.VFXPostProcessor();
  vfx.mount();
  const audio = new YC.VintageAudioSynth();
  const animator = new YC.PieceFactory.IdleAnimator();
  vfx.onTick(() => animator.tick());
  const renderer = new YC.CupheadSVGRenderer({ bus: front, vfx, audio, animator });
  renderer.mount(document.getElementById('board'));
  const ui = new YC.UIManager({ bus: front, renderer, vfx, audio });
  ui.mount();

  let current = null;
  let currentMode = 'AI';
  let titleNode = null;

  function layout() {
    const table = document.getElementById('table');
    const opp = document.getElementById('opp-strip');
    const frame = 52;
    const h = table.clientHeight - opp.offsetHeight - frame - 10;
    const w = table.clientWidth - frame - 8;
    const sq = Math.max(34, Math.floor(Math.min(h, w) / 8));
    renderer.setSquareSize(sq);
    ui.scheduleRender();
  }
  window.addEventListener('resize', layout);

  // ── Definições ──
  function applySettings() {
    audio.setMusic(settings.music);
    audio.setSfx(settings.sfx);
    vfx.setFilm(settings.film);
    vfx.setBoiling(settings.boil);
    renderer.speed = settings.fast ? 0.55 : 1;
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
  document.getElementById('btn-rules').addEventListener('click', () => YC.Screens.rules());
  document.getElementById('btn-menu').addEventListener('click', async () => {
    if (current && !current.state.winner) {
      const text = current.online ? 'Sair para o menu? Na partida online isso conta como desistência.' : 'Sair para o menu? A partida atual perde-se.';
      if (!(await confirmBox(text))) return;
      if (current.online) current.online.resign();
    }
    showTitle();
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

  /** Bus com portão: só a partida atual fala com o ecrã. */
  function gatedBus(token) {
    return {
      emit: (t, p) => { if (current === token.game) front.emit(t, p); },
      emitAsync: (t, p) => (current === token.game ? front.emitAsync(t, p) : Promise.resolve()),
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
  }

  function showTitle() {
    stopCurrent();
    if (lobby) lobby.close();
    document.documentElement.classList.remove('slowmo');
    if (titleNode) titleNode.remove();
    titleNode = YC.Screens.title({ onStart: (mode) => (mode === 'ONLINE' ? openLobby() : startGame(mode)), onRules: () => YC.Screens.rules() });
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

  /** Prepara o palco para uma partida já criada e corre-a até ao fim. */
  async function launch(game, intro = true) {
    current = game;
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
    await closeTitle();
    document.documentElement.classList.remove('slowmo');
    const token = {};
    const names = mode === 'AI' ? { WHITE: 'Brancas', BLACK: 'King Dice' } : { WHITE: 'Brancas', BLACK: 'Pretas' };
    const game = new YC.GameController({ bus: gatedBus(token), mode, names });
    token.game = game;
    game.agents.WHITE = ui.createHumanAgent('WHITE');
    game.agents.BLACK = mode === 'AI' ? new YC.KingDiceAI('BLACK', { delay: 750 }) : ui.createHumanAgent('BLACK');
    await launch(game);
  }

  // ── Modo online (Firebase) ──
  let lobby = null;
  async function openLobby(code) {
    currentMode = 'ONLINE';
    startAudio().catch(() => {});
    stopCurrent();
    await closeTitle();
    if (lobby) lobby.close();
    lobby = new YC.OnlineLobby({ audio, onMatchStart: (match, profile) => startOnline(match, profile), onBack: () => showTitle() });
    lobby.open(code);
  }

  async function startOnline(match, profile) {
    stopCurrent();
    document.documentElement.classList.remove('slowmo');
    const token = {};
    const online = new YC.OnlineGame({ match, profile, ui, bus: gatedBus(token) });
    const game = await online.start();
    token.game = game;
    if (match.id && history.replaceState) history.replaceState(null, '', location.pathname);
    await launch(game);
  }

  // Desistência/abandono do adversário: fecha a janela da Chain que estivesse aberta.
  front.on('PHASE_CHANGED', ({ phase }) => {
    if (phase === 'GAME_OVER') { YC.Screens.closeChainWindow(); ui.cancelMode(); }
  });

  front.on('GAME_OVER', async ({ winner, stats, game }) => {
    if (game !== current) return;
    document.documentElement.classList.add('slowmo');
    const rating = game.online ? game.online.finish(winner) : null;
    await YC.Screens.wait(1100);
    const viewerWon = game.localTeam ? winner === game.localTeam : game.mode === 'AI' ? winner === 'WHITE' : winner !== 'DRAW';
    if (viewerWon) audio.playVictory(); else audio.playDefeat();
    document.documentElement.classList.remove('slowmo');
    const choice = await YC.Screens.knockout({ winner, viewerWon, stats, game, rating });
    if (game.online) {
      if (choice === 'again') openLobby(); else showTitle();
      return;
    }
    if (choice === 'again') startGame(currentMode); else showTitle();
  });

  applySettings();
  layout();
  showTitle();
  const roomParam = new URLSearchParams(location.search).get('sala');
  if (roomParam) openLobby(roomParam);
  YC.app = { get game() { return current; }, settings, audio, vfx, renderer, ui, front };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
