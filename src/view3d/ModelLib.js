/* ModelLib.js — modelos 3D em ficheiros .glb (peças do tabuleiro e, mais tarde, personagens das Ultimates).
   Carrega cada ficheiro uma vez (GLTFLoader + MeshoptDecoder: os ficheiros saem do gltf-transform com meshopt),
   guarda-o em cache e devolve cópias. Modelos com esqueleto são copiados com SkeletonUtils.clone (o clone() normal
   deixava as cópias presas aos ossos do original).
   Material: o PBR do gerador (TRELLIS) passa a "mate estilizado" — pouco brilho, sem verniz, e um contorno de luz
   ciano no bordo (rim light, docs/RELATORIO-VISUAL-3D.md). Todos os modelos partilham o mesmo programa de shader
   (customProgramCacheKey fixo), por isso compila uma vez só. Sem luzes novas na cena. */
(function (YC) {
  'use strict';

  const T = () => window.THREE;
  const A = () => window.THREE_ADDONS || {};
  const cache = new Map();   // chave → Promise do glTF
  const ready = new Map();   // chave → glTF já carregado
  const styled = [];         // materiais criados (para receberem o mapa de ambiente quando o palco o criar)
  let loader = null;

  // rim light: (1 - N·V)^3 na cor ciano do palco; fica abaixo do limiar do bloom
  // (nas Pretas mais forte: sem ele perdiam-se nas casas escuras do tabuleiro)
  const rim = (k) => `
    float ycRim = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.6);
    outgoingLight += vec3(0.32, 0.86, 1.0) * ycRim * ${k};
    #include <opaque_fragment>`;
  // um pouco de luz própria a partir da cor da textura: com as luzes baixas do palco o marfim ficava cinzento
  const glow = (k) => `#include <emissivemap_fragment>
    totalEmissiveRadiance += diffuseColor.rgb * ${k};`;
  // Pretas a partir do modelo branco (docs/RELATORIO-VISUAL-3D.md): marfim → obsidiana #1E2235…#4A587D,
  // azul → carmesim #851928, ouro → prata #8D99AE; a pele, os olhos e a madeira ficam como estão
  const DARK_FN = `#include <common>
    vec3 ycHsv(vec3 c) {
      vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
      vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
      vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
      float d = q.x - min(q.w, q.y);
      return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
    }
    vec3 ycRgb(vec3 c) {
      vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
      return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
    }
    vec3 ycDark(vec3 lin) {
      // tudo limitado: um NaN aqui (pow de um negativo minúsculo) o bloom espalhava em manchas rosa e pretas
      vec3 h = ycHsv(pow(max(lin, vec3(0.0)), vec3(1.0 / 2.2)));
      h.y = clamp(h.y, 0.0, 1.0);
      float hue = fract(h.x) * 360.0;
      vec3 o = h;
      bool bluish = hue > 170.0 && hue < 270.0;
      // azul forte (pano) → carmesim; o marfim do gerador tem sombras azuladas (pouco saturadas): essas são marfim
      if (bluish && h.y > 0.42) o = vec3(0.978, min(1.0, h.y * 1.15), h.z * 0.92);
      // ardósia azulada (não quase preto: de longe tem de se distinguir das casas escuras)
      else if ((h.y < 0.22 || bluish) && h.z > 0.2) o = vec3(0.63, 0.26, 0.16 + (h.z - 0.2) / 0.8 * 0.38);
      // ouro (e o castanho-dourado que o gerador às vezes pinta); a pele é menos saturada e fica
      // prata neutra (sem tom azul: o ACES do fim puxava o cinzento-azulado brilhante para magenta)
      else if (hue >= 10.0 && hue < 65.0 && h.y > (hue < 27.0 ? 0.52 : 0.3) && h.z > 0.2) o = vec3(0.0, 0.0, h.z * 0.78);
      return pow(clamp(ycRgb(clamp(o, 0.0, 1.0)), vec3(1e-5), vec3(1.0)), vec3(2.2));
    }`;
  const DARK_MAP = `#include <map_fragment>
    diffuseColor.rgb = ycDark(diffuseColor.rgb);`;

  function getLoader() {
    if (loader) return loader;
    loader = new (A().GLTFLoader)();
    if (A().MeshoptDecoder) loader.setMeshoptDecoder(A().MeshoptDecoder);
    return loader;
  }

  /** Material estilizado a partir do material original do glTF (mantém a textura de cor). dark: versão preta. */
  function stylize(src, dark = false) {
    const THREE = T();
    const m = new THREE.MeshStandardMaterial({
      map: src.map || null, color: src.map ? 0xffffff : (src.color || new THREE.Color(0xffffff)),
      // as Pretas ficam sem mapa de reflexos: com ele o shader convertido dava manchas magenta nos frisos
      roughness: dark ? 0.5 : 0.6, metalness: 0.05, envMap: dark ? null : (YC.T3 && YC.T3.env || null), envMapIntensity: 0.32,
      transparent: false, side: THREE.FrontSide
    });
    m.onBeforeCompile = (sh) => {
      let f = sh.fragmentShader.replace('#include <opaque_fragment>', rim(dark ? '0.6' : '0.42')).replace('#include <emissivemap_fragment>', glow(dark ? '0.3' : '0.36'));
      if (dark) f = f.replace('#include <common>', DARK_FN).replace('#include <map_fragment>', DARK_MAP);
      sh.fragmentShader = f;
    };
    m.customProgramCacheKey = () => (dark ? 'ycRimDark' : 'ycRim');
    if (!dark) styled.push(m);
    return m;
  }

  const darkOf = new Map();   // material branco → a versão preta (partilhada por todas as cópias)
  function darken(mat) {
    if (Array.isArray(mat)) return mat.map(darken);
    if (!darkOf.has(mat)) darkOf.set(mat, stylize(mat, true));
    return darkOf.get(mat);
  }

  /** Prepara o glTF carregado: materiais estilizados, sem sombras reais, contorno escuro fino. */
  function prep(gltf, opts) {
    // primeiro a lista (o contorno acrescenta uma malha filha, que o traverse voltaria a visitar)
    const meshes = [];
    gltf.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    meshes.forEach((o) => {
      o.material = Array.isArray(o.material) ? o.material.map(stylize) : stylize(o.material);
      if (o.material.map) o.material.map.anisotropy = 4;
      o.castShadow = o.receiveShadow = false;
      if (opts.outline && !o.isSkinnedMesh && YC.T3) YC.T3.addOutline(o, opts.outline);
    });
    gltf.userData = Object.assign(gltf.userData || {}, { skinned: gltf.animations.length > 0 || hasSkin(gltf.scene) });
  }

  function hasSkin(root) { let s = false; root.traverse((o) => { if (o.isSkinnedMesh) s = true; }); return s; }

  const ML = {
    /** Carrega (uma vez) e devolve a Promise do glTF. opts.outline: espessura do contorno (0 = sem). */
    load(key, url, opts = {}) {
      if (!cache.has(key)) {
        cache.set(key, new Promise((resolve, reject) => {
          if (!A().GLTFLoader) { reject(new Error('GLTFLoader indisponível')); return; }
          getLoader().load(YC.asset(url), (gltf) => { prep(gltf, opts); ready.set(key, gltf); resolve(gltf); }, undefined, (err) => {
            console.warn('[modelo] falhou', url, err);
            reject(err);
          });
        }));
      }
      return cache.get(key);
    },

    has(key) { return ready.has(key); },

    /** Cópia nova do modelo (partilha geometria e materiais com o original), ou null se ainda não carregou.
        dark: com as cores das Pretas (o contorno fica igual). */
    clone(key, dark = false) {
      const gltf = ready.get(key);
      if (!gltf) return null;
      const SU = A().SkeletonUtils;
      const root = gltf.userData.skinned && SU ? SU.clone(gltf.scene) : gltf.scene.clone(true);
      if (dark) root.traverse((o) => { if (o.isMesh && o.name !== 'outline') o.material = darken(o.material); });
      return root;
    },

    /** Cópia com animações: { root, mixer, actions } (mixer null se o modelo não tiver clipes). */
    instance(key) {
      const root = ML.clone(key), gltf = ready.get(key);
      if (!root) return null;
      if (!gltf.animations.length) return { root, mixer: null, actions: {} };
      const mixer = new (T().AnimationMixer)(root), actions = {};
      for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
      return { root, mixer, actions };
    },

    /** O palco criou um mapa de ambiente novo (YC.T3.setEnv): os materiais dos modelos passam a usá-lo. */
    setEnv(tex) { for (const m of styled) { m.envMap = tex; m.needsUpdate = true; } }
  };

  YC.ModelLib = ML;
})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));
