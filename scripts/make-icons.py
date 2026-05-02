#!/usr/bin/env python3
"""Generate the Voice Memo PWA icons.

Waveform symbol — strong black bars on a warm cream square, e-ink friendly.
Produces icon-192/512/maskable, apple-touch-icon, favicon into ../images/.
Safe to re-run.
"""
from PIL import Image, ImageDraw
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / "images"
OUT.mkdir(parents=True, exist_ok=True)

CREAM = (248, 245, 238, 255)   # #F8F5EE — matches app bg
INK = (0, 0, 0, 255)           # strong black bars
ACCENT = (185, 28, 28, 255)    # #B91C1C — small red dot for "record"

# Bar heights as fraction of icon size (centered vertically)
# Symmetric, dynamic shape that reads as a waveform / sound levels
BAR_HEIGHTS = [0.28, 0.50, 0.72, 0.90, 0.72, 0.50, 0.28]


def rounded_square(size, corner_ratio=0.22, fill=CREAM):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = int(size * corner_ratio)
    d.rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=fill)
    return img


def draw_waveform(img, safe_inset=0.0, with_dot=True):
    """Paint waveform bars centered. safe_inset shrinks toward center for maskable."""
    size = img.size[0]
    inset = int(size * safe_inset)
    inner = size - inset * 2
    cx = size / 2
    cy = size / 2

    n = len(BAR_HEIGHTS)
    # Bars span 70% of the inner width
    span = inner * 0.70
    bar_w = span / (n * 1.6)        # width of each bar
    gap = (span - bar_w * n) / (n - 1)
    total_w = bar_w * n + gap * (n - 1)
    x0 = cx - total_w / 2

    d = ImageDraw.Draw(img)
    radius = bar_w / 2
    for i, frac in enumerate(BAR_HEIGHTS):
        x = x0 + i * (bar_w + gap)
        bh = inner * frac * 0.55     # max bar height = ~55% of inner
        y = cy - bh / 2
        d.rounded_rectangle((x, y, x + bar_w, y + bh), radius=radius, fill=INK)

    # Subtle red dot — recording indicator — top-right of the wave cluster
    if with_dot:
        dot_r = max(int(size * 0.045), 3)
        # position relative to top-right of waveform area
        dx = x0 + total_w + dot_r * 1.5
        dy = cy - inner * 0.30
        # if it would go off-edge (maskable), tuck inside
        if dx + dot_r > size - inset - 2:
            dx = x0 + total_w - dot_r * 1.2
            dy = cy - inner * 0.30 - dot_r
        d.ellipse((dx - dot_r, dy - dot_r, dx + dot_r, dy + dot_r), fill=ACCENT)


def make_icon(size, corner_ratio=0.22, with_dot=True):
    img = rounded_square(size, corner_ratio=corner_ratio, fill=CREAM)
    draw_waveform(img, safe_inset=0.0, with_dot=with_dot)
    return img


def make_maskable(size):
    # Maskable icons: full-bleed background, art within central 80%.
    img = Image.new("RGBA", (size, size), CREAM)
    draw_waveform(img, safe_inset=0.10, with_dot=True)
    return img


def make_favicon(size=64):
    img = rounded_square(size, corner_ratio=0.18, fill=CREAM)
    # simpler 5-bar waveform for tiny size
    global BAR_HEIGHTS
    saved = BAR_HEIGHTS
    BAR_HEIGHTS = [0.40, 0.70, 0.95, 0.70, 0.40]
    draw_waveform(img, safe_inset=0.0, with_dot=False)
    BAR_HEIGHTS = saved
    return img


def main():
    make_icon(192).save(OUT / "icon-192.png")
    make_icon(512).save(OUT / "icon-512.png")
    make_icon(180, corner_ratio=0.22).save(OUT / "apple-touch-icon.png")
    make_maskable(512).save(OUT / "icon-maskable.png")
    make_favicon(64).save(OUT / "favicon.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
