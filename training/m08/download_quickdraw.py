"""
Fetch the head of each Quick, Draw! simplified ndjson (CC BY 4.0) for the 24
drawing categories: the first RANGE_BYTES of each file by HTTP range, which
is about 20,000 drawings, far more than training needs. The files are
hundreds of megabytes each; nothing here needs the whole of one.

Usage: python -I download_quickdraw.py <data_dir>
"""
import sys, os, urllib.request, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from categories import QUICKDRAW_24

RANGE_BYTES = 14_000_000
BASE = "https://storage.googleapis.com/quickdraw_dataset/full/simplified/"
CATS_URL = "https://raw.githubusercontent.com/googlecreativelab/quickdraw-dataset/master/categories.txt"

def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    cats = set(urllib.request.urlopen(CATS_URL).read().decode().split("\n"))
    for _, qd in QUICKDRAW_24:
        assert qd in cats, f"{qd!r} is not a Quick, Draw! category"
    for screen, qd in QUICKDRAW_24:
        path = os.path.join(out_dir, qd.replace(" ", "_") + ".ndjson")
        if os.path.exists(path) and os.path.getsize(path) > RANGE_BYTES - 1000:
            print("have", qd); continue
        url = BASE + urllib.request.quote(qd) + ".ndjson"
        req = urllib.request.Request(url, headers={"Range": f"bytes=0-{RANGE_BYTES - 1}"})
        t = time.time()
        data = urllib.request.urlopen(req).read()
        # Drop the trailing partial line.
        data = data[: data.rfind(b"\n") + 1]
        with open(path, "wb") as f:
            f.write(data)
        print(f"{qd}: {len(data)/1e6:.1f} MB, {data.count(b'\n')} drawings, {time.time()-t:.1f}s")

if __name__ == "__main__":
    main(sys.argv[1])
