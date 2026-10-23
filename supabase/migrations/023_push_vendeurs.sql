-- Notifications push pour l'application vendeur : un abonnement peut désormais appartenir à un vendeur (vendeur_ref) au lieu d'un livreur.
alter table public.pg_push alter column livreur_ref drop not null;
alter table public.pg_push add column if not exists vendeur_ref text references public.pg_vendeurs(vendeur_ref) on delete cascade;
alter table public.pg_push drop constraint if exists pg_push_proprietaire;
alter table public.pg_push add constraint pg_push_proprietaire check (livreur_ref is not null or vendeur_ref is not null);
create index if not exists pg_push_vendeur on public.pg_push (vendeur_ref);
