/* DuelUI.js — interação do Speed Duel: menus de carta, invocação com tributos, escolha de alvos,
   ataques, janela de Chain e o agente humano. Mesma interface que o UIManager usa no online
   (toast, dispatch, cancelMode, scheduleRender, renderOnline, createHumanAgent). */
(function (YC) {
  'use strict';

  const S = () => YC.DuelState;
  const Fx = () => YC.DuelEffects;
  const def = (inst) => YC.DuelCards.BY_ID[inst.id];
  const esc = (s) => YC.DuelCardView.esc(s);

  class DuelUI {
    constructor({ bus, vfx, audio, animator }) {
      this.bus = bus; this.vfx = vfx; this.audio = audio; this.animator = animator;
      this.arena = new YC.DuelArena({ bus, vfx, audio, animator });
      this.game = null; this.mode = { kind: 'IDLE' }; this.queued = false; this.resolvingId = null;
    }

    mount(root) {
      this.arena.mount(root);
      const a = this.arena;
      a.onZone = (side, kind, i) => this.onZone(side, kind, i);
      a.onHand = (inst, el) => this.onHand(inst, el);
      a.onHover = (side, kind, i, el, inst) => this.onHover(side, kind, i, el, inst);
      a.subFor = (team) => this.subFor(team);
      root.querySelectorAll('.duel-actions [data-act]').forEach((b) => b.addEventListener('click', () => { this.audio.playClick(); this.onAction(b.dataset.act); }));
      document.addEventListener('click', (e) => { if (!e.target.closest('.duel-menu') && !e.target.closest('.duel-hand .dcard') && !e.target.closest('.zone')) this.closeMenu(); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.game) { this.cancelMode(); this.closeMenu(); } });
      this.subscribe();
    }

    bindGame(game) {
      this.game = game;
      this.mode = { kind: 'IDLE' };
      this.arena.speed = YC.app ? YC.app.renderer.speed : 1;
      this.arena.bind(game, this.viewer);
      this.render();
    }

    get viewer() {
      const g = this.game;
      if (!g) return 'WHITE';
      if (g.localTeam) return g.localTeam;
      return g.mode === 'HOTSEAT' ? g.state.active : 'WHITE';
    }

    createHumanAgent(team) {
      return { isHuman: true, team, playTurn: () => this.scheduleRender(), respondChain: (ctx) => this.askChain(ctx) };
    }

    isMyTurn() { const g = this.game; return !!g && g.state.active === this.viewer && g.agents[g.state.active] && g.agents[g.state.active].isHuman; }
    canAct() { const g = this.game; return !!g && !g.busy && !g.state.winner && this.isMyTurn() && g.chain.status === 'Idle'; }

    async dispatch(action) {
      const g = this.game;
      if (!g) return false;
      this.closeMenu();
      const ok = await g.dispatch({ ...action, team: g.state.active });
      if (!ok && !g.state.winner) this.toast('Isso não é possível agora.');
      this.scheduleRender();
      return ok;
    }

    toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
    scheduleRender() { if (this.queued) return; this.queued = true; requestAnimationFrame(() => { this.queued = false; this.render(); }); }
    renderOnline() { this.renderTop(); this.renderActions(); this.arena.renderDuelist('foe'); }

    subFor(team) {
      const g = this.game, p = g.state.players[team];
      const net = g.online && team !== this.viewer ? g.online.oppStatus() : null;
      return `${net ? `${net.online ? '🟢' : '🔴'} rating ${net.rating} · ` : ''}mão ${p.hand.length} · ${S().backrowOf(g, team).length}/3 viradas`;
    }

    // ── Modos de escolha ──
    cancelMode() {
      const m = this.mode;
      this.mode = { kind: 'IDLE' };
      this.arena.flags.picked = new Set();
      if (m.resolve) m.resolve(null);
      this.scheduleRender();
    }

    pick(kind, uids, label, opts = {}) {
      return new Promise((resolve) => {
        this.mode = { kind, uids: new Set(uids), label, resolve, optional: !!opts.optional, count: opts.count || 1, valid: opts.valid, picked: [] };
        this.render();
      });
    }

    finishPick(value) { const m = this.mode; this.mode = { kind: 'IDLE' }; this.arena.flags.picked = new Set(); m.resolve(value); this.scheduleRender(); }

    choice(title, options) {
      return new Promise((resolve) => {
        const m = document.createElement('div');
        m.className = 'modal';
        m.innerHTML = `<div class="modal-card"><h2>${esc(title)}</h2><div class="choice-list">${options.map((o, i) => `<button class="btn-big ${o.alt ? 'alt' : ''}" data-i="${i}">${esc(o.label)}</button>`).join('')}</div>
          <div class="modal-actions"><button class="btn-link" data-x>Cancelar</button></div></div>`;
        document.getElementById('modal-root').appendChild(m);
        m.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => { m.remove(); resolve(options[Number(b.dataset.i)].value); }));
        m.querySelector('[data-x]').addEventListener('click', () => { m.remove(); resolve(null); });
      });
    }

    async pickTargets(inst) {
      const g = this.game, me = this.viewer, c = def(inst), t = {};
      const list = (spec) => Fx().candidates(g, me, spec, inst.uid);
      switch (c.target) {
        case 'ALLY': t.monsterUid = await this.pick('MONSTER', list('ALLY').map((m) => m.uid), 'Escolhe a tua peça'); if (!t.monsterUid) return null; break;
        case 'ENEMY_ATK': t.monsterUid = await this.pick('MONSTER', list('ENEMY_ATK').map((m) => m.uid), 'Escolhe a peça inimiga em Ataque'); if (!t.monsterUid) return null; break;
        case 'ALLY_OPTIONAL': if (list('ALLY').length) { const v = await this.pick('MONSTER', list('ALLY').map((m) => m.uid), 'Peça a limpar (ou "Sem alvo")', { optional: true }); if (v === null) return null; t.monsterUid = v || null; } break;
        case 'HAND_DISCARD': t.discardUid = await this.pick('HAND', list('HAND_DISCARD').map((x) => x.uid), 'Escolhe a carta a descartar'); if (!t.discardUid) return null; break;
        case 'GY_MONSTER': {
          const v = await this.choice('Que peça volta do Cemitério?', list('GY_MONSTER').map((x) => ({ label: `${def(x).name} (${def(x).atk} ATK)`, value: x.uid })));
          if (!v) return null; t.gyUid = v; break;
        }
        default: break;
      }
      return t;
    }

    // ── Ações a partir da mão ──
    handOptions(inst) {
      const g = this.game, me = this.viewer, c = def(inst), opts = [];
      if (!this.canAct()) return opts;
      if (c.category === 'MONSTER' && g.canNormalSummon(me, inst)) {
        const n = YC.DuelCards.tributesFor(c);
        const suffix = n ? ` (${n} tributo${n > 1 ? 's' : ''})` : '';
        opts.push(['⚔ Invocar em Ataque' + suffix, () => this.summon(inst, 'ATK')], ['🛡 Invocar em Defesa' + suffix, () => this.summon(inst, 'DEF')]);
      }
      if (c.category !== 'MONSTER' && Fx().canActivate(g, me, inst)) opts.push(['▶ Ativar', () => this.activate(inst)]);
      if (g.canSet(me, inst)) opts.push(['⚑ Virar no Suporte', () => this.dispatch({ type: 'SET_CARD', uid: inst.uid })]);
      return opts;
    }

    whyNot(inst) {
      const g = this.game, c = def(inst), s = g.state;
      if (!this.isMyTurn()) return 'Espera pela tua vez.';
      if (g.busy || g.chain.status !== 'Idle') return 'Aguarda o fim da ação.';
      if (c.category === 'MONSTER') {
        if (s.phase !== 'MAIN') return 'Só podes invocar na Fase Principal.';
        if (g.player(this.viewer).summonTurn === s.turnCount) return 'Já fizeste a Invocação Normal deste turno.';
        const n = YC.DuelCards.tributesFor(c);
        return n ? `Precisas de ${n} peça(s) em campo para tributar.` : 'As 3 Zonas de Peças estão ocupadas.';
      }
      if (c.category === 'TRAP' || c.category === 'COUNTER_TRAP') return 'Armadilhas viram-se no Suporte e ativam-se em resposta, a partir do turno seguinte.';
      if (c.id === 'xeque_mate_diabo') return 'Só com menos de 1500 LP.';
      if (c.id === 'compra_gananciosa') return 'Precisa da Pilha Amarela ou de menos LP que o rival.';
      return s.phase === 'BATTLE' && c.category === 'SPELL' ? 'Feitiços Normais só na Fase Principal.' : 'Sem alvos válidos agora.';
    }

    async summon(inst, position) {
      const g = this.game, me = this.viewer, c = def(inst);
      let tributes = [];
      const need = YC.DuelCards.tributesFor(c);
      if (need) {
        const own = S().monstersOf(g, me);
        const valid = (sel) => sel.length === need || (c.id === 'dama_sereia' && sel.length === 1 && def(S().locate(g, sel[0]).inst).color === 'B');
        tributes = await this.pick('TRIBUTE', own.map((m) => m.uid), `Escolhe ${need} tributo(s)${c.id === 'dama_sereia' ? ' (ou 1 peça Azul)' : ''}`, { count: need, valid });
        if (!tributes) return;
      }
      let color = null;
      if (c.color === 'W') { color = await YC.Screens.colorPicker(this.audio); if (!color) return; }
      let targetUid = null;
      if (c.target === 'ENEMY_OPTIONAL' && S().monstersOf(g, YC.other(me)).length) {
        targetUid = await this.pick('MONSTER', S().monstersOf(g, YC.other(me)).map((m) => m.uid), 'Que peça inimiga fica paralisada?', { optional: true });
        if (targetUid === null) return;
      }
      await this.dispatch({ type: 'NORMAL_SUMMON', uid: inst.uid, position, tributes, color, targetUid: targetUid || null });
    }

    async activate(inst) {
      const c = def(inst);
      const targets = await this.pickTargets(inst);
      if (!targets) return;
      let color = null;
      if (c.chooseColor) { color = await YC.Screens.colorPicker(this.audio); if (!color) return; }
      await this.dispatch({ type: 'ACTIVATE', uid: inst.uid, targets, color });
    }

    async monsterEffect(inst) {
      const g = this.game, me = this.viewer;
      if (inst.id === 'torre_locomotiva') {
        const d = await this.pick('HAND', Fx().candidates(g, me, 'HAND_RED').map((x) => x.uid), 'Descarta 1 carta Vermelha');
        if (d) await this.dispatch({ type: 'MONSTER_EFFECT', uid: inst.uid, targets: { discardUid: d } });
      } else if (inst.id === 'bispo_arcanjo') {
        const pawns = Fx().candidates(g, me, 'GY_PAWN2');
        const choice = await this.choice('Bispo Arcanjo', [{ label: 'Recuperar 500 LP', value: 'HEAL' }].concat(pawns.length ? [{ label: `Reviver ${def(pawns[0]).name}`, value: 'REVIVE', alt: true }] : []));
        if (choice) await this.dispatch({ type: 'MONSTER_EFFECT', uid: inst.uid, targets: { choice, gyUid: pawns[0] && pawns[0].uid } });
      } else await this.dispatch({ type: 'MONSTER_EFFECT', uid: inst.uid, targets: {} });
    }

    // ── Cliques ──
    onHand(inst, el) {
      this.audio.playCardFlip();
      const m = this.mode;
      if (m.kind === 'HAND') { if (m.uids.has(inst.uid)) this.finishPick(inst.uid); return; }
      if (m.kind !== 'IDLE') return;
      const opts = this.handOptions(inst);
      this.openMenu(el, opts, opts.length ? '' : this.whyNot(inst));
    }

    onZone(side, kind, i) {
      const g = this.game;
      if (!g) return;
      const team = this.arena.teamOf(side), inst = g.state.players[team][kind][i];
      const m = this.mode;
      if (m.kind === 'MONSTER') { if (inst && m.uids.has(inst.uid)) this.finishPick(inst.uid); return; }
      if (m.kind === 'TRIBUTE') {
        if (!inst || !m.uids.has(inst.uid)) return;
        const at = m.picked.indexOf(inst.uid);
        if (at >= 0) m.picked.splice(at, 1); else if (m.picked.length < m.count) m.picked.push(inst.uid);
        this.arena.flags.picked = new Set(m.picked);
        this.render();
        return;
      }
      if (m.kind === 'ATTACK') {
        if (inst && kind === 'monsters' && m.uids.has(inst.uid)) { this.mode = { kind: 'IDLE' }; this.dispatch({ type: 'ATTACK', uid: m.attacker, targetUid: inst.uid }); return; }
        if (inst && inst.uid === m.attacker) { this.cancelMode(); return; }
        if (side === 'me' && inst && kind === 'monsters') { this.cancelMode(); this.onZone(side, kind, i); }
        return;
      }
      if (!inst || side !== 'me' || !this.canAct()) return;
      const el = this.arena.zoneEl(side, kind, i);
      if (kind === 'backrow') {
        const opts = Fx().canActivate(g, team, inst) ? [['▶ Ativar', () => this.activate(inst)]] : [];
        this.openMenu(el, opts, opts.length ? '' : 'Esta carta só se ativa em resposta (ou ainda está a preparar: zzz).');
        return;
      }
      if (g.state.phase === 'BATTLE') {
        const o = g.attackOptions(team, inst);
        const opts = [];
        if (o.targets.length || o.direct) opts.push(['⚔ Atacar', () => this.startAttack(inst)]);
        if (Fx().monsterEffectReady(g, team, inst)) opts.push(['✨ Usar efeito', () => this.monsterEffect(inst)]);
        if (opts.length === 1 && opts[0][0] === '⚔ Atacar') { this.startAttack(inst); return; }
        this.openMenu(el, opts, opts.length ? '' : 'Esta peça não pode atacar (Defesa, paralisada ou já atacou).');
        return;
      }
      const opts = [];
      if (g.canChangePosition(team, inst)) opts.push([inst.position === 'ATK' ? '🛡 Passar a Defesa' : '⚔ Passar a Ataque', () => this.dispatch({ type: 'CHANGE_POSITION', uid: inst.uid })]);
      if (Fx().monsterEffectReady(g, team, inst)) opts.push(['✨ Usar efeito', () => this.monsterEffect(inst)]);
      this.openMenu(el, opts, opts.length ? '' : 'Sem ações para esta peça agora.');
    }

    startAttack(inst) {
      const g = this.game, o = g.attackOptions(this.viewer, inst);
      this.mode = { kind: 'ATTACK', attacker: inst.uid, uids: new Set(o.targets.map((t) => t.uid)), direct: o.direct, label: 'Escolhe o alvo do ataque' };
      this.render();
    }

    onAction(act) {
      const m = this.mode;
      if (act === 'cancel') return this.cancelMode();
      if (act === 'skip' && m.optional) return this.finishPick('');
      if (act === 'confirm' && m.kind === 'TRIBUTE' && m.valid(m.picked)) return this.finishPick(m.picked.slice());
      if (act === 'direct' && m.kind === 'ATTACK' && m.direct) { this.mode = { kind: 'IDLE' }; return this.dispatch({ type: 'ATTACK', uid: m.attacker, targetUid: null }); }
      if (act === 'battle') return this.dispatch({ type: 'GO_BATTLE' });
      if (act === 'end') return this.dispatch({ type: 'END_TURN' });
      if (act === 'forfeit' && this.game.online) this.game.online.claimForfeit().then((ok) => ok && this.toast('Vitória por abandono registada.'));
    }

    onHover(side, kind, i, el, inst) {
      const box = document.getElementById('inspector');
      const g = this.game;
      if (!side || !g) { box.classList.remove('show'); return; }
      let card = null, extra = '';
      if (side === 'hand') card = def(inst);
      else {
        const team = this.arena.teamOf(side), x = g.state.players[team][kind][i];
        if (!x || (kind === 'backrow' && side === 'foe' && !x.revealed)) { box.classList.remove('show'); return; }
        card = def(x);
        if (kind === 'monsters') {
          const st = S().stats(g, x);
          extra = `<p><b>Agora: ATK ${st.atk} / DEF ${st.def}</b> · ${x.position === 'ATK' ? 'Ataque' : 'Defesa'}${S().isStunned(g, x) ? ' · ❄ paralisada' : ''}</p>`;
        }
      }
      const d = YC.DuelCardView.describe(card);
      box.innerHTML = `<div class="insp-head"><b>${esc(d.title)}</b><small>${esc(d.sub)}</small></div>${extra}${d.lines.map((l) => `<p>${esc(l)}</p>`).join('')}`;
      const r = el.getBoundingClientRect();
      box.style.left = `${Math.max(8, Math.min(window.innerWidth - 250, r.right + 8))}px`;
      box.style.top = `${Math.max(8, Math.min(window.innerHeight - 220, r.top - (side === 'hand' ? 200 : 0)))}px`;
      box.classList.add('show');
    }

    openMenu(anchor, opts, why) {
      const m = this.arena.el.menu;
      m.innerHTML = opts.map((o, i) => `<button data-i="${i}">${o[0]}</button>`).join('') + (why ? `<p>${esc(why)}</p>` : '');
      m.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.audio.playClick(); this.closeMenu(); opts[Number(b.dataset.i)][1](); }));
      m.hidden = false;
      document.getElementById('inspector').classList.remove('show');
      const r = anchor.getBoundingClientRect(), host = m.parentElement.getBoundingClientRect();
      const half = m.offsetWidth / 2 + 8;
      m.style.left = `${Math.max(half, Math.min(window.innerWidth - half, r.left + r.width / 2)) - host.left}px`;
      m.style.top = `${r.top - host.top - 10}px`;
    }
    closeMenu() { if (this.arena.el && this.arena.el.menu) this.arena.el.menu.hidden = true; }

    // ── Chain (agente humano) ──
    async askChain(ctx) {
      const g = this.game;
      const hidden = g.mode === 'HOTSEAT' && ctx.team !== g.state.active;
      if (hidden) await YC.Screens.curtain(`${g.teamName(ctx.team)}: podes responder!`, 'Passa o ecrã. O outro jogador não espreita.');
      const uid = await YC.Screens.chainWindow({
        game: g, team: ctx.team, options: ctx.options, stack: ctx.stack, top: ctx.top, audio: this.audio,
        renderCard: (o) => YC.DuelCardView.create(o.card, { side: ctx.team, small: true }),
        optionLabel: (o) => (o.from === 'FIELD' ? 'Usar efeito' : `Ativar (${o.from === 'HAND' ? 'da mão' : 'do Suporte'})`)
      });
      if (hidden) await YC.Screens.curtain(`Devolve o ecrã às ${g.teamName(g.state.active)}`, 'A Chain continua.');
      return uid;
    }

    // ── Renderização ──
    render() {
      const g = this.game;
      if (!g || !g.state || document.getElementById('duel').hidden) return;
      const f = this.arena.flags, m = this.mode, me = this.viewer, s = g.state;
      f.selectable = new Set(); f.targets = new Set(); f.selected = null;
      if (m.kind === 'MONSTER' || m.kind === 'HAND' || m.kind === 'TRIBUTE') for (const u of m.uids) f.selectable.add(u);
      else if (m.kind === 'ATTACK') { f.selected = m.attacker; for (const u of m.uids) f.targets.add(u); }
      else if (this.canAct()) {
        for (const h of s.players[me].hand) if (this.handOptions(h).length) f.selectable.add(h.uid);
        for (const x of s.players[me].monsters) {
          if (!x) continue;
          const can = s.phase === 'BATTLE' ? (g.attackOptions(me, x).targets.length || g.attackOptions(me, x).direct) : (g.canChangePosition(me, x) || Fx().monsterEffectReady(g, me, x));
          if (can || Fx().monsterEffectReady(g, me, x)) f.selectable.add(x.uid);
        }
        for (const b of s.players[me].backrow) if (b && Fx().canActivate(g, me, b)) f.selectable.add(b.uid);
      }
      this.arena.render();
      this.arena.renderChain(g.chain.stack, this.resolvingId);
      this.renderTop();
      this.renderActions();
    }

    phaseText() {
      const g = this.game, s = g.state, m = this.mode;
      if (s.winner) return ['FIM DO DUELO', ''];
      if (m.kind !== 'IDLE' && m.kind !== 'ATTACK') return ['ESCOLHE', `${m.label}. Esc cancela.`];
      if (m.kind === 'ATTACK') return ['⚔ ATACAR', m.direct ? 'Clica numa peça inimiga marcada ou em "Ataque direto".' : 'Clica numa peça inimiga marcada.'];
      if (g.chain.status !== 'Idle') return ['CHAIN EM CURSO', 'As respostas resolvem do último elo para o primeiro.'];
      if (!this.isMyTurn()) return [`VEZ DE ${g.teamName(s.active).toUpperCase()}`, 'Podes responder na Chain com cartas viradas (a partir do turno seguinte a vira-las).'];
      if (s.phase === 'MAIN') return ['FASE PRINCIPAL', `1 Invocação Normal por turno; feitiços; virar cartas; mudar posição.${s.turnCount === 1 ? ' No 1.º turno do duelo não há batalha.' : ' Depois: ⚔ Fase de Batalha.'}`];
      if (s.phase === 'BATTLE') return ['FASE DE BATALHA', 'Clica numa peça tua em Ataque para atacar. Sem peças inimigas, o ataque é direto aos LP.'];
      return ['…', ''];
    }

    renderTop() {
      const g = this.game, s = g.state;
      const pill = document.getElementById('turn-pill');
      const mine = this.isMyTurn();
      const clock = g.online ? g.online.clockText() : '';
      const tag = g.online ? `<span class="net-tag">${g.online.ranked ? 'RANQUEADA' : 'SALA ' + esc(g.online.match.id)}</span> ` : '';
      const phase = { MAIN: 'Principal', BATTLE: 'Batalha', DRAW: 'Compra', END_PHASE: 'Fim' }[s.phase] || '';
      pill.innerHTML = `${tag}<b>TURNO ${s.turnCount}</b> · ${mine ? 'A TUA VEZ' : 'VEZ DE ' + esc(g.teamName(s.active).toUpperCase())}${phase ? ' · ' + phase : ''}${clock ? ` · <em class="clock">${clock}</em>` : ''}`;
      pill.className = `team-${s.active.toLowerCase()}`;
      const [t, h] = this.phaseText();
      this.arena.el.phaseTitle.textContent = t;
      this.arena.el.phaseHint.textContent = h;
      this.arena.el.midPhase.textContent = s.phase === 'BATTLE' ? '⚔ BATALHA' : s.phase === 'MAIN' ? 'FASE PRINCIPAL' : '';
    }

    renderActions() {
      const g = this.game, s = g.state, m = this.mode, act = this.canAct(), root = this.arena.root;
      const b = (k) => root.querySelector(`[data-act="${k}"]`);
      b('battle').hidden = s.phase === 'BATTLE';
      b('battle').disabled = !(act && g.canEnterBattle(this.viewer));
      b('end').disabled = !(act && ['MAIN', 'BATTLE'].includes(s.phase));
      b('direct').hidden = !(m.kind === 'ATTACK' && m.direct);
      b('confirm').hidden = m.kind !== 'TRIBUTE';
      b('confirm').disabled = !(m.kind === 'TRIBUTE' && m.valid(m.picked));
      b('skip').hidden = !m.optional;
      b('cancel').hidden = m.kind === 'IDLE';
      b('forfeit').hidden = !(g.online && g.online.canClaimForfeit());
      document.getElementById('btn-resign').hidden = !(g.online && !s.winner);
    }

    subscribe() {
      const bus = this.bus, sr = () => this.scheduleRender();
      ['STATE_CHANGED', 'PHASE_CHANGED', 'CHAIN_UPDATED', 'BUSY', 'TURN_ENDED', 'DUEL_DRAW'].forEach((e) => bus.on(e, sr));
      bus.on('TURN_STARTED', async ({ team }) => {
        const g = this.game;
        if (!g || g.kind !== 'DUEL') return;
        this.mode = { kind: 'IDLE' };
        this.render();
        if (g.mode === 'HOTSEAT') {
          await YC.Screens.curtain(`Vez de ${g.teamName(team)}`, 'Passa o ecrã. A tua mão fica visível ao carregares.');
          this.arena.bind(g, this.viewer);
        }
        const mine = team === this.viewer;
        await YC.Screens.banner(mine ? 'A TUA VEZ!' : g.mode === 'AI' ? 'VEZ DO REI DADO!' : `VEZ DE ${g.teamName(team).toUpperCase()}!`, `team-${team.toLowerCase()}`, 700 * this.arena.speed);
      });
      bus.on('CUT_IN', async ({ card, team }) => {
        const g = this.game;
        if (!g || g.kind !== 'DUEL') return;
        const mine = team === this.viewer;
        const portrait = mine ? { type: 'PAWN', team: 'WHITE' } : g.mode === 'AI' ? { type: 'KING', team: 'BLACK' } : { type: 'PAWN', team: 'BLACK' };
        await YC.CutIn.play({ card, side: mine ? 'me' : 'foe', portrait, audio: this.audio, vfx: this.vfx, animator: this.animator, speed: this.arena.speed });
      });
      bus.on('DUEL_CARD_ACTIVATED', async ({ inst, team, link }) => {
        const c = def(inst);
        this.audio.playChainBell(link.index || 1);
        if (c.rarity === 'L' || c.rarity === 'UR') return;
        const wrap = document.createElement('div');
        wrap.className = `showcase owner-${team.toLowerCase()}`;
        wrap.innerHTML = `<div class="showcase-tag">${link.index > 1 ? `CHAIN ${link.index}! · ` : ''}SS${c.ss}</div>`;
        wrap.appendChild(YC.DuelCardView.create(c, { side: team }));
        this.vfx.fxLayer.appendChild(wrap);
        await new Promise((r) => setTimeout(r, 900 * this.arena.speed));
        wrap.classList.add('out');
        setTimeout(() => wrap.remove(), 350);
      });
      bus.on('CHAIN_RESOLVING', async ({ stack }) => {
        if (stack.length > 1) await YC.Screens.banner(`RESOLVER: ${stack.map((l) => 'CL' + l.index).reverse().join(' → ')}`, 'chain', 800 * this.arena.speed);
      });
      bus.on('CHAIN_LINK_RESOLVING', async ({ link, stack }) => {
        this.resolvingId = link.id;
        this.arena.renderChain(stack, link.id);
        if (stack.length > 1) await new Promise((r) => setTimeout(r, 300 * this.arena.speed));
      });
      bus.on('CHAIN_CLEARED', () => { this.resolvingId = null; sr(); });
    }
  }

  YC.DuelUI = DuelUI;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
