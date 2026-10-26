/* PieceMeshes.js — peças de xadrez 3D em estilo cartoon "chibi", feitas por código (sem ficheiros externos):
   silhuetas torneadas (LatheGeometry), cabeça do Cavalo extrudida com bisel, coroas douradas, olhos que
   piscam virados para a câmara, cel-shading e contorno preto. Também cria os pedestais holográficos. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const T3 = () => YC.T3;
  const templates = new Map();
  const geos = new Map();

  const COLORS = {
    w: { body: 0xEAE4D8, shade: 0xD2E3FC, mane: 0xFF7AA8 },
    b: { body: 0x4A3A8C, shade: 0x7B42F6, mane: 0xE26DB4 }
  };
  const GOLD = 0xFCC934;

  function geo(key, make) { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); }
  function lathe(key, pts, seg = 32) { return geo(key, () => new (T().LatheGeometry)(pts.map(([r, y]) => new (T().Vector2)(r, y)), seg)); }

  // Perfis (raio, altura) — de baixo para cima
  const BASE = [[0.001, 0], [0.33, 0], [0.355, 0.035], [0.33, 0.075], [0.26, 0.1], [0.001, 0.1]];
  const BODY = {
    p: [[0.001, 0.1], [0.24, 0.1], [0.22, 0.17], [0.17, 0.27], [0.15, 0.32], [0.2, 0.35], [0.17, 0.38], [0.001, 0.39]],
    r: [[0.001, 0.1], [0.27, 0.1], [0.25, 0.2], [0.22, 0.6], [0.27, 0.68], [0.29, 0.8], [0.001, 0.8]],
    n: [[0.001, 0.1], [0.25, 0.1], [0.22, 0.18], [0.18, 0.24], [0.001, 0.25]],
    b: [[0.001, 0.1], [0.25, 0.1], [0.2, 0.2], [0.14, 0.45], [0.19, 0.52], [0.15, 0.55], [0.001, 0.56]],
    q: [[0.001, 0.1], [0.27, 0.1], [0.21, 0.24], [0.15, 0.55], [0.21, 0.66], [0.17, 0.69], [0.001, 0.7]],
    k: [[0.001, 0.1], [0.29, 0.1], [0.23, 0.25], [0.17, 0.58], [0.23, 0.7], [0.19, 0.73], [0.001, 0.74]]
  };

  function knightHead() {
    return geo('knightHead', () => {
      const THREE = T();
      const s = new THREE.Shape();
      const P = [[-0.17, 0], [-0.21, 0.24], [-0.2, 0.42], [-0.13, 0.58], [-0.04, 0.68], [-0.02, 0.8], [0.04, 0.7], [0.14, 0.64], [0.24, 0.52],
        [0.32, 0.4], [0.33, 0.33], [0.26, 0.29], [0.16, 0.31], [0.08, 0.27], [0.08, 0.14], [0.13, 0]];
      s.moveTo(P[0][0], P[0][1]);
      for (let i = 1; i < P.length; i++) {
        const [x, y] = P[i], [px, py] = P[i - 1];
        s.quadraticCurveTo(px + (x - px) * 0.15, py + (y - py) * 0.85, x, y);
      }
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 6 });
      g.translate(0, 0, -0.1);
      g.computeVertexNormals();
      return g;
    });
  }

  function eyes(y, z, spread = 0.075, size = 0.055, lashes = false) {
    const THREE = T();
    const grp = new THREE.Group();
    grp.name = 'eyes';
    const white = T3().basic(0xffffff, 1), ink = T3().basic(0x111111, 1);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(geo('eyeW', () => new THREE.SphereGeometry(1, 16, 12)), white);
      e.scale.set(size, size * 1.25, size * 0.55);
      e.position.set(sx * spread, 0, 0);
      T3().addOutline(e, 0.12);
      const p = new THREE.Mesh(geo('eyeP', () => new THREE.SphereGeometry(1, 12, 10)), ink);
      p.scale.set(size * 0.55, size * 0.65, size * 0.3);
      p.position.set(sx * spread + 0.005, -0.004, size * 0.42);
      const h = new THREE.Mesh(geo('eyeH', () => new THREE.SphereGeometry(1, 8, 6)), white);
      h.scale.setScalar(size * 0.2);
      h.position.set(sx * spread + size * 0.25, size * 0.3, size * 0.62);
      grp.add(e, p, h);
      if (lashes) {
        const l = new THREE.Mesh(geo('lash', () => new THREE.BoxGeometry(0.05, 0.012, 0.012)), ink);
        l.position.set(sx * (spread + size * 0.75), size * 1.1, 0); l.rotation.z = sx * 0.6;
        grp.add(l);
      }
    }
    grp.position.set(0, y, z);
    return grp;
  }

  function mesh(g, mat, outline = 0.014) {
    const m = new (T().Mesh)(g, mat);
    if (outline) T3().addOutline(m, outline);
    return m;
  }

  /** Molde de uma peça (partilhado e clonado para cada peça em jogo). */
  function build(type, color) {
    const THREE = T();
    const c = COLORS[color];
    const body = T3().toon(c.body, { emissive: c.shade, emissiveIntensity: color === 'b' ? 0.2 : 0.04 });
    const gold = T3().toon(GOLD, { emissive: 0x7a4b00, emissiveIntensity: 0.25 });
    const g = new THREE.Group();
    g.name = 'body';
    g.add(mesh(lathe('base', BASE), body));
    g.add(mesh(lathe(`body${type}`, BODY[type]), body));
    const sphere = (r, y, sx = 1, sy = 1) => { const m = mesh(geo('sph', () => new THREE.SphereGeometry(1, 24, 18)), body); m.scale.set(r * sx, r * sy, r * sx); m.position.y = y; return m; };
    switch (type) {
      case 'p':
        g.add(sphere(0.19, 0.52));
        g.add(eyes(0.53, 0.165, 0.07, 0.05));
        break;
      case 'r': {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const b = mesh(geo('cren', () => new THREE.BoxGeometry(0.13, 0.14, 0.13, 2, 2, 2)), body);
          b.position.set(Math.sin(a) * 0.2, 0.86, Math.cos(a) * 0.2);
          b.rotation.y = a;
          g.add(b);
        }
        g.add(eyes(0.48, 0.225, 0.085, 0.055));
        break;
      }
      case 'n': {
        const head = mesh(knightHead(), body, 0.012);
        head.position.y = 0.2;
        head.rotation.y = -0.95;
        const mane = T3().toon(c.mane);
        for (let i = 0; i < 5; i++) {
          const m = mesh(geo('mane', () => new THREE.SphereGeometry(1, 12, 10)), mane, 0.1);
          m.scale.set(0.06, 0.08, 0.06);
          m.position.set(-0.2 + i * 0.02, 0.32 + i * 0.1, 0);
          head.add(m);
        }
        const e = eyes(0.62, 0, 0.13, 0.05);
        e.rotation.y = Math.PI / 2;
        e.position.set(0.1, 0.62, 0);
        head.add(e);
        g.add(head);
        break;
      }
      case 'b': {
        g.add(sphere(0.2, 0.78, 1, 1.3));
        const slit = new THREE.Mesh(geo('slit', () => new THREE.BoxGeometry(0.03, 0.2, 0.06)), T3().basic(0x111111, 1));
        slit.position.set(0.07, 0.9, 0.14); slit.rotation.z = -0.5;
        const ball = mesh(geo('ball', () => new THREE.SphereGeometry(1, 16, 12)), gold, 0.15);
        ball.scale.setScalar(0.06); ball.position.y = 1.09;
        g.add(slit, ball, eyes(0.74, 0.18, 0.075, 0.05));
        break;
      }
      case 'q': {
        g.add(sphere(0.22, 0.9));
        const ring = mesh(geo('qring', () => new THREE.TorusGeometry(0.17, 0.035, 10, 28)), gold, 0.012);
        ring.rotation.x = Math.PI / 2; ring.position.y = 1.07;
        g.add(ring);
        const pink = T3().toon(0xF538A0);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const cone = mesh(geo('qcone', () => new THREE.ConeGeometry(0.05, 0.16, 10)), gold, 0.012);
          cone.position.set(Math.sin(a) * 0.15, 1.16, Math.cos(a) * 0.15);
          const gem = mesh(geo('gem', () => new THREE.SphereGeometry(1, 10, 8)), pink, 0.2);
          gem.scale.setScalar(0.04); gem.position.set(Math.sin(a) * 0.15, 1.26, Math.cos(a) * 0.15);
          g.add(cone, gem);
        }
        g.add(eyes(0.9, 0.2, 0.08, 0.055, true));
        break;
      }
      case 'k': {
        g.add(sphere(0.23, 0.95));
        const band = mesh(geo('kband', () => new THREE.CylinderGeometry(0.19, 0.17, 0.12, 24, 1, true)), gold, 0.012);
        band.position.y = 1.15;
        const v = mesh(geo('kv', () => new THREE.BoxGeometry(0.07, 0.26, 0.07)), gold, 0.012);
        v.position.y = 1.36;
        const h = mesh(geo('kh', () => new THREE.BoxGeometry(0.2, 0.07, 0.07)), gold, 0.012);
        h.position.y = 1.4;
        const stache = T3().toon(0x6B3E26);
        for (const sx of [-1, 1]) {
          const m = mesh(geo('stache', () => new THREE.SphereGeometry(1, 10, 8)), stache, 0.15);
          m.scale.set(0.08, 0.035, 0.04); m.position.set(sx * 0.07, 0.87, 0.21); m.rotation.z = sx * 0.3;
          g.add(m);
        }
        g.add(band, v, h, eyes(0.97, 0.205, 0.085, 0.055));
        break;
      }
    }
    return g;
  }

  const PM = {
    COLORS,
    SCALE: 0.86,
    /** Nova peça (clone do molde). */
    make(type, color) {
      const key = type + color;
      if (!templates.has(key)) templates.set(key, build(type, color));
      const g = templates.get(key).clone(true);
      g.scale.setScalar(PM.SCALE);
      g.userData.eyes = g.getObjectByName('eyes');
      return g;
    },

    /** Pedestal holográfico: disco de luz, dois anéis e cortina de energia. */
    pedestal(hex) {
      const THREE = T();
      const grp = new THREE.Group();
      grp.name = 'pedestal';
      const glowMat = new THREE.MeshBasicMaterial({ map: T3().radial(hex), color: T3().glow(0xffffff, 0.5), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
      const disc = new THREE.Mesh(geo('disc', () => new THREE.PlaneGeometry(1.15, 1.15)), glowMat);
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.006;
      const ringMat = T3().basic(hex, hex === T3().NEON.mine ? 2.1 : 4.2);
      const outer = new THREE.Mesh(geo('ringO', () => new THREE.TorusGeometry(0.38, 0.022, 8, 40)), ringMat);
      outer.rotation.x = Math.PI / 2; outer.position.y = 0.02;
      const inner = new THREE.Mesh(geo('ringI', () => new THREE.TorusGeometry(0.29, 0.015, 8, 36)), ringMat);
      inner.rotation.x = Math.PI / 2; inner.position.y = 0.075;
      const auraMat = new THREE.MeshBasicMaterial({ color: T3().glow(hex, 1.0), transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
      const aura = new THREE.Mesh(geo('aura', () => new THREE.CylinderGeometry(0.36, 0.38, 0.17, 32, 1, true)), auraMat);
      aura.position.y = 0.09;
      for (const m of [disc, outer, inner, aura]) m.raycast = () => {};
      grp.add(disc, outer, inner, aura);
      grp.userData = { ringMat, auraMat };
      return grp;
    },

    geo
  };

  YC.PieceMeshes = PM;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
