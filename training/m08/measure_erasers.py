"""
Part 2's measurements (spec §11): over held-out drawings on which both
erasers reach the asked-for share to within 1%, the drawing network's
accuracy for each eraser at each deletion level, and the gap between them.
Also chooses and writes the shipped display set: for each category, the
first DISPLAY_PER test drawings that qualify at every level, which the scene
draws its twelve trial drawings from, and the larger eraser test set of
LARGER_N drawings whose numbers the reveal prints.

Usage: python -I measure_erasers.py <model.pt> <data_dir> <public_m08_dir> <out_json>
"""
import sys, os, json
import numpy as np
import torch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawing_net import DrawingNet
from categories import SCREEN_NAMES_24
from raster import normalize, rasterize, SIZE
from erasers import resample, find_joints, erase

LEVELS = [0.35, 0.5, 0.65]
DISPLAY_PER = 3
LARGER_N = 200
TOL = 0.01

def main(pt, data_dir, public_dir, out):
    model = DrawingNet(len(SCREEN_NAMES_24))
    model.load_state_dict(torch.load(pt, map_location="cpu"))
    model.eval()
    vectors = json.load(open(os.path.join(data_dir, "test_vectors.json")))
    def top(strokes):
        x = torch.tensor(rasterize(strokes), dtype=torch.float32).reshape(1, 1, SIZE, SIZE)
        with torch.no_grad():
            p = torch.softmax(model(x), 1)[0]
        return int(p.argmax()), float(p.max())
    # Qualify drawings: the network names the intact drawing, and both erasers reach every level.
    qualified = []
    per_cat = {}
    excluded = {"wrongIntact": 0, "eraserShort": 0, "noJoints": 0}
    rng = np.random.default_rng(0)
    order = rng.permutation(len(vectors))
    for i in order:
        v = vectors[i]
        n = normalize(v["strokes"])
        t, _ = top(n)
        if t != v["label"]:
            excluded["wrongIntact"] += 1; continue
        rs = resample(n)
        joints = find_joints(rs)
        if not joints:
            excluded["noJoints"] += 1; continue
        ok = True
        results = {}
        for level in LEVELS:
            for kind in ("mid", "joints"):
                e, removed, half = erase(n, level, kind, joints)
                if abs(removed - level) > TOL: ok = False
                results[f"{kind}@{level}"] = (e, removed)
        if not ok:
            excluded["eraserShort"] += 1; continue
        qualified.append((v, n, joints, results))
        per_cat[v["label"]] = per_cat.get(v["label"], 0) + 1
        if len(qualified) >= LARGER_N + DISPLAY_PER * len(SCREEN_NAMES_24) and all(per_cat.get(k, 0) >= DISPLAY_PER for k in range(len(SCREEN_NAMES_24))):
            break
    print("qualified", len(qualified), "excluded", excluded, flush=True)
    # The display set: DISPLAY_PER per category, taken first; the rest is the larger set.
    display, larger = [], []
    count = {}
    for q in qualified:
        lab = q[0]["label"]
        if count.get(lab, 0) < DISPLAY_PER:
            display.append(q); count[lab] = count.get(lab, 0) + 1
        elif len(larger) < LARGER_N:
            larger.append(q)
    accuracy = {}
    for level in LEVELS:
        for kind in ("mid", "joints"):
            correct = 0
            for v, n, joints, results in larger:
                e, _ = results[f"{kind}@{level}"]
                t, _ = top(e)
                correct += t == v["label"]
            accuracy[f"{kind}@{level}"] = correct / len(larger)
            print(kind, level, round(correct / len(larger), 3), flush=True)
    gaps = {str(level): accuracy[f"mid@{level}"] - accuracy[f"joints@{level}"] for level in LEVELS}
    # Also, intact accuracy on the larger set is 1 by construction; record the network's accuracy on the display set's erased versions.
    display_acc = {}
    for level in LEVELS:
        for kind in ("mid", "joints"):
            correct = sum(top(results[f"{kind}@{level}"][0])[0] == v["label"] for v, n, joints, results in display)
            display_acc[f"{kind}@{level}"] = correct / len(display)
    out_dir = os.path.join(public_dir, "drawings")
    os.makedirs(out_dir, exist_ok=True)
    disp = [{"id": f"d{i:02d}", "category": v["category"], "label": v["label"], "key": v["key"], "strokes": n, "joints": [[j[0], j[1], j[2]] for j in joints]} for i, (v, n, joints, _) in enumerate(display)]
    json.dump({"levels": LEVELS, "drawings": disp}, open(os.path.join(out_dir, "display.json"), "w"))
    lines = [
        "NOTICE for public/m08/drawings/",
        "",
        "The drawings in display.json (and the held-out drawings used to score the networks) are from the Quick, Draw! dataset (https://quickdraw.withgoogle.com/data), made available by Google under the Creative Commons Attribution 4.0 International licence (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/). Each is stored as its stroke vectors, from the 'simplified' files, unchanged except for the dataset's own normalization. The drawings were made by anonymous players of the game Quick, Draw!; the dataset does not name them.",
        "",
        "These drawings are NOT covered by the app's GNU General Public License. They are redistributed under CC BY 4.0 with this credit, which must travel with any copy.",
        "",
        "Drawings in display.json (id, category, Quick, Draw! key_id):",
    ] + [f"  {d['id']}  {d['category']}  {d['key']}" for d in disp]
    open(os.path.join(out_dir, "NOTICE"), "w").write("\n".join(lines) + "\n")
    json.dump({"levels": LEVELS, "largerN": len(larger), "accuracy": accuracy, "gap": gaps, "displayAccuracy": display_acc, "displayN": len(display), "excluded": excluded, "tolerance": TOL}, open(out, "w"), indent=1)
    print("display", len(display), "gap", gaps)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
