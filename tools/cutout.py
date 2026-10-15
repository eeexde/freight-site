"""Remove a flat studio background (white or black) by flood-filling from the image border.

usage: python tools/cutout.py in.jpg out.png [white|black] [max_width]
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
mode = sys.argv[3] if len(sys.argv) > 3 else 'white'
max_w = int(sys.argv[4]) if len(sys.argv) > 4 else 0

im = Image.open(src).convert('RGB')
if max_w and im.width > max_w:
    im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
w, h = im.size
px = im.load()

def is_bg(p):
    if mode == 'white':
        return min(p) > 232 and max(p) - min(p) < 18
    return max(p) < 22

mask = Image.new('L', (w, h), 255)
m = mask.load()
seen = bytearray(w * h)
q = deque()
for x in range(w):
    q.append((x, 0)); q.append((x, h - 1))
for y in range(h):
    q.append((0, y)); q.append((w - 1, y))
while q:
    x, y = q.popleft()
    i = y * w + x
    if seen[i]:
        continue
    seen[i] = 1
    if not is_bg(px[x, y]):
        continue
    m[x, y] = 0
    if x > 0: q.append((x - 1, y))
    if x < w - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < h - 1: q.append((x, y + 1))

# soften the edge a touch so it doesn't look clipped
mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
out = im.convert('RGBA')
out.putalpha(mask)
bbox = mask.getbbox()
if bbox:
    out = out.crop(bbox)
out.save(dst, optimize=True)
print(dst, out.size)
