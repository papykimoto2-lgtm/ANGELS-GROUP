-- Hub : accès aux chiffres consolidés réservé à la direction (RLS + fonction serveur).
-- Prérequis : 006_sync_postes.sql (public.sync_enreg). Supabase Auth actif.
-- Rôles autorisés : admin, direction, directeur. Aucun accès direct de anon / authenticated aux données de synchronisation.

create table if not exists public.hub_profils (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nom     text not null check (length(nom) between 1 and 60),
  role    text not null check (role in ('admin','direction','directeur','autre')),
  actif   boolean not null default true,
  cree_le timestamptz not null default now()
);
alter table public.hub_profils enable row level security;
revoke all on public.hub_profils from anon, authenticated;
grant select on public.hub_profils to authenticated;
drop policy if exists hub_profils_soi on public.hub_profils;
create policy hub_profils_soi on public.hub_profils for select to authenticated using (user_id = (select auth.uid()));
-- aucune politique d'écriture : les profils se créent par le service (SQL / tableau de bord)

create table if not exists public.hub_acces_journal (
  id      bigint generated always as identity primary key,
  ts      timestamptz not null default now(),
  user_id uuid,
  nom     text,
  ok      boolean not null,
  detail  text
);
alter table public.hub_acces_journal enable row level security;
revoke all on public.hub_acces_journal from anon, authenticated;
create index if not exists hub_acces_journal_ts on public.hub_acces_journal (ts desc);

create or replace function public.hub_peut_voir_finance() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hub_profils p
                 where p.user_id = auth.uid() and p.actif and p.role in ('admin','direction','directeur'));
$$;
revoke all on function public.hub_peut_voir_finance() from public, anon;
grant execute on function public.hub_peut_voir_finance() to authenticated;

-- Lecture consolidée : renvoie {app: [{coll,id,data}]} ou {"refuse":true} sans les collections sensibles (comptes, connexions, journaux).
create or replace function public.hub_consolide_lire() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); nom_ text; res jsonb;
begin
  select nom into nom_ from public.hub_profils where user_id = uid;
  if uid is null or not public.hub_peut_voir_finance() then
    insert into public.hub_acces_journal(user_id, nom, ok, detail) values (uid, nom_, false, 'refusé');
    return jsonb_build_object('refuse', true);   -- pas d'exception : elle annulerait la ligne de journal
  end if;
  insert into public.hub_acces_journal(user_id, nom, ok, detail) values (uid, nom_, true, 'lecture consolidée');
  select coalesce(jsonb_object_agg(app, lignes), '{}'::jsonb) into res from (
    select app, jsonb_agg(jsonb_build_object('coll', coll, 'id', id, 'data', data)) as lignes
    from public.sync_enreg
    where not supprime and data is not null
      and app in ('distribution','transport','agro','placement','assurance')
      and coll not in ('users','connexions','audit','sessions','roles_perso')
    group by app) t;
  return res;
end $$;
revoke all on function public.hub_consolide_lire() from public, anon;
grant execute on function public.hub_consolide_lire() to authenticated;

-- Création du premier compte direction (à exécuter une fois, après création de l'utilisateur dans Authentication) :
--   insert into public.hub_profils(user_id, nom, role) values ('<uuid>', 'Nom', 'directeur');
