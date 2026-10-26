/* PieceAnimations.js — animações das peças no tabuleiro (acrescenta métodos ao MatchAnimator):
   salto com squash & stretch, captura com POW!, Lança, ressalto BOING!, explosão/bigorna,
   empurrões, ejeção, teletransporte, esquiva em fumo, metamorfose e promoção. */
(function (YC) {
  'use strict';

  const FX = () => YC.FX;
  const S = (n) => YC.Sound && YC.Sound.play(n);

  Object.assign(YC.MatchAnimator.prototype, {
    /** Salto com arco + squash & stretch; captura com POW! e a vítima a voar. */
    async pieceMove({ move, piece, from, to, captured, capSq }) {
      const el = this.pel(piece);
      if (!el) return;
      const victim = captured ? this.pel(captured) : null;
      if (move.flag === 'r') {
        el.classList.remove('lifted');
        FX().set(el.querySelector('.squash'), { y: 0, scaleY: 1 });
        await this.lance(el, from, capSq, victim);
        if (victim) { victim.remove(); this.board.pieceEls.delete(captured.id); }
        return;
      }
      this.board.busy.add(piece.id);
      if (victim) this.board.busy.add(captured.id);
      el.classList.add('lifted');
      const hop = el.querySelector('.hop'), sq = el.querySelector('.squash');
      const dest = this.board.pctPos(to);
      const dist = Math.hypot((to & 7) - (from & 7), (to >> 3) - (from >> 3));
      const dur = 0.32 + Math.min(dist, 6) * 0.045;
      S('hop');
      const tl = FX().timeline();
      tl.to(sq, { scaleY: 0.78, scaleX: 1.15, y: 0, duration: 0.09 })
        .to(sq, { scaleY: 1.15, scaleX: 0.9, duration: 0.12 })
        .to(el, { left: dest.left, top: dest.top, duration: dur, ease: 'power1.inOut' }, '<')
        .to(hop, { y: `${-28 - dist * 6}%`, duration: dur / 2, ease: 'power2.out' }, '<')
        .to(hop, { y: 0, duration: dur / 2, ease: 'power2.in' }, `>`)
        .to(sq, { scaleY: 0.7, scaleX: 1.25, duration: 0.08 })
        .to(sq, { scaleY: 1, scaleX: 1, duration: 0.5, ease: 'elastic.out(1.1, 0.35)' });
      if (move.flag === 'k') {
        const rook = this.board.el(this.ui.match.pieceAt(move.rookTo) && this.ui.match.pieceAt(move.rookTo).id);
        if (rook) { const rd = this.board.pctPos(move.rookTo); FX().to(rook, { left: rd.left, top: rd.top, duration: dur + 0.1, ease: 'back.out(1.4)' }); }
      }
      if (victim) {
        tl.call(() => {
          const [x, y] = this.xy(capSq);
          S('capture');
          FX().burst(this.board.fx, x, y, ['POW!', 'BAM!', 'KAPOW!', 'TOMA!'][Math.floor(Math.random() * 4)], { fill: '#F538A0' });
          FX().particles(this.board.fx, x, y, { n: 16, shape: 'star' });
          FX().shake(this.board.wrap, 7, 5);
          const dir = (to & 7) >= (from & 7) ? 1 : -1;
          FX().to(victim, { x: dir * this.board.wrap.clientWidth * 0.18, y: -this.board.wrap.clientWidth * 0.2, rotation: dir * 540, scale: 0.2, opacity: 0, duration: 0.65, ease: 'power2.in' })
            .then(() => { victim.remove(); this.board.pieceEls.delete(captured.id); this.board.busy.delete(captured.id); });
        }, null, '-=0.58');
      } else {
        tl.call(() => S('chess_move'), null, '-=0.55');
      }
      await tl;
      el.classList.remove('lifted');
      FX().set(hop, { y: 0 });
      this.board.busy.delete(piece.id);
      this.board.place(el, this.ui.match.sqOf(piece) >= 0 ? this.ui.match.sqOf(piece) : to);
      await FX().wait(victim ? 360 : 60);
    },

    /** Lança Telescópica: a peça estica-se, espeta e volta, sem sair da casa. */
    async lance(el, from, target, victim) {
      const [x, y] = this.xy(target), [fx, fy] = this.xy(from);
      const W = this.board.fx.clientWidth;
      S('sword_draw');
      await FX().to(el.querySelector('.squash'), { x: ((x - fx) / 100) * W * 0.55, y: ((y - fy) / 100) * W * 0.55, scaleX: 1.2, duration: 0.16, ease: 'power3.in' });
      FX().burst(this.board.fx, x, y, 'ZÁS!', { fill: '#D93025' });
      FX().particles(this.board.fx, x, y, { n: 12, shape: 'star' });
      FX().to(el.querySelector('.squash'), { x: 0, y: 0, scaleX: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      if (victim) await FX().to(victim, { scale: 0, rotation: 360, opacity: 0, duration: 0.5 });
    },

    async snapback({ piece, from, to }) {
      const el = this.pel(piece);
      if (!el || to == null) return;
      const sq = el.querySelector('.squash'), d = this.board.pctPos(to), o = this.board.pctPos(from);
      const mid = { left: `${(parseFloat(o.left) * 0.4 + parseFloat(d.left) * 0.6)}%`, top: `${(parseFloat(o.top) * 0.4 + parseFloat(d.top) * 0.6)}%` };
      this.board.busy.add(piece.id);
      await FX().to(el, { left: mid.left, top: mid.top, duration: 0.18, ease: 'power3.in' });
      S('spring_jump');
      FX().burst(this.board.fx, ...this.xy(to), 'BOING!', { fill: '#12B5CB', size: 0.85 });
      await FX().to(el, { left: o.left, top: o.top, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      await FX().to(sq, { y: 0, scaleX: 1, scaleY: 1, duration: 0.2 });
      el.classList.remove('lifted');
      this.board.busy.delete(piece.id);
      this.board.pieceEls.forEach((p) => p.classList.remove('scared'));
    },

    async destroyAnim({ piece, sq, cause }) {
      const el = this.pel(piece);
      if (el) this.board.busy.add(piece.id);
      const [x, y] = this.xy(sq);
      if (cause === 'gt_guilhotina_bigorna') await this.anvil(x, y);
      S('explosion_bam');
      FX().shake(this.board.wrap, 12, 7);
      FX().particles(this.board.fx, x, y, { n: 20, colors: ['#FA903E', '#FCC934', '#D93025', '#111'], spread: 0.16 });
      FX().burst(this.board.fx, x, y, 'BAM!', { fill: '#FA903E' });
      if (el) {
        await FX().to(el, { scale: 0, rotation: 200, opacity: 0, duration: 0.45, ease: 'back.in(2)' });
        el.remove(); this.board.pieceEls.delete(piece.id); this.board.busy.delete(piece.id);
      }
    },

    async anvil(x, y) {
      const a = document.createElement('div');
      a.className = 'fx-abs';
      a.style.cssText = `left:${x}%;top:${y}%;width:13%;z-index:30`;
      a.innerHTML = YC.CardArt.svg(YC.Cards.get('gt_guilhotina_bigorna'));
      this.board.fx.appendChild(a);
      FX().set(a, { xPercent: -50, yPercent: -260, rotation: -10 });
      await FX().to(a, { yPercent: -50, rotation: 0, duration: 0.42, ease: 'power3.in' });
      FX().to(a, { opacity: 0, duration: 0.3, delay: 0.3 }).then(() => a.remove());
    },

    async relocate({ piece, from, to, style }) {
      const el = this.pel(piece);
      if (!el) return;
      this.board.busy.add(piece.id);
      const d = this.board.pctPos(to), sq = el.querySelector('.squash'), hop = el.querySelector('.hop');
      if (style === 'teleport') {
        S('magic_zap');
        FX().ring(this.board.fx, ...this.xy(from), '#7B42F6', 0.3);
        await FX().to(sq, { rotation: 720, scale: 0, duration: 0.5, ease: 'power2.in' });
        FX().set(el, { left: d.left, top: d.top });
        FX().ring(this.board.fx, ...this.xy(to), '#C58AF9', 0.3);
        await FX().to(sq, { rotation: 0, scale: 1, duration: 0.55, ease: 'back.out(2)' });
      } else if (style === 'dodge') {
        S('spring_jump');
        FX().particles(this.board.fx, ...this.xy(from), { n: 12, colors: ['#575B5F', '#C58AF9', '#E7DFF8'], gravity: false, size: 18 });
        await FX().to(el, { opacity: 0, duration: 0.15 });
        FX().set(el, { left: d.left, top: d.top });
        FX().burst(this.board.fx, ...this.xy(to), 'PUF!', { fill: '#C58AF9', size: 0.7 });
        await FX().to(el, { opacity: 1, duration: 0.2 });
      } else {
        S(style === 'eject' ? 'spring_jump' : 'hop');
        const high = style === 'eject' ? -90 : -18;
        const tl = FX().timeline();
        tl.to(el, { left: d.left, top: d.top, duration: style === 'eject' ? 0.7 : 0.35, ease: 'power1.inOut' })
          .to(hop, { y: `${high}%`, duration: style === 'eject' ? 0.35 : 0.17, ease: 'power2.out' }, '<')
          .to(hop, { y: 0, duration: style === 'eject' ? 0.35 : 0.18, ease: 'bounce.out' }, '>');
        await tl;
        if (style === 'eject') FX().burst(this.board.fx, ...this.xy(to), 'BOING!', { fill: '#FA903E', size: 0.8 });
      }
      this.board.busy.delete(piece.id);
      this.board.place(el, to);
    },

    async morph(piece, sq, shrink) {
      const el = this.pel(piece);
      const [x, y] = this.xy(sq);
      S('magic_zap');
      FX().ring(this.board.fx, x, y, '#81C995', 0.3);
      if (shrink) FX().burst(this.board.fx, x, y, 'ZAP!', { fill: '#81C995', size: 0.8 });
      if (el) await FX().to(el.querySelector('.squash'), { scale: 0.2, duration: 0.2, ease: 'power2.in' });
      this.sync();
      if (el) await FX().to(el.querySelector('.squash'), { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)' });
    },

    async promote(piece, sq) {
      const el = this.pel(piece);
      S('reveal_epic');
      FX().particles(this.board.fx, ...this.xy(sq), { n: 18, shape: 'star' });
      if (el) await FX().to(el.querySelector('.squash'), { scale: 0, duration: 0.18 });
      this.sync();
      if (el) await FX().to(el.querySelector('.squash'), { scale: 1, duration: 0.55, ease: 'elastic.out(1.2, 0.4)' });
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
