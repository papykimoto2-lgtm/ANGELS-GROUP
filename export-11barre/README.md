# 11Barré

Maquette interactive d'une application de **courses et de livraison** (page unique, installable en PWA, sans serveur).

## Voir la maquette
Ouvrir `index.html` dans un navigateur (de préférence en affichage mobile), ou la déployer telle quelle (Vercel, Netlify, GitHub Pages).

## Parcours couvert
- Accueil : Courses, Moto-taxi, Livraison, Cargo (Food et Interurbain « bientôt »), recherche de destination, adresses récentes.
- Commande : prix et délai **avant** de commander, carte de l'itinéraire, options (instructions, commander pour quelqu'un d'autre, message uniquement), modes de paiement (espèces, Orange Money, Wave, MTN MoMo ; carte « bientôt »).
- Livraison et Cargo : destinataire et colis, qui paie, vitesse (Express, Standard, Un peu plus long, Dans 2 heures), porte à porte (+200 F), montant à encaisser.
- Course simulée : recherche, approche du chauffeur, code de confirmation, trajet, notation, historique, SOS, partage du trajet.

## Données de démonstration
20 lieux du Grand Abidjan (coordonnées approximatives), grille de prix fictive (base + km × tarif, arrondi à 50 F, minimum par catégorie), chauffeurs et plaques inventés, carte schématique sans tuiles externes. Aucun paiement réel. Seuls l'historique, les adresses récentes et le mode de paiement sont gardés sur l'appareil.

## Pour passer à une vraie application
Compte client et authentification, base de données (commandes, chauffeurs, livreurs), moteur d'adresses et d'itinéraires, grille de prix réelle, affectation automatique, notifications push, paiement mobile intégré (accords opérateurs), application chauffeur/livreur. Les numéros d'urgence affichés (185, 110, 180) sont à vérifier.

## Fichiers
`index.html` (toute l'application) · `manifest.webmanifest` · `sw.js` · `vercel.json` · `icons/`
