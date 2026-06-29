/* V5 — "Does money buy survival?"  Owner: Student C.  Answers Q2.
 * A clean ONE-YEAR scatter: x = GDP per person (log), y = child mortality, one dot per country
 * (colour = region, size = population). A dashed threshold line + shaded band + an overall trend
 * curve make the key insight obvious: child deaths fall steeply as GDP rises, then flatten out.
 * Replaces the hard-to-read connected-scatter "hairball" (research: connected scatterplots are
 * the slowest/most error-prone common chart). The dots move with the global year cursor. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v5 = (function () {
  const W = 540, H = 410, M = { top: 16, right: 18, bottom: 48, left: 56 };
  const iW = W - M.left - M.right, iH = H - M.top - M.bottom;
  const S = App.state;
  let svg, g, x, y, rPop, threshold;

  function init() {
    svg = d3.select("#v5").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
    x = App.scales.gdpX([0, iW]);
    y = App.scales.infantY([iH, 0]);
    rPop = d3.scaleSqrt().domain([0, App.scales.domains.population[1]]).range([2.5, 12]);
    threshold = computeThreshold();

    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-iW).tickFormat("")).select(".domain").remove();
    const xticks = [200, 1000, 5000, 20000, 100000].filter(v => v >= x.domain()[0] && v <= x.domain()[1]);
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickValues(xticks).tickFormat(d => "$" + d3.format("~s")(d)));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
    g.append("text").attr("class", "axis-title").attr("x", iW).attr("y", iH + 40).attr("text-anchor", "end")
      .text("GDP per person (US$, log) →");
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)").attr("x", 0).attr("y", -42)
      .attr("text-anchor", "end").text("↑ Child mortality (per 1,000)");

    drawThreshold();
    drawTrend();
    g.append("g").attr("class", "dots");

    buildLegend();
    render();
    S.on("year", "v5", render);
    S.on("filter", "v5", render);
    S.on("select", "v5", applyHighlight);
  }

  /* data-driven: median child mortality in log-GDP bins; threshold = where it drops below 25 */
  function computeThreshold() {
    const pts = S.s.data.filter(d => d.gdp_per_capita != null && d.infant_mortality != null);
    const lo = Math.log10(x.domain()[0]), hi = Math.log10(x.domain()[1]);
    const edges = d3.range(19).map(i => Math.pow(10, lo + (hi - lo) * i / 18));
    let crossing = null;
    for (let i = 0; i < edges.length - 1; i++) {
      const seg = pts.filter(d => d.gdp_per_capita >= edges[i] && d.gdp_per_capita < edges[i + 1]);
      if (seg.length < 5) continue;
      if (d3.median(seg, d => d.infant_mortality) < 25 && crossing == null) crossing = Math.sqrt(edges[i] * edges[i + 1]);
    }
    return { value: crossing || 4466, bandLo: 1500, bandHi: 8000 };
  }

  function drawThreshold() {
    g.append("rect").attr("x", x(threshold.bandLo)).attr("width", x(threshold.bandHi) - x(threshold.bandLo))
      .attr("y", 0).attr("height", iH).attr("fill", "#0072B2").attr("opacity", 0.06);
    g.append("line").attr("x1", x(threshold.value)).attr("x2", x(threshold.value)).attr("y1", 0).attr("y2", iH)
      .attr("stroke", "#0072B2").attr("stroke-dasharray", "4 3").attr("stroke-width", 1.4);
    g.append("text").attr("x", x(threshold.value)).attr("y", 12).attr("text-anchor", "middle")
      .attr("class", "anno-text").attr("font-size", 10).attr("fill", "#0072B2").attr("font-weight", 700)
      .text(`≈ $${d3.format(",.0f")(threshold.value)} — deaths stop falling fast`);
  }

  /* overall trend curve (binned median across ALL years => stable shape of the relationship) */
  function drawTrend() {
    const pts = S.s.data.filter(d => d.gdp_per_capita != null && d.infant_mortality != null);
    const lo = Math.log10(x.domain()[0]), hi = Math.log10(x.domain()[1]);
    const edges = d3.range(17).map(i => Math.pow(10, lo + (hi - lo) * i / 16));
    const curve = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const seg = pts.filter(d => d.gdp_per_capita >= edges[i] && d.gdp_per_capita < edges[i + 1]);
      if (seg.length >= 8) curve.push({ gdp: Math.sqrt(edges[i] * edges[i + 1]), m: d3.median(seg, d => d.infant_mortality) });
    }
    g.append("path").datum(curve).attr("fill", "none").attr("stroke", "#333").attr("stroke-width", 2)
      .attr("opacity", 0.55).attr("stroke-dasharray", "1 0")
      .attr("d", d3.line().x(d => x(d.gdp)).y(d => y(d.m)).curve(d3.curveCatmullRom));
  }

  function render() {
    const yr = S.s.currentYear;
    const data = S.yearData(yr).filter(d => d.gdp_per_capita != null && d.infant_mortality != null && d.population != null)
      .sort((a, b) => b.population - a.population);
    g.select(".dots").selectAll("circle").data(data, d => d.country).join(
      enter => enter.append("circle").attr("r", d => rPop(d.population))
        .attr("cx", d => x(d.gdp_per_capita)).attr("cy", d => y(d.infant_mortality))
        .attr("fill", d => App.scales.region(d.region)).attr("fill-opacity", 0.72)
        .attr("stroke", "#fff").attr("stroke-width", 0.5).style("cursor", "pointer")
        .on("mousemove", (e, d) => App.util.tooltip.show(App.util.countryTooltip(d, yr), e))
        .on("mouseleave", App.util.tooltip.hide)
        .on("click", (e, d) => S.selectCountry(d.country)),
      update => update.call(u => u.transition().duration(App.config.animStep * 0.9).ease(d3.easeLinear)
        .attr("cx", d => x(d.gdp_per_capita)).attr("cy", d => y(d.infant_mortality)).attr("r", d => rPop(d.population))),
      exit => exit.remove()
    );
    applyHighlight(S.s.selectedCountry);
    d3.select("#insight-v5").text(
      `Each dot is a country in ${yr} (size = population). Child deaths fall sharply with income up to ` +
      `≈ $${d3.format(",.0f")(threshold.value)} per person, then barely move — money buys survival, to a point.`);
  }

  function applyHighlight(country) {
    g.select(".dots").selectAll("circle")
      .classed("dimmed", d => country && d.country !== country)
      .classed("selected-stroke", d => country && d.country === country)
      .attr("r", d => (country && d.country === country) ? rPop(d.population) + 3 : rPop(d.population))
      .filter(d => country && d.country === country).raise();
  }

  function buildLegend() {
    App.util.discreteLegend(d3.select("#legend-v5"), "",
      [{ label: "size = population · trend line = overall pattern", color: "#333" }], { horizontal: true });
  }

  return { init, threshold: () => threshold.value };
})();
