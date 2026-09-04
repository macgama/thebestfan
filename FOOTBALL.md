# Suivi des équipes — API-Football

Résultats, calendrier, classement et buts en direct pour les clubs suivis par
tes joueurs. C'est aussi la brique qui alimente le bonus live des duels.

## Fichiers

```
sql/football.sql                        schéma à appliquer après auth.sql
src/server/football/client.js           client API : signature, quota, temporisation
src/server/football/store.js            requêtes SQL
src/server/football/poller.js           worker : rafraîchissement, direct, buts
src/server/football/routes.js           routes HTTP et diffusion socket
public/equipes.html                     page « mes équipes », 4 langues
scripts/football-smoke.mjs              test de bout en bout (39 vérifications)
server.js                               mis à jour : monte le module et démarre le worker
```

## Installation

```bash
mysql -h o42s1v.myd.infomaniak.com -u o42s1v_tbf -p o42s1v_thebestfan < sql/football.sql
```

Une ligne à ajouter dans `.env` :

```
API_FOOTBALL_KEY=ta_clef
API_FOOTBALL_BUDGET=6800
```

Puis redémarrer. `/healthz` doit indiquer `"football":"actif"`, et la page
`/equipes` devient utilisable.

Attention : si tu as déjà appliqué `duel.sql`, il a créé une table
`user_follows` avec un `user_id` en VARCHAR(64). Supprime-la avant :
`DROP TABLE IF EXISTS user_follows;`

## Le budget d'appels

Ton forfait Pro donne 7 500 appels par jour. Le budget par défaut est fixé à
6 800 pour garder une marge : les recherches déclenchées par les joueurs
passent avant le worker.

Quatre décisions font tenir ce budget :

**On n'interroge que les clubs suivis.** Un club que personne ne suit ne coûte
rien. Se désabonner libère immédiatement les appels correspondants.

**Le direct regroupe 20 matchs par appel.** Un samedi après-midi avec quinze
matchs suivis en cours coûte un seul appel toutes les 20 secondes, soit environ
540 appels pour l'après-midi. Sans regroupement, ce serait quinze fois plus.

**Les événements ne sont demandés que lorsque le score bouge.** Le nom du
buteur et la minute coûtent un appel, mais seulement au moment du but, pas
toutes les minutes de chaque match.

**Rien n'est demandé deux fois.** Les classements sont rafraîchis toutes les six
heures, les calendriers une fois par jour, et une recherche déjà faite est
resservie depuis la base pendant six heures. La page `/equipes` peut être
consultée mille fois sans coûter un seul appel : tout vient de MariaDB.

Quand le budget est atteint, le worker se met en pause et la recherche renvoie
ce que la base connaît, avec un indicateur `partial`. Rien ne casse.

Consommation du jour : `GET /api/football/quota` une fois connecté.

## Routes

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/football/search?q=` | recherche d'un club, base d'abord |
| GET | `/api/football/follows` | clubs suivis |
| POST | `/api/football/follows` | suivre un club (`teamId`, `isMain`) |
| DELETE | `/api/football/follows/:teamId` | ne plus suivre |
| GET | `/api/football/feed` | direct, prochains matchs, derniers résultats |
| GET | `/api/football/team/:id` | fiche d'un club |
| GET | `/api/football/league/:id/standings?season=` | classement |
| GET | `/api/football/fixture/:id/events` | buts et cartons d'un match |
| GET | `/api/football/quota` | consommation du jour |

## Temps réel

Le client rejoint un salon par club (`team:<id>`) avec `football:watch`, puis
reçoit `football:fixture` à chaque changement de score ou de statut, et
`football:goal` à chaque but, avec le buteur et la minute.

## Le lien avec les duels

`onGoal` est déjà branché dans `server.js` : quand un club marque, chaque
joueur qui le suit et se trouve en duel reçoit un souffle supplémentaire. Le
serveur estampille l'événement et le diffuse aux deux joueurs du duel, donc les
deux voient exactement la même chose au même numéro de séquence.

Ce branchement suppose que le serveur de duel soit démarré et exposé en
`globalThis.duels`. Tant que le duel n'est pas monté, `onGoal` ne fait rien.

## Vérifier

```bash
node scripts/football-smoke.mjs
```

Le test monte une fausse API-Football au format réel et déroule le parcours
complet : recherche, abonnement, chargement du calendrier, passage en direct,
but marqué, diffusion, absence de doublon au tour suivant, fin de match,
classement, et libération des appels après désabonnement.

## Reste à faire

1. Écran de classement complet (les données sont là, la page ne les affiche pas
   encore).
2. Notifications push pour les buts, une fois la PWA en place.
3. Choix du club principal depuis l'interface : l'API le gère (`isMain`), le
   bouton manque.
