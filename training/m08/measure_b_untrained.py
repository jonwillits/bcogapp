"""Version B on changes it was not trained on: a mirror image, and a 2:1 stretch (and a squash). Reports accuracy for A and B on each, over 200 held-out drawings.

Usage: python -I measure_b_untrained.py <models_dir> <data_dir> <out_json>
"""
import sys, os, json
import numpy as np
import torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawing_net import DrawingNet
from categories import SCREEN_NAMES_24
from raster import normalize, rasterize, transform, SIZE

def stretch(strokes, sx, sy, cx=127.5, cy=127.5):
    return [[[(x - cx) * sx + cx for x in s[0]], [(y - cy) * sy + cy for y in s[1]]] for s in strokes]

def mirror(strokes):
    return [[[255.0 - x for x in s[0]], list(s[1])] for s in strokes]

def main(models_dir, data_dir, out):
    vectors = json.load(open(os.path.join(data_dir, "test_vectors.json")))
    rng = np.random.default_rng(0)
    sample = [vectors[i] for i in rng.choice(len(vectors), 200, replace=False)]
    changes = {
        "intact": lambda s: s,
        "mirror": mirror,
        "turn180": lambda s: transform(s, angle_deg=180),
        "stretchWide": lambda s: stretch(s, 1.0, 0.5),
        "stretchTall": lambda s: stretch(s, 0.5, 1.0),
        "shrink40InCorner": lambda s: transform(s, scale=0.4, dx=-70, dy=-70),
    }
    results = {}
    for tag in ["a", "b"]:
        m = DrawingNet(len(SCREEN_NAMES_24)); m.load_state_dict(torch.load(os.path.join(models_dir, f"drawing_{tag}.pt"), map_location="cpu")); m.eval()
        results[tag] = {}
        for name, f in changes.items():
            correct = 0
            with torch.no_grad():
                for v in sample:
                    x = torch.tensor(rasterize(f(normalize(v["strokes"]))), dtype=torch.float32).reshape(1, 1, SIZE, SIZE)
                    correct += int(m(x).argmax()) == v["label"]
            results[tag][name] = correct / len(sample)
        print(tag, {k: round(v, 3) for k, v in results[tag].items()})
    json.dump(results, open(out, "w"), indent=1)

if __name__ == "__main__":
    main(*sys.argv[1:4])
