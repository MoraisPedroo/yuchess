# AGENTS.md — instruções para agentes de código (Codex, Claude Code, Cursor…)

Projeto: **Chess-Gi-Oh! Cartoon Edition** — xadrez a sério (regras normais) misturado com cartas ao estilo Yu-Gi-Oh!: equipamentos, armadilhas escondidas em casas do tabuleiro, armadilhas reativas (escudos), counter-traps e magias rápidas, com Chain de Velocidade 1/2/3. Estilo cartoon moderno (peças com olhos e expressões, cartas holográficas, animações GSAP). JavaScript puro, sem build. Deploy estático na Vercel; dados no Firebase.

- **Contra o bot** (Fácil/Médio/Difícil) e **online** (ranqueada com Elo ou sala privada por código).
- **Loja**: pacotinhos de 5 cartas (100 de ouro) com raridades Comum/Rara/Épica/Lendária, pity e Poeira Estelar.
- **Baralhos**: montar baralhos de 12, criar cartas com Poeira Estelar.

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
| `node tools/test-cards.js` | Um teste de cenário por carta/regra (31). Tem de dar `31/31 testes passaram.` |
| `node tools/simulate.js 30` | 30 partidas bot vs bot sem ecrã; verifica invariantes (24 cartas sempre, 1 Rei de cada cor, Chain fechada, quem jogou não fica em xeque). Tem de dar `30/30` e `Cartas nunca ativadas: nenhuma`. |
| `node tools/simulate-online.js 8` | Protocolo online (lockstep) com dois motores ligados por mensagens, com latência e desistências. Tem de dar `Sincronizadas: 8/8`. |
| `node tools/build.js` | Gera `dist/chess-gi-oh.html` (ficheiro único). `dist/` não vai para o git. |
| `tools/gallery.html` | Galeria das peças (todos os estados) e das 31 cartas. |

**Antes de cada commit**: os 4 comandos de teste passam e abriste o jogo no navegador para jogar pelo menos um turno do que mudaste.

## 4. Regras de arquitetura (não quebrar)

- **Scripts clássicos com o namespace global `YC`**, carregados por ordem no `index.html`. Ficheiro novo → acrescenta-o ao `index.html`; se for do motor, também a `tools/load-engine.js` (é a lista que os testes usam).
- **O motor não toca no DOM**: `src/core`, `src/game`, `src/net/LockstepSession.js` têm de correr em Node.
- **Todo o estado da partida muda através de `Match.dispatch(ação)`** (ou dentro da Chain que essa ação abre). Ações: `MOVE`, `EQUIP`, `SET_TRAP`, `SET_CARD`, `ACTIVATE`, `PASS`, `AUTO_MOVE`. O online replica exatamente estas ações e as respostas da Chain nos dois clientes: mudar estado por fora causa dessincronização.
- **Aleatoriedade da partida só via `match.rng`** (semente partilhada). Nunca `Math.random()` no motor; na IA, na loja e na parte visual não faz mal.
- **Cartas novas**: dados em `src/game/Cards.js` (lista `RAW`); condições e efeito em `src/game/CardEffects.js` (`canRespondToEvent`, `canRespondToLink`, `canActivate`, `resolve*`); ícone em `src/view/CardArt.js` (`ICONS`, pelo `theme.icon`); um teste em `tools/test-cards.js`.
- **Equipamentos que mudam lances** vão em `src/game/ChessRules.js` (`pieceMoves`/`attacks`) e precisam de teste em `tools/test-chess-rules.js`.
- **Nenhum efeito pode deixar o próprio Rei em xeque**: usa `match.removeOrFreeze`, `match.relocate`/`canRelocate` (em `MatchEffects.js`), que convertem em congelar quando seria ilegal.
- O ecrã ouve o `EventBus`; o motor emite eventos e espera pelas animações com `emitAsync`.
- O tabuleiro é um plano 3D (CSS `perspective` + `rotateX(var(--tilt))`) com as peças em pé (`.stand` roda ao contrário). Nada de `filter`, `opacity` ou `overflow: hidden` nos elementos entre `.plane` e `.piece` (achatam o 3D). Os efeitos desenham-se na camada plana `.arena-fx`, na posição projetada das casas (`BoardView.center`). As animações usam `YC.FX` (GSAP via CDN, com alternativa instantânea se o CDN falhar). Cada animação termina com `sync()` do tabuleiro, por isso o desenho nunca fica errado.
- Ficheiros pequenos (até ~350 linhas). Se crescer, divide (ver `MatchEffects.js` e `PieceAnimations.js`, que acrescentam métodos a classes existentes).
- Texto da interface em **português de Portugal**. Comentários curtos, em português.

Mapa rápido:

| Pasta | O quê |
|---|---|
| `src/game/` | **Motor**: `ChessRules` (xadrez completo + equipamentos), `Cards` (31 cartas), `CardEffects` (condições/efeitos), `ChainResolver` (Chain SS1–3, janelas de resposta), `MoveResolver` (lance com captura declarada, escudos, armadilhas, xeque), `MatchController` (turnos, ações, fim), `MatchEffects` (comprar, destruir, congelar, mover, escudos), `BotAI` (minimax + cartas), `Economy` (perfil, gacha, pity, criação, validação de baralhos). |
| `src/net/` | `LockstepSession` (protocolo), `FirebaseClient`, `ProfileStore` (coleção no localStorage + Firestore), `OnlineService` (salas/fila), `Ranking` (Elo), `OnlineGame` (cola com a UI). |
| `src/view/` | `PieceArt` (peças SVG com expressões), `CardArt` (31 ícones), `FX` (efeitos GSAP), `BoardView` (tabuleiro), `MatchAnimator` + `PieceAnimations` (animações dos eventos). |
| `src/ui/` | `HoloCard` (cartas 3D). Partida: `MatchUI` (layout da arena), `MatchHUD` (retratos, material, relógios, capturas, histórico), `MatchChain` (Chain e fim), `MatchInput` (cliques e respostas), `CardZoom` (zoom das cartas), `PieceInspector` (cartão da peça ao passar o rato). Resto: `Hub` (topo + Arena), `GachaView` (loja), `DeckBuilderView`, `OnlineLobby`, `UIKit`. |
| `src/audio/SoundEngine.js` | Efeitos sonoros sintetizados (Web Audio). |
| `styles/` | `base` (paleta e botões), `board` (tabuleiro 3D neon e peças), `cards`, `arena` (layout da partida), `match` (componentes da partida), `hub`. |

## 5. Firebase (projeto `yuchess`)

- Config pública em `src/net/firebase-config.js` (não é segredo). SDK 12.3.0 carregado do CDN da Google só quando se abre o separador Online (ou automaticamente, se o jogador já o usou).
- Coleções:
  - `users/{uid}` — coleção do jogador (ouro, poeira, inventário, baralhos, pity, estatísticas). Só o próprio lê/escreve. Sem login fica só no `localStorage`.
  - `players/{uid}` (perfil + rating, leitura pública) e `players/{uid}/history/{sala}` (caução da ranqueada).
  - `matches/{código}` (sala com `v: 2` e o `deck` de 12 de cada lugar) e `matches/{código}/actions/{seq}` (ações e respostas da Chain).
- **Regras em `firestore.rules`**. Se mudares o formato de qualquer escrita no cliente, atualiza as regras e publica: `npx firebase-tools deploy --only firestore:rules` (ou cola na consola: Firestore → Regras).
- Ranking: Elo K=32, início 1000. No início da ranqueada desconta-se a derrota (caução); quem ganha recupera a caução + o ganho. As regras só aceitam vitória se as "claims" dos dois coincidirem ou houver abandono (adversário 150 s sem jogar na vez dele).
- Limitações conhecidas: no lockstep cada cliente tem o estado completo (incluindo a mão e as armadilhas do adversário) — um batoteiro com as ferramentas do navegador vê informação escondida. A economia (ouro, cartas) é calculada no cliente, por isso também dá para fazer batota nela; o rating continua protegido pelas regras. Resolver isto exige um servidor com autoridade (Cloud Functions).

## 6. Git e deploy

- `main` = produção (a Vercel publica cada push em `main` em <https://yuchess.vercel.app/>; outras branches geram pré-visualizações).
- Trabalha numa branch: `diego/<tema>` ou `pedro/<tema>`. Abre Pull Request para `main`.
- Commits pequenos, mensagem em português no imperativo: `Adiciona carta X`, `Corrige lance da Mola`.
- Não faças commit de `dist/` nem de chaves privadas (a config web do Firebase é pública e pode ficar).
