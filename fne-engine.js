/* Facture Normalisée Électronique (FNE, DGI Côte d'Ivoire) — moteur commun à Distributions, Transport et Agro.
   Référence : « Procédure d'interfaçage des entreprises par API » (DGI, mai 2025) : POST /external/invoices/sign (vente, bordereau d'achat) et POST /external/invoices/{id}/refund (avoir).
   Le moteur est PUR (aucun accès au DOM ni à l'état d'une application) :
   - construire()   transforme une facture de l'application en requête FNE (gabarit B2B/B2C/B2F/B2G, TVA 18 % / 9 % / exonérations, remises, moyen de paiement) ;
   - valider()      contrôle tout ce que la DGI exige AVANT d'envoyer (aucun autocollant gaspillé pour une erreur évitable) ;
   - certification() / avoirPayload() lisent et préparent les réponses (référence, jeton QR, solde d'autocollants) ;
   - simuler()      répétition locale pour la formation : même forme de réponse, jamais envoyée à la DGI, toujours marquée SIMULATION ;
   - appeler()      appel de la fonction serveur « fne » (la clé API de la DGI reste sur le serveur, jamais dans le navigateur).
   Une facture certifiée est définitive : seule une facture d'avoir certifiée la corrige. */
(function (G) {
  "use strict";
  var TAUX = { TVA: 18, TVAB: 9, TVAC: 0, TVAD: 0 };
  var CODES = ["TVA", "TVAB", "TVAC", "TVAD"];
  var TEMPLATES = { B2C: "Particulier", B2B: "Entreprise (avec NCC)", B2F: "Client étranger", B2G: "Administration publique" };
  var PAIEMENTS = { cash: "Espèces", card: "Carte bancaire", check: "Chèque", "mobile-money": "Mobile Money", transfer: "Virement", deferred: "À terme" };
  var DEVISES = ["XOF", "USD", "EUR", "JPY", "CAD", "GBP", "AUD", "CNH", "CHF", "HKD", "NZD"];
  var ENVS = { simulation: "Simulation (formation, rien n'est envoyé)", test: "Plateforme de test de la DGI", prod: "Production (valeur fiscale)" };
  var DEF = { actif: false, env: "simulation", ncc: "", etablissement: "", point_vente: "", template: "B2C", tva_zero: "TVAC", tva_export: "TVAC", tel_defaut: "", email_defaut: "", message: "", pied: "", auto: false };

  var r2 = function (n) { return Math.round((+n + Number.EPSILON) * 100) / 100; };
  var txt = function (v, n) { return String(v == null ? "" : v).trim().slice(0, n || 200); };
  var chiffres = function (v) { return String(v == null ? "" : v).replace(/\D/g, ""); };
  var estEmail = function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "")); };

  /** Réglages d'une division complétés des valeurs par défaut */
  function cfg(c) { var o = {}, k; for (k in DEF) o[k] = DEF[k]; if (c) for (k in c) if (c[k] !== undefined && c[k] !== null) o[k] = c[k]; return o; }

  /** Moyen de paiement d'une application (texte libre) → code FNE */
  function modePaiement(m) {
    var s = String(m || "").toLowerCase();
    if (PAIEMENTS[s]) return s;
    if (/terme|cr[ée]dit|diff[ée]r|non pay|impay/.test(s)) return "deferred";
    if (/wave|orange|mtn|moov|momo|mobile|money/.test(s)) return "mobile-money";
    if (/carte|card|tpe/.test(s)) return "card";
    if (/virement|banque|transfer|swift/.test(s)) return "transfer";
    if (/ch[eè]que/.test(s)) return "check";
    return "cash";
  }

  /** Code de TVA FNE pour un taux : 18 → TVA, 9 → TVAB ; 0 → exonération choisie dans les réglages (conventionnelle par défaut) */
  function codeTva(taux, c, exo) {
    var t = +taux || 0;
    if (Math.abs(t - 18) < 1e-9) return "TVA";
    if (Math.abs(t - 9) < 1e-9) return "TVAB";
    if (t === 0) return exo === "export" ? cfg(c).tva_export : cfg(c).tva_zero;
    throw new Error("Taux de TVA " + t + " % non pris en charge par la FNE (18 %, 9 % ou exonération).");
  }

  function gabarit(cl, c) {
    if (cl && TEMPLATES[cl.template]) return cl.template;
    if (cl && txt(cl.ncc)) return "B2B";
    if (cl && cl.etranger) return "B2F";
    return TEMPLATES[cfg(c).template] ? cfg(c).template : "B2C";
  }

  /** Facture de l'application → requête FNE.
      f = { numero, type:"sale"|"purchase", client:{nom,tel,email,ncc,template,etranger,vendeur}, paiement, lignes:[{ref,desc,qte,pu,remise,unite,tva_taux,code}],
            remise (montant global, dans la même unité que pu), tva_taux, prix_ttc (true : les prix saisis sont TTC), exo, devise, taux_change } */
  function construire(f, c) {
    var K = cfg(c), cl = f.client || {}, tpl = gabarit(cl, K), ttc = f.prix_ttc !== false, items = [], base = 0;
    (f.lignes || []).forEach(function (l) {
      var code = l.code || codeTva(l.tva_taux != null ? l.tva_taux : f.tva_taux, K, f.exo), t = TAUX[code];
      if (TAUX[code] === undefined) throw new Error("Code de TVA inconnu : " + code);
      var pu = +l.pu || 0, ht = ttc && t > 0 ? pu / (1 + t / 100) : pu, rem = +l.remise || 0;
      items.push({ taxes: [code], reference: txt(l.ref, 60), description: txt(l.desc, 250), quantity: +l.qte, amount: r2(ht), discount: rem, measurementUnit: txt(l.unite, 20) || "pcs" });
      base += (+l.qte || 0) * pu * (1 - rem / 100);
    });
    var glob = 0; if (+f.remise > 0 && base > 0) glob = r2(+f.remise * 100 / base);
    var dev = f.devise && f.devise !== "XOF" ? f.devise : "";
    var p = { invoiceType: f.type === "purchase" ? "purchase" : "sale", paymentMethod: modePaiement(f.paiement), template: tpl, isRne: false,
      clientCompanyName: txt(cl.nom, 120) || (tpl === "B2C" ? "Client comptoir" : ""), clientPhone: chiffres(cl.tel) || chiffres(K.tel_defaut), clientEmail: txt(cl.email, 120) || txt(K.email_defaut, 120),
      pointOfSale: txt(K.point_vente, 60), establishment: txt(K.etablissement, 120), commercialMessage: txt(K.message, 250), footer: txt(K.pied, 250),
      foreignCurrency: dev, foreignCurrencyRate: dev ? +f.taux_change || 0 : 0, items: items, discount: glob };
    if (tpl === "B2B") p.clientNcc = txt(cl.ncc, 20).toUpperCase();
    if (cl.vendeur) p.clientSellerName = txt(cl.vendeur, 80);
    return p;
  }

  /** Contrôle d'une requête : renvoie la liste des problèmes (vide = prête à être certifiée) */
  function valider(p, c) {
    var E = [], K = cfg(c);
    if (!K.ncc || !/^[0-9A-Za-z]{6,15}$/.test(K.ncc)) E.push("Numéro de compte contribuable (NCC) de l'entreprise manquant ou invalide (Paramètres → Facturation FNE).");
    if (!txt(p.pointOfSale)) E.push("Point de vente manquant (Paramètres → Facturation FNE).");
    if (!txt(p.establishment)) E.push("Établissement manquant (Paramètres → Facturation FNE).");
    if (p.invoiceType !== "sale" && p.invoiceType !== "purchase") E.push("Type de facture invalide.");
    if (!PAIEMENTS[p.paymentMethod]) E.push("Moyen de paiement invalide.");
    if (!TEMPLATES[p.template]) E.push("Gabarit de facture invalide (B2C, B2B, B2F ou B2G).");
    if (!txt(p.clientCompanyName)) E.push("Nom du client obligatoire.");
    if (!/^\d{8,15}$/.test(String(p.clientPhone || ""))) E.push("Téléphone du client obligatoire (8 à 15 chiffres) — ou renseignez un téléphone par défaut dans les réglages FNE.");
    if (!estEmail(p.clientEmail)) E.push("E-mail du client obligatoire — ou renseignez un e-mail par défaut dans les réglages FNE.");
    if (p.template === "B2B" && !/^[0-9A-Za-z]{6,15}$/.test(String(p.clientNcc || ""))) E.push("NCC du client obligatoire pour une facture entreprise (B2B).");
    if (p.foreignCurrency) { if (DEVISES.indexOf(p.foreignCurrency) < 0) E.push("Devise étrangère non reconnue."); if (!(p.foreignCurrencyRate > 0)) E.push("Taux de la devise obligatoire."); }
    if (p.template === "B2F" && p.foreignCurrency && !(p.foreignCurrencyRate > 0)) E.push("Taux de change obligatoire pour un client étranger.");
    if (!Array.isArray(p.items) || !p.items.length) E.push("La facture n'a aucune ligne.");
    (p.items || []).forEach(function (it, i) {
      var n = "Ligne " + (i + 1) + " : ";
      if (!txt(it.description)) E.push(n + "désignation obligatoire.");
      if (!(it.quantity > 0)) E.push(n + "quantité invalide.");
      if (!(it.amount >= 0) || !isFinite(it.amount)) E.push(n + "prix unitaire hors taxe invalide.");
      if (!(it.discount >= 0 && it.discount <= 100)) E.push(n + "remise invalide (0 à 100 %).");
      if (!Array.isArray(it.taxes) || !it.taxes.length || it.taxes.some(function (t) { return CODES.indexOf(t) < 0; })) E.push(n + "code de TVA invalide.");
    });
    if (!(p.discount >= 0 && p.discount <= 100)) E.push("Remise globale invalide (0 à 100 %).");
    if (p.items && p.items.length && totaux(p).ht <= 0) E.push("Le montant de la facture est nul.");
    return E;
  }

  /** Totaux calculés localement (même règle que la DGI : remise ligne puis remise globale, TVA par ligne) */
  function totaux(p) {
    var ht = 0, tva = 0, g = 1 - (+p.discount || 0) / 100;
    (p.items || []).forEach(function (it) {
      var h = (+it.quantity || 0) * (+it.amount || 0) * (1 - (+it.discount || 0) / 100) * g, t = TAUX[(it.taxes || [])[0]] || 0;
      ht += h; tva += h * t / 100;
    });
    return { ht: Math.round(ht), tva: Math.round(tva), ttc: Math.round(ht + tva) };
  }

  /** Réponse du serveur (ou de la simulation) → enregistrement de certification */
  function certification(rep, extra) {
    var r = rep || {}, inv = r.invoice || {}, items = (inv.items || []).map(function (i) { return { id: i.id, quantity: +i.quantity, reference: i.reference || "", description: i.description || "", amount: +i.amount }; });
    var o = { statut: "certifiee", ref: r.reference, token: r.token, ncc: r.ncc, dgi_id: inv.id || null, items: items, montant_dgi: inv.amount != null ? Math.round(+inv.amount) : null, tva_dgi: inv.vatAmount != null ? Math.round(+inv.vatAmount) : null,
      solde_stickers: r.balance_sticker != null ? +r.balance_sticker : null, alerte_stickers: !!r.warning, env: (extra && extra.env) || "simulation", ts: new Date().toISOString() };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  /** Écart entre le total local et le total retenu par la DGI (arrondis de TVA) : avertissement si plus de 1 F par ligne */
  function ecart(cert, p) { if (cert.montant_dgi == null) return 0; var d = cert.montant_dgi - totaux(p).ttc; return Math.abs(d) <= Math.max(1, (p.items || []).length) ? 0 : d; }

  /** Avoir : quantités à rendre par ligne de la facture certifiée → requête FNE. qtes = [{index|id, quantity}] ; deja = avoirs déjà certifiés sur cette facture */
  function avoirPayload(cert, qtes, deja) {
    if (!cert || cert.statut !== "certifiee" || !cert.dgi_id) throw new Error("La facture n'est pas certifiée : aucun avoir FNE possible.");
    var res = reste(cert, deja), out = [];
    (qtes || []).forEach(function (q) {
      var it = typeof q.index === "number" ? cert.items[q.index] : cert.items.filter(function (x) { return x.id === q.id; })[0];
      if (!it) throw new Error("Ligne de facture introuvable.");
      var n = +q.quantity; if (!(n > 0)) return;
      if (n > res[it.id] + 1e-9) throw new Error("« " + (it.description || it.reference) + " » : maximum " + res[it.id] + " à rendre.");
      out.push({ id: it.id, quantity: n });
    });
    if (!out.length) throw new Error("Indiquez au moins une quantité à rendre.");
    return { id: cert.dgi_id, items: out };
  }
  /** Quantités encore rendables par ligne : { idLigne: reste } */
  function reste(cert, deja) {
    var r = {}; (cert.items || []).forEach(function (i) { r[i.id] = i.quantity; });
    (deja || []).forEach(function (a) { (a.items || []).forEach(function (i) { if (r[i.id] != null) r[i.id] = Math.max(0, r[i.id] - i.quantity); }); });
    return r;
  }

  /** Montant TTC d'un avoir, au prorata des quantités rendues (base : la requête de la facture) */
  function montantAvoir(p, cert, rendus) {
    var tot = 0, g = 1 - (+p.discount || 0) / 100;
    (rendus || []).forEach(function (q) {
      var i = (cert.items || []).findIndex(function (x) { return x.id === q.id; }), it = p.items[i]; if (!it) return;
      tot += q.quantity * it.amount * (1 - (it.discount || 0) / 100) * g * (1 + (TAUX[it.taxes[0]] || 0) / 100);
    });
    return Math.round(tot);
  }

  /** Répétition locale (formation) : réponse de même forme que celle de la DGI, jamais envoyée ; référence marquée SIM */
  function simuler(p, n, ident) {
    var t = totaux(p), an = String(new Date().getFullYear()).slice(2), ref = "SIM" + an + String(n).padStart(9, "0"), id = "sim-" + (ident || n);
    return { ncc: "SIMULATION", reference: ref, token: "simulation://" + ref, warning: false, balance_sticker: 999,
      invoice: { id: id, amount: t.ttc, vatAmount: t.tva, items: p.items.map(function (it, i) { return { id: id + "-" + i, quantity: it.quantity, reference: it.reference, description: it.description, amount: it.amount }; }) } };
  }
  function simulerAvoir(av, n) { var an = String(new Date().getFullYear()).slice(2); return { ncc: "SIMULATION", reference: "SIMA" + an + String(n).padStart(8, "0"), token: "simulation://avoir", warning: false, balance_sticker: 999 }; }

  /* ---------- Appel du serveur ---------- */
  function lire(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function connexion() {
    var u = lire("angels_supabase"), s = lire("angels_sync"), def = G.ANGELS_PASSERELLE || {}, url = (u && u.off) ? "" : (u && u.url) || def.url || "";
    if (!s || !s.cle || !/^https:\/\//.test(url)) return null;
    return { fn: String(url).replace(/\/+$/, "") + "/functions/v1/fne", cle: s.cle };
  }
  /** corps = { action, app, env, cle?, payload? } → réponse JSON du serveur (lève une erreur lisible) */
  async function appeler(corps, ms) {
    var c = connexion(); if (!c) throw new Error("Serveur non configuré : renseignez l'adresse Supabase et la clé de synchronisation (Hub → Paramètres → Cloud) ou travaillez en simulation.");
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, ms || 40000), r, j;
    try { r = await fetch(c.fn, { method: "POST", headers: { "Content-Type": "application/json", "x-sync-key": c.cle }, body: JSON.stringify(corps), signal: ctl.signal }); }
    catch (e) { clearTimeout(to); var err = new Error(e && e.name === "AbortError" ? "Délai dépassé : l'état de la certification est incertain. Réessayez : le serveur ne certifiera pas deux fois." : "Réseau indisponible : " + (e && e.message)); err.incertain = true; throw err; }
    clearTimeout(to);
    try { j = await r.json(); } catch (e) { j = {}; }
    if (!r.ok || j.ok === false) { var er = new Error(j.erreur || ("Erreur serveur " + r.status)); er.statut = r.status; er.detail = j; if (j.incertain) er.incertain = true; throw er; }
    return j;
  }


  /* ---------- Orchestration par application ----------
     host = { app:"distribution"|"transport"|"agro", state:()=>S, cfg:()=>réglages FNE, save:()=>…, audit:(action,detail)=>…, user:()=>nom }
     Les certifications sont conservées dans S.fne_certs (tableau d'enregistrements). Un enregistrement « en_cours » est créé AVANT l'appel : un double clic ou un second poste ne peut pas consommer deux autocollants. */
  function moteur(host) {
    var L = function () { var S = host.state(); S.fne_certs = S.fne_certs || []; return S.fne_certs; };
    var clef = function (src) { return host.app + ":" + src.type + ":" + src.id; };
    var memes = function (a, b) { return a.src.type === b.type && a.src.id === b.id; };
    var K = function () { return cfg(host.cfg()); };
    var envServeur = function (e) { return e === "prod" ? "prod" : "test"; };
    var uid = function () { return "fn" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); };
    /** dernière certification de la facture (la plus récente), tous environnements */
    function cert(src) { var a = L().filter(function (c) { return c.kind === "facture" && memes(c, src); }); return a.length ? a[a.length - 1] : null; }
    /** certification valable dans l'environnement courant (une simulation ou un essai ne vaut rien en production) */
    function valable(src) { var c = cert(src), e = K().env; return c && c.statut === "certifiee" && (c.env === e) ? c : null; }
    function avoirs(c) { return L().filter(function (a) { return a.kind === "avoir" && a.parent === c.id && a.statut === "certifiee"; }); }
    function nSim() { return L().filter(function (c) { return c.env === "simulation"; }).length + 1; }
    function pret() { var k = K(); if (!k.actif) throw new Error("La facturation FNE n'est pas activée (Paramètres → Facturation FNE)."); return k; }

    async function certifier(src, facture, opt) {
      opt = opt || {}; var k = pret(), ex = valable(src);
      if (ex) return ex;
      var p = construire(facture, k), E = valider(p, k); if (E.length) throw new Error(E.join("\n"));
      var cur = cert(src), enc = cur && cur.statut === "en_cours" && Date.now() - new Date(cur.ts).getTime() < 90000;
      if (enc) throw new Error("Certification déjà en cours pour cette facture : patientez quelques secondes.");
      if (cur && cur.statut === "incertain" && cur.env === k.env && k.env !== "simulation" && !opt.forcer) { var e0 = new Error("Résultat incertain : vérifiez sur la plateforme FNE que cette facture n'y figure pas, puis confirmez le renvoi."); e0.incertain = true; throw e0; }
      var rec = (cur && cur.env === k.env && cur.statut !== "certifiee") ? cur : { id: uid(), kind: "facture", src: { type: src.type, id: src.id } };
      Object.assign(rec, { statut: "en_cours", env: k.env, ts: new Date().toISOString(), par: host.user(), numero: facture.numero, req: p, template: p.template, erreur: "" });
      if (L().indexOf(rec) < 0) L().push(rec); host.save();
      try {
        var rep;
        if (k.env === "simulation") rep = simuler(p, nSim(), rec.id);
        else { var r = await appeler({ action: "signer", app: host.app, env: envServeur(k.env), cle_doc: clef(src), payload: p, forcer: !!opt.forcer }); rep = r.reponse; }
        var c = certification(rep, { env: k.env, par: host.user(), numero: facture.numero, template: p.template, montant_local: totaux(p).ttc });
        c.ecart = ecart(c, p); Object.assign(rec, c, { erreur: "" }); host.save();
        host.audit("Facture certifiée FNE" + (k.env === "prod" ? "" : " (" + k.env + ")"), facture.numero + " — " + rec.ref);
        return rec;
      } catch (e) {
        rec.statut = e.incertain ? "incertain" : "echec"; rec.erreur = String(e.message || e).slice(0, 300); host.save(); throw e;
      }
    }

    async function avoir(src, qtes, motif, opt) {
      opt = opt || {}; var k = pret(), c = valable(src); if (!c) throw new Error("Facture non certifiée dans cet environnement : aucun avoir FNE possible.");
      if (!String(motif || "").trim()) throw new Error("Motif de l'avoir obligatoire.");
      var av = avoirPayload(c, qtes, avoirs(c)), rec = { id: uid(), kind: "avoir", parent: c.id, src: { type: src.type, id: src.id }, statut: "en_cours", env: k.env, ts: new Date().toISOString(), par: host.user(), motif: String(motif).trim().slice(0, 200), numero: c.numero, items: av.items };
      L().push(rec); host.save();
      var cle = clef(src) + ":avoir:" + (avoirs(c).length + 1) + ":" + av.items.map(function (i) { return i.id.slice(0, 6) + i.quantity; }).join("");
      try {
        var rep;
        if (k.env === "simulation") rep = simulerAvoir(av, L().filter(function (x) { return x.kind === "avoir"; }).length);
        else { var r = await appeler({ action: "avoir", app: host.app, env: envServeur(k.env), cle_doc: cle, id: av.id, items: av.items, forcer: !!opt.forcer }); rep = r.reponse; }
        Object.assign(rec, { statut: "certifiee", ref: rep.reference, token: rep.token, ncc: rep.ncc, solde_stickers: rep.balance_sticker, alerte_stickers: !!rep.warning, montant: montantAvoir(c.req, c, av.items), cle_doc: cle });
        host.save(); host.audit("Avoir certifié FNE", c.numero + " — " + rec.ref); return rec;
      } catch (e) { rec.statut = e.incertain ? "incertain" : "echec"; rec.erreur = String(e.message || e).slice(0, 300); rec.cle_doc = cle; host.save(); throw e; }
    }
    /** état de la connexion au serveur et aux clés (hors simulation) */
    async function diagnostic() { var k = K(); if (k.env === "simulation") return { ok: true, configure: true, simulation: true }; return appeler({ action: "etat", app: host.app, env: envServeur(k.env) }); }
    return { certifier: certifier, avoir: avoir, cert: cert, valable: valable, avoirs: avoirs, diagnostic: diagnostic, cfg: K };
  }


  var E = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  /** Écran de réglages commun (Transport, Agro) : champs #f_*, actions fne.save / fne.test (attribut o.attr, défaut data-a) */
  function parametresHtml(c, o) {
    o = o || {}; var k = cfg(c), a = o.attr || "data-a", opt = function (m, sel) { return Object.keys(m).map(function (v) { return '<option value="' + v + '" ' + (v === sel ? "selected" : "") + ">" + E(m[v]) + "</option>"; }).join(""); };
    var f = function (id, lab, val) { return '<label>' + lab + '<input id="' + id + '" value="' + E(val) + '"></label>'; };
    return '<div class="card"><div class="note">Facture normalisée électronique de la DGI (Côte d\'Ivoire). Les factures <b>simples</b> restent disponibles à tout moment. La clé API de la DGI n\'est <b>jamais</b> saisie ici : elle est gardée sur le serveur (secrets Supabase).</div>' +
      '<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="f_actif" style="width:auto" ' + (k.actif ? "checked" : "") + '> Activer la facturation FNE</label>' +
      '<div class="g2"><label>Environnement<select id="f_env">' + opt(ENVS, k.env) + "</select></label>" + f("f_ncc", "NCC de l'entreprise", k.ncc || (o.ncc || "")) + "</div>" +
      '<div class="g2">' + f("f_etab", "Établissement (nom déclaré à la DGI)", k.etablissement) + f("f_pv", "Point de vente (code ou nom)", k.point_vente) + "</div>" +
      '<div class="g2"><label>Gabarit par défaut<select id="f_tpl">' + opt(TEMPLATES, k.template) + '</select></label><label>TVA à 0 % : exonération<select id="f_tz"><option value="TVAC" ' + (k.tva_zero === "TVAC" ? "selected" : "") + '>Conventionnelle (TVAC)</option><option value="TVAD" ' + (k.tva_zero === "TVAD" ? "selected" : "") + ">Légale (TVAD : TEE, RME)</option></select></label></div>" +
      '<div class="g2"><label>TVA des exportations<select id="f_tx"><option value="TVAC" ' + (k.tva_export === "TVAC" ? "selected" : "") + '>Conventionnelle (TVAC)</option><option value="TVAD" ' + (k.tva_export === "TVAD" ? "selected" : "") + ">Légale (TVAD)</option></select></label>" + f("f_tel", "Téléphone par défaut (client sans numéro)", k.tel_defaut) + "</div>" +
      '<div class="g2">' + f("f_mail", "E-mail par défaut (client sans e-mail)", k.email_defaut) + f("f_msg", "Message commercial", k.message) + "</div>" + f("f_pied", "Pied de facture", k.pied) +
      '<label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" id="f_auto" style="width:auto" ' + (k.auto ? "checked" : "") + "> Facture normalisée par défaut (sans demander le type à chaque fois)</label>" +
      '<div class="flex" style="margin-top:10px"><button class="btn" ' + a + '="fne.save">💾 Enregistrer la FNE</button><button class="btn ghost" ' + a + '="fne.test">🔌 Tester la connexion</button></div>' +
      '<p class="sm mu" style="margin-bottom:0">Mise en service : 1) <b>Simulation</b> pour la formation (rien n\'est envoyé, documents marqués SIMULATION) ; 2) <b>Essai DGI</b> : inscription sur la plateforme de test, clé à placer dans le secret serveur FNE_TEST_KEY, envoi des spécimens à support.fne@dgi.gouv.ci ; 3) <b>Production</b> : après validation, secrets FNE_PROD_URL et FNE_PROD_KEY.</p></div>';
  }
  /** Lit les champs #f_* et renvoie les réglages (à valider par l'appelant) */
  function lireParametres(q) {
    var g = function (i) { return String(q(i).value || "").trim(); };
    return cfg({ actif: q("#f_actif").checked, env: q("#f_env").value, ncc: g("#f_ncc").toUpperCase(), etablissement: g("#f_etab"), point_vente: g("#f_pv"), template: q("#f_tpl").value, tva_zero: q("#f_tz").value, tva_export: q("#f_tx").value, tel_defaut: g("#f_tel"), email_defaut: g("#f_mail"), message: g("#f_msg"), pied: g("#f_pied"), auto: q("#f_auto").checked });
  }

  /** Bloc d'impression FNE : référence, QR du jeton de vérification, mention de test/simulation. qr = fonction (texte) → SVG */
  function bloc(cert, qr, esc) {
    esc = esc || function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
    if (!cert || cert.statut !== "certifiee") return "";
    var marque = cert.env === "prod" ? "" : '<div style="background:#fde8e8;color:#b00020;font-weight:bold;text-align:center;padding:6px;margin-top:10px;border:2px solid #b00020">' + (cert.env === "simulation" ? "SIMULATION — DOCUMENT DE FORMATION SANS VALEUR FISCALE" : "ENVIRONNEMENT DE TEST DGI — SANS VALEUR FISCALE") + "</div>";
    var q = qr && cert.env !== "simulation" ? '<div style="width:110px;height:110px;background:#fff">' + qr(cert.token) + "</div>" : "";
    return '<div style="display:flex;gap:14px;align-items:center;margin-top:14px;border-top:2px solid #0b6b3a;padding-top:10px">' + q + '<div style="font-size:12px"><b style="font-size:13px;color:#0b6b3a">FACTURE NORMALISÉE ÉLECTRONIQUE</b><br>N° certifié : <b>' + esc(cert.ref) + "</b><br>NCC : " + esc(cert.ncc || "") + "<br>Certifiée le " + esc(new Date(cert.ts).toLocaleString("fr-FR")) + "</div></div>" + marque;
  }

  var API = { TAUX: TAUX, CODES: CODES, TEMPLATES: TEMPLATES, PAIEMENTS: PAIEMENTS, DEVISES: DEVISES, ENVS: ENVS, DEF: DEF, cfg: cfg, modePaiement: modePaiement, codeTva: codeTva, gabarit: gabarit, construire: construire, valider: valider, totaux: totaux,
    certification: certification, ecart: ecart, avoirPayload: avoirPayload, reste: reste, montantAvoir: montantAvoir, simuler: simuler, simulerAvoir: simulerAvoir, connexion: connexion, appeler: appeler, bloc: bloc, moteur: moteur, parametresHtml: parametresHtml, lireParametres: lireParametres };
  G.ANGELS_FNE = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
