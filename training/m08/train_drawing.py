"""
Train the drawing network on the 24-category Quick, Draw! set.

Version A trains on the drawings as the dataset normalizes them. Version B
(--augment) trains on copies shifted, turned and resized at random, which is
§7.2.9's "training on altered copies" and Part 1's cuttable Step 5.

Writes <out_dir>/drawing_{a,b}.pt and a metrics JSON beside it: data counts,
wall-clock time, the device, and accuracy on the held-out test set.

Usage: python -I train_drawing.py <data_dir> <out_dir> [--augment]
"""
import sys, os, json, time, math, random
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawing_net import DrawingNet
from categories import SCREEN_NAMES_24

SEED = 1
EPOCHS = 12
BATCH = 128
LR = 2e-3

def load(data_dir, split):
    d = np.load(os.path.join(data_dir, f"drawings_{split}.npz"))
    X = torch.from_numpy(d["X"]).float().unsqueeze(1)
    y = torch.from_numpy(d["y"])
    return X, y

def augment(x):
    """Random shift (±8 px), turn (±180°) and scale (0.6 to 1.1), per image, by an affine resample."""
    n = x.shape[0]
    ang = (torch.rand(n) * 2 - 1) * math.pi
    sc = 0.6 + torch.rand(n) * 0.5
    tx = (torch.rand(n) * 2 - 1) * 8 / 32
    ty = (torch.rand(n) * 2 - 1) * 8 / 32
    cos, sin = torch.cos(ang) / sc, torch.sin(ang) / sc
    theta = torch.stack([torch.stack([cos, -sin, tx], 1), torch.stack([sin, cos, ty], 1)], 1).to(x.device)
    grid = F.affine_grid(theta, x.shape, align_corners=False)
    return (F.grid_sample(x, grid, align_corners=False) > 0.5).float()

def evaluate(model, X, y, device):
    model.eval()
    correct = 0
    with torch.no_grad():
        for i in range(0, len(X), 512):
            logits = model(X[i:i+512].to(device))
            correct += (logits.argmax(1).cpu() == y[i:i+512]).sum().item()
    return correct / len(X)

def main(data_dir, out_dir, aug):
    torch.manual_seed(SEED); random.seed(SEED); np.random.seed(SEED)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    Xtr, ytr = load(data_dir, "train")
    Xva, yva = load(data_dir, "val")
    Xte, yte = load(data_dir, "test")
    model = DrawingNet(len(SCREEN_NAMES_24)).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    steps = EPOCHS * math.ceil(len(Xtr) / BATCH)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=LR, total_steps=steps)
    t0 = time.time()
    log = []
    g = torch.Generator().manual_seed(SEED)
    for ep in range(EPOCHS):
        model.train()
        perm = torch.randperm(len(Xtr), generator=g)
        tot, correct, n = 0.0, 0, 0
        for i in range(0, len(Xtr), BATCH):
            idx = perm[i:i+BATCH]
            xb = Xtr[idx].to(device); yb = ytr[idx].to(device)
            if aug:
                xb = augment(xb)
            logits = model(xb)
            loss = F.cross_entropy(logits, yb)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            tot += loss.item() * len(idx); correct += (logits.argmax(1) == yb).sum().item(); n += len(idx)
        va = evaluate(model, Xva, yva, device)
        log.append({"epoch": ep + 1, "trainAcc": correct / n, "valAcc": va, "seconds": time.time() - t0})
        print(f"epoch {ep+1}: train {correct/n:.3f} val {va:.3f}  {time.time()-t0:.0f}s", flush=True)
    te = evaluate(model, Xte, yte, device)
    wall = time.time() - t0
    tag = "b" if aug else "a"
    os.makedirs(out_dir, exist_ok=True)
    torch.save(model.state_dict(), os.path.join(out_dir, f"drawing_{tag}.pt"))
    metrics = {
        "model": f"drawing network, version {tag.upper()}",
        "architecture": "4 × (conv 3×3, ReLU, max pool 2×2) with 16, 32, 64, 96 channels, then linear 1536 → 24",
        "weights": n_params,
        "input": "1 × 64 × 64, ink = 1",
        "categories": SCREEN_NAMES_24,
        "trainingDrawings": len(Xtr), "validationDrawings": len(Xva), "testDrawings": len(Xte),
        "perCategory": len(Xtr) // len(SCREEN_NAMES_24),
        "augmented": aug,
        "epochs": EPOCHS, "batch": BATCH, "seed": SEED,
        "device": device, "hardware": "Apple M5 Pro, 24 GB",
        "wallClockSeconds": round(wall),
        "testAccuracy": te,
        "log": log,
    }
    json.dump(metrics, open(os.path.join(out_dir, f"drawing_{tag}.metrics.json"), "w"), indent=1)
    print(f"test accuracy {te:.4f}  wall {wall:.0f}s  weights {n_params}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], "--augment" in sys.argv)
