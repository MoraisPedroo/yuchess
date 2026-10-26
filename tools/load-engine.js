/* Carrega o motor do jogo (sem DOM) num contexto isolado do Node, pela mesma ordem do index.html.
   Ficheiro novo do motor → acrescenta-o aqui E no index.html. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE_FILES = [
  'src/core/EventBus.js',
  'src/game/ChessRules.js',
  'src/game/Cards.js',
  'src/game/CardEffects.js',
  'src/game/ChainResolver.js',
  'src/game/MoveResolver.js',
  'src/game/MatchController.js',
  'src/game/MatchEffects.js',
  'src/game/BotAI.js',
  'src/game/Economy.js',
  'src/net/LockstepSession.js'
];

function loadEngine(root, extra = {}) {
  const ctx = { console, setTimeout, clearTimeout, setInterval, clearInterval, Promise, Math, Date, JSON, ...extra };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ENGINE_FILES) {
    const file = path.join(root, f);
    if (!fs.existsSync(file)) throw new Error(`Falta o ficheiro do motor: ${f}`);
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: f });
  }
  return ctx.YC;
}

module.exports = { loadEngine, ENGINE_FILES };
