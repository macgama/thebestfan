# Refonte gaming de thebestfan.online — synthèse de direction de création

Trois directions retenues sur cinq, amendées d'après les trois jurys (identité, faisabilité, UX gaming), une couche UX commune, une recommandation et une feuille de route où chaque étape se voit sur le téléphone d'un joueur.

Fichiers détaillés (même forme que les propositions d'origine, avec `amendements` et `greffes` en tête) :

- `direction-ultras-diy.json` — FAIT MAIN
- `direction-nuit-de-match.json` — NUIT DE MATCH
- `direction-tcg-premium.json` — LA CARTE EN MAIN

---

## 1. Le constat en dix lignes

1. Le hub est déjà un écran de jeu (personnage géant, dix tuiles en relief, jetons, grand bouton rouge) ; les 23 autres écrans sont des listes sobres posées sur une photo : titres Oswald, texte gris à 42–62 %, panneaux plats.
2. La grammaire d'objet existe dans `ui.css` (plaque, tuile, cadre, étiquette, onglets, écharpe, coin coupé, tons par destination) et n'est employée que sur le hub ; chaque page garde ses boutons maison (`.gros`, `.buy`, `.dbtn`, `.bt`, `.filt`, `.vitr-*`) sans cerne ni tranche.
3. La progression est servie par le serveur (`/api/niveau`, `/api/aide/parcours`, `/api/fanzzy/bibliotheque`) et n'est visible nulle part : l'XP vit dans un attribut `title`, la collection est une jauge à 2 % sans palier, le niveau un chiffre de 10 px.
4. Aucun HUD hors du hub : le kiosque dépense des écharpes sans montrer le solde ; la fiche vend une évolution à 25 écharpes sans dire qu'on en a 40.
5. Le « juice » existe dans `fx.js` (particules, onde, flash, secousse, sons, vibrations) et dort : le hub n'appelle FX qu'au but, la collection jamais, le tiroir jamais. `FX.nombre` n'est pas un compteur, c'est un « +N » qui s'envole.
6. Les récompenses sont fugaces et textuelles : « +12 écharpes en doublons » en 11 px, une carte-souvenir qui est un panneau de texte de 4,2 s, un verdict PARFAIT écrit dans une fenêtre qui se ferme à l'instant.
7. Les deux arènes ne parlent pas la même langue (rail vertical + disque chiffré au Virage, corde de 3 px + territoires au duel) et leur HUD est du texte de 8,5–9,5 px à 50 % — illisible au stade.
8. Aucun rituel : dix secondes d'ouverture sans mise en scène, pas d'affiche d'entrée au Virage, une boîte de dialogue pour sortir, un `location.reload()` après le bilan du duel.
9. Rien ne donne une raison de revenir demain : pas de saison affichée, pas de mission, pas de série de jours, pas de « depuis ta dernière visite » — et côté serveur, rien de tout cela n'existe encore.
10. Trois dettes visibles à corriger quelle que soit la direction : le premier bouton de `/bienvenue` rendu sans plaque, les couleurs par type qui contredisent la rareté, le décor absent de `/carnet` et `/teletext`.

---

## 2. Les trois directions

Trois réponses différentes à la même question « où va la richesse ? » : dans les **surfaces** (FAIT MAIN), dans la **lumière** (NUIT DE MATCH), dans l'**objet** (LA CARTE EN MAIN).

### A. FAIT MAIN — la bâche, le marqueur et le scotch

**Pitch.** Chaque écran est un pan de mur du kop, couvert de bâches tendues au scotch, de stickers collés de travers et de tickets déchirés ; tout ce qui compte (monnaie, niveau, rareté, verdict) est un objet que le kop a fabriqué à la main.

**Concept.** Quatre matières fabriquées remplacent le vocabulaire « plastique » actuel : la BÂCHE (toile pleine du ton, cerne au marqueur irrégulier en border-image SVG, ombre dure 4 px décalée, coin déchiré, deux scotchs) devient la plaque — donc tout ce qui se touche ; le STICKER (bord craie 2 px + cerne encre, ±4° de rotation) devient pastilles, badges, raretés, jetons et NOUVEAU ; le TICKET (papier kraft aux bords déchirés) porte les gains, la feuille de match, les lignes de parcours ; le TAMPON (Oswald en contour, −8°) dit les verdicts et les états acquis. Par-dessus, deux gestes de tribune : l'ÉCHARPE devient l'unique jauge du jeu (rail cerné, remplissage rayé, nœud de tête qui avance, crans) et le FUMIGÈNE (deux nappes radiales en screen dans le quart bas) signale les soirs de match et les célébrations. Le mur de béton reste le fond ; la photo de tribune se voit dans les interstices et reste vive sur le hub et les arènes.

**Palette.** Les huit jetons et les quatre hex de rareté inchangés ; trois ajouts : Parpaing `#232930` (face des panneaux calmes, opaque), Encre `#07090C` (cerne, ombre dure, texte sur craie), Kraft `#C9A66B` (fond des seuls objets en papier qu'on lit : ticket, page d'album, feuille de match — jamais un texte, jamais une jauge, jamais un jeton) ; Scotch `rgba(242,238,228,.42)`. L'or ne dit plus que trois choses : acheter, récompense prête, légendaire.

**Typographie.** Oswald 600/700 pour tous les titres, chiffres, scores et libellés, à 100 % de craie avec ombre dure 1 px encre. Deux effets sans police : le POCHOIR (mask-image qui coupe les lettres d'un pont à 48 % + bavure de bombe — à partir de 16 px seulement) et la DOUBLE IMPRESSION (décalage rouge/bleu à 40 %, réservé au moment fort). Une police d'appoint : Permanent Marker (400), auto-hébergée en woff2 sous-ensemble latin, pour les annotations courtes (≥ 15 px, quatre mots maximum, jamais un chiffre, jamais dans un panneau calme, jamais sur le rideau d'ouverture).

**Matières.** Bâche (plaque), sticker, ticket, tampon, scotch, bulle de BD, bouffée de fumigène (la fête ; le splat de peinture est supprimé), écharpe-jauge tricotée avec trait d'encre entre les couleurs, panneau calme parpaing opaque sans blur avec titre cousu, cadre principal unique par écran. Le coin déchiré est sur toute plaque, dessiné par un `::before` (jamais un clip-path, qui couperait l'ombre). Textures en tuiles WebP générées par sharp, jamais feTurbulence.

**Motion.** Tout objet fabriqué arrive « collé » (scale 1.08 → 1, ±3° → rotation de repos, 220 ms avec overshoot, stagger 60 ms plafonné à 12) ; les bâches s'enfoncent de 4 px + tic ; les stickers vibrent ±2° ; les tickets glissent du bas ; les compteurs comptent (FX.compter) et les gains volent (FX.voler) ; les crans de jauge claquent (scale 1.4 → 1) ; les célébrations = case de BD + bouffée de fumigène + confettis de papier déchiré ; la légendaire ajoute la fumée or plein écran ; le tampon claque en 3 temps (1.6 → 0.95 → 1). Reduced-motion : aucune entrée collée, aucun stagger, aucune dérive, jauges qui sautent, enfoncement remplacé par l'assombrissement.

**Composants clés.** HUD replié dans la barre (sticker-avatar 36 px avec anneau d'XP en trait de marqueur, jetons dépliés 3 s au toucher, cache 30 s) ; tiroir déroulé comme une bâche en grille de tuiles colorées ; tuile à quatre états (LIVE / PRÊT / VERROUILLÉ « NIV. 3 » / NOUVEAU « +12 ») ; carte-sticker (bord craie, cerne encre, nom en banderole inclinée, sticker de rareté en forme sur le coin coupé) ; formes de rareté rectangle / rond / étoile / éclat ; ticket de récompense unique ; pavé de geste en bâche craie ronde avec tampon de verdict.

**Écran par écran.**
- `/` : rideau = tunnel (la lumière du fond grandit 10 s, fumée rouge/or, cinq Fanzzy sur l'escalier, titre sur bâche craie, jauge-écharpe à trois libellés, « TOUCHE POUR ENTRER »). Hub : sticker-avatar avec anneau, jetons craie qui comptent, tuiles en bâches avec trois pastilles au plus, bâche aux couleurs du club derrière le personnage les soirs de match, bulle de BD contextuelle, jauge de collection à crans, LA BÂCHE DU JOUR (mission ou affiche du direct), bouton flare avec sous-libellé au marqueur, ticket de retour.
- `/fanzzy` : vestiaire (bandeau HUD 56 px, cadre-bâche de la rareté, stickers de stats, cri en bâche rayée) ; état vide = « TA PLACE EST VIDE » au marqueur sur un scotch + bâche or « OUVRIR MON PREMIER BOOSTER » ; classeur = album de stickers par série (scroll-snap, en-tête aux couleurs c1/c2, cases pointillées numérotées, NOUVEAU rouge, vitrine des légendes).
- `/fanzzy/:id` : carte en main inclinable, cri en bâche, inventaire en tuiles-bâches, arbre d'évolution en corde à nœuds, fiche kraft de stats, ÉVOLUER en bâche or avec prix en sticker, non possédé = pochoir sous scotch en croix + vignette du paquet + « 1 CHANCE SUR 3 ».
- `/boosters` : kiosque avec HUD (fentes, écharpes, avatar), banderole de saison, trois sachets, rail des séries fermées sous scotch, minuterie-objet + bâche or « 45 », déchirure conservée, ouverture avec fentes de dos et sticker de rareté par révélation, butin sur page d'album kraft avec jauge de série et écharpes qui volent, fin en trois bâches.
- `/boutique` : « À LA UNE » sur bâche kraft, rayons en onglets or, stickers de rareté filtrants, étiquettes de marché, « À PORTÉE » cerné, cérémonie d'achat sur calque fixe (tampon « À TOI ! »), cabine d'essayage, pass de tribune.
- `/virage` : tunnel de choix avec affiches à écharpe de club et foule pochoir ; tribune = deux bâches de club face à face, score de corde en banderole, corde tressée avec foulard, lignes de but en scotch, foules pochoir en push, Fanzzy mains sur la corde, souffle en écharpe graduée, ferveur à paliers, main en éventail (±6°), tampon de verdict, carte-souvenir qui se retourne, minute double en or, bilan sur page kraft. Budget écrit pour 360×640.
- `/duel-nvn` : préparation = choisir son combat (affiche, formats en tuiles à silhouettes, camp = tribunes qui s'allument, sans deck = trois places vides + bâche bleue), vestiaire à sièges, affiche enrichie, HUD partagé avec le Virage, effets-objets sur l'arène, équipe en trois cartes-stickers, bilan = page kraft avec écharpes qui tombent et XP fusionnée.
- `/collection` : album à niveau de collectionneur (anneau sur l'atteignable, titre de palier), cinq tuiles-bâches, pages par série, planches d'états/tenues, vitrine conservée avec pile de dos derrière.
- `/profil` : carte de supporter (plaque de rareté du Fanzzy, écharpe du club, tampon VÉRIFIÉ), stats en stickers, niveau en corde à nœuds, parcours en tickets déchirés avec tampons GAGNÉ/PERDU, réglages repliés derrière une bâche parpaing.
- `/classement` : mur d'honneur (podium en trois bâches or/craie/parpaing, lignes calmes avec ▲ delta, ma ligne épinglée en ticket, divisions en écharpe à 1–4 nœuds).
- `/kop` : bâche aux couleurs du club avec tribune qui s'allume, pot en écharpe épaisse à jalons-objets, membres en bustes en tribune, vote en case de BD avec fumée.

**Ce qui change / ce qui reste.** Change : la matière de tout ce qui se touche (bâche au lieu de plaque plastique), le dépoli → parpaing opaque, pastilles/badges → stickers, verdicts → tampons, toasts → tickets, toute jauge → écharpe nouée, les formes de rareté, la fin du texte gris. Reste : les huit couleurs et leurs noms, les hex de rareté, Oswald en banderole, l'écharpe (qui s'étend), le ton par rangée, « .pan reste calme », la case de BD, la photo de tribune, le hub sans défilement à ≥ 60 %, toutes les classes et attributs interrogés par le JS, les conteneurs innerHTML, cardHTML, fx.js, geste.js, la déchirure du booster.

**Risques.** Le « mur de stickers » (tenu par une règle chiffrée : une bâche grande, trois stickers hors listes, un ticket, une nappe par écran, et l'audit) ; la lisibilité du marqueur (≥ 15 px, jamais un chiffre, variable `--tbf-diy: 0` pour couper rotations et marqueur) ; le kraft voisin de l'or (kraft réservé aux fonds papier avec texte encre) ; les rendus innerHTML à 10 Hz (nœuds stables, rendus à clé) ; « trop punk » pour une partie des joueurs — à tester sur deux écrans avec des joueurs avant de généraliser.

**Effort.** 42 à 48 jours-personne en sept lots livrables séparément (lot 0 hygiène 3 j, fondation ui.css 4 j, hub/tunnel/barre 4 j, économie 5 j, collection 8 j, social 5 j, arènes 12 j en trois temps, images et audit 4 j), plus 10 à 12 jours serveur en parallèle.

### B. NUIT DE MATCH — projecteurs, fumigènes et tableau d'affichage

**Pitch.** Chaque écran est une tribune un soir de match : les projecteurs éclairent par le haut, les fumigènes colorent par le bas, et tout ce qui compte s'écrit en chiffres de tableau d'affichage qui ne changent jamais sans compter sous les yeux.

**Concept.** Trois sources de lumière et rien d'autre n'a le droit de briller : deux cônes de projecteur fixes depuis les coins hauts (filet froid des plaques, ellipse sous les pieds du Fanzzy), deux nappes de fumigène dans le quart bas au ton de la destination (qui prennent les couleurs du club suivi les soirs de match, immobiles sur les écrans à listes), et le tableau d'affichage (verre noir opaque, chiffres Oswald tabulaires en Craie LED ou dans le ton, qui comptent via FX.compter). Un seul objet allumé par écran : celui qui est « prêt » ou « en direct ». La plaque, l'écharpe et le coin coupé gardent exactement leur géométrie ; la nuit et le compteur sont la couche ajoutée. Un mode jour (match avant 18 h, `prefers-contrast`, réglage du tiroir) éteint les cônes, densifie le voile et coupe les halos : la lumière suit l'heure du vrai match, pas une esthétique.

**Palette.** Huit jetons et quatre raretés inchangés ; ajouts : Nuit `#05070C` (fond sous toute chose), Verre de nuit `rgba(6,10,15,.92)` (panneau calme opaque, sans blur), Craie LED `#FFFBEF` (la seule couleur de lumière du tableau, ombre dure sous le halo), Cendre `#AEB7C4` (texte secondaire à 100 %), Lumière projo `#CFE3FF` (filet des plaques). Les cinq « néons » de la première version sont supprimés : ils entraient en collision avec les hex de rareté.

**Typographie.** Oswald seule, pour les mots et les chiffres (tabular-nums déjà dans ui.css, largeur minimale en `ch` après `document.fonts.ready`). Teko est abandonnée. Tailles de chiffres : 15 en étiquette, 20–22 dans le HUD, 30–34 pour un score, 46 pour un écart de corde, 64 pour un compte à rebours. Corps 12,5 px minimum en Cendre à 100 %.

**Matières.** Plaque sous projecteur (géométrie inchangée, filet froid, états `data-etat="pret"` = filet or + halo fixe, `"direct"` = pip 7 px) ; tableau d'affichage ; écharpe en ligne de tribune (4 px sur la barre de chaque page, aux couleurs des deux clubs pendant un direct, reflet qui la balaie) ; panneau calme opaque avec titre cousu ; carte avec bandeau de nom en verre noir + halo + forme de rareté ; corde tressée en CSS avec foulard teinté ; foules en `<pattern>` SVG ; bâche craie de −1° pour les titres de section.

**Motion.** Chaque page s'allume en 400 ms ; l'onglet actif glisse ; aucun chiffre ne change sans compter (flash Craie LED 120 ms, « +N » qui monte, gain qui vole 700 ms depuis sa source) ; but = FX.but + vignette + fumée à 70 % dans la couleur du club + cônes qui flashent ; échelle de cérémonie unique par rareté ; minute double = HUD de corde, corde et fumée à l'or avec anneau 60 s (pas tout l'écran) ; verdict en case BD miniature 600 ms avant la fermeture puis sur la carte jouée. Reduced-motion : nappes immobiles, pips fixes, compteurs qui sautent, seules les barres de temps restent animées. Mode calme dans le tiroir.

**Composants clés.** Le tableau (barre 44 px, HUD replié = anneau d'XP seul, cache 30 s ; tableau d'économie de 44 px sous la barre sur les quatre écrans qui dépensent ; bande de match hors `#app` sur deux rangées dans les arènes qui absorbe les boutons flottants et le bouton son) ; tiroir en plan de stade (grilles de mini-tuiles au ton avec chips) ; tuile à quatre états ; tube à crans avec tuile de récompense sur le cran suivant et double miroir ; synthé de gain (bandeau + montant qui compte + vol) distinct de l'erreur (étiquette statique) ; compteur en case de tableau ; médaillon avec anneau ; pavé-objet.

**Écran par écran.**
- `/` : ouverture-tunnel (voile radial par scale d'un pseudo-élément, Fanzzy sur les marches, écharpe à trois libellés, « CE SOIR : 3 MATCHS DE TES CLUBS ») ; hub à bande de 48 px avec pliage écrit (fentes → chiffre, série → bulle), bulle du Fanzzy, tuiles à états (trois pastilles au plus, un seul objet allumé), cadres du bas gelés (COLLECTION = chiffre + tube 8 px ; AUJOURD'HUI = affiche du direct ou prochain coup d'envoi ou mission), CTA à sous-libellé, ticket de la veille.
- `/fanzzy` : vestiaire avec tableau d'économie, cadre à écharpe de série et halo de rareté, bloc de stats, cri en bâche ; état vide = plaque or PRÊT « OUVRIR MON PREMIER BOOSTER » ; album par série (scroll-snap, pages ±1, pochettes « N° 013 », NOUVEAU, vitrine des légendes).
- `/fanzzy/:id` : tableau d'économie avec « 40 → 15 » au toucher long, budget de hauteur écrit (414 px fixes, carte ≥ 200), carte inclinable, inventaire de 96 px à onglets cousus, arbre d'évolution au nœud suivant allumé, convoitise avec « 1 SUR 3 » et vrai lien vers /boosters.
- `/boosters` : kiosque de nuit (fentes en mask-image, anneau de recharge, saison en bâche, sachets verrouillés « FERMÉE » sans date serveur, minuterie-objet qui devient le seul objet allumé), ouverture avec halo qui monte avant le flip et bandeau Oswald 34 de rareté, butin avec tube de série et écharpes qui volent, trois plaques de suite.
- `/boutique` : deux écrans (à la une sous cône, rayons en onglets or, formes de rareté filtrantes, « À PORTÉE » sur le premier objet seulement, silhouettes pochoir pour le non dessiné, cérémonie d'achat, cabine corrigée, pass).
- `/virage` : tunnel de choix avec affiches et frises SVG ; tribune sur deux rangées de HUD hors `#app`, arène à 42 % (corde tressée verticale, foulard, lignes de but, frises en push, Fanzzy sur la corde), souffle en plaque bleue graduée, ferveur à paliers, éventail ±6°, verdict en tampon, carte-souvenir qui se retourne, bilan. Budget 360×640 : 579 px + safe-area.
- `/duel-nvn` : choisir son combat (affiche, formats, camp = stade-mini qui s'allume, sans deck = trois sièges + plaque bleue), vestiaire, affiche enrichie, duel sur le même HUD, effets en rail de chips ET objets sur l'arène, équipe en trois cartes, bilan-récompense (lignes qui comptent à 700 ms, TOI vs LUI en double miroir, XP fusionnée, sans rechargement).
- `/collection` : L'ALBUM (anneau de collectionneur sur l'atteignable, cinq tuiles de chaîne, même composant d'album que le classeur, planches, vitrine conservée). Pas de tableau d'économie.
- `/profil` : carte de joueur sur la plaque de rareté du Fanzzy sous cône, stats en étiquettes qui comptent, chemin de saison, sièges de clubs, feuilles de match, réglages repliés.
- `/classement` : podium sous trois cônes, deltas ▲/▼, ma ligne épinglée, divisions en écharpe à nœuds (jamais les couleurs de rareté), onglets au ton.
- `/kop` : bâche aux couleurs du club, pot en tube à jalons avec le prochain palier comme seul objet allumé, membres en bustes, vote en vignette BD avec double miroir.

**Ce qui change / ce qui reste.** Change : le fond (voile 55 % sur les écrans à personnage, opaque ailleurs, cônes, fumée, mode jour), la règle des chiffres, le HUD (tableau + économie + bande de match sur deux rangées), les états lumineux (un seul allumé), le panneau opaque, les onglets au ton, DECK sorti du rail, la carte avec halo et forme, les arènes unifiées, l'album, la fiche budgétée, le profil, le classement, le KOP, le moment fort unifié. Reste : la plaque intacte (cerne, tranche 5 px, coin coupé, radius 13, enfoncement), les huit jetons, les raretés, Oswald seule, l'écharpe, « .pan reste calme », la vignette BD, la photo, fanzzy-scene, fx.js, geste.js, cardHTML, la décision de nav.js (anneau seul dans la barre), le hub sans défilement.

**Risques.** Écran sombre au soleil (garde-fous mesurés par un mode `--jour` de l'audit ; aucun texte à même la photo) ; trop d'objets allumés (règle « un seul », tenue par l'audit) ; performance (aucun backdrop-filter, nappes immobiles hors hub/arènes, halos fixes en grille, ≤ 3 animations infinies) ; le hub à 48 px vérifié à 360×640 ; images du tunnel et de la tribune de nuit exposées aux écussons spontanés ; le mode jour double les captures à valider.

**Effort.** 9 à 10 semaines client (lot 0 hygiène 3 j ; matière 2 sem. ; écrans qui possèdent et dépensent 3 sem. ; arènes 3 sem. en trois temps ; images et audit 1 sem.), ou 6 semaines si les arènes se limitent au HUD, à l'éventail et au tampon ; plus 3 à 4 semaines serveur en parallèle.

### C. LA CARTE EN MAIN — jeu de cartes de tribune

**Pitch.** Autour, la tribune calme et lisible ; au centre, une vraie carte de collection qu'on incline, qui prend la lumière selon sa rareté, qu'on retourne, qu'on colle dans un album qui se feuillette — tout le soin va à l'objet qu'on possède, jamais à l'écran qui l'entoure.

**Concept.** Un album de supporter posé dans une tribune de nuit (le béton et la photo assombrie, comme aujourd'hui ; l'écrin de velours de la première version est retiré). Chaque écran a la même scène : la photo, un cône de projecteur de stade sur un seul objet, et cet objet est une carte. La carte Fanzzy (2:3, coins ronds) porte trois couches : plaque de rareté, illustration, matière pilotée par le doigt — carton d'affiche mat (commune), bâche plastifiée à reflet froid (rare), lueur de fumigène en screen (épique), or de trophée gaufré à rayons (légendaire). Elle s'incline de ±12°, se retourne quand la page le demande, se colle dans un album à pages par série avec le ruban d'écharpe de la série sur la tranche et une pochette numérotée pour chaque manquante. Autour, la grammaire existante reste intacte mais passe en demi-teinte : aucune plaque ne brille, l'œil va à la carte. Le personnage reste le sujet du hub (l'appui long qui retournait la scène est supprimé).

**Palette.** Les huit jetons et les quatre raretés, plus Papier `#EFE6D2` (bande de nom, carte de membre, tickets) et Encre `#14110D` (cerne des cartes, tampons). Un seul or `#F5C33B` (l'« or satiné » de la première version est abandonné : personne ne distingue deux ors au soleil).

**Typographie.** Oswald seule, y compris sur l'objet collectionné : nom du Fanzzy sur bande papier (700, 15 px minimum, 22 en vitrine), numéro de pochette (12 px), nom du joueur sur la carte de membre. Playfair Display est abandonnée (illisible à 15 px au soleil, registre « Vogue » sur un objet qui doit dire « tribune »). Rien d'informatif sous 11 px ni sous 85 %.

**Matières.** La carte (objet possédé : coins ronds) contre la plaque (commande : coin coupé) — sémantique écrite dans ui.css ; plaque demi-teinte (tranche 4 px, dégradé vertical ±8 %) ; l'écharpe garde 6 px en tête des cadres, 24 px pour le cri et devient la jauge du jeu (nouée, à crans avec vignette de récompense ; fine pour le souffle ; anneau pour l'XP ; épaisse pour le pot ; double miroir) ; panneau carton mat sans flou avec titre cousu, fil d'or sur le seul panneau principal ; pochette numérotée, pastille ronde craie pour les coûts (le cachet de cire est abandonné), tampon plein sous 16 px, ticket perforé, médaillon, bulle.

**Motion.** Les cartes se distribuent (translateY 24 → 0, −4° → 0, 220 ms, stagger 40 ms plafonné à 12, au premier rendu et à l'ajout seulement) ; inclinaison au doigt avec ressort 300 ms (le capteur d'orientation est un réglage du tiroir, désactivé par défaut) ; retournement opt-in 600 ms ; échelle de cérémonie par rareté identique partout ; tickets qui comptent puis volent ; jauge-écharpe qui se remplit avec cran qui claque ; au plus trois cartes en matière animée à l'écran, foil statique en grille. Reduced-motion : bascule d'opacité, rareté lisible par le cadre, la forme et l'étiquette toujours présente.

**Composants clés.** Médaillon (zone de touche 44 px, réglette de jetons dépliée 3 s), tiroir en album ouvert, carte cardHTML redessinée une fois avec écran de test (après correction de cinq `.calc(` invalides dans cartes.css), carte d'action/chant avec pastille de coût et cadran, jauge-écharpe, onglets d'album de 44 px sur la tranche, vitrine comme modale commune, ticket contre toast, formes de rareté, pavé-objet.

**Écran par écran.**
- `/` : ouverture avec la carte du Fanzzy équipé qui se retourne (dessinée en carte légère depuis localStorage), écharpe qui se noue, « TOUCHE POUR ENTRER » ; hub avec médaillon 44 px, jetons qui comptent, tuiles à quatre états en demi-teinte, personnage sous cône avec bulle, COLLECTION en éventail des trois dernières cartes + jauge-écharpe à crans, AUJOURD'HUI à cinq états (direct / prochain coup d'envoi / mission / premiers pas / répéter un geste), CTA à sous-libellé.
- `/fanzzy` : vestiaire = la carte en grand inclinable sous cône avec verso de stats, bâche du cri, deux plaques ; état vide = pochette de 220 px + banderole « TA POCHETTE EST VIDE » + plaque or ; classeur = album (jauge-écharpe à crans, pins de famille, pages par série montées ±1, intercalaires 44 px, pochettes « N° 013 », légendaire double largeur).
- `/fanzzy/:id` : budget 370 px fixes (carte ≥ 270), carte inclinable à bande papier, cri 28 px, inventaire 96 px à onglets, arbre d'évolution, détail en jauges, actions hiérarchisées, non possédé = pochette givrée + vignette du paquet + « 1 chance sur 3 » + plaque or.
- `/boosters` : bandeau 44 px (fentes en mask-image, anneau de recharge, écharpes, prix), banderole de saison, trois sachets, sachets verrouillés, deux objets (plaque flare / minuterie-objet), déchirure intacte + nappe de fumigène, ouverture par pile de dos avec fentes qui se retournent, butin sur page d'album avec jauge de série et ticket, trois plaques.
- `/boutique` : à la une sous cône, rayons en onglets or, formes filtrantes, cartes d'objet 3:4 sur plaque de rareté avec pastille de prix, cérémonie d'achat, cabine (bug de résolution corrigé), pass en carte de membre CSS.
- `/virage` : tunnel de choix, HUD hors `#app` sur deux rangées (bâches de club, score sur bande papier, phase, feuille de match en étiquette), arène à 42 % avec corde tressée, foulard, foules SVG, Fanzzy sur la corde, souffle en écharpe fine graduée, ferveur à paliers, éventail ±6°, verdict tamponné, souvenir en carte, bilan.
- `/duel-nvn` : choisir son combat sur la photo à 80 %, pochettes vides sans deck, vestiaire à sièges, affiche enrichie, duel sur le même HUD, effets-objets et chips, équipe en cartes mini, bilan en trois tickets à 700 ms + double miroir, sans rechargement.
- `/collection` : L'ALBUM avec anneau-écharpe de collectionneur, cinq grandes tuiles, un seul composant `.tbf-classeur`, planches, vitrine conservée avec pile de dos.
- `/profil` : carte de membre 8:5 en CSS (carton d'abonné + écharpe du club + coin usé en mask) inclinable avec verso de soldes, sièges de clubs, anneau d'XP et chemin de saison, parcours en mini-affiches à tampons pleins, réglages repliés.
- `/classement` : podium en trois cartes de membre miniatures sur plaques or/craie/béton, lignes calmes avec deltas, insigne d'écharpe à nœuds, ma ligne épinglée.
- `/kop` : bâche à écharpe du club sur stade-mini, pot en écharpe épaisse à jalons avec le prochain en plaque or, membres en médaillons, vote en case de BD avec double miroir, catalogue en cartes 3:4.

**Ce qui change / ce qui reste.** Change : les quatre raretés en matières de tribune, la carte redessinée une fois (coins ronds, bande papier Oswald, forme, pips, numéro, foil, retournement opt-in), les listes en albums, la fiche en carte inclinable budgétée, la vitrine comme modale du jeu, les arènes unifiées, le médaillon, la jauge-écharpe, les tickets qui comptent, les tampons, la carte de membre, le podium. Reste : Oswald seule, l'écharpe à pleine épaisseur, le coin coupé sur toute commande (la règle possédé/commande est dite), l'or unique, les tons, la case de BD, « .pan reste calme », la photo de tribune sur tous les écrans, le personnage au centre du hub, la déchirure, le flip, la vitrine, fanzzy-scene, tous les identifiants JS.

**Risques.** Performance de la matière (trois cartes animées au plus, foil statique en grille, pages ±1, buste en mini, repli `.tbf-lowfx`) ; cardHTML partagé par six écrans (écran de test d'abord) ; sobriété qui pourrait éteindre le hub (tuiles aux tons pleins, photo à 45 %, cône et halo conservés — capture avant/après du hub en premier) ; doublon fiche/vitrine maintenu (fusion des routes hors périmètre) ; images de boutique manquantes ; dépendance serveur de la boucle de rétention.

**Effort.** 12 à 14 semaines client (lot 0 1 sem. ; matière 2 ; économie 1,5 ; collection 2,5 ; arènes 4 en trois temps ; social 1,5 ; images et mesure 1), plus 3 à 4 semaines serveur en parallèle.

---

## 3. Les deux directions écartées, et ce qu'on leur a pris

**MULTIPLEX (broadcast-ultimate, 20/30).** Cohérente et techniquement lucide, mais elle installe le joueur devant la télé alors que le jeu le met dans la tribune : régie, bug, synthé, ticker, ON AIR, kicker, carte notée FUT avec codes à trois lettres, écharpe réduite à des barres de score bug, coin coupé noyé dans un rayon 6 « parce que la TV est carrée », corde devenue barre de possession. Identité 5/10. Pillée : la couche CHIFFRES entière (FX.compter, FX.voler, lignes de bilan qui comptent), le synthé de gain, la barre de stats à crans avec récompense sur le cran suivant et sa double miroir, le cadran de recharge, la règle « une ligne sans donnée disparaît, jamais un tiret », le tiroir en lignes tonales avec chips, le HUD de match hors `#app` qui absorbe les boutons flottants, les effets en cours doublés (chips + objets sur l'arène), l'ouverture qui affiche le programme du soir pendant l'attente. Tout cela est dans NUIT DE MATCH et dans la couche transversale.

**TOON BRAWL (19/30).** Sa prémisse (« une boîte de jeu Brawl Stars en plastique cerné d'encre ») est exactement la grammaire commune que `ui.css` dit vouloir dépasser, et ses contours d'encre 3–4 px jurent avec 200 Fanzzy rendus en 3D doux sans trait ; Lilita One sur le GOAL !, le coffre au trésor et le trophée en plastique n'ont aucun référent de tribune ; quatre tons saturés avec encre claire passent sous 3,1:1 de contraste. Pillée : l'écharpe tricotée (trait d'encre entre les couleurs, franges), la bulle du Fanzzy (TBF_BULLE), le titre cousu, le tambour du geste, le mode calme, le Fanzzy à 200 px sur chaque état vide. Tout cela est dans les trois directions.

---

## 4. La couche UX gaming transversale

Ce qui rend le jeu plus « jeu » quelle que soit la peinture. Chaque mécanisme dit s'il est purement front (données déjà servies) ou s'il demande une route serveur (et alors ce que le client affiche en attendant : rien, jamais un tiret).

| # | Mécanisme | Ce qu'on dessine et code | Serveur ? |
|---|---|---|---|
| 1 | **Rituel d'entrée : le tunnel** | Le voile radial de l'ouverture s'ouvre sur 10 s (scale d'un pseudo-élément, pas d'animation de gradient), les cinq Fanzzy montent les marches et le dernier salue, la jauge est une écharpe qui se noue avec trois libellés (ON OUVRE LES GRILLES → LES TRIBUNES SE REMPLISSENT → COUP D'ENVOI), « TOUCHE POUR ENTRER » clignote dès 1,2 s, une astuce du jour écrite en dur, « CE SOIR : 3 MATCHS DE TES CLUBS » dès que `/api/virage/live` répond. Le même tunnel ouvre le voile de choix du Virage ; l'entrée en arène est une affiche de 3 s (bâches qui se posent, foule qui compte de 0 à 298, Fanzzy qui salue). Muet (pas de geste encore). | Non |
| 2 | **Boucle quotidienne : le prochain coup d'envoi** | Le cadre AUJOURD'HUI du hub, l'état vide du Virage et `/equipes` montrent « PROCHAIN COUP D'ENVOI · SAM 21:00 » avec un compte à rebours calculé depuis `/matchs`. Le calendrier réel du football est la raison de revenir, à coût nul. Cinq états écrits pour le cadre : direct / prochain coup d'envoi / mission / premiers pas / « RÉPÉTER UN GESTE › ». | Non |
| 3 | **Boucle quotidienne : missions et bonus du jour** | `/aide` renommé MISSIONS avec un rail PREMIERS PAS / DU JOUR / DE LA SAISON / QUESTIONS, le sachet visible à droite de la jauge, un geste « RÉCUPÉRER » en plaque or à la place du versement silencieux, chaque étape avec vignette pleine, cadenas, tampon FAIT et récompense unitaire ; sur le hub, la mission du jour avec jauge et gain ; à la première visite du jour, une plaque or « RÉCUPÉRER » dont le gain vole vers le compteur. | Oui : missions du jour, réclamation, bonus quotidien, série de jours (« J3 »). En attendant, `/api/aide/parcours` tient la place pour les nouveaux. |
| 4 | **Progression : le niveau partout** | Anneau d'XP en `stroke-dasharray` autour de l'avatar (hub 44 px, barre 32 px dans une zone de 44 sur vingt écrans, profil 64 px) rempli à `niv.dans/niv.pour` avec cache sessionStorage 30 s ; tuiles verrouillées avec cadenas SVG et « NIV. 3 » (paliers de `shared/niveau.js`) ; chemin de niveau du profil avec le pictogramme de ce que chaque marche ouvre ; fête de niveau appelée aussi depuis `/virage` et `/profil` (mémoire locale du dernier niveau vu), avec le Fanzzy en pose victoire et le chiffre qui compte. | Front. Le serveur devrait en plus renvoyer l'XP courant et le seuil dans les résultats de booster et de duel pour animer la jauge (sans la donnée, la ligne n'apparaît pas). |
| 5 | **Progression de collection** | Niveau de collectionneur qui ne compte que l'atteignable aujourd'hui (personnages des séries ouvertes + actions ; états et tenues en « bonus ») ; jauge à crans tous les 25 avec la vignette de ce que le cran ouvre ; pochette numérotée « N° 013 » pour chaque manquante ; page par série avec « 12/40 » ; « NOUVEAU » sur ce qui est arrivé depuis la dernière visite (ids vus en localStorage) et « +3 » sur l'onglet. | Front. Serveur ensuite : drapeau « vu » synchronisé entre appareils (en tête de liste), paliers récompensés, récompense et événement « série complète », date d'obtention. |
| 6 | **Récompense : le gain qui atterrit** | Deux helpers à écrire dans `fx.js` : `FX.compter(el, de, a, ms)` (tween rAF sur textContent, tabular-nums, saut direct en reduced-motion) et `FX.voler(source, cible, jeton)` (nœud sur body, WAAPI 700 ms vers `getBoundingClientRect` de la cible). Puis un seul objet de gain (ticket ou synthé selon la direction) : le chiffre compte, vole vers le compteur du HUD qui flashe une image ; les lignes d'un bilan comptent l'une après l'autre à 700 ms ; une dépense fait descendre un « −25 ». Le toast ne porte jamais un chiffre de gain ; l'erreur est statique. | Non |
| 7 | **Échelle de cérémonie par rareté** | Une seule fonction `FX.reveler(rar, el)` : commune = retournement ; rare = balayage 400 ms + tic ; épique = nappe 700 ms + 24 particules + carillon + vibration 14 ms ; légendaire = flash 200 ms + rayons + secousse + rugissement + tampon « LÉGENDAIRE » + vibration [40,30,90]. Cartes d'un paquet triées par rareté croissante, lueur de rareté sur le dos avant le flip. Raccordée sur `/boosters`, `/bienvenue`, `/collection`, l'achat et l'évolution. Fin de cérémonie en trois plaques (ENCORE UN / VOIR LE CLASSEUR / MONTER MON DECK). | Non |
| 8 | **Feedback du geste** | Le pavé `.pad` refait une fois dans `ui.css` pour les trois arènes (cerne, tranche, enfoncement de 4 px + tic sur les gestes de frappe seulement ; jamais de déplacement sur les épreuves positionnelles ; aucun juice par frappe sur martelage/salves). Le verdict PARFAIT / BON / MOYEN / RATÉ claque en case BD miniature au centre du pavé 600 ms avant la fermeture de `.mini`, puis sur la carte jouée 900 ms. Combo « 3 PARFAITS » compté localement depuis `virage:result.quality` et `nvn:events`. Une carte trop chère se givre et dit « −8 » au lieu de passer à 32 %. | Front. Serveur ensuite : série officielle et meilleur geste du match pour le bilan et le profil. |
| 9 | **HUD en match** | Une bande hors `#app` (z 96) sur deux rangées qui absorbe les boutons flottants de nav.js et le bouton son (classes `.tbf-retour/.tbf-burger` et `data-quitter-*` conservées) : deux bâches de club aux couleurs API (via `FX.lisible`), score de corde en banderole entre elles, terrain en étiquette fine (les deux scores séparés par la matière, pas par un mot de 9 px), phase en étiquette, minute double qui passe HUD, corde et fumée à l'or avec anneau 60 s. Une seule corde pour les deux arènes (tressée, foulard noué aux couleurs de camp, lignes de but en bandes, même objet tourné de 90°). Foules en `<pattern>` SVG qui passent en push sur `rally/sync`. Souffle gradué aux coûts des cinq cartes en main. Ferveur en jauge à paliers où atterrissent les `FX.points`. Effets en cours en rail de chips ET en objets sur l'arène (bâche devant la tribune, brouillard, cadenas sur la main, bouche barrée). Rendus à clé dans `renderActes()` et `rendreDuel()` (`#effets/#equipe/#mainCartes`). Budget de hauteur écrit pour 360×640. | Front (fixture, rope, crowd, breath, ferveur, rank, cards, effets sont déjà envoyés). Serveur ensuite : paliers de rang, souvenirs du match, bilan de tribune. |
| 10 | **Rituel de sortie** | Le Virage reçoit un bilan sur le modèle du duel au lieu de « QUITTER ? » ; le bilan du duel devient un écran de récompense (compteurs qui montent, XP fusionnée avec la fête de niveau au lieu d'arriver 1,4 s après, Fanzzy en pose, REJOUER / REVENIR sans `location.reload()`) ; la répétition termine par un tampon et « LE JOUER EN DUEL ». | Front pour la structure. Serveur : bilan de tribune du Virage, cote avant/après, série, meilleur geste. |
| 11 | **Social et KOP** | Le Fanzzy de chaque joueur (buste sur anneau de rareté + niveau) dans le classement, le podium, les amis, les membres du KOP, la salle d'attente ; pastille de présence (au stade / en duel / hors ligne) ; « NOUVEL AMI » fêté ; le KOP a une bâche aux couleurs du club (sans logo), un pot en jauge à jalons-objets (particules + son au franchissement, comparaison avant/après `rendre()`), un vote en case de BD avec chrono et double barre miroir, une tribune qui s'allume proportionnellement au pot ; entrer dans un KOP = « TE VOILÀ DANS LES ULTRAS ». `/amis` repasse au violet. | Serveur : `avatar` dans `/api/rank/*`, les membres de KOP et la ferveur par compétition ; présence par socket. Le reste est front. |
| 12 | **Rétention** | Ticket « DEPUIS HIER : +2 souvenirs · +120 écharpes · Lucas t'a rejoint » qui glisse 3 s au lever du rideau ; « SAISON 1 · 12 jours » sous les titres du classement, du kiosque et de la préparation de duel, banderole de saison au kiosque, sachets verrouillés « SAISON 2 », récompense de fin de saison en dos de carte ; série de jours dans la bulle du Fanzzy. Côté front sans route : la fumée et le décor aux couleurs du club suivi les soirs de match (`/api/virage/live`), la tribune vide les jours sans match. | Serveur : depuis-la-dernière-visite, saison (date de fin, récompense), série de jours. Sans route, rien n'est affiché. |
| 13 | **États vides = actions** | Aucun écran vide n'est un paragraphe gris : « PROCHAIN COUP D'ENVOI · dans 2 h 14 » + RÉPÉTER EN ATTENDANT / SUIVRE UN CLUB (`/virage`) ; « TA PLACE EST VIDE » + OUVRIR MON PREMIER BOOSTER (`/fanzzy`) ; « TA PLACE EST LÀ » + ENTRER DANS LE VIRAGE (`/classement`) ; trois places vides + CONSTRUIRE MON DECK (`/duel-nvn`) ; « UN KOP, C'EST UN CLUB » + SUIVRE UN CLUB (`/kop`) ; le Fanzzy à 200 px avec sa bulle sur chacun (place-vide.webp). | Non |
| 14 | **Tuiles à états et pastilles qui disent quelque chose** | Quatre états en `::before/::after` pilotés par `data-etat` / `data-pastille` (compatibles avec les conteneurs réécrits en innerHTML) : MAT / PRÊT (pastille or fixe) / DIRECT (pip + minute) / VERROUILLÉ (cadenas + NIV.) ; récompense (or) contre catalogue (béton « +12 ») ; le « 5496 » disparaît ; trois pastilles au plus sur le hub ; le bouton menu porte chiffre et couleur d'urgence. | Non |
| 15 | **Socle de lisibilité et de calme** | Règles mesurées par `scripts/audit-ui.mjs` (à étendre : hauteur 640, seuil de police 11 px, mode `--jour` avec voile blanc 40 %) : ≥ 85 % d'opacité et ≥ 11 px pour tout ce qui informe, 55 % réservé au légal, jauges ≥ 10 px, aucun `backdrop-filter`, titres cousus à la place des h2 à 42 %, boutons locaux en `.tbf-plaque`, onglets au `data-ton` de l'écran, DECK sorti du rail avec ↗, cadenas SVG, « Installer l'application » dans le tiroir ; reduced-motion par composant (le mouvement part, l'information reste) ; mode calme (sons, vibrations, animations décoratives) dans le tiroir ; « une ligne sans donnée disparaît, jamais un tiret ». | Non |

**Ce que le serveur doit exposer, par ordre de rendement** (chaque écran fonctionne sans, avec son repli) : (1) XP courant + seuil dans les résultats de booster et de duel ; (2) drapeau « vu / nouveau » par carte ; (3) `avatar` (Fanzzy, âge, rareté, niveau) dans `/api/rank/*`, les membres de KOP et la ferveur par compétition ; (4) delta de rang et cote avant/après ; (5) paliers de collection et de rang, avec leurs gains ; (6) missions du jour, réclamation, bonus quotidien, série de jours ; (7) saison (nom existe : date de fin, prochaine ouverture, récompense) ; (8) « depuis la dernière visite » ; (9) présence par socket ; (10) bilan de tribune du Virage, souvenirs du match, meilleur geste. Environ trois à quatre semaines, en parallèle du client.

---

## 5. Tableau comparatif

| | FAIT MAIN | NUIT DE MATCH | LA CARTE EN MAIN |
|---|---|---|---|
| Où va la richesse | Les surfaces (bâche, sticker, tampon, ticket) | La lumière et les chiffres (projecteurs, fumée, tableau) | L'objet (matière de carte, album, cérémonie) |
| Note des jurys (identité / faisabilité / UX) | 8 / 7 / 7,5 = **22,5** | 7 / 7 / 7 = **21** | 6 / 8 / 7 = **21** (avant amendements) |
| Ce que le joueur reconnaît | Un kop : bâches, fumigènes, pochoir, écharpe, tickets | Un soir de match : projecteurs, fumigènes, tableau d'affichage | Un album Panini et une carte qu'on tient |
| Ce qui change de la plaque actuelle | Beaucoup : la plaque devient une bâche (cerne irrégulier, ombre dure, coin déchiré) | Presque rien : géométrie intacte, seule la lumière change | Peu : tranche 4 px, dégradé vertical, demi-teinte |
| Police d'appoint | Permanent Marker (auto-hébergée, ≥ 15 px, annotations seules) | Aucune | Aucune |
| Risque principal | Le mur de stickers et le « trop punk » (variable `--tbf-diy: 0`, test joueurs sur deux écrans) | L'écran sombre au soleil (mode jour, aucun texte à même la photo, audit `--jour`) | La sobriété qui éteint le hub, et la matière de carte sur téléphone modeste |
| Ce qui est le plus distinctif | L'écharpe-jauge nouée, la bâche du jour, les tampons | Un seul objet allumé par écran, la fumée aux couleurs du club, les chiffres qui comptent | Les quatre matières de tribune sur la carte, la pochette numérotée, la carte de membre |
| Images à générer (à risque) | tunnel, foulard (2) ; le reste en SVG/CSS | tunnel, tribune vide, foulard, sièges, fumigène-main (5) | sachet RP, dos VP, tunnel, missions, foulard, souvenir (6+) |
| Effort client | 42–48 jours en 7 lots | 9–10 semaines (6 en version réduite) | 12–14 semaines |
| Première étape visible | Jour 4 : 24 écrans en bâches | Jour 3 : 24 écrans « de nuit » | Semaine 3 : la carte redessinée sur 6 écrans |
| Compatibilité entre elles | La couche UX, le lot 0, la corde, le HUD de match, l'échelle de cérémonie, l'album et le tunnel sont communs aux trois |

Honnêteté sur les notes : les trois totaux sont proches ; l'écart réel est d'identité (8 contre 7 contre 6 avant amendements), et les amendements de LA CARTE EN MAIN (velours, Playfair et cachet retirés, matières relues en tribune) la ramènent au niveau de NUIT DE MATCH. FAIT MAIN reste devant sur ce qui compte pour ce jeu : elle va chercher sa matière dans le kop lui-même.

---

## 6. Recommandation

**Retenir FAIT MAIN comme direction principale**, amendée comme dans son fichier (splat supprimé, kraft réservé au papier, or discipliné, coin déchiré sur toute plaque en `::before`, seuils de lisibilité tenus, cap de trois stickers sur le hub, feTurbulence remplacé par des tuiles sharp, Permanent Marker auto-hébergée et absente du rideau, effort réévalué à 42–48 jours).

Pourquoi elle et pas les autres :

1. C'est la seule qui transforme l'identité déclarée au lieu de l'habiller : l'écharpe — « le seul motif du jeu » — devient l'unique dessin de jauge (progression, souffle, pot, collection, XP, minuterie) et l'insigne de division ; le coin coupé devient un coin déchiré-rescotché ; le lettrage de banderole gagne le pochoir. Aucune des deux autres ne pousse l'écharpe aussi loin.
2. Sa matière vient du stade : bâche, sticker, tampon, ticket, pochoir, fumigène, corde, tunnel — le brief cite « l'esthétique ultras réelle » en dernier ; FAIT MAIN en fait la grammaire entière, là où `ui.css` reconnaît que la plaque actuelle est « commune à tous ces jeux ».
3. Elle est la plus « gaming » aux yeux du jury UX (7,5) : douze mécanismes, un vocabulaire de quatre objets (ticket = gain, sticker = état, tampon = verdict, bouffée = fête) qu'un joueur de 14 ans lit d'instinct et qu'un joueur de 50 ans lit par le chiffre Oswald à 100 %.
4. Elle se livre par lots visibles et 80 % de sa matière vit dans `ui.css` sur des classes déjà partagées : les 24 écrans changent le quatrième jour.

À quelles conditions, dans l'ordre :

- Faire le **lot 0** (hygiène + `FX.compter`/`FX.voler` + rendus à clé + audit étendu) avant toute matière : il est commun aux trois directions et il se voit déjà (contrastes, boutons unifiés, gains qui comptent).
- **Tester l'accent** sur deux écrans réels (hub, Virage) avec quelques joueurs, marqueur et rotations activés puis coupés par `--tbf-diy: 0`, avant de généraliser : c'est le seul risque que la spec ne peut pas lever seule.
- Tenir la **règle de hiérarchie** dans l'audit (une bâche grande, trois stickers hors listes, un ticket, une nappe par écran ; `.pan` sans ornement).

**Repli si le test dit « trop punk »** : NUIT DE MATCH. Elle garde la plaque intacte, n'ajoute aucune police, et sa couche (lumière + chiffres qui comptent + un seul objet allumé) se pose sur le code actuel en trois jours. La corde, le HUD de match, l'album, le tunnel et toute la couche UX sont communs : rien du lot 0 ni du lot arènes n'est perdu en changeant de direction.

**Ce qu'on prend à LA CARTE EN MAIN dans tous les cas** : la matière de carte par rareté en CSS statique dans les grilles, l'échelle de cérémonie, la pochette numérotée, le niveau de collectionneur sur l'atteignable, l'écran de test cardHTML, la vitrine comme modale commune. Elle reste la meilleure réponse si Gaël veut d'abord que le jeu de cartes soit un jeu de cartes — mais elle est la plus longue (12–14 semaines) et la moins « tribune » des trois.

---

## 7. Feuille de route par étapes livrables

Chaque étape se termine par une capture avant/après à 360 px que Gaël peut mettre sous les yeux d'un joueur. Les durées sont celles de FAIT MAIN pour une personne ; le serveur avance en parallèle.

**Étape 0 — Le socle (3 jours, commun à toute direction).**
Opacités informatives à 85 %, rien sous 11 px, `.pan` opaque sans `backdrop-filter` (ui.css + pages), boutons locaux en `.tbf-plaque`, `data-ton` sur les onglets, DECK sorti du rail, cadenas SVG, `#b1` de `/bienvenue`, décor sur `/carnet` et `/teletext`, table COUL retirée, « Installer l'application » dans le tiroir, `FX.compter` + `FX.voler`, rendus à clé dans `renderActes()` et `rendreDuel()`, mode calme, audit étendu (640, seuil de police, `--jour`), correction des cinq `.calc(` de cartes.css.
*Visible :* les 24 écrans lisent mieux au soleil, tous les boutons réagissent pareil, les soldes comptent quand ils changent.

**Étape 1 — La fondation ui.css (4 jours).**
Variables `--parpaing/--encre/--kraft/--scotch`, bâche (border-image SVG, ombre dure, coin déchiré en `::before`, scotchs), `.tbf-sticker/.tbf-tampon/.tbf-scotch/.tbf-dechire/.tbf-bulle/.tbf-bouffee/.tbf-fumee/.tbf-pochoir`, jauge-écharpe nouée et anneau, formes de rareté, tuiles de grain par sharp, Permanent Marker auto-hébergée, reduced-motion.
*Visible :* les 24 écrans changent de matière le même jour, audit vert.

**Étape 2 — Hub, tunnel, barre et tiroir (4 jours).**
Rideau-tunnel, HUD replié en cache, bulle du Fanzzy, tuiles à trois pastilles maximum, bâche du jour à cinq états, jauge de collection à crans, sous-libellé du bouton, moment fort unifié sur la case de BD, tiroir déroulé en grille de tuiles, ticket de retour (sans la route).
*Visible :* l'écran le plus vu du jeu, et l'entrée dans le jeu.

**Étape 3 — L'économie (5 jours).**
Kiosque avec HUD (fentes, écharpes, avatar), banderole de saison, sachets verrouillés, minuterie-objet, ouverture avec fentes de dos et échelle de cérémonie, butin vivant (jauge de série, écharpes qui volent, trois bâches de suite) ; boutique en rayons avec une, « À PORTÉE », cérémonie d'achat, cabine corrigée, pass de tribune.
*Visible :* la boucle de récompense entière — ouvrir, gagner, dépenser — avec le compteur qui bouge.

**Étape 4 — La collection (8 jours).**
cardHTML en sticker de carte avec matière par rareté (écran de test, puis les six écrans), plaque de fond par rareté, vestiaire et album de `/fanzzy` (pages ±1), fiche budgétée (inventaire, arbre d'évolution, actions hiérarchisées, non possédé), `/collection` en album à niveau de collectionneur.
*Visible :* ce qu'on collectionne ressemble enfin à ce qu'on tire.

**Étape 5 — Social et progression (5 jours).**
Profil en carte de supporter avec réglages repliés, classement avec podium, ligne épinglée et divisions en nœuds, KOP en bâche avec pot à jalons et vote en case de BD, amis en tribune au violet, fête de niveau enrichie, `/aide` en MISSIONS.
*Visible :* le niveau et les autres joueurs existent sur tous les écrans.

**Étape 6 — Les arènes, en trois temps (12 jours).**
6a : pavé-objet, tampon de verdict et cartes de geste dans `ui.css`, testés sur `/repetition` (sans socket) avec décor et Fanzzy témoin. 6b : bande HUD hors `#app` sur deux rangées, corde tressée, foulard, foules pochoir, souffle gradué, ferveur à paliers, éventail, carte-souvenir, bilan du Virage — budget 360×640 mesuré. 6c : le duel (préparation, vestiaire, arène, effets-objets, bilan-récompense sans rechargement).
*Visible :* le seul geste du jeu se joue dans une tribune, et le verdict est lu.

**Étape 7 — Images, audit, terrain (4 jours).**
Tunnel et foulard générés (VISUELS.md, régénérer plutôt que retoucher) ; corde, silhouettes, bombe, cernes, scotch en SVG dessinés ; tuiles par sharp ; audit sur les 24 écrans de nuit et de jour ; test reduced-motion et Android bas de gamme avec CPU ralenti ×4 ; captures avant/après ; test de l'accent avec joueurs (`--tbf-diy`).
*Visible :* la version qu'on montre.

**Serveur, en parallèle (10 à 12 jours), par ordre de rendement :** XP courant + seuil → drapeau vu/nouveau → avatar dans rank/kop/ferveur → delta et cote → paliers de collection et de rang → missions du jour + bonus + série de jours → saison → depuis la dernière visite → présence → bilan de tribune. Chaque route branchée allume une ligne que le client affiche déjà vide-sans-tiret.

---

## 8. Fichiers produits

- `direction-ultras-diy.json` — FAIT MAIN (13 amendements, 3 greffes)
- `direction-nuit-de-match.json` — NUIT DE MATCH (17 amendements, 4 greffes)
- `direction-tcg-premium.json` — LA CARTE EN MAIN (20 amendements, 3 greffes)
- `SYNTHESE.md` — ce document
