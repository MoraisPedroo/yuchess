/* CardArt.js — ilustrações cartoon das 31 cartas em SVG (viewBox 0 0 100 100), desenhadas por código.
   Cada ícone usa as cores da carta (theme.primary / theme.secondary) com contorno grosso #111. */
(function (YC) {
  'use strict';

  const K = '#111';
  const o = (d, f, w = 4) => `<path d="${d}" fill="${f}" stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const c = (x, y, r, f, w = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${K}" stroke-width="${w}"/>`;
  const e = (x, y, rx, ry, f, w = 4) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${K}" stroke-width="${w}"/>`;
  const l = (d, col, w = 7) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const shine = (x, y, rx, ry, rot = -30) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55" transform="rotate(${rot} ${x} ${y})"/>`;
  const spark = (x, y, s, f = '#fff') => `<path d="M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s}Z" fill="${f}" stroke="${K}" stroke-width="2"/>`;
  const txt = (x, y, s, t, f = '#fff') => `<text x="${x}" y="${y}" font-family="Titan One, sans-serif" font-weight="400" font-size="${s}" text-anchor="middle" fill="${f}" stroke="${K}" stroke-width="2.5" paint-order="stroke">${t}</text>`;
  const coin = (x, y, r) => c(x, y, r, '#FCC934', 3.5) + `<circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="none" stroke="#C99A0E" stroke-width="2.5"/>` + shine(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.18);
  const spring = (x, y1, y2, w, col, n = 4) => {
    let d = `M${x - w} ${y1}`;
    const step = (y2 - y1) / n;
    for (let i = 0; i < n; i++) d += ` L${x + w} ${y1 + step * (i + 0.5)} L${x - w} ${y1 + step * (i + 1)}`;
    return l(d, col, 5);
  };
  const bolt = (x, y, s, f) => o(`M${x + 2 * s} ${y - 10 * s} L${x - 6 * s} ${y + 2 * s} L${x} ${y + 2 * s} L${x - 3 * s} ${y + 11 * s} L${x + 7 * s} ${y - 2 * s} L${x + 1 * s} ${y - 2 * s} Z`, f, 3.5);
  const cloud = (x, y, s, f) => o(`M${x - 14 * s} ${y + 6 * s} a8 8 0 0 1 2 -14 a10 10 0 0 1 18 -4 a9 9 0 0 1 14 8 a7 7 0 0 1 -2 10 Z`, f, 3.5);

  const ICONS = {
    GREED_SWORD: (a, b) => `<g transform="rotate(-38 50 52)">${o('M50 6 L57 16 L57 62 L43 62 L43 16 Z', '#EAF2FF')}${l('M50 18 V56', '#B9C8E6', 2)}${o('M30 60 H70 a4 4 0 0 1 0 9 H30 a4 4 0 0 1 0 -9 Z', b)}${o('M45 69 H55 V86 H45 Z', a)}${c(50, 91, 6, b, 3.5)}${shine(46, 30, 2, 9, 0)}</g>${coin(77, 24, 11)}${txt(77, 29, 13, '$', '#C99A0E')}${spark(20, 22, 6, b)}`,
    WIND_BOOTS: (a) => `${l('M6 40 H24 M2 54 H22 M8 68 H24', '#fff', 4)}${o('M34 18 H60 V56 C72 58 84 63 86 74 V80 H30 Z', a)}${o('M28 80 H88 V88 H28 Z', '#2D1B4E')}${o('M34 30 C22 24 18 30 22 36 C14 36 14 44 22 46 C16 50 20 56 30 52', '#fff', 3.5)}${l('M40 30 H56 M40 40 H56', '#fff', 3)}${shine(46, 22, 7, 3, 0)}`,
    SPRING_COIL: (a, b) => `${spring(50, 30, 82, 18, a, 5)}${o('M26 82 H74 V90 H26 Z', '#575B5F')}${o('M30 22 H70 V30 H30 Z', b)}${l('M24 14 Q50 -2 76 14', '#fff', 3)}${spark(84, 30, 6, b)}${spark(16, 34, 5, '#fff')}`,
    ICE_CROWN: (a, b) => `${o('M18 62 L22 26 L36 42 L50 18 L64 42 L78 26 L82 62 Z', b)}${o('M18 62 H82 V72 H18 Z', a)}${o('M24 72 L28 88 L32 72 M44 72 L48 92 L52 72 M66 72 L70 86 L74 72', '#DFF3FF', 3)}${c(50, 18, 5, a, 3)}${c(22, 26, 4, a, 3)}${c(78, 26, 4, a, 3)}${l('M50 46 V58 M44 52 H56 M45.5 47.5 L54.5 56.5 M54.5 47.5 L45.5 56.5', a, 2.5)}${shine(34, 40, 5, 2.5)}`,
    ROYAL_SCEPTER: (a, b) => `<g transform="rotate(30 50 50)">${o('M46 34 H54 V92 H46 Z', a)}${o('M40 30 H60 V38 H40 Z', a)}${c(50, 20, 13, b)}${shine(45, 15, 4, 2.5)}${o('M38 10 L42 0 L50 6 L58 0 L62 10 Z', a, 3)}</g>${spark(18, 28, 7, a)}${spark(82, 70, 6, '#fff')}`,
    SPIKE_ARMOR: (a, b) => `${o('M50 6 L56 18 L66 8 L68 22 L82 18 L78 32 L92 36 L80 46 L88 58 L74 60 L74 90 H26 V60 L12 58 L20 46 L8 36 L22 32 L18 18 L32 22 L34 8 L44 18 Z', '#FDE7A5', 3)}${o('M28 26 C40 32 60 32 72 26 L74 88 H26 Z', a)}${l('M50 34 V86 M30 52 H70 M32 70 H68', b, 3)}${c(40, 44, 3, '#fff', 2)}${c(60, 44, 3, '#fff', 2)}${shine(36, 34, 6, 3)}`,
    SPRING_SPEAR: (a, b) => `<g transform="rotate(-40 50 50)">${o('M50 2 L62 22 L38 22 Z', a)}${shine(47, 13, 2, 5, 0)}${spring(50, 24, 70, 8, b, 5)}${o('M44 70 H56 V96 H44 Z', '#6B3E26')}</g>${spark(80, 20, 7, '#FCC934')}${l('M14 72 l10 -4 M10 84 l12 -6', '#fff', 3)}`,
    MAGNET_CAPE: (a, b) => `${o('M30 14 H70 L88 88 C70 80 30 80 12 88 Z', a)}${l('M40 26 L30 80 M60 26 L70 80', '#fff', 2)}${o('M36 40 V60 a14 14 0 0 0 28 0 V40 H54 V60 a4 4 0 0 1 -8 0 V40 Z', b, 3.5)}${o('M36 40 H46 V46 H36 Z M54 40 H64 V46 H54 Z', '#EAF2FF', 3)}${l('M28 34 l-8 -6 M72 34 l8 -6', '#FCC934', 3)}`,
    GRAVITY_PIT: (a, b) => `${e(50, 62, 40, 22, '#1E1240')}${e(50, 62, 30, 15, a, 3)}${e(50, 62, 19, 9, b, 3)}${e(50, 62, 8, 4, '#120B26', 3)}${o('M22 30 L30 26 L32 34 Z', '#FCC934', 3)}${c(70, 24, 5, '#fff', 3)}${o('M44 14 h10 v8 h-10 Z', b, 3)}${l('M26 44 q-4 -10 2 -18 M74 44 q4 -10 -2 -18', '#fff', 2.5)}`,
    ELECTRIC_CAGE: (a, b) => `${o('M18 86 V44 Q18 10 50 10 Q82 10 82 44 V86 Z', 'rgba(255,255,255,.18)')}${l('M30 86 V30 M42 86 V16 M58 86 V16 M70 86 V30', a, 4)}${o('M12 82 H88 V92 H12 Z', a)}${o('M44 4 H56 V12 H44 Z', a, 3)}${bolt(50, 54, 2.4, b)}${spark(86, 22, 6, '#FCC934')}`,
    HEAVY_ANVIL: (a, b) => `${l('M22 10 V22 M38 6 V18 M62 6 V18 M78 10 V22', '#fff', 3)}${o('M10 30 H76 C76 40 86 42 92 44 C84 50 74 50 68 52 C64 58 64 64 70 70 H76 V84 H24 V70 H30 C36 64 36 58 30 52 C22 50 12 44 10 30 Z', '#3A3F47')}${l('M18 36 H62', '#7A808C', 3)}${txt(50, 80, 13, '100T', b)}`,
    BUBBLEGUM_SWAMP: (a, b) => `${o('M8 74 C8 60 26 56 38 60 C46 50 66 50 72 60 C84 56 94 64 92 76 C92 86 76 88 50 88 C24 88 8 86 8 74 Z', a)}${c(34, 42, 12, a)}${shine(30, 37, 4, 2.5)}${c(64, 30, 9, b, 3.5)}${c(78, 46, 6, a, 3)}${shine(24, 70, 8, 3, 0)}${l('M58 72 q4 -6 10 0', '#fff', 2.5)}`,
    EJECT_PAD: (a, b) => `${o('M50 6 L66 24 H56 V40 H44 V24 H34 Z', b)}${e(50, 60, 38, 10, a)}${e(50, 58, 30, 6, '#FFD6B0', 2.5)}${spring(30, 66, 88, 5, '#575B5F', 3)}${spring(70, 66, 88, 5, '#575B5F', 3)}${o('M14 88 H86 V94 H14 Z', '#2D1B4E', 3)}`,
    SHRINK_RAY: (a, b) => `${o('M14 44 H52 C60 44 64 50 64 56 C64 62 60 66 52 66 H34 L28 84 H18 L22 66 H14 Z', a)}${e(66, 55, 7, 14, b)}${c(30, 54, 4, '#FCC934', 2.5)}${l('M76 44 l10 -6 M78 55 h12 M76 66 l10 6', b, 3)}${shine(30, 48, 8, 2, 0)}${spark(88, 20, 6, '#fff')}`,
    WORMHOLE: (a, b) => `${e(50, 50, 42, 34, '#1E1240')}${e(50, 50, 34, 26, a, 3)}${e(50, 50, 25, 18, b, 3)}${e(50, 50, 15, 10, a, 3)}${e(50, 50, 6, 4, '#fff', 2.5)}${spark(14, 16, 6, '#FCC934')}${spark(86, 82, 7, '#fff')}${l('M18 72 Q8 50 22 30', '#fff', 2.5)}`,
    INK_MINE: (a) => `${o('M10 74 C2 66 14 60 20 66 C22 56 34 62 30 70 M70 74 C80 64 92 72 86 80 C94 84 86 94 78 88', a, 3)}${c(48, 56, 26, '#1E1240')}${shine(38, 46, 7, 4)}${o('M60 32 Q66 16 78 14', 'none', 4)}${spark(80, 12, 7, '#FCC934')}${o('M56 30 H66 V38 H56 Z', '#575B5F', 3)}${c(18, 86, 5, a, 3)}`,
    CRYSTAL_SHIELD: (a, b) => `${o('M50 6 L86 18 V48 C86 70 70 86 50 94 C30 86 14 70 14 48 V18 Z', b)}${o('M50 14 L78 24 V48 C78 64 66 78 50 85 C34 78 22 64 22 48 V24 Z', a, 3)}${o('M50 14 V85 M22 48 H78 M28 26 L72 70 M72 26 L28 70', 'none', 1.8)}${shine(36, 32, 8, 4)}${spark(84, 80, 6, '#fff')}`,
    RUBBER_MIRROR: (a, b) => `${o('M44 70 H56 L58 94 H42 Z', a)}${e(50, 38, 30, 34, a)}${e(50, 38, 22, 26, b, 3)}${o('M38 22 Q44 16 52 18', 'none', 3)}${shine(40, 28, 6, 3)}${spark(78, 12, 7, '#fff')}${spark(18, 64, 5, '#FCC934')}`,
    SMOKE_BOMB: (a, b) => `${cloud(28, 38, 1.1, b)}${cloud(74, 30, 0.9, b)}${cloud(80, 66, 0.8, '#E7DFF8')}${c(46, 62, 24, a)}${shine(38, 54, 6, 3.5)}${o('M58 42 Q62 30 70 26', 'none', 4)}${spark(72, 24, 6, '#FCC934')}`,
    DUMMY_DOLL: (a, b) => `${c(50, 26, 15, a)}${o('M30 44 C30 40 70 40 70 44 L76 86 C76 92 24 92 24 86 Z', a)}${c(50, 66, 13, b, 3)}${c(50, 66, 7, '#D93025', 3)}${l('M43 21 l5 5 M48 21 l-5 5 M53 21 l5 5 M58 21 l-5 5', '#111', 1.5)}${o('M44 32 Q50 36 56 32', 'none', 2.5)}${o('M70 50 C82 46 88 54 84 60', a, 3.5)}${shine(42, 18, 4, 2.5)}`,
    ROYAL_SIREN: (a, b) => `${l('M12 30 L24 38 M88 30 L76 38 M50 4 V14 M18 60 H28 M72 60 H82', a, 3)}${o('M28 70 V48 C28 30 72 30 72 48 V70 Z', a)}${o('M22 70 H78 V82 H22 Z', b)}${shine(40, 44, 5, 8, -20)}${o('M38 30 L40 18 L46 24 L50 14 L54 24 L60 18 L62 30 Z', '#FCC934', 3)}`,
    PIGGY_BANK: (a, b) => `${coin(56, 16, 10)}${o('M18 56 C18 36 40 30 56 32 C74 32 86 42 86 58 C86 70 78 78 70 80 V90 H60 V82 H40 V90 H30 V80 C22 76 18 66 18 56 Z', a)}${o('M86 52 C94 52 94 62 86 62', a, 3.5)}${o('M30 36 L28 24 L40 32', a, 3.5)}${c(40, 50, 3, '#111', 0)}${o('M48 36 H64', 'none', 4)}${shine(36, 44, 8, 4)}${e(84, 57, 4, 3, '#F7A8C4', 2.5)}`,
    TWIN_BUBBLES: (a, b) => `${c(36, 56, 26, a)}${c(68, 36, 20, b)}${shine(26, 44, 8, 4.5)}${shine(62, 26, 6, 3.5)}${spark(84, 76, 7, '#fff')}${c(76, 70, 4, '#fff', 2.5)}`,
    JUDGE_HAMMER: (a, b) => `<g transform="rotate(-30 50 50)">${o('M46 46 H54 V94 H46 Z', '#8B5A2B')}${o('M22 22 H78 V46 H22 Z', a)}${o('M30 22 V46 M70 22 V46', b, 3)}${shine(40, 28, 10, 2.5, 0)}</g>${txt(80, 86, 22, '!', b)}${l('M10 80 l12 -4 M14 92 l10 -8', '#fff', 3)}`,
    GIANT_SCISSORS: (a) => `${o('M50 50 L88 10 L94 16 Z', '#E5E7EB', 3.5)}${o('M50 50 L88 90 L94 84 Z', '#E5E7EB', 3.5)}${c(28, 30, 14, a)}${c(28, 70, 14, a)}${c(28, 30, 6, '#fff', 3)}${c(28, 70, 6, '#fff', 3)}${l('M38 38 L52 50 L38 62', a, 5)}${c(50, 50, 4, '#FCC934', 3)}`,
    THIEF_MAGNET: (a, b) => `${o('M18 14 V50 a32 32 0 0 0 64 0 V14 H62 V50 a12 12 0 0 1 -24 0 V14 Z', a)}${o('M18 14 H38 V26 H18 Z M62 14 H82 V26 H62 Z', b, 3.5)}${l('M8 60 l-6 6 M92 60 l6 6 M50 94 v4', '#FCC934', 3)}${shine(26, 48, 3, 8, 0)}${spark(50, 34, 7, '#FCC934')}`,
    GOLDEN_WHISTLE: (a, b) => `${o('M16 44 H58 C76 44 86 54 86 66 C86 80 74 88 62 88 C48 88 40 78 40 66 V58 H16 Z', a)}${c(62, 66, 9, b, 3)}${o('M16 40 H34 V58 H16 Z', a, 3.5)}${l('M58 26 Q66 18 74 26 M66 14 Q78 4 90 16', '#fff', 3)}${shine(28, 50, 6, 2, 0)}`,
    EMP_BLAST: (a, b) => `${c(50, 50, 42, 'none', 3)}${c(50, 50, 42, a, 0)}<circle cx="50" cy="50" r="42" fill="none" stroke="#111" stroke-width="4"/>${c(50, 50, 30, b, 3.5)}${c(50, 50, 18, '#fff', 3)}${bolt(50, 50, 2.6, '#FCC934')}`,
    JACKHAMMER: (a, b) => `${o('M24 10 H76 V22 H24 Z', '#575B5F')}${o('M30 22 H70 V58 H30 Z', a)}${o('M44 58 H56 V78 H44 Z', '#C7CCD6')}${o('M44 78 L50 92 L56 78 Z', '#C7CCD6', 3.5)}${l('M30 34 H70', b, 3)}${l('M18 88 l-8 4 M82 88 l8 4 M30 94 l-6 -2 M70 94 l6 -2', '#FCC934', 3)}${shine(40, 30, 6, 2.5, 0)}`,
    REWIND_CLOCK: (a, b) => `${c(50, 52, 36, b)}${c(50, 52, 28, '#FFF8E7', 3)}${l('M50 52 V34 M50 52 L62 58', '#111', 2)}${c(50, 52, 3, a, 2)}${o('M14 30 A40 40 0 0 1 34 14', 'none', 5)}${o('M8 24 L16 36 L24 22 Z', a, 3)}${o('M34 8 H66 V16 H34 Z', b, 3)}`,
    BOXING_GLOVE: (a, b) => `${spring(18, 30, 80, 8, b, 4)}${o('M30 30 C30 18 46 14 62 16 C80 18 90 30 88 50 C86 70 72 80 54 78 C42 78 34 72 32 64 Z', a)}${o('M30 56 H44 V80 H30 Z', '#FFF8E7', 3.5)}${o('M58 30 C66 34 66 44 58 48', 'none', 3)}${shine(52, 26, 10, 4)}`
  };

  /** SVG completo de uma carta (usado na arte da carta e nas medalhas das peças). */
  function svg(card, cls = 'card-icon') {
    const t = card.theme, draw = ICONS[t.icon];
    return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true">${draw ? draw(t.primary, t.secondary) : ''}</svg>`;
  }

  YC.CardArt = { svg, ICONS };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
