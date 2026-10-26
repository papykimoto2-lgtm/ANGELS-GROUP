-- ANGEL'S GROUP — passage en production : remise à zéro de l'activité côté serveur.
-- À exécuter UNE FOIS, après la remise à zéro des applications (Distributions, Transport, Agro).
-- Conservés : comptes livreurs et vendeurs, catalogue du portail, abonnements de notification, authentification.
begin;

-- Passerelle livreur : missions, événements, colis, preuves, codes de livraison, jetons de signature
delete from public.pg_evenements;
delete from public.pg_preuves;
delete from public.pg_colis;
delete from public.pg_sign_jetons;
delete from public.pg_missions;            -- supprime aussi pg_codes (cascade)
delete from public.pg_vendeur_cmds;
delete from public.pg_vendeur_etat;
delete from public.pg_suivi;                -- liens de suivi en direct (les clés publiques de signature sont conservées)

-- Portail clients : demandes, suivis en direct, photos, scans
delete from public.pd_demandes;
delete from public.pd_lives;
delete from public.pd_photos;
delete from public.pd_scans;

-- Appels, rapports de la direction
delete from public.appel_journal;
delete from public.appel_tickets;
delete from public.rapport_dg;

-- Synchronisation : purge des enregistrements marqués supprimés (les données vivantes sont gérées par l'application)
delete from public.sync_enreg where supprime;

commit;

-- Contrôle : toutes ces valeurs doivent être à 0 (sauf comptes conservés)
select 'pg_missions' as table_nom, count(*) from public.pg_missions
union all select 'pd_demandes', count(*) from public.pd_demandes
union all select 'pg_vendeur_cmds', count(*) from public.pg_vendeur_cmds
union all select 'sync_enreg (vivants)', count(*) from public.sync_enreg where not supprime;
