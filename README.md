# thebestfan.online

Un jeu de cartes de supporters adossé aux vrais matchs de football. Le joueur
collectionne des Fanzzy, pousse sur une corde partagée pendant que son club
joue, et repart avec une carte-souvenir par but vécu.

**Commence par `ETAT.md`.** Ce fichier-ci décrit la forme du dépôt ; `ETAT.md`
décrit où en est le projet, ce qui marche, ce qui reste à faire et les pièges
qui ont déjà coûté des séances.

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
sql/                    le schéma, neuf fichiers, 27 tables
scripts/                les tests, un par module
```

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

Chaque module a sa suite dans `scripts/*-smoke.mjs`. Elles montent un vrai
serveur sur une vraie base — locale, sur le port 3307. Deux contrôles ne
demandent ni base ni réseau et passent avant chaque livraison :

```bash
node scripts/verif-pages.mjs      # les pages compilent, la barre est là
node scripts/verif-cablage.mjs    # aucun module n'a une dépendance restée nulle
```

Les détails, les prérequis et les pièges rencontrés sont dans `ETAT.md`.

## Déploiement

Pousser sur GitHub ne met rien en ligne : Infomaniak ne va chercher le dépôt
que lorsqu'on lance la construction dans le Manager. Voir `DEPLOIEMENT.md`, et
le piège correspondant au § 6 de `ETAT.md`.
