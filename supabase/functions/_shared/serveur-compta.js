/* Adaptateur Supabase de la comptabilité du groupe (clé « service role » : jamais exposée au navigateur). Même contrat que tests/compta-groupe-memoire.js. */
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cfgCompta = () => ({ cle: Deno.env.get("COMPTA_KEY"), syncKey: Deno.env.get("SYNC_KEY") });

export function dbCompta(sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } })) {
  const ok = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    /* comptes d'une application (collection « users » synchronisée) */
    users: async (app) => (ok(await sb.from("sync_enreg").select("data").eq("app", app).eq("coll", "users").eq("supprime", false).limit(1000)) || []).map((x) => x.data),
    synthese: async (cle) => { const r = ok(await sb.from("compta_synthese").select("data").eq("cle", cle).maybeSingle()); return r ? r.data : null; },
    syntheses: async (cles) => ok(await sb.from("compta_synthese").select("cle,data").in("cle", cles)) || [],
    ecrireSynthese: async (cle, data, par) => { ok(await sb.from("compta_synthese").upsert({ cle, data, par, maj: new Date().toISOString() }, { onConflict: "cle" })); },
    droits: async () => { const r = ok(await sb.from("compta_droits").select("data").eq("id", 1).maybeSingle()); return r ? r.data : null; },
    ecrireDroits: async (data, par) => { if (!data) { ok(await sb.from("compta_droits").delete().eq("id", 1)); return; } ok(await sb.from("compta_droits").upsert({ id: 1, data, par, maj: new Date().toISOString() }, { onConflict: "id" })); },
    essais: async (uid) => { const r = ok(await sb.from("compta_essais").select("n,until").eq("uid", uid).maybeSingle()); return r ? { n: r.n, until: r.until ? new Date(r.until).getTime() : 0 } : null; },
    noterEssai: async (uid, e) => { ok(await sb.from("compta_essais").upsert({ uid, n: e.n, until: e.until ? new Date(e.until).toISOString() : null, maj: new Date().toISOString() }, { onConflict: "uid" })); },
    effacerEssais: async (uid) => { ok(await sb.from("compta_essais").delete().eq("uid", uid)); },
    journaliser: async (e) => { ok(await sb.from("compta_journal").insert(e)); },
    journal: async (n) => ok(await sb.from("compta_journal").select("t,ev,app,nom,role,motif").order("id", { ascending: false }).limit(n)) || [],
  };
}
