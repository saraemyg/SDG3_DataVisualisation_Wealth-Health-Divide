/* V6 — Small multiples area chart.  Owner: Student C.  Answers Q3.
 * One panel per macro-region. Each panel shows the spread of life expectancy over time as a
 * min–max band with a median line. ALL panels share identical x (year) and y (life exp) scales
 * (Mackinlay's consistency principle) so convergence (band narrowing) vs persistent divergence
 * is directly comparable across regions. A moving guide marks the current year. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v6 = (function () {
  const W = 540, H = 410, OUT = { top: 10, right: 10, bottom: 26, left: 38 };
  const COLS = 2, GAP = 16;
  const S = App.state;
  let svg, x, y, panelW, panelH, regionSeries;

  function init() {
    svg = d3.select("#v6").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const rows = Math.ceil(S.s.meta.regions.length / COLS);
    panelW = (W - OUT.left - OUT.right - GAP * (COLS - 1)) / COLS;
    panelH = (H - OUT.top - OUT.bottom - GAP * (rows - 1)) / rows;

    x = d3.scaleLinear().domain([S.s.meta.yearMin, S.s.meta.yearMax]).range([0, panelW]);
    y = d3.scaleLinear().domain([Math.max(0, S.s.meta.domains.life_expectancy[0] - 2),
      S.s.meta.domains.life_expectancy[1] + 1]).nice().range([panelH, 0]);

    buildLegend();
    render();
    S.on("filter", "v6", render);
    S.on("year", "v6", updateYearGuides);
    S.on("select", "v6", applyHighlight);
  }

  /* per region: per-year {year, min, median, max} from countries passing the filter */
  function computeSeries() {
    const m = new Map();
    S.s.meta.regions.forEach(rg => m.set(rg, []));
    const byRegionYear = d3.rollup(
      S.s.data.filter(d => d.life_expectancy != null && S.passFilter(d)),
      v => ({ min: d3.min(v, d => d.life_expectancy), median: d3.median(v, d => d.life_expectancy), max: d3.max(v, d => d.life_expectancy) }),
      d => d.region, d => d.year);
    byRegionYear.forEach((years, region) => {
      const arr = Array.from(years, ([year, s]) => ({ year, ...s })).sort((a, b) => a.year - b.year);
      m.set(region, arr);
    });
    return m;
  }

  function render() {
    regionSeries = computeSeries();
    const area = d3.area().defined(d => d.min != null).x(d => x(d.year)).y0(d => y(d.min)).y1(d => y(d.max));
    const med = d3.line().defined(d => d.median != null).x(d => x(d.year)).y(d => y(d.median));

    const panels = svg.selectAll("g.panel").data(S.s.meta.regions, d => d).join(
      enter => {
        const gp = enter.append("g").attr("class", "panel");
        gp.attr("transform", (d, i) => panelTransform(i));
        gp.append("rect").attr("class", "panel-bg").attr("width", panelW).attr("height", panelH)
          .attr("fill", "#fafafa").attr("stroke", "#eee");
        gp.append("path").attr("class", "band");
        gp.append("path").attr("class", "median");
        gp.append("line").attr("class", "year-guide").attr("y1", 0).attr("y2", panelH).attr("stroke", "#999").attr("stroke-dasharray", "2 2").attr("opacity", 0.7);
        gp.append("text").attr("class", "panel-title").attr("x", 4).attr("y", 12).attr("font-size", 11.5).attr("font-weight", 700);
        gp.append("g").attr("class", "p-axis x").attr("transform", `translate(0,${panelH})`);
        gp.append("g").attr("class", "p-axis y");
        return gp;
      }
    );

    panels.each(function (region) {
      const gp = d3.select(this), data = regionSeries.get(region) || [];
      gp.select(".band").datum(data).attr("d", area).attr("fill", App.scales.region(region)).attr("opacity", 0.3);
      gp.select(".median").datum(data).attr("d", med).attr("fill", "none")
        .attr("stroke", App.scales.region(region)).attr("stroke-width", 1.6);
      gp.select(".panel-title").attr("fill", App.scales.region(region)).text(region);
      gp.select(".p-axis.x").call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("d"))).selectAll("text").attr("font-size", 9.5);
      gp.select(".p-axis.y").call(d3.axisLeft(y).ticks(4)).selectAll("text").attr("font-size", 9.5);
    });

    updateYearGuides();
    applyHighlight(S.s.selectedCountry);
    setInsight();
  }

  function panelTransform(i) {
    const c = i % COLS, r = Math.floor(i / COLS);
    return `translate(${OUT.left + c * (panelW + GAP)},${OUT.top + r * (panelH + GAP)})`;
  }

  function updateYearGuides() {
    svg.selectAll("g.panel .year-guide").attr("x1", x(S.s.currentYear)).attr("x2", x(S.s.currentYear));
  }

  /* when a country is selected, overlay its own life-expectancy line in its region panel */
  function applyHighlight(country) {
    svg.selectAll("g.panel .country-overlay").remove();
    if (!country) return;
    const recs = (S.s.byCountry.get(country) || []).filter(d => d.life_expectancy != null);
    if (!recs.length) return;
    const region = recs[0].region;
    const idx = S.s.meta.regions.indexOf(region);
    if (idx < 0) return;
    const gp = svg.selectAll("g.panel").filter((d) => d === region);
    const cl = d3.line().x(d => x(d.year)).y(d => y(d.life_expectancy));
    gp.append("path").attr("class", "country-overlay").datum(recs)
      .attr("fill", "none").attr("stroke", "#111").attr("stroke-width", 1.8).attr("d", cl);
    gp.append("text").attr("class", "country-overlay").attr("x", panelW - 4).attr("y", 22)
      .attr("text-anchor", "end").attr("font-size", 9).attr("font-weight", 700).attr("fill", "#111").text(country);
  }

  function setInsight() {
    // compare band width (max-min) at first vs last available year for a convergence read
    let conv = 0, div = 0;
    regionSeries.forEach(arr => {
      if (arr.length < 2) return;
      const w0 = arr[0].max - arr[0].min, w1 = arr[arr.length - 1].max - arr[arr.length - 1].min;
      if (w1 < w0) conv++; else div++;
    });
    d3.select("#insight-v6").text(
      `Shaded = min–max spread of life expectancy; line = regional median. Narrowing band = ` +
      `convergence. ${conv} of 6 regions narrowed their internal spread over the period.`);
  }

  function buildLegend() {
    // each panel is already labelled + coloured by region (and the header has the colour key),
    // so we only need to explain the band/line encoding here.
    d3.select("#legend-v6").append("div").attr("class", "legend-block")
      .append("div").attr("class", "legend-title").style("text-transform", "none").style("font-weight", "400")
      .html("shaded band = min–max spread · line = median · dashed = current year");
  }

  return { init };
})();
