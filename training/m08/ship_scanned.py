"""
Turn the scanned-object renders into the images the scene ships: grayscale,
RES × RES, PNG (lossless, so the browser's pixels are Python's), under
public/m08/scanned/<object id>/<view>.png, with manifest.json (objects,
sets, views, credits) and the NOTICE that credits every file and excludes
the images from the GPL. The 3D models never ship.

Usage: python -I ship_scanned.py <gso_dir> <views.json> <public_m08_dir>
"""
import sys, os, json, re
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from photo_net import RES

def pretty(name):
    return name.replace("_", " ")

def main(gso_dir, views_path, out_root):
    spec = json.load(open(views_path))
    all_models = {m["name"]: m for m in json.load(open(os.path.join(gso_dir, "all_models.json")))}
    out_dir = os.path.join(out_root, "scanned")
    os.makedirs(out_dir, exist_ok=True)
    objects = []
    files = []
    for i, o in enumerate(spec["objects"]):
        oid = f"{o['set']}{i:02d}"
        meta = all_models[o["name"]]
        d = os.path.join(out_dir, oid)
        os.makedirs(d, exist_ok=True)
        for v in spec["views"]:
            src = os.path.join(gso_dir, "renders", o["name"], v["id"] + ".png")
            im = Image.open(src).convert("L").resize((RES, RES), Image.LANCZOS)
            path = os.path.join(d, v["id"] + ".png")
            im.save(path, optimize=True)
            files.append(f"{oid}/{v['id']}.png")
        objects.append({
            "id": oid, "set": o["set"], "name": o["name"], "title": pretty(o["name"]),
            "description": meta.get("description", "").split("\n")[0].strip(),
            "source": f"https://app.gazebosim.org/GoogleResearch/fuel/models/{o['name']}",
            "license": meta.get("license_name", ""), "licenseUrl": meta.get("license_url", ""),
        })
    manifest = {
        "size": RES,
        "background": "neutral gray, 0x808080",
        "views": spec["views"],
        "objects": objects,
        "learnedViews": ["h000", "h075"],
    }
    json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), indent=1)
    total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in files)
    lines = [
        "NOTICE for public/m08/scanned/",
        "",
        "The images in this folder are renders of 3D-scanned household objects from Google Scanned Objects (Downs et al., 2022, 'Google Scanned Objects: A High-Quality Dataset of 3D Scanned Household Items', ICRA), published by Google Research on Gazebo Fuel under the Creative Commons Attribution 4.0 International licence (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/). Each render is derived from the named model: rendered with Three.js from fixed views on a neutral gray background, converted to grayscale and resized to %d × %d. The 3D models themselves are not distributed here." % (RES, RES),
        "",
        "These images are NOT covered by the app's GNU General Public License. They are redistributed under CC BY 4.0 with the credits below, and the credit must travel with any copy.",
        "",
        "Objects (folder → model, source page, licence):",
    ]
    for o in objects:
        lines.append(f"  {o['id']}/  ←  {o['name']} ({o['description']}). Copyright 2020 Google LLC. {o['source']}  {o['license']}")
    lines += ["", f"Files ({len(files)}, {total/1e6:.1f} MB):"]
    lines += [f"  {f}" for f in files]
    open(os.path.join(out_dir, "NOTICE"), "w").write("\n".join(lines) + "\n")
    print(len(objects), "objects,", len(files), "files,", f"{total/1e6:.1f} MB")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3])
