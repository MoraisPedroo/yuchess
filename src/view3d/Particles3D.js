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

  // desenhos de efeitos gerados (assets/fx/*.png, lista em FxArtList.js); sem eles usa-se só o brilho em canvas
  const artTex = new Map();
  function art(name) {
    if (!(YC.FX_ART || []).includes(name)) return null;
    if (!artTex.has(name)) {
      const THREE = T(), t = new THREE.TextureLoader().load(YC.asset(`assets/fx/${name.toLowerCase()}.png`));
      t.colorSpace = THREE.SRGBColorSpace;
      artTex.set(name, t);
    }
    return artTex.get(name);
  }
  const backOut = (k) => { const c = 1.9; k -= 1; return 1 + (c + 1) * k * k * k + c * k * k; };

  Object.assign(YC.Board3D.prototype, {
    fxInit() {
      if (this.parts) return;
      this.parts = [];
      this.fxGroup = new (T().Group)();
      this.scene.add(this.fxGroup);
      for (const n of YC.FX_ART || []) art(n); // carrega já, para não aparecerem vazios na primeira vez
    },

    /** Há desenho para este efeito? */
    hasArt(name) { return !!art(name); },

    /** Um desenho que rebenta no sítio (estrela de impacto, explosão, gelo…): cresce com ressalto, fica e desaparece. */
    burst(x, y, z, name, { size = 1.4, life = 0.9, spin = 0, rise = 0, hold = 0.55, rot = Math.random() * 0.6 - 0.3 } = {}) {
      const tex = art(name);
      if (!tex) return false;
      this.fxInit();
      const THREE = T();
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, rotation: rot });
      const s = new THREE.Sprite(m);
      s.position.set(x, y, z);
      s.renderOrder = 15;
      s.scale.setScalar(0.01);
      this.fxGroup.add(s);
      this.parts.push({ o: s, v: rise ? new THREE.Vector3(0, rise, 0) : null, age: 0, life, op: 1, hold, pop: size, rotSpd: spin, dispose: true });
      return true;
    },

    /** Vários desenhos pequenos a voar (estrelas, moedas, cacos de vidro, confetes), a rodar, com gravidade. */
    scatter(x, y, z, name, { n = 8, size = 0.32, speed: sp = 2.6, life = 1.2, g = 5, up = 1.3 } = {}) {
      const tex = art(name);
      if (!tex) return false;
      this.fxInit();
      const THREE = T();
      for (let i = 0; i < n; i++) {
        const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, rotation: Math.random() * 6.28 });
        const s = new THREE.Sprite(m);
        s.scale.setScalar(size * (0.65 + Math.random() * 0.7));
        s.position.set(x, y, z);
        s.renderOrder = 12;
        const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9;
        const v = new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e) + up * 0.5, Math.sin(a) * Math.cos(e)).multiplyScalar(sp * (0.45 + Math.random() * 0.7));
        this.fxGroup.add(s);
        this.parts.push({ o: s, v, g, drag: 1, age: 0, life: life * (0.7 + Math.random() * 0.5), op: 1, hold: 0.6, rotSpd: (Math.random() - 0.5) * 8, dispose: true });
      }
      return true;
    },

    /** Desenho deitado no chão (círculo mágico): abre, roda e apaga-se. */
    decal(x, z, name, { size = 1.6, life = 1.4, spin = 1.2, y = 0.05 } = {}) {
      const tex = art(name);
      if (!tex) return false;
      this.fxInit();
      const THREE = T();
      const m = new THREE.Mesh(this.decalGeo || (this.decalGeo = new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: T3().glow(0xffffff, 1.15) }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.scale.setScalar(0.01);
      m.raycast = () => {};
      this.fxGroup.add(m);
      this.parts.push({ o: m, age: 0, life, op: 1, hold: 0.6, pop: size, flatSpin: spin, dispose: true });
      return true;
    },

    /** Compila no arranque os shaders de todos os efeitos e guarda os materiais de amostra: sem eles, o
        primeiro estilhaço/feixe/armadilha (e o primeiro depois de os anteriores desaparecerem) congelava o jogo. */
    fxWarmUp() {
      const THREE = T();
      this.fxInit();
      const geo = new THREE.BoxGeometry(0.001, 0.001, 0.001), tex = softTex();
      const mats = [
        new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false }),
        new THREE.MeshBasicMaterial({ transparent: true }),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
        new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.35 })
      ];
      const tmp = new THREE.Group();
      for (const m of mats) tmp.add(new THREE.Mesh(geo, m));
      tmp.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial()));
      const sp = [new THREE.SpriteMaterial({ map: tex, transparent: true }), new THREE.SpriteMaterial({ map: tex, depthTest: false })];
      for (const m of sp) tmp.add(new THREE.Sprite(m));
      const out = new THREE.Mesh(geo, T3().outlineMat(0.014));
      tmp.add(out);
      tmp.traverse((o) => { if (o.isSprite) o.scale.setScalar(0.001); o.frustumCulled = false; });
      // um quadro a sério (pelo composer): o renderer.compile compilava a versão do ecrã e não a do bloom
      this.scene.add(tmp);
      try { this.composer.render(); } catch (e) { /* sem aquecimento */ }
      this.scene.remove(tmp);
      this.warm = tmp; // fica guardado: libertar estes materiais apagava os programas compilados
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
        if (p.rotSpd) p.o.material.rotation += p.rotSpd * dt;
        if (p.flatSpin) p.o.rotation.z += p.flatSpin * dt;
        const fade = p.hold != null ? (k < p.hold ? 1 : 1 - (k - p.hold) / (1 - p.hold))
          : p.fadeIn ? Math.min(1, k / p.fadeIn) * (1 - k) : 1 - k * k;
        p.o.material.opacity = p.op * fade;
        if (p.grow) p.o.scale.setScalar(p.s0 + (p.s1 - p.s0) * k);
        // "pop": cresce depressa com ressalto (primeiros 22 %) e depois alarga devagar
        if (p.pop) p.o.scale.setScalar(p.pop * (k < 0.22 ? Math.max(0.01, backOut(k / 0.22)) : 1 + (k - 0.22) * 0.12));
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
      // e algumas estrelinhas desenhadas por cima do brilho
      if (n >= 10) this.scatter(x, y, z, 'SPARKLE', { n: Math.round(n / 5), size: size * 1.5, speed: sp * 0.8, life, g: g * 0.8, up });
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
      // nuvem desenhada (assets/fx/smoke.png) se existir; senão a mancha em canvas
      const drawn = art('SMOKE');
      for (let i = 0; i < n; i++) {
        const s = this.sprite(hex, size, 0.6, drawn || smokeTex(), false);
        s.material.color.set(drawn ? 0xffffff : hex);
        s.material.rotation = Math.random() * 6.28;
        s.position.set(x + (Math.random() - 0.5) * 0.4, y + Math.random() * 0.2, z + (Math.random() - 0.5) * 0.4);
        const v = new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.8);
        this.fxGroup.add(s);
        this.parts.push({ o: s, v, g: 0, drag: 1.5, age: 0, life, op: drawn ? 0.9 : 0.75, grow: true, s0: size * 0.5, s1: size * (drawn ? 1.3 : 1.6), fadeIn: 0.15, rotSpd: (Math.random() - 0.5) * 1.5, dispose: true });
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
      // usa uma das luzes fixas do palco (acrescentar luzes recompila os shaders todos)
      const pool = this.flashLights;
      if (!pool || !window.gsap) return;
      const l = pool[this.flashNext++ % pool.length];
      window.gsap.killTweensOf(l);
      // intensidade moderada: com a exposição alta do palco, mais do que isto lava as peças de branco
      l.color.set(hex); l.position.set(x, y, z); l.intensity = power * 0.35;
      window.gsap.to(l, { intensity: 0, duration: dur / speed(), ease: 'power2.out' });
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
