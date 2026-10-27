/* Portraits3D.js — "fotos" das peças 3D para a interface (avatar do HUD, peças capturadas, promoção,
   inspetor e mascote). Usa o renderer do palco: desenha a peça num alvo de vírgula flutuante, lê os
   píxeis e aplica no CPU o mesmo tom ACES + sRGB do ecrã (o Three só faz tone mapping no ecrã).
   Cada imagem é feita uma vez e fica em cache. Sem WebGL devolve o SVG antigo (YC.PieceArt). */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const cache = new Map();
  const S = 192, R = S * 2;
  let renderer = null, scene = null, cam = null, rt = null, failed = false;

  function setup() {
    const THREE = T();
    scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0x8090c8, 0.85));
    const key = new THREE.DirectionalLight(0xf2f6ff, 1.7); key.position.set(2, 4, 5);
    const rim = new THREE.DirectionalLight(0x59e1ff, 1.5); rim.position.set(-3, 2.5, -4);
    const fill = new THREE.DirectionalLight(0xff4f9a, 0.7); fill.position.set(3.5, 1, -2);
    scene.add(key, rim, fill);
    cam = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
    rt = new THREE.WebGLRenderTarget(R, R, { type: THREE.FloatType });
  }

  // tone mapping ACES do Three (r160) + conversão sRGB
  const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const srgb = (c) => { c = c < 0 ? 0 : c > 1 ? 1 : c; return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };

  function render(type, color, bust) {
    const THREE = T();
    if (!scene) setup();
    const g = YC.PieceMeshes.make(type, color);
    g.rotation.y = -0.4;
    scene.add(g);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    // busto: só a cabeça e a coroa (avatar do HUD)
    if (bust) c.y = box.max.y - size.y * 0.3;
    const h = bust ? size.y * 0.62 : Math.max(size.y, size.x * 1.05) * 1.1;
    const d = h / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.copy(c).addScaledVector(new THREE.Vector3(0.25, 0.3, 1).normalize(), d);
    cam.lookAt(c);

    const prev = renderer.getRenderTarget(), clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    const buf = new Float32Array(R * R * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, R, R, buf);
    renderer.setRenderTarget(prev);
    renderer.setClearColor(clear, alpha);
    scene.remove(g);

    const big = document.createElement('canvas');
    big.width = big.height = R;
    const ctx = big.getContext('2d'), img = ctx.createImageData(R, R), out = img.data;
    const exp = renderer.toneMappingExposure / 0.6;
    for (let y = 0; y < R; y++) {
      for (let x = 0; x < R; x++) {
        const i = ((R - 1 - y) * R + x) * 4, o = (y * R + x) * 4, a = buf[i + 3];
        if (a <= 0.002) continue;
        const r = buf[i] * exp, gg = buf[i + 1] * exp, b = buf[i + 2] * exp;
        const r2 = fit(0.59719 * r + 0.35458 * gg + 0.04823 * b), g2 = fit(0.076 * r + 0.90834 * gg + 0.01566 * b), b2 = fit(0.0284 * r + 0.13383 * gg + 0.83777 * b);
        out[o] = srgb(1.60475 * r2 - 0.53108 * g2 - 0.07367 * b2);
        out[o + 1] = srgb(-0.10208 * r2 + 1.10813 * g2 - 0.00605 * b2);
        out[o + 2] = srgb(-0.00327 * r2 - 0.07276 * g2 + 1.07602 * b2);
        out[o + 3] = Math.min(255, a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const small = document.createElement('canvas');
    small.width = small.height = S;
    const sc = small.getContext('2d');
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(big, 0, 0, S, S);
    return small.toDataURL('image/png');
  }

  const P3 = {
    /** O palco 3D regista o seu renderer ao nascer e retira-o ao sair. */
    attach(r) { renderer = r; P3.prefetch(); },

    /** Desenha as 12 fotos (e os bustos dos Reis) aos poucos, nos tempos mortos, para não haver solavanco
        na primeira captura de cada tipo de peça. */
    prefetch() {
      const todo = [['k', 'w', true], ['k', 'b', true]];
      for (const c of ['w', 'b']) for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) todo.push([t, c, false]);
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 150));
      const step = () => { if (!renderer || !todo.length) return; const [t, c, bust] = todo.shift(); P3.url(t, c, bust); idle(step, { timeout: 800 }); };
      setTimeout(step, 600);
    },
    detach(r) { if (renderer === r) renderer = null; },

    url(type, color, bust = false) {
      const key = type + color + (bust ? 'B' : '');
      if (cache.has(key)) return cache.get(key);
      if (!renderer || failed || !YC.PieceMeshes) return null;
      try { cache.set(key, render(type, color, bust)); } catch (e) { failed = true; console.warn('Retratos 3D indisponíveis:', e); return null; }
      return cache.get(key);
    },

    /** HTML da peça: retrato 3D se houver, senão o SVG cartoon. */
    html(type, color, bust) {
      const u = P3.url(type, color, bust === 'bust');
      return u ? `<img class="piece-svg p3d" src="${u}" alt="${(YC.PIECE_NAME && YC.PIECE_NAME[type]) || ''}" draggable="false">` : YC.PieceArt.svg(type, color);
    }
  };

  YC.Portraits3D = P3;
  YC.pieceHTML = P3.html;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
