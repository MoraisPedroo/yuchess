/* MatchController.js — uma partida de Chess-Gi-Oh!: xadrez normal + cartas.
   Turno: PREP (até 2 ações de carta: equipar, armar armadilha de casa, virar carta na Zona, Magia Rápida)
   → um lance de xadrez (resolvido pelo MoveResolver, com Chain) → END_PHASE.
   Todo o estado muda por `dispatch(ação)`; no online as ações são replicadas tal e qual (lockstep). */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const R = () => YC.Cards.RULES;
  const TEAMS = ['w', 'b'];
  const MAX_TURNS = 300;
  const LABEL = { w: 'Brancas', b: 'Pretas' };

  class Match {
    constructor({ bus, seed = 1, decks, names = {}, mode = 'BOT' }) {
      this.bus = bus || new YC.EventBus();
      this.seed = seed >>> 0;
      this.rng = YC.mulberry32(this.seed);
      this.mode = mode;
      this.pos = C().fromFEN(C().START);
      this.uidSeq = 0;
      this.players = {};
      for (const t of TEAMS) {
        this.players[t] = { team: t, name: names[t] || LABEL[t], deck: (decks[t] || []).map((id) => this.newInst(id, t)), hand: [], gy: [], zone: [], banished: [], lostTypes: [], stats: { captures: 0, cards: 0, lost: 0 } };
      }
      this.pos.board.forEach((p, sq) => { if (p) p.home = sq; });
      this.pos.blocked = [];
      this.traps = [];
      this.state = { active: 'w', turnCount: 0, phase: 'SETUP', actionsLeft: 0, winner: null, reason: '', mustPass: false, movedThisTurn: false, shieldLock: { w: 0, b: 0 }, ownTurns: { w: 0, b: 0 }, blocks: [], actionMod: { w: 0, b: 0 } };
      this.agents = {};
      this.chain = null;
      this.pending = [];
      this.repetition = new Map();
      this.log = [];
      this.netHook = null;
      this.busy = false;
      this.aborted = false;
      this.waiters = [];
    }

    newInst(id, owner) { return { uid: `${owner}${++this.uidSeq}`, id, owner }; }
    get over() { return !!this.state.winner || this.aborted; }
    other(t) { return t === 'w' ? 'b' : 'w'; }
    player(t) { return this.players[t]; }
    pieceAt(sq) { return sq >= 0 && sq < 64 ? this.pos.board[sq] : null; }
    sqOf(piece) { return piece ? this.pos.board.indexOf(piece) : -1; }
    pieceById(id) { return this.pos.board.find((p) => p && p.id === id) || null; }
    trapAt(sq, owner) { return this.traps.find((t) => t.sq === sq && (!owner || t.owner === owner)) || null; }
    nextOwnTurn(team) { return this.state.active === team ? this.state.turnCount + 2 : this.state.turnCount + 1; }
    untilTurn(team, n) { return this.nextOwnTurn(team) + 2 * (n - 1) + 1; }
    /** Linha do histórico. `info` (opcional, só para o ecrã): card (id da carta), uid, secret (o adversário não a vê),
        zone, sq (casa), pieceId, move { from, to, piece, capture }. Não entra no estado nem no stateHash. */
    say(text, team, info) { this.log.push({ turn: this.state.turnCount, team, text, ...(info || {}) }); this.bus.emit('log', { text, team }); }

    // ───────────── ciclo da partida ─────────────
    async start() {
      for (const t of TEAMS) this.rng.shuffle(this.players[t].deck);
      await this.bus.emitAsync('match:start', { match: this });
      for (const t of TEAMS) await this.draw(t, R().START_HAND, 'start');
      while (!this.over) {
        await this.beginTurn();
        if (this.over) break;
        const team = this.state.active, turn = this.state.turnCount, agent = this.agents[team];
        await agent.playTurn(this);
        if (this.over) break;
        if (this.state.turnCount === turn && this.state.phase !== 'END_PHASE') {
          if (agent.isRemote) { this.aborted = true; break; }
          await this.dispatch({ type: 'AUTO_MOVE', team });
        }
        if (!this.over) await this.finishTurn();
      }
      this.wake();
      this.bus.emit('state:changed');
      return this.state.winner;
    }

    async beginTurn() {
      const s = this.state;
      s.turnCount++;
      s.active = s.turnCount % 2 === 1 ? 'w' : 'b';
      this.pos.turn = s.active;
      s.ownTurns[s.active]++;
      s.phase = 'PREP';
      s.actionsLeft = this.actionsFor(s.active);
      s.mustPass = false;
      s.movedThisTurn = false;
      await this.tickStatuses();
      await this.bus.emitAsync('turn:start', { team: s.active, turnCount: s.turnCount, own: s.ownTurns[s.active] });
      // compra 1 carta por turno; só as Brancas, no 1.º turno da partida, não compram (já começam a jogar)
      if (s.turnCount > 1) await this.draw(s.active, 1, 'turn');
      await YC.CardEffects3.turnStart(this, s.active);
      this.evaluate();
      this.bus.emit('state:changed');
    }

    /** Ações de carta do turno: 2 ± as cartas que as mudaram (0 a 4); com a Balança do adversário, no máximo 1. */
    actionsFor(team) {
      const s = this.state;
      let n = Math.max(0, Math.min(R().MAX_ACTIONS, R().ACTIONS_PER_TURN + s.actionMod[team]));
      s.actionMod[team] = 0;
      if (this.pos.board.some((p) => p && p.color !== team && C().has(p, 'eq_balanca_justica'))) n = Math.min(n, 1);
      return n;
    }

    /** Xeque-mate, afogamento, ou "passa a vez" quando só as peças congeladas teriam lances. */
    evaluate() {
      const s = this.state, team = s.active;
      if (this.over) return;
      s.mustPass = false;
      if (C().legalMoves(this.pos, team, { turn: s.turnCount }).length) return;
      if (C().inCheck(this.pos, team)) return this.endGame(this.other(team), 'Xeque-mate');
      if (C().legalMoves(this.pos, team, {}).length) { s.mustPass = true; return; }
      this.endGame('DRAW', 'Afogamento');
    }

    async finishTurn() {
      const s = this.state;
      s.phase = 'END_PHASE';
      if (!s.movedThisTurn) this.pos.ep = -1;
      for (const p of this.pos.board) if (p && p.color === s.active) { p.dash = false; p.trapProof = false; }
      const key = C().positionKey(this.pos) + this.other(s.active);
      const n = (this.repetition.get(key) || 0) + 1;
      this.repetition.set(key, n);
      if (n >= 3) this.endGame('DRAW', 'Repetição tripla');
      else if (this.pos.half >= 100) this.endGame('DRAW', 'Regra dos 50 lances');
      else if (C().insufficientMaterial(this.pos)) this.endGame('DRAW', 'Material insuficiente');
      else if (s.turnCount >= MAX_TURNS) this.endGame('DRAW', 'Limite de turnos');
      await this.bus.emitAsync('turn:end', { team: s.active, turnCount: s.turnCount });
    }

    endMove() { this.state.phase = 'END_PHASE'; this.wake(); }
    waitTurnEnd() {
      const turn = this.state.turnCount;
      if (this.over || this.state.phase === 'END_PHASE') return Promise.resolve();
      return new Promise((resolve) => this.waiters.push({ turn, resolve }));
    }
    wake() { const ws = this.waiters.splice(0); ws.forEach((w) => w.resolve()); }

    endGame(winner, reason) {
      if (this.state.winner) return;
      this.state.winner = winner;
      this.state.reason = reason;
      this.state.phase = 'GAME_OVER';
      this.say(winner === 'DRAW' ? `Empate: ${reason}.` : `${LABEL[winner]} ganham: ${reason}.`);
      this.bus.emit('game:over', { winner, reason });
      this.wake();
    }

    resign(team, reason = 'Desistência') {
      if (this.over) return;
      this.endGame(this.other(team), reason);
      this.bus.emit('state:changed');
    }

    // ───────────── ações ─────────────
    findMove(a) {
      const moves = C().legalMovesFrom(this.pos, a.from, { turn: this.state.turnCount }).filter((m) => m.to === a.to);
      const pick = a.lance ? moves.filter((m) => m.flag === 'r') : moves.filter((m) => m.flag !== 'r').length ? moves.filter((m) => m.flag !== 'r') : moves;
      if (!pick.length) return null;
      return pick.find((m) => !m.promo || m.promo === (a.promo || 'q')) || null;
    }

    validate(a) {
      const s = this.state, E = YC.CardEffects;
      if (this.over) return 'A partida acabou.';
      if (!a || a.team !== s.active) return 'Não é a tua vez.';
      if (s.phase !== 'PREP' || this.busy) return 'Espera um momento…';
      const p = this.players[a.team];
      if (a.type === 'MOVE') return s.mustPass ? 'Não tens lances: passa a vez.' : this.findMove(a) ? null : 'Lance ilegal.';
      if (a.type === 'PASS') return s.mustPass ? null : 'Ainda tens lances possíveis.';
      if (a.type === 'AUTO_MOVE') return null;
      if (s.actionsLeft <= 0) return 'Já usaste as ações de carta deste turno.';
      const fromZone = a.type === 'ACTIVATE' && p.zone.find((z) => z.inst.uid === a.uid);
      const inst = fromZone ? fromZone.inst : p.hand.find((c) => c.uid === a.uid);
      if (!inst) return 'Essa carta não está disponível.';
      const def = YC.Cards.get(inst.id);
      if (a.type === 'EQUIP') return def.kind === 'EQUIP' && E.canEquip(def, this.pieceAt(a.sq), a.team, a.sq) ? null : 'Não dá para equipar essa peça.';
      if (a.type === 'SET_TRAP') {
        if (def.kind !== 'GRID') return 'Essa carta não é uma Armadilha de Casa.';
        if (this.traps.filter((t) => t.owner === a.team).length >= R().MAX_GRID_TRAPS) return 'Já tens 3 armadilhas no tabuleiro.';
        return E.trapSquares(this, a.team).includes(a.sq) ? null : 'Só podes armar em casas vazias das filas 3 a 6.';
      }
      if (a.type === 'SET_CARD') {
        if (!['REACTIVE', 'COUNTER', 'QUICK'].includes(def.kind)) return 'Essa carta não se vira na Zona.';
        return p.zone.length < R().ZONE_SLOTS ? null : 'A tua Zona de Armadilhas está cheia.';
      }
      if (a.type === 'ACTIVATE') {
        if (def.kind !== 'QUICK') return 'Só as Magias Rápidas se ativam agora.';
        if (fromZone && fromZone.setTurn >= s.turnCount) return 'Carta virada neste turno: só no próximo.';
        if (!E.canActivate(this, a.team, def)) return 'Agora não teria efeito.';
        return !def.target || E.validTarget(this, a.team, def, a.target) ? null : 'Alvo inválido.';
      }
      return 'Ação desconhecida.';
    }

    async dispatch(a) {
      const err = this.validate(a);
      if (err) { if (!a || !a._remote) this.bus.emit('ui:invalid', { message: err }); return false; }
      if (this.netHook) this.netHook(a);
      this.busy = true;
      try { await this.exec(a); } catch (e) { console.error('[match]', e); } finally { this.busy = false; }
      if (this.state.phase === 'PREP' && !this.over) this.evaluate();
      this.bus.emit('state:changed');
      return true;
    }

    async exec(a) {
      const s = this.state, p = this.players[a.team];
      const take = (list, uid) => list.splice(list.findIndex((c) => c.uid === uid), 1)[0];
      switch (a.type) {
        case 'MOVE': return YC.MoveResolver.execute(this, this.findMove(a));
        case 'PASS': this.say('Sem lances possíveis: passa a vez.', a.team); return this.endMove();
        case 'AUTO_MOVE': {
          if (s.mustPass) return this.endMove();
          const moves = C().legalMoves(this.pos, a.team, { turn: s.turnCount });
          if (!moves.length) return this.endMove();
          return YC.MoveResolver.execute(this, moves[this.rng.int(moves.length)]);
        }
        case 'EQUIP': {
          s.actionsLeft--; p.stats.cards++;
          const inst = take(p.hand, a.uid), piece = this.pieceAt(a.sq);
          await YC.ChainResolver.run(this, YC.ChainResolver.link(this, a.team, inst, { sq: a.sq, pieceId: piece.id }, 'hand'));
          return YC.ChainResolver.flushPending(this);
        }
        case 'SET_TRAP': {
          s.actionsLeft--; p.stats.cards++;
          const inst = take(p.hand, a.uid);
          const enemy = this.trapAt(a.sq, this.other(a.team));
          if (enemy) {
            this.traps.splice(this.traps.indexOf(enemy), 1);
            this.players[enemy.owner].gy.push(enemy.id);
            p.gy.push(inst.id);
            this.say('CLANG! Duas armadilhas na mesma casa destruíram-se.', a.team, { card: inst.id, sq: a.sq });
            return this.bus.emitAsync('trap:clang', { sq: a.sq, team: a.team, ids: [inst.id, enemy.id] });
          }
          const trap = { uid: inst.uid, id: inst.id, owner: a.team, sq: a.sq, setTurn: s.turnCount, revealed: false };
          this.traps.push(trap);
          this.say('Escondeu uma Armadilha de Casa no tabuleiro.', a.team, { card: inst.id, uid: inst.uid, secret: true, sq: a.sq });
          return this.bus.emitAsync('trap:set', { trap, team: a.team, inst });
        }
        case 'SET_CARD': {
          s.actionsLeft--; p.stats.cards++;
          const inst = take(p.hand, a.uid);
          p.zone.push({ inst, setTurn: s.turnCount });
          this.say('Virou uma carta para baixo na Zona de Armadilhas.', a.team, { card: inst.id, uid: inst.uid, secret: true, zone: true });
          return this.bus.emitAsync('card:set', { team: a.team, inst, slot: p.zone.length - 1 });
        }
        case 'ACTIVATE': {
          s.actionsLeft--; p.stats.cards++;
          const zi = p.zone.findIndex((z) => z.inst.uid === a.uid);
          const inst = zi >= 0 ? p.zone.splice(zi, 1)[0].inst : take(p.hand, a.uid);
          await YC.ChainResolver.run(this, YC.ChainResolver.link(this, a.team, inst, a.target || null, zi >= 0 ? 'zone' : 'hand'));
          return YC.ChainResolver.flushPending(this);
        }
      }
    }

    /** Assinatura do estado para detetar dessincronizações no online. */
    stateHash() {
      let s = `${this.state.turnCount}|${this.state.active}|${this.state.phase}|${this.state.actionsLeft}|${this.pos.ep}|`;
      for (const p of this.pos.board) {
        s += p ? `${p.id}${p.type}${p.shield ? 1 : 0}${p.frozenUntil}${p.morphUntil}${p.equips.join('+')}${p.lanceUsed ? 1 : 0},` : '.';
      }
      for (const t of TEAMS) {
        const pl = this.players[t];
        s += `|${pl.hand.map((c) => c.uid).join(',')}|${pl.deck.length}|${pl.zone.map((z) => z.inst.uid).join(',')}|${pl.gy.length}`;
      }
      s += `|${this.traps.map((t) => t.uid + t.sq).join(',')}`;
      let h = 0x811c9dc5;
      for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
      return (h >>> 0).toString(16);
    }
  }

  YC.PIECE_NAME = { p: 'Peão', n: 'Cavalo', b: 'Bispo', r: 'Torre', q: 'Dama', k: 'Rei' };
  YC.PIECE_FEM = { r: true, q: true };
  /** "o teu Peão" / "a tua Dama" */
  YC.yourPiece = (t) => `${YC.PIECE_FEM[t] ? 'a tua' : 'o teu'} ${YC.PIECE_NAME[t]}`;
  YC.Match = Match;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
