# Lot 6 de la refonte FAIT MAIN — les arènes

Dépôt : **`C:\Users\gaelm\Documents\GitHub\thebestfan`** (la copie principale ;
jamais une copie sous `.claude/worktrees/`). **Toujours des chemins absolus.**
Bac à sable du lot : `…\scratchpad\lot6\` (ci-dessous `lot6/`).

Lis d'abord `ETAT.md` § 2, § 3 (« Il n'y a qu'un seul jeu », « La portée d'un
effet décide où sa carte se joue », « Une poussée du Virage est toujours
divisée par l'effectif », « Le geste est noté par le serveur », « Le barème du
geste vient du serveur ») et § 6 (« Dans une arène, pas d'`innerHTML` sur un
conteneur rendu à chaque vue », « `#app` est un contexte d'empilement », « Sur
un écran de jeu, la barre ne réserve que 55 % », « Relever un plancher de
taille », « Un mot éteint par une police de zéro pixel », « Éteindre par un
filtre », « Chaque bloc `prefers-reduced-motion` a son double », « Une
animation gelée ne finit jamais », « `clearTimeout` laisse un identifiant
vrai »), les sections des lots 0 à 5 et du lot 4 d'`HISTORIQUE.md`,
`public/ui.css` (la matière, et les briques des lots 1 à 5 **et 4**),
`serveur/CONTRATS.md` (§ 0, § 1, § 4.1, § 9, § 11, puis § 15 à § 18 que la
vague 2 y verse), `lot6/SERVEUR-VAGUE2.md` et `lot6/QUESTIONS.md` (avec les
réponses de Gaël). Les arbitrages du 2 octobre 2026 sont des règles : faces
vives foncées (flare `#B8321F`, vert `#197450`, bleu `#2F63B4`, violet
`#6545AE`), kraft `#E4D3B5` à l'encre noire pure, l'or seulement en grand texte
ou en face — un petit texte or passe à la craie. Une seule série (LA REPRISE)
est ouverte en production, et c'est voulu.

Références dans `lot6/` (à copier depuis le bac à sable au départ) :
`direction-ultras-diy.json` — lis `amendements` d'abord (10, 11, 14, 15, 16
surtout), puis `ecrans` pour `/virage` et `/duel-nvn`, `composants` (Barre du
haut, Carte d'action et carte de chant, Moment fort, Pavé de geste), et
`ux_gaming` (« HUD en match », « Feedback du geste », « Rituel de sortie ») ;
la maquette `dir-ultras-diy.html`, écrans **7** (le Virage en minute double) et
**8** (le geste), et la planche **10** (le pavé se touche). Pour comparaison,
`direction-tcg-premium.json` et `direction-nuit-de-match.json` (écrans
`/virage`, `/duel-nvn`) : FAIT MAIN en a déjà pris la double barre miroir
TOI/LUI, les lignes de bilan qui comptent l'une après l'autre à 700 ms et la
contrainte des nœuds stables (`#knot`, `#score`, `#crowdMe`, `#crowdFoe`,
`#rank`, `#hand`, `#actes`) ; on ne prend pas leur HUD sur deux rangées. Le
banc des arènes du lot 0 (`scratchpad/arenes/banc.mjs` et `outils.js`) sert
`public/` tel quel, bouche les `/api` et remplace socket.io par une fausse
socket pilotable (`window.__sock.fire(évènement, données)`) : c'est la base du
banc du lot (`lot6/banc/`). L'état d'avant ce lot est copié dans `lot6/base/`
**au départ, après la fin du lot 4** (voir plus bas).

## Ce que fait le lot 6

1. **Les pièces d'arène**, une fois, dans `public/ui.css` (section « les pièces
   du lot 6 », chacune avec son balisage exact en commentaire et ses doubles
   mouvement réduit et calme), posées sur un banc avant qu'un écran ne s'en
   serve :
   - **le HUD de match**, une rangée de 44 px commune aux deux arènes : la
     flèche et le menu de `nav.js` dans leurs deux cases de 44, la bâche du
     club de chaque camp (nom Oswald 13, écharpe `--e1`/`--e2` en bord bas,
     cerne or = toi, cerne bleu = en face), et au centre une plaque parpaing
     avec le score de corde en Oswald 24 à ombre dure, et dessous **le sticker
     de phase** (« GRAND VIRAGE » parpaing → « MINUTE DOUBLE 0:47 » face or,
     lettres d'encre, avec l'anneau de 60 s) ;
   - **le ticket terrain** fin (24 px), qu'on lit et qu'on ne touche pas sauf
     pour ouvrir la feuille du fil : score réel, minute à l'encre, dernière
     action ;
   - **la corde** tressée (verticale au Virage, horizontale au duel), **le
     foulard noué** qui la parcourt, **les deux lignes de but en scotch** de la
     couleur du camp, la progression en écharpe le long de la corde, les buts
     de corde en crans ; tant que `corde.svg` et `foulard-noeud` n'existent pas
     (lot 7), la corde peinte en CSS du chemin de niveau et un rond craie cerné
     d'encre à rayures d'écharpe ;
   - **la foule au pochoir** : des silhouettes teintées au camp (huit par camp
     au plus sous 400 px), allumées en proportion de `crowd`, qui passent en
     « pousse » quand le camp chante ; pochoir en `mask-image` (aucune image
     réseau), dessin provisoire tant que `pochoir-supporters` n'est pas dessiné ;
   - **la carte de chant (2:3) et la carte d'action (3:4)**, une seule matière
     pour les deux arènes : dessin plein (fini l'assombrissement à 60 %), bord
     craie, cerne d'encre, coût en sticker rond craie, nom Oswald 11 à 100 % sur
     bande d'encre, poussée Oswald 22 couleur du geste ; recharge = un scotch
     translucide qui se retire de haut en bas (hauteur en variable, nœud
     stable) avec le chiffre restant ; injouable = scotch en croix sur le
     **dessin** et sticker flare « −8 » (ce qui manque, jamais sur le
     libellé) ; aveugle = dos de carte ; jouée = elle se décolle (6°, ×1,15,
     100 ms) puis vole (`.tbf-jouee`, existant) ; **l'éventail** de la main
     (−6/−3/0/3/6°, la touchée monte de 8 px et passe à 0°) ;
   - **le pavé de geste en bâche craie ronde** (cerne d'encre 3 px, ombre dure
     4 × 6, chiffre Oswald 48 encre, consigne Oswald 12, anneau de pulsation au
     marqueur de la couleur du geste) et **le tampon de verdict** qui claque au
     centre : PARFAIT vert, BON bleu, MOYEN or, RATÉ rouge — tampon en
     contour sur le sombre à partir de 16 px, plein en dessous et toujours sur
     le kraft (amendement 16) ;
   - **le souffle** en écharpe fine bleue à crans aux coûts des cartes en main
     (`.tbf-jauge--fine` et `data-crans`, existants), **la ferveur à paliers**
     (« 12ᵉ → TOP 10 », le palier en sticker craie au bout ; sans palier servi,
     le rang seul), le sticker de **combo** (« 3 PARFAITS »), la **pile de
     souvenirs** en dos de carte ;
   - **la page kraft du bilan** (une page, pas une boîte) : titre, tampon,
     chiffres qui comptent l'un après l'autre (`FX.compter`, 700 ms d'écart),
     jauge d'XP en écharpe, la double barre miroir TOI/LUI du duel, deux bâches
     de sortie ; aucun paragraphe sur le kraft ;
   - **l'affiche** (le cadre à écharpe aux deux couleurs des clubs, blasons
     32 px, score en banderole, sticker LIVE) pour le voile du Virage et la
     préparation du duel ; **les effets posés sur l'arène** du duel (bâche
     déployée, brouillard sur la moitié adverse, scotch en croix sur la main
     pour « Parcage fermé », bouche barrée au marqueur pour « Silence radio »,
     flèches de vent au pochoir), chacun avec son chrono en anneau.

   Noms à éviter, déjà pris : `.tbf-tribune` (`stade-art.js`), `.tbf-souffle`
   (`fanzzy-scene.js`), `.tbf-compte` (l'éclat de `FX.compter`), la variable
   `--s` (la ola). Chercher tout nom neuf dans `public/` avant de le donner.

2. **Le Grand Virage** (`public/virage.html`).
   - **Le voile de choix** : le tunnel en fond (`tunnel.webp` n'existe pas :
     repli `img/ecran/tribune.webp` à 25 % sous un voile — **ne pas nommer
     l'adresse du tunnel avant que ses trois formats existent**), « LE GRAND
     VIRAGE » peint sur une bâche craie tournée avec son écharpe, « TES
     CLUBS » en titre cousu, chaque match en direct en **affiche** (la foule en
     frise de silhouettes allumées selon `crowd`), les matchs « ailleurs » en
     cadre pointillé, le choix du camp en deux bâches aux couleurs des clubs ;
     l'état vide (« PROCHAIN COUP D'ENVOI · dans 2 h 14 », « RÉPÉTER EN
     ATTENDANT » parpaing, « SUIVRE UN CLUB » bleue) avec le même calcul de
     compte à rebours que le hub, et les matchs reportés, suspendus ou sans
     heure écartés (§ 6, « Un match du fil garde sa date »).
   - **La tribune**, budget écrit pour 360 × 640, encoche comprise : HUD 44 +
     ticket terrain 24 + arène 256 + souffle et ferveur 52 + actions 56 + main
     110 visibles + marges 24 = 566. La corde, le foulard, les lignes de but,
     les foules, le stade de la rencontre en fond (voir `QUESTIONS.md`, Q5), la
     fumée du club au quart bas de l'arène, le Fanzzy mains sur la corde
     (45 % de la hauteur de l'arène, `#fzs`). **Ce qui n'est pas dans la
     direction et doit rester** trouve sa place dans le budget sans rien
     perdre : la fenêtre collective du capo (`#appel`) passe en ticket posé
     sur le bas de l'arène le temps de la fenêtre ; les cartes restées au duel
     (`#ecartees`) deviennent un sticker « DUEL SEULEMENT » sur les cases vides
     de la rangée, avec le lien vers `/deck` dans le panneau de ce qu'on porte ;
     la ligne « ce que tu portes » (`#apportsL`) devient une plaque ronde « i »
     de 44 px dans la rangée du souffle, son panneau reste hors de `#app`.
   - **La minute qui compte double** : le HUD, la corde et la fumée passent à
     l'or (jamais les cartes ni les familles), le chrono descend dans le
     sticker de phase avec son anneau de 60 s, calculé sur `surgeMs` (durée
     relative servie, § 16 du contrat) et non sur `surgeUntil` ;
     `FX.bandeau('MINUTE DOUBLE')` ne se joue plus au Virage : le sticker le
     dit.
   - **Le but réel** : la case de BD « GOAL ! » (280 × 110, bouffée de
     fumigène du club, confettis, liseré du club), posée par la scène comme
     aujourd'hui ; la page la redescend sous le tiroir quand on l'ouvre.
     **La carte-souvenir ne s'annonce que sur `virage:souvenir`** (servi à ceux
     qui l'ont reçue, § 16) : aujourd'hui la page l'annonce à chaque but de son
     club, même quand la compétition n'est pas couverte ou que le joueur n'a
     pas poussé dans la fenêtre — « Elle est dans ton carnet » est alors faux.
     Elle se retourne au centre (dos de LA REPRISE, buteur et minute imprimés,
     tampon rouge « TU Y ÉTAIS »), puis glisse vers la pile du coin.
   - **L'entrée** : les deux bâches se posent, la foule compte de 0 à son
     effectif (`FX.compter`), le Fanzzy entre et salue. **La sortie** est le
     bilan de tribune (point 4). Tout ce qui bouge vit dans des nœuds stables
     pilotés par classes et variables (`render` passe dix fois par seconde) ;
     `renderChants` passe par `accorder` comme `renderActes`.

3. **Le duel de tribunes** (`public/duel-nvn.html`).
   - **La préparation** : l'affiche du match choisi en tête (« CLASSÉ » en
     sticker or — le seul hors achat, c'est l'enjeu —, « ×2 » en tampon vert,
     le stade-mini en fond) ; les formats en cinq bâches-tuiles avec leurs
     silhouettes (1 à 5) et la prime en sticker craie (« +30 % », lue dans
     `primes`) ; le camp par les deux tribunes du stade-mini ; les matchs en
     tickets kraft de 60 px, un seul sticker d'état chacun ; « ENTRER EN
     FILE » en bâche flare de 60 px avec « +40 écharpes en jeu » en
     sous-libellé **seulement si le barème est servi** (§ 17) ; les règles
     derrière un « i » en plaque ronde. Sans deck : trois places vides
     (`img/place-vide`) sous une bâche bleue « CONSTRUIRE MON DECK ».
   - **Le vestiaire** (l'attente) : les places sont des sièges (`.tbf-gradins`
     du lot 5, à réemployer) qui s'occupent des bustes, le chrono avant les
     bots en Oswald 34 sur une bâche parpaing, « INVITER QUELQU'UN » en bâche
     violette, la rumeur qui monte à chaque arrivée.
   - **L'affiche** (six secondes) : « VS » en banderole entre deux écharpes
     croisées, la forme en cinq stickers ronds V/D/N, les trois Fanzzy qui
     entrent en cascade ; la cote seulement si servie.
   - **Le duel** : le même HUD que le Virage (« TA TRIBUNE » or, l'horloge en
     plaque centrale avec le sticker CLASSÉ, « EN FACE » bleu), le bouton de
     son retiré de l'arène (le son se coupe dans le tiroir, mode calme) ; le
     ticket terrain ; l'arène à 45 % : corde horizontale et foulard, la marée de
     couleur à front net, l'écart en banderole, un supporter au pochoir par
     joueur (or/bleu) qui pousse quand il chante et s'assoit s'il part ; les
     effets posés sur l'arène ; l'équipe en trois cartes 2:3 sur leur plaque de
     rareté (`palierDecor` du lot 4), l'active surélevée avec un halo de camp,
     le banc grisé, « Changement possible » = les cartes du banc se décollent
     et pulsent vert ; la Relève = `FX.evolution` sur la carte active et le
     tampon « A GRANDI » ; la main en éventail, aveugle = dos de carte ; les
     toasts en tickets. Budget écrit et mesuré à 360 × 640 : si tout ne tient
     pas, l'arène cède avant la main et les chants, jamais l'inverse.

4. **Le résultat.**
   - **Le bilan de tribune du Virage** remplace la boîte « QUITTER LA
     TRIBUNE ? » : à la flèche ou au menu, si le joueur a poussé pendant ce
     match, la page demande `virage:bilan` et pose la page kraft — rang dans sa
     tribune, ferveur, chants, PARFAITS, meilleure série, meilleur geste,
     souvenirs du match en dos de carte, XP versée qui remplit l'anneau, « ce
     Virage ne compte pas au classement » quand `classe` est faux — avec deux
     bâches, RESTER (parpaing) et SORTIR (flare) ; sans poussée, on sort sans
     rien demander. **Au coup de sifflet final** (`virage:fin`), la page
     demande son bilan (avec un délai tiré entre 0 et 8 s, voir
     `SERVEUR-VAGUE2.md`) et le pose sans qu'on touche rien, puis quitte la
     salle (`virage:leave`). Toute ligne sans donnée disparaît ; sans bilan
     servi (ancien serveur, réseau), la sortie reste celle d'aujourd'hui.
     `virage:leave` part toujours avant la navigation (180 ms, comme
     aujourd'hui).
   - **Le bilan du duel** devient la page kraft : la case de BD VICTOIRE,
     DÉFAITE ou NUL (vert, flare, gris) avec sa bouffée, les écharpes qui
     tombent dans le compteur puis volent vers le HUD, **la jauge d'XP qui se
     remplit depuis `gains.niveau.depart`** et fusionne la fête de niveau au
     lieu de l'empiler 1,4 s après, la cote « 1 240 → 1 262 » (`gains.cote`,
     absente sinon), le meilleur geste en tampon (« PARFAIT sur LA MONTÉE »,
     § 17, absent sinon), la carte préférée en sticker de carte, TOI/LUI en
     doubles barres miroir, le Fanzzy en pose victoire ou défaite, et deux
     bâches REJOUER (flare) / REVENIR (parpaing) **sans rechargement** : retour
     à `#prepa` par l'état, le drapeau « en partie » baissé avant de poser les
     boutons (voir `montrerBilan`).

5. **Le pavé et le verdict** (`public/geste.js`, `public/repetition.html`).
   Le pavé-bâche dans les dix gestes de rythme. **L'enfoncement de 4 px et la
   bouffée ne jouent que sur les gestes de frappe** (tempo, contretemps, écho,
   crescendo) ; martelage et salves : un tic et 8 ms, rien d'autre ; les gestes
   positionnels (tifo, écharpe, visée, jauge, rouleaux, ola, bascule) : le pavé
   ne bouge jamais. **Le verdict vient du serveur** : la fenêtre du geste
   attend la réponse au plus 600 ms après la dernière frappe et y claque le
   tampon ; sans réponse à temps elle se ferme, et le tampon claque sur la
   carte jouée à l'arrivée. Le mot est `verdict` (servi, § 16 et § 17), jamais
   un seuil recopié dans une page — le Virage écrit aujourd'hui ses propres
   seuils (0,9 / 0,7 / 0,4), le duel les siens, la répétition une autre
   échelle (voir Q3). `/repetition` finit par son tampon et « LE JOUER EN
   DUEL » ; son « ★ TON MEILLEUR » devient un tampon.

6. **Le son de tribune branché sur le match** (`public/son.js` existe ; son
   moteur ne change pas de nature). Dans les deux arènes, **les chants calés
   sur la pulsation du geste** — `window.TBF_SON.chant('tempo' |
   'contretemps' | 'frappes', …)` sur les durées que le serveur donne
   (`S.you.gestes` au Virage, `moi.gestes` au duel), comme `/repetition` le
   fait déjà, arrêtés à la fermeture de la fenêtre (`arreterChant`). La rumeur
   suit le match : l'entrée (la foule qui compte), la mi-temps (la rumeur
   retombe), la minute double, le but de son camp (l'ovation), la fin (la
   tribune se vide), le vestiaire du duel (la rumeur qui monte à chaque
   arrivée). Le tampon claque (`bache`). Toujours `window.TBF_SON` écrit en
   toutes lettres (`son:smoke` lit les pages), toujours sous le calme, jamais
   seul porteur d'une information. Un son ajouté ou un gain touché :
   `npm run son:banc`, et `son:smoke` vert.

7. **Le sticker d'urgence sur les deux écrans de jeu** (reliquat du lot 2). Les
   deux boutons de la barre entrent dans les cases du HUD de match ; le bouton
   de menu y porte **le sticker de l'état le plus urgent** comme partout
   ailleurs (`data-urgence`, `data-pastille`), et la branche `enJeu` de
   `menu.js`, qui y gardait le point rouge, disparaît. Le sticker déborde de
   neuf pixels (treize avec son bord et son ombre) : le HUD lui laisse cet air,
   l'écran aussi. Et l'hypothèse **H6** (le voile des arènes) se tranche ici :
   voir Q6.

8. **La présence**, si Gaël l'a tranchée (Q2) : une pastille sur chaque ami de
   `/amis` (au Virage, en duel, en ligne ; rien pour hors ligne), « 2 AMIS ICI »
   dans le Virage (`virage:amis`, `virage:ami`), et l'interrupteur « apparaître
   hors ligne » au pied du tiroir. Non tranchée, le serveur ne sert rien et
   aucun écran ne montre rien.

9. **Ce qu'il faut au serveur** : la vague 2, dans `lot6/SERVEUR-VAGUE2.md`
   (le bilan de tribune et l'XP du Virage, le verdict servi, le rang et le
   palier suivant, `surgeMs`, `virage:fin`, `virage:souvenir`, le meilleur
   geste du duel, le barème du duel, la présence, et cinq défauts trouvés en
   chemin, dont deux qui coûtent : une salle restée ouverte après le coup de
   sifflet consomme jusqu'à 1 440 appels par jour à l'API sportive, et une
   reconnexion rend 40 de souffle et une main neuve). Les écrans codent contre
   les § 15 à § 18 du contrat, au banc, et tolèrent leur absence (R1, R2).

**Hors du lot 6** : `/deck` (le lot 4 le garde juste avec la nouvelle carte ;
les arènes y renvoient sans rien lui demander) ; la production des images
(lot 7, `lot6/IMAGES.md` : tunnel, foulard, corde, silhouettes, sachet de LA
REPRISE) — le lot 6 code leurs replis ; le rideau d'ouverture de l'accueil
(lot 2, il prendra le tunnel au lot 7) ; le Fanzzy vivant ; les stades
(`img/stade/`, dix-huit dessins servis) ; toute modification de
`src/server/nvn/engine.js` (voir plus bas).

## Ce qui suppose l'état d'après le lot 4

Le lot 6 part de l'état du dépôt **une fois le lot 4 fini, vérifié et tracé**,
copié dans `lot6/base/` au départ. Ces fichiers sont dans les mains du lot 4 en
ce moment, et le lot 6 les reprend tels qu'il les laisse :

- `public/ui.css` : les pièces du lot 4 (`.tbf-boosters`, `.tbf-pin`,
  `.tbf-etage`, `.tbf-cercle`, l'album, le vestiaire, l'inventaire, l'arbre
  des âges `.tbf-ages` et sa corde peinte, la vitrine, la place de la fête de
  niveau). Les pièces du lot 6 s'écrivent **après** elles, dans leur propre
  section, et la corde des arènes reprend la corde peinte du chemin et de
  l'arbre (une corde, un dessin).
- `public/cartes.js`, `public/cartes.css`, `public/fanzzy-fond.js` : la carte
  sticker et **la plaque qui suit la rareté** (`palierDecor` corrigé) ; les
  cartes de l'équipe du duel s'y posent ; `.tbf-forme` remplace partout les
  losanges et ★/♛ de rareté.
- `public/duel-nvn.html`, `public/virage.html`, `public/geste.js`,
  `public/repetition.html`, `public/deck.html` : le périmètre `pages-autres`
  du lot 4 peut y avoir retouché ce que la nouvelle carte déplace. Relire le
  diff `lot4/base/` → dépôt avant d'écrire.
- `public/nav.js`, `public/menu.js` : la bande du HUD de la barre passe à la
  brique `.tbf-boosters` (lot 4, `barre-tiroir`).
- `public/fx.js`, `public/son.js`, `public/fanzzy-scene.js`,
  `public/niveau-fete.js` : le périmètre `fx` du lot 4 (la cérémonie
  d'évolution, la fête de niveau rangée dans `ui.css`).
- `serveur/CONTRATS.md`, `serveur/ECARTS.md` : le lot 4 y ajoute le § 14 (« Ma
  place ») et les insignes du carnet ; la vague 2 commence au **§ 15**.
- `scripts/audit-ui.mjs`, `scripts/verif-pages.mjs` : les états et les
  contrôles du lot 4 ; `scripts/cartes-ui-smoke.mjs` (`cartes:ui`, sans base)
  existe.
- `package.json` : `cartes:ui` inscrite.

Et une précaution : **Gaël met en ligne au milieu des ateliers.** Avant de
lancer le lot 6, lui dire de ne rien mettre en ligne avant la fin, et que la
vague 2 demande `sql/arenes.sql` (par le Manager : `npm run
schema:appliquer` en SSH, puis redémarrer).

## Les périmètres

Une clé par périmètre, fermée : c'est elle qui aiguille les besoins, les
constats et les corrections, jamais un libellé libre. Les fichiers sont
**disjoints** ; un fichier qui n'est dans aucune liste ne se touche pas.

| clé | fichiers |
|---|---|
| `mesure` | `scripts/audit-ui.mjs`, `scripts/verif-pages.mjs` |
| `feuilles-css` | `public/ui.css` |
| `fx` | `public/fx.js`, `public/son.js`, `public/fanzzy-scene.js`, `public/niveau-fete.js`, `public/action-art.js`, `public/chant-art.js`, `public/stade-art.js`, `scripts/son-smoke.mjs`, `scripts/son-banc.mjs` |
| `geste` | `public/geste.js`, `public/repetition.html`, `scripts/repetition-ui-smoke.mjs`, `scripts/gestes-smoke.mjs` |
| `grand-virage` | `public/virage.html`, `scripts/virage-ui-smoke.mjs` |
| `duel-tribunes` | `public/duel-nvn.html`, `scripts/nvn-ui-smoke.mjs` |
| `barre-tiroir` | `public/nav.js`, `public/menu.js` |
| `amis` | `public/amis.html`, `scripts/amis-ui-smoke.mjs` |
| `paquet` | `package.json` |
| `tests` | toute autre suite de `scripts/` qui lit un comportement volontairement changé par le lot (`tour-ui-smoke.mjs`, `accueil-ui-smoke.mjs`…), hors `audit-ui.mjs`, `verif-pages.mjs` et les suites des autres périmètres |
| `serveur-socle` | `sql/arenes.sql` (neuf), `scripts/ordre-schema.mjs`, `src/shared/reglages.js`, `src/shared/verdict.js` (neuf), `src/server/recompenses.js`, `src/server/auth/store.js`, `scripts/schema-smoke.mjs`, `scripts/reglages-smoke.mjs`, `scripts/recompenses-smoke.mjs`, `scripts/abonnement-smoke.mjs`, `scripts/securite.mjs`, `scripts/auth-smoke.mjs`, `serveur/CONTRATS.md`, `serveur/ECARTS.md`, `DEPLOIEMENT.md`, `A-DEPLOYER.md`, `CONFIDENTIALITE.md` |
| `serveur-virage` | `src/server/ferveur/virage.js`, `src/server/ferveur/index.js`, `src/server/ferveur/bilan.js` (neuf), `src/server/souvenirs/index.js`, `scripts/virage-smoke.mjs`, `scripts/souvenirs-smoke.mjs`, `scripts/virage-loadtest.mjs` |
| `serveur-duel` | `src/server/nvn/index.js`, `src/server/deck/index.js`, `src/server/repetition/index.js`, `scripts/nvn-smoke.mjs`, `scripts/nvn-net-smoke.mjs`, `scripts/deck-smoke.mjs`, `scripts/repetition-smoke.mjs` |
| `serveur-presence` | `src/server/presence/index.js` (neuf), `src/server/amis/index.js`, `server.js`, `scripts/verif-cablage.mjs`, `scripts/amis-smoke.mjs`, `scripts/presence-smoke.mjs` (neuf) |

Ce que chaque périmètre serveur fait, ses tests et ses mutations sont dans
`SERVEUR-VAGUE2.md`, § 6. **`src/server/nvn/engine.js` n'est dans aucune
liste, exprès** : `niveau-smoke` y refuse le mot « niveau », trois suites en
dépendent, et tout ce que le lot demande au duel (verdict, PARFAITS, meilleur
geste) se lit dans les évènements que le moteur émet déjà, depuis
`nvn/index.js`. Un agent qui croit devoir y toucher s'arrête et le dit dans
son rendu, avec la clé `serveur-duel` et la raison : c'est un risque, pas une
correction.

Les écarts au plan se rendent dans le rendu de chaque périmètre ; `serveur-socle`
les verse dans `serveur/ECARTS.md`, sous la clé de chacun, et il est le seul à
écrire `serveur/CONTRATS.md` (le texte des § 15 à § 18 est prêt dans
`SERVEUR-VAGUE2.md`, § 7 : il le colle **en premier**, avant que les écrans
codent contre lui). `server.js` et `scripts/verif-cablage.mjs` sont à
`serveur-presence` : un besoin de câblage d'un autre périmètre lui arrive par
la clé.

## Ordre de travail

1. **`mesure`, seul, avec la base** : l'état de départ (`--jour --etats`), et
   les états d'arène que l'audit ne sait pas photographier aujourd'hui — il ne
   visite `/virage` et `/duel-nvn` qu'au voile et à la préparation. Ajouter,
   par la technique du banc (une fausse socket injectée à la place de
   `/socket.io/socket.io.js`, des états fabriqués), au moins : le Virage en
   tribune, en minute double, avec la case GOAL !, et son bilan ; le duel en
   jeu, son vestiaire et son bilan ; le pavé ouvert. À 360 × 640, 320 × 568,
   412 × 915 et 768 × 1024. Écrire `lot6/MESURE.md`.
2. **`serveur-socle`, seul** : le contrat collé, `sql/arenes.sql`, les
   réglages, `src/shared/verdict.js`, la source `virage` du grand livre.
3. **En parallèle** : les briques (`feuilles-css`, `geste`, `fx`) au banc,
   puis les écrans (`grand-virage`, `duel-tribunes`, `barre-tiroir`, `amis`)
   contre le contrat et les briques ; et les trois autres périmètres serveur.
4. Vérification, corrections par clé, regard (critique des captures, revue du
   code des écrans, revue du serveur), trace (`HISTORIQUE.md`, `ETAT.md`,
   `A-DEPLOYER.md`), comme au lot 4.

## Ce qui ne doit pas bouger

- **Le geste est noté par le serveur.** Le client envoie des instants de
  frappe, jamais une réussite ; il ne dessine la pulsation qu'avec les durées
  servies (`gestes`), il ne nomme le verdict qu'avec le code servi, il ne
  compte ni les PARFAITS, ni la série, ni la ferveur, ni l'XP. Le combo du HUD
  lit `serie` dans la réponse du serveur, pas un compte local.
- `src/server/nvn/engine.js` (voir plus haut) ; `VirageRoom.appliquer` et
  `DuelNvN.appliquer` restent deux fonctions ; la division par l'effectif ;
  la portée des cartes (`PORTEE`, `dansLeVirage`).
- Les acquis des lots 0 à 5 et du lot 4, et les arbitrages. **Aucune animation
  infinie en grille, au plus trois par écran, toutes comptées** : `fx.js`
  fait respirer toute image `.illu` (`FX.animer`, par un observateur sur tout
  le document), donc les cinq dessins de la rangée d'action et ceux de la main
  respirent aujourd'hui, en plus du point du direct, du score qui luit et de
  l'appel du capo — à compter, et à ramener sous le plafond (un attribut qui
  fige une illustration, posé par `fx`, plutôt qu'une classe renommée que lit
  `nvn:ui`). La `transform` de l'illustration reste à `fx.js` (on n'y centre
  rien). Chaque mouvement a ses doubles `prefers-reduced-motion` **et**
  `html[data-calme~="animations"]` ; chaque son, chaque vibration hors `fx.js`
  lit `data-calme`.
- **Une ligne sans donnée disparaît, jamais un tiret** : le `<b>—</b>` des
  deux clubs du HUD du Virage et le « — » du titre du bilan du duel partent.
  Pas de petit texte or : le score d'or en minute double est du grand texte
  (24 px) ; tout ce qui est petit sur l'or est de l'encre sur une face d'or.
  Rien de clair sur le kraft ; un verdict sur le kraft est un tampon plein.
- **Les nœuds stables** : `accorder`, `ecrire`, `poser`, dans les deux pages ;
  aucun `innerHTML` sur un conteneur que `render` ou `rendreDuel` touche.
- **La feuille du fil vit hors de `#app`** et reste au-dessus des effets,
  refermable pendant un bandeau. **L'ordre des calques** : la rangée des deux
  boutons reste sous le voile et le tiroir (45 < 48 < 49) — la direction
  écrit « z 96 », c'est faux ici : le tiroir doit couvrir le HUD ; la case de
  BD (95) est redescendue par la page quand le tiroir s'ouvre ; la cérémonie
  (96), la boîte (160) et la fête (170) au-dessus. **La fenêtre du geste**
  vit dans `#app`, contexte d'empilement : tout calque posé sur le document
  passe devant elle. Rien ne doit couvrir le pavé ni le faire trembler
  pendant qu'elle est ouverte — la case de BD (95), la secousse, les titres
  de `fx.js` et la carte-souvenir (96) attendent sa fermeture
  (`apresLaFenetre`, un but réel en dernier), la case déjà affichée est
  coupée à son ouverture et la carte-souvenir déjà là se range, puis revient
  pour son reste (correctif d'urgence du 4 octobre 2026, reporté au lot 6).
- **Les deux formes d'un libellé** (« TA TRIBUNE »/« TOI », « GRAND VIRAGE »)
  restent écrites dans le balisage, la longue retirée de l'écran par le motif
  que `tour:ui` reconnaît, jamais par une police de zéro pixel.
- Les **identifiants et classes lus par les suites** : au Virage `#app`,
  `#veil`, `#veilTitle`, `#matchs`, `.match`, `#q`, `#rech`, `#partager`,
  `#fil`, `#filScore`, `#filDer`, `#fil .sc small`, `#feuille`,
  `#feuilleCorps .ev`, `.feuille .tete`, `#rope`, `#score`, `.hud *`,
  `.club b`, `.club small`, `.hand`, `.card` (`b`, `.c`, `.p`), `#fzs`
  (`.tbf-scene`, `.tbf-pose.on`, `.tbf-souffle`), `.tbf-moment` (`b`,
  `small`), `.tbf-vignette`, `.fx-bandeau` ; au duel `#app`, `#prepaCorps`,
  `.mt[data-fixture]`, `[data-fixture]`, `[data-fmt]`, `[data-camp]`,
  `#entrer`, `#voile`, `#toast`, `#jeu`, `#arene`, `#ecart`, `#stade
  .tbf-stade-fond`, `#fouleMoi .tete`, `#fouleEux .tete`, `#equipe .fz`,
  `#mainCartes .ct`, `#chants .chant`, `#pad`, `#miniZone [data-k]`,
  `.tbf-jouee`, `.illu`, `.sceau`, `.vig`, `.tribune-att h4`,
  `.place-att.pris`/`.libre`, `#affiche` (`.camp-bloc`, `.fz-aff`, `.entre`,
  `.forme`, `.qui b`, `.grand-haut`, `.camps`), `#bilan` (`.stat .quoi`,
  `.gain small`) ; partout `.tbf-retour`, `.tbf-burger`, `.tbf-tiroir.on`,
  `.tbf-dial`, `[data-oui]`, `[data-non]`. **Grep dans `scripts/` avant d'en
  changer un**, et le dire dans `tests_a_revoir` : le bilan qui remplace
  « QUITTER ? » change ce que `virage:ui` vérifie avec `[data-oui]` et
  `[data-non]`, et le retrait du bandeau MINUTE DOUBLE retire l'élément sous
  lequel `virage:ui` mesure la feuille du fil — le contrôle doit garder son
  sens avec un autre calque.
- La règle des 55 % (le bouton d'action principal complète la réserve de la
  barre) ; la règle « un deck entre toujours au premier âge » ; le stade
  appartient au match ; « TERRAIN » distingue le vrai score de celui de la
  corde tant que la matière ne le fait pas.
- **Aucune requête lourde de plus par écran**, aucun appel nouveau à l'API
  sportive : tout ce que le lot affiche vient de la socket ou de lectures en
  base déjà bornées (`SERVEUR-VAGUE2.md`, § 11).
- **Aucune image avec texte, lettre, chiffre, logo, écusson, maillot
  identifiable ou personne réelle** ; aucune page ne nomme une image qui
  n'existe pas en ses trois formats.

## Comment on travaille ici

Comme aux lots précédents : tu ne touches que tes fichiers ; un besoin ailleurs
se décrit dans ton rendu avec la clé du périmètre (une suite nouvelle à
inscrire : clé `paquet`) ; un constat s'aiguille sur une clé de la table
ci-dessus, jamais sur un libellé, et l'on compte à la sortie autant de constats
remis qu'il en est entré. Pendant les phases de travail, seuls les agents
serveur lancent **leur** suite, et les propriétaires d'une suite sans base la
leur (`son:smoke` et `son:banc` pour `fx`, `gestes:test` et `repetition:ui`
pour `geste`) ;
le verrou `.tbf-suite.lock` refuse au lieu d'attendre : si tu le trouves tenu,
c'est un autre agent, réessaie plus tard, ne le force jamais ; une suite lancée
depuis un worktree ne voit pas ce verrou et écrase la même base. Personne ne
lance `npm test`, `tout-tester`, l'audit ni `pages:navigateur` hors de la
vérification. Le banc puppeteer sans base sur ton propre port est permis : il
sert `public/`, intercepte `/api` et la socket, et montre tes écrans dans leurs
états (avant le coup d'envoi, en tribune, en minute double, au but, au bilan ;
une tribune de 3 et de 300 ; un joueur sans deck, un neutre, un Virage non
classé ; le duel en 1 contre 1 et en 5 contre 5) à 360 × 640 et 768 × 1024 ;
regarde tes captures. Après avoir écrit un contrôle, casse exprès ce qu'il
surveille et vérifie qu'il rougit. Tu ne commites rien. Commentaires en
français qui disent pourquoi. Fins de ligne LF (les outils d'édition repassent
parfois un fichier en CRLF : vérifier avec `grep`, jamais avec `sed`). Pas
d'accent grave dans un commentaire posé dans un gabarit de chaîne. Pas de
`String.replace` avec `$` dans un script de correctif (employer
`split`/`join`). Pas de Python. Ne jamais `cd` dans un dossier sous
`.claude/worktrees/`.
