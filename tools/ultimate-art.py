"""Arte das animações Ultimate (personagem de anime de uma Lendária; ver src/ui/Ultimates.js):

  python tools/ultimate-art.py hero imagem.png ICONE '#cor'   -> assets/ultimate/<icone>/hero.png (recortada, fundo
                                                                 transparente) e _tmp_art/ult_<icone>_start.png
                                                                 (1280x720, imagem inicial para o Veo)
  python tools/ultimate-art.py pack video.mp4 ICONE NOME [início] [duração]
                                                              -> assets/ultimate/<icone>/<nome>.mp4 (854x480, sem som)

A imagem da personagem vem do Gemini ("Criar imagem", fundo branco); os vídeos do Gemini ("Criar vídeo") a partir
da imagem inicial. Prompts em docs/ART-PROMPTS.md (secção "Ultimate"). Precisa do Pillow e do ffmpeg.
"""
import importlib.util
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FFMPEG_DIRS = [os.path.expanduser(r'~\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg.Essentials_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-essentials_build\bin')]


def slicer():
    """O recorte de fundo branco do tools/slice-items.py (mesmo algoritmo das imagens dos objetos)."""
    spec = importlib.util.spec_from_file_location('slice_items', os.path.join(ROOT, 'tools', 'slice-items.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def hero(src, icon, color):
    img = Image.open(src).convert('RGB')
    img.thumbnail((1000, 1300), Image.LANCZOS)
    cut = slicer().cut_background(img)
    box = cut.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox()
    cut = cut.crop(box)
    out_dir = os.path.join(ROOT, 'assets', 'ultimate', icon.lower())
    os.makedirs(out_dir, exist_ok=True)
    small = cut.copy()
    small.thumbnail((560, 760), Image.LANCZOS)
    path = os.path.join(out_dir, 'hero.png')
    small.save(path, optimize=True)
    print(path, small.size, os.path.getsize(path) // 1024, 'KB')
    # imagem inicial do vídeo: fundo escuro com brilho na cor da carta e a personagem ao centro
    w, h = 1280, 720
    c = tuple(int(color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    glow = Image.new('RGB', (w, h), (15, 20, 28))
    d = ImageDraw.Draw(glow)
    for r in range(380, 0, -6):
        t = (1 - r / 380) ** 1.5 * 0.6
        d.ellipse([w / 2 - r * 1.2, h / 2 - r, w / 2 + r * 1.2, h / 2 + r], fill=tuple(int(15 + (k - 15) * t) for k in c))
    bg = glow.filter(ImageFilter.GaussianBlur(40))
    fig = cut.copy()
    s = 660 / fig.height
    fig = fig.resize((int(fig.width * s), int(fig.height * s)), Image.LANCZOS)
    bg.paste(fig, ((w - fig.width) // 2, (h - fig.height) // 2 + 10), fig)
    os.makedirs(os.path.join(ROOT, '_tmp_art'), exist_ok=True)
    start = os.path.join(ROOT, '_tmp_art', f'ult_{icon.lower()}_start.png')
    bg.save(start)
    print(start)


def pack(src, icon, name, start=None, dur=None):
    env = dict(os.environ)
    env['PATH'] = os.pathsep.join(FFMPEG_DIRS + [env.get('PATH', '')])
    out_dir = os.path.join(ROOT, 'assets', 'ultimate', icon.lower())
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f'{name}.mp4')
    cut = (['-ss', str(start)] if start else []) + (['-t', str(dur)] if dur else [])
    subprocess.run(['ffmpeg', '-y', '-v', 'error', *cut, '-i', src, '-an', '-vf', 'scale=854:480:flags=lanczos,fps=24',
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out],
                   check=True, env=env)
    print(out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    a = sys.argv[1:]
    if len(a) >= 4 and a[0] == 'hero':
        hero(a[1], a[2], a[3])
    elif len(a) >= 4 and a[0] == 'pack':
        pack(a[1], a[2], a[3], a[4] if len(a) > 4 else None, a[5] if len(a) > 5 else None)
    else:
        print(__doc__)
        sys.exit(1)
