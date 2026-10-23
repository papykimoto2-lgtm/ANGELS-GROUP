-- Réservations de véhicule avec chauffeur envoyées depuis le portail : nouveau type de demande (relevé par Transport, pas par Distributions).
-- Sans effet sur les demandes existantes ; les lignes déjà en base gardent leur type.
alter table public.pd_demandes drop constraint if exists pd_demandes_type_check;
alter table public.pd_demandes add constraint pd_demandes_type_check check (type in ('BOUTIQUE','LIVRAISON','ABONNEMENT','RESERVATION'));
