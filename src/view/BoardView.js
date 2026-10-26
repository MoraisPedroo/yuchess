/* BoardView.js — desenha o tabuleiro (64 casas), as peças (elementos com SVG) e as marcações.
   `sync(match)` reconcilia o DOM com o estado do motor: posições, tipo, equipamentos, escudo, gelo, xeque.
   As animações (MatchAnimator) mexem nos mesmos elementos e no fim chamam `sync` para acertar tudo. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;

  class BoardView {
    constructor(host, { onSquare } = {}) {
      this.host = host;
      this.flipped = false;
      this.onSquare = onSquare || (() => {});
      this.pieceEls = new Map();
      this.busy = new Set();
      host.innerHTML = '<div class="board-wrap"><div class="board"></div><div class="pieces"></div><div class="fx-layer"></div></div>';
      this.wrap = host.firstChild;
      this.board = this.wrap.querySelector('.board');
      this.piecesLayer = this.wrap.querySelector('.pieces');
      this.fx = this.wrap.querySelector('.fx-layer');
      this.squares = [];
      for (let i = 0; i < 64; i++) {
        const s = document.createElement('div');
        s.className = 'sq';
        s.addEventListener('click', () => this.onSquare(Number(s.dataset.sq)));
        this.board.appendChild(s);
        this.squares.push(s);
      }
      this.layout();
    }

    /** Posiciona as camadas por cima do tabuleiro (as peças ocupam a mesma área das casas). */
    layout() {
      const inset = 'calc(16px + 3.5px)';
      for (const l of [this.piecesLayer, this.fx]) { l.style.position = 'absolute'; l.style.inset = inset; }
      this.squares.forEach((s, i) => {
        const sq = this.flipped ? 63 - i : i;
        s.dataset.sq = sq;
        const r = sq >> 3, c = sq & 7;
        s.className = `sq${(r + c) % 2 ? ' dark' : ''}`;
        const showRank = this.flipped ? c === 7 : c === 0, showFile = this.flipped ? r === 0 : r === 7;
        s.innerHTML = (showRank ? `<span class="coord rank">${8 - r}</span>` : '') + (showFile ? `<span class="coord file">${'abcdefgh'[c]}</span>` : '');
      });
    }

    setFlipped(f) { if (this.flipped !== f) { this.flipped = f; this.layout(); this.pieceEls.forEach((el, id) => this.place(el, Number(el.dataset.sq))); } }
    rc(sq) { const r = sq >> 3, c = sq & 7; return this.flipped ? [7 - r, 7 - c] : [r, c]; }
    center(sq) { const [r, c] = this.rc(sq); return { x: (c + 0.5) * 12.5, y: (r + 0.5) * 12.5 }; }
    sqEl(sq) { return this.squares[this.flipped ? 63 - sq : sq]; }
    rect(sq) { return this.sqEl(sq).getBoundingClientRect(); }
    place(el, sq) { const [r, c] = this.rc(sq); el.style.left = `${c * 12.5}%`; el.style.top = `${r * 12.5}%`; el.dataset.sq = sq; }
    pctPos(sq) { const [r, c] = this.rc(sq); return { left: `${c * 12.5}%`, top: `${r * 12.5}%` }; }

    makePiece(p) {
      const el = document.createElement('div');
      el.className = `piece ${p.color}`;
      el.dataset.id = p.id;
      el.style.setProperty('--blink', `${(Math.random() * 3.5).toFixed(2)}s`);
      el.innerHTML = '<div class="aura"></div><div class="hop"><div class="squash"></div></div><div class="shield-dome"></div><div class="ice-block"></div><div class="freeze-badge"></div><div class="medals"></div>';
      this.piecesLayer.appendChild(el);
      this.pieceEls.set(p.id, el);
      this.renderType(el, p);
      return el;
    }

    renderType(el, p) {
      if (el.dataset.type === p.type) return;
      el.dataset.type = p.type;
      el.querySelector('.squash').innerHTML = YC.PieceArt.svg(p.type, p.color);
    }

    el(id) { return this.pieceEls.get(id) || null; }

    /** Acerta o DOM com o estado. `skip`: ids de peças a meio de uma animação. */
    sync(m, { viewer } = {}) {
      const seen = new Set(), turn = m.state.turnCount;
      const checked = !m.state.winner && C().inCheck(m.pos, m.state.active) ? C().kingSquare(m.pos, m.state.active) : -1;
      m.pos.board.forEach((p, sq) => {
        if (!p) return;
        seen.add(p.id);
        let el = this.el(p.id);
        if (!el) el = this.makePiece(p);
        if (this.busy.has(p.id)) return;
        this.renderType(el, p);
        if (Number(el.dataset.sq) !== sq || !el.style.left) this.place(el, sq);
        const frozen = p.frozenUntil > turn;
        el.classList.toggle('equipped', p.equips.length > 0);
        el.classList.toggle('shielded', !!p.shield);
        el.classList.toggle('frozen', frozen);
        el.classList.toggle('checked', sq === checked);
        el.classList.toggle('morphed', !!p.morphUntil);
        if (p.morphUntil) el.querySelector('.squash').dataset.real = { n: 'C', b: 'B', r: 'T', q: 'D' }[p.morphFrom] || '';
        if (frozen) el.querySelector('.freeze-badge').textContent = `❄${Math.ceil((p.frozenUntil - turn) / 2)}`;
        const key = p.equips.join(',');
        if (el.dataset.equips !== key) {
          el.dataset.equips = key;
          el.querySelector('.medals').innerHTML = p.equips.map((id) => {
            const c = YC.Cards.get(id);
            return `<span class="medal" title="${c.name}" style="--c1:${c.theme.primary};--c2:${c.theme.secondary}">${YC.CardArt.svg(c, 'medal-icon')}</span>`;
          }).join('');
          const first = p.equips[0] && YC.Cards.get(p.equips[0]);
          el.style.setProperty('--aura', first ? `${first.theme.primary}aa` : 'transparent');
        }
      });
      for (const [id, el] of this.pieceEls) {
        if (!seen.has(id) && !this.busy.has(id)) { el.remove(); this.pieceEls.delete(id); }
      }
      this.renderTraps(m, viewer);
      this.squares.forEach((s) => s.classList.toggle('check', Number(s.dataset.sq) === checked));
    }

    renderTraps(m, viewer) {
      for (const s of this.squares) { const t = s.querySelector('.trap-mark'); if (t) t.remove(); }
      for (const t of m.traps) {
        const mine = t.owner === viewer;
        if (!mine && !t.revealed) continue;
        const c = YC.Cards.get(t.id);
        const mark = document.createElement('div');
        mark.className = `trap-mark${mine ? '' : ' enemy'}`;
        mark.style.setProperty('--c', c.theme.primary);
        mark.title = mine ? `A tua armadilha: ${c.name}` : `Armadilha inimiga revelada: ${c.name}`;
        mark.innerHTML = YC.CardArt.svg(c);
        this.sqEl(t.sq).appendChild(mark);
      }
    }

    /** Marcações: seleção, lances possíveis, último lance, alvos de cartas. */
    mark({ sel = -1, moves = [], last = null, equip = [], trap = [], pick = [] } = {}) {
      for (const s of this.squares) {
        s.classList.remove('sel', 'last', 'target', 'equip-ok', 'trap-ok');
        s.querySelectorAll('.dot,.ring').forEach((d) => d.remove());
      }
      if (last) { this.sqEl(last.from).classList.add('last'); this.sqEl(last.to).classList.add('last'); }
      if (sel >= 0) this.sqEl(sel).classList.add('sel');
      for (const m of moves) {
        const s = this.sqEl(m.to);
        s.classList.add('target');
        if (s.querySelector('.dot,.ring')) continue;
        const d = document.createElement('div');
        d.className = m.captured ? `ring${m.flag === 'r' ? ' lance' : ''}` : 'dot';
        s.appendChild(d);
      }
      for (const sq of equip) this.sqEl(sq).classList.add('equip-ok', 'target');
      for (const sq of trap) this.sqEl(sq).classList.add('trap-ok', 'target');
      for (const sq of pick) this.sqEl(sq).classList.add('equip-ok', 'target');
      this.pieceEls.forEach((el) => el.classList.toggle('selected', Number(el.dataset.sq) === sel));
    }

    clear() { this.pieceEls.forEach((el) => el.remove()); this.pieceEls.clear(); this.busy.clear(); }
  }

  YC.BoardView = BoardView;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
