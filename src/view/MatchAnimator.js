/* MatchAnimator.js — ouve os eventos do motor e anima-os (o motor espera por cada animação com emitAsync).
   Saltos com squash & stretch, POW! nas capturas, escudo a estilhaçar, gelo, armadilhas com TRAP!,
   cartas a voar da mão, elos da Chain e o carimbo NEGADO!. No fim de cada evento acerta o tabuleiro (sync). */
(function (YC) {
  'use strict';

  const FX = () => YC.FX;
  const S = (n) => YC.Sound && YC.Sound.play(n);
  const SAFE_MS = 4000;

  class MatchAnimator {
    constructor({ bus, board, ui }) {
      this.bus = bus; this.board = board; this.ui = ui;
      this.offs = [];
      // no palco 3D as animações das peças são as de Anim3D.js (o resto é igual)
      if (board.is3D && YC.Anim3D) Object.assign(this, YC.Anim3D);
      const on = (ev, fn, ms) => this.offs.push(bus.on(ev, (p) => this.guard(fn.call(this, p || {}), ms)));
      on('match:start', () => this.sync());
      on('turn:start', this.turnStart);
      on('card:draw', this.cardDraw);
      on('card:burn', this.cardBurn);
      on('card:set', this.cardSet);
      on('trap:set', this.trapSet);
      on('trap:clang', ({ sq }) => this.at(sq, 'CLANG!', '#8E9BAE', 'shield_clang', { sparks: true }));
      on('chain:link', this.chainLink);
      on('chain:resolve', this.chainResolve);
      on('chain:negate', this.chainNegate);
      on('chain:fizzle', ({ link }) => { this.ui.chainState(link, 'fizzle'); return FX().wait(200); });
      on('chain:end', () => { this.ui.chainClear(); return FX().wait(120); });
      // Ultimate (Ultimates.js): a invocação e o golpe têm vídeo, por isso o limite de segurança é maior
      on('equip:attach', (p) => (YC.Ultimate ? YC.Ultimate.onEquip(this, p) : this.equipAttach(p)), 16000);
      on('equip:strip', ({ sq }) => this.at(sq, 'SPLOSH!', '#F538A0', 'explosion_bam', { colors: ['#F538A0', '#FFB4C8', '#fff'] }));
      on('equip:steal', (p) => (YC.Ultimate ? YC.Ultimate.onSteal(this, p) : this.equipSteal(p.from, p.to)), 16000);
      on('equip:proc', ({ sq, id }) => this.pop(sq, id === 'eq_espada_ganancia' ? '+1 CARTA!' : 'CACTO!', id === 'eq_espada_ganancia' ? '#FCC934' : '#81C995', id === 'eq_espada_ganancia' ? 'sword_draw' : 'explosion_bam'));
      on('capture:declare', (p) => (YC.Ultimate ? YC.Ultimate.onCapture(this, p) : this.captureDeclare(p)), 12000);
      on('piece:move', this.pieceMove);
      on('piece:promote', ({ piece, sq }) => this.promote(piece, sq));
      on('capture:snapback', this.snapback);
      on('capture:miss', ({ to }) => this.at(to, 'FALHOU!', '#575B5F', 'spring_jump'));
      on('shield:shatter', this.shieldShatter);
      on('shield:gain', ({ sq }) => { this.sync(); S('shield_clang'); return Promise.all([FX().ring(this.board.fx, ...this.xy(sq), '#12B5CB', 0.2), FX().wait(420)]); });
      on('shield:divine', ({ sq }) => this.at(sq, 'ÉGIDE!', '#12B5CB', 'shield_clang', { ring: '#12B5CB', colors: ['#12B5CB', '#fff', '#FCC934'] }));
      on('shield:blocked', ({ sq }) => this.pop(sq, 'BLOQUEADO!', '#FA903E', 'error'));
      on('mirror:bounce', ({ from, to }) => Promise.all([this.at(to, 'BOING!', '#F538A0', 'spring_jump', { ring: '#F538A0' }), FX().ring(this.board.fx, ...this.xy(from), '#12B5CB', 0.22)]));
      on('dummy:swap', ({ sq, pawnSq }) => Promise.all([this.pop(sq, 'BONECO!', '#FA903E', 'spring_jump'), FX().ring(this.board.fx, ...this.xy(pawnSq), '#FA903E', 0.2)]));
      on('piece:destroy', this.destroyAnim);
      on('piece:freeze', ({ sq }) => this.freeze(sq));
      on('piece:immune', ({ sq }) => this.pop(sq, 'IMUNE!', '#FCC934', 'shield_clang'));
      on('piece:relocate', this.relocate);
      on('piece:bump', ({ piece }) => this.bump(piece));
      on('piece:morph', ({ piece, sq }) => this.morph(piece, sq, true));
      on('piece:unmorph', ({ piece, sq }) => this.morph(piece, sq, false));
      on('trap:trigger', this.trapTrigger);
      on('trap:destroy', ({ sq }) => this.at(sq, 'PUF!', '#575B5F', 'card_flip', { small: true }));
      on('trap:reveal', ({ trap }) => { this.sync(); return this.pop(trap.sq, 'REVELADA!', '#FA903E', 'magic_zap'); });
      on('emp:blast', this.emp);
      on('aura:pulse', ({ sq }) => { S('ice_freeze'); return FX().ring(this.board.fx, ...this.xy(sq), '#1A73E8', 0.45); });
      on('check', ({ kingSq }) => { this.sync(); if (this.board.punch) this.board.punch(); return this.at(kingSq, 'XEQUE!', '#D93025', 'check', { textColor: '#fff' }); });
      on('deck:empty', ({ team }) => { if (team === this.ui.viewer) this.ui.toast('O teu baralho acabou: já não compras cartas.'); return FX().wait(200); });
    }

    dispose() { this.offs.forEach((off) => off()); this.offs = []; }
    // o limite acompanha a velocidade: a 0,5 as animações demoram o dobro e cortá-las a meio fazia as peças saltarem
    guard(p, ms = SAFE_MS) { return Promise.race([Promise.resolve(p).catch((e) => console.error('[anim]', e)), new Promise((r) => setTimeout(r, ms / Math.min(1, FX().speed || 1)))]).then(() => this.sync()); }
    sync() { this.board.sync(this.ui.match, { viewer: this.ui.viewer }); this.ui.renderSoft(); }
    xy(sq) { const c = this.board.center(sq); return [c.x, c.y]; }
    pel(piece) { return piece ? this.board.el(piece.id) : null; }

    at(sq, text, fill, sound, { ring, colors, sparks, small, textColor } = {}) {
      if (sq == null || sq < 0) return FX().wait(100);
      const [x, y] = this.xy(sq);
      if (sound) S(sound);
      FX().particles(this.board.fx, x, y, { n: small ? 6 : 14, colors: colors || [fill, '#fff', '#FCC934'], shape: sparks ? 'star' : 'dot' });
      if (ring) FX().ring(this.board.fx, x, y, ring, 0.3);
      return FX().burst(this.board.fx, x, y, text, { fill, size: small ? 0.7 : 1, textColor: textColor || '#fff' });
    }

    pop(sq, text, color, sound) {
      if (sq == null || sq < 0) return FX().wait(100);
      if (sound) S(sound);
      return FX().popText(this.board.fx, ...this.xy(sq), text, color);
    }

    async turnStart({ team }) {
      this.sync();
      const mine = team === this.ui.viewer;
      if (this.ui.isSpectator()) return FX().wait(60);
      S('turn');
      return FX().banner(mine ? 'A TUA VEZ!' : `VEZ ${team === 'w' ? 'DAS BRANCAS' : 'DAS PRETAS'}`, { sub: mine ? 'Até 2 cartas + 1 lance' : this.ui.nameOf(team), color: mine ? '#FCC934' : '#C58AF9', hold: mine ? 0.45 : 0.15, parent: this.ui.stage });
    }

    async cardDraw({ team, inst }) {
      S('card_draw');
      const mine = team === this.ui.viewer;
      const from = this.ui.deckRect(team), to = this.ui.handSlotRect(team);
      if (!from || !to) return;
      if (mine) this.ui.hideHand.add(inst.uid);
      this.ui.renderSoft();
      const card = mine ? YC.HoloCard.create(inst.id, { size: 'sm', static: true, faceDown: true }) : YC.HoloCard.back('sm');
      await FX().flyCard(card, from, to, { duration: 0.55, spin: mine ? 0 : 8, arc: 0.15 });
      if (mine) { card.classList.remove('face-down'); S('card_flip'); await FX().wait(260); }
      card.remove();
      this.ui.hideHand.delete(inst.uid);
      this.ui.renderSoft();
    }

    async cardBurn({ team, inst }) {
      const r = this.ui.deckRect(team);
      if (r) {
        const card = team === this.ui.viewer ? YC.HoloCard.create(inst.id, { size: 'sm', static: true }) : YC.HoloCard.back('sm');
        await FX().flyCard(card, r, { left: r.left, top: r.top - 80, width: r.width, height: r.height }, { duration: 0.4 });
        card.style.filter = 'sepia(1) saturate(4) hue-rotate(-30deg)';
        await FX().to(card, { opacity: 0, scale: 0.4, duration: 0.4 });
        card.remove();
      }
      this.ui.toast(team === this.ui.viewer ? 'Mão cheia: a carta comprada foi queimada!' : 'O adversário queimou uma carta (mão cheia).');
    }

    async cardSet({ team, inst }) {
      S('card_flip');
      const from = this.ui.handCardRect(team, inst.uid), to = this.ui.zoneSlotRect(team);
      if (team === this.ui.viewer) this.ui.hideHand.add(inst.uid);
      this.ui.renderSoft();
      if (!from || !to) return;
      const card = YC.HoloCard.create(inst.id, { size: 'sm', static: true });
      card.classList.toggle('face-down', true);
      await FX().flyCard(card, from, to, { duration: 0.5, spin: -6 });
      card.remove();
      this.ui.hideHand.delete(inst.uid);
    }

    async trapSet({ trap, team, inst }) {
      S('card_flip');
      const mine = team === this.ui.viewer;
      const from = this.ui.handCardRect(team, inst.uid);
      if (mine) this.ui.hideHand.add(inst.uid);
      this.ui.renderSoft();
      if (!from) return;
      const target = mine ? this.board.rect(trap.sq) : this.board.wrap.getBoundingClientRect();
      const to = mine ? target : { left: target.left + target.width / 2 - 30, top: target.top + target.height / 2 - 40, width: 60, height: 84 };
      const card = mine ? YC.HoloCard.create(inst.id, { size: 'sm', static: true }) : YC.HoloCard.back('sm');
      await FX().flyCard(card, from, to, { duration: 0.55, endScale: mine ? 0.45 : 0.6 });
      await FX().to(card, { opacity: 0, scale: 0.1, duration: 0.25 });
      card.remove();
      this.ui.hideHand.delete(inst.uid);
      if (mine) { this.sync(); await FX().ring(this.board.fx, ...this.xy(trap.sq), '#F538A0', 0.18); }
      else this.ui.toast('O adversário escondeu uma armadilha no tabuleiro…');
    }

    async chainLink({ link, chain }) {
      S('card_flip');
      const fromRect = this.ui.cardOriginRect(link);
      this.ui.hideHand.delete(link.inst.uid);
      this.ui.renderSoft();
      if (link.def.rarity === 'LEGENDARY') await this.ui.cutIn(link);
      await this.ui.showLink(link, chain, fromRect);
      S(link.kind === 'COUNTER' ? 'negate_stamp' : 'magic_zap');
    }

    async chainResolve({ link }) {
      this.ui.chainState(link, 'resolving');
      S(link.def.theme.sfx);
      await FX().wait(380);
    }

    async chainNegate({ link, by }) {
      const a = this.ui.chainCardRect(by), b = this.ui.chainCardRect(link);
      if (a && b) await FX().lightning(a, b, by.def.theme.primary);
      this.ui.chainState(link, 'negated');
      await FX().stamp('NEGADO!');
    }

    async equipAttach({ piece, sq, card, inst }) {
      const el = this.pel(piece);
      const from = this.ui.chainCardRect({ inst }) || this.ui.deckRect(piece.color);
      if (from) {
        const c = YC.HoloCard.create(card.id, { size: 'sm', static: true });
        await FX().flyCard(c, from, this.board.rect(sq), { duration: 0.55, endScale: 0.25, spin: 360 });
        c.remove();
      }
      S(card.theme.sfx);
      this.sync();
      const [x, y] = this.xy(sq);
      FX().ring(this.board.fx, x, y, card.theme.primary, 0.32);
      FX().particles(this.board.fx, x, y, { n: 16, colors: [card.theme.primary, card.theme.secondary, '#fff'], shape: 'star' });
      if (el) await FX().fromTo(el.querySelector('.squash'), { scaleX: 1.35, scaleY: 0.65 }, { scaleX: 1, scaleY: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' });
    }

    async equipSteal(from, to) {
      S('magic_zap');
      await FX().lightning(this.board.rect(from), this.board.rect(to), '#D93025');
      this.sync();
      await this.at(to, 'ROUBADO!', '#D93025', null, { ring: '#1A73E8' });
    }

    async captureDeclare({ attacker, target }) {
      const t = this.pel(target), a = this.pel(attacker);
      if (t) t.classList.add('scared');
      if (a) a.classList.add('lifted');
      S('hop');
      if (a) await FX().to(a.querySelector('.squash'), { y: '-12%', scaleY: 1.1, duration: 0.18, ease: 'power2.out' });
      await FX().wait(160);
    }

    async shieldShatter({ piece, sq }) {
      const el = this.pel(piece);
      const [x, y] = this.xy(sq);
      S('glass');
      FX().shards(this.board.fx, x, y, '#12B5CB');
      FX().shake(this.board.wrap, 10, 7);
      if (el) el.classList.remove('shielded');
      await FX().burst(this.board.fx, x, y, 'CRASH!', { fill: '#12B5CB' });
    }

    async freeze(sq) {
      const [x, y] = this.xy(sq);
      S('ice_freeze');
      FX().particles(this.board.fx, x, y, { n: 12, colors: ['#fff', '#BDE7FF', '#8FD3FF'], shape: 'star', gravity: false });
      FX().ring(this.board.fx, x, y, '#8FD3FF', 0.25);
      this.sync();
      await FX().popText(this.board.fx, x, y, 'BRRR!', '#BDE7FF');
    }

    bump(piece) {
      const el = this.pel(piece);
      return el ? FX().shake(el, 6, 4) : FX().wait(50);
    }

    async trapTrigger({ trap, sq, piece }) {
      const c = YC.Cards.get(trap.id);
      const el = this.pel(piece);
      if (el) el.classList.add('scared');
      S('trap');
      FX().shake(this.board.wrap, 9, 6);
      FX().ring(this.board.fx, ...this.xy(sq), c.theme.primary, 0.35);
      await FX().burst(this.board.fx, ...this.xy(sq), 'TRAP!', { fill: c.theme.primary, size: 1.15, hold: 0.25 });
      if (el) el.classList.remove('scared');
    }

    async emp({ sq }) {
      const [x, y] = this.xy(sq);
      S('explosion_bam');
      FX().ring(this.board.fx, x, y, '#12B5CB', 0.5);
      setTimeout(() => FX().ring(this.board.fx, x, y, '#C58AF9', 0.6), 120);
      FX().shake(this.board.wrap, 8, 6);
      await FX().burst(this.board.fx, x, y, 'ZZZAP!', { fill: '#12B5CB', size: 1.2 });
    }
  }

  YC.MatchAnimator = MatchAnimator;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
