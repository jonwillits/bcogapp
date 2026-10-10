"""
Choose the Open Images photographs for the sixteen categories, from the
validation, test and training splits (validation and test alone give under
a hundred usable boxes for bear, clock, elephant and oven).

Keeps a box only when
  - the image's own metadata gives a CC BY 2.0 licence (or CC0),
  - no box and no verified image-level label on the image is a person,
    face or body part,
  - the box is not a group, not a depiction, not inside another object,
  - the box is large enough: at least MIN_SIDE pixels on its shorter side
    in the original (estimated from the 300k thumbnail is impossible, so the
    test is in normalized units against a MIN_FRAC of the image side, and a
    second check after download).

Writes <out>/boxes.json: per category, the list of candidate boxes with the
image's metadata (author, title, landing page, licence), capped at
PER_CATEGORY per category by a seeded shuffle.

Usage: python -I prepare_openimages.py <csv_dir> <out_json>
"""
import sys, os, csv, json, random, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import OPENIMAGES_16

SEED = 2026
PER_CATEGORY = 800
MIN_FRAC = 0.25  # the shorter side of the box, as a fraction of the image side
OK_LICENSES = {
    "https://creativecommons.org/licenses/by/2.0/",
    "https://creativecommons.org/publicdomain/zero/1.0/",
}

def main(csv_dir, out_json):
    classes = {}
    with open(os.path.join(csv_dir, "class-descriptions-boxable.csv"), newline="") as f:
        for mid, name in csv.reader(f):
            classes[name] = mid
    wanted = {classes[oi]: screen for screen, oi in OPENIMAGES_16}
    person = {mid for name, mid in classes.items() if name.startswith("Human ") or name in ("Person", "Man", "Woman", "Boy", "Girl")}
    print("person labels:", len(person))

    # Images that carry any person label, by box or by verified image label.
    # The training split's files are large (2.3 GB of boxes), so everything
    # streams, and the metadata is read last, for the images that survive.
    has_person = set()
    boxes = collections.defaultdict(list)
    for split in ("validation", "test", "train"):
        with open(os.path.join(csv_dir, f"{split}-annotations-bbox.csv"), newline="") as f:
            for r in csv.DictReader(f):
                if r["LabelName"] in person:
                    has_person.add(r["ImageID"])
                elif r["LabelName"] in wanted:
                    boxes[r["ImageID"]].append(r)
        print(split, "boxes read; candidate images so far", len(boxes), flush=True)
        with open(os.path.join(csv_dir, f"{split}-imagelabels.csv"), newline="") as f:
            for r in csv.DictReader(f):
                if r["LabelName"] in person and r["Confidence"] == "1":
                    has_person.add(r["ImageID"])
    print("images with a person label:", len(has_person))
    meta = {}
    for split in ("validation", "test", "train"):
        with open(os.path.join(csv_dir, f"{split}-images.csv"), newline="") as f:
            for r in csv.DictReader(f):
                if r["ImageID"] in boxes:
                    meta[r["ImageID"]] = r
    print("candidate images with metadata:", len(meta))

    per_cat = collections.defaultdict(list)
    dropped = collections.Counter()
    for img, rows in boxes.items():
        m = meta.get(img)
        if m is None:
            dropped["no metadata"] += 1; continue
        if m["License"] not in OK_LICENSES:
            dropped["licence " + m["License"]] += 1; continue
        if img in has_person:
            dropped["person"] += 1; continue
        cats_here = {wanted[r["LabelName"]] for r in rows}
        for r in rows:
            if r["IsGroupOf"] == "1" or r["IsDepiction"] == "1" or r["IsInside"] == "1":
                dropped["group/depiction/inside"] += 1; continue
            w = float(r["XMax"]) - float(r["XMin"])
            h = float(r["YMax"]) - float(r["YMin"])
            if min(w, h) < MIN_FRAC:
                dropped["small"] += 1; continue
            per_cat[wanted[r["LabelName"]]].append({
                "image": img,
                "split": m["Subset"],
                "box": [float(r["XMin"]), float(r["YMin"]), float(r["XMax"]), float(r["YMax"])],
                "author": m["Author"],
                "title": m["Title"],
                "page": m["OriginalLandingURL"],
                "license": m["License"],
                "otherCategoriesInImage": sorted(cats_here),
            })
    print("dropped:", dict(dropped))
    rng = random.Random(SEED)
    out = {}
    for screen, _ in OPENIMAGES_16:
        rows = per_cat[screen]
        # One box per image, the largest, so no image is two training examples.
        best = {}
        for r in rows:
            b = r["box"]; area = (b[2]-b[0])*(b[3]-b[1])
            if r["image"] not in best or area > best[r["image"]][0]:
                best[r["image"]] = (area, r)
        rows = [v[1] for v in best.values()]
        rows.sort(key=lambda r: r["image"])
        rng.shuffle(rows)
        out[screen] = rows[:PER_CATEGORY]
        print(f"{screen:10s} candidates {len(best):5d}  kept {len(out[screen])}")
    json.dump({"seed": SEED, "minFrac": MIN_FRAC, "licenses": sorted(OK_LICENSES), "categories": out}, open(out_json, "w"), indent=0)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
