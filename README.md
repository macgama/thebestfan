# FANZDuel — duel temps réel

Module de duel autoritaire pour `macgama/FANZDuel`. TypeScript strict, aucune
dépendance en plus de `socket.io` (déjà dans ton `package.json`). Ni Firestore,
ni framework imposé : ça se branche sur ton `server.ts` existant.

## Ce que ça fait

Deux joueurs s'affrontent en 90 minutes de jeu, en 3 buts. Chaque action est
validée par le serveur, numérotée, diffusée aux deux joueurs et journalisée.
Le client n'a aucune autorité : il envoie des intentions et rejoue ce que le
serveur décide.

## Fichiers

```
src/shared/duel/protocol.ts   types partagés client/serveur, intentions, événements
src/shared/duel/engine.ts     règles du jeu — pur, déterministe, sans I/O ni réseau
src/shared/duel/cards.ts      catalogue mécanique (à migrer vers la table cards)
src/shared/duel/rng.ts        aléatoire déterministe, une partie est rejouable
src/shared/duel/project.ts    applique un événement au snapshot côté client
src/shared/i18n/duel.json     fr / en / de / es
src/server/duel/index.ts      authentification, file d'attente, routage
src/server/duel/room.ts       une partie : séquencement, diffusion, reconnexion
src/server/duel/store.ts      persistance : mémoire ou MariaDB
src/client/duel/useDuel.ts    hook React
sql/duel.sql                  schéma MariaDB
scripts/duel-smoke.mjs        partie complète jouée par deux vrais clients
scripts/duel-loadtest.mjs     mesure de latence sous charge
server.duel.example.ts        montage dans ton server.ts
```

## Installation

```bash
cp -r src/shared/duel src/shared/i18n src/server/duel src/client/duel <ton-repo>/src/
cp sql/duel.sql scripts/duel-*.mjs <ton-repo>/
mysql -u … -p thebestfan < sql/duel.sql     # quand tu passes en MariaDB
```

Puis reprends `server.duel.example.ts` dans ton `server.ts`. Le `build` actuel
(`esbuild server.ts --bundle`) embarque le module sans configuration
supplémentaire.

## Vérifier

```bash
npm run smoke   # joue une partie complète, coupe le réseau, vérifie la reprise
node scripts/duel-loadtest.mjs 100
node scripts/duel-loadtest.mjs 100 https://thebestfan.online   # une fois déployé
```

Le test de bout en bout vérifie l'appariement, le masquage de la main adverse,
le refus d'une action hors tour, la reprise après coupure, l'égalité des deux
vues en fin de partie et le respect des 90 minutes.

## Mesures

Sur une machine de développement, serveur et clients dans le même process
(mesure le moteur, pas le réseau) :

| duels simultanés | sockets | latence action → vue adverse | mémoire |
|---|---|---|---|
| 100 | 200 | p50 15 ms · p95 60 ms | +28 Mo |
| 400 | 800 | p50 54 ms · p95 158 ms | +61 Mo |

À refaire sur Infomaniak avec l'URL réelle avant l'ouverture publique : c'est ce
chiffre-là qui compte. Le site Node.js d'Infomaniak fait tourner **un seul
process** : pas de scaling horizontal. À l'échelle où le p95 dépasse ~250 ms, il
faudra passer sur un Serveur Cloud avec plusieurs instances, l'adaptateur Redis
de socket.io et des sessions collantes.

## Déploiement Infomaniak

Site Node.js sur l'hébergement Web, méthode personnalisée, dépôt Git :

- build : `npm ci && npm run build`
- start : `npm start` (ton script écoute déjà `process.env.PORT`)
- variables : `DATABASE_URL`, `PUBLIC_ORIGIN=https://thebestfan.online`, `API_FOOTBALL_KEY`

Le WebSocket passe par le même port que le HTTP, sans configuration
particulière. Le repli `polling` est activé pour les réseaux d'entreprise qui
bloquent l'upgrade.

## Multilingue

Le serveur n'envoie jamais de texte traduit, seulement des codes
(`event.goal`, `error.not_your_turn`) et des paramètres. Conséquence utile :
les deux joueurs d'un même duel peuvent être dans deux langues différentes, et
ajouter l'italien ne demandera pas de redéploiement du serveur.

Les noms de cartes et les textes de chants suivent la même règle :
`card.VN-003.name`, `chant.c-craquage.text`.

## Règles implémentées

- 90 minutes, un tour = 5 minutes, 45 s de réflexion par tour.
- Premier à 3 buts. À 90', le score départage ; à égalité, match nul.
- 20 cartes par deck, 5 en main, un groupe au premier rang, 3 sur le banc.
- Un souffle attaché par tour ; le chant met fin au tour.
- Pas de chant au tout premier tour.
- Point faible : +20 de pression.
- KO d'un groupe : l'adversaire marque, le joueur touché promeut un groupe du banc.
- Plus de cartes à piocher : défaite.
- Déconnexion : 60 s de battement, puis forfait.
- But réel du club suivi pendant le duel : un souffle offert, injecté par le
  serveur comme un événement normal, donc identique pour les deux joueurs.

## À faire avant l'ouverture publique

1. **Remplacer `authenticate`.** En l'état, le jeton est l'identifiant :
   n'importe qui peut jouer sous l'identité d'un autre et reprendre son duel.
2. Brancher `getDeck` sur les cartes réellement possédées, sinon un client
   modifié peut jouer un deck de 20 cartes couronne.
3. Passer `MemoryStore` en `MysqlStore` (`npm i mysql2`), sinon un redémarrage
   perd les parties en cours.
4. Remplir `duel_results` en fin de partie pour le classement et l'historique.
5. Rejouer le test de charge sur l'URL de production.
