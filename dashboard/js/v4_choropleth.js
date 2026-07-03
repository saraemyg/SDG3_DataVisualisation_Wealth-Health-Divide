/* V4 — "Where children still die youngest."  Owner: Student B.  Answers Q2 & Q3.
 * A choropleth of child mortality PLUS a wealth–health gap panel that turns "country → deaths"
 * into the SDG-3 story: it compares the 10 lowest-mortality vs the 10 highest-mortality countries
 * (average child deaths AND average income for each), spells out the gap multipliers, flags how
 * many of the worst are in Sub-Saharan Africa, and ranks average child mortality by region so the
 * regional divide is unmissable. Hovering any group/region highlights those countries on the map.
 * Mouse-wheel zoom + drag pan; click a country to link it across the dashboard. */
window.App = window.App || {};
App.charts = App.charts || {};
App.charts.v4 = (function () {
  const W = 540, H = 360;
  const S = App.state;
  const moneyS = d3.format("$.2~s");
  const shortRegion = {
    "Europe & Central Asia": "Europe", "Americas": "Americas", "East Asia & Pacific": "E Asia/Pac",
    "South Asia": "South Asia", "Middle East & North Africa": "MENA", "Sub-Saharan Africa": "Sub-Sah. Africa"
  };
  let svg, gMap, path, features, byIso, currentYear, panel, scaleLegend, panelMode = "full";

  function init() {
    const root = d3.select("#v4");
    svg = root.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
      .style("background", "#f7fbff");

    const fc = topojson.feature(App.world, App.world.objects.countries);
    features = fc.features.filter(f => f.id !== "010"); // drop Antarctica
    const proj = d3.geoNaturalEarth1().fitSize([W, H], { type: "FeatureCollection", features });
    path = d3.geoPath(proj);

    gMap = svg.append("g");
    gMap.selectAll("path").data(features).join("path")
      .attr("d", path).attr("stroke", "#fff").attr("stroke-width", 0.4)
      .style("cursor", "pointer")
      .on("mousemove", onHover).on("mouseleave", App.util.tooltip.hide).on("click", onClick);

    svg.call(d3.zoom().scaleExtent([1, 9]).translateExtent([[0, 0], [W, H]])
      .on("zoom", e => gMap.attr("transform", e.transform)));

    panel = root.append("div").attr("class", "v4-panel").attr("id", "v4-panel");
    scaleLegend = root.append("div").attr("class", "v4-scale-legend");

    buildLegend();
    buildScaleLegend();
    buildExplain(root);
    render(S.s.currentYear);
    S.on("year", "v4", render);
    S.on("filter", "v4", () => render(currentYear));
    S.on("select", "v4", applyHighlight);
  }

  function render(year) {
    currentYear = year;
    const recs = S.yearData(year).filter(d => d.infant_mortality != null);
    byIso = new Map(recs.map(d => [d.iso_numeric, d]));
    gMap.selectAll("path").transition().duration(App.config.transition * 0.6)
      .attr("fill", f => { const d = byIso.get(f.id); return d ? App.scales.infantColor(d.infant_mortality) : "#e9e9e9"; });
    // only data-bearing countries are interactive (pointer cursor); grey ones stay inert
    gMap.selectAll("path").style("cursor", f => byIso.get(f.id) ? "pointer" : "default");
    applyHighlight(S.s.selectedCountry);
    buildGapPanel(recs, year);
  }

  /* ---------------- the wealth–health gap panel ---------------- */
  function buildGapPanel(recs, year) {
    if (recs.length < 12) { panel.html(""); d3.select("#insight-v4").text(""); return; }
    const avg = (arr, k) => { const v = arr.filter(d => d[k] != null); return v.length ? d3.mean(v, d => d[k]) : null; };
    const byMort = recs.slice().sort((a, b) => a.infant_mortality - b.infant_mortality);
    const best = byMort.slice(0, 15), worst = byMort.slice(-15);
    const bestM = avg(best, "infant_mortality"), worstM = avg(worst, "infant_mortality");
    const bestG = avg(best, "gdp_per_capita"), worstG = avg(worst, "gdp_per_capita");
    const ssa = worst.filter(d => d.region === "Sub-Saharan Africa").length;
    const mortX = (worstM && bestM) ? worstM / bestM : null;
    const gdpX = (bestG && worstG) ? bestG / worstG : null;

    // avg child mortality by region (ranked) — makes the regional divide visible
    const regAvg = S.s.meta.regions.map(rg => ({ region: rg, m: avg(recs.filter(d => d.region === rg), "infant_mortality") }))
      .filter(d => d.m != null).sort((a, b) => b.m - a.m);
    const maxM = d3.max(regAvg, d => d.m);
    const regHtml = regAvg.map(d => `
      <div class="region-bar" data-region="${d.region}">
        <span class="rb-label">${shortRegion[d.region] || d.region}</span>
        <span class="rb-track"><span class="rb-fill" style="width:${(100 * d.m / maxM).toFixed(0)}%;background:${App.scales.region(d.region)}"></span></span>
        <span class="rb-val">${d.m.toFixed(0)}</span>
      </div>`).join("");

    const bodyHtml = `
      <div class="gap-grid">
        <div class="gap-col best" data-grp="best">
          <div class="gap-lab">✅ 15 safest</div>
          <div class="gap-val">${bestM.toFixed(0)}<span> /1k</span></div>
          <div class="gap-gdp">${bestG ? moneyS(bestG) : "n/a"}/person</div>
        </div>
        <div class="gap-col worst" data-grp="worst">
          <div class="gap-lab">⚠ 15 deadliest</div>
          <div class="gap-val">${worstM.toFixed(0)}<span> /1k</span></div>
          <div class="gap-gdp">${worstG ? moneyS(worstG) : "n/a"}/person</div>
        </div>
      </div>
      <div class="gap-summary">${mortX ? `<b>${mortX.toFixed(0)}×</b> the child deaths` : ""}${gdpX ? ` · <b>${gdpX.toFixed(0)}×</b> less income` : ""}<br>
        <b>${ssa}/15</b> deadliest are in Sub-Saharan Africa</div>
      <div class="region-bars"><div class="rb-head">Avg child mortality by region</div>${regHtml}</div>`;

    if (panelMode === "hidden") {
      panel.classed("hidden", true).classed("compact", false)
        .html(`<button type="button" class="panel-peek" aria-label="Show child mortality info">Child mortality gap · ${year}</button>`);
      panel.select(".panel-peek").on("click", () => { panelMode = "compact"; buildGapPanel(recs, year); });
    } else if (panelMode === "compact") {
      panel.classed("hidden", false).classed("compact", true)
        .html(`
          <div class="panel-head">
            <div class="gap-title">Child mortality gap · ${year}</div>
            <div class="panel-actions">
              <button type="button" class="panel-btn" data-action="expand" aria-label="Expand child mortality info">▢</button>
              <button type="button" class="panel-btn" data-action="close" aria-label="Close child mortality info">×</button>
            </div>
          </div>
          ${bodyHtml}`);
    } else {
      panel.classed("hidden", false).classed("compact", false)
        .html(`
          <div class="panel-head">
            <div class="gap-title">Child mortality gap · ${year}</div>
            <div class="panel-actions">
              <button type="button" class="panel-btn" data-action="collapse" aria-label="Collapse child mortality info">–</button>
              <button type="button" class="panel-btn" data-action="close" aria-label="Close child mortality info">×</button>
            </div>
          </div>
          ${bodyHtml}`);
    }

    panel.selectAll(".panel-btn").on("click", function () {
      const action = this.dataset.action;
      if (action === "close") panelMode = "hidden";
      if (action === "collapse") panelMode = "compact";
      if (action === "expand") panelMode = "full";
      buildGapPanel(recs, year);
    });

    // group sets for map highlighting
    const isoOf = arr => new Set(arr.map(d => d.iso_numeric));
    const bestSet = isoOf(best), worstSet = isoOf(worst);
    panel.select(".gap-col.best").on("mouseenter", () => highlightSet(bestSet)).on("mouseleave", clearSet)
      .on("click", () => spotlightOne(best));
    panel.select(".gap-col.worst").on("mouseenter", () => highlightSet(worstSet)).on("mouseleave", clearSet)
      .on("click", () => spotlightOne(worst));
    panel.selectAll(".region-bar").on("mouseenter", function () {
      const rg = this.dataset.region;
      highlightSet(isoOf(recs.filter(d => d.region === rg)));
    }).on("mouseleave", clearSet);

    d3.select("#insight-v4").html(
      `The <b>15 deadliest</b> countries have about <b>${mortX ? mortX.toFixed(0) : "?"}×</b> as many child deaths as the ` +
      `<b>15 safest</b>, and their average income is about <b>${gdpX ? gdpX.toFixed(0) : "?"}× lower</b>. ` +
      `${ssa} of those 15 are in Sub-Saharan Africa. Hover the panel to find them on the map.`);
  }

  function highlightSet(isoSet) {
    gMap.selectAll("path").classed("hl", f => isoSet.has(f.id)).classed("map-dim", f => !isoSet.has(f.id));
    gMap.selectAll("path").filter(f => isoSet.has(f.id)).raise();
  }
  function clearSet() {
    gMap.selectAll("path").classed("hl", false).classed("map-dim", false);
    applyHighlight(S.s.selectedCountry);
  }
  function spotlightOne(group) { if (group && group.length) S.selectCountry(group[group.length - 1].country); }

  function onHover(e, f) {
    const d = byIso.get(f.id);
    // countries/territories with no data for this year stay silent (no "no data" tooltip)
    if (d) App.util.tooltip.show(App.util.countryTooltip(d, currentYear), e);
    else App.util.tooltip.hide();
  }
  function onClick(e, f) { const d = byIso.get(f.id); if (d) S.selectCountry(d.country); }

  function applyHighlight(country) {
    gMap.selectAll("path")
      .attr("stroke", f => (country && byIso.get(f.id) && byIso.get(f.id).country === country) ? "#111" : "#fff")
      .attr("stroke-width", f => (country && byIso.get(f.id) && byIso.get(f.id).country === country) ? 1.8 : 0.4)
      .filter(f => country && byIso.get(f.id) && byIso.get(f.id).country === country).raise();
  }

  /* right-side explainer (revealed only when the tile is expanded) — the "why" behind the map */
  function buildExplain(root) {
    root.append("div").attr("class", "explain-panel").html(
      `<h4>Why children die youngest here</h4>
       <p>Child mortality clusters in the <b>poorest countries</b>, above all in <b>Sub-Saharan Africa</b> and
          <b>South Asia</b> — the same places the wealth–health charts flag as low-income.</p>
       <p>The deaths are mostly <b>preventable</b>: pneumonia, diarrhoea, malaria and newborn complications,
          made worse by <b>malnutrition</b>. What's missing is <b>money and health systems</b> — vaccines,
          skilled birth attendants, clean water and sanitation, and nearby clinics.</p>
       <p class="explain-foot">This is why the map's dark band and the "×less income" gap line up: at low
          incomes, small gains in wealth and health spending save many young lives.</p>`);
  }

  function buildLegend() {
    const sel = d3.select("#legend-v4");
    sel.html("");
    const box = App.util.gradientLegend(sel, "Darker = more child deaths",
      App.scales.seqInterpolator, [0, App.scales.infantMax], d3.format("~s"));
    
    const noDataRow = box.append("div")
      .attr("class", "v4-header-no-data")
      .style("display", "flex")
      .style("align-items", "center")
      .style("gap", "6px")
      .style("margin-top", "4px")
      .style("font-size", "10.5px")
      .style("color", "var(--ink)");
    noDataRow.append("span")
      .style("display", "inline-block")
      .style("width", "11px")
      .style("height", "11px")
      .style("background", "#e9e9e9")
      .style("border", "1px solid #ccc")
      .style("border-radius", "2px");
    noDataRow.append("span").text("Unknown data");

    box.append("div").attr("class", "legend-note").text("The panel compares the safest and deadliest countries in the selected year.");
  }

  function buildScaleLegend() {
    scaleLegend.html("");
    const box = scaleLegend.append("div").attr("class", "v4-scale-legend-box");
    
    const header = box.append("div").attr("class", "v4-scale-legend-header")
      .style("display", "flex")
      .style("justify-content", "space-between")
      .style("align-items", "center")
      .style("cursor", "pointer")
      .style("user-select", "none");
      
    header.append("div").attr("class", "v4-scale-title").text("Child mortality per 1,000 births");
    const toggle = header.append("span").attr("class", "v4-scale-legend-toggle").text("−");

    const svgLegend = box.append("svg").attr("width", 220).attr("height", 44);
    const defs = svgLegend.append("defs");
    const grad = defs.append("linearGradient").attr("id", "v4-scale-grad").attr("x1", "0%")
      .attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
    d3.range(0, 1.01, 0.1).forEach(t => {
      grad.append("stop").attr("offset", `${t * 100}%`).attr("stop-color", App.scales.seqInterpolator(t));
    });
    svgLegend.append("rect").attr("x", 16).attr("y", 10).attr("width", 188).attr("height", 12)
      .attr("rx", 2).attr("fill", "url(#v4-scale-grad)")
      .attr("stroke", "#222").attr("stroke-width", 0.5);
    const axis = d3.scaleLinear().domain([0, App.scales.infantMax]).range([16, 204]);
    svgLegend.append("g").attr("transform", "translate(0,22)")
      .call(d3.axisBottom(axis).ticks(5).tickSize(4).tickFormat(d3.format("d")))
      .selectAll("text").attr("font-size", 9);
    svgLegend.selectAll("path").attr("stroke", "#444");
    svgLegend.selectAll("line").attr("stroke", "#444");

    const noDataRow = box.append("div")
      .attr("class", "v4-scale-no-data")
      .style("display", "flex")
      .style("align-items", "center")
      .style("justify-content", "center")
      .style("gap", "6px")
      .style("margin-top", "2px")
      .style("font-size", "10px")
      .style("color", "#555");
    noDataRow.append("span")
      .style("display", "inline-block")
      .style("width", "11px")
      .style("height", "11px")
      .style("background", "#e9e9e9")
      .style("border", "1px solid #ccc")
      .style("border-radius", "2px");
    noDataRow.append("span").text("Unknown data");

    header.on("click", () => {
      const collapsed = box.classed("collapsed");
      box.classed("collapsed", !collapsed);
      toggle.text(collapsed ? "−" : "+");
    });
  }

  return { init };
})();
