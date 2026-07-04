# The Wealth–Health Divide — Does Money Buy Survival?

An interactive **D3.js v7** dashboard for **CDS6324 Data Visualization** — Tutorial **TT2L**, Group **TT2L_G15**, theme **SDG 3: Good Health & Well-being**. Six coordinated visualizations explore whether national wealth translates into survival across OECD, OPEC and other countries, **1960–2011**.

Members: Jordan Ling Shen Hang · Sara Emilia Binti Sharifudin · Zainal Zaim Hakimi bin Zainal Effendy.

---

## Quick start (how to run)

The dashboard loads local JSON with `d3.json`, so it **must be served over HTTP** — double-clicking `index.html` (a `file://` URL) will be blocked by the browser. The processed data is already included, so you do **not** need Python to view it.

From the **project root** (the folder containing this README):

```bash
py -m http.server 8000          # Windows;  on macOS/Linux use:  python3 -m http.server 8000
```

Then open **http://localhost:8000/dashboard/** and hard-refresh once (**Ctrl/Cmd + Shift + R**) to beat the cache.

**If the port is busy** (e.g. `WinError 10013` / "address already in use" — common when Docker or another app holds 8000), just pick a free port:

```bash
py -m http.server 8080          # then open  http://localhost:8080/dashboard/
```

Everything (D3, topojson, the world map, all data) is bundled locally, so the dashboard runs fully **offline**. The only feature that needs internet is the optional Wikipedia **photo** shown when hovering an event marker — the click-through link and all text still work offline, and a missing image is silently hidden.

---

## Assignment requirements — compliance check

| Requirement | Status |
|---|---|
| ≥ 6 meaningful interactive visualizations (2 per student × 3) | ✅ 6 charts |
| D3.js as the primary library; HTML / CSS / JavaScript | ✅ D3 v7 (vendored), plain HTML/CSS/JS |
| Dataset ≥ 3,000 records | ✅ **9,620** records |
| Dataset ≥ 10 attributes | ✅ **20** attributes |
| Temporal or spatial dimension | ✅ both — `year` (1960–2011) and `country`/ISO code |
| ≥ 3 analytical questions | ✅ 3 (Q1–Q3, see below) |
| 5 interactivity types (hover, filter, zoom/pan, linked, animation) | ✅ all five (see "Interactivity") |
| Cohesive, integrated dashboard | ✅ one coordinated single-page app |
| Works in submitted form | ✅ runs from the bundle, offline |
| Submission ≤ 2 MB (zipped) | ✅ **~0.58 MB** zipped |

---

## The three analytical questions & six charts

The dashboard is arranged as **three question-columns**, read left → right (Q1 → Q2 → Q3). Charts are numbered **by question**: Q1 = V1, V2 · Q2 = V3, V4 · Q3 = V5, V6.

| # | Chart | Owner | Interactions |
|---|---|---|---|
| **Q1 — The Wealth Divide** (Targets 3.2, 3.4) | *Do OECD vs OPEC economies diverge in health?* | | |
| **V1** | Animated bubble — GDP/cap × life expectancy, size = population | Sara | animation (play/scrub), hover, filter, linked highlight, expand |
| **V2** | "Is the health gap closing?" — OECD/OPEC/Other median lines | Sara | life↔child toggle, year guide, event markers, linked overlay |
| **Q2 — The GDP Threshold** (Target 3.2) | *Is there an income tipping point for survival?* | | |
| **V3** | "Does money buy survival?" — GDP × child-mortality scatter, threshold + trend curve | Zaim | hover, current-year dots track the cursor, linked highlight, filter |
| **V4** | "What drives a longer life?" — diverging bars of each factor's correlation | Jordan | hover, recomputes with year/filters |
| **Q3 — Regional Convergence** (Targets 3.4, 3.8) | *Are regions catching up, or is geography destiny?* | | |
| **V5** | "Are regions converging?" — combined region medians, toggle → 6 small multiples | Zaim | combined/by-region toggle, event markers, selected-country overlay |
| **V6** | Choropleth world map — child mortality, 15 safest vs 15 deadliest gap panel | Jordan | wheel-zoom + drag-pan, hover, click → link, filter |

### The five interactivity types
- **Hover tooltips** — every chart shows exact values; event markers (V2, V5) add a Wikipedia photo + description.
- **Filtering** — header year cursor, OECD/OPEC/All toggle, region multi-select; plus V2's measure toggle and V5's view toggle.
- **Zoom / pan** — V6 (the map) has wheel-zoom + drag-pan; any chart expands to a full-screen focus view.
- **Linked interactions** — selecting a country (bubble/map/scatter) highlights it across all six and overlays its trajectory in V2 & V5; header filters update every chart at once (shared `state.js` pub-sub).
- **Animation** — V1 plays 1960→2011 with tweened bubbles; the year guides (V2, V5) and dots (V3) track the cursor in real time.

---

## Project structure

```
dashboard/
  index.html          single-page app (fullscreen 3x2 CSS grid + expand/focus)
  css/style.css       one shared typographic + colour system
  vendor/             d3.v7.min.js, topojson-client.min.js   (offline-safe)
  js/
    config.js util.js state.js scales.js data.js   shared foundation
    v1_bubble.js v2_gap_line.js v3_drivers.js
    v4_choropleth.js v5_threshold_scatter.js v6_small_multiples.js   one file per chart
    main.js           loads data, wires header -> state, mounts charts, owns expand/focus
data/
  raw/                the two Kaggle CSVs (NOT in the submission zip; needed only to rebuild)
  processed/          dataset.json, meta.json, countries-110m.json   (already generated)
preprocessing/
  clean_merge.py      pandas pipeline: clean -> derive -> merge -> export JSON + QC report
  country_lookup.py   OECD/OPEC membership, 6-region map, name normalisation
  iso_map.py          embedded name -> ISO code map (pre-generated; no runtime dependency)
report.txt            the written report
requirements.txt      Python deps for the (optional) rebuild
```

> **Note on numbering:** the JS file names keep their original creation order, which differs from the by-question numbering used in the report/README. Mapping: V3 = `v5_threshold_scatter.js`, V4 = `v3_drivers.js`, V5 = `v6_small_multiples.js`, V6 = `v4_choropleth.js` (V1/V2 unchanged). The dashboard itself shows no V-numbers, so this is invisible to users.

The dashboard is **coordinated**: a single store (`state.js`) holds the year cursor, filters and selection and broadcasts typed events (`year`/`filter`/`select`) that each chart subscribes to. All encodings (region colour, severity ramp, GDP/population scales) are defined **once** in `scales.js`, so a country looks the same in every view.

---

## Data sources

- **Primary** — *Health and Income Outcomes of OECD & OPEC Countries* (Gapminder-derived), Kaggle `utkarshx27/health-and-income-outcomes`. 185 countries, 1960–2016.
- **Supplementary** — *Global Health, Nutrition, Mortality & Economic Data*, Kaggle `miguelroca/global-health-nutrition-mortality-economic-data`. Merged on `country` + `year`.
- **World map** — `world-atlas@2` TopoJSON (`countries-110m`).

**Merged dataset:** 9,620 records · 20 attributes · 185 countries · 1960–2011.

### Rebuilding the data (optional)
Only needed if you change the raw CSVs. Requires Python 3 + pandas:

```bash
pip install -r requirements.txt
# place gapminder.csv and UnifiedDataset.csv in data/raw/ , then:
py preprocessing/clean_merge.py
```

This prints a QC report and rewrites `data/processed/dataset.json` + `meta.json`. (The ISO map is pre-embedded, so `pycountry` is not required at runtime.)

---

## Key design decisions

- **GDP is per-capita-derived** — the raw column is *total* GDP, so `gdp_per_capita = gdp / population`.
- **Window 1960–2011** — GDP is only reported through 2011; trimming keeps every year on the cursor fully populated.
- **`gdp_tier`** = World Bank income bands; **`mortality_tier`** by infant-mortality cut-offs (Critical >50, High 25–50, Moderate 10–25, Low <10 per 1,000).
- **`bloc`** = OECD/OPEC/Other (official current membership); **`region`** = six World Bank macro-regions.
- **Health-forward chart choices** — a bloc line chart (V2), a threshold scatter (V3) and a diverging-bar correlates chart (V4) replaced harder-to-read proposal charts (sunburst / connected-scatter / slope) for a general audience; V4 shows *correlation, stated on-chart as not proof of cause*.

### Colour & accessibility
Regions use the colour-blind-safe **Okabe-Ito** palette; blocs use a deliberately different palette; the map uses ColorBrewer **YlOrRd** (lightness-ordered); the correlates chart also encodes direction by bar side/sign, not colour alone. Neutral backgrounds and muted gridlines keep a high data-ink ratio.

---

## Testing
Verified with a headless jsdom harness (mount + drive every interaction path against the real data) and headless-Chrome renders — all six charts render, the layout fits one screen, and linked selection propagates across every view.
