/* Mise à disposition de chauffeur et de véhicule (location avec chauffeur) — moteur commun Transport / Portail.
   Pur et sans DOM : tranches horaires, tarification (forfaits, heures et km supplémentaires, nuitées, remises longue durée), disponibilité
   (véhicule + chauffeur, tampon entre deux courses, indisponibilités), proposition d'affectation, créneaux libres, pénalités d'annulation,
   message de réservation du portail (même format que les autres demandes : [RESERVATION:base64]).
   Une réservation = des JOURS (date début → date fin) et une TRANCHE HORAIRE répétée chaque jour (ex. 3 jours, 08:00 → 18:00). */
(function (G) {
  "use strict";
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var TRANCHES = [
    { id: "matin", nom: "Matin", debut: "06:00", fin: "12:00" },
    { id: "apres_midi", nom: "Après-midi", debut: "12:00", fin: "18:00" },
    { id: "journee", nom: "Journée", debut: "08:00", fin: "18:00" },
    { id: "soiree", nom: "Soirée", debut: "18:00", fin: "23:00" },
    { id: "nuit", nom: "Nuit", debut: "22:00", fin: "06:00" }
  ];
  var BASES = { heure: "À l'heure", demi_journee: "Demi-journée", jour: "Journée", semaine: "Semaine", mois: "Mois" };
  var STATUTS = { demande: "À traiter", propose: "Proposée", confirmee: "Confirmée", en_cours: "En cours", terminee: "Terminée", annulee: "Annulée", refusee: "Refusée" };
  var BLOQUANTS = ["confirmee", "en_cours"];
  var GRILLE_ANNUL = [[48, 0], [24, 25], [0, 50]];   // [heures avant le début, % du total retenu]

  function hm(t) { var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || "")); if (!m) return null; var h = +m[1], mi = +m[2]; return h <= 23 && mi <= 59 ? h * 60 + mi : null; }
  function fmtHm(m) { m = ((m % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ":" + pad(m % 60); }
  function dateOk(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) && !isNaN(Date.parse(d + "T12:00:00Z")); }
  function ajJours(d, n) { var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function nbJours(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5) + 1; }
  function ms(d, minutes) { var p = d.split("-"); return Date.UTC(+p[0], +p[1] - 1, +p[2], 0, minutes, 0); }   // heure « murale » : pas de fuseau, on compare des heures locales entre elles
  function cut(v, n) { return String(v == null ? "" : v).trim().slice(0, n); }
  function arrondi(x) { return Math.round(x); }

  /** Durée d'une réservation : { jours, hj (heures par jour), total } ; une tranche qui finit avant son début passe minuit. */
  function duree(r) {
    var a = hm(r.h_debut), b = hm(r.h_fin), j = dateOk(r.date_debut) && dateOk(r.date_fin) ? nbJours(r.date_debut, r.date_fin) : 0;
    if (a == null || b == null || j < 1) return { jours: 0, hj: 0, total: 0 };
    var m = b > a ? b - a : b + 1440 - a, hj = m / 60;
    return { jours: j, hj: hj, total: hj * j };
  }
  /** Intervalles occupés (un par jour) : [{debut, fin}] en millisecondes « murales ». */
  function intervalles(r) {
    var a = hm(r.h_debut), b = hm(r.h_fin), d = duree(r), out = [];
    if (!d.jours) return out;
    for (var i = 0; i < d.jours; i++) { var jour = ajJours(r.date_debut, i), deb = ms(jour, a), fin = b > a ? ms(jour, b) : ms(jour, b + 1440); out.push({ debut: deb, fin: fin }); }
    return out;
  }
  function chevauche(A, B, tamponMin) {
    var t = (tamponMin || 0) * 60000;
    for (var i = 0; i < A.length; i++) for (var j = 0; j < B.length; j++) if (A[i].debut < B[j].fin + t && B[j].debut < A[i].fin + t) return true;
    return false;
  }

  /* ---------- tarification ---------- */
  /** offre : {base, prix, h_incluses, km_incl_jour, prix_h_sup, prix_km_sup, min_h, nuitee, remise_longue:[[jours,%]], acompte_pct, caution, carburant_inclus}
      r : la réservation ; opt : { km (prévus ou réels), heures (total réel), nuitees } ; retourne le détail et les totaux. */
  function devis(offre, r, opt) {
    opt = opt || {};
    var d = duree(r); if (!d.jours) throw new Error("Dates ou tranche horaire invalides");
    var L = [], hIncl = +offre.h_incluses || (offre.base === "demi_journee" ? 5 : 10), prix = +offre.prix || 0, base = 0, hsH = 0;
    var heuresReelles = opt.heures != null ? +opt.heures : d.total;
    if (offre.base === "heure") {
      var hf = Math.max(+offre.min_h || 1, Math.ceil(heuresReelles / d.jours)) * d.jours; base = hf * prix; L.push({ l: "Location avec chauffeur à l'heure", qte: hf, u: "h", pu: prix, m: arrondi(base) });
    } else if (offre.base === "semaine") {
      var s = Math.ceil(d.jours / 7); base = s * prix; L.push({ l: "Forfait semaine", qte: s, u: "sem.", pu: prix, m: arrondi(base) });
      hsH = Math.max(0, heuresReelles - d.jours * hIncl);
    } else if (offre.base === "mois") {
      var mo = Math.ceil(d.jours / 30); base = mo * prix; L.push({ l: "Forfait mois", qte: mo, u: "mois", pu: prix, m: arrondi(base) });
      hsH = Math.max(0, heuresReelles - d.jours * hIncl);
    } else {
      base = d.jours * prix; L.push({ l: offre.base === "demi_journee" ? "Forfait demi-journée" : "Forfait journée", qte: d.jours, u: "j", pu: prix, m: arrondi(base) });
      hsH = Math.max(0, heuresReelles - d.jours * hIncl);
    }
    var remPct = 0; (offre.remise_longue || []).forEach(function (x) { if (d.jours >= +x[0] && +x[1] > remPct) remPct = +x[1]; });
    var rem = arrondi(base * remPct / 100); if (rem) L.push({ l: "Remise longue durée (" + remPct + " %)", qte: 1, u: "", pu: -rem, m: -rem });
    var hs = arrondi(hsH * (+offre.prix_h_sup || 0)); if (hs > 0) L.push({ l: "Heures supplémentaires", qte: Math.round(hsH * 100) / 100, u: "h", pu: +offre.prix_h_sup || 0, m: hs });
    var kmIncl = (+offre.km_incl_jour || 0) * d.jours, kmSup = opt.km != null ? Math.max(0, +opt.km - kmIncl) : 0, ks = arrondi(kmSup * (+offre.prix_km_sup || 0));
    if (ks > 0) L.push({ l: "Kilomètres supplémentaires", qte: Math.round(kmSup), u: "km", pu: +offre.prix_km_sup || 0, m: ks });
    var nu = Math.max(0, Math.round(+opt.nuitees || 0)), nm = nu * (+offre.nuitee || 0); if (nm > 0) L.push({ l: "Indemnité de nuitée du chauffeur", qte: nu, u: "nuit", pu: +offre.nuitee || 0, m: nm });
    var total = L.reduce(function (a, x) { return a + x.m; }, 0);
    return { lignes: L, total: total, jours: d.jours, hj: d.hj, km_inclus: kmIncl, acompte: arrondi(total * (offre.acompte_pct == null ? 30 : +offre.acompte_pct) / 100), caution: +offre.caution || 0, carburant_inclus: !!offre.carburant_inclus };
  }
  /** Pénalité d'annulation selon le délai : { pct, montant, heures } */
  function penalite(total, debutMs, nowMs, grille) {
    var h = (debutMs - nowMs) / 36e5, g = (grille || GRILLE_ANNUL).slice().sort(function (a, b) { return b[0] - a[0]; }), pct = g[g.length - 1][1];
    for (var i = 0; i < g.length; i++) if (h >= g[i][0]) { pct = g[i][1]; break; }
    return { pct: pct, montant: arrondi(total * pct / 100), heures: Math.floor(h) };
  }

  /* ---------- disponibilité ---------- */
  /** data : { vehicules:[{id,type,places,dispo}], chauffeurs:[{id,nom,actif}], resas:[…], indispos:[{kind:'veh'|'chf',id,du,au}] }
      Une réservation bloque si son statut est « confirmée » ou « en cours » ; une indisponibilité bloque ses jours entiers. */
  function jourBloque(indispos, kind, id, jours) { return (indispos || []).some(function (x) { return x.kind === kind && x.id === id && jours.some(function (j) { return j >= x.du && j <= x.au; }); }); }
  function joursDe(r) { var d = duree(r), o = []; for (var i = 0; i < d.jours; i++) o.push(ajJours(r.date_debut, i)); return o; }
  function libre(data, kind, id, r, tampon, ignorer) {
    var champ = kind === "veh" ? "vehicle_id" : "driver_id", I = intervalles(r), J = joursDe(r);
    if (jourBloque(data.indispos, kind, id, J)) return false;
    return !(data.resas || []).some(function (x) { return x.id !== ignorer && x[champ] === id && BLOQUANTS.indexOf(x.statut) >= 0 && chevauche(I, intervalles(x), tampon); });
  }
  function charge(data, chfId, du, jours) {   // heures déjà prévues sur la période (équilibrage des chauffeurs)
    var fin = ajJours(du, jours - 1), h = 0;
    (data.resas || []).forEach(function (x) { if (x.driver_id === chfId && BLOQUANTS.indexOf(x.statut) >= 0 && x.date_fin >= du && x.date_debut <= fin) h += duree(x).total; });
    return h;
  }
  /** Véhicules et chauffeurs libres pour une demande, et la meilleure paire (type et places respectés, chauffeur le moins chargé). */
  function candidats(data, r, cfg) {
    cfg = cfg || {}; var tampon = cfg.tampon_min == null ? 60 : cfg.tampon_min, ign = cfg.ignorer || null;
    var V = (data.vehicules || []).filter(function (v) { return v.dispo !== false && (!r.type_vehicule || v.type === r.type_vehicule) && (!(+r.passagers > 0) || !(+v.places > 0) || +v.places >= +r.passagers) && libre(data, "veh", v.id, r, tampon, ign); });
    var C = (data.chauffeurs || []).filter(function (c) { return c.actif !== false && libre(data, "chf", c.id, r, tampon, ign); })
      .map(function (c) { return { id: c.id, nom: c.nom, charge: charge(data, c.id, r.date_debut, Math.max(1, duree(r).jours)) }; }).sort(function (a, b) { return a.charge - b.charge; });
    return { vehicules: V, chauffeurs: C, paire: V.length && C.length ? { vehicle_id: V[0].id, driver_id: C[0].id } : null };
  }
  /** Heures de départ possibles un jour donné pour une durée donnée (au pas de `pas` minutes), avec au moins une paire libre. */
  function creneauxLibres(data, q, cfg) {
    cfg = cfg || {}; var ouv = hm(cfg.ouverture || "06:00"), fer = hm(cfg.fermeture || "22:00"), pas = cfg.pas || 30, out = [], dm = Math.round((+q.duree_h || 1) * 60);
    for (var t = ouv; t + dm <= fer + 1; t += pas) {
      var r = { type_vehicule: q.type_vehicule, passagers: q.passagers, date_debut: q.date, date_fin: q.date, h_debut: fmtHm(t), h_fin: fmtHm(t + dm) };
      if (candidats(data, r, cfg).paire) out.push(fmtHm(t));
    }
    return out;
  }
  /** Plages où PLUS AUCUNE paire (véhicule du type + chauffeur) n'est libre : publié au portail, sans aucune donnée personnelle. */
  function occupation(data, type, du, jours, cfg) {
    cfg = cfg || {}; var pas = 30, res = {}, ouv = hm(cfg.ouverture || "06:00"), fer = hm(cfg.fermeture || "22:00");
    for (var i = 0; i < jours; i++) {
      var d = ajJours(du, i), plages = [], cur = null;
      for (var t = ouv; t < fer; t += pas) {
        var r = { type_vehicule: type, date_debut: d, date_fin: d, h_debut: fmtHm(t), h_fin: fmtHm(t + pas) }, ok = candidats(data, r, { tampon_min: 0 }).paire;
        if (!ok) { if (cur) cur[1] = fmtHm(t + pas); else { cur = [fmtHm(t), fmtHm(t + pas)]; plages.push(cur); } } else cur = null;
      }
      if (plages.length) res[d] = plages;
    }
    return res;
  }

  /* ---------- demande du portail ---------- */
  function b64(o) { var u = new TextEncoder().encode(JSON.stringify(o)), s = ""; for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64(t) { var s = atob(String(t).replace(/-/g, "+").replace(/_/g, "/")), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return JSON.parse(new TextDecoder().decode(u)); }
  /** Assainit une demande (texte borné, nombres bornés) : jamais de confiance dans ce qui vient du portail. */
  function assainir(d) {
    d = d && typeof d === "object" ? d : {};
    return { ref: cut(d.ref, 20).replace(/[^A-Za-z0-9_-]/g, ""), nom: cut(d.nom, 80), tel: cut(d.tel, 20), email: cut(d.email, 80), type_vehicule: cut(d.type_vehicule, 20).toLowerCase().replace(/[^a-z0-9_]/g, ""), offre_id: cut(d.offre_id, 40),
      date_debut: cut(d.date_debut, 10), date_fin: cut(d.date_fin || d.date_debut, 10), h_debut: cut(d.h_debut, 5), h_fin: cut(d.h_fin, 5), passagers: Math.max(0, Math.min(99, Math.round(+d.passagers || 0))),
      depart: cut(d.depart, 120), destination: cut(d.destination, 120), nuitees: Math.max(0, Math.min(60, Math.round(+d.nuitees || 0))), note: cut(d.note, 300), societe: cut(d.societe, 80) };
  }
  /** Contrôle d'une demande : liste d'erreurs (vide si valide). */
  function valider(d, cfg, nowMs) {
    cfg = cfg || {}; var E = [], n = nowMs == null ? Date.now() : nowMs, maxJ = cfg.max_jours || 90;
    if (!d.nom) E.push("Nom obligatoire"); if (!/^[0-9 +().-]{6,20}$/.test(d.tel || "")) E.push("Téléphone invalide");
    if (!dateOk(d.date_debut) || !dateOk(d.date_fin)) E.push("Dates invalides"); else {
      if (d.date_fin < d.date_debut) E.push("La date de fin précède le début"); else if (nbJours(d.date_debut, d.date_fin) > maxJ) E.push("Durée maximale : " + maxJ + " jours");
      var a = hm(d.h_debut); if (a != null && dateOk(d.date_debut) && ms(d.date_debut, a) < n - 36e5) E.push("Le début est déjà passé");
    }
    if (hm(d.h_debut) == null || hm(d.h_fin) == null) E.push("Tranche horaire invalide"); else if (hm(d.h_debut) === hm(d.h_fin)) E.push("La tranche horaire est vide");
    if (!d.depart) E.push("Lieu de prise en charge obligatoire");
    return E;
  }
  function construireMessage(d, org) {
    d = assainir(d);
    return "Réservation chauffeur + véhicule — " + (org || "") + " (réf. " + d.ref + ")\nNom : " + d.nom + "\nTél : " + d.tel + "\nDu " + d.date_debut.split("-").reverse().join("/") + " au " + d.date_fin.split("-").reverse().join("/") + ", de " + d.h_debut + " à " + d.h_fin + "\nPrise en charge : " + d.depart + (d.destination ? "\nDestination : " + d.destination : "") + (d.passagers ? "\nPassagers : " + d.passagers : "") + (d.note ? "\nNote : " + d.note : "") + "\n[RESERVATION:" + b64(d) + "]";
  }
  /** Extrait toutes les demandes d'un texte collé (WhatsApp, e-mail) : [{ok:demande}|{ko:message}] */
  function lireMessages(texte) {
    var out = [], re = /\[RESERVATION:([^\]\s]*)\]/g, m;
    while ((m = re.exec(String(texte || "")))) { try { out.push({ ok: assainir(unb64(m[1])) }); } catch (e) { out.push({ ko: "message illisible" }); } }
    return out;
  }

  var API = { TRANCHES: TRANCHES, BASES: BASES, STATUTS: STATUTS, BLOQUANTS: BLOQUANTS, GRILLE_ANNUL: GRILLE_ANNUL, hm: hm, fmtHm: fmtHm, dateOk: dateOk, ajJours: ajJours, nbJours: nbJours, duree: duree, intervalles: intervalles, chevauche: chevauche,
    devis: devis, penalite: penalite, libre: libre, candidats: candidats, creneauxLibres: creneauxLibres, occupation: occupation, assainir: assainir, valider: valider, construireMessage: construireMessage, lireMessages: lireMessages, b64: b64, unb64: unb64 };
  G.ANGELS_MAD = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
