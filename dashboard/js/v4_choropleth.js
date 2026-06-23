/* V4 — Choropleth world map.  Owner: Student B.  Answers Q2 & Q3.
 * Sequential colour = infant mortality for the current year (fixed domain across years so
 * the map is comparable frame-to-frame). Mouse-wheel zoom + drag pan via d3.zoom. Clicking
 * a country sets the linked selection (highlights it in V1 & V5). */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v4 = (function () {
  const W = 540, H = 360;
  const S = App.state;
  let svg, gMap, path, features, byIso, currentYear;

  function init() {
    const root = d3.select("#v4");
    svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
      .style("background", "#f7fbff");

    const fc = topojson.feature(App.world, App.world.objects.countries);
    features = fc.features.filter(f => f.id !== "010"); // drop Antarctica for clarity
    const proj = d3.geoNaturalEarth1().fitSize([W, H], { type: "FeatureCollection", features });
    path = d3.geoPath(proj);

    gMap = svg.append("g");
    gMap.selectAll("path").data(features).join("path")
      .attr("d", path)
      .attr("stroke", "#fff").attr("stroke-width", 0.4)
      .style("cursor", "pointer")
      .on("mousemove", onHover)
      .on("mouseleave", App.util.tooltip.hide)
      .on("click", onClick);

    // zoom / pan
    svg.call(d3.zoom().scaleExtent([1, 9])
      .translateExtent([[0, 0], [W, H]])
      .on("zoom", e => gMap.attr("transform", e.transform)));

    buildLegend();
    render(S.s.currentYear);

    S.on("year", "v4", render);
    S.on("filter", "v4", () => render(currentYear));
    S.on("select", "v4", applyHighlight);
  }

  function render(year) {
    currentYear = year;
    byIso = new Map(S.yearData(year).map(d => [d.iso_numeric, d]));
    gMap.selectAll("path").transition().duration(App.config.transition * 0.6)
      .attr("fill", f => {
        const d = byIso.get(f.id);
        return (d && d.infant_mortality != null) ? App.scales.infantColor(d.infant_mortality) : "#e9e9e9";
      });
    drawAnnotation();
    applyHighlight(S.s.selectedCountry);
    setInsight(year);
  }

  // label the worst region directly on the map so the eye goes there first
  function drawAnnotation() {
    gMap.selectAll(".annotation").remove();
    const vals = Array.from(byIso.values()).filter(d => d.infant_mortality != null);
    if (!vals.length) return;
    const byRegion = d3.rollup(vals, v => d3.mean(v, d => d.infant_mortality), d => d.region);
    let worst = null, worstVal = -1;
    byRegion.forEach((m, r) => { if (m > worstVal) { worstVal = m; worst = r; } });
    const pts = [];
    features.forEach(f => {
      const d = byIso.get(f.id);
      if (d && d.region === worst) { const c = path.centroid(f); if (c[0] === c[0]) pts.push(c); }
    });
    if (!pts.length) return;
    App.util.annotate(gMap, {
      x: d3.mean(pts, p => p[0]), y: d3.mean(pts, p => p[1]), anchor: "middle",
      text: ["Highest child mortality"], color: "#6a1b9a"
    });
  }

  function onHover(e, f) {
    const d = byIso.get(f.id);
    if (d) App.util.tooltip.show(App.util.countryTooltip(d, currentYear), e);
    else App.util.tooltip.show(`<div class="tt-title">${f.properties.name}</div>
      <div class="tt-sub">no data for ${currentYear}</div>`, e);
  }
  function onClick(e, f) { const d = byIso.get(f.id); if (d) S.selectCountry(d.country); }

  function applyHighlight(country) {
    gMap.selectAll("path")
      .attr("stroke", f => (country && byIso.get(f.id) && byIso.get(f.id).country === country) ? "#111" : "#fff")
      .attr("stroke-width", f => (country && byIso.get(f.id) && byIso.get(f.id).country === country) ? 1.8 : 0.4)
      .filter(f => country && byIso.get(f.id) && byIso.get(f.id).country === country).raise();
  }

  function setInsight(year) {
    const vals = Array.from(byIso.values()).filter(d => d.infant_mortality != null);
    if (!vals.length) { d3.select("#insight-v4").text(""); return; }
    const worst = vals.reduce((a, b) => a.infant_mortality > b.infant_mortality ? a : b);
    d3.select("#insight-v4").text(
      `Darker = higher infant mortality (${year}). Highest: ${worst.country} at ` +
      `${worst.infant_mortality.toFixed(1)} per 1,000. Scroll to zoom, drag to pan, click a country to link it.`);
  }

  function buildLegend() {
    App.util.gradientLegend(d3.select("#legend-v4"), "Infant mortality (per 1,000 births)",
      App.scales.seqInterpolator, [0, App.scales.infantMax], d3.format("~s"));
  }

  return { init };
})();
