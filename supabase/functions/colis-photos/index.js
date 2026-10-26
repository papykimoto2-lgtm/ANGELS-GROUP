// POST /colis-photos (en-tête x-admin-key) : le bureau publie les photos des colis des livraisons en cours (voir _shared/colis-photos.js).
import { CORS, publierPhotos } from "../_shared/colis-photos.js";
import { dbPhotos, cfgPhotos } from "../_shared/serveur-colis-photos.js";

const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  try { const r = await publierPhotos(dbPhotos(), cfgPhotos(), b || {}, req.headers.get("x-admin-key")); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
