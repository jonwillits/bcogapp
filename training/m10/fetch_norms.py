"""Fetch the two public word-norm files into the data folder (see README.md).

    python -I fetch_norms.py [data_dir]

Writes Concreteness_ratings_Brysbaert_et_al_BRM.txt, subtlexus1.zip (SUBTLEX-US
with PoS and Zipf, Excel) and subtlexus2.zip (SUBTLEX-US text version), and
unpacks the zips. A URL that fails is reported and the others still fetched.
"""
import sys
import zipfile
from pathlib import Path
from urllib.request import urlretrieve

DATA = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / 'Documents/Projects/bcogapp_data/m10')
SOURCES = {
    # The CRR site's own path returned 404 on 2026-10-25; this GitHub mirror carries the authors' file unchanged.
    'Concreteness_ratings_Brysbaert_et_al_BRM.txt': 'https://raw.githubusercontent.com/ArtsEngine/concreteness/master/Concreteness_ratings_Brysbaert_et_al_BRM.txt',
    'subtlexus1.zip': 'https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus/subtlexus1.zip',
    'subtlexus2.zip': 'https://www.ugent.be/pp/experimentele-psychologie/en/research/documents/subtlexus/subtlexus2.zip',
}

DATA.mkdir(parents=True, exist_ok=True)
for name, url in SOURCES.items():
    target = DATA / name
    try:
        urlretrieve(url, target)
        print(f'fetched {name}: {target.stat().st_size} bytes')
    except Exception as e:  # noqa: BLE001
        print(f'FAILED {name} from {url}: {e}')
        continue
    if name.endswith('.zip'):
        with zipfile.ZipFile(target) as z:
            z.extractall(DATA)
            print('  unpacked', z.namelist())
