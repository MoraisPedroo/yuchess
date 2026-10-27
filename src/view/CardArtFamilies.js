/* CardArtFamilies.js — emblema de reserva para as cartas da expansão que ainda não têm desenho próprio
   (nem imagem gerada em assets/items/): um objeto de vinil por família, nas cores da carta.
   Gelo (cristal), Oficina (chave e roda dentada), Circo (tenda), Laboratório (frasco), Tribunal (martelo),
   Sucata (âncora) e Polícia (crachá). Usado por CardArt.svg quando o ícone não existe. */
(function (YC) {
  'use strict';

  const K = '#0F141C';
  const o = (d, f, w = 4) => `<path d="${d}" fill="${f}" stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const c = (x, y, r, f, w = 4) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${K}" stroke-width="${w}"/>`;
  const l = (d, col, w = 6) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 5}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`;
  const shine = (x, y, rx, ry) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55" transform="rotate(-30 ${x} ${y})"/>`;

  const FAMILY = {
    gelo: (a, b) => `${o('M50 8 L76 26 L76 70 L50 90 L24 70 L24 26 Z', b)}${o('M50 8 L76 26 L50 44 L24 26 Z', '#F8FAFC')}${l('M50 44 V90', K, 2)}`
      + `${l('M38 60 L62 60 M44 50 L56 70 M56 50 L44 70', a, 4)}${shine(36, 30, 7, 3)}`,
    oficina: (a, b) => `${c(60, 58, 22, b)}${c(60, 58, 8, '#F8FAFC')}`
      + [0, 45, 90, 135, 180, 225, 270, 315].map((d) => `<rect x="56" y="30" width="8" height="10" rx="2" fill="${b}" stroke="${K}" stroke-width="3" transform="rotate(${d} 60 58)"/>`).join('')
      + `<g transform="rotate(-45 36 40)">${o('M30 14 H42 V58 H30 Z', a)}${o('M24 8 a12 12 0 1 0 24 0 L42 14 H30 Z', a)}</g>${shine(32, 24, 5, 2.5)}`,
    circo: (a, b) => `${o('M14 84 L50 18 L86 84 Z', b)}${o('M50 18 L38 84 H62 Z', a)}${o('M50 18 L22 84 H30 Z', a)}${o('M50 18 L70 84 H78 Z', a)}`
      + `${o('M48 6 L60 12 L48 16 Z', a, 3)}${l('M48 6 V20', K, 2)}${o('M42 84 a8 10 0 0 1 16 0 Z', '#0F141C', 3)}`,
    lab: (a, b) => `${o('M40 10 H60 V36 L82 80 a8 8 0 0 1 -7 10 H25 a8 8 0 0 1 -7 -10 L40 36 Z', '#F8FAFC')}${o('M30 62 H70 L80 82 a6 6 0 0 1 -5 6 H25 a6 6 0 0 1 -5 -6 Z', a)}`
      + `${c(44, 74, 4, b, 2.5)}${c(58, 68, 3, b, 2.5)}${c(54, 80, 2.5, b, 2)}${o('M36 6 H64 V14 H36 Z', b)}${shine(46, 30, 4, 10)}`,
    tribunal: (a, b) => `<g transform="rotate(-35 50 50)">${o('M28 22 H72 V46 H28 Z', a)}${o('M22 18 H34 V50 H22 Z', b)}${o('M66 18 H78 V50 H66 Z', b)}${o('M46 46 H54 V92 H46 Z', '#B87D00')}</g>`
      + `${o('M14 86 H58 V94 H14 Z', b)}${shine(34, 26, 6, 3)}`,
    sucata: (a, b) => `${c(50, 18, 9, 'none', 4)}${o('M46 26 H54 V80 H46 Z', a)}${o('M32 36 H68 V44 H32 Z', a)}`
      + `${l('M18 58 Q22 86 50 88 Q78 86 82 58', a, 7)}${o('M12 60 L20 50 L26 62 Z', a, 3)}${o('M88 60 L80 50 L74 62 Z', a, 3)}${shine(48, 34, 2, 6)}`,
    policia: (a, b) => `${o('M50 8 L60 30 L84 32 L66 48 L72 72 L50 60 L28 72 L34 48 L16 32 L40 30 Z', a)}${c(50, 42, 12, b)}`
      + `${o('M30 70 L50 92 L70 70 Z', b)}${shine(42, 24, 5, 2.5)}`
  };
  const KIND = { EQUIP: 'oficina', GRID: 'circo', REACTIVE: 'policia', COUNTER: 'tribunal', QUICK: 'lab' };

  YC.CardArtFallback = (card) => {
    const draw = FAMILY[card.family] || FAMILY[KIND[card.kind]];
    return draw ? draw(card.theme.primary, card.theme.secondary) : '';
  };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
