"""
Does the noise-A-trained network fail on *any* noise that looks similar to a
person? The spec's starting pair (salt-and-pepper trained, uniform tested)
did not reproduce the reading's pattern in our networks, so this measures
three more kinds on all three networks, for the record and the walk-through:
Gaussian additive noise, low-frequency blotches (smoothed Gaussian noise),
and contrast reduction. Nothing here ships unless Jon chooses it.

Usage: python -I measure_other_noise.py <models_dir> <photo_dir> <out_json>
"""
import sys, os, json
import numpy as np
import torch
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import SCREEN_NAMES_16
from photo_net import build, RES, MEAN, STD
from noise import gaussian_blur

def load_net(models_dir, diet):
    m = build(len(SCREEN_NAMES_16), pretrained=False)
    m.load_state_dict(torch.load(os.path.join(models_dir, f"photo_{diet}.pt"), map_location="cpu"))
    with torch.no_grad():
        for p in m.parameters(): p.copy_(p.half().float())
    return m.eval()

def accuracy(m, X, y):
    correct = 0
    with torch.no_grad():
        for i in range(0, len(X), 128):
            xb = torch.from_numpy(((X[i:i+128] - MEAN) / STD).astype(np.float32)).unsqueeze(1)
            correct += int((m(xb).argmax(1).numpy() == y[i:i+128]).sum())
    return correct / len(X)

def gaussian(img, s, rng): return np.clip(img + rng.normal(0, s, img.shape), 0, 1)
def blotch(img, s, rng):
    n = rng.normal(0, 1, img.shape)
    n = gaussian_blur(n, 6.0)
    n = n / (n.std() + 1e-9) * s
    return np.clip(img + n, 0, 1)
def contrast(img, c, rng): return np.clip((img - 0.5) * (1 - c) + 0.5, 0, 1)

KINDS = {"gaussian": (gaussian, [0.1, 0.2, 0.35]), "blotch": (blotch, [0.1, 0.2, 0.35]), "contrast": (contrast, [0.5, 0.8, 0.9])}

def main(models_dir, photo_dir, out):
    split = json.load(open(os.path.join(models_dir, "photo_split.json")))
    test = split["test"]
    X = np.zeros((len(test), RES, RES), dtype=np.float32)
    y = np.array([it["label"] for it in test])
    for i, it in enumerate(test):
        X[i] = np.asarray(Image.open(os.path.join(photo_dir, it["category"], it["image"] + ".jpg")).convert("L").resize((RES, RES), Image.LANCZOS), dtype=np.float32) / 255.0
    nets = {d: load_net(models_dir, d) for d in ["standard", "noise", "blur"]}
    rng = np.random.default_rng(2)
    results = {}
    for kind, (f, levels) in KINDS.items():
        for lv in levels:
            Xn = np.stack([f(x, lv, rng) for x in X]).astype(np.float32)
            for d, m in nets.items():
                results[f"{kind}@{lv}/{d}"] = accuracy(m, Xn, y)
            print(kind, lv, {d: round(results[f"{kind}@{lv}/{d}"], 3) for d in nets}, flush=True)
    json.dump(results, open(out, "w"), indent=1)

if __name__ == "__main__":
    main(*sys.argv[1:4])
