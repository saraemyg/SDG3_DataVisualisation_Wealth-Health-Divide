# Implementation Plan — "The Wealth–Health Divide" (SDG 3 D3.js Dashboard)

## Context

This is the build-out of an **already-approved** course project (CDS6324, tutorial TT2L, SDG 3). `docs/handoff.md` hands an approved proposal (`docs/SDG3_Project_Proposal.docx`) to implementation; `docs/assignment_req.md` is the lecturer's binding contract and `docs/rubrics.md` is the marking scheme. The handoff's **mandatory first step is to produce this plan and stop for approval** before any code is written. The deliverable is a single-page D3.js dashboard of **six interactive visualizations** answering **three analytical questions**, with **five mandatory interactivity types**, due **5 July 2026 (30% of coursework)**, submitted as a ≤2MB zip that must work standalone.

The repo is currently empty apart from `docs/`. This plan covers the full system: pandas data pipeline → shared front-end modules → 6 charts → integrated dashboard with linked interactions. Once approved, it will be built in **one continuous pass** (per handoff §"MANDATORY FIRST STEP").

**Decisions locked with the user before planning:**
- **Raw data:** user will place the two Kaggle CSVs into `data/raw/` (Kaggle needs auth; no CLI). Pipeline reads from there.
- **Libraries:** D3 v7, topojson-client, and world-atlas TopoJSON are **vendored locally** (offline-safe grading; fits 2MB after zip compression).
- **Supplementary dataset:** **full merge as proposed** (health expenditure %GDP, child malnutrition, TB/malaria mortality), joined on `country`+`year`.

---

## 1. Repo / Folder Structure

Adopts the handoff §9 suggestion, plus a `/vendor` dir for the locally-vendored libraries and a `.gitignore`/zip-exclude for raw CSVs.

```
/data
  /raw                     (Kaggle CSVs — user-provided; excluded from submission zip)
  /processed               (pipeline output: dataset.json, meta.json)
/preprocessing
  clean_merge.py           (pandas: load, normalize, derive, merge, export JSON + print QC report)
  country_lookup.py        (OECD/OPEC membership, region canon map, name→ISO numeric map)
/dashboard
  index.html
  /css
    style.css
  /vendor                  (d3.v7.min.js, topojson-client.min.js — vendored, offline-safe)
  /js
    config.js              (dimensions, margins, palette, fonts, tier thresholds)
    scales.js              (shared categorical + sequential + log scales; single source of truth)
    state.js               (shared filter/selection state + d3.dispatch pub-sub)
    data.js                (loads dataset.json/meta.json/topojson; derives per-chart shapes)
    v1_bubble.js  v2_sunburst.js  v3_slope.js
    v4_choropleth.js  v5_connected_scatter.js  v6_small_multiples.js
    main.js                (init: load data, build scales, mount 6 charts, wire header→state)
/docs                      (governing artifacts already here; add report.docx later)
README.md                  (run instructions: local static server + open localhost)
```
The 3 governing artifacts already live in `/docs` — they stay there as the source of truth and are re-consulted at every milestone. `data/processed/countries-110m.json` (world-atlas TopoJSON) is vendored too (it must be fetched at runtime regardless).

---

## 2. Data Pipeline Plan (`preprocessing/clean_merge.py`, Python 3.14 + pandas 3.0.3)

**Steps:**
1. **Load** primary (`health-and-income-outcomes`, 1960–2016) and supplementary (`global-health-nutrition-mortality-economic-data`, 1990–2019) CSVs from `data/raw/`.
2. **Normalize country names** to a canonical form; build `iso_numeric` (ISO 3166-1 numeric, matches world-atlas `id`) + `iso_a3` via a name→ISO map (use `pycountry` if installable, else a hand-maintained dict in `country_lookup.py`). Reconcile known mismatches ("United States"/"…of America", "Russia"/"Russian Federation", "South Korea"/"Korea, Rep.", etc.).
3. **Canonicalize `region`** to the 6 World Bank regions the proposal names for V6: Europe(+Central Asia), Americas, Sub-Saharan Africa, East Asia & Pacific, South Asia, Middle East & North Africa.
4. **Derive fields** (computed here, never in D3):
   - `bloc` — OECD / OPEC / Other from official member lists (see §7 open items); applied as static current membership.
   - `gdp_tier` — Low / Lower-Middle / Upper-Middle / High via World Bank income bands (see §7).
   - `mortality_tier` — Critical / High / Moderate / Low by `infant_mortality` thresholds (see §7).
5. **Merge** supplementary onto primary via left join on `country`+`year` (keeps all primary country-years; pre-1990 rows get null supplementary fields → tooltips render "n/a"). Per the "full merge" decision, retain `health_expenditure_pct_gdp`, `child_malnutrition`, `tb_mortality`, `malaria_mortality`.
6. **Clean**: coerce numerics, drop rows missing the core charting fields (`gdp`, `life_expectancy`, `infant_mortality`), keep `fertility`/supplementary as optional.
7. **Export** rounded JSON (gdp→int, rates→1–2 dp) to keep size down, and **print a QC report**: final row count, attribute count, year span, country/region/bloc counts — to confirm the **≥3,000 records / ≥10 attributes / temporal+spatial** requirement (assignment §3.2). The full merge with the ~195-country supplementary set clears 3,000 comfortably even though OECD+OPEC alone (~50 countries) may not.

**Output schema:**
- `data/processed/dataset.json` — long-format array of country-year records:
  ```jsonc
  { "country":"Norway", "iso_numeric":"578", "iso_a3":"NOR", "year":1990,
    "region":"Europe", "bloc":"OECD", "gdp":38000, "population":4241000,
    "fertility":1.93, "life_expectancy":76.5, "infant_mortality":7.0,
    "gdp_tier":"High", "mortality_tier":"Low",
    "health_expenditure_pct_gdp":7.7, "child_malnutrition":null,
    "tb_mortality":1.2, "malaria_mortality":null }
  ```
  Consumed by all 6 charts; V2's hierarchy and V6's regional bands are aggregated client-side so they react to filters.
- `data/processed/meta.json` — `{ yearMin, yearMax, regions[], blocs[], domains:{gdp,population,life_expectancy,infant_mortality,health_exp}, tierThresholds:{gdp,mortality} }` — feeds shared scale domains deterministically.
- `data/processed/countries-110m.json` — vendored world-atlas TopoJSON for V4.

---

## 3. Per-Chart Technical Plan (all 6 use D3 v7)

Each chart module exposes `init(rootSel, data, scales)` + `update(state)`; `update` reads `state.selectedCountry`/`currentYear`/`blocFilter`/`regions` for linked behavior.

| ID | Chart / Owner | D3 modules & layout | Data shape | Answers (how) |
|---|---|---|---|---|
| **V1** | Animated bubble / A | `scaleLog`(x=gdp), `scaleLinear`(y=life_exp), `scaleSqrt`(r=population), shared ordinal color; `d3.interpolate`+`transition` keyed by `country` (tween, not redraw) | `d3.group(data, d=>d.year)` → per-year arrays | **Q1,Q2**: watch OECD vs OPEC trajectories diverge/converge 1960→2016 |
| **V2** | Zoomable sunburst / A | `d3.hierarchy`+`d3.partition`+`d3.arc`; built via `d3.rollup` on current-year slice | nested `bloc→gdp_tier→mortality_tier→country`, value=population | **Q1**: part-to-whole of bloc/wealth/mortality; **deepest ring = country** so click emits selection |
| **V3** | Slope chart / B | two `scaleLinear` axes + `d3.line`; two year `<select>` dropdowns (V3-owned filter) | top-20 by life_exp at yearB: `{country,region,valA,valB}` | **Q3**: rank change in life expectancy between two user-chosen years |
| **V4** | Choropleth / B | `geoNaturalEarth1`+`geoPath`, `topojson.feature`; shared `scaleSequential` on infant_mortality; `d3.zoom` (wheel zoom + drag pan) | current-year map keyed by `iso_numeric` ↔ TopoJSON `id` | **Q2,Q3**: spatial clustering of infant mortality; which regions stay high |
| **V5** | Connected scatter / C | `scaleLog`(x=gdp), `scaleLinear`(y=infant_mortality), `d3.line` per country across years; threshold annotation band | `d3.group(data, d=>d.country)`, each sorted by year | **Q2**: GDP threshold where mortality collapses; trajectory non-linearities |
| **V6** | Small multiples area / C | 6 faceted panels, `d3.area` min–max band + median line, **identical x/y scales across panels** | per region: per-year `{min,median,max}` life_exp band | **Q3**: regional convergence (band narrowing) vs persistent divergence |

**Shared across all:** one categorical color scale (region/bloc, ColorBrewer colourblind-safe) + one sequential scale (health severity), defined once in `scales.js`, imported everywhere (satisfies "appropriate graphic variable types" + "data-ink ratio" rubric lines). **Every chart gets a legend describing every encoding channel** (colour, size, position) — explicitly graded (1 mark).

---

## 4. Dashboard Shell Plan

- **Layout:** single-page app, CSS Grid, persistent header + 3 rows (proposal §5): Row1 Attract = V1 (~2/3) + V2 (~1/3); Row2 Engage = V4 (1/2) + V3 (1/2); Row3 Punchline = V5 (1/2) + V6 (1/2).
- **Header controls (affect all charts):** **single current-year slider with play/pause/scrub** (drives V1 animation frame, V4 & V2 snapshots, and a current-year marker on V5/V6), **OECD/OPEC/All toggle**, **region multi-select**. *(See §7 — this unifies the proposal's "year range slider" + animation scrubber into one cursor; documented deviation.)*
- **Shared state (`state.js`):** `{ currentYear, blocFilter, regions:Set, selectedCountry, slopeYearA, slopeYearB }` with a `d3.dispatch` pub-sub. Controls mutate state → dispatch `"change"` → every subscribed chart's `update(state)` re-renders the affected parts. This single store is what makes linked interactions work uniformly.
- **Shared config/scales (`config.js`,`scales.js`):** margins, fonts, palette, and all scales built from `meta.json` domains — single source of truth, no per-chart redefinition.
- **Loader (`data.js`/`main.js`):** `Promise.all([d3.json(dataset), d3.json(meta), d3.json(topojson)])` → build scales → mount all 6 → wire header.

---

## 5. Interactivity Implementation Plan (all 5 mandatory — assignment §3.5)

| Requirement | Owner chart(s) | Wiring |
|---|---|---|
| **Hover tooltips** | All 6 | Shared tooltip `<div>`; each chart's mark `mousemove` shows country, year, exact values + supplementary (health exp / malnutrition / TB / malaria, "n/a" pre-1990) |
| **Filtering** | Header (year cursor, bloc toggle, region multi-select) + V3's two year dropdowns | Controls write to `state` → dispatch → all relevant charts filter/redraw |
| **Zoom / pan** | V4 (`d3.zoom` wheel+drag), V2 (click-to-zoom into sub-hierarchy via arc tween) | Min two charts per handoff; both native D3 patterns |
| **Linked interactions** *(4 marks — top priority)* | Source: click country in **V4** or country-ring in **V2** → set `state.selectedCountry`; sink: **V1**, **V5** (and V4/V2) highlight/dim. Header filters update all 6. | Pure state-driven: charts read `state.selectedCountry` in `update()`; emphasize selected, dim others |
| **Animation** (temporal, interactive) | **V1** play/pause/scrub | `d3.timer`/transition advances `currentYear`; bubbles keyed by country tween via `d3.interpolate`; slider scrubs. Tversky congruence (visual change = real data change) |

---

## 6. Build Order & Milestones (one continuous pass; mirrors the 4-week internal ordering)

1. **Scaffold** dirs + vendor D3/topojson + `.gitignore` for `data/raw`.
2. **Data pipeline** (`clean_merge.py`) → `dataset.json`+`meta.json`; **print & verify QC counts** (≥3,000 / ≥10 attrs). — *Milestone M1: data verified.*
3. **Shell**: `config.js`/`scales.js`/`state.js`/`data.js`, `index.html` grid, `main.js` loader. Build **V1 (bubble→animation)** + **V4 (choropleth→zoom/pan)** with tooltip + header filters. — *M2: spine + 2 charts working.*
4. **Remaining charts** in order V2 → V3 → V5 → V6 (static render → tooltip → filters each). — *M3: all 6 render.*
5. **Linked interactions** across all (selectedCountry, year cursor, bloc/region) + **legends** on every chart. — *M4: interactivity complete.*
6. **Polish**: colourblind palette, consistent font/sizing, neutral backgrounds, data-ink trim, V5 threshold annotation, responsiveness; **README** (run via `py -m http.server` then open `localhost`); rubric self-check pass.

---

## 7. Open Questions / Assumptions (resolved here, to confirm at build)

1. **`gdp` semantics** — Assume **GDP per capita (income/person)**, since V1 is Gapminder-style (population is a separate size channel) and Q2 references a "GDP per capita threshold." **Verify against CSV header/units**; if it's total GDP, derive `gdp_per_capita = gdp/population` for x-axes & `gdp_tier`.
2. **OECD/OPEC membership** — Use **official current member lists** (OECD 38; OPEC ~12) as **static** membership across all years (not modelling accession dates). Everything else = "Other". Documented simplification.
3. **`gdp_tier` bands** — **World Bank income classification** (per-capita thresholds) over arbitrary quartiles, for report defensibility. Confirm dataset currency/PPP basis matches; adjust band cutoffs to dataset units if needed.
4. **`mortality_tier` cutoffs** — Proposed (infant deaths/1,000): Low <10, Moderate 10–25, High 25–50, Critical >50 (aligns with SDG 3.2's 25/1,000 target). These are deliberate choices, stated in report.
5. **Region canon** — Map dataset `region` values to the 6 World Bank regions V6 requires; resolve any unmapped countries.
6. **Choropleth join** — Country-name → ISO 3166-1 **numeric** map to match world-atlas `id`; handle name mismatches (pycountry or hand map).
7. **world-atlas** — Vendor `countries-110m.json` (world-atlas v2 TopoJSON) locally + topojson-client to convert. (Decision: vendored.)
8. **Year control (deviation)** — Implementing a **single current-year cursor + play controls** instead of the proposal's literal "year *range* slider," because animation/snapshot charts need a single year and a range adds little. Visibly noted per handoff rules.
9. **V2 country ring (deviation)** — Adding **country as a 4th (outer) ring** to the sunburst so "click a country in V2 → highlight elsewhere" (handoff §6) genuinely works; proposal described 3 rings. Visibly noted.
10. **Supplementary coverage gap** — Supplementary is 1990–2019; pre-1990 primary rows carry null supplementary fields (tooltips show "n/a"). All primary years retained.
11. **Record count** — Confirm actual ≥3,000 after merge in the QC print; report it back (handoff §2 asks for this).
12. **V5 threshold value** — Determine the GDP threshold empirically from the cleaned data; annotate per the proposal's narrative.
13. **2MB zip** — The cap is on the *zipped* size; text (JSON/JS) compresses ~3–5×, so a ~2–3MB `dataset.json` + vendored libs comfortably fits. Still round floats / prune nulls; **exclude `data/raw` CSVs** from the submission zip.

---

## 8. Rubric Coverage Map (every feature ties to a graded line)

| Rubric line (marks) | Where satisfied |
|---|---|
| Graphic variable types (2) | Shared `scales.js`: position/size for quantitative, hue for nominal, sequential for ordinal |
| Appropriate charts (2) | 6 chart types each matched to a question (§3 table) |
| Legends explain every channel (1) | Per-chart legends for colour/size/position |
| Animation (1) | V1 temporal play/pause/scrub |
| Interactivity usable/actionable (4) | All 5 types; linked selection prioritized (§5) |
| Dashboard design (2) | CSS-grid Attract/Engage/Punchline shell (§4) |
| Data-ink ratio (2) | Neutral bg, muted gridlines, no chartjunk, shared minimal styling |
| Graphics integrity & impact (2) | Honest scales (log labelled), threshold annotation, observation-not-directive framing |
| Best practices: 4Cs/4As (2) | Encoded in code comments + report (proposal §7) |
| Relevance / data sufficiency / story (1+1+1) | SDG 3 targets 3.2/3.4/3.8; merged dataset ≥3,000×≥10; 3 questions |
| Data story design (2) | Attract→Engage→Punchline narrative arc |
| Aesthetics (2) | Colourblind-safe palette, consistent typography, whitespace |
| Report quality (3) | Built after dashboard works (`docs/report.docx`) |

---

## 9. Verification (how the finished build will be tested end-to-end)

1. **Pipeline:** run `py preprocessing/clean_merge.py`; confirm QC print shows ≥3,000 records, ≥10 attributes, year span 1960–2019, and valid `dataset.json`/`meta.json`.
2. **Serve:** `py -m http.server 8000` from `/dashboard`, open `http://localhost:8000` — confirms `d3.json` loads (file:// would CORS-fail).
3. **Per-chart checklist:** each of the 6 renders, has a legend, and shows a hover tooltip with exact values.
4. **Interactivity checklist:** year slider + play animates V1 and updates V4/V2; bloc toggle + region multi-select update all relevant charts; V4 wheel-zoom/drag-pan works; V2 click-to-zoom works; **clicking a country in V4 or V2 highlights it in V1 and V5**; V3's two dropdowns reflow the slope chart.
5. **Offline check:** disconnect network, reload — dashboard still works (vendored libs).
6. **Submission check:** zip excluding `data/raw`; confirm ≤2MB and that the unzipped copy runs via the README steps.
7. **Governing-artifact re-check:** at each milestone, re-open `assignment_req.md` / proposal / `rubrics.md` and confirm no drift (handoff §"REMINDER").
