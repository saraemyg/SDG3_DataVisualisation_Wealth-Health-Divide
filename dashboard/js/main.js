/* main.js — application entry point.
 * Loads data -> builds shared scales -> wires the header controls to App.state ->
 * mounts all six charts. Each chart subscribes itself to the App.state events it needs,
 * so this file only has to *kick off* the initial render and own the animation clock. */
(function () {
  const S = App.state, cfg = App.config;

  function fail(msg) {
    d3.select("body").insert("div", ":first-child")
      .attr("class", "error-box")
      .html("<strong>Could not start the dashboard.</strong><br>" + msg +
        "<br><br>Make sure you are running a local server from the <em>project root</em> " +
        "and opening <code>/dashboard/</code> (see README). Opening index.html directly " +
        "with <code>file://</code> will not work because the browser blocks loading the JSON.");
  }

  App.data.load().then(function (bundle) {
    App.data.prepare(bundle.records, bundle.meta);
    App.scales.build(bundle.meta);
    App.world = bundle.topo;             // stash topojson for the choropleth

    buildHeader(bundle.meta);
    mountCharts();
    updateSelectionReadout(null);
    document.getElementById("footer-meta").textContent =
      `CDS6324 · TT2L · SDG 3 · D3.js v7 · ${bundle.meta.nRecords.toLocaleString()} records · ` +
      `${bundle.meta.nCountries} countries · ${bundle.meta.yearMin}–${bundle.meta.yearMax}`;
  }).catch(function (err) {
    console.error(err);
    fail(err && err.message ? err.message : String(err));
  });

  /* ----------------------------- header controls ----------------------------- */
  function buildHeader(meta) {
    // --- year slider + play/pause ---
    const slider = d3.select("#year-slider")
      .attr("min", meta.yearMin).attr("max", meta.yearMax).attr("step", 1)
      .attr("value", S.s.currentYear);
    const label = d3.select("#year-label").text(S.s.currentYear);

    slider.on("input", function () {
      stopAnim();
      S.setYear(+this.value);
    });
    // keep slider + label synced whenever the year changes from anywhere
    S.on("year", "header", function (y) { slider.property("value", y); label.text(y); });

    d3.select("#play-btn").on("click", toggleAnim);

    // --- bloc segmented toggle ---
    const blocs = ["All"].concat(meta.blocs);
    d3.select("#bloc-toggle").selectAll("button").data(blocs).join("button")
      .text(d => d)
      .classed("active", d => d === S.s.blocFilter)
      .on("click", function (e, d) {
        S.setBloc(d);
        d3.select("#bloc-toggle").selectAll("button").classed("active", b => b === d);
      });

    // --- region chips (multi-select filter) ---
    d3.select("#region-chips").selectAll(".chip").data(meta.regions).join("div")
      .attr("class", "chip")
      .each(function (r) {
        const c = d3.select(this);
        c.append("span").attr("class", "dot").style("background", App.scales.region(r));
        c.append("span").text(r);
      })
      .on("click", function (e, r) {
        S.toggleRegion(r);
        d3.select(this).classed("off", !S.s.activeRegions.has(r));
      });

    // selection readout reacts to linked selection
    S.on("select", "header", updateSelectionReadout);
  }

  function updateSelectionReadout(country) {
    const el = d3.select("#selection-readout");
    if (!country) { el.attr("class", "selection empty").text("none — click a country"); return; }
    el.attr("class", "selection").html("");
    el.append("span").text(country);
    el.append("span").attr("class", "clear").text("clear").on("click", () => S.clearSelection());
  }

  /* ----------------------------- charts ----------------------------- */
  function mountCharts() {
    ["v1", "v2", "v3", "v4", "v5", "v6"].forEach(function (id) {
      if (App.charts && App.charts[id] && typeof App.charts[id].init === "function") {
        try { App.charts[id].init(); }
        catch (e) { console.error("Failed to init " + id, e); }
      }
    });
  }

  /* ----------------------------- animation clock ----------------------------- */
  let timer = null;
  function toggleAnim() { timer ? stopAnim() : startAnim(); }
  function startAnim() {
    const meta = S.s.meta;
    if (S.s.currentYear >= meta.yearMax) S.setYear(meta.yearMin); // restart if at end
    d3.select("#play-btn").classed("playing", true).text("❚❚");
    timer = d3.interval(function () {
      const next = S.s.currentYear + 1;
      if (next > meta.yearMax) { stopAnim(); return; }
      S.setYear(next);
    }, cfg.animStep);
  }
  function stopAnim() {
    if (timer) { timer.stop(); timer = null; }
    d3.select("#play-btn").classed("playing", false).text("▶");
  }
})();
