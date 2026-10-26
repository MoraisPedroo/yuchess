/* Board3D.js — palco 3D da partida (Three.js + bloom), com a mesma interface do BoardView (tabuleiro CSS):
   sync(match), mark({...}), center(sq), rect(sq), el(id), busy, fx, wrap. Câmara do relatório:
   FOV 40 em (0, 9.2, 9.8) a olhar para (0, -0.4, 0); em telemóvel na vertical FOV 46 em (0, 12.8, 7.6).
   A construção da arena está em Board3DScene.js e a sincronização com o motor em Board3DSync.js. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;

  class Board3D {
    static available() { return !!(YC.T3 && YC.T3.available()); }

    constructor(host, { fxLayer, onSquare, onPieceHover, onZoneHover, onZoneClick, onPileClick } = {}) {
      const THREE = T(), A = window.THREE_ADDONS;
      this.is3D = true;
      this.host = host;
      this.flipped = false;
      this.portrait = false;
      this.cb = { onSquare: onSquare || (() => {}), onPieceHover: onPieceHover || (() => {}), onZoneHover: onZoneHover || (() => {}), onZoneClick: onZoneClick || (() => {}), onPileClick: onPileClick || (() => {}) };
      this.pieceEls = new Map();
      this.busy = new Set();
      this.respondUids = [];
      host.innerHTML = '<div class="stage3d"><canvas class="yc-canvas"></canvas></div>';
      this.wrap = host.firstChild;
      this.canvas = this.wrap.firstChild;
      this.fx = fxLayer;

      const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.25 : 1.5));
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.35;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 120);
      this.composer = new A.EffectComposer(r);
      this.composer.addPass(new A.RenderPass(this.scene, this.camera));
      this.bloom = new A.UnrealBloomPass(new THREE.Vector2(640, 360), 0.4, 0.15, 0.95);
      this.bloomBase = 0.4;
      this.composer.addPass(this.bloom);
      this.composer.addPass(new A.OutputPass());

      // luzes baixas + exposição alta: as peças ficam claras sem passar o limiar do bloom
      this.scene.add(new THREE.AmbientLight(0x8090c8, 0.7));
      const key = new THREE.DirectionalLight(0xf2f6ff, 1.35);
      key.position.set(3, 12, 9);
      const rim = new THREE.DirectionalLight(0x59e1ff, 0.5);
      rim.position.set(-6, 5, -9);
      this.scene.add(key, rim);

      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();
      this.buildArena();
      this.layout();

      this.tick = this.tick.bind(this);
      this.clock = new THREE.Clock();
      window.gsap ? window.gsap.ticker.add(this.tick) : (this.raf = requestAnimationFrame(this.loop = () => { this.tick(); this.raf = requestAnimationFrame(this.loop); }));
      this.onResize = () => this.layout();
      window.addEventListener('resize', this.onResize);
      this.ro = window.ResizeObserver ? new ResizeObserver(this.onResize) : null;
      if (this.ro) this.ro.observe(host);

      this.canvas.addEventListener('pointermove', (e) => { this.lastPointer = e; this.hoverDirty = true; });
      this.canvas.addEventListener('pointerleave', () => { this.lastPointer = null; this.setHover(null); });
      this.canvas.addEventListener('click', (e) => this.onClick(e));
    }

    // ───────────── câmara e tamanho ─────────────
    layout() {
      const w = this.host.clientWidth || innerWidth, h = this.host.clientHeight || innerHeight;
      const portrait = w / h < 0.8;
      if (portrait !== this.portrait || !this.laid) { this.portrait = portrait; this.layoutSides(); this.laid = true; }
      const cam = this.camera;
      cam.aspect = w / h;
      if (portrait) {
        // telemóvel na vertical: ângulo do relatório (58°), mas à distância certa para o tabuleiro caber na largura
        const THREE = T();
        cam.fov = 46;
        const hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.aspect);
        const dist = (9.7 / 2) / Math.tan(hf / 2), target = new THREE.Vector3(0, -0.3, 1.5);
        cam.position.copy(new THREE.Vector3(0, 12.8, 7.6).normalize().multiplyScalar(dist)).add(target);
        cam.lookAt(target);
      }
      else {
        cam.fov = 40;
        // em ecrãs pouco largos afasta a câmara para caberem as zonas laterais
        const k = Math.max(1, 1.72 / cam.aspect);
        cam.position.set(0, 11.6 * k, 9.9 * k); cam.lookAt(0, -0.4, 0.75);
      }
      cam.updateProjectionMatrix();
      this.baseFov = cam.fov;
      this.renderer.setSize(w, h, false);
      this.composer.setSize(w, h);
      this.bloom.resolution.set(w / 2, h / 2);
      if (this.fx) this.fx._unit = this.unit();
    }

    tick() {
      const t = this.clock.getElapsedTime();
      if (this.crest) this.crest.material.uniforms.uTime.value = t;
      if (this.hoverDirty) { this.hoverDirty = false; this.pick(this.lastPointer); }
      this.animateIdle(t);
      this.composer.render();
    }

    // ───────────── coordenadas ─────────────
    /** Centro da casa no mundo (o jogador vê sempre o seu lado à frente). */
    sqWorld(sq) {
      const r = sq >> 3, c = sq & 7;
      return this.flipped ? { x: 3.5 - c, z: 3.5 - r } : { x: c - 3.5, z: r - 3.5 };
    }

    worldToScreen(x, y, z) {
      const v = new (T().Vector3)(x, y, z).project(this.camera);
      const b = this.canvas.getBoundingClientRect();
      return { x: b.left + (v.x + 1) / 2 * b.width, y: b.top + (1 - v.y) / 2 * b.height };
    }

    /** Retângulo no ecrã de uma área do chão (centro x,z com largura w e profundidade d). */
    areaRect(x, z, w, d, y = 0) {
      const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([dx, dz]) => this.worldToScreen(x + dx, y, z + dz));
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const left = Math.min(...xs), top = Math.min(...ys);
      return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top, right: Math.max(...xs), bottom: Math.max(...ys) };
    }

    rect(sq) { const p = this.sqWorld(sq); return this.areaRect(p.x, p.z, 0.96, 0.96); }

    center(sq) {
      const p = this.sqWorld(sq), s = this.worldToScreen(p.x, 0.35, p.z), f = this.fx.getBoundingClientRect();
      return { x: ((s.x - f.left) / f.width) * 100, y: ((s.y - f.top) / f.height) * 100 };
    }

    unit() { const a = this.worldToScreen(-4, 0, 4), b = this.worldToScreen(4, 0, 4); return Math.abs(b.x - a.x) || 600; }

    // ───────────── rato ─────────────
    hits(e) {
      const b = this.canvas.getBoundingClientRect();
      this.pointer.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      return this.raycaster.intersectObjects(this.pickables, true);
    }

    /** O que está debaixo do rato: peça, casa, lugar da Zona ou pilha. */
    target(e) {
      for (const h of this.hits(e)) {
        let o = h.object;
        if (o.isInstancedMesh && o.userData.sqs) return { kind: 'square', sq: o.userData.sqs[h.instanceId] };
        while (o && !o.userData.pick) o = o.parent;
        if (o) return o.userData.pick;
      }
      return null;
    }

    pick(e) { this.setHover(e ? this.target(e) : null); }

    setHover(t) {
      const prev = this.hover;
      this.hover = t;
      const same = prev && t && prev.kind === t.kind && prev.sq === t.sq && prev.team === t.team && prev.i === t.i;
      if (same) return;
      this.canvas.style.cursor = t ? 'pointer' : '';
      if (prev && prev.kind === 'piece') this.cb.onPieceHover(-1, null);
      if (prev && (prev.kind === 'zone' || prev.kind === 'pile')) this.cb.onZoneHover(null);
      if (t && t.kind === 'piece') {
        const g = this.pieceAtSq(t.sq);
        const states = g ? g.userData.states || [] : [];
        this.cb.onPieceHover(t.sq, { getBoundingClientRect: () => this.pieceRect(t.sq), classList: { contains: (k) => states.includes(k) } });
      }
      if (t && (t.kind === 'zone' || t.kind === 'pile')) this.cb.onZoneHover(t, this.objRect(t));
      this.updateArrow();
    }

    onClick(e) {
      const t = this.target(e);
      if (!t) return;
      if (t.kind === 'piece' || t.kind === 'square') this.cb.onSquare(t.sq);
      else if (t.kind === 'zone') this.cb.onZoneClick(t);
      else if (t.kind === 'pile') this.cb.onPileClick(t);
    }

    pieceAtSq(sq) { for (const g of this.pieceEls.values()) if (g.userData.sq === sq) return g; return null; }

    pieceRect(sq) { const p = this.sqWorld(sq); const a = this.worldToScreen(p.x, 1.25, p.z), b = this.worldToScreen(p.x, 0, p.z); const w = Math.abs(b.y - a.y) * 0.7; return { left: b.x - w / 2, top: a.y, width: w, height: b.y - a.y, right: b.x + w / 2, bottom: b.y }; }

    dispose() {
      if (window.gsap) window.gsap.ticker.remove(this.tick); else cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this.onResize);
      if (this.ro) this.ro.disconnect();
      this.renderer.dispose();
      this.composer.dispose && this.composer.dispose();
      this.host.innerHTML = '';
    }
  }

  YC.Board3D = Board3D;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
