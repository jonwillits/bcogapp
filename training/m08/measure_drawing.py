"""
Part 1's measurements on the drawing network (spec §11): over held-out
drawings, the match (Pearson correlation) between each layer's activity for
the original and for a shifted or turned copy; accuracy under each change;
and accuracy with *Center and scale* off for drawings shrunk to 40% and put
in a corner. Written to <out_json>.

Usage: python -I measure_drawing.py <model.pt> <data_dir> <out_json> [n]
"""
import sys, os, json
import numpy as np
import torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawing_net import DrawingNet
from categories import SCREEN_NAMES_24
from raster import normalize, rasterize, transform, SIZE, SCALE

SHIFTS = [0, 2, 4, 6, 8]
TURNS = [45, 90, 180]

def corr(a, b):
    a = a - a.mean(); b = b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d > 0 else 0.0

def main(pt, data_dir, out, n=200):
    model = DrawingNet(len(SCREEN_NAMES_24))
    model.load_state_dict(torch.load(pt, map_location="cpu"))
    model.eval()
    vectors = json.load(open(os.path.join(data_dir, "test_vectors.json")))
    rng = np.random.default_rng(0)
    idx = rng.choice(len(vectors), size=n, replace=False)
    sample = [vectors[i] for i in idx]
    layer_names = ["input"] + [f"pooled {i+1}" for i in range(4)]
    def run(strokes):
        x = torch.tensor(rasterize(strokes), dtype=torch.float32).reshape(1, 1, SIZE, SIZE)
        with torch.no_grad():
            logits, layers = model(x, return_layers=True)
        acts = [x.flatten().numpy()] + [l.flatten().numpy() for l in layers]
        return acts, int(logits.argmax())
    results = {"n": n, "layers": layer_names, "shift": {}, "turn": {}, "centered": {}}
    base = [run(normalize(v["strokes"])) for v in sample]
    acc0 = np.mean([b[1] == v["label"] for b, v in zip(base, sample)])
    results["accuracyCentered"] = float(acc0)
    for px in SHIFTS:
        matches = [[] for _ in layer_names]; correct = 0
        for v, (acts0, _) in zip(sample, base):
            acts, top = run(transform(normalize(v["strokes"]), dx=px / SCALE))
            for L in range(len(layer_names)): matches[L].append(corr(acts0[L], acts[L]))
            correct += top == v["label"]
        results["shift"][str(px)] = {"match": [float(np.mean(m)) for m in matches], "accuracy": correct / n}
        print("shift", px, [round(float(np.mean(m)), 3) for m in matches], round(correct / n, 3), flush=True)
    for deg in TURNS:
        matches = [[] for _ in layer_names]; correct = 0
        for v, (acts0, _) in zip(sample, base):
            acts, top = run(transform(normalize(v["strokes"]), angle_deg=deg))
            for L in range(len(layer_names)): matches[L].append(corr(acts0[L], acts[L]))
            correct += top == v["label"]
        results["turn"][str(deg)] = {"match": [float(np.mean(m)) for m in matches], "accuracy": correct / n}
        print("turn", deg, [round(float(np.mean(m)), 3) for m in matches], round(correct / n, 3), flush=True)
    # Center and scale off: the drawing at 40% of its size, in a corner.
    correct = 0
    for v in sample:
        _, top = run(transform(normalize(v["strokes"]), scale=0.4, dx=-70, dy=-70))
        correct += top == v["label"]
    results["centered"]["smallInCorner"] = correct / n
    # And just shrunk, centered: how much of the loss is size and how much is position.
    correct = 0
    for v in sample:
        _, top = run(transform(normalize(v["strokes"]), scale=0.4))
        correct += top == v["label"]
    results["centered"]["smallCentered"] = correct / n
    correct = 0
    for v in sample:
        _, top = run(transform(normalize(v["strokes"]), scale=0.7))
        correct += top == v["label"]
    results["centered"]["seventyPercent"] = correct / n
    # Raw, un-normalized strokes as a student would draw them on the pad (already 0..255 but not aligned): how the dataset's own alignment matters.
    correct = 0
    for v in sample:
        _, top = run(v["strokes"])
        correct += top == v["label"]
    results["centered"]["rawUnaligned"] = correct / n
    print("centered", results["centered"], "acc centered", acc0)
    json.dump(results, open(out, "w"), indent=1)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 200)
