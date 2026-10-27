/* Anim3D.js — animações das peças no palco 3D (substituem as do tabuleiro CSS quando há WebGL).
   Mais lentas e com antecipação: agachar → saltar com rasto de luz → aterrar com poeira e onda.
   Captura: recuo, investida, pausa de impacto, faíscas, estilhaços e a peça vencida a voar do tabuleiro.
   Os textos ("POW!", "XEQUE!") são néon em 3D (Particles3D.text3D) em vez de balões de banda desenhada. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const FX = () => YC.FX;
  const S = (n) => YC.Sound && YC.Sound.play(n);
  const hold = (g) => g.children[0];
  const BODY = { w: 0xEEF2F7, b: 0x2E3D57 };
  // desenho (assets/fx) que acompanha cada balão de texto
  const TEXT_ART = { 'CLANG!': 'IMPACT', 'SPLOSH!': 'INK', 'FALHOU!': 'SMOKE', 'ÉGIDE!': 'SPARKLE', 'BOING!': 'SWOOSH', 'PUF!': 'SMOKE', 'XEQUE!': 'IMPACT',
    'ROUBADO!': 'ANGER', 'REVELADA!': 'MAGIC_CIRCLE', 'CACTO!': 'TOXIC', '+1 CARTA!': 'COIN', 'BLOQUEADO!': 'GLASS', 'IMUNE!': 'SPARKLE', 'BONECO!': 'SWOOSH' };

  const Anim3D = {
    g3(piece) { return piece ? this.board.el(piece.id) : null; },
    w3(sq) { return this.board.sqWorld(sq); },
    teamHex(piece) { return piece && piece.color === this.ui.viewer ? 0x00E5FF : 0xFF1E42; },

    /** Mostra um desenho de efeito numa casa: espalhado (estrelas, moedas, cacos), no chão (círculo) ou a rebentar. */
    artFx(name, sq, { size = 1.3, y = 0.9 } = {}) {
      if (!name || sq == null || sq < 0) return;
      const b = this.board, p = this.w3(sq);
      if (name === 'MAGIC_CIRCLE') return b.decal(p.x, p.z, name, { size: size * 1.2 });
      if (name === 'COIN' || name === 'GLASS' || name === 'SPARKLE' || name === 'CONFETTI') return b.scatter(p.x, y, p.z, name, { n: 7, size: size * 0.3 });
      return b.burst(p.x, y, p.z, name, { size });
    },

    /** Substitui os balões 2D por texto néon 3D + faíscas. */
    at(sq, text, fill, sound, { ring, small } = {}) {
      if (sq == null || sq < 0) return FX().wait(100);
      const p = this.w3(sq), hex = new (T().Color)(fill).getHex();
      if (sound) S(sound);
      this.artFx(TEXT_ART[text], sq, { size: small ? 0.9 : 1.3 });
      this.board.text3D(p.x, 1.2, p.z, text, fill, small ? 0.75 : 1.1);
      this.board.sparks(p.x, 0.5, p.z, hex, { n: small ? 10 : 18, speed: 2.4 });
      this.wave3D(sq, ring ? new (T().Color)(ring).getHex() : hex);
      return FX().wait(650);
    },

    pop(sq, text, color, sound) {
      if (sq == null || sq < 0) return FX().wait(100);
      const p = this.w3(sq);
      if (sound) S(sound);
      this.artFx(TEXT_ART[text], sq, { size: 0.9 });
      this.board.text3D(p.x, 1.1, p.z, text, color, 0.75);
      return FX().wait(550);
    },

    wave3D(sq, hex = 0x00E5FF, size = 1) {
      const THREE = T(), p = this.w3(sq);
      const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 48), new THREE.MeshBasicMaterial({ color: YC.T3.glow(hex, 2.2), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.03, p.z);
      this.board.fxLayer().add(m);
      FX().to(m.scale, { x: 2.6 * size, y: 2.6 * size, duration: 0.8, ease: 'power2.out' });
      return FX().to(m.material, { opacity: 0, duration: 0.8, ease: 'power2.in' }).then(() => { this.board.fxLayer().remove(m); m.geometry.dispose(); m.material.dispose(); });
    },

    /** Emite rasto enquanto o grupo se move (devolve a função para o onUpdate). */
    trailer(g, hex) {
      let lx = g.position.x, lz = g.position.z;
      return () => {
        const dx = g.position.x - lx, dz = g.position.z - lz;
        if (dx * dx + dz * dz < 0.02) return;
        lx = g.position.x; lz = g.position.z;
        this.board.trail(g.position.x, g.position.y + 0.35, g.position.z, hex);
      };
    },

    /** A peça vencida é projetada para fora, a rodar, e parte-se em estilhaços. */
    knockOut(victim, piece, dirX, dirZ) {
      const b = this.board;
      if (!victim) return Promise.resolve();
      b.busy.add(piece.id);
      const p = victim.position.clone(), hex = BODY[piece.color];
      const tl = FX().timeline();
      tl.to(victim.position, { x: p.x + dirX * 1.8, z: p.z + dirZ * 1.8, duration: 0.75, ease: 'power1.out' })
        .to(victim.position, { keyframes: [{ y: 1.9, duration: 0.32, ease: 'power2.out' }, { y: 0.4, duration: 0.43, ease: 'power2.in' }] }, '<')
        .to(victim.rotation, { x: dirZ * 8, z: -dirX * 8, duration: 0.75, ease: 'none' }, '<')
        .to(victim.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 0.75 }, '<')
        .call(() => {
          b.shards3D(victim.position.x, 0.5, victim.position.z, hex, { n: 18, size: 0.09 });
          b.smoke3D(victim.position.x, 0.3, victim.position.z, 0xBFB8DD, { n: 5, size: 0.6 });
          b.layers.pieces.remove(victim); b.pieceEls.delete(piece.id); b.busy.delete(piece.id);
        });
      return tl;
    },

    async pieceMove({ move, piece, from, to, captured, capSq }) {
      const b = this.board, g = this.g3(piece);
      if (!g) return;
      const victim = captured ? b.el(captured.id) : null;
      if (move.flag === 'r') return this.lance(g, from, capSq, victim, captured);
      if (victim) return this.attackMove(g, piece, from, to, victim, captured, capSq);
      b.busy.add(piece.id);
      const A = this.w3(from), B = this.w3(to), dist = Math.hypot(B.x - A.x, B.z - A.z), h = hold(g);
      const dx = (B.x - A.x) / (dist || 1), dz = (B.z - A.z) / (dist || 1), hex = this.teamHex(piece);
      const dur = 0.45 + Math.min(dist, 6) * 0.06, peak = 0.8 + Math.min(dist, 6) * 0.16;
      S('hop');
      const tl = FX().timeline();
      tl.to(h.scale, { y: 0.78, x: 1.14, z: 1.14, duration: 0.2, ease: 'power2.out' })
        .to(h.scale, { y: 1.16, x: 0.9, z: 0.9, duration: 0.12, ease: 'power2.in' })
        .to(g.position, { x: B.x, z: B.z, duration: dur, ease: 'power1.inOut', onUpdate: this.trailer(g, hex) }, '<')
        .to(g.position, { y: peak, duration: dur / 2, ease: 'sine.out' }, '<')
        .to(h.rotation, { x: dz * 0.35, z: -dx * 0.35, duration: dur / 2, ease: 'sine.out' }, '<')
        .to(g.position, { y: 0, duration: dur / 2, ease: 'sine.in' }, '>')
        .to(h.rotation, { x: 0, z: 0, duration: dur / 2, ease: 'sine.in' }, '<')
        .call(() => {
          S('chess_move');
          this.wave3D(to, hex);
          b.smoke3D(B.x, 0.1, B.z, 0xD8D2F0, { n: 4, size: 0.45, life: 0.9 });
          b.sparks(B.x, 0.15, B.z, hex, { n: 10, speed: 1.6, g: 3, size: 0.1 });
        })
        .to(h.scale, { y: 0.72, x: 1.22, z: 1.22, duration: 0.1 });
      if (move.flag === 'k') {
        const rook = [...b.pieceEls.values()].find((x) => x.userData.sq === move.rookFrom);
        if (rook) {
          const R = this.w3(move.rookTo);
          b.busy.add(rook.userData.id);
          const rt = FX().timeline();
          rt.to(rook.position, { x: R.x, z: R.z, duration: dur + 0.15, ease: 'power1.inOut', onUpdate: this.trailer(rook, hex) }, 0.15)
            .to(rook.position, { keyframes: [{ y: 0.7, duration: (dur + 0.15) / 2, ease: 'sine.out' }, { y: 0, duration: (dur + 0.15) / 2, ease: 'sine.in' }] }, 0.15)
            .call(() => { b.busy.delete(rook.userData.id); rook.userData.sq = move.rookTo; });
        }
      }
      await tl;
      // o ressalto elástico continua enquanto o jogo segue
      FX().to(h.scale, { y: 1, x: 1, z: 1, duration: 0.75, ease: 'elastic.out(1.1, 0.32)' });
      b.busy.delete(piece.id);
      g.userData.sq = to;
      await FX().wait(200);
    },

    /** Captura: recuo → investida → pausa de impacto → vítima projetada. */
    async attackMove(g, piece, from, to, victim, captured, capSq) {
      const b = this.board, A = this.w3(from), B = this.w3(to), V = this.w3(capSq), h = hold(g);
      const dist = Math.hypot(B.x - A.x, B.z - A.z), dx = (B.x - A.x) / (dist || 1), dz = (B.z - A.z) / (dist || 1), hex = this.teamHex(piece);
      b.busy.add(piece.id);
      S('hop');
      const tl = FX().timeline();
      tl.to(h.position, { x: -dx * 0.22, z: -dz * 0.22, duration: 0.32, ease: 'power2.out' })
        .to(h.scale, { y: 0.84, x: 1.12, z: 1.12, duration: 0.32 }, '<')
        .to(h.rotation, { x: -dz * 0.3, z: dx * 0.3, duration: 0.32 }, '<')
        .to(g.position, { x: B.x - dx * 0.38, z: B.z - dz * 0.38, duration: 0.24 + dist * 0.035, ease: 'expo.in', onUpdate: this.trailer(g, hex) })
        .to(g.position, { keyframes: [{ y: 0.45, duration: 0.12 }, { y: 0.2, duration: 0.12 }] }, '<')
        .to(h.position, { x: 0, z: 0, duration: 0.2 }, '<')
        .to(h.rotation, { x: dz * 0.45, z: -dx * 0.45, duration: 0.2 }, '<')
        .call(() => {
          S('capture');
          b.burst(V.x, 0.9, V.z, 'IMPACT', { size: 1.9, life: 0.8 });
          b.text3D(V.x, 1.3, V.z, ['POW!', 'BAM!', 'KAPOW!', 'TOMA!'][Math.floor(Math.random() * 4)], '#FFB703', 1.25);
          b.sparks(V.x, 0.6, V.z, 0xFFFFFF, { n: 16, speed: 3.6 });
          b.sparks(V.x, 0.6, V.z, hex, { n: 22, speed: 3 });
          b.lightFlash(V.x, 1, V.z, hex, 9, 0.7);
          b.shakeCam(0.18, 0.4);
          b.flash(2.6);
          this.wave3D(capSq, 0xD90429, 1.2);
          this.knockOut(victim, captured, dx, dz);
        })
        .to({}, { duration: 0.06 })   // hit-stop curto (60 ms) no impacto
        .to(g.position, { x: B.x, z: B.z, y: 0, duration: 0.4, ease: 'power2.out' })
        .to(h.rotation, { x: 0, z: 0, duration: 0.4 }, '<')
        .to(h.scale, { y: 0.75, x: 1.2, z: 1.2, duration: 0.1 });
      await tl;
      // assentar como vinil (ressalto curto), sem gelatina
      FX().to(h.scale, { y: 1, x: 1, z: 1, duration: 0.32, ease: 'back.out(2)' });
      b.busy.delete(piece.id);
      g.userData.sq = to;
      await FX().wait(350);
    },

    async lance(g, from, target, victim, captured) {
      const b = this.board, A = this.w3(from), B = this.w3(target), h = hold(g);
      const dist = Math.hypot(B.x - A.x, B.z - A.z) || 1, dx = (B.x - A.x) / dist, dz = (B.z - A.z) / dist;
      S('sword_draw');
      await FX().to(h.position, { x: -dx * 0.15, z: -dz * 0.15, duration: 0.25, ease: 'power2.out' });
      await FX().to(h.position, { x: dx * dist * 0.55, z: dz * dist * 0.55, duration: 0.16, ease: 'expo.in' });
      b.burst(B.x, 0.8, B.z, 'IMPACT', { size: 1.5, life: 0.7 });
      b.text3D(B.x, 1.2, B.z, 'ZÁS!', '#FA903E', 1.1);
      b.sparks(B.x, 0.6, B.z, 0xFA903E, { n: 22 });
      b.shakeCam(0.12, 0.3);
      b.flash(2.2);
      FX().to(h.position, { x: 0, z: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
      if (victim) await this.knockOut(victim, captured, dx, dz);
    },

    async captureDeclare({ attacker, target }) {
      const THREE = T(), ga = this.g3(attacker), gt = this.g3(target);
      S('hop');
      if (gt) {
        const p = gt.position;
        this.board.burst(p.x + 0.25, (gt.userData.h || 1) * 0.86 + 0.35, p.z, 'ANGER', { size: 0.55, life: 1.3, hold: 0.7 });
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 40), new THREE.MeshBasicMaterial({ color: YC.T3.glow(0xFF1E42, 2.4), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(p.x, 0.04, p.z);
        this.board.fxLayer().add(ring);
        FX().fromTo(ring.scale, { x: 2, y: 2 }, { x: 1, y: 1, duration: 0.35, ease: 'back.out(2)' });
        FX().to(ring.material, { opacity: 0, duration: 0.4, delay: 0.6 }).then(() => this.board.fxLayer().remove(ring));
        FX().fromTo(hold(gt).position, { x: -0.04 }, { x: 0.04, duration: 0.05, repeat: 9, yoyo: true, ease: 'none' }).then(() => { hold(gt).position.x = 0; });
      }
      if (ga) await FX().to(hold(ga).scale, { y: 1.12, x: 0.94, z: 0.94, duration: 0.3, ease: 'back.in(1.7)' });
      await FX().wait(260);
    },

    async snapback({ piece, from, to }) {
      const b = this.board, g = this.g3(piece);
      if (!g || to == null) return;
      const A = this.w3(from), B = this.w3(to), h = hold(g);
      b.busy.add(piece.id);
      await FX().to(g.position, { x: A.x + (B.x - A.x) * 0.55, z: A.z + (B.z - A.z) * 0.55, y: 0.3, duration: 0.24, ease: 'expo.in', onUpdate: this.trailer(g, this.teamHex(piece)) });
      S('spring_jump');
      b.burst(B.x, 0.7, B.z, 'SWOOSH', { size: 1.2, life: 0.8 });
      b.text3D(B.x, 1.2, B.z, 'BOING!', '#12B5CB', 1);
      b.sparks(B.x, 0.6, B.z, 0x12B5CB, { n: 20 });
      b.flash(2);
      await FX().to(g.position, { x: A.x, z: A.z, y: 0, duration: 0.8, ease: 'elastic.out(1, 0.45)' });
      FX().to(h.scale, { x: 1, y: 1, z: 1, duration: 0.3 });
      b.busy.delete(piece.id);
    },

    async destroyAnim({ piece, sq, cause }) {
      const b = this.board, g = this.g3(piece), p = this.w3(sq);
      if (g) b.busy.add(piece.id);
      if (cause === 'gt_guilhotina_bigorna') await this.anvil(sq, g);
      else if (g) {
        await FX().fromTo(hold(g).position, { x: -0.05 }, { x: 0.05, duration: 0.04, repeat: 9, yoyo: true, ease: 'none' });
        await FX().to(hold(g).scale, { x: 1.25, y: 1.25, z: 1.25, duration: 0.18, ease: 'power2.in' });
      }
      S('explosion_bam');
      b.burst(p.x, 0.8, p.z, 'EXPLOSION', { size: 2.3, life: 1.1, rise: 0.4 });
      b.text3D(p.x, 1.3, p.z, 'BAM!', '#FA903E', 1.25);
      b.sparks(p.x, 0.5, p.z, 0xFA903E, { n: 30, speed: 3.6 });
      b.shards3D(p.x, 0.5, p.z, BODY[piece.color], { n: 20 });
      b.smoke3D(p.x, 0.3, p.z, 0x9A90B8, { n: 8 });
      b.lightFlash(p.x, 1, p.z, 0xFA903E, 10, 0.8);
      b.shakeCam(0.22, 0.45);
      b.flash(2.8);
      this.wave3D(sq, 0xFA903E, 1.3);
      if (g) { b.layers.pieces.remove(g); b.pieceEls.delete(piece.id); b.busy.delete(piece.id); }
      await FX().wait(500);
    },

    async anvil(sq, g) {
      const THREE = T(), b = this.board, p = this.w3(sq);
      const metal = new THREE.MeshStandardMaterial({ color: 0x2b2f3a, metalness: 0.85, roughness: 0.3 });
      const grp = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5), metal); top.position.y = 0.5;
      const waist = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.36), metal); waist.position.y = 0.25;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.5), metal); foot.position.y = 0.07;
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 12), metal); horn.rotation.z = Math.PI / 2; horn.position.set(0.6, 0.52, 0);
      grp.add(top, waist, foot, horn);
      grp.traverse((o) => { if (o.isMesh) YC.T3.addOutline(o, 0.014); });
      grp.position.set(p.x, 8, p.z);
      b.fxLayer().add(grp);
      await FX().to(grp.position, { y: 0.15, duration: 0.55, ease: 'power3.in' });
      if (g) FX().to(hold(g).scale, { y: 0.1, x: 1.6, z: 1.6, duration: 0.1 });
      b.shakeCam(0.3, 0.5);
      FX().to(grp.position, { y: -0.3, duration: 0.5, delay: 0.5 }).then(() => b.fxLayer().remove(grp));
    },

    async freeze(sq) {
      const b = this.board, p = this.w3(sq);
      S('ice_freeze');
      this.sync();
      const g = b.pieceAtSq(sq), ice = g && g.getObjectByName('ice');
      b.sparks(p.x, 0.6, p.z, 0x9FE6FF, { n: 24, speed: 1.6, g: 0.5, life: 1.2 });
      b.burst(p.x, 0.8, p.z, 'ICE', { size: 1.4, life: 1.2 });
      b.text3D(p.x, 1.3, p.z, 'BRRR!', '#8FD3FF', 0.9);
      b.lightFlash(p.x, 1, p.z, 0x80E5FF, 6, 0.8);
      this.wave3D(sq, 0x80E5FF);
      if (ice) { const sy = ice.scale.y; ice.scale.y = 0.01; await FX().to(ice.scale, { y: sy, duration: 0.7, ease: 'back.out(1.5)' }); }
      await FX().wait(300);
    },

    async relocate({ piece, from, to, style }) {
      const b = this.board, g = this.g3(piece);
      if (!g) return;
      b.busy.add(piece.id);
      const A = this.w3(from), B = this.w3(to), h = hold(g);
      if (style === 'teleport') {
        S('magic_zap');
        b.decal(A.x, A.z, 'MAGIC_CIRCLE', { size: 1.5, life: 1.6 });
        b.decal(B.x, B.z, 'MAGIC_CIRCLE', { size: 1.5, life: 2.2 });
        b.sparks(A.x, 0.6, A.z, 0xC58AF9, { n: 26, speed: 1.4, g: -1 });
        this.wave3D(from, 0x7B42F6, 1.2);
        await FX().to(h.rotation, { y: Math.PI * 6, duration: 0.7, ease: 'power2.in' });
        await FX().to(h.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.2 });
        g.position.set(B.x, 0, B.z); h.rotation.y = 0;
        b.lightFlash(B.x, 1, B.z, 0xC58AF9, 7, 0.7);
        this.wave3D(to, 0xC58AF9, 1.2);
        await FX().to(h.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(2)' });
      } else if (style === 'dodge') {
        S('spring_jump');
        b.smoke3D(A.x, 0.3, A.z, 0x8E86AA, { n: 10, size: 0.8 });
        await FX().to(h.scale, { x: 0.01, y: 0.01, z: 0.01, duration: 0.25 });
        g.position.set(B.x, 0, B.z);
        b.smoke3D(B.x, 0.3, B.z, 0x8E86AA, { n: 6, size: 0.6 });
        b.text3D(B.x, 1.1, B.z, 'PUF!', '#C58AF9', 0.8);
        await FX().to(h.scale, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'back.out(2)' });
      } else {
        const eject = style === 'eject';
        S(eject ? 'spring_jump' : 'hop');
        const tl = FX().timeline();
        tl.to(g.position, { x: B.x, z: B.z, duration: eject ? 1 : 0.5, ease: 'power1.inOut', onUpdate: this.trailer(g, 0xFA903E) })
          .to(g.position, { y: eject ? 3.2 : 0.5, duration: eject ? 0.5 : 0.25, ease: 'power2.out' }, '<')
          .to(g.position, { y: 0, duration: eject ? 0.5 : 0.25, ease: 'bounce.out' }, '>');
        await tl;
        if (eject) b.text3D(B.x, 1.2, B.z, 'BOING!', '#FA903E', 0.9);
        this.wave3D(to, 0xFA903E);
      }
      b.busy.delete(piece.id);
      g.userData.sq = to;
    },

    bump(piece) {
      const g = this.g3(piece);
      return g ? FX().fromTo(hold(g).position, { x: -0.06 }, { x: 0.06, duration: 0.06, repeat: 5, yoyo: true, ease: 'none' }).then(() => { hold(g).position.x = 0; }) : FX().wait(50);
    }
  };

  Object.assign(YC.Board3D.prototype, {
    flash(strength = 2.4) {
      if (!this.bloom || !window.gsap) return;
      // pico curto e moderado: acima disto o néon todo estoura para branco
      strength = (this.bloomBase || 0.4) + (strength - 1) * 0.18;
      window.gsap.killTweensOf(this.bloom);
      window.gsap.fromTo(this.bloom, { strength }, { strength: this.bloomBase || 0.4, duration: 0.7 / (YC.FX.speed || 1), ease: 'power2.out' });
    },
    punch() {
      if (!window.gsap) return;
      const cam = this.camera, base = this.baseFov || cam.fov;
      window.gsap.fromTo(cam, { fov: base - 4 }, { fov: base, duration: 0.9 / (YC.FX.speed || 1), ease: 'power2.inOut', onUpdate: () => cam.updateProjectionMatrix() });
    }
  });

  YC.Anim3D = Anim3D;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
