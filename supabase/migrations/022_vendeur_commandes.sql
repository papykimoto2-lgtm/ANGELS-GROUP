-- Commandes déposées par les vendeurs partenaires depuis leur application (vendeur.html) : file d'attente relevée et acquittée par le bureau.
-- La clé (vendeur_ref, ref) rend l'envoi idempotent : un réseau qui coupe puis renvoie ne crée jamais de doublon.
create table if not exists public.pg_vendeur_cmds (
  id          bigint generated always as identity primary key,
  vendeur_ref text not null references public.pg_vendeurs(vendeur_ref) on delete cascade,
  ref         text not null check (length(ref) between 6 and 40),
  donnees     jsonb not null,
  cree_le     timestamptz not null default now(),
  traite      boolean not null default false,
  unique (vendeur_ref, ref)
);
create index if not exists pg_vendeur_cmds_attente on public.pg_vendeur_cmds (id) where not traite;
alter table public.pg_vendeur_cmds enable row level security;
revoke all on public.pg_vendeur_cmds from anon, authenticated;
