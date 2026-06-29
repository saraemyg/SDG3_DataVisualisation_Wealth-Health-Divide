/* V5 — "Does money buy survival?"  Owner: Student C.  Answers Q2.
 * One dot per country (x = GDP per person, log; y = child mortality; size = population; colour =
 * region). Reading aids that make the story obvious:
 *   - a dashed THRESHOLD line + band: the income beyond which child deaths stop falling fast;
 *   - a grey TREND curve: the typical (median) mortality at each income — above = worse than
 *     expected for that income, below = better;
 *   - soft REGION HULLS: a translucent blob behind each continent's dots so you can see how each
 *     continent clusters (e.g. Sub-Saharan Africa = low income / high mortality, Europe = the
 *     opposite). The dots move with the global year cursor. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v5 = (function () {
  const M = { top: 16, right: 18, bottom: 48, left: 56 }, H = 410, NARROW = 540;
  const S = App.state;
  const shortRegion = {
    "Europe & Central Asia": "Europe", "Americas": "Americas", "East Asia & Pacific": "E Asia/Pac",
    "South Asia": "South Asia", "Middle East & North Africa": "MENA", "Sub-Saharan Africa": "Sub-Sah. Africa"
  };
  let svg, g, x, y, rPop, threshold, W = NARROW, iW, iH;

  function init() {
    svg = d3.select("#v5").append("svg");
    g = svg.append("g");
    rPop = d3.scaleSqrt().domain([0, App.scales.domains.population[1]]).range([2.5, 12]);
    buildLegend();
    build();
    S.on("year", "v5", render);
    S.on("filter", "v5", render);
    S.on("select", "v5", applyHighlight);
  }

  /* widen the x-axis when the chart is expanded so the data isn't cramped on the left;
   * measure the (now large) container and match its aspect ratio so it fills the width. */
  function setWide(on) {
    if (on) {
      const el = document.getElementById("v5");
      const cw = el.clientWidth, ch = el.clientHeight;
      const aspect = (cw > 60 && ch > 60) ? Math.min(2.8, Math.max(1.6, cw / ch)) : 2.1;
      W = Math.round(H * aspect);
    } else { W = NARROW; }
    build();
  }

  /* (re)build the static layout + scales for the current width, then render the marks */
  function build() {
    iW = W - M.left - M.right; iH = H - M.top - M.bottom;
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    g.attr("transform", `translate(${M.left},${M.top})`).selectAll("*").remove();
    x = App.scales.gdpX([0, iW]);
    y = App.scales.infantY([iH, 0]);
    threshold = computeThreshold();

    // paint order: grid -> axes -> threshold band -> region hulls -> trend -> threshold line -> dots -> labels
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-iW).tickFormat("")).select(".domain").remove();
    const xticks = [200, 1000, 5000, 20000, 100000].filter(v => v >= x.domain()[0] && v <= x.domain()[1]);
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickValues(xticks).tickFormat(d => "$" + d3.format("~s")(d)));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
    g.append("text").attr("class", "axis-title").attr("x", iW).attr("y", iH + 40).attr("text-anchor", "end")
      .text("GDP per person (US$, log) — richer →");
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)").attr("x", 0).attr("y", -42)
      .attr("text-anchor", "end").text("↑ more children die (per 1,000)");

    g.append("rect").attr("x", x(threshold.bandLo)).attr("width", x(threshold.bandHi) - x(threshold.bandLo))
      .attr("y", 0).attr("height", iH).attr("fill", "#0072B2").attr("opacity", 0.06);

    g.append("g").attr("class", "groups");
    drawTrend();
    drawThresholdLine();
    g.append("g").attr("class", "dots");
    g.append("g").attr("class", "glabels");
    render();
  }

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

  function drawThresholdLine() {
    g.append("line").attr("x1", x(threshold.value)).attr("x2", x(threshold.value)).attr("y1", 0).attr("y2", iH)
      .attr("stroke", "#0072B2").attr("stroke-dasharray", "4 3").attr("stroke-width", 1.4);
    g.append("text").attr("x", x(threshold.value)).attr("y", 12).attr("text-anchor", "middle")
      .attr("class", "anno-text").attr("font-size", 10).attr("fill", "#0072B2").attr("font-weight", 700)
      .text(`≈ $${d3.format(",.0f")(threshold.value)} — deaths stop falling fast`);
  }

  /* grey trend curve: binned median across ALL years => the typical level at each income */
  function drawTrend() {
    const pts = S.s.data.filter(d => d.gdp_per_capita != null && d.infant_mortality != null);
    const lo = Math.log10(x.domain()[0]), hi = Math.log10(x.domain()[1]);
    const edges = d3.range(17).map(i => Math.pow(10, lo + (hi - lo) * i / 16));
    const curve = [];
    for (let i = 0; i < edges.length - 1; i++) {
      const seg = pts.filter(d => d.gdp_per_capita >= edges[i] && d.gdp_per_capita < edges[i + 1]);
      if (seg.length >= 8) curve.push({ gdp: Math.sqrt(edges[i] * edges[i + 1]), m: d3.median(seg, d => d.infant_mortality) });
    }
    g.append("path").datum(curve).attr("fill", "none").attr("stroke", "#555").attr("stroke-width", 2.2)
      .attr("opacity", 0.6).attr("d", d3.line().x(d => x(d.gdp)).y(d => y(d.m)).curve(d3.curveCatmullRom));
    // label the curve from open space (upper area) with a leader line, so it never collides
    // with the continent blobs/labels lower down
    const anchor = curve[Math.round(curve.length * 0.32)];
    if (anchor) App.util.annotate(g, {
      x: x(700), y: y(185), anchor: "start",
      text: ["Grey curve = typical level", "(median deaths for that income)"],
      leaderTo: [x(anchor.gdp), y(anchor.m)], color: "#666"
    });
  }

  /* soft translucent hull behind each continent's dots */
  function drawGroups(data) {
    const hulls = [];
    d3.group(data, d => d.region).forEach((arr, region) => {
      const pts = arr.map(d => [x(d.gdp_per_capita), y(d.infant_mortality)]);
      if (pts.length < 3) return;
      const hull = d3.polygonHull(pts);
      if (!hull) return;
      const cx = d3.mean(hull, p => p[0]), cy = d3.mean(hull, p => p[1]), pad = 12;
      const padded = hull.map(([px, py]) => { const dx = px - cx, dy = py - cy, l = Math.hypot(dx, dy) || 1; return [px + dx / l * pad, py + dy / l * pad]; });
      hulls.push({ region, hull: padded, cx, cy });
    });
    const line = d3.line().curve(d3.curveCatmullRomClosed);
    g.select(".groups").selectAll("path").data(hulls, d => d.region).join("path")
      .attr("d", d => line(d.hull) + "Z")
      .attr("fill", d => App.scales.region(d.region)).attr("fill-opacity", 0.10)
      .attr("stroke", d => App.scales.region(d.region)).attr("stroke-opacity", 0.30).attr("stroke-width", 1);
    // label each blob near its top edge, then de-overlap vertically so the clustered
    // wealthy continents don't print on top of each other
    hulls.sort((a, b) => a.region.localeCompare(b.region));
    const topY = hulls.map(h => Math.min(...h.hull.map(p => p[1])) - 4);
    const dodged = App.util.dodge(topY, 13);
    hulls.forEach((h, i) => { h.ly = Math.max(8, dodged[i]); });
    g.select(".glabels").selectAll("text").data(hulls, d => d.region).join("text")
      .attr("class", "v5-grouplabel anno-text").attr("x", d => d.cx).attr("y", d => d.ly)
      .attr("text-anchor", "middle").attr("fill", d => App.scales.region(d.region))
      .attr("font-size", 9.5).attr("font-weight", 700).attr("opacity", 0.95)
      .text(d => shortRegion[d.region] || d.region);
  }

  function render() {
    const yr = S.s.currentYear;
    const data = S.yearData(yr).filter(d => d.gdp_per_capita != null && d.infant_mortality != null && d.population != null)
      .sort((a, b) => b.population - a.population);
    drawGroups(data);
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
    d3.select("#insight-v5").html(
      `Each dot is a country in ${yr} (size = population, colour = continent). Child deaths fall steeply with income up to ` +
      `≈ <b>$${d3.format(",.0f")(threshold.value)}</b>, then barely move. The shaded blobs show each continent clusters ` +
      `in a different corner — Sub-Saharan Africa low-income/high-mortality, Europe the opposite.`);
  }

  function applyHighlight(country) {
    g.select(".dots").selectAll("circle")
      .classed("dimmed", d => country && d.country !== country)
      .classed("selected-stroke", d => country && d.country === country)
      .attr("r", d => (country && d.country === country) ? rPop(d.population) + 3 : rPop(d.population))
      .filter(d => country && d.country === country).raise();
  }

  function buildLegend() {
    const sel = d3.select("#legend-v5");
    sel.html("");
    const b = sel.append("div").attr("class", "legend-block");
    b.append("div").attr("class", "legend-title").text("How to read this chart");
    b.append("div").attr("class", "legend-items v").html(
      `<div class="legend-item"><span class="swatch" style="border-radius:50%;background:#bbb;width:8px;height:8px"></span>each dot = one country &nbsp;(→ richer, ↑ more deaths)</div>
       <div class="legend-item"><span class="swatch" style="border-radius:50%;background:#bbb;width:15px;height:15px"></span>bigger dot = bigger population</div>
       <div class="legend-item"><span class="swatch" style="background:#555;height:3px;align-self:center"></span>grey curve = typical (median) level for that income</div>
       <div class="legend-item"><span class="swatch" style="background:#0072B2;opacity:.5"></span>dashed line / band = income threshold</div>
       <div class="legend-item"><span class="swatch" style="background:#56B4E9;opacity:.3"></span>shaded blob = where a continent clusters</div>`);
    App.util.discreteLegend(sel, "Continent (dot & blob colour)",
      S.s.meta.regions.map(rg => ({ label: shortRegion[rg] || rg, color: App.scales.region(rg) })), { horizontal: true });
  }

  return { init, setWide, threshold: () => threshold.value };
})();
