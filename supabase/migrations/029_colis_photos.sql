-- Photos des colis à livrer : prises par le centre à la préparation, publiées par le bureau (fonction colis-photos, clé d'administration),
-- lues par le livreur concerné uniquement (politique : seulement les photos de SES missions). Aucune écriture directe.

create table if not exists public.pg_colis_photos (
  livraison_ref text not null,
  n             int  not null check (n between 1 and 20),
  photo         text not null check (photo ~ '^data:image/jpeg;base64,' and length(photo) <= 70000),
  maj_le        timestamptz not null default now(),
  primary key (livraison_ref, n)
);
create index if not exists pg_colis_photos_maj on public.pg_colis_photos (maj_le);

alter table public.pg_colis_photos enable row level security;
revoke all on public.pg_colis_photos from anon, authenticated;
grant select (livraison_ref, n, photo, maj_le) on public.pg_colis_photos to authenticated;
create policy pg_colis_photos_miennes on public.pg_colis_photos for select to authenticated
  using (livraison_ref in (select livraison_ref from public.pg_missions
                            where livreur_ref in (select livreur_ref from public.pg_livreurs where user_id = (select auth.uid()) and actif)));

-- Conservation limitée : photos de plus de 7 jours.
create or replace function public.pg_purger_photos() returns void language sql security definer set search_path = public as $$
  delete from public.pg_colis_photos where maj_le < now() - interval '7 days';
$$;
revoke all on function public.pg_purger_photos() from public, anon, authenticated;
