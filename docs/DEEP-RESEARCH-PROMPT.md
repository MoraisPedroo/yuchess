# Prompt para o Deep Research do Gemini — direção de arte do Chess-Gi-Oh!

Copiar tudo o que está dentro do bloco abaixo e colar no Gemini → Deep Research. Se possível, anexar 4–6 capturas
de ecrã do jogo (Arena, Loja, Baralhos, partida com a mão aberta, partida com uma Chain). Quando o relatório
estiver pronto, exportá-lo (Docs/PDF) ou copiar o texto e dá-lo ao Claude Code para aplicar.

```text
Atua como diretor de arte sénior e designer de UI e de motion de jogos de cartas e estratégia (nível Blizzard, Riot,
Second Dinner, Supercell). Quero um relatório de investigação completo, prático e com números concretos para
redesenhar a estética de um jogo web e tirar-lhe o "ar de site feito por IA". O relatório vai ser entregue a um
programador (um agente de código) que o vai implementar à letra, por isso preciso de valores exatos (hex, px, rem,
ms, curvas cubic-bezier), não de generalidades.

## 1. O jogo
"Chess-Gi-Oh! Cartoon Edition": xadrez a sério (regras completas) misturado com cartas de truques ao estilo de jogos
de cartas colecionáveis. Antes de cada lance o jogador pode usar até 2 cartas: Equipamentos (dão poderes às peças,
ex.: botas que deixam o peão avançar 2 casas), Armadilhas de Casa (escondidas numa casa do tabuleiro, ex.: bomba de
tinta, jaula elétrica, bigorna), Armadilhas Reativas e Counter-Traps (respostas viradas para baixo) e Magias Rápidas.
As respostas encadeiam-se numa "Chain" com Velocidades 1/2/3. Há loja de pacotinhos de 5 cartas (Comum, Rara, Épica,
Lendária, com pity), montagem de baralhos de 12 cartas, criação de cartas com "Poeira Estelar", modo contra bot e
online (ranqueada com Elo). Público: jovens e adultos casuais que gostam de Hearthstone, Marvel Snap, Clash Royale e
xadrez. Tom: divertido, cartoon moderno, competitivo mas bem-disposto. Não pode usar nada da Konami/Yu-Gi-Oh! (nomes,
logótipos, molduras, arte).

## 2. Como é feito (restrições técnicas)
- Web, JavaScript puro sem build, CSS, GSAP 3 para animações, Three.js r160 para o tabuleiro 3D (peças "chibi" de
  vinil brilhante feitas por código, toon shading, bloom), Web Audio para sons sintetizados. Deploy estático.
- Tem de correr a 60 fps em portáteis modestos e em telemóveis (375 px de largura, vertical) e em ecrãs de 1366 a
  2560 px. Animações só com transform/opacity sempre que possível.
- Fontes só do Google Fonts ou com licença OFL. Texto da interface em português de Portugal (palavras compridas:
  "Equipamento", "Armadilha de Casa", "Poeira Estelar").
- Arte gerada com IA (Gemini/Imagen para imagens, Veo para vídeos curtos): hoje temos 31 ícones de objetos em estilo
  "brinquedo de vinil brilhante com contorno escuro", um verso de carta dourado com um cavalo, um fundo de estádio de
  e-sports à noite e 4 vídeos de objetos lendários.

## 3. A estética atual (o que quero mudar)
- Menus (Arena, Loja, Baralhos): fundo com gradientes radiais roxo/rosa/turquesa (#120B26, #2D1B4E, #7B42F6, #F538A0,
  #12B5CB), painéis arredondados (raio 18 px) semitransparentes com contorno e brilho néon, botões "juicy" amarelos
  com sombra dura por baixo (0 5px 0 #111), emojis como ícones (⚔ ✨ 🛡 👑), tipografia Fredoka + Nunito, hero da
  página inicial com título grande "Xadrez a sério. Cartas com truques." e uma carta a flutuar.
- Partida: estilo "e-sports néon" diferente dos menus — tabuleiro com casas azul-escuro, contornos ciano/magenta
  (#00E5FF, #FF4F9A), painéis de HUD tipo vidro escuro com bordas néon, fontes Orbitron, Chakra Petch, Cinzel
  (nomes das cartas) e Nunito; mão em leque com zoom no sítio (estilo Hearthstone); cartas com moldura por tipo
  (cobalto, violeta, âmbar, platina, verde-água) e acabamento holográfico por raridade.
- Animações: GSAP com back.out e elastic, confetes, texto "POW!" em néon 3D, faíscas e clarões, cartas a voar em arco.
- Porque parece "feito por IA": tudo brilha por igual, gradientes roxos genéricos, emojis, demasiadas fontes,
  menus e partida parecem dois jogos diferentes, layout de "landing page" em vez de ecrã de jogo, pouca hierarquia,
  materiais sem identidade (nem madeira, nem metal, nem papel, nem plástico), animações a ressaltar todas da mesma
  maneira.

## 4. O que quero no relatório (com estas secções, por esta ordem)
A. Diagnóstico: os sinais concretos que fazem uma interface de jogo parecer gerada por IA ou um template web em
   2025–2026, e como os jogos profissionais os evitam. Exemplos visuais descritos.
B. Referências: analisa 10 a 12 jogos (pelo menos Hearthstone, Marvel Snap, Clash Royale, Legends of Runeterra,
   Balatro, Slay the Spire, Yu-Gi-Oh! Master Duel, Pokémon TCG Pocket, Brawl Stars, Splatoon 3, Persona 5, Fall Guys).
   Para cada um: paleta, tipografia, materiais e molduras, iconografia, linguagem de animação, o que vale a pena
   copiar para este jogo e o que evitar. Tabela-resumo no fim.
C. Três direções de arte diferentes para o Chess-Gi-Oh! (ex.: "caixa de brinquedos de vinil", "torneio de desenho
   animado de sábado de manhã", "arcade néon"), com nome, conceito, mood, materiais e texturas. Recomenda uma e
   justifica. Para a recomendada, detalha tudo o que vem a seguir.
D. Paleta completa em hex com papéis (fundo, superfícies 1–3, texto principal/secundário, primária, acento, sucesso,
   perigo, aviso, Brancas, Pretas, as 4 raridades, os 5 tipos de carta), contraste WCAG verificado, versão para
   daltónicos nas raridades e nas equipas, e regras de uso (onde NÃO usar brilho).
E. Tipografia: no máximo 2–3 famílias do Google Fonts (com pesos), escala tipográfica em px/rem para desktop e
   telemóvel, regras para títulos, números (relógio, ouro, contadores), texto das cartas (legível a 11–14 px) e
   botões. Explica porque é que a escolha não parece genérica.
F. Sistema de design pronto a implementar: lista de variáveis CSS (cores, raios, sombras, espaçamentos, camadas
   z-index, durações, curvas), especificação de componentes com estados (normal, hover, pressionado, desativado,
   focado): botões principal/secundário/perigo, separadores do menu, painéis e janelas, tooltips, distintivos,
   pílulas de moeda, toasts, modais, barra do topo, HUD da partida, cartas (moldura por tipo e raridade), pacote.
   Iconografia sem emojis: estilo, grelha, espessura, e onde ir buscar ou como desenhar (SVG).
G. Sistema de motion: princípios e uma tabela de durações e curvas (cubic-bezier exatos) para micro-interações,
   hover, abrir/fechar painéis, mudar de ecrã, comprar carta, jogar carta, equipar, armadilha a disparar, captura de
   peça (antecipação, hit-stop, impacto, tremor de câmara com limites), recompensas, fim de partida. Regras de
   squash & stretch, overshoot (quando sim e quando não), stagger, follow-through, partículas (quantas e quando),
   como evitar animações "flutuantes"/genéricas, dicas de GSAP (timelines, quickTo, ease personalizadas) e de
   desempenho, e o modo "reduzir movimento".
H. Transições entre ecrãs: Arena ↔ Loja ↔ Baralhos ↔ Online, entrada na partida (ecrã "VS"/carregamento) e saída
   (vitória/derrota → recompensas → menu). Storyboard quadro a quadro com tempos.
I. Ecrã inicial (Arena): composição e hierarquia (o botão "Jogar" como nos jogos da Supercell), elemento-herói
   (peças 3D, cartas, mascote), o que mostrar (baralho ativo, missões, recompensas), wireframe descrito para desktop e
   para telemóvel.
J. Pacotinhos (Loja): o desenho do pacote (forma, material, foil, logótipo) e a coreografia completa da abertura
   inspirada no melhor de Hearthstone, Marvel Snap, Pokémon TCG Pocket e Master Duel — antecipação, rasgar, revelação
   carta a carta, escalada por raridade (Comum → Lendária), sons, botão de saltar/acelerar — com tempos em ms.
K. Partida: legibilidade do tabuleiro (contraste das casas, como mostrar lances possíveis, seleção, casa debaixo do
   rato, armadilhas escondidas, xeque), HUD, mão, Chain, histórico, cartão da peça, banner de turno e ecrã final.
L. Som: estilo dos efeitos e dos sons de interface coerente com a direção de arte (sons sintetizados em Web Audio).
M. Produção de arte com IA: prompts exatos em inglês (Gemini/Imagen e Veo) para fundo dos menus, molduras/painéis
   (9-slice), ícones de interface, pacote, molduras de carta por tipo, gemas de raridade, efeitos visuais (sprite
   sheets), com regras de consistência (âncoras de estilo, imagem de referência, prompts negativos) e o que NÃO
   gerar com IA (texto, layout, números).
N. Plano de implementação por prioridade: ganhos rápidos (1 dia), médios (1 semana) e grandes, cada um com o
   impacto esperado.
O. Checklist "anti-cara-de-IA" para validar cada ecrã antes de o dar por acabado.

## 5. Formato
Português de Portugal (termos técnicos em inglês quando forem o padrão). Títulos iguais às secções acima. Tabelas
para paletas, tokens, tempos e curvas. Valores concretos sempre que possível. Cita as fontes com links (GDC talks,
artigos de UI de jogos, análises de Game UI Database, entrevistas de diretores de arte). Prefere ser específico a ser
curto.
```
