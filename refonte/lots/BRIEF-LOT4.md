# Lot 4 de la refonte FAIT MAIN — la collection

Dépôt : **`C:\Users\gaelm\Documents\GitHub\thebestfan`** (la copie principale ;
jamais une copie sous `.claude/worktrees/`). **Toujours des chemins absolus.**
Lis d'abord `ETAT.md` § 2, § 3 et § 6, les sections des lots 0 à 5
d'`HISTORIQUE.md` (« 4 quadragies », « bis », « ter »), `public/ui.css`
(la matière FAIT MAIN, les briques des lots 1, 2, 3 et 5), et
`serveur/CONTRATS.md` (les données que le serveur sert déjà : nouveautés § 2,
crans de collection § 5.1, divisions § 5.2, carnet § 6). Les arbitrages de
Gaël du 2 octobre 2026 sont des règles : faces vives foncées, kraft `#E4D3B5`
à l'encre noire, l'or seulement en grand texte ou en face.

Références dans ce dossier (`lot4/`) : `direction-ultras-diy.json` (lis
`amendements` d'abord, puis `ecrans` pour `/fanzzy`, `/fanzzy/:id`,
`/collection`, et `composants` : Carte Fanzzy, Badge de rareté, Carte
d'action) ; `direction-tcg-premium.json` (la direction « La carte en main »,
dont FAIT MAIN a pris la matière de carte par rareté, la pochette numérotée, le
niveau de collectionneur et la vitrine comme modale commune : lis ses
composants Carte Fanzzy et Modale) ; la maquette `dir-ultras-diy.html`
(écrans 3 CLASSEUR et 4 FICHE, et la planche) et ses captures
`maquette-captures/`. L'état d'avant ce lot est copié dans `lot4/base/`.

## Ce que fait le lot 4

1. **La carte** (`cardHTML` dans `public/cartes.js`, `public/cartes.css`), une
   seule fois pour les six écrans qui la montrent (classeur, collection,
   ouverture d'un booster, bienvenue, deck, duel, aide) : le **sticker de
   carte** — plaque de rareté en fond (**la plaque suit la rareté, pas l'âge** :
   `palierDecor` de `public/fanzzy-fond.js` est corrigé, les plaques de tenue
   restent au vestiaire), bord de découpe craie et cerne encre, ombre dure, nom
   en banderole sur une bande craie inclinée (deux lignes permises au-delà de
   150 px), pin de famille, âge (tampon « ÉVO 2 » plein sur la grande carte,
   badge sous 150 px), doublons « ×3 » en sticker, AVATAR en sticker ; **la
   forme de rareté** (`.tbf-forme` : rectangle, rond, étoile, éclat) remplace
   les losanges et les ★/♛ partout ; **matière par rareté, statique en grille**
   (commune carton mat, rare liseré plastifié, épique holo figé, légendaire
   liseré or figé), animée seulement en vitrine, sur la fiche et à la
   révélation ; **non possédée** : pochoir gris sous scotch en croix avec le
   cadenas en icône, et le **numéro de pochette « N° 013 »** ; âge secret :
   flou et sticker de prix ; le verso construit à la demande. **L'étiquette
   d'état passe dans le flux du bandeau du nom** (elle passe encore sous un nom
   de trois lignes : le correctif provisoire `--lignes-nom` + `@container` du
   lot 1 se retire). **Un écran de test** : toutes les tailles × raretés ×
   états de la carte sur une planche, et une suite qui la photographie et la
   mesure, sans base.
2. **Le classeur et le vestiaire** (`/fanzzy`) : MON FANZZY = LE VESTIAIRE
   (bandeau d'économie fixe, scène en bâche de la couleur de rareté avec
   l'écharpe de la série, stickers de stats, bande du cri, ENTRER EN DUEL avec
   les mini-portraits du deck, SA FICHE ; état vide déjà fait au lot 2, à
   garder) ; CLASSEUR = **L'ALBUM** : une page par série en balayage
   horizontal (pages montées ±1 seulement), rail des séries, en-tête de série
   (emblème, « 12 / 40 », jauge-écharpe à crans avec la récompense de
   complétion si le serveur la sert), grille de cartes-stickers collées de
   travers et de pochettes numérotées en pointillé pour les manquantes,
   NOUVEAU (drapeau serveur `nouveautes`, contrat § 2), la légendaire en case
   double « VITRINE », filtres de famille en six stickers ronds, l'interrupteur
   « ce qu'il me reste ».
3. **La fiche** (`/fanzzy/:id`, `fanzzy-fiche.html/js/css`) : **budget de
   hauteur écrit pour 360 × 640** (barre 44 + en-tête 44 + carte souple ≥ 220 +
   cri 32 + inventaire 100 + détail 88 + actions 74), la carte tenue en main
   (inclinable, se retourne), l'inventaire en quatre rangées (ÂGES en arbre de
   nœuds d'écharpe sur une corde, EFFETS, ÉTATS, TENUES — tenues en BLEU), le
   détail en fiche kraft, les actions hiérarchisées (ÉVOLUER or avec prix,
   EMMENER EN DUEL flare, ME MONTRER AINSI parpaing), le non possédé (pochoir
   sous scotch, vignette du paquet, « 1 CHANCE SUR 3 », bâche or OUVRIR UN
   BOOSTER qui mène vraiment à `/boosters`), la cérémonie d'évolution
   (FX.evolution, tampon ÉVO 2, ticket « −25 » et compteur qui décompte).
4. **La collection** (`/collection`) devient **L'ALBUM** de tout ce qui se
   gagne : le niveau de collectionneur (anneau sur l'atteignable aujourd'hui,
   titre de palier, récompense du prochain cran selon le contrat § 5.1 et son
   geste RÉCUPÉRER), cinq grandes bâches-tuiles qui ouvrent chacune une
   sous-vue (fini l'accordéon de 13 000 px), l'album Fanzzy **par le même
   composant que le classeur** (`.tbf-album`), les planches d'états et de
   tenues par personnage, l'équipement et les actions en grilles de stickers,
   **la vitrine comme modale commune** (inclinaison, pile des voisines en dos
   derrière, manquante avec la vignette du paquet et OUVRIR UN BOOSTER,
   possédée avec « ×N », boutons en bâches).
5. **Reliquats** de la vague précédente, chacun dans son périmètre :
   - **la réserve de boosters se dessine de trois façons** (le kiosque, la
     boutique, la bande du HUD de la barre) : une seule brique dans `ui.css`,
     employée par les trois ;
   - **la fête de niveau** n'a pas sa place dans `ui.css` (son style vit
     ailleurs) : la ranger ;
   - **les insignes du carnet** sont versés mais ni servis ni dessinés : le
     serveur les sert (contrat écrit dans `serveur/CONTRATS.md`, écart dans
     `serveur/ECARTS.md`), le profil les montre ;
   - **le booster des premiers pas** (`src/server/aide/index.js`,
     `recompenser`) entre dans la réserve sans compter d'abord la recharge en
     attente : employer `recharger(conn, userId)` de `fanzzy`, comme le grand
     livre, avec le test qui l'aurait attrapé ;
   - **`/api/rank/moi`** sert des champs (`avatar`, `niveau` à la racine, les
     couleurs du club) que `serveur/CONTRATS.md` ne déclare pas : mettre le
     contrat d'accord avec ce qui est servi.

**Hors du lot 4** : les arènes (lot 6), les images à produire (le sachet de
LA REPRISE n'a pas de dessin : le kiosque garde son repli, c'est une
production d'images, pas de code), le deck (il emploie la carte et doit rester
juste, rien de plus).

## Ce qui ne doit pas bouger

Les acquis des lots 0 à 5 et les arbitrages ; les tailles de carte en `--u` et
le seuil du pied sous 150 px ; `fx.js` garde la main sur l'illustration (sa
`transform` est réservée) ; les identifiants et classes lus par le JavaScript
et les suites (`cardHTML` est lu par sept écrans et plusieurs suites : grep
avant de changer quoi que ce soit) ; la révélation des boosters du lot 3 doit
rester juste avec la nouvelle carte ; « une ligne sans donnée disparaît,
jamais un tiret » ; au plus trois cartes en matière animée à l'écran, aucune
animation infinie en grille ; chaque mouvement a ses doubles
`prefers-reduced-motion` et `html[data-calme~="animations"]` ; la rareté reste
une information (couleur, forme et mot) ; pas de petit texte or ; aucune
requête lourde de plus par écran ; les pages montées ±1 seulement dans l'album
(un album de 152 cartes ne monte pas 152 cartes).

## Comment on travaille ici

Comme aux lots précédents : tu ne touches que tes fichiers ; un besoin ailleurs
se décrit dans ton rendu avec la clé du périmètre ; pendant les phases de
travail, seuls les agents du serveur lancent LEUR propre suite (si le verrou de
la base est tenu, c'est un autre agent : réessaie plus tard), personne ne lance
`npm test`, `tout-tester`, l'audit ni `pages:navigateur` ; un banc puppeteer
sans base sur ton propre port est permis (intercepte `/api` pour voir tes
écrans dans leurs états). Tu ne commites rien. Commentaires en français qui
disent pourquoi. Fins de ligne LF. Pas d'accent grave dans un commentaire posé
dans un gabarit de chaîne. Pas de `String.replace` avec `$` dans un script de
correctif. Pas de Python.
