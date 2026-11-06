// POST /compta-groupe : comptabilité du groupe. Les applications publient leurs synthèses (en-tête x-sync-key) ; les personnes se connectent avec leur mot de passe et ne reçoivent que les sections de leur profil (voir _shared/compta-groupe.js).
import { CORS, traiterCompta } from "../_shared/compta-groupe.js";
import { dbCompta, cfgCompta } from "../_shared/serveur-compta.js";

const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  try { const r = await traiterCompta(dbCompta(), cfgCompta(), b, req.headers.get("x-sync-key")); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
