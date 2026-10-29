/* BoardView.js — tabuleiro 3D (plano inclinado em perspetiva) com peças em pé, como figuras numa arena.
   `sync(match)` reconcilia o DOM com o estado do motor: posições, tipo, equipamentos, escudo, gelo, xeque.
   As animações (MatchAnimator) mexem nos mesmos elementos e no fim chamam `sync` para acertar tudo.
   Os efeitos (POW!, partículas) desenham-se numa camada plana por cima (`fx`), na posição projetada das casas. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const FILES = 'ABCDEFGH';

  class BoardView {
    constructor(host, { onSquare, onHoverSq, onPieceHover, fxLayer } = {}) {
      this.host = host;
      this.flipped = false;
      this.onSquare = onSquare || (() => {});
      this.onHoverSq = onHoverSq || (() => {});
      this.onPieceHover = onPieceHover || (() => {});
      this.pieceEls = new Map();
      this.busy = new Set();
      host.innerHTML = '<div class="board-wrap"><div class="board"><div class="pieces"></div></div></div>';
      this.wrap = host.firstChild;
      this.board = this.wrap.querySelector('.board');
      this.piecesLayer = this.board.querySelector('.pieces');
      this.fx = fxLayer || Object.assign(document.createElement('div'), { className: 'fx-layer' });
      if (!fxLayer) host.appendChild(this.fx);
      this.squares = [];
      for (let i = 0; i < 64; i++) {
        const s = document.createElement('div');
        s.className = 'sq';
        s.addEventListener('click', () => this.onSquare(Number(s.dataset.sq)));
        s.addEventListener('mouseenter', () => this.onHoverSq(Number(s.dataset.sq)));
        this.board.appendChild(s);
        this.squares.push(s);
      }
      // as peças em pé tapam parte da casa de trás: o clique numa peça conta como clique na casa dela
      const pieceOf = (e) => e.target.closest && e.target.closest('.piece');
      this.piecesLayer.addEventListener('click', (e) => { const p = pieceOf(e); if (p) this.onSquare(Number(p.dataset.sq)); });
      this.piecesLayer.addEventListener('mouseover', (e) => { const p = pieceOf(e); if (p && p !== this.hovered) { this.hovered = p; this.onPieceHover(Number(p.dataset.sq), p); this.onHoverSq(Number(p.dataset.sq)); } });
      this.board.addEventListener('mouseleave', () => this.onHoverSq(-1));
      this.piecesLayer.addEventListener('mouseout', (e) => { const p = pieceOf(e); if (p && !p.contains(e.relatedTarget)) { this.hovered = null; this.onPieceHover(-1, null); } });
      this.layout();
    }

    layout() {
      this.squares.forEach((s, i) => {
        const sq = this.flipped ? 63 - i : i;
        s.dataset.sq = sq;
        const r = sq >> 3, c = sq & 7;
        s.className = `sq${(r + c) % 2 ? ' dark' : ''}`;
        const showRank = this.flipped ? c === 7 : c === 0, showFile = this.flipped ? r === 0 : r === 7;
        s.innerHTML = (showRank ? `<span class="coord rank">${8 - r}</span>` : '') + (showFile ? `<span class="coord file">${'abcdefgh'[c]}</span>` : '');
      });
    }

    setFlipped(f) { if (this.flipped !== f) { this.flipped = f; this.layout(); this.pieceEls.forEach((el) => this.place(el, Number(el.dataset.sq))); } }
    rc(sq) { const r = sq >> 3, c = sq & 7; return this.flipped ? [7 - r, 7 - c] : [r, c]; }
    sqEl(sq) { return this.squares[this.flipped ? 63 - sq : sq]; }
    rect(sq) { return this.sqEl(sq).getBoundingClientRect(); }
    boardRect() { return this.wrap.getBoundingClientRect(); }
    /** Ameaça na janela de resposta (casa em perigo e quem ataca). */
    showThreat(pairs) {
      this.clearThreat();
      for (const { from, to } of pairs) { if (to >= 0) this.sqEl(to).classList.add('threat-to'); if (from >= 0 && from !== to) this.sqEl(from).classList.add('threat-from'); }
    }
    clearThreat() { this.squares.forEach((s) => s.classList.remove('threat-to', 'threat-from')); }
    place(el, sq) { const [r, c] = this.rc(sq); el.style.left = `${c * 12.5}%`; el.style.top = `${r * 12.5}%`; el.dataset.sq = sq; }
    pctPos(sq) { const [r, c] = this.rc(sq); return { left: `${c * 12.5}%`, top: `${r * 12.5}%` }; }

    /** Centro projetado da casa, em % da camada de efeitos (que é plana). */
    center(sq) {
      const r = this.rect(sq), f = this.fx.getBoundingClientRect();
      if (!f.width) return { x: 50, y: 50 };
      return { x: ((r.left + r.width / 2 - f.left) / f.width) * 100, y: ((r.top + r.height * 0.42 - f.top) / f.height) * 100 };
    }

    /** Tamanho de referência dos efeitos (largura projetada do tabuleiro). */
    unit() { return this.board.getBoundingClientRect().width || 400; }

    makePiece(p) {
      const el = document.createElement('div');
      el.className = `piece ${p.color}`;
      el.dataset.id = p.id;
      el.style.setProperty('--blink', `${(Math.random() * 3.5).toFixed(2)}s`);
      el.innerHTML = '<div class="base-disc"></div><div class="stand"><div class="aura"></div><div class="hop"><div class="squash"></div></div>'
        + '<div class="shield-dome"></div><div class="ice-block"></div><div class="freeze-badge"></div><div class="medals"></div></div>';
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

    sync(m, { viewer } = {}) {
      this.fx._unit = this.unit();
      const seen = new Set(), turn = m.state.turnCount;
      const checked = !m.state.winner && C().inCheck(m.pos, m.state.active) ? C().kingSquare(m.pos, m.state.active) : -1;
      m.pos.board.forEach((p, sq) => {
        if (!p) return;
        seen.add(p.id);
        let el = this.el(p.id);
        if (!el) el = this.makePiece(p);
        if (this.busy.has(p.id)) return;
        this.renderType(el, p);
        // Ultimate (Ultimates.js): a peça passa a ser a personagem
        const ult = YC.Ultimate && YC.Ultimate.forPiece(p, viewer);
        if (ult && !el.querySelector('.ult-fig')) el.querySelector('.squash').innerHTML = `<img class="ult-fig" src="${YC.Ultimate.hero(ult)}" alt="" draggable="false">`;
        else if (!ult && el.querySelector('.ult-fig')) { el.dataset.type = ''; this.renderType(el, p); }
        el.classList.toggle('ult-form', !!ult);
        if (Number(el.dataset.sq) !== sq || !el.style.left) this.place(el, sq);
        el.classList.toggle('mine', p.color === viewer);
        const frozen = p.frozenUntil > turn;
        el.classList.toggle('equipped', p.equips.length > 0);
        el.classList.toggle('shielded', !!p.shield);
        el.classList.toggle('frozen', frozen);
        el.classList.toggle('checked', sq === checked);
        el.classList.toggle('morphed', !!p.morphUntil);
        if (p.morphUntil) el.querySelector('.squash').dataset.real = { n: 'C', b: 'B', r: 'T', q: 'D' }[p.morphFrom] || '';
        if (frozen) el.querySelector('.freeze-badge').textContent = `${Math.ceil((p.frozenUntil - turn) / 2)}`;
        const key = p.equips.join(',');
        if (el.dataset.equips !== key) {
          el.dataset.equips = key;
          el.querySelector('.medals').innerHTML = p.equips.map((id) => {
            const c = YC.Cards.get(id);
            return `<span class="medal" style="--c1:${c.theme.primary};--c2:${c.theme.secondary}">${YC.CardArt.svg(c, 'medal-icon')}</span>`;
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
      const blocked = m.pos.blocked || [];
      this.squares.forEach((s) => s.classList.toggle('blocked', blocked.includes(Number(s.dataset.sq))));
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
        mark.dataset.card = t.id;
        mark.innerHTML = YC.CardArt.svg(c);
        this.sqEl(t.sq).appendChild(mark);
      }
    }

    /** Marcações: seleção, lances possíveis (com o nome da casa, ex.: "D5"), último lance, alvos de cartas. */
    mark({ sel = -1, moves = [], last = null, equip = [], trap = [], pick = [], peek = null } = {}) {
      for (const s of this.squares) {
        s.classList.remove('sel', 'last', 'target', 'equip-ok', 'trap-ok', 'peek-from');
        s.querySelectorAll('.dot,.ring,.sq-label').forEach((d) => d.remove());
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
        const lab = document.createElement('span');
        lab.className = 'sq-label';
        lab.textContent = `${FILES[m.to & 7]}${8 - (m.to >> 3)}`;
        s.appendChild(lab);
      }
      for (const sq of equip) this.sqEl(sq).classList.add('equip-ok', 'target');
      for (const sq of trap) this.sqEl(sq).classList.add('trap-ok', 'target');
      for (const sq of pick) this.sqEl(sq).classList.add('equip-ok', 'target');
      if (peek) {
        this.sqEl(peek.sq).classList.add('peek-from');
        for (const m of peek.moves) {
          const s = this.sqEl(m.to);
          if (s.querySelector('.dot,.ring')) continue;
          s.insertAdjacentHTML('beforeend', `<div class="${m.captured ? 'ring' : 'dot'} peek"></div><span class="sq-label peek">${FILES[m.to & 7]}${8 - (m.to >> 3)}</span>`);
        }
      }
      this.pieceEls.forEach((el) => el.classList.toggle('selected', Number(el.dataset.sq) === sel));
    }

    clear() { this.pieceEls.forEach((el) => el.remove()); this.pieceEls.clear(); this.busy.clear(); }
  }

  YC.BoardView = BoardView;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
