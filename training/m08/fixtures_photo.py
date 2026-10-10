"""
Agreement fixtures for a photo network: 50 of the shipped photographs (the
browser decodes the same PNGs) and Python's probabilities for each, computed
on the exported weights as stored (float16). Also the penultimate layer for
the first three, for the readout test.

Usage: python -I fixtures_photo.py <model.pt> <public_m08_dir> <name> <out_json>
"""
import sys, os, json
import numpy as np
import torch
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import SCREEN_NAMES_16
from photo_net import RES, MEAN, STD
from export_model import export_photo, penultimate_of

def main(pt, public_dir, name, out):
    # export_photo rounds the model's weights to what the browser has and returns it.
    model = export_photo(pt, os.path.join(public_dir, "models"), name)
    manifest = json.load(open(os.path.join(public_dir, "photos", "manifest.json")))
    chosen = []
    per = {}
    for it in manifest["images"]:
        if per.get(it["category"], 0) < 4 and len(chosen) < 50:
            chosen.append(it); per[it["category"]] = per.get(it["category"], 0) + 1
    cases = []
    with torch.no_grad():
        for i, it in enumerate(chosen):
            im = np.asarray(Image.open(os.path.join(public_dir, "photos", it["file"])).convert("L"), dtype=np.float32) / 255.0
            x = torch.from_numpy((im - MEAN) / STD).reshape(1, 1, RES, RES)
            logits = model(x)
            probs = torch.softmax(logits, 1)[0].tolist()
            case = {"file": it["file"], "category": it["category"], "probs": probs, "top": int(np.argmax(probs))}
            if i < 3:
                case["penultimate"] = penultimate_of(model, x)[0].tolist()
            cases.append(case)
    json.dump({"model": name, "cases": cases}, open(out, "w"))
    print(name, len(cases), "cases; top right:", sum(1 for c in cases if SCREEN_NAMES_16[c["top"]] == c["category"]))

if __name__ == "__main__":
    main(*sys.argv[1:5])
