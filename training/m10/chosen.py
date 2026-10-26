"""Check the words chosen by hand against the norms, and print their numbers.

    python -I chosen.py [data_dir] [repo_dir]

Reads the chosen words out of src/sim/memory/words/lists.ts and sets.ts
(every quoted word in UNRELATED_SHORT, UNRELATED_LONG, NEW_WORDS and the
word sets), looks each up in the concreteness norms and SUBTLEX-US, and
writes chosen.txt in the data folder: word, concreteness, frequency per
million, share known, and the list it is on. Words that fall below the
pool's thresholds are flagged, which is a finding for the walk-through, not
an error.
"""
import re
import sys
from pathlib import Path

DATA = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Documents/Projects/bcogapp_data/m10')
REPO = Path(sys.argv[2] if len(sys.argv) > 2 else Path.home() / 'Documents/Projects/bcogapp')
WORDS = REPO / 'src/sim/memory/words'
CORPUS_MILLIONS = 51.0

freq = {}
with open(DATA / 'SUBTLEXus74286wordstextversion.txt', encoding='latin-1') as f:
    head = f.readline().rstrip('\n').split('\t')
    iw, ic = head.index('Word'), head.index('FREQcount')
    for line in f:
        cols = line.rstrip('\n').split('\t')
        if len(cols) > ic:
            try:
                freq[cols[iw].lower()] = float(cols[ic]) / CORPUS_MILLIONS
            except ValueError:
                pass

conc = {}
with open(DATA / 'Concreteness_ratings_Brysbaert_et_al_BRM.txt', encoding='utf-8') as f:
    head = f.readline().rstrip('\n').split('\t')
    col = {h: i for i, h in enumerate(head)}
    for line in f:
        c = line.rstrip('\n').split('\t')
        if len(c) >= len(head):
            conc[c[col['Word']].lower()] = (float(c[col['Conc.M']]), float(c[col['Percent_known']]), c[col['Dom_Pos']])

def lists_in(path: Path, names):
    src = path.read_text(encoding='utf-8')
    out = []
    for name in names:
        m = re.search(name + (r'\s*=\s*(\[[^\n]*\])' if name == 'NEW_WORDS' else r'[^=]*=\s*(\[[\s\S]*?\n\])'), src)
        if not m:
            continue
        block = m.group(1)
        for lm in re.finditer(r"list\('(\w+)',\s*\[([^\]]*)\]\)", block):
            out.append((lm.group(1), re.findall(r"'([a-z]+)'", lm.group(2))))
        if name == 'NEW_WORDS':
            out.append(('new', re.findall(r"'([a-z]+)'", block)))
    return out

chosen = lists_in(WORDS / 'lists.ts', ['UNRELATED_SHORT', 'UNRELATED_LONG', 'NEW_WORDS'])
sets_src = (WORDS / 'sets.ts').read_text(encoding='utf-8')
for sm in re.finditer(r"id: '(set-\w)'([\s\S]*?)\n  \},", sets_src):
    words = []
    for sub in re.finditer(r"sub\('([^']+)', \[([^\]]*)\]\)", sm.group(2)):
        words += re.findall(r"'([a-z]+)'", sub.group(2))
    chosen.append((sm.group(1), words))

flagged = 0
with open(DATA / 'chosen.txt', 'w', encoding='utf-8') as out:
    out.write('list\tword\tconcreteness\tper_million\tknown\tpos\tflag\n')
    for lid, words in chosen:
        for w in words:
            c = conc.get(w)
            fpm = freq.get(w)
            flag = ''
            if c is None or fpm is None:
                flag = 'not in the norms'
            else:
                if c[0] < 4.5:
                    flag += 'concreteness below 4.5; '
                if fpm < 5:
                    flag += 'under 5 per million; '
                if c[2] != 'Noun':
                    flag += f'dominant part of speech {c[2]}; '
            if flag:
                flagged += 1
            out.write(f"{lid}\t{w}\t{c[0] if c else ''}\t{fpm if fpm is not None else ''}\t{c[1] if c else ''}\t{c[2] if c else ''}\t{flag.strip()}\n")
print(f'{sum(len(w) for _, w in chosen)} words checked, {flagged} flagged; see {DATA / "chosen.txt"}')
