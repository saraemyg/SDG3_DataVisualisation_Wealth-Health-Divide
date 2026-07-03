/* V2 — "Is the health gap closing?"  Owner: Student A.  Answers Q1.
 * Median health outcome over time for each economic bloc (OECD vs OPEC vs Other), so you can
 * see at a glance whether the rich-vs-poor health gap narrows or persists across 1960–2011.
 * A simple, beginner-friendly line chart that replaces the hard-to-read sunburst.
 *   - outcome toggle: life expectancy (longer = better) <-> child mortality (lower = better)
 *   - vertical guide tracks the global year cursor (and the animation)
 *   - selecting a country overlays its own line (linked highlight) */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v2 = (function () {
  const H = 400, NARROW = 540, M = { top: 26, right: 104, bottom: 40, left: 46 };
  const S = App.state;
  const OUTCOMES = {
    life: { key: "life_expectancy", label: "Life expectancy", unit: "yrs", betterUp: true },
    child: { key: "infant_mortality", label: "Child mortality", unit: "per 1,000", betterUp: false }
  };
  // possible world-event context behind the dips, keyed by the chosen measure (soft-pink dashed
  // markers). Honest framing: these are plausible correlates for the visible dips, not proven causes.
  const WIKI = "https://en.wikipedia.org/wiki/";
  const IMG = "https://upload.wikimedia.org/wikipedia/commons/thumb/";
  const EVENTS = {
    life: [
      { year: 1991, cause: "USSR collapse", full: "Dissolution of the Soviet Union — life expectancy fell sharply across ex-Soviet (“Other”) states through the 1990s.",
        wiki: WIKI + "Dissolution_of_the_Soviet_Union", img: IMG + "5/50/Map_of_USSR_with_SSR_names.svg/330px-Map_of_USSR_with_SSR_names.svg.png" },
      { year: 1999, cause: "HIV/AIDS peak", full: "Peak of the HIV/AIDS crisis — life expectancy collapsed across much of sub-Saharan Africa (mostly the “Other” bloc).",
        wiki: WIKI + "HIV/AIDS_in_Africa", img: IMG + "7/76/Schermafbeelding_2023-01-10_om_10.42.41.png/330px-Schermafbeelding_2023-01-10_om_10.42.41.png" },
      { year: 2003, cause: "Iraq War", full: "2003 invasion of Iraq — a dip in life expectancy across OPEC / MENA states.",
        wiki: WIKI + "2003_invasion_of_Iraq", img: IMG + "7/74/U.S._Marines_with_Iraqi_POWs_-_March_21%2C_2003.jpg/330px-U.S._Marines_with_Iraqi_POWs_-_March_21%2C_2003.jpg" },
      { year: 2011, cause: "Arab Spring", full: "Arab Spring — uprisings and conflict in Libya, Syria and Yemen (OPEC / MENA).",
        wiki: WIKI + "Arab_Spring", img: IMG + "9/9e/Tunisian_Revolution_Protest.jpg/330px-Tunisian_Revolution_Protest.jpg" }
    ],
    child: [
      { year: 1961, cause: "China famine", full: "China's Great Famine (1959–61) — a spike in child deaths in the world's most populous country.",
        wiki: WIKI + "Great_Chinese_Famine", img: null },
      { year: 1970, cause: "Bhola cyclone", full: "1970 Bhola cyclone and the Bangladesh crisis — one of history's deadliest disasters, lifting child mortality across South Asia.",
        wiki: WIKI + "1970_Bhola_cyclone", img: IMG + "0/01/15B_1970-11-12_0956Z.png/330px-15B_1970-11-12_0956Z.png" },
      { year: 1978, cause: "Cambodia", full: "Cambodian genocide (Khmer Rouge, 1975–79) — mass death, including many children, in East Asia.",
        wiki: WIKI + "Cambodian_genocide", img: IMG + "c/c9/Skulls_from_the_killing_fields.jpg/330px-Skulls_from_the_killing_fields.jpg" },
      { year: 1980, cause: "Afghan War", full: "Soviet–Afghan War (1979–89) — conflict drove up child mortality in Afghanistan and the region.",
        wiki: WIKI + "Soviet%E2%80%93Afghan_War", img: IMG + "6/6c/Mortar_attack_on_Shigal_Tarna_garrison%2C_Kunar_Province%2C_87.jpg/330px-Mortar_attack_on_Shigal_Tarna_garrison%2C_Kunar_Province%2C_87.jpg" }
    ]
  };
  const PINK = "#d98cae";
  let svg, g, x, y, mode = "life", guide, guideLabel, W = NARROW, iW, iH;

  function init() {
    const root = d3.select("#v2");
    buildControls();
    svg = root.append("svg");
    g = svg.append("g");
    buildExplain(root);
    buildLegend();
    render();
    S.on("year", "v2", moveGuide);
    S.on("filter", "v2", render);
    S.on("select", "v2", render);
  }

  /* widen the timeline when the chart is expanded so the 50-year history isn't cramped */
  function setWide(on) {
    if (on) {
      const el = document.getElementById("v2");
      const cw = el.clientWidth, ch = el.clientHeight;
      const aspect = (cw > 60 && ch > 60) ? Math.min(2.8, Math.max(1.6, cw / ch)) : 2.1;
      W = Math.round(H * aspect);
    } else { W = NARROW; }
    render();
  }

  function passRegion(d) { return !S.s.activeRegions || S.s.activeRegions.has(d.region); }

  function series(outKey) {
    const data = S.s.data.filter(d => d[outKey] != null && passRegion(d));
    const roll = d3.rollup(data, v => d3.median(v, d => d[outKey]), d => d.bloc, d => d.year);
    return S.s.meta.blocs.map(b => {
      const ym = roll.get(b) || new Map();
      return { bloc: b, pts: Array.from(ym, ([year, val]) => ({ year, val })).sort((a, b) => a.year - b.year) };
    });
  }

  function render() {
    // when expanded, reserve a right gutter for the explainer panel so it never covers the lines
    const mRight = (W > NARROW) ? 252 : M.right;
    iW = W - M.left - mRight; iH = H - M.top - M.bottom;
    svg.attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    g.attr("transform", `translate(${M.left},${M.top})`);
    x = d3.scaleLinear().domain([S.s.meta.yearMin, S.s.meta.yearMax]).range([0, iW]);
    y = d3.scaleLinear().range([iH, 0]);

    const out = OUTCOMES[mode];
    const data = series(out.key);
    const allVals = data.flatMap(s => s.pts.map(p => p.val));
    y.domain([Math.min(0, d3.min(allVals)), d3.max(allVals)]).nice();
    if (out.betterUp) y.domain([d3.min(allVals) - 2, d3.max(allVals) + 1]).nice();

    g.selectAll("*").remove();

    // gridlines + axes
    g.append("g").attr("class", "grid").call(d3.axisLeft(y).tickSize(-iW).tickFormat("")).select(".domain").remove();
    g.append("g").attr("class", "axis").attr("transform", `translate(0,${iH})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));
    g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));
    g.append("text").attr("class", "axis-title").attr("transform", "rotate(-90)")
      .attr("x", 0).attr("y", -36).attr("text-anchor", "end").text(`${out.label} (${out.unit}) →`);
    g.append("text").attr("class", "axis-title").attr("x", iW / 2).attr("y", iH + 32)
      .attr("text-anchor", "middle").text("Year →");

    const line = d3.line().defined(d => d.val != null).x(d => x(d.year)).y(d => y(d.val));

    // one bold line per bloc; emphasise the bloc chosen in the header toggle
    const sel = S.s.blocFilter;
    data.forEach(s => {
      const emph = (sel === "All" || sel === s.bloc);
      g.append("path").datum(s.pts).attr("fill", "none")
        .attr("stroke", App.config.blocColors[s.bloc])
        .attr("stroke-width", emph ? 3 : 1.5).attr("opacity", emph ? 1 : 0.35)
        .attr("d", line);
      // right-edge bloc label at its last point
      const last = s.pts[s.pts.length - 1];
      if (last) g.append("text").attr("x", x(last.year) + 6).attr("y", y(last.val)).attr("dy", "0.32em")
        .attr("font-size", 11).attr("font-weight", 600).attr("fill", App.config.blocColors[s.bloc])
        .attr("opacity", emph ? 1 : 0.5).text(s.bloc);
    });



    // selected-country overlay (linked highlight)
    if (S.s.selectedCountry) {
      const recs = (S.s.byCountry.get(S.s.selectedCountry) || []).filter(d => d[out.key] != null);
      if (recs.length) {
        g.append("path").datum(recs.map(d => ({ year: d.year, val: d[out.key] })))
          .attr("fill", "none").attr("stroke", "#111").attr("stroke-width", 1.8).attr("stroke-dasharray", "4 2")
          .attr("d", line);
        const lp = recs[recs.length - 1];
        g.append("text").attr("x", x(lp.year) + 6).attr("y", y(lp[out.key]) - 6)
          .attr("font-size", 10).attr("font-weight", 700).attr("fill", "#111").text(S.s.selectedCountry);
      }
    }

    // soft current-year guide (no "2011" label — the current year already shows in the header)
    guide = g.append("line").attr("class", "year-guide").attr("y1", 0).attr("y2", iH)
      .attr("stroke", PINK).attr("stroke-width", 1.4).attr("stroke-dasharray", "3 3").attr("opacity", 0.55);
    g.append("rect").attr("width", iW).attr("height", iH).attr("fill", "none").attr("pointer-events", "all")
      .style("cursor", "crosshair")
      .on("mousemove", (e) => hover(e, data, out))
      .on("mouseleave", () => { App.util.tooltip.hide(); moveGuide(S.s.currentYear); });
    drawEvents();   // soft-pink event-context markers for the chosen measure
    moveGuide(S.s.currentYear);
    setInsight(data, out);
    updateExplain(out);   // right-side explainer follows the chosen measure
  }

  /* soft-pink dashed markers at world events that may sit behind the dips, for the chosen
   * measure (life expectancy vs child mortality). Hover for the story. */
  function drawEvents() {
    (EVENTS[mode] || []).forEach(ev => {
      if (ev.year < S.s.meta.yearMin || ev.year > S.s.meta.yearMax) return;
      const xx = x(ev.year);
      const grp = g.append("g").attr("class", "event-marker").style("cursor", "pointer");
      grp.append("line").attr("x1", xx).attr("x2", xx).attr("y1", 0).attr("y2", iH)
        .attr("stroke", PINK).attr("stroke-width", 1.4).attr("stroke-dasharray", "2 3").attr("opacity", 0.9);
      grp.append("text").attr("x", xx).attr("y", -2).attr("text-anchor", "middle")
        .attr("font-size", 9.5).attr("font-weight", 700).attr("fill", "#c76b95").text(`'${String(ev.year).slice(2)}`);
      grp.append("rect").attr("x", xx - 7).attr("y", 0).attr("width", 14).attr("height", iH).attr("fill", "transparent")
        .on("mousemove", e => App.util.tooltip.show(App.util.eventTooltip(ev), e))
        .on("mouseleave", App.util.tooltip.hide)
        .on("click", () => window.open(ev.wiki, "_blank", "noopener"));
    });
  }

  /* right-side explainer, revealed only when expanded (CSS hides it in the grid) */
  function buildExplain(root) {
    root.append("div").attr("class", "explain-panel");   // filled by updateExplain() per measure
  }

  /* right-side explainer that CHANGES with the chosen measure (life expectancy vs child mortality) */
  function updateExplain(out) {
    const li = e => `<li><b>'${String(e.year).slice(2)}</b> — ${e.cause}</li>`;
    d3.select("#v2 .explain-panel").html(
      `<h4>${out.label}: is the gap closing?</h4>
       <p>Each line is the <b>median</b> country in a <b>wealth group</b> — OECD (high-income), OPEC (oil
          exporters) and Other. Lines drifting <b>together</b> mean the rich–poor gap in
          ${out.label.toLowerCase()} is closing; staying apart means it persists.</p>
       <p><b>Soft-pink markers</b> flag world events that may sit behind the dips in
          <b>${out.label.toLowerCase()}</b> — hover for a photo, or click to open Wikipedia:</p>
       <ul class="explain-events">${EVENTS[mode].map(li).join("")}</ul>
       <p class="explain-foot">Association, not proof of cause. Switch the measure to see different events.</p>`);
  }



  function hover(e, data, out) {
    const yr = Math.round(x.invert(d3.pointer(e)[0]));
    moveGuide(yr);
    let rows = "";
    data.forEach(s => {
      const p = s.pts.find(pp => pp.year === yr);
      rows += `<tr><td><span class="tt-dot" style="background:${App.config.blocColors[s.bloc]}"></span>${s.bloc}</td>` +
        `<td>${p ? p.val.toFixed(1) + " " + out.unit : "n/a"}</td></tr>`;
    });
    App.util.tooltip.show(`<div class="tt-title">${out.label} · ${yr}</div><table>${rows}</table>`, e);
  }

  function moveGuide(yr) {
    if (!guide) return;
    guide.attr("x1", x(yr)).attr("x2", x(yr));
  }

  function setInsight(data, out) {
    const oecd = data.find(s => s.bloc === "OECD"), opec = data.find(s => s.bloc === "OPEC");
    if (!oecd || !opec || oecd.pts.length < 2) { d3.select("#insight-v2").text(""); return; }
    const gapAt = (yr) => {
      const a = oecd.pts.find(p => p.year === yr), b = opec.pts.find(p => p.year === yr);
      return (a && b) ? Math.abs(a.val - b.val) : null;
    };
    const g0 = gapAt(oecd.pts[0].year), g1 = gapAt(oecd.pts[oecd.pts.length - 1].year);
    let txt = `Each line is a bloc's median ${out.label.toLowerCase()}. `;
    if (g0 != null && g1 != null)
      txt += g1 < g0 ? `The OECD–OPEC gap narrowed from ${g0.toFixed(0)} to ${g1.toFixed(0)} ${out.unit}.`
        : `The OECD–OPEC gap stayed wide (${g0.toFixed(0)} → ${g1.toFixed(0)} ${out.unit}).`;
    d3.select("#insight-v2").text(txt);
  }

  function buildControls() {
    const wrap = d3.select("#v2-controls");
    wrap.append("span").attr("class", "v2-label").text("Measure:");
    const seg = wrap.append("div").attr("class", "seg-mini");
    [["life", "Life expectancy"], ["child", "Child mortality"]].forEach(([m, lab]) => {
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
    const sel = d3.select("#legend-v2");
    sel.html("");
    // frame the blocs as WEALTH groups so the chart reads as a rich-vs-poor health gap
    const blocLabel = { "OECD": "OECD — high-income", "OPEC": "OPEC — oil exporters", "Other": "Other countries" };
    const box = App.util.discreteLegend(sel, "Line colour = wealth group",
      S.s.meta.blocs.map(b => ({ label: blocLabel[b] || b, color: App.config.blocColors[b] })), { horizontal: true });
    box.append("div").attr("class", "legend-note")
      .text("Blocs are economic (wealth) groups — the chart shows whether the rich–poor health gap is closing.");
  }

  return { init, setWide };
})();
