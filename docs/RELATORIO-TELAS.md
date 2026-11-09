# Relatório do Deep Research — menus ao estilo do cliente do League of Legends

> Gemini Deep Research, 2026-11-09 (conversa "Prompt Deep Research Cliente LoL" na conta do Pedro; prompt em `docs/DEEP-RESEARCH-TELAS.md`). Copiado tal como veio; as decisões de implementação estão no `docs/PROGRESS.md`.

# Arquitetura e Direção Técnica para o Cliente de Chess-Gi-Oh! Cartoon Edition

A transformação dos menus de **Chess-Gi-Oh! Cartoon Edition** de uma página web estática para um cliente de jogo competitivo ao estilo do *League of Legends* (LCU) exige substituir o fundo plano (`#0F141C`) por uma arquitetura em camadas gerida por estado: vídeo em ciclo (`<video>` HTML5 descodificado por GPU) na base, vinhetas de contraste axial por cima, e uma moldura de interface ancorada nas bordas do ecrã. Esta estrutura resolve a desconexão visual hoje visível entre os menus planos (capturas `26`, `27` e `28`) e o palco 3D em Three.js da partida (capturas `2`, `4` e `24`), preservando os 60 fps em portáteis com gráficos integrados e telemóveis de 375 px através da destruição explícita do descodificador de vídeo antes de iniciar o motor 3D da partida.

As recomendações centrais para implementação imediata pelo Claude Code são:

1. **Direção Visual ("Collector's Edition Vinyl" / Hextech Toybox):** Manter o plástico mate escuro, o contorno `#0F141C` de `3px` e as sombras duras sem `backdrop-filter`, adicionando um chanfro interno (`inset 0 1px 0 rgba(255, 183, 3, 0.35)`) e cantos cortados a 45° (`clip-path`) nos botões principais.
2. **Arquitetura de Fundo (Vídeo Pré-Gravado vs. 3D Vivo):** Usar vídeo pré-gravado no fundo do menu (`MenuBackdrop.js`), descartando a combinação de vídeo mais vitrine WebGL 3D simultânea no ecrã principal para evitar dupla composição de texturas na GPU e esgotamento do limite de contextos WebGL do navegador. Para obter ciclos 100% fiéis aos modelos `.glb` (Akane, Kaito) sem depender apenas de IA generativa, gravar também cenas determinísticas do próprio Three.js codificadas com FFmpeg.
3. **Fluxo Online 1v1 e Build:** Num jogo 1v1 com pareamento instantâneo no Firestore, substituir o botão manual de "Aceitar" por um **Ready-Check Automático de 3,2 s** com anel de progresso sincronizado e transição direta para um ecrã de Carregamento/VS ao estilo LoL (cartões verticais com as ilustrações PNG `765×1024`, Elo, liga e barra de progresso real). Os vídeos de fundo (0,65–2,2 MB cada) têm obrigatoriamente de ficar **fora do build HTML único de 35 MB**, carregados por rede com `poster` WebP instantâneo (~35 KB).

## Secção A: Análise de Clientes de Referência e Diagnóstico Atual

### 1. Engenharia e Camadas do Cliente do League of Legends (LCU) e Referências

O cliente do *League of Legends* corre sobre o **Chromium Embedded Framework (CEF)** — atualizado pela Riot Games (por exemplo, da versão 74 para a 91) para reduzir falhas, diminuir o consumo de memória de front-end e acelerar a comunicação por WebSockets até 4,1x em Windows e 7,8x em Mac em ecrãs de elevado tráfego de dados como Seleção de Campeões e Fim de Partida. A sensação "premium" da interface Hextech não provém de cenas WebGL pesadas no menu; a equipa de engenharia da Riot omitiu deliberadamente o WebGL da camada geral da UI devido à dificuldade de gerar fumo e magia em tempo real com alta qualidade e à necessidade de suportar sistemas sem aceleração de hardware. Em vez disso, o cliente combina vídeo **HTML5 WebM (codec VP9)** gerido por uma máquina de estados em Web Components (`<lol-uikit-video-state>` e `<lol-uikit-video>`) que alterna entre estados (`intro` → `idle` loop) com animações CSS e GSAP estritamente limitadas às propriedades `transform` e `opacity`, garantindo que o Chromium executa apenas o passo de *Composite* na GPU sem invalidar *Layout* ou *Paint*.

Para efeitos de brilho em texto ou botões, a Riot evita animar `text-shadow` ou `filter` (que forçam *repaints* por fotograma na CPU); duplica o elemento com a sombra já renderizada e anima apenas a `opacity` da cópia. A documentação técnica da Riot especifica que vídeos de elementos de UI pesam tipicamente **100 KB ou menos** para pré-carregamento imediato em memória e que o codec VP9 é utilizado por suportar canal alfa (transparência), enquanto o **Modo de Baixo Desempenho (Low-Spec Mode)** substitui os vídeos grandes de fundo por imagens estáticas para poupar a descodificação por software em CPUs fracas. Como o blog oficial da Riot não publica valores fixos de bitrate para os vídeos de fundo de ecrã inteiro (dado que o cliente desktop lê do disco local), os valores de resolução, duração (8–14 s) e bitrate (650–1800 kbps) definidos na Secção C são alvos de engenharia calibrados especificamente para distribuição web na Vercel.

| Cliente de Jogo | Camada de Fundo (Z-0) | Camadas Intermédias (Z-1 a Z-2) | Camada de UI (Z-3) e Transições | Especificações de Vídeo / 3D e Fallback Mobile |
| --- | --- | --- | --- | --- |
| **League of Legends (LCU)** | Vídeo HTML5 WebM (VP9) gerido por `<lol-uikit-video-state>` (`intro` → `idle` loop) | Vinheta periférica escura + vídeos WebM c/ canal alfa (≤100 KB em elementos de UI) | Moldura Hextech fixa no topo/direita; animações apenas em `transform` e `opacity` | Modo Low-Spec troca vídeos grandes por imagem estática e desativa animações secundárias |
| **Teamfight Tactics (TFT)** | Ilha/palco temático por temporada com iluminação de destaque | Gradiente radial para destacar o centro e barra de navegação superior unificada | Botão JOGAR no canto direito, passe de batalha e missões em painel lateral | Em mobile, reduz resolução de ativos e isola efeitos do lobby para poupar bateria |
| **Valorant** | Fundo animado em ciclo de direção gráfica contrastada com paralaxe | Sobreposições tipográficas subtis e partículas de ambiente | Navegação limpa nas margens; botão JOGAR ancorado com feedback sonoro seco | Transição de ecrã por corte geométrico rápido sem recarregar a estrutura base |
| **Marvel Snap** | Fundo vertical (9:16) com profundidade e cartas em destaque | Cartas com camadas separadas e texturas 2D sem mipmaps (`UserInterface2D`) | Doca inferior e botão JOGAR central dominante ao alcance do polegar | Simplifica camadas visuais e interações complexas para privilegiar ecrãs táteis |
| **Pokémon Unite** | Estádio ao fundo com treinador e criatura favorita selecionada no lobby | Iluminação de palco e contraste lateral para leitura de botões | Perfil no topo esquerdo, eventos à esquerda, botão de partida à direita | Carregar modelos 3D ao alternar personagens causava atrasos de ~1 s na Switch; exige cache ou arte 2D |

### 2. Diagnóstico das 7 Capturas Anexadas de Chess-Gi-Oh!

A inspeção das capturas atuais revela o motivo pelo qual os menus parecem um painel de administração e não um cliente de jogo competitivo. Na captura `26-arena-atual.jpg` (Arena), o fundo `#0F141C` com grelha de pontos ocupa mais de 65% dos píxeis com vazio estático; o centro divide-se entre duas peças de vinil paradas num pedestal elíptico e três cartas pequenas em cima, sem qualquer presença das 14 personagens de anime que definem a fantasia do jogo, enquanto os painéis ("Melhores jogadores" à esquerda e "Baralho Inicial" à direita) flutuam a meia altura como cartões de dashboard. Na captura `27-menu-jogar.jpg` (Modal Jogar), clicar em JOGAR abre uma caixa de diálogo estreita (`Como queres jogar?`) com botões de formulário (`Fácil | Médio | Difícil`, `5 min | 10 min`), sem ilustração de modo nem sensação de entrar numa fila competitiva.

Na captura `28-ecra-vs.jpg` (Ecrã VS), embora o corte diagonal amarelo (`#FFB703`) e o selo `VS` central tenham boa leitura gráfica, os dois lados são áreas cinzentas vazias com apenas um pequeno quadrado (`~140×140 px`) do Rei de vinil, sem mostrar a personagem Lendária favorita, Elo, liga ou dicas, durando apenas 1,5 s contra o bot. Em contraste, as capturas `2-partida-ultimates.jpg`, `4-ultimate-cutin.jpg`, `21-akane-3d-vistas.png` e `24-kaito-aterragem.jpg` mostram que a partida já possui um estádio de e-sports iluminado, um tabuleiro néon com bloom, o modelo 3D da Akane com cetro rubi, a aterragem 3D do Kaito com partículas douradas e um *cut-in* de vídeo anime vibrante (`ULTIMATE! RAINHA RUBI`). O novo cliente traz exatamente estes elementos (estádio, Akane, Kaito, cartas Lendárias) para o fundo dos menus.

## Secção B: Direção Visual e Tokens CSS ("Vinyl Prestige")

### 1. Três Caminhos Estéticos para Conciliar a "Caixa de Brinquedos de Vinil" com o LoL

| Caminho | Descrição Visual | Prós | Contras |
| --- | --- | --- | --- |
| **1. Plástico Puro (Atual + Vídeo)** | Mantém os painéis atuais `#161E2B` com borda preta de `3px` exatamente como estão, colocando apenas vídeo por trás. | Zero retrabalho de CSS nos cartões existentes. | Os painéis opacos e redondos parecem autocolantes planos colados sobre um vídeo cinematográfico; não atinge o aspeto LoL. |
| **2. Hextech Metálico Puro** | Substitui o contorno preto de `3px` por linhas douradas finas de `1px`, gradientes escuros e estética 100% Riot. | Aspeto imediato de cliente AAA clássico. | Destrói a identidade "Cartoon Edition / Vinil Colecionável", colidindo com as peças de olhos grandes e com a fonte `Titan One`. |
| **3. "Collector's Edition Vinyl" (RECOMENDADO)** | Mantém o contorno exterior `#0F141C` de `3px` e a sombra dura, mas adiciona um **filete interno chanfrado dourado/ciano de `1px`** (`inset`), superfícies em gradiente ardósia acetinado (`165deg`) e cantos chanfrados no botão JOGAR. | Parece a caixa *premium* de uma figura de ação de edição de colecionador; une o vídeo anime às peças de vinil sem perder a identidade. | Exige atualizar as variáveis CSS globais e adicionar estados de chanfro nos componentes principais. |

### 2. Tokens CSS Concretos (`styles/menu.css`)

Todos os tokens abaixo respeitam as restrições: zero `backdrop-filter`, zero roxo/magenta néon, brilho restrito a elementos focais e tipografia `Titan One`, `Plus Jakarta Sans` e `Chakra Petch`.

CSS

```
:root {
  /* Superfícies de Plástico Mate Acetinado (Collector's Vinyl) */
  --yc-bg-void: #090D14;
  --yc-bg-slate: #0F141C;
  --yc-panel-surface: linear-gradient(165deg, #1E293B 0%, #131B26 100%);
  --yc-panel-surface-elevated: linear-gradient(165deg, #263449 0%, #182230 100%);
  --yc-panel-overlay-readability: rgba(15, 20, 28, 0.88);

  /* Vinhetas de Leitura sobre Vídeo (Camada Z-1) */
  --yc-vignette-desktop: 
    radial-gradient(circle at 52% 48%, rgba(15, 20, 28, 0.05) 0%, rgba(9, 13, 20, 0.72) 70%, rgba(9, 13, 20, 0.94) 100%),
    linear-gradient(90deg, rgba(9, 13, 20, 0.88) 0%, rgba(9, 13, 20, 0.15) 28%, rgba(9, 13, 20, 0.15) 72%, rgba(9, 13, 20, 0.90) 100%),
    linear-gradient(180deg, rgba(9, 13, 20, 0.85) 0%, rgba(9, 13, 20, 0.0) 18%, rgba(9, 13, 20, 0.0) 78%, rgba(9, 13, 20, 0.95) 100%);
  --yc-vignette-mobile:
    linear-gradient(180deg, rgba(9, 13, 20, 0.88) 0%, rgba(9, 13, 20, 0.12) 25%, rgba(9, 13, 20, 0.25) 60%, rgba(9, 13, 20, 0.96) 100%);

  /* Cores de Identidade e Acentos Metálicos (Sem Roxo/Magenta) */
  --yc-cyan-player: #00B4D8;
  --yc-cyan-bright: #48CAE4;
  --yc-cyan-dark: #0077B6;
  --yc-crimson-foe: #D90429;
  --yc-crimson-bright: #EF233C;
  --yc-gold-primary: #FFB703;
  --yc-gold-highlight: #FFD166;
  --yc-gold-trim: #CDA032;
  --yc-gold-shadow: #B27800;

  /* Contornos e Sombras Duras com Chanfro de Colecionador */
  --yc-border-ink: 3px solid #0F141C;
  --yc-radius-card: 14px;
  --yc-radius-btn: 10px;
  --yc-shadow-panel: 
    0 6px 0 #090D14,
    0 12px 24px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 0 0 1px rgba(205, 160, 50, 0.28);
  --yc-shadow-btn-play:
    0 5px 0 #9E6B00,
    0 10px 20px rgba(255, 183, 3, 0.35),
    inset 0 2px 0 #FFE399;

  /* Tipografia */
  --yc-font-display: 'Titan One', cursive;
  --yc-font-body: 'Plus Jakarta Sans', sans-serif;
  --yc-font-mono: 'Chakra Petch', monospace;
}
```

## Secção C: Ferramentas (Novembro de 2026), Storyboards de Vídeo e Pipeline FFmpeg

### 1. Auditoria e Correção de Ferramentas e Licenças (Estado em Novembro de 2026)

Em novembro de 2026, os endpoints legados `veo-2` e `veo-3.0-generate` foram descontinuados (retirados a 30 de junho de 2026), sendo a família **Veo 3.1** (`Lite`, `Fast` e `Quality`) e o **Gemini Omni Flash** os modelos ativos. Em vez de gerar vídeos apenas na janela de conversação do Gemini, a ferramenta mais eficaz da Google incluída na conta **Google AI Pro** ($19,99/mês) é o **Google Flow** (`labs.google/fx/tools/flow`), que atribui **1000 créditos mensais** (além de 50 créditos diários no escalão gratuito). No Flow, cada clipe de 8 segundos custa **10 créditos** no Veo 3.1 Lite (até 100 clipes/mês no plano Pro), **20 créditos** no Veo 3.1 Fast (50 clipes/mês) e **100 créditos** no Veo 3.1 Quality (10 clipes/mês).

O Veo 3.1 e o Google Flow resolvem diretamente os problemas de criação de ciclos de fundo através de três funcionalidades nativas. Primeiro, o modo **Primeiro e Último Quadro (`Frames to Video`)** é suportado em Veo 3.1 Lite, Fast e Quality, permitindo carregar a mesma imagem como fotograma inicial e final para gerar um ciclo de 8 segundos que regressa à pose inicial. Segundo, o modo **Consistência de Personagem (`Ingredients to Video`)**, disponível em Veo 3.1 Lite e Fast para clipes de 8 s, aceita até 3 imagens de referência (como o PNG `765×1024` da Akane e a vista do modelo 3D) para manter o design idêntico de clipe para clipe. Terceiro, o modelo suporta formato horizontal **16:9** e vertical **9:16** nativos, durações de **4, 6 ou 8 s** a 24 fps, saída em **720p, 1080p e 4K** (1080p e 4K requerem clipes de 8 s), bem como a função **Extend**, que prolonga vídeos de 720p em incrementos de 7 s até 20 vezes.

Todas as ferramentas locais e de pós-processamento selecionadas para o pipeline possuem licenças que permitem uso comercial gratuito:

| Ferramenta / Modelo | Função no Pipeline | Licença Oficial | Uso Comercial Gratuito | Notas Técnicas (Novembro de 2026) |
| --- | --- | --- | --- | --- |
| **TRELLIS.2 (`microsoft/TRELLIS.2-4B`)** | Imagem → Modelo 3D `.glb` com materiais PBR | **MIT License** | **Sim** (código, pesos e modelos gerados) | Usa representação O-Voxel; pode ser usado gratuitamente via Hugging Face Spaces. |
| **Blender 5.2 LTS** | Renderização 3D e processamento por linha de comandos | **GPL v2+** | **Sim** (ficheiros `.glb` e renders pertencem ao autor) | Lançado a 14 de julho de 2026 (suporte até julho de 2028); o motor EEVEE na CLI chama-se agora `BLENDER_EEVEE` em vez de `BLENDER_EEVEE_NEXT`. |
| **glTF-Transform (`@gltf-transform/cli`)** | Compressão e otimização de modelos `.glb` | **MIT License** | **Sim** | Ideal para redimensionar texturas de 2048 px para 1024 px nas miniaturas. |
| **rife-ncnn-vulkan (RIFE v4.6)** | Interpolação de fotogramas (24 fps → 48/60 fps) | **MIT License** | **Sim** | Binário C++/Vulkan portátil sem depender de Python/CUDA. Opcional: manter 24 fps preserva a estética anime e poupa ~35% de bitrate. |
| **realesrgan-ncnn-vulkan** | Aumento de resolução de vídeo anime (`realesr-animevideov3`) | **BSD-3-Clause / MIT** | **Sim** | Útil para subir rascunhos 720p do Veo 3.1 Lite para 1080p localmente. |
| **ACE-Step 1.5** | Geração de música instrumental de menu por IA | **Apache 2.0** | **Sim** (ao contrário do *MusicGen* da Meta, cujos pesos são `CC-BY-NC 4.0` não-comerciais) | Corre localmente em <4 GB VRAM ou gratuitamente no Google Colab. |

### 2. Storyboards Plano a Plano dos 4 Ciclos de Vídeo

Para evitar que os filtros de segurança do Veo recusem pedidos com "pessoas", todos os prompts especificam *"stylized 2D/3D cel-shaded anime game illustration, non-photorealistic fictional toy/anime character"* e partem sempre das ilustrações do próprio jogo (carregadas em `Frames` ou `Ingredients`).

| Ciclo de Vídeo | Duração Total | Estrutura de Planos (Veo 3.1) | Técnica de Ciclo Sem Costura (Seamless Loop) | Tamanho Alvo (720p WebM / MP4) |
| --- | --- | --- | --- | --- |
| **1. `splash-loop` (Ecrã de Entrada)** | **14,0 s** (2 planos de 8 s c/ `xfade` de 1 s) | **Plano 1A (8 s):** Panorâmica baixa pelo tabuleiro néon com Rei branco e Dama preta de vinil rodeados por cartas mágicas flutuantes. **Plano 1B (8 s):** Akane (cetro rubi) e Kaito (escudo de hexágonos azuis) frente a frente no estádio de e-sports com faíscas douradas. | No Plano 1A, usar a imagem inicial de 1A. No Plano 1B, usar a imagem final que reverte por `xfade` de `1.0 s` para o início do Plano 1A no FFmpeg. | **1,6 MB** (WebM VP9) **2,1 MB** (MP4 H.264) |
| **2. `arena-loop` (Ecrã Inicial / Arena)** | **8,0 s** (1 plano contínuo de respiração) | **Plano Único (8 s):** A personagem favorita à centro-esquerda/centro (ex.: Akane ou Akaito) em pose confiante no estádio iluminado, capa e cabelo a ondular suavemente ao vento, cetro rubi a pulsar, partículas de ouro a subir. | **First & Last Frame idênticos no Google Flow (`Frames to Video`):** carregar a mesma composição `1920×1080` como fotograma inicial e final; o Veo 3.1 interpola o movimento e regressa à pose zero no segundo 8,0. | **1,1 MB** (WebM VP9) **1,5 MB** (MP4 H.264) |
| **3. `queue-loop` (Procura / VS Fundo)** | **7,0 s** (1 plano de energia de túnel) | **Plano Único (8 s brutos → 7 s loop):** Câmara baixa ao nível do tabuleiro néon; feixes de luz ciano (`#00B4D8`) à esquerda e carmesim (`#D90429`) à direita convergem para um vórtice dourado no centro do estádio. | **Crossfade circular no FFmpeg (`7,0 s` finais):** cortar um clipe de 8 s sobrepondo o primeiro segundo com o último segundo via filtro `xfade=transition=fade:duration=1:offset=6`. | **0,9 MB** (WebM VP9) **1,2 MB** (MP4 H.264) |
| **4. `event-loop` (Banner / Loja / Lendárias)** | **8,0 s** (Montagem / Forja de Cartas) | **Plano Único (8 s):** Goro (ferreiro colossal) ou Luna (mágica) junto a um pacote de cartas dourado que levita sobre uma bigorna/pedestal rúnico, libertando três cartas Lendárias brilhantes. | **First & Last Frame idênticos** ou **Vai-e-vem suavizado (Ping-Pong)** para objetos levitantes. | **1,1 MB** (WebM VP9) **1,4 MB** (MP4 H.264) |

### 3. Comandos FFmpeg Finais, Variantes e Atributos `<video>`

Todos os vídeos devem ser exportados **sem faixa de áudio (`-an`)** para garantir que os navegadores permitem `autoplay` imediato (`muted playsinline`) e poupar largura de banda. O intervalo de keyframes (`-g 48` para 24 fps, i.e., 2 segundos) e a flag `-movflags +faststart` garantem que a reprodução começa logo no primeiro bloco HTTP recebido.

Bash

```
# 1. Criar ciclo sem costura de 7 segundos a partir de um clipe Veo de 8s (Crossfade de 1s entre fim e início)
ffmpeg -y -i raw_veo_8s.mp4 -filter_complex \
  "[0:v]split[body][pre]; \
   [pre]trim=duration=1,setpts=PTS-STARTPTS[head]; \
   [body]trim=start=1,setpts=PTS-STARTPTS[main]; \
   [main][head]xfade=transition=fade:duration=1:offset=6,format=yuv420p[outv]" \
  -map "[outv]" -an -r 24 loop_master_1080p.mp4

# 2. Exportar Variante Desktop 1080p (1920x1080, 24fps) — WebM VP9 (~1.5 - 2.0 MB) e MP4 H.264 (~2.2 MB)
ffmpeg -y -i loop_master_1080p.mp4 -c:v libvpx-vp9 -b:v 1800k -minrate 900k -maxrate 2600k \
  -crf 31 -row-mt 1 -tile-columns 2 -g 48 -an assets/video/arena-loop-1080p.webm

ffmpeg -y -i loop_master_1080p.mp4 -c:v libx264 -preset slow -profile:v high -level 4.1 \
  -crf 23 -maxrate 2800k -bufsize 5600k -g 48 -pix_fmt yuv420p -movflags +faststart -an \
  assets/video/arena-loop-1080p.mp4

# 3. Exportar Variante Portátil 720p (1280x720, 24fps) — Padrão recomendado (~1.1 MB)
ffmpeg -y -i loop_master_1080p.mp4 -vf "scale=1280:720:flags=lanczos" -c:v libvpx-vp9 \
  -b:v 1100k -minrate 550k -maxrate 1600k -crf 33 -row-mt 1 -g 48 -an \
  assets/video/arena-loop-720p.webm

ffmpeg -y -i loop_master_1080p.mp4 -vf "scale=1280:720:flags=lanczos" -c:v libx264 \
  -preset slow -crf 24 -maxrate 1700k -bufsize 3400k -g 48 -pix_fmt yuv420p -movflags +faststart -an \
  assets/video/arena-loop-720p.mp4

# 4. Exportar Variante SD 480p (854x480, 24fps) e Mobile Vertical 9:16 (540x960, 24fps, ~650 KB)
ffmpeg -y -i loop_master_1080p.mp4 -vf "scale=854:480:flags=lanczos" -c:v libvpx-vp9 \
  -b:v 600k -maxrate 900k -crf 35 -row-mt 1 -g 48 -an assets/video/arena-loop-480p.webm

ffmpeg -y -i loop_master_9x16.mp4 -vf "scale=540:960:flags=lanczos" -c:v libvpx-vp9 \
  -b:v 650k -maxrate 950k -crf 34 -row-mt 1 -g 48 -an assets/video/arena-loop-mobile.webm

ffmpeg -y -i loop_master_9x16.mp4 -vf "scale=540:960:flags=lanczos" -c:v libx264 \
  -preset slow -crf 25 -maxrate 1000k -bufsize 2000k -g 48 -pix_fmt yuv420p -movflags +faststart -an \
  assets/video/arena-loop-mobile.mp4

# 5. Extrair Imagem de Espera (Poster WebP, ~35 KB) do primeiro fotograma
ffmpeg -y -i loop_master_1080p.mp4 -vf "scale=1280:720" -vframes 1 -c:v libwebp -quality 82 \
  assets/video/arena-poster.webp
```

## Secção D: Vídeo Pré-Gravado vs. Cena 3D Viva vs. Híbrido vs. Captura Offline

Respondendo diretamente à dúvida sobre combinar o estilo TFT (ilha 3D viva à frente) com o estilo LoL (vídeo atrás): **não se deve combinar vídeo a ecrã inteiro com um canvas WebGL transparente por cima no menu principal.** No pipeline de renderização do Chromium, cada vídeo de ecrã inteiro é descodificado durante o passo de *Paint* e enviado para a GPU como textura de camada; sobrepor um `<canvas>` WebGL com canal alfa obriga a GPU integrada a compor duas camadas de ecrã inteiro mais o DOM a 60 Hz, além de os navegadores limitarem o número de contextos WebGL simultâneos em uso.

| Arquitetura de Fundo | Custo GPU / Bateria (Portátil iGPU e Mobile) | Tempo de 1.ª Carga (4G) | Fidelidade Visual aos Assets do Jogo | Recomendação Técnica |
| --- | --- | --- | --- | --- |
| **1. Vídeo Pré-Gravado Puro (Estilo LoL)** | **Muito Baixo** (Descodificador de hardware dedicado; sem shaders 3D em tempo real) | **Instantâneo** (35 KB `poster` WebP + ~1,1 MB vídeo em streaming) | Alta se gerado com `Ingredients` (Veo 3.1) ou capturado do motor | **RECOMENDADO para Ecrã de Entrada e Arena Principal.** |
| **2. Cena 3D Viva em Three.js (Partida Bot vs. Bot)** | **Alto** (Shaders, sombras, bloom e lógica de jogo a 60 fps contínuos) | **Lento** (Exige carregar `.glb` de 12k–40k triângulos e texturas 2048 px antes do menu) | 100% idêntico à partida | **Rejeitar no menu.** Aquece o telemóvel antes mesmo de a partida começar. |
| **3. Híbrido (Vídeo Atrás + Personagem 3D Viva à Frente)** | **Médio-Alto** (Descodificador de vídeo + contexto WebGL extra com transparência) | **Médio-Lento** (Vídeo + modelo `.glb` da personagem em destaque) | Risco de dissonância de iluminação entre o vídeo Veo e o modelo `.glb` | **Evitar na Arena.** Usar em vez disso vídeo de fundo + camada 2D PNG `765×1024` com paralaxe CSS (zero WebGL). |
| **4. Cena 3D Gravada Offline para Vídeo (Three.js → FFmpeg)** | **Muito Baixo em Runtime** (Para o cliente final é apenas um vídeo `.webm`/`.mp4` de 1,1 MB) | **Instantâneo** (Mesmo custo do Vídeo Pré-Gravado Puro) | **100% Exata** (Usa o estádio, peças, Akane/Kaito `.glb` e bloom reais do jogo) | **ALTAMENTE RECOMENDADO como complemento ao Veo 3.1** (garante ciclos perfeitos e zero dependência de quotas). |

### Como Gravar Cenas do Próprio Three.js para Vídeo Perfeito (Passo Fixo Offline)

Como o agente controla o Chrome e o vosso motor já corre partidas bot vs. bot e vitrines 3D das personagens `.glb` (animações por transformações de respirar, flutuar e rodar), basta adicionar uma função de captura com passo fixo (`dt = 1 / 24` s). Como as animações das vossas personagens não têm esqueleto e usam funções periódicas `sin(ωt)`, definindo os períodos como divisores exatos de `8,0 s` (por exemplo, ciclo de respiração de `4,0 s` e órbita de câmara/partículas de `8,0 s`), o fotograma `192` torna-se matematicamente contíguo ao fotograma `0`, gerando um ciclo sem costura 100% fiel ao jogo.

## Secção E: Camada de Interface, Grelha Responsiva e Código Base

### 1. Ordem de Camadas (`z-index`) e Composição Espacial

A árvore DOM de `#yc-client-shell` permanece montada durante toda a navegação entre **Arena**, **Baralhos**, **Loja** e **Escolha de Modo**, evitando qualquer piscar (*flash*) do vídeo de fundo.

| Camada (`z-index`) | Elemento DOM | Comportamento no Computador (`1366px–2560px`) | Comportamento no Telemóvel (`375px` Vertical) |
| --- | --- | --- | --- |
| **`z-index: 0`** | `#yc-backdrop-video` + `#yc-backdrop-poster` | `object-fit: cover; width: 100vw; height: 100vh;` com deslocamento de paralaxe suave (`±16px` X, `±10px` Y). | Variante `9:16` (`540×960`) ou corte central focado (`object-position: 50% 35%`), sem paralaxe de rato. |
| **`z-index: 1`** | `#yc-backdrop-vignette` + `#yc-backdrop-particles` | Gradiente axial `--yc-vignette-desktop` + `<canvas>` 2D leve com 22 partículas douradas/ciano a subir. | Gradiente `--yc-vignette-mobile` (escurece os 40% inferiores onde estão os controlos) + 10 partículas. |
| **`z-index: 2`** | `#yc-hero-layer` (Retrato 2.5D da Personagem) | Ilustração PNG `765×1024` da personagem favorita centrada (`left: 50%`, `bottom: -24px`, `height: 82vh`), com paralaxe inversa (`±24px`). | `height: 52vh`, centrada no meio superior (`top: 56px`), atrás dos cartões inferiores. |
| **`z-index: 10`** | `#yc-topbar` (Barra de Topo Fixa) | Altura `64px`; Esquerda: Avatar + Nome + Liga/Elo; Centro: Nav (ARENA, BARALHOS, LOJA); Direita: Ouro, Poeira, Áudio, Definições. | Altura `52px` compacta (Avatar/Elo à esquerda, Ouro/Poeira/Definições à direita); navegação passa para a doca inferior de `64px`. |
| **`z-index: 15`** | `#yc-stage-view` (Vistas: Arena, Modo, Loja, Baralhos) | Grelha de 3 zonas com margens seguras de `32px`: Coluna Esquerda (`310px`: Evento + Missões + Pódio compacto); Centro (Zona livre de `520px` para ver o vídeo/personagem); Coluna Direita (`340px`: Baralho Ativo + Botão JOGAR dominante `340×68px`). | Coluna única empilhada na metade inferior (`bottom: 76px`): Banner compacto + Baralho Ativo + Botão JOGAR (`calc(100vw - 32px) × 60px`). |
| **`z-index: 30`** | `#yc-queue-bar` (Barra de Procura Persistente) | Cápsula acoplada sob a barra de topo (`top: 72px`, `right: 32px`, `width: 340px`) com cronómetro `Chakra Petch` e botão Cancelar. Permanece visível na Loja e Baralhos. | Cápsula fixa acima da doca inferior (`bottom: 70px`, `left: 16px`, `right: 16px`, `height: 48px`). |
| **`z-index: 50`** | `#yc-overlay-root` (Partida Encontrada, VS, Pós-Jogo) | Ecrã inteiro com bloqueio de cliques no fundo. | Ecrã inteiro vertical adaptado a 375 px. |

### 2. Esqueleto HTML/CSS e Controlador `MenuBackdrop.js` (JavaScript Clássico + GSAP 3)

HTML

```
<!-- Estrutura persistente em index.html -->
<div id="yc-client-shell" class="yc-shell" data-screen="arena">
  <!-- Z-0: Fundo de Vídeo Persistente -->
  <div id="yc-backdrop" class="yc-backdrop">
    <img id="yc-backdrop-poster" class="yc-backdrop__poster" src="assets/video/arena-poster.webp" alt="" />
    <video id="yc-backdrop-video" class="yc-backdrop__video" muted loop playsinline preload="metadata" poster="assets/video/arena-poster.webp"></video>
  </div>

  <!-- Z-1: Vinheta de Leitura e Partículas Leves -->
  <div class="yc-backdrop__vignette"></div>
  <canvas id="yc-backdrop-particles" class="yc-backdrop__particles"></canvas>

  <!-- Z-2: Destaque da Personagem Favorita (Paralaxe 2.5D) -->
  <div id="yc-hero-layer" class="yc-hero-layer">
    <img id="yc-hero-art" class="yc-hero-layer__img" src="assets/chars/akane.png" alt="Akane" />
    <div class="yc-hero-layer__caption">
      <span class="yc-badge-legendary">ULTIMATE EQUIPADA</span>
      <h2 id="yc-hero-name" class="yc-hero-layer__title">AKANE, RAINHA RUBI</h2>
    </div>
  </div>

  <!-- Z-10: Barra de Topo Estilo Cliente LoL -->
  <header id="yc-topbar" class="yc-topbar">
    <div class="yc-topbar__profile" id="yc-profile-trigger">
      <div class="yc-avatar-frame">
        <img src="assets/chars/akane-thumb.webp" alt="" />
        <span class="yc-league-pip yc-league-pip--gold"></span>
      </div>
      <div class="yc-profile-meta">
        <div class="yc-profile-meta__name">Duelista</div>
        <div class="yc-profile-meta__elo"><span class="yc-elo-tier">OURO II</span> • <span class="yc-mono">1048 ELO</span></div>
      </div>
    </div>

    <nav class="yc-topnav" role="tablist">
      <button class="yc-topnav__tab is-active" data-nav="arena">ARENA</button>
      <button class="yc-topnav__tab" data-nav="decks">BARALHOS</button>
      <button class="yc-topnav__tab" data-nav="shop">LOJA</button>
    </nav>

    <div class="yc-topbar__wallet">
      <div class="yc-currency"><span class="yc-currency__dot yc-currency__dot--gold"></span><span id="yc-gold-val" class="yc-mono">500</span></div>
      <div class="yc-currency"><span class="yc-currency__dot yc-currency__dot--dust"></span><span id="yc-dust-val" class="yc-mono">200</span></div>
      <button class="yc-icon-btn" id="yc-btn-audio" aria-label="Som"></button>
      <button class="yc-icon-btn" id="yc-btn-settings" aria-label="Definições"></button>
    </div>
  </header>

  <!-- Z-15: Palco Principal da Arena -->
  <main id="yc-stage-view" class="yc-stage">
    <aside class="yc-stage__left">
      <section class="yc-card yc-banner-event" id="yc-event-banner">
        <span class="yc-banner-event__tag">DESTAQUE DA TEMPORADA</span>
        <h3 class="yc-banner-event__title">FUSÃO RUBI &amp; HEXÁGONO</h3>
        <p class="yc-banner-event__desc">Desbloqueia a Ultimate de Akaito por 1000 de Ouro.</p>
      </section>

      <section class="yc-card yc-missions" id="yc-missions-panel">
        <header class="yc-card__header"><h4>MISSÕES DIÁRIAS</h4><span class="yc-mono">2/3</span></header>
        <div class="yc-mission-row">
          <div class="yc-mission-row__info"><span>Ativa 3 Armadilhas em Cadeia</span><span class="yc-mono">+150 Ouro</span></div>
          <div class="yc-progress"><div class="yc-progress__fill" style="width: 66%"></div></div>
        </div>
      </section>

      <section class="yc-card yc-podium-compact" id="yc-podium-panel"></section>
    </aside>

    <div class="yc-stage__center" aria-hidden="true"></div>

    <aside class="yc-stage__right">
      <section class="yc-card yc-deck-widget" id="yc-active-deck-card">
        <header class="yc-card__header"><h4>BARALHO ATIVO</h4><span class="yc-mono yc-cyan-text">22/22</span></header>
        <div class="yc-deck-widget__name">Baralho Inicial — Guarda Real</div>
        <div class="yc-deck-widget__fan" id="yc-deck-fan-preview"></div>
        <div class="yc-deck-widget__actions">
          <button class="yc-btn yc-btn--secondary" id="yc-btn-edit-deck">EDITAR BARALHO</button>
          <button class="yc-btn yc-btn--secondary" id="yc-btn-how-to-play">REGRAS</button>
        </div>
      </section>

      <button id="yc-btn-play-hero" class="yc-btn-play-lol">
        <span class="yc-btn-play-lol__sheen"></span>
        <span class="yc-btn-play-lol__icon">▶</span>
        <span class="yc-btn-play-lol__text">JOGAR</span>
      </button>
    </aside>
  </main>

  <!-- Z-30: Barra de Procura Persistente -->
  <div id="yc-queue-bar" class="yc-queue-bar" hidden>
    <div class="yc-queue-bar__pulse"></div>
    <div class="yc-queue-bar__meta">
      <span class="yc-queue-bar__label">A PROCURAR PARTIDA RANQUEADA…</span>
      <span id="yc-queue-timer" class="yc-queue-bar__timer yc-mono">00:00</span>
    </div>
    <button id="yc-queue-cancel" class="yc-queue-bar__cancel" aria-label="Cancelar procura">✕</button>
  </div>
</div>
```

CSS

```
/* styles/menu.css — Regras principais sem backdrop-filter, animações restritas a transform/opacity */
.yc-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--yc-bg-void);
  color: #F8FAFC;
  font-family: var(--yc-font-body);
  user-select: none;
}
.yc-backdrop, .yc-backdrop__poster, .yc-backdrop__video, .yc-backdrop__vignette, .yc-backdrop__particles {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.yc-backdrop__poster, .yc-backdrop__video {
  object-fit: cover;
  transform: scale(1.04);
  will-change: transform, opacity;
}
.yc-backdrop__video { opacity: 0; transition: opacity 450ms ease-out; }
.yc-backdrop__video.is-playing { opacity: 1; }
.yc-backdrop__vignette { z-index: 1; background: var(--yc-vignette-desktop); }
.yc-backdrop__particles { z-index: 1; }

.yc-hero-layer {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: -24px;
  transform: translate3d(-50%, 0, 0);
  height: 82vh;
  pointer-events: none;
  will-change: transform;
}
.yc-hero-layer__img {
  height: 100%;
  width: auto;
  filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.85));
}

.yc-card {
  background: var(--yc-panel-surface);
  border: var(--yc-border-ink);
  border-radius: var(--yc-radius-card);
  box-shadow: var(--yc-shadow-panel);
  padding: 16px;
}

/* Botão JOGAR ao estilo Hextech / Edição de Colecionador */
.yc-btn-play-lol {
  position: relative;
  width: 100%;
  height: 68px;
  border: 3px solid #0F141C;
  background: linear-gradient(180deg, #FFD166 0%, #FFB703 55%, #E09600 100%);
  box-shadow: var(--yc-shadow-btn-play);
  color: #0F141C;
  font-family: var(--yc-font-display);
  font-size: 26px;
  letter-spacing: 0.06em;
  cursor: pointer;
  overflow: hidden;
  clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
  transition: transform 140ms cubic-bezier(0.22, 1, 0.36, 1);
}
.yc-btn-play-lol:hover { transform: translate3d(0, -2px, 0) scale(1.015); }
.yc-btn-play-lol:active { transform: translate3d(0, 3px, 0) scale(0.99); }
.yc-btn-play-lol__sheen {
  position: absolute;
  top: 0; left: -120%;
  width: 60%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent);
  transform: skewX(-25deg);
}

@media (max-width: 768px) {
  .yc-backdrop__vignette { background: var(--yc-vignette-mobile); }
  .yc-hero-layer { height: 52vh; bottom: auto; top: 56px; }
  .yc-stage {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 60px 16px 76px;
    gap: 10px;
  }
  .yc-stage__left { display: none; }
  .yc-btn-play-lol { height: 60px; font-size: 22px; }
}

html.reduce-motion .yc-backdrop__video,
html.reduce-motion .yc-backdrop__particles { display: none !important; }
```

JavaScript

```
// src/ui/MenuBackdrop.js — Namespace clássico window.YC (Sem módulos ES, sem build)
(function (YC) {
  'use strict';

  var videoEl = null;
  var posterEl = null;
  var heroEl = null;
  var particleCanvas = null;
  var ctx2d = null;
  var rafId = null;
  var activeClipKey = '';
  var isDestroyedForMatch = false;
  var particles = [];

  var CLIPS = {
    splash: { base: 'assets/video/splash-loop', poster: 'assets/video/splash-poster.webp' },
    arena:  { base: 'assets/video/arena-loop',  poster: 'assets/video/arena-poster.webp' },
    queue:  { base: 'assets/video/queue-loop',  poster: 'assets/video/queue-poster.webp' }
  };

  function shouldDisableVideo() {
    if (typeof YC.reducedMotion === 'function' && YC.reducedMotion()) return true;
    if (document.documentElement.classList.contains('reduce-motion')) return true;
    var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn && (conn.saveData || conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) return true;
    return false;
  }

  function pickVariantSuffix() {
    var w = window.innerWidth || 1366;
    var h = window.innerHeight || 768;
    if (w <= 768 && h > w) return '-mobile';
    if (w >= 1600) return '-1080p';
    return '-720p';
  }

  function initParticles() {
    if (!particleCanvas || shouldDisableVideo()) return;
    ctx2d = particleCanvas.getContext('2d');
    var count = window.innerWidth <= 768 ? 10 : 22;
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: 1.2 + Math.random() * 2.2,
        vy: -0.25 - Math.random() * 0.45,
        vx: (Math.random() - 0.5) * 0.25,
        alpha: 0.2 + Math.random() * 0.55,
        gold: i % 3 !== 0
      });
    }
  }

  function tickParticles() {
    if (isDestroyedForMatch || !ctx2d || document.hidden) return;
    var w = particleCanvas.width;
    var h = particleCanvas.height;
    ctx2d.clearRect(0, 0, w, h);
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      ctx2d.fillStyle = p.gold
        ? 'rgba(255, 183, 3, ' + p.alpha + ')'
        : 'rgba(0, 180, 216, ' + p.alpha + ')';
      ctx2d.beginPath();
      ctx2d.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx2d.fill();
    }
    rafId = requestAnimationFrame(tickParticles);
  }

  function bindMouseParallax() {
    if (window.innerWidth <= 768) return;
    window.addEventListener('mousemove', function (e) {
      if (isDestroyedForMatch || shouldDisableVideo() || !window.gsap) return;
      var nx = (e.clientX / window.innerWidth) - 0.5;
      var ny = (e.clientY / window.innerHeight) - 0.5;
      if (videoEl) {
        gsap.to(videoEl, { x: -nx * 16, y: -ny * 10, duration: 0.65, ease: 'power2.out', overwrite: 'auto' });
      }
      if (heroEl) {
        gsap.to(heroEl, { x: nx * 24, y: ny * 12, duration: 0.55, ease: 'power2.out', overwrite: 'auto' });
      }
    }, { passive: true });
  }

  YC.MenuBackdrop = {
    init: function () {
      videoEl = document.getElementById('yc-backdrop-video');
      posterEl = document.getElementById('yc-backdrop-poster');
      heroEl = document.getElementById('yc-hero-art');
      particleCanvas = document.getElementById('yc-backdrop-particles');
      if (particleCanvas) {
        particleCanvas.width = window.innerWidth;
        particleCanvas.height = window.innerHeight;
      }
      bindMouseParallax();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) YC.MenuBackdrop.pause();
        else if (!isDestroyedForMatch) YC.MenuBackdrop.resume();
      });
    },

    setClip: function (clipKey) {
      var cfg = CLIPS[clipKey] || CLIPS.arena;
      isDestroyedForMatch = false;
      if (posterEl) posterEl.src = cfg.poster;
      if (!videoEl || shouldDisableVideo()) {
        if (videoEl) videoEl.classList.remove('is-playing');
        return;
      }
      if (activeClipKey === clipKey && videoEl.getAttribute('src')) {
        this.resume();
        return;
      }
      activeClipKey = clipKey;
      var suffix = pickVariantSuffix();
      var canWebM = videoEl.canPlayType('video/webm; codecs="vp9"') !== '';
      var ext = canWebM ? '.webm' : '.mp4';
      var nextSrc = cfg.base + suffix + ext;

      videoEl.classList.remove('is-playing');
      videoEl.src = nextSrc;
      videoEl.load();
      var playPromise = videoEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
          videoEl.classList.add('is-playing');
        }).catch(function () {
          videoEl.classList.remove('is-playing');
        });
      }
      if (!rafId) {
        initParticles();
        rafId = requestAnimationFrame(tickParticles);
      }
    },

    pause: function () {
      if (videoEl && !videoEl.paused) videoEl.pause();
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    },

    resume: function () {
      if (isDestroyedForMatch || shouldDisableVideo()) return;
      if (videoEl && videoEl.paused && videoEl.getAttribute('src')) {
        videoEl.play().catch(function () {});
      }
      if (!rafId && particleCanvas) rafId = requestAnimationFrame(tickParticles);
    },

    /* CRÍTICO: Chamar quando a partida 3D começa para libertar o descodificador de vídeo e buffers de VRAM/RAM */
    destroyForMatch: function () {
      isDestroyedForMatch = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (videoEl) {
        videoEl.pause();
        videoEl.removeAttribute('src');
        while (videoEl.firstChild) videoEl.removeChild(videoEl.firstChild);
        videoEl.load(); /* Força o Chromium/WebKit a libertar os buffers de vídeo */
        videoEl.classList.remove('is-playing');
      }
    }
  };
})(window.YC = window.YC || {});
```

## Secção F: Storyboard dos 7 Ecrãs, Tempos, Curvas de Easing e Áudio

### 1. Decisões de Fluxo UX Competitivo (1v1 Online)

1. **Deve existir botão "Aceitar / Recusar" num jogo 1v1?** Num jogo de equipa 5v5 como o *League of Legends*, as filas demoram minutos e 1 jogador ausente prejudica 9 pessoas. Porém, em jogos 1v1 rápidos (*Clash Royale*, *Marvel Snap*, *Hearthstone*), obrigar a clicar em "Aceitar" cria frustração por falsos positivos quando um jogador demora 5 s a reagir, além de exigir transações de confirmação com *timeouts* distribuídos no Firestore. **Recomendação:** Implementar o modal dramático **"PARTIDA ENCONTRADA!"** exatamente com a estética e o som de impacto do LoL, mas funcionar como um **Ready-Check Automático de `3200 ms`** com anel de progresso dourado e botão de confirmação imediata ("PRONTO!"). Se nenhum dos dois cancelar nos 3,2 s, a partida avança; se clicar em "PRONTO!", marca `p1Ready: true` no Firestore e avança mal ambos confirmem.
2. **Como funciona a Pré-Partida num 1v1?** Criar um ecrã separado de "Seleção de Campeões" de 30 s após encontrar adversário atrasa a entrada em jogo. Em vez disso, a escolha do **Baralho Ativo** e da **Personagem Favorita (Emblema/Ultimate de Destaque)** acontece no próprio ecrã de **Escolha de Modo (Lobby de Pré-Fila)** antes de entrar na fila, à semelhança do fluxo rápido do *Marvel Snap* e do *Pokémon Unite*.

### 2. Tabela de Tempos, Curvas de Easing e Síntese Sonora Web Audio por Ecrã

| Ecrã | Sequência de Animação (GSAP 3 / CSS) | Duração (`ms`) | Curva de Easing | Síntese Web Audio (`YC.Audio`) |
| --- | --- | --- | --- | --- |
| **1. Ecrã de Entrada (`SplashScreen.js`)** | 1. Fade-in do poster + vídeo `splash-loop` 2. Queda elástica do logótipo *Chess-Gi-Oh!* 3. Entrada dos botões ("Entrar com Google", "Convidado") | `0–450 ms` `150–700 ms` `450–850 ms` | `power2.out` `back.out(1.6)` `expo.out` | Acorde de abertura (`C3+G3+D4+E4`, filtro *lowpass* a abrir de 200 Hz a 2400 Hz em 900 ms) |
| **2. Arena Principal (`Hub.js`)** | 1. Transição do fundo e entrada da personagem `765×1024` da esquerda (`x: -60 → 0`) 2. Stagger dos cartões laterais e barra de topo (`stagger: 60ms`) 3. Varrimento de brilho (`sheen`) no botão JOGAR a cada `4500 ms` | `0–500 ms`  `100–480 ms` `650 ms` | `cubic-bezier(0.22,1,0.36,1)` `power3.out` `power1.inOut` | *Whoosh* suave de ar (ruído branco filtrado 400→1200 Hz, 180 ms) + clique mecânico ao passar nos botões (`triangle` 1800 Hz, 25 ms) |
| **3. Escolha de Modo (`ModeSelect.js`)** | 1. 3 mosaicos verticais (`320×440px` no desktop: **Ranqueada**, **Contra o Bot**, **Sala Privada**) sobem (`y: 40 → 0`, `scale: 0.96 → 1`) 2. Hover no mosaico expande a arte interna (`scale: 1.06`) e ilumina o filete dourado | `0–380 ms`  `220 ms` | `expo.out`  `power2.out` | Toque metálico duplo (`sine` 520 Hz → 780 Hz, 90 ms) ao selecionar modo; clique grave (`140 Hz`, 60 ms) ao escolher relógio (`5m/10m`) |
| **4. Procura e "Partida Encontrada!" (`QueueBar.js` + `MatchFound.js`)** | 1. `QueueBar` desliza do topo (`y: -30 → 0`) 2. Ao encontrar sala: escurecimento radial + embate do brasão central (`scale: 2.2 → 1.0`) 3. Anel SVG `stroke-dashoffset` desce durante `3200 ms`; título da aba pisca `"PARTIDA ENCONTRADA!"` a cada `600 ms` | `260 ms` `0–320 ms`  `3200 ms` | `back.out(1.4)` `expo.out`  `none` (linear) | **Som Hextech de Impacto:** Sub-bass `sine` (`110 Hz → 45 Hz`, 450 ms) + acorde metálico `sawtooth` (`D4+A4+F#5` com delay curto, 800 ms) |
| **5. Ecrã Carregamento / VS (`LoadingVS.js`)** | 1. Cartão Azul (`#00B4D8`, esquerda) e Cartão Carmesim (`#D90429`, direita) entram em diagonal (`±100vw → 0`) 2. Selo `VS` dourado embate ao centro com abalo de câmara (`x/y: ±6px`) 3. Barras de carregamento sobem com o carregamento real dos `.glb` (mínimo `2000 ms` vs Bot, real + mín. `3500 ms` Online) 4. Abertura das portas + *zoom* (`scale: 1 → 1.35`, `opacity: 0`) a mergulhar no estádio 3D | `0–420 ms`  `350–650 ms` `2000–6000 ms`  `600 ms` | `quart.out`  `elastic.out(1, 0.5)` `power1.out`  `power3.in` | Embate pesado de pedra/vinil (ruído *bandpass* 180 Hz + `sine` 60 Hz) + *riser* ascendente (`200 Hz → 1600 Hz`) na abertura para o estádio |
| **6. Fim de Partida (`PostGame.js`)** | 1. Câmara 3D abranda; brasão **VITÓRIA** (dourado/ciano) ou **DERROTA** (carmesim/ardósia) desce com impacto (`scale: 1.8 → 1.0`) 2. Retrato da personagem faz corte lateral 3. Contador numérico de Elo (`1000 → 1016`) interpolado em GSAP + voo de moedas/poeira em curva Bézier | `0–550 ms`  `300–700 ms` `700–1900 ms` | `back.out(1.7)`  `expo.out` `power2.out` | Fanfarra de Vitória (`C4→E4→G4→C5` em `triangle` + harmónicos) + tilintar rápido a cada incremento de Elo (`2400 Hz`, 18 ms) |

### 3. Música de Menu Gerada por IA: Recomendação e Implementação

Vale a pena adicionar **uma faixa instrumental de menu em ciclo de 48 segundos** gerada com o modelo **ACE-Step 1.5** (licença **Apache 2.0**, uso comercial livre). Codificada em **Opus/WebM a 64 kbps** (`~380 KB` para 48 s), carrega-se de forma diferida 2 segundos após a primeira interação do utilizador, aplicando mistura dinâmica em Web Audio (`BiquadFilterNode` a `650 Hz` e redução de ganho) quando o jogador abre submenus ou recebe notificações, tal como a arquitetura central de canais da Web Audio API do cliente do LoL.

## Secção G: Dados Online no Firestore e Regras de Segurança

Para alimentar o modal **"Partida Encontrada!"** e o **Ecrã de Carregamento / VS** sem inchar o documento da sala no Firestore, adicionam-se apenas **4 campos escalares curtos por jogador** (`favChar`, `elo`, `ready`, `loadPct`). Não são necessárias subcoleções novas.

### 1. Campos Novos Mínimos no Documento `rooms/{roomId}`

JSON

```
{
  "status": "matched",
  "p1Uid": "uid_abc",
  "p2Uid": "uid_xyz",
  "p1Name": "Duelista",
  "p2Name": "MestreKaito",
  "p1FavChar": "akane",
  "p2FavChar": "kaito",
  "p1Elo": 1048,
  "p2Elo": 1120,
  "p1Ready": true,
  "p2Ready": true,
  "p1LoadPct": 100,
  "p2LoadPct": 100
}
```

Para evitar escritas excessivas no Firestore durante o carregamento dos modelos `.glb`, o módulo `LoadingVS.js` atualiza `p1LoadPct` / `p2LoadPct` no máximo 3 vezes por cliente: no início (`15`), a meio do pré-carregamento (`60`) e quando o palco 3D está pronto (`100`). A liga (Bronze, Prata, Ouro, Platina, Diamante, Mestre) é derivada diretamente no cliente a partir de `p1Elo` / `p2Elo`.

### 2. Alterações às Regras de Segurança (`firestore.rules`)

JavaScript

```
function isValidCharId(id) {
  return id is string && id.size() <= 16;
}
function isValidPct(val) {
  return val is int && val >= 0 && val <= 100;
}
// Dentro de match /rooms/{roomId}: permitir aos participantes atualizar os seus próprios campos de VS/Ready
allow update: if request.auth != null && (
  (request.auth.uid == resource.data.p1Uid &&
   request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(['p1FavChar', 'p1Elo', 'p1Ready', 'p1LoadPct', 'status', 'moves', 'updatedAt']) &&
   isValidCharId(request.resource.data.p1FavChar) &&
   isValidPct(request.resource.data.p1LoadPct))
  ||
  (request.auth.uid == resource.data.p2Uid &&
   request.resource.data.diff(resource.data).affectedKeys()
     .hasOnly(['p2FavChar', 'p2Elo', 'p2Ready', 'p2LoadPct', 'status', 'moves', 'updatedAt']) &&
   isValidCharId(request.resource.data.p2FavChar) &&
   isValidPct(request.resource.data.p2LoadPct))
);
```

## Secção H: Orçamento de Desempenho, Carregamento em 4G e Gestão de Memória

### 1. Separação do Build Único de 35 MB

Os vídeos de fundo dos menus (`splash-loop`, `arena-loop`, `queue-loop`) **nunca devem ser embutidos em Base64 dentro do build HTML único de 35 MB.** Codificar 4 MB de vídeo em Base64 adiciona ~5,4 MB de texto ao ficheiro HTML, atrasa o parsing inicial do documento e aumenta o consumo de memória RAM na conversão de string para buffer. No build de ficheiro único, devem embutir-se apenas as imagens `poster` WebP (~35 KB cada) e carregar os vídeos por caminho externo (`assets/video/...`) ou recorrer automaticamente ao `poster` estático caso o ficheiro de vídeo não esteja presente localmente.

### 2. Orçamento por Ecrã e Tempo de Primeira Carga em 4G (1,5 MB/s efetivos)

| Fase de Carregamento | Ficheiros Carregados | Peso Total | Tempo Estimado em 4G | Estado Visual para o Utilizador |
| --- | --- | --- | --- | --- |
| **1. First Paint (Crítico)** | HTML + `styles/menu.css` + scripts `YC` + `arena-poster.webp` (35 KB) + PNG da personagem favorita convertida em WebP (`~85 KB`) | **~240 KB** | **< 0,25 s** | Interface completa, nítida e interativa com o fundo ilustrado (`poster`) e a personagem em destaque. |
| **2. Hidratação do Vídeo de Fundo** | `arena-loop-720p.webm` (computador) ou `arena-loop-mobile.webm` (telemóvel) com `preload="metadata"` + streaming | **0,65 MB (mobile)** **1,10 MB (desktop)** | **0,4 s – 0,8 s** | O vídeo faz um *fade-in* suave de `450 ms` sobre o `poster` assim que o primeiro GOP (2 s) está em buffer. |
| **3. Tempo Morto (`requestIdleCallback`)** | Faixa musical de menu (`~380 KB`), ilustrações dos mosaicos de Escolha de Modo (`3 × 45 KB` WebP) e modelo `.glb` da personagem do jogador | **~1,20 MB** | Em segundo plano (0 ms de bloqueio) | Quando o jogador clica em JOGAR, os mosaicos e o áudio já estão em cache. |
| **4. Ecrã de Carregamento / VS** | Modelos `.glb` das duas personagens da partida, texturas do estádio e vídeos de Ultimate das Lendárias nos baralhos | **2,5 MB – 4,5 MB** | **1,8 s – 3,2 s** | A barra de progresso de `LoadingVS.js` reflete o carregamento real via `THREE.LoadingManager`. |

### 3. Regras de Ouro de Memória, Bateria e Contextos WebGL

1. **Um Único `<video>` para Todos os Menus:** Nunca criar múltiplos elementos `<video>` escondidos com `display: none`. O módulo `MenuBackdrop.js` reutiliza um único nó `#yc-backdrop-video` e substitui o atributo `src`.
2. **Libertação Total na Entrada da Partida:** Assim que `LoadingVS.js` inicia o mergulho para o tabuleiro 3D, invoca `YC.MenuBackdrop.destroyForMatch()` (`pause()`, `removeAttribute('src')`, `load()`), libertando o descodificador de vídeo e a memória de texturas antes de o Three.js ativar o palco da partida.
3. **Separador Escondido (`document.hidden`):** O listener `visibilitychange` pausa imediatamente o vídeo, o `requestAnimationFrame` das partículas e o `AudioContext` (`audioCtx.suspend()`), eliminando o consumo de bateria em segundo plano.

## Secção I: Plano de Implementação Faseado para o Claude Code

Cada fase é autónoma, entregável individualmente e mantém cada ficheiro novo abaixo de **350 linhas**.

| Fase | Ficheiros Novos (Limite ≤350 linhas) | Ficheiros Existentes a Modificar | Critério de Aceitação e Testes |
| --- | --- | --- | --- |
| **Fase 1: Fundo Persistente, Tokens "Vinyl Prestige" e Nova Arena** *(Maior Impacto / Menor Risco)* | `styles/menu.css` (~280 linhas) `src/ui/MenuBackdrop.js` (~210 linhas) `tools/menu-video.py` (~180 linhas) | `index.html` (incluir CSS/JS) `src/ui/Hub.js` (montar barra de topo, herói 2.5D, banner/missões à esquerda, baralho + JOGAR à direita) | Arena abre a 60 fps com vídeo em ciclo, vinheta legível, paralaxe de rato, troca entre Arena/Loja/Baralhos sem o fundo piscar, e imagem parada instantânea quando `YC.reducedMotion()` está ativo. |
| **Fase 2: Escolha de Modo em Mosaicos e Ecrã de Carregamento / VS** | `src/ui/ModeSelect.js` (~240 linhas) `src/ui/LoadingVS.js` (~310 linhas) | `src/ui/PlayMenu.js` (redirecionar para `ModeSelect`) `src/ui/VersusScreen.js` (delegar em `LoadingVS`) | Clicar em JOGAR abre os 3 mosaicos (Ranqueada, Bot, Sala Privada). Iniciar partida contra o bot exibe `LoadingVS` com arte `765×1024`, dicas e barra de progresso (~2,2 s), chama `destroyForMatch()` e mergulha no tabuleiro 3D sem quebras. |
| **Fase 3: Barra de Procura Persistente, "Partida Encontrada!" e Firestore** | `src/ui/QueueBar.js` (~140 linhas) `src/ui/MatchFound.js` (~220 linhas) | `src/ui/OnlineLobby.js` `firestore.rules` (validar `FavChar`, `Elo`, `Ready`, `LoadPct`) | O jogador entra na fila e navega até Baralhos/Loja com a `QueueBar` ativa. Dois clientes emparelhados disparam o modal sincronizado `MatchFound` (3,2 s + alerta no título da aba) e transitam para `LoadingVS` com os dados reais do adversário. |
| **Fase 4: Ecrã de Entrada (Login) e Cerimónia de Fim de Partida** | `src/ui/SplashScreen.js` (~190 linhas) `src/ui/PostGame.js` (~290 linhas) | `src/game/MatchChain.js` (chamar `PostGame.show` no fim e restaurar `MenuBackdrop` ao sair) | Arranque exibe `SplashScreen` com logótipo animado e login. Fim de partida mostra brasão VITÓRIA/DERROTA, subida animada de Elo (`K=32`), voo de moedas/poeira e botão de Revanche. |

### Plano de Contingência (Se o Veo Recusar um Prompt ou a Quota Acabar)

1. **Recusa por Filtro de Pessoas:** Remover palavras como *"girl"*, *"boy"*, *"woman"* ou *"human"* do prompt e substituir por *"chibi vinyl anime figurine character, cel-shaded 3D game asset"* (ver Secção J).
2. **Quota Diária/Mensal Esgotada:** Executar o gerador determinístico local em `tools/menu-video.py --fallback-from-assets` (incluído na Secção J), que compõe automaticamente um vídeo `.webm`/`.mp4` a 24 fps usando a imagem do estádio de e-sports como fundo, aplica movimento de câmara lento e sobrepõe a ilustração PNG `765×1024` da Akane/Kaito com animação de respiração — custo zero de créditos e 100% de compatibilidade.

## Secção J: Anexo de Prompts Prontos a Colar e Scripts de Produção

### 1. Prompts para Imagens Iniciais no Google Gemini ("Criar Imagem" — Formato 16:9 e 9:16)

**Prompt 1 (Fotograma Base para `splash-loop` — Tabuleiro e Estádio):**
`Crie uma ilustração 16:9 no estilo anime cel-shading com contorno escuro definido, sem fotorrealismo. Um estádio de e-sports noturno iluminado por holofotes dourados (#FFB703) e azuis ciano (#00B4D8), sem texto nem logótipos. No centro, um tabuleiro de xadrez de plástico mate escuro com linhas néon ciano e carmesim (#D90429). Em primeiro plano, um Rei branco e uma Dama preta em estilo brinquedo de vinil colecionável com coroas douradas, rodeados por cartas mágicas brilhantes a levitar. Deixe o terço superior central escuro para o logótipo.`

**Prompt 2 (Fotograma Base para `arena-loop` — Akane e Kaito no Palco):**
`Anexar 21-akane-3d-vistas.png e 24-kaito-aterragem.jpg. Crie uma composição 16:9 (e uma variante 9:16 vertical) mantendo o design destas personagens: à centro-esquerda, Akane (rainha rubi de anime com cetro dourado e capa vermelha) e à centro-direita, Kaito (guardião azul com escudo de hexágonos luminosos). Estão no centro do estádio de xadrez competitivo sobre casas pretas e brancas, iluminação dramática dourada e ciano, faíscas douradas no ar e margens laterais escuras para leitura de interface.`

### 2. Prompts em Inglês para o Google Veo 3.1 / Google Flow (`Frames to Video` e `Ingredients`)

- Para `arena-loop` (No Google Flow: selecionar `Veo 3.1 Fast`, modo `Frames to Video`, carregar a imagem da Akane/Kaito tanto em `+ Add start frame` como em `+ Add end frame`, 8 segundos, 16:9 e 9:16):
Stylized 2D/3D cel-shaded anime game menu background loop. The anime queen figurine character with the ruby scepter and the blue guardian character stand heroically on a glowing chess arena stage. Subtle idle breathing motion, cape and hair gently billowing in a warm breeze, ruby crystal pulsing with golden light, and floating golden embers drifting upward across the dark esports stadium. Steady cinematic medium-wide framing returning smoothly to the exact starting pose. Non-photorealistic stylized game art.
- **Para `splash-loop` (Modo `Frames to Video` com o Fotograma Base 1):**
Stylized cel-shaded anime game cinematic loop. Low-angle camera slowly gliding across a glossy vinyl chessboard inside a dark esports stadium lit by cyan and warm gold spotlights. Collectible vinyl chess King and Queen pieces gleam as holographic trick cards with glowing golden borders orbit slowly around the board, releasing soft golden sparks. Smooth continuous motion returning to the initial frame.
- **Para `queue-loop` (Fundo de Procura de Partida e Ecrã VS):**
Stylized anime esports arena background loop. Low symmetrical camera facing the center of a futuristic chess stage. From the left side, streams of cyan energy (#00B4D8) flow across the chessboard; from the right side, streams of crimson energy (#D90429) clash against them in the center, sending up golden sparks (#FFB703) into the dark stadium air. Seamless looping energy flow.

### 3. Prompt para Música de Menu no ACE-Step 1.5 (Apache 2.0)

- Tags (`prompt`):
anime tournament menu theme, upbeat electronic orchestral hybrid, brass stabs, Rhodes electric piano, crisp synth bass, energetic breakbeat drums, 118 BPM, competitive, playful, heroic, clean mix, loopable game soundtrack
- Lyrics:
[instrumental]
- **Duration:** `48` segundos. Converter para WebM/Opus com:
`ffmpeg -y -i acestep_out.wav -af "afade=t=in:st=0:d=1.5,afade=t=out:st=46.5:d=1.5" -c:a libopus -b:a 64k assets/audio/menu-theme.webm`

### 4. Script Utilitário `tools/menu-video.py` (Pipeline FFmpeg + Fallback sem Veo)

Python

```
#!/usr/bin/env python3
"""
tools/menu-video.py — Processa clipes do Veo 3.1 em loops sem costura (WebM VP9 + MP4 H.264 + Poster WebP)
ou gera um vídeo de fundo determinístico a partir dos próprios PNGs do jogo se a quota do Veo acabar.
Uso:
  python3 tools/menu-video.py --input raw_arena.mp4 --name arena-loop
  python3 tools/menu-video.py --fallback-from-assets --bg assets/bg/stadium.jpg --char assets/chars/akane.png --name arena-loop
"""
import argparse
import pathlib
import subprocess

OUT_DIR = pathlib.Path("assets/video")

def run(cmd):
    print(">>", " ".join(cmd))
    subprocess.run(cmd, check=True)

def build_seamless_master(input_mp4: str, master_out: str):
    # Cria loop sem costura de 7s a partir de clipe de 8s com crossfade de 1s entre o fim e o início
    fc = (
        "[0:v]fps=24,scale=1920:1080:flags=lanczos,split[body][pre];"
        "[pre]trim=duration=1,setpts=PTS-STARTPTS[head];"
        "[body]trim=start=1,setpts=PTS-STARTPTS[main];"
        "[main][head]xfade=transition=fade:duration=1:offset=6,format=yuv420p[outv]"
    )
    run(["ffmpeg", "-y", "-i", input_mp4, "-filter_complex", fc, "-map", "[outv]", "-an", master_out])

def build_fallback_from_assets(bg_img: str, char_img: str, master_out: str):
    # Contingência gratuita: anima o estádio + personagem PNG (respiração suave de 8s) a 24fps
    fc = (
        "[0:v]scale=2112:1188,zoompan=z='1.04+0.03*sin(2*PI*on/192)':"
        "x='iw/2-(iw/zoom/2)+18*sin(2*PI*on/192)':y='ih/2-(ih/zoom/2)':d=192:s=1920x1080:fps=24[bg];"
        "[1:v]scale=-1:920[ch];"
        "[bg][ch]overlay=x='(W-w)/2+10*sin(2*PI*t/8)':y='H-h+20+8*sin(2*PI*t/4)':shortest=1,format=yuv420p[outv]"
    )
    run([
        "ffmpeg", "-y", "-loop", "1", "-t", "8", "-i", bg_img,
        "-loop", "1", "-t", "8", "-i", char_img,
        "-filter_complex", fc, "-map", "[outv]", "-t", "8", "-r", "24", "-an", master_out
    ])

def export_variants(master_mp4: str, name: str):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # 1. Poster WebP (720p, ~35 KB)
    run([
        "ffmpeg", "-y", "-i", master_mp4, "-vf", "scale=1280:720",
        "-vframes", "1", "-c:v", "libwebp", "-quality", "82",
        str(OUT_DIR / f"{name.replace('-loop', '')}-poster.webp")
    ])
    # 2. Variantes 1080p, 720p e 480p (WebM VP9 + MP4 H.264)
    specs = [
        ("1080p", "1920:1080", "1800k", "2600k", "31", "23"),
        ("720p",  "1280:720",  "1100k", "1600k", "33", "24"),
        ("480p",  "854:480",   "600k",  "900k",  "35", "25"),
    ]
    for tag, res, bv, maxr, crf_vp9, crf_h264 in specs:
        run([
            "ffmpeg", "-y", "-i", master_mp4, "-vf", f"scale={res}:flags=lanczos",
            "-c:v", "libvpx-vp9", "-b:v", bv, "-maxrate", maxr, "-crf", crf_vp9,
            "-row-mt", "1", "-g", "48", "-an", str(OUT_DIR / f"{name}-{tag}.webm")
        ])
        run([
            "ffmpeg", "-y", "-i", master_mp4, "-vf", f"scale={res}:flags=lanczos",
            "-c:v", "libx264", "-preset", "slow", "-crf", crf_h264, "-maxrate", maxr,
            "-bufsize", "3400k", "-g", "48", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-an", str(OUT_DIR / f"{name}-{tag}.mp4")
        ])
    # 3. Variante Mobile Vertical 9:16 (540x960 por corte central se não houver master 9:16 dedicado)
    run([
        "ffmpeg", "-y", "-i", master_mp4, "-vf", "crop=ih*9/16:ih,scale=540:960:flags=lanczos",
        "-c:v", "libvpx-vp9", "-b:v", "650k", "-maxrate", "950k", "-crf", "34",
        "-row-mt", "1", "-g", "48", "-an", str(OUT_DIR / f"{name}-mobile.webm")
    ])
    run([
        "ffmpeg", "-y", "-i", master_mp4, "-vf", "crop=ih*9/16:ih,scale=540:960:flags=lanczos",
        "-c:v", "libx264", "-preset", "slow", "-crf", "25", "-maxrate", "950k",
        "-bufsize", "1900k", "-g", "48", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        "-an", str(OUT_DIR / f"{name}-mobile.mp4")
    ])

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", help="Vídeo MP4 de 8s gerado no Veo 3.1")
    ap.add_argument("--fallback-from-assets", action="store_true")
    ap.add_argument("--bg", default="assets/bg/stadium.jpg")
    ap.add_argument("--char", default="assets/chars/akane.png")
    ap.add_argument("--name", default="arena-loop")
    args = ap.parse_args()

    master = f"/tmp/{args.name}_master.mp4"
    if args.fallback_from_assets:
        build_fallback_from_assets(args.bg, args.char, master)
    else:
        build_seamless_master(args.input, master)
    export_variants(master, args.name)
```

