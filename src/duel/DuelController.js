/* DuelController.js — Speed Duel: fases (MAIN → BATTLE → END), invocação normal/tributo, posições,
   ativações, batalha estilo Duel Links e Chain. Mesma interface do GameController (agentes,
   dispatch, netHook, stateHash, resign), por isso o LockstepSession serve para o duelo online. */
(function (YC) {
  'use strict';

  const MAX_TURNS = 100;
  const FATIGUE = 500;
  const S = () => YC.DuelState;
  const Fx = () => YC.DuelEffects;
  const def = (inst) => YC.DuelCards.BY_ID[inst.id];
  const COLORS = ['R', 'B', 'G', 'Y'];

  class DuelController {
    constructor(opts = {}) {
      this.bus = opts.bus || new YC.EventBus();
      this.seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9);
      this.rng = YC.mulberry32(this.seed);
      this.fast = !!opts.fast;
      this.mode = opts.mode || 'AI';
      this.kind = 'DUEL';
      this.names = opts.names || { WHITE: 'Tu', BLACK: 'Rei Dado' };
      this.decks = opts.decks || { WHITE: YC.DuelCards.STARTER_DECK, BLACK: YC.DuelCards.STARTER_DECK };
      this.agents = opts.agents || {};
      this.chain = new YC.DuelChain(this);
      this.busy = false; this.aborted = false;
      this.logLines = []; this.turnDeferred = null; this.state = null;
      this.netHook = null; this.localTeam = null;
    }

    setup() {
      const r = this.rng;
      const players = {
        WHITE: S().newPlayer('WHITE', this.names.WHITE, this.decks.WHITE, r, 'W'),
        BLACK: S().newPlayer('BLACK', this.names.BLACK, this.decks.BLACK, r, 'B')
      };
      this.state = {
        turnCount: 0, active: 'BLACK', phase: 'SETUP', winner: null, players, polarityTurn: -1,
        first: r() < 0.5 ? 'WHITE' : 'BLACK',
        pile: { color: COLORS[r.int(4)], symbol: String(r.int(10)) }
      };
      for (const t of YC.TEAMS) for (let i = 0; i < S().HAND_START; i++) players[t].hand.push(players[t].deck.pop());
      this.bus.emit('GAME_SETUP', { game: this });
    }

    // ── Utilitários partilhados com o GameController ──
    wait(ms) { return this.fast || !ms ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)); }
    teamName(team) { return this.names[team] || team; }
    log(text, kind = 'info') {
      const line = { text, kind, turn: this.state ? this.state.turnCount : 0 };
      this.logLines.push(line);
      if (this.logLines.length > 250) this.logLines.shift();
      this.bus.emit('LOG', line);
    }
    setPhase(phase) { this.state.phase = phase; this.bus.emit('PHASE_CHANGED', { phase, team: this.state.active }); }
    abort() { this.aborted = true; if (this.turnDeferred) this.turnDeferred.resolve(); }
    whenIdle() { return this.busy ? new Promise((r) => (this.idleWaiters = this.idleWaiters || []).push(r)) : Promise.resolve(); }
    player(team) { return this.state.players[team]; }

    async start() {
      if (!this.state) this.setup();
      this.log(`🪙 Moeda ao ar: ${this.teamName(this.state.first)} começa.`, 'turn');
      while (!this.state.winner && !this.aborted) {
        await this.beginTurn();
        if (this.state.winner || this.aborted) break;
        this.turnDeferred = YC.deferred();
        const agent = this.agents[this.state.active];
        Promise.resolve().then(() => agent.playTurn(this)).catch((err) => { console.error('[duel agent]', err); this.finishTurn(); });
        await this.turnDeferred.promise;
        await this.whenIdle();
        if (this.aborted || this.state.winner) break;
        await this.bus.emitAsync('TURN_ENDED', { team: this.state.active });
      }
      if (this.state.winner && !this.aborted) {
        this.state.phase = 'GAME_OVER';
        await this.bus.emitAsync('GAME_OVER', { winner: this.state.winner, stats: this.statsSummary(), game: this });
      }
      return this.state.winner;
    }

    async beginTurn() {
      const s = this.state;
      s.turnCount++;
      s.active = s.turnCount === 1 ? s.first : YC.other(s.active);
      s.phase = 'DRAW';
      const p = this.player(s.active);
      for (const m of p.monsters) if (m) m.attacks = 0;
      this.log(`— Turno ${s.turnCount}: ${this.teamName(s.active)} —`, 'turn');
      await this.bus.emitAsync('TURN_STARTED', { team: s.active, turn: s.turnCount });
      if (s.turnCount >= MAX_TURNS) { this.setWinner('DRAW'); return; }
      if (s.turnCount > 1) {
        if (p.deck.length) this.drawCards(s.active, 1);
        else { this.log(`📭 ${this.teamName(s.active)} não tem cartas no baralho: Fadiga (−${FATIGUE} LP).`, 'warn'); await this.damage(s.active, FATIGUE, 'Fadiga'); }
      }
      if (s.winner) return;
      for (const m of p.monsters) {
        if (m && m.id === 'peao_estrela' && !m.starDone && m.summonTurn <= s.turnCount - 2) {
          m.starDone = true;
          this.log('⭐ O Peão sobreviveu e foi Promovido a Estrela: +400 ATK!');
          await this.addMod(m, 'atk', 400, true);
        }
      }
      this.setPhase('MAIN');
    }

    finishTurn() {
      if (!this.state || ['END_PHASE', 'GAME_OVER'].includes(this.state.phase)) { if (this.turnDeferred) this.turnDeferred.resolve(); return; }
      this.setPhase('END_PHASE');
      if (this.turnDeferred) this.turnDeferred.resolve();
    }

    setWinner(team) {
      if (this.state.winner) return;
      this.state.winner = team;
      this.setPhase('GAME_OVER');
      if (this.turnDeferred) this.turnDeferred.resolve();
    }

    resign(team, reason = 'desiste do duelo') {
      if (!this.state || this.state.winner) return;
      this.state.resignedBy = team;
      this.log(`🏳 ${this.teamName(team)} ${reason}.`, 'kill');
      this.setWinner(YC.other(team));
    }

    statsSummary() {
      const s = this.state;
      return Object.fromEntries(YC.TEAMS.map((t) => [t, { ...s.players[t].stats, lp: s.players[t].lp }]));
    }

    stateHash() {
      const s = this.state;
      if (!s) return 0;
      const parts = [s.turnCount, s.active, s.phase, s.pile.color, s.pile.symbol, s.polarityTurn];
      for (const t of YC.TEAMS) {
        const p = s.players[t];
        parts.push(p.lp, p.summonTurn, p.trapLockTurn, p.hand.map((c) => c.uid).join(','), p.deck.map((c) => c.uid).join(','), p.gy.map((c) => c.uid).join(','));
        parts.push(p.monsters.map((m) => (m ? `${m.uid}${m.position}${m.attacks || 0}:${S().atk(this, m)}/${S().dfn(this, m)}:${m.stunUntil || 0}` : '_')).join('|'));
        parts.push(p.backrow.map((b) => (b ? `${b.uid}@${b.setTurn}${b.revealed ? 'r' : ''}` : '_')).join('|'));
      }
      const str = parts.join('#');
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
      return h;
    }

    // ── Ações ──
    async dispatch(action) {
      const s = this.state;
      if (!s || s.winner || this.busy || this.aborted) return false;
      if (action.team && action.team !== s.active) return false;
      if (this.localTeam && !action._remote && s.active !== this.localTeam) return false;
      if (this.netHook && !action._remote) this.netHook({ ...action, team: s.active });
      this.busy = true;
      this.bus.emit('BUSY', { busy: true });
      let ok = false;
      try { ok = await this.handle(s.active, action); }
      catch (err) { console.error('[DuelController]', action.type, err); ok = false; }
      finally {
        this.busy = false;
        this.bus.emit('BUSY', { busy: false });
        this.bus.emit('STATE_CHANGED', { game: this });
        const w = this.idleWaiters || []; this.idleWaiters = []; w.forEach((fn) => fn());
      }
      return ok;
    }

    async handle(team, a) {
      switch (a.type) {
        case 'NORMAL_SUMMON': return this.doSummon(team, a);
        case 'SET_CARD': return this.doSet(team, a);
        case 'ACTIVATE': return this.doActivate(team, a);
        case 'MONSTER_EFFECT': return this.doEffect(team, a);
        case 'CHANGE_POSITION': return this.doPosition(team, a);
        case 'GO_BATTLE': return this.doBattlePhase(team);
        case 'ATTACK': return this.doAttack(team, a);
        case 'END_TURN':
          if (!['MAIN', 'BATTLE'].includes(this.state.phase)) return false;
          this.log(`${this.teamName(team)} termina o turno.`);
          this.finishTurn(); return true;
        default: return false;
      }
    }

    idleMain(team) { const s = this.state; return s.active === team && s.phase === 'MAIN' && this.chain.status === 'Idle'; }

    /** Tributos necessários para invocar `inst` com os tributos dados (Sereia: 1 se for Azul). */
    tributesNeeded(team, inst, tributeUids = []) {
      const c = def(inst);
      const base = YC.DuelCards.tributesFor(c);
      if (c.id === 'dama_sereia' && tributeUids.length === 1) {
        const t = this.player(team).monsters.find((m) => m && m.uid === tributeUids[0]);
        if (t && def(t).color === 'B') return 1;
      }
      return base;
    }

    canNormalSummon(team, inst) {
      const p = this.player(team), c = def(inst);
      if (!this.idleMain(team) || p.summonTurn === this.state.turnCount || c.category !== 'MONSTER' || !p.hand.includes(inst)) return false;
      const own = p.monsters.filter(Boolean).length;
      const need = c.id === 'dama_sereia' && p.monsters.some((m) => m && def(m).color === 'B') ? 1 : YC.DuelCards.tributesFor(c);
      return need === 0 ? own < S().ZONES : own >= need;
    }

    async doSummon(team, a) {
      const p = this.player(team);
      const inst = p.hand.find((c) => c.uid === a.uid);
      if (!inst || !this.canNormalSummon(team, inst)) return false;
      const tributes = [...new Set(a.tributes || [])].map((uid) => p.monsters.find((m) => m && m.uid === uid));
      if (tributes.some((t) => !t)) return false;
      const need = this.tributesNeeded(team, inst, a.tributes || []);
      if (tributes.length !== need) return false;
      if (p.monsters.filter(Boolean).length - need >= S().ZONES) return false;
      const position = a.position === 'DEF' ? 'DEF' : 'ATK';
      const c = def(inst);
      for (const t of tributes) await this.sendToGy(t, 'TRIBUTO');
      p.hand.splice(p.hand.indexOf(inst), 1);
      p.summonTurn = this.state.turnCount;
      const link = YC.DuelChain.link('SUMMON', team, {
        inst, summonType: need ? 'TRIBUTE' : 'NORMAL', tributes: need, position, targetUid: a.targetUid || null,
        color: COLORS.includes(a.color) ? a.color : null, sintonia: S().sintonia(this, c), label: `Invocação: ${c.name}`
      });
      this.log(`✋ ${this.teamName(team)} invoca ${c.name} em ${position === 'ATK' ? 'Ataque' : 'Defesa'}${need ? ` (${need} tributo${need > 1 ? 's' : ''})` : ''}.`);
      await this.bus.emitAsync('DUEL_SUMMON_DECLARED', { inst, team, link });
      await this.cutIn(c, team);
      await this.chain.run(link);
      return true;
    }

    canSet(team, inst) {
      const p = this.player(team), c = def(inst);
      return this.idleMain(team) && p.hand.includes(inst) && ['QUICK_SPELL', 'TRAP', 'COUNTER_TRAP'].includes(c.category) && p.backrow.includes(null);
    }

    async doSet(team, a) {
      const p = this.player(team);
      const inst = p.hand.find((c) => c.uid === a.uid);
      if (!inst || !this.canSet(team, inst)) return false;
      p.hand.splice(p.hand.indexOf(inst), 1);
      const slot = p.backrow.indexOf(null);
      p.backrow[slot] = inst;
      inst.setTurn = this.state.turnCount; inst.revealed = false; inst.zone = slot;
      this.log(`${this.teamName(team)} vira uma carta no Suporte.`);
      await this.bus.emitAsync('DUEL_SET', { inst, team, slot });
      return true;
    }

    validTargets(team, inst, targets = {}) {
      const c = def(inst), spec = c.target;
      if (!spec) return true;
      const list = Fx().candidates(this, team, spec, inst.uid).map((x) => x.uid);
      const key = spec === 'HAND_DISCARD' ? 'discardUid' : spec === 'GY_MONSTER' ? 'gyUid' : 'monsterUid';
      const v = targets[key];
      if (spec.endsWith('OPTIONAL')) return !v || list.includes(v);
      return list.includes(v);
    }

    async doActivate(team, a) {
      const p = this.player(team);
      const inst = p.hand.find((c) => c.uid === a.uid) || p.backrow.find((c) => c && c.uid === a.uid);
      if (!inst || !Fx().canActivate(this, team, inst) || !this.validTargets(team, inst, a.targets || {})) return false;
      const c = def(inst), targets = { ...(a.targets || {}) };
      if (c.id === 'troca_chapeu') {
        const d = p.hand.find((x) => x.uid === targets.discardUid);
        await this.sendToGy(d, 'DESCARTE');
      }
      this.removeFromZones(inst);
      const link = YC.DuelChain.link('ACTIVATE', team, {
        inst, ss: c.ss, targets, color: COLORS.includes(a.color) ? a.color : null, sintonia: S().sintonia(this, c), label: c.name
      });
      this.log(`🃏 ${this.teamName(team)} ativa ${c.name}.`);
      await this.bus.emitAsync('DUEL_CARD_ACTIVATED', { inst, team, link });
      await this.cutIn(c, team);
      await this.chain.run(link);
      return true;
    }

    /** Ativação vinda da Chain (resposta). Paga custos aqui, no anúncio. */
    async activateResponse(team, opt) {
      const inst = opt.inst, c = def(inst), p = this.player(team);
      if (opt.from === 'FIELD') {
        inst.effectTurn = this.state.turnCount;
        this.log(`🔗 ${this.teamName(team)} usa o efeito rápido de ${c.name}.`);
        const link = YC.DuelChain.link('EFFECT', team, { inst, ss: 2, label: `${c.name} (efeito)` });
        await this.bus.emitAsync('DUEL_EFFECT', { inst, team, link });
        return link;
      }
      const sint = S().sintonia(this, c);
      if (c.cost && !sint) {
        const amount = c.cost.lp ? c.cost.lp : Math.floor(p.lp / 2);
        await this.damage(team, amount, `Custo de ${c.name}`, { cost: true });
      }
      this.removeFromZones(inst);
      if (c.category === 'TRAP') p.stats.traps++;
      if (c.category === 'COUNTER_TRAP') p.stats.counters++;
      const link = YC.DuelChain.link('ACTIVATE', team, {
        inst, ss: c.ss, targets: {}, color: c.chooseColor ? S().favouriteColor(this, team) : null, sintonia: sint, label: c.name
      });
      this.log(`🔗 CL: ${this.teamName(team)} responde com ${c.name} (SS${c.ss}).`);
      await this.bus.emitAsync('DUEL_CARD_ACTIVATED', { inst, team, link, response: true });
      await this.cutIn(c, team);
      return link;
    }

    async doEffect(team, a) {
      const p = this.player(team);
      const inst = p.monsters.find((m) => m && m.uid === a.uid);
      if (!inst || !Fx().monsterEffectReady(this, team, inst)) return false;
      const t = a.targets || {};
      if (inst.id === 'torre_locomotiva') {
        const d = Fx().candidates(this, team, 'HAND_RED').find((x) => x.uid === t.discardUid);
        if (!d) return false;
        await this.sendToGy(d, 'DESCARTE');
      }
      if (inst.id === 'bispo_arcanjo' && t.choice === 'REVIVE' && !Fx().candidates(this, team, 'GY_PAWN2').length) return false;
      inst.effectTurn = this.state.turnCount;
      const c = def(inst);
      const link = YC.DuelChain.link('EFFECT', team, { inst, ss: c.effect === 'QUICK' ? 2 : 1, targets: t, label: `${c.name} (efeito)` });
      this.log(`✨ ${this.teamName(team)} ativa o efeito de ${c.name}.`);
      await this.bus.emitAsync('DUEL_EFFECT', { inst, team, link });
      await this.chain.run(link);
      return true;
    }

    canChangePosition(team, inst) {
      const s = this.state;
      if (!this.idleMain(team) || inst.owner !== team || S().isStunned(this, inst) || inst.posChangedTurn === s.turnCount) return false;
      if (inst.id === 'cavalo_carrossel') return true;
      return inst.summonTurn !== s.turnCount && !inst.attacks;
    }

    async doPosition(team, a) {
      const inst = this.player(team).monsters.find((m) => m && m.uid === a.uid);
      if (!inst || !this.canChangePosition(team, inst)) return false;
      inst.posChangedTurn = this.state.turnCount;
      await this.setPosition(inst, inst.position === 'ATK' ? 'DEF' : 'ATK');
      return true;
    }

    canEnterBattle(team) { return this.idleMain(team) && this.state.turnCount > 1; }

    async doBattlePhase(team) {
      if (!this.canEnterBattle(team)) return false;
      this.setPhase('BATTLE');
      await this.bus.emitAsync('DUEL_BATTLE_PHASE', { team });
      return true;
    }

    /** Alvos legais de um atacante (Torre Cofre obriga a atacá-la; Faísca ataca direto contra só-Defesa). */
    attackOptions(team, inst, opts = {}) {
      const s = this.state;
      const none = { targets: [], direct: false };
      if (s.active !== team || this.chain.status !== 'Idle' || !inst || inst.owner !== team) return none;
      if (opts.planning ? !(s.phase === 'BATTLE' || this.canEnterBattle(team)) : s.phase !== 'BATTLE') return none;
      if (inst.position !== 'ATK' || S().isStunned(this, inst) || (inst.attacks || 0) >= S().maxAttacks(this, inst)) return none;
      const foe = S().monstersOf(this, YC.other(team));
      const cofres = foe.filter((m) => m.id === 'torre_cofre');
      const targets = cofres.length ? cofres : foe;
      const direct = !foe.length || (inst.id === 'peao_faisca' && !cofres.length && foe.every((m) => m.position === 'DEF'));
      return { targets, direct };
    }

    async doAttack(team, a) {
      const inst = this.player(team).monsters.find((m) => m && m.uid === a.uid);
      const opts = this.attackOptions(team, inst);
      const target = a.targetUid ? opts.targets.find((t) => t.uid === a.targetUid) : null;
      if (a.targetUid ? !target : !opts.direct) return false;
      inst.attacks = (inst.attacks || 0) + 1;
      const label = target ? `${def(inst).name} ataca ${def(target).name}` : `${def(inst).name} ataca diretamente`;
      const link = YC.DuelChain.link('ATTACK', team, { attackerUid: inst.uid, targetUid: target ? target.uid : null, label });
      this.log(`⚔ ${label}.`);
      this.battleLosses = [];
      await this.bus.emitAsync('DUEL_ATTACK_DECLARED', { attacker: inst, target, team });
      await this.chain.run(link);
      // Cilada de Dinamite & cia.: abre uma Chain própria quando uma peça defensora é destruída.
      for (const ev of this.battleLosses) {
        if (this.state.winner) break;
        const evLink = YC.DuelChain.link('EVENT', YC.other(ev.victimTeam), { event: 'DESTROYED', victimTeam: ev.victimTeam, attackerUid: ev.attackerUid, label: `${ev.name} foi destruída` });
        if (this.wouldRespond(ev.victimTeam, evLink)) await this.chain.run(evLink);
      }
      return true;
    }

    wouldRespond(team, link) {
      const p = this.player(team), s = this.state;
      if (p.trapLockTurn === s.turnCount) return false;
      return p.backrow.some((b) => b && b.setTurn < s.turnCount && Fx().responds(this, team, b, link) && Fx().costPayable(this, team, b));
    }

    // ── Resolução dos elos ──
    async resolveLink(link, stack, index) {
      const p = this.player(link.owner);
      if (link.kind === 'SUMMON') {
        const c = def(link.inst);
        if (link.negated) {
          if (link.bounced) { p.hand.push(S().resetInst(link.inst)); this.log(`${c.name} volta para a mão.`); await this.bus.emitAsync('DUEL_BOUNCED_TO_HAND', { inst: link.inst, team: link.owner }); }
          else { await this.sendToGy(link.inst, 'ANULADA'); this.log(`✖ A invocação de ${c.name} foi anulada.`, 'warn'); }
          return;
        }
        await this.placeMonster(link.inst, link.owner, link.position);
        p.stats.summons++;
        await this.playCard(link.inst, link);
        await Fx().onSummon(this, link.inst, { targetUid: link.targetUid });
        return;
      }
      if (link.kind === 'ACTIVATE') {
        const c = def(link.inst);
        if (link.negated) { await this.sendToGy(link.inst, 'ANULADA'); this.log(`✖ ${c.name} foi anulada.`, 'warn'); return; }
        await this.bus.emitAsync('DUEL_CARD_RESOLVING', { inst: link.inst, team: link.owner });
        await Fx().resolveCard(this, link, stack, index);
        await this.sendToGy(link.inst);
        p.stats.cards++;
        await this.playCard(link.inst, link);
        return;
      }
      if (link.kind === 'EFFECT') {
        if (link.negated) { this.log(`✖ O efeito de ${def(link.inst).name} foi anulado.`, 'warn'); return; }
        await Fx().resolveMonsterEffect(this, link);
        return;
      }
      if (link.kind === 'ATTACK') {
        if (link.negated) { this.log('✖ O ataque foi anulado.', 'warn'); await this.bus.emitAsync('DUEL_ATTACK_CANCELLED', { uid: link.attackerUid }); return; }
        await this.battle(link);
      }
    }

    async battle(link) {
      const A = S().locate(this, link.attackerUid);
      if (!A || A.zone !== 'monsters' || A.inst.position !== 'ATK') { this.log('O atacante já não está em condições de atacar.'); return; }
      const a = A.inst, atkTeam = a.owner, defTeam = YC.other(atkTeam);
      let t = null;
      if (link.targetUid) {
        const T = S().locate(this, link.targetUid);
        if (!T || T.zone !== 'monsters') { this.log('O alvo desapareceu: o ataque perde-se.'); return; }
        t = T.inst;
      }
      const av = S().atk(this, a);
      await this.bus.emitAsync('DUEL_BATTLE', { attacker: a, target: t });
      const kill = async (victim, by) => {
        await this.destroyMonster(victim, { by: 'BATTLE' });
        if (victim.owner === defTeam) this.battleLosses.push({ victimTeam: defTeam, attackerUid: by.uid, name: def(victim).name });
        if (by.id === 'bispo_maestro' && victim.owner !== by.owner) await this.damage(victim.owner, 400, 'Maestro Diabólico');
      };
      if (!t) {
        const foe = S().monstersOf(this, defTeam);
        const dmg = a.id === 'peao_faisca' && foe.length ? Math.floor(av / 2) : av;
        await this.damage(defTeam, dmg, `Ataque direto de ${def(a).name}`, { battle: true });
        return;
      }
      if (t.position === 'ATK') {
        const tv = S().atk(this, t);
        if (av > tv) { await kill(t, a); await this.damage(defTeam, av - tv, 'Batalha', { battle: true }); }
        else if (av < tv) { await kill(a, t); await this.damage(atkTeam, tv - av, 'Batalha', { battle: true }); }
        else if (av > 0) { await kill(t, a); await kill(a, t); this.log('Empate de ATK: as duas peças caem!'); }
        else this.log('0 contra 0: nada acontece.');
        return;
      }
      const dv = S().dfn(this, t);
      if (av > dv) {
        if (t.id === 'peao_lata' && def(a).level <= 3) { this.log('🛡 O Escudeiro de Lata aguenta: atacante de Nível 3 ou menor.'); await this.bus.emitAsync('DUEL_STATUS', { inst: t, text: 'AGUENTA!' }); }
        else await kill(t, a);
        if (a.id === 'cavalo_molas') await this.damage(defTeam, av - dv, 'Dano Perfurante', { battle: true });
      } else if (av < dv) {
        await this.bus.emitAsync('DUEL_BOUNCE', { inst: a });
        await this.damage(atkTeam, dv - av, 'Recuo elástico', { battle: true });
      } else this.log('ATK igual à DEF: o golpe não passa.');
    }

    // ── Primitivas ──
    removeFromZones(inst) {
      for (const t of YC.TEAMS) {
        const p = this.player(t);
        for (const z of ['hand', 'gy', 'deck']) { const i = p[z].indexOf(inst); if (i >= 0) p[z].splice(i, 1); }
        for (const z of ['monsters', 'backrow']) { const i = p[z].indexOf(inst); if (i >= 0) p[z][i] = null; }
      }
    }

    async sendToGy(inst, why) {
      if (!inst) return;
      this.removeFromZones(inst);
      S().resetInst(inst);
      this.player(inst.owner).gy.push(inst);
      await this.bus.emitAsync('DUEL_TO_GY', { inst, team: inst.owner, why });
    }

    async placeMonster(inst, team, position) {
      const p = this.player(team);
      const zone = p.monsters.indexOf(null);
      if (zone < 0) { await this.sendToGy(inst, 'SEM ESPAÇO'); return false; }
      this.removeFromZones(inst);
      Object.assign(inst, { position, summonTurn: this.state.turnCount, attacks: 0, posChangedTurn: -1, mods: inst.mods || [], stunUntil: 0, zone });
      p.monsters[zone] = inst;
      await this.bus.emitAsync('DUEL_SUMMONED', { inst, team, zone });
      return true;
    }

    async specialSummon(inst, team) {
      inst.mods = [];
      if (await this.placeMonster(inst, team, 'ATK')) {
        this.log(`🎬 ${def(inst).name} é Invocada Especialmente.`);
        await Fx().onSummon(this, inst, {});
      }
    }

    async destroyMonster(inst, opts = {}) {
      const loc = S().locate(this, inst.uid);
      if (!loc || loc.zone !== 'monsters') return false;
      if (opts.by === 'TRAP' && inst.id === 'dragao_tres_cabecas') return false;
      if (opts.by === 'BATTLE') this.player(YC.other(inst.owner)).stats.kills++;
      await this.bus.emitAsync('DUEL_DESTROYED', { inst, team: inst.owner, by: opts.by, word: opts.word });
      await this.sendToGy(inst, 'DESTRUÍDA');
      this.log(`☠ ${def(inst).name} de ${this.teamName(inst.owner)} foi destruída.`, 'kill');
      return true;
    }

    async destroyBackrow(inst) {
      this.log(`💥 ${def(inst).name} é destruída no Suporte.`);
      await this.bus.emitAsync('DUEL_BACKROW_DESTROYED', { inst, team: inst.owner });
      await this.sendToGy(inst, 'DESTRUÍDA');
    }

    async damage(team, amount, source, opts = {}) {
      amount = Math.max(0, Math.floor(amount));
      if (!amount || this.state.winner) return;
      const p = this.player(team);
      p.lp = Math.max(0, p.lp - amount);
      if (!opts.cost) this.player(YC.other(team)).stats.damageDealt += amount;
      this.log(`💢 ${this.teamName(team)} perde ${amount} LP (${source}). Fica com ${p.lp}.`);
      await this.bus.emitAsync('DUEL_LP', { team, delta: -amount, lp: p.lp, source, cost: !!opts.cost });
      if (p.lp <= 0) {
        const other = this.player(YC.other(team));
        this.setWinner(other.lp <= 0 ? 'DRAW' : YC.other(team));
      }
    }

    async heal(team, amount, source) {
      const p = this.player(team);
      p.lp += amount;
      this.log(`💚 ${this.teamName(team)} recupera ${amount} LP (${source}).`);
      await this.bus.emitAsync('DUEL_LP', { team, delta: amount, lp: p.lp, source });
    }

    drawCards(team, n) {
      const p = this.player(team), got = [];
      for (let i = 0; i < n && p.deck.length; i++) got.push(p.deck.pop());
      p.hand.push(...got);
      if (got.length) this.bus.emit('DUEL_DRAW', { team, cards: got });
      return got;
    }

    async addMod(inst, stat, amount, perm = false) {
      inst.mods = inst.mods || [];
      inst.mods.push({ stat, amount, perm, turn: this.state.turnCount });
      await this.bus.emitAsync('DUEL_MOD', { inst, stat, amount });
    }

    async setPosition(inst, position, word) {
      inst.position = position;
      this.log(`${def(inst).name} passa a ${position === 'ATK' ? 'Ataque' : 'Defesa'}.`);
      await this.bus.emitAsync('DUEL_POSITION', { inst, position, word });
    }

    setPile(color, symbol) {
      this.state.pile = { color, symbol };
      this.bus.emit('DUEL_PILE', { pile: this.state.pile });
    }

    /** Carta jogada: muda a Pilha Uno e aplica o Bónus de Sintonia se combinava. */
    async playCard(inst, link) {
      const c = def(inst), team = link.owner;
      this.setPile(c.color === 'W' ? (link.color || this.state.pile.color) : c.color, c.symbol);
      if (!link.sintonia) return;
      if (c.category === 'MONSTER') {
        const onField = this.player(team).monsters.includes(inst);
        if (onField) { this.log(`🎵 Sintonia Uno! ${c.name} +300 ATK neste turno.`); await this.addMod(inst, 'atk', 300); }
      } else if (!c.cost) {
        const mons = S().monstersOf(this, team);
        if (mons.length) this.log(`🎵 Sintonia Uno! As tuas peças ganham +300 ATK neste turno.`);
        for (const m of mons) await this.addMod(m, 'atk', 300);
      } else this.log(`🎵 Sintonia Uno! ${c.name} foi ativada sem custo.`);
      await this.bus.emitAsync('DUEL_SINTONIA', { team, card: c });
    }

    async cutIn(card, team) {
      if (card.rarity !== 'L' && card.rarity !== 'UR') return;
      this.player(team).stats.cutIns++;
      await this.bus.emitAsync('CUT_IN', { card, team });
    }
  }

  DuelController.MAX_TURNS = MAX_TURNS;
  YC.DuelController = DuelController;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
