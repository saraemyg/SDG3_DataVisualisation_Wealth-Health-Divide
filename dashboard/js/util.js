/* util.js — shared helpers: tooltip (Shneiderman "details on demand"),
 * legend builder, and small DOM utilities used by every chart. */
window.App = window.App || {};

App.util = (function () {
  /* ---- shared singleton tooltip ---- */
  let tip = null;
  function ensureTip() {
    if (!tip) tip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);
    return tip;
  }
  const tooltip = {
    show: function (html, event) {
      ensureTip().html(html).style("opacity", 1);
      tooltip.move(event);
    },
    move: function (event) {
      if (!tip) return;
      const pad = 14, w = tip.node().offsetWidth, h = tip.node().offsetHeight;
      let x = event.clientX + pad, y = event.clientY + pad;
      if (x + w > window.innerWidth) x = event.clientX - w - pad;
      if (y + h > window.innerHeight) y = event.clientY - h - pad;
      tip.style("left", x + "px").style("top", y + "px");
    },
    hide: function () { if (tip) tip.style("opacity", 0); }
  };

  /* Build a standard country tooltip body from a record + the current year. */
  function countryTooltip(d, year) {
    const f = App.fmt, L = App.config.labels;
    const rows = [
      ["Year", year],
      [L.gdp_per_capita, f.money(d.gdp_per_capita)],
      [L.life_expectancy, f.num1(d.life_expectancy)],
      [L.infant_mortality, f.num1(d.infant_mortality)],
      [L.population, f.pop(d.population)],
      [L.health_expenditure, d.health_expenditure == null ? "n/a" : f.num2(d.health_expenditure)],
      [L.under5_mortality, f.num1(d.under5_mortality)],
      [L.ncd_cardiovascular_pct, d.ncd_cardiovascular_pct == null ? "n/a" : f.pct(d.ncd_cardiovascular_pct)]
    ];
    let html = `<div class="tt-title"><span class="tt-dot" style="background:${App.scales.region(d.region)}"></span>${d.country}</div>`;
    html += `<div class="tt-sub">${d.region} &middot; ${d.bloc}</div><table>`;
    rows.forEach(r => { html += `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`; });
    return html + "</table>";
  }

  /* Generic discrete legend (swatch + label). orientation: 'v' | 'h'.
   * items: [{label, color}]. Returns nothing; appends <div> rows into `sel`. */
  function discreteLegend(sel, title, items, opts) {
    opts = opts || {};
    const box = sel.append("div").attr("class", "legend-block");
    if (title) box.append("div").attr("class", "legend-title").text(title);
    const list = box.append("div").attr("class", "legend-items " + (opts.horizontal ? "h" : "v"));
    const row = list.selectAll("div.legend-item").data(items).join("div")
      .attr("class", "legend-item");
    row.append("span").attr("class", "swatch")
      .style("background", d => d.color)
      .style("border-radius", opts.circle ? "50%" : "2px");
    row.append("span").attr("class", "legend-label").text(d => d.label);
    return box;
  }

  /* Continuous (sequential) legend rendered as an SVG gradient bar. */
  function gradientLegend(sel, title, interpolator, domain, fmt) {
    const w = 150, h = 10;
    const box = sel.append("div").attr("class", "legend-block");
    if (title) box.append("div").attr("class", "legend-title").text(title);
    const svg = box.append("svg").attr("width", w).attr("height", h + 18);
    const id = "grad-" + title.replace(/\W/g, "");
    const defs = svg.append("defs").append("linearGradient").attr("id", id);
    d3.range(0, 1.01, 0.1).forEach(t => {
      defs.append("stop").attr("offset", (t * 100) + "%").attr("stop-color", interpolator(t));
    });
    svg.append("rect").attr("width", w).attr("height", h).attr("fill", `url(#${id})`)
      .attr("stroke", "#ccc");
    const x = d3.scaleLinear().domain(domain).range([0, w]);
    const axis = d3.axisBottom(x).ticks(4).tickSize(3).tickFormat(fmt || d3.format("~s"));
    svg.append("g").attr("transform", `translate(0,${h})`).attr("class", "legend-axis").call(axis);
    return box;
  }

  /* size legend (bubble radii) for V1 */
  function sizeLegend(sel, title, rScale, values, fmt) {
    const box = sel.append("div").attr("class", "legend-block");
    if (title) box.append("div").attr("class", "legend-title").text(title);
    const maxR = rScale(d3.max(values)), w = maxR * 2 + 70, h = maxR * 2 + 6;
    const svg = box.append("svg").attr("width", w).attr("height", h);
    const g = svg.append("g").attr("transform", `translate(${maxR + 1},${h - 2})`);
    values.forEach(v => {
      const r = rScale(v);
      g.append("circle").attr("cy", -r).attr("r", r)
        .attr("fill", "none").attr("stroke", "#999");
      g.append("text").attr("x", maxR + 6).attr("y", -2 * r)
        .attr("dy", "0.35em").attr("class", "size-legend-label").text(fmt(v));
    });
    return box;
  }

  return { tooltip, countryTooltip, discreteLegend, gradientLegend, sizeLegend };
})();
