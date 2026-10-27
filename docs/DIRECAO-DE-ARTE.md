# Direção de arte — "Caixa de Brinquedos de Vinil Colecionável"

Resumo técnico do relatório do Gemini Deep Research (27/10/2026, conversa "Direção de Arte Chess-Gi-Oh!" na conta
do Pedro; prompt em `docs/DEEP-RESEARCH-PROMPT.md`). É a referência para qualquer mudança visual: menus e partida são
**o mesmo jogo**, feito de vinil brilhante (peças, ícones), plástico ABS mate escuro (painéis, tabuleiro) e cartão
laminado com foil (cartas). Nada de roxo néon, vidro desfocado, emojis nem brilho em tudo.

## Regras de ouro (checklist anti-"cara de IA")
1. Fundos só em ardósia (`--bg-canvas`, `--surface-1/2/3`). Proibido: `#120B26 #2D1B4E #7B42F6 #F538A0 #00E5FF #FF4F9A` em fundos e contornos.
2. 90 % mate: painéis, barras, pílulas, modais e casas do tabuleiro **sem glow**. Sombras escuras duras (`0 6px 0 #090C10`) + bisel claro em cima (`inset 0 2px 0 rgba(255,255,255,.22)`) + contorno `#0F141C` 2,5–3 px. Glow só em: carta jogável na mão (`0 0 12px rgba(46,196,182,.75)`), Chain a resolver, abertura de pacote e foil de Épica/Lendária.
3. Sem `backdrop-filter` em painéis (só no fundo de modais, e só no desktop).
4. 3 fontes: **Titan One** (títulos, botões grandes, banners; contorno `paint-order: stroke fill`, `-webkit-text-stroke` + sombra dura), **Plus Jakarta Sans** 500–800 (interface e cartas), **Chakra Petch** 600–700 com `tabular-nums` (só números: relógio, ouro, poeira, Elo, coordenadas, VEL).
5. Zero emojis: ícones SVG (`YC.Icon`) 24×24, contorno `#0F141C` 2,5 px, sombra inferior 20 % mais escura, reflexo em pílula branco no canto superior esquerdo.
6. Texto escuro (`#0F141C`) sobre amarelo/laranja/âmbar; texto claro (`#F8FAFC`) no resto.
7. Arena é um ecrã de jogo, não uma landing page: sem slogan; botão JOGAR dominante, 1 clique para jogar.
8. Raridades e tipos com dupla codificação (forma/ícone/número de insígnias), não só cor.
9. Motion pela massa: janelas e painéis travam a seco (`--ease-out-snappy`), sem elastic; overshoot só em coisas leves (cartas, insígnias, botões a soltar, banners); hit-stop 50–70 ms nos impactos.
10. "Reduzir movimento" é uma opção do jogo (Definições → `YC.reducedMotion()`, classe `html.reduce-motion`): sem tremor nem tilt contínuo, fades de 120 ms. Não seguir o `prefers-reduced-motion` do sistema: no Windows com as animações desligadas o Chrome pede "reduce" e o jogo perdia todas as transições.

## Tokens (styles/base.css `:root`)
| Papel | Token | Hex |
|---|---|---|
| Fundo | `--bg-canvas` | `#0F141C` |
| Bandeja rebaixada | `--surface-1` | `#181F2C` |
| Painel | `--surface-2` | `#232D3F` |
| Hover / cabeçalho | `--surface-3` | `#334158` |
| Contorno | `--border-ink` | `#0F141C` |
| Texto / secundário / inverso | `--text-main` `--text-muted` `--text-inverse` | `#F8FAFC` `#94A3B8` `#0F141C` |
| Primária (JOGAR) | `--color-primary` / hover / aba | `#FFB703` / `#FFD166` / `#B87D00` |
| Acento (seleção, poeira, foco) | `--color-accent` / aba | `#00B4D8` / `#007796` |
| Sucesso (lance legal) | `--color-success` / aba | `#2EC4B6` / `#1B8A7E` |
| Perigo (xeque, captura) | `--color-danger` / hover / aba | `#D90429` / `#EF233C` / `#8D021F` |
| Aviso | `--color-warning` | `#FB8500` |
| Brancas / Pretas | `--team-white` `--team-black` | `#F1F5F9` `#1E293B` |
| Casas | `--board-tile-light` `--board-tile-dark` `--board-frame` | `#E2E8F0` `#475569` `#1E2636` |
| Raridades | comum, rara, épica, lendária | `#64748B` `#0284C7` `#9333EA` `#FFB703` |
| Tipos (cor / aba) | Equip., Arm. de Casa, Reativa, Counter, Magia Rápida | `#2563EB/#1D4ED8` `#D97706/#92400E` `#DC2626/#991B1B` `#7C3AED/#5B21B6` `#047857/#065F46` |

Raios 6/10/14/20/26 px; espaços em grelha de 4 px; z: palco 1, tabuleiro 10, HUD 20, mão 30/40, Chain 50, topo 60, modal 70/80, pacote 90, toast 100.
Sombras: painel `0 6px 0 #090C10, 0 12px 24px rgba(0,0,0,.45), inset 0 2px 0 rgba(255,255,255,.22)`; bandeja `inset 0 3px 0 rgba(0,0,0,.55), inset 0 0 0 2px #0F141C, 0 1px 0 rgba(255,255,255,.08)`; botão primário `0 5px 0 #B87D00, 0 8px 16px rgba(0,0,0,.4), inset 0 2px 0 rgba(255,255,255,.45)`.

## Motion
| Token | Valor |
|---|---|
| `--dur-instant/fast/normal/slow` | 90 / 160 / 260 / 420 ms |
| `--ease-out-snappy` | `cubic-bezier(.22,1,.36,1)` (entradas, painéis, lances) |
| `--ease-out-toy` | `cubic-bezier(.34,1.45,.64,1)` (só objetos leves) |
| `--ease-in-anticipation` | `cubic-bezier(.36,0,.66,-.56)` |
| `--ease-in-out-crisp` | `cubic-bezier(.65,0,.35,1)` |

Botão: carregar 70 ms (`translateY(4px) scale(.97,.95)`), soltar 120 ms com overshoot leve. Painel/modal: entra 240 ms de `scale(.92) translateY(12px)` a seco, sai 160 ms. Mudar de ecrã: sai 110 ms (`±48px`, fade), entra 220 ms com stagger 35 ms. Captura: antecipação 110 → embate 90 → **hit-stop 60** → peça vencida ejetada a rodar 300 ms; tremor máx. 6 px. Armadilha: hit-stop 70, flip da carta 220, carimbo; tremor até 11 px nas pesadas. Chain: 340 ms por elo, salto `translateY(-14px) rotate(4deg) scale(1.12)` com nota a subir 1 tom por elo. Fim: slow-mo 0,35× 250 ms, banner a cair como carimbo 300 ms, moedas em arco com stagger 45 ms.

## Ecrãs
- **Arena**: barra de topo (avatar, nome, Elo | ouro, poeira, som); centro: pedestal com as peças 3D a saltar e as 3 melhores cartas do baralho ativo + placa da liga/Elo; direita: doca do baralho ativo + bloco JOGAR (seletor de modo + botão amarelo 64 px); esquerda (desktop): painel de garantias da loja; doca de navegação em baixo (Loja, Baralhos, **Arena** maior, Online). Telemóvel: tudo em coluna, JOGAR na zona do polegar.
- **Entrada na partida (VS)**: topo e doca saem (200 ms); duas placas diagonais (-8°) entram dos lados e batem no centro aos 520 ms; carimbo "VS" dourado `scale(2.2→1)` 140 ms com tremor 5 px; leitura até 1250 ms; abrem até 1550 ms.
- **Pacote**: 1:1,55, foil azul-marinho `#181F2C` com abas estriadas de 24 px em cima e em baixo, rebordo dourado e medalhão do cavalo. Abertura: escurecer + pacote voa para o centro a dar uma volta e achata (0–450 ms) → costura tracejada a 28 px do topo com faísca da cor da melhor raridade → rasgar (clique ou arrastar, 320 ms) → **hit-stop 90 ms** → aba voa, invólucro desce, 12/24/40 faíscas e tremor 0/5/9 px → 5 cartas de costas em leque (stagger 65 ms; as mais raras nas posições 4 e 5; halo da raridade ao passar o rato) → revelar: Comum 260 ms, Rara 380 ms (8 faíscas), Épica 620 ms (antecipação, salto, hit-stop 60, tremor 4 px, ✦✦✦), Lendária 1150 ms (escurece, anel dourado, vídeo, "LENDÁRIA!", hit-stop 80, tremor 8 px, 40 partículas) → botão "Revelar tudo" (stagger 90 ms, Lendária sempre no fim).
- **Partida**: casas mate `#E2E8F0` / `#475569`; lance possível = disco menta `#2EC4B6` com contorno (não pintar a casa); captura = 4 cantoneiras `#D90429`; último lance amarelo `#FFB703` a 28 %; casa do rato = moldura branca 55 %; seleção = `#00B4D8` 40 % + anel; armadilha própria = autocolante âmbar tracejado no canto; xeque = pulso vermelho a 2 Hz + vinheta 400 ms. Bloom só nas faíscas (limiar ~0,92, força ~0,25).

## Estado da implementação (27/10/2026)
Feito:
- Fase 1 (ganhos rápidos): tokens e materiais (`styles/base.css`), 3 fontes, zero emojis (`src/ui/Icons.js`), plástico mate em menus e partida, Arena como hub (palco com peças 3D, baralho ativo, JOGAR, doca em baixo).
- Partes da 2: carta nova (moldura e silhueta por tipo, medalhão de velocidade, insígnias de raridade, caixa de regras); tabuleiro mate com disco menta, cantoneiras e moldura do rato; peças em marfim e grafite; bloom mais fraco; hit-stop de 60 ms nas capturas; HUD com relógio amarelo e os 2 espaços de carta.
- Partes da 3: abertura de pacote completa (`GachaView`) e ecrã VS (`VersusScreen`); transições entre separadores; versão compacta para ecrãs baixos (~600 px) e JOGAR na zona do polegar no telemóvel.
- "Reduzir movimento" como opção do jogo (botão de definições na barra de cima).

Por fazer:
- Sons novos com as receitas do relatório (dupla camada: ruído filtrado + tom) em `src/audio/SoundEngine.js`.
- Modo daltónico (`html[data-colorblind]` com a paleta Okabe-Ito) e opção nas Definições.
- Calha da Chain com elos numerados e feixes até à casa alvo; salto "Balatro" por elo com nota a subir.
- Frame Break nas Épicas/Lendárias (o objeto a sair da moldura) e peças com toon de 3 tons em vez de verniz.
- Câmara 3D a deslizar entre ecrãs dos menus (palco 3D contínuo) e fundo do estádio novo (prompt na secção M do relatório).
- Missões diárias na Arena e o ecrã de vitória com moedas a voar.

## Cartas
Chassis com contorno 3 px e aba inferior de 4 px na cor `-lip` do tipo; janela da arte nos 55 % de cima; medalhão de velocidade no canto (V1 seta cinza, V2 asas `#00B4D8`, V3 relâmpago `#FFB703`); caixa de regras rebaixada `#141A24`; placa de raridade em baixo com insígnias (● / ◆◆ / ✦✦✦ / coroa). Silhueta por tipo: Equipamento com rebites, Armadilha de Casa com listras de aviso, Reativa com cantos chanfrados, Counter com dentes de relâmpago, Magia Rápida com arco.
