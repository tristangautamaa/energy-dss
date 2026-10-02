/* Core: colours, layers, data loading, small helpers, the compare list and the weighted score.
   Plain JavaScript, no build step. Every view reads from window.EAP. All data is precomputed (./data). */
(function () {
  "use strict";
  const EAP = (window.EAP = {});

  EAP.C = {
    SEA: "#DCE5EA", INK: "#1B2733", AMBER: "#E8A317", MUTED: "#5E6E79", HAIR: "#D3DBE0",
    NEED: ["#ECE8F1", "#D2C9E3", "#AB9CCB", "#8170AF", "#5B4793", "#3F2D75", "#2E1F55"],
    SUN: ["#FBF1DA", "#F6E0A8", "#F0C96E", "#E8A317", "#C8820C", "#9C6208", "#6E4305"],
    TEAL: ["#E4EFEF", "#C2DBDC", "#99C3C6", "#6FA8AE", "#488A94", "#286B78", "#0F4C56"],
    TYPE: ["#26503E", "#747540", "#A6AD6B", "#AF818D", "#4974AA", "#BED8C2", "#DEB7E0"],
  };

  // The four map layers. "bar" is the colour used for that score in the profile's rank bars.
  EAP.LAYERS = {
    need: { prop: "need", title: "Access disadvantage index", unit: "0 to 100", breaks: [55, 63, 68, 73, 80, 90], colours: EAP.C.NEED, bar: "#3F2D75",
      fmt: v => v.toFixed(1), tick: v => v.toFixed(0), lo: "Less disadvantaged", hi: "More disadvantaged",
      help: "How far a district is from good energy access, from 0 to 100. It averages four parts with equal weight: how dark the district is at night, poverty and low human development, few roads and long distances to a main road, and rugged, forested or wet land. Higher means darker, poorer, more remote and harder to reach." },
    feas: { prop: "feas", title: "Solar and wind resource", unit: "0 to 100", breaks: [15, 25, 35, 45, 60, 80], colours: EAP.C.SUN, bar: "#E8A317",
      fmt: v => v.toFixed(1), tick: v => v.toFixed(0), lo: "Weaker sun and wind", hi: "Stronger sun and wind",
      help: "How strong the sun and wind are, from 0 to 100, based on solar irradiance and wind speed at 100 m. Higher means better conditions for solar panels or wind turbines. It shows where renewables could work, not where the need is." },
    screen: { prop: "screen", title: "Similarity to underdeveloped list", unit: "0 to 1", breaks: [0.12, 0.16, 0.2, 0.25, 0.35, 0.5], colours: EAP.C.TEAL, bar: "#286B78",
      fmt: v => v.toFixed(2), tick: v => v.toFixed(2), lo: "Less like the list", hi: "More like the list",
      help: "How closely a district looks like the 30 districts on the government's 2025–2029 list of underdeveloped regions, from 0 to 1, judged from map data only (night light, terrain, land cover, sun, wind and island group). It flags places worth a closer look; it is not a measure of disadvantage. The 50 highest scores form the shortlist." },
    type: { prop: "type", title: "Landscape group", help: "Seven groups of districts with similar terrain, road access, wind and night light, found by clustering. Use them to compare similar places; they describe districts and do not rank them." },
  };

  // ---------------------------------------------------------------- helpers
  EAP.$ = id => document.getElementById(id);
  EAP.esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  EAP.fmtNum = v => { const a = Math.abs(v); return a >= 1000 ? Math.round(v).toLocaleString("en-US") : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : v.toFixed(2); };
  EAP.signed = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
  EAP.reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  EAP.narrow = () => window.matchMedia("(max-width: 820px)").matches;
  EAP.STATUS_LABEL = { current: "Currently listed (2025–2029)", graduated: "Formerly listed (2020–2024 only)", never: "Never listed" };
  EAP.STATUS_SHORT = { current: "Currently listed", graduated: "Formerly listed", never: "Never listed" };
  // 1 -> "1st", 12 -> "12th", 23 -> "23rd"
  EAP.ord = n => { const t = n % 100, s = ["th", "st", "nd", "rd"]; return n + (s[(t - 20) % 10] || s[t] || s[0]); };

  EAP.statusSentence = d => {
    if (d.on_2025 && d.on_2020) return "Currently listed: on the 2025–2029 list of underdeveloped districts, as in 2020–2024.";
    if (d.on_2025) return "Currently listed: on the 2025–2029 list of underdeveloped districts, not on the 2020–2024 list.";
    if (d.on_2020) return "Formerly listed: on the 2020–2024 list of underdeveloped districts, not on the 2025–2029 list.";
    return "Never listed: not on the 2020–2024 or the 2025–2029 list of underdeveloped districts.";
  };

  EAP.stabilityLabel = f => (f >= 0.9 ? "Very stable" : f >= 0.5 ? "Fairly stable" : f > 0 ? "Sensitive" : "Never in top 30");

  // Share of the 514 districts that have a lower value of an indicator than this value (0 to 1).
  EAP.pct = (key, v) => { const a = EAP.sorted[key]; let lo = 0; while (lo < a.length && a[lo] < v) lo++; return lo / (a.length - 1); };

  EAP.downloadCsv = (name, header, rows) => {
    const q = v => (typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v);
    const text = [header.map(q).join(",")].concat(rows.map(r => r.map(q).join(","))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // ---------------------------------------------------------------- data
  const getJson = url => fetch(url).then(r => { if (!r.ok) throw new Error(url + " " + r.status); return r.json(); });
  EAP.byCode = new Map();
  let explPromise = null, paperPromise = null;
  EAP.explanations = () => (explPromise = explPromise || getJson("data/explanations.json").then(e => (EAP.expl = e)));
  EAP.paper = () => (paperPromise = paperPromise || getJson("data/paper_numbers.json"));

  // The first view needs only the district table, the boundaries, the medians and the metadata.
  EAP.ready = Promise.all([getJson("data/districts.json"), getJson("data/medians.json"), getJson("data/meta.json"), getJson("data/districts.geojson")])
    .then(([districts, medians, meta, geo]) => {
      EAP.data = { districts, medians, meta, geo };
      districts.forEach(d => EAP.byCode.set(d.code, d));
      EAP.shortlist = districts.filter(d => d.shortlist).sort((a, b) => a.screen_rank - b.screen_rank);
      EAP.sorted = {};
      medians.forEach(m => { EAP.sorted[m.key] = districts.map(d => d.ind[m.key]).sort((a, b) => a - b); });
      geo.features.forEach(f => {
        const d = EAP.byCode.get(f.properties.code);
        f.properties = { code: d.code, need: d.need, feas: d.feas, screen: d.screen, type: d.type, short: d.shortlist ? 1 : 0, cur: d.on_2025 ? 1 : 0 };
      });
      EAP.$("data-date").textContent = "Data as of " + meta.data_date;
      EAP.explanations();                       // fetch the explanations in the background; the profile waits for them
      return EAP.data;
    });

  // ---------------------------------------------------------------- weighted score
  // Same recipe as the Streamlit app: weighted mean of the standardised components, rescaled to 0-100, ranked high to low.
  EAP.weighted = w => {
    const ds = EAP.data.districts, tot = w.reduce((a, b) => a + b, 0);
    if (tot <= 0) return null;
    const s = ds.map(d => d.comp.reduce((a, v, i) => a + w[i] * v, 0) / tot);
    const mn = Math.min(...s), mx = Math.max(...s);
    const score = s.map(v => (100 * (v - mn)) / (mx - mn));
    const order = score.map((_, i) => i).sort((a, b) => score[b] - score[a] || a - b);
    const rank = new Array(ds.length);
    order.forEach((i, r) => { rank[i] = r + 1; });
    return { score, rank, order };
  };

  // ---------------------------------------------------------------- compare list (kept for the visit)
  const KEY = "eap-compare";
  const store = {
    list: [], max: 4,
    has(c) { return this.list.includes(c); },
    add(c) { if (!this.has(c) && this.list.length < this.max) { this.list.push(c); this.save(); return true; } return false; },
    remove(c) { this.list = this.list.filter(x => x !== c); this.save(); },
    toggle(c) { if (this.has(c)) { this.remove(c); return false; } return this.add(c); },
    save() {
      try { sessionStorage.setItem(KEY, JSON.stringify(this.list)); } catch (e) { /* storage may be blocked */ }
      document.dispatchEvent(new CustomEvent("eap-compare"));
    },
    load() { try { this.list = JSON.parse(sessionStorage.getItem(KEY) || "[]").filter(c => EAP.byCode.has(c)).slice(0, this.max); } catch (e) { this.list = []; } },
  };
  EAP.compare = store;
})();
