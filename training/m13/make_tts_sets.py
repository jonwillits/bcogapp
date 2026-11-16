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
# Spec §7.1: made-up words that follow English sound patterns, every word with a different first sound, in two sets with nothing shared.
WORDS_A = {"dax": "dæks", "blicket": "blˈɪkət", "toma": "tˈOmə", "fep": "fɛp", "gorp": "ɡɔɹp", "kibby": "kˈɪbi", "mipen": "mˈIpən", "nellum": "nˈɛləm", "pimwit": "pˈɪmwɪt", "sprock": "spɹɑk", "wug": "wʌɡ", "zorch": "zɔɹʧ"}
WORDS_B = {"crannel": "kɹˈænəl", "lorp": "lɔɹp", "flimmer": "flˈɪmɚ", "hinnet": "hˈɪnət", "jeb": "ʤɛb", "rasket": "ɹˈæskət", "vimble": "vˈɪmbəl", "stibble": "stˈɪbəl", "greeble": "ɡɹˈibəl", "yoop": "jup", "chelk": "ʧɛlk", "thade": "θAd"}


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
        y = say(VOICE_1, ph)
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
            y = say(VOICE_1, ph)
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
                base = say(voice, cph + vph)
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
