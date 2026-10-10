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

# (display id, strokes that form the part, dx, dy in the 256 space, what moved where)
MOVED = [
    ("d04", [2], -95, -120, "the handle, onto the top of the cup"),
    ("d08", [1], -100, -95, "the handle, onto the top of the cup"),
    ("d17", [3, 4], -110, -110, "the handle, onto the top of the cup"),
    ("d18", [0], 0, 200, "the cap, under the stem"),
    ("d25", [0], 0, 190, "the cap, under the stem"),
    ("d43", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0, 210, "the scoop, under the cone"),
    ("d15", [1], 0, -220, "the handle, above the canopy"),
    ("d13", [1, 2], 0, 240, "the head, under the body"),
    ("d46", [0], 0, 230, "the shade, under the base"),
    ("d63", [0], 0, 240, "the bowl, under the base"),
]

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
    for did, part, dx, dy, what in MOVED:
        d = by_id[did]
        moved = move_part(d["strokes"], part, dx, dy)
        t0, p0, a0 = run(d["strokes"])
        t1, p1, a1 = run(moved)
        # Two ordinary drawings of the same category: this one and another display drawing of its category.
        other = next(x for x in display if x["category"] == d["category"] and x["id"] != did)
        _, _, a2 = run(other["strokes"])
        pairs.append({"id": did, "category": d["category"], "part": part, "dx": dx, "dy": dy, "what": what, "original": d["strokes"], "moved": moved, "otherId": other["id"]})
        results.append({"id": did, "category": d["category"], "what": what,
                        "originalLabel": SCREEN_NAMES_24[t0], "originalP": p0, "movedLabel": SCREEN_NAMES_24[t1], "movedP": p1,
                        "matchMoved": corr(a0, a1), "matchOrdinary": corr(a0, a2), "labelChanged": t0 != t1})
        print(f"{did} {d['category']:11s} {what:40s} {SCREEN_NAMES_24[t0]} {p0:.2f} → {SCREEN_NAMES_24[t1]} {p1:.2f}   match moved {corr(a0, a1):.2f}  ordinary pair {corr(a0, a2):.2f}")
    json.dump({"pairs": pairs}, open(os.path.join(public_dir, "drawings", "moved.json"), "w"))
    json.dump({"pairs": results, "labelChanged": sum(r["labelChanged"] for r in results), "n": len(results)}, open(out, "w"), indent=1)

if __name__ == "__main__":
    main(*sys.argv[1:4])
