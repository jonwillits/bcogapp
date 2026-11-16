"""
Part 1, Step 1's sounds (spec §5.1), every value a setting:

  ah at 100 Hz and at 200 Hz            the Pitch screen
  ah at 100 Hz from a shorter tract      the Voice screen: every formant raised by TRACT_SCALE
  ee, ah, oo at 120 Hz                   the Vowels screen and the tour

Formant settings are round values in the range given for American English
vowels in textbook tables; they are choices, not measurements, and the
screen says so. Writes WAVs and a settings JSON.

  python -I make_vowels.py <out_dir>
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from klatt import synthesize, fade, write_wav, SR

VOWELS = {
    # F1, F2, F3, F4 in Hz; bandwidths below.
    "ee": [300, 2300, 3000, 3600],
    "ah": [700, 1200, 2600, 3400],
    "oo": [320, 850, 2300, 3300],
}
BANDWIDTHS = [60, 90, 150, 200]
DURATION_S = 0.6
TRACT_SCALE = 1.15  # a shorter vocal tract: every formant 15% higher, as a tract about 13% shorter would give
TOUR_F0 = 120


def make(name, formants, f0, out):
    n_frames = int(DURATION_S / 0.005)
    tracks = [[f] * n_frames for f in formants]
    amp = [1.0] * n_frames
    y = fade(synthesize(DURATION_S, f0, tracks, BANDWIDTHS, amp), 0.02, 0.04)
    write_wav(os.path.join(out, f"{name}.wav"), y)
    return {"file": f"{name}.wav", "f0": f0, "formants": formants, "bandwidths": BANDWIDTHS, "duration_s": DURATION_S, "sampleRate": SR}


if __name__ == "__main__":
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    settings = {}
    settings["ah_100"] = make("ah_100", VOWELS["ah"], 100, out)
    settings["ah_200"] = make("ah_200", VOWELS["ah"], 200, out)
    settings["ah_100_short"] = make("ah_100_short", [round(f * TRACT_SCALE) for f in VOWELS["ah"]], 100, out)
    settings["ah_100_short"]["tractScale"] = TRACT_SCALE
    for v in ["ee", "ah", "oo"]:
        settings[f"{v}_120"] = make(f"{v}_120", VOWELS[v], TOUR_F0, out)
    json.dump({"vowels": VOWELS, "bandwidths": BANDWIDTHS, "tractScale": TRACT_SCALE, "sounds": settings}, open(os.path.join(out, "vowels.json"), "w"), indent=1)
    print("wrote", len(settings), "vowel sounds to", out)
