/**
 * L'audit d'interface : ce qui déborde, ce qui se touche mal, ce qui se lit mal.
 *
 * ## Pourquoi il mesure au lieu de juger
 *
 * « Cette page est un peu serrée » ne se corrige pas et ne se vérifie pas. « À
 * 360 px, le bouton PRENDRE MA PLACE dépasse de 12 px » se corrige en une ligne
 * et se re-mesure. Cet audit ne rend que des nombres et des sélecteurs.
 *
 * Trois défauts trouvés cette semaine l'ont été comme ça, et aucun ne se voyait
 * en relisant : la plaque qui débordait de son écran, le personnage qui perdait
 * soixante pixels, les quatre onglets qui se coupaient en « ENTRAÎNE… ».
 *
 * ## Il tourne sur le **vrai** serveur
 *
 * Pas sur un banc qui remonte les modules un par un : sur `server.js`, avec la
 * base de test, comme un joueur. Un audit d'interface qui reconstitue
 * l'application mesure la reconstitution — et c'est exactement la faute que
 * cette session a trouvée trois fois ailleurs.
 *
 * ## Ce qu'il regarde, et pourquoi chaque chose
 *
 *   — **le débordement horizontal**. Une page qui déborde se fait glisser de
 *     côté au doigt, et on croit avoir cassé quelque chose.
 *   — **ce qui sort de l'écran.** Un bouton hors cadre est un bouton qui
 *     n'existe pas.
 *   — **les textes coupés.** `text-overflow: ellipsis` tronque sans rien dire :
 *     une destination devinée n'est pas une destination lue. `line-clamp`
 *     aussi, à la dernière ligne permise (« coupé (lignes) », relevé à part).
 *   — **les zones de touche sous 44 px.** C'est la taille d'un doigt, et c'est
 *     la recommandation des deux plateformes.
 *   — **le contraste du petit texte.** Le jeu est sombre et emploie beaucoup
 *     d'`opacity`. En plein jour, sur un téléphone, `.45` disparaît.
 *   — **les images sans `alt`**, et celles qui n'ont pas chargé.
 *   — **les erreurs de script**, qui ne se voient jamais autrement.
 *
 * ## Et ce que le socle FAIT MAIN lui a ajouté
 *
 * Le lot 0 de la refonte promet que tout se lit en plein jour. Une promesse de
 * lisibilité qu'on ne mesure pas se juge à l'œil, sur l'écran de celui qui
 * corrige — un écran d'intérieur, luminosité au maximum. D'où quatre relevés :
 *
 *   — **le petit texte** : tout texte visible sous 11 px, à sa taille **rendue**
 *     (une carte réduite par `transform: scale` écrit plus petit que sa police).
 *   — **l'opacité effective** : le produit des `opacity` de l'élément et de ses
 *     ancêtres, multiplié par l'alpha de sa couleur. Sous 0,85, un texte qui
 *     informe se devine plus qu'il ne se lit. La couleur seule ne le dit pas :
 *     le jeu écrit en craie pleine dans des blocs à `.6`.
 *   — **le `backdrop-filter`** : tout élément dont la valeur calculée n'est pas
 *     « none ». Il recalcule à chaque image ce qui passe derrière lui, et le
 *     socle le remplace par des fonds opaques.
 *   — **le contraste au jour**, avec `--jour` : le même calcul que le contraste
 *     ordinaire, mais sous un voile blanc de 40 %, qui est ce que fait le soleil
 *     à un écran. Relevé à part, parce qu'il ne remplace pas l'autre.
 *
 * Les mentions légales ont droit à moins, et elles seules : voir `LEGAL`.
 *
 * Il regarde aussi deux écrans qu'il manquait : la vitrine (l'accueil sans
 * compte) et la vraie cérémonie de /bienvenue, vue par un nouveau venu — voir
 * `VISITES`. Et chaque visite a son propre navigateur et sa propre adresse,
 * pour qu'aucune ne dépende de celles d'avant : voir « Un navigateur neuf par
 * visite ».
 *
 * ## Le grain, et les écrans qu'aucune route ne montre (lot 2)
 *
 * Depuis le lot 1, toute bâche, tout onglet actif et tout `.pan` portent une
 * tuile de grain, donc une image de fond — et l'audit rangeait tout texte
 * posé sur une image parmi les « non mesurables ». Le compte au soleil
 * **baissait** pendant que la lecture baissait : un angle mort qui se lit
 * comme un progrès. Il lit maintenant à travers la tuile, jusqu'à la couleur
 * posée dessous (voir « Le grain n'est pas un dégradé », dans `MESURE`), et
 * compte ces textes **à part** — `surGrain`, `palesGrain`, `jourSurGrain`,
 * `jourGrain` — pour qu'un relevé d'avant se compare encore : l'ancien « sur
 * dégradé » vaut le nouveau plus `surGrain`. D'où le schéma `audit-ui/2`.
 *
 * Et `--etats` regarde trois écrans que le parcours des routes ne voit
 * jamais, parce qu'il attend qu'ils soient partis ou ne les ouvre pas :
 * l'ouverture du hub au début et vers deux secondes, et le tiroir ouvert.
 * L'ouverture aussi à 320 × 568, le plus petit téléphone, où l'on cherche
 * ce qu'elle pousse sous son bord (« hors fenêtre »). Voir « Les états ».
 *
 * ## Les polices du joueur, et la coupe à la ligne (lot 2)
 *
 * **L'audit mesurait tout en police de secours.** L'adresse propre à chaque
 * visite (voir « Un navigateur neuf par visite ») partait sur **toutes** les
 * requêtes, Google Fonts compris : un en-tête que CORS ne range pas parmi
 * les simples fait précéder chaque fichier de police d'une requête de
 * contrôle, que Google refuse. Oswald et Permanent Marker tombaient en échec
 * sans un message, et `document.fonts.status` disait « loaded » quand même —
 * il dit que plus rien ne charge, pas que tout a chargé. Les largeurs, les
 * retours à la ligne et les coupes de tout relevé d'avant ce correctif ont
 * donc été pris dans une autre police que celle du joueur : un relevé sans
 * champ `enRepli` en est un. L'adresse ne part plus que vers notre serveur,
 * et chaque mesure attend les polices puis compte les textes qu'elle a dû
 * lire dans une police de secours (`enRepli`, genre « police de repli »).
 *
 * Et « coupé » ne voyait que l'ellipse sur une ligne : un libellé que
 * `line-clamp` arrête à sa dernière ligne permise lui échappait. Il est
 * relevé à part (`coupesLignes`), pour que `coupes` se compare encore.
 *
 * ## Un texte à soi, Œ, et quatre états de plus (lots 3 et 5)
 *
 * **Le contraste ne regardait que les feuilles.** Le bouton principal du hub
 * porte son libellé et un enfant (« Prendre ma place » puis un `small`) : il
 * n'était ni pâle ni non mesurable, il n'existait pas. Le contraste se mesure
 * maintenant sur tout ce qui porte un texte à soi, comme le petit texte et
 * l'opacité — et, pour qu'un relevé d'avant se compare encore, ce que l'ancienne
 * règle ne voyait pas est compté à part (`horsFeuille`) et marqué dans chaque
 * trouvaille. Ce qui échappe encore — un mot posé par un pseudo-élément, la
 * valeur d'un champ — est relevé sans être mesuré (`horsContraste`).
 *
 * **Œ et œ passaient pour une police de repli** : voir `enRepli`. Et la face
 * cachée d'une carte à retourner se comptait comme un texte qu'on lit : voir
 * « Tourné de dos ».
 *
 * Et `--etats` regarde quatre écrans de plus, que ces lots refont et qu'aucune
 * visite ordinaire ne montre : la bande du HUD dépliée, une carte révélée à
 * l'ouverture d'un booster, son butin, et le classement d'un joueur classé.
 * Voir « Les états ».
 *
 * ## Le petit or, la barre, et ce qui couvre un écran (lots 3 et 5, suite)
 *
 * **Le petit or** (`petitOr`). L'arbitrage du 2 octobre 2026 n'écrit plus
 * l'or qu'en grand texte : tout texte à soi d'encre dorée sous 24 px (18,66
 * en gras), pseudo-élément compris, est relevé. C'est la garde qui empêche
 * l'arbitrage de revenir en arrière une page à la fois. Voir `DORE`.
 *
 * **La barre** : la flèche et le menu de la barre commune sont relevés page
 * par page, et une page qui les pose ailleurs que les autres est nommée
 * (« barre décalée ») — le lot 2 en avait laissé quatre décalées sans que
 * rien ne le dise. Et le tiroir ouvert dit combien d'écrans il fait de haut.
 *
 * **Ce qui couvre un écran à l'arrivée** : le ticket d'un gain ou d'un
 * retour, une fête de niveau, la cérémonie d'une carte. La visite les
 * attend ou les ferme avant de mesurer, et le dit ; le ticket du butin est
 * mesuré à part, comme un état. Le bonus du jour ne couvre plus rien : il
 * est dans la bâche du hub, que la visite attend et mesure avec la page.
 *
 * ## Une collection en partie remplie (lot 4)
 *
 * Le joueur de l'audit n'a pas une carte, et c'est très bien pour les pages :
 * c'est ce que tout relevé d'avant a mesuré. Mais une collection vide ne
 * montre ni doublon, ni légendaire, ni une carte à soi à côté d'une carte qui
 * manque — exactement ce que le lot 4 redessine. `--etats` sème donc un
 * collectionneur par format et regarde six écrans de plus : le classeur, la
 * fiche d'un Fanzzy possédé et celle d'un manquant, la vitrine sur l'un et
 * sur l'autre, et l'album de /collection quand il existe. Voir « La
 * collection ».
 *
 * Il ne porte pas non plus d'insigne du carnet de saison, et le lot 4 les
 * dessine sur le profil : le tampon « S1 » sur la carte de supporter, le
 * liseré autour de l'anneau du buste, les stickers de MA SAISON. Un état de
 * plus les lui coud le temps de trois visites de /profil. Voir « Les
 * insignes du carnet ».
 *
 * Et un mot pour le lecteur d'écran seul, une boîte d'un pixel découpée à
 * rien, se comptait comme un texte qu'on lit, pâle au soleil compris : il
 * est écarté de tout relevé, et nommé à part (`rognes`) avec tout texte
 * qu'une découpe efface. Voir « Rogné à rien ».
 *
 * ## Les arènes en jeu (lot 6)
 *
 * L'audit ne voyait les deux arènes qu'à leur porte : /virage au voile de
 * choix, /duel-nvn à la préparation — et toutes deux vides, puisque la base
 * de l'audit n'a aucun match. Tout ce que le lot 6 redessine se joue après :
 * la tribune, la minute double, la case « GOAL ! », le pavé du geste, la
 * sortie par le bilan ; au duel, le vestiaire, l'affiche, la partie et son
 * bilan. Rien de cela ne vient sans une socket et un match en cours.
 *
 * `--etats` les photographie et les mesure par **la technique du banc des
 * arènes** : la page arrive du vrai serveur, avec le vrai joueur, mais
 * `/socket.io/socket.io.js` est remplacé par une fausse socket qu'on pilote
 * de l'extérieur, et les états qu'elle reçoit sont **fabriqués** ici, à la
 * forme du contrat (`serveur/CONTRATS.md`, § 15 à § 18 compris : un écran
 * d'avant ne les lit pas, un écran du lot 6 les trouve). Pour le voile et la
 * préparation garnis, quatre lectures sont **bouchées** (les deux listes de
 * matchs, le deck, la file) : elles sont nommées dans chaque relevé
 * (`bouches`). Un relevé d'arène mesure donc l'écran, pas le serveur — c'est
 * le travail des suites. Voir « Les arènes ».
 *
 * À 360 × 640, 320 × 568, 412 × 915 et 768 × 1024 ; et la tribune et la
 * partie aussi à 1 280 × 800, où le mur se voit de part et d'autre de la
 * colonne (le voile des arènes, H6). Avec le pavé du duel, la corde qui y
 * cède, une tribune de trois cents et le coup de sifflet d'un Virage non
 * classé. `--arenes` ne regarde qu'elles.
 *
 * Avec elles, quatre écrans que le lot refait ailleurs et qu'aucune visite
 * ne montre : la salle de répétition une fois le geste jugé (un tempo, puis
 * le tri), /amis et le tiroir avec la présence servie — livrée éteinte, le
 * serveur de l'audit ne la sert jamais. Et quatre règles qu'aucun compte de
 * texte ne lit, relevées sur chaque état du lot : au plus trois animations
 * sans fin à l'écran, l'air du sticker d'urgence du menu sur un écran de
 * jeu, le voile du hub (et non le voile dense) sur les arènes au-delà de
 * 768 px, et la main et les chants à l'écran — l'arène cède d'abord. Voir
 * « Les arènes ».
 *
 * Et **le port n'est plus fixe** : deux copies de travail qui mesurent en
 * même temps se seraient disputé le 3999, et la seconde aurait mesuré le
 * serveur de la première sans un mot. Voir « Un port à soi ».
 *
 * Usage :
 *   node scripts/audit-ui.mjs                  toutes les pages, trois formats
 *   node scripts/audit-ui.mjs /virage          une seule page
 *   node scripts/audit-ui.mjs --largeur 360    un seul format
 *   node scripts/audit-ui.mjs --tout           sans couper la liste des défauts
 *   node scripts/audit-ui.mjs --jour           et le contraste au soleil
 *   node scripts/audit-ui.mjs --json a.json    tous les relevés, pour une machine
 *   node scripts/audit-ui.mjs --captures dos   une capture par page et par format
 *   node scripts/audit-ui.mjs --pleine         captures de la page entière
 *   node scripts/audit-ui.mjs --etats          et l'ouverture, le tiroir ouvert, la
 *                                              bande du HUD, un booster et son
 *                                              ticket, un classement, et la
 *                                              collection (classeur, fiches,
 *                                              vitrine, album), et le profil
 *                                              avec ses insignes, et les arènes
 *                                              en jeu (Virage, duel) et les
 *                                              autres écrans du lot 6
 *   node scripts/audit-ui.mjs --arenes         les états du lot 6 seulement
 *                                              (pour re-mesurer vite pendant un
 *                                              lot ; avec une page et un format,
 *                                              une minute)
 *
 * (Sous Git Bash, « /virage » est réécrit en chemin Windows avant d'arriver
 * ici : préfixer la commande de MSYS_NO_PATHCONV=1, ou la lancer depuis
 * PowerShell.)
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { ORDRE } from './ordre-schema.mjs';
import { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
/* Les options qui prennent une valeur. Cette valeur n'est pas une page :
   « --captures /tmp/avant » commence par une barre oblique, et sans cette
   liste l'audit serait parti visiter la route « /tmp/avant » — pour y
   trouver une page d'erreur et la mesurer consciencieusement. */
const A_VALEUR = new Set(['--largeur', '--json', '--captures']);
const seule = args.find((a, i) => a.startsWith('/') && !A_VALEUR.has(args[i - 1]));
/* Le rapport s'arrête à quatorze défauts par genre : c'est ce qu'on lit d'une
   traite un matin. Quand on s'attelle vraiment à une catégorie, on veut les
   quatre-vingts. */
const tout = args.includes('--tout');
const jour = args.includes('--jour');
const pleine = args.includes('--pleine');
/* `--arenes` : les états des arènes seuls (voir « Les arènes »). Ils ne
   sèment rien et ne dépendent d'aucun autre état : on peut les reprendre
   seuls, en une minute avec une page et un format, pendant qu'un lot
   retouche ses deux écrans de jeu. */
const arenesSeules = args.includes('--arenes');
const etats = args.includes('--etats') || arenesSeules;

/* Une option à valeur sans sa valeur est refusée **avant** de vider la base
   et de démarrer un Chrome : découvrir au bout de six minutes que le JSON
   n'a été écrit nulle part, c'est six minutes perdues, et une mesure « avant »
   qu'on ne pourra plus refaire une fois les pages touchées. */
for (const o of ['--json', '--captures', '--largeur']) {
  if (args.includes(o) && (!opt(o) || opt(o).startsWith('--'))) {
    console.error(`\n${o} attend une valeur : ${o === '--largeur' ? 'un nombre de pixels'
      : o === '--json' ? 'le fichier où écrire les relevés' : 'le dossier des captures'}.\n`);
    process.exit(1);
  }
}
const sortieJson = opt('--json') ? path.resolve(opt('--json')) : null;
const dossierCaptures = opt('--captures') ? path.resolve(opt('--captures')) : null;

const DB = baseDeTest();

/* **Le verrou de la base, tenu à jour.** `base-de-test.mjs` date le verrou
   à sa prise et le tient pour périmé au bout de dix minutes : au-delà, la
   suite suivante le reprend et vide la base. L'audit avec `--etats` en
   prenait déjà huit et demie au départ du lot 4, et ses états du lot (la
   collection, le profil et ses insignes) en ajoutent : passé dix minutes,
   une autre suite viderait la base au milieu d'une mesure, qui rougirait
   sans rien dire des pages. Tant que l'audit vit, il redate donc **son
   propre** verrou chaque minute (même pid ; jamais celui d'un autre).
   Écrit à part puis renommé par-dessus : un lecteur ne voit jamais le
   fichier vide, qu'il prendrait pour périmé. Le brouillon vit dans le
   dossier temporaire du système, pas dans le dépôt (que `.gitignore` ne
   couvre que pour le verrou lui-même), et il est effacé si le renommage
   échoue. Rien à redater sans verrou (`TBF_SANS_VERROU`) ; un échec ne
   coûte que ce battement-là. */
const VERROU = path.join(RACINE, '.tbf-suite.lock');
setInterval(() => {
  const brouillon = path.join(tmpdir(), `tbf-suite-lock-${process.pid}.json`);
  try {
    const tenu = JSON.parse(readFileSync(VERROU, 'utf8'));
    if (tenu?.pid !== process.pid) return;
    writeFileSync(brouillon, JSON.stringify({ ...tenu, a: Date.now() }));
    renameSync(brouillon, VERROU);
  } catch {
    /* Pas de verrou, illisible, tenu ouvert, ou un autre disque : au
       prochain battement. */
    try { unlinkSync(brouillon); } catch { /* rien n'a été écrit */ }
  }
}, 60_000).unref();

/* Les trois formats qui décident. 360 est le téléphone le plus étroit encore
   courant, 400 le téléphone ordinaire, 768 la tablette en portrait — et c'est
   là que les mises en page en colonnes changent de règle.

   **La hauteur compte autant que la largeur.** Le téléphone étroit est aussi
   un téléphone court : 640 px, barre du navigateur déployée. Il était mesuré
   à 800, c'est-à-dire avec cent soixante pixels qu'aucun téléphone modeste
   n'a — et c'est dans ces pixels-là que tombent le bouton principal, le bas
   d'une feuille, la dernière rangée d'une arène. Les deux autres formats
   gardent leur hauteur. */
const FORMATS_BASE = [
  { largeur: 360, hauteur: 640 },
  { largeur: 400, hauteur: 800 },
  { largeur: 768, hauteur: 1024 },
];
/* Le plus petit téléphone qu'on promet de tenir, pour le seul écran
   d'ouverture (voir « Les états ») : il n'entre pas dans le socle. Mais
   « --largeur 320 » le désigne, pour toutes les visites : un téléphone de
   320 px de large a aussi 568 px de haut, pas 800. */
const PETIT = { largeur: 320, hauteur: 568 };
/* Le grand téléphone (412 × 915), pour les seuls états des arènes (voir « Les
   arènes ») : c'est là qu'un budget écrit pour 640 px de haut laisse le plus
   de vide. « --largeur 412 » le désigne avec sa vraie hauteur. */
const GRAND_TELEPHONE = { largeur: 412, hauteur: 915 };
const FORMATS = opt('--largeur')
  ? [[...FORMATS_BASE, PETIT, GRAND_TELEPHONE].find((f) => f.largeur === Number(opt('--largeur')))
    ?? { largeur: Number(opt('--largeur')), hauteur: Number(opt('--largeur')) >= 768 ? 1024 : 800 }]
  : FORMATS_BASE;
const cleFormat = (f) => `${f.largeur}x${f.hauteur}`;

/* Les seuils du socle, en un seul endroit : la page les reçoit tels quels, et
   le JSON les recopie — une mesure dont on ne sait plus contre quoi elle
   comparait ne se compare plus à rien. */
const SEUILS = {
  petitTexte: 11,      // px rendus : le corps minimal d'un texte qui informe
  opacite: 0.85,       // opacité effective minimale d'un texte qui informe
  opaciteLegal: 0.55,  // … et d'une mention légale
  voileJour: 0.4,      // la part de blanc que le soleil pose sur l'écran
  /* La hauteur du tiroir ouvert, en écrans : au-delà d'un et demi, la moitié
     des destinations se cherche au doigt (le lot 2 l'avait laissé à deux). */
  tiroirEcrans: 1.5,
  /* Un pixel d'écart d'une page à l'autre, pour la barre : la règle du
     « hors écran », pour la même raison (un arrondi n'est pas un défaut). */
  barrePx: 1,
  /* **Au plus trois animations sans fin par écran, toutes comptées**
     (direction FAIT MAIN, amendement 8 ; brief du lot 6), comptées comme
     `FX.sansFin` les compte : un objet par élément ou pseudo-élément, celles
     qui tournent. Relevé sur les états du lot 6 (« sans fin »). */
  sansFin: 3,
  /* Ce qui entoure la face du sticker d'urgence du menu, au-dessus et à
     droite : son bord de craie (2 px) et son cerne d'encre (1,5 px) ; à
     droite, son ombre portée en plus (décalée de 2 px). Ils font partie de
     ce que l'écran doit lui laisser (brief du lot 6, § 7 : « neuf pixels,
     treize avec son bord et son ombre » ; ui.css, « le sticker de l'état le
     plus urgent »). Voir `BARRE_JEU` et « sticker rogné ». */
  bordSticker: [3.5, 5.5],
  /* L'encre d'un texte qu'un cadre rogne en haut ou en bas, en pixels :
     au-delà, un accent, une cédille ou un émoji est entamé (« encre
     rognée »). Un quart de pixel : l'arrondi de la mesure, au banc des
     briques, reste en dessous ; les accents rognés qu'elle y a trouvés
     allaient de 0,9 à 2,4 px. */
  encreRognee: 0.25,
  /* La part des lettres d'un libellé de carte sur laquelle autre chose est
     posé, en pour cent (« libellé couvert ») : au banc des briques, 0 % une
     fois les cartes justes, de 14 à 59 % quand un sticker, une recharge ou
     une voisine couvrait un mot. */
  libelleCouvert: 5,
};

/* **Les mentions légales, et elles seules, ont droit à moins.**

   Elles n'informent pas le jeu : elles disent qui fournit les résultats et ce
   qui est fictif. Elles doivent être là et lisibles pour qui les cherche, pas
   se disputer l'écran avec le bouton de jeu. Le socle leur accorde 0,55
   d'opacité au lieu de 0,85, et ne leur applique pas le seuil de 11 px ; elles
   restent **comptées à part** (« tolérés ») pour qu'une mention tombée à 7 px
   se voie quand même dans le JSON.

   La liste est courte exprès. Une tolérance qu'on étend pour faire taire une
   alerte transforme un texte illisible en texte autorisé :

     .legal         le pied de la vitrine — « Résultats fournis par API-Football »
     [data-legal]   la marque à poser sur toute autre mention qui le mérite,
                    dans le balisage, là où un relecteur la verra */
const LEGAL = ['.legal', '[data-legal]'];

/* /admin et /diagnostic sont des écrans de gestion : l'audit les mesure,
   parce qu'une page servie est une page qu'on peut casser, mais le socle ne
   les vise pas. Ils sont marqués comme tels dans le rapport et le JSON, pour
   qu'un compte « avant / après » du lot ne les mélange pas au reste. */
const HORS_LOT = new Set(['/admin', '/diagnostic']);

/* Les pages, telles que `server.js` les sert. On les lit dans le fichier plutôt
   que de les énumérer : une page ajoutée sans être auditée ne se verrait
   nulle part, et c'est exactement le genre d'oubli que cet outil corrige.

   **Deux formes, et la seconde a coûté cet audit.** Les routes rendaient
   leur page par `res.sendFile` ; elles passent désormais par un raccourci
   `page(res, …)` qui estampille le HTML. La recherche n'a pas suivi : elle
   ne trouvait plus rien, la liste était vide, et l'outil annonçait « Rien à
   signaler sur aucune page » — en n'ayant regardé aucune page.

   C'est la pire panne possible pour un contrôle : il ne rougit pas, il
   rassure. D'où le refus plus bas de travailler sur une liste vide. */
/* **Et les routes à paramètre, qui n'ont pas d'adresse tant qu'on ne leur en
   donne pas une.** La fiche d'un Fanzzy — `/fanzzy/:id` — est un écran à part
   entière, et le socle y branche le compteur d'une évolution ; la recherche
   l'écartait en silence, et l'audit mesurait vingt-trois écrans du jeu en
   laissant croire qu'il les mesurait tous. Chaque route à paramètre reçoit
   donc un exemple ici. RP1 vient de LA REPRISE, la seule série ouverte au
   lancement : c'est la fiche qu'un joueur ouvre vraiment.

   Une route à paramètre sans exemple n'est pas visitée, et elle est **nommée**
   en fin de rapport plutôt qu'oubliée. */
const EXEMPLES = { '/fanzzy/:id': '/fanzzy/RP1' };
const ROUTES = [...new Set(
  [...readFileSync(path.join(RACINE, 'server.js'), 'utf8')
    .matchAll(/app\.get\('(\/[a-z-]*(?:\/:[a-z]+)*)',\s*\(_req, res\) => (?:res\.sendFile|page\()/g)]
    .map((m) => m[1]))];
const SANS_EXEMPLE = ROUTES.filter((r) => r.includes(':') && !EXEMPLES[r]);
const PAGES = seule ? [seule] : ROUTES
  .filter((r) => !r.includes(':') || EXEMPLES[r])
  .map((r) => EXEMPLES[r] ?? r);

/* **Une liste vide est une panne, pas un résultat.** Sans ce garde-fou,
   l'outil parcourt zéro page, ne trouve zéro défaut, et le dit sur le ton de
   la bonne nouvelle. Il vaut mieux qu'il s'arrête en nommant la cause. */
if (!PAGES.length) {
  console.error('\nAucune page trouvée dans server.js.\n\n'
    + '  La recherche attend `app.get(\'/x\', (_req, res) => page(res, …))`\n'
    + '  ou la même chose avec `res.sendFile`. Si les routes ont changé de\n'
    + '  forme, c\u2019est ici qu\u2019il faut le dire — sinon cet audit ne regarde\n'
    + '  plus rien tout en se déclarant satisfait.\n');
  process.exit(1);
}

/* Le nom d'une capture : la route, sans sa barre, puis le format. L'accueil
   n'a pas de nom dans son adresse ; il prend celui qu'on lui donne partout
   ailleurs dans le dépôt. */
const nomDeRoute = (chemin) => (chemin === '/' ? 'accueil'
  : chemin.replace(/^\//, '').replace(/[^a-zA-Z0-9-]+/g, '-'));

/* **Qui regarde chaque page.** Le joueur installé, partout, sauf deux cas
   où il ne voit pas l'écran qu'on croit mesurer :

     — **la cérémonie renvoie tout joueur déjà inscrit vers l'accueil.** Visitée
       avec son compte, /bienvenue mesurait le hub une seconde fois sous un autre
       nom, relevé pour relevé — et la cérémonie, que le socle retouche (son
       premier bouton, ses couleurs par type), n'était jamais regardée. Elle
       est donc vue par un nouveau venu, qui n'a pas encore choisi son club.
     — **l'accueil sans compte est un autre écran** : la vitrine, la seule
       chose que voit quelqu'un qui n'est pas encore entré, et la seule page
       qui porte une mention légale. Sans cette visite, la tolérance du légal
       ne serait jamais éprouvée. Elle s'ajoute aux routes, sous sa propre clé.

   `cle` est le nom de la visite dans le rapport et le JSON ; `nom`, celui de
   sa capture quand la route ne suffit pas à la distinguer. */
const QUI = { '/bienvenue': 'nouveau' };
const VISITES = [
  ...PAGES.map((chemin) => ({ chemin, cle: chemin, qui: QUI[chemin] ?? 'joueur' })),
  ...(seule ? [] : [{ chemin: '/', cle: '/ (sans compte)', qui: null, nom: 'vitrine' }]),
];

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
const [tables] = await raw.query(
  'SELECT table_name t FROM information_schema.tables WHERE table_schema = DATABASE()');
if (tables.length) {
  await raw.query(`DROP TABLE IF EXISTS ${tables.map((r) => `\`${r.t}\``).join(', ')}`);
}
await raw.query('SET FOREIGN_KEY_CHECKS = 1');

/* L'ordre du déploiement. Il vit dans `ordre-schema.mjs`, que lisent aussi la
   commande qui applique et la suite qui vérifie.

   **Il était recopié ici**, sous un commentaire affirmant qu'il était « lu
   dans la boucle de DEPLOIEMENT.md pour qu'il ne puisse pas diverger de ce
   qui tourne en production ». Il ne l'était pas : c'était une liste écrite à
   la main, et six fichiers y manquaient — dont `etats.sql`. L'audit montait
   donc des écrans sur un schéma que personne ne déploie, et une page qui
   aurait cassé faute de table s'y serait affichée sans rien dire.

   Un commentaire qui décrit une propriété que le code n'a pas est pire que
   pas de commentaire : on cesse d'aller vérifier. */
for (const f of ORDRE) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', `${f}.sql`), 'utf8'));
}

/* Un joueur, avec assez de choses pour que les écrans ne soient pas tous vides :
   un audit qui ne visite que des pages vides ne mesure que des pages vides. */
const U = 'aud00000-0000-0000-0000-000000000001'.slice(0, 36);
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status,email_verified_at)
                 VALUES (?,?,?,'x','active',NOW(3))`, [U, 'audit@ex.fr', 'Audit']);
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,onboarded_at)
                 VALUES (?,500,6,400,NOW(3))`, [U]);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [U]);
/* Le nouveau venu de /bienvenue (voir `QUI`) : un compte vérifié, rien de
   plus. Sa bourse naît à la première lecture de son état, comme pour un vrai
   inscrit — la semer ici ferait un nouveau venu que le jeu ne fabrique pas. */
const N = 'aud00000-0000-0000-0000-000000000002';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status,email_verified_at)
                 VALUES (?,?,?,'x','active',NOW(3))`, [N, 'nouveau@ex.fr', 'Nouveau']);
await raw.end();

/* --------------------------------------------------------- le vrai serveur */

/* **Un port à soi.** L'audit prenait toujours le 3999. Depuis que deux copies
   de travail mesurent en même temps (le lot 4 dans la copie principale, le
   lot 6 dans la sienne, chacune sur sa base), le second serveur ne pouvait
   pas l'ouvrir : il s'arrêtait, et `debout` trouvait au 3999 le serveur de
   l'autre copie — qui répondait. L'audit mesurait alors les pages et la base
   de l'autre lot, sans un mot, et ses sessions semées dans sa propre base n'y
   ouvraient rien. Le système donne donc un port libre, à chaque audit ; un
   audit d'avant ce correctif, qui prend encore le 3999, ne tombe jamais sur
   celui-ci. Et `debout` ne se contente plus d'une réponse : notre serveur
   doit être vivant. */
const portLibre = () => new Promise((resoudre, refuser) => {
  const essai = createServer();
  essai.once('error', refuser);
  essai.listen(0, () => {
    const libre = essai.address().port;
    essai.close(() => resoudre(libre));
  });
});
const port = await portLibre();
let journal = '';
/* Lancé par une fonction : le classement d'un joueur classé (voir « Les
   états ») demande un serveur neuf, dont la mémoire de classement n'a pas
   encore retenu la liste vide des visites. */
const lancerServeur = () => {
  const s = spawn(process.execPath, ['server.js'], {
    cwd: RACINE,
    env: { ...process.env, DATABASE_URL: DB, PORT: String(port), NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  s.stdout.on('data', (d) => { journal += d; });
  s.stderr.on('data', (d) => { journal += d; });
  return s;
};
let serveur = lancerServeur();

const base = `http://localhost:${port}`;
const debout = async () => {
  for (let i = 0; i < 60; i++) {
    /* Un serveur arrêté (un port pris entre-temps, une erreur au démarrage)
       ne répond plus de rien : ce qui répondrait à sa place n'est pas lui. */
    if (serveur.exitCode !== null || serveur.signalCode !== null) return false;
    try { const r = await fetch(`${base}/healthz`); if (r.ok || r.status === 503) return true; }
    catch { /* pas encore */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
};
if (!await debout()) {
  console.error('Le serveur n’a pas démarré.\n', journal.slice(-1500));
  serveur.kill(); process.exit(1);
}

/* La session, posée directement : on audite les écrans du jeu, pas le
   formulaire de connexion — qui a sa propre page dans la liste. */
const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
const jeton = 'audit-session-000000000000000000000000000000';
const jetonNouveau = 'audit-session-nouveau-00000000000000000000000';
const { createHash } = await import('node:crypto');
for (const [j, qui] of [[jeton, U], [jetonNouveau, N]]) {
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     SELECT ?, id, NOW(3) + INTERVAL 1 DAY FROM users WHERE public_id = ?`,
    [createHash('sha256').update(j).digest('hex'), qui]);
}
const SESSIONS = { joueur: jeton, nouveau: jetonNouveau };

/* ------------------------------------------------------------ la mesure */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const trouvailles = [];
const note = (page, largeur, genre, quoi) =>
  trouvailles.push({ page, largeur, genre, quoi });

/* **Le voile moyen de chaque tuile de grain**, lu sur la tuile que la page a
   vraiment reçue : décodée dans la page, peinte sur un canevas, moyennée
   pixel par pixel. La teinte moyenne pondérée par l'opacité, et l'opacité
   moyenne — posée sur une couleur, cette couche unie donne exactement la
   moyenne de ce que la tuile donne pixel par pixel sur la même couleur.

   Dans la page et non dans ce script : le serveur choisit le format selon
   ce que le navigateur annonce (un AVIF peut remplacer le WebP demandé), et
   c'est la tuile décodée qu'on veut moyenner, pas la recette. Le résultat
   est rangé sur la page pour MESURE, qui ne peut pas attendre une image, et
   rendu pour le JSON. Une tuile qui n'a pas chargé vaut « null » : la
   surface est alors peinte unie, et MESURE la lit ainsi. */
const VOILES = `(async () => {
  const adresses = new Set();
  for (const el of document.querySelectorAll('*')) {
    const v = getComputedStyle(el).backgroundImage;
    if (!v || !v.includes('/img/grain/')) continue;
    for (const m of v.matchAll(/url\\(\\s*["']?([^"')]+)["']?\\s*\\)/g)) {
      if (m[1].includes('/img/grain/')) adresses.add(m[1]);
    }
  }
  const voiles = {};
  for (const adresse of adresses) {
    try {
      const img = new Image();
      img.src = adresse;
      await img.decode();
      const toile = document.createElement('canvas');
      toile.width = img.naturalWidth;
      toile.height = img.naturalHeight;
      const ctx = toile.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, toile.width, toile.height).data;
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = 0; i < d.length; i += 4) {
        const al = d[i + 3] / 255;
        r += d[i] * al; g += d[i + 1] * al; b += d[i + 2] * al; a += al;
      }
      const n = d.length / 4;
      voiles[adresse] = a > 0 ? { c: [r / a, g / a, b / a], a: a / n } : { c: [0, 0, 0], a: 0 };
    } catch { voiles[adresse] = null; }
  }
  window.__auditVoiles = voiles;
  return voiles;
})()`;

/* **L'or, et ce qui en fait un petit texte** (arbitrage 3 du 2 octobre 2026).
   L'or reste une face — une bâche, un prix, une récompense prête, le
   légendaire — et ne s'écrit plus qu'en grand texte, où 3:1 suffit : au
   moins 24 px, ou 18,66 px en gras. Une encre est dorée quand sa teinte va
   de 33 à 58° (de l'ambre au jaune), que sa saturation passe 0,45 et sa
   luminosité 0,3 : l'or du jeu (#F5C33B, 43°) en est, la craie (saturation
   0,35) non. C'est le critère du banc de la boutique qui a vérifié
   l'arbitrage, repris tel quel : l'audit et le banc disent la même chose. Une
   encre à moins de 30 % n'écrit plus rien qu'on lise en or.

   **La légendaire garde son or, mot compris** : c'est ce que l'arbitrage a
   décidé pour la carte (cartes.css, « le légendaire est l'un des sens de
   l'or »), dont le nom et l'âge s'écrivent en or pâle. Un texte posé dans un
   objet légendaire (`legendaire`) n'est donc pas relevé comme petit or — il
   est **compté à part** (`orLegendaire`), comme les mentions légales
   tolérées, pour qu'une exception qui grandirait se voie quand même.

   Ici, entre VOILES et MESURE, et non dans SEUILS : les bancs des lots 2 à 5
   tirent ce morceau du fichier et l'évaluent avec leurs propres seuils, qui
   ne connaissent pas l'or. */
const DORE = { teinte: [33, 58], saturation: 0.45, luminosite: 0.3, alpha: 0.3,
  legendaire: '.r-legendaire, .legendaire, [data-rar="legendaire"]' };

/** Le contraste d'un texte sur son fond, selon la formule WCAG.
 *
 * `portee` restreint la mesure à un sélecteur — l'écran d'ouverture, le
 * tiroir : un état posé par-dessus la page se mesure seul, sans relever une
 * seconde fois la page qu'il recouvre (et que la mesure lirait comme si rien
 * ne la couvrait). Sans portée, c'est toute la page, comme avant.
 *
 * Sous une portée **fixée à la fenêtre** (les deux d'aujourd'hui), deux
 * relevés parlent de l'état et non plus de la page : `deborde` est ce que
 * l'état fait glisser de côté, et `horsFenetre` s'ajoute — les textes qu'il
 * pousse hors de l'écran sans pouvoir les y ramener. Voir « Hors de la
 * fenêtre », plus bas.
 *
 * Le gabarit ne reçoit que `SEUILS`, `LEGAL` et `jour` : les bancs du lot 2
 * le tirent de ce fichier et l'évaluent avec ces trois noms seulement. */
const mesure = (portee = null) => `(() => {
  const SEUILS = ${JSON.stringify(SEUILS)};
  const LEGAL = ${JSON.stringify(LEGAL.join(','))};
  const JOUR = ${jour};
  const PORTEE = ${JSON.stringify(portee)};
  const ZONE = PORTEE ? document.querySelector(PORTEE) : null;
  if (PORTEE && !ZONE) return null;
  const VOILES = window.__auditVoiles ?? {};
  /* **« color(srgb 0.95 0.83 0.49) » ne se lit pas comme « rgb(242, 212, 125) ».**
     C'est ce que rend « color-mix », dont le jeu se sert déjà à trois endroits,
     et ses composantes vont de zéro à un là où celles de « rgb() » vont à 255.
     Les diviser par 255 comme les autres donnait du presque-noir, donc
     « 1.1:1 » pour un texte crème parfaitement lisible.

     C'est la même faute que le dégradé quelques lignes plus bas, et elle
     coûte la même chose : une mesure fausse envoie corriger ce qui ne l'est
     pas. Le nom de l'espace est retiré avant de chercher les nombres, sinon
     le « 3 » de « display-p3 » passerait pour une composante. */
  const lire = (c) => {
    const espace = /^color\\(/.test(c);
    const n = ((espace ? c.replace(/^color\\(\\s*[a-z0-9-]+/i, '') : c)
      .match(/[\\d.]+/g) ?? []).map(Number);
    const e = espace ? 255 : 1;
    return [(n[0] ?? 0) * e, (n[1] ?? 0) * e, (n[2] ?? 0) * e,
      n.length > 3 ? n[3] : 1];
  };
  const lum = (c) => {
    const [r, g, b] = lire(c).slice(0, 3)
      .map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  /* Le fond réel du texte : on remonte jusqu'au premier ancêtre qui peint
     quelque chose.

     **Un dégradé n'est pas une couleur.** Les plaques du jeu sont peintes au
     linear-gradient, donc leur backgroundColor vaut transparent : la remontée
     les traversait sans les voir et comparait l'encre crème au fond de page.
     D'où des rapports impossibles — 1.1:1 pour BOOSTERS, qui est du crème sur
     du rouge. Une mesure fausse dans un audit est pire que pas de mesure : on
     va corriger ce qui n'est pas cassé.

     On ne devine pas la couleur moyenne d'un dégradé. On dit « pas mesurable »
     et on le compte à part. */
  /* **Un fond translucide se pose sur ce qu'il y a derrière.** Le jeu s'en sert
     partout — une pastille dorée à 8 %, un bandeau blanc à 6 % — et les lire
     comme des couleurs pleines donnait « du doré sur du doré, 1.0:1 » pour un
     texte parfaitement lisible. La couche se compose donc avec la suivante,
     jusqu'à la première opaque, exactement comme le navigateur la peint. */
  const composer = (dessus, dessous) => dessus.map((v, i) => Math.round(
    v * dessus[3] + dessous[i] * (1 - dessus[3])));

  /* **Le grain n'est pas un dégradé.** Depuis le lot 1, toute bâche, tout
     onglet actif et tout panneau calme portent une tuile de grain — une image
     de fond, que la remontée rangeait avec les dégradés. Leurs textes
     sortaient donc du compte, et le compte au soleil s'améliorait pendant que
     la lecture baissait : soixante et onze textes de /repetition tombés sous
     le seuil sur un panneau passé au parpaing, et pas un de compté.

     Une tuile n'est pourtant pas une image comme les autres. C'est un voile
     presque transparent, d'une seule teinte, répété sans motif ni tache (voir
     scripts/grain-images.mjs) : sa moyenne est le fond qu'on lit. La couche
     est donc remplacée par son **voile moyen**, lu sur la tuile servie (voir
     VOILES), et la remontée continue jusqu'à la couleur posée dessous — la
     face de la bâche, le panneau, le fond de la page. Ce n'est ni le grain le
     plus clair ni le plus sombre : c'est ce que l'œil moyenne sous une
     lettre de onze pixels posée sur un grain d'un pixel.

     **Un vrai dégradé et une photo restent non mesurables.** Leur couleur
     change sous la lettre, et la moyenne d'une photo ne dit rien de ce qui
     passe derrière un mot. Une seule exception, géométrique : une couche de
     dégradé qui ne se répète pas et dont le rectangle ne touche pas le texte
     n'est pas **sous** le texte — la bande d'écharpe peinte au bord haut de
     la grande bâche, au-dessus de PRENDRE MA PLACE. Tout ce qui ne se calcule
     pas à coup sûr (une position en calc, un fond fixé à la fenêtre, un texte
     dont on ne retrouve pas la place dans la boîte) reste non mesurable :
     une mesure fausse est pire que pas de mesure, et c'est la leçon des deux
     paragraphes qui précèdent. */

  /* Une liste de couches, coupée sur les virgules du premier niveau : un
     dégradé porte ses propres virgules, entre parenthèses. */
  const decouper = (v) => {
    const morceaux = [];
    let profondeur = 0, debut = 0;
    for (let i = 0; i < v.length; i += 1) {
      if (v[i] === '(') profondeur += 1;
      else if (v[i] === ')') profondeur -= 1;
      else if (v[i] === ',' && profondeur === 0) { morceaux.push(v.slice(debut, i).trim()); debut = i + 1; }
    }
    morceaux.push(v.slice(debut).trim());
    return morceaux;
  };

  /* La couche est-elle une tuile de grain ? « undefined » : non, c'est une
     autre image. « null » : oui, mais son voile n'a pas été lu — non
     mesurable, plutôt que deviné. Sinon son nom et sa couche unie. Le béton
     vient en image-set : on prend la tuile que le navigateur choisit, la
     plus petite résolution qui couvre la densité de l'écran. */
  const voileDe = (couche) => {
    if (!/^(?:url|(?:-webkit-)?image-set)\\(/.test(couche)) return undefined;
    const adresses = [...couche.matchAll(/url\\(\\s*["']?([^"')]+)["']?\\s*\\)\\s*(?:([\\d.]+)(?:x|dppx))?/g)];
    if (!adresses.length || !adresses.every((m) => m[1].includes('/img/grain/'))) return undefined;
    const dpr = window.devicePixelRatio || 1;
    const rangees = adresses.map((m) => ({ url: m[1], x: Number(m[2] ?? 1) })).sort((p, q) => p.x - q.x);
    const url = (rangees.find((r) => r.x >= dpr) ?? rangees[rangees.length - 1]).url;
    const nomTuile = url.replace(/^.*\\/img\\/grain\\//, '').replace(/[.?#].*$/, '');
    if (!(url in VOILES)) return null;
    const v = VOILES[url];
    /* Une tuile absente ne peint rien : la surface est unie, et on la lit
       ainsi — en le disant dans le nom. */
    return v ? { nom: nomTuile, couche: [...v.c, v.a] } : { nom: nomTuile + ' (absente)', couche: [0, 0, 0, 0] };
  };

  /* La place du texte dans la boîte de l'élément qui peint la couche, en
     pixels de mise en page — avant toute rotation, donc juste aussi sur une
     bâche tournée de quelques dixièmes de degré, où les rectangles de
     l'écran se décalent. Mesurée depuis le bord intérieur de la bordure,
     comme une couche de fond se place.

     **Le peintre n'a pas à être positionné.** La chaîne des parents
     positionnés ne passe par lui que s'il l'est ; sinon elle le saute, et le
     texte se retrouve placé dans un ancêtre commun aux deux. On place alors
     le peintre dans ce même ancêtre, et on retranche. L'audit exigeait la
     première chaîne, et la feuille commune avait dû poser « position:
     relative » sur la rubrique du tiroir pour lui seul : c'est à la mesure
     de suivre la page, pas à la page de se plier à la mesure.

     « null » quand on ne sait pas, et la couche reste alors sous le texte :
     une chaîne coupée par un élément fixé à la fenêtre, ou un peintre sauté
     qui défile lui-même — son contenu bouge, sa couche non, et la chaîne
     ne voit pas ce défilement-là. */
  const boiteDuTexte = (el, n) => {
    if (el === n) {
      const s = getComputedStyle(n);
      return [parseFloat(s.paddingLeft), parseFloat(s.paddingTop),
        n.clientWidth - parseFloat(s.paddingRight), n.clientHeight - parseFloat(s.paddingBottom)];
    }
    /* Le texte, dans le repère du premier parent positionné qui n'est pas à
       l'intérieur du peintre : le peintre lui-même quand il est positionné. */
    let x = 0, y = 0, e = el, p = null;
    for (;;) {
      p = e.offsetParent;
      if (!p) return null;
      x += e.offsetLeft - p.scrollLeft;
      y += e.offsetTop - p.scrollTop;
      if (p === n || !n.contains(p)) break;
      x += p.clientLeft; y += p.clientTop;
      e = p;
    }
    if (p !== n) {
      /* Le peintre, dans le même repère : sa propre chaîne, jusqu'au même
         ancêtre — qu'elle doit rencontrer, sinon on ne sait pas. Le
         défilement de l'ancêtre est retranché des deux côtés, il s'annule. */
      if (n.scrollLeft || n.scrollTop) return null;
      let nx = n.clientLeft, ny = n.clientTop;
      for (let q = n; q !== p;) {
        const r = q.offsetParent;
        if (!r) return null;
        nx += q.offsetLeft - r.scrollLeft;
        ny += q.offsetTop - r.scrollTop;
        if (r !== p) { nx += r.clientLeft; ny += r.clientTop; }
        q = r;
      }
      x -= nx; y -= ny;
    }
    return [x, y, x + el.offsetWidth, y + el.offsetHeight];
  };

  /* La couche i de n laisse-t-elle le texte de el à découvert ? Seulement
     un dégradé, posé une fois, dans la boîte de remplissage, qui défile avec
     elle, et dont le rectangle se calcule en pixels ou en pour cent. */
  const coucheHorsDuTexte = (n, s, i, couche, el) => {
    if (!/^(?:repeating-)?(?:linear|radial|conic)-gradient\\(/.test(couche)) return false;
    const pris = (v) => { const l = decouper(v); return l[i % l.length]; };
    if (!/^no-repeat(?: no-repeat)?$/.test(pris(s.backgroundRepeat))) return false;
    if (pris(s.backgroundOrigin) !== 'padding-box' || pris(s.backgroundAttachment) !== 'scroll') return false;
    const W = n.clientWidth, H = n.clientHeight;
    const longueur = (v, tout) => (v === undefined || v === 'auto' ? tout
      : /^-?[\\d.]+px$/.test(v) ? parseFloat(v)
        : /^-?[\\d.]+%$/.test(v) ? (parseFloat(v) / 100) * tout : NaN);
    const t = pris(s.backgroundSize).split(/\\s+/);
    const [w, h] = /^(?:cover|contain)$/.test(t[0]) ? [W, H] : [longueur(t[0], W), longueur(t[1], H)];
    const MOTS = { left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' };
    const place = (v, libre) => {
      const u = MOTS[v] ?? v;
      return /^-?[\\d.]+px$/.test(u) ? parseFloat(u)
        : /^-?[\\d.]+%$/.test(u) ? (parseFloat(u) / 100) * libre : NaN;
    };
    const p = pris(s.backgroundPosition).split(/\\s+/);
    if (p.length !== 2) return false;
    const x = place(p[0], W - w), y = place(p[1], H - h);
    if (![w, h, x, y].every(Number.isFinite)) return false;
    if (w <= 0 || h <= 0) return true;
    const b = boiteDuTexte(el, n);
    if (!b) return false;
    return x >= b[2] || x + w <= b[0] || y >= b[3] || y + h <= b[1];
  };

  /* Le fond, et les tuiles traversées pour l'atteindre. « null » : non
     mesurable. Mémorisé : le contraste ordinaire, celui du jour et le
     rapport le demandent chacun pour le même texte. */
  const memoFond = new Map();
  const fondDetaille = (el) => {
    if (memoFond.has(el)) return memoFond.get(el);
    const couches = [];
    const grains = [];
    let illisible = false;
    let n = el;
    pile: while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundImage && s.backgroundImage !== 'none') {
        const images = decouper(s.backgroundImage);
        for (let i = 0; i < images.length; i += 1) {
          /* Une couche sans image : « url(…) repeat, var(--face) » en fait
             une, celle qui ne porte que la couleur. */
          if (images[i] === 'none') continue;
          const v = voileDe(images[i]);
          if (v === undefined && coucheHorsDuTexte(n, s, i, images[i], el)) continue;
          if (!v) { illisible = true; break pile; }
          grains.push(v.nom);
          /* La première couche de la liste est peinte au-dessus : l'ordre de
             la pile est celui de la liste, puis la couleur de l'élément. */
          if (v.couche[3] > 0) couches.push(v.couche);
        }
      }
      const c = lire(s.backgroundColor);
      if (c[3] > 0) {
        couches.push(c);
        if (c[3] >= 0.999) break;   /* opaque : rien derrière ne se voit plus */
      }
      n = n.parentElement;
    }
    let r = null;
    if (!illisible) {
      /* Le fond de la page ferme la pile : si on est sorti de la boucle sans
         rencontrer d'opaque, c'est lui qu'on voit à travers. */
      let out = [10, 13, 17, 1];
      if (couches.length && couches[couches.length - 1][3] >= 0.999) out = couches.pop();
      for (let i = couches.length - 1; i >= 0; i -= 1) out = [...composer(couches[i], out), 1];
      r = { rgb: \`rgb(\${out[0]}, \${out[1]}, \${out[2]})\`, grains };
    }
    memoFond.set(el, r);
    return r;
  };
  const fond = (el) => fondDetaille(el)?.rgb ?? null;
  const contraste = (el) => {
    const s = getComputedStyle(el);
    const o = Number(s.opacity);
    const f = fond(el);
    if (f === null) return null;
    /* Le texte aussi peut être translucide : le jeu écrit beaucoup en
       rgba(…, .6). Comme pour le fond, on le pose sur ce qui est derrière
       avant de le mesurer — sinon on note la couleur annoncée, pas celle
       qui arrive à l'œil. */
    const enc = lire(s.color);
    const pose = enc[3] >= 0.999 ? enc : composer(enc, lire(f));
    const a = lum('rgb(' + pose[0] + ',' + pose[1] + ',' + pose[2] + ')'), b = lum(f);
    let r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    /* L'opacité n'est pas dans la couleur calculée : un texte à .45 se lit
       beaucoup moins bien que ce que la couleur annonce, et c'est justement le
       cas le plus fréquent dans ce jeu. On l'applique à la main. */
    if (o < 1) r = 1 + (r - 1) * o;
    return r;
  };
  /* **Tourné de dos.** Une carte qu'on retourne porte ses deux faces l'une
     contre l'autre, et celle qui regarde le fond de l'écran est cachée par
     « backface-visibility: hidden » — sans « display », sans « visibility »,
     avec une boîte de la bonne taille. À l'ouverture d'un booster, les
     quatre cartes encore à retourner portaient ainsi leur face cachée, et
     l'audit relevait leurs « ÉVO 1 » sous 11 px : quatre textes que personne
     ne peut voir.

     Une face est de dos quand la normale de son plan, portée par les
     transformations de son contexte 3D (elle-même, puis chaque parent tant
     que son propre parent garde la 3D), pointe vers le fond : la troisième
     composante de la matrice composée est négative. Les translations et
     l'origine ne tournent rien et sont ignorées ; « rotate », posée à part
     de « transform », est composée avec elle. */
  const memoDos = new Map();
  const matriceDe = (s) => {
    let m = new DOMMatrix();
    const r = s.rotate;
    if (r && r !== 'none') {
      const v = r.trim().split(/\\s+/);
      const angle = parseFloat(v[v.length - 1]) * (/rad$/.test(v[v.length - 1]) ? 180 / Math.PI
        : /turn$/.test(v[v.length - 1]) ? 360 : 1);
      const axe = v.length === 1 ? [0, 0, 1] : v.length === 2 ? { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }[v[0]]
        : v.slice(0, 3).map(Number);
      if (axe) m = m.rotateAxisAngle(axe[0], axe[1], axe[2], angle);
    }
    if (s.transform && s.transform !== 'none') m = m.multiply(new DOMMatrix(s.transform));
    return m;
  };
  const faceDeDos = (f) => {
    if (memoDos.has(f)) return memoDos.get(f);
    let m = new DOMMatrix();
    for (let n = f; n; n = n.parentElement) {
      m = matriceDe(getComputedStyle(n)).multiply(m);
      const p = n.parentElement;
      if (!p || getComputedStyle(p).transformStyle !== 'preserve-3d') break;
    }
    const r = m.m33 < 0;
    memoDos.set(f, r);
    return r;
  };
  /* Lui ou un ancêtre : mémorisé, comme l'opacité, puisque tout le
     document passe par ici. */
  const memoDeDos = new Map();
  const deDos = (el) => {
    if (!el || el.nodeType !== 1 || el === document.documentElement) return false;
    if (memoDeDos.has(el)) return memoDeDos.get(el);
    const r = (getComputedStyle(el).backfaceVisibility === 'hidden' && faceDeDos(el)) || deDos(el.parentElement);
    memoDeDos.set(el, r);
    return r;
  };
  /* **Rogné à rien.** Un mot pour le lecteur d'écran seul (« .tbf-vh » de
     ui.css, « .vh » du profil et du classement, « .long » du virage) garde
     une boîte d'un pixel, sans « display: none » ni « visibility: hidden »
     (le lecteur ne le dirait plus), et c'est sa propre découpe qui l'efface :
     « clip-path: inset(50%) ». Rien ici ne la lisait, et « cache », plus
     bas, ne regarde que les ancêtres qui coupent : le prix « 25 écharpes »
     de la vitrine était relevé deux fois, la seconde par « écharpes », un
     mot que personne ne voit, compté parmi les textes et pâle au soleil.

     Est rogné à rien ce que sa découpe, ou celle d'un ancêtre, ne laisse pas
     peint sur plus d'un pixel dans un sens : un « clip-path: inset() » dont
     les retraits se rejoignent, un « clip: rect() » vide sur une boîte
     positionnée, ou une boîte d'un pixel sur un qui coupe ce qui la dépasse
     (la forme ancienne du même mot ; d'un pixel dans les deux sens, pour
     qu'un tiroir replié à hauteur nulle reste à « cache » : le contraste
     relève encore ce qu'un ancêtre coupe ainsi, et le changer déplacerait
     tous les relevés d'avant). La découpe se pose sur la boîte de mise en
     page, avant toute transformation : c'est là qu'on lit sa taille. Une
     autre forme, une autre boîte de référence, une longueur en calc() ne se
     calculent pas ici : tenues pour visibles, comme avant. Une boîte
     « display: contents » n'existe pas, elle ne découpe rien. */
  const enPixels = (v, tout) => (/^-?[\\d.]+%$/.test(v) ? (parseFloat(v) / 100) * tout
    : /^-?[\\d.]+(?:px)?$/.test(v) ? parseFloat(v) : NaN);
  const rogneSoi = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'contents') return false;
    const html = el instanceof HTMLElement;
    const b = html ? null : el.getBoundingClientRect();
    const W = html ? el.offsetWidth : b.width;
    const H = html ? el.offsetHeight : b.height;
    const ip = /^inset\\((.*)\\)(?:\\s+border-box)?$/.exec(s.clipPath ?? '');
    if (ip) {
      /* Un à quatre retraits, dans l'ordre haut, droite, bas, gauche, comme
         une marge ; l'arrondi qui suit « round » ne retire rien. */
      const [h, d = h, bas = h, g = d] = ip[1].split(/\\s+round\\s+/)[0].trim().split(/\\s+/);
      const n = [enPixels(h, H), enPixels(d, W), enPixels(bas, H), enPixels(g, W)];
      if (n.every(Number.isFinite) && (W - n[1] - n[3] <= 1 || H - n[0] - n[2] <= 1)) return true;
    }
    const cl = /^rect\\((.*)\\)$/.exec(s.clip ?? '');
    if (cl && /^(?:absolute|fixed)$/.test(s.position)) {
      /* Haut et bas depuis le bord haut, droite et gauche depuis le bord
         gauche ; « auto » est le bord de la boîte. */
      const [h, d, bas, g] = cl[1].split(/[\\s,]+/).filter(Boolean)
        .map((v, i) => (v === 'auto' ? [0, W, H, 0][i] : enPixels(v, NaN)));
      if ([h, d, bas, g].every(Number.isFinite) && (d - g <= 1 || bas - h <= 1)) return true;
    }
    if (html && s.display !== 'inline' && /^(?:hidden|clip)$/.test(s.overflowX)
        && /^(?:hidden|clip)$/.test(s.overflowY) && el.clientWidth <= 1 && el.clientHeight <= 1) return true;
    return false;
  };
  /* Lui ou un ancêtre : une découpe vaut pour tout ce que la boîte peint.
     Mémorisé, comme « deDos ». */
  const memoRogne = new Map();
  const rogne = (el) => {
    if (!el || el.nodeType !== 1 || el === document.documentElement) return false;
    if (memoRogne.has(el)) return memoRogne.get(el);
    const r = rogneSoi(el) || rogne(el.parentElement);
    memoRogne.set(el, r);
    return r;
  };
  /* Une boîte qui a une taille, ni « display: none » ni « visibility:
     hidden », ni de dos : ce que « visible » voulait dire avant « Rogné à
     rien ». Gardé à part pour nommer ce que la découpe seule écarte
     (« rognes », dans la boucle). */
  const boiteVue = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && !deDos(el);
  };
  const visible = (el) => boiteVue(el) && !rogne(el);
  /* Le conteneur qui défile au-dessus d'un élément, s'il y en a un. Ce qui sort
     d'un carrousel n'est pas « hors écran » : il est **plus loin dans le
     carrousel**, et c'est exactement à ça qu'il sert. La bande des jours de
     /matchs sortait ainsi à 188 px, trois fois, sans qu'il y ait rien à
     corriger. */
  const defilant = (el) => {
    let n = el.parentElement;
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n);
      /* Qui defile, ou qui coupe. Les deux disent la meme chose : ce qui
         depasse ici ne depasse pas a l ecran. L ecran d ouverture pose une
         photo en plein cadre et la fait respirer de trois pour cent — elle
         sort donc de sept a quinze pixels, et le cadre la coupe exactement
         comme prevu. L audit annoncait un debordement. */
      if (/auto|scroll|hidden|clip/.test(s.overflowX)) return n;
      n = n.parentElement;
    }
    return null;
  };
  /* Plus strict, pour « Hors de la fenêtre » : un conteneur qui défile
     **vraiment** dans ce sens-là, entre le texte et l'état mesuré compris.
     Un cadre qui coupe ne ramène rien, il cache. Au-delà de l'état, rien ne
     compte : il est fixé, et la page qui défile dessous ne le déplace pas. */
  const defileVers = (el, axe) => {
    for (let n = el === ZONE ? el : el.parentElement; n; n = n.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(n)[axe])) return true;
      if (n === ZONE) break;
    }
    return false;
  };

  const nom = (el) => {
    const t = (el.textContent ?? '').replace(/\\s+/g, ' ').trim().slice(0, 40);
    return \`\${el.tagName.toLowerCase()}\${el.id ? '#' + el.id : ''}\${
      el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\\s+/).slice(0, 2).join('.') : ''}\${
      t ? ' « ' + t + ' »' : ''}\`;
  };

  /* ------------------------------------ ce que le socle FAIT MAIN mesure

     **Un texte à lui.** Le contraste ne regarde que les feuilles, pour ne pas
     répéter le défaut d'un enfant dans chaque conteneur. La taille et
     l'opacité ne peuvent pas s'en contenter : « 12 écharpes » écrit dans un
     paragraphe qui contient aussi un lien n'est pas une feuille, et c'est
     pourtant du texte. On retient donc tout élément qui porte **directement**
     un nœud texte avec au moins une lettre ou un chiffre — une puce « · »
     ou une croix « ✕ » sont des signes, pas des phrases. */
  const texteDirect = (el) => {
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return /[\\p{L}\\p{N}]/u.test(t);
  };
  /* **Caché par un ancêtre qui coupe.** Un tiroir replié à hauteur nulle, un
     texte glissé hors d'un cadre « overflow: hidden » : il a une boîte, il
     n'est ni « display: none » ni « visibility: hidden », et personne ne peut
     le lire. Le compter enverrait corriger un texte que personne ne voit. Un
     conteneur qui défile, lui, ne cache rien : on y fait venir le texte au
     doigt, donc il reste compté. Ce qui se découpe lui-même à rien (un mot
     pour le lecteur d'écran seul) n'arrive pas jusqu'ici : « visible »
     l'écarte de tout relevé, voir « Rogné à rien ». */
  const cache = (el) => {
    const r = el.getBoundingClientRect();
    for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      const ov = s.overflowX + ' ' + s.overflowY;
      if (!/hidden|clip/.test(ov) || /auto|scroll/.test(ov)) continue;
      const c = n.getBoundingClientRect();
      if (r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom) return true;
    }
    return false;
  };
  /* **L'opacité se multiplie en descendant.** Un texte à 0,8 dans un bloc à
     0,7 s'affiche à 0,56, et aucune des deux règles ne le dit seule. On
     remonte donc toute la lignée — filtre « opacity() » compris, qui fait la
     même chose sous un autre nom — en gardant chaque produit : les frères
     partagent leurs ancêtres, inutile de refaire le chemin pour chacun. */
  const memoOpacite = new Map();
  const opacites = (el) => {
    if (!el || el.nodeType !== 1) return 1;
    if (memoOpacite.has(el)) return memoOpacite.get(el);
    const s = getComputedStyle(el);
    let o = Number(s.opacity);
    const f = /opacity\\(([\\d.]+)(%?)\\)/.exec(s.filter);
    if (f) o *= Number(f[1]) / (f[2] ? 100 : 1);
    o *= opacites(el.parentElement);
    memoOpacite.set(el, o);
    return o;
  };
  /* **La taille rendue, pas la taille déclarée.** Une carte de collection est
     une carte de fiche réduite par « transform: scale » : sa police annonce
     14 px et en affiche neuf. On multiplie donc la taille calculée par
     l'échelle de chaque ancêtre — la longueur du premier vecteur de la
     matrice, qui reste juste quand la carte est aussi tournée — et par la
     propriété « scale », qui ne passe pas par « transform ». */
  const memoEchelle = new Map();
  const echelle = (el) => {
    if (!el || el.nodeType !== 1) return 1;
    if (memoEchelle.has(el)) return memoEchelle.get(el);
    const s = getComputedStyle(el);
    let k = 1;
    if (s.transform && s.transform !== 'none') {
      const v = (s.transform.slice(s.transform.indexOf('(') + 1)
        .match(/-?[\\d.]+(?:e-?\\d+)?/g) ?? []).map(Number);
      k = s.transform.startsWith('matrix3d') ? Math.hypot(v[0], v[1], v[2]) : Math.hypot(v[0], v[1]);
    }
    if (s.scale && s.scale !== 'none') k *= Number(s.scale.split(' ')[0]) || 1;
    k *= echelle(el.parentElement);
    memoEchelle.set(el, k);
    return k;
  };
  /* **Au soleil.** Un écran en plein jour se lit comme s'il portait un voile
     blanc : la lumière réfléchie s'ajoute à celle qu'il émet, autant sur le
     texte que sur le fond, et l'écart entre les deux fond. On mêle donc les
     deux à du blanc avant de mesurer.

     L'encre est d'abord posée sur son fond **à travers toutes ses
     opacités** : c'est ce qui arrive à l'œil, soleil ou pas. Le contraste
     ordinaire, plus haut, n'applique que l'opacité de l'élément lui-même ; il
     n'est pas retouché, pour que ses relevés d'avant se comparent encore. */
  const auSoleil = (c) => c.slice(0, 3).map((v) => v * (1 - SEUILS.voileJour) + 255 * SEUILS.voileJour);
  const contrasteJour = (el) => {
    const f = fond(el);
    if (f === null) return null;
    const dessous = lire(f);
    const enc = lire(getComputedStyle(el).color);
    const a = enc[3] * opacites(el);
    if (a < 0.02) return undefined;
    const pose = composer([enc[0], enc[1], enc[2], a], dessous);
    const t = auSoleil(pose), d = auSoleil(dessous);
    const lt = lum('rgb(' + t.join(',') + ')'), ld = lum('rgb(' + d.join(',') + ')');
    return (Math.max(lt, ld) + 0.05) / (Math.min(lt, ld) + 0.05);
  };

  /* **La police du joueur, ou celle de secours ?** Une police que la page
     déclare (Google Fonts compris) et qui n'a pas chargé laisse le
     navigateur dessiner le texte dans la suivante de la liste : d'autres
     largeurs, d'autres retours à la ligne, d'autres coupes. Le relevé était
     pris quand même, et rien ne le disait — c'est ainsi que le tiroir a été
     mesuré tronqué là où le joueur le lit entier. On compte donc les textes
     dont la première famille est une police déclarée que la page n'a pas
     pour ces lettres-là : en échec, ou encore en route.

     Une famille que la page ne déclare pas n'est pas jugée : police du
     système ou police oubliée, la page ne permet pas de les distinguer
     d'ici, et une alerte qu'on ne sait pas justifier ne se corrige pas.

     **Œ et œ, relevés à tort.** « document.fonts.check » répond non dès
     qu'une face déclarée pour l'un des caractères n'est pas chargée — même
     quand une autre face chargée de la même police le couvre et le dessine.
     Google découpe Oswald en tranches : la latine, chargée, couvre Œ et œ ;
     la latin-ext les couvre aussi, et le navigateur ne la demande jamais
     puisque la latine suffit. « LE COUP D'ŒIL » de /repetition était donc
     relevé en police de secours. Vu au banc avec ce Chrome : check() faux
     sur ce titre, vrai sur « LE COUP D'OEIL », et la police réellement
     employée, lue par le protocole de débogage, « Oswald-SemiBold » pour
     chacun de ses treize glyphes.

     Quand check() dit non, on juge donc caractère par caractère : un
     caractère est en repli quand la police déclare au moins une face de ce
     poids et de ce style pour lui, et qu'aucune n'est chargée. Un caractère
     qu'aucune face ne couvre n'est pas jugé — le navigateur le prend dans la
     police suivante, c'est prévu (une flèche que la tranche latine n'a pas),
     et check() ne le jugeait pas non plus. Quand check() dit oui, rien ne
     change : le relevé ne peut que perdre des alertes fausses. */
  const FACES = [...(document.fonts ?? [])];
  const nomFamille = (f) => f.family.replace(/^["']|["']$/g, '');
  const FAMILLES = new Set(FACES.map(nomFamille));
  /* « 500 », « 200 700 » (une police variable), « normal », « bold ». */
  const poidsDe = (v) => {
    const n = String(v).trim().split(/\\s+/)
      .map((x) => (x === 'normal' ? 400 : x === 'bold' ? 700 : Number(x)));
    return [n[0], n[1] ?? n[0]];
  };
  /* Les faces que le navigateur retient pour ce poids et ce style : le
     poids demandé s'il est déclaré, sinon le plus proche dans l'ordre de la
     règle CSS — vers le gras au-dessus de 500, vers le maigre sous 400, et
     entre les deux d'abord jusqu'à 500. Le style demandé s'il existe, sinon
     tous : le navigateur penche alors une face droite. */
  const memoFaces = new Map();
  const facesRetenues = (fam, poids, style) => {
    const cle = fam + '|' + poids + '|' + style;
    if (memoFaces.has(cle)) return memoFaces.get(cle);
    const genre = (v) => (/^oblique/.test(v) ? 'oblique' : v);
    const famille = FACES.filter((f) => nomFamille(f) === fam);
    const memeStyle = famille.filter((f) => genre(f.style) === genre(style));
    const faces = memeStyle.length ? memeStyle : famille;
    const w = Number(poids) || 400;
    const plages = faces.map((f) => poidsDe(f.weight));
    let retenu;
    if (plages.some(([a, b]) => a <= w && w <= b)) retenu = w;
    else {
      const dessus = plages.map(([a]) => a).filter((a) => a > w).sort((x, y) => x - y);
      const dessous = plages.map(([, b]) => b).filter((b) => b < w).sort((x, y) => y - x);
      retenu = w >= 400 && w <= 500 ? (dessus.find((a) => a <= 500) ?? dessous[0] ?? dessus[0])
        : w < 400 ? (dessous[0] ?? dessus[0]) : (dessus[0] ?? dessous[0]);
    }
    const r = retenu === undefined ? []
      : faces.filter((f) => { const [a, b] = poidsDe(f.weight); return a <= retenu && retenu <= b; });
    memoFaces.set(cle, r);
    return r;
  };
  /* « U+0-FF, U+131, U+152-153 », et les jokers « U+4?? ». Sans plage
     déclarée, une face couvre tout. */
  const memoPlages = new Map();
  const couvre = (f, cp) => {
    if (!memoPlages.has(f)) {
      memoPlages.set(f, (f.unicodeRange || 'U+0-10FFFF').split(',').map((p) => {
        const v = p.trim().replace(/^U\\+/i, '');
        if (v.includes('?')) return [parseInt(v.replace(/\\?/g, '0'), 16), parseInt(v.replace(/\\?/g, 'F'), 16)];
        const [a, b] = v.split('-');
        return [parseInt(a, 16), parseInt(b ?? a, 16)];
      }));
    }
    return memoPlages.get(f).some(([a, b]) => cp >= a && cp <= b);
  };
  const enRepli = (el, s) => {
    const fam = s.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
    if (!FAMILLES.has(fam)) return null;
    let t = '';
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    try {
      if (document.fonts.check(s.fontStyle + ' ' + s.fontWeight + ' 16px "' + fam + '"', t.trim())) return null;
    } catch { return null; }
    const faces = facesRetenues(fam, s.fontWeight, s.fontStyle);
    for (const ch of new Set(t)) {
      if (/\\s/.test(ch)) continue;
      const cp = ch.codePointAt(0);
      const pour = faces.filter((f) => couvre(f, cp));
      if (pour.length && !pour.some((f) => f.status === 'loaded')) return fam + ' ' + s.fontWeight;
    }
    return null;
  };

  /* Les lignes d'un texte, comptées sur les boîtes de ses fragments : une
     par hauteur, à une demi-police près, pour qu'un mot plus haut que ses
     voisins ne fasse pas une ligne de plus. Chrome met en page les lignes
     qu'une coupe à la ligne cache, et leurs boîtes répondent : c'est ce qui
     permet de dire « trois lignes pour deux » sans toucher à la page — ni
     copie à mesurer, ni style posé puis retiré. Voir « Coupé à la ligne »,
     plus bas. */
  const lignesDe = (el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    const hauts = [...r.getClientRects()].filter((x) => x.width > 0.5 && x.height > 0.5)
      .map((x) => x.top).sort((a, b) => a - b);
    const pas = parseFloat(getComputedStyle(el).fontSize) / 2;
    let n = 0, dernier = -Infinity;
    for (const h of hauts) if (h - dernier > pas) { n += 1; dernier = h; }
    return n;
  };

  /* **Le petit or** : une encre dorée sous la taille du grand texte (voir
     DORE, au-dessus de ce gabarit dans le fichier). La teinte, la saturation
     et la luminosité se lisent sur la couleur calculée, comme le banc de la
     boutique les lit ; « color(srgb …) » passe par lire, comme partout. Le
     grand texte est celui du seuil de contraste à 3:1, plus bas : c'est là,
     et là seulement, que l'or s'écrit encore. */
  const DORE = ${JSON.stringify(DORE)};
  const dore = (c) => {
    const [r, g, b, a] = lire(c);
    if (a < DORE.alpha) return false;
    const R = r / 255, G = g / 255, B = b / 255;
    const M = Math.max(R, G, B), m = Math.min(R, G, B), l = (M + m) / 2;
    if (M === m) return false;
    const d = M - m;
    const sat = l > 0.5 ? d / (2 - M - m) : d / (M + m);
    const h = 60 * (M === R ? (G - B) / d + (G < B ? 6 : 0) : M === G ? (B - R) / d + 2 : (R - G) / d + 4);
    return h >= DORE.teinte[0] && h <= DORE.teinte[1] && sat > DORE.saturation && l > DORE.luminosite;
  };
  const grandTexte = (s) => {
    const t = parseFloat(s.fontSize);
    return t >= 24 || (t >= 18.66 && Number(s.fontWeight) >= 700);
  };
  /* Le relevé où ranger un petit or : l'exception de la légendaire à part. */
  const ouRangerOr = (el) => (el.closest(DORE.legendaire) ? out.orLegendaire : out.petitOr);

  /* Les textes lus à travers une tuile de grain sont **comptés à part** :
     surGrain et palesGrain, jourSurGrain et jourGrain. Le compte « pâle au
     jour » de la fin du lot 1 ne les voyait pas ; les y verser d'un coup
     ferait lire une régression là où un angle mort se ferme. Et « sur
     dégradé » ne compte plus que ce qui reste non mesurable : l'ancien vaut
     le nouveau plus surGrain. */
  /* Un état fixé à la fenêtre ne défile pas avec la page : voir « Hors de
     la fenêtre ». Le relevé n'existe que là — un zéro qu'on n'a pas mesuré
     se lirait comme un bon résultat. */
  const FIXE = Boolean(ZONE) && getComputedStyle(ZONE).position === 'fixed';
  const out = { deborde: 0, horsEcran: [], coupes: [], petits: [], pales: [],
    sansAlt: [], cassees: [], surDegrade: 0, sousDecor: [],
    textes: 0, petitTexte: [], opacite: [], toleres: [], backdrop: [],
    jour: [], jourSurDegrade: 0,
    surGrain: 0, palesGrain: [], jourSurGrain: 0, jourGrain: [],
    coupesLignes: [], enRepli: [],
    /* Voir « Le contraste, sur ce qui porte un texte à soi », plus bas. */
    horsFeuille: { textes: 0, surDegrade: 0, surGrain: 0, jourSurDegrade: 0, jourSurGrain: 0 },
    horsContraste: [],
    /* Voir « Le petit or », plus haut. */
    petitOr: [], orLegendaire: [],
    /* Voir « Rogné à rien », plus haut, et la boucle. */
    rognes: [],
    ...(FIXE ? { horsFenetre: [] } : {}) };

  /* **Le décor peut passer devant le texte, et rien ne le disait.**

     \`nav.js\` pose deux calques en frères de la colonne — la photo de tribune
     et son voile — en \`position:fixed\`. Un fond fixé crée son propre contexte
     d'empilement et gagne contre un élément statique, même déclaré avant lui.
     \`ui.css\` le sait et relève \`#app\` à \`position:relative;z-index:1\` — mais
     la règle vise un identifiant, et la page de l'abonnement avait un \`main\`
     sans identifiant. Toute sa colonne se lisait à travers une tribune floue :
     titre, liste, intitulés du tableau, colonne « avec ».

     **\`elementFromPoint\` ne peut pas le voir.** Le décor porte
     \`pointer-events:none\` — il doit se laisser traverser au doigt — donc la
     méthode qui dit « qu'y a-t-il à cet endroit » répond le contenu, celui-là
     même qu'on ne voit pas. Une page entièrement illisible passait l'audit
     sans une alerte.

     On compare donc l'empilement plutôt que le pointage : tout bloc de premier
     niveau qui porte du texte doit gagner contre le décor, c'est-à-dire être
     positionné et porter un \`z-index\` supérieur.

     Pas quand la mesure a une portée : l'état mesuré est posé par-dessus la
     page, et c'est la page qu'on relèverait. */
  if (!ZONE) {
    const decors = [...document.querySelectorAll('.tbf-decor,.tbf-grad')];
    if (decors.length) {
      const zDecor = Math.max(...decors.map((d) => Number(getComputedStyle(d).zIndex) || 0));
      for (const el of document.body.children) {
        if (decors.includes(el)) continue;
        if (!(el.textContent ?? '').trim()) continue;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        /* Sans boîte, rien à masquer : les balises \`script\` et \`template\`
           portent du texte et n'occupent pas un pixel. */
        if (r.height < 1 || s.display === 'none' || s.visibility === 'hidden') continue;
        const z = s.position === 'static' ? NaN : Number(s.zIndex);
        if (!Number.isFinite(z) || z <= zDecor) {
          out.sousDecor.push({ q: nom(el), z: s.zIndex, pos: s.position, zDecor });
        }
      }
    }
  }

  /* Le débordement de côté. Sous une portée fixée, c'est celui de l'état :
     la page dessous a son propre relevé, et au format de 320 px, où les
     pages ne sont pas visitées, on aurait mis au compte du rideau ce que fait
     l'accueil. Un état qui défile de côté se fait glisser au doigt comme une
     page ; un état qui coupe ne glisse pas, et ce qu'il pousse dehors est
     relevé plus bas, texte par texte. Un élément fixé n'agrandit jamais la
     page : sans cette règle, le relevé ne pouvait rien dire de lui. */
  out.deborde = !FIXE ? Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
    : /auto|scroll/.test(getComputedStyle(ZONE).overflowX)
      ? Math.max(0, ZONE.scrollWidth - ZONE.clientWidth) : 0;

  const tous = ZONE ? [ZONE, ...ZONE.querySelectorAll('*')] : document.querySelectorAll('*');
  for (const el of tous) {
    /* Le flou d'arrière-plan se relève **avant** le filtre de visibilité : un
       dialogue replié qui le porte le recalculera dès qu'il s'ouvrira, et
       c'est la surface qui compte, pas l'instant. Les pseudo-éléments aussi —
       un voile posé en ::before floute aussi bien que la boîte. */
    for (const pseudo of [null, '::before', '::after']) {
      const s = pseudo ? getComputedStyle(el, pseudo) : getComputedStyle(el);
      if (pseudo && (s.content === 'none' || s.content === 'normal')) continue;
      const v = s.backdropFilter || s.webkitBackdropFilter;
      if (v && v !== 'none') {
        out.backdrop.push({ q: nom(el), pseudo, v, visible: visible(el) });
      }
    }

    /* « visible », en deux temps : la boîte, puis la découpe. */
    const vue = boiteVue(el);
    if (!vue || rogne(el)) {
      /* **Les textes rognés à rien** (voir plus haut) : les mots pour le
         lecteur d'écran seul, ou ce qu'une découpe efface à cet instant.
         Nommés, pour qu'un relevé d'avant se retrouve. On n'y range que ce
         que « textes » comptait, à la même règle (plus bas) : le « textes »
         d'avant vaut le nouveau plus eux. Les trouvailles qu'ils faisaient
         (au soleil surtout) sortent des listes sous ces noms, avec celles
         d'un mot posé dedans, que leur boîte d'un pixel coupait déjà
         (« cache ») mais que le contraste relevait. */
      if (vue && texteDirect(el) && !cache(el)
          && opacites(el) * lire(getComputedStyle(el).color)[3] >= 0.02) {
        out.rognes.push({ q: nom(el) });
      }
      continue;
    }
    const r = el.getBoundingClientRect();

    /* Hors écran à gauche ou à droite. On tolère un pixel : les bordures et les
       arrondis en font gagner ou perdre un, et une alerte par arrondi est une
       alerte qu'on apprend à ignorer. */
    if (el.children.length === 0 && (r.left < -1 || r.right > window.innerWidth + 1)
        && !defilant(el)) {
      out.horsEcran.push({ q: nom(el), de: Math.round(Math.max(-r.left, r.right - window.innerWidth)) });
    }

    /* **Hors de la fenêtre**, sous une portée fixée. Une page défile : ce qui
       passe sous le bas de l'écran s'y ramène au doigt, et seul le côté
       compte (« hors écran », juste au-dessus). Un état fixé à la fenêtre ne
       défile pas avec elle : un texte poussé sous son bord ne se lira jamais.
       Et comme le rideau coupe ce qui dépasse, « cache » le retire même du
       compte des textes — la panne restait muette. C'est celle qu'on attend
       d'un téléphone de 568 px de haut.

       Les quatre côtés, un pixel de tolérance, tout texte à soi qui n'est pas
       éteint (la sortie de secours attend ses douze secondes à zéro), sauf
       dans un conteneur qui défile dans ce sens-là : le tiroir défile, et ce
       qui dépasse en bas y est plus loin, pas perdu. */
    if (FIXE && texteDirect(el) && opacites(el) * lire(getComputedStyle(el).color)[3] >= 0.02) {
      const cote = Math.max(-r.left, r.right - window.innerWidth);
      const bas = Math.max(-r.top, r.bottom - window.innerHeight);
      const de = Math.max(cote > 1 && !defileVers(el, 'overflowX') ? cote : 0,
        bas > 1 && !defileVers(el, 'overflowY') ? bas : 0);
      if (de > 0) out.horsFenetre.push({ q: nom(el), de: Math.round(de) });
    }

    /* Coupé par une ellipse. \`scrollWidth > clientWidth\` est la seule façon de
       le voir : l'ellipse ne change ni le texte ni le rectangle. */
    /* **Seulement l ellipse.** Un cadre qui coupe une image decorative fait son
       travail ; une phrase coupee par « text-overflow: ellipsis » ment sans le
       dire, et c est celle-la qu on cherche. Restreindre la mesure a l ellipse
       enleve d un coup les faux positifs des conteneurs a overflow:hidden sans
       perdre une seule vraie troncature sur une ligne — elles portent toutes
       la propriete. Pas celles de « line-clamp », qui ont leurs points de
       suspension sans elle : elles ont leur relevé, juste en dessous. */
    const sc = getComputedStyle(el);
    if (el.scrollWidth > el.clientWidth + 1
        && sc.textOverflow === 'ellipsis'
        && (el.textContent ?? '').trim().length > 2) {
      out.coupes.push({ q: nom(el), de: el.scrollWidth - el.clientWidth });
    } else {
      /* **Coupé à la ligne.** « line-clamp » arrête un texte à sa dernière
         ligne permise et pose ses points de suspension sans changer ni le
         texte ni la largeur : la mesure d'au-dessus ne le voyait pas, et le
         tiroir à 768 px relevait zéro coupe sous une capture qui montrait
         « CLASSEMENT DES… ». Chrome met pourtant en page les lignes cachées :
         leurs boîtes se comptent (lignesDe), et la hauteur à faire défiler
         les contient.

         **Les deux à la fois.** Plus de lignes que la limite, seules : une
         règle de coupe que la mise en page n'applique pas (sur une boîte qui
         n'est pas « -webkit-box ») ne coupe rien, et ses quatre lignes se
         lisent. Une hauteur qui dépasse, seule : une police haute sur une
         interligne serrée (Oswald à 15 px sur 16) déborde de trois pixels
         sous une seule ligne entière — vu au banc sur la bâche du jour du
         hub, dès qu'Oswald a vraiment chargé. Relevé **à part** des
         ellipses, pour que « coupes » se compare encore à un relevé d'avant ;
         le témoin, plus bas dans ce fichier, vérifie à chaque audit que le
         navigateur se comporte toujours ainsi. */
      const limite = [sc.webkitLineClamp, sc.lineClamp].map((v) => parseInt(v, 10)).find((v) => v > 0);
      if (limite && el.scrollHeight > el.clientHeight + 1
          && (el.textContent ?? '').trim().length > 2) {
        const lignes = lignesDe(el);
        if (lignes > limite) {
          out.coupesLignes.push({ q: nom(el), limite, lignes, de: el.scrollHeight - el.clientHeight });
        }
      }
    }

    /* Une zone de touche. On ne regarde que ce qui se touche vraiment. */
    /* Une zone de touche. **Sauf un lien dans une phrase** : la règle des 44 px
       exempte explicitement le lien en ligne, qui n'a pas de taille à lui — il
       a celle de ses mots. Les compter faisait quatre-vingts alertes qu'on ne
       peut pas corriger sans casser la phrase, et elles noyaient les vraies :
       les boutons à 42 px, à deux pixels du compte. */
    if (/^(button|a|input|select)$/.test(el.tagName.toLowerCase())
        && getComputedStyle(el).display !== 'inline'
        && (r.width < 44 || r.height < 44)) {
      out.petits.push({ q: nom(el), l: Math.round(r.width), h: Math.round(r.height) });
    }

    /* **Le contraste, sur ce qui porte un texte à soi.** Il ne regardait que
       les feuilles, pour que chaque conteneur ne répète pas le défaut de son
       enfant. Mais un conteneur qui porte **ses propres mots** n'a pas
       d'enfant pour les dire : le bouton principal du hub écrit « Prendre ma
       place » puis pose un « small », et son libellé sortait de tout relevé —
       ni pâle, ni non mesurable. Le contraste suit donc la règle du petit
       texte et de l'opacité (texteDirect), qui ne mesure que les mots de
       l'élément, à sa couleur et à sa taille : l'enfant a son propre relevé,
       rien ne se répète.

       **Les feuilles d'avant restent mesurées**, même sans lettre ni chiffre
       (« ★★★ » sur une ligne) : le relevé d'un lot d'avant reste ainsi un
       sous-ensemble exact du nouveau. Ce que seule la nouvelle règle voit est
       compté à part (horsFeuille) et marqué dans ses trouvailles, pour que
       l'ancien compte se retrouve en soustrayant. */
    const feuille = el.children.length === 0 && (el.textContent ?? '').trim().length > 2;
    const aSoi = feuille || texteDirect(el);
    const neuf = aSoi && !feuille;
    if (neuf) out.horsFeuille.textes += 1;
    if (aSoi) {
      const c = contraste(el);
      if (c === null) { out.surDegrade += 1; if (neuf) out.horsFeuille.surDegrade += 1; }
      else {
        const taille = parseFloat(getComputedStyle(el).fontSize);
        const gras = Number(getComputedStyle(el).fontWeight) >= 700;
        /* Le seuil WCAG AA : 4,5 pour le texte ordinaire, 3 pour le grand. */
        const seuil = (taille >= 24 || (taille >= 18.66 && gras)) ? 3 : 4.5;
        /* Lu à travers une tuile ? Alors compté à part, et la tuile nommée :
           « toile » dit une bâche, « beton » un panneau calme. */
        const grains = fondDetaille(el).grains;
        if (grains.length) { out.surGrain += 1; if (neuf) out.horsFeuille.surGrain += 1; }
        /* Le fond est rappelé dans la trouvaille. « 4.3:1 » sans dire sur quoi
           ne se corrige pas : on ne sait pas laquelle des deux couleurs bouger. */
        if (c < seuil) {
          const t = { q: nom(el), c: c.toFixed(1), seuil, px: Math.round(taille),
            sur: fond(el), encre: getComputedStyle(el).color, ...(neuf ? { horsFeuille: true } : {}) };
          if (grains.length) out.palesGrain.push({ ...t, grain: grains.join(' + ') });
          else out.pales.push(t);
        }
      }
    }

    /* Le même texte au soleil, avec le même seuil : c'est la même personne
       qui lit, simplement dehors. Relevé à part, et seulement quand on le
       demande — il ne remplace pas le contraste d'intérieur. */
    if (JOUR && aSoi) {
      const cj = contrasteJour(el);
      if (cj === null) { out.jourSurDegrade += 1; if (neuf) out.horsFeuille.jourSurDegrade += 1; }
      else if (cj !== undefined) {
        const s = getComputedStyle(el);
        const taille = parseFloat(s.fontSize);
        const seuil = (taille >= 24 || (taille >= 18.66 && Number(s.fontWeight) >= 700)) ? 3 : 4.5;
        const grains = fondDetaille(el).grains;
        if (grains.length) { out.jourSurGrain += 1; if (neuf) out.horsFeuille.jourSurGrain += 1; }
        if (cj < seuil) {
          const t = { q: nom(el), c: cj.toFixed(1), seuil, px: Math.round(taille),
            sur: fond(el), encre: s.color, legal: Boolean(el.closest(LEGAL)),
            ...(neuf ? { horsFeuille: true } : {}) };
          if (grains.length) out.jourGrain.push({ ...t, grain: grains.join(' + ') });
          else out.jour.push(t);
        }
      }
    }

    /* Le petit texte et l'opacité effective, sur tout ce qui porte du texte à
       soi. Un texte à moins de deux pour cent n'est pas pâle, il est éteint :
       c'est un toast qui attend son tour ou un calque qui arrive, et le
       compter noierait les vrais. */
    if (texteDirect(el) && !cache(el)) {
      const s = getComputedStyle(el);
      const oe = opacites(el) * lire(s.color)[3];
      if (oe >= 0.02) {
        out.textes += 1;
        const repli = enRepli(el, s);
        if (repli) out.enRepli.push({ q: nom(el), police: repli });
        const legal = Boolean(el.closest(LEGAL));
        const css = parseFloat(s.fontSize);
        const px = Math.round(css * echelle(el) * 10) / 10;
        if (px < SEUILS.petitTexte) {
          if (legal) out.toleres.push({ q: nom(el), px, css, pourquoi: 'mention légale' });
          else out.petitTexte.push({ q: nom(el), px, css });
        }
        const seuilO = legal ? SEUILS.opaciteLegal : SEUILS.opacite;
        if (oe < seuilO) out.opacite.push({ q: nom(el), o: Math.round(oe * 100) / 100, seuil: seuilO, legal });
        /* Le petit or : sur ce que l'on compte comme un texte, et sur rien
           d'autre — un texte caché ou éteint n'écrit en or pour personne. */
        if (dore(s.color) && !grandTexte(s)) {
          ouRangerOr(el).push({ q: nom(el), px: css, poids: s.fontWeight, encre: s.color });
        }
      }
    }

    /* **Ce qui échappe encore au contraste** : des mots que la page affiche
       sans les poser dans un nœud texte — un pseudo-élément qui écrit (une
       chaîne, un compteur, un attribut), la valeur ou l'indication d'un
       champ, l'option choisie d'une liste. Ils ne sont pas mesurés : leur
       encre et leur fond ne se lisent pas comme ceux d'un élément, et une
       mesure fausse est pire que pas de mesure. Ils sont relevés, pour qu'un
       angle mort qui grandit se voie au lieu de passer pour un progrès. */
    if (!cache(el)) {
      for (const pseudo of ['::before', '::after']) {
        const p = getComputedStyle(el, pseudo);
        if (p.content === 'none' || p.content === 'normal' || p.display === 'none'
            || p.visibility === 'hidden') continue;
        let t = '';
        for (const m of p.content.matchAll(/"((?:[^"\\\\]|\\\\.)*)"|attr\\(\\s*([\\w-]+)\\s*\\)|counters?\\(/g)) {
          t += m[1] ?? (m[2] ? (el.getAttribute(m[2]) ?? '') : '0');
        }
        if (!/[\\p{L}\\p{N}]/u.test(t)) continue;
        out.horsContraste.push({ q: nom(el), ou: pseudo, texte: t.trim().slice(0, 30) });
        /* Le petit or vaut aussi pour un mot posé par un pseudo-élément : sa
           couleur et sa taille se lisent, même si son fond ne se lit pas. Un
           « NOUVEAU » doré en ::after est exactement ce que l'arbitrage
           retire. */
        if (opacites(el) * lire(p.color)[3] >= 0.02 && dore(p.color) && !grandTexte(p)) {
          ouRangerOr(el).push({ q: nom(el), ou: pseudo, texte: t.trim().slice(0, 30),
            px: parseFloat(p.fontSize), poids: p.fontWeight, encre: p.color });
        }
      }
      const tag = el.tagName.toLowerCase();
      const champ = tag === 'select' ? (el.selectedOptions?.[0]?.textContent ?? '')
        : tag === 'textarea' || (tag === 'input' && !/^(checkbox|radio|range|color|file|hidden|image)$/.test(el.type))
          ? (el.value || el.placeholder || '') : null;
      if (champ !== null && /[\\p{L}\\p{N}]/u.test(champ)) {
        out.horsContraste.push({ q: nom(el), ou: tag === 'select' ? 'option choisie' : el.value ? 'valeur' : 'indication',
          texte: champ.trim().slice(0, 30) });
      }
    }
  }

  for (const img of (ZONE ?? document).querySelectorAll('img')) {
    if (!visible(img)) continue;
    /* La propriété « alt » rend la chaîne vide quand l'attribut est absent : la
       comparer à « null » ne trouvait donc **jamais rien**, et cette colonne du
       rapport était vide pour une bonne raison qui n'était pas la bonne.

       Un alt vide reste correct, et volontaire : c'est ainsi qu'on dit « cette
       image est décorative, ne la lis pas ». C'est l'attribut manquant qui
       laisse un lecteur d'écran annoncer le nom du fichier.

       (Pas d'accent grave dans ce commentaire : il vit **à l'intérieur** du
        littéral MESURE, et le premier le refermerait.) */
    if (!img.hasAttribute('alt')) out.sansAlt.push({ q: nom(img) });
    /* **Une image sans attribut src n'est pas cassée, elle attend.** Plusieurs
       écrans posent la balise vide et la remplissent au retour de l'appel ; à la
       seconde où l'audit regarde, elle n'a rien chargé parce qu'on ne lui a rien
       demandé. C'étaient les dix-sept « images cassées » du premier rapport,
       dont sept n'avaient même pas de nom à afficher : « ? ».

       Un src présent et non chargé, lui, est une vraie image morte. */
    const src = img.getAttribute('src');
    if (src && img.complete && img.naturalWidth === 0) out.cassees.push({ q: src });
  }
  return out;
})()`;

/* L'état mesuré, écrit dans le JSON. Une mesure « avant » et une mesure
   « après » ne se comparent que si l'on sait sur quoi chacune a été prise :
   le commit, et si public/ portait des modifications non commitées — c'est
   le cas de toute mesure faite au milieu d'un lot. */
const git = (...a) => {
  try { return spawnSync('git', a, { cwd: RACINE, encoding: 'utf8' }).stdout?.trim() ?? null; }
  catch { return null; }
};
/* **audit-ui/2** : « surDegrade » ne compte plus les textes lus à travers une
   tuile de grain, qui ont leurs propres relevés (voir l'en-tête). Une machine
   qui comparerait un relevé /1 et un relevé /2 champ par champ croirait que
   cent textes sont devenus mesurables par miracle : le numéro le lui dit.

   **audit-ui/3** (lots 3 et 5) : le contraste se mesure sur tout texte à
   soi, plus seulement sur les feuilles. « pales », « jour », « surGrain »,
   « surDegrade » et les autres comptes de contraste y gagnent les textes que
   `releves.horsFeuille` détaille — un relevé /2 vaut le /3 moins eux, et
   chaque trouvaille qu'ils ajoutent porte « horsFeuille ». « enRepli » perd
   ses alertes fausses (Œ), tout relevé perd les faces tournées de dos, et
   `horsContraste` est nouveau.

   Ajouts du même lot, sans rien changer au sens des champs d'avant :
   `petitOr` et `orLegendaire` dans chaque relevé, `barre` dans chaque page et la synthèse
   `rapport.barre`, la hauteur du tiroir ouvert (`tiroir`) dans son état, un
   état (`booster@ticket`), ce qu'une visite a attendu ou fermé avant de
   mesurer (`pile`, `fete`), et, sur le hub d'un joueur, ce que disait sa
   bâche du jour (`bache`).

   **Retiré le 3 octobre 2026, avant la fin du lot** : l'état `bonus@/`, et
   le bonus dans `pile` (« bonus rangé », « bonus attendu, pas monté »). Le
   hub a quitté la pile pour poser le bonus dans sa bâche du jour : la
   visite du hub le mesure avec la page, et `bache` dit qu'il y était (voir
   « Le bonus du jour, dans la bâche »). Un relevé d'avant ce jour qui
   porte `etats['bonus@/']` mesurait un ticket que le hub ne pose plus.

   **Ajouts du lot 4**, toujours sans rien changer au sens des champs
   d'avant : six états (`classeur@/fanzzy`, `fiche@possédé`,
   `fiche@manquant`, `vitrine@possédée`, `vitrine@manquante`,
   `album@/collection`), leurs formats dans `formatsEtats.collection`, et ce
   qui a été semé pour eux dans `collectionSemee` ; puis un septième,
   `profil@insignes`, ses formats dans `formatsEtats.profil` et ce qui a été
   semé pour lui dans `insignesSemes`. Un relevé d'avant ce lot se compare
   page à page et état à état, ces sept-là mis à part.

   **Une correction du même lot**, qui retire une lecture fausse sans
   changer le sens d'aucun champ : tout relevé perd les textes rognés à
   rien, les mots pour le lecteur d'écran seul d'abord (« Rogné à rien »),
   comme il avait perdu les faces de dos. Là où il y en a, `releves.rognes`
   les nomme et `compte.rognes` les compte ; ailleurs, ni l'un ni l'autre.
   Le `textes` d'avant vaut le nouveau plus `rognes`, et les trouvailles
   qu'ils faisaient (au soleil surtout) sortent des listes sous ces mêmes
   noms, avec celles des mots posés dedans. Le schéma reste `audit-ui/3`.

   **Ajouts du lot 6**, sans rien changer au sens des champs d'avant : onze
   états d'arène (`virage@voile`, `virage@tribune`, `virage@double`,
   `virage@but`, `virage@pave`, `virage@bilan`, `duel@prepa`,
   `duel@vestiaire`, `duel@affiche`, `duel@jeu`, `duel@bilan`), leurs formats
   dans `formatsEtats.arenes` (et `formatsEtats.mur` pour les deux qu'on
   regarde aussi à 1 280 × 800), ce qu'on leur a fabriqué dans
   `arenesFabriquees`, et l'option `arenes`. Chaque relevé d'arène dit ce
   qu'il a tiré par la fausse socket (`evenements`), ce que la page a émis
   (`emis`), les lectures bouchées (`bouches`), la place des deux boutons de
   la barre (`barre`) et le voile du mur (`voile`) ; la tribune, la minute
   double et la partie, leur budget de hauteur, rangée par rangée
   (`budget`). Un relevé d'avant ce lot se compare page à page et état à
   état, ces onze-là mis à part.

   **Et, pendant le lot**, quatre états des autres écrans qu'il refait
   (`repetition@jugee`, `repetition@tri`, `amis@presence`,
   `tiroir@presence`), à deux formats chacun ; le compte des animations sans
   fin de chaque état (`sansFin`, et `seuils.sansFin`), l'état et l'air du
   sticker d'urgence dans `barre` (`urgence`, `pastille`, `air`, `demande`,
   et `seuils.bordSticker`), et trois genres de relevé : « sans fin »,
   « sticker rogné », « voile dense ». Le budget nomme les rangées du lot 6
   (voir `RANGEES_VIRAGE`) : ses clés ne sont plus celles du relevé de
   départ. Puis quatre états d'arène (`duel@pave`, `duel@but`, `virage@300`,
   `virage@fin`) et ce qu'on leur a fabriqué (`arenesFabriquees.virage.grande`,
   `.virage.fin`, `.duel.pave`, `.duel.but`) ; un quatrième nombre dans
   chaque rangée du budget (ce qu'on en voit à l'écran) et un quatrième genre,
   « main coupée » ; et, sur chaque état de la collection,
   `nouveautesEnBase` (voir « Une nouveauté éteinte par la visite
   d'avant »). Enfin un état d'arène, `duel@entrainement` (et
   `arenesFabriquees.duel.entrainement`), et sur chaque état du lot 6 deux
   sondes et leurs genres : l'encre rognée par un cadre (`encre`,
   `seuils.encreRognee`, « encre rognée ») et les libellés de carte couverts
   (`couverts`, `seuils.libelleCouvert`, « libellé couvert ») — une liste
   vide quand rien n'est relevé, absente quand la sonde n'a pas tourné. La
   rangée `#jeu .souffle` sort du budget du duel : elle est dans
   `#jeu .rang-equipe`. Et deux états d'arène, `virage@verdict` et
   `duel@verdict` (le tampon du verdict sur le pavé, et
   `arenesFabriquees.virage.verdict`, `.duel.verdict`) ; les trois bilans
   (`virage@bilan`, `virage@fin`, `duel@bilan`) disent comment ils se sont
   posés (`pose` : étapes, barres, temps pris, plafond, et ce qui restait
   en route), un bilan pas posé sous son plafond étant relevé. */
const rapport = {
  schema: 'audit-ui/3',
  date: new Date().toISOString(),
  commit: git('rev-parse', '--short', 'HEAD'),
  publicModifie: Boolean(git('status', '--porcelain', '--', 'public')),
  options: { jour, pleine, etats, arenes: arenesSeules, seule: seule ?? null },
  seuils: SEUILS,
  /* Ce qu'est une encre dorée pour le relevé du petit or. */
  dore: DORE,
  legal: LEGAL,
  formats: FORMATS.map(cleFormat),
  horsLot: [...HORS_LOT],
  nonAuditees: SANS_EXEMPLE,
  /* Une entrée par visite, sous sa clé : la route, ou « / (sans compte) »
     pour la vitrine. Chacune porte ensuite un format par clé « 360x640 ». */
  visites: VISITES.map(({ cle, chemin, qui }) => ({ cle, chemin, qui: qui ?? 'sans compte' })),
  /* Le voile moyen de chaque tuile, par adresse : un relevé « sur grain »
     dit ainsi contre quoi il a été pris. */
  voiles: {},
  /* Ce que les témoins ont vérifié avant les visites : un relevé dont le
     témoin a échoué n'est pas dans ce JSON (voir « Le témoin de la coupe à
     la ligne »). */
  temoins: {},
  pages: {},
  ...(etats ? { etats: {} } : {}),
};
if (dossierCaptures) mkdirSync(dossierCaptures, { recursive: true });

console.log(`\nAUDIT D’INTERFACE — ${VISITES.length} page(s), ${
  FORMATS.map((f) => `${f.largeur}×${f.hauteur}`).join(' / ')}${jour ? ', au jour' : ''}${
  arenesSeules ? ', et les états des arènes seulement'
    : etats ? `, et les états${opt('--largeur') ? '' : ` (l’ouverture aussi à ${PETIT.largeur}×${PETIT.hauteur})`}`
      : ''}\n`);

/* **Un navigateur neuf par visite.** Les pages partageaient un seul
   contexte, donc ses cookies : le cookie de session posé pour une page
   restait sur toutes les suivantes, et « l'accueil sans compte » se mesurait
   connecté — la vitrine n'était jamais vue. Le stockage local suivait le
   même chemin : ce qu'une page y écrivait changeait l'écran de la suivante,
   et une page auditée seule ne donnait pas le même relevé qu'au milieu du
   parcours. Chaque visite a donc son contexte, jeté après elle.

   **Et une adresse à elle.** Le serveur compte les requêtes par adresse —
   deux cent quarante lectures et mille cinq cents fichiers par minute, voir
   `debitMaximal` — et l'audit enchaîne soixante-quinze écrans en six
   minutes depuis la même machine, sans cache puisque chaque contexte est
   neuf : le classeur seul demande des centaines d'images. Aucun joueur ne
   fait ça. `trust proxy` fait lire au serveur l'adresse de X-Forwarded-For ;
   chaque visite en reçoit une, comme autant de joueurs différents.

   Un refus qui passerait quand même est **relevé** (genre « refusé (429) ») :
   une mesure prise sous un refus n'est pas une mesure de la page. La
   première mesure étendue a vu la boutique à 768 px sans son catalogue, et
   rien ne permettait de dire pourquoi ; c'est ce silence-là que le relevé
   supprime.

   **L'adresse ne va qu'à notre serveur.** Posée par « setExtraHTTPHeaders »,
   elle partait aussi vers Google Fonts. Un en-tête que CORS ne range pas
   parmi les simples oblige le navigateur à demander la permission avant
   chaque fichier de police ; Google refuse, la police tombe en échec, et
   tout l'audit — pages, rideau, tiroir — se mesurait dans la police de
   secours sans que rien ne le dise. Vu au banc avec ce Chrome : Oswald
   « error » avec l'en-tête, « loaded » sans. Chaque requête passe donc par
   l'audit, qui n'ajoute l'adresse qu'à celles de notre origine ; les autres
   partent telles que la page les a faites.

   **Et sans le service worker.** sw.js prend la main sur la page après son
   « load » et refait lui-même ses requêtes : celles-là ne passent plus par
   la page, donc plus par l'audit, et seraient toutes arrivées sous la même
   adresse — un seul joueur pour six minutes d'audit, et ses 429. L'en-tête
   global les couvrait ; le contournement les ramène à la page. Il ne
   change rien à ce qu'on mesure : sw.js va au réseau d'abord, et le cache
   d'une visite neuve est vide. */
let visite = 0;

/* **La fausse socket des arènes**, servie à la place de
   `/socket.io/socket.io.js` (voir « Les arènes »). Celle du banc des arènes
   du lot 0 : `io()` la rend, la page y pose ses écouteurs, et l'audit lui
   fait recevoir un évènement par `window.__sock.fire(nom, données)`. Ce que
   la page émet est gardé dans `window.__emis`, dans l'ordre — on le relit
   pour savoir si elle a demandé son bilan. Et `window.__repondre[nom]`, s'il
   existe, répond à une émission comme le serveur le ferait : c'est ainsi
   que la demande de bilan reçoit le sien. `connected` est vrai : le duel
   refuse d'entrer en file sans connexion. Aucun « connect » n'est émis : la
   page croirait se reconnecter et redemanderait sa salle. */
const FAUSSE_SOCKET = `(() => {
  const ecouteurs = {};
  const emis = [];
  const s = {
    connected: true, id: 'audit-ui',
    on(e, f) { (ecouteurs[e] ??= []).push(f); return s; },
    off(e, f) { ecouteurs[e] = (ecouteurs[e] ?? []).filter((g) => g !== f); return s; },
    once(e, f) { const g = (d) => { s.off(e, g); f(d); }; return s.on(e, g); },
    emit(e, d) {
      emis.push([e, d ?? null]);
      const r = window.__repondre?.[e];
      if (r) setTimeout(() => r(d), 60);
      return s;
    },
    connect() { return s; }, disconnect() { return s; }, close() { return s; },
    io: { on() { return s.io; }, off() { return s.io; } },
  };
  s.fire = (e, d) => { for (const f of [...(ecouteurs[e] ?? [])]) f(d); };
  window.__sock = s;
  window.__emis = emis;
  window.io = () => s;
})();`;

/** Un contexte neuf, une adresse à lui, un format, et qui regarde.

    Pour les arènes seulement (voir « Les arènes ») : `socket` remplace la
    bibliothèque du direct par la fausse socket, et `bouchons` répond à la
    place du serveur aux lectures nommées (un chemin, sans sa requête → un
    corps JSON). Un chemin précédé de sa méthode (« POST /api/repetition »)
    ne répond qu'à elle, et passe avant le chemin seul : la salle de
    répétition lit sa configuration au serveur et ne fait boucher que la
    note. Sans ces deux options, rien ne change pour les autres visites. */
async function nouvelleVisite({ largeur, hauteur }, qui, { socket = false, bouchons = null } = {}) {
  const contexte = await nav.createBrowserContext();
  const page = await contexte.newPage();
  const erreurs = [];
  const refus = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('response', (r) => { if (r.status() === 429) refus.push(r.url().replace(base, '')); });
  visite += 1;
  const adresse = `10.77.${Math.floor(visite / 250)}.${(visite % 250) + 1}`;
  const origine = new URL(base).origin;
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  page.on('request', (r) => {
    if (r.isInterceptResolutionHandled()) return;
    let notre = false;
    try { notre = new URL(r.url()).origin === origine; } catch { /* adresse illisible : telle quelle */ }
    if (notre && (socket || bouchons)) {
      const chemin = new URL(r.url()).pathname;
      if (socket && chemin === '/socket.io/socket.io.js') {
        r.respond({ status: 200, contentType: 'text/javascript; charset=utf-8', body: FAUSSE_SOCKET })
          .catch(() => {});
        return;
      }
      const cle = bouchons && [`${r.method()} ${chemin}`, chemin].find((k) => Object.hasOwn(bouchons, k));
      if (cle) {
        r.respond({ status: 200, contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(bouchons[cle]) }).catch(() => {});
        return;
      }
    }
    /* Une page fermée pendant qu'une requête attend : il n'y a plus rien à
       continuer, et ce n'est pas une faute de la page mesurée. */
    r.continue(notre ? { headers: { ...r.headers(), 'x-forwarded-for': adresse } } : undefined)
      .catch(() => {});
  });
  await page.setViewport({ width: largeur, height: hauteur });
  if (qui) {
    await page.setCookie({ name: 'tbf_session', value: SESSIONS[qui], domain: 'localhost', path: '/' });
  }
  return { contexte, page, erreurs, refus, enVol: suivreNosRequetes(page) };
}

/* **Le calme de notre serveur, quand Chrome ne le dit plus.** « networkidle0 »
   attend le signal de Chrome (le cycle de vie « networkIdle »). Sur le
   classeur ouvert — 733 cartes, 573 images paresseuses —, ce signal vient
   au premier contexte du navigateur et **plus jamais aux suivants** : vu à
   la sonde le 3 octobre 2026, trois contextes de suite, avec et sans
   l'interception des requêtes, polices bloquées ou non, alors que ni
   puppeteer ni CDP (Network.*) ne voyaient une seule requête en vol. La
   page attendait vingt secondes, deux fois, et la case restait vide.

   On suit donc nous-mêmes les requêtes **de notre serveur** — les données
   et les fichiers du jeu —, et la page est chargée quand aucune n'est en
   vol depuis une demi-seconde (la règle de « networkidle0 »). Les polices
   de Google n'y sont pas : `mesurer` les attend à part, bornées, et dit ce
   qui a été lu en police de secours (« enRepli »). Une requête dont aucun
   événement ne dit la fin — la police d'Oswald, sous l'interception, en
   est une — ne bloque donc plus rien. */
function suivreNosRequetes(page) {
  const enVol = new Set();
  const origine = new URL(base).origin;
  const notre = (r) => { try { return new URL(r.url()).origin === origine; } catch { return false; } };
  page.on('request', (r) => { if (notre(r)) enVol.add(r); });
  page.on('requestfinished', (r) => enVol.delete(r));
  page.on('requestfailed', (r) => enVol.delete(r));
  return enVol;
}
/** Vrai quand aucune requête de notre serveur n'est en vol depuis 500 ms ;
    faux au-delà du plafond. */
async function calmeDeNotreServeur(enVol, plafond = 15_000) {
  const depart = Date.now();
  let calme = null;
  while (Date.now() - depart < plafond) {
    if (enVol.size) calme = null;
    else if (calme === null) calme = Date.now();
    else if (Date.now() - calme >= 500) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}
/** Ce qui est encore en vol, nommé pour le rapport. */
const enAttente = (enVol) => [...enVol].slice(0, 3).map((r) => r.url().replace(base, '')).join(' ');

/** Les polices, les voiles (MESURE ne peut attendre ni l'une ni l'autre),
    puis la mesure.

    **Les polices d'abord, et bornées.** Une police n'est demandée que quand
    un texte l'emploie : le tiroir, qui s'ouvre après le chargement de la
    page, réclame les siennes à l'ouverture — et il était mesuré, puis
    photographié, sans qu'on les attende. Cinq secondes au plus : une police
    qui n'arrive pas ne doit pas arrêter l'audit, et la mesure dit alors
    quels textes elle a lus dans la police de secours (« enRepli »). */
async function mesurer(page, portee = null) {
  await page.evaluate(() => Promise.race([document.fonts?.ready.then(() => true),
    new Promise((r) => { setTimeout(() => r(false), 5000); })])).catch(() => {});
  const voiles = await page.evaluate(VOILES).catch(() => null);
  for (const [adresse, v] of Object.entries(voiles ?? {})) {
    if (adresse in rapport.voiles) continue;
    rapport.voiles[adresse] = v && {
      tuile: adresse.replace(/^.*\/img\/grain\//, '').replace(/[?#].*$/, ''),
      opacite: Math.round(v.a * 10_000) / 10_000,
      teinte: v.c.map((x) => Math.round(x)),
    };
  }
  return page.evaluate(mesure(portee));
}

/* **Le témoin de la coupe à la ligne.** « coupé (lignes) » repose sur un
   comportement de Chrome, vu au banc du lot 2 avec le Chrome de puppeteer :
   les lignes qu'une coupe cache restent mises en page — leurs boîtes se
   comptent, et la hauteur à faire défiler les contient. Un Chrome qui
   cesserait de les mettre en page ferait
   tomber ce relevé à zéro sur toutes les pages, et un zéro se lit comme un
   bon résultat. On le vérifie donc à chaque audit, avec le code même de la
   mesure, sur deux textes dont on sait la réponse : l'un trop long pour ses
   deux lignes, l'autre court. Si le témoin ne répond pas ce qu'on attend,
   le relevé quitte le JSON, le rapport et la ligne de console, et l'audit
   le dit en finissant. */
const COUPE_A_DEUX = 'width:90px;font:11px/1.2 sans-serif;display:-webkit-box;'
  + '-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden';
const TEMOIN_COUPE = '<!doctype html><body style="margin:0;background:#0A0D11;color:#F2EEE4">'
  + `<p id="coupe" style="${COUPE_A_DEUX}">une phrase bien trop longue pour tenir sur deux lignes de quatre-vingt-dix pixels</p>`
  + `<p style="${COUPE_A_DEUX}">courte</p></body>`;
async function temoinCoupeLignes() {
  const page = await nav.newPage();
  try {
    await page.setContent(TEMOIN_COUPE);
    const m = await page.evaluate(mesure());
    return m.coupesLignes.length === 1 && m.coupesLignes[0].q.startsWith('p#coupe');
  } catch {
    return false;
  } finally {
    await page.close().catch(() => {});
  }
}
const coupeLignesMesurable = await temoinCoupeLignes();
rapport.temoins.coupesLignes = coupeLignesMesurable;
if (!coupeLignesMesurable) {
  console.warn('  Témoin : ce Chrome ne laisse pas voir ce que « line-clamp » coupe — '
    + 'le relevé « coupé (lignes) » est retiré de cet audit.\n');
}

/** Les trouvailles d'une mesure, coupées à quatre par genre pour le rapport. */
function noterReleves(cle, largeur, m, erreurs) {
  if (m.deborde > 0) note(cle, largeur, 'déborde', `${m.deborde} px de large en trop`);
  for (const x of m.horsEcran.slice(0, 4)) note(cle, largeur, 'hors écran', `${x.q} — ${x.de} px dehors`);
  /* Seulement sous une portée fixée : ailleurs, le relevé n'existe pas. */
  for (const x of (m.horsFenetre ?? []).slice(0, 4)) {
    note(cle, largeur, 'hors fenêtre', `${x.q} — ${x.de} px hors de l’écran, qui ne défile pas`);
  }
  for (const x of m.coupes.slice(0, 4)) note(cle, largeur, 'coupé', `${x.q} — ${x.de} px tronqués`);
  for (const x of (coupeLignesMesurable ? m.coupesLignes : []).slice(0, 4)) {
    note(cle, largeur, 'coupé (lignes)', `${x.q} — ${x.lignes} lignes pour ${x.limite}, ${x.de} px cachés`);
  }
  /* Une ligne par police, pas par texte : c'est la police qu'il faut faire
     venir, et le JSON garde chaque texte. */
  if (m.enRepli.length) {
    note(cle, largeur, 'police de repli', `${[...new Set(m.enRepli.map((x) => x.police))].sort().join(', ')
    } pas chargée(s) : ses textes ont été mesurés dans la police de secours`);
  }
  for (const x of m.petits.slice(0, 4)) note(cle, largeur, 'trop petit', `${x.q} — ${x.l}×${x.h}`);
  for (const x of m.pales.slice(0, 4)) note(cle, largeur, 'pâle', `${x.q} — ${x.c}:1 (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}`);
  /* Le fond rappelé est celui qu'on lit, voile moyen compris ; la tuile est
     nommée pour qu'on sache quelle surface le porte. */
  for (const x of m.palesGrain.slice(0, 4)) {
    note(cle, largeur, 'pâle sur grain',
      `${x.q} — ${x.c}:1 (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}, sous ${x.grain}`);
  }
  for (const x of m.sansAlt.slice(0, 3)) note(cle, largeur, 'sans alt', x.q);
  for (const x of m.cassees.slice(0, 3)) note(cle, largeur, 'image cassée', x.q);
  for (const x of m.sousDecor.slice(0, 3)) {
    note(cle, largeur, 'sous le décor',
      `${x.q} — ${x.pos}, z-index ${x.z} (le décor est à ${x.zDecor})`);
  }
  for (const x of m.petitTexte.slice(0, 4)) {
    note(cle, largeur, 'petit texte', `${x.q} — ${x.px} px${x.px !== x.css ? ` (police ${x.css} px)` : ''}`);
  }
  for (const x of m.opacite.slice(0, 4)) {
    note(cle, largeur, 'opacité', `${x.q} — ${x.o} (il en faut ${x.seuil})`);
  }
  for (const x of m.petitOr.slice(0, 4)) {
    note(cle, largeur, 'petit or', `${x.q}${x.ou ? ` ${x.ou} « ${x.texte} »` : ''} — ${x.encre} à ${x.px} px ${
      x.poids} : l’or ne s’écrit qu’à 24 px, ou 18,66 px en gras`);
  }
  for (const x of m.backdrop.slice(0, 4)) {
    note(cle, largeur, 'backdrop-filter',
      `${x.q}${x.pseudo ? ` ${x.pseudo}` : ''} — ${x.v}${x.visible ? '' : ' (replié)'}`);
  }
  if (jour) {
    for (const x of m.jour.slice(0, 4)) {
      note(cle, largeur, 'pâle au jour', `${x.q} — ${x.c}:1 au soleil (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}`);
    }
    for (const x of m.jourGrain.slice(0, 4)) {
      note(cle, largeur, 'pâle au jour sur grain',
        `${x.q} — ${x.c}:1 au soleil (il en faut ${x.seuil}) — ${x.encre} sur ${x.sur}, sous ${x.grain}`);
    }
  }
  for (const e of erreurs.slice(0, 2)) note(cle, largeur, 'script', e.slice(0, 90));
}

/* Tous les relevés, sans la coupe à quatre du rapport : le JSON sert à
   compter et à comparer, pas à lire d'une traite. Le contraste au jour
   n'y figure que s'il a été mesuré — un zéro qu'on n'a pas mesuré se
   lirait comme un bon résultat. */
function compter(m, erreurs, refus) {
  if (!jour) {
    delete m.jour; delete m.jourSurDegrade; delete m.jourSurGrain; delete m.jourGrain;
    delete m.horsFeuille.jourSurDegrade; delete m.horsFeuille.jourSurGrain;
  }
  /* Même règle pour la coupe à la ligne quand son témoin a échoué. */
  if (!coupeLignesMesurable) delete m.coupesLignes;
  /* Les textes rognés à rien (voir « Rogné à rien ») : absents quand il n'y
     en a pas. Ce n'est pas un défaut, et une case qui n'en a aucun se
     compare ainsi à un relevé d'avant sans une ligne de plus. */
  if (!m.rognes?.length) delete m.rognes;
  return {
    deborde: m.deborde, horsEcran: m.horsEcran.length, coupes: m.coupes.length,
    petits: m.petits.length, pales: m.pales.length, surDegrade: m.surDegrade,
    sansAlt: m.sansAlt.length, cassees: m.cassees.length, sousDecor: m.sousDecor.length,
    scripts: erreurs.length, refus: refus.length, textes: m.textes,
    petitTexte: m.petitTexte.length, opacite: m.opacite.length, toleres: m.toleres.length,
    backdrop: m.backdrop.length,
    ...(m.horsFenetre ? { horsFenetre: m.horsFenetre.length } : {}),
    surGrain: m.surGrain, palesGrain: m.palesGrain.length,
    ...(jour ? { jour: m.jour.length, jourSurDegrade: m.jourSurDegrade,
      jourSurGrain: m.jourSurGrain, jourGrain: m.jourGrain.length } : {}),
    ...(m.coupesLignes ? { coupesLignes: m.coupesLignes.length } : {}),
    enRepli: m.enRepli.length,
    /* Les textes dont seule la règle des lots 3 et 5 mesure le contraste
       (le détail par relevé est dans `releves.horsFeuille`), et ce qui
       échappe encore à toute mesure de contraste. Ni l'un ni l'autre n'est
       un défaut : ils disent jusqu'où la mesure voit. */
    horsFeuille: m.horsFeuille.textes,
    horsContraste: m.horsContraste.length,
    /* Ce que « textes » ne compte plus : le « textes » d'avant « Rogné à
       rien » vaut « textes » plus lui. */
    ...(m.rognes ? { rognes: m.rognes.length } : {}),
    /* Un défaut, lui : l'arbitrage de l'or qui recule (voir DORE). Et, à
       part, l'or que l'arbitrage laisse à la légendaire : pas un défaut, un
       compte qui doit rester petit. */
    petitOr: m.petitOr.length,
    orLegendaire: m.orLegendaire.length,
  };
}

/** Le nombre de choses à dire sur une mesure : la ligne de la console. Une
    police de repli compte pour une — c'est une ligne du rapport, pas une
    par texte. */
const total = (m, erreurs, refus) => m.deborde + m.horsEcran.length + (m.horsFenetre?.length ?? 0)
  + m.coupes.length + (m.coupesLignes?.length ?? 0) + (m.enRepli.length ? 1 : 0) + m.petits.length
  + m.pales.length + m.palesGrain.length + m.cassees.length + m.sousDecor.length
  + erreurs.length + refus.length + m.petitTexte.length + m.opacite.length + m.backdrop.length
  + m.petitOr.length + (jour ? m.jour.length + m.jourGrain.length : 0);

/** Attend, dans la page, qu'une condition devienne vraie ; faux au-delà de `ms`. */
const ATTENDRE = `async (condition, ms) => {
  const depart = performance.now();
  while (!condition()) {
    if (performance.now() - depart > ms) return false;
    await new Promise((r) => setTimeout(r, 30));
  }
  return true;
}`;

/* **La barre, d'une page à l'autre.** Le lot 2 a laissé la barre décalée
   sur quatre pages, et rien ne le disait : chaque page se mesure seule, et
   une flèche posée dix pixels plus bas n'est ni coupée, ni pâle, ni trop
   petite. Seule la comparaison la voit. On relève donc la place de la
   flèche et du menu de la barre commune (celle de nav.js, `.tbf-haut`) sur
   chaque page, et chaque format compare ses pages à la majorité — voir
   « La barre, page contre page », après les visites.

   Pas la barre d'un écran de jeu (`.tbf-haut-jeu`), qui flotte au-dessus du
   jeu à sa propre place, ni l'en-tête du hub ou de l'administration, qui
   ne sont pas cette barre. La place dans le document, défilement retiré :
   une page qui défilerait d'elle-même ne doit pas passer pour décalée. */
const BARRE = () => {
  const haut = document.querySelector('.tbf-haut:not(.tbf-haut-jeu)');
  if (!haut) return null;
  const place = (sel) => {
    const n = haut.querySelector(sel);
    const r = n?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0
      ? [Math.round(r.left + window.scrollX), Math.round(r.top + window.scrollY)] : null;
  };
  return { retour: place('.tbf-retour'), burger: place('.tbf-burger') };
};

/* **Une fête de niveau posée sur l'écran à l'arrivée.** /profil et /virage
   fêtent le niveau gagné depuis la dernière visite (niveau-fete.js,
   `depuisVisite`) ; le butin d'un booster fête celui qu'il fait gagner. Le
   panneau (z 170) couvre tout : mesurer sous lui, c'est mesurer la fête en
   croyant mesurer la page, et la capture ne montre qu'elle. Chaque visite
   part d'un navigateur neuf, donc d'une première visite, qui ne fête
   jamais : il ne devrait pas venir. S'il vient, on le dit, puis on le
   ferme par son bouton, comme un joueur. */
async function fermerLaFete(page, cle, largeur) {
  const vue = await page.evaluate(`(async () => {
    const attendre = ${ATTENDRE};
    const f = document.querySelector('.tbf-niv-fond');
    if (!f) return null;
    f.querySelector('[data-fermer]')?.click();
    return attendre(() => !document.querySelector('.tbf-niv-fond'), 2000);
  })()`).catch(() => null);
  if (vue === null) return null;
  note(cle, largeur, 'fête de niveau', vue
    ? 'une fête de niveau couvrait l’écran : notée, puis fermée avant la mesure'
    : 'une fête de niveau couvre l’écran et ne s’est pas fermée : la capture la montre');
  return vue ? 'fermée' : 'restée';
}

/* **Le bonus du jour, dans la bâche.** À la première arrivée du jour — et
   chaque visite de l'audit en est une —, le hub pose le bonus dans sa bâche
   du jour (`#direct`, le ticket kraft de la bande du bas) : « BONUS DU
   JOUR », la bâche or RÉCUPÉRER, la carte de la semaine. Il ne couvre rien :
   la visite du hub le mesure avec la page, et ne le touche pas — le prendre
   écrirait en base et changerait le solde de toutes les pages suivantes.

   **Il montait dans la pile** (`.tbf-pile`), par-dessus le bouton d'entrée :
   la visite le rangeait par Échap, et un état (`bonus@/`) le mesurait à
   part. Depuis que le hub le pose dans la bâche (révisé le 3 octobre 2026),
   l'audit qui l'attendait encore dans la pile notait sur chaque format un
   bonus « pas monté » que la capture montrait, attendait six secondes pour
   rien, et l'état ne mesurait plus rien. L'état est retiré plutôt que
   déplacé : il aurait remesuré la bâche que la visite du hub mesure déjà,
   et compté deux fois chacun de ses défauts.

   **Attendu, pas supposé.** La bâche se recolle sur le bonus une demi-
   seconde après le rideau, ou après le ticket de retour (trois secondes et
   demie), et ce recollage (`tbf-colle`) fait monter son opacité de 0 à 1 :
   mesurée au vol, elle se lirait pâle. Si le serveur l'a servi prêt
   (`bonus.pret` de GET /api/quotidien, lu au passage), on attend donc que la
   bâche le dise (`data-quoi="bonus"`), puis la fin de son mouvement ; s'il
   ne vient pas, c'est relevé (genre « bonus du jour »). Ce que la bâche
   disait au moment de la mesure est rangé avec le relevé (`bache`) : tant
   que le bonus est prêt, ses autres états — la mission, les premiers pas —
   ne sont pas ceux qu'on mesure sur le hub du joueur de l'audit, et un
   écart avec un relevé d'avant peut venir de là.

   **La pile ne porte plus que des tickets qui passent** : sur le hub, le
   ticket de retour, qui ne vient qu'après trois heures d'absence (contrat
   § 8) — jamais pendant un audit. Tout ticket qui y est, on attend qu'il
   parte ; un ticket qui y reste couvre le bouton d'entrée, et c'est relevé
   (« ticket resté ») — un bonus qui reviendrait dans la pile le serait
   ainsi, sans que l'audit ait à le connaître. */
const BONUS_MAX = 6000;
function guetterQuotidien(page) {
  const q = { lu: false, bonusPret: false };
  page.on('response', (r) => {
    let chemin = '';
    try { chemin = new URL(r.url()).pathname; } catch { return; }
    if (r.request().method() !== 'GET' || chemin !== '/api/quotidien') return;
    r.json().then((j) => { q.lu = true; q.bonusPret ||= j?.bonus?.pret === true; })
      .catch(() => { q.lu = true; });
  });
  return q;
}
const BACHE_DU_JOUR = '#direct';
const BONUS_DANS_LA_BACHE = `() => document.querySelector(${
  JSON.stringify(BACHE_DU_JOUR)})?.dataset.quoi === 'bonus'`;
const TICKETS_DE_LA_PILE = '.tbf-pile > .tbf-ticket';

/** Attend que les tickets de la pile partent. Rend ce qui est passé. */
async function attendreLaPile(page, cle, largeur) {
  const passes = await page.evaluate(`(async () => {
    const sel = ${JSON.stringify(TICKETS_DE_LA_PILE)};
    const vus = [...document.querySelectorAll(sel)].map((t) => t.className.replace(/\\s+/g, '.'));
    if (!vus.length) return null;
    return { vus, partis: await (${ATTENDRE})(() => !document.querySelector(sel), 4000) };
  })()`).catch(() => null);
  if (!passes) return [];
  if (!passes.partis) {
    note(cle, largeur, 'ticket resté', `un ticket est resté dans la pile, sur le bouton d’entrée : ${passes.vus[0]}`);
  }
  /* Le ticket parti, ce qui reprend sa place finit d'entrer avant la mesure. */
  await finDesMouvements(page, 'body', 1500);
  return passes.vus.map((v) => `${v} ${passes.partis ? 'parti' : 'resté'}`);
}

/** Attend le bonus dans la bâche du jour s'il est servi prêt, puis la fin
    de son recollage. Rend ce que dit la bâche, et ce que le serveur a servi
    (`null` : GET /api/quotidien n'a pas été lu). */
async function attendreLaBache(page, q, cle, largeur) {
  if (q.bonusPret) {
    const dedans = await page.evaluate(`(async () => (${ATTENDRE})(${BONUS_DANS_LA_BACHE}, ${BONUS_MAX}))()`)
      .catch(() => false);
    if (!dedans) {
      note(cle, largeur, 'bonus du jour', `le serveur sert un bonus prêt, et la bâche du jour ne le montre pas en ${
        BONUS_MAX / 1000} s (${BACHE_DU_JOUR}[data-quoi="bonus"])`);
    }
  }
  await finDesMouvements(page, BACHE_DU_JOUR, 1000);
  const quoi = await page.evaluate((sel) => document.querySelector(sel)?.dataset.quoi ?? null, BACHE_DU_JOUR)
    .catch(() => null);
  return { quoi, bonusServi: q.lu ? q.bonusPret : null };
}

for (const { chemin, cle, qui, nom: nomCapture } of VISITES) {
  rapport.pages[cle] = {};
  for (const format of FORMATS) {
    const { largeur, hauteur } = format;
    const { contexte, page, erreurs, refus, enVol } = await nouvelleVisite(format, qui);
    /* Le hub d'un joueur : son bonus du jour (voir « Le bonus du jour, dans
       la bâche »). */
    const quotidien = chemin === '/' && qui ? guetterQuotidien(page) : null;
    /* **Une seconde chance, et une seule.** La vitrine, visitée sans compte et
       sans cache, n'a pas trouvé son calme réseau en vingt secondes une fois
       sur six pendant la mesure « avant » — et une case vide dans un tableau
       avant / après ne se compare à rien. Un second essai la rattrape ; il est
       noté, pour qu'une page qui ne charge qu'au second coup se voie quand
       même. Deux échecs, et la case reste vide, comme avant. */
    let essais = 0;
    let charge = false;
    while (!charge && essais < 2) {
      essais += 1;
      try {
        await page.goto(base + chemin, { waitUntil: 'networkidle0', timeout: 20_000 });
        charge = true;
      } catch { /* on retente une fois */ }
    }
    /* **Un troisième essai, sans le signal de Chrome** (voir « Le calme de
       notre serveur ») : la page chargée, puis notre serveur tu. Il ne joue
       qu'après deux échecs — aucun relevé qui chargeait avant ne change de
       méthode —, et il est noté. */
    if (!charge) {
      try {
        await page.goto(base + chemin, { waitUntil: 'load', timeout: 20_000 });
        const calme = await calmeDeNotreServeur(enVol);
        charge = true;
        essais = 3;
        note(cle, largeur, 'chargement', `chargée au troisième essai, sans le calme réseau de Chrome : ${calme
          ? 'notre serveur s’est tu' : `notre serveur ne s’est pas tu en 15 s (en attente : ${enAttente(enVol)})`}`);
      } catch { /* deux échecs et demi : la case reste vide */ }
    }
    if (!charge) {
      note(cle, largeur, 'chargement', 'la page n’a pas fini de charger en 20 s, deux fois, ni chargé au troisième essai');
      rapport.pages[cle][cleFormat(format)] = { largeur, hauteur, charge: false, essais };
      await contexte.close();
      continue;
    }
    if (essais > 1) {
      note(cle, largeur, 'chargement', 'chargée au second essai : le réseau ne s’était pas tu en 20 s');
    }
    /* Le temps que l'écran d'ouverture parte et que les appels se posent. Sans
       ça, on mesure un écran de chargement. */
    /* **Et l'ouverture peut tenir dix secondes.** Sur l'accueil connecté,
       elle part dès que le hub a ses données ; sur la vitrine, personne ne
       la congédie et elle tient son plafond (`DUREE` d'ouverture.js). Au bout
       de 1,8 s, la vitrine se mesurait donc sous le rideau, et sa capture
       montrait le titre du jeu au lieu de la page. On attend qu'il soit
       retiré du document — tout de suite sur les pages qui n'en ont pas. */
    await page.waitForFunction(() => !document.getElementById('ouverture'), { timeout: 12_000 })
      .catch(() => note(cle, largeur, 'chargement', 'l’écran d’ouverture était encore là après 12 s'));
    await new Promise((r) => setTimeout(r, 1800));
    /* Ce qui couvre l'écran à l'arrivée, fermé ou attendu avant la mesure,
       et écrit dans le relevé : voir « Une fête de niveau » et « Le bonus du
       jour, dans la bâche ». La fête d'abord : elle passe devant la pile.
       Puis la pile, avant la bâche : le bonus ne s'y recolle qu'une fois le
       ticket de retour parti. */
    const fete = await fermerLaFete(page, cle, largeur);
    const pile = quotidien ? await attendreLaPile(page, cle, largeur) : [];
    const bache = quotidien ? await attendreLaBache(page, quotidien, cle, largeur) : null;

    const m = await mesurer(page);
    /* La place de la barre, comparée aux autres pages après les visites. */
    const barre = await page.evaluate(BARRE).catch(() => null);

    /* La capture après la mesure : la mesure ne touche à rien, et l'image
       montre donc exactement l'écran qui a été mesuré. Celle de l'écran seul
       par défaut — c'est ce que le joueur voit en arrivant, et c'est là que
       le 360 × 640 se distingue du 400 × 800. */
    let capture = null;
    if (dossierCaptures) {
      capture = `${nomCapture ?? nomDeRoute(chemin)}-${cleFormat(format)}.png`;
      try {
        await page.screenshot({ path: path.join(dossierCaptures, capture), fullPage: pleine });
      } catch (e) {
        note(cle, largeur, 'capture', `capture impossible : ${e.message.slice(0, 80)}`);
        capture = null;
      }
    }

    /* Deux façons de ne pas mesurer ce qu'on croit : un refus du serveur, et
       une page qui renvoie ailleurs. La seconde se dit en fin de ligne dans
       le rapport — /bienvenue qui file à l'accueil ne se voit qu'ainsi. */
    const arrivee = new URL(page.url()).pathname;
    if (refus.length) {
      note(cle, largeur, 'refusé (429)', `${refus.length} requête(s) refusée(s), dont ${refus[0]}`);
    }
    if (arrivee !== new URL(base + chemin).pathname) {
      note(cle, largeur, 'renvoyée', `la page renvoie vers ${arrivee} : c’est cet écran-là qui est mesuré`);
    }

    noterReleves(cle, largeur, m, erreurs);

    rapport.pages[cle][cleFormat(format)] = {
      largeur, hauteur, charge: true, essais, capture, qui: qui ?? 'sans compte', arrivee,
      barre, ...(fete ? { fete } : {}), ...(pile.length ? { pile } : {}), ...(bache ? { bache } : {}),
      compte: compter(m, erreurs, refus),
      releves: { ...m, scripts: erreurs, refus },
    };

    const n = total(m, erreurs, refus);
    console.log(`  ${cle.padEnd(16)} ${`${largeur}×${hauteur}`.padStart(9)}   ${
      n === 0 ? 'rien à signaler' : `${n} chose(s)`}${HORS_LOT.has(cle) ? '   (hors lot)' : ''}${
      arrivee !== new URL(base + chemin).pathname ? `   → ${arrivee}` : ''}`);
    await contexte.close();
  }
}

/* ------------------------------------------- la barre, page contre page

   Voir `BARRE`. Pour chaque format et chaque pièce (la flèche, le menu), la
   place que **la plupart** des pages lui donnent, à un pixel près
   (`SEUILS.barrePx`), et chaque page qui la pose ailleurs. Une majorité,
   c'est plus de la moitié des pages qui ont la pièce, et trois pages au
   moins : une page auditée seule n'a personne à qui se comparer, et deux
   pages qui divergent ne disent pas laquelle a tort. Sans majorité, on le
   dit, plutôt que de désigner un coupable au hasard. Mesuré le 2 octobre
   2026 : à 360 px, la flèche en [24, 10] et le menu en [292, 10] partout. */
const PIECES_BARRE = [['retour', 'la flèche de retour'], ['burger', 'le bouton du menu']];
const proches = (a, b) => Math.abs(a[0] - b[0]) <= SEUILS.barrePx && Math.abs(a[1] - b[1]) <= SEUILS.barrePx;
rapport.barre = {};
for (const f of FORMATS) {
  const k = cleFormat(f);
  rapport.barre[k] = {};
  for (const [piece, dite] of PIECES_BARRE) {
    const vues = VISITES.map(({ cle }) => ({ cle, pos: rapport.pages[cle]?.[k]?.barre?.[piece] }))
      .filter((x) => Array.isArray(x.pos));
    if (!vues.length) continue;
    /* La place qui rassemble le plus de pages, à un pixel près : deux
       arrondis voisins ne coupent pas une majorité en deux. */
    let majorite = null, sur = 0;
    for (const { pos } of vues) {
      const n = vues.filter((x) => proches(x.pos, pos)).length;
      if (n > sur) { majorite = pos; sur = n; }
    }
    const juge = vues.length >= 3 && sur * 2 > vues.length;
    const ecarts = juge ? vues.filter((x) => !proches(x.pos, majorite)) : [];
    rapport.barre[k][piece] = { majorite: juge ? majorite : null, sur, pages: vues.length,
      ecarts: ecarts.map(({ cle, pos }) => ({ cle, pos })) };
    for (const x of ecarts) {
      note(x.cle, f.largeur, 'barre décalée',
        `${dite} en [${x.pos.join(', ')}], quand ${sur} page(s) sur ${vues.length} la posent en [${majorite.join(', ')}]`);
    }
    if (vues.length >= 3 && !juge) {
      note('(la barre)', f.largeur, 'barre décalée', `${dite} n’a pas de place majoritaire : ${
        [...new Set(vues.map((x) => `[${x.pos.join(', ')}]`))].join(' ')}`);
    }
  }
}

/* ------------------------------------------------------------ les états

   **Trois écrans qu'aucune route ne montre.** Le parcours attend que
   l'ouverture soit partie avant de mesurer (voir plus haut), et il n'ouvre
   jamais le tiroir : deux des écrans les plus vus du jeu, que le lot 2
   refait, n'avaient ni capture ni relevé. `--etats` leur donne une visite
   neuve chacun, aux mêmes formats — et l'ouverture aussi à 320 × 568
   (`PETIT`, plus bas) :

     — **l'ouverture du hub, à deux instants** (`INSTANTS_OUVERTURE`) : au
       début, avant le plancher d'1,2 s d'ouverture.js, quand le titre et la
       jauge viennent de paraître ; puis vers deux secondes, quand tout ce
       qui entre est entré et que l'écran attend qu'on le congédie. Sur
       l'accueil connecté, il part dès que le hub émet « tbf:pret » — sur la
       machine de test, avant deux secondes. Le signal est donc **retenu**,
       pour cette visite seulement : ouverture.js en est aujourd'hui le seul
       destinataire, et le retenir revient à un serveur lent, le cas même que
       son plafond prévoit. Ses règles de sortie ne sont pas touchées, et
       l'audit n'attend pas le plafond. (Un écouteur de « tbf:pret » ajouté
       ailleurs serait retenu avec lui, et le hub photographié derrière le
       rideau ne serait plus tout à fait le vrai : c'est ici qu'il faudrait
       le dire.)
     — **le tiroir ouvert**, sur une page ordinaire (`PAGE_TIROIR`) : la
       barre de nav.js, et le bouton qui commande le tiroir — trouvé par son
       « aria-controls », le lien que menu.js pose entre les deux.

   Chaque état est photographié **et mesuré sous sa portée** — le tiroir,
   le rideau : la page qu'il recouvre a déjà son relevé, et la remesurer
   sous un voile la ferait lire comme si rien ne la couvrait. Le premier
   instant n'est que photographié : les visages montent encore, et un texte
   en train de paraître serait compté pâle. (La consigne et l'astuce n'y
   sont pas encore : ouverture.js les pose au plancher, c'est voulu.) Les
   deux sont fixés à la fenêtre : leur relevé « déborde » est le leur, et
   « hors fenêtre » s'y ajoute — voir la mesure.

   Rangés à part dans le JSON (`etats`), jamais dans `pages` : un relevé
   avec `--etats` se compare page à page à un relevé sans. Et toujours la
   capture de l'écran, même avec `--pleine` : un tiroir et un rideau sont
   fixés à la fenêtre, la page entière dessous ne les montrerait pas mieux. */
const INSTANTS_OUVERTURE = [500, 2000];
const PAGE_TIROIR = '/classement';
/* **Le rideau, aussi au plus petit téléphone.** C'est le premier écran que
   voit tout joueur, sur tout appareil, et le lot 2 le refait en demandant
   qu'il tienne à 320 × 568 : rien qui sorte, rien de coupé sous son bord
   (« hors fenêtre »). Le tiroir défile, lui : il n'a pas ce risque-là. Et
   les pages ne sont pas visitées à ce format, qui n'est pas celui du socle.
   Avec `--largeur`, on s'en tient au format demandé. */
const FORMATS_OUVERTURE = opt('--largeur') ? FORMATS : [...FORMATS, PETIT];

/* **Les polices d'un état**, rangées avec lui. « document.fonts.status » ne
   dit que si quelque chose charge encore : il vaut « loaded » après un échec
   — c'est ce qu'il disait du rideau pendant que tout l'audit tombait dans la
   police de secours. D'où la liste des polices en échec à côté, et, pour un
   état mesuré, le compte « enRepli » de sa mesure. */
const POLICES = () => ({
  polices: document.fonts?.status ?? null,
  policesEnEchec: [...new Set([...(document.fonts ?? [])].filter((f) => f.status === 'error')
    .map((f) => `${f.family.replace(/["']/g, '')} ${f.weight}`))],
});

async function photographier(page, nomEtat, format, cle) {
  if (!dossierCaptures) return null;
  const fichier = `etat-${nomEtat}-${cleFormat(format)}.png`;
  try {
    await page.screenshot({ path: path.join(dossierCaptures, fichier) });
    return fichier;
  } catch (e) {
    note(cle, format.largeur, 'capture', `capture impossible : ${e.message.slice(0, 80)}`);
    return null;
  }
}

/** Attend la fin des mouvements qui finissent bientôt dans ces éléments et
    leurs descendants — une transition, un ticket qui monte, un tiroir qui se
    déroule —, au plus `plafond` ms. Ni les boucles, qui ne finissent jamais
    (une pastille qui bat, la fumée), ni ce qui dure plus que le plafond : la
    lumière du tunnel grandit pendant les dix secondes du plafond
    d'ouverture.js, c'est du décor, et l'attendre ferait attendre le plafond. */
async function finDesMouvements(page, selecteur, plafond) {
  await page.evaluate(async (sel, max) => {
    const finies = [...document.querySelectorAll(sel)]
      .flatMap((e) => e.getAnimations({ subtree: true }))
      .filter((a) => {
        const t = a.effect?.getComputedTiming?.();
        return t && t.iterations !== Infinity && t.endTime - (t.localTime ?? 0) <= max;
      })
      .map((a) => a.finished.catch(() => {}));
    await Promise.race([Promise.all(finies), new Promise((r) => setTimeout(r, max))]);
  }, selecteur, plafond).catch(() => {});
}

/** Range un état dans le JSON et le dit en console, comme une page.
    `autres` : ce que l'état a relevé hors de la mesure (le tiroir trop
    haut), compté dans la ligne de console comme le reste. */
function rangerEtat(cle, chemin, format, donnees, m = null, erreurs = [], refus = [], autres = 0) {
  rapport.etats[cle] ??= { chemin };
  const entree = { largeur: format.largeur, hauteur: format.hauteur, ...donnees, mesure: Boolean(m) };
  if (m) {
    noterReleves(cle, format.largeur, m, erreurs);
    if (refus.length) {
      note(cle, format.largeur, 'refusé (429)', `${refus.length} requête(s) refusée(s), dont ${refus[0]}`);
    }
    entree.compte = compter(m, erreurs, refus);
    entree.releves = { ...m, scripts: erreurs, refus };
  }
  rapport.etats[cle][cleFormat(format)] = entree;
  const n = m ? total(m, erreurs, refus) + autres : null;
  console.log(`  ${cle.padEnd(22)} ${`${format.largeur}×${format.hauteur}`.padStart(9)}   ${
    n === null ? (entree.capture ? 'photographié' : 'rien à montrer')
      : n === 0 ? 'rien à signaler' : `${n} chose(s)`}${
    entree.instant !== undefined ? `   (à ${entree.instant} ms${
      entree.instantMesure ? `, mesuré à ${entree.instantMesure}` : ''})` : ''}${
    entree.tiroir ? `   (${String(entree.tiroir.ecrans).replace('.', ',')} écran(s) de haut)` : ''}${
    /* Un état absent dit pourquoi, sur sa ligne : « rien à montrer » seul ne
       distingue pas un écran qui n'existe pas encore d'une panne. */
    entree.absent ? `   (${entree.absent})` : ''}`);
}

async function etatOuverture(format) {
  const { contexte, page, erreurs, refus } = await nouvelleVisite(format, 'joueur');
  try {
    await page.evaluateOnNewDocument(() => {
      addEventListener('tbf:pret', (e) => e.stopImmediatePropagation(), { capture: true });
    });
    try {
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    } catch {
      note('ouverture', format.largeur, 'chargement', 'l’accueil n’a pas répondu en 20 s');
      return;
    }
    for (const instant of INSTANTS_OUVERTURE) {
      const cle = `ouverture@${instant}ms`;
      await page.waitForFunction((t) => performance.now() >= t, { polling: 20, timeout: 15_000 }, instant)
        .catch(() => {});
      /* L'instant réel est relevé : si la page a mis plus d'une demi-seconde
         à répondre, la capture « du début » n'en est pas une, et il faut le
         savoir. Les polices aussi — une capture prise avant Oswald montre le
         rideau dans une police de secours (voir POLICES). */
      const ici = await page.evaluate(() => {
        const o = document.getElementById('ouverture');
        return { instant: Math.round(performance.now()),
          la: Boolean(o) && !o.classList.contains('partie') };
      });
      const polices = await page.evaluate(POLICES);
      if (!ici.la) {
        note(cle, format.largeur, 'état', `l’écran d’ouverture n’était plus là à ${ici.instant} ms`);
        rangerEtat(cle, '/', format, { instant: ici.instant, ...polices, capture: null });
        continue;
      }
      /* La capture d'abord, ici : c'est elle qui tient à l'instant. La
         mesure, elle, attend ce qui finit d'entrer : l'astuce monte de
         quarante pixels en 320 ms, la consigne paraît en 200. Sur une
         machine lente, où ouverture.js arrive tard, l'une prise au vol
         sortait « hors fenêtre », l'autre sous l'opacité minimale (vu au
         banc, à 360 × 640 : le ticket encore 42 px plus bas à 2,6 s). */
      const capture = await photographier(page, `ouverture-${instant}ms`, format, cle);
      const dernier = instant === INSTANTS_OUVERTURE[INSTANTS_OUVERTURE.length - 1];
      let m = null;
      let instantMesure;
      if (dernier) {
        await finDesMouvements(page, '#ouverture', 1500);
        instantMesure = await page.evaluate(() => Math.round(performance.now()));
        m = await mesurer(page, '#ouverture');
      }
      rangerEtat(cle, '/', format, { instant: ici.instant, ...(m ? { instantMesure } : {}),
        ...polices, capture }, m, erreurs, refus);
    }
  } finally {
    await contexte.close();
  }
}

/** Ouvre le tiroir par son bouton, comme un joueur. Rend la panne, ou null.

    Ouvert par le bouton, puis attendu jusqu'à la fin de ses transitions —
    pas de ses boucles : une pastille qui bat ne finit jamais.
    « aria-expanded » plutôt qu'une classe : c'est le contrat que le bouton
    doit tenir pour un lecteur d'écran, il survivra à un changement de
    feuille de style. Partagé par `tiroir@/classement` et l'état du lot 6
    qui l'ouvre avec la présence servie (`tiroir@presence`). */
async function ouvrirLeTiroir(page) {
  const { faute } = await page.evaluate(async () => {
    const b = document.querySelector('[aria-controls="tbf-tiroir"]');
    if (!b) return { faute: 'aucun bouton ne commande le tiroir (aria-controls="tbf-tiroir")' };
    b.click();
    const depart = performance.now();
    while (b.getAttribute('aria-expanded') !== 'true') {
      if (performance.now() - depart > 3000) return { faute: 'le tiroir ne s’est pas ouvert en 3 s' };
      await new Promise((r) => setTimeout(r, 30));
    }
    if (!document.getElementById('tbf-tiroir')) {
      return { faute: 'le bouton dit le tiroir ouvert, et il n’y a pas de #tbf-tiroir' };
    }
    return { faute: null };
  });
  if (faute) return faute;
  await finDesMouvements(page, '#tbf-tiroir, .tbf-voile', 2500);
  await new Promise((r) => setTimeout(r, 300));
  return null;
}

/** **Combien d'écrans de haut.** Le tiroir défile en lui-même : ce qu'il
    pousse sous le bord n'est ni coupé ni hors fenêtre, il est plus bas — et
    le lot 2 l'a laissé à deux écrans au téléphone étroit, la moitié des
    destinations hors de vue. Sa hauteur à défiler sur celle de la fenêtre ;
    au-delà de `SEUILS.tiroirEcrans`, c'est relevé. Rend la hauteur, et si
    elle a été relevée. */
async function hauteurDuTiroir(page, cle, largeur) {
  const tiroir = await page.evaluate(() => {
    const t = document.getElementById('tbf-tiroir');
    return { defile: t.scrollHeight, fenetre: window.innerHeight };
  });
  tiroir.ecrans = Math.round((tiroir.defile / tiroir.fenetre) * 100) / 100;
  const tropHaut = tiroir.ecrans > SEUILS.tiroirEcrans;
  if (tropHaut) {
    note(cle, largeur, 'tiroir trop haut', `${String(tiroir.ecrans).replace('.', ',')} écrans de haut (${
      tiroir.defile} px pour ${tiroir.fenetre}) : il en faut ${String(SEUILS.tiroirEcrans).replace('.', ',')} au plus`);
  }
  return { tiroir, tropHaut };
}

async function etatTiroir(format) {
  const cle = `tiroir@${PAGE_TIROIR}`;
  const { contexte, page, erreurs, refus } = await nouvelleVisite(format, 'joueur');
  try {
    try {
      await page.goto(base + PAGE_TIROIR, { waitUntil: 'networkidle0', timeout: 20_000 });
    } catch {
      note(cle, format.largeur, 'chargement', 'la page n’a pas fini de charger en 20 s');
      return;
    }
    await new Promise((r) => setTimeout(r, 1800));
    const faute = await ouvrirLeTiroir(page);
    if (faute) {
      note(cle, format.largeur, 'état', faute);
      rangerEtat(cle, PAGE_TIROIR, format, { capture: null });
      return;
    }
    /* La mesure attend les polices que le tiroir vient de réclamer (voir
       mesurer) ; la capture, prise après, les montre donc aussi. Leur état
       est rangé avec celui de l'ouverture : le tiroir avait été mesuré en
       police de secours sans que son relevé le dise. */
    const m = await mesurer(page, '#tbf-tiroir');
    const polices = await page.evaluate(POLICES);
    const capture = await photographier(page, `tiroir-${nomDeRoute(PAGE_TIROIR)}`, format, cle);
    const { tiroir, tropHaut } = await hauteurDuTiroir(page, cle, format.largeur);
    rangerEtat(cle, PAGE_TIROIR, format, { ...polices, capture, tiroir }, m, erreurs, refus, tropHaut ? 1 : 0);
  } finally {
    await contexte.close();
  }
}

/* ---------------------------------------- les écrans de plus (lots 3 et 5)

   Les lots 3 et 5 refont des écrans qu'une visite ordinaire ne montre pas :
   elle arrive, attend, mesure, et ne touche à rien.

     — **la bande du HUD dépliée** (`hud@/classement`) : le sticker de la
       barre, touché sur une page ordinaire. Sous 560 px seulement : au-delà,
       la bande est une rangée de la barre, toujours visible, et la visite de
       la page la mesure déjà. Mesurée sous sa portée.
     — **l'ouverture d'un booster**, à trois moments : une carte révélée
       (`booster@carte`), le ticket du gain qui passe trois secondes dans la
       pile (`booster@ticket`), puis le butin (`booster@butin`). Mesurés sous
       la portée de l'écran d'ouverture, ou de la pile pour le ticket.
     — **le classement d'un joueur classé** (`classement@classé`) : la visite
       de /classement le voit vide, faute de ferveur en base. Mesuré comme une
       page, puisque c'en est une — avec d'autres données.

   **Rien de ce qu'ils sèment ne touche aux relevés d'avant.** Ils passent
   après les pages, l'ouverture et le tiroir, et chacun sème au moment où il
   passe : le kiosque, un joueur neuf par format ; le classement, sa ferveur,
   à la toute fin. Le relevé des pages et des trois premiers états se
   compare donc tel quel à celui d'un audit qui ne les avait pas.

   (Le bonus du jour a eu son état, `bonus@/`, tant qu'il montait dans la
   pile du hub : il est dans la bâche du jour depuis le 3 octobre 2026, et
   la visite du hub le mesure — voir « Le bonus du jour, dans la bâche ».) */
/* nav.js et ui.css : à partir de 560 px, la bande ne se déplie plus. */
const BANDE_EN_RANGEE = 560;
const FORMATS_HUD = FORMATS.filter((f) => f.largeur < BANDE_EN_RANGEE);
const PAGE_KIOSQUE = '/boosters';
const PAGE_CLASSEMENT = '/classement';

/* **La bande du HUD.** Touchée comme le tiroir : par le bouton qui la
   commande (« aria-controls », le lien que nav.js pose entre les deux), et
   « aria-expanded » plutôt qu'une classe pour savoir qu'elle est dépliée.

   **Trois secondes.** La bande se replie d'elle-même trois secondes après le
   toucher, sauf sous le doigt ou le focus. Les y retenir changerait l'écran
   (un jeton survolé, un anneau de focus) : la mesure se fait donc dans les
   trois secondes — une demi-seconde suffit ici —, et l'audit vérifie
   ensuite que la bande était encore dépliée. Sinon, le relevé est écarté et
   le genre « état » le dit. */
async function etatHud(format) {
  const cle = `hud@${PAGE_TIROIR}`;
  const { contexte, page, erreurs, refus } = await nouvelleVisite(format, 'joueur');
  try {
    try {
      await page.goto(base + PAGE_TIROIR, { waitUntil: 'networkidle0', timeout: 20_000 });
    } catch {
      note(cle, format.largeur, 'chargement', 'la page n’a pas fini de charger en 20 s');
      return;
    }
    await new Promise((r) => setTimeout(r, 1800));
    /* Le HUD ne se construit qu'à sa première donnée : on lui laisse cinq
       secondes de plus, puis on le touche. */
    const faute = await page.evaluate(`(async () => {
      const attendre = ${ATTENDRE};
      const sel = '[aria-controls="tbf-hud-bande"]';
      if (!await attendre(() => document.querySelector(sel), 5000)) {
        return 'aucun sticker ne commande la bande du HUD (aria-controls="tbf-hud-bande")';
      }
      const b = document.querySelector(sel);
      b.click();
      if (!await attendre(() => b.getAttribute('aria-expanded') === 'true', 3000)) {
        return 'la bande du HUD ne s’est pas dépliée en 3 s';
      }
      return document.getElementById('tbf-hud-bande') ? null
        : 'le sticker dit la bande dépliée, et il n’y a pas de #tbf-hud-bande';
    })()`);
    if (faute) {
      note(cle, format.largeur, 'état', faute);
      rangerEtat(cle, PAGE_TIROIR, format, { capture: null });
      return;
    }
    await finDesMouvements(page, '#tbf-hud-bande', 600);
    const m = await mesurer(page, '#tbf-hud-bande');
    const polices = await page.evaluate(POLICES);
    const capture = await photographier(page, `hud-${nomDeRoute(PAGE_TIROIR)}`, format, cle);
    const encore = await page.evaluate(() => document.querySelector('[aria-controls="tbf-hud-bande"]')
      ?.getAttribute('aria-expanded') === 'true');
    if (!encore) {
      note(cle, format.largeur, 'état', 'la bande s’est repliée avant la fin de la mesure : relevé écarté');
      rangerEtat(cle, PAGE_TIROIR, format, { ...polices, capture: null });
      return;
    }
    rangerEtat(cle, PAGE_TIROIR, format, { ...polices, capture }, m, erreurs, refus);
  } finally {
    await contexte.close();
  }
}

/* **Un joueur neuf par format, pour le kiosque.** Ouvrir un booster écrit en
   base : avec le joueur de l'audit, le deuxième format aurait ouvert un
   booster de moins, sur une collection déjà commencée, et le tiroir ou le
   HUD d'après auraient compté autrement. Chacun part donc du même point —
   la bourse du joueur de l'audit, son club, aucune carte —, ce qui rend les
   formats comparables entre eux, et un audit comparable au suivant.

   Le niveau est celui du joueur de l'audit (400 XP, niveau 4, le 5 à 480) :
   un booster en rapporte cinq, et une fête de niveau ne vient pas couvrir
   le butin qu'on photographie. */
async function joueurDuKiosque(format) {
  const qui = `kiosque-${cleFormat(format)}`;
  const id = `aud00000-0000-0000-0001-${String(format.largeur).padStart(4, '0')}${
    String(format.hauteur).padStart(8, '0')}`;
  await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status,email_verified_at)
                    VALUES (?,?,?,'x','active',NOW(3))`, [id, `${qui}@ex.fr`, `Kiosque${format.largeur}`]);
  await pool.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,onboarded_at)
                    VALUES (?,500,6,400,NOW(3))`, [id]);
  await pool.query('INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)', [id]);
  const j = `audit-session-${qui}`.padEnd(44, '0');
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     SELECT ?, id, NOW(3) + INTERVAL 1 DAY FROM users WHERE public_id = ?`,
    [createHash('sha256').update(j).digest('hex'), id]);
  SESSIONS[qui] = j;
  return qui;
}

/* Touche la carte du dessus, là où le doigt la touche : l'élément au centre
   de la scène, ramené à la carte qui le porte. Les cartes déjà vues sont
   parties de côté, celles d'après sont dessous ; la première de la scène
   sert de repli si autre chose couvre le centre. Un « click » sur la carte
   elle-même, qui remonte jusqu'à la scène : ni survol ni pointeur laissés
   sur l'écran qu'on photographie. */
const TOUCHER_LA_CARTE = () => {
  const scene = document.getElementById('ostage');
  if (!scene) return false;
  const r = scene.getBoundingClientRect();
  const sous = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const carte = sous?.closest('#ostage > *') ?? scene.firstElementChild;
  if (!carte) return false;
  carte.click();
  return true;
};

/* **L'ouverture d'un booster.** Par les identifiants que lisent aussi
   boosters-ui-smoke.mjs et tour-ui-smoke.mjs : le bouton d'ouverture
   (#openBtn), puis **Entrée** sur le sachet (#tearpack) — l'accès clavier
   que la page garde à côté de la déchirure, et que la suite éprouve. Le
   geste au doigt dépend des images que rend la machine ; Entrée ouvre le
   même booster, par le même chemin, à coup sûr. Puis la première carte
   touchée (`booster@carte`), le ticket du gain (`booster@ticket`) et le
   butin (`booster@butin`) : « Tout révéler » (#oAction) s'il est là, sinon
   carte après carte, jusqu'au récapitulatif (#summary.on). Chaque moment
   attend la fin de ses
   mouvements — la cérémonie d'une légendaire, les écharpes qui volent —,
   pas celle des boucles.

   **Le tirage est au hasard**, comme pour un joueur : le serveur ne prend
   pas de graine, et lui en imposer une (ou répondre à sa place) mesurerait
   une reconstitution. Il est donc **relevé** avec l'état (`tirage` : sorte,
   identifiant, nouveauté), pour qu'un écart entre deux audits se lise — une
   légendaire n'a pas la cérémonie d'une commune. */
/* La cérémonie la plus longue (une légendaire, 1,6 s) avec de la marge ;
   et le ticket du gain, qui part des écharpes arrivées au compteur. */
const CEREMONIE_MAX = 2500;
const TICKET_MAX = 5000;
async function etatBooster(format) {
  const cles = { carte: 'booster@carte', ticket: 'booster@ticket', butin: 'booster@butin' };
  const qui = await joueurDuKiosque(format);
  const { contexte, page, erreurs, refus } = await nouvelleVisite(format, qui);
  let tirage = null;
  page.on('response', (r) => {
    if (r.request().method() !== 'POST' || new URL(r.url()).pathname !== '/api/fanzzy/open') return;
    r.json().then((j) => {
      tirage = { statut: r.status(), ...(j.error ? { erreur: j.error } : {}),
        cartes: (j.cards ?? []).map((c) => ({ sorte: c.type, id: c.id,
          ...(typeof c.new === 'boolean' ? { neuve: c.new } : {}) })) };
    }).catch(() => { tirage = { statut: r.status() }; });
  });
  const echec = (cle, quoi) => {
    note(cle, format.largeur, 'état', quoi);
    rangerEtat(cle, PAGE_KIOSQUE, format, { capture: null, tirage });
  };
  /* Le moment en cours, pour nommer celui où une étape lève : un
     sélecteur disparu ne doit pas arrêter un audit de huit minutes, il doit
     se lire dans son rapport. */
  let moment = cles.carte;
  try {
    try {
      await page.goto(base + PAGE_KIOSQUE, { waitUntil: 'networkidle0', timeout: 20_000 });
    } catch {
      note(cles.carte, format.largeur, 'chargement', 'le kiosque n’a pas fini de charger en 20 s');
      return;
    }
    await new Promise((r) => setTimeout(r, 1800));
    await ouvrirUnBooster();
  } catch (e) {
    echec(moment, `l’étape a levé : ${String(e?.message ?? e).slice(0, 80)}`);
  } finally {
    await contexte.close();
  }

  async function ouvrirUnBooster() {
    const faute = await page.evaluate(`(async () => {
      const attendre = ${ATTENDRE};
      const b = document.getElementById('openBtn');
      if (!b) return 'pas de bouton d’ouverture (#openBtn)';
      if (b.disabled) return 'le bouton d’ouverture est éteint';
      b.click();
      return await attendre(() => document.getElementById('tearzone')?.classList.contains('on'), 3000)
        ? null : 'le sachet à déchirer n’est pas venu en 3 s (#tearzone.on)';
    })()`);
    if (faute) { echec(cles.carte, faute); return; }
    await page.focus('#tearpack');
    await page.keyboard.press('Enter');
    const ouvert = await page.waitForFunction(() => document.getElementById('opener')?.classList.contains('on')
      && document.querySelectorAll('#ostage > *').length > 0, { timeout: 10_000 }).then(() => true, () => false);
    if (!ouvert) {
      echec(cles.carte, `le booster ne s’est pas ouvert en 10 s${tirage?.erreur ? ` (${tirage.erreur})` : ''}`);
      return;
    }
    await finDesMouvements(page, 'body', 2000);

    /* Une carte révélée. **Après sa cérémonie** (`FX.reveler`, fx.js) : elle
       se joue sur un calque à elle, `.fx-ceremonie` (z 96, hors de
       l'écran d'ouverture), qui reste dans le document et se vide quand
       c'est fini — 1,6 s au plus, pour une légendaire, après le
       retournement. Mesurée pendant, la carte tremble sous la secousse et
       la capture montre le flash et le tampon LÉGENDAIRE au lieu de la
       carte. La fin des mouvements attend d'abord le retournement, que la
       cérémonie attend elle aussi : à ce moment-là, elle a posé ses
       pièces. */
    await page.evaluate(TOUCHER_LA_CARTE);
    await finDesMouvements(page, 'body', 3000);
    const ceremonieFinie = await page.evaluate(`(async () =>
      (${ATTENDRE})(() => !document.querySelector('.fx-ceremonie > *'), ${CEREMONIE_MAX}))()`).catch(() => false);
    if (!ceremonieFinie) {
      note(cles.carte, format.largeur, 'état', `la cérémonie de la carte jouait encore après ${
        CEREMONIE_MAX / 1000} s : la capture la montre`);
    }
    await finDesMouvements(page, 'body', 1500);
    await new Promise((r) => setTimeout(r, 300));
    const m1 = await mesurer(page, '#opener');
    const polices1 = await page.evaluate(POLICES);
    const capture1 = await photographier(page, 'booster-carte', format, cles.carte);
    rangerEtat(cles.carte, PAGE_KIOSQUE, format, { ...polices1, capture: capture1, tirage, ceremonieFinie },
      m1, erreurs, refus);
    moment = cles.butin;

    /* Le butin. Douze touchers au plus : cinq cartes, retournées puis
       écartées, et « Tout révéler » quand il paraît. */
    const recap = () => page.evaluate(() => document.getElementById('summary')?.classList.contains('on') === true);
    for (let i = 0; i < 12 && !await recap(); i += 1) {
      const tout = await page.evaluate(() => {
        const a = document.getElementById('oAction');
        if (!a || !a.getClientRects().length || getComputedStyle(a).visibility === 'hidden') return false;
        a.click();
        return true;
      });
      if (!tout) await page.evaluate(TOUCHER_LA_CARTE);
      await finDesMouvements(page, 'body', 1500);
    }
    if (!await recap()) { echec(cles.butin, 'le butin n’est pas venu (#summary.on) après douze touchers'); return; }

    /* **Le ticket du gain.** Une fois les cartes collées et les écharpes
       des doublons arrivées au compteur (deux secondes et demie environ),
       le butin pose dans la pile un ticket kraft — les écharpes et l'XP du
       booster — pour trois secondes. Mesuré à part, sous la portée de la
       pile : il passe sur le butin, et l'arbitrage du kraft s'y lit. Sans
       doublon ni XP dans la réponse, il ne vient pas : ce n'est pas un
       défaut, et l'état le dit sans le compter. */
    moment = cles.ticket;
    const ticketVenu = await page.evaluate(`(async () =>
      (${ATTENDRE})(() => document.querySelector('.tbf-pile > .tbf-ticket--gain'), ${TICKET_MAX}))()`)
      .catch(() => false);
    if (ticketVenu) {
      await finDesMouvements(page, '.tbf-pile', 800);
      const m0 = await mesurer(page, '.tbf-pile');
      const polices0 = await page.evaluate(POLICES);
      const capture0 = await photographier(page, 'booster-ticket', format, cles.ticket);
      rangerEtat(cles.ticket, PAGE_KIOSQUE, format, { ...polices0, capture: capture0, tirage }, m0, erreurs, refus);
      /* Puis il part, et le butin se mesure sans lui. */
      await page.evaluate(`(async () =>
        (${ATTENDRE})(() => !document.querySelector('.tbf-pile > .tbf-ticket--gain'), 4000))()`).catch(() => {});
    } else {
      rangerEtat(cles.ticket, PAGE_KIOSQUE, format, { capture: null, tirage,
        absent: `aucun ticket en ${TICKET_MAX / 1000} s : ni écharpes de doublons ni XP à dire` });
    }

    /* **Le butin**, une fois tout posé : les cartes, le compte de la série,
       les compteurs, le ticket parti. Une fête de niveau n'y vient pas (voir
       joueurDuKiosque) ; si elle vient, elle est notée et fermée, comme sur
       une page (voir « Une fête de niveau »). */
    moment = cles.butin;
    const fete = await fermerLaFete(page, cles.butin, format.largeur);
    await finDesMouvements(page, 'body', 3000);
    await new Promise((r) => setTimeout(r, 300));
    const m2 = await mesurer(page, '#opener');
    const polices2 = await page.evaluate(POLICES);
    const capture2 = await photographier(page, 'booster-butin', format, cles.butin);
    rangerEtat(cles.butin, PAGE_KIOSQUE, format, { ...polices2, capture: capture2, tirage, ...(fete ? { fete } : {}) },
      m2, erreurs, refus);
  }
}

/* **Le classement d'un joueur classé.** Treize supporters et le joueur de
   l'audit, classé neuvième : assez pour remplir l'écran au téléphone
   étroit, pour que sa propre ligne soit sous le pli — c'est là que la
   ligne épinglée sert —, et pour un podium. Des pseudos de longueurs
   variées (dix-huit lettres pour le plus long), deux clubs et un neutre,
   des niveaux, et un Fanzzy équipé pour sept d'entre eux : les six autres
   montrent le repli à l'initiale.

   La ferveur vient du Grand Virage (`virage_presence`, classée), datée de
   l'instant : elle tombe dans toutes les fenêtres — le mois, la saison
   lancée au début de l'audit, depuis toujours. Semée **après** tous les
   autres relevés : la visite de /classement, le tiroir et la bande du HUD
   l'ont vu vide, et le relevé d'avant ces lots aussi. */
const CLASSES = [
  { pseudo: 'CapoDuKop', ferveur: 48210, matchs: 12, club: 85, xp: 2400, fanzzy: 'RP1', age: 2 },
  { pseudo: 'Tambour_Nord', ferveur: 41900, matchs: 11, club: 91, xp: 1990, fanzzy: 'RP2', age: 1 },
  { pseudo: 'LaVoixDuVirage', ferveur: 35400, matchs: 10, club: 85, xp: 1700 },
  { pseudo: 'Fumigène', ferveur: 27800, matchs: 9, club: 85, xp: 1320, fanzzy: 'RP3', age: 1 },
  { pseudo: 'Bâche-Haute', ferveur: 22150, matchs: 8, club: 91, xp: 990 },
  { pseudo: 'Écharpe94', ferveur: 18700, matchs: 7, club: 85, xp: 760, fanzzy: 'RP4', age: 1 },
  { pseudo: 'Mégaphone', ferveur: 15320, matchs: 6, club: null, xp: 540 },
  { pseudo: 'TribuneEst', ferveur: 12040, matchs: 5, club: 91, xp: 500, fanzzy: 'RP5', age: 1 },
  { moi: true, ferveur: 9860, matchs: 5, club: 85 },
  { pseudo: 'Sifflet', ferveur: 7410, matchs: 4, club: 85, xp: 310 },
  { pseudo: 'LeGrandDéplacement', ferveur: 5230, matchs: 3, club: 91, xp: 200, fanzzy: 'RP6', age: 1 },
  { pseudo: 'Banderole', ferveur: 3980, matchs: 3, club: 85, xp: 120 },
  { pseudo: 'Kop_Junior', ferveur: 2210, matchs: 2, club: 85, xp: 70, fanzzy: 'RP1', age: 1 },
  { pseudo: 'Novice', ferveur: 940, matchs: 1, club: 91, xp: 0 },
];
async function semerClassement() {
  for (const [i, c] of CLASSES.entries()) {
    let id = U;
    if (!c.moi) {
      id = `aud00000-0000-0000-0002-${String(i + 1).padStart(12, '0')}`;
      await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status,email_verified_at)
                        VALUES (?,?,?,'x','active',NOW(3))`, [id, `classe-${i + 1}@ex.fr`, c.pseudo]);
      await pool.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,onboarded_at,active_fanzzy)
                        VALUES (?,0,3,?,NOW(3),?)`, [id, c.xp, c.fanzzy ?? null]);
      if (c.fanzzy) {
        await pool.query('INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage) VALUES (?,?,1,?)',
          [id, c.fanzzy, c.age]);
      }
      if (c.club) await pool.query('INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,?,1)', [id, c.club]);
    }
    /* La ferveur, répartie sur ses matchs : « 12 matchs » se lit sous le
       pseudo, et les mêmes rencontres servent à tout le monde. */
    for (let k = 0; k < c.matchs; k += 1) {
      const part = Math.floor(c.ferveur / c.matchs) + (k === 0 ? c.ferveur % c.matchs : 0);
      await pool.query(`INSERT INTO virage_presence (user_id,fixture_id,side,ferveur,team_id,classe)
                        VALUES (?,?,0,?,?,1)`, [id, 990001 + k, part, c.club]);
    }
  }
  return { classes: CLASSES.length, rangDuJoueur: CLASSES.findIndex((c) => c.moi) + 1 };
}

/* **Un serveur neuf pour le classement.** Le serveur garde une liste de
   classement cinq minutes en mémoire, et la visite de /classement, le
   tiroir et la bande du HUD viennent de la lire vide : semée sans cela, la
   ferveur n'aurait paru qu'au hasard du minutage. Le redémarrage ne vide
   que cette mémoire-là ; la base, les sessions et les joueurs restent. */
async function redemarrer() {
  const ancien = serveur;
  if (ancien.exitCode === null && ancien.signalCode === null) {
    await new Promise((r) => { ancien.once('exit', r); ancien.kill(); });
  }
  serveur = lancerServeur();
  return debout();
}

async function etatClassement(format) {
  const cle = 'classement@classé';
  const { contexte, page, erreurs, refus } = await nouvelleVisite(format, 'joueur');
  try {
    try {
      await page.goto(base + PAGE_CLASSEMENT, { waitUntil: 'networkidle0', timeout: 20_000 });
    } catch {
      note(cle, format.largeur, 'chargement', 'la page n’a pas fini de charger en 20 s');
      return;
    }
    await new Promise((r) => setTimeout(r, 1800));
    /* Les classés sont-ils à l'écran ? Leurs pseudos, cherchés dans le texte
       rendu (« text-transform » compris, d'où les capitales), sans rien
       supposer du balisage que le lot 5 refait. Moins de la moitié : la
       ferveur semée ne tombe pas dans la liste affichée, et ce n'est plus
       l'état qu'on croit mesurer. */
    const vus = await page.evaluate((pseudos) => {
      const t = document.body.innerText.toLocaleUpperCase('fr');
      return pseudos.filter((p) => t.includes(p.toLocaleUpperCase('fr'))).length;
    }, CLASSES.filter((c) => !c.moi).map((c) => c.pseudo));
    const attendus = CLASSES.length - 1;
    if (vus * 2 < attendus) {
      note(cle, format.largeur, 'état', `le classement ne montre que ${vus} des ${attendus} supporters semés`);
    }
    const m = await mesurer(page);
    const polices = await page.evaluate(POLICES);
    const capture = await photographier(page, 'classement-classe', format, cle);
    rangerEtat(cle, PAGE_CLASSEMENT, format, { ...polices, capture, classesVus: vus }, m, erreurs, refus);
  } finally {
    await contexte.close();
  }
}

/* ------------------------------------------------- la collection (lot 4)

   Le lot 4 refait les écrans de la collection, et le joueur de l'audit n'en
   a pas : c'est ce que les pages mesurent, et ce que tout relevé d'avant a
   mesuré — on n'y touche pas. Six états la montrent en partie remplie :

     — **le classeur** (`classeur@/fanzzy`) : l'onglet CLASSEUR de /fanzzy,
       que `?ecran=dex` ouvre (l'adresse où renvoie la barre du deck), et le
       bouton `[data-go="dex"]` à défaut. Mesuré comme une page.
     — **la fiche d'un Fanzzy possédé et celle d'un manquant**
       (`fiche@possédé`, `fiche@manquant`) : /fanzzy/<id>, mesurées comme
       des pages. La visite ordinaire de /fanzzy/RP1 voit un manquant chez
       un joueur qui n'a rien : ni la fiche de ce qu'on a, ni un manquant à
       côté de ce qu'on a.
     — **la vitrine**, ouverte sur une carte possédée et sur une manquante
       (`vitrine@possédée`, `vitrine@manquante`) : /collection, la case
       touchée comme au doigt, la vitrine mesurée sous sa propre portée — le
       dialogue ouvert —, comme le tiroir : la page qu'elle couvre a déjà son
       relevé.
     — **la sous-vue de l'album** (`album@/collection`) : la tuile qui l'ouvre
       touchée, l'album mesuré. Elle n'existe qu'une fois le lot fait ;
       avant, l'état le dit (`absent`) et ne relève rien.

   **Un collectionneur par format**, comme le kiosque : chacun part du même
   point, et un format ne voit pas ce que le précédent a écrit. Sa bourse est
   celle du joueur de l'audit (500 écharpes, 6 boosters, 400 XP, Sion). Sa
   collection est tirée du catalogue servi (/api/fanzzy/dex), dans la
   première série ouverte, dans l'ordre du catalogue, qui a tout ce qu'il
   faut — sur la base de test, LA TRIBUNE : LE VIRAGE IMPOSSIBLE, qui la
   précède, n'a que deux lignées. Le classeur et l'album l'amènent à l'écran
   comme un joueur, par le rail des séries ou en faisant défiler (voir
   `allerALaSerie`) :

     avatar     la première lignée de deux âges ou plus, au deuxième âge,
                équipée (TON AVATAR) — c'est la fiche du possédé ;
     doublon    la lignée suivante, en trois exemplaires (« ×3 ») — c'est
                la vitrine du possédé ;
     manquant   la suivante, absente — la fiche et la vitrine du manquant ;
     nouveau    la suivante, possédée et marquée NOUVEAU ;
     legendaire la première légendaire de la série, possédée et NOUVEAU.

   Tout le reste de la série manque, et les autres séries aussi.

   **Les nouveautés sont resemées avant chaque visite**, et aucune visite
   ne les éteint au serveur. Le classeur éteint ce qu'il a montré et la
   fiche éteint sa clé à l'ouverture (contrat § 2) : sans cela, chaque état
   hériterait de ce que le précédent a éteint, et un NOUVEAU ne paraîtrait
   qu'au premier. Resemer ne suffisait pas : l'extinction de départ d'une
   page arrivait après les semailles de la suivante (voir « Une nouveauté
   éteinte par la visite d'avant »).

   **Ce qu'ils lisent de la page, et rien d'autre** : la carte de cardHTML
   (`.fz[data-id]`, que lisent déjà les suites du classeur), `[data-open]`
   et `[data-id]` à défaut ; `[data-serie="<série>"]` pour aller à la page
   de la série semée quand un album ne s'ouvre pas sur elle ;
   `[data-vue="fanzzy"]`, la tuile qui ouvre l'album de /collection, et
   `.tbf-album`, l'album ; un `[role="dialog"]` ouvert pour la vitrine.
   (Avant le lot, la case de /collection n'était pas une carte et se
   trouvait par son nom, `.vig[data-liste="fanzzy"]` : la vignette est
   partie avec l'accordéon, le repli aussi. Le relevé de départ,
   `lot4/audit-avant.json`, l'a employé ; aucun relevé d'après ne le
   peut.) Un identifiant qui manque fait écrire une panne nommée (genre
   « état ») au lieu d'arrêter l'audit, et chaque relevé dit ce qu'il a vu
   (`vus`).

   **L'album de /collection est une sous-vue qui remplace le contenu de la
   page** (`#vue`), pas un calque fixé : il se mesure comme une page. La
   recherche d'un ancêtre `position: fixed` reste pour un album qu'on
   poserait un jour par-dessus la page.

   **Rien n'est forcé.** Un classeur qui ne montre aucune carte semée n'est
   pas mesuré (photographié seulement : la capture dit ce qu'il montrait), une
   fiche qui ne nomme pas son personnage non plus ; une vitrine qui montre une
   autre carte que celle touchée est mesurée, et c'est relevé.

   Semés **après** le classement d'un joueur classé, qui redémarre le
   serveur : les collectionneurs n'existent pas encore quand les pages et les
   autres états sont mesurés, et aucun relevé d'avant ne peut donc les
   voir. */
const PAGE_CLASSEUR = '/fanzzy?ecran=dex';
const PAGE_COLLECTION = '/collection';
/* Les rôles semés, dans l'ordre où le classeur les range. */
const ROLES_SEMES = ['avatar', 'doublon', 'manquant', 'nouveau', 'legendaire'];
const POSSEDES = ['avatar', 'doublon', 'nouveau', 'legendaire'];

/** La collection à semer, lue dans le catalogue que le serveur sert. */
async function planDeCollection() {
  const r = await fetch(`${base}/api/fanzzy/dex`, { headers: { 'x-forwarded-for': '10.78.0.1' } });
  if (!r.ok) throw new Error(`/api/fanzzy/dex a répondu ${r.status}`);
  const d = await r.json();
  const numero = (id) => Number(/^[A-Z]+(\d+)/.exec(id)?.[1] ?? 0);
  for (const s of (d.sets ?? []).filter((x) => x.ouverte !== false)) {
    const cartes = (d.dex ?? []).filter((f) => f.set === s.id);
    const lignee = (id) => cartes.filter((f) => (f.racine ?? f.id) === id)
      .sort((a, b) => (a.stade ?? 1) - (b.stade ?? 1));
    const racines = cartes.filter((f) => (f.racine ?? f.id) === f.id && f.rar !== 'legendaire')
      .sort((a, b) => numero(a.id) - numero(b.id));
    const i = racines.findIndex((f) => lignee(f.id).length >= 2);
    const suite = i >= 0 ? racines.slice(i + 1, i + 4) : [];
    const legendaire = cartes.filter((f) => f.rar === 'legendaire')
      .sort((a, b) => numero(a.id) - numero(b.id))[0];
    if (suite.length < 3 || !legendaire) continue;
    /* Les noms de tous les âges : une fiche au deuxième âge peut porter le
       nom du deuxième, et c'est par eux qu'on vérifie qu'elle est la bonne. */
    const role = (f) => ({ id: f.id, nom: f.nom, noms: lignee(f.id).map((x) => x.nom), rar: f.rar });
    return { serie: s.id, nomSerie: s.nom, avatar: { ...role(racines[i]), copies: 1, stade: 2 },
      doublon: { ...role(suite[0]), copies: 3, stade: 1 }, manquant: role(suite[1]),
      nouveau: { ...role(suite[2]), copies: 1, stade: 1 }, legendaire: { ...role(legendaire), copies: 1, stade: 1 } };
  }
  return null;
}

/** Un collectionneur pour ce format, semé selon le plan. */
async function collectionneur(format, plan) {
  const qui = `collection-${cleFormat(format)}`;
  const id = `aud00000-0000-0000-0003-${String(format.largeur).padStart(4, '0')}${
    String(format.hauteur).padStart(8, '0')}`;
  await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status,email_verified_at)
                    VALUES (?,?,?,'x','active',NOW(3))`, [id, `${qui}@ex.fr`, `Collection${format.largeur}`]);
  await pool.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,onboarded_at,active_fanzzy)
                    VALUES (?,500,6,400,NOW(3),?)`, [id, plan.avatar.id]);
  await pool.query('INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)', [id]);
  for (const r of POSSEDES) {
    await pool.query('INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage) VALUES (?,?,?,?)',
      [id, plan[r].id, plan[r].copies, plan[r].stade]);
  }
  const j = `audit-session-${qui}`.padEnd(44, '0');
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     SELECT ?, id, NOW(3) + INTERVAL 1 DAY FROM users WHERE public_id = ?`,
    [createHash('sha256').update(j).digest('hex'), id]);
  SESSIONS[qui] = j;
  return { qui, id };
}

/** Les nouveautés du collectionneur, remises telles quelles (voir plus haut).
    Faux si la table manque : l'écran n'a alors rien de nouveau à montrer, et
    le relevé le dit. */
async function resemerNouveautes(id, plan) {
  try {
    await pool.query('DELETE FROM user_nouveautes WHERE user_id = ?', [id]);
    for (const r of ['nouveau', 'legendaire']) {
      await pool.query('INSERT INTO user_nouveautes (user_id,cle,sorte) VALUES (?,?,?)',
        [id, `fanzzy:${plan[r].id}`, 'fanzzy']);
    }
    return true;
  } catch {
    return false;
  }
}

/* Où sont les cartes semées : à l'écran, rendues plus loin (sous le pli, sur
   la page voisine d'un album), dans le document sans boîte (un écran caché),
   ou absentes. */
const OU_SONT_LES_CARTES = (ids) => {
  const out = {};
  for (const [role, id] of Object.entries(ids)) {
    const q = CSS.escape(id);
    const els = [...document.querySelectorAll(`.fz[data-id="${q}"], [data-open="${q}"]`)];
    const rendus = els.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    });
    const ecran = rendus.some((e) => {
      const r = e.getBoundingClientRect();
      return r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    });
    out[role] = ecran ? 'écran' : rendus.length ? 'plus loin' : els.length ? 'caché' : 'absent';
  }
  return out;
};
const idsDuPlan = (plan) => Object.fromEntries(ROLES_SEMES.map((r) => [r, plan[r].id]));

/* Touche, comme un doigt, un élément visible qui répond à ce sélecteur. */
const TOUCHER = (sel) => {
  const e = [...document.querySelectorAll(sel)].find((x) => {
    const r = x.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden';
  });
  if (!e) return false;
  e.scrollIntoView({ block: 'nearest', inline: 'center' });
  e.click();
  return true;
};

/* Fait défiler jusqu'à la première carte semée rendue, dans l'ordre du
   document, comme un doigt : la grille qui défile en hauteur, ou l'album qui
   tourne ses pages en largeur. */
const DEFILER_JUSQU_A = (ids) => {
  const sel = ids.map((id) => `.fz[data-id="${CSS.escape(id)}"]`).join(', ');
  const e = [...document.querySelectorAll(sel)].find((x) => {
    const r = x.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(x).visibility !== 'hidden';
  });
  if (!e) return false;
  e.scrollIntoView({ block: 'start', inline: 'start' });
  return true;
};

/** Amène la série semée à l'écran si aucune carte semée n'y est : par le
    rail d'un album (`[data-serie]`), sinon en faisant défiler jusqu'à elle
    (LA TRIBUNE vient après LE VIRAGE IMPOSSIBLE dans le catalogue de test,
    qui n'a que deux lignées et ne suffit pas au plan). Rend ce qui a été
    fait, et où sont les cartes ensuite. */
async function allerALaSerie(page, plan) {
  const vus = await page.evaluate(OU_SONT_LES_CARTES, idsDuPlan(plan));
  if (Object.values(vus).includes('écran')) return { serie: 'arrivée', vus };
  let serie = null;
  if (await page.evaluate(TOUCHER, `[data-serie="${plan.serie}"]`).catch(() => false)) {
    serie = 'par le rail des séries';
  } else if (await page.evaluate(DEFILER_JUSQU_A, ROLES_SEMES.map((r) => plan[r].id)).catch(() => false)) {
    serie = 'en faisant défiler jusqu’à elle';
  } else {
    return { serie: 'pas à l’écran, ni rail [data-serie] ni carte rendue où aller', vus };
  }
  await finDesMouvements(page, 'body', 2000);
  await new Promise((r) => setTimeout(r, 300));
  return { serie, vus: await page.evaluate(OU_SONT_LES_CARTES, idsDuPlan(plan)) };
}

/* **Une nouveauté éteinte par la visite d'avant.** L'album de /collection
   donnait 201, 202 ou 203 textes d'un relevé à l'autre, sur le même commit :
   ses NOUVEAU — deux, un, ou aucun — et, sans aucun, l'album ouvert sur la
   première série au lieu de celle des cartes semées (`serie` : « par le
   rail » au lieu d'« arrivée »). La cause était ici. Une page éteint au
   serveur ce qu'elle a montré, **en partant** (`pagehide`, une requête
   `keepalive`) ; or fermer le contexte rend la main **avant** que cette
   requête ait atteint le serveur — vu à la sonde : elle y arrive après, et
   l'interception ne la voit pas. La visite suivante resemait ses nouveautés
   juste avant, et la requête de départ de la précédente les effaçait
   derrière elle, selon la charge du poste.

   Le collectionneur ne doit donc rien éteindre au serveur : chaque visite
   repart de ce qu'on a semé, et c'est ce que « resemées avant chaque
   visite » voulait dire. L'extinction est **répondue par l'audit**
   (`POST /api/fanzzy/vu`, la forme de la route), et la page quitte le
   document (`about:blank`) avant qu'on ferme son contexte : son départ part
   alors sous l'interception, qui le retient — à la sonde, rien n'arrive au
   serveur. Ce que la page montre pendant la visite ne change pas : elle
   reçoit le « 200 » qu'elle attend. `nouveautesEnBase` dit, après
   l'arrivée, combien des nouveautés semées étaient encore en base. */
const SANS_EXTINCTION = { 'POST /api/fanzzy/vu': { restantes: 0 } };
const partirSansEteindre = ({ page, contexte }) => ({
  async close() {
    await page.goto('about:blank', { timeout: 5000 }).catch(() => {});
    return contexte.close();
  },
});

/** Arrive sur une page avec un joueur semé (le collectionneur, ou le joueur
    de l'audit et ses insignes), comme les autres visites : le réseau tu, le
    rideau parti, une fête fermée si elle est venue. Rend la visite, ou null
    si la page n'a pas chargé (et c'est noté). Sans `plan` (le profil des
    insignes), aucune nouveauté à resemer, et rien à retenir. */
async function arriver(format, joueur, plan, chemin, cle) {
  const nouveautes = plan ? await resemerNouveautes(joueur.id, plan) : null;
  const ouverte = await nouvelleVisite(format, joueur.qui, plan ? { bouchons: SANS_EXTINCTION } : {});
  const visite = plan ? { ...ouverte, contexte: partirSansEteindre(ouverte) } : ouverte;
  /* La page chargée, puis notre serveur tu — et non « networkidle0 », que
     le classeur ne donne plus après le premier contexte : voir « Le calme
     de notre serveur ». Une seconde chance, comme pour les pages. */
  let charge = false;
  for (let essai = 1; essai <= 2 && !charge; essai += 1) {
    try {
      await visite.page.goto(base + chemin, { waitUntil: 'load', timeout: 20_000 });
      charge = true;
      if (essai > 1) note(cle, format.largeur, 'chargement', 'chargée au second essai');
    } catch { /* on retente une fois */ }
  }
  if (!charge) {
    note(cle, format.largeur, 'chargement', `la page n’a pas fini de charger en 20 s, deux fois${
      visite.enVol.size ? ` (en attente : ${enAttente(visite.enVol)})` : ''}`);
    await visite.contexte.close();
    return null;
  }
  if (!await calmeDeNotreServeur(visite.enVol)) {
    note(cle, format.largeur, 'chargement', `notre serveur ne s’est pas tu en 15 s (en attente : ${
      enAttente(visite.enVol)}) : mesurée quand même`);
  }
  await visite.page.waitForFunction(() => !document.getElementById('ouverture'), { timeout: 12_000 })
    .catch(() => {});
  await new Promise((r) => setTimeout(r, 1800));
  const fete = await fermerLaFete(visite.page, cle, format.largeur);
  await finDesMouvements(visite.page, 'body', 2500);
  await new Promise((r) => setTimeout(r, 300));
  /* Les polices dès l'arrivée, bornées comme dans `mesurer` : un état qui
     n'est que photographié (une panne) doit l'être dans la police du joueur,
     sans quoi sa capture ferait chercher un défaut de plus. */
  await visite.page.evaluate(() => Promise.race([document.fonts?.ready.then(() => true),
    new Promise((r) => { setTimeout(() => r(false), 5000); })])).catch(() => {});
  /* Les nouveautés semées encore en base, la page arrivée : deux, si rien
     ne les a éteintes en chemin (voir « Une nouveauté éteinte par la visite
     d'avant »). Null sans table ou sans semailles. */
  const nouveautesEnBase = plan && nouveautes
    ? await pool.query('SELECT COUNT(*) AS n FROM user_nouveautes WHERE user_id = ?', [joueur.id])
      .then(([[r]]) => Number(r?.n ?? 0), () => null)
    : null;
  return { ...visite, ...(plan ? { nouveautes, nouveautesEnBase } : {}), ...(fete ? { fete } : {}) };
}

async function etatClasseur(format, plan, joueur) {
  const cle = 'classeur@/fanzzy';
  const v = await arriver(format, joueur, plan, PAGE_CLASSEUR, cle);
  if (!v) return;
  const { contexte, page, erreurs, refus } = v;
  try {
    /* L'onglet, si l'adresse ne l'a pas ouvert. */
    let ouvert = 'par l’adresse';
    let vus = await page.evaluate(OU_SONT_LES_CARTES, idsDuPlan(plan));
    if (!Object.values(vus).some((x) => x === 'écran' || x === 'plus loin')) {
      ouvert = await page.evaluate(TOUCHER, '[data-go="dex"]') ? 'par l’onglet [data-go="dex"]' : 'ni l’un ni l’autre';
      await finDesMouvements(page, 'body', 2500);
      await new Promise((r) => setTimeout(r, 300));
    }
    const allee = await allerALaSerie(page, plan);
    vus = allee.vus;
    const polices = await page.evaluate(POLICES);
    const donnees = { ...polices, ouvert, serie: allee.serie, vus, nouveautes: v.nouveautes,
      nouveautesEnBase: v.nouveautesEnBase, ...(v.fete ? { fete: v.fete } : {}) };
    if (!Object.values(vus).some((x) => x === 'écran' || x === 'plus loin')) {
      note(cle, format.largeur, 'état', `le classeur ne montre aucune des cartes semées (série ${plan.serie}) : `
        + 'photographié, pas mesuré');
      rangerEtat(cle, PAGE_CLASSEUR, format, { ...donnees,
        capture: await photographier(page, 'classeur-fanzzy', format, cle) });
      return;
    }
    const m = await mesurer(page);
    const capture = await photographier(page, 'classeur-fanzzy', format, cle);
    rangerEtat(cle, PAGE_CLASSEUR, format, { ...donnees, capture }, m, erreurs, refus);
  } finally {
    await contexte.close();
  }
}

/** La fiche, d'un possédé (l'avatar) ou d'un manquant. */
async function etatFiche(format, plan, joueur, sorte) {
  const cle = `fiche@${sorte}`;
  const carte = sorte === 'possédé' ? plan.avatar : plan.manquant;
  const chemin = `/fanzzy/${carte.id}`;
  const v = await arriver(format, joueur, plan, chemin, cle);
  if (!v) return;
  const { contexte, page, erreurs, refus } = v;
  try {
    /* La bonne fiche : elle nomme le personnage, à l'un de ses âges. Dans le
       texte rendu (capitales comprises), sans rien supposer du balisage. */
    const nomVu = await page.evaluate((noms) => {
      const t = document.body.innerText.toLocaleUpperCase('fr');
      return noms.some((n) => t.includes(n.toLocaleUpperCase('fr')));
    }, carte.noms);
    const nomCapture = `fiche-${sorte === 'possédé' ? 'possede' : 'manquant'}`;
    const donnees = { carte: carte.id, nomVu, nouveautes: v.nouveautes, nouveautesEnBase: v.nouveautesEnBase,
      ...(v.fete ? { fete: v.fete } : {}) };
    if (!nomVu) {
      note(cle, format.largeur, 'état', `la fiche de ${carte.id} ne nomme pas ${carte.noms.join(' / ')} : `
        + 'photographiée, pas mesurée');
      rangerEtat(cle, chemin, format, { ...donnees, ...await page.evaluate(POLICES),
        capture: await photographier(page, nomCapture, format, cle) });
      return;
    }
    const m = await mesurer(page);
    const polices = await page.evaluate(POLICES);
    const capture = await photographier(page, nomCapture, format, cle);
    rangerEtat(cle, chemin, format, { ...polices, capture, ...donnees }, m, erreurs, refus);
  } finally {
    await contexte.close();
  }
}

/** Ouvre l'album de /collection s'il existe : sa tuile, puis l'album lui-même.
    Rend comment, ou null quand il n'y a ni tuile ni album. */
async function ouvrirAlbum(page) {
  return page.evaluate(`(async () => {
    const vu = (e) => { const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
    const album = () => [...document.querySelectorAll('.tbf-album')].some(vu);
    if (album()) return 'déjà ouvert';
    if (!(${TOUCHER})('[data-vue="fanzzy"]')) return null;
    return (await (${ATTENDRE})(album, 3000)) ? 'par sa tuile' : 'tuile touchée, et pas d’album';
  })()`).catch(() => null);
}

/* La case d'une carte, touchée comme au doigt. La carte de cardHTML
   d'abord, puis ce qui l'ouvre : la case de l'album (`[data-open]`), ou sa
   pochette quand la carte manque. Rend par quoi elle a été trouvée, ou
   null. */
const TOUCHER_UNE_CASE = (id) => {
  const rendu = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  };
  const q = CSS.escape(id);
  let par = null;
  let carte = null;
  for (const [sel, dit] of [[`.fz[data-id="${q}"]`, 'sa carte (.fz[data-id])'],
    [`[data-open="${q}"]`, '[data-open]'], [`[data-id="${q}"]`, '[data-id]']]) {
    carte = [...document.querySelectorAll(sel)].find(rendu) ?? null;
    if (carte) { par = dit; break; }
  }
  if (!carte) return null;
  const cible = carte.closest('button, a[href], [data-open], [role="button"]') ?? carte;
  cible.scrollIntoView({ block: 'center', inline: 'center' });
  cible.click();
  return par;
};

/* Le dialogue ouvert — la vitrine —, désigné par un sélecteur que MESURE
   retrouve : son identifiant, ou son chemin depuis le premier ancêtre qui en
   a un. Le plus grand s'il y en a deux. Rien posé sur la page. */
const VITRINE_OUVERTE = () => {
  const ouverte = (e) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0
      && r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
  };
  const aire = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
  const d = [...document.querySelectorAll('[role="dialog"], dialog[open]')].filter(ouverte)
    .sort((a, b) => aire(b) - aire(a))[0];
  if (!d) return null;
  const chemin = [];
  for (let n = d; n && n !== document.body; n = n.parentElement) {
    if (n.id) { chemin.unshift(`#${CSS.escape(n.id)}`); return chemin.join(' > '); }
    const memes = [...n.parentElement.children].filter((x) => x.tagName === n.tagName);
    chemin.unshift(`${n.tagName.toLowerCase()}:nth-of-type(${memes.indexOf(n) + 1})`);
  }
  return ['body', ...chemin].join(' > ');
};

/** La vitrine de /collection, sur une carte possédée (le doublon) ou une
    manquante. */
async function etatVitrine(format, plan, joueur, sorte) {
  const cle = `vitrine@${sorte}`;
  const carte = sorte === 'possédée' ? plan.doublon : plan.manquant;
  const v = await arriver(format, joueur, plan, PAGE_COLLECTION, cle);
  if (!v) return;
  const { contexte, page, erreurs, refus } = v;
  /* Une panne est photographiée : la capture dit ce que l'écran montrait à la
     place de la vitrine. Pas mesurée : ce n'est pas l'état qu'on nomme. */
  const nomCapture = `vitrine-${sorte === 'possédée' ? 'possedee' : 'manquante'}`;
  const echec = async (quoi, en = {}) => {
    note(cle, format.largeur, 'état', quoi);
    const capture = await photographier(page, nomCapture, format, cle).catch(() => null);
    rangerEtat(cle, PAGE_COLLECTION, format, { capture, carte: carte.id, ...en });
  };
  try {
    const album = await ouvrirAlbum(page);
    if (album) await finDesMouvements(page, 'body', 2000);
    let touche = await page.evaluate(TOUCHER_UNE_CASE, carte.id);
    if (!touche && album) {
      await allerALaSerie(page, plan);
      touche = await page.evaluate(TOUCHER_UNE_CASE, carte.id);
    }
    if (!touche) { await echec(`la case de ${carte.id} (${carte.nom}) n’a pas été trouvée`, { album }); return; }
    const portee = await page.waitForFunction(VITRINE_OUVERTE, { polling: 50, timeout: 4000 })
      .then((h) => h.jsonValue(), () => null);
    if (!portee) {
      await echec(`la case de ${carte.id} touchée (${touche}), aucune vitrine ([role="dialog"]) ne s’est ouverte en 4 s`,
        { album, touche });
      return;
    }
    /* La fanfare d'une carte qu'on a (FX.rare), l'entrée de la carte : ce
       qui finit, pas ce qui respire. */
    await finDesMouvements(page, 'body', 2500);
    await new Promise((r) => setTimeout(r, 300));
    const carteVue = await page.evaluate((sel, id, noms) => {
      const z = document.querySelector(sel);
      if (!z) return false;
      if (z.querySelector(`.fz[data-id="${CSS.escape(id)}"]`)) return true;
      const t = z.innerText.toLocaleUpperCase('fr');
      return noms.some((n) => t.includes(n.toLocaleUpperCase('fr')));
    }, portee, carte.id, carte.noms);
    if (!carteVue) {
      note(cle, format.largeur, 'état', `la vitrine (${portee}) ne montre pas ${carte.id} : mesurée quand même`);
    }
    const m = await mesurer(page, portee);
    const polices = await page.evaluate(POLICES);
    const capture = await photographier(page, nomCapture, format, cle);
    rangerEtat(cle, PAGE_COLLECTION, format, { ...polices, capture, carte: carte.id, portee, touche, carteVue,
      ...(album ? { album } : {}), nouveautes: v.nouveautes, nouveautesEnBase: v.nouveautesEnBase,
      ...(v.fete ? { fete: v.fete } : {}) },
    m, erreurs, refus);
  } catch (e) {
    await echec(`l’étape a levé : ${String(e?.message ?? e).slice(0, 80)}`);
  } finally {
    await contexte.close();
  }
}

/** L'album Fanzzy de /collection, quand il existe. Mesuré sous la portée du
    calque fixé qui le porte s'il en a un (une sous-vue posée par-dessus la
    page), sinon comme une page (une sous-vue qui remplace le contenu). */
async function etatAlbum(format, plan, joueur) {
  const cle = 'album@/collection';
  const v = await arriver(format, joueur, plan, PAGE_COLLECTION, cle);
  if (!v) return;
  const { contexte, page, erreurs, refus } = v;
  try {
    const album = await ouvrirAlbum(page);
    if (!album) {
      rangerEtat(cle, PAGE_COLLECTION, format, { capture: null,
        absent: 'pas d’album sur /collection : ni tuile [data-vue="fanzzy"] ni .tbf-album' });
      return;
    }
    if (album !== 'déjà ouvert' && album !== 'par sa tuile') {
      /* Une tuile qui n'ouvre rien : photographiée, pour qu'on voie ce
         qu'elle a ouvert à la place. */
      note(cle, format.largeur, 'état', album);
      rangerEtat(cle, PAGE_COLLECTION, format, { album,
        capture: await photographier(page, 'album-collection', format, cle) });
      return;
    }
    await finDesMouvements(page, 'body', 2500);
    const allee = await allerALaSerie(page, plan);
    const portee = await page.evaluate(() => {
      const a = [...document.querySelectorAll('.tbf-album')].find((e) => e.getBoundingClientRect().width > 0);
      let n = a;
      while (n && n !== document.body && getComputedStyle(n).position !== 'fixed') n = n.parentElement;
      if (!n || n === document.body) return null;
      const chemin = [];
      for (let x = n; x && x !== document.body; x = x.parentElement) {
        if (x.id) { chemin.unshift(`#${CSS.escape(x.id)}`); return chemin.join(' > '); }
        const memes = [...x.parentElement.children].filter((y) => y.tagName === x.tagName);
        chemin.unshift(`${x.tagName.toLowerCase()}:nth-of-type(${memes.indexOf(x) + 1})`);
      }
      return ['body', ...chemin].join(' > ');
    });
    const m = await mesurer(page, portee);
    const polices = await page.evaluate(POLICES);
    const capture = await photographier(page, 'album-collection', format, cle);
    rangerEtat(cle, PAGE_COLLECTION, format, { ...polices, capture, album, portee, serie: allee.serie,
      vus: allee.vus, nouveautes: v.nouveautes, nouveautesEnBase: v.nouveautesEnBase,
      ...(v.fete ? { fete: v.fete } : {}) }, m, erreurs, refus);
  } finally {
    await contexte.close();
  }
}

/** Les six états, format après format, chacun avec son collectionneur. */
async function etatsDeLaCollection() {
  const CLES = ['classeur@/fanzzy', 'fiche@possédé', 'fiche@manquant', 'vitrine@possédée',
    'vitrine@manquante', 'album@/collection'];
  let plan = null;
  let faute = null;
  try { plan = await planDeCollection(); } catch (e) { faute = String(e?.message ?? e).slice(0, 80); }
  if (!plan) {
    for (const format of FORMATS) {
      for (const cle of CLES) {
        note(cle, format.largeur, 'état', faute ? `pas de collection à semer : ${faute}`
          : 'aucune série ouverte n’a une lignée de deux âges, trois lignées après elle et une légendaire');
      }
    }
    return null;
  }
  for (const format of FORMATS) {
    const joueur = await collectionneur(format, plan);
    /* Chaque état nomme sa panne au lieu d'arrêter les suivants : une page
       qui lève ne doit pas coûter les cinq autres relevés. */
    const etapes = [[CLES[0], () => etatClasseur(format, plan, joueur)],
      [CLES[1], () => etatFiche(format, plan, joueur, 'possédé')],
      [CLES[2], () => etatFiche(format, plan, joueur, 'manquant')],
      [CLES[3], () => etatVitrine(format, plan, joueur, 'possédée')],
      [CLES[4], () => etatVitrine(format, plan, joueur, 'manquante')],
      [CLES[5], () => etatAlbum(format, plan, joueur)]];
    for (const [cle, etape] of etapes) {
      try { await etape(); } catch (e) {
        note(cle, format.largeur, 'état', `l’étape a levé : ${String(e?.message ?? e).slice(0, 80)}`);
      }
    }
  }
  return { serie: plan.serie, nomSerie: plan.nomSerie,
    cartes: Object.fromEntries(ROLES_SEMES.map((r) => [r, { id: plan[r].id, nom: plan[r].nom, rar: plan[r].rar,
      ...(plan[r].copies ? { copies: plan[r].copies, stade: plan[r].stade } : { possede: false }) }])),
    nouveautes: ['nouveau', 'legendaire'].map((r) => `fanzzy:${plan[r].id}`) };
}

/* ---------------------------------------- les insignes du carnet (lot 4)

   Le carnet de saison donne à porter un liseré et un tampon. Le lot 4 les
   sert (`GET /api/quotidien`, `insignes` : CONTRATS.md, § 6.1) et le profil
   les dessine : le tampon « S1 » sur la carte de supporter, le liseré
   autour de l'anneau du buste, les stickers « LISERÉ S1 » et « TAMPON S1 »
   de MA SAISON. Le joueur de l'audit n'en porte aucun : sa visite de
   /profil ne voit rien de tout cela — c'est ce que tout relevé d'avant a
   mesuré, et on n'y touche pas.

   **Un état de plus, `profil@insignes`** : le même joueur, la même page,
   avec ses insignes. Le carnet que le serveur sert dit quels paliers les
   donnent (`carnet.paliers[].insigne` : le liseré, puis le tampon) ; on
   écrit pour chacun la ligne `carnet` du grand livre qu'une réclamation
   aurait écrite — la clé `S<saison>:<palier>`, la saison lancée, le gain du
   palier, l'insigne —, datée de trois jours : rien ne tombe dans le
   disjoncteur du jour. **Aucun tampon de mission** : le carnet compte zéro
   tampon, aucun palier ne devient « prêt », et ni RÉCUPÉRER ni pastille ne
   s'ajoutent. L'écran ne diffère de la visite de /profil que par ce qu'on
   veut y lire.

   Semé **après** le booster et **avant** le classement d'un joueur classé :
   le profil se lit alors comme à sa visite (même bourse, pas encore de
   ferveur de saison). Les lignes semées — et elles seules — sont
   **retirées** après les trois formats : le classement, et tout ce qui
   suit, revoit le joueur sans insigne.

   **Ce qu'il lit de la page, et rien d'autre** : un `.tbf-tampon` qui dit
   « S<numéro> » (la brique du tampon) ; un `[data-lisere]` rendu (la page
   le pose sur le buste, et ui.css le reprendra sur `.tbf-avatar`) ; un
   `.tbf-sticker` qui dit « LISERÉ S<numéro> » ou « TAMPON S<numéro> ». Rien
   de tout cela à l'écran : photographié, pas mesuré, et la panne nommée —
   comme une fiche qui ne nomme pas son personnage ; une partie seulement :
   mesuré, et ce qui manque est relevé. Le serveur est relu après les
   semailles : s'il ne sert pas les insignes semés, la panne est la sienne,
   et l'état le dit avant de regarder la page. */
const PAGE_PROFIL = '/profil';
const CLE_INSIGNES = 'profil@insignes';
/* Le mot que MA SAISON écrit pour chaque insigne (profil.html, `MOTS_INSIGNE`). */
const MOT_INSIGNE = { lisere: 'LISERÉ', tampon: 'TAMPON' };

/** L'état du jour du joueur de l'audit, tel que le serveur le sert. */
async function quotidienDuJoueur() {
  const r = await fetch(`${base}/api/quotidien`,
    { headers: { cookie: `tbf_session=${jeton}`, 'x-forwarded-for': '10.78.0.2' } });
  if (!r.ok) throw new Error(`/api/quotidien a répondu ${r.status}`);
  return r.json();
}

/** Les insignes à semer, lus dans le carnet servi. Lève, en nommant la
    cause, quand il n'y a rien à semer. */
async function planDesInsignes() {
  const q = await quotidienDuJoueur();
  if (q?.actif !== true) throw new Error('le quotidien est éteint ({ actif: false })');
  const s = q.carnet?.saison;
  if (!s) throw new Error('aucun carnet servi (saison.carnet_actif coupé, ou aucune saison lancée)');
  const paliers = Object.keys(MOT_INSIGNE).flatMap((insigne) => {
    const p = (q.carnet.paliers ?? []).find((x) => x.insigne === insigne);
    return p ? [{ insigne, n: p.n, gain: p.gain ?? {} }] : [];
  });
  if (!paliers.length) throw new Error('aucun palier du carnet servi ne donne d’insigne');
  return { saison: { id: s.id, numero: s.numero, nom: s.nom }, paliers };
}

/** Écrit les lignes du grand livre, et range dans `semees`, au fur et à
    mesure, les clés de celles qu'on a écrites : une ligne déjà là (une
    réclamation d'un autre état) n'est ni réécrite ni, plus tard, retirée,
    et une faute à la seconde ligne laisse la première à retirer. */
async function semerInsignes(plan, semees) {
  for (const p of plan.paliers) {
    const cle = `S${plan.saison.id}:${p.n}`;
    const [r] = await pool.query(
      `INSERT IGNORE INTO recompenses (user_id,source,cle,saison_id,echarpes,packs,xp,tampons,insigne,verse_a)
       VALUES (?,'carnet',?,?,?,?,?,0,?,NOW(3) - INTERVAL 3 DAY)`,
      [U, cle, plan.saison.id, p.gain.echarpes ?? 0, p.gain.packs ?? 0, p.gain.xp ?? 0, p.insigne]);
    if (r.affectedRows) semees.push(cle);
  }
}

/* Ce que le profil montre des insignes de la saison `numero`. Le numéro
   suivi d'autre chose qu'un chiffre : « S1 » ne se lit pas dans « S12 ». */
const INSIGNES_VUS = (numero) => {
  const vu = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  };
  const texte = (e) => e.textContent.replace(/\s+/g, ' ').trim().toLocaleUpperCase('fr');
  const s = `S${numero}`;
  const stickers = [...document.querySelectorAll('.tbf-sticker')].filter(vu).map(texte);
  return {
    tampon: [...document.querySelectorAll('.tbf-tampon')].some((e) => vu(e) && texte(e) === s),
    lisere: [...document.querySelectorAll('[data-lisere]')].some(vu),
    stickers: ['LISERÉ', 'TAMPON'].filter((m) =>
      stickers.some((t) => new RegExp(`${m} ${s}(?![0-9])`).test(t))),
  };
};

/* Amène à l'écran le premier sticker d'insigne de MA SAISON, sous le pli
   au téléphone. Rend « écran » s'il y était déjà, « amené », ou null. */
const AMENER_MA_SAISON = (numero) => {
  const e = [...document.querySelectorAll('.tbf-sticker')].find((x) => {
    const r = x.getBoundingClientRect();
    return r.width > 0 && r.height > 0
      && new RegExp(`(LISERÉ|TAMPON) S${numero}(?![0-9])`).test(x.textContent.toLocaleUpperCase('fr'));
  });
  if (!e) return null;
  const r = e.getBoundingClientRect();
  if (r.top >= 0 && r.bottom <= innerHeight) return 'écran';
  e.scrollIntoView({ block: 'center' });
  return 'amené';
};

async function etatProfilInsignes(format, plan) {
  const cle = CLE_INSIGNES;
  const v = await arriver(format, { qui: 'joueur', id: U }, null, PAGE_PROFIL, cle);
  if (!v) return;
  const { contexte, page, erreurs, refus } = v;
  try {
    const numero = plan.saison.numero;
    const vus = await page.evaluate(INSIGNES_VUS, numero);
    const portes = plan.paliers.map((p) => p.insigne);
    const manque = [
      ...(portes.includes('tampon') && !vus.tampon ? [`le tampon S${numero} sur la carte`] : []),
      ...(portes.includes('lisere') && !vus.lisere ? ['le liseré du buste ([data-lisere])'] : []),
      ...portes.map((x) => MOT_INSIGNE[x]).filter((m) => !vus.stickers.includes(m))
        .map((m) => `le sticker « ${m} S${numero} » de MA SAISON`),
    ];
    const donnees = { saison: numero, vus, ...(v.fete ? { fete: v.fete } : {}) };
    if (!vus.tampon && !vus.lisere && !vus.stickers.length) {
      note(cle, format.largeur, 'état', `le profil ne montre aucun des insignes semés (${
        portes.map((x) => `${MOT_INSIGNE[x]} S${numero}`).join(', ')}) : photographié, pas mesuré`);
      rangerEtat(cle, PAGE_PROFIL, format, { ...donnees, ...await page.evaluate(POLICES),
        capture: await photographier(page, 'profil-insignes', format, cle) });
      return;
    }
    if (manque.length) {
      note(cle, format.largeur, 'état', `le profil ne montre pas ${manque.join(', ')} : mesuré quand même`);
    }
    const m = await mesurer(page);
    const polices = await page.evaluate(POLICES);
    const capture = await photographier(page, 'profil-insignes', format, cle);
    /* MA SAISON est sous le pli au téléphone : une seconde capture l'amène à
       l'écran, après la mesure — qui a lu la page telle qu'on y arrive. */
    const saison = await page.evaluate(AMENER_MA_SAISON, numero).catch(() => null);
    let captureSaison = null;
    if (saison === 'amené') {
      await new Promise((r) => setTimeout(r, 400));
      captureSaison = await photographier(page, 'profil-insignes-saison', format, cle);
    }
    rangerEtat(cle, PAGE_PROFIL, format, { ...polices, capture, ...(captureSaison ? { captureSaison } : {}),
      ...donnees }, m, erreurs, refus);
  } finally {
    await contexte.close();
  }
}

/** Les insignes semés, le profil regardé dans chaque format, puis les
    lignes retirées. Rend ce qui a été semé et ce que le serveur en a servi,
    ou la cause quand rien ne l'a été. */
async function etatsDesInsignes() {
  const cle = CLE_INSIGNES;
  let plan;
  try { plan = await planDesInsignes(); } catch (e) {
    const faute = String(e?.message ?? e).slice(0, 100);
    for (const format of FORMATS) note(cle, format.largeur, 'état', `pas d’insigne à semer : ${faute}`);
    return { faute };
  }
  const semees = [];
  try {
    /* Une faute d'écriture nomme sa panne au lieu d'arrêter l'audit : le
       classement et la collection viennent encore. */
    try { await semerInsignes(plan, semees); } catch (e) {
      const faute = `insignes non semés : ${String(e?.message ?? e).slice(0, 80)}`;
      for (const format of FORMATS) note(cle, format.largeur, 'état', faute);
      return { saison: plan.saison, faute };
    }
    const servis = await quotidienDuJoueur()
      .then((q) => (q.insignes ?? []).map((x) => `${x.id} S${x.saison?.numero}`), () => []);
    const attendus = plan.paliers.map((p) => `${p.insigne} S${plan.saison.numero}`);
    const absents = attendus.filter((x) => !servis.includes(x));
    if (absents.length) {
      for (const format of FORMATS) {
        note(cle, format.largeur, 'état', `le serveur ne sert pas ${absents.join(', ')} (insignes de /api/quotidien) `
          + 'après les semailles : ce que le profil n’en montre pas n’est pas sa faute');
      }
    }
    for (const format of FORMATS) {
      try { await etatProfilInsignes(format, plan); } catch (e) {
        note(cle, format.largeur, 'état', `l’étape a levé : ${String(e?.message ?? e).slice(0, 80)}`);
      }
    }
    return { saison: plan.saison,
      lignes: plan.paliers.map((p) => ({ cle: `S${plan.saison.id}:${p.n}`, insigne: p.insigne, gain: p.gain,
        semee: semees.includes(`S${plan.saison.id}:${p.n}`) })),
      servis };
  } finally {
    if (semees.length) {
      await pool.query(`DELETE FROM recompenses WHERE user_id = ? AND source = 'carnet' AND cle IN (?)`, [U, semees])
        .catch((e) => {
          for (const format of FORMATS) {
            note(cle, format.largeur, 'état', `lignes semées non retirées (${semees.join(', ')}) : ${
              String(e?.message ?? e).slice(0, 60)} — le classement verra le joueur avec ses insignes`);
          }
        });
    }
  }
}

/* ------------------------------------------------------ les arènes (lot 6)

   **Ce que voit le joueur une fois entré**, et que la visite de /virage et
   de /duel-nvn ne voyait jamais : elle arrive, le serveur de l'audit n'a
   aucun match, et elle mesure une porte vide. Onze états, chacun sur une
   visite neuve, du même joueur que les pages (et quatre de plus, plus bas,
   pendant le lot) :

     — `virage@voile` : le voile de choix garni — un match de son club en
       direct, deux ailleurs, un coup d'envoi dans vingt minutes. Mesuré comme
       une page ; et, s'il s'ouvre, le choix du camp sur un match d'ailleurs,
       photographié à part (`captureCamp`), pas mesuré ;
     — `virage@tribune` : la tribune, à l'entrée, une fois l'entrée jouée —
       et son budget de hauteur, rangée par rangée (voir `BUDGET`). Deux
       supporters attendent un duel : le menu y porte son sticker « 2 » ;
     — `virage@double` : la même, entrée pendant la minute qui compte double ;
     — `virage@but` : un but réel de son club, puis la corde qui passe à la
       minute double — mesuré sous la case « GOAL ! » (`.tbf-moment`), une
       fois partis le bandeau et le titre qui passaient par-dessus ;
     — `virage@pave` : un chant touché (le premier du répertoire, un tempo),
       le décompte passé, deux frappes sur le pavé — photographié juste
       après la seconde, sa bouffée encore là, **puis** mesuré sous la
       fenêtre du geste (`#mini`), tant que le geste dure ;
     — `virage@bilan` : un chant accepté (QUESTIONS Q10 : le bilan ne vient
       que si l'on a poussé), puis la flèche. La page demande son bilan
       (`virage:bilan`), la fausse socket lui rend celui du contrat (§ 15).
       Mesuré sous ce qui vient, une fois toutes ses étapes posées (voir
       `attendreLeBilan`) : la page du bilan quand elle porte `#bilan`,
       `[data-bilan]` ou `.tbf-bilan`, la boîte « QUITTER LA TRIBUNE ? »
       d'avant le lot sinon (`.tbf-dial-fond`) ; ce qu'il a trouvé est dans
       `vu`, et la boîte, venue à la place d'un bilan servi, est relevée
       (genre « état »). Rien ne vient : l'état le dit et photographie
       l'écran ;
     — `duel@prepa` : la préparation avec un deck, deux matchs et quelqu'un
       qui attend. Mesurée comme une page ;
     — `duel@vestiaire` : ENTRER EN FILE touché, puis la salle d'attente d'un
       3 contre 3 à moitié pleine — mesurée sous le calque fixé qui porte ses
       tribunes (`.tribune-att`, `#voile` aujourd'hui) ;
     — `duel@affiche` : le coup d'envoi et son affiche, qui part d'elle-même
       au bout de six secondes — photographiée puis mesurée sous `#affiche` ;
     — `duel@jeu` : la partie, et son budget. Mesurée comme une page. Le
       match de son club est en direct : le menu y porte LIVE ;
     — `duel@bilan` : le coup de sifflet et son bilan, mesuré sous `#bilan`
       une fois toutes ses étapes posées, la rangée TOI/LUI en dernier,
       chaque barre à sa part (voir `attendreLeBilan`).

   À 360 × 640, 320 × 568, 412 × 915 et 768 × 1024. **Et la tribune et la
   partie à 1 280 × 800** : la colonne y laisse voir le mur de part et
   d'autre, et c'est là seulement que le voile des arènes se juge (QUESTIONS
   Q6, l'hypothèse H6 : `voile.dense` dit s'il est à 75 % ou à 60 %).

   **Sept états d'arène de plus**, ajoutés pendant le lot :

     — `duel@entrainement` (320 × 568, 412 × 915) : la partie à
       l'entraînement, sur le match à venir de la liste — la plaque
       ENTRAÎNEMENT au milieu du HUD (« ENTRAÎN. » sous 391 px, le mot
       entier au-delà : ses deux formats les plus serrés), pas de ticket
       terrain avant le coup d'envoi ; et son budget ;
     — `duel@pave` (aux quatre formats) : le pavé du duel, comme
       `virage@pave` — le premier chant de la main touché, deux frappes, la
       photo juste après la seconde, mesuré sous `#mini` ;
     — `virage@verdict` et `duel@verdict` (320 × 568, 360 × 640) : le cœur
       du retour du geste, que les deux pavés ne montraient pas — un tempo
       joué jusqu'à sa dernière frappe, la réponse du serveur servie à temps
       (PARFAIT), le tampon claqué au centre du pavé ; photographié puis
       mesuré sous `#mini`, tenu le temps de la mesure par la brique même
       (voir `verdictSurLePave`) ;
     — `duel@but` (320 × 568, 360 × 640) : la corde qui cède pour sa
       tribune, la case de BD du duel (`.tbf-moment`, trois secondes et
       demie), photographiée puis mesurée sous elle ;
     — `virage@300` (mêmes formats) : la tribune de trois cents — le rang à
       trois chiffres, le palier TOP 100, pas de combo — et son budget ;
     — `virage@fin` (mêmes formats) : le coup de sifflet final dans cette
       tribune, sur un Virage qui ne compte pas au classement et dont l'XP
       du jour est déjà prise : le bilan que la page pose seule, avec ses
       notes, sans ligne d'XP, ni de série, ni de souvenir.

   Les deux variantes du Virage sont celles que le brief fait regarder au
   banc de chaque écran (une tribune de 300, un Virage non classé) ; aux
   deux formats les plus serrés, où un chiffre de plus coupe un nom.

   **Et quatre écrans de plus, que le lot refait hors des arènes**, à deux
   formats chacun, sans fausse socket :

     — `repetition@jugee` (320 × 568, 360 × 640) : un tempo joué dans la
       salle de répétition, la note bouchée (PARFAIT) — le tampon sur le
       pavé, le tampon TON MEILLEUR, LE JOUER EN DUEL. Mesuré sous la salle ;
     — `repetition@tri` (mêmes formats) : une épreuve tamponnée, le tri (BON),
       la plus grande grille, que la zone coupe une fois le geste jugé ;
     — `amis@presence` (360 × 640, 768 × 1024) : /amis avec la présence
       servie — un ami au Virage, un en duel, un en ligne, un sans état — et
       un KOP pour « INVITER AU KOP ». Mesuré comme une page ;
     — `tiroir@presence` (mêmes formats) : le tiroir ouvert, la présence
       servie (`{ actif: true, visible: true }`), la ligne « Apparaître hors
       ligne » au pied. Mesuré sous le tiroir, sa hauteur relevée.

   Livrée éteinte, la présence n'est jamais servie au serveur de l'audit :
   sans ces deux états, la pastille et l'interrupteur ne seraient jamais
   regardés.

   **Six règles que les comptes de texte ne lisent pas** sont relevées
   sur chacun : les animations sans fin, le sticker du menu sur un écran de
   jeu, le voile des arènes au-delà de 768 px, la main et les chants à
   l'écran, l'encre qu'un cadre rogne, les libellés de carte couverts —
   voir `reglesDuLot6`.

   **Par la technique du banc des arènes** (lot 0) : la page vient du vrai
   serveur, la socket est fausse (`FAUSSE_SOCKET`), et l'audit lui fait
   recevoir des états fabriqués. Quatre lectures sont bouchées pour garnir le
   voile et la préparation (`/api/virage/live`, `/api/deck/matchs`,
   `/api/deck/loadout`, `/api/nvn/attentes`), et deux pour le sticker du
   menu ; aux autres écrans, la note de la répétition, les amis et les KOP,
   la présence — chacune nommée dans `bouches`. Rien n'est écrit en base :
   ces états passent où l'on veut, et se reprennent seuls (`--arenes`).

   **Ce qui est fabriqué, et pourquoi ces chiffres-là.** Un match, FC Sion –
   FC Bâle à la 66ᵉ (2 – 1 au terrain), poussé pour Sion, le club du joueur.
   Une tribune de 46 contre 31 : la foule a de quoi se remplir, et le 12ᵉ a
   un palier à viser (TOP 10 à 38 de ferveur). Un souffle de 25 sur 100 et
   **aucun regain** : les cartes grisées ne dépendent pas de l'instant de la
   mesure. Quatre cartes d'action, une case laissée vide par une carte de
   duel, une carte en recharge et une trop chère ; les cinq premiers chants
   du répertoire ; le stade de la rencontre (QUESTIONS Q5 : le stade reste).
   Au duel, un 3 contre 3 classé sur le même match (ses clubs et leurs
   couleurs dans la vue), un bot et un absent, trois Fanzzy de LA REPRISE
   (la seule série ouverte), une bâche posée et un changement possible, et
   le Brouillard chez eux. Les chants, les cartes, le barème du geste, les
   Fanzzy, le stade, le niveau, ce qui est en jeu au duel (`enJeuDe`) et
   l'échelle du verdict (`verdictDe`) viennent des modules du dépôt, jamais
   d'une copie : un chant qui change de coût change ici aussi.

   **Les champs de la vague 2 y sont déjà** (contrat, § 15 à § 18) :
   `surgeMs`, `serie`, `prochain`, `verdict`, le bilan de tribune, `enJeu`, la
   cote, les PARFAITS et le meilleur geste du duel ; « +3 places » non
   (QUESTIONS Q12). Une page d'avant le lot les ignore, une page du lot les
   trouve : le relevé d'après se compare à celui-ci, état pour état. */
const FORMATS_ARENES = opt('--largeur') ? FORMATS : [FORMATS_BASE[0], PETIT, GRAND_TELEPHONE, FORMATS_BASE[2]];
const MUR = { largeur: 1280, hauteur: 800 };
const FORMATS_MUR = opt('--largeur') ? [] : [MUR];
const MATCH_ARENE = 990710;
/* **L'entrée, laissée jouer.** Le Virage annonce l'entrée une seconde et
   huit dixièmes (« TU ES DANS LE VIRAGE ») ; le lot 6 y pose les bâches, la
   foule qui compte et le Fanzzy qui salue. On lui laisse ce temps, puis la
   fin de ce qui finit et des chiffres qui comptent — voir `entrerAuVirage`. */
const ENTREE_MS = 2200;

/** Les données de jeu des arènes, lues dans le dépôt, et les états qu'on en
    fabrique. Lève en nommant ce qui manque : tous les états du lot 6 le
    diront. */
async function fabriquerLesArenes() {
  const [{ LISTE_CHANTS }, { ACTIONS, ACTIONS_VIRAGE }, { resoudreGeste }, { BY_ID }, { STADE_BY_ID },
    { apportsDe }, { progression }, { enJeuDe, journeeDuMatch, lieuServi }, { verdictDe }] = await Promise.all([
    import('../src/shared/duel/chants.js'), import('../src/shared/duel/actions.js'),
    import('../src/server/ferveur/gestures.js'), import('../src/shared/fanzzy/dex.js'),
    import('../src/shared/stades.js'), import('../src/shared/apports.js'), import('../src/shared/niveau.js'),
    import('../src/server/deck/index.js'), import('../src/shared/verdict.js')]);
  if (typeof enJeuDe !== 'function') throw new Error('deck/index.js ne sert plus enJeuDe (ce qui est en jeu)');
  if (typeof verdictDe !== 'function') throw new Error('verdict.js ne sert plus verdictDe (l’échelle du verdict)');
  const fz = (id) => {
    const f = BY_ID.get(id);
    if (!f) throw new Error(`le Fanzzy ${id} n’est plus au catalogue`);
    return f;
  };
  const carte = (id) => {
    const a = ACTIONS.find((x) => x.id === id);
    if (!a) throw new Error(`la carte ${id} n’est plus au catalogue`);
    return a;
  };
  const stade = STADE_BY_ID.get('chaudron');
  if (!stade) throw new Error('le stade « chaudron » n’est plus au catalogue');
  const lieu = { id: stade.id, nom: stade.nom, effet: stade.effet };
  const gestes = resoudreGeste({}, { motif: 1 });
  const chants = LISTE_CHANTS.slice(0, 5);
  const iso = (ms) => new Date(Date.now() + ms).toISOString();
  const COULEURS = [['#D52B1E', '#FFFFFF'], ['#1C3F94', '#D52B1E']];
  /* Le blason d’un club : le logo du jeu. Aucun blason réel dans une capture,
     et pas de blason vide non plus — l’API en sert toujours un, et une image
     sans adresse se dessine en icône cassée qu’aucun joueur ne voit. */
  const BLASON = '/img/logo.png';
  const CLUBS = [{ id: 85, name: 'FC Sion' }, { id: 91, name: 'FC Bâle' }];

  /* Le joueur : le Fanzzy qu'il pousse au Virage (la forme « en jeu » du
     serveur, premier âge), ce qu'il porte, et sa main. */
  const sien = fz('RP1');
  const perso = { id: 'RP1', age: 'RP1', evo: 1, nom: sien.nom, skin: 'base', etat: null,
    cri: sien.cri?.label ?? null, rar: sien.rar ?? null };
  const apports = apportsDe({ fanzzy: { nom: sien.nom, mods: sien.mods ?? {} }, stade });
  const mods = { ...(sien.mods ?? {}), ...(stade.mods ?? {}) };
  const mainVirage = ['a-fumigene', 'a-torche', 'a-craquage', 'a-thermos'];
  if (!mainVirage.every((id) => ACTIONS_VIRAGE.some((a) => a.id === id))) {
    throw new Error('une carte de la main du Virage ne se joue plus au Virage');
  }
  const fixture = { id: MATCH_ARENE, homeName: CLUBS[0].name, awayName: CLUBS[1].name,
    homeLogo: BLASON, awayLogo: BLASON, homeColors: COULEURS[0], awayColors: COULEURS[1] };
  /* Le fil, comme le relevé du direct l'a rempli : deux périodes, trois buts
     du terrain (dont un penalty) qui font le 2 – 1, un carton, une corde qui
     a cédé. Les noms sont inventés. */
  const FIL = [
    { genre: 'periode', type: '1H', minute: 0, rang: 0 },
    { genre: 'match', type: 'Goal', detail: 'Normal Goal', joueur: 'L. Kabashi', passeur: 'N. Berset',
      minute: 23, side: 0, rang: 1 },
    { genre: 'match', type: 'Card', detail: 'Yellow Card', joueur: 'T. Roth', minute: 41, side: 1, rang: 2 },
    { genre: 'periode', type: '2H', minute: 46, rang: 3 },
    { genre: 'tribune', side: 0, goals: [1, 0], minute: 52, rang: 4 },
    { genre: 'match', type: 'Goal', detail: 'Penalty', joueur: 'D. Imhof', minute: 58, side: 1, rang: 5 },
    { genre: 'match', type: 'Goal', detail: 'Normal Goal', joueur: 'J. Morand', minute: 64, side: 0, rang: 6 },
  ];
  const niveau = (avant, gain) => {
    const a = progression(avant);
    const p = progression(avant + gain);
    return { xp: avant + gain, gain, ...p, avant: a.niveau, monte: p.niveau > a.niveau,
      paliers: [], ecarpes: 0, depart: { xp: avant, ...a } };
  };

  /* --- le Grand Virage --- */
  /* **La grande tribune** (`grande`) : trois cents d'un côté, deux cent onze
     de l'autre — la tribune de 300 du brief. Là, un chant rapporte de l'ordre
     d'un point (le plancher de ferveur, QUESTIONS Q4) : 18 de ferveur, le rang
     à trois chiffres (212ᵉ sur 298), le palier suivant à TOP 100 (contrat
     § 16 : 100, 50, 10, 3, 1), et **pas de série** — le combo ne se pose pas
     (une donnée absente ne se pose pas). La corde y bouge moins : chaque
     poussée est divisée par l'effectif. */
  const GRANDE = { crowd: [298, 211], rope: -40,
    you: { rank: 212, of: 298, ferveur: 18, prochain: { rang: 100, ecart: 9 } } };
  const etatVirage = ({ surge = false, grande = false } = {}) => {
    const t = Date.now();
    const you = {
      side: 0, neutre: false, ferveurNeutre: 0.5, breath: 25, regen: 0, breathMax: 100, gestes,
      apports, mods, main: mainVirage, mainVisible: 5, cooldowns: { 'a-torche': 7 }, effets: [],
      fanzzy: perso, ecartees: 1, rank: 12, of: 46, ferveur: 412, serie: 2,
      prochain: { rang: 10, ecart: 38 },
    };
    if (grande) { delete you.serie; Object.assign(you, GRANDE.you); }
    return {
      fixture, rope: grande ? GRANDE.rope : -150, goals: [1, 0], realGoals: [2, 1],
      crowd: grande ? GRANDE.crowd : [46, 31],
      surge, surgeUntil: surge ? t + 47_000 : 0, ...(surge ? { surgeMs: 47_000 } : {}),
      seq: 1, fil: FIL, scoreReel: [2, 1], statut: '2H', minute: 66, minuteExtra: null, vuA: t,
      you,
      cards: chants, rang: 0, stade: { ...stade }, actions: ACTIONS_VIRAGE, rally: [],
    };
  };
  const butReel = () => ({ side: 0, teamId: 85, minute: 71, player: 'J. Morand', realGoals: [3, 1],
    scoreReel: [3, 1], surgeUntil: Date.now() + 60_000, surgeMs: 60_000, seq: 2 });
  const tickDouble = () => ({ rope: -230, goals: [1, 0], crowd: [46, 31], surge: true, seq: 3 });
  const resultat = () => ({ quality: 0.93, backfire: false, breath: 3, ferveur: 431, push: 19,
    verdict: 'parfait', serie: 3, rang: 11, sur: 46, prochain: { rang: 10, ecart: 19 } });
  /* Le joueur de l'audit a 400 XP (niveau 4, le 5 à 480) : les 15 du
     Virage et les 35 du duel ne font pas monter, et aucune fête ne vient
     couvrir le bilan qu'on mesure. */
  const bilanVirage = () => ({
    fixtureId: MATCH_ARENE, side: 0, classe: true, neutre: false,
    ferveur: 431, chants: 14, parfaits: 3, serie: 3,
    meilleur: { chant: chants[0].id, verdict: 'parfait' }, rang: 11, sur: 46,
    souvenirs: [{ id: 88, minute: 23, joueur: 'L. Kabashi' }],
    xp: { verse: true, gain: { echarpes: 0, packs: 0, xp: 15, tampons: 0 },
      wallet: { scarves: 500, packs: 6 }, niveau: niveau(400, 15) },
  });
  /* **Le bilan du coup de sifflet, dans la grande tribune, sur un Virage
     qui ne compte pas au classement** (§ 15) : `fini`, `classe: false`
     (« Ce Virage ne compte pas au classement »), l'XP du jour déjà prise
     (`quota` : pas de ligne d'XP, une note à la place), un meilleur geste
     BON (un autre tampon que le PARFAIT de `virage@bilan`, plein sur le
     kraft), un seul PARFAIT, et ni série (sous 2) ni souvenir : leurs
     lignes disparaissent. */
  const bilanFin = () => ({
    fixtureId: MATCH_ARENE, side: 0, fini: true, classe: false, neutre: false,
    ferveur: GRANDE.you.ferveur, chants: 14, parfaits: 1,
    meilleur: { chant: chants[0].id, verdict: 'bon' }, rang: GRANDE.you.rank, sur: GRANDE.you.of,
    xp: { verse: false, raison: 'quota' },
  });
  const live = () => {
    const t = Date.now();
    const ligne = (id, dom, ext, statut, minute, buts, foule, mien, depuisMin) => ({
      id, status_short: statut, elapsed: minute, elapsed_extra: null, luA: t,
      home_goals: buts?.[0] ?? null, away_goals: buts?.[1] ?? null,
      kickoff_at: new Date(t - depuisMin * 60_000).toISOString(),
      home_name: dom, home_logo: BLASON, away_name: ext, away_logo: BLASON, league_name: 'Super League',
      pays: 'Switzerland', drapeau: null, homeColors: [], awayColors: [], crowd: foule, mien,
      fini: false, open: true,
    });
    return { ferveurNeutre: 0.5, matchs: [
      { ...ligne(MATCH_ARENE, CLUBS[0].name, CLUBS[1].name, '2H', 66, [2, 1], [46, 31], true, 70),
        homeColors: COULEURS[0], awayColors: COULEURS[1] },
      ligne(990711, 'Grasshopper Club', 'FC Zurich', 'HT', 45, [1, 1], [12, 9], false, 50),
      ligne(990712, 'FC Lugano', 'Servette FC', '1H', 24, [0, 0], [3, 5], false, 26),
      ligne(990713, 'BSC Young Boys', 'FC Thoune', 'NS', null, null, [0, 0], false, -20),
    ] };
  };

  /* --- le duel de tribunes --- */
  const enEquipe = (id) => {
    const f = fz(id);
    const age = (def, i) => ({ id, nom: def.nom, type: def.type, cri: def.cri, stage: i + 1,
      mods: { id, ...(def.mods ?? {}) }, modsBase: def.mods ?? {} });
    const suite = f.evo ? BY_ID.get(f.evo) : null;
    const ages = [age(f, 0), ...(suite ? [age(suite, 1)] : [])];
    return { ...ages[0], rar: f.rar, stuff: [], stade: 1, ages };
  };
  const equipe = ['RP1', 'RP3', 'RP5'].map(enEquipe);
  const DECK = ['a-fumigene', 'a-torche', 'a-silence', 'a-brouillard', 'a-arbitre',
    'a-craquage', 'a-thermos', 'a-releve', 'a-bache', 'a-vent'];
  const deck = DECK.map(carte);
  /* Le joueur de l'audit en premier dans son camp : une page d'avant le
     lot 6 prenait le premier joueur de son côté pour « toi ». Celle du lot
     lit `moi.userId` et la ligne `moi: true` du bilan (§ 17) : les deux
     sont servis. */
  const JOUEURS = [
    { userId: U, nom: 'Audit', side: 0, fanzzy: ['RP1', 'RP3', 'RP5'] },
    { userId: 'aud-allie', nom: 'Tambour_Nord', side: 0, fanzzy: ['RP2', 'RP4', 'RP6'] },
    { userId: 'bot:1', nom: 'Supporter d’appoint', side: 0, bot: true, fanzzy: ['RP7', 'RP8', 'RP18'] },
    { userId: 'aud-face-1', nom: 'Bâche-Haute', side: 1, fanzzy: ['RP19', 'RP20', 'RP21'] },
    { userId: 'aud-face-2', nom: 'LeGrandDéplacement', side: 1, connecte: false, fanzzy: ['RP22', 'RP23', 'RP24'] },
    { userId: 'aud-face-3', nom: 'Sifflet', side: 1, fanzzy: ['RP25', 'RP26', 'RP27'] },
  ];
  for (const j of JOUEURS) j.fanzzy.forEach(fz);
  /* **Ce qui est en jeu** (contrat § 17, QUESTIONS Q12), par la fonction
     même que la liste des matchs sert (`enJeuDe`) : au réglage par défaut,
     70 et 88 en 2v2 et 4v4 classés chez soi — le serveur arrondit avant de
     doubler, comme au versement. Écrits à la main, ils valaient 69 et 87, un
     chiffre que le serveur ne sert jamais, et la capture le montrait. */
  const enJeu = enJeuDe('classe', true);
  /* **Les deux matchs de la liste**, avec les couleurs de leurs clubs
     (contrat § 17 : `homeColors`, `awayColors`, de zéro à deux couleurs,
     toujours servies). Le classé du jour a les couleurs du Virage ; le
     second, une couleur d'un côté et deux de l'autre (celles de
     `deck-smoke`), pour que l'arène les lise toutes deux. Sans elles, les
     captures ne montraient que le repli de la page (l'or et le bleu). */
  const AUTRES_COULEURS = [['#C8102E', '#FFFFFF'], ['#1D428A']];
  const ENTRAINEMENT = { id: 990714, statut: 'NS', kickoff: iso(26 * 3_600_000),
    clubs: [{ id: 92, name: 'FC Lugano' }, { id: 93, name: 'Servette FC' }], couleurs: AUTRES_COULEURS };
  /* **Et le stade de chacun** (§ 17, décision du 6 octobre 2026) : celui où
     ses duels se jouent, que la préparation pose sur l'affiche du match
     choisi. Le second a celui que le serveur tire pour lui (`lieuServi`) ;
     le classé du jour, celui de la vue du duel, plus bas — le Chaudron,
     fabriqué comme le reste de ce duel : le tirage lui en donnerait un
     autre, et la liste doit dire le lieu du duel qu'on y joue. Un dépôt
     d'avant la décision ne sert pas de stade : la liste n'en porte pas. */
  const lieuEntrainement = typeof lieuServi === 'function' ? lieuServi(ENTRAINEMENT.id) : undefined;
  const matchsDuel = () => ({ matchs: [
    { id: MATCH_ARENE, status_short: '2H', elapsed: 66, kickoff_at: iso(-70 * 60_000), home_goals: 2, away_goals: 1,
      home_name: CLUBS[0].name, home_logo: BLASON, away_name: CLUBS[1].name, away_logo: BLASON,
      league_name: 'Super League', enCours: true, termine: false,
      raison: 'Le match est en cours : ce duel comptera au classement.', aujourdhui: 1,
      mode: 'classe', mien: true, monCamp: 0, enJeu, homeColors: COULEURS[0], awayColors: COULEURS[1],
      ...(lieuEntrainement ? { stade: lieu } : {}) },
    { id: ENTRAINEMENT.id, status_short: ENTRAINEMENT.statut, elapsed: null, kickoff_at: ENTRAINEMENT.kickoff,
      home_goals: null, away_goals: null, home_name: ENTRAINEMENT.clubs[0].name, home_logo: BLASON,
      away_name: ENTRAINEMENT.clubs[1].name, away_logo: BLASON,
      league_name: 'Super League', enCours: false, termine: false,
      raison: 'Match à venir : entraînement, sans effet sur le classement.', aujourdhui: 0,
      mode: 'entrainement', mien: false, monCamp: null, enJeu: enJeuDe('entrainement', false),
      homeColors: AUTRES_COULEURS[0], awayColors: AUTRES_COULEURS[1], stade: lieuEntrainement },
  ] });
  const loadout = () => ({ fanzzy: equipe, actions: deck, mainVisible: 5 });
  const attentes = () => ({ attentes: [{ fixtureId: MATCH_ARENE, format: '1v1', camps: [0, 1], attendus: 1 }] });
  const file = () => {
    const t = Date.now();
    const vu = (j) => ({ userId: j.userId, nom: j.nom, fanzzy: { id: j.fanzzy[0], nom: fz(j.fanzzy[0]).nom },
      depuis: t - 20_000 });
    return { format: '3v3', mode: 'classe', raison: 'Le match est en cours : ce duel comptera au classement.',
      camp: 0, attendus: 3, club: CLUBS[0], enFaceClub: CLUBS[1], presents: 2, enFace: 1,
      manqueEnFace: 2, manqueChezMoi: 1,
      tribunes: { moi: [vu(JOUEURS[0]), vu(JOUEURS[1])], eux: [vu(JOUEURS[3])] },
      botA: t + 75_000, botDansMs: 75_000, neutre: false, renfort: 1, moi: U };
  };
  /* **Le match d'un duel, tel que la vue le sert** (`DuelNvN.fixture`, que
     `matchSupport` fabrique) : les deux clubs, le score au montage du duel
     et leurs couleurs (§ 17). Sans lui, le HUD n'écrivait pas le club de
     chaque tribune et l'arène ne prenait que ses teintes par défaut. */
  const fixtureDuel = ({ id, statut, elapsed, goals, kickoff, clubs, couleurs }) => ({
    id, ...(typeof journeeDuMatch === 'function' ? { jour: journeeDuMatch(kickoff).jour } : {}),
    status: statut, elapsed, goals, kickoffAt: kickoff, league: 'Super League',
    home: { id: clubs[0].id, name: clubs[0].name, logo: BLASON },
    away: { id: clubs[1].id, name: clubs[1].name, logo: BLASON },
    homeColors: couleurs[0], awayColors: couleurs[1] });
  /* **Ce que chacun porte** (contrat § 17), sous la forme du serveur :
     `reste` et `duree` en millisecondes, `null` pour un effet sans échéance
     (la Bâche tient jusqu'à ce qu'elle cède, le changement est une charge).
     Chez soi, la Bâche et le changement possible ; **en face, le Brouillard**
     que l'allié vient de jouer, posé sur chacun des trois (comme le moteur
     le pose sur tous les adverses), avec son chrono : sans un effet chez
     eux, les objets d'en face et leur anneau ne se photographiaient jamais. */
  const EFFETS_MOI = [{ type: 'shield', reste: null, duree: null }, { type: 'peut_changer', reste: null, duree: null }];
  const EFFETS_EUX = [{ type: 'blind', reste: 4200, duree: 6000 }];
  const MOI = { ferveur: 212, breath: 25 };
  /* `entrainement` : le même duel, à l'entraînement, sur le match à venir de
     la liste (Lugano – Servette, demain) — la plaque ENTRAÎNEMENT au lieu de
     CLASSÉ, et pas de ticket terrain avant le coup d'envoi. */
  const vueDuel = ({ entrainement = false } = {}) => ({
    id: 'audit-duel', mode: entrainement ? 'entrainement' : 'classe', seq: 1,
    fixture: entrainement
      ? fixtureDuel({ id: ENTRAINEMENT.id, statut: ENTRAINEMENT.statut, elapsed: null, goals: [0, 0],
        kickoff: ENTRAINEMENT.kickoff, clubs: ENTRAINEMENT.clubs, couleurs: ENTRAINEMENT.couleurs })
      : fixtureDuel({ id: MATCH_ARENE, statut: '2H', elapsed: 66, goals: [2, 1], kickoff: iso(-70 * 60_000),
        clubs: CLUBS, couleurs: COULEURS }),
    chants, stade: lieu, rope: -90, goals: [1, 0],
    ...(entrainement ? { scoreReel: [0, 0], minuteReelle: null, statutReel: ENTRAINEMENT.statut }
      : { scoreReel: [2, 1], minuteReelle: 66, statutReel: '2H' }),
    resteMs: 187_000, termine: false, vainqueur: null,
    equipes: [0, 1].map((side) => JOUEURS.filter((j) => j.side === side).map((j) => ({
      userId: j.userId, nom: j.nom, ferveur: j.userId === U ? MOI.ferveur : 0, connecte: j.connecte ?? true,
      fanzzy: j.fanzzy[0], breath: j.userId === U ? MOI.breath : 50,
      effets: j.userId === U ? EFFETS_MOI : side === 1 ? EFFETS_EUX : [] }))),
    moi: { userId: U, side: 0, breath: MOI.breath, ferveur: MOI.ferveur, main: DECK.slice(0, 5), aveugle: false,
      gestes, sienGeste: 'tempo', fanzzy: equipe.map((f, i) => ({ ...f, actif: i === 0 })),
      cooldowns: { 'a-torche': 5.2 }, effets: EFFETS_MOI, apports, mods },
  });
  /* La corde cède pour sa tribune : le deuxième but de corde, dans
     l'évènement que le moteur émet déjà (`nvn:events`, `t: 'goal'`). */
  const butDuel = () => ({ t: 'goal', side: 0, goals: [2, 0], seq: 2 });
  /* Son chant noté, tel que le serveur le diffuse à la salle (`nvn:events`,
     l'évènement `chant` du moteur que `chanterEtNommer` nomme, § 17) : à
     son identifiant, sur la carte chantée, la note et le mot de l'échelle
     du serveur (`verdictDe`) — la même note que le chant du Virage. */
  const NOTE_DU_CHANT = 0.93;
  const chantDuel = (cardId) => ({ seq: 2, t: 'chant', userId: U, side: 0, geste: 'tempo', cardId,
    quality: NOTE_DU_CHANT, backfire: false, verdict: verdictDe(NOTE_DU_CHANT) });
  const FORME = [{ issue: 'win', pour: 2, contre: 1 }, { issue: 'loss', pour: 0, contre: 1 },
    { issue: 'win', pour: 3, contre: 2 }, { issue: 'draw', pour: 1, contre: 1 }, { issue: 'win', pour: 2, contre: 0 }];
  const affiche = () => ({ id: 'audit-duel', mode: 'classe', stade: lieu,
    joueurs: JOUEURS.map((j, i) => ({ userId: j.userId, nom: j.nom, side: j.side, bot: Boolean(j.bot),
      fanzzy: j.fanzzy.map((id) => {
        const f = fz(id);
        return { id, nom: f.nom, stade: 1, type: f.type, rar: f.rar, cri: f.cri?.label ?? null,
          geste: f.cri?.gest ?? null };
      }),
      forme: j.bot ? [] : FORME.slice(0, 5 - (i % 3)) })) });
  const CHIFFRES = [[612, 18, 6, 1, 1, 5, 3], [488, 15, 4, 0, 0, 3, 2], [301, 11, 3, 0, 0, 0, 0],
    [540, 16, 5, 1, 0, 4, 2], [120, 4, 1, 0, 0, 0, 0], [455, 14, 4, 0, 1, 2, 0]];
  const finDuel = () => ({
    id: 'audit-duel', mode: 'classe', goals: [2, 1], vainqueur: 0, stade: { id: lieu.id, nom: lieu.nom },
    dureeMs: 300_000,
    joueurs: JOUEURS.map((j, i) => {
      const [ferveur, nbChants, cartes, changements, releves, parfaits, serie] = CHIFFRES[i];
      return { userId: j.userId, nom: j.nom, side: j.side, buts: j.side ? 1 : 2, ferveur, chants: nbChants,
        cartes, preferee: cartes ? { id: DECK[i % 3], fois: Math.min(3, cartes) } : null,
        chantPrefere: { id: chants[0].id, nom: chants[0].nom, fois: 5 }, changements, releves,
        fanzzy: j.fanzzy.slice(0, 2).map((id) => ({ id, nom: fz(id).nom, stade: 1 })),
        dernier: j.fanzzy[0], connecte: j.connecte ?? true, bot: Boolean(j.bot),
        /* Sa ligne, marquée dans son envoi (§ 17) : la page n'a plus à la
           chercher parmi les trois de son camp. */
        ...(j.userId === U ? { moi: true } : {}),
        parfaits, ...(serie >= 2 ? { serie } : {}),
        ...(nbChants ? { meilleur: { chant: chants[i % 5].id, verdict: parfaits ? 'parfait' : 'bon' } } : {}) };
    }),
    gains: { echarpes: 60, pourSonClub: true, xp: 35, kop: null, niveau: niveau(400, 35),
      cote: { avant: 1240, apres: 1262, delta: 22 } },
  });

  /* --- le sticker du menu, sur un écran de jeu ---
     Deux supporters attendent un duel (`alerte`, que menu.js lit sur
     `/api/nvn/attentes`) : le menu du Virage porte le « 2 » violet. Le
     duel, lui, ne regarde pas sa propre file : il porte LIVE, le match de
     son club en direct (`/api/virage/live`, le premier match de `live`). */
  const alerteDuel = () => ({ attentes: [{ fixtureId: MATCH_ARENE, format: '1v1', camps: [1, 1], attendus: 1 }],
    alerte: { fixtureId: MATCH_ARENE, format: '1v1', camps: [1, 1] } });

  /* --- la présence (contrat § 18, décision de Gaël sur Q2) ---
     Livrée éteinte, le serveur de l'audit ne la sert pas : la pastille de
     /amis et l'interrupteur du tiroir ne se verraient jamais. Les deux
     lectures sont bouchées à la forme du contrat. Quatre amis : un au
     Virage (le pseudo le plus long, le sticker le plus long), un en duel, un
     en ligne, un sans état ; et un KOP au joueur, pour que chaque ligne porte
     « INVITER AU KOP ». */
  const visage = (id) => {
    const f = fz(id);
    return { fanzzy: id, avatar: { id, age: id, evo: 1, nom: f.nom, skin: 'base', etat: null, rar: f.rar ?? null } };
  };
  const ami = (n, pseudo, id, presence, niv) => ({ id: `aud-ami-${n}`, pseudo, ...visage(id),
    ...(niv ? { niveau: niv } : {}), etat: 'amis', aMoi: false, depuis: iso(-n * 86_400_000),
    ...(presence ? { presence } : {}) });
  const amis = () => ({ amis: [ami(1, 'LeGrandDéplacement', 'RP22', 'virage', 12), ami(2, 'Bâche-Haute', 'RP19', 'duel', 7),
    ami(3, 'Sifflet', 'RP25', 'en_ligne'), ami(4, 'Tambour_Nord', 'RP2', null, 3)],
  recues: [], envoyees: [], invitations: [] });
  const kops = () => ({ kops: [{ id: 1, nom: 'Les Irréductibles', team_id: CLUBS[0].id, team_nom: CLUBS[0].name,
    pot: 120, verse_total: 340, createur: U, verse: 40, depuis: iso(-30 * 86_400_000), membres: 6,
    couleurs: COULEURS[0] }], catalogue: [], dureeVoteMs: 0 });
  const presence = () => ({ actif: true, visible: true });

  /* --- la salle de répétition jugée ---
     La note est bouchée (le serveur noterait les frappes de l'audit, et le
     mot changerait d'un relevé à l'autre) ; le mot vient de l'échelle même
     du serveur (`verdictDe`, Q3) : PARFAIT sur le tempo, BON sur le tri. */
  const noteDe = (note) => ({ note, refuse: null, verdict: verdictDe(note) });

  return {
    etatVirage, butReel, tickDouble, resultat, bilanVirage, bilanFin, live,
    matchsDuel, loadout, attentes, file, vueDuel, butDuel, chantDuel, affiche, finDuel,
    alerteDuel, amis, kops, presence, noteDe,
    /* Ce qui a été fabriqué, dit en clair dans le JSON (`arenesFabriquees`). */
    decrit: {
      match: { id: MATCH_ARENE, rencontre: `${CLUBS[0].name} – ${CLUBS[1].name}`, minute: 66, terrain: [2, 1],
        camp: 0, stade: lieu.id },
      virage: { tribune: [46, 31], rang: 12, sur: 46, prochain: { rang: 10, ecart: 38 }, souffle: 25,
        regain: 0, main: mainVirage, ecartees: 1, recharge: { 'a-torche': 7 }, chants: chants.map((c) => c.id),
        fanzzy: perso.id, minuteDouble: { surgeMs: 47_000 }, but: { minute: 71, buteur: 'J. Morand' },
        bilan: { rang: 11, sur: 46, chants: 14, parfaits: 3, xp: 15 },
        grande: { tribune: GRANDE.crowd, rang: GRANDE.you.rank, sur: GRANDE.you.of, ferveur: GRANDE.you.ferveur,
          prochain: GRANDE.you.prochain, serie: null },
        fin: { statut: 'FT', classe: false, xp: 'quota', meilleur: 'bon', parfaits: 1 },
        verdict: { emis: 'virage:chant', reponse: 'virage:result', note: resultat().quality, verdict: resultat().verdict,
          tenue: TENUE_DU_VERDICT } },
      duel: { format: '3v3', mode: 'classe', equipe: equipe.map((f) => f.id), main: DECK.slice(0, 5),
        effets: EFFETS_MOI.map((e) => e.type), effetsEnFace: EFFETS_EUX, couleurs: COULEURS,
        vainqueur: 'toi', gains: { echarpes: 60, xp: 35, cote: [1240, 1262] },
        enJeu, pave: { chant: chants[0].id, geste: chants[0].gest }, but: butDuel(),
        verdict: { emis: 'nvn:chant', reponse: 'nvn:events', note: NOTE_DU_CHANT, verdict: verdictDe(NOTE_DU_CHANT),
          tenue: TENUE_DU_VERDICT },
        entrainement: { match: ENTRAINEMENT.id, rencontre: ENTRAINEMENT.clubs.map((c) => c.name).join(' – '),
          statut: ENTRAINEMENT.statut, couleurs: ENTRAINEMENT.couleurs } },
      voile: { matchs: 4, miens: 1 },
      menu: { virage: { urgence: 'attend', pastille: 2 }, duel: { urgence: 'direct', pastille: 'LIVE' } },
      amis: amis().amis.map((a) => ({ pseudo: a.pseudo, presence: a.presence ?? null })), kops: 1,
      presence: presence(),
      repetition: { tempo: noteDe(0.93), tri: noteDe(0.82) },
    },
  };
}

/* Les attentes dans la page, bornées. */
const pause = (ms) => new Promise((r) => { setTimeout(r, ms); });
const attendreQue = (page, condition, ms) =>
  page.evaluate(`(async () => (${ATTENDRE})(${condition}, ${ms}))()`).catch(() => false);
/* **Des chiffres qui comptent.** Un bilan qui pose ses lignes l'une après
   l'autre, une foule qui compte de 0 à son effectif (`FX.compter`) : la fin
   d'une transition ne le dit pas, ce sont des textes qui changent. On attend
   que le texte de la zone ne bouge plus pendant `calme` ms, au plus `max`. */
const TEXTE_STABLE = `async (sel, calme, max) => {
  const depart = performance.now();
  let avant = null;
  let depuis = depart;
  while (performance.now() - depart < max) {
    const t = document.querySelector(sel)?.innerText ?? '';
    if (t !== avant) { avant = t; depuis = performance.now(); }
    else if (performance.now() - depuis >= calme) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}`;
const texteStable = (page, sel, calme = 800, max = 6000) =>
  page.evaluate(`(async () => (${TEXTE_STABLE})(${JSON.stringify(sel)}, ${calme}, ${max}))()`).catch(() => false);

/* **Un bilan se pose en étapes, et on l'attend jusqu'à la dernière.** La
   page kraft d'un bilan (le Virage, le duel) pose ses blocs l'un après
   l'autre — `.tbf-glisse`, sept cents millisecondes de `--d` de plus à
   chaque étape (brief du lot 6, § 4 : « les chiffres qui comptent l'un
   après l'autre ») —, fait compter leurs chiffres, et pousse les barres
   miroir TOI/LUI du duel quand leur bloc arrive (`.tbf-vs-l` : `--a` et
   `--b` posés depuis `data-a` et `data-b`). Les deux attentes d'avant n'y
   suffisaient pas : `texteStable` rendait la main dans le premier creux de
   800 ms entre deux chiffres qui comptent, et `finDesMouvements` n'attend
   que ce qui finit sous son plafond. La rangée TOI/LUI du duel, huitième
   étape, à près de cinq secondes, n'était ni photographiée ni mesurée : la
   capture montrait une demi-feuille de kraft vide sous « +35 XP ».

   On attend donc que **chaque étape soit posée** (plus aucune animation à
   venir ou en cours sur elle) et **chaque barre à sa part**, au plus le
   nombre d'étapes fois `PAS_DU_BILAN` plus `MARGE_DU_BILAN` — le rythme
   que le brief écrit, plus le temps de la dernière étape et de ses barres ;
   un bilan qui le dépasse est trop lent, pas seulement long. Rend ce qu'on
   a vu : les étapes et les barres comptées, ce qui restait en route, le
   temps pris et le plafond (`pose` dans le relevé). Une boîte sans étape
   (`.tbf-dial-fond`) est posée tout de suite. */
const PAS_DU_BILAN = 700;
const MARGE_DU_BILAN = 1200;
const BILAN_POSE = async (sel, pas, marge) => {
  const zone = document.querySelector(sel);
  if (!zone) return null;
  const depart = performance.now();
  const etapes = [...zone.querySelectorAll('.tbf-glisse')];
  const barres = [...zone.querySelectorAll('.tbf-vs-l')];
  const plafond = etapes.length * pas + marge;
  /* Une barre est à sa part quand la variable posée vaut celle qu'elle
     porte en donnée ; sans donnée lisible, rien à attendre d'elle. */
  const aSaPart = (l, k) => {
    const voulue = parseFloat(l.dataset[k]);
    if (!Number.isFinite(voulue)) return true;
    return Math.abs((parseFloat(getComputedStyle(l).getPropertyValue(`--${k}`)) || 0) - voulue) < 0.0005;
  };
  const enRoute = () => ({
    etapes: etapes.filter((e) => e.isConnected && e.getAnimations().some((a) => a.playState !== 'finished'
      && a.effect?.getComputedTiming?.().iterations !== Infinity)).length,
    barres: barres.filter((l) => l.isConnected && !(aSaPart(l, 'a') && aSaPart(l, 'b'))).length,
  });
  let reste = enRoute();
  while ((reste.etapes || reste.barres) && performance.now() - depart < plafond) {
    await new Promise((r) => { setTimeout(r, 50); });
    reste = enRoute();
  }
  const entier = !reste.etapes && !reste.barres;
  return { etapes: etapes.length, barres: barres.length, ms: Math.round(performance.now() - depart), plafond,
    entier, ...(entier ? {} : { enRoute: reste }) };
};

/** Attendre qu'un bilan soit posé en entier (voir `BILAN_POSE`), puis ce
    qui bouge encore — les barres et la jauge d'XP lancées par la dernière
    étape — et les chiffres qui finissent de compter. Un bilan qui ne finit
    pas de se poser sous son plafond est relevé (genre « état ») : la capture
    le montrera à moitié, et le relevé ne doit pas se lire comme un bon.
    Rend `pose`, et `autres` : le relevé en plus, à compter sur la ligne. */
async function attendreLeBilan(page, vu, cle, format) {
  const pose = await page.evaluate(BILAN_POSE, vu, PAS_DU_BILAN, MARGE_DU_BILAN).catch(() => null);
  let autres = 0;
  if (pose && !pose.entier) {
    autres = 1;
    note(cle, format.largeur, 'état', `le bilan (${vu}) ne s’est pas posé en ${pose.plafond} ms (${
      pose.etapes} étapes × ${PAS_DU_BILAN} + ${MARGE_DU_BILAN}) : ${pose.enRoute.etapes} étape(s) encore en route, ${
      pose.enRoute.barres} barre(s) TOI/LUI sans leur part — la capture le montre à moitié`);
  }
  await finDesMouvements(page, vu, 2500);
  await texteStable(page, vu, 800, 4000);
  return { pose, autres };
}

/* **La dernière étape d'un bilan, sous le pli.** Aux petits formats, la
   page kraft défile : sa dernière étape (au duel, la rangée TOI/LUI) est
   mesurée avec le reste, mais la capture ne prend que l'écran, et ne la
   montrait pas — à 320 × 568, la feuille s'y arrête à « MEILLEURE SÉRIE ».
   Elle est alors amenée au milieu de l'écran (c'est le bilan qui défile)
   et photographiée à part (`captureFin`), sans mesure. Rien quand elle est
   déjà entière à l'écran : la capture de l'état la montre. Un `apres` d'état
   (voir `ETATS_ARENES`), pour la zone `sel`. */
const derniereEtapeSousLePli = (sel, nom) => async ({ page, format, cle }) => {
  const amenee = await page.evaluate((s) => {
    const zone = document.querySelector(s);
    const e = zone ? [...zone.querySelectorAll('.tbf-glisse')].at(-1) : null;
    if (!e) return null;
    const r = e.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= innerHeight) return false;
    e.scrollIntoView({ block: 'center' });
    return true;
  }, sel).catch(() => null);
  if (!amenee) return {};
  await pause(300);
  return { captureFin: await photographier(page, nom, format, cle) };
};

/* **Frapper le pavé comme un doigt, jusqu'à ce que ça compte.** Depuis le
   lot 6, un geste de rythme suit la grille du serveur : une frappe tombée
   avant l'ouverture de la grille (le premier temps, moins la fenêtre
   d'avance) ne compte pas, ne s'affiche pas et ne fait rien bouger. L'audit
   frappait dès le pavé posé : ses deux frappes tombaient avant, et l'état
   photographiait un pavé à 0. On frappe donc jusqu'à ce que le compteur du
   pavé (`#n`) bouge, `combien` fois, au plus pendant `max` ms, et l'on rend
   le nombre de frappes comptées. Un pavé sans compteur : les frappes
   partent sans être vérifiées. */
const FRAPPER = `async (combien, max) => {
  const frapper = () => {
    const p = document.getElementById('pad');
    for (const type of ['pointerdown', 'pointerup']) {
      p?.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'touch' }));
    }
  };
  const compte = () => document.getElementById('n')?.textContent ?? null;
  const depart = performance.now();
  let comptees = 0;
  while (comptees < combien && performance.now() - depart < max) {
    const avant = compte();
    frapper();
    if (avant === null || compte() !== avant) {
      comptees += 1;
      if (comptees < combien) await new Promise((r) => setTimeout(r, 300));
    } else await new Promise((r) => setTimeout(r, 90));
  }
  return comptees;
}`;

/* Le premier de ces sélecteurs qui est à l'écran, ou null. */
const PREMIER_VISIBLE = (liste) => liste.find((sel) => {
  const e = document.querySelector(sel);
  if (!e || e.hidden) return false;
  const s = getComputedStyle(e);
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden';
}) ?? null;

/* Le calque fixé qui porte un élément, nommé comme un sélecteur : c'est la
   portée d'un état posé par-dessus la page (voir « Les états »). Null s'il
   n'est sur aucun calque fixé. */
const CALQUE_DE = (sel) => {
  const el = document.querySelector(sel);
  let n = el;
  while (n && n !== document.body && getComputedStyle(n).position !== 'fixed') n = n.parentElement;
  if (!n || n === document.body) return null;
  const chemin = [];
  for (let x = n; x && x !== document.body; x = x.parentElement) {
    if (x.id) { chemin.unshift(`#${CSS.escape(x.id)}`); return chemin.join(' > '); }
    const memes = [...x.parentElement.children].filter((y) => y.tagName === x.tagName);
    chemin.unshift(`${x.tagName.toLowerCase()}:nth-of-type(${memes.indexOf(x) + 1})`);
  }
  return ['body', ...chemin].join(' > ');
};

/* **Les deux boutons de la barre, sur un écran de jeu** : leur boîte
   (gauche, haut, largeur, hauteur), et si la barre est celle du jeu. Le lot
   6 les fait entrer dans les deux cases de 44 du HUD de match ; la
   comparaison de « La barre » ne les regarde pas (`.tbf-haut-jeu` en est
   exclue), celle-ci les nomme. Sur les deux écrans de jeu, ui.css la pose à
   [14, 14], HUD affiché ou non — l'air du sticker ; avant le lot 6, elle
   flottait à [10, 8]. Aucun seuil sur la place : elle bouge à chaque
   retouche de la feuille, et c'est l'air qui compte (« sticker rogné »).

   **Et le sticker d'urgence du menu** (brief du lot 6, § 7) : l'état qu'il
   porte (`data-urgence`, `data-pastille`), l'air que l'écran laisse au
   bouton au-dessus et à droite (`air`), et ce que le sticker en demande
   (`demande`), en pixels. C'est un pseudo-élément : aucune boîte à lire, et
   le relevé « hors écran » ne le voit pas. Sa demande se calcule donc sur
   son style calculé — sa place (`top`, `right`), sa taille (LIVE est plus
   large qu'un chiffre), ses coins arrondis, sa rotation —, plus ce qui
   l'entoure (`SEUILS.bordSticker`). Neuf et huit pixels, treize avec le
   bord : le brief le chiffre pour un chiffre ; tourné de six degrés, LIVE
   en demande 13,7 au-dessus, ce que ui.css a mesuré de son côté. Un air
   plus court que la demande rogne le sticker (« sticker rogné »). */
const BARRE_JEU = (bord = [0, 0]) => {
  const boite = (sel) => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0
      ? [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] : null;
  };
  const menu = document.querySelector('.tbf-burger');
  const sticker = () => {
    const r = menu.getBoundingClientRect();
    const s = getComputedStyle(menu, '::after');
    const w = parseFloat(s.width);
    const h = parseFloat(s.height);
    if (s.position !== 'absolute' || !(w > 0 && h > 0)) return {};
    const a = ((parseFloat(s.rotate) || 0) * Math.PI) / 180;
    /* La face tournée autour de son centre : sa demi-largeur et sa
       demi-hauteur à l'écran. Ses coins sont arrondis (un rond pour le
       direct sans mot) : c'est l'arrondi qui touche le bord, pas l'angle. */
    const rr = Math.min(parseFloat(s.borderTopLeftRadius) || 0, w / 2, h / 2);
    const c = Math.abs(Math.cos(a));
    const si = Math.abs(Math.sin(a));
    const dx = (w / 2 - rr) * c + (h / 2 - rr) * si + rr;
    const dy = (w / 2 - rr) * si + (h / 2 - rr) * c + rr;
    const au = (x) => Math.round(x * 10) / 10;
    return { air: [au(r.top), au(document.documentElement.clientWidth - r.right)],
      demande: [au(-parseFloat(s.top) - h / 2 + dy + bord[0]), au(-parseFloat(s.right) - w / 2 + dx + bord[1])] };
  };
  return { jeu: Boolean(document.querySelector('.tbf-haut-jeu')), retour: boite('.tbf-retour'),
    burger: boite('.tbf-burger'),
    ...(menu?.dataset.urgence ? { urgence: menu.dataset.urgence, pastille: menu.dataset.pastille ?? null,
      ...sticker() } : {}) };
};
/* **Ce qui bouge sans fin à l'écran**, compté par fx.js même (`FX.sansFin`,
   la règle de compte écrite une fois : un objet par élément ou
   pseudo-élément, seulement celles qui tournent). Null sur une page sans
   fx.js, ou d'avant le lot 6. Chaque entrée nommée en clair, pour savoir
   quoi figer. */
const SANS_FIN = () => {
  const liste = window.FX?.sansFin?.();
  if (!Array.isArray(liste)) return null;
  return { n: liste.length, liste: liste.map(({ el, pseudo, noms }) => {
    const id = el.id ? `#${el.id}` : '';
    const classes = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
    return `${el.tagName.toLowerCase()}${id}${classes}${pseudo ?? ''} (${noms.join(', ')})`;
  }) };
};
/* **Le budget d'un écran de jeu.** Le brief du lot 6 l'écrit pour 360 × 640
   — HUD 44, ticket 24, arène 256, souffle et ferveur 52, actions 56, main
   110, marges 24 : 566 —, et pose la règle « l'arène cède avant la main et
   les chants, jamais l'inverse ». Une règle de hauteur ne se lit pas dans un
   compte de défauts : chaque rangée est donc relevée, dans l'ordre de
   l'écran — haut dans la page, hauteur, entière à l'écran ou non, et ce
   qu'on en voit (en pixels, dans la fenêtre) —, avec la hauteur de la
   fenêtre et celle qu'on fait défiler. Une rangée absente vaut null (le lot
   peut en renommer une : le relevé le dira). La règle elle-même est relevée
   sur la main et les chants (« main coupée », voir `MAINS`). */
const BUDGET = (rangees) => {
  const out = { fenetre: innerHeight, defile: document.scrollingElement.scrollHeight, rangees: {} };
  for (const sel of rangees) {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    out.rangees[sel] = r && r.height > 0
      ? [Math.round(r.top + scrollY), Math.round(r.height), r.top >= -1 && r.bottom <= innerHeight + 1,
        Math.max(0, Math.round(Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)))] : null;
  }
  return out;
};
/* **Ce qu'on joue reste à l'écran** : la règle du budget (« l'arène cède
   avant la main et les chants, jamais l'inverse »), sur les rangées que le
   joueur touche. Au duel, la main et les chants entiers (`null`) ; au
   Virage, au moins 110 px de la main — le brief la compte « 110 visibles »
   et la laisse dépasser du bord, comme la maquette. Relevé au départ : à
   320 × 568, la rangée des chants du duel sortait de l'écran (111 px) pendant
   que l'arène en gardait 132, et seul le tableau du budget le disait. */
const MAINS = { '#hand': 110, '#mainCartes': null, '#chants': null };
/* Les rangées, dans l'ordre de l'écran, telles que le lot 6 les pose. Au
   Virage : le HUD (`.hud`, que la brique garde), la seconde rangée du ticket
   terrain et de la phase (`.tbf-hudm-ligne`), l'arène, le tableau du souffle
   et de la ferveur avec le « i » de ce qu'on porte (`.tableau`, le « i »
   dans `.tbf-tableau-droite`), la rangée des cartes d'action
   (`#rangeeActes`), la main. `#ecartees` n'existe plus (un sticker DUEL
   SEULEMENT sur les cases vides) et `.me-bar` n'est plus qu'une ligne du
   tableau : le relevé de départ les nommait (MESURE.md, § 5.3), celui-ci
   nomme les rangées qui les contiennent. Au duel : le HUD (`#jeu > .score`,
   gardé), la rangée du ticket terrain (`#filLigne`, cachée avant le coup
   d'envoi), l'arène, la rangée des effets (`#effets`, absente sans effet),
   la rangée de l'équipe, du souffle et du « i » (`.rang-equipe` : le
   souffle y est entré, à côté de l'équipe, et n'est plus une rangée), la
   main, les chants. Une rangée par hauteur d'écran : une rangée imbriquée
   dans une autre se compterait deux fois. */
const RANGEES_VIRAGE = ['.hud', '.tbf-hudm-ligne', '#rope', '.tableau', '#rangeeActes', '#hand'];
const RANGEES_DUEL = ['#jeu > .score', '#filLigne', '#arene', '#effets', '#jeu .rang-equipe', '#mainCartes', '#chants'];
/* Le voile du mur (H6) : `.dense` est le voile des pages de contenu (75 %),
   sans lui celui du hub (60 %). */
const VOILE_DU_MUR = () => {
  const v = document.querySelector('.tbf-grad');
  return v ? { dense: v.classList.contains('dense') } : null;
};

/* **L'encre rognée par un cadre** (« encre rognée » ; la mesure du banc des
   briques, partie B du lot 6, qui ne connaissait pas de page qui défile).
   « coupé » ne lit qu'une coupe en largeur — un nom en points de
   suspension : l'accent d'une capitale (« FC BÂLE »), une cédille
   (« GONÇALVES ») ou un émoji qu'un
   cadre en `overflow: hidden` entame en haut ou en bas, sous un interligne
   serré, passait l'audit sans un relevé. Pour chaque texte de la portée,
   la boîte de son encre se tire de la boîte de sa police (la plage,
   `Range`, qui suit l'ascendant et le descendant de la police et non
   l'interligne ; le navigateur arrondit l'ascendant au pixel et pose la
   ligne dessus) et des mesures d'encre du canevas, prises à cent fois la
   taille pour ne pas être arrondies au pixel ; puis on la compare au
   rembourrage de chaque ancêtre qui coupe en hauteur, jusqu'à la portée.

   Ne comptent pas : une ligne entière hors du cadre (une ligne de trop,
   pas un accent rogné) ; **ce qui défile** — un conteneur qui défile
   vraiment en hauteur ne coupe rien (on y fait venir le texte au doigt,
   comme partout dans cet audit), et une ligne qui n'est pas entière dans
   sa fenêtre est plus loin dans le défilement : ni lui ni un cadre plus
   haut ne la rognent (au banc, la préparation du duel défile dans
   `#prepa`, sous `#app` qui coupe au même bord — la ligne du bas de
   l'écran y était relevée) ; un mot retiré de l'écran exprès (une boîte
   d'un pixel, `.tbf-vh`, `clip-path: inset(50%)`) ou éteint (opacité
   nulle). Une rangée qui ne défile qu'en largeur coupe en hauteur, et
   compte. La portée nulle est la colonne (`#app`). Rend les textes rognés
   de plus de `seuil` px, le pire d'abord. */
const ENCRE_ROGNEE = (portee, seuil) => {
  const zone = (portee && document.querySelector(portee)) || document.getElementById('app') || document.body;
  const nom = (el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${
    typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`;
  const cv = document.createElement('canvas').getContext('2d');
  const K = 100;
  /* Chaque ancêtre une fois : masque-t-il ce qu'il porte ; défile-t-il
     vraiment en hauteur (sa fenêtre) ; sinon, coupe-t-il en hauteur ce qui
     le dépasse ? Fenêtre et cadre, le rembourrage de la boîte. */
  const vus = new Map();
  const lire = (a) => {
    if (vus.has(a)) return vus.get(a);
    const s = getComputedStyle(a);
    const r = a.getBoundingClientRect();
    const boite = s.display !== 'contents';
    /* La boîte d'un pixel du motif, tournée avec la pièce qui la porte,
       en mesure un et cinq centièmes : deux pixels de marge. */
    const masque = s.opacity === '0' || a.classList.contains('tbf-vh') || s.clipPath.includes('inset(50%)')
      || (boite && r.width <= 2 && r.height <= 2);
    const bord = { haut: r.top + parseFloat(s.borderTopWidth), bas: r.bottom - parseFloat(s.borderBottomWidth),
      qui: nom(a) };
    const defile = boite && /auto|scroll/.test(s.overflowY) && a.scrollHeight > a.clientHeight + 1;
    const x = { masque, fenetre: defile ? bord : null,
      coupe: boite && !defile && s.overflowY !== 'visible' ? bord : null };
    vus.set(a, x);
    return x;
  };
  const out = [];
  const marcheur = document.createTreeWalker(zone, NodeFilter.SHOW_TEXT);
  for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
    const txt = n.textContent;
    if (!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(txt)) continue;
    const el = n.parentElement;
    const s = getComputedStyle(el);
    if (s.visibility !== 'visible' || s.display === 'none') continue;
    const coupes = [];
    const fenetres = [];
    let masque = false;
    for (let a = el; a && a !== zone.parentElement; a = a.parentElement) {
      const x = lire(a);
      if (x.masque) { masque = true; break; }
      if (x.coupe) coupes.push(x.coupe);
      if (x.fenetre) fenetres.push(x.fenetre);
    }
    if (masque || !coupes.length) continue;
    const g = document.createRange();
    g.selectNodeContents(n);
    /* Une ligne qui n'est pas entière dans la fenêtre d'un conteneur qui
       défile est plus loin dans le défilement, pas rognée. */
    const lignes = [...g.getClientRects()].filter((r) => r.width > 0 && r.height > 0
      && fenetres.every((f) => r.top >= f.haut - 1 && r.bottom <= f.bas + 1));
    if (!lignes.length) continue;
    const px = parseFloat(s.fontSize);
    cv.font = `${s.fontStyle} ${s.fontWeight} ${px * K}px ${s.fontFamily}`;
    const t = s.textTransform === 'uppercase' ? txt.toUpperCase()
      : s.textTransform === 'lowercase' ? txt.toLowerCase() : txt;
    const m = cv.measureText(t.trim() || t);
    const asc = Math.round(m.fontBoundingBoxAscent / K);
    const dessus = m.actualBoundingBoxAscent / K;
    const dessous = m.actualBoundingBoxDescent / K;
    let pire = 0;
    let ou = '';
    let qui = '';
    for (const r of lignes) {
      const base = r.top + asc;
      for (const c of coupes) {
        if (r.bottom <= c.haut || r.top >= c.bas) continue;
        const h = c.haut - (base - dessus);
        const b = base + dessous - c.bas;
        if (h > pire) { pire = h; ou = 'haut'; qui = c.qui; }
        if (b > pire) { pire = b; ou = 'bas'; qui = c.qui; }
      }
    }
    if (pire > seuil) {
      out.push({ q: nom(el), texte: txt.replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim().slice(0, 30), px,
        de: Math.round(pire * 10) / 10, ou, coupe: qui });
    }
  }
  return out.sort((a, b) => b.de - a.de);
};

/* **Les libellés de carte couverts** (« libellé couvert » ; la sonde du
   banc des briques, partie B du lot 6). Une carte porte son nom, son
   geste, sa poussée et son coût ; ce qui lui manque de souffle (le sticker
   « −8 »), sa recharge (le scotch et son chiffre) et sa voisine de
   l'éventail se posent sur elle — **jamais sur le libellé** (brief du lot
   6). Aucune mesure de texte ne voit un texte couvert par un autre
   élément. Celle-ci sonde, au point près, la bande du milieu de chaque
   ligne de chaque libellé, et compte la part des points où quelque chose
   est posé dessus : la pile des éléments sous le point
   (`elementsFromPoint`, qui suit les rotations de l'éventail), lue du
   dessus jusqu'au libellé ou à ce qui le porte. Ne couvrent pas : un
   libellé voisin de la même carte (la boîte d'une police est plus haute
   que ses lettres), un élément éteint (opacité nulle). La recharge ne
   prend pas le doigt (`pointer-events: none`), et serait passée sous la
   sonde sans être vue : on le lui rend le temps de la sonder. Toutes les
   cartes de la colonne (`#app .tbf-carte`) ; rend chaque libellé couvert à
   plus de `seuil` %. */
const LIBELLES_COUVERTS = (seuil) => {
  const doigt = document.createElement('style');
  doigt.textContent = '.tbf-carte-recharge,.tbf-carte-recharge *{pointer-events:auto !important}';
  document.head.appendChild(doigt);
  const VOISINS = '.tbf-carte-geste, .tbf-carte-pousse, .tbf-carte-nom';
  const SORTES = [['.tbf-carte-manque', 'manque'], ['.tbf-carte-recharge > b', 'recharge'],
    ['.tbf-carte-cout', 'coût'], ['.tbf-carte-nom', 'nom'], ['.tbf-carte-geste', 'geste'],
    ['.tbf-carte-pousse', 'poussée']];
  const eteints = new Map();
  const eteint = (e) => {
    if (!e || e === document.documentElement) return false;
    if (!eteints.has(e)) eteints.set(e, getComputedStyle(e).opacity === '0' || eteint(e.parentElement));
    return eteints.get(e);
  };
  const couvert = (el) => {
    if (!el.textContent.trim() || getComputedStyle(el).display === 'none') return null;
    const carte = el.closest('.tbf-carte');
    const dessus = (x, y) => {
      for (const e of document.elementsFromPoint(x, y)) {
        if (el.contains(e) || e.contains(el)) return false;
        if (e.closest('.tbf-carte') === carte && e.matches(VOISINS)) return false;
        if (!eteint(e)) return true;
      }
      return false;
    };
    const g = document.createRange();
    g.selectNodeContents(el);
    let pris = 0;
    let tous = 0;
    for (const t of g.getClientRects()) {
      if (!t.width || !t.height) continue;
      for (let x = t.left + 0.5; x < t.right; x += 1) {
        for (let y = t.top + t.height * 0.27; y <= t.top + t.height * 0.78; y += 1) {
          if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) continue;
          tous += 1;
          if (dessus(x, y)) pris += 1;
        }
      }
    }
    return tous ? Math.round((pris / tous) * 100) : null;
  };
  const out = [];
  try {
    for (const c of document.querySelectorAll('#app .tbf-carte')) {
      /* Son nom dans la page ; une carte de la main du duel n'en porte
         que jouable (`data-jouer`) : son nom écrit, sinon. */
      const carte = c.dataset.acte || c.dataset.card || c.dataset.chant || c.dataset.jouer || c.id
        || (c.querySelector('.tbf-carte-nom')?.textContent ?? '').replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim();
      for (const [sel, sorte] of SORTES) {
        for (const el of c.querySelectorAll(sel)) {
          const part = couvert(el);
          if (part !== null && part > seuil) {
            /* Sans ses coupures conditionnelles (celle, invisible, de
               « MARTE-LAGE ») : le mot, tel qu'on le cherche. */
            out.push({ carte, libelle: sorte,
              texte: el.textContent.replace(/\u00AD/g, '').replace(/\s+/g, ' ').trim().slice(0, 24), part });
          }
        }
      }
    }
  } finally {
    doigt.remove();
  }
  return out.sort((a, b) => b.part - a.part);
};

/** Entrer dans la tribune, et laisser l'entrée se jouer. Rend la panne, ou
    null : **une tribune qui ne se pose pas ne se mesure pas.** Sans ce
    contrôle, un évènement renommé ou une page qui lève à l'entrée laissait
    le voile à l'écran, et l'état le mesurait sous le nom de la tribune — un
    relevé faux qui se lit comme un bon. On lit ce que les suites lisent : le
    voile (`#veil`) parti, la corde (`#rope`) à l'écran. */
async function entrerAuVirage({ page, tirer }, etat) {
  await tirer('virage:state', etat);
  const posee = await attendreQue(page, '() => !document.querySelector(\'#veil.on\')'
    + ' && (document.getElementById(\'rope\')?.getBoundingClientRect().height ?? 0) > 0', 2000);
  if (!posee) return 'la tribune ne s’est pas posée après virage:state (#veil encore là, ou #rope invisible)';
  await pause(ENTREE_MS);
  await finDesMouvements(page, 'body', 2500);
  await texteStable(page, '#app');
  return null;
}

/** Entrer en partie au duel, et la laisser se poser. Rend la panne, ou
    null. Même garde que la tribune : la préparation partie, l'arène
    (`#arene`, que lisent les suites) à l'écran. */
async function entrerEnPartie({ page, tirer }, vue) {
  await tirer('nvn:start', vue);
  const pose = await attendreQue(page, '() => (document.getElementById(\'arene\')'
    + '?.getBoundingClientRect().height ?? 0) > 0', 2000);
  if (!pose) return 'la partie ne s’est pas posée après nvn:start (#arene invisible)';
  await pause(1500);
  await finDesMouvements(page, 'body', 2500);
  await texteStable(page, '#app');
  return null;
}

/** **Le pavé frappé deux fois, et la photo juste après la seconde**, dans
    les deux arènes (le pavé est la même brique, `geste.js`) : le pavé d'un
    geste de frappe s'enfonce et pose sa bouffée (`.tbf-bouffee`, 500 ms) à
    chaque frappe — c'est l'écran qu'on voit en jouant. La bouffée est le
    premier enfant du pavé, `aria-hidden` et sans texte : elle ne compte
    dans aucun relevé de texte, et l'état dit si elle y était (`bouffee`).
    Voir `FRAPPER` pour les frappes du décompte, que le pavé ne prend plus.
    Rend les frappes comptées, la bouffée, et la portée : la fenêtre du
    geste (`#mini`) si elle est ouverte, le pavé sinon. */
async function frapperLePave(page) {
  const frappes = await page.evaluate(`(${FRAPPER})(2, 4000)`).catch(() => 0);
  await pause(120);
  const lu = await page.evaluate(() => {
    const b = document.querySelector('#pad > .tbf-bouffee');
    return { portee: document.querySelector('#mini.on') ? '#mini' : '#pad',
      bouffee: b ? { premiere: b === document.getElementById('pad').firstElementChild,
        cachee: b.getAttribute('aria-hidden') === 'true', texte: b.textContent.trim().length > 0 } : null };
  });
  return { frappes, ...lu };
}

/* **Toucher un chant**, dans chaque arène comme elle l'écoute. Rend
   l'identifiant du chant touché, ou null s'il n'y en a aucun.

   Au Virage, le doigt pose (`pointerdown`, ce que la page écoute) ; si la
   fenêtre du geste ne s'ouvre pas, un `click` — l'autre façon d'écouter
   une carte, celle du duel. Jamais les deux à coup sûr : un écran qui
   écouterait les deux ouvrirait deux gestes. Au duel, le `click` sur la
   rangée des chants. */
const TOUCHER_AU_VIRAGE = async (id) => {
  const c = document.querySelector(`#hand [data-card="${id}"]`)
    ?? document.querySelector('#hand [data-card], #hand .card');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1,
    isPrimary: true, pointerType: 'touch', clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  const ouverte = () => document.querySelector('#mini.on, #pad');
  const depart = performance.now();
  while (!ouverte() && performance.now() - depart < 400) await new Promise((x) => { setTimeout(x, 30); });
  if (!ouverte()) c.click();
  return c.dataset.card ?? id;
};
const TOUCHER_AU_DUEL = (id) => {
  const c = document.querySelector(`#chants [data-chant="${CSS.escape(id)}"]`)
    ?? document.querySelector('#chants [data-chant]');
  if (!c) return null;
  c.click();
  return c.dataset.chant ?? id;
};

/* **Le tampon du verdict sur le pavé** (brief du lot 6, § 5 : le cœur du
   retour du geste). Le geste fini, la page envoie ses frappes, le serveur
   répond par le mot, et la fenêtre l'attend — au plus six cents
   millisecondes après la dernière frappe — pour le claquer au centre du
   pavé ; elle se ferme six cents millisecondes plus tard
   (`LECTURE_VERDICT` de geste.js, le temps de le lire). Trop tard, le
   tampon claque sur la carte jouée, la fenêtre déjà fermée.

   **Six cents millisecondes, c'est le temps d'une photo, pas d'une
   mesure.** L'audit demande donc à la brique elle-même de tenir le tampon
   plus longtemps : l'option `lecture` de `TBF_GESTE.attendre`, que les deux
   arènes appellent sans elle (`TENIR_LE_VERDICT`). Rien d'autre ne change :
   le pavé mesuré est celui des six cents millisecondes de lecture, son
   tampon posé. Les appels sont comptés (`window.__attentesDuVerdict`) :
   une page qui n'attendrait plus son verdict ne tiendrait aucun tampon, et
   l'état le dirait. Et chaque tampon posé est noté là où il claque
   (`window.__tamponsDuVerdict` : « pavé », « carte » ou « ailleurs ») :
   celui d'une carte jouée ne vit qu'une seconde et demie, et serait parti
   quand l'état cherche pourquoi le pavé n'en a pas. */
const TENUE_DU_VERDICT = 30_000;
const TENIR_LE_VERDICT = (ms) => {
  const g = window.TBF_GESTE;
  if (typeof g?.attendre !== 'function') return false;
  const attendre = g.attendre;
  window.__attentesDuVerdict = 0;
  g.attendre = (reponse, o = {}) => {
    window.__attentesDuVerdict += 1;
    return attendre.call(g, reponse, { ...o, lecture: ms });
  };
  const vus = [];
  window.__tamponsDuVerdict = vus;
  new MutationObserver((liste) => {
    for (const m of liste) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || !n.classList.contains('tbf-verdict')) continue;
        const hote = n.parentElement;
        vus.push(hote?.id === 'pad' ? 'pavé' : hote?.closest('.tbf-carte, [data-card], [data-chant]') ? 'carte' : 'ailleurs');
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  return true;
};
/* Le tampon tenu sur le pavé de la fenêtre ouverte : seul celui-là est le
   verdict « à temps ». */
const TAMPON_DU_PAVE = '#mini.on #pad > .tbf-verdict';

/** **Un geste joué jusqu'au bout, et son verdict sur le pavé**, dans l'une
    ou l'autre arène (`toucher`, l'émission du chant, sa réponse) : le
    chant touché, toutes les frappes de sa grille comptées — un geste de
    rythme finit sur sa dernière frappe attendue, et l'attente du verdict
    se compte depuis elle : avec deux frappes seulement, la fenêtre
    attendait la fin du geste et le tampon partait sur la carte —, la
    réponse servie par la fausse socket (soixante millisecondes, à temps),
    le tampon claqué. Photographié puis mesuré sous la fenêtre (`#mini`) ;
    l'état vérifie qu'il y était encore. Le mot du tampon doit être le code
    servi (`data-verdict`) : un autre est relevé (genre « état »). */
async function verdictSurLePave({ page, cle, format }, { toucher, chant, gestes, emission, servi }) {
  const grille = gestes?.[chant.gest];
  const frappes = Number(grille?.beats);
  if (chant.gest !== 'tempo' || !Number.isInteger(frappes) || frappes < 1) {
    return { faute: `le chant ${chant.id} n’est pas un tempo à temps servis (beats) : rien à frapper jusqu’au bout` };
  }
  if (!await page.evaluate(TENIR_LE_VERDICT, TENUE_DU_VERDICT).catch(() => false)) {
    return { faute: 'la brique du geste ne sert plus TBF_GESTE.attendre : la fenêtre n’attend plus son verdict' };
  }
  const touche = await page.evaluate(toucher, chant.id).catch(() => null);
  if (!touche) return { faute: `aucun chant à toucher (${chant.id})` };
  const pave = await attendreQue(page, '() => document.getElementById(\'pad\')', 4000);
  if (!pave) return { faute: `le chant ${touche} touché, aucun pavé (#pad) en 4 s`, donnees: { chant: touche } };
  const comptees = await page.evaluate(`(${FRAPPER})(${frappes}, 8000)`).catch(() => 0);
  const tamponne = await attendreQue(page, `() => document.querySelector(${JSON.stringify(TAMPON_DU_PAVE)})`, 3000);
  const donnees = { chant: touche, geste: chant.gest, frappes: comptees, sur: frappes, servi };
  if (!tamponne) {
    const vu = await page.evaluate((evt) => ({
      tampons: [...(window.__tamponsDuVerdict ?? [])],
      emis: (window.__emis ?? []).some(([e]) => e === evt),
      attentes: window.__attentesDuVerdict ?? 0,
    }), emission).catch(() => ({}));
    vu.carte = (vu.tampons ?? []).includes('carte');
    const pourquoi = vu.carte
      ? `le verdict servi à temps (60 ms après ${emission}) a claqué sur la carte jouée, pas sur le pavé : la fenêtre ne l’a pas attendu`
      : !vu.emis ? `${comptees} frappe(s) comptée(s) sur ${frappes}, le geste n’a pas envoyé ${emission}`
        : !vu.attentes ? `${emission} émis, la page n’attend pas son verdict (TBF_GESTE.attendre jamais appelé)`
          : `${emission} émis, le verdict « ${servi} » servi, aucun tampon sur le pavé (${TAMPON_DU_PAVE}) en 3 s`;
    return { faute: pourquoi, donnees: { ...donnees, ...vu } };
  }
  // Le tampon claque en 260 ms (`.tbf-clac`) : on le photographie posé.
  await finDesMouvements(page, '#pad', 800);
  const tampon = await page.evaluate((sel) => {
    const t = document.querySelector(sel);
    if (!t) return null;
    return { verdict: t.dataset.verdict ?? null, mot: t.textContent.trim(), plein: t.classList.contains('tbf-tampon--plein'),
      px: parseFloat(getComputedStyle(t).fontSize) };
  }, TAMPON_DU_PAVE).catch(() => null);
  let autres = 0;
  if (tampon && tampon.verdict !== servi) {
    autres = 1;
    note(cle, format.largeur, 'état', `le tampon du pavé porte « ${tampon.verdict ?? 'rien'} » (${
      tampon.mot || 'sans mot'}), le serveur a servi « ${servi} » : la page ne nomme le verdict qu’avec le code servi`);
  }
  return { portee: '#mini', photoDAbord: true, autres,
    encore: () => Boolean(document.querySelector('#mini.on #pad > .tbf-verdict')),
    donnees: { ...donnees, tampon, ...await page.evaluate(() => ({ attentes: window.__attentesDuVerdict ?? 0,
      tampons: [...(window.__tamponsDuVerdict ?? [])] })).catch(() => ({})) } };
}

/* Les états du lot 6 : les dix-huit des arènes, puis les quatre des autres
   écrans. `jouer` amène l'écran et rend la portée de la mesure (null : la
   page entière), ou une faute, et `autres`, ce qu'il a relevé hors de la
   mesure ; `photoDAbord` pour un écran qui passe (le geste, l'affiche), avec
   `encore` qui dit s'il était toujours là après la mesure ; `apres` pour une
   capture de plus, sans mesure ; `socket: false` pour un écran sans la
   fausse socket, et `formats` pour un état qui ne se regarde qu'à ceux-là. */
const BILANS_VIRAGE = ['#bilan', '[data-bilan]', '.tbf-bilan', '.tbf-dial-fond.on'];
const ETATS_ARENES = [
  {
    cle: 'virage@voile', chemin: '/virage', capture: 'virage-voile',
    bouchons: (d) => ({ '/api/virage/live': d.live() }),
    async jouer({ page }) {
      const peint = await attendreQue(page,
        '() => document.querySelectorAll(\'#matchs .match, #matchs [data-id]\').length >= 4', 5000);
      if (!peint) return { faute: 'le voile n’a pas peint les quatre matchs servis (#matchs .match) en 5 s' };
      await finDesMouvements(page, 'body', 2500);
      return { portee: null };
    },
    /* Le choix du camp, sur le premier match d'ailleurs : photographié, pas
       mesuré — c'est la liste, avec deux boutons de plus. */
    async apres({ page, format, cle }) {
      const ouvert = await page.evaluate(() => {
        const m = document.querySelector('#matchs [data-id][data-mien="0"]:not(.off), #matchs .match.ailleurs:not(.off)');
        if (!m) return false;
        m.click();
        return true;
      }).catch(() => false);
      if (!ouvert) return {};
      const camps = await attendreQue(page, '() => document.querySelector(\'#matchs [data-camp]\')', 2000);
      if (!camps) return { camp: 'pas de [data-camp] après le toucher' };
      await finDesMouvements(page, 'body', 1500);
      await page.evaluate(() => document.querySelector('#matchs [data-camp]')
        ?.scrollIntoView({ block: 'center' })).catch(() => {});
      await pause(300);
      return { camp: 'ouvert', captureCamp: await photographier(page, 'virage-voile-camp', format, cle) };
    },
  },
  {
    /* Deux supporters attendent un duel : le menu porte le « 2 » violet dans
       sa case du HUD (le sticker d'un écran de jeu, brief du lot 6, § 7). */
    cle: 'virage@tribune', chemin: '/virage', capture: 'virage-tribune', mur: true, budget: RANGEES_VIRAGE,
    bouchons: (d) => ({ '/api/nvn/attentes': d.alerteDuel() }),
    async jouer(ctx) {
      const faute = await entrerAuVirage(ctx, ctx.d.etatVirage());
      return faute ? { faute } : { portee: null };
    },
  },
  {
    cle: 'virage@double', chemin: '/virage', capture: 'virage-double', budget: RANGEES_VIRAGE,
    async jouer(ctx) {
      const faute = await entrerAuVirage(ctx, ctx.d.etatVirage({ surge: true }));
      return faute ? { faute } : { portee: null };
    },
  },
  {
    cle: 'virage@but', chemin: '/virage', capture: 'virage-but',
    async jouer(ctx) {
      const { page, tirer, d } = ctx;
      const faute = await entrerAuVirage(ctx, d.etatVirage());
      if (faute) return { faute };
      await tirer('virage:real_goal', d.butReel());
      await tirer('virage:tick', d.tickDouble());
      const pose = await attendreQue(page, '() => document.querySelector(\'body > .tbf-moment.on\')', 1500);
      if (!pose) return { faute: 'la case « GOAL ! » (body > .tbf-moment.on) n’est pas venue en 1,5 s' };
      /* Le bandeau et le titre de fx.js passaient par-dessus (3,1 s au
         plus) : la case se lisait après eux. Depuis le lot 6, le Virage ne
         les pose plus au but réel (la case est la forme vignette, et le
         sticker de phase dit la minute double) : l'attente rend la main
         tout de suite. Elle reste pour une page qui les reposerait — la case
         ne doit pas se mesurer sous eux. */
      await attendreQue(page, '() => !document.querySelector(\'.fx-bandeau, .fx-titre\')', 4000);
      await finDesMouvements(page, 'body > .tbf-moment', 1500);
      return { portee: 'body > .tbf-moment',
        encore: () => Boolean(document.querySelector('body > .tbf-moment.on')) };
    },
  },
  {
    cle: 'virage@pave', chemin: '/virage', capture: 'virage-pave',
    async jouer(ctx) {
      const { page, d } = ctx;
      const etat = d.etatVirage();
      const faute = await entrerAuVirage(ctx, etat);
      if (faute) return { faute };
      // Le doigt pose, puis un `click` s'il le faut : voir `TOUCHER_AU_VIRAGE`.
      const touche = await page.evaluate(TOUCHER_AU_VIRAGE, etat.cards[0].id);
      if (!touche) return { faute: 'aucun chant à toucher dans la main (#hand [data-card], #hand .card)' };
      /* Le décompte (3, 2, 1 : 1,7 s), puis le pavé. */
      const pave = await attendreQue(page, '() => document.getElementById(\'pad\')', 4000);
      if (!pave) return { faute: `le chant ${touche} touché, aucun pavé (#pad) en 4 s`, donnees: { chant: touche } };
      /* Deux frappes comptées, et la photo juste après la seconde : voir
         `frapperLePave`. */
      const { portee, frappes, bouffee } = await frapperLePave(page);
      return { portee, photoDAbord: true, encore: () => Boolean(document.getElementById('pad')),
        donnees: { chant: touche, geste: etat.cards.find((c) => c.id === touche)?.gest ?? null, frappes, bouffee } };
    },
  },
  {
    /* **Le verdict sur le pavé du Virage** : le premier tempo de la main
       joué jusqu'à sa dernière frappe, `virage:chant` émis, la réponse du
       serveur (`virage:result`, PARFAIT) servie pendant que la fenêtre
       attend, le tampon claqué au centre du pavé. Voir `verdictSurLePave`.
       Aux deux formats les plus serrés, où le tampon a le moins de pavé. */
    cle: 'virage@verdict', chemin: '/virage', capture: 'virage-verdict', formats: [PETIT, FORMATS_BASE[0]],
    async jouer(ctx) {
      const { page, d } = ctx;
      const etat = d.etatVirage();
      const faute = await entrerAuVirage(ctx, etat);
      if (faute) return { faute };
      const chant = etat.cards.find((c) => c.gest === 'tempo');
      if (!chant) return { faute: 'aucun tempo dans la main servie : rien à jouer jusqu’au verdict' };
      const reponse = d.resultat();
      await page.evaluate((r) => {
        window.__repondre = { 'virage:chant': () => window.__sock.fire('virage:result', r) };
      }, reponse);
      return verdictSurLePave(ctx, { toucher: TOUCHER_AU_VIRAGE, chant, gestes: etat.you.gestes,
        emission: 'virage:chant', servi: reponse.verdict });
    },
  },
  {
    cle: 'virage@bilan', chemin: '/virage', capture: 'virage-bilan',
    async jouer(ctx) {
      const { page, tirer, d } = ctx;
      const faute = await entrerAuVirage(ctx, d.etatVirage());
      if (faute) return { faute };
      await tirer('virage:result', d.resultat());
      await finDesMouvements(page, 'body', 2500);
      await page.evaluate((bilan) => {
        window.__repondre = { 'virage:bilan': () => window.__sock.fire('virage:bilan', bilan) };
      }, d.bilanVirage());
      const fleche = await page.evaluate(() => {
        const b = document.querySelector('.tbf-retour');
        if (!b) return false;
        b.click();
        return true;
      });
      if (!fleche) return { faute: 'pas de flèche de retour (.tbf-retour) à toucher' };
      const vu = await page.waitForFunction(PREMIER_VISIBLE, { polling: 50, timeout: 4000 }, BILANS_VIRAGE)
        .then((h) => h.jsonValue(), () => null);
      if (!vu) {
        return { faute: `la flèche touchée après un chant, ni bilan (${BILANS_VIRAGE.slice(0, 3).join(', ')
        }) ni boîte (.tbf-dial-fond) en 4 s` };
      }
      /* **La boîte, à la place du bilan servi, est une panne** depuis le
         lot 6 : la page ne la garde que contre un serveur sans bilan, au
         bout de trois secondes, et la fausse socket lui en rend un en 60 ms.
         Si elle vient quand même, la page n'a pas demandé son bilan (voir
         `emis`) ou ne l'a pas posé. Mesurée quand même : c'est l'écran. */
      if (vu === '.tbf-dial-fond.on') {
        note(ctx.cle, ctx.format.largeur, 'état', `la boîte « QUITTER ? » est venue au lieu du bilan servi (${
          await page.evaluate(() => ((window.__emis ?? []).some(([e]) => e === 'virage:bilan')
            ? 'virage:bilan émis, rien de posé' : 'virage:bilan jamais émis')).catch(() => '?')})`);
      }
      // Toutes ses étapes posées, voir `attendreLeBilan`.
      const { pose, autres } = await attendreLeBilan(page, vu, ctx.cle, ctx.format);
      return { portee: vu, autres, donnees: { vu, pose } };
    },
  },

  /* --- deux variantes du banc, aux deux formats les plus serrés ---
     La grande tribune (trois cents) et le coup de sifflet d'un Virage non
     classé : ce que le brief fait regarder au banc de chaque écran, et que
     les états d'au-dessus — une tribune de 46, un Virage classé, une sortie
     à la flèche — ne montrent pas. */
  {
    /* La tribune de 300 : le rang à trois chiffres et le palier TOP 100 dans
       le tableau, les deux foules les plus larges, et pas de combo. Le
       budget, comme la tribune. */
    cle: 'virage@300', chemin: '/virage', capture: 'virage-300', budget: RANGEES_VIRAGE,
    formats: [PETIT, FORMATS_BASE[0]],
    async jouer(ctx) {
      const faute = await entrerAuVirage(ctx, ctx.d.etatVirage({ grande: true }));
      return faute ? { faute } : { portee: null };
    },
  },
  {
    /* **Le coup de sifflet final** (`virage:fin`, § 15.3), dans la tribune
       de 300, sur un Virage qui ne compte pas au classement : la page
       demande son bilan seule, le pose sans qu'on touche rien, puis quitte
       la salle (`virage:leave`, dans `emis`). Le délai qu'elle tire entre 0
       et 8 s — mille bilans au même instant seraient mille lectures — est
       ramené à zéro, le temps du seul évènement (`hasard`) ; une page qui
       tirerait son délai autrement se fait attendre jusqu'au bout. Mesuré
       sous le bilan, comme `virage@bilan`. */
    cle: 'virage@fin', chemin: '/virage', capture: 'virage-fin', formats: [PETIT, FORMATS_BASE[0]],
    async jouer(ctx) {
      const { page, tirer, d } = ctx;
      const faute = await entrerAuVirage(ctx, d.etatVirage({ grande: true }));
      if (faute) return { faute };
      await page.evaluate((bilan) => {
        window.__repondre = { 'virage:bilan': () => window.__sock.fire('virage:bilan', bilan) };
      }, d.bilanFin());
      await tirer('virage:fin', { statut: 'FT' }, { hasard: 0 });
      const vu = await page.waitForFunction(PREMIER_VISIBLE, { polling: 50, timeout: 9500 }, BILANS_VIRAGE)
        .then((h) => h.jsonValue(), () => null);
      if (!vu) {
        return { faute: `le coup de sifflet tiré (virage:fin), aucun bilan (${BILANS_VIRAGE.slice(0, 3).join(', ')
        }) posé en 9,5 s` };
      }
      /* Au coup de sifflet, la page ne pose que le bilan servi : la boîte
         « QUITTER ? » n'a rien à faire là. Mesurée quand même : c'est l'écran. */
      if (vu === '.tbf-dial-fond.on') {
        note(ctx.cle, ctx.format.largeur, 'état', 'au coup de sifflet, la boîte « QUITTER ? » est venue au lieu du bilan');
      }
      const { pose, autres } = await attendreLeBilan(page, vu, ctx.cle, ctx.format);
      return { portee: vu, autres, donnees: { vu, pose } };
    },
  },
  {
    cle: 'duel@prepa', chemin: '/duel-nvn', capture: 'duel-prepa',
    bouchons: (d) => ({ '/api/deck/matchs': d.matchsDuel(), '/api/deck/loadout': d.loadout(),
      '/api/nvn/attentes': d.attentes() }),
    async jouer({ page }) {
      const peint = await attendreQue(page, '() => document.querySelector(\'#prepaCorps [data-fixture]\')', 5000);
      if (!peint) return { faute: 'la préparation n’a pas peint les matchs servis (#prepaCorps [data-fixture]) en 5 s' };
      await finDesMouvements(page, 'body', 2500);
      const entrer = await page.evaluate(() => {
        const b = document.getElementById('entrer');
        return b ? (b.disabled ? 'éteint' : 'allumé') : null;
      });
      return { portee: null, donnees: { entrer } };
    },
  },
  {
    cle: 'duel@vestiaire', chemin: '/duel-nvn', capture: 'duel-vestiaire',
    bouchons: (d) => ({ '/api/deck/matchs': d.matchsDuel(), '/api/deck/loadout': d.loadout(),
      '/api/nvn/attentes': d.attentes() }),
    async jouer({ page, tirer, d }) {
      await attendreQue(page, '() => document.querySelector(\'#prepaCorps [data-fixture]\')', 5000);
      /* ENTRER EN FILE, comme un joueur : la page émet sa demande, le
         serveur répond par la salle. Sans bouton, la salle vient quand même. */
      const entre = await page.evaluate(() => {
        const b = document.getElementById('entrer');
        if (!b || b.disabled) return false;
        b.click();
        return true;
      });
      await tirer('nvn:file', d.file());
      const salle = await attendreQue(page, '() => document.querySelector(\'.tribune-att\')', 3000);
      if (!salle) return { faute: 'la salle d’attente n’a pas montré ses tribunes (.tribune-att) en 3 s', donnees: { entre } };
      await finDesMouvements(page, 'body', 2000);
      const portee = await page.evaluate(CALQUE_DE, '.tribune-att');
      return { portee, donnees: { entre } };
    },
  },
  {
    cle: 'duel@affiche', chemin: '/duel-nvn', capture: 'duel-affiche',
    async jouer({ page, tirer, d }) {
      await tirer('nvn:start', d.vueDuel());
      await tirer('nvn:affiche', d.affiche());
      const posee = await attendreQue(page, '() => document.getElementById(\'affiche\')?.hidden === false', 1500);
      if (!posee) return { faute: 'l’affiche (#affiche) n’est pas venue en 1,5 s' };
      await finDesMouvements(page, '#affiche', 2500);
      return { portee: '#affiche', photoDAbord: true,
        encore: () => document.getElementById('affiche')?.hidden === false };
    },
  },
  {
    /* Le match de son club est en direct : le menu porte LIVE dans sa case
       du HUD (le sticker d'un écran de jeu, brief du lot 6, § 7). */
    cle: 'duel@jeu', chemin: '/duel-nvn', capture: 'duel-jeu', mur: true, budget: RANGEES_DUEL,
    bouchons: (d) => ({ '/api/virage/live': d.live() }),
    async jouer(ctx) {
      const faute = await entrerEnPartie(ctx, ctx.d.vueDuel());
      return faute ? { faute } : { portee: null };
    },
  },
  {
    /* **La partie à l'entraînement**, sur le match à venir de la liste : la
       plaque du HUD porte ENTRAÎNEMENT au lieu de CLASSÉ, entre les deux
       bâches. C'est le mot le plus long du HUD, et il a deux formes : la
       courte (« ENTRAÎN. ») sur les petits écrans, la longue au-delà — à
       412 px, elle écrasait les deux bâches (« TA TRIBU… »). Aux trois
       formats où cela se joue : le plus étroit, la frontière, la tablette.
       Pas de ticket terrain avant le coup d'envoi : l'arène reprend sa
       place, et le budget le dit. L'état exige la plaque à l'écran, et dit
       la forme qu'elle montre (`plaque`). */
    cle: 'duel@entrainement', chemin: '/duel-nvn', capture: 'duel-entrainement', budget: RANGEES_DUEL,
    formats: [PETIT, GRAND_TELEPHONE, FORMATS_BASE[2]],
    async jouer(ctx) {
      const faute = await entrerEnPartie(ctx, ctx.d.vueDuel({ entrainement: true }));
      if (faute) return { faute };
      const plaque = await ctx.page.evaluate(() => {
        const t = document.getElementById('modeTag');
        /* À l'écran : ni cachée, ni retirée par le motif de la brique (une
           boîte d'un pixel que sa découpe efface — un pixel et cinq
           centièmes, la plaque est tournée). */
        const vu = (e) => {
          const r = e.getBoundingClientRect();
          const s = getComputedStyle(e);
          return r.width > 2 && r.height > 2 && s.visibility === 'visible' && s.display !== 'none'
            && !s.clipPath.includes('inset(50%)');
        };
        if (!t || t.hidden || !vu(t)) return null;
        const formes = [...t.children].filter(vu).map((e) => e.textContent.trim());
        return formes.length ? formes.join(' ') : t.textContent.trim();
      }).catch(() => null);
      if (!plaque || !/ENTRA/.test(plaque)) {
        return { faute: `la partie à l’entraînement posée, la plaque ENTRAÎNEMENT (#modeTag) n’est pas à l’écran${
          plaque ? ` (« ${plaque} »)` : ''}` };
      }
      return { portee: null, donnees: { plaque } };
    },
  },
  {
    /* **Le pavé du duel** : le premier chant de la main touché (un tempo,
       dans le souffle qu'on a), le décompte passé, deux frappes — comme
       `virage@pave`, photographié juste après la seconde puis mesuré sous
       la fenêtre du geste (`#mini`), tant que le geste dure. Le pavé est la
       même brique ; la fenêtre qui le porte, le titre, l'aide et ce qui
       passe devant (les cartes adverses suspendues) sont ceux du duel. */
    cle: 'duel@pave', chemin: '/duel-nvn', capture: 'duel-pave',
    async jouer(ctx) {
      const { page, d } = ctx;
      const vue = d.vueDuel();
      const faute = await entrerEnPartie(ctx, vue);
      if (faute) return { faute };
      /* Le duel écoute le `click` sur sa rangée de chants. */
      const touche = await page.evaluate(TOUCHER_AU_DUEL, vue.chants[0].id);
      if (!touche) return { faute: 'aucun chant à toucher dans la rangée (#chants [data-chant])' };
      const pave = await attendreQue(page, '() => document.getElementById(\'pad\')', 4000);
      if (!pave) return { faute: `le chant ${touche} touché, aucun pavé (#pad) en 4 s`, donnees: { chant: touche } };
      const { portee, frappes, bouffee } = await frapperLePave(page);
      return { portee, photoDAbord: true, encore: () => Boolean(document.getElementById('pad')),
        donnees: { chant: touche, geste: vue.chants.find((c) => c.id === touche)?.gest ?? null, frappes, bouffee } };
    },
  },
  {
    /* **Le verdict sur le pavé du duel** : comme `virage@verdict`, le
       premier tempo de la rangée joué jusqu'au bout, `nvn:chant` émis, et
       la réponse comme le serveur la diffuse à la salle — l'évènement
       `chant` de `nvn:events`, à son identifiant, sur sa carte, avec son
       mot (§ 17). Mêmes formats. */
    cle: 'duel@verdict', chemin: '/duel-nvn', capture: 'duel-verdict', formats: [PETIT, FORMATS_BASE[0]],
    async jouer(ctx) {
      const { page, d } = ctx;
      const vue = d.vueDuel();
      const faute = await entrerEnPartie(ctx, vue);
      if (faute) return { faute };
      const chant = vue.chants.find((c) => c.gest === 'tempo');
      if (!chant) return { faute: 'aucun tempo dans la rangée servie : rien à jouer jusqu’au verdict' };
      const reponse = d.chantDuel(chant.id);
      await page.evaluate((r) => {
        window.__repondre = { 'nvn:chant': () => window.__sock.fire('nvn:events', [r]) };
      }, reponse);
      return verdictSurLePave(ctx, { toucher: TOUCHER_AU_DUEL, chant, gestes: vue.moi.gestes,
        emission: 'nvn:chant', servi: reponse.verdict });
    },
  },
  {
    /* **La corde cède pour sa tribune** : la case de BD du duel (« LA CORDE
       CÈDE ! », `body > .tbf-moment`), trois secondes et demie — plus
       courte qu'au Virage, un duel dure cinq minutes. Photographiée puis
       mesurée sous la case, et l'état vérifie qu'elle était encore là. Aux
       deux formats les plus serrés : c'est la brique de `virage@but`. */
    cle: 'duel@but', chemin: '/duel-nvn', capture: 'duel-but', formats: [PETIT, FORMATS_BASE[0]],
    async jouer(ctx) {
      const { page, tirer, d } = ctx;
      const faute = await entrerEnPartie(ctx, d.vueDuel());
      if (faute) return { faute };
      await tirer('nvn:events', [d.butDuel()]);
      const pose = await attendreQue(page, '() => document.querySelector(\'body > .tbf-moment.on\')', 1500);
      if (!pose) {
        return { faute: 'la corde cédée (nvn:events, « goal »), la case de BD (body > .tbf-moment.on) n’est pas venue '
          + 'en 1,5 s' };
      }
      /* L'entrée de la case, pas le scotch qui se décolle sur toute sa
         durée : le plafond les sépare. */
      await finDesMouvements(page, 'body > .tbf-moment', 1200);
      return { portee: 'body > .tbf-moment', photoDAbord: true,
        encore: () => Boolean(document.querySelector('body > .tbf-moment.on')) };
    },
  },
  {
    /* Le coup de sifflet et la page kraft du duel : la case de BD, les
       lignes qui comptent, l'XP, et en dernier la rangée TOI/LUI en barres
       miroir — attendue jusqu'à ce que chaque barre ait sa part (voir
       `attendreLeBilan`). Sous le pli aux petits formats, cette rangée a
       sa capture à part (`derniereEtapeSousLePli`). */
    cle: 'duel@bilan', chemin: '/duel-nvn', capture: 'duel-bilan',
    apres: derniereEtapeSousLePli('#bilan', 'duel-bilan-fin'),
    async jouer({ page, tirer, d, cle, format }) {
      await tirer('nvn:start', d.vueDuel());
      await pause(400);
      await tirer('nvn:fin', d.finDuel());
      const vu = await page.waitForFunction(PREMIER_VISIBLE, { polling: 50, timeout: 3000 }, ['#bilan', '[data-bilan]'])
        .then((h) => h.jsonValue(), () => null);
      if (!vu) return { faute: 'le bilan (#bilan) n’est pas venu en 3 s après nvn:fin' };
      const { pose, autres } = await attendreLeBilan(page, vu, cle, format);
      return { portee: vu, autres, donnees: { pose } };
    },
  },

  /* --- les autres écrans du lot 6, hors des deux arènes ---
     Sans fausse socket (`socket: false`), et à deux formats chacun
     (`formats`) : ceux où l'écran se joue le plus serré. */
  {
    /* La salle de répétition, le geste jugé : le tampon PARFAIT sur le pavé,
       le tampon TON MEILLEUR (un premier essai est toujours un record) et LE
       JOUER EN DUEL. Sous 600 px de haut, la consigne s'efface pour le
       verdict (`.salle.jugee`). */
    cle: 'repetition@jugee', chemin: '/repetition', capture: 'repetition-jugee', socket: false,
    formats: [PETIT, FORMATS_BASE[0]],
    bouchons: (d) => ({ 'POST /api/repetition': d.noteDe(0.93) }),
    async jouer({ page }) {
      return jugerALaRepetition(page, 'tempo', () => page.evaluate(`(${FRAPPER})(3, 4000)`).catch(() => 0));
    },
  },
  {
    /* Une épreuve tamponnée : le tri, deux cartons ramassés puis « J'AI
       TOUT RAMASSÉ ». Le tampon (BON) se centre sur la grille, que la zone
       coupe une fois le geste jugé : c'est la plus grande épreuve. */
    cle: 'repetition@tri', chemin: '/repetition', capture: 'repetition-tri', socket: false,
    formats: [PETIT, FORMATS_BASE[0]],
    bouchons: (d) => ({ 'POST /api/repetition': d.noteDe(0.82) }),
    async jouer({ page }) {
      return jugerALaRepetition(page, 'tri', async () => {
        for (const i of [0, 1]) {
          await page.evaluate((n) => {
            document.querySelector(`#pad [data-c="${n}"]`)?.dispatchEvent(new PointerEvent('pointerdown',
              { bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'touch' }));
          }, i);
          await pause(250);
        }
        await page.evaluate(() => document.getElementById('valider')?.click());
      });
    },
  },
  {
    /* /amis avec la présence servie : la pastille de chaque ami (au Virage,
       en duel, en ligne ; rien pour le quatrième), un pseudo long, et
       « INVITER AU KOP » sur chaque ligne. Mesuré comme une page. */
    cle: 'amis@presence', chemin: '/amis', capture: 'amis-presence', socket: false,
    formats: [FORMATS_BASE[0], FORMATS_BASE[2]],
    bouchons: (d) => ({ 'GET /api/amis/': d.amis(), 'GET /api/kop/miens': d.kops() }),
    async jouer({ page }) {
      const vues = await attendreQue(page,
        '() => document.querySelectorAll(\'#corps [data-presence-ami]\').length >= 3', 6000);
      if (!vues) return { faute: 'trois amis présents servis, moins de trois pastilles ([data-presence-ami]) en 6 s' };
      await finDesMouvements(page, 'body', 2500);
      const donnees = await page.evaluate(() => ({
        presences: [...document.querySelectorAll('#corps .gars')].map((g) =>
          g.querySelector('[data-presence-ami]')?.dataset.presenceAmi ?? null),
        inviter: document.querySelectorAll('#corps [data-kop]').length,
      }));
      return { portee: null, donnees };
    },
  },
  {
    /* Le tiroir avec la présence servie (`{ actif: true, visible: true }`) :
       la ligne « Apparaître hors ligne » au pied, amenée au milieu de
       l'écran pour la photo. Mesuré sous le tiroir, comme `tiroir@`, et sa
       hauteur relevée de même : une ligne de plus au pied ne doit pas le
       faire passer au-delà d'un écran et demi. La ligne elle-même est
       décrite (`presence` : corps, encre, cible, piste) — son contraste, sa
       taille et sa cible sont dans les relevés ordinaires. */
    cle: 'tiroir@presence', chemin: PAGE_TIROIR, capture: 'tiroir-presence', socket: false,
    formats: [FORMATS_BASE[0], FORMATS_BASE[2]],
    bouchons: (d) => ({ 'GET /api/presence': d.presence() }),
    async jouer({ page, cle, format }) {
      await pause(1800);
      const faute = await ouvrirLeTiroir(page);
      if (faute) return { faute };
      const vue = await attendreQue(page, '() => document.getElementById(\'tbf-presence\')?.hidden === false', 3000);
      if (!vue) {
        return { faute: 'la présence servie, la ligne « Apparaître hors ligne » (#tbf-presence) n’a pas paru en 3 s' };
      }
      await page.evaluate(() => document.getElementById('tbf-presence').scrollIntoView({ block: 'center' }));
      await pause(300);
      const presence = await page.evaluate(() => {
        const b = document.querySelector('#tbf-presence [role="switch"]');
        if (!b) return null;
        const lib = getComputedStyle(b.querySelector('.lib') ?? b);
        const piste = b.querySelector('.tbf-inter')?.getBoundingClientRect();
        return { px: parseFloat(lib.fontSize), encre: lib.color, cible: Math.round(b.getBoundingClientRect().height),
          piste: piste ? [Math.round(piste.width), Math.round(piste.height)] : null,
          cache: b.getAttribute('aria-checked') === 'true' };
      });
      const { tiroir, tropHaut } = await hauteurDuTiroir(page, cle, format.largeur);
      return { portee: '#tbf-tiroir', donnees: { presence, tiroir }, autres: tropHaut ? 1 : 0 };
    },
  },
];

/** Un geste à l'essai dans la salle de répétition, jusqu'à son verdict.
    Rend la portée (la salle, un calque fixé) et ce qu'on a vu, ou la faute.
    La configuration vient du serveur ; la note, du bouchon de l'état. */
async function jugerALaRepetition(page, geste, jouer) {
  const tuile = await attendreQue(page, `() => document.querySelector('#vue [data-g="${geste}"]')`, 8000);
  if (!tuile) return { faute: `la salle n’a pas peint le geste « ${geste} » ([data-g]) en 8 s` };
  await page.evaluate((g) => document.querySelector(`#vue [data-g="${g}"]`).click(), geste);
  const pave = await attendreQue(page, '() => document.querySelector(\'#zone #pad\')', 4000);
  if (!pave) return { faute: `le geste « ${geste} » touché, aucun pavé (#zone #pad) en 4 s` };
  const frappes = await jouer();
  /* Le geste finit seul (le tempo : huit temps), ou par son bouton (le
     tri) ; puis la note arrive et le tampon claque. */
  const jugee = await attendreQue(page, '() => document.querySelector(\'#salle.jugee #pad > .tbf-verdict\')', 12_000);
  if (!jugee) {
    return { faute: `le geste « ${geste} » joué, pas de tampon sur le pavé (#pad > .tbf-verdict) en 12 s`,
      donnees: { geste } };
  }
  await finDesMouvements(page, '#salle', 2500);
  await texteStable(page, '#resultat', 600, 3000);
  const donnees = await page.evaluate((g) => {
    const vu = (sel) => {
      const e = document.querySelector(sel);
      const r = e?.getBoundingClientRect();
      return Boolean(r && r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden');
    };
    return { geste: g, verdict: document.querySelector('#pad > .tbf-verdict')?.dataset.verdict ?? null,
      record: vu('#resultat .record .tbf-tampon'), enDuel: vu('#enDuel'), consigne: vu('#consigne') };
  }, geste);
  return { portee: await page.evaluate(CALQUE_DE, '#salle'),
    donnees: { ...donnees, ...(typeof frappes === 'number' ? { frappes } : {}) } };
}
const CLES_ARENES = new Set(ETATS_ARENES.map((x) => x.cle));
/* Un état qui ne se regarde qu'à certains formats (`formats`) : les autres
   l'ignorent. Avec `--largeur`, il passe si le format demandé en est. */
const aCeFormat = (def, format) => !def.formats
  || def.formats.some((f) => f.largeur === format.largeur && f.hauteur === format.hauteur);

/** **Six règles du lot 6 qu'aucun compte de texte ne lit**, relevées sur
    chaque état mesuré. Rend le nombre de relevés, compté sur la ligne de
    console avec le reste.

      — **au plus trois animations sans fin à l'écran** (« sans fin »),
        comptées par `FX.sansFin` ; toutes, calques cachés compris, comme la
        règle les compte. Avant le lot, au banc : six à la tribune du
        Virage, sept en minute double, dix au duel en jeu ;
      — **le sticker d'urgence du menu a son air** (« sticker rogné ») : sur
        un écran de jeu, quand le menu en porte un, l'écran laisse au bouton,
        au-dessus et à droite, au moins ce que le sticker en déborde, bord
        et cerne compris (`barre.air` contre `barre.demande`, au demi-pixel
        près : un arrondi n'est pas un défaut) ;
      — **le voile des arènes est celui du hub** (« voile dense », QUESTIONS
        Q6, l'hypothèse H6 levée) : à 768 px de large et au-delà, où le mur
        se voit autour de la colonne, /virage et /duel-nvn ne portent plus
        le voile dense des pages de contenu (75 %), mais celui du hub (60 %) ;
      — **la main et les chants restent à l'écran** (« main coupée », sur
        les états qui relèvent un budget) : l'arène cède d'abord (voir
        `MAINS`). Le compte « hors écran » ne le voit pas — un texte coupé
        par le cadre qui le porte n'est pas compté ;
      — **aucun cadre n'entame l'encre d'un texte** (« encre rognée ») : ni
        l'accent d'une capitale, ni une cédille, ni un émoji (voir
        `ENCRE_ROGNEE`) ;
      — **rien ne se pose sur le libellé d'une carte** (« libellé couvert »,
        sur la page entière) : ni ce qui manque, ni la recharge, ni la
        voisine de l'éventail (voir `LIBELLES_COUVERTS`). */
const ARENES = new Set(['/virage', '/duel-nvn']);
function reglesDuLot6(cle, chemin, format, vus, sansFin, budget = null, sondes = {}) {
  let n = 0;
  for (const [sel, r] of Object.entries(budget?.rangees ?? {})) {
    if (!r || !Object.hasOwn(MAINS, sel)) continue;
    const [, haut, , vue] = r;
    const exige = MAINS[sel] === null ? haut : Math.min(MAINS[sel], haut);
    if (vue + 1 >= exige) continue;
    n += 1;
    const arene = budget.rangees['#rope'] ?? budget.rangees['#arene'];
    note(cle, format.largeur, 'main coupée', `${sel} : ${vue} px à l’écran sur ${haut}, il en faut ${exige}${
      arene ? `, pendant que l’arène en garde ${arene[1]}` : ''} — l’arène cède avant la main et les chants`);
  }
  if (sansFin && sansFin.n > SEUILS.sansFin) {
    n += 1;
    note(cle, format.largeur, 'sans fin', `${sansFin.n} animations sans fin à l’écran, il en faut ${
      SEUILS.sansFin} au plus : ${sansFin.liste.slice(0, 6).join(' · ')}`);
  }
  const b = vus.barre;
  if (b?.jeu && b.air && b.demande && b.air.some((x, i) => x + 0.5 < b.demande[i])) {
    n += 1;
    note(cle, format.largeur, 'sticker rogné', `le sticker « ${b.pastille ?? b.urgence} » du menu a ${
      b.air[0]} px au-dessus du bouton et ${b.air[1]} à sa droite, il en demande ${b.demande[0]} et ${
      b.demande[1]} : l’écran le rogne`);
  }
  if (ARENES.has(chemin) && format.largeur >= 768 && vus.voile?.dense) {
    n += 1;
    note(cle, format.largeur, 'voile dense', 'le voile du mur est dense (75 %) sur un écran de jeu : '
      + 'H6 est levée (Q6), il doit être celui du hub (60 %)');
  }
  /* Les deux sondes : tout compte, les quatre premiers sont nommés, comme
     les relevés de la mesure. */
  const encre = sondes.encre ?? [];
  n += encre.length;
  for (const x of encre.slice(0, 4)) {
    note(cle, format.largeur, 'encre rognée', `${x.q} « ${x.texte} » — ${String(x.de).replace('.', ',')} px d’encre ${
      x.ou === 'haut' ? 'au-dessus' : 'au-dessous'} du cadre de ${x.coupe}, qui la coupe`);
  }
  const couverts = sondes.couverts ?? [];
  n += couverts.length;
  for (const x of couverts.slice(0, 4)) {
    note(cle, format.largeur, 'libellé couvert', `${x.carte ? `la carte ${x.carte}` : 'une carte'} : ${x.libelle} « ${
      x.texte} » couvert à ${x.part} % — rien ne se pose sur un libellé`);
  }
  return n;
}

/** Un état d'arène, sur une visite neuve. Chaque panne est nommée (genre
    « état ») et l'écran trouvé à la place est photographié : un sélecteur
    disparu ne doit pas arrêter les autres. */
async function etatArene(format, def, d) {
  const { cle, chemin } = def;
  const bouchons = def.bouchons?.(d) ?? null;
  const socket = def.socket !== false;
  const { contexte, page, erreurs, refus } = await nouvelleVisite(format, 'joueur', { socket, bouchons });
  const evenements = [];
  /* `hasard` : ce que `Math.random` rend **pendant** l'évènement, et
     seulement pendant (la fausse socket appelle les écouteurs sans
     attendre) — pour une page qui tire un délai au hasard en le recevant. */
  const tirer = async (evt, donnees, { hasard = null } = {}) => {
    evenements.push(evt);
    await page.evaluate((e, x, h) => {
      if (h === null) { window.__sock.fire(e, x); return; }
      const r = Math.random;
      Math.random = () => h;
      try { window.__sock.fire(e, x); } finally { Math.random = r; }
    }, evt, donnees, hasard);
  };
  const autour = async () => ({
    evenements: [...evenements],
    emis: await page.evaluate(() => (window.__emis ?? []).map(([e]) => e)).catch(() => null),
    ...(bouchons ? { bouches: Object.keys(bouchons) } : {}),
    barre: await page.evaluate(BARRE_JEU, SEUILS.bordSticker).catch(() => null),
    voile: await page.evaluate(VOILE_DU_MUR).catch(() => null),
  });
  const echec = async (quoi, en = {}) => {
    note(cle, format.largeur, 'état', quoi);
    const capture = await photographier(page, def.capture, format, cle).catch(() => null);
    rangerEtat(cle, chemin, format, { capture, ...await autour(), ...en });
  };
  try {
    try {
      await page.goto(base + chemin, { waitUntil: 'networkidle0', timeout: 20_000 });
    } catch {
      note(cle, format.largeur, 'chargement', 'la page n’a pas fini de charger en 20 s');
      return;
    }
    /* La fausse socket, fx.js et la barre (tous deux différés) : sans eux,
       rien à tirer ni à toucher. Un écran sans socket n'attend que les deux
       derniers. */
    const prete = await page.waitForFunction((s) => Boolean((!s || window.__sock) && window.FX
      && document.querySelector('.tbf-retour')), { timeout: 8000 }, socket).then(() => true, () => false);
    if (!prete) {
      await echec(`la page n’a pas posé ${socket ? 'sa fausse socket, ' : ''}fx.js ou la barre en 8 s`);
      return;
    }
    const r = await def.jouer({ page, tirer, d, format, cle });
    if (r.faute) { await echec(r.faute, r.donnees); return; }
    /* Les deux sondes, juste après la mesure : un écran qui passe (le
       pavé, l'affiche, la case de BD) est encore là, et `encore` le
       vérifie pour elles aussi. Les libellés de carte, seulement sur la
       page entière : sous un calque posé par-dessus (le pavé, un bilan),
       les cartes sont couvertes exprès. */
    const sonder = async () => ({
      encre: await page.evaluate(ENCRE_ROGNEE, r.portee, SEUILS.encreRognee).catch(() => null),
      couverts: r.portee === null
        ? await page.evaluate(LIBELLES_COUVERTS, SEUILS.libelleCouvert).catch(() => null) : null,
    });
    let m = null;
    let capture = null;
    let sondes = {};
    if (r.photoDAbord) {
      capture = await photographier(page, def.capture, format, cle);
      m = await mesurer(page, r.portee);
      if (m) sondes = await sonder();
    } else {
      m = await mesurer(page, r.portee);
      if (m) sondes = await sonder();
      capture = await photographier(page, def.capture, format, cle);
    }
    if (!m) {
      note(cle, format.largeur, 'état', `la portée de la mesure (${r.portee}) n’est plus dans la page : photographié, pas mesuré`);
      rangerEtat(cle, chemin, format, { capture, portee: r.portee, ...await autour(), ...r.donnees });
      return;
    }
    const polices = await page.evaluate(POLICES);
    if (r.encore && !await page.evaluate(r.encore).catch(() => false)) {
      note(cle, format.largeur, 'état', 'l’écran est parti avant la fin de la mesure : relevé écarté, capture gardée');
      rangerEtat(cle, chemin, format, { ...polices, capture, portee: r.portee, ...await autour(), ...r.donnees });
      return;
    }
    const budget = def.budget ? await page.evaluate(BUDGET, def.budget).catch(() => null) : null;
    const sansFin = await page.evaluate(SANS_FIN).catch(() => null);
    const enPlus = def.apres ? await def.apres({ page, d, format, cle }) : {};
    const vus = await autour();
    const autres = (r.autres ?? 0) + reglesDuLot6(cle, chemin, format, vus, sansFin, budget, sondes);
    rangerEtat(cle, chemin, format, { ...polices, capture, portee: r.portee, ...vus, ...r.donnees,
      ...(budget ? { budget } : {}), ...(sansFin ? { sansFin } : {}),
      ...(sondes.encre ? { encre: sondes.encre } : {}), ...(sondes.couverts ? { couverts: sondes.couverts } : {}),
      ...enPlus }, m, erreurs, refus, autres);
  } catch (e) {
    await echec(`l’étape a levé : ${String(e?.message ?? e).slice(0, 80)}`).catch(() => {});
  } finally {
    await contexte.close();
  }
}

/** Les états du lot 6, format après format (chacun à ses formats) ; puis la
    tribune et la partie au format du mur. Rend ce qui a été fabriqué, ou la
    cause. */
async function etatsDesArenes() {
  let d;
  try { d = await fabriquerLesArenes(); } catch (e) {
    const faute = `pas d’état d’arène fabriqué : ${String(e?.message ?? e).slice(0, 80)}`;
    for (const format of FORMATS_ARENES) {
      for (const def of ETATS_ARENES.filter((x) => aCeFormat(x, format))) note(def.cle, format.largeur, 'état', faute);
    }
    return { faute };
  }
  for (const format of FORMATS_ARENES) {
    for (const def of ETATS_ARENES.filter((x) => aCeFormat(x, format))) await etatArene(format, def, d);
  }
  for (const format of FORMATS_MUR) {
    for (const def of ETATS_ARENES.filter((x) => x.mur)) await etatArene(format, def, d);
  }
  return d.decrit;
}

if (etats) {
  console.log('');
  /* Les formats de chaque état, dans le JSON : celui de 320 n'est pas dans
     « formats », qui reste la liste des pages. */
  rapport.formatsEtats = arenesSeules ? {} : { ouverture: FORMATS_OUVERTURE.map(cleFormat),
    tiroir: FORMATS.map(cleFormat), hud: FORMATS_HUD.map(cleFormat), booster: FORMATS.map(cleFormat),
    classement: FORMATS.map(cleFormat), collection: FORMATS.map(cleFormat), profil: FORMATS.map(cleFormat) };
  rapport.formatsEtats.arenes = FORMATS_ARENES.map(cleFormat);
  if (FORMATS_MUR.length) rapport.formatsEtats.mur = FORMATS_MUR.map(cleFormat);
  /* Les états du lot 6 qui ne se regardent qu'à certains de ces formats. */
  rapport.formatsEtats.parEtat = Object.fromEntries(ETATS_ARENES.filter((x) => x.formats)
    .map((x) => [x.cle, FORMATS_ARENES.filter((f) => aCeFormat(x, f)).map(cleFormat)]));
  if (!arenesSeules) {
    for (const format of FORMATS_OUVERTURE) {
      await etatOuverture(format);
      if (FORMATS.includes(format)) await etatTiroir(format);
    }
    /* Les états des lots 3 et 5, après : voir « les écrans de plus ». */
    for (const format of FORMATS_HUD) await etatHud(format);
    for (const format of FORMATS) await etatBooster(format);
    /* Le profil et ses insignes (lot 4), avant le classement : voir « les
       insignes du carnet ». */
    rapport.insignesSemes = await etatsDesInsignes();
  }
  /* Les arènes (lot 6), avant le classement et son redémarrage : elles ne
     sèment rien, et ne dépendent que d'un serveur debout. Voir « les
     arènes ». */
  rapport.arenesFabriquees = await etatsDesArenes();
  /* `--arenes` s'arrête là : il ne regarde qu'elles. */
  if (!arenesSeules) {
    rapport.classementSeme = await semerClassement();
    if (await redemarrer()) {
      for (const format of FORMATS) await etatClassement(format);
      /* La collection du lot 4, en dernier : voir « la collection ». */
      rapport.collectionSemee = await etatsDeLaCollection();
    } else {
      for (const format of FORMATS) {
        note('classement@classé', format.largeur, 'état', 'le serveur n’a pas redémarré : classement non mesuré');
        note('(la collection)', format.largeur, 'état', 'le serveur n’a pas redémarré : collection non mesurée');
      }
    }
  }
}

await nav.close();
serveur.kill();
await pool.end();

/* Le JSON d'abord : si le rapport qui suit levait, la mesure — qui a coûté
   plusieurs minutes et ne se refait pas une fois les pages touchées — serait
   quand même sur le disque. */
if (sortieJson) {
  mkdirSync(path.dirname(sortieJson), { recursive: true });
  writeFileSync(sortieJson, `${JSON.stringify(rapport, null, 2)}\n`);
}

/* -------------------------------------------------------------- le rapport */

if (!trouvailles.length) {
  console.log(`\n  Rien à signaler sur les ${VISITES.length} pages auditées.\n`);
} else {
  /* Rangé **par genre** et non par page : une même faute de mise en page se
     répète souvent sur dix écrans, et la corriger une fois les corrige tous. La
     lecture par page ferait croire à dix problèmes. */
  const parGenre = new Map();
  for (const t of trouvailles) {
    if (!parGenre.has(t.genre)) parGenre.set(t.genre, []);
    parGenre.get(t.genre).push(t);
  }

  /* **Un genre absent de cette liste ne s'affichait jamais.** « sous le décor »
     était relevé, compté dans le total de chaque page — et jamais montré,
     parce qu'on avait oublié de l'y inscrire. Les genres de la liste passent
     dans cet ordre, et **tous les autres à leur suite** : un relevé ajouté
     demain se verra même si personne ne pense à cette ligne. */
  const ORDRE_GENRES = ['script', 'image cassée', 'chargement', 'police de repli', 'état', 'refusé (429)',
    'renvoyée', 'fête de niveau', 'bonus du jour', 'ticket resté', 'déborde', 'hors écran', 'hors fenêtre',
    'barre décalée', 'sticker rogné', 'tiroir trop haut', 'sans fin', 'voile dense', 'main coupée',
    'encre rognée', 'libellé couvert', 'coupé', 'coupé (lignes)', 'trop petit', 'pâle', 'pâle sur grain', 'sous le décor',
    'petit texte', 'opacité', 'petit or',
    'backdrop-filter', 'pâle au jour', 'pâle au jour sur grain', 'sans alt', 'capture'];
  const genres = [...ORDRE_GENRES, ...[...parGenre.keys()].filter((g) => !ORDRE_GENRES.includes(g))];

  console.log(`\n${trouvailles.length} trouvaille(s), par genre :\n`);
  for (const genre of genres) {
    const liste = parGenre.get(genre);
    if (!liste?.length) continue;
    /* **Le même défaut, une seule ligne.** La flèche de retour fait 42 px sur
       vingt pages et trois largeurs : soixante trouvailles, un sélecteur, une
       ligne de CSS. Les lister une par une donnait un rapport qu'on ne lit pas
       jusqu'au bout — et dont les vraies singularités, celles qui n'arrivent que
       sur un écran, se noient au milieu.

       On regroupe donc sur ce qui est dit, pages mises de côté, et on nomme
       ensuite où ça se voit. Le nombre en tête est le nombre d'écrans touchés :
       c'est lui qui dit par quoi commencer. */
    const memes = new Map();
    for (const t of liste) {
      if (!memes.has(t.quoi)) memes.set(t.quoi, []);
      memes.get(t.quoi).push(t);
    }
    const range = [...memes.entries()].sort((a, b) => b[1].length - a[1].length);
    console.log(`  ── ${genre.toUpperCase()} (${liste.length} sur ${range.length} défaut(s))`);
    for (const [quoi, ou] of range.slice(0, tout ? range.length : 14)) {
      const pages = [...new Set(ou.map((t) => t.page))];
      const largeurs = [...new Set(ou.map((t) => t.largeur))];
      console.log(`     ×${String(ou.length).padStart(2)}  ${quoi}`);
      console.log(`          ${pages.slice(0, 6).join(' ')}${
        pages.length > 6 ? ` … +${pages.length - 6}` : ''}  ·  ${largeurs.join('/')} px`);
    }
    if (!tout && range.length > 14) {
      console.log(`     … et ${range.length - 14} défaut(s) de plus — \`npm run audit:ui -- --tout\``);
    }
    console.log('');
  }
}

/* ----------------------------------------------- le socle, page par page

   Le rapport par genre dit **quoi** corriger ; ce tableau dit **où en est
   chaque écran**, un nombre par format. C'est lui qu'on compare avant et
   après un lot : « /kop, 14 textes sous 11 px à 360 × 640 » se re-mesure,
   « c'est mieux » ne se re-mesure pas. Les relevés s'y comptent en entier,
   sans la coupe à quatre du rapport.

   Les colonnes « grain » et « soleil g » sont les mêmes contrastes, lus à
   travers une tuile : à part, pour que « soleil » se compare encore au
   relevé d'un lot d'avant.

   Les états ont un format de plus (l'ouverture à 320 × 568 : « – » pour le
   tiroir, qui n'y est pas mesuré) et une colonne de plus, « hors fen. »,
   le relevé qui n'existe que pour eux. */
const tableau = (titre, lignes, formats = FORMATS, enPlus = []) => {
  const colonnes = [['<11 px', 'petitTexte'], ['<0,85', 'opacite'], ['flou', 'backdrop'],
    ['petit or', 'petitOr'],
    ['grain', 'palesGrain'], ...(jour ? [['soleil', 'jour'], ['soleil g', 'jourGrain']] : []),
    ['déborde', 'deborde'], ...enPlus];
  /* Au moins la place du titre : avec un seul format, « soleil g » et
     « déborde » se collaient au titre voisin. */
  const largeurCol = Math.max(formats.length * 4 + 2, ...colonnes.map(([t]) => t.length + 2));
  const largeurCle = Math.max(16, ...lignes.map(({ cle }) => cle.length));
  console.log(`${titre} — un nombre par format (${
    formats.map((f) => `${f.largeur}×${f.hauteur}`).join(' / ')}) :\n`);
  console.log(`  ${''.padEnd(largeurCle)} ${colonnes.map(([t]) => t.padEnd(largeurCol)).join('')}`);
  for (const { cle, par } of lignes) {
    const cases = colonnes.map(([, k]) => formats
      .map((f) => String(par[cleFormat(f)]?.compte?.[k] ?? '–').padStart(3)).join(' ')
      .padEnd(largeurCol));
    console.log(`  ${cle.padEnd(largeurCle)} ${cases.join('')}${HORS_LOT.has(cle) ? '(hors lot)' : ''}`);
  }
  console.log('');
};
tableau('Le socle, page par page', VISITES.map(({ cle }) => ({ cle, par: rapport.pages[cle] ?? {} })));
if (etats) {
  if (!arenesSeules) {
    tableau('Les états', Object.entries(rapport.etats)
      .filter(([cle, par]) => !CLES_ARENES.has(cle) && FORMATS_OUVERTURE.some((f) => par[cleFormat(f)]?.compte))
      .map(([cle, par]) => ({ cle, par })), FORMATS_OUVERTURE, [['hors fen.', 'horsFenetre']]);
  }
  /* Les arènes, à part : leurs formats ne sont pas ceux des autres états
     (412 × 915 en plus, 400 × 800 en moins), et un tableau à cinq formats
     ne se lirait plus d'une traite. Le mur en une ligne : deux états, un
     format. */
  tableau('Les arènes', Object.entries(rapport.etats)
    .filter(([cle, par]) => CLES_ARENES.has(cle) && FORMATS_ARENES.some((f) => par[cleFormat(f)]?.compte))
    .map(([cle, par]) => ({ cle, par })), FORMATS_ARENES, [['hors fen.', 'horsFenetre']]);
  for (const f of FORMATS_MUR) {
    const dit = ETATS_ARENES.filter((x) => x.mur).map(({ cle }) => {
      const e = rapport.etats[cle]?.[cleFormat(f)];
      if (!e?.compte) return `${cle} non mesuré`;
      const n = Object.entries(e.compte).filter(([k]) => ['petitTexte', 'opacite', 'backdrop', 'petitOr', 'palesGrain',
        'deborde', 'horsEcran', 'coupes', ...(jour ? ['jour', 'jourGrain'] : [])].includes(k))
        .reduce((s, [, v]) => s + v, 0);
      return `${cle} ${n} relevé(s), voile ${e.voile ? (e.voile.dense ? 'dense (75 %)' : 'du hub (60 %)') : 'absent'}`;
    });
    console.log(`  Le mur, ${f.largeur}×${f.hauteur} : ${dit.join(' ; ')}\n`);
  }
}

/* **Ce que la lecture à travers le grain a rendu mesurable**, format par
   format, sur les pages : combien de textes elle a lus, combien restent
   hors mesure (vrais dégradés, photos), et combien de ceux qu'elle a lus
   manquent leur seuil. C'est la ligne à lire avant le compte « soleil » :
   quand « non mesurables » monte, un compte qui baisse ne prouve rien. */
for (const f of FORMATS) {
  const somme = (k) => Object.values(rapport.pages)
    .reduce((s, par) => s + (par[cleFormat(f)]?.compte?.[k] ?? 0), 0);
  console.log(`  Sous le grain, ${f.largeur}×${f.hauteur} : ${somme('surGrain')} texte(s) lu(s), ${
    somme('palesGrain')} pâle(s)${jour ? `, ${somme('jourGrain')} pâle(s) au jour` : ''} ; non mesurables : ${
    somme('surDegrade')}`);
}
/* **Ce que la règle du texte à soi a ajouté au contraste**, et ce qui lui
   échappe encore : la ligne à lire avant de comparer un compte de
   contraste à celui d'un relevé d'avant les lots 3 et 5 (audit-ui/2). */
for (const f of FORMATS) {
  const lus = { textes: 0, pales: 0, jour: 0 };
  let hors = 0;
  for (const par of Object.values(rapport.pages)) {
    const r = par[cleFormat(f)]?.releves;
    if (!r) continue;
    lus.textes += r.horsFeuille.textes;
    lus.pales += [...r.pales, ...r.palesGrain].filter((x) => x.horsFeuille).length;
    lus.jour += [...(r.jour ?? []), ...(r.jourGrain ?? [])].filter((x) => x.horsFeuille).length;
    hors += r.horsContraste.length;
  }
  console.log(`  Texte à soi, ${f.largeur}×${f.hauteur} : ${lus.textes} texte(s) hors des feuilles, ${
    lus.pales} pâle(s)${jour ? `, ${lus.jour} pâle(s) au jour` : ''} ; hors de tout contraste : ${hors}`);
}
/* **La barre, page contre page** : où la majorité pose la flèche et le
   menu, sur combien de pages, et combien la posent ailleurs (nommées dans
   « barre décalée », plus haut). */
for (const f of FORMATS) {
  const b = rapport.barre?.[cleFormat(f)] ?? {};
  const dit = PIECES_BARRE.filter(([p]) => b[p]).map(([p]) => {
    const x = b[p];
    return `${p === 'retour' ? 'flèche' : 'menu'} ${x.majorite ? `[${x.majorite.join(', ')}] sur ${x.sur}/${x.pages} page(s)`
      : x.pages < 3 ? `non comparé (${x.pages} page${x.pages > 1 ? 's' : ''})` : `sans majorité sur ${x.pages} pages`}${
      x.ecarts.length ? `, ${x.ecarts.length} ailleurs` : ''}`;
  });
  if (dit.length) console.log(`  La barre, ${f.largeur}×${f.hauteur} : ${dit.join(' ; ')}`);
}
console.log('');

if (SANS_EXEMPLE.length) {
  console.log(`  Non auditée(s), faute d’exemple dans EXEMPLES : ${SANS_EXEMPLE.join(', ')}\n`);
}
if (!coupeLignesMesurable) {
  console.log('  Non mesuré : « coupé (lignes) », son témoin a échoué (voir « Le témoin de la coupe à la ligne »).\n');
}
if (sortieJson) console.log(`  Relevés complets : ${sortieJson}`);
if (dossierCaptures) console.log(`  Captures : ${dossierCaptures}`);
