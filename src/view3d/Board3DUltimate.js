/* Board3DUltimate.js — no palco 3D, a peça com uma Ultimate ativa (Ultimates.js) transforma-se na personagem: uma
   figura de cartão (sprite sempre virado para a câmara) com a arte recortada, em pé no pedestal. O corpo da peça fica
   escondido mas continua a apanhar o rato; os ícones de equipamento por cima somem (a figura já mostra o objeto).
   A figura vive dentro do "hold", por isso salta e respira com a animação parada como as outras peças.
   Sem luzes novas e com materiais de sprite (já compilados pelas etiquetas): não congela o jogo. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const FIG_H = 1.55;         // altura da figura (mais alta do que o Rei: é a estrela)
  const textures = {};

  Object.assign(YC.Board3D.prototype, {
    syncUltimate(g, p, viewer) {
      const U = YC.Ultimate, d = U && U.forPiece(p, viewer);
      const hold = g.getObjectByName('hold');
      if (!hold) return;
      const body = hold.getObjectByName('body');
      let fig = hold.getObjectByName('ultFigure');
      if (d && (!fig || fig.userData.icon !== d.icon)) {
        if (fig) hold.remove(fig);
        const THREE = T();
        const tex = textures[d.icon] || (textures[d.icon] = new THREE.TextureLoader().load(U.hero(d), (t) => {
          // proporção da arte, quando a imagem carrega
          for (const gg of this.pieceEls.values()) {
            const f = gg.getObjectByName('ultFigure');
            if (f && f.userData.icon === d.icon) f.scale.set(FIG_H * (t.image.width / t.image.height), FIG_H, 1);
          }
        }));
        tex.colorSpace = THREE.SRGBColorSpace;
        // a exposição alta do palco (ACES, no fim do composer) desbota a arte: a cor escurecida compensa
        fig = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xB8B8B8, transparent: true, alphaTest: 0.35, fog: false }));
        fig.name = 'ultFigure';
        fig.userData.icon = d.icon;
        fig.center.set(0.5, 0);
        fig.position.y = 0.1;
        const ratio = tex.image ? tex.image.width / tex.image.height : 0.62;
        fig.scale.set(FIG_H * ratio, FIG_H, 1);
        fig.raycast = () => {};
        hold.add(fig);
      }
      if (fig) fig.visible = !!d;
      if (body) body.visible = !d;
      const medals = g.getObjectByName('medals');
      if (medals) medals.visible = !d;
      if (d) g.userData.h = FIG_H;
    }
  });
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
