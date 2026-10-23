/* BoardEngine.js — matriz 8×8 customizada (sem chess.js): peças com stats RPG, trajetórias por
   raycasting casa a casa, armadilhas espaciais ocultas e validação posicional.
   Convenção: linha 0 = fila 8 (Pretas em cima), linha 7 = fila 1 (Brancas em baixo). */
(function (YC) {
  'use strict';

  const FILES = 'abcdefgh';
  const BACK_RANK = ['ROOK', 'KNIGHT', 'BISHOP', 'QUEEN', 'KING', 'BISHOP', 'KNIGHT', 'ROOK'];
  const KNIGHT_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING_OFFSETS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const MAX_BOARD_TRAPS = 3;

  class BoardCell {
    constructor(row, col) {
      this.row = row; this.col = col;
      this.piece = null;     // PieceEntity
      this.trap = null;      // { card, owner, turnSet }
      this.fieldMod = null;
    }
  }

  class BoardEngine {
    constructor(bus) {
      this.bus = bus;
      this.grid = [];
      this.byUid = new Map();
      this.graveyard = { WHITE: [], BLACK: [] };
      this.counter = 0;
    }

    reset() {
      this.grid = Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => new BoardCell(r, c)));
      this.byUid.clear();
      this.graveyard = { WHITE: [], BLACK: [] };
      this.counter = 0;
      BACK_RANK.forEach((type, c) => {
        this.place(this.createPiece(type, 'BLACK'), 0, c);
        this.place(this.createPiece('PAWN', 'BLACK'), 1, c);
        this.place(this.createPiece('PAWN', 'WHITE'), 6, c);
        this.place(this.createPiece(type, 'WHITE'), 7, c);
      });
    }

    createPiece(type, team) {
      const base = YC.CardDatabase.pieceBaseStats[type];
      return {
        uid: `p_${team[0].toLowerCase()}${++this.counter}`, team, type, name: base.name,
        hp: base.hp, maxHp: base.hp, atk: base.atk, shield: base.shield,
        tempShield: 0, tempAtk: 0, overdrive: false, swapped: null,
        buffs: [], statuses: [], hasMoved: false, row: -1, col: -1, alive: true
      };
    }

    // ── Acesso básico ──
    inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
    cell(r, c) { return this.inBounds(r, c) ? this.grid[r][c] : null; }
    pieceAt(r, c) { const cell = this.cell(r, c); return cell ? cell.piece : null; }
    getPiece(uid) { return this.byUid.get(uid) || null; }
    pieces(team) {
      const out = [];
      for (const p of this.byUid.values()) if (p.alive && (!team || p.team === team)) out.push(p);
      return out;
    }
    king(team) { return this.pieces(team).find((p) => p.type === 'KING') || null; }
    squareName(r, c) { return `${FILES[c]}${8 - r}`; }
    /** Zona de armadilhas: qualquer fila exceto as duas filas iniciais do adversário. */
    trapZone(team, r) { return team === 'WHITE' ? r >= 2 : r <= 5; }

    place(piece, r, c) {
      piece.row = r; piece.col = c; piece.alive = true;
      this.grid[r][c].piece = piece;
      this.byUid.set(piece.uid, piece);
    }

    moveTo(piece, r, c) {
      if (piece.row >= 0 && this.grid[piece.row][piece.col].piece === piece) this.grid[piece.row][piece.col].piece = null;
      piece.row = r; piece.col = c;
      this.grid[r][c].piece = piece;
    }

    remove(piece) {
      if (piece.row >= 0 && this.grid[piece.row][piece.col].piece === piece) this.grid[piece.row][piece.col].piece = null;
      piece.alive = false;
      this.graveyard[piece.team].push(piece);
    }

    swap(a, b) {
      const [ar, ac, br, bc] = [a.row, a.col, b.row, b.col];
      this.grid[ar][ac].piece = b; this.grid[br][bc].piece = a;
      a.row = br; a.col = bc; b.row = ar; b.col = ac;
    }

    isStunned(piece, turn) {
      return piece.statuses.some((s) => s.type === 'STUNNED' && turn < s.expiresAtTurn);
    }

    // ── Permissões ──
    pieceAllowed(piece, permission) {
      if (!permission) return true;
      if (permission.allowed === 'ALL') return true;
      return permission.allowed.includes(piece.type);
    }

    /** Raio passo a passo: devolve as casas até (e incluindo) a primeira peça encontrada. */
    getRayPath(r, c, dr, dc, maxSteps = 7) {
      const path = [];
      for (let i = 1; i <= maxSteps; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (!this.inBounds(nr, nc)) break;
        path.push([nr, nc]);
        if (this.grid[nr][nc].piece) break;
      }
      return path;
    }

    /** Movimentos válidos de uma peça sob a permissão Uno atual (null = sem filtro, uso da IA). */
    getValidMoves(piece, permission, turn) {
      if (!piece || !piece.alive) return [];
      if (turn != null && this.isStunned(piece, turn)) return [];
      if (permission && !this.pieceAllowed(piece, permission)) return [];
      const from = [piece.row, piece.col];
      const moves = [];
      const add = (type, rayPath, extra) => {
        const to = rayPath[rayPath.length - 1];
        const target = this.pieceAt(to[0], to[1]);
        moves.push({ type, from, to, rayPath, defenderUid: target && type === 'ATTACK' ? target.uid : null, ...extra });
      };

      if (permission && permission.zero) {
        if (piece.type === 'PAWN') this._pawnMoves(piece, add);
        if (piece.type === 'KING') this._castleMoves(piece, add);
        this._swapMoves(piece, add, turn);
        return moves;
      }

      switch (piece.type) {
        case 'PAWN': this._pawnMoves(piece, add); break;
        case 'KNIGHT': this._stepMoves(piece, KNIGHT_OFFSETS, add); break;
        case 'KING': this._stepMoves(piece, KING_OFFSETS, add); break;
        case 'BISHOP': this._slideMoves(piece, DIAG, add); break;
        case 'ROOK': this._slideMoves(piece, ORTHO, add); break;
        case 'QUEEN': this._slideMoves(piece, [...DIAG, ...ORTHO], add); break;
      }
      return moves;
    }

    _pawnMoves(piece, add) {
      const d = piece.team === 'WHITE' ? -1 : 1;
      const r = piece.row, c = piece.col;
      if (this.inBounds(r + d, c) && !this.pieceAt(r + d, c)) {
        add('MOVE', [[r + d, c]]);
        if (!piece.hasMoved && this.inBounds(r + 2 * d, c) && !this.pieceAt(r + 2 * d, c)) {
          add('MOVE', [[r + d, c], [r + 2 * d, c]]);
        }
      }
      for (const dc of [-1, 1]) {
        const t = this.pieceAt(r + d, c + dc);
        if (t && t.team !== piece.team) add('ATTACK', [[r + d, c + dc]]);
      }
    }

    _stepMoves(piece, offsets, add) {
      for (const [dr, dc] of offsets) {
        const r = piece.row + dr, c = piece.col + dc;
        if (!this.inBounds(r, c)) continue;
        const t = this.pieceAt(r, c);
        if (!t) add('MOVE', [[r, c]]);
        else if (t.team !== piece.team) add('ATTACK', [[r, c]]);
      }
    }

    _slideMoves(piece, dirs, add) {
      for (const [dr, dc] of dirs) {
        const ray = this.getRayPath(piece.row, piece.col, dr, dc);
        for (let i = 0; i < ray.length; i++) {
          const [r, c] = ray[i];
          const t = this.pieceAt(r, c);
          const path = ray.slice(0, i + 1);
          if (!t) add('MOVE', path);
          else if (t.team !== piece.team) add('ATTACK', path);
        }
      }
    }

    _castleMoves(king, add) {
      if (king.hasMoved) return;
      const r = king.row;
      const sides = [{ rookCol: 7, between: [5, 6], kingTo: 6, rookTo: 5 }, { rookCol: 0, between: [1, 2, 3], kingTo: 2, rookTo: 3 }];
      for (const s of sides) {
        const rook = this.pieceAt(r, s.rookCol);
        if (!rook || rook.type !== 'ROOK' || rook.team !== king.team || rook.hasMoved) continue;
        if (s.between.some((c) => this.pieceAt(r, c))) continue;
        add('CASTLE', [[r, s.kingTo]], { rook: { uid: rook.uid, from: [r, s.rookCol], to: [r, s.rookTo] } });
      }
    }

    _swapMoves(piece, add, turn) {
      for (const [dr, dc] of KING_OFFSETS) {
        const t = this.pieceAt(piece.row + dr, piece.col + dc);
        if (t && t.team === piece.team && !(turn != null && this.isStunned(t, turn))) {
          add('SWAP', [[t.row, t.col]], { swapUid: t.uid });
        }
      }
    }

    /** Índices do rayPath onde uma armadilha inimiga pode disparar (só casas vazias). */
    trapCheckIndices(piece, move) {
      if (move.type === 'SWAP' || move.type === 'CASTLE') return [];
      const last = move.rayPath.length - 1;
      if (piece.type === 'KNIGHT') return move.type === 'MOVE' ? [last] : [];
      const idx = [];
      move.rayPath.forEach((_, i) => { if (move.type === 'MOVE' || i < last) idx.push(i); });
      return idx;
    }

    // ── Armadilhas espaciais ──
    trapsOf(team) {
      const out = [];
      for (const row of this.grid) for (const cell of row) if (cell.trap && cell.trap.owner === team) out.push(cell);
      return out;
    }

    /** Não revela armadilhas inimigas: uma casa com armadilha oculta do adversário parece livre. */
    canSetTrapAt(team, r, c) {
      const cell = this.cell(r, c);
      if (!cell || !this.trapZone(team, r) || cell.piece) return false;
      if (cell.trap && cell.trap.owner === team) return false;
      return this.trapsOf(team).length < MAX_BOARD_TRAPS;
    }

    /** Arma a armadilha. Se já houver uma armadilha inimiga escondida ali, as duas destroem-se (CLANG!). */
    setTrap(card, team, r, c, turn) {
      const cell = this.grid[r][c];
      if (cell.trap && cell.trap.owner !== team) {
        const clash = cell.trap;
        cell.trap = null;
        return { clash };
      }
      card.turnSet = turn; card.owner = team;
      cell.trap = { card, owner: team, turnSet: turn };
      this.bus.emit('TRAP_SET', { team, row: r, col: c, card });
      return { clash: null };
    }

    removeTrap(r, c) {
      const cell = this.cell(r, c);
      const trap = cell ? cell.trap : null;
      if (cell) cell.trap = null;
      return trap;
    }

    /** Armadilha inimiga armada (respeita o "Set Sickness": só ativa em turnos posteriores). */
    armedEnemyTrap(r, c, team, turn) {
      const cell = this.cell(r, c);
      const t = cell && cell.trap;
      return t && t.owner !== team && turn > t.turnSet ? t : null;
    }

    // ── Geometria auxiliar (IA, previsões, efeitos) ──
    /** A peça `attacker` consegue atingir (r,c)? Ignora permissões; trata `ignoreUid` como ausente. */
    canReach(attacker, r, c, ignoreUid) {
      const dr = r - attacker.row, dc = c - attacker.col;
      if (dr === 0 && dc === 0) return false;
      const adr = Math.abs(dr), adc = Math.abs(dc);
      switch (attacker.type) {
        case 'PAWN': return dr === (attacker.team === 'WHITE' ? -1 : 1) && adc === 1;
        case 'KNIGHT': return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
        case 'KING': return adr <= 1 && adc <= 1;
        case 'BISHOP': if (adr !== adc) return false; break;
        case 'ROOK': if (dr !== 0 && dc !== 0) return false; break;
        case 'QUEEN': if (adr !== adc && dr !== 0 && dc !== 0) return false; break;
      }
      const sr = Math.sign(dr), sc = Math.sign(dc);
      for (let i = 1; i < Math.max(adr, adc); i++) {
        const p = this.pieceAt(attacker.row + sr * i, attacker.col + sc * i);
        if (p && p.uid !== ignoreUid) return false;
      }
      return true;
    }

    threatsTo(r, c, team, ignoreUid) {
      return this.pieces(YC.other(team)).filter((p) => this.canReach(p, r, c, ignoreUid));
    }

    neighbors(r, c, orthoOnly) {
      return (orthoOnly ? ORTHO : KING_OFFSETS).map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => this.inBounds(a, b));
    }

    distance(a, b) { return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); }

    /** Coloca um Peão do cemitério na 2.ª fila (Ressurreição). */
    revive(team, type) {
      const idx = this.graveyard[team].findIndex((p) => p.type === type);
      if (idx < 0) return null;
      const row = team === 'WHITE' ? 6 : 1;
      const dead = this.graveyard[team][idx];
      const cols = [dead.col, 3, 4, 2, 5, 1, 6, 0, 7].filter((c) => c >= 0);
      const col = cols.find((c) => !this.pieceAt(row, c) && !this.cell(row, c).trap);
      if (col == null) return null;
      this.graveyard[team].splice(idx, 1);
      const fresh = this.createPiece(type, team);
      this.place(fresh, row, col);
      return fresh;
    }

    /** Promoção do Peão a Dama mantendo a proporção de HP. */
    promote(piece) {
      const q = YC.CardDatabase.pieceBaseStats.QUEEN;
      const ratio = piece.hp / piece.maxHp;
      Object.assign(piece, { type: 'QUEEN', name: q.name, maxHp: q.hp, hp: Math.max(1, Math.round(q.hp * ratio)), atk: q.atk, shield: Math.max(piece.shield, q.shield) });
    }
  }

  BoardEngine.FILES = FILES;
  BoardEngine.MAX_BOARD_TRAPS = MAX_BOARD_TRAPS;
  YC.BoardEngine = BoardEngine;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
