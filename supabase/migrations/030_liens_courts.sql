-- Liens courts : https://…/l/AB3K9ZQ au lieu d'une adresse de plusieurs centaines de caractères.
-- La table ne garde que la partie « cible » du lien (page + paramètres) ; seule la fonction lien-court (clé service) y accède.
create table if not exists public.pg_liens (
  code     text primary key,
  cible    text not null check (length(cible) <= 12000),
  cree_le  timestamptz not null default now(),
  expire_le timestamptz not null default (now() + interval '180 days'),
  vues     integer not null default 0
);
alter table public.pg_liens enable row level security;
-- aucune politique : ni lecture ni écriture directe depuis un navigateur
create index if not exists pg_liens_expire on public.pg_liens (expire_le);
