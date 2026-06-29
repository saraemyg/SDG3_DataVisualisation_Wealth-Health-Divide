/* V4 — "Where children still die youngest."  Owner: Student B.  Answers Q2 & Q3.
 * A choropleth of child mortality PLUS a wealth–health gap panel that turns "country → deaths"
 * into the SDG-3 story: it compares the 10 lowest-mortality vs the 10 highest-mortality countries
 * (average child deaths AND average income for each), spells out the gap multipliers, flags how
 * many of the worst are in Sub-Saharan Africa, and ranks average child mortality by region so the
 * regional divide is unmissable. Hovering any group/region highlights those countries on the map.
 * Mouse-wheel zoom + drag pan; click a country to link it across the dashboard. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v4 = (function () {
  const W = 540, H = 360;
  const S = App.state;
  const moneyS = d3.format("$.2~s");
  const shortRegion = {
    "Europe & Central Asia": "Europe", "Americas": "Americas", "East Asia & Pacific": "E Asia/Pac",
    "South Asia": "South Asia", "Middle East & North Africa": "MENA", "Sub-Saharan Africa": "Sub-Sah. Africa"
  };
  let svg, gMap, path, features, byIso, currentYear, panel;

  function init() {
    const root = d3.select("#v4");
    svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
      .style("background", "#f7fbff");

    const fc = topojson.feature(App.world, App.world.objects.countries);
    features = fc.features.filter(f => f.id !== "010"); // drop Antarctica
    const proj = d3.geoNaturalEarth1().fitSize([W, H], { type: "FeatureCollection", features });
    path = d3.geoPath(proj);

    gMap = svg.append("g");
    gMap.selectAll("path").data(features).join("path")
      .attr("d", path).attr("stroke", "#fff").attr("stroke-width", 0.4)
      .style("cursor", "pointer")
      .on("mousemove", onHover).on("mouseleave", App.util.tooltip.hide).on("click", onClick);

    svg.call(d3.zoom().scaleExtent([1, 9]).translateExtent([[0, 0], [W, H]])
      .on("zoom", e => gMap.attr("transform", e.transform)));

    panel = root.append("div").attr("class", "v4-panel").attr("id", "v4-panel");

    buildLegend();
    render(S.s.currentYear);
    S.on("year", "v4", render);
    S.on("filter", "v4", () => render(currentYear));
    S.on("select", "v4", applyHighlight);
  }

  function render(year) {
    currentYear = year;
    const recs = S.yearData(year).filter(d => d.infant_mortality != null);
    byIso = new Map(recs.map(d => [d.iso_numeric, d]));
    gMap.selectAll("path").transition().duration(App.config.transition * 0.6)
      .attr("fill", f => { const d = byIso.get(f.id); return d ? App.scales.infantColor(d.infant_mortality) : "#e9e9e9"; });
    applyHighlight(S.s.selectedCountry);
    buildGapPanel(recs, year);
  }

  /* ---------------- the wealth–health gap panel ---------------- */
  function buildGapPanel(recs, year) {
    if (recs.length < 12) { panel.html(""); d3.select("#insight-v4").text(""); return; }
    const avg = (arr, k) => { const v = arr.filter(d => d[k] != null); return v.length ? d3.mean(v, d => d[k]) : null; };
    const byMort = recs.slice().sort((a, b) => a.infant_mortality - b.infant_mortality);
    const best = byMort.slice(0, 10), worst = byMort.slice(-10);
    const bestM = avg(best, "infant_mortality"), worstM = avg(worst, "infant_mortality");
    const bestG = avg(best, "gdp_per_capita"), worstG = avg(worst, "gdp_per_capita");
    const ssa = worst.filter(d => d.region === "Sub-Saharan Africa").length;
    const mortX = (worstM && bestM) ? worstM / bestM : null;
    const gdpX = (bestG && worstG) ? bestG / worstG : null;

    // avg child mortality by region (ranked) — makes the regional divide visible
    const regAvg = S.s.meta.regions.map(rg => ({ region: rg, m: avg(recs.filter(d => d.region === rg), "infant_mortality") }))
      .filter(d => d.m != null).sort((a, b) => b.m - a.m);
    const maxM = d3.max(regAvg, d => d.m);
    const regHtml = regAvg.map(d => `
      <div class="region-bar" data-region="${d.region}">
        <span class="rb-label">${shortRegion[d.region] || d.region}</span>
        <span class="rb-track"><span class="rb-fill" style="width:${(100 * d.m / maxM).toFixed(0)}%;background:${App.scales.region(d.region)}"></span></span>
        <span class="rb-val">${d.m.toFixed(0)}</span>
      </div>`).join("");

    panel.html(`
      <div class="gap-title">Wealth–health gap · ${year}</div>
      <div class="gap-grid">
        <div class="gap-col best" data-grp="best">
          <div class="gap-lab">✅ 10 safest</div>
          <div class="gap-val">${bestM.toFixed(0)}<span> /1k</span></div>
          <div class="gap-gdp">${bestG ? moneyS(bestG) : "n/a"}/person</div>
        </div>
        <div class="gap-col worst" data-grp="worst">
          <div class="gap-lab">⚠ 10 deadliest</div>
          <div class="gap-val">${worstM.toFixed(0)}<span> /1k</span></div>
          <div class="gap-gdp">${worstG ? moneyS(worstG) : "n/a"}/person</div>
        </div>
      </div>
      <div class="gap-summary">${mortX ? `<b>${mortX.toFixed(0)}×</b> the child deaths` : ""}${gdpX ? ` · <b>${gdpX.toFixed(0)}×</b> less income` : ""}<br>
        <b>${ssa}/10</b> deadliest are in Sub-Saharan Africa</div>
      <div class="region-bars"><div class="rb-head">Avg child mortality by region</div>${regHtml}</div>`);

    // group sets for map highlighting
    const isoOf = arr => new Set(arr.map(d => d.iso_numeric));
    const bestSet = isoOf(best), worstSet = isoOf(worst);
    panel.select(".gap-col.best").on("mouseenter", () => highlightSet(bestSet)).on("mouseleave", clearSet)
      .on("click", () => spotlightOne(best));
    panel.select(".gap-col.worst").on("mouseenter", () => highlightSet(worstSet)).on("mouseleave", clearSet)
      .on("click", () => spotlightOne(worst));
    panel.selectAll(".region-bar").on("mouseenter", function () {
      const rg = this.dataset.region;
      highlightSet(isoOf(recs.filter(d => d.region === rg)));
    }).on("mouseleave", clearSet);

    d3.select("#insight-v4").html(
      `Children in the <b>10 deadliest</b> countries die about <b>${mortX ? mortX.toFixed(0) : "?"}×</b> as often as in the ` +
      `<b>10 safest</b>, on roughly <b>${gdpX ? gdpX.toFixed(0) : "?"}× lower income</b> — and ${ssa} of those 10 are in ` +
      `Sub-Saharan Africa. Hover the panel to find them on the map.`);
  }

  function highlightSet(isoSet) {
    gMap.selectAll("path").classed("hl", f => isoSet.has(f.id)).classed("map-dim", f => !isoSet.has(f.id));
    gMap.selectAll("path").filter(f => isoSet.has(f.id)).raise();
  }
  function clearSet() {
    gMap.selectAll("path").classed("hl", false).classed("map-dim", false);
    applyHighlight(S.s.selectedCountry);
  }
  function spotlightOne(group) { if (group && group.length) S.selectCountry(group[group.length - 1].country); }

  function onHover(e, f) {
    const d = byIso.get(f.id);
    if (d) App.util.tooltip.show(App.util.countryTooltip(d, currentYear), e);
    else App.util.tooltip.show(`<div class="tt-title">${f.properties.name}</div><div class="tt-sub">no data for ${currentYear}</div>`, e);
  }
  function onClick(e, f) { const d = byIso.get(f.id); if (d) S.selectCountry(d.country); }

  function applyHighlight(country) {
    gMap.selectAll("path")
      .attr("stroke", f => (country && byIso.get(f.id) && byIso.get(f.id).country === country) ? "#111" : "#fff")
      .attr("stroke-width", f => (country && byIso.get(f.id) && byIso.get(f.id).country === country) ? 1.8 : 0.4)
      .filter(f => country && byIso.get(f.id) && byIso.get(f.id).country === country).raise();
  }

  function buildLegend() {
    App.util.gradientLegend(d3.select("#legend-v4"), "Infant mortality (per 1,000 births)",
      App.scales.seqInterpolator, [0, App.scales.infantMax], d3.format("~s"));
  }

  return { init };
})();
