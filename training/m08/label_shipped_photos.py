"""
For every shipped photograph, every Open Images label on the image (boxes
and verified image-level labels, from all three splits), by display name,
written into photos/manifest.json as `labels`. `notice.test.ts` scans them:
no shipped photograph may carry a person, face or body-part label.

Usage: python -I label_shipped_photos.py <csv_dir> <public_m08_dir>
"""
import sys, os, csv, json, collections

def main(csv_dir, public_dir):
    path = os.path.join(public_dir, "photos", "manifest.json")
    manifest = json.load(open(path))
    ids = {it["file"].split("/")[1].split(".")[0] for it in manifest["images"]}
    names = {}
    with open(os.path.join(csv_dir, "class-descriptions-boxable.csv"), newline="") as f:
        for mid, name in csv.reader(f):
            names[mid] = name
    # The image-level files use the full (non-boxable) class list too; load it if present.
    labels = collections.defaultdict(set)
    for split in ("validation", "test", "train"):
        for kind in ("annotations-bbox", "imagelabels"):
            with open(os.path.join(csv_dir, f"{split}-{kind}.csv"), newline="") as f:
                for r in csv.DictReader(f):
                    if r["ImageID"] in ids and (kind == "annotations-bbox" or r["Confidence"] == "1"):
                        labels[r["ImageID"]].add(names.get(r["LabelName"], r["LabelName"]))
        print(split, "done", flush=True)
    for it in manifest["images"]:
        it["labels"] = sorted(labels[it["file"].split("/")[1].split(".")[0]])
    json.dump(manifest, open(path, "w"), indent=0)
    all_labels = collections.Counter(l for it in manifest["images"] for l in it["labels"])
    print(len(manifest["images"]), "images;", len(all_labels), "distinct labels; most common:", all_labels.most_common(12))

if __name__ == "__main__":
    main(*sys.argv[1:3])
