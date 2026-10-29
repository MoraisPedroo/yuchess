/* Board3DStatus.js — estados da expansão no tabuleiro 3D (acrescenta métodos ao Board3D):
   casas bloqueadas (barreira com listras de aviso) e a etiqueta de estado por cima da peça
   (equipamentos desligados, sem ataque, presa). Chamado pelo sync() do Board3DSync. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const T3 = () => YC.T3;
  const TAG = [['untargetable', 'PRESA', '#FB8500'], ['noCap', 'SEM ATAQUE', '#F8FAFC'], ['silenced', 'DESLIGADA', '#94A3B8']];

  /** Textura de barreira: listras amarelas e escuras na diagonal, com contorno. */
  const barrierTex = () => T3().canvasTex('barrier', 128, 128, (g, w) => {
    g.fillStyle = '#0F141C'; g.fillRect(0, 0, w, w);
    g.save(); g.beginPath(); g.rect(8, 8, w - 16, w - 16); g.clip();
    g.fillStyle = '#FFB703';
    for (let x = -w; x < w * 2; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, 0); g.lineTo(x + 16 - w, w); g.lineTo(x - w, w); g.closePath(); g.fill(); }
    g.restore();
    g.lineWidth = 8; g.strokeStyle = '#0F141C'; g.strokeRect(4, 4, w - 8, w - 8);
  });

  Object.assign(YC.Board3D.prototype, {
    syncBlocks(m) {
      const THREE = T(), list = (m.pos.blocked || []).slice().sort((a, b) => a - b), key = list.join(',') + this.flipped;
      if (this.blockKey === key) return;
      this.blockKey = key;
      if (!this.blockLayer) { this.blockLayer = new THREE.Group(); this.layers.traps.parent.add(this.blockLayer); }
      this.blockLayer.clear();
      for (const sq of list) {
        const p = this.sqWorld(sq);
        const mat = new THREE.MeshBasicMaterial({ map: barrierTex() });
        const plate = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.08, 0.86), mat);
        plate.position.set(p.x, 0.06, p.z);
        // dois pinos de vinil nos cantos, para se ler como obstáculo
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 12), T3().basic(0xFFB703, 1));
          post.position.set(s * 0.32, 0.2, s * 0.32);
          plate.add(post);
        }
        plate.raycast = () => {};
        this.blockLayer.add(plate);
      }
    },

    /** Ameaça na janela de resposta: anel vermelho na casa em perigo, anel laranja em quem ataca e seta entre
        os dois. Fica numa camada própria (o mark() limpa layers.marks) até clearThreat(). */
    showThreat(pairs) {
      const THREE = T();
      this.clearThreat();
      if (!this.threatLayer) { this.threatLayer = new THREE.Group(); this.layers.traps.parent.add(this.threatLayer); }
      const ring = (sq, hex) => {
        const p = this.sqWorld(sq);
        const r = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.47, 40), new THREE.MeshBasicMaterial({ color: T3().glow(hex, 1.25), transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
        r.rotation.x = -Math.PI / 2; r.position.set(p.x, 0.035, p.z); r.raycast = () => {};
        this.threatLayer.add(r);
        return r;
      };
      const pulse = [];
      for (const { from, to } of pairs) {
        if (to >= 0) pulse.push(ring(to, 0xD90429));
        if (from < 0 || from === to) continue;
        pulse.push(ring(from, 0xFB8500));
        const a = this.sqWorld(from), b = this.sqWorld(to), dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        const shape = new THREE.Shape(), L = len - 0.5, w = 0.09;
        shape.moveTo(0.3, -w); shape.lineTo(L, -w); shape.lineTo(L, -0.22); shape.lineTo(len - 0.2, 0); shape.lineTo(L, 0.22); shape.lineTo(L, w); shape.lineTo(0.3, w); shape.closePath();
        const arrow = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: T3().glow(0xD90429, 1.2), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
        arrow.rotation.x = -Math.PI / 2; arrow.rotation.z = Math.atan2(-dz, dx); arrow.position.set(a.x, 0.045, a.z); arrow.raycast = () => {};
        this.threatLayer.add(arrow);
      }
      if (window.gsap && pulse.length) this.threatTween = window.gsap.to(pulse.map((r) => r.scale), { x: 1.18, y: 1.18, duration: 0.55, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    },

    clearThreat() {
      if (this.threatTween) { this.threatTween.kill(); this.threatTween = null; }
      if (!this.threatLayer) return;
      for (const o of this.threatLayer.children) { o.geometry.dispose(); o.material.dispose(); }
      this.threatLayer.clear();
    },

    /** Etiqueta do estado mais importante por cima da peça (ou nenhuma). */
    syncStatus(g, p, h) {
      const THREE = T(), st = TAG.find(([k]) => p[k]);
      const tag = this.accessory(g, 'statusTag', !!st, () => new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false })));
      if (!tag || !st) return;
      if (g.userData.statusKey !== st[0]) {
        g.userData.statusKey = st[0];
        tag.material.map = T3().textLabel ? T3().textLabel(st[1], st[2]) : T3().label(st[1], st[2]);
        tag.material.needsUpdate = true;
      }
      tag.scale.set(0.9, 0.225, 1);
      tag.position.set(0, h + 0.48, 0);
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
