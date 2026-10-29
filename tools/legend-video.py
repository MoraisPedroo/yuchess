"""Vídeos das Lendárias (Veo, no Gemini "Criar vídeo"):

  python tools/legend-video.py start ICONE '#cor'      -> _tmp_art/start_<icone>.png (1280x720, objeto ao centro)
  python tools/legend-video.py pack video.mp4 ICONE    -> assets/video/<icone>.mp4 (480x270, 24 fps, sem som)

Depois de "pack", acrescenta o ícone a ItemToken.VIDEO (src/ui/ItemToken.js). Prompts em docs/ART-PROMPTS.md.
Precisa do Pillow (start) e do ffmpeg no PATH (pack).
"""
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def start(icon, color):
    w, h = 1280, 720
    c = tuple(int(color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    glow = Image.new('RGB', (w, h), (15, 20, 28))
    d = ImageDraw.Draw(glow)
    for r in range(330, 0, -6):   # brilho na cor da carta atrás do objeto
        t = (1 - r / 330) ** 1.6 * 0.55
        d.ellipse([w / 2 - r * 1.25, h / 2 - r, w / 2 + r * 1.25, h / 2 + r], fill=tuple(int(15 + (k - 15) * t) for k in c))
    bg = glow.filter(ImageFilter.GaussianBlur(40))
    obj = Image.open(os.path.join(ROOT, 'assets', 'items', icon.lower() + '.png')).convert('RGBA')
    s = 500 / max(obj.size)
    obj = obj.resize((int(obj.width * s), int(obj.height * s)), Image.LANCZOS)
    bg.paste(obj, ((w - obj.width) // 2, (h - obj.height) // 2), obj)
    os.makedirs(os.path.join(ROOT, '_tmp_art'), exist_ok=True)
    out = os.path.join(ROOT, '_tmp_art', f'start_{icon.lower()}.png')
    bg.save(out)
    print(out)


def pack(src, icon):
    out = os.path.join(ROOT, 'assets', 'video', icon.lower() + '.mp4')
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-an', '-vf', 'scale=480:270:flags=lanczos,fps=24', '-c:v', 'libx264',
                    '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], check=True)
    print(out, os.path.getsize(out) // 1024, 'KB')


if __name__ == '__main__':
    if len(sys.argv) < 4 or sys.argv[1] not in ('start', 'pack'):
        print(__doc__)
        sys.exit(1)
    if sys.argv[1] == 'start':
        start(sys.argv[2], sys.argv[3])
    else:
        pack(sys.argv[2], sys.argv[3])
