# Couverture du cahier des charges — ANGEL'S & CO TRANSPORT (V1)

Légende : ✅ réalisé et testé · 🟡 réalisé, validation externe requise · ⛔ non réalisé (dépend d'une décision ou d'un tiers)

## Écrans (§5.2 / §5.3)
| Réf. | Écran | État | Remarque |
|---|---|---|---|
| E01 | Connexion | ✅ | PIN, blocage 5 essais ; réinitialisation par l'administrateur (E23) |
| E02 | Tableau de bord | ✅ | Attendu / encaissé / restant dû / résultat, filtres période et véhicule |
| E03–E05 | Véhicules, chauffeurs, affectations | ✅ | Historique des statuts, sortie du parc sans perte d'historique. À la création : documents techniques du véhicule (carte grise, assurance, visite technique, carte de transport, autre) et dossier du chauffeur (photo, permis, carte d'identité) en pièces jointes ; badge et alerte « dossier incomplet » |
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
- Interface : `node tests/recette-transport.js` — 47 contrôles (REC-01…10, COM-01…10, GPS-01…05, POR-01…04, MAI-01…02, SEC-01…03, ENT-01…07, DOC-01…06).
- Base de données : `bash tests/recette-supabase.sh` — 49 contrôles sur PostgreSQL (droits RLS, idempotence, immutabilité, périodes, GPS).

## Points à valider avant production (§11)
1. **GPS** : fournisseur, boîtiers compatibles, abonnements, fréquence de remontée.
2. **Comptabilité** : plan de comptes, journaux, états requis, règles fiscales — par le comptable.
3. **Données initiales** : véhicules, contrats, créances, caisse et comptes tiers de départ (saisie par écritures `AN`).
4. **Raccordement Supabase** de l'interface (authentification, appels RPC), puis tests de charge (30 véhicules) et test de restauration.

## Pièces jointes
Les fichiers (PNG, JPEG, WebP, PDF) sont stockés dans IndexedDB, hors du stockage local limité à ≈ 5 Mo. Les images sont compressées automatiquement (JPEG, ≤ 300 Ko), les PDF sont limités à 300 Ko. Ils sont inclus dans la sauvegarde signée (somme de contrôle des fichiers) et restaurés avec elle.

## Circuits rentables (taxis communaux et VTC)
- Source : courses déclarées par les chauffeurs (zone, heure, montant), sans grille de demande préremplie.
- Moteur : `circuit-engine.js` (potentiel par zone × heure, demi-vie 30 j, lissage ±1 h, profil semaine/week-end, fiabilité, répartition D'Hondt plafonnée à 40 %).
- Portail chauffeur : « Où aller maintenant » (top 3, prochaines heures, filtre commune/ville), déclaration/retrait de course.
- Bureau (Pilotage › Circuits rentables) : carte de chaleur, plan de la journée, rapport hebdomadaire par chauffeur, zones paramétrables.
- Seuils : ≥ 30 courses pour proposer, ≥ 5 pour « indicatif », ≥ 20 pour « fiable ».
- Tests : `tests/circuit-engine.js`, `tests/transport-circuits.js`.

## Lignes wôrô-wôrô (taxis communaux)
- Pilotage › Lignes wôrô-wôrô : ligne = trajet fixe (commune, départ, arrivée), tarif par place, places par taxi, coordonnées facultatives ; modifier, désactiver. Le nom ne change plus après des courses déclarées.
- Portail chauffeur : déclaration d'un trajet de ligne avec le nombre de passagers ; recette = passagers × tarif (refus si le montant saisi diffère). Les zones (VTC / taxi libre) restent à montant libre.
- Circuits : les lignes sont classées comme des zones (carte de chaleur, plan, suggestions, itinéraire) ; une ligne désactivée est exclue.
- Bureau (Circuits › Par ligne, 7 jours) : trajets, passagers, remplissage, recette, recette par trajet, chauffeurs, meilleure heure.
- Tests : `tests/transport-lignes.js`, `tests/circuit-engine.js` (CE-26 à 28).
