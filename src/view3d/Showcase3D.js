/* Showcase3D.js — vitrine 3D ao vivo para a interface: um renderer próprio e pequeno (um segundo contexto WebGL,
   criado uma vez) desenha uma personagem a mexer-se dentro de um elemento do ecrã. Usado no cartão da peça
   (PieceInspector) quando a peça é a personagem de uma Ultimate com modelo 3D (UltModels): cai e achata ao entrar,
   respira, olha para os lados e de 5 em 5 s dá um salto com pirueta. Só anima enquanto o elemento está no ecrã;
   com "Reduzir movimento" fica parada.
   Não mexe na cena do palco (nem nas luzes dele): tem cena, luzes e mapa de reflexos próprios. Os materiais dos
   modelos apontam para o mapa de reflexos do palco, que pertence ao outro contexto: aqui cada um ganha uma cópia com
   o mapa da vitrine (o mesmo shader ycRim). Quando o modelo chega, o shader e a textura são preparados em tempo
   morto (warm), para o primeiro cartão não engasgar. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const FOV = 24, FILL = 0.74, FOOT = 27;   // FILL: altura da figura / altura da caixa; FOOT: px do fundo até aos pés (centro do disco)
  const ENTER = 0.7, CYCLE = 5, HOP = 1.05, JUMP = 0.16;
  let r = null, scene = null, cam = null, env = null, failed = false, cur = null;
  const mats = new WeakMap();   // material do modelo → cópia com o mapa de reflexos da vitrine
  const figs = new Map();       // ícone → { pivot } (a mesma figura serve para todos os cartões)

  function setup() {
    if (r || failed) return !!r;
    if (!(YC.T3 && YC.T3.available())) { failed = true; return false; }
    try {
      const THREE = T(), A = window.THREE_ADDONS;
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.2;   // abaixo das fotos (1,42): com o fundo escuro do cartão, as cores ficavam desbotadas
      r.setClearColor(0x000000, 0);
      r.domElement.className = 'show3d';
      r.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); failed = true; stop(); });
      if (A.RoomEnvironment) { const pm = new THREE.PMREMGenerator(r); env = pm.fromScene(new A.RoomEnvironment(), 0.04).texture; pm.dispose(); }
      // as luzes das fotos das peças (Portraits3D), para a personagem ficar igual às fotos
      scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0x8090c8, 0.85));
      const key = new THREE.DirectionalLight(0xf2f6ff, 1.7); key.position.set(2, 4, 5);
      const rim = new THREE.DirectionalLight(0x59e1ff, 1.5); rim.position.set(-3, 2.5, -4);
      const fill = new THREE.DirectionalLight(0xff4f9a, 0.7); fill.position.set(3.5, 1, -2);
      scene.add(key, rim, fill);
      cam = new THREE.PerspectiveCamera(FOV, 1.5, 0.1, 50);
    } catch (e) { failed = true; r = null; console.warn('Vitrine 3D indisponível:', e); }
    return !!r;
  }

  function own(m) {
    if (Array.isArray(m)) return m.map(own);
    if (!m.isMeshStandardMaterial) return m;   // o contorno não usa reflexos: serve como está
    if (!mats.has(m)) {
      const c = m.clone();
      // a luz de contorno ciano ajuda no tabuleiro, mas aqui deixava franjas esbranquiçadas: fica mais fraca
      // (shader próprio, só neste contexto: o palco não recompila nada)
      c.onBeforeCompile = (sh) => {
        if (m.onBeforeCompile) m.onBeforeCompile(sh);
        sh.fragmentShader = sh.fragmentShader.replace(/ycRim \* [0-9.]+;/, 'ycRim * 0.15;');
      };
      c.customProgramCacheKey = () => 'ycShow';
      c.envMap = env;
      mats.set(m, c);
    }
    return mats.get(m);
  }

  /** A figura com 1 de altura, os pés no centro (0,0,0) e o pivô nos pés (achatar e esticar a partir do chão). */
  function figure(icon) {
    if (figs.has(icon)) return figs.get(icon);
    const THREE = T(), root = YC.UltModels && YC.UltModels.raw(icon);
    if (!root) return null;
    root.traverse((o) => { if (o.isMesh) o.material = own(o.material); });
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const s = 1 / Math.max(0.01, size.y);
    root.scale.setScalar(s);
    root.position.set(-c.x * s, -box.min.y * s, -c.z * s);
    const pivot = new THREE.Group();
    pivot.add(root);
    const f = { pivot };
    figs.set(icon, f);
    return f;
  }

  /** Câmara de frente, um pouco de cima, com os pés da figura sobre o centro do disco do cartão. */
  function frame(W, H) {
    const THREE = T();
    cam.fov = FOV; cam.aspect = W / H; cam.clearViewOffset();
    const d = 1 / (FILL * 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
    const look = new THREE.Vector3(0, 0.5, 0);
    cam.position.copy(look).addScaledVector(new THREE.Vector3(0, 0.3, 1).normalize(), d);
    cam.lookAt(look);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const y0 = new THREE.Vector3(0, 0, 0).project(cam).y, want = 1 - 2 * (H - FOOT) / H;
    cam.setViewOffset(W, H, 0, -((y0 - want) / 2) * H, W, H);   // desce o enquadramento até os pés ficarem no disco
    cam.updateProjectionMatrix();
  }

  /** Pose no instante t (segundos desde que o cartão abriu). */
  function pose(f, t, calm) {
    let y = 0, sy = 1, spin = 0;
    if (!calm) {
      if (t < ENTER) {
        // entra a cair esticada e achata com mola ao tocar no disco
        const fall = 0.26;
        if (t < fall) { const k = t / fall; y = 0.75 * (1 - k * k); sy = 1.14; }
        else { const u = (t - fall) / (ENTER - fall); sy = 1 - 0.22 * (1 - u) * Math.cos(u * Math.PI * 2.5); }
      } else {
        const c = (t - ENTER) % CYCLE;
        if (c > CYCLE - HOP) {
          // salto com pirueta (como as fotos animadas das peças): agachar, saltar a rodar 360°, aterrar a achatar
          const k = (c - (CYCLE - HOP)) / HOP;
          if (k < 0.14) sy = 1 - 0.12 * Math.sin((k / 0.14) * Math.PI / 2);
          else if (k < 0.78) {
            const j = (k - 0.14) / 0.64;
            y = JUMP * Math.sin(Math.PI * j);
            sy = 1 + 0.08 * Math.cos(Math.PI * j);
            spin = Math.PI * 2 * (j < 0.5 ? 2 * j * j : 1 - 2 * (1 - j) * (1 - j));
          } else { const j = (k - 0.78) / 0.22; sy = 1 - 0.1 * (1 - j) - 0.06 * Math.sin(Math.PI * j); }
        }
      }
      sy *= 1 + 0.02 * Math.sin(t * 2.7);   // respira
    }
    const sx = 1 / Math.sqrt(sy);
    f.pivot.position.y = y;
    f.pivot.rotation.y = -0.35 + (calm ? 0 : 0.4 * Math.sin(t * 0.8)) + spin;   // de 3/4, a olhar para os lados
    f.pivot.scale.set(sx, sy, sx);
  }

  function loop() {
    if (!cur) return;
    if (!cur.box.isConnected) { stop(); return; }
    const calm = !!(YC.reducedMotion && YC.reducedMotion());
    pose(cur.f, (performance.now() - cur.t0) / 1000, calm);
    r.render(scene, cam);
    cur.raf = calm ? 0 : requestAnimationFrame(loop);
  }

  function stop() {
    if (!cur) return;
    if (cur.raf) cancelAnimationFrame(cur.raf);
    if (scene) scene.remove(cur.f.pivot);
    cur = null;
  }

  const SC = {
    /** Há modelo 3D desta personagem e a vitrine funciona? */
    can(icon) { return !failed && !!(YC.UltModels && YC.UltModels.has(icon)) && YC.T3 && YC.T3.available(); },

    /** Mostra a personagem a mexer-se dentro de `box` (o canvas entra antes de `before`, se for dado).
        Devolve false se não der (sem WebGL ou modelo): quem chama mostra a imagem de recurso. */
    show(box, icon, before = null) {
      if (!box || !SC.can(icon) || !setup()) return false;
      const f = figure(icon);
      if (!f) return false;
      stop();
      const W = Math.max(1, box.clientWidth), H = Math.max(1, box.clientHeight);
      r.setSize(W, H, false);
      frame(W, H);
      scene.add(f.pivot);
      box.insertBefore(r.domElement, before && before.parentNode === box ? before : null);
      cur = { box, f, t0: performance.now(), raf: 0 };
      try { loop(); } catch (e) { failed = true; stop(); r.domElement.remove(); console.warn('Vitrine 3D falhou:', e); return false; }
      return true;
    },

    stop,

    /** Prepara o shader e a textura de uma personagem em tempo morto (o primeiro cartão abre sem engasgar). */
    async warm(icon) {
      if (cur || !SC.can(icon) || !setup()) return;
      const f = figure(icon);
      if (!f) return;
      scene.add(f.pivot);
      r.setSize(300, 230, false);
      frame(300, 230);
      try {
        if (r.compileAsync) await r.compileAsync(scene, cam);
        if (!cur) r.render(scene, cam);   // envia a textura para a placa
      } catch (e) { /* o primeiro cartão faz o trabalho */ }
      if (!cur || cur.f !== f) scene.remove(f.pivot);
    }
  };

  if (typeof window !== 'undefined') window.addEventListener('yc-ult-models', (e) => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 400));
    idle(() => SC.warm(e.detail), { timeout: 3000 });
  });

  YC.Showcase3D = SC;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
