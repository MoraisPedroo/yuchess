/* MenuBackdrop.js — fundo vivo dos menus ao estilo do cliente do LoL (docs/RELATORIO-TELAS.md, secções D, E e H):
   um só <video> em ciclo por cima da imagem de espera (poster), vinheta para o texto se ler, faíscas leves num canvas
   2D e paralaxe ao mover o rato. Fica montado em todos os menus (Arena, Loja, Baralhos), por isso o fundo não pisca
   ao mudar de separador; na Loja e nos Baralhos fica mais escuro. Na partida o vídeo é desmontado (liberta o
   descodificador e a memória); com "Reduzir movimento", poupança de dados ou o separador escondido fica só a imagem
   parada. Os vídeos ficam fora do ficheiro único do build (só as imagens de espera entram, via YC.asset).
   Ciclos em assets/video/menu/<ciclo>-720p|mobile.webm|mp4 e <ciclo>-poster.webp (feitos com tools/menu-video.py;
   YC.MENU_CLIPS diz quais há). */
(function (YC) {
  'use strict';

  // ciclos que já existem (sem ficheiro fica o fundo de ardósia com as faíscas)
  YC.MENU_CLIPS = YC.MENU_CLIPS || { arena: true, vs: true };
  const DIR = 'assets/video/menu/';
  const MODE = { arena: 'arena', shop: 'dim', decks: 'dim', match: 'off' };

  let root = null, video = null, poster = null, canvas = null, ctx = null, raf = 0, clip = '', mode = 'arena', dead = false;
  let parts = [], pw = 0, ph = 0, dpr = 1;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const layers = [];   // elementos com paralaxe: { el, kx, ky }

  const calm = () => !!(YC.reducedMotion && YC.reducedMotion());
  const saveData = () => { const c = navigator.connection; return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))); };
  const still = () => calm() || saveData();

  // o Veo dá 720p: subir para 1080p só pesava mais, sem detalhe novo
  const variant = () => (innerWidth <= 768 && innerHeight > innerWidth ? 'mobile' : '720p');

  function build() {
    root = document.createElement('div');
    root.id = 'menu-bg';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<div class="mb-media"><img class="mb-poster" alt=""><video class="mb-video" muted loop playsinline preload="none" disablepictureinpicture></video></div>'
      + '<div class="mb-shade"></div><canvas class="mb-sparks"></canvas>';
    document.body.prepend(root);
    video = root.querySelector('video');
    poster = root.querySelector('.mb-poster');
    canvas = root.querySelector('canvas');
    ctx = canvas.getContext('2d');
    video.addEventListener('playing', () => video.classList.add('on'));
    video.addEventListener('error', () => video.classList.remove('on'));
    layers.push({ el: root.querySelector('.mb-media'), kx: -16, ky: -10 });
    addEventListener('resize', size);
    addEventListener('pointermove', (e) => { mouse.x = e.clientX / innerWidth - 0.5; mouse.y = e.clientY / innerHeight - 0.5; }, { passive: true });
    document.addEventListener('visibilitychange', () => (document.hidden ? MB.pause() : MB.resume()));
    size();
  }

  function size() {
    dpr = Math.min(2, devicePixelRatio || 1);
    pw = innerWidth; ph = innerHeight;
    canvas.width = Math.round(pw * dpr); canvas.height = Math.round(ph * dpr);
    const n = pw <= 768 ? 12 : 26;
    while (parts.length < n) parts.push(spark(true));
    parts.length = n;
  }

  function spark(anywhere) {
    return { x: Math.random() * pw, y: anywhere ? Math.random() * ph : ph + 10, r: 0.8 + Math.random() * 1.8, v: 0.18 + Math.random() * 0.42,
      d: (Math.random() - 0.5) * 0.25, a: 0.25 + Math.random() * 0.5, gold: Math.random() < 0.68, t: Math.random() * 6.28 };
  }

  function tick() {
    raf = 0;
    if (dead || document.hidden) return;
    // paralaxe com mola (o rato só guarda a posição)
    mouse.sx += (mouse.x - mouse.sx) * 0.06; mouse.sy += (mouse.y - mouse.sy) * 0.06;
    if (!calm() && pw > 768) for (const L of layers) if (L.el.isConnected) L.el.style.transform = `translate3d(${(mouse.sx * L.kx).toFixed(2)}px, ${(mouse.sy * L.ky).toFixed(2)}px, 0)`;
    // faíscas douradas e ciano a subir
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    if (!calm()) {
      for (const p of parts) {
        p.y -= p.v; p.t += 0.03; p.x += p.d + Math.sin(p.t) * 0.15;
        if (p.y < -12) Object.assign(p, spark(false));
        const a = p.a * Math.min(1, p.y / (ph * 0.25));
        ctx.fillStyle = p.gold ? `rgba(255, 183, 3, ${a.toFixed(3)})` : `rgba(72, 202, 228, ${a.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
    }
    raf = requestAnimationFrame(tick);
  }

  function load(name) {
    clip = name;
    const has = YC.MENU_CLIPS[name];
    poster.src = has ? YC.asset(`${DIR}${name}-poster.webp`) : '';
    poster.hidden = !has;
    video.classList.remove('on');
    if (!has || still()) { video.removeAttribute('src'); video.load(); return; }
    const webm = video.canPlayType('video/webm; codecs="vp9"') !== '';
    video.src = `${DIR}${name}-${variant()}.${webm ? 'webm' : 'mp4'}`;   // fora do build: caminho direto
    video.play().catch(() => {});
  }

  const MB = {
    init() { if (!root) build(); MB.screen('arena'); },

    /** O separador mudou: escolhe o ciclo e a intensidade (a partida desmonta tudo). */
    screen(tab) {
      if (!root) build();
      mode = MODE[tab] || 'dim';
      root.dataset.mode = mode;
      if (mode === 'off') return MB.stop();
      dead = false;
      if (clip !== 'arena' || !video.getAttribute('src')) load('arena');
      MB.resume();
    },

    /** Troca o ciclo (ex.: 'vs' no ecrã de carregamento); volta ao da Arena com MB.clip('arena'). */
    clip(name) {
      if (!root) build();
      dead = false;
      if (name !== clip || !video.getAttribute('src')) load(name);
      MB.resume();
    },

    /** Elemento com paralaxe (kx/ky em px no canto do ecrã; negativo = move ao contrário do rato). */
    parallax(el, kx = 24, ky = 12) {
      for (let i = layers.length - 1; i >= 0; i--) if (!layers[i].el.isConnected) layers.splice(i, 1);
      layers.push({ el, kx, ky });
    },

    pause() {
      if (video && !video.paused) video.pause();
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    },

    resume() {
      if (!root || dead || document.hidden) return;
      if (video.getAttribute('src') && video.paused && !still()) video.play().catch(() => {});
      if (!raf) raf = requestAnimationFrame(tick);
    },

    /** Entrada na partida: para e esvazia o vídeo (o descodificador e os buffers ficam livres para o palco 3D). */
    stop() {
      dead = true;
      MB.pause();
      if (video) { video.classList.remove('on'); video.removeAttribute('src'); video.load(); }
      clip = '';
    }
  };

  YC.MenuBackdrop = MB;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
