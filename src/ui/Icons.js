/* Icons.js — ícones SVG da interface em estilo "brinquedo de vinil" (docs/DIRECAO-DE-ARTE.md): grelha 24×24,
   contorno #0F141C de 2 px com pontas redondas, cor sólida e um reflexo branco em pílula no canto superior
   esquerdo. Substituem todos os emojis. YC.Icon('coin', { size: 22, fill: '#…' }) devolve o <svg> em texto. */
(function (YC) {
  'use strict';

  const INK = '#0F141C';
  const hl = (d, w = 1.7) => `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" opacity=".85"/>`;
  const p = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
  const line = (d, color = INK, w = 2) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;

  // cada ícone recebe a cor (f) e devolve o interior do <svg>
  const ICONS = {
    coin: (f = '#FFB703') => `<circle cx="12" cy="12" r="8.6" fill="${f}"/><circle cx="12" cy="12" r="5.4" fill="none" stroke="#B87D00" stroke-width="1.6"/>${hl('M7.6 9.2a5.4 5.4 0 0 1 3-2.6')}`,
    dust: (f = '#00B4D8') => `${p('M12 2.6l2.3 6.6 6.6 2.4-6.6 2.4L12 20.6l-2.3-6.6-6.6-2.4 6.6-2.4z', f)}${p('M19 2.8l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z', '#F8FAFC', ' stroke-width="1.4"')}${hl('M10.2 8.2l.8-2', 1.5)}`,
    soundOn: (f = '#F8FAFC') => `${p('M3.5 9.3h3.6l4.8-4.1v13.6l-4.8-4.1H3.5z', f)}${line('M15.2 9a4.2 4.2 0 0 1 0 6')}${line('M17.8 6.4a8 8 0 0 1 0 11.2')}`,
    soundOff: (f = '#F8FAFC') => `${p('M3.5 9.3h3.6l4.8-4.1v13.6l-4.8-4.1H3.5z', f)}${line('M15.5 9.5l5 5M20.5 9.5l-5 5', '#D90429', 2.4)}`,
    play: (f = '#F8FAFC') => p('M8 5.2v13.6L19 12z', f),
    fast: (f = '#FFB703') => `${p('M3.6 6v12l8-6z', f)}${p('M12 6v12l8.4-6z', f)}`,
    exit: (f = '#F8FAFC') => `${p('M4 4.4h9.4v15.2H4z', '#334158')}${line('M10.4 12h8.4M15.4 8.4l3.6 3.6-3.6 3.6', INK, 4)}${line('M10.4 12h8.4M15.4 8.4l3.6 3.6-3.6 3.6', f, 2)}`,
    swords: (f = '#CBD5E1') => `<g transform="rotate(45 12 12)">${p('M10.6 2.5h2.8v12.2h-2.8z', f)}${p('M8.2 14.7h7.6v2.2H8.2z', '#FFB703')}${p('M11 16.9h2v3.8h-2z', '#92400E')}</g><g transform="rotate(-45 12 12)">${p('M10.6 2.5h2.8v12.2h-2.8z', f)}${p('M8.2 14.7h7.6v2.2H8.2z', '#FFB703')}${p('M11 16.9h2v3.8h-2z', '#92400E')}</g>`,
    robot: (f = '#94A3B8') => `${line('M12 3.2v3')}<circle cx="12" cy="3" r="1.4" fill="#D90429"/>${p('M5 7.2h14a1.8 1.8 0 0 1 1.8 1.8v8.4a1.8 1.8 0 0 1-1.8 1.8H5a1.8 1.8 0 0 1-1.8-1.8V9A1.8 1.8 0 0 1 5 7.2z', f)}<circle cx="9" cy="12.4" r="1.7" fill="#00B4D8"/><circle cx="15" cy="12.4" r="1.7" fill="#00B4D8"/>${line('M9.5 16.2h5', INK, 1.6)}${hl('M5.4 9.8v2')}`,
    timer: (f = '#F8FAFC') => `<circle cx="12" cy="13" r="8" fill="${f}"/>${p('M10 2.5h4v2.2h-4z', '#FB8500')}${line('M12 13V8.8M12 13l3 2', INK, 2)}${hl('M7.6 10.4a5 5 0 0 1 2-2.2')}`,
    globe: (f = '#2EC4B6') => `<circle cx="12" cy="12" r="8.6" fill="${f}"/>${line('M3.6 12h16.8M12 3.4c-2.6 2.4-3.8 5.4-3.8 8.6s1.2 6.2 3.8 8.6c2.6-2.4 3.8-5.4 3.8-8.6S14.6 5.8 12 3.4z', INK, 1.6)}${hl('M6.8 7.4a7 7 0 0 1 2.4-2')}`,
    cards: (f = '#2563EB') => `${p('M4.2 6.4l7-2.1 3.9 12.9-7 2.1z', '#94A3B8')}${p('M9.5 4.5h7.6a1.4 1.4 0 0 1 1.4 1.4v12.4a1.4 1.4 0 0 1-1.4 1.4H9.5a1.4 1.4 0 0 1-1.4-1.4V5.9a1.4 1.4 0 0 1 1.4-1.4z', f)}${p('M13.3 8.6l1.2 2.4 2.4 1.2-2.4 1.2-1.2 2.4-1.2-2.4-2.4-1.2 2.4-1.2z', '#FFB703', ' stroke-width="1.2"')}${hl('M10.6 6.8v2.2', 1.5)}`,
    pin: (f = '#D90429') => `${p('M12 21.4s-6.6-6.1-6.6-11.1a6.6 6.6 0 0 1 13.2 0c0 5-6.6 11.1-6.6 11.1z', f)}<circle cx="12" cy="10.2" r="2.4" fill="#F8FAFC"/>${hl('M7.8 8.2a4.6 4.6 0 0 1 1.6-2.2')}`,
    star: (f = '#FFB703') => `${p('M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z', f)}${hl('M9.6 8.6l1.2-2.4', 1.5)}`,
    shield: (f = '#00B4D8') => `${p('M12 2.8l7.6 2.9v5.7c0 4.6-3.2 8.5-7.6 9.9-4.4-1.4-7.6-5.3-7.6-9.9V5.7z', f)}${hl('M7 7.4v3.4')}`,
    snow: (f = '#8FD3FF') => `${line('M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', INK, 3.6)}${line('M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9', f, 1.8)}`,
    potion: (f = '#2EC4B6') => `${p('M9.5 3.2h5v2h-.8v4l4.6 7.4a2.6 2.6 0 0 1-2.2 4H7.9a2.6 2.6 0 0 1-2.2-4l4.6-7.4v-4h-.8z', '#E2E8F0')}${p('M8 14h8l1.6 2.6a1.4 1.4 0 0 1-1.2 2.2H7.6a1.4 1.4 0 0 1-1.2-2.2z', f, ' stroke-width="1.4"')}${hl('M10.6 10.4l-1.6 2.6', 1.4)}`,
    crown: (f = '#FFB703') => `${p('M3.4 8.4l4.6 3.6L12 5.4l4 6.6 4.6-3.6-1.8 10.2H5.2z', f)}<circle cx="12" cy="13.6" r="1.6" fill="#D90429" stroke-width="1.2"/>${hl('M6.6 13.6l-.4 2', 1.4)}`,
    spear: (f = '#CBD5E1') => `${line('M4.5 19.5l9.7-9.7', INK, 4.4)}${line('M4.5 19.5l9.7-9.7', '#B87D00', 2.2)}${p('M13.4 7.4l6.1-3-3 6.1-1.5 1.5-3.1-3.1z', f)}`,
    arrow: (f = '#2EC4B6') => `${p('M3.5 9.2h9.5V5.4l7.5 6.6-7.5 6.6v-3.8H3.5z', f)}${hl('M5.4 11.2h4', 1.4)}`,
    trash: (f = '#D90429') => `${p('M6.6 8.4h10.8l-.9 11.4a1.6 1.6 0 0 1-1.6 1.5H9.1a1.6 1.6 0 0 1-1.6-1.5z', f)}${p('M4.6 5.6h14.8v2.8H4.6z', '#94A3B8')}${p('M9.4 3.2h5.2v2.4H9.4z', '#94A3B8')}${line('M10.3 11.4v6.6M13.7 11.4v6.6', INK, 1.8)}${hl('M8.6 10.6l.4 4', 1.4)}`,
    close: (f = '#F8FAFC') => `${line('M6.5 6.5l11 11M17.5 6.5l-11 11', INK, 4.4)}${line('M6.5 6.5l11 11M17.5 6.5l-11 11', f, 2.2)}`,
    no: (f = '#D90429') => `<circle cx="12" cy="12" r="8.4" fill="${f}"/>${line('M8.6 8.6l6.8 6.8M15.4 8.6l-6.8 6.8', '#F8FAFC', 2.2)}`,
    lock: (f = '#FFB703') => `${line('M8 10.4V7.6a4 4 0 0 1 8 0v2.8', INK, 3.6)}${line('M8 10.4V7.6a4 4 0 0 1 8 0v2.8', '#94A3B8', 1.6)}${p('M5.4 10.4h13.2v9.6H5.4z', f)}<circle cx="12" cy="14.6" r="1.5" fill="${INK}"/>${hl('M7.4 12.6v2.4')}`,
    chest: (f = '#D97706') => `${p('M4 10.4h16v9H4z', f)}${p('M4 10.4c0-3.4 3-5.6 8-5.6s8 2.2 8 5.6z', '#FB8500')}${p('M10.4 9.6h3.2v4.2h-3.2z', '#FFB703', ' stroke-width="1.5"')}${line('M4 13.4h6.4M13.6 13.4H20', INK, 1.4)}${hl('M6.6 8.4a5 5 0 0 1 2.6-1.8')}`,
    rook: (f = '#F1F5F9') => `${p('M6.2 4.4h2.6v2.2h1.9V4.4h2.6v2.2h1.9V4.4h2.6v5H6.2z', f)}${p('M7.6 9.4h8.8l1 7.6H6.6z', f)}${p('M5 17h14v3.2H5z', f)}${hl('M8.8 11.2v3.6')}`,
    trophy: (f = '#FFB703') => `${p('M7 3.6h10v4.6a5 5 0 0 1-10 0z', f)}${line('M7 5.4H4.4a2.6 2.6 0 0 0 2.6 3.8M17 5.4h2.6a2.6 2.6 0 0 1-2.6 3.8', INK, 1.8)}${p('M10.6 13h2.8v3.4h-2.8z', '#B87D00')}${p('M7.4 16.4h9.2v3.6H7.4z', '#334158')}${hl('M9 5.6v2.4')}`,
    cloud: (f = '#F8FAFC') => `${p('M7 18.6a4.2 4.2 0 0 1-.6-8.4A5.6 5.6 0 0 1 17.2 9a4.8 4.8 0 0 1 .6 9.6z', f)}${hl('M7.6 12.4a2.4 2.4 0 0 1 1.6-1.4')}`,
    sync: (f = '#00B4D8') => `${line('M18.6 9.4A7 7 0 0 0 6 7.6M5.4 14.6A7 7 0 0 0 18 16.4', INK, 4)}${line('M18.6 9.4A7 7 0 0 0 6 7.6M5.4 14.6A7 7 0 0 0 18 16.4', f, 2)}${p('M3.6 5.6l3.8 1 -1.4 3.6z', f, ' stroke-width="1.4"')}${p('M20.4 18.4l-3.8-1 1.4-3.6z', f, ' stroke-width="1.4"')}`,
    warn: (f = '#FB8500') => `${p('M12 3.4l9.4 16.6H2.6z', f)}${line('M12 9.4v5', INK, 2.4)}<circle cx="12" cy="17.2" r="1.3" fill="${INK}" stroke="none"/>`,
    flag: (f = '#D90429') => `${line('M6 21V3.6', INK, 2.6)}${p('M6.6 4.2h11.6l-2.6 4.2 2.6 4.2H6.6z', f)}${hl('M8.4 6.2h3.4', 1.4)}`,
    scroll: (f = '#E2E8F0') => `${p('M6 4h10.6a2.4 2.4 0 0 1 2.4 2.4V18a2 2 0 0 1-2 2H7.4A2.4 2.4 0 0 1 5 17.6V5a1 1 0 0 1 1-1z', f)}${line('M8.4 8.6h7.2M8.4 12h7.2M8.4 15.4h4.6', '#64748B', 1.6)}`,
    check: (f = '#2EC4B6') => `<circle cx="12" cy="12" r="8.4" fill="${f}"/>${line('M8 12.4l2.8 2.8L16.4 9.6', INK, 2.4)}`,
    bolt: (f = '#FFB703') => `${p('M13.6 2.6L5.2 13.4h5.6l-1.4 8 8.4-10.8h-5.6z', f)}${hl('M10.6 8.4l1.6-2', 1.4)}`,
    wings: (f = '#00B4D8') => `${p('M12 18c-1.6-4-4.8-6.6-9-7.4 2.2 3.4 2.6 6.6 9 7.4z', f)}${p('M12 18c1.6-4 4.8-6.6 9-7.4-2.2 3.4-2.6 6.6-9 7.4z', f)}${p('M12 18c-.8-3.2-.8-6.4 0-9.6.8 3.2.8 6.4 0 9.6z', '#F8FAFC', ' stroke-width="1.4"')}`,
    chevron: (f = '#94A3B8') => `${p('M5 15.4l7-7 7 7-2.6 2.6L12 13.6 7.6 18z', f)}`,
    gear: (f = '#94A3B8') => `${p('M10.4 2.8h3.2l.5 2.4a7.4 7.4 0 0 1 1.9 1.1l2.3-.8 1.6 2.8-1.8 1.6a7.4 7.4 0 0 1 0 2.2l1.8 1.6-1.6 2.8-2.3-.8a7.4 7.4 0 0 1-1.9 1.1l-.5 2.4h-3.2l-.5-2.4a7.4 7.4 0 0 1-1.9-1.1l-2.3.8-1.6-2.8 1.8-1.6a7.4 7.4 0 0 1 0-2.2L4.1 8.3l1.6-2.8 2.3.8a7.4 7.4 0 0 1 1.9-1.1z', f)}<circle cx="12" cy="12" r="2.8" fill="#F8FAFC"/>`,
    plus: (f = '#2EC4B6') => `<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.4" fill="${f}"/>${line('M12 7.6v8.8M7.6 12h8.8', INK, 2.6)}`,
    info: (f = '#00B4D8') => `<circle cx="12" cy="12" r="8.6" fill="${f}"/><circle cx="12" cy="7.8" r="1.4" fill="${INK}" stroke="none"/>${line('M12 11v6', INK, 2.6)}`,
    hand: (f = '#94A3B8') => `${p('M5 7.4h9.4a1.4 1.4 0 0 1 1.4 1.4v10.4a1.4 1.4 0 0 1-1.4 1.4H5a1.4 1.4 0 0 1-1.4-1.4V8.8A1.4 1.4 0 0 1 5 7.4z', f)}${p('M9.6 3.6h9.4a1.4 1.4 0 0 1 1.4 1.4v10.4a1.4 1.4 0 0 1-1.4 1.4h-2.6V8.8a2 2 0 0 0-2-2H8.2V5a1.4 1.4 0 0 1 1.4-1.4z', '#64748B')}`,
    // insígnias de raridade (dupla codificação): ● / ◆◆ / ✦✦✦ / coroa
    gemCommon: (f = '#64748B') => `<circle cx="12" cy="12" r="6.4" fill="${f}"/>${hl('M9.4 10a3 3 0 0 1 1.4-1.4', 1.4)}`,
    gemRare: (f = '#0284C7') => `${p('M7.4 4.6l4.2 7.4-4.2 7.4L3.2 12z', f)}${p('M16.6 4.6l4.2 7.4-4.2 7.4L12.4 12z', f)}`,
    gemEpic: (f = '#9333EA') => `${p('M12 2.4l2.2 7.4 7.4 2.2-7.4 2.2L12 21.6l-2.2-7.4L2.4 12l7.4-2.2z', f)}${hl('M10.6 8.4l.6-2', 1.4)}`
  };

  /** <svg> do ícone. opts: size (px), fill (cor principal), cls (classe extra), title (texto acessível). */
  YC.Icon = (name, { size = 22, fill, cls = '', title = '' } = {}) => {
    const draw = ICONS[name];
    if (!draw) return '';
    return `<svg class="ico ico-${name}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" width="${size}" height="${size}" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${title ? ` role="img" aria-label="${title}"` : ' aria-hidden="true"'}>${draw(fill)}</svg>`;
  };
  YC.Icon.names = Object.keys(ICONS);
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
