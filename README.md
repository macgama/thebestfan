# thebestfan.online

Un jeu de cartes de supporters adossé aux vrais matchs de football. Le joueur
collectionne des Fanzzy, pousse sur une corde partagée pendant que son club
joue, et repart avec une carte-souvenir par but vécu.

**Commence par `ETAT.md`.** Ce fichier-ci décrit la forme du dépôt ; `ETAT.md`
décrit où en est le projet, ce qui marche, ce qui reste à faire et les pièges
qui ont déjà coûté des séances. Il a une table d'entrée en tête, qui dit quelle
section ouvrir selon la question qu'on se pose — le lire en entier n'est pas
prévu.

Les documents, et lequel ouvrir :

| Fichier | Ce qu'il répond |
|---|---|
| `ETAT.md` | où en est le projet, et quels pièges sont connus |
| `HISTORIQUE.md` | **pourquoi** le code est écrit ainsi — quarante-trois sessions, à consulter, jamais à lire d'affilée |
| `IDEES.md` | ce qui n'est pas encore écrit, rangé par valeur |
| `refonte/` | la refonte FAIT MAIN de l'interface : où elle en est, la direction choisie et sa maquette, les briefs de lot, et comment reprendre (`refonte/README.md`) |
| `serveur/` | le chantier serveur de la refonte : le contenu choisi (`SERVEUR.md`), les contrats d'API que lisent les écrans (`CONTRATS.md`, cité par le code), le plan, les écarts au contrat, les risques et l'étude d'économie avec sa simulation |
| `DEPLOIEMENT.md` | comment mettre en ligne, et les pièges de l'hébergeur |
| `A-DEPLOYER.md` | le lot en attente de mise en ligne, et comment le vérifier |
| `VISUELS.md` | les règles de toute image produite, et qui les fait respecter |
| `JURIDIQUE.md` | le dossier à donner à un juriste |

Deux pages se **génèrent** et ne s'écrivent jamais à la main. `npm run dossier`
écrit `dossier.html` : où en est le jeu, règles, barèmes et chiffres, lus dans les
mêmes modules que le jeu. `npm run catalogue` écrit `catalogue.html` : ce qui est
dessiné et ce qui manque, carte par carte, images incluses dans le fichier.
**Quand un nombre de ce dépôt contredit ces deux pages, ce sont elles qui ont
raison** — un chiffre écrit à la main est faux le jour où l'on ajoute une carte,
et personne ne le sait.

`JURIDIQUE.md` est le dossier à donner à un juriste : ce qui est vendu, ce
qui est tiré au sort, et où passe la frontière. Ce n’est pas un avis de droit
et il ne peut pas en tenir lieu — il est là pour qu’une consultation coûte une
heure au lieu de trois. `CGV.md`, `CONFIDENTIALITE.md`,
`MENTIONS-LEGALES.md` et `LICENCE-API-FOOTBALL.md` sont les documents qui
manquaient : des **projets**, écrits d’après ce que le code fait, à faire relire
avant publication. Ce qui est entre crochets attend une information que seul
l’éditeur possède.

## La forme du projet

Node.js et MariaDB, hébergé chez Infomaniak. Données sportives fournies par
API-Football, dans une enveloppe de 7 500 appels par jour — c'est la contrainte
qui décide de presque toute l'architecture.

**Aucune étape de compilation.** Tout est du JavaScript servi tel quel : les
modules serveur sous `src/server/`, les pages sous `public/`. Il n'y a ni
paquet à fabriquer ni transpilation, donc une panne de moins entre le code et
la page.

```
server.js               montage des modules, routes des pages, socket.io
src/server/<module>/    un dossier par domaine, chacun avec son routeur
src/shared/             ce que le serveur et le navigateur lisent tous les deux
public/                 les pages, une par écran, script en ligne
public/fanzzy-art.js    le dessin des Fanzzy — source unique, partagée
public/nav.js           la barre commune
public/fx.js            les effets et les personnages vivants
sql/                    le schéma, 34 fichiers appliqués dans l'ordre, 47 tables
scripts/                les tests, un par module — et les chaînes de production
```

L'ordre d'application du schéma vit dans `scripts/ordre-schema.mjs`, lu à la fois
par `npm run schema:appliquer` et par sa suite de contrôle : les deux avaient leur
propre liste, et elles ont divergé deux fois.

## Le jeu

Un seul mécanisme, décliné à deux échelles :

- **Le Grand Virage** (`/virage`) — toute une tribune tire sur la même corde
  pendant un vrai match. Un but réel la secoue et ouvre une minute qui compte
  double.
- **Le duel de tribunes** (`/duel-nvn`) — le même geste, de 1 contre 1 à
  5 contre 5, avec un deck : trois Fanzzy, deux pièces d'équipement chacun, dix
  cartes d'action.

Le geste est noté par le serveur, jamais par le client. C'est ce qui ferme la
porte à l'automatisation, et c'est aussi ce qui garantit qu'un joueur équipé
voit exactement la pulsation sur laquelle il est noté.

## Les tests

`npm test` lance les **soixante-six** suites. Elles se divisent en deux
groupes, et il faut le savoir avant de s'alarmer :

- **vingt-sept ne demandent rien** et tournent tout de suite, sur n'importe
  quelle machine ;
- **trente-neuf demandent MySQL** — une base *locale*, sur le port 3307, jamais
  celle de production : elles effacent les tables au démarrage. Sans base, elles
  ne rougissent pas, elles s'arrêtent, et `npm test` les compte comme « la suite
  s'est arrêtée ».

**Un premier `npm test` sur une machine sans base affiche donc trente-neuf
échecs, et c'est normal.** Voir `ETAT.md` § 2 pour la base attendue et § 4 pour
le détail des deux groupes.

Quatre contrôles ne demandent aucune base et passent avant chaque livraison :

```bash
npm run pages             # les pages compilent, la barre est là, aucun id en double
npm run cablage           # les modules sont branchés, et le serveur n'emporte
                          # aucun paquet de développement
npm run promesses         # chaque adresse appelée par une page est servie
npm run pages:navigateur  # les 24 écrans s'ouvrent sans lever, serveur muet compris
```

## Déploiement

Pousser sur GitHub ne met rien en ligne : Infomaniak ne va chercher le dépôt
que lorsqu'on lance la construction dans le Manager. Voir `DEPLOIEMENT.md`, et
le piège correspondant au § 6 de `ETAT.md`.

**Le serveur s'installe sans les dépendances de développement** —
`npm ci --omit=dev`. `puppeteer` est déclaré parce que les suites d'interface
pilotent un vrai navigateur, et son installation télécharge Chromium : deux cents
mégaoctets dont ce serveur n'a aucun usage, et une étape de plus qui peut faire
échouer tout le déploiement. Les cinq paquets de production sont `express`,
`mysql2`, `nodemailer`, `socket.io` et `socket.io-client` ; `npm run cablage`
vérifie que rien de ce que charge le serveur n'en demande d'autres.
