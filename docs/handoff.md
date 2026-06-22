# HANDOFF TO CLAUDE CODE: "The Wealth-Health Divide" — SDG 3 D3.js Dashboard

## READ THIS FIRST

This document hands off an approved project proposal to you (Claude Code) for full implementation. Before touching this document's content, you must read three governing artifacts. They are the source of truth — this handoff is a working summary of them, not a replacement.

| Artifact | What it governs | Priority if conflict arises |
|---|---|---|
| `assignment_req.md` | The official course requirements: deliverables, mandatory tech stack, interactivity requirements, deadlines, submission format, rubric weighting | **Highest** — this is the lecturer's contract. Nothing in this handoff or the proposal may contradict it. |
| `SDG3_Project_Proposal.docx` | The approved proposal: SDG targets, dataset choice, the 3 analytical questions, the 6 visualizations and their justifications, dashboard layout, design principles | Second — this is what was submitted and graded at proposal stage. The final build must deliver what was promised here, or explicitly and visibly note any deviation and why. |
| `rubrics.md` | The exact marking criteria and point allocations for Proposal / Project / Presentation | Use this continuously as a self-check. Every feature you build should map to a rubric line. If a feature doesn't help hit a rubric line, it's not a priority. |

**Rule for the rest of this build:** at every major step (data pipeline, each chart, dashboard integration, interactivity, final polish), check back against these three files. Don't rely solely on your memory of this handoff once the build is underway — re-open them if anything is ambiguous.

---

## MANDATORY FIRST STEP: PLAN, THEN STOP

Do not write any code yet.

Your first task is to produce a written implementation plan and present it for validation. The plan must include:

1. **Repo/folder structure** you intend to create
2. **Data pipeline plan** — how you'll fetch/clean/merge/derive the datasets, what the output JSON schema(s) will look like
3. **Per-chart technical plan** for all 6 visualizations — D3 modules/layouts you'll use (e.g. `d3.hierarchy`, `d3.geoNaturalEarth1`, `d3.scaleSequential`), data shape each chart expects, and how each satisfies its assigned analytical question
4. **Dashboard shell plan** — layout grid, shared state management approach (how filters/year-slider/selection state propagate to all 6 charts), shared scales/config module
5. **Interactivity implementation plan** — concretely how each of the 5 mandatory interactivity types (hover, filter, zoom/pan, linked interactions, animation) will be wired, and which chart(s) own which
6. **Build order** — sequence you'll implement things in, and rough milestones
7. **Open questions or assumptions** you had to make, flagged explicitly (e.g. exact OECD/OPEC membership list, GDP tier thresholds, TopoJSON source)

Present this plan in full, then **stop and wait for explicit approval** before writing implementation code. Do not scaffold files, install packages beyond checking versions, or write any chart code until the plan is approved. If feedback is given, revise the plan and present it again before proceeding.

Once approved, build the entire system in one continuous pass — the full data pipeline, all 6 charts, the integrated dashboard, and all interactivity — rather than stopping after each individual chart for re-approval. Surface blockers as they arise, but the goal is a complete, working dashboard at the end of the approved build, not a piecemeal back-and-forth.

---

## 1. Project Identity

- **Title:** The Wealth-Health Divide: Does Money Buy Survival?
- **SDG Theme:** SDG 3 — Good Health and Well-being (tutorial section TT2L assignment, per `assignment_req.md` §3.1)
- **Targets covered:** 3.2 (newborn/child mortality), 3.4 (NCD mortality & well-being), 3.8 (universal health coverage)
- **Narrative arc:** Attract → Engage → Punchline
  - **Attract:** animated bubble chart + sunburst (global overview in motion)
  - **Engage:** choropleth map + slope chart (active exploration)
  - **Punchline:** connected scatterplot with GDP threshold annotation + small multiples (the conclusion)
- **Full justification for every choice below** lives in `SDG3_Project_Proposal.docx` — this handoff only summarizes enough to start building. Re-read the proposal's Section 4 ("Visualization Design") before implementing each chart's annotations/legends, since the report's wording should match what the dashboard actually does.

### Status & Deadlines (from `assignment_req.md`)
- Proposal: submitted, approved (Week 11, 12 June 2026 deadline — passed)
- **Final project deadline: Week 14, 5 July 2026, 11:59 PM** — 30% of coursework
- Submission: `StudentID1_StudentID2_StudentID3.zip`, max 2MB, via eBwise
- Presentation: Week 14, 5–10 minutes, all members must attend
- Build timeline guideline (4 weeks): Week 1 data + basic charts → Week 2 interactivity → Week 3 dashboard integration + linked interactions → Week 4 testing + docs. You are compressing this into one continuous build — keep the same internal ordering even if compressed.

### Mandatory tech stack (assignment_req.md §3.4 — non-negotiable)
- **D3.js** — primary library, ALL 6 visualizations must use it
- **HTML/CSS** — page structure and styling
- **JavaScript** — interaction logic, data flow
- Optional: GitHub (version control), Python/pandas (preprocessing only, not for rendering)
- **No Power BI, no Tableau, no charting libraries other than D3** (Chart.js, Recharts, etc. are not acceptable substitutes — the rubric specifically grades D3 usage)

---

## 2. Datasets

### Primary
**Health and Income Outcomes of OECD & OPEC Countries**
`https://www.kaggle.com/datasets/utkarshx27/health-and-income-outcomes`
- Coverage: 1960–2016, OECD + OPEC countries, country-year rows
- Raw columns: `country`, `year`, `region`, `gdp`, `population`, `fertility`, `life_expectancy`, `infant_mortality`

### Supplementary
**Global Health, Nutrition, Mortality, Economic Data**
`https://www.kaggle.com/datasets/miguelroca/global-health-nutrition-mortality-economic-data`
- Coverage: 1990–2019, ~195 countries, 100+ indicators
- Pull only: health expenditure (% GDP), child malnutrition prevalence, TB/malaria mortality
- Join key: `country` + `year`

### Derived fields (compute in preprocessing, not in D3 at render time)
| Field | Logic |
|---|---|
| `bloc` | OECD / OPEC / Other, based on official membership lookup — **flag this as an open question in your plan**: confirm exact OECD/OPEC country lists before coding |
| `gdp_tier` | Bucket into Low / Lower-Middle / Upper-Middle / High — **flag in plan**: recommend World Bank income classification bands over arbitrary quartiles, for defensibility in the report |
| `mortality_tier` | Bucket infant_mortality into Critical / High / Moderate / Low |

### Dataset requirement check (assignment_req.md §3.2)
Must clear: ≥3,000 records, ≥10 attributes, temporal or spatial dimension. This combination clears all three comfortably — confirm actual row count after the join/clean step and report it back.

Output of preprocessing should be clean JSON (one file per chart, or one shared dataset — your call, document the choice in the plan). Use Python/pandas for this step; do not preprocess inside D3/JS.

---

## 3. Analytical Questions (from the approved proposal — every chart must visibly answer at least one)

1. **Wealth Divide (Targets 3.2, 3.4):** How do life expectancy and infant mortality differ between OECD and OPEC nations 1960–2016, and has the gap narrowed or widened? → V1, V2
2. **GDP Threshold (Target 3.2):** Is there a GDP per capita threshold beyond which infant mortality drops sharply, and does it also predict life expectancy gains? → V4, V5
3. **Regional Convergence (Targets 3.4, 3.8):** Has the life expectancy gap between regions narrowed over 56 years, or stayed structurally divided? → V3, V6

---

## 4. The Six Visualizations

| ID | Owner (proposal) | Chart | Answers | Build notes |
|---|---|---|---|---|
| V1 | Student A | **Animated bubble chart** (Gapminder-style) | Q1, Q2 | x = gdp (log scale), y = life_expectancy, r = population (sqrt scale), fill = region/bloc. Play/pause/scrub timeline, 1960→2016. Use `d3.interpolate` + transitions, not full redraw per frame. This is the **mandatory animation deliverable** (assignment_req.md §3.5) — must be interactive, not decorative. |
| V2 | Student A | **Zoomable sunburst** | Q1 | 3 layers: bloc → gdp_tier → mortality_tier. Arc = population. Use `d3.hierarchy` + `d3.partition`. Click-to-zoom into sub-hierarchy (standard D3 sunburst zoom pattern). |
| V3 | Student B | **Slope chart** | Q3 | Two user-selected years (dropdowns), top 20 countries by life_expectancy. Line per country, left-axis→right-axis. Colour = region. |
| V4 | Student B | **Choropleth world map** | Q2, Q3 | Sequential colour scale on infant_mortality, year-selectable. `d3-geo` + TopoJSON world atlas (use `world-atlas` npm package — confirm version in plan). Zoom/pan via `d3.zoom`. Hover tooltip. |
| V5 | Student C | **Connected scatterplot** | Q2 | x = gdp, y = infant_mortality, line connects each country's points across years (sorted by year). Colour = region. Annotate the threshold region per the proposal's narrative. |
| V6 | Student C | **Small multiples area chart** | Q3 | 6 panels (one per region), each showing life_expectancy distribution over time. Identical x/y scale across all panels (Mackinlay consistency principle, per proposal §7). |

**Legend requirement (rubric: 1 mark):** every chart's legend must describe and explain every encoding channel used (colour, size, position) — don't skip this, it's explicitly graded.

**Encoding consistency rule across all charts:** one shared categorical colour scale for region/bloc, one shared sequential scale for health-severity metrics. Define these once in a shared config/scales module and import everywhere — do not redefine per chart. This also satisfies the rubric's "appropriate graphic variable types" and "data-ink ratio" criteria.

---

## 5. Dashboard Layout (from proposal §5)

Single-page app, CSS Grid, 3 rows, persistent header:

- **Header (affects all 6 charts):** global year range slider (1960–2016), OECD/OPEC/All toggle, region multi-select dropdown
- **Row 1 — Attract:** V1 (bubble, ~2/3 width) + V2 (sunburst, ~1/3 width)
- **Row 2 — Engage:** V4 (choropleth, 1/2 width) + V3 (slope, 1/2 width)
- **Row 3 — Punchline:** V5 (connected scatter, 1/2 width) + V6 (small multiples, 1/2 width)

Visual consistency requirements (proposal §5.2): one font family/sizing system across all charts and labels, neutral backgrounds, colourblind-safe palettes throughout (rubric: accessibility/aesthetics points).

---

## 6. Interactivity Requirements (assignment_req.md §3.5 — ALL FIVE are mandatory, no exceptions)

| Requirement | Where | Notes |
|---|---|---|
| Hover Tooltips | All 6 charts | Country, year, exact values on every chart, no exceptions |
| Filtering | Header controls (year slider, bloc toggle, region dropdown) + V3's two year-point selectors | Must visibly affect all relevant charts when changed |
| Zoom / Pan | V4 (mouse-wheel zoom + drag pan), V2 (click-to-zoom into sunburst sub-hierarchy) | At minimum these two charts must support this — more is fine |
| Linked Interactions (dynamic updates) | Click a country in V2 or V4 → highlight that country in V1 and V5. Header filters update all 6 charts. | This is graded at 4 marks (highest single line in the rubric) — prioritize getting this genuinely working over polish elsewhere |
| Animation (temporal, interactive not decorative) | V1 play/pause/scrub through years | Must be driven by real temporal data and user-controllable — a pure CSS loop or non-interactive GIF-style animation will not satisfy this |

---

## 7. Design Principles to Reflect in Code, Comments, and Eventually the Written Report

(Full detail and exact wording in `SDG3_Project_Proposal.docx` §7 — match these in your in-code comments so the eventual report writeup is consistent with what was actually built.)

- **Shaffer's 4Cs:** Clear, Clean, Concise, Captivating
- **Cole Nussbaumer's 4As:** Affordances, Accessibility, Aesthetics, Acceptance
- **Mackinlay:** position > size > colour hue/saturation for quantitative/nominal/ordinal data respectively
- **Tufte:** data-ink maximization, small multiples, avoid chartjunk
- **Tversky:** animation congruence — visual change must correspond to real data change
- Colourblind-safe palettes (ColorBrewer) for all sequential/categorical scales

These map directly to rubric line items ("Basic visualization rules and best practices... Shaffer's 4Cs or Cole Nussbaumer's 4As" — 2 marks; "Data-Ink ratio" — 2 marks). Don't treat these as decorative — they're graded criteria.

---

## 8. Open Items — Resolve in Your Plan, Before Coding

- [ ] Confirm exact OECD/OPEC membership list for `bloc` derivation (use official OECD/OPEC member lists, not the dataset's own labels if absent/inconsistent)
- [ ] Decide GDP tier thresholds (recommend World Bank income classification bands over arbitrary quartiles)
- [ ] Verify final row/attribute count after merge clears the 3,000 records / 10 attributes minimum
- [ ] Confirm world TopoJSON source for choropleth (e.g. `world-atlas` npm package — check it's still maintained/available)
- [ ] Confirm repo structure (suggestion in Section 9 below — adjust if you have a better approach, just document why)
- [ ] No more than 3 groups in TT2L may use the same dataset (assignment_req.md §3.3) — not your team's problem to solve technically, just a reminder this exists; not a build blocker

---

## 9. Suggested File/Repo Structure

```
/data
  /raw                 (original Kaggle CSVs)
  /processed           (cleaned JSON, output of preprocessing)
/preprocessing
  clean_merge.py       (pandas: join, derive tiers, export JSON)
/dashboard
  index.html
  /css
    style.css
  /js
    scales.js          (shared colour/scale definitions — single source of truth)
    state.js           (shared filter/selection state + pub-sub or similar for linked interactions)
    v1_bubble.js
    v2_sunburst.js
    v3_slope.js
    v4_choropleth.js
    v5_connected_scatter.js
    v6_small_multiples.js
    main.js            (init, wires header controls to state.js, mounts all 6 charts)
/docs
  assignment_req.md     (copy of governing artifact — keep alongside code for reference)
  rubrics.md             (copy of governing artifact)
  SDG3_Project_Proposal.docx  (copy of governing artifact)
  report.docx            (final written report — separate deliverable, built after dashboard works)
README.md               (setup/run instructions — required if anything needs special steps, per assignment_req.md §4.1)
```

Feel free to propose a different structure in your plan if you have good reason — just make sure the three governing artifacts are copied into `/docs` (or wherever) so they remain accessible as the build progresses, not just referenced once and forgotten.

---

## REMINDER

Step 1 is a plan. Present it. Wait for approval. Then build the complete system — data pipeline through working dashboard with all interactivity — in one continuous pass. Refer back to `assignment_req.md`, `SDG3_Project_Proposal.docx`, and `rubrics.md` at every major decision point throughout, not just at the start.
