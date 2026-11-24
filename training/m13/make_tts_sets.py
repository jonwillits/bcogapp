"""
Every natural sound in the lab, from Kokoro-82M through `tts_kokoro.py`,
with its timings measured by Praat (spec §3.1, §5.2, §5.4, §7.1):

  syllables/   Part 1, Step 2: bee, bah, boo, dee, dah, doo in voice 1, each
               with its burst onset, its voicing onset, and its F1, F2 and
               F3 tracks over the first 100 ms after the burst, at 5 ms steps
  tokens/      Part 1, Step 4: b, d, g before ee, ay, ah, oh, oo in every
               voice, each at its own pitch and shifted down and up by
               SHIFT_SEMITONES through Praat's PSOLA (pitch changed, formants
               not), concatenated into one WAV with an index of offsets and
               burst onsets
  vot/         Part 1, Step 2's optional screen: tot and dot in voice 1,
               with the voice-onset time (burst to voicing) measured
  words/       Part 3: 12 made-up words and 12 reserve words in voice 1

  python -I make_tts_sets.py <out_dir> [--quick]
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import soundfile as sf
import parselmouth
from parselmouth.praat import call
from tts_kokoro import say, VOICES, HELD_OUT, SR_OUT as SR

VOICE_1 = VOICES[0]
SIX = {"bee": "bi", "bah": "bɑ", "boo": "bu", "dee": "di", "dah": "dɑ", "doo": "du"}
CONSONANTS = {"b": "b", "d": "d", "g": "ɡ"}
VOWELS = {"ee": "i", "ay": "A", "ah": "ɑ", "oh": "O", "oo": "u"}
SHIFT_SEMITONES = 3
VOT_PAIR = {"tot": "tɑt", "dot": "dɑt"}
# Spec §7.1: made-up words that follow English sound patterns, every word in a set with a different first sound, in two sets with nothing shared.
# Set B, 2026-11-23: pelk for fep and jarbit for jeb (Jon; see OVERRIDES).
WORDS_A = {"dax": "dæks", "blicket": "blˈɪkət", "toma": "tˈOmə", "lorp": "lɔɹp", "gorp": "ɡɔɹp", "kibby": "kˈɪbi", "mipen": "mˈIpən", "nellum": "nˈɛləm", "pimwit": "pˈɪmwɪt", "sprock": "spɹɑk", "wug": "wʌɡ", "zorch": "zɔɹʧ"}
WORDS_B = {"crannel": "kɹˈænəl", "pelk": "pɛlk", "flimmer": "flˈɪmɚ", "hinnet": "hˈɪnət", "jarbit": "ʤˈɑɹbət", "rasket": "ɹˈæskət", "vimble": "vˈɪmbəl", "stibble": "stˈɪbəl", "greeble": "ɡɹˈibəl", "yoop": "jup", "chelk": "ʧɛlk", "thade": "θAd"}

# OVERRIDES, 2026-11-17: Jon's picks by ear on the walk. On 2026-11-16 he flagged boo and doo (an open vowel at the end),
# three training tokens (dah in voices 9 and 11 heard as dou; day in voice 10 heard as day-dah), and zorch, sprock and fep
# (final consonant unclear). Candidates were synthesized with say() at other phoneme strings and speeds by
# bcogapp_data/m13/review/candidates/make_candidates.py and listened to on its page; the picks are below. Each entry gives
# the phoneme string and speed that replace the defaults (SIX, CONSONANTS + VOWELS, WORDS_A; speed 1.0) for that one
# item; everything not listed keeps its default. fep had no pick and stays as shipped.
# Kokoro is not deterministic: two calls with the same voice, phonemes and speed give different samples (measured
# 2026-11-17: peak difference 0.1 of full scale, sometimes a different length), so a resynthesis is not the sound Jon
# chose. Each pick therefore also names the candidate file he heard ("take", in CANDIDATES_DIR); synth() uses that
# file when it is there and resynthesizes only when it is gone. The token takes are the candidate files as the page
# played them: already cut to ship.py's window (40 ms before the burst to 260 ms after), not the raw synthesis; the
# pitch-shifted copies are made from that cut, as they were made from the raw synthesis before.
CANDIDATES_DIR = "/Users/jon/Documents/Projects/bcogapp_data/m13/review/candidates"
OVERRIDES = {
    "six": {
        "boo": {"phonemes": "bu", "speed": 1.1, "take": "boo_u_s110.wav"},
        "doo": {"phonemes": "duː", "speed": 1.0, "take": "doo_uu_s100.wav"},
    },
    "words": {
        # 2026-11-19, Jon's second-round pick: the plain rounded o. The page wrote zorch_O_tS_s100.wav (zOɹtʃ) and then
        # zorch_o_tS_s100.wav (zoɹtʃ) to a case-insensitive disk, so the second overwrote the first and both cards played
        # the same 0.561 s file; that file, zoɹtʃ, is what Jon heard and picked, and it is shipped as it is.
        "zorch": {"phonemes": "zoɹtʃ", "speed": 1.0, "take": "zorch_O_tS_s100.wav"},
        "sprock": {"phonemes": "spɹˈɑk", "speed": 1.0, "take": "sprock_stress_s100.wav"},
        # 2026-11-19: lorp replaces fep in set A (Jon's pick from the nine set-B words that keep every first sound
        # distinct); fep moves to set B in lorp's place. The shipped lorp is the set-B file Jon heard (swap_lorp.wav).
        "lorp": {"phonemes": "lɔɹp", "speed": 1.0, "take": "swap_lorp.wav"},
        # 2026-11-23, Jon's picks on the words review page (review/words/): jarbit replaces jeb in set B (jeb is a common
        # proper name) and pelk replaces fep there (fep and flimmer were two f-words in one set). The takes are the
        # candidate files he heard, copied into CANDIDATES_DIR.
        "jarbit": {"phonemes": "ʤˈɑɹbət", "speed": 1.0, "take": "words_jarbit.wav"},
        "pelk": {"phonemes": "pɛlk", "speed": 1.0, "take": "words_pelk.wav"},
    },
    # (voice number, consonant, vowel) as the lab names them.
    "tokens": {
        (9, "d", "ah"): {"phonemes": "dɑː", "speed": 1.0, "take": "dah_v9_aa_s100.wav"},
        (11, "d", "ah"): {"phonemes": "dˈɑ", "speed": 1.0, "take": "dah_v11_stress_s100.wav"},
        (10, "d", "ay"): {"phonemes": "dA", "speed": 1.15, "take": "day_v10_A_s115.wav"},
    },
}


def synth(voice, default_ph, override=None):
    """The sound for one item: the default phoneme string at speed 1.0, or the override's phonemes and speed, taken from the
    candidate file Jon heard when it exists (see OVERRIDES). Returns the samples and the phoneme string used."""
    if not override:
        return say(voice, default_ph), default_ph
    take = os.path.join(CANDIDATES_DIR, override["take"]) if override.get("take") else None
    if take and os.path.exists(take):
        y, sr = sf.read(take)
        assert sr == SR, (take, sr)
        return (y if y.ndim == 1 else y[:, 0]), override["phonemes"]
    print(f"override take {override.get('take')} not found; resynthesizing (Kokoro is not deterministic: this is not the sound that was picked)")
    return say(voice, override["phonemes"], override["speed"]), override["phonemes"]


def write(path, y):
    sf.write(path, np.clip(y, -1, 1).astype(np.float32), SR, subtype="PCM_16")


def burst_onset(y, db=25.0, frame_s=0.002):
    """The stop's release: the first 2 ms frame whose energy above 1.5 kHz rises above the peak such frame's energy minus db. A low murmur before the release has little energy that high, so it is not taken for the burst."""
    from scipy.signal import butter, sosfilt
    sos = butter(4, 1500, "highpass", fs=SR, output="sos")
    hi = sosfilt(sos, y)
    n = int(frame_s * SR)
    frames = np.array([np.mean(hi[i : i + n] ** 2) for i in range(0, len(hi) - n, n)])
    e = 10 * np.log10(frames + 1e-12)
    thr = e.max() - db
    idx = np.where(e > thr)[0]
    return float(idx[0] * n / SR) if len(idx) else 0.0


def voicing_onset(snd: parselmouth.Sound, after_s: float):
    pitch = snd.to_pitch(time_step=0.002, pitch_floor=70, pitch_ceiling=500)
    ts = pitch.xs()
    for t, v in zip(ts, pitch.selected_array["frequency"]):
        if t >= after_s and v > 0:
            return float(t)
    return float("nan")


def formant_tracks(snd: parselmouth.Sound, t0: float, length_s: float = 0.100, step=0.005):
    fm = snd.to_formant_burg(time_step=step, max_number_of_formants=5, maximum_formant=5500)
    ts = [t0 + k * step for k in range(int(length_s / step) + 1)]
    out = {"timesS": [round(t - t0, 3) for t in ts]}
    for i, name in [(1, "f1"), (2, "f2"), (3, "f3")]:
        vals = []
        for t in ts:
            v = fm.get_value_at_time(i, t)
            vals.append(None if v != v else round(float(v)))
        out[name] = vals
    return out


def pitch_shift(y, semitones):
    snd = parselmouth.Sound(y, sampling_frequency=SR)
    manip = call(snd, "To Manipulation", 0.01, 70, 500)
    tier = call(manip, "Extract pitch tier")
    call(tier, "Multiply frequencies", snd.xmin, snd.xmax, 2 ** (semitones / 12))
    call([tier, manip], "Replace pitch tier")
    out = call(manip, "Get resynthesis (overlap-add)")
    z = out.values[0]
    return z / (np.max(np.abs(z)) or 1) * 0.8


def mean_pitch(y):
    snd = parselmouth.Sound(y, sampling_frequency=SR)
    p = snd.to_pitch(pitch_floor=70, pitch_ceiling=500).selected_array["frequency"]
    p = p[p > 0]
    return float(np.mean(p)) if len(p) else float("nan")


def six(out):
    os.makedirs(out, exist_ok=True)
    rows = {}
    for name, ph in SIX.items():
        y, ph = synth(VOICE_1, ph, OVERRIDES["six"].get(name))
        write(os.path.join(out, f"{name}.wav"), y)
        snd = parselmouth.Sound(y, sampling_frequency=SR)
        b = burst_onset(y)
        rows[name] = {"file": f"{name}.wav", "phonemes": ph, "voice": 1, "durationS": round(len(y) / SR, 4), "burstS": round(b, 4), "voicingS": round(voicing_onset(snd, b), 4), "tracks": formant_tracks(snd, b)}
        print(name, rows[name]["durationS"], "burst", rows[name]["burstS"], "F2 track", rows[name]["tracks"]["f2"][:6])
    return rows


def vot(out):
    os.makedirs(out, exist_ok=True)
    rows = {}
    for name, ph in VOT_PAIR.items():
        y = say(VOICE_1, ph)
        write(os.path.join(out, f"{name}.wav"), y)
        snd = parselmouth.Sound(y, sampling_frequency=SR)
        b = burst_onset(y)
        v = voicing_onset(snd, b)
        rows[name] = {"file": f"{name}.wav", "phonemes": ph, "voice": 1, "durationS": round(len(y) / SR, 4), "burstS": round(b, 4), "voicingS": round(v, 4), "votMs": round((v - b) * 1000, 1)}
        print(name, rows[name])
    return rows


def words(out):
    os.makedirs(out, exist_ok=True)
    rows = []
    for set_i, words in enumerate([WORDS_A, WORDS_B]):
        for w, ph in words.items():
            y, ph = synth(VOICE_1, ph, OVERRIDES["words"].get(w))
            write(os.path.join(out, f"{w}.wav"), y)
            rows.append({"word": w, "set": set_i, "phonemes": ph, "file": f"{w}.wav", "voice": 1, "durationS": round(len(y) / SR, 4)})
    print("words:", [(r["word"], r["durationS"]) for r in rows])
    return rows


def tokens(out, quick=False):
    os.makedirs(out, exist_ok=True)
    voices = VOICES[:3] if quick else VOICES
    index, chunks, pos = [], [], 0
    gap = np.zeros(int(0.05 * SR))
    for vi, voice in enumerate(voices):
        for c, cph in CONSONANTS.items():
            for v, vph in VOWELS.items():
                base, _ = synth(voice, cph + vph, OVERRIDES["tokens"].get((vi + 1, c, v)))
                for shift in [0, -SHIFT_SEMITONES, SHIFT_SEMITONES]:
                    y = base if shift == 0 else pitch_shift(base, shift)
                    index.append({"voice": vi + 1, "heldOut": voice in HELD_OUT, "consonant": c, "vowel": v, "shift": shift, "start": pos, "length": len(y), "burstS": round(burst_onset(y), 4), "pitchHz": round(mean_pitch(y), 1)})
                    chunks.append(y)
                    chunks.append(gap)
                    pos += len(y) + len(gap)
        print("voice", vi + 1, voice, "done", len(index))
    write(os.path.join(out, "tokens.wav"), np.concatenate(chunks))
    return {"sampleRate": SR, "voices": len(voices), "heldOutVoices": [VOICES.index(v) + 1 for v in HELD_OUT if v in voices], "shiftSemitones": SHIFT_SEMITONES, "consonants": list(CONSONANTS), "vowels": list(VOWELS), "count": len(index), "tokens": index}


if __name__ == "__main__":
    out = sys.argv[1]
    quick = "--quick" in sys.argv
    os.makedirs(out, exist_ok=True)
    manifest = {"model": "hexgrad/Kokoro-82M (Apache 2.0)", "voices": VOICES, "heldOut": HELD_OUT, "sampleRate": SR}
    manifest["six"] = six(os.path.join(out, "syllables"))
    manifest["vot"] = vot(os.path.join(out, "vot"))
    manifest["words"] = words(os.path.join(out, "words"))
    manifest["tokens"] = tokens(os.path.join(out, "tokens"), quick)
    json.dump(manifest, open(os.path.join(out, "tts.json"), "w"), indent=1)
    print("wrote", out)
