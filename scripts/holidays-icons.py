"""Draw the Magical Holidays brand mark (Santa hat) and derive every app icon from it.

Same visual language as the Magical Birthday Planner mark (docs/brand/MBP-1024.png): warm cream tile, one thick
dark outline, flat fills, a tilted hat and a sparkle. Here the hat is a Santa hat: festive red, white fur brim and
pom-pom, gold sparkle.

    python3 scripts/holidays-icons.py

Outputs: docs/brand/MH-1024.png (master) and public/brands/holidays/{favicon.ico,favicon.png,icons/*}.
"""
import os
from PIL import Image, ImageDraw, ImageFilter

S = 2048  # drawing canvas; downsampled for anti-aliasing
CREAM = (254, 249, 241)
INK = (122, 14, 28)        # outline: deep cranberry
RED = (214, 38, 52)        # hat
FUR = (255, 255, 255)
FUR_SHADE = (236, 230, 222)
GOLD = (233, 172, 38)
LW = 64                    # outline width at S


def bez(p0, p1, p2, n=40):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in (i / n for i in range(n + 1))]


def shape(d, pts, fill):
    d.polygon(pts, fill=INK)
    d.line(pts + [pts[0]], fill=INK, width=LW * 2, joint='curve')
    for x, y in pts[:: max(1, len(pts) // 200)]:
        d.ellipse([x - LW, y - LW, x + LW, y + LW], fill=INK)
    d.polygon(pts, fill=fill)


def blob(d, cx, cy, r, fill):
    d.ellipse([cx - r - LW, cy - r - LW, cx + r + LW, cy + r + LW], fill=INK)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)


def sparkle(d, cx, cy, r, fill):
    pts = []
    for p0, p1, p2 in [((cx, cy - r), (cx, cy), (cx + r, cy)), ((cx + r, cy), (cx, cy), (cx, cy + r)),
                       ((cx, cy + r), (cx, cy), (cx - r, cy)), ((cx - r, cy), (cx, cy), (cx, cy - r))]:
        pts += bez((p0[0], p0[1]), ((p0[0] + p2[0]) / 2 * 0.25 + cx * 0.75, (p0[1] + p2[1]) / 2 * 0.25 + cy * 0.75), p2, 20)
    d.polygon(pts, fill=fill)


def draw(bg=CREAM, scale=1.0):
    im = Image.new('RGB', (S, S), bg)
    d = ImageDraw.Draw(im)

    def T(p):  # scale about the centre (for maskable safe zone)
        return ((p[0] - S / 2) * scale + S / 2, (p[1] - S / 2) * scale + S / 2)

    # Hat body: wide base on the brim, rising to a peak that flops over to the right.
    left = bez((520, 1430), (640, 760), (1130, 470))
    top = bez((1130, 470), (1560, 330), (1690, 900))
    under = bez((1690, 900), (1560, 960), (1420, 820))
    right = bez((1420, 820), (1500, 1100), (1560, 1430))
    body = [T(p) for p in left + top[1:] + under[1:] + right[1:]]
    shape(d, body, RED)
    # Crease where the tip flops over.
    d.line([T(p) for p in bez((1290, 640), (1500, 600), (1690, 900))], fill=INK, width=int(LW * 1.2 * scale), joint='curve')

    # Fur brim: a soft band with rounded ends, slightly arched.
    top_edge = bez((420, 1400), (1040, 1290), (1660, 1400))
    bot_edge = bez((1660, 1660), (1040, 1560), (420, 1660))
    rcap = bez((1660, 1400), (1800, 1530), (1660, 1660))
    lcap = bez((420, 1660), (280, 1530), (420, 1400))
    brim = [T(p) for p in top_edge + rcap[1:] + bot_edge[1:] + lcap[1:-1]]
    shape(d, brim, FUR)
    d.line([T(p) for p in bez((470, 1600), (1040, 1510), (1610, 1600))], fill=FUR_SHADE, width=int(46 * scale), joint='curve')

    # Pom-pom on the tip.
    px, py = T((1680, 950))
    blob(d, px, py, 160 * scale, FUR)
    d.ellipse([px - 60 * scale, py + 30 * scale, px + 90 * scale, py + 120 * scale], fill=FUR_SHADE)

    # Gold sparkle + dots (echo of the birthday mark).
    sx, sy = T((520, 520))
    sparkle(d, sx, sy, 170 * scale, GOLD)
    for (x, y, r) in [(330, 820, 42), (760, 300, 38), (420, 1100, 30)]:
        cx, cy = T((x, y))
        d.ellipse([cx - r * scale, cy - r * scale, cx + r * scale, cy + r * scale], fill=GOLD)
    return im


def main():
    os.makedirs('docs/brand', exist_ok=True)
    out = 'public/brands/holidays'
    os.makedirs(f'{out}/icons', exist_ok=True)
    R = Image.LANCZOS
    master = draw().resize((1024, 1024), R)
    master.save('docs/brand/MH-1024.png', optimize=True)
    for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
        master.resize((size, size), R).save(f'{out}/icons/{name}', optimize=True)
    # Maskable: full-bleed cream tile, mark shrunk into the 80% safe zone.
    draw(bg=CREAM, scale=0.72).resize((512, 512), R).save(f'{out}/icons/maskable-512.png', optimize=True)
    # Notification badge: white silhouette on transparent (Android tints it).
    sil = draw(bg=(0, 0, 0)).convert('L').point(lambda v: 255 if v > 20 else 0).resize((96, 96), R)
    badge = Image.new('RGBA', (96, 96), (255, 255, 255, 0))
    badge.putalpha(sil)
    badge.save(f'{out}/icons/badge-96.png', optimize=True)
    master.resize((64, 64), R).save(f'{out}/favicon.png', optimize=True)
    master.save(f'{out}/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == '__main__':
    main()
