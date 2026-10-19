/* Les suites de recette s'exécutent sur les données de DÉMONSTRATION : ce module (chargé par NODE_OPTIONS=--require) active le drapeau « angels_demo »
   dans chaque contexte de navigateur. La production (aucune donnée de démonstration) est vérifiée à part par tests/production.js, lancée sans ce module. */
const pw = require(process.env.PLAYWRIGHT || "playwright");
const orig = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await orig(...a), nc = b.newContext.bind(b), np = b.newPage.bind(b);
  const init = () => { try { localStorage.setItem("angels_demo", "1"); } catch (e) { } };
  b.newContext = async (...x) => { const c = await nc(...x); await c.addInitScript(init); return c; };
  b.newPage = async (...x) => { const p = await np(...x); await p.addInitScript(init); return p; };
  return b;
};
