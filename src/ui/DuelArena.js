/* DuelArena.js — arena Speed Duel: 3 Zonas de Peças e 3 de Suporte por lado, LP com contador a rolar,
   pilha Uno central, mão em leque e as animações (invocação, investida, destruição, recuo, dados). */
(function (YC) {
  'use strict';

  const S = () => YC.DuelState;
  const def = (inst) => YC.DuelCards.BY_ID[inst.id];
  const esc = (s) => YC.DuelCardView.esc(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const FAN_DEG = 40;

  function duelistHTML(side) {
    return `<div class="duelist ${side}">
      <div class="duelist-id"><div class="avatar"></div><div><b class="dname"></b><small class="dsub"></small></div></div>
      <div class="lp-box"><span class="lp-label">LP</span><span class="lp-num">4000</span><div class="lp-bar"><i></i></div></div>
      <div class="pile-mini deck" title="Baralho"><div class="mini-back"></div><b class="deck-n">0</b></div>
      <div class="pile-mini gy" title="Cemitério"><span>☠</span><b class="gy-n">0</b></div>
      ${side === 'foe' ? '<div class="foe-hand"></div>' : ''}</div>`;
  }
  const zonesHTML = (side, kind) => `<div class="zones ${kind} ${side}">${[0, 1, 2].map((i) => `<div class="zone ${kind === 'monsters' ? 'zm' : 'zs'}" data-side="${side}" data-kind="${kind}" data-i="${i}"></div>`).join('')}</div>`;

  class DuelArena {
    constructor({ bus, vfx, audio, animator }) {
      this.bus = bus; this.vfx = vfx; this.audio = audio; this.animator = animator;
      this.game = null; this.viewer = 'WHITE'; this.speed = 1;
      this.monNodes = new Map(); this.handEls = new Map();
      this.flags = { selectable: new Set(), selected: null, targets: new Set(), picked: new Set() };
      this.onZone = null; this.onHand = null; this.onHover = null;
    }

    mount(root) {
      this.root = root;
      root.innerHTML = `
        <section class="duel-field">
          ${duelistHTML('foe')}${zonesHTML('foe', 'backrow')}${zonesHTML('foe', 'monsters')}
          <div class="midline"><div class="uno-pile"><div class="uno-disc"><span class="uno-sym"></span></div><small>Pilha Uno</small></div>
            <div class="mid-phase"></div></div>
          ${zonesHTML('me', 'monsters')}${zonesHTML('me', 'backrow')}${duelistHTML('me')}
        </section>
        <aside class="duel-side">
          <div class="panel duel-phase-box"><div class="phase-title"></div><div class="phase-hint"></div></div>
          <div class="panel duel-actions">
            <button class="btn" data-act="battle">⚔ Fase de Batalha</button>
            <button class="btn gold" data-act="direct" hidden>💥 Ataque direto</button>
            <button class="btn gold" data-act="confirm" hidden>✔ Confirmar tributos</button>
            <button class="btn ghost" data-act="skip" hidden>Sem alvo</button>
            <button class="btn ghost" data-act="cancel" hidden>Cancelar</button>
            <button class="btn gold" data-act="forfeit" hidden>🏆 Reclamar vitória (abandono)</button>
            <button class="btn red" data-act="end">Terminar turno ▶</button>
          </div>
          <div class="panel duel-chain"><h3>Chain <small>LIFO</small></h3><ol class="chain-list"></ol></div>
          <div class="panel duel-log"><h3>Registo</h3><ol class="log"></ol></div>
        </aside>
        <footer class="duel-hand-area"><div class="duel-hand"></div><div class="duel-menu" hidden></div></footer>`;
      this.el = {
        field: root.querySelector('.duel-field'), hand: root.querySelector('.duel-hand'), menu: root.querySelector('.duel-menu'),
        pile: root.querySelector('.uno-pile'), midPhase: root.querySelector('.mid-phase'), log: root.querySelector('.duel-log .log'),
        chain: root.querySelector('.duel-chain .chain-list'), phaseTitle: root.querySelector('.duel-phase-box .phase-title'),
        phaseHint: root.querySelector('.duel-phase-box .phase-hint')
      };
      root.querySelectorAll('.zone').forEach((z) => {
        z.addEventListener('click', () => this.onZone && this.onZone(z.dataset.side, z.dataset.kind, Number(z.dataset.i)));
        z.addEventListener('mouseenter', () => this.onHover && this.onHover(z.dataset.side, z.dataset.kind, Number(z.dataset.i), z));
        z.addEventListener('mouseleave', () => this.onHover && this.onHover(null));
      });
      this.subscribe();
    }

    bind(game, viewer) {
      this.game = game; this.viewer = viewer;
      for (const n of this.monNodes.values()) { this.animator.remove(n.rig); n.node.remove(); }
      this.monNodes.clear();
      this.handEls.forEach((e) => e.remove()); this.handEls.clear();
      this.el.log.innerHTML = '';
      this.lpShown = { WHITE: 4000, BLACK: 4000 };
      this.render();
    }

    sideOf(team) { return team === this.viewer ? 'me' : 'foe'; }
    teamOf(side) { return side === 'me' ? this.viewer : YC.other(this.viewer); }
    zoneEl(side, kind, i) { return this.root.querySelector(`.zones.${kind}.${side} .zone[data-i="${i}"]`); }
    zoneOfUid(uid) {
      const loc = uid && S().locate(this.game, uid);
      if (!loc || (loc.zone !== 'monsters' && loc.zone !== 'backrow')) return null;
      return this.zoneEl(this.sideOf(loc.team), loc.zone, loc.index);
    }
    center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

    // ── Renderização ──
    render() {
      const g = this.game;
      if (!g || !g.state) return;
      for (const side of ['me', 'foe']) { this.renderDuelist(side); this.renderZones(side); }
      this.renderPile();
      this.renderHand();
    }

    renderDuelist(side) {
      const g = this.game, team = this.teamOf(side), p = g.state.players[team];
      const box = this.root.querySelector(`.duelist.${side}`);
      box.querySelector('.avatar').className = `avatar team-${team.toLowerCase()}`;
      box.querySelector('.dname').textContent = side === 'me' && g.mode !== 'HOTSEAT' ? `Tu · ${g.teamName(team)}` : g.teamName(team);
      box.querySelector('.dsub').textContent = this.subFor ? this.subFor(team) : '';
      box.querySelector('.deck-n').textContent = p.deck.length;
      box.querySelector('.gy-n').textContent = p.gy.length;
      if (!this.lpAnim || !this.lpAnim[team]) this.setLp(team, p.lp);
      box.classList.toggle('active', g.state.active === team);
      if (side === 'foe') box.querySelector('.foe-hand').innerHTML = '<div class="mini-back"></div>'.repeat(p.hand.length) + `<span class="count">${p.hand.length}</span>`;
    }

    setLp(team, lp) {
      const box = this.root.querySelector(`.duelist.${this.sideOf(team)}`);
      box.querySelector('.lp-num').textContent = Math.round(lp);
      box.querySelector('.lp-bar i').style.width = `${Math.max(0, Math.min(100, (lp / 4000) * 100))}%`;
      box.classList.toggle('low', lp <= 1000);
      this.lpShown[team] = lp;
    }

    /** Contador estilo velocímetro: os números rolam até ao novo valor. */
    rollLp(team, to) {
      this.lpAnim = this.lpAnim || {};
      const from = this.lpShown[team], t0 = performance.now(), dur = 700 * this.speed;
      const box = this.root.querySelector(`.duelist.${this.sideOf(team)}`);
      box.classList.remove('hit', 'healed'); void box.offsetWidth;
      box.classList.add(to < from ? 'hit' : 'healed');
      this.lpAnim[team] = true;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        this.setLp(team, from + (to - from) * e);
        if (k < 1) requestAnimationFrame(step); else this.lpAnim[team] = false;
      };
      requestAnimationFrame(step);
    }

    monNode(inst, team) {
      let n = this.monNodes.get(inst.uid);
      if (n && n.team === team) return n;
      if (n) { this.animator.remove(n.rig); n.node.remove(); }
      const card = def(inst);
      const node = document.createElement('div');
      node.className = `mon r-${card.rarity} c-${card.color}`;
      const rig = YC.DuelArt.monsterRig(card, team, { boil: true });
      node.innerHTML = '<div class="mon-card"><div class="mon-art"></div></div><div class="mon-plate"></div><div class="mon-badges"></div>';
      node.querySelector('.mon-art').appendChild(rig.svg);
      this.animator.add(rig);
      n = { node, rig, team };
      this.monNodes.set(inst.uid, n);
      return n;
    }

    renderZones(side) {
      const g = this.game, team = this.teamOf(side), p = g.state.players[team], f = this.flags;
      p.monsters.forEach((m, i) => {
        const z = this.zoneEl(side, 'monsters', i);
        z.className = 'zone zm';
        if (!m) { if (z.firstChild && !z.querySelector('.dropping')) z.replaceChildren(); return; }
        const n = this.monNode(m, team);
        if (n.node.parentElement !== z) z.replaceChildren(n.node);
        const st = S().stats(g, m), c = def(m);
        n.node.classList.toggle('pos-def', m.position === 'DEF');
        n.node.classList.toggle('stunned', S().isStunned(g, m));
        const up = st.atk > c.atk, down = st.atk < c.atk;
        n.node.querySelector('.mon-plate').innerHTML = `<span class="a${up ? ' up' : down ? ' down' : ''}">${st.atk}</span><i>/</i><span class="d">${st.def}</span>`;
        n.node.querySelector('.mon-badges').innerHTML = `${S().isStunned(g, m) ? '<b class="stun">★</b>' : ''}${m.attacks && g.state.active === team ? '<b class="done">✓</b>' : ''}`;
        z.classList.toggle('selectable', f.selectable.has(m.uid));
        z.classList.toggle('selected', f.selected === m.uid);
        z.classList.toggle('target', f.targets.has(m.uid));
        z.classList.toggle('picked', f.picked.has(m.uid));
      });
      for (const [uid, n] of this.monNodes) {
        const loc = S().locate(g, uid);
        if (!loc || loc.zone !== 'monsters') { if (!n.node.classList.contains('dying')) { this.animator.remove(n.rig); n.node.remove(); this.monNodes.delete(uid); } }
      }
      p.backrow.forEach((b, i) => {
        const z = this.zoneEl(side, 'backrow', i);
        z.className = 'zone zs';
        if (!b) { z.replaceChildren(); return; }
        const key = `${b.uid}:${side}:${b.revealed ? 1 : 0}`;
        if (z.dataset.key !== key || !z.firstChild) {
          z.dataset.key = key;
          const card = def(b);
          const node = side === 'me' || b.revealed ? YC.DuelCardView.create(card, { tiny: true }) : YC.DuelCardView.createBack({ tiny: true });
          node.classList.add('set-card');
          if (side === 'me') node.insertAdjacentHTML('beforeend', '<em class="set-tag"></em>');
          if (side === 'foe' && b.revealed) node.insertAdjacentHTML('beforeend', '<em class="set-tag rev">REVELADA</em>');
          z.replaceChildren(node);
        }
        const tag = z.querySelector('.set-tag:not(.rev)');
        if (tag) tag.textContent = b.setTurn < g.state.turnCount ? 'PRONTA' : 'zzz';
        z.classList.toggle('selectable', f.selectable.has(b.uid));
        z.classList.toggle('target', f.targets.has(b.uid));
      });
    }

    renderPile() {
      const pile = this.game.state.pile;
      this.el.pile.className = `uno-pile c-${pile.color}`;
      this.el.pile.querySelector('.uno-sym').textContent = YC.DuelCards.SYMBOL_LABEL[pile.symbol] || pile.symbol || '';
      this.el.pile.title = `Pilha Uno: ${YC.CardDatabase.COLOR_NAME[pile.color]} ${pile.symbol}. Cartas da mesma cor ou símbolo ganham Sintonia (+300 ATK ou custo grátis).`;
    }

    renderHand() {
      const g = this.game, hand = g.state.players[this.viewer].hand, host = this.el.hand, f = this.flags;
      const keep = new Set(hand.map((c) => c.uid));
      for (const [uid, el] of this.handEls) if (!keep.has(uid)) { el.remove(); this.handEls.delete(uid); }
      const N = hand.length, W = host.clientWidth || 700, cardW = 120;
      const spacing = N > 1 ? Math.min(cardW * 0.8, (W - cardW - 30) / (N - 1)) : 0;
      hand.forEach((inst, i) => {
        let el = this.handEls.get(inst.uid);
        if (!el) {
          el = YC.DuelCardView.create(def(inst), { side: this.viewer });
          el.classList.add('in-hand', 'dealt');
          el.addEventListener('click', (e) => { e.stopPropagation(); if (this.onHand) this.onHand(inst, el); });
          el.addEventListener('mouseenter', () => this.onHover && this.onHover('hand', null, null, el, inst));
          el.addEventListener('mouseleave', () => this.onHover && this.onHover(null));
          host.appendChild(el);
          this.handEls.set(inst.uid, el);
          setTimeout(() => el.classList.remove('dealt'), 30);
        }
        const th = -FAN_DEG / 2 + (FAN_DEG / (N + 1)) * (i + 1);
        el.style.setProperty('--rot', `${th.toFixed(2)}deg`);
        el.style.setProperty('--x', `${((i - (N - 1) / 2) * spacing).toFixed(1)}px`);
        el.style.setProperty('--y', `${((1 - Math.cos(th * Math.PI / 180)) * 260).toFixed(1)}px`);
        el.style.zIndex = String(i + 1);
        el.classList.toggle('playable', f.selectable.has(inst.uid));
        el.classList.toggle('sintonia', S().sintonia(g, def(inst)));
        el.classList.toggle('picked', f.picked.has(inst.uid));
      });
    }

    appendLog(line) {
      const li = document.createElement('li');
      li.className = `log-${line.kind}`;
      li.textContent = line.text;
      this.el.log.appendChild(li);
      while (this.el.log.children.length > 140) this.el.log.firstChild.remove();
      this.el.log.scrollTop = this.el.log.scrollHeight;
    }

    renderChain(stack, resolvingId) {
      this.el.chain.innerHTML = !stack.length ? '<li class="empty">Sem Chain ativa</li>'
        : stack.map((l) => `<li class="cl owner-${l.owner.toLowerCase()}${l.negated ? ' negated' : ''}${l.id === resolvingId ? ' resolving' : ''}">
          <b>CL${l.index}</b><span>${esc(l.label)}</span><i class="ss ss${l.ss}">SS${l.ss}</i></li>`).reverse().join('<li class="zap">ϟ</li>');
    }

    // ── Animações ──
    floatAt(el, text, kind = '') { if (!el) return; const c = this.center(el); this.vfx.floatText(c.x, c.y - 20, text, kind); }

    async dropIn(inst) {
      const z = this.zoneOfUid(inst.uid);
      this.render();
      const n = this.monNodes.get(inst.uid);
      if (!z || !n) return;
      this.audio.playThud();
      await n.node.animate([
        { transform: 'translateY(-120px) scale(1.3) rotate(-8deg)', opacity: 0 }, { transform: 'translateY(0) scale(1.15,0.8)', opacity: 1, offset: 0.6 },
        { transform: 'scale(0.95,1.08)', offset: 0.8 }, { transform: 'none' }
      ], { duration: 520 * this.speed, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished.catch(() => {});
      const c = this.center(z);
      this.vfx.spawnCartoonExplosion(c.x, c.y + 30, '#F4E7C5', ' ');
    }

    async lunge(attacker, target, team) {
      const a = this.monNodes.get(attacker.uid), from = this.zoneOfUid(attacker.uid);
      if (!a || !from) return;
      const toEl = target ? this.zoneOfUid(target.uid) : this.root.querySelector(`.duelist.${this.sideOf(YC.other(team))} .lp-box`);
      if (!toEl) return;
      const p0 = this.center(from), p1 = this.center(toEl);
      const dx = (p1.x - p0.x) * 0.75, dy = (p1.y - p0.y) * 0.75;
      a.node.style.zIndex = '30';
      this.audio.playJumpBoing();
      await a.node.animate([{ transform: 'none' }, { transform: `translate(${dx * 0.2}px, ${dy * 0.2 + 20}px) scale(1.2,0.85)`, offset: 0.25 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.9,1.15)`, offset: 0.7 }, { transform: `translate(${dx}px, ${dy}px) scale(1.3,0.75)` }],
      { duration: 380 * this.speed, easing: 'ease-in' }).finished.catch(() => {});
      this.audio.playAnvilHit();
      this.vfx.triggerScreenShake(8, 260);
      if (target) this.vfx.chromaticHit(this.zoneOfUid(target.uid));
      a.node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 300 * this.speed, easing: 'ease-out' })
        .finished.then(() => { a.node.style.zIndex = ''; }).catch(() => {});
      await wait(120);
    }

    async destroyFx(inst, word) {
      const n = this.monNodes.get(inst.uid), z = this.zoneOfUid(inst.uid);
      if (!n || !z) return;
      const c = this.center(z);
      n.node.classList.add('dying');
      this.vfx.spawnCartoonExplosion(c.x, c.y, inst.owner === this.viewer ? '#E5A93C' : '#C83E3B', word);
      this.audio.playExplosion();
      this.vfx.triggerScreenShake(10, 360);
      await n.node.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(1.4,0.5) rotate(15deg)', opacity: 1, offset: 0.3 },
        { transform: 'scale(0.1) rotate(380deg)', opacity: 0 }], { duration: 480 * this.speed, fill: 'forwards' }).finished.catch(() => {});
      this.animator.remove(n.rig); n.node.remove(); this.monNodes.delete(inst.uid);
    }

    async dice(inst, roll) {
      const z = this.zoneOfUid(inst.uid) || this.root;
      const c = this.center(z);
      const d = document.createElement('div');
      d.className = 'dice-pop';
      d.style.left = `${c.x}px`; d.style.top = `${c.y}px`;
      d.innerHTML = `<b>${'⚀⚁⚂⚃⚄⚅'[roll - 1]}</b><span>${roll}</span>`;
      this.vfx.fxLayer.appendChild(d);
      this.audio.playCardFlip();
      await wait(900 * this.speed);
      d.remove();
    }

    subscribe() {
      const bus = this.bus;
      const r = () => this.render();
      ['DUEL_DRAW', 'DUEL_PILE', 'DUEL_TO_GY', 'PHASE_CHANGED', 'STATE_CHANGED', 'TURN_ENDED'].forEach((e) => bus.on(e, r));
      bus.on('LOG', (l) => this.appendLog(l));
      bus.on('DUEL_SUMMONED', async ({ inst }) => this.dropIn(inst));
      bus.on('DUEL_SET', async () => { this.audio.playCardSet(); this.render(); await wait(200); });
      bus.on('DUEL_ATTACK_DECLARED', async ({ attacker, target }) => {
        this.flags.selected = attacker.uid; this.flags.targets = new Set(target ? [target.uid] : []); this.render();
        await wait(450 * this.speed);
      });
      bus.on('DUEL_BATTLE', async ({ attacker, target }) => {
        this.flags.selected = null; this.flags.targets = new Set();
        await this.lunge(attacker, target, attacker.owner);
      });
      bus.on('DUEL_DESTROYED', async ({ inst, word }) => this.destroyFx(inst, word));
      bus.on('DUEL_BOUNCE', async ({ inst }) => { this.audio.playSlideWhistleDown(); this.floatAt(this.zoneOfUid(inst.uid), 'BOING!', 'boing'); await wait(300); });
      bus.on('DUEL_LP', async ({ team, delta, lp, cost }) => {
        const box = this.root.querySelector(`.duelist.${this.sideOf(team)} .lp-box`);
        this.floatAt(box, `${delta > 0 ? '+' : ''}${delta}`, delta > 0 ? 'heal' : cost ? 'cost' : 'dmg');
        if (delta < 0) { this.audio.playPunch(); if (-delta >= 1000) this.vfx.triggerScreenShake(12, 380); } else this.audio.playHeal();
        this.rollLp(team, lp);
        await wait(300 * this.speed);
      });
      bus.on('DUEL_MOD', async ({ inst, stat, amount }) => {
        this.render();
        this.floatAt(this.zoneOfUid(inst.uid), `${amount > 0 ? '+' : ''}${amount} ${stat === 'atk' ? 'ATK' : 'DEF'}`, amount > 0 ? 'buff' : 'debuff');
        this.audio.playPowerUp();
        await wait(220 * this.speed);
      });
      bus.on('DUEL_POSITION', async ({ inst, word }) => { this.render(); if (word) this.floatAt(this.zoneOfUid(inst.uid), word, 'stun'); this.audio.playClick(); await wait(250); });
      bus.on('DUEL_STATUS', async ({ inst, text }) => { this.render(); this.floatAt(this.zoneOfUid(inst.uid), text, 'stun'); this.audio.playFreeze(); await wait(300); });
      bus.on('DUEL_BACKROW_DESTROYED', async ({ inst }) => { const z = this.zoneOfUid(inst.uid); if (z) { const c = this.center(z); this.vfx.spawnCartoonExplosion(c.x, c.y, '#d77ce0', 'CRASH!'); } this.audio.playExplosion(); await wait(350); });
      bus.on('DUEL_REVEAL', async ({ inst }) => { this.render(); this.floatAt(this.zoneOfUid(inst.uid), 'REVELADA!', 'buff'); await wait(400); });
      bus.on('DUEL_BOUNCED_TO_HAND', async () => { this.audio.playSlideWhistleDown(); this.vfx.bigWord('DE VOLTA À MÃO!', 'trap'); await wait(600); });
      bus.on('DUEL_DICE', async ({ inst, roll }) => this.dice(inst, roll));
      bus.on('DUEL_SINTONIA', async () => { this.vfx.bigWord('SINTONIA UNO!', 'uno'); this.audio.playUnoCall(); await wait(450 * this.speed); });
      bus.on('DUEL_PARRY', async ({ card }) => { this.audio.playBrassParryFanfare(); await this.vfx.triggerParryFlash(card.id === 'parry_absoluto' ? 'PARRY!' : 'NEGADO!'); });
      bus.on('DUEL_FIELD', async () => { this.root.classList.remove('polarity'); void this.root.offsetWidth; this.root.classList.add('polarity'); await wait(500); this.render(); });
      bus.on('DUEL_ATTACK_CANCELLED', async () => { this.flags.selected = null; this.flags.targets = new Set(); this.render(); });
    }
  }

  YC.DuelArena = DuelArena;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
