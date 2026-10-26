/* PieceArt.js — peças de xadrez cartoon modernas em SVG (viewBox 0 0 100 100):
   contorno #111 de 4,5 px, cel-shading (Brancas creme #FFF8E7 + sombra #D2E3FC; Pretas #2D1B4E + violeta #7B42F6),
   brilho, olhos que piscam e expressões trocadas por classes CSS no elemento da peça:
   .equipped (pupilas de estrela + sobrancelhas em V) · .frozen (olhos em espiral) · .checked (gota de suor)
   · .scared (boca em O). */
(function (YC) {
  'use strict';

  const INK = '#111111';
  const PAL = {
    w: { base: '#FFF8E7', shade: '#D2E3FC', cheek: '#FFB4C8', mouth: '#8A2B3B' },
    b: { base: '#2D1B4E', shade: '#7B42F6', cheek: '#E26DB4', mouth: '#FFD1E3' }
  };

  // Silhuetas: corpo, extras (desenhados antes/depois), posição dos olhos e da boca.
  const SHAPES = {
    p: {
      body: 'M27 86 C27 69 35 60 42 56 C34 51 30 43 30 35 C30 23 39 14 50 14 C61 14 70 23 70 35 C70 43 66 51 58 56 C65 60 73 69 73 86 Z',
      eyes: { y: 34, dx: 8.5, rx: 6, ry: 7.5 }, mouth: 46, cheekY: 42
    },
    r: {
      body: 'M25 86 L29 52 L24 49 L24 21 L35 21 L35 29 L44.5 29 L44.5 21 L55.5 21 L55.5 29 L65 29 L65 21 L76 21 L76 49 L71 52 L75 86 Z',
      over: '<path d="M30 63 H70 M31 74 H69" stroke="#111" stroke-width="2.5" stroke-linecap="round" opacity=".35" fill="none"/>',
      eyes: { y: 40, dx: 9.5, rx: 6.5, ry: 8 }, mouth: 52, cheekY: 48
    },
    n: {
      body: 'M30 86 C30 72 35 65 40 60 C33 59 22 57 19 48 C17 41 22 35 29 33 C33 25 41 16 52 13 L56 5 L62 13 C73 18 80 31 78 47 C77 60 71 71 73 86 Z',
      under: '<path d="M62 13 C70 16 78 22 81 32 L86 28 C84 40 84 50 80 58 L85 58 C81 66 76 72 73 76" fill="#FF7AA8" stroke="#111" stroke-width="4" stroke-linejoin="round"/>',
      over: '<ellipse cx="23" cy="45" rx="2.4" ry="3" fill="#111"/>',
      eyes: { y: 32, dx: 7, cx: 46, rx: 5.5, ry: 7 }, mouth: 52, mouthX: 32, cheekY: 42
    },
    b: {
      body: 'M28 86 C28 71 34 63 39 59 C31 52 29 41 34 32 C38 24 45 18 50 14 C55 18 62 24 66 32 C71 41 69 52 61 59 C66 63 72 71 72 86 Z',
      over: '<path d="M60 23 L49 38" stroke="#111" stroke-width="4" stroke-linecap="round"/><circle cx="50" cy="10" r="5.5" fill="#FCC934" stroke="#111" stroke-width="3.5"/>',
      eyes: { y: 43, dx: 8, rx: 5.8, ry: 7.2 }, mouth: 54, cheekY: 51
    },
    q: {
      body: 'M25 86 C27 72 35 64 40 59 C33 55 30 47 32 38 L68 38 C70 47 67 55 60 59 C65 64 73 72 75 86 Z',
      under: '<path d="M30 39 L33 15 L42 27 L50 9 L58 27 L67 15 L70 39 Z" fill="#FCC934" stroke="#111" stroke-width="4" stroke-linejoin="round"/>' +
        '<circle cx="33" cy="14" r="4" fill="#F538A0" stroke="#111" stroke-width="3"/><circle cx="50" cy="8" r="4.5" fill="#12B5CB" stroke="#111" stroke-width="3"/><circle cx="67" cy="14" r="4" fill="#F538A0" stroke="#111" stroke-width="3"/>',
      eyes: { y: 49, dx: 8.5, rx: 6, ry: 7.5, lashes: true }, mouth: 60, cheekY: 57
    },
    k: {
      body: 'M23 86 C25 71 33 63 38 59 C31 55 28 47 30 38 L70 38 C72 47 69 55 62 59 C67 63 75 71 77 86 Z',
      under: '<path d="M28 40 L30 19 L40 28 L50 17 L60 28 L70 19 L72 40 Z" fill="#FCC934" stroke="#111" stroke-width="4" stroke-linejoin="round"/>' +
        '<path d="M46 4 H54 V10 H60 V17 H54 V22 H46 V17 H40 V10 H46 Z" fill="#FCC934" stroke="#111" stroke-width="3.5" stroke-linejoin="round"/>',
      over: '<path d="M38 60 C42 56 47 57 50 59 C53 57 58 56 62 60 C58 64 53 63 50 61 C47 63 42 64 38 60 Z" fill="#6B3E26" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>',
      eyes: { y: 49, dx: 9, rx: 6.2, ry: 7.6 }, mouth: 66, cheekY: 56
    }
  };

  function star(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      d += `${i ? 'L' : 'M'}${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)} `;
    }
    return `${d}Z`;
  }

  function eyesSVG(e, color) {
    const cx = e.cx || 50, xs = [cx - e.dx, cx + e.dx], y = e.y;
    let normal = '', stars = '', spiral = '', brows = '', lashes = '';
    for (const x of xs) {
      normal += `<ellipse cx="${x}" cy="${y}" rx="${e.rx}" ry="${e.ry}" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`
        + `<g class="pupil"><circle cx="${x + 0.8}" cy="${y + 1}" r="${e.rx * 0.52}" fill="${INK}"/><circle cx="${x + 2}" cy="${y - 1.2}" r="${e.rx * 0.2}" fill="#fff"/></g>`;
      stars += `<path d="${star(x + 0.6, y + 0.6, e.rx * 0.78)}" fill="#FCC934" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;
      spiral += `<ellipse cx="${x}" cy="${y}" rx="${e.rx}" ry="${e.ry}" fill="#fff" stroke="${INK}" stroke-width="2.6"/>`
        + `<path d="M${x} ${y} m-0.5 0 a1.2 1.2 0 1 1 1.6 1 a2.6 2.6 0 1 1 -3.4 -2.4 a3.9 3.9 0 1 1 4.6 4.4" fill="none" stroke="#1A73E8" stroke-width="1.6" stroke-linecap="round"/>`;
      const s = x < cx ? 1 : -1;
      brows += `<path d="M${x - 6 * s} ${y - e.ry - 5} L${x + 4 * s} ${y - e.ry - 1}" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
      if (e.lashes) lashes += `<path d="M${x - 5 * s} ${y - e.ry + 1} l${-3 * s} -4 M${x - 2 * s} ${y - e.ry - 0.5} l${-1.5 * s} -4.5" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
    }
    return `<g class="eyes-wrap"><g class="eyes eyes-normal">${normal}${lashes}</g>`
      + `<g class="eyes-star">${stars}</g><g class="eyes-spiral">${spiral}</g><g class="brows">${brows}</g></g>`;
  }

  function faceSVG(s, color) {
    const pal = PAL[color], e = s.eyes, mx = s.mouthX || e.cx || 50, my = s.mouth;
    const cheek = `<ellipse cx="${(e.cx || 50) - e.dx - 4}" cy="${s.cheekY}" rx="4.5" ry="2.6" fill="${pal.cheek}" opacity=".75"/>`
      + `<ellipse cx="${(e.cx || 50) + e.dx + 4}" cy="${s.cheekY}" rx="4.5" ry="2.6" fill="${pal.cheek}" opacity=".75"/>`;
    const smile = `<path class="mouth-smile" d="M${mx - 5} ${my - 1} Q${mx} ${my + 4.5} ${mx + 5} ${my - 1}" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`;
    const oh = `<ellipse class="mouth-o" cx="${mx}" cy="${my + 1}" rx="3.4" ry="4.2" fill="${pal.mouth}" stroke="${INK}" stroke-width="2.4"/>`;
    const grit = `<path class="mouth-grit" d="M${mx - 6} ${my} H${mx + 6} M${mx - 3} ${my - 2.5} V${my + 2.5} M${mx + 1} ${my - 2.5} V${my + 2.5}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`;
    const sweat = `<path class="sweat" d="M${(e.cx || 50) + e.dx + 9} ${e.y - 10} c-3 5 -4 7 -4 9 a4 4 0 0 0 8 0 c0 -2 -1 -4 -4 -9 z" fill="#8FD3FF" stroke="${INK}" stroke-width="2"/>`;
    return `${cheek}${eyesSVG(e, color)}${smile}${oh}${grit}${sweat}`;
  }

  const cache = {};
  function svg(type, color) {
    const key = type + color;
    if (cache[key]) return cache[key];
    const s = SHAPES[type], pal = PAL[color];
    const shadeClip = color === 'w' ? 'url(#yc-cel-right)' : 'url(#yc-cel-left)';
    const shadeOpacity = color === 'w' ? 1 : 0.55;
    const out = `<svg class="piece-svg" viewBox="0 0 100 100" aria-hidden="true">`
      + `<ellipse cx="50" cy="91" rx="30" ry="5.5" fill="rgba(17,17,17,.28)"/>`
      + (s.under || '')
      + `<path d="${s.body}" fill="${pal.base}"/>`
      + `<path d="${s.body}" fill="${pal.shade}" opacity="${shadeOpacity}" clip-path="${shadeClip}"/>`
      + `<path d="${s.body}" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linejoin="round"/>`
      + `<ellipse cx="${color === 'w' ? 38 : 40}" cy="${(s.eyes.y || 40) - 14}" rx="7" ry="4" fill="#fff" opacity=".45" transform="rotate(-25 38 ${(s.eyes.y || 40) - 14})"/>`
      + (s.over || '')
      + faceSVG(s, color)
      + `</svg>`;
    cache[key] = out;
    return out;
  }

  /** Definições partilhadas (clip-paths do cel-shading). Injetar uma vez no documento. */
  function defs() {
    return '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
      + '<clipPath id="yc-cel-right" clipPathUnits="userSpaceOnUse"><path d="M58 0 C64 30 66 60 60 100 H100 V0 Z"/></clipPath>'
      + '<clipPath id="yc-cel-left" clipPathUnits="userSpaceOnUse"><path d="M0 0 H40 C34 30 32 60 38 100 H0 Z"/></clipPath>'
      + '</defs></svg>';
  }

  YC.PieceArt = { svg, defs, SHAPES, PAL, star };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
