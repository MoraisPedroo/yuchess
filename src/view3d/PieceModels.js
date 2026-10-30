/* PieceModels.js — as peças do tabuleiro em modelos 3D (.glb), com a peça feita por código (PieceMeshes) como
   reserva enquanto o modelo não carregou, se o ficheiro faltar ou sem WebGL.
   Os ficheiros estão listados em YC.PIECE_MODEL_FILES (PieceModelList.js), feitos com tools/trellis.py (imagem →
   3D), tools/blender-piece.py (pivô no chão, altura em casas, ≤ 2500 triângulos) e gltf-transform (ver
   docs/ART-PROMPTS.md, "Peças 3D"). Quando um modelo acaba de carregar, avisa com o evento "yc-piece-models"
   (o Board3D troca os corpos e os retratos da interface refazem-se). */
(function (YC) {
  'use strict';

  // alturas dos modelos em casas (docs/RELATORIO-VISUAL-3D.md); as das peças por código ficam no Board3DSync
  const H = { p: 0.72, r: 0.95, n: 0.98, b: 1.1, q: 1.22, k: 1.28 };
  const key = (type, color) => `piece:${type}${color}`;
  let started = false;

  const PMod = {
    H,

    /** Começa a carregar os modelos que existem (uma vez, quando o Three.js estiver pronto). */
    preload() {
      if (started || !YC.ModelLib || !window.THREE_ADDONS) return;
      started = true;
      for (const [k, url] of Object.entries(YC.PIECE_MODEL_FILES || {})) {
        YC.ModelLib.load(`piece:${k}`, url, { outline: 0.012 })
          .then(() => window.dispatchEvent(new CustomEvent('yc-piece-models', { detail: k })))
          .catch(() => { /* fica a peça feita por código */ });
      }
    },

    has(type, color) { return !!(YC.ModelLib && YC.ModelLib.has(key(type, color))); },

    /** Há modelo para esta peça? As Pretas sem modelo próprio usam o das Brancas com outras cores. */
    avail(type, color) { return PMod.has(type, color) || (color === 'b' && PMod.has(type, 'w')); },

    /** Corpo da peça (grupo "body"): o modelo, se já carregou, senão a peça feita por código. */
    make(type, color) {
      const own = PMod.has(type, color);
      const root = own ? YC.ModelLib.clone(key(type, color)) : PMod.avail(type, color) && YC.ModelLib.clone(key(type, 'w'), true);
      if (!root) return YC.PieceMeshes.make(type, color);
      const g = new (window.THREE.Group)();
      g.name = 'body';
      g.userData.model = true;
      g.add(root);
      return g;
    },

    /** Altura da peça (para pôr anéis, escudos e etiquetas por cima). */
    height(type, color, fallback) { return PMod.avail(type, color) ? H[type] : fallback; },

    /** Chave do corpo atual (muda quando o modelo chega e o corpo tem de ser trocado). */
    bodyKey(type, color) { return `${type}${color}${PMod.has(type, color) ? 'm' : PMod.avail(type, color) ? 'd' : ''}`; }
  };

  YC.PieceModels = PMod;
  if (typeof window !== 'undefined') {
    if (window.THREE_ADDONS) setTimeout(PMod.preload, 0);
    else window.addEventListener('yc-three-ready', PMod.preload, { once: true });
  }
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
