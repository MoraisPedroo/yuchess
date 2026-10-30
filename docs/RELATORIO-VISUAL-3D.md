# Relatório Técnico de Direção de Arte e Arquitetura Gráfica: Transição para Modelos 3D Estilizados no Chess-Gi-Oh!

## Diagnóstico Técnico-Artístico e Princípios Visuais do Estilo Autobattler

### Diagnóstico do Estado Atual

A renderização gráfica do *Chess-Gi-Oh! Cartoon Edition* assenta em geometrias analíticas procedurais desenvolvidas em Three.js r160 (`LatheGeometry`, extrusões 2D com bisel) associadas ao material `MeshPhysicalMaterial` com acabamento de verniz de alto brilho (`clearcoat: 1.0`, `roughness: 0.34-0.42`). Sob a perspetiva da câmara de jogo instalada na posição (0; 11,6; 9,9) a convergir para o ponto de mira (0; -0,4; 0,75) com campo de visão vertical (FOV) de 40° em computador e 46° em dispositivos móveis, este modelo de renderização apresenta limitações estruturais de leitura tática e consistência estilística.

O ângulo de inclinação do vetor ótico da câmara em relação ao plano do tabuleiro situa-se em aproximadamente 52,7°. A esta inclinação, os perfis de revolução torneados perdem a diferenciação volumétrica lateral, transformando a maioria das peças numa sucessão de círculos concêntricos indiferenciados quando observadas a partir de cima.

O acabamento com verniz espelhado (`clearcoat: 1.0`) gera reflexos especulares parasitas de alta frequência provenientes do mapa de ambiente de reflexão (`RoomEnvironment`). Estes reflexos competem com a legibilidade tática das peças no tabuleiro de 8 × 8 unidades, onde cada casa ocupa rigorosamente 1,0 × 1,0 unidades de mundo. O contorno por casca invertida com afastamento uniforme de 0,014 unidades projeta deformações nos cantos vivos e nas extremidades finas, gerando artefactos de interpenetração nos micro-detalhes compostos por primitivas adicionadas (como toros e cones).

A utilização de ilustrações bidimensionais como recortes planos (*billboards*) orientados para a câmara para representar as 13 personagens de Ultimate quebra a tridimensionalidade do cenário. Quando a câmara executa ligeiras oscilações (*screenshake*) ou translações cinemáticas, o achatamento visual do plano vertical de altura 1,55 revela de imediato a ausência de espessura e paralaxe geométrica.

### Princípios Visuais de Autobattlers Estilizados

A referência estética estabelecida por produções de referência no género como *Teamfight Tactics* (Riot Games), *Clash Mini* (Supercell) e *Hearthstone Battlegrounds* (Blizzard) fundamenta-se numa transposição intencional das proporções anatómicas para uma escala "chibi heroica". As unidades comunicam a sua função de combate num intervalo de reconhecimento visual inferior a 150 milissegundos a partir de perspetivas axonométricas elevadas.

As proporções corporais situam-se estritamente na relação entre 1:2,2 e 1:2,8 cabeças (onde a altura total da figura equivale a 2,2 até 2,8 vezes a altura da sua cabeça). O crânio e os elementos de suporte identificadores (capacetes, coroas, orelhas, chapéus) ocupam entre 40% e 45% da altura vertical total do modelo. O tronco é compacto, com extremidades inferiores robustas e pés largos ancorados ao solo para evitar a perceção de instabilidade estrutural. As mãos e as armas exibem uma escala aumentada em cerca de 130% a 150% em comparação com proporções anatómicas humanas, assegurando a leitura inequívoca das poses e das armas ativas em perspetivas aéreas.

Na hierarquia de frequência visual, aplica-se o princípio de distribuição 70/30: 70% da superfície da malha é composta por planos limpos de repouso visual, com gradientes suaves de cor e ausência de ruído procedural, enquanto 30% concentra o detalhe de alta frequência na face, na gola e no ponto de empunhadura da arma.

O gradiente vertical de valor e saturação é estruturante: a base das figuras (pés e pedestais) apresenta tonalidades mais escuras e dessaturadas (níveis de brilho entre 25% e 40%), enquanto o terço superior (peito, cabeça e adornos capitais) recebe valores cromáticos de brilho elevados (85% a 100%) e saturação acentuada. Este gradiente direciona naturalmente a atenção do jogador para o topo da peça, destacando-a contra o padrão axadrezado do tabuleiro.

| Parâmetro Técnico / Estético | Implementação Anterior | Especificação TFT Estilizada | Justificação Técnica de Leitura |
| --- | --- | --- | --- |
| **Proporção Cabeça/Corpo** | 1:1,2 (primitivas de torno) | 1:2,2 a 1:2,5 (Chibi Heroico) | Leitura facial e de silhueta instantânea a 52,7° de inclinação. |
| **Ocupação da Casa (1 × 1)** | Raio base 0,30 (diâmetro 0,60) | Pegada 0,65 × 0,65 máx.; Peão alt. 0,72, Rei alt. 1,28 | Garante 0,15 unidades de espaço livre entre peças em casas adjacentes. |
| **Modelo de Iluminação** | PBR Completo c/ Clearcoat 1,0 | Shading híbrido Toon/Lambert com Rim Light | Elimina ruído especular; acentua separação de planos e profundidade. |
| **Tratamento de Contorno** | Casca invertida uniforme (0,014) | *Inner-Edge* pintado na textura + Casca invertida seletiva (0,012) | Define contornos exteriores sem duplicar sobrecargas geométricas nos detalhes. |
| **Sistema de Sombras** | Sombra radial procedural no chão | Malha plana de sombra *blob* (Y = 0,002) | Elimina passagens adicionais de renderização de mapa de sombras na GPU móvel. |
| **Paleta Base: Brancas** | `#EEF2F7` (marfim frio) | `#F0F4FC` base, sombras `#9BB3D6`, realces `#FFFFFF` | Maior alcance dinâmico de valor entre topo e base sem estourar o bloom. |
| **Paleta Base: Pretas** | `#2E3D57` (grafite) | `#1E2235` base, sombras `#101322`, luz `#4A587D` | Evita tons pretos puros (`#000000`), preservando luz indireta difusa. |

### Configuração de Iluminação e Shader em Three.js

A arquitetura de iluminação de cena não pode alterar dinamicamente o número ou o tipo de luzes durante a sessão de jogo, de forma a prevenir a recompilação de programas shader durante o ciclo de desenho (*render loop*). O sistema apoia-se num esquema balanceado de três pontos com intensidades normalizadas, complementado por um material de características controladas.

A luz primária (*Key Light*) baseia-se num nó `DirectionalLight` posicionado em (5,0; 14,0; 8,0), com emissão cromática `#F4F6FF` e intensidade fixada em 1,25. A luz de preenchimento ambiente (*Ambient Light*) utiliza a cor `#7A8BB8` com intensidade calibrada em 0,65, impedindo que as áreas em sombra caiam para o preto absoluto. A contraluz (*Rim Light*) recorre a um nó `DirectionalLight` colocado em ( -6,0; 8,0; -7,0) com coloração turquesa `#52E5FF` e intensidade 0,85, contornando o bordo superior das figuras e separando-as do fundo escuro do estádio.

Para a renderização dos materiais, elimina-se o `MeshPhysicalMaterial` com verniz pesado e adota-se uma personalização do `MeshStandardMaterial` via gancho de compilação `onBeforeCompile`, injetando um cálculo de contorno de luz rasante (*Fresnel/Rim Light*) diretamente nas passagens de fragmentos:

JavaScript

```
// Material estilizado com Rim Light injetado via shader chunk
function createStylizedCharacterMaterial(diffuseTexture) {
  const mat = new THREE.MeshStandardMaterial({
    map: diffuseTexture,
    roughness: 0.65,
    metalness: 0.10,
    envMapIntensity: 0.35
  });

  mat.onBeforeCompile = function(shader) {
    shader.uniforms.rimColor = { value: new THREE.Color(0x59E1FF) };
    shader.uniforms.rimPower = { value: 3.2 };
    shader.uniforms.rimIntensity = { value: 0.9 };

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       uniform vec3 rimColor;
       uniform float rimPower;
       uniform float rimIntensity;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       vec3 viewDirNorm = normalize(vViewPosition);
       vec3 normalNorm = normalize(vNormal);
       float rimFactor = 1.0 - clamp(dot(viewDirNorm, normalNorm), 0.0, 1.0);
       rimFactor = pow(rimFactor, rimPower);
       gl_FragColor.rgb += rimColor * rimFactor * rimIntensity;`
    );
  };

  return mat;
}
```

A casca invertida para contorno exterior limita-se a uma malha simplificada partilhada, com deslocamento nas normais de 0,012 unidades e material básico escuro (`#141923`) com descarte de faces frontais (`side: THREE.BackSide`).

## Design e Especificação das Peças de Tabuleiro

### Conceitos e Elementos de Diferenciação Visual

Cada uma das 6 tipologias de peças é reinterpretada como uma unidade viva em miniatura, conservando no topo o identificador tradicional de xadrez de forma a garantir reconhecimento aéreo inequívoco pelo jogador.

O Peão surge sob a figura de um Pequeno Escudeiro/Sentinela (*Recruit Chibi*), empunhando um escudo largo com uma esfera no topo e uma adaga de madeira/metal. A Torre assume a volumetria de um Golem-Baluarte de Pedra e Ferro (*Fortress Golem*), com corpo largo, formato tronco-cónico, cabeça integrada no peito e coroamento com quatro ameias clássicas de torreão. O Cavalo materializa-se como um Centauro Mecânico ou Montaria Astuta (*Chevalier Stallion*), destacando-se pelo focinho arrebitado, crina esculpida em tufos geométricos e postura diagonal agressiva. O Bispo projeta-se como um Clérigo Rúnico/Mitrado (*Battle Cleric*), com túnica comprida afunilada, mitra pontiaguda com corte oblíquo aberto no topo e báculo com símbolo solar ou esférico. A Dama desenha-se como uma Feiticeira Real (*Arch-Mage Queen*), apresentando silhueta elegante em ampulheta com coroa de sete pontas pronunciadas e orbe levitante na mão direita. O Rei assume o papel de Monarca Soberano (*High Regent*), caracterizado por uma capa volumosa de arminho com gola saliente e uma coroa imponente encimada por uma cruz clássica que se projeta acima de todas as restantes unidades do tabuleiro.

A identificação das fações Brancas e Pretas apoia-se em contrastes estruturais de materiais, acabamentos e pedestais:

As peças Brancas incorporam cerâmica de marfim polido mate (`#F0F4FC`) combinada com ornatos em dourado quente acetinado (`#F5BA38`), complementados por tecidos em azul real `#2855AA`. As Pretas utilizam liga de obsidiana escovada e ferro azulado (`#1E2235`), com detalhes metálicos em prata oxidada (`#8D99AE`) e tecidos em carmesim escuro `#851928`. Sob os pés de cada figura, o anel identificador de equipa projeta uma base luminosa: `#00B4D8` (Aliado) e `#D90429` (Adversário), permitindo identificar de imediato o controlo da unidade, mesmo quando ocorrem transformações de cartas ou mecânicas de controlo mental.

| Peça | Conceito de Personagem | Elemento Focal Aéreo | Altura (unid.) | Largura Base | Orçamento de Vértices |
| --- | --- | --- | --- | --- | --- |
| **Peão** | Soldado Recruta com Broquel | Capacete Cónico com Esfera | 0,72 | 0,52 | 1.800 tris |
| **Torre** | Baluarte Golem de Pedra | Coroamento de 4 Ameias | 0,95 | 0,68 | 2.200 tris |
| **Cavalo** | Montaria / Centauro Chibi | Crina esculpida e Cabeça Equina | 0,98 | 0,62 | 2.400 tris |
| **Bispo** | Clérigo da Ordem Mística | Mitra com fenda oblíqua e Báculo | 1,10 | 0,58 | 2.300 tris |
| **Dama** | Feiticeira Real / Valquíria | Coroa radiante de 7 pontas e Orbe | 1,22 | 0,60 | 2.500 tris |
| **Rei** | Monarca Supremo / Comandante | Cruz imperial proeminente na coroa | 1,28 | 0,65 | 2.500 tris |

### Folha de Turnaround para Geração 3D

Para viabilizar a reconstrução tridimensional precisa via modelos generativos neurais, as folhas de referência de arte conceptual têm de satisfazer especificações geométricas rígidas: apresentação do objeto em projeção ortográfica com três perspetivas paralelas alinhadas (frente, perfil lateral direito e costas), postura neutra de repouso em A (*A-pose*) com braços afastados a 35° do tronco, dedos abertos e pés paralelos apontados para a frente. A iluminação de referência deve ser difusa e homogénea, eliminando sombras de projeção no solo e reflexos especulares fortes, recortada sobre fundo branco puro (`#FFFFFF`).

Character model sheet of a stylized chibi chess Pawn warrior, Teamfight Tactics style, 3D game asset reference. Three full-body views aligned on a horizontal row: front view, side profile view, back view. Proportions: 1:2.3 head-to-body ratio, oversized round helmet topped with a polished ivory sphere, stylized knightly tabard, wide boots. Color palette: ivory ceramic porcelain (#F0F4FC), pale gold trims (#F5BA38), royal blue accents (#2855AA). Neutral A-pose, arms lowered at 35 degrees, hands open, clean silhouette, flat diffused studio lighting, no ground shadows, pure solid white background, 8k resolution, crisp clean edges, hand-painted texture aesthetic.

## Pipeline de Produção 3D com Inteligência Artificial e Otimização

### Avaliação Comparativa de Motores Imagem-para-3D

A conversão de ilustrações bidimensionais estilizadas em malhas volumétricas com geometria limpa e mapeamento UV estruturado exige uma avaliação rigorosa da qualidade visual para personagens de estética anime e cartoon, do custo computacional e das limitações legais de licenciamento comercial.

A tecnologia TRELLIS e a sua evolução TRELLIS.2 (Microsoft Research) destacam-se pela representação baseada em *O-Voxels* e transformadores de fluxo estocástico com 4 mil milhões de parâmetros. Esta arquitetura produz geometrias estruturadas com coordenadas UV limpas e mapas PBR diretamente a partir de imagens simples. O modelo e o código-fonte estão integralmente sob licença MIT, permitindo exploração comercial sem restrições territoriais ou pagamentos de royalties adicionais.

Em contrapartida, soluções abertas como o Tencent Hunyuan3D-2 e 2.1 oferecem excelente definição de malha e texturas pintadas nativas, mas o seu contrato de licença comunitária restringe expressamente a utilização em territórios da União Europeia, Reino Unido e Coreia do Sul, exigindo autorizações adicionais caso se ultrapasse 1 milhão de utilizadores ativos mensais. Tal restrição inviabiliza a sua adoção direta num projeto comercial sediado ou direcionado a mercados europeus.

Plataformas alojadas como o Tripo3D disponibilizam ferramentas avançadas de retopologia quadrada automática (*Smart Mesh*) e esqueletos automáticos. O seu plano gratuito opera sob licença Creative Commons Attribution 4.0 (CC-BY 4.0), permitindo exploração comercial mediante atribuição expressa, enquanto os planos pagos transferem todos os direitos de propriedade intelectual. O Meshy.ai opera de forma semelhante, atribuindo CC-BY 4.0 no plano gratuito com necessidade de menção nos créditos e cedência comercial plena nos planos profissionais.

| Plataforma / Modelo | Qualidade de Malha e Textura Estilizada | Custo / Quota Gratuita | Acesso Operacional | Termos de Licenciamento Comercial |
| --- | --- | --- | --- | --- |
| **Microsoft TRELLIS / TRELLIS.2** | Excelente; topologia nítida via *O-Voxel* com mapas PBR estruturados. | Código aberto gratuito; consome GPU local ou instâncias Replicate (~$0,02/run). | Repositório GitHub, Hugging Face Space e endpoint Replicate. | **Permissivo (MIT)**; exploração comercial sem restrições territoriais. |
| **Tencent Hunyuan3D-2 / 2.1** | Muito elevada; definição de superfícies e pintura de texturas de nível de produção. | Gratuito local ou via Gradio Web; requer GPU de 12 GB a 24 GB. | Repositório GitHub oficial e servidores Gradio locais. | **Restritivo**; Licença Comunitária proíbe uso na União Europeia e Reino Unido. |
| **Tripo3D (v2.0)** | Muito boa; topologia quad limpa com retopologia nativa e auto-rig integrado. | 200 créditos gratuitos/mês (~13 modelos); planos pagos desde $20/mês. | Web Studio, API REST e *plugin* oficial para Blender. | Gratuito requer atribuição (CC-BY 4.0); versões pagas concedem uso comercial total. |
| **Meshy.ai (v4)** | Boa fidelidade cromática; malha densa requer decimação externa. | 100 créditos gratuitos renováveis mensalmente. | Web Studio e API REST. | Plano gratuito impõe CC-BY 4.0 com menção obrigatória; comercial pleno apenas em planos pagos. |
| **Hyper3D Rodin** | Elevada qualidade em modelos orgânicos; malhas de densidade elevada. | Modelo pay-per-generation com créditos de teste na criação de conta. | Plataforma Web e API Cloud. | Comercializável para bens descarregados com créditos comerciais. |
| **SF3D (Stability AI)** | Geração ultrarrápida (0,5 s); textura de baixa resolução UV esticada. | Código aberto; disponível no Hugging Face. | Local ou Space Hugging Face. | Licença Comunitária Stability AI (restrições a grandes empresas). |

A tecnologia recomendada para o pipeline principal é o Microsoft TRELLIS / TRELLIS.2, suportado pela sua licença MIT e geração de ficheiros GLB consistentes. Como solução alternativa de contingência (Plano B), recomenda-se o Tripo3D Studio, recorrendo à quota gratuita com menção CC-BY 4.0 nos créditos e transição para o plano Pro de $20/mês quando for necessária retopologia quadrada direta (*Smart Mesh*) e esqueletos pré-configurados.

### Topologia, Decimação e Padronização de Malhas

Os ficheiros brutos gerados pelas ferramentas neurais contêm frequentemente entre 150.000 e 600.000 polígonos irregulares. A conversão para recursos prontos para Three.js requer a aplicação de etapas padronizadas de limpeza geométrica.

A malha das 12 peças regulares de xadrez é decimada para um teto estrito de 2.500 triângulos por peça. As 13 personagens de Ultimate recebem um limite superior de 4.500 triângulos devido à complexidade de adereços dinâmicos (como asas, mantos e acessórios).

O sistema de coordenadas UV é remapeado num único atlas quadrado de dimensão 1024 × 1024 píxeis para difusão (`baseColor`), armazenando informações de iluminação oclusa ambiente (*Ambient Occlusion*) e iluminação vertical pintada diretamente no canal cromático.

O eixo de rotação e translação (*Pivot Point*) é centrado geometricamente na base inferior do modelo no solo exato: X = 0,0, Y = 0,0, Z = 0,0. A escala é normalizada de modo a que 1,0 unidade no software de modelação corresponda rigorosamente a 1,0 unidade de mundo no Three.js (a dimensão de uma casa do tabuleiro). A rotação padrão da malha é fixada com a face voltada para o semieixo +Z, alinhando-se naturalmente com o plano frontal da câmara em Three.js.

### Rigging Automático e Especificação da Biblioteca de Animações

O esqueleto de animação (*armature*) para proporções *chibi* necessita de uma cadeia óssea simplificada, limitando o número total a um máximo de 24 ossos para manter o consumo computacional reduzido nas transformações de vértices por matrizes de pele (*GPU vertex skinning*). As ferramentas automáticas de rigging convencionais como o Adobe Mixamo ou o Reallusion AccuRIG assumem proporções anatómicas convencionais de 7 a 8 cabeças, o que conduz frequentemente a dobras anómalas na cintura ou colapso da caixa torácica quando aplicadas a corpos curtos.

A adaptação correta nestas ferramentas de rigging requer posicionar manualmente os marcadores articulares no assistente: o marcador do queixo deve ser subido para a linha da mandíbula inferior, a pélvis (*Groin*) deve descer para 35% da altura total do corpo, e os cotovelos e joelhos devem ser ligeiramente projetados para a frente e para trás respetivamente, estabelecendo um vetor de pré-dobragem (*pole vector*) positivo para os solucionadores cinemáticos inversos.

| Clipe de Animação | Duração (ms) | Taxa (fps) | Curva / Modo de Reprodução | Origem do Recurso / Biblioteca |
| --- | --- | --- | --- | --- |
| `idle` | 1.200 ms | 30 | Cíclica (*Loop*), oscilação vertical sénica | Mixamo (ajustado) / CC0 Quaternius |
| `move_hop` | 420 ms | 30 | Disparo único (*Clamp*), antecipação e salto | Animação processada via script Blender |
| `attack_melee` | 650 ms | 30 | Disparo único; impacto ao frame 11 (360 ms) | Mixamo / Biblioteca Chibi estilizada |
| `hit_react` | 320 ms | 30 | Disparo único; recuo rápido e recuperação | Mixamo (*Standing React*) |
| `shatter_death` | 850 ms | 30 | Disparo único; colapso com escala decrescente | Script procedural Blender / Keyframes |
| `victory_spin` | 1.400 ms | 30 | Cíclica ou Disparo único; salto e giro 360° | Mixamo (*Cheering / Flair*) |
| `taunt_emote` | 1.100 ms | 30 | Disparo único; saudação ou agitar de arma | Mixamo (*Taunt*) |

Para mitigar a deformação de volumes nas juntas de pernas e braços muito curtos nas personagens com proporções 1:2, o peso dos vértices (*vertex skinning weights*) nas extremidades é associado predominantemente a influências rígidas (com 1 a 2 ossos influenciadores no máximo por vértice), evitando perdas indesejadas de massa por interpolação de matrizes lineares.

### Scripts de Automação Headless para Blender

O agente de código executa o processamento de modelos através da linha de comandos executando o Blender em modo não interativo (*headless*), aplicando decimação proporcional, normalização geométrica de pivô, reorientação de eixos e exportação para o formato glTF 2.0 binário (`.glb`):

Python

```
# process_character.py - Execução via: blender --background --python process_character.py -- input.glb output.glb 2500 1.0
import bpy
import sys
import os
from mathutils import Vector

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []

input_path = argv[0]
output_path = argv[1]
target_faces = int(argv[2]) if len(argv) > 2 else 2500
target_height = float(argv[3]) if len(argv) > 3 else 1.0

# 1. Limpar cena inicial
bpy.ops.wm.read_factory_settings(use_empty=True)

# 2. Importar ficheiro gerado pela IA
bpy.ops.import_scene.gltf(filepath=input_path)
mesh_objs = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
if not mesh_objs:
    print("Erro: Nenhuma malha detetada no ficheiro de origem.")
    sys.exit(1)

# Ativar a primeira malha como objeto de trabalho
target_obj = mesh_objs[0]
bpy.context.view_layer.objects.active = target_obj
target_obj.select_set(True)

# 3. Consolidar malhas se existirem múltiplos nós
if len(mesh_objs) > 1:
    for o in mesh_objs:
        o.select_set(True)
    bpy.ops.object.join()
    target_obj = bpy.context.active_object

# 4. Ajustar coordenadas de rotação e calcular limites
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bbox = [target_obj.matrix_world @ Vector(corner) for corner in target_obj.bound_box]

min_z = min([v.z for v in bbox])
max_z = max([v.z for v in bbox])
current_height = max_z - min_z

# 5. Mover pivô para a base inferior e centrar eixos X/Y
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.transform.translate(value=(-target_obj.location.x, -target_obj.location.y, -min_z))
bpy.ops.object.mode_set(mode='OBJECT')

# 6. Escalar para a altura normalizada especificada
if current_height > 0.0001:
    scale_factor = target_height / current_height
    target_obj.scale = (scale_factor, scale_factor, scale_factor)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# 7. Decimação de geometria com preservação de topologia de bordo
current_tris = len(target_obj.data.polygons)
if current_tris > target_faces:
    ratio = float(target_faces) / float(current_tris)
    mod = target_obj.modifiers.new(name="Decimate_Opt", type='DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier="Decimate_Opt")

# 8. Exportar para GLB binário com normais limpas
bpy.ops.export_scene.gltf(
    filepath=output_path,
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_animations=True,
    export_skins=True,
    export_morph=False
)
print(f"Sucesso: Processado {output_path} | Triângulos finais: {len(target_obj.data.polygons)}")
```

### Otimização e Compressão com glTF-Transform

O pacote de ferramentas de linha de comandos `@gltf-transform/cli` executa uma série encadeada de passos de otimização estrutural na malha e nos atlas de textura. Cada operação atende a restrições específicas:

Bash

```
# 1. Instalação global da CLI via Node.js
npm install --global @gltf-transform/cli

# 2. Pipeline de otimização de geometria e texturas WebP (Máxima compatibilidade móvel)
gltf-transform optimize input.glb output_temp.glb \
  --flatten false \
  --join false \
  --weld true \
  --simplify true \
  --simplify-error 0.001 \
  --simplify-ratio 0.85 \
  --texture-compress webp \
  --texture-size 1024

# 3. Compressão binária final de atributos de malha via Meshoptimizer
gltf-transform meshopt output_temp.glb assets/pieces/pawn_white.glb \
  --level high

# 4. Limpeza de ficheiros temporários intermédios
rm output_temp.glb
```

Quando o ambiente de destino suporta extensões de texturas comprimidas diretamente em GPU, o comando `--texture-compress ktx2` substitui a conversão WebP. Os mapas de difusão são comprimidos com o algoritmo de compressão de blocos ETC1S, enquanto mapas de normais e oclusão utilizam o modo UASTC. O ficheiro final resultante de cada peça atinge uma volumetria entre 180 kB e 320 kB. As personagens de Ultimate completas comprimem para valores entre 450 kB e 650 kB, cumprindo com folga os orçamentos de largura de banda na web.

## Integração em Three.js r160 sem Camada de Compilação

### Arquitetura de Módulos e Espaço de Nomes Global

De modo a cumprir a restrição arquitetural de ausência de compiladores e empacotadores modernos (*no-bundler*), a inicialização dos módulos fundamentais da biblioteca Three.js assenta no ficheiro `three-bridge.js`. Este script importa as dependências diretamente através de um `importmap` apontado para a rede de distribuição de conteúdos jsDelivr, expondo os objetos essenciais no espaço global do navegador (`window.THREE` e `window.THREE_ADDONS`):

JavaScript

```
// assets/js/three-bridge.js (Módulo ES isolado)
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';

window.THREE = THREE;
window.THREE_ADDONS = {
  GLTFLoader: GLTFLoader,
  DRACOLoader: DRACOLoader,
  MeshoptDecoder: MeshoptDecoder,
  SkeletonUtils: SkeletonUtils
};

window.dispatchEvent(new CustomEvent('three-bridge-ready'));
```

Todos os scripts subsequentes do motor gráfico organizam-se sob o espaço de nomes `window.YC` e são carregados sequencialmente através de elementos `<script>` convencionais na página `index.html`.

### Gestor de Recursos e Clonagem Esquelética

A renderização simultânea de até 32 peças no tabuleiro e figuras de invocação ativa requer a reutilização partilhada de malhas e atlas de materiais em memória. A clonagem de objetos que contêm armaduras esqueléticas dinâmicas (`SkinnedMesh`) não pode ser realizada através do método padrão `clone()`, uma vez que os ossos da nova instância ficariam vinculados à matriz do esqueleto de origem. Recorre-se, obrigatoriamente, à função utilitária `SkeletonUtils.clone()`:

JavaScript

```
// src/view3d/ModelLib.js
(function() {
  window.YC = window.YC || {};

  const cache = new Map();
  let loader = null;

  function initLoader() {
    if (loader) return;
    loader = new window.THREE_ADDONS.GLTFLoader();
    
    loader.setMeshoptDecoder(window.THREE_ADDONS.MeshoptDecoder);

    const dracoLoader = new window.THREE_ADDONS.DRACOLoader();
    dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/');
    loader.setDRACOLoader(dracoLoader);
  }

  window.YC.ModelLib = {
    loadModel: function(key, url) {
      initLoader();
      if (cache.has(key)) {
        return Promise.resolve(cache.get(key));
      }
      return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => {
          gltf.scene.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = false;
              child.receiveShadow = false;
              if (child.material && child.material.map) {
                child.material.map.anisotropy = 4;
              }
            }
          });
          cache.set(key, gltf);
          resolve(gltf);
        }, undefined, (err) => {
          console.error(`Falha no carregamento do modelo 3D: ${url}`, err);
          reject(err);
        });
      });
    },

    instantiate: function(key) {
      if (!cache.has(key)) {
        throw new Error(`Modelo [${key}] não foi pré-carregado na biblioteca.`);
      }
      const rawGltf = cache.get(key);
      const clonedScene = window.THREE_ADDONS.SkeletonUtils.clone(rawGltf.scene);
      
      const mixer = new window.THREE.AnimationMixer(clonedScene);
      const actions = {};

      if (rawGltf.animations && rawGltf.animations.length > 0) {
        rawGltf.animations.forEach((clip) => {
          actions[clip.name] = mixer.clipAction(clip);
        });
      }

      return {
        root: clonedScene,
        mixer: mixer,
        actions: actions,
        currentAction: null
      };
    }
  };
})();
```

### Controlo de Animações e Transições Cruzadas

A fluidez dos movimentos táticos depende de transições contínuas (*crossfade*) entre os estados de repouso, deslocamento, golpe e impacto. O componente de controlo de animação gere as instâncias do `AnimationMixer` sem sobreposições descontinuadas:

JavaScript

```
// src/view3d/PieceAnimator.js
(function() {
  window.YC = window.YC || {};

  window.YC.playAnimation = function(instance, clipName, options) {
    const opts = Object.assign({
      duration: 0.20,
      loop: window.THREE.LoopRepeat,
      repetitions: Infinity,
      timeScale: 1.0
    }, options);

    const nextAction = instance.actions[clipName];
    if (!nextAction) {
      console.warn(`Aviso: Clipe de animação [${clipName}] inexistente na instância.`);
      return null;
    }

    const prevAction = instance.currentAction;
    nextAction.reset();
    nextAction.setLoop(opts.loop, opts.repetitions);
    nextAction.clampWhenFinished = (opts.loop === window.THREE.LoopOnce);
    nextAction.timeScale = opts.timeScale;
    nextAction.play();

    if (prevAction && prevAction !== nextAction) {
      prevAction.crossFadeTo(nextAction, opts.duration, true);
    }

    instance.currentAction = nextAction;
    return nextAction;
  };
})();
```

### Sistema de Sombra Falsa e Vinculação de Eventos

A renderização clássica de sombras em tempo real através de mapas de profundidade (*Cascaded Shadow Maps*) exige múltiplas passagens adicionais na GPU para as 32 peças ativas. Este processo é excessivamente pesado para os chips gráficos integrados em dispositivos móveis e portáteis. Substitui-se este mecanismo por uma malha plana de geometria quadrilátera simples (`PlaneGeometry(0.85, 0.85)`) posicionada logo acima do pavimento (Y = 0,002), orientada horizontalmente (X = -pi / 2), na qual é aplicado um material translúcido básico com textura de gradiente radial escuro e mistura multiplicativa (`blending: THREE.MultiplyBlending`, `depthWrite: false`).

A sincronização entre as ordens lógicas do motor de xadrez e o motor gráfico de renderização é orquestrada diretamente pelas notificações de eventos emitidas por `emitAsync`:

JavaScript

```
// src/view3d/GamePieceBinding.js
(function() {
  window.YC = window.YC || {};

  window.YC.bindGameEvents = function(engine, pieceViewMap, boardStage) {
    // 1. Lance de movimento de peça no tabuleiro
    engine.on('piece:move', async function(evt) {
      const view = pieceViewMap.get(evt.pieceId);
      if (!view) return;

      const targetX = evt.toSquare.col - 3.5;
      const targetZ = evt.toSquare.row - 3.5;

      window.YC.playAnimation(view.instance, 'move_hop', { loop: window.THREE.LoopOnce });

      await new Promise(resolve => {
        const tl = gsap.timeline({ onComplete: resolve });
        tl.to(view.instance.root.position, {
          x: targetX,
          z: targetZ,
          duration: 0.42,
          ease: "power2.inOut"
        }, 0);
        tl.to(view.instance.root.position, {
          y: 0.35,
          duration: 0.21,
          yoyo: true,
          repeat: 1,
          ease: "power1.out"
        }, 0);
      });

      window.YC.playAnimation(view.instance, 'idle', { duration: 0.15 });
    });

    // 2. Declaração e resolução de captura
    engine.on('capture:declare', async function(evt) {
      const attacker = pieceViewMap.get(evt.attackerId);
      const defender = pieceViewMap.get(evt.defenderId);
      if (!attacker) return;

      window.YC.playAnimation(attacker.instance, 'attack_melee', { loop: window.THREE.LoopOnce });

      await new Promise(r => setTimeout(r, 360));

      if (defender) {
        window.YC.playAnimation(defender.instance, 'hit_react', { loop: window.THREE.LoopOnce });
      }
    });

    // 3. Eliminação e estilhaçamento da peça
    engine.on('piece:destroy', async function(evt) {
      const victim = pieceViewMap.get(evt.pieceId);
      if (!victim) return;

      window.YC.playAnimation(victim.instance, 'shatter_death', { loop: window.THREE.LoopOnce });

      await new Promise(resolve => {
        gsap.to(victim.instance.root.scale, {
          x: 0.01,
          y: 0.01,
          z: 0.01,
          duration: 0.45,
          delay: 0.20,
          ease: "back.in(1.7)",
          onComplete: () => {
            boardStage.remove(victim.instance.root);
            pieceViewMap.delete(evt.pieceId);
            resolve();
          }
        });
      });
    });
  };
})();
```

### Pré-Compilação de Shaders e Fallback de Contingência

Para evitar paragens (*stuttering*) nos primeiros lances de combate causadas pela compilação síncrona dos shaders WebGL pela gráfica, executa-se obrigatoriamente um ciclo de pré-aquecimento (*warm-up*) antes de transitar para a partida. A função `renderer.compile(scene, camera)` é chamada enquanto a interface apresenta o ecrã de carregamento:

JavaScript

```
// src/view3d/StageWarmup.js
(function() {
  window.YC = window.YC || {};

  window.YC.warmupStage = function(renderer, scene, camera, dummyLibrary) {
    const warmupGroup = new window.THREE.Group();
    warmupGroup.position.set(0, -100, 0);
    scene.add(warmupGroup);

    dummyLibrary.forEach((modelKey) => {
      try {
        const dummy = window.YC.ModelLib.instantiate(modelKey);
        warmupGroup.add(dummy.root);
      } catch (e) {
        console.warn(`Não foi possível pré-compilar o recurso: ${modelKey}`);
      }
    });

    renderer.compile(scene, camera);
    scene.remove(warmupGroup);
  };
})();
```

Caso o utilizador corra a aplicação num navegador sem suporte WebGL2 funcional, ou caso ocorra uma falha no carregamento de um ficheiro `.glb`, o gestor gráfico ativa o mecanismo de contingência: cria uma peça paramétrica através do método clássico `LatheGeometry` (preservando o pipeline por código original), mantendo o jogo perfeitamente operacional e sincronizado com os eventos da partida sem quebrar a sessão online.

## Ultimates em Três Dimensões e Transformação de Peças

### Transposição de Ilustrações 2D de Anime para Modelos 3D

O catálogo de 13 cartas Lendárias do jogo apoia-se em ilustrações bidimensionais com estética de banda desenhada japonesa (*cel shading* com traço exterior grosso). A produção de modelos 3D que mantenham fidelidade a estas ilustrações exige a criação intermédia de uma ficha técnica de ângulos múltiplos (*turnaround*) através do Gemini Imagen 3, servindo de base de extração para o gerador volumétrico:

Orthographic full-body turnaround model sheet of the character Akane, the Ruby Queen, keeping 100% exact fidelity to the provided anime key visual. Three views side-by-side in a horizontal composition: front view, profile side view, and rear view. Neutral A-pose with arms spaced 35 degrees from torso, fingers relaxed. Maintain costume details: ruby gemstone scepter, crimson tiara, layered royal velvet mantle. Stylized cell-shaded anime style, clean outlines, flat diffuse colors, uniform lighting, zero projected floor shadows, pure plain white background (#FFFFFF). High resolution, perfectly aligned head height, waistline, and feet across all three angles.

A folha ortográfica resultante é processada no pipeline TRELLIS ou Tripo3D, obtendo-se o modelo 3D estilizado com rig e textura estruturada.

### Storyboard da Sequência de Transformação de Ultimate

A metamorfose de uma peça convencional de xadrez na respetiva personagem Lendária em 3D constitui o momento de maior impacto visual do jogo. Em vez de depender de ficheiros de vídeo pesados pré-gravados, a sequência é renderizada dinamicamente pelo próprio motor Three.js ao longo de 1.200 milissegundos, recorrendo a deformações de escala, emissores de partículas e manipulação da câmara.

A cronologia da sequência divide-se estruturalmente em cinco fases contínuas:

No intervalo inicial de Antecipação da Peça (0 ms a 300 ms), a peça de xadrez sofre uma compressão vertical suave (*squash* com fator Y = 0,60 e expansão lateral X, Z = 1,35 gerida pela curva GSAP `power1.in`), acompanhada por uma vibração horizontal sinusoidal nos eixos X e Z de amplitude ± 0,04 unidades a uma frequência de 30 Hz.

Na fase de Erupção de Luz (300 ms a 700 ms), irrompe das casas do tabuleiro um cilindro emissivo translúcido de luz vertical com altura 6,0 unidades e raio 0,80 unidades (cor aditiva `#FCC934` com núcleo central em `#FFFFFF`). Uma fonte pontual de luz temporária ascende rapidamente pelo centro do pilar até à intensidade de 4,5, ativando a passagem de pós-processamento de bloom difuso. A geometria da peça de xadrez inicial é recolhida e retirada da hierarquia de cena.

No segmento de Substituição e Queda (700 ms a 1.000 ms), o modelo 3D da personagem de Ultimate é instanciado no topo do pilar luminotécnico a uma cota vertical Y = 2,8 unidades, descendo em trajetória acelerada (*stretch* vertical Y = 1,30 e X, Z = 0,85 sob curva GSAP `power2.in`), atingindo o pavimento aos 1.000 ms.

No momento do Impacto no Solo (1.000 ms a 1.100 ms), a aterragem desencadeia a expansão de uma malha anelar concêntrica horizontal com raio a variar de 0,30 para 2,40 unidades ao longo de 200 ms, com esbatimento linear de opacidade. Concomitantemente, a câmara executa uma aproximação tática de 1,2 unidades associada a um abanão (*screenshake* com amplitude máxima de 0,15 unidades amortecido por `power2.out`).

Nos momentos finais de Estabilização e Repouso (1.100 ms a 1.200 ms), a personagem executa uma recuperação elástica de volume (*bounce* até à escala normal 1,0) e inicia a sua animação contínua de prontidão de combate (`idle`). A matriz de projeção da câmara reajusta-se para a vista padrão do tabuleiro através da curva GSAP `power2.out`.

| Intervalo (ms) | Ação da Personagem / Geometria | Efeito Visual (VFX) / Iluminação | Movimento de Câmara | Curva de Interpolação (GSAP) |
| --- | --- | --- | --- | --- |
| **0 - 300 ms** | Compressão (*squash* Y: 0.6, XZ: 1.35) e vibração. | Halo circular amarelo no solo; brilho acumulado. | Estática na posição de jogo. | `power1.in` |
| **300 - 700 ms** | Peça recolhe para escala 0.0; remoção de cena. | Pilar cilíndrico emissivo ascende; bloom intenso. | Pequena aproximação angular (0,3 u). | `power2.in` |
| **700 - 1000 ms** | Personagem 3D desce do topo (Y=2,8) com *stretch*. | Partículas aditivas dispersam em cone descendente. | Início de rotação focal suave (0,05 rad). | `power2.in` |
| **1000 - 1100 ms** | Contacto no solo; impacto elástico nos joelhos. | Onda de choque anelar expande (R: 0,3 → 2,4 u). | Abanão estocástico (*shake* 0,15 u). | `elastic.out(1, 0.4)` |
| **1100 - 1200 ms** | Escala normaliza para 1,0; ativa clipe `idle`. | Dissipação de partículas e extinção da luz pilar. | Retorno suave às coordenadas de jogo. | `power2.out` |

### Conjunto de Animações Específicas por Papel de Jogo

As 13 personagens dividem-se em diferentes arquétipos mecânicos que possuem padrões de animação e manifestação tridimensional dedicados:

| Papel (*Role*) | Padrão de Animação 3D | Efeito Visual Concorrente (*VFX*) | Duração da Ação |
| --- | --- | --- | --- |
| **Ataque (*Attack*)** | Avanço físico balístico, execução de golpe giratório com arma e corte descendente no plano da casa. | Rasto de lâmina em fita poligonal translúcida (*Mesh Ribbon Trail*) com tonalidade de equipa. | 650 ms |
| **Guarda (*Guard*)** | Postura firme de bloqueio com pés cravados e elevação de escudo ou barreira com as duas mãos. | Cúpula hemisférica modular com textura de grelha hexagonal translúcida oscilante. | Cíclica (enquanto retiver escudo) |
| **Poder (*Power*)** | Elevação da personagem a 0,4 unidades do solo, abertura de braços e canalização mística em arco. | Anel rúnico no solo a girar em sentido inverso à figura com faíscas aditivas ascendentes. | 800 ms |
| **Armadilha (*Card*)** | Revelação repentina por emergência vertical a partir do chão, como uma emboscada. | Fumo estilizado composto por planos com dispersão esférica e desvanecimento alfa. | 550 ms |
| **Fusão (*Fusion*)** | Salto acrobático convergente com rotação de 720° e aterragem pesada com os dois punhos no piso. | Vórtice espiral duplo de feixes de luz que se fundem num clarão luminoso omnidirecional. | 1.100 ms |

### Estratégia de Transição para os Vídeos Pré-Gravados

Os ficheiros de vídeo atuais consumidos pelas sequências de Ultimate representam cerca de 15 MB na transferência da aplicação e causam bloqueios temporários de carregamento em redes móveis instáveis. Recomenda-se uma estratégia de transição faseada.

Num primeiro momento, preserva-se o vídeo 2D como uma intervenção de banda desenhada ultracurta (*anime cut-in*), mas a sua duração total é encurtada de 5-7 s para um intervalo dinâmico máximo de 1.200 ms a 1.500 ms. Este corte foca-se apenas na expressão dos olhos da personagem, acompanhado pelo som característico de ativação, transitando de imediato para a sequência de transformação 3D em tempo real descrita no storyboard.

Posteriormente, na fase final de maturação técnica do motor, os vídeos pré-renderizados são completamente eliminados do pacote de distribuição. A introdução da figura passa a ser assegurada a 100% por planos de câmara cinemáticos dinâmicos gerados nativamente pelo motor Three.js, reduzindo os requisitos de transferência do pacote web em mais de 70% e assegurando fidelidade estética contínua em qualquer resolução de ecrã.

## Conceção do Ecrã Inicial e Lobby Interativo

### Composição Espacial e Hierarquia de Interface

O ecrã principal de navegação do jogo abandona os elementos estáticos bidimensionais e adota uma cena interativa em tempo real com profundidade espacial, inspirada na apresentação visual do cliente de jogo do *Teamfight Tactics*.

Em termos de organização de camadas, a aplicação divide o ecrã numa cena tridimensional contínua em segundo plano e numa estrutura HTML/CSS superposta. A cena 3D é renderizada num `<canvas>` com posição fixa absoluta em segundo plano (`z-index: 1`, `pointer-events: auto`), permitindo a captura de gestos e arrastos diretamente na mascote interativa. A interface de utilizador situa-se numa camada superior (`z-index: 10`, `pointer-events: none`), na qual apenas os botões, cartões interativos e modais reativam a interatividade através de `pointer-events: auto`.

Em ecrãs de computador de alta resolução (larguras de 1366 px a 2560 px), a cena distribui-se de forma ampla: a ilha flutuante com a mascote ocupa a metade esquerda e central da perspetiva. A barra superior (altura de 64 px) fixa o perfil, nível e moedas. O painel lateral direito acolhe o emblema de liga, a pontuação numérica de Elo, a seleção de baralhos e o botão de ação principal **JOGAR** (240 px × 68 px, amarelo torrado `#FFB703`). O pódio com os três melhores jogadores (*Leaderboard*) surge na extremidade inferior esquerda (280 px × 160 px) em painel de vidro escuro fosco (`rgba(16, 24, 38, 0.75)` com desfoque de fundo `backdrop-filter: blur(8px)`).

Em dispositivos móveis no formato vertical (largura típica de 375 px), o enquadramento reestrutura-se: a câmara recua 1,8 unidades no semieixo +Z e sobe 0,6 unidades no eixo +Y. A ilha flutuante e a mascote posicionam-se no terço superior do visor (35% da altura útil do ecrã). O terço central e inferior aloja o seletor de baralhos e a insígnia da liga, culminando no botão **JOGAR** em posição inferior de acesso direto pelo polegar (290 px × 60 px).

| Elemento de Interface | Localização e Dimensão (Desktop) | Localização e Dimensão (Mobile 375px) | Estilo Cromático / Material |
| --- | --- | --- | --- |
| **Barra Superior de Recursos** | Topo ecrã; alt. 64 px, larg. 100% | Topo ecrã; alt. 52 px, larg. 100% | Fundo `#101826` (85% opacidade), contorno `#253248`. |
| **Ilha 3D com Mascote** | Centro-Esquerda; X: -0.6, Y: -0.4, Z: 0 | Terço Superior; X: 0, Y: 0.2, Z: -1.2 | Pedra rúnica com relva estilizada e dais circular. |
| **Insígnia de Liga e Elo** | Lateral Direita; 320 px × 220 px | Centro; 260 px × 160 px | Vidro fosco, texto `#EEF2F7`, ouro `#FCC934`. |
| **Pódio Melhores Jogadores** | Canto Inferior Esquerdo; 280 px × 160 px | Oculto em gaveta expansível modal | Painel escuro com realces em `#00B4D8`. |
| **Botão de Ação: JOGAR** | Inferior Direito; 240 px × 68 px | Base Central; 290 px × 60 px | Fundo `#FFB703`, borda 3 px `#1E2530`, texto preto. |

### Especificação da Cena 3D do Lobby

A cena de repouso apresenta uma pequena ilha flutuante hexagonal em pedra esculpida com runas e relva estilizada (diâmetro de 3,5 unidades, espessura vertical de 0,80 unidades), posicionada no centro de coordenadas (0; -0,4; 0). Sobre o pedestal surge a mascote tridimensional selecionada pelo jogador (como o pequeno Escudeiro ou uma das personagens de Ultimate desbloqueadas), com animação contínua de respiração e flexão suave (`idle`, ciclo de 1.200 ms).

A câmara perspetiva do lobby é configurada com um campo de visão vertical (FOV) de 38°, posicionada em (0; 1,8; 4,2) e a apontar com precisão para o centro de equilíbrio da mascote em (0; 0,6; 0). A iluminação de estúdio tira partido de uma luz de foco suave colocada em (2,0; 5,0; 3,0) com intensidade 1,4 e tom quente `#FFF2D6`, suportada por uma contraluz ciano `#59E1FF` colocada em ( -2,5; 3,0; -3,0) com intensidade 1,1 para destacar os contornos da personagem contra a ilustração atmosférica noturna do estádio em segundo plano.

### Camada de Interações da Mascote

O utilizador pode interagir com a mascote em 3D através de toques ou arrasto do cursor do rato sobre a área visível do pedestal:

JavaScript

```
// src/view3d/LobbyInteractions.js
(function() {
  window.YC = window.YC || {};

  window.YC.initLobbyInteractions = function(canvas, mascotInstance, camera) {
    let isDragging = false;
    let prevMouseX = 0;
    const raycaster = new window.THREE.Raycaster();
    const mouse = new window.THREE.Vector2();

    canvas.addEventListener('pointerdown', (e) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const intersects = raycaster.intersectObjects(mascotInstance.root.children, true);
      if (intersects.length > 0) {
        isDragging = true;
        prevMouseX = e.clientX;
        
        window.YC.playAnimation(mascotInstance, 'victory_spin', {
          loop: window.THREE.LoopOnce,
          duration: 0.15
        });
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      prevMouseX = e.clientX;

      mascotInstance.root.rotation.y += deltaX * 0.008;
    });

    window.addEventListener('pointerup', () => {
      if (isDragging) {
        isDragging = false;
        gsap.to(mascotInstance.root.rotation, {
          y: 0,
          duration: 0.8,
          ease: "power2.out",
          onComplete: () => {
            window.YC.playAnimation(mascotInstance, 'idle', { duration: 0.25 });
          }
        });
      }
    });
  };
})();
```

As transições de abertura de interfaces modais secundárias (como a Loja de Cartas ou o Construtor de Baralhos) utilizam uma animação de recuo de câmara: a câmara é deslocada lateralmente para ( -2,2; 1,8; 4,2) ao longo de 450 ms com amortecimento `power2.inOut`, cedendo espaço no lado direito do visor para a entrada dos painéis da loja em CSS, integrando fluidamente o mundo tridimensional na navegação web.

## Fluxo da Fila Ranqueada e Ecrã de Carregamento Versus

### Máquina de Estados do Emparelhamento Competitivo

A experiência da fila de emparelhamento estruturada nos moldes competitivos do *Teamfight Tactics* articula-se em quatro fases sequenciais rigorosamente temporizadas.

A primeira fase corresponde ao estado de Procura de Partida (*Matchmaking Queue*). O cliente de jogo exibe um painel flutuante recolhido no topo do ecrã contendo a mensagem *"A procurar adversário..."*, um cronómetro digital ascendente no formato `MM:SS` e um botão funcional cinzento para cancelamento imediato da fila.

A segunda fase inicia-se com a confirmação de Partida Encontrada (*Match Found*). O sistema projeta uma sobreposição modal escura sobre todo o ecrã. O painel central exibe um anel circular de contagem decrescente com duração total de 10 segundos (10.000 ms), desenhado em SVG via propriedade de traço `stroke-dashoffset`. O utilizador dispõe de um botão de destaque **ACEITAR** em verde vibrante `#2EC4B6` e de um botão secundário **RECUSAR** em tom grafite `#3A4454`.

A terceira fase ativa o Ecrã de Carregamento Versus (*Loading Screen*). O ecrã divide-se em duas faixas angulares simétricas com corte diagonal a 12°. A faixa esquerda (azul ciano `#00B4D8`) representa o jogador local e a faixa direita (carmesim `#D90429`) exibe as informações do oponente emparelhado. Cada faixa exibe o modelo 3D da respetiva mascote, o nome da conta, a insígnia da divisão competitiva, a pontuação numérica de Elo e uma barra de progresso horizontal vinculada ao carregamento real dos modelos tridimensionais.

A quarta fase encerra a sequência com a Transição de Entrada no Tabuleiro (*Arena Camera Dive*). Assim que ambas as barras atingem 100%, as faixas deslizam lateralmente para fora do ecrã em 600 ms e a câmara perspetiva executa uma translação e rotação coordenada em 1.400 ms, posicionando-se na perspetiva de comando do tabuleiro de xadrez.

### Ecrã de Carregamento Competitivo (*Versus Loading Screen*)

A barra horizontal de progresso real de carregamento do cliente local reflete a evolução de transferência e inicialização dos recursos glTF através do objeto nativo `THREE.LoadingManager`:

JavaScript

```
// Monitorização de carregamento de recursos com o LoadingManager
const loadManager = new THREE.LoadingManager();
loadManager.onProgress = function(url, itemsLoaded, itemsTotal) {
  const percent = Math.floor((itemsLoaded / itemsTotal) * 100);
  document.getElementById('player-load-fill').style.width = percent + '%';
  document.getElementById('player-load-text').innerText = percent + '%';
};
```

O progresso de transferência do adversário remoto é sincronizado através do envio e receção de mensagens compactas via WebSocket (`match:load_progress`, `{ progress: 0-100 }`).

Nas partidas disputadas em modo individual contra o motor de inteligência artificial (*Bot Match*), a apresentação versus simplifica o fluxo: omite a fase de confirmação de 10 segundos e reduz o tempo de exibição das faixas de confronto para apenas 1.800 ms, dinamizando a transição para utilizadores em jogo casual.

### Transição de Câmara para o Tabuleiro de Jogo

Com a conclusão do processamento de modelos e texturas em ambos os clientes de jogo, as duas faixas angulares da interface recolhem-se deslizando horizontalmente para os extremos exteriores do ecrã em 600 ms com aceleração `power3.in`. Simultaneamente, a câmara perspetiva do motor Three.js executa uma interpolação de trajetória espacial fluida com duração total de 1.400 ms, conectando a perspetiva de exibição do menu de confronto diretamente às coordenadas de comando do tabuleiro:

JavaScript

```
// Transição de câmara cinemática para a vista de xadrez
window.YC.transitionCameraToBoard = function(camera, onComplete) {
  gsap.timeline({ onComplete: onComplete })
    .to(camera.position, {
      x: 0.0,
      y: 11.6,
      z: 9.9,
      duration: 1.4,
      ease: "power3.inOut"
    }, 0)
    .to(camera.rotation, {
      x: -0.864,
      y: 0.0,
      z: 0.0,
      duration: 1.4,
      ease: "power3.inOut"
    }, 0);
};
```

### Síntese de Efeitos Sonoros com a Web Audio API

Para cumprir a meta de minimização de ficheiros de áudio em transferências web e garantir latência nula de resposta em eventos de interface, todos os efeitos sonoros dos ecrãs de espera e confronto são sintetizados dinamicamente via código através de osciladores nativos na Web Audio API:

JavaScript

```
// src/audio/AudioSynthesizer.js
(function() {
  window.YC = window.YC || {};

  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  window.YC.AudioSynth = {
    // 1. Partida Encontrada: Acorde triunfante com sweep ascendente
    playMatchFound: function() {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      
      const freqs = [261.63, 329.63, 392.00, 523.25]; // Dó Maior (C4, E4, G4, C5)
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq * 0.75, now);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.15);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.25 / freqs.length, now + 0.05 + idx * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.03);
        osc.stop(now + 1.3);
      });
    },

    // 2. Pulso de Contagem: Clique ressonante para os segundos finais
    playTimerTick: function() {
      const ctx = getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    },

    // 3. Impacto Versus: Sub-graves potentes e estrondo no embate de placas
    playVersusCrash: function() {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.6);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, now);
      filter.frequency.exponentialRampToValueAtTime(60, now + 0.5);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.75);
    }
  };
})();
```

## Escalões de Classificação Competitiva e Insígnias de Elo

### Distribuição de Ligas do Sistema Elo

O ambiente competitivo do jogo implementa o cálculo clássico de classificação de Elo com fator de dispersão K = 32 e linha de base inicial arbitrada em 1000 pontos. A escala hierárquica reparte-se por seis ligas com nomenclatura e identidade gráfica próprias, inspirando-se em conceitos temáticos de forja, runas e mestria de estratégia:

| Escalão / Liga | Limiar de Pontuação Elo | Inspiração Temática | Heráldica e Materiais do Emblema |
| --- | --- | --- | --- |
| **Ferro-Madeira (*Pawn's Trial*)** | 0 - 999 Elo | Recruta / Casca de Carvalho | Brasão em madeira polida com aros de ferro rústico escovado; entalhe central de um escudo de infantaria. |
| **Pedra-Bronze (*Challenger Stone*)** | 1000 - 1199 Elo | Forja Rúnica de Aprendiz | Rocha basáltica escura lapidada com ornatos de bronze antigo fundido; runa brilhante incrustada no centro. |
| **Prata-Gélida (*Glacial Sentinel*)** | 1200 - 1399 Elo | Fortaleza do Norte / Geada | Escudo ogival de prata polida radiante com cristais de gelo pontiagudos de topázio azul nas extremidades. |
| **Ouro-Solar (*Gilded Crest*)** | 1400 - 1599 Elo | Feitiçaria Imperial Nobre | Estrutura de ouro cinzelado reluzente com asas estilizadas laterais e gema central em rubi encarnado lapidado. |
| **Cobalto-Arcano (*Astral Cobalt*)** | 1600 - 1799 Elo | Magia Celestial Cósmica | Platina fosca entrelaçada com filamentos de cobalto pulsante; centro composto por uma órbita estelar esférica. |
| **Soberano (*Grand Sovereign*)** | 1800+ Elo | Mestre dos Reis e Coroas | Coroa imperial imponente de ouro negro e diamantes flutuantes com chamas translúcidas de energia mística. |

### Especificação de Prompts para o Gemini Imagen 3

Para garantir consistência vetorial e volumétrica entre as seis insígnias de liga, os pedidos de criação de arte conceptual recorrem a parâmetros descritivos padronizados:

Game rank badge icon for 'Gilded Crest' tier, Teamfight Tactics and League of Legends ranked emblem art style. Highly detailed stylized 3D game asset icon, frontal orthographic view. Winged shield silhouette made of polished radiant chiseled gold, filigree ornamental baroque curves, encrusting a glowing polished crimson ruby in the core. Symmetrical composition, bold readable metallic shapes, clean bevels, high-end mobile UI game asset, hand-painted texture aesthetic with specular rim highlights. Isolated on a solid flat white background (#FFFFFF), no cast shadows, 8k resolution, crisp clean border cutout.

## Plano de Implementação e Arquitetura de Ficheiros

### Cronograma de Entrega por Fases Modulares

O projeto é estruturado em cinco fases de desenvolvimento e verificação técnica. Cada fase pode ser implementada, executada e testada de forma independente pelo agente de código Claude Code, sem dependências cruzadas pendentes.

A Fase 1 foca-se na Fundação Gráfica e Sistema de Malhas de Reserva. Estabelece a importação de dependências em `three-bridge.js`, o gestor `src/view3d/ModelLib.js` com descodificadores Meshopt e Draco, o utilitário de clonagem `SkeletonUtils.clone` e o material base estilizado com injeção de *Rim Light*. Desenvolve também o módulo `src/view3d/FallbackPieceFactory.js` para garantir contingência imediata caso a malha 3D falhe. O critério de aceitação exige 60 FPS com 32 malhas clonadas em cena e compilação inicial de shaders inferior a 250 ms.

A Fase 2 dedica-se à Produção e Substituição das 12 Peças de Tabuleiro. Realiza o processamento e decimação das malhas em Blender headless, comprime os ficheiros via `gltf-transform` para valores inferiores a 300 kB por unidade e desenvolve `src/view3d/PieceModels.js`, associando as peças aos eventos de motor (`piece:move`, `capture:declare`, `piece:destroy`). O critério de aceitação estabelece transferência total das peças abaixo de 3,5 MB e reconhecimento de silhueta validado a 52,7° de inclinação da câmara.

A Fase 3 implementa a Interface Ranqueada Competitiva e Ecrã de Confronto. Constrói os componentes visuais `src/ui/MatchFound.js` e `src/ui/LoadingVS.js`, associando o carregamento dos ficheiros à barra de percentagem e integrando a síntese de som nativa em `src/audio/AudioSynthesizer.js`. O critério de aceitação valida o fluxo completo em 10 segundos, sem fugas de memória e com transição de câmara contínua para o tabuleiro.

A Fase 4 introduz as Ultimates Tridimensionais e Mecânica de Metamorfose. Desenvolve `src/view3d/UltModels.js` para as 13 figuras originais, implementando o storyboard dinâmico de 1.200 milissegundos com pilar de luz, expansão anelar de onda de choque, oscilação de câmara e transição para as animações de combate (`attack`, `guard`, `power`, `card`, `fusion`). O critério de aceitação exige metamorfose completa sem quedas de fotogramas abaixo de 55 FPS em dispositivos móveis.

A Fase 5 encerra o desenvolvimento com o Lobby Tridimensional e Polimento Geral. Constrói `src/view3d/LobbyStage3D.js` com a ilha rúnica hexagonal e a mascote interativa sensível a toques e rotação, posicionando as insígnias de liga no perfil. Executa a auditoria final de desempenho nos navegadores Chrome, Safari Mobile e Firefox. O critério de aceitação estipula carregamento inicial do lobby abaixo de 1,5 segundos em rede móvel 4G e estabilidade contínua a 60 FPS.

### Estrutura de Ficheiros e Limites de Código

De forma a respeitar as boas práticas de manutenção de software por agentes de programação automática, cada ficheiro de código-fonte é concebido de forma autocontida, com extensão máxima parametrizada em aproximadamente 350 linhas de instruções:

```
chess-gioh/
├── index.html
├── assets/
│   ├── js/
│   │   └── three-bridge.js
│   ├── models/
│   │   ├── pieces/
│   │   │   ├── pawn_white.glb
│   │   │   ├── king_black.glb
│   │   │   └── ...
│   │   ├── characters/
│   │   │   ├── akane.glb
│   │   │   └── ...
│   │   └── stage/
│   │       ├── lobby_island.glb
│   │       └── blob_shadow.png
│   └── icons/
│       └── ranks/
├── src/
│   ├── audio/
│   │   └── AudioSynthesizer.js
│   ├── ui/
│   │   ├── MatchFound.js
│   │   ├── LoadingVS.js
│   │   └── LobbyUI.js
│   └── view3d/
│       ├── ModelLib.js
│       ├── FallbackPieceFactory.js
│       ├── PieceAnimator.js
│       ├── PieceModels.js
│       ├── UltModels.js
│       └── LobbyStage3D.js
```

### Orçamentos Rigorosos de Desempenho e Memória

A tabela técnica seguinte define as balizas de consumo de recursos que a equipa de engenharia deve validar e auditar em cada marco de entrega:

| Indicador de Desempenho | Meta para Secretária (*Desktop*) | Meta para Dispositivo Móvel (Android/iOS) | Medição no Chrome DevTools |
| --- | --- | --- | --- |
| **Taxa de Fotogramas (*Frame Rate*)** | 60 FPS estáveis | 60 FPS (mínimo absoluto 52 FPS em picos de VFX) | Aba *Performance* / Painel Rendering |
| **Número de Chamadas de Desenho (*Draw Calls*)** | ≤ 65 por fotograma | ≤ 45 por fotograma | Medido em `renderer.info.render.calls` |
| **Orçamento Geométrico Total no Tabuleiro** | ≤ 85.000 triângulos | ≤ 60.000 triângulos | Medido em `renderer.info.render.triangles` |
| **Tamanho Médio por Peça Comprimida** | 250 kB (GLB Meshopt) | 250 kB (GLB Meshopt) | Separador *Network* com filtro de recursos |
| **Tamanho Médio por Personagem Ultimate** | 500 kB (GLB Meshopt) | 500 kB (GLB Meshopt) | Separador *Network* com filtro de recursos |
| **Pegada Global de Recursos de Arte 3D** | ≤ 10 MB total | ≤ 10 MB total | Tamanho combinado da pasta `assets/` |
| **Consumo de Memória de Vídeo (*VRAM*)** | ≤ 120 MB | ≤ 75 MB | Separador *Memory* / Alocação de buffers WebGL |

## Anexo de Prompts de Geração e Comandos Técnicos

### Catálogo de Prompts para o Gemini Imagen 3

Todos os pedidos de geração de imagem devem utilizar os textos padronizados seguintes para assegurar uniformidade estilística em toda a biblioteca de recursos do jogo:

Character model sheet of a stylized chibi chess White King, Teamfight Tactics and Clash Mini aesthetic. Three full-body views aligned on a single row: front view, profile side view, rear view. Proportions: 1:2.4 head-to-body ratio, regal mature expression, large stylized mustache, wearing a high imperial crown topped with a prominent cross. Elegant royal mantle with ermine collar trims. Color palette: polished ivory ceramic (#F0F4FC), royal blue fabric accents (#2855AA), warm satin gold ornaments (#F5BA38). Clean A-pose, arms lowered at 35 degrees, hands resting open, sharp readable silhouettes, diffused neutral studio illumination, no ground shadows, pure plain white background (#FFFFFF), 8k resolution.

Character model sheet of a stylized chibi chess Black Queen, Teamfight Tactics aesthetic, 3D video game asset reference. Three full-body views side by side: front view, side profile view, back view. Proportions: 1:2.5 head-to-body ratio, confident arch-mage expression, towering radiant crown with 7 sharp points, floating crystalline arcane orb hovering near her right palm, dark majestic robe. Color palette: brushed obsidian metal (#1E2235), dark silver trims (#8D99AE), rich crimson cloth lining (#851928). Neutral A-pose, clean borders, diffuse lighting, no ground reflections or floor shadows, solid white background (#FFFFFF), 8k, crisp hand-painted style.

Full-body character design sheet of Akane, the Ruby Queen, anime style with Teamfight Tactics chibi heroic proportions. Front, side, and rear orthographic views aligned horizontally. Proportions: 1:2.5 head-to-body ratio, crimson twintail hair, regal ruby tiara, high-collared scarlet dress with gold filigree and flowing royal capelet, holding a magical golden scepter with an oversized glowing red ruby gem. Confident anime heroine expression. Symmetrical A-pose, clean hand-drawn ink contours, cell-shaded vibrant colors, flat diffuse lighting, isolated on solid white background (#FFFFFF), no shadows on floor, production model sheet quality.

Full-body character design sheet of Kaito, the Azure Guardian, anime style with stylized chibi proportions. Three views on one canvas: front, side, back. Proportions: 1:2.3 ratio, spiky dark blue hair, heroic paladin breastplate, wielding an oversized hexagonal crystalline energy shield on his left arm, wearing high armored greaves. Color scheme: deep navy blue, cyan glowing accents, silver armor plating. Symmetrical neutral A-pose, crisp cell-shaded rendering, clean anime outline, diffused light, solid white background (#FFFFFF), no ground shadows.

Stylized 3D floating arena pedestal, Teamfight Tactics game lobby platform. Hexagonal floating stone island with carved glowing celestial runes, trimmed with vibrant stylized green grass tufts on top, weathered stone steps, and an embedded round bronze dais in the center. Fantasy anime mobile game environment asset. Clean isometric perspective, smooth beveled corners, rich hand-painted diffuse texture appearance, rim lighting from upper right, soft ambient illumination, isolated on pure white background (#FFFFFF).

### Comandos de Terminal para Otimização de Ficheiros

O conjunto de comandos abaixo detalha os passos exatos de terminal que o programador deve executar para preparar e compactar os modelos:

Bash

```
# 1. Instalar as dependências globais necessárias via npm
npm install --global @gltf-transform/cli

# 2. Executar o processamento headless do Blender num modelo bruto da IA
blender --background --python process_character.py -- \
  raw_pawn.glb temp_pawn.glb 2500 0.72

# 3. Inspecionar propriedades e limites geométricos do ficheiro resultante
gltf-transform inspect temp_pawn.glb

# 4. Encadeamento de limpeza estrutural e conversão de texturas para WebP
gltf-transform optimize temp_pawn.glb optimized_temp.glb \
  --flatten false \
  --join false \
  --weld true \
  --simplify true \
  --simplify-error 0.001 \
  --simplify-ratio 0.85 \
  --texture-compress webp \
  --texture-size 1024

# 5. Aplicação da compressão de alta densidade Meshoptimizer
gltf-transform meshopt optimized_temp.glb assets/models/pieces/pawn_white.glb \
  --level high

# 6. Validação estrita do ficheiro segundo a especificação Khronos glTF
gltf-transform validate assets/models/pieces/pawn_white.glb

# 7. Remoção de ficheiros intermédios temporários
rm temp_pawn.glb optimized_temp.glb
```

