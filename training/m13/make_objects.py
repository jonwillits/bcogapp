"""
Part 3's 24 objects (spec §7.1): each a distinct, nameless shape with one
fill color and no face, eyes, limbs, or resemblance to an animal or a known
object. Drawn as SVG silhouettes built from a few simple parts (a circle,
a rectangle, a polygon, a star, a ring, a thick stroke), as Yu and Smith's
stimuli are, so that the shapes differ at a glance and color is not the
only cue (Jon, 2026-11-23: the lobed blobs of the first build looked too
alike; he picked these 24 from 71 candidates on the review page
`bcogapp_data/m13/review/shapes/`, whose numbers are kept beside each).
Objects 1 to 12 are the first set and 13 to 24 the reserve; each of the
twelve fills is used once in each set. No surface pattern, no outline.

  python -I make_objects.py <out_dir>
"""
import sys, os, json, math

# Twelve fills chosen to differ in hue and lightness on the dark theme.
FILLS = ["#e4572e", "#f3a712", "#a8c256", "#3d9970", "#2bb3c0", "#3f7fd9", "#7b5ea7", "#d64f9a", "#c0a080", "#8fa3b5", "#f0e68c", "#ff8c69"]
C = 50.0


def f(x):
    return f"{x:.1f}"


# ---- closed subpaths in a 100 x 100 box ----
def circle(cx, cy, r):
    return f"M {f(cx - r)} {f(cy)} a {f(r)} {f(r)} 0 1 0 {f(2 * r)} 0 a {f(r)} {f(r)} 0 1 0 {f(-2 * r)} 0 Z"


def ellipse(cx, cy, rx, ry):
    return f"M {f(cx - rx)} {f(cy)} a {f(rx)} {f(ry)} 0 1 0 {f(2 * rx)} 0 a {f(rx)} {f(ry)} 0 1 0 {f(-2 * rx)} 0 Z"


def poly(pts):
    return "M " + " L ".join(f"{f(x)} {f(y)}" for x, y in pts) + " Z"


def rect(x, y, w, h):
    return poly([(x, y), (x + w, y), (x + w, y + h), (x, y + h)])


def rot(pts, deg, cx=C, cy=C):
    a = math.radians(deg)
    return [(cx + (x - cx) * math.cos(a) - (y - cy) * math.sin(a), cy + (x - cx) * math.sin(a) + (y - cy) * math.cos(a)) for x, y in pts]


def star(cx, cy, r_out, r_in, n, start=-90):
    pts = []
    for i in range(2 * n):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(start + 180 * i / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def trapezoid(cx, y_top, w_top, w_bot, h):
    return [(cx - w_top / 2, y_top), (cx + w_top / 2, y_top), (cx + w_bot / 2, y_top + h), (cx - w_bot / 2, y_top + h)]


def arc_d(cx, cy, r, a0, a1):
    x0, y0 = cx + r * math.cos(math.radians(a0)), cy + r * math.sin(math.radians(a0))
    x1, y1 = cx + r * math.cos(math.radians(a1)), cy + r * math.sin(math.radians(a1))
    large = 1 if (a1 - a0) % 360 > 180 else 0
    return f"M {f(x0)} {f(y0)} A {f(r)} {f(r)} 0 {large} 1 {f(x1)} {f(y1)}"


# ---- elements: every part its own element, so overlaps paint over one another whatever their winding ----
def _d(sp):
    return poly(sp) if isinstance(sp, list) else sp


def fill(*subpaths):
    return "".join(f'<path d="{_d(s)}"/>' for s in subpaths)


def holed(outer, *holes):
    return f'<path fill-rule="evenodd" d="{_d(outer)} {" ".join(_d(h) for h in holes)}"/>'


def stroke(d, w, cap="round", join="round"):
    return f'<path d="{d}" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="{cap}" stroke-linejoin="{join}"/>'


def rotated(d, angles, cx=C, cy=C):
    return "".join(f'<path d="{d}" transform="rotate({a} {cx} {cy})"/>' for a in angles)


def blades(n, r_out=42, r_in=10, curve=0.55):
    d = f"M {f(C)} {f(C)} Q {f(C + r_out * curve)} {f(C - r_out * 0.9)} {f(C + r_out)} {f(C)} Q {f(C + r_out * 0.6)} {f(C + r_out * 0.35)} {f(C)} {f(C)} Z"
    return rotated(d, [360 * i / n for i in range(n)]) + fill(circle(C, C, r_in))


# ---- the 24, in Jon's order (review page number, name, drawing) ----
SHAPES = [
    (63, "ring around a square", holed(circle(50, 50, 46), circle(50, 50, 34)) + fill(rot([(32, 32), (68, 32), (68, 68), (32, 68)], 45))),
    (1, "oval on a pedestal", fill(ellipse(50, 36, 22, 28), rect(18, 62, 64, 26))),
    (5, "pinwheel, seven blades", blades(7, r_out=42, r_in=9, curve=0.4)),
    (11, "four-point star, wide", fill(star(50, 50, 44, 18, 4, start=-45))),
    (9, "block with two rings", holed(circle(24, 50, 14), circle(24, 50, 7)) + holed(circle(76, 50, 14), circle(76, 50, 7)) + fill(rect(36, 18, 28, 64))),
    (17, "hourglass", fill([(14, 10), (86, 10), (56, 50), (86, 90), (14, 90), (44, 50)])),
    (21, "ring with a bar", holed(circle(50, 50, 42), circle(50, 50, 26)) + fill(rect(8, 44, 84, 12))),
    (24, "two crossed ovals", rotated(ellipse(50, 50, 44, 14), (45, -45))),
    (27, "arch on a slab", fill([(14, 52), (86, 52), (86, 88), (14, 88)]) + '<path d="M 14 52 A 36 36 0 0 1 86 52 Z"/>'),
    (30, "stepped block", fill(rect(8, 70, 84, 20), rect(20, 46, 60, 24), rect(32, 22, 36, 24), rect(42, 8, 16, 14))),
    (35, "square with corner discs", fill(rect(24, 24, 52, 52), circle(22, 22, 13), circle(78, 22, 13), circle(22, 78, 13), circle(78, 78, 13))),
    (39, "comb", fill(rect(8, 10, 84, 30), *[rect(x, 40, 10, 50) for x in (8, 26, 44, 62, 80)])),
    (36, "disc with four spokes", fill(circle(50, 50, 20)) + rotated(rect(44, 4, 12, 30), (0, 90, 180, 270))),
    (44, "anvil", fill(trapezoid(50, 12, 80, 48, 30), rect(38, 42, 24, 28), rect(16, 70, 68, 18))),
    (50, "wave bar", stroke("M 8 58 C 22 20, 36 20, 50 58 S 78 96, 92 58", 14)),
    (56, "rounded block with three holes", holed("M 20 20 H 80 Q 94 20 94 34 V 66 Q 94 80 80 80 H 20 Q 6 80 6 66 V 34 Q 6 20 20 20 Z", circle(26, 50, 9), circle(50, 50, 9), circle(74, 50, 9))),
    (66, "lobed blob", '<path d="M 50 10 C 70 10, 88 22, 90 40 C 92 58, 78 60, 80 76 C 82 92, 60 92, 48 86 C 36 80, 14 86, 12 66 C 10 48, 24 44, 26 30 C 28 16, 36 10, 50 10 Z"/>'),
    (57, "fan", '<path d="M 50 90 L 8 44 A 60 60 0 0 1 92 44 Z"/>' + rotated(rect(46, 8, 8, 34), (-30, 0, 30), 50, 90)),
    (52, "horseshoe", stroke(arc_d(50, 46, 34, 150, 390), 16)),
    (18, "teardrop", fill([(50, 6), (80, 60), (20, 60)], circle(50, 64, 30))),
    (19, "gear", fill(circle(50, 50, 30)) + rotated(rect(44, 6, 12, 20), range(0, 360, 45))),
    (32, "oval with three bumps", fill(ellipse(50, 58, 40, 24), circle(26, 36, 11), circle(50, 30, 11), circle(74, 36, 11))),
    (41, "two linked rings", holed(circle(36, 50, 30), circle(36, 50, 18)) + holed(circle(64, 50, 30), circle(64, 50, 18))),
    (6, "disc with four lobes", fill(circle(50, 50, 24), ellipse(50, 16, 9, 14), ellipse(50, 84, 9, 14), ellipse(16, 50, 14, 9), ellipse(84, 50, 14, 9))),
]
assert len(SHAPES) == 24 and len({n for n, _, _ in SHAPES}) == 24


def svg_of(inner, color):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" color="{color}" fill="currentColor">{inner}</svg>'


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for old in os.listdir(out):
        if old.endswith(".svg") or old.endswith(".json"):
            os.remove(os.path.join(out, old))
    meta = []
    for i, (review_no, name, inner) in enumerate(SHAPES):
        fill_color = FILLS[i % 12]
        m = {"id": f"object{i + 1:02d}", "set": 0 if i < 12 else 1, "fill": fill_color, "shape": name, "reviewNo": review_no}
        open(os.path.join(out, f"{m['id']}.svg"), "w").write(svg_of(inner, fill_color))
        meta.append(m)
    json.dump(meta, open(os.path.join(out, "objects.json"), "w"), indent=1)
    # A contact sheet of all 24, for the review.
    cells = "".join(f'<g transform="translate({(i % 6) * 110},{(i // 6) * 110})"><use href="#o{i}"/></g>' for i in range(24))
    defs = "".join(open(os.path.join(out, f"object{i + 1:02d}.svg")).read().replace("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" width=\"100\" height=\"100\"", f"<symbol id=\"o{i}\" viewBox=\"0 0 100 100\" width=\"100\" height=\"100\"").replace("</svg>", "</symbol>") for i in range(24))
    open(os.path.join(out, "sheet.svg"), "w").write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 440" width="660" height="440" style="background:#0e1420"><defs>{defs}</defs>{cells}</svg>')
    print("wrote 24 objects and sheet.svg")
