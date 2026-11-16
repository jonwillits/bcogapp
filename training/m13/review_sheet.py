"""
The stimulus review sheet for Jon (spec §3.1, §13 step 2): a local page
with every shipped sound playable, its spectrogram as an image, its
timings and how it was made, and every object as an image. Reads the
shipped files in public/m13/ and writes the page and its images outside
the repo and outside Box.

  python -I review_sheet.py <repo_dir> <review_dir>
  then: cd <review_dir> && python3 -m http.server 8013   ->  http://localhost:8013/
"""
import sys, os, json, shutil, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import soundfile as sf
from spectrogram_png import draw


def main(repo, rev):
    pub = os.path.join(repo, "public", "m13")
    audio = os.path.join(pub, "audio")
    os.makedirs(os.path.join(rev, "png"), exist_ok=True)
    if os.path.exists(os.path.join(rev, "audio")):
        shutil.rmtree(os.path.join(rev, "audio"))
    shutil.copytree(audio, os.path.join(rev, "audio"))
    if os.path.exists(os.path.join(rev, "objects")):
        shutil.rmtree(os.path.join(rev, "objects"))
    shutil.copytree(os.path.join(pub, "objects"), os.path.join(rev, "objects"))
    vowels = json.load(open(os.path.join(pub, "vowels.json")))
    cont = json.load(open(os.path.join(pub, "continuum.json")))
    stream = json.load(open(os.path.join(pub, "stream.json")))
    tts = json.load(open(os.path.join(pub, "tts.json")))
    objects = json.load(open(os.path.join(pub, "objects", "objects.json")))
    parts = []

    def card(title, wav, png_name, text, narrow=False, tracks=None, marks=None, title_png=None):
        png = os.path.join(rev, "png", png_name)
        draw(wav, png, narrow=narrow, title=title_png or title, tracks=tracks, marks=marks)
        # The page is served from rev, so the sound must be the copy under rev/audio,
        # not a path that climbs out of the served folder (the server answers 404).
        rel = "audio/" + os.path.relpath(wav, audio) if wav.startswith(audio + os.sep) else os.path.relpath(wav, rev)
        return f'<div class="card"><h3>{html.escape(title)}</h3><audio controls preload="none" src="{rel}"></audio><p>{text}</p><img src="png/{png_name}" alt=""></div>'

    # 1. Vowels
    parts.append("<h2>1. Part 1, Step 1: the synthesized vowels (formant synthesizer; every value a setting)</h2>")
    parts.append(f"<p>Formant settings (Hz): {html.escape(json.dumps(vowels['vowels']))}; bandwidths {vowels['bandwidths']}; the shorter tract raises every formant by {vowels['tractScale']}. Listen for: <b>ah</b> at 100 and 200 Hz should sound like the same vowel at a lower and a higher pitch, not like two vowels; the short-tract <b>ah</b> at 100 Hz should sound like the same vowel from a smaller talker; <b>ee</b>, <b>ah</b>, <b>oo</b> should be recognizable as the vowels of <i>see</i>, <i>father</i>, <i>who</i>. In the narrow-band images the harmonics are the thin horizontal lines, 100 or 200 Hz apart.</p>")
    for k, s in vowels["sounds"].items():
        parts.append(card(k, os.path.join(audio, "vowels", s["file"]), f"vowel_{k}.png", f"f0 {s['f0']} Hz; formants {s['formants']} Hz; {s['duration_s']} s. Narrow-band view.", narrow=True))
    # 2. Continuum
    parts.append("<h2>2. Part 1, Step 3: the 14-step continuum (Liberman et al., 1957, p. 359 and Fig. 1)</h2>")
    st0 = cont["steps"][0]
    parts.append(f"<p>Two-formant patterns, {st0['durationS']*1000:.0f} ms, f0 {st0['f0']} Hz, F1 from {st0['f1Onset']} to {st0['f1Steady']} Hz in every step, F2 steady at {st0['f2Steady']} Hz, F2 onset from {cont['steps'][0]['f2Onset']} to {cont['steps'][-1]['f2Onset']} Hz in steps of 120 Hz over a {st0['transitionS']*1000:.0f} ms transition, a 10 ms release burst. <b>Listen for:</b> the low steps should sound like <i>b</i> (as in <i>bay</i>), the middle like <i>d</i>, the high like <i>g</i>, in that order; the vowel should sound like the vowel of <i>gate</i>; and no step should sound like anything but a syllable. Say which steps you hear as b, d, and g.</p>")
    for s in cont["steps"]:
        parts.append(card(f"step {s['step']:02d}", os.path.join(audio, "continuum", s["file"]), f"cont_{s['step']:02d}.png", f"F2 onset {s['f2Onset']} Hz."))
    # 3. Six syllables
    parts.append("<h2>3. Part 1, Step 2: six natural syllables, voice 1 (Kokoro-82M)</h2>")
    parts.append("<p><b>Listen for:</b> each should be unmistakably <i>bee, bah, boo, dee, dah, doo</i>. The drawn track is the measured second formant (Praat) over the first 100 ms after the burst; the red line marks the burst. The reveal states whether each track rises or falls.</p>")
    for name, s in tts["six"].items():
        tr = s["tracks"]
        tx = [s["burstS"] + t for t in tr["timesS"]]
        f2 = [v if v is not None else np.nan for v in tr["f2"]]
        f1 = [v if v is not None else np.nan for v in tr["f1"]]
        parts.append(card(name, os.path.join(audio, "syllables", s["file"]), f"six_{name}.png", f"{s['durationS']} s; burst at {s['burstS']*1000:.0f} ms; voicing at {s['voicingS']*1000:.0f} ms; F2 at 0, 25, 50, 100 ms after the burst: {tr['f2'][0]}, {tr['f2'][5]}, {tr['f2'][10]}, {tr['f2'][20]} Hz.", tracks={"F2 (measured)": (tx, f2), "F1 (measured)": (tx, f1)}, marks=[(s["burstS"], "burst")]))
    # 4. Stream syllables
    parts.append("<h2>4. Part 2: the 12 stream syllables (formant synthesizer), plain and lengthened</h2>")
    parts.append(f"<p>Each exactly {stream['syllableS']*1000:.1f} ms (216 a minute), f0 {stream['f0']} Hz monotone, formants scaled by {stream['tractScale']}, closure {stream['closureS']*1000:.0f} ms, transition {stream['transitionS']*1000:.0f} ms, voice onset after the burst p {stream['votS']['p']*1000:.0f}, t {stream['votS']['t']*1000:.0f}, b {stream['votS']['b']*1000:.0f}, d {stream['votS']['d']*1000:.0f} ms; every syllable's peak set to the same value. <b>Listen for:</b> p against b and t against d should be told apart; a, i, u should be clear; the stream below should sound even, with no word audible by rhythm. The boundary probe over 21 minutes: durations identical; peak intensity differs by {stream['probe']['difference']['peak']:.2f} dB and mean pitch by {stream['probe']['difference']['pitch']:.2f} Hz between syllables after a word boundary and inside words (tolerance 0.5 dB, 1 Hz).</p>")
    for syl, s in stream["plain"].items():
        parts.append(card(syl, os.path.join(audio, "stream", s["file"]), f"stream_{syl}.png", f"{s['durationS']} s. Lengthened version: <audio controls preload='none' src='audio/stream/{stream['long'][syl]['file']}'></audio>"))
    # A 20-second sample stream, assembled as the browser will assemble it.
    sr = 16000
    import importlib
    ms = importlib.import_module("make_stream")
    order = ms.word_order(24, seed=7)
    clips = {k: sf.read(os.path.join(audio, "stream", v["file"]))[0] for k, v in stream["plain"].items()}
    longs = {k: sf.read(os.path.join(audio, "stream", v["file"]))[0] for k, v in stream["long"].items()}
    y, _ = ms.assemble(order, clips)
    sample = os.path.join(rev, "audio", "sample_stream_20s.wav")
    sf.write(sample, y.astype(np.float32), sr, subtype="PCM_16")
    y2 = np.concatenate([(longs if k == 2 else clips)[w[2 * k : 2 * k + 2]] for w in order for k in range(3)])
    sample2 = os.path.join(rev, "audio", "sample_stream_20s_lengthened.wav")
    sf.write(sample2, y2.astype(np.float32), sr, subtype="PCM_16")
    parts.append(f"<div class='card'><h3>a 20-second sample of the stream (24 words: {' '.join(order)})</h3><audio controls preload='none' src='audio/sample_stream_20s.wav'></audio><p>The same 24 words with every word's last syllable lengthened by 100 ms:</p><audio controls preload='none' src='audio/sample_stream_20s_lengthened.wav'></audio><p><b>Listen for:</b> in the plain stream, no pause, no stress, no rhythm that marks words; in the lengthened one, the words should fall out.</p></div>")
    # 5. VOT pair
    parts.append("<h2>5. Part 1, Step 2's optional screen: tot and dot, voice 1</h2>")
    for name, s in tts["vot"].items():
        parts.append(card(name, os.path.join(audio, "vot", s["file"]), f"vot_{name}.png", f"burst at {s['burstS']*1000:.0f} ms, voicing at {s['voicingS']*1000:.0f} ms: voice-onset time {s['votMs']} ms.", marks=[(s["burstS"], "burst"), (s["voicingS"], "voicing")]))
    # 6. Words
    parts.append("<h2>6. Part 3: the 24 made-up words, voice 1 (set A is the first 12; set B is the reserve)</h2>")
    parts.append("<p><b>Listen for:</b> each should sound like a possible English word, be clear, and be distinct from every other at its first sound. Say any you would replace.</p>")
    for w in tts["words"]:
        parts.append(card(f"{w['word']} (set {'A' if w['set'] == 0 else 'B'}, /{w['phonemes']}/)", os.path.join(audio, "words", w["file"]), f"word_{w['word']}.png", f"{w['durationS']} s."))
    # 7. Tokens: one syllable per voice, and the three pitches of one.
    parts.append("<h2>7. Part 1, Step 4: the training tokens (b, d, g before ee, ay, ah, oh, oo; 12 voices; each at its own pitch and shifted down and up by 3 semitones)</h2>")
    tk = tts["tokens"]
    parts.append(f"<p>{tk['count']} tokens; held-out voices: {tk['heldOutVoices']}. Below, <i>dah</i> from every voice at its own pitch, then <i>bee</i> from voice 1 at its three pitches. <b>Listen for:</b> every voice's dah should be a clear <i>dah</i>; the shifted copies should be the same syllable at a lower and a higher pitch, without a robotic sound.</p>")
    ty, _ = sf.read(os.path.join(audio, "tokens", "tokens.wav"))
    tokdir = os.path.join(rev, "audio", "token_samples")
    os.makedirs(tokdir, exist_ok=True)
    for t in tk["tokens"]:
        if t["consonant"] == "d" and t["vowel"] == "ah" and t["shift"] == 0:
            f = os.path.join(tokdir, f"dah_voice{t['voice']}.wav")
            sf.write(f, ty[t["start"] : t["start"] + t["length"]].astype(np.float32), sr, subtype="PCM_16")
            parts.append(card(f"dah, voice {t['voice']}{' (held out)' if t['heldOut'] else ''}", f, f"tok_dah_v{t['voice']}.png", f"mean pitch {t['pitchHz']} Hz; burst at {t['burstS']*1000:.0f} ms.", marks=[(t["burstS"], "burst")]))
    for t in tk["tokens"]:
        if t["consonant"] == "b" and t["vowel"] == "ee" and t["voice"] == 1:
            f = os.path.join(tokdir, f"bee_voice1_shift{t['shift']:+d}.wav")
            sf.write(f, ty[t["start"] : t["start"] + t["length"]].astype(np.float32), sr, subtype="PCM_16")
            parts.append(card(f"bee, voice 1, shift {t['shift']:+d} semitones", f, f"tok_bee_v1_{t['shift']:+d}.png", f"mean pitch {t['pitchHz']} Hz.", narrow=True))
    # 8. Objects
    parts.append("<h2>8. Part 3: the 24 objects (set A: the first 12; set B: the reserve)</h2>")
    parts.append("<p><b>Look for:</b> no two alike at a glance, none that looks like a face, an animal, or a known object, each legible on the dark background. Say any you would replace.</p><div class='objects'>")
    for o in objects:
        parts.append(f"<figure><img src='objects/{o['id']}.svg' width='100' height='100'><figcaption>{o['id']} ({'A' if o['set'] == 0 else 'B'}; {o['pattern']})</figcaption></figure>")
    parts.append("</div>")
    # 9. Part 4 vocabulary and sentences
    sheet = os.path.join(os.path.dirname(rev.rstrip("/")), "out", "grammar_sheet.txt")
    if os.path.exists(sheet):
        parts.append("<h2>9. Part 4: the corpus's vocabulary, the generator's settings, and 20 sample sentences</h2><pre>" + html.escape(open(sheet).read()) + "</pre>")
    page = f"""<!doctype html><html><head><meta charset="utf-8"><title>Lab 13 stimulus review</title>
<style>body{{font-family:system-ui;background:#0e1420;color:#e7ecf3;margin:24px;max-width:1100px}} .card{{border:1px solid #2a3446;border-radius:10px;padding:10px 14px;margin:10px 0;background:#161d2b}} img{{max-width:100%;background:#fff;border-radius:6px}} h2{{margin-top:36px;color:#4f9cff}} audio{{width:100%}} .objects{{display:flex;flex-wrap:wrap;gap:12px}} figure{{margin:0;text-align:center;font-size:12px}} pre{{white-space:pre-wrap;background:#161d2b;padding:10px;border-radius:8px}} p b{{color:#f0a94b}}</style></head><body>
<h1>Lab 13: stimulus review</h1><p>Every sound below is shipped in the app (public/m13/audio). Press play on any sound. Each section says what to listen or look for. Your answers go in <code>LAB_13_STIMULI.md</code> beside the spec.</p>
{''.join(parts)}
</body></html>"""
    open(os.path.join(rev, "index.html"), "w").write(page)
    print("wrote", os.path.join(rev, "index.html"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
