# Prompt para o Deep Research do Gemini — ecrã inicial, menus e ecrãs de VS ao estilo do cliente do League of Legends

Copiar tudo o que está dentro do bloco abaixo e colar no Gemini → Deep Research. **Anexar estas 7 capturas** de
`_tmp_art/capturas/` (fora do git):

| Ficheiro | O que mostra |
|---|---|
| `26-arena-atual.jpg` | Ecrã inicial (Arena) de hoje |
| `27-menu-jogar.jpg` | O que o botão JOGAR abre |
| `28-ecra-vs.jpg` | Ecrã VS à entrada da partida |
| `2-partida-ultimates.jpg` | Tabuleiro 3D numa partida |
| `4-ultimate-cutin.jpg` | Entrada (vídeo) de uma Ultimate |
| `21-akane-3d-vistas.png` | Uma personagem já em modelo 3D |
| `24-kaito-aterragem.jpg` | Transformação 3D no tabuleiro |

Quando o relatório estiver pronto, partilhar o link da conversa (ou exportar para Docs/PDF) e dá-lo ao Claude Code
para implementar.

```text
Atua como diretor de arte, designer de UX/motion e "technical artist" sénior de clientes de jogos competitivos (nível
Riot Games — cliente do League of Legends, TFT e Valorant —, Supercell, Marvel Snap, Hearthstone, Pokémon Unite), com
experiência em fundos animados com vídeo, ecrãs de carregamento/VS, fluxo de procura de partida, e em front-end web de
alto desempenho. Quero um relatório de investigação completo e prático para transformar os menus de um jogo web, que
hoje parecem "um site com painéis", num cliente de jogo bonito e moderno ao estilo do cliente do League of Legends:
vídeo a correr atrás, com coisas do próprio jogo, misturado com animações da interface. O relatório vai ser entregue a
um programador (um agente de código: Claude Code) que o vai implementar à letra, por isso preciso de passos exatos,
números (px, ms, curvas de easing, hex, MB, kbps, resoluções), prompts prontos a colar, comandos de ferramentas e código
de exemplo — não de generalidades. Escreve em português de Portugal. Anexo 7 capturas do jogo atual.

## 1. O jogo
"Chess-Gi-Oh! Cartoon Edition": xadrez a sério (regras completas) misturado com cartas de truques ao estilo de jogos de
cartas colecionáveis: Equipamentos dão poderes às peças, Armadilhas escondidas em casas, respostas encadeadas numa
"Chain". 120 cartas, 13 Lendárias. Cada Lendária tem uma "Ultimate" (desbloqueio cosmético por 1000 de ouro): uma
personagem de anime original que entra com um vídeo curto e transforma a peça do tabuleiro nessa personagem em 3D. As
14 personagens: Akane (rainha rubi, cetro), Kaito (guardião azul, escudo de hexágonos), Akaito (fusão dos dois),
Riku (piloto de exoesqueleto robô laranja), Nova (cientista com frasco verde-água), Marina (capitã com bússola
dourada), Yuki (princesa da neve), Lola (mestra de circo de cartola), Goro (ferreiro colossal, martelo e bigorna),
Mira (ilusionista com espelho), Rin (árbitra com apito dourado), Luna (mágica com cartola e fumo), Aiko (juíza com
martelo), Ren (advogado que rasga contratos). Modos: contra bot (Fácil/Médio/Difícil) e online (ranqueada com Elo,
K=32, início 1000; ou sala privada por código). Loja de pacotes de 5 cartas com abertura animada; editor de baralhos de
22 cartas. Público: jovens e adultos casuais que jogam LoL/TFT, Hearthstone, Clash Royale e xadrez. Tom divertido,
competitivo e bem-disposto. Tudo tem de ser original: nada de personagens, nomes, logótipos, músicas, vídeos ou
texturas da Riot ou de outros — "inspirado em", nunca cópia.

## 2. Como estão hoje os ecrãs (o que quero mudar)
- Ecrã inicial "Arena" (captura 26): fundo ardósia liso (#0F141C) com textura de pontos; barra de topo (avatar, nome,
  logótipo, ouro, poeira, som, definições); à esquerda um painel "Melhores jogadores" com pódio 1-2-3; ao centro 3 cartas
  do baralho em leque e um pedestal com duas "fotos" 3D paradas (Rei branco e Dama preta, peças de vinil com olhos);
  à direita o baralho ativo e o botão JOGAR amarelo; em baixo uma doca com Loja, Baralhos e Arena. Não há vídeo, não
  há personagens, nada se mexe a não ser um salto das peças ao clicar. Parece um painel de administração, não um jogo.
- JOGAR (captura 27): janela modal "Como queres jogar?" com dois separadores (Contra o bot / Online), nível, relógio e
  um botão. Sem arte, sem vídeo.
- Online: dentro dessa janela; a ranqueada mostra um "spinner" e "À procura de adversário…" com Cancelar; quando há
  adversário passa a "Adversário encontrado! A preparar o tabuleiro…" e salta direto para a partida. Não há "Partida
  encontrada!" com aceitar, nem ecrã de carregamento com os dois jogadores.
- Ecrã VS (captura 28): duas placas de plástico inclinadas entram dos lados e batem no centro, carimbo "VS" dourado,
  ~0,7 s para ler, e abrem-se para mostrar o tabuleiro (1,5 s no total). Cada lado tem só um retrato do Rei (branco ou
  preto), o nome e uma linha de texto. Só existe contra o bot.
- Fim da partida: janela modal com "Vitória/Derrota" a saltar, motivo, recompensas (ouro, poeira) e botões. Sem
  cerimónia, sem Elo a subir, sem personagem.
- Loja e Baralhos: ecrãs HTML com o mesmo fundo liso; a abertura de pacotes é o único momento "cinematográfico".
- A partida (capturas 2, 4 e 24) já tem um palco 3D em Three.js (tabuleiro néon, estádio de e-sports de fundo, peças e
  personagens 3D, partículas, bloom), por isso o contraste entre os menus planos e a partida é grande.

## 3. O que já temos para usar (assets do próprio jogo)
- 14 ilustrações das personagens em anime (PNG 765×1024 com fundo transparente, cel shading, contorno grosso).
- 8 personagens já em modelo 3D (.glb, 12 000–40 000 triângulos, textura 2048 px, sem esqueleto: só animação por
  transformações — cair, achatar, respirar, rodar, saltar com pirueta); as outras 6 ficam prontas nos próximos dias.
  Peças de xadrez 3D (Peão e Torre em modelo; as outras feitas por código).
- 16 vídeos das Ultimates (H.264 854×480, 24 fps, 4–7 s, cut-ins de anime: a personagem a fazer a pose de entrada ou o
  golpe; ~280 KB cada) e 13 vídeos das cartas Lendárias (480×270, 10 s em ciclo, o objeto da carta a rodar).
- 120 desenhos de objetos das cartas (PNG transparentes), 16 desenhos de efeitos (explosões, círculos mágicos), verso
  das cartas, imagem do estádio de e-sports à noite (fundo da partida).
- O próprio motor 3D: consegue pôr uma partida bot contra bot a correr sozinha com câmara livre, e consegue desenhar as
  personagens 3D em qualquer cena (já fazemos uma "vitrine" 3D animada dentro de um cartão).
- Sons sintetizados em Web Audio (sem ficheiros de áudio); não há música.

## 4. Ferramentas e limites (verifica o que está certo em novembro de 2026 e corrige-me)
- Conta Google Gemini Pro: imagens ("Criar imagem", praticamente sem limite) e vídeos Veo ("Criar vídeo": até onde sei
  clipes de 8 s, 720p, 16:9, com som, a partir de texto ou de uma imagem inicial; ~3–4 vídeos por janela de 5 h; recusa
  alguns pedidos com pessoas). Diz-me se há "primeiro e último quadro", vertical 9:16, 1080p, "extend" ou outras
  ferramentas da Google (Flow, AI Studio…) com quota gratuita melhor, e o que vale a pena usar para vídeos em ciclo.
- TRELLIS.2 no Hugging Face (imagem → modelo 3D; conta gratuita, ~2 modelos por dia), Blender 5.2 por linha de
  comandos, gltf-transform, ffmpeg, Python 3 com Pillow, Node.js. O agente controla o Chrome do utilizador. Não há
  contas pagas; o utilizador pode criar contas gratuitas (o agente não cria contas). Ferramentas gratuitas e com
  licença que permita uso comercial (diz a licença de cada uma) — ex.: interpolação de quadros, aumento de resolução,
  música/efeitos sonoros gerados por IA.

## 5. Restrições técnicas (obrigatórias)
- Web, JavaScript puro SEM build (sem bundler, sem TypeScript, sem npm no cliente): scripts clássicos com um namespace
  global YC, carregados por ordem no index.html; Three.js 0.160.0 por importmap (jsDelivr) e GSAP 3. Deploy estático na
  Vercel (ficheiros em assets/). Há um build opcional que embute tudo num único HTML (hoje ~35 MB): diz se os vídeos dos
  menus devem ficar fora dele e carregar à parte.
- Desempenho: 60 fps em portáteis com gráficos integrados e em telemóveis (375 px de largura, vertical, dados móveis).
  O vídeo do menu não pode competir com a partida: tem de parar (e libertar memória) quando a partida começa. Regras de
  autoplay dos navegadores (muted, playsinline), separador escondido, poupança de dados/bateria, primeira carga rápida
  (o que aparece antes de o vídeo chegar).
- "Reduzir movimento" é uma opção do jogo (YC.reducedMotion(), classe html.reduce-motion): com ela, imagem parada no
  lugar do vídeo e transições curtas.
- O online é "lockstep" (os dois clientes correm o mesmo motor; o servidor é só o Firestore). Qualquer dado novo no
  ecrã de carregamento (personagem favorita, liga, progresso de carregamento) vai em campos novos da sala no Firestore
  e obriga a mudar as regras de segurança — mantém isso pequeno.
- Estética atual (anexo resumido): "caixa de brinquedos de vinil colecionável" — interface de plástico mate escuro com
  contorno #0F141C de 3 px e sombras duras, cores #00B4D8 (eu), #D90429 (adversário), #FFB703 (ouro/JOGAR), fontes
  Titan One (títulos), Plus Jakarta Sans (texto), Chakra Petch (números), zero emojis, sem roxo/magenta néon, sem vidro
  desfocado (backdrop-filter) em painéis, brilho só onde importa. Diz-me como chegar ao "premium" do cliente do LoL sem
  perder esta identidade, ou o que mudar nela (com tokens novos concretos), e porquê.
- Um relatório anterior (estilo TFT) propôs para o menu uma ilha 3D flutuante com a mascote. Agora prefiro o estilo do
  cliente do LoL com vídeo atrás. Diz se se combinam (vídeo ao fundo + personagem 3D viva à frente) ou se é melhor
  escolher um.

## 6. O que quero (objetivo)
Um cliente de jogo com cara de produto, ao nível do cliente do LoL, feito com coisas do nosso jogo:
1. Ecrã de entrada (o primeiro que aparece; como o ecrã de login do LoL): vídeo cinematográfico em ciclo com as nossas
   personagens e o tabuleiro, logótipo animado, música/som, "Entrar com Google" / "Jogar como convidado" / "Carregar
   para começar".
2. Ecrã inicial (Arena): vídeo de fundo em ciclo (pode mudar por "temporada" ou pela personagem favorita do jogador) com
   a interface por cima: JOGAR dominante, perfil com liga e Elo, banner de evento/novidade, missões, pódio; a
   personagem em destaque; transições entre Loja, Baralhos e Arena sem o fundo "piscar".
3. Escolha de modo (como o ecrã de escolha de modo do LoL): mosaicos grandes com arte/vídeo para Ranqueada, Contra o
   bot (Fácil/Médio/Difícil) e Sala privada, com o relógio e o baralho.
4. Procura de partida: barra "A procurar partida…" com tempo e cancelar, que fica visível enquanto o jogador navega
   pelos menus; "Partida encontrada!" com aceitar/recusar e anel de contagem (diz se faz sentido aceitar num jogo 1v1 e
   como fazer com o Firestore, ou se é melhor "aceitar automático" com contagem curta), alerta no título do separador e
   som.
5. Pré-partida (se fizer sentido num 1v1, como a seleção de campeões): escolher baralho e a personagem a mostrar, com
   tempo limite; senão, diz o que pôr no lugar.
6. Ecrã de carregamento / VS (como o ecrã de carregamento do LoL): um cartão grande por jogador com a arte da
   personagem favorita (ou do Rei, se não tiver nenhuma), nome, emblema de liga, Elo, título, barra de carregamento
   ligada ao carregamento real (modelos 3D, vídeos), dicas do jogo; depois um "VS" forte e a transição para o
   tabuleiro (câmara a mergulhar no estádio). Versão curta contra o bot (~2 s).
7. Fim da partida: "VITÓRIA" / "DERROTA" cinematográfico (como o brasão do LoL), Elo a subir/descer com animação,
   progresso da liga, recompensas a voar, estatísticas da partida, revanche.

## 7. O que o relatório tem de ter
A. Análise do cliente do LoL (e de 2–3 outros: TFT, Valorant, Marvel Snap, Pokémon Unite, Genshin…) nestes ecrãs: o
   que o faz parecer "premium" (camadas: vídeo, vinhetas e gradientes por cima, moldura da interface, partículas,
   paralaxe, música), com números (duração dos vídeos de fundo, técnica de ciclo, resolução, bitrate, codec, tamanho,
   imagem de espera) e como tratam computadores fracos e telemóveis. Cita fontes (blog técnico da Riot, GDC, artigos).
B. Direção visual: como conciliar com a nossa "caixa de brinquedos de vinil" (2–3 caminhos com prós e contras e uma
   recomendação), paleta, tipografia, moldura dos painéis e botões (ex.: filetes dourados vs plástico), com tokens CSS
   concretos (hex, px, sombras, raios) e exemplos de componentes.
C. Vídeos de fundo: conceito e storyboard plano a plano de 3–4 ciclos (entrada, Arena, procura/carregamento, evento),
   feitos com o que temos: clipes Veo de 8 s a partir das nossas ilustrações e de renders das nossas personagens 3D,
   montados no ffmpeg. Para cada plano: imagem inicial (prompt do Gemini, no estilo das nossas personagens), prompt do
   Veo (em inglês), duração, câmara, e como manter as personagens iguais de clipe para clipe. Como fazer ciclos sem
   costura (vai-e-vem, fusão no fim, mesmo primeiro e último quadro). Ferramentas gratuitas de interpolação e aumento de
   resolução, se valerem a pena. Comandos ffmpeg finais (H.264 MP4 + WebM VP9/AV1; variantes 1080p/720p/480p e
   vertical 9:16 para telemóvel; CRF/bitrate, intervalo de keyframes, faststart), tamanho alvo por ficheiro, imagem de
   espera (poster), atributos do <video>, carregamento progressivo e quando trocar para imagem parada.
D. Vídeo pré-gravado vs cena 3D viva (o nosso Three.js com as personagens e uma partida bot contra bot com câmara de
   cinema) vs híbrido; e a opção de gravar as nossas próprias cenas 3D para vídeo (passo fixo, captura de quadros do
   canvas, codificar no ffmpeg) para ter ciclos 100 % iguais ao jogo. Custos, riscos e recomendação.
E. Camada de interface por cima do vídeo: composição para computador (1366–2560 px) e telemóvel (375 px vertical) com
   px, ordem de camadas, gradientes e vinhetas para o texto se ler, zonas seguras; componentes (barra de topo, JOGAR,
   cartão de perfil com liga, banner de evento, missões, pódio, barra de procura); paralaxe ao mover o rato, partículas
   leves, animação dos botões; esqueleto HTML/CSS e timelines GSAP de exemplo (JavaScript clássico, sem módulos).
F. Storyboard de cada ecrã do ponto 6 com tempos em ms, curvas de easing e sons (temos Web Audio sintetizado: diz o
   tipo de som em cada momento; e se vale a pena música de menu gerada por IA, com que ferramenta gratuita e licença).
G. Dados online: campos novos e mínimos na sala do Firestore para o ecrã de carregamento e para "Partida encontrada!",
   e o que muda nas regras de segurança.
H. Orçamento de desempenho e de carregamento: MB por ecrã, tempo da primeira carga em 4G, o que se carrega primeiro e
   o que fica para tempo morto, memória, bateria, parar o vídeo na partida e em separador escondido, contextos WebGL.
I. Plano de implementação por fases (cada fase entregável sozinha, com critério de aceitação), começando pela que dá
   mais impacto com menos risco: ficheiros novos e o que fazem (até ~350 linhas cada; ex.: src/ui/MenuBackdrop.js,
   SplashScreen.js, ModeSelect.js, QueueBar.js, MatchFound.js, LoadingVS.js, PostGame.js, styles/menu.css,
   tools/menu-video.py), o que muda nos existentes (Hub.js, PlayMenu.js, OnlineLobby.js, VersusScreen.js,
   MatchChain.js), testes a fazer e o que fazer se o Veo recusar ou a quota acabar.
J. Anexo com todos os prompts prontos a colar (imagens Gemini, vídeos Veo, música se recomendares) e todos os
   comandos.

Formato: Markdown com títulos, tabelas e blocos de código; números sempre concretos; cita as fontes.
```
