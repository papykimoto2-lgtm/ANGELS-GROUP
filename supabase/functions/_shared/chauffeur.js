/* Accès chauffeur ANGEL'S (application mobile) : logique pure, testée hors Supabase (voir tests/chauffeur-serveur.js).

   Problème résolu : la synchronisation entre postes donne TOUTE la base Transport à tout appareil qui possède la clé de synchronisation (comptes et empreintes de
   mots de passe, comptabilité, positions de tous). Un téléphone de chauffeur ne doit jamais la recevoir.
   Ici le chauffeur ne détient aucune clé partagée : il s'identifie avec SON mot de passe (vérifié ici, PBKDF2 identique au bureau), reçoit un jeton signé de courte
   durée et n'obtient que SES données (échéances, reçus, contrat, véhicule, courses, déclarations) plus les courses de la flotte rendues anonymes (zone, heure,
   montant) pour les suggestions de circuits. Toutes ses saisies sont REVALIDÉES ici (client non fiable) puis écrites dans la base partagée, d'où le bureau les lit.
   Actions : liste · login · changer_mdp · moi · position · arret_position · course · retirer_course · declarer_recette · retirer_declaration · demande. */

export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const APP = "transport", rep = (status, body) => ({ status, body }), err = (status, message, extra) => rep(status, Object.assign({ ok: false, erreur: message }, extra || {}));
const txt = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const te = new TextEncoder(), H = 36e5, J = 864e5;
export const ESSAIS_MAX = 5, BLOCAGE_MIN = 15, JETON_JOURS = 14, COURSES_JOUR_MAX = 200;
/* Zones par défaut : copie de ZONES_DEF (circuit-engine.js), contrôlée par tests/chauffeur-serveur.js */
export const ZONES_DEF = [
  { nom: "Plateau", commune: "Plateau" }, { nom: "Adjamé", commune: "Adjamé" }, { nom: "Attécoubé", commune: "Attécoubé" }, { nom: "Treichville", commune: "Treichville" },
  { nom: "Marcory", commune: "Marcory" }, { nom: "Koumassi", commune: "Koumassi" }, { nom: "Port-Bouët", commune: "Port-Bouët" }, { nom: "Aéroport", commune: "Port-Bouët" },
  { nom: "Cocody centre", commune: "Cocody" }, { nom: "Deux-Plateaux", commune: "Cocody" }, { nom: "Riviera", commune: "Cocody" }, { nom: "Angré", commune: "Cocody" },
  { nom: "Abobo", commune: "Abobo" }, { nom: "Yopougon Siporex", commune: "Yopougon" }, { nom: "Yopougon Niangon", commune: "Yopougon" }, { nom: "Bingerville", commune: "Bingerville" }, { nom: "Anyama", commune: "Anyama" }, { nom: "Songon", commune: "Songon" },
];
const REGLAGES = ["tarifs_communes", "circuit_zones", "seuil_justificatif", "mdp_min", "defaut_places", "org_nom", "org_activite", "ville", "adresse", "tel", "gps_retention_jours"];
const COURANTS = ["motdepasse", "password", "azerty", "qwerty", "123456", "000000", "111111", "angels", "angelsgroup", "bienvenue", "admin", "abc123", "iloveyou", "welcome"];

/* ---- cryptographie : PBKDF2 (mots de passe), HMAC (jeton) ---- */
const b64 = (u8) => { let s = ""; for (const x of u8) s += String.fromCharCode(x); return btoa(s); };
const unb64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const b64u = (u8) => b64(u8).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => unb64(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4));
const egal = (a, b) => { a = String(a || ""); b = String(b || ""); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };
async function deriver(mdp, sel, it) {
  const k = await crypto.subtle.importKey("raw", te.encode(String(mdp)), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sel, iterations: it }, k, 256));
}
async function verifierMdp(mdp, rec) {
  if (!rec || !rec.s || !rec.h) return false; const it = +rec.it || 150000; if (!(it >= 10000 && it <= 600000)) return false;
  try { return egal(b64(await deriver(mdp, unb64(rec.s), it)), rec.h); } catch (e) { return false; }
}
async function creerMdp(mdp) { const sel = crypto.getRandomValues(new Uint8Array(16)); return { v: 2, it: 150000, s: b64(sel), h: b64(await deriver(mdp, sel, 150000)) }; }
async function signer(cfg, msg) {
  const k = await crypto.subtle.importKey("raw", te.encode("chauffeur-v1:" + cfg.cle), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64u(new Uint8Array(await crypto.subtle.sign("HMAC", k, te.encode(msg))));
}
export async function emettreJeton(cfg, u, now) {
  const p = b64u(te.encode(JSON.stringify({ u: u.id, d: u.driver_id, e: now + JETON_JOURS * J, v: txt(u.pwd && u.pwd.h, 12) })));
  return p + "." + await signer(cfg, p);
}
async function lireJeton(cfg, jeton, now) {
  const [p, s] = String(jeton || "").split("."); if (!p || !s) return null;
  if (!egal(s, await signer(cfg, p))) return null;
  try { const d = JSON.parse(new TextDecoder().decode(unb64u(p))); return d && d.e > now ? d : null; } catch (e) { return null; }
}
const classes = (m) => [/[a-zà-ÿ]/, /[A-ZÀ-Ý]/, /\d/, /[^A-Za-zÀ-ÿ\d]/].filter((r) => r.test(m)).length;
const plat = (x) => String(x || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function mdpFaible(mdp, min) {
  mdp = String(mdp == null ? "" : mdp); min = Math.max(10, +min || 10);
  if (mdp.length < min) return "Le mot de passe doit contenir au moins " + min + " caractères.";
  if (mdp.length > 128) return "Mot de passe trop long (128 caractères maximum).";
  if (classes(mdp) < 3) return "Mélangez au moins 3 types de caractères (minuscules, majuscules, chiffres, symboles).";
  if (COURANTS.indexOf(plat(mdp)) >= 0) return "Mot de passe trop courant.";
  return "";
}

/* ---- accès aux données (db : voir serveur-chauffeur.js et tests/chauffeur-memoire.js) ---- */
const un = async (db, coll, id) => { const r = (await db.lire(APP, [{ coll, id }]))[0]; return r && !r.supprime ? r : null; };
async function ecrireEnreg(db, coll, id, data, par) { const e = (await db.lire(APP, [{ coll, id }]))[0]; await db.ecrire([{ app: APP, coll, id, data, rev: (e ? e.rev : 0) + 1, supprime: false, par }]); }
async function supprimerEnreg(db, coll, id, par) { const e = (await db.lire(APP, [{ coll, id }]))[0]; if (!e || e.supprime) return; await db.ecrire([{ app: APP, coll, id, data: null, rev: e.rev + 1, supprime: true, par }]); }
async function prochainNumero(db, k, pref, now) {
  const e = (await db.lire(APP, [{ coll: "_doc", id: "seq" }]))[0], v = Object.assign({}, e && !e.supprime && e.data && e.data.v || {}), n = (v[k] || 0) + 1; v[k] = n;
  await db.ecrire([{ app: APP, coll: "_doc", id: "seq", data: { v }, rev: (e ? e.rev : 0) + 1, supprime: false, par: "chauffeur" }]);
  return pref + "-" + new Date(now).getUTCFullYear() + "-" + String(n).padStart(5, "0");
}
const reglages = async (db) => { const e = await un(db, "_doc", "settings"), v = (e && e.data && e.data.v) || {}, o = {}; REGLAGES.forEach((k) => { if (v[k] !== undefined) o[k] = v[k]; }); return o; };
const idOk = (id) => /^[a-z]{2,4}_?[a-z0-9]{4,40}$/i.test(String(id || ""));
const nouvelId = (p) => p + "_" + [...crypto.getRandomValues(new Uint8Array(8))].map((x) => x.toString(36).padStart(2, "0")).join("").slice(0, 14);
const isoOk = (s) => { const t = new Date(s).getTime(); return isFinite(t) ? t : null; };

async function chauffeurDe(db, cfg, req, now) {
  const j = await lireJeton(cfg, req.jeton, now); if (!j) return { e: err(401, "Session expirée : reconnectez-vous.", { reconnecter: true }) };
  const u = await un(db, "users", j.u); if (!u || !u.data || !u.data.actif || u.data.role !== "chauffeur" || u.data.driver_id !== j.d || txt(u.data.pwd && u.data.pwd.h, 12) !== j.v) return { e: err(401, "Session expirée : reconnectez-vous.", { reconnecter: true }) };
  const d = await un(db, "drivers", j.d); if (!d) return { e: err(404, "Fiche chauffeur introuvable : prévenez le bureau.") };
  return { u: u.data, d: d.data };
}
const affectation = async (db, did) => { const A = await db.liste(APP, "assignments", { contient: { driver_id: did } }); return A.find((a) => !a.fin) || null; };

/* ---- action principale ---- */
export async function traiterChauffeur(db, cfg, req, now = Date.now()) {
  if (!cfg || !cfg.cle || String(cfg.cle).length < 16) return err(500, "Service non configuré");
  const a = txt(req && req.action, 30), par = "chauffeur";

  if (a === "liste") {
    const U = await db.liste(APP, "users", { limite: 500 });
    return rep(200, { ok: true, chauffeurs: U.filter((u) => u.role === "chauffeur" && u.actif).map((u) => ({ id: u.id, nom: u.nom })) });
  }

  if (a === "login" || a === "changer_mdp") {
    const uid = txt(req.uid, 80), mdp = String(req.mdp == null ? "" : req.mdp).slice(0, 200), e = await db.essais(uid);
    if (e && e.until > now) return err(429, "Compte bloqué " + Math.ceil((e.until - now) / 6e4) + " minute(s) : trop de tentatives.");
    const r = uid ? await un(db, "users", uid) : null, u = r && r.data;
    const ok = !!(u && u.actif && u.role === "chauffeur" && await verifierMdp(mdp, u.pwd));
    if (!ok) {
      const n = ((e && e.n) || 0) + 1; await db.noterEssai(uid || "?", n >= ESSAIS_MAX ? { n: 0, until: now + BLOCAGE_MIN * 6e4 } : { n, until: 0 });
      return err(401, "Utilisateur ou mot de passe incorrect.");
    }
    await db.effacerEssais(uid);
    if (a === "login") {
      if (u.chg) return rep(200, { ok: true, changer: true });
      return rep(200, { ok: true, jeton: await emettreJeton(cfg, u, now), utilisateur: { id: u.id, nom: u.nom, role: "chauffeur", driver_id: u.driver_id } });
    }
    const st = await reglages(db), faible = mdpFaible(req.nouveau, st.mdp_min);
    if (faible) return err(400, faible); if (String(req.nouveau) === mdp) return err(400, "Choisissez un mot de passe différent de l'actuel.");
    const nu = Object.assign({}, u, { pwd: await creerMdp(String(req.nouveau)), pwd_le: new Date(now).toISOString() }); delete nu.chg; delete nu.h; delete nu.pin_h;
    await ecrireEnreg(db, "users", u.id, nu, par);
    return rep(200, { ok: true, jeton: await emettreJeton(cfg, nu, now), utilisateur: { id: nu.id, nom: nu.nom, role: "chauffeur", driver_id: nu.driver_id } });
  }

  const c = await chauffeurDe(db, cfg, req, now); if (c.e) return c.e;
  const { u, d } = c, did = d.id;

  if (a === "moi") {
    const depuis = new Date(now - 60 * J).toISOString(), ass = await db.liste(APP, "assignments", { contient: { driver_id: did } });
    const [contrats, obs, pay, rec, dcl, rq, nt1, nt2, mc, lignes, st] = await Promise.all([
      db.liste(APP, "contracts", { contient: { driver_id: did } }), db.liste(APP, "obligations", { contient: { driver_id: did }, limite: 500 }),
      db.liste(APP, "payments", { contient: { driver_id: did }, limite: 300 }), db.liste(APP, "receipts", { contient: { driver_id: did }, limite: 300 }),
      db.liste(APP, "declarations", { contient: { driver_id: did }, limite: 200 }), db.liste(APP, "requests", { contient: { driver_id: did }, limite: 100 }),
      db.liste(APP, "notifs", { contient: { to: did }, limite: 50 }), db.liste(APP, "notifs", { contient: { to: "*" }, limite: 50 }),
      db.liste(APP, "courses", { contient: { driver_id: did }, depuis: { champ: "t", iso: depuis }, limite: 500 }), db.liste(APP, "lignes", { limite: 200 }), reglages(db),
    ]);
    const fl = await db.liste(APP, "courses", { depuis: { champ: "t", iso: depuis }, limite: 6000 });
    const allocs = obs.length ? await db.liste(APP, "allocs", { dans: { champ: "obligation_id", valeurs: obs.map((o) => o.id) } }) : [];
    const vids = [...new Set(ass.map((x) => x.vehicle_id).filter(Boolean))], veh = vids.length ? (await db.lire(APP, vids.map((id) => ({ coll: "vehicles", id })))).filter((r) => !r.supprime).map((r) => r.data) : [];
    const tiers = d.tiers_id ? (await un(db, "tiers", d.tiers_id)) : null;
    const dette = obs.filter((o) => !o.exo).reduce((s, o) => s + (+o.montant || 0), 0) - allocs.filter((x) => x.actif !== false).reduce((s, x) => s + (+x.montant || 0), 0);
    const pc = await un(db, "pos_chauf", "pc_" + did);
    return rep(200, { ok: true, maintenant: new Date(now).toISOString(), utilisateur: { id: u.id, nom: u.nom, role: "chauffeur", driver_id: did }, chauffeur: d, tiers: tiers && tiers.data,
      contrats, affectations: ass, vehicules: veh, obligations: obs, allocations: allocs, paiements: pay, recus: rec, declarations: dcl, demandes: rq, notifs: nt1.concat(nt2),
      mes_courses: mc, courses_flotte: fl.filter((x) => x && x.zone).map((x) => ({ id: x.id, zone: x.zone, montant: x.montant, t: x.t, mode: x.mode, commune: x.commune, ligne_id: x.ligne_id, passagers: x.passagers })),
      lignes, reglages: st, solde: Math.round(dette), position_active: !!pc });
  }

  if (a === "position") {
    const lat = +req.lat, lng = +req.lng;
    if (!(isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return err(400, "Position invalide.");
    const as = await affectation(db, did), t = isoOk(req.t), tt = t && Math.abs(now - t) < 10 * 6e4 ? t : now;
    await ecrireEnreg(db, "pos_chauf", "pc_" + did, { id: "pc_" + did, driver_id: did, vehicle_id: as ? as.vehicle_id : null, lat: +lat.toFixed(6), lng: +lng.toFixed(6), vit: Math.max(0, Math.min(250, Math.round(+req.vit || 0))), prec: Math.max(0, Math.round(+req.prec || 0)), t: new Date(tt).toISOString() }, par);
    return rep(200, { ok: true });
  }
  if (a === "arret_position") { await supprimerEnreg(db, "pos_chauf", "pc_" + did, par); return rep(200, { ok: true }); }

  if (a === "course") {
    const id = idOk(req.id) && String(req.id).startsWith("crs") ? String(req.id) : nouvelId("crs");
    if (await un(db, "courses", id)) return rep(200, { ok: true, id, deja: true });
    const st = await reglages(db), zone = txt(req.zone, 80), lignes = await db.liste(APP, "lignes", { limite: 200 }), lg = lignes.find((l) => l.nom === zone);
    const as = await affectation(db, did), v = as ? (await un(db, "vehicles", as.vehicle_id)) : null, vd = v && v.data, ex = vd && (vd.exploit === "intra" || vd.exploit === "inter") ? vd.exploit : "libre";
    const zones = Array.isArray(st.circuit_zones) && st.circuit_zones.length >= 3 ? st.circuit_zones : ZONES_DEF, tarifs = Array.isArray(st.tarifs_communes) ? st.tarifs_communes : [];
    let m = Math.round(+req.montant), pax = null, mode = "libre", commune = "", cap = 0, tarif = 0;
    const strict = (prix, places, lib) => {
      pax = Math.round(+req.passagers); if (!(pax >= 1 && pax <= places)) return "Nombre de passagers invalide (1 à " + places + " " + lib + ").";
      const att = pax * prix; if (req.montant !== "" && req.montant != null && !isNaN(m) && m !== att) return "Montant ≠ passagers × tarif (" + pax + " × " + prix + " = " + att + ").";
      m = att; tarif = prix; cap = places; return "";
    };
    let e = "";
    if (lg) {
      if (ex === "intra") e = "Taxi communal : les lignes intercommunales ne vous sont pas ouvertes."; else if (!lg.actif) e = "Cette ligne est désactivée."; else { e = strict(lg.tarif, lg.places, "sur cette ligne"); mode = "ligne"; commune = lg.commune; }
    } else {
      const z = zones.find((q) => q.nom === zone);
      if (!z) e = "Choisissez une ligne ou une zone de la liste."; else if (ex === "inter") e = "Taxi de ligne : déclarez un trajet sur l'une de vos lignes.";
      else if (ex === "intra") {
        const tc = tarifs.find((x) => x.commune === vd.commune);
        if (z.commune !== vd.commune) e = "Taxi communal de " + vd.commune + " : circulation limitée à sa commune."; else if (!tc) e = "Tarif communal non défini pour " + vd.commune + ".";
        else { e = strict(tc.tarif, 4, "par taxi"); mode = "intra"; commune = vd.commune; }
      }
    }
    if (e) return err(400, e);
    if (!(m >= 100 && m <= 200000)) return err(400, "Montant invalide (entre 100 et 200 000 FCFA).");
    const t = req.t ? isoOk(req.t) : now; if (t == null) return err(400, "Heure invalide."); if (t > now + 5 * 6e4) return err(400, "L'heure ne peut pas être dans le futur."); if (now - t > 48 * H) return err(400, "Une course se déclare dans les 48 heures.");
    const jour = (await db.liste(APP, "courses", { contient: { driver_id: did }, depuis: { champ: "t", iso: new Date(now - J).toISOString() }, limite: 500 })).length;
    if (jour >= COURSES_JOUR_MAX) return err(429, "Trop de courses déclarées aujourd'hui.");
    const x = { id, driver_id: did, vehicle_id: as ? as.vehicle_id : null, zone, montant: m, t: new Date(t).toISOString(), par: d.nom, mode };
    if (lg) x.ligne_id = lg.id; if (pax != null) { x.passagers = pax; x.tarif = tarif; x.cap = cap; } if (commune) x.commune = commune;
    await ecrireEnreg(db, "courses", id, x, par);
    return rep(200, { ok: true, id, course: x });
  }
  if (a === "retirer_course") {
    const x = await un(db, "courses", txt(req.id, 60)); if (!x || x.data.driver_id !== did) return err(403, "Accès refusé : course d'un autre chauffeur.");
    if (now - new Date(x.data.t).getTime() > 24 * H) return err(400, "Une course ne se retire que dans les 24 heures.");
    await supprimerEnreg(db, "courses", x.id, par); return rep(200, { ok: true });
  }

  if (a === "declarer_recette") {
    const date = txt(req.date, 10), m = Math.round(+req.montant), today = new Date(now).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err(400, "Date invalide."); if (date > today) return err(400, "La date ne peut pas être dans le futur.");
    if (!(m > 0 && m <= 5000000)) return err(400, "Montant invalide."); if (!["especes", "mobile", "banque"].includes(req.mode)) return err(400, "Mode de versement requis.");
    const D = await db.liste(APP, "declarations", { contient: { driver_id: did }, limite: 200 });
    if (D.some((x) => x.date === date && (x.statut === "declaree" || x.statut === "validee"))) return err(400, "Une déclaration existe déjà pour le " + date + " : retirez-la (si elle n'est pas validée) avant d'en refaire une.");
    const id = idOk(req.id) && String(req.id).startsWith("dcl") ? String(req.id) : nouvelId("dcl");
    if (await un(db, "declarations", id)) return rep(200, { ok: true, id, deja: true });
    const as = await affectation(db, did), t = new Date(now).toISOString(), numero = await prochainNumero(db, "dcl", "DR", now);
    const x = { id, numero, driver_id: did, vehicle_id: as ? as.vehicle_id : null, date, montant: m, mode: req.mode, ref: txt(req.ref, 80), note: txt(req.note, 300), pj: null, statut: "declaree", hist: [{ t, par: d.nom, statut: "declaree", note: "Déclaration du chauffeur" }], par: d.nom, t };
    await ecrireEnreg(db, "declarations", id, x, par);
    const nid = nouvelId("nt"); await ecrireEnreg(db, "notifs", nid, { id: nid, to: "staff", titre: "Déclaration de recette — " + d.nom, texte: m + " F le " + date, t, lu: {} }, par);
    return rep(200, { ok: true, id, declaration: x });
  }
  if (a === "retirer_declaration") {
    const x = await un(db, "declarations", txt(req.id, 60)); if (!x || x.data.driver_id !== did) return err(403, "Accès refusé : déclaration d'un autre chauffeur.");
    if (x.data.statut !== "declaree") return err(400, "Seule une déclaration en attente de validation peut être retirée.");
    const n = Object.assign({}, x.data, { statut: "retiree", hist: (x.data.hist || []).concat([{ t: new Date(now).toISOString(), par: d.nom, statut: "retiree", note: "Retirée par le chauffeur" }]) });
    await ecrireEnreg(db, "declarations", x.id, n, par); return rep(200, { ok: true, declaration: n });
  }

  if (a === "demande") {
    const type = txt(req.type, 20), texte = txt(req.texte, 1000);
    if (!["justificatif", "contestation", "autre", "profil", "entretien", "incident"].includes(type)) return err(400, "Type de demande invalide."); if (!texte) return err(400, "Message requis.");
    let ob = null; if (req.ob) { const o = await un(db, "obligations", txt(req.ob, 60)); if (!o || o.data.driver_id !== did) return err(403, "Accès refusé : échéance d'un autre chauffeur."); ob = o.id; }
    const payload = type === "profil" && req.payload ? { tel: txt(req.payload.tel, 30), adresse: txt(req.payload.adresse, 120) } : null, id = idOk(req.id) && String(req.id).startsWith("rq") ? String(req.id) : nouvelId("rq");
    if (await un(db, "requests", id)) return rep(200, { ok: true, id, deja: true });
    const t = new Date(now).toISOString(), x = { id, driver_id: did, type, ob, texte, pj: null, payload, statut: "ouverte", t };
    await ecrireEnreg(db, "requests", id, x, par);
    const nid = nouvelId("nt"); await ecrireEnreg(db, "notifs", nid, { id: nid, to: "staff", titre: "Demande de " + d.nom, texte: type, t, lu: {} }, par);
    return rep(200, { ok: true, id, demande: x });
  }
  return err(400, "Action inconnue");
}
