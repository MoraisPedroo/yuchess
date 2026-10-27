/* Cards.js — as 120 cartas do Chess-Gi-Oh!: as 31 originais aqui e as 89 da expansão em CardsNew.js (dados puros;
   os efeitos estão em CardEffects.js e CardEffects2.js).
   kind: EQUIP (Velocidade 1, da mão para uma peça) · GRID (armadilha escondida numa casa)
         REACTIVE (armadilha virada para baixo na Zona, reage a captura/destruição/xeque)
         COUNTER (Counter-Trap Velocidade 3, virada para baixo na Zona) · QUICK (Magia Rápida Velocidade 2). */
(function (YC) {
  'use strict';

  const RARITY = {
    COMMON: { label: 'Comum', color: '#8E9BAE', dust: 10, craft: 40, cap: 2, order: 0 },
    RARE: { label: 'Rara', color: '#1A73E8', dust: 30, craft: 120, cap: 2, order: 1 },
    EPIC: { label: 'Épica', color: '#C58AF9', dust: 100, craft: 400, cap: 2, order: 2 },
    LEGENDARY: { label: 'Lendária', color: '#FCC934', dust: 300, craft: 1000, cap: 1, order: 3 }
  };

  const TYPE_LABEL = { EQUIPMENT: 'Equipamento', GRID_TRAP: 'Armadilha de Casa', REACTIVE_TRAP: 'Armadilha Reativa', COUNTER_SPELL: 'Counter' };
  const KIND_LABEL = { EQUIP: 'Equipamento', GRID: 'Armadilha de Casa', REACTIVE: 'Armadilha Reativa', COUNTER: 'Counter-Trap', QUICK: 'Magia Rápida' };

  // [id, nome, tipo, kind, raridade, velocidade, extra, texto, [cor1, cor2, ícone, som]]
  const RAW = [
    ['eq_espada_ganancia', 'Espada da Ganância Voraz', 'EQUIPMENT', 'EQUIP', 'EPIC', 1, { pieces: 'pnbr', family: 'sucata' },
      'Equipa um Peão, Cavalo, Bispo ou Torre. Quando ela capturar uma peça inimiga, compras 1 carta (máx. 1 por turno).', ['#F538A0', '#FCC934', 'GREED_SWORD', 'sword_draw']],
    ['eq_botas_vento', 'Botas de Vento Supersónico', 'EQUIPMENT', 'EQUIP', 'COMMON', 1, { pieces: 'p' },
      'Equipa um Peão. Pode avançar 2 casas em qualquer turno, se o caminho estiver livre.', ['#12B5CB', '#FFFFFF', 'WIND_BOOTS', 'spring_jump']],
    ['eq_mola_canguru', 'Mola de Salto Canguru', 'EQUIPMENT', 'EQUIP', 'RARE', 1, { pieces: 'rb' },
      'Equipa uma Torre ou um Bispo. Pode saltar por cima de exatamente 1 peça no caminho (o salto não dá xeque).', ['#FA903E', '#FCC934', 'SPRING_COIL', 'spring_jump']],
    ['eq_aura_glacial', 'Coroa da Aura Glacial', 'EQUIPMENT', 'EQUIP', 'EPIC', 1, { pieces: 'nbrq' },
      'Depois de a peça se mexer, congela durante 1 turno uma peça inimiga ortogonalmente adjacente (exceto o Rei).', ['#1A73E8', '#E8F0FE', 'ICE_CROWN', 'ice_freeze']],
    ['eq_cetro_usurpador', 'Cetro do Falso Monarca', 'EQUIPMENT', 'EQUIP', 'LEGENDARY', 1, { pieces: 'p', shield: true },
      'Equipa um Peão. Passa a mover-se e a capturar como um Rei e recebe 1 Escudo.', ['#FCC934', '#D93025', 'ROYAL_SCEPTER', 'magic_zap']],
    ['eq_armadura_espinhos', 'Armadura de Cacto Explosivo', 'EQUIPMENT', 'EQUIP', 'RARE', 1, { pieces: 'pnbr' },
      'Se a peça equipada for capturada, a peça atacante (exceto o Rei) é destruída com ela.', ['#81C995', '#111111', 'SPIKE_ARMOR', 'explosion_bam']],
    ['eq_lanca_telescopica', 'Lança Telescópica de Mola', 'EQUIPMENT', 'EQUIP', 'EPIC', 1, { pieces: 'pn', family: 'oficina' },
      'Equipa um Peão ou Cavalo. Uma vez por partida, captura uma peça inimiga até 2 casas em linha sem sair da sua casa.', ['#D93025', '#FA903E', 'SPRING_SPEAR', 'sword_draw']],
    ['eq_capa_magnetica', 'Capa de Repulsão Magnética', 'EQUIPMENT', 'EQUIP', 'COMMON', 1, { pieces: 'nbrq' },
      'Os Peões inimigos não podem capturar a peça equipada.', ['#C58AF9', '#1A73E8', 'MAGNET_CAPE', 'shield_clang']],

    ['gt_mina_repulsora', 'Fosso de Gravidade Zero', 'GRID_TRAP', 'GRID', 'RARE', 2, {},
      'Escondida numa casa. Peão inimigo que a pise é destruído; peça maior é empurrada 1 casa para trás e congelada 1 turno.', ['#C58AF9', '#12B5CB', 'GRAVITY_PIT', 'explosion_bam']],
    ['gt_jaula_estatica', 'Jaula de Choque Cartoon', 'GRID_TRAP', 'GRID', 'COMMON', 2, {},
      'Escondida numa casa. A peça inimiga que a pise fica congelada durante 2 turnos.', ['#FCC934', '#1A73E8', 'ELECTRIC_CAGE', 'ice_freeze']],
    ['gt_guilhotina_bigorna', 'Bigorna de 100 Toneladas', 'GRID_TRAP', 'GRID', 'LEGENDARY', 2, {},
      'Escondida numa casa. Cai uma bigorna gigante: destrói a peça inimiga que a pise (exceto o Rei) e congela 1 turno as inimigas à volta.', ['#111111', '#D93025', 'HEAVY_ANVIL', 'explosion_bam']],
    ['gt_pantano_chiclete', 'Pântano de Chiclete Rosa', 'GRID_TRAP', 'GRID', 'COMMON', 2, {},
      'Escondida numa casa. Destrói os Equipamentos da peça inimiga que a pise e congela-a 1 turno.', ['#F538A0', '#FFFFFF', 'BUBBLEGUM_SWAMP', 'ice_freeze']],
    ['gt_mola_retorno', 'Trampolim de Ejeção', 'GRID_TRAP', 'GRID', 'RARE', 2, {},
      'Escondida numa casa. A peça inimiga que a pise é arremessada de volta à casa de onde veio.', ['#FA903E', '#81C995', 'EJECT_PAD', 'spring_jump']],
    ['gt_raio_encolhedor', 'Raio Encolhedor de Laboratório', 'GRID_TRAP', 'GRID', 'EPIC', 2, {},
      'Escondida numa casa. A peça inimiga que a pise (exceto o Rei) vira Peão durante 2 turnos.', ['#81C995', '#C58AF9', 'SHRINK_RAY', 'magic_zap']],
    ['gt_buraco_minhoca', 'Buraco de Minhoca Maluco', 'GRID_TRAP', 'GRID', 'RARE', 2, {},
      'Escondida numa casa. Teletransporta a peça inimiga para a casa vazia mais distante nas colunas A ou H.', ['#1A73E8', '#C58AF9', 'WORMHOLE', 'magic_zap']],
    ['gt_bomba_tinta', 'Mina de Tinta Cegante', 'GRID_TRAP', 'GRID', 'COMMON', 2, {},
      'Escondida numa casa. Empurra a peça inimiga 1 casa para trás e o dono da armadilha compra 1 carta.', ['#12B5CB', '#111111', 'INK_MINE', 'explosion_bam']],

    ['rt_escudo_divino', 'Égide de Cristal Cartoon', 'REACTIVE_TRAP', 'REACTIVE', 'EPIC', 2, { trigger: 'CAPTURE', shieldCard: true },
      'Quando uma peça aliada é alvo de captura: um escudo absorve o golpe e o atacante volta à casa de origem.', ['#12B5CB', '#FCC934', 'CRYSTAL_SHIELD', 'shield_clang']],
    ['rt_espelho_magico', 'Espelho de Borracha Suprema', 'REACTIVE_TRAP', 'REACTIVE', 'LEGENDARY', 2, { trigger: 'CAPTURE' },
      'Quando uma peça aliada seria capturada: anula a captura e destrói a peça atacante (exceto o Rei).', ['#F538A0', '#12B5CB', 'RUBBER_MIRROR', 'shield_clang']],
    ['rt_fumaca_ninja', 'Bomba de Fumo Ninja', 'REACTIVE_TRAP', 'REACTIVE', 'COMMON', 2, { trigger: 'CAPTURE' },
      'Quando uma peça aliada é alvo de captura: foge para uma casa vazia adjacente (de preferência segura).', ['#575B5F', '#C58AF9', 'SMOKE_BOMB', 'spring_jump']],
    ['rt_troca_dubles', 'Boneco de Testes Insuflável', 'REACTIVE_TRAP', 'REACTIVE', 'RARE', 2, { trigger: 'CAPTURE', majorOnly: true },
      'Quando uma Dama, Torre, Bispo ou Cavalo aliado seria capturado: destrói um Peão aliado no lugar dele e cancela o ataque.', ['#FA903E', '#FFFFFF', 'DUMMY_DOLL', 'spring_jump']],
    ['rt_alarme_real', 'Guarda-Costas do Rei', 'REACTIVE_TRAP', 'REACTIVE', 'RARE', 2, { trigger: 'CHECK' },
      'Quando o teu Rei fica em xeque: congela 2 turnos a peça que deu xeque e compras 1 carta.', ['#FCC934', '#1A73E8', 'ROYAL_SIREN', 'shield_clang']],
    ['rt_vampiro_energia', 'Seguro de Vida de Sucata', 'REACTIVE_TRAP', 'REACTIVE', 'COMMON', 2, { trigger: 'DESTROYED', majorOnly: true, family: 'sucata' },
      'Quando um Cavalo, Bispo, Torre ou Dama teu é capturado ou destruído: compras 2 cartas.', ['#81C995', '#FCC934', 'PIGGY_BANK', 'magic_zap']],
    ['rt_cupula_dupla', 'Gerador de Bolhas Gémeas', 'REACTIVE_TRAP', 'REACTIVE', 'EPIC', 2, { trigger: 'DESTROYED', shieldCard: true },
      'Quando uma peça aliada é destruída: dá um Escudo às 2 peças aliadas mais valiosas sem escudo.', ['#12B5CB', '#F538A0', 'TWIN_BUBBLES', 'shield_clang']],

    ['ct_julgamento_cartoon', 'Martelo do NEGADO! Supremo', 'COUNTER_SPELL', 'COUNTER', 'EPIC', 3, { negates: ['GRID', 'REACTIVE'] },
      'Counter-Trap: quando o adversário ativa uma Armadilha de Casa ou Reativa, anula-a e destrói-a.', ['#D93025', '#FCC934', 'JUDGE_HAMMER', 'negate_stamp']],
    ['ct_tesoura_corta_fio', 'Tesoura Gigante Corta-Fios', 'COUNTER_SPELL', 'COUNTER', 'COMMON', 3, { negates: ['GRID'], reveal: true },
      'Counter-Trap: anula uma Armadilha de Casa ativada pelo adversário e revela outra armadilha escondida dele.', ['#FA903E', '#111111', 'GIANT_SCISSORS', 'negate_stamp']],
    ['ct_ima_equipamento', 'Íman Ladrão de Engenhocas', 'COUNTER_SPELL', 'QUICK', 'RARE', 2, { target: 'STEAL' },
      'Magia Rápida: rouba 1 Equipamento de uma peça inimiga e passa-o para uma peça tua compatível.', ['#D93025', '#1A73E8', 'THIEF_MAGNET', 'magic_zap']],
    ['ct_apito_juiz', 'Apito do Juiz Subornado', 'COUNTER_SPELL', 'COUNTER', 'LEGENDARY', 3, { negates: ['EQUIP', 'GRID', 'REACTIVE', 'COUNTER', 'QUICK'], draw: 1 },
      'Counter-Trap suprema: anula qualquer carta do adversário, destrói-a e compras 1 carta.', ['#FCC934', '#111111', 'GOLDEN_WHISTLE', 'negate_stamp']],
    ['ct_emp_cartoon', 'Pulso Eletromagnético Boom', 'COUNTER_SPELL', 'QUICK', 'EPIC', 2, { target: 'SQUARE' },
      'Magia Rápida: escolhe uma casa; destrói todas as Armadilhas de Casa escondidas na zona 3×3 à volta.', ['#12B5CB', '#C58AF9', 'EMP_BLAST', 'explosion_bam']],
    ['ct_quebra_escudo', 'Britadeira Fura-Bolhas', 'COUNTER_SPELL', 'QUICK', 'COMMON', 2, {},
      'Magia Rápida: destrói os Escudos das peças inimigas e o adversário não pode ganhar Escudos neste turno.', ['#FA903E', '#D93025', 'JACKHAMMER', 'explosion_bam']],
    ['ct_reverso_tempo', 'Relógio de Corda Reversa', 'COUNTER_SPELL', 'COUNTER', 'RARE', 3, { negates: ['REACTIVE'], freeze: true },
      'Counter-Trap: anula uma Armadilha Reativa do adversário e congela 1 turno a peça que ela protegia.', ['#C58AF9', '#FCC934', 'REWIND_CLOCK', 'negate_stamp']],
    ['ct_confisco_real', 'Luva de Boxe Confiscadora', 'COUNTER_SPELL', 'COUNTER', 'RARE', 3, { negates: ['EQUIP', 'GRID', 'REACTIVE'], toDeck: true },
      'Counter-Trap: anula uma Armadilha ou Equipamento do adversário e devolve a carta ao topo do baralho dele.', ['#D93025', '#81C995', 'BOXING_GLOVE', 'negate_stamp']]
  ];

  const CARDS = {};
  const LIST = RAW.concat(YC.CARDS_NEW || []).map(([id, name, type, kind, rarity, ss, extra, text, [primary, secondary, icon, sfx]]) => {
    const c = { id, name, type, kind, rarity, ss, text, theme: { primary, secondary, icon, sfx }, ...extra };
    if (c.pieces) c.pieces = c.pieces.split('');
    CARDS[id] = c;
    return c;
  });

  // Baralho inicial "Patrulha da Oficina" (relatório, secção F): 14 Comuns e 8 Raras, ensina os 5 tipos de carta
  const STARTER_DECK = [
    'eq_botas_vento', 'eq_botas_vento', 'eq_colete_balas', 'eq_colete_balas', 'eq_mola_canguru', 'eq_mola_canguru',
    'gt_jaula_estatica', 'gt_jaula_estatica', 'gt_mola_retorno', 'gt_mola_retorno',
    'rt_fumaca_ninja', 'rt_fumaca_ninja', 'rt_alarme_real', 'rt_alarme_real',
    'ct_tesoura_corta_fio', 'ct_tesoura_corta_fio', 'ct_desmancha_prazeres', 'ct_desmancha_prazeres',
    'qs_escolta_armada', 'qs_escolta_armada', 'qs_helicoptero_apoio', 'qs_helicoptero_apoio'
  ];

  // Baralhos do bot (secção F): Fácil "Circo no Gelo", Médio "Engenharia Mutante", Difícil "Supremo Tribunal"
  const x2 = (...ids) => ids.flatMap((id) => [id, id]);
  const BOT_DECKS = {
    easy: [...x2('eq_patins_gelo', 'eq_capa_magnetica', 'eq_cubo_armadura', 'gt_poca_escorregadia', 'gt_bomba_tinta', 'gt_alcapao_palco',
      'rt_congelamento_defesa', 'rt_buzina_estridente', 'ct_varinha_truque', 'qs_sopro_invernal', 'qs_arremesso_ancora')],
    medium: [...x2('eq_broca_perfuradora', 'eq_chassi_reforcado', 'eq_aura_glacial', 'gt_prensa_hidraulica', 'gt_lodo_radioativo',
      'rt_troca_pecas_express', 'rt_reacao_quimica_cadeia', 'ct_cartao_vermelho', 'ct_descontaminador', 'qs_transmutacao_peao', 'qs_soro_crescimento')],
    hard: [...x2('eq_balanca_justica', 'eq_sirene_perseguicao', 'gt_cela_detencao', 'gt_tubarao_mar', 'rt_habeas_corpus', 'rt_reciclagem_turbo',
      'ct_cartao_vermelho', 'ct_julgamento_cartoon', 'qs_saque_rapido'), 'eq_escudo_choque', 'rt_injuncao_suprema', 'ct_clausula_rescisao', 'qs_inspecao_tributaria']
  };

  const RULES = { DECK_SIZE: 22, START_HAND: 3, MAX_HAND: 5, MAX_GRID_TRAPS: 3, ZONE_SLOTS: 3, ACTIONS_PER_TURN: 2, MAX_EQUIPS: 2, CHAIN_MAX: 8, MAX_COPIES: 2, MAX_LEGENDARIES: 3, MAX_ACTIONS: 4 };

  YC.Cards = {
    RARITY, TYPE_LABEL, KIND_LABEL, CARDS, LIST, STARTER_DECK, BOT_DECKS, RULES,
    get: (id) => CARDS[id],
    byRarity: (r) => LIST.filter((c) => c.rarity === r),
    kindLabel: (c) => KIND_LABEL[c.kind]
  };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
