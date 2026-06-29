# The Wealth–Health Divide: Does Money Buy Survival?

An interactive **D3.js v7** dashboard for **CDS6324 Data Visualization** (Tutorial TT2L — **SDG 3: Good Health & Well-being**). Six coordinated visualizations explore whether national wealth translates into survival across OECD, OPEC, and other countries, **1960–2011**.

> **Three analytical questions**
> 1. **The Wealth Divide** (Targets 3.2, 3.4) — How do life expectancy & infant mortality differ between OECD and OPEC nations, and has the gap narrowed? → **V1, V2**
> 2. **The GDP Threshold** (Target 3.2) — Is there a GDP-per-capita threshold beyond which infant mortality collapses? → **V4, V5**
> 3. **Regional Convergence** (Targets 3.4, 3.8) — Has the life-expectancy gap between regions narrowed over time? → **V3, V6**

---

## How to run

The dashboard reads JSON with `d3.json`, so it must be served over HTTP (opening `index.html` as a `file://` will be blocked by the browser). **The processed data is already included** — you do **not** need to run the Python pipeline to view the dashboard.

```bash
# from the PROJECT ROOT (the folder containing this README):
py -m http.server 8000          # or:  python -m http.server 8000
```

Then open: **http://localhost:8000/dashboard/**

That's it — D3, topojson, and the world map are vendored locally (`dashboard/vendor/`, `data/processed/countries-110m.json`), so the dashboard works fully **offline**.

### Rebuilding the data (optional)

Only needed if you change the raw CSVs. Requires Python 3 + pandas (`pip install -r requirements.txt`). Place the two Kaggle CSVs in `data/raw/` (`gapminder.csv`, `UnifiedDataset.csv`), then:

```bash
py preprocessing/clean_merge.py
```

This prints a QC report and writes `data/processed/dataset.json` + `meta.json`.

---

## Layout — a fullscreen, overview-first dashboard

The six charts sit in a **3×2 grid that fills one screen** (no scrolling) — "overview first" (Shneiderman). Each tile shows only its headline + chart; the **⤢ button expands any chart** to a full-screen focus view with axes, legend and insight ("details on demand"). The header carries the controls that drive all six: a year cursor with **play**, an **OECD/OPEC/All** toggle, a **region** colour-key/filter, and a country **search/spotlight**.

## The six visualizations (health-forward redesign)

| ID | Chart | Owner | Q | Interactions |
|----|-------|-------|---|--------------|
| **V1** | Animated bubble (GDP/cap × life expectancy, size = population) | A | Q1, Q2 | **Animation** (play/pause/scrub), hover, filter, linked highlight, expand |
| **V2** | **"Is the health gap closing?"** — OECD vs OPEC vs Other median lines over time | A | Q1 | **Life-expectancy ↔ child-mortality toggle**, hover-guide, year cursor, linked overlay |
| **V3** | **"What drives a longer life?"** — diverging bars of each factor's correlation with life expectancy | B | Q2 | Hover (n + r), updates with year/filters |
| **V4** | Choropleth world map (child mortality) | B | Q2, Q3 | **Wheel-zoom + drag-pan**, hover, click country → link, filter |
| **V5** | **"Does money buy survival?"** — one-year GDP × child-mortality scatter, threshold line + trend curve | C | Q2 | Hover, current-year dots track the cursor, linked highlight, filter |
| **V6** | **"Are regions converging?"** — combined region median lines, **toggle → 6 small-multiple panels** | C | Q3 | **Combined/By-region toggle**, year guide, selected-country overlay, filter |

### The five mandatory interactivity types (assignment §3.5)
- **Hover tooltips** — every chart, exact values + supplementary indicators.
- **Filtering** — header year cursor, OECD/OPEC/All toggle, region multi-select; plus V2's outcome toggle and V6's combined/by-region toggle.
- **Zoom / pan** — V4 (map wheel-zoom + pan); the expand/focus view enlarges any chart to full screen.
- **Linked interactions** — clicking a country in **V4**, **V1** or **V5** highlights it in **V1, V5, V2, V6** (and dims the rest); header filters update all six simultaneously.
- **Animation** — V1 plays through the years (keyed, tweened bubbles); the V2/V5/V6 year-guides move with it (Tversky congruence).

---

## Project structure

```
data/
  raw/            two Kaggle CSVs (git-ignored, not in submission)
  processed/      dataset.json, meta.json, countries-110m.json  (generated/vendored)
preprocessing/
  clean_merge.py  pandas pipeline: clean → derive → merge → export JSON + QC report
  country_lookup.py  OECD/OPEC membership, 6-region canon map, name normalisation
  iso_map.py      embedded name → ISO code map (pre-generated; no runtime dependency)
dashboard/
  index.html      single-page app (fullscreen CSS-grid + expand/focus overlay)
  css/style.css   one shared typographic + colour system
  vendor/         d3.v7.min.js, topojson-client.min.js  (offline-safe)
  js/
    config.js  util.js  state.js  scales.js  data.js   (shared foundation)
    v1_bubble.js  v2_gap_line.js  v3_drivers.js
    v4_choropleth.js  v5_threshold_scatter.js  v6_small_multiples.js   (one file per chart)
    main.js     loads data, wires header → state, mounts the six charts, owns the focus/expand controller
docs/             governing artifacts (assignment, proposal, rubrics, handoff)
plan.md           the approved implementation plan
```

The dashboard is a **coordinated** dashboard: a single shared store (`state.js`) holds the year cursor, filters, and selection, and broadcasts typed events (`year` / `filter` / `select`) that each chart subscribes to. Encodings (the region colour scale, the sequential severity scale, the GDP/population scales) are defined **once** in `scales.js` and imported everywhere, so a country is the same colour in all six views.

---

## Data sources

- **Primary** — *Health and Income Outcomes of OECD & OPEC Countries* (Gapminder-derived), Kaggle: `utkarshx27/health-and-income-outcomes`. 185 countries, 1960–2016.
- **Supplementary** — *Global Health, Nutrition, Mortality, Economic Data*, Kaggle: `miguelroca/global-health-nutrition-mortality-economic-data`. Merged on `country` + `year`.
- **World map** — `world-atlas@2` TopoJSON (`countries-110m`).

**Merged dataset:** 9,620 records · 20 attributes · 185 countries · 1960–2011 (clears the assignment's ≥3,000 records / ≥10 attributes / temporal+spatial requirement).

---

## Design / data decisions (documented deviations from the proposal)

These were resolved against the *real* data and are surfaced here per the handoff's "visibly note any deviation" rule:

1. **GDP is per-capita-derived.** The primary `gdp` column is *total* GDP, so we compute `gdp_per_capita = gdp / population` for the axes and wealth tiers.
2. **Analysis window 1960–2011** (not 2016). GDP is only reported through 2011 in the source; the window is trimmed to the GDP era so every year on the cursor populates all six (GDP-centric) charts instead of going blank.
3. **`gdp_tier`** uses **World Bank income bands** (per-capita), **`mortality_tier`** uses infant-mortality cutoffs (Critical >50, High 25–50, Moderate 10–25, Low <10 per 1,000) — defensible ordinal buckets rather than arbitrary quartiles.
4. **`bloc`** (OECD/OPEC/Other) uses official **current** membership held constant across years (accession dates not modelled).
5. **6 macro-regions** (World Bank style) collapsed from the source's 22 UN sub-regions.
6. **Supplementary fields:** the source has no "child malnutrition" column, so enrichment uses indicators that map directly onto the three SDG-3 targets (under-5 & neonatal mortality, cardiovascular NCD share, plus TB/malaria/maternal and gov. health spend), shown in tooltips.
7. **Single year cursor + play controls** instead of a literal year-*range* slider (animation and snapshot charts need one current year).
8. **Health-forward chart redesign** (after a beginner-usability review). Three charts from the proposal were replaced with simpler, health-led ones, because they were hard for a non-expert to read (sunburst = abstract nested rings; slope = overlapping labels; connected scatter = empirically the slowest/most error-prone common chart):
   - **V2 sunburst → "Is the health gap closing?"** OECD/OPEC/Other median life-expectancy (or child-mortality) lines over time — answers Q1 far more directly.
   - **V3 slope → "What drives a longer life?"** a ranked diverging-bar chart of each factor's correlation with life expectancy (GDP, health spending, fertility, TB, malaria, maternal deaths). Bars beat slopegraphs for general audiences. Shown as **correlation, stated on-chart as *not* proof of cause**.
   - **V5 connected scatter → "Does money buy survival?"** a clean one-year GDP × child-mortality scatter with the threshold line + an overall trend curve.
   - **V6** gains a **combined median-lines default** with a toggle to the original 6-panel small multiples.
9. **Fullscreen overview grid + click-to-expand** instead of a long scroll (overview first → details on demand).
10. **Storytelling layer.** Chart titles state the takeaway in plain language; a data-driven standfirst summarises the finding; on-chart annotations point at the key insight; and the region colour key lives once in the header (not repeated on every chart).

All redesigned views still satisfy the brief: **≥6 interactive charts · 2 per student · 3 analytical questions · 5 interactivity types.**

---

## Colour & accessibility

Categorical hues are from the **Okabe-Ito** colour-blind-safe palette; sequential/ordinal scales use **ColorBrewer** ramps (lightness-ordered, not red-green dependent). Neutral backgrounds and muted gridlines maximise the data-ink ratio (Tufte); one font system throughout (Shaffer's *Clean*, Cole Nussbaumer's *Aesthetics*).

## Testing

Charts were verified with a headless jsdom harness (mount + drive every interaction path against the real data) and a headless-Chrome render. Both confirm all six charts render and the linked selection propagates across every view.
