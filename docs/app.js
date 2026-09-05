/*
 * Vientiane Planning Map
 *
 * Two-layer concept modeled on Sapporo's city-planning information service
 * (https://www.sonicweb-asp.jp/sapporo/):
 *
 *   1. Background ("basemap-equivalent"): the same stars.optgeo.org sources as
 *      the sister project dwg7/height-coverage (OSM planet tiles via the
 *      Positron style, Overture buildings), but restyled as pure linework --
 *      every polygon layer (building, water, landuse, landcover, park,
 *      aeroway/pier areas) is rendered as an outline only, never a fill. Fill
 *      is reserved entirely for the zoning layer on top (see CLAUDE.md).
 *      Buildings are split into two line layers by whether OSM contributed to
 *      `sources` (see HAS_OSM_SOURCE, reused verbatim from height-coverage) --
 *      darker for OSM-sourced, faint for Microsoft/Google-only footprints.
 *      Height/floor data is irrelevant here, unlike height-coverage.
 *
 *   2. Zoning (front, translucent fill): Virgo/MPWT Laos's GLUP2030 dataset
 *      (geonode:glup2030_cdudcp_v1, verified live against
 *      https://virgo.mpwt.gov.la/ -- 63 features, 19 zone codes, colors
 *      matching Virgo's own GetLegendGraphic SLD output), served via
 *      stars.optgeo.org/glup2030_zoning (registered in hfu/stars#7, same
 *      Martin-proxied-pmtiles pattern as overture_buildings).
 *
 * Mercator only, no globe: this is a single-city tool (unlike height-coverage,
 * which is deliberately location-agnostic) and there is no fill-extrusion
 * layer here to trigger the globe+queryRenderedFeatures bug documented in
 * height-coverage's DECISIONS.md #9 addendum -- but there is also no reason
 * to pay globe's complexity cost for a city-scale map.
 */

import * as maplibregl from "https://unpkg.com/maplibre-gl@6.6.0/dist/maplibre-gl.mjs";

const BASE_STYLE_URL = "https://stars.optgeo.org/style/positron";
const BUILDINGS_URL = "https://stars.optgeo.org/overture_buildings/{z}/{x}/{y}";
const ZONING_URL = "https://stars.optgeo.org/glup2030_zoning/{z}/{x}/{y}";

// Chanthabuly district, Vientiane -- same JICA Laos project area as
// height-coverage's default view.
const DEFAULT_VIEW = { center: [102.61, 17.97], zoom: 14 };

const LINE_COLOR = "rgb(180, 182, 178)";

// Building outlines are pure white, matching the road network's own inner
// fill color (Positron's highway_major_inner / highway_motorway_inner are
// both #fff) rather than the muted LINE_COLOR used for water/landuse/park.
// This is a deliberate reversal of an earlier decision that kept buildings
// at LINE_COLOR specifically so they wouldn't outshine roads (DECISIONS.md
// #4) -- the site's emphasis has shifted toward the building layer itself
// being the thing worth looking at (basemap-completeness is the whole
// point here), so it now gets to read at the same visual weight as the
// road network instead of receding into the background linework. OSM vs
// non-OSM is still told apart by dash pattern and width, not lightness
// (DECISIONS.md #4) -- that distinction is orthogonal to this one.
const BUILDING_LINE_COLOR = "#ffffff";

// Full opacity read as slightly too strong once every building outline is
// pure white -- this softens it a touch without giving up the road-white
// hue itself (color is what ties buildings to the road network visually;
// opacity is what keeps that from being overbearing).
const BUILDING_LINE_OPACITY = 0.85;

// Does `sources` (a JSON array of {provider, ...} objects, serialized as a
// string) mention OSM as one of the fused providers at all? Reused verbatim
// from height-coverage/app.js -- same Overture buildings schema, same source.
const HAS_OSM_SOURCE = [
  "case",
  ["has", "sources"],
  ["in", "\"provider\":\"osm\"", ["get", "sources"]],
  false,
];

// Virgo's own GLUP2030 fill colors, extracted from GetLegendGraphic
// (format=application/json) and verified live on 2026-09-02 -- see
// CLAUDE.md and README.md for the request that produced these and the
// zone_name in English carried by each feature (a few are truncated in the
// source data itself, kept as-is rather than guessed at).
const ZONE_COLORS = {
  "Zpp-Ua": { fill: "#7030A0", name: "Historic-Town Conservation Zone" },
  "Zpp-Ub": { fill: "#5A2A82", name: "Ancient-Site Conservation Zone" },
  UAa: { fill: "#FF0101", name: "Administration and Trade Center Zone" },
  UBa: { fill: "#D60093", name: "Zone of Surroundings of Central Urban Area within*" },
  UBb: { fill: "#FF66CC", name: "Zone of Surroundings of Central Urban Area" },
  UCa: { fill: "#FFC002", name: "Mekong Riverbank Zone within Aircraft Flying Area" },
  UCb: { fill: "#FFD966", name: "Mekong Riverbank Zone" },
  UDa: { fill: "#FFF2CC", name: "Zone of Surroundings of Urban Area within Aircraf*" },
  UDb: { fill: "#F5EC3D", name: "Zone of Surroundings of Urban Area relevant to Ag*" },
  UF: { fill: "#7F6000", name: "Zone of Villages surrounded by Rice Field" },
  UEa: { fill: "#9DC3E6", name: "City-Expansion Zone" },
  UEb: { fill: "#2E75B6", name: "City-Expansion Zone (sub-center)" },
  UEi: { fill: "#C9C9C9", name: "Industrial Zone" },
  T: { fill: "#8BE1E5", name: "Transport Zone" },
  Ta: { fill: "#8BE1E5", name: "Transport Zone (airport)" },
  Ef: { fill: "#8BE1E5", name: "Education Zone" },
  Em: { fill: "#8E7536", name: "Military and Public Security Zone" },
  N: { fill: "#A6D86E", name: "Agriculture Zone" },
  NE: { fill: "#278A22", name: "Preservation Zone for Public Use" },
};

const ZONE_FILL_MATCH = [
  "match",
  ["get", "zoning"],
  ...Object.entries(ZONE_COLORS).flatMap(([code, { fill }]) => [code, fill]),
  "#cccccc",
];

// Land-cover/use/water/park polygons that lose their fill and become
// outline-only. Positron's own `building` fill is dropped separately below
// (replaced by the two OSM/non-OSM line layers), so it is not in this list.
const FILL_TO_LINE_IDS = [
  "park",
  "water",
  "landcover_ice_shelf",
  "landcover_glacier",
  "landuse_residential",
  "landcover_wood",
  "aeroway-area",
  "road_area_pier",
];

// Converts one of Positron's fill layers into a thin outline, carrying over
// any existing zoom-dependent fill-opacity expression unchanged (renamed to
// line-opacity) rather than flattening it to a constant -- per
// height-coverage's advice, this avoids lines that are too thick zoomed out
// or vanish zoomed in.
function fillLayerToLine(layer) {
  const { paint = {} } = layer;
  const linePaint = {
    "line-color": paint["fill-color"] ?? LINE_COLOR,
    "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 16, 1.25],
  };
  if ("fill-opacity" in paint) linePaint["line-opacity"] = paint["fill-opacity"];
  return { ...layer, type: "line", paint: linePaint };
}

async function main() {
  const style = await fetch(BASE_STYLE_URL).then((r) => r.json());

  style.layers = style.layers
    .filter((l) => l.id !== "building")
    .map((l) => (FILL_TO_LINE_IDS.includes(l.id) ? fillLayerToLine(l) : l));

  style.sources.buildings = {
    type: "vector",
    tiles: [BUILDINGS_URL],
    minzoom: 4,
    maxzoom: 14,
  };
  style.sources.zoning = {
    type: "vector",
    tiles: [ZONING_URL],
    minzoom: 0,
    maxzoom: 11,
    attribution: "Virgo (MPWT Laos)",
  };

  const labelIndex = style.layers.findIndex((l) => l.type === "symbol");
  const insertAt = labelIndex === -1 ? style.layers.length : labelIndex;

  style.layers.splice(
    insertAt,
    0,
    // Zoning first, so the linework basemap above (roads, labels) stays
    // legible on top of the translucent zoning fill. Opacity fades with
    // zoom rather than sitting at one flat value -- modeled on ZoLa's own
    // shipped style (NYCPlanning/labs-zola's "zd-fill" layer: fill-opacity
    // 0.3 at z15 dropping to 0 by z16, with the outline/line-width taking
    // over as the primary cue up close). Virgo's own hues are kept exactly
    // as published (CLAUDE.md: use the real palette, don't invent pastel
    // versions) -- opacity is the only lever, per user feedback that the
    // flat 0.55 read as too dark/heavy and buried the basemap underneath.
    // Unlike ZoLa's fine-grained per-lot districts, GLUP2030's zones stay
    // legible at building scale, so this fades toward a soft wash rather
    // than to fully transparent.
    {
      id: "zoning-fill",
      type: "fill",
      source: "zoning",
      "source-layer": "zoning",
      paint: {
        "fill-color": ZONE_FILL_MATCH,
        "fill-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0.4, 14, 0.32, 18, 0.2],
      },
    },
    {
      id: "zoning-outline",
      type: "line",
      source: "zoning",
      "source-layer": "zoning",
      paint: {
        "line-color": "#808080",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.5, 16, 1.5, 18, 2],
      },
    },
    // Buildings on top of zoning, distinguished only by OSM involvement --
    // no height/floor logic here, unlike height-coverage. Same color for
    // both (see BUILDING_LINE_COLOR); dashed + slightly thinner for
    // non-OSM instead of a lighter tone.
    {
      id: "buildings-non-osm",
      type: "line",
      source: "buildings",
      "source-layer": "building",
      minzoom: 13,
      filter: ["!", HAS_OSM_SOURCE],
      paint: {
        "line-color": BUILDING_LINE_COLOR,
        "line-opacity": BUILDING_LINE_OPACITY,
        "line-width": 0.5,
        "line-dasharray": [1, 1.4],
      },
    },
    {
      id: "buildings-osm",
      type: "line",
      source: "buildings",
      "source-layer": "building",
      minzoom: 12,
      filter: HAS_OSM_SOURCE,
      paint: {
        "line-color": BUILDING_LINE_COLOR,
        "line-opacity": BUILDING_LINE_OPACITY,
        "line-width": 0.8,
      },
    }
  );

  // Zone codes rendered directly on the map, bold and reasonably large --
  // modeled on NYC Planning Labs' ZoLa (zola.planning.nyc.gov), which
  // labels every zoning district this way at parcel zoom. Pushed to the
  // end for now; the pass below moves it (and every other label) above
  // every fill and line regardless of position here.
  style.layers.push({
    id: "zoning-label",
    type: "symbol",
    source: "zoning",
    "source-layer": "zoning",
    minzoom: 10,
    layout: {
      "text-field": ["get", "zoning"],
      "text-size": 14,
      "text-font": ["Noto Sans Bold"],
    },
    paint: {
      "text-color": "#2a2a2a",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1.4,
    },
  });

  // Cartographic principle: labels sit above every fill and line, always --
  // never let basemap linework or another layer's fill trample a label
  // just because it happens to come later in the source style's own layer
  // order. Positron's own "water_name" symbol layer sits surprisingly
  // early (right after landcover_wood), so without this pass, zone-code
  // labels inserted near it would render underneath most of the road/rail
  // network and every building outline. Stable-partition non-symbol
  // layers first, symbol layers last, preserving relative order within
  // each group -- this only reorders label-vs-everything, not
  // fill-vs-line-vs-fill ordering among themselves.
  const nonSymbolLayers = style.layers.filter((l) => l.type !== "symbol");
  const symbolLayers = style.layers.filter((l) => l.type === "symbol");
  style.layers = [...nonSymbolLayers, ...symbolLayers];

  const map = new maplibregl.Map({
    container: "map",
    style,
    hash: "map",
    // See height-coverage/app.js: MapLibre v6's tile-overscaling default
    // otherwise breaks queryRenderedFeatures() against this same buildings
    // source past its maxzoom.
    zoomLevelsToOverscale: undefined,
    ...DEFAULT_VIEW,
  });

  map.addControl(new maplibregl.NavigationControl(), "top-right");

  // MapLibre sizes its canvas from the container's measured dimensions at
  // construction time and does not re-measure on its own afterward. If the
  // container was 0x0 at that moment (e.g. the tab/pane was backgrounded
  // during initial load), the canvas is stuck too small until something
  // forces a re-measure -- cover both the ordinary window-resize case and
  // the tab-was-hidden-then-shown case.
  window.addEventListener("resize", () => map.resize());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") map.resize();
  });

  map.on("click", "zoning-fill", (e) => showZoningPopup(map, e));
  map.on("mouseenter", "zoning-fill", () => {
    map.getCanvas().style.cursor = "pointer";
  });
  map.on("mouseleave", "zoning-fill", () => {
    map.getCanvas().style.cursor = "";
  });

  map.on("mousemove", "zoning-fill", (e) => showHoverInfo(e.features[0]));
  map.on("mouseleave", "zoning-fill", () => showHoverInfo(null));

  // The compass menu's position is a one-time pixel snapshot, not tracked
  // against the map -- close it as soon as panning/zooming/rotating would
  // make that snapshot stale, rather than let it visually drift off its
  // real-world point.
  map.on("movestart", closeCompassMenu);

  setupPanelToggle();
  buildZoneLegend();
}

function buildZoneLegend() {
  const container = document.getElementById("zone-legend");
  container.innerHTML = Object.entries(ZONE_COLORS)
    .map(
      ([code, { fill, name }]) =>
        `<div class="legend-row"><span class="swatch" style="background:${fill}"></span> <strong>${escapeHtml(code)}</strong> ${escapeHtml(name)}</div>`
    )
    .join("");
}

// The zone name is the headline -- large and bold, since it's the one thing
// that tells a first-time visitor what this map is even about. The three
// regulatory numbers (height/coverage/FAR) get their own vivid stat chips
// rather than being buried in a plain key:value list. The raw field dump
// stays too, small and monospace, for anyone who wants the underlying
// attribute names -- per height-coverage's hover-panel convention (only the
// fields the layers above actually read, not a full attribute dump).
function showHoverInfo(feature) {
  const panel = document.getElementById("hover-panel");
  if (!feature) {
    panel.classList.remove("visible");
    panel.innerHTML = "";
    return;
  }
  const p = feature.properties;
  panel.innerHTML = `
    <div class="hp-headline">
      <span class="hp-code">${escapeHtml(p.zoning)}</span>
      <span class="hp-name">${escapeHtml(p.zone_name)}</span>
    </div>
    <div class="hp-stats">
      <div class="hp-stat">
        <div class="hp-stat-value">${formatStat(p.h, (v) => v)}<span class="hp-stat-unit">m</span></div>
        <div class="hp-stat-label">height limit</div>
      </div>
      <div class="hp-stat">
        <div class="hp-stat-value">${formatStat(p.e, (v) => Math.round(v * 100))}<span class="hp-stat-unit">%</span></div>
        <div class="hp-stat-label">coverage (e)</div>
      </div>
      <div class="hp-stat">
        <div class="hp-stat-value">${formatStat(p.cos, (v) => Math.round(v * 100))}<span class="hp-stat-unit">%</span></div>
        <div class="hp-stat-label">floor area ratio (cos)</div>
      </div>
    </div>
    <div class="hp-raw">zoning=${escapeHtml(p.zoning)} h=${escapeHtml(String(p.h))} e=${escapeHtml(String(p.e))} cos=${escapeHtml(String(p.cos))}</div>
  `;
  panel.classList.add("visible");
}

// Virgo represents "no value specified" as 0 in h/e/cos, not as null/absent
// -- a Transport or Military zone with h=0/e=0/cos=0 doesn't mean "0m height
// limit, 0% buildable", it means the field wasn't given a value. Showing
// "0m"/"0%" reads as an actual (and false) regulation, so render it as "-"
// instead. Each field is checked independently (e.g. Agriculture Zone has
// h=10 but e=0/cos=0 -- a real height limit alongside two unset fields).
function formatStat(value, transform) {
  return value === 0 ? "-" : escapeHtml(String(transform(value)));
}

// 8 compass directions arranged in a ring around the click point.
// screenOffset is degrees clockwise from "up" on screen (0 = up), matching
// how the arrows visually sit around that point. No center/"auto" button --
// it would sit exactly on the click point itself, which is both redundant
// (Google already falls back to the nearest imagery when no heading is
// given at all, so "auto" isn't a distinct choice worth a button) and a
// real hit-testing hazard: a clickable element placed exactly under the
// cursor that opened the menu risks catching that same gesture's tail end.
const COMPASS_DIRECTIONS = [
  { title: "Northwest", arrow: "↖", screenOffset: 315 },
  { title: "North", arrow: "↑", screenOffset: 0 },
  { title: "Northeast", arrow: "↗", screenOffset: 45 },
  { title: "West", arrow: "←", screenOffset: 270 },
  { title: "East", arrow: "→", screenOffset: 90 },
  { title: "Southwest", arrow: "↙", screenOffset: 225 },
  { title: "South", arrow: "↓", screenOffset: 180 },
  { title: "Southeast", arrow: "↘", screenOffset: 135 },
];

// Shown once ever per browser (not per session) -- the point is a single
// piece of onboarding, not a recurring nag every time someone opens the
// compass.
const STREETVIEW_NOTICE_KEY = "vientianeStreetViewNoticeShown";

let activeCompass = null;

function closeCompassMenu() {
  if (activeCompass) {
    activeCompass.remove();
    activeCompass = null;
  }
}

function showZoningPopup(map, e) {
  // The zoning-fill click handler runs before this listener, so stopping
  // propagation here keeps the very click that opens the compass from also
  // reaching the document-level "click outside closes it" listener below.
  e.originalEvent.stopPropagation();

  if (!localStorage.getItem(STREETVIEW_NOTICE_KEY)) {
    showStreetViewNotice(() => {
      localStorage.setItem(STREETVIEW_NOTICE_KEY, "1");
      openCompassMenu(map, e);
    });
  } else {
    openCompassMenu(map, e);
  }
}

// Buttons sit directly on the map around the click point rather than inside
// a speech-bubble popup -- the popup's box-and-tail chrome was extra visual
// weight around what's now just a small ring of direction buttons.
// Positioned with the viewport (not the map container) as the coordinate
// space and appended to <body>, so the buttons are never clipped by the
// map container's overflow:hidden even when the click lands near an edge.
function openCompassMenu(map, e) {
  closeCompassMenu();

  const [lon, lat] = e.lngLat.toArray();
  const viewpoint = `${lat.toFixed(6)},${lon.toFixed(6)}`;

  // Plain Google Maps URL scheme -- no API key, no signature, no billing
  // (unlike the Street View Static API or JS Embed API, which require
  // both). Ported from height-coverage (dwg7/height-coverage@e76ea1c).
  const streetViewUrl = (heading) =>
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${viewpoint}&fov=90&heading=${heading}`;

  // MapLibre's bearing is the compass direction currently facing "up" on
  // screen (0 when north-up). A screen-relative arrow (0 = up, 90 = right,
  // ...) only points at the intended real-world direction once the map's
  // own rotation is folded back in -- otherwise a rotated map would send
  // every direction off by the rotation amount, which is exactly the
  // "looking the wrong way" disorientation this compass is meant to avoid.
  const bearing = map.getBearing();

  const mapRect = map.getContainer().getBoundingClientRect();
  const anchorX = mapRect.left + e.point.x;
  const anchorY = mapRect.top + e.point.y;
  const RADIUS = 42;

  const menu = document.createElement("div");
  menu.className = "sv-compass";
  menu.style.left = `${anchorX}px`;
  menu.style.top = `${anchorY}px`;

  for (const dir of COMPASS_DIRECTIONS) {
    const a = document.createElement("a");
    a.className = "sv-compass-btn";
    a.target = "_vientiane_streetview";
    a.rel = "noopener";

    const heading = Math.round((dir.screenOffset + bearing + 360) % 360);
    a.href = streetViewUrl(heading);
    a.title = `Look ${dir.title.toLowerCase()}`;
    a.textContent = dir.arrow;
    const rad = (dir.screenOffset * Math.PI) / 180;
    a.style.left = `${RADIUS * Math.sin(rad)}px`;
    a.style.top = `${-RADIUS * Math.cos(rad)}px`;
    menu.appendChild(a);
  }

  document.body.appendChild(menu);
  activeCompass = menu;
}

document.addEventListener("click", (ev) => {
  if (activeCompass && !activeCompass.contains(ev.target)) closeCompassMenu();
});
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") closeCompassMenu();
});

// A one-time modal, shown before the very first compass, instead of a
// disclaimer caption crowding the ring on every click -- see the user's
// request to keep the per-click UI to just the buttons themselves.
function showStreetViewNotice(onAcknowledge) {
  const overlay = document.createElement("div");
  overlay.className = "sv-notice-overlay";
  overlay.innerHTML = `
    <div class="sv-notice-dialog">
      <p>Google Street View links here are just for a look --<br>not a source to trace over for editing.</p>
      <p class="sv-notice-links">
        <a href="https://www.google.com/help/terms_maps/" target="_blank" rel="noopener">Google Maps/Earth terms</a>
        &middot;
        <a href="https://wiki.openstreetmap.org/wiki/Google" target="_blank" rel="noopener">OSM wiki: Google</a>
      </p>
      <button type="button" class="sv-notice-ok">OK</button>
    </div>`;

  const dismiss = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKeydown);
    onAcknowledge();
  };
  const onKeydown = (ev) => {
    if (ev.key === "Escape" || ev.key === "Enter") dismiss();
  };

  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay || ev.target.classList.contains("sv-notice-ok")) {
      // Without this, the same click that dismisses the dialog and opens
      // the compass keeps bubbling to the document-level "click outside
      // closes the compass" listener below, which would then immediately
      // close the compass this very click just opened.
      ev.stopPropagation();
      dismiss();
    }
  });
  document.addEventListener("keydown", onKeydown);

  document.body.appendChild(overlay);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setupPanelToggle() {
  const panel = document.getElementById("panel");
  const icon = document.getElementById("panel-toggle-icon");
  document.getElementById("panel-toggle").addEventListener("click", () => {
    const collapsed = panel.classList.toggle("collapsed");
    icon.textContent = collapsed ? "+" : "−";
  });
}

main().catch((err) => {
  console.error(err);
  document.getElementById("stat-detail").textContent = "Failed to load: " + err.message;
});
