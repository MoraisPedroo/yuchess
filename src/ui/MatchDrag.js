/* MatchDrag.js — arrastar cartas da mão para o tabuleiro (estilo Hearthstone), acrescenta métodos ao MatchUI.
   A carta-fantasma segue o ponteiro, inclina com a velocidade, encolhe por cima do tabuleiro e brilha a verde
   (alvo válido) ou vermelho. Ao largar: Equipamento numa peça → EQUIP; Armadilha de Casa numa casa → SET_TRAP;
   Reativa/Counter na Zona (ou no tabuleiro) → SET_CARD; Magia Rápida no tabuleiro → ACTIVATE (com alvo se
   precisar) ou na Zona → SET_CARD. Alvo inválido: a carta volta para a mão. Clicar continua a funcionar. */
(function (YC) {
  'use strict';

  const E = () => YC.CardEffects;
  const G = () => window.gsap;
  const START_PX = 8;
  const HINT = {
    EQUIP: 'Larga a carta numa peça tua que brilhe.',
    GRID: 'Larga a carta numa casa vazia das filas 3 a 6.',
    REACTIVE: 'Larga a carta na tua Zona de Armadilhas.',
    COUNTER: 'Larga a carta na tua Zona de Armadilhas.',
    QUICK: 'Larga no tabuleiro para ativar, ou na Zona para guardar.'
  };

  Object.assign(YC.MatchUI.prototype, {
    attachDrag(el, inst) {
      el.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || this.respondCtx || !this.myTurn() || this.match.state.actionsLeft <= 0) return;
        const sx = e.clientX, sy = e.clientY;
        const move = (ev) => {
          if (!this.drag && Math.hypot(ev.clientX - sx, ev.clientY - sy) > START_PX) this.dragStart(el, inst, ev);
          if (this.drag) this.dragMove(ev);
        };
        const up = (ev) => {
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerup', up);
          window.removeEventListener('pointercancel', up);
          if (this.drag) this.dragEnd(ev);
        };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
      });
    },

    dragStart(el, inst, e) {
      YC.CardZoom.hide();
      YC.PieceInspector.hide();
      const def = YC.Cards.get(inst.id);
      // marca os alvos no tabuleiro como se a carta tivesse sido clicada
      this.cancelMode();
      this.selCard = inst;
      this.mode = def.kind === 'EQUIP' ? 'equip' : def.kind === 'GRID' ? 'trap'
        : def.kind === 'QUICK' && def.target === 'SQUARE' ? 'target-sq' : def.kind === 'QUICK' && def.target === 'STEAL' ? 'steal-from' : 'card';
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      const card = YC.HoloCard.create(inst.id, { size: 'md', static: true });
      card.style.setProperty('--cw', '128px');
      ghost.appendChild(card);
      document.body.appendChild(ghost);
      this.drag = { el, inst, def, ghost, lx: e.clientX, rot: 0, over: false, ok: null };
      el.classList.add('dragging');
      this.dragging = true;
      this.renderSoft();
      if (YC.Sound) YC.Sound.play('card_flip');
      const g = G();
      if (g) {
        g.set(ghost, { x: e.clientX, y: e.clientY, xPercent: -50, yPercent: -58, scale: 1.25 });
        g.to(ghost, { scale: 1, duration: 0.2, ease: 'power2.out' });
        this.drag.qx = g.quickTo(ghost, 'x', { duration: 0.1, ease: 'power3' });
        this.drag.qy = g.quickTo(ghost, 'y', { duration: 0.1, ease: 'power3' });
      }
    },

    dragMove(e) {
      const d = this.drag, g = G();
      if (d.qx) { d.qx(e.clientX); d.qy(e.clientY); } else d.ghost.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -58%)`;
      // inclina para o lado do movimento
      d.rot = Math.max(-24, Math.min(24, d.rot * 0.6 + (e.clientX - d.lx) * 0.9));
      d.lx = e.clientX;
      const t = this.dropTarget(e), over = !!t;
      const act = this.dropAction(d.inst, t);
      const ok = act ? 'ok' : over ? 'bad' : null;
      if (g) {
        g.to(d.ghost, { rotation: d.rot, duration: 0.25, ease: 'power2.out', overwrite: 'auto' });
        if (over !== d.over) g.to(d.ghost, { scale: over ? 0.6 : 1, opacity: over ? 0.92 : 1, duration: 0.2, ease: 'power2.out' });
      }
      d.over = over;
      if (ok !== d.ok) { d.ghost.classList.toggle('ok', ok === 'ok'); d.ghost.classList.toggle('bad', ok === 'bad'); d.ok = ok; }
      const sq = t && (t.kind === 'square' || t.kind === 'piece') ? t.sq : -1;
      if (this.board.dropMark) this.board.dropMark(sq, !!act);
    },

    async dragEnd(e) {
      const d = this.drag, g = G();
      this.drag = null;
      this.dragging = false;
      this.dragJustEnded = true;
      setTimeout(() => { this.dragJustEnded = false; }, 250);
      if (this.board.dropMark) this.board.dropMark(-1);
      const act = this.dropAction(d.inst, this.dropTarget(e));
      if (act && act.steal != null) {
        // Íman: a peça de onde se rouba já está escolhida; falta a tua peça que recebe
        d.ghost.remove(); d.el.classList.remove('dragging');
        this.selCard = d.inst; this.stealFrom = act.steal; this.mode = 'steal-to';
        this.renderSoft();
        return this.toast('Agora escolhe a tua peça que recebe o equipamento.');
      }
      if (act) {
        const r = d.ghost.firstChild.getBoundingClientRect();
        this.dropRects.set(d.inst.uid, { rect: { left: r.left, top: r.top, width: r.width, height: r.height }, t: performance.now() });
        if (g) g.to(d.ghost, { scale: 0.2, opacity: 0, duration: 0.18, ease: 'power2.in', onComplete: () => d.ghost.remove() }); else d.ghost.remove();
        setTimeout(() => d.el.classList.remove('dragging'), 400);
        return this.send(act);
      }
      // volta para a mão
      if (YC.Sound) YC.Sound.play('error');
      this.cancelMode();
      const home = d.el.getBoundingClientRect();
      if (g) {
        await new Promise((res) => g.to(d.ghost, { x: home.left + home.width / 2, y: home.top + home.height * 0.58, rotation: 0, scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.4)', onComplete: res }));
      }
      d.ghost.remove();
      d.el.classList.remove('dragging');
    },

    /** O que está por baixo do ponteiro: casa/peça do tabuleiro ou a tua Zona. */
    dropTarget(e) {
      if (this.board.is3D) {
        const r = this.board.canvas.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return null;
        let t = this.board.target(e);
        if (t && t.kind === 'trap') t = { kind: 'square', sq: t.sq };
        return t && (t.kind === 'square' || t.kind === 'piece' || (t.kind === 'zone' && t.rel === 'me')) ? t : null;
      }
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      if (!hit) return null;
      const z = hit.closest('.zone');
      if (z && z.dataset.team === this.viewer) return { kind: 'zone', rel: 'me' };
      const s = hit.closest('[data-sq]');
      return s && this.board.wrap.contains(s) ? { kind: 'square', sq: Number(s.dataset.sq) } : null;
    },

    /** Ação de jogo que largar a carta neste alvo faria (null = alvo inválido). */
    dropAction(inst, t) {
      if (!t) return null;
      const m = this.match, def = YC.Cards.get(inst.id), me = this.viewer;
      const sq = t.kind === 'square' || t.kind === 'piece' ? t.sq : -1;
      const canSet = m.players[me].zone.length < YC.Cards.RULES.ZONE_SLOTS;
      if (def.kind === 'EQUIP') return sq >= 0 && E().equipTargets(m, me, def).includes(sq) ? { type: 'EQUIP', uid: inst.uid, sq } : null;
      if (def.kind === 'GRID') return sq >= 0 && E().trapSquares(m, me).includes(sq) ? { type: 'SET_TRAP', uid: inst.uid, sq } : null;
      if (t.kind === 'zone') return canSet ? { type: 'SET_CARD', uid: inst.uid } : null;
      if (def.kind !== 'QUICK') return canSet ? { type: 'SET_CARD', uid: inst.uid } : null;
      if (!E().canActivate(m, me, def)) return null;
      if (def.target === 'SQUARE') return { type: 'ACTIVATE', uid: inst.uid, target: { sq } };
      if (def.target === 'STEAL') return E().stealPairs(m, me).some((p) => p.from === sq) ? { steal: sq } : null;
      return { type: 'ACTIVATE', uid: inst.uid };
    },

    dragHint() { return this.dragging && this.selCard ? HINT[YC.Cards.get(this.selCard.id).kind] : ''; }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
