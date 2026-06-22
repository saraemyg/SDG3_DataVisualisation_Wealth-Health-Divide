/* V3 — Slope chart.  Owner: Student B.  Answers Q3.
 * Top-20 countries (by life expectancy in the later year) compared between TWO user-chosen
 * years. Each line goes left-axis (year A) -> right-axis (year B); slope = change. Colour =
 * region. The two year dropdowns are V3-owned filters (filtering interactivity). Respects the
 * global bloc/region filters and the linked country selection. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v3 = (function () {
  const W = 480, H = 430, M = { top: 22, right: 138, bottom: 20, left: 56 };
  const iW = W - M.left - M.right, iH = H - M.top - M.bottom;
  const S = App.state;
  let svg, g, y;

  function init() {
    buildControls();
    svg = d3.select("#v3").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
    buildLegend();
    render();
    S.on("slope", "v3", render);
    S.on("filter", "v3", render);
    S.on("select", "v3", applyHighlight);
  }

  function buildControls() {
    const wrap = d3.select("#v3-controls");
    const years = S.s.years;
    function sel(id, val) {
      const lab = wrap.append("label").text(id === "a" ? "From " : " to ");
      const s = lab.append("select");
      s.selectAll("option").data(years).join("option").attr("value", d => d).text(d => d)
        .property("selected", d => d === val);
      s.on("change", function () {
        const a = +d3.select("#v3-sel-a").property("value"), b = +d3.select("#v3-sel-b").property("value");
        S.setSlopeYears(a, b);
      });
      s.attr("id", "v3-sel-" + id);
      return s;
    }
    sel("a", S.s.slopeYearA);
    sel("b", S.s.slopeYearB);
  }

  function render() {
    const a = S.s.slopeYearA, b = S.s.slopeYearB;
    const mapA = new Map((S.s.byYear.get(a) || []).map(d => [d.country, d]));
    const mapB = new Map((S.s.byYear.get(b) || []).map(d => [d.country, d]));
    let rows = [];
    mapB.forEach((db, country) => {
      const da = mapA.get(country);
      if (da && da.life_expectancy != null && db.life_expectancy != null && S.passFilter(db)) {
        rows.push({ country, region: db.region, valA: da.life_expectancy, valB: db.life_expectancy });
      }
    });
    rows.sort((p, q) => q.valB - p.valB).splice(20); // top 20 by later-year life expectancy

    const xL = 0, xR = iW;
    y = d3.scaleLinear()
      .domain(d3.extent(rows.flatMap(d => [d.valA, d.valB]))).nice().range([iH, 0]);

    g.selectAll("*").remove();
    // axis labels (years)
    g.append("text").attr("x", xL).attr("y", -8).attr("text-anchor", "middle").attr("class", "axis-title").text(a);
    g.append("text").attr("x", xR).attr("y", -8).attr("text-anchor", "middle").attr("class", "axis-title").text(b);
    [xL, xR].forEach(xx => g.append("line").attr("x1", xx).attr("x2", xx).attr("y1", 0).attr("y2", iH)
      .attr("stroke", "#ddd"));

    const grp = g.selectAll("g.slope").data(rows, d => d.country).join("g").attr("class", "slope")
      .style("cursor", "pointer")
      .on("mousemove", (e, d) => App.util.tooltip.show(tip(d, a, b), e))
      .on("mouseleave", App.util.tooltip.hide)
      .on("click", (e, d) => S.selectCountry(d.country));

    grp.append("line").attr("x1", xL).attr("x2", xR)
      .attr("y1", d => y(d.valA)).attr("y2", d => y(d.valB))
      .attr("stroke", d => App.scales.region(d.region)).attr("stroke-width", 2).attr("opacity", 0.85);
    grp.append("circle").attr("cx", xL).attr("cy", d => y(d.valA)).attr("r", 3).attr("fill", d => App.scales.region(d.region));
    grp.append("circle").attr("cx", xR).attr("cy", d => y(d.valB)).attr("r", 3).attr("fill", d => App.scales.region(d.region));
    grp.append("text").attr("x", xR + 6).attr("y", d => y(d.valB)).attr("dy", "0.32em")
      .attr("font-size", 10).attr("fill", "#444").text(d => `${d.country} (${d.valB.toFixed(0)})`);

    applyHighlight(S.s.selectedCountry);
    const climber = rows.length ? rows.reduce((m, d) => (d.valB - d.valA) > (m.valB - m.valA) ? d : m) : null;
    d3.select("#insight-v3").text(climber
      ? `Steeper line = bigger change. Biggest gain ${a}→${b}: ${climber.country} (+${(climber.valB - climber.valA).toFixed(1)} yrs).`
      : "No countries match the current filters for these years.");
  }

  function applyHighlight(country) {
    if (!g) return;
    g.selectAll("g.slope")
      .classed("dimmed", d => country && d.country !== country)
      .selectAll("line").attr("stroke-width", d => (country && d.country === country) ? 3.5 : 2);
  }

  function tip(d, a, b) {
    const delta = d.valB - d.valA;
    return `<div class="tt-title"><span class="tt-dot" style="background:${App.scales.region(d.region)}"></span>${d.country}</div>
      <div class="tt-sub">${d.region}</div>
      <table><tr><td>${a}</td><td>${d.valA.toFixed(1)} yrs</td></tr>
      <tr><td>${b}</td><td>${d.valB.toFixed(1)} yrs</td></tr>
      <tr><td>Change</td><td>${delta >= 0 ? "+" : ""}${delta.toFixed(1)} yrs</td></tr></table>`;
  }

  function buildLegend() {
    App.util.discreteLegend(d3.select("#legend-v3"), "Region (colour)",
      S.s.meta.regions.map(rg => ({ label: rg, color: App.scales.region(rg) })), { horizontal: true });
  }

  return { init };
})();
