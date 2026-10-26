// /lien-court (déployer avec verify_jwt = false)
//  POST {action:"creer", cible} + en-tête x-admin-key (le bureau)  -> { ok, code }
//  GET  ?c=CODE (public : le client ouvre le lien)                  -> { ok, cible }
// La cible est un chemin RELATIF d'une page de l'application (jamais une adresse externe) : pas de redirection ouverte.
import { CORS, egal } from "../_shared/pont.js";
import { createClient } from "jsr:@supabase/supabase-js@2";

const J = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store", "Content-Type": "application/json" } });
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";   // sans 0/O, 1/I/L : lisible à voix haute
const code = (n = 7) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return [...b].map((x) => ALPHA[x % ALPHA.length]).join(""); };
export const cibleValide = (c) => typeof c === "string" && c.length >= 3 && c.length <= 12000 && /^(portail|distribution|vendeur|livreur|centre|suivi|boutique)(\.html)?([#?\/][^\s<>"']*)?$/.test(c);
const sb = () => createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...CORS, "Access-Control-Allow-Methods": "GET, POST, OPTIONS" } });
  try {
    if (req.method === "GET") {
      const c = (new URL(req.url).searchParams.get("c") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (c.length < 5 || c.length > 12) return J(400, { ok: false, erreur: "Lien invalide" });
      const { data, error } = await sb().from("pg_liens").select("cible,expire_le").eq("code", c).maybeSingle();
      if (error) throw error;
      if (!data) return J(404, { ok: false, erreur: "Lien introuvable" });
      if (new Date(data.expire_le) < new Date()) return J(410, { ok: false, erreur: "Lien expiré" });
      return J(200, { ok: true, cible: data.cible });
    }
    if (req.method !== "POST") return J(405, { ok: false, erreur: "Méthode non autorisée" });
    const admin = Deno.env.get("ADMIN_KEY"); if (!admin || !egal(req.headers.get("x-admin-key"), admin)) return J(401, { ok: false, erreur: "Clé d'administration invalide" });
    let b; try { b = await req.json(); } catch { return J(400, { ok: false, erreur: "JSON invalide" }); }
    if (b.action !== "creer" || !cibleValide(b.cible)) return J(400, { ok: false, erreur: "Cible invalide" });
    const db = sb();
    for (let i = 0; i < 5; i++) {
      const c = code(), r = await db.from("pg_liens").insert({ code: c, cible: b.cible });
      if (!r.error) return J(200, { ok: true, code: c });
      if (!/duplicate|unique/i.test(r.error.message)) throw r.error;
    }
    return J(500, { ok: false, erreur: "Génération impossible" });
  } catch (e) { return J(500, { ok: false, erreur: "Erreur serveur" }); }
});
