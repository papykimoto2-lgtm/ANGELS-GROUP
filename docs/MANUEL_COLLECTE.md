# Manuel de procédure — Collecte des colis chez les vendeurs partenaires

**ANGEL'S GROUP · Angel's Distributions (Livraison)** · Version 1 · Public : administrateur, superviseur, livreur, préparateur, vendeur partenaire

## 1. Objet
Organiser l'enlèvement, chez le vendeur partenaire, des colis dont la commande est **confirmée**, jusqu'à leur **réception au dépôt**, avec preuve (code vendeur), comptage et traitement des écarts.

## 2. Rôles
| Rôle | Responsabilité |
|---|---|
| Vendeur | Renseigne son adresse de collecte, confirme ses commandes, remet le colis **contre le code** |
| Admin / Superviseur | Planifie, réaffecte, annule une collecte ; suit les alertes |
| Livreur | Accepte ou refuse, se rend chez le vendeur, saisit le code et le nombre de colis |
| Préparateur / Admin | Réceptionne les colis au dépôt, compte, déclenche la préparation |

## 3. Pré-requis
1. Le vendeur a renseigné son **adresse de collecte** (zone, quartier, repère, position GPS conseillée) : *Espace vendeur → Collecte de mes colis → Renseigner mon adresse*.
2. La commande est au statut **Confirmée**.
3. Le livreur a un **dossier complet et valide** (si l'option « dossier obligatoire » est active) : sinon la mission est refusée.
4. Une commande ne peut figurer que dans **une seule collecte ouverte**.

## 4. Vue d'ensemble
`Commande confirmée` → **Planifiée** → **Acceptée** → **En route** → **Collectée** (vers le dépôt) → **Réceptionnée** → commande en **Préparation**.
Issues : **Non réalisée** (échec) · **Annulée**.

## 5. Procédure pas à pas

### Étape 1 — Repérer les commandes à collecter (Admin / Superviseur)
- Une alerte s'affiche : « N commande(s) de vendeurs confirmée(s) à collecter ».
- Ouvrir *Centre de livraison → Collectes* : liste des vendeurs avec commandes à collecter et leur adresse.
- Le bouton **Planifier la collecte** n'apparaît que pour une commande **de vendeur partenaire** au statut **Confirmée**. Une commande encore « à confirmer » doit d'abord être confirmée (*Commandes → Confirmer*) ; un message le rappelle. Le même bouton existe sur la fiche de la commande confirmée.
- Accès réservé aux profils **Admin** et **Superviseur** (menu *Centre de livraison*).

### Étape 2 — Planifier (Admin / Superviseur)
1. Sur la ligne du vendeur, cliquer **🚚 Planifier**.
2. Cocher les commandes à collecter (au moins une).
3. Choisir le **livreur** (disponibilité, courses et collectes en cours affichées) et le **créneau de passage**.
4. Vérifier l'**adresse de collecte** (zone et quartier ou repère obligatoires) ; ajouter une **note** au livreur si utile.
5. Valider : la collecte reçoit un numéro **COL-AAAA-NNNN** et un **code à 4 chiffres** visible uniquement par le vendeur.
- Le bouton **Imprimer** produit le **bon de collecte** (commandes, articles, colis remis / reçus, signatures).

### Étape 3 — Acceptation (Livreur)
- La mission apparaît dans les missions du livreur avec vendeur, téléphone, adresse, créneau, itinéraire.
- **✔ Accepter** ou **✖ Impossible** (motif obligatoire). Un refus remet la collecte à réaffecter.
- Alerte superviseur si le créneau est dépassé de plus de 15 minutes sans réponse.

### Étape 4 — Départ et enlèvement (Livreur)
1. **🏍️ Je pars chez le vendeur** (statut En route).
2. Chez le vendeur : vérifier les articles avec lui.
3. Le vendeur remet les colis **puis** donne son code (il ne doit pas le donner avant).
4. Cliquer **📦 Colis collectés** : saisir le **code**, puis le **nombre de colis pris par commande** (0 = non remise).
5. Valider : statut **Collectée**, direction le dépôt.
- Code faux : essai décompté ; au-delà du nombre d'essais autorisé (par défaut 5), le blocage impose d'appeler le superviseur.
- Vendeur absent ou impossible : **Vendeur absent / impossible** avec motif → statut **Non réalisée**.

### Étape 5 — Réception au dépôt (Préparateur / Admin)
1. Écran *Commandes* : bloc **📦 Collectes à réceptionner**, bouton **Réceptionner**.
2. Saisir, commande par commande, le **nombre de colis réellement reçus**.
3. Résultat automatique :
   | Situation | Effet |
   |---|---|
   | Reçus = collectés (et > 0) | La commande passe en **Préparation** |
   | Reçus < collectés | Incident **« Colis manquant »** |
   | Collectés = 0 | Incident **« Colis manquant »** (non remis par le vendeur) ; la commande reste Confirmée |
   | Reçus > collectés | Incident **« Écart de colis »** |
4. Les incidents sont créés automatiquement (INC-NNNN), à instruire par le superviseur.

### Étape 6 — Cas particuliers (Admin / Superviseur)
- **Réaffecter** (collecte Planifiée, Acceptée ou Non réalisée) : nouveau livreur et créneau ; le compteur d'essais du code est remis à zéro.
- **Annuler** (sauf Réceptionnée) : motif obligatoire.
- Commande sans collecte (marchandise déjà au dépôt) : la préparation peut être lancée directement ; tant qu'une collecte est ouverte pour la commande, le bouton de préparation est **désactivé**.

## 6. Contrôles et preuves
- Code vendeur à 4 chiffres = preuve de remise.
- Double comptage : colis remis (livreur) vs reçus (dépôt).
- Chaque action est inscrite au **journal d'audit** (planification, collecte, réception, réaffectation, annulation).
- Les alertes rappellent : collectes à planifier, collectes non réalisées à réaffecter, créneaux dépassés.

## 7. Paramètres
*Paramètres → Entreprise, téléphone et sécurité* : nombre d'essais du code (`essais_code_max`), dossier livreur obligatoire.

## 8. Limites connues
- La collecte est logistique : **aucun frais de collecte** ni écriture comptable n'est généré. Les écarts de colis sont traités par incident.
- Un colis manquant n'est pas valorisé automatiquement : la décision (responsabilité, dédommagement) se prend dans l'incident.

## 9. Check-list rapide
**Superviseur** : adresse vendeur OK → planifier → suivre alertes.
**Livreur** : accepter → partir → vérifier articles → code + nombre de colis → direction dépôt.
**Préparateur** : réceptionner → compter → traiter les incidents.
**Vendeur** : adresse à jour → code gardé secret jusqu'à la remise.
