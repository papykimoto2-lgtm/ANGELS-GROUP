/* Adaptateur Supabase des demandes du portail (clé « service role » : jamais exposée au navigateur). */
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cfgPortail = () => ({ adminKey: Deno.env.get("ADMIN_KEY"), sel: Deno.env.get("PORTAIL_SEL") || Deno.env.get("ADMIN_KEY") || "", limiteHeure: +(Deno.env.get("PORTAIL_LIMITE_HEURE") || 20), fileMax: +(Deno.env.get("PORTAIL_FILE_MAX") || 2000) });

export function dbPortail(sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } })) {
  const ok = (r) => { if (r.error) throw new Error(r.error.message); return r; };
  const t = () => sb.from("pd_demandes");
  return {
    compterRecentes: async (h, depuis) => ok(await t().select("id", { count: "exact", head: true }).eq("ip_hash", h).gte("cree_le", depuis)).count || 0,
    enAttente: async () => ok(await t().select("id", { count: "exact", head: true }).eq("traite", false)).count || 0,
    existe: async (ref) => !!ok(await t().select("id").eq("ref", ref).maybeSingle()).data,
    inserer: async (row) => ok(await t().insert(row)),
    enAttenteListe: async (n) => ok(await t().select("id,ref,type,message,cree_le").eq("traite", false).order("id").limit(n)).data || [],
    acquitter: async (ids) => ok(await t().update({ traite: true, traite_le: new Date().toISOString() }).in("id", ids)),
  };
}
