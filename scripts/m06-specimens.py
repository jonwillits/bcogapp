#!/usr/bin/env python3
"""
The Lab 6 specimen pipeline: derive what the identification game shows from
the original photographs, by operations that only select, remove or recolor
existing pixels. Spec §5.3.

  python3 scripts/m06-specimens.py            # derive every view
  python3 scripts/m06-specimens.py --measure  # print each image's scale bar

Reads  public/m06/specimens/manifest.json  (the crop boxes and scale bars)
Writes public/m06/specimens/derived/<id>-<view>.png  (grayscale + alpha)
and rewrites the manifest's per-view `box` (tightened to the specimen) and
`sizePx` fields, which is what the true-scale view is computed from.

The originals are never altered. No generative editing of any kind: a crop,
a threshold, a flood fill from the specimen's center to pick out one
connected piece, and a conversion to grayscale. Nothing is redrawn.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / 'public' / 'm06' / 'specimens'
MANIFEST = DIR / 'manifest.json'
DERIVED = DIR / 'derived'


def background_mask(rgb: np.ndarray, kind: str) -> np.ndarray:
    """True where a pixel is background. CMBC composites sit on a uniform dark
    blue; the kiwi figure sits on white."""
    r = rgb[..., 0].astype(int)
    g = rgb[..., 1].astype(int)
    b = rgb[..., 2].astype(int)
    if kind == 'blue':
        # The blue stage: blue well above red, and dark. Sepia tissue has r >= b.
        return (b > r + 25) & (b > g + 10)
    if kind == 'white':
        return (r > 232) & (g > 232) & (b > 232)
    raise ValueError(kind)


def cut_out(img: Image.Image, box: list[int], stage: str):
    """Crop to the box, keep the one connected specimen the box centers on,
    and return (tight box in original coordinates, grayscale+alpha image)."""
    x0, y0, x1, y1 = box
    crop = img.convert('RGB').crop((x0, y0, x1, y1))
    rgb = np.asarray(crop)
    fg = ~background_mask(rgb, stage)
    # Close small gaps (glare on the tissue can read as background), then label.
    fg = ndimage.binary_closing(fg, iterations=2)
    fg = ndimage.binary_fill_holes(fg)
    labels, n = ndimage.label(fg)
    if n == 0:
        raise SystemExit(f'no specimen found in box {box}')
    # The largest component inside the box is the specimen.
    sizes = ndimage.sum(fg, labels, range(1, n + 1))
    keep = 1 + int(np.argmax(sizes))
    mask = labels == keep
    ys, xs = np.where(mask)
    pad = 3
    tx0, tx1 = max(0, xs.min() - pad), min(mask.shape[1], xs.max() + pad + 1)
    ty0, ty1 = max(0, ys.min() - pad), min(mask.shape[0], ys.max() + pad + 1)
    gray = np.asarray(crop.convert('L'))
    la = np.zeros((mask.shape[0], mask.shape[1], 2), dtype=np.uint8)
    la[..., 0] = gray
    la[..., 1] = np.where(mask, 255, 0)
    out = Image.fromarray(la[ty0:ty1, tx0:tx1], mode='LA')
    tight = [x0 + int(tx0), y0 + int(ty0), x0 + int(tx1), y0 + int(ty1)]
    return tight, out


def measure_bar(img: Image.Image, region: list[int], dark: bool = False) -> int:
    """The longest horizontal run of bar-colored pixels in the region: the scale bar's line.
    CMBC bars are white on the blue stage; the kiwi figure's is black on white."""
    x0, y0, x1, y1 = region
    rgb = np.asarray(img.convert('RGB').crop((x0, y0, x1, y1))).astype(int)
    if dark:
        bright = (rgb[..., 0] < 60) & (rgb[..., 1] < 60) & (rgb[..., 2] < 60)
    else:
        bright = (rgb[..., 0] > 200) & (rgb[..., 1] > 200) & (rgb[..., 2] > 200)
    best = 0
    for row in bright:
        run = 0
        for v in row:
            run = run + 1 if v else 0
            best = max(best, run)
    return best


def main(argv: list[str]) -> None:
    m = json.loads(MANIFEST.read_text())
    DERIVED.mkdir(exist_ok=True)
    measure_only = '--measure' in argv
    for sp in m['specimens']:
        img = Image.open(DIR / sp['file'])
        bar = sp.get('scaleBar')
        if bar and bar.get('region'):
            px = measure_bar(img, bar['region'], bool(bar.get('dark')))
            bar['px'] = px
            print(f"{sp['id']:12s} bar {bar['cm']} cm = {px} px  ({bar['cm'] / px:.4f} cm/px)")
        elif bar is None:
            print(f"{sp['id']:12s} no scale bar")
        if measure_only:
            continue
        for v in sp['views']:
            tight, out = cut_out(img, v['box'], sp['stage'])
            v['box'] = tight
            v['sizePx'] = [tight[2] - tight[0], tight[3] - tight[1]]
            # An opaque name: the game must not print a species name before the
            # reveal, and a file name reaches the DOM as the image's src.
            name = hashlib.sha1(f"{sp['id']}-{v['view']}".encode()).hexdigest()[:10]
            v['derived'] = f"derived/{name}.png"
            out.save(DERIVED / f"{name}.png", optimize=True)
            if bar and bar.get('px'):
                cm = v['sizePx'][0] * bar['cm'] / bar['px']
                print(f"  {sp['id']:12s} {v['view']:10s} {v['sizePx'][0]}x{v['sizePx'][1]} px  {cm:.1f} cm across")
    MANIFEST.write_text(json.dumps(m, indent=2, ensure_ascii=False) + '\n')


if __name__ == '__main__':
    main(sys.argv[1:])
