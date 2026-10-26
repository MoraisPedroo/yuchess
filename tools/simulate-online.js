#!/usr/bin/env node
/* Testa o protocolo online (lockstep): dois Match com a mesma semente, cada um com o seu bot,
   ligados só por mensagens (com latência). No fim os dois estados têm de ser idênticos.
   Uso: node tools/simulate-online.js [N] */
'use strict';
const path = require('path');
const { loadEngine } = require('./load-engine');

const YC = loadEngine(path.join(__dirname, '..'));
const N = Number(process.argv[2]) || 8;

async function pair(i) {
  const rng = YC.mulberry32(300 + i);
  const decks = { w: YC.Economy.randomDeck(rng), b: YC.Economy.randomDeck(rng) };
  const [ta, tb] = YC.LockstepSession.memoryPair(i % 3);
  const mk = (team, transport) => {
    const game = new YC.Match({ seed: 900 + i, decks, mode: 'ONLINE' });
    const bot = YC.BotAI.create({ team, level: 'easy', delay: 0, seed: team === 'w' ? 5 + i : 9 + i });
    bot.cfg = { ...bot.cfg, ms: 40 };
    const s = new YC.LockstepSession({ game, localTeam: team, transport, localAgent: bot, onDesync: (d) => { game.desync = d; } }).attach();
    return { game, s };
  };
  const A = mk('w', ta), B = mk('b', tb);
  // a meio, um dos lados desiste (testa a mensagem RESIGN)
  const resignAt = i % 4 === 3 ? 40 : -1;
  if (resignAt > 0) A.game.bus.on('turn:start', ({ turnCount }) => { if (turnCount === resignAt) setTimeout(() => A.s.resign(), 0); });
  await Promise.all([A.game.start(), B.game.start()]);
  await new Promise((r) => setTimeout(r, 30));
  const same = A.game.stateHash() === B.game.stateHash() && A.game.state.winner === B.game.state.winner;
  return { same, A: A.game, B: B.game, desync: A.game.desync || B.game.desync, resigned: resignAt > 0 };
}

(async () => {
  let ok = 0;
  for (let i = 0; i < N; i++) {
    const r = await pair(i);
    const good = (r.same || r.resigned) && !r.desync && r.A.state.winner === r.B.state.winner;
    if (good) ok++;
    console.log(`#${i} ${good ? '✔' : '✘'} ${r.A.state.winner} (${r.A.state.reason}) turnos ${r.A.state.turnCount}/${r.B.state.turnCount}${r.desync ? ' DESYNC ' + JSON.stringify(r.desync) : ''}`);
  }
  console.log(`\nSincronizadas: ${ok}/${N}`);
  process.exit(ok === N ? 0 : 1);
})();
