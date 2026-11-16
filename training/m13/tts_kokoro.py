"""
Natural syllables and words from Kokoro-82M (hexgrad/Kokoro-82M on Hugging
Face, Apache 2.0; its voice packs are distributed in the same repository
under the same license), driven by phoneme strings so that each syllable
is exactly the consonant and vowel asked for (spec §3.1). Used for Part 1,
Step 2's six syllables, Step 4's training tokens, the voice-timing pair,
and Part 3's words. Nothing is recorded from a person: the voices are a
text-to-speech model's.

The phoneme alphabet is misaki's (Kokoro's G2P): b d ɡ p t k m n ... i ɑ u
ɪ ɛ æ ʌ ə ɔ ʊ, with A for the vowel of day (eɪ), O for the vowel of go (oʊ),
I for the vowel of my (aɪ), ˈ for primary stress.

  python -I tts_kokoro.py list
  python -I tts_kokoro.py say <voice> <phonemes> <out.wav> [speed]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly

SR_OUT = 16000
_pipeline = None

# Twelve American English voices, named on screen only as voice 1 to voice 12 (spec §11, item 14): the twelve with the
# best grades in the model's VOICES.md (A to C-), so that no voice is one the model card itself marks as poor. The last
# two are held out of training.
VOICES = ["af_heart", "af_bella", "af_nicole", "af_aoede", "af_kore", "af_sarah", "am_fenrir", "am_michael", "af_nova", "af_sky", "af_alloy", "am_puck"]
HELD_OUT = ["af_alloy", "am_puck"]


def pipeline():
    global _pipeline
    if _pipeline is None:
        from kokoro import KPipeline
        _pipeline = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
    return _pipeline


def say(voice: str, phonemes: str, speed: float = 1.0) -> np.ndarray:
    """Synthesize a phoneme string in a voice; 16 kHz float samples, trimmed of leading and trailing silence."""
    p = pipeline()
    audio = None
    for r in p.generate_from_tokens(phonemes, voice=voice, speed=speed):
        a = r.audio
        audio = a.numpy() if isinstance(a, torch.Tensor) else np.asarray(a)
    y = resample_poly(audio.astype(np.float64), SR_OUT, 24000)
    return trim(y)


def trim(y: np.ndarray, db: float = 40.0, pad_s: float = 0.03) -> np.ndarray:
    env = np.abs(y)
    thr = env.max() * 10 ** (-db / 20)
    idx = np.where(env > thr)[0]
    if len(idx) == 0:
        return y
    a = max(0, idx[0] - int(pad_s * SR_OUT))
    b = min(len(y), idx[-1] + int(pad_s * SR_OUT))
    out = y[a:b].copy()
    n = int(0.005 * SR_OUT)
    out[:n] *= np.linspace(0, 1, n)
    out[-n:] *= np.linspace(1, 0, n)
    return out / (np.max(np.abs(out)) or 1) * 0.8


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "list":
        print(VOICES, "held out:", HELD_OUT)
    elif cmd == "say":
        voice, ph, out = sys.argv[2:5]
        speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
        y = say(voice, ph, speed)
        sf.write(out, y.astype(np.float32), SR_OUT, subtype="PCM_16")
        print(out, f"{len(y) / SR_OUT:.3f} s")
