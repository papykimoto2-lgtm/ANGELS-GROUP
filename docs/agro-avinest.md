# Angel's Agro — ERP avicole (inspiré d'AviNest Pro)

`agro.html` est développé comme `index.html` (Livraison) : un seul fichier HTML/CSS/JS, données dans le navigateur, connexion par PIN, menus par rôle, journal d'audit, sauvegarde/restauration. Il reprend le métier et le vocabulaire d'**AviNest Pro** (dépôt `AVICOSUITE_ERP`, https://avicosuite-erp.vercel.app/) : lots chair/ponte, suivi quotidien, calendrier prophylactique, couvoir, fabrication d'aliments, stock, ventes, charges, rentabilité par lot, plan comptable repris d'AviNest.

## Modules
| Menu | Contenu |
|---|---|
| Tableau de bord | Effectifs, mortalité, œufs, aliment, ventes, créances, trésorerie, résultat, alertes |
| Lots & élevage | Fiche lot façon AvicoSuite : liste des lots, en-tête, alertes, indicateurs, score, courbes (ponte/poids/mortalité/aliment), onglets Vue d’ensemble · Suivi semaine · Saisie du jour · Prophylaxie · Alimentation · Historique · Sortie/Réforme · Rentabilité. Non repris : conditionnement, Copilote |
| Suivi quotidien | Mortalité, aliment (déduit du stock), eau, pesée, œufs/casses (versés au stock de plateaux) |
| Santé & prophylaxie | Calendrier généré par protocole, soins réalisés (stock), traitements avec **délai d'attente** qui bloque la vente |
| Couvoir | Incubation → mirage J18 → éclosion J21, taux, création du lot depuis l'éclosion |
| Stock · Fabrication · Achats | Coût moyen pondéré, inventaire motivé, recettes (100 %), bons de commande, réception, règlement fournisseur |
| Ventes & clients | Plateaux d'œufs, fientes, sujets vivants par lot ; facture, encaissement partiel, reçu, annulation motivée |
| Trésorerie · Charges · Rentabilité | Caisse/banque, charges par lot, marge et coût par kg vendu |
| Comptabilité SYSCOHADA | Partie double, journaux VE/AC/TR/PAIE/OD, balance, grand livre, résultat, périodes clôturables, extourne |
| Rapports | États périodiques (production, mortalité, stocks, approvisionnement, finance, commercial, bilan) avec période + lot, impression A4, vue à l’écran, WhatsApp ; rapports jour/semaine/mois/année par WhatsApp/email ; exports CSV. Non repris d’AvicoSuite : GMAO, conditionnement, messagerie interne, envoi serveur planifié |
| Personnel · Utilisateurs · Paramétrage | Salaires, rôles, seuils d'alerte, protocoles sanitaires, sauvegarde |

## Comptes de démonstration
admin `1234` · direction `0000` · chef `1111` · soigneur `2222` · magasinier `3333` · commercial `4444` · caissier `5555` · comptable `6666`.

## Tests
`node tests/recette-agro.js` — 20 contrôles (stock, délai d'attente, ventes, encaissements, annulations, comptabilité, droits, sauvegarde).

## Limites et points à valider
- Données locales à un appareil : backend Supabase requis avant production (même démarche que Transport).
- Plan comptable repris d'AviNest, indicatif : à valider par le comptable. Achats passés en charges à l'achat, sans variation de stocks.
- Non repris d'AviNest (V1) : GMAO équipements, simulation de bande, messagerie, portail client/fournisseur, paie détaillée (CNPS, ITS).
- L'ERP AviNest Pro d'origine reste disponible ; ses mots de passe sont hachés côté navigateur (djb2) : à migrer vers Supabase Auth.
