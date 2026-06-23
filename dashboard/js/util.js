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

  /* On-chart annotation: a halo'd text label (optionally with a leader line) placed directly
   * at the meaningful point — turns a pattern into a stated insight (best practice: annotate
   * the takeaway). `text` may be a string or array of lines; first line is bold. */
  function annotate(g, o) {
    const grp = g.append("g").attr("class", "annotation").attr("pointer-events", "none");
    if (o.leaderTo) {
      grp.append("line").attr("x1", o.x).attr("y1", o.y)
        .attr("x2", o.leaderTo[0]).attr("y2", o.leaderTo[1])
        .attr("stroke", o.color || "#555").attr("stroke-width", 1).attr("stroke-dasharray", "2 2");
      grp.append("circle").attr("cx", o.leaderTo[0]).attr("cy", o.leaderTo[1]).attr("r", 2.5)
        .attr("fill", o.color || "#555");
    }
    const lines = Array.isArray(o.text) ? o.text : [o.text];
    const t = grp.append("text").attr("x", o.x).attr("y", o.y)
      .attr("text-anchor", o.anchor || "start").attr("class", "anno-text").attr("fill", o.color || "#1a1a1a");
    lines.forEach((ln, i) => t.append("tspan").attr("x", o.x)
      .attr("dy", i === 0 ? (o.dy || 0) : "1.15em")
      .attr("font-weight", i === 0 ? 700 : 400).text(ln));
    return grp;
  }

  /* 1-D label de-overlap: given an array of preferred y values, return adjusted y values
   * (same order) so that no two are closer than `gap`. Used for V3's endpoint labels. */
  function dodge(positions, gap) {
    const order = positions.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < order.length; k++) {
      if (order[k].y - order[k - 1].y < gap) order[k].y = order[k - 1].y + gap;
    }
    const out = new Array(positions.length);
    order.forEach(o => { out[o.i] = o.y; });
    return out;
  }

  return { tooltip, countryTooltip, discreteLegend, gradientLegend, sizeLegend, annotate, dodge };
})();
