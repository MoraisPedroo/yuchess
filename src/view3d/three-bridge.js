/* three-bridge.js — único módulo ES do projeto: carrega o Three.js 0.160.0 (importmap no index.html)
   e os extras de pós-processamento, e expõe-os em window.THREE / window.THREE_ADDONS para os scripts
   clássicos (YC.Board3D). Se o CDN falhar, o jogo usa o tabuleiro CSS antigo (BoardView). */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

window.THREE = THREE;
// MeshoptDecoder e SkeletonUtils: modelos .glb comprimidos e com esqueleto (ModelLib.js)
window.THREE_ADDONS = { EffectComposer, RenderPass, UnrealBloomPass, OutputPass, GLTFLoader, RoomEnvironment, MeshoptDecoder, SkeletonUtils };
window.dispatchEvent(new Event('yc-three-ready'));
