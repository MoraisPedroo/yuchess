/* Portraits3D.js — "fotos" e sprite sheets das peças 3D para a interface (avatar do HUD, peças capturadas,
   promoção, inspetor e mascote). Usa o renderer do palco: desenha a peça num alvo de vírgula flutuante, lê os
   píxeis e aplica no CPU o mesmo tom ACES + sRGB do ecrã (o Three só faz tone mapping no ecrã).
   Sprite sheet: 24 quadros de um salto com pirueta (agachar → saltar a rodar → aterrar a achatar), feitos
   das próprias peças 3D (iguais às do tabuleiro em todos os quadros), um quadro por tempo morto do navegador.
   Tudo fica em cache. Sem WebGL devolve o SVG antigo (YC.PieceArt) e não há animação. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const cache = new Map();
  const S = 192, R = S * 2;
  // cada quadro da sprite é 20 % mais largo e 35 % mais alto do que a foto, com a mesma base: trocar a foto
  // parada pela sprite não mexe a peça, e o salto e a pirueta cabem no quadro
  const SPR = { n: 24, wide: 1.2, tall: 1.35, sup: 1.5, jump: 0.2 };
  const FW = Math.round(S * SPR.wide), FH = Math.round(S * SPR.tall);
  const sprites = new Map(), waiting = new Map(), queue = [];
  let renderer = null, scene = null, cam = null, rt = null, rtS = null, failed = false, sprFailed = false, working = false;

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
    rtS = new THREE.WebGLRenderTarget(Math.round(FW * SPR.sup), Math.round(FH * SPR.sup), { type: THREE.FloatType });
  }

  // tone mapping ACES do Three (r160) + conversão sRGB
  const fit = (v) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
  const srgb = (c) => { c = c < 0 ? 0 : c > 1 ? 1 : c; return 255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); };

  /** Desenha a cena no alvo e devolve um canvas sRGB do tamanho do alvo. */
  function shoot(target) {
    const THREE = T(), W = target.width, H = target.height;
    const prev = renderer.getRenderTarget(), clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, cam);
    const buf = new Float32Array(W * H * 4);
    renderer.readRenderTargetPixels(target, 0, 0, W, H, buf);
    renderer.setRenderTarget(prev);
    renderer.setClearColor(clear, alpha);
    const big = document.createElement('canvas');
    big.width = W; big.height = H;
    const ctx = big.getContext('2d'), img = ctx.createImageData(W, H), out = img.data;
    const exp = renderer.toneMappingExposure / 0.6;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = ((H - 1 - y) * W + x) * 4, o = (y * W + x) * 4, a = buf[i + 3];
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
    return big;
  }

  /** Enquadra a peça de 3/4 (ou só a cabeça, no busto). Devolve o tamanho e a altura do enquadramento. */
  function aim(g, bust) {
    const THREE = T();
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    if (bust) c.y = box.max.y - size.y * 0.3;
    const h = bust ? size.y * 0.62 : Math.max(size.y, size.x * 1.05) * 1.1;
    const d = h / 2 / Math.tan(THREE.MathUtils.degToRad(13));
    cam.fov = 26; cam.aspect = 1; cam.clearViewOffset();
    cam.position.copy(c).addScaledVector(new THREE.Vector3(0.25, 0.3, 1).normalize(), d);
    cam.lookAt(c);
    cam.updateProjectionMatrix();
    return size;
  }

  function render(type, color, bust) {
    if (!scene) setup();
    const g = YC.PieceMeshes.make(type, color);
    g.rotation.y = -0.4;
    scene.add(g);
    aim(g, bust);
    const big = shoot(rt);
    scene.remove(g);
    const small = document.createElement('canvas');
    small.width = small.height = S;
    const sc = small.getContext('2d');
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(big, 0, 0, S, S);
    return small.toDataURL('image/png');
  }

  /** Pose do quadro t (0–1): agachar, saltar a rodar 360°, aterrar a achatar. */
  function pose(t) {
    let y = 0, sy = 1, rot = 0, k;
    if (t < 0.14) { k = t / 0.14; sy = 1 - 0.14 * Math.sin(k * Math.PI / 2); }
    else if (t < 0.78) {
      k = (t - 0.14) / 0.64;
      y = Math.sin(Math.PI * k);
      sy = 1 + 0.1 * Math.cos(Math.PI * k);
      rot = Math.PI * 2 * (k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k));
    } else { k = (t - 0.78) / 0.22; sy = 1 - 0.1 * (1 - k) - 0.07 * Math.sin(Math.PI * k); }
    return { y, sy, rot };
  }

  /** Um quadro da sprite sheet em curso (a peça só está na cena durante o desenho). */
  function spriteFrame(job) {
    const THREE = T();
    if (!scene) setup();
    const g = YC.PieceMeshes.make(job.type, job.color);
    g.rotation.y = -0.4;
    scene.add(g);
    if (!job.view) {
      // câmara da foto parada, alargada para cima e para os lados (a base fica no mesmo sítio)
      aim(g, false);
      const full = 2 * SPR.tall - 1;
      job.view = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: 2 * THREE.MathUtils.radToDeg(Math.atan(full * Math.tan(THREE.MathUtils.degToRad(13)))), aspect: SPR.wide / full, full };
      job.h = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()).y;
      job.strip = document.createElement('canvas');
      job.strip.width = FW * SPR.n; job.strip.height = FH;
    }
    const v = job.view, p = pose(job.i / SPR.n), sx = 1 / Math.sqrt(p.sy);
    cam.position.copy(v.pos); cam.quaternion.copy(v.quat);
    cam.fov = v.fov; cam.aspect = v.aspect;
    cam.setViewOffset(SPR.wide, v.full, 0, 0, SPR.wide, SPR.tall);
    cam.updateProjectionMatrix();
    // a peça já vem com escala própria: o salto multiplica-a (achatar/esticar a partir da base)
    const s0 = g.scale.clone();
    g.position.y += p.y * SPR.jump * job.h;
    g.rotation.y = -0.4 + p.rot;
    g.scale.set(s0.x * sx, s0.y * p.sy, s0.z * sx);
    const big = shoot(rtS);
    scene.remove(g);
    const ctx = job.strip.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(big, job.i * FW, 0, FW, FH);
    job.i++;
  }

  function finish(job) {
    const done = (url) => {
      sprites.set(job.key, url);
      const cbs = waiting.get(job.key) || [];
      waiting.delete(job.key);
      cbs.forEach((cb) => cb(url));
    };
    if (job.strip.toBlob) job.strip.toBlob((b) => done(URL.createObjectURL(b)), 'image/png');
    else done(job.strip.toDataURL('image/png'));
  }

  // fila das sprite sheets: um quadro de cada vez quando o navegador está parado; as pedidas ao passar o rato
  // ("urgent") esperam no máximo ~150 ms por quadro
  let pending = 0;
  function schedule() {
    const ric = window.requestIdleCallback;
    if (pending) { if (ric) window.cancelIdleCallback(pending); else clearTimeout(pending); }
    pending = ric ? ric(step, queue[0] && queue[0].urgent ? { timeout: 150 } : undefined) : setTimeout(() => step(null), 50);
  }
  function step(dl) {
    pending = 0;
    if (!renderer || !queue.length || sprFailed) { working = false; return; }
    if (dl && !dl.didTimeout && dl.timeRemaining() < 8) return schedule();
    const job = queue[0];
    try { spriteFrame(job); } catch (e) { sprFailed = true; working = false; queue.length = 0; console.warn('Sprites 3D indisponíveis:', e); return; }
    if (job.i >= SPR.n) { queue.shift(); finish(job); }
    if (queue.length) schedule(); else working = false;
  }
  function pump(kick) {
    if (!queue.length || !renderer || sprFailed || (working && !kick)) return;
    working = true;
    schedule();
  }

  const P3 = {
    SPR,
    /** O palco 3D regista o seu renderer ao nascer e retira-o ao sair. */
    attach(r) { renderer = r; P3.prefetch(); pump(); },

    /** Desenha as 12 fotos (e os bustos dos Reis) aos poucos, nos tempos mortos, para não haver solavanco
        na primeira captura de cada tipo de peça; depois as sprite sheets. */
    prefetch() {
      const todo = [['k', 'w', true], ['k', 'b', true]];
      for (const c of ['w', 'b']) for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) todo.push([t, c, false]);
      const idle = window.requestIdleCallback || ((f) => setTimeout(f, 150));
      const step = () => {
        if (!renderer) return;
        if (!todo.length) { for (const c of ['w', 'b']) for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) P3.sprite(t, c); return; }
        const [t, c, bust] = todo.shift(); P3.url(t, c, bust); idle(step, { timeout: 800 });
      };
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

    /** URL da sprite sheet (tira de SPR.n quadros) ou null; se ainda não existir, entra na fila (à frente se
        `urgent`) e `cb(url)` é chamado quando ficar pronta. */
    sprite(type, color, cb, urgent) {
      const key = type + color;
      if (sprites.has(key)) return sprites.get(key);
      if (failed || sprFailed || !YC.PieceMeshes) return null;
      if (cb) { if (!waiting.has(key)) waiting.set(key, []); waiting.get(key).push(cb); }
      let job = queue.find((j) => j.key === key);
      if (!job) { job = { key, type, color, i: 0 }; queue.push(job); }
      if (urgent) {
        job.urgent = true;
        if (queue[0] !== job && job.i === 0) { queue.splice(queue.indexOf(job), 1); queue.splice(queue[0] && queue[0].i > 0 ? 1 : 0, 0, job); }
        if (queue[0] !== job) queue[0].urgent = true;   // a que está a meio acaba depressa para dar a vez
      }
      pump(urgent);
      return null;
    },

    /** Põe a sprite sheet dentro de `box` (por cima da foto parada, que fica escondida) e devolve-a. */
    spriteIn(box, type, color) {
      let el = box.querySelector(':scope > .p3d-spr');
      if (el) return el;
      const u = P3.sprite(type, color);
      if (!u) return null;
      el = document.createElement('div');
      el.className = 'p3d-spr';
      el.style.setProperty('--n', SPR.n);
      el.innerHTML = `<img src="${u}" alt="" draggable="false">`;
      // termina o salto em curso antes de parar (sem saltar para a pose de repouso a meio)
      el.addEventListener('animationiteration', () => { if (box.dataset.spr !== 'loop') box.classList.remove('play'); });
      box.appendChild(el);
      box.classList.add('has-spr');
      return el;
    },

    /** Anima a peça em `box`: 'loop' (enquanto o rato está em cima), 'once' (um salto) ou 'stop'. Se a sprite
        ainda não existir, pede-a com prioridade e começa quando ficar pronta. */
    play(box, type, color, mode = 'loop') {
      if (!box || (mode === 'once' && box.dataset.spr === 'loop')) return;
      box.dataset.spr = mode;
      if (mode === 'stop') return;
      const el = P3.spriteIn(box, type, color);
      if (!el) { P3.sprite(type, color, () => { if (box.isConnected && box.dataset.spr !== 'stop') P3.play(box, type, color, box.dataset.spr); }, true); return; }
      box.classList.add('play');
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
