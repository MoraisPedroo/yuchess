/* DuelArt.js — arte procedural das cartas do Speed Duel: peças rubber hose pintadas com a cor Uno
   da carta e 20 emblemas cartunescos (com olhos pie-cut) para feitiços, armadilhas e counters. */
(function (YC) {
  'use strict';

  const INK = '#141210', CREAM = '#FFF8E7', CHAR = '#2B262D';
  const HEX = { R: '#C83E3B', B: '#2F5D8A', G: '#3E7D4A', Y: '#E5A93C', W: '#E5A93C' };
  const st = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  /** Par de olhos pie-cut em markup (para os emblemas). */
  function eyes(x, y, s = 1) {
    const one = (dx) => `<g transform="translate(${x + dx * s} ${y}) scale(${s * 0.55})">
      <ellipse rx="8" ry="11" fill="#FFFDF7" ${st(3)}/><path d="M1,1.5 L6.48,2.15 A5.5,7.5 0 1,1 4.54,-4.24 Z" fill="${INK}"/></g>`;
    return one(-6) + one(6);
  }

  const EMBLEMS = {
    tinta_rubra: () => `<rect x="44" y="10" width="32" height="10" rx="3" fill="${INK}"/>
      <path d="M46,20 h28 v10 l10,10 v36 a6,6 0 0 1 -6,6 h-36 a6,6 0 0 1 -6,-6 v-36 l10,-10 z" fill="${CREAM}" ${st()}/>
      <path d="M38,52 h44 v24 a5,5 0 0 1 -5,5 h-34 a5,5 0 0 1 -5,-5 z" fill="#C83E3B"/>
      <path d="M86,46 q9,12 1,20 q-7,-7 -1,-20z" fill="#C83E3B" ${st(2.5)}/>${eyes(60, 40, 1)}`,
    apito_guarda: () => `<path d="M24,40 h46 a20,20 0 1 1 -14,34 h-32 z" fill="#2F5D8A" ${st()}/>
      <circle cx="70" cy="56" r="9" fill="${CREAM}" ${st(3)}/><path d="M86,28 l10,-8 M92,40 l12,-2 M88,52 l12,6" fill="none" ${st(3)}/>${eyes(42, 54, 0.9)}`,
    tonel_espinafre: () => `<path d="M40,30 q20,-6 40,0 q6,24 0,50 q-20,6 -40,0 q-6,-26 0,-50z" fill="#8B5E3C" ${st()}/>
      <path d="M38,44 h44 M38,68 h44" ${st(3)}/><path d="M48,30 q-8,-18 6,-20 q4,10 -2,20 M62,28 q2,-20 16,-14 q-4,12 -14,14 M72,30 q14,-10 18,0" fill="#3E7D4A" ${st(2.5)}/>${eyes(60, 56, 0.9)}`,
    casca_banana: () => `<path d="M60,22 q-2,30 -26,52 q16,-4 24,-18 q4,16 22,20 q-12,-22 -12,-52z" fill="#F2D24B" ${st()}/>
      <path d="M58,22 q0,-8 6,-10 l2,8" fill="#8B5E3C" ${st(3)}/>${eyes(60, 44, 0.8)}`,
    cortina_fumo: () => `<path d="M26,66 q-12,-2 -8,-16 q4,-12 18,-8 q4,-16 22,-12 q14,-10 26,4 q16,-2 16,14 q8,10 -4,18 z" fill="#C6D7EA" ${st()}/>
      <path d="M40,58 q6,-6 12,0 M66,52 q6,-6 12,0" fill="none" ${st(2.5)}/>${eyes(60, 64, 0.8)}`,
    troca_chapeu: () => `<rect x="38" y="16" width="44" height="44" rx="4" fill="${CHAR}" ${st()}/>
      <rect x="38" y="44" width="44" height="8" fill="#3E7D4A"/><ellipse cx="60" cy="62" rx="36" ry="8" fill="${CHAR}" ${st()}/>
      <text x="60" y="38" text-anchor="middle" font-family="Rye, Georgia, serif" font-size="18" fill="${CREAM}">+2</text>`,
    luva_boxe: () => `<path d="M30,48 q0,-26 30,-26 q30,0 30,26 q0,22 -24,26 h-18 q-18,-4 -18,-26z" fill="#C83E3B" ${st()}/>
      <path d="M36,40 q-14,0 -12,14 q4,10 14,6" fill="#C83E3B" ${st(3.5)}/><rect x="42" y="72" width="30" height="12" rx="3" fill="${CREAM}" ${st(3)}/>${eyes(62, 44, 1)}`,
    inversao_polaridade: () => `<path d="M30,20 v34 a30,30 0 0 0 60,0 v-34 h-16 v34 a14,14 0 0 1 -28,0 v-34 z" fill="#2F5D8A" ${st()}/>
      <rect x="30" y="18" width="16" height="14" fill="#C83E3B" ${st(3)}/><rect x="74" y="18" width="16" height="14" fill="${CREAM}" ${st(3)}/>
      <path d="M12,70 q-6,-12 6,-16 M108,70 q6,-12 -6,-16" fill="none" ${st(3)}/>${eyes(60, 70, 0.7)}`,
    compra_gananciosa: () => `<path d="M44,22 q16,8 32,0 l-6,12 q22,10 22,30 q0,20 -32,20 q-32,0 -32,-20 q0,-20 22,-30 z" fill="#E5A93C" ${st()}/>
      <text x="60" y="70" text-anchor="middle" font-family="Rye, Georgia, serif" font-size="20" fill="${INK}">+2</text>${eyes(60, 48, 0.8)}`,
    bigorna_ceu: () => `<path d="M24,30 h62 q10,0 14,10 h-26 v14 h-12 l8,14 h14 v10 h-50 v-10 h14 l8,-14 h-12 v-14 h-20 z" fill="#5d5a63" ${st()}/>
      <path d="M30,14 v10 M50,8 v12 M70,10 v12 M90,14 v10" ${st(3)}/>${eyes(58, 42, 0.8)}`,
    alcapao_teatro: () => `<rect x="18" y="56" width="84" height="20" fill="#8B5E3C" ${st()}/>
      <path d="M36,56 h48 l-6,-40 h-36 z" fill="#6E4B33" ${st()}/><path d="M36,56 h48" ${st(3)}/><rect x="40" y="58" width="40" height="16" fill="${INK}"/>${eyes(60, 34, 0.8)}`,
    espelho_tinta: () => `<ellipse cx="60" cy="38" rx="26" ry="28" fill="#c6d7ea" ${st()}/><path d="M54,64 l-6,22 h24 l-6,-22" fill="#8B5E3C" ${st()}/>
      <path d="M46,24 l10,-6 M44,34 l20,-14" ${st(3)}/>${eyes(60, 44, 0.8)}`,
    censura_diretor: () => `<path d="M24,46 l40,-22 v52 l-40,-22 z" fill="#3E7D4A" ${st()}/><rect x="14" y="40" width="12" height="14" fill="${INK}"/>
      <path d="M72,30 l16,-8 M74,48 h20 M72,64 l16,8" fill="none" ${st(3)}/><text x="96" y="86" text-anchor="end" font-family="Rye, Georgia, serif" font-size="13" fill="${INK}">CORTA!</text>`,
    roleta_rei_dado: () => `<circle cx="48" cy="46" r="32" fill="${CREAM}" ${st()}/>
      ${['#C83E3B', INK, '#C83E3B', INK, '#C83E3B', INK].map((c, i) => `<path d="M48,46 L${48 + 30 * Math.cos(i * 1.047)},${46 + 30 * Math.sin(i * 1.047)} A30,30 0 0 1 ${48 + 30 * Math.cos((i + 1) * 1.047)},${46 + 30 * Math.sin((i + 1) * 1.047)} Z" fill="${c}"/>`).join('')}
      <circle cx="48" cy="46" r="8" fill="#E5A93C" ${st(3)}/><rect x="78" y="44" width="28" height="28" rx="6" fill="${CREAM}" ${st()}/>
      <circle cx="86" cy="52" r="3" fill="${INK}"/><circle cx="98" cy="64" r="3" fill="${INK}"/><circle cx="92" cy="58" r="3" fill="${INK}"/>`,
    ressurreicao_celuloide: () => `<circle cx="60" cy="44" r="32" fill="${CHAR}" ${st()}/>
      ${[0, 1, 2, 3, 4].map((i) => `<circle cx="${60 + 18 * Math.cos(i * 1.2566)}" cy="${44 + 18 * Math.sin(i * 1.2566)}" r="7" fill="${CREAM}" ${st(2)}/>`).join('')}
      <path d="M92,44 q20,10 12,36 q-30,-4 -60,8" fill="none" stroke="${INK}" stroke-width="8"/><circle cx="60" cy="44" r="5" fill="#3E7D4A"/>`,
    dinamite_acme: () => `${[34, 52, 70].map((x) => `<rect x="${x}" y="30" width="16" height="50" rx="4" fill="#C83E3B" ${st(3.5)}/>`).join('')}
      <rect x="30" y="48" width="60" height="10" fill="${CHAR}"/><path d="M60,30 q4,-14 16,-16" fill="none" ${st(3)}/>
      <path d="M76,14 l6,-6 l2,8 l8,-2 l-6,6 l6,6 l-8,0 z" fill="#E5A93C" ${st(2)}/>${eyes(60, 68, 0.6)}`,
    julgamento_solene: () => `<rect x="30" y="18" width="46" height="24" rx="6" fill="#8B5E3C" ${st()}/>
      <path d="M53,42 l20,36" stroke="${INK}" stroke-width="10" stroke-linecap="round"/><path d="M53,42 l20,36" stroke="#C69A6D" stroke-width="5" stroke-linecap="round"/>
      <rect x="20" y="74" width="40" height="10" rx="3" fill="#6E4B33" ${st(3)}/>${eyes(53, 30, 0.7)}`,
    penalidade_maxima: () => `${[['#C83E3B', -18], ['#2F5D8A', -6], ['#3E7D4A', 6], ['#E5A93C', 18]].map(([c, r]) => `<rect x="48" y="18" width="26" height="40" rx="4" fill="${c}" ${st(3)} transform="rotate(${r} 61 70)"/>`).join('')}
      <text x="60" y="84" text-anchor="middle" font-family="Rye, Georgia, serif" font-size="24" fill="${CREAM}" stroke="${INK}" stroke-width="1.5">+4</text>`,
    parry_absoluto: () => `<path d="M60,8 l10,24 l26,2 l-20,16 l8,26 l-24,-14 l-24,14 l8,-26 l-20,-16 l26,-2 z" fill="#ff8fc8" ${st()}/>
      <path d="M40,46 a20,20 0 0 1 36,-10 M80,50 a20,20 0 0 1 -36,10" fill="none" ${st(3)}/>${eyes(60, 46, 0.7)}`,
    xeque_mate_diabo: () => `<path d="M34,30 l-10,-22 l24,14 M86,30 l10,-22 l-24,14" fill="#C83E3B" ${st(3.5)}/>
      <circle cx="60" cy="48" r="30" fill="#C83E3B" ${st()}/><path d="M44,62 q16,14 32,0 q-16,6 -32,0z" fill="${INK}"/>
      <path d="M40,38 l12,6 M80,38 l-12,6" ${st(3)}/>${eyes(60, 48, 0.85)}`
  };

  /** Emblema SVG (markup) de uma carta que não é peça. */
  function emblem(id) {
    const f = EMBLEMS[id];
    return `<svg viewBox="0 0 120 90" class="dart" aria-hidden="true"><g>${f ? f() : ''}</g></svg>`;
  }

  /** Paleta de uma peça: corpo creme (ou carvão para o adversário) e acento da cor Uno. */
  function palette(card, side = 'WHITE') {
    const dark = side === 'BLACK';
    return { F: dark ? CHAR : CREAM, A: HEX[card.color] || HEX.W, D: dark ? '#F4E7C5' : INK, cheek: dark ? null : '#F2A08B' };
  }

  /** Rig da peça para uma carta-monstro. */
  function monsterRig(card, side = 'WHITE', opts = {}) {
    return YC.PieceFactory.createPieceSVG(card.art || card.chess, side, { palette: palette(card, side), boil: !!opts.boil });
  }

  YC.DuelArt = { emblem, monsterRig, palette, HEX };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
