/* DuelCards.js — catálogo oficial das 40 cartas do Speed Duel (Xadrez + Uno + Duel Links).
   14 Normais, 12 Épicas, 8 Lendárias e 6 Ultra-Raras. Os efeitos vivem em DuelEffects.js (por id). */
(function (YC) {
  'use strict';

  const RARITY = {
    N:  { label: 'Normal', short: 'N', max: 3, odds: 0.60 },
    E:  { label: 'Épico', short: 'E', max: 2, odds: 0.25 },
    L:  { label: 'Lendário', short: 'L', max: 2, odds: 0.11 },
    UR: { label: 'Ultra-Raro', short: 'UR', max: 1, odds: 0.04 }
  };
  const CATEGORY_LABEL = {
    MONSTER: 'Peça', SPELL: 'Feitiço Normal', QUICK_SPELL: 'Feitiço Rápido', TRAP: 'Armadilha', COUNTER_TRAP: 'Counter Trap'
  };
  const SYMBOL_LABEL = { SKIP: '⊘', REVERSE: '⇄', DRAW2: '+2', DRAW4: '+4', WILD: '★' };

  const M = (id, name, rarity, color, symbol, chess, level, atk, def, text, extra = {}) =>
    ({ id, name, rarity, color, symbol, category: 'MONSTER', chess, level, ss: 1, atk, def, text, ...extra });
  const S = (id, name, rarity, color, symbol, category, text, extra = {}) =>
    ({ id, name, rarity, color, symbol, category, ss: category === 'SPELL' ? 1 : category === 'COUNTER_TRAP' ? 3 : 2, text, ...extra });

  const CARDS = [
    // ── Normais (14) ──
    M('peao_caneca', 'Peão Caneca Soldado', 'N', 'R', '1', 'PAWN', 2, 900, 700, 'Se a Pilha Uno for Vermelha, ganha +300 ATK.'),
    M('peao_lata', 'Peão Escudeiro de Lata', 'N', 'B', '1', 'PAWN', 2, 500, 1400, 'Em Defesa, não pode ser destruído em batalha por peças de Nível 3 ou menor.'),
    M('peao_botanico', 'Peão Botânico Saltitante', 'N', 'G', '2', 'PAWN', 2, 800, 900, 'Ao ser invocado, recupera 300 LP.'),
    M('peao_faisca', 'Peão Faísca Elétrica', 'N', 'Y', '2', 'PAWN', 3, 1100, 600, 'Pode atacar diretamente se o oponente só tiver peças em Defesa (metade do dano).'),
    M('cavalo_molas', 'Cavalo de Molas Boing', 'N', 'R', '3', 'KNIGHT', 4, 1400, 1000, 'Ao atacar uma peça em Defesa, causa Dano Perfurante.'),
    M('cavalo_carrossel', 'Cavalo de Carrossel Azul', 'N', 'B', '3', 'KNIGHT', 4, 1200, 1500, 'Pode mudar de posição mesmo no turno em que entrou ou depois de atacar (1 vez por turno).'),
    M('bispo_clarinete', 'Bispo Clarinete', 'N', 'G', '4', 'BISHOP', 4, 1300, 1200, 'Ao entrar em campo, a Pilha Uno passa a Verde.'),
    M('bispo_holofote', 'Bispo Holofote', 'N', 'Y', '4', 'BISHOP', 4, 1350, 1100, 'Ao entrar em campo, revela 1 carta virada no Suporte do oponente.'),
    S('tinta_rubra', 'Tinta Rubra Fervente', 'N', 'R', '5', 'SPELL', '+500 ATK a 1 peça aliada até ao fim do turno.', { target: 'ALLY' }),
    S('apito_guarda', 'Apito de Guarda Azul', 'N', 'B', '5', 'SPELL', 'Muda 1 peça inimiga em Ataque para Defesa.', { target: 'ENEMY_ATK' }),
    S('tonel_espinafre', 'Tonel de Espinafre', 'N', 'G', '6', 'SPELL', 'Recupera 600 LP e limpa os debuffs de 1 peça aliada.', { target: 'ALLY_OPTIONAL' }),
    S('casca_banana', 'Casca de Banana no Palco', 'N', 'Y', 'SKIP', 'TRAP', 'Quando uma peça inimiga declara ataque: cancela esse ataque.', { trigger: 'ENEMY_ATTACK' }),
    S('cortina_fumo', 'Cortina de Fumaça', 'N', 'B', '0', 'TRAP', 'Quando uma peça tua é atacada: ganha +600 DEF até ao fim do turno.', { trigger: 'ALLY_ATTACKED' }),
    S('troca_chapeu', 'Troca de Chapéu Uno', 'N', 'G', 'DRAW2', 'SPELL', 'Descarta 1 carta da mão e compra 2.', { target: 'HAND_DISCARD' }),

    // ── Épicas (12) ──
    M('cavalo_fantasma', 'Cavalo Fantasma do Jazz', 'E', 'B', '6', 'KNIGHT', 4, 1600, 1200, 'Com a Pilha Uno Azul, não pode ser alvo de Armadilhas Normais.'),
    M('bispo_maestro', 'Bispo Maestro Diabólico', 'E', 'R', '7', 'BISHOP', 4, 1700, 1000, 'Quando destrói uma peça em batalha, causa +400 de dano ao oponente.'),
    M('torre_cofre', 'Torre Cofre Blindado', 'E', 'B', '8', 'ROOK', 5, 1500, 2400, 'Exige 1 Tributo. As peças inimigas têm de atacar esta Torre primeiro.'),
    M('torre_locomotiva', 'Torre Locomotiva a Vapor', 'E', 'R', '8', 'ROOK', 5, 2100, 1600, 'Exige 1 Tributo. 1 vez por turno: descarta 1 carta Vermelha e destrói 1 carta virada do oponente.', { effect: 'IGNITION' }),
    M('peao_estrela', 'Peão Promovido a Estrela', 'E', 'Y', '7', 'PAWN', 4, 1550, 1300, 'Se sobreviver 1 turno em campo, ganha +400 ATK permanentes.'),
    S('luva_boxe', 'Luva de Boxe Gigante', 'E', 'R', 'SKIP', 'QUICK_SPELL', 'Na batalha: a tua peça ganha +700 ATK até ao fim do turno.', { trigger: 'ALLY_IN_BATTLE', target: 'ALLY' }),
    S('inversao_polaridade', 'Inversão de Polaridade Uno', 'E', 'B', 'REVERSE', 'QUICK_SPELL', 'Troca o ATK e a DEF de todas as peças em campo até ao fim do turno.', { trigger: 'ANY' }),
    S('compra_gananciosa', 'Compra Gananciosa +2', 'E', 'Y', 'DRAW2', 'SPELL', 'Se a Pilha Uno for Amarela ou tiveres menos LP que o rival: compra 2.'),
    S('bigorna_ceu', 'Bigorna Caindo do Céu', 'E', 'R', '9', 'TRAP', 'Quando o oponente invoca uma peça com 1500+ ATK: −800 ATK nessa peça.', { trigger: 'ENEMY_SUMMON_1500' }),
    S('alcapao_teatro', 'Alçapão de Teatro', 'E', 'G', 'SKIP', 'TRAP', 'Quando o oponente invoca uma peça sem Tributo: devolve-a à mão dele.', { trigger: 'ENEMY_SUMMON_NO_TRIBUTE' }),
    S('espelho_tinta', 'Espelho de Tinta Elástica', 'E', 'B', 'REVERSE', 'TRAP', 'Quando és atacado diretamente: reflete metade do ATK do atacante aos LP dele.', { trigger: 'ENEMY_DIRECT_ATTACK' }),
    S('censura_diretor', 'Censura do Diretor!', 'E', 'G', 'REVERSE', 'COUNTER_TRAP', 'Paga 500 LP: anula um Feitiço Normal ou Rápido do oponente.', { trigger: 'ENEMY_SPELL', cost: { lp: 500 } }),

    // ── Lendárias (8) ──
    M('torre_bigben', 'Torre Colosso de Big Ben', 'L', 'Y', '9', 'ROOK', 6, 2400, 2000, 'Exige 1 Tributo. Ao entrar, paralisa 1 peça inimiga por 1 turno.', { target: 'ENEMY_OPTIONAL', shout: 'DONG! O BIG BEN MARCA A TUA HORA!' }),
    M('bispo_arcanjo', 'Bispo Arcanjo Technicolor', 'L', 'G', '9', 'BISHOP', 6, 2200, 2100, 'Exige 1 Tributo. 1 vez por turno: recupera 500 LP ou revive 1 Peão de Nível 2.', { effect: 'IGNITION', shout: 'ALELUIA EM TECHNICOLOR!' }),
    M('cavalo_valquiria', 'Cavalo Valquíria Relâmpago', 'L', 'Y', 'SKIP', 'KNIGHT', 5, 2000, 1500, 'Exige 1 Tributo. Com a Pilha Uno Amarela, ataca duas vezes por turno.', { shout: 'A CAVALGADA DO RELÂMPAGO!' }),
    M('dama_sereia', 'Dama Sereia Cala Maria', 'L', 'B', '9', 'QUEEN', 7, 2600, 2200, 'Exige 2 Tributos (ou 1 peça Azul). Ao entrar, congela as Armadilhas inimigas neste turno.', { shout: 'O CANTO DA SEREIA CONGELA AS TUAS CILADAS!' }),
    S('roleta_rei_dado', 'Roleta Russa do Rei Dado', 'L', 'W', 'WILD', 'QUICK_SPELL', 'Muda a Pilha Uno para qualquer cor e destrói 1 carta no Suporte inimigo.', { trigger: 'ANY', chooseColor: true, shout: 'FAÇAM AS VOSSAS APOSTAS!' }),
    S('ressurreicao_celuloide', 'Ressurreição de Celulóide', 'L', 'G', '0', 'SPELL', 'Invoca Especialmente 1 peça do teu Cemitério em Ataque.', { target: 'GY_MONSTER', shout: 'O FILME AINDA NÃO ACABOU!' }),
    S('dinamite_acme', 'Cilada de Dinamite ACME', 'L', 'R', 'DRAW2', 'TRAP', 'Quando uma peça tua é destruída em batalha: destrói o atacante e causa 600 de dano.', { trigger: 'ALLY_DESTROYED', shout: 'KABOOM! CAÍSTE NA CILADA!' }),
    S('julgamento_solene', 'Julgamento Solene do Tabuleiro', 'L', 'W', 'REVERSE', 'COUNTER_TRAP', 'Paga metade dos teus LP: anula QUALQUER invocação ou ativação inimiga!', { trigger: 'ENEMY_ANY_PLAY', cost: { halfLp: true }, shout: 'O TRIBUNAL DECLARA: NEGADO!' }),

    // ── Ultra-Raras (6) ──
    M('dama_soberana', 'Dama Soberana Rubra', 'UR', 'R', 'WILD', 'QUEEN', 8, 3000, 2500, 'Exige 2 Tributos. Ao entrar, destrói todas as peças em Defesa do rival.', { shout: 'AJOELHEM-SE PERANTE A SOBERANA RUBRA!' }),
    M('rei_dado_supremo', 'Rei Dado Supremo', 'UR', 'W', 'WILD', 'KING', 8, 2800, 2800, 'Exige 2 Tributos. Efeito Rápido, 1 vez por turno: rola um dado e ganha 100 × valor de ATK até ao fim do turno.', { effect: 'QUICK', shout: 'A CASA GANHA SEMPRE!' }),
    M('dragao_tres_cabecas', 'Dragão de Xadrez de Três Cabeças', 'UR', 'G', 'WILD', 'KNIGHT', 8, 3200, 2600, 'Exige 2 Tributos. Não pode ser destruído por Armadilhas Normais.', { art: 'DRAGON', shout: 'TRÊS CABEÇAS, ZERO PIEDADE!' }),
    S('penalidade_maxima', 'Penalidade Máxima Uno +4!', 'UR', 'W', 'DRAW4', 'QUICK_SPELL', 'Muda a cor Uno, compras 2 e destróis a peça de maior ATK do oponente!', { trigger: 'ANY', chooseColor: true, shout: 'MAIS QUATRO! PENALIDADE MÁXIMA!' }),
    S('parry_absoluto', 'Parry Real Absoluto! (Uno Reverse)', 'UR', 'W', 'REVERSE', 'COUNTER_TRAP', 'Anula qualquer ataque ou carta na Chain e reflete 1000 de dano ao oponente!', { trigger: 'ENEMY_ATTACK_OR_CARD', shout: 'CONTEMPLE A MINHA CARTA ULTRA-RARA! PARRY REAL!' }),
    S('xeque_mate_diabo', 'Xeque-Mate do Diabo (Wallop!)', 'UR', 'R', '0', 'SPELL', 'Só com menos de 1500 LP: dobra o ATK de 1 peça aliada neste turno!', { target: 'ALLY', shout: 'XEQUE-MATE, DIABO! WALLOP!' })
  ];

  const BY_ID = Object.fromEntries(CARDS.map((c, i) => [c.id, { ...c, num: i + 1 }]));
  CARDS.forEach((c, i) => { c.num = i + 1; });

  /** Baralho inicial (só Normais, sem peças que exigem Tributo). */
  const STARTER_DECK = [
    'peao_caneca', 'peao_caneca', 'peao_lata', 'peao_lata', 'peao_botanico', 'peao_faisca',
    'cavalo_molas', 'cavalo_carrossel', 'bispo_clarinete', 'tinta_rubra', 'casca_banana', 'cortina_fumo'
  ];

  function tributesFor(card) {
    if (card.category !== 'MONSTER') return 0;
    if (card.level >= 7) return 2;
    if (card.level >= 5) return 1;
    return 0;
  }

  /** Valida um baralho de 12 cartas. `owned` (opcional) limita às cópias da coleção. */
  function validateDeck(ids, owned) {
    const errors = [];
    if (ids.length !== 12) errors.push(`O baralho tem ${ids.length}/12 cartas.`);
    const count = {};
    for (const id of ids) {
      const c = BY_ID[id];
      if (!c) { errors.push(`Carta desconhecida: ${id}`); continue; }
      count[id] = (count[id] || 0) + 1;
    }
    for (const [id, n] of Object.entries(count)) {
      const c = BY_ID[id];
      if (n > RARITY[c.rarity].max) errors.push(`${c.name}: máximo ${RARITY[c.rarity].max} (${RARITY[c.rarity].label}).`);
      if (owned && n > (owned[id] || 0)) errors.push(`${c.name}: só tens ${owned[id] || 0}.`);
    }
    if (!ids.some((id) => BY_ID[id] && BY_ID[id].category === 'MONSTER' && tributesFor(BY_ID[id]) === 0)) {
      errors.push('Precisas de pelo menos 1 peça sem Tributo.');
    }
    return { ok: errors.length === 0, errors, count };
  }

  YC.DuelCards = { CARDS, BY_ID, RARITY, CATEGORY_LABEL, SYMBOL_LABEL, STARTER_DECK, tributesFor, validateDeck };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
