/* MatchDrag.js — arrastar cartas da mão para o tabuleiro (estilo Hearthstone), acrescenta métodos ao MatchUI.
   A carta segue o rato com uma mola (um só ciclo por fotograma, inclinação pela velocidade, sem tweens por evento).
   Ao afastar-se da mão a ilustração "sai" da carta e vira o objeto (a bomba fica uma bombinha, as botas um item
   a flutuar), com uma etiqueta que diz o que fazer, verde (alvo válido) ou vermelha (porquê não). Ao largar:
   Equipamento numa peça → EQUIP; Armadilha de Casa numa casa → SET_TRAP (o objeto cai na casa); Reativa/Counter
   na Zona (ou no tabuleiro) → SET_CARD; Magia Rápida no tabuleiro → ACTIVATE ou na Zona → SET_CARD. Alvo
   inválido: volta à mão. */
(function (YC) {
  'use strict';

  const E = () => YC.CardEffects;
  const G = () => window.gsap;
  const START_PX = 8;
  const CARD_W = 128;      // largura da carta arrastada
  const CARD_CY = -14;     // centro da carta em relação ao ponteiro (o ponteiro fica um pouco abaixo do meio)
  const ITEM_S0 = 0.62;    // o objeto nasce do tamanho do desenho dentro da carta
  const SQ = (sq) => YC.Chess.sqName(sq).toUpperCase();
  const clamp = (v, a) => (v > a ? a : v < -a ? -a : v);
  const follow = (k, dt) => 1 - Math.exp(-k * dt);   // suavização igual a 30, 60 ou 144 fps
  const HINT = {
    EQUIP: 'Larga o objeto numa peça tua que brilhe.',
    GRID: 'Larga o objeto numa casa vazia das filas 3 a 6.',
    REACTIVE: 'Larga a carta na tua Zona de Armadilhas.',
    COUNTER: 'Larga a carta na tua Zona de Armadilhas.',
    QUICK: 'Larga no tabuleiro para ativar, ou na Zona para guardar.'
  };
  // estas viram objeto ao sair da mão; Reativas e Counter-Traps continuam carta (vão viradas para a Zona)
  const MORPH = { EQUIP: true, GRID: true, QUICK: true };

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
      const def = YC.Cards.get(inst.id), g = G();
      // marca os alvos no tabuleiro como se a carta tivesse sido clicada
      this.cancelMode();
      this.selCard = inst;
      this.mode = def.kind === 'EQUIP' ? 'equip' : def.kind === 'GRID' ? 'trap'
        : def.kind === 'QUICK' && def.target === 'SQUARE' ? 'target-sq' : def.kind === 'QUICK' && def.target === 'STEAL' ? 'steal-from' : 'card';
      // parte da carta tal como está desenhada na mão (talvez ampliada)
      const r0 = (el.querySelector('.hc-tilt') || el).getBoundingClientRect();
      const ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.innerHTML = '<div class="dg-card"><div class="dg-tilt"></div></div><div class="dg-label"></div>';
      const cardWrap = ghost.firstChild, tilt = cardWrap.firstChild, label = ghost.lastChild;
      const card = YC.HoloCard.create(inst.id, { size: 'md', static: true });
      card.style.setProperty('--cw', `${CARD_W}px`);
      tilt.appendChild(card);
      let item = null, sway = null;
      if (MORPH[def.kind]) {
        item = document.createElement('div');
        item.className = 'dg-item';
        sway = document.createElement('div');
        sway.className = 'dg-sway';
        sway.appendChild(YC.ItemToken.create(def, { size: 92 }));
        item.appendChild(sway);
        ghost.insertBefore(item, label);
      }
      document.body.appendChild(ghost);
      const row = this.q('.hand-row').getBoundingClientRect();
      const x = r0.left + r0.width / 2, y = r0.top + r0.height / 2 - CARD_CY;
      this.drag = { el, inst, def, ghost, cardWrap, tilt, item, sway, label, form: 'card', handTop: row.top,
        px: e.clientX, py: e.clientY, ev: e, x, y, vx: 0, vy: 0, t: performance.now(), dirty: true, over: false, ok: null, lkey: '', left: false };
      el.classList.add('dragging');
      this.dragging = true;
      this.renderSoft();
      if (YC.Sound) YC.Sound.play('card_flip');
      ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (g) {
        g.fromTo(cardWrap, { scale: r0.width / CARD_W }, { scale: 1, duration: 0.32, ease: 'power3.out' });
        if (item) g.set(item, { scale: ITEM_S0, opacity: 0 });
        g.set(label, { opacity: 0 });
      } else if (item) item.style.opacity = 0;
      this.dragLoop(this.drag);
    },

    /** O rato só guarda a posição; o ciclo dragLoop desenha uma vez por fotograma. */
    dragMove(e) {
      const d = this.drag;
      d.px = e.clientX; d.py = e.clientY; d.ev = e; d.dirty = true;
    },

    dragLoop(d) {
      const step = (now) => {
        if (this.drag !== d) return;
        const dt = Math.min(0.05, Math.max(0.001, (now - d.t) / 1000));
        d.t = now;
        // mola: a carta corre atrás do ponteiro; a velocidade (suavizada) dá a inclinação
        const k = follow(24, dt), nx = d.x + (d.px - d.x) * k, ny = d.y + (d.py - d.y) * k, kv = follow(8, dt);
        d.vx += ((nx - d.x) / dt - d.vx) * kv;
        d.vy += ((ny - d.y) / dt - d.vy) * kv;
        d.x = nx; d.y = ny;
        d.ghost.style.transform = `translate3d(${nx.toFixed(1)}px, ${ny.toFixed(1)}px, 0)`;
        d.tilt.style.transform = `rotateX(${clamp(-d.vy * 0.012, 16).toFixed(2)}deg) rotateY(${clamp(d.vx * 0.014, 18).toFixed(2)}deg) rotate(${clamp(d.vx * 0.007, 10).toFixed(2)}deg)`;
        if (d.sway) d.sway.style.transform = `rotate(${clamp(-d.vx * 0.012, 14).toFixed(2)}deg)`;
        if (d.dirty) { d.dirty = false; this.dragUpdate(d); }
        d.raf = requestAnimationFrame(step);
      };
      d.raf = requestAnimationFrame(step);
    },

    /** Alvo por baixo do ponteiro, forma (carta/objeto), cores e etiqueta. Corre no máximo uma vez por fotograma. */
    dragUpdate(d) {
      const g = G(), t = this.dropTarget(d.ev), over = !!t, act = this.dropAction(d.inst, t);
      // por cima do tabuleiro (ou bem acima da mão) vira objeto; só volta a carta quando regressa à mão
      if (d.item) {
        let form = d.form;
        if (over || d.py < d.handTop - 56) form = 'item';
        else if (d.py > d.handTop - 8) form = 'card';
        if (form !== d.form) this.dragMorph(d, form);
      } else if (g && over !== d.over) g.to(d.cardWrap, { scale: over ? 0.62 : 1, duration: 0.28, ease: 'power3.out', overwrite: 'auto' });
      d.over = over;
      const ok = act ? 'ok' : over ? 'bad' : null;
      if (ok !== d.ok) { d.ghost.classList.toggle('ok', ok === 'ok'); d.ghost.classList.toggle('bad', ok === 'bad'); d.ok = ok; }
      const left = d.px > innerWidth - 320;
      if (left !== d.left) { d.left = left; d.label.classList.toggle('left', left); }
      this.dragLabel(d, t, act, d.form === 'item' || over);
      const sq = t && (t.kind === 'square' || t.kind === 'piece') ? t.sq : -1;
      if (sq !== d.markSq || !!act !== d.markOk) { d.markSq = sq; d.markOk = !!act; if (this.board.dropMark) this.board.dropMark(sq, !!act); }
    },

    /** Carta ↔ objeto: a moldura encolhe para o desenho e o objeto sai dele (e o contrário), sem ressaltos. */
    dragMorph(d, form) {
      const g = G(), toItem = form === 'item';
      d.form = form;
      YC.ItemToken.puff(d.ghost, d.def.theme.primary, 0, -38);
      if (YC.Sound) YC.Sound.play(toItem ? 'magic_zap' : 'card_flip');
      if (!g) { d.cardWrap.style.opacity = toItem ? 0 : 1; d.item.style.opacity = toItem ? 1 : 0; return; }
      g.killTweensOf([d.cardWrap, d.item]);
      const [out, inn, s0] = toItem ? [d.cardWrap, d.item, ITEM_S0] : [d.item, d.cardWrap, 0.5];
      g.to(out, { scale: toItem ? 0.42 : ITEM_S0, duration: 0.26, ease: 'power2.in' });
      g.to(out, { opacity: 0, duration: 0.2, delay: 0.06, ease: 'none' });
      g.fromTo(inn, { scale: s0 }, { scale: 1, duration: 0.36, ease: 'power3.out' });
      g.fromTo(inn, { opacity: 0 }, { opacity: 1, duration: 0.16, ease: 'none' });
    },

    /** Etiqueta ao lado do objeto: o que fazer, onde vai cair ou porque não dá. */
    dragLabel(d, t, act, show) {
      const g = G();
      const sq = t && (t.kind === 'square' || t.kind === 'piece') ? t.sq : -1;
      const state = !t ? 'idle' : act ? 'ok' : 'bad';
      const text = state === 'idle' ? this.dragIdleText(d.def) : state === 'ok' ? this.dragOkText(d.def, act, sq) : this.dragWhyNot(d.def, t, sq);
      const key = `${show}|${state}|${text}`;
      if (key === d.lkey) return;
      const wasShown = d.lkey.startsWith('true');
      d.lkey = key;
      d.label.className = `dg-label ${state}${d.left ? ' left' : ''}`;
      d.label.innerHTML = `<b>${YC.HoloCard.esc(d.def.name)}</b><span>${text}</span>`;
      if (!g) { d.label.style.opacity = show ? 1 : 0; return; }
      if (show !== wasShown) g.to(d.label, { opacity: show ? 1 : 0, x: show ? 0 : -6, duration: 0.2, ease: 'power2.out', overwrite: 'auto' });
    },

    dragIdleText(def) {
      if (def.kind === 'GRID') return 'Posiciona numa casa vazia (filas 3 a 6). Fica escondida do adversário.';
      if (def.kind === 'EQUIP') return `Equipa ${this.equipWho(def)}.`;
      if (def.kind === 'QUICK') return def.target === 'SQUARE' ? 'Larga na casa central da explosão.' : def.target === 'STEAL' ? 'Larga na peça inimiga equipada.' : 'Larga no tabuleiro para ativar, ou na Zona para guardar.';
      return 'Larga na tua Zona de Armadilhas: fica virada para baixo.';
    },

    /** "num Peão teu", "numa Torre tua" ou "numa peça tua", conforme as peças que podem usar o equipamento. */
    equipWho(def) {
      const m = this.match, types = [...new Set(E().equipTargets(m, this.viewer, def).map((sq) => m.pieceAt(sq).type))];
      if (!types.length) return 'uma peça tua (agora nenhuma pode)';
      if (types.length > 1) return 'numa peça tua';
      const f = YC.PIECE_FEM[types[0]];
      return `${f ? 'numa' : 'num'} ${YC.PIECE_NAME[types[0]]} ${f ? 'tua' : 'teu'}`;
    },

    dragOkText(def, act, sq) {
      if (act.steal != null) return `Roubar o equipamento da peça em ${SQ(sq)}.`;
      if (act.type === 'SET_TRAP') return `Esconder em ${SQ(sq)}.`;
      if (act.type === 'EQUIP') { const p = this.match.pieceAt(sq), f = YC.PIECE_FEM[p.type]; return `Equipar ${f ? 'a' : 'o'} ${YC.PIECE_NAME[p.type]} em ${SQ(sq)}.`; }
      if (act.type === 'SET_CARD') return 'Virar na tua Zona.';
      if (act.target && act.target.sq != null) return `Explodir em ${SQ(sq)}.`;
      return 'Ativar agora.';
    },

    dragWhyNot(def, t, sq) {
      const m = this.match, me = this.viewer, p = sq >= 0 ? m.pieceAt(sq) : null;
      if (t.kind === 'zone' && (def.kind === 'EQUIP' || def.kind === 'GRID')) return 'Este objeto vai para o tabuleiro, não para a Zona.';
      if (t.kind === 'zone' || (def.kind !== 'EQUIP' && def.kind !== 'GRID' && def.kind !== 'QUICK')) return 'A tua Zona está cheia (3 cartas).';
      if (def.kind === 'GRID') {
        if (p) return 'Casa ocupada: escolhe uma vazia.';
        const rank = 8 - (sq >> 3);
        if (rank < 3 || rank > 6) return 'Só nas filas 3 a 6.';
        if (m.trapAt(sq, me)) return 'Já tens uma armadilha aqui.';
        return 'Aqui não dá.';
      }
      if (def.kind === 'EQUIP') {
        if (!p) return 'Larga em cima de uma peça tua.';
        if (p.color !== me) return 'Só nas tuas peças.';
        return `${YC.PIECE_FEM[p.type] ? 'Esta' : 'Este'} ${YC.PIECE_NAME[p.type]} não pode usar isto.`;
      }
      if (!E().canActivate(m, me, def)) return 'Agora não teria efeito.';
      return def.target === 'STEAL' ? 'Escolhe uma peça inimiga com equipamento.' : 'Aqui não dá.';
    },

    async dragEnd(e) {
      const d = this.drag, g = G();
      this.drag = null;
      cancelAnimationFrame(d.raf);
      this.dragging = false;
      this.dragJustEnded = true;
      setTimeout(() => { this.dragJustEnded = false; }, 250);
      if (this.board.dropMark) this.board.dropMark(-1);
      // a partir daqui o GSAP anima o fantasma: parte de onde a mola o deixou
      if (g) { g.set(d.ghost, { x: d.x, y: d.y }); g.to([d.tilt, d.sway].filter(Boolean), { rotationX: 0, rotationY: 0, rotation: 0, duration: 0.3, ease: 'power2.out' }); }
      const act = this.dropAction(d.inst, this.dropTarget(e));
      if (act && act.steal != null) {
        // Íman: a peça de onde se rouba já está escolhida; falta a tua peça que recebe
        d.ghost.remove(); d.el.classList.remove('dragging');
        this.selCard = d.inst; this.stealFrom = act.steal; this.mode = 'steal-to';
        this.renderSoft();
        return this.toast('Agora escolhe a tua peça que recebe o equipamento.');
      }
      if (act) {
        const vis = d.form === 'item' ? d.item : d.cardWrap.querySelector('.hcard'), r = vis.getBoundingClientRect();
        this.dropRects.set(d.inst.uid, { rect: { left: r.left, top: r.top, width: r.width, height: r.height }, t: performance.now() });
        if (g) g.to(d.label, { opacity: 0, duration: 0.12 });
        if (act.type === 'SET_TRAP' && d.form === 'item' && this.board.is3D) {
          // o objeto fica no ecrã: a animação de armar (Anim3DCards.trapSet) fá-lo cair na casa
          this.dropTokens = this.dropTokens || new Map();
          this.dropTokens.set(d.inst.uid, d.ghost);
          setTimeout(() => { if (this.dropTokens.get(d.inst.uid) === d.ghost) { this.dropTokens.delete(d.inst.uid); d.ghost.remove(); } }, 6000);
        } else if (g) g.to(d.ghost, { scale: 0.2, opacity: 0, duration: 0.2, ease: 'power2.in', onComplete: () => d.ghost.remove() });
        else d.ghost.remove();
        setTimeout(() => d.el.classList.remove('dragging'), 400);
        return this.send(act);
      }
      // volta para a mão (outra vez em forma de carta)
      if (YC.Sound) YC.Sound.play('error');
      this.cancelMode();
      if (d.form === 'item') this.dragMorph(d, 'card');
      if (g) g.to(d.label, { opacity: 0, duration: 0.12 });
      const home = d.el.getBoundingClientRect();
      if (g) {
        await new Promise((res) => g.to(d.ghost, { x: home.left + home.width / 2, y: home.top + home.height / 2 - CARD_CY, duration: 0.4, ease: 'power3.out', onComplete: res }));
      }
      d.ghost.remove();
      d.el.classList.remove('dragging');
    },

    /** O objeto largado numa casa (a animação de armar pega nele; null se não houver). */
    takeDropToken(uid) {
      const t = this.dropTokens && this.dropTokens.get(uid);
      if (t) this.dropTokens.delete(uid);
      return t || null;
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
