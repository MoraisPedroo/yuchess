#!/usr/bin/env node
/* Testa as regras de xadrez com contagens "perft" conhecidas e os modificadores dos equipamentos.
   Uso: node tools/test-chess-rules.js [--deep] */
'use strict';
const path = require('path');
const { loadEngine } = require('./load-engine');

const YC = loadEngine(path.join(__dirname, '..'));
const C = YC.Chess;
const deep = process.argv.includes('--deep');
let fails = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fails++;
  console.log(`${ok ? '✔' : '✘'} ${name}: ${got}${ok ? '' : ` (esperado ${want})`}`);
};

// Posições de referência (chessprogramming.org/Perft_Results)
const PERFT = [
  ['Início', C.START, [20, 400, 8902, deep ? 197281 : null]],
  ['Kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, deep ? 97862 : null]],
  ['Posição 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['Posição 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['Posição 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, deep ? 62379 : null]]
];
for (const [name, fen, counts] of PERFT) {
  counts.forEach((want, i) => { if (want != null) check(`perft ${name} d${i + 1}`, C.perft(C.fromFEN(fen), i + 1), want); });
}

// Xeque-mate, afogamento e material insuficiente
const mate = C.fromFEN('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
check('mate do louco: jogadas', C.legalMoves(mate).length, 0);
check('mate do louco: xeque', C.inCheck(mate, 'w'), true);
const stale = C.fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
check('afogamento: jogadas', C.legalMoves(stale).length, 0);
check('afogamento: sem xeque', C.inCheck(stale, 'b'), false);
check('material insuficiente (R+C vs R)', C.insufficientMaterial(C.fromFEN('8/8/8/4k3/8/8/2N5/4K3 w - - 0 1')), true);

// Equipamentos
const sq = C.sqIndex;
const movesOf = (pos, s, turn) => C.legalMovesFrom(pos, sq(s), { turn }).map((m) => C.sqName(m.to)).sort().join(',');
{
  const p = C.fromFEN('4k3/8/8/8/8/3P4/8/4K3 w - - 0 1');
  check('peão normal fora da 2.ª fila', movesOf(p, 'd3'), 'd4');
  p.board[sq('d3')].equips.push('eq_botas_vento');
  check('Botas do Vento: avança 2', movesOf(p, 'd3'), 'd4,d5');
}
{
  const p = C.fromFEN('4k3/8/8/3p4/8/8/3P4/3RK3 w - - 0 1');
  check('Torre bloqueada pelo peão', movesOf(p, 'd1'), 'c1,b1,a1'.split(',').sort().join(','));
  p.board[sq('d1')].equips.push('eq_mola_canguru');
  check('Mola Canguru: salta 1 peça', movesOf(p, 'd1'), 'a1,b1,c1,d3,d4,d5,f1,g1,h1');
}
{
  const p = C.fromFEN('4k3/8/8/8/3p4/8/8/4K3 b - - 0 1');
  p.board[sq('d4')].equips.push('eq_cetro_usurpador');
  check('Cetro: peão anda como Rei', movesOf(p, 'd4'), 'c3,c4,c5,d3,d5,e3,e4,e5');
}
{
  const p = C.fromFEN('4k3/8/8/8/3n4/4P3/8/4K3 w - - 0 1');
  check('peão captura cavalo', movesOf(p, 'e3'), 'd4,e4');
  p.board[sq('d4')].equips.push('eq_capa_magnetica');
  check('Capa Magnética: peões não capturam', movesOf(p, 'e3'), 'e4');
}
{
  const p = C.fromFEN('4k3/8/8/8/1r6/8/3Q4/4K3 w - - 0 1');
  p.board[sq('d2')].equips.push('eq_lanca_telescopica');
  const lance = C.legalMovesFrom(p, sq('d2')).filter((m) => m.flag === 'r').map((m) => C.sqName(m.to));
  check('Lança: captura a 2 casas sem sair', lance.join(','), 'b4');
}
{
  const p = C.fromFEN('4k3/8/8/8/8/8/3N4/4K3 w - - 0 1');
  p.board[sq('d2')].frozenUntil = 5;
  check('peça congelada não se mexe', movesOf(p, 'd2', 3), '');
  check('descongela depois', movesOf(p, 'd2', 5).length > 0, true);
}
{
  const p = C.fromFEN('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
  check('roque dos dois lados', C.legalMovesFrom(p, sq('e1')).filter((m) => m.flag === 'k').length, 2);
  const p2 = C.fromFEN('4k3/8/8/8/8/8/5r2/R3K2R w KQ - 0 1');
  check('roque pequeno proibido ao atravessar f1 atacada', C.legalMovesFrom(p2, sq('e1')).filter((m) => m.flag === 'k').map((m) => C.sqName(m.to)).join(','), 'c1');
}

console.log(fails ? `\n${fails} falha(s).` : '\nTudo certo.');
process.exit(fails ? 1 : 0);
