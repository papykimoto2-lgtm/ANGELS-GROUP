-- Comptes de connexion des vendeurs partenaires (application vendeur.html) : un compte Supabase Auth par vendeur,
-- créé / réinitialisé / bloqué par le bureau via la fonction mission-sync (clé d'administration). Le vendeur ne lit que sa propre ligne.
create table if not exists public.pg_vendeurs (
  vendeur_ref text primary key,                                   -- identifiant du vendeur dans l'application Distributions
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  nom         text not null,
  ident       text not null unique,                               -- identifiant de connexion (minuscules)
  actif       boolean not null default true,
  cree_le     timestamptz not null default now()
);
alter table public.pg_vendeurs enable row level security;
revoke all on public.pg_vendeurs from anon, authenticated;
grant select on public.pg_vendeurs to authenticated;
create policy pg_vendeurs_moi on public.pg_vendeurs for select to authenticated using (user_id = (select auth.uid()));
