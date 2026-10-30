# Prompt para o Deep Research do Gemini — peças 3D, Ultimates em 3D, ecrã inicial e VS ao estilo TFT

Copiar tudo o que está dentro do bloco abaixo e colar no Gemini → Deep Research. **Anexar as 4 capturas** de
`_tmp_art/capturas/` (fora do git): `1-arena.jpg` (ecrã inicial), `2-partida-ultimates.jpg` (tabuleiro com 6 peças
transformadas em personagens), `3-pecas-perto.png` (as peças de perto) e `4-ultimate-cutin.jpg` (entrada de uma
Ultimate). Quando o relatório estiver pronto, partilhar o link da conversa (ou exportar para Docs/PDF) e dá-lo ao
Claude Code para implementar.

```text
Atua como diretor de arte e "technical artist" sénior de jogos de estratégia com personagens 3D estilizadas (nível
Riot Games / Teamfight Tactics, Hearthstone Battlegrounds, Clash Mini, Marvel Snap), com experiência em pipelines 3D
com IA (imagem → modelo 3D), rigging e animação, e em WebGL/Three.js. Quero um relatório de investigação completo e
prático para levar a parte gráfica de um jogo web de "brinquedos de plástico simples" para "figuras 3D de autobattler
ao estilo TFT". O relatório vai ser entregue a um programador (um agente de código: Claude Code) que o vai implementar
à letra, por isso preciso de passos exatos, números (unidades, triângulos, MB, ms, curvas de easing, hex), comandos de
ferramentas e código de exemplo — não de generalidades. Escreve em português de Portugal. Anexo 4 capturas do jogo
atual.

## 1. O jogo
"Chess-Gi-Oh! Cartoon Edition": xadrez a sério (regras completas) misturado com cartas de truques ao estilo de jogos de
cartas colecionáveis: Equipamentos dão poderes às peças, Armadilhas escondidas em casas, respostas encadeadas numa
"Chain". 120 cartas, 13 Lendárias. Cada Lendária tem uma "Ultimate" (desbloqueio cosmético por 1000 de ouro): a carta
ganha uma personagem de anime original (ex.: Akane, a Rainha Rubi; Kaito, o Guardião Azul; Riku, o Piloto Mecânico;
Yuki, a Princesa da Neve) que entra com um vídeo e transforma a peça do tabuleiro nessa personagem. Modos: contra bot
e online (ranqueada com Elo, K=32, início 1000; ou sala privada). Público: jovens e adultos casuais que gostam de TFT,
Hearthstone, Clash Royale e xadrez. Tom divertido, competitivo, bem-disposto. Tudo tem de ser original: nada de
personagens, nomes, logótipos, modelos ou texturas da Riot/TFT, da Konami ou de outros — "inspirado em", nunca cópia.

## 2. Como está feito hoje (o que quero mudar)
Peças de xadrez (captura 2 e 3) — feitas 100 % por código em Three.js r160, sem ficheiros de modelo:
- Silhuetas torneadas (LatheGeometry) com perfis simples por tipo; Cavalo = forma 2D extrudida com bisel. Detalhes
  feitos de primitivas: olhos (esferas brancas + pupila + brilho, piscam a cada 3,6 s), bochechas rosa (círculos
  transparentes), sorriso (meio toro), Torre com porta e bandeira, Bispo com medalha, Dama com coroa de cones e colar
  de pérolas, Rei com cruz, bigode, capa e gola de arminho.
- Material: MeshPhysicalMaterial "plástico envernizado" (clearcoat 1, roughness 0,34–0,42) com reflexos de um
  RoomEnvironment; Brancas #EEF2F7, Pretas #2E3D57 (grafite azulado), dourado #FCC934. Contorno preto por "casca
  invertida" (a mesma geometria empurrada pelas normais, BackSide, 0,014 unidades).
- Tamanho: o tabuleiro tem 8×8 unidades (1 casa = 1 unidade). Peão ≈ 0,6 de altura, Rei ≈ 1,25. Pedestal por baixo:
  sombra radial + 2 anéis na cor da equipa (#00B4D8 para mim, #D90429 para o adversário) + aura aditiva.
- Animação contínua: sobe e desce 0,035 (2,4 rad/s), roda ±0,22 rad devagar, pisca. Lances e capturas animados com
  GSAP (saltos, arcos, estilhaços, faíscas, texto néon "POW!"). Não há esqueleto nem animações de personagem.
- Cena: câmara perspetiva FOV 40 em (0; 11,6; 9,9) a olhar para (0; -0,4; 0,75) (telemóvel vertical: FOV 46, mais
  alta); luz ambiente #8090C8 0,7 + direcional #F2F6FF 1,35 + contraluz ciano #59E1FF 0,5 + 3 luzes pontuais fixas para
  clarões; ACES Filmic, exposição 1,35; bloom (UnrealBloomPass) força 0,28, limiar 0,95 (só cores com intensidade > 1
  brilham). Fundo: imagem de estádio de e-sports à noite.
- Resultado: parecem brinquedos de primitivas, pequenos, pouco detalhados, todos com a mesma cara; de cima lêem-se
  como peças de xadrez, mas não têm personalidade nem a qualidade de um TFT.

Ultimates (capturas 2 e 4):
- A personagem é uma ilustração 2D de anime (Gemini, 765×1024, fundo removido). No tabuleiro é um sprite plano de 1,55
  de altura sempre virado para a câmara (parece um recorte de cartão em pé no pedestal) — está "em 2D".
- A "transformação" é: vídeo em ecrã inteiro numa faixa diagonal (vídeo Veo 854×480, 4–7 s, com o nome e uma frase),
  depois o corpo da peça é escondido e aparece o sprite. Ao capturar: outro vídeo (golpe) e uma bola de energia voa até
  ao alvo. Há papéis: "attack" (golpe ao capturar), "guard" (cúpula de hexágonos sobre o próprio Rei enquanto a peça
  tem escudo), "power" (vídeo quando o poder do equipamento dispara), "card" (armadilhas: a personagem aparece na casa
  quando a carta resolve) e "fusion" (duas Lendárias na mesma peça → personagem de fusão).
- As 13 personagens: Akane (rainha rubi, cetro), Kaito (guardião azul, escudo de hexágonos), Akaito (fusão dos dois),
  Riku (piloto de exoesqueleto robô laranja), Nova (cientista com frasco verde-água), Marina (caçadora de tesouros com
  bússola dourada), Yuki (princesa da neve, varinha de gelo, trenó), Lola (mestra de circo, cartola, canhão), Goro
  (ferreiro colossal, martelo e bigorna), Mira (ilusionista com espelho de borracha), Rin (árbitra com apito dourado),
  Luna (mágica com cartola e fumo), Aiko (juíza com martelo), Ren (advogado que rasga contratos).

Ecrã inicial (captura 1): HTML/CSS. Pódio dos 3 melhores, baralho ativo, botão JOGAR amarelo, e ao centro um
pedestal CSS com "fotos" 2D do Rei branco e da Dama preta (renderizadas uma vez a partir das peças 3D; ao clicar fazem
um salto em sprite sheet de 24 quadros). Não há cena 3D viva no menu.

Ecrã VS: duas placas inclinadas em CSS entram dos lados, batem no centro, carimbo "VS" dourado, abrem-se (~1,5 s).
Só existe contra o bot. Na ranqueada online, quando a fila encontra adversário, o jogo salta direto para a partida:
não há "Partida encontrada!", nem ecrã de carregamento/VS com os dois jogadores.

## 3. O que quero (objetivo)
1. Peças com a qualidade e o encanto das unidades do TFT: figuras 3D estilizadas "chibi" com texturas pintadas à mão,
   silhuetas fortes, personalidade e animações de verdade (parado, andar/saltar, atacar, levar dano, morrer/estilhaçar,
   vitória, emote), mas que de cima continuem a ler-se instantaneamente como Peão, Torre, Cavalo, Bispo, Dama e Rei, e
   como Brancas ou Pretas.
2. As Ultimates em 3D a sério: a peça transforma-se na personagem 3D (modelo com esqueleto e animações), com uma
   sequência de transformação espetacular ao estilo TFT (antecipação, pilar de luz, troca de modelo, aterragem com onda
   de choque, câmara) e ataques 3D no tabuleiro.
3. Ecrã inicial ao estilo do cliente do TFT: cena 3D viva com a mascote do jogador numa pequena arena, interações,
   emblema de liga, JOGAR.
4. Fluxo da ranqueada ao estilo TFT: "A procurar partida…", "Partida encontrada!" (aceitar com anel de contagem),
   ecrã de carregamento/VS com os dois jogadores (mascote 3D, nome, emblema de liga, Elo, Lendária favorita, barras de
   carregamento reais) e transição de câmara para o tabuleiro. O mesmo ecrã VS, mais curto, contra o bot.

## 4. Restrições técnicas (obrigatórias)
- Web, JavaScript puro SEM build (sem bundler, sem TypeScript, sem npm no cliente): scripts clássicos com um namespace
  global YC, carregados por ordem no index.html; um único módulo ES (three-bridge.js) importa o Three.js 0.160.0 por
  importmap do jsDelivr e expõe window.THREE e window.THREE_ADDONS (já inclui GLTFLoader). Pode-se acrescentar outros
  addons da MESMA versão do mesmo CDN (DRACOLoader, KTX2Loader, MeshoptDecoder, SkeletonUtils, etc.). GSAP 3 para
  animações. Deploy estático na Vercel. Os ficheiros de arte vão em assets/ e há um build opcional que embute tudo num
  único HTML (hoje ~20 MB; os vídeos das Ultimates já ocupam 15 MB) — propõe um orçamento de MB por modelo e total, e
  se os modelos devem ficar fora do ficheiro único e carregar a pedido.
- Desempenho: 60 fps em portáteis modestos (gráficos integrados) e em telemóveis (375 px de largura, vertical). Até 32
  peças no tabuleiro ao mesmo tempo, várias podem ser personagens de Ultimate. Regras do palco que não podem partir:
  nunca mudar o número de luzes durante a partida (recompila todos os shaders e congela o jogo); tipos de material
  novos têm de ser pré-compilados num "warm-up" antes da partida; o bloom só apanha cores > 1.
- A lógica do jogo não muda: o motor emite eventos e a parte visual anima-os e espera (emitAsync). Eventos existentes:
  match:start, turn:start, piece:move, capture:declare, capture:miss, capture:snapback, piece:destroy, piece:freeze,
  piece:morph, piece:unmorph, piece:relocate, piece:promote, piece:bump, piece:immune, check, equip:attach, equip:proc,
  equip:steal, equip:strip, shield:gain, shield:shatter, shield:blocked, shield:divine, trap:set, trap:trigger,
  trap:reveal, trap:destroy, trap:clang, card:draw, card:set, card:burn, chain:link, chain:resolve, chain:negate,
  chain:fizzle, chain:end, mirror:bounce, emp:blast, dummy:swap, aura:pulse, deck:empty. O online é "lockstep": tudo o
  que é visual corre igual nos dois clientes e nunca pode mudar o estado.
- Sem WebGL ou se um modelo falhar a carregar, o jogo tem de continuar (hoje há um tabuleiro CSS de reserva e as peças
  feitas por código podem ficar como reserva).
- Ferramentas que temos: conta Google Gemini Pro (imagens Imagen; vídeos Veo, ~4 vídeos por janela de 5 h); o agente de
  código corre Python 3, Node.js, ffmpeg e Pillow no Windows e controla o Chrome do utilizador. Blender NÃO está
  instalado (pode ser instalado se valer a pena, e corre por linha de comandos). Não temos contas pagas; o utilizador
  pode criar contas gratuitas (o agente não cria contas). Preciso de ferramentas gratuitas ou de custo baixo, e que
  permitam uso comercial — diz a licença de cada uma.
- Estética atual (docs/DIRECAO-DE-ARTE.md): "caixa de brinquedos de vinil colecionável", interface de plástico mate com
  contorno escuro, cores #00B4D8 (eu), #D90429 (adversário), #FFB703 (ouro), fontes Titan One / Plus Jakarta Sans /
  Chakra Petch, zero emojis. Diz como conciliar com o estilo TFT (ou o que mudar).

## 5. O que o relatório tem de ter
A. Diagnóstico das capturas e os princípios visuais do estilo TFT traduzidos em números: proporção cabeça/corpo,
   altura das unidades em relação à casa, legibilidade de cima com a câmara indicada, paleta e saturação, texturas
   pintadas vs PBR, iluminação (chave, contraluz/rim, ambiente), sombras (sombra "blob" vs sombras reais), contornos
   (casca invertida vs pós-processamento vs nenhum), materiais em Three.js (MeshToonMaterial com gradientMap,
   MeshStandardMaterial com texturas pintadas, ou shader próprio com rim light) — com valores exatos.
B. Design das 12 peças (6 tipos × 2 cores): conceito de cada peça como personagem (ex.: Peão = soldadinho; Torre =
   golem-castelo…), o que identifica o tipo na silhueta, como distinguir Brancas de Pretas (material, cor, base), alturas
   em unidades, e PROMPTS prontos para o Gemini gerarem folhas de referência adequadas a imagem→3D (vista de frente,
   lado e costas, pose neutra/A-pose, fundo branco, sem sombras, mesma câmara e estilo em todas).
C. Pipeline de produção 3D passo a passo, feito pelo agente e pelo utilizador:
   1) imagem → modelo 3D: compara as opções atuais (ex.: TRELLIS, Hunyuan3D 2.x, TripoSR/Tripo, Meshy, Rodin, SF3D e
      outras que encontres) em qualidade para personagens cartoon/anime, texturas, polígonos, custo, limites gratuitos,
      acesso (site, API, Hugging Face Space, local com GPU) e licença comercial; recomenda uma e um plano B;
   2) limpeza: decimação, alvo de triângulos (peça ≤ ? tris, personagem ≤ ? tris), UVs, tamanho de textura (512/1024),
      pivot no chão, escala 1 casa = 1 unidade, orientação +Z para a câmara;
   3) rig automático (ex.: Mixamo, AccuRIG, rigging do Tripo/Meshy, UniRig ou outros) e animações: lista exata de
      clipes por peça e por personagem, duração em ms, de onde vêm (Mixamo, bibliotecas CC0 como Quaternius, retarget,
      animação feita à mão em Blender por script), e como garantir que funcionam em personagens chibi;
   4) exportação glTF 2.0 (.glb) e compressão com comandos exatos (ex.: gltf-transform: meshopt/draco, KTX2
      ETC1S/UASTC, resize, simplify, dedup) e o tamanho final esperado por ficheiro;
   5) se recomendares Blender por linha de comandos, os scripts Python (bpy) para limpar, decimar, aplicar escala e
      exportar.
D. Integração em Three.js r160 sem build (código JS clássico, não módulos, exceto o three-bridge): carregar e guardar em
   cache os GLB, clonar 32 peças com SkeletonUtils.clone, um AnimationMixer por peça com crossfade entre clipes, ligar
   os clipes aos eventos do jogo (piece:move → saltar/andar, capture → atacar, piece:destroy → estilhaçar, etc.),
   partilhar geometrias/materiais, limites do skinning e alternativas (animação por vértices, "baked" em textura),
   LOD/qualidade baixa para telemóvel, sombras falsas, pré-compilação dos materiais (renderer.compile) e como medir.
   Inclui exemplos de código completos e curtos (loader com promessas, pool de clones, troca de clipes, troca de modelo
   numa transformação).
E. Ultimates em 3D: como passar as 13 ilustrações 2D de anime (765×1024, cel shading, contorno grosso) para modelos 3D
   que pareçam as mesmas personagens (gerar primeiro uma folha de turnaround com o Gemini a partir da ilustração? que
   prompt?), e o storyboard da transformação ao estilo TFT com tempos em ms e curvas: antecipação na peça, pilar/coluna
   de luz, partículas, troca de modelo com squash & stretch, aterragem com onda de choque, movimento de câmara
   (dolly/zoom/tremor) e som; e as animações 3D de cada papel (attack, guard, power, card, fusion). Diz se mantemos os
   vídeos 2D (cut-in de anime) antes da transformação 3D, se os encurtamos, ou se trocamos por um plano de câmara no
   próprio motor.
F. Ecrã inicial ao estilo do cliente do TFT: composição (desktop 1366–2560 px e telemóvel 375 px vertical), cena 3D
   (pequena arena/ilha, mascote do jogador animada, câmara, luz, fundo), interações (tocar na mascote → emote; arrastar
   → rodar), onde ficam perfil, ouro, poeira, liga/Elo, baralho, JOGAR e o pódio; transições de entrada e de saída; e
   como isto convive com a loja e os baralhos (HTML por cima de um canvas 3D?). Valores em px, ms e easing.
G. Fluxo da ranqueada: estados e storyboards com tempos ("A procurar partida…" com tempo decorrido e cancelar;
   "Partida encontrada!" com aceitar/recusar e anel de 10 s; ecrã de carregamento/VS com as duas faixas: mascote 3D,
   nome, emblema de liga, Elo, Lendária favorita, barras de carregamento ligadas ao carregamento real dos modelos;
   transição de câmara do ecrã VS para o tabuleiro). Versão curta contra o bot. Sons (temos sons sintetizados por Web
   Audio: diz o tipo de som para cada momento).
H. Ligas/emblemas: divisões a partir do Elo (início 1000, K=32) com limites, nome original de cada liga, design do
   emblema e prompt de imagem para o Gemini.
I. Plano de implementação por fases (cada fase entregável sozinha, com critério de aceitação): ficheiros novos e o que
   cada um faz (ficheiros até ~350 linhas; ex.: src/view3d/ModelLib.js, PieceModels.js, UltModels.js, LobbyStage3D.js,
   src/ui/MatchFound.js, LoadingVS.js), orçamento de MB e de fps, testes a fazer, riscos e o que fazer se a geração por
   IA falhar (manter as peças por código como reserva). Começa pela fase que dá mais impacto visual com menos risco.
J. Anexo com todos os prompts prontos a colar (imagens Gemini, vídeos Veo se precisar, parâmetros das ferramentas de
   imagem→3D) e todos os comandos.

Formato: Markdown com títulos, tabelas e blocos de código; números sempre concretos; cita as fontes (documentação,
artigos, vídeos de bastidores do TFT/GDC) quando falares de como a Riot ou outros estúdios fazem.
```
