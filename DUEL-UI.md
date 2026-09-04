# Écran de duel

Le jeu devient jouable. Plateau vertical, chrono 90 minutes, chants, souffle,
banc de trois, et le tout branché sur l'authentification et le moteur déjà
testés.

## Ce qui change dans le déploiement

C'est la première fois qu'il y a une étape de construction. Le serveur et les
pages restent en JavaScript simple ; seul le duel est en TypeScript, et esbuild
en produit deux fichiers :

```
dist/duel-server.mjs      importé par server.js
public/duel.bundle.js     chargé par la page de duel
```

**Commande de build à mettre dans le Manager :**

```
git pull && npm install && node build.mjs
```

Le `--omit=dev` doit disparaître : esbuild est une dépendance de développement,
et sans lui la construction échoue.

Ajoute aussi ces deux lignes à ton `.gitignore` — ce sont des fichiers générés,
ils n'ont rien à faire dans le dépôt :

```
dist/
public/duel.bundle.js
```

Et applique le schéma des duels :

```bash
mysql -h o42s1v.myd.infomaniak.com -u o42s1v_tbf -p o42s1v_thebestfan < sql/duel.sql
```

Ce fichier ne crée plus que `duels`, `duel_events` et `duel_results` : les
tables partagées avec le suivi des équipes sont définies par `football.sql`.

## Comment on y joue

`https://thebestfan.online/duel`. Bouton « chercher un duel », puis attente
d'un adversaire.

Une carte de la main se pose sur le banc d'un toucher. Le jeton de souffle en
bas à gauche s'arme d'un toucher, puis se pose sur le groupe de ton choix. Un
toucher sur ton groupe de premier rang ouvre ses chants, avec ceux que tu peux
payer soulignés en vert. Un chant met fin à ton tour. Un toucher sur un groupe
du banc propose de reculer, au prix indiqué en souffles.

Le bandeau du haut porte l'essentiel : les buts sous forme de trois pastilles,
la minute de jeu, et une barre qui se vide pendant les 45 secondes de
réflexion. Quand un groupe tombe, un panneau demande qui monte au premier rang.

## Pour l'essayer, il te faut deux comptes

Le serveur refuse qu'un joueur s'affronte lui-même. Ouvre `/duel` dans ta
fenêtre normale, puis une fenêtre de navigation privée avec un second compte, et
lance la recherche des deux côtés.

## Ce qui a été vérifié

`node scripts/duel-play.mjs` monte le serveur complet, inscrit deux comptes par
HTTP, ouvre deux sockets avec leurs cookies de session, et joue un match entier.
Trois exécutions : 0-2 au temps, 2-1 au temps, 3-0 aux buts à la 80e minute.

Le test vérifie aussi qu'une socket sans compte est refusée à l'entrée en file,
que les deux joueurs voient la même issue, et que les pseudos réels arrivent
bien jusqu'au plateau.

Deux défauts ont été trouvés et corrigés à cette occasion. Le serveur coupait la
connexion d'un visiteur non connecté si vite que le message expliquant pourquoi
n'arrivait jamais : il voyait une déconnexion sans raison. Et le point d'entrée
du paquet serveur n'exposait pas tout ce dont `server.js` avait besoin.

## Choix à connaître

**Le deck est identique pour tous.** Vingt cartes fixes, resserrées sur trois
ambiances — un deck qui pioche six ambiances différentes ne réunit jamais le
souffle nécessaire à un chant. Ça deviendra le deck construit depuis la
collection quand l'ouverture de boosters existera.

**Les illustrations sont générées, pas dessinées.** Chaque carte produit
toujours la même image à partir de son identifiant : fumigènes, bâches, cars,
mosaïques, tambours. Aucune ressource à télécharger, aucun crédit Artlist
consommé, un rendu net à toutes les tailles. Les visuels définitifs les
remplaceront carte par carte sans rien changer au reste.

**Les noms de groupes ne sont pas traduits.** Ce sont des noms propres, comme
les noms de clubs. Un joueur allemand lit « Brigade Nord 1987 » comme un
français. Seule l'interface autour change de langue.

## Reste à faire

1. Un adversaire d'entraînement, pour jouer sans attendre quelqu'un.
2. Le classement et l'historique : la table `duel_results` existe, rien ne la
   remplit encore en fin de match.
3. L'ouverture de boosters et la collection, qui donneront de vrais decks.
4. Les animations de chant : aujourd'hui l'action est lisible mais sèche.
