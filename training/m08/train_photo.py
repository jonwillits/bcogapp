"""
Train one photo network on the sixteen categories' Open Images crops, in
grayscale, under one of three diets:

  standard   clean images
  noise      salt-and-pepper noise at a strength drawn per image from [0, P_MAX]
  blur       each image sharp or Gaussian-blurred (sigma in [1, 4] px) at random

Per category: TEST_PER held out as the test set, VAL_PER as validation, the
rest training. The split is by a seeded shuffle of each category's images,
so the three diets share one split. Writes <out_dir>/photo_<diet>.pt and
<out_dir>/photo_<diet>.metrics.json, and <out_dir>/photo_split.json once.

Usage: python -I train_photo.py <photo_dir> <out_dir> <diet>
"""
import sys, os, json, time, math, random
import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import SCREEN_NAMES_16
from photo_net import build, RES, MEAN, STD
from noise import salt_and_pepper, gaussian_blur

SEED = 1
EPOCHS = 10
BATCH = 64
LR = 6e-4
TEST_PER = 50
VAL_PER = 40
P_MAX = 0.35
SIGMA = (1.0, 4.0)

def split_images(photo_dir, out_dir):
    path = os.path.join(out_dir, "photo_split.json")
    if os.path.exists(path):
        return json.load(open(path))
    crops = json.load(open(os.path.join(photo_dir, "crops.json")))
    rng = random.Random(SEED)
    split = {"train": [], "val": [], "test": []}
    for label, cat in enumerate(SCREEN_NAMES_16):
        ids = sorted(crops[cat])
        rng.shuffle(ids)
        for i, img in enumerate(ids):
            s = "test" if i < TEST_PER else "val" if i < TEST_PER + VAL_PER else "train"
            split[s].append({"image": img, "category": cat, "label": label, "split": crops[cat][img]["split"]})
    os.makedirs(out_dir, exist_ok=True)
    json.dump(split, open(path, "w"))
    return split

def load_gray(photo_dir, items):
    X = np.zeros((len(items), RES, RES), dtype=np.float32)
    for i, it in enumerate(items):
        im = Image.open(os.path.join(photo_dir, it["category"], it["image"] + ".jpg")).convert("L").resize((RES, RES), Image.LANCZOS)
        X[i] = np.asarray(im, dtype=np.float32) / 255.0
    return X, np.array([it["label"] for it in items], dtype=np.int64)

def normalize(x):
    return (x - MEAN) / STD

def random_crop_flip(x, rng):
    """Random resized crop (scale 0.75 to 1, square) and horizontal flip, on a batch tensor N × 1 × R × R."""
    n = x.shape[0]
    scale = 0.75 + rng.random(n) * 0.25
    tx = (rng.random(n) * 2 - 1) * (1 - scale)
    ty = (rng.random(n) * 2 - 1) * (1 - scale)
    flip = np.where(rng.random(n) < 0.5, -1.0, 1.0)
    theta = np.zeros((n, 2, 3), dtype=np.float32)
    theta[:, 0, 0] = scale * flip; theta[:, 0, 2] = tx
    theta[:, 1, 1] = scale; theta[:, 1, 2] = ty
    grid = F.affine_grid(torch.from_numpy(theta).to(x.device), x.shape, align_corners=False)
    return F.grid_sample(x, grid, align_corners=False, padding_mode="reflection")

def apply_diet(X, diet, rng):
    """X: numpy batch N × R × R in [0, 1]. Returns the altered batch."""
    if diet == "standard":
        return X
    out = np.empty_like(X)
    for i in range(len(X)):
        if diet == "noise":
            out[i] = salt_and_pepper(X[i], rng.uniform(0, P_MAX), rng)
        elif diet == "blur":
            out[i] = gaussian_blur(X[i], rng.uniform(*SIGMA)) if rng.random() < 0.5 else X[i]
    return out

def evaluate(model, X, y, device):
    model.eval()
    correct = 0
    with torch.no_grad():
        for i in range(0, len(X), 256):
            xb = normalize(torch.from_numpy(X[i:i+256])).unsqueeze(1).to(device)
            correct += (model(xb).argmax(1).cpu().numpy() == y[i:i+256]).sum()
    return float(correct / len(X))

def main(photo_dir, out_dir, diet):
    assert diet in ("standard", "noise", "blur")
    torch.manual_seed(SEED); random.seed(SEED)
    rng = np.random.default_rng(SEED)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    split = split_images(photo_dir, out_dir)
    t_load = time.time()
    Xtr, ytr = load_gray(photo_dir, split["train"])
    Xva, yva = load_gray(photo_dir, split["val"])
    Xte, yte = load_gray(photo_dir, split["test"])
    print(f"loaded {len(Xtr)} train, {len(Xva)} val, {len(Xte)} test in {time.time()-t_load:.0f}s", flush=True)
    model = build(len(SCREEN_NAMES_16)).to(device)
    n_params = sum(p.numel() for p in model.parameters())
    opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    steps = EPOCHS * math.ceil(len(Xtr) / BATCH)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=LR, total_steps=steps, pct_start=0.15)
    t0 = time.time()
    log = []
    for ep in range(EPOCHS):
        model.train()
        perm = rng.permutation(len(Xtr))
        tot, correct, n = 0.0, 0, 0
        for i in range(0, len(Xtr), BATCH):
            idx = perm[i:i+BATCH]
            xb = apply_diet(Xtr[idx], diet, rng)
            xb = normalize(torch.from_numpy(xb)).unsqueeze(1).to(device)
            xb = random_crop_flip(xb, rng)
            yb = torch.from_numpy(ytr[idx]).to(device)
            logits = model(xb)
            loss = F.cross_entropy(logits, yb, label_smoothing=0.05)
            opt.zero_grad(); loss.backward(); opt.step(); sched.step()
            tot += loss.item() * len(idx); correct += (logits.argmax(1) == yb).sum().item(); n += len(idx)
        va = evaluate(model, Xva, yva, device)
        log.append({"epoch": ep + 1, "trainAcc": correct / n, "valAcc": va, "seconds": round(time.time() - t0)})
        print(f"epoch {ep+1}: train {correct/n:.3f} val {va:.3f}  {time.time()-t0:.0f}s", flush=True)
    te = evaluate(model, Xte, yte, device)
    wall = time.time() - t0
    torch.save(model.state_dict(), os.path.join(out_dir, f"photo_{diet}.pt"))
    per_cat = {}
    counts = {}
    for it in split["train"]:
        counts[it["category"]] = counts.get(it["category"], 0) + 1
    metrics = {
        "model": {"standard": "Standard", "noise": "Trained on noise A", "blur": "Trained on blurred and sharp"}[diet],
        "diet": diet,
        "architecture": "MobileNetV3-small (torchvision, ImageNet-pretrained), first convolution folded to one grayscale channel, last layer 1024 → 16",
        "weights": n_params,
        "input": f"1 × {RES} × {RES} gray in [0, 1], normalized (g − {MEAN}) / {STD}",
        "categories": SCREEN_NAMES_16,
        "trainingImages": len(Xtr), "trainingImagesPerCategory": counts, "validationImages": len(Xva), "testImages": len(Xte),
        "epochs": EPOCHS, "batch": BATCH, "learningRate": LR, "seed": SEED,
        "noiseA": {"kind": "salt and pepper", "pPerImage": f"uniform in [0, {P_MAX}]"} if diet == "noise" else None,
        "blur": {"kind": "Gaussian", "sigmaPx": list(SIGMA), "shareBlurred": 0.5} if diet == "blur" else None,
        "device": device, "hardware": "Apple M5 Pro, 24 GB",
        "wallClockSeconds": round(wall),
        "testAccuracyClean": te,
        "log": log,
    }
    json.dump(metrics, open(os.path.join(out_dir, f"photo_{diet}.metrics.json"), "w"), indent=1)
    print(f"{diet}: clean test accuracy {te:.4f}  wall {wall:.0f}s  weights {n_params}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
