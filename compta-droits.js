/* Droits d'accès par section de la « Comptabilité du groupe » (partagé entre la page compta-groupe.html et les Paramètres du hub).
   - Chaque section (onglet) a la liste des profils qui peuvent la voir ; l'administrateur voit toujours tout (il ne peut pas être retiré).
   - Répartition d'origine : paie réservée à l'administrateur et à la direction ; créances et dettes ouvertes au comptable ;
     états financiers et trésorerie à la direction et au directeur, pas au comptable.
   - Réglage enregistré sur l'appareil (angels_comptag_droits) : une section dont le profil est absent n'est ni affichée ni calculée pour lui. */
(function (G) {
  "use strict";
  var CLE = "angels_comptag_droits";
  var ROLES = [["admin", "Administrateur"], ["direction", "Direction générale"], ["directeur", "Directeur"], ["comptable", "Comptable"]];
  var SECTIONS = [
    { k: "synthese", i: "📊", l: "Synthèse", d: "Contrôle d'intégrité, ventes en ligne, résultat par activité", def: ["admin", "direction", "directeur", "comptable"] },
    { k: "perso", i: "👥", l: "Personnel et paie", d: "Effectifs et masse salariale", def: ["admin", "direction"] },
    { k: "creances", i: "🧾", l: "Créances et dettes", d: "Clients, fournisseurs, ancienneté, provisions", def: ["admin", "direction", "comptable"] },
    { k: "etats", i: "📈", l: "États financiers", d: "États consolidés et régularisations", def: ["admin", "direction", "directeur"] },
    { k: "treso", i: "💰", l: "Trésorerie", d: "Prévision à 13 semaines", def: ["admin", "direction", "directeur"] },
    { k: "inter", i: "🔁", l: "Entre divisions", d: "Rapprochement des opérations réciproques", def: ["admin", "direction", "comptable"] },
    { k: "plan", i: "📚", l: "Plan comptable", d: "Plan commun SYSCOHADA", def: ["admin", "direction", "comptable"] }];
  var RK = ROLES.map(function (r) { return r[0]; });
  function lireBrut() { try { var o = JSON.parse(localStorage.getItem(CLE) || "null"); return o && typeof o === "object" && o.d && typeof o.d === "object" ? o : null; } catch (e) { return null; } }
  function lire() {
    var b = lireBrut(), d = {};
    SECTIONS.forEach(function (s) {
      var L = b && Array.isArray(b.d[s.k]) ? b.d[s.k].filter(function (r) { return RK.indexOf(r) >= 0; }) : s.def.slice();
      if (L.indexOf("admin") < 0) L.unshift("admin"); d[s.k] = L;
    });
    return d;
  }
  function peut(role, k) { var L = lire()[k]; return !!L && L.indexOf(role) >= 0; }
  function sections(role) { return SECTIONS.filter(function (s) { return peut(role, s.k); }); }
  function ecrire(d, par) {
    var o = { d: {}, par: String(par || ""), le: new Date().toISOString() };
    SECTIONS.forEach(function (s) { var L = (d[s.k] || []).filter(function (r) { return RK.indexOf(r) >= 0; }); if (L.indexOf("admin") < 0) L.unshift("admin"); o.d[s.k] = L; });
    localStorage.setItem(CLE, JSON.stringify(o)); return o;
  }
  function retablir() { localStorage.removeItem(CLE); }
  function meta() { var b = lireBrut(); return b ? { par: b.par, le: b.le } : null; }
  G.ANGELS_COMPTA_DROITS = { CLE: CLE, ROLES: ROLES, SECTIONS: SECTIONS, lire: lire, peut: peut, sections: sections, ecrire: ecrire, retablir: retablir, meta: meta };
})(typeof window !== "undefined" ? window : this);
