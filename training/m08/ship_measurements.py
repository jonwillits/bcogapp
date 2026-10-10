"""Bundle every measurement the scene prints (the larger tests, scored at build time) into public/m08/measurements.json, with the metrics of each network.

Usage: python -I ship_measurements.py <models_dir> <public_m08_dir>
"""
import sys, os, json

def main(models_dir, public_dir):
    load = lambda n: json.load(open(os.path.join(models_dir, n)))
    out = {
        "writtenBy": "training/m08/ship_measurements.py",
        "networks": {
            "drawing": {k: v for k, v in load("drawing_a.metrics.json").items() if k != "log"},
            "drawingB": {k: v for k, v in load("drawing_b.metrics.json").items() if k != "log"},
            "photo_standard": {k: v for k, v in load("photo_standard.metrics.json").items() if k != "log"},
            "photo_noise": {k: v for k, v in load("photo_noise.metrics.json").items() if k != "log"},
            "photo_blur": {k: v for k, v in load("photo_blur.metrics.json").items() if k != "log"},
        },
        "part1": {"a": load("drawing_a.measure.json"), "b": load("drawing_b.measure.json"), "untrained": load("drawing_untrained.measure.json")},
        "part2": {"erasers": load("erasers.measure.json"), "moved": load("moved.measure.json")},
        "part4": load("photo.measure.json"),
        # Three other kinds of change, measured after the spec's starting pair did not reproduce the reading's pattern (see measure_other_noise.py).
        "otherNoise": load("other_noise.measure.json"),
    }
    json.dump(out, open(os.path.join(public_dir, "measurements.json"), "w"), indent=0)
    print("measurements.json written")

if __name__ == "__main__":
    main(*sys.argv[1:3])
