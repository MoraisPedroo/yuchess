/* Testes das cartas da expansão: Banco de Sucata & Pirataria e Força Policial (um por carta), mais as regras
   novas do baralho de 22 e os ajustes às cartas originais. */
'use strict';

module.exports = ({ test, setup, uid, at, move, nextTurn, eq, YC, C, sq, FILL }) => {
  const trap = (m, id, owner, s) => m.traps.push({ uid: `${owner}t${s}${id}`, id, owner, sq: sq(s), setTurn: 0, revealed: false });
  const act = (m, t, id, target) => m.dispatch({ type: 'ACTIVATE', team: t, uid: uid(m, t, id), ...(target ? { target } : {}) });
  const equip = (m, t, id, s) => m.dispatch({ type: 'EQUIP', team: t, uid: uid(m, t, id), sq: sq(s) });
  const frozen = (m, s) => at(m, s).frozenUntil > m.state.turnCount + 1;
  const moves = (m, s, turn) => C.legalMovesFrom(m.pos, sq(s), { turn: turn || m.state.turnCount }).map((x) => C.sqName(x.to));
  const T = (from, to) => ({ from: sq(from), to: sq(to) });

  // ── Banco de Sucata & Pirataria ──
  test('Gancho de Abordagem: puxa um Peão inimigo para a casa de onde saiu', async () => {
    const m = setup('4k3/8/4p3/3n4/8/3R4/8/4K3 w - - 0 1');
    at(m, 'd3').equips.push('eq_gancho_pirata');
    await move(m, 'w', 'd3', 'd5');
    eq(at(m, 'd3') && `${at(m, 'd3').color}${at(m, 'd3').type}`, 'bp', 'peão preto em d3');
  });

  test('Papagaio: compra o Equipamento do topo do baralho', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { deck: { w: ['eq_botas_vento', 'eq_capa_magnetica', ...FILL] } });
    at(m, 'd1').equips.push('eq_papagaio_vigia');
    await nextTurn(m); await nextTurn(m);
    eq(m.players.w.hand.length, 2, 'compra normal + papagaio');
  });

  test('Saco de Dobrões: na 5.ª fila compra 2 e ganha Escudo', async () => {
    const m = setup('4k3/8/8/8/3P4/8/8/4K3 w - - 0 1');
    at(m, 'd4').equips.push('eq_saco_pilhagem');
    await move(m, 'w', 'd4', 'd5');
    eq(m.players.w.hand.length, 2, 'comprou 2');
    eq(at(m, 'd5').shield, true, 'escudo');
  });

  test('Bússola Dourada: ao capturar rouba a carta do topo do adversário', async () => {
    const m = setup('4k3/8/8/3p4/8/4N3/8/4K3 w - - 0 1');
    at(m, 'e3').equips.push('eq_bussola_tesouro');
    await move(m, 'w', 'e3', 'd5');
    eq(m.players.w.hand.map((c) => c.id).join(), 'gt_jaula_estatica', 'carta roubada');
    eq(m.players.b.deck.length, FILL.length - 1, 'saiu do baralho preto');
  });

  test('Barril de Pólvora: o Peão que o pisa explode', async () => {
    const m = setup('4k3/8/8/8/8/8/3P4/4K3 w - - 0 1');
    trap(m, 'gt_barril_polvora', 'b', 'd4');
    await move(m, 'w', 'd2', 'd4');
    eq(m.pieceAt(sq('d4')), null, 'peão destruído');
  });

  test('X Assinala Tesouro: as tuas peças ativam-na, as inimigas não', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_mapa_naufragio', 'w', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(m.players.w.hand.length, 2, 'comprou 2');
    eq(m.traps.length, 0, 'gasta');
  });

  test('Tanque de Tubarões: destrói a peça (a Dama só congela)', async () => {
    const m = setup('4k3/8/8/8/8/8/8/Q2RK3 w - - 0 1');
    trap(m, 'gt_tubarao_mar', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(m.pieceAt(sq('d4')), null, 'torre engolida');
  });

  test('Baú de Resgate: o último Equipamento do cemitério volta à mão', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_seguro_naufragio'] }, replies: { b: ['rt_seguro_naufragio'] } });
    m.players.b.gy.push('eq_capa_magnetica');
    await move(m, 'w', 'd1', 'd5');
    eq(m.players.b.hand.some((c) => c.id === 'eq_capa_magnetica'), true, 'capa na mão');
  });

  test('Canhões de Bordo: o ataque falha, o atacante recua 2 e compras 1', async () => {
    const m = setup('4k3/8/8/3n4/8/3R4/8/4K3 w - - 0 1', { zone: { b: ['rt_canhoneio_bordo'] }, replies: { b: ['rt_canhoneio_bordo'] } });
    await move(m, 'w', 'd3', 'd5');
    eq(at(m, 'd5').color, 'b', 'cavalo vivo');
    eq(at(m, 'd1') && at(m, 'd1').type, 'r', 'torre recuou');
    eq(m.players.b.hand.length, 1, 'comprou 1');
  });

  test('Íman de Sucata: compras 2 e o adversário descarta 1', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { hand: { w: ['gt_jaula_estatica'] }, zone: { b: ['rt_reciclagem_turbo'] }, replies: { b: ['rt_reciclagem_turbo'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(m.players.b.hand.length, 3, 'recuperação + 2');
    eq(m.players.w.hand.length, 0, 'descartou');
  });

  test('Garrafa de Rum: anula um Equipamento e compras 1', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { hand: { w: ['eq_mola_canguru'] }, zone: { b: ['ct_motim_bordo'] }, replies: { b: ['ct_motim_bordo'] } });
    await equip(m, 'w', 'eq_mola_canguru', 'd1');
    eq(at(m, 'd1').equips.length, 0, 'anulado');
    eq(m.players.b.hand.length, 1, 'comprou 1');
  });

  test('Pilha de Tralha: compra 2 e descarta a mais fraca', async () => {
    const m = setup('4k3/8/8/8/8/8/8/4K3 w - - 0 1', { hand: { w: ['qs_saque_rapido'] }, deck: { w: ['ct_apito_juiz', 'eq_botas_vento', ...FILL] } });
    await act(m, 'w', 'qs_saque_rapido');
    eq(m.players.w.hand.map((c) => c.id).join(), 'ct_apito_juiz', 'ficou a Lendária');
  });

  test('Âncora: empurra 2 casas para o lado dela e congela', async () => {
    const m = setup('4k3/8/8/8/3n4/8/8/4K3 w - - 0 1', { hand: { w: ['qs_arremesso_ancora'] } });
    await act(m, 'w', 'qs_arremesso_ancora', { sq: sq('d4') });
    eq(at(m, 'd6') && at(m, 'd6').type, 'n', 'cavalo em d6');
    eq(frozen(m, 'd6'), true, 'congelado');
  });

  // ── Força Policial ──
  test('Colete Balístico: Escudo e os Peões não o capturam', async () => {
    const m = setup('4k3/8/8/4p3/3B4/8/8/4K3 w - - 0 1', { hand: { w: ['eq_colete_balas'] } });
    await equip(m, 'w', 'eq_colete_balas', 'd4');
    eq(at(m, 'd4').shield, true, 'escudo');
    eq(moves(m, 'e5', 6).includes('d4'), false, 'o peão não captura');
  });

  test('Megafone: empurra as peças inimigas à volta', async () => {
    const m = setup('4k3/8/8/4n3/8/8/8/3RK3 w - - 0 1');
    at(m, 'd1').equips.push('eq_megafone_ordem');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'f6') && at(m, 'f6').type, 'n', 'cavalo em f6');
  });

  test('Sirene: a Torre também anda 1 casa na diagonal', async () => {
    const m = setup('4k3/8/8/8/3R4/8/8/4K3 w - - 0 1', { hand: { w: ['eq_sirene_perseguicao'] } });
    await equip(m, 'w', 'eq_sirene_perseguicao', 'd4');
    const mv = moves(m, 'd4');
    eq(mv.includes('c5') && mv.includes('e3'), true, 'diagonais');
    eq(at(m, 'd4').shield, true, 'escudo');
  });

  test('Escudo Antitumulto: com Escudo, não se pode dar xeque ao Rei', async () => {
    const m = setup('4k3/8/8/8/r7/8/8/1N2K3 b - - 0 1', { team: 'b' });
    Object.assign(at(m, 'b1'), { shield: true, equips: ['eq_escudo_choque'] });
    eq(moves(m, 'a4').includes('e4'), false, 'xeque proibido');
    at(m, 'b1').shield = false;
    eq(moves(m, 'a4').includes('e4'), true, 'sem escudo já pode');
  });

  test('Fita de Picos: parte o Escudo e congela', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    at(m, 'd1').shield = true;
    trap(m, 'gt_barricada_picos', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'd4').shield, false, 'sem escudo');
    eq(frozen(m, 'd4'), true, 'congelada');
  });

  test('Cone de Trânsito: desvia para o lado e bloqueia a casa', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_cone_sinalizacao', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'e4') && at(m, 'e4').type, 'r', 'torre em e4');
    eq(m.pos.blocked.includes(sq('d4')), true, 'd4 bloqueada');
  });

  test('Lança-Redes: presa 2 turnos e perde Equipamentos e Escudo', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    Object.assign(at(m, 'd1'), { shield: true, equips: ['eq_mola_canguru'] });
    trap(m, 'gt_rede_captura', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    const r = at(m, 'd4');
    eq(r.frozenUntil > 9 && !r.shield && !r.equips.length, true, 'presa sem nada');
  });

  test('Algemas: quem capturou fica congelado 2 turnos', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_algemas_rapidas'] }, replies: { b: ['rt_algemas_rapidas'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'd5').frozenUntil > 9, true, 'algemada');
  });

  test('Cordão de Polícia: uma Torre tapa o xeque e ganha Escudo', async () => {
    const m = setup('4k3/8/8/8/r7/7R/8/4K3 b - - 0 1', { team: 'b', zone: { w: ['rt_cordao_seguranca'] }, replies: { w: ['rt_cordao_seguranca'] } });
    await move(m, 'b', 'a4', 'e4');
    eq(at(m, 'e2') && at(m, 'e2').type, 'r', 'torre em e2');
    eq(at(m, 'e2').shield, true, 'escudo');
    eq(C.inCheck(m.pos, 'w'), false, 'xeque tapado');
  });

  test('Carro Patrulha: Escudo e o Peão avança 2 fora da casa inicial', async () => {
    const m = setup('4k3/8/8/8/8/3P4/8/4K3 w - - 0 1', { hand: { w: ['qs_escolta_armada'] } });
    await act(m, 'w', 'qs_escolta_armada', { sq: sq('d3') });
    eq(at(m, 'd3').shield, true, 'escudo');
    eq(moves(m, 'd3').includes('d5'), true, 'd3 → d5');
  });

  test('Barreira Antidistúrbios: Escudo (ou para a peça ao lado se já tiver)', async () => {
    const m = setup('4k3/8/8/8/8/8/8/2NRK3 w - - 0 1', { hand: { w: ['qs_bloqueio_tatico'] } });
    at(m, 'd1').shield = true;
    await act(m, 'w', 'qs_bloqueio_tatico', { sq: sq('d1') });
    eq(at(m, 'c1').shield, true, 'o cavalo ao lado recebeu');
  });

  test('Helicóptero: leva uma peça para a 1.ª ou 2.ª fila', async () => {
    const m = setup('4k3/8/8/3N4/8/8/8/4K3 w - - 0 1', { hand: { w: ['qs_helicoptero_apoio'] } });
    await act(m, 'w', 'qs_helicoptero_apoio', T('d5', 'a2'));
    eq(at(m, 'a2') && at(m, 'a2').type, 'n', 'cavalo em a2');
  });

  // ── regras do baralho de 22 e ajustes às cartas originais ──
  test('Baralho vazio: o cemitério volta ao baralho uma vez (sem as Lendárias)', async () => {
    const m = setup('4k3/8/8/8/8/8/8/4K3 w - - 0 1', { deck: { w: [] } });
    m.players.w.gy.push('gt_jaula_estatica', 'gt_bomba_tinta', 'ct_apito_juiz');
    await m.draw('w', 1, 'turn');
    eq(m.players.w.hand.length, 1, 'comprou');
    eq(m.players.w.deck.length, 1, 'sobrou 1');
    eq(m.players.w.gy.join(), 'ct_apito_juiz', 'a Lendária ficou');
  });

  test('Baralhos: 22 cartas e até 3 Lendárias', async () => {
    const R = YC.Cards.RULES;
    eq(R.DECK_SIZE, 22, 'tamanho');
    for (const [lvl, d] of Object.entries({ inicial: YC.Cards.STARTER_DECK, ...YC.Cards.BOT_DECKS })) eq(YC.Economy.validateDeck(null, d, { ignoreOwnership: true }).ok, true, `baralho ${lvl}`);
    const four = ['eq_cetro_usurpador', 'gt_guilhotina_bigorna', 'rt_espelho_magico', 'ct_apito_juiz', ...FILL.slice(4)];
    eq(YC.Economy.validateDeck(null, four, { ignoreOwnership: true }).ok, false, '4 Lendárias não');
  });

  test('Seguro de Vida (ajustado): perder um Peão já não compra', async () => {
    const m = setup('4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_vampiro_energia'] }, replies: { b: ['rt_vampiro_energia'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(m.players.b.hand.length, 0, 'sem compra');
  });

  test('Íman: com 2 equipamentos, rouba o que o jogador escolher', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/2B1K3 w - - 0 1', { hand: { w: ['ct_ima_equipamento'] } });
    at(m, 'd5').equips.push('eq_capa_magnetica', 'eq_armadura_espinhos');
    const pairs = YC.CardEffects.stealPairs(m, 'w').filter((p) => p.from === sq('d5') && p.to === sq('c1'));
    eq(pairs.length, 2, 'dois equipamentos à escolha');
    await act(m, 'w', 'ct_ima_equipamento', { from: sq('d5'), to: sq('c1'), id: 'eq_armadura_espinhos' });
    eq(at(m, 'c1').equips.join(), 'eq_armadura_espinhos', 'o escolhido');
    eq(at(m, 'd5').equips.join(), 'eq_capa_magnetica', 'o outro fica');
  });

  test('Bigorna (ajustada): também congela as peças à volta', async () => {
    const m = setup('4k3/8/8/8/2N5/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_guilhotina_bigorna', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(m.pieceAt(sq('d4')), null, 'torre destruída');
    eq(frozen(m, 'c4'), true, 'cavalo congelado');
  });
};
