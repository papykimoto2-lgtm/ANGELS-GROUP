// POST /reset (en-tête x-sync-key) : remise à zéro du serveur pour le passage en production. Actions : apercu · vider (voir _shared/reset.js).
import { CORS, traiterReset } from "../_shared/reset.js";
import { dbReset, cfgReset } from "../_shared/serveur-reset.js";

const ENT = { ...CORS, "Access-Control-Allow-Headers": "content-type, x-sync-key" };
const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...ENT, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: ENT });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  try { const r = await traiterReset(dbReset(), cfgReset(), b, req.headers.get("x-sync-key")); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
