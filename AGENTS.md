# AGENTS.md — instruções para agentes de código (Codex, Claude Code, Cursor…)

Projeto: **Chess-Gi-Oh! Cartoon Edition** — xadrez a sério (regras normais) misturado com cartas ao estilo Yu-Gi-Oh!: equipamentos, armadilhas escondidas em casas do tabuleiro, armadilhas reativas (escudos), counter-traps e magias rápidas, com Chain de Velocidade 1/2/3. Direção de arte "Caixa de Brinquedos de Vinil Colecionável" (docs/DIRECAO-DE-ARTE.md): peças de vinil com olhos e expressões, interface de plástico mate com contorno escuro, cartas de cartão laminado, animações GSAP. JavaScript puro, sem build. Deploy estático na Vercel; dados no Firebase.

- **Contra o bot** (Fácil/Médio/Difícil) e **online** (ranqueada com Elo ou sala privada por código).
- **Loja**: pacotinhos de 5 cartas (100 de ouro) com raridades Comum/Rara/Épica/Lendária, pity e Poeira Estelar.
- **Baralhos**: montar baralhos de 22 (`YC.Cards.RULES.DECK_SIZE`, até 3 Lendárias), criar cartas com Poeira Estelar.
- **120 cartas**: as 31 originais + 89 da expansão em 7 famílias (Criogenia, Oficina, Circo, Laboratório, Tribunal, Sucata & Piratas, Polícia) — relatório em `docs/RELATORIO-CARTAS.md`, dados originais em `docs/cartas-novas.json`.

Equipa: **Pedro** (trabalha com Claude Code) e **Diego** (trabalha com Codex). Os dois agentes partilham este ficheiro e o `docs/PROGRESS.md`.

## 1. Ao começar uma sessão

1. `git pull` na branch onde vais trabalhar.
2. Lê **`docs/PROGRESS.md`**: estado atual, o que ficou a meio, próximos passos e o registo das últimas sessões.
3. Lê `git log --oneline -20` para ver o que o outro mudou desde então.
4. Se a tarefa não estiver no `PROGRESS.md`, acrescenta-a em "Próximos passos" antes de começar.

## 2. Ao terminar uma sessão (obrigatório)

Atualiza `docs/PROGRESS.md` **no mesmo commit** (ou no último commit da sessão):

- **Estado atual**: o que funciona agora.
- **Em curso / a meio**: o que ficou por acabar, com ficheiro e função exatos.
- **Próximos passos**: risca o que fizeste, acrescenta o que descobriste.
- **Registo de sessões**: nova entrada no topo com data, quem (`Pedro + Claude Code` ou `Diego + Codex`), branch, o que mudou, como testar e decisões tomadas.

Escreve como se o próximo leitor não tivesse visto nada do que fizeste.

## 3. Correr e testar

| Comando | Para quê |
|---|---|
| `python tools/serve.py` → <http://localhost:8765> | Servidor local sem cache. |
| `node tools/test-chess-rules.js` | Regras de xadrez (contagens *perft* de referência) + equipamentos que mudam lances. Tem de dar `Tudo certo.` (`--deep` corre as contagens grandes). |
| `node tools/test-cards.js` | Um teste de cenário por carta/regra: os das 31 originais estão no próprio ficheiro e os das 89 da expansão (e das regras do baralho de 22) em `tools/tests/*.js`, carregados sozinhos. Tem de dar `126/126 testes passaram.` |
| `node tools/simulate.js 30` | 30 partidas bot vs bot sem ecrã; verifica invariantes (2 × 22 cartas sempre, 1 Rei de cada cor, Chain fechada, quem jogou não fica em xeque). Tem de dar `30/30` e `Cartas nunca ativadas: nenhuma`. |
| `node tools/simulate-online.js 8` | Protocolo online (lockstep) com dois motores ligados por mensagens, com latência e desistências. Tem de dar `Sincronizadas: 8/8`. |
| `node tools/build.js` | Gera `dist/chess-gi-oh.html` (ficheiro único). `dist/` não vai para o git. |
| `tools/gallery.html` | Galeria das peças (todos os estados) e das 120 cartas. |
| `python tools/legend-video.py start ICONE '#cor'` / `pack video.mp4 ICONE` | Imagem inicial para o Veo e compressão do vídeo de uma Lendária para `assets/video/` (ver `docs/ART-PROMPTS.md`). |
| `python tools/slice-items.py folha.png A` | Folhas A e B (31 originais) e C a H (as 89 da expansão, pela ordem de `docs/cartas-novas.json`). Recorta uma folha 4×4 de objetos gerada pelo Gemini (fundo branco) em `assets/items/*.png` transparentes e atualiza `src/ui/ItemArtList.js`. Prompts em `docs/ART-PROMPTS.md`. Precisa do Pillow. |

**Antes de cada commit**: os 4 comandos de teste passam e abriste o jogo no navegador para jogar pelo menos um turno do que mudaste.

## 4. Regras de arquitetura (não quebrar)

- **Scripts clássicos com o namespace global `YC`**, carregados por ordem no `index.html`. Ficheiro novo → acrescenta-o ao `index.html`; se for do motor, também a `tools/load-engine.js` (é a lista que os testes usam).
- **O motor não toca no DOM**: `src/core`, `src/game`, `src/net/LockstepSession.js` têm de correr em Node.
- **Todo o estado da partida muda através de `Match.dispatch(ação)`** (ou dentro da Chain que essa ação abre). Ações: `MOVE`, `EQUIP`, `SET_TRAP`, `SET_CARD`, `ACTIVATE`, `PASS`, `AUTO_MOVE`. O online replica exatamente estas ações e as respostas da Chain nos dois clientes: mudar estado por fora causa dessincronização.
- **Aleatoriedade da partida só via `match.rng`** (semente partilhada). Nunca `Math.random()` no motor; na IA, na loja e na parte visual não faz mal.
- **Cartas novas**: dados em `src/game/Cards.js` (as 31 originais, lista `RAW`) ou `src/game/CardsNew.js` (expansão, mesmo formato + `family`, `target`, `ownTurn`, `allyStep`, extras das Counter-Traps). Efeitos: `CardEffects.js` (originais, e encaminha o resto), `CardEffects2.js` (Magias Rápidas, extras das Counter-Traps e **alvos**), `CardReactives.js` (Reativas novas) e `CardEffects3.js` (Armadilhas de Casa novas e poderes dos Equipamentos: `onEquip`, `turnStart`, `afterMove`, `onCapture`, `shieldBreak`). Bot: `BotCards.js`. Ícone: `src/view/CardArt.js` (`ICONS`, pelo `theme.icon`) — sem ícone, aparece o emblema da família (`CardArtFamilies.js`) até haver imagem em `assets/items/`. Um teste em `tools/tests/`.
- **Alvos das cartas**: `YC.CardEffects2.targetSpec(m, equipa, def)` diz as casas que se podem escolher (1 casa, ou peça + destino/par em 2 passos) e é usado pelo motor (`validTarget`), pelo ecrã (modos `tgt1`/`tgt2` do `MatchInput`, `dropAction` do `MatchDrag`) e pelo bot. Carta nova com alvo → acrescenta-a lá.
- **Estados da expansão** (em `MatchStatus.js`): `m.setStatus(peça, 'silenced'|'noCap'|'untargetable', turnos)` (acabam em `tickStatuses` no início do turno), casas bloqueadas `m.blockSquare` (`state.blocks` → `pos.blocked`, que o `ChessRules` respeita), ações de carta extra/a menos (`state.actionMod`, máx. 4; a Balança deixa o adversário com 1), reciclagem do baralho vazio (uma vez, sem Lendárias), empurrões/trocas/peões novos/descartes/roubos. Um efeito fora da vez de quem joga nunca pode pôr o Rei de quem joga em xeque (`canRelocate`/`canSwap`/`spawnPawn` já o verificam). O 3D mostra-os em `Board3DStatus.js`.
- **Equipamentos que mudam lances** vão em `src/game/ChessRules.js` (`pieceMoves`/`attacks`) e precisam de teste em `tools/test-chess-rules.js`.
- **Nenhum efeito pode deixar o próprio Rei em xeque**: usa `match.removeOrFreeze`, `match.relocate`/`canRelocate` (em `MatchEffects.js`), que convertem em congelar quando seria ilegal.
- O ecrã ouve o `EventBus`; o motor emite eventos e espera pelas animações com `emitAsync`.
- **Tabuleiro 3D**: `Board3D` (WebGL) e `BoardView` (CSS, reserva quando o Three.js não carrega) têm a mesma interface: `sync(match, {viewer})`, `mark({...})`, `center(sq)`, `rect(sq)`, `el(id)`, `busy`, `fx`, `wrap`. O `MatchUI` escolhe um deles; o `MatchAnimator` usa as animações de `Anim3D`/`Anim3DCards` quando `board.is3D`. No 3D os efeitos (faíscas, estilhaços, fumo, texto néon "POW!") são partículas de `Particles3D` e vão para `board.fxLayer()` — **nunca para `layers.marks`**, que o `mark()` limpa a cada atualização. No CSS desenham-se na camada plana `.arena-fx`.
- **Fluidez (não quebrar)**: nunca acrescentes nem tires luzes da cena durante a partida (os clarões usam as 3 `flashLights` fixas do `Board3D`); mudar o número de luzes recompila todos os shaders e congela o jogo. Tipos de material novos nos efeitos precisam de entrar no `fxWarmUp()` (`Particles3D`), que os pré-compila com um quadro a sério e os mantém vivos (libertar o último material de um tipo apaga o shader). Mudar `transparent` num material já desenhado exige `material.needsUpdate = true`. O limite de segurança das animações (`MatchAnimator.guard`) cresce quando a velocidade é < 1; o GSAP usa `lagSmoothing(120, 33)` para um quadro lento não fazer as animações saltarem.
- **Arte gerada** (`assets/`, via `YC.asset(caminho)`, que o build embute): `assets/items/` (31 objetos + baú, lista em `ItemArtList.js`), `assets/fx/` (16 desenhos de efeito, lista em `src/view3d/FxArtList.js`; usados por `board.burst/scatter/decal`), `assets/arena/stadium.jpg` (fundo do estádio, em "cover"), `assets/cards/back.png` (verso das cartas, `YC.ART`), `assets/video/<icone>.mp4` (vídeos das Lendárias, lista em `ItemToken.VIDEO`; tocam no zoom, na Chain e ao passar o rato). Lendária sem vídeo: animação CSS `.hc-alive` (o `HoloCard` acrescenta-a sozinho). `assets/items/` tem agora os 120 objetos (folhas A a H).
- **Retratos das peças**: `YC.pieceHTML(tipo, cor)` devolve a "foto" 3D (`Portraits3D`, feita uma vez com o renderer do palco) ou o SVG antigo. Usa-o em vez de `YC.PieceArt.svg` na interface da partida. **Sprite sheets**: `Portraits3D.play(caixa, tipo, cor, 'loop'|'once'|'stop')` põe por cima da foto uma tira de 24 quadros (salto com pirueta) feita das próprias peças 3D, um quadro por tempo morto (`requestIdleCallback`; a pedida ao passar o rato tem prioridade). Usada no cartão da peça e na mascote. Se mudares as peças em `PieceMeshes`, as sprites mudam sozinhas.
- **Histórico** (`MatchLog.js`): o motor escreve cada linha com `match.say(texto, equipa, info)`; `info` (carta, uid, secret, sq, pieceId, move) só serve ao ecrã e não entra no estado. Cartas com `secret` (armadilhas e cartas viradas) aparecem de verso ao adversário até se revelarem, e a casa de uma armadilha escondida dele nunca é mostrada.
- **Cartas na mão**: o zoom é feito no próprio sítio (só `.hc-tilt` cresce; a área de clique fica igual) com uma etiqueta `.hc-tip` ao lado; fora da mão usa-se `YC.CardZoom` junto do elemento. O `.hc-tilt` da mão é desenhado já no tamanho ampliado (`--hw × --zmax`) e encolhido em repouso, para o texto sair nítido quando cresce — não voltes a ampliar com `scale` > 1. Arrastar está em `MatchDrag.js` e só traduz o largar numa ação normal (`EQUIP`, `SET_TRAP`, `SET_CARD`, `ACTIVATE`) — continua tudo a passar por `dispatch`. O fantasma segue o rato com uma mola num só ciclo `requestAnimationFrame` (`dragLoop`); o `pointermove` só guarda a posição. Nada de `filter`, tweens por evento ou animações CSS dentro do que se arrasta (era isso que fazia a carta tremer). Ao sair da mão, Equipamentos, Armadilhas de Casa e Magias Rápidas viram **objeto** (`YC.ItemToken`: imagem de `assets/items/` se estiver em `YC.ITEM_ART`, senão o SVG de `CardArt`); a mesma ficha voa para a peça ao equipar e cai na casa ao armar (`Anim3DCards`).
- **Bloom**: só passam o limiar (0,95) as cores com intensidade > 1 (`YC.T3.glow(hex, k)` com k ≥ ~1,6). As peças usam luzes baixas e exposição alta para ficarem claras sem brilhar; são de plástico envernizado (`T3.gloss`, com reflexos do `RoomEnvironment` criado por cada palco em `T3.setEnv`). O `flash()` do bloom e o `lightFlash()` estão propositadamente fracos: mais fortes lavam o ecrã todo de branco. Não subas as luzes nem baixes o limiar sem ver o resultado (as peças brancas viram fantasmas). As animações usam `YC.FX` (GSAP via CDN, com alternativa instantânea se o CDN falhar). Cada animação termina com `sync()` do tabuleiro, por isso o desenho nunca fica errado.
- **Estética (não quebrar)** — lê `docs/DIRECAO-DE-ARTE.md` antes de mexer no visual. Cores só pelos tokens de `styles/base.css` (nada de roxo/magenta néon nem `backdrop-filter` em painéis); 3 fontes (`--font-display` Titan One com `paint-order: stroke fill`, `--font-sans` Plus Jakarta Sans, `--font-num` Chakra Petch com `tabular-nums` só para números); brilho só na carta jogável, na Chain e na abertura de pacotes; **zero emojis** — ícones com `YC.Icon(nome)` (`src/ui/Icons.js`); botões `.btn` (primário amarelo), `.btn.secondary`, `.btn.danger`; painéis `.panel` + `.panel-head`; bandejas `.tray`. Animações de janelas sem elastic (`--ease-out-snappy`). "Reduzir movimento" é uma opção do jogo (`YC.reducedMotion()`, `html.reduce-motion`), não o `prefers-reduced-motion` do sistema. Entrada na partida passa pelo ecrã `YC.VS.run(info, mount)`.
- Ficheiros pequenos (até ~350 linhas). Se crescer, divide (ver `MatchEffects.js` e `PieceAnimations.js`, que acrescentam métodos a classes existentes).
- Texto da interface em **português de Portugal**. Comentários curtos, em português.

Mapa rápido:

| Pasta | O quê |
|---|---|
| `src/game/` | **Motor**: `ChessRules` (xadrez completo + equipamentos), `ChessNotation` (perft e notação), `CardsNew` + `Cards` (120 cartas, baralho inicial e baralhos do bot), `CardEffects` (condições/efeitos), `CardEffects2`/`CardReactives`/`CardEffects3` (expansão), `MatchStatus` (estados, bloqueios, cartas), `BotCards` (bot com as cartas novas), `ChainResolver` (Chain SS1–3, janelas de resposta), `MoveResolver` (lance com captura declarada, escudos, armadilhas, xeque), `MatchController` (turnos, ações, fim), `MatchEffects` (comprar, destruir, congelar, mover, escudos), `BotAI` (minimax + cartas), `Economy` (perfil, gacha, pity, criação, validação de baralhos). |
| `src/net/` | `LockstepSession` (protocolo), `FirebaseClient`, `ProfileStore` (coleção no localStorage + Firestore), `OnlineService` (salas/fila), `Ranking` (Elo), `OnlineGame` (cola com a UI). |
| `src/view3d/` | **Palco 3D (Three.js 0.160.0)**: `three-bridge.js` (único módulo ES: carrega o Three por importmap e expõe `window.THREE`), `Toon3D` (materiais cel-shading, contornos, texturas em canvas), `PieceMeshes` (peças chibi 3D de vinil feitas por código + pedestais), `Board3D` (câmara, bloom, rato, projeções), `Board3DScene` (arena, tabuleiro neon, zonas, pilhas), `Board3DSync` (estado do motor → 3D, marcações, armadilhas apontáveis), `Board3DStatus` (casas bloqueadas e etiquetas de estado), `Particles3D` (faíscas, estilhaços, fumo, rastos, texto néon, clarões, tremor de câmara, marcador de largada), `Portraits3D` (fotos e sprite sheets das peças para a interface), `Anim3D` (lances e capturas) e `Anim3DCards` (equipar, armadilhas, escudo, promoção). |
| `src/view/` | `PieceArt` (peças SVG com expressões, usadas no HUD e no tabuleiro CSS de reserva), `CardArt` (31 ícones) + `CardArtFamilies` (emblemas das 7 famílias), `FX` (efeitos GSAP), `BoardView` (tabuleiro CSS de reserva), `MatchAnimator` + `PieceAnimations` (animações dos eventos). |
| `src/ui/` | `HoloCard` (cartas 3D). Partida: `MatchUI` (layout da arena), `MatchHUD` (retratos, material, relógios, capturas), `MatchLog` (histórico com cartinhas e onde está cada coisa), `MatchChain` (Chain e fim), `MatchInput` (cliques e respostas), `MatchDrag` (arrastar cartas da mão; a carta vira objeto), `ItemToken` + `ItemArtList` (o objeto de cada carta e a lista das imagens geradas), `CardZoom` (zoom das cartas fora da mão), `PieceInspector` (cartão da peça ao passar o rato). Resto: `MatchRespond` (janela de resposta da Chain: ameaça marcada, 17 s, minimizar), `Icons` (ícones SVG de vinil), `Hub` (topo, doca, Arena, definições, transições), `ArenaRanking` (pódio e classificação), `PlayMenu` (o que o JOGAR abre: bot ou online), `VersusScreen` (ecrã VS), `GachaView` (loja e abertura do pacote), `DeckBuilderView`, `OnlineLobby` (online dentro do PlayMenu, só com conta Google), `UIKit`. |
| `src/audio/SoundEngine.js` | Efeitos sonoros sintetizados (Web Audio). |
| `styles/` | `base` (tokens do sistema de design, botões, painéis, barra de topo, doca, modais), `board` (tabuleiro CSS de reserva e peças), `cards`, `arena` (layout da partida), `match` (componentes da partida), `hub` (Arena, Loja, pacote, ecrã VS, Baralhos), `play` (pódio, classificação, menu JOGAR e Online). |

## 5. Firebase (projeto `yuchess`)

- Config pública em `src/net/firebase-config.js` (não é segredo). SDK 12.3.0 carregado do CDN da Google só quando se abre o separador Online (ou automaticamente, se o jogador já o usou).
- Coleções:
  - `users/{uid}` — coleção do jogador (ouro, poeira, inventário, baralhos, pity, estatísticas). Só o próprio lê/escreve. Sem login fica só no `localStorage`.
  - `players/{uid}` (perfil + rating, leitura pública) e `players/{uid}/history/{sala}` (caução da ranqueada).
  - `matches/{código}` (sala com `v: 2` e o `deck` de 22 de cada lugar; as regras aceitam 22 ou 12) e `matches/{código}/actions/{seq}` (ações e respostas da Chain).
- **Regras em `firestore.rules`**. Se mudares o formato de qualquer escrita no cliente, atualiza as regras e publica: `npx firebase-tools deploy --only firestore:rules` (ou cola na consola: Firestore → Regras).
- Ranking: Elo K=32, início 1000. No início da ranqueada desconta-se a derrota (caução); quem ganha recupera a caução + o ganho. As regras só aceitam vitória se as "claims" dos dois coincidirem ou houver abandono (adversário 150 s sem jogar na vez dele).
- Limitações conhecidas: no lockstep cada cliente tem o estado completo (incluindo a mão e as armadilhas do adversário) — um batoteiro com as ferramentas do navegador vê informação escondida. A economia (ouro, cartas) é calculada no cliente, por isso também dá para fazer batota nela; o rating continua protegido pelas regras. Resolver isto exige um servidor com autoridade (Cloud Functions).

## 6. Git e deploy

- `main` = produção (a Vercel publica cada push em `main` em <https://yuchess.vercel.app/>; outras branches geram pré-visualizações).
- Trabalha numa branch: `diego/<tema>` ou `pedro/<tema>`. Abre Pull Request para `main`.
- Commits pequenos, mensagem em português no imperativo: `Adiciona carta X`, `Corrige lance da Mola`.
- Não faças commit de `dist/` nem de chaves privadas (a config web do Firebase é pública e pode ficar).
