/* Passerelle livreur ANGEL'S : logique pure, testée hors Supabase (voir tests/passerelle.js).

   Principe : le bureau (application Distributions) reste la source de vérité. Il publie sur le serveur, pour chaque mission, une
   projection SANS numéro de téléphone et SANS code de confirmation (seule l'empreinte du code est conservée). Le livreur se connecte avec un
   compte Supabase Auth (mot de passe vérifié par le serveur), lit uniquement ses missions et envoie ses actions au serveur, qui les valide
   (droits, transitions, code de livraison) avant de les mettre en file pour le bureau. Le bureau applique ensuite chaque événement. */

import { egal, sha256hex } from "./pont.js";

export { CORS } from "./pont.js";

const rep = (status, body) => ({ status, body });
const err = (status, message) => rep(status, { ok: false, erreur: message });
export const emailDe = (ident) => { ident = String(ident || "").trim(); return ident.includes("@") ? ident.toLowerCase() : ident.toLowerCase().replace(/[^a-z0-9._-]/g, "") + "@users.angels-erp.app"; };

/* Mot de passe temporaire (14 caractères : 4 majuscules, 4 minuscules, 4 chiffres, 2 symboles, mélangés) */
export function genererMdp() {
  const A = ["ABCDEFGHJKMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "-_@#%+"], plan = [4, 4, 4, 2], out = [];
  const alea = (n) => { const lim = 256 - (256 % n), b = new Uint8Array(1); do { crypto.getRandomValues(b); } while (b[0] >= lim); return b[0] % n; };
  plan.forEach((n, i) => { for (let j = 0; j < n; j++) out.push(A[i][alea(A[i].length)]); });
  for (let i = out.length - 1; i > 0; i--) { const j = alea(i + 1), t = out[i]; out[i] = out[j]; out[j] = t; }
  return out.join("");
}

/* Colis : l'étiquette de chaque colis porte un jeton de 5 caractères (dans le QR et imprimé dessous). Le serveur n'en garde que l'empreinte : le livreur ne peut valider un colis que s'il l'a vraiment sous les yeux. */
export const empreinteColis = (livraison_ref, n, tok) => sha256hex("colis|" + livraison_ref + "|" + n + "|" + String(tok).trim().toUpperCase());
export const empreinteJeton = (jeton) => sha256hex("sign|" + String(jeton).trim().toUpperCase());
const ALPHA_J = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PNG = /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/, JPG = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/, SIG_MAX = 80000, PHOTO_MAX = 80000;
const QR_COLIS = /^AGE1\|([^|]+)\|(\d+)\/(\d+)\|([A-Z0-9]{5})$/;
/* Contrôle des colis scannés (QR ou code de 5 caractères) : chaque colis de la mission doit être reconnu. Retourne { ok, scans:[{n,mode}] } ou { ok:false, msg }. */
async function verifierScans(db, m, scans) {
  const ref = m.livraison_ref, K = await db.colis(ref), L = Array.isArray(scans) ? scans.slice(0, 120) : [], vus = new Map();
  for (const x of L) {
    const t = txt(x && x.txt, 80).toUpperCase(); let n = 0, tok = "", mode = "saisi";
    const q = QR_COLIS.exec(t);
    if (q) { if (q[1] !== String(m.commande_ref).toUpperCase()) return { ok: false, msg: "Ce colis appartient à la commande " + q[1] + ", pas à " + m.commande_ref }; n = +q[2]; tok = q[4]; mode = "scan"; }
    else if (/^[A-Z0-9]{5}$/.test(t)) tok = t; else continue;
    const h = (c) => empreinteColis(ref, c, tok);
    if (n) { const k = K.find((c) => c.n === n); if (k && egal(await h(n), k.hash)) vus.set(n, mode); }
    else for (const k of K) if (egal(await h(k.n), k.hash)) { vus.set(k.n, "saisi"); break; }
  }
  const manque = K.filter((k) => !vus.has(k.n)).map((k) => k.n);
  if (manque.length) return { ok: false, msg: "Colis non reconnus ou non scannés : n° " + manque.join(", ") };
  return { ok: true, scans: K.map((k) => ({ n: k.n, mode: vus.get(k.n) })) };
}

export const empreinteCode = (livraison_ref, code) => sha256hex("code|" + livraison_ref + "|" + String(code).trim());

const STATUTS_ACTIFS = ["affectee", "acceptee", "en_cours"];
const TYPES = ["accepter", "refuser", "prise_en_charge", "demarrer", "confirmer", "echec", "position", "incident", "arrive", "rappel_client", "demande_signature", "signature_etat"];
const txt = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const nombre = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

/* ================= Espace vendeur : projection publiée par le bureau, lue par le vendeur connecté ================= */
/* On ne garde que des champs connus, bornés : jamais de téléphone, de code ni d'adresse de client. */
const montant = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
/* Étiquettes des colis publiées au vendeur pour qu'il les imprime : jetons de 5 caractères, rang, destination ; rien d'autre (jamais de téléphone ni d'adresse complète) */
function etiquettesVendeur(x) {
  const K = (Array.isArray(x && x.colis) ? x.colis : []).slice(0, 20).filter((k) => k && Number.isInteger(k.n) && k.n >= 1 && k.n <= 20 && /^[A-Z0-9]{5}$/.test(String(k.tok || "")));
  if (!K.length) return null;
  return { colis: K.map((k) => ({ n: k.n, tok: String(k.tok) })), dest: txt(x.dest, 100), urgent: !!x.urgent, mention: txt(x.mention, 14), icone: txt(x.icone, 4) };
}
export function nettoyerEtatVendeur(e) {
  const L = (x, n) => (Array.isArray(x) ? x.slice(0, n) : []);
  return {
    nom: txt(e.nom, 80), ref: txt(e.ref, 60).replace(/[^A-Za-z0-9_-]/g, ""), tel: txt(e.tel, 20), org: txt(e.org, 80),
    stats30: { dem: montant(e.stats30 && e.stats30.dem), qr: montant(e.stats30 && e.stats30.qr), lien: montant(e.stats30 && e.stats30.lien), live: montant(e.stats30 && e.stats30.live), ok: montant(e.stats30 && e.stats30.ok) },
    solde: montant(e.solde), acquis: montant(e.acquis), regle: montant(e.regle), attente: montant(e.attente), lien: /^https:\/\//.test(String(e.lien || "")) ? txt(e.lien, 600) : "",
    commandes: L(e.commandes, 200).map((c) => ({ numero: txt(c && c.numero, 30), ref: txt(c && c.ref, 40), date: txt(c && c.date, 10), statut: txt(c && c.statut, 60), client: txt(c && c.client, 80), montant: montant(c && c.montant), net: montant(c && c.net), suivi: /^https:\/\//.test(String(c && c.suivi || "")) ? txt(c.suivi, 1500) : "", tc: c && c.tc && c.tc.nom ? { icone: txt(c.tc.icone, 4), nom: txt(c.tc.nom, 40) } : null, etiq: etiquettesVendeur(c && c.etiq), exp: c && c.exp && c.exp.numero ? { numero: txt(c.exp.numero, 30), statut: txt(c.exp.statut, 40), transporteur: txt(c.exp.transporteur, 60), bordereau: txt(c.exp.bordereau, 40), eta: txt(c.exp.eta, 10) } : null })),
    demandes: L(e.demandes, 50).map((d) => ({ ref: txt(d && d.ref, 12), nom: txt(d && d.nom, 80), tel: txt(d && d.tel, 20), zone: txt(d && d.zone, 80), quartier: txt(d && d.quartier, 120), repere: txt(d && d.repere, 200), note: txt(d && d.note, 500), cree_le: txt(d && d.cree_le, 30), nb_photos: Math.max(0, Math.min(9, Math.round(Number(d && d.nb_photos)) || 0)),
      gps: d && d.gps && Number.isFinite(+d.gps.lat) && Number.isFinite(+d.gps.lng) ? { lat: +(+d.gps.lat).toFixed(6), lng: +(+d.gps.lng).toFixed(6) } : null,
      acompte: d && d.acompte && Number.isFinite(+d.acompte.montant) ? { montant: montant(d.acompte.montant), op: txt(d.acompte.op, 30), ref: txt(d.acompte.ref, 40) } : null,
      lignes: L(d && d.lignes, 30).map((l) => ({ desig: txt(l && l.desig, 120), qte: Math.max(1, Math.min(9999, Math.round(Number(l && l.qte)) || 1)), pu: l && l.pu != null && l.pu !== "" && Number.isFinite(+l.pu) ? Math.max(0, Math.round(+l.pu)) : null })).filter((l) => l.desig) })).filter((d) => d.ref),
    types: L(e.types, 20).map((t) => ({ id: txt(t && t.id, 20).toLowerCase().replace(/[^a-z0-9_]/g, ""), nom: txt(t && t.nom, 40), icone: txt(t && t.icone, 4), consigne: txt(t && t.consigne, 200) })).filter((t) => t.id && t.nom),
    zones: L(e.zones, 60).map((z) => ({ nom: txt(z && z.nom, 60), frais: montant(z && z.frais) })).filter((z) => z.nom),
    reglements: L(e.reglements, 100).map((r) => ({ date: txt(r && r.date, 10), montant: montant(r && r.montant), libelle: txt(r && r.libelle, 80) })),
  };
}
/* Vendeur connecté (jeton vérifié par la fonction : userId fourni) : lit SA projection, rien d'autre. */
export async function traiterVendeurEtat(db, req, userId) {
  if (!userId) return err(401, "Connexion requise");
  const c = await db.vendeurParUtilisateur(userId); if (!c || !c.actif) return err(403, "Compte vendeur inactif ou introuvable");
  const a = String(req.action || "etat");
  if (a === "etat") { const r = await db.etatVendeur(c.vendeur_ref); return rep(200, Object.assign({ ok: true, nom: c.nom, commandes: [], reglements: [], solde: 0, lien: "" }, r && r.etat ? r.etat : {}, { maj_le: r ? r.maj_le : null })); }
  if (a === "refuser") {   /* le vendeur écarte une demande de client : le bureau la clôture (statut « refusée ») */
    const dm = txt(req.demande, 12).replace(/[^A-Za-z0-9]/g, "").toUpperCase(); if (dm.length < 3) return err(400, "Demande invalide");
    await db.ajouterCmdVendeur({ vendeur_ref: c.vendeur_ref, ref: "RF-" + dm, donnees: { type: "refus", demande: dm, motif: txt(req.motif, 200) } });
    return rep(200, { ok: true });
  }
  if (a === "commander") {   /* le vendeur dépose une commande : mise en file pour le bureau (idempotent par ref), jamais livrée avant la confirmation du bureau */
    const ref = txt(req.ref, 40); if (!/^[A-Za-z0-9_-]{6,40}$/.test(ref)) return err(400, "Référence de commande invalide");
    const lignes = (Array.isArray(req.lignes) ? req.lignes.slice(0, 30) : []).map((l) => ({ desig: txt(l && l.desig, 100), qte: Math.round(Number(l && l.qte)), pu: Math.round(Number(l && l.pu)) }));
    if (!lignes.length || lignes.some((l) => !l.desig || !Number.isInteger(l.qte) || l.qte < 1 || l.qte > 999 || !Number.isInteger(l.pu) || l.pu < 0 || l.pu > 10000000)) return err(400, "Chaque article doit avoir une désignation, une quantité (1 à 999) et un prix");
    const pay = ["livraison", "paye", "partiel"].includes(req.pay) ? req.pay : "livraison", prods = lignes.reduce((t, l) => t + l.qte * l.pu, 0), pv = pay === "paye" ? prods : pay === "partiel" ? Math.floor(Number(req.paye_vendeur) || 0) : 0;
    if (pay === "partiel" && (pv <= 0 || pv > prods)) return err(400, "Montant déjà payé invalide");
    const zone = txt(req.zone, 60), tel = txt(req.tel, 20);
    if (!zone) return err(400, "Zone de livraison obligatoire");
    if (tel && !/^[0-9 +().-]{6,20}$/.test(tel)) return err(400, "Téléphone invalide");
    if (await db.nbCmdsVendeurEnAttente(c.vendeur_ref) >= 40) return err(429, "Trop de commandes en attente de traitement par le bureau : patientez");
    const gps = req.gps && Number.isFinite(+req.gps.lat) && Number.isFinite(+req.gps.lng) && Math.abs(+req.gps.lat) <= 90 && Math.abs(+req.gps.lng) <= 180 ? { lat: +(+req.gps.lat).toFixed(6), lng: +(+req.gps.lng).toFixed(6) } : null;
    const demande = txt(req.demande, 12).replace(/[^A-Za-z0-9]/g, "").toUpperCase(), type_colis = txt(req.type_colis, 20).toLowerCase().replace(/[^a-z0-9_]/g, ""), nb_colis = Math.max(1, Math.min(20, Math.round(Number(req.nb_colis)) || 1));
    await db.ajouterCmdVendeur({ vendeur_ref: c.vendeur_ref, ref, donnees: { demande: demande || undefined, type_colis: type_colis || undefined, nb_colis, nom: txt(req.nom, 80), tel, zone, quartier: txt(req.quartier, 80), repere: txt(req.repere, 120), ins: txt(req.ins, 200), obs: txt(req.obs, 300), lignes, pay, paye_vendeur: pv, gps } });
    return rep(200, { ok: true, ref });
  }
  return err(400, "Action inconnue");
}

/* ================= Bureau (clé d'administration) ================= */
export async function traiterSync(db, cfg, req, adminKey, now = Date.now()) {
  if (!cfg.adminKey || !egal(adminKey, cfg.adminKey)) return err(401, "Clé d'administration invalide");
  const a = String(req.action || "");

  if (a === "publier") {
    const L = Array.isArray(req.missions) ? req.missions.slice(0, 300) : [], connus = new Set(await db.livreursConnus()), attente = new Set(await db.refsAvecEvenementsEnAttente());
    let ecrites = 0, ignorees = 0; const inconnus = [];
    for (const m of L) {
      const ref = txt(m.livraison_ref, 60), lv = txt(m.livreur_ref, 60);
      if (!ref || !lv || !m.payload || typeof m.payload !== "object") { ignorees++; continue; }
      if (!connus.has(lv)) { if (!inconnus.includes(lv)) inconnus.push(lv); continue; }
      if (attente.has(ref)) { ignorees++; continue; }   // un événement du livreur n'est pas encore appliqué par le bureau : on ne l'écrase pas
      const p = JSON.parse(JSON.stringify(m.payload)); delete p.tel; delete p.code; delete p.colis;
      const K = (Array.isArray(m.colis) ? m.colis : []).slice(0, 99).filter((k) => k && Number.isInteger(k.n) && k.n >= 1 && k.n <= 99 && /^[A-Za-z0-9]{5}$/.test(String(k.tok || "")));
      if (K.length) p.colis_total = K.length; else delete p.colis_total;
      await db.ecrireMission({ livraison_ref: ref, livreur_ref: lv, commande_ref: txt(m.commande_ref, 40), statut: txt(m.statut, 20), payload: p, maj_le: new Date(now).toISOString() });
      if (m.code != null && String(m.code).trim() !== "") await db.ecrireCode(ref, await empreinteCode(ref, m.code));
      if (K.length) await db.ecrireColis(ref, await Promise.all(K.map(async (k) => ({ n: k.n, hash: await empreinteColis(ref, k.n, k.tok) }))));
      ecrites++;
    }
    const R = Array.isArray(req.retirer) ? req.retirer.slice(0, 500).map((x) => txt(x, 60)).filter(Boolean) : [];
    if (R.length) await db.retirerMissions(R);
    return rep(200, { ok: true, ecrites, ignorees, retirees: R.length, livreurs_inconnus: inconnus });
  }
  if (a === "preuve") {   /* signature, photo et position d'une livraison confirmée : le bureau les range dans son dossier */
    const pr = await db.preuve(txt(req.livraison_ref, 60)); return rep(200, { ok: true, preuve: pr || null });
  }
  if (a === "evenements") return rep(200, { ok: true, evenements: await db.evenementsEnAttente(200) });
  if (a === "acquitter") {
    const ids = (Array.isArray(req.ids) ? req.ids : []).map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 500);
    if (ids.length) await db.acquitter(ids); return rep(200, { ok: true, acquittes: ids.length });
  }
  if (a === "compte-creer") {
    const ref = txt(req.livreur_ref, 60), nom = txt(req.nom, 80), ident = txt(req.ident, 80);
    if (!ref || !nom || !ident) return err(400, "Livreur, nom et identifiant obligatoires");
    if (ident.includes("@") ? !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ident) : !/^[A-Za-z0-9._-]{3,}$/.test(ident)) return err(400, "Identifiant : 3 caractères minimum (lettres, chiffres, point, tiret)");
    if (await db.compteDe(ref)) return err(409, "Ce livreur a déjà un compte : réinitialisez son mot de passe");
    const mdp = genererMdp(); let uid;
    try { uid = await db.creerUtilisateur(emailDe(ident), mdp, { chg: true, role: "livreur" }); } catch (e) { return err(409, "Cet identifiant existe déjà ou est refusé : " + txt(e && e.message, 120)); }
    await db.ecrireCompte({ livreur_ref: ref, user_id: uid, nom, ident: ident.toLowerCase(), actif: true });
    return rep(200, { ok: true, ident: ident.toLowerCase(), mdp });
  }
  if (a === "compte-reset") {
    const c = await db.compteDe(txt(req.livreur_ref, 60)); if (!c) return err(404, "Compte livreur introuvable");
    const mdp = genererMdp(); await db.changerMdp(c.user_id, mdp, { chg: true, role: "livreur" }); return rep(200, { ok: true, mdp });
  }
  if (a === "compte-actif") {
    const c = await db.compteDe(txt(req.livreur_ref, 60)); if (!c) return err(404, "Compte livreur introuvable");
    const actif = !!req.actif; await db.bloquerUtilisateur(c.user_id, !actif); await db.majCompte(c.livreur_ref, { actif }); return rep(200, { ok: true, actif });
  }
  if (a === "vendeur-publier") {   /* le bureau publie, pour chaque vendeur ayant un compte, la projection de son espace (sans téléphone de client) */
    const L = Array.isArray(req.vendeurs) ? req.vendeurs.slice(0, 300) : [], inconnus = []; let ecrits = 0, ignores = 0;
    for (const v of L) {
      const ref = txt(v && v.vendeur_ref, 60), e = v && v.etat;
      if (!ref || !e || typeof e !== "object") { ignores++; continue; }
      if (!(await db.vendeurDe(ref))) { if (!inconnus.includes(ref)) inconnus.push(ref); continue; }
      if (db.retirerCleVendeur) await db.retirerCleVendeur(ref);   // un vendeur qui a un compte n'a plus de clé de relève : ses demandes lui arrivent dans son application
      await db.ecrireEtatVendeur(ref, nettoyerEtatVendeur(e), new Date(now).toISOString()); ecrits++;
    }
    return rep(200, { ok: true, ecrits, ignores, vendeurs_inconnus: inconnus });
  }
  if (a === "vendeur-commandes") return rep(200, { ok: true, commandes: await db.cmdsVendeurEnAttente(100) });
  if (a === "vendeur-acquitter") {
    const ids = (Array.isArray(req.ids) ? req.ids : []).map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 500);
    if (ids.length) await db.acquitterCmdsVendeur(ids); return rep(200, { ok: true, acquittes: ids.length });
  }
  if (a === "vendeur-compte-creer") {
    const ref = txt(req.vendeur_ref, 60), nom = txt(req.nom, 80), ident = txt(req.ident, 80);
    if (!ref || !nom || !ident) return err(400, "Vendeur, nom et identifiant obligatoires");
    if (ident.includes("@") ? !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ident) : !/^[A-Za-z0-9._-]{3,}$/.test(ident)) return err(400, "Identifiant : 3 caractères minimum (lettres, chiffres, point, tiret)");
    if (await db.vendeurDe(ref)) return err(409, "Ce vendeur a déjà un compte : réinitialisez son mot de passe");
    const mdp = genererMdp(); let uid;
    try { uid = await db.creerUtilisateur(emailDe(ident), mdp, { chg: true, role: "vendeur", nom }); } catch (e) { return err(409, "Cet identifiant existe déjà ou est refusé : " + txt(e && e.message, 120)); }
    await db.ecrireVendeur({ vendeur_ref: ref, user_id: uid, nom, ident: ident.toLowerCase(), actif: true });
    if (db.retirerCleVendeur) await db.retirerCleVendeur(ref);   // ses demandes ne sont plus réservées à une clé de relève : elles arrivent dans son application
    return rep(200, { ok: true, ident: ident.toLowerCase(), mdp });
  }
  if (a === "vendeur-compte-reset") {
    const c = await db.vendeurDe(txt(req.vendeur_ref, 60)); if (!c) return err(404, "Compte vendeur introuvable");
    const mdp = genererMdp(); await db.changerMdp(c.user_id, mdp, { chg: true, role: "vendeur", nom: c.nom }); return rep(200, { ok: true, mdp });
  }
  if (a === "vendeur-compte-actif") {
    const c = await db.vendeurDe(txt(req.vendeur_ref, 60)); if (!c) return err(404, "Compte vendeur introuvable");
    const actif = !!req.actif; await db.bloquerUtilisateur(c.user_id, !actif); await db.majVendeur(c.vendeur_ref, { actif }); return rep(200, { ok: true, actif });
  }
  return err(400, "Action inconnue");
}

/* ================= Livreur (JWT vérifié : userId fourni par la fonction) ================= */
export async function traiterAction(db, cfg, req, userId, now = Date.now()) {
  if (!userId) return err(401, "Connexion requise");
  const c = await db.compteParUtilisateur(userId); if (!c || !c.actif) return err(403, "Compte livreur inactif");
  const ref = txt(req.livraison_ref, 60), type = String(req.type || ""), d = (req.donnees && typeof req.donnees === "object") ? req.donnees : {};
  if (!TYPES.includes(type)) return err(400, "Action inconnue");
  const m = ref ? await db.mission(ref) : null;
  if (!m || m.livreur_ref !== c.livreur_ref) return err(403, "Cette mission n'est pas la vôtre");   // même réponse si elle n'existe pas
  const p = m.payload || {}, st = m.statut;
  const maj = { statut: st, payload: p }, ev = {};
  const refuse = (s, msg) => err(s, msg);

  if (type === "demande_signature") {   /* le livreur affiche un QR : le client signe sur SON téléphone (lien à usage unique, 15 minutes) */
    if (st !== "en_cours") return refuse(409, "La signature se fait pendant la livraison");
    let jeton = ""; const o = crypto.getRandomValues(new Uint8Array(16)); for (const x of o) jeton += ALPHA_J[x % ALPHA_J.length];
    const expire = new Date(now + 15 * 60000).toISOString();
    await db.ecrireJeton({ token_hash: await empreinteJeton(jeton), livraison_ref: ref, expire, utilise: false });
    return rep(200, { ok: true, statut: st, jeton, expire });
  }
  if (type === "signature_etat") {
    const pr = await db.preuve(ref);
    return rep(200, { ok: true, statut: st, signee: !!(pr && pr.signature_client), nom: pr && pr.client_nom || "", le: pr && pr.client_signe_le || null });
  }

  if (type === "accepter") { if (st !== "affectee") return refuse(409, "Cette mission n'est plus à accepter"); maj.statut = "acceptee"; }
  else if (type === "refuser") {
    if (!["affectee", "acceptee"].includes(st)) return refuse(409, "Cette mission ne peut plus être refusée"); const motif = txt(d.motif, 200);
    if (motif.length < 3) return refuse(400, "Motif obligatoire (3 caractères minimum)"); maj.statut = "refusee"; ev.motif = motif;
  }
  else if (type === "prise_en_charge") {
    if (st !== "acceptee" || p.collecte_at) return refuse(409, "Prise en charge impossible dans l'état actuel"); const nb = Math.round(nombre(d.nb_colis));
    if (!(nb >= 1 && nb <= 99)) return refuse(400, "Nombre de colis : entre 1 et 99");
    if (p.exige_colis && p.colis_total > 0) {   /* chaque colis doit être scanné à la prise en charge : le nombre est celui de la commande */
      const v = await verifierScans(db, { livraison_ref: ref, commande_ref: m.commande_ref }, d.scans);
      if (!v.ok) return refuse(403, v.msg); p.colis_collecte = v.scans; ev.scans = v.scans; ev.nb_colis = p.colis_total;
    }
    p.collecte_at = new Date(now).toISOString(); p.nb_colis = ev.nb_colis || nb; ev.nb_colis = p.nb_colis; ev.etat = txt(d.etat, 60);
  }
  else if (type === "demarrer") { if (st !== "acceptee" || !p.collecte_at) return refuse(409, "Prenez d'abord les colis en charge"); maj.statut = "en_cours"; }
  else if (type === "echec") {
    if (!STATUTS_ACTIFS.includes(st)) return refuse(409, "Livraison déjà clôturée"); const motif = txt(d.motif, 200); if (motif.length < 3) return refuse(400, "Motif obligatoire");
    maj.statut = "echouee"; ev.motif = motif; ev.obs = txt(d.obs, 300);
  }
  else if (type === "confirmer") {
    if (st !== "en_cours") return refuse(409, "Cette livraison n'est plus en cours");
    const k = await db.code(ref); if (!k) return refuse(409, "Code de confirmation indisponible : contactez le bureau");
    if (k.verrou_jusqua && Date.parse(k.verrou_jusqua) > now) return refuse(429, "Trop d'essais : code verrouillé, patientez ou contactez le bureau");
    const ok = egal(await empreinteCode(ref, d.code == null ? "" : d.code), k.code_hash);
    if (!ok) {
      const essais = (k.essais || 0) + 1, max = cfg.essaisCodeMax || 5;
      await db.majCode(ref, essais >= max ? { essais: 0, verrou_jusqua: new Date(now + 15 * 60000).toISOString() } : { essais });
      return refuse(403, essais >= max ? "Code incorrect : verrouillé 15 minutes" : "Code de confirmation incorrect");
    }
    const montant = Math.round(nombre(d.montant)), att = Math.round(nombre(p.montant_attendu) || 0), recu = txt(d.recu_par, 80);
    if (!(montant >= 0) || montant > 1e9) return refuse(400, "Montant encaissé invalide");
    if (!recu) return refuse(400, "Nom de la personne ayant reçu obligatoire");
    if (montant !== att && txt(d.ecart_note, 300).length < 3) return refuse(400, "Écart de " + (montant - att) + " F : explication obligatoire");
    /* preuves : colis remis (scan), signature (client sur son téléphone, sinon livreur), photo, position */
    if (p.exige_colis && p.colis_total > 0) { const v = await verifierScans(db, { livraison_ref: ref, commande_ref: m.commande_ref }, d.scans); if (!v.ok) return refuse(403, v.msg); ev.scans = v.scans; }
    const pr = await db.preuve(ref) || {}, sigL = typeof d.signature === "string" && d.signature ? d.signature : "";
    if (sigL && (!PNG.test(sigL) || sigL.length > SIG_MAX)) return refuse(400, "Signature illisible : recommencez");
    const photo = typeof d.photo === "string" && d.photo ? d.photo : "";
    if (photo && (!JPG.test(photo) || photo.length > PHOTO_MAX)) return refuse(400, "Photo illisible : reprenez-la");
    if (p.exige_signature && !pr.signature_client && !sigL) return refuse(400, "Signature du destinataire obligatoire pour cette commande");
    if (p.exige_photo && !photo && !pr.photo) return refuse(400, "Photo de la remise obligatoire pour ce type de colis");
    const g = d.gps && typeof d.gps === "object" ? { lat: nombre(d.gps.lat), lng: nombre(d.gps.lng), precision: Math.round(nombre(d.gps.precision) || 0) } : null, gps = g && Math.abs(g.lat) <= 90 && Math.abs(g.lng) <= 180 ? g : null;
    const patch = {}; if (sigL) patch.signature = sigL; if (photo) patch.photo = photo; if (gps) patch.gps = gps;
    if (Object.keys(patch).length) await db.ecrirePreuve(ref, patch);
    ev.preuve = !!(sigL || photo || pr.signature_client); ev.signature_source = pr.signature_client ? "client" : sigL ? "livreur" : ""; ev.photo = !!photo; if (gps) ev.gps = gps;
    await db.majCode(ref, { essais: 0, verrou_jusqua: null });
    maj.statut = "livree"; Object.assign(ev, { montant, mode: txt(d.mode, 40), ref_paiement: txt(d.ref, 60), direct: !!d.direct, recu_par: recu, obs: txt(d.obs, 300), ecart_note: txt(d.ecart_note, 300) });
  }
  else if (type === "position") {
    if (!STATUTS_ACTIFS.includes(st)) return refuse(409, "Pas de suivi hors mission");
    const lat = nombre(d.lat), lng = nombre(d.lng); if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return refuse(400, "Position invalide");
    const dernier = m.position_le ? Date.parse(m.position_le) : 0; ev.lat = lat; ev.lng = lng; ev.precision = Math.round(nombre(d.precision) || 0);
    await db.majPosition(ref, { lat, lng, precision: ev.precision, ts: new Date(now).toISOString() });
    if (now - dernier < 20000) return rep(200, { ok: true, statut: st });   // le bureau est informé au plus une fois toutes les 20 s
  }
  else if (type === "arrive") {   // « Je suis arrivé » : horodate l'arrivée à destination (début de l'attente)
    if (st !== "en_cours") return refuse(409, "Vous n'êtes pas en course : démarrez d'abord la livraison");
    if (p.contact && p.contact.arrive_at) return rep(200, { ok: true, statut: st });   // déjà signalé : rien à refaire
    p.contact = Object.assign({}, p.contact, { arrive_at: new Date(now).toISOString() }); ev.at = p.contact.arrive_at;
  }
  else if (type === "rappel_client") {   // « Le client ne répond pas » : demande au centre de rappeler le client
    if (st !== "en_cours") return refuse(409, "Cette demande se fait pendant la livraison");
    const dem = p.contact && p.contact.demande_le ? Date.parse(p.contact.demande_le) : 0;
    if (p.contact && p.contact.statut === "attente" && now - dem < 120000) return rep(200, { ok: true, statut: st });   // déjà transmise
    p.contact = Object.assign({}, p.contact, { statut: "attente", demande_le: new Date(now).toISOString() }); if (!p.contact.arrive_at) p.contact.arrive_at = p.contact.demande_le;
    ev.motif = txt(d.motif, 120) || "Je suis arrivé : le client ne répond pas";
  }
  else if (type === "incident") {
    ev.nature = txt(d.nature, 60); ev.description = txt(d.description, 300);
    const nat = ev.nature.toUpperCase();
    if (nat === "COLLECTE") {   /* collecte chez un vendeur (mission « col:… ») : accepter · refuser · partir · collecter (code du vendeur vérifié ici) */
      if (!/^col:/.test(ref) || !String(st).startsWith("col_")) return refuse(409, "Cette mission n'est pas une collecte");
      const act = String(d.action || ""); ev.action = act; ev.description = "COLLECTE|" + act;
      if (act === "accepter") { if (st !== "col_planifiee") return refuse(409, "Cette collecte ne peut plus être acceptée"); maj.statut = "col_acceptee"; }
      else if (act === "partir") { if (st !== "col_acceptee") return refuse(409, "Acceptez d'abord la collecte"); maj.statut = "col_en_route"; }
      else if (act === "refuser") {
        if (!["col_planifiee", "col_acceptee", "col_en_route"].includes(st)) return refuse(409, "Collecte déjà terminée");
        const motif = txt(d.motif, 200); if (motif.length < 3) return refuse(400, "Motif obligatoire (3 caractères minimum)"); ev.motif = motif; maj.statut = "col_echouee";
      }
      else if (act === "collecter") {
        if (!["col_acceptee", "col_en_route"].includes(st)) return refuse(409, "Cette collecte n'est pas en cours");
        const k = await db.code(ref); if (!k) return refuse(409, "Code du vendeur indisponible : contactez le bureau");
        if (k.verrou_jusqua && Date.parse(k.verrou_jusqua) > now) return refuse(429, "Trop d'essais : code verrouillé, patientez ou contactez le bureau");
        if (!egal(await empreinteCode(ref, d.code == null ? "" : d.code), k.code_hash)) {
          const essais = (k.essais || 0) + 1, max = cfg.essaisCodeMax || 5;
          await db.majCode(ref, essais >= max ? { essais: 0, verrou_jusqua: new Date(now + 15 * 60000).toISOString() } : { essais });
          return refuse(403, essais >= max ? "Code incorrect : verrouillé 15 minutes" : "Code du vendeur incorrect");
        }
        const ids = new Set((Array.isArray(p.lignes) ? p.lignes : []).map((l) => String(l && l.commande_id))), colis = {}; let tot = 0;
        for (const [cid, n] of Object.entries(d.colis && typeof d.colis === "object" ? d.colis : {})) {
          if (!ids.has(String(cid))) return refuse(400, "Commande étrangère à cette collecte");
          const q = Math.round(nombre(n)); if (!(q >= 0 && q <= 99)) return refuse(400, "Nombre de colis : entre 0 et 99"); colis[cid] = q; tot += q;
        }
        if (!tot) return refuse(400, "Indiquez le nombre de colis pris pour au moins une commande");
        ev.colis = colis; await db.majCode(ref, { essais: 0, verrou_jusqua: null }); maj.statut = "col_collectee";
      }
      else return refuse(400, "Action de collecte inconnue");
    }
    else if (nat === "VERSEMENT") {   /* déclaration d'un versement Mobile Money : le bureau vérifie la référence puis la caisse valide */
      if (!/^stats:/.test(ref)) return refuse(409, "Déclaration impossible depuis cette mission");
      const montant = Math.round(nombre(d.montant)), mode = txt(d.mode, 40), rf = txt(d.ref, 60).toUpperCase().replace(/[^A-Z0-9._-]/g, "");
      if (!(montant >= 1 && montant <= 1e9)) return refuse(400, "Montant invalide");
      if (!mode) return refuse(400, "Opérateur obligatoire"); if (rf.length < 4) return refuse(400, "Référence de la transaction obligatoire (4 caractères minimum)");
      Object.assign(ev, { montant, mode, ref_paiement: rf, note: txt(d.note, 100) }); ev.description = "VERSEMENT|" + montant + "|" + mode + "|" + rf;
    }
    else if (nat === "CLOTURE") {   /* « Terminer ma tournée » : le bureau enregistre la demande, le caissier clôture */
      if (!/^stats:/.test(ref)) return refuse(409, "Demande impossible depuis cette mission"); ev.description = "CLOTURE";
    }
    else if (!ev.description) return refuse(400, "Décrivez l'incident");
  }

  if (maj.statut !== st || type === "prise_en_charge" || type === "arrive" || type === "rappel_client") await db.majMission(ref, { statut: maj.statut, payload: p, maj_le: new Date(now).toISOString() });
  await db.ajouterEvenement({ livraison_ref: ref, livreur_ref: c.livreur_ref, type, donnees: ev });
  return rep(200, { ok: true, statut: maj.statut });
}

/* Liste des livreurs actifs pour l'écran de connexion (liste déroulante). Publique par nature (appelée avant toute connexion) :
   seuls l'identifiant de connexion et le nom sont exposés, jamais téléphone, mission ni identifiant interne ; désactivable (LISTE_LIVREURS_LOGIN=0). */
/* Liste des vendeurs partenaires actifs (identifiant de connexion + nom) pour la liste déroulante de l'écran de connexion de l'application vendeur. */
export async function listerVendeurs(db, cfg) {
  if (cfg && cfg.listeVendeursLogin === false) return rep(200, { ok: true, vendeurs: [] });
  const L = (await db.vendeursActifs()) || [];
  return rep(200, { ok: true, vendeurs: L.filter((x) => x && x.ident && x.actif !== false).slice(0, 200).map((x) => ({ ident: String(x.ident).toLowerCase(), nom: String(x.nom || "").slice(0, 80) })) });
}

export async function listerLivreurs(db, cfg) {
  if (cfg && cfg.listeLogin === false) return rep(200, { ok: true, livreurs: [] });
  const L = (await db.livreursActifs()) || [];
  return rep(200, { ok: true, livreurs: L.filter((x) => x && x.ident && x.actif !== false).slice(0, 200).map((x) => ({ ident: String(x.ident).toLowerCase(), nom: String(x.nom || "").slice(0, 80) })) });
}
