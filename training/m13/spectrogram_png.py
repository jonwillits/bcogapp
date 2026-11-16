"""
A spectrogram image of a WAV, for the stimulus review sheet: wide-band
(5 ms window) by default, narrow-band (25 ms) with --narrow, 0 to 5 kHz,
dark on light, with optional overlay tracks. Also measures formants with
Praat's tracker (through parselmouth) when asked, so the sheet can print
measured against set values.

  python -I spectrogram_png.py <in.wav> <out.png> [--narrow] [--title T] [--fmax 5000]
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import soundfile as sf
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.signal import stft


def spectrogram(y, sr, window_s):
    nper = int(window_s * sr)
    nfft = 1024
    f, t, Z = stft(y, sr, window="hann", nperseg=nper, noverlap=nper - max(1, int(0.001 * sr)), nfft=nfft, boundary=None)
    S = 20 * np.log10(np.abs(Z) + 1e-9)
    return f, t, S


def draw(wav, png, narrow=False, title=None, fmax=5000, tracks=None, marks=None):
    y, sr = sf.read(wav)
    if y.ndim > 1:
        y = y[:, 0]
    f, t, S = spectrogram(y, sr, 0.025 if narrow else 0.005)
    keep = f <= fmax
    fig, (ax0, ax1) = plt.subplots(2, 1, figsize=(8, 4.2), gridspec_kw={"height_ratios": [1, 4]}, sharex=True)
    tt = np.arange(len(y)) / sr
    ax0.plot(tt, y, lw=0.4, color="#333")
    ax0.set_ylim(-1, 1)
    ax0.set_yticks([])
    ax0.set_title(title or os.path.basename(wav), fontsize=10)
    vmax = S.max()
    ax1.pcolormesh(t, f[keep], S[keep], cmap="Greys", vmin=vmax - 70, vmax=vmax, shading="auto")
    if tracks:
        for name, (tx, fy) in tracks.items():
            ax1.plot(tx, fy, lw=1.4, label=name)
        ax1.legend(fontsize=7, loc="upper right")
    if marks:
        for x, label in marks:
            ax1.axvline(x, color="#c33", lw=0.8)
            ax1.text(x, fmax * 0.95, label, color="#c33", fontsize=7)
    ax1.set_ylabel("frequency (Hz)")
    ax1.set_xlabel("time (s)")
    fig.tight_layout()
    fig.savefig(png, dpi=110)
    plt.close(fig)


def measure_formants(wav, t0=None, t1=None, n=4, max_hz=5500):
    """Mean F1..Fn over [t0, t1] by Praat's Burg tracker, Hz."""
    import parselmouth
    snd = parselmouth.Sound(wav)
    fm = snd.to_formant_burg(time_step=0.005, max_number_of_formants=n + 1, maximum_formant=max_hz)
    t0 = t0 if t0 is not None else snd.xmin + 0.05
    t1 = t1 if t1 is not None else snd.xmax - 0.05
    ts = np.arange(t0, t1, 0.005)
    out = []
    for i in range(1, n + 1):
        vals = [fm.get_value_at_time(i, t) for t in ts]
        vals = [v for v in vals if v == v]
        out.append(float(np.mean(vals)) if vals else float("nan"))
    return out


if __name__ == "__main__":
    args = sys.argv[1:]
    wav, png = args[0], args[1]
    narrow = "--narrow" in args
    title = args[args.index("--title") + 1] if "--title" in args else None
    draw(wav, png, narrow=narrow, title=title)
    print(json.dumps({"measuredFormants": measure_formants(wav)}))
