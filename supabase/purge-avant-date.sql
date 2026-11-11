-- ANGEL'S GROUP — purge des missions livreur déjà envoyées au serveur, antérieures à une date.
-- Complète l'écran « Purger avant une date » (Distributions → Administration), qui supprime les commandes, livraisons et la caisse dans l'application.
-- Dans le SQL Editor de Supabase : 1) lancez l'APERÇU (rien n'est modifié) ; 2) si les chiffres sont bons, lancez la SUPPRESSION.
-- Pour changer la date de coupure, remplacez '2026-11-10' aux DEUX endroits (aperçu et suppression) : tout ce qui est antérieur à cette date à 00 h 00 est supprimé,
-- hier (10 novembre) et aujourd'hui sont conservés. Seules les missions TERMINÉES sont supprimées : une mission encore en cours n'est jamais touchée.
-- Conservés : comptes livreurs et vendeurs, catalogue du portail, abonnements de notification, authentification.

-- 1) APERÇU (lecture seule)
select 'pg_missions terminées à supprimer' as ce_qui, count(*) as n
  from public.pg_missions where statut in ('livree','echouee','refusee','annulee') and maj_le < date '2026-11-10'
union all
select 'pg_evenements traités à supprimer', count(*)
  from public.pg_evenements where traite and cree_le < date '2026-11-10'
union all
select 'pg_missions conservées', count(*)
  from public.pg_missions where not (statut in ('livree','echouee','refusee','annulee') and maj_le < date '2026-11-10');

-- 2) SUPPRESSION (définitive : faites d'abord une sauvegarde depuis Supabase → Database → Backups)
-- begin;
--   delete from public.pg_evenements where traite and cree_le < date '2026-11-10';
--   delete from public.pg_missions   where statut in ('livree','echouee','refusee','annulee') and maj_le < date '2026-11-10';   -- supprime aussi pg_codes (cascade)
-- commit;
