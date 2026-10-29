/* MatchHints.js — ajudas no tabuleiro (acrescenta métodos ao MatchUI; o motor é o YC.MoveExplain):
   • passar o rato numa peça inimiga (ou tocar nela) mostra para onde ela pode ir e o que pode capturar na próxima
     vez que jogar — já com os equipamentos e estados — a laranja (casas) e a vermelho (capturas);
   • com uma peça tua escolhida, passar o rato numa casa onde ela não pode ir mostra porquê numa etiqueta junto da
     casa; o clique nessa casa diz o mesmo num aviso (a forma normal de andar só aparece no clique se for uma peça). */
(function (YC) {
  'use strict';

  const X = () => YC.MoveExplain;
  const touch = () => matchMedia('(hover: none)').matches;

  Object.assign(YC.MatchUI.prototype, {
    /** Casa debaixo do rato (peça ou casa vazia); -1 quando o rato sai do tabuleiro. */
    onHoverSq(sq) {
      if (this.hoverSq === sq) return;
      this.hoverSq = sq;
      const m = this.match;
      if (!m || !this.stage) return;
      const p = sq >= 0 ? m.pieceAt(sq) : null;
      const peek = !this.mode && !this.dragging && p && p.color !== this.viewer ? sq : -1;
      if (peek !== (this.peekHover == null ? -1 : this.peekHover)) { this.peekHover = peek; this.refreshMarks(); }
      this.whyTip(sq);
    },

    refreshMarks() { if (this.board && this.match && this.stage) this.board.mark(this.markings()); },

    /** A peça cujos lances se espreitam: a tocada (modo 'peek') ou a que está debaixo do rato sem nada escolhido. */
    peekState() {
      const m = this.match;
      const sq = this.mode === 'peek' ? this.peekSq : !this.mode ? this.peekHover : -1;
      if (sq == null || sq < 0 || m.over || !m.pieceAt(sq)) return null;
      return { sq, moves: X().preview(m, sq) };
    },

    /** Tocar numa peça inimiga fixa a espreitadela; tocar outra vez (ou fora) tira-a. */
    peekAt(sq) {
      if (this.mode === 'peek' && this.peekSq === sq) return this.cancelMode();
      this.cancelMode();
      this.mode = 'peek'; this.peekSq = sq;
      if (YC.Sound) YC.Sound.play('click');
      if (touch()) this.toast(this.peekSummary(sq));
      this.renderSoft();
    },

    /** "O Bispo inimigo pode capturar: a tua Torre (A1)." */
    peekSummary(sq) {
      const m = this.match, p = m.pieceAt(sq), mv = X().preview(m, sq);
      const name = `${YC.PIECE_NAME[p.type]}${p.color === this.viewer ? '' : (p.type === 'r' || p.type === 'q' ? ' inimiga' : ' inimigo')}`;
      const dest = new Set(mv.map((x) => x.to)).size;
      const caps = this.peekCaptures(mv);
      if (!dest) return `${name}: sem lances na próxima vez.`;
      return caps.length ? `${name} pode capturar: ${caps.join(', ')}.` : `${name} pode ir para ${dest} casa${dest === 1 ? '' : 's'}, mas não captura nada.`;
    },

    /** Capturas de uma lista de lances, sem repetir a casa (promoções): ["Torre (A1)", …]. */
    peekCaptures(moves) {
      const seen = new Set(), out = [];
      for (const x of moves) {
        if (!x.captured || seen.has(x.to)) continue;
        seen.add(x.to);
        out.push(`${YC.PIECE_NAME[x.captured.type]} (${YC.Chess.sqName(x.to).toUpperCase()})`);
      }
      return out;
    },

    modePeekHint() {
      const p = this.match.pieceAt(this.peekSq), f = p && (p.type === 'r' || p.type === 'q');
      if (!p) return '';
      const who = `${f ? 'da' : 'do'} ${YC.PIECE_NAME[p.type]}${p.color === this.viewer ? '' : f ? ' inimiga' : ' inimigo'}`;
      return `Lances ${who} na próxima vez: laranja = pode ir, vermelho = pode capturar.`;
    },

    // ───────────── porque é que não dá ─────────────
    /** { text, soft } a dizer porque é que a peça escolhida não pode ir para `sq` (null se pode ou nada escolhido). */
    whyNot(sq) {
      if (this.mode !== 'piece' || this.selSq < 0 || sq < 0 || sq === this.selSq) return null;
      return X().why(this.match, this.selSq, sq);
    },

    whyTip(sq) {
      clearTimeout(this.whyTimer);
      const r = this.myTurn() && !this.dragging ? this.whyNot(sq) : null;
      const own = r && this.match.pieceAt(sq) && this.match.pieceAt(sq).color === this.viewer;
      if (!r || own) return this.hideWhy();
      this.whyTimer = setTimeout(() => this.showWhy(sq, r), 140);
    },

    showWhy(sq, r) {
      if (!this.stage || this.hoverSq !== sq) return;
      if (!this.whyEl) {
        this.whyEl = document.createElement('div');
        this.whyEl.className = 'move-why';
        document.body.appendChild(this.whyEl);
      }
      const el = this.whyEl;
      el.classList.toggle('soft', !!r.soft);
      el.innerHTML = `${YC.Icon(r.soft ? 'info' : 'no', { size: 18 })}<span>${YC.HoloCard.esc(r.text)}</span>`;
      const b = this.board.rect(sq), w = el.offsetWidth, h = el.offsetHeight;
      let x = b.left + b.width / 2 - w / 2, y = b.top - h - 8;
      if (y < 8) y = b.bottom + 8;
      x = Math.max(8, Math.min(innerWidth - w - 8, x));
      el.style.left = `${x}px`; el.style.top = `${y}px`;
    },

    hideWhy() {
      clearTimeout(this.whyTimer);
      if (this.whyEl) { this.whyEl.remove(); this.whyEl = null; }
    },

    /** Clique numa casa onde a peça escolhida não pode ir: aviso com a razão. */
    explainClick(sq) {
      const r = this.whyNot(sq), p = this.match.pieceAt(sq);
      if (!r || (r.soft && !(p && p.color !== this.viewer))) return;
      if (YC.Sound) YC.Sound.play('error');
      this.toast(r.text, true);
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
