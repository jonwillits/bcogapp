"""
The built set of moved-part pairs (spec §6.2, Step 4, cuttable): display
drawings with one hand-labeled stroke group moved so that the part sits
where the object would not have it (the cap under the stem, the scoop under
the cone, the handle on top). The labels were made by looking at the
display drawings with their strokes numbered. Writes
public/m08/drawings/moved.json, and measures, for the drawing network, the
label and probability for each version and the match between the last
pooled layer's activity for the two, set beside the match between two
ordinary display drawings of the same category.

Usage: python -I moved_parts.py <drawing_a.pt> <public_m08_dir> <out_json>
"""
import sys, os, json
import numpy as np
import torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawing_net import DrawingNet
from categories import SCREEN_NAMES_24
from raster import normalize, rasterize, SIZE
from erasers import move_part

# (display id, strokes that form the part, where the part goes, what moved where).
# The part is placed just on the other side of the rest of the drawing, so the
# moved version has about the same bounding box as the original and the
# dataset's centering and scaling leave its size about the same. A first
# version shoved the part 200 units away, and the moved version came out at
# half the size, which was a second change on top of the move (Jon, 2026-10-12).
MOVED = [
    ("d04", [2], "above", "the handle, onto the top of the cup"),
    ("d08", [1], "above", "the handle, onto the top of the cup"),
    ("d17", [3, 4], "above", "the handle, onto the top of the cup"),
    ("d18", [0], "below", "the cap, under the stem"),
    ("d25", [0], "below", "the cap, under the stem"),
    ("d43", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "below", "the scoop, under the cone"),
    ("d15", [1], "above", "the handle, above the canopy"),
    ("d13", [1, 2], "below", "the head, under the body"),
    ("d46", [0], "below", "the shade, under the base"),
    ("d63", [0], "below", "the bowl, under the base"),
]

def bounds_of(strokes):
    xs = [x for s in strokes for x in s[0]]
    ys = [y for s in strokes for y in s[1]]
    return min(xs), min(ys), max(xs), max(ys)

def placement(strokes, part, where, gap=4.0):
    """The shift that puts the part's box just above or below the rest's box, centered over it."""
    part_strokes = [s for i, s in enumerate(strokes) if i in part]
    rest = [s for i, s in enumerate(strokes) if i not in part]
    px0, py0, px1, py1 = bounds_of(part_strokes)
    rx0, ry0, rx1, ry1 = bounds_of(rest)
    dx = (rx0 + rx1) / 2 - (px0 + px1) / 2
    dy = (ry1 + gap) - py0 if where == "below" else (ry0 - gap) - py1
    return dx, dy

def corr(a, b):
    a = a - a.mean(); b = b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d > 0 else 0.0

def main(pt, public_dir, out):
    model = DrawingNet(len(SCREEN_NAMES_24))
    model.load_state_dict(torch.load(pt, map_location="cpu"))
    model.eval()
    display = json.load(open(os.path.join(public_dir, "drawings", "display.json")))["drawings"]
    by_id = {d["id"]: d for d in display}
    def run(strokes):
        x = torch.tensor(rasterize(normalize(strokes)), dtype=torch.float32).reshape(1, 1, SIZE, SIZE)
        with torch.no_grad():
            logits, layers = model(x, return_layers=True)
        p = torch.softmax(logits, 1)[0]
        return int(p.argmax()), float(p.max()), layers[-1].flatten().numpy()
    pairs = []
    results = []
    for did, part, where, what in MOVED:
        d = by_id[did]
        dx, dy = placement(d["strokes"], part, where)
        moved = move_part(d["strokes"], part, dx, dy)
        t0, p0, a0 = run(d["strokes"])
        t1, p1, a1 = run(moved)
        # Two ordinary drawings of the same category: this one and another display drawing of its category.
        other = next(x for x in display if x["category"] == d["category"] and x["id"] != did)
        _, _, a2 = run(other["strokes"])
        x0, y0, x1, y1 = bounds_of(d["strokes"]); mx0, my0, mx1, my1 = bounds_of(moved)
        size_ratio = max(mx1 - mx0, my1 - my0) / max(x1 - x0, y1 - y0)
        pairs.append({"id": did, "category": d["category"], "part": part, "dx": dx, "dy": dy, "where": where, "what": what, "original": d["strokes"], "moved": moved, "otherId": other["id"], "sizeRatio": size_ratio})
        results.append({"id": did, "category": d["category"], "what": what, "sizeRatio": size_ratio,
                        "originalLabel": SCREEN_NAMES_24[t0], "originalP": p0, "movedLabel": SCREEN_NAMES_24[t1], "movedP": p1,
                        "matchMoved": corr(a0, a1), "matchOrdinary": corr(a0, a2), "labelChanged": t0 != t1})
        print(f"{did} {d['category']:11s} {what:40s} size ×{size_ratio:.2f}  {SCREEN_NAMES_24[t0]} {p0:.2f} → {SCREEN_NAMES_24[t1]} {p1:.2f}   match moved {corr(a0, a1):.2f}  ordinary pair {corr(a0, a2):.2f}")
    json.dump({"pairs": pairs}, open(os.path.join(public_dir, "drawings", "moved.json"), "w"))
    json.dump({"pairs": results, "labelChanged": sum(r["labelChanged"] for r in results), "n": len(results)}, open(out, "w"), indent=1)

if __name__ == "__main__":
    main(*sys.argv[1:4])
