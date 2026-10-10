# Module 8 training pipeline

Everything that made the networks and the stimuli for `m08-objects`, run once on Jon's Mac. Datasets, renders and the virtual environment live outside the repo and outside Box, at `~/Documents/Projects/bcogapp_data/m08/`; only these scripts, the exported models, the shipped images and the manifests are in git. Never `pip install` inside Box.

Set up: `python3 -m venv --system-site-packages ~/Documents/Projects/bcogapp_data/m08/venv && ~/Documents/Projects/bcogapp_data/m08/venv/bin/pip install -r requirements.txt`. Run every script with `python -I <script> …` from outside the data folders.

The order, with each script's docstring saying what it writes:

1. `download_quickdraw.py`, `download_openimages_csv.py`, `download_gso.py` — the three sources.
2. `prepare_openimages.py` (licence, person and size filters), `download_openimages_photos.py` (fetch and crop), `prepare_quickdraw.py` (rasterize with `raster.py`).
3. `render_gso.mjs` with `render/render.html` — Three.js in headless Chromium through Playwright, 55 views per object from `views.json`.
4. `train_drawing.py` (Version A; `--augment` for Version B), `train_photo.py` (standard, noise, blur). Each writes a `.metrics.json` beside its weights.
5. `export_model.py` — the app's own format (`public/m08/models/*.json` + `.bin`); `fixtures_drawing.py`, `fixtures_photo.py` — the 50-input agreement fixtures in `src/sim/objects/fixtures/`; `raster_fixtures.py`, `eraser_fixtures.py` — the rasterizer and eraser agreement fixtures.
6. `measure_drawing.py`, `measure_b_untrained.py`, `measure_erasers.py`, `measure_photo.py` — the spec §11 measurements, written to `*.measure.json` beside the models and copied into `public/m08/measurements.json` by `ship_measurements.py`.
7. `ship_scanned.py`, `ship_photos.py` — the shipped images, their manifests and NOTICEs; the display drawings are written by `measure_erasers.py`.

`raster.py` and `erasers.py` are shared line for line with `src/sim/objects/raster.ts` and `erasers.ts`; `noise.py` with `noise.ts`. Keep them in step: the agreement tests will say when they are not.
