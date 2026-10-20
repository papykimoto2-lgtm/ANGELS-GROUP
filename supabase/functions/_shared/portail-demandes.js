/* Demandes du portail public → bureau : logique pure, testée hors Supabase (voir tests/portail-demandes.js).

   Le portail envoie le même message que sur WhatsApp (avec son marqueur [BOUTIQUE:…], [LIVRAISON:…] ou [ABONNEMENT:…]). Le serveur le contrôle, limite le débit
   par visiteur, dédoublonne sur la référence et le met en file. Le bureau (clé d'administration) relève la file, importe chaque message dans Distributions
   — avec les mêmes contrôles que l'import manuel — puis acquitte. Rien n'est jamais renvoyé au visiteur, hors la référence de sa demande. */

import { egal, sha256hex } from "./pont.js";

export { CORS } from "./pont.js";

const rep = (status, body) => ({ status, body });
const err = (status, message) => rep(status, { ok: false, erreur: message });
const MARQ = /\[(BOUTIQUE|LIVRAISON|ABONNEMENT):([A-Za-z0-9_-]{8,5000})\]/g;
const TAILLE_MAX = 6000, PAR_MESSAGE_MAX = 3;

function decoder(s) {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
  const bin = atob(s), o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  if (!o || typeof o !== "object" || Array.isArray(o)) throw new Error("charge utile invalide");
  return o;
}
/* Marqueurs d'un message : [{type, ref}] — chaque charge utile doit se décoder et porter une référence « f » */
export function lireMarqueurs(message) {
  const out = [];
  for (const m of String(message).matchAll(MARQ)) {
    let o; try { o = decoder(m[2]); } catch { throw new Error("Demande illisible"); }
    const ref = String(o.f || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);
    if (ref.length < 3) throw new Error("Référence de demande absente");
    out.push({ type: m[1], ref });
  }
  return out;
}
export const empreinteVisiteur = (ip, sel) => sha256hex("portail|" + String(sel || "") + "|" + String(ip || "inconnu"));

/* ================= Visiteur du portail (public) ================= */
export async function recevoir(db, cfg, req, ip, now = Date.now()) {
  const message = typeof req.message === "string" ? req.message.trim() : "";
  if (!message) return err(400, "Message absent");
  if (message.length > TAILLE_MAX) return err(413, "Message trop long");
  let M; try { M = lireMarqueurs(message); } catch (e) { return err(400, e.message); }
  if (!M.length) return err(400, "Aucune demande dans ce message");
  if (M.length > PAR_MESSAGE_MAX) return err(400, "Trop de demandes dans un même message");
  if (new Set(M.map((x) => x.ref)).size !== M.length) return err(400, "Références en double");
  const h = await empreinteVisiteur(ip, cfg.sel);
  if ((await db.compterRecentes(h, new Date(now - 3600000).toISOString())) + M.length > (cfg.limiteHeure || 20)) return err(429, "Trop de demandes depuis cet appareil : réessayez plus tard ou utilisez WhatsApp");
  if ((await db.enAttente()) >= (cfg.fileMax || 2000)) return err(503, "Service momentanément saturé : utilisez WhatsApp");
  const recues = [], doublons = [];
  for (const m of M) {
    if (await db.existe(m.ref)) { doublons.push(m.ref); continue; }
    await db.inserer({ ref: m.ref, type: m.type, message, ip_hash: h }); recues.push(m.ref);
  }
  return rep(200, { ok: true, refs: recues.concat(doublons), doublons: doublons.length });
}

/* ================= Bureau (clé d'administration) ================= */
export async function traiterBureau(db, cfg, req, adminKey) {
  if (!cfg.adminKey || !egal(adminKey, cfg.adminKey)) return err(401, "Clé d'administration invalide");
  const a = String(req.action || "");
  if (a === "lister") return rep(200, { ok: true, demandes: await db.enAttenteListe(100) });
  if (a === "publier") return publierCatalogue(db, req);
  if (a === "acquitter") {
    const ids = (Array.isArray(req.ids) ? req.ids : []).map(Number).filter((x) => Number.isInteger(x) && x > 0).slice(0, 500);
    if (ids.length) await db.acquitter(ids); return rep(200, { ok: true, acquittes: ids.length });
  }
  return err(400, "Action inconnue");
}

/* ================= Catalogue public du portail ================= */
const PHOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
/* Le bureau publie le catalogue (jeton de boutique + photos) : contrôlé, borné, puis remplace la version précédente. */
async function publierCatalogue(db, req) {
  const boutique = typeof req.boutique === "string" ? req.boutique : "";
  if (boutique && !/^[A-Za-z0-9_-]{20,300000}$/.test(boutique)) return err(400, "Catalogue illisible");
  const ph = req.photos && typeof req.photos === "object" && !Array.isArray(req.photos) ? req.photos : {}, photos = {}; let total = 0;
  for (const [k, v] of Object.entries(ph).slice(0, 300)) {
    const code = String(k).slice(0, 30);
    if (!code || typeof v !== "string" || v.length > 70000 || !PHOTO.test(v)) continue;
    total += v.length; if (total > 4000000) return err(413, "Photos trop volumineuses (4 Mo au plus)");
    photos[code] = v;
  }
  await db.ecrireCatalogue({ boutique, photos });
  return rep(200, { ok: true, photos: Object.keys(photos).length, ignorees: Object.keys(ph).length - Object.keys(photos).length });
}
/* Visiteur du portail : lecture seule du catalogue publié */
export async function lireCatalogue(db) {
  const c = await db.lireCatalogue(); if (!c || !c.boutique) return rep(200, { ok: true, boutique: "", photos: {}, maj_le: null });
  return rep(200, { ok: true, boutique: c.boutique, photos: c.photos || {}, maj_le: c.maj_le });
}
