# La refonte FAIT MAIN — où on en est, et comment reprendre

*Écrit le 5 octobre 2026, pour qu'une nouvelle conversation reprenne le travail
sans rien perdre. Les ateliers écrivaient leurs documents dans un dossier
temporaire de la session ; ce qui doit durer est ici.*

## L'essentiel en dix lignes

- **La direction choisie** (30 septembre 2026) : **FAIT MAIN** — bâche,
  parpaing, sticker, tampon, ticket, craie, encre, kraft ; l'écharpe est la seule
  jauge du jeu. Repli prévu si des joueurs la trouvent « trop punk » : NUIT DE
  MATCH. Les trois directions et la maquette sont dans `direction/`.
- **Les arbitrages du 2 octobre 2026 sont des règles** : faces vives foncées
  (flare `#B8321F`, vert `#197450`, bleu `#2F63B4`, violet `#6545AE`) ; kraft
  `#E4D3B5` à l'encre noire pure ; l'or seulement en grand texte ou en face.
- **En ligne** : les lots 0 à 6 (le lot 6, les arènes, depuis le 5 octobre
  2026 : `sql/arenes.sql` appliqué et serveur redémarré par Gaël), le chantier
  serveur (vagues 1 et 2), le son de tribune et les correctifs du Virage.
- **Dans `main`, pas encore en ligne** (fusionné le 5 octobre 2026, PR #2 et
  #3) : le relevé qui redemande les événements tant que sa liste compte moins
  de buts que le tableau (les vieux buts, à la cause), la photo du tunnel
  derrière le voile du Virage, les points 1 à 3 du lot 7 (le foulard noué, la
  corde tressée, les six silhouettes), la corde qui résiste davantage contre
  une tribune vide (« PERSONNE EN FACE »), et le monde qui joue enfin visible
  sur l'accueil et dans le tiroir. Sans schéma ; un redémarrage hors d'un
  match (`A-DEPLOYER.md`). Et le Fanzzy vivant (point 4 du lot 7) : il
  raconte le dernier match, répond quand on insiste, fête le retour du
  joueur ; une page seulement. Puis le duel vivant : les deux Fanzzy en
  tribune dans l'arène du duel, qui vivent poussées, buts et coups ; une page
  seulement, avec le but du vrai match qui y faisait lever la page, réparé.
- **Dans `main` le 6 octobre 2026** : Gosier Rouillé (RP1) cligne des yeux
  à l'accueil, au repos (filmé pour Gaël, `lot7/cligne/rp1-cligne.mp4` dans
  les fichiers du projet), et au Virage, les moments tombés pendant un même
  geste se montrent l'un après l'autre, le jeu d'abord et le but réel en
  dernier. Des pages seulement.
- **À venir** : les sons, au choix de Gaël, et le clignement des autres
  Fanzzy, une retouche Artlist de leur tête chacun (`npm run cligne`).

## Où sont les choses

| Dossier ou fichier | Ce qu'on y trouve |
|---|---|
| `direction/` | les trois directions maquettées (`direction-ultras-diy.json` est FAIT MAIN : lire `amendements` d'abord), la maquette `dir-ultras-diy.html`, et la synthèse qui a mené au choix |
| `lots/BRIEF-REFONTE.md` | le brief de départ de toute la refonte |
| `lots/BRIEF-LOT4.md`, `lots/BRIEF-LOT6.md` | les deux briefs précédents : le modèle de celui du lot 7 (même plan, mêmes règles) |
| `lots/BRIEF-LOT7.md` | le brief du lot 7 : foulard, corde, silhouettes, Fanzzy vivant, sons |
| `lots/LOT6-DECISIONS.md`, `lots/LOT6-QUESTIONS.md` | les décisions de Gaël du 3 octobre (XP du Virage, présence, verdict, ferveur) et les recommandations suivies pour les autres |
| `lots/IMAGES-LOTS-6-7.md` | ce qui reste à dessiner, où chaque image sert, à quel format, par quelle chaîne |
| `lots/VIRAGE-RETOURS-GAEL.md` | le correctif des quatre retours de Gaël au Virage, et ce qui reste à trancher |
| `../serveur/` | le chantier serveur : contenu, contrats d'API (`CONTRATS.md`), écarts, risques, économie |
| `../art/A-GENERER-ARTLIST.md` | les invites des images, l'outil et ses réglages |
| `../art/**/_src/` | les sources lourdes, **hors de git** : images 2K, sons Artlist (`art/son/_src/artlist/`, avec `A-ECOUTER.md`), page d'écoute du mixage du lot 6 (`art/son/_src/ecoute-lot6/`) |
| `../ETAT.md`, `../HISTORIQUE.md`, `../A-DEPLOYER.md` | l'état du projet, le pourquoi de chaque choix, la livraison en attente |

## Le lot 7, et ce qui reste ouvert

1. **Les images déjà générées** : fait, dans `main`. Le foulard noué
   (`public/img/arene/foulard-noeud`, famille `arene` de
   `scripts/stuff-images.mjs`), la corde tressée et les six silhouettes au
   pochoir en SVG dans `public/ui.css`, le tunnel au voile du Virage. Les
   sources restent dans `art/arene/_src/`, hors de git, et dans l'historique
   Artlist de Gaël (4 octobre, 830 crédits).
2. **Le Fanzzy vivant** : animer dans le jeu les images existantes, **pas** de
   vidéo générée — l'essai du 3 octobre a montré que les modèles vidéo ne
   gardent pas le personnage. La respiration et le saut existent déjà ; ce qui
   manque, c'est un caractère. **Fait**, avec les expressions déjà
   dessinées, et filmé sur RP1 pour Gaël le 5 octobre (`HISTORIQUE.md`,
   4 quadragies octies) : il raconte le dernier match de son club, il répond
   autrement quand on insiste à le toucher, il fête le retour du joueur. **Il
   cligne des yeux** depuis le 6 octobre, RP1 seulement et à l'accueil
   (4 quinquagies) : une retouche Artlist de sa tête, dont on ne garde que
   les paupières ; les autres Fanzzy attendent la leur (`npm run cligne --
   tete <ID>` dit quoi demander). **Au duel aussi**, filmé pour Gaël le même
   jour (`HISTORIQUE.md`, 4 quadragies novies) : les deux Fanzzy en tribune
   se tiennent dans l'arène et vivent poussées, buts et coups d'en face.
3. **Les sons Artlist** (la rumeur, le but, les tambours) : Gaël doit les
   écouter et dire lesquels on garde (`art/son/_src/artlist/A-ECOUTER.md`).
4. **Les vieux buts** : fait, dans `main`. Le relevé redemande les
   événements à chaque tour tant que sa liste compte moins de buts que le
   tableau (au plus neuf tours) ; la priorité au GOAL et la lecture du retour
   de `realGoal` par `server.js` étaient déjà au lot 6.
5. **Décisions en attente de Gaël** : la date de fin de la saison 1 et les
   seuils de division (`/admin`) ; la présence des amis (après relecture de
   `CONFIDENTIALITE.md` par un juriste) ; celles de `ETAT.md` § 7 bis
   (inflation des écharpes, saison 2…). Le stade du duel est tranché le
   6 octobre : celui du match, le même que son Grand Virage, et la
   préparation le montre avant l'entrée en file (`HISTORIQUE.md`,
   4 quinquagies).
6. **Rouges connues** : `deck:ui` (un contrôle, depuis avant le lot 0 ; un
   correctif dort dans la copie `.claude/worktrees/funny-herschel-18c485`
   d'une autre session) ; `accueil:ui` intermittente. **Dans un conteneur
   cloud**, relevé sur `main` le 5 octobre 2026 : `equipes:ui` (le plafond de
   clubs suivis : « la page dit pourquoi, avec le compte » et deux autres),
   `nvn:ui` « elle dit le Fanzzy, le camp et la sorte de partie », `virage:ui`
   « un pays dans la langue du lecteur » et les trois contrôles d'invitation. Deux réglages du conteneur, à faire avant
   les suites, en effacent d'autres : faire confiance aux deux CA de
   `/root/.ccr/agent-proxy-ca.crt` dans le magasin NSS du navigateur
   (`certutil`, paquet `libnss3-tools`), sans quoi Chrome ne charge pas les
   polices Google et `accueil:ui`, `cartes:ui` et `tour:ui` rougissent sur des
   mesures de texte ; mettre la base de test à l'heure de Zurich, comme la
   sonde du jour de jeu l'attend (`mysql_tzinfo_to_sql /usr/share/zoneinfo |
   mysql -uroot mysql`, puis `SET GLOBAL time_zone = 'Europe/Zurich'`), sans
   quoi `quotidien:smoke`, `recompenses:smoke` et `admin:smoke` rougissent sur
   les jours de 23 et de 25 heures. Et `images:test` lit `TEMP`, une variable
   de Windows : ailleurs, lancer `TEMP=<un dossier> npm test`, sans quoi elle
   s'arrête avant son premier contrôle.

## Comment on travaille

- **Les images** : Claude les génère (Artlist, Nano Banana 2), **sauf les
  Fanzzy**, que Gaël produit lui-même. Les invites restent dans
  `art/A-GENERER-ARTLIST.md`.
- **Un lot = un atelier** d'agents sur des périmètres de fichiers disjoints,
  aiguillés par des **clés fermées** ; une vérification (toutes les suites,
  l'audit `scripts/audit-ui.mjs --jour --etats`), des corrections, une
  relecture, une trace.
- **Économiser les tokens** (demandé par Gaël le 4 octobre 2026) : un modèle
  plus léger pour les étapes mécaniques, une seule vérification complète puis
  des vérifications ciblées, deux relecteurs au plus, des consignes courtes.
- **Deux ateliers en même temps** : chacun dans sa copie (`git worktree`) avec
  **sa propre base de test** — le serveur local accepte les bases `test_…`
  (`CREATE DATABASE test_<nom>`) ; `DATABASE_URL=…/test_<nom>` devant chaque
  suite, ou le fichier `.tbf-base-de-test` à la racine de la copie.
- **Ne rien mettre en ligne pendant un atelier** : un commit pris en cours de
  route emporte du travail que personne n'a vérifié. Après une mise en ligne,
  relever `/healthz` et les empreintes des fichiers servis.
- **Droit dans `main`, après les suites** (demandé par Gaël le 5 octobre
  2026) : une session travaille sur sa branche, passe toutes les suites, et
  fusionne elle-même dans `main` quand aucune n'ajoute d'échec, sans laisser
  de PR en attente de Gaël. `main` ne porte ainsi jamais un travail à moitié
  fait, et Gaël peut déployer quand il veut. On lui demande encore avant un
  schéma à appliquer ou un choix qui lui revient ; la mise en ligne reste à
  lui, et chaque livraison s'écrit en tête d'`A-DEPLOYER.md`.

## Le ménage à faire maintenant que le lot 6 est en ligne

Les copies de travail `.claude/worktrees/lot6`, `hotfix-virage` et
`wf_fce88c4c-ecf-4` (leur travail est versé dans la copie principale) et les
bases `test_lot6`, `test_hotfix` et `test_correctif` peuvent être supprimées.
