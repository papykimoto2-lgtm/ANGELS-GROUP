-- Accès chauffeur : compteur de tentatives de connexion (blocage après 5 échecs). Réservé à la fonction « chauffeur » (clé service) : aucun droit pour les navigateurs.
create table if not exists public.chauffeur_essais (
  uid   text primary key,
  n     int not null default 0,
  until timestamptz,
  maj   timestamptz not null default now()
);
alter table public.chauffeur_essais enable row level security;
revoke all on public.chauffeur_essais from anon, authenticated;

-- Index pour lire les enregistrements d'un chauffeur sans parcourir toute la collection
create index if not exists sync_enreg_driver on public.sync_enreg (app, coll, ((data->>'driver_id'))) where app = 'transport';
