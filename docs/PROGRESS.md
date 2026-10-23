# Progresso — Chess-Oh! Uno-Head

> Ficheiro de passagem de testemunho entre o Pedro (Claude Code) e o Diego (Codex).
> **Lê-o no início de cada sessão e atualiza-o no fim** (ver `AGENTS.md`, secção 2).

## Estado atual (2026-10-23, fim do dia)

**No ar (main):** https://yuchess.vercel.app/ — versão do xadrez clássico + online.

**Ramo `pedro/duel-links` (por juntar a `main`):** o modo **Speed Duel** passa a ser o principal.
- Motor do duelo (`src/duel/`): 40 cartas, Sintonia Uno, tributos, posições, batalha Duel Links, Chain SS1–3, IA Rei Dado. Testado: 21 testes de cenário, centenas de duelos IA vs IA e pares online sincronizados.
- Interface: hub com abas (Menu, Loja, Montar Deck, Iniciar Duelo), loja gacha com animação de abertura, montador de 12 cartas, arena com zonas e LP a rolar, Cut-In para L/UR, recompensas em moedas. Testado no navegador.
- Online: as salas guardam o modo (`DUEL` ou `CHESS`) e o baralho de cada jogador; a ranqueada é Speed Duel. **Não testado com o Firebase real.**
- O xadrez clássico continua acessível no título e no hub.

## Configuração pendente (fazer uma vez, na consola)

- [ ] **Firebase → Firestore → Regras**: colar o `firestore.rules` **deste ramo** e publicar. Hoje as regras do projeto ainda estão abertas (leitura sem login funciona).
- [ ] **Firebase → Authentication → Sign-in method**: Google e Anónimo ativos (confirmar).
- [ ] **Firebase → Authentication → Settings → Authorized domains**: `yuchess.vercel.app` (confirmar).
- [ ] Testar com dois navegadores: sala privada Speed Duel, ranqueada, desistência, abandono.

## Em curso / a meio

- Juntar `pedro/duel-links` a `main` (a Vercel publica automaticamente). Falta a decisão do Pedro.

## Próximos passos (por prioridade)

1. Teste real online do Speed Duel + corrigir o que as regras recusarem.
2. Guardar coleção/moedas no Firestore (hoje só no navegador; não passa entre dispositivos e dá para fazer batota).
3. Revanche rápida no fim da partida online.
4. Mais variedade na IA (decks temáticos por dificuldade) e balanceamento das cartas fracas (Apito, Tonel, Troca de Chapéu quase nunca entram nos decks automáticos).
5. Limpeza de salas abandonadas em espera.
6. Autoridade no servidor (Cloud Functions) para esconder a mão e as cartas viradas no online.

## Problemas conhecidos

- Online: cada cliente tem o estado completo; quem abrir as ferramentas do navegador pode ver a mão e as cartas viradas do adversário.
- A coleção do gacha vive no `localStorage`: limpar dados do navegador apaga-a.
- O Artifact publicado no claude.ai não consegue usar o modo online (CDN do Firebase bloqueado lá).

## Registo de sessões

### 2026-10-23 (tarde) · Pedro + Claude Code · branch `pedro/duel-links`
- **Mudou**: novo modo Speed Duel (Duel Links + xadrez + Uno): `src/duel/*`, `src/ui/Duel*.js`, `CutIn.js`, `GachaShop.js`, `DeckBuilder.js`, `src/view/DuelArt.js`, `styles/dcards.css`, `styles/duel.css`. `index.html` reorganizado (`#shell` com `#topbar`, `#app` = xadrez, `#duel` = duelo). Online: `mode` + `deck` nas salas; `firestore.rules` atualizado.
- **Decisões**: o xadrez ficou como "Xadrez clássico" em vez de ser apagado; Fadiga de 500 LP quando o baralho acaba (12 cartas acabam depressa); Sintonia = +300 ATK na peça, ou +300 às tuas peças com feitiços sem custo, ou custo grátis nas counters; cartas Curinga em resposta escolhem a cor mais comum na mão; a Torre Cofre obriga a atacá-la; a ranqueada é só Speed Duel.
- **Como testar**: `node tools/test-duel-cards.js`, `node tools/simulate-duel.js 100`, e no navegador "INSERT COIN · SPEED DUEL".
- **Ficou por fazer**: juntar a `main`, publicar regras, teste online real.

### 2026-10-23 · Pedro + Claude Code · branch `main`
- **Mudou**: criado o jogo inteiro (motor, IA, arte, som, UI) e o modo online com Firebase: `src/net/*`, `src/ui/OnlineLobby.js`, `firestore.rules`, `firebase.json`, `vercel.json`, botões "Online", "Desistir" e "Reclamar vitória", tabuleiro virado para as Pretas.
- **Decisões**: lockstep determinístico em vez de servidor com autoridade (sem custos, sem Cloud Functions); rating Elo com caução para que fechar o separador a perder não salve o rating; relógio de 2 min por turno; abandono ao fim de 150 s sem jogar na vez própria.
- **Como testar**: `node tools/simulate.js 40`, `node tools/simulate-online.js 10`, e no navegador "ONLINE · RANQUEADA E SALAS".
- **Ficou por fazer**: configuração na consola (lista acima) e o primeiro teste real com duas pessoas.
