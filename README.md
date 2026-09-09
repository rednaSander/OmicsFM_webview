# OmicsFM_webview

Interactive maps and attention networks learned by OmicsFM.

**Website: https://rednasander.github.io/OmicsFM_webview/**

Explore proteomics, bulk transcriptomics and single-cell transcriptomics through
sample/cell maps and protein/gene identity maps. Proteomics and bulk transcriptomics
also provide tissue-specific attention networks with saved layouts and partner search.

## Run locally

Download or clone this repository. On Windows, double-click `start-local.cmd`.
Alternatively, run `python -m http.server 8000 --bind 127.0.0.1` in this directory
and open http://localhost:8000. Python is needed only for this local web server.
Do not open the HTML files directly: the plots fetch their JSON data over HTTP.

## Hosting

GitHub Pages publishes the root of the `main` branch. `.nojekyll` serves the
exported HTML, JavaScript and JSON directly, without a build step. All internal
links and data requests are relative, supporting the repository URL prefix.
React and vis-network are bundled locally; Google Fonts has system-font fallbacks.

The checkout contains the website and its runtime data. Model checkpoints,
raw experimental data, notebooks, export archives and development backups are
maintained separately and are not needed to browse these maps.

## Checks

With Node.js installed:

```sh
node scripts/verify-site.cjs
node scripts/verify-home-carousel.cjs
```

## Project and paper

- Source project: https://github.com/CompOmics/OmicsFM
- Paper: https://www.biorxiv.org/content/10.64898/2026.08.25.747021v1
- Model checkpoints: https://huggingface.co/rednaSander/omicsfm

Sander Heyndrickx, Ralf Gabriels, Harikrishnan Ramadasan, Lennart Martens and
Tine Claeys. CompOmics, VIB-UGent Center for Medical Biotechnology, Ghent.
