"""
Download the Open Images photographs listed in boxes.json, crop each box to
a square padded by PAD on each side (clipped to the image), and save the
crop at CROP px as JPEG under <photo_dir>/<category>/<image>.jpg. Keeps a
crops.json beside them recording each crop's source and credit.

Images are fetched from the public S3 mirror, one request per image, with a
pool of workers. A crop is kept only if the box's shorter side is at least
MIN_PX pixels in the original, so a crop is never an upscaled smudge.

Usage: python -I download_openimages_photos.py <boxes.json> <photo_dir>
"""
import sys, os, json, io, time, urllib.request, concurrent.futures
from PIL import Image

CROP = 224
PAD = 0.08
MIN_PX = 120
S3 = "https://open-images-dataset.s3.amazonaws.com/"

def fetch_crop(cat, r, photo_dir):
    out = os.path.join(photo_dir, cat, r["image"] + ".jpg")
    if os.path.exists(out):
        return cat, r, "have", None
    url = f"{S3}{r['split']}/{r['image']}.jpg"
    try:
        data = urllib.request.urlopen(url, timeout=60).read()
        im = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as e:
        return cat, r, "failed", str(e)
    W, H = im.size
    x0, y0, x1, y1 = r["box"]
    bx0, by0, bx1, by1 = x0 * W, y0 * H, x1 * W, y1 * H
    bw, bh = bx1 - bx0, by1 - by0
    if min(bw, bh) < MIN_PX:
        return cat, r, "small", None
    side = max(bw, bh) * (1 + 2 * PAD)
    cx, cy = (bx0 + bx1) / 2, (by0 + by1) / 2
    sx0, sy0 = cx - side / 2, cy - side / 2
    sx1, sy1 = cx + side / 2, cy + side / 2
    # Clip to the image; the crop may be a little off-square at an edge.
    sx0, sy0, sx1, sy1 = max(0, sx0), max(0, sy0), min(W, sx1), min(H, sy1)
    crop = im.crop((int(sx0), int(sy0), int(sx1), int(sy1)))
    # Pad to square with the crop's mean color, then resize.
    cw, ch = crop.size
    s = max(cw, ch)
    mean = tuple(int(v) for v in crop.resize((1, 1)).getpixel((0, 0)))
    sq = Image.new("RGB", (s, s), mean)
    sq.paste(crop, ((s - cw) // 2, (s - ch) // 2))
    sq = sq.resize((CROP, CROP), Image.LANCZOS)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    sq.save(out, quality=92)
    return cat, r, "ok", [W, H]

def main(boxes_json, photo_dir):
    boxes = json.load(open(boxes_json))
    jobs = [(cat, r) for cat, rows in boxes["categories"].items() for r in rows]
    print("jobs", len(jobs))
    t = time.time()
    status = {}
    crops_path = os.path.join(photo_dir, "crops.json")
    crops = json.load(open(crops_path)) if os.path.exists(crops_path) else {}
    with concurrent.futures.ThreadPoolExecutor(32) as ex:
        futs = [ex.submit(fetch_crop, cat, r, photo_dir) for cat, r in jobs]
        for i, f in enumerate(concurrent.futures.as_completed(futs)):
            cat, r, st, extra = f.result()
            status[st] = status.get(st, 0) + 1
            if st == "ok":
                crops.setdefault(cat, {})[r["image"]] = {**r, "originalSize": extra}
            if i % 500 == 0:
                print(i, status, f"{time.time()-t:.0f}s", flush=True)
                json.dump(crops, open(crops_path, "w"))
    json.dump(crops, open(crops_path, "w"))
    print("done", status, f"{time.time()-t:.0f}s")
    for cat in sorted(crops):
        print(f"{cat:10s} {len(crops[cat])}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
