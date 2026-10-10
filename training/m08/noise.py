"""
The two kinds of noise, and the blur, as the photo networks were trained on
them. `src/sim/objects/noise.ts` generates the same two kinds in the browser
from the run seed; `noise.test.ts` pins its statistics to the numbers in
STATS below, which this file's `describe()` prints.

Images are float arrays in [0, 1], grayscale, H × W.

Noise A, salt and pepper: each pixel, independently with probability p, is
replaced by 0 or 1 with equal odds. Noise B, uniform: every pixel has a
draw from U(−w, w) added, and the result is clipped to [0, 1]. Geirhos et
al. (2018) trained on the first and tested on the second.
"""
import numpy as np

def salt_and_pepper(img, p, rng):
    out = img.copy()
    mask = rng.random(img.shape) < p
    values = (rng.random(img.shape) < 0.5).astype(img.dtype)
    out[mask] = values[mask]
    return out

def uniform_noise(img, w, rng):
    out = img + rng.uniform(-w, w, img.shape)
    return np.clip(out, 0.0, 1.0)

def gaussian_blur(img, sigma):
    """Separable Gaussian blur with reflect padding, radius 3 sigma."""
    if sigma <= 0:
        return img
    r = int(np.ceil(3 * sigma))
    x = np.arange(-r, r + 1)
    k = np.exp(-(x * x) / (2 * sigma * sigma))
    k /= k.sum()
    pad = np.pad(img, r, mode="reflect")
    tmp = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 1, pad)
    out = np.apply_along_axis(lambda m: np.convolve(m, k, mode="valid"), 0, tmp)
    return out

def describe(img, noisy, kind):
    """The statistics the TypeScript generator is pinned to."""
    d = noisy - img
    if kind == "A":
        changed = (d != 0)
        return {"fractionChanged": float(changed.mean()), "fractionOfChangedThatAreWhite": float((noisy[changed] == 1).mean()) if changed.any() else 0.0}
    return {"meanDelta": float(d.mean()), "sdDelta": float(d.std()), "maxAbsDelta": float(np.abs(d).max()), "fractionClipped": float(((noisy == 0) | (noisy == 1)).mean())}

if __name__ == "__main__":
    rng = np.random.default_rng(1)
    img = rng.random((160, 160)) * 0.6 + 0.2
    print("A p=0.2", describe(img, salt_and_pepper(img, 0.2, rng), "A"))
    print("B w=0.35", describe(img, uniform_noise(img, 0.35, rng), "B"))
