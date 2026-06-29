/* state.js — shared filter/selection state + pub-sub.
 *
 * This single store is what makes the dashboard a *coordinated* dashboard rather than
 * six independent charts: every control writes here and dispatches a typed event; every
 * chart subscribes to the events it cares about and re-renders only what changed. This is
 * the "brushing & linking" backbone (proposal §6, rubric "Interactivity" = 4 marks).
 *
 * Events:
 *   "year"   currentYear changed (animation tick or slider scrub)
 *   "filter" blocFilter or active regions changed
 *   "select" selectedCountry changed (linked highlight across charts)
 */
window.App = window.App || {};

App.state = (function () {
  const dispatch = d3.dispatch("year", "filter", "select");

  const s = {
    data: [],            // all records (set by data.js)
    meta: null,
    byYear: null,        // Map<year, record[]>
    byCountry: null,     // Map<country, record[]> (sorted by year)

    currentYear: null,
    blocFilter: "All",   // "All" | "OECD" | "OPEC" | "Other"
    activeRegions: null, // Set<region>; null until initialised = all regions
    selectedCountry: null
  };

  /* subscribe: namespaced so multiple charts can listen to the same event */
  function on(event, namespace, handler) { dispatch.on(event + "." + namespace, handler); }

  /* --- mutators (each dispatches the matching event) --- */
  function setYear(y) {
    y = Math.round(y);
    if (y === s.currentYear) return;
    s.currentYear = y;
    dispatch.call("year", null, y);
  }
  function setBloc(b) {
    if (b === s.blocFilter) return;
    s.blocFilter = b;
    dispatch.call("filter", null);
  }
  function setRegions(set) {
    s.activeRegions = set;
    dispatch.call("filter", null);
  }
  function toggleRegion(r) {
    if (s.activeRegions.has(r)) s.activeRegions.delete(r); else s.activeRegions.add(r);
    if (s.activeRegions.size === 0) s.meta.regions.forEach(x => s.activeRegions.add(x)); // never empty
    dispatch.call("filter", null);
  }
  function selectCountry(c) {
    s.selectedCountry = (c === s.selectedCountry) ? null : c; // toggle off if same
    dispatch.call("select", null, s.selectedCountry);
  }
  function clearSelection() {
    if (s.selectedCountry == null) return;
    s.selectedCountry = null;
    dispatch.call("select", null, null);
  }

  /* --- shared filter predicate (bloc + region) used by every chart --- */
  function passFilter(d) {
    if (s.blocFilter !== "All" && d.bloc !== s.blocFilter) return false;
    if (s.activeRegions && !s.activeRegions.has(d.region)) return false;
    return true;
  }

  /* records for a given year that pass the active filters */
  function yearData(year) {
    const arr = s.byYear.get(year) || [];
    return arr.filter(passFilter);
  }

  return {
    s, on, dispatch,
    setYear, setBloc, setRegions, toggleRegion, selectCountry, clearSelection,
    passFilter, yearData
  };
})();
