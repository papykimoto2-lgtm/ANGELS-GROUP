/* Adaptateur Supabase de la certification FNE (clé « service role » : jamais exposée au navigateur). */
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cfgFne = () => ({ syncKey: Deno.env.get("SYNC_KEY"), secret: (n) => Deno.env.get(n) || "" });

export function dbFne(sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } })) {
  const ligne = (r) => r && { cle: r.cle, statut: r.statut, reponse: r.reponse, erreur: r.erreur, maj: new Date(r.maj).getTime() };
  return {
    lire: async (cle) => { const r = await sb.from("fne_certifications").select("cle,statut,reponse,erreur,maj").eq("cle", cle).maybeSingle(); if (r.error) throw new Error(r.error.message); return ligne(r.data); },
    inserer: async (cle, l) => { const r = await sb.from("fne_certifications").insert({ cle, app: l.app, env: l.env, action: l.action, statut: l.statut, payload: l.payload, maj: new Date(l.maj).toISOString() }); if (!r.error) return true; if (r.error.code === "23505") return false; throw new Error(r.error.message); },
    reprendre: async (cle, majAttendue, champs) => { const r = await sb.from("fne_certifications").update({ statut: champs.statut, erreur: champs.erreur, maj: new Date(champs.maj).toISOString() }).eq("cle", cle).eq("maj", new Date(majAttendue).toISOString()).select("cle"); if (r.error) throw new Error(r.error.message); return (r.data || []).length === 1; },
    maj: async (cle, champs) => { const u = { maj: new Date(champs.maj).toISOString() }; for (const k of ["statut", "reponse", "erreur"]) if (k in champs) u[k] = champs[k]; const r = await sb.from("fne_certifications").update(u).eq("cle", cle); if (r.error) throw new Error(r.error.message); },
  };
}
