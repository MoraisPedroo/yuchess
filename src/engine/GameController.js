/* GameController.js — orquestrador das fases do turno:
   TURN_START → UNO_CARD_PHASE → BOARD_ACTION_PHASE → (CHAIN_RESOLUTION_PHASE) → [BONUS_STEP] → END_PHASE.
   Humanos e IA despacham as mesmas ações (DISPATCH_ACTION); a Chain pergunta respostas aos "agentes". */
(function (YC) {
  'use strict';

  const HAND_REFILL_BELOW = 5;
  const SUDDEN_DEATH_TURN = 60;
  const MAX_TURNS = 240;
  const makeLink = (...a) => YC.ChainResolver.makeLink(...a);
  const sameSq = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];

  class GameController {
    constructor(opts = {}) {
      this.bus = opts.bus || new YC.EventBus();
      this.seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9);
      this.rng = YC.mulberry32(this.seed);
      this.fast = !!opts.fast;
      this.mode = opts.mode || 'AI';
      this.names = opts.names || { WHITE: 'Brancas', BLACK: 'Pretas' };
      this.agents = opts.agents || {};
      this.board = new YC.BoardEngine(this.bus);
      this.uno = new YC.UnoEconomy(this.bus, this.rng);
      this.chain = new YC.ChainResolver(this);
      this.effects = new YC.EffectInterpreter(this);
      this.combat = YC.CombatRPG;
      this.busy = false;
      this.aborted = false;
      this.logLines = [];
      this.turnDeferred = null;
      this.state = null;
      this.netHook = null;   // multijogador: recebe cada ação local antes de ser aplicada
      this.localTeam = null; // multijogador: equipa controlada neste dispositivo
    }

    static newPlayer(team) { return { team, support: [null, null, null], setThisTurn: false, sovereigntyUsed: false, sovereigntyArmed: false }; }
    static newStats() { return { kills: 0, damage: 0, trapsActivated: 0, parries: 0, counters: 0, cardsPlayed: 0, piecesLost: 0 }; }

    setup() {
      this.board.reset();
      this.uno.reset();
      this.state = {
        turnCount: 0, active: 'BLACK', phase: 'SETUP', permission: null, winner: null, bonusPieceUid: null,
        players: { WHITE: GameController.newPlayer('WHITE'), BLACK: GameController.newPlayer('BLACK') },
        stats: { WHITE: GameController.newStats(), BLACK: GameController.newStats() }
      };
      this.bus.emit('GAME_SETUP', { game: this });
    }

    wait(ms) { return this.fast || !ms ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)); }
    teamName(team) { return this.names[team] || team; }
    log(text, kind = 'info') {
      const line = { text, kind, turn: this.state ? this.state.turnCount : 0 };
      this.logLines.push(line);
      if (this.logLines.length > 250) this.logLines.shift();
      this.bus.emit('LOG', line);
    }
    setPhase(phase) {
      this.state.phase = phase;
      this.bus.emit('PHASE_CHANGED', { phase, team: this.state.active });
    }
    abort() { this.aborted = true; if (this.turnDeferred) this.turnDeferred.resolve(); }

    // ── Ciclo principal ──
    async start() {
      if (!this.state) this.setup();
      while (!this.state.winner && !this.aborted) {
        await this.beginTurn();
        if (this.state.winner || this.aborted) break;
        this.turnDeferred = YC.deferred();
        const agent = this.agents[this.state.active];
        Promise.resolve().then(() => agent.playTurn(this)).catch((err) => { console.error('[agent]', err); this.finishTurn(); });
        await this.turnDeferred.promise;
        await this.whenIdle();
        if (this.aborted || this.state.winner) break;
        await this.endTurn();
      }
      if (this.state.winner && !this.aborted) {
        this.state.phase = 'GAME_OVER';
        await this.bus.emitAsync('GAME_OVER', { winner: this.state.winner, stats: this.state.stats, game: this });
      }
      return this.state.winner;
    }

    async beginTurn() {
      const s = this.state;
      s.turnCount++;
      s.active = s.turnCount === 1 ? 'WHITE' : YC.other(s.active);
      s.phase = 'TURN_START';
      s.permission = null;
      s.bonusPieceUid = null;
      Object.assign(s.players[s.active], { setThisTurn: false, sovereigntyArmed: false });
      for (const p of this.board.pieces()) {
        p.statuses = p.statuses.filter((st) => s.turnCount < st.expiresAtTurn);
        p.buffs = p.buffs.filter((b) => s.turnCount < b.expiresAtTurn);
        if (p.team === s.active) p.tempShield = 0;
      }
      this.log(`— Turno ${s.turnCount}: ${this.teamName(s.active)} —`, 'turn');
      await this.bus.emitAsync('TURN_STARTED', { team: s.active, turn: s.turnCount });
      if (s.turnCount >= MAX_TURNS) { this.setWinner('DRAW'); return; }
      if (s.turnCount >= SUDDEN_DEATH_TURN) {
        const k = this.board.king(s.active);
        const dmg = 10 + 5 * Math.floor((s.turnCount - SUDDEN_DEATH_TURN) / 2);
        this.log(`⏰ Morte Súbita: o Rei de ${this.teamName(s.active)} perde ${dmg} HP.`, 'warn');
        if (k) await this.damagePiece(k, dmg, { ignoreShield: true, source: 'Morte Súbita' });
        if (s.winner) return;
      }
      if (this.uno.hand(s.active).length < HAND_REFILL_BELOW) this.uno.draw(s.active, 1);
      this.setPhase('UNO_CARD_PHASE');
    }

    async endTurn() {
      for (const p of this.board.pieces()) {
        p.tempAtk = 0; p.overdrive = false; p.pierce = false;
        if (p.swapped) this.restoreSwap(p);
      }
      await this.bus.emitAsync('TURN_ENDED', { team: this.state.active });
    }

    finishTurn() {
      if (!this.state || this.state.phase === 'END_PHASE' || this.state.phase === 'GAME_OVER') {
        if (this.turnDeferred) this.turnDeferred.resolve();
        return;
      }
      this.setPhase('END_PHASE');
      if (this.turnDeferred) this.turnDeferred.resolve();
    }

    /** Desistência (também usada quando o adversário online abandona). */
    resign(team, reason = 'desiste da partida') {
      if (!this.state || this.state.winner) return;
      this.state.resignedBy = team;
      this.log(`🏳 ${this.teamName(team)} ${reason}.`, 'kill');
      this.setWinner(YC.other(team));
    }

    /** Impressão digital do estado (deteção de dessincronização no modo online). */
    stateHash() {
      const s = this.state;
      if (!s) return 0;
      const parts = [s.turnCount, s.active, s.phase, this.uno.top ? this.uno.top.uid : '', this.uno.activeColor, this.uno.deck.length,
        this.uno.graveyard.length, this.uno.hands.WHITE.map((c) => c.uid).join(','), this.uno.hands.BLACK.map((c) => c.uid).join(','),
        s.permission ? `${s.permission.used}` : '-'];
      for (const p of this.board.pieces()) parts.push(`${p.uid}${p.type[0]}${p.row}${p.col}:${p.hp}/${p.shield}/${p.tempShield}/${p.tempAtk}`);
      for (const t of YC.TEAMS) {
        parts.push(s.players[t].support.map((c) => (c ? c.uid : '_')).join(''));
        parts.push(this.board.trapsOf(t).map((c) => `${c.row}${c.col}`).join(''));
      }
      const str = parts.join('|');
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
      return h;
    }

    setWinner(team) {
      if (this.state.winner) return;
      this.state.winner = team;
      this.setPhase('GAME_OVER');
      if (this.turnDeferred) this.turnDeferred.resolve();
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
      catch (err) { console.error('[GameController]', action.type, err); ok = false; }
      finally {
        this.busy = false;
        this.bus.emit('BUSY', { busy: false });
        this.bus.emit('STATE_CHANGED', { game: this });
        const waiting = this.idleWaiters || [];
        this.idleWaiters = [];
        waiting.forEach((fn) => fn());
      }
      return ok;
    }

    /** Espera que a ação em curso (e a sua Chain) termine antes de fechar o turno. */
    whenIdle() {
      if (!this.busy) return Promise.resolve();
      return new Promise((resolve) => { (this.idleWaiters = this.idleWaiters || []).push(resolve); });
    }

    async handle(team, a) {
      switch (a.type) {
        case 'SET_TRAP': return this.doSetTrap(team, a);
        case 'SET_SUPPORT': return this.doSetSupport(team, a);
        case 'ARM_SOVEREIGNTY': return this.doArmSovereignty(team);
        case 'PLAY_UNO_CARD': return this.doPlayUno(team, a);
        case 'FALLBACK_DRAW': return this.doFallback(team);
        case 'DECLARE_MOVE': return this.doDeclareMove(team, a);
        case 'BONUS_STEP': return this.doBonusStep(team, a);
        case 'SKIP_BONUS':
          if (this.state.phase !== 'BONUS_STEP') return false;
          this.finishTurn(); return true;
        case 'END_TURN':
          if (!['UNO_CARD_PHASE', 'BOARD_ACTION_PHASE', 'BONUS_STEP'].includes(this.state.phase)) return false;
          this.log(`${this.teamName(team)} termina o turno.`);
          this.finishTurn(); return true;
        default: return false;
      }
    }

    canSetNow(team) {
      const s = this.state;
      return s.active === team && ['UNO_CARD_PHASE', 'BOARD_ACTION_PHASE'].includes(s.phase) &&
        !s.players[team].setThisTurn && !(s.permission && s.permission.used);
    }

    async doSetTrap(team, a) {
      const card = this.uno.findInHand(team, a.cardUid);
      if (!this.canSetNow(team) || !card || card.yugioh.cardType !== 'SPATIAL_TRAP') return false;
      if (!this.board.canSetTrapAt(team, a.row, a.col)) return false;
      this.uno.removeFromHand(team, card.uid);
      const { clash } = this.board.setTrap(card, team, a.row, a.col, this.state.turnCount);
      this.state.players[team].setThisTurn = true;
      if (clash) {
        this.uno.toGraveyard(card);
        this.uno.toGraveyard(clash.card);
        this.log(`CLANG! Já havia uma armadilha de ${this.teamName(clash.owner)} em ${this.board.squareName(a.row, a.col)} — ambas destruídas ("${clash.card.name}" e "${card.name}").`, 'warn');
        await this.bus.emitAsync('TRAP_CLASH', { row: a.row, col: a.col, cards: [card, clash.card] });
        return true;
      }
      this.log(`${this.teamName(team)} esconde uma armadilha no tabuleiro…`);
      await this.bus.emitAsync('CARD_SET', { team, card, zone: 'BOARD', row: a.row, col: a.col });
      return true;
    }

    async doSetSupport(team, a) {
      const card = this.uno.findInHand(team, a.cardUid);
      if (!this.canSetNow(team) || !card || !['QUICK_SPELL', 'COUNTER_TRAP'].includes(card.yugioh.cardType)) return false;
      const support = this.state.players[team].support;
      const slot = a.slot != null && support[a.slot] === null ? a.slot : support.indexOf(null);
      if (slot < 0) return false;
      this.uno.removeFromHand(team, card.uid);
      card.turnSet = this.state.turnCount; card.owner = team;
      support[slot] = card;
      this.state.players[team].setThisTurn = true;
      this.log(`${this.teamName(team)} coloca uma carta virada para baixo na Zona de Suporte.`);
      await this.bus.emitAsync('CARD_SET', { team, card, zone: 'SUPPORT', slot });
      return true;
    }

    canUseSovereignty(team) {
      const p = this.state.players[team];
      return !p.sovereigntyUsed && this.board.pieces(team).some((x) => x.type === 'QUEEN');
    }

    doArmSovereignty(team) {
      if (this.state.phase !== 'UNO_CARD_PHASE' || !this.canUseSovereignty(team)) return false;
      const p = this.state.players[team];
      p.sovereigntyArmed = !p.sovereigntyArmed;
      return true;
    }

    /** SKIP/REVERSE coloridos precisam de um alvo escolhido no anúncio. */
    targetRequirement(card, team) {
      if (card.uno.color === 'W') return null;
      if (card.uno.value === 'SKIP') return { kind: 'ENEMY', candidates: this.board.pieces(YC.other(team)) };
      if (card.uno.value === 'REVERSE') return { kind: 'ANY', candidates: this.board.pieces() };
      return null;
    }

    suggestColor(team, exceptUid) {
      const count = { R: 0, B: 0, G: 0, Y: 0 };
      for (const c of this.uno.hand(team)) if (c.uid !== exceptUid && count[c.uno.color] != null) count[c.uno.color]++;
      return Object.keys(count).sort((a, b) => count[b] - count[a])[0];
    }

    canPlayCard(team, card) {
      if (this.state.phase !== 'UNO_CARD_PHASE' || this.state.active !== team) return false;
      return this.uno.matches(card) || (this.state.players[team].sovereigntyArmed && this.canUseSovereignty(team));
    }

    async doPlayUno(team, a) {
      const s = this.state;
      if (s.phase !== 'UNO_CARD_PHASE') return false;
      const card = this.uno.findInHand(team, a.cardUid);
      if (!card) return false;
      const p = s.players[team];
      const matches = this.uno.matches(card);
      const sovereign = !matches && p.sovereigntyArmed && this.canUseSovereignty(team);
      if (!matches && !sovereign) return false;
      const need = this.targetRequirement(card, team);
      let targetUid = null;
      if (need) {
        if (a.targetUid) {
          if (!need.candidates.some((x) => x.uid === a.targetUid)) return false;
          targetUid = a.targetUid;
        } else if (need.candidates.length) return false;
      }
      const chosenColor = card.uno.color === 'W'
        ? (['R', 'B', 'G', 'Y'].includes(a.chosenColor) ? a.chosenColor : this.suggestColor(team, card.uid)) : null;
      if (sovereign) {
        p.sovereigntyUsed = true; p.sovereigntyArmed = false;
        this.log(`👑 Soberania da Dama! ${this.teamName(team)} ignora a cor da pilha.`, 'warn');
      }
      this.uno.removeFromHand(team, card.uid);
      s.stats[team].cardsPlayed++;
      this.setPhase('CHAIN_RESOLUTION_PHASE');
      const link = makeLink('UNO_PLAY', team, { card, ss: 1, chosenColor, targets: { chosenUid: targetUid }, label: card.name });
      const tgt = targetUid ? this.board.getPiece(targetUid) : null;
      this.log(`🃏 ${this.teamName(team)} joga ${card.name}${chosenColor ? ' → cor ' + YC.CardDatabase.COLOR_NAME[chosenColor] : ''}${tgt ? ' (alvo: ' + tgt.name + ' ' + this.board.squareName(tgt.row, tgt.col) + ')' : ''}.`);
      await this.bus.emitAsync('UNO_CARD_PLAYED', { team, card, chosenColor });
      await this.chain.run(link);
      if (s.winner) return true;
      if (link.negated) {
        this.uno.toGraveyard(card);
        s.permission = null;
        this.log(`A carta de ${this.teamName(team)} foi destruída. Joga outra ou compra.`, 'warn');
        this.setPhase('UNO_CARD_PHASE');
        return true;
      }
      if (this.uno.hand(team).length === 1) await this.bus.emitAsync('UNO_CALL', { team });
      this.enterBoardPhase();
      return true;
    }

    async doFallback(team) {
      const s = this.state;
      if (s.phase !== 'UNO_CARD_PHASE') return false;
      const got = this.uno.draw(team, 1);
      s.permission = this.uno.fallbackPermission(this.board, team, s.turnCount);
      this.log(`${this.teamName(team)} compra ${got.length ? '1 carta' : '(baralho vazio)'} e recebe a Permissão de Emergência (só ${s.permission.allowed.includes('KING') ? 'Peão ou Rei' : 'Peão'}).`);
      await this.bus.emitAsync('FALLBACK_DRAW', { team, cards: got });
      this.enterBoardPhase();
      return true;
    }

    enterBoardPhase() {
      const s = this.state;
      s.permission.hasMoves = this.board.pieces(s.active).some((p) => this.board.getValidMoves(p, s.permission, s.turnCount).length);
      this.setPhase('BOARD_ACTION_PHASE');
      this.bus.emit('PERMISSION_GRANTED', { team: s.active, permission: s.permission });
    }

    describeMove(piece, move) {
      const b = this.board, from = b.squareName(move.from[0], move.from[1]), to = b.squareName(move.to[0], move.to[1]);
      if (move.type === 'ATTACK') { const d = b.getPiece(move.defenderUid); return `${piece.name} ${from} ataca ${d.name} em ${to}`; }
      if (move.type === 'SWAP') return `${piece.name} ${from} troca com ${b.getPiece(move.swapUid).name} ${to}`;
      if (move.type === 'CASTLE') return `Roque! ${piece.name} ${from}→${to}`;
      return `${piece.name} ${from}→${to}`;
    }

    async doDeclareMove(team, a) {
      const s = this.state;
      if (s.phase !== 'BOARD_ACTION_PHASE' || !s.permission || s.permission.used) return false;
      const piece = this.board.getPiece(a.pieceUid);
      if (!piece || !piece.alive || piece.team !== team) return false;
      const move = this.board.getValidMoves(piece, s.permission, s.turnCount).find((m) => sameSq(m.to, a.to));
      if (!move) return false;
      s.permission.used = true;
      const ctx = { pieceUid: piece.uid, move, defenderUid: move.defenderUid, interrupted: false };
      const link = makeLink('MOVE', team, { ss: 1, move: ctx, label: this.describeMove(piece, move) });
      this.setPhase('CHAIN_RESOLUTION_PHASE');
      this.log(`♞ ${this.teamName(team)}: ${link.label}.`);
      await this.bus.emitAsync('MOVE_DECLARED', { piece, move });
      await this.chain.run(link);
      if (s.winner) return true;
      if (link.negated) {
        this.log('O movimento foi anulado!', 'warn');
        await this.bus.emitAsync('MOVE_CANCELLED', { piece });
      } else {
        await this.executeMove(piece, ctx, false);
      }
      if (s.winner) return true;
      if (s.permission.boost.step && piece.alive && !this.board.isStunned(piece, s.turnCount) && this.bonusSteps(piece).length) {
        s.bonusPieceUid = piece.uid;
        this.setPhase('BONUS_STEP');
        return true;
      }
      this.finishTurn();
      return true;
    }

    bonusSteps(piece) {
      return this.board.neighbors(piece.row, piece.col, true).filter(([r, c]) => !this.board.pieceAt(r, c));
    }

    async doBonusStep(team, a) {
      const s = this.state;
      if (s.phase !== 'BONUS_STEP') return false;
      const piece = this.board.getPiece(s.bonusPieceUid);
      if (!piece || !piece.alive || !this.bonusSteps(piece).some((sq) => sameSq(sq, a.to))) return false;
      this.log(`⚡ Passo Relâmpago: ${piece.name} → ${this.board.squareName(a.to[0], a.to[1])}.`);
      const move = { type: 'MOVE', from: [piece.row, piece.col], to: a.to.slice(), rayPath: [a.to.slice()] };
      await this.executeMove(piece, { pieceUid: piece.uid, move, interrupted: false }, true);
      this.finishTurn();
      return true;
    }

    // ── Execução do movimento (depois da Chain CL1 resolver) ──
    stillValid(piece, move) {
      const b = this.board;
      if (!sameSq([piece.row, piece.col], move.from)) return false;
      if (move.type === 'SWAP') { const o = b.getPiece(move.swapUid); return !!o && o.alive && sameSq([o.row, o.col], move.to); }
      if (move.type === 'CASTLE') {
        const rook = b.getPiece(move.rook.uid);
        return !!rook && rook.alive && sameSq([rook.row, rook.col], move.rook.from) && !b.pieceAt(move.to[0], move.to[1]);
      }
      const last = move.rayPath.length - 1;
      for (let i = 0; i < last; i++) if (b.pieceAt(move.rayPath[i][0], move.rayPath[i][1])) return false;
      const end = b.pieceAt(move.to[0], move.to[1]);
      if (move.type === 'ATTACK') return !!end && end.uid === move.defenderUid;
      return !end;
    }

    async applyBoost(piece) {
      const b = this.state.permission && this.state.permission.boost;
      if (!b) return;
      piece.tempAtk += b.atk;
      piece.tempShield += b.tempShield;
      if (b.shield) this.combat.addShield(piece, b.shield);
      if (b.heal) this.combat.heal(piece, b.heal);
      if (b.overdrive) piece.overdrive = true;
      if (b.pierce) piece.pierce = true;
      if (b.atk || b.tempShield || b.shield || b.heal || b.overdrive || b.pierce) {
        await this.bus.emitAsync('PIECE_BUFFED', { piece, boost: b });
      }
    }

    cleanseRow(team, row) {
      for (const p of this.board.pieces(team)) {
        if (p.row !== row) continue;
        p.statuses = p.statuses.filter((st) => st.type !== 'STUNNED');
        p.buffs = p.buffs.filter((bf) => bf.amount >= 0);
      }
      this.log(`O 0 limpa os debuffs da fila ${8 - row}.`);
    }

    async executeMove(piece, ctx, isBonus) {
      const s = this.state, b = this.board, move = ctx.move;
      if (!piece.alive) { this.log(`${piece.name} já não está em jogo.`); return; }
      if (b.isStunned(piece, s.turnCount)) {
        this.log(`${piece.name} está congelada e não se mexe!`, 'warn');
        await this.bus.emitAsync('FLOAT_TEXT', { piece, text: 'CONGELADA!' });
        return;
      }
      if (!this.stillValid(piece, move)) { this.log('O caminho mudou — movimento cancelado.', 'warn'); return; }
      if (!isBonus) await this.applyBoost(piece);

      if (move.type === 'SWAP') {
        const other = b.getPiece(move.swapUid);
        b.swap(piece, other);
        await this.bus.emitAsync('PIECES_SWAPPED', { a: piece, b: other });
        this.cleanseRow(piece.team, piece.row);
        return;
      }
      if (move.type === 'CASTLE') {
        const rook = b.getPiece(move.rook.uid);
        await this.travel(piece, [move.to]);
        await this.travel(rook, [move.rook.to]);
        piece.hasMoved = rook.hasMoved = true;
        this.cleanseRow(piece.team, piece.row);
        return;
      }

      const path = move.rayPath;
      const isAttack = move.type === 'ATTACK';
      const checks = new Set(b.trapCheckIndices(piece, move));
      const travelEnd = isAttack ? path.length - 2 : path.length - 1;
      let pos = -1;
      for (let i = 0; i <= travelEnd; i++) {
        if (!checks.has(i)) continue;
        const trap = b.armedEnemyTrap(path[i][0], path[i][1], piece.team, s.turnCount);
        if (!trap) continue;
        await this.travel(piece, path.slice(pos + 1, i + 1));
        pos = i;
        await this.triggerTrap(piece, trap, path[i].slice(), ctx);
        if (s.winner || !piece.alive) return;
        if (ctx.interrupted) { piece.hasMoved = true; await this.afterMove(piece); return; }
      }
      if (isAttack) {
        await this.resolveAttack(piece, b.getPiece(move.defenderUid), move);
      } else if (pos < path.length - 1) {
        await this.travel(piece, path.slice(pos + 1));
      }
      if (piece.alive && !s.winner) {
        piece.hasMoved = true;
        if (s.permission && s.permission.zero && !isBonus) this.cleanseRow(piece.team, piece.row);
        await this.afterMove(piece);
      }
    }

    async travel(piece, segment) {
      if (!segment.length) return;
      const from = [piece.row, piece.col], to = segment[segment.length - 1];
      this.board.moveTo(piece, to[0], to[1]);
      await this.bus.emitAsync('PIECE_MOVED', { piece, from, to: to.slice(), path: segment });
    }

    async afterMove(piece) {
      const lastRow = piece.team === 'WHITE' ? 0 : 7;
      if (piece.type === 'PAWN' && piece.row === lastRow) {
        this.board.promote(piece);
        this.log(`👑 Promoção! O Peão de ${this.teamName(piece.team)} vira Dama.`, 'warn');
        await this.bus.emitAsync('PIECE_PROMOTED', { piece });
      }
    }

    async triggerTrap(piece, trap, coord, ctx) {
      const b = this.board;
      b.removeTrap(coord[0], coord[1]);
      this.state.stats[trap.owner].trapsActivated++;
      this.log(`💥 ARMADILHA! ${piece.name} pisou "${trap.card.name}" em ${b.squareName(coord[0], coord[1])}.`, 'warn');
      const link = makeLink('TRAP', trap.owner, {
        card: trap.card, ss: trap.card.yugioh.spellSpeed, label: trap.card.name,
        trap: { coord, triggeringUid: piece.uid, moveCtx: ctx }, targets: {}
      });
      await this.bus.emitAsync('SPATIAL_TRAP_TRIGGERED', { piece, trap, coord, link });
      await this.chain.run(link);
      this.uno.toGraveyard(trap.card);
    }

    async resolveAttack(attacker, defender, move) {
      const s = this.state, b = this.board;
      if (!defender || !defender.alive) return;
      const res = this.combat.resolve(attacker, defender, move, b, s.turnCount);
      s.stats[attacker.team].damage += res.damage;
      if (res.retaliation) s.stats[defender.team].damage += res.retaliation.damage;
      this.log(`⚔ ${attacker.name} → ${defender.name}: ${res.atk} ATK, ${res.blocked} bloqueado, −${res.damage} HP.` +
        (res.retaliation ? ` Contra-ataque: −${res.retaliation.damage} HP.` : ''));
      await this.bus.emitAsync('COMBAT_RESOLVED', { attacker, defender, result: res, move });
      if (res.defenderDestroyed) {
        await this.destroyPiece(defender, attacker);
        if (s.winner) return;
        const from = [attacker.row, attacker.col];
        b.moveTo(attacker, move.to[0], move.to[1]);
        await this.bus.emitAsync('PIECE_MOVED', { piece: attacker, from, to: move.to.slice(), path: [move.to], kind: 'ADVANCE' });
        const cell = b.cell(move.to[0], move.to[1]);
        if (cell.trap && cell.trap.owner !== attacker.team) {
          const t = b.removeTrap(move.to[0], move.to[1]);
          this.uno.toGraveyard(t.card);
          this.log(`CRUNCH! ${attacker.name} esmagou uma armadilha escondida.`);
          await this.bus.emitAsync('TRAP_DESTROYED', { row: move.to[0], col: move.to[1], card: t.card });
        }
        return;
      }
      if (res.attackerDestroyed) { await this.destroyPiece(attacker, defender); return; }
      const from = [attacker.row, attacker.col];
      b.moveTo(attacker, res.bounceTo[0], res.bounceTo[1]);
      await this.bus.emitAsync('PIECE_BOUNCED', { piece: attacker, impact: move.to.slice(), from, to: res.bounceTo, kind: 'COMBAT' });
    }

    // ── Primitivas usadas pelos efeitos ──
    async destroyPiece(piece, by) {
      if (!piece.alive) return;
      this.board.remove(piece);
      this.state.stats[piece.team].piecesLost++;
      if (by) this.state.stats[by.team].kills++;
      this.log(`☠ ${piece.name} de ${this.teamName(piece.team)} foi ao tapete!`, 'kill');
      await this.bus.emitAsync('PIECE_DESTROYED', { piece, by });
      if (piece.type === 'KING') this.setWinner(YC.other(piece.team));
    }

    async damagePiece(piece, amount, opts = {}) {
      if (!piece || !piece.alive) return null;
      const hit = this.combat.applyDamage(piece, amount, { ignoreShield: opts.ignoreShield, board: this.board });
      await this.bus.emitAsync('PIECE_DAMAGED', { piece, hit, source: opts.source, cost: !!opts.cost, quiet: !!opts.quiet });
      if (!opts.quiet && !opts.cost) this.log(`${piece.name} sofre ${hit.damage} de dano${hit.blocked ? ` (${hit.blocked} bloqueado)` : ''}.`);
      if (hit.destroyed) await this.destroyPiece(piece, null);
      return hit;
    }

    healPiece(piece, amount, quiet) {
      if (!piece || !piece.alive) return 0;
      const healed = this.combat.heal(piece, amount);
      this.bus.emit('PIECE_HEALED', { piece, amount: healed });
      if (!quiet) this.log(`${piece.name} recupera ${healed} HP.`);
      return healed;
    }

    expiryFor(piece, turns) {
      const T = this.state.turnCount;
      return piece.team === this.state.active ? T + 2 * turns + 1 : T + 2 * turns;
    }

    async buffPiece(piece, eff) {
      if (eff.stat === 'shield') this.combat.addShield(piece, eff.amount);
      else if (eff.stat === 'atk') {
        if (eff.duration === 'TURN') piece.tempAtk += eff.amount;
        else piece.buffs.push({ stat: 'atk', amount: eff.amount, expiresAtTurn: this.expiryFor(piece, eff.durationTurns || 1) });
      }
      const label = eff.stat === 'shield' ? 'ESC' : 'ATK';
      this.log(`${piece.name}: ${eff.amount > 0 ? '+' : ''}${eff.amount} ${label}.`);
      await this.bus.emitAsync('PIECE_BUFFED', { piece, stat: eff.stat, amount: eff.amount });
    }

    async applyStatus(piece, status, turns) {
      piece.statuses = piece.statuses.filter((st) => st.type !== status);
      piece.statuses.push({ type: status, expiresAtTurn: this.expiryFor(piece, turns) });
      this.log(`❄ ${piece.name} fica ${status === 'STUNNED' ? 'CONGELADA' : status} por ${turns} turno(s).`);
      await this.bus.emitAsync('STATUS_APPLIED', { piece, status });
    }

    swapAtkShield(piece) {
      if (piece.swapped) { this.restoreSwap(piece); return; }
      piece.swapped = { atk: piece.atk, shield: piece.shield, start: Math.min(this.combat.SHIELD_CAP, piece.atk) };
      const atk = piece.atk;
      piece.atk = piece.shield;
      piece.shield = Math.min(this.combat.SHIELD_CAP, atk);
    }

    restoreSwap(p) {
      const consumed = Math.max(0, p.swapped.start - p.shield);
      p.atk = p.swapped.atk;
      p.shield = Math.max(0, p.swapped.shield - consumed);
      p.swapped = null;
    }

    // ── Resolução de cada elo da Chain ──
    async resolveLink(link, stack, index) {
      if (link.kind === 'UNO_PLAY') return this.resolveUnoPlay(link, stack, index);
      if (link.kind === 'MOVE') { link.approved = true; return; }
      await this.bus.emitAsync('CARD_RESOLVING', { link });
      await this.effects.execute(link, stack, index);
    }

    async resolveUnoPlay(link, stack, index) {
      const s = this.state, card = link.card, team = link.owner, b = this.board;
      this.uno.placeOnDiscard(card, link.chosenColor);
      s.permission = this.uno.permissionFor(card);
      await this.bus.emitAsync('UNO_CARD_RESOLVED', { team, card, activeColor: this.uno.activeColor });
      if (card.uno.color !== 'W') {
        const target = link.targets.chosenUid ? b.getPiece(link.targets.chosenUid) : null;
        if (card.uno.value === 'SKIP' && target && target.alive) await this.applyStatus(target, 'STUNNED', 1);
        if (card.uno.value === 'REVERSE' && target && target.alive) {
          this.swapAtkShield(target);
          this.log(`⇄ ${target.name} troca ATK↔ESC até ao fim do turno (ATK ${target.atk}, ESC ${target.shield}).`);
          await this.bus.emitAsync('STATS_SWAPPED', { piece: target });
        }
        if (card.uno.value === 'DRAW2') {
          const got = this.uno.draw(team, 2);
          const lost = this.uno.discardRandom(YC.other(team), 1);
          this.log(`+2: ${this.teamName(team)} compra ${got.length}; ${this.teamName(YC.other(team))} perde ${lost.length ? lost[0].name : 'nada'}.`);
          await this.bus.emitAsync('CARDS_LOST', { team: YC.other(team), cards: lost });
        }
      }
      if (card.yugioh.cardType === 'NORMAL_SPELL') await this.effects.execute(link, stack, index);
    }
  }

  GameController.HAND_REFILL_BELOW = HAND_REFILL_BELOW;
  GameController.SUDDEN_DEATH_TURN = SUDDEN_DEATH_TURN;
  YC.GameController = GameController;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
