"""Recorta as folhas de objetos geradas pelo Gemini (grelha 4x4, fundo branco liso) em PNG transparentes.

Uso:
  python tools/slice-items.py folha-a.png A        # 16 objetos da folha A
  python tools/slice-items.py folha-b.png B        # 16 objetos da folha B
  python tools/slice-items.py folha-c.png C        # folhas C a H: as 89 cartas da expansão (a H tem 9)
  python tools/slice-items.py bota.png WIND_BOOTS  # uma imagem com um só objeto

Gera assets/items/<icone em minúsculas>.png (256x256) e reescreve src/ui/ItemArtList.js com a lista dos
ícones que têm imagem. O fundo é retirado por "balde de tinta" a partir das bordas de cada célula (o contorno
escuro dos objetos impede que o branco de dentro seja apagado). Precisa do Pillow.
"""
import json
import os
import sys
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'items')
LIST_JS = os.path.join(ROOT, 'src', 'ui', 'ItemArtList.js')
SIZE = 256
SHEETS = {
    'A': ['GREED_SWORD', 'WIND_BOOTS', 'SPRING_COIL', 'ICE_CROWN', 'ROYAL_SCEPTER', 'SPIKE_ARMOR', 'SPRING_SPEAR', 'MAGNET_CAPE',
          'GRAVITY_PIT', 'ELECTRIC_CAGE', 'HEAVY_ANVIL', 'BUBBLEGUM_SWAMP', 'EJECT_PAD', 'SHRINK_RAY', 'WORMHOLE', 'INK_MINE'],
    'B': ['CRYSTAL_SHIELD', 'RUBBER_MIRROR', 'SMOKE_BOMB', 'DUMMY_DOLL', 'ROYAL_SIREN', 'PIGGY_BANK', 'TWIN_BUBBLES', 'JUDGE_HAMMER',
          'GIANT_SCISSORS', 'THIEF_MAGNET', 'GOLDEN_WHISTLE', 'EMP_BLAST', 'JACKHAMMER', 'REWIND_CLOCK', 'BOXING_GLOVE', 'TREASURE_CHEST'],
    # efeitos visuais (partículas do palco 3D): vão para assets/fx/ e src/view3d/FxArtList.js
    'FX': ['SPARKLE', 'IMPACT', 'EXPLOSION', 'SMOKE', 'INK', 'LIGHTNING', 'ICE', 'COIN',
           'MAGIC_CIRCLE', 'GLASS', 'BUBBLEGUM', 'TOXIC', 'SWOOSH', 'ANGER', 'CONFETTI', 'CROWN'],
}
# folhas C a H: as 89 cartas da expansão pela ordem de docs/cartas-novas.json (prompts em docs/ART-PROMPTS.md)
with open(os.path.join(ROOT, 'docs', 'cartas-novas.json'), encoding='utf-8') as _f:
    _NEW = [c['icon'] for c in json.load(_f)]
for _i, _letter in enumerate('CDEFGH'):
    SHEETS[_letter] = _NEW[_i * 16:(_i + 1) * 16]
FX_OUT = os.path.join(ROOT, 'assets', 'fx')
FX_JS = os.path.join(ROOT, 'src', 'view3d', 'FxArtList.js')
TOL = 38      # distância de cor (0–441) até onde um píxel ainda conta como fundo
EDGE = 70     # faixa de suavização do contorno


def dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def cut_background(img):
    """Devolve RGBA com o fundo ligado às bordas transparente e o contorno suavizado."""
    img = img.convert('RGB')
    w, h = img.size
    px = img.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    bg = tuple(sorted(c[i] for c in corners)[2] for i in range(3))
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i] or dist(px[x, y], bg) > TOL:
            continue
        seen[i] = 1
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    out = Image.new('RGBA', (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            i = y * w + x
            r, g, b = px[x, y]
            if seen[i]:
                op[x, y] = (r, g, b, 0)
                continue
            near = (x > 0 and seen[i - 1]) or (x < w - 1 and seen[i + 1]) or (y > 0 and seen[i - w]) or (y < h - 1 and seen[i + w])
            if near:
                # píxel da borda: transparência pela distância ao fundo e cor sem a mistura do branco
                a = max(0.0, min(1.0, (dist((r, g, b), bg) - TOL * 0.5) / EDGE))
                if a > 0:
                    r = int(max(0, min(255, (r - (1 - a) * bg[0]) / a)))
                    g = int(max(0, min(255, (g - (1 - a) * bg[1]) / a)))
                    b = int(max(0, min(255, (b - (1 - a) * bg[2]) / a)))
                op[x, y] = (r, g, b, int(a * 255))
            else:
                op[x, y] = (r, g, b, 255)
    return out


def fit(rgba):
    """Corta à volta do objeto e centra-o num quadrado de SIZE com 6 % de margem."""
    box = rgba.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    if not box:
        return None
    obj = rgba.crop(box)
    side = int(max(obj.size) / 0.88)
    canvas = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    canvas.paste(obj, ((side - obj.size[0]) // 2, (side - obj.size[1]) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def save(icon, img, out=None):
    out = out or OUT
    os.makedirs(out, exist_ok=True)
    res = fit(cut_background(img))
    if res is None:
        print(f'  {icon}: vazio, ignorado')
        return
    res.save(os.path.join(out, f'{icon.lower()}.png'), optimize=True)
    print(f'  {icon}: ok')


def write_list(fx=False):
    out, js, var, what = (FX_OUT, FX_JS, 'FX_ART', 'efeitos com imagem em assets/fx/') if fx else (OUT, LIST_JS, 'ITEM_ART', 'ícones com imagem em assets/items/')
    names = sorted(f[:-4].upper() for f in os.listdir(out) if f.endswith('.png')) if os.path.isdir(out) else []
    body = ', '.join(f"'{n}'" for n in names)
    with open(js, 'w', encoding='utf-8', newline='\n') as f:
        f.write(f'/* {os.path.basename(js)} — gerado por tools/slice-items.py: {what}. */\n')
        f.write('(function (YC) {\n  \'use strict\';\n')
        f.write(f'  YC.{var} = [{body}];\n')
        f.write("})(typeof window !== 'undefined' ? (window.YC = window.YC || {}) : (globalThis.YC = globalThis.YC || {}));\n")
    print(f'{len(names)} imagens em {os.path.relpath(out, ROOT)} - {os.path.relpath(js, ROOT)} atualizado')


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    path, which = sys.argv[1], sys.argv[2].upper()
    sheet = Image.open(path)
    if which in SHEETS:
        icons, n = SHEETS[which], 4
        w, h = sheet.size
        cw, ch = w / n, h / n
        for k, icon in enumerate(icons):
            r, c = divmod(k, n)
            inset = 0.02
            cell = sheet.crop((int((c + inset) * cw), int((r + inset) * ch), int((c + 1 - inset) * cw), int((r + 1 - inset) * ch)))
            save(icon, cell, FX_OUT if which == 'FX' else None)
    else:
        save(which, sheet)
    write_list(which == 'FX')


if __name__ == '__main__':
    main()
