/* Simulador sem ecrã: King Dice AI contra si própria, com verificação de invariantes.
   Uso: node tools/simulate.js [jogos=40] [semente-inicial=1] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ENGINE_FILES = [
  'src/core/EventBus.js', 'src/data/CardDatabase.js', 'src/engine/BoardEngine.js', 'src/engine/CombatRPG.js',
  'src/engine/UnoEconomy.js', 'src/engine/EffectInterpreter.js', 'src/engine/ChainResolver.js',
  'src/engine/GameController.js', 'src/ai/KingDiceAI.js'
];
for (const f of ENGINE_FILES) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const YC = globalThis.YC;

const GAMES = Number(process.argv[2] || 40);
const SEED0 = Number(process.argv[3] || 1);
const TOTAL_CARDS = YC.CardDatabase.buildDeck().length;

function countCards(g) {
  let n = g.uno.deck.length + g.uno.discard.length + g.uno.graveyard.length + g.uno.hands.WHITE.length + g.uno.hands.BLACK.length;
  for (const t of YC.TEAMS) n += g.state.players[t].support.filter(Boolean).length + g.board.trapsOf(t).length;
  return n;
}

function checkInvariants(g, where) {
  const errs = [];
  const seen = new Set();
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = g.board.grid[r][c].piece;
    if (!p) continue;
    if (!p.alive) errs.push(`peça morta na grelha ${r},${c}`);
    if (p.row !== r || p.col !== c) errs.push(`coords erradas ${p.uid}`);
    if (seen.has(p.uid)) errs.push(`peça duplicada ${p.uid}`);
    seen.add(p.uid);
  }
  for (const p of g.board.pieces()) {
    if (!seen.has(p.uid)) errs.push(`peça viva fora da grelha ${p.uid}`);
    if (p.hp <= 0) errs.push(`peça viva com HP ${p.hp}`);
    if (p.hp > p.maxHp) errs.push(`HP acima do máximo ${p.uid}`);
    if (p.shield < 0 || p.tempShield < 0) errs.push(`escudo negativo ${p.uid}`);
  }
  for (const t of YC.TEAMS) if (g.board.pieces(t).filter((p) => p.type === 'KING').length > 1) errs.push('dois reis');
  const cards = countCards(g);
  if (cards !== TOTAL_CARDS) errs.push(`cartas: ${cards} ≠ ${TOTAL_CARDS}`);
  const uids = new Set();
  const all = [...g.uno.deck, ...g.uno.discard, ...g.uno.graveyard, ...g.uno.hands.WHITE, ...g.uno.hands.BLACK];
  for (const t of YC.TEAMS) { all.push(...g.state.players[t].support.filter(Boolean)); all.push(...g.board.trapsOf(t).map((c) => c.trap.card)); }
  for (const c of all) { if (uids.has(c.uid)) errs.push(`carta duplicada ${c.uid}`); uids.add(c.uid); }
  if (g.chain.status !== 'Idle') errs.push(`chain não está Idle: ${g.chain.status}`);
  if (errs.length) throw new Error(`[${where}] ` + errs.join('; '));
}

async function playOne(seed) {
  const bus = new YC.EventBus();
  const rand = YC.mulberry32(seed * 7919);
  const agents = { WHITE: new YC.KingDiceAI('WHITE', { delay: 0, rand }), BLACK: new YC.KingDiceAI('BLACK', { delay: 0, rand }) };
  const g = new YC.GameController({ bus, seed, agents, fast: true, mode: 'AI' });
  const tally = { chains: 0, maxChain: 0, links: 0, negates: 0, traps: 0, combats: 0, bounces: 0, kills: 0, swaps: 0, castles: 0, promos: 0, fallbacks: 0, bonus: 0, plays: 0 };
  bus.on('CHAIN_CLEARED', ({ resolved }) => { tally.chains++; tally.links += resolved.length; tally.maxChain = Math.max(tally.maxChain, resolved.length); });
  bus.on('CHAIN_LINK_NEGATED', () => tally.negates++);
  bus.on('SPATIAL_TRAP_TRIGGERED', () => tally.traps++);
  bus.on('COMBAT_RESOLVED', () => tally.combats++);
  bus.on('PIECE_BOUNCED', () => tally.bounces++);
  tally.kingKilledInCombat = 0; tally.kingDmgCombat = 0;
  bus.on('PIECE_DESTROYED', ({ piece, by }) => { tally.kills++; if (piece.type === 'KING' && by) tally.kingKilledInCombat++; });
  bus.on('COMBAT_RESOLVED', ({ defender, result }) => { if (defender.type === 'KING') tally.kingDmgCombat += result.damage; });
  bus.on('PIECES_SWAPPED', () => tally.swaps++);
  bus.on('PIECE_PROMOTED', () => tally.promos++);
  tally.forced = 0;
  bus.on('FALLBACK_DRAW', ({ team, cards }) => {
    tally.fallbacks++;
    const before = g.uno.hand(team).filter((c) => !cards.includes(c));
    if (!before.some((c) => g.uno.matches(c))) tally.forced++;
  });
  bus.on('UNO_CARD_PLAYED', () => tally.plays++);
  bus.on('PHASE_CHANGED', ({ phase }) => { if (phase === 'BONUS_STEP') tally.bonus++; });
  bus.on('TURN_ENDED', () => checkInvariants(g, `turno ${g.state.turnCount}`));
  let lastErr = null;
  const origErr = console.error;
  console.error = (...a) => { lastErr = a.map((x) => (x && x.stack) || String(x)).join(' '); };
  const winner = await g.start();
  console.error = origErr;
  if (lastErr) throw new Error(`seed ${seed}: erro interno → ${lastErr}`);
  checkInvariants(g, 'fim');
  return { seed, winner, turns: g.state.turnCount, tally, stats: g.state.stats, kingHp: { W: (g.board.king('WHITE') || { hp: 0 }).hp, B: (g.board.king('BLACK') || { hp: 0 }).hp } };
}

(async () => {
  const results = [];
  const t0 = Date.now();
  for (let i = 0; i < GAMES; i++) {
    try { results.push(await playOne(SEED0 + i)); }
    catch (err) { console.log('FALHA', err.message); process.exitCode = 1; }
  }
  const wins = { WHITE: 0, BLACK: 0, DRAW: 0 };
  const sum = {};
  for (const r of results) {
    wins[r.winner]++;
    for (const [k, v] of Object.entries(r.tally)) sum[k] = (sum[k] || 0) + v;
  }
  const n = results.length || 1;
  const turns = results.map((r) => r.turns).sort((a, b) => a - b);
  console.log(`Partidas: ${results.length}/${GAMES} em ${Date.now() - t0} ms`);
  console.log('Vitórias:', wins);
  console.log(`Turnos: min ${turns[0]} · mediana ${turns[Math.floor(turns.length / 2)]} · max ${turns[turns.length - 1]}`);
  console.log('Médias por partida:', Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, k === 'maxChain' ? v : +(v / n).toFixed(1)])));
  console.log('Maior Chain vista:', Math.max(...results.map((r) => r.tally.maxChain)));
  console.log('Chegaram à morte súbita:', results.filter((r) => r.turns >= YC.GameController.SUDDEN_DEATH_TURN).length);
})();
