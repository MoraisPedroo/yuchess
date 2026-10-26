/* MatchUI.js — ecrã da partida: painéis dos jogadores (mão, baralho, Zona de Armadilhas), tabuleiro,
   pilha da Chain, inspetor de cartas, registo de lances e ecrã final. A interação está em MatchInput.js. */
(function (YC) {
  'use strict';

  const H = () => YC.HoloCard;
  const esc = (s) => YC.HoloCard.esc(s);

  class MatchUI {
    constructor({ root, onExit }) {
      this.root = root;
      this.onExit = onExit || (() => {});
      this.hideHand = new Set();
      this.handEls = new Map();
      this.chainEls = new Map();
      this.mode = null;
      this.selSq = -1;
      this.selCard = null;
      this.lastMove = null;
    }

    /** Monta o ecrã para uma partida. opts: { match, viewer, bus, label: {w,b}, online, level } */
    mount({ match, viewer, labels = {}, online = null, level = null }) {
      this.match = match; this.bus = match.bus; this.viewer = viewer; this.labels = labels; this.online = online; this.level = level;
      this.root.innerHTML = `
        <div id="match-stage" class="match">
          <aside class="m-left">
            <section class="pcard opp" data-team="${YC.other(viewer)}"></section>
            <section class="panel m-log"><h3>Registo</h3><ol class="log-list"></ol></section>
            <section class="pcard me" data-team="${viewer}"></section>
          </aside>
          <section class="m-center">
            <div class="board-host"></div>
            <div class="m-hand"><div class="hand-row"></div></div>
          </section>
          <aside class="m-right">
            <section class="panel m-phase"></section>
            <section class="panel m-inspect"><div class="insp-card"></div><div class="insp-actions"></div></section>
            <section class="panel m-chain" hidden><h3>Chain</h3><div class="chain-list"></div></section>
          </aside>
          <div class="respond-bar" hidden></div>
          <div class="chain-stage"></div>
        </div>`;
      this.stage = this.root.querySelector('#match-stage');
      this.q = (sel) => this.stage.querySelector(sel);
      this.board = new YC.BoardView(this.q('.board-host'), { onSquare: (sq) => this.onSquare(sq) });
      this.board.setFlipped(viewer === 'b');
      this.animator = new YC.MatchAnimator({ bus: this.bus, board: this.board, ui: this });
      this.offs = [
        this.bus.on('state:changed', () => this.renderSoft()),
        this.bus.on('log', () => this.renderLog()),
        this.bus.on('ui:invalid', ({ message }) => { if (YC.Sound) YC.Sound.play('error'); this.toast(message, true); }),
        this.bus.on('piece:move', ({ move }) => { this.lastMove = { from: move.from, to: move.to }; }),
        this.bus.on('game:over', (p) => setTimeout(() => this.showEnd(p), 900))
      ];
      this.board.sync(match, { viewer });
      this.renderSoft();
      this.inspect(null);
    }

    unmount() {
      (this.offs || []).forEach((off) => off());
      if (this.animator) this.animator.dispose();
      if (this.respondTimer) clearInterval(this.respondTimer);
      this.root.innerHTML = '';
    }

    isSpectator() { return !this.viewer; }
    nameOf(team) { return this.match.players[team].name; }
    toast(msg, bad) { YC.UI.toast(msg, bad); }
    myTurn() { const s = this.match.state; return !this.match.over && s.active === this.viewer && s.phase === 'PREP' && !this.match.busy; }

    // ───────────── desenho ─────────────
    renderSoft() {
      if (!this.match || !this.stage) return;
      this.renderPlayer(this.q('.pcard.opp'));
      this.renderPlayer(this.q('.pcard.me'));
      this.renderHand();
      this.renderPhase();
      this.board.mark(this.markings());
    }

    renderPlayer(box) {
      const team = box.dataset.team, m = this.match, p = m.players[team], me = team === this.viewer;
      const s = m.state, active = s.active === team && !m.over;
      const traps = m.traps.filter((t) => t.owner === team).length;
      const sub = this.labels[team] || (me ? 'Tu' : '');
      if (!box.firstChild) {
        box.innerHTML = `<div class="pc-head"><div class="avatar pc-ava"></div><div class="pc-id"><b class="pc-name"></b><small class="pc-sub"></small></div><div class="pc-clock"></div></div>
          <div class="pc-row"><div class="deck-pile" title="Baralho"><span></span></div><div class="pc-stats"></div>${me ? '' : '<div class="opp-hand"></div>'}</div>
          <div class="zone-title">Zona de Armadilhas</div><div class="zone"></div>`;
      }
      box.classList.toggle('active', active);
      box.querySelector('.pc-ava').textContent = team === 'w' ? '♔' : '♚';
      box.querySelector('.pc-ava').style.background = team === 'w' ? 'var(--cream)' : 'var(--plum)';
      box.querySelector('.pc-ava').style.color = team === 'w' ? 'var(--ink)' : 'var(--cream)';
      box.querySelector('.pc-name').textContent = p.name;
      box.querySelector('.pc-sub').textContent = sub;
      box.querySelector('.deck-pile span').textContent = p.deck.length;
      box.querySelector('.deck-pile').classList.toggle('empty', !p.deck.length);
      box.querySelector('.pc-stats').innerHTML = `<span title="Cartas na mão">🂠 ${p.hand.length}</span><span title="Cemitério">🪦 ${p.gy.length}</span><span title="Armadilhas de Casa no tabuleiro">🎯 ${traps}/3</span>`;
      if (!me) {
        const oh = box.querySelector('.opp-hand');
        if (oh.childElementCount !== p.hand.length) { oh.innerHTML = ''; for (let i = 0; i < p.hand.length; i++) oh.appendChild(H().back('xs')); }
      }
      const zone = box.querySelector('.zone');
      zone.innerHTML = '';
      for (let i = 0; i < YC.Cards.RULES.ZONE_SLOTS; i++) {
        const z = p.zone[i], slot = document.createElement('div');
        slot.className = 'zone-slot';
        if (z) {
          const fresh = z.setTurn >= s.turnCount;
          const c = me ? H().create(z.inst.id, { size: 'xs', static: true, uid: z.inst.uid }) : H().back('xs');
          if (me) {
            c.classList.add('set-own');
            c.addEventListener('mouseenter', () => this.inspect(z.inst.id));
            c.addEventListener('click', () => this.onZoneCard(z));
            if (fresh) slot.classList.add('fresh');
          }
          slot.appendChild(c);
        }
        zone.appendChild(slot);
      }
    }

    renderHand() {
      const row = this.q('.hand-row'), p = this.match.players[this.viewer];
      const keep = new Set();
      p.hand.forEach((inst, i) => {
        keep.add(inst.uid);
        let el = this.handEls.get(inst.uid);
        if (!el) {
          el = H().create(inst.id, { size: 'md', uid: inst.uid });
          el.classList.add('in-hand', 'enter');
          el.addEventListener('mouseenter', () => this.inspect(inst.id));
          el.addEventListener('click', () => this.onHandCard(inst));
          this.handEls.set(inst.uid, el);
          setTimeout(() => el.classList.remove('enter'), 400);
        }
        if (row.children[i] !== el) row.insertBefore(el, row.children[i] || null);
        const k = i - (p.hand.length - 1) / 2;
        el.style.setProperty('--rot', `${k * 4}deg`);
        el.style.setProperty('--lift', `${Math.abs(k) * 7}px`);
        el.style.visibility = this.hideHand.has(inst.uid) ? 'hidden' : '';
        const ok = this.myTurn() && this.match.state.actionsLeft > 0 && this.cardUsable(inst);
        el.classList.toggle('playable', ok);
        el.classList.toggle('dim', !ok && !this.respondCtx);
        el.classList.toggle('picked', this.selCard && this.selCard.uid === inst.uid);
        el.classList.toggle('respond', !!(this.respondCtx && this.respondCtx.options.some((o) => o.uid === inst.uid)));
      });
      for (const [uid, el] of this.handEls) if (!keep.has(uid)) { el.remove(); this.handEls.delete(uid); }
      row.style.setProperty('--n', p.hand.length);
    }

    renderPhase() {
      const m = this.match, s = m.state, box = this.q('.m-phase');
      const mine = s.active === this.viewer;
      const pips = [0, 1].map((i) => `<i class="${i < s.actionsLeft && mine && s.phase === 'PREP' ? 'on' : ''}"></i>`).join('');
      let hint;
      if (m.over) hint = 'Partida terminada.';
      else if (!mine) hint = m.chain ? 'Chain em curso…' : `${this.nameOf(s.active)} está a pensar…`;
      else if (s.mustPass) hint = 'As tuas peças estão congeladas: passa a vez.';
      else if (this.mode === 'equip') hint = 'Clica numa peça brilhante para a equipar.';
      else if (this.mode === 'trap') hint = 'Escolhe uma casa vazia (filas 3–6) para esconder a armadilha.';
      else if (this.mode === 'target-sq') hint = 'Escolhe a casa central da explosão.';
      else if (this.mode === 'steal-from') hint = 'Escolhe a peça inimiga equipada.';
      else if (this.mode === 'steal-to') hint = 'Agora a tua peça que recebe o equipamento.';
      else hint = s.actionsLeft > 0 ? 'Joga até 2 cartas (opcional) e depois mexe uma peça.' : 'Já não tens ações de carta: faz o teu lance.';
      box.innerHTML = `<div class="ph-top"><span class="ph-turn">Turno ${Math.max(1, s.turnCount)}</span><span class="ph-who ${s.active}">${mine ? 'A tua vez' : 'Vez do adversário'}</span></div>
        <div class="ph-steps"><span class="${s.phase === 'PREP' ? 'on' : ''}">Preparação <em class="pips">${pips}</em></span><span class="${s.phase === 'RESOLVE' ? 'on' : ''}">Lance + Chain</span></div>
        <p class="ph-hint">${hint}</p>
        <div class="ph-btns">
          ${s.mustPass && mine && !m.over ? '<button class="btn small teal" data-act="pass">Passar a vez</button>' : ''}
          ${this.mode ? '<button class="btn small ghost" data-act="cancel">Cancelar</button>' : ''}
          ${this.online ? '<span class="ph-clock"></span><button class="btn small ghost" data-act="forfeit" hidden>Reclamar vitória</button>' : ''}
          <button class="btn small ghost" data-act="speed" title="Velocidade das animações">${YC.FX.speed > 1 ? '⏩ Rápido' : '▶ Normal'}</button>
          ${m.over ? '<button class="btn small" data-act="exit">Voltar ao menu</button>' : '<button class="btn small red" data-act="resign">Desistir</button>'}
        </div>`;
      box.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => this.onButton(b.dataset.act)));
      if (this.online) this.renderOnline();
    }

    renderOnline() {
      if (!this.online || !this.stage) return;
      const clock = this.q('.ph-clock'), f = this.q('[data-act="forfeit"]');
      if (clock) clock.textContent = this.online.clockText() ? `⏱ ${this.online.clockText()}` : '';
      if (f) f.hidden = !this.online.canClaimForfeit();
      const st = this.online.oppStatus(), sub = this.q('.pcard.opp .pc-sub');
      if (sub) sub.textContent = `${st.rating} pts · ${st.online ? 'ligado' : 'sem sinal…'}`;
    }

    renderLog() {
      const list = this.q('.log-list');
      if (!list) return;
      list.innerHTML = this.match.log.slice(-40).map((l) => `<li class="t-${l.team || 'x'}"><span>${l.turn || ''}</span>${esc(l.text)}</li>`).join('');
      list.scrollTop = list.scrollHeight;
    }

    inspect(id) {
      const box = this.q('.insp-card');
      if (!box) return;
      if (!id) { box.innerHTML = '<p class="insp-empty">Passa o rato por uma carta para a ler aqui.</p>'; return; }
      if (box.dataset.id === id) return;
      box.dataset.id = id;
      box.innerHTML = '';
      box.appendChild(H().create(id, { size: 'lg' }));
    }

    // ───────────── Chain ─────────────
    async cutIn(link) {
      const band = document.createElement('div');
      band.className = 'cutin';
      band.innerHTML = `<div class="cutin-band" style="--c1:${link.def.theme.primary};--c2:${link.def.theme.secondary}"><div class="cutin-art">${YC.CardArt.svg(link.def)}</div><div class="cutin-txt"><small>LENDÁRIA!</small><b>${esc(link.def.name)}</b></div></div>`;
      this.stage.appendChild(band);
      YC.Sound && YC.Sound.play('reveal_legend');
      await YC.FX.fromTo(band.firstChild, { xPercent: -110, skewX: -14 }, { xPercent: 0, duration: 0.35, ease: 'back.out(1.5)' });
      await YC.FX.wait(650);
      await YC.FX.to(band.firstChild, { xPercent: 110, duration: 0.3, ease: 'back.in(1.5)' });
      band.remove();
    }

    async showLink(link, chain, fromRect) {
      const panel = this.q('.m-chain');
      panel.hidden = false;
      const stage = this.q('.chain-stage');
      const big = H().create(link.inst.id, { size: 'lg', static: true });
      big.classList.add('link-big');
      const label = document.createElement('div');
      label.className = 'link-label';
      label.innerHTML = `<b>Elo ${chain.length}</b> · ${esc(this.nameOf(link.team))} ativa${link.def.kind === 'GRID' ? ' uma armadilha' : ''}`;
      const br = this.board.wrap.getBoundingClientRect();
      const to = { left: br.left + br.width / 2 - 95, top: br.top + br.height / 2 - 133, width: 190, height: 266 };
      const from = fromRect || to;
      big.classList.add('face-down');
      await YC.FX.flyCard(big, from, to, { duration: 0.45, arc: 0.2 });
      big.classList.remove('face-down');
      label.style.left = `${br.left + br.width / 2}px`;
      label.style.top = `${to.top + to.height + 14}px`;
      stage.appendChild(label);
      YC.FX.fromTo(label, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.25 });
      await YC.FX.wait(900);
      const item = H().create(link.inst.id, { size: 'sm', static: true });
      item.classList.add('chain-item');
      item.dataset.n = chain.length;
      const list = this.q('.chain-list');
      list.appendChild(item);
      this.chainEls.set(link.inst.uid, item);
      item.style.visibility = 'hidden';
      label.remove();
      await YC.FX.flyCard(big, to, item.getBoundingClientRect(), { duration: 0.4 });
      big.remove();
      item.style.visibility = '';
      item.addEventListener('mouseenter', () => this.inspect(link.inst.id));
    }

    chainCardRect(link) {
      const el = link && link.inst && this.chainEls.get(link.inst.uid);
      return el ? el.getBoundingClientRect() : null;
    }

    chainState(link, state) {
      const el = this.chainEls.get(link.inst.uid);
      if (el) el.classList.add(`cs-${state}`);
    }

    chainClear() {
      const list = this.q('.chain-list');
      this.chainEls.clear();
      if (list) list.innerHTML = '';
      const panel = this.q('.m-chain');
      if (panel) panel.hidden = true;
    }

    // ───────────── posições para as animações ─────────────
    teamBox(team) { return this.q(team === this.viewer ? '.pcard.me' : '.pcard.opp'); }
    deckRect(team) { const b = this.teamBox(team); const d = b && b.querySelector('.deck-pile'); return d ? d.getBoundingClientRect() : null; }
    zoneSlotRect(team) {
      const b = this.teamBox(team); if (!b) return null;
      const slots = b.querySelectorAll('.zone-slot');
      const free = Array.from(slots).find((s) => !s.firstChild) || slots[slots.length - 1];
      return free ? free.getBoundingClientRect() : null;
    }
    handCardRect(team, uid) {
      if (team === this.viewer) { const el = this.handEls.get(uid); if (el) return el.getBoundingClientRect(); return this.q('.hand-row').getBoundingClientRect(); }
      const oh = this.teamBox(team).querySelector('.opp-hand');
      return oh ? oh.getBoundingClientRect() : this.deckRect(team);
    }
    handSlotRect(team) {
      if (team !== this.viewer) return this.handCardRect(team);
      const row = this.q('.hand-row'), r = row.getBoundingClientRect();
      const last = row.lastElementChild;
      if (last) { const lr = last.getBoundingClientRect(); return { left: Math.min(lr.left + 70, r.right - lr.width), top: lr.top, width: lr.width, height: lr.height }; }
      return { left: r.left + r.width / 2 - 66, top: r.top, width: 132, height: 185 };
    }
    cardOriginRect(link) {
      if (link.from === 'board' && link.target) return this.board.rect(link.target.sq);
      if (link.from === 'zone') { const b = this.teamBox(link.team); const z = b && b.querySelector('.zone'); return z ? z.getBoundingClientRect() : null; }
      return this.handCardRect(link.team, link.inst.uid);
    }

    // ───────────── fim ─────────────
    showEnd({ winner, reason }) {
      if (!this.stage || this.endShown) return;
      this.endShown = true;
      const won = winner === this.viewer, draw = winner === 'DRAW';
      const res = this.onGameOver ? this.onGameOver({ winner, reason }) : null;
      if (won) { YC.Sound && YC.Sound.play('victory_fanfare'); YC.FX.confetti(); setTimeout(() => YC.FX.confetti({ origin: { x: 0.2, y: 0.6 } }), 300); setTimeout(() => YC.FX.confetti({ origin: { x: 0.8, y: 0.6 } }), 500); }
      else if (!draw) YC.Sound && YC.Sound.play('defeat');
      const title = draw ? 'EMPATE!' : won ? (reason === 'Xeque-mate' ? 'XEQUE-MATE!' : 'VITÓRIA!') : 'DERROTA…';
      const back = document.createElement('div');
      back.className = 'modal-back end-back';
      back.innerHTML = `<div class="modal end-modal ${won ? 'win' : draw ? 'draw' : 'lose'}"><div class="end-title">${title}</div><p class="end-reason">${esc(reason)}${won ? ' — ganhaste!' : draw ? '' : ` — ganharam as ${winner === 'w' ? 'Brancas' : 'Pretas'}.`}</p>
        <div class="end-rewards"></div><div class="row"><button class="btn ghost-dark" data-a="board">Ver tabuleiro</button><button class="btn" data-a="menu">Voltar ao menu</button>${this.onRematch ? '<button class="btn pink" data-a="again">Jogar outra vez</button>' : ''}</div></div>`;
      document.body.appendChild(back);
      const fill = (r) => {
        const box = back.querySelector('.end-rewards');
        if (!r || !box) return;
        box.innerHTML = `${r.gold ? `<span class="coin-pill gold"><i></i>+${r.gold}</span>` : ''}${r.stardust ? `<span class="coin-pill dust"><i></i>+${r.stardust}</span>` : ''}${r.rating ? `<span class="rating-pill">${esc(r.rating)}</span>` : ''}`;
      };
      Promise.resolve(res).then(fill);
      back.querySelector('[data-a="menu"]').onclick = () => { back.remove(); this.onExit(); };
      back.querySelector('[data-a="board"]').onclick = () => back.remove();
      const again = back.querySelector('[data-a="again"]');
      if (again) again.onclick = () => { back.remove(); this.onRematch(); };
      YC.FX.fromTo(back.querySelector('.end-title'), { scale: 0.2, rotation: -12 }, { scale: 1, rotation: -4, duration: 0.6, ease: 'elastic.out(1.1, 0.45)' });
    }
  }

  YC.MatchUI = MatchUI;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
