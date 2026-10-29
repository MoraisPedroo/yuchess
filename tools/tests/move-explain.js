/* Testes do MoveExplain: o que uma peça (inimiga) pode fazer na próxima vez e porque é que um lance não dá. */
'use strict';

module.exports = ({ test, setup, at, eq, YC, C, sq }) => {
  const X = () => YC.MoveExplain;
  const why = (m, a, b) => { const r = X().why(m, sq(a), sq(b)); return r ? r.text : null; };
  const has = (txt, part, msg) => eq(!!txt && txt.includes(part), true, `${msg}: «${txt}»`);
  const dests = (m, s) => X().preview(m, sq(s)).map((x) => C.sqName(x.to));

  test('Explica: lance possível não tem explicação', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    eq(why(m, 'd1', 'd5'), null, 'Torre d1-d5 é legal');
  });

  test('Explica: forma de andar e peça no caminho', async () => {
    const m = setup('4k3/8/8/8/8/8/3P4/2B1K3 w - - 0 1');
    has(why(m, 'c1', 'c4'), 'só na diagonal', 'Bispo na vertical');
    eq(X().why(m, sq('c1'), sq('c4')).soft, true, 'forma de andar é "soft"');
    const m2 = setup('4k3/8/8/8/8/4P3/8/2B1K3 w - - 0 1');
    has(why(m2, 'c1', 'g5'), 'peça no caminho', 'Peão em e3 tapa o Bispo');
  });

  test('Explica: Peão não captura peça com Capa / não captura em frente', async () => {
    const m = setup('4k3/8/8/4n3/3P4/8/8/4K3 w - - 0 1');
    at(m, 'e5').equips.push('eq_capa_magnetica');
    has(why(m, 'd4', 'e5'), 'Capa', 'Capa protege dos Peões');
    const m2 = setup('4k3/8/8/3n4/3P4/8/8/4K3 w - - 0 1');
    has(why(m2, 'd4', 'd5'), 'não captura em frente', 'Peão contra peça à frente');
  });

  test('Explica: peça sem captura, cravada, casa bloqueada e Rei para casa atacada', async () => {
    const m = setup('4k3/8/8/8/8/1p6/8/3BK3 w - - 0 1');
    Object.assign(at(m, 'd1'), { noCap: true, noCapUntil: m.state.turnCount + 4 });
    has(why(m, 'd1', 'b3'), 'não pode capturar', 'Bispo sem captura');
    const pin = setup('4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1');
    has(why(pin, 'e2', 'd3'), 'cravado', 'Bispo cravado pela Torre');
    const kk = setup('3rk3/8/8/8/8/8/8/4K3 w - - 0 1');
    has(why(kk, 'e1', 'd1'), 'ficava em xeque', 'Rei não entra em casa atacada');
    const bl = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    bl.state.blocks.push({ sq: sq('d4'), until: bl.state.turnCount + 4 });
    bl.pos.blocked = [sq('d4')];
    has(why(bl, 'd1', 'd4'), 'bloqueada', 'casa bloqueada');
    has(why(bl, 'd1', 'd6'), 'D4', 'caminho por casa bloqueada');
  });

  test('Explica: a Mola só salta uma peça; lances da peça inimiga com a Mola', async () => {
    const m = setup('4k3/8/8/8/3p4/3P4/8/3RK3 w - - 0 1');
    at(m, 'd1').equips.push('eq_mola_canguru');
    has(why(m, 'd1', 'd6'), 'só salta uma peça', 'duas peças no caminho');
    // Torre preta com Mola em a8, Peão preto em a7: na próxima vez salta o Peão e chega a a2 (captura)
    const e = setup('r3k3/p7/8/8/8/8/P7/4K3 w - - 0 1');
    at(e, 'a8').equips.push('eq_mola_canguru');
    const d = dests(e, 'a8');
    eq(d.includes('a5') && d.includes('a2'), true, `destinos ${d.join(' ')}`);
  });

  test('Explica: na próxima vez do inimigo acabam os estados que expiram', async () => {
    const m = setup('4k3/8/8/3b4/8/8/6P1/4K3 w - - 0 1');
    Object.assign(at(m, 'd5'), { noCap: true, noCapUntil: m.state.turnCount + 1 });
    eq(dests(m, 'd5').includes('g2'), true, 'o Bispo inimigo volta a poder capturar');
    Object.assign(at(m, 'd5'), { noCapUntil: m.state.turnCount + 3 });
    eq(dests(m, 'd5').includes('g2'), false, 'ainda sem captura');
  });
};
