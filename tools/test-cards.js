#!/usr/bin/env node
/* Testes de cenário das cartas: monta uma posição, põe cartas na mão/Zona, joga ações e confirma o efeito.
   Uso: node tools/test-cards.js */
'use strict';
const path = require('path');
const { loadEngine } = require('./load-engine');

const YC = loadEngine(path.join(__dirname, '..'));
const C = YC.Chess, sq = C.sqIndex;
let fails = 0, count = 0;
const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const eq = (got, want, what) => { if (got !== want) throw new Error(`${what}: ${JSON.stringify(got)} (esperado ${JSON.stringify(want)})`); };

const FILL = Array(12).fill('gt_jaula_estatica');

/** Partida a meio: `team` a jogar no turno `turn`; respostas guionadas por equipa (ids de carta, por ordem). */
function setup(fen, { team = 'w', turn, hand = {}, zone = {}, deck = {}, replies = {} } = {}) {
  const m = new YC.Match({ seed: 3, decks: { w: deck.w || FILL, b: deck.b || FILL } });
  m.pos = C.fromFEN(fen);
  const T = turn || (team === 'w' ? 5 : 6);
  Object.assign(m.state, { turnCount: T, active: team, phase: 'PREP', actionsLeft: 2 });
  m.pos.turn = team;
  for (const t of ['w', 'b']) {
    m.players[t].hand = (hand[t] || []).map((id) => m.newInst(id, t));
    m.players[t].zone = (zone[t] || []).map((id) => ({ inst: m.newInst(id, t), setTurn: 0 }));
    const queue = (replies[t] || []).slice();
    m.agents[t] = {
      playTurn: async () => {},
      respondChain: async (ctx) => {
        const want = queue.shift();
        if (!want) return null;
        if (typeof want === 'function') return want(ctx);
        const o = ctx.options.find((x) => x.id === want);
        return o ? { uid: o.uid } : null;
      }
    };
  }
  return m;
}
const uid = (m, t, id) => (m.players[t].hand.find((c) => c.id === id) || m.players[t].zone.find((z) => z.inst.id === id).inst).uid;
const at = (m, s) => m.pieceAt(sq(s));
const move = (m, t, from, to, extra = {}) => m.dispatch({ type: 'MOVE', team: t, from: sq(from), to: sq(to), ...extra });
const nextTurn = (m) => { m.state.phase = 'END_PHASE'; return m.beginTurn(); };

test('Compra: 3 cartas no início e 1 por turno (as Brancas não compram no 1.º)', async () => {
  const m = new YC.Match({ seed: 5, decks: { w: FILL, b: FILL } });
  for (const t of ['w', 'b']) await m.draw(t, YC.Cards.RULES.START_HAND, 'start');
  await m.beginTurn();
  eq(m.players.w.hand.length, 3, 'Brancas no turno 1');
  await nextTurn(m);
  eq(m.players.b.hand.length, 4, 'Pretas no turno 2');
  await nextTurn(m);
  eq(m.players.w.hand.length, 4, 'Brancas no turno 3');
  await nextTurn(m);
  eq(m.players.b.hand.length, 5, 'Pretas no turno 4');
});

test('Espada da Ganância: capturar compra 1 carta', async () => {
  const m = setup('4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1', { hand: { w: ['eq_espada_ganancia'] } });
  await m.dispatch({ type: 'EQUIP', team: 'w', uid: uid(m, 'w', 'eq_espada_ganancia'), sq: sq('d1') });
  eq(at(m, 'd1').equips[0], 'eq_espada_ganancia', 'equipada');
  await move(m, 'w', 'd1', 'd5');
  eq(m.players.w.hand.length, 1, 'mão depois da captura');
});

test('Jaula de Choque: a peça que pisa fica congelada 2 turnos', async () => {
  const m = setup('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1', { team: 'w' });
  m.traps.push({ uid: 'b99', id: 'gt_jaula_estatica', owner: 'b', sq: sq('d5'), setTurn: 0, revealed: false });
  await move(m, 'w', 'c3', 'd5');
  const n = at(m, 'd5');
  eq(!!n, true, 'cavalo em d5');
  eq(C.legalMovesFrom(m.pos, sq('d5'), { turn: 7 }).length, 0, 'congelado no turno 7');
  eq(C.legalMovesFrom(m.pos, sq('d5'), { turn: 9 }).length, 0, 'congelado no turno 9');
  eq(C.legalMovesFrom(m.pos, sq('d5'), { turn: 11 }).length > 0, true, 'livre no turno 11');
  eq(m.traps.length, 0, 'armadilha gasta');
});

test('Bigorna: destrói a peça; o Rei é imune', async () => {
  const m = setup('4k3/8/8/8/8/8/3R4/4K3 w - - 0 1');
  m.traps.push({ uid: 'b98', id: 'gt_guilhotina_bigorna', owner: 'b', sq: sq('d5'), setTurn: 0 });
  await move(m, 'w', 'd2', 'd5');
  eq(at(m, 'd5'), null, 'torre destruída');
  const k = setup('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  k.traps.push({ uid: 'b97', id: 'gt_guilhotina_bigorna', owner: 'b', sq: sq('e2'), setTurn: 0 });
  await move(k, 'w', 'e1', 'e2');
  eq(at(k, 'e2').type, 'k', 'Rei sobrevive');
});

test('Égide de Cristal: anula a captura e o atacante volta', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', { zone: { b: ['rt_escudo_divino'] }, replies: { b: ['rt_escudo_divino'] } });
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd5').type, 'n', 'cavalo vivo');
  eq(at(m, 'd1').type, 'q', 'dama de volta a d1');
  eq(m.players.b.gy.includes('rt_escudo_divino'), true, 'carta no cemitério');
});

test('Enjoo: carta virada neste turno não responde', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', { replies: { b: ['rt_escudo_divino'] } });
  m.players.b.zone = [{ inst: m.newInst('rt_escudo_divino', 'b'), setTurn: 5 }];
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd5').type, 'q', 'captura aconteceu');
});

test('Tesoura anula a armadilha e revela outra', async () => {
  const m = setup('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1', { zone: { w: ['ct_tesoura_corta_fio'] }, replies: { w: ['ct_tesoura_corta_fio'] } });
  m.traps.push({ uid: 'b96', id: 'gt_jaula_estatica', owner: 'b', sq: sq('d5'), setTurn: 0 });
  m.traps.push({ uid: 'b95', id: 'gt_bomba_tinta', owner: 'b', sq: sq('g5'), setTurn: 0, revealed: false });
  await move(m, 'w', 'c3', 'd5');
  eq(at(m, 'd5').frozenUntil, 0, 'não congelou');
  eq(m.traps[0].revealed, true, 'outra revelada');
});

test('Chain de 3 elos: Armadilha ← Tesoura ← Apito (a armadilha resolve)', async () => {
  const m = setup('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1', {
    zone: { w: ['ct_tesoura_corta_fio'], b: ['ct_apito_juiz'] }, replies: { w: ['ct_tesoura_corta_fio'], b: ['ct_apito_juiz'] }
  });
  m.traps.push({ uid: 'b94', id: 'gt_jaula_estatica', owner: 'b', sq: sq('d5'), setTurn: 0 });
  let links = 0;
  m.bus.on('chain:link', () => links++);
  await move(m, 'w', 'c3', 'd5');
  eq(links, 3, 'elos');
  eq(at(m, 'd5').frozenUntil > 7, true, 'cavalo congelado');
  eq(m.players.b.hand.length, 1, 'Apito comprou 1');
});

test('Cetro: Peão anda como Rei e ganha Escudo; o Escudo estilhaça', async () => {
  const m = setup('4k3/8/8/8/3p4/8/8/3QK3 b - - 0 1', { team: 'b', hand: { b: ['eq_cetro_usurpador'] } });
  await m.dispatch({ type: 'EQUIP', team: 'b', uid: uid(m, 'b', 'eq_cetro_usurpador'), sq: sq('d4') });
  eq(at(m, 'd4').shield, true, 'escudo');
  await move(m, 'b', 'e8', 'e7');
  await nextTurn(m);
  await move(m, 'w', 'd1', 'd4');
  eq(at(m, 'd4').type, 'p', 'peão vivo');
  eq(at(m, 'd4').shield, false, 'escudo gasto');
  eq(at(m, 'd1').type, 'q', 'dama voltou');
});

test('Espelho de Borracha: destrói o atacante', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', { zone: { b: ['rt_espelho_magico'] }, replies: { b: ['rt_espelho_magico'] } });
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd1'), null, 'dama destruída');
  eq(at(m, 'd5').type, 'n', 'cavalo vivo');
});

test('Bomba de Fumo: o alvo foge e o atacante ocupa a casa vazia', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', { zone: { b: ['rt_fumaca_ninja'] }, replies: { b: ['rt_fumaca_ninja'] } });
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd5').type, 'q', 'dama em d5');
  eq(m.pos.board.filter((p) => p && p.type === 'n').length, 1, 'cavalo continua vivo');
});

test('Boneco de Testes: morre um Peão no lugar da Torre', async () => {
  const m = setup('4k3/pp6/8/3r4/8/8/8/3QK3 w - - 0 1', { zone: { b: ['rt_troca_dubles'] }, replies: { b: ['rt_troca_dubles'] } });
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd5').type, 'r', 'torre viva');
  eq(m.pos.board.filter((p) => p && p.color === 'b' && p.type === 'p').length, 1, 'um peão a menos');
});

test('Guarda-Costas do Rei: congela quem deu xeque e compra 1', async () => {
  const m = setup('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', { zone: { b: ['rt_alarme_real'] }, replies: { b: ['rt_alarme_real'] }, deck: { b: ['ct_quebra_escudo', ...FILL] } });
  m.players.b.deck = [m.newInst('ct_quebra_escudo', 'b')];
  await move(m, 'w', 'a1', 'a8');
  eq(at(m, 'a8').frozenUntil > 7, true, 'torre congelada');
  eq(m.players.b.hand.length, 1, 'comprou');
});

test('Seguro de Vida + compra de recuperação', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', { zone: { b: ['rt_vampiro_energia'] }, replies: { b: ['rt_vampiro_energia'] } });
  m.players.b.deck = ['gt_bomba_tinta', 'gt_bomba_tinta', 'gt_bomba_tinta', 'gt_bomba_tinta'].map((id) => m.newInst(id, 'b'));
  await move(m, 'w', 'd1', 'd5');
  eq(m.players.b.hand.length, 3, '1 (cavalo perdido) + 2 (Seguro)');
});

test('Gerador de Bolhas: escudo às 2 peças mais valiosas', async () => {
  const m = setup('3qk3/3r4/8/3n4/8/8/8/3QK3 w - - 0 1', { zone: { b: ['rt_cupula_dupla'] }, replies: { b: ['rt_cupula_dupla'] } });
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd8').shield && at(m, 'd7').shield, true, 'dama e torre com escudo');
});

test('Pulso EMP: destrói armadilhas na zona 3×3', async () => {
  const m = setup('4k3/8/8/8/8/8/8/4K3 w - - 0 1', { hand: { w: ['ct_emp_cartoon'] } });
  m.traps.push({ uid: 'b1x', id: 'gt_jaula_estatica', owner: 'b', sq: sq('d5'), setTurn: 0 }, { uid: 'b2x', id: 'gt_bomba_tinta', owner: 'b', sq: sq('e4'), setTurn: 0 }, { uid: 'b3x', id: 'gt_bomba_tinta', owner: 'b', sq: sq('a3'), setTurn: 0 });
  await m.dispatch({ type: 'ACTIVATE', team: 'w', uid: uid(m, 'w', 'ct_emp_cartoon'), target: { sq: sq('d4') } });
  eq(m.traps.length, 1, 'sobra 1');
});

test('Britadeira: fura escudos e bloqueia a Égide neste turno', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', { hand: { w: ['ct_quebra_escudo'] }, zone: { b: ['rt_escudo_divino'] }, replies: { b: ['rt_escudo_divino'] } });
  at(m, 'd5').shield = true;
  await m.dispatch({ type: 'ACTIVATE', team: 'w', uid: uid(m, 'w', 'ct_quebra_escudo') });
  eq(at(m, 'd5').shield, false, 'escudo furado');
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd5').type, 'q', 'captura acontece');
});

test('Luva Confiscadora: o Equipamento volta ao topo do baralho', async () => {
  const m = setup('4k3/8/8/8/8/8/3P4/4K3 w - - 0 1', { hand: { w: ['eq_botas_vento'] }, zone: { b: ['ct_confisco_real'] }, replies: { b: ['ct_confisco_real'] } });
  await m.dispatch({ type: 'EQUIP', team: 'w', uid: uid(m, 'w', 'eq_botas_vento'), sq: sq('d2') });
  eq(at(m, 'd2').equips.length, 0, 'sem equipamento');
  eq(m.players.w.deck[0].id, 'eq_botas_vento', 'topo do baralho');
});

test('Relógio Reverso: anula a Égide e congela a peça protegida', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1', { zone: { b: ['rt_escudo_divino'], w: ['ct_reverso_tempo'] }, replies: { b: ['rt_escudo_divino'], w: ['ct_reverso_tempo'] } });
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd5').type, 'q', 'captura acontece');
});

test('Íman: rouba um Equipamento para uma peça compatível', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/2N1K3 w - - 0 1', { hand: { w: ['ct_ima_equipamento'] } });
  at(m, 'd5').equips.push('eq_espada_ganancia');
  await m.dispatch({ type: 'ACTIVATE', team: 'w', uid: uid(m, 'w', 'ct_ima_equipamento'), target: { from: sq('d5'), to: sq('c1') } });
  eq(at(m, 'c1').equips[0], 'eq_espada_ganancia', 'roubada');
  eq(at(m, 'd5').equips.length, 0, 'inimigo sem nada');
});

test('Raio Encolhedor: vira Peão 2 turnos e volta', async () => {
  const m = setup('4k3/8/8/8/8/8/3Q4/4K3 w - - 0 1');
  m.traps.push({ uid: 'b4x', id: 'gt_raio_encolhedor', owner: 'b', sq: sq('d5'), setTurn: 0 });
  await move(m, 'w', 'd2', 'd5');
  eq(at(m, 'd5').type, 'p', 'encolheu');
  for (let i = 0; i < 4; i++) await nextTurn(m);
  eq(at(m, 'd5').type, 'p', 'ainda peão no turno 9');
  await nextTurn(m); await nextTurn(m);
  eq(at(m, 'd5').type, 'q', 'voltou a Dama');
});

test('Buraco de Minhoca: teletransporta para a coluna A/H', async () => {
  const m = setup('4k3/8/8/8/8/8/3R4/4K3 w - - 0 1');
  m.traps.push({ uid: 'b5x', id: 'gt_buraco_minhoca', owner: 'b', sq: sq('d5'), setTurn: 0 });
  await move(m, 'w', 'd2', 'd5');
  const r = m.pos.board.findIndex((p) => p && p.type === 'r');
  eq([0, 7].includes(r & 7), true, `coluna da torre (${C.sqName(r)})`);
});

test('Fosso de Gravidade: Peão destruído, peça maior recua e congela', async () => {
  const m = setup('4k3/8/8/8/8/8/3P1N2/4K3 w - - 0 1');
  m.traps.push({ uid: 'b6x', id: 'gt_mina_repulsora', owner: 'b', sq: sq('d4'), setTurn: 0 }, { uid: 'b7x', id: 'gt_mina_repulsora', owner: 'b', sq: sq('e4'), setTurn: 0 });
  await move(m, 'w', 'd2', 'd4');
  eq(at(m, 'd4'), null, 'peão destruído');
  await nextTurn(m); await nextTurn(m);
  await move(m, 'w', 'f2', 'e4');
  eq(at(m, 'f3') && at(m, 'f3').type, 'n', 'cavalo recuou para f3');
  eq(at(m, 'f3').frozenUntil > m.state.turnCount, true, 'congelado');
});

test('Pântano de Chiclete: tira os Equipamentos', async () => {
  const m = setup('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1');
  at(m, 'c3').equips.push('eq_espada_ganancia', 'eq_capa_magnetica');
  m.traps.push({ uid: 'b8x', id: 'gt_pantano_chiclete', owner: 'b', sq: sq('d5'), setTurn: 0 });
  await move(m, 'w', 'c3', 'd5');
  eq(at(m, 'd5').equips.length, 0, 'sem equipamentos');
  eq(m.players.w.gy.length, 2, 'para o cemitério');
});

test('Trampolim: volta à casa de origem', async () => {
  const m = setup('4k3/8/8/8/8/2N5/8/4K3 w - - 0 1');
  m.traps.push({ uid: 'b9x', id: 'gt_mola_retorno', owner: 'b', sq: sq('d5'), setTurn: 0 });
  await move(m, 'w', 'c3', 'd5');
  eq(at(m, 'c3').type, 'n', 'de volta a c3');
});

test('Mina de Tinta: recua 1 casa e o dono compra', async () => {
  const m = setup('4k3/8/8/8/8/8/3R4/4K3 w - - 0 1');
  m.players.b.deck = [m.newInst('gt_bomba_tinta', 'b')];
  m.traps.push({ uid: 'b10x', id: 'gt_bomba_tinta', owner: 'b', sq: sq('d6'), setTurn: 0 });
  await move(m, 'w', 'd2', 'd6');
  eq(at(m, 'd5').type, 'r', 'torre em d5');
  eq(m.players.b.hand.length, 1, 'dono comprou');
});

test('Aura Glacial: congela a peça inimiga ao lado', async () => {
  const m = setup('4k3/8/8/2r5/8/8/8/3QK3 w - - 0 1');
  at(m, 'd1').equips.push('eq_aura_glacial');
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'c5').frozenUntil > 6, true, 'torre congelada');
});

test('Armadura de Cacto: o atacante morre junto', async () => {
  const m = setup('4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1');
  at(m, 'd5').equips.push('eq_armadura_espinhos');
  await move(m, 'w', 'd1', 'd5');
  eq(at(m, 'd5'), null, 'os dois destruídos');
});

test('Lança: captura a 2 casas sem sair, uma vez', async () => {
  const m = setup('4k3/8/8/8/1r6/8/3R4/4K3 w - - 0 1');
  at(m, 'd2').equips.push('eq_lanca_telescopica');
  await move(m, 'w', 'd2', 'b4', { lance: true });
  eq(at(m, 'd2').type, 'r', 'torre ficou');
  eq(at(m, 'b4'), null, 'alvo destruído');
  eq(at(m, 'd2').lanceUsed, true, 'lança gasta');
});

test('Mão cheia: a carta comprada é queimada', async () => {
  const m = setup('4k3/8/8/8/8/8/8/4K3 w - - 0 1', { hand: { w: ['gt_bomba_tinta', 'gt_bomba_tinta', 'gt_bomba_tinta', 'gt_bomba_tinta', 'gt_bomba_tinta'] } });
  m.players.w.deck = [m.newInst('ct_apito_juiz', 'w')];
  await m.draw('w', 1, 'turn');
  eq(m.players.w.hand.length, 5, 'mão');
  eq(m.players.w.gy[0], 'ct_apito_juiz', 'queimada');
});

test('CLANG: armar onde há armadilha inimiga destrói as duas', async () => {
  const m = setup('4k3/8/8/8/8/8/8/4K3 w - - 0 1', { hand: { w: ['gt_jaula_estatica'] } });
  m.traps.push({ uid: 'b11x', id: 'gt_bomba_tinta', owner: 'b', sq: sq('d5'), setTurn: 0 });
  await m.dispatch({ type: 'SET_TRAP', team: 'w', uid: uid(m, 'w', 'gt_jaula_estatica'), sq: sq('d5') });
  eq(m.traps.length, 0, 'sem armadilhas');
});

test('Peças congeladas sem lances: passa a vez (não é afogamento)', async () => {
  const m = setup('4k3/8/8/8/8/8/1q6/K7 w - - 0 1');
  m.pos.board[sq('a1')] = null;
  m.pos.board[sq('h1')] = C.makePiece('w', 'k', 'wk');
  m.pos.board[sq('h2')] = C.makePiece('w', 'p', 'wp');
  m.pos.board[sq('h2')].frozenUntil = 99;
  m.pos.board[sq('g1')] = C.makePiece('w', 'b', 'wb');
  m.pos.board[sq('g1')].frozenUntil = 99;
  m.pos.board[sq('b2')] = null;
  m.pos.board[sq('f2')] = C.makePiece('b', 'q', 'bq');
  m.evaluate();
  eq(m.state.mustPass, true, 'passa');
  eq(m.state.winner, null, 'sem fim');
});

(async () => {
  for (const t of tests) {
    count++;
    try { await t.fn(); console.log(`✔ ${t.name}`); }
    catch (err) { fails++; console.log(`✘ ${t.name}\n    ${err.message}`); }
  }
  console.log(fails ? `\n${fails}/${count} falharam.` : `\n${count}/${count} testes passaram.`);
  process.exit(fails ? 1 : 0);
})();
