/* ANGEL'S GROUP — moteur CRM central du hub.
   Principe : UNE fiche par personne pour tout le groupe. Les clients, vendeurs partenaires, candidats et chauffeurs des trois applications
   (Distributions, Transport, Agro) sont lus (jamais modifiés) et fusionnés par numéro de téléphone ; le CRM ne garde que SON propre état :
   interactions, tâches, opportunités, étiquettes, oppositions et journal d'audit (clé locale « angels_crm_v1 »).
   Rien de ce qui est calculé (chiffre d'affaires, encours, segments) n'est enregistré : tout est dérivé des applications, donc toujours cohérent avec elles.
   Données personnelles : l'opposition à la prospection (loi ivoirienne 2013-450) exclut le contact de toute relance et de tout export marketing. */
(function (G) {
  "use strict";
  var K = "angels_crm_v1", DJ = 864e5;
  var APPS = [["distribution", "angels_erp_v1", "Distributions"], ["transport", "angels_transport_v3", "Transport"], ["agro", "angels_agro_v1", "Agro"]];
  var CFG0 = { nouveau_j: 30, fidele_n: 3, actif_j: 60, risque_j: 120, vip_f: 500000, impaye_j: 30 };
  var ETAPES = [["nouveau", "Nouveau"], ["contact", "Contacté"], ["devis", "Devis / offre"], ["negoc", "Négociation"], ["gagne", "Gagné"], ["perdu", "Perdu"]];
  var TYPES_INT = [["appel", "📞 Appel"], ["whatsapp", "💬 WhatsApp"], ["visite", "🤝 Visite"], ["email", "✉️ E-mail"], ["note", "📝 Note"]];
  var SEG = { vip: "VIP", fidele: "Fidèle", nouveau: "Nouveau", actif: "Actif", risque: "À risque", dormant: "Dormant", prospect: "Prospect", partenaire: "Partenaire" };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var R = Math.round, nowIso = function () { return new Date().toISOString(); };
  var uid = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  /* ---------- Lecture / état propre au CRM ---------- */
  function lire(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function vide() { return { v: 1, inter: [], taches: [], opps: [], tags: {}, stop: {}, relances: {}, audit: [], cfg: {} }; }
  function etat() {
    var S = lire(K) || vide();
    ["inter", "taches", "opps", "audit"].forEach(function (k) { if (!Array.isArray(S[k])) S[k] = []; });
    ["tags", "stop", "relances", "cfg"].forEach(function (k) { if (!S[k] || typeof S[k] !== "object") S[k] = {}; });
    return S;
  }
  function sauver(S) {
    S.audit = S.audit.slice(-1000); S.inter = S.inter.slice(-5000);
    try { localStorage.setItem(K, JSON.stringify(S)); return true; } catch (e) { return false; }
  }
  function cfg(S) { var c = {}; Object.keys(CFG0).forEach(function (k) { var v = +((S || etat()).cfg || {})[k]; c[k] = v > 0 ? v : CFG0[k]; }); return c; }
  function audit(S, par, action, detail) { S.audit.push({ id: uid("au"), t: nowIso(), par: par || "?", action: action, detail: String(detail || "").slice(0, 300) }); }

  /* ---------- Identité : téléphone → clé unique ---------- */
  function chiffres(t) { return String(t == null ? "" : t).replace(/\D/g, ""); }
  function cleTel(t) {
    var d = chiffres(t);
    if (d.length > 10 && d.slice(0, 3) === "225") d = d.slice(3);
    if (d.length >= 10) d = d.slice(-10);
    return d.length >= 8 ? "t" + d : "";
  }
  var norm = function (s) { return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); };
  function waLien(tel, msg) {
    var d = chiffres(tel); if (d.length < 8) return "";
    if (d.length === 10) d = "225" + d;
    return "https://wa.me/" + d + (msg ? "?text=" + encodeURIComponent(msg) : "");
  }

  /* ---------- Fiches uniques ---------- */
  function ajouter(M, app, ap, o) {
    var k = cleTel(o.tel) || cleTel(o.tel2) || (app + ":" + o.type + ":" + o.id);
    var f = M[k];
    if (!f) f = M[k] = { cle: k, noms: [], tel: "", tel2: "", apps: {}, types: {}, zone: "", achats: [], nb_cmd_cours: 0, ca: 0, encours: 0, plus_ancien_impaye: "", sources: [], lies: [] };
    if (o.nom && f.noms.indexOf(o.nom) < 0) f.noms.push(o.nom);
    if (!f.tel && o.tel) f.tel = String(o.tel); if (!f.tel2 && o.tel2) f.tel2 = String(o.tel2);
    if (!f.zone && o.zone) f.zone = o.zone;
    f.apps[app] = ap; f.types[o.type] = true;
    f.sources.push({ app: app, type: o.type, id: o.id });
    if (o.info) f.lies.push(o.info);
    (o.achats || []).forEach(function (a) { f.achats.push(a); });
    f.nb_cmd_cours += o.cours || 0; f.ca += o.ca || 0; f.encours += o.encours || 0;
    if (o.impaye && (!f.plus_ancien_impaye || o.impaye < f.plus_ancien_impaye)) f.plus_ancien_impaye = o.impaye;
    return f;
  }
  function lireDistribution(M, S) {
    var fonds = {}, divers = 0, i;
    (S.fonds || []).forEach(function (x) { if (x.commande_id && (x.type === "acompte" || x.type === "encaissement")) fonds[x.commande_id] = (fonds[x.commande_id] || 0) + (+x.montant || 0); });
    var parClient = {}, parVendeur = {};
    (S.commandes || []).forEach(function (c) {
      if (c.client_id) (parClient[c.client_id] = parClient[c.client_id] || []).push(c);
      if (c.vendeur_id) (parVendeur[c.vendeur_id] = parVendeur[c.vendeur_id] || []).push(c);
    });
    (S.clients || []).forEach(function (c) {
      if (c.divers) { divers++; return; }
      var ad = (c.adresses || []).filter(function (a) { return a.defaut; })[0] || (c.adresses || [])[0] || {};
      var o = { app: "distribution", type: "client", id: c.id, nom: c.nom, tel: c.tel, tel2: c.tel2, zone: [ad.quartier, ad.zone].filter(Boolean).join(", "), achats: [], cours: 0, ca: 0, encours: 0, impaye: "" };
      (parClient[c.id] || []).forEach(function (m) {
        var d = String(m.date || m.saisie_le || "").slice(0, 10);
        if (m.statut === "livree") {
          var t = +m.total || 0, du = Math.max(0, t - (m._paye != null ? +m._paye : (fonds[m.id] || 0)));
          o.achats.push({ app: "distribution", ref: m.numero, date: d, montant: t, du: du });
          o.ca += t; o.encours += du; if (du > 0 && (!o.impaye || d < o.impaye)) o.impaye = d;
        } else if (["annulee", "retournee", "refusee"].indexOf(m.statut) < 0) o.cours++;
      });
      ajouter(M, "distribution", "Distributions", o);
    });
    (S.vendeurs || []).forEach(function (v) {
      var L = parVendeur[v.id] || [], liv = L.filter(function (m) { return m.statut === "livree"; });
      ajouter(M, "distribution", "Distributions", { type: "vendeur", id: v.id, nom: v.nom, tel: v.tel, zone: v.adresse_collecte ? [v.adresse_collecte.quartier, v.adresse_collecte.zone].filter(Boolean).join(", ") : "", info: { app: "Distributions", lib: "Vendeur partenaire · " + L.length + " commande(s), " + liv.length + " livrée(s), commission " + (v.commission_pct != null ? v.commission_pct + " %" : "—") } });
    });
    (S.candidatures || []).forEach(function (c) {
      if (c.statut !== "attente") return;
      ajouter(M, "distribution", "Distributions", { type: "candidat", id: c.id, nom: c.nom, tel: c.tel, zone: c.ville || "", info: { app: "Distributions", lib: "Candidat vendeur partenaire (à étudier) · " + (c.activite || "activité non précisée") } });
    });
    return divers;
  }
  function lireAgro(M, S) {
    var par = {}, enc = {};
    (S.encaiss || []).forEach(function (e) { if (e.statut === "valide" && e.vente_id) enc[e.vente_id] = (enc[e.vente_id] || 0) + (+e.montant || 0); });
    (S.ventes || []).forEach(function (v) { if (v.statut === "valide") (par[v.client_id] = par[v.client_id] || []).push(v); });
    (S.clients || []).forEach(function (c) {
      var o = { type: "client", id: c.id, nom: c.nom, tel: c.tel, zone: c.ville || "", achats: [], ca: 0, encours: 0, impaye: "", info: { app: "Agro", lib: "Client Agro · " + (c.type || "—") + (c.contact ? " · contact " + c.contact : "") + (c.paie ? " · paiement " + c.paie : "") } };
      (par[c.id] || []).forEach(function (v) {
        var t = +v.total || 0, du = Math.max(0, t - (enc[v.id] || 0)), d = String(v.date || "").slice(0, 10);
        o.achats.push({ app: "agro", ref: v.numero, date: d, montant: t, du: du });
        o.ca += t; o.encours += du; if (du > 0 && (!o.impaye || d < o.impaye)) o.impaye = d;
      });
      ajouter(M, "agro", "Agro", o);
    });
  }
  function lireTransport(M, S) {
    (S.drivers || []).forEach(function (d) {
      ajouter(M, "transport", "Transport", { type: "chauffeur", id: d.id, nom: d.nom, tel: d.tel, zone: d.adresse || "", info: { app: "Transport", lib: "Chauffeur" + (d.permis_fin ? " · permis valable jusqu'au " + String(d.permis_fin).slice(0, 10) : "") } });
    });
  }

  /* ---------- Segmentation ---------- */
  function jours(d, now) { return d ? Math.floor((now - Date.parse(d + "T00:00:00Z")) / DJ) : null; }
  function segmenter(f, c, now) {
    var seg = [], achats = f.achats.length, der = f.der_achat, jd = jours(der, now), jp = jours(f.prem_achat, now);
    if (!achats) {
      if (f.types.client && f.nb_cmd_cours) seg.push("nouveau"); else if (f.types.client || f.types.candidat) seg.push("prospect");
      if (f.types.vendeur || f.types.chauffeur) seg.push("partenaire");
      return seg;
    }
    if (f.ca >= c.vip_f && jd <= c.risque_j) seg.push("vip");
    if (jp != null && jp <= c.nouveau_j && achats <= 1) seg.push("nouveau");
    else if (jd > c.risque_j) seg.push("dormant");
    else if (jd > c.actif_j) seg.push("risque");
    else if (achats >= c.fidele_n) seg.push("fidele");
    else seg.push("actif");
    if (f.types.vendeur || f.types.chauffeur) seg.push("partenaire");
    return seg;
  }

  /* contacts(now?) : toutes les fiches uniques, avec indicateurs et segments */
  function contacts(now) {
    now = now || Date.now();
    var S = etat(), c = cfg(S), M = {}, divers = 0, lus = {};
    APPS.forEach(function (a) {
      var D = lire(a[1]); if (!D) return; lus[a[0]] = true;
      if (a[0] === "distribution") divers = lireDistribution(M, D); else if (a[0] === "agro") lireAgro(M, D); else lireTransport(M, D);
    });
    var L = Object.keys(M).map(function (k) {
      var f = M[k];
      f.nom = f.noms[0] || "(sans nom)"; f.autres_noms = f.noms.slice(1);
      f.achats.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
      f.der_achat = f.achats.length ? f.achats[0].date : ""; f.prem_achat = f.achats.length ? f.achats[f.achats.length - 1].date : "";
      f.panier = f.achats.length ? R(f.ca / f.achats.length) : 0;
      f.jours_der = jours(f.der_achat, now);
      f.impaye_j = f.plus_ancien_impaye ? jours(f.plus_ancien_impaye, now) : 0;
      f.mauvais_payeur = f.encours > 0 && f.impaye_j > c.impaye_j;
      f.segments = segmenter(f, c, now);
      f.seg = f.segments[0];
      f.tags = S.tags[k] || [];
      f.stop = !!S.stop[k];
      f.derniere_relance = S.relances[k] || "";
      f.nb_inter = 0; f.der_inter = "";
      f.nom_n = norm(f.noms.join(" ")); f.tel_c = chiffres(f.tel);
      return f;
    });
    S.inter.forEach(function (x) { var f = M[x.cle]; if (f) { f.nb_inter++; if (!f.der_inter || x.t > f.der_inter) f.der_inter = x.t; } });
    L.sort(function (a, b) { return b.ca - a.ca || (a.nom < b.nom ? -1 : 1); });
    L.divers = divers; L.apps_lues = lus;
    return L;
  }

  /* ---------- Indicateurs de pilotage ---------- */
  function pilotage(L, now) {
    now = now || Date.now();
    var S = etat(), c = cfg(S), ymd = function (ms) { return new Date(ms).toISOString().slice(0, 10); };
    var d30 = ymd(now - 30 * DJ), d90 = ymd(now - 90 * DJ), d365 = ymd(now - 365 * DJ), clients = L.filter(function (f) { return f.achats.length; });
    var seg = {}; Object.keys(SEG).forEach(function (k) { seg[k] = 0; });
    L.forEach(function (f) { f.segments.forEach(function (s) { seg[s]++; }); });
    var ca12 = 0, nouveaux30 = 0, actifs90 = 0, an = 0, ancien = 0, encours = 0, nbImp = 0;
    clients.forEach(function (f) {
      f.achats.forEach(function (a) { if (a.date >= d365) ca12 += a.montant; });
      if (f.prem_achat >= d30) nouveaux30++;
      if (f.der_achat >= d90) actifs90++;
      encours += f.encours; if (f.mauvais_payeur) nbImp++;
      if (f.prem_achat < d90) { ancien++; if (f.der_achat >= d90) an++; }
    });
    var opps = S.opps.filter(function (o) { return o.etape !== "gagne" && o.etape !== "perdu"; });
    var gagnees = S.opps.filter(function (o) { return o.etape === "gagne"; }).length, perdues = S.opps.filter(function (o) { return o.etape === "perdu"; }).length;
    var auj = ymd(now), taches = S.taches.filter(function (t) { return !t.fait; });
    return {
      contacts: L.length, clients: clients.length, ca12: ca12, nouveaux30: nouveaux30, actifs90: actifs90, encours: encours, mauvais_payeurs: nbImp,
      retention: ancien ? R(an * 100 / ancien) : null, seg: seg,
      top: clients.slice().sort(function (a, b) { return b.ca - a.ca; }).slice(0, 10),
      a_relancer: relances(L, now).length,
      pipeline_n: opps.length, pipeline_val: opps.reduce(function (s, o) { return s + (+o.valeur || 0); }, 0),
      conversion: gagnees + perdues ? R(gagnees * 100 / (gagnees + perdues)) : null,
      taches_ouvertes: taches.length, taches_retard: taches.filter(function (t) { return t.echeance && t.echeance < auj; }).length, taches_jour: taches.filter(function (t) { return t.echeance === auj; }).length
    };
  }

  /* ---------- Relances : qui relancer, pourquoi, avec quel message ---------- */
  var DELAI_RELANCE = 14;
  function messageRelance(f, motif, org) {
    var p = String(f.nom).split(" ")[0] || "", o = org || "ANGEL'S GROUP";
    if (motif === "impaye") return "Bonjour " + p + ", ici " + o + ". Sauf erreur de notre part, un solde de " + f.encours.toLocaleString("fr-FR").replace(/[  ]/g, " ") + " F reste à régler. Pouvez-vous nous indiquer quand le versement sera effectué ? Merci.";
    if (motif === "dormant") return "Bonjour " + p + ", ici " + o + ". Cela fait un moment que nous ne vous avons pas servi(e). Nous avons de nouveaux arrivages : puis-je vous envoyer nos offres ?";
    if (motif === "risque") return "Bonjour " + p + ", ici " + o + ". Merci pour votre confiance. Avez-vous besoin de réapprovisionner ? Nous livrons rapidement.";
    if (motif === "candidat") return "Bonjour " + p + ", ici " + o + ". Nous avons bien reçu votre demande pour devenir vendeur partenaire. Quand pouvons-nous en parler ?";
    return "Bonjour " + p + ", ici " + o + ". Comment pouvons-nous vous aider ?";
  }
  function relances(L, now, org) {
    now = now || Date.now();
    var out = [], lim = new Date(now - DELAI_RELANCE * DJ).toISOString();
    L.forEach(function (f) {
      if (f.stop || !chiffres(f.tel) || chiffres(f.tel).length < 8) return;
      if (f.derniere_relance && f.derniere_relance > lim) return;
      var motif = f.mauvais_payeur ? "impaye" : f.seg === "dormant" ? "dormant" : f.seg === "risque" ? "risque" : f.types.candidat && !f.achats.length ? "candidat" : "";
      if (!motif) return;
      out.push({ f: f, motif: motif, priorite: motif === "impaye" ? 1 : motif === "risque" ? 2 : motif === "candidat" ? 3 : 4, msg: messageRelance(f, motif, org), lien: waLien(f.tel, messageRelance(f, motif, org)) });
    });
    return out.sort(function (a, b) { return a.priorite - b.priorite || b.f.ca - a.f.ca; });
  }

  /* ---------- Qualité des données ---------- */
  function qualite(L) {
    var sansTel = L.filter(function (f) { return chiffres(f.tel).length < 8 && !f.types.chauffeur; });
    var fusion = L.filter(function (f) { return f.noms.length > 1 && norm(f.noms[0]) !== norm(f.noms[1]); });
    var parNom = {}, memeNom = [];
    L.forEach(function (f) { if (f.nom_n.length >= 4) (parNom[f.noms.map(norm)[0]] = parNom[f.noms.map(norm)[0]] || []).push(f); });
    Object.keys(parNom).forEach(function (n) { if (parNom[n].length > 1) memeNom.push(parNom[n]); });
    var multi = L.filter(function (f) { return Object.keys(f.apps).length > 1; });
    return { sans_tel: sansTel, noms_differents: fusion, meme_nom: memeNom, multi_apps: multi };
  }

  /* ---------- Actions (état propre au CRM, toujours tracées) ---------- */
  function ctx(par) { return { S: etat(), par: par || "?" }; }
  function ajouterInteraction(par, cle, type, texte) {
    texte = String(texte || "").trim(); if (!cle) throw new Error("Contact introuvable.");
    if (!TYPES_INT.some(function (t) { return t[0] === type; })) throw new Error("Type d'échange inconnu.");
    if (texte.length < 3) throw new Error("Décrivez l'échange (3 caractères au moins).");
    var C = ctx(par), x = { id: uid("in"), cle: cle, type: type, texte: texte.slice(0, 1000), t: nowIso(), par: C.par };
    C.S.inter.push(x); audit(C.S, C.par, "Échange noté", cle + " · " + type); sauver(C.S); return x;
  }
  function ajouterTache(par, cle, titre, echeance) {
    titre = String(titre || "").trim(); if (titre.length < 3) throw new Error("Titre de la tâche trop court.");
    if (echeance && !/^\d{4}-\d{2}-\d{2}$/.test(echeance)) throw new Error("Date d'échéance invalide.");
    var C = ctx(par), t = { id: uid("ta"), cle: cle || "", titre: titre.slice(0, 200), echeance: echeance || "", fait: false, par: C.par, t: nowIso() };
    C.S.taches.push(t); audit(C.S, C.par, "Tâche créée", t.titre); sauver(C.S); return t;
  }
  function basculerTache(par, id) {
    var C = ctx(par), t = C.S.taches.filter(function (x) { return x.id === id; })[0]; if (!t) throw new Error("Tâche introuvable.");
    t.fait = !t.fait; t.fait_le = t.fait ? nowIso() : ""; audit(C.S, C.par, t.fait ? "Tâche terminée" : "Tâche rouverte", t.titre); sauver(C.S); return t;
  }
  function etiqueter(par, cle, tags) {
    var C = ctx(par), L = String(tags || "").split(/[,;]/).map(function (x) { return x.trim().slice(0, 24); }).filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; }).slice(0, 12);
    if (L.length) C.S.tags[cle] = L; else delete C.S.tags[cle];
    audit(C.S, C.par, "Étiquettes modifiées", cle + " : " + L.join(", ")); sauver(C.S); return L;
  }
  function opposer(par, cle, on) {
    var C = ctx(par); if (on) C.S.stop[cle] = nowIso(); else delete C.S.stop[cle];
    audit(C.S, C.par, on ? "Opposition à la prospection" : "Opposition levée", cle); sauver(C.S); return !!on;
  }
  function marquerRelance(par, cle, motif, quand) {
    var C = ctx(par); C.S.relances[cle] = quand || nowIso();
    C.S.inter.push({ id: uid("in"), cle: cle, type: "whatsapp", texte: "Relance envoyée (" + motif + ")", t: nowIso(), par: C.par });
    audit(C.S, C.par, "Relance", cle + " · " + motif); sauver(C.S);
  }
  function creerOpp(par, o) {
    var nom = String(o.nom || "").trim(); if (nom.length < 2) throw new Error("Nom de l'opportunité obligatoire.");
    var v = Math.round(+o.valeur || 0); if (v < 0) throw new Error("Valeur négative refusée.");
    var C = ctx(par), x = { id: uid("op"), cle: o.cle || "", nom: nom.slice(0, 120), tel: String(o.tel || "").slice(0, 20), valeur: v, source: String(o.source || "").slice(0, 60), etape: "nouveau", t: nowIso(), maj: nowIso(), par: C.par, motif: "" };
    C.S.opps.push(x); audit(C.S, C.par, "Opportunité créée", x.nom + " · " + v + " F"); sauver(C.S); return x;
  }
  function deplacerOpp(par, id, etape, motif) {
    if (!ETAPES.some(function (e) { return e[0] === etape; })) throw new Error("Étape inconnue.");
    var C = ctx(par), o = C.S.opps.filter(function (x) { return x.id === id; })[0]; if (!o) throw new Error("Opportunité introuvable.");
    if (etape === "perdu" && String(motif || "").trim().length < 3) throw new Error("Motif de perte obligatoire.");
    o.etape = etape; o.maj = nowIso(); if (etape === "perdu") o.motif = String(motif).trim().slice(0, 200);
    audit(C.S, C.par, "Opportunité " + etape, o.nom + (etape === "perdu" ? " — " + o.motif : "")); sauver(C.S); return o;
  }
  function reglages(par, v) {
    var C = ctx(par), n = {};
    Object.keys(CFG0).forEach(function (k) { var x = Math.round(+v[k]); if (!(x > 0)) throw new Error("Valeur invalide : " + k); n[k] = x; });
    if (n.actif_j >= n.risque_j) throw new Error("« Actif » doit être plus court que « À risque ».");
    C.S.cfg = n; audit(C.S, C.par, "Seuils modifiés", JSON.stringify(n)); sauver(C.S); return n;
  }

  /* ---------- Historique d'un contact : achats des applications + échanges CRM, du plus récent au plus ancien ---------- */
  function historique(f) {
    var S = etat(), L = [];
    f.achats.forEach(function (a) { L.push({ t: a.date, type: "achat", app: a.app, lib: "Achat " + a.ref + " · " + a.montant.toLocaleString("fr-FR").replace(/[  ]/g, " ") + " F" + (a.du ? " (reste " + a.du.toLocaleString("fr-FR").replace(/[  ]/g, " ") + " F)" : "") }); });
    S.inter.filter(function (x) { return x.cle === f.cle; }).forEach(function (x) { L.push({ t: x.t, type: x.type, lib: x.texte, par: x.par }); });
    return L.sort(function (a, b) { return a.t < b.t ? 1 : a.t > b.t ? -1 : 0; });
  }

  /* ---------- Export CSV (séparateur « ; », protection contre l'injection de formules) ---------- */
  function cellule(v) {
    var s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportCsv(L, marketing) {
    var H = ["Nom", "Téléphone", "Segment", "Applications", "Rôles", "Zone", "Achats", "CA (F)", "Encours (F)", "Dernier achat", "Étiquettes"];
    var rows = L.filter(function (f) { return !(marketing && f.stop); }).map(function (f) {
      return [f.nom, f.tel, SEG[f.seg] || f.seg, Object.keys(f.apps).map(function (k) { return f.apps[k]; }).join(" + "), Object.keys(f.types).join(" + "), f.zone, f.achats.length, f.ca, f.encours, f.der_achat, f.tags.join(" ")];
    });
    return "﻿" + [H].concat(rows).map(function (r) { return r.map(cellule).join(";"); }).join("\r\n");
  }

  G.ANGELS_CRM = {
    K: K, APPS: APPS, ETAPES: ETAPES, TYPES_INT: TYPES_INT, SEG: SEG, CFG0: CFG0, esc: esc,
    etat: etat, cfg: cfg, contacts: contacts, pilotage: pilotage, relances: relances, qualite: qualite, historique: historique, exportCsv: exportCsv,
    chiffres: chiffres, cleTel: cleTel, waLien: waLien, norm: norm,
    ajouterInteraction: ajouterInteraction, ajouterTache: ajouterTache, basculerTache: basculerTache, etiqueter: etiqueter, opposer: opposer,
    marquerRelance: marquerRelance, creerOpp: creerOpp, deplacerOpp: deplacerOpp, reglages: reglages
  };
})(typeof window !== "undefined" ? window : this);
