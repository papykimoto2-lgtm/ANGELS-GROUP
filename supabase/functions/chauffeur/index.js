// POST /chauffeur : application chauffeur (téléphone). Authentification par mot de passe personnel + jeton signé ; chaque chauffeur n'accède qu'à ses données (voir _shared/chauffeur.js).
import { CORS, traiterChauffeur } from "../_shared/chauffeur.js";
import { dbChauffeur, cfgChauffeur } from "../_shared/serveur-chauffeur.js";

const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  try { const r = await traiterChauffeur(dbChauffeur(), cfgChauffeur(), b); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
