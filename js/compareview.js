/* Compare view: two to four districts side by side. Districts are added from the profile or from the search box here. */
(function () {
  "use strict";
  const EAP = window.EAP, $ = EAP.$, esc = EAP.esc;
  let built = false;

  EAP.compareView = {
    show() {
      if (!built) { built = true; build(); }
      render();
    },
  };
  document.addEventListener("eap-compare", () => { if (built) render(); updateBadge(); });
  function updateBadge() { const n = EAP.compare.list.length; $("nav-compare").textContent = n ? `Compare (${n})` : "Compare"; }
  EAP.compareBadge = updateBadge;

  function build() {
    $("cmp-options").innerHTML = EAP.data.districts.slice().sort((a, b) => a.name.localeCompare(b.name))
      .map(d => `<option value="${esc(d.name)} (${esc(d.province)})"></option>`).join("");
    const add = () => {
      const v = $("cmp-input").value.trim().toLowerCase();
      const d = EAP.data.districts.find(x => `${x.name} (${x.province})`.toLowerCase() === v) || EAP.data.districts.find(x => x.name.toLowerCase() === v);
      if (!d) { $("cmp-msg").textContent = "No district matches. Pick one from the suggestions."; return; }
      if (EAP.compare.has(d.code)) { $("cmp-msg").textContent = `${d.name} is already in the comparison.`; return; }
      if (!EAP.compare.add(d.code)) { $("cmp-msg").textContent = "You can compare up to four. Remove one first."; return; }
      $("cmp-msg").textContent = ""; $("cmp-input").value = "";
    };
    $("cmp-add").addEventListener("click", add);
    $("cmp-input").addEventListener("keydown", e => { if (e.key === "Enter") add(); });
    $("cmp-out").addEventListener("click", e => { const b = e.target.closest("button[data-remove]"); if (b) EAP.compare.remove(+b.dataset.remove); });
    $("cmp-clear").addEventListener("click", () => { [...EAP.compare.list].forEach(c => EAP.compare.remove(c)); });
  }

  async function render() {
    const list = EAP.compare.list.map(c => EAP.byCode.get(c)).filter(Boolean), out = $("cmp-out");
    $("cmp-clear").hidden = list.length === 0;
    if (!list.length) {
      out.innerHTML = `<div class="empty"><h2>Nothing to compare yet</h2><p>Open a district on the map or the shortlist and choose "Add to compare", or search for one above.</p></div>`;
      return;
    }
    await EAP.explanations();
    const n = list.length, cols = `grid-template-columns: var(--lab) repeat(${n}, minmax(var(--colmin), 1fr))`;
    const row = (label, cells, cls) => `<div class="g-row ${cls || ""}" style="${cols}"><div class="g-label">${label}</div>${cells.map(c => `<div class="g-cell">${c}</div>`).join("")}</div>`;
    const head = `<div class="g-row g-head" style="${cols}"><div class="g-label"></div>${list.map(d => `
      <div class="g-cell"><a class="d-name" href="#map/${d.code}" title="${esc(d.name)}">${esc(d.name)}</a>
      <div class="d-sub"><span>${esc(d.province)}</span><span>${esc(EAP.STATUS_SHORT[d.status])}</span></div>
      <div class="d-tag">${d.shortlist ? `<span class="chip-sun">On the shortlist</span>` : ""}</div>
      <button type="button" class="btn quiet small" data-remove="${d.code}" aria-label="Remove ${esc(d.name)}">Remove</button></div>`).join("")}</div>`;
    let html = head;
    html += `<h2 class="g-h">Ranks (out of 514)</h2>`;
    html += row("Disadvantage rank", list.map(d => EAP.rankBar("need", "", d.need_rank, `${EAP.ord(d.need_rank)} · score ${d.need.toFixed(1)}`)));
    html += row("Solar and wind rank", list.map(d => EAP.rankBar("feas", "", d.feas_rank, `${EAP.ord(d.feas_rank)} · score ${d.feas.toFixed(1)}`)));
    html += row("Similarity rank", list.map(d => EAP.rankBar("screen", "", d.screen_rank, `${EAP.ord(d.screen_rank)} · score ${d.screen.toFixed(2)}`)));
    html += `<h2 class="g-h">Top reasons for the similarity score</h2>`;
    const reasons = (d, dir) => {
      const items = EAP.expl[d.code][dir];
      return items.length ? `<ul class="why-list">${items.map(b => `<li><span>${esc(b.label)}<span class="v"> ${esc(b.value)}</span></span><b>${EAP.signed(b.push)}</b></li>`).join("")}</ul>` : `<span class="mut">None</span>`;
    };
    html += row("In plain words", list.map(d => `<p class="plain">${esc(EAP.expl[d.code].text.slice(0, 2).join(" "))}</p>`));
    html += row("Raises the score", list.map(d => reasons(d, "up")));
    html += row("Lowers the score", list.map(d => reasons(d, "down")));
    html += `<h2 class="g-h">Compared with the national median</h2><p class="cap">Dot: the district. Tick: national median. Left is the lowest of 514, right the highest.</p>`;
    EAP.data.medians.forEach(m => {
      html += row(`${esc(m.label)}<span class="u">${esc(m.unit)}, median ${EAP.fmtNum(m.median)}</span>`, list.map(d => `<b>${EAP.fmtNum(d.ind[m.key])}</b>${EAP.dotLine(m.key, d.ind[m.key], m.label)}`), "ind-row");
    });
    html += `<h2 class="g-h">Landscape group</h2>`;
    html += row("Group", list.map(d => `<b>${esc(EAP.data.meta.types[d.type].name)}</b>`));
    out.innerHTML = html;
  }
})();
