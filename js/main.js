/* Router: four views chosen by the address after "#" (map, map/<code>, rank, compare, how). */
(function () {
  "use strict";
  const EAP = window.EAP, $ = EAP.$;
  const VIEWS = { map: "Map", rank: "Rank and weights", compare: "Compare", how: "How it works" };
  const TITLE = "Energy Access Planner";

  function route() {
    const [v, arg] = location.hash.replace(/^#/, "").split("/");
    const view = VIEWS[v] ? v : "map";
    Object.keys(VIEWS).forEach(k => {
      $("view-" + k).hidden = k !== view;
      const a = $("nav-" + k); if (k === view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.title = (view === "map" ? "" : VIEWS[view] + " · ") + TITLE;
    closeMenu();
    const mod = { map: EAP.mapView, rank: EAP.rankView, compare: EAP.compareView, how: EAP.howView }[view];
    mod.show(arg);
    if (view !== "map") window.scrollTo(0, 0);
  }

  function closeMenu() { $("nav").classList.remove("open"); $("menu-btn").setAttribute("aria-expanded", "false"); }

  EAP.ready.then(() => {
    EAP.compare.load();
    EAP.compareBadge();
    $("menu-btn").addEventListener("click", () => { const o = $("nav").classList.toggle("open"); $("menu-btn").setAttribute("aria-expanded", o); });
    window.addEventListener("hashchange", route);
    route();
  }).catch(err => {
    document.body.insertAdjacentHTML("beforeend", `<p style="padding:24px">The data could not be loaded (${EAP.esc(err.message)}). Open this page through a web server, for example: python -m http.server</p>`);
    console.error(err);
  });
})();
