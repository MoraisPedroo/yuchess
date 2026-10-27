/* MatchEffects.js — utilitários do Match usados pelos efeitos das cartas (acrescenta métodos ao YC.Match):
   comprar cartas (com queima por mão cheia), morte de peças (equipamentos ao cemitério, armadilha esmagada,
   compra de recuperação), destruir/congelar/mover peças sem nunca deixar o próprio Rei em xeque, e escudos. */
(function (YC) {
  'use strict';

  const C = () => YC.Chess;
  const R = () => YC.Cards.RULES;

  Object.assign(YC.Match.prototype, {
    async draw(team, n, reason) {
      const p = this.players[team];
      for (let i = 0; i < n; i++) {
        if (!p.deck.length) await this.recycleDeck(team);
        if (!p.deck.length) {
          if (!p.deckWarned) { p.deckWarned = true; await this.bus.emitAsync('deck:empty', { team }); }
          return;
        }
        const inst = p.deck.shift();
        if (p.hand.length >= R().MAX_HAND) {
          p.gy.push(inst.id);
          this.say(`Mão cheia: "${YC.Cards.get(inst.id).name}" foi queimada.`, team, { card: inst.id });
          await this.bus.emitAsync('card:burn', { team, inst });
        } else {
          p.hand.push(inst);
          await this.bus.emitAsync('card:draw', { team, inst, reason });
        }
      }
    },

    realType(piece) { return piece.morphUntil ? piece.morphFrom : piece.type; },

    /** Morte de uma peça já retirada do tabuleiro (captura ou efeito). `by` = quem a capturou. */
    async afterDeath(piece, sq, cause, by) {
      const owner = this.players[piece.color], equips = piece.equips.slice();
      owner.stats.lost++;
      owner.lostTypes.push(this.realType(piece));
      for (const id of piece.equips) owner.gy.push(id);
      piece.equips = [];
      const covered = this.trapAt(sq, piece.color);
      if (covered) {
        this.traps.splice(this.traps.indexOf(covered), 1);
        owner.gy.push(covered.id);
        await this.bus.emitAsync('trap:destroy', { sq, trap: covered, cause: 'crushed' });
      }
      if ('nbrq'.includes(this.realType(piece))) await this.draw(piece.color, 1, 'catchup');
      this.pending.push({ type: 'DESTROYED', team: piece.color, piece, sq, cause, by: by || null, equips });
    },

    async destroyPiece(piece, cause) {
      const sq = this.sqOf(piece);
      if (sq < 0 || piece.type === 'k') return false;
      this.pos.board[sq] = null;
      const t = this.realType(piece);
      this.say(`${YC.PIECE_NAME[t]} em ${C().sqName(sq)} foi ${YC.PIECE_FEM[t] ? 'destruída' : 'destruído'}.`, piece.color);
      await this.bus.emitAsync('piece:destroy', { piece, sq, cause });
      await this.afterDeath(piece, sq, cause);
      return true;
    },

    canRemove(piece) {
      const sq = this.sqOf(piece);
      return sq >= 0 && piece.type !== 'k' && !C().exposesKing(this.pos, piece.color, (b) => { b[sq] = null; });
    },

    /** Destrói; se a peça estiver cravada ao próprio Rei, congela-a em vez disso. */
    async removeOrFreeze(piece, cause) {
      if (piece.type === 'k') return this.bus.emitAsync('piece:immune', { piece, sq: this.sqOf(piece) });
      if (this.canRemove(piece)) return this.destroyPiece(piece, cause);
      this.say('A peça protege o seu Rei: fica congelada em vez de destruída.', piece.color);
      return this.freeze(piece, 1, cause);
    },

    async freeze(piece, turns, cause) {
      const sq = this.sqOf(piece);
      if (sq < 0) return false;
      if (piece.type === 'k') { await this.bus.emitAsync('piece:immune', { piece, sq }); return false; }
      piece.frozenUntil = Math.max(piece.frozenUntil, this.untilTurn(piece.color, turns));
      await this.bus.emitAsync('piece:freeze', { piece, sq, turns, cause });
      return true;
    },

    canRelocate(piece, to) {
      const from = this.sqOf(piece);
      if (from < 0 || to < 0 || this.pos.board[to] || C().isBlocked(this.pos, to)) return false;
      const mut = (b) => { b[from] = null; b[to] = piece; };
      // nem o dono da peça fica em xeque, nem (fora da vez dele) o Rei de quem está a jogar
      return !C().exposesKing(this.pos, piece.color, mut) && (piece.color === this.state.active || !C().exposesKing(this.pos, this.state.active, mut));
    },

    async relocate(piece, to, style) {
      const from = this.sqOf(piece);
      if (!this.canRelocate(piece, to)) { await this.bus.emitAsync('piece:bump', { piece, sq: from }); return false; }
      this.pos.board[from] = null;
      this.pos.board[to] = piece;
      if (this.pos.ep >= 0) this.pos.ep = -1;
      await this.bus.emitAsync('piece:relocate', { piece, from, to, style });
      return true;
    },

    async giveShield(piece, source) {
      const sq = this.sqOf(piece);
      if (sq < 0) return false;
      if (this.state.shieldLock[piece.color] === this.state.turnCount) {
        await this.bus.emitAsync('shield:blocked', { piece, sq });
        return false;
      }
      piece.shield = true;
      await this.bus.emitAsync('shield:gain', { piece, sq, source });
      return true;
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
