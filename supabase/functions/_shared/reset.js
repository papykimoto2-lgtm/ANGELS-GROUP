/* Remise à zéro du serveur pour le passage en production : logique pure, testée hors Supabase (voir tests/reset-serveur.js).
   Triple verrou : clé de synchronisation des postes + CODE DE SÉCURITÉ propre à cette opération (secret RESET_CODE, jamais dans l'application) + phrase de confirmation.
   Sans RESET_CODE configuré, la fonction ne peut rien effacer. Chaque exécution est journalisée (table reset_journal). */
import { egal } from "./pont.js";

export { CORS } from "./pont.js";

export const PHRASE = "VIDER LE SERVEUR";
const rep = (status, body) => ({ status, body });
const err = (status, message, extra = {}) => rep(status, { ok: false, erreur: message, ...extra });
const txt = (v, n) => String(v == null ? "" : v).trim().slice(0, n);

/** cfg = { syncKey, resetCode } ; db = { reset(executer, par) → { table: nombre } } ; attente(ms) injectable pour les tests */
export async function traiterReset(db, cfg, req, cle, attente = (ms) => new Promise((r) => setTimeout(r, ms))) {
  if (!cfg.syncKey || !egal(cle, cfg.syncKey)) return err(401, "Clé de synchronisation invalide");
  const action = txt(req.action, 12);
  if (action === "apercu") return rep(200, { ok: true, configure: !!cfg.resetCode, phrase: PHRASE, comptes: await db.reset(false, "") });
  if (action !== "vider") return err(400, "Action inconnue");
  if (!cfg.resetCode || String(cfg.resetCode).length < 8) return err(503, "Code de sécurité non configuré : créez le secret RESET_CODE (8 caractères minimum) dans Supabase → Edge Functions → Secrets.");
  if (!egal(String(req.code || ""), String(cfg.resetCode))) { await attente(1500); return err(403, "Code de sécurité incorrect"); }
  if (String(req.phrase || "").trim() !== PHRASE) return err(400, `Confirmation incorrecte : saisissez ${PHRASE}`);
  if (req.sauvegarde !== true) return err(400, "Sauvegarde non confirmée : téléchargez d'abord la sauvegarde de l'application.");
  const comptes = await db.reset(true, txt(req.par, 80));
  return rep(200, { ok: true, comptes, total: Object.values(comptes).reduce((a, n) => a + Number(n || 0), 0) });
}
