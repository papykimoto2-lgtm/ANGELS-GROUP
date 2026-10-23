// POST /vendeur-sync (jeton du vendeur, vérifié par Supabase) : le vendeur partenaire lit SON espace (commandes, règlements, solde, lien client) publié par le bureau.
// Corps : { action: "etat" }. Le serveur ne renvoie jamais de téléphone de client ni de donnée d'un autre vendeur.
import { CORS, traiterVendeurEtat } from "../_shared/passerelle.js";
import { client, dbPasserelle } from "../_shared/serveur-passerelle.js";

const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" } });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  const sb = client(), jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const u = jeton ? await sb.auth.getUser(jeton) : null;
  try { const r = await traiterVendeurEtat(dbPasserelle(sb), b, u && u.data && u.data.user ? u.data.user.id : null); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
