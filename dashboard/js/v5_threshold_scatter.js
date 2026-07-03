/* V5 — "Does money buy survival?"  Owner: Student C.  Answers Q2.
 * One dot per country (x = GDP per person, log; y = child mortality; size = population; colour =
 * region). Reading aids that make the story obvious:
 *   - a dashed THRESHOLD line + band: the income beyond which child deaths stop falling fast;
 *   - a grey TREND curve: the typical (median) mortality at each income — above = worse than
 *     expected for that income, below = better;
 *   - a small boxed REGION legend inside the plot so the colours read like a map key.
 * The dots move with the global year cursor. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v5 = (function () {
  const M = { top: 16, right: 18, bottom: 48, left: 56 }, H = 410, NARROW = 540;
  const S = App.state;
  const shortRegion = {
    "Europe & Central Asia": "Europe", "Americas": "Americas", "East Asia & Pacific": "E Asia/Pac",
    "South Asia": "South Asia", "Middle East & North Africa": "MENA", "Sub-Saharan Africa": "Sub-Sah. Africa"
  };
  let svg, g, x, y, rPop, threshold, W = NARROW, iW, iH, side;

  function init() {
    const root = d3.select("#v5");
    root.selectAll(".v5-legend, .v5-side").remove();
    svg = root.append("svg");
    g = svg.append("g");
    side = root.append("div").attr("class", "v5-side");   // right column: legend + explanation (expanded only)
    rPop = d3.scaleSqrt().domain([0, App.scales.domains.population[1]]).range([2.5, 12]);
    build();          // computes `threshold` (needed by buildSide) and draws the plot
    buildSide();
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

    // paint order: grid -> axes -> threshold band -> trend -> threshold line -> dots
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-iW).tickFormat("")).select(".domain").remove();
    const xticks = [200, 1000, 5000, 20000, 100000].filter(v => v >= x.domain()[0] && v <= x.domain()[1]);
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickValues(xticks).tickFormat(d => "$" + d3.format("~s")(d)));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
    g.append("text").attr("class", "axis-title").attr("x", iW).attr("y", iH + 40).attr("text-anchor", "end")
      .text("GDP per person (US$, log) → richer");
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)").attr("x", 0).attr("y", -42)
      .attr("text-anchor", "end").text("more children die (per 1,000) →");

    g.append("rect").attr("x", x(threshold.bandLo)).attr("width", x(threshold.bandHi) - x(threshold.bandLo))
      .attr("y", 0).attr("height", iH).attr("fill", "#0072B2").attr("opacity", 0.06);
    drawTrend();
    drawThresholdLine();
    g.append("g").attr("class", "dots");
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
    g.append("text").attr("x", x(threshold.value)).attr("y", 35).attr("text-anchor", "middle")
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
    const lineGen = d3.line().x(d => x(d.gdp)).y(d => y(d.m)).curve(d3.curveCatmullRom);
    g.append("path").datum(curve).attr("fill", "none").attr("stroke", "#555").attr("stroke-width", 2.2)
      .attr("opacity", 0.6).attr("d", lineGen);
    // invisible fat hit-line on top so you can HOVER the grey curve to read its value
    g.append("path").datum(curve).attr("fill", "none").attr("stroke", "transparent").attr("stroke-width", 16)
      .attr("pointer-events", "stroke").style("cursor", "crosshair").attr("d", lineGen)
      .on("mousemove", function (e) {
        const px = d3.pointer(e, g.node())[0];
        const gdp = x.invert(px);
        const pt = curve.reduce((a, b) => Math.abs(b.gdp - gdp) < Math.abs(a.gdp - gdp) ? b : a);
        App.util.tooltip.show(
          `<div class="tt-title">Typical level (median)</div>` +
          `<div class="tt-sub">around $${d3.format(",.0f")(pt.gdp)} per person</div>` +
          `<table><tr><td>Child mortality</td><td>${pt.m.toFixed(1)} / 1,000</td></tr></table>`, e);
      })
      .on("mouseleave", App.util.tooltip.hide);
    // very soft label sitting right on the curve toward the right side (no leader line)
    const lab = curve[Math.min(curve.length - 1, Math.round(curve.length * 0.6))];
    if (lab) g.append("text")
      .attr("x", x(lab.gdp)).attr("y", y(lab.m) - 6)
      .attr("text-anchor", "middle").attr("class", "anno-text")
      .attr("font-size", 8.5).attr("font-style", "italic").attr("font-weight", 400)
      .attr("fill", "#c4c4c4").text("typical level (hover to read)");
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
    d3.select("#insight-v5").html(
      `Each dot is a country in ${yr} (size = population, colour = continent). Child deaths fall steeply with income up to ` +
      `≈ <b>$${d3.format(",.0f")(threshold.value)}</b>, then barely move. Hover the grey curve to read the typical level ` +
      `at any income — dots above it do worse than expected, below do better.`);
  }

  function applyHighlight(country) {
    g.select(".dots").selectAll("circle")
      .classed("dimmed", d => country && d.country !== country)
      .classed("selected-stroke", d => country && d.country === country)
      .attr("r", d => (country && d.country === country) ? rPop(d.population) + 3 : rPop(d.population))
      .filter(d => country && d.country === country).raise();
  }

  /* right-hand side column (expanded only): the insights + a legend that explains the blue
     band, the grey curve, colour and size. */
  function buildSide() {
    side.html("");
    const thr = "$" + d3.format(",.0f")(threshold.value);
    side.append("div").html(
      `<h4>Does money buy survival?</h4>
       <p>Each dot is a country: <b>right = richer</b> (GDP per person, log scale), <b>up = more children die</b>
          (per 1,000 births), <b>bigger = more people</b>, colour = region.</p>
       <p><b>The insight:</b> child deaths fall <b>steeply</b> as countries rise out of poverty, then <b>flatten</b>.
          Beyond about <b>${thr} per person</b> extra wealth barely lowers child mortality. So the biggest life-saving
          gains come from lifting the <b>poorest</b> countries a little — not from making rich countries richer.</p>
       <p><b>The blue band</b> is that <b>tipping-point zone</b> (roughly $1.5k–$8k income): the range where mortality
          stops falling fast. <b>Left</b> of it, small income gains save many lives; <b>right</b> of it, they barely
          move the needle.</p>
       <p><b>The grey curve</b> is the <b>typical (median) level</b> at each income — hover it to read a value. Dots
          <b>above</b> it do <b>worse</b> than expected for their income; dots <b>below</b> do <b>better</b>.</p>
       <p class="explain-foot">Association, not proof: income buys the means to survive — clean water, nutrition,
          vaccines, clinics — up to a point.</p>`);

    const leg = side.append("div").attr("class", "v1-side-legend");
    leg.append("div").attr("class", "v1-side-legend-title").text("How to read the marks");
    S.s.meta.regions.forEach(rg => {
      const row = leg.append("div").attr("class", "v1-legend-item");
      row.append("span").attr("class", "v1-legend-swatch").style("background", App.scales.region(rg));
      row.append("span").text(shortRegion[rg] || rg);
    });
    const sizeRow = leg.append("div").attr("class", "v1-legend-item");
    sizeRow.append("span").attr("class", "v1-legend-swatch")
      .style("width", "16px").style("height", "16px").style("background", "#b6d9f2");
    sizeRow.append("span").text("Bigger point = more people");
    const bandRow = leg.append("div").attr("class", "v1-legend-item");
    bandRow.append("span").attr("class", "swatch-band");
    bandRow.append("span").text("Blue band = tipping-point income zone");
    const curveRow = leg.append("div").attr("class", "v1-legend-item");
    curveRow.append("span").attr("class", "v1-legend-swatch")
      .style("width", "16px").style("height", "0").style("border-top", "2px solid #999").style("border-radius", "0");
    curveRow.append("span").text("Grey curve = typical (median) level");
  }

  return { init, setWide, threshold: () => threshold.value };
})();
