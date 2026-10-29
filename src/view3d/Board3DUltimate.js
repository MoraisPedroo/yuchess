/* Board3DUltimate.js — Ultimates no palco 3D (Ultimates.js):
   • a peça com uma Ultimate ativa transforma-se na personagem: uma figura de cartão (sprite sempre virado para a
     câmara) com a arte recortada, em pé no pedestal; o corpo da peça fica escondido mas continua a apanhar o rato e os
     ícones de equipamento por cima somem. A figura vive dentro do "hold", por isso salta e respira como as outras.
   • a barreira do guardião (Kaito): enquanto ele tiver Escudo, o Rei da cor dele fica dentro de uma cúpula de
     hexágonos ciano a rodar, com faíscas em órbita; quando o Escudo parte, a cúpula estilhaça.
   Sem luzes novas e só com materiais que o palco já usa (sprites, básico com wireframe): não congela o jogo. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const FIG_H = 1.55;         // altura da figura (mais alta do que o Rei: é a estrela)
  const textures = {};

  Object.assign(YC.Board3D.prototype, {
    syncUltimate(g, p, m) {
      const U = YC.Ultimate, d = U && U.forPiece(p, m);
      const hold = g.getObjectByName('hold');
      if (!hold) return;
      const body = hold.getObjectByName('body');
      let fig = hold.getObjectByName('ultFigure');
      if (d && (!fig || fig.userData.icon !== d.icon)) {
        if (fig) hold.remove(fig);
        const THREE = T();
        const tex = textures[d.icon] || (textures[d.icon] = new THREE.TextureLoader().load(U.hero(d), (t) => {
          for (const gg of this.pieceEls.values()) {
            const f = gg.getObjectByName('ultFigure');
            if (f && f.userData.icon === d.icon) f.scale.set(FIG_H * (t.image.width / t.image.height), FIG_H, 1);
          }
        }));
        tex.colorSpace = THREE.SRGBColorSpace;
        // a exposição alta do palco (ACES, no fim do composer) desbota a arte: a cor escurecida compensa
        fig = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xB8B8B8, transparent: true, alphaTest: 0.35, fog: false }));
        fig.name = 'ultFigure';
        fig.userData.icon = d.icon;
        fig.center.set(0.5, 0);
        fig.position.y = 0.1;
        const ratio = tex.image ? tex.image.width / tex.image.height : 0.55;
        fig.scale.set(FIG_H * ratio, FIG_H, 1);
        fig.raycast = () => {};
        hold.add(fig);
      }
      if (fig) fig.visible = !!d;
      if (body) body.visible = !d;
      const medals = g.getObjectByName('medals');
      if (medals) medals.visible = !d;
      if (d) g.userData.h = FIG_H;
      // a fusão tem anéis no chão (vermelho e ciano, a rodar ao contrário) e faíscas em órbita
      this.accessory(g, 'ultAura', !!d && d.role === 'fusion', () => this.makeFusionAura());
    },

    makeFusionAura() {
      const THREE = T(), grp = new THREE.Group(), T3 = YC.T3;
      const ring = (hex, r, k) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.03, 8, 48), T3.basic(hex, k)); m.rotation.x = Math.PI / 2; m.position.y = 0.06; return m; };
      const a = ring(0xFFB703, 0.52, 2), b = ring(0x48CAE4, 0.62, 2);
      grp.add(a, b);
      if (this.sprite) for (let i = 0; i < 6; i++) {
        const s = this.sprite(i % 2 ? 0xD90429 : 0x48CAE4, 0.2, 0.9), ang = (i / 6) * Math.PI * 2;
        s.position.set(Math.cos(ang) * 0.58, 0.25 + (i % 3) * 0.35, Math.sin(ang) * 0.58);
        grp.add(s);
      }
      if (window.gsap) {
        window.gsap.to(a.rotation, { z: Math.PI * 2, duration: 3, repeat: -1, ease: 'none' });
        window.gsap.to(b.rotation, { z: -Math.PI * 2, duration: 4, repeat: -1, ease: 'none' });
        window.gsap.to(grp.rotation, { y: Math.PI * 2, duration: 6, repeat: -1, ease: 'none' });
      }
      return grp;
    },

    /** Cúpula de hexágonos à volta de cada Rei protegido por um guardião. */
    syncWards(m) {
      const U = YC.Ultimate;
      if (!U) return;
      m.pos.board.forEach((p, sq) => {
        if (!p || p.type !== 'k') return;
        const g = this.el(p.id);
        if (!g) return;
        const style = U.wardStyle ? U.wardStyle(m, p.color) : (U.wardFor(m, p.color) ? 'guard' : null), on = !!style;
        // a da fusão é outra barreira (dupla, vermelha e ciano): só uma das duas fica visível
        const ward = this.accessory(g, 'ultWard', style === 'guard', () => this.makeWard());
        const wardF = this.accessory(g, 'ultWardFusion', style === 'fusion', () => this.makeWard(true));
        if (wardF) wardF.position.y = 0.62;
        if (g.userData.wardOn && !on) {
          // o Escudo do guardião partiu: a barreira estilhaça
          const w = this.sqWorld(sq);
          if (this.shards3D) this.shards3D(w.x, 0.8, w.z, 0x48CAE4, { n: 22, size: 0.09, sp: 3, glow: true });
          if (this.sparks) this.sparks(w.x, 0.8, w.z, 0x48CAE4, { n: 18, speed: 2.4 });
        }
        g.userData.wardOn = on;
        if (ward) ward.position.y = 0.62;
      });
    },

    makeWard(fusion = false) {
      const THREE = T(), grp = new THREE.Group();
      const geo = new THREE.IcosahedronGeometry(0.72, 1);
      const wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: YC.T3.glow(0x48CAE4, 1.8), wireframe: true, transparent: true, opacity: 0.7 }));
      const fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0096C7, transparent: true, opacity: 0.12, depthWrite: false }));
      wire.scale.set(1, 1.25, 1); fill.scale.copy(wire.scale);
      grp.add(wire, fill);
      if (fusion) {
        // cúpula interior vermelha e dourada, a rodar ao contrário
        const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.56, 1), new THREE.MeshBasicMaterial({ color: YC.T3.glow(0xFF4D5E, 1.8), wireframe: true, transparent: true, opacity: 0.6 }));
        inner.scale.set(1, 1.2, 1);
        grp.add(inner);
        if (window.gsap) window.gsap.to(inner.rotation, { y: -Math.PI * 2, x: Math.PI, duration: 5, repeat: -1, ease: 'none' });
      }
      // faíscas em órbita (os sprites do palco; ficam vivos enquanto a barreira existir)
      if (this.sprite) for (let i = 0; i < (fusion ? 8 : 6); i++) {
        const s = this.sprite(fusion ? (i % 2 ? 0xD90429 : 0x48CAE4) : (i % 2 ? 0x48CAE4 : 0xffffff), 0.22, 0.9);
        const a = (i / (fusion ? 8 : 6)) * Math.PI * 2;
        s.position.set(Math.cos(a) * 0.8, (i % 3 - 1) * 0.35, Math.sin(a) * 0.8);
        grp.add(s);
      }
      if (window.gsap) {
        window.gsap.to(grp.rotation, { y: Math.PI * 2, duration: 7, repeat: -1, ease: 'none' });
        window.gsap.to(wire.material, { opacity: 0.35, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      }
      return grp;
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
