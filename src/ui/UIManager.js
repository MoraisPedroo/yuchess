/* UIManager.js — interface: mão em leque curvo, zonas de Suporte, pilha Uno, registo da Chain,
   inspetor de peças, destaques de movimento com previsão de combate e o agente humano. */
(function (YC) {
  'use strict';

  const GLYPH = { PAWN: '♟', KNIGHT: '♞', BISHOP: '♝', ROOK: '♜', QUEEN: '♛', KING: '♚' };
  const PT = { PAWN: 'Peão', KNIGHT: 'Cavalo', BISHOP: 'Bispo', ROOK: 'Torre', QUEEN: 'Dama', KING: 'Rei' };
  const FAN_DEG = 46;
  const esc = (s) => YC.CardView.escape(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  class UIManager {
    constructor({ bus, renderer, vfx, audio }) {
      this.bus = bus; this.renderer = renderer; this.vfx = vfx; this.audio = audio;
      this.game = null;
      this.mode = { kind: 'IDLE' };
      this.selected = null;
      this.viewerOverride = null;
      this.handEls = new Map();
      this.renderQueued = false;
      this.declared = null;
      this.lastMove = null;
      this.resolvingId = null;
    }

    $(id) { return document.getElementById(id); }

    mount() {
      this.el = {
        hand: this.$('hand'), menu: this.$('card-menu'), pill: this.$('turn-pill'), phaseTitle: document.querySelector('#phase-box .phase-title'),
        phaseHint: document.querySelector('#phase-box .phase-hint'), deck: document.querySelector('#pile-box .deck'),
        discard: document.querySelector('#pile-box .discard'), perm: document.querySelector('#pile-box .perm'),
        chain: document.querySelector('#chain-box .chain-list'), log: this.$('log'), inspector: this.$('inspector'),
        opp: this.$('opp-strip'), me: this.$('me-strip'), toast: this.$('toast')
      };
      const btn = (id, fn) => this.$(id).addEventListener('click', () => { this.audio.playClick(); fn(); });
      btn('btn-fallback', () => this.dispatch({ type: 'FALLBACK_DRAW' }));
      btn('btn-sovereign', () => this.dispatch({ type: 'ARM_SOVEREIGNTY' }));
      btn('btn-end', () => this.dispatch({ type: 'END_TURN' }));
      btn('btn-skip', () => this.dispatch({ type: 'SKIP_BONUS' }));
      btn('btn-cancel', () => this.cancelMode());
      btn('btn-forfeit', async () => {
        const online = this.game && this.game.online;
        if (online && await online.claimForfeit()) this.toast('Vitória por abandono registada.');
      });
      this.renderer.onCell = (r, c) => this.onCellClick(r, c);
      this.renderer.onHover = (r, c) => this.onCellHover(r, c);
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#card-menu') && !e.target.closest('#hand .card')) this.closeMenu();
      });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { this.cancelMode(); this.closeMenu(); } });
      window.addEventListener('resize', () => this.scheduleRender());
      this.subscribe();
    }

    bindGame(game) {
      this.game = game;
      this.mode = { kind: 'IDLE' };
      this.selected = null; this.declared = null; this.lastMove = null; this.viewerOverride = null;
      this.handEls.forEach((el) => el.remove());
      this.handEls.clear();
      this.el.log.innerHTML = '';
      this.render();
    }

    createHumanAgent(team) {
      return {
        isHuman: true, team,
        playTurn: () => { this.selected = null; this.scheduleRender(); },
        respondChain: (ctx) => this.askChain(team, ctx)
      };
    }

    get viewer() {
      if (!this.game || this.game.mode === 'AI') return 'WHITE';
      if (this.game.mode === 'ONLINE') return this.game.localTeam;
      return this.viewerOverride || this.game.state.active;
    }
    isHumanTurn() { const g = this.game; return !!g && !!g.agents[g.state.active] && g.agents[g.state.active].isHuman; }
    canAct() { const g = this.game; return !!g && !g.busy && !g.state.winner && this.isHumanTurn() && this.mode.kind === 'IDLE'; }

    async dispatch(action) {
      const g = this.game;
      if (!g) return false;
      this.closeMenu();
      const ok = await g.dispatch({ ...action, team: g.state.active });
      if (!ok && !g.state.winner) this.toast('Isso não é possível agora.');
      this.scheduleRender();
      return ok;
    }

    toast(msg) {
      const t = this.el.toast;
      t.textContent = msg;
      t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    }

    // ── Modos de interação ──
    cancelMode() {
      const m = this.mode;
      this.mode = { kind: 'IDLE' };
      if (m.resolve) m.resolve(null);
      this.scheduleRender();
    }

    pickTarget(need, card) {
      return new Promise((resolve) => {
        this.mode = { kind: 'TARGET', candidates: need.candidates.map((p) => p.uid), resolve, card,
          label: card.uno.value === 'SKIP' ? 'Escolhe a peça inimiga a congelar' : 'Escolhe a peça cujo ATK e ESC vão trocar' };
        this.render();
      });
    }

    async playCard(card) {
      const g = this.game, v = this.viewer;
      let chosenColor = null, targetUid = null;
      if (card.uno.color === 'W') { chosenColor = await YC.Screens.colorPicker(this.audio); if (!chosenColor) return; }
      const need = g.targetRequirement(card, v);
      if (need && need.candidates.length) { targetUid = await this.pickTarget(need, card); if (!targetUid) return; }
      await this.dispatch({ type: 'PLAY_UNO_CARD', cardUid: card.uid, chosenColor, targetUid });
    }

    beginSetTrap(card) {
      this.mode = { kind: 'SET_TRAP', cardUid: card.uid, resolve: null };
      this.render();
    }

    // ── Cliques no tabuleiro ──
    onCellClick(r, c) {
      const g = this.game;
      if (!g) return;
      const b = g.board, v = this.viewer, m = this.mode;
      if (m.kind === 'TARGET') {
        const p = b.pieceAt(r, c);
        if (p && m.candidates.includes(p.uid)) { this.mode = { kind: 'IDLE' }; m.resolve(p.uid); }
        return;
      }
      if (m.kind === 'SET_TRAP') {
        if (b.canSetTrapAt(v, r, c)) { this.mode = { kind: 'IDLE' }; this.dispatch({ type: 'SET_TRAP', cardUid: m.cardUid, row: r, col: c }); }
        return;
      }
      if (!this.canAct()) return;
      const s = g.state;
      if (s.phase === 'BONUS_STEP') {
        const piece = b.getPiece(s.bonusPieceUid);
        if (piece && g.bonusSteps(piece).some(([a, d]) => a === r && d === c)) this.dispatch({ type: 'BONUS_STEP', to: [r, c] });
        return;
      }
      if (s.phase !== 'BOARD_ACTION_PHASE' || !s.permission || s.permission.used) return;
      if (this.selected) {
        const piece = b.getPiece(this.selected);
        const move = piece && b.getValidMoves(piece, s.permission, s.turnCount).find((mv) => mv.to[0] === r && mv.to[1] === c);
        if (move) { this.selected = null; this.dispatch({ type: 'DECLARE_MOVE', pieceUid: piece.uid, to: [r, c] }); return; }
      }
      const p = b.pieceAt(r, c);
      if (p && p.team === v && b.getValidMoves(p, s.permission, s.turnCount).length) {
        this.selected = this.selected === p.uid ? null : p.uid;
        this.audio.playClick();
      } else this.selected = null;
      this.render();
    }

    onCellHover(r, c) {
      const g = this.game, box = this.el.inspector;
      const p = g && r >= 0 ? g.board.pieceAt(r, c) : null;
      if (!p) { box.classList.remove('show'); return; }
      const t = g.state.turnCount, cb = g.combat;
      const atk = cb.effectiveAtk(p, t), escB = cb.shieldPool(p, g.board);
      const st = [];
      if (g.board.isStunned(p, t)) st.push('❄ CONGELADA');
      for (const bf of p.buffs) if (t < bf.expiresAtTurn) st.push(`${bf.amount > 0 ? '+' : ''}${bf.amount} ATK (até T${bf.expiresAtTurn})`);
      if (p.overdrive) st.push('Sobrecarga +25%');
      if (p.pierce) st.push('Perfura escudo');
      if (p.swapped) st.push('ATK⇄ESC trocados');
      box.innerHTML = `<div class="insp-head team-${p.team.toLowerCase()}"><b>${GLYPH[p.type]} ${esc(p.name)}</b><small>${esc(g.teamName(p.team))} · ${g.board.squareName(p.row, p.col)}</small></div>
        <div class="insp-hp"><i style="width:${(p.hp / p.maxHp) * 100}%"></i><span>${p.hp} / ${p.maxHp} HP</span></div>
        <div class="insp-stats"><span>🥊 ATK <b>${atk}</b></span><span>🛡 ESC <b>${escB}</b>${p.tempShield ? ` <em>(+${p.tempShield} temp)</em>` : ''}</span></div>
        ${st.length ? `<div class="insp-status">${st.map(esc).join(' · ')}</div>` : ''}
        <p class="insp-passive">${esc(YC.CardDatabase.piecePassives[p.type])}</p>`;
      const pos = this.renderer.cellCenter(r, c);
      const right = pos.x + this.renderer.sq * 0.7;
      box.style.left = `${Math.min(window.innerWidth - 250, right)}px`;
      box.style.top = `${Math.max(8, pos.y - 60)}px`;
      box.classList.add('show');
    }

    showCardTip(card, el) {
      if (this.menuUid) return;
      const box = this.el.inspector, d = YC.CardView.describe(card);
      box.innerHTML = `<div class="insp-head"><b>${esc(d.title)}</b><small>${esc(d.sub)}</small></div>${d.lines.map((l) => `<p>${esc(l)}</p>`).join('')}`;
      const r = el.getBoundingClientRect();
      box.style.left = `${Math.max(8, Math.min(window.innerWidth - 250, r.left + r.width / 2 - 120))}px`;
      box.style.top = `${Math.max(8, r.top - 190)}px`;
      box.classList.add('show');
    }

    // ── Menu de carta ──
    closeMenu() { this.el.menu.hidden = true; this.menuUid = null; this.handEls.forEach((e) => e.classList.remove('menu-open')); }

    openCardMenu(card, el) {
      const g = this.game, v = this.viewer, s = g.state;
      const opts = [];
      if (g.canPlayCard(v, card) && this.canAct()) opts.push(['▶ Jogar na pilha', () => this.playCard(card)]);
      if (this.canAct() && g.canSetNow(v)) {
        if (card.yugioh.cardType === 'SPATIAL_TRAP') opts.push(['⚑ Esconder no tabuleiro', () => this.beginSetTrap(card)]);
        if (['QUICK_SPELL', 'COUNTER_TRAP'].includes(card.yugioh.cardType) && s.players[v].support.includes(null)) {
          opts.push(['⚑ Virar no Suporte', () => this.dispatch({ type: 'SET_SUPPORT', cardUid: card.uid })]);
        }
      }
      let why = '';
      if (!opts.length) {
        if (!this.isHumanTurn() || s.active !== v) why = 'Espera pela tua vez.';
        else if (g.busy) why = 'Aguarda o fim da ação.';
        else if (s.phase !== 'UNO_CARD_PHASE') why = s.players[v].setThisTurn ? 'Já jogaste e escondeste uma carta neste turno.' : 'Já jogaste a carta Uno deste turno.';
        else why = `Não combina: precisas de ${YC.CardDatabase.COLOR_NAME[g.uno.activeColor] || 'qualquer cor'} ou valor ${YC.CardView.bigLabel(g.uno.top)}.`;
      }
      const m = this.el.menu;
      m.innerHTML = opts.map((o, i) => `<button data-i="${i}">${o[0]}</button>`).join('') + (why ? `<p>${esc(why)}</p>` : '');
      m.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.audio.playClick(); this.closeMenu(); opts[Number(b.dataset.i)][1](); }));
      m.hidden = false;
      this.el.inspector.classList.remove('show');
      const r = el.getBoundingClientRect(), host = m.parentElement.getBoundingClientRect();
      const half = m.offsetWidth / 2 + 8;
      const cx = Math.max(half, Math.min(window.innerWidth - half, r.left + r.width / 2));
      m.style.left = `${cx - host.left}px`;
      m.style.top = `${r.top - host.top - 12}px`;
      this.handEls.forEach((e) => e.classList.remove('menu-open'));
      el.classList.add('menu-open');
      this.menuUid = card.uid;
    }

    // ── Chain (agente humano) ──
    async askChain(team, ctx) {
      const g = this.game;
      const hidden = g.mode === 'HOTSEAT' && team !== g.state.active;
      if (hidden) await YC.Screens.curtain(`${g.teamName(team)}: podes responder!`, 'Passa o ecrã. O outro jogador não espreita.');
      this.viewerOverride = team;
      this.render();
      const uid = await YC.Screens.chainWindow({ game: g, team, options: ctx.options, stack: ctx.stack, top: ctx.top, audio: this.audio });
      this.viewerOverride = null;
      if (hidden) await YC.Screens.curtain(`Devolve o ecrã às ${g.teamName(g.state.active)}`, 'A Chain continua.');
      this.render();
      return uid;
    }

    // ── Renderização ──
    scheduleRender() {
      if (this.renderQueued) return;
      this.renderQueued = true;
      requestAnimationFrame(() => { this.renderQueued = false; this.render(); });
    }

    render() {
      if (!this.game || !this.game.state) return;
      this.renderTop(); this.renderStrips(); this.renderPile(); this.renderActions(); this.renderChain(); this.renderBoard(); this.renderHand();
    }

    renderTop() {
      const g = this.game, s = g.state, v = this.viewer;
      const mine = s.active === v && this.isHumanTurn();
      const who = mine && g.mode !== 'HOTSEAT' ? 'A TUA VEZ' : mine ? `VEZ DAS ${g.teamName(s.active).toUpperCase()}` : `VEZ DE ${g.teamName(s.active).toUpperCase()}`;
      const clock = g.online ? g.online.clockText() : '';
      const tag = g.online ? `<span class="net-tag">${g.online.ranked ? 'RANQUEADA' : 'SALA ' + esc(g.online.match.id)}</span> ` : '';
      this.el.pill.innerHTML = `${tag}<b>TURNO ${s.turnCount}</b> · ${esc(who)}${clock ? ` · <em class="clock">${clock}</em>` : ''}${s.turnCount >= YC.GameController.SUDDEN_DEATH_TURN ? ' · <em>MORTE SÚBITA</em>' : ''}`;
      this.el.pill.className = `team-${s.active.toLowerCase()}`;
      const [title, hint] = this.phaseText();
      this.el.phaseTitle.textContent = title;
      this.el.phaseHint.textContent = hint;
    }

    phaseText() {
      const g = this.game, s = g.state, v = this.viewer, m = this.mode;
      if (s.winner) return ['FIM DE PARTIDA', ''];
      if (m.kind === 'TARGET') return ['ESCOLHE O ALVO', m.label + ' (Esc cancela).'];
      if (m.kind === 'SET_TRAP') return ['ESCONDER ARMADILHA', 'Clica numa casa vazia marcada (filas 1–6 do teu lado). Esc cancela.'];
      if (g.chain.status !== 'Idle') return ['CHAIN EM CURSO', 'As respostas resolvem do último elo para o primeiro.'];
      if (!this.isHumanTurn()) {
        if (g.mode === 'ONLINE') return [`VEZ DE ${g.teamName(s.active).toUpperCase()}`, 'À espera da jogada do adversário. Podes responder na Chain se tiveres cartas.'];
        return ['KING DICE ESTÁ A PENSAR…', 'Cuidado com as armadilhas e os Parries.'];
      }
      const colorName = YC.CardDatabase.COLOR_NAME[g.uno.activeColor] || '—';
      switch (s.phase) {
        case 'UNO_CARD_PHASE': {
          const any = g.uno.hand(v).some((c) => g.uno.matches(c));
          return ['1 · JOGA UMA CARTA', any
            ? `Combina com ${colorName} ou valor ${YC.CardView.bigLabel(g.uno.top)}. Podes também esconder 1 carta.`
            : 'Nada combina: compra de emergência (só Peão) ou usa a Soberania da Dama.'];
        }
        case 'BOARD_ACTION_PHASE':
          if (!s.permission.hasMoves) return ['2 · MOVE UMA PEÇA', 'Nenhuma peça permitida se pode mexer. Termina o turno.'];
          return ['2 · MOVE UMA PEÇA', this.selected ? 'Escolhe o destino. Ataques mostram a previsão (KO!, RECUO, CONTRA LETAL).' : 'Clica numa peça brilhante para ver as jogadas.'];
        case 'BONUS_STEP': return ['⚡ PASSO RELÂMPAGO', 'Dá 1 passo ortogonal para uma casa livre, ou salta.'];
        default: return ['…', ''];
      }
    }

    renderStrips() {
      const g = this.game, v = this.viewer, o = YC.other(v), s = g.state;
      const support = (team, mine) => s.players[team].support.map((card) => {
        if (!card) return '<div class="slot empty"></div>';
        if (!mine) return '<div class="slot set"><div class="mini-back"></div></div>';
        const ready = s.turnCount > card.turnSet;
        return `<div class="slot set mine c-${card.uno.color}" title="${esc(card.name)}"><span class="slot-name">${esc(card.name)}</span><em>${ready ? 'PRONTA' : 'zzz'}</em></div>`;
      }).join('');
      const grave = (team) => g.board.graveyard[team].map((p) => `<span class="gl team-${team.toLowerCase()}">${GLYPH[p.type]}</span>`).join('');
      const kingHp = (team) => { const k = g.board.king(team); return k ? `${k.hp}/${k.maxHp}` : '0'; };
      const opp = this.el.opp;
      const net = g.online ? g.online.oppStatus() : null;
      opp.querySelector('.name').textContent = net ? `${net.name} · ${net.rating}` : g.teamName(o);
      opp.querySelector('.sub').textContent = `${net ? (net.online ? '🟢 ligado · ' : '🔴 sem sinal · ') : ''}Rei ${kingHp(o)} HP · ${g.board.trapsOf(o).length} armadilha(s) oculta(s)`;
      opp.querySelector('.avatar').className = `avatar team-${o.toLowerCase()}`;
      const n = g.uno.hand(o).length;
      opp.querySelector('.opp-hand').innerHTML = `${'<div class="mini-back"></div>'.repeat(n)}<span class="count">${n}</span>`;
      opp.querySelector('.support-zone').innerHTML = support(o, false);
      opp.querySelector('.grave').innerHTML = grave(o);
      const me = this.el.me;
      me.querySelector('.name').textContent = g.mode === 'HOTSEAT' ? g.teamName(v) : `Tu (${YC.TEAM_LABEL[v]})`;
      me.querySelector('.sub').textContent = `Rei ${kingHp(v)} HP · ${g.board.trapsOf(v).length}/3 armadilhas`;
      me.querySelector('.avatar').className = `avatar team-${v.toLowerCase()}`;
      me.querySelector('.support-zone').innerHTML = support(v, true);
      me.querySelector('.grave').innerHTML = grave(v);
    }

    renderPile() {
      const g = this.game, u = g.uno, top = u.top;
      this.el.deck.innerHTML = `<div class="deck-stack"><div class="mini-back"></div><div class="mini-back"></div><div class="mini-back"></div></div><span>${u.deck.length}</span><small>baralho</small><small class="grave-count">☠ ${u.graveyard.length}</small>`;
      if (top && this.el.discard.dataset.uid !== top.uid) {
        this.el.discard.dataset.uid = top.uid;
        this.el.discard.replaceChildren(YC.CardView.create(top));
      }
      this.el.discard.className = `discard aura-${u.activeColor || 'W'}`;
      const p = g.state.permission;
      if (!p || g.state.active !== this.viewer) { this.el.perm.innerHTML = `<span class="perm-color c-${u.activeColor}">Cor ativa: ${YC.CardDatabase.COLOR_NAME[u.activeColor] || '—'}</span>`; return; }
      const who = p.zero ? 'Roque / Troca / Peão' : p.allowed === 'ALL' ? 'Qualquer peça' : p.allowed.map((t) => PT[t]).join(' · ');
      const b = p.boost, bits = [];
      if (b.atk) bits.push(`+${b.atk} ATK`);
      if (b.tempShield) bits.push(`+${b.tempShield} ESC temp`);
      if (b.shield) bits.push(`+${b.shield} ESC`);
      if (b.heal) bits.push(`+${b.heal} HP`);
      if (b.overdrive) bits.push('+25% ATK');
      if (b.pierce) bits.push('perfura');
      if (b.step) bits.push('+1 passo');
      this.el.perm.innerHTML = `<span class="perm-color c-${u.activeColor}">Cor ativa: ${YC.CardDatabase.COLOR_NAME[u.activeColor]}</span>
        <div class="perm-who">${p.source === 'FALLBACK' ? '🚨 Emergência: ' : '✔ '}${esc(who)}</div>${bits.length ? `<div class="perm-boost">${bits.join(' · ')}</div>` : ''}`;
    }

    renderActions() {
      const g = this.game, s = g.state, v = this.viewer, act = this.canAct();
      const show = (id, on) => { this.$(id).hidden = !on; };
      const en = (id, on) => { this.$(id).disabled = !on; };
      en('btn-fallback', act && s.phase === 'UNO_CARD_PHASE');
      show('btn-fallback', s.phase !== 'BONUS_STEP');
      const sov = g.canUseSovereignty(v);
      show('btn-sovereign', sov);
      en('btn-sovereign', act && s.phase === 'UNO_CARD_PHASE');
      this.$('btn-sovereign').classList.toggle('armed', !!s.players[v].sovereigntyArmed);
      this.$('btn-sovereign').textContent = s.players[v].sovereigntyArmed ? '👑 Soberania ARMADA' : '👑 Soberania da Dama';
      en('btn-end', act && ['UNO_CARD_PHASE', 'BOARD_ACTION_PHASE', 'BONUS_STEP'].includes(s.phase));
      show('btn-skip', s.phase === 'BONUS_STEP' && this.isHumanTurn());
      en('btn-skip', act);
      show('btn-cancel', this.mode.kind !== 'IDLE');
      show('btn-forfeit', !!(g.online && g.online.canClaimForfeit()));
      document.getElementById('btn-resign').hidden = !(g.online && !s.winner);
    }

    /** Atualização leve a cada segundo no modo online (relógio, abandono, estado do adversário). */
    renderOnline() {
      if (!this.game || !this.game.online) return;
      this.renderTop();
      this.renderActions();
      this.renderStrips();
    }

    renderChain() {
      const g = this.game, stack = g.chain.stack;
      if (!stack.length) { this.el.chain.innerHTML = '<li class="empty">Sem Chain ativa</li>'; return; }
      this.el.chain.innerHTML = stack.map((l) => `<li class="cl owner-${l.owner.toLowerCase()}${l.negated ? ' negated' : ''}${l.id === this.resolvingId ? ' resolving' : ''}">
        <b>CL${l.index}</b><span>${esc(l.label)}</span><i class="ss ss${l.ss}">SS${l.ss}</i></li>`).reverse().join('<li class="zap">ϟ</li>');
    }

    renderBoard() {
      const g = this.game, s = g.state, b = g.board, v = this.viewer, map = {}, flags = {}, m = this.mode;
      const add = (r, c, cls, extra) => { const k = `${r},${c}`; const h = map[k] || (map[k] = { cls: [] }); h.cls.push(cls); Object.assign(h, extra); };
      if (this.lastMove) { add(...this.lastMove.from, 'hl-last'); add(...this.lastMove.to, 'hl-last'); }
      if (this.declared) { add(...this.declared.from, 'hl-declared'); add(...this.declared.to, 'hl-declared-to'); }
      if (m.kind === 'TARGET') {
        for (const uid of m.candidates) { const p = b.getPiece(uid); add(p.row, p.col, 'hl-target', { click: true }); flags[uid] = { targetable: true }; }
      } else if (m.kind === 'SET_TRAP') {
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b.canSetTrapAt(v, r, c)) add(r, c, 'hl-trapset', { click: true });
      } else if (this.canAct() && s.phase === 'BOARD_ACTION_PHASE' && s.permission && !s.permission.used) {
        for (const p of b.pieces(v)) {
          if (b.getValidMoves(p, s.permission, s.turnCount).length) { flags[p.uid] = { movable: true }; add(p.row, p.col, 'hl-movable', { click: true }); }
        }
        const sel = this.selected && b.getPiece(this.selected);
        if (sel && sel.alive) {
          flags[sel.uid] = { selected: true };
          for (const mv of b.getValidMoves(sel, s.permission, s.turnCount)) {
            const [r, c] = mv.to;
            if (mv.type === 'ATTACK') {
              const pv = g.combat.preview(sel, b.getPiece(mv.defenderUid), mv, b, s.turnCount, s.permission.boost);
              add(r, c, 'hl-attack', { click: true, badge: this.renderer.badgeFor(pv.outcome) });
            } else add(r, c, mv.type === 'SWAP' ? 'hl-swap' : mv.type === 'CASTLE' ? 'hl-castle' : 'hl-move', { click: true });
          }
        } else this.selected = null;
      } else if (this.canAct() && s.phase === 'BONUS_STEP') {
        const piece = b.getPiece(s.bonusPieceUid);
        if (piece) { flags[piece.uid] = { selected: true }; for (const [r, c] of g.bonusSteps(piece)) add(r, c, 'hl-step', { click: true }); }
      }
      this.renderer.setHighlights(map);
      this.renderer.setPieceFlags(flags);
      this.renderer.setTrapMarkers(b.trapsOf(v).map((cell) => ({ row: cell.row, col: cell.col, trap: cell.trap })), s.turnCount);
    }

    renderHand() {
      const g = this.game, v = this.viewer, hand = g.uno.hand(v), host = this.el.hand;
      const keep = new Set(hand.map((c) => c.uid));
      for (const [uid, el] of this.handEls) if (!keep.has(uid)) { el.remove(); this.handEls.delete(uid); }
      const N = hand.length, W = host.clientWidth || 800;
      const cardW = 118;
      const spacing = N > 1 ? Math.min(cardW * 0.82, (W - cardW - 40) / (N - 1)) : 0;
      const act = this.canAct();
      hand.forEach((card, i) => {
        let el = this.handEls.get(card.uid);
        if (!el) {
          el = YC.CardView.create(card);
          el.classList.add('in-hand', 'dealt');
          el.addEventListener('click', (e) => { e.stopPropagation(); this.audio.playCardFlip(); this.openCardMenu(card, el); });
          el.addEventListener('mouseenter', () => this.showCardTip(card, el));
          el.addEventListener('mouseleave', () => this.el.inspector.classList.remove('show'));
          host.appendChild(el);
          this.handEls.set(card.uid, el);
          setTimeout(() => el.classList.remove('dealt'), 30);
        }
        const theta = -FAN_DEG / 2 + (FAN_DEG / (N + 1)) * (i + 1);
        const rad = theta * Math.PI / 180;
        el.style.setProperty('--rot', `${theta.toFixed(2)}deg`);
        el.style.setProperty('--x', `${((i - (N - 1) / 2) * spacing).toFixed(1)}px`);
        el.style.setProperty('--y', `${((1 - Math.cos(rad)) * 280).toFixed(1)}px`);
        el.style.zIndex = String(i + 1);
        el.classList.toggle('playable', act && g.canPlayCard(v, card));
        el.classList.toggle('settable', act && g.canSetNow(v) && card.yugioh.cardType !== 'NORMAL_SPELL');
      });
      host.classList.toggle('my-turn', act);
    }

    appendLog(line) {
      const li = document.createElement('li');
      li.className = `log-${line.kind}`;
      li.textContent = line.text;
      this.el.log.appendChild(li);
      while (this.el.log.children.length > 140) this.el.log.firstChild.remove();
      this.el.log.scrollTop = this.el.log.scrollHeight;
    }

    // ── Animações de cartas ──
    rectOf(el) { return el ? el.getBoundingClientRect() : null; }

    async fly(node, from, to, ms = 430) {
      if (!from || !to) return;
      node.classList.add('flying');
      Object.assign(node.style, { left: `${from.left + from.width / 2}px`, top: `${from.top + from.height / 2}px` });
      this.vfx.fxLayer.appendChild(node);
      const dx = to.left + to.width / 2 - (from.left + from.width / 2), dy = to.top + to.height / 2 - (from.top + from.height / 2);
      await node.animate([{ transform: 'translate(-50%,-50%) rotate(-8deg) scale(1)' },
        { transform: `translate(calc(-50% + ${dx * 0.5}px), calc(-50% + ${dy * 0.5 - 60}px)) rotate(10deg) scale(1.15)` },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0) scale(0.9)` }],
      { duration: ms * this.renderer.speed, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.catch(() => {});
      node.remove();
    }

    async showcase(card, team, link) {
      const wrap = document.createElement('div');
      wrap.className = `showcase owner-${team.toLowerCase()}`;
      wrap.innerHTML = `<div class="showcase-tag">CHAIN ${link.index}! · SS${link.ss}</div>`;
      wrap.appendChild(YC.CardView.create(card));
      this.vfx.fxLayer.appendChild(wrap);
      await wait(1050 * this.renderer.speed);
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 350);
    }

    subscribe() {
      const bus = this.bus, sr = () => this.scheduleRender();
      ['STATE_CHANGED', 'PHASE_CHANGED', 'CARDS_DRAWN', 'CHAIN_UPDATED', 'PERMISSION_GRANTED', 'TRAP_SET', 'DECK_RESHUFFLED', 'BUSY',
        'TURN_ENDED', 'CHAIN_LINK_NEGATED', 'UNO_CARD_RESOLVED', 'PIECE_DESTROYED', 'PIECE_DAMAGED', 'PIECE_HEALED'].forEach((e) => bus.on(e, sr));
      bus.on('LOG', (line) => this.appendLog(line));
      bus.on('TURN_STARTED', async ({ team }) => {
        this.selected = null; this.mode = { kind: 'IDLE' };
        const g = this.game;
        this.render();
        if (g.mode === 'HOTSEAT') {
          await YC.Screens.banner(`VEZ DAS ${g.teamName(team).toUpperCase()}!`, `team-${team.toLowerCase()}`, 700);
          await YC.Screens.curtain(`Vez das ${g.teamName(team)}`, 'Passa o ecrã. A tua mão e as tuas armadilhas ficam visíveis ao carregares.');
          this.render();
        } else {
          const mine = team === this.viewer;
          const text = mine ? 'A TUA VEZ!' : g.mode === 'AI' ? 'VEZ DO KING DICE!' : `VEZ DE ${g.teamName(team).toUpperCase()}!`;
          await YC.Screens.banner(text, `team-${team.toLowerCase()}`, 750 * this.renderer.speed);
        }
      });
      bus.on('MOVE_DECLARED', async ({ move, piece }) => {
        this.declared = { from: move.from, to: move.to };
        this.render();
        if (!this.game.agents[piece.team].isHuman) await wait(650 * this.renderer.speed);
      });
      bus.on('PIECE_MOVED', ({ from, to }) => { this.lastMove = { from, to }; });
      bus.on('CHAIN_CLEARED', () => { this.declared = null; this.resolvingId = null; sr(); });
      bus.on('UNO_CARD_PLAYED', async ({ team, card }) => {
        const el = this.handEls.get(card.uid);
        const from = el && team === this.viewer ? this.rectOf(el) : this.rectOf(this.el.opp.querySelector('.opp-hand'));
        if (el) el.style.visibility = 'hidden';
        this.audio.playCardFlip();
        await this.fly(YC.CardView.create(card), from, this.rectOf(this.el.discard));
      });
      bus.on('CARD_SET', async ({ team, zone, slot }) => {
        this.audio.playCardSet();
        const from = team === this.viewer ? this.rectOf(this.el.hand) : this.rectOf(this.el.opp.querySelector('.opp-hand'));
        const strip = team === this.viewer ? this.el.me : this.el.opp;
        const to = zone === 'SUPPORT' ? this.rectOf(strip.querySelectorAll('.support-zone .slot')[slot]) : this.rectOf(this.renderer.boardEl);
        await this.fly(YC.CardView.createBack({ small: true }), from, to, 380);
      });
      bus.on('CARD_ACTIVATED', async ({ card, team, link }) => {
        this.audio.playChainBell(link.index);
        if (card.yugioh.cardType === 'COUNTER_TRAP') this.audio.playBrassParryFanfare();
        sr();
        await this.showcase(card, team, link);
      });
      bus.on('CHAIN_RESOLVING', async ({ stack }) => {
        if (stack.length > 1) await YC.Screens.banner(`RESOLVER: ${stack.map((l) => 'CL' + l.index).reverse().join(' → ')}`, 'chain', 800 * this.renderer.speed);
      });
      bus.on('CHAIN_LINK_RESOLVING', async ({ link, stack }) => {
        this.resolvingId = link.id;
        this.renderChain();
        if (stack.length > 1) await wait(320 * this.renderer.speed);
      });
      bus.on('PARRY', async ({ card }) => {
        this.audio.playBrassParryFanfare();
        await this.vfx.triggerParryFlash(card && card.uno.value === 'REVERSE' ? 'PARRY!' : 'NEGADO!');
      });
      bus.on('UNO_CALL', async ({ team }) => {
        this.audio.playUnoCall();
        this.vfx.bigWord('UNO!', `uno team-${team.toLowerCase()}`);
        await wait(500);
      });
      bus.on('CARDS_LOST', ({ team, cards }) => { if (cards.length) this.toast(`${this.game.teamName(team)} perdeu ${cards.length} carta(s)!`); sr(); });
      bus.on('FALLBACK_DRAW', () => this.audio.playCardFlip());
    }
  }

  YC.UIManager = UIManager;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
