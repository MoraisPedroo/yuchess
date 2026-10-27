/* MatchLog.js — histórico da partida (acrescenta métodos ao MatchUI): as 2 últimas linhas no canto (feed) e a
   gaveta "Histórico" com tudo, separado por turnos. Cada linha mostra a cartinha jogada (o verso, se for uma
   carta escondida do adversário que ainda não se revelou) ou a peça que se mexeu. Passar o rato numa linha
   mostra a carta em grande e marca a dourado no tabuleiro onde ela está agora (a peça que tem o equipamento,
   a casa da tua armadilha, a peça que se mexeu); clicar abre o cartão dessa peça com os equipamentos. Nunca
   mostra cartas nem casas das armadilhas escondidas do adversário. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const SQ = (sq) => YC.Chess.sqName(sq).toUpperCase();
  const GOLD = 0xFFD700;
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

  Object.assign(YC.MatchUI.prototype, {
    renderLog() {
      if (!this.stage) return;
      const log = this.match.log, n = log.length;
      this.logBind();
      const feed = this.q('.feed');
      feed.innerHTML = log.slice(-2).map((l, k) => this.logLine(l, n - Math.min(2, n) + k, 'p')).join('');
      if (window.gsap && feed.lastChild) window.gsap.fromTo(feed.lastChild, { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 });
      if (this.q('.log-drawer').hidden) return;
      const list = this.q('.log-list');
      let html = '', turn = null;
      log.forEach((l, i) => {
        if (l.turn && l.turn !== turn) { turn = l.turn; html += `<li class="lg-sep">TURNO ${turn} · ${l.turn % 2 ? 'BRANCAS' : 'PRETAS'}</li>`; }
        html += this.logLine(l, i, 'li');
      });
      list.innerHTML = html;
      list.scrollTop = list.scrollHeight;
    },

    toggleLog(open) {
      const d = this.q('.log-drawer');
      d.hidden = open === undefined ? !d.hidden : !open;
      if (!d.hidden) {
        this.renderLog();
        if (window.gsap) window.gsap.fromTo(d, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.6)' });
      } else this.logLeave();
    },

    logLine(l, i, tag) {
      const who = l.team ? `<b class="t-${l.team}">${esc(this.nameOf(l.team))}:</b> ` : '';
      const hot = l.card || l.pieceId != null || l.sq != null;
      const w = tag === 'li' ? this.logWhere(l) : null;
      const where = w ? `<small class="lg-where">📍 ${esc(w.text)}</small>` : '';
      return `<${tag} class="lg${hot ? ' hot' : ''}" data-i="${i}"><span class="lg-ico">${this.logIcon(l)}</span><span class="lg-txt">${who}${esc(l.text)}${where}</span></${tag}>`;
    },

    /** Imagem partilhada numa variável CSS do palco: os data URLs longos não se repetem em cada linha. */
    logArt(key, url) {
      this.logArts = this.logArts || new Set();
      if (!this.logArts.has(key)) { this.logArts.add(key); this.stage.style.setProperty(`--lg-${key}`, `url("${url}")`); }
      return `var(--lg-${key})`;
    },

    logIcon(l) {
      if (l.card) {
        if (!this.logKnown(l)) {
          const back = YC.ART && YC.ART.cardBack;
          return `<i class="lg-card back"${back ? ` style="background-image:${this.logArt('back', YC.asset(back))}"` : ''}></i>`;
        }
        const c = YC.Cards.get(l.card), src = YC.ItemToken && YC.ItemToken.src(c);
        return src ? `<i class="lg-card k-${c.kind} r-${c.rarity}" style="background-image:${this.logArt(c.id, src)},linear-gradient(145deg,var(--frame),var(--frame2))"></i>`
          : `<i class="lg-card k-${c.kind} r-${c.rarity}">${YC.CardArt.svg(c)}</i>`;
      }
      const p = l.move ? { type: l.move.piece, color: l.team } : l.pieceId != null ? this.match.pieceById(l.pieceId) : null;
      if (p) {
        const u = YC.Portraits3D && YC.Portraits3D.url(p.type, p.color);
        const cap = l.move && l.move.capture ? ' cap' : '';
        return u ? `<i class="lg-piece${cap}" style="background-image:${this.logArt(p.type + p.color, u)}"></i>` : `<i class="lg-piece glyph ${p.color}${cap}">${GLYPH[p.type]}</i>`;
      }
      return `<i class="lg-dot t-${l.team || 'x'}"></i>`;
    },

    /** Quem está a ver pode saber que carta foi? As cartas escondidas do adversário só depois de se revelarem. */
    logKnown(l) {
      if (!l.secret || l.team === this.viewer) return true;
      const m = this.match;
      return m.log.some((e) => e !== l && e.uid === l.uid && !e.secret) || m.traps.some((t) => t.uid === l.uid && t.revealed);
    },

    /** Onde está agora aquilo de que a linha fala: { sq?, piece?, text } (ou null). */
    logWhere(l) {
      const m = this.match, N = YC.PIECE_NAME, F = YC.PIECE_FEM;
      const at = (p) => `${F[p.type] ? 'a' : 'o'} ${N[p.type]} em ${SQ(m.sqOf(p))}`;
      if (l.uid) {
        const t = m.traps.find((x) => x.uid === l.uid);
        if (t) return t.owner === this.viewer || t.revealed ? { sq: t.sq, text: `Escondida em ${SQ(t.sq)}` } : null;
        for (const team of ['w', 'b']) {
          if (m.players[team].zone.some((z) => z.inst.uid === l.uid)) return { text: team === this.viewer ? 'Virada na tua Zona' : 'Virada na Zona do adversário' };
        }
      }
      if (l.card && l.pieceId != null && YC.Cards.get(l.card).kind === 'EQUIP') {
        const p = m.pieceById(l.pieceId);
        if (p && p.equips.includes(l.card)) return { sq: m.sqOf(p), piece: p, text: `Está com ${at(p)}` };
        return { text: p ? 'Já não está equipada' : 'A peça que a tinha foi capturada' };
      }
      if (l.pieceId != null) {
        const p = m.pieceById(l.pieceId);
        if (p) return { sq: m.sqOf(p), piece: p, text: `${N[m.realType(p)]} agora em ${SQ(m.sqOf(p))}` };
        if (l.move) return { text: 'Esta peça já foi capturada' };
      }
      if (l.sq != null && (!l.secret || l.team === this.viewer)) return { sq: l.sq, text: `Casa ${SQ(l.sq)}` };
      return null;
    },

    /** "Âncora" da peça para o cartão (PieceInspector): no 3D um retângulo projetado, no CSS o elemento. */
    pieceAnchor(sq) {
      const b = this.board;
      if (b.is3D) {
        const g = b.pieceAtSq(sq), st = (g && g.userData.states) || [];
        return { getBoundingClientRect: () => b.pieceRect(sq), classList: { contains: (k) => st.includes(k) } };
      }
      const p = this.match.pieceAt(sq), el = p && b.el && b.el(p.id);
      return el ? el.querySelector('.stand') || el : null;
    },

    logLeave() {
      this.logHot = null;
      YC.CardZoom.hide();
      if (this.board.dropMark && !this.dragging) this.board.dropMark(-1);
    },

    /** Passar o rato / clicar nas linhas (uma só vez por partida: delegação no feed e na gaveta). */
    logBind() {
      if (this.logBound) return;
      this.logBound = true;
      const feed = this.q('.feed'), list = this.q('.log-list');
      const over = (e) => {
        const row = e.target.closest('[data-i]');
        if (!row || row === this.logHot) return;
        this.logHot = row;
        const l = this.match.log[+row.dataset.i];
        if (!l) return;
        const w = this.logWhere(l);
        const avoid = w && w.sq != null && this.board.rect ? this.board.rect(w.sq) : null;
        if (l.card && this.logKnown(l)) YC.CardZoom.show(row, l.card, { side: 'right', caption: w && w.text, width: 230, avoid });
        else YC.CardZoom.hide();
        if (this.board.dropMark && !this.dragging) this.board.dropMark(w && w.sq != null ? w.sq : -1, GOLD);
      };
      const click = (e) => {
        const row = e.target.closest('[data-i]'), l = row && this.match.log[+row.dataset.i];
        const w = l && this.logWhere(l);
        if (w && w.piece) { YC.CardZoom.hide(); YC.PieceInspector.show(this, w.sq, this.pieceAnchor(w.sq)); }
        else if (e.currentTarget === feed) this.toggleLog(true);
      };
      for (const el of [feed, list]) {
        el.addEventListener('mouseover', over);
        el.addEventListener('mouseleave', () => { this.logLeave(); YC.PieceInspector.hide(); });
        el.addEventListener('click', click);
      }
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
