/* Adaptateur Supabase du suivi en direct (clé « service role » : jamais exposée au navigateur). */
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cfgSuivi = () => ({ adminKey: Deno.env.get("ADMIN_KEY") });

export function dbSuivi(sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } })) {
  const ok = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    lireSuivi: async (cle) => ok(await sb.from("pg_suivi").select("cle,livraison_ref,etat,termine_le,maj_le").eq("cle", cle).maybeSingle()),
    lireSuivis: async (cles) => ok(await sb.from("pg_suivi").select("cle,termine_le").in("cle", cles)) || [],
    ecrireSuivis: async (lignes) => { for (let i = 0; i < lignes.length; i += 100) ok(await sb.from("pg_suivi").upsert(lignes.slice(i, i + 100), { onConflict: "cle" })); },
    lireMission: async (ref) => ok(await sb.from("pg_missions").select("statut,position,position_le").eq("livraison_ref", ref).maybeSingle()),
    ecrireCles: async (lignes) => ok(await sb.from("pg_cles_publiques").upsert(lignes, { onConflict: "kid" })),
    lireCles: async () => ok(await sb.from("pg_cles_publiques").select("kid,pub").order("maj_le", { ascending: false }).limit(10)) || [],
    purger: async (limite) => ok(await sb.from("pg_suivi").delete().lt("termine_le", limite)),
  };
}
