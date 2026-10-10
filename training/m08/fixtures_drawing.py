"""Agreement fixtures for the drawing network: 50 held-out drawings (strokes) and Python's probabilities for each, plus every layer's activity on the first few, for the layer strip test.

Usage: python -I fixtures_drawing.py <drawing_a.pt> <data_dir> <out_json> [--augment-model]
"""
import sys, os, json
import numpy as np
import torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawing_net import DrawingNet
from categories import SCREEN_NAMES_24
from raster import normalize, rasterize

def main(pt, data_dir, out):
    model = DrawingNet(len(SCREEN_NAMES_24))
    model.load_state_dict(torch.load(pt, map_location="cpu"))
    model.eval()
    vectors = json.load(open(os.path.join(data_dir, "test_vectors.json")))
    # Two per category, in label order, so every label appears.
    chosen = []
    seen = {}
    for v in vectors:
        if seen.get(v["label"], 0) < 2 and len(chosen) < 50:
            chosen.append(v); seen[v["label"]] = seen.get(v["label"], 0) + 1
    chosen = chosen[:50]
    cases = []
    with torch.no_grad():
        for i, v in enumerate(chosen):
            x = torch.tensor(rasterize(normalize(v["strokes"])), dtype=torch.float32).reshape(1, 1, 64, 64)
            logits, layers = model(x, return_layers=True)
            probs = torch.softmax(logits, 1)[0].tolist()
            case = {"category": v["category"], "strokes": v["strokes"], "probs": probs, "top": int(np.argmax(probs))}
            if i < 3:
                case["layers"] = [l[0].flatten().tolist() for l in layers]
            cases.append(case)
    json.dump({"cases": cases}, open(out, "w"))
    print(len(cases), "cases; top labels right:", sum(1 for c in cases if SCREEN_NAMES_24[c["top"]] == c["category"]))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
