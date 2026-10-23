/* Simulador do Speed Duel: Rei Dado contra si próprio (decks gacha aleatórios) + teste lockstep.
   Verifica: 12 cartas por jogador sempre contabilizadas, LP ≥ 0, ≤3 peças e ≤3 cartas no Suporte,
   Chain fechada no fim de cada turno, partidas terminam e os dois lados online ficam iguais.
   Uso: node tools/simulate-duel.js [duelos=60] [semente=1] [pares-online=8] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['src/core/EventBus.js', 'src/duel/DuelCards.js', 'src/duel/DuelState.js', 'src/duel/DuelEffects.js',
  'src/duel/DuelChain.js', 'src/duel/DuelController.js', 'src/duel/Collection.js', 'src/duel/DuelAI.js', 'src/net/LockstepSession.js'];
for (const f of FILES) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const YC = globalThis.YC;

const N = Number(process.argv[2] || 60), SEED0 = Number(process.argv[3] || 1), PAIRS = Number(process.argv[4] || 8);

function check(g, where) {
  const errs = [];
  for (const t of YC.TEAMS) {
    const p = g.state.players[t];
    const all = [...p.deck, ...p.hand, ...p.gy, ...p.monsters.filter(Boolean), ...p.backrow.filter(Boolean)];
    if (all.length !== 12) errs.push(`${t}: ${all.length} cartas`);
    if (new Set(all.map((c) => c.uid)).size !== all.length) errs.push(`${t}: carta duplicada`);
    if (p.lp < 0) errs.push(`${t}: LP negativo`);
    if (p.monsters.length !== 3 || p.backrow.length !== 3) errs.push(`${t}: zonas inválidas`);
    for (const m of p.monsters.filter(Boolean)) if (!['ATK', 'DEF'].includes(m.position)) errs.push(`${t}: peça sem posição`);
  }
  if (g.chain.status !== 'Idle') errs.push(`chain ${g.chain.status}`);
  if (errs.length) throw new Error(`[${where}] ${errs.join('; ')}`);
}

function decksFor(seed) {
  const r = YC.mulberry32(seed * 101);
  return { WHITE: YC.Collection.aiDeck(r, seed % 6), BLACK: YC.Collection.aiDeck(r, (seed * 7) % 6) };
}

async function duel(seed) {
  const g = new YC.DuelController({ seed, fast: true, mode: 'AI', decks: decksFor(seed), names: { WHITE: 'A', BLACK: 'B' } });
  const rand = YC.mulberry32(seed * 13);
  g.agents = { WHITE: new YC.DuelAI('WHITE', { delay: 0, rand }), BLACK: new YC.DuelAI('BLACK', { delay: 0, rand }) };
  const tally = { chains: 0, maxChain: 0, cutIns: 0, attacks: 0, summons: 0, negates: 0, direct: 0, bounces: 0, fatigue: 0 };
  g.bus.on('CHAIN_CLEARED', ({ resolved }) => { tally.chains++; tally.maxChain = Math.max(tally.maxChain, resolved.length); tally.negates += resolved.filter((l) => l.negated).length; });
  g.bus.on('CUT_IN', () => tally.cutIns++);
  g.bus.on('DUEL_ATTACK_DECLARED', ({ target }) => { tally.attacks++; if (!target) tally.direct++; });
  g.bus.on('DUEL_SUMMONED', () => tally.summons++);
  g.bus.on('DUEL_BOUNCE', () => tally.bounces++);
  g.bus.on('LOG', (l) => { if (l.text.includes('Fadiga')) tally.fatigue++; });
  g.bus.on('TURN_ENDED', () => check(g, `turno ${g.state.turnCount}`));
  let err = null;
  const orig = console.error;
  console.error = (...a) => { err = a.map((x) => (x && x.stack) || String(x)).join(' '); };
  const winner = await g.start();
  console.error = orig;
  if (err) throw new Error(`semente ${seed}: ${err}`);
  check(g, 'fim');
  return { winner, turns: g.state.turnCount, tally, lp: [g.state.players.WHITE.lp, g.state.players.BLACK.lp] };
}

async function pair(seed) {
  const [tA, tB] = YC.LockstepSession.memoryPair(0);
  const decks = decksFor(seed);
  const mk = (team, transport, rs) => {
    const g = new YC.DuelController({ seed, fast: true, mode: 'ONLINE', decks });
    const issues = [];
    const s = new YC.LockstepSession({ game: g, localTeam: team, transport, localAgent: new YC.DuelAI(team, { delay: 0, rand: YC.mulberry32(rs) }), onDesync: (i) => issues.push(i) }).attach();
    return { g, s, issues };
  };
  const W = mk('WHITE', tA, seed + 3), B = mk('BLACK', tB, seed + 9);
  const [a, b] = await Promise.all([W.g.start(), B.g.start()]);
  return { ok: a === b && W.g.stateHash() === B.g.stateHash() && !W.issues.length && !B.issues.length, issues: [...W.issues, ...B.issues].slice(0, 3) };
}

(async () => {
  const t0 = Date.now();
  const res = [];
  let fails = 0;
  for (let i = 0; i < N; i++) {
    try { res.push(await duel(SEED0 + i)); } catch (e) { fails++; console.log('FALHA', e.message.slice(0, 400)); }
  }
  const wins = { WHITE: 0, BLACK: 0, DRAW: 0 };
  const sum = {};
  for (const r of res) { wins[r.winner]++; for (const [k, v] of Object.entries(r.tally)) sum[k] = (sum[k] || 0) + v; }
  const turns = res.map((r) => r.turns).sort((a, b) => a - b);
  console.log(`Duelos: ${res.length}/${N} em ${Date.now() - t0} ms`);
  console.log('Vitórias:', wins);
  console.log(`Turnos: min ${turns[0]} · mediana ${turns[Math.floor(turns.length / 2)]} · max ${turns[turns.length - 1]}`);
  console.log('Médias:', Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, k === 'maxChain' ? Math.max(...res.map((r) => r.tally.maxChain)) : +(v / Math.max(1, res.length)).toFixed(1)])));
  let synced = 0;
  for (let i = 0; i < PAIRS; i++) {
    const r = await pair(SEED0 + 500 + i);
    if (r.ok) synced++; else { fails++; console.log('DESSINCRONIZADO', JSON.stringify(r.issues)); }
  }
  console.log(`Online (lockstep): ${synced}/${PAIRS} sincronizados`);
  if (fails) process.exitCode = 1;
})();
