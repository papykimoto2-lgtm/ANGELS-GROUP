// POST /suivi-publier (en-tête x-admin-key) : le bureau publie l'état des liens de suivi et les clés publiques de signature (voir _shared/suivi.js).
import { CORS, publierSuivi } from "../_shared/suivi.js";
import { dbSuivi, cfgSuivi } from "../_shared/serveur-suivi.js";

const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  try { const r = await publierSuivi(dbSuivi(), cfgSuivi(), b || {}, req.headers.get("x-admin-key")); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
