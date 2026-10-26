/* MatchHUD.js — topo da arena (acrescenta métodos ao MatchUI): retrato, nome, material, relógio e peças
   capturadas de cada jogador; última jogada em destaque; histórico escondido numa gaveta.
   Relógio: contra o bot cada jogador tem um tempo total (só conta na sua preparação); no online mostra
   os 2 minutos do turno de quem joga. */
(function (YC) {
  'use strict';

  const esc = (s) => YC.HoloCard.esc(s);
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const ORDER = 'qrbnp';

  const fmt = (ms) => {
    if (ms == null) return '∞';
    const t = Math.max(0, Math.ceil(ms / 1000));
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  };

  Object.assign(YC.MatchUI.prototype, {
    material(team) {
      let n = 0;
      for (const p of this.match.pos.board) if (p && p.color === team) n += VAL[this.match.realType(p)];
      return n;
    },

    renderHUD() {
      const m = this.match, s = m.state;
      for (const box of this.stage.querySelectorAll('.hud-p')) {
        const team = box.dataset.team, p = m.players[team], me = team === this.viewer;
        if (!box.firstChild) {
          box.innerHTML = `<div class="hud-col"><div class="hud-ava ${team}">${YC.PieceArt.svg('k', team)}</div><div class="hud-caps"></div></div>
            <div class="hud-stats"><b class="hud-name"></b><span class="hud-sub"></span><div class="hud-mat"></div><div class="hud-clock ${me ? 'mine' : 'theirs'}"></div></div>
            <div class="hud-hand" title="Cartas na mão"></div>`;
        }
        const nh = p.hand.length, hh = box.querySelector('.hud-hand');
        if (hh.dataset.n !== String(nh)) { hh.dataset.n = nh; hh.innerHTML = `${'<i></i>'.repeat(nh)}<b>${nh}</b>`; }
        box.classList.toggle('active', s.active === team && !m.over);
        box.querySelector('.hud-name').textContent = p.name;
        box.querySelector('.hud-sub').textContent = this.labels[team] || (team === 'w' ? 'Brancas' : 'Pretas');
        const mat = this.material(team), diff = mat - this.material(YC.other(team));
        box.querySelector('.hud-mat').innerHTML = `MATERIAL: <span>${mat}</span>${diff > 0 ? ` <em>+${diff}</em>` : ''}`;
        const lost = m.players[YC.other(team)].lostTypes.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
        const capKey = lost.join('');
        const caps = box.querySelector('.hud-caps');
        if (caps.dataset.key !== capKey) {
          caps.dataset.key = capKey;
          caps.innerHTML = lost.length ? lost.map((t) => `<i title="${YC.PIECE_NAME[t]}">${YC.PieceArt.svg(t, YC.other(team))}</i>`).join('') : '<small>—</small>';
          caps.title = lost.length ? `Capturou ${lost.length} peça(s)` : 'Ainda não capturou peças';
        }
      }
      const jl = this.q('.jumbo.left'), jr = this.q('.jumbo.right');
      if (jl) jl.innerHTML = `<div class="jb-bar"><span>TURNO</span><span>${Math.max(1, s.turnCount)}</span></div><div class="jb-title">${m.over ? 'FIM' : s.active === this.viewer ? 'A TUA VEZ' : 'ADVERSÁRIO'}</div>`;
      if (jr) jr.innerHTML = `<div class="jb-bar"><span>${m.chain ? 'CHAIN' : 'ARENA'}</span><span>${m.chain ? `ELO ${m.chain.length}` : 'AO VIVO'}</span></div><div class="jb-title">${m.chain ? 'RESPOSTAS' : 'NEON<br>DUEL'}</div>`;
      this.paintClocks();
    },

    // ───────────── relógios ─────────────
    startClock(totalMs) {
      this.stopClock();
      this.clockTotal = totalMs || 0;
      this.clock = { w: totalMs || null, b: totalMs || null };
      this.clockLast = Date.now();
      this.clockTimer = setInterval(() => this.tickClock(), 250);
    },

    stopClock() { clearInterval(this.clockTimer); this.clockTimer = 0; },

    tickClock() {
      const m = this.match, now = Date.now(), dt = now - this.clockLast;
      this.clockLast = now;
      if (!m || m.over || !this.stage) return;
      const s = m.state, team = s.active;
      if (!this.online && this.clockTotal && s.phase === 'PREP' && !m.busy && s.turnCount > 0) {
        this.clock[team] -= dt;
        if (this.clock[team] <= 0) {
          this.clock[team] = 0;
          this.paintClocks();
          this.toast(team === this.viewer ? 'O teu tempo acabou!' : 'O tempo do adversário acabou!');
          m.resign(team, 'Tempo esgotado');
          return;
        }
      }
      this.paintClocks();
    },

    paintClocks() {
      const m = this.match, s = m.state;
      for (const box of this.stage.querySelectorAll('.hud-p')) {
        const team = box.dataset.team, el = box.querySelector('.hud-clock');
        if (!el) continue;
        let ms;
        if (this.online) ms = s.active === team ? this.online.turnLeft() : YC.OnlineGame.TURN_MS;
        else ms = this.clockTotal ? this.clock[team] : null;
        el.textContent = fmt(ms);
        el.classList.toggle('running', s.active === team && !m.over);
        el.classList.toggle('low', ms != null && ms < 20000 && s.active === team && !m.over);
      }
    },

    // ───────────── histórico ─────────────
    renderLog() {
      if (!this.stage) return;
      const log = this.match.log;
      const line = (l) => `<span class="t-${l.team || 'x'}">${l.team ? `${esc(this.nameOf(l.team))}:` : ''}</span> ${esc(l.text)}`;
      const feed = this.q('.feed');
      feed.innerHTML = log.slice(-2).map((l) => `<p>${line(l)}</p>`).join('');
      if (window.gsap && feed.lastChild) window.gsap.fromTo(feed.lastChild, { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 });
      const list = this.q('.log-list');
      if (!this.q('.log-drawer').hidden) {
        list.innerHTML = log.map((l) => `<li><em>${l.turn || '–'}</em>${line(l)}</li>`).join('');
        list.scrollTop = list.scrollHeight;
      }
    },

    toggleLog(open) {
      const d = this.q('.log-drawer');
      d.hidden = open === undefined ? !d.hidden : !open;
      if (!d.hidden) {
        this.renderLog();
        if (window.gsap) window.gsap.fromTo(d, { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: 0.28, ease: 'back.out(1.6)' });
      }
    },

    renderOnline() {
      if (!this.online || !this.stage) return;
      const f = this.q('[data-act="forfeit"]');
      if (f) f.hidden = !this.online.canClaimForfeit();
      const st = this.online.oppStatus(), sub = this.q('.hud-p.opp .hud-sub');
      if (sub) sub.textContent = `${st.rating} pts · ${st.online ? 'ligado' : 'sem sinal…'}`;
      this.paintClocks();
    }
  });

  YC.MatchUI.fmtClock = fmt;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
