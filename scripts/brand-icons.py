"""Regenerate every app icon from the brand mark.

The only source we have is docs/brand/MBP.png (96 px). Step 1 redraws it at 1024 px as flat colour regions
(cream, outline, hat fill, brim fill) with smooth edges, instead of blurry interpolation. Step 2 derives the
favicon, PWA, Apple and notification icons from that master.

    python3 scripts/brand-icons.py
"""
import numpy as np
from PIL import Image, ImageFilter

SRC, MASTER = 'docs/brand/MBP.png', 'docs/brand/MBP-1024.png'
C = np.array([[254, 249, 241], [105, 16, 200], [164, 91, 243], [137, 47, 227]], float)  # cream, outline, hat fill, brim fill


def near(mask):
    out = np.zeros_like(mask)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def redraw():
    src = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
    H = src.shape[0]
    bg, ol = C[0], C[1]
    d = ((src[..., None, :] - C[None, None]) ** 2).sum(-1)
    lab = d.argmin(-1)
    # Ink coverage: anti-aliased outer edges are blends of exactly cream and outline.
    v = ol - bg
    ink = np.clip(((src - bg) @ v) / (v @ v), 0, 1)
    nearbg = near(lab == 0)
    ink[~nearbg & (lab != 0)] = 1
    # Inside the ink, soft membership among the three purples.
    w = np.exp(-d[..., 1:] / 300.0)
    w /= w.sum(-1, keepdims=True)
    w[nearbg] = [1, 0, 0]  # fills never touch the background: edge pixels are outline
    # Outline↔hat-fill blends look like brim colour; next to hat fill, brim isn't possible.
    fix = near(lab == 2) & (lab == 3)
    t = np.clip(((src - ol) @ (C[2] - ol)) / ((C[2] - ol) @ (C[2] - ol)), 0, 1)
    w[fix] = np.stack([1 - t[fix], t[fix], np.zeros(fix.sum())], -1)

    S = 2048
    r = S / H

    def up(x, blur):
        im = Image.fromarray((np.clip(x, 0, 1) * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC)
        return np.asarray(im.filter(ImageFilter.GaussianBlur(r * blur)), float) / 255

    inside = up(ink, 0.7) > 0.5
    region = np.stack([up(w[..., k], 0.8) for k in range(3)], -1).argmax(-1) + 1
    labels = np.where(inside, region, 0)
    master = Image.fromarray(np.round(C).astype(np.uint8)[labels]).resize((1024, 1024), Image.LANCZOS)
    master.save(MASTER, optimize=True)
    return master


def icons(master):
    R = Image.LANCZOS
    size = lambda n: master.resize((n, n), R)
    size(192).save('public/icons/icon-192.png', optimize=True)
    size(512).save('public/icons/icon-512.png', optimize=True)
    size(180).save('public/icons/apple-touch-icon.png', optimize=True)
    size(512).save('public/favicon.png', optimize=True)
    master.save('public/favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    # Maskable: artwork inside the 80% safe zone on the tile colour.
    m = Image.new('RGB', (512, 512), tuple(int(c) for c in C[0]))
    m.paste(master.resize((410, 410), R), (51, 51))
    m.save('public/icons/maskable-512.png', optimize=True)
    # Notification badge: white silhouette on transparent (Android uses alpha only).
    a = np.asarray(master.convert('RGB'), float)
    alpha = np.clip((C[0].sum() - a.sum(-1)) * 255 / (C[0].sum() - C[1].sum()), 0, 255).astype(np.uint8)
    badge = Image.new('RGBA', (1024, 1024), (255, 255, 255, 255))
    badge.putalpha(Image.fromarray(alpha))
    badge.resize((96, 96), R).save('public/icons/badge-96.png', optimize=True)


if __name__ == '__main__':
    icons(redraw())
