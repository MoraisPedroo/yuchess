/* CombatRPG.js — matemática de embate: escudo absorve primeiro, sobrevivência com contra-ataque
   de retaliação (50% ATK) e cálculo da casa de Recuo Elástico (Bounce-Back). */
(function (YC) {
  'use strict';

  const SHIELD_CAP = 90;

  function activeBuffSum(piece, stat, turn) {
    let sum = 0;
    for (const b of piece.buffs) if (b.stat === stat && (turn == null || turn < b.expiresAtTurn)) sum += b.amount;
    return sum;
  }

  const CombatRPG = {
    SHIELD_CAP,

    effectiveAtk(piece, turn) {
      let atk = Math.max(0, piece.atk + piece.tempAtk + activeBuffSum(piece, 'atk', turn));
      if (piece.overdrive) atk *= 1.25;
      return Math.floor(atk);
    },

    /** Falange: Peão com Peão aliado na diagonal adjacente recebe +10 ESC (não se gasta). */
    phalanxBonus(piece, board) {
      if (piece.type !== 'PAWN' || !board) return 0;
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        const p = board.pieceAt(piece.row + dr, piece.col + dc);
        if (p && p !== piece && p.alive && p.team === piece.team && p.type === 'PAWN') return 10;
      }
      return 0;
    },

    shieldPool(piece, board) {
      return piece.shield + piece.tempShield + this.phalanxBonus(piece, board);
    },

    addShield(piece, amount) {
      piece.shield = Math.min(SHIELD_CAP, Math.max(0, piece.shield + amount));
    },

    heal(piece, amount) {
      const before = piece.hp;
      piece.hp = Math.min(piece.maxHp, piece.hp + amount);
      return piece.hp - before;
    },

    /**
     * Aplica dano a uma peça: d = max(0, ATK − ESC); ESC' = max(0, ESC − ATK); HP' = HP − d.
     * Com perfuração, o escudo só bloqueia metade da sua capacidade.
     */
    applyDamage(piece, amount, opts = {}) {
      amount = Math.max(0, Math.floor(amount));
      let blocked = 0;
      if (!opts.ignoreShield) {
        const phalanx = this.phalanxBonus(piece, opts.board);
        const pool = phalanx + piece.tempShield + piece.shield;
        const capacity = opts.pierce ? Math.floor(pool / 2) : pool;
        blocked = Math.min(capacity, amount);
        let toConsume = Math.max(0, blocked - phalanx);
        const fromTemp = Math.min(piece.tempShield, toConsume);
        piece.tempShield -= fromTemp; toConsume -= fromTemp;
        piece.shield = Math.max(0, piece.shield - toConsume);
      }
      const damage = amount - blocked;
      piece.hp = Math.max(0, piece.hp - damage);
      return { amount, blocked, damage, destroyed: piece.hp <= 0 };
    },

    retaliationAmount(attacker, defender, move, turn) {
      let ratio = 0.5;
      if (attacker.type === 'BISHOP' && Math.max(Math.abs(move.to[0] - move.from[0]), Math.abs(move.to[1] - move.from[1])) >= 3) ratio = 0.25;
      return Math.floor(this.effectiveAtk(defender, turn) * ratio);
    },

    /** Casa de recuo: penúltima casa do rayPath (deslizantes) ou origem (Cavalo / ataque adjacente). */
    bounceCoord(attacker, move) {
      if (attacker.type === 'KNIGHT' || move.rayPath.length < 2) return move.from.slice();
      return move.rayPath[move.rayPath.length - 2].slice();
    },

    /** Resolve o embate e altera os stats. O tabuleiro é atualizado pelo GameController. */
    resolve(attacker, defender, move, board, turn) {
      const atk = this.effectiveAtk(attacker, turn);
      const hit = this.applyDamage(defender, atk, { pierce: attacker.pierce || attacker.overdrive, board });
      const result = {
        attackerUid: attacker.uid, defenderUid: defender.uid, atk,
        blocked: hit.blocked, damage: hit.damage, defenderDestroyed: hit.destroyed,
        retaliation: null, attackerDestroyed: false, bounceTo: null
      };
      if (!hit.destroyed) {
        const amount = this.retaliationAmount(attacker, defender, move, turn);
        const back = this.applyDamage(attacker, amount, { board });
        result.retaliation = back;
        result.attackerDestroyed = back.destroyed;
        if (!back.destroyed) result.bounceTo = this.bounceCoord(attacker, move);
      }
      return result;
    },

    /** Previsão sem efeitos colaterais (para a UI e para a IA). `boost` simula a carta Uno jogada. */
    preview(attacker, defender, move, board, turn, boost) {
      const a = { ...attacker, buffs: attacker.buffs };
      const d = { ...defender, buffs: defender.buffs };
      if (boost) {
        a.tempAtk += boost.atk || 0;
        a.tempShield += boost.tempShield || 0;
        a.shield = Math.min(SHIELD_CAP, a.shield + (boost.shield || 0));
        a.hp = Math.min(a.maxHp, a.hp + (boost.heal || 0));
        a.overdrive = a.overdrive || !!boost.overdrive;
        a.pierce = a.pierce || !!boost.pierce;
      }
      const r = this.resolve(a, d, move, board, turn);
      let outcome = 'BOUNCE';
      if (r.defenderDestroyed) outcome = 'KILL';
      else if (r.attackerDestroyed) outcome = 'LETHAL_COUNTER';
      return { ...r, outcome, defenderHpAfter: d.hp, attackerHpAfter: a.hp };
    }
  };

  YC.CombatRPG = CombatRPG;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
