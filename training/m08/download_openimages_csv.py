"""
Fetch the Open Images annotation and metadata CSVs for the validation and
test splits (CC BY 4.0 annotations): boxes, human-verified image-level
labels, the class list, and the per-image metadata that carries each
photograph's own license, author and title.

Usage: python -I download_openimages_csv.py <csv_dir>
"""
import sys, os, urllib.request, time

FILES = {
    "class-descriptions-boxable.csv": "https://storage.googleapis.com/openimages/v7/oidv7-class-descriptions-boxable.csv",
    "validation-annotations-bbox.csv": "https://storage.googleapis.com/openimages/v5/validation-annotations-bbox.csv",
    "test-annotations-bbox.csv": "https://storage.googleapis.com/openimages/v5/test-annotations-bbox.csv",
    "validation-imagelabels.csv": "https://storage.googleapis.com/openimages/v7/oidv7-val-annotations-human-imagelabels.csv",
    "test-imagelabels.csv": "https://storage.googleapis.com/openimages/v7/oidv7-test-annotations-human-imagelabels.csv",
    "validation-images.csv": "https://storage.googleapis.com/openimages/2018_04/validation/validation-images-with-rotation.csv",
    "test-images.csv": "https://storage.googleapis.com/openimages/2018_04/test/test-images-with-rotation.csv",
    # The training split, needed because validation and test alone give
    # under a hundred usable boxes for bear, clock, elephant and oven.
    "train-annotations-bbox.csv": "https://storage.googleapis.com/openimages/v6/oidv6-train-annotations-bbox.csv",
    "train-imagelabels.csv": "https://storage.googleapis.com/openimages/v5/train-annotations-human-imagelabels-boxable.csv",
    "train-images.csv": "https://storage.googleapis.com/openimages/2018_04/train/train-images-boxable-with-rotation.csv",
}

def main(out_dir):
    os.makedirs(out_dir, exist_ok=True)
    for name, url in FILES.items():
        path = os.path.join(out_dir, name)
        if os.path.exists(path):
            print("have", name); continue
        t = time.time()
        urllib.request.urlretrieve(url, path + ".part")
        os.rename(path + ".part", path)
        print(f"{name}: {os.path.getsize(path)/1e6:.1f} MB, {time.time()-t:.0f}s")

if __name__ == "__main__":
    main(sys.argv[1])
