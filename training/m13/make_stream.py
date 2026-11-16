"""
Part 2's stream (spec §6): the 12 consonant-vowel syllables of Saffran,
Newport and Aslin's (1996, JML) Experiment 1 language, p, t, b, d by a, i,
u, from the formant synthesizer, every syllable exactly SYLLABLE_S long
(216 a minute, p. 612), at one monotone pitch, with its peak amplitude set
to the same value, so that a stream assembled from them (in the browser,
from the student's seeded word order) has no acoustic cue to a word
boundary: every token of a syllable is the same sound wherever it falls.

Two sets are written: the plain set, and a set with the vowel lengthened
by LENGTHEN_S for the replay with each word's last syllable lengthened
(decision 11; the original's 100 ms, p. 616).

The stops: a closure (silence) of CLOSURE_S, a release burst, then voicing
with F1 and F2 moving from the consonant's onset values (place of
articulation) to the vowel's over TRANSITION_S. The voiceless stops p and
t have a longer gap before voicing (VOT) filled with aspiration noise; the
voiced b and d start voicing at the release. Formant onsets follow the
usual locus values for labial (low F2) and alveolar (F2 about 1800 Hz).

Also writes a 21-minute probe stream of 4,536 syllables in a seeded random
order of the six words, no word twice in a row, as `probe_stream.wav`, and
the boundary probe's numbers (`probe.json`): per-syllable duration, peak
intensity and mean pitch at word boundaries against inside words, by
Praat.

  python -I make_stream.py <out_dir>
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from klatt import synthesize, fade, write_wav, linear, SR

WORDS = ["babupu", "bupada", "dutaba", "patubi", "pidabu", "tutibu"]
SYLLABLES = [c + v for c in "ptbd" for v in "aiu"]
SYLLABLES_PER_MINUTE = 216
SYLLABLE_S = 60 / SYLLABLES_PER_MINUTE  # 0.2778 s
LENGTHEN_S = 0.100
F0 = 190  # a monotone pitch in a female range, as the original's voice was female (p. 612)
TRACT = 1.12  # formants raised for a shorter tract, to match the pitch
VOWEL = {"a": [700, 1200, 2600, 3400], "i": [300, 2300, 3000, 3600], "u": [320, 850, 2300, 3300]}
BANDWIDTHS = [70, 100, 160, 220]
# F1 onset for every stop; F2 onset by place: labial (p, b) low, alveolar (t, d) near 1800 Hz before every vowel (the locus).
F1_ONSET = 220
F2_LOCUS = {"p": 900, "b": 900, "t": 1800, "d": 1800}
CLOSURE_S = 0.060
TRANSITION_S = 0.045
VOT_S = {"p": 0.050, "t": 0.055, "b": 0.008, "d": 0.010}
BURST_LEVEL = {"p": 0.25, "t": 0.30, "b": 0.12, "d": 0.14}
PEAK = 0.8


def syllable(c: str, v: str, lengthen: float = 0.0, seed: int = 0) -> np.ndarray:
    dur = SYLLABLE_S + lengthen
    n_frames = int(round(dur / 0.005))
    n_closure = int(round(CLOSURE_S / 0.005))
    n_vot = int(round(VOT_S[c] / 0.005))
    n_tr = int(round(TRANSITION_S / 0.005))
    vow = [round(f * TRACT) for f in VOWEL[v]]
    f2_locus = round(F2_LOCUS[c] * TRACT)
    n_rest = n_frames - n_closure - n_tr
    f1 = [F1_ONSET] * n_closure + linear(F1_ONSET, vow[0], n_tr) + [vow[0]] * n_rest
    f2 = [f2_locus] * n_closure + linear(f2_locus, vow[1], n_tr) + [vow[1]] * n_rest
    f3 = [vow[2]] * n_frames
    f4 = [vow[3]] * n_frames
    # Voicing: off through the closure and the VOT, then on; a short ramp up.
    amp = [0.0] * (n_closure + n_vot) + linear(0.3, 1.0, 2) + [1.0] * (n_frames - n_closure - n_vot - 2)
    amp = amp[:n_frames]
    rng = np.random.default_rng(seed)
    y = synthesize(dur, F0, [f1, f2, f3, f4], BANDWIDTHS, amp, burst=(CLOSURE_S, max(0.012, VOT_S[c]), BURST_LEVEL[c]), rng=rng)
    y = fade(y, 0.0, 0.012)
    return y / (np.max(np.abs(y)) or 1) * PEAK


def write_set(out: str, lengthen: float, tag: str) -> dict:
    files = {}
    for i, s in enumerate(SYLLABLES):
        y = syllable(s[0], s[1], lengthen, seed=100 + i)
        name = f"{s}{tag}.wav"
        write_wav(os.path.join(out, name), y)
        files[s] = {"file": name, "durationS": round(len(y) / SR, 4), "closureS": CLOSURE_S, "votS": VOT_S[s[0]], "transitionS": TRANSITION_S}
    return files


def word_order(n_words: int, seed: int) -> list[str]:
    rng = np.random.default_rng(seed)
    order = []
    last = None
    for _ in range(n_words):
        choices = [w for w in WORDS if w != last]
        w = choices[rng.integers(len(choices))]
        order.append(w)
        last = w
    return order


def assemble(order: list[str], clips: dict) -> tuple[np.ndarray, list[dict]]:
    parts, marks, t = [], [], 0.0
    for w in order:
        for k in range(3):
            s = w[2 * k : 2 * k + 2]
            y = clips[s]
            parts.append(y)
            marks.append({"syllable": s, "word": w, "position": k, "startS": round(t, 5), "endS": round(t + len(y) / SR, 5)})
            t += len(y) / SR
    return np.concatenate(parts), marks


def probe(wav: str, marks: list[dict]) -> dict:
    """Per-syllable duration, peak intensity (dB) and mean pitch (Hz) at word boundaries (position 0, the first syllable after a boundary) against inside words (positions 1 and 2)."""
    import parselmouth
    snd = parselmouth.Sound(wav)
    intensity = snd.to_intensity(minimum_pitch=100, time_step=0.005)
    pitch = snd.to_pitch(time_step=0.005, pitch_floor=100, pitch_ceiling=400)
    rows = {"boundary": {"duration": [], "peak": [], "pitch": []}, "inside": {"duration": [], "peak": [], "pitch": []}}
    for m in marks:
        key = "boundary" if m["position"] == 0 else "inside"
        t0, t1 = m["startS"], m["endS"]
        rows[key]["duration"].append(t1 - t0)
        ts = np.arange(t0 + 0.005, t1 - 0.005, 0.005)
        iv = [intensity.get_value(t) for t in ts]
        iv = [v for v in iv if v == v]
        rows[key]["peak"].append(max(iv) if iv else float("nan"))
        pv = [pitch.get_value_at_time(t) for t in ts]
        pv = [v for v in pv if v == v and v > 0]
        rows[key]["pitch"].append(float(np.mean(pv)) if pv else float("nan"))
    out = {}
    for key, d in rows.items():
        out[key] = {k: {"mean": float(np.nanmean(v)), "sd": float(np.nanstd(v)), "n": len(v)} for k, v in d.items()}
    out["difference"] = {k: out["boundary"][k]["mean"] - out["inside"][k]["mean"] for k in ["duration", "peak", "pitch"]}
    out["tolerance"] = {"durationS": 0.001, "peakDb": 0.5, "pitchHz": 1.0}
    out["withinTolerance"] = all(abs(out["difference"][k]) <= tol for k, tol in [("duration", 0.001), ("peak", 0.5), ("pitch", 1.0)])
    return out


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    plain = write_set(out, 0.0, "")
    longer = write_set(out, LENGTHEN_S, "_long")
    clips = {s: syllable(s[0], s[1], 0.0, seed=100 + i) for i, s in enumerate(SYLLABLES)}
    order = word_order(1512, seed=2024)  # 1512 words = 4536 syllables = 21 minutes
    y, marks = assemble(order, clips)
    probe_wav = os.path.join(out, "probe_stream.wav")
    write_wav(probe_wav, y)
    result = probe(probe_wav, marks)
    manifest = {
        "source": "Saffran, Newport and Aslin (1996), Experiment 1, p. 612",
        "words": WORDS,
        "syllables": SYLLABLES,
        "syllablesPerMinute": SYLLABLES_PER_MINUTE,
        "syllableS": round(SYLLABLE_S, 5),
        "lengthenS": LENGTHEN_S,
        "f0": F0,
        "tractScale": TRACT,
        "vowelFormants": VOWEL,
        "f2Locus": F2_LOCUS,
        "f1Onset": F1_ONSET,
        "closureS": CLOSURE_S,
        "transitionS": TRANSITION_S,
        "votS": VOT_S,
        "bandwidths": BANDWIDTHS,
        "plain": plain,
        "long": longer,
        "probe": {"minutes": 21, "syllables": len(marks), "seed": 2024, **result},
        "sampleRate": SR,
    }
    json.dump(manifest, open(os.path.join(out, "stream.json"), "w"), indent=1)
    print(json.dumps(result, indent=1))
