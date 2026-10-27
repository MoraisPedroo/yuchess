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
      const spec = this.tgtSpec();
      if (spec) {
        const second = this.mode.endsWith('tgt2');
        out[spec.mark === 'trap' && !second ? 'trap' : 'pick'] = second ? spec.second(this.tgtFrom) : spec.first;
        if (second) out.sel = this.tgtFrom;
      }
      return out;
    },

    /** Alvos da carta que está a ser usada (modos tgt1/tgt2 e as respostas r-tgt1/r-tgt2). */
    tgtSpec() {
      if (!this.mode || !this.mode.includes('tgt')) return null;
      const id = this.mode.startsWith('r-') ? this.respondPick && this.respondPick.id : this.selCard && this.selCard.id;
      return id ? YC.CardEffects2.targetSpec(this.match, this.viewer, YC.Cards.get(id)) : null;
    },

    /** Texto de ajuda para escolher o alvo (passo 1 ou 2). */
    tgtHint(def, second) {
      const H = {
        ct_ima_equipamento: ['Escolhe a peça inimiga equipada.', 'Agora a tua peça que recebe o equipamento.'],
        ct_emp_cartoon: ['Escolhe a casa central da explosão.'],
        qs_intimacao_urgente: ['Escolhe a casa vazia a bloquear.'],
        qs_cambalhota_maluca: ['Escolhe a primeira peça a trocar.', 'Agora a peça ao lado com que troca.'],
        qs_cabo_aco_voador: ['Escolhe a peça que vai na tirolesa.', 'Agora a borda para onde desliza.'],
        qs_helicoptero_apoio: ['Escolhe a peça a resgatar.', 'Agora a casa de chegada (1.ª ou 2.ª fila).']
      }[def.id];
      if (H) return H[second ? 1 : 0] || H[0];
      return def.target === 'ENEMY_PIECE' ? 'Escolhe a peça inimiga (as marcadas).' : 'Escolhe a tua peça (as marcadas).';
    },

    /** Clique numa casa durante a escolha de alvo; `done(target)` envia a ação ou a resposta. */
    tgtClick(sq, done) {
      const spec = this.tgtSpec(), def = YC.Cards.get(this.mode.startsWith('r-') ? this.respondPick.id : this.selCard.id);
      if (!spec) return;
      const r = this.mode.startsWith('r-') ? 'r-' : '';
      if (this.mode.endsWith('tgt2')) {
        if (spec.second(this.tgtFrom).includes(sq)) return done({ from: this.tgtFrom, to: sq });
        if (spec.first.includes(sq)) { this.tgtFrom = sq; return this.renderSoft(); }
        return this.toast(this.tgtHint(def, true));
      }
      if (!spec.first.includes(sq)) return this.toast(this.tgtHint(def, false));
      if (!spec.two) return done({ sq });
      this.tgtFrom = sq; this.mode = `${r}tgt2`;
      this.toast(this.tgtHint(def, true));
      return this.renderSoft();
    },

    cardUsable(inst) {
      const m = this.match, def = YC.Cards.get(inst.id), p = m.players[this.viewer];
      if (def.kind === 'EQUIP') return E().equipTargets(m, this.viewer, def).length > 0;
      if (def.kind === 'GRID') return m.traps.filter((t) => t.owner === this.viewer).length < YC.Cards.RULES.MAX_GRID_TRAPS;
      if (def.kind === 'QUICK') return p.zone.length < YC.Cards.RULES.ZONE_SLOTS || E().canActivate(m, this.viewer, def);
      return p.zone.length < YC.Cards.RULES.ZONE_SLOTS;
    },

    cancelMode() {
      this.mode = null; this.selSq = -1; this.selCard = null; this.tgtFrom = -1; this.cardActs = null;
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
      if (def.target) { this.mode = 'tgt1'; this.selCard = inst; this.cardActs = null; this.toast(this.tgtHint(def, false)); this.renderSoft(); return; }
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
      if (this.mode === 'tgt1' || this.mode === 'tgt2') return this.tgtClick(sq, (target) => this.send({ type: 'ACTIVATE', uid: this.selCard.uid, target }));
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
        back.innerHTML = `<div class="modal promo"><h2>Promoção!</h2><p>Em que peça se transforma o Peão?</p><div class="promo-row">${['q', 'r', 'b', 'n'].map((t) => `<button class="promo-btn" data-t="${t}">${YC.pieceHTML(t, this.viewer)}<span>${YC.PIECE_NAME[t]}</span></button>`).join('')}</div></div>`;
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
        this.attachInspect(c, o.id);
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
      this.mode = 'r-tgt1';
      this.toast(this.tgtHint(o.def, false));
      this.renderSoft();
    },

    respondTarget(sq) {
      const o = this.respondPick;
      return this.tgtClick(sq, (target) => this.finishResponse({ uid: o.uid, target }));
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
