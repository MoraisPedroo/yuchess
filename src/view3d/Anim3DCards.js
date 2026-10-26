/* Anim3DCards.js — animações 3D ligadas às cartas (continuação de Anim3D.js): feixes de luz, transformações,
   promoção, escudo a partir, equipamento a encaixar, armadilhas a disparar e a serem armadas. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const FX = () => YC.FX;
  const S = (n) => YC.Sound && YC.Sound.play(n);
  const hold = (g) => g.children[0];

  Object.assign(YC.Anim3D, {
    beam(sq, hex, h = 5) {
      const THREE = T(), b = this.board, p = this.w3(sq);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.46, h, 28, 1, true), new THREE.MeshBasicMaterial({ color: YC.T3.glow(hex, 1.3), transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.position.set(p.x, h / 2, p.z); m.scale.y = 0.01;
      b.fxLayer().add(m);
      FX().to(m.scale, { y: 1, duration: 0.35, ease: 'expo.out' });
      FX().to(m.material, { opacity: 0, duration: 0.6, delay: 0.7 }).then(() => { b.fxLayer().remove(m); m.geometry.dispose(); m.material.dispose(); });
    },

    async morph(piece, sq, shrink) {
      const b = this.board, g = this.g3(piece), p = this.w3(sq);
      S('magic_zap');
      this.beam(sq, 0x81C995);
      b.sparks(p.x, 0.6, p.z, 0x81C995, { n: 22 });
      if (shrink) b.text3D(p.x, 1.3, p.z, 'ZAP!', '#81C995', 1);
      if (g) await FX().to(hold(g).scale, { x: 0.2, y: 0.2, z: 0.2, duration: 0.3, ease: 'power2.in' });
      this.sync();
      if (g) await FX().to(hold(g).scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'elastic.out(1.2, 0.4)' });
    },

    async promote(piece, sq) {
      const p = this.w3(sq);
      S('reveal_epic');
      this.beam(sq, 0xFFD700, 6);
      this.board.sparks(p.x, 0.8, p.z, 0xFFD700, { n: 34, speed: 2.4 });
      this.board.text3D(p.x, 1.6, p.z, 'PROMOÇÃO!', '#FFD700', 1);
      this.board.flash(2.6);
      return this.morph(piece, sq, false);
    },

    async shieldShatter({ piece, sq }) {
      const b = this.board, g = this.g3(piece), p = this.w3(sq);
      S('glass');
      b.text3D(p.x, 1.4, p.z, 'CRASH!', '#12B5CB', 1.15);
      b.shakeCam(0.16, 0.4);
      b.flash(3);
      b.lightFlash(p.x, 1, p.z, 0x00FFCC, 8, 0.7);
      if (g) {
        const dome = g.getObjectByName('shield');
        if (dome) await FX().to(dome.scale, { x: 1.3, z: 1.3, y: dome.scale.y * 1.25, duration: 0.2, ease: 'expo.out' });
        if (dome) dome.visible = false;
        b.shards3D(p.x, (g.userData.h || 1) * 0.5, p.z, 0x00FFCC, { n: 22, size: 0.08, glow: true, sp: 3 });
      }
      await FX().wait(650);
    },

    async equipAttach({ piece, sq, card, inst }) {
      const b = this.board;
      const from = this.ui.chainCardRect({ inst }) || this.ui.deckRect(piece.color);
      if (from) {
        const c = YC.HoloCard.create(card.id, { size: 'sm', static: true });
        await FX().flyCard(c, from, b.rect(sq), { duration: 0.75, endScale: 0.2, spin: 360 });
        c.remove();
      }
      S(card.theme.sfx);
      this.sync();
      const g = this.g3(piece), p = this.w3(sq), hex = new (T().Color)(card.theme.primary).getHex();
      this.beam(sq, 0xFFD700, 3);
      b.sparks(p.x, 0.6, p.z, 0xFFD700, { n: 24, speed: 2 });
      b.sparks(p.x, 0.6, p.z, hex, { n: 16, speed: 2 });
      b.text3D(p.x, 1.5, p.z, 'EQUIPADO!', '#FFD700', 0.85);
      this.wave3D(sq, 0xFFD700, 1.2);
      b.flash(2.2);
      if (g) {
        const ring = g.getObjectByName('equipRing');
        if (ring) FX().fromTo(ring.scale, { x: 3, y: 3, z: 3 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'expo.out' });
        await FX().fromTo(hold(g).scale, { x: 1.3, y: 0.7, z: 1.3 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'elastic.out(1.2, 0.35)' });
      }
    },

    async trapTrigger({ trap, sq, piece }) {
      const b = this.board, c = YC.Cards.get(trap.id), p = this.w3(sq);
      const hex = new (T().Color)(c.theme.primary).getHex();
      S('trap');
      this.beam(sq, hex, 5);
      b.sparks(p.x, 0.4, p.z, hex, { n: 30, speed: 3.2 });
      b.lightFlash(p.x, 1, p.z, hex, 9, 0.8);
      b.shakeCam(0.16, 0.4);
      b.flash(2.6);
      this.wave3D(sq, hex, 1.4);
      b.text3D(p.x, 1.6, p.z, 'TRAP!', c.theme.primary, 1.3);
      const g = this.g3(piece);
      if (g) FX().fromTo(hold(g).position, { x: -0.05 }, { x: 0.05, duration: 0.05, repeat: 11, yoyo: true, ease: 'none' }).then(() => { hold(g).position.x = 0; });
      await FX().wait(900);
    },

    /** Armadilha escondida: a carta voa para a casa, mergulha num feixe e (se for tua) mostra os detalhes. */
    async trapSet({ trap, team, inst }) {
      S('card_flip');
      const b = this.board, mine = team === this.ui.viewer;
      const from = this.ui.handCardRect(team, inst.uid);
      if (mine) this.ui.hideHand.add(inst.uid);
      this.ui.renderSoft();
      if (!from) return;
      const w = b.wrap.getBoundingClientRect();
      const to = mine ? b.rect(trap.sq) : { left: w.left + w.width / 2 - 30, top: w.top + w.height / 2 - 40, width: 60, height: 84 };
      const card = mine ? YC.HoloCard.create(inst.id, { size: 'sm', static: true }) : YC.HoloCard.back('sm');
      await FX().flyCard(card, from, to, { duration: 0.65, endScale: mine ? 0.45 : 0.6, arc: 0.2 });
      await FX().to(card, { opacity: 0, scale: 0.1, duration: 0.3 });
      card.remove();
      this.ui.hideHand.delete(inst.uid);
      if (!mine) return this.ui.toast('O adversário escondeu uma armadilha no tabuleiro…');
      this.sync();
      const c = YC.Cards.get(trap.id), p = this.w3(trap.sq), hex = new (T().Color)(c.theme.primary).getHex();
      this.beam(trap.sq, hex, 2.6);
      b.sparks(p.x, 0.4, p.z, hex, { n: 18, speed: 1.8 });
      this.wave3D(trap.sq, hex);
      b.text3D(p.x, 1.2, p.z, 'ARMADA!', c.theme.primary, 0.75);
      // mostra a carta ao lado da casa durante uns segundos (só tu a vês)
      YC.CardZoom.show({ getBoundingClientRect: () => b.rect(trap.sq) }, trap.id, { delay: 0 });
      setTimeout(() => YC.CardZoom.hide(), 2600);
      await FX().wait(500);
    }

  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
