"""
A cascade formant synthesizer of the design Klatt (1980) describes, written
here so that every acoustic property of a synthetic sound in Lab 13 is a
setting (spec §3.1). It is used for Part 1, Step 1's vowels, Part 1, Step
3's continuum, and Part 2's stream. Nothing here is fitted to a recording.

The design, in the order the signal passes through it:

  1. A voicing source: a train of glottal pulses at the fundamental
     frequency f0, each pulse the Rosenberg shape (a rising half-cosine and
     a falling half-cosine), which has the falling spectrum of a voice.
  2. A cascade of second-order resonators, one per formant, each with a
     center frequency and a bandwidth, applied in series as Klatt's cascade
     branch does. A cascade gives the formants their natural relative
     amplitudes without separate gains.
  3. A radiation characteristic: a first difference, for the lips.
  4. For a stop consonant: a closure (silence), then a short burst of
     noise shaped by the resonators at their onset values, then voicing
     with the formants moving linearly from their onset values to the
     vowel's over the transition.

Parameters change frame by frame (every FRAME_S seconds); the resonators'
coefficients are recomputed each frame and the filter state carried over,
so a moving formant is continuous. Sample rate 16 kHz throughout the lab.
"""
from __future__ import annotations
import math
import numpy as np

SR = 16000
FRAME_S = 0.005


def rosenberg_pulse(n: int, open_quotient: float = 0.6, close_quotient: float = 0.3) -> np.ndarray:
    """One glottal pulse of n samples: rises as 1 - cos over the opening, falls as cos over the closing, zero while closed."""
    t_open = max(2, int(round(n * open_quotient)))
    t_close = max(1, int(round(n * close_quotient)))
    p = np.zeros(n)
    i = np.arange(t_open)
    p[:t_open] = 0.5 * (1 - np.cos(np.pi * i / t_open))
    j = np.arange(t_close)
    end = min(n, t_open + t_close)
    p[t_open:end] = np.cos(0.5 * np.pi * j[: end - t_open] / t_close)
    return p


def voicing(f0_track: np.ndarray, amp_track: np.ndarray) -> np.ndarray:
    """A pulse train whose period follows f0_track (Hz per sample) and whose amplitude follows amp_track (0 to 1 per sample). Where amp is 0 there is no voicing."""
    n = len(f0_track)
    out = np.zeros(n)
    i = 0
    while i < n:
        f0 = f0_track[i]
        if amp_track[i] <= 0 or f0 <= 0:
            i += 1
            continue
        period = max(8, int(round(SR / f0)))
        pulse = rosenberg_pulse(period) * amp_track[i]
        seg = min(period, n - i)
        out[i : i + seg] += pulse[:seg]
        i += period
    return out


def resonator_coefs(f: float, bw: float) -> tuple[float, float, float]:
    """Klatt's second-order resonator: y[n] = A x[n] + B y[n-1] + C y[n-2]."""
    c = -math.exp(-2 * math.pi * bw / SR)
    b = 2 * math.exp(-math.pi * bw / SR) * math.cos(2 * math.pi * f / SR)
    a = 1 - b - c
    return a, b, c


def cascade(x: np.ndarray, formants: np.ndarray, bandwidths: np.ndarray) -> np.ndarray:
    """Pass x through the formant resonators in series. formants and bandwidths are (n_samples, n_formants) tracks, held per frame."""
    y = x.copy()
    n, k = formants.shape
    step = int(FRAME_S * SR)
    for j in range(k):
        out = np.zeros(n)
        y1 = y2 = 0.0
        for start in range(0, n, step):
            end = min(n, start + step)
            a, b, c = resonator_coefs(float(formants[start, j]), float(bandwidths[start, j]))
            for i in range(start, end):
                v = a * y[i] + b * y1 + c * y2
                out[i] = v
                y2 = y1
                y1 = v
        y = out
    return y


def radiation(x: np.ndarray) -> np.ndarray:
    return np.diff(x, prepend=0.0)


def frames_to_samples(track: list[float], n: int) -> np.ndarray:
    """A per-frame list to a per-sample array, held within each frame."""
    step = int(FRAME_S * SR)
    out = np.zeros(n)
    for f, v in enumerate(track):
        out[f * step : min(n, (f + 1) * step)] = v
    if len(track) * step < n:
        out[len(track) * step :] = track[-1]
    return out


def linear(a: float, b: float, n_frames: int) -> list[float]:
    if n_frames <= 1:
        return [b]
    return [a + (b - a) * i / (n_frames - 1) for i in range(n_frames)]


def synthesize(
    duration_s: float,
    f0: float | list[float],
    formant_tracks: list[list[float]],
    bandwidths: list[float],
    amp_track: list[float] | None = None,
    burst: tuple[float, float, float] | None = None,
    rng: np.random.Generator | None = None,
) -> np.ndarray:
    """
    duration_s: total length. f0: a value, or a per-frame list. formant_tracks: one per-frame list per formant, in Hz.
    bandwidths: one per formant, Hz. amp_track: per-frame voicing amplitude (0 silences it). burst: (start_s, length_s, level)
    adds a noise burst shaped by the formants, for a stop's release. Returns float samples in [-1, 1].
    """
    n = int(round(duration_s * SR))
    n_frames = int(math.ceil(n / (FRAME_S * SR)))
    f0_track = frames_to_samples(f0 if isinstance(f0, list) else [f0] * n_frames, n)
    amp = frames_to_samples(amp_track if amp_track is not None else [1.0] * n_frames, n)
    source = voicing(f0_track, amp)
    if burst is not None:
        bs, bl, level = burst
        rng = rng or np.random.default_rng(0)
        i0, i1 = int(bs * SR), int((bs + bl) * SR)
        noise = rng.standard_normal(max(0, i1 - i0)) * level
        # A short raised-cosine envelope so the burst neither clicks on nor off.
        env = np.hanning(len(noise)) if len(noise) else noise
        source[i0:i1] += noise * env
    F = np.stack([frames_to_samples(t, n) for t in formant_tracks], axis=1)
    B = np.stack([np.full(n, bw) for bw in bandwidths], axis=1)
    y = radiation(cascade(source, F, B))
    peak = np.max(np.abs(y)) or 1.0
    return y / peak * 0.8


def fade(y: np.ndarray, in_s: float = 0.005, out_s: float = 0.015) -> np.ndarray:
    y = y.copy()
    a, b = int(in_s * SR), int(out_s * SR)
    if a:
        y[:a] *= np.linspace(0, 1, a)
    if b:
        y[-b:] *= np.linspace(1, 0, b)
    return y


def write_wav(path: str, y: np.ndarray) -> None:
    import soundfile as sf
    sf.write(path, np.clip(y, -1, 1).astype(np.float32), SR, subtype="PCM_16")
