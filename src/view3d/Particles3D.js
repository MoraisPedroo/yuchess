/* Particles3D.js — efeitos de partículas no palco 3D (acrescenta métodos ao Board3D): faíscas que brilham
   (passam no bloom), estilhaços com gravidade e ressalto, fumo, rasto atrás das peças em movimento,
   texto néon a subir ("POW!"), clarões de luz e tremor de câmara. Tudo atualizado no tick do Board3D. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const T3 = () => YC.T3;
  const speed = () => (YC.FX && YC.FX.speed) || 1;

  function softTex() {
    return T3().canvasTex('softDot', 64, 64, (g, w) => {
      const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, w);
    });
  }
  function smokeTex() {
    return T3().canvasTex('smoke', 128, 128, (g, w) => {
      for (let i = 0; i < 14; i++) {
        const x = w / 2 + (Math.random() - 0.5) * w * 0.4, y = w / 2 + (Math.random() - 0.5) * w * 0.4, r = w * (0.18 + Math.random() * 0.16);
        const grd = g.createRadialGradient(x, y, 0, x, y, r);
        grd.addColorStop(0, 'rgba(255,255,255,.35)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    });
  }

  Object.assign(YC.Board3D.prototype, {
    fxInit() {
      if (this.parts) return;
      this.parts = [];
      this.fxGroup = new (T().Group)();
      this.scene.add(this.fxGroup);
    },

    /** Camada dos efeitos (o mark() limpa a camada das marcas a cada atualização). */
    fxLayer() { this.fxInit(); return this.fxGroup; },

    /** Marcador do alvo enquanto se arrasta uma carta: verde se dá para largar, vermelho se não. */
    dropMark(sq, ok) {
      const THREE = T();
      if (!this.dropM) {
        const g = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.48, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.6, 32, 1, true), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        col.position.y = 0.8;
        ring.raycast = col.raycast = () => {};
        g.add(ring, col);
        g.userData = { ring, col };
        this.scene.add(g);
        this.dropM = g;
      }
      const g = this.dropM;
      if (sq == null || sq < 0) { g.visible = false; return; }
      const p = this.sqWorld(sq), hex = ok ? 0x7CFF9B : 0xFF3355;
      g.position.set(p.x, 0, p.z);
      g.visible = true;
      g.userData.ring.material.color.copy(T3().glow(hex, 2.2));
      g.userData.col.material.color.copy(T3().glow(hex, 1.2));
    },

    /** Avança todas as partículas (chamado pelo tick com o intervalo em segundos). */
    fxStep(dt) {
      if (!this.parts || !this.parts.length) return;
      const s = speed();
      dt *= s;
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.age += dt;
        const k = p.age / p.life;
        if (k >= 1) { this.fxGroup.remove(p.o); if (p.dispose) p.o.material.dispose(); this.parts.splice(i, 1); continue; }
        if (p.v) {
          p.v.y -= (p.g || 0) * dt;
          p.v.multiplyScalar(1 - (p.drag || 0) * dt);
          p.o.position.addScaledVector(p.v, dt);
          if (p.bounce && p.o.position.y < 0.03 && p.v.y < 0) { p.o.position.y = 0.03; p.v.y *= -p.bounce; p.v.x *= 0.6; p.v.z *= 0.6; }
        }
        if (p.spin) { p.o.rotation.x += p.spin.x * dt; p.o.rotation.y += p.spin.y * dt; }
        const fade = p.fadeIn ? Math.min(1, k / p.fadeIn) * (1 - k) : 1 - k * k;
        p.o.material.opacity = p.op * fade;
        if (p.grow) p.o.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
      }
    },

    sprite(hex, size, op = 1, tex = softTex(), blend = true) {
      const THREE = T();
      const m = new THREE.SpriteMaterial({ map: tex, color: T3().glow(hex, blend ? 2.2 : 1), transparent: true, opacity: op, depthWrite: false, blending: blend ? THREE.AdditiveBlending : THREE.NormalBlending });
      const s = new THREE.Sprite(m);
      s.scale.setScalar(size);
      return s;
    },

    /** Explosão de faíscas a brilhar. */
    sparks(x, y, z, hex = 0x00E5FF, { n = 26, speed: sp = 3.2, life = 0.9, size = 0.24, g = 5, up = 1.2 } = {}) {
      this.fxInit();
      const THREE = T();
      for (let i = 0; i < n; i++) {
        const s = this.sprite(i % 4 === 0 ? 0xffffff : hex, size * (0.6 + Math.random() * 0.8));
        s.position.set(x, y, z);
        const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9;
        const v = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e) + up * 0.5, Math.sin(a) * Math.cos(e)).multiplyScalar(sp * (0.4 + Math.random() * 0.8));
        this.fxGroup.add(s);
        this.parts.push({ o: s, v, g, drag: 1.2, age: 0, life: life * (0.6 + Math.random() * 0.6), op: 1, dispose: true });
      }
    },

    /** Estilhaços sólidos (peças partidas, escudos, gelo) com ressalto no chão. */
    shards3D(x, y, z, hex, { n = 14, size = 0.1, sp = 2.6, glow = false } = {}) {
      this.fxInit();
      const THREE = T();
      const mat = glow ? new THREE.MeshBasicMaterial({ color: T3().glow(hex, 2), transparent: true })
        : new THREE.MeshStandardMaterial({ color: hex, roughness: 0.35, metalness: 0.1, transparent: true });
      const geo = this.shardGeo || (this.shardGeo = new THREE.TetrahedronGeometry(1));
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, mat.clone());
        m.scale.setScalar(size * (0.5 + Math.random()));
        m.position.set(x, y, z);
        const a = Math.random() * Math.PI * 2;
        const v = new THREE.Vector3(Math.cos(a), 1 + Math.random() * 1.4, Math.sin(a)).multiplyScalar(sp * (0.5 + Math.random() * 0.6));
        this.fxGroup.add(m);
        this.parts.push({ o: m, v, g: 9, bounce: 0.35, drag: 0.4, spin: { x: (Math.random() - 0.5) * 18, y: (Math.random() - 0.5) * 18 }, age: 0, life: 1.4 + Math.random() * 0.5, op: 1, dispose: true });
      }
    },

    smoke3D(x, y, z, hex = 0xC9C2E8, { n = 7, size = 0.7, life = 1.3 } = {}) {
      this.fxInit();
      const THREE = T();
      for (let i = 0; i < n; i++) {
        const s = this.sprite(hex, size, 0.6, smokeTex(), false);
        s.material.color.set(hex);
        s.position.set(x + (Math.random() - 0.5) * 0.4, y + Math.random() * 0.2, z + (Math.random() - 0.5) * 0.4);
        const v = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8);
        this.fxGroup.add(s);
        this.parts.push({ o: s, v, g: 0, drag: 1.5, age: 0, life, op: 0.75, grow: true, s0: size * 0.5, s1: size * 1.6, fadeIn: 0.15, dispose: true });
      }
    },

    /** Um ponto do rasto (chamado a cada frame durante o salto). */
    trail(x, y, z, hex) {
      this.fxInit();
      const s = this.sprite(hex, 0.32, 0.7);
      s.position.set(x, y, z);
      this.fxGroup.add(s);
      this.parts.push({ o: s, age: 0, life: 0.45, op: 0.7, grow: true, s0: 0.32, s1: 0.05, dispose: true });
    },

    /** Texto néon que sobe e desaparece (passa no bloom). */
    text3D(x, y, z, text, color = '#FF4F9A', size = 1.3) {
      this.fxInit();
      const THREE = T();
      const tex = T3().canvasTex(null, 512, 160, (g, w, h) => {
        g.font = '900 104px Orbitron, "Chakra Petch", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineJoin = 'round';
        g.lineWidth = 18; g.strokeStyle = '#0a0418'; g.strokeText(text, w / 2, h / 2);
        g.shadowColor = color; g.shadowBlur = 26;
        g.lineWidth = 6; g.strokeStyle = color; g.strokeText(text, w / 2, h / 2);
        const grd = g.createLinearGradient(0, h * 0.2, 0, h * 0.8); grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, color);
        g.fillStyle = grd; g.fillText(text, w / 2, h / 2);
      });
      const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(1.12, 1.12, 1.12), transparent: true, depthTest: false });
      const s = new THREE.Sprite(m);
      s.position.set(x, y, z);
      s.renderOrder = 20;
      s.scale.set(size * 3.2 * 0.2, size * 0.2, 1);
      this.fxGroup.add(s);
      this.parts.push({ o: s, v: new THREE.Vector3(0, 0.55, 0), age: 0, life: 1.5, op: 1, fadeIn: 0.06, dispose: true });
      if (window.gsap) window.gsap.to(s.scale, { x: size * 3.2, y: size, duration: 0.35 / speed(), ease: 'back.out(2.6)' });
    },

    /** Clarão de luz real (ilumina as peças à volta). */
    lightFlash(x, y, z, hex = 0xffffff, power = 6, dur = 0.6) {
      const THREE = T();
      // intensidade moderada: com a exposição alta do palco, mais do que isto lava as peças de branco
      const l = new THREE.PointLight(hex, power * 0.35, 4.5, 1.8);
      l.position.set(x, y, z);
      this.scene.add(l);
      if (!window.gsap) { this.scene.remove(l); return; }
      window.gsap.to(l, { intensity: 0, duration: dur / speed(), ease: 'power2.out', onComplete: () => { this.scene.remove(l); l.dispose && l.dispose(); } });
    },

    /** Tremor da câmara (melhor do que abanar o canvas). */
    shakeCam(power = 0.12, dur = 0.35) {
      if (!window.gsap) return;
      const cam = this.camera, base = cam.position.clone(), o = { t: 0 };
      window.gsap.to(o, { t: 1, duration: dur / speed(), ease: 'none',
        onUpdate: () => { const k = (1 - o.t) * power; cam.position.set(base.x + (Math.random() - 0.5) * k, base.y + (Math.random() - 0.5) * k, base.z + (Math.random() - 0.5) * k); },
        onComplete: () => cam.position.copy(base) });
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
