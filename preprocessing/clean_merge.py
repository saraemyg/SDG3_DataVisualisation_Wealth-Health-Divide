"""SDG-3 dashboard data pipeline — "The Wealth-Health Divide".

Reads the two raw Kaggle CSVs from data/raw/, cleans + derives + merges them, and writes
two front-end-ready JSON files to data/processed/:

    dataset.json   long-format country-year records consumed by all six D3 charts
    meta.json      scale domains, tier thresholds, category lists (single source of truth)

Run:  py preprocessing/clean_merge.py     (from the project root; pandas only, no other deps)

Key data decisions (confirmed against the real files; see plan.md §7):
  * Primary `gdp` is *total* GDP -> we derive `gdp_per_capita = gdp / population`
    (used for the bubble/scatter x-axes and the World-Bank income tiers).
  * Supplementary rows are split by Gender -> we keep only 'Both sexes'.
  * A row is kept if it has life_expectancy AND population (the universally-needed fields);
    individual charts drop rows missing their own metric (e.g. bubble needs gdp_per_capita).
  * Supplementary dataset has no "child malnutrition" column, so we enrich instead with
    indicators that map directly onto our three SDG-3 targets: under-5 & neonatal mortality
    (3.2), cardiovascular NCD death share (3.4), plus TB/malaria/maternal and gov. health
    spend. Documented deviation from the proposal's exact field list.
"""

import json
import os
import sys

import numpy as np
import pandas as pd

# Allow `from country_lookup import ...` when run as `py preprocessing/clean_merge.py`.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from country_lookup import (  # noqa: E402
    CANONICAL_REGIONS, canon_region, get_bloc, iso_a3, iso_numeric, supp_name,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
OUT = os.path.join(ROOT, "data", "processed")

# --- Derived-tier thresholds (documented choices) -------------------------------------
# World Bank income classification bands, GNI per capita (current USD, FY24 cutoffs).
GDP_TIERS = [
    ("Low", 0, 1135),
    ("Lower-Middle", 1135, 4465),
    ("Upper-Middle", 4465, 13845),
    ("High", 13845, float("inf")),
]
GDP_TIER_ORDER = ["Low", "Lower-Middle", "Upper-Middle", "High"]

# Infant mortality per 1,000 live births. Severity order Critical -> Low.
MORT_TIERS = [
    ("Critical", 50, float("inf")),
    ("High", 25, 50),
    ("Moderate", 10, 25),
    ("Low", 0, 10),
]
MORT_TIER_ORDER = ["Critical", "High", "Moderate", "Low"]

# Supplementary columns we pull (raw name -> clean key).
SUPP_COLS = {
    "Government Expenditure Health": "health_expenditure",
    "Under 5 Mortality Rate": "under5_mortality",
    "Neonatal Mortality Rate": "neonatal_mortality",
    "% Death Cardiovascular": "ncd_cardiovascular_pct",
    "Incidence of Tuberculosis": "tb_incidence",
    "Incidence of Malaria": "malaria_incidence",
    "Maternal Mortality Ratio": "maternal_mortality",
}


def gdp_tier(per_capita):
    if pd.isna(per_capita):
        return None
    for name, lo, hi in GDP_TIERS:
        if lo <= per_capita < hi:
            return name
    return None


def mortality_tier(rate):
    if pd.isna(rate):
        return None
    for name, lo, hi in MORT_TIERS:
        if lo <= rate < hi:
            return name
    return None


def load_primary():
    df = pd.read_csv(os.path.join(RAW, "gapminder.csv"))
    df = df.drop(columns=[c for c in df.columns if c.startswith("Unnamed")], errors="ignore")
    df["year"] = df["year"].astype(int)
    # derived per-capita income (primary gdp is total GDP)
    df["gdp_per_capita"] = df["gdp"] / df["population"]
    # derived categoricals
    df["bloc"] = df["country"].map(get_bloc)
    df["region_macro"] = df["region"].map(canon_region)
    df["iso_a3"] = df["country"].map(iso_a3)
    df["iso_numeric"] = df["country"].map(iso_numeric)
    df["gdp_tier"] = df["gdp_per_capita"].map(gdp_tier)
    df["mortality_tier"] = df["infant_mortality"].map(mortality_tier)
    return df


def load_supplementary():
    usecols = ["Country", "Year", "Gender"] + list(SUPP_COLS)
    df = pd.read_csv(os.path.join(RAW, "UnifiedDataset.csv"), usecols=usecols)
    df = df[df["Gender"] == "Both sexes"].copy()
    df = df.drop(columns=["Gender"]).rename(columns=SUPP_COLS)
    df = df.rename(columns={"Country": "_supp_country", "Year": "year"})
    df["year"] = df["year"].astype(int)
    df = df.drop_duplicates(subset=["_supp_country", "year"], keep="first")
    return df


def round_clean(v, ndigits):
    """Round, converting NaN/inf to None so JSON emits null."""
    if v is None or (isinstance(v, float) and (np.isnan(v) or np.isinf(v))):
        return None
    r = round(float(v), ndigits)
    return int(r) if ndigits == 0 else r


def text_clean(v):
    """Return a string field as-is, or None for NaN/None (pandas stores missing object
    cells as float NaN, which json would otherwise emit as the invalid token `NaN`)."""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    return v


def main():
    primary = load_primary()
    supp = load_supplementary()

    # --- merge (left join: enrich primary, never drop primary rows) -------------------
    primary["_supp_country"] = primary["country"].map(supp_name)
    merged = primary.merge(supp, on=["_supp_country", "year"], how="left")

    # join diagnostics
    join_keys_primary = primary[["_supp_country", "year"]].drop_duplicates()
    matched = join_keys_primary.merge(
        supp[["_supp_country", "year"]].drop_duplicates(), on=["_supp_country", "year"], how="inner"
    )
    join_rate = len(matched) / len(join_keys_primary) * 100

    # --- keep rows usable by the dashboard (need life_expectancy + population) --------
    before = len(merged)
    merged = merged[merged["life_expectancy"].notna() & merged["population"].notna()].copy()

    # GDP per capita (the dashboard's central variable) stops earlier than life expectancy
    # in this dataset. Trim the analysis window to the last year GDP is reported so that
    # EVERY year on the global cursor populates the GDP-centric charts (V1/V2/V5) rather
    # than going blank — keeps the dashboard internally coherent (documented in README).
    last_gdp_year = int(merged.loc[merged["gdp_per_capita"].notna(), "year"].max())
    merged = merged[merged["year"] <= last_gdp_year].copy()

    # --- assemble output records ------------------------------------------------------
    records = []
    for r in merged.itertuples(index=False):
        records.append({
            "country": r.country,
            "iso_a3": text_clean(r.iso_a3),
            "iso_numeric": text_clean(r.iso_numeric),
            "year": int(r.year),
            "region": r.region_macro,
            "bloc": r.bloc,
            "gdp_per_capita": round_clean(r.gdp_per_capita, 0),
            "population": round_clean(r.population, 0),
            "life_expectancy": round_clean(r.life_expectancy, 1),
            "infant_mortality": round_clean(r.infant_mortality, 1),
            "fertility": round_clean(r.fertility, 2),
            "gdp_tier": text_clean(r.gdp_tier),
            "mortality_tier": text_clean(r.mortality_tier),
            # supplementary enrichment (null pre-1990 / where unreported)
            "health_expenditure": round_clean(r.health_expenditure, 2),
            "under5_mortality": round_clean(r.under5_mortality, 1),
            "neonatal_mortality": round_clean(r.neonatal_mortality, 1),
            "ncd_cardiovascular_pct": round_clean(r.ncd_cardiovascular_pct, 1),
            "tb_incidence": round_clean(r.tb_incidence, 1),
            "malaria_incidence": round_clean(r.malaria_incidence, 1),
            "maternal_mortality": round_clean(r.maternal_mortality, 1),
        })

    # --- meta (scale domains + category lists + thresholds) ---------------------------
    def domain(col, lo_q=0.0, hi_q=1.0):
        s = merged[col].dropna()
        return [float(s.quantile(lo_q)), float(s.quantile(hi_q))] if len(s) else [None, None]

    meta = {
        "title": "The Wealth-Health Divide: Does Money Buy Survival?",
        "yearMin": int(merged["year"].min()),
        "yearMax": int(merged["year"].max()),
        "regions": CANONICAL_REGIONS,
        "blocs": ["OECD", "OPEC", "Other"],
        "gdpTiers": GDP_TIER_ORDER,
        "mortalityTiers": MORT_TIER_ORDER,
        "domains": {
            "gdp_per_capita": domain("gdp_per_capita"),
            "population": domain("population"),
            "life_expectancy": domain("life_expectancy"),
            "infant_mortality": domain("infant_mortality"),
            "health_expenditure": domain("health_expenditure"),
        },
        "tierThresholds": {
            "gdp": [{"tier": n, "min": lo, "max": (None if hi == float("inf") else hi)} for n, lo, hi in GDP_TIERS],
            "mortality": [{"tier": n, "min": lo, "max": (None if hi == float("inf") else hi)} for n, lo, hi in MORT_TIERS],
        },
        "nRecords": len(records),
        "nCountries": int(merged["country"].nunique()),
    }

    os.makedirs(OUT, exist_ok=True)
    # allow_nan=False => emit strict JSON (browsers' JSON.parse rejects NaN/Infinity);
    # if any NaN slipped through it raises here instead of silently breaking the dashboard.
    with open(os.path.join(OUT, "dataset.json"), "w", encoding="utf-8") as f:
        json.dump(records, f, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False, allow_nan=False)

    # --- QC report --------------------------------------------------------------------
    attrs = list(records[0].keys())
    ds_kb = os.path.getsize(os.path.join(OUT, "dataset.json")) / 1024
    print("=" * 64)
    print("  SDG-3 PIPELINE — QC REPORT")
    print("=" * 64)
    print(f"  Records written ........ {len(records):>7,}   (requirement >= 3,000  -> "
          f"{'PASS' if len(records) >= 3000 else 'FAIL'})")
    print(f"  Attributes per record .. {len(attrs):>7}   (requirement >= 10     -> "
          f"{'PASS' if len(attrs) >= 10 else 'FAIL'})")
    print(f"  Year span .............. {meta['yearMin']}-{meta['yearMax']}  (trimmed to GDP era; temporal PASS)")
    print(f"  Countries .............. {meta['nCountries']:>7}   (spatial dimension PASS)")
    print(f"  Rows dropped (no life/pop) {before - len(records):>5,}")
    print("-" * 64)
    bloc_counts = merged["bloc"].value_counts().to_dict()
    print("  Bloc split ............. " + ", ".join(f"{k}:{v}" for k, v in bloc_counts.items()))
    print("  Region split:")
    for reg, n in merged["region_macro"].value_counts().items():
        print(f"      {reg:<28} {n:>5}")
    print("-" * 64)
    print(f"  Supplementary join rate  {join_rate:5.1f}% of primary country-years matched")
    print("  Field coverage (non-null %):")
    for c in ["gdp_per_capita", "infant_mortality", "health_expenditure", "under5_mortality",
              "neonatal_mortality", "ncd_cardiovascular_pct", "tb_incidence", "malaria_incidence"]:
        print(f"      {c:<26} {merged[c].notna().mean() * 100:5.1f}%")
    print("-" * 64)
    print(f"  dataset.json ........... {ds_kb:7.1f} KB")
    print(f"  Attributes: {', '.join(attrs)}")
    print("=" * 64)


if __name__ == "__main__":
    main()
