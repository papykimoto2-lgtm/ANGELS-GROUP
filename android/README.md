# Application Android « ANGEL'S — Livreur » + notifications push

L'application Android est la page `livreur.html` emballée en **TWA** (Trusted Web Activity) : même code, mêmes mises à jour (déployer = mettre à jour l'app),
Chrome fournit le GPS, le mode hors ligne et les **notifications push** (Web Push) même application fermée. Aucun code Android à maintenir.

Deux chantiers indépendants : **A. les notifications push** (marchent déjà dans Chrome / Android, avec ou sans l'APK) et **B. l'APK / Play Store**.

## A. Notifications push (serveur + téléphone)

1. **Clés VAPID** : `node tools/gen-vapid.js` → deux lignes `VAPID_PUBLIC_KEY=…` et `VAPID_PRIVATE_KEY=…`.
2. **Clé publique dans l'application** : coller la clé publique dans `passerelle-config.js` (champ `vapid`), puis déployer. La clé privée n'est **jamais** dans le dépôt.
3. **Secrets Supabase** : `supabase secrets set VAPID_PUBLIC_KEY=<publique> VAPID_PRIVATE_KEY=<privée> VAPID_SUBJECT=mailto:vous@exemple.com` (`ADMIN_KEY` est déjà défini par la passerelle livreur).
4. **Base** : appliquer `supabase/migrations/011_push.sql` (table `pg_push`, sans accès direct pour les navigateurs).
5. **Fonctions** :
   `supabase functions deploy push-abonner` (jeton du livreur vérifié dans la fonction) puis
   `supabase functions deploy push-envoyer --no-verify-jwt` (protégée par `ADMIN_KEY`, comme `mission-sync`).
6. **Bureau** : Paramètres → Livreurs & GPS → « Notifications push des livreurs » (activé par défaut ; types réglables).
7. **Chaque livreur** : menu ☰ → « GPS, mot de passe et alertes » → « 🔔 Activer les notifications » (ou le bandeau proposé à l'ouverture), puis « Tester ».

Ce qui déclenche une notification : nouvelle mission affectée, message du centre, alerte SOS prise en charge, prime ou bonus payé, collecte planifiée.
La charge utile est chiffrée de bout en bout (RFC 8291) et ne contient ni nom ni numéro de client. Les abonnements morts (404/410) sont supprimés automatiquement ; 5 échecs de suite aussi.
Sécurité : le serveur n'appelle que les services push connus (FCM, Mozilla, Apple, Windows) en HTTPS ; 5 téléphones au plus par livreur ; l'envoi exige la clé d'administration.

## B. APK / Play Store (TWA)

Prérequis (poste de travail, pas le serveur) : Node 18+, JDK 17, Android SDK (Bubblewrap les télécharge s'il le propose), un compte Google Play Console.

1. `npm i -g @bubblewrap/cli`
2. Dans ce dossier `android/` : `bubblewrap init --manifest=https://angelsgroups.vercel.app/manifest-livreur.webmanifest` (reprend `twa-manifest.json`, accepter les valeurs par défaut).
   Si l'adresse de production change, modifier `host`, `iconUrl`, `maskableIconUrl`, `webManifestUrl` dans `twa-manifest.json`.
3. **Clé de signature** : Bubblewrap en crée une (`angels-livreur.keystore`). **Sauvegardez-la hors du dépôt** (gestionnaire de mots de passe / coffre) : sans elle, plus aucune mise à jour possible. Ne jamais la committer.
4. `bubblewrap build` → `app-release-bundle.aab` (Play Store) et `app-release-signed.apk` (installation directe pour tester).
5. **Lien de confiance (Digital Asset Links)** : `bubblewrap fingerprint list` (ou Play Console → Intégrité de l'application → certificat de signature de l'application) donne l'empreinte **SHA-256**.
   La coller dans `assetlinks.json` (à la racine du dépôt, servi sur `/.well-known/assetlinks.json` par `vercel.json`), déployer, puis vérifier :
   `https://angelsgroups.vercel.app/.well-known/assetlinks.json`. Sans cela, l'application affiche une barre d'adresse Chrome (elle fonctionne quand même).
   Avec Play App Signing, utiliser l'empreinte du **certificat de signature de l'application** de la console (pas celle de la clé d'envoi).
6. Play Console : créer l'application, envoyer le `.aab`, fiche (captures, description, politique de confidentialité : position GPS pendant les courses, notifications), test interne puis production.
7. Les notifications push utilisent Chrome : sur Android 13+, l'application demande l'autorisation « Notifications » au premier lancement de l'activation.

Le package `africa.sanix.angels.livreur` doit rester identique dans `twa-manifest.json` et `assetlinks.json`.
