/* How it works: a calm reading page. Numbers in the honest-results box come from data/paper_numbers.json,
   which is copied from numbers_master.csv by scripts/22_export_web_data.py. */
(function () {
  "use strict";
  const EAP = window.EAP, $ = EAP.$, esc = EAP.esc;
  let built = false;

  EAP.howView = {
    async show() {
      if (built) return;
      built = true;
      const P = await EAP.paper(), meta = EAP.data.meta;
      const f3 = v => v.toFixed(3), f2 = v => v.toFixed(2);
      const sources = meta.sources.map(s => `<tr><td>${esc(s.theme)}</td><td>${esc(s.source)}</td><td>${esc(s.period)}</td><td>${esc(s.resolution)}</td></tr>`).join("");
      $("how-body").innerHTML = `
        <h1>How it works and its limits</h1>
        <p class="lead">This tool shows which of Indonesia's ${meta.n_districts} districts to look at first for renewable-energy access programs, such as solar home systems and village mini-grids. It is a screening aid. It does not replace local knowledge or a feasibility study.</p>

        <h2>Key terms</h2>
        <ul>
          <li><b>List of underdeveloped districts:</b> the Indonesian government's official list, renewed every five years. <b>Currently listed</b> means on the 2025–2029 list (30 districts). <b>Formerly listed</b> means on the 2020–2024 list but not the 2025–2029 list (32 districts). <b>Never listed</b> means on neither.</li>
          <li><b>Shortlist:</b> the 50 districts the tool flags first for a closer look, ordered by similarity score. Some are already listed; some are not.</li>
          <li><b>Disadvantage rank:</b> 1st means the most disadvantaged of the 514 districts. 514th means the least.</li>
        </ul>

        <h2>The data</h2>
        <p>The tool uses ${meta.sources.length} public sources, matched to the ${meta.n_districts} districts (regencies and cities). Nothing here is private or purchased. All results are calculated in advance, so this page needs no server and does not send your searches anywhere.</p>
        <div class="table-wrap"><table class="src"><thead><tr><th scope="col">Theme</th><th scope="col">Source</th><th scope="col">Period</th><th scope="col">Spatial detail</th></tr></thead><tbody>${sources}</tbody></table></div>

        <h2>How each score is made</h2>
        <h3>Access disadvantage index (0 to 100)</h3>
        <p>Four parts, each turned into a standard score and averaged with equal weights. <b>Night-time light:</b> how dark the district is at night. <b>Poverty and human development:</b> a low Human Development Index (HDI) and a high poverty rate. <b>Road access:</b> few roads and a long distance to a main road. <b>Terrain and land cover:</b> rugged terrain, dense tree cover, wetland and water, and little farmland. Higher means more disadvantaged: darker, poorer, more remote and harder to reach.</p>
        <p>The equal weights are a neutral starting point. If the four weights are drawn at random 5,000 times, the district ranking stays very similar (median rank correlation ${f2(P.need_sens_spearman_median)}). The exact top 30 does move: ${P.need_sens_top30_at_least_50pct} districts stay in the top 30 in at least half of the draws, and ${P.need_sens_top30_at_least_90pct} in at least nine of ten. The Rank and weights view lets you try your own weights.</p>
        <h3>Solar and wind resource (0 to 100)</h3>
        <p>Solar irradiance and wind speed, averaged. Higher means stronger sun and wind. It is kept apart from the disadvantage index, because a district can have strong sun and wind and little disadvantage, or the reverse.</p>
        <h3>Similarity to the underdeveloped list (0 to 1)</h3>
        <p>A blend of two tree-based models: 40% trained on the 30 currently listed districts, and 60% trained on the combined list of 62 districts (currently and formerly listed). Both use 14 map features plus the island group. The score shows how closely a district's map features resemble the listed districts. It is not a measure of disadvantage. The shortlist is the 50 districts with the highest similarity score.</p>
        <h3>Landscape group</h3>
        <p>Districts with similar terrain, roads, wind and light are grouped into seven landscape groups. The groups are exploratory. They describe, and they do not say what to do.</p>

        <h2>An honest summary of how well it works</h2>
        <div class="honest">
          <p><b>The selected model performs about as well as simple region rules.</b></p>
          <p>We score each method's top 50 with <i>balanced Recall@50</i>: half the share of the 30 currently listed districts it contains, plus half the share of the 32 formerly listed districts. The model is always tested on provinces it has not seen (province-grouped testing), with 10 repeats.</p>
          <div class="table-wrap"><table class="res"><thead><tr><th scope="col">Method</th><th scope="col" class="num">Balanced Recall@50</th></tr></thead><tbody>
            <tr><td>Selected model (the one in this tool)</td><td class="num"><b>${f3(P.S_selected_province)}</b> <span class="mut">(95% range ${f2(P.S_selected_province_lo)} to ${f2(P.S_selected_province_hi)})</span></td></tr>
            <tr><td>Papua-only rule: flag all Papua districts</td><td class="num">${f3(P.S_rule_p)}</td></tr>
            <tr><td>Island-group-only model (knows only the island group)</td><td class="num">${f3(P.S_region_only)}</td></tr>
            <tr><td>Single XGBoost model</td><td class="num">${f3(P.S_original_model)}</td></tr>
          </tbody></table></div>
          <p>None of these differences is statistically significant (p = ${f2(P.p_vs_original)} to ${f2(P.p_vs_region_only)}). The selected model is far better than chance (permutation test p = ${f3(P.p_permutation)}). Its top 50 holds about <b>${Math.round(P.current_caught_selected)} of the 30</b> currently listed and about <b>${Math.round(P.graduated_caught_selected)} of the 32</b> formerly listed districts. Most listed districts are in eastern Indonesia, which is why a simple regional rule does about as well as a model.</p>
          <p class="small">The numbers come from the paper's results table. The shortlist in this tool averages ten repeats, which makes it look slightly better than a single fair test. Its counts describe the list shown and should not be quoted as accuracy.</p>
        </div>

        <h2>What the tool cannot tell you</h2>
        <ul>
          <li><b>No household electricity or grid data.</b> The tool does not know which households already have power. Night-time light is only a rough stand-in.</li>
          <li><b>Night-time light also reflects population density.</b> A dark district may simply be sparsely populated.</li>
          <li><b>The list is concentrated in eastern Indonesia.</b> 26 of the 30 currently listed districts are in the Papua region, so any model learns a lot about location.</li>
          <li><b>The weights have not been checked with planners.</b> Use the Rank and weights view to test other choices.</li>
          <li><b>The landscape groups are exploratory.</b> They group similar districts but do not say what to do about them.</li>
          <li><b>This is a screening aid, not an investment decision.</b> It has no cost, demand or grid-extension data.</li>
        </ul>

        <h2>About this tool</h2>
        <p>Version ${esc(meta.version)}. Data as of ${esc(meta.data_date)}. Built for a research paper submitted to ICDEES 2026. The dashboard code and its precomputed data are public at <a href="https://github.com/tristangautamaa/energy-dss">github.com/tristangautamaa/energy-dss</a>.</p>`;
    },
  };
})();
