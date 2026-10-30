/* ANGEL'S GROUP — Circuits rentables (taxis communaux et flotte VTC).
   Moteur pur (aucun accès au DOM ni au stockage), utilisable dans le navigateur (window.ANGELS_CIRCUIT) et sous Node (tests).

   Principe : les chauffeurs déclarent leurs courses (zone de prise en charge, heure, montant). Le « potentiel » d'une zone à une heure est la
   recette déclarée dans cette zone à cette heure, rapportée à un jour d'activité de la flotte (F par heure), lissée sur l'heure précédente et suivante,
   avec une demi-vie de 30 jours (une course récente compte plus qu'une ancienne) et un profil semaine / week-end quand il y a assez de données.
   Aucune donnée de demande n'est inventée : sans assez de courses déclarées, le moteur le dit et ne propose rien. */
(function (root, factory) { if (typeof module === "object" && module.exports) module.exports = factory(); else root.ANGELS_CIRCUIT = factory(); })(typeof self !== "undefined" ? self : this, function () {
  var MIN_TOTAL = 30, FIABLE = 20, INDICATIF = 5, DEMI_VIE_J = 30, VITESSE_URBAINE_KMH = 20, PLAGE = [5, 23];
  /* Positions approximatives (centres des zones), modifiables par le bureau */
  var ZONES_DEF = [
    { nom: "Plateau", commune: "Plateau", lat: 5.3236, lng: -4.0196 },
    { nom: "Adjamé", commune: "Adjamé", lat: 5.3600, lng: -4.0260 },
    { nom: "Attécoubé", commune: "Attécoubé", lat: 5.3380, lng: -4.0430 },
    { nom: "Treichville", commune: "Treichville", lat: 5.2960, lng: -4.0000 },
    { nom: "Marcory", commune: "Marcory", lat: 5.2990, lng: -3.9880 },
    { nom: "Koumassi", commune: "Koumassi", lat: 5.2930, lng: -3.9500 },
    { nom: "Port-Bouët", commune: "Port-Bouët", lat: 5.2540, lng: -3.9400 },
    { nom: "Aéroport", commune: "Port-Bouët", lat: 5.2610, lng: -3.9262 },
    { nom: "Cocody centre", commune: "Cocody", lat: 5.3520, lng: -3.9870 },
    { nom: "Deux-Plateaux", commune: "Cocody", lat: 5.3680, lng: -4.0000 },
    { nom: "Riviera", commune: "Cocody", lat: 5.3560, lng: -3.9560 },
    { nom: "Angré", commune: "Cocody", lat: 5.3970, lng: -3.9900 },
    { nom: "Abobo", commune: "Abobo", lat: 5.4160, lng: -4.0200 },
    { nom: "Yopougon Siporex", commune: "Yopougon", lat: 5.3450, lng: -4.0850 },
    { nom: "Yopougon Niangon", commune: "Yopougon", lat: 5.3300, lng: -4.1200 },
    { nom: "Bingerville", commune: "Bingerville", lat: 5.3560, lng: -3.8870 },
    { nom: "Anyama", commune: "Anyama", lat: 5.4950, lng: -4.0520 },
    { nom: "Songon", commune: "Songon", lat: 5.3200, lng: -4.2600 }
  ];
  var ts = function (c) { return new Date(c.t).getTime(); };
  var valide = function (c) { return c && c.zone && +c.montant > 0 && isFinite(ts(c)); };
  var heure = function (c) { return new Date(c.t).getHours(); };
  var cleJour = function (c) { var d = new Date(c.t); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
  var typeJour = function (d) { var j = new Date(d).getDay(); return j === 0 || j === 6 ? "weekend" : "semaine"; };
  var sum = function (a) { return a.reduce(function (s, x) { return s + x; }, 0); };

  function distanceKm(a, b) {
    var R = 6371, rad = function (x) { return x * Math.PI / 180; }, dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /* Tableau de potentiel : { total, jours, jour, zones:{ nom:{ pot[24], n[24], nfen[24], fiab[24] } } } */
  function tableau(courses, o) {
    o = o || {}; var now = o.now == null ? Date.now() : o.now, demi = o.demiVie || DEMI_VIE_J;
    var L = (courses || []).filter(valide), C = L, profil = null;
    if (o.jour) { var P = L.filter(function (c) { return typeJour(c.t) === o.jour; }); if (P.length >= MIN_TOTAL) { C = P; profil = o.jour; } }
    var age = function (t) { return Math.max(0, (now - t) / 864e5); }, poids = function (t) { return Math.pow(0.5, age(t) / demi); };
    var jours = {}; C.forEach(function (c) { var d = new Date(c.t); d.setHours(0, 0, 0, 0); jours[cleJour(c)] = poids(d.getTime()); });
    var D = sum(Object.keys(jours).map(function (k) { return jours[k]; })), Z = {};
    C.forEach(function (c) {
      var z = Z[c.zone] || (Z[c.zone] = { ca: new Array(24).fill(0), n: new Array(24).fill(0) }), h = heure(c);
      z.ca[h] += jours[cleJour(c)] * (+c.montant); z.n[h]++;   // même poids que le jour : une journée compte pour son âge, quelle que soit l'heure de la course
    });
    var out = {};
    Object.keys(Z).forEach(function (nom) {
      var z = Z[nom], p = z.ca.map(function (v) { return D > 0 ? v / D : 0; }), pot = [], nfen = [], fiab = [];
      for (var h = 0; h < 24; h++) {
        var a = (h + 23) % 24, b = (h + 1) % 24;
        pot[h] = 0.25 * p[a] + 0.5 * p[h] + 0.25 * p[b]; nfen[h] = z.n[a] + z.n[h] + z.n[b];
        fiab[h] = nfen[h] >= FIABLE ? "fiable" : nfen[h] >= INDICATIF ? "indicatif" : "insuffisant";
      }
      out[nom] = { pot: pot, n: z.n, nfen: nfen, fiab: fiab };
    });
    return { total: C.length, jours: Object.keys(jours).length, D: D, jour: profil, zones: out, suffisant: C.length >= MIN_TOTAL, manque: Math.max(0, MIN_TOTAL - C.length) };
  }

  /* Meilleures zones pour l'heure h : [{ zone, pot, fiab, tendance, km?, min? }] */
  function meilleures(tab, h, o) {
    o = o || {}; var max = o.max || 3, zones = o.zones || ZONES_DEF, par = {};
    zones.forEach(function (z) { par[z.nom] = z; });
    if (!tab.suffisant) return { ok: false, manque: tab.manque, liste: [] };
    var L = Object.keys(tab.zones).map(function (nom) {
      var z = tab.zones[nom], info = par[nom] || {}, p = z.pot[h], suiv = z.pot[(h + 1) % 24];
      var r = { zone: nom, commune: info.commune || "", pot: Math.round(p), fiab: z.fiab[h], tendance: suiv > p * 1.15 ? "hausse" : suiv < p * 0.85 ? "baisse" : "stable" };
      if (o.pos && info.lat != null) { r.km = Math.round(distanceKm(o.pos, info) * 10) / 10; r.min = Math.max(1, Math.round(r.km / VITESSE_URBAINE_KMH * 60)); }
      return r;
    }).filter(function (r) { return r.fiab !== "insuffisant" && r.pot > 0 && (!o.commune || r.commune === o.commune) && !(o.exclure && o.exclure.indexOf(r.zone) >= 0) && !(o.parmi && o.parmi.indexOf(r.zone) < 0); });
    L.sort(function (a, b) { return b.pot - a.pot; });
    return { ok: true, manque: 0, liste: L.slice(0, max) };
  }

  /* Meilleure zone pour chacune des n prochaines heures à partir de h0 */
  function creneaux(tab, h0, n, o) {
    var out = [];
    for (var i = 0; i < n; i++) { var h = (h0 + i) % 24, m = meilleures(tab, h, Object.assign({}, o, { max: 1 })); out.push({ h: h, meilleure: m.liste[0] || null }); }
    return out;
  }

  /* Répartition de nb taxis entre les zones à l'heure h : D'Hondt (chaque taxi de plus rapporte pot/(n+1)), plafond par zone */
  function plan(tab, h, nb, o) {
    o = o || {}; var cap = Math.max(1, Math.ceil(nb * (o.plafond || 0.4))), m = meilleures(tab, h, Object.assign({}, o, { max: 50 }));
    if (!m.ok) return { ok: false, manque: m.manque, lignes: [] };
    var A = m.liste.map(function (r) { return { zone: r.zone, pot: r.pot, fiab: r.fiab, taxis: 0 }; }), reste = nb;
    while (reste > 0) {
      var meilleur = null;
      A.forEach(function (a) { if (a.taxis < cap && (!meilleur || a.pot / (a.taxis + 1) > meilleur.pot / (meilleur.taxis + 1))) meilleur = a; });
      if (!meilleur) break; meilleur.taxis++; reste--;
    }
    return { ok: true, manque: 0, lignes: A.filter(function (a) { return a.taxis > 0; }), non_places: reste };
  }

  /* Itinéraire rentable : enchaîne n heures à partir de h0 en choisissant, heure par heure, la zone qui maximise le gain net total.
     Gain net d'une heure = potentiel de la zone × (1 − part de l'heure perdue en trajet), le trajet depuis la zone précédente (ou la position
     du chauffeur au départ) durant km / vitesse urbaine. Programmation dynamique : le meilleur enchaînement, pas seulement le meilleur choix local.
     Heure sans zone fiable : le chauffeur reste où il est (étape vide). Renvoie { ok, manque, etapes:[{h, zone, commune, pot, fiab, km, min, net, lat, lng}], net, brut } */
  function itineraire(tab, h0, n, o) {
    o = o || {}; n = Math.max(1, Math.min(12, n || 4));
    if (!tab.suffisant) return { ok: false, manque: tab.manque, etapes: [], net: 0, brut: 0 };
    var zones = o.zones || ZONES_DEF, par = {}; zones.forEach(function (z) { par[z.nom] = z; });
    var km = function (a, b) { return a && b && a.lat != null && b.lat != null ? distanceKm(a, b) : 0; };
    var etats = [{ zone: null, c: o.pos || null, val: 0, back: null, step: null }], pile = [etats];
    for (var i = 0; i < n; i++) {
      var h = (h0 + i) % 24, m = meilleures(tab, h, { max: 99, commune: o.commune, zones: zones, exclure: o.exclure, parmi: o.parmi }), suiv = [];
      if (!m.liste.length) { etats.forEach(function (e) { suiv.push({ zone: e.zone, c: e.c, val: e.val, back: e, step: { h: h, zone: null } }); }); }
      else m.liste.forEach(function (r) {
        var info = par[r.zone] || {}, c = info.lat != null ? { lat: info.lat, lng: info.lng } : null, best = null;
        etats.forEach(function (e) {
          var d = e.zone === r.zone ? 0 : km(e.c, c), min = d / VITESSE_URBAINE_KMH * 60, net = r.pot * (1 - Math.min(1, min / 60)), v = e.val + net;
          if (!best || v > best.val) best = { zone: r.zone, c: c, val: v, back: e, step: { h: h, zone: r.zone, commune: info.commune || "", pot: r.pot, fiab: r.fiab, km: Math.round(d * 10) / 10, min: Math.round(min), net: Math.round(net), lat: info.lat, lng: info.lng } };
        });
        suiv.push(best);
      });
      etats = suiv; pile.push(etats);
    }
    var fin = etats.reduce(function (a, b) { return b.val > a.val ? b : a; }), E = [];
    for (var e = fin; e && e.step; e = e.back) E.unshift(e.step);
    var brut = 0; for (var j = 0; j < n; j++) { var mj = meilleures(tab, (h0 + j) % 24, { max: 1, commune: o.commune, zones: zones, exclure: o.exclure, parmi: o.parmi }).liste[0]; if (mj) brut += mj.pot; }
    return { ok: true, manque: 0, etapes: E, net: Math.round(fin.val), brut: Math.round(brut) };
  }

  /* Regroupe les heures consécutives dans la même zone : [{ de, a, zone, commune, net, km, min, lat, lng }] */
  function regrouper(etapes) {
    var out = [];
    etapes.forEach(function (x) {
      var d = out[out.length - 1];
      if (d && x.zone && d.zone === x.zone) { d.a = x.h; d.net += x.net; }
      else if (d && !x.zone && !d.zone) d.a = x.h;
      else out.push({ de: x.h, a: x.h, zone: x.zone, commune: x.commune || "", net: x.net || 0, km: x.km || 0, min: x.min || 0, lat: x.lat, lng: x.lng, fiab: x.fiab });
    });
    return out;
  }

  /* Lignes wôrô-wôrô : une course de ligne porte { ligne_id, passagers } ; recette = passagers × tarif de la ligne.
     Rapport par ligne sur les n derniers jours : trajets, passagers, remplissage (passagers / places offertes), recette, recette par trajet, chauffeurs, meilleure heure. */
  function rapportLignes(courses, lignes, o) {
    o = o || {}; var now = o.now == null ? Date.now() : o.now, jours = o.jours || 7, depuis = now - jours * 864e5;
    return (lignes || []).map(function (l) {
      var cap = Math.max(1, +l.places || 4), C = (courses || []).filter(function (c) { return valide(c) && c.ligne_id === l.id && ts(c) >= depuis && ts(c) <= now; });
      var pass = sum(C.map(function (c) { return +c.passagers || 0; })), ca = sum(C.map(function (c) { return +c.montant; })), parH = {};
      C.forEach(function (c) { var h = heure(c); parH[h] = (parH[h] || 0) + (+c.montant); });
      var bh = Object.keys(parH).sort(function (a, b) { return parH[b] - parH[a]; })[0];
      return { ligne_id: l.id, nom: l.nom, commune: l.commune || "", tarif: +l.tarif || 0, places: cap, trajets: C.length, passagers: pass, ca: ca,
        remplissage: C.length ? Math.round(100 * pass / (C.length * cap)) : null, par_trajet: C.length ? Math.round(ca / C.length) : 0,
        chauffeurs: new Set(C.map(function (c) { return c.driver_id; })).size, meilleure_heure: bh == null ? null : +bh };
    });
  }

  /* Circulation libre intra-communale : une course { mode:"intra", commune, passagers, cap } ; rapport par commune sur n jours */
  function rapportCommunes(courses, o) {
    o = o || {}; var now = o.now == null ? Date.now() : o.now, jours = o.jours || 7, depuis = now - jours * 864e5, par = {};
    (courses || []).forEach(function (c) { if (!valide(c) || c.mode !== "intra" || !c.commune || ts(c) < depuis || ts(c) > now) return; (par[c.commune] = par[c.commune] || []).push(c); });
    return Object.keys(par).sort().map(function (k) {
      var C = par[k], pass = sum(C.map(function (c) { return +c.passagers || 0; })), cap = sum(C.map(function (c) { return +c.cap || 4; })), ca = sum(C.map(function (c) { return +c.montant; }));
      return { commune: k, trajets: C.length, passagers: pass, ca: ca, remplissage: cap ? Math.round(100 * pass / cap) : null, par_trajet: Math.round(ca / C.length), chauffeurs: new Set(C.map(function (c) { return c.driver_id; })).size };
    });
  }

  /* Rapport par chauffeur sur les n derniers jours : courses, recette, zones principales, alignement avec les zones chaudes de l'heure */
  function rapport(courses, chauffeurs, o) {
    o = o || {}; var now = o.now == null ? Date.now() : o.now, jours = o.jours || 7, depuis = now - jours * 864e5, tab = o.tab || tableau(courses, { now: now });
    var tops = {}; for (var h = 0; h < 24; h++) tops[h] = meilleures(tab, h, { max: 3 }).liste.map(function (r) { return r.zone; });
    return chauffeurs.map(function (d) {
      var C = (courses || []).filter(function (c) { return valide(c) && c.driver_id === d.id && ts(c) >= depuis && ts(c) <= now; });
      var ca = sum(C.map(function (c) { return +c.montant; })), zones = {}, cren = {};
      C.forEach(function (c) { zones[c.zone] = (zones[c.zone] || 0) + 1; var k = c.zone + "|" + heure(c); cren[k] = (cren[k] || 0) + (+c.montant); });
      var top = Object.keys(zones).sort(function (a, b) { return zones[b] - zones[a]; }).slice(0, 2);
      var bk = Object.keys(cren).sort(function (a, b) { return cren[b] - cren[a]; })[0], aligne = tab.suffisant ? C.filter(function (c) { return tops[heure(c)].indexOf(c.zone) >= 0; }).length : null;
      return { driver_id: d.id, nom: d.nom, courses: C.length, ca: ca, panier: C.length ? Math.round(ca / C.length) : 0,
        jours: new Set(C.map(cleJour)).size, zones: top, alignement: aligne == null || !C.length ? null : Math.round(100 * aligne / C.length),
        meilleur: bk ? { zone: bk.split("|")[0], h: +bk.split("|")[1], ca: cren[bk] } : null };
    });
  }

  return { ZONES_DEF: ZONES_DEF, MIN_TOTAL: MIN_TOTAL, FIABLE: FIABLE, INDICATIF: INDICATIF, PLAGE: PLAGE, tableau: tableau, meilleures: meilleures, creneaux: creneaux, plan: plan, itineraire: itineraire, rapportLignes: rapportLignes, rapportCommunes: rapportCommunes, regrouper: regrouper, rapport: rapport, distanceKm: distanceKm, typeJour: typeJour };
});
