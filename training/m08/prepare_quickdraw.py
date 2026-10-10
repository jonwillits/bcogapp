"""
Build the drawing dataset: for each of the 24 categories, the first N_TRAIN
recognized drawings for training, the next N_VAL for validation and N_TEST
held out for the test set, rasterized with the shared rasterizer after the
dataset's own normalization. Also writes the vectors of the test set (for
the shift, turn and eraser measurements, which re-rasterize) and a small
display set the scene ships, in a separate file, chosen from the test split.

Writes <out_dir>/drawings_{train,val,test}.npz with X (uint8, N × 64 × 64)
and y (int), and <out_dir>/test_vectors.json.

Usage: python -I prepare_quickdraw.py <quickdraw_dir> <out_dir>
"""
import sys, os, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import QUICKDRAW_24
from raster import normalize, rasterize, SIZE

N_TRAIN = 6000
N_VAL = 500
N_TEST = 500

def main(qd_dir, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    splits = {"train": ([], []), "val": ([], []), "test": ([], [])}
    test_vectors = []
    t = time.time()
    for label, (screen, qd) in enumerate(QUICKDRAW_24):
        n = 0
        with open(os.path.join(qd_dir, qd.replace(" ", "_") + ".ndjson")) as f:
            for line in f:
                d = json.loads(line)
                if not d["recognized"]:
                    continue
                strokes = d["drawing"]
                if sum(len(s[0]) for s in strokes) < 3:
                    continue
                img = np.array(rasterize(normalize(strokes)), dtype=np.uint8)
                if n < N_TRAIN:
                    split = "train"
                elif n < N_TRAIN + N_VAL:
                    split = "val"
                elif n < N_TRAIN + N_VAL + N_TEST:
                    split = "test"
                    test_vectors.append({"label": label, "category": screen, "key": d["key_id"], "strokes": strokes})
                else:
                    break
                splits[split][0].append(img)
                splits[split][1].append(label)
                n += 1
        print(f"{screen:12s} {n} drawings  {time.time()-t:.0f}s", flush=True)
    for split, (X, y) in splits.items():
        np.savez_compressed(os.path.join(out_dir, f"drawings_{split}.npz"), X=np.stack(X), y=np.array(y, dtype=np.int64))
        print(split, len(X))
    json.dump(test_vectors, open(os.path.join(out_dir, "test_vectors.json"), "w"))

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
