/* Small charts written by hand in SVG and HTML: rank bars, the "why" bars, and the dot-and-line indicator chart. */
(function () {
  "use strict";
  const EAP = window.EAP, esc = EAP.esc;

  // A rank out of 514 as a bar: a longer bar means a higher rank.
  // main: the rank in words; sub: an optional second line (score and what it means).
  EAP.rankBar = function (kind, label, rank, main, sub) {
    const w = Math.max(1.5, (100 * (514 - rank)) / 513);
    return `<div class="rank"><div class="top"><b>${label}</b><span>${main}</span></div>
      <div class="track" role="img" aria-label="${label || "Rank"}: ${EAP.ord(rank)} of 514"><div class="fill ${kind}" style="width:${w}%"></div></div>
      ${sub ? `<div class="read">${sub}</div>` : ""}</div>`;
  };
  // "more disadvantaged than 99% of districts", used under the profile's rank bars
  const BEATS = { need: "more disadvantaged", feas: "better sun and wind", screen: "more similar to the listed districts" };
  EAP.beats = (kind, rank) => (rank === 1 ? "the highest of 514" : `${BEATS[kind]} than ${Math.round((100 * (514 - rank)) / 513)}% of districts`);

  // One row per factor: [label and value] | bar from the centre line | number. Pushes down go left, pushes up go right.
  EAP.pushChart = function (ex) {
    const rows = [...ex.up.map(b => ({ ...b, dir: 1 })), ...ex.down.map(b => ({ ...b, dir: -1 }))];
    if (!rows.length) return "";
    const W = 372, cx = 252, half = 70, rowH = 40, top = 24;
    const maxPush = Math.max(...rows.map(b => Math.abs(b.push)));
    const H = top + rows.length * rowH;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="The biggest reasons the similarity score goes up or down">`;
    s += `<text x="${cx - 6}" y="12" text-anchor="end" font-size="12" class="mut">Lowers score</text><text x="${cx + 6}" y="12" font-size="12" class="mut">Raises score</text>`;
    rows.forEach((b, i) => {
      const y = top + i * rowH, len = Math.max(2, (Math.abs(b.push) / maxPush) * half), x = b.dir > 0 ? cx : cx - len;
      s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#E5EAED"/>`;
      s += `<text x="0" y="${y + 17}" font-size="13" font-weight="500">${esc(b.label)}</text>`;
      s += `<text x="0" y="${y + 33}" font-size="12" class="mut">${esc(b.value)}</text>`;
      s += `<rect x="${x}" y="${y + 13}" width="${len}" height="14" rx="2" fill="${b.dir > 0 ? "#3F2D75" : "#8A97A0"}"/>`;
      s += `<text x="${W}" y="${y + 25}" font-size="13" font-weight="600" text-anchor="end">${EAP.signed(b.push)}</text>`;
    });
    s += `<line x1="${cx}" x2="${cx}" y1="${top - 2}" y2="${H}" stroke="#1B2733" stroke-width="1"/></svg>`;
    return s;
  };

  // Dot-and-line chart. The track runs from the lowest to the highest district; the tick is the national median;
  // the dot is this district. Percent coordinates keep the dot round at any width.
  EAP.dotLine = function (key, v, label) {
    const p = EAP.pct(key, v), x = 2 + p * 96;
    return `<svg class="dl" width="100%" height="16" role="img" aria-label="${esc(label)}: ${Math.round(p * 100)} out of 100 districts have a lower value">
      <line x1="2%" x2="98%" y1="8" y2="8" stroke="#D3DBE0" stroke-width="1.5"/>
      <line x1="50%" x2="${x}%" y1="8" y2="8" stroke="#3F2D75" stroke-width="2"/>
      <line x1="50%" x2="50%" y1="3" y2="13" stroke="#1B2733" stroke-width="1.5"/>
      <circle cx="${x}%" cy="8" r="5" fill="#3F2D75" stroke="#fff" stroke-width="1.5"/></svg>`;
  };

  EAP.indicatorRows = function (d) {
    return EAP.data.medians.map(m => {
      const v = d.ind[m.key];
      return `<div class="ind"><div class="l1"><b>${esc(m.label)}</b><span>${EAP.fmtNum(v)} ${esc(m.unit)} <span class="med">(median ${EAP.fmtNum(m.median)})</span></span></div>${EAP.dotLine(m.key, v, m.label)}</div>`;
    }).join("");
  };
})();
