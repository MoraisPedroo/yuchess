"""blender-piece.py — limpa um .glb gerado por IA (TRELLIS) para o jogo. Corre no Blender sem janela:

  blender --background --factory-startup --python tools/blender-piece.py -- entrada.glb saida.glb \
      --height 0.72 --tris 2500 --rot 0 [--preview vista.png]

  1. importa e junta as malhas; 2. roda à volta do eixo vertical (--rot, graus) para a peça olhar para +Z do
  Three.js (a câmara do jogo); 3. pivô no centro da base, no chão; 4. escala para a altura pedida (1 casa = 1
  unidade); 5. reduz para ~--tris triângulos; 6. exporta GLB (Y para cima, textura embutida);
  7. --preview: imagem de frente e a 3/4 para conferir (Workbench, com a textura).
Depois: gltf-transform (ver docs/ART-PROMPTS.md, secção "Peças 3D").
"""
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
src, dst = argv[0], argv[1]
opt = {'--height': 1.0, '--tris': 2500, '--rot': 0.0, '--preview': ''}
i = 2
while i < len(argv):
    k = argv[i]
    opt[k] = argv[i + 1] if k == '--preview' else float(argv[i + 1])
    i += 2

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    sys.exit('sem malhas')
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
# tira o objeto de pais vazios (o glTF importa nós) mantendo a posição
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
for o in [o for o in bpy.context.scene.objects if o.type == 'EMPTY']:
    bpy.data.objects.remove(o)

# rotação à volta do eixo vertical (Blender: Z para cima; a frente do glTF +Z é -Y no Blender).
# O importador do glTF usa quaterniões: passar a XYZ, senão a rotação em graus era ignorada.
obj.rotation_mode = 'XYZ'
obj.rotation_euler[2] += math.radians(opt['--rot'])
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# pivô no centro da base e altura pedida
pts = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
minz = min(p.z for p in pts)
h = max(p.z for p in pts) - minz
cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
me = obj.data
for v in me.vertices:
    v.co.x -= cx
    v.co.y -= cy
    v.co.z -= minz
k = opt['--height'] / h if h > 1e-6 else 1
obj.scale = (k, k, k)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# as normais importadas (custom split normals) estragam o sombreado depois de decimar: fora com elas
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.object.mode_set(mode='OBJECT')
try:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
except RuntimeError:
    pass

# menos triângulos (colapso de arestas mantém a textura)
tris = sum(len(p.vertices) - 2 for p in me.polygons)
if tris > opt['--tris']:
    m = obj.modifiers.new('decimar', 'DECIMATE')
    m.ratio = opt['--tris'] / tris
    m.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=m.name)
bpy.ops.object.shade_smooth()
tris2 = sum(len(p.vertices) - 2 for p in obj.data.polygons)

bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_animations=False, export_morph=False)
dims = obj.dimensions
print(f'OK {dst}: {tris} -> {tris2} triângulos; largura {dims.x:.2f} profundidade {dims.y:.2f} altura {dims.z:.2f}')

if opt['--preview']:
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'TEXTURE'
    sc.render.resolution_x, sc.render.resolution_y = 1024, 512
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new('w')
    sc.world.color = (1, 1, 1)
    H = opt['--height']
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = H * 2.3
    sc.collection.objects.link(cam)
    sc.camera = cam
    # três vistas lado a lado: frente (-Y no Blender = +Z no Three), 3/4 e de lado
    cam.data.ortho_scale = H * 3.4
    sc.render.resolution_x = 1536
    copies = [obj]
    for _ in range(2):
        o2 = obj.copy()
        sc.collection.objects.link(o2)
        copies.append(o2)
    for i, (o2, ang) in enumerate(zip(copies, (0, 40, 90))):
        o2.rotation_mode = 'XYZ'
        o2.rotation_euler = (0, 0, math.radians(ang))
        o2.location = ((i - 1) * H * 0.95, 0, 0)
    bpy.context.view_layer.update()
    cam.location = (0, -10, H * 0.5)
    cam.rotation_euler = (math.radians(90), 0, 0)
    sc.render.filepath = opt['--preview']
    bpy.ops.render.render(write_still=True)
    print('pré-visualização', opt['--preview'])
