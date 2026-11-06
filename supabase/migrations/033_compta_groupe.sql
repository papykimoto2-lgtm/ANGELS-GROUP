-- Comptabilité du groupe : accès protégé côté serveur (fonction « compta-groupe », clé service).
-- Aucun droit pour les navigateurs : tout passe par la fonction, qui vérifie le mot de passe de la personne, son profil, puis ne renvoie que les sections autorisées.

-- Synthèses publiées par les applications (une ligne par clé : angels_<famille>_<division>, plus le registre inter-divisions « angels_inter »).
create table if not exists public.compta_synthese (
  cle  text primary key check (cle ~ '^angels_(compta|etats|prev|rh|tiers|regul|inter)(_(distribution|transport|agro))?$'),
  data jsonb not null,
  par  text,
  maj  timestamptz not null default now()
);

-- Droits d'accès par section et par profil (une seule ligne).
create table if not exists public.compta_droits (
  id   int primary key default 1 check (id = 1),
  data jsonb not null,
  par  text,
  maj  timestamptz not null default now()
);

-- Tentatives de connexion (blocage après 5 échecs).
create table if not exists public.compta_essais (
  uid   text primary key,
  n     int not null default 0,
  until timestamptz,
  maj   timestamptz not null default now()
);

-- Journal des accès : connexions, échecs, blocages, sections consultées, changements de droits.
create table if not exists public.compta_journal (
  id    bigserial primary key,
  t     timestamptz not null default now(),
  ev    text not null,
  app   text,
  uid   text,
  nom   text,
  role  text,
  motif text
);
create index if not exists compta_journal_t on public.compta_journal (t desc);

alter table public.compta_synthese enable row level security;
alter table public.compta_droits   enable row level security;
alter table public.compta_essais   enable row level security;
alter table public.compta_journal  enable row level security;
revoke all on public.compta_synthese, public.compta_droits, public.compta_essais, public.compta_journal from anon, authenticated;
revoke all on sequence public.compta_journal_id_seq from anon, authenticated;
