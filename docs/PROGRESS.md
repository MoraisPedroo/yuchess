# Progresso — Chess-Oh! Uno-Head

> Ficheiro de passagem de testemunho entre o Pedro (Claude Code) e o Diego (Codex).
> **Lê-o no início de cada sessão e atualiza-o no fim** (ver `AGENTS.md`, secção 2).

## Estado atual (2026-10-23)

**Funciona e está testado**
- Motor completo: tabuleiro 8×8 próprio, combate RPG com recuo, economia Uno, Chain LIFO com Spell Speeds 1/2/3, armadilhas ocultas, 28 cartas + 40 cartas Uno básicas.
- IA King Dice (1 jogador) e modo 2 jogadores no mesmo ecrã com cortina.
- Arte procedural (peças SVG rubber hose, linha fervente, película WebGL) e som sintetizado (Web Audio).
- Protocolo online lockstep (`src/net/LockstepSession.js`): 38 pares de partidas simuladas ficaram idênticas nos dois lados, com e sem latência, incluindo desistências.
- Interface online testada sem Firebase (dois motores ligados por mensagens no navegador): perspetiva das Pretas com tabuleiro virado, cartas, alvos, Chain.

**Escrito mas ainda não testado com o Firebase real**
- Login (Google e convidado), perfil, salas privadas por código/link, fila ranqueada, classificação, caução de rating, abandono, desistência.
- `firestore.rules` — revistas à mão, não passaram pelo emulador (precisa de Java 11+).

## Configuração pendente (fazer uma vez, na consola)

- [ ] **Firebase → Authentication → Sign-in method**: ativar **Google** e **Anónimo**.
- [ ] **Firebase → Firestore → Regras**: colar `firestore.rules` e publicar. Hoje a base de dados aceita leituras sem login, o que indica regras de teste (abertas a qualquer pessoa).
- [ ] **Vercel**: importar o repositório GitHub `MoraisPedroo/yuchess` (preset "Other", sem build, pasta raiz).
- [ ] **Firebase → Authentication → Settings → Authorized domains**: acrescentar o domínio da Vercel (ex.: `yuchess.vercel.app`).
- [ ] Testar com dois navegadores: sala privada, ranqueada, desistência, abandono (fechar um separador e esperar 2 min 30 s).

## Em curso / a meio

- Nada a meio. O próximo passo é o teste real com o Firebase depois da configuração acima.

## Próximos passos (por prioridade)

1. Teste real online + corrigir o que as regras recusarem (as mensagens de erro aparecem no salão e na consola).
2. Revanche rápida no fim da partida online (mesma sala, cores trocadas).
3. Limpeza de salas abandonadas em espera (hoje ficam no Firestore; são ignoradas ao fim de 30 s).
4. Autoridade no servidor (Cloud Functions) para esconder a mão e as armadilhas do adversário no online.
5. Ecrã de histórico de partidas ranqueadas no perfil.
6. Versão para telemóvel mais confortável (hoje funciona, mas as casas ficam pequenas).

## Problemas conhecidos

- Online: cada cliente tem o estado completo; quem abrir as ferramentas do navegador pode ver a mão e as armadilhas do adversário.
- Se fechares o separador antes de o adversário confirmar o resultado, o rating fica "pendente" e é acertado da próxima vez que abrires o salão online.
- O Artifact publicado no claude.ai não consegue usar o modo online (o CDN do Firebase é bloqueado lá); mostra uma mensagem de erro no salão.

## Registo de sessões

### 2026-10-23 · Pedro + Claude Code · branch `main`
- **Mudou**: criado o jogo inteiro (motor, IA, arte, som, UI) e o modo online com Firebase: `src/net/*`, `src/ui/OnlineLobby.js`, `firestore.rules`, `firebase.json`, `vercel.json`, botões "Online", "Desistir" e "Reclamar vitória", tabuleiro virado para as Pretas.
- **Decisões**: lockstep determinístico em vez de servidor com autoridade (sem custos, sem Cloud Functions); rating Elo com caução para que fechar o separador a perder não salve o rating; relógio de 2 min por turno; abandono ao fim de 150 s sem jogar na vez própria.
- **Como testar**: `node tools/simulate.js 40`, `node tools/simulate-online.js 10`, e no navegador "ONLINE · RANQUEADA E SALAS".
- **Ficou por fazer**: configuração na consola (lista acima) e o primeiro teste real com duas pessoas.
