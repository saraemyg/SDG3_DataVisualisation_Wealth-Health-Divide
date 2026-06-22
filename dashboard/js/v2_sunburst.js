/* V2 — Zoomable sunburst.  Owner: Student A.  Answers Q1.
 * Rings (in -> out): bloc -> GDP tier -> infant-mortality tier -> country.  Arc angle = share
 * of population.  Click a ring to zoom into that sub-hierarchy (centre = zoom out); click a
 * COUNTRY (outer ring) to set the linked selection. Colour = bloc, fading outward, so the
 * OECD/OPEC/Other split (Q1) reads at a glance. Built from the current-year snapshot. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v2 = (function () {
  const SIZE = 400, radius = SIZE / 6;
  const S = App.state;
  let svg, g, parentCircle, centerLabel, arc, root, year;

  function init() {
    svg = d3.select("#v2").append("svg")
      .attr("viewBox", `${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`)
      .attr("width", SIZE).attr("height", SIZE);
    g = svg.append("g");

    arc = d3.arc()
      .startAngle(d => d.x0).endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005)).padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius).outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    // centre circle = "zoom out"
    parentCircle = g.append("circle").attr("r", radius).attr("fill", "none")
      .attr("pointer-events", "all").style("cursor", "pointer");
    centerLabel = g.append("text").attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("font-size", 11).attr("fill", "#666").attr("pointer-events", "none");

    buildLegend();
    draw(S.s.currentYear);

    S.on("year", "v2", draw);
    S.on("filter", "v2", () => draw(year));
    S.on("select", "v2", applyHighlight);
  }

  function blocColor(name) { return App.config.blocColors[name] || "#cccccc"; }

  function buildHierarchy(data) {
    const grouped = d3.group(data, d => d.bloc, d => d.gdp_tier, d => d.mortality_tier, d => d.country);
    function conv(m, depth) {
      return Array.from(m, ([key, val]) => {
        if (val instanceof Map) return { name: key, children: conv(val, depth + 1) };
        return { name: key, value: d3.sum(val, d => d.population), record: val[0] };
      });
    }
    return { name: "All", children: conv(grouped, 1) };
  }

  function draw(yr) {
    year = yr;
    const data = S.yearData(yr).filter(d => d.gdp_tier && d.mortality_tier && d.population != null);
    const hierarchy = d3.hierarchy(buildHierarchy(data))
      .sum(d => d.value || 0).sort((a, b) => b.value - a.value);
    root = d3.partition().size([2 * Math.PI, hierarchy.height + 1])(hierarchy);
    root.each(d => d.current = d);
    centerLabel.text(yr);

    const paths = g.selectAll("path.arc").data(root.descendants().slice(1), d => nodeKey(d));
    paths.join(
      enter => enter.append("path").attr("class", "arc")
        .attr("fill", d => fill(d)).attr("fill-opacity", d => arcVisible(d.current) ? opacity(d) : 0)
        .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
        .attr("d", d => arc(d.current)).style("cursor", "pointer")
        .on("click", clicked)
        .on("mousemove", (e, d) => App.util.tooltip.show(arcTip(d), e))
        .on("mouseleave", App.util.tooltip.hide),
      update => update.attr("fill", d => fill(d))
        .attr("fill-opacity", d => arcVisible(d.current) ? opacity(d) : 0)
        .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
        .attr("d", d => arc(d.current)),
      exit => exit.remove()
    );
    parentCircle.datum(root).on("click", clicked);
    applyHighlight(S.s.selectedCountry);
    setInsight(data, yr);
  }

  function nodeKey(d) { return d.ancestors().map(a => a.data.name).reverse().join("/"); }
  function fill(d) { let n = d; while (n.depth > 1) n = n.parent; return blocColor(n.data.name); }
  function opacity(d) { return [0, 0.85, 0.65, 0.5, 0.38][d.depth] || 0.35; }
  function arcVisible(d) { return d.y1 <= 4 && d.y0 >= 1 && d.x1 > d.x0; }

  function clicked(event, p) {
    // leaf (country) -> linked selection rather than zoom
    if (!p.children) { if (p.data.record) S.selectCountry(p.data.record.country); return; }
    parentCircle.datum(p.parent || root);
    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth), y1: Math.max(0, d.y1 - p.depth)
    });
    const t = g.transition().duration(650);
    g.selectAll("path.arc").transition(t)
      .tween("data", d => { const i = d3.interpolate(d.current, d.target); return tt => d.current = i(tt); })
      .attrTween("d", d => () => arc(d.current))
      .attr("fill-opacity", d => arcVisible(d.target) ? opacity(d) : 0)
      .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none");
    centerLabel.text(p.depth === 0 ? year : p.data.name);
  }

  function applyHighlight(country) {
    g.selectAll("path.arc")
      .classed("selected-stroke", d => d.data.record && d.data.record.country === country)
      .attr("stroke", d => (d.data.record && d.data.record.country === country) ? "#111" : null)
      .attr("stroke-width", d => (d.data.record && d.data.record.country === country) ? 1.5 : null);
  }

  function arcTip(d) {
    const levels = ["", "Bloc", "GDP tier", "Mortality tier", "Country"];
    const tot = root.value || 1, share = (100 * d.value / tot).toFixed(1);
    return `<div class="tt-title">${d.data.name}</div>
      <div class="tt-sub">${levels[d.depth] || ""}</div>
      <table><tr><td>Population</td><td>${App.fmt.pop(d.value)}</td></tr>
      <tr><td>Share</td><td>${share}%</td></tr></table>`;
  }

  function setInsight(data, yr) {
    const pop = d3.rollup(data, v => d3.sum(v, d => d.population), d => d.bloc);
    const tot = d3.sum(Array.from(pop.values())) || 1;
    const oecd = ((pop.get("OECD") || 0) / tot * 100).toFixed(0);
    d3.select("#insight-v2").text(
      `Population by bloc → wealth → mortality tier (${yr}). OECD holds ~${oecd}% of the shown ` +
      `population. Click a wedge to zoom in; click a country (outer ring) to link it.`);
  }

  function buildLegend() {
    const sel = d3.select("#legend-v2");
    App.util.discreteLegend(sel, "Bloc (colour)",
      S.s.meta.blocs.map(b => ({ label: b, color: App.config.blocColors[b] })), { horizontal: true });
    sel.append("div").attr("class", "legend-block")
      .append("div").attr("class", "legend-title")
      .style("text-transform", "none").style("font-weight", "400")
      .html("Rings out →: bloc · GDP tier · mortality tier · country.<br>Opacity fades outward; hover for the value.");
  }

  return { init };
})();
