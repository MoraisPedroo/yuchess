/* MatchInput.js — interação do jogador humano na partida (acrescenta métodos ao MatchUI):
   selecionar peça → lances; escolher carta → equipar / armar / virar / ativar; promoção;
   janela de resposta da Chain com relógio; agente humano para o Match (e para o lockstep online). */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const E = () => YC.CardEffects;
  const RESPOND_MS = 12000;
  const S = (n) => YC.Sound && YC.Sound.play(n);

  Object.assign(YC.MatchUI.prototype, {
    createHumanAgent(team) {
      return {
        isHuman: true,
        playTurn: (m) => m.waitTurnEnd(),
        respondChain: (ctx) => this.askResponse(ctx)
      };
    },

    markings() {
      const m = this.match, out = { last: this.lastMove };
      if (this.mode === 'piece' && this.selSq >= 0) {
        out.sel = this.selSq;
        out.moves = C().legalMovesFrom(m.pos, this.selSq, { turn: m.state.turnCount });
      }
      const def = this.selCard && YC.Cards.get(this.selCard.id);
      if (this.mode === 'equip' && def) out.equip = E().equipTargets(m, this.viewer, def);
      if (this.mode === 'trap') out.trap = E().trapSquares(m, this.viewer);
      if (this.mode === 'target-sq' || this.mode === 'r-target-sq') out.trap = m.pos.board.map((_, i) => i);
      if (this.mode === 'steal-from' || this.mode === 'r-steal-from') out.pick = [...new Set(E().stealPairs(m, this.viewer).map((p) => p.from))];
      if (this.mode === 'steal-to' || this.mode === 'r-steal-to') out.pick = E().stealPairs(m, this.viewer).filter((p) => p.from === this.stealFrom).map((p) => p.to);
      return out;
    },

    cardUsable(inst) {
      const m = this.match, def = YC.Cards.get(inst.id), p = m.players[this.viewer];
      if (def.kind === 'EQUIP') return E().equipTargets(m, this.viewer, def).length > 0;
      if (def.kind === 'GRID') return m.traps.filter((t) => t.owner === this.viewer).length < YC.Cards.RULES.MAX_GRID_TRAPS;
      if (def.kind === 'QUICK') return p.zone.length < YC.Cards.RULES.ZONE_SLOTS || E().canActivate(m, this.viewer, def);
      return p.zone.length < YC.Cards.RULES.ZONE_SLOTS;
    },

    cancelMode() {
      this.mode = null; this.selSq = -1; this.selCard = null; this.stealFrom = -1; this.cardActs = null;
      if (this.stage) this.renderSoft();
    },

    send(action) {
      const a = { ...action, team: this.viewer };
      this.cancelMode();
      return this.match.dispatch(a);
    },

    // ───────────── cartas ─────────────
    onHandCard(inst) {
      S('click');
      if (this.respondCtx) return this.pickResponse(inst.uid);
      if (!this.myTurn()) return this.toast('Espera pela tua vez.');
      if (this.match.state.actionsLeft <= 0) return this.toast('Já usaste as 2 ações de carta deste turno.');
      if (this.selCard && this.selCard.uid === inst.uid) return this.cancelMode();
      this.cancelMode();
      this.selCard = inst;
      const def = YC.Cards.get(inst.id), p = this.match.players[this.viewer];
      const acts = [];
      if (def.kind === 'EQUIP') { this.mode = 'equip'; if (!this.cardUsable(inst)) this.toast('Nenhuma peça tua pode usar este equipamento.'); }
      else if (def.kind === 'GRID') this.mode = 'trap';
      else {
        this.mode = 'card';
        if (def.kind === 'QUICK' && E().canActivate(this.match, this.viewer, def)) acts.push(['Ativar agora', 'activate']);
        if (p.zone.length < YC.Cards.RULES.ZONE_SLOTS) acts.push(['Virar na Zona', 'set']);
        if (!acts.length) this.toast(def.kind === 'QUICK' ? 'Agora não teria efeito e a Zona está cheia.' : 'A tua Zona de Armadilhas está cheia (3).');
      }
      this.cardActions(acts, inst);
      this.renderSoft();
    },

    /** Botões da carta escolhida (aparecem na barra por cima da mão). */
    cardActions(acts, inst) {
      this.cardActs = acts.map(([label, act]) => [label, act, inst]);
    },

    cardAct(act, inst) {
      const def = YC.Cards.get(inst.id);
      if (act === 'set') return this.send({ type: 'SET_CARD', uid: inst.uid });
      if (def.target === 'SQUARE') { this.mode = 'target-sq'; this.selCard = inst; this.renderSoft(); return; }
      if (def.target === 'STEAL') { this.mode = 'steal-from'; this.selCard = inst; this.renderSoft(); return; }
      return this.send({ type: 'ACTIVATE', uid: inst.uid });
    },

    onZoneCard(z) {
      S('click');
      if (this.respondCtx) return this.pickResponse(z.inst.uid);
      const def = YC.Cards.get(z.inst.id);
      if (!this.myTurn()) return;
      if (def.kind !== 'QUICK') return this.toast('Esta armadilha ativa-se sozinha quando acontece o que diz o texto.');
      if (z.setTurn >= this.match.state.turnCount) return this.toast('Virada neste turno: só podes ativá-la a partir do próximo.');
      if (!E().canActivate(this.match, this.viewer, def)) return this.toast('Agora não teria efeito.');
      this.cancelMode();
      this.selCard = z.inst;
      this.cardAct('activate', z.inst);
    },

    // ───────────── tabuleiro ─────────────
    onSquare(sq) {
      const m = this.match;
      if (this.respondCtx && this.mode && this.mode.startsWith('r-')) return this.respondTarget(sq);
      if (!this.myTurn()) return;
      const piece = m.pieceAt(sq);
      if (this.mode === 'equip') {
        if (E().equipTargets(m, this.viewer, YC.Cards.get(this.selCard.id)).includes(sq)) return this.send({ type: 'EQUIP', uid: this.selCard.uid, sq });
        return this.cancelMode();
      }
      if (this.mode === 'trap') {
        if (E().trapSquares(m, this.viewer).includes(sq)) return this.send({ type: 'SET_TRAP', uid: this.selCard.uid, sq });
        return this.toast('Só em casas vazias das filas 3 a 6.');
      }
      if (this.mode === 'target-sq') return this.send({ type: 'ACTIVATE', uid: this.selCard.uid, target: { sq } });
      if (this.mode === 'steal-from') {
        if (E().stealPairs(m, this.viewer).some((p) => p.from === sq)) { this.stealFrom = sq; this.mode = 'steal-to'; return this.renderSoft(); }
        return this.toast('Escolhe uma peça inimiga com equipamento.');
      }
      if (this.mode === 'steal-to') {
        if (E().stealPairs(m, this.viewer).some((p) => p.from === this.stealFrom && p.to === sq)) return this.send({ type: 'ACTIVATE', uid: this.selCard.uid, target: { from: this.stealFrom, to: sq } });
        return this.toast('Essa peça não pode usar esse equipamento.');
      }
      if (m.state.mustPass) return this.toast('Não tens lances: carrega em "Passar a vez".');
      if (this.mode === 'piece' && this.selSq >= 0) {
        const moves = C().legalMovesFrom(m.pos, this.selSq, { turn: m.state.turnCount }).filter((mv) => mv.to === sq);
        if (moves.length) return this.makeMove(moves);
      }
      if (piece && piece.color === this.viewer) {
        S('click');
        this.cancelMode();
        this.mode = 'piece'; this.selSq = sq;
        const n = C().legalMovesFrom(m.pos, sq, { turn: m.state.turnCount }).length;
        if (!n) this.toast(piece.frozenUntil > m.state.turnCount ? 'Esta peça está congelada.' : 'Esta peça não tem lances.');
        return this.renderSoft();
      }
      this.cancelMode();
    },

    async makeMove(moves) {
      const from = this.selSq, to = moves[0].to;
      const normal = moves.filter((mv) => mv.flag !== 'r');
      const lance = !normal.length;
      let promo;
      if (moves.some((mv) => mv.promo)) promo = await this.pickPromotion();
      if (moves.some((mv) => mv.promo) && !promo) return;
      return this.send({ type: 'MOVE', from, to, promo, lance: lance || undefined });
    },

    pickPromotion() {
      return new Promise((resolve) => {
        const back = document.createElement('div');
        back.className = 'modal-back';
        back.innerHTML = `<div class="modal promo"><h2>Promoção!</h2><p>Em que peça se transforma o Peão?</p><div class="promo-row">${['q', 'r', 'b', 'n'].map((t) => `<button class="promo-btn" data-t="${t}">${YC.PieceArt.svg(t, this.viewer)}<span>${YC.PIECE_NAME[t]}</span></button>`).join('')}</div></div>`;
        document.body.appendChild(back);
        back.querySelectorAll('.promo-btn').forEach((b) => b.onclick = () => { back.remove(); resolve(b.dataset.t); });
        back.onclick = (e) => { if (e.target === back) { back.remove(); resolve(null); } };
      });
    },

    onButton(act) {
      const m = this.match;
      if (act === 'pass') return this.send({ type: 'PASS' });
      if (act === 'cancel') return this.cancelMode();
      if (act === 'speed') {
        YC.FX.speed = YC.FX.speed > YC.FX.NORMAL ? YC.FX.NORMAL : YC.FX.FAST;
        try { localStorage.setItem('chessgioh.speed', YC.FX.speed > YC.FX.NORMAL ? 'fast' : 'normal'); } catch (e) { /* */ }
        this.toast(YC.FX.speed > YC.FX.NORMAL ? 'Animações rápidas.' : 'Animações normais.');
        return this.renderSoft();
      }
      if (act === 'mute') { YC.Sound.setMuted(!YC.Sound.muted); return this.renderSoft(); }
      if (act === 'log') return this.toggleLog();
      if (act === 'forfeit' && this.online) return this.online.claimForfeit();
      if (act === 'exit') {
        if (m.over) return this.onExit();
        return YC.UI.confirm('Sair da partida?', 'Se saíres agora, desistes e perdes a partida.', 'Sair e desistir').then((ok) => {
          if (!ok) return;
          if (!m.over) { if (this.online) this.online.resign(); else m.resign(this.viewer); }
          if (this.pendingResolve) this.finishResponse(null);
          document.querySelectorAll('.end-back').forEach((e) => e.remove());
          this.onExit();
        });
      }
      if (act === 'resign') {
        return YC.UI.confirm('Desistir?', 'Vais perder esta partida.', 'Desistir').then((ok) => {
          if (!ok || m.over) return;
          if (this.online) this.online.resign(); else m.resign(this.viewer);
          if (this.pendingResolve) this.finishResponse(null);
        });
      }
    },

    // ───────────── respostas (Chain) ─────────────
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

    showRespondBar(ctx) {
      const bar = this.q('.respond-bar'), m = this.match;
      let title;
      const cap = (s) => s[0].toUpperCase() + s.slice(1);
      if (ctx.window === 'CAPTURE') { const t = ctx.event.target.type; title = `${cap(YC.yourPiece(t))} vai ser ${YC.PIECE_FEM[t] ? 'capturada' : 'capturado'}!`; }
      else if (ctx.window === 'DESTROYED') title = `Perdeste ${YC.yourPiece(m.realType(ctx.event.piece))}…`;
      else if (ctx.window === 'CHECK') title = 'O teu Rei está em xeque!';
      else title = `${this.nameOf(ctx.top.team)} ativou «${ctx.top.def.name}»`;
      bar.innerHTML = `<div class="rb-head"><b>${title}</b><span>Queres responder com uma carta?</span></div><div class="rb-cards"></div>
        <div class="rb-side"><button class="btn small ghost" data-a="pass">Passar</button><div class="rb-timer"><i></i></div></div>`;
      const cards = bar.querySelector('.rb-cards');
      for (const o of ctx.options) {
        const c = YC.HoloCard.create(o.id, { size: 'sm' });
        c.classList.add('respond');
        c.onclick = () => this.pickResponse(o.uid);
        YC.CardZoom.attach(c, o.id);
        cards.appendChild(c);
      }
      bar.querySelector('[data-a="pass"]').onclick = () => this.finishResponse(null);
      bar.hidden = false;
      YC.FX.fromTo(bar, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
      const fill = bar.querySelector('.rb-timer i'), start = Date.now();
      clearInterval(this.respondTimer);
      this.respondTimer = setInterval(() => {
        const left = 1 - (Date.now() - start) / RESPOND_MS;
        fill.style.transform = `scaleX(${Math.max(0, left)})`;
        if (left <= 0 || m.over) this.finishResponse(null);
      }, 100);
    },

    pickResponse(uid) {
      const ctx = this.respondCtx;
      const o = ctx && ctx.options.find((x) => x.uid === uid);
      if (!o) return;
      if (!o.needsTarget) return this.finishResponse({ uid });
      this.respondPick = o;
      this.mode = o.def.target === 'SQUARE' ? 'r-target-sq' : 'r-steal-from';
      this.toast(o.def.target === 'SQUARE' ? 'Escolhe a casa central.' : 'Escolhe a peça inimiga equipada.');
      this.renderSoft();
    },

    respondTarget(sq) {
      const o = this.respondPick, m = this.match;
      if (this.mode === 'r-target-sq') return this.finishResponse({ uid: o.uid, target: { sq } });
      if (this.mode === 'r-steal-from') {
        if (E().stealPairs(m, this.viewer).some((p) => p.from === sq)) { this.stealFrom = sq; this.mode = 'r-steal-to'; this.renderSoft(); }
        return;
      }
      if (this.mode === 'r-steal-to' && E().stealPairs(m, this.viewer).some((p) => p.from === this.stealFrom && p.to === sq)) {
        this.finishResponse({ uid: o.uid, target: { from: this.stealFrom, to: sq } });
      }
    },

    finishResponse(resp) {
      clearInterval(this.respondTimer);
      YC.CardZoom.hide();
      const resolve = this.pendingResolve;
      this.respondCtx = null; this.pendingResolve = null; this.respondPick = null;
      const bar = this.q('.respond-bar');
      if (bar) bar.hidden = true;
      this.cancelMode();
      if (resolve) resolve(resp);
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
