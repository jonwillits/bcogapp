"""Write rasterizer fixtures for the TypeScript agreement test: a few drawings, each with its raster under several transforms.

Usage: python -I raster_fixtures.py <quickdraw_dir> <out_json>
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from raster import normalize, transform, rasterize, stroke_length, SIZE

def main(qd_dir, out):
    cases = []
    for cat in ["cat", "chair", "mushroom", "bicycle"]:
        with open(os.path.join(qd_dir, cat.replace(" ", "_") + ".ndjson")) as f:
            for i, line in enumerate(f):
                d = json.loads(line)
                if not d["recognized"]:
                    continue
                strokes = d["drawing"]
                variants = {
                    "raw": strokes,
                    "normalized": normalize(strokes),
                    "shift4": transform(normalize(strokes), dx=4 / ((SIZE - 8) / 255.0)),
                    "turn45": transform(normalize(strokes), angle_deg=45),
                    "turn180": transform(normalize(strokes), angle_deg=180),
                    "small": transform(normalize(strokes), scale=0.4, dx=-70, dy=-70),
                }
                cases.append({
                    "category": cat,
                    "key": d["key_id"],
                    "strokes": strokes,
                    "length": stroke_length(strokes),
                    "rasters": {k: "".join("1" if v else "0" for row in rasterize(s) for v in row) for k, s in variants.items()},
                    "variants": {k: s for k, s in variants.items() if k != "raw"},
                })
                if len([c for c in cases if c["category"] == cat]) >= 3:
                    break
    json.dump({"size": SIZE, "cases": cases}, open(out, "w"))
    print(len(cases), "cases")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
