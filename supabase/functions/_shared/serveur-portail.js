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
    /* le bureau ne relève pas les demandes destinées à un vendeur qui a une clé de relève : elles ne sont lisibles que par lui */
    enAttenteListe: async (n) => {
      const reg = (ok(await sb.from("pd_vendeurs").select("vendeur")).data || []).map((x) => x.vendeur).filter((x) => /^[A-Za-z0-9_-]+$/.test(x));
      let q = t().select("id,ref,type,message,cree_le").eq("traite", false);
      if (reg.length) q = q.or(`vendeur.is.null,vendeur.not.in.(${reg.join(",")})`);
      return ok(await q.order("id").limit(n)).data || [];
    },
    ecrireCleVendeur: async (v, h) => ok(await sb.from("pd_vendeurs").upsert({ vendeur: v, cle_hash: h, cree_le: new Date().toISOString() }, { onConflict: "vendeur" })),
    empreinteVendeur: async (v) => { const r = ok(await sb.from("pd_vendeurs").select("cle_hash").eq("vendeur", v).maybeSingle()).data; return r ? r.cle_hash : null; },
    enAttenteVendeur: async (v, n) => ok(await t().select("id,ref,type,message,cree_le").eq("traite", false).eq("vendeur", v).order("id").limit(n)).data || [],
    acquitterVendeur: async (v, ids) => ok(await t().update({ traite: true, traite_le: new Date().toISOString() }).eq("vendeur", v).in("id", ids)),
    ecrireCatalogue: async (c) => ok(await sb.from("portail_catalogue").upsert({ id: 1, boutique: c.boutique, photos: c.photos, maj_le: new Date().toISOString() }, { onConflict: "id" })),
    lireCatalogue: async () => ok(await sb.from("portail_catalogue").select("boutique,photos,maj_le").eq("id", 1).maybeSingle()).data,
    acquitter: async (ids) => ok(await t().update({ traite: true, traite_le: new Date().toISOString() }).in("id", ids)),
  };
}
