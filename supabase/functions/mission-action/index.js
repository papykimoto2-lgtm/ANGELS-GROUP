// POST /mission-action (jeton du livreur, vérifié par Supabase) : le livreur envoie une action sur SA mission (accepter, refuser, prise_en_charge,
// demarrer, confirmer avec le code du client, echec, position, incident, arrive, rappel_client). Le serveur valide puis met l'événement en file pour le bureau.
import { CORS, traiterAction, empreinteIp } from "../_shared/passerelle.js";
import { client, dbPasserelle, cfgPasserelle } from "../_shared/serveur-passerelle.js";

const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" } });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  /* empreinte de la connexion Internet du livreur (même calcul que la signature client) : sert à repérer une signature « client » faite depuis la même connexion */
  const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  b.ip_hash = await empreinteIp(Deno.env.get("PORTAIL_SEL") || Deno.env.get("ADMIN_KEY") || "", ip);
  const sb = client(), jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const u = jeton ? await sb.auth.getUser(jeton) : null;
  try { const r = await traiterAction(dbPasserelle(sb), cfgPasserelle(), b, u && u.data && u.data.user ? u.data.user.id : null); return J(r.status, r.body); }
  catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
