// POST /fne (en-tête x-sync-key) : certification des factures auprès de la DGI (FNE). Actions : etat · signer · avoir (voir _shared/fne.js).
import { CORS, traiterFne } from "../_shared/fne.js";
import { dbFne, cfgFne } from "../_shared/serveur-fne.js";

const ENT = { ...CORS, "Access-Control-Allow-Headers": "content-type, x-sync-key" };
const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...ENT, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: ENT });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  try { const r = await traiterFne(dbFne(), cfgFne(), b, req.headers.get("x-sync-key"), fetch); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
