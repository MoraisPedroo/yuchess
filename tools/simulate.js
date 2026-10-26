#!/usr/bin/env node
/* Põe o bot contra si próprio em N partidas sem ecrã e verifica invariantes:
   as 24 cartas nunca se perdem nem duplicam, há sempre 1 Rei de cada cor, a Chain fecha no fim do turno,
   e quem acabou de jogar não fica em xeque. Uso: node tools/simulate.js [N] [--verbose] */
'use strict';
const path = require('path');
const { loadEngine } = require('./load-engine');

const YC = loadEngine(path.join(__dirname, '..'));
const N = Number(process.argv[2]) || 30;
const FROM = Number((process.argv.find((a) => a.startsWith('--from=')) || '--from=0').slice(7));
const verbose = process.argv.includes('--verbose');

function countCards(m) {
  let n = 0;
  for (const t of ['w', 'b']) {
    const p = m.players[t];
    n += p.deck.length + p.hand.length + p.zone.length + p.gy.length;
  }
  n += m.traps.length;
  for (const p of m.pos.board) if (p) n += p.equips.length;
  return n;
}

async function playOne(i) {
  const rng = YC.mulberry32(1000 + i);
  const decks = { w: YC.Economy.randomDeck(rng), b: YC.Economy.randomDeck(rng) };
  const m = new YC.Match({ seed: 5000 + i, decks });
  const levels = ['easy', 'medium'];
  m.agents.w = YC.BotAI.create({ team: 'w', level: levels[i % 2], delay: 0, seed: 11 + i });
  m.agents.b = YC.BotAI.create({ team: 'b', level: levels[(i + 1) % 2], delay: 0, seed: 77 + i });
  m.agents.w.cfg = { ...m.agents.w.cfg, maxNodes: 4000 };
  m.agents.b.cfg = { ...m.agents.b.cfg, maxNodes: 4000 };
  const problems = [];
  const seen = { chain: 0, traps: 0, equips: 0, negates: 0, cards: {} };
  m.bus.on('chain:link', ({ link }) => { seen.chain++; seen.cards[link.def.id] = (seen.cards[link.def.id] || 0) + 1; });
  m.bus.on('chain:negate', () => seen.negates++);
  m.bus.on('trap:trigger', () => seen.traps++);
  m.bus.on('equip:attach', () => seen.equips++);
  let snapped = false;
  m.bus.on('capture:snapback', () => { snapped = true; });
  m.bus.on('turn:start', () => { snapped = false; });
  m.bus.on('turn:end', ({ team }) => {
    const total = countCards(m);
    if (total !== 24) problems.push(`turno ${m.state.turnCount}: ${total} cartas`);
    const kings = m.pos.board.filter((p) => p && p.type === 'k');
    if (kings.length !== 2 || kings[0].color === kings[1].color) problems.push(`turno ${m.state.turnCount}: reis inválidos`);
    if (m.chain) problems.push(`turno ${m.state.turnCount}: Chain aberta`);
    if (m.pending.length) problems.push(`turno ${m.state.turnCount}: janelas pendentes`);
    if (YC.Chess.inCheck(m.pos, team) && !snapped && !m.state.mustPass) problems.push(`turno ${m.state.turnCount}: ${team} acabou em xeque`);
    for (const t of ['w', 'b']) if (m.players[t].hand.length > 5) problems.push(`mão com ${m.players[t].hand.length}`);
  });
  const t0 = Date.now();
  await m.start();
  return { m, problems, seen, ms: Date.now() - t0 };
}

(async () => {
  let ok = 0;
  const results = { w: 0, b: 0, DRAW: 0 }, reasons = {}, used = {};
  let totalTurns = 0, links = 0, traps = 0, negates = 0;
  for (let i = FROM; i < FROM + N; i++) {
    const { m, problems, seen, ms } = await playOne(i);
    results[m.state.winner] = (results[m.state.winner] || 0) + 1;
    reasons[m.state.reason] = (reasons[m.state.reason] || 0) + 1;
    totalTurns += m.state.turnCount;
    links += seen.chain; traps += seen.traps; negates += seen.negates;
    for (const [id, n] of Object.entries(seen.cards)) used[id] = (used[id] || 0) + n;
    if (!problems.length && m.state.winner) ok++;
    if (problems.length || verbose) console.log(`#${i} ${m.state.winner} (${m.state.reason}) ${m.state.turnCount} turnos ${ms} ms ${problems.slice(0, 5).join(' | ')}`);
  }
  console.log(`\nPartidas sem problemas: ${ok}/${N}`);
  console.log('Resultados:', results, '\nFins:', reasons);
  console.log(`Média de turnos: ${(totalTurns / N).toFixed(1)} · elos de Chain: ${links} · armadilhas pisadas: ${traps} · anulações: ${negates}`);
  const never = YC.Cards.LIST.filter((c) => !used[c.id]).map((c) => c.id);
  console.log('Cartas nunca ativadas:', never.length ? never.join(', ') : 'nenhuma');
  process.exit(ok === N ? 0 : 1);
})();
