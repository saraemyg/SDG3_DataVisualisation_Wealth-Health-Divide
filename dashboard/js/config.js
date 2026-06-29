/* config.js — global constants: palettes, fonts, margins, formatters.
 * Single source of truth for visual styling so every chart stays consistent
 * (Shaffer's "Clean", Cole Nussbaumer "Aesthetics" — see proposal §7).
 * Colours are drawn from the Okabe-Ito + ColorBrewer colour-blind-safe palettes. */
window.App = window.App || {};

App.config = {
  // 6 macro-regions -> Okabe-Ito colour-blind-safe categorical hues (shared everywhere)
  regionColors: {
    "Europe & Central Asia": "#0072B2",
    "Americas": "#E69F00",
    "East Asia & Pacific": "#009E73",
    "South Asia": "#CC79A7",
    "Middle East & North Africa": "#D55E00",
    "Sub-Saharan Africa": "#56B4E9"
  },

  // economic blocs (hierarchy chart). Deliberately OUTSIDE the region palette (no blue/
  // orange/green/pink) so "blue = Europe" everywhere is never confused with a bloc colour.
  blocColors: { "OECD": "#5E4FA2", "OPEC": "#9E6D00", "Other": "#9AA0A6" },

  // GDP wealth tiers (ordinal, light->dark green = ColorBrewer Greens)
  gdpTierColors: {
    "Low": "#edf8e9", "Lower-Middle": "#bae4b3",
    "Upper-Middle": "#74c476", "High": "#238b45"
  },

  // infant-mortality severity tiers (ordinal, ColorBrewer YlOrRd)
  mortalityTierColors: {
    "Critical": "#bd0026", "High": "#f03b20", "Moderate": "#fd8d3c", "Low": "#fecc5c"
  },

  // sequential ramp used for the choropleth (V4)
  sequentialInterpolator: "interpolateYlOrRd",

  // diverging colours for the "What drives health?" bars (V3)
  goodColor: "#1a9850",   // factor goes WITH a longer life (positive correlation)
  badColor: "#d73027",    // factor goes WITH a shorter life (negative correlation)

  // factors correlated against the health outcome in V3 (key -> plain label).
  // (Outcome metrics like under-5 / neonatal mortality are excluded — they ARE the outcome.)
  drivers: [
    { key: "gdp_per_capita", label: "GDP per person" },
    { key: "health_expenditure", label: "Gov. health spend" },
    { key: "ncd_cardiovascular_pct", label: "Cardiovascular deaths" },
    { key: "fertility", label: "Fertility rate" },
    { key: "tb_incidence", label: "TB cases" },
    { key: "malaria_incidence", label: "Malaria cases" },
    { key: "maternal_mortality", label: "Maternal deaths" }
  ],

  font: "'Segoe UI', system-ui, -apple-system, Helvetica, Arial, sans-serif",
  neutralBg: "#ffffff",
  axisColor: "#6b6b6b",
  gridColor: "#ececec",
  textColor: "#222222",
  mutedText: "#777777",
  highlightStroke: "#111111",

  transition: 300,   // ms for filter/redraw transitions (capped for snappy scrubbing)
  animStep: 320,     // ms per year during V1 playback

  // human-readable labels for tooltips / legends
  labels: {
    gdp_per_capita: "GDP per capita (US$)",
    life_expectancy: "Life expectancy (yrs)",
    infant_mortality: "Infant mortality (per 1,000)",
    population: "Population",
    health_expenditure: "Gov. health spend",
    under5_mortality: "Under-5 mortality (per 1,000)",
    neonatal_mortality: "Neonatal mortality (per 1,000)",
    ncd_cardiovascular_pct: "Cardiovascular deaths (%)",
    tb_incidence: "TB incidence",
    malaria_incidence: "Malaria incidence",
    maternal_mortality: "Maternal mortality"
  }
};

/* shared number formatters */
App.fmt = {
  int: d3.format(",.0f"),
  money: function (v) { return v == null ? "n/a" : "$" + d3.format(",.0f")(v); },
  num1: function (v) { return v == null ? "n/a" : d3.format(",.1f")(v); },
  num2: function (v) { return v == null ? "n/a" : d3.format(",.2f")(v); },
  pop: function (v) { return v == null ? "n/a" : d3.format(".3~s")(v).replace("G", "B"); },
  pct: function (v) { return v == null ? "n/a" : d3.format(".1f")(v) + "%"; }
};
