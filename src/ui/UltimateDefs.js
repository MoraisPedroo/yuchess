/* UltimateDefs.js — as personagens das Ultimates (uma por Lendária). Arte e vídeos em assets/ultimate/<icon>/
   (hero.png, summon.mp4 e, nas que golpeiam, strike.mp4), feitos no Gemini (docs/ART-PROMPTS.md, secção "Ultimate").
   role: 'attack' — Equipamento; a peça vira a personagem e ao capturar entra o golpe e a energia voa até ao alvo.
         'guard'  — Equipamento; a peça vira a personagem e protege o Rei (barreira) enquanto tiver Escudo.
         'power'  — Equipamento; a peça vira a personagem e o golpe entra quando o poder da carta dispara (equip:proc).
         'card'   — Armadilha / Counter-Trap; a personagem entra quando a carta é ativada e aparece no tabuleiro quando
                    ela resolve (cast: onde aparece e para onde dispara). Lógica em Ultimates.js e UltimateCards.js. */
(function (YC) {
  'use strict';

  const D = (o) => Object.assign({ ms: { summon: 4600, strike: 4000 }, hit: 0.6 }, o);
  const ATT = (what) => [['No tabuleiro', 'a peça passa a ser a própria personagem.'], ['Golpe', `sempre que ela captura, entra o vídeo do golpe e ${what}`]];

  YC.ULT_DEFS = {
    eq_cetro_usurpador: D({
      id: 'eq_cetro_usurpador', icon: 'royal_scepter', name: 'Akane', title: 'A Rainha Rubi', role: 'attack', c1: '#D90429', c2: '#FFB703',
      say: { summon: 'Esta coroa agora é minha!', strike: 'Ajoelha-te perante a rainha!' }, ms: { summon: 4800, strike: 4000 }, hit: 0.68,
      tabs: { summon: 'Invocação', strike: 'Golpe' },
      about: [['Invocar', 'ao equipares o Cetro, entra um vídeo especial e o Peão transforma-se na Akane.'],
        ...ATT('uma bola de energia sai dela e explode na peça inimiga.')]
    }),
    eq_escudo_choque: D({
      id: 'eq_escudo_choque', icon: 'escudo_antitumulto', name: 'Kaito', title: 'O Guardião Azul', role: 'guard', c1: '#0077B6', c2: '#48CAE4',
      say: { summon: 'Ninguém toca no meu Rei!', guard: 'Barreira total!' }, ms: { summon: 4600, guard: 3600 }, hit: 0.5,
      files: { guard: 'strike' }, tabs: { summon: 'Invocação', guard: 'Defesa' },
      about: [['Invocar', 'ao equipares o Escudo, entra um vídeo especial, a peça transforma-se no Kaito e lança uma barreira de hexágonos sobre o teu Rei.'],
        ['No tabuleiro', 'só enquanto o Escudo dele estiver de pé, o Rei fica dentro da barreira (não pode levar xeque com lances).'],
        ['Defesa', 'quando o atacam, entra o vídeo dele a defender; se o Escudo partir, a barreira do Rei estilhaça.']]
    }),

    // ── Equipamentos novos ──
    eq_exoesqueleto_tita: D({
      id: 'eq_exoesqueleto_tita', icon: 'exoesqueleto_robo', name: 'Riku', title: 'O Piloto Mecânico', role: 'attack', c1: '#D90429', c2: '#FB8500', fx: 'EXPLOSION',
      say: { summon: 'Sistemas a cem por cento!', strike: 'Punho Turbo!' }, ms: { summon: 5600, strike: 4000 }, tabs: { summon: 'Invocação', strike: 'Golpe' },
      about: [['Invocar', 'ao equipares o Exoesqueleto, o Peão liga o fato robô e transforma-se no Riku.'], ...ATT('um punho de energia laranja voa até à peça inimiga.')]
    }),
    eq_elixir_mutacao_total: D({
      id: 'eq_elixir_mutacao_total', icon: 'soro_alfa', name: 'Nova', title: 'A Cientista Alfa', role: 'attack', c1: '#168AAD', c2: '#2EC4B6', fx: 'TOXIC',
      say: { summon: 'Evolução total!', strike: 'Fórmula explosiva!' }, tabs: { summon: 'Mutação', strike: 'Golpe' },
      about: [['Invocar', 'ao equipares o Soro, a mutação vira o Peão na Dra. Nova (e continua a ser uma Dama para as regras).'], ...ATT('um frasco de energia verde-água rebenta na peça inimiga.')]
    }),
    eq_bussola_tesouro: D({
      id: 'eq_bussola_tesouro', icon: 'bussola_dourada', name: 'Marina', title: 'A Caçadora de Tesouros', role: 'attack', c1: '#0077B6', c2: '#FFB703', fx: 'COIN',
      say: { summon: 'Rumo ao tesouro!', strike: 'Este saque é meu!' }, tabs: { summon: 'Invocação', strike: 'Golpe' },
      about: [['Invocar', 'ao equipares a Bússola, a peça transforma-se na Marina.'], ...ATT('um raio dourado cheio de moedas acerta na peça inimiga (e rouba a carta, como diz a Bússola).')]
    }),
    eq_trono_glaciar: D({
      id: 'eq_trono_glaciar', icon: 'trineu_glaciar', name: 'Yuki', title: 'A Princesa da Neve', role: 'power', c1: '#0077B6', c2: '#90E0EF', fx: 'ICE',
      say: { summon: 'O inverno chegou!', strike: 'Tempestade Glaciar!' }, ms: { summon: 5400, strike: 4000 }, tabs: { summon: 'Invocação', strike: 'Poder' },
      about: [['Invocar', 'ao equipares o Trineu, a peça transforma-se na Yuki.'], ['No tabuleiro', 'a peça passa a ser a própria Yuki.'],
        ['Poder', 'sempre que congela as peças à volta, entra o vídeo dela e uma onda de gelo sai do Trineu.']]
    }),
    eq_canhao_homem_bala: D({
      id: 'eq_canhao_homem_bala', icon: 'canhao_circo', name: 'Lola', title: 'A Mestra do Circo', role: 'power', c1: '#D90429', c2: '#FFB703', fx: 'CONFETTI',
      say: { summon: 'Senhoras e senhores!', strike: 'Fogo no canhão!' }, tabs: { summon: 'Invocação', strike: 'Poder' },
      about: [['Invocar', 'ao equipares o Canhão, a peça transforma-se na Lola.'], ['No tabuleiro', 'a peça passa a ser a própria Lola.'],
        ['Poder', 'quando o Canhão dispara, entra o vídeo dela e o Peão voa entre confetes.']]
    }),

    // ── Armadilhas e Counter-Traps: a personagem entra quando a carta é ativada ──
    gt_guilhotina_bigorna: D({
      id: 'gt_guilhotina_bigorna', icon: 'heavy_anvil', name: 'Goro', title: 'O Ferreiro Colossal', role: 'card', c1: '#D90429', c2: '#FB8500', fx: 'IMPACT',
      say: { summon: 'Cem toneladas a caminho!' }, ms: { summon: 5000 }, tabs: { summon: 'Ativação' }, cast: { at: 'trap', text: 'BONK!', heavy: true },
      about: [['Ativar', 'quando uma peça inimiga pisa a Bigorna, entra o vídeo do Goro.'], ['No tabuleiro', 'o Goro aparece na casa e a bigorna cai com um estrondo.']]
    }),
    rt_espelho_magico: D({
      id: 'rt_espelho_magico', icon: 'rubber_mirror', name: 'Mira', title: 'A Ilusionista do Espelho', role: 'card', c1: '#12B5CB', c2: '#F538A0', fx: 'GLASS',
      say: { summon: 'Devolve ao remetente!' }, tabs: { summon: 'Ativação' }, cast: { at: 'defender', to: 'attacker', text: 'BOING!' },
      about: [['Ativar', 'quando o Espelho dispara, entra o vídeo da Mira.'], ['No tabuleiro', 'a Mira aparece na peça atacada e devolve o ataque a quem o fez.']]
    }),
    rt_truque_desaparecer: D({
      id: 'rt_truque_desaparecer', icon: 'truque_magica', name: 'Luna', title: 'A Mágica Relâmpago', role: 'card', c1: '#9D0208', c2: '#FFB703', fx: 'SMOKE',
      say: { summon: 'Puf! Já não estou aqui!' }, tabs: { summon: 'Ativação' }, cast: { at: 'defender', text: 'PUF!' },
      about: [['Ativar', 'quando o Truque dispara, entra o vídeo da Luna.'], ['No tabuleiro', 'a Luna aparece na peça atacada e some com ela numa nuvem de fumo.']]
    }),
    rt_injuncao_suprema: D({
      id: 'rt_injuncao_suprema', icon: 'veto_supremo', name: 'Aiko', title: 'A Juíza Suprema', role: 'card', c1: '#9D0208', c2: '#E2E8F0', fx: 'IMPACT',
      say: { summon: 'Veto! Captura anulada!' }, tabs: { summon: 'Ativação' }, cast: { at: 'defender', to: 'attacker', text: 'VETO!' },
      about: [['Ativar', 'quando o Veto dispara, entra o vídeo da Aiko.'], ['No tabuleiro', 'a Aiko aparece na peça atacada e o martelo dela acerta em quem atacou.']]
    }),
    ct_apito_juiz: D({
      id: 'ct_apito_juiz', icon: 'golden_whistle', name: 'Rin', title: 'A Árbitra Suprema', role: 'card', c1: '#FB8500', c2: '#FFE066',
      say: { summon: 'Falta! Jogada anulada!' }, tabs: { summon: 'Ativação' },
      about: [['Ativar', 'quando ativas o Apito, entra o vídeo da Rin a apitar.'], ['Depois', 'a carta do adversário é anulada como sempre (carimbo "NEGADO!").']]
    }),
    ct_clausula_rescisao: D({
      id: 'ct_clausula_rescisao', icon: 'quebra_contrato', name: 'Ren', title: 'O Advogado Implacável', role: 'card', c1: '#475569', c2: '#FB8500',
      say: { summon: 'Contrato rescindido!' }, tabs: { summon: 'Ativação' },
      about: [['Ativar', 'quando ativas a Rescisão, entra o vídeo do Ren a rasgar o contrato.'], ['Depois', 'a carta do adversário é anulada e os Equipamentos dele partem-se.']]
    })
  };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
