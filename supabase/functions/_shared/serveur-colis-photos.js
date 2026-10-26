/* Adaptateur Supabase des photos de colis (clé « service role » : jamais exposée au navigateur). */
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cfgPhotos = () => ({ adminKey: Deno.env.get("ADMIN_KEY") });

export function dbPhotos(sb = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } })) {
  const ok = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
  return {
    remplacer: async (ref, lignes) => {
      const garde = lignes.map((l) => l.n);
      if (garde.length) ok(await sb.from("pg_colis_photos").delete().eq("livraison_ref", ref).not("n", "in", "(" + garde.join(",") + ")"));
      else ok(await sb.from("pg_colis_photos").delete().eq("livraison_ref", ref));
      if (lignes.length) ok(await sb.from("pg_colis_photos").upsert(lignes, { onConflict: "livraison_ref,n" }));
    },
    retirer: async (refs) => ok(await sb.from("pg_colis_photos").delete().in("livraison_ref", refs)),
    purger: async (limite) => ok(await sb.from("pg_colis_photos").delete().lt("maj_le", limite)),
  };
}
