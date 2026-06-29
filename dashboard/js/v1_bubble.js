/* V1 — Animated bubble chart (Gapminder-style).  Owner: Student A.  Answers Q1 & Q2.
 * x = GDP per capita (log), y = life expectancy, r = population (sqrt area), hue = region.
 * The play/pause/scrub clock advances the YEAR; bubbles are keyed by country and TWEEN
 * between years (d3 transitions interpolate cx/cy/r) rather than redrawing — this is the
 * mandatory interactive animation, and follows Tversky's congruence principle. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v1 = (function () {
  const W = 720, H = 470, M = { top: 16, right: 22, bottom: 48, left: 60 };
  const iW = W - M.left - M.right, iH = H - M.top - M.bottom;
  const S = App.state;
  let svg, g, x, y, r, yearText;

  function init() {
    const root = d3.select("#v1");
    svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

    x = App.scales.gdpX([0, iW]);
    y = App.scales.lifeY([iH, 0]);
    r = App.scales.popR(38);

    // gridlines (muted — high data-ink)
    g.append("g").attr("class", "grid")
      .call(d3.axisLeft(y).tickSize(-iW).tickFormat("")).select(".domain").remove();

    // big year watermark behind the bubbles
    yearText = g.append("text").attr("class", "year-watermark")
      .attr("x", iW - 6).attr("y", iH - 8).attr("text-anchor", "end")
      .attr("font-size", 76).attr("font-weight", 700).attr("fill", "#f0f0f0");

    // axes — only a few decade ticks so the log labels never pile up (readable even when the
    // tile is shrunk to grid size). Each gridline is ×5 the previous.
    const xticks = [200, 1000, 5000, 20000, 100000]
      .filter(v => v >= x.domain()[0] && v <= x.domain()[1]);
    g.append("g").attr("class", "axis x-axis").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).tickValues(xticks).tickFormat(d => "$" + d3.format("~s")(d)));
    g.append("g").attr("class", "axis y-axis").call(d3.axisLeft(y).ticks(7));

    // axis titles
    g.append("text").attr("class", "axis-title").attr("x", iW).attr("y", iH + 40)
      .attr("text-anchor", "end").text("GDP per person (US$ — each gridline ×10) →");
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", 0).attr("y", -44).attr("text-anchor", "end").text("Life expectancy (years) →");

    g.append("g").attr("class", "bubbles");

    buildLegend();
    render(S.s.currentYear);

    S.on("year", "v1", render);
    S.on("filter", "v1", () => render(S.s.currentYear));
    S.on("select", "v1", applyHighlight);
  }

  function frameData(year) {
    return S.yearData(year)
      .filter(d => d.gdp_per_capita != null && d.life_expectancy != null && d.population != null)
      .sort((a, b) => b.population - a.population); // big bubbles drawn first (behind)
  }

  function render(year) {
    yearText.text(year);
    const data = frameData(year);
    const playing = d3.select("#play-btn").classed("playing");
    const dur = playing ? App.config.animStep * 0.95 : App.config.transition;

    const sel = g.select(".bubbles").selectAll("circle").data(data, d => d.country);

    sel.join(
      enter => enter.append("circle")
        .attr("cx", d => x(d.gdp_per_capita)).attr("cy", d => y(d.life_expectancy))
        .attr("r", 0)
        .attr("fill", d => App.scales.region(d.region))
        .attr("fill-opacity", 0.66).attr("stroke", "#fff").attr("stroke-width", 0.7)
        .style("cursor", "pointer")
        .on("mousemove", (e, d) => App.util.tooltip.show(App.util.countryTooltip(d, year), e))
        .on("mouseleave", App.util.tooltip.hide)
        .on("click", (e, d) => S.selectCountry(d.country))
        .call(en => en.transition().duration(dur).attr("r", d => r(d.population))),
      update => update.call(up => up.transition().duration(dur).ease(playing ? d3.easeLinear : d3.easeCubicOut)
        .attr("cx", d => x(d.gdp_per_capita)).attr("cy", d => y(d.life_expectancy))
        .attr("r", d => r(d.population))),
      exit => exit.call(ex => ex.transition().duration(dur).attr("r", 0).remove())
    );
    drawAnnotation(data);
    applyHighlight(S.s.selectedCountry);
    setInsight(data, year);
  }

  // call out the "rich & long-lived" corner where OECD nations cluster (Q1 story);
  // redrawn each frame so it follows the cluster as the years play.
  function drawAnnotation(data) {
    g.selectAll(".annotation").remove();
    const oecd = data.filter(d => d.bloc === "OECD");
    if (oecd.length < 3) return;
    const cx = d3.mean(oecd, d => x(d.gdp_per_capita)), cy = d3.mean(oecd, d => y(d.life_expectancy));
    App.util.annotate(g, {
      x: Math.max(4, Math.min(cx - 40, iW - 150)), y: 22, anchor: "start",
      text: ["Rich & long-lived", "— mostly OECD nations"], leaderTo: [cx, cy], color: "#5E4FA2"
    });
  }

  function applyHighlight(country) {
    const circles = g.select(".bubbles").selectAll("circle");
    if (!country) { circles.classed("dimmed", false).classed("selected-stroke", false); return; }
    circles.classed("dimmed", d => d.country !== country)
      .classed("selected-stroke", d => d.country === country)
      .filter(d => d.country === country).raise();
  }

  function setInsight(data, year) {
    const oecd = data.filter(d => d.bloc === "OECD"), opec = data.filter(d => d.bloc === "OPEC");
    const mean = arr => arr.length ? d3.mean(arr, d => d.life_expectancy) : null;
    const lo = mean(oecd), lp = mean(opec);
    let txt = `In ${year}, each bubble is a country (area = population). `;
    if (lo && lp) txt += `Mean life expectancy: OECD ${lo.toFixed(1)} yrs vs OPEC ${lp.toFixed(1)} yrs — a ${(lo - lp).toFixed(1)}-year gap. Press ▶ to watch it evolve.`;
    d3.select("#insight-v1").text(txt);
  }

  function buildLegend() {
    // region colour key lives once in the header (the chips) — here we only need the
    // chart-specific size key, so we don't repeat the 6 region names on every chart.
    App.util.sizeLegend(d3.select("#legend-v1"), "Population (bubble area)", r,
      [1e7, 1e8, 1e9], v => d3.format(".0s")(v).replace("G", "B"));
  }

  return { init };
})();
