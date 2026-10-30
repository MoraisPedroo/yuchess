/* PieceModelList.js — modelos 3D das peças que já existem em assets/models/pieces/ (chave: tipo + cor).
   As que não estão aqui usam a peça feita por código (PieceMeshes). Acrescentar uma linha por modelo novo. */
(function (YC) {
  'use strict';
  YC.PIECE_MODEL_FILES = {
    pw: 'assets/models/pieces/p_w.glb',
    rw: 'assets/models/pieces/r_w.glb'
  };
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
