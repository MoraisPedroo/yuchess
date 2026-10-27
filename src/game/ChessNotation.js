/* ChessNotation.js — contagem perft (testes das regras) e notação dos lances para o histórico
   (acrescenta ao YC.Chess; separado do ChessRules para os ficheiros ficarem pequenos). */
(function (YC) {
  'use strict';

  const C = YC.Chess;

  function perft(pos, depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of C.legalMoves(pos, pos.turn)) {
      const u = C.makeMove(pos, m);
      n += depth === 1 ? 1 : perft(pos, depth - 1);
      C.unmakeMove(pos, u);
    }
    return n;
  }

  /** Notação legível (estilo SAN simplificado) para o registo. */
  function moveLabel(m) {
    const P = { p: '', n: 'C', b: 'B', r: 'T', q: 'D', k: 'R' }[m.piece.origType === m.piece.type ? m.piece.type : m.piece.type];
    if (m.flag === 'k') return m.to > m.from ? 'O-O' : 'O-O-O';
    const cap = m.captured ? 'x' : '-';
    return `${P}${C.sqName(m.from)}${cap}${C.sqName(m.to)}${m.promo ? '=' + { q: 'D', r: 'T', b: 'B', n: 'C' }[m.promo] : ''}${m.flag === 'r' ? ' (lança)' : ''}`;
  }

  Object.assign(C, { perft, moveLabel });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
