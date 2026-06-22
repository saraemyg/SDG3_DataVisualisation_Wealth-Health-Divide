/* V5 — Connected scatterplot (threshold analysis).  Owner: Student C.  Answers Q2.
 * x = GDP per capita (log), y = infant mortality. Each country's yearly points are connected
 * into a trajectory through GDP–mortality space (colour = region). A data-driven threshold
 * band marks where mortality collapses. A moving dot per country marks the CURRENT YEAR, so
 * the chart is linked to the global year cursor. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v5 = (function () {
  const W = 540, H = 410, M = { top: 16, right: 18, bottom: 48, left: 56 };
  const iW = W - M.left - M.right, iH = H - M.top - M.bottom;
  const S = App.state;
  let svg, g, x, y, line, threshold;

  function init() {
    svg = d3.select("#v5").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
    x = App.scales.gdpX([0, iW]);
    y = App.scales.infantY([iH, 0]);
    line = d3.line().defined(d => d.gdp_per_capita != null && d.infant_mortality != null)
      .x(d => x(d.gdp_per_capita)).y(d => y(d.infant_mortality)).curve(d3.curveLinear);

    threshold = computeThreshold();

    // grid + axes
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-iW).tickFormat("")).select(".domain").remove();
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(6, "~s").tickFormat(d => "$" + d3.format("~s")(d)));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
    g.append("text").attr("class", "axis-title").attr("x", iW).attr("y", iH + 40).attr("text-anchor", "end")
      .text("GDP per capita (US$, log) →");
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)").attr("x", 0).attr("y", -42)
      .attr("text-anchor", "end").text("↑ Infant mortality (per 1,000)");

    drawThreshold();
    g.append("g").attr("class", "trajectories");
    g.append("g").attr("class", "year-dots");

    buildLegend();
    render();
    S.on("filter", "v5", render);
    S.on("year", "v5", updateYearDots);
    S.on("select", "v5", applyHighlight);
  }

  /* data-driven: median infant mortality in log-GDP bins; threshold = where it crosses 25 */
  function computeThreshold() {
    const pts = S.s.data.filter(d => d.gdp_per_capita != null && d.infant_mortality != null);
    // 18 log-spaced GDP bins across the domain
    const lo = Math.log10(x.domain()[0]), hi = Math.log10(x.domain()[1]);
    const edges = d3.range(19).map(i => Math.pow(10, lo + (hi - lo) * i / 18));
    let crossing = null;
    for (let i = 0; i < edges.length - 1; i++) {
      const seg = pts.filter(d => d.gdp_per_capita >= edges[i] && d.gdp_per_capita < edges[i + 1]);
      if (seg.length < 5) continue;
      const med = d3.median(seg, d => d.infant_mortality);
      if (med < 25 && crossing == null) crossing = Math.sqrt(edges[i] * edges[i + 1]);
    }
    return { value: crossing || 4466, bandLo: 1500, bandHi: 8000 };
  }

  function drawThreshold() {
    g.insert("rect", ".grid + *").attr("x", x(threshold.bandLo)).attr("width", x(threshold.bandHi) - x(threshold.bandLo))
      .attr("y", 0).attr("height", iH).attr("fill", "#0072B2").attr("opacity", 0.06);
    g.append("line").attr("x1", x(threshold.value)).attr("x2", x(threshold.value)).attr("y1", 0).attr("y2", iH)
      .attr("stroke", "#0072B2").attr("stroke-dasharray", "4 3").attr("stroke-width", 1.4);
    g.append("text").attr("x", x(threshold.value)).attr("y", 12).attr("text-anchor", "middle")
      .attr("font-size", 10).attr("fill", "#0072B2").attr("font-weight", 600)
      .text(`≈ $${d3.format(",.0f")(threshold.value)} threshold`);
  }

  function filteredCountries() {
    const out = [];
    S.s.byCountry.forEach((recs, country) => {
      if (recs.length && S.passFilter(recs[0])) out.push({ country, region: recs[0].region, recs });
    });
    return out;
  }

  function render() {
    const countries = filteredCountries();
    g.select(".trajectories").selectAll("path").data(countries, d => d.country).join("path")
      .attr("fill", "none").attr("stroke", d => App.scales.region(d.region))
      .attr("stroke-width", 1).attr("opacity", 0.22)
      .attr("d", d => line(d.recs))
      .style("cursor", "pointer")
      .on("mousemove", function (e, d) { App.util.tooltip.show(`<div class="tt-title">${d.country}</div><div class="tt-sub">${d.region} · full trajectory</div>`, e); })
      .on("mouseleave", App.util.tooltip.hide)
      .on("click", (e, d) => S.selectCountry(d.country));
    updateYearDots();
    applyHighlight(S.s.selectedCountry);
    d3.select("#insight-v5").text(
      `Each thread is one country's path through GDP–mortality space. Mortality collapses as GDP ` +
      `rises past ≈ $${d3.format(",.0f")(threshold.value)} (dashed line); below it, countries vary widely.`);
  }

  function updateYearDots() {
    const yr = S.s.currentYear;
    const dots = filteredCountries().map(c => c.recs.find(r => r.year === yr))
      .filter(r => r && r.gdp_per_capita != null && r.infant_mortality != null);
    g.select(".year-dots").selectAll("circle").data(dots, d => d.country).join(
      enter => enter.append("circle").attr("r", 3).attr("stroke", "#fff").attr("stroke-width", 0.6)
        .attr("fill", d => App.scales.region(d.region)).style("cursor", "pointer")
        .attr("cx", d => x(d.gdp_per_capita)).attr("cy", d => y(d.infant_mortality))
        .on("mousemove", (e, d) => App.util.tooltip.show(App.util.countryTooltip(d, yr), e))
        .on("mouseleave", App.util.tooltip.hide)
        .on("click", (e, d) => S.selectCountry(d.country)),
      update => update.call(u => u.transition().duration(App.config.animStep * 0.9).ease(d3.easeLinear)
        .attr("cx", d => x(d.gdp_per_capita)).attr("cy", d => y(d.infant_mortality))),
      exit => exit.remove()
    );
    applyHighlight(S.s.selectedCountry);
  }

  function applyHighlight(country) {
    g.select(".trajectories").selectAll("path")
      .attr("opacity", d => !country ? 0.22 : (d.country === country ? 0.95 : 0.05))
      .attr("stroke-width", d => (country && d.country === country) ? 2.5 : 1)
      .filter(d => d.country === country).raise();
    g.select(".year-dots").selectAll("circle")
      .classed("dimmed", d => country && d.country !== country)
      .attr("r", d => (country && d.country === country) ? 5 : 3);
  }

  function buildLegend() {
    App.util.discreteLegend(d3.select("#legend-v5"), "Region (colour)",
      S.s.meta.regions.map(rg => ({ label: rg, color: App.scales.region(rg) })), { horizontal: true });
    d3.select("#legend-v5").append("div").attr("class", "legend-block")
      .append("div").attr("class", "legend-title").style("text-transform", "none").style("font-weight", "400")
      .html("● = current-year position · thread = 1960→2015 path");
  }

  return { init };
})();
