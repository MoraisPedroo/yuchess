/* VFXPostProcessor.js — atmosfera de 1930: filtro "Boiling Line" (feTurbulence a 12 fps),
   aberração cromática de impacto, shader WebGL de película/CRT, screen shake, flash de Parry
   e explosões cartunescas com onomatopeias. */
(function (YC) {
  'use strict';

  const DEFS = `
<svg id="yc-defs" width="0" height="0" style="position:absolute;pointer-events:none" aria-hidden="true">
  <defs>
    <filter id="cuphead-boiling-line" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
      <feTurbulence id="boiling-turb" type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="1" result="noise"/>
      <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="displaced"/>
      <feMorphology in="displaced" operator="dilate" radius="0.3" result="inked"/>
      <feComponentTransfer in="inked">
        <feFuncR type="linear" slope="0.98" intercept="0.01"/>
        <feFuncG type="linear" slope="0.95" intercept="0"/>
        <feFuncB type="linear" slope="0.88" intercept="-0.02"/>
      </feComponentTransfer>
    </filter>
    ${[11, 37, 73].map((seed, i) => `
    <filter id="boil-b${i}" x="-2%" y="-2%" width="104%" height="104%" color-interpolation-filters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="${seed}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>`).join('')}
    <filter id="chromatic-hit-fx" x="-10%" y="-10%" width="120%" height="120%">
      <feOffset in="SourceGraphic" dx="-3" dy="0" result="redShift"/>
      <feColorMatrix in="redShift" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="redChannel"/>
      <feOffset in="SourceGraphic" dx="3" dy="1" result="cyanShift"/>
      <feColorMatrix in="cyanShift" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cyanChannel"/>
      <feBlend mode="screen" in="redChannel" in2="cyanChannel"/>
    </filter>
    <pattern id="hatch-dark" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="#6E4B33"/>
      <line x1="0" y1="0" x2="0" y2="7" stroke="#3A322B" stroke-width="2.2"/>
    </pattern>
    <pattern id="grain-light" width="9" height="9" patternUnits="userSpaceOnUse">
      <rect width="9" height="9" fill="#F4E7C5"/>
      <circle cx="2" cy="3" r="0.7" fill="#d9c79c"/><circle cx="7" cy="7" r="0.6" fill="#e2d1a8"/>
    </pattern>
  </defs>
</svg>`;

  const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uImpactIntensity;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 centered = vUv - 0.5;
  float r2 = dot(centered, centered);
  vec2 uv = 0.5 + centered * (1.0 + 0.08 * r2);
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.05, 0.04, 0.03, 1.0); return; }
  float steppedTime = floor(uTime * 12.0) / 12.0;
  uv.y += (hash(vec2(steppedTime, 1.0)) - 0.5) * 0.0025;
  float grain = (hash(uv * 500.0 + fract(uTime * 37.0)) - 0.5) * 0.11;
  float scratchSeed = floor(uTime * 8.0);
  float scratchX = hash(vec2(scratchSeed, 42.0));
  float scratchLine = smoothstep(0.0015, 0.0, abs(uv.x - scratchX)) * step(0.65, hash(vec2(scratchSeed, 99.0)));
  float scanline = sin(uv.y * 720.0) * 0.03;
  float vignette = smoothstep(0.78, 0.32, length(centered));
  vec3 vintageTint = vec3(0.96, 0.91, 0.79);
  float alphaOverlay = (1.0 - vignette) * 0.65 + abs(grain) + scratchLine * 0.35 + abs(scanline);
  vec3 finalColor = mix(vec3(0.06, 0.04, 0.02), vintageTint, scratchLine + max(0.0, grain));
  finalColor += vec3(0.95, 0.85, 0.40) * uImpactIntensity * 0.25;
  float a = clamp(alphaOverlay + uImpactIntensity * 0.18, 0.0, 0.78);
  gl_FragColor = vec4(finalColor * a, a);
}`;
  const VERT = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos * 0.5 + 0.5; vUv.y = 1.0 - vUv.y; gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const WORDS = ['WALLOP!', 'BAM!', 'KAPOW!', 'BONK!', 'WHAM!', 'SOCK!'];

  class VFXPostProcessor {
    constructor() {
      this.seed = 1;
      this.boilOn = true;
      this.filmOn = true;
      this.impact = 0;
      this.tickers = new Set();
      this.boardLayers = [];
      this.layerIdx = 0;
    }

    mount() {
      document.body.insertAdjacentHTML('afterbegin', DEFS);
      this.turb = document.getElementById('boiling-turb');
      this.fxLayer = document.createElement('div');
      this.fxLayer.id = 'fx-layer';
      document.body.appendChild(this.fxLayer);
      this.flash = document.createElement('div');
      this.flash.id = 'parry-flash';
      document.body.appendChild(this.flash);
      this.setupFilm();
      // loop "on twos": 83 ms → 12 fps
      this.boilTimer = setInterval(() => this.boilTick(), 83);
    }

    onTick(fn) { this.tickers.add(fn); }
    registerBoardLayers(layers) { this.boardLayers = layers; }

    boilTick() {
      if (this.boilOn) {
        this.seed = (this.seed % 100) + 1;
        this.turb.setAttribute('seed', String(this.seed));
        if (this.boardLayers.length) {
          this.boardLayers[this.layerIdx].classList.remove('on');
          this.layerIdx = (this.layerIdx + 1) % this.boardLayers.length;
          this.boardLayers[this.layerIdx].classList.add('on');
        }
      }
      for (const fn of this.tickers) fn();
    }

    setBoiling(on) {
      this.boilOn = on;
      document.documentElement.classList.toggle('no-boil', !on);
    }

    // ── Shader de película 1930 + CRT ──
    setupFilm() {
      const canvas = document.createElement('canvas');
      canvas.id = 'film-overlay';
      document.body.appendChild(canvas);
      this.canvas = canvas;
      const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
      if (!gl) { document.documentElement.classList.add('no-webgl'); return; }
      const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { document.documentElement.classList.add('no-webgl'); return; }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.gl = gl;
      this.uTime = gl.getUniformLocation(prog, 'uTime');
      this.uImpact = gl.getUniformLocation(prog, 'uImpactIntensity');
      const resize = () => {
        const scale = Math.min(1, window.devicePixelRatio || 1) * 0.75;
        canvas.width = Math.round(window.innerWidth * scale);
        canvas.height = Math.round(window.innerHeight * scale);
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener('resize', resize);
      const t0 = performance.now();
      const frame = (now) => {
        if (this.filmOn) {
          this.impact *= 0.9;
          gl.uniform1f(this.uTime, (now - t0) / 1000);
          gl.uniform1f(this.uImpact, this.impact);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    setFilm(on) {
      this.filmOn = on;
      this.canvas.style.display = on ? '' : 'none';
      if (!on && this.gl) { this.gl.clearColor(0, 0, 0, 0); this.gl.clear(this.gl.COLOR_BUFFER_BIT); }
    }

    // ── Efeitos públicos ──
    triggerScreenShake(intensity = 8, duration = 320) {
      const app = document.getElementById('shell') || document.getElementById('app');
      if (!app || !app.animate) return;
      const frames = [];
      for (let i = 0; i < 7; i++) {
        const k = intensity * (1 - i / 7);
        frames.push({ transform: `translate(${(Math.random() - 0.5) * 2 * k}px, ${(Math.random() - 0.5) * 2 * k}px) rotate(${(Math.random() - 0.5) * k * 0.08}deg)` });
      }
      frames.push({ transform: 'none' });
      app.animate(frames, { duration, easing: 'steps(8, end)' });
      this.impact = Math.min(1, this.impact + intensity / 14);
    }

    /** Flash rosa/dourado de 120 ms + pausa dramática (hit-stop). */
    async triggerParryFlash(word = 'PARRY!') {
      this.impact = 1;
      this.flash.classList.remove('go');
      void this.flash.offsetWidth;
      this.flash.classList.add('go');
      this.bigWord(word, 'parry');
      this.triggerScreenShake(10, 280);
      await new Promise((r) => setTimeout(r, 520));
    }

    bigWord(word, kind = '') {
      const w = document.createElement('div');
      w.className = `big-word ${kind}`;
      w.textContent = word;
      this.fxLayer.appendChild(w);
      setTimeout(() => w.remove(), 1300);
    }

    /** Estrela de impacto + espirais de fumo + onomatopeia, em coordenadas de ecrã. */
    spawnCartoonExplosion(x, y, color = '#E5A93C', word) {
      word = word || WORDS[Math.floor(Math.random() * WORDS.length)];
      const n = 12, pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * Math.PI * 2;
        const r = i % 2 ? 26 + Math.random() * 8 : 54 + Math.random() * 14;
        pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
      }
      const puffs = [0, 1, 2, 3, 4].map((i) => {
        const a = i * 1.26 + Math.random() * 0.5, d = 46 + Math.random() * 12;
        return `<g class="puff" style="--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d).toFixed(0)}px">
          <circle r="${10 + Math.random() * 6}" fill="#F4E7C5" stroke="#141210" stroke-width="3"/>
          <path d="M-5,0 a5,5 0 1,1 5,5 a3,3 0 1,1 -3,-3" fill="none" stroke="#141210" stroke-width="2"/></g>`;
      }).join('');
      const node = document.createElement('div');
      node.className = 'boom';
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      node.innerHTML = `<svg viewBox="-80 -80 160 160" width="160" height="160">
        <g class="boom-star"><polygon points="${pts.join(' ')}" fill="${color}" stroke="#141210" stroke-width="4" stroke-linejoin="round"/>
        <polygon points="${pts.map((p) => p.split(',').map((v) => (v * 0.55).toFixed(1)).join(',')).join(' ')}" fill="#FFF8E7"/></g>
        ${puffs}</svg><span class="boom-word">${word}</span>`;
      this.fxLayer.appendChild(node);
      this.impact = Math.min(1, this.impact + 0.5);
      setTimeout(() => node.remove(), 1100);
    }

    /** Texto flutuante ("-35 HP!", "BLOCKED!", "BOING!") em coordenadas de ecrã. */
    floatText(x, y, text, kind = '') {
      const t = document.createElement('div');
      t.className = `float-text ${kind}`;
      t.textContent = text;
      t.style.left = `${x}px`;
      t.style.top = `${y}px`;
      this.fxLayer.appendChild(t);
      setTimeout(() => t.remove(), 1400);
    }

    chromaticHit(node, ms = 260) {
      if (!node) return;
      node.classList.add('chroma-hit');
      setTimeout(() => node.classList.remove('chroma-hit'), ms);
    }
  }

  YC.VFXPostProcessor = VFXPostProcessor;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
