// GET /livreurs-liste (public, sans jeton : déployer avec --no-verify-jwt) : liste des livreurs actifs (identifiant de connexion + nom) pour la liste
// déroulante de l'écran de connexion du livreur. Désactivable : variable LISTE_LIVREURS_LOGIN=0 (la liste est alors vide).
import { CORS, listerLivreurs } from "../_shared/passerelle.js";
import { dbPasserelle, cfgPasserelle } from "../_shared/serveur-passerelle.js";

const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS", "Cache-Control": "no-store", "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" } });
  if (req.method !== "GET") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  try { const r = await listerLivreurs(dbPasserelle(), cfgPasserelle()); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
