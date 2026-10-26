/* Photos des colis à livrer : logique pure, testée hors Supabase (voir tests/colis-photos-serveur.js).
   Le bureau PUBLIE l'ensemble des photos de chaque livraison en cours (fonction colis-photos, clé d'administration) : ce jeu remplace le précédent.
   Le livreur les LIT directement (politique d'accès : seulement les photos de ses missions). Images : JPEG réduit uniquement, 70 000 caractères au plus. */

import { egal } from "./pont.js";

export { CORS } from "./pont.js";

const rep = (status, body) => ({ status, body });
const err = (status, message) => rep(status, { ok: false, erreur: message });
const txt = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
export const PHOTO_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
export const PHOTO_MAX = 70000;
export const COLIS_MAX = 20;
export const LIVRAISONS_MAX = 20;

export async function publierPhotos(db, cfg, req, adminKey, now = Date.now()) {
  if (!cfg.adminKey || !egal(adminKey, cfg.adminKey)) return err(401, "Clé d'administration invalide");
  let nL = 0, nP = 0, refus = 0;
  for (const l of (Array.isArray(req.livraisons) ? req.livraisons : []).slice(0, LIVRAISONS_MAX)) {
    const ref = txt(l && l.livraison_ref, 80); if (!ref) continue;
    const vues = new Set(), lignes = [];
    for (const p of (Array.isArray(l.photos) ? l.photos : []).slice(0, COLIS_MAX)) {
      const n = Math.round(+(p && p.n)), ph = String(p && p.photo || "");
      if (!(n >= 1 && n <= COLIS_MAX) || vues.has(n) || ph.length > PHOTO_MAX || !PHOTO_RE.test(ph)) { refus++; continue; }
      vues.add(n); lignes.push({ livraison_ref: ref, n, photo: ph, maj_le: new Date(now).toISOString() });
    }
    await db.remplacer(ref, lignes); nL++; nP += lignes.length;
  }
  const retirer = (Array.isArray(req.retirer) ? req.retirer : []).slice(0, 100).map((r) => txt(r, 80)).filter(Boolean);
  if (retirer.length) await db.retirer(retirer);
  await db.purger(new Date(now - 7 * 864e5).toISOString());
  return rep(200, { ok: true, livraisons: nL, photos: nP, refusees: refus });
}
