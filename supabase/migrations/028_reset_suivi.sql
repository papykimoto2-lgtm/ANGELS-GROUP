-- La remise à zéro du serveur supprime aussi les liens de suivi en direct (pg_suivi) et les photos de colis (pg_colis_photos) : les commandes qu'ils décrivent disparaissent.
-- Les clés PUBLIQUES de signature (pg_cles_publiques) sont conservées : la clé privée reste sur l'appareil du bureau, les liens futurs restent vérifiables.

create or replace function public.reset_production(p_executer boolean, p_par text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text; n bigint; r jsonb := '{}'::jsonb;
begin
  foreach t in array array['pg_evenements','pg_preuves','pg_colis','pg_sign_jetons','pg_missions','pg_vendeur_cmds','pg_vendeur_etat','pg_suivi','pg_colis_photos','pd_demandes','pd_lives','pd_photos','pd_scans','appel_journal','appel_tickets','rapport_dg','sync_enreg','fne_certifications'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select count(*) from public.%I', t) into n;
    r := r || jsonb_build_object(t, n);
    if p_executer then execute format('delete from public.%I', t); end if;
  end loop;
  if p_executer then insert into public.reset_journal (par, comptes) values (left(coalesce(p_par, ''), 80), r); end if;
  return r;
end $$;
revoke all on function public.reset_production(boolean, text) from public, anon, authenticated;
