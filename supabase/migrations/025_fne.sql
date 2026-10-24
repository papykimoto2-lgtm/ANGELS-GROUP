-- Certifications FNE (DGI Côte d'Ivoire) : une ligne par document et par environnement. Garantit qu'une facture n'est certifiée qu'une fois
-- (clé primaire = application + environnement + action + document) et conserve la requête et la réponse de la DGI pour audit.
-- Accès réservé à la fonction « fne » (clé service) : aucun droit pour les navigateurs.

create table if not exists public.fne_certifications (
  cle      text primary key,
  app      text not null check (app in ('distribution','transport','agro')),
  env      text not null check (env in ('test','prod')),
  action   text not null check (action in ('signer','avoir')),
  statut   text not null default 'en_cours' check (statut in ('en_cours','certifiee','echec','incertain')),
  payload  jsonb,
  reponse  jsonb,
  erreur   text,
  cree     timestamptz not null default now(),
  maj      timestamptz not null default now()
);
create index if not exists fne_certifications_app on public.fne_certifications (app, env, statut);

alter table public.fne_certifications enable row level security;
revoke all on public.fne_certifications from anon, authenticated;
