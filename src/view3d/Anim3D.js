/* Anim3D.js — animações das peças no palco 3D (substitui as do tabuleiro CSS quando há WebGL).
   Coreografia do relatório: salto em arco com squash & stretch e onda de choque; captura com investida,
   POW! e a vítima a desfazer-se; ressalto elástico; escudo hexagonal a estilhaçar com pico de bloom;
   cristal de gelo a crescer; pilar de luz nas armadilhas; anel dourado ao equipar; bigorna a cair. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const FX = () => YC.FX;
  const S = (n) => YC.Sound && YC.Sound.play(n);
  const hold = (g) => g.children[0];

  const Anim3D = {
    g3(piece) { return piece ? this.board.el(piece.id) : null; },

    /** Onda de choque (anel deitado que cresce e desaparece). */
    wave3D(sq, hex = 0x00E5FF, size = 1) {
      const THREE = T(), p = this.board.sqWorld(sq);
      const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), new THREE.MeshBasicMaterial({ color: YC.T3.glow(hex, 2.2), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.03, p.z);
      this.board.layers.marks.add(m);
      FX().to(m.scale, { x: 2.4 * size, y: 2.4 * size, duration: 0.55, ease: 'power2.out' });
      return FX().to(m.material, { opacity: 0, duration: 0.55, ease: 'power2.in' }).then(() => { this.board.layers.marks.remove(m); m.geometry.dispose(); m.material.dispose(); });
    },

    /** Vítima a desfazer-se (estica para cima e encolhe, como no relatório). */
    dissolve(g, id) {
      if (!g) return Promise.resolve();
      this.board.busy.add(id);
      return FX().to(g.scale, { x: 0.01, y: 2.2, z: 0.01, duration: 0.42, ease: 'power3.in' }).then(() => {
        this.board.layers.pieces.remove(g); this.board.pieceEls.delete(id); this.board.busy.delete(id);
      });
    },

    async pieceMove({ move, piece, from, to, captured, capSq }) {
      const b = this.board, g = this.g3(piece);
      if (!g) return;
      const victim = captured ? b.el(captured.id) : null;
      if (move.flag === 'r') return this.lance(g, from, capSq, victim, captured);
      b.busy.add(piece.id);
      const A = b.sqWorld(from), B = b.sqWorld(to), dist = Math.hypot(B.x - A.x, B.z - A.z), h = hold(g);
      const dur = 0.42 + Math.min(dist, 6) * 0.04;
      S('hop');
      const tl = FX().timeline();
      tl.to(h.scale, { y: 0.8, x: 1.12, z: 1.12, duration: 0.12, ease: 'power2.out' })
        .to(h.scale, { y: 1.14, x: 0.92, z: 0.92, duration: 0.1 })
        .to(g.position, { x: B.x, z: B.z, duration: dur, ease: 'power1.inOut' }, '<')
        .to(g.position, { y: 0.8 + Math.min(dist, 5) * 0.12, duration: dur / 2, ease: 'power2.out' }, '<')
        .to(g.position, { y: 0, duration: dur / 2, ease: 'power2.in' }, '>')
        .to(h.scale, { y: 0.76, x: 1.2, z: 1.2, duration: 0.08 })
        .to(h.scale, { y: 1, x: 1, z: 1, duration: 0.5, ease: 'elastic.out(1.1, 0.35)' });
      if (move.flag === 'k') {
        const rook = b.pieceAtSq(move.rookFrom) || [...b.pieceEls.values()].find((x) => x.userData.sq === move.rookFrom);
        if (rook) { const R = b.sqWorld(move.rookTo); b.busy.add(rook.userData.id); FX().to(rook.position, { x: R.x, z: R.z, duration: dur + 0.1, ease: 'back.out(1.4)' }).then(() => { b.busy.delete(rook.userData.id); rook.userData.sq = move.rookTo; }); }
      }
      tl.call(() => {
        this.wave3D(to, victim ? 0xFF1E42 : 0x00E5FF);
        if (victim) {
          S('capture');
          const [x, y] = this.xy(capSq);
          FX().burst(b.fx, x, y, ['POW!', 'BAM!', 'KAPOW!', 'TOMA!'][Math.floor(Math.random() * 4)], { fill: '#FF1E42' });
          FX().particles(b.fx, x, y, { n: 18, shape: 'star', colors: ['#FF1E42', '#FFD700', '#00E5FF', '#fff'] });
          FX().shake(b.wrap, 8, 6);
          b.flash(2.4);
          this.dissolve(victim, captured.id);
        } else S('chess_move');
      }, null, '-=0.58');
      await tl;
      b.busy.delete(piece.id);
      g.userData.sq = to;
      await FX().wait(victim ? 380 : 80);
    },

    async lance(g, from, target, victim, captured) {
      const b = this.board, A = b.sqWorld(from), B = b.sqWorld(target), h = hold(g);
      S('sword_draw');
      await FX().to(h.position, { x: (B.x - A.x) * 0.55, z: (B.z - A.z) * 0.55, duration: 0.18, ease: 'power3.in' });
      const [x, y] = this.xy(target);
      FX().burst(b.fx, x, y, 'ZÁS!', { fill: '#D93025' });
      FX().particles(b.fx, x, y, { n: 12, shape: 'star' });
      b.flash(2);
      FX().to(h.position, { x: 0, z: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      if (victim) await this.dissolve(victim, captured.id);
    },

    async captureDeclare({ attacker, target }) {
      const ga = this.g3(attacker), gt = this.g3(target);
      S('hop');
      if (gt) FX().fromTo(hold(gt).position, { x: -0.04 }, { x: 0.04, duration: 0.05, repeat: 5, yoyo: true, ease: 'none' }).then(() => { hold(gt).position.x = 0; });
      if (ga) await FX().to(hold(ga).scale, { y: 1.12, x: 0.94, z: 0.94, duration: 0.22, ease: 'back.in(1.7)' });
      await FX().wait(140);
    },

    async snapback({ piece, from, to }) {
      const b = this.board, g = this.g3(piece);
      if (!g || to == null) return;
      const A = b.sqWorld(from), B = b.sqWorld(to), h = hold(g);
      b.busy.add(piece.id);
      await FX().to(g.position, { x: A.x + (B.x - A.x) * 0.55, z: A.z + (B.z - A.z) * 0.55, y: 0.25, duration: 0.18, ease: 'expo.in' });
      S('spring_jump');
      FX().burst(b.fx, ...this.xy(to), 'BOING!', { fill: '#12B5CB', size: 0.85 });
      b.flash(1.8);
      await FX().to(g.position, { x: A.x, z: A.z, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.45)' });
      FX().to(h.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
      b.busy.delete(piece.id);
    },

    async destroyAnim({ piece, sq, cause }) {
      const b = this.board, g = this.g3(piece);
      if (g) b.busy.add(piece.id);
      if (cause === 'gt_guilhotina_bigorna') await this.anvil(sq, g);
      S('explosion_bam');
      const [x, y] = this.xy(sq);
      FX().shake(b.wrap, 12, 7);
      FX().particles(b.fx, x, y, { n: 22, colors: ['#FA903E', '#FCC934', '#FF1E42', '#111'], spread: 0.16 });
      FX().burst(b.fx, x, y, 'BAM!', { fill: '#FA903E' });
      this.wave3D(sq, 0xFA903E, 1.3);
      b.flash(2.8);
      if (g) {
        await FX().to(g.rotation, { y: 6, duration: 0.45, ease: 'power2.in' });
        b.layers.pieces.remove(g); b.pieceEls.delete(piece.id); b.busy.delete(piece.id);
      }
    },

    async anvil(sq, g) {
      const THREE = T(), b = this.board, p = b.sqWorld(sq);
      const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.8, roughness: 0.35 });
      const grp = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), metal); top.position.y = 0.5;
      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.36), metal); waist.position.y = 0.25;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.5), metal); foot.position.y = 0.07;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 12), metal); horn.rotation.z = Math.PI / 2; horn.position.set(0.6, 0.52, 0);
      grp.add(top, waist, foot, horn);
      grp.traverse((o) => { if (o.isMesh) YC.T3.addOutline(o, 0.02); });
      grp.position.set(p.x, 7, p.z);
      b.layers.marks.add(grp);
      await FX().to(grp.position, { y: 0.15, duration: 0.42, ease: 'power3.in' });
      if (g) FX().to(hold(g).scale, { y: 0.12, x: 1.5, z: 1.5, duration: 0.1 });
      FX().to(grp.position, { y: -0.2, duration: 0.4, delay: 0.35 }).then(() => b.layers.marks.remove(grp));
    },

    async freeze(sq) {
      const b = this.board;
      S('ice_freeze');
      this.sync();
      const g = b.pieceAtSq(sq), ice = g && g.getObjectByName('ice');
      const [x, y] = this.xy(sq);
      FX().particles(b.fx, x, y, { n: 14, colors: ['#fff', '#BDE7FF', '#8FD3FF'], shape: 'star', gravity: false });
      this.wave3D(sq, 0x80E5FF);
      if (ice) { const sy = ice.scale.y; ice.scale.y = 0.01; FX().to(ice.scale, { y: sy, duration: 0.5, ease: 'back.out(1.5)' }); }
      await FX().popText(b.fx, x, y, 'BRRR!', '#BDE7FF');
    },

    async relocate({ piece, from, to, style }) {
      const b = this.board, g = this.g3(piece);
      if (!g) return;
      b.busy.add(piece.id);
      const B = b.sqWorld(to), h = hold(g);
      if (style === 'teleport') {
        S('magic_zap');
        this.wave3D(from, 0x7B42F6, 1.2);
        await FX().to(h.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.5, ease: 'power2.in' });
        g.position.set(B.x, 0, B.z);
        FX().to(h.rotation, { y: 0, duration: 0.01 });
        this.wave3D(to, 0xC58AF9, 1.2);
        await FX().to(h.scale, { x: 1, y: 1, z: 1, duration: 0.55, ease: 'back.out(2)' });
      } else if (style === 'dodge') {
        S('spring_jump');
        FX().particles(b.fx, ...this.xy(from), { n: 14, colors: ['#575B5F', '#C58AF9', '#E7DFF8'], gravity: false, size: 18 });
        await FX().to(h.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.18 });
        g.position.set(B.x, 0, B.z);
        FX().burst(b.fx, ...this.xy(to), 'PUF!', { fill: '#C58AF9', size: 0.7 });
        await FX().to(h.scale, { x: 1, y: 1, z: 1, duration: 0.3, ease: 'back.out(2)' });
      } else {
        const eject = style === 'eject';
        S(eject ? 'spring_jump' : 'hop');
        const tl = FX().timeline();
        tl.to(g.position, { x: B.x, z: B.z, duration: eject ? 0.75 : 0.36, ease: 'power1.inOut' })
          .to(g.position, { y: eject ? 3 : 0.4, duration: eject ? 0.37 : 0.18, ease: 'power2.out' }, '<')
          .to(g.position, { y: 0, duration: eject ? 0.38 : 0.18, ease: 'bounce.out' }, '>');
        await tl;
        if (eject) FX().burst(b.fx, ...this.xy(to), 'BOING!', { fill: '#FA903E', size: 0.8 });
        this.wave3D(to, 0xFA903E);
      }
      b.busy.delete(piece.id);
      g.userData.sq = to;
    },

    bump(piece) {
      const g = this.g3(piece);
      return g ? FX().fromTo(hold(g).position, { x: -0.06 }, { x: 0.06, duration: 0.05, repeat: 5, yoyo: true, ease: 'none' }).then(() => { hold(g).position.x = 0; }) : FX().wait(50);
    },

    async morph(piece, sq, shrink) {
      const b = this.board, g = this.g3(piece);
      S('magic_zap');
      this.wave3D(sq, 0x81C995, 1.3);
      if (shrink) FX().burst(b.fx, ...this.xy(sq), 'ZAP!', { fill: '#81C995', size: 0.8 });
      if (g) await FX().to(hold(g).scale, { x: 0.2, y: 0.2, z: 0.2, duration: 0.2, ease: 'power2.in' });
      this.sync();
      if (g) await FX().to(hold(g).scale, { x: 1, y: 1, z: 1, duration: 0.55, ease: 'elastic.out(1.2, 0.4)' });
    },

    async promote(piece, sq) {
      S('reveal_epic');
      FX().particles(this.board.fx, ...this.xy(sq), { n: 20, shape: 'star' });
      this.board.flash(2.6);
      return this.morph(piece, sq, false);
    },

    async shieldShatter({ piece, sq }) {
      const THREE = T(), b = this.board, g = this.g3(piece);
      const [x, y] = this.xy(sq);
      S('glass');
      FX().burst(b.fx, x, y, 'CRASH!', { fill: '#12B5CB' });
      FX().shake(b.wrap, 10, 7);
      b.flash(3.2);
      if (g) {
        const dome = g.getObjectByName('shield');
        const base = new THREE.Vector3(g.position.x, (g.userData.h || 1) * 0.5, g.position.z);
        if (dome) await FX().to(dome.scale, { x: 1.25, y: dome.scale.y * 1.2, z: 1.25, duration: 0.15, ease: 'expo.out' });
        if (dome) dome.visible = false;
        const mat = new THREE.MeshBasicMaterial({ color: YC.T3.glow(0x00FFCC, 2), transparent: true });
        const geo = new THREE.TetrahedronGeometry(0.09);
        for (let i = 0; i < 16; i++) {
          const s = new THREE.Mesh(geo, mat);
          s.position.copy(base);
          b.layers.marks.add(s);
          const a = (i / 16) * Math.PI * 2, d = 0.9 + Math.random() * 0.8;
          FX().to(s.position, { x: base.x + Math.cos(a) * d, z: base.z + Math.sin(a) * d, duration: 0.7, ease: 'power2.out' });
          FX().to(s.position, { keyframes: [{ y: base.y + 0.6 + Math.random() * 0.5, duration: 0.25, ease: 'power2.out' }, { y: 0.05, duration: 0.45, ease: 'power2.in' }] });
          FX().to(s.rotation, { x: 8, y: 6, duration: 0.7 }).then(() => b.layers.marks.remove(s));
        }
        FX().to(mat, { opacity: 0, duration: 0.3, delay: 0.5 });
      }
      await FX().wait(500);
    },

    async equipAttach({ piece, sq, card, inst }) {
      const b = this.board;
      const from = this.ui.chainCardRect({ inst }) || this.ui.deckRect(piece.color);
      if (from) {
        const c = YC.HoloCard.create(card.id, { size: 'sm', static: true });
        await FX().flyCard(c, from, b.rect(sq), { duration: 0.55, endScale: 0.25, spin: 360 });
        c.remove();
      }
      S(card.theme.sfx);
      this.sync();
      const g = this.g3(piece), [x, y] = this.xy(sq);
      FX().particles(b.fx, x, y, { n: 16, colors: [card.theme.primary, card.theme.secondary, '#FFD700', '#fff'], shape: 'star' });
      this.wave3D(sq, 0xFFD700, 1.2);
      b.flash(2.2);
      if (g) {
        const ring = g.getObjectByName('equipRing');
        if (ring) FX().fromTo(ring.scale, { x: 2.6, y: 2.6, z: 2.6 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'expo.out' });
        await FX().fromTo(hold(g).scale, { x: 1.3, y: 0.7, z: 1.3 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'elastic.out(1.2, 0.35)' });
      }
    },

    async trapTrigger({ trap, sq, piece }) {
      const THREE = T(), b = this.board, c = YC.Cards.get(trap.id), p = b.sqWorld(sq);
      const col = new THREE.Color(c.theme.primary).getHex();
      S('trap');
      FX().shake(b.wrap, 9, 6);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 4, 24, 1, true), new THREE.MeshBasicMaterial({ color: YC.T3.glow(col, 2), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      pillar.position.set(p.x, 2, p.z); pillar.scale.y = 0.01;
      b.layers.marks.add(pillar);
      FX().to(pillar.scale, { y: 1, duration: 0.3, ease: 'expo.out' });
      FX().to(pillar.material, { opacity: 0, duration: 0.5, delay: 0.55 }).then(() => b.layers.marks.remove(pillar));
      this.wave3D(sq, col, 1.4);
      b.flash(2.6);
      const g = this.g3(piece);
      if (g) FX().fromTo(hold(g).position, { x: -0.05 }, { x: 0.05, duration: 0.05, repeat: 7, yoyo: true, ease: 'none' }).then(() => { hold(g).position.x = 0; });
      await FX().burst(b.fx, ...this.xy(sq), 'TRAP!', { fill: c.theme.primary, size: 1.15, hold: 0.25 });
    }
  };

  // efeitos de câmara/brilho usados pelas animações
  Object.assign(YC.Board3D.prototype, {
    flash(strength = 2.4) {
      if (!this.bloom || !window.gsap) return;
      strength = (this.bloomBase || 0.4) + (strength - 1) * 0.5;
      window.gsap.killTweensOf(this.bloom);
      window.gsap.fromTo(this.bloom, { strength }, { strength: this.bloomBase || 0.95, duration: 0.55 / (YC.FX.speed || 1), ease: 'power2.out' });
    },
    punch() {
      if (!window.gsap) return;
      const cam = this.camera, base = this.baseFov || cam.fov;
      window.gsap.fromTo(cam, { fov: base - 4 }, { fov: base, duration: 0.7 / (YC.FX.speed || 1), ease: 'power2.inOut', onUpdate: () => cam.updateProjectionMatrix() });
    }
  });

  YC.Anim3D = Anim3D;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
