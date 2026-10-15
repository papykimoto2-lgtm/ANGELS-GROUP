-- ANGEL'S & CO TRANSPORT — schéma V1 (Supabase / PostgreSQL)
-- Principes : droits côté serveur (RLS + fonctions SECURITY DEFINER), écritures financières
-- uniquement via fonctions transactionnelles, aucune suppression des données financières.
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
create schema if not exists app;

-- ───────────── Référentiels & sécurité ─────────────
create table public.drivers(
 id uuid primary key default gen_random_uuid(), user_id uuid unique, nom text not null, tel text, adresse text, cni text,
 permis_no text, permis_fin date, third_party_id uuid, created_at timestamptz not null default now());
create table public.profiles(
 id uuid primary key references auth.users(id) on delete cascade, nom text not null,
 role text not null check (role in ('admin','directeur','flotte','caissier','comptable','controleur','chauffeur')),
 driver_id uuid references public.drivers(id), actif boolean not null default true, created_at timestamptz not null default now());
alter table public.drivers add constraint drivers_user_fk foreign key(user_id) references public.profiles(id);
create table public.role_permissions(
 role text not null, module text not null, action text not null check (action in ('v','c','e','a','x','p')),
 primary key(role,module,action));
create table public.system_settings(key text primary key, value jsonb not null);
create table public.numbering_sequences(name text primary key, prefix text not null, last_value bigint not null default 0);

create table public.third_parties(
 id uuid primary key default gen_random_uuid(), type text not null check (type in ('chauffeur','fournisseur')),
 nom text not null, aux text not null unique, driver_id uuid references public.drivers(id));
alter table public.drivers add constraint drivers_tp_fk foreign key(third_party_id) references public.third_parties(id);

create table public.vehicles(
 id uuid primary key default gen_random_uuid(), immat text not null unique, marque text, modele text, annee int, places int,
 proprietaire text, date_entree date, date_sortie date,
 statut text not null default 'actif' check (statut in ('actif','immobilise','fourriere','hors_service','sorti')),
 km int not null default 0 check (km>=0), prochain_km int, assurance_fin date, visite_fin date, carte_fin date,
 created_at timestamptz not null default now());
create table public.vehicle_status_history(
 id bigint generated always as identity primary key, vehicle_id uuid not null references public.vehicles(id),
 de text, a text not null, motif text, par uuid, t timestamptz not null default now());
create table public.vehicle_documents(
 id uuid primary key default gen_random_uuid(), vehicle_id uuid references public.vehicles(id), driver_id uuid references public.drivers(id),
 type text not null, numero text, echeance date, check ((vehicle_id is null) <> (driver_id is null)));

create table public.assignments(
 id uuid primary key default gen_random_uuid(), vehicle_id uuid not null references public.vehicles(id),
 driver_id uuid not null references public.drivers(id), debut date not null, fin date, check (fin is null or fin>=debut),
 exclude using gist (vehicle_id with =, daterange(debut, coalesce(fin,'infinity'), '[]') with &&));

-- ───────────── Contrats, échéances ─────────────
create table public.operating_contracts(
 id uuid primary key default gen_random_uuid(), numero text not null unique,
 mode text not null check (mode in ('recette','location')), vehicle_id uuid not null references public.vehicles(id),
 driver_id uuid not null references public.drivers(id), periodicite text not null default 'jour' check (periodicite in ('jour','semaine','mois')),
 repos text not null default 'dimanche' check (repos in ('dimanche','aucun')), debut date not null, fin date, effet date,
 statut text not null default 'actif' check (statut in ('actif','resilie')), motif_resil text,
 depot numeric(14,0) not null default 0 check (depot>=0), depot_verse numeric(14,0) not null default 0 check (depot_verse>=0),
 created_at timestamptz not null default now(),
 check (fin is null or fin>=debut),
 exclude using gist (vehicle_id with =, daterange(debut, coalesce(effet, fin, 'infinity'), '[]') with &&));
create table public.contract_versions(
 contract_id uuid not null references public.operating_contracts(id), from_date date not null,
 montant numeric(14,0) not null check (montant>0), motif text, par uuid, at timestamptz not null default now(),
 primary key(contract_id, from_date));
create table public.payment_obligations(
 id uuid primary key default gen_random_uuid(), num bigint generated always as identity unique,
 contract_id uuid not null references public.operating_contracts(id), vehicle_id uuid not null references public.vehicles(id),
 driver_id uuid not null references public.drivers(id), date_ech date not null, montant numeric(14,0) not null check (montant>=0),
 jour text not null default 'prevue' check (jour in ('prevue','exploitee','non_travaillee','exception')),
 exo_motif text, exo_par uuid, exo_at timestamptz, created_at timestamptz not null default now(),
 unique(contract_id, date_ech));
create index on public.payment_obligations(driver_id, date_ech);
create index on public.payment_obligations(vehicle_id, date_ech);

-- ───────────── Encaissements, caisse ─────────────
create table public.payments(
 id uuid primary key default gen_random_uuid(), idempotency_key text not null unique,
 driver_id uuid not null references public.drivers(id), type text not null default 'echeances' check (type in ('echeances','depot')),
 contract_id uuid references public.operating_contracts(id), montant numeric(14,0) not null check (montant>0),
 mode text not null check (mode in ('especes','mobile','virement')), ref text,
 date_valeur date not null check (date_valeur<=current_date),
 statut text not null default 'a_verifier' check (statut in ('a_verifier','confirme','annule','rejete')),
 plan jsonb not null default '[]', receipt_id uuid, entry_id uuid, motif text,
 created_by uuid, created_at timestamptz not null default now(), confirmed_by uuid, confirmed_at timestamptz,
 check (mode='especes' or length(btrim(coalesce(ref,'')))>0));
create index on public.payments(driver_id, date_valeur);
create table public.payment_allocations(
 id uuid primary key default gen_random_uuid(), payment_id uuid not null references public.payments(id),
 obligation_id uuid not null references public.payment_obligations(id), montant numeric(14,0) not null check (montant>0),
 actif boolean not null default true);
create index on public.payment_allocations(obligation_id) where actif;
create table public.receipts(
 id uuid primary key default gen_random_uuid(), numero text not null unique, payment_id uuid not null unique references public.payments(id),
 driver_id uuid not null references public.drivers(id), date date not null default current_date, montant numeric(14,0) not null,
 statut text not null default 'valide' check (statut in ('valide','annule')), motif text, par uuid, annule_par uuid);
create table public.cash_sessions(
 id uuid primary key default gen_random_uuid(), ouverte_le timestamptz not null default now(), ouverte_par uuid,
 fond numeric(14,0) not null check (fond>=0), statut text not null default 'ouverte' check (statut in ('ouverte','cloturee')),
 theorique numeric(14,0), reel numeric(14,0), ecart numeric(14,0), explication text, cloturee_le timestamptz, cloturee_par uuid);
create unique index one_open_cash_session on public.cash_sessions((true)) where statut='ouverte';
create table public.cash_movements(
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.cash_sessions(id),
 sens text not null check (sens in ('entree','sortie')), montant numeric(14,0) not null check (montant>0),
 categorie text not null, motif text, justificatif text, statut text not null default 'validee' check (statut in ('validee','a_valider','rejetee')),
 source jsonb, par uuid, valide_par uuid, created_at timestamptz not null default now());
create table public.bank_accounts(id uuid primary key default gen_random_uuid(), nom text not null, compte text not null default '521');
create table public.bank_transactions(
 id uuid primary key default gen_random_uuid(), payment_id uuid references public.payments(id), date date not null, montant numeric(14,0) not null,
 mode text, ref text, pointe boolean not null default false, annule boolean not null default false);
create table public.reconciliations(
 id uuid primary key default gen_random_uuid(), bank_account_id uuid references public.bank_accounts(id), date date not null,
 solde_releve numeric(14,0) not null, solde_pointe numeric(14,0) not null, par uuid, created_at timestamptz not null default now());

-- ───────────── Comptabilité ─────────────
create table public.chart_of_accounts(num text primary key check (num ~ '^[0-9]{3,8}$'), nom text not null, type text not null);
create table public.accounting_periods(id text primary key check (id ~ '^[0-9]{4}-[0-9]{2}$'), statut text not null default 'ouverte' check (statut in ('ouverte','cloturee')));
create table public.journals(code text primary key, nom text not null);
create table public.journal_entries(
 id uuid primary key default gen_random_uuid(), numero text not null unique, journal text not null references public.journals(code),
 date date not null, libelle text not null, piece text, source jsonb, extournee_par uuid references public.journal_entries(id),
 created_by uuid, created_at timestamptz not null default now());
create index on public.journal_entries(date);
create table public.journal_lines(
 id uuid primary key default gen_random_uuid(), entry_id uuid not null references public.journal_entries(id),
 compte text not null references public.chart_of_accounts(num), third_party_id uuid references public.third_parties(id),
 debit numeric(14,0) not null default 0 check (debit>=0), credit numeric(14,0) not null default 0 check (credit>=0),
 ob uuid references public.payment_obligations(id), vehicle_id uuid references public.vehicles(id), lettre text, ext boolean not null default false,
 check (debit=0 or credit=0), check (debit+credit>0));
create index on public.journal_lines(entry_id);
create index on public.journal_lines(compte);
create index on public.journal_lines(third_party_id) where compte='411';

-- ───────────── GPS ─────────────
create table public.gps_devices(
 id uuid primary key default gen_random_uuid(), ident text not null unique, fournisseur text, vehicle_id uuid references public.vehicles(id),
 actif boolean not null default true, created_at timestamptz not null default now());
create unique index one_active_device_per_vehicle on public.gps_devices(vehicle_id) where actif and vehicle_id is not null;
create table public.gps_device_history(id bigint generated always as identity primary key, device_id uuid not null references public.gps_devices(id), vehicle_id uuid, fin timestamptz not null default now(), par uuid);
create table public.gps_positions(
 id bigint generated always as identity primary key, device_id uuid not null references public.gps_devices(id), vehicle_id uuid not null references public.vehicles(id),
 lat double precision not null check (lat between -90 and 90), lng double precision not null check (lng between -180 and 180),
 vitesse numeric(5,1) check (vitesse between 0 and 250), t timestamptz not null, recu timestamptz not null default now());
create index on public.gps_positions(vehicle_id, t desc);
create table public.gps_quarantine(id bigint generated always as identity primary key, ident text, lat text, lng text, t text, raison text not null, recu timestamptz not null default now());
create table public.geofences(id uuid primary key default gen_random_uuid(), nom text not null, lat double precision not null, lng double precision not null, rayon_m numeric not null check (rayon_m>0));
create table public.gps_alerts(id uuid primary key default gen_random_uuid(), vehicle_id uuid references public.vehicles(id), type text not null, texte text, t timestamptz not null default now());
create table public.gps_access_log(id bigint generated always as identity primary key, user_id uuid, action text, detail text, t timestamptz not null default now());

-- ───────────── Exploitation & portail ─────────────
create table public.maintenance_orders(
 id uuid primary key default gen_random_uuid(), numero text not null unique, vehicle_id uuid not null references public.vehicles(id), date date not null default current_date,
 motif text not null, diagnostic text, travaux text, pieces text, cout numeric(14,0) not null default 0 check (cout>=0), fournisseur text,
 statut text not null default 'demande' check (statut in ('demande','devis','approuvee','en_cours','remise','close')),
 debut_immo date, fin_immo date, source text not null default 'bureau', expense_id uuid, created_by uuid, created_at timestamptz not null default now());
create table public.maintenance_history(id bigint generated always as identity primary key, order_id uuid not null references public.maintenance_orders(id), statut text not null, par uuid, t timestamptz not null default now());
create table public.expenses(
 id uuid primary key default gen_random_uuid(), numero text not null unique, date date not null, vehicle_id uuid references public.vehicles(id),
 categorie text not null check (categorie in ('Carburant','Entretien et réparations','Amendes et pénalités','Frais divers')), fournisseur text,
 montant numeric(14,0) not null check (montant>0), justificatif text, statut text not null default 'a_valider' check (statut in ('a_valider','validee','rejetee')),
 mode text check (mode in ('caisse','banque')), entry_id uuid, source jsonb, created_by uuid, valide_par uuid, created_at timestamptz not null default now());
create table public.incidents(
 id uuid primary key default gen_random_uuid(), numero text not null unique, vehicle_id uuid not null references public.vehicles(id), driver_id uuid references public.drivers(id),
 date date not null default current_date, type text not null check (type in ('accident','panne','vol','autre')), description text not null, cout numeric(14,0) default 0,
 statut text not null default 'ouvert' check (statut in ('ouvert','en_cours','clos')), resolution text, source text not null default 'bureau', maintenance_id uuid, created_at timestamptz not null default now());
create table public.attachments(id uuid primary key default gen_random_uuid(), storage_path text not null unique, nom text not null, mime text not null check (mime in ('image/png','image/jpeg','image/webp','application/pdf')), taille int not null check (taille<=307200), owner uuid not null, created_at timestamptz not null default now());
create table public.driver_requests(
 id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.drivers(id), type text not null check (type in ('contestation','justificatif','profil','autre')),
 obligation_id uuid references public.payment_obligations(id), texte text not null, attachment_id uuid references public.attachments(id), payload jsonb,
 statut text not null default 'ouverte' check (statut in ('ouverte','traitee','rejetee')), reponse text, traite_par uuid, created_at timestamptz not null default now());
create table public.notifications(
 id uuid primary key default gen_random_uuid(), driver_id uuid references public.drivers(id), audience text not null default 'driver' check (audience in ('driver','all_drivers','staff')),
 titre text not null, texte text, created_at timestamptz not null default now());
create table public.notification_reads(notification_id uuid references public.notifications(id), user_id uuid references public.profiles(id), primary key(notification_id,user_id));
create table public.audit_logs(id bigint generated always as identity primary key, t timestamptz not null default now(), user_id uuid, action text not null, detail jsonb);
