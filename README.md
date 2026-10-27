# Chess-Gi-Oh! Cartoon Edition

Xadrez a sério com cartas ao estilo Yu-Gi-Oh!. Jogas com as regras normais do xadrez — xeque, xeque-mate, roque, en passant, promoção, afogamento — e antes de cada lance podes usar até 2 cartas: equipar uma peça, esconder uma armadilha numa casa do tabuleiro ou virar uma armadilha/counter-trap na tua Zona para responder ao adversário. Tudo em estilo cartoon moderno: peças com olhos que piscam e mudam de expressão, cartas holográficas que inclinam com o rato e animações "juicy" (saltos com squash & stretch, POW!, escudos a estilhaçar, carimbo NEGADO!).

Jogo no ar: <https://yuchess.vercel.app/> (a partir da branch `main`).

> A trabalhar no projeto (pessoas ou agentes de código)? Lê primeiro **[`AGENTS.md`](AGENTS.md)** e **[`docs/PROGRESS.md`](docs/PROGRESS.md)**.

## Como se joga

- **Baralho de 12 cartas**, 3 na mão inicial (máximo 5; a carta comprada com a mão cheia é queimada). Compras 1 carta nos teus turnos 3, 5, 7… e 1 carta sempre que perdes um Cavalo, Bispo, Torre ou Dama. Baralho vazio não faz perder.
- **Turno**: até 2 ações de carta e depois 1 lance de xadrez.
- **Equipamentos** (Velocidade 1): ficam na peça (máx. 2). Ex.: Espada da Ganância (compra ao capturar), Mola Canguru (salta 1 peça), Cetro (Peão anda como Rei + Escudo), Lança (captura a 2 casas sem sair do sítio).
- **Armadilhas de Casa** (máx. 3, filas 3–6, escondidas do adversário): disparam quando uma peça inimiga acaba o lance nessa casa. Se armares onde o adversário já tem uma, as duas destroem-se (CLANG!).
- **Armadilhas Reativas e Counter-Traps**: viram-se para baixo na Zona de Armadilhas (3 lugares) e só podem ser usadas a partir do turno seguinte. Reagem a captura, destruição ou xeque; as counter-traps anulam cartas do adversário.
- **Magias Rápidas** (Velocidade 2): Íman, Pulso EMP e Britadeira — usam-se da mão no teu turno ou viradas na Zona.
- **Chain**: cada carta ativada pode levar resposta; Velocidade(nova) ≥ max(2, Velocidade(topo)); resolve do último elo para o primeiro; máximo 8 elos; 12 s para responder.
- **Escudo**: a próxima captura contra a peça falha (o escudo estilhaça e o atacante volta para trás).
- **O Rei** nunca é congelado nem destruído por cartas, e nenhum efeito pode deixar o próprio Rei em xeque (nesse caso a peça fica congelada em vez de destruída/movida).

## Modos

- **Contra o bot**: Fácil, Médio ou Difícil (minimax de 1 a 3 lances com quiescência + heurísticas de cartas), com relógio de 5 min, 10 min ou sem limite.
- **Arena 3D** (Three.js + bloom): tabuleiro de vidro com moldura néon e círculo mágico, peças chibi 3D em pedestais holográficos, Zonas de Armadilhas e baralho/cemitério na mesa, peças de vinil envernizado com detalhes (bandeira na Torre, capa no Rei, pérolas na Dama…), animações com antecipação, rastos, faíscas e estilhaços, HUD com retratos 3D, MATERIAL, relógios e peças capturadas, cartas que crescem no próprio sítio ao passar o rato (estilo Hearthstone), arrastar cartas para a peça/casa/Zona (a carta vira o objeto dela — a bomba, as botas… — com uma etiqueta a dizer onde a largar) e detalhes das armadilhas ao passar o rato. Sem WebGL usa-se um tabuleiro em CSS.
- **Online** (Firebase): ranqueada com rating Elo (conta Google) ou sala privada por código/link (também como convidado). 2 minutos por turno.
- **Loja**: pacotinho de 5 cartas por 100 de ouro (cartas 1–4: 65/25/8/2 %; carta 5: Rara 78 %, Épica 18 %, Lendária 4 %), Épica garantida a cada 5 pacotes, Lendária com pity suave a partir do 15.º e garantida no 20.º. Cópias a mais viram Poeira Estelar.
- **Baralhos**: coleção + baralho de 12 (máx. 2 cópias, 1 se Lendária, máx. 2 Lendárias), auto-completar e oficina para criar cartas com Poeira Estelar.
- **Recompensas**: vitória +120 ouro e +25 poeira; empate +60/+10; derrota +40 ouro se jogaste pelo menos 5 turnos. Começas com 500 de ouro, 200 de poeira e um baralho inicial.

## Desenvolvimento

- `python tools/serve.py` e abre <http://localhost:8765> (o `index.html` também abre com duplo clique).
- Sem build e sem dependências instaladas: JavaScript em scripts clássicos com o namespace `YC`. GSAP 3.12.5, canvas-confetti 1.9.3 e Three.js 0.160.0 (por importmap, carregado pelo único módulo `src/view3d/three-bridge.js`) vêm do CDN; se falharem, o jogo continua com o tabuleiro CSS e sem essas animações.

| Comando | O que faz |
|---|---|
| `node tools/test-chess-rules.js` | Regras de xadrez com contagens *perft* de referência + equipamentos. |
| `node tools/test-cards.js` | 31 testes de cenário das cartas e regras especiais. |
| `node tools/simulate.js 30` | Bot contra bot em 30 partidas sem ecrã, com verificação de invariantes. |
| `node tools/simulate-online.js 8` | Dois motores ligados só por mensagens têm de acabar idênticos (lockstep). |
| `node tools/build.js` | Gera `dist/chess-gi-oh.html` (ficheiro único). |
| `tools/gallery.html` | Galeria das peças e das 31 cartas. |

## Pôr o online a funcionar

1. **Firebase → Authentication → «Começar» (Get started)** (sem isto o login dá `configuration-not-found`) e depois **Sign-in method**: ativa **Google** e **Anónimo**.
2. **Firebase → Authentication → Settings → Authorized domains**: `yuchess.vercel.app` (e o domínio das pré-visualizações, se quiseres testar nelas).
3. **Firebase → Firestore → Regras**: cola `firestore.rules` e publica (ou `npx firebase-tools deploy --only firestore:rules`). **Obrigatório**: as regras novas acrescentam `users/{uid}` (coleção) e o baralho nas salas.
4. Abre o site em dois navegadores e testa uma sala privada e uma ranqueada.

## Onde me afastei do relatório

- **Sem Next.js/React nem chess.js**: o projeto continua em JavaScript puro (sem build) para o Diego e o Codex trabalharem sem ferramentas extra; o motor de xadrez é próprio e validado com contagens *perft* conhecidas.
- **Armadilhas Reativas e Counter-Traps viram-se na Zona** (3 lugares, como no Yu-Gi-Oh!) e só respondem a partir do turno seguinte ("enjoo"). Magias Rápidas usam-se da mão no próprio turno.
- **12 s para responder** em vez de 8 s (8 s não chegava para ler a carta).
- **A Mola Canguru não dá xeque por salto** (senão dava xeques impossíveis de tapar: xeque-mate ao 2.º lance).
- **Capturar uma peça com Escudo não tira do xeque** (o atacante volta para trás), por isso não conta como lance para sair de xeque.
- **Peças congeladas**: se só peças congeladas tinham lances, passa-se a vez (não é afogamento).
- **Armadilhas de Casa só nas filas 3 a 6**, disparam só quando a peça acaba o lance numa casa vazia; uma armadilha tapada por peça própria fica inerte e é esmagada se essa peça for capturada.
- **Limite de 300 turnos** (empate) para nenhuma partida ficar infinita.
- **Economia no cliente**: ouro, cartas e pity são calculados no navegador e guardados no Firestore (`users/{uid}`); dá para fazer batota na coleção, mas o rating continua protegido pelas regras.
- **Online por lockstep**: os dois clientes correm o mesmo motor e trocam só ações; quem abrir as ferramentas do navegador consegue ver a mão e as armadilhas do adversário.
