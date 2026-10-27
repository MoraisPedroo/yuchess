/* Empacotador: junta index.html + CSS + JS num só ficheiro.
   Gera dist/chess-gi-oh.html (documento completo, joga com duplo clique) e
   dist/artifact.html (fragmento sem <html>/<head>/<body>, para publicar como Artifact).
   Uso: node tools/build.js */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const html = read('index.html');

const styles = [...html.matchAll(/<link rel="stylesheet" href="(styles\/[^"]+)">/g)].map((m) => m[1]);
const scripts = [...html.matchAll(/<script src="(src\/[^"]+)"><\/script>/g)].map((m) => m[1]);
const cdn = [...html.matchAll(/<script src="(https:[^"]+)"><\/script>/g)].map((m) => `<script src="${m[1]}"></script>`).join('\n');
// Three.js: o importmap e o módulo-ponte (src/view3d/three-bridge.js) vão inline
const importmap = (html.match(/<script type="importmap">[\s\S]*?<\/script>/) || [''])[0];
const modules = [...html.matchAll(/<script type="module"[^>]*src="(src\/[^"]+)"><\/script>/g)].map((m) => `<script type="module">\n${read(m[1])}\n</script>`).join('\n');
if (!styles.length || !scripts.length) throw new Error('Não encontrei CSS/JS no index.html');

const css = styles.map((f) => `/* ── ${f} ── */\n${read(f)}`).join('\n');
const js = scripts.map((f) => {
  const src = read(f);
  if (/<\/script/i.test(src)) throw new Error(`${f} contém "</script" e partiria o HTML`);
  return `// ── ${f} ──\n${src}`;
}).join('\n');
// imagens de assets/ (objetos, efeitos, estádio — arte gerada) vão embutidas no ficheiro único (YC.asset lê-as);
// os vídeos ficam de fora (pesados): sem eles a carta mostra a imagem parada
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const assetFiles = [];
const walk = (dir) => { if (!fs.existsSync(dir)) return; for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); if (fs.statSync(p).isDirectory()) walk(p); else if (MIME[path.extname(f).toLowerCase()]) assetFiles.push(p); } };
walk(path.join(ROOT, 'assets'));
const itemData = assetFiles.length ? `\nYC.ASSET_DATA = {${assetFiles.map((p) => `${JSON.stringify(path.relative(ROOT, p).split(path.sep).join('/'))}: "data:${MIME[path.extname(p).toLowerCase()]};base64,${fs.readFileSync(p).toString('base64')}"`).join(',')}};` : '';

const bodyStart = html.indexOf('<body>') + '<body>'.length;
const bodyEnd = html.indexOf('<!-- Animação') > 0 ? html.indexOf('<!-- Animação') : html.indexOf('<script src=');
const body = html.slice(bodyStart, bodyEnd).trim();
const title = html.match(/<title>[^<]*<\/title>/)[0];
const desc = html.match(/<meta name="description"[^>]*>/)[0];
const fonts = html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/)[0];

const head = `${title}
<meta name="claude:viewport-fit-sides" content="cover">
${desc}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
${importmap}
${modules}
<style>
${css}
</style>`;
const tail = `${cdn}
<script>
${js}${itemData}
</script>`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const fragment = `${head}\n${body}\n${tail}\n`;
const full = `<!doctype html>\n<html lang="pt-PT">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head}\n</head>\n<body>\n${body}\n${tail}\n</body>\n</html>\n`;
fs.writeFileSync(path.join(ROOT, 'dist', 'artifact.html'), fragment);
fs.writeFileSync(path.join(ROOT, 'dist', 'chess-gi-oh.html'), full);
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
console.log(`dist/chess-gi-oh.html  ${kb(full)}  (${styles.length} CSS, ${scripts.length} JS)`);
console.log(`dist/artifact.html  ${kb(fragment)}`);
