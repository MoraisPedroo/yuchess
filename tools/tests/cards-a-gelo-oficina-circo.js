/* Testes das cartas da expansão: Criogenia Cartoon, Oficina Maluca e Grande Circo Trapalhão (um por carta). */
'use strict';

module.exports = ({ test, setup, uid, at, move, nextTurn, eq, C, sq }) => {
  const trap = (m, id, owner, s) => m.traps.push({ uid: `${owner}t${s}${id}`, id, owner, sq: sq(s), setTurn: 0, revealed: false });
  const act = (m, t, id, target) => m.dispatch({ type: 'ACTIVATE', team: t, uid: uid(m, t, id), ...(target ? { target } : {}) });
  const equip = (m, t, id, s) => m.dispatch({ type: 'EQUIP', team: t, uid: uid(m, t, id), sq: sq(s) });
  const frozen = (m, s, turn) => at(m, s).frozenUntil > (turn || m.state.turnCount + 1);
  const moves = (m, s, turn) => C.legalMovesFrom(m.pos, sq(s), { turn: turn || m.state.turnCount }).map((x) => C.sqName(x.to));
  const T = (from, to) => ({ from: sq(from), to: sq(to) });

  // ── Criogenia Cartoon ──
  test('Patins de Gelo: o Peão desliza 1 casa extra', async () => {
    const m = setup('4k3/8/8/8/8/8/3P4/4K3 w - - 0 1', { hand: { w: ['eq_patins_gelo'] } });
    await equip(m, 'w', 'eq_patins_gelo', 'd2');
    eq(moves(m, 'd2').includes('d5'), true, 'd2 → d5');
    await move(m, 'w', 'd2', 'd5');
    eq(at(m, 'd5').type, 'p', 'peão em d5');
  });

  test('Cubo de Gelo: Escudo, e quem o parte fica congelado', async () => {
    const m = setup('3qk3/8/8/8/8/8/3R4/4K3 w - - 0 1', { hand: { w: ['eq_cubo_armadura'] } });
    await equip(m, 'w', 'eq_cubo_armadura', 'd2');
    eq(at(m, 'd2').shield, true, 'escudo');
    await nextTurn(m);
    await move(m, 'b', 'd8', 'd2');
    eq(at(m, 'd8').type, 'q', 'a Dama voltou');
    eq(frozen(m, 'd8'), true, 'Dama congelada');
  });

  test('Soprador de Nevasca: no início do turno congela a peça inimiga ao lado', async () => {
    const m = setup('4k3/8/8/8/3n4/3Q4/8/4K3 w - - 0 1', { hand: { w: ['eq_soprador_nevada'] } });
    await equip(m, 'w', 'eq_soprador_nevada', 'd3');
    await nextTurn(m); await nextTurn(m);
    eq(at(m, 'd4').frozenUntil > m.state.turnCount, true, 'cavalo congelado');
  });

  test('Trineu Glaciar: depois de se mexer congela as inimigas à volta', async () => {
    const m = setup('4k3/8/8/2p1p3/8/1N6/8/4K3 w - - 0 1', { hand: { w: ['eq_trono_glaciar'] } });
    await equip(m, 'w', 'eq_trono_glaciar', 'b3');
    await move(m, 'w', 'b3', 'd4');
    eq(frozen(m, 'c5') && frozen(m, 'e5'), true, 'c5 e e5 congelados');
  });

  test('Poça de Gelo: escorrega 1 casa e congela', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_poca_escorregadia', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'd5').type, 'r', 'torre em d5');
    eq(frozen(m, 'd5'), true, 'congelada');
  });

  test('Mina de Granizo: parte o Escudo, congela 2 turnos e desliga os Equipamentos', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    at(m, 'd1').shield = true;
    trap(m, 'gt_iceberg_surpresa', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    const r = at(m, 'd4');
    eq(r.shield, false, 'sem escudo');
    eq(r.frozenUntil > 9, true, 'congelada 2 turnos');
    eq(r.silenced, true, 'silenciada');
  });

  test('Canhão de Neve: congela quem pisa e as peças dele à volta', async () => {
    const m = setup('4k3/8/8/4B3/2N5/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_avalancha_neve', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(frozen(m, 'd4') && frozen(m, 'c4') && frozen(m, 'e5'), true, 'três congeladas');
  });

  test('Refletor de Zero Graus: protege um Peão e congela o atacante', async () => {
    const m = setup('4k3/8/8/3p4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_congelamento_defesa'] }, replies: { b: ['rt_congelamento_defesa'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'd5').type, 'p', 'peão vivo');
    eq(at(m, 'd1').type, 'r', 'torre voltou');
    eq(frozen(m, 'd1'), true, 'torre congelada');
  });

  test('Criopreservação Flash: quem capturou vira Peão congelado', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_estatua_gelo'] }, replies: { b: ['rt_estatua_gelo'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'd5').type, 'p', 'virou peão');
    eq(at(m, 'd5').frozenUntil > 9, true, 'congelado 2 turnos');
  });

  test('Barreira de Estalactites: anula uma Magia Rápida e congela uma peça ao acaso', async () => {
    const m = setup('4k3/8/8/3n4/8/8/3P4/4K3 w - - 0 1', { hand: { w: ['qs_sopro_invernal'] }, zone: { b: ['ct_estalactite_travagem'] }, replies: { b: ['ct_estalactite_travagem'] } });
    await act(m, 'w', 'qs_sopro_invernal', { sq: sq('d5') });
    eq(frozen(m, 'd5'), false, 'cavalo livre');
    eq(frozen(m, 'd2'), true, 'peão branco congelado');
  });

  test('Crio-Anulador: anula uma Reativa e parte os Escudos inimigos', async () => {
    const m = setup('4k3/8/8/3r4/8/8/3N3P/4K3 b - - 0 1', { team: 'b', zone: { w: ['rt_fumaca_ninja'], b: ['ct_nevasca_tribunal'] }, replies: { w: ['rt_fumaca_ninja'], b: ['ct_nevasca_tribunal'] } });
    at(m, 'h2').shield = true;
    await move(m, 'b', 'd5', 'd2');
    eq(at(m, 'd2').color, 'b', 'cavalo capturado');
    eq(at(m, 'h2').shield, false, 'escudo partido');
  });

  test('Brisa Polar: congela uma peça inimiga sem Equipamentos', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/4K3 w - - 0 1', { hand: { w: ['qs_sopro_invernal'] } });
    await act(m, 'w', 'qs_sopro_invernal', { sq: sq('d5') });
    eq(frozen(m, 'd5'), true, 'congelado');
  });

  test('Nevasca em Spray: congela a primeira inimiga na fila e na coluna', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/1b1RK3 w - - 0 1', { hand: { w: ['qs_congelador_relampago'] } });
    await act(m, 'w', 'qs_congelador_relampago', { sq: sq('d1') });
    eq(frozen(m, 'd5') && frozen(m, 'b1'), true, 'd5 e b1 congelados');
  });

  // ── Oficina Maluca ──
  test('Chave de Fendas: depois de se mexer tira um Equipamento ao lado', async () => {
    const m = setup('4k3/8/8/8/4n3/8/8/3RK3 w - - 0 1', { hand: { w: ['eq_chave_inglesa_turbo'] } });
    at(m, 'e4').equips.push('eq_capa_magnetica');
    await equip(m, 'w', 'eq_chave_inglesa_turbo', 'd1');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'e4').equips.length, 0, 'equipamento tirado');
  });

  test('Broca: fura o Escudo e captura na mesma', async () => {
    const m = setup('4k3/8/8/3b4/8/4N3/8/4K3 w - - 0 1');
    at(m, 'd5').shield = true;
    at(m, 'e3').equips.push('eq_broca_perfuradora');
    await move(m, 'w', 'e3', 'd5');
    eq(at(m, 'd5').color, 'w', 'bispo capturado');
  });

  test('Chassi de Titânio: Escudo e não ativa armadilhas', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { hand: { w: ['eq_chassi_reforcado'] } });
    trap(m, 'gt_jaula_estatica', 'b', 'd4');
    await equip(m, 'w', 'eq_chassi_reforcado', 'd1');
    eq(at(m, 'd1').shield, true, 'escudo');
    await move(m, 'w', 'd1', 'd4');
    eq(frozen(m, 'd4'), false, 'livre');
    eq(m.traps.length, 1, 'armadilha intacta');
  });

  test('Exoesqueleto: o Peão anda como Torre ou Bispo e tem Escudo', async () => {
    const m = setup('4k3/8/8/8/8/8/3P4/4K3 w - - 0 1', { hand: { w: ['eq_exoesqueleto_tita'] } });
    await equip(m, 'w', 'eq_exoesqueleto_tita', 'd2');
    eq(at(m, 'd2').shield, true, 'escudo');
    const mv = moves(m, 'd2');
    eq(mv.includes('h6') && mv.includes('a2'), true, 'diagonal e horizontal');
  });

  test('Tapete Rolante: leva a peça 2 casas para a frente', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_esteira_rolante', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'd6').type, 'r', 'torre em d6');
  });

  test('Prensa Hidráulica: tira Equipamentos e Escudo e congela', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    Object.assign(at(m, 'd1'), { shield: true, equips: ['eq_mola_canguru'] });
    trap(m, 'gt_prensa_hidraulica', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    const r = at(m, 'd4');
    eq(r.equips.length + (r.shield ? 1 : 0), 0, 'sem nada');
    eq(frozen(m, 'd4'), true, 'congelada');
  });

  test('Triturador: peça maior perde 1 Equipamento e o dono compra 2', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    at(m, 'd1').equips.push('eq_mola_canguru');
    trap(m, 'gt_triturador_sucata', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'd4').equips.length, 0, 'equipamento triturado');
    eq(m.players.b.hand.length, 2, 'Pretas compram 2');
  });

  test('Oficina de Troca Rápida: os Equipamentos passam para outra peça', async () => {
    const m = setup('4k3/8/8/3n4/8/8/6b1/3RK3 w - - 0 1', { zone: { b: ['rt_troca_pecas_express'] }, replies: { b: ['rt_troca_pecas_express'] } });
    at(m, 'd5').equips.push('eq_capa_magnetica');
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'g2').equips.includes('eq_capa_magnetica'), true, 'capa no bispo');
  });

  test('Fundição de Sucata: perde 1 Equipamento, o ataque falha e compras 1', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_fusao_engenhocas'] }, replies: { b: ['rt_fusao_engenhocas'] } });
    at(m, 'd5').equips.push('eq_capa_magnetica');
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'd5').color, 'b', 'cavalo vivo');
    eq(at(m, 'd5').equips.length, 0, 'sem equipamento');
    eq(m.players.b.hand.length, 1, 'comprou 1');
  });

  test('Chave Inglesa de Boicote: anula um Equipamento e compras 1', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { hand: { w: ['eq_espada_ganancia'] }, zone: { b: ['ct_desmancha_prazeres'] }, replies: { b: ['ct_desmancha_prazeres'] } });
    await equip(m, 'w', 'eq_espada_ganancia', 'd1');
    eq(at(m, 'd1').equips.length, 0, 'anulado');
    eq(m.players.b.hand.length, 1, 'comprou 1');
  });

  test('Óleo Turbo: a peça escolhida não ativa armadilhas neste turno', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { hand: { w: ['qs_ajuste_calibragem'] } });
    trap(m, 'gt_jaula_estatica', 'b', 'd4');
    await act(m, 'w', 'qs_ajuste_calibragem', { sq: sq('d1') });
    await move(m, 'w', 'd1', 'd4');
    eq(frozen(m, 'd4'), false, 'livre');
  });

  test('Sobrecarga: troca 1 Equipamento por Escudos e +1 ação', async () => {
    const m = setup('4k3/8/8/8/8/8/8/Q2RK3 w - - 0 1', { hand: { w: ['qs_sobrecarga_reator'] } });
    at(m, 'd1').equips.push('eq_mola_canguru');
    await act(m, 'w', 'qs_sobrecarga_reator', { sq: sq('d1') });
    eq(at(m, 'd1').equips.length, 0, 'equipamento gasto');
    eq(at(m, 'd1').shield && at(m, 'a1').shield, true, 'escudos');
    eq(m.state.actionsLeft, 2, 'ações');
  });

  test('Estação de Montagem: o Equipamento volta para a mão e +1 ação', async () => {
    const m = setup('4k3/8/8/8/8/8/8/4K3 w - - 0 1', { hand: { w: ['qs_recauchutagem_express'] } });
    m.players.w.gy.push('eq_botas_vento');
    await act(m, 'w', 'qs_recauchutagem_express');
    eq(m.players.w.hand.map((c) => c.id).join(), 'eq_botas_vento', 'botas na mão');
    eq(m.state.actionsLeft, 2, 'ações');
  });

  // ── Grande Circo Trapalhão ──
  test('Sapatos de Palhaço: captura em frente, não na diagonal', async () => {
    const m = setup('4k3/8/8/3pp3/3P4/8/8/4K3 w - - 0 1');
    at(m, 'd4').equips.push('eq_sapato_palhaco');
    const mv = moves(m, 'd4');
    eq(mv.includes('d5') && !mv.includes('e5'), true, 'só em frente');
  });

  test('Monociclo: depois de capturar foge da casa atacada', async () => {
    const m = setup('4k3/8/4p3/3p4/8/4N3/8/4K3 w - - 0 1');
    at(m, 'e3').equips.push('eq_monociclo_acrobata');
    await move(m, 'w', 'e3', 'd5');
    eq(m.pieceAt(sq('d5')), null, 'saiu de d5');
    eq(m.pos.board.some((p) => p && p.type === 'n' && p.color === 'w'), true, 'cavalo vivo');
  });

  test('Canhão de Circo: lança o Peão ao lado 3 casas', async () => {
    const m = setup('4k3/8/8/8/8/2P5/8/3RK3 w - - 0 1');
    at(m, 'd1').equips.push('eq_canhao_homem_bala');
    await move(m, 'w', 'd1', 'd3');
    eq(at(m, 'c6') && at(m, 'c6').type, 'p', 'peão em c6');
  });

  test('Torta de Chantilly: a peça não pode capturar', async () => {
    const m = setup('4k3/3p4/8/8/8/8/8/3RK3 w - - 0 1');
    trap(m, 'gt_torta_creme', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(moves(m, 'd4', 7).includes('d7'), false, 'sem captura em d7');
  });

  test('Alçapão: a peça volta à casa onde começou', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    at(m, 'd1').home = sq('a1');
    trap(m, 'gt_alcapao_palco', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'a1') && at(m, 'a1').type, 'r', 'torre em a1');
  });

  test('Argola de Fogo: parte o Escudo, empurra 2 para trás e congela', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1');
    at(m, 'd1').shield = true;
    trap(m, 'gt_argola_fogo', 'b', 'd4');
    await move(m, 'w', 'd1', 'd4');
    eq(at(m, 'd2').type, 'r', 'torre em d2');
    eq(at(m, 'd2').shield, false, 'sem escudo');
    eq(frozen(m, 'd2'), true, 'congelada');
  });

  test('Buzina: empurra a peça que dá xeque para longe do Rei', async () => {
    const m = setup('4k3/8/8/8/r7/8/8/4K3 b - - 0 1', { team: 'b', zone: { w: ['rt_buzina_estridente'] }, replies: { w: ['rt_buzina_estridente'] } });
    await move(m, 'b', 'a4', 'e4');
    eq(at(m, 'e5') && at(m, 'e5').type, 'r', 'torre empurrada para e5');
  });

  test('Ilusão de Espelhos: troca com a peça mais barata e o ataque falha', async () => {
    const m = setup('4k3/7p/8/3n4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_troca_truque'] }, replies: { b: ['rt_troca_truque'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'h7').type + at(m, 'd5').type, 'np', 'trocados');
    eq(at(m, 'd1').type, 'r', 'torre voltou');
  });

  test('Truque de Desaparecimento: a peça foge e o atacante congela', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_truque_desaparecer'] }, replies: { b: ['rt_truque_desaparecer'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(m.pos.board.some((p) => p && p.type === 'n'), true, 'cavalo vivo');
    eq(at(m, 'd1').type, 'r', 'torre voltou');
    eq(at(m, 'd1').frozenUntil > 9, true, 'atacante congelado 2 turnos');
  });

  test('Caixa de Gargalhadas: anula uma Armadilha de Casa e revela outra', async () => {
    const m = setup('4k3/8/8/8/8/8/8/3RK3 w - - 0 1', { zone: { w: ['ct_risada_gravada'] }, replies: { w: ['ct_risada_gravada'] } });
    trap(m, 'gt_jaula_estatica', 'b', 'd4');
    trap(m, 'gt_jaula_estatica', 'b', 'h5');
    await move(m, 'w', 'd1', 'd4');
    eq(frozen(m, 'd4'), false, 'livre');
    eq(m.traps.find((t) => t.sq === sq('h5')).revealed, true, 'h5 revelada');
  });

  test('Varinha de Flores: anula uma Reativa e compras 1', async () => {
    const m = setup('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1', { zone: { b: ['rt_fumaca_ninja'], w: ['ct_varinha_truque'] }, replies: { b: ['rt_fumaca_ninja'], w: ['ct_varinha_truque'] } });
    await move(m, 'w', 'd1', 'd5');
    eq(at(m, 'd5').color, 'w', 'capturado');
    eq(m.players.w.hand.length, 1, 'comprou 1');
  });

  test('Malabarismo: troca 2 peças tuas lado a lado', async () => {
    const m = setup('4k3/8/8/8/8/8/8/2NRK3 w - - 0 1', { hand: { w: ['qs_cambalhota_maluca'] } });
    await act(m, 'w', 'qs_cambalhota_maluca', T('d1', 'c1'));
    eq(at(m, 'c1').type + at(m, 'd1').type, 'rn', 'trocadas');
  });

  test('Tirolesa: a peça desliza até à borda', async () => {
    const m = setup('4k3/8/8/8/3R4/8/8/4K3 w - - 0 1', { hand: { w: ['qs_cabo_aco_voador'] } });
    await act(m, 'w', 'qs_cabo_aco_voador', T('d4', 'a4'));
    eq(at(m, 'a4') && at(m, 'a4').type, 'r', 'torre em a4');
  });
};
