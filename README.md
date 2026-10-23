# Chess-Oh! Uno-Head

Speed Duel estilo Duel Links com peças de xadrez e pilha Uno, num desenho animado de 1930 feito só com código: peças em SVG "rubber hose", linha fervente a 12 fps, película WebGL e jazz swing sintetizado ao vivo. Sem imagens, sem ficheiros de som, sem dependências. Jogo no ar: <https://yuchess.vercel.app/>.

## Speed Duel (modo principal)

- **Arena:** 4000 LP, 3 Zonas de Peças e 3 de Suporte por lado, baralho de **12 cartas**, 4 na mão e 1 por turno.
- **Pilha Uno:** cada carta jogada muda a cor/símbolo. Jogar uma carta que combine dá **Sintonia** (+300 ATK, ou custo grátis nas counters).
- **Invocação:** 1 por turno; Nível 5–6 pede 1 Tributo, Nível 7+ pede 2. Posição de Ataque ou Defesa.
- **Batalha:** ATK vs ATK (a mais fraca cai, o dono perde a diferença), ATK vs DEF (destrói sem dano, ou BOING! e o atacante perde DEF − ATK), ataque direto sem peças.
- **Chain:** SS1 inicia, SS2 responde, SS3 só aceita SS3; resolve do último elo para o primeiro.
- **40 cartas** em 4 raridades: Normal (máx. 3), Épico (2), Lendário (2), Ultra-Raro (1). Lendárias e Ultra-Raras disparam um **Cut-In** do duelista.
- **Loja de pacotinhos:** 600 Moedas de Tinta iniciais, 100 por pacote de 3 cartas (N 60% · E 25% · L 11% · UR 4%), pity de 1 UR a cada 10 pacotes. Vitória +150, derrota +40.
- **Montar Deck:** coleção à esquerda, deck de 12 à direita, "Auto-Completar Deck Mais Forte"; tudo guardado no navegador.
- **Rei Dado (IA):** o deck dele fica mais forte à medida que ganhas.

## Jogar

- **Ficheiro único:** abre `dist/chess-oh.html` no navegador (funciona com duplo clique, sem servidor).
- **Desenvolvimento:** `python tools/serve.py` e abre <http://localhost:8765>. O `index.html` também abre diretamente com duplo clique (os scripts são clássicos, não módulos).
- **Modos:** 1 jogador contra o *King Dice* (IA), 2 jogadores no mesmo ecrã (com cortina entre turnos) e **online** com Firebase: salas privadas por código/link e partidas **ranqueadas** com rating Elo e classificação.
- **Online em produção:** deploy estático na Vercel a partir deste repositório. Configuração necessária na secção "Pôr o online a funcionar".

> A trabalhar no projeto (pessoas ou agentes de código)? Lê primeiro **[`AGENTS.md`](AGENTS.md)** e **[`docs/PROGRESS.md`](docs/PROGRESS.md)**.

## Pôr o online a funcionar

1. **Firebase → Authentication → Sign-in method**: ativa **Google** e **Anónimo**.
2. **Firebase → Firestore → Regras**: cola o conteúdo de `firestore.rules` e publica (ou `npx firebase-tools deploy --only firestore:rules`).
3. **Vercel**: *Add New → Project → Import* `MoraisPedroo/yuchess`. Preset "Other", sem comando de build, pasta raiz. Cada push em `main` publica.
4. **Firebase → Authentication → Settings → Authorized domains**: acrescenta o domínio que a Vercel te deu (ex.: `yuchess.vercel.app`).
5. Abre o site em dois navegadores e testa uma sala privada e uma ranqueada.

## Ferramentas

| Comando | O que faz |
|---|---|
| `node tools/simulate.js 80` | Põe a IA contra si própria em 80 partidas sem ecrã e verifica invariantes (cartas não se perdem nem duplicam, tabuleiro consistente, Chain fechada no fim do turno). |
| `node tools/simulate-online.js 10` | Testa o protocolo online: dois motores com a mesma semente, ligados só por mensagens, têm de acabar com o estado idêntico. |
| `node tools/simulate-duel.js 100` | 100 duelos IA vs IA no Speed Duel + pares online sincronizados. |
| `node tools/test-duel-cards.js` | Testes de cenário dos efeitos das cartas do duelo. |
| `node tools/build.js` | Gera `dist/chess-oh.html` (documento completo) e `dist/artifact.html` (fragmento para publicar como Artifact). |
| `tools/gallery.html` | Galeria das 12 peças e de todas as cartas, para rever a arte. |

## Arquitetura

Todos os módulos falam só pelo `EventBus`. O motor (`src/engine`, `src/ai`, `src/data`) não toca no DOM, por isso corre em Node para o simulador.

| Ficheiro | Responsabilidade |
|---|---|
| `src/core/EventBus.js` | Pub/Sub síncrono e assíncrono (`emitAsync` espera pelas animações) + PRNG `mulberry32`. |
| `src/data/CardDatabase.js` | Stats das peças e 28 cartas declarativas (primitivas `op`) + 40 cartas Uno básicas → baralho de 75. |
| `src/engine/BoardEngine.js` | Matriz 8×8 própria (sem chess.js), raycasting casa a casa, armadilhas ocultas, roque, troca, promoção. |
| `src/engine/CombatRPG.js` | Escudo antes do HP, contra-ataque de 50%, recuo elástico, perfuração, Falange. |
| `src/engine/UnoEconomy.js` | Baralho, mãos, pilha central, predicado de correspondência e conversão carta → permissão. |
| `src/engine/ChainResolver.js` | Pilha LIFO com Spell Speeds 1/2/3, Set Sickness, custos no anúncio, bloqueio na resolução, máximo de 8 elos. |
| `src/engine/EffectInterpreter.js` | Executa as primitivas das cartas (dano, buffs, negação, recuo, explosão, ressurreição…). |
| `src/engine/GameController.js` | Fases do turno, ações (`dispatch`), execução de movimentos com interceção por armadilhas. |
| `src/ai/KingDiceAI.js` | IA heurística: escolhe a carta pela melhor jogada que desbloqueia, planta armadilhas nas rotas inimigas, responde na Chain. Não vê armadilhas nem mão do adversário. |
| `src/view/PieceFactory.js` | Gerador procedural das peças (olhos pie-cut, braços Bézier, luvas) e animador "on twos". |
| `src/view/CupheadSVGRenderer.js` | Tabuleiro, peças e animações (salto com squash & stretch, investida, BOING!, explosões). |
| `src/view/VFXPostProcessor.js` | Filtros SVG, linha fervente, shader de película/CRT, screen shake, flash de Parry. |
| `src/audio/VintageAudioSynth.js` | Gramofone, swing a 124 BPM e todos os efeitos sonoros com Web Audio. |
| `src/ui/*` | Cartas, mão em leque, painéis, janela da Chain, ecrãs de título e K.O., salão online. |
| `src/net/LockstepSession.js` | Multijogador determinístico: os dois clientes correm o mesmo motor e trocam só as ações numeradas, com hash do estado para detetar divergências. |
| `src/net/FirebaseClient.js` · `OnlineService.js` | Carrega o Firebase a pedido; salas, fila ranqueada, ações no Firestore, desistência e abandono. |
| `src/net/Ranking.js` · `OnlineGame.js` | Elo com caução anti-abandono; ligação de uma partida online à interface (relógio de turno, rating no fim). |
| `firestore.rules` | Regras de segurança: validam cada escrita de sala, ação e rating. |

## Onde me afastei do documento de design

- **Sem GSAP:** as animações usam a Web Animations API nativa, para não haver dependências externas.
- **Armadilhas espaciais:** podem ser postas em qualquer casa vazia exceto nas duas filas iniciais do adversário (filas 1–6 para as Brancas). Se puseres uma onde já há uma armadilha inimiga escondida, as duas destroem-se (CLANG!). Assim nunca se revela onde estão as armadilhas do outro.
- **Compra no início do turno:** compra-se 1 carta se a mão tiver menos de 5 (o documento dizia 4). Com 4 havia demasiadas compras de emergência.
- **+2:** compras 2 e o oponente perde 1 carta ao acaso (a "perda de 1 ponto de ação" não tinha sistema de pontos onde encaixar).
- **Escudo:** é uma reserva que se gasta com os golpes. Os valores 1–3 dão escudo temporário que dura até ao teu turno seguinte; a perfuração faz o escudo bloquear só metade.
- **Torre (Muralha de Ferro):** imune a efeitos de recuo de cartas (a Mola). O recuo de combate continua a aplicar-se, porque duas peças não podem ficar na mesma casa.
- **Morte Súbita a partir do turno 60:** o Rei de quem joga perde HP crescente a cada turno, para as partidas terminarem. Sem ela, quase metade das partidas simuladas arrastava-se.
- **Multijogador online:** usa Firebase (Firestore) em vez de PeerJS/PartyKit, com o mesmo princípio de lockstep por ações. Limitação: cada cliente tem o estado completo, por isso quem abrir as ferramentas do navegador pode ver a mão do adversário.
