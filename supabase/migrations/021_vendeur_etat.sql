-- État publié par le bureau pour chaque vendeur partenaire (commandes, règlements, solde, lien client) : projection SANS téléphone de client,
-- lue par le vendeur connecté via la fonction vendeur-sync (jeton vérifié). Aucun accès direct : seules les fonctions (clé « service role ») lisent et écrivent.
create table if not exists public.pg_vendeur_etat (
  vendeur_ref text primary key references public.pg_vendeurs(vendeur_ref) on delete cascade,
  etat        jsonb not null,
  maj_le      timestamptz not null default now()
);
alter table public.pg_vendeur_etat enable row level security;
revoke all on public.pg_vendeur_etat from anon, authenticated;
