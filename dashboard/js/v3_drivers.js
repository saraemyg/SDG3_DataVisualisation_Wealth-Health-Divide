/* V3 — "What drives health?"  Owner: Student B.  Answers Q2 (and the overall thesis).
 * For the selected year, how strongly does each factor move together with LIFE EXPECTANCY
 * across countries? Each bar = one factor's correlation: to the RIGHT = goes with longer
 * life, to the LEFT = goes with shorter life; bar length = strength. A plain, bars-beat-
 * slopegraphs replacement for the old slope chart that puts HEALTH drivers front and centre.
 * Honest framing: correlation is association, not proof of cause. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v3 = (function () {
  const W = 540, H = 400, M = { top: 30, right: 54, bottom: 26, left: 122 };
  const iW = W - M.left - M.right, iH = H - M.top - M.bottom;
  const S = App.state;
  const OUTCOME = { key: "life_expectancy", label: "a longer life" };
  let svg, g, x, y;

  function init() {
    svg = d3.select("#v3").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);
    x = d3.scaleLinear().domain([-1, 1]).range([0, iW]);
    y = d3.scaleBand().range([0, iH]).padding(0.34);
    buildLegend();
    render();
    S.on("year", "v3", render);
    S.on("filter", "v3", render);
  }

  function pearson(pairs) {
    const n = pairs.length;
    if (n < 3) return null;
    const mx = d3.mean(pairs, p => p[0]), my = d3.mean(pairs, p => p[1]);
    let sxy = 0, sxx = 0, syy = 0;
    pairs.forEach(p => { const dx = p[0] - mx, dy = p[1] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; });
    return (sxx === 0 || syy === 0) ? null : sxy / Math.sqrt(sxx * syy);
  }

  function corrData(year) {
    const recs = S.yearData(year).filter(d => d[OUTCOME.key] != null);
    return App.config.drivers.map(f => {
      const pairs = recs.filter(d => d[f.key] != null).map(d => [d[f.key], d[OUTCOME.key]]);
      const r = pairs.length >= 25 ? pearson(pairs) : null;
      return { key: f.key, label: f.label, r, n: pairs.length };
    }).filter(d => d.r != null).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
  }

  function render() {
    const year = S.s.currentYear;
    const data = corrData(year);
    y.domain(data.map(d => d.label));
    const x0 = x(0);

    g.selectAll("*").remove();
    if (!data.length) {
      g.append("text").attr("x", iW / 2).attr("y", iH / 2).attr("text-anchor", "middle")
        .attr("fill", "#999").attr("font-size", 12).text(`Not enough data for ${year} under these filters`);
      d3.select("#insight-v3").text("");
      return;
    }

    // header arrows
    g.append("text").attr("x", iW).attr("y", -16).attr("text-anchor", "end")
      .attr("font-size", 11).attr("font-weight", 700).attr("fill", App.config.goodColor).text("goes with LONGER life →");
    g.append("text").attr("x", 0).attr("y", -16).attr("text-anchor", "start")
      .attr("font-size", 11).attr("font-weight", 700).attr("fill", App.config.badColor).text("← SHORTER life");

    // zero axis + faint vertical ticks at ±0.5/±1
    [-1, -0.5, 0.5, 1].forEach(t => g.append("line").attr("x1", x(t)).attr("x2", x(t)).attr("y1", 0).attr("y2", iH)
      .attr("stroke", "#eee"));
    g.append("line").attr("x1", x0).attr("x2", x0).attr("y1", 0).attr("y2", iH).attr("stroke", "#bbb");

    const rows = g.selectAll("g.bar").data(data, d => d.key).join("g").attr("class", "bar")
      .attr("transform", d => `translate(0,${y(d.label)})`)
      .style("cursor", "default")
      .on("mousemove", (e, d) => App.util.tooltip.show(tip(d, year), e))
      .on("mouseleave", App.util.tooltip.hide);

    rows.append("rect")
      .attr("x", d => d.r >= 0 ? x0 : x(d.r))
      .attr("width", d => Math.abs(x(d.r) - x0))
      .attr("y", 0).attr("height", y.bandwidth())
      .attr("rx", 2)
      .attr("fill", d => d.r >= 0 ? App.config.goodColor : App.config.badColor)
      .attr("opacity", 0.9);

    // factor label (left)
    rows.append("text").attr("x", -M.left + 6).attr("y", y.bandwidth() / 2).attr("dy", "0.32em")
      .attr("font-size", 11.5).attr("fill", "#333").text(d => d.label);

    // strength label at the bar end
    rows.append("text")
      .attr("x", d => d.r >= 0 ? x(d.r) + 5 : x(d.r) - 5)
      .attr("text-anchor", d => d.r >= 0 ? "start" : "end")
      .attr("y", y.bandwidth() / 2).attr("dy", "0.32em")
      .attr("font-size", 10.5).attr("font-weight", 600).attr("fill", "#555")
      .text(d => (d.r >= 0 ? "+" : "") + d.r.toFixed(2));

    setInsight(data, year);
  }

  function tip(d, year) {
    const dir = d.r >= 0 ? "longer" : "shorter";
    return `<div class="tt-title">${d.label}</div>
      <div class="tt-sub">${year} · ${d.n} countries</div>
      <table><tr><td>Correlation with life exp.</td><td>${(d.r >= 0 ? "+" : "") + d.r.toFixed(2)}</td></tr>
      <tr><td>Reading</td><td>more &rarr; ${dir} life</td></tr></table>
      <div class="tt-sub" style="white-space:normal;margin-top:4px">Association, not proof of cause.</div>`;
  }

  function setInsight(data, year) {
    const top = data[0];
    const dir = top.r >= 0 ? "longer" : "shorter";
    d3.select("#insight-v3").text(
      `In ${year}, “${top.label}” tracks life expectancy most strongly (${top.r >= 0 ? "+" : ""}${top.r.toFixed(2)}, ` +
      `more = ${dir} life). Bars show correlation — association, not proof of cause.`);
  }

  function buildLegend() {
    App.util.discreteLegend(d3.select("#legend-v3"), "Direction",
      [{ label: "goes with longer life", color: App.config.goodColor },
       { label: "goes with shorter life", color: App.config.badColor }], { horizontal: true });
  }

  return { init };
})();
