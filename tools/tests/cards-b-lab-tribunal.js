/* Testes das cartas da expansão: Laboratório Mutante e Tribunal da Batota (um por carta). */
'use strict';

module.exports = ({ test, setup, uid, at, move, nextTurn, eq, YC, C, sq }) => {
  const trap = (m, id, owner, s) => m.traps.push({ uid: `${owner}t${s}${id}`, id, owner, sq: sq(s), setTurn: 0, revealed: false });
  const act = (m, t, id, target) => m.dispatch({ type: 'ACTIVATE', team: t, uid: uid(m, t, id), ...(target ? { target } : {}) });
  const equip = (m, t, id, s) => m.dispatch({ type: 'EQUIP', team: t, uid: uid(m, t, id), sq: sq(s) });
  const frozen = (m, s) => at(m, s).frozenUntil > m.state.turnCount + 1;
  const moves = (m, s, turn) => C.legalMovesFrom(m.pos, sq(s), { turn: turn || m.state.turnCount }).map((x) => C.sqName(x.to));

  // ── Laboratório Mutante ──
  test('Frasco de Ácido: quem captura o Peão é destruído', async () => {
    const m = setup('4k3/8/2n5/8/3P4/8/8/4K3 b - - 0 1', { team: 'b' });
    at(m, 'd4').equips.push('eq_tubo_ensaio_toxico');
    await move(m, 'b', 'c6', 'd4');
    eq(m.pieceAt(sq('d4')), null, 'os dois morreram');
  });

  test('Braço Biónico: o Bispo também anda 1 casa na horizontal/vertical', async () => {
    const m = setup('4k3/8/8/8/3B4/8/8/4K3 w - - 0 1');
    at(m, 'd4').equips.push('eq_braco_mutante');
    const mv = moves(m, 'd4');
    eq(mv.includes('d5') && mv.includes('c4'), true, 'ortogonais');
  });

  test('Soro da Mutação Alfa: só da 5.ª fila; o Peão vira Dama com Escudo', async () => {
    const m = setup('4k3/8/8/3P4/2P5/8/8/4K3 w - - 0 1', { hand: { w: ['eq_elixir_mutacao_total'] } });
    const targets = YC.CardEffects.equipTargets(m, 'w', YC.Cards.get('eq_elixir_mutacao_total')).map(C.sqName);
    eq(targets.join(), 'd5', 'só d5');
    await equip(m, 'w', 'eq_elixir_mutacao_total', 'd5');
    eq(at(m, 'd5').type, 'q', 'Dama');
    eq(at(m, 'd5').shield, true, 'escudo');
  });

  test('Gás Sonífero: adormece quem pisa e as peças dele à volta', async () => {
    const m = setup('4k3/8/8/8/2N5/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_gas_sonifero', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(frozen(m, 'd4') && frozen(m, 'c4'), true, 'os dois congelados');
  });

  test('Câmara de Clonagem: a peça vira Peão e aparece um Peão do dono', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_armadilha_clones', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'd4').type, 'p', 'virou peão');
    eq(m.pos.board.filter((p) => p && p.color === 'b' && p.type === 'p').length, 1, 'peão preto novo');
  });

  test('Piscina de Lodo: tira tudo e vira Peão', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    Object.assign(at(m, 'd1'), { shield: true, equips: ['eq_mola_canguru'] });
    trap(m, 'gt_lodo_radioativo', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    const r = at(m, 'd4');
    eq(`${r.type}${r.equips.length}${r.shield}`, 'p0false', 'peão sem nada');
  });

  test('Injeção de Antídoto: descongela as tuas peças e dá Escudo à mais valiosa', async () => {
    const m = setup('4k3/8/8/8/r7/8/8/1N2K2R b - - 0 1', { team: 'b', zone: { w: ['rt_antidoto_emergencia'] }, replies: { w: ['rt_antidoto_emergencia'] } });
    at(m, 'b1').frozenUntil = 99;
    await move(m, 'b', 'a4', 'e4');
    eq(at(m, 'b1').frozenUntil, 0, 'cavalo descongelado');
    eq(at(m, 'h1').shield, true, 'torre com escudo');
  });

  test('Reação em Cadeia: a peça inimiga mais valiosa vira Peão', async () => {
    const m = setup('4k3/8/8/3n4/Q7/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_reacao_quimica_cadeia'] }, replies: { b: ['rt_reacao_quimica_cadeia'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'a4').type, 'p', 'Dama virou peão');
  });

  test('Enxerto de Borracha: o ataque falha, Escudo e o atacante recua 2', async () => {
    const m = setup('4k3/8/8/3n4/8/3R4/8/4K3 w - - 0 1', { zone: { b: ['rt_pele_borracha'] }, replies: { b: ['rt_pele_borracha'] } });
    await move(m, 'w', 'd3', 'd5');
    eq(at(m, 'd5').shield, true, 'escudo');
    eq(at(m, 'd1') && at(m, 'd1').type, 'r', 'torre em d1');
  });

  test('Câmara de Vácuo: anula uma Armadilha de Casa e revela as outras', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { zone: { w: ['ct_descontaminador'] }, replies: { w: ['ct_descontaminador'] } });
    trap(m, 'gt_jaula_estatica', 'b', 'd4');
    trap(m, 'gt_jaula_estatica', 'b', 'a5');
    trap(m, 'gt_jaula_estatica', 'b', 'h5');
    await move(m, 'w', 'd1', 'd4');
    eq(frozen(m, 'd4'), false, 'livre');
    eq(m.traps.every((t) => t.revealed), true, 'todas reveladas');
  });

  test('Elixir da Transmutação: o Peão vira Cavalo 2 turnos', async () => {
    const m = setup('4k3/8/8/8/8/8/3P4/4K3 w - - 0 1', { hand: { w: ['qs_transmutacao_peao'] } });
    await act(m, 'w', 'qs_transmutacao_peao', { sq: sq('d2') });
    eq(at(m, 'd2').type, 'n', 'Cavalo');
    for (let i = 0; i < 5; i++) await nextTurn(m);
    eq(at(m, 'd2').type, 'p', 'voltou a Peão');
  });

  test('Pistola Quântica: a peça não pode capturar nem dar xeque', async () => {
    const m = setup('4k3/8/8/8/8/2n5/8/3RK3 w - - 0 1', { hand: { w: ['qs_raio_desestabilizador'] } });
    await act(m, 'w', 'qs_raio_desestabilizador', { sq: sq('c3') });
    eq(moves(m, 'c3', 6).includes('d1'), false, 'não captura d1');
  });

  test('Soro de Crescimento: Peão da 6.ª fila vira Dama já', async () => {
    const m = setup('4k3/8/P7/8/8/8/8/4K3 w - - 0 1', { hand: { w: ['qs_soro_crescimento'] } });
    await act(m, 'w', 'qs_soro_crescimento', { sq: sq('a6') });
    eq(at(m, 'a6').type, 'q', 'Dama');
  });

  // ── Tribunal da Batota ──
  test('Distintivo do Juiz: desliga os Equipamentos inimigos a 2 casas', async () => {
    const m = setup('4k3/8/8/4n3/8/8/8/2B1K3 w - - 0 1');
    at(m, 'c1').equips.push('eq_distintivo_fiscal');
    at(m, 'e5').equips.push('eq_capa_magnetica');
    await move(m, 'w', 'c1', 'e3');
    eq(at(m, 'e5').silenced, true, 'silenciado');
  });

  test('Balança da Lei: o adversário só tem 1 ação de carta', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1');
    at(m, 'd5').equips.push('eq_balanca_justica');
    await nextTurn(m);
    eq(m.state.actionsLeft, 2, 'Pretas com 2');
    await nextTurn(m);
    eq(m.state.actionsLeft, 1, 'Brancas com 1');
  });

  test('Radar Rodoviário: o dono da peça descarta 1 carta', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { hand: { w: ['gt_jaula_estatica', 'gt_bomba_tinta'] } });
    trap(m, 'gt_zona_multa', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(m.players.w.hand.length, 1, 'descartou 1');
  });

  test('Cela de Detenção: presa 2 turnos e não pode ser alvo de cartas', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_cela_detencao', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(frozen(m, 'd4') && at(m, 'd4').untargetable, true, 'presa');
    eq(YC.CardEffects.equipTargets(m, 'w', YC.Cards.get('eq_mola_canguru')).includes(sq('d4')), false, 'não se equipa');
  });

  test('Mandado de Busca: o atacante perde 1 Equipamento e compras 1', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_mandado_apreensao'] }, replies: { b: ['rt_mandado_apreensao'] } });
    at(m, 'd1').equips.push('eq_mola_canguru');
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'd5').equips.length, 0, 'confiscado');
    eq(m.players.b.hand.length, 2, 'recuperação + 1');
  });

  test('Sentença de Despejo: quem deu xeque volta para trás e compras 1', async () => {
    const m = setup('4k3/8/8/8/r7/8/8/4K3 b - - 0 1', { team: 'b', zone: { w: ['rt_habeas_corpus'] }, replies: { w: ['rt_habeas_corpus'] } });
    await move(m, 'b', 'a4', 'e4');
    eq(at(m, 'a4') && at(m, 'a4').type, 'r', 'torre em a4');
    eq(m.players.w.hand.length, 1, 'comprou 1');
  });

  test('Veto do Supremo: anula a captura, destrói o atacante e descarta 1', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { hand: { w: ['gt_jaula_estatica'] }, zone: { b: ['rt_injuncao_suprema'] }, replies: { b: ['rt_injuncao_suprema'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'd5').color, 'b', 'cavalo vivo');
    eq(m.pos.board.some((p) => p && p.type === 'r'), false, 'torre destruída');
    eq(m.players.w.hand.length, 1, 'recuperação (Torre) − 1 descartada');
    eq(m.players.w.gy.length >= 1, true, 'carta no cemitério');
  });

  test('Cartão Vermelho: anula um Equipamento e congela a peça', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { hand: { w: ['eq_espada_ganancia'] }, zone: { b: ['ct_cartao_vermelho'] }, replies: { b: ['ct_cartao_vermelho'] } });
    await equip(m, 'w', 'eq_espada_ganancia', 'd1');
    eq(at(m, 'd1').equips.length, 0, 'anulado');
    eq(at(m, 'd1').frozenUntil > m.state.turnCount, true, 'congelada');
  });

  test('Embargo de Declaração: anula uma Counter-Trap e o adversário fica sem cartas', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/4K3 w - - 0 1', { hand: { w: ['qs_sopro_invernal'] }, zone: { b: ['ct_estalactite_travagem'], w: ['ct_recurso_tribunal'] }, replies: { b: ['ct_estalactite_travagem'], w: ['ct_recurso_tribunal'] } });
    await act(m, 'w', 'qs_sopro_invernal', { sq: sq('d5') });
    eq(at(m, 'd5').frozenUntil > 6, true, 'a Brisa resolveu');
    await nextTurn(m);
    eq(m.state.actionsLeft, 0, 'Pretas sem ações');
  });

  test('Rescisão Judicial: anula e destrói todos os Equipamentos do adversário', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { hand: { w: ['eq_espada_ganancia'] }, zone: { b: ['ct_clausula_rescisao'] }, replies: { b: ['ct_clausula_rescisao'] } });
    at(m, 'd1').equips.push('eq_mola_canguru');
    await equip(m, 'w', 'eq_espada_ganancia', 'd1');
    eq(at(m, 'd1').equips.length, 0, 'sem equipamentos');
  });

  test('Intimação: casa bloqueada 2 turnos', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { hand: { w: ['qs_intimacao_urgente'] } });
    await act(m, 'w', 'qs_intimacao_urgente', { sq: sq('d4') });
    eq(moves(m, 'd1').includes('d4') || moves(m, 'd1').includes('d6'), false, 'não passa por d4');
    for (let i = 0; i < 4; i++) await nextTurn(m);
    eq(m.pos.blocked.length, 0, 'bloqueio acabou');
  });

  test('Auditoria Fiscal: revela tudo, tira 1 armadilha do jogo e compras 1', async () => {
    const m = setup('4k3/8/8/8/8/8/8/4K3 w - - 0 1', { hand: { w: ['qs_inspecao_tributaria'] } });
    trap(m, 'gt_jaula_estatica', 'b', 'a4');
    trap(m, 'gt_jaula_estatica', 'b', 'd4');
    trap(m, 'gt_jaula_estatica', 'b', 'h5');
    await act(m, 'w', 'qs_inspecao_tributaria');
    eq(m.traps.length, 2, 'uma saiu');
    eq(m.traps.some((t) => t.sq === sq('d4')), false, 'a do centro');
    eq(m.players.b.banished.length, 1, 'banida');
    eq(m.players.w.hand.length, 1, 'comprou 1');
  });
};
