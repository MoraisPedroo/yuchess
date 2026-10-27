/* Assets.js — caminho das imagens/vídeos de assets/ (arte gerada com o Gemini). No ficheiro único do build
   (tools/build.js) as imagens vêm embutidas em YC.ASSET_DATA; no site normal usa-se o caminho. */
(function (YC) {
  'use strict';

  YC.asset = (path) => (YC.ASSET_DATA && YC.ASSET_DATA[path]) || path;
  // arte única (gerada): verso das cartas e fundo do estádio
  YC.ART = { cardBack: 'assets/cards/back.png', stadium: 'assets/arena/stadium.jpg' };

  // "Reduzir movimento" é uma opção do jogo (Definições), desligada por omissão. Não segue o
  // prefers-reduced-motion do sistema: com as animações do Windows desligadas, o Chrome pede "reduce" e o
  // jogo perdia todas as transições (era isso que fazia as cartas saltarem de repente).
  YC.reducedMotion = () => typeof document !== 'undefined' && document.documentElement.classList.contains('reduce-motion');
  YC.setReducedMotion = (on) => {
    document.documentElement.classList.toggle('reduce-motion', !!on);
    try { localStorage.setItem('chessgioh.reduceMotion', on ? '1' : '0'); } catch (e) { /* */ }
  };
  if (typeof document !== 'undefined') {
    try { if (localStorage.getItem('chessgioh.reduceMotion') === '1') document.documentElement.classList.add('reduce-motion'); } catch (e) { /* */ }
  }
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
