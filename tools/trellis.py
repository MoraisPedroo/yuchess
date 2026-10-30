"""trellis.py — imagem → modelo 3D (.glb) com o Space público microsoft/TRELLIS.2 (licença MIT).

  python tools/trellis.py imagem.png saida.glb [--seed N] [--faces 100000] [--tex 2048]

Usa a quota gratuita de GPU do Hugging Face (ZeroGPU): se der erro de quota, esperar e tentar outra vez.
Depois do .glb bruto: tools/blender-piece.py (limpar e normalizar) e gltf-transform (comprimir).
Ver docs/RELATORIO-VISUAL-3D.md e a secção "Peças 3D" do docs/ART-PROMPTS.md. Precisa do gradio_client.
"""
import argparse
import shutil
import sys
import time

from gradio_client import Client, handle_file


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('image')
    ap.add_argument('out')
    ap.add_argument('--seed', type=int, default=0)
    ap.add_argument('--faces', type=int, default=100000)
    ap.add_argument('--tex', type=int, default=2048)
    ap.add_argument('--res', default='1024')
    a = ap.parse_args()

    t0 = time.time()
    c = Client('microsoft/TRELLIS.2', verbose=False)
    c.predict(api_name='/start_session')
    img = c.predict(handle_file(a.image), api_name='/preprocess_image')
    print('preparada', img.get('path') if isinstance(img, dict) else img, flush=True)
    c.predict(handle_file(img['path'] if isinstance(img, dict) else img), a.seed, a.res, api_name='/image_to_3d')
    print(f'3D gerado ({time.time() - t0:.0f} s)', flush=True)
    glb, dl = c.predict(a.faces, a.tex, api_name='/extract_glb')
    shutil.copy(dl or glb, a.out)
    print(f'gravado {a.out} ({time.time() - t0:.0f} s)')


if __name__ == '__main__':
    try:
        main()
    except Exception as e:  # o erro do Space (quota, fila cheia…) vem na mensagem
        print('ERRO:', e, file=sys.stderr)
        sys.exit(1)
