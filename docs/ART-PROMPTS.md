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


## Folhas C a H — as 89 cartas da expansão (relatório de 27/10/2026)

Mesmo fluxo das folhas A e B: colar cada prompt no Gemini (modelo de imagem), descarregar em tamanho original e correr `python tools/slice-items.py folha-c.png C` (… até H). A ordem dos objetos é a de `docs/cartas-novas.json`, que o `slice-items.py` já conhece; a folha H só tem 9 objetos (as outras 7 células ficam em branco). Enquanto não houver imagem, as cartas novas mostram o emblema da família (`src/view/CardArtFamilies.js`).

### Prompt C (Cartas 1 a 16)

```
A 4x4 grid sheet of 16 distinct game item icons, glossy 3D vinyl toy look (Pixar / Supercell quality), chunky rounded shapes, thick dark slate outline (#0F141C) like a sticker, soft studio light from the top-left, small white specular highlights, saturated candy colors, slight 3/4 view, cute cartoon but readable at small size, pure white background, no text.
Row 1, left to right: 1) A pair of shiny turquoise ice skates with gleaming silver blades and tiny cartoon snowflakes. 2) A chunky semi-translucent blue ice cube helmet with frosted white edges and frosty breath vapor. 3) A futuristic cartoon leaf-blower made of frosted turquoise metal blasting swirling cyan snowflakes. 4) A regal vinyl bobsled throne carved from crystalline glacier ice with shiny platinum runners.
Row 2, left to right: 5) A puddle of sleek turquoise ice with tiny comic friction lines and a miniature yellow warning sign. 6) A spiky vinyl iceberg popping out of a square hatch with cartoon frost cracks. 7) A chunky blue and white snow-cannon emerging from a trapdoor with a giant snowball loaded. 8) A round frosted vanity mirror reflecting a comical blue icicle ray.
Row 3, left to right: 9) A high-tech cryo-capsule chamber with frosted glass windows and liquid nitrogen frost. 10) A row of three sharp glossy turquoise icicles pointed downwards with an icy cyan aura. 11) A frozen mechanical stamp with ice-gears that shatters translucent shields upon impact. 12) A swirl of baby-blue cartoon wind carrying tiny smiling ice crystals and snowflake confetti.
Row 4, left to right: 13) An aerosol spray can colored icy blue with a frost nozzle spraying a wide fan of frozen fog. 14) A chunky cartoon orange screwdriver with a spiral chrome head and floating tiny brass screws. 15) A vibrant yellow handheld industrial drill with spiral hazard stripes and metal sparks. 16) A heavy-duty yellow construction frame with chunky hazard chevrons and dual steel rivets.
```

### Prompt D (Cartas 17 a 32)

```
A 4x4 grid sheet of 16 distinct game item icons, glossy 3D vinyl toy look (Pixar / Supercell quality), chunky rounded shapes, thick dark slate outline (#0F141C) like a sticker, soft studio light from the top-left, small white specular highlights, saturated candy colors, slight 3/4 view, cute cartoon but readable at small size, pure white background, no text.
Row 1, left to right: 1) A giant chunky red and yellow mech suit cockpit sized perfectly for a tiny cartoon pawn. 2) A miniature industrial conveyor belt with black rubber treads and bright orange guide rails. 3) A heavy cast-iron pneumatic press stamper poised over an oily industrial steel base. 4) A metal hopper box with spinning jagged spiky cogs devouring nuts, bolts, and tin cans.
Row 2, left to right: 5) A cartoon pit-stop toolbox that opens wide to reveal spare mechanical robotic arms. 6) A red miniature crucible furnace melting chrome gears into a shiny liquid gold ingot. 7) A hefty blue-handled adjustable wrench snapping shut aggressively with a golden spark. 8) A classic red tin oil can with a curved thin spout dripping a single golden glowing droplet.
Row 3, left to right: 9) A pulsing energy capacitor glowing bright crimson and amber with crackling sparks. 10) A compact yellow workstation bench loaded with automated robotic screwdrivers and blueprints. 11) Enormous squeaky red and yellow vinyl clown shoes with round bulbous toes and starry laces. 12) A quirky tall vinyl unicycle with a glittering chrome wheel and a rainbow clown saddle.
Row 4, left to right: 13) A vibrant crimson circus cannon with gold stars and decorative smoking barrel rings. 14) A cartoon tin pie plate loaded with a mountain of fluffy white cream and a shiny red cherry on top. 15) A polished wooden circus stage trapdoor bursting open with glittering gold magic sparks. 16) A fiery circus ring made of sculpted cartoon flames on a glossy striped circus stand.
```

### Prompt E (Cartas 33 a 48)

```
A 4x4 grid sheet of 16 distinct game item icons, glossy 3D vinyl toy look (Pixar / Supercell quality), chunky rounded shapes, thick dark slate outline (#0F141C) like a sticker, soft studio light from the top-left, small white specular highlights, saturated candy colors, slight 3/4 view, cute cartoon but readable at small size, pure white background, no text.
Row 1, left to right: 1) A bright red bulbous squeeze horn with an oversized brass horn bell producing sound waves. 2) A tri-fold carnival funhouse mirror showing warped miniature duplicate cartoon reflections. 3) A velvet magician top hat with golden stars and a white dove emerging with cartoon sparkles. 4) A bright red novelty laughing box with yellow grin marks and little audio sound-waves.
Row 2, left to right: 5) A black magician wand with a white tip that pops out a colorful fabric bouquet of daisies. 6) Three glossy juggling clubs colored red, teal, and yellow spinning in a dynamic airborne arc. 7) A steel zip-line pulley with colorful circus striped handles and tiny flying sparks. 8) A bubbling conical glass laboratory flask filled with radioactive neon-green effervescent liquid.
Row 3, left to right: 9) A segmented teal mechanical robot arm with a three-pronged claw holding an Erlenmeyer flask. 10) A golden syringe filled with swirling rainbow plasma equipped with glowing pressure meters. 11) A brass laboratory canister venting a thick cloud of purple sleeping vapor with floating Zzz letters. 12) A twin glass tube pod filled with bubbling cyan gel with electrical sparks jumping between them.
Row 4, left to right: 13) A glowing toxic radioactive green puddle melting the checkerboard floor with rising bubbles. 14) A chunky white and red emergency auto-injector pen releasing a soothing turquoise mist. 15) A chemical beaker bursting with pink and cyan atomic spark particles and fizzing bubbles. 16) A flexible pink and teal rubberized skin membrane patch stretching outwards with bounce lines.
```

### Prompt F (Cartas 49 a 64)

```
A 4x4 grid sheet of 16 distinct game item icons, glossy 3D vinyl toy look (Pixar / Supercell quality), chunky rounded shapes, thick dark slate outline (#0F141C) like a sticker, soft studio light from the top-left, small white specular highlights, saturated candy colors, slight 3/4 view, cute cartoon but readable at small size, pure white background, no text.
Row 1, left to right: 1) A sterile stainless steel dome with a glowing cyan laser ring that disintegrates trap wires. 2) A corked glass potion bottle filled with swirling violet and golden sparkling liquid. 3) A retro-futuristic teal and yellow ray gun with concentric rings around the muzzle. 4) A massive bubbling syringe loaded with glowing orange growth hormone and metallic needles.
Row 2, left to right: 5) A polished silver star badge with a cartoon engraved gavel in the center and blue ribbon. 6) A classic golden justice scale tilting comically with small legal books balancing on brass pans. 7) A cute speed camera on a tripod with a giant cartoon flash bulb flashing white light. 8) A miniature iron prison cell with thick black vertical bars and a comical padlock on the door.
Row 3, left to right: 9) A rolled up parchment paper scroll tied with a red ribbon and stamped with a wax seal. 10) A heavy wooden courtroom judge gavel banging down on a circular sound block with sparks. 11) A golden judge gavel encased in divine purple comic lightning striking a shattered rulebook. 12) A bright red plastic referee penalty card held high with yellow whistle hanging on a lanyard.
Row 4, left to right: 13) A legal folder stamped with a giant red REJECTED emblem emitting shockwaves. 14) A burning legal contract parchment tearing in half with glowing orange embers and falling sparks. 15) A yellow police line tape barrier blocking a checkered square with plastic traffic cones. 16) A magnifying glass with a bright blue LED light scanning through an invisible blueprint grid.
```

### Prompt G (Cartas 65 a 80)

```
A 4x4 grid sheet of 16 distinct game item icons, glossy 3D vinyl toy look (Pixar / Supercell quality), chunky rounded shapes, thick dark slate outline (#0F141C) like a sticker, soft studio light from the top-left, small white specular highlights, saturated candy colors, slight 3/4 view, cute cartoon but readable at small size, pure white background, no text.
Row 1, left to right: 1) A shiny steel pirate hook with a gold skull emblem on a leather cuff and a miniature rope coil. 2) A colorful vinyl green and scarlet macaw parrot perched on a tiny wooden pirate peg. 3) A bulging canvas burlap sack overflowing with shiny golden dubloons and glittering gems. 4) An ornate golden navigational compass with a spinning cyan crystal needle pointing at an X.
Row 2, left to right: 5) A wooden grooved powder keg with black metal hoops and a sizzling cartoon fuse on top. 6) An old worn treasure map roll with a bright red X mark and miniature gold palm trees. 7) A trapdoor with water splashes revealing a cartoon blue hammerhead shark with smiling teeth. 8) A sturdy iron-banded wooden treasure chest slightly cracked open with glowing green light.
Row 3, left to right: 9) A row of three miniature bronze pirate ship cannons firing simultaneously with black smoke puffs. 10) A giant horseshoe magnet encrusted with cartoon barnacles pulling floating gears and coins. 11) A round glass rum bottle with a flaming rag cork ready to burst like a pirate molotov. 12) A messy cartoon pile of wooden planks, coiled ropes, rusted anchor, and empty brass tankards.
Row 4, left to right: 13) A massive black cast-iron ship anchor dropping with heavy comic impact dust clouds. 14) A puffy dark blue tactical vest with bright yellow police padding and cartoon straps. 15) A white and blue electronic bullhorn megaphone emitting yellow lightning bolt sound waves. 16) A flashing red and blue dual revolving police beacon with chrome base and glossy plastic domes.
```

### Prompt H (Cartas 81 a 89)

```
A 4x4 grid sheet of 9 distinct game item icons in the first 9 slots and 7 empty pure white slots, glossy 3D vinyl toy look (Pixar / Supercell quality), chunky rounded shapes, thick dark slate outline (#0F141C) like a sticker, soft studio light from the top-left, small white specular highlights, saturated candy colors, slight 3/4 view, cute cartoon but readable at small size, pure white background, no text.
Row 1, left to right: 1) A heavy polycarbonate transparent riot shield with reinforced blue metal bars and double grips. 2) A deployable metal spike strip unrolled on the tiles with glossy silver hollow spikes. 3) A bright orange rubber traffic cone with dual white reflective stripes and a black heavy base. 4) A spring-loaded canister opening to deploy a heavy weighted nylon net with brass weights.
Row 2, left to right: 5) A pair of shiny chrome cartoon handcuffs with a linked chain and tiny keyhole details. 6) A striped yellow and black sawn barricade with blinking yellow safety lights on each post. 7) A cute rounded blue and white cartoon police squad car with glowing headlights and lightbar. 8) A portable foldable blue steel tactical barrier with bright yellow reflector strips.
Row 3, left to right: 9) A chunky blue police helicopter with spinning twin yellow rotors and searchlight beam. 10) Pure white empty background. 11) Pure white empty background. 12) Pure white empty background.
Row 4, left to right: 13) Pure white empty background. 14) Pure white empty background. 15) Pure white empty background. 16) Pure white empty background.
```

## Vídeos das 9 Lendárias novas (Veo)

Estado (2026-10-29): feitos os 9 (`assets/video/`); as 13 Lendárias têm vídeo. O Gemini (plano Pro) dá ~3 vídeos por
janela de uso; quando acaba responde "I can create more videos as soon as your limit resets" e
`gemini.google.com/usage` → "Uso atual" diz a hora a que reinicia. Se responder "I can't generate that video", é o filtro
do Veo: suaviza o prompt (a Bússola só passou sem a palavra "pirate"). Lendárias futuras sem vídeo usam a animação em CSS
(`.hc-alive` em `cards.css`: o objeto flutua, o brilho pulsa e há estrelinhas).

Prompts usados / a usar (todos acabam em *A &lt;cor&gt; glow pulses behind it over the dark background. Static camera,
object centered, smooth seamless loop, 2D cartoon game asset look. No text, no logos, no people.*):
- EXOESQUELETO_ROBO (feito): *a chunky red and yellow toy mech suit with a tiny pilot in the cockpit … flexes its big
  hydraulic claws and bobs slightly while its chest core glows bright amber and vents tiny puffs of white cartoon steam* (red).
- CANHAO_CIRCO (feito): *a crimson circus cannon with gold stars on chunky wheels … rocks gently back and forth while the fuse
  sizzles, then puffs a ring of star-shaped cartoon smoke from the barrel* (golden).
- TRUQUE_MAGICA (feito): *a navy magician top hat with gold stars and a white dove on top … the hat hops and tilts while the
  dove flaps its wings and rises a little, then settles back, as golden magic sparkles swirl around it* (purple).
- SORO_ALFA (feito): *a golden laboratory syringe with a rainbow liquid glass barrel and three round pressure gauges … floats and
  vibrates slightly while glowing rainbow plasma bubbles swirl inside the barrel and the gauge needles bounce* (teal).
- VETO_SUPREMO (feito): *a golden judge gavel crackling with purple lightning over an open old law book … lifts and slams down onto
  the book, sending out a circular purple shockwave and sparks, then rises back up* (purple).
- QUEBRA_CONTRATO (feito): *a torn parchment contract with a round seal and orange cartoon flames on the torn edges … the
  two paper halves wobble gently while the cartoon flames flicker and small glowing sparks float upward* (orange).
- BUSSOLA_DOURADA (feito): *an ornate golden pocket compass with a colorful compass rose … sways gently on its ring while
  the needle turns smoothly and settles, and small golden sparkles twinkle around it* (golden; com "pirate" foi recusado).
- ESCUDO_ANTITUMULTO (feito): *a chunky blue and transparent cartoon shield with a blue handle strap … hovers slowly up and
  down while a hexagonal cyan energy barrier ripples across its surface and gently deflects a small bouncing cartoon
  spark* (cyan).

Como fazer cada um (mesmo método dos vídeos antigos — imagem inicial + "Animate this exact cartoon object…"):
1. `python tools/legend-video.py start ICONE '#cor'` → `_tmp_art/start_<icone>.png`.
2. Gemini → "+" → **Criar vídeo** → anexar a imagem e colar o prompt (modelo abaixo) → esperar ~2 min.
3. Descarregar o vídeo e correr `python tools/legend-video.py pack video.mp4 ICONE` → `assets/video/<icone>.mp4`.
4. Acrescentar o ícone a `ItemToken.VIDEO`.

Ícones e cores: EXOESQUELETO_ROBO #D90429 · CANHAO_CIRCO #FFB703 · TRUQUE_MAGICA #7C3AED · SORO_ALFA #2EC4B6 ·
VETO_SUPREMO #9333EA · QUEBRA_CONTRATO #FB8500 · BUSSOLA_DOURADA #FFB703 · ESCUDO_ANTITUMULTO #00B4D8.

Modelo de prompt (o do Trineu): *Animate this exact cartoon object, a regal crystalline ice bobsled throne with platinum
runners, keeping the same design, thick dark outline and colors. It hovers slowly up and down over the dark background;
a ring of cartoon frost mist expands from it and tiny snowflakes orbit around it. A cyan glow pulses behind it. Static
camera, object centered, smooth seamless loop, 2D cartoon game asset look. No text, no logos, no people.* — trocar a
descrição do objeto e a animação pelas da tabela abaixo.

Texto do relatório (tabela copiada tal como veio). Gravar em `assets/video/<icone em minúsculas>.mp4` e acrescentar o ícone a `ItemToken.VIDEO`.

```
2. Prompts de Vídeo Curto (Veo, 4–6 s, Loop, Fundo Neutro) para as 9 Lendárias Novas

Para conferir destaque visual às 9 cartas Lendárias novas na interface de inspeção e abertura de pacotes, a tabela seguinte apresenta os prompts de geração de vídeo curto (4 a 6 segundos, loop contínuo sobre fundo neutro #F8FAFC) otimizados para o modelo Veo.   

#	ID e Nome da Carta Lendária	Família	Prompt Completo para Vídeo Veo (4–6 s, Seamless Loop, Neutral Background)
1	

eq_trono_glaciar

Trineu Glaciar Zero

Criogenia Cartoon

	"4-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral light slate studio background (#F8FAFC): a regal crystalline cyan ice bobsled throne gently hovering on platinum runners, pulsing an expanding ring of cartoon frost mist and orbiting sparkling snowflakes, no text."
2	

eq_exoesqueleto_tita

Exoesqueleto Robô Mecânico

Oficina Maluca

	"5-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral studio background (#F8FAFC): a chunky red and yellow toy mech-suit flexing its hydraulic pincer claws as its chest core glows bright amber and vents tiny puffs of white cartoon steam, no text."
3	

eq_canhao_homem_bala

Canhão de Circo Triunfal

Grande Circo Trapalhão

	"4-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral studio background (#F8FAFC): a crimson and gold circus cannon rocking back and forth on chunky wheels with a sizzling fuse, puffing a ring of star-shaped cartoon smoke from the barrel, no text."
4	

rt_truque_desaparecer

Truque de Desaparecimento

Grande Circo Trapalhão

	"5-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral studio background (#F8FAFC): a purple velvet magician top hat tipping open in mid-air as a swirl of golden magic sparkles and a cute vinyl white dove circle out and dive back inside, no text."
5	

eq_elixir_mutacao_total

Soro da Mutação Alfa

Laboratório Mutante

	"4-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral studio background (#F8FAFC): a chunky golden laboratory syringe floating and vibrating slightly while rainbow plasma bubbles swirl inside the glass barrel and pressure gauges bounce, no text."
6	

rt_injuncao_suprema

Veto do Supremo Tribunal

Tribunal da Batota

	"5-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral studio background (#F8FAFC): a heavy golden judge gavel crackling with purple cartoon lightning, slamming down onto a wooden block to emit a circular shockwave before rising back up, no text."
7	

ct_clausula_rescisao

Rescisão Judicial Unilateral

Tribunal da Batota

	"4-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral studio background (#F8FAFC): a rolled parchment contract with a red wax seal snapping in half in mid-air with bright orange cartoon flames and reforming seamlessly in a loop, no text."
8	

eq_bussola_tesouro

Bússola Dourada Caraíbas

Banco de Sucata & Pirataria

	"5-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral studio background (#F8FAFC): an ornate pirate gold compass opening its lid as a glowing cyan crystal needle spins rapidly and projects a holographic red treasure X above the dial, no text."
9	

eq_escudo_choque

Escudo Tático Antitumulto

Força Policial

	"4-second seamless loop animation, glossy 3D vinyl toy style, slight 3/4 view on a neutral studio background (#F8FAFC): a chunky blue and transparent polycarbonate riot shield projecting a hexagonal cyan energy barrier that deflects a bouncing cartoon spark, no text."
```

## Ultimate (personagens de anime das Lendárias)

Animação especial só visual (`src/ui/Ultimates.js`), desbloqueada com 1000 de ouro nos Baralhos. Arte em
`assets/ultimate/<icone>/`: `hero.png` (recortada), `summon.mp4` (invocação) e `strike.mp4` (golpe/defesa), feita com
`tools/ultimate-art.py` a partir de imagens e vídeos do Gemini.

Como fazer: Gemini → "+" → **Criar imagem** (3:4) com o prompt da personagem (fundo branco) → copiar a imagem (a página
guarda-a num `blob:` legível; desenhar num canvas e mandar ao recetor local — o botão "Baixar" do Gemini grava nas
Transferências) → `python tools/ultimate-art.py hero imagem.png ICONE '#cor'` → Gemini → **Criar vídeo** com
`_tmp_art/ult_<icone>_start.png` → `python tools/ultimate-art.py pack video.mp4 ICONE summon|strike início duração`.
O Veo recusa pedidos com pessoas mais "expressivos" ("wink", "petals") e às vezes dá erro com "swings": o que passou
foi sempre "Animate this 2D cartoon game illustration. The character …" com uma ação simples.

- **Akane, a Rainha Rubi** (Cetro do Falso Monarca, ataque, `#D90429`): imagem — *Full-body character illustration of
  an original anime heroine … a cheerful, mischievous young woman who crowned herself queen. Long crimson hair in two
  high ponytails, a small tilted golden crown … modest regal outfit: a red and gold royal tunic dress with white fur
  trim, a short red cape … white gloves, white tights and golden boots … golden royal scepter topped with a big faceted
  red ruby … plain pure white background*. Invocação (2,6 s + 4,8 s) — *The character slowly twirls the golden scepter
  and raises it high, the ruby on top shines, her cape and hair sway gently, and a soft column of golden light with
  sparkles rises behind her.* Golpe (3,5 s + 4,0 s) — *The character points the golden scepter forward and the ruby on
  top glows brighter and brighter, then fires a bright beam of red and gold magic light with sparkles and a glowing
  burst, while her cape and long hair blow in the magical wind.*
- **Kaito, o Guardião Azul** (Escudo Tático Antitumulto, guarda, `#0096C7`): imagem — *… a calm, brave young man who is
  the royal guardian of the king. Short spiky silver-blue hair, determined bright cyan eyes … modest blue and white
  guardian armor with silver shoulder plates, a dark blue coat with glowing cyan lines … a large rounded-rectangle
  transparent light-blue shield with a thick blue strap band across its middle and a faint glowing cyan hexagon
  pattern … plain pure white background*. Invocação (2,2 s + 4,6 s) — *The character raises the transparent blue shield
  high and a large dome of glowing cyan hexagon light expands around him, the hexagon tiles lighting up one by one …*
  Defesa (1,0 s + 3,6 s) — *The character braces behind the transparent blue shield as bright orange cartoon sparks fly
  at it from the front; a glowing cyan hexagon barrier flashes and ripples across the shield and the sparks bounce
  away harmlessly …*
- **Akaito, a Fusão Real** (Cetro + Escudo na mesma peça; fundo com brilho vermelho à esquerda e ciano à direita): imagem
  — *… an original anime hero … born from the fusion of a ruby queen and a blue royal guardian: … long crimson hair streaked
  with silver-blue locks in a high ponytail, a small golden crown, one amber eye and one cyan eye … the left half is a red
  and gold royal coat with white fur trim, the right half is blue and silver guardian armor with glowing cyan lines … golden
  royal scepter topped with a big faceted red ruby, on the left arm a transparent light-blue shield … plain pure white
  background*. Entrada (2,5 s + 5,4 s) — *A swirling spiral of red-gold and cyan light wraps around the character from the
  ground up, the character spins the ruby scepter and raises the hexagon shield, and a bright burst of red and blue light
  explodes outward …* Golpe (4,0 s + 4,6 s) — *… a swirling ball of red and cyan energy charges at the ruby, then fires as a
  twisting double beam of red and blue light …* Defesa (1,0 s + 4,2 s; a barreira dupla aparece aos 2,0 s do corte) — *The character braces behind the
  hexagon shield as bright orange cartoon sparks fly at it from the front; a double barrier of glowing red and cyan hexagons
  flashes around the character and the sparks bounce away harmlessly, then the character twirls the ruby scepter and smiles
  confidently.* → `python tools/ultimate-art.py pack video.mp4 FUSAO_REAL guard 1.0 4.2`.

### As outras 11 Lendárias (2026-10-30)

Imagem: o mesmo molde da Akane — *Full-body character illustration of an original anime hero(ine) for a colorful cartoon
chess card game: …* + *Clean Japanese anime style, cel shading, thick dark outlines, vibrant <cores> colors, polished
game character art. Standing centered, entire body visible from the top of the <cabeça> to the <pés>, plain pure white
background, no ground shadow, no text, no logo, no watermark.* (3:4). As imagens desta vez vieram com `src` do
`lh3…/gg-dl/` que não carrega dentro da página (referer): abre-se num `new Image()` com `referrerPolicy = 'no-referrer'`
numa camada branca por cima de tudo, em tamanho real (765×1024), e capturam-se duas partes (offset 0 e 422) com o
`zoom` do Chrome, que o `scratchpad/stitch.py` junta. Vídeos: *Animate this 2D cartoon game illustration. The character
… Static camera, 2D cartoon animation, dynamic motion. No text.*

| Personagem | Carta (papel) | Imagem (resumo) | Vídeos |
|---|---|---|---|
| **Goro, o Ferreiro Colossal** | Bigorna (`card`) | big cheerful young blacksmith, red bandana, leather apron, giant black hammer on the shoulder, iron anvil at his feet | Ativação (2,5 s + 5,0 s) — *lifts the giant black hammer high above his head and brings it down onto the iron anvil, a big burst of bright orange cartoon sparks…* |
| **Mira, a Ilusionista do Espelho** | Espelho (`card`) | pink/cyan hair, teal and white tailcoat, large round mirror with a bouncy pink rubber frame | Ativação (1,2 s + 5,6 s) — *holds up the big round rubber mirror, its pink frame wobbles like jelly, the cyan glass glows and a beam of light bounces off it…* |
| **Rin, a Árbitra Suprema** | Apito (`card`) | golden-blonde referee, black and white striped jacket, golden whistle | Ativação (1,5 s + 5,5 s) — *lifts the golden whistle and blows it, golden sound rings burst from it, then she points firmly forward* |
| **Luna, a Mágica Relâmpago** | Truque (`card`) | dark red hair, black top hat with red band, black and red tailcoat, magic wand | Ativação (2,0 s + 6,0 s) — *waves the magic wand in a circle, a big puff of red smoke with golden sparkles hides her, then she bows* |
| **Aiko, a Juíza Suprema** | Veto (`card`) | black hair in a bun with red ribbon, black judge robe with red and silver trim, wooden gavel | Ativação (2,0 s + 5,4 s) — *raises the big wooden gavel and strikes it down firmly, a shockwave of red light spreads out* |
| **Ren, o Advogado Implacável** | Rescisão (`card`) | silver-grey hair, glasses, grey three-piece suit, orange tie, glowing contract scroll | Ativação (1,5 s + 6,5 s) — *holds up the glowing contract scroll and tears it in half, the pieces burst into orange sparks and paper scraps* |
| **Yuki, a Princesa da Neve** | Trineu (`power`) | white hair with icy tips, ice tiara, light blue coat with white fur, snowflake wand, floating ice sleigh | Invocação (2,0 s + 5,4 s) — *slowly raises the crystal ice wand, snowflakes swirl, ice crystals grow at her feet…*; Poder (1,5 s + 5,5 s, impacto 0,62) — *thrusts the wand forward and a ring of freezing blue wind and snowflakes blasts outward* |
| **Lola, a Mestra do Circo** | Canhão (`power`) | curly red hair, tall red top hat, red and gold ringmaster coat, golden cane, small red circus cannon | Invocação (1,5 s + 6,5 s) — *tips her top hat and twirls the cane, confetti and golden stars burst*; Poder — *points the cane and the cannon fires with smoke and confetti* |
| **Riku, o Piloto Mecânico** | Exoesqueleto (`attack`) | orange hair, goggles, chunky orange and red robot exoskeleton with huge gauntlets | Invocação (4,0 s + 5,6 s) — *the robotic suit powers up, orange lights turn on, steam puffs, he clenches the fists*; Golpe (2,5 s + 5,0 s, impacto 0,5) — *punches forward, a burst of orange energy and a shockwave* |
| **Nova, a Cientista Alfa** | Soro (`attack`) | teal hair, lab goggles, white lab coat with teal cuffs, glowing teal flask | Invocação (1,5 s + 6,0 s) — *raises the glowing teal flask, it bubbles, teal energy spirals around her*; Golpe (2,0 s + 5,5 s, impacto 0,55) — *throws the flask forward, it bursts into a splash of teal energy* |
| **Marina, a Caçadora de Tesouros** | Bússola (`attack`) | golden-brown hair, navy captain hat, navy sailor coat with gold trim, glowing golden compass | Invocação (2,0 s + 6,5 s) — *opens the golden compass, the needle spins and glows, sparkles swirl in the sea breeze*; Golpe (2,5 s + 6,0 s, impacto 0,5) — *points the compass and a beam of golden light shoots out with gold coins* |
