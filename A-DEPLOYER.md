# À déposer sur Infomaniak

Archive : `thebestfan.zip`. Elle ne contient ni `node_modules`, ni `dist`, ni
`public/duel.bundle.js` — ces trois-là sont fabriqués sur le serveur par
`npm run build`, et c'est ce que dit déjà le `.gitignore`.

---

## Les fichiers qui ont changé

Si tu préfères ne téléverser que le delta plutôt que tout remplacer, voici la
liste exacte par rapport à l'archive du début de session.

### Nouveaux fichiers

```
public/deck.html                    écran de construction de deck
public/duel-nvn.html                écran de duel N contre N
public/img/fanzzy/X7.avif           Le Trieur de Doubles, plein pied
public/img/fanzzy/X7.webp
public/img/fanzzy/X7.png
public/img/fanzzy/X7-buste.avif     Le Trieur de Doubles, buste
public/img/fanzzy/X7-buste.webp
public/img/fanzzy/X7-buste.png
public/img/fanzzy/X8.avif           La Mascotte du Dimanche, plein pied
public/img/fanzzy/X8.webp
public/img/fanzzy/X8.png
public/img/fanzzy/X8-buste.avif     La Mascotte du Dimanche, buste
public/img/fanzzy/X8-buste.webp
public/img/fanzzy/X8-buste.png
scripts/verif-pages.mjs             contrôle avant chaque livraison front
scripts/deck-ui-smoke.mjs           test de l'écran de deck
scripts/nvn-ui-smoke.mjs            test de l'écran de duel
scripts/fanzzy-ui-smoke.mjs         test du classeur
package-lock.json                   versions figées
```

### Fichiers remplacés

```
server.js                           routes /deck et /duel-nvn
package.json                        jsdom en devDependencies, scripts de test
ETAT.md                             remis à jour
DEPLOIEMENT.md                      27 tables au lieu de 24, nouvelles adresses
src/shared/fanzzy/dex.js            deux Fanzzy ajoutés : X7 et X8
src/server/fanzzy/index.js          /dex sert aussi rar et rates
src/server/ferveur/gestures.js      resoudreGeste : barème envoyé au client
src/server/ferveur/virage.js        idem, côté Grand Virage
src/server/nvn/engine.js            idem, côté duel N contre N
src/server/nvn/index.js             garde sur l'identifiant de session
public/fanzzy.html                  catalogue lu depuis l'API, plus de copie
public/fanzzy-fiche.html            repli avif → webp → png
public/nav.js                       /duel-nvn est un écran de jeu
public/profil.html                  entrée « Mon deck »
public/virage.html                  barème du geste reçu du serveur
scripts/nvn-smoke.mjs               test intermittent corrigé
scripts/virage-smoke.mjs            trois contrôles sur le barème du geste
```

**Aucun fichier SQL n'a changé.** Le schéma reste à 27 tables, il n'y a pas de
migration à passer pour cette livraison.

---

## Les étapes, dans l'ordre

### 1. Poser les fichiers

Décompresse l'archive et pousse sur GitHub en gardant l'arborescence, comme
d'habitude. Rien à supprimer côté serveur.

### 2. Construire

```bash
cd ~/sites/thebestfan.online
npm run build
```

C'est cette commande qui fabrique `dist/duel-server.mjs` et
`public/duel.bundle.js`. Sans elle, le duel un contre un ne se charge pas.

### 3. Redémarrer, puis vérifier

```bash
curl https://thebestfan.online/healthz
```

Puis à la main, dans cet ordre — chaque écran dépend du précédent :

1. `/fanzzy` — le classeur doit afficher **29** cartes et la progression sur 29.
   S'il en affiche 27, le navigateur sert encore l'ancien catalogue en cache :
   recharge en forçant.
2. `/deck` — construis un deck. Il te faut trois Fanzzy ; un compte neuf n'en a
   que deux, il faut ouvrir un booster de plus.
3. `/duel-nvn` — choisis un format et un match, puis entre en file. Au bout de
   vingt secondes sans adversaire, des bots complètent et le duel démarre en
   entraînement.

---

## Les trois points serveur toujours en attente

Ils étaient déjà là au début de la session et n'ont pas bougé.

**Relancer l'inventaire des compétitions.** Les paliers en base suivent encore
l'ancienne règle, qui classait 117 compétitions comme majeures.

```bash
node --env-file=.env scripts/coverage.mjs
```

Attendu : une dizaine de compétitions majeures, pas 117.

**Déclarer un administrateur.** Aucun compte n'a le rôle aujourd'hui. Ajoute
`ADMIN_EMAILS=ton@adresse.ch` dans `.env`, puis redémarre. `/admin` reste
inaccessible tant que ce n'est pas fait.

**Les tenues de base des anciens Fanzzy.** Le fichier `sql/tenues-de-base.sql`
cité dans les notes **n'existe pas** dans le dépôt. Il est à réécrire avant de
pouvoir exécuter ce point. Ce n'est pas bloquant : les Fanzzy obtenus depuis
reçoivent leur tenue de base à l'ouverture du booster.

---

## Une chose à décider

Le catalogue est servi avec un cache d'une heure. Après ce déploiement, un
joueur déjà connecté gardera l'ancien catalogue à 27 cartes jusqu'à soixante
minutes, et pourra tirer X7 ou X8 sans que sa page sache les afficher.

Ça ne casse plus rien : l'ouverture de booster affiche désormais « Carte
inconnue de cette version, recharge la page ». Mais c'est une heure
d'expérience dégradée à chaque déploiement qui touche au catalogue.

La correction propre est un numéro de version dans l'URL du catalogue, pour
casser le cache à chaque mise en ligne sans renoncer au cache le reste du
temps. À faire à la prochaine session si tu veux.
