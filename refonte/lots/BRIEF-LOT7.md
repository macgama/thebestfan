# Lot 7 de la refonte FAIT MAIN — les images et le terrain

*Écrit le 5 octobre 2026, après la mise en ligne du lot 6 (`sql/arenes.sql`
appliqué et serveur redémarré par Gaël le 5 octobre). Même plan et mêmes règles
que `BRIEF-LOT6.md` : ce qui n'est pas redit ici s'y lit.*

Dépôt : **`C:\Users\gaelm\Documents\GitHub\thebestfan`** (la copie principale ;
jamais une copie sous `.claude/worktrees/`). **Toujours des chemins absolus.**
Bac à sable du lot : `…\scratchpad\lot7\` (ci-dessous `lot7/`).

Lis d'abord `refonte/README.md`, `refonte/lots/IMAGES-LOTS-6-7.md` (§ 1 à 4 et
« Les chaînes à écrire »), `art/A-GENERER-ARTLIST.md`, `VISUELS.md`, la section
du lot 6 d'`HISTORIQUE.md`, et dans `public/ui.css` les pièces du lot 6
(`.tbf-corde`, `.tbf-foulard`, `.tbf-foule`, `.tbf-chemin`, `.tbf-ages`). Les
arbitrages du 2 octobre 2026 restent des règles (faces vives foncées, kraft
`#E4D3B5` à l'encre noire pure, l'or seulement en grand texte ou en face).

## Ce qui est déjà fait, hors atelier

Sur la branche `claude/project-thread-jyhm3m` (une session cloud, 5 octobre) :

- **Les vieux buts, à la cause** : le relevé (`src/server/football/poller.js`,
  `enAttente`, `RELANCES_MAX`) redemande les événements à chaque tour du
  direct tant que la liste compte moins de buts que le tableau, au plus neuf
  tours. Le but que l'API publie après le score part au tour qui le trouve,
  et non plus au changement de score suivant ou à la minute. Contrôlé par
  `releve:test` (six contrôles neufs, rouges sans le correctif).
- **La priorité au GOAL** était déjà faite au lot 6 (`apresLaFenetre(f, { but:
  true })` dans `virage.html`, contrôlée par `virage:ui`), et `server.js` lit
  déjà le retour de `realGoal` : un but que la salle tait ne frappe plus de
  carte et ne compte plus au duel.
- **Le tunnel au voile du Virage** : `public/img/ecran/tunnel-portrait` et
  `tunnel-paysage` (déjà servis pour l'accueil) remplacent la photo de
  tribune derrière le voile de choix.

## Ce que fait le lot 7

1. **Le foulard noué.** Une famille `arene` dans `scripts/stuff-images.mjs`
   (`art/arene/` → `public/img/arene/`), détourage du fond vert `#00B140` par
   `detourage.mjs`, 256 × 256 en AVIF, WebP et PNG transparent. Le choisir
   parmi `art/arene/_src/foulard-noeud-1.png` et `-2.png`, le brancher dans
   `.tbf-foulard` (`#knot`) au Virage et au duel, teinté au camp qui mène par
   le dégradé posé en `mask-image` (voir `IMAGES-LOTS-6-7.md`, § 2). Le disque
   du lot 6 reste en repli si l'image manque.
2. **La corde tressée.** Une tuile SVG raccordable (de l'ordre de 14 × 28,
   trois brins d'encre sur le kraft), **dessinée à la main** en décalquant
   `art/arene/_src/corde-reference-1.png`, écrite en data-URI dans une
   variable de `ui.css`, et posée partout où le lot 6 peint la corde en CSS
   « tant que `corde.svg` n'est pas produite » : la corde du Virage, celle du
   duel, `.tbf-chemin`, `.tbf-ages`. En `mask-image` là où elle prend une
   couleur. Aucune couture visible sur 400 px.
3. **Les six silhouettes au pochoir**, redessinées en SVG d'après
   `art/arene/_src/silhouettes-1.png` et `-2.png` (bras levés, écharpe tendue,
   tambour, mégaphone, mains au-dessus de la tête, tirant sur une corde),
   lisibles à 10 px, pour remplacer les dessins provisoires du lot 6 dans les
   foules du Virage, les affiches du voile, les formats et les tribunes du
   duel, les sièges du vestiaire. Aucun visage, aucun signe sur ce qu'elles
   tiennent.
4. **Le Fanzzy vivant, essai sur RP1** : animer dans le jeu les images qui
   existent déjà (respiration, saut au but, effort sur la corde), en CSS et
   `fanzzy-scene.js`, **sans vidéo générée** (l'essai du 3 octobre a montré
   que les modèles vidéo ne gardent pas le personnage). Un essai seul, montré
   à Gaël en captures et en enregistrement avant toute généralisation.
5. **Les sons**, seulement après le choix de Gaël dans
   `art/son/_src/artlist/A-ECOUTER.md` : les sons gardés passent par la chaîne
   de `son.js` existante ; sans réponse, on ne branche rien.

Le supporter d'en face (§ 5 d'`IMAGES-LOTS-6-7.md`) reste facultatif et hors
de ce lot tant que Gaël ne l'a pas demandé.

## Ce que ça suppose

- Les sources sont dans `art/arene/_src/` et `art/son/_src/artlist/`, **hors de
  git** : le lot se fait sur le poste de Gaël, ou après les y avoir déposées.
  Si un fichier manque, s'arrêter et le dire ; ne pas régénérer sur Artlist
  sans accord (130 crédits l'image).
- `main` porte le lot 6 et la branche ci-dessus fusionnée. Une base de test
  par atelier (`test_lot7`), jamais `tbf`.

## Les périmètres

| clé | fichiers |
|---|---|
| `mesure` | `scripts/audit-ui.mjs`, `scripts/verif-pages.mjs` |
| `images` | `scripts/stuff-images.mjs`, `scripts/detourage.mjs`, `public/img/arene/` (neuf) |
| `feuilles-css` | `public/ui.css` (corde, silhouettes, foulard) |
| `fx` | `public/fanzzy-scene.js`, `public/fx.js`, `public/son.js`, `scripts/son-smoke.mjs` |
| `grand-virage` | `public/virage.html`, `scripts/virage-ui-smoke.mjs` |
| `duel-tribunes` | `public/duel-nvn.html`, `scripts/nvn-ui-smoke.mjs` |
| `paquet` | `package.json` |
| `trace` | `HISTORIQUE.md`, `ETAT.md`, `A-DEPLOYER.md`, `refonte/README.md`, `art/A-GENERER-ARTLIST.md` |

Aucun périmètre serveur : le lot ne change ni contrat, ni schéma, ni réglage.

## Ordre de travail

1. **`mesure`, seul** : l'état de départ (`audit-ui.mjs --jour --etats`) et les
   captures des arènes au banc du lot 6, à 360 × 640, 320 × 568, 412 × 915 et
   768 × 1024.
2. **`images`**, puis **`feuilles-css`** au banc (foulard, corde, silhouettes
   posés sur une page de démonstration avant les écrans).
3. **En parallèle** : `grand-virage` et `duel-tribunes` contre les pièces ;
   `fx` sur l'essai du Fanzzy vivant.
4. Vérification (toutes les suites une fois, puis ciblées), corrections par
   clé, deux relecteurs au plus, trace. Économiser les tokens comme demandé
   le 4 octobre : modèle léger pour le mécanique, consignes courtes.

## Ce qui ne doit pas bouger

Tout ce que `BRIEF-LOT6.md` liste sous ce titre, et en particulier : au plus
trois animations par écran, toutes comptées, avec leurs doubles
`prefers-reduced-motion` et `data-calme` (la respiration du Fanzzy vivant en
est une) ; les nœuds stables et les identifiants lus par les suites (`#knot`,
`#rope`, `#crowdMe`, `#crowdFoe`…) ; aucune page ne nomme une image qui
n'existe pas en ses trois formats ; **aucune image avec texte, lettre, chiffre,
logo, écusson, maillot identifiable ou personne réelle**. Rien en ligne
pendant l'atelier.

## Comment on travaille ici

Comme au lot 6 (« Comment on travaille ici ») : chacun ses fichiers, les
besoins par clé, le verrou `.tbf-suite.lock` jamais forcé, rien de commité par
un agent, commentaires en français qui disent pourquoi, fins de ligne LF.
