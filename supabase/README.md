# Backend Supabase — ANGEL'S & CO TRANSPORT

| Fichier | Rôle |
|---|---|
| `migrations/001_transport_schema.sql` | Tables, contraintes, clés étrangères, index, exclusions de chevauchement (affectations, contrats) |
| `migrations/002_transport_logic.sql` | Droits (RLS), fonctions transactionnelles, immutabilité, périodes, équilibre des écritures, GPS |
| `migrations/003_transport_reference.sql` | Plan comptable indicatif, journaux, paramètres, matrice des droits (générée par `tools/gen-reference.js`) |
| `functions/gps-ingest/` | Edge Function de réception des positions (clé secrète, lots de 500 max) |
| `../tests/recette-supabase.sh` | Recette SQL (49 contrôles) exécutée sur un Postgres de test |

## Mise en service
1. Créer le projet Supabase, puis `supabase db push` (ou coller 001 → 002 → 003 dans l'éditeur SQL).
2. Premier administrateur : créer l'utilisateur dans *Authentication*, puis  
   `insert into profiles(id,nom,role) values ('<uuid>','Administrateur','admin');`
3. Créer les autres comptes de la même façon (rôles : `directeur, flotte, caissier, comptable, controleur, chauffeur` ; pour un chauffeur, renseigner `driver_id`).
4. GPS : `supabase secrets set GPS_INGEST_KEY=<32+ caractères aléatoires>` puis `supabase functions deploy gps-ingest --no-verify-jwt`.
5. Planifier (pg_cron) : `select cron.schedule('gps-purge','0 3 * * *','select public.purge_gps()');` et `select cron.schedule('echeances','5 0 * * *','select public.generate_obligations(current_date)');`
6. Stockage des pièces jointes : bucket privé `pieces`, politiques par propriétaire (`owner = auth.uid()`), PNG/JPEG/WebP/PDF, 300 Ko maximum.
7. Sauvegardes : activer les sauvegardes quotidiennes (et PITR si le plan le permet) ; **tester une restauration** sur un projet vierge avant la mise en production.

## Principes de sécurité appliqués
- RLS activée sur toutes les tables ; chaque politique s'appuie sur `app.perm(module, action)` (matrice `role_permissions`) ou sur `app.my_driver()` pour le portail chauffeur.
- Aucune écriture directe sur les tables financières : tout passe par des fonctions `SECURITY DEFINER` (`register_payment`, `confirm_payment`, `cancel_receipt`, `post_manual_entry`, `validate_expense`, `close_cash`…), atomiques et idempotentes.
- Interdictions en base : suppression des paiements, imputations, reçus, caisses, écritures, lignes d'écriture, journal d'audit ; modification d'une écriture validée ; modification du montant d'un paiement.
- Écriture refusée dans une période clôturée ; écriture déséquilibrée refusée à la validation de la transaction.
- `ingest_gps_position` n'est exécutable que par `service_role` (Edge Function) ; positions invalides placées en quarantaine.
- La clé `service_role` et `GPS_INGEST_KEY` ne doivent **jamais** figurer dans le navigateur.

## Limites actuelles
- L'interface `transport.html` fonctionne encore sur le stockage local du navigateur (mêmes règles métier, mêmes tests). Son raccordement à ce backend (Supabase Auth + appels `rpc`) est l'étape suivante.
- Le plan comptable est indicatif : à faire valider par le comptable (SYSCOHADA révisé, fiscalité ivoirienne). Facturation normalisée / FNE, déclarations fiscales, immobilisations et amortissements : hors périmètre tant qu'ils ne sont pas spécifiés.
