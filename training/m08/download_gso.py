"""
Download Google Scanned Objects models (CC BY 4.0) from Gazebo Fuel, by name.
Each zip holds meshes/model.obj, meshes/model.mtl, materials/textures/texture.png
and a thumbnail. The models never ship; only renders of them do.

Usage: python -I download_gso.py <gso_dir> name [name ...]
"""
import sys, os, urllib.request, zipfile, time

BASE = "https://fuel.gazebosim.org/1.0/GoogleResearch/models/"

def main(gso_dir, names):
    os.makedirs(os.path.join(gso_dir, "models"), exist_ok=True)
    for name in names:
        d = os.path.join(gso_dir, "models", name)
        if os.path.exists(os.path.join(d, "meshes", "model.obj")):
            print("have", name); continue
        t = time.time()
        z = os.path.join(gso_dir, "models", name + ".zip")
        urllib.request.urlretrieve(BASE + urllib.request.quote(name) + ".zip", z)
        with zipfile.ZipFile(z) as zf:
            for member in zf.namelist():
                if member.startswith("/") or ".." in member:
                    raise ValueError(member)
            zf.extractall(d)
        os.remove(z)
        print(f"{name}: {time.time()-t:.1f}s")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2:])
