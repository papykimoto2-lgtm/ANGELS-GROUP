// POST /portail-vendeur (déployer avec --no-verify-jwt) : un vendeur partenaire relève SES demandes de clients, gère son QR signé, son live et ses statistiques.
// Deux identifications possibles : { vendeur, cle } (clé de relève remise par le bureau, portail-sync action cle_vendeur) OU le jeton de CONNEXION du vendeur (en-tête Authorization,
// application vendeur.html) : le serveur retrouve alors le vendeur par son compte, sans clé. Actions : lister · photos · acquitter · lien_signer · lien_renouveler · live_publier · live_lire · stats.
import { CORS, traiterVendeur } from "../_shared/portail-demandes.js";
import { dbPortail, cfgPortail, clientPortail } from "../_shared/serveur-portail.js";

const CORS_JETON = { ...CORS, "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info" };
const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS_JETON, "Content-Type": "application/json" } });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_JETON });
  if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
  let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
  try {
    const sb = clientPortail(), db = dbPortail(sb), jeton = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    let auth = null;
    if (jeton && !b.cle) {   // jeton de connexion valide d'un vendeur actif : identifié par son compte ; sinon on retombe sur la clé de relève (qui échouera si absente)
      const u = await sb.auth.getUser(jeton), uid = u && u.data && u.data.user ? u.data.user.id : null;
      const c = uid ? await db.vendeurParUtilisateur(uid) : null;
      if (c) { if (!c.actif) return J(403, { ok: false, erreur: "Compte vendeur bloqué" }); auth = { vendeur: c.vendeur_ref }; }
    }
    const r = await traiterVendeur(db, b, cfgPortail(), auth); return J(r.status, r.body);
  } catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
