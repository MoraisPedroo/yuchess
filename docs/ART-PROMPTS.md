# Arte dos objetos das cartas (Gemini)

Cada carta tem um **objeto** (a bomba, as botas, a jaula…). O objeto aparece quando arrastas a carta para o tabuleiro, quando ela cai na casa, quando voa para a peça ao equipar e no cubo da armadilha. Sem imagem, o jogo usa o desenho SVG de `src/view/CardArt.js`.

Fluxo:

1. No Gemini (modelo de imagem), colar o **Prompt A** e depois, na mesma conversa, o **Prompt B** (para manter o estilo).
2. Descarregar as duas imagens com "Baixar imagem no tamanho original" (vêm em JPG 2048×2048) para `C:\Users\<tu>\Downloads`.
3. Recortar e tirar o fundo:
   ```bash
   python tools/slice-items.py "C:/Users/<tu>/Downloads/folha-a.png" A
   python tools/slice-items.py "C:/Users/<tu>/Downloads/folha-b.png" B
   ```
   Gera `assets/items/<icone>.png` (256×256, fundo transparente) e atualiza `src/ui/ItemArtList.js`. Precisa do Pillow (`pip install pillow`).
4. Abrir `tools/gallery.html` ou uma partida para ver o resultado. Se um objeto sair mal, pede ao Gemini só esse (uma imagem com 1 objeto, mesmo estilo) e corre `python tools/slice-items.py imagem.png ICONE`.

## Prompt A — Equipamentos e Armadilhas de Casa (16)

```
Create one square image (1:1, as large as possible) laid out as a strict 4×4 grid of 16 game item icons, evenly spaced. Each item is centered in its own cell with a generous empty margin; nothing touches or crosses the cell borders. No grid lines, no text, no letters, no numbers, no labels anywhere.
Background: one pure flat white (#FFFFFF) for the whole image. No gradient, no vignette, no floor, no drop shadows, no cast shadows.
Identical style for all 16 icons: premium mobile card-game item art, glossy 3D vinyl toy look (Pixar / Supercell quality render), chunky rounded shapes, a thick dark navy outline (#14102A) around every item like a sticker, soft studio light from the top-left, small white specular highlights, saturated candy colors, slight 3/4 view, cute cartoon but readable at small size.
Row 1, left to right: 1) a short sword with a pink handle and a golden crossguard, with a shiny gold coin beside it; 2) a cyan sneaker-boot with small white wings on the heel; 3) a big orange metal spring coil with a golden cap; 4) a crown made of blue ice crystals.
Row 2: 5) a golden royal scepter topped with a big red gem; 6) green cactus-shaped chest armor covered with spikes; 7) a red telescopic spear with a metal spring in the shaft and an orange tip; 8) a purple cape with a blue horseshoe-magnet emblem.
Row 3: 9) a swirling purple-and-cyan gravity vortex hole with small floating rocks; 10) a small yellow metal cage crackling with blue electric sparks; 11) a heavy black iron anvil with a red stripe; 12) a puddle of pink bubblegum with big round bubbles.
Row 4: 13) an orange springboard launch pad with green springs and an up-arrow shape; 14) a green retro sci-fi ray gun with a glowing purple tip; 15) a round portal with a blue and purple swirling galaxy inside; 16) a round black cartoon bomb with a lit fuse spark and cyan ink splashes.
```

## Prompt B — Reativas, Counter-Traps e Magias Rápidas (15 + 1)

```
Now make a second image with exactly the same rules and the same style as the previous one (square, strict 4×4 grid, pure flat white background, no shadows, no text, thick dark navy outline, glossy 3D vinyl toy look):
Row 1: 17) a faceted cyan crystal shield with a gold rim; 18) a pink rubber hand mirror with cyan glass; 19) a grey ninja smoke-bomb ball releasing a purple smoke puff; 20) an orange inflatable crash-test dummy doll with a white target symbol on its chest.
Row 2: 21) a golden royal alarm siren light with a blue lens and a tiny crown on top; 22) a green piggy bank made of patched scrap metal with a gold coin slot; 23) two translucent soap-bubble shields side by side, one cyan and one pink; 24) a big red judge's gavel with golden bands.
Row 3: 25) giant orange scissors cutting a black wire; 26) a big red horseshoe magnet with blue tips pulling a tiny gear; 27) a shiny golden referee whistle on a black cord; 28) a cyan sci-fi EMP pulse grenade with purple energy rings.
Row 4: 29) an orange jackhammer with red details; 30) a purple wind-up alarm clock with a golden wind-up key and curved rewind-arrow shapes (no numbers on the dial); 31) a red boxing glove on a green spring; 32) a golden treasure chest glowing from inside.
```

## Ordem (célula → ícone)

| Folha | Células 1–16 (ou 17–32) |
|---|---|
| A | GREED_SWORD, WIND_BOOTS, SPRING_COIL, ICE_CROWN, ROYAL_SCEPTER, SPIKE_ARMOR, SPRING_SPEAR, MAGNET_CAPE, GRAVITY_PIT, ELECTRIC_CAGE, HEAVY_ANVIL, BUBBLEGUM_SWAMP, EJECT_PAD, SHRINK_RAY, WORMHOLE, INK_MINE |
| B | CRYSTAL_SHIELD, RUBBER_MIRROR, SMOKE_BOMB, DUMMY_DOLL, ROYAL_SIREN, PIGGY_BANK, TWIN_BUBBLES, JUDGE_HAMMER, GIANT_SCISSORS, THIEF_MAGNET, GOLDEN_WHISTLE, EMP_BLAST, JACKHAMMER, REWIND_CLOCK, BOXING_GLOVE, TREASURE_CHEST |

## Folha de efeitos (FX) e estádio

- Efeitos: mesmo estilo, 4×4 — estrela, impacto, explosão, fumo / tinta, raio, gelo, moeda / círculo mágico, vidro, chiclete, tóxico / rasto, zanga, confetes, coroa. Recorte: `python tools/slice-items.py folha-fx.jpg FX` (vai para `assets/fx/`).
- Estádio: imagem 16:9, estádio de e-sports à noite visto de cima com o centro escuro e vazio (o tabuleiro fica por cima), sem texto. Guardar como `assets/arena/stadium.jpg` (1920 px, JPEG ~82).

## Vídeos (Veo, "Criar vídeo")

1. Imagem inicial 1280×720: o objeto recortado (da folha original) em grande sobre fundo índigo escuro com brilho na cor da carta.
2. Anexar a imagem e pedir: animar este objeto exato (mesmo desenho/contorno), a flutuar devagar, brilho a pulsar, faíscas à volta, câmara fixa, ciclo sem salto, sem texto.
   Prompts usados (anexar `_tmp_art/start_<icone>.png`):
   - Cetro: *Animate this exact cartoon object… a golden royal scepter…* (ver a conversa "Animated Golden Royal Scepter").
   - Bigorna: *Animate this exact cartoon object, a heavy black iron anvil with a red stripe, keeping the same design, thick dark outline and colors. It hovers slowly up and down over the dark indigo background, then drops a little and lands with a small cartoon impact: a ring shockwave, dust puffs and golden sparks. A red glow pulses behind it. Static camera, object centered, smooth seamless loop, 2D cartoon game asset look. No text, no logos, no people.*
   - Espelho: *Animate this exact cartoon object, a pink rubber hand mirror with cyan glass, keeping the same design, thick dark outline and colors. It floats and sways gently side to side; a bright white reflection sweeps across the cyan glass and little star sparkles bounce off it. A soft pink and cyan glow pulses behind. Static camera, object centered, smooth seamless loop, 2D cartoon game asset look. No text, no logos, no people.*
   - Apito: *Animate this exact cartoon object, a shiny golden referee whistle on a black cord, keeping the same design, thick dark outline and colors. It floats and swings gently on its cord; cartoon sound-wave rings and small golden star sparkles burst from the mouthpiece in rhythm. A warm golden glow pulses behind. Static camera, object centered, smooth seamless loop, 2D cartoon game asset look. No text, no logos, no people.*
   Um pedido de cada vez (enviar outro enquanto um gera cancela o primeiro). Se responder "full capacity", carregar em "Refazer" debaixo da resposta até passar.
3. Ver os quadros (`ffmpeg -i in.mp4 -vf "fps=1.5,scale=256:-1,tile=5x3" -frames:v 1 folha.png`) e cortar quadros estranhos. Ciclo em frente com transição no fim (usado na Bigorna, Espelho e Apito): `-filter_complex "[0:v]scale=480:-2,fps=24,setsar=1,split=2[s1][s2];[s1]trim=0.9:9.95,setpts=PTS-STARTPTS[a];[s2]trim=0.4:0.9,setpts=PTS-STARTPTS[h];[a][h]xfade=transition=fade:duration=0.5:offset=8.55,format=yuv420p[v]"`. Alternativa em vai-e-vem (Cetro): `ffmpeg -ss 0.6 -t 4.8 -i in.mp4 -filter_complex "[0:v]scale=480:-2,fps=30,split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,format=yuv420p[v]" -map "[v]" -an -c:v libx264 -crf 27 -preset slow -movflags +faststart assets/video/<icone>.mp4` e acrescentar o ícone a `ItemToken.VIDEO`.

## Ideias para depois (vídeo / animação)

- **Vídeos curtos (Veo) só para as Lendárias** (Cetro, Bigorna, Espelho, Apito): 4 s em ciclo, o objeto a rodar num pedestal néon, convertido para WebM pequeno (`ffmpeg -i in.mp4 -vf scale=360:-2 -c:v libvpx-vp9 -b:v 0 -crf 38 -an out.webm`) e mostrado na carta ampliada. Para as 31 cartas ficaria pesado demais (dezenas de MB).
- **Folhas de animação (sprite sheets)**: a IA não mantém os quadros consistentes entre si; explosões, faíscas e fumo continuam a ser feitos por código (`Particles3D`).
