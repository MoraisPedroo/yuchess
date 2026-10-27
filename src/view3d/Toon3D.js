/* Toon3D.js — utilitários do palco 3D (Three.js): materiais cel-shading (MeshToonMaterial com 3 tons),
   contornos cartoon (casca invertida), cores néon acima de 1 (para o bloom) e texturas desenhadas em canvas
   (etiquetas "D5", brilhos, lugares da Zona, verso e frente das cartas). */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const mats = new Map();
  const texs = new Map();
  const glossy = [];

  // Molduras por tipo de carta (relatório: Equip cobalto, Casa violeta, Reativa âmbar, Counter platina/vermelho)
  const KIND = {
    EQUIP: ['#166D89', '#0B3547', '#5CE1E6'],
    GRID: ['#7A1C7E', '#3A0B40', '#E066FF'],
    REACTIVE: ['#B86B11', '#593105', '#FFD166'],
    COUNTER: ['#3A3F58', '#171A26', '#FF3355'],
    QUICK: ['#0F7A5C', '#073D2E', '#4DFFB8']
  };

  const T3 = {
    KIND,
    NEON: { mine: 0x00E5FF, theirs: 0xFF1E42, cyan: 0x00F0FF, magenta: 0xD900FF, purple: 0xB537F2, gold: 0xFFD700 },

    available() { return !!(window.THREE && window.THREE_ADDONS); },

    /** Cor com intensidade > 1 (só os néons passam o limiar do bloom; o branco das peças fica abaixo). */
    glow(hex, k = 2) { return new (T().Color)(hex).multiplyScalar(k); },

    gradientMap() {
      if (texs.has('grad')) return texs.get('grad');
      const THREE = T();
      const tex = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
      tex.minFilter = tex.magFilter = THREE.NearestFilter;
      tex.needsUpdate = true;
      texs.set('grad', tex);
      return tex;
    },

    toon(hex, extra = {}) {
      const key = `toon${hex}${JSON.stringify(extra)}`;
      if (!mats.has(key)) mats.set(key, new (T().MeshToonMaterial)({ color: hex, gradientMap: T3.gradientMap(), ...extra }));
      return mats.get(key);
    },

    /** Plástico envernizado (vinil de coleção): verniz + reflexos do mapa de ambiente (setEnv). */
    gloss(hex, { emissive = 0, ei = 0, rough = 0.36, metal = 0, coat = 1, env = 0.55, side } = {}) {
      const key = `gloss${hex}|${emissive}|${ei}|${rough}|${metal}|${coat}|${env}|${side || 0}`;
      if (!mats.has(key)) {
        const m = new (T().MeshPhysicalMaterial)({ color: hex, emissive, emissiveIntensity: ei, roughness: rough, metalness: metal, clearcoat: coat, clearcoatRoughness: 0.12, envMap: T3.env || null, envMapIntensity: env, side: side || T().FrontSide });
        mats.set(key, m);
        glossy.push(m);
      }
      return mats.get(key);
    },

    /** O mapa de ambiente pertence ao renderer: cada palco novo gera o seu e atualiza os materiais. */
    setEnv(tex) {
      T3.env = tex;
      for (const m of glossy) { m.envMap = tex; m.needsUpdate = true; }
    },

    basic(hex, k = 1, extra = {}) {
      const key = `basic${hex}${k}${JSON.stringify(extra)}`;
      if (!mats.has(key)) mats.set(key, new (T().MeshBasicMaterial)({ color: T3.glow(hex, k), ...extra }));
      return mats.get(key);
    },

    /** Contorno preto cartoon: a mesma geometria, empurrada pelas normais e desenhada por dentro. */
    outlineMat(thick = 0.018) {
      const key = `outline${thick}`;
      if (mats.has(key)) return mats.get(key);
      const THREE = T();
      const m = new THREE.MeshBasicMaterial({ color: 0x07060f, side: THREE.BackSide });
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position) + normal * ${thick.toFixed(4)};`);
      };
      m.customProgramCacheKey = () => key;
      mats.set(key, m);
      return m;
    },

    addOutline(mesh, thick) {
      const o = new (T().Mesh)(mesh.geometry, T3.outlineMat(thick));
      o.name = 'outline';
      o.raycast = () => {};
      mesh.add(o);
      return o;
    },

    canvasTex(key, w, h, draw) {
      if (key && texs.has(key)) return texs.get(key);
      const THREE = T();
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      draw(g, w, h);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      if (key) texs.set(key, tex);
      return tex;
    },

    radial(hex, key) {
      return T3.canvasTex(key || `radial${hex}`, 128, 128, (g, w) => {
        const col = `#${new (T().Color)(hex).getHexString()}`;
        const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
        grd.addColorStop(0, col); grd.addColorStop(0.35, `${col}aa`); grd.addColorStop(1, `${col}00`);
        g.fillStyle = grd; g.fillRect(0, 0, w, w);
      });
    },

    label(text, color = '#00E5FF') {
      return T3.canvasTex(`label${text}${color}`, 128, 64, (g, w, h) => {
        g.fillStyle = 'rgba(4, 10, 32, .88)';
        roundRect(g, 4, 6, w - 8, h - 12, 12); g.fill();
        g.lineWidth = 4; g.strokeStyle = color; g.stroke();
        g.font = '900 34px Orbitron, "Chakra Petch", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 6; g.strokeStyle = '#003554'; g.strokeText(text, w / 2, h / 2 + 2);
        g.fillStyle = '#FFFFFF'; g.fillText(text, w / 2, h / 2 + 2);
      });
    },

    countLabel(n, color = '#C58AF9') { return T3.label(String(n), color); },

    textLabel(text, color = '#9FDFFF') {
      return T3.canvasTex(`txt${text}${color}`, 256, 64, (g, w, h) => {
        g.font = '700 30px "Chakra Petch", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = color; g.shadowBlur = 12;
        g.fillStyle = color; g.fillText(text.toUpperCase(), w / 2, h / 2);
      });
    },

    /** Lugar da Zona de Armadilhas: moldura néon + anel energético ao centro. */
    slot(color = '#00E5FF') {
      return T3.canvasTex(`slot${color}`, 160, 224, (g, w, h) => {
        g.fillStyle = 'rgba(0, 40, 70, .35)'; roundRect(g, 6, 6, w - 12, h - 12, 14); g.fill();
        g.shadowColor = color; g.shadowBlur = 14; g.lineWidth = 5; g.strokeStyle = color;
        roundRect(g, 6, 6, w - 12, h - 12, 14); g.stroke();
        g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2, 32, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 2; g.beginPath(); g.arc(w / 2, h / 2, 46, 0.3, Math.PI * 1.2); g.stroke();
        g.beginPath(); g.arc(w / 2, h / 2, 46, Math.PI * 1.35, Math.PI * 2.2); g.stroke();
      });
    },

    cardBack() {
      return T3.canvasTex('cardBack', 256, 358, (g, w, h) => {
        const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, h * 0.7);
        grd.addColorStop(0, '#D06BFF'); grd.addColorStop(0.45, '#5B1E9A'); grd.addColorStop(1, '#14082E');
        g.fillStyle = grd; roundRect(g, 0, 0, w, h, 16); g.fill();
        g.save(); g.translate(w / 2, h / 2);
        for (let i = 0; i < 24; i++) { g.rotate(Math.PI / 12); g.fillStyle = i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(0,229,255,.07)'; g.fillRect(0, -6, h, 12); }
        g.restore();
        g.lineWidth = 8; g.strokeStyle = '#C9A24A'; roundRect(g, 8, 8, w - 16, h - 16, 12); g.stroke();
        g.lineWidth = 3; g.strokeStyle = '#00E5FF'; roundRect(g, 18, 18, w - 36, h - 36, 8); g.stroke();
        g.beginPath(); g.arc(w / 2, h / 2, 62, 0, Math.PI * 2); g.fillStyle = '#FCC934'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#1a0b00'; g.stroke();
        g.fillStyle = '#7A1C7E'; g.font = '900 28px "Cinzel Decorative", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('CHESS', w / 2, h / 2 - 14); g.fillText('GI-OH!', w / 2, h / 2 + 18);
      });
    },

    /** Ícone redondo de uma carta (medalhas dos equipamentos e cubos das armadilhas). */
    iconTex(id) {
      const key = `icon${id}`;
      if (texs.has(key)) return texs.get(key);
      const card = YC.Cards.get(id);
      const base = (g, w) => {
        const grd = g.createRadialGradient(w * 0.4, w * 0.35, 4, w / 2, w / 2, w / 2);
        grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.45, card.theme.secondary); grd.addColorStop(1, card.theme.primary);
        g.fillStyle = grd; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 6, 0, Math.PI * 2); g.fill();
        g.lineWidth = 6; g.strokeStyle = '#111'; g.stroke();
      };
      const tex = T3.canvasTex(key, 128, 128, (g, w) => base(g, w));
      const img = new Image();
      img.onload = () => { const g = tex.image.getContext('2d'); g.clearRect(0, 0, 128, 128); base(g, 128); g.drawImage(img, 18, 18, 92, 92); tex.needsUpdate = true; };
      img.src = YC.ItemToken ? YC.ItemToken.canvasSrc(card) : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(YC.CardArt.svg(card).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
      return tex;
    },

    /** Frente da carta (moldura por tipo + nome + ícone). O ícone SVG carrega a seguir e atualiza a textura. */
    cardFace(id) {
      const key = `face${id}`;
      if (texs.has(key)) return texs.get(key);
      const card = YC.Cards.get(id), [c1, c2, edge] = KIND[card.kind];
      const draw = (g, w, h, img) => {
        const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, c1); grd.addColorStop(1, c2);
        g.fillStyle = grd; roundRect(g, 0, 0, w, h, 14); g.fill();
        g.lineWidth = 6; g.strokeStyle = edge; roundRect(g, 3, 3, w - 6, h - 6, 12); g.stroke();
        g.fillStyle = 'rgba(0,0,0,.5)'; roundRect(g, 14, 14, w - 28, 44, 8); g.fill();
        g.fillStyle = '#fff'; g.font = '700 19px "Chakra Petch", sans-serif'; g.textBaseline = 'middle';
        g.fillText(card.name.length > 22 ? `${card.name.slice(0, 21)}…` : card.name, 22, 36, w - 44);
        const ag = g.createRadialGradient(w / 2, 150, 10, w / 2, 150, 120);
        ag.addColorStop(0, '#ffffff'); ag.addColorStop(0.35, card.theme.secondary); ag.addColorStop(1, card.theme.primary);
        g.fillStyle = ag; g.fillRect(18, 66, w - 36, 170);
        g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.6)'; g.strokeRect(18, 66, w - 36, 170);
        if (img) g.drawImage(img, w / 2 - 75, 76, 150, 150);
        g.fillStyle = edge; g.font = '700 16px "Chakra Petch", sans-serif';
        g.fillText(`${YC.Cards.KIND_LABEL[card.kind].toUpperCase()} · VEL ${card.ss}`, 20, 258);
        g.fillStyle = 'rgba(5,10,22,.82)'; roundRect(g, 14, 276, w - 28, h - 290, 8); g.fill();
      };
      const tex = T3.canvasTex(key, 256, 358, (g, w, h) => draw(g, w, h, null));
      const img = new Image();
      img.onload = () => {
        const c = tex.image, g = c.getContext('2d');
        g.clearRect(0, 0, c.width, c.height);
        draw(g, c.width, c.height, img);
        tex.needsUpdate = true;
      };
      img.src = YC.ItemToken ? YC.ItemToken.canvasSrc(card) : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(YC.CardArt.svg(card).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}`;
      return tex;
    }
  };

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  T3.roundRect = roundRect;
  YC.T3 = T3;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
