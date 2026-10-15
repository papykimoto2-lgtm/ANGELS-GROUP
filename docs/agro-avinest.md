# Angel's Agro — AviNest Pro

Angel's Agro s'appuie sur **SANIX AviNest Pro** (dépôt `AVICOSUITE_ERP`, déployé sur https://avicosuite-erp.vercel.app/), l'ERP avicole de Sanix Africa. Le hub y renvoie ; aucun code n'est dupliqué dans ce dépôt.

## Modules couverts par AviNest Pro (relevé dans `index.html`)
Tableau de bord · Rapports et envoi · Messagerie · Reproduction et couvoir · Approvisionnement · Fabrication d'aliments · Lots et élevage · Stock · Conditionnement · Distribution · Finance et rentabilité · Comptabilité SYSCOHADA · Simulation de bande · GMAO équipements · Personnel · Paramétrage · Portail client / fournisseur.

## Mise en route d'Angel's Agro
1. Ouvrir l'application ; à la première ouverture, saisir la configuration Supabase et un **identifiant d'organisation propre** (ex. `angels-agro`) : l'application bloque l'accès tant qu'il n'est pas défini, pour ne pas partager les données avec une autre exploitation.
2. Appliquer `migration_v13.sql` sur le projet Supabase concerné, puis créer le premier accès administrateur.
3. Pour que l'ensemble du groupe partage le même socle (utilisateurs, comptabilité consolidée), prévoir une authentification commune : étape ultérieure, à décider avec le schéma Supabase du groupe.

## Points d'attention relevés (sans modifier ce dépôt)
- Les mots de passe sont hachés avec un algorithme simple (djb2) côté client ; le code lui-même recommande de migrer vers bcrypt/argon2 ou vers Supabase Auth.
- La réinitialisation totale passe déjà par une Edge Function (`hard-reset`) : bon principe, à conserver.
- Le hub ne peut pas afficher de chiffres d'Agro (autre domaine, données dans Supabase) : un indicateur consolidé suppose une API ou une vue Supabase partagée.
