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
  const RIM = `
    float ycRim = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
    outgoingLight += vec3(0.32, 0.86, 1.0) * ycRim * 0.38;
    #include <opaque_fragment>`;

  function getLoader() {
    if (loader) return loader;
    loader = new (A().GLTFLoader)();
    if (A().MeshoptDecoder) loader.setMeshoptDecoder(A().MeshoptDecoder);
    return loader;
  }

  /** Material estilizado a partir do material original do glTF (mantém a textura de cor). */
  function stylize(src) {
    const THREE = T();
    const m = new THREE.MeshStandardMaterial({
      map: src.map || null, color: src.map ? 0xffffff : (src.color || new THREE.Color(0xffffff)),
      roughness: 0.68, metalness: 0.05, envMap: YC.T3 && YC.T3.env || null, envMapIntensity: 0.32,
      transparent: false, side: THREE.FrontSide
    });
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', RIM); };
    m.customProgramCacheKey = () => 'ycRim';
    styled.push(m);
    return m;
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

    /** Cópia nova do modelo (partilha geometria e materiais com o original), ou null se ainda não carregou. */
    clone(key) {
      const gltf = ready.get(key);
      if (!gltf) return null;
      const SU = A().SkeletonUtils;
      return gltf.userData.skinned && SU ? SU.clone(gltf.scene) : gltf.scene.clone(true);
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
