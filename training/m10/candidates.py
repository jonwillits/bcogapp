"""The pool the lists were chosen from (see README.md).

    python -I candidates.py [data_dir]

Reads the concreteness norms (which carry each word's SUBTLEX-US count and
dominant part of speech) and the SUBTLEX-US text file, and writes
candidates.txt: nouns of 3 to 8 letters and one or two syllables, with
concreteness >= 4.5 and a frequency of at least 5 per million, one per line
with its concreteness, frequency per million and the share of raters who
knew the word.
"""
import re
import sys
from pathlib import Path

DATA = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Documents/Projects/bcogapp_data/m10')
CORPUS_MILLIONS = 51.0

def syllables(w: str) -> int:
    groups = re.findall(r'[aeiouy]+', w)
    n = len(groups)
    if w.endswith('e') and not w.endswith(('le', 'ee', 'ye', 'oe')) and n > 1:
        n -= 1
    return max(1, n)

freq = {}
with open(DATA / 'SUBTLEXus74286wordstextversion.txt', encoding='latin-1') as f:
    head = f.readline().rstrip('\n').split('\t')
    iw, ic = head.index('Word'), head.index('FREQcount')
    for line in f:
        cols = line.rstrip('\n').split('\t')
        if len(cols) <= ic:
            continue
        try:
            freq[cols[iw].lower()] = float(cols[ic]) / CORPUS_MILLIONS
        except ValueError:
            pass

rows = []
with open(DATA / 'Concreteness_ratings_Brysbaert_et_al_BRM.txt', encoding='utf-8') as f:
    head = f.readline().rstrip('\n').split('\t')
    col = {h: i for i, h in enumerate(head)}
    for line in f:
        c = line.rstrip('\n').split('\t')
        if len(c) < len(head):
            continue
        w = c[col['Word']].lower()
        if c[col['Bigram']] != '0' or not re.fullmatch(r'[a-z]+', w):
            continue
        conc = float(c[col['Conc.M']])
        known = float(c[col['Percent_known']])
        pos = c[col['Dom_Pos']]
        fpm = freq.get(w, float(c[col['SUBTLEX']]) / CORPUS_MILLIONS)
        if conc < 4.5 or fpm < 5 or not (3 <= len(w) <= 8) or pos != 'Noun' or syllables(w) > 2 or known < 0.95:
            continue
        rows.append((w, conc, fpm, known))

rows.sort(key=lambda r: -r[2])
with open(DATA / 'candidates.txt', 'w', encoding='utf-8') as out:
    out.write('word\tconcreteness\tper_million\tknown\n')
    for w, conc, fpm, known in rows:
        out.write(f'{w}\t{conc:.2f}\t{fpm:.1f}\t{known:.2f}\n')
print(f'{len(rows)} candidates written to {DATA / "candidates.txt"}')
