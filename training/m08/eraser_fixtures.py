"""Fixtures for the TypeScript eraser: drawings with their joints, and both erasers at three levels, with the removed share. Also prints the ink gap between the erasers.

Usage: python -I eraser_fixtures.py <data_dir> <out_json>
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from erasers import resample, find_joints, erase
from raster import normalize, stroke_length

LEVELS = [0.35, 0.5, 0.65]

def main(data_dir, out):
    vectors = json.load(open(os.path.join(data_dir, "test_vectors.json")))
    cases = []
    seen = {}
    for v in vectors:
        if seen.get(v["label"], 0) >= 1: continue
        seen[v["label"]] = 1
        n = normalize(v["strokes"])
        rs = resample(n)
        joints = find_joints(rs)
        case = {"category": v["category"], "strokes": n, "joints": [[j[0], j[1], j[2]] for j in joints], "erased": {}}
        for level in LEVELS:
            for kind in ("mid", "joints"):
                e, removed, half = erase(n, level, kind, joints)
                case["erased"][f"{kind}@{level}"] = {"strokes": e, "removed": removed, "half": half, "length": stroke_length(e)}
        cases.append(case)
    json.dump({"levels": LEVELS, "cases": cases}, open(out, "w"))
    worst = 0
    for c in cases:
        for level in LEVELS:
            a = c["erased"][f"mid@{level}"]["removed"]; b = c["erased"][f"joints@{level}"]["removed"]
            worst = max(worst, abs(a - b))
    print(len(cases), "cases; worst gap between erasers in removed share:", round(worst, 4))
    for c in cases[:6]:
        print(c["category"], "joints:", len(c["joints"]), {k: round(v["removed"], 3) for k, v in c["erased"].items()})

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
