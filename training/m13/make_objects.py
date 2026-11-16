"""
Part 3's 24 objects (spec §7.1): each a distinct, nameless shape, a solid
form with a distinctive outline, one fill color, and one surface pattern,
with no face, eyes, limbs, or resemblance to an animal or a known object.
Drawn as SVG from a fixed seed, 12 for the first set and 12 for the
reserve. The outline is a smooth closed curve made from a few low
harmonics around a circle, so that no two are alike and none is a known
shape; the pattern is one of six, clipped to the outline.

  python -I make_objects.py <out_dir>
"""
import sys, os, json, math
import numpy as np

# Twelve fills chosen to differ in hue and lightness on the dark theme; each used twice, once per set, with a different pattern and outline.
FILLS = ["#e4572e", "#f3a712", "#a8c256", "#3d9970", "#2bb3c0", "#3f7fd9", "#7b5ea7", "#d64f9a", "#c0a080", "#8fa3b5", "#f0e68c", "#ff8c69"]
PATTERNS = ["stripes", "dots", "rings", "checks", "waves", "crosshatch"]


def outline(rng, n_pts=240):
    k = rng.integers(3, 7)  # how many lobes
    a1 = rng.uniform(0.12, 0.28)
    k2 = rng.integers(2, 5)
    a2 = rng.uniform(0.04, 0.12)
    ph1, ph2 = rng.uniform(0, 2 * math.pi, 2)
    pts = []
    for i in range(n_pts):
        th = 2 * math.pi * i / n_pts
        r = 1 + a1 * math.cos(k * th + ph1) + a2 * math.sin(k2 * th + ph2)
        pts.append((50 + 40 * r * math.cos(th), 50 + 40 * r * math.sin(th)))
    return pts


def path_of(pts):
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"


def pattern_svg(name, pid, color):
    dark = "#1b1b1b"
    if name == "stripes":
        return f'<pattern id="{pid}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="8" height="8" fill="{color}"/><rect width="3" height="8" fill="{dark}" opacity="0.55"/></pattern>'
    if name == "dots":
        return f'<pattern id="{pid}" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="{color}"/><circle cx="4.5" cy="4.5" r="2" fill="{dark}" opacity="0.6"/></pattern>'
    if name == "rings":
        return f'<pattern id="{pid}" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="{color}"/><circle cx="7" cy="7" r="5" fill="none" stroke="{dark}" stroke-width="1.6" opacity="0.6"/></pattern>'
    if name == "checks":
        return f'<pattern id="{pid}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="{color}"/><rect width="5" height="5" fill="{dark}" opacity="0.5"/><rect x="5" y="5" width="5" height="5" fill="{dark}" opacity="0.5"/></pattern>'
    if name == "waves":
        return f'<pattern id="{pid}" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="{color}"/><path d="M0 4 Q3 0 6 4 T12 4" fill="none" stroke="{dark}" stroke-width="1.4" opacity="0.6"/></pattern>'
    return f'<pattern id="{pid}" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="{color}"/><path d="M0 0 L8 8 M8 0 L0 8" stroke="{dark}" stroke-width="1" opacity="0.5"/></pattern>'


def make(i, rng):
    fill = FILLS[i % 12]
    pattern = PATTERNS[(i * 5 + i // 12) % 6]
    pts = outline(rng)
    pid = f"p{i}"
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">'
        f"<defs>{pattern_svg(pattern, pid, fill)}</defs>"
        f'<path d="{path_of(pts)}" fill="url(#{pid})" stroke="#f4f4f4" stroke-width="2.2" stroke-linejoin="round"/>'
        "</svg>"
    )
    return svg, {"id": f"object{i + 1:02d}", "set": 0 if i < 12 else 1, "fill": fill, "pattern": pattern}


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    rng = np.random.default_rng(13)
    meta = []
    for i in range(24):
        svg, m = make(i, rng)
        open(os.path.join(out, f"{m['id']}.svg"), "w").write(svg)
        meta.append(m)
    json.dump(meta, open(os.path.join(out, "objects.json"), "w"), indent=1)
    # A contact sheet of all 24, for the review.
    cells = "".join(f'<g transform="translate({(i % 6) * 110},{(i // 6) * 110})"><use href="#o{i}"/></g>' for i in range(24))
    defs = "".join(open(os.path.join(out, f"object{i + 1:02d}.svg")).read().replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">', f'<symbol id="o{i}" viewBox="0 0 100 100" width="100" height="100">').replace("</svg>", "</symbol>") for i in range(24))
    open(os.path.join(out, "sheet.svg"), "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 440" width="660" height="440" style="background:#0e1420"><defs>{defs}</defs>{cells}</svg>')
    print("wrote 24 objects and sheet.svg")
