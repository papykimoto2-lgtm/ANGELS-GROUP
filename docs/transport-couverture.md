# Couverture du cahier des charges — ANGEL'S & CO TRANSPORT (V1)

Légende : ✅ réalisé et testé · 🟡 réalisé, validation externe requise · ⛔ non réalisé (dépend d'une décision ou d'un tiers)

## Écrans (§5.2 / §5.3)
| Réf. | Écran | État | Remarque |
|---|---|---|---|
| E01 | Connexion | ✅ | PIN, blocage 5 essais ; réinitialisation par l'administrateur (E23) |
| E02 | Tableau de bord | ✅ | Attendu / encaissé / restant dû / résultat, filtres période et véhicule |
| E03–E05 | Véhicules, chauffeurs, affectations | ✅ | Historique des statuts, sortie du parc sans perte d'historique |
| E06–E07 | Contrats, planning | ✅ | Recette / location, avenants versionnés, changement de mode, exonération motivée, journée exceptionnelle |
| E08–E10 | Échéances, encaissement, reçus | ✅ | Paiement partiel, imputation, anti-doublon, vérification mobile money / virement, annulation motivée |
| E11–E12 | Caisse, dépenses | ✅ | Ouverture, clôture avec écart, seuils de justificatif et de validation, pointage banque |
| E13–E15 | Comptabilité, tiers, états | 🟡 | Partie double, extourne, lettrage, périodes, balance, grand livre, journal. Plan indicatif à valider |
| E16–E17 | Carte GPS, dispositifs | 🟡 | Carte Leaflet/OSM, fraîcheur, historique, zones, quarantaine. Fournisseur et boîtiers à choisir |
| E18–E19 | Maintenance, sinistres | ✅ | Workflow demande → clos, immobilisation, dépense liée |
| E25 | Entretien préventif (inspiré d'AutoGarage Pro) | ✅ | Plan par véhicule en km et en jours (vidange, plaquettes, pneus, batterie, courroie, révision), états retard / à prévoir, ordre de maintenance lié, rappel WhatsApp au chauffeur, historique |
| E26 | Pièces détachées | ✅ | Catalogue, entrées avec dépense à valider, coût moyen pondéré, inventaire, alertes de seuil ; consommation à la remise en service d'un ordre |
| E27 | Agenda atelier | ✅ | Entretiens dus, passages au garage programmés, échéances de documents ; filtres, impression, taxis immobilisés |
| E20 | Documents et alertes | ✅ | Échéances, retards, demandes chauffeurs, notifications |
| E21 | Rapports de gestion | ✅ | Recouvrement, ancienneté des impayés, disponibilité, écarts de caisse |
| E22 / P01–P07 | Portail chauffeur | ✅ | Compte, reçus confirmés, véhicule, incident (photo), demandes, profil (validé par le bureau) |
| E23–E24 | Droits, audit, paramètres | ✅ | Matrice module × action, journal d'audit, périodes, sauvegarde/restauration avec somme de contrôle |

## Recette automatisée
- Interface : `node tests/recette-transport.js` — 41 contrôles (REC-01…10, COM-01…10, GPS-01…05, POR-01…04, MAI-01…02, SEC-01…03, ENT-01…07).
- Base de données : `bash tests/recette-supabase.sh` — 49 contrôles sur PostgreSQL (droits RLS, idempotence, immutabilité, périodes, GPS).

## Points à valider avant production (§11)
1. **GPS** : fournisseur, boîtiers compatibles, abonnements, fréquence de remontée.
2. **Comptabilité** : plan de comptes, journaux, états requis, règles fiscales — par le comptable.
3. **Données initiales** : véhicules, contrats, créances, caisse et comptes tiers de départ (saisie par écritures `AN`).
4. **Raccordement Supabase** de l'interface (authentification, appels RPC), puis tests de charge (30 véhicules) et test de restauration.
