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
- **En ligne** : les lots 0, 1, 2, 3, 4 et 5, le chantier serveur (vague 1 :
  le quotidien), le son de tribune, le correctif serveur du Virage et le
  correctif des quatre retours de Gaël (commit `524b2ca`, 5 octobre 2026).
- **Prêt, pas encore en ligne** : **le lot 6, les arènes**, fusionné dans la
  copie principale et vérifié. La marche à suivre est dans `../A-DEPLOYER.md`
  (le schéma `sql/arenes.sql` d'abord, puis un redémarrage hors d'un match).
- **À venir** : le lot 7 (images et terrain), puis le Fanzzy vivant.

## Où sont les choses

| Dossier ou fichier | Ce qu'on y trouve |
|---|---|
| `direction/` | les trois directions maquettées (`direction-ultras-diy.json` est FAIT MAIN : lire `amendements` d'abord), la maquette `dir-ultras-diy.html`, et la synthèse qui a mené au choix |
| `lots/BRIEF-REFONTE.md` | le brief de départ de toute la refonte |
| `lots/BRIEF-LOT4.md`, `lots/BRIEF-LOT6.md` | les deux derniers briefs de lot : le modèle pour écrire celui du lot 7 (même plan, mêmes règles) |
| `lots/LOT6-DECISIONS.md`, `lots/LOT6-QUESTIONS.md` | les décisions de Gaël du 3 octobre (XP du Virage, présence, verdict, ferveur) et les recommandations suivies pour les autres |
| `lots/IMAGES-LOTS-6-7.md` | ce qui reste à dessiner, où chaque image sert, à quel format, par quelle chaîne |
| `lots/VIRAGE-RETOURS-GAEL.md` | le correctif des quatre retours de Gaël au Virage, et ce qui reste à trancher |
| `../serveur/` | le chantier serveur : contenu, contrats d'API (`CONTRATS.md`), écarts, risques, économie |
| `../art/A-GENERER-ARTLIST.md` | les invites des images, l'outil et ses réglages |
| `../art/**/_src/` | les sources lourdes, **hors de git** : images 2K, sons Artlist (`art/son/_src/artlist/`, avec `A-ECOUTER.md`), page d'écoute du mixage du lot 6 (`art/son/_src/ecoute-lot6/`) |
| `../ETAT.md`, `../HISTORIQUE.md`, `../A-DEPLOYER.md` | l'état du projet, le pourquoi de chaque choix, la livraison en attente |

## Le lot 7, et ce qui reste ouvert

1. **Brancher les images déjà générées** (sources dans `art/arene/_src/`) : le
   foulard noué sur la corde (détouré du fond vert), la corde et les six
   silhouettes au pochoir redessinées en SVG pour remplacer les dessins
   provisoires ; la photo du tunnel au voile du Virage.
2. **Le Fanzzy vivant** : animer dans le jeu les images existantes (respiration,
   saut au but, effort sur la corde), **pas** de vidéo générée — l'essai du
   3 octobre a montré que les modèles vidéo ne gardent pas le personnage. Un
   essai sur RP1 d'abord, montré à Gaël.
3. **Les sons Artlist** (la rumeur, le but, les tambours) : Gaël doit les
   écouter et dire lesquels on garde (`art/son/_src/artlist/A-ECOUTER.md`).
4. **Les vieux buts** : la salle ne les annonce plus, mais un but ancien frappe
   encore une carte-souvenir et compte au duel. Corriger la cause : le relevé
   redemande les évènements tant que sa liste compte moins de buts que le
   tableau. Et donner la priorité au GOAL quand plusieurs moments attendent la
   fin d'un geste.
5. **Décisions en attente de Gaël** : le stade du duel ; la date de fin de la
   saison 1 et les seuils de division (`/admin`) ; la présence des amis (après
   relecture de `CONFIDENTIALITE.md` par un juriste) ; celles de `ETAT.md`
   § 7 bis (inflation des écharpes, saison 2…).
6. **Rouges connues** : `deck:ui` (un contrôle, depuis avant le lot 0 ; un
   correctif dort dans la copie `.claude/worktrees/funny-herschel-18c485`
   d'une autre session) ; `accueil:ui` intermittente.

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

## Le ménage à faire après la mise en ligne du lot 6

Les copies de travail `.claude/worktrees/lot6`, `hotfix-virage` et
`wf_fce88c4c-ecf-4` (leur travail est versé dans la copie principale) et les
bases `test_lot6`, `test_hotfix` et `test_correctif` peuvent être supprimées.
