/* DuelEffects.js — efeitos das 40 cartas: condições de ativação, alvos, efeitos ao invocar,
   resolução de feitiços/armadilhas/counters e efeitos de peças (ignição e rápidos). */
(function (YC) {
  'use strict';

  const S = () => YC.DuelState;
  const def = (inst) => YC.DuelCards.BY_ID[inst.id];

  /** Alvos possíveis para uma especificação de alvo. */
  function candidates(g, team, spec, exceptUid) {
    const me = g.state.players[team], foe = g.state.players[YC.other(team)];
    switch (spec) {
      case 'ALLY': case 'ALLY_OPTIONAL': return me.monsters.filter(Boolean);
      case 'ENEMY_ATK': return foe.monsters.filter((m) => m && m.position === 'ATK');
      case 'ENEMY': case 'ENEMY_OPTIONAL': return foe.monsters.filter(Boolean);
      case 'HAND_DISCARD': return me.hand.filter((c) => c.uid !== exceptUid);
      case 'HAND_RED': return me.hand.filter((c) => c.uid !== exceptUid && def(c).color === 'R');
      case 'GY_MONSTER': return me.monsters.includes(null) ? me.gy.filter((c) => def(c).category === 'MONSTER') : [];
      case 'GY_PAWN2': return me.monsters.includes(null) ? me.gy.filter((c) => def(c).chess === 'PAWN' && def(c).level === 2) : [];
      default: return [];
    }
  }

  const required = (spec) => ['ALLY', 'ENEMY_ATK', 'HAND_DISCARD', 'GY_MONSTER'].includes(spec);

  /** Pode ativar esta carta agora, fora de uma Chain? */
  function canActivate(g, team, inst) {
    const c = def(inst), s = g.state, me = s.players[team], foe = s.players[YC.other(team)];
    if (s.active !== team || g.chain.status !== 'Idle') return false;
    const inHand = me.hand.includes(inst), inBack = me.backrow.includes(inst);
    if (c.category === 'SPELL') {
      if (s.phase !== 'MAIN' || !inHand) return false;
    } else if (c.category === 'QUICK_SPELL') {
      if (!['MAIN', 'BATTLE'].includes(s.phase)) return false;
      if (!(inHand || (inBack && inst.setTurn < s.turnCount))) return false;
    } else return false;
    if (c.target && required(c.target) && !candidates(g, team, c.target, inst.uid).length) return false;
    switch (c.id) {
      case 'compra_gananciosa': return s.pile.color === 'Y' || me.lp < foe.lp;
      case 'xeque_mate_diabo': return me.lp < 1500;
      case 'inversao_polaridade': return S().monstersOf(g, 'WHITE').length + S().monstersOf(g, 'BLACK').length > 0;
      default: return true;
    }
  }

  function costPayable(g, team, inst) {
    const c = def(inst), lp = g.state.players[team].lp;
    if (!c.cost || S().sintonia(g, c)) return true;
    if (c.cost.lp) return lp > c.cost.lp;
    if (c.cost.halfLp) return lp >= 2;
    return true;
  }

  /** Condição de resposta de uma carta virada/mão face ao elo do topo. */
  function responds(g, team, inst, top) {
    const c = def(inst);
    const mine = (uid) => { const l = uid && S().locate(g, uid); return !!l && l.team === team; };
    const atkInst = top.kind === 'ATTACK' ? S().locate(g, top.attackerUid) : null;
    switch (c.trigger) {
      case 'ANY': return true;
      case 'ENEMY_ATTACK': return top.kind === 'ATTACK' && !!atkInst && !S().trapImmune(g, atkInst.inst);
      case 'ALLY_ATTACKED': return top.kind === 'ATTACK' && !!top.targetUid && mine(top.targetUid);
      case 'ENEMY_DIRECT_ATTACK': return top.kind === 'ATTACK' && !top.targetUid;
      case 'ALLY_IN_BATTLE': return top.kind === 'ATTACK' && (mine(top.attackerUid) || mine(top.targetUid));
      case 'ENEMY_SUMMON_1500': return top.kind === 'SUMMON' && def(top.inst).atk >= 1500 && !S().trapImmune(g, top.inst);
      case 'ENEMY_SUMMON_NO_TRIBUTE': return top.kind === 'SUMMON' && top.summonType === 'NORMAL' && !S().trapImmune(g, top.inst);
      case 'ALLY_DESTROYED': return top.kind === 'EVENT' && top.victimTeam === team && !!S().locate(g, top.attackerUid) && S().locate(g, top.attackerUid).zone === 'monsters';
      case 'ENEMY_SPELL': return top.kind === 'ACTIVATE' && ['SPELL', 'QUICK_SPELL'].includes(def(top.inst).category);
      case 'ENEMY_ANY_PLAY': return ['SUMMON', 'ACTIVATE', 'EFFECT'].includes(top.kind);
      case 'ENEMY_ATTACK_OR_CARD': return ['ATTACK', 'ACTIVATE', 'EFFECT'].includes(top.kind);
      default: return false;
    }
  }

  function nearest(stack, index, kind) {
    for (let i = index; i >= 0; i--) if (stack[i].kind === kind) return stack[i];
    return null;
  }

  const Fx = {
    candidates, canActivate, costPayable, responds,

    /** Efeitos "ao invocar" (normal, tributo e especial). */
    async onSummon(g, inst, opts = {}) {
      const s = g.state, team = inst.owner, foeTeam = YC.other(team), foe = s.players[foeTeam];
      switch (inst.id) {
        case 'peao_botanico': await g.heal(team, 300, def(inst).name); break;
        case 'bispo_clarinete': g.setPile('G', s.pile.symbol); g.log('🎷 O Bispo Clarinete pinta a Pilha Uno de Verde.'); break;
        case 'bispo_holofote': {
          const card = foe.backrow.find((b) => b && !b.revealed);
          if (card) { card.revealed = true; g.log(`🔦 Holofote revela: ${def(card).name}.`); await g.bus.emitAsync('DUEL_REVEAL', { inst: card }); }
          break;
        }
        case 'torre_bigben': {
          const list = candidates(g, team, 'ENEMY');
          let t = list.find((m) => m.uid === opts.targetUid);
          if (!t && list.length) t = list.slice().sort((a, b) => S().atk(g, b) - S().atk(g, a))[0];
          if (t) { t.stunUntil = s.turnCount + 2; g.log(`🔔 DONG! ${def(t).name} fica paralisada 1 turno.`); await g.bus.emitAsync('DUEL_STATUS', { inst: t, text: 'PARALISADA!' }); }
          break;
        }
        case 'dama_sereia': foe.trapLockTurn = s.turnCount; g.log('🧜 O canto da Sereia congela as Armadilhas inimigas neste turno.'); break;
        case 'dama_soberana': {
          const victims = foe.monsters.filter((m) => m && m.position === 'DEF');
          for (const m of victims) await g.destroyMonster(m, { by: 'EFFECT' });
          if (victims.length) g.log(`👑 A Soberana Rubra destrói ${victims.length} peça(s) em Defesa.`);
          break;
        }
      }
    },

    /** Resolve um feitiço / armadilha / counter já ativado (elo da Chain). */
    async resolveCard(g, link, stack, index) {
      const inst = link.inst, c = def(inst), me = link.owner, foeTeam = YC.other(me);
      const s = g.state, T = link.targets || {};
      const below = stack[index - 1];
      const allyByUid = (uid) => s.players[me].monsters.find((m) => m && m.uid === uid);
      switch (c.id) {
        case 'tinta_rubra': { const m = allyByUid(T.monsterUid); if (m) await g.addMod(m, 'atk', 500); break; }
        case 'apito_guarda': {
          const m = s.players[foeTeam].monsters.find((x) => x && x.uid === T.monsterUid);
          if (m && m.position === 'ATK') await g.setPosition(m, 'DEF', 'APITO!');
          break;
        }
        case 'tonel_espinafre': {
          await g.heal(me, 600, c.name);
          const m = allyByUid(T.monsterUid);
          if (m) { m.mods = (m.mods || []).filter((x) => x.amount >= 0); m.stunUntil = 0; await g.bus.emitAsync('DUEL_STATUS', { inst: m, text: 'LIMPO!' }); }
          break;
        }
        case 'troca_chapeu': case 'compra_gananciosa': g.drawCards(me, 2); break;
        case 'ressurreicao_celuloide': {
          const t = s.players[me].gy.find((x) => x.uid === T.gyUid && def(x).category === 'MONSTER');
          if (t) await g.specialSummon(t, me);
          break;
        }
        case 'xeque_mate_diabo': { const m = allyByUid(T.monsterUid); if (m) await g.addMod(m, 'atk', S().atk(g, m)); break; }
        case 'casca_banana': if (below) { below.negated = true; g.log('🍌 Escorregou! O ataque foi cancelado.'); } break;
        case 'cortina_fumo': {
          const atk = nearest(stack, index - 1, 'ATTACK');
          const m = atk && allyByUid(atk.targetUid);
          if (m) await g.addMod(m, 'def', 600);
          break;
        }
        case 'bigorna_ceu': if (below && below.kind === 'SUMMON') { await g.addMod(below.inst, 'atk', -800, true); g.log(`🔨 Bigorna! ${def(below.inst).name} perde 800 ATK.`); } break;
        case 'alcapao_teatro': if (below && below.kind === 'SUMMON') { below.negated = true; below.bounced = true; g.log('🚪 Alçapão! A peça volta para a mão.'); } break;
        case 'espelho_tinta': {
          const atk = nearest(stack, index - 1, 'ATTACK');
          const a = atk && S().locate(g, atk.attackerUid);
          if (a) await g.damage(atk.owner, Math.floor(S().atk(g, a.inst) / 2), c.name);
          break;
        }
        case 'dinamite_acme': {
          const ev = nearest(stack, index - 1, 'EVENT');
          const a = ev && S().locate(g, ev.attackerUid);
          if (a && a.zone === 'monsters') {
            if (a.inst.id === 'dragao_tres_cabecas') g.log('🐉 O Dragão resiste à Dinamite!');
            else await g.destroyMonster(a.inst, { by: 'TRAP', word: 'KABOOM!' });
          }
          await g.damage(foeTeam, 600, c.name);
          break;
        }
        case 'censura_diretor': case 'julgamento_solene':
          if (below) { below.negated = true; g.log(`⚖ ${c.name} anula ${below.label}.`); await g.bus.emitAsync('DUEL_PARRY', { card: c, team: me }); }
          break;
        case 'parry_absoluto':
          if (below) { below.negated = true; g.log(`⚡ PARRY! ${below.label} foi anulado.`); }
          await g.bus.emitAsync('DUEL_PARRY', { card: c, team: me });
          await g.damage(foeTeam, 1000, c.name);
          break;
        case 'luva_boxe': {
          let m = allyByUid(T.monsterUid);
          if (!m) { const atk = nearest(stack, index - 1, 'ATTACK'); m = atk && (allyByUid(atk.attackerUid) || allyByUid(atk.targetUid)); }
          if (m) await g.addMod(m, 'atk', 700);
          break;
        }
        case 'inversao_polaridade': s.polarityTurn = s.turnCount; g.log('🧲 Polaridade invertida: ATK e DEF trocados até ao fim do turno.'); await g.bus.emitAsync('DUEL_FIELD', { kind: 'POLARITY' }); break;
        case 'roleta_rei_dado': {
          g.setPile(link.color || S().favouriteColor(g, me), c.symbol);
          const target = s.players[foeTeam].backrow.find((b) => b && b.uid === T.backrowUid) || s.players[foeTeam].backrow.find(Boolean);
          if (target) await g.destroyBackrow(target);
          break;
        }
        case 'penalidade_maxima': {
          g.setPile(link.color || S().favouriteColor(g, me), c.symbol);
          g.drawCards(me, 2);
          const best = S().monstersOf(g, foeTeam).sort((a, b) => S().atk(g, b) - S().atk(g, a))[0];
          if (best) await g.destroyMonster(best, { by: 'SPELL', word: 'PENALTI!' });
          break;
        }
        default: console.warn('[duel] carta sem efeito', c.id);
      }
    },

    /** Efeitos de peças: ignição (Locomotiva, Arcanjo) e rápido (Rei Dado). */
    async resolveMonsterEffect(g, link) {
      const inst = link.inst, me = link.owner, foeTeam = YC.other(me), s = g.state, T = link.targets || {};
      if (!S().locate(g, inst.uid) || S().locate(g, inst.uid).zone !== 'monsters') return;
      if (inst.id === 'torre_locomotiva') {
        const target = s.players[foeTeam].backrow.find((b) => b && b.uid === T.backrowUid) || s.players[foeTeam].backrow.find(Boolean);
        if (target) await g.destroyBackrow(target);
      } else if (inst.id === 'bispo_arcanjo') {
        if (T.choice === 'REVIVE') {
          const pawn = candidates(g, me, 'GY_PAWN2').find((x) => x.uid === T.gyUid) || candidates(g, me, 'GY_PAWN2')[0];
          if (pawn) await g.specialSummon(pawn, me);
        } else await g.heal(me, 500, 'Arcanjo');
      } else if (inst.id === 'rei_dado_supremo') {
        const roll = 1 + g.rng.int(6);
        g.log(`🎲 O Rei Dado rola… ${roll}! +${roll * 100} ATK.`);
        await g.bus.emitAsync('DUEL_DICE', { inst, roll });
        await g.addMod(inst, 'atk', roll * 100);
      }
    },

    /** Efeitos de peças que o dono pode usar agora (fora de Chain). */
    monsterEffectReady(g, team, inst) {
      const s = g.state, c = def(inst);
      if (!c.effect || inst.owner !== team || inst.effectTurn === s.turnCount || S().isStunned(g, inst)) return false;
      if (s.active !== team || g.chain.status !== 'Idle') return false;
      if (c.effect === 'QUICK') return ['MAIN', 'BATTLE'].includes(s.phase);
      if (s.phase !== 'MAIN') return false;
      if (inst.id === 'torre_locomotiva') return candidates(g, team, 'HAND_RED').length > 0 && S().backrowOf(g, YC.other(team)).length > 0;
      return true;
    }
  };

  YC.DuelEffects = Fx;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
