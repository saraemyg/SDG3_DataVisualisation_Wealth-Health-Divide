/* V6 — "Are regions converging on long lives?"  Owner: Student C.  Answers Q3.
 *  - COMBINED (default): one panel, 6 region median lines overlaid on shared axes, so you can
 *    see at a glance whether regions are converging (lines coming together) or staying apart.
 *  - SEPARATE (toggle): the same data as 6 small-multiple panels, each showing the region's
 *    min–max spread + median (identical scales = Mackinlay's consistency principle).
 * A moving guide marks the current year; selecting a country overlays its own line. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v6 = (function () {
  const W = 540, H = 410;
  const S = App.state;
  let svg, mode = "combined", x, y, regionSeries;

  function init() {
    buildControls();
    svg = d3.select("#v6").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    y = d3.scaleLinear().domain([Math.max(0, S.s.meta.domains.life_expectancy[0] - 2),
      S.s.meta.domains.life_expectancy[1] + 1]).nice();
    buildLegend();
    render();
    S.on("filter", "v6", render);
    S.on("year", "v6", render);
    S.on("select", "v6", render);
  }

  /* per region: per-year {year,min,median,max} from countries passing the filter */
  function computeSeries() {
    const m = new Map();
    S.s.meta.regions.forEach(rg => m.set(rg, []));
    const byRegionYear = d3.rollup(
      S.s.data.filter(d => d.life_expectancy != null && S.passFilter(d)),
      v => ({ min: d3.min(v, d => d.life_expectancy), median: d3.median(v, d => d.life_expectancy), max: d3.max(v, d => d.life_expectancy) }),
      d => d.region, d => d.year);
    byRegionYear.forEach((years, region) => {
      m.set(region, Array.from(years, ([year, s]) => ({ year, ...s })).sort((a, b) => a.year - b.year));
    });
    return m;
  }

  function render() {
    regionSeries = computeSeries();
    svg.selectAll("*").remove();
    if (mode === "combined") renderCombined(); else renderSeparate();
    setInsight();
  }

  /* ---------- COMBINED: 6 median lines on one set of axes ---------- */
  function renderCombined() {
    const M = { top: 14, right: 104, bottom: 28, left: 40 };
    const iW = W - M.left - M.right, iH = H - M.top - M.bottom;
    x = d3.scaleLinear().domain([S.s.meta.yearMin, S.s.meta.yearMax]).range([0, iW]);
    y.range([iH, 0]);
    const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-iW).tickFormat("")).select(".domain").remove();
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", 0).attr("y", -32).attr("text-anchor", "end").text("Median life expectancy →");

    const line = d3.line().defined(d => d.median != null).x(d => x(d.year)).y(d => y(d.median));
    S.s.meta.regions.forEach(region => {
      const data = regionSeries.get(region) || [];
      g.append("path").datum(data).attr("fill", "none").attr("stroke", App.scales.region(region))
        .attr("stroke-width", 2.2).attr("opacity", 0.9).attr("d", line);
      const last = data[data.length - 1];
      if (last) g.append("text").attr("x", x(last.year) + 5).attr("y", y(last.median)).attr("dy", "0.32em")
        .attr("font-size", 9.5).attr("fill", App.scales.region(region))
        .text(region.replace(" & ", " &​"));
    });

    overlaySelected(g, line);
    yearGuide(g, iH, x);
  }

  /* ---------- SEPARATE: 6 small-multiple panels with min–max bands ---------- */
  function renderSeparate() {
    const OUT = { top: 12, right: 10, bottom: 26, left: 36 }, COLS = 2, GAP = 38;
    const rows = Math.ceil(S.s.meta.regions.length / COLS);
    const panelW = (W - OUT.left - OUT.right - GAP * (COLS - 1)) / COLS;
    const panelH = (H - OUT.top - OUT.bottom - GAP * (rows - 1)) / rows;
    x = d3.scaleLinear().domain([S.s.meta.yearMin, S.s.meta.yearMax]).range([0, panelW]);
    y.range([panelH, 0]);
    const area = d3.area().defined(d => d.min != null).x(d => x(d.year)).y0(d => y(d.min)).y1(d => y(d.max));
    const med = d3.line().defined(d => d.median != null).x(d => x(d.year)).y(d => y(d.median));

    S.s.meta.regions.forEach((region, i) => {
      const c = i % COLS, r = Math.floor(i / COLS);
      const gp = svg.append("g").attr("transform", `translate(${OUT.left + c * (panelW + GAP)},${OUT.top + r * (panelH + GAP)})`);
      const data = regionSeries.get(region) || [];
      gp.append("rect").attr("width", panelW).attr("height", panelH).attr("fill", "#fafafa").attr("stroke", "#eee");
      gp.append("path").datum(data).attr("d", area).attr("fill", App.scales.region(region)).attr("opacity", 0.3);
      gp.append("path").datum(data).attr("d", med).attr("fill", "none").attr("stroke", App.scales.region(region)).attr("stroke-width", 1.6);
      gp.append("text").attr("x", 4).attr("y", 11).attr("font-size", 10.5).attr("font-weight", 700)
        .attr("fill", App.scales.region(region)).text(region);
      gp.append("g").attr("transform", `translate(0,${panelH})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("d"))).selectAll("text").attr("font-size", 8.5);
      gp.append("g").call(d3.axisLeft(y).ticks(4)).selectAll("text").attr("font-size", 8.5);
      gp.append("line").attr("x1", x(S.s.currentYear)).attr("x2", x(S.s.currentYear)).attr("y1", 0).attr("y2", panelH)
        .attr("stroke", "#999").attr("stroke-dasharray", "2 2").attr("opacity", 0.7);
      // selected-country overlay inside its own region panel
      if (S.s.selectedCountry) {
        const recs = (S.s.byCountry.get(S.s.selectedCountry) || []).filter(d => d.life_expectancy != null);
        if (recs.length && recs[0].region === region) {
          gp.append("path").datum(recs).attr("fill", "none").attr("stroke", "#111").attr("stroke-width", 1.8)
            .attr("d", d3.line().x(d => x(d.year)).y(d => y(d.life_expectancy)));
          gp.append("text").attr("x", panelW - 4).attr("y", 20).attr("text-anchor", "end")
            .attr("font-size", 9).attr("font-weight", 700).attr("fill", "#111").text(S.s.selectedCountry);
        }
      }
    });
  }

  function overlaySelected(g, line) {
    if (!S.s.selectedCountry) return;
    const recs = (S.s.byCountry.get(S.s.selectedCountry) || []).filter(d => d.life_expectancy != null);
    if (!recs.length) return;
    g.append("path").datum(recs.map(d => ({ year: d.year, median: d.life_expectancy })))
      .attr("fill", "none").attr("stroke", "#111").attr("stroke-width", 1.8).attr("stroke-dasharray", "4 2").attr("d", line);
    const lp = recs[recs.length - 1];
    g.append("text").attr("x", x(lp.year) + 5).attr("y", y(lp.life_expectancy) - 6)
      .attr("font-size", 10).attr("font-weight", 700).attr("fill", "#111").text(S.s.selectedCountry);
  }

  function yearGuide(g, iH, xs) {
    g.append("line").attr("x1", xs(S.s.currentYear)).attr("x2", xs(S.s.currentYear)).attr("y1", 0).attr("y2", iH)
      .attr("stroke", "#999").attr("stroke-dasharray", "2 2").attr("opacity", 0.7);
  }

  function setInsight() {
    let conv = 0;
    regionSeries.forEach(arr => {
      if (arr.length < 2) return;
      const w0 = arr[0].max - arr[0].min, w1 = arr[arr.length - 1].max - arr[arr.length - 1].min;
      if (w1 < w0) conv++;
    });
    d3.select("#insight-v6").text(mode === "combined"
      ? `Each line is a region's median life expectancy. Lines drifting together = regions converging on longer lives.`
      : `Shaded = min–max spread; line = median. Narrowing band = convergence. ${conv} of 6 regions narrowed their internal spread.`);
  }

  function buildControls() {
    const wrap = d3.select("#v6-controls");
    wrap.append("span").attr("class", "v2-label").text("View:");
    const seg = wrap.append("div").attr("class", "seg-mini");
    [["combined", "Combined"], ["separate", "By region"]].forEach(([m, lab]) => {
      seg.append("button").classed("active", m === mode).text(lab)
        .on("click", function () {
          mode = m;
          seg.selectAll("button").classed("active", false);
          d3.select(this).classed("active", true);
          render();
        });
    });
  }

  function buildLegend() {
    d3.select("#legend-v6").append("div").attr("class", "legend-block")
      .append("div").attr("class", "legend-title").style("text-transform", "none").style("font-weight", "400")
      .html("colour = region (header key) · dashed = current year");
  }

  return { init };
})();
