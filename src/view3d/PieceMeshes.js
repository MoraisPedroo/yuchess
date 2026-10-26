/* PieceMeshes.js — peças de xadrez 3D em estilo "figura de vinil" cartoon, feitas por código (sem ficheiros
   externos): silhuetas torneadas (LatheGeometry), cabeça do Cavalo extrudida com bisel, plástico envernizado
   com reflexos (T3.gloss), ouro metálico, contorno preto, olhos que piscam, bochechas e sorrisos.
   Detalhes por peça: Torre com porta e bandeira, Cavalo com orelhas e crina, Bispo com colar e medalha,
   Rainha com colar de pérolas e gemas, Rei com capa, gola de arminho e rubi. Também cria os pedestais. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const T3 = () => YC.T3;
  const templates = new Map();
  const geos = new Map();

  const COLORS = {
    w: { body: 0xE8E2D6, shade: 0xD2E3FC, mane: 0xFF7AA8, flag: 0xFF4F9A },
    b: { body: 0x4A3A8C, shade: 0x7B42F6, mane: 0xE26DB4, flag: 0xFCC934 }
  };
  const GOLD = 0xFCC934;

  function geo(key, make) { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); }
  function lathe(key, pts, seg = 32, a0, a1) { return geo(key, () => new (T().LatheGeometry)(pts.map(([r, y]) => new (T().Vector2)(r, y)), seg, a0, a1)); }

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

  /** Ponto e normal na superfície de uma cabeça elíptica (centro cy, raio r, achatamento sy). */
  function onHead(cy, r, y, x, sy = 1) {
    const dy = (y - cy) / sy, z = Math.sqrt(Math.max(1e-4, r * r - x * x - dy * dy));
    return { pos: new (T().Vector3)(x, y, z), n: new (T().Vector3)(x, dy, z).normalize() };
  }

  /** Bochechas rosadas coladas à cabeça. */
  function cheeks(g, cy, r, y, spread, size = 0.042, sy = 1) {
    const THREE = T(), mat = T3().basic(0xFF5F95, 1, { transparent: true, opacity: 0.55, depthWrite: false });
    for (const sx of [-1, 1]) {
      const { pos, n } = onHead(cy, r, y, sx * spread, sy);
      const m = new THREE.Mesh(geo('cheek', () => new THREE.CircleGeometry(1, 18)), mat);
      m.scale.set(size, size * 0.62, 1);
      m.position.copy(pos).addScaledVector(n, 0.004);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      g.add(m);
    }
  }

  /** Sorriso (meio anel escuro). */
  function smile(g, cy, r, y, w = 0.032, sy = 1) {
    const THREE = T(), { pos, n } = onHead(cy, r, y, 0, sy);
    const m = new THREE.Mesh(geo('smile', () => new THREE.TorusGeometry(1, 0.2, 6, 16, Math.PI)), T3().basic(0x1a0d12, 1));
    m.scale.setScalar(w);
    m.position.copy(pos).addScaledVector(n, 0.003);
    m.rotation.set(Math.asin(-n.y), 0, Math.PI);
    g.add(m);
  }

  function gem(hex, x, y, z, s = 0.04) {
    const THREE = T();
    const m = mesh(geo('gemO', () => new THREE.OctahedronGeometry(1, 0)), T3().gloss(hex, { emissive: hex, ei: 0.35, rough: 0.08, env: 1.3 }), 0.25);
    m.scale.set(s, s * 1.3, s * 0.7);
    m.position.set(x, y, z);
    return m;
  }

  /** Molde de uma peça (partilhado e clonado para cada peça em jogo). */
  function build(type, color) {
    const THREE = T();
    const c = COLORS[color];
    // as brancas refletem menos para não passarem o limiar do bloom
    const body = T3().gloss(c.body, { emissive: c.shade, ei: color === 'b' ? 0.22 : 0.03, env: color === 'b' ? 0.6 : 0.38, rough: color === 'b' ? 0.34 : 0.42 });
    const gold = T3().gloss(GOLD, { metal: 0.8, rough: 0.3, coat: 0.6, env: 1.1, emissive: 0x6a3d00, ei: 0.15 });
    const accent = T3().gloss(c.mane, { rough: 0.3 });
    const ink = T3().basic(0x111111, 1);
    const g = new THREE.Group();
    g.name = 'body';
    g.add(mesh(lathe('base', BASE), body));
    g.add(mesh(lathe(`body${type}`, BODY[type]), body));
    const sphere = (r, y, sx = 1, sy = 1, mat = body) => { const m = mesh(geo('sph', () => new THREE.SphereGeometry(1, 28, 20)), mat); m.scale.set(r * sx, r * sy, r * sx); m.position.y = y; return m; };
    const ring = (r, tube, y, mat, outline = 0.01) => { const m = mesh(geo(`torus${r}${tube}`, () => new THREE.TorusGeometry(r, tube, 10, 36)), mat, outline); m.rotation.x = Math.PI / 2; m.position.y = y; return m; };
    switch (type) {
      case 'p':
        g.add(sphere(0.19, 0.52));
        g.add(eyes(0.53, 0.165, 0.07, 0.05));
        cheeks(g, 0.52, 0.19, 0.48, 0.11, 0.036);
        smile(g, 0.52, 0.19, 0.45, 0.028);
        g.add(ring(0.19, 0.028, 0.35, accent));
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
        cheeks(g, 0.42, 0.236, 0.42, 0.13);
        smile(g, 0.38, 0.237, 0.38, 0.034);
        // porta em arco com puxador
        const door = new THREE.Mesh(geo('door', () => {
          const s = new THREE.Shape();
          s.moveTo(-0.065, 0); s.lineTo(-0.065, 0.1); s.absarc(0, 0.1, 0.065, Math.PI, 0, true); s.lineTo(0.065, 0); s.closePath();
          return new THREE.ShapeGeometry(s, 12);
        }), T3().basic(0x2a160c, 1));
        door.position.set(0, 0.12, 0.268); door.rotation.x = -0.135;
        const knob = new THREE.Mesh(geo('knob', () => new THREE.SphereGeometry(0.014, 8, 6)), gold);
        knob.position.set(0.032, 0.19, 0.262);
        // bandeira (ondula no animateIdle)
        const pole = mesh(geo('pole', () => new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8)), gold, 0.008);
        pole.position.y = 0.97;
        const flag = new THREE.Group();
        flag.name = 'flag';
        flag.position.y = 1.14;
        const cloth = new THREE.Mesh(geo('cloth', () => {
          const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(0.12, 0.01, 0.22, -0.05); s.quadraticCurveTo(0.12, -0.08, 0, -0.11); s.closePath();
          return new THREE.ShapeGeometry(s, 8);
        }), T3().gloss(c.flag, { rough: 0.45, coat: 0.3, side: THREE.DoubleSide }));
        flag.add(cloth);
        g.add(door, knob, pole, flag);
        break;
      }
      case 'n': {
        const head = mesh(knightHead(), body, 0.012);
        head.position.y = 0.2;
        head.rotation.y = -0.95;
        const mane = T3().gloss(c.mane, { rough: 0.3 });
        const MY = [0.28, 0.36, 0.44, 0.52, 0.6, 0.67, 0.74], MX = [-0.235, -0.24, -0.23, -0.205, -0.16, -0.115, -0.07];
        for (let i = 0; i < MY.length; i++) {
          const m = mesh(geo('mane', () => new THREE.SphereGeometry(1, 14, 10)), mane, 0.1);
          m.scale.set(0.075, 0.085, 0.07 + (i % 2) * 0.015);
          m.position.set(MX[i], MY[i], (i % 2 ? 1 : -1) * 0.02);
          head.add(m);
        }
        for (const sz of [-1, 1]) {
          const ear = mesh(geo('ear', () => new THREE.ConeGeometry(0.045, 0.15, 10)), body, 0.012);
          ear.position.set(-0.03, 0.8, sz * 0.075); ear.rotation.set(sz * 0.3, 0, 0.2);
          const nos = new THREE.Mesh(geo('nostril', () => new THREE.SphereGeometry(1, 8, 6)), ink);
          nos.scale.set(0.012, 0.018, 0.01); nos.position.set(0.372, 0.37, sz * 0.06);
          const ck = new THREE.Mesh(geo('cheek', () => new THREE.CircleGeometry(1, 18)), T3().basic(0xFF5F95, 1, { transparent: true, opacity: 0.55, depthWrite: false }));
          ck.scale.set(0.036, 0.024, 1); ck.position.set(0.17, 0.46, sz * 0.168); ck.rotation.y = sz > 0 ? 0 : Math.PI;
          head.add(ear, nos, ck);
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
        const slit = new THREE.Mesh(geo('slit', () => new THREE.BoxGeometry(0.03, 0.2, 0.06)), ink);
        slit.position.set(0.07, 0.9, 0.14); slit.rotation.z = -0.5;
        const ball = mesh(geo('ball', () => new THREE.SphereGeometry(1, 16, 12)), gold, 0.15);
        ball.scale.setScalar(0.06); ball.position.y = 1.09;
        g.add(slit, ball, eyes(0.74, 0.18, 0.075, 0.05));
        cheeks(g, 0.78, 0.2, 0.69, 0.11, 0.036, 1.3);
        smile(g, 0.78, 0.2, 0.665, 0.026, 1.3);
        g.add(ring(0.175, 0.03, 0.52, gold));
        const medal = mesh(geo('medal', () => new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20)), gold, 0.01);
        medal.position.set(0, 0.33, 0.172); medal.rotation.x = Math.PI / 2 - 0.24;
        g.add(medal, gem(0x31E1F7, 0, 0.33, 0.19, 0.03));
        break;
      }
      case 'q': {
        g.add(sphere(0.22, 0.9));
        g.add(ring(0.17, 0.035, 1.07, gold, 0.012));
        const pink = T3().gloss(0xF538A0, { emissive: 0xF538A0, ei: 0.25, rough: 0.1, env: 1.2 });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const cone = mesh(geo('qcone', () => new THREE.ConeGeometry(0.05, 0.16, 10)), gold, 0.012);
          cone.position.set(Math.sin(a) * 0.15, 1.16, Math.cos(a) * 0.15);
          const gm = mesh(geo('qgem', () => new THREE.SphereGeometry(1, 10, 8)), pink, 0.2);
          gm.scale.setScalar(0.042); gm.position.set(Math.sin(a) * 0.15, 1.26, Math.cos(a) * 0.15);
          g.add(cone, gm);
        }
        g.add(eyes(0.9, 0.2, 0.08, 0.055, true));
        cheeks(g, 0.9, 0.22, 0.84, 0.12);
        smile(g, 0.9, 0.22, 0.81, 0.03);
        // colar de pérolas e gema na testa
        const pearl = T3().gloss(0xFFF8EE, { rough: 0.15, env: 1 });
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          const pr = new THREE.Mesh(geo('pearl', () => new THREE.SphereGeometry(0.024, 10, 8)), pearl);
          pr.position.set(Math.sin(a) * 0.17, 0.705, Math.cos(a) * 0.17);
          g.add(pr);
        }
        g.add(gem(0x31E1F7, 0, 1.08, 0.2, 0.04));
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
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const b = new THREE.Mesh(geo('kball', () => new THREE.SphereGeometry(0.026, 10, 8)), gold);
          b.position.set(Math.sin(a) * 0.185, 1.22, Math.cos(a) * 0.185);
          g.add(b);
        }
        const stache = T3().gloss(0x6B3E26, { rough: 0.5, coat: 0.3 });
        for (const sx of [-1, 1]) {
          const m = mesh(geo('stache', () => new THREE.SphereGeometry(1, 10, 8)), stache, 0.15);
          m.scale.set(0.08, 0.035, 0.04); m.position.set(sx * 0.07, 0.87, 0.21); m.rotation.z = sx * 0.3;
          g.add(m);
        }
        cheeks(g, 0.95, 0.23, 0.9, 0.13);
        // capa vermelha (meia volta, atrás) e gola de arminho
        const cape = new THREE.Mesh(lathe('cape', [[0.34, 0.12], [0.31, 0.3], [0.25, 0.55], [0.2, 0.72]], 24, Math.PI / 2, Math.PI),
          T3().gloss(0xC4122F, { rough: 0.5, coat: 0.4, side: THREE.DoubleSide }));
        const ermine = ring(0.17, 0.05, 0.75, T3().gloss(0xF7F3EA, { rough: 0.7, coat: 0 }), 0.012);
        g.add(band, v, h, cape, ermine, eyes(0.97, 0.205, 0.085, 0.055), gem(0xE0245E, 0, 1.15, 0.2, 0.045), gem(0x31E1F7, 0, 1.4, 0.045, 0.026));
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

    geo, build
  };

  YC.PieceMeshes = PM;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
