/* Moteur de PURGE PAR DATE — pur, sans DOM (Distributions).
   Supprime les commandes, les livraisons et la caisse (sessions, mouvements, remises, réapprovisionnements, file d'attente) dont TOUTE l'activité est antérieure à une date de coupure
   (par défaut : le début de la journée d'hier, on garde donc hier et aujourd'hui). Tout le reste est conservé : clients, produits, stock, comptabilité, comptes, paramétrage, audit.
   Règles de prudence (rien n'est supprimé « à moitié ») :
   - la date d'un élément est sa DERNIÈRE activité : le plus récent de tous ses horodatages (création, historique, clôture, validation…) ; sans aucun horodatage, l'élément est CONSERVÉ ;
   - une commande liée à une livraison récente est conservée ; une livraison suit sa commande (supprimée avec elle, conservée avec elle) ;
   - une session de caisse encore ouverte, ou clôturée à partir de la coupure, est conservée avec TOUS ses mouvements ; les mouvements d'une session supprimée sont supprimés avec elle ;
   - les autres données qui référencent un élément supprimé (encaissements livreurs, retours, incidents…) sont CONSERVÉES et signalées dans l'aperçu.
   Le moteur ne touche ni au navigateur ni au serveur : l'application sauvegarde d'abord, appelle plan() pour l'aperçu puis appliquer(). */
(function (G) {
  "use strict";
  var ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
  var TITRES = { commandes: "Commandes", livraisons: "Livraisons", caisse_sessions: "Caisse : sessions", caisse_mvts: "Caisse : mouvements", caisse_remises: "Caisse : remises", caisse_reappros: "Caisse : réapprovisionnements", caisse_file: "Caisse : file d'attente" };
  var CLES = ["commandes", "livraisons", "caisse_sessions", "caisse_mvts", "caisse_remises", "caisse_reappros", "caisse_file"];

  /** Début de la journée d'hier (heure locale) : on garde hier et aujourd'hui. */
  function coupureHier(now) { var d = new Date(now == null ? Date.now() : now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1).getTime(); }
  /** Début d'une journée « AAAA-MM-JJ » (heure locale), ou null si invalide. */
  function coupureDe(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || "")); if (!m) return null; var d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d.getTime() : null; }
  function ymd(ms) { var d = new Date(ms), p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }

  /** Dernière activité : plus récent des horodatages ISO trouvés dans l'objet (profondeur 3). null si aucun. */
  function activite(o, prof) {
    var max = null, k, v, t;
    prof = prof == null ? 3 : prof;
    if (typeof o === "string") { if (ISO.test(o)) { t = Date.parse(o); return isNaN(t) ? null : t; } return null; }
    if (!o || typeof o !== "object" || prof <= 0) return null;
    for (k in o) { v = o[k]; t = activite(v, prof - 1); if (t != null && (max == null || t > max)) max = t; }
    return max;
  }
  var ancien = function (o, coupure) { var a = activite(o); return a != null && a < coupure; };
  var liste = function (S, k) { return Array.isArray(S && S[k]) ? S[k] : []; };

  /** Calcule, sans rien modifier, ce qui serait supprimé (ensembles d'identifiants par collection). */
  function calculer(S, coupure) {
    var cmds = liste(S, "commandes"), livs = liste(S, "livraisons"), sess = liste(S, "caisse_sessions"), mvts = liste(S, "caisse_mvts");
    var cmdIds = {}, cmdProtegee = {}, cmdSuppr = {}, livSuppr = {}, sessSuppr = {}, sessGarde = {}, mvtSuppr = {}, proteges = { commandes: 0 };
    cmds.forEach(function (c) { cmdIds[c.id] = true; });
    /* une commande liée à une livraison récente est protégée, même si sa propre date est ancienne */
    livs.forEach(function (l) { if (cmdIds[l.commande_id] && !ancien(l, coupure)) cmdProtegee[l.commande_id] = true; });
    cmds.forEach(function (c) { if (!ancien(c, coupure)) return; if (cmdProtegee[c.id]) proteges.commandes++; else cmdSuppr[c.id] = true; });
    /* une livraison suit sa commande ; sans commande connue, elle est jugée sur sa propre date */
    livs.forEach(function (l) { if (cmdIds[l.commande_id] ? cmdSuppr[l.commande_id] : ancien(l, coupure)) livSuppr[l.id] = true; });
    /* caisse : une session ouverte est toujours gardée ; les mouvements suivent leur session */
    sess.forEach(function (s) { if (s.statut !== "ouverte" && ancien(s, coupure)) sessSuppr[s.id] = true; else sessGarde[s.id] = true; });
    mvts.forEach(function (m) { if (sessSuppr[m.session_id] || (!sessGarde[m.session_id] && ancien(m, coupure))) mvtSuppr[m.id] = true; });
    var supprim = { commandes: cmdSuppr, livraisons: livSuppr, caisse_sessions: sessSuppr, caisse_mvts: mvtSuppr };
    ["caisse_remises", "caisse_reappros", "caisse_file"].forEach(function (k) { var m = {}; liste(S, k).forEach(function (x) { if (ancien(x, coupure)) m[x.id] = true; }); supprim[k] = m; });
    return { supprim: supprim, proteges: proteges };
  }

  /** Aperçu chiffré. coupure = ms. */
  function plan(S, coupure) {
    var c = calculer(S, coupure), groupes = [], total = 0, ids = { commande_id: c.supprim.commandes, livraison_id: c.supprim.livraisons }, liens = [], k;
    CLES.forEach(function (cle) {
      var arr = liste(S, cle), n = arr.filter(function (x) { return c.supprim[cle][x.id]; }).length;
      groupes.push({ cle: cle, titre: TITRES[cle], total: arr.length, supprimer: n, garder: arr.length - n }); total += n;
    });
    /* données conservées qui pointent vers un élément supprimé */
    for (k in S) {
      if (CLES.indexOf(k) >= 0 || !Array.isArray(S[k])) continue;
      var n2 = S[k].filter(function (x) { return x && typeof x === "object" && ((x.commande_id && ids.commande_id[x.commande_id]) || (x.livraison_id && ids.livraison_id[x.livraison_id])); }).length;
      if (n2) liens.push({ cle: k, n: n2 });
    }
    return { coupure: coupure, jour: ymd(coupure), groupes: groupes, total: total, proteges: c.proteges, liens: liens };
  }

  /** Supprime en place (les références détenues par l'application restent valides). Retourne l'aperçu appliqué. */
  function appliquer(S, coupure) {
    var p = plan(S, coupure), c = calculer(S, coupure);
    CLES.forEach(function (cle) {
      var arr = liste(S, cle), garde = arr.filter(function (x) { return !c.supprim[cle][x.id]; });
      arr.length = 0; garde.forEach(function (x) { arr.push(x); });
    });
    return p;
  }

  G.ANGELS_PURGE = { coupureHier: coupureHier, coupureDe: coupureDe, ymd: ymd, activite: activite, plan: plan, appliquer: appliquer, CLES: CLES, TITRES: TITRES };
  if (typeof module !== "undefined" && module.exports) module.exports = G.ANGELS_PURGE;
})(typeof window !== "undefined" ? window : globalThis);
