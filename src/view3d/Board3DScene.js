/* Board3DScene.js — constrói a arena 3D (acrescenta métodos ao Board3D): fundo de estádio, mesa com brilho,
   moldura metálica com tubo néon (ciano à frente/esquerda, magenta atrás/direita), casas de vidro escuro,
   grelha luminosa, círculo mágico rotativo ao centro (shader), Zonas de Armadilhas e pilhas de baralho/cemitério. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const T3 = () => YC.T3;
  const SLOT = { w: 1.05, d: 1.47 };

  function stadium() {
    return T3().canvasTex('stadium', 1280, 720, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#05051a'); bg.addColorStop(0.42, '#160d40'); bg.addColorStop(0.75, '#0b0a2a'); bg.addColorStop(1, '#050714');
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      // bancadas em arco com faixas néon
      for (let i = 0; i < 9; i++) {
        const y = 120 + i * 30;
        g.strokeStyle = i % 3 === 0 ? 'rgba(181,55,242,.55)' : 'rgba(0,229,255,.18)';
        g.lineWidth = i % 3 === 0 ? 3 : 1.5;
        g.beginPath(); g.ellipse(w / 2, y + 380, w * 0.75, 420, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
      }
      // público (pontinhos e ecrãs de telemóvel)
      for (let i = 0; i < 900; i++) {
        const x = Math.random() * w, y = 110 + Math.random() * 250;
        g.fillStyle = Math.random() < 0.06 ? (Math.random() < 0.5 ? 'rgba(0,229,255,.8)' : 'rgba(245,56,160,.8)') : 'rgba(8,8,24,.85)';
        g.beginPath(); g.arc(x, y, 1.5 + Math.random() * 2.5, 0, Math.PI * 2); g.fill();
      }
      // holofotes
      const beam = (x, ang, col) => {
        g.save(); g.translate(x, -20); g.rotate(ang);
        const gr = g.createLinearGradient(0, 0, 0, h * 0.9); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.lineTo(150, h * 0.9); g.lineTo(-150, h * 0.9); g.fill(); g.restore();
      };
      beam(w * 0.14, -0.35, 'rgba(197,138,249,.35)'); beam(w * 0.86, 0.35, 'rgba(0,229,255,.3)');
      beam(w * 0.36, -0.12, 'rgba(0,229,255,.18)'); beam(w * 0.64, 0.12, 'rgba(197,138,249,.2)');
      const glow = g.createRadialGradient(w / 2, h * 0.62, 20, w / 2, h * 0.62, w * 0.5);
      glow.addColorStop(0, 'rgba(123,66,246,.45)'); glow.addColorStop(1, 'rgba(123,66,246,0)');
      g.fillStyle = glow; g.fillRect(0, 0, w, h);
    });
  }

  const CREST_FRAG = `
    varying vec2 vUv; uniform float uTime;
    float ring(float r, float c, float w) { return smoothstep(w, 0.0, abs(r - c)); }
    void main() {
      vec2 p = (vUv - 0.5) * 2.0; float r = length(p); float a = atan(p.y, p.x);
      float rot = a + uTime * 0.08, rot2 = a - uTime * 0.12;
      float rings = ring(r, 0.92, 0.018) + ring(r, 0.86, 0.008) + ring(r, 0.62, 0.016) + ring(r, 0.4, 0.01);
      float runes = step(0.66, r) * step(r, 0.84) * smoothstep(0.06, 0.0, abs(fract(rot * 6.0 / 3.14159) - 0.5) - 0.38);
      float ticks = step(0.86, r) * step(r, 0.92) * step(0.7, fract(rot2 * 36.0 / 6.28318));
      float spokes = step(0.4, r) * step(r, 0.62) * smoothstep(0.02, 0.0, abs(sin(rot2 * 4.0)));
      float hexa = step(r, 0.4) * smoothstep(0.015, 0.0, abs(max(abs(p.x) * 0.866 + abs(p.y) * 0.5, abs(p.y)) - 0.3));
      vec3 col = mix(vec3(0.0, 0.94, 1.0), vec3(0.62, 0.0, 1.0), smoothstep(0.3, 1.0, r));
      float alpha = clamp(rings + runes * 0.55 + ticks * 0.6 + spokes * 0.5 + hexa * 0.8, 0.0, 1.0) * 0.62;
      alpha *= smoothstep(1.0, 0.95, r);
      gl_FragColor = vec4(col * 1.7, alpha);
    }`;

  Object.assign(YC.Board3D.prototype, {
    /** Estádio desenhado com o Gemini (assets/arena/stadium.jpg); até carregar fica o fundo feito em canvas. */
    loadStadium() {
      const THREE = T();
      new THREE.TextureLoader().load(YC.asset('assets/arena/stadium.jpg'), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        this.bgTex = tex;
        this.scene.background = tex;
        this.scene.backgroundIntensity = 0.8;
        // o chão passa a véu escuro: vê-se o estádio por baixo do tabuleiro
        if (this.floor) { const m = this.floor.material; m.transparent = true; m.opacity = 0.3; m.depthWrite = false; m.needsUpdate = true; }
        if (this.underGlow) this.underGlow.material.opacity = 0.4;
        this.fitBackground();
      });
    },

    /** "Cover": a imagem enche o ecrã sem deformar, em paisagem e no telemóvel na vertical. */
    fitBackground() {
      const t = this.bgTex;
      if (!t || !t.image) return;
      const A = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight), I = t.image.width / t.image.height;
      if (A > I) { t.repeat.set(1, I / A); t.offset.set(0, (1 - I / A) / 2); } else { t.repeat.set(A / I, 1); t.offset.set((1 - A / I) / 2, 0); }
    },

    buildArena() {
      const THREE = T(), scene = this.scene;
      this.pickables = [];
      scene.background = stadium();
      this.loadStadium();

      const floor = this.floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 50), new THREE.MeshStandardMaterial({ color: 0x080a22, roughness: 0.55, metalness: 0.35 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -0.34;
      const under = this.underGlow = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), new THREE.MeshBasicMaterial({ map: T3().radial(0x7B42F6, 'floorGlow'), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending }));
      under.rotation.x = -Math.PI / 2; under.position.y = -0.33;
      scene.add(floor, under);

      // moldura metálica e laje
      const frame = new THREE.Mesh(new THREE.BoxGeometry(8.75, 0.3, 8.75), new THREE.MeshStandardMaterial({ color: 0x121829, metalness: 0.85, roughness: 0.28 }));
      frame.position.y = -0.17;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(8.08, 0.04, 8.08), new THREE.MeshStandardMaterial({ color: 0x02041a, roughness: 0.4 }));
      slab.position.y = -0.04;
      scene.add(frame, slab);
      const tube = (len, x, z, rotY, hex, k = 2.4) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.07, 0.07), T3().basic(hex, k));
        m.position.set(x, -0.0, z); m.rotation.y = rotY; scene.add(m);
      };
      tube(8.75, 0, 4.34, 0, 0x00F0FF); tube(8.75, -4.34, 0, Math.PI / 2, 0x00F0FF);
      tube(8.75, 0, -4.34, 0, 0xFF00AA, 4.5); tube(8.75, 4.34, 0, Math.PI / 2, 0xD900FF, 4.5);

      // casas (2 InstancedMesh) — matrizes em placeSquares()
      const sqGeo = new THREE.BoxGeometry(0.97, 0.05, 0.97);
      const light = new THREE.MeshStandardMaterial({ color: 0x27307a, emissive: 0x2A1F6D, emissiveIntensity: 0.35, roughness: 0.42, metalness: 0.25, transparent: true, opacity: 0.9 });
      const dark = new THREE.MeshStandardMaterial({ color: 0x070b20, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.94 });
      this.sqLight = new THREE.InstancedMesh(sqGeo, light, 32);
      this.sqDark = new THREE.InstancedMesh(sqGeo, dark, 32);
      this.sqLight.userData.sqs = []; this.sqDark.userData.sqs = [];
      scene.add(this.sqLight, this.sqDark);
      this.pickables.push(this.sqLight, this.sqDark);
      this.placeSquares();

      // grelha luminosa: ciano à frente, roxo atrás (uma só malha com cores por vértice)
      const pos = [], col = [];
      const c1 = T3().glow(0x00E5FF, 1.35), c2 = T3().glow(0xB537F2, 1.9);
      const colorAt = (z) => c1.clone().lerp(c2, (4 - z) / 8);
      const quad = (x1, z1, x2, z2, wdt) => {
        const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), nx = (-dz / L) * wdt / 2, nz = (dx / L) * wdt / 2, y = 0.006;
        const v = [[x1 + nx, z1 + nz], [x1 - nx, z1 - nz], [x2 + nx, z2 + nz], [x2 - nx, z2 - nz]];
        for (const i of [0, 1, 2, 2, 1, 3]) { pos.push(v[i][0], y, v[i][1]); const c = colorAt(v[i][1]); col.push(c.r, c.g, c.b); }
      };
      for (let i = 0; i <= 8; i++) {
        const o = i - 4;
        quad(-4, o, 4, o, i === 0 || i === 8 ? 0.06 : 0.026);
        for (let k = 0; k < 8; k++) quad(o, -4 + k, o, -3 + k, i === 0 || i === 8 ? 0.06 : 0.026);
      }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const grid = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      grid.raycast = () => {};
      scene.add(grid);

      // círculo mágico central
      this.crest = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: CREST_FRAG
      }));
      this.crest.rotation.x = -Math.PI / 2; this.crest.position.y = 0.004;
      this.crest.raycast = () => {};
      scene.add(this.crest);

      this.layers = { pieces: new THREE.Group(), marks: new THREE.Group(), traps: new THREE.Group(), sides: new THREE.Group() };
      Object.values(this.layers).forEach((l) => scene.add(l));
      this.buildSides();
    },

    placeSquares() {
      const THREE = T(), m = new THREE.Matrix4();
      let li = 0, di = 0;
      for (let sq = 0; sq < 64; sq++) {
        const p = this.sqWorld(sq), isLight = ((sq >> 3) + (sq & 7)) % 2 === 0;
        m.makeTranslation(p.x, -0.025, p.z);
        if (isLight) { this.sqLight.setMatrixAt(li, m); this.sqLight.userData.sqs[li++] = sq; }
        else { this.sqDark.setMatrixAt(di, m); this.sqDark.userData.sqs[di++] = sq; }
      }
      this.sqLight.instanceMatrix.needsUpdate = true;
      this.sqDark.instanceMatrix.needsUpdate = true;
      this.sqLight.computeBoundingSphere(); this.sqDark.computeBoundingSphere();
    },

    /** Lugares da Zona (3 por jogador), baralho e cemitério, com etiquetas no chão. */
    buildSides() {
      const THREE = T();
      const flat = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; return m; };
      const slotGeo = new THREE.PlaneGeometry(SLOT.w, SLOT.d), cardGeo = new THREE.PlaneGeometry(SLOT.w * 0.88, SLOT.d * 0.88);
      this.side = {};
      for (const rel of ['me', 'opp']) {
        const color = rel === 'me' ? '#00E5FF' : '#FF1E42';
        const s = { slots: [], deck: null, gy: null };
        for (let i = 0; i < 3; i++) {
          const mat = new THREE.MeshBasicMaterial({ map: T3().slot(color), color: T3().glow(0xffffff, 1.25), transparent: true, depthWrite: false });
          const base = flat(slotGeo, mat);
          base.position.y = 0.01;
          const card = flat(cardGeo, new THREE.MeshStandardMaterial({ map: T3().cardBack(), roughness: 0.4, metalness: 0.1, emissive: 0x000000 }));
          card.position.y = 0.03;
          card.visible = false;
          const zz = new THREE.Sprite(new THREE.SpriteMaterial({ map: T3().label('zZ', '#C58AF9'), depthTest: false }));
          zz.scale.set(0.55, 0.28, 1); zz.position.y = 0.5; zz.visible = false;
          const grp = new THREE.Group();
          grp.add(base, card, zz);
          grp.userData.pick = { kind: 'zone', rel, i };
          this.layers.sides.add(grp);
          this.pickables.push(grp);
          s.slots.push({ grp, base, card, zz, mat });
        }
        const deck = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(SLOT.w * 0.88, 1, SLOT.d * 0.88), [
          ...Array(2).fill(new THREE.MeshStandardMaterial({ color: 0x2a1a4a, roughness: 0.6 })),
          new THREE.MeshStandardMaterial({ map: T3().cardBack(), roughness: 0.4, emissive: 0x1a0a40, emissiveIntensity: 0.4 }),
          new THREE.MeshStandardMaterial({ color: 0x120820 }),
          ...Array(2).fill(new THREE.MeshStandardMaterial({ color: 0x2a1a4a, roughness: 0.6 }))
        ]);
        const deckCount = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
        deckCount.scale.set(0.6, 0.3, 1);
        deck.add(box, deckCount);
        deck.userData.pick = { kind: 'pile', pile: 'deck', rel };
        const gy = new THREE.Group();
        const gyBase = flat(slotGeo, new THREE.MeshBasicMaterial({ map: T3().slot('#9D4EDD'), color: T3().glow(0xffffff, 1.1), transparent: true, depthWrite: false }));
        gyBase.position.y = 0.01;
        const gyCard = flat(cardGeo, new THREE.MeshStandardMaterial({ roughness: 0.5, color: 0xbbbbcc }));
        gyCard.position.y = 0.03; gyCard.visible = false;
        const gyCount = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false }));
        gyCount.scale.set(0.6, 0.3, 1); gyCount.position.y = 0.45;
        gy.add(gyBase, gyCard, gyCount);
        gy.userData.pick = { kind: 'pile', pile: 'gy', rel };
        this.layers.sides.add(deck, gy);
        this.pickables.push(deck, gy);
        Object.assign(s, { deck, box, deckCount, gy, gyCard, gyCount });
        this.side[rel] = s;
      }
      const text = (t, color) => { const m = flat(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: T3().textLabel(t, color), transparent: true, depthWrite: false })); m.raycast = () => {}; this.layers.sides.add(m); return m; };
      this.sideLabels = { zone: text('Zona de Armadilhas', '#59E1FF'), deck: text('Baralho', '#9FDFFF'), gy: text('Cemitério', '#C58AF9') };
    },

    /** Posições das zonas: dos lados do tabuleiro (paisagem) ou em filas por cima/baixo (telemóvel). */
    layoutSides() {
      if (!this.side) return;
      const P = this.portrait;
      for (const rel of ['me', 'opp']) {
        const s = this.side[rel], sign = rel === 'me' ? 1 : -1;
        s.slots.forEach((slot, i) => {
          if (P) slot.grp.position.set(-3.45 + i * 1.2, 0, sign * 5.2);
          else slot.grp.position.set(-5.45, 0, sign * (0.95 + i * 1.55));
          slot.grp.rotation.y = rel === 'opp' ? Math.PI : 0;
        });
        if (P) { s.gy.position.set(1.9, 0, sign * 5.2); s.deck.position.set(3.3, 0, sign * 5.2); }
        else { s.gy.position.set(5.45, 0, sign * 1.85); s.deck.position.set(5.45, 0, sign * 3.65); }
        s.gy.rotation.y = s.deck.rotation.y = rel === 'opp' ? Math.PI : 0;
      }
      const L = this.sideLabels;
      L.zone.visible = L.deck.visible = L.gy.visible = !P;
      L.zone.position.set(-5.45, 0.01, -0.0); L.zone.rotation.z = Math.PI / 2; L.zone.scale.set(0.7, 0.7, 1);
      L.zone.visible = false;
      L.deck.position.set(5.45, 0.01, 2.75); L.deck.scale.set(0.55, 0.55, 1);
      L.gy.position.set(5.45, 0.01, 0.92); L.gy.scale.set(0.55, 0.55, 1);
    },

    /** Retângulo no ecrã de um lugar da Zona ou de uma pilha. */
    objRect(t) {
      const s = this.side[t.rel];
      const o = t.kind === 'zone' ? s.slots[t.i].grp : t.pile === 'deck' ? s.deck : s.gy;
      return this.areaRect(o.position.x, o.position.z, SLOT.w, SLOT.d);
    },

    relOf(team) { return team === this.viewer ? 'me' : 'opp'; },
    deckRect(team) { return this.objRect({ kind: 'pile', pile: 'deck', rel: this.relOf(team) }); },
    gyRect(team) { return this.objRect({ kind: 'pile', pile: 'gy', rel: this.relOf(team) }); },
    zoneSlotRect(team, used) { return this.objRect({ kind: 'zone', rel: this.relOf(team), i: Math.min(2, used || 0) }); },
    zoneRect(team) { const r = this.relOf(team), a = this.objRect({ kind: 'zone', rel: r, i: 0 }), b = this.objRect({ kind: 'zone', rel: r, i: 2 }); const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top); return { left, top, width: Math.max(a.right, b.right) - left, height: Math.max(a.bottom, b.bottom) - top }; }
  });

  YC.Board3D.SLOT = SLOT;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
