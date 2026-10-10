"""
Ship the photographs the student can see: SHIP_PER per category of the
photo networks' held-out test set (the larger test is scored at build time
over the whole test set), as grayscale RES × RES PNGs under
public/m08/photos/<category>/<image id>.png, with manifest.json and the
NOTICE crediting each photograph's author, title, page and licence. Only
test images ship; the training crops stay on the Mac.

Usage: python -I ship_photos.py <photo_dir> <models_dir> <public_m08_dir>
"""
import sys, os, json
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from photo_net import RES
from categories import SCREEN_NAMES_16

SHIP_PER = 12

def main(photo_dir, models_dir, out_root):
    split = json.load(open(os.path.join(models_dir, "photo_split.json")))
    crops = json.load(open(os.path.join(photo_dir, "crops.json")))
    out_dir = os.path.join(out_root, "photos")
    os.makedirs(out_dir, exist_ok=True)
    items = []
    lines = [
        "NOTICE for public/m08/photos/",
        "",
        "The photographs in this folder are crops of images from Open Images V7 (https://storage.googleapis.com/openimages/web/index.html), each of which its own metadata lists under the Creative Commons Attribution 2.0 licence (CC BY 2.0, https://creativecommons.org/licenses/by/2.0/). Each file is derived from the original by cropping the labeled object's box (padded to a square), converting to grayscale and resizing to %d × %d. Images carrying any person, face or body-part label in Open Images were excluded. The box annotations are CC BY 4.0, by Google LLC." % (RES, RES),
        "",
        "These photographs are NOT covered by the app's GNU General Public License. Each is redistributed under its own CC BY 2.0 licence with the credit below, which must travel with any copy.",
        "",
        "Files (folder/file ← author, title, original page, licence):",
    ]
    shipped_per = {}
    for it in split["test"]:
        cat, img = it["category"], it["image"]
        if shipped_per.get(cat, 0) >= SHIP_PER:
            continue
        shipped_per[cat] = shipped_per.get(cat, 0) + 1
        meta = crops[cat][img]
        d = os.path.join(out_dir, cat.replace(" ", "_"))
        os.makedirs(d, exist_ok=True)
        im = Image.open(os.path.join(photo_dir, cat, img + ".jpg")).convert("L").resize((RES, RES), Image.LANCZOS)
        rel = f"{cat.replace(' ', '_')}/{img}.png"
        im.save(os.path.join(out_dir, rel), optimize=True)
        items.append({"file": rel, "category": cat, "label": it["label"], "author": meta["author"], "title": meta["title"], "page": meta["page"], "license": meta["license"], "openImagesSplit": meta["split"]})
        lines.append(f"  {rel} ← {meta['author']}, \"{meta['title']}\", {meta['page']}, {meta['license']}")
    json.dump({"size": RES, "categories": SCREEN_NAMES_16, "images": items}, open(os.path.join(out_dir, "manifest.json"), "w"), indent=0)
    open(os.path.join(out_dir, "NOTICE"), "w").write("\n".join(lines) + "\n")
    total = sum(os.path.getsize(os.path.join(out_dir, it["file"])) for it in items)
    print(len(items), "photographs,", f"{total/1e6:.1f} MB")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
