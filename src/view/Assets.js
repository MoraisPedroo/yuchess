/* Assets.js — caminho das imagens/vídeos de assets/ (arte gerada com o Gemini). No ficheiro único do build
   (tools/build.js) as imagens vêm embutidas em YC.ASSET_DATA; no site normal usa-se o caminho. */
(function (YC) {
  'use strict';

  YC.asset = (path) => (YC.ASSET_DATA && YC.ASSET_DATA[path]) || path;
  // arte única (gerada): verso das cartas e fundo do estádio
  YC.ART = { cardBack: 'assets/cards/back.png', stadium: 'assets/arena/stadium.jpg' };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
