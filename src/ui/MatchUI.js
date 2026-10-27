/* MatchUI.js — ecrã da partida em arena (inspirado no "Chess Links"): topo com retratos, material, relógios
   e peças capturadas (MatchHUD.js); tabuleiro 3D com as Zonas de Armadilhas à esquerda e baralho/cemitério
   à direita; botões de turno/histórico/desistir; mão em leque com zoom ao estilo Hearthstone.
   A interação está em MatchInput.js e os efeitos da Chain/fim em MatchChain.js. */
(function (YC) {
  'use strict';

  const H = () => YC.HoloCard;

  class MatchUI {
    constructor({ root, onExit }) {
      this.root = root;
      this.onExit = onExit || (() => {});
      this.hideHand = new Set();
      this.dropRects = new Map();
      this.handEls = new Map();
      this.chainEls = new Map();
      this.mode = null;
      this.selSq = -1;
      this.selCard = null;
      this.lastMove = null;
    }

    /** opts: { match, viewer, labels: {w,b}, online, clockMs } */
    mount({ match, viewer, labels = {}, online = null, clockMs = 0 }) {
      this.match = match; this.bus = match.bus; this.viewer = viewer; this.labels = labels; this.online = online;
      const opp = YC.other(viewer);
      this.use3D = !!(YC.Board3D && YC.Board3D.available());
      const table = this.use3D ? '<div class="stage3d-host"></div>' : `<div class="table-3d"><div class="plane">
            <div class="side left"><div class="zone" data-team="${opp}"></div><div class="side-label">Zona de Armadilhas</div><div class="zone" data-team="${viewer}"></div></div>
            <div class="board-host"></div>
            <div class="side right"><div class="piles" data-team="${opp}"></div><div class="side-label">Baralho · Cemitério</div><div class="piles" data-team="${viewer}"></div></div>
          </div></div>`;
      this.root.innerHTML = `
        <div id="match-stage" class="arena${this.use3D ? ' webgl' : ''}">
          <div class="arena-bg"><i class="beam b1"></i><i class="beam b2"></i><i class="beam b3"></i><div class="stands"></div><div class="floor"></div></div>
          ${table}
          <header class="hud"><section class="hud-p opp" data-team="${opp}"></section>
            <div class="hud-mid"><div class="jumbo left"></div><div class="hud-logo"><b>CHESS-GI-OH!</b><small>CARTOON EDITION</small></div><div class="jumbo right"></div></div>
            <section class="hud-p me" data-team="${viewer}"></section></header>
          <div class="feed"></div>
          <div class="opp-hand"></div>
          <aside class="arena-btns"></aside>
          <div class="m-chain" hidden><h3>Chain</h3><div class="chain-list"></div></div>
          <div class="action-bar" hidden></div>
          <div class="hand-dock"><div class="hand-row"></div></div>
          <div class="mascot"><div class="squash">${YC.PieceArt.svg('k', viewer)}</div></div>
          <div class="respond-bar" hidden></div>
          <div class="log-drawer" hidden><header><b>Histórico</b><button class="btn small ghost" data-a="close-log">✕</button></header><ol class="log-list"></ol></div>
          <div class="arena-fx"></div>
          <div class="chain-stage"></div>
        </div>`;
      this.stage = this.root.querySelector('#match-stage');
      this.q = (sel) => this.stage.querySelector(sel);
      if (this.use3D) {
        this.board = new YC.Board3D(this.q('.stage3d-host'), {
          fxLayer: this.q('.arena-fx'),
          onSquare: (sq) => this.onSquare(sq),
          onPieceHover: (sq, anchor) => (sq >= 0 && !this.dragging ? YC.PieceInspector.show(this, sq, anchor) : YC.PieceInspector.hide()),
          onZoneHover: (t, rect) => this.onTableHover(t, rect),
          onZoneClick: (t) => { if (t.rel === 'me' && t.card) this.onZoneCard({ inst: t.card, setTurn: t.setTurn }); },
          onPileClick: (t) => { if (t.pile === 'gy') this.showGraveyard(t.team); }
        });
      } else {
        this.board = new YC.BoardView(this.q('.board-host'), {
          fxLayer: this.q('.arena-fx'),
          onSquare: (sq) => this.onSquare(sq),
          onPieceHover: (sq, el) => (sq >= 0 ? YC.PieceInspector.show(this, sq, el.querySelector('.stand') || el) : YC.PieceInspector.hide())
        });
      }
      this.board.setFlipped(viewer === 'b');
      if (this.use3D) {
        // mascote: o Rei dá saltos com pirueta (sprite sheet) enquanto o rato está em cima e uma vez no início da tua vez
        const box = this.q('.mascot .squash'), P = YC.Portraits3D;
        box.innerHTML = YC.pieceHTML('k', viewer);
        this.mascotJump = (mode) => P && viewer && P.play(box, 'k', viewer, mode);
        this.q('.mascot').addEventListener('pointerenter', () => this.mascotJump('loop'));
        this.q('.mascot').addEventListener('pointerleave', () => this.mascotJump('stop'));
      }
      this.animator = new YC.MatchAnimator({ bus: this.bus, board: this.board, ui: this });
      this.q('[data-a="close-log"]').onclick = () => this.toggleLog(false);
      this.offs = [
        this.bus.on('state:changed', () => this.renderSoft()),
        this.bus.on('log', () => this.renderLog()),
        this.bus.on('ui:invalid', ({ message }) => { if (YC.Sound) YC.Sound.play('error'); this.toast(message, true); }),
        this.bus.on('piece:move', ({ move }) => { this.lastMove = { from: move.from, to: move.to }; YC.PieceInspector.hide(); }),
        this.bus.on('turn:start', ({ team }) => { if (team === viewer && this.mascotJump) this.mascotJump('once'); }),
        this.bus.on('game:over', (p) => { this.stopClock(); setTimeout(() => this.showEnd(p), 1100); })
      ];
      this.onResize = () => { this.board.fx._unit = this.board.unit(); };
      window.addEventListener('resize', this.onResize);
      this.startClock(clockMs);
      this.board.sync(match, { viewer });
      this.renderSoft();
      this.renderLog();
    }

    unmount() {
      (this.offs || []).forEach((off) => off());
      if (this.animator) this.animator.dispose();
      if (this.respondTimer) clearInterval(this.respondTimer);
      this.stopClock();
      window.removeEventListener('resize', this.onResize);
      YC.PieceInspector.hide(); YC.CardZoom.hide();
      if (this.board && this.board.dispose) this.board.dispose();
      this.root.innerHTML = '';
      this.stage = null;
    }

    isSpectator() { return !this.viewer; }
    nameOf(team) { return this.match.players[team].name; }
    toast(msg, bad) { YC.UI.toast(msg, bad); }
    myTurn() { const s = this.match.state; return !this.match.over && s.active === this.viewer && s.phase === 'PREP' && !this.match.busy; }

    // ───────────── desenho ─────────────
    renderSoft() {
      if (!this.match || !this.stage) return;
      this.renderHUD();
      this.renderSides();
      this.renderHand();
      this.renderButtons();
      this.renderActionBar();
      this.board.mark(this.markings());
      this.stage.querySelector('.mascot').classList.toggle('checked', !this.match.over && YC.Chess.inCheck(this.match.pos, this.viewer));
    }

    renderSides() {
      const m = this.match, s = m.state;
      if (this.use3D) {
        this.board.respondUids = this.respondCtx ? this.respondCtx.options.map((o) => o.uid) : [];
        this.board.syncSides(m, this.viewer);
      }
      for (const zone of this.stage.querySelectorAll('.zone')) {
        const team = zone.dataset.team, p = m.players[team], me = team === this.viewer;
        const resp = this.respondCtx ? this.respondCtx.options.map((o) => o.uid) : [];
        const key = p.zone.map((z) => z.inst.uid + (z.setTurn >= s.turnCount ? 'z' : '') + (resp.includes(z.inst.uid) ? 'r' : '')).join(',');
        if (zone.dataset.key === key) continue;
        zone.dataset.key = key;
        zone.innerHTML = '';
        for (let i = 0; i < YC.Cards.RULES.ZONE_SLOTS; i++) {
          const z = p.zone[i], slot = document.createElement('div');
          slot.className = 'zone-slot';
          if (z) {
            const c = me ? H().create(z.inst.id, { size: 'xs', static: true, uid: z.inst.uid }) : H().back('xs');
            if (me) {
              c.classList.add('set-own');
              this.attachInspect(c, z.inst.id);
              c.addEventListener('click', () => this.onZoneCard(z));
              if (z.setTurn >= s.turnCount) slot.classList.add('fresh');
              if (resp.includes(z.inst.uid)) c.classList.add('respond');
            }
            slot.appendChild(c);
          }
          zone.appendChild(slot);
        }
      }
      for (const box of this.stage.querySelectorAll('.piles')) {
        const team = box.dataset.team, p = m.players[team];
        const top = p.gy[p.gy.length - 1] || '';
        const key = `${p.deck.length}|${p.gy.length}|${top}`;
        if (box.dataset.key === key) continue;
        box.dataset.key = key;
        box.innerHTML = `<div class="deck-pile${p.deck.length ? '' : ' empty'}" title="Baralho: ${p.deck.length} carta(s)"><span>${p.deck.length}</span></div><div class="gy-pile" title="Cemitério: ${p.gy.length} carta(s)"></div>`;
        const gy = box.querySelector('.gy-pile');
        if (top) { const c = H().create(top, { size: 'xs', static: true }); gy.appendChild(c); this.attachInspect(c, top); }
        gy.insertAdjacentHTML('beforeend', `<span class="gy-count">${p.gy.length}</span>`);
        gy.onclick = () => this.showGraveyard(team);
      }
      const oh = this.q('.opp-hand'), n = m.players[YC.other(this.viewer)].hand.length;
      if (oh.childElementCount !== n) {
        oh.innerHTML = '';
        for (let i = 0; i < n; i++) { const b = H().back('xs'); b.style.setProperty('--i', i - (n - 1) / 2); oh.appendChild(b); }
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
          el.insertAdjacentHTML('beforeend', this.handTip(inst.id));
          el.addEventListener('click', () => { if (!this.dragJustEnded) this.onHandCard(inst); });
          if (this.attachDrag) this.attachDrag(el, inst);
          this.handEls.set(inst.uid, el);
          setTimeout(() => el.classList.remove('enter'), 500);
        }
        if (row.children[i] !== el) row.insertBefore(el, row.children[i] || null);
        const k = i - (p.hand.length - 1) / 2;
        el.style.setProperty('--rot', `${k * 5}deg`);
        el.style.setProperty('--lift', `${Math.abs(k) * 9}px`);
        el.classList.toggle('tip-left', k > 0);
        el.style.visibility = this.hideHand.has(inst.uid) ? 'hidden' : '';
        const ok = this.myTurn() && this.match.state.actionsLeft > 0 && this.cardUsable(inst);
        el.classList.toggle('playable', ok);
        el.classList.toggle('dim', !ok && !this.respondCtx);
        el.classList.toggle('picked', !!(this.selCard && this.selCard.uid === inst.uid));
        el.classList.toggle('respond', !!(this.respondCtx && this.respondCtx.options.some((o) => o.uid === inst.uid)));
      });
      for (const [uid, el] of this.handEls) if (!keep.has(uid)) { el.remove(); this.handEls.delete(uid); }
      // zoom da mão: a carta ampliada fica com 250–300 px de largura (texto legível), sem sair do ecrã
      const hw = row.firstElementChild ? row.firstElementChild.offsetWidth : 0;
      if (hw) row.style.setProperty('--zmax', (Math.min(300, Math.max(250, innerWidth * 0.17), innerHeight * 0.4) / hw).toFixed(3));
    }

    renderButtons() {
      const m = this.match, s = m.state, box = this.q('.arena-btns');
      const mine = s.active === this.viewer;
      let label, sub = '', cls = 'wait', act = '';
      if (m.over) { label = 'FIM'; sub = 'Partida terminada'; }
      else if (mine && s.mustPass && s.phase === 'PREP') { label = 'PASSAR'; sub = 'Peças congeladas'; cls = 'go'; act = 'pass'; }
      else if (m.chain) { label = 'CHAIN'; sub = 'A resolver cartas…'; cls = 'chain'; }
      else if (mine) { label = 'A TUA VEZ'; sub = s.actionsLeft > 0 ? `${s.actionsLeft} carta(s) + 1 lance` : 'Faz o teu lance'; cls = 'go'; }
      else { label = 'ESPERA'; sub = `${this.nameOf(s.active)} a pensar…`; }
      const fast = YC.FX.speed > YC.FX.NORMAL;
      box.innerHTML = `<button class="turn-btn ${cls}" ${act ? `data-act="${act}"` : 'disabled'}><b>${label}</b><small>${YC.HoloCard.esc(sub)}</small></button>
        <button class="side-btn" data-act="log">HISTÓRICO</button>
        ${m.over ? '<button class="side-btn" data-act="exit">MENU</button>' : '<button class="side-btn danger" data-act="resign">DESISTIR</button>'}
        ${this.online ? '<button class="side-btn" data-act="forfeit" hidden>RECLAMAR VITÓRIA</button>' : ''}
        <div class="mini-btns"><button data-act="speed" title="Velocidade das animações">${fast ? '⏩' : '▶'}</button><button data-act="mute" title="Som">${YC.Sound.muted ? '🔇' : '🔊'}</button><button data-act="exit" title="Sair para o menu">⏏</button></div>`;
      box.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => this.onButton(b.dataset.act)));
      if (this.online) this.renderOnline();
    }

    renderActionBar() {
      const bar = this.q('.action-bar');
      const hint = this.modeHint();
      if (!hint && !(this.cardActs && this.cardActs.length)) { bar.hidden = true; return; }
      bar.hidden = false;
      bar.innerHTML = `<span>${hint || ''}</span>`;
      for (const [label, act, inst] of this.cardActs || []) {
        const b = document.createElement('button');
        b.className = `btn small ${act === 'set' ? 'violet' : 'pink'}`;
        b.textContent = label;
        b.onclick = () => this.cardAct(act, inst);
        bar.appendChild(b);
      }
      const c = document.createElement('button');
      c.className = 'btn small ghost'; c.textContent = 'Cancelar';
      c.onclick = () => this.cancelMode();
      bar.appendChild(c);
    }

    modeHint() {
      if (this.dragging && this.dragHint) return this.dragHint();
      switch (this.mode) {
        case 'equip': return 'Clica numa peça brilhante para a equipar.';
        case 'trap': return 'Escolhe uma casa vazia (filas 3–6) para esconder a armadilha.';
        case 'target-sq': case 'r-target-sq': return 'Escolhe a casa central da explosão.';
        case 'steal-from': case 'r-steal-from': return 'Escolhe a peça inimiga equipada.';
        case 'steal-to': case 'r-steal-to': return 'Agora a tua peça que recebe o equipamento.';
        case 'card': return 'O que queres fazer com esta carta?';
        default: return '';
      }
    }

    showGraveyard(team) {
      const p = this.match.players[team];
      const m = YC.UI.modal(`<h2>Cemitério ${team === this.viewer ? '(teu)' : '(adversário)'}</h2><div class="gy-grid"></div><div class="row"><button class="btn" data-a="ok">Fechar</button></div>`, { cls: 'gy-modal' });
      const grid = m.el.querySelector('.gy-grid');
      if (!p.gy.length) grid.innerHTML = '<p>Ainda vazio.</p>';
      p.gy.slice().reverse().forEach((id) => grid.appendChild(H().create(id, { size: 'sm' })));
      m.el.querySelector('[data-a="ok"]').onclick = () => m.close();
    }

    // ───────────── informação das cartas (estilo Hearthstone) ─────────────
    /** Fora da mão: a carta grande aparece ao lado do elemento (Zona, Cemitério, Chain, respostas). */
    attachInspect(el, id) {
      el.addEventListener('mouseenter', () => YC.CardZoom.show(el, typeof id === 'function' ? id() : id));
      el.addEventListener('mouseleave', () => YC.CardZoom.hide());
      el.addEventListener('pointerdown', () => YC.CardZoom.hide());
    }

    /** Etiqueta ao lado da carta ampliada na mão: tipo, raridade, velocidade e como se joga. */
    handTip(id) {
      const c = YC.Cards.get(id), R = YC.Cards.RARITY[c.rarity], esc = YC.HoloCard.esc;
      const how = { EQUIP: 'Arrasta para uma peça tua que brilhe.', GRID: 'Arrasta para uma casa vazia (filas 3 a 6). Fica escondida do adversário.',
        REACTIVE: 'Arrasta para a tua Zona: dispara quando acontece o que diz o texto.', COUNTER: 'Arrasta para a tua Zona: responde às cartas do adversário.',
        QUICK: 'Arrasta para o tabuleiro para ativar já, ou para a Zona para guardar.' }[c.kind];
      const speed = { 1: 'não pode responder', 2: 'responde a VEL 1 e 2', 3: 'responde a qualquer carta' }[c.ss] || '';
      return `<div class="hc-tip"><b>${esc(YC.Cards.KIND_LABEL[c.kind])}</b><span class="tip-meta"><em style="color:${R.color}">${R.label}</em> · VEL ${c.ss}: ${speed}</span><p>${how}</p><small>Ou clica na carta para ver as opções.</small></div>`;
    }

    /** Passar o rato nas cartas da mesa 3D (Zona e Cemitério): zoom junto da carta. */
    onTableHover(t, rect) {
      const id = t && ((t.kind === 'zone' && t.rel === 'me' && t.card && t.card.id) || (t.kind === 'pile' && t.pile === 'gy' && t.top) || (t.kind === 'trap' && t.id));
      if (!id || !rect || this.dragging) return YC.CardZoom.hide();
      YC.CardZoom.show({ getBoundingClientRect: () => rect }, id, { delay: 60, avoid: this.board.boardRect && this.board.boardRect() });
    }

    // ───────────── posições para as animações ─────────────
    zoneEl(team) { return this.stage.querySelector(`.zone[data-team="${team}"]`); }
    pilesEl(team) { return this.stage.querySelector(`.piles[data-team="${team}"]`); }
    deckRect(team) {
      if (this.use3D) return this.board.deckRect(team);
      const d = this.pilesEl(team) && this.pilesEl(team).querySelector('.deck-pile'); return d ? d.getBoundingClientRect() : null;
    }
    zoneSlotRect(team) {
      if (this.use3D) return this.board.zoneSlotRect(team, Math.max(0, this.match.players[team].zone.length - 1));
      const z = this.zoneEl(team); if (!z) return null;
      const slots = Array.from(z.querySelectorAll('.zone-slot'));
      const free = slots.find((s) => !s.firstChild) || slots[slots.length - 1];
      return free ? free.getBoundingClientRect() : null;
    }
    handCardRect(team, uid) {
      const d = uid && this.dropRects.get(uid);
      if (d && performance.now() - d.t < 5000) return d.rect;
      if (team === this.viewer) { const el = this.handEls.get(uid); return (el || this.q('.hand-row')).getBoundingClientRect(); }
      return this.q('.opp-hand').getBoundingClientRect();
    }
    handSlotRect(team) {
      if (team !== this.viewer) return this.handCardRect(team);
      const row = this.q('.hand-row'), r = row.getBoundingClientRect(), last = row.lastElementChild;
      if (last) { const lr = last.getBoundingClientRect(); return { left: Math.min(lr.left + 90, innerWidth - lr.width - 10), top: lr.top, width: lr.width, height: lr.height }; }
      return { left: r.left + r.width / 2 - 66, top: innerHeight - 200, width: 132, height: 185 };
    }
    cardOriginRect(link) {
      if (link.from === 'board' && link.target) return this.board.rect(link.target.sq);
      if (link.from === 'zone') { if (this.use3D) return this.board.zoneRect(link.team); const z = this.zoneEl(link.team); return z ? z.getBoundingClientRect() : null; }
      return this.handCardRect(link.team, link.inst.uid);
    }
  }

  YC.MatchUI = MatchUI;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
