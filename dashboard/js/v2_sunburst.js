/* V2 — Zoomable sunburst, coloured by REGION.  Owner: Student A.  Answers Q1/Q3.
 * Rings (in → out): region → income tier → child-mortality tier → country.  Arc angle = share
 * of population.  Colour = region (the shared 6-colour key in the header), fading outward — so
 * there's no longer a big grey "Other" block. Click a wedge to zoom into it (centre = zoom out);
 * click a COUNTRY (outer ring) to spotlight it across the dashboard. Labels show on the wider
 * arcs; everything else is on hover. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v2 = (function () {
  const SIZE = 520, radius = SIZE / 10;     // 4 rings + hole fit within SIZE/2
  const S = App.state;
  let svg, g, parentCircle, centerLabel, arc, root, year, mode = "region"; // "region" | "bloc"

  function init() {
    svg = d3.select("#v2").append("svg")
      .attr("viewBox", `${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`)
      .attr("width", SIZE).attr("height", SIZE);
    g = svg.append("g");

    arc = d3.arc()
      .startAngle(d => d.x0).endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.004)).padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius).outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

    parentCircle = g.append("circle").attr("r", radius).attr("fill", "none")
      .attr("pointer-events", "all").style("cursor", "pointer");
    centerLabel = g.append("text").attr("text-anchor", "middle").attr("dy", "0.35em")
      .attr("font-size", 13).attr("font-weight", 600).attr("fill", "#555").attr("pointer-events", "none");

    buildToggle();
    updateLegend();
    draw(S.s.currentYear);
    S.on("year", "v2", draw);
    S.on("filter", "v2", () => draw(year));
    S.on("select", "v2", applyHighlight);
  }

  function buildHierarchy(data) {
    const topKey = mode === "region" ? (d => d.region) : (d => d.bloc);
    const grouped = d3.group(data, topKey, d => d.gdp_tier, d => d.mortality_tier, d => d.country);
    function conv(m) {
      return Array.from(m, ([key, val]) => (val instanceof Map)
        ? { name: key, children: conv(val) }
        : { name: key, value: d3.sum(val, d => d.population), record: val[0] });
    }
    return { name: "All", children: conv(grouped) };
  }

  function groupOf(d) { let a = d; while (a.depth > 1) a = a.parent; return a.data.name; }
  function groupColor(name) {
    return mode === "region" ? App.scales.region(name) : (App.config.blocColors[name] || "#bbbbbb");
  }
  function fill(d) { return groupColor(groupOf(d)); }
  function fillOpacity(d) { return [0, 0.92, 0.74, 0.58, 0.45][d.depth] || 0.4; }
  function arcVisible(d) { return d.y0 >= 1 && d.y1 <= 5 && d.x1 > d.x0; }
  function labelVisible(d) { return arcVisible(d) && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.045; }
  function labelTransform(d) {
    const xMid = (d.x0 + d.x1) / 2 * 180 / Math.PI, yMid = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${xMid - 90}) translate(${yMid},0) rotate(${xMid < 180 ? 0 : 180})`;
  }
  function nodeKey(d) { return d.ancestors().map(a => a.data.name).reverse().join("/"); }

  function draw(yr) {
    year = yr;
    let data = S.yearData(yr).filter(d => d.gdp_tier && d.mortality_tier && d.population != null);
    // OECD-vs-OPEC mode: drop "Other" so it's a clean two-bloc comparison, not a grey majority
    if (mode === "bloc") data = data.filter(d => d.bloc !== "Other");
    const hierarchy = d3.hierarchy(buildHierarchy(data))
      .sum(d => d.value || 0).sort((a, b) => b.value - a.value);
    root = d3.partition().size([2 * Math.PI, hierarchy.height + 1])(hierarchy);
    root.each(d => d.current = d);
    centerLabel.text(yr);

    g.selectAll("path.arc").data(root.descendants().slice(1), nodeKey).join(
      enter => enter.append("path").attr("class", "arc")
        .attr("fill", fill).attr("fill-opacity", d => arcVisible(d) ? fillOpacity(d) : 0)
        .attr("pointer-events", d => arcVisible(d) ? "auto" : "none")
        .attr("stroke", "#fff").attr("stroke-width", 0.5)
        .attr("d", d => arc(d.current)).style("cursor", "pointer")
        .on("click", clicked)
        .on("mousemove", (e, d) => App.util.tooltip.show(tip(d), e))
        .on("mouseleave", App.util.tooltip.hide),
      update => update.attr("fill", fill)
        .attr("fill-opacity", d => arcVisible(d) ? fillOpacity(d) : 0)
        .attr("pointer-events", d => arcVisible(d) ? "auto" : "none")
        .attr("d", d => arc(d.current)),
      exit => exit.remove()
    );

    g.selectAll("text.arc-label").data(root.descendants().slice(1).filter(labelVisible), nodeKey).join(
      enter => enter.append("text").attr("class", "arc-label").attr("dy", "0.32em")
        .attr("text-anchor", "middle").attr("font-size", 9.5).attr("pointer-events", "none")
        .attr("fill", "#1c1c1c").attr("transform", labelTransform).text(d => trunc(d.data.name, d)),
      update => update.attr("transform", labelTransform).text(d => trunc(d.data.name, d)),
      exit => exit.remove()
    );

    parentCircle.datum(root).on("click", clicked);
    applyHighlight(S.s.selectedCountry);
    setInsight(data, yr);
  }

  function trunc(name, d) {
    const arcLen = (d.x1 - d.x0) * ((d.y0 + d.y1) / 2) * radius; // ~pixels of arc
    const max = Math.floor(arcLen / 6);
    return name.length > max ? (max > 1 ? name.slice(0, max - 1) + "…" : "") : name;
  }

  function clicked(event, p) {
    if (!p.children) { if (p.data.record) S.selectCountry(p.data.record.country); return; }
    parentCircle.datum(p.parent || root);
    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth), y1: Math.max(0, d.y1 - p.depth)
    });
    const t = g.transition().duration(680);
    g.selectAll("path.arc").transition(t)
      .tween("data", d => { const i = d3.interpolate(d.current, d.target); return tt => d.current = i(tt); })
      .attrTween("d", d => () => arc(d.current))
      .attr("fill-opacity", d => arcVisible(d.target) ? fillOpacity(d) : 0)
      .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none");
    g.selectAll("text.arc-label").transition(t)
      .attrTween("transform", d => () => labelTransform(d.current))
      .attr("fill-opacity", d => labelVisible(d.target) ? 1 : 0);
    centerLabel.text(p.depth === 0 ? year : p.data.name);
  }

  function applyHighlight(country) {
    g.selectAll("path.arc")
      .attr("stroke", d => (d.data.record && d.data.record.country === country) ? "#111" : "#fff")
      .attr("stroke-width", d => (d.data.record && d.data.record.country === country) ? 1.8 : 0.5)
      .filter(d => d.data.record && d.data.record.country === country).raise();
  }

  function tip(d) {
    const levels = ["All", mode === "region" ? "Region" : "Bloc", "Income tier", "Child-mortality tier", "Country"];
    const tot = root.value || 1, share = (100 * d.value / tot).toFixed(1);
    return `<div class="tt-title"><span class="tt-dot" style="background:${groupColor(groupOf(d))}"></span>${d.data.name}</div>
      <div class="tt-sub">${levels[d.depth] || ""}</div>
      <table><tr><td>Population</td><td>${App.fmt.pop(d.value)}</td></tr>
      <tr><td>Share of total</td><td>${share}%</td></tr></table>`;
  }

  function setInsight(data, yr) {
    if (mode === "bloc") {
      const pop = d3.rollup(data, v => d3.sum(v, d => d.population), d => d.bloc);
      d3.select("#insight-v2").text(
        `OECD vs OPEC only (${yr}) — "Other" countries hidden for a clean comparison. OECD: ` +
        `${App.fmt.pop(pop.get("OECD") || 0)} people · OPEC: ${App.fmt.pop(pop.get("OPEC") || 0)}. ` +
        `Click a wedge to zoom, a country to spotlight it.`);
      return;
    }
    const pop = d3.rollup(data, v => d3.sum(v, d => d.population), d => d.region);
    let top = null, topV = -1;
    pop.forEach((v, r) => { if (v > topV) { topV = v; top = r; } });
    d3.select("#insight-v2").text(
      `Rings out from centre: region → income → child-mortality → country (${yr}). ${top} holds the most ` +
      `people shown. Click a wedge to zoom in; click a country to spotlight it everywhere.`);
  }

  function buildToggle() {
    const modes = [["region", "By region"], ["bloc", "OECD vs OPEC"]];
    const wrap = d3.select("#v2-controls");
    wrap.append("span").attr("class", "v2-label").text("Colour by:");
    wrap.append("div").attr("class", "seg-mini").selectAll("button").data(modes).join("button")
      .text(d => d[1]).classed("active", d => d[0] === mode)
      .on("click", (e, d) => setMode(d[0]));
  }

  function setMode(m) {
    if (m === mode) return;
    mode = m;
    d3.select("#v2-controls").selectAll(".seg-mini button").classed("active", d => d[0] === mode);
    updateLegend();
    draw(year);
  }

  function updateLegend() {
    const sel = d3.select("#legend-v2").html("");
    if (mode === "region") {
      sel.append("div").attr("class", "legend-block").append("div").attr("class", "legend-title")
        .style("text-transform", "none").style("font-weight", "400")
        .html("rings: region → income → child-mortality → country · colour = region (see header) · click to zoom");
    } else {
      App.util.discreteLegend(sel, "Bloc (colour)",
        [{ label: "OECD", color: App.config.blocColors.OECD }, { label: "OPEC", color: App.config.blocColors.OPEC }],
        { horizontal: true });
      sel.append("div").attr("class", "legend-block").append("div").attr("class", "legend-title")
        .style("text-transform", "none").style("font-weight", "400")
        .html("only OECD &amp; OPEC shown · rings: bloc → income → child-mortality → country");
    }
  }

  return { init, setMode, threshold: () => null };
})();
