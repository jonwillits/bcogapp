"""
Liberman, Harris, Hoffman and Griffith's (1957) 14-step b-d-g continuum
(spec §5.3), from p. 359 and Fig. 1, read from the page image:

  - the steady vowel has F1 at 360 cps and F2 at 2160 cps (p. 359)
  - the second formant's onset runs from 840 cps below the steady state
    (stimulus 1, 1320 cps) to 720 cps above it (stimulus 14, 2880 cps) in
    steps of 120 cps (p. 359)
  - the first formant's rising transition is the same in all 14 (p. 359)
  - the patterns are two-formant patterns about 300 ms long (Fig. 1)

What the paper does not give, chosen once here and held constant across all
14: the transition's length (TRANSITION_S), F1's onset (F1_ONSET), the
fundamental (F0; the Pattern Playback's fixed fundamental was 120 cps),
the bandwidths, and a short noise burst at the release so that the stops
have a release at all. These are stated in the as-built notes.

  python -I make_continuum.py <out_dir>
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from klatt import synthesize, fade, write_wav, linear, SR

F1_STEADY, F2_STEADY = 360, 2160
F2_ONSETS = [F2_STEADY - 840 + 120 * k for k in range(14)]  # 1320 .. 2880
F1_ONSET = 240
F0 = 120
DURATION_S = 0.300
TRANSITION_S = 0.040
BANDWIDTHS = [60, 90]
BURST = (0.0, 0.010, 0.15)  # start, length, level: a 10 ms release burst at the onset


def make_step(k: int, out: str) -> dict:
    n_frames = int(DURATION_S / 0.005)
    n_tr = int(TRANSITION_S / 0.005)
    f1 = linear(F1_ONSET, F1_STEADY, n_tr) + [F1_STEADY] * (n_frames - n_tr)
    f2 = linear(F2_ONSETS[k], F2_STEADY, n_tr) + [F2_STEADY] * (n_frames - n_tr)
    amp = [1.0] * n_frames
    y = fade(synthesize(DURATION_S, F0, [f1, f2], BANDWIDTHS, amp, burst=BURST, rng=np.random.default_rng(1000 + k)), 0.002, 0.03)
    name = f"step{k + 1:02d}.wav"
    write_wav(os.path.join(out, name), y)
    return {"step": k + 1, "file": name, "f2Onset": F2_ONSETS[k], "f1Onset": F1_ONSET, "f1Steady": F1_STEADY, "f2Steady": F2_STEADY, "f0": F0, "durationS": DURATION_S, "transitionS": TRANSITION_S, "bandwidths": BANDWIDTHS}


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    steps = [make_step(k, out) for k in range(14)]
    json.dump({"source": "Liberman, Harris, Hoffman and Griffith (1957), p. 359 and Fig. 1", "steps": steps, "sampleRate": SR}, open(os.path.join(out, "continuum.json"), "w"), indent=1)
    print("wrote 14 steps; F2 onsets", F2_ONSETS)
