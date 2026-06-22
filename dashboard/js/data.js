/* data.js — load the processed JSON + world atlas, then derive the lookup structures
 * the charts need (grouped by year, grouped by country). Paths are relative to
 * dashboard/index.html and assume the static server runs from the PROJECT ROOT
 * (see README): open http://localhost:8000/dashboard/ . */
window.App = window.App || {};

App.data = (function () {
  const BASE = "../data/processed/";

  function load() {
    return Promise.all([
      d3.json(BASE + "dataset.json"),
      d3.json(BASE + "meta.json"),
      d3.json(BASE + "countries-110m.json")
    ]).then(function (arr) {
      return { records: arr[0], meta: arr[1], topo: arr[2] };
    });
  }

  /* Build derived indexes and seed the shared state. */
  function prepare(records, meta) {
    const s = App.state.s;
    s.data = records;
    s.meta = meta;

    // year -> records
    s.byYear = d3.group(records, d => d.year);

    // country -> records sorted by year (for trajectories: V5, byCountry tooltips)
    const byC = d3.group(records, d => d.country);
    byC.forEach(v => v.sort((a, b) => a.year - b.year));
    s.byCountry = byC;

    // initial state
    s.currentYear = meta.yearMax;
    s.blocFilter = "All";
    s.activeRegions = new Set(meta.regions);
    s.selectedCountry = null;
    // sensible default comparison years for the slope chart (V3)
    s.slopeYearA = Math.max(meta.yearMin, 1965);
    s.slopeYearB = meta.yearMax;

    // list of years actually present, ascending
    s.years = Array.from(s.byYear.keys()).sort((a, b) => a - b);
  }

  return { load, prepare };
})();
