# Prompt para o Deep Research do Gemini — 89 cartas novas (de 31 para 120)

Copiar tudo o que está dentro do bloco abaixo e colar no Gemini → Deep Research. Quando o relatório estiver pronto,
partilhar o link da conversa (ou exportar para Docs) e dá-lo ao Claude Code para implementar as cartas.

O formato pedido (secção 9) é pensado para ser implementado quase à letra: cada carta vem com o efeito escrito numa
"receita" com as peças que o motor já tem (secção 5), um teste, uma dica para o bot e o prompt da arte do objeto.

```text
Atua como designer-chefe de jogos de cartas colecionáveis e de estratégia (nível Hearthstone, Marvel Snap,
Legends of Runeterra, Magic: The Gathering) com experiência em equilíbrio competitivo e em xadrez. Quero um relatório
de investigação completo e prático para expandir o conjunto de cartas de um jogo web de 31 para pelo menos 120 cartas.
O relatório vai ser entregue a um programador (um agente de código) que o vai implementar à letra, por isso cada carta
tem de vir com regras exatas, sem ambiguidades, num formato estruturado (secção 9). Escreve em português de Portugal.

## 1. O jogo
"Chess-Gi-Oh! Cartoon Edition": xadrez a sério (regras completas: roque, en passant, promoção, xeque-mate,
afogamento, repetição tripla, 50 lances) misturado com cartas de truques. Estética "caixa de brinquedos de vinil
colecionável": cada carta é um objeto/brinquedo/engenhoca cartoon (botas com asas, bigorna de 100 toneladas, bomba de
tinta, íman ladrão…). Tom divertido e competitivo. Não pode usar nada da Konami/Yu-Gi-Oh! (nomes, termos registados,
arte); nomes originais em português de Portugal, com humor (trocadilhos de desenho animado, objetos de laboratório
maluco, circo, oficina, ninja, piratas, polícia, cozinha, espaço, desporto…).

## 2. Regras da partida (como o motor funciona hoje)
- Turno: 1) compra 1 carta (as Brancas não compram no 1.º turno da partida); 2) preparação: até 2 ações de carta
  (equipar, armar Armadilha de Casa, virar carta na Zona, ativar Magia Rápida); 3) exatamente 1 lance de xadrez
  (obrigatório; se só peças congeladas tivessem lances, passa a vez). Um lance de xadrez por turno é sagrado.
- Mão: começa com 3 cartas, máximo 5. Baralho: passa a ter 22 cartas (antes 12), máx. 2 cópias por carta, 1 se for
  Lendária, máx. 2 Lendárias por baralho (podes recomendar mudar com 22 cartas). Recuperação: quando perdes um Cavalo,
  Bispo, Torre ou Dama, compras 1 carta.
- Tipos de carta (os únicos 5; não inventes tipos novos):
  * EQUIP — Equipamento, Velocidade 1. Da mão para uma peça aliada compatível (lista de peças permitidas: p n b r q;
    o Rei nunca). Máx. 2 Equipamentos por peça, sem repetir. Fica na peça até ela morrer ou o efeito o tirar.
    Dá poderes passivos (mudar movimentos, reagir quando captura/morre/se mexe…).
  * GRID — Armadilha de Casa, Velocidade 2. Escondida numa casa vazia das filas 3 a 6; máx. 3 por jogador. Dispara
    quando uma peça INIMIGA acaba um lance sem captura nessa casa ("pisar"). Duas armadilhas na mesma casa
    destroem-se. É invisível ao adversário até disparar ou ser revelada.
  * REACTIVE — Armadilha Reativa, Velocidade 2. Virada para baixo na Zona (3 espaços por jogador); só pode ser usada
    a partir do turno seguinte, quando acontece o seu evento: CAPTURE (uma peça tua vai ser capturada; responde antes
    de a captura acontecer), DESTROYED (uma peça tua morreu), CHECK (o teu Rei ficou em xeque).
  * COUNTER — Counter-Trap, Velocidade 3. Virada na Zona; responde à ativação de uma carta do adversário de certos
    tipos (lista "negates") e anula-a.
  * QUICK — Magia Rápida, Velocidade 2. Ativa-se na tua preparação (da mão ou da Zona) ou como resposta (da Zona a
    qualquer momento; da mão só no teu turno). Pode ter alvo.
- Chain: cada carta ativada abre ou junta-se a uma Chain; o adversário pode responder com uma carta de Velocidade
  ≥ max(2, velocidade do elo de cima); máx. 8 elos; resolve do último para o primeiro. Equipamentos (Vel. 1) nunca
  respondem.
- Estados das peças: Congelada N turnos (não se mexe), Escudo (absorve 1 captura: estilhaça e o atacante volta para
  trás), Transformada (vira outra peça N turnos e depois volta), Equipamentos (até 2).
- Regras de segurança: nenhum efeito destrói, move, congela ou transforma o Rei; nenhum efeito pode deixar o Rei de
  quem o usou em xeque (o motor converte em "congelar" quando mover/remover seria ilegal); nada dá vitória direta nem
  lances de xadrez extra; aleatoriedade só com a semente partilhada (o jogo online repete as ações nos dois clientes).
- Há um bot (minimax + regras simples para cartas) que tem de conseguir usar todas as cartas.

## 3. As 31 cartas que já existem (não repetir ideias nem nomes)
- eq_espada_ganancia · Espada da Ganância Voraz (Equipamento, Épica, peças pnbrq): Equipa uma peça aliada. Sempre que ela capturar uma peça inimiga, compras 1 carta.
- eq_botas_vento · Botas de Vento Supersónico (Equipamento, Comum, peças p): Equipa um Peão. Pode avançar 2 casas em qualquer turno, se o caminho estiver livre.
- eq_mola_canguru · Mola de Salto Canguru (Equipamento, Rara, peças rb): Equipa uma Torre ou um Bispo. Pode saltar por cima de exatamente 1 peça no caminho (o salto não dá xeque).
- eq_aura_glacial · Coroa da Aura Glacial (Equipamento, Épica, peças nbrq): Depois de a peça se mexer, congela durante 1 turno uma peça inimiga ortogonalmente adjacente (exceto o Rei).
- eq_cetro_usurpador · Cetro do Falso Monarca (Equipamento, Lendária, peças p): Equipa um Peão. Passa a mover-se e a capturar como um Rei e recebe 1 Escudo.
- eq_armadura_espinhos · Armadura de Cacto Explosivo (Equipamento, Rara, peças pnbr): Se a peça equipada for capturada, a peça atacante (exceto o Rei) é destruída com ela.
- eq_lanca_telescopica · Lança Telescópica de Mola (Equipamento, Épica, peças pnr): Uma vez por partida, captura uma peça inimiga até 2 casas em linha sem sair da sua casa.
- eq_capa_magnetica · Capa de Repulsão Magnética (Equipamento, Comum, peças nbrq): Os Peões inimigos não podem capturar a peça equipada.
- gt_mina_repulsora · Fosso de Gravidade Zero (Armadilha de Casa, Rara): Escondida numa casa. Peão inimigo que a pise é destruído; peça maior é empurrada 1 casa para trás e congelada 1 turno.
- gt_jaula_estatica · Jaula de Choque Cartoon (Armadilha de Casa, Comum): Escondida numa casa. A peça inimiga que a pise fica congelada durante 2 turnos.
- gt_guilhotina_bigorna · Bigorna de 100 Toneladas (Armadilha de Casa, Lendária): Escondida numa casa. Cai uma bigorna gigante e destrói a peça inimiga que a pise (exceto o Rei).
- gt_pantano_chiclete · Pântano de Chiclete Rosa (Armadilha de Casa, Comum): Escondida numa casa. Destrói os Equipamentos da peça inimiga que a pise e congela-a 1 turno.
- gt_mola_retorno · Trampolim de Ejeção (Armadilha de Casa, Rara): Escondida numa casa. A peça inimiga que a pise é arremessada de volta à casa de onde veio.
- gt_raio_encolhedor · Raio Encolhedor de Laboratório (Armadilha de Casa, Épica): Escondida numa casa. A peça inimiga que a pise (exceto o Rei) vira Peão durante 2 turnos.
- gt_buraco_minhoca · Buraco de Minhoca Maluco (Armadilha de Casa, Rara): Escondida numa casa. Teletransporta a peça inimiga para a casa vazia mais distante nas colunas A ou H.
- gt_bomba_tinta · Mina de Tinta Cegante (Armadilha de Casa, Comum): Escondida numa casa. Empurra a peça inimiga 1 casa para trás e o dono da armadilha compra 1 carta.
- rt_escudo_divino · Égide de Cristal Cartoon (Armadilha Reativa, Épica, gatilho CAPTURE): Quando uma peça aliada é alvo de captura: um escudo absorve o golpe e o atacante volta à casa de origem.
- rt_espelho_magico · Espelho de Borracha Suprema (Armadilha Reativa, Lendária, gatilho CAPTURE): Quando uma peça aliada seria capturada: anula a captura e destrói a peça atacante (exceto o Rei).
- rt_fumaca_ninja · Bomba de Fumo Ninja (Armadilha Reativa, Comum, gatilho CAPTURE): Quando uma peça aliada é alvo de captura: foge para uma casa vazia adjacente (de preferência segura).
- rt_troca_dubles · Boneco de Testes Insuflável (Armadilha Reativa, Rara, gatilho CAPTURE): Quando uma Dama, Torre, Bispo ou Cavalo aliado seria capturado: destrói um Peão aliado no lugar dele e cancela o ataque.
- rt_alarme_real · Guarda-Costas do Rei (Armadilha Reativa, Rara, gatilho CHECK): Quando o teu Rei fica em xeque: congela 2 turnos a peça que deu xeque e compras 1 carta.
- rt_vampiro_energia · Seguro de Vida de Sucata (Armadilha Reativa, Comum, gatilho DESTROYED): Quando uma peça aliada é capturada ou destruída: compras 2 cartas.
- rt_cupula_dupla · Gerador de Bolhas Gémeas (Armadilha Reativa, Épica, gatilho DESTROYED): Quando uma peça aliada é destruída: dá um Escudo às 2 peças aliadas mais valiosas sem escudo.
- ct_julgamento_cartoon · Martelo do NEGADO! Supremo (Counter-Trap, Épica): Counter-Trap: quando o adversário ativa uma Armadilha de Casa ou Reativa, anula-a e destrói-a.
- ct_tesoura_corta_fio · Tesoura Gigante Corta-Fios (Counter-Trap, Comum): Counter-Trap: anula uma Armadilha de Casa ativada pelo adversário e revela outra armadilha escondida dele.
- ct_ima_equipamento · Íman Ladrão de Engenhocas (Magia Rápida, Rara): Magia Rápida: rouba 1 Equipamento de uma peça inimiga e passa-o para uma peça tua compatível.
- ct_apito_juiz · Apito do Juiz Subornado (Counter-Trap, Lendária): Counter-Trap suprema: anula qualquer carta do adversário, destrói-a e compras 1 carta.
- ct_emp_cartoon · Pulso Eletromagnético Boom (Magia Rápida, Épica): Magia Rápida: escolhe uma casa; destrói todas as Armadilhas de Casa escondidas na zona 3×3 à volta.
- ct_quebra_escudo · Britadeira Fura-Bolhas (Magia Rápida, Comum): Magia Rápida: destrói os Escudos das peças inimigas e o adversário não pode ganhar Escudos neste turno.
- ct_reverso_tempo · Relógio de Corda Reversa (Counter-Trap, Rara): Counter-Trap: anula uma Armadilha Reativa do adversário e congela 1 turno a peça que ela protegia.
- ct_confisco_real · Luva de Boxe Confiscadora (Counter-Trap, Rara): Counter-Trap: anula uma Armadilha ou Equipamento do adversário e devolve a carta ao topo do baralho dele.

## 4. Objetivo
- Pelo menos 89 cartas novas (total ≥ 120). Distribuição alvo das novas: 35 Comuns, 28 Raras, 17 Épicas,
  9 Lendárias. Por tipo, aproximadamente: 24 EQUIP, 20 GRID, 18 REACTIVE, 10 COUNTER, 17 QUICK.
- 6 a 8 famílias (arquétipos) com identidade visual e mecânica e sinergias entre elas (ex.: "Gelo" congela e ganha
  com peças congeladas; "Oficina" vive de Equipamentos; "Circo" empurra e teletransporta; "Banco de Sucata" compra
  cartas; "Tribunal" anula; "Laboratório" transforma). Cada família precisa de cartas Comuns que funcionem sozinhas e
  de 1 ou 2 "recompensas" Épicas/Lendárias.
- Comuns simples (1 efeito, texto curto); Raras com 1 condição; Épicas com escolha ou combo; Lendárias com um momento
  memorável, mas sempre com resposta possível do adversário.
- Profundidade estratégica a sério: cartas que mudem decisões de xadrez (controlo de casas, estrutura de peões,
  promoção, roque, colunas abertas, desenvolvimento, finais), não só "destrói uma peça".
- Equilíbrio: usa os valores do xadrez (Peão 1, Cavalo/Bispo 3, Torre 5, Dama 9) para orçar o efeito de cada
  raridade; diz qual é o orçamento por raridade e verifica cada carta contra ele. Assinala as cartas mais perigosas e
  as interações a testar.

## 5. Vocabulário do motor (usa isto nas receitas)
Gatilhos/janelas que já existem:
- STEP (peça inimiga pisa a casa da Armadilha de Casa: dados stepper, from, sq), CAPTURE (captura declarada contra
  uma peça tua: attacker, target, from, to), DESTROYED (peça tua morreu: piece, sq, cause), CHECK (o teu Rei em
  xeque: checkers), LINK (o adversário ativou uma carta: kind do elo), PREP (a tua preparação, para Magias Rápidas),
  e passivos de Equipamento: ON_CAPTURE (a peça equipada capturou), ON_DEATH (a peça equipada foi capturada),
  AFTER_MOVE (a peça equipada mexeu-se), ON_EQUIP (ao ser equipada), MOVE_RULE (muda os lances da peça).
Ações que já existem:
- draw(equipa, n); freeze(peça, turnos); destroy(peça) [nunca o Rei; vira freeze se for ilegal];
  shield(peça); shatterShields(equipa); shieldLock(equipa, este turno); negateCapture() [o atacante volta para trás];
  pushBack(peça, 1 casa para longe de quem veio); returnToFrom(peça); teleport(peça, regra da casa destino);
  dodge(peça → casa vazia adjacente segura); morph(peça → Peão, N turnos); stripEquips(peça);
  stealEquip(de peça inimiga → peça tua compatível); negateLink(elo) [destrói a carta]; linkToDeckTop(elo);
  revealTrap(adversário, n); destroyTraps(área 3×3 à volta de uma casa); sacrificeOwnPawn() [destrói um Peão teu no
  lugar da peça atacada].
- Regras de movimento já feitas: Peão avança 2 em qualquer turno; Torre/Bispo salta exatamente 1 peça; Peão move-se
  como Rei; captura à distância 1 vez por partida (até 2 casas em linha, sem sair do sítio); "não pode ser capturada
  por Peões".
Alvos que já existem: stepper, attacker, target, checkers, casa escolhida, par (peça inimiga com Equipamento → peça
tua), N peças aliadas mais valiosas sem escudo, peça adjacente ortogonal mais valiosa.
Podes propor primitivas NOVAS (máx. 15 no total), cada uma com definição exata e casos-limite. Ideias aceitáveis:
alvos escolhidos (peça inimiga, peça aliada, casa vazia), TURN_START / TURN_END, PROMOTE, CASTLE, EN_PASSANT,
morph para outra peça (ex.: Peão → Cavalo), trocar duas peças aliadas de lugar, mover uma Armadilha de Casa,
silenciar Equipamentos N turnos, olhar para as N cartas do topo e reordenar, recuperar uma carta do cemitério,
descartar da mão do adversário (aleatório pela semente), +1 ação de carta neste turno, −1 ação de carta ao
adversário no próximo turno, casa bloqueada N turnos (ninguém pode ir para lá), "a peça não pode ser alvo de
cartas". Não proponhas: lances de xadrez extra, controlar peças do adversário, efeitos no Rei, ver a mão do
adversário inteira, vitória direta.

## 6. Arte (para cada carta)
Cada carta tem um objeto desenhado como ícone de brinquedo de vinil (aparece na carta, voa para a peça ao equipar,
cai na casa ao armar). As imagens são geradas no Gemini em folhas 4×4 de 16 objetos com este estilo fixo:
"glossy 3D vinyl toy look (Pixar / Supercell quality), chunky rounded shapes, thick dark slate outline (#0F141C)
like a sticker, soft studio light from the top-left, small white specular highlights, saturated candy colors,
slight 3/4 view, cute cartoon but readable at small size, pure white background, no text".
Paleta permitida para as cores da carta: #FFB703 #FB8500 #D90429 #2EC4B6 #00B4D8 #2563EB #7C3AED #9333EA #047857
#64748B #F8FAFC #0F141C.
Sons disponíveis (escolhe um por carta): sword_draw, spring_jump, ice_freeze, magic_zap, explosion_bam,
shield_clang, glass, negate_stamp, capture, hop, trap. Se nenhum servir, propõe um som novo com receita Web Audio
(oscilador, frequências, duração, ruído filtrado).

## 7. O baralho passa a 22 cartas
Recomenda e justifica: mão inicial, mão máxima, Lendárias por baralho, cópias por carta, compra por turno e se a
recuperação (comprar ao perder peça grande) continua. Faz as contas: numa partida média de ~38 turnos por jogador,
quantas cartas cada um vê e usa, e se o baralho acaba.

## 8. Economia (pacotes de 5 cartas por 100 de ouro; 65 % Comum, 25 % Rara, 8 % Épica, 2 % Lendária; a 5.ª carta é
Rara ou melhor; pity Épica a 4 pacotes e Lendária suave a 15 / garantida a 20; vitória +120 ouro, derrota +40;
criar: 40/120/400/1000 de Poeira; duplicado: 10/30/100/300). Com 120 cartas, quantos pacotes demora a completar a
coleção? Propõe ajustes (pacotes de boas-vindas, missões, preços) para um jogador casual montar um baralho de 22
competitivo em ~1 semana de jogo.

## 9. Formato da entrega (obrigatório)
A. Resumo das decisões de regras (secção 7) e economia (secção 8), com números finais.
B. As famílias: nome, fantasia, mecânica, cores, 3 cartas-chave, contra quem é forte e fraca.
C. Vocabulário final: lista das primitivas usadas (existentes + novas), cada nova com definição exata, quem escolhe
   o alvo, o que acontece se o alvo desaparecer a meio da Chain, e casos-limite.
D. As cartas novas em blocos de código JSON VÁLIDO, no máximo 15 cartas por bloco (para não cortar), cada carta assim:
   {
     "id": "eq_|gt_|rt_|ct_|qs_" + nome_em_snake_case_sem_acentos (prefixo pelo tipo: eq EQUIP, gt GRID, rt REACTIVE,
           ct COUNTER, qs QUICK),
     "name": "Nome em PT-PT, máx. 28 caracteres",
     "kind": "EQUIP|GRID|REACTIVE|COUNTER|QUICK",
     "rarity": "COMMON|RARE|EPIC|LEGENDARY",
     "family": "nome da família",
     "pieces": "pnbrq (só EQUIP: as peças que pode equipar)",
     "trigger": "só REACTIVE: CAPTURE|DESTROYED|CHECK|ou um gatilho novo da secção C",
     "negates": ["só COUNTER: tipos que anula"],
     "target": "só QUICK: NONE|SQUARE|ENEMY_PIECE|OWN_PIECE|STEAL|outro definido na secção C",
     "text": "Texto da carta em PT-PT, máx. 150 caracteres, claro e sem ambiguidades",
     "recipe": { "when": "gatilho", "if": ["condições"], "do": [{ "op": "primitiva", "who": "alvo", "n": 1 }] },
     "canUse": "quando a carta pode ser ativada/responder (condição exata, para não ativar sem efeito)",
     "newPrimitives": ["primitivas novas que esta carta precisa (vazio se nenhuma)"],
     "botHint": "uma frase: quando é que o bot a deve usar e em que alvo",
     "test": "cenário de teste: posição (FEN ou descrição curta), ação, resultado esperado",
     "colors": ["#cor1", "#cor2"],
     "icon": "NOME_DO_ICONE_EM_MAIUSCULAS (único)",
     "sfx": "som",
     "item": "descrição em inglês do objeto para a folha de arte (1 frase, forma + cores + detalhe)"
   }
E. Ajustes recomendados às 31 cartas existentes (só se fizer falta para o equilíbrio), com o texto novo.
F. Baralho inicial de 22 (só Comuns e Raras) e 3 baralhos de 22 para o bot (Fácil: até Raras; Médio: até Épicas;
   Difícil: todas), com a lógica de cada um, usando ids existentes e novos.
G. Folhas de arte: as cartas novas agrupadas em folhas de 16 (Prompt C, D, E, F, G, H), cada uma com o prompt
   completo em inglês no estilo da secção 6, "Row 1, left to right: 1) … 16) …" pela ordem certa, mais 1 prompt de
   vídeo curto (Veo, 4–6 s, loop, fundo neutro) para cada Lendária nova.
H. Lista das 20 interações mais perigosas entre cartas (combos que partem o jogo, loops, efeitos que se anulam de
   forma estranha) e como as regras as resolvem.
Antes de entregar, confirma: ≥ 89 cartas novas, distribuição de raridades e tipos, nomes e ícones únicos, nenhum
texto acima de 150 caracteres, nenhuma carta afeta o Rei, JSON válido.
```
