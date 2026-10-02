/* Rank and weights view: six sliders, three presets, a live top-50 table and a live map. */
(function () {
  "use strict";
  const EAP = window.EAP, $ = EAP.$, esc = EAP.esc, C = EAP.C;

  // Rank bands on the map: darker means a higher rank under the chosen weights.
  const BANDS = [
    { max: 30, colour: C.NEED[6], label: "Rank 1 to 30" }, { max: 50, colour: C.NEED[5], label: "31 to 50" }, { max: 100, colour: C.NEED[4], label: "51 to 100" },
    { max: 200, colour: C.NEED[3], label: "101 to 200" }, { max: 350, colour: C.NEED[1], label: "201 to 350" }, { max: 514, colour: C.NEED[0], label: "351 to 514" },
  ];
  const bandColour = r => BANDS.find(b => r <= b.max).colour;

  let built = false, map = null, mapReady = false, current = null, weights = [], raf = 0, comps = [], hover = null;

  EAP.rankView = {
    show() {
      if (!built) { built = true; build(); } else if (map) map.resize();
    },
  };

  const presetWeights = p => comps.map(c => p.weights[c.key]);
  // Stability has two versions. With only the four need components on, it comes from random weights over those four.
  // Once renewable potential or population count, it comes from random weights over all six.
  const needOnly = () => weights[4] === 0 && weights[5] === 0;
  const stabilityOf = d => (needOnly() ? d.stability_need : d.stability);
  const sameAs = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

  function build() {
    comps = EAP.data.meta.components;
    weights = comps.map(c => c.default_weight);
    $("sliders").innerHTML = comps.map((c, i) => `
      <div class="slider"><div class="s-top"><label for="w-${c.key}">${esc(c.label)}</label><output id="o-${c.key}" for="w-${c.key}">${weights[i]}</output></div>
        <input type="range" id="w-${c.key}" data-i="${i}" min="0" max="10" step="1" value="${weights[i]}" aria-describedby="h-${c.key}">
        <p id="h-${c.key}">${esc(c.help)}</p></div>`).join("");
    $("presets").innerHTML = EAP.data.meta.presets.map((p, i) => `<button type="button" class="chip" data-p="${i}" aria-pressed="false">${esc(p.name)}</button>`).join("");
    $("sliders").addEventListener("input", e => {
      const i = +e.target.dataset.i; if (Number.isNaN(i)) return;
      weights[i] = +e.target.value; $("o-" + comps[i].key).textContent = weights[i]; schedule();
    });
    $("presets").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (b) setWeights(presetWeights(EAP.data.meta.presets[+b.dataset.p])); });
    $("rk-reset").addEventListener("click", () => setWeights(comps.map(c => c.default_weight)));
    $("rk-csv").addEventListener("click", download);
    $("rk-body").addEventListener("click", e => { const tr = e.target.closest("tr[data-code]"); if (tr) location.hash = "#map/" + tr.dataset.code; });
    $("rk-body").addEventListener("keydown", e => { if (e.key === "Enter") { const tr = e.target.closest("tr[data-code]"); if (tr) location.hash = "#map/" + tr.dataset.code; } });
    $("rk-legend").innerHTML = `<h3>Rank under your weights</h3><div class="types">` + BANDS.map(b => `<div><i style="background:${b.colour}"></i><span>${b.label}</span></div>`).join("") +
      `</div><div class="row"><span class="sw cur2"></span><span>Black outline: top 50 under these weights</span></div>`;
    buildMap();
    update();
  }

  function setWeights(w) {
    weights = w.slice();
    comps.forEach((c, i) => { $("w-" + c.key).value = w[i]; $("o-" + c.key).textContent = w[i]; });
    update();
  }

  function schedule() { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }

  function update() {
    document.querySelectorAll("#presets button").forEach((b, i) => b.setAttribute("aria-pressed", sameAs(weights, presetWeights(EAP.data.meta.presets[i]))));
    const r = EAP.weighted(weights);
    $("rk-warn").hidden = !!r;
    if (!r) return;
    current = r;
    const ds = EAP.data.districts, top = r.order.slice(0, 50).map(i => ds[i]);
    const n = { current: 0, graduated: 0, never: 0 }; top.forEach(d => { n[d.status]++; });
    $("rk-summary").textContent = `${n.current} are currently listed, ${n.graduated} formerly listed, ${n.never} never listed. These counts describe this list; they are not an accuracy score.`;
    $("rk-body").innerHTML = top.map((d, k) => `<tr data-code="${d.code}" tabindex="0"><td class="num">${k + 1}</td>
      <td><b>${esc(d.name)}</b><span class="pv">${esc(d.province)}</span></td>
      <td class="num">${r.score[ds.indexOf(d)].toFixed(1)}</td><td>${EAP.stabilityLabel(stabilityOf(d))}</td></tr>`).join("");
    $("rk-stab-note").textContent = needOnly() ? "Now showing the draw over the four disadvantage weights." : "Now showing the draw over all six weights, because solar and wind resource or population is on.";
    paintMap(r, top);
  }

  function paintMap(r, top) {
    if (!mapReady) return;
    const ds = EAP.data.districts, e = ["match", ["get", "code"]];
    ds.forEach((d, i) => { e.push(d.code, bandColour(r.rank[i])); });
    e.push("#cccccc");
    map.setPaintProperty("fill", "fill-color", e);
    map.setFilter("top-line", ["in", ["get", "code"], ["literal", top.map(d => d.code)]]);
    map.setFilter("top-casing", ["in", ["get", "code"], ["literal", top.map(d => d.code)]]);
  }

  function download() {
    if (!current) return;
    const ds = EAP.data.districts;
    EAP.downloadCsv("ranking_top50_custom_weights.csv", ["Rank", "District", "Province", "Island group", "Official status", "Score (0 to 100)", needOnly() ? "Share of random draws of the four disadvantage weights with this district in the top 30" : "Share of random draws of all six weights with this district in the top 30"],
      current.order.slice(0, 50).map((i, k) => [k + 1, ds[i].name, ds[i].province, ds[i].island, EAP.STATUS_LABEL[ds[i].status], +current.score[i].toFixed(1), stabilityOf(ds[i])]));
  }

  function buildMap() {
    map = new maplibregl.Map({
      container: "rk-map", style: { version: 8, sources: {}, layers: [{ id: "sea", type: "background", paint: { "background-color": C.SEA } }] },
      bounds: [[94.6, -11.4], [141.4, 6.3]], fitBoundsOptions: { padding: { top: 50, bottom: 50, left: 12, right: 12 } },
      attributionControl: false, dragRotate: false, pitchWithRotate: false, maxZoom: 9, minZoom: 2, renderWorldCopies: false, fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "Boundaries: geoBoundaries" }), "bottom-left");
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    map.on("load", () => {
      map.addSource("d", { type: "geojson", data: EAP.data.geo });
      map.addLayer({ id: "fill", type: "fill", source: "d", paint: { "fill-color": "#cccccc" } });
      map.addLayer({ id: "edges", type: "line", source: "d", paint: { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 0.3, 7, 0.8], "line-opacity": 0.65 } });
      map.addLayer({ id: "top-casing", type: "line", source: "d", filter: ["==", ["get", "code"], -1], paint: { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 3, 2.6, 7, 3.8], "line-opacity": 0.85 } });
      map.addLayer({ id: "top-line", type: "line", source: "d", filter: ["==", ["get", "code"], -1], paint: { "line-color": C.INK, "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.1, 7, 2] } });
      map.addLayer({ id: "hover-line", type: "line", source: "d", filter: ["==", ["get", "code"], -1], paint: { "line-color": C.INK, "line-width": 1.6 } });
      mapReady = true;
      if (current) paintMap(current, current.order.slice(0, 50).map(i => EAP.data.districts[i]));
    });
    map.on("mousemove", e => {
      if (!mapReady) return;
      const f = map.queryRenderedFeatures(e.point, { layers: ["fill"] })[0], code = f ? f.properties.code : null;
      map.getCanvas().style.cursor = code ? "pointer" : "";
      if (code !== hover) { hover = code; map.setFilter("hover-line", ["==", ["get", "code"], code || -1]); }
      const tip = $("rk-tip");
      if (!code || !current) { tip.hidden = true; return; }
      const i = EAP.data.districts.findIndex(d => d.code === code), d = EAP.data.districts[i];
      tip.innerHTML = `<b>${esc(d.name)}</b><span class="mut">${esc(d.province)}</span><br>Rank ${current.rank[i]} · score ${current.score[i].toFixed(1)}`;
      tip.hidden = false;
      const box = $("rk-map").getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
      let x = e.point.x + 14, y = e.point.y + 14;
      if (x + w > box.width - 8) x = e.point.x - w - 14;
      if (y + h > box.height - 8) y = e.point.y - h - 14;
      tip.style.left = x + "px"; tip.style.top = y + "px";
    });
    map.on("mouseout", () => { $("rk-tip").hidden = true; });
    map.on("click", e => { const f = map.queryRenderedFeatures(e.point, { layers: ["fill"] })[0]; if (f) location.hash = "#map/" + f.properties.code; });
  }
})();
