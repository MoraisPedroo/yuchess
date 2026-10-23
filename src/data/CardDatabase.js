/* CardDatabase.js — catálogo declarativo de cartas híbridas (Uno + Yu-Gi-Oh!) e stats base das peças.
   O motor só interpreta primitivas ("op"); nenhuma carta tem código próprio. */
(function (YC) {
  'use strict';

  const pieceBaseStats = {
    PAWN:   { name: 'Peão Mug',      hp: 40,  atk: 20, shield: 0,  tier: 1, value: 10 },
    KNIGHT: { name: 'Cavalo Swing',  hp: 80,  atk: 35, shield: 15, tier: 1, value: 30 },
    BISHOP: { name: 'Bispo Jazz',    hp: 70,  atk: 40, shield: 10, tier: 1, value: 32 },
    ROOK:   { name: 'Torre BigBen',  hp: 120, atk: 45, shield: 30, tier: 2, value: 50 },
    QUEEN:  { name: 'Dama Cala',     hp: 150, atk: 65, shield: 25, tier: 3, value: 90 },
    KING:   { name: 'Rei Dice',      hp: 200, atk: 30, shield: 40, tier: 3, value: 400 }
  };

  const piecePassives = {
    PAWN: 'Falange: +10 ESC enquanto tiver um Peão aliado na diagonal adjacente.',
    KNIGHT: 'Salto Elástico: ignora armadilhas nas casas intermédias do salto em "L".',
    BISHOP: 'Disparo Diagonal: sofre só metade do contra-ataque se atacar a ≥3 casas.',
    ROOK: 'Muralha de Ferro: imune a efeitos de recuo (molas e empurrões).',
    QUEEN: 'Soberania: uma vez por partida, joga qualquer carta como se combinasse.',
    KING: 'Monarca Absoluto: se o HP do Rei chegar a 0, a partida acaba.'
  };

  const COLOR_NAME = { R: 'Vermelho', B: 'Azul', G: 'Verde', Y: 'Amarelo', W: 'Curinga' };
  const COLOR_HEX = { R: '#C83E3B', B: '#2F5D8A', G: '#3E7D4A', Y: '#E5A93C', W: '#141210' };
  const TYPE_LABEL = {
    NORMAL_SPELL: 'Feitiço Normal', QUICK_SPELL: 'Feitiço Rápido',
    SPATIAL_TRAP: 'Armadilha Espacial', COUNTER_TRAP: 'Contra-Armadilha'
  };
  const VALUE_LABEL = { SKIP: '⊘', REVERSE: '⇄', DRAW2: '+2', WILD: '★', WILD4: '+4' };
  const TRIGGER_LABEL = {
    ON_UNO_PLAY: 'Ao ser jogada na pilha',
    ON_STEP_ENTER: 'Quando uma peça inimiga pisa a casa',
    ON_CHAIN_LINK_ADDED: 'Responde a qualquer elo do oponente',
    ON_ATTACK_DECLARED: 'Quando o oponente ataca uma peça tua',
    ON_ROYAL_TARGETED: 'Quando o oponente ataca o teu Rei ou Dama',
    ON_TRAP_ACTIVATED: 'Quando uma armadilha inimiga apanha uma peça tua',
    ON_OPPONENT_UNO_MATCH: 'Quando o oponente joga uma carta Uno',
    ON_SPELL_OR_TRAP: 'Responde a cartas e armadilhas do oponente',
    ON_OPPONENT_RESPONSE: 'Quando o oponente responde ao teu movimento'
  };

  /** Texto da regra base de cada valor Uno (permissão de movimento + bónus). */
  function unoRuleText(value) {
    if (value === '0') return '0: Roque, troca de 2 aliadas adjacentes ou Peão. Limpa debuffs da fila.';
    if (['1', '2', '3'].includes(value)) return `${value}: move Peão/Cavalo/Bispo · +${10 * value} ESC temporário.`;
    if (['4', '5', '6'].includes(value)) return `${value}: move Peão/Cavalo/Bispo/Torre · +${10 * value} ATK neste turno.`;
    if (['7', '8', '9'].includes(value)) return `${value}: move qualquer peça · +25% ATK e perfura escudo.`;
    if (value === 'SKIP') return 'Bloqueio: move Peão/Cavalo · congela 1 peça inimiga por 1 turno.';
    if (value === 'REVERSE') return 'Inversão: move Bispo/Torre · troca ATK↔ESC de 1 peça até ao fim do turno.';
    if (value === 'DRAW2') return '+2: move Peão · compras 2, o oponente perde 1 carta.';
    return 'Curinga: move qualquer peça e escolhe a nova cor.';
  }

  const COLOR_RESONANCE = {
    R: 'Fúria Rubra: +20 ATK',
    B: 'Guarda Cobalto: +25 ESC',
    G: 'Vitalidade Esmeralda: +30 HP',
    Y: 'Passo Relâmpago: +1 passo ortogonal'
  };

  const T = (cardType, spellSpeed, placement, triggerCondition) => ({ cardType, spellSpeed, placement, triggerCondition });
  const NORMAL = T('NORMAL_SPELL', 1, 'DISCARD_PILE', 'ON_UNO_PLAY');
  const QUICK = (trigger) => T('QUICK_SPELL', 2, 'SUPPORT_ZONE', trigger);
  const TRAP = T('SPATIAL_TRAP', 2, 'BOARD_TILE', 'ON_STEP_ENTER');
  const COUNTER = (trigger) => T('COUNTER_TRAP', 3, 'SUPPORT_ZONE', trigger);
  const U = (color, value) => ({
    color, value,
    symbol: /^[0-9]$/.test(value) ? 'NUMBER' : value
  });

  const cards = [
    // ── Feitiços Normais (SS1): jogados na pilha Uno com efeito extra ──
    { id: 'red_7_anvil', name: 'Bigorna Rubra do 7', uno: U('R', '7'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'BUFF_ACTIVE_PIECE', stat: 'atk', amount: 35 }, { op: 'PIERCE_SHIELD' }],
      description: '+35 ATK extra à peça que moveres e perfuração de escudo.' },
    { id: 'yellow_4_pies', name: 'Chuva de Tartes', uno: U('Y', '4'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'FIELD_DAMAGE', team: 'ENEMY', pieceTypes: ['PAWN'], amount: 12, ignoreShield: true }],
      description: 'Todos os Peões inimigos levam 12 de dano (ignora escudo).' },
    { id: 'green_5_coffee', name: 'Café Duplo', uno: U('G', '5'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'DRAW_CARDS', who: 'SELF', amount: 1 }, { op: 'BUFF_ACTIVE_PIECE', stat: 'heal', amount: 20 }],
      description: 'Compra 1 carta. A peça que moveres recupera mais 20 HP.' },
    { id: 'blue_2_watch', name: 'Relógio de Bolso', uno: U('B', '2'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'BUFF_ACTIVE_PIECE', stat: 'shield', amount: 20 }],
      description: 'A peça que moveres ganha mais +20 ESC.' },
    { id: 'green_0_revive', name: 'Ressurreição Swing', uno: U('G', '0'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'REVIVE', pieceType: 'PAWN' }],
      description: 'Invoca um Peão do teu cemitério para a tua 2.ª fila.' },
    { id: 'blue_6_detective', name: 'Detetive de Bolso', uno: U('B', '6'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'DESTROY_ENEMY_TRAP', amount: 1 }],
      description: 'Descobre e destrói 1 armadilha oculta do oponente no tabuleiro.' },
    { id: 'red_skip_cane', name: 'Bengalada', uno: U('R', 'SKIP'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'DEAL_DAMAGE', target: 'CHOSEN', amount: 15 }],
      description: 'Além de congelar o alvo, causa-lhe 15 de dano.' },
    { id: 'yellow_reverse_mirror', name: 'Espelho Maluco', uno: U('Y', 'REVERSE'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'DRAW_CARDS', who: 'SELF', amount: 1 }],
      description: 'Inverte ATK↔ESC do alvo e compras 1 carta.' },
    { id: 'yellow_draw2_coins', name: 'Saco de Moedas', uno: U('Y', 'DRAW2'), yugioh: NORMAL, copies: 1,
      effects: [], description: 'O clássico +2 do Rei Dice.' },
    { id: 'green_draw2_milk', name: 'Garrafa de Leite', uno: U('G', 'DRAW2'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'FIELD_HEAL', team: 'ALLY', amount: 10 }],
      description: '+2 e todas as tuas peças recuperam 10 HP.' },
    { id: 'wild_ink_storm', name: 'Tempestade de Tinta', uno: U('W', 'WILD'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'FIELD_DAMAGE', team: 'ENEMY', amount: 10, ignoreShield: false }],
      description: 'Efeito de campo: 10 de dano a todas as peças inimigas.' },
    { id: 'wild_spotlight', name: 'Holofote Esmeralda', uno: U('W', 'WILD'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'FIELD_HEAL', team: 'ALLY', amount: 20 }],
      description: 'Efeito de campo: todas as tuas peças recuperam 20 HP.' },
    { id: 'wild4_jackpot', name: 'Jackpot do Rei Dice', uno: U('W', 'WILD4'), yugioh: NORMAL, copies: 1,
      effects: [{ op: 'DRAW_CARDS', who: 'SELF', amount: 2 }, { op: 'DISCARD_RANDOM', who: 'OPPONENT', amount: 2 }],
      description: 'Compras 2 e o oponente perde 2 cartas ao acaso.' },

    // ── Feitiços Rápidos (SS2): resposta na Chain (da mão no teu turno, ou do Suporte) ──
    { id: 'blue_3_umbrella', name: 'Guarda-Chuva Elástico', uno: U('B', '3'), yugioh: QUICK('ON_ATTACK_DECLARED'), copies: 2,
      effects: [{ op: 'BUFF_STAT', target: 'DEFENDER', stat: 'shield', amount: 40 }],
      description: 'A peça atacada ganha +40 ESC antes do golpe.' },
    { id: 'green_8_tango', name: 'Esquiva de Tango', uno: U('G', '8'), yugioh: QUICK('ON_ATTACK_DECLARED'), copies: 1,
      effects: [{ op: 'HEAL', target: 'DEFENDER', amount: 30 }, { op: 'BUFF_STAT', target: 'DEFENDER', stat: 'shield', amount: 15 }],
      description: 'A peça atacada recupera 30 HP e ganha +15 ESC.' },
    { id: 'red_5_hook', name: 'Gancho de Mola', uno: U('R', '5'), yugioh: QUICK('ON_ATTACK_DECLARED'), copies: 1,
      effects: [{ op: 'DEAL_DAMAGE', target: 'ATTACKER', amount: 30 }],
      description: 'Uma luva de mola acerta 30 de dano na peça atacante.' },
    { id: 'blue_7_tincoat', name: 'Casaco de Lata', uno: U('B', '7'), yugioh: QUICK('ON_TRAP_ACTIVATED'), copies: 1,
      effects: [{ op: 'BUFF_STAT', target: 'TRIGGERING_PIECE', stat: 'shield', amount: 35 }],
      description: 'A tua peça apanhada pela armadilha ganha +35 ESC antes do efeito.' },
    { id: 'yellow_9_dust', name: 'Pó de Pirlimpimpim', uno: U('Y', '9'), yugioh: QUICK('ON_OPPONENT_UNO_MATCH'), copies: 1,
      effects: [{ op: 'DISCARD_RANDOM', who: 'OPPONENT', amount: 1 }, { op: 'DRAW_CARDS', who: 'SELF', amount: 1 }],
      description: 'O oponente perde 1 carta ao acaso e tu compras 1.' },
    { id: 'red_1_punch', name: 'Soco de Borracha', uno: U('R', '1'), yugioh: QUICK('ON_OPPONENT_RESPONSE'), copies: 1,
      effects: [{ op: 'BUFF_STAT', target: 'MY_MOVING_PIECE', stat: 'atk', amount: 30, duration: 'TURN' }],
      description: 'Se o oponente responder ao teu movimento: a tua peça ganha +30 ATK.' },

    // ── Armadilhas Espaciais (SS2): ocultas numa casa vazia da tua metade ──
    { id: 'trap_blue_skip_banana', name: 'Casca de Banana Cilada', uno: U('B', 'SKIP'), yugioh: TRAP, copies: 3,
      effects: [{ op: 'INTERRUPT_MOVEMENT' }, { op: 'DEAL_DAMAGE', target: 'TRIGGERING_PIECE', amount: 25 },
        { op: 'APPLY_STATUS', target: 'TRIGGERING_PIECE', status: 'STUNNED', durationTurns: 1 }],
      description: 'Pára a peça inimiga, causa 25 de dano e congela-a 1 turno.' },
    { id: 'trap_yellow_2_spring', name: 'Mola Escondida', uno: U('Y', '2'), yugioh: TRAP, copies: 2,
      effects: [{ op: 'INTERRUPT_MOVEMENT' }, { op: 'KNOCKBACK', target: 'TRIGGERING_PIECE', to: 'MOVE_ORIGIN' },
        { op: 'DEAL_DAMAGE', target: 'TRIGGERING_PIECE', amount: 10 }],
      description: 'BOING! Devolve a peça inimiga à casa de partida e causa 10 de dano.' },
    { id: 'trap_red_8_anvil', name: 'Bigorna Caída', uno: U('R', '8'), yugioh: TRAP, copies: 2,
      effects: [{ op: 'INTERRUPT_MOVEMENT' }, { op: 'DEAL_DAMAGE', target: 'TRIGGERING_PIECE', amount: 45 }],
      description: 'Uma bigorna cai do céu: pára a peça e causa 45 de dano.' },
    { id: 'trap_green_6_ink', name: 'Poça de Tinta', uno: U('G', '6'), yugioh: TRAP, copies: 1,
      effects: [{ op: 'INTERRUPT_MOVEMENT' }, { op: 'DEAL_DAMAGE', target: 'TRIGGERING_PIECE', amount: 10 },
        { op: 'BUFF_STAT', target: 'TRIGGERING_PIECE', stat: 'atk', amount: -20, durationTurns: 2 }],
      description: 'Pára a peça, 10 de dano e −20 ATK durante 2 turnos.' },
    { id: 'trap_green_9_dynamite', name: 'Dinamite de Palco', uno: U('G', '9'), yugioh: TRAP, copies: 1,
      effects: [{ op: 'INTERRUPT_MOVEMENT' }, { op: 'DEAL_DAMAGE', target: 'TRIGGERING_PIECE', amount: 30 },
        { op: 'SPLASH_DAMAGE', amount: 15 }],
      description: 'KABOOM! 30 de dano à peça e 15 a todas as peças à volta.' },

    // ── Contra-Armadilhas (SS3): só outra SS3 lhes pode responder ──
    { id: 'counter_wild_reverse_parry', name: 'Parry Real! (Uno Reverse)', uno: U('W', 'REVERSE'),
      yugioh: COUNTER('ON_CHAIN_LINK_ADDED'), copies: 2, cost: { type: 'KING_HP', amount: 15 },
      effects: [{ op: 'VFX_PARRY_FLASH', intensity: 1 }, { op: 'NEGATE_CHAIN_LINK', targetLinkOffset: -1, destroySourceCard: true },
        { op: 'DEAL_DAMAGE', target: 'OPPONENT_ACTIVE_PIECE', amount: 30 }],
      description: 'Paga 15 HP do teu Rei: anula o elo anterior e reflete 30 de dano.' },
    { id: 'counter_blue_0_judgement', name: 'Julgamento Solene do Rei', uno: U('B', '0'),
      yugioh: COUNTER('ON_ROYAL_TARGETED'), copies: 1, cost: { type: 'DISCARD', amount: 1 },
      effects: [{ op: 'VFX_PARRY_FLASH', intensity: 0.8 }, { op: 'NEGATE_CHAIN_LINK', targetLinkOffset: -1 },
        { op: 'APPLY_STATUS', target: 'ATTACKER', status: 'STUNNED', durationTurns: 1 }],
      description: 'Descarta 1 carta: anula um ataque ao teu Rei/Dama e congela o atacante.' },
    { id: 'counter_yellow_0_block', name: 'Bloqueio Absoluto', uno: U('Y', '0'),
      yugioh: COUNTER('ON_SPELL_OR_TRAP'), copies: 1, cost: { type: 'KING_HP', amount: 10 },
      effects: [{ op: 'VFX_PARRY_FLASH', intensity: 0.7 }, { op: 'NEGATE_CHAIN_LINK', targetLinkOffset: -1, destroySourceCard: true }],
      description: 'Paga 10 HP do Rei: anula uma carta ou armadilha do oponente.' },
    { id: 'counter_red_6_cuckoo', name: 'Cuco Contra-Relógio', uno: U('R', '6'),
      yugioh: COUNTER('ON_ATTACK_DECLARED'), copies: 1, cost: { type: 'DISCARD', amount: 1 },
      effects: [{ op: 'VFX_PARRY_FLASH', intensity: 0.7 }, { op: 'NEGATE_CHAIN_LINK', targetLinkOffset: -1 },
        { op: 'DEAL_DAMAGE', target: 'ATTACKER', amount: 15 }],
      description: 'Descarta 1 carta: anula um ataque e o cuco bica 15 de dano.' }
  ];

  /** Cartas Uno básicas (0–9 em cada cor) para dar corpo ao baralho. */
  function basicCards() {
    const out = [];
    const names = { R: 'Swing Vermelho', B: 'Blues Azul', G: 'Charleston Verde', Y: 'Ragtime Amarelo' };
    for (const color of ['R', 'B', 'G', 'Y']) {
      for (let v = 0; v <= 9; v++) {
        out.push({ id: `basic_${color}_${v}`, name: `${names[color]} ${v}`, basic: true, uno: U(color, String(v)),
          yugioh: NORMAL, copies: 1, effects: [], description: '' });
      }
    }
    return out;
  }

  const allDefs = [...cards, ...basicCards()];
  const defsById = Object.fromEntries(allDefs.map((d) => [d.id, d]));

  /** Instancia o baralho completo (cada cópia ganha um uid único). */
  function buildDeck() {
    const deck = [];
    let n = 0;
    for (const def of allDefs) {
      for (let i = 0; i < (def.copies || 1); i++) deck.push(instantiate(def, `c_${++n}`));
    }
    return deck;
  }

  function instantiate(def, uid) {
    return {
      uid, defId: def.id, name: def.name, basic: !!def.basic,
      uno: { ...def.uno }, yugioh: { ...def.yugioh },
      cost: def.cost ? { ...def.cost } : null,
      effects: def.effects.map((e) => ({ ...e })),
      description: def.description,
      turnSet: null, owner: null, isActivatedInCurrentChain: false
    };
  }

  YC.CardDatabase = {
    pieceBaseStats, piecePassives, cards, allDefs, defsById, buildDeck, instantiate,
    COLOR_NAME, COLOR_HEX, TYPE_LABEL, VALUE_LABEL, TRIGGER_LABEL, COLOR_RESONANCE, unoRuleText
  };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
