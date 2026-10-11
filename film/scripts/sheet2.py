# 1920x1080 frames -> 3-col sheet at 640 px: python3 scripts/sheet2.py video out.png t...
import subprocess, sys, io
from PIL import Image, ImageDraw
video, out, times = sys.argv[1], sys.argv[2], [float(t) for t in sys.argv[3:]]
tiles = []
for t in times:
    png = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-loglevel', 'error', '-ss', str(t), '-i', video, '-frames:v', '1', '-vf', 'scale=640:-1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert('RGB'); d = ImageDraw.Draw(im); d.rectangle([0, 0, 60, 18], fill='black'); d.text((3, 3), f'{t:.1f}', fill='yellow'); tiles.append(im)
w, h = tiles[0].size; cols = 3; rows = (len(tiles) + 2) // 3
sheet = Image.new('RGB', (w * cols, h * rows), 'white')
for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
