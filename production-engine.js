/* Moteur de PASSAGE EN PRODUCTION — pur, sans DOM, commun à Distributions, Transport et Agro.
   Après la formation, les applications contiennent des données d'exercice. Ce moteur décrit, pour chaque application, ce qui est :
   - TOUJOURS CONSERVÉ : paramétrage (organisation, plan comptable, rôles et droits, barèmes, protocoles) et comptes utilisateurs ;
   - TOUJOURS VIDÉ     : l'activité (commandes, livraisons, encaissements, écritures comptables, journal d'audit, compteurs de numérotation…) ;
   - AU CHOIX          : les fichiers de base (clients, produits, flotte, personnel…), conservés ou vidés selon le groupe.
   Une clé de données qui n'est classée nulle part est CONSERVÉE et signalée (jamais effacée par oubli) ; un test impose que toutes les clés soient classées.
   Le moteur ne touche ni au navigateur ni au serveur : l'application sauvegarde d'abord, appelle plan() pour l'aperçu puis appliquer(). */
(function (G) {
  "use strict";
  var estObj = function (v) { return v && typeof v === "object" && !Array.isArray(v); };
  /** { cle: "gmao.ots" } — résout un chemin pointé : [parent, clé finale] */
  function chemin(S, c) { var p = String(c).split("."), o = S, i; for (i = 0; i < p.length - 1; i++) { if (!estObj(o[p[i]])) return null; o = o[p[i]]; } return [o, p[p.length - 1]]; }
  function lire(S, c) { var r = chemin(S, c); return r ? r[0][r[1]] : undefined; }
  function taille(v) { return Array.isArray(v) ? v.length : estObj(v) ? Object.keys(v).length : typeof v === "number" ? (v > 0 ? 1 : 0) : 0; }
  /** Remise à zéro en place (les références détenues par l'application restent valides) */
  function raz(v) {
    if (Array.isArray(v)) { v.length = 0; return v; }
    if (estObj(v)) { Object.keys(v).forEach(function (k) { delete v[k]; }); return v; }
    return typeof v === "number" ? 0 : v;
  }
  /** Compteurs de numérotation : les nombres repartent à 0, les sous-tableaux de compteurs sont vidés, la forme est conservée */
  function razSeq(o) { if (!estObj(o)) return o; Object.keys(o).forEach(function (k) { var v = o[k]; if (typeof v === "number") o[k] = 0; else if (estObj(v) || Array.isArray(v)) raz(v); }); return o; }
  /** Vide un objet dont certaines sous-clés sont des listes/tables : { a:[], b:{}, c:0 } */
  function razSous(o, sous) { if (!estObj(o)) return; sous.forEach(function (k) { if (k in o) { if (typeof o[k] === "number") o[k] = 0; else raz(o[k]); } }); }

  /* Une entrée de `cles` est soit une chaîne (chemin pointé, remise à zéro générique), soit { k, n, f } : k = chemin, n = comptage pour l'aperçu, f = remise à zéro spécifique */
  var SEQ = { k: "seq", f: function (S) { razSeq(S.seq); } };

  var PROFILS = {
    distribution: {
      nom: "Distributions",
      toujours: ["v", "config", "users", "caisses", "prestations", "test_demo"],   /* paramétrage, comptes, définition des caisses, catalogue de prestations */
      derives: ["angels_compta_distribution", "angels_portail_v1"],
      finale: function (S) { (S.produits || []).forEach(function (p) { p.stock = 0; }); },   /* plus de mouvements de stock : les quantités repartent de zéro */
      groupes: [
        { id: "activite", titre: "Activité", fixe: true, aide: "Commandes, livraisons, encaissements, caisse, stocks (mouvements), incidents, retours, paie, dépenses, tournées, ordres de maintenance, écritures comptables, journal d'audit, compteurs de numérotation.",
          cles: ["commandes", "livraisons", "fonds", "versements", "reglements", "paie", "depenses", "incidents", "retours", "stock_mvts", "tournees", "clotures", "expeditions", "collectes", "demandes", "notifs", "push_file", "reservations", "pauses", "chat", "quetes_gains", "hz_events", "attributions", "primes", "docs", "avis", "inventaires",
            "caisse_sessions", "caisse_mvts", "caisse_file", "entretiens", "pleins", "equip_mvts", "gps_hist", "pos", "test_ids", "test_corbeille", "audit", "fne_certs",
            "equip_retenues", "engin_sinistres", "alertes_suivi", "corbeille", "caisse_remises", "caisse_reappros",
            "gmao.ots", "gmao.mvts", "gmao.chk", "gmao.pp", "gmao.s5", "rh.variables", "rh.avances", "rh.conges", "rh.paies", "rh.reversements", "rh.historique", "rh.pointages", "rh.formations", "rh.candidats", "rh.missions", "rh.mobilites", "rh.declarations", "rh.seq",
            { k: "compta", n: function (S) { var c = S.compta; return c ? taille(c.nums) + taille(c.manuelles) : 0; }, f: function (S) { var c = S.compta; if (!estObj(c)) return; razSous(c, ["manuelles", "tvaliq", "snaps", "nums", "cnt", "ventil", "lettrage", "let_cnt", "exercices", "reouv"]); c.clos = ""; } },
            { k: "gmao.seq", f: function (S) { if (S.gmao) S.gmao.seq = 0; } },
            { k: "engin_assurances", l: "primes d'assurance payées", n: function (S) { return (S.engin_assurances || []).reduce(function (a, c) { return a + (c.echeances || []).filter(function (e) { return e.paye; }).length; }, 0); }, f: function (S) { (S.engin_assurances || []).forEach(function (c) { (c.echeances || []).forEach(function (e) { delete e.paye; }); }); } },
            { k: "engin_taxes", l: "taxes payées", n: function (S) { return (S.engin_taxes || []).filter(function (x) { return x.statut === "payee"; }).length; }, f: function (S) { (S.engin_taxes || []).forEach(function (x) { if (x.statut === "payee") { x.statut = "a_payer"; delete x.paye; } }); } }, SEQ] },   /* les règlements enregistrés dans les polices et taxes conservées sont de l'activité (ils génèrent des écritures) */
        { id: "clients", titre: "Clients et contrats", defaut: false, aide: "Fiches clients, forfaits et abonnements.", cles: ["clients", "forfaits", "abonnements"] },
        { id: "catalogue", titre: "Catalogue produits", defaut: false, aide: "Produits et prix. Les quantités en stock sont remises à zéro (les mouvements de stock étant vidés) : saisissez le stock réel à l'ouverture.",
          cles: ["produits"] },
        { id: "terrain", titre: "Équipe terrain et flotte", defaut: false, aide: "Livreurs (et leurs comptes), motos, équipements, assurances et taxes des engins, plans et pièces de maintenance.",
          cles: ["livreurs", "motos", "equip", "engin_assurances", "engin_taxes", "gmao.plans", "gmao.pieces", "gmao.presta"],
          apres: function (S) { var ids = {}; (S.livreurs || []).forEach(function (l) { ids[l.user_id] = 1; }); S.users = (S.users || []).filter(function (u) { return u.role !== "livreur" || ids[u.id]; }); } },
        { id: "rh", titre: "Personnel (fiches RH)", defaut: false, aide: "Employés et postes du module Ressources humaines. Bulletins, congés, avances et déclarations sont toujours vidés.", cles: ["rh.employes", "rh.postes"] },
        { id: "vendeurs", titre: "Vendeurs partenaires", defaut: false, aide: "Vendeurs partenaires et leurs comptes.", cles: ["vendeurs"],
          apres: function (S) { var ids = {}; (S.vendeurs || []).forEach(function (v) { ids[v.user_id] = 1; }); S.users = (S.users || []).filter(function (u) { return u.role !== "vendeur" || ids[u.id]; }); } }
      ]
    },
    transport: {
      nom: "Transport",
      toujours: ["fmt", "users", "perms", "settings", "tries", "accounts", "plan_v", "caisses", "periods", "plans", "mad_offres", "bq_ouv"],
      derives: ["angels_compta_transport", "angels_transport_files"],
      groupes: [
        { id: "activite", titre: "Activité", fixe: true, aide: "Contrats d'exploitation, échéances, paiements, quittances, caisse et banque, écritures comptables, dépenses, maintenance, incidents, demandes, ventes de véhicules, importations, réservations et mises à disposition, positions GPS, journal d'audit, compteurs de numérotation.",
          cles: ["contracts", "assignments", "obligations", "payments", "allocs", "receipts", "cash_sessions", "cash_mv", "bank_tx", "releve", "reappros", "exercices", "brouillard", "budgets", "tva_liq", "entries", "expenses", "maintenance", "incidents", "documents", "requests", "notifs", "attachments", "gps_pos", "gps_quar", "gps_alerts", "veh_hist",
            "mvt_pieces", "rappels", "vn", "ventes_veh", "imports", "reservations", "devis", "inventaires_vn", "declarations", "demandes_veh", "xp_produits", "xp_clients", "xp_prestataires", "xp_lots", "xp_cmd", "mad_resas", "mad_indispos", "alertes_etat", "audit", "fne_certs", "rh.variables", "rh.avances", "rh.conges", "rh.paies", "rh.reversements", "rh.historique", "rh.pointages", "rh.formations", "rh.candidats", "rh.missions", "rh.mobilites", "rh.declarations", "rh.seq", SEQ] },
        { id: "rh", titre: "Personnel (fiches RH)", defaut: false, aide: "Employés et postes du module Ressources humaines. Bulletins, congés, avances et déclarations sont toujours vidés.", cles: ["rh.employes", "rh.postes"] },
        { id: "flotte", titre: "Véhicules et chauffeurs", defaut: false, aide: "Véhicules, chauffeurs (et leurs comptes), boîtiers GPS, zones, pièces détachées.", cles: ["vehicles", "drivers", "gps_dev", "geofences", "pieces"],
          apres: function (S) { var ids = {}; (S.drivers || []).forEach(function (d) { ids[d.user_id] = 1; }); S.users = (S.users || []).filter(function (u) { return u.role !== "chauffeur" || ids[u.id]; }); } },
        { id: "tiers", titre: "Tiers (clients, fournisseurs)", defaut: false, aide: "Fiches tiers. Les tiers rattachés à un chauffeur conservé restent.", cles: ["tiers_vn",
            { k: "tiers", f: function (S) { var refs = {}; (S.drivers || []).forEach(function (d) { refs[d.id] = 1; }); var gar = (S.tiers || []).filter(function (t) { return refs[t.ref]; }); S.tiers.length = 0; gar.forEach(function (t) { S.tiers.push(t); }); } }] }
      ]
    },
    agro: {
      nom: "Agro",
      toujours: ["users", "settings", "tries", "accounts", "plan_v", "caisses", "periods", "protocoles", "nutrition"],
      derives: ["angels_compta_agro"],
      groupes: [
        { id: "activite", titre: "Activité", fixe: true, aide: "Bandes (lots), suivis quotidiens, soins, incubations, mouvements de stock, fabrications, ventes, achats, encaissements, charges, paie, conditionnement, écritures comptables, journal d'audit, compteurs de numérotation.",
          cles: ["lots", "suivis", "sorties", "soins", "traitements", "incubations", "mvts", "recettes", "fabs", "achats", "reglements", "ventes", "encaiss", "charges", "paies", "entries", "brouillard", "budgets", "tva_liq", "exercices", "cash_sessions", "cash_mv", "inventaires", "reservations", "remises", "reappros", "cond", "audit", "fne_certs",
            { k: "rapp", f: function (S) { if (estObj(S.rapp)) Object.keys(S.rapp).forEach(function (k) { raz(S.rapp[k]); }); } },
            { k: "restes_cond", f: function (S) { razSeq(S.restes_cond); } }, "rh.variables", "rh.avances", "rh.conges", "rh.paies", "rh.reversements", "rh.historique", "rh.pointages", "rh.formations", "rh.candidats", "rh.missions", "rh.mobilites", "rh.declarations", "rh.seq", SEQ] },
        { id: "base", titre: "Fournisseurs et clients", defaut: false, aide: "Fiches fournisseurs et clients.", cles: ["fournisseurs", "clients"] },
        { id: "catalogue", titre: "Produits et aliments", defaut: false, aide: "Produits finis, aliments, médicaments. Les quantités en stock repartent de zéro (mouvements vidés) : saisissez le stock réel à l'ouverture.", cles: ["produits"] },
        { id: "personnel", titre: "Personnel et bâtiments", defaut: false, aide: "Fiches du personnel (dont fiches RH) et bâtiments d'élevage. Bulletins, congés et déclarations sont toujours vidés.", cles: ["staff", "batiments", "rh.employes", "rh.postes"] }
      ]
    }
  };

  /* Script SQL du SERVEUR (Supabase) : à exécuter une fois, dans l'éditeur SQL, APRÈS la remise à zéro des applications.
     Les données des applications (sync_enreg) sont déjà vidées par la synchronisation ; ce script vide l'activité de la passerelle livreur et du portail.
     Sont CONSERVÉS : comptes livreurs et vendeurs (pg_livreurs, pg_vendeurs, pd_vendeurs), catalogue du portail, abonnements de notification (pg_push), comptes d'authentification. */
  var SQL_SERVEUR = [
    "-- ANGEL'S GROUP — passage en production : remise à zéro de l'activité côté serveur.",
    "-- À exécuter UNE FOIS, après la remise à zéro des applications (Distributions, Transport, Agro).",
    "-- Conservés : comptes livreurs et vendeurs, catalogue du portail, abonnements de notification, authentification.",
    "begin;",
    "",
    "-- Passerelle livreur : missions, événements, colis, preuves, codes de livraison, jetons de signature",
    "delete from public.pg_evenements;",
    "delete from public.pg_preuves;",
    "delete from public.pg_colis;",
    "delete from public.pg_sign_jetons;",
    "delete from public.pg_missions;            -- supprime aussi pg_codes (cascade)",
    "delete from public.pg_vendeur_cmds;",
    "delete from public.pg_vendeur_etat;",
    "",
    "-- Portail clients : demandes, suivis en direct, photos, scans",
    "delete from public.pd_demandes;",
    "delete from public.pd_lives;",
    "delete from public.pd_photos;",
    "delete from public.pd_scans;",
    "",
    "-- Appels, rapports de la direction",
    "delete from public.appel_journal;",
    "delete from public.appel_tickets;",
    "delete from public.rapport_dg;",
    "",
    "-- Synchronisation : purge des enregistrements marqués supprimés (les données vivantes sont gérées par l'application)",
    "delete from public.sync_enreg where supprime;",
    "",
    "commit;",
    "",
    "-- Contrôle : toutes ces valeurs doivent être à 0 (sauf comptes conservés)",
    "select 'pg_missions' as table_nom, count(*) from public.pg_missions",
    "union all select 'pd_demandes', count(*) from public.pd_demandes",
    "union all select 'pg_vendeur_cmds', count(*) from public.pg_vendeur_cmds",
    "union all select 'sync_enreg (vivants)', count(*) from public.sync_enreg where not supprime;",
    ""
  ].join("\n");

  function profil(app) { var p = PROFILS[app]; if (!p) throw new Error("Application inconnue : " + app); return p; }
  var cleDe = function (c) { return typeof c === "string" ? c : c.k; };
  function classees(p) { var o = {}; p.toujours.forEach(function (k) { o[k] = 1; }); p.groupes.forEach(function (g) { g.cles.forEach(function (c) { o[cleDe(c).split(".")[0]] = 1; }); }); return o; }
  /** Clés de premier niveau de l'état qui ne sont classées nulle part (conservées par prudence) */
  function inconnus(app, S) { var c = classees(profil(app)); return Object.keys(S).filter(function (k) { return !c[k]; }); }

  /** Choix par défaut : activité vidée, fichiers de base conservés. Un choix explicite { id: true } vide le groupe. */
  function choixDefaut(app, repartirDeZero) { var o = {}; profil(app).groupes.forEach(function (g) { o[g.id] = !!(g.fixe || repartirDeZero); }); return o; }
  function actif(g, choix) { return g.fixe || !!(choix && choix[g.id]); }

  /** Aperçu : pour chaque groupe, ce qui sera vidé (avec les effectifs) ; rien n'est modifié */
  function plan(app, S, choix) {
    var p = profil(app), total = 0;
    var groupes = p.groupes.map(function (g) {
      var vide = actif(g, choix), lignes = [];
      g.cles.forEach(function (c) { var k = cleDe(c), v = lire(S, k), n = typeof c === "object" && c.n ? c.n(S) : taille(v); if (v !== undefined && n > 0) lignes.push({ cle: (typeof c === "object" && c.l) || k, n: n }); });
      var n = lignes.reduce(function (a, l) { return a + l.n; }, 0); if (vide) total += n;
      return { id: g.id, titre: g.titre, aide: g.aide, fixe: !!g.fixe, vide: vide, lignes: lignes, n: n };
    });
    var gardes = p.toujours.filter(function (k) { return S[k] !== undefined; });
    return { app: app, nom: p.nom, groupes: groupes, total: total, gardes: gardes, inconnus: inconnus(app, S) };
  }

  /** Applique la remise à zéro à l'état S (en place). Renvoie { vides: {cle: n}, total }. L'appelant sauvegarde AVANT et persiste APRÈS. */
  function appliquer(app, S, choix) {
    var p = profil(app), vides = {}, total = 0;
    p.groupes.forEach(function (g) {
      if (!actif(g, choix)) return;
      g.cles.forEach(function (c) {
        var k = cleDe(c), v = lire(S, k); if (v === undefined) return;
        var n = typeof c === "object" && c.n ? c.n(S) : taille(v);
        if (typeof c === "object" && c.f) c.f(S);
        else { var r = chemin(S, k); if (typeof v === "number") r[0][r[1]] = 0; else raz(v); }
        if (n > 0) { vides[k] = (vides[k] || 0) + n; total += n; }
      });
      if (g.apres) g.apres(S);
    });
    if (p.finale) p.finale(S);
    return { vides: vides, total: total };
  }


  var E = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  /** Écran HTML commun (Transport, Agro) : o = { attr: "data-a", sauve: bool, fait: {le,par,n}|null, demo: bool, fdt: fn }.
      Actions déclenchées : prod.save, prod.tog (data-id = groupe), prod.preset (0 / 1), prod.go, prod.sql, prod.sqldl */
  function vue(app, S, choix, o) {
    o = o || {}; var a = o.attr || "data-a", pl = plan(app, S, choix), B = function (act, id, txt, cls, x) { return '<button class="btn ' + (cls || "") + '" ' + a + '="' + act + '"' + (id != null ? ' data-id="' + id + '"' : "") + (x || "") + ">" + txt + "</button>"; };
    var bd = function (t, c) { return '<span class="badge ' + c + '">' + E(t) + "</span>"; };
    return (o.fait ? '<div class="note">Passage en production déjà effectué le <b>' + E(o.fdt ? o.fdt(o.fait.le) : o.fait.le) + "</b> par " + E(o.fait.par) + " : " + o.fait.n + " enregistrement(s) vidé(s).</div>" : "") +
      (o.demo ? '<div class="note" style="color:var(--er)">⚠ Cet appareil contient des comptes ou des exemples de <b>démonstration</b>. Ce passage ne les supprime pas : depuis le Hub, « Effacer les données de démonstration » repart d\'une base vide avec l\'administrateur.</div>' : "") +
      '<div class="note">Toujours conservés : le paramétrage (organisation, plan comptable, rôles et droits, barèmes) et tous les <b>comptes utilisateurs</b>. Vidée : l\'activité (opérations, caisse, écritures comptables, journal d\'audit) ; les numéros repartent à 1.</div>' +
      "<h2>1. Sauvegarde (obligatoire)</h2><div class=\"card\"><div class=\"flex\" style=\"align-items:center;gap:10px;flex-wrap:wrap\">" + B("prod.save", null, "⬇ Télécharger la sauvegarde complète", o.sauve ? "ok" : "") + (o.sauve ? bd("✔ Sauvegarde téléchargée", "ok") : bd("Pas encore téléchargée", "wa")) + "</div><p class=\"mu sm\" style=\"margin-bottom:0\">Le fichier contient toutes les données actuelles ; il se restaure par « Restaurer » dans l'onglet Sauvegarde. Gardez-le en lieu sûr.</p></div>" +
      "<h2>2. Que faut-il vider ?</h2><div class=\"card\"><div class=\"flex\" style=\"gap:8px;flex-wrap:wrap\">" + B("prod.preset", "0", "Garder mes fichiers de base", "ghost sm") + B("prod.preset", "1", "Tout vider sauf paramétrage et comptes", "ghost sm") + "</div>" +
      pl.groupes.map(function (g) { return '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px"><input type="checkbox" ' + a + '="prod.tog" data-id="' + g.id + '" ' + (g.vide ? "checked" : "") + (g.fixe ? " disabled" : "") + ' style="width:auto;margin-top:3px"><span><b>' + E(g.titre) + "</b> " + (g.fixe ? bd("toujours vidé", "wa") : g.vide ? bd("sera vidé", "wa") : bd("conservé", "ok")) + '<br><span class="sm mu">' + E(g.aide) + "</span></span></label>"; }).join("") + "</div>" +
      "<h2>3. Aperçu</h2><div class=\"card\">" + (pl.groupes.filter(function (g) { return g.vide; }).map(function (g) { return "<p style=\"margin:0 0 8px\"><b>" + E(g.titre) + " : " + g.n + "</b><br><span class=\"sm mu\">" + (g.lignes.map(function (l) { return E(l.cle) + " " + l.n; }).join(" · ") || "rien") + "</span></p>"; }).join("") || "Rien à vider") + "</div>" +
      '<div class="flex" style="margin:12px 0;align-items:center;gap:10px;flex-wrap:wrap">' + B("prod.go", null, "🚀 Vider et passer en production…", "er", o.sauve ? "" : " disabled") + '<span class="sm mu">' + (o.sauve ? "<b>" + pl.total + "</b> enregistrement(s) seront supprimés. Action définitive." : "Téléchargez d'abord la sauvegarde (étape 1).") + "</span></div>" +
      (pl.inconnus.length ? '<div class="note">Données non classées, conservées par prudence : ' + pl.inconnus.map(E).join(", ") + ".</div>" : "") +
      "<h2>4. Serveur (Supabase)</h2><div class=\"card\"><p class=\"sm\" style=\"margin-top:0\">Vide l'activité enregistrée sur le serveur : synchronisation des postes, missions des livreurs, demandes du portail, appels, rapports, certifications FNE. Les comptes livreurs et vendeurs, le catalogue du portail et les notifications sont <b>conservés</b>. Réservé à l'administrateur : il faut le <b>code de sécurité du serveur</b> (secret RESET_CODE), la sauvegarde téléchargée et la phrase de confirmation. <b>Videz d'abord les appareils</b> : un appareil encore chargé renverrait ses données à la prochaine synchronisation.</p><div class=\"flex\" style=\"gap:8px;flex-wrap:wrap\">" + B("prod.srvapercu", null, "🔎 Voir ce que contient le serveur", "ghost") + B("prod.srvvider", null, "🗑 Vider le serveur…", "er", o.sauve ? "" : " disabled") + B("prod.sql", null, "📋 Script SQL (secours)", "ghost") + B("prod.sqldl", null, "⬇ Télécharger le script", "ghost") + "</div></div>" +
      "<h2>5. Après le passage</h2><div class=\"card\"><ol class=\"sm\" style=\"margin:0;padding-left:20px;line-height:1.7\"><li>Chaque utilisateur change son mot de passe à la première connexion (comptes de formation : réinitialisez-les ou désactivez-les).</li><li>Saisissez les soldes d'ouverture : caisse, banque, stocks.</li><li>Vérifiez le paramétrage et le plan comptable.</li><li>Faites un premier essai réel, puis relevez les écarts.</li></ol></div>";
  }


  /* ---------- Serveur (fonction « reset » de Supabase) ---------- */
  function lireLS(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  async function appelServeur(corps) {
    var u = lireLS("angels_supabase"), sy = lireLS("angels_sync"), def = G.ANGELS_PASSERELLE || {}, url = (u && u.off) ? "" : (u && u.url) || def.url || "";
    if (!sy || !sy.cle || !/^https:\/\//.test(url)) throw new Error("Serveur non configuré : renseignez l'adresse Supabase et la clé de synchronisation (Hub → Paramètres → Cloud).");
    var r, j; try { r = await fetch(String(url).replace(/\/+$/, "") + "/functions/v1/reset", { method: "POST", headers: { "Content-Type": "application/json", "x-sync-key": sy.cle }, body: JSON.stringify(corps) }); } catch (e) { throw new Error("Réseau indisponible : " + (e && e.message)); }
    try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok || j.ok === false) throw new Error(j.erreur || "Erreur serveur " + r.status);
    return j;
  }
  var serveurApercu = function () { return appelServeur({ action: "apercu" }); };
  var serveurVider = function (o) { return appelServeur({ action: "vider", code: o.code, phrase: o.phrase, par: o.par || "", sauvegarde: true }); };
  /** { table: n } → texte lisible */
  function resumeServeur(c) { var k = Object.keys(c || {}).filter(function (t) { return c[t] > 0; }); return k.length ? k.map(function (t) { return t + " : " + c[t]; }).join("\n") : "Le serveur ne contient aucune donnée d'activité."; }

  /** Remise à zéro appliquée à un poste dont le serveur a été vidé : activité vidée, fichiers de base conservés, trace d'audit et marqueur de passage en production */
  function reinitialiser(app, S, o) {
    o = o || {}; var r = appliquer(app, S, choixDefaut(app, false)), now = new Date().toISOString(), par = o.par || "Synchronisation", ref = S.config && app === "distribution" ? S.config : S.settings;
    if (ref) { ref.production = { le: now, par: par, n: r.total, serveur: true }; if (S.config && app === "distribution") S.config.mode_essai = false; }
    var detail = "Serveur remis à zéro : " + r.total + " enregistrement(s) d'exercice vidés sur ce poste";
    if (app === "distribution") { S.audit = S.audit || []; S.audit.push({ ts: now, user: par, role: "système", action: "Passage en production", detail: detail }); }
    else { S.audit = S.audit || []; S.audit.unshift({ t: now, u: par, r: "", a: "Passage en production", d: detail }); }
    return r;
  }

  /** Sauvegarde intégrale (JSON) avant la remise à zéro : horodatée, restaurable par l'import de l'application */
  function sauvegarde(app, S) { return JSON.stringify(S); }
  function nomSauvegarde(app, d) { var t = (d || new Date()).toISOString().replace(/[:T]/g, "-").slice(0, 16); return "sauvegarde-avant-production-" + app + "-" + t + ".json"; }

  G.ANGELS_PROD = { profils: PROFILS, profil: profil, inconnus: inconnus, choixDefaut: choixDefaut, plan: plan, appliquer: appliquer, sauvegarde: sauvegarde, nomSauvegarde: nomSauvegarde, vue: vue, reinitialiser: reinitialiser, serveurApercu: serveurApercu, serveurVider: serveurVider, resumeServeur: resumeServeur, SQL_SERVEUR: SQL_SERVEUR };
  if (typeof module !== "undefined" && module.exports) module.exports = G.ANGELS_PROD;
})(typeof window !== "undefined" ? window : globalThis);
