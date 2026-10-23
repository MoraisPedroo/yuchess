# AGENTS.md — instruções para agentes de código (Codex, Claude Code, Cursor…)

Projeto: **Chess-Oh! Uno-Head** — xadrez + Uno + Yu-Gi-Oh! num desenho animado de 1930, em JavaScript puro (sem build, sem dependências). Modo offline (IA e 2 jogadores no mesmo ecrã) e modo online com Firebase (salas privadas e ranqueada com Elo). Deploy estático na Vercel.

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
| `node tools/simulate.js 40` | 40 partidas IA vs IA sem ecrã; verifica invariantes (cartas, tabuleiro, Chain). Tem de dar `40/40`. |
| `node tools/simulate-online.js 10` | Testa o protocolo online (lockstep) com dois motores ligados por mensagens. Tem de dar `Sincronizadas: 10/10`. |
| `node tools/build.js` | Gera `dist/chess-oh.html` (ficheiro único). `dist/` não vai para o git. |
| `tools/gallery.html` | Galeria visual das peças e cartas. |

**Antes de cada commit**: as duas simulações passam e abriste o jogo no navegador para jogar pelo menos um turno do que mudaste.

## 4. Regras de arquitetura (não quebrar)

- **Scripts clássicos com o namespace global `YC`**, carregados por ordem no `index.html`. Ficheiro novo → acrescenta-o ao `index.html` e, se for do motor, também a `tools/simulate.js` e `tools/simulate-online.js`.
- **O motor não toca no DOM**: `src/core`, `src/data`, `src/engine`, `src/ai`, `src/net/LockstepSession.js` têm de correr em Node.
- **Todo o estado do jogo muda através de `GameController.dispatch(ação)`** (ou dentro da Chain que essa ação abre). O modo online replica exatamente estas ações nos dois clientes: mudar estado por fora causa dessincronização.
- **Aleatoriedade do jogo só via `game.rng`** (semente partilhada). Nunca `Math.random()` no motor; na IA e na parte visual não faz mal.
- **Cartas novas**: só em `src/data/CardDatabase.js`, usando primitivas (`op`). Primitiva nova → `src/engine/EffectInterpreter.js`.
- O ecrã ouve o `EventBus`; o motor emite eventos e espera pelas animações com `emitAsync`.
- Ficheiros pequenos (até ~350 linhas). Se crescer, divide.
- Texto da interface em **português de Portugal**. Comentários curtos, em português.

Mapa rápido:

| Pasta | O quê |
|---|---|
| `src/engine/` | Tabuleiro, combate, Uno, Chain, efeitos, `GameController` (fases e ações). |
| `src/ai/KingDiceAI.js` | IA heurística. |
| `src/net/` | Online: `LockstepSession` (protocolo), `FirebaseClient`, `OnlineService` (salas/fila), `Ranking` (Elo), `OnlineGame` (cola com a UI). |
| `src/view/` | Peças SVG, tabuleiro, animações, filtros/película. |
| `src/ui/` | Cartas, mão, painéis, ecrãs, salão online. |
| `styles/` | CSS (paleta 1930). |

## 5. Firebase (projeto `yuchess`)

- Config pública em `src/net/firebase-config.js` (não é segredo). SDK 12.3.0 carregado do CDN da Google só quando se abre o modo online.
- Coleções: `players/{uid}` (perfil + rating), `players/{uid}/history/{sala}` (caução da ranqueada), `matches/{código}` (sala), `matches/{código}/actions/{seq}` (ações).
- **Regras em `firestore.rules`**. Se mudares o formato de qualquer escrita no cliente, atualiza as regras e publica: `npx firebase-tools deploy --only firestore:rules` (ou cola na consola: Firestore → Regras).
- Ranking: Elo K=32, início 1000. No início da ranqueada desconta-se a derrota (caução); quem ganha recupera a caução + o ganho. As regras só aceitam vitória se as "claims" dos dois coincidirem ou houver abandono (adversário 150 s sem jogar na vez dele).
- Limitação conhecida: no lockstep cada cliente tem o estado completo (incluindo a mão do adversário). Um batoteiro com as ferramentas do navegador consegue ver informação escondida. Resolver isto exige um servidor com autoridade (Cloud Functions).

## 6. Git e deploy

- `main` = produção (a Vercel publica cada push em `main`; outras branches geram pré-visualizações).
- Trabalha numa branch: `diego/<tema>` ou `pedro/<tema>`. Abre Pull Request para `main`.
- Commits pequenos, mensagem em português no imperativo: `Adiciona carta X`, `Corrige recuo do Cavalo`.
- Não faças commit de `dist/` nem de chaves privadas (a config web do Firebase é pública e pode ficar).
