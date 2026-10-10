"""
Part 4's and the Closer's measurements (spec §11), over the photo networks'
whole held-out test set (TEST_PER per category) and the drawing test set:

  - clean accuracy, and accuracy under noise A and noise B at the shipped
    default strengths and over a sweep of strengths, for each network;
  - accuracy on held-out Quick, Draw! drawings of the sixteen categories
    (black strokes on white, at the photo networks' resolution), for each
    photo network and for the drawing network.

Noise is drawn from a fixed seed so the numbers are reproducible.

Usage: python -I measure_photo.py <models_dir> <photo_dir> <drawings_dir> <out_json>
"""
import sys, os, json
import numpy as np
import torch
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import SCREEN_NAMES_16, SCREEN_NAMES_24
from photo_net import build, RES, MEAN, STD
from noise import salt_and_pepper, uniform_noise
from drawing_net import DrawingNet
import raster

DEFAULT_A = 0.2
DEFAULT_B = 0.35
SWEEP_A = [0.0, 0.05, 0.1, 0.2, 0.35, 0.5]
SWEEP_B = [0.0, 0.1, 0.2, 0.35, 0.5, 0.7]
NETS = ["standard", "noise", "blur"]
DRAWINGS_PER_CATEGORY = 50
DRAWING_RADIUS_AT_RES = 2.0

def load_net(models_dir, diet):
    m = build(len(SCREEN_NAMES_16), pretrained=False)
    m.load_state_dict(torch.load(os.path.join(models_dir, f"photo_{diet}.pt"), map_location="cpu"))
    # Evaluate on the float16-rounded weights the browser has.
    with torch.no_grad():
        for p in m.parameters():
            p.copy_(p.half().float())
    return m.eval()

def accuracy(m, X, y):
    correct = 0
    with torch.no_grad():
        for i in range(0, len(X), 128):
            xb = torch.from_numpy(((X[i:i+128] - MEAN) / STD).astype(np.float32)).unsqueeze(1)
            correct += int((m(xb).argmax(1).numpy() == y[i:i+128]).sum())
    return correct / len(X)

def drawing_as_photo(strokes):
    """A drawing rendered as a line drawing at the photo resolution: black ink on white, strokes about 2 px wide."""
    size = RES
    margin = 12.0
    scale = (size - 2 * margin) / 255.0
    img = np.ones((size, size), dtype=np.float32)
    r2 = DRAWING_RADIUS_AT_RES ** 2
    for s in strokes:
        xs, ys = s
        n = len(xs)
        for k in range(max(n - 1, 1)):
            ax, ay = xs[k] * scale + margin, ys[k] * scale + margin
            bx, by = xs[min(k + 1, n - 1)] * scale + margin, ys[min(k + 1, n - 1)] * scale + margin
            lo_x = max(0, int(min(ax, bx) - 3)); hi_x = min(size - 1, int(max(ax, bx) + 3))
            lo_y = max(0, int(min(ay, by) - 3)); hi_y = min(size - 1, int(max(ay, by) + 3))
            dx, dy = bx - ax, by - ay
            l2 = dx * dx + dy * dy
            for i in range(lo_y, hi_y + 1):
                py = i + 0.5
                for j in range(lo_x, hi_x + 1):
                    px = j + 0.5
                    t = 0.0 if l2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / l2))
                    ex, ey = px - (ax + t * dx), py - (ay + t * dy)
                    if ex * ex + ey * ey <= r2:
                        img[i, j] = 0.0
    return img

def main(models_dir, photo_dir, drawings_dir, out):
    split = json.load(open(os.path.join(models_dir, "photo_split.json")))
    test = split["test"]
    X = np.zeros((len(test), RES, RES), dtype=np.float32)
    y = np.array([it["label"] for it in test])
    for i, it in enumerate(test):
        X[i] = np.asarray(Image.open(os.path.join(photo_dir, it["category"], it["image"] + ".jpg")).convert("L").resize((RES, RES), Image.LANCZOS), dtype=np.float32) / 255.0
    nets = {d: load_net(models_dir, d) for d in NETS}
    results = {"testImages": len(test), "defaults": {"A": DEFAULT_A, "B": DEFAULT_B}, "nets": {}}
    rng = np.random.default_rng(1)
    noisy = {}
    for p in sorted(set(SWEEP_A + [DEFAULT_A])):
        noisy[("A", p)] = np.stack([salt_and_pepper(x, p, rng) for x in X]) if p > 0 else X
    for w in sorted(set(SWEEP_B + [DEFAULT_B])):
        noisy[("B", w)] = np.stack([uniform_noise(x, w, rng) for x in X]) if w > 0 else X
    for d, m in nets.items():
        r = {"clean": accuracy(m, X, y), "noiseA": {}, "noiseB": {}}
        for (kind, s), Xn in noisy.items():
            r["noiseA" if kind == "A" else "noiseB"][str(s)] = accuracy(m, Xn, y)
        r["atDefaults"] = {"A": r["noiseA"][str(DEFAULT_A)], "B": r["noiseB"][str(DEFAULT_B)]}
        results["nets"][d] = r
        print(d, "clean", round(r["clean"], 3), "A", {k: round(v, 3) for k, v in r["noiseA"].items()}, "B", {k: round(v, 3) for k, v in r["noiseB"].items()}, flush=True)
    # Drawings of the sixteen categories, through the photo networks and the drawing network.
    vectors = json.load(open(os.path.join(drawings_dir, "test_vectors.json")))
    label16 = {name: i for i, name in enumerate(SCREEN_NAMES_16)}
    chosen = []
    per = {}
    for v in vectors:
        if v["category"] in label16 and per.get(v["category"], 0) < DRAWINGS_PER_CATEGORY:
            chosen.append(v); per[v["category"]] = per.get(v["category"], 0) + 1
    Xd = np.stack([drawing_as_photo(raster.normalize(v["strokes"])) for v in chosen])
    yd = np.array([label16[v["category"]] for v in chosen])
    results["drawings"] = {"n": len(chosen), "perCategory": DRAWINGS_PER_CATEGORY, "renderedAs": f"black strokes {2*DRAWING_RADIUS_AT_RES:.0f} px wide on white, {RES} × {RES}", "nets": {}}
    for d, m in nets.items():
        results["drawings"]["nets"][d] = accuracy(m, Xd, yd)
        print("drawings", d, round(results["drawings"]["nets"][d], 3), flush=True)
    dn = DrawingNet(len(SCREEN_NAMES_24))
    dn.load_state_dict(torch.load(os.path.join(models_dir, "drawing_a.pt"), map_location="cpu")); dn.eval()
    correct = 0
    with torch.no_grad():
        for v in chosen:
            x = torch.tensor(raster.rasterize(raster.normalize(v["strokes"])), dtype=torch.float32).reshape(1, 1, 64, 64)
            # The drawing network answers over 24 categories; it is right if its top label is the drawing's.
            correct += int(dn(x).argmax()) == SCREEN_NAMES_24.index(v["category"])
    results["drawings"]["nets"]["drawingNetwork"] = correct / len(chosen)
    print("drawings drawing network", round(correct / len(chosen), 3))
    json.dump(results, open(out, "w"), indent=1)

if __name__ == "__main__":
    main(*sys.argv[1:5])
