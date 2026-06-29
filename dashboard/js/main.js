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
    setupFocus();
    updateSelectionReadout(null);
    buildStandfirst(bundle.meta);
    document.getElementById("footer-meta").textContent =
      `CDS6324 · TT2L · SDG 3 · D3.js v7 · ${bundle.meta.nRecords.toLocaleString()} records · ` +
      `${bundle.meta.nCountries} countries · ${bundle.meta.yearMin}–${bundle.meta.yearMax}`;
  }).catch(function (err) {
    console.error(err);
    fail(err && err.message ? err.message : String(err));
  });

  /* ----------------------------- standfirst (headline finding) ----------------------------- */
  function buildStandfirst(meta) {
    const atYr = (S.s.byYear.get(meta.yearMax) || []);
    const mean = b => {
      const a = atYr.filter(d => d.bloc === b && d.life_expectancy != null);
      return a.length ? d3.mean(a, d => d.life_expectancy) : null;
    };
    const oecd = mean("OECD"), opec = mean("OPEC");
    const thr = (App.charts.v5 && App.charts.v5.threshold) ? App.charts.v5.threshold() : null;
    let txt = `<b>The pattern:</b><span class="info-badge" id="pattern-info" tabindex="0">i</span> as countries grow richer, fewer of their children die — `;
    if (thr) txt += `but most of that gain happens below about <b>$${d3.format(",.0f")(thr)} per person</b>; ` +
      "beyond that, extra wealth barely moves the needle. ";
    if (oecd && opec) txt += `Even so, in ${meta.yearMax} people in wealthy <b>OECD</b> nations still lived about ` +
      `<b>${(oecd - opec).toFixed(0)} years longer</b> on average than in oil-exporting <b>OPEC</b> nations. `;
    txt += "Use the controls to see for yourself.";
    d3.select("#standfirst").html(txt);

    // cute info icon explains where these numbers come from (honest framing)
    const infoHtml = `<div class="tt-title">How this is worked out</div>` +
      `<div class="tt-sub" style="white-space:normal">These figures are computed straight from the data below: ` +
      `the GDP-per-person level where infant mortality stops falling steeply, and the OECD−OPEC life-expectancy ` +
      `gap in ${meta.yearMax}. It's an observed correlation — not proof that money alone makes people live longer.</div>`;
    d3.select("#pattern-info")
      .on("mouseenter", e => App.util.tooltip.show(infoHtml, e))
      .on("mousemove", e => App.util.tooltip.move(e))
      .on("mouseleave", App.util.tooltip.hide);
  }

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

    // --- country search (autocomplete via datalist) ---
    const names = Array.from(S.s.byCountry.keys()).sort(d3.ascending);
    d3.select("#country-list").selectAll("option").data(names).join("option").attr("value", d => d);
    const searchBox = d3.select("#country-search");
    const searchErr = d3.select("#country-search").node().parentNode
      ? d3.select("#country-search").node().insertAdjacentHTML("afterend",
          "<div id='search-error' class='search-error' aria-live='polite'></div>") || d3.select("#search-error")
      : null;

    function clearSearchError() {
      searchBox.classed("search-invalid", false);
      d3.select("#search-error").text("");
    }

    searchBox.on("input", clearSearchError);
    searchBox.on("change", function () {
      const v = this.value.trim();
      if (S.s.byCountry.has(v)) {
        clearSearchError();
        S.selectCountry(v);
      } else if (v === "") {
        clearSearchError();
        S.clearSelection();
      } else {
        searchBox.classed("search-invalid", true);
        d3.select("#search-error").text("Country not found");
      }
    });

    // --- reset-to-default button ---
    d3.select("#reset-btn").on("click", resetAll);

    // selection readout + search box react to linked selection
    S.on("select", "header", function (c) {
      updateSelectionReadout(c);
      d3.select("#country-search").property("value", c || "");
      // clear any error state when selection changes from outside the search box
      d3.select("#country-search").classed("search-invalid", false);
      d3.select("#search-error").text("");
    });
  }

  /* reset every control + chart back to the initial view */
  function resetAll() {
    stopAnim();
    const meta = S.s.meta;
    S.clearSelection();
    S.setBloc("All");
    d3.select("#bloc-toggle").selectAll("button").classed("active", b => b === "All");
    S.setRegions(new Set(meta.regions));
    d3.select("#region-chips").selectAll(".chip").classed("off", false);
    S.setYear(meta.yearMax);
    d3.select("#country-search").property("value", "");
  }

  /* ----------------------------- focus / expand controller ----------------------------- */
  /* overview first, details on demand: each ⤢ button blows one chart up to a full-screen
   * overlay (charts use viewBox, so they just scale — no re-render needed). Esc / backdrop closes. */
  function setupFocus() {
    function close() {
      document.querySelectorAll(".card.focused").forEach(c => c.classList.remove("focused"));
      document.body.classList.remove("has-focus");
    }
    d3.selectAll(".expand-btn").on("click", function (e) {
      e.stopPropagation();
      const card = document.getElementById("card-" + this.dataset.card);
      const wasOpen = card.classList.contains("focused");
      close();
      if (!wasOpen) { card.classList.add("focused"); document.body.classList.add("has-focus"); }
    });
    d3.select("#focus-backdrop").on("click", close);
    d3.select("body").on("keydown.focus", e => { if (e.key === "Escape") close(); });
  }

  function updateSelectionReadout(country) {
    const el = d3.select("#selection-readout");
    if (!country) { el.attr("class", "selection empty").text("none — click any country"); return; }
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
