-- Remise à zéro du serveur pour le passage en production (appelée uniquement par la fonction « reset », clé service).
-- Vide l'activité (synchronisation, passerelle livreur, portail, appels, rapports, certifications FNE) ; CONSERVE les comptes livreurs et vendeurs, le catalogue du portail,
-- les abonnements de notification et l'authentification. Chaque exécution est inscrite dans reset_journal.

create table if not exists public.reset_journal (
  id      bigint generated always as identity primary key,
  le      timestamptz not null default now(),
  par     text,
  comptes jsonb
);
alter table public.reset_journal enable row level security;
revoke all on public.reset_journal from anon, authenticated;

create or replace function public.reset_production(p_executer boolean, p_par text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t text; n bigint; r jsonb := '{}'::jsonb;
begin
  foreach t in array array['pg_evenements','pg_preuves','pg_colis','pg_sign_jetons','pg_missions','pg_vendeur_cmds','pg_vendeur_etat','pd_demandes','pd_lives','pd_photos','pd_scans','appel_journal','appel_tickets','rapport_dg','sync_enreg','fne_certifications'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('select count(*) from public.%I', t) into n;
    r := r || jsonb_build_object(t, n);
    if p_executer then execute format('delete from public.%I', t); end if;
  end loop;
  if p_executer then insert into public.reset_journal (par, comptes) values (left(coalesce(p_par, ''), 80), r); end if;
  return r;
end $$;
revoke all on function public.reset_production(boolean, text) from public, anon, authenticated;
