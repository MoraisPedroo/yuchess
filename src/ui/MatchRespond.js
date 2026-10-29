/* MatchRespond.js — janela de resposta da Chain (acrescenta métodos ao MatchUI): quem ataca o quê fica marcado
   no tabuleiro (seta e anéis vermelhos), o título diz as casas, há 17 s para decidir e a janela pode ser
   minimizada para ver o tabuleiro inteiro (as cartas que podem responder continuam acesas na mão e na Zona). */
(function (YC) {
  'use strict';

  const RESPOND_MS = 17000;
  const S = (n) => YC.Sound && YC.Sound.play(n);
  const sqn = (sq) => (sq >= 0 ? YC.Chess.sqName(sq).toUpperCase() : '');
  const art = (t) => (YC.PIECE_FEM[t] ? 'a' : 'o');

  Object.assign(YC.MatchUI.prototype, {
    askResponse(ctx) {
      return new Promise((resolve) => {
        this.cancelMode();
        this.respondCtx = ctx;
        this.pendingResolve = resolve;
        this.showRespondBar(ctx);
        this.renderSoft();
        S('check');
      });
    },

    /** O que está em jogo nesta janela: título, explicação e as casas a marcar (de onde → para onde). */
    respondInfo(ctx) {
      const m = this.match, ev = ctx.event, P = (t) => YC.PIECE_NAME[t];
      const cap = (s) => s[0].toUpperCase() + s.slice(1);
      if (ctx.window === 'CAPTURE') {
        const t = m.realType(ev.target), a = ev.attacker, from = m.sqOf(a), to = m.sqOf(ev.target);
        return { title: `${cap(YC.yourPiece(t))} vai ser ${YC.PIECE_FEM[t] ? 'capturada' : 'capturado'}!`,
          sub: `${cap(art(a.type))} ${P(a.type)} inimig${art(a.type)} em ${sqn(from)} ataca ${art(t)} ${YC.PIECE_FEM[t] ? 'tua' : 'teu'} ${P(t)} em ${sqn(to)}.`, pairs: [{ from, to }] };
      }
      if (ctx.window === 'CHECK') {
        const pairs = ev.checkers.map((c) => ({ from: m.sqOf(c), to: ev.kingSq }));
        const who = ev.checkers.map((c) => `${P(c.type)} em ${sqn(m.sqOf(c))}`).join(' e ');
        return { title: 'O teu Rei está em xeque!', sub: `Xeque de: ${who}.`, pairs };
      }
      if (ctx.window === 'DESTROYED') {
        const t = m.realType(ev.piece), by = ev.by && m.sqOf(ev.by) >= 0 ? ev.by : null;
        return { title: `Perdeste ${YC.yourPiece(t)}…`, sub: by ? `Capturad${art(t)} pel${art(by.type)} ${P(by.type)} em ${sqn(m.sqOf(by))}.` : `Destruíd${art(t)} em ${sqn(ev.sq)}.`,
          pairs: [{ from: by ? m.sqOf(by) : -1, to: by ? m.sqOf(by) : ev.sq }] };
      }
      const top = ctx.top, tg = top.target || {}, pairs = [];
      let sub = '';
      if (top.kind === 'EQUIP') { const p = m.pieceById(tg.pieceId); if (p) { pairs.push({ from: -1, to: m.sqOf(p) }); sub = `Vai para ${art(p.type)} ${P(p.type)} em ${sqn(m.sqOf(p))}.`; } }
      else if (top.kind === 'GRID' && top.event && top.event.piece) { const s = m.sqOf(top.event.piece); pairs.push({ from: -1, to: s }); sub = `Apanhou ${art(top.event.piece.type)} ${P(top.event.piece.type)} em ${sqn(s)}.`; }
      else if (tg.from != null) { pairs.push({ from: tg.from, to: tg.to }); sub = `Alvo: ${sqn(tg.from)} → ${sqn(tg.to)}.`; }
      else if (tg.sq != null) { pairs.push({ from: -1, to: tg.sq }); sub = `Alvo: ${sqn(tg.sq)}.`; }
      return { title: `${this.nameOf(top.team)} ativou «${top.def.name}»`, sub, pairs };
    },

    showRespondBar(ctx) {
      const bar = this.q('.respond-bar'), m = this.match, info = this.respondInfo(ctx);
      bar.classList.remove('mini');
      bar.style.bottom = '';
      bar.innerHTML = `<div class="rb-head"><b>${info.title}</b><span class="rb-sub">${info.sub}</span><span>Queres responder com uma carta?</span></div><div class="rb-cards"></div>
        <div class="rb-side"><button class="btn small ghost" data-a="pass">Passar</button><div class="rb-timer"><i></i></div><em class="rb-secs"></em></div>
        <button class="icon-btn rb-min" title="Minimizar para ver o tabuleiro" aria-label="Minimizar">${YC.Icon('chevron', { size: 20 })}</button>`;
      const cards = bar.querySelector('.rb-cards');
      for (const o of ctx.options) {
        const c = YC.HoloCard.create(o.id, { size: 'sm' });
        c.classList.add('respond');
        c.onclick = () => this.pickResponse(o.uid);
        this.attachInspect(c, o.id);
        cards.appendChild(c);
      }
      bar.querySelector('[data-a="pass"]').onclick = (e) => { e.stopPropagation(); this.finishResponse(null); };
      bar.querySelector('.rb-min').onclick = (e) => { e.stopPropagation(); this.toggleRespondBar(); };
      bar.onclick = () => { if (bar.classList.contains('mini')) this.toggleRespondBar(false); };
      bar.hidden = false;
      this.showThreat(info.pairs);
      this.placeRespondBar(info.pairs);
      YC.FX.fromTo(bar, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
      const fill = bar.querySelector('.rb-timer i'), secs = bar.querySelector('.rb-secs'), start = Date.now();
      clearInterval(this.respondTimer);
      this.respondTimer = setInterval(() => {
        const left = 1 - (Date.now() - start) / RESPOND_MS;
        fill.style.transform = `scaleX(${Math.max(0, left)})`;
        secs.textContent = `${Math.max(0, Math.ceil(left * RESPOND_MS / 1000))} s`;
        if (left <= 0 || m.over) this.finishResponse(null);
      }, 100);
    },

    /** A janela não tapa as casas em jogo: desce para cima da mão e, se ainda tapar, minimiza-se. */
    placeRespondBar(pairs) {
      const bar = this.q('.respond-bar'), board = this.board;
      if (!board.rect) return;
      const rects = pairs.flatMap((p) => [p.from, p.to]).filter((s) => s >= 0).map((s) => board.rect(s));
      const hits = () => { const r = bar.getBoundingClientRect(); return rects.some((q) => q && r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top); };
      if (!hits()) return;
      bar.style.bottom = '8px';
      if (hits()) this.toggleRespondBar(true);
    },

    toggleRespondBar(force) {
      const bar = this.q('.respond-bar');
      const mini = force == null ? !bar.classList.contains('mini') : force;
      bar.classList.toggle('mini', mini);
      bar.querySelector('.rb-min').title = mini ? 'Abrir a resposta' : 'Minimizar para ver o tabuleiro';
    },

    /** Seta e anéis no tabuleiro (3D ou CSS) a mostrar de onde vem o ataque. */
    showThreat(pairs) { if (this.board.showThreat) this.board.showThreat(pairs.filter((p) => p.to >= 0)); },
    clearThreat() { if (this.board.clearThreat) this.board.clearThreat(); },

    pickResponse(uid) {
      const ctx = this.respondCtx;
      const o = ctx && ctx.options.find((x) => x.uid === uid);
      if (!o) return;
      if (!o.needsTarget) return this.finishResponse({ uid });
      this.respondPick = o;
      this.mode = 'r-tgt1';
      this.toggleRespondBar(true);
      this.renderSoft();
    },

    respondTarget(sq) {
      const o = this.respondPick;
      return this.tgtClick(sq, (target) => this.finishResponse({ uid: o.uid, target }));
    },

    finishResponse(resp) {
      clearInterval(this.respondTimer);
      YC.CardZoom.hide();
      this.clearThreat();
      const resolve = this.pendingResolve;
      this.respondCtx = null; this.pendingResolve = null; this.respondPick = null;
      const bar = this.q('.respond-bar');
      if (bar) { bar.hidden = true; bar.classList.remove('mini'); }
      this.cancelMode();
      if (resolve) resolve(resp);
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
