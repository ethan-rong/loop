# Contact sheet: python3 scripts/sheet.py video.mp4 out.png t1 t2 ... (4 per row, 320 px wide each, time stamped)
import subprocess, sys, io
from PIL import Image, ImageDraw
video, out, times = sys.argv[1], sys.argv[2], [float(t) for t in sys.argv[3:]]
tiles = []
for t in times:
    png = subprocess.run(['/opt/homebrew/bin/ffmpeg', '-loglevel', 'error', '-ss', str(t), '-i', video, '-frames:v', '1',
                          '-vf', 'scale=320:-1', '-f', 'image2pipe', '-c:v', 'png', '-'], capture_output=True).stdout
    im = Image.open(io.BytesIO(png)).convert('RGB')
    ImageDraw.Draw(im).rectangle([0, 0, 70, 22], fill='black')
    ImageDraw.Draw(im).text((4, 4), f'{t:.1f}', fill='yellow')
    tiles.append(im)
w, h = tiles[0].size
cols = min(4, len(tiles)); rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (w * cols, h * rows), 'white')
for i, im in enumerate(tiles):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
sheet.save(out)
