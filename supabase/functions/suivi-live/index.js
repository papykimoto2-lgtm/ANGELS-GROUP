// POST /suivi-live (sans compte, sans en-tête secret) : état en direct d'une livraison à partir de la clé du lien de suivi. Actions : {cle} · {action:"cles"} (voir _shared/suivi.js).
import { CORS, lireSuivi } from "../_shared/suivi.js";
import { dbSuivi } from "../_shared/serveur-suivi.js";

const ENT = { ...CORS, "Access-Control-Allow-Headers": "content-type", "Cache-Control": "no-store" };
const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...ENT, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: ENT });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  try { const r = await lireSuivi(dbSuivi(), b || {}); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
