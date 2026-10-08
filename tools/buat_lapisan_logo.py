"""Pecah logo APBP menjadi lapisan untuk fitur "urai logo" di bagian Makna logo.

Setiap piksel masuk tepat ke satu lapisan, jadi bila ditumpuk hasilnya
identik dengan logo asli. Jalankan ulang bila file logo diganti:

    pip install pillow numpy
    python tools/buat_lapisan_logo.py

Hasil: assets/img/logo-layer-{text,letters,orange,green,arc,plane}.webp
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "img" / "logo-apbp.png"
OUT = ROOT / "assets" / "img"
SIZE = (1000, 393)

src = Image.open(SRC).convert("RGBA")
a = np.asarray(src).astype(np.int16)
H, W = a.shape[:2]
r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)

navy = (b >= 30) & (b > r + 25) & (b > g + 25)
green = (g > r + 25) & (g > b + 25)
orange = (r > 150) & (r > g + 60) & (r > b + 100)
neutral = (mx - mn < 25) & (mx < 140)

core = al >= 128
TEXT, LETTERS, ORANGE, GREEN, ARC, PLANE = 1, 2, 3, 4, 5, 6
lab = np.zeros((H, W), np.uint8)
rows = np.arange(H)[:, None]
lab[core & neutral & (rows >= 430)] = TEXT   # teks nama hanya di pita bawah
lab[core & orange] = ORANGE
lab[core & green] = GREEN

navy_core = core & navy
ys, xs = np.nonzero(navy_core)
arc_seed = (int(xs.min()), int(ys[xs.argmin()]))          # titik biru paling kiri = busur
top = ys < 120
i = xs[top].argmax()
plane_seed = (int(xs[top][i]), int(ys[top][i]))            # ujung hidung pesawat
print("seed busur", arc_seed, "seed pesawat", plane_seed)

m = Image.fromarray((navy_core * 255).astype(np.uint8), "L").copy()  # salinan: gambar dari numpy bersifat baca-saja
ImageDraw.floodfill(m, arc_seed, 100)
ImageDraw.floodfill(m, plane_seed, 50)
# potongan kecil di ujung busur yang tipis bisa terputus: komponen biru
# yang seluruhnya berada di atas huruf ikut lapisan busur
work = m.copy()
while True:
    rest = np.asarray(work) == 255
    ys, xs = np.nonzero(rest)
    if not len(ys):
        break
    seed = (int(xs[0]), int(ys[0]))
    ImageDraw.floodfill(work, seed, 200)
    comp = (np.asarray(work) == 200)
    cy = np.nonzero(comp)[0]
    cx = np.nonzero(comp)[1]
    if cy.max() >= 140:
        target = 30                       # huruf
    elif cx.min() >= 1205:
        target = 50                       # serpihan sayap pesawat
    else:
        target = 100                      # ujung busur
    print("  komponen", seed, "piksel", int(comp.sum()), "->", {30: "huruf", 50: "pesawat", 100: "busur"}[target]) if target != 30 else None
    ImageDraw.floodfill(work, seed, target)
mm = np.asarray(work).copy()
mm[mm == 30] = 255
lab[mm == 255] = LETTERS
lab[mm == 100] = ARC
lab[mm == 50] = PLANE

# piksel tepi (semi transparan) ikut lapisan tetangga terdekat
vis = al > 0
for step in range(80):
    todo = vis & (lab == 0)
    if not todo.any():
        break
    grown = lab.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == dx == 0:
                continue
            shifted = np.roll(np.roll(lab, dy, 0), dx, 1)
            take = todo & (grown == 0) & (shifted > 0)
            grown[take] = shifted[take]
    lab = grown
left = vis & (lab == 0)
print("sisa tanpa label (derau latar, dibuang):", int(left.sum()), "alpha maks", int(al[left].max()) if left.any() else 0)

names = {TEXT: "text", LETTERS: "letters", ORANGE: "orange", GREEN: "green", ARC: "arc", PLANE: "plane"}
full = np.asarray(src)
stack = Image.new("RGBa", SIZE, (0, 0, 0, 0))
for key, name in names.items():
    layer = full.copy()
    layer[lab != key] = 0
    img = Image.fromarray(layer, "RGBA")
    ys, xs = np.nonzero(lab == key)
    print(f"{name:8s} piksel={len(ys):7d} kotak x {xs.min()}-{xs.max()} y {ys.min()}-{ys.max()}")
    small = img.convert("RGBa").resize(SIZE, Image.LANCZOS)
    stack = Image.alpha_composite(stack.convert("RGBA"), small.convert("RGBA")).convert("RGBa")
    small.convert("RGBA").save(OUT / f"logo-layer-{name}.webp", "WEBP", lossless=True, quality=100, method=6)

def on_white(im):
    white = Image.new("RGBA", im.size, (255, 255, 255, 255))
    return np.asarray(Image.alpha_composite(white, im.convert("RGBA")).convert("RGB")).astype(int)
ref = on_white(src.convert("RGBa").resize(SIZE, Image.LANCZOS).convert("RGBA"))
got = on_white(stack.convert("RGBA"))
d = np.abs(ref - got)
print("selisih di atas putih: maks", d.max(), " rata-rata", d.mean().round(4), " piksel >8:", int((d.max(axis=2) > 8).sum()))
yy, xx = np.nonzero(d.max(axis=2) > 8)
if len(yy):
    print("  lokasi selisih (x,y) contoh:", list(zip(xx[:: max(1, len(xx)//8)].tolist(), yy[:: max(1, len(yy)//8)].tolist())))
