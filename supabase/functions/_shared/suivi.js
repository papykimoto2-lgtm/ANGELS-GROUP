/* Suivi de livraison en direct : logique pure, testée hors Supabase (voir tests/suivi-direct-serveur.js).

   Principe : le bureau PUBLIE l'état de chaque commande dont un lien de suivi a été créé (fonction suivi-publier, clé d'administration) ;
   la page publique du client INTERROGE l'état avec la clé du lien (fonction suivi-live, sans compte). La position du livreur n'est pas publiée par le bureau :
   elle est lue à la demande dans la mission (pg_missions.position), mise à jour par l'application du livreur.
   Jamais renvoyés au client : numéros de téléphone, code de confirmation, identifiants internes (commande, livraison, livreur). */

import { egal } from "./pont.js";

export { CORS } from "./pont.js";

const rep = (status, body) => ({ status, body });
const err = (status, message, extra) => rep(status, Object.assign({ ok: false, erreur: message }, extra || {}));
const txt = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const iso = (t) => new Date(t).toISOString();
export const CLE_RE = /^[A-Za-z0-9_-]{20,64}$/;
export const EXPIRE_APRES_MS = 48 * 3600 * 1000;        // lien valable 48 h après la fin de la commande
export const POSITION_MAX_MS = 30 * 60 * 1000;           // au-delà, la position n'est plus montrée
export const LOT_MAX = 200;
const RANG = { brouillon: 0, attente: 0, confirmee: 1, preparation: 2, prete: 2, affectee: 3, acceptee: 3, en_cours: 4, livree: 5 };
const STATUTS = [...Object.keys(RANG), "annulee", "echouee", "retour_cours", "retour_recu"];
const FINAUX = ["livree", "annulee", "echouee", "retour_cours", "retour_recu"];
const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;
const coord = (a) => { if (!Array.isArray(a)) return undefined; const la = +a[0], lo = +a[1]; return la >= -85 && la <= 85 && lo >= -180 && lo <= 180 && !(la === 0 && lo === 0) ? [Math.round(la * 1e6) / 1e6, Math.round(lo * 1e6) / 1e6] : undefined; };

/** Projection publique : liste blanche stricte (aucun champ inconnu ne sort, aucun numéro de téléphone). */
export function etatPublic(e) {
  e = e && typeof e === "object" ? e : {};
  const o = { o: txt(e.o, 80), w: String(e.w == null ? "" : e.w).replace(/\D/g, "").slice(0, 20), n: txt(e.n, 30), s: STATUTS.includes(e.s) ? e.s : "attente", l: txt(e.l, 100), v: txt(e.v, 30),
    e: ISO_RE.test(e.e || "") ? String(e.e).slice(0, 24) : "", ap: Math.max(0, Math.round(+e.ap || 0)),
    h: (Array.isArray(e.h) ? e.h : []).slice(0, 40).filter((x) => Array.isArray(x)).map((x) => [txt(x[0], 20), ISO_RE.test(x[1] || "") ? String(x[1]).slice(0, 24) : ""]) };
  if (Array.isArray(e.xp)) o.xp = e.xp.slice(0, 5).map((x) => txt(x, 40));
  const x = coord(e.x); if (x) o.x = x;
  return o;
}

/* 1. Bureau : publie l'état des liens de suivi et les clés publiques de signature. */
export async function publierSuivi(db, cfg, req, adminKey, now = Date.now()) {
  if (!cfg.adminKey || !egal(adminKey, cfg.adminKey)) return err(401, "Clé d'administration invalide");
  const items = (Array.isArray(req.suivis) ? req.suivis : []).slice(0, LOT_MAX), propres = [];
  for (const it of items) {
    const cle = String(it && it.cle || ""), commande_ref = txt(it && it.commande_ref, 60);
    if (!CLE_RE.test(cle) || !commande_ref) continue;
    propres.push({ cle, commande_ref, livraison_ref: txt(it.livraison_ref, 80) || null, etat: etatPublic(it.etat), termine: !!it.termine || FINAUX.includes(it.etat && it.etat.s) });
  }
  let n = 0;
  if (propres.length) {
    const avant = new Map((await db.lireSuivis(propres.map((p) => p.cle))).map((r) => [r.cle, r]));
    const lignes = propres.map((p) => { const a = avant.get(p.cle); return { cle: p.cle, commande_ref: p.commande_ref, livraison_ref: p.livraison_ref, etat: p.etat, termine_le: p.termine ? (a && a.termine_le ? a.termine_le : iso(now)) : null, maj_le: iso(now) }; });
    await db.ecrireSuivis(lignes); n = lignes.length;
  }
  const cles = [];
  for (const k of (Array.isArray(req.cles) ? req.cles : []).slice(0, 10)) {
    const kid = txt(k && k.kid, 40), p = k && k.pub;
    if (!/^[A-Za-z0-9_-]{4,40}$/.test(kid) || !p || p.kty !== "EC" || p.crv !== "P-256" || !/^[A-Za-z0-9_-]{20,100}$/.test(p.x || "") || !/^[A-Za-z0-9_-]{20,100}$/.test(p.y || "")) continue;
    cles.push({ kid, pub: { kty: "EC", crv: "P-256", x: p.x, y: p.y }, maj_le: iso(now) });
  }
  if (cles.length) await db.ecrireCles(cles);
  await db.purger(iso(now - 7 * 864e5));
  return rep(200, { ok: true, publies: n, cles: cles.length });
}

/* 2. Client : lit l'état en direct avec la clé de son lien. Même réponse que la clé existe ou non. */
export async function lireSuivi(db, req, now = Date.now()) {
  if (String(req.action || "") === "cles") return rep(200, { ok: true, cles: (await db.lireCles()).map((c) => ({ kid: c.kid, pub: c.pub })) });
  const cle = String(req.cle || "");
  const ligne = CLE_RE.test(cle) ? await db.lireSuivi(cle) : null;
  if (!ligne) return err(404, "Lien de suivi inconnu");
  if (ligne.termine_le && now - Date.parse(ligne.termine_le) > EXPIRE_APRES_MS) return err(410, "Ce lien de suivi a expiré", { expire: true });
  const mission = ligne.livraison_ref ? await db.lireMission(ligne.livraison_ref) : null;
  const etat = etatPublic(ligne.etat);
  if (mission && RANG[mission.statut] != null && RANG[mission.statut] > (RANG[etat.s] == null ? -1 : RANG[etat.s])) etat.s = mission.statut;   // la mission avance avant que le bureau ait republié
  let pos = null;
  if (etat.s === "en_cours" && mission && mission.position && mission.position_le) {
    const t = Date.parse(mission.position_le), la = +mission.position.lat, lo = +mission.position.lng;
    if (t && now - t >= -60000 && now - t <= POSITION_MAX_MS && Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !(la === 0 && lo === 0))
      pos = { lat: Math.round(la * 1e6) / 1e6, lng: Math.round(lo * 1e6) / 1e6, ts: iso(t), age_s: Math.max(0, Math.round((now - t) / 1000)), precision: Math.max(0, Math.round(+mission.position.precision || 0)) };
  }
  return rep(200, { ok: true, etat, pos, maj: iso(Date.parse(ligne.maj_le) || now), serveur: iso(now) });
}
