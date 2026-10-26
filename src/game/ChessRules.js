/* ChessRules.js — regras completas de xadrez (jogadas legais, xeque, xeque-mate, afogamento, roque,
   en passant, promoção, empates) com os modificadores das cartas de Equipamento:
   Botas (peão avança 2), Mola (Torre/Bispo saltam 1 peça), Cetro (peão anda como Rei),
   Capa (peões inimigos não a capturam), Lança (captura à distância sem sair da casa) e congelamento.
   Validado com contagens "perft" conhecidas (tools/test-chess-rules.js). Não toca no DOM. */
(function (YC) {
  'use strict';

  const FILES = 'abcdefgh';
  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  const sqName = (i) => `${FILES[i & 7]}${8 - (i >> 3)}`;
  const sqIndex = (s) => (8 - Number(s[1])) * 8 + FILES.indexOf(s[0]);
  const rc = (i) => [i >> 3, i & 7];
  const at = (r, c) => (r >= 0 && r < 8 && c >= 0 && c < 8 ? r * 8 + c : -1);
  const other = (c) => (c === 'w' ? 'b' : 'w');
  const has = (p, cardId) => !!p && p.equips.length > 0 && p.equips.includes(cardId);
  const frozen = (p, turn) => turn != null && p.frozenUntil > turn;
  const morphed = (p, turn) => turn != null && p.morphUntil > turn;

  let idSeq = 0;
  function makePiece(color, type, id) {
    return { id: id || `${color}${type}${++idSeq}`, color, type, origType: type, shield: false, equips: [], frozenUntil: 0, morphUntil: 0, lanceUsed: false, moved: false };
  }

  function emptyPosition() {
    return { board: new Array(64).fill(null), turn: 'w', ep: -1, half: 0, full: 1 };
  }

  const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  /** Carrega uma FEN (direitos de roque convertidos em flags "moved" das peças). */
  function fromFEN(fen = START) {
    const [place, turn, castle = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
    const pos = emptyPosition();
    let r = 0, c = 0;
    for (const ch of place) {
      if (ch === '/') { r++; c = 0; continue; }
      if (/\d/.test(ch)) { c += Number(ch); continue; }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      const p = makePiece(color, ch.toLowerCase(), `${color}_${ch.toLowerCase()}_${FILES[c]}${8 - r}`);
      p.moved = true;
      pos.board[r * 8 + c] = p;
      c++;
    }
    const k = (sq, color) => { const p = pos.board[sq]; if (p && p.color === color) p.moved = false; };
    if (castle.includes('K')) { k(sqIndex('e1'), 'w'); k(sqIndex('h1'), 'w'); }
    if (castle.includes('Q')) { k(sqIndex('e1'), 'w'); k(sqIndex('a1'), 'w'); }
    if (castle.includes('k')) { k(sqIndex('e8'), 'b'); k(sqIndex('h8'), 'b'); }
    if (castle.includes('q')) { k(sqIndex('e8'), 'b'); k(sqIndex('a8'), 'b'); }
    for (let i = 0; i < 64; i++) {
      const p = pos.board[i];
      if (p && p.type === 'p' && ((p.color === 'w' && i >> 3 === 6) || (p.color === 'b' && i >> 3 === 1))) p.moved = false;
    }
    pos.turn = turn === 'b' ? 'b' : 'w';
    pos.ep = ep === '-' ? -1 : sqIndex(ep);
    pos.half = Number(half) || 0;
    pos.full = Number(full) || 1;
    return pos;
  }

  function kingSquare(pos, color) {
    for (let i = 0; i < 64; i++) { const p = pos.board[i]; if (p && p.type === 'k' && p.color === color) return i; }
    return -1;
  }

  /** A peça em `from` ataca a casa `to`? (sem Lança; inclui Cetro). `noJump`: a Mola não conta
      (o Rei nunca é atacado por saltos — senão a Mola dava xeques que não se podiam tapar). */
  function attacks(pos, from, to, noJump) {
    const p = pos.board[from];
    const [r0, c0] = rc(from), [r1, c1] = rc(to);
    const dr = r1 - r0, dc = c1 - c0, ar = Math.abs(dr), ac = Math.abs(dc);
    if (!dr && !dc) return false;
    if (p.type === 'p' && !has(p, 'eq_cetro_usurpador')) return dr === (p.color === 'w' ? -1 : 1) && ac === 1;
    if (p.type === 'k' || (p.type === 'p' && has(p, 'eq_cetro_usurpador'))) return ar <= 1 && ac <= 1;
    if (p.type === 'n') return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
    const diag = ar === ac, ortho = !dr || !dc;
    if (p.type === 'b' && !diag) return false;
    if (p.type === 'r' && !ortho) return false;
    if (p.type === 'q' && !diag && !ortho) return false;
    const sr = Math.sign(dr), sc = Math.sign(dc), n = Math.max(ar, ac);
    let blockers = 0;
    for (let k = 1; k < n; k++) if (pos.board[(r0 + sr * k) * 8 + c0 + sc * k]) blockers++;
    const jump = !noJump && (p.type === 'r' || p.type === 'b') && has(p, 'eq_mola_canguru');
    return blockers === 0 || (jump && blockers === 1);
  }

  function isAttacked(pos, sq, byColor, noJump) {
    for (let i = 0; i < 64; i++) {
      const p = pos.board[i];
      if (p && p.color === byColor && attacks(pos, i, sq, noJump)) return true;
    }
    return false;
  }

  function attackersOf(pos, sq, byColor, noJump) {
    const out = [];
    for (let i = 0; i < 64; i++) { const p = pos.board[i]; if (p && p.color === byColor && attacks(pos, i, sq, noJump)) out.push(i); }
    return out;
  }

  function inCheck(pos, color) {
    const k = kingSquare(pos, color);
    return k >= 0 && isAttacked(pos, k, other(color), true);
  }

  /** Jogadas pseudolegais da peça em `from`. ctx = { turn } para respeitar congelamento/metamorfose. */
  function pieceMoves(pos, from, ctx = {}, out = []) {
    const p = pos.board[from];
    if (!p || frozen(p, ctx.turn)) return out;
    const [r, c] = rc(from);
    const color = p.color;
    const enemyAt = (i) => { const t = pos.board[i]; return t && t.color !== color && t.type !== 'k' ? t : null; };
    const canTake = (t) => !(has(t, 'eq_capa_magnetica') && p.type === 'p');
    const push = (to, flag, extra) => out.push({ from, to, flag, piece: p, captured: flag === 'c' || flag === 'jc' ? pos.board[to] : null, ...extra });
    const lastRow = color === 'w' ? 0 : 7;
    const promoAllowed = p.type === 'p' && !morphed(p, ctx.turn);
    const addPawnLike = (to, flag) => {
      if (promoAllowed && to >> 3 === lastRow) for (const pr of ['q', 'r', 'b', 'n']) push(to, flag, { promo: pr });
      else push(to, flag);
    };

    if (p.type === 'p' && !has(p, 'eq_cetro_usurpador')) {
      const d = color === 'w' ? -1 : 1;
      const one = at(r + d, c);
      if (one >= 0 && !pos.board[one]) {
        addPawnLike(one, 'n');
        const two = at(r + 2 * d, c);
        const startRow = color === 'w' ? 6 : 1;
        if (two >= 0 && !pos.board[two] && (r === startRow || has(p, 'eq_botas_vento'))) push(two, 'd');
      }
      for (const dc of [-1, 1]) {
        const t = at(r + d, c + dc);
        if (t < 0) continue;
        const e = enemyAt(t);
        if (e && canTake(e)) addPawnLike(t, 'c');
        else if (t === pos.ep && !pos.board[t]) {
          const v = pos.board[t - d * 8];
          if (v && v.type === 'p' && v.color !== color && canTake(v)) push(t, 'e', { captured: v });
        }
      }
    } else if (p.type === 'n') {
      for (const [dr, dc] of KNIGHT) {
        const t = at(r + dr, c + dc);
        if (t < 0) continue;
        const q = pos.board[t];
        if (!q) push(t, 'n'); else if (q.color !== color && q.type !== 'k' && canTake(q)) push(t, 'c');
      }
    } else if (p.type === 'k' || p.type === 'p') {
      for (const [dr, dc] of KING) {
        const t = at(r + dr, c + dc);
        if (t < 0) continue;
        const q = pos.board[t];
        if (!q) (p.type === 'p' ? addPawnLike(t, 'n') : push(t, 'n'));
        else if (q.color !== color && q.type !== 'k' && canTake(q)) (p.type === 'p' ? addPawnLike(t, 'c') : push(t, 'c'));
      }
      if (p.type === 'k' && !p.moved && !ctx.noCastle) castleMoves(pos, from, p, push);
    } else {
      const dirs = p.type === 'b' ? DIAG : p.type === 'r' ? ORTHO : DIAG.concat(ORTHO);
      const jumper = (p.type === 'r' || p.type === 'b') && has(p, 'eq_mola_canguru');
      for (const [dr, dc] of dirs) {
        let jumped = false;
        for (let k = 1; k < 8; k++) {
          const t = at(r + dr * k, c + dc * k);
          if (t < 0) break;
          const q = pos.board[t];
          if (!q) { push(t, jumped ? 'j' : 'n'); continue; }
          if (q.color !== color && q.type !== 'k') push(t, jumped ? 'jc' : 'c');
          if (jumper && !jumped) { jumped = true; continue; }
          break;
        }
      }
    }
    // Lança Telescópica: captura uma vez à distância (≤2 em linha) sem sair da casa.
    if (has(p, 'eq_lanca_telescopica') && !p.lanceUsed) {
      for (const [dr, dc] of KING) {
        for (let k = 1; k <= 2; k++) {
          const t = at(r + dr * k, c + dc * k);
          if (t < 0) break;
          const q = pos.board[t];
          if (q) { if (q.color !== color && q.type !== 'k' && canTake(q)) out.push({ from, to: t, flag: 'r', piece: p, captured: q }); break; }
        }
      }
    }
    return out;
  }

  function castleMoves(pos, from, king, push) {
    const color = king.color, row = color === 'w' ? 7 : 0;
    if (from !== row * 8 + 4 || isAttacked(pos, from, other(color), true)) return;
    for (const side of [{ rook: 7, between: [5, 6], pass: [5, 6], to: 6, rookTo: 5 }, { rook: 0, between: [1, 2, 3], pass: [3, 2], to: 2, rookTo: 3 }]) {
      const rook = pos.board[row * 8 + side.rook];
      if (!rook || rook.type !== 'r' || rook.color !== color || rook.moved) continue;
      if (side.between.some((c) => pos.board[row * 8 + c])) continue;
      if (side.pass.some((c) => isAttacked(pos, row * 8 + c, other(color), true))) continue;
      push(row * 8 + side.to, 'k', { rookFrom: row * 8 + side.rook, rookTo: row * 8 + side.rookTo });
    }
  }

  function pseudoMoves(pos, color, ctx = {}) {
    const out = [];
    for (let i = 0; i < 64; i++) { const p = pos.board[i]; if (p && p.color === color) pieceMoves(pos, i, ctx, out); }
    return out;
  }

  /** Aplica a jogada no tabuleiro (só geometria) e devolve o necessário para a desfazer. */
  function makeMove(pos, m) {
    const p = pos.board[m.from];
    const undo = { m, ep: pos.ep, half: pos.half, full: pos.full, turn: pos.turn, moved: p.moved, type: p.type, lanceUsed: p.lanceUsed, capSq: -1, cap: null, rookMoved: null };
    const d = p.color === 'w' ? -1 : 1;
    pos.ep = -1;
    if (m.flag === 'r') {
      undo.capSq = m.to; undo.cap = pos.board[m.to];
      pos.board[m.to] = null;
      p.lanceUsed = true;
    } else {
      if (m.flag === 'e') { undo.capSq = m.to - d * 8; undo.cap = pos.board[undo.capSq]; pos.board[undo.capSq] = null; }
      else if (pos.board[m.to]) { undo.capSq = m.to; undo.cap = pos.board[m.to]; }
      pos.board[m.to] = p;
      pos.board[m.from] = null;
      p.moved = true;
      if (m.promo) p.type = m.promo;
      if (m.flag === 'd') pos.ep = m.from + d * 8;
      if (m.flag === 'k') {
        const rook = pos.board[m.rookFrom];
        undo.rookMoved = rook.moved;
        pos.board[m.rookTo] = rook; pos.board[m.rookFrom] = null; rook.moved = true;
      }
    }
    pos.half = p.type === 'p' || undo.cap ? 0 : pos.half + 1;
    if (pos.turn === 'b') pos.full++;
    pos.turn = other(pos.turn);
    return undo;
  }

  function unmakeMove(pos, u) {
    const m = u.m, p = m.piece;
    pos.turn = u.turn; pos.ep = u.ep; pos.half = u.half; pos.full = u.full;
    p.moved = u.moved; p.type = u.type; p.lanceUsed = u.lanceUsed;
    if (m.flag !== 'r') {
      pos.board[m.from] = p;
      pos.board[m.to] = null;
      if (m.flag === 'k') { const rook = pos.board[m.rookTo]; pos.board[m.rookFrom] = rook; pos.board[m.rookTo] = null; rook.moved = u.rookMoved; }
    }
    if (u.cap) pos.board[u.capSq] = u.cap;
  }

  /** Legal = o próprio Rei não fica em xeque. Capturar uma peça com Escudo não a remove (o atacante
      volta para trás), por isso só é legal se o Rei já estiver seguro. */
  function isLegal(pos, m, color, checkedNow) {
    if (m.captured && m.captured.shield) return !checkedNow;
    const u = makeMove(pos, m);
    const ok = !inCheck(pos, color);
    unmakeMove(pos, u);
    return ok;
  }

  function legalMoves(pos, color = pos.turn, ctx = {}) {
    const checked = inCheck(pos, color);
    return pseudoMoves(pos, color, ctx).filter((m) => isLegal(pos, m, color, checked));
  }

  function legalMovesFrom(pos, from, ctx = {}) {
    const p = pos.board[from];
    if (!p) return [];
    const checked = inCheck(pos, p.color);
    return pieceMoves(pos, from, ctx).filter((m) => isLegal(pos, m, p.color, checked));
  }

  /** Remover/mover peças do lado `color` deixaria o seu Rei em xeque? (efeitos de cartas) */
  function exposesKing(pos, color, mutate) {
    const snapshot = pos.board.slice();
    mutate(pos.board);
    const bad = inCheck(pos, color);
    pos.board = snapshot;
    return bad;
  }

  function insufficientMaterial(pos) {
    const minors = [];
    for (const p of pos.board) {
      if (!p || p.type === 'k') continue;
      if (p.type === 'b' || p.type === 'n') minors.push(p); else return false;
    }
    return minors.length <= 1;
  }

  function positionKey(pos) {
    let s = '';
    for (const p of pos.board) s += p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '.';
    return `${s}${pos.turn}${pos.ep}`;
  }

  function perft(pos, depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of legalMoves(pos, pos.turn)) {
      const u = makeMove(pos, m);
      n += depth === 1 ? 1 : perft(pos, depth - 1);
      unmakeMove(pos, u);
    }
    return n;
  }

  /** Notação legível (estilo SAN simplificado) para o registo. */
  function moveLabel(m) {
    const P = { p: '', n: 'C', b: 'B', r: 'T', q: 'D', k: 'R' }[m.piece.origType === m.piece.type ? m.piece.type : m.piece.type];
    if (m.flag === 'k') return m.to > m.from ? 'O-O' : 'O-O-O';
    const cap = m.captured ? 'x' : '-';
    return `${P}${sqName(m.from)}${cap}${sqName(m.to)}${m.promo ? '=' + { q: 'D', r: 'T', b: 'B', n: 'C' }[m.promo] : ''}${m.flag === 'r' ? ' (lança)' : ''}`;
  }

  YC.Chess = {
    FILES, VALUE, START, sqName, sqIndex, rc, at, other, has, makePiece, fromFEN, kingSquare, attacks, isAttacked, attackersOf,
    inCheck, pieceMoves, pseudoMoves, makeMove, unmakeMove, legalMoves, legalMovesFrom, exposesKing, insufficientMaterial,
    positionKey, perft, moveLabel, isFrozen: frozen, isMorphed: morphed, KING, ORTHO
  };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
