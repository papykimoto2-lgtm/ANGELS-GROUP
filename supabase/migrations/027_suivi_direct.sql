-- Suivi de livraison en direct : la page publique du client interroge la fonction suivi-live avec une clé aléatoire (jamais déduite du numéro de commande).
-- Le bureau publie l'état (sans téléphone ni code) par la fonction suivi-publier ; la position du livreur est lue dans pg_missions (alimentée par l'application livreur).
-- Aucun accès direct pour anon / authenticated : seules les fonctions (clé « service role ») lisent et écrivent ces tables.

create table if not exists public.pg_suivi (
  cle           text primary key check (cle ~ '^[A-Za-z0-9_-]{20,64}$'),
  commande_ref  text not null,
  livraison_ref text,                                              -- mission dont on lit la position (jamais renvoyée au client)
  etat          jsonb not null,                                    -- projection publique : étape, prénom du livreur, arrivée estimée, destination, historique
  termine_le    timestamptz,                                       -- livrée, annulée, échouée… : le lien expire 48 h plus tard
  maj_le        timestamptz not null default now()
);
create index if not exists pg_suivi_commande on public.pg_suivi (commande_ref);

create table if not exists public.pg_cles_publiques (               -- clés PUBLIQUES de signature des liens (la clé privée ne quitte jamais l'appareil du bureau)
  kid     text primary key,
  pub     jsonb not null,
  maj_le  timestamptz not null default now()
);

alter table public.pg_suivi enable row level security;
alter table public.pg_cles_publiques enable row level security;
revoke all on public.pg_suivi, public.pg_cles_publiques from anon, authenticated;

-- Conservation limitée : liens expirés depuis plus de 7 jours.
create or replace function public.pg_purger_suivi() returns void language sql security definer set search_path = public as $$
  delete from public.pg_suivi where termine_le is not null and termine_le < now() - interval '7 days';
$$;
revoke all on function public.pg_purger_suivi() from public, anon, authenticated;
