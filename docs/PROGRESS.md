# Progresso — Chess-Gi-Oh! Cartoon Edition

> Ficheiro de passagem de testemunho entre o Pedro (Claude Code) e o Diego (Codex).
> **Lê-o no início de cada sessão e atualiza-o no fim** (ver `AGENTS.md`, secção 2).

## Estado atual (2026-10-26)

**No ar (`main`, juntada a 2026-10-26):** <https://yuchess.vercel.app/>. A partida usa um palco 3D em Three.js com peças de vinil, partículas, mão estilo Hearthstone e arrastar cartas (ver o registo mais recente). O jogo foi refeito do zero seguindo o relatório "Chess-Gi-Oh! Cartoon Edition" do Pedro. Substitui o protótipo "Chess-Oh! Uno-Head" (xadrez + Uno, estilo 1930) e o modo "Speed Duel" (só cartas) — os dois continuam no histórico do git (`main` cb44011 e branch `pedro/duel-links`).

**Funciona e está testado**
- Xadrez completo (`src/game/ChessRules.js`): lances legais, xeque, xeque-mate, afogamento, roque, en passant, promoção, 50 lances, repetição tripla, material insuficiente. Contagens *perft* de referência certas (início, Kiwipete, posições 3–5).
- 31 cartas do relatório com efeitos, Chain de Velocidade 1/2/3, janelas de resposta (captura, destruição, xeque), Zona de Armadilhas com "enjoo", Armadilhas de Casa escondidas (máx. 3), escudos, congelar, metamorfose, teletransporte, etc. 31 testes de cenário a passar.
- Bot (Fácil/Médio/Difícil) e simulações: 30/30 partidas bot vs bot sem quebrar invariantes; todas as cartas chegam a ser usadas.
- Economia: pacotinhos de 5 cartas com raridades, pity épico/lendário, duplicados → Poeira Estelar, criação de cartas, validação de baralhos, recompensas.
- Interface cartoon nova (peças com expressões, cartas holográficas, animações GSAP, confetes, sons sintetizados): Arena, Loja com abertura em 4 atos, Baralhos, partida contra o bot com respostas da Chain, layout de telemóvel. Testado no navegador (partidas inteiras bot vs bot no ecrã sem erros; equipar, virar carta, lance e resposta com a Égide feitos à mão).
- Protocolo online: 8/8 pares sincronizados em memória (com latência e desistências).

**Escrito mas ainda não testado com o Firebase real**
- Login (Google, convidado, convidado → Google), coleção em `users/{uid}`, salas com baralho (`v: 2`), ranqueada e classificação. O SDK carrega e o ecrã de entrada aparece; o login não foi feito nos testes.

## Configuração pendente (fazer uma vez, na consola)

- [ ] **Firebase → Authentication → «Começar» (Get started)**. Hoje a autenticação nunca foi ligada: o Firebase responde `CONFIGURATION_NOT_FOUND` e por isso nem o convidado nem o Google conseguem entrar. Depois disso, em **Sign-in method**, ativar **Anónimo** e **Google**.
- [ ] **Firebase → Firestore → Regras**: colar o `firestore.rules` **desta branch** e publicar. Hoje as regras do projeto ainda estão abertas (leitura sem login funciona) e as novas são necessárias para `users/{uid}` e para as salas com baralho.
- [ ] **Firebase → Authentication → Sign-in method**: Google e Anónimo ativos (confirmar).
- [ ] **Firebase → Authentication → Settings → Authorized domains**: `yuchess.vercel.app` (confirmar).
- [ ] Testar com dois navegadores: sala privada, ranqueada, desistência, abandono, e ver se a coleção passa entre dispositivos com a mesma conta Google.

## Em curso / a meio

- Arte dos objetos (ver Próximos passos 1b): o Claude in Chrome não estava ligado, por isso as imagens ainda não foram geradas no Gemini.
- O Pedro está a testar a versão publicada e vai enviar os erros que encontrar (sobretudo: velocidade das animações, arrastar cartas no telemóvel, legibilidade do zoom).
- Falta publicar o `firestore.rules` no Firebase (ver "Configuração pendente") para o online funcionar.

## Próximos passos (por prioridade)

1. Teste real online + corrigir o que as regras recusarem.
2. Visual: aplicar o estilo néon/3D ao menu, loja e baralhos (os retratos 3D podem entrar lá com `YC.pieceHTML` se houver um renderer); fundo de estádio gerado por IA (prompts no relatório do Gemini, secção 5). Os modelos GLB deixaram de ser precisos: as peças de vinil feitas por código substituem-nos.
1b. **Arte dos objetos com o Gemini** (a meio): prompts prontos em `docs/ART-PROMPTS.md`, recorte com `tools/slice-items.py`. Falta gerar as 2 folhas, descarregá-las e correr o recorte. O jogo já usa as imagens sozinho assim que estiverem em `assets/items/`.
2b. Arrastar: hoje só a mão arrasta. Falta arrastar uma carta da Zona (Magia Rápida virada) para o tabuleiro e um "seta de mira" do Íman entre as duas peças.
3. Balanceamento: a Lança e a Mola são fortes; ver taxas de vitória por carta com `tools/simulate.js` (acrescentar estatística por carta).
3. Tutorial interativo curto (primeira partida guiada: equipar, armadilha, resposta).
4. Escolher alvos à mão nas cartas automáticas (Gerador de Bolhas, Bomba de Fumo, Boneco de Testes) — hoje o motor escolhe o melhor alvo.
5. Revanche rápida no online e histórico de partidas no perfil.
6. Autoridade no servidor (Cloud Functions) para esconder mão/armadilhas e proteger a economia.

## Problemas conhecidos

- Online: cada cliente tem o estado completo; quem abrir as ferramentas do navegador vê a mão e as armadilhas do adversário.
- A economia é calculada no cliente (dá para fazer batota na coleção); o rating está protegido pelas regras.
- Num separador escondido o navegador quase para as animações (requestAnimationFrame); o motor espera no máximo 4 s por animação, por isso o jogo nunca bloqueia, só fica lento.

## Registo de sessões

### 2026-10-27 · Pedro + Claude Code · branch `pedro/chess-gi-oh` → `main`
- **Pedido do Pedro**: quando se arrasta uma carta para o campo ela deve transformar-se no objeto (a bomba numa bombinha, as botas num item) com um resumo de onde a pôr; usar o Gemini (conta Pro) para gerar arte, sprite sheets ou vídeos e profissionalizar o jogo.
- **Mudou**: `src/ui/ItemToken.js` (novo: ficha do objeto com aura, sombra e flutuação; nuvem de brilhos; voo em arco), `MatchDrag.js` reescrito (carta ↔ objeto ao sair/voltar à mão; etiqueta com o que fazer, "Esconder em E4" / "Equipar o Peão em E2" a verde, ou a razão a vermelho: "Só nas filas 3 a 6", "Casa ocupada", "Só nas tuas peças"…), `Anim3DCards.js` (ao armar, o objeto paira, cai, achata-se e afunda na casa; ao equipar é o objeto que voa até à peça). Reativas e Counter-Traps continuam carta (vão viradas para a Zona).
- **Arte**: `docs/ART-PROMPTS.md` (2 prompts de folhas 4×4 com os 31 objetos + baú, mesmo estilo de vinil, fundo branco), `tools/slice-items.py` (recorta, tira o fundo e gera `src/ui/ItemArtList.js`), cartas/cubos/medalhas/fichas passam a usar `assets/items/*.png` quando existir; o `build.js` embute as imagens no ficheiro único. Testado com uma folha falsa.
- **Decisões**: vídeos do Veo só para as Lendárias (o resto ficaria pesado); sprite sheets da IA não são consistentes entre quadros, por isso explosões e fumo continuam por código.
- **Como testar**: os 4 comandos; no navegador arrastar uma Armadilha de Casa (vira objeto e cai na casa) e um Equipamento (etiqueta muda conforme a peça).

### 2026-10-26 (tarde) · Pedro + Claude Code · branch `pedro/chess-gi-oh` → `main`
- **Pedido do Pedro**: as animações continuavam feias e rápidas; queria o estilo Hearthstone (passar o rato/clicar abre a carta no sítio, não num painel lateral), ver os detalhes da armadilha ao armá-la, arrastar a carta até à casa ou peça, e peças e "fotos" das peças mais bonitas.
- **Animações** (`src/view3d/Anim3D.js` reescrito + `Anim3DCards.js` novo + `Particles3D.js` novo): lance = agachar → salto com rasto de luz e inclinação → aterrar com poeira, faíscas e onda + ressalto elástico; captura = recuo → investida → pausa de impacto de 0,14 s → "POW!/KAPOW!" em néon 3D, faíscas, clarão de luz, tremor de câmara e a peça vencida projetada a rodar até se partir em estilhaços. Texto néon 3D em vez dos balões 2D, bigorna a cair, gelo, teletransporte, feixes de luz nas cartas. Velocidade base 0,5 (o "Rápido" é 0,9) e o bot espera 1,5 s antes de jogar.
- **Peças** (`PieceMeshes.js`): plástico envernizado com reflexos (`MeshPhysicalMaterial` + `RoomEnvironment`), ouro metálico, bochechas e sorrisos; Torre com porta e bandeira a ondular, Cavalo com orelhas, crina e narinas, Bispo com colar e medalha, Dama com colar de pérolas e gema, Rei com capa vermelha, gola de arminho e rubi. Olham à volta devagar.
- **Fotos das peças** (`Portraits3D.js`): cada peça é desenhada uma vez para imagem com o renderer do palco (tom ACES aplicado no CPU) e usada no avatar do HUD (busto do Rei), peças capturadas, promoção, cartão da peça e mascote. Sem WebGL volta ao SVG.
- **Cartas**: a carta da mão cresce no próprio sítio (×1,85, a área de clique fica igual para se passar às vizinhas) com etiqueta ao lado (tipo, raridade, velocidade e como se joga); o painel lateral foi removido; Zona, cemitério, Chain e respostas abrem o zoom junto da carta. **Arrastar** (`src/ui/MatchDrag.js`): a carta segue o rato, inclina, encolhe sobre o tabuleiro, brilha a verde/vermelho e há um marcador na casa; ao largar vira a ação normal (equipar, armar, virar na Zona, ativar; o Íman pede depois a tua peça); alvo inválido → volta à mão. Clicar continua a funcionar.
- **Armadilhas**: ao armar aparece "ARMADA!" e a carta ao lado da casa durante 2,6 s; os cubos das tuas armadilhas (e das reveladas) mostram a carta ao passar o rato.
- **Decisões**: os efeitos 3D vão para `board.fxLayer()` porque o `mark()` limpa `layers.marks`; o clarão do bloom e as luzes de impacto ficaram fracos de propósito (mais fortes lavam o ecrã de branco); no telemóvel o zoom da carta escolhida é ×1,55 e a barra de ação sobe para não a tapar.
- **Como testar**: os 4 comandos (30/30, 8/8, 31/31, regras ok); no navegador jogar contra o bot, passar o rato pelas cartas da mão, arrastar um Equipamento para uma peça e uma Armadilha de Casa para uma casa das filas 3–6, passar o rato pelo cubo da armadilha, ver uma captura.

### 2026-10-26 (madrugada) · Pedro + Claude Code · branch `pedro/chess-gi-oh` → `main`
- **Pedido do Pedro**: a arena em CSS 3D "ficou feia"; enviou um relatório do Gemini Deep Research ("Relatório Técnico e de Direção de Arte") que pede uma cena WebGL a sério igual à imagem "Chess Links".
- **Mudou**: novo palco 3D em Three.js 0.160.0 por importmap (sem build) em `src/view3d/` — câmara do relatório (FOV 40, em telemóvel 46 e à distância certa para caber), bloom seletivo, moldura com tubo néon ciano/magenta, casas de vidro, grelha luminosa, círculo mágico rotativo (shader), Zonas de Armadilhas (3 por jogador) e baralho/cemitério em 3D, peças chibi feitas por código (silhuetas torneadas, cabeça do Cavalo esculpida, coroas, olhos que piscam, contorno cartoon) em pedestais holográficos (azul = tuas, vermelho = adversário), cubos holográficos nas tuas armadilhas, anel dourado de equipamento, cúpula de escudo, cristal de gelo, pilar de xeque, setas e etiquetas "D5". Animações 3D (`Anim3D.js`): salto com onda de choque, investida e vítima a desfazer-se, ressalto, bigorna, estilhaços do escudo, pilar de luz das armadilhas, flash de bloom, zoom de câmara no xeque. HUD como no relatório (painéis chanfrados, relógio de 7 segmentos, MATERIAL, telões, registo de 2 linhas, painel lateral da carta, botão de turno dourado), cartas com moldura por função (Cinzel/Spectral) e brilho por raridade. Fontes novas: Chakra Petch, Orbitron, Cinzel, Cinzel Decorative, Spectral.
- **Decisões**: peças feitas por código em vez de GLB do Quaternius (sem descarregar ficheiros; há `GLTFLoader` pronto se quisermos trocar mais tarde); avatares com a peça Rei em vez de imagens de IA; peças a 86 % do tamanho do relatório e câmara mais inclinada para as peças da frente não taparem as de trás; o tabuleiro CSS antigo fica como reserva sem WebGL.
- **Como testar**: os 4 comandos de teste; no navegador jogar contra o bot, passar o rato pelas cartas da mão (painel à esquerda) e pelas peças (cartão animado), ver no telemóvel (modo vertical).

### 2026-10-26 (noite) · Pedro + Claude Code · branch `pedro/chess-gi-oh` → `main`
- **Pedido do Pedro** (com imagens de referência: "Yu-Gi-Oh! Chess Links" e Hearthstone): login não funciona, cartas ilegíveis, animações demasiado rápidas, mão estilo Hearthstone com zoom, histórico escondido, tabuleiro maior, cartão da peça ao passar o rato, relógios e contagem de peças capturadas como na foto.
- **Mudou**: nova arena da partida (`src/ui/MatchUI.js` reescrito + `MatchHUD.js`, `MatchChain.js`, `CardZoom.js`, `PieceInspector.js`; `styles/arena.css` novo; `board.css` e `match.css` reescritos). Tabuleiro neon em 3D com peças em pé sobre bases a brilhar (azul = tuas, rosa = adversário), Zonas de Armadilhas à esquerda, baralho/cemitério à direita (clicar no cemitério mostra as cartas), botões grandes à direita (vez/histórico/desistir/velocidade/som/sair), topo com retrato, MATERIAL, relógio e peças capturadas, as 2 últimas jogadas em destaque e o resto numa gaveta. Mão em leque que aumenta ao passar o rato; zoom grande das cartas da Zona/Chain/cemitério; casas de destino com o nome (ex.: "D5"). Relógio contra o bot (5 min, 10 min ou sem limite — perde quem chegar a zero; só conta na própria preparação); no online mostra os 2 min do turno. Animações a 60 % da velocidade (o "Rápido" fica a 110 %). Cartas com ilustração mais baixa para o texto caber inteiro. Motor: `players[t].lostTypes` (tipos de peças perdidas, para o contador).
- **Login**: não era bug do código. A Autenticação do projeto Firebase nunca foi ligada (`CONFIGURATION_NOT_FOUND`); acrescentada mensagem de erro clara para esse caso.
- **Como testar**: os 4 comandos de teste; no navegador "Jogar contra o bot", passar o rato por cartas e peças, abrir o histórico, ver o relógio a contar.

### 2026-10-26 · Pedro + Claude Code · branch `pedro/chess-gi-oh`
- **Mudou**: refeito o jogo inteiro segundo o relatório "Chess-Gi-Oh! Cartoon Edition". Apagados `src/engine`, `src/data`, `src/ai`, `src/ui`, `src/view`, `src/audio`, `styles` antigos. Novos: `src/game/*` (motor), `src/view/*` (arte e animações), `src/ui/*` (ecrãs), `src/audio/SoundEngine.js`, `src/net/ProfileStore.js`, `tools/test-chess-rules.js`, `tools/test-cards.js`, `tools/load-engine.js`, novo `tools/simulate*.js` e `tools/gallery.html`. `firestore.rules`: `users/{uid}` + baralho nas salas (`v: 2`). Equipas no motor passam a `'w'`/`'b'` (no Firestore continuam `WHITE`/`BLACK`, ver `YC.TEAM_NAME`). `LockstepSession` envia `resp` (carta + alvo) nas respostas da Chain.
- **Decisões**: sem Next.js/React/chess.js (o projeto continua sem build, para o Diego e o Codex); GSAP e canvas-confetti por CDN com alternativa; Reativas e Counter-Traps viram-se na Zona e respondem a partir do turno seguinte; 12 s para responder; a Mola não dá xeque por salto; capturar peça com escudo não tira de xeque; efeitos que exporiam o próprio Rei congelam em vez de destruir/mover; Armadilhas de Casa só nas filas 3–6; limite de 300 turnos. Lista completa no README ("Onde me afastei do relatório").
- **Correções encontradas pelas simulações**: a Bomba de Fumo e o Íman podiam deixar quem jogou em xeque (esquiva que abria uma linha; Cetro roubado a meio do lance do adversário) — agora simulam o resultado completo antes de serem permitidos. As simulações usam limite de nós no bot (`cfg.maxNodes`) para serem reprodutíveis: `node tools/simulate.js 1 --from=85` repete a partida 85.
- **Como testar**: `node tools/test-chess-rules.js`, `node tools/test-cards.js`, `node tools/simulate.js 30`, `node tools/simulate-online.js 8`; no navegador "Jogar contra o bot", Loja → abrir pacote, Baralhos → auto-completar.
- **Ficou por fazer**: publicar as regras, teste online real com duas pessoas. A branch foi juntada a `main` (fast-forward) a pedido do Pedro.

### 2026-10-23 (tarde) · Pedro + Claude Code · branch `pedro/duel-links`
- Modo "Speed Duel" (Duel Links só com cartas). **Abandonado** a pedido do Pedro: ele quer xadrez a sério misturado com cartas. Fica na branch para consulta.

### 2026-10-23 · Pedro + Claude Code · branch `main`
- Primeiro protótipo "Chess-Oh! Uno-Head" (xadrez + Uno + Chain, estilo 1930) e o modo online com Firebase (salas privadas, ranqueada com Elo e caução). O online (`src/net/*`) foi reaproveitado na versão nova.
