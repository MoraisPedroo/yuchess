# Progresso — Chess-Gi-Oh! Cartoon Edition

> Ficheiro de passagem de testemunho entre o Pedro (Claude Code) e o Diego (Codex).
> **Lê-o no início de cada sessão e atualiza-o no fim** (ver `AGENTS.md`, secção 2).

## Estado atual (2026-10-26)

**No ar (`main`, juntada a 2026-10-26):** <https://yuchess.vercel.app/>. O jogo foi refeito do zero seguindo o relatório "Chess-Gi-Oh! Cartoon Edition" do Pedro. Substitui o protótipo "Chess-Oh! Uno-Head" (xadrez + Uno, estilo 1930) e o modo "Speed Duel" (só cartas) — os dois continuam no histórico do git (`main` cb44011 e branch `pedro/duel-links`).

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

- [ ] **Firebase → Firestore → Regras**: colar o `firestore.rules` **desta branch** e publicar. Hoje as regras do projeto ainda estão abertas (leitura sem login funciona) e as novas são necessárias para `users/{uid}` e para as salas com baralho.
- [ ] **Firebase → Authentication → Sign-in method**: Google e Anónimo ativos (confirmar).
- [ ] **Firebase → Authentication → Settings → Authorized domains**: `yuchess.vercel.app` (confirmar).
- [ ] Testar com dois navegadores: sala privada, ranqueada, desistência, abandono, e ver se a coleção passa entre dispositivos com a mesma conta Google.

## Em curso / a meio

- Nada a meio no código. O Pedro está a testar a versão publicada e vai enviar os erros que encontrar.
- Falta publicar o `firestore.rules` no Firebase (ver "Configuração pendente") para o online funcionar.

## Próximos passos (por prioridade)

1. Teste real online + corrigir o que as regras recusarem.
2. Balanceamento: a Lança e a Mola são fortes; ver taxas de vitória por carta com `tools/simulate.js` (acrescentar estatística por carta).
3. Tutorial interativo curto (primeira partida guiada: equipar, armadilha, resposta).
4. Escolher alvos à mão nas cartas automáticas (Gerador de Bolhas, Bomba de Fumo, Boneco de Testes) — hoje o motor escolhe o melhor alvo.
5. Revanche rápida no online e histórico de partidas no perfil.
6. Autoridade no servidor (Cloud Functions) para esconder mão/armadilhas e proteger a economia.

## Problemas conhecidos

- Online: cada cliente tem o estado completo; quem abrir as ferramentas do navegador vê a mão e as armadilhas do adversário.
- A economia é calculada no cliente (dá para fazer batota na coleção); o rating está protegido pelas regras.
- Num separador escondido o navegador quase para as animações (requestAnimationFrame); o motor espera no máximo 4 s por animação, por isso o jogo nunca bloqueia, só fica lento.

## Registo de sessões

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
