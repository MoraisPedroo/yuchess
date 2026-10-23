/* Teste do protocolo online (lockstep) sem rede: dois GameControllers com a mesma semente,
   cada um com uma IA local, ligados só por mensagens. No fim os dois estados têm de ser iguais.
   Uso: node tools/simulate-online.js [jogos=20] [semente-inicial=1] [latência-ms=0] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'src/core/EventBus.js', 'src/data/CardDatabase.js', 'src/engine/BoardEngine.js', 'src/engine/CombatRPG.js',
  'src/engine/UnoEconomy.js', 'src/engine/EffectInterpreter.js', 'src/engine/ChainResolver.js',
  'src/engine/GameController.js', 'src/ai/KingDiceAI.js', 'src/net/LockstepSession.js'
];
for (const f of FILES) vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
const YC = globalThis.YC;

const GAMES = Number(process.argv[2] || 20);
const SEED0 = Number(process.argv[3] || 1);
const LATENCY = Number(process.argv[4] || 0);

async function playPair(seed) {
  const [tA, tB] = YC.LockstepSession.memoryPair(LATENCY);
  const make = (team, transport, randSeed) => {
    const game = new YC.GameController({ seed, fast: true, mode: 'ONLINE' });
    const ai = new YC.KingDiceAI(team, { delay: 0, rand: YC.mulberry32(randSeed) });
    const issues = [];
    const session = new YC.LockstepSession({ game, localTeam: team, transport, localAgent: ai, onDesync: (i) => issues.push(i) }).attach();
    return { game, session, issues };
  };
  const W = make('WHITE', tA, seed * 31 + 1);
  const B = make('BLACK', tB, seed * 17 + 5);
  const resign = seed % 9 === 0; // de vez em quando, testar a desistência a meio
  if (resign) setTimeout(() => B.session.resign(), 5);
  const [wW, wB] = await Promise.all([W.game.start(), B.game.start()]);
  const hW = W.game.stateHash(), hB = B.game.stateHash();
  // Numa desistência cada lado pára num ponto diferente: aí só o vencedor tem de bater certo.
  const ok = wW === wB && (resign || hW === hB) && !W.issues.length && !B.issues.length;
  return { seed, ok, winner: wW, winnerB: wB, turns: W.game.state.turnCount, hashes: [hW, hB], issues: [...W.issues, ...B.issues], resign };
}

(async () => {
  const t0 = Date.now();
  let fails = 0, resigns = 0;
  const wins = { WHITE: 0, BLACK: 0, DRAW: 0 };
  for (let i = 0; i < GAMES; i++) {
    const r = await playPair(SEED0 + i);
    if (r.resign) resigns++;
    wins[r.winner] = (wins[r.winner] || 0) + 1;
    if (!r.ok) { fails++; console.log('FALHA', JSON.stringify(r).slice(0, 600)); }
  }
  console.log(`Pares de partidas: ${GAMES} em ${Date.now() - t0} ms · latência ${LATENCY} ms`);
  console.log(`Sincronizadas: ${GAMES - fails}/${GAMES} · desistências testadas: ${resigns}`);
  console.log('Vitórias:', wins);
  if (fails) process.exitCode = 1;
})();
