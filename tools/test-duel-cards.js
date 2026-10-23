/* Testes de cenário das cartas do Speed Duel. Uso: node tools/test-duel-cards.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
for (const f of ['src/core/EventBus.js', 'src/duel/DuelCards.js', 'src/duel/DuelState.js', 'src/duel/DuelEffects.js',
  'src/duel/DuelChain.js', 'src/duel/DuelController.js', 'src/duel/Collection.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });
}
const YC = globalThis.YC;
const S = YC.DuelState;

let n = 0;
/** Agente de teste: responde na Chain com a primeira opção cujo id de carta estiver em `plays`. */
const agent = (plays = []) => ({ playTurn() {}, respondChain: async ({ options }) => { const o = options.find((x) => plays.includes(x.inst.id)); return o ? o.id : null; } });

function duel({ white = {}, black = {}, pile = { color: 'R', symbol: '5' }, turn = 3, plays = {} } = {}) {
  const g = new YC.DuelController({ seed: 7, fast: true, decks: { WHITE: YC.DuelCards.STARTER_DECK, BLACK: YC.DuelCards.STARTER_DECK } });
  g.setup();
  g.agents = { WHITE: agent(plays.WHITE), BLACK: agent(plays.BLACK) };
  Object.assign(g.state, { turnCount: turn, active: 'WHITE', phase: 'MAIN', pile });
  for (const [team, cfg] of [['WHITE', white], ['BLACK', black]]) {
    const p = g.state.players[team];
    p.hand = (cfg.hand || []).map((id) => ({ uid: `t${++n}`, id, owner: team }));
    p.monsters = [0, 1, 2].map((i) => {
      const m = cfg.monsters && cfg.monsters[i];
      if (!m) return null;
      const [id, position = 'ATK'] = Array.isArray(m) ? m : [m];
      return { uid: `t${++n}`, id, owner: team, position, summonTurn: 1, attacks: 0, posChangedTurn: -1, mods: [], stunUntil: 0, zone: i };
    });
    p.backrow = [0, 1, 2].map((i) => (cfg.backrow && cfg.backrow[i] ? { uid: `t${++n}`, id: cfg.backrow[i], owner: team, setTurn: 1 } : null));
    if (cfg.lp) p.lp = cfg.lp;
  }
  return g;
}
const W = (g) => g.state.players.WHITE, B = (g) => g.state.players.BLACK;
const uid = (list, id) => list.find((x) => x && x.id === id).uid;

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
const eq = (a, b, msg) => { if (a !== b) throw new Error(`${msg}: esperado ${b}, obtido ${a}`); };

test('Apito muda peça inimiga para Defesa', async () => {
  const g = duel({ white: { hand: ['apito_guarda'] }, black: { monsters: ['cavalo_molas'] } });
  eq(await g.dispatch({ type: 'ACTIVATE', uid: uid(W(g).hand, 'apito_guarda'), targets: { monsterUid: B(g).monsters[0].uid } }), true, 'ativou');
  eq(B(g).monsters[0].position, 'DEF', 'posição');
});
test('Tonel cura 600 e limpa debuffs', async () => {
  const g = duel({ white: { hand: ['tonel_espinafre'], monsters: ['cavalo_molas'], lp: 2000 } });
  const m = W(g).monsters[0]; m.mods.push({ stat: 'atk', amount: -800, perm: true }); m.stunUntil = 9;
  await g.dispatch({ type: 'ACTIVATE', uid: uid(W(g).hand, 'tonel_espinafre'), targets: { monsterUid: m.uid } });
  eq(W(g).lp, 2600, 'LP'); eq(S.atk(g, m), 1400, 'ATK limpo'); eq(S.isStunned(g, m), false, 'paralisia');
});
test('Troca de Chapéu: descarta 1 e compra 2', async () => {
  const g = duel({ white: { hand: ['troca_chapeu', 'peao_caneca', 'peao_lata'] } });
  const before = W(g).hand.length, deck = W(g).deck.length;
  await g.dispatch({ type: 'ACTIVATE', uid: uid(W(g).hand, 'troca_chapeu'), targets: { discardUid: uid(W(g).hand, 'peao_lata') } });
  eq(W(g).hand.length, before - 2 + 2, 'mão'); eq(W(g).deck.length, deck - 2, 'baralho');
});
test('Inversão de Polaridade troca ATK/DEF só neste turno', async () => {
  const g = duel({ white: { hand: ['inversao_polaridade'], monsters: ['peao_lata'] } });
  const m = W(g).monsters[0];
  await g.dispatch({ type: 'ACTIVATE', uid: uid(W(g).hand, 'inversao_polaridade') });
  eq(S.atk(g, m), 1400, 'ATK trocado'); g.state.turnCount++; eq(S.atk(g, m), 500, 'volta ao normal');
});
test('Compra Gananciosa só com pilha Amarela ou menos LP', async () => {
  const g = duel({ white: { hand: ['compra_gananciosa'] } });
  eq(await g.dispatch({ type: 'ACTIVATE', uid: uid(W(g).hand, 'compra_gananciosa') }), false, 'bloqueada');
  g.state.pile.color = 'Y';
  eq(await g.dispatch({ type: 'ACTIVATE', uid: uid(W(g).hand, 'compra_gananciosa') }), true, 'ativou');
  eq(W(g).hand.length, 2, 'comprou 2');
});
test('Alçapão devolve peça invocada sem tributo à mão', async () => {
  const g = duel({ white: { hand: ['cavalo_molas'] }, black: { backrow: ['alcapao_teatro'] }, plays: { BLACK: ['alcapao_teatro'] } });
  await g.dispatch({ type: 'NORMAL_SUMMON', uid: uid(W(g).hand, 'cavalo_molas'), position: 'ATK' });
  eq(W(g).monsters.filter(Boolean).length, 0, 'campo vazio'); eq(W(g).hand.length, 1, 'voltou à mão');
});
test('Bigorna tira 800 ATK a peça com 1500+', async () => {
  const g = duel({ white: { hand: ['cavalo_fantasma'] }, black: { backrow: ['bigorna_ceu'] }, plays: { BLACK: ['bigorna_ceu'] } });
  await g.dispatch({ type: 'NORMAL_SUMMON', uid: uid(W(g).hand, 'cavalo_fantasma'), position: 'ATK' });
  eq(S.atk(g, W(g).monsters[0]), 800, 'ATK');
});
test('Cavalo Fantasma com pilha Azul ignora a Bigorna', async () => {
  const g = duel({ pile: { color: 'B', symbol: '1' }, white: { hand: ['cavalo_fantasma'] }, black: { backrow: ['bigorna_ceu'] }, plays: { BLACK: ['bigorna_ceu'] } });
  await g.dispatch({ type: 'NORMAL_SUMMON', uid: uid(W(g).hand, 'cavalo_fantasma'), position: 'ATK' });
  eq(S.atk(g, W(g).monsters[0]), 1600 + 300, 'ATK com Sintonia');
});
test('Batalha ATK vs ATK destrói o mais fraco e tira a diferença', async () => {
  const g = duel({ white: { monsters: ['bispo_maestro'] }, black: { monsters: ['cavalo_molas'] } });
  g.state.phase = 'BATTLE';
  await g.dispatch({ type: 'ATTACK', uid: W(g).monsters[0].uid, targetUid: B(g).monsters[0].uid });
  eq(B(g).monsters[0], null, 'destruída'); eq(B(g).lp, 4000 - 300 - 400, 'diferença + Maestro');
});
test('ATK menor que DEF: recuo e o atacante perde LP', async () => {
  const g = duel({ white: { monsters: ['peao_caneca'] }, black: { monsters: [['peao_lata', 'DEF']] }, pile: { color: 'B', symbol: '1' } });
  g.state.phase = 'BATTLE';
  await g.dispatch({ type: 'ATTACK', uid: W(g).monsters[0].uid, targetUid: B(g).monsters[0].uid });
  eq(W(g).lp, 4000 - 500, 'LP'); eq(!!W(g).monsters[0], true, 'atacante sobrevive');
});
test('Escudeiro de Lata aguenta atacante de Nível 3', async () => {
  const g = duel({ white: { monsters: ['peao_faisca'] }, black: { monsters: [['peao_lata', 'DEF']] } });
  g.state.phase = 'BATTLE';
  B(g).monsters[0].mods.push({ stat: 'def', amount: -1000, perm: true });
  await g.dispatch({ type: 'ATTACK', uid: W(g).monsters[0].uid, targetUid: B(g).monsters[0].uid });
  eq(!!B(g).monsters[0], true, 'sobreviveu');
});
test('Faísca ataca direto contra só-Defesa com metade do dano', async () => {
  const g = duel({ white: { monsters: ['peao_faisca'] }, black: { monsters: [['peao_lata', 'DEF']] } });
  g.state.phase = 'BATTLE';
  eq(await g.dispatch({ type: 'ATTACK', uid: W(g).monsters[0].uid, targetUid: null }), true, 'direto');
  eq(B(g).lp, 4000 - 550, 'LP');
});
test('Torre Cofre obriga a atacá-la', async () => {
  const g = duel({ white: { monsters: ['torre_locomotiva'] }, black: { monsters: ['peao_caneca', ['torre_cofre', 'DEF']] } });
  g.state.phase = 'BATTLE';
  eq(await g.dispatch({ type: 'ATTACK', uid: W(g).monsters[0].uid, targetUid: B(g).monsters[0].uid }), false, 'alvo proibido');
  eq(g.attackOptions('WHITE', W(g).monsters[0]).targets.length, 1, 'só a Torre');
});
test('Valquíria ataca duas vezes com pilha Amarela', async () => {
  const g = duel({ pile: { color: 'Y', symbol: '1' }, white: { monsters: ['cavalo_valquiria'] } });
  g.state.phase = 'BATTLE';
  const u = W(g).monsters[0].uid;
  await g.dispatch({ type: 'ATTACK', uid: u, targetUid: null });
  eq(await g.dispatch({ type: 'ATTACK', uid: u, targetUid: null }), true, 'segundo ataque');
  eq(B(g).lp, 0, 'LP'); eq(g.state.winner, 'WHITE', 'vencedor');
});
test('Dinamite destrói o atacante e causa 600', async () => {
  const g = duel({ white: { monsters: ['bispo_maestro'] }, black: { monsters: ['peao_caneca'], backrow: ['dinamite_acme'] }, plays: { BLACK: ['dinamite_acme'] } });
  g.state.phase = 'BATTLE';
  await g.dispatch({ type: 'ATTACK', uid: W(g).monsters[0].uid, targetUid: B(g).monsters[0].uid });
  eq(W(g).monsters[0], null, 'atacante destruído'); eq(W(g).lp, 3400, 'dano');
});
test('Dragão resiste à Dinamite', async () => {
  const g = duel({ white: { monsters: ['dragao_tres_cabecas'] }, black: { monsters: ['peao_caneca'], backrow: ['dinamite_acme'] }, plays: { BLACK: ['dinamite_acme'] } });
  g.state.phase = 'BATTLE';
  await g.dispatch({ type: 'ATTACK', uid: W(g).monsters[0].uid, targetUid: B(g).monsters[0].uid });
  eq(!!W(g).monsters[0], true, 'dragão vivo');
});
test('Parry anula o ataque e reflete 1000', async () => {
  const g = duel({ white: { monsters: ['bispo_maestro'] }, black: { backrow: ['parry_absoluto'] }, plays: { BLACK: ['parry_absoluto'] } });
  g.state.phase = 'BATTLE';
  await g.dispatch({ type: 'ATTACK', uid: W(g).monsters[0].uid, targetUid: null });
  eq(B(g).lp, 4000, 'sem dano'); eq(W(g).lp, 3000, 'refletido');
});
test('Sereia congela as armadilhas inimigas neste turno', async () => {
  const g = duel({ white: { hand: ['dama_sereia'], monsters: ['peao_caneca', 'peao_lata'] }, black: { backrow: ['casca_banana'] }, plays: { BLACK: ['casca_banana'] } });
  await g.dispatch({ type: 'NORMAL_SUMMON', uid: uid(W(g).hand, 'dama_sereia'), position: 'ATK', tributes: W(g).monsters.filter(Boolean).map((m) => m.uid) });
  g.state.phase = 'BATTLE';
  await g.dispatch({ type: 'ATTACK', uid: W(g).monsters.find(Boolean).uid, targetUid: null });
  eq(B(g).lp, 4000 - 2600, 'casca não ativou');
});
test('Julgamento paga metade dos LP e anula a invocação', async () => {
  const g = duel({ white: { hand: ['cavalo_molas'] }, black: { backrow: ['julgamento_solene'] }, plays: { BLACK: ['julgamento_solene'] } });
  await g.dispatch({ type: 'NORMAL_SUMMON', uid: uid(W(g).hand, 'cavalo_molas'), position: 'ATK' });
  eq(B(g).lp, 2000, 'custo'); eq(W(g).monsters.filter(Boolean).length, 0, 'anulada'); eq(W(g).gy.length, 1, 'cemitério');
});
test('Sintonia Uno: peça da cor da pilha ganha +300 ATK', async () => {
  const g = duel({ pile: { color: 'R', symbol: '9' }, white: { hand: ['cavalo_molas'] } });
  await g.dispatch({ type: 'NORMAL_SUMMON', uid: uid(W(g).hand, 'cavalo_molas'), position: 'ATK' });
  eq(S.atk(g, W(g).monsters[0]), 1700, 'ATK'); eq(g.state.pile.symbol, '3', 'pilha mudou');
});
test('Peão Estrela ganha +400 ao sobreviver um turno', async () => {
  const g = duel({ white: { monsters: ['peao_estrela'] } });
  W(g).monsters[0].summonTurn = 1; g.state.turnCount = 2; g.state.active = 'BLACK';
  await g.beginTurn();
  eq(S.atk(g, W(g).monsters[0]), 1950, 'ATK');
});

(async () => {
  let fails = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✔ ${t.name}`); } catch (e) { fails++; console.log(`  ✖ ${t.name} — ${e.message}`); }
  }
  console.log(`${tests.length - fails}/${tests.length} testes passaram`);
  if (fails) process.exitCode = 1;
})();
