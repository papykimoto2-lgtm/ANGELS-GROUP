/* Adaptateur Supabase de la remise à zéro (clé « service role » : jamais exposée au navigateur). */
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cfgReset = () => ({ syncKey: Deno.env.get("SYNC_KEY"), resetCode: Deno.env.get("RESET_CODE") });

export function dbReset(sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } })) {
  return { reset: async (executer, par) => { const r = await sb.rpc("reset_production", { p_executer: !!executer, p_par: par || "" }); if (r.error) throw new Error(r.error.message); return r.data || {}; } };
}
