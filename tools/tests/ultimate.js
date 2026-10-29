/* Teste da economia das Ultimates (animação especial de uma Lendária, desbloqueada com ouro). */
'use strict';

module.exports = ({ test, eq, YC, setup, at, uid, sq, C }) => {
  test('Íman: o Escudo Tático roubado leva o Escudo (passa a proteger o Rei de quem roubou)', async () => {
    const m = setup('4k3/8/8/3p4/8/8/8/2P1K3 w - - 0 1', { hand: { w: ['ct_ima_equipamento'] } });
    Object.assign(at(m, 'd5'), { shield: true }); at(m, 'd5').equips.push('eq_escudo_choque');
    eq(C.guarded(m.pos, 'b'), true, 'antes: o Rei preto está protegido');
    await m.dispatch({ type: 'ACTIVATE', team: 'w', uid: uid(m, 'w', 'ct_ima_equipamento'), target: { from: sq('d5'), to: sq('c1') } });
    eq(at(m, 'c1').equips.join(), 'eq_escudo_choque', 'roubado');
    eq(at(m, 'c1').shield, true, 'o Peão branco ganhou o Escudo');
    eq(at(m, 'd5').shield, false, 'o Peão preto perdeu o Escudo');
    eq(C.guarded(m.pos, 'w') && !C.guarded(m.pos, 'b'), true, 'agora protege o Rei branco e não o preto');
  });

  test('Ultimate: precisa da carta e de 1000 de ouro, desconta e não se compra duas vezes', async () => {
    const E = YC.Economy, p = E.normalize(E.newProfile('Teste')), id = 'eq_cetro_usurpador';
    let err = '';
    p.gold = 5000;
    try { E.unlockUltimate(p, id); } catch (e) { err = e.message; }
    eq(/ter a carta/.test(err), true, `sem a carta: «${err}»`);
    p.inventory[id] = 1; p.gold = 999;
    try { E.unlockUltimate(p, id); } catch (e) { err = e.message; }
    eq(/1000/.test(err), true, `sem ouro: «${err}»`);
    p.gold = 1500;
    E.unlockUltimate(p, id);
    eq(p.gold, 500, 'desconta 1000');
    eq(E.hasUltimate(E.normalize(JSON.parse(JSON.stringify(p))), id), true, 'fica gravada (stats.ultimates)');
    try { E.unlockUltimate(p, id); err = ''; } catch (e) { err = e.message; }
    eq(/Já desbloqueaste/.test(err), true, 'não compra duas vezes');
  });
};
