/* MatchStatus.js — utilitários da expansão de 120 cartas (acrescenta métodos ao YC.Match, como o MatchEffects):
   estados temporários das peças (silenciada, sem captura, intocável), casas bloqueadas, empurrões, trocas,
   transformações, peões novos, descartes, roubo e recuperação de cartas, ações de carta extra e a reciclagem
   do baralho. Nada disto deixa o próprio Rei em xeque nem toca no Rei. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const R = () => YC.Cards.RULES;
  const STATUS = ['silenced', 'noCap', 'untargetable'];
  const sgn = Math.sign;

  Object.assign(YC.Match.prototype, {
    // ───────────── estados e casas bloqueadas ─────────────
    /** silenced (equipamentos desligados), noCap (não captura nem dá xeque), untargetable (não é alvo de cartas). */
    async setStatus(piece, key, turns, cause) {
      const sq = this.sqOf(piece);
      if (sq < 0 || piece.type === 'k') return false;
      piece[key] = true;
      piece[`${key}Until`] = Math.max(piece[`${key}Until`] || 0, this.untilTurn(piece.color, turns));
      await this.bus.emitAsync('piece:status', { piece, sq, key, turns, cause });
      return true;
    },

    /** Bloqueia uma casa vazia até ao fim dos próximos `turns` turnos de `against`. */
    async blockSquare(sq, turns, against, cause) {
      if (sq < 0) return false;
      const until = this.untilTurn(against, turns);
      const b = this.state.blocks.find((x) => x.sq === sq);
      if (b) b.until = Math.max(b.until, until); else this.state.blocks.push({ sq, until });
      this.pos.blocked = this.state.blocks.map((x) => x.sq);
      await this.bus.emitAsync('square:block', { sq, turns, cause });
      return true;
    },

    /** Início de cada turno: acabam estados, bloqueios e transformações. */
    async tickStatuses() {
      const t = this.state.turnCount;
      for (let sq = 0; sq < 64; sq++) {
        const p = this.pos.board[sq];
        if (!p) continue;
        for (const k of STATUS) if (p[k] && p[`${k}Until`] <= t) p[k] = false;
        if (p.morphUntil && p.morphUntil <= t) await this.unmorph(p, sq);
      }
      const before = this.state.blocks.length;
      this.state.blocks = this.state.blocks.filter((b) => b.until > t);
      this.pos.blocked = this.state.blocks.map((b) => b.sq);
      if (before !== this.state.blocks.length) await this.bus.emitAsync('square:unblock', {});
    },

    async morphTo(piece, type, turns, cause) {
      const sq = this.sqOf(piece);
      if (sq < 0 || piece.type === 'k' || piece.type === type) { await this.bus.emitAsync('piece:immune', { piece, sq }); return false; }
      if (!piece.morphUntil) piece.morphFrom = piece.type;
      piece.type = type;
      piece.morphUntil = this.untilTurn(piece.color, turns);
      await this.bus.emitAsync('piece:morph', { piece, sq, cause });
      return true;
    },

    /** Volta à forma original. Um Peão transformado que acabe na última fila é promovido a Dama;
        na própria 1.ª fila fica com a forma que tinha (um Peão não pode estar lá). */
    async unmorph(p, sq) {
      const back = p.morphFrom, row = sq >> 3, last = p.color === 'w' ? 0 : 7;
      p.morphUntil = 0; p.morphFrom = null;
      if (back === 'p' && (row === 0 || row === 7)) {
        if (row === last) { p.type = 'q'; await this.bus.emitAsync('piece:promote', { piece: p, sq }); }
        return;
      }
      p.type = back;
      await this.bus.emitAsync('piece:unmorph', { piece: p, sq });
    },

    async promoteNow(piece, cause) {
      const sq = this.sqOf(piece);
      if (sq < 0) return false;
      piece.type = 'q'; piece.morphUntil = 0; piece.morphFrom = null;
      this.say(`Promoção: Dama em ${C().sqName(sq)}!`, piece.color, { sq, pieceId: piece.id });
      await this.bus.emitAsync('piece:promote', { piece, sq, cause });
      return true;
    },

    // ───────────── escudos e equipamentos ─────────────
    async shatter(piece, cause) {
      const sq = this.sqOf(piece);
      if (sq < 0 || !piece.shield) return false;
      piece.shield = false;
      await this.bus.emitAsync('shield:shatter', { piece, sq, cause });
      return true;
    },

    /** Tira `n` Equipamentos (os mais recentes; n = Infinity tira todos) e manda-os para o cemitério do dono. */
    async stripEquips(piece, n = Infinity) {
      const sq = this.sqOf(piece);
      if (sq < 0 || !piece.equips.length) return [];
      const ids = piece.equips.splice(Math.max(0, piece.equips.length - n));
      this.players[piece.color].gy.push(...ids);
      await this.bus.emitAsync('equip:strip', { piece, sq, ids });
      return ids;
    },

    // ───────────── movimento forçado ─────────────
    /** Casa livre para uma peça forçada a mexer-se (não sai do tabuleiro, não entra em casa bloqueada,
        um Peão não vai para a 1.ª nem a 8.ª fila). */
    freeFor(piece, sq) {
      return sq >= 0 && !this.pos.board[sq] && !C().isBlocked(this.pos, sq) && !(piece.type === 'p' && (sq >> 3 === 0 || sq >> 3 === 7));
    },

    /** Empurra até `n` casas na direção (dr, dc); para antes de peças, casas bloqueadas e da borda. */
    async pushDir(piece, dr, dc, n, style = 'push') {
      const from = this.sqOf(piece);
      if (from < 0 || piece.type === 'k' || (!dr && !dc)) return false;
      const [r, c] = C().rc(from);
      let to = -1;
      for (let k = 1; k <= n; k++) {
        const sq = C().at(r + dr * k, c + dc * k);
        if (!this.freeFor(piece, sq)) break;
        if (this.canRelocate(piece, sq)) to = sq;
      }
      if (to < 0) { await this.bus.emitAsync('piece:bump', { piece, sq: from }); return false; }
      return this.relocate(piece, to, style);
    },

    /** Empurra para longe de uma casa (o atacante, a peça que se mexeu…). */
    pushAway(piece, fromSq, n, style) {
      const [r, c] = C().rc(this.sqOf(piece)), [r0, c0] = C().rc(fromSq);
      return this.pushDir(piece, sgn(r - r0), sgn(c - c0), n, style);
    },

    /** Empurra em direção ao lado do próprio dono (para trás, do ponto de vista da peça). */
    pushHome(piece, n, style) { return this.pushDir(piece, piece.color === 'w' ? 1 : -1, 0, n, style); },

    /** Troca duas peças da mesma equipa de lugar (nenhuma é o Rei; o próprio Rei não fica em xeque). */
    canSwap(a, b) {
      const sa = this.sqOf(a), sb = this.sqOf(b);
      if (sa < 0 || sb < 0 || a === b || a.color !== b.color || a.type === 'k' || b.type === 'k') return false;
      const edge = (p, sq) => p.type === 'p' && (sq >> 3 === 0 || sq >> 3 === 7);
      if (edge(a, sb) || edge(b, sa)) return false;
      const mut = (bd) => { bd[sa] = b; bd[sb] = a; };
      return !C().exposesKing(this.pos, a.color, mut) && (a.color === this.state.active || !C().exposesKing(this.pos, this.state.active, mut));
    },

    async swapPieces(a, b, style = 'swap') {
      if (!this.canSwap(a, b)) return false;
      const sa = this.sqOf(a), sb = this.sqOf(b);
      this.pos.board[sa] = b; this.pos.board[sb] = a;
      if (this.pos.ep >= 0) this.pos.ep = -1;
      await this.bus.emitAsync('piece:relocate', { piece: a, from: sa, to: sb, style });
      await this.bus.emitAsync('piece:relocate', { piece: b, from: sb, to: sa, style });
      return true;
    },

    /** Põe um Peão novo de `team` numa casa vazia (Câmara de Clonagem). */
    async spawnPawn(team, sq, cause) {
      if (sq < 0 || this.pos.board[sq] || sq >> 3 === 0 || sq >> 3 === 7) return null;
      if (team !== this.state.active && C().exposesKing(this.pos, this.state.active, (b) => { b[sq] = { color: team, type: 'p', equips: [] }; })) return null;
      this.spawnSeq = (this.spawnSeq || 0) + 1;
      const p = C().makePiece(team, 'p', `${team}_p_clone${this.spawnSeq}`);
      p.moved = true; p.home = sq;
      this.pos.board[sq] = p;
      await this.bus.emitAsync('piece:spawn', { piece: p, sq, cause });
      return p;
    },

    // ───────────── cartas ─────────────
    /** Descarta `n` cartas da mão ao acaso (com a semente partilhada). */
    async discardRandom(team, n, cause) {
      const p = this.players[team];
      for (let i = 0; i < n && p.hand.length; i++) {
        const inst = p.hand.splice(this.rng.int(p.hand.length), 1)[0];
        p.gy.push(inst.id);
        this.say(`Descartou "${YC.Cards.get(inst.id).name}".`, team, { card: inst.id });
        await this.bus.emitAsync('card:burn', { team, inst, cause });
      }
    },

    /** Descarta a carta mais fraca da mão (menor raridade; a primeira em caso de empate). */
    async discardWeakest(team) {
      const p = this.players[team];
      if (!p.hand.length) return;
      const order = (inst) => YC.Cards.RARITY[YC.Cards.get(inst.id).rarity].order;
      let best = 0;
      p.hand.forEach((inst, i) => { if (order(inst) < order(p.hand[best])) best = i; });
      const inst = p.hand.splice(best, 1)[0];
      p.gy.push(inst.id);
      this.say(`Descartou "${YC.Cards.get(inst.id).name}".`, team, { card: inst.id });
      await this.bus.emitAsync('card:burn', { team, inst });
    },

    /** Rouba a carta do topo do baralho de `from` para a mão de `to` (com a mão cheia vai para o cemitério de `from`). */
    async stealTop(from, to) {
      const src = this.players[from], dst = this.players[to];
      if (!src.deck.length) return false;
      const inst = src.deck.shift();
      if (dst.hand.length >= R().MAX_HAND) {
        src.gy.push(inst.id);
        await this.bus.emitAsync('card:burn', { team: from, inst });
        return false;
      }
      inst.owner = to;
      dst.hand.push(inst);
      this.say('Roubou a carta do topo do baralho do adversário!', to, { card: inst.id, uid: inst.uid, secret: true });
      await this.bus.emitAsync('card:draw', { team: to, inst, reason: 'steal' });
      return true;
    },

    /** A última carta do cemitério de um dos tipos (`kinds`) volta para a mão. */
    lastInGy(team, kinds) {
      const gy = this.players[team].gy;
      for (let i = gy.length - 1; i >= 0; i--) if (kinds.includes(YC.Cards.get(gy[i]).kind)) return i;
      return -1;
    },

    async recoverFromGy(team, kinds) {
      const p = this.players[team], i = this.lastInGy(team, kinds);
      if (i < 0 || p.hand.length >= R().MAX_HAND) return false;
      const id = p.gy.splice(i, 1)[0], inst = this.newInst(id, team);
      p.hand.push(inst);
      this.say(`"${YC.Cards.get(id).name}" voltou do cemitério para a mão.`, team, { card: id });
      await this.bus.emitAsync('card:draw', { team, inst, reason: 'recover' });
      return true;
    },

    /** +n ações de carta já (no próprio turno, até ao máximo) ou ±n no próximo turno da equipa. */
    async addActions(team, n) {
      const s = this.state;
      if (s.active === team && s.phase === 'PREP' && n > 0) s.actionsLeft = Math.min(R().MAX_ACTIONS, s.actionsLeft + n);
      else s.actionMod[team] += n;
      await this.bus.emitAsync('actions:change', { team, n });
    },

    /** Baralho vazio pela 1.ª vez: o cemitério (sem as Lendárias) é baralhado e volta a ser o baralho. */
    async recycleDeck(team) {
      const p = this.players[team];
      if (p.recycled || p.deck.length) return false;
      p.recycled = true;
      const keep = [], back = [];
      for (const id of p.gy) (YC.Cards.get(id).rarity === 'LEGENDARY' ? keep : back).push(id);
      if (!back.length) return false;
      p.gy = keep;
      p.deck = back.map((id) => this.newInst(id, team));
      this.rng.shuffle(p.deck);
      this.say(`Reciclagem: ${back.length} cartas do cemitério voltaram ao baralho.`, team);
      await this.bus.emitAsync('deck:recycle', { team, n: back.length });
      return true;
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
