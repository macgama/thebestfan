# Brief — refonte « gaming » de l'UI/UX de thebestfan.online

Dépôt : `C:\Users\gaelm\Documents\GitHub\thebestfan` (Node + MariaDB, **aucune
étape de compilation** : pages HTML sous `public/`, une par écran, script en
ligne ; feuille commune `public/ui.css` (2011 lignes) ; barre commune `nav.js`
+ `menu.js` ; effets `fx.js` ; personnages `fanzzy-scene.js` / `fanzzy-art.js`).

## Le jeu, en dix lignes

Un jeu de cartes de **supporters** adossé aux vrais matchs de football. Le joueur
collectionne des **Fanzzy** (personnages de tribune, 3 âges e1/e2/e3, 4 tenues,
5 expressions dessinées : neutre, joie, dépit, colère, pousse), les équipe
(stuff), construit un deck (3 Fanzzy, équipement, 10 cartes d'action), et joue
un seul geste : **tirer sur une corde** au rythme (« pousser », « chanter »).
Deux arènes : le **Grand Virage** (toute une tribune pendant un vrai match ; un
but réel secoue la corde et ouvre une minute qui compte double) et le **Duel de
tribunes** (1v1 à 5v5, avec deck). On repart avec une **carte-souvenir** par but
vécu (carnet). Monnaies : **écharpes** (soft) et **billets** (hard, Stripe).
Un **KOP** = clan avec caisse commune. Classements supporters / tribunes /
duellistes. Boosters ouverts « déchirés à la main ». Raretés : commune (gris),
rare (bleu), épique (violet), légendaire (or). Séries (13 ; une seule ouverte au
lancement : RP « La reprise »). Le jeu se joue **au téléphone, au stade**, en
plein jour parfois.

Les 24 écrans : `/` (vitrine puis hub : le Fanzzy équipé au centre, deux rails
de tuiles), `/compte`, `/bienvenue` (cérémonie d'arrivée), `/fanzzy` (kiosque +
classeur + deck via onglets), `/fanzzy/:id` (fiche), `/collection`, `/boosters`
(ouverture), `/deck`, `/kop`, `/carnet`, `/virage`, `/duel-nvn`, `/amis`,
`/equipes`, `/matchs` (aujourdhui.html), `/teletext`, `/classement`,
`/boutique`, `/abonnement`, `/profil`, `/repetition`, `/aide`, `/admin`,
`/diagnostic`.

## Ce qui existe déjà comme direction visuelle (ne pas le redécouvrir)

Jetons dans `ui.css` `:root` : `--beton #0F1216`, `--craie #F2EEE4`,
`--projo #F5C33B` (or), `--flare #E0402C` (rouge), `--vert #1E9E6A`, `--bleu
#3C82E8`, `--violet #8257DA`, `--gris #C2CAD6` ; raretés `--r-commune/rare/
epique/legendaire` ; polices `--banner: Oswald` (capitales espacées) et `--ui:
system-ui` ; `--panneau rgba(16,22,31,.72)` (panneau dépoli), `--trait`,
`--r 15px`, `--colonne min(100vw, 900px)`.

Décor : la **photo de tribune** assombrie (`public/img/ecran/tribune`,
`accueil`, `fond-tribune`) sous toutes les pages, panneaux dépolis `.pan` posés
dessus.

**La plaque** (`.tbf-plaque`, `.tbf-case`, `.tbf-bloc`, `.tbf-onglets`,
`.tbf-cadre`, `.tbf-etiquette`) : vocabulaire d'objet inspiré de Brawl Stars /
Clash Royale — cerne 2 px presque noir, tranche 5 px dessous, filet de lumière
en haut, ombre portée, enfoncement au toucher (`translateY(--epaisseur)`).
Propre au jeu : le **lettrage de banderole** (Oswald capitales, ombre dure),
**l'écharpe** (rayures obliques à deux couleurs, seul motif du jeu), le **coin
coupé** (bas-droit presque carré, plaque vissée), la **couleur par destination**
(`data-ton` = or / flare / vert / bleu / violet / craie ; sur le hub un ton par
ligne : rouge = jouer, bleu = posséder, vert = mémoire/rang, violet = les gens,
or = acheter). Décision déjà prise et à respecter : **`.pan` reste calme** — un
écran entièrement en relief est un écran sans hiérarchie, « le défaut exact des
interfaces gaming ratées ». Le relief va à ce qui se touche et au panneau
principal.

Le **moment fort** (« GOAL ! ») est une **case de bande dessinée** : cadre à
trait d'encre, rayons en éventail, lettrage banderole, légèrement de travers.

Les Fanzzy « vivent » : respiration, gestes de repos, saut, salut (calques
CSS dans `ui.css`, `fanzzy-scene.js`).

Constat sur l'état actuel (captures dans `C:\Users\gaelm\AppData\Local\Temp\
tour-*.png`, 360 px de large, pleine page — les regarder avec l'outil Read) :
le **hub** est déjà assez « jeu » (personnage central, tuiles colorées en
relief, jetons en haut). Mais la plupart des **autres écrans** sont des listes
sobres posées sur la photo : titres en Oswald, texte gris, petits panneaux
plats — ils ressemblent à un site, pas à un jeu. Et surtout l'**UX** n'est pas
gaming : peu de récompense visible, pas de progression mise en scène, pas de
HUD, pas de « juice » (feedback, particules, compteurs qui montent, vibrations),
pas de missions/quêtes, pas de saison affichée, pas de rituels d'entrée.

## Les règles à ne pas violer

- **VISUELS.md** : aucune marque, aucun logo/écusson de club, aucun texte dans
  les illustrations générées, aucune personne réelle. Les couleurs de club sont
  permises. (Les logos de clubs servis par API-Football dans les matchs et le
  télétexte sont des données, pas nos visuels.)
- **Pas de framework, pas de build** : HTML + CSS + JS vanilla, servis tels quels.
  Une proposition doit être réalisable dans `ui.css` + les pages, avec des
  images produites par les chaînes existantes (`npm run art/fonds/stuff…`).
- **Téléphone d'abord** : 360 px de large, cibles ≥ 44 px, contraste lisible en
  plein jour (l'audit `scripts/audit-ui.mjs` mesure débordement, cibles,
  contraste). `prefers-reduced-motion` respecté.
- La **couleur de rareté** est une information, identique partout.
- Le geste est **noté par le serveur** ; l'UI ne peut pas inventer des
  mécaniques serveur, mais peut proposer ce que le serveur devrait exposer
  (à signaler comme tel).
- Le lettrage de banderole Oswald, l'écharpe, le coin coupé et les tons par
  destination sont **l'identité** : on peut les pousser, les transformer, pas
  les jeter sans raison forte et dite.

## Ce que le propriétaire demande (Gaël)

« J'aimerais reprendre l'UI-UX pour la rendre GAMING. Est-ce que tu pourrais me
faire des propositions et me montrer à quoi cela pourrait ressembler ? »

Donc : des **directions** (plusieurs, tranchées, comparables), et des
**maquettes** visibles. Le livrable final est une page HTML interactive
présentant 3 directions, avec avant/après sur des écrans clés, et une couche
UX gaming transversale (progression, récompenses, feedback, rituels, HUD).

## Les images disponibles pour les maquettes

`C:\Users\gaelm\AppData\Local\Temp\claude\C--Users-gaelm-Documents-GitHub-thebestfan\cdc72f2f-5e5a-438f-afe4-d9732321ca9d\scratchpad\maquettes\assets\`
(WebP, chemins relatifs `assets/<nom>` depuis le dossier `maquettes/`) :

- Fanzzy RP1 (plein-pied, détouré, fond transparent) : `RP1-e{1,2,3}-{neutre,
  joie,pousse,colere,depit,salut,but,victoire}.webp`, portrait :
  `RP1-e{1,2,3}-portrait.webp`, tenues : `RP1-e{1,2,3}-{halloween,apocalyptique,
  prehistorique}.webp`. Autres personnages : `TR1.webp`, `BG1.webp`, `EP1.webp`
  (+ `-buste`).
- Décors de carte (plaques de rareté, ratio 2:3) : `RP-{commune,rare,epique,
  legendaire}.webp`.
- Fonds : `tribune.webp` (photo de tribune), `accueil.webp`, `fond-tribune.webp`,
  `hero.webp`, `hero-portrait.webp`, `place-vide.webp`.
- Logo du jeu : `logo.webp`. Jetons : `echarpes.webp`, `billets.webp`.
  Emblèmes de rareté : `rarete-*.webp`. Dos de carte : `dos-RP.webp`.
  Paquets : `pack-la-tribune.webp`, `pack-les-epoques.webp`.
- Équipement (détouré) : `stuff-*.webp`. Cartes d'action (scènes 3:4) :
  `action-*.webp`. Stades vus du dessus : `stade-*-mini.webp`. Supporter
  générique : `supporter-{idle,push,goal,sad}.webp`.

Police : Oswald via Google Fonts (`https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&display=swap`).
Toute autre police doit venir de Google Fonts.

## Références de jeux (pour situer, pas pour copier)

Brawl Stars / Clash Royale (objets, relief, tons), EA FC Ultimate Team (cartes
joueur, HUD de match, packs), Marvel Snap / Hearthstone (cartes premium,
foil, ouverture), Pokémon TCG Pocket (ouverture de booster, collection),
Fortnite (passe de saison, quêtes), Mario Strikers / Rocket League (arcade),
esthétique ultras réelle (bâches, fumigènes, tifos, stickers, autocollants,
écharpes, marqueur, pochoir).
