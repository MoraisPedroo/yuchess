/* Teste da economia das Ultimates (animação especial de uma Lendária, desbloqueada com ouro). */
'use strict';

module.exports = ({ test, eq, YC }) => {
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
