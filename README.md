# MAGE research demo

Interactive demo for **MAGE: Multi-Agent Self-Evolution with Co-Evolutionary Knowledge Graphs** (NeurIPS 2026).

- [Live demo](https://ruiyiyang01.github.io/mage-demo/)
- [Paper on OpenReview](https://openreview.net/forum?id=dhUiKcjH2m)
- [NeurIPS 2026](https://neurips.cc/virtual/2026/loc/sydney/poster/150998)

Authors: Ruiyi Yang, Zechen Li, Hao Xue, Imran Razzak, and Flora Salim.

## Contents

The site includes one example for each of nine benchmarks, recorded experiment playback, graph snapshots, publication details, and a downloadable BibTeX citation. Each example identifies its evidence type. Illustrative memory bundles are distinguished from logged retrieval events.

## Preview

Run `python3 -m http.server 8000` from this directory and open `http://localhost:8000/`.

## Publish updates

GitHub Pages serves the root of the `main` branch. Commit and push changes to update the site; no build step is needed. All asset paths are relative so the site works under `/mage-demo/`.

`replays.json` contains the curated public records used by the demo. It does not contain model credentials or a live inference service.
