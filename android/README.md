# L'appli Android (Play Store)

L'appli est une **TWA** : une coquille Android qui ouvre https://thebestfan.online
en plein écran. Le jeu reste le site : chaque mise en ligne habituelle arrive
en même temps sur le web et dans l'appli, sans repasser par Google. On ne
republie la coquille que pour changer son nom, son icône ou ses réglages
(monter alors `appVersionCode` dans `twa-manifest.json`).

## Ce que fait le site pour elle

- `/.well-known/assetlinks.json` (src/server/android.js) prouve que l'appli est
  à nous. Il répond 404 tant que `ANDROID_SHA256` n'est pas posé dans le `.env`
  du serveur : le site web ne change en rien avant.
- Paiement : dans l'appli, Google impose son propre paiement pour les achats
  numériques (PASS, boosters). `features.playBilling` est activé dans la
  coquille ; le côté site (Digital Goods API) est à faire.

## Où elle est sur le PC de Gaël (2026-11-04)

- Projet : `C:\Users\gaelm\Documents\thebestfan-android\` (hors dépôt), `.aab`
  et `.apk` signés dedans.
- Clé d'envoi : `thebestfan-envoi.keystore` (alias `thebestfan`), copie dans
  `G:\Mon Drive\thebestfan-android\` ; mot de passe chiffré DPAPI dans
  `%USERPROFILE%\.ssh\thebestfan-android.mdp`. SHA-256 :
  `04:12:55:2C:…:2F:8F:68` (en entier dans src/server/android.js).
- JDK 17 et SDK Android dans `%USERPROFILE%\.bubblewrap`. Pour reconstruire :
  monter `appVersionCode`, mettre le JDK de `.bubblewrap\jdk` dans le PATH
  (sinon jarsigner manque), vider `NoDefaultCurrentDirectoryInExePath` sous
  PowerShell (sinon gradlew.bat manque), `bubblewrap update` puis
  `bubblewrap build` avec `BUBBLEWRAP_KEYSTORE_PASSWORD` et
  `BUBBLEWRAP_KEY_PASSWORD`.
- `minSdkVersion` 24 : androidbrowserhelper 2.7.4 l'exige (Android 7 et plus).

## Fabriquer la coquille (une fois, sur le PC)

1. Compte développeur Google Play (25 $) : https://play.google.com/console
2. Installer Node, puis `npm i -g @bubblewrap/cli`.
3. Dans ce dossier : `bubblewrap init --manifest https://thebestfan.online/manifest.webmanifest`
   (ou `bubblewrap update` pour reprendre `twa-manifest.json`), puis
   `bubblewrap build`. Il crée la clé d'envoi `thebestfan-envoi.keystore` :
   **la garder hors du dépôt, avec son mot de passe, sans jamais la perdre.**
4. Envoyer `app-release-bundle.aab` dans la Play Console (test fermé d'abord :
   un compte personnel neuf doit faire tester par 12 personnes pendant 14 jours).
5. Play Console › Intégrité de l'appli › Signature de l'appli : ajouter
   l'empreinte SHA-256 de la clé de Google à `EMPREINTES_PAR_DEFAUT`
   (src/server/android.js), puis mettre en ligne.
6. Vérifier : https://thebestfan.online/.well-known/assetlinks.json montre les
   empreintes, et l'appli s'ouvre sans barre d'adresse.
