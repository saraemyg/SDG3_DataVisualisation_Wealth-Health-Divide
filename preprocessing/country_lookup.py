"""Reference lookups for the SDG-3 data pipeline (CDS6324 — "The Wealth-Health Divide").

Single source of truth for the three *derived* categorical fields the dashboard relies on
(handoff.md §2 "Derived fields") plus the cross-dataset name reconciliation needed to merge
the supplementary dataset and to join the choropleth to the world-atlas TopoJSON.

Design notes / documented decisions (see plan.md §7):
  * `bloc`  -> OECD / OPEC / Other, applied as **current** membership held constant across all
              years (we do not model accession/exit dates). Defensible and simple; stated in report.
  * region  -> the primary dataset's 22 UN sub-regions are collapsed to **6 World Bank macro-regions**
              so the small-multiples chart (V6) and the shared categorical colour scale have a clean,
              colour-blind-friendly 6-way split.
  * ISO codes come from `iso_map.py` (auto-generated once via pycountry, then embedded so this
              pipeline has no runtime third-party dependency beyond pandas).
"""

from iso_map import ISO_MAP  # name -> (iso_a3, iso_numeric); numeric matches world-atlas ids


# ---------------------------------------------------------------------------
# 1. Economic blocs (bloc)
#    Names below are spelled exactly as they appear in the primary dataset (gapminder.csv).
# ---------------------------------------------------------------------------
OECD_MEMBERS = {
    "Australia", "Austria", "Belgium", "Canada", "Chile", "Colombia", "Costa Rica",
    "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece",
    "Hungary", "Iceland", "Ireland", "Israel", "Italy", "Japan", "Korea, Rep.", "Latvia",
    "Lithuania", "Luxembourg", "Mexico", "Netherlands", "New Zealand", "Norway", "Poland",
    "Portugal", "Slovak Republic", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey",
    "United Kingdom", "United States",
}  # 38 current OECD members

OPEC_MEMBERS = {
    "Algeria", "Angola", "Congo, Rep.", "Equatorial Guinea", "Gabon", "Iran", "Iraq",
    "Kuwait", "Libya", "Nigeria", "Saudi Arabia", "United Arab Emirates", "Venezuela",
}  # OPEC member states (treated as constant membership)


def get_bloc(country: str) -> str:
    """OECD / OPEC / Other for a primary-dataset country name."""
    if country in OECD_MEMBERS:
        return "OECD"
    if country in OPEC_MEMBERS:
        return "OPEC"
    return "Other"


# ---------------------------------------------------------------------------
# 2. Region canonicalisation: 22 UN sub-regions -> 6 macro-regions
# ---------------------------------------------------------------------------
REGION_MAP = {
    # Sub-Saharan Africa
    "Eastern Africa": "Sub-Saharan Africa",
    "Middle Africa": "Sub-Saharan Africa",
    "Southern Africa": "Sub-Saharan Africa",
    "Western Africa": "Sub-Saharan Africa",
    # Middle East & North Africa
    "Northern Africa": "Middle East & North Africa",
    "Western Asia": "Middle East & North Africa",
    # Europe & Central Asia
    "Eastern Europe": "Europe & Central Asia",
    "Northern Europe": "Europe & Central Asia",
    "Southern Europe": "Europe & Central Asia",
    "Western Europe": "Europe & Central Asia",
    "Central Asia": "Europe & Central Asia",
    # Americas
    "Caribbean": "Americas",
    "Central America": "Americas",
    "South America": "Americas",
    "Northern America": "Americas",
    # East Asia & Pacific
    "Eastern Asia": "East Asia & Pacific",
    "South-Eastern Asia": "East Asia & Pacific",
    "Australia and New Zealand": "East Asia & Pacific",
    "Melanesia": "East Asia & Pacific",
    "Micronesia": "East Asia & Pacific",
    "Polynesia": "East Asia & Pacific",
    # South Asia
    "Southern Asia": "South Asia",
}

# Canonical order used everywhere downstream (colour scale + V6 panel order).
CANONICAL_REGIONS = [
    "Europe & Central Asia",
    "Americas",
    "East Asia & Pacific",
    "South Asia",
    "Middle East & North Africa",
    "Sub-Saharan Africa",
]


def canon_region(subregion) -> str:
    """Collapse a UN sub-region label to one of the 6 macro-regions."""
    return REGION_MAP.get(subregion, "Other")


# ---------------------------------------------------------------------------
# 3. Supplementary-dataset name reconciliation (primary name -> UnifiedDataset name)
#    Left-join enrichment only; unmapped names simply receive null supplementary fields.
#    All 15 below were verified to exist in the supplementary dataset.
# ---------------------------------------------------------------------------
SUPP_NAME_MAP = {
    "Congo, Dem. Rep.": "Democratic Republic of Congo",
    "Congo, Rep.": "Congo",
    "Czech Republic": "Czechia",
    "Hong Kong, China": "Hong Kong",
    "Kyrgyz Republic": "Kyrgyzstan",
    "Lao": "Laos",
    "Macao, China": "Macao",
    "Macedonia, FYR": "North Macedonia",
    "Micronesia, Fed. Sts.": "Micronesia (country)",
    "Slovak Republic": "Slovakia",
    "St. Lucia": "Saint Lucia",
    "St. Vincent and the Grenadines": "Saint Vincent and the Grenadines",
    "Swaziland": "Eswatini",
    "Timor-Leste": "Timor",
    "West Bank and Gaza": "Palestine",
}


def supp_name(country: str) -> str:
    """Map a primary country name to its supplementary-dataset spelling for the join."""
    return SUPP_NAME_MAP.get(country, country)


# ---------------------------------------------------------------------------
# 4. ISO accessors (for the choropleth join to world-atlas)
# ---------------------------------------------------------------------------
def iso_a3(country: str):
    rec = ISO_MAP.get(country)
    return rec[0] if rec else None


def iso_numeric(country: str):
    rec = ISO_MAP.get(country)
    return rec[1] if rec else None
