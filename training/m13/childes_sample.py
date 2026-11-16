"""
Part 2, Step 4's real-speech sample (spec §6.4; decision 13), from the
CHILDES North American English corpora in Jon's shared corpus store, read
from the 56 pristine zips of CHAT files (read only; nothing is written
there, and the corpus is not copied into the app). What is shipped is derived: counts, a histogram,
two shares, and about ten utterances with no personal names.

The sample: every utterance by a speaker other than the target child, in
every transcript whose target child's age is recorded and under 36 months.
Each word is looked up in the CMU Pronouncing Dictionary (cmudict 0.7b,
through the `cmudict` package; its license is BSD-style and is copied into
the NOTICE); an utterance with any word not in the dictionary is dropped.
Each word's phones are divided into syllables by the maximal-onset rule:
every vowel is a syllable's nucleus, and the consonants between two nuclei
go to the second syllable as far as they form a legal English onset, the
rest to the first. A syllable is written as its phones without stress
digits; its stress (0, 1 or 2) is kept beside it.

Transitional probabilities are computed over every pair of neighboring
syllables inside an utterance (never across utterances): the count of the
pair divided by the count of the first syllable. The dips learner places a
cut wherever a pair's transitional probability is lower than at both
neighboring pairs, as the lab's Step 3 learner does.

  python -I childes_sample.py <store_dir> <out_dir>
"""
import sys, os, json, re, collections, zipfile, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import cmudict
from make_stream import WORDS, word_order

MAX_MONTHS = 36
ONSETS = set(
    """P B T D K G F V TH DH S Z SH ZH HH M N L R W Y JH CH
    P-L P-R P-Y B-L B-R B-Y T-R T-W T-Y D-R D-W D-Y K-L K-R K-W K-Y G-L G-R G-W G-Y F-L F-R F-Y V-Y TH-R TH-W TH-Y
    S-P S-T S-K S-M S-N S-L S-W S-Y S-F SH-R SH-M SH-L HH-Y M-Y N-Y L-Y
    S-P-L S-P-R S-P-Y S-T-R S-T-Y S-K-L S-K-R S-K-W S-K-Y S-F-R""".split()
)
VOWEL = re.compile(r"^[AEIOU].*[012]$")


def syllabify(phones):
    """CMU phones with stress digits -> list of (syllable string without digits, stress)."""
    nuclei = [i for i, p in enumerate(phones) if VOWEL.match(p)]
    if not nuclei:
        return None
    sylls = []
    start = 0
    for k, n in enumerate(nuclei):
        if k + 1 < len(nuclei):
            nxt = nuclei[k + 1]
            between = phones[n + 1 : nxt]
            # Give the next syllable the longest legal onset from the end of `between`.
            split = len(between)
            for j in range(len(between) + 1):
                onset = between[j:]
                if not onset or "-".join(onset) in ONSETS:
                    split = j
                    break
            end = n + 1 + split
        else:
            end = len(phones)
        seg = phones[start:end]
        stress = int(phones[n][-1])
        sylls.append(("".join(p.rstrip("012") for p in seg), stress))
        start = end
    return sylls


def age_months(s):
    m = re.match(r"(\d+);(\d+)", s or "")
    return int(m.group(1)) * 12 + int(m.group(2)) if m else None


# CHAT main-tier cleaning: drop codes and markers, keep plain words.
DROP_TOKEN = re.compile(r"^(&|0|\+|xxx$|yyy$|www$|\[|\]|<|>|\(|\)|‡|„|“|”)")


def clean_main(text):
    """A CHAT main tier's text to plain words: bracketed codes removed, retrace marks removed, fillers and codes dropped."""
    text = re.sub(r"\[[^\]]*\]", " ", text)  # [: x], [/], [//], [= x], [?] and the like
    text = re.sub(r"\(\.+\)", " ", text)  # pauses
    text = text.replace("<", " ").replace(">", " ")
    words = []
    for tok in text.split():
        tok = tok.strip(",.?!;:\"'")
        if not tok or DROP_TOKEN.match(tok) or "@" in tok or "_" in tok or any(ch.isdigit() for ch in tok):
            continue
        tok = tok.replace("(", "").replace(")", "")  # (be)cause: the full form
        if re.fullmatch(r"[A-Za-z][A-Za-z'\-]*", tok):
            words.append(tok)
    return words


def utterances_cha(text):
    """(words, hasName) for every utterance by a speaker other than CHI, or None if the target child's age is missing or not under the ceiling."""
    age = None
    for line in text.split("\n"):
        if line.startswith("@ID:"):
            f = line[4:].strip().split("|")
            if len(f) > 7 and f[2] == "CHI" and f[7] == "Target_Child":
                age = age_months(f[3])
    if age is None or age >= MAX_MONTHS:
        return None
    out = []
    cur = None
    for line in text.split("\n"):
        if line.startswith("*"):
            if cur is not None:
                out.append(cur)
            spk, _, rest = line[1:].partition(":")
            cur = [spk.strip(), rest.strip()]
        elif cur is not None and (line.startswith("\t") or line.startswith(" ")) and not line.strip().startswith("%"):
            cur[1] += " " + line.strip()
        elif line.startswith("%") or line.startswith("@"):
            if cur is not None:
                out.append(cur)
                cur = None
    if cur is not None:
        out.append(cur)
    result = []
    for spk, txt in out:
        if spk == "CHI":
            continue
        words = clean_main(txt)
        if words:
            has_name = any(w[0].isupper() and w != "I" and not w.startswith("I'") for w in words)
            result.append(([w.lower() for w in words], has_name))
    return result


def main(store, out):
    os.makedirs(out, exist_ok=True)
    cmu = cmudict.dict()
    root = os.path.join(store, "data", "childes", "Eng-NA", "_zips")
    zips = sorted(f for f in os.listdir(root) if f.endswith(".zip"))
    corpora = [z[:-4] for z in zips]
    used, dropped, files, kept_files = 0, 0, 0, 0
    uni = collections.Counter()
    bi = collections.Counter()
    sample = []  # (words, sylls per word, hasName, corpus)
    for z in zips:
        corpus = z[:-4]
        with zipfile.ZipFile(os.path.join(root, z)) as zf:
            for name in zf.namelist():
                if not name.endswith(".cha"):
                    continue
                files += 1
                u = utterances_cha(zf.read(name).decode("utf-8", errors="replace"))
                if u is None:
                    continue
                kept_files += 1
                for words, propn in u:
                    sylls = []
                    ok = True
                    for w in words:
                        prons = cmu.get(w)
                        if not prons:
                            ok = False
                            break
                        s = syllabify(prons[0])
                        if not s:
                            ok = False
                            break
                        sylls.append(s)
                    if not ok:
                        dropped += 1
                        continue
                    used += 1
                    flat = [s for w in sylls for s in w]
                    for s, _ in flat:
                        uni[s] += 1
                    for (a, _), (b, _) in zip(flat, flat[1:]):
                        bi[(a, b)] += 1
                    if 4 <= len(words) <= 8 and not propn and len(sample) < 400000:
                        sample.append((words, sylls, corpus))
        print(corpus, "files", files, "kept", kept_files, "used", used, "dropped", dropped, flush=True)

    tp = lambda a, b: bi[(a, b)] / uni[a]
    # Histogram of transitional probabilities inside words and across word boundaries, over every pair in the sample.
    bins = np.linspace(0, 1, 21)
    inside, across = [], []
    cuts, cuts_on_boundary, boundaries, boundaries_found = 0, 0, 0, 0
    rng = np.random.default_rng(13)
    for words, sylls, corpus in sample:
        flat = [(s, wi) for wi, w in enumerate(sylls) for s, _ in w]
        tps = [tp(flat[i][0], flat[i + 1][0]) for i in range(len(flat) - 1)]
        bnd = [flat[i][1] != flat[i + 1][1] for i in range(len(flat) - 1)]
        for v, b in zip(tps, bnd):
            (across if b else inside).append(v)
        for i in range(1, len(tps) - 1):
            cut = tps[i] < tps[i - 1] and tps[i] < tps[i + 1]
            if cut:
                cuts += 1
                cuts_on_boundary += bnd[i]
            if bnd[i]:
                boundaries += 1
                boundaries_found += cut
    hist = {"bins": [round(float(b), 2) for b in bins], "inside": np.histogram(inside, bins)[0].tolist(), "across": np.histogram(across, bins)[0].tolist(), "insideN": len(inside), "acrossN": len(across), "insideMean": float(np.mean(inside)), "acrossMean": float(np.mean(across))}
    shares = {"cuts": cuts, "cutsOnBoundary": cuts_on_boundary, "precision": cuts_on_boundary / cuts if cuts else None, "boundaries": boundaries, "boundariesFound": boundaries_found, "recall": boundaries_found / boundaries if boundaries else None, "note": "cuts and boundaries counted at interior transitions only (the first and last transition of an utterance have one neighbor)"}

    # The same two shares and the same two distributions for the made-up language, over a 21-minute stream.
    order = word_order(1512, seed=2024)
    syl = [w[2 * k : 2 * k + 2] for w in order for k in range(3)]
    pos = [k for _ in order for k in range(3)]
    u2, b2 = collections.Counter(syl), collections.Counter(zip(syl, syl[1:]))
    tps2 = [b2[(syl[i], syl[i + 1])] / u2[syl[i]] for i in range(len(syl) - 1)]
    bnd2 = [pos[i] == 2 for i in range(len(syl) - 1)]
    c = cb = bb = bf = 0
    for i in range(1, len(tps2) - 1):
        cut = tps2[i] < tps2[i - 1] and tps2[i] < tps2[i + 1]
        c += cut
        cb += cut and bnd2[i]
        bb += bnd2[i]
        bf += bnd2[i] and cut
    madeUp = {"hist": {"inside": np.histogram([v for v, b in zip(tps2, bnd2) if not b], bins)[0].tolist(), "across": np.histogram([v for v, b in zip(tps2, bnd2) if b], bins)[0].tolist()}, "shares": {"cuts": c, "cutsOnBoundary": cb, "precision": cb / c if c else None, "boundaries": bb, "boundariesFound": bf, "recall": bf / bb if bb else None}}

    # Candidate utterances for the strip: a few with every boundary at a dip, a few with a boundary not at a dip, and pretty baby if present.
    def strip(words, sylls):
        flat = [(s, st, wi) for wi, w in enumerate(sylls) for s, st in w]
        return {"words": words, "syllables": [s for s, _, _ in flat], "stress": [st for _, st, _ in flat], "wordOf": [wi for _, _, wi in flat], "tp": [round(tp(flat[i][0], flat[i + 1][0]), 3) for i in range(len(flat) - 1)]}

    def dips_at_boundaries(st):
        tps, wo = st["tp"], st["wordOf"]
        res = []
        for i in range(len(tps)):
            if wo[i] != wo[i + 1]:
                lo = tps[i - 1] if i > 0 else None
                hi = tps[i + 1] if i + 1 < len(tps) else None
                res.append((lo is None or tps[i] < lo) and (hi is None or tps[i] < hi))
        return res

    all_dips, some_not, pretty = [], [], []
    seen = set()
    for words, sylls, corpus in sample:
        key = " ".join(words)
        if key in seen or len(words) < 4 or len(words) > 7:
            continue
        seen.add(key)
        st = strip(words, sylls)
        if sum(len(w) for w in sylls) < 6 or sum(len(w) for w in sylls) > 11:
            continue
        d = dips_at_boundaries(st)
        if "pretty" in words and "baby" in words:
            pretty.append(st)
        elif all(d) and len(all_dips) < 40:
            all_dips.append(st)
        elif not all(d) and sum(d) >= len(d) - 1 and len(some_not) < 40:
            some_not.append(st)
    rng.shuffle(all_dips)
    rng.shuffle(some_not)
    chosen = pretty[:1] + all_dips[:5] + some_not[:5]
    result = {
        "citation": "MacWhinney, B. (2000). The CHILDES Project: Tools for Analyzing Talk (3rd ed.). Lawrence Erlbaum. Data from TalkBank (talkbank.org), used under TalkBank's terms (CC BY-NC-SA 3.0).",
        "corpora": corpora,
        "transcriptsRead": files,
        "transcriptsUsed": kept_files,
        "ageCeilingMonths": MAX_MONTHS,
        "utterancesUsed": used,
        "utterancesDropped": dropped,
        "syllableTokens": sum(uni.values()),
        "syllableTypes": len(uni),
        "syllabification": "CMU Pronouncing Dictionary (cmudict 0.7b), first pronunciation, maximal-onset rule",
        "histogram": hist,
        "dipsLearner": shares,
        "madeUpLanguage": madeUp,
        "utterances": chosen,
        "candidates": {"allDips": len(all_dips), "someNot": len(some_not), "pretty": len(pretty)},
    }
    json.dump(result, open(os.path.join(out, "realspeech.json"), "w"), indent=1)
    print(json.dumps({k: v for k, v in result.items() if k not in ("utterances", "corpora", "histogram", "madeUpLanguage")}, indent=1))
    print(json.dumps(result["dipsLearner"]), json.dumps(result["madeUpLanguage"]["shares"]))
    for u in chosen:
        print(" ".join(u["words"]), "|", " ".join(u["syllables"]), u["tp"])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
