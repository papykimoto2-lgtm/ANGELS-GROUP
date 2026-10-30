/* Adaptateur Supabase de l'accès chauffeur (clé « service role » : jamais exposée au navigateur). Même contrat que tests/chauffeur-memoire.js. */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { dbSync } from "./serveur-sync.js";

export const cfgChauffeur = () => ({ cle: Deno.env.get("SYNC_KEY") });

export function dbChauffeur(sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } })) {
  const ok = (r) => { if (r.error) throw new Error(r.error.message); return r.data; }, base = dbSync(sb);
  return {
    lire: base.lire, ecrire: base.ecrire,
    /* données (non supprimées) d'une collection : contient = sous-objet JSON, depuis = { champ, iso } (texte ISO), dans = { champ, valeurs } */
    liste: async (app, coll, o = {}) => {
      const lim = Math.min(+o.limite || 1000, 10000);
      const q = (valeurs) => {
        let r = sb.from("sync_enreg").select("data").eq("app", app).eq("coll", coll).eq("supprime", false);
        if (o.contient) r = r.contains("data", o.contient);
        if (o.depuis) r = r.gte("data->>" + o.depuis.champ, o.depuis.iso);
        if (valeurs) r = r.in("data->>" + o.dans.champ, valeurs);
        return r.order("maj", { ascending: false }).limit(lim);
      };
      if (!o.dans) return (ok(await q()) || []).map((x) => x.data);
      const out = [], V = o.dans.valeurs || [];
      for (let i = 0; i < V.length; i += 80) out.push(...(ok(await q(V.slice(i, i + 80))) || []).map((x) => x.data));
      return out;
    },
    essais: async (uid) => { const r = ok(await sb.from("chauffeur_essais").select("n,until").eq("uid", uid).maybeSingle()); return r ? { n: r.n, until: r.until ? new Date(r.until).getTime() : 0 } : null; },
    noterEssai: async (uid, e) => { ok(await sb.from("chauffeur_essais").upsert({ uid, n: e.n, until: e.until ? new Date(e.until).toISOString() : null, maj: new Date().toISOString() }, { onConflict: "uid" })); },
    effacerEssais: async (uid) => { ok(await sb.from("chauffeur_essais").delete().eq("uid", uid)); },
  };
}
