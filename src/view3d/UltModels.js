/* UltModels.js — as personagens das Ultimates em modelo 3D (.glb em assets/models/ultimate/<icone>.glb, lista em
   YC.ULT_MODEL_FILES no UltModelList.js). Carregam só quando a partida precisa delas (want: alguém tem essa
   Ultimate); enquanto não há modelo fica a figura de cartão (sprite) do Board3DUltimate.
   make(icone): a figura pronta, com a altura das figuras (1,55) e a mesma inclinação das peças.
   Board3D.ultLand(fig, casa, def): a aterragem da transformação (docs/RELATORIO-VISUAL-3D.md, secção E): cai do
   alto esticada, achata ao tocar no chão e volta com mola, onda de choque, faíscas, clarão e tremor de câmara.
   Só visual; sem luzes novas (o clarão usa as flashLights fixas). */
(function (YC) {
  'use strict';

  const FIG_H = 1.55, TILT = -0.21;
  const key = (icon) => `ult:${icon}`;
  const loading = new Set();
  const fit = new Map();   // ícone → escala para a figura ficar com FIG_H de altura
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const UM = {
    FIG_H,
    listed(icon) { return !!(YC.ULT_MODEL_FILES || {})[icon]; },
    has(icon) { return !!(YC.ModelLib && YC.ModelLib.has(key(icon))); },

    /** Começa a carregar o modelo (uma vez); avisa com o evento "yc-ult-models" quando chegar. */
    want(icon) {
      if (!icon || !UM.listed(icon) || UM.has(icon) || loading.has(icon) || !YC.ModelLib || !window.THREE_ADDONS) return;
      loading.add(icon);
      YC.ModelLib.load(key(icon), YC.ULT_MODEL_FILES[icon], { outline: 0.014 })
        .then(() => window.dispatchEvent(new CustomEvent('yc-ult-models', { detail: icon })))
        .catch(() => { /* fica a figura de cartão */ });
    },

    /** Figura 3D da personagem (grupo com o modelo), ou null se ainda não carregou. */
    make(icon) {
      const THREE = window.THREE, root = UM.has(icon) && YC.ModelLib.clone(key(icon));
      if (!root) return null;
      if (!fit.has(icon)) {
        const box = new THREE.Box3().setFromObject(root);
        fit.set(icon, FIG_H / Math.max(0.01, box.max.y - box.min.y));
      }
      root.scale.setScalar(fit.get(icon));
      root.rotation.x = TILT;
      const g = new THREE.Group();
      g.userData.kind = 'model';
      g.add(root);
      return g;
    }
  };

  if (YC.Board3D) Object.assign(YC.Board3D.prototype, {
    /** Aterragem da personagem na casa (depois do vídeo de invocação). */
    async ultLand(fig, sq, d) {
      const g = window.gsap, THREE = window.THREE;
      if (!g || !fig) return;
      const w = this.sqWorld(sq), c2 = new THREE.Color(d.c2).getHex(), c1 = new THREE.Color(d.c1).getHex();
      const s = fig.scale.clone(), y0 = fig.position.y;
      // cai do alto, esticada
      fig.position.y = y0 + 2.6;
      fig.scale.set(s.x * 0.85, s.y * 1.3, s.z * 0.85);
      await g.to(fig.position, { y: y0, duration: 0.34, ease: 'power2.in' });
      // toca no chão: achata e volta com mola; onda de choque, faíscas, clarão e tremor
      g.fromTo(fig.scale, { x: s.x * 1.25, y: s.y * 0.7, z: s.z * 1.25 }, { x: s.x, y: s.y, z: s.z, duration: 0.65, ease: 'elastic.out(1, 0.45)' });
      this.sparks(w.x, 0.25, w.z, c2, { n: 36, speed: 3.2 });
      this.sparks(w.x, 0.5, w.z, c1, { n: 18, speed: 2 });
      if (this.decal) this.decal(w.x, w.z, d.fx || 'MAGIC_CIRCLE', { size: 2.4, life: 0.9 });
      if (this.lightFlash) this.lightFlash(w.x, 1, w.z, c2, 6, 0.5);
      if (this.shakeCam) this.shakeCam(0.16, 0.4);
      YC.Sound && YC.Sound.play('explosion_bam');
      await wait(480);
    }
  });

  YC.UltModels = UM;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
