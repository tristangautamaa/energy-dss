/* Map view: layer switch, shortlist, legend, hover tooltip, and the district profile that slides over the map. */
(function () {
  "use strict";
  const EAP = window.EAP, $ = EAP.$, esc = EAP.esc, C = EAP.C, LAYERS = EAP.LAYERS;
  const state = { layer: "need", showCurrent: false, selected: null, hover: null, island: "", province: "", search: "" };
  let map = null, ready = false, built = false;

  const ISLAND_LABELS = [
    ["Sumatra", 97.2, -3.6], ["Kalimantan", 117.6, 5.2], ["Java-Bali", 110.2, -9.3], ["Sulawesi", 124.6, 1.6],
    ["Nusa Tenggara", 118.0, -10.6], ["Maluku", 127.4, -6.3], ["Papua", 135.0, -8.9],
  ];
  const CASING = "#2E1F55";   // night indigo under the amber line: keeps the outline visible on pale fills
  const SHORT_STATUS = { current: "Currently listed", graduated: "Formerly listed", never: "Never listed" };

  EAP.mapView = {
    show(arg) {
      if (!built) { built = true; buildPanel(); buildMap(); } else if (map) map.resize();
      if (arg && EAP.byCode.has(+arg)) select(+arg, true);
      else if (state.selected) closeProfile();
    },
    select: (code, fly) => select(code, fly),
    map: () => map,
  };

  // ---------------------------------------------------------------- left panel
  function buildPanel() {
    const m = EAP.data.meta;
    $("short-sub").textContent = `Ordered by similarity score. ${m.shortlist_current} are currently listed; ${50 - m.shortlist_current} are not.`;
    const islands = [...new Set(EAP.shortlist.map(d => d.island))].sort();
    $("f-island").insertAdjacentHTML("beforeend", islands.map(i => `<option>${esc(i)}</option>`).join(""));
    fillProvinces();
    $("f-island").addEventListener("change", e => { state.island = e.target.value; state.province = ""; fillProvinces(); renderList(); });
    $("f-prov").addEventListener("change", e => { state.province = e.target.value; renderList(); });
    $("f-search").addEventListener("input", e => { state.search = e.target.value.trim().toLowerCase(); renderList(); });
    $("layer-switch").addEventListener("click", e => { const b = e.target.closest("button[data-layer]"); if (b) setLayer(b.dataset.layer); });
    $("layer-switch").addEventListener("keydown", e => {
      if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
      const bs = [...document.querySelectorAll("#layer-switch button")], i = bs.findIndex(b => b.dataset.layer === state.layer);
      const j = (i + (e.key === "ArrowRight" ? 1 : bs.length - 1)) % bs.length;
      setLayer(bs[j].dataset.layer); bs[j].focus(); e.preventDefault();
    });
    $("legend").addEventListener("change", e => {
      if (e.target.id !== "t-current") return;
      state.showCurrent = e.target.checked;
      if (ready) map.setLayoutProperty("current-line", "visibility", state.showCurrent ? "visible" : "none");
    });
    $("legend-btn").addEventListener("click", () => {
      const open = $("legend").classList.toggle("open");
      $("legend-btn").setAttribute("aria-expanded", open);
    });
    $("sheet-toggle").addEventListener("click", () => {
      const open = $("panel").classList.toggle("open");
      $("sheet-toggle").setAttribute("aria-expanded", open);
      $("sheet-toggle").querySelector("span").textContent = open ? "Hide the shortlist" : "Show the shortlist";
    });
    $("btn-csv").addEventListener("click", () => EAP.downloadCsv("shortlist_top50.csv",
      ["Shortlist number", "District", "Province", "Island group", "Official status", "Access disadvantage index", "Disadvantage rank", "Solar and wind resource", "Solar and wind rank", "Underdevelopment similarity score"],
      EAP.shortlist.map(d => [d.screen_rank, d.name, d.province, d.island, EAP.STATUS_LABEL[d.status], d.need, d.need_rank, d.feas, d.feas_rank, d.screen])));
    $("layer-help").textContent = LAYERS[state.layer].help;
    renderList(); renderLegend(); renderCaption();
  }

  function fillProvinces() {
    const src = EAP.shortlist.filter(d => !state.island || d.island === state.island);
    const provs = [...new Set(src.map(d => d.province))].sort();
    $("f-prov").innerHTML = `<option value="">All provinces</option>` + provs.map(p => `<option>${esc(p)}</option>`).join("");
  }

  const rowHtml = (d, extra) => `<li class="${state.selected === d.code ? "is-selected" : ""}"><button type="button" data-code="${d.code}" title="${esc(EAP.STATUS_LABEL[d.status])}">
      <span class="rk">${extra || d.screen_rank}</span><span class="nm"><b>${esc(d.name)}</b><span class="pv">${esc(d.province)}</span></span><span class="nd">${EAP.ord(d.need_rank)}</span><span class="nd">${d.screen.toFixed(2)}</span></button></li>`;

  function renderList() {
    const q = state.search;
    const rows = EAP.shortlist.filter(d => (!state.island || d.island === state.island) && (!state.province || d.province === state.province) &&
      (!q || (d.name + " " + d.province).toLowerCase().includes(q)));
    let html = rows.map(d => rowHtml(d)).join("");
    $("list-empty").hidden = rows.length > 0 || q.length > 1;
    // A search that finds nothing on the shortlist also looks through all 514 districts.
    if (q.length > 1 && !state.island && !state.province) {
      const others = EAP.data.districts.filter(d => !d.shortlist && (d.name + " " + d.province).toLowerCase().includes(q)).slice(0, 8);
      if (others.length) html += `<li class="sep">${rows.length ? "Other districts" : "Not on the shortlist. Other matches:"}</li>` + others.map(d => rowHtml(d, "–")).join("");
      else if (!rows.length) $("list-empty").hidden = false;
    }
    $("short-list").innerHTML = html;
    $("short-list").querySelectorAll("button").forEach(b => b.addEventListener("click", () => { select(+b.dataset.code, true); if (EAP.narrow()) closeSheet(); }));
    const sel = $("short-list").querySelector(".is-selected"); if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  function closeSheet() { $("panel").classList.remove("open"); $("sheet-toggle").setAttribute("aria-expanded", "false"); $("sheet-toggle").querySelector("span").textContent = "Show the shortlist"; }

  // ---------------------------------------------------------------- legend and caption
  function renderCaption() {
    const L = LAYERS[state.layer];
    $("map-caption").innerHTML = `<strong>${L.title}</strong> · 514 districts`;
  }

  function renderLegend() {
    const L = LAYERS[state.layer];
    let html;
    if (state.layer === "type") {
      html = `<h3>Landscape group</h3><div class="types">` + EAP.data.meta.types.map(t => `<div><i style="background:${C.TYPE[t.id]}"></i><span>${esc(t.name)} (${t.count})</span></div>`).join("") + `</div>`;
    } else {
      const ticks = L.breaks.map(b => `<span>${L.tick(b)}</span>`).join("");
      html = `<h3>${L.title} (${L.unit})</h3><div class="ramp">${L.colours.map(c => `<i style="background:${c}"></i>`).join("")}</div>
        <div class="ticks"><span></span>${ticks}</div><div class="ends"><span>${L.lo}</span><span>${L.hi}</span></div>`;
    }
    // On the feasibility layer the fill is amber too, so the shortlist outline switches to dark ink to stay visible.
    const dark = state.layer === "feas", fill = state.layer === "type" ? C.TYPE[2] : L.colours[3];
    const sw = `background:${fill};border-color:${dark ? C.INK : C.AMBER};box-shadow:0 0 0 1.5px ${dark ? "#FFFFFF" : CASING}, inset 0 0 0 1.5px ${dark ? "#FFFFFF" : CASING}`;
    html += `<div class="row"><span class="sw short" style="${sw}"></span><span>Shortlist (50 to check first)</span></div>
      <label class="row chk"><input type="checkbox" id="t-current"${state.showCurrent ? " checked" : ""}><span class="sw cur"></span><span>Outline the 30 currently listed underdeveloped districts</span></label>`;
    $("legend").innerHTML = html;
  }

  function setLayer(k) {
    state.layer = k;
    document.querySelectorAll("#layer-switch button").forEach(b => b.setAttribute("aria-checked", b.dataset.layer === k));
    $("layer-help").textContent = LAYERS[k].help;
    renderLegend(); renderCaption();
    if (ready) { map.setPaintProperty("fill", "fill-color", fillExpr()); map.setPaintProperty("short-line", "line-color", k === "feas" ? C.INK : C.AMBER); map.setPaintProperty("short-casing", "line-color", k === "feas" ? "#FFFFFF" : CASING); }
  }

  function fillExpr() {
    const L = LAYERS[state.layer];
    if (state.layer === "type") return ["match", ["get", "type"], ...C.TYPE.flatMap((c, i) => [i, c]), "#cccccc"];
    const e = ["step", ["get", L.prop], L.colours[0]];
    L.breaks.forEach((b, i) => e.push(b, L.colours[i + 1]));
    return e;
  }

  // ---------------------------------------------------------------- map
  const homePadding = () => (EAP.narrow() ? { top: 40, bottom: 140, left: 6, right: 6 } : { top: 16, bottom: 16, left: 12, right: 12 });

  function buildMap() {
    map = new maplibregl.Map({
      container: "map",
      style: { version: 8, sources: {}, layers: [{ id: "sea", type: "background", paint: { "background-color": C.SEA } }] },
      bounds: [[94.6, -11.4], [141.4, 6.3]], fitBoundsOptions: { padding: homePadding() },
      attributionControl: false, dragRotate: false, pitchWithRotate: false, maxZoom: 9, minZoom: 2, renderWorldCopies: false, fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Boundaries: geoBoundaries" }), "bottom-left");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");

    map.on("load", () => {
      const geo = EAP.data.geo;
      map.addSource("d", { type: "geojson", data: geo });
      map.addLayer({ id: "fill", type: "fill", source: "d", paint: { "fill-color": fillExpr() } });
      map.addLayer({ id: "edges", type: "line", source: "d", paint: { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.3, 7, 0.8], "line-opacity": 0.65 } });
      map.addLayer({ id: "current-line", type: "line", source: "d", filter: ["==", ["get", "cur"], 1], layout: { visibility: state.showCurrent ? "visible" : "none" }, paint: { "line-color": C.INK, "line-width": 0.9 } });
      map.addLayer({ id: "short-casing", type: "line", source: "d", filter: ["==", ["get", "short"], 1], layout: { "line-join": "round" }, paint: { "line-color": CASING, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 3.4, 7, 4.8], "line-opacity": 0.92 } });
      map.addLayer({ id: "short-line", type: "line", source: "d", filter: ["==", ["get", "short"], 1], layout: { "line-join": "round" }, paint: { "line-color": C.AMBER, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.3, 7, 2.2] } });
      map.addLayer({ id: "hover-line", type: "line", source: "d", filter: ["==", ["get", "code"], -1], paint: { "line-color": C.INK, "line-width": 1.6 } });
      map.addLayer({ id: "sel-halo", type: "line", source: "d", filter: ["==", ["get", "code"], -1], paint: { "line-color": "#FFFFFF", "line-width": 5.5 } });
      map.addLayer({ id: "sel-line", type: "line", source: "d", filter: ["==", ["get", "code"], -1], paint: { "line-color": C.INK, "line-width": 2 } });
      ready = true;
      addIslandLabels();
      if (state.selected) select(state.selected, true);
      map.once("idle", () => { document.body.dataset.mapReady = "1"; document.body.dataset.firstView = Math.round(performance.now()); });
    });

    map.on("mousemove", e => {
      if (!ready) return;
      const f = map.queryRenderedFeatures(e.point, { layers: ["fill"] })[0];
      const code = f ? f.properties.code : null;
      map.getCanvas().style.cursor = code ? "pointer" : "";
      if (code !== state.hover) { state.hover = code; map.setFilter("hover-line", ["==", ["get", "code"], code || -1]); }
      showTip(code, e.point);
    });
    map.on("mouseout", () => { $("tip").hidden = true; });
    map.on("click", e => { const f = map.queryRenderedFeatures(e.point, { layers: ["fill"] })[0]; if (f) { select(f.properties.code, false); $("tip").hidden = true; } });
  }

  function addIslandLabels() {
    const labels = [];
    ISLAND_LABELS.forEach(([name, lon, lat]) => {
      const el = document.createElement("div"); el.className = "island-label"; el.textContent = name;
      new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lon, lat]).addTo(map);
      labels.push(el);
    });
    map.on("zoom", () => { const hide = map.getZoom() > 5.1; labels.forEach(el => { el.style.display = hide ? "none" : ""; }); });
  }

  function showTip(code, pt) {
    const tip = $("tip");
    if (!code) { tip.hidden = true; return; }
    const d = EAP.byCode.get(code), L = LAYERS[state.layer];
    const line = state.layer === "type" ? `Landscape group: ${esc(EAP.data.meta.types[d.type].name)}` : `${L.title}: ${L.fmt(d[L.prop])}`;
    tip.innerHTML = `<b>${esc(d.name)}</b><span class="mut">${esc(d.province)}</span><br>${line}` + (d.shortlist ? `<br><span class="sun">Shortlist No. ${d.screen_rank}</span>` : "");
    tip.hidden = false;
    const box = $("map").getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    let x = pt.x + 14, y = pt.y + 14;
    if (x + w > box.width - 8) x = pt.x - w - 14;
    if (y + h > box.height - 8) y = pt.y - h - 14;
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }

  // ---------------------------------------------------------------- selection and profile
  const profilePadding = () => (EAP.narrow() ? { top: 10, bottom: Math.round($("map").clientHeight * 0.62), left: 10, right: 10 } : { right: 440, left: 20, top: 20, bottom: 20 });

  function select(code, fly) {
    const d = EAP.byCode.get(code); if (!d) return;
    state.selected = code;
    $("view-map").classList.add("has-profile");
    renderList(); renderProfile(d);
    if (ready) {
      ["sel-halo", "sel-line"].forEach(l => map.setFilter(l, ["==", ["get", "code"], code]));
      const dur = EAP.reduceMotion() ? 0 : 700;
      if (fly) map.easeTo({ center: [d.lon, d.lat], zoom: Math.min(7, Math.max(4.4, 5.2 - 0.8 * Math.log2(Math.max(d.span, 0.2)))), padding: profilePadding(), duration: dur });
      else map.easeTo({ padding: profilePadding(), duration: EAP.reduceMotion() ? 0 : 250 });
    }
    history.replaceState(null, "", "#map/" + code);
  }

  function closeProfile() {
    state.selected = null;
    $("view-map").classList.remove("has-profile");
    $("profile").classList.remove("open"); $("profile").setAttribute("aria-hidden", "true");
    if (ready) {
      ["sel-halo", "sel-line"].forEach(l => map.setFilter(l, ["==", ["get", "code"], -1]));
      map.easeTo({ padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: EAP.reduceMotion() ? 0 : 250 });
    }
    renderList(); history.replaceState(null, "", "#map");
  }

  async function renderProfile(d) {
    await EAP.explanations();
    if (state.selected !== d.code) return;
    const ex = EAP.expl[d.code], type = EAP.data.meta.types[d.type], P = $("profile");
    const inCompare = EAP.compare.has(d.code);
    P.innerHTML = `
      <div class="p-head">
        <button type="button" class="p-close" id="p-close">Close</button>
        <h2 class="p-name">${esc(d.name)}</h2>
        <div class="p-sub">${esc(d.province)} · ${esc(d.island)}</div>
        <p class="p-status">${EAP.statusSentence(d)}</p>
        ${d.shortlist ? `<p class="p-short"><span class="chip-sun">On the shortlist</span> No. ${d.screen_rank} of 50</p>` : ""}
      </div>
      <div class="p-body">
        <div class="blk"><h3>How it ranks</h3>
          ${EAP.rankBar("need", "Disadvantage rank", d.need_rank, `${EAP.ord(d.need_rank)} of 514`, `Score ${d.need.toFixed(1)}, ${EAP.beats("need", d.need_rank)}.`)}
          ${EAP.rankBar("feas", "Solar and wind rank", d.feas_rank, `${EAP.ord(d.feas_rank)} of 514`, `Score ${d.feas.toFixed(1)}, ${EAP.beats("feas", d.feas_rank)}.`)}
          ${EAP.rankBar("screen", "Similarity rank", d.screen_rank, `${EAP.ord(d.screen_rank)} of 514`, `Score ${d.screen.toFixed(2)}, ${EAP.beats("screen", d.screen_rank)}.`)}
        </div>
        <div class="blk why"><h3>What drives its similarity score</h3>
          ${ex.text.map(t => `<p>${esc(t)}</p>`).join("")}
          ${EAP.pushChart(ex)}
          <p class="cap">Bar length: effect on the similarity score (0 to 1), scaled to this district.</p>
        </div>
        <div class="blk"><h3>Compared with the national median</h3>
          <p class="cap">Dot: this district. Tick: national median. Left is the lowest of 514, right the highest.</p>
          ${EAP.indicatorRows(d)}
        </div>
        <div class="blk type-line"><h3>Landscape group</h3><b>${esc(type.name)}</b> <span class="mut">· ${type.count} districts</span><p>${esc(type.description)}</p></div>
      </div>
      <div class="p-actions"><button type="button" class="btn" id="p-compare">${inCompare ? "Remove from compare" : "Add to compare"}</button><button type="button" class="btn outline" id="p-zoom">Zoom to district</button></div>`;
    P.classList.add("open"); P.setAttribute("aria-hidden", "false");
    $("p-close").addEventListener("click", closeProfile);
    $("p-zoom").addEventListener("click", () => select(d.code, true));
    $("p-compare").addEventListener("click", () => {
      const had = EAP.compare.has(d.code);
      if (!had && EAP.compare.list.length >= EAP.compare.max) { $("p-compare").textContent = "Compare holds 4. Remove one first."; return; }
      EAP.compare.toggle(d.code);
      $("p-compare").textContent = had ? "Add to compare" : "Remove from compare";
    });
    P.scrollTop = 0;
  }

  document.addEventListener("keydown", e => { if (e.key === "Escape" && state.selected && !$("view-map").hidden) closeProfile(); });
})();
