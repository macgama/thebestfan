# thebestfan — mise en ligne du prototype

Tout ce qui a été construit, assemblé en une application déployable. Compte une
heure la première fois, dont l'essentiel en attente de build.

## Ce qu'il y a dedans

| Adresse | Ce que c'est | État |
|---|---|---|
| `/` | accueil : accès à tout, et le match du jour mis en avant | branché |
| `/teletext` | tous les championnats : classement, résultats, buteurs, passeurs, cartons | branché |
| `/compte` | inscription, connexion, mot de passe oublié, 4 langues | branché |
| `/bienvenue` | cérémonie d'arrivée : club, paquet de bienvenue | branché |
| `/equipes` | clubs suivis, calendrier, résultats, buts en direct | branché |
| `/fanzzy` | boosters, classeur, évolutions, Fanzzy équipé | branché |
| `/duel` | duel temps réel, avec adversaire d'entraînement | branché |
| `/virage` | Grand Virage : tir à la corde collectif pendant un vrai match | branché |
| `/carnet` | souvenirs vécus et vignettes à récupérer | branché |
| `/diagnostic` | état du serveur et du WebSocket | branché |

Les cartes-souvenirs se frappent toutes seules à chaque but réel, s'annoncent
dans le Grand Virage au moment où tu les gagnes, et se retrouvent dans le
carnet — celles que tu as vécues d'un côté, celles que tu peux récupérer en
écharpes de l'autre, pendant quinze jours.

**Ce qui n'est pas dedans.** Le duel un contre un est encore le moteur tour par
tour ; le tir à la corde n'existe en ligne que dans le Grand Virage. Les
prototypes Ferveur v1 à v3 restent dans `labo/`, à ouvrir depuis ton disque :
ils servent à essayer des règles, pas à jouer en ligne.

## Étape 1 — Poser les fichiers

Décompresse l'archive et pousse tout sur GitHub, en gardant l'arborescence.
Les fichiers existants à remplacer : `server.js`, `package.json`, `build.mjs`.

Ajoute au `.gitignore` :

```
node_modules/
dist/
public/duel.bundle.js
.env*
```

## Étape 2 — Le schéma

Les cinq fichiers, **dans cet ordre** : chacun s'appuie sur les tables du
précédent.

```bash
cd ~/sites/thebestfan.online
for f in auth football duel souvenirs fanzzy teletext inventaire; do
  mysql -h o42s1v.myd.infomaniak.com -u o42s1v_tbf -p o42s1v_thebestfan < sql/$f.sql
done
```

Contrôle : `SHOW TABLES;` doit en lister 24.

`teletext.sql` ajoute aussi des colonnes à `souvenir_leagues` : la couverture
fine des buteurs, passeurs et cartons, et le palier de notoriété. Relance
`scripts/coverage.mjs` après cette étape pour les remplir — sans cela, aucune
compétition n'affichera de buteurs.

Si `souvenir_leagues` est déjà remplie par ton inventaire, `football.sql` et
`souvenirs.sql` ne l'écraseront pas — ils utilisent tous `CREATE TABLE IF NOT
EXISTS`.

## Étape 3 — Le fichier `.env`

```bash
nano .env
```

```
DATABASE_URL=mysql://o42s1v_tbf:MOTDEPASSE@o42s1v.myd.infomaniak.com:3306/o42s1v_thebestfan
PUBLIC_ORIGIN=https://thebestfan.online
SESSION_SECRET=<openssl rand -hex 32>
API_FOOTBALL_KEY=<ta clé>
API_FOOTBALL_BUDGET=6800
DUEL_BOT_AFTER_MS=20000
```

`SMTP_URL` reste optionnel : sans lui, les mails de vérification s'affichent
dans la console d'exécution du Manager, ce qui suffit pour tester.

## Étape 4 — Le Manager

Onglet Node.js du site :

| Champ | Valeur |
|---|---|
| Version de Node.js | 22 |
| Dossier d'exécution | `./` |
| Commande de build | `git pull && npm install && node build.mjs` |
| Commande de lancement | `npm start` |
| Port | celui affiché par le Manager |

Le `--omit=dev` doit avoir disparu : esbuild est une dépendance de
développement et la construction échoue sans lui.

Lance la construction, puis redémarre.

## Étape 5 — Vérifier

```bash
curl -s https://thebestfan.online/healthz
```

Tu dois lire `"db":"connectée"`, `"auth":"active"`, `"football":"actif"`,
`"souvenirs":"actives"`, `"fanzzy":"active"` et un objet `duel`. Si l'un dit
« désactivé », la console d'exécution te dira pourquoi — chaque module écrit sa
raison au démarrage.

Puis dans le navigateur, dans cet ordre :

1. `/compte` — crée un compte. Le lien de vérification s'affiche dans la console du Manager.
2. `/fanzzy` — ouvre un booster. Le tirage vient du serveur, pas du navigateur.
3. `/equipes` — suis ton club. Le calendrier se charge en une minute.
4. `/duel` — cherche un duel. Sans personne en face, un entraînement démarre au bout de vingt secondes.
5. `/virage` — pendant un match de ton club, entre dans le virage et chante. Un but réel secoue la corde et te frappe une carte-souvenir.
6. `/carnet` — la carte doit y être, tamponnée « tu y étais ».

## Étape 6 — L'inventaire des compétitions

Une seule fois, et à chaque intersaison :

```bash
node --env-file=.env scripts/coverage.mjs
```

Sans cette table, aucune carte-souvenir n'est frappée. C'est volontaire : mieux
vaut ne rien frapper que de frapper des cartes sans buteur.

## Mesures du Grand Virage

Serveur et clients dans le même process, donc c'est le moteur qui est mesuré,
pas le réseau :

| supporters | chants/s | chant → corde vue | mémoire |
|---|---|---|---|
| 150 | 24 | p50 55 ms · p95 96 ms | +1 Mo |
| 600 | 93 | p50 54 ms · p95 90 ms | +8 Mo |

La latence ne bouge pas avec la foule, et c'est voulu : le serveur agrège et
diffuse **une** position dix fois par seconde pour toute la salle. Les 50 ms de
médiane sont l'attente moyenne du prochain battement d'horloge, pas un coût de
calcul. Ce qui grandit avec le nombre, c'est le trafic sortant, pas le travail.

À refaire sur l'URL de production avant d'ouvrir :

```bash
node scripts/virage-loadtest.mjs 300 https://thebestfan.online
```

## Les tests

Chacun monte un vrai serveur sur une vraie base. À lancer depuis le dossier du
site, avec `DATABASE_URL` pointant sur une base **de test**, jamais la
production — ils effacent les tables au démarrage.

```bash
node scripts/auth-smoke.mjs        # 50 vérifications
node scripts/football-smoke.mjs    # 39
node scripts/souvenirs-smoke.mjs   # 27
node scripts/fanzzy-smoke.mjs      # 27
node scripts/duel-play.mjs         # deux comptes jouent un match entier
node scripts/duel-bot.mjs          # un joueur seul contre l'entraînement
node scripts/virage-smoke.mjs      # 28, dont la frappe des souvenirs
node scripts/teletext-smoke.mjs   # 20, dont le cache et la panne d'API
node scripts/onboarding-smoke.mjs # 28, dont les emplacements et l'équipement
node scripts/duel-loadtest.mjs 50 https://thebestfan.online
```

## Ce qui reste à faire avant d'ouvrir au public

1. **Le SMTP.** Sans lui, personne ne peut vérifier son adresse ni récupérer un
   mot de passe oublié.
2. **Le test de charge sur l'URL de production**, pour savoir si l'hébergement
   Web suffit ou s'il faut un Serveur Cloud. Le Grand Virage a le sien :
   `node scripts/virage-loadtest.mjs 300 https://thebestfan.online`.
3. **La question juridique** avant toute vente d'écharpes : de l'argent réel qui
   donne accès à du contenu aléatoire relève de règles strictes en Belgique et
   aux Pays-Bas, et la loi suisse mérite un avis d'avocat.

## L'équilibre du jeu, en deux règles

Elles ne sont pas négociables une fois des joueurs en ligne, et le code les
applique :

**Un skin ne donne aucun bonus.** Il change l'apparence, rien d'autre. Celui qui
ouvre mille paquets est plus beau, pas plus fort. C'est ce qui se collectionne
le plus volontiers dans ce genre de jeu, et ça ne déséquilibre rien.

**Chaque pièce d'équipement a un revers, et on n'en porte que deux.** Les
jumelles élargissent la fenêtre du tempo mais ralentissent la cadence ; le
thermos accélère le souffle mais renchérit les grosses cartes. Un joueur équipé
n'est pas plus fort, il joue autrement. Un débutant qui chante juste bat un
vétéran mal équipé — sans ça, le jeu devient une caisse enregistreuse.

Le paquet de bienvenue est **garanti** : deux Fanzzy dont un peu commun au
minimum, une pièce d'équipement, une carte d'action et des écharpes. Un joueur
qui tombe sur cinq communes à sa première ouverture ne revient pas.

## Le télétexte et le quota

C'est le point sensible : 953 compétitions consultables, sept mille cinq cents
appels par jour. Tout repose sur un cache en base. Le premier joueur qui ouvre
la Ligue 1 paie un appel, les mille suivants ne paient rien.

Les durées de vie suivent le rythme réel : six heures pour un classement, douze
pour les buteurs, une heure pour un calendrier, une minute quand un match de
cette compétition est en cours. Une compétition dont la couverture n'inclut pas
les buteurs n'est jamais interrogée — la page le dit et n'appelle rien.

Et quand le budget est atteint ou que l'API ne répond pas, on sert la version
périmée en la signalant, plutôt qu'une page vide.

La saison affichée n'est pas celle que l'API marque « courante » : ce drapeau
traîne parfois d'une saison sur l'autre. On compare la date du jour aux dates de
début et de fin, et hors saison on garde la dernière connue — c'est ce qu'un
supporter veut voir en juillet.

Surveiller la consommation : `GET /api/tt/cache`.

## Le Grand Virage en deux mots

Une salle par match réel, une seule horloge à dix battements par seconde pour
toutes les salles. Les supporters envoient les **instants de leurs frappes**,
jamais leur réussite : c'est le serveur qui note le geste, ce qui ferme la porte
au client modifié. Il rejette les frappes espacées de moins de 40 ms et celles
d'une régularité mécanique.

La poussée d'une tribune est divisée par son effectif, et le nombre ne compte
qu'en logarithme : une tribune deux fois plus nombreuse pousse 18 % plus fort,
pas deux fois. Sans cela, le club le plus populaire gagnerait toujours et
personne ne jouerait les petits.

Le camp n'est pas choisi : il découle des clubs suivis. Un joueur qui ne suit
aucune des deux équipes ne peut pas entrer.

## Si quelque chose ne démarre pas

La console d'exécution du Manager dit toujours pourquoi. Les messages sont
explicites : `base injoignable`, `API_FOOTBALL_KEY absent`, `SESSION_SECRET
absent`. Le serveur démarre malgré tout et désactive proprement le module
concerné, plutôt que de tomber — tu peux donc corriger un point à la fois.
