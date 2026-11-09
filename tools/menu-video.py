#!/usr/bin/env python3
"""menu-video.py — vídeos de fundo dos menus (docs/RELATORIO-TELAS.md, secção C).

Pega num clipe do Veo (8–10 s, 720p) e faz um ciclo sem costura: o último segundo funde-se com o primeiro (o vídeo
fica 1 s mais curto). Grava em assets/video/menu/:
  <nome>-720p.webm (VP9) e <nome>-720p.mp4 (H.264)   — computador
  <nome>-mobile.webm e <nome>-mobile.mp4 (540×960)   — telemóvel na vertical (corte ao centro)
  <nome>-poster.webp                                  — imagem de espera (1.º quadro do ciclo)
Sem áudio (o navegador só deixa tocar sozinho sem som).

Uso:  python tools/menu-video.py bruto.mp4 arena [--crop-x 0.5]
  --crop-x  onde fica o corte vertical do telemóvel (0 = esquerda, 0,5 = centro, 1 = direita)
Depois: pôr o nome em YC.MENU_CLIPS (src/ui/MenuBackdrop.js).
"""
import argparse
import os
import subprocess
import tempfile

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'video', 'menu')


def run(cmd):
    subprocess.run(['ffmpeg', '-v', 'error', '-y'] + cmd, check=True)


def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('raw')
    ap.add_argument('name')
    ap.add_argument('--crop-x', type=float, default=0.5)
    a = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)
    d = duration(a.raw)
    base = os.path.join(OUT, a.name)
    master = os.path.join(tempfile.gettempdir(), f'{a.name}_master.mp4')

    # 1. ciclo: [1 s → fim] funde-se no fim com [0 → 1 s]
    fc = ('[0:v]fps=24,scale=1280:720:flags=lanczos,split[b][p];'
          '[p]trim=duration=1,setpts=PTS-STARTPTS[head];'
          '[b]trim=start=1,setpts=PTS-STARTPTS[main];'
          f'[main][head]xfade=transition=fade:duration=1:offset={d - 2:.3f},format=yuv420p[v]')
    run(['-i', a.raw, '-filter_complex', fc, '-map', '[v]', '-an', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', master])

    # 2. computador 720p
    run(['-i', master, '-c:v', 'libvpx-vp9', '-b:v', '1100k', '-maxrate', '1600k', '-crf', '33', '-row-mt', '1', '-g', '48', '-an', f'{base}-720p.webm'])
    run(['-i', master, '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-maxrate', '1700k', '-bufsize', '3400k', '-g', '48',
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', f'{base}-720p.mp4'])

    # 3. telemóvel na vertical: corte 9:16 e 540×960
    crop = f"crop=ih*9/16:ih:(iw-ih*9/16)*{a.crop_x:.3f}:0,scale=540:960:flags=lanczos"
    run(['-i', master, '-vf', crop, '-c:v', 'libvpx-vp9', '-b:v', '650k', '-maxrate', '950k', '-crf', '34', '-row-mt', '1', '-g', '48', '-an', f'{base}-mobile.webm'])
    run(['-i', master, '-vf', crop, '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-maxrate', '1000k', '-bufsize', '2000k', '-g', '48',
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', f'{base}-mobile.mp4'])

    # 4. imagem de espera
    run(['-i', master, '-vframes', '1', '-c:v', 'libwebp', '-quality', '82', f'{base}-poster.webp'])

    for suf in ('-720p.webm', '-720p.mp4', '-mobile.webm', '-mobile.mp4', '-poster.webp'):
        p = base + suf
        print(f'{os.path.basename(p)}: {os.path.getsize(p) / 1024:.0f} KB')
    print(f'ciclo de {d - 1:.1f} s')


if __name__ == '__main__':
    main()
