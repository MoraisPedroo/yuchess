/* EffectInterpreter.js — interpreta as primitivas declarativas das cartas (DEAL_DAMAGE, BUFF_STAT,
   NEGATE_CHAIN_LINK, KNOCKBACK, ...). Os alvos são resolvidos a partir do contexto da Chain. */
(function (YC) {
  'use strict';

  class EffectInterpreter {
    constructor(game) { this.game = game; }

    /** Encontra, descendo a pilha a partir de `index`, o elo mais próximo de um certo tipo. */
    nearest(stack, index, kind, pred) {
      for (let i = index; i >= 0; i--) if (stack[i].kind === kind && (!pred || pred(stack[i]))) return stack[i];
      return null;
    }

    resolveTargets(spec, link, stack, index) {
      const g = this.game, board = g.board, owner = link.owner;
      const byUid = (uid) => { const p = uid && board.getPiece(uid); return p && p.alive ? [p] : []; };
      const moveLink = this.nearest(stack, index, 'MOVE');
      switch (spec) {
        case 'CHOSEN': return byUid(link.targets && link.targets.chosenUid);
        case 'DEFENDER': return moveLink ? byUid(moveLink.move.defenderUid) : [];
        case 'ATTACKER': return moveLink ? byUid(moveLink.move.pieceUid) : [];
        case 'MY_MOVING_PIECE': {
          const l = this.nearest(stack, index, 'MOVE', (m) => m.owner === owner);
          return l ? byUid(l.move.pieceUid) : [];
        }
        case 'OPPONENT_ACTIVE_PIECE': {
          const l = this.nearest(stack, index, 'MOVE', (m) => m.owner !== owner);
          const found = l ? byUid(l.move.pieceUid) : [];
          if (found.length) return found;
          const k = board.king(YC.other(owner));
          return k ? [k] : [];
        }
        case 'TRIGGERING_PIECE': {
          const l = link.kind === 'TRAP' ? link : this.nearest(stack, index, 'TRAP');
          return l ? byUid(l.trap.triggeringUid) : [];
        }
        case 'MY_KING': { const k = board.king(owner); return k ? [k] : []; }
        case 'ENEMY_KING': { const k = board.king(YC.other(owner)); return k ? [k] : []; }
        default: return [];
      }
    }

    async execute(link, stack, index) {
      const effects = (link.card && link.card.effects) || [];
      for (const eff of effects) {
        if (this.game.state.winner) return;
        await this.apply(eff, link, stack, index);
      }
    }

    async apply(eff, link, stack, index) {
      const g = this.game, board = g.board, owner = link.owner, enemy = YC.other(owner);
      const perm = g.state.permission;
      const targets = () => this.resolveTargets(eff.target, link, stack, index);
      const teamOf = (rel) => (rel === 'ALLY' ? owner : enemy);

      switch (eff.op) {
        case 'BUFF_ACTIVE_PIECE':
          if (!perm) return;
          if (eff.stat === 'atk') perm.boost.atk += eff.amount;
          else if (eff.stat === 'shield') perm.boost.shield += eff.amount;
          else if (eff.stat === 'heal') perm.boost.heal += eff.amount;
          g.log(`${g.teamName(owner)}: a próxima peça a mover ganha ${eff.stat === 'heal' ? '+' + eff.amount + ' HP' : '+' + eff.amount + ' ' + eff.stat.toUpperCase().replace('SHIELD', 'ESC')}.`);
          return;
        case 'PIERCE_SHIELD':
          if (perm) perm.boost.pierce = true;
          return;
        case 'FIELD_DAMAGE': {
          const list = board.pieces(teamOf(eff.team)).filter((p) => !eff.pieceTypes || eff.pieceTypes.includes(p.type));
          await g.bus.emitAsync('FIELD_EFFECT', { kind: 'DAMAGE', team: teamOf(eff.team), card: link.card });
          for (const p of list) await g.damagePiece(p, eff.amount, { ignoreShield: eff.ignoreShield, source: link.card.name, quiet: true });
          g.log(`${link.card.name}: ${list.length} peça(s) atingida(s).`);
          return;
        }
        case 'FIELD_HEAL': {
          const list = board.pieces(teamOf(eff.team));
          await g.bus.emitAsync('FIELD_EFFECT', { kind: 'HEAL', team: teamOf(eff.team), card: link.card });
          for (const p of list) g.healPiece(p, eff.amount, true);
          g.log(`${link.card.name}: as peças ${g.teamName(teamOf(eff.team)).toLowerCase()} recuperam ${eff.amount} HP.`);
          return;
        }
        case 'DRAW_CARDS': {
          const who = eff.who === 'OPPONENT' ? enemy : owner;
          const got = g.uno.draw(who, eff.amount);
          g.log(`${g.teamName(who)} compra ${got.length} carta(s).`);
          return;
        }
        case 'DISCARD_RANDOM': {
          const who = eff.who === 'SELF' ? owner : enemy;
          const lost = g.uno.discardRandom(who, eff.amount);
          if (lost.length) g.log(`${g.teamName(who)} perde ${lost.map((c) => c.name).join(', ')}.`);
          await g.bus.emitAsync('CARDS_LOST', { team: who, cards: lost });
          return;
        }
        case 'REVIVE': {
          const p = board.revive(owner, eff.pieceType);
          if (p) { g.log(`${g.teamName(owner)} ressuscita um ${p.name} em ${board.squareName(p.row, p.col)}!`); await g.bus.emitAsync('PIECE_REVIVED', { piece: p }); }
          else g.log('Ressurreição falhou: não há Peões no cemitério ou espaço livre.');
          return;
        }
        case 'DESTROY_ENEMY_TRAP': {
          const cells = board.trapsOf(enemy);
          if (!cells.length) { g.log('O detetive não encontrou armadilhas.'); return; }
          const cell = cells[g.rng.int(cells.length)];
          const trap = board.removeTrap(cell.row, cell.col);
          g.uno.toGraveyard(trap.card);
          g.log(`Armadilha "${trap.card.name}" descoberta e destruída em ${board.squareName(cell.row, cell.col)}!`);
          await g.bus.emitAsync('TRAP_DESTROYED', { row: cell.row, col: cell.col, card: trap.card });
          return;
        }
        case 'DEAL_DAMAGE':
          for (const p of targets()) await g.damagePiece(p, eff.amount, { ignoreShield: eff.ignoreShield, source: link.card ? link.card.name : '' });
          return;
        case 'HEAL':
          for (const p of targets()) g.healPiece(p, eff.amount);
          return;
        case 'BUFF_STAT':
          for (const p of targets()) await g.buffPiece(p, eff);
          return;
        case 'APPLY_STATUS':
          for (const p of targets()) await g.applyStatus(p, eff.status, eff.durationTurns || 1);
          return;
        case 'INTERRUPT_MOVEMENT':
          if (link.trap && link.trap.moveCtx) link.trap.moveCtx.interrupted = true;
          return;
        case 'KNOCKBACK': {
          const ctx = link.trap && link.trap.moveCtx;
          for (const p of targets()) {
            if (p.type === 'ROOK') { g.log('Muralha de Ferro: a Torre ignora a mola!'); await g.bus.emitAsync('FLOAT_TEXT', { piece: p, text: 'IMUNE!' }); continue; }
            const dest = ctx ? ctx.move.from : null;
            if (dest && !board.pieceAt(dest[0], dest[1])) {
              const from = [p.row, p.col];
              board.moveTo(p, dest[0], dest[1]);
              await g.bus.emitAsync('PIECE_BOUNCED', { piece: p, impact: from, to: dest, kind: 'SPRING' });
            }
          }
          return;
        }
        case 'SPLASH_DAMAGE': {
          const [r, c] = link.trap.coord;
          const hit = board.neighbors(r, c).map(([a, b]) => board.pieceAt(a, b)).filter((p) => p && p.uid !== link.trap.triggeringUid);
          await g.bus.emitAsync('EXPLOSION', { row: r, col: c, word: 'KABOOM!' });
          for (const p of hit) await g.damagePiece(p, eff.amount, { source: 'Dinamite', quiet: true });
          return;
        }
        case 'NEGATE_CHAIN_LINK': {
          const victim = stack[index + (eff.targetLinkOffset || -1)];
          if (!victim) return;
          victim.negated = true;
          g.state.stats[owner].parries++;
          g.log(`⚡ ${link.card.name} anula CL${victim.index} (${victim.label})!`);
          await g.bus.emitAsync('CHAIN_LINK_NEGATED', { link: victim, by: link });
          return;
        }
        case 'VFX_PARRY_FLASH':
          await g.bus.emitAsync('PARRY', { team: owner, intensity: eff.intensity || 1, card: link.card });
          return;
        default:
          console.warn('[EffectInterpreter] op desconhecida', eff.op);
      }
    }
  }

  YC.EffectInterpreter = EffectInterpreter;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
