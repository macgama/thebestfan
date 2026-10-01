#!/usr/bin/env node
/**
 * Les tuiles de grain : le béton, la toile, le papier.
 * ====================================================
 *
 * La matière FAIT MAIN tient à trois surfaces : le **mur** de béton derrière
 * tout, la **bâche** de toile des boutons et des cadres, le **kraft** des
 * tickets. Une couleur plate ne fait aucune des trois — c'est le grain qui dit
 * « béton », « toile » ou « papier ». Ce script fabrique ce grain : trois
 * tuiles de 256 pixels, posées en fond répété, sans couture — et le béton
 * une seconde fois, en 512, pour les écrans denses (voir « Deux
 * résolutions pour le béton »).
 *
 * ## Pourquoi des images, et jamais `feTurbulence`
 *
 * Le filtre SVG fait du bruit en une ligne, et c'est un piège : le navigateur
 * le recalcule à chaque peinture, sur toute la surface, sur le processeur — un
 * mur plein écran qui défile sur un téléphone d'entrée de gamme refait son
 * bruit à chaque image. Il ne rend pas non plus la même chose d'un moteur à
 * l'autre. Une tuile est décodée une fois, répétée par le compositeur, et
 * identique partout. Le brief du lot 1 l'interdit pour ces raisons-là.
 *
 * ## Pourquoi calculées, et pas dessinées
 *
 * Ce sont les seules images du jeu qui ne passent pas par `art/` : aucun
 * générateur ne sait rendre une tuile qui se raccorde à elle-même, et une
 * tuile qui ne se raccorde pas trace une grille de coutures sur tout l'écran.
 * On les calcule donc **sur un tore** : ce qui sort par la droite rentre par
 * la gauche, ce qui sort par le bas rentre par le haut. Une fibre qui déborde
 * continue en face, la trame compte exactement 256 pixels de fils, et un
 * grain de béton, d'un pixel, ne déborde jamais. La tuile n'a pas de bord,
 * donc pas de couture.
 *
 * ## Un voile, pas une couleur
 *
 * Chaque tuile est un **voile** presque transparent, qui éclaire ou fonce ce
 * qu'il y a dessous. La couleur reste celle de la feuille de style : le même
 * béton grise le mur (`--beton`) et le panneau calme, la même toile trame les
 * sept faces de la bâche. Une tuile par couleur, ce serait vingt fichiers, et
 * l'hypothèse H1 des faces foncées gravée dans des images au lieu de tenir
 * dans une table de jetons.
 *
 *   — le **béton** a deux teintes : un sable clair, serré et faible, et des
 *     creux noirs, plus rares et plus marqués. Le premier béton n'avait que le
 *     sable, plus clairsemé et plus fort (jusqu'à 19 %, en points flous) : sur
 *     un fond presque noir, des points clairs isolés sans aucune ombre ne font
 *     pas du béton, ils font de la neige — ou un ciel étoilé, qui ajoutait des
 *     étoiles aux bokehs de la photo de tribune et mouchetait les panneaux
 *     sous le texte. C'est le creux qui dit « matière » : la maquette le
 *     savait, son mur posait des points clairs à 3,5 % **et** des creux à
 *     28 % ;
 *   — la **toile** est un voile noir : c'est le creux entre les fils qui
 *     dessine la trame, et il fonce la face, quelle qu'elle soit ;
 *   — le **papier** est un voile brun : une fibre grise sur du kraft se lit
 *     comme de la poussière, pas comme du papier.
 *
 * Une teinte par famille de grain, jamais un dégradé de teintes : c'est ce
 * qui garde les tuiles à quelques kilo-octets (voir « Le poids »).
 *
 * ## Le motif ne doit pas se voir
 *
 * L'œil ne repère pas la répétition d'un grain régulier. Il repère un
 * **accident** — un grain plus gros, une fibre plus sombre, une zone plus
 * dense — revenu tous les 256 pixels, en grille. D'où trois règles, tenues
 * dans chaque recette :
 *
 *   1. **La densité est égale partout.** Les éléments sont tirés un par case
 *      d'une grille fine, à une place au hasard dans la case : jamais d'amas,
 *      jamais de vide. Un tirage libre sur toute la tuile fait des grappes, et
 *      une grappe répétée se voit d'un bout à l'autre du mur.
 *   2. **Rien à l'échelle de la tuile.** Pas de nuage, pas de tache, pas de
 *      dégradé : le premier essai de béton en avait, de vingt pixels, et on
 *      les retrouvait en quinconce sur tout le banc. La lumière du mur vient de
 *      la photo de tribune derrière lui, pas de la tuile.
 *   3. **Pas d'exception.** Tailles, opacités et longueurs sont tirées dans des
 *      plages étroites : le plus gros grain n'est qu'à peine plus gros que les
 *      autres.
 *
 * ## Le poids
 *
 * Quelques kilo-octets chacune, et c'est le grain qui coûte : un bruit est par
 * définition ce qui ne se comprime pas. Trois choses le tiennent. Chaque
 * famille de grain a sa teinte, une seule, donc la couleur ne coûte presque
 * rien et tout tient dans l'opacité — les deux teintes du béton et leurs
 * paliers tiennent en sept couleurs. L'opacité est arrondie à trente-deux
 * paliers — l'œil n'en distingue pas plus sur un voile à quelques pour cent.
 * Et l'essentiel de chaque tuile est transparent : le grain se compte en
 * points, pas en surface.
 *
 * Ce qui reste, c'est la place de chaque grain, et elle ne se comprime pas :
 * le béton de 512 pèse donc quatre fois celui de 256, une trentaine de
 * kilo-octets. C'est le prix d'un grain net sur un écran dense ; il n'est payé
 * que par ces écrans-là, une fois par an.
 *
 * ## Deux résolutions pour le béton
 *
 * Une tuile de 256 posée sur 256 pixels CSS est **agrandie** par le
 * navigateur sur un écran dense : deux à trois fois sur un téléphone, avec un
 * filtrage qui adoucit. Un grain d'un pixel y devient une tache floue de
 * trois — le premier béton, mesuré à DPR 3, n'avait plus de grain, il avait
 * des taches. La toile s'en moque (son relief est une bosse douce de quatre
 * pixels, que l'agrandissement ne change guère) ; le béton, fait de points
 * isolés, non. Le papier y perdrait la finesse de ses fibres, mais aucune
 * page ne pose encore de ticket : le jour où l'une le fera, sa recette,
 * écrite en pixels de 256, apprendra l'échelle comme celle du béton.
 *
 * Il existe donc aussi en 512 (`beton@2x`), **la même recette** tirée deux
 * fois plus fin : les mêmes cases en pixels de tuile, les mêmes couvertures,
 * les mêmes opacités. Un grain y vaut un pixel de l'écran à DPR 2, une fois
 * et demie à DPR 3 — net, ou presque. Les deux tuiles portent le même voile
 * moyen : un panneau ne change pas de teinte en changeant d'écran, ni ses
 * contrastes. La feuille de style les sert ensemble (`image-set`, 1x et 2x)
 * et le navigateur choisit.
 *
 * ## Les formats, et l'AVIF qui n'a le droit d'exister que s'il gagne
 *
 * WebP et PNG **sans perte**, dans `public/img/grain/`, comme les autres
 * familles (voir `VISUELS.md`). La feuille de style demande le WebP.
 *
 * L'AVIF, lui, est mis à l'épreuve avant d'être écrit, parce que le serveur
 * l'envoie à **tous** ceux qui l'annoncent dans `Accept`
 * (`src/server/images/index.js`) — c'est-à-dire à presque tout le monde. Un
 * AVIF plus lourd que le WebP serait un téléchargement de trop pour chaque
 * joueur, et c'est ce qu'il est sans perte : l'AV1 n'a ni la palette ni la
 * recherche de répétitions du WebP sans perte, et il paie le double, ou plus,
 * pour la même image. Avec perte, il pèse moins, mais il **efface le grain par
 * blocs** — et le bloc abîmé revient tous les 256 pixels : la répétition qu'on
 * vient d'éviter, ramenée par l'encodeur. Le banc l'a montré sur le béton, en
 * damier, à la qualité 60.
 *
 * Un AVIF n'est donc écrit que s'il pèse au plus le poids du WebP **et** qu'il
 * ne change pas l'image (voir `avifQuiGagne`). Sinon il n'y en a pas, l'ancien
 * est effacé, et le serveur, qui ne trouve pas de jumeau `.avif`, sert le WebP
 * à tout le monde : c'est son comportement prévu, pas un secours.
 *
 * ## Le même résultat à chaque passage
 *
 * Le hasard est semé : relancer le script réécrit **les mêmes pixels** — et
 * les mêmes octets, tant que `sharp` ne change pas de version. Une tuile n'a
 * donc jamais de différence fantôme dans le dépôt, et son adresse
 * reste bonne pour l'année de cache que lui donnent le serveur et le service
 * worker. Le jour où une recette change, l'adresse doit changer avec elle
 * (le `?v=` de son jeton `--grain-*` dans la feuille de style, sur ses deux
 * résolutions s'il en a deux) : une image servie « immutable » ne se
 * remplace pas autrement chez qui l'a déjà.
 *
 *   node scripts/grain-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CIBLE = path.join(RACINE, 'public', 'img', 'grain');

/**
 * Le côté d'une tuile, en pixels CSS.
 *
 * Posée à sa taille, elle couvre 256 pixels CSS : un téléphone de 360 de large
 * en voit moins d'une et demie, et la répétition n'a pas la place de faire
 * motif. Un pixel de tuile pour un pixel CSS, c'est aussi la taille d'un grain
 * qu'on voit sans le compter — la toile de la maquette avait son fil tous les
 * trois ou quatre pixels CSS, celle-ci aussi. Plus petite, la grille se
 * verrait ; plus grande, on paierait du poids pour un grain que personne ne
 * regarde. Le béton de 512 couvre les mêmes 256 pixels CSS, à deux pixels de
 * tuile par pixel CSS (voir « Deux résolutions pour le béton »).
 */
export const COTE = 256;

/** Ce qui est produit : `/img/grain/<nom>.webp` pour la feuille de style. */
export const TUILES = ['beton', 'toile', 'papier'];

/**
 * Les résolutions de chaque tuile : `1` écrit `<nom>.webp`, `2` écrit
 * `<nom>@2x.webp`, de côté 512, pour l'`image-set` de la feuille de style.
 * Seul le béton en a deux : c'est le seul grain fait de pixels isolés, que
 * l'agrandissement d'un écran dense transforme en taches.
 */
export const ECHELLES = { beton: [1, 2], toile: [1], papier: [1] };

/** Le nom de fichier d'une tuile à une échelle, sans l'extension. */
export const nomDeFichier = (nom, echelle = 1) => (echelle === 1 ? nom : `${nom}@${echelle}x`);

/** L'opacité est arrondie à 1/32 : voir « Le poids » dans l'en-tête. */
const PALIERS = 32;

/* ================================================================ l'outillage */

/**
 * Le hasard, semé.
 *
 * `Math.random()` réécrirait trois tuiles différentes à chaque passage, et le
 * dépôt verrait changer des images que personne n'a touchées. Celui-ci est un
 * mulberry32 : trente-deux bits d'état, assez pour du grain, et la même suite
 * pour la même graine sur toutes les machines.
 */
function hasard(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Un tirage en cloche (Box-Muller) : les écarts d'une matière ne sont pas plats. */
const cloche = (alea) => {
  let u = 0;
  while (u === 0) u = alea();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * alea());
};

const entre = (alea, min, max) => min + (max - min) * alea();
const borne = (v, min = 0, max = 1) => (v < min ? min : v > max ? max : v);

/**
 * Une coordonnée ramenée sur le tore : c'est toute la raison d'être des
 * raccords. `cote` ne change que pour le béton de 512.
 */
const tore = (v, cote = COTE) => ((v % cote) + cote) % cote;

const champ = (cote = COTE) => new Float32Array(cote * cote);

/**
 * Un flou qui fait le tour.
 *
 * Trois passes de moyenne glissante approchent un flou gaussien, et l'indice
 * est pris sur le tore : la colonne 0 est moyennée avec la dernière. Un
 * flou ordinaire, qui s'arrête au bord, foncerait ou éclaircirait les quatre
 * bords — la couture qu'on cherche à éviter. Il sert à l'épreuve de l'AVIF,
 * qui regarde l'image comme l'œil regarde un mur : de loin.
 */
function flou(source, rayon, cote = COTE) {
  const t = (v) => tore(v, cote);
  const a = Float32Array.from(source);
  const b = champ(cote);
  const n = 2 * rayon + 1;
  for (let passe = 0; passe < 3; passe++) {
    for (let y = 0; y < cote; y++) {
      const ligne = y * cote;
      let s = 0;
      for (let k = -rayon; k <= rayon; k++) s += a[ligne + t(k)];
      for (let x = 0; x < cote; x++) {
        b[ligne + x] = s / n;
        s += a[ligne + t(x + rayon + 1)] - a[ligne + t(x - rayon)];
      }
    }
    for (let x = 0; x < cote; x++) {
      let s = 0;
      for (let k = -rayon; k <= rayon; k++) s += b[t(k) * cote + x];
      for (let y = 0; y < cote; y++) {
        a[y * cote + x] = s / n;
        s += b[t(y + rayon + 1) * cote + x] - b[t(y - rayon) * cote + x];
      }
    }
  }
  return a;
}

const ecartType = (f) => {
  let m = 0;
  for (const v of f) m += v;
  m /= f.length;
  let e = 0;
  for (const v of f) e += (v - m) ** 2;
  return Math.sqrt(e / f.length);
};

/**
 * Une courbe de 256 valeurs qui se referme sur elle-même, d'écart type un :
 * l'épaisseur d'un fil le long de son passage. Fermée, parce que le fil sort
 * en bas de la tuile et rentre en haut.
 */
function courbe(alea, rayon) {
  let a = Float32Array.from({ length: COTE }, () => cloche(alea));
  for (let passe = 0; passe < 3; passe++) {
    const b = new Float32Array(COTE);
    let s = 0;
    for (let k = -rayon; k <= rayon; k++) s += a[tore(k)];
    for (let i = 0; i < COTE; i++) {
      b[i] = s / (2 * rayon + 1);
      s += a[tore(i + rayon + 1)] - a[tore(i - rayon)];
    }
    a = b;
  }
  const e = ecartType(a) || 1;
  return a.map((v) => v / e);
}

/**
 * Pose une opacité, en recouvrement : deux voiles à 20 % font 36 %, pas 40.
 * C'est ce que ferait de l'encre, et c'est ce qui empêche deux fibres croisées
 * de faire un point noir.
 */
const recouvrir = (f, x, y, alpha) => {
  const i = tore(y) * COTE + tore(x);
  f[i] = 1 - (1 - f[i]) * (1 - alpha);
};

/** La distance d'un point à un segment : le corps d'une fibre. */
function distanceSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const t = borne(((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1));
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
}

/**
 * Une fibre : une ligne brisée, fine, antialiasée, sur le tore.
 *
 * Chaque pixel prend la distance au **plus proche** des segments, et non une
 * somme : sans ça, chaque articulation d'une fibre ferait un nœud plus sombre.
 */
function fibre(f, points, demiLargeur, alpha) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const marge = demiLargeur + 1;
  for (let y = Math.floor(Math.min(...ys) - marge); y <= Math.ceil(Math.max(...ys) + marge); y++) {
    for (let x = Math.floor(Math.min(...xs) - marge); x <= Math.ceil(Math.max(...xs) + marge); x++) {
      let d = Infinity;
      for (let k = 1; k < points.length; k++) {
        const [ax, ay] = points[k - 1];
        const [bx, by] = points[k];
        d = Math.min(d, distanceSegment(x + 0.5, y + 0.5, ax, ay, bx, by));
      }
      const couverture = borne(demiLargeur + 0.5 - d);
      if (couverture > 0) recouvrir(f, x, y, alpha * couverture);
    }
  }
}

/**
 * Une case par élément, une place au hasard dans la case.
 *
 * C'est la règle 1 de l'en-tête : la densité est la même partout. `pas` doit
 * diviser le côté, sinon la dernière rangée serait plus serrée que les
 * autres — et elle reviendrait à chaque tuile, comme une couture.
 */
function* parCases(alea, pas, probabilite, cote = COTE) {
  for (let cy = 0; cy < cote; cy += pas) {
    for (let cx = 0; cx < cote; cx += pas) {
      if (alea() < probabilite) yield [cx + alea() * pas, cy + alea() * pas];
    }
  }
}

/* ============================================================== les recettes

   Chacune rend son `cote` et ses `couches` : une par famille de grain, un
   champ d'opacité entre 0 et 1 (le `voile`) et sa `teinte`. Les opacités
   sont écrites en pour cent dans les commentaires, parce que c'est l'unité
   dans laquelle on les juge à l'écran. */

/**
 * Le béton : le mur, et le panneau calme.
 *
 * Deux familles, et des grains d'**un pixel**, jamais un point rond
 * antialiasé : un point antialiasé s'étale sur quatre pixels, et un écran
 * dense l'agrandit encore (voir « Deux résolutions pour le béton »).
 *
 *   — **le sable**, clair et serré : un grain par case de 2 px, sept fois sur
 *     dix (17 % des pixels), à 3 % (un palier), à 6 % une fois sur dix (deux
 *     paliers). Jamais plus de 8 % : un pixel clair isolé plus fort, sur un
 *     fond presque noir, se lit comme une étoile — le premier béton allait
 *     jusqu'à 19 %, sur 9 % des pixels, et c'est ce qu'on y voyait ;
 *   — **les creux**, noirs : un par case de 4 px, une case sur deux (3 % des
 *     pixels), de 16 à 25 % (cinq à huit paliers). Plus marqués que le sable,
 *     parce que du noir sur un fond presque noir se voit à peine — ils se
 *     lisent surtout là où la photo de tribune éclaire le mur, comme les
 *     trous d'un béton brut. Sur le panneau calme, presque noir et opaque,
 *     ils ne se voient guère : il garde le sable seul, comme le panneau de
 *     la maquette, qui n'avait que des points clairs. Un creux tombé sur un
 *     grain de sable le remplace (voir `enPixels`).
 *
 * Le voile moyen reste minuscule : 0,6 % de clair, 0,6 % de sombre. Sur un
 * fond presque noir, c'est le clair qui compte, et il éclaire d'un niveau et
 * demi sur 255, à peine plus que le premier béton (0,4 %).
 *
 * C'est tout : pas de pore plus gros, pas de tache, pas de nuage. Un béton
 * plus « riche » a été essayé, et ses accidents faisaient motif (règle 2).
 * Les pas des cases sont en pixels **de tuile** : à l'échelle 2, la même
 * recette pose quatre fois plus de grains quatre fois plus petits, donc la
 * même couverture et le même voile moyen.
 */
function beton(echelle = 1) {
  const cote = COTE * echelle;
  const alea = hasard(0xBE7011);
  const sable = champ(cote);
  const creux = champ(cote);
  const poser = (voile, [x, y], alpha) => { voile[Math.floor(y) * cote + Math.floor(x)] = alpha; };

  for (const place of parCases(alea, 2, 0.7, cote)) {
    poser(sable, place, (alea() < 0.1 ? 2 : 1) / PALIERS);
  }
  for (const place of parCases(alea, 4, 0.5, cote)) {
    poser(creux, place, (5 + Math.floor(alea() * 4)) / PALIERS);
  }

  return {
    cote,
    couches: [
      { voile: sable, teinte: [255, 255, 255] },
      { voile: creux, teinte: [0, 0, 0] },
    ],
  };
}

/**
 * La toile : la bâche, posée sur la couleur de sa face.
 *
 * Une toile tissée, fil dessus fil dessous, au pas de quatre pixels environ
 * — celui de la maquette, qui tramait la bâche de lignes à 3 et 4 px. Le pas
 * varie de 3 à 5 d'un fil à l'autre, l'épaisseur de chaque fil ondule le long
 * de son passage, et quelques fils sont un rien plus clairs ou plus foncés :
 * c'est ce qui fait une bâche et non un quadrillage.
 *
 * Elle doit rester **légère** : la craie du lettrage se lit dessus, et le lot 0
 * a mesuré chaque contraste sur une face unie. Le creux entre deux fils fonce
 * d'une dizaine de pour cent au plus, et le dos d'un fil est laissé tel quel
 * — un voile blanc pour l'éclairer coûterait une seconde teinte (voir « Le
 * poids ») pour quelques pour cent que personne ne voit sur une face claire.
 */
function toile() {
  const alea = hasard(0x701E);

  /* Les fils : 64 dans chaque sens, au pas moyen de 4, dont on déplace des
     pixels d'un fil à l'autre sans jamais sortir de 3 à 5. La somme reste
     exactement 256 — un pixel de plus ou de moins, et la trame ne se
     raccorderait plus au bord. Le nombre de fils reste pair, pour que le
     dessus-dessous de l'armure se suive aussi à travers le raccord. */
  const pasDesFils = () => {
    const l = new Array(COTE / 4).fill(4);
    for (let k = 0; k < 160; k++) {
      const i = Math.floor(alea() * l.length);
      const j = Math.floor(alea() * l.length);
      if (i !== j && l[i] < 5 && l[j] > 3) { l[i]++; l[j]--; }
    }
    // Pour chaque pixel : son fil, et sa place en travers du fil (0 à 1).
    const fil = new Int32Array(COTE);
    const travers = new Float32Array(COTE);
    let x = 0;
    l.forEach((largeur, n) => {
      for (let k = 0; k < largeur; k++, x++) { fil[x] = n; travers[x] = (k + 0.5) / largeur; }
    });
    return { nombre: l.length, fil, travers };
  };
  const chaine = pasDesFils(); // les fils verticaux
  const trame = pasDesFils();  // les fils horizontaux

  /* Un fil sur cinq, un rien plus clair ou plus foncé : la bâche « barrée »
     des toiles bon marché. L'écart reste petit, et c'est la règle 3 : une
     rayure qui se voit revient tous les 256 pixels, et deux rayures qui
     reviennent font une grille. */
  const nuanceDe = (n) => Array.from({ length: n }, () => (alea() < 0.2 ? cloche(alea) * 0.11 : 0));
  const nuanceChaine = nuanceDe(chaine.nombre);
  const nuanceTrame = nuanceDe(trame.nombre);
  const ondeChaine = Array.from({ length: chaine.nombre }, () => courbe(alea, 6));
  const ondeTrame = Array.from({ length: trame.nombre }, () => courbe(alea, 6));

  const voile = champ();
  const bosse = (t) => Math.sin(Math.PI * t);

  for (let y = 0; y < COTE; y++) {
    const j = trame.fil[y];
    const v = trame.travers[y];
    for (let x = 0; x < COTE; x++) {
      const i = chaine.fil[x];
      const u = chaine.travers[x];
      // L'armure toile : le fil de chaîne passe dessus une case sur deux.
      const dessusChaine = (i + j) % 2 === 0;
      // Le fil du dessus se bombe en travers (ses bords plongent vers le
      // creux) et le long de son passage (il sort, puis replonge).
      const travers = dessusChaine ? u : v;
      const long = dessusChaine ? v : u;
      const epaisseur = dessusChaine ? ondeChaine[i][y] : ondeTrame[j][x];
      const relief = 0.7 * bosse(borne(0.5 + (travers - 0.5) * (1 - 0.12 * epaisseur)))
        + 0.3 * bosse(long);
      const nuance = dessusChaine ? nuanceChaine[i] : nuanceTrame[j];
      const creux = (0.68 - relief) * 1.6 - nuance;
      if (creux > 0) voile[y * COTE + x] = borne(creux * 0.11, 0, 0.12);
    }
  }

  return { cote: COTE, couches: [{ voile, teinte: [0, 0, 0] }] };
}

/**
 * Le papier : le kraft des tickets.
 *
 * Des fibres courtes, couchées pour la plupart dans le sens de la machine (à
 * l'horizontale, à une dizaine de degrés près), quelques-unes dans tous les
 * sens, chacune légèrement courbe.
 *
 * Le texte d'un ticket est à l'encre, en petit corps : aucune fibre n'atteint
 * un pixel d'épaisseur ni 15 % d'opacité, sinon elle couperait une lettre.
 */
function papier() {
  const alea = hasard(0x9A91E7);
  const voile = champ();

  for (const [x, y] of parCases(alea, 8, 0.8)) {
    const couchee = alea() < 0.85;
    let angle = couchee ? cloche(alea) * 0.15 : alea() * Math.PI;
    const longueur = entre(alea, 5, 11);
    const morceaux = 3;
    // On part d'un bout et on dessine vers l'autre, la case au milieu : la
    // fibre reste centrée sur sa case, et la densité suit la grille.
    let px = x - (Math.cos(angle) * longueur) / 2;
    let py = y - (Math.sin(angle) * longueur) / 2;
    const points = [[px, py]];
    for (let k = 0; k < morceaux; k++) {
      angle += cloche(alea) * 0.18; // une fibre n'est jamais tout à fait droite
      px += (Math.cos(angle) * longueur) / morceaux;
      py += (Math.sin(angle) * longueur) / morceaux;
      points.push([px, py]);
    }
    fibre(voile, points, entre(alea, 0.25, 0.4), entre(alea, 0.08, 0.15));
  }

  return { cote: COTE, couches: [{ voile, teinte: [58, 38, 14] }] };
}

export const RECETTES = { beton, toile, papier };

/* ============================================================ la mise en pixels */

/**
 * Des couches → une image RVBA brute.
 *
 * Un pixel prend la teinte et l'opacité de la **dernière** couche qui y pose
 * quelque chose : un creux du béton remplace le grain de sable tombé au même
 * endroit, au lieu de s'y mêler en un gris — une troisième teinte, que
 * l'encodeur paierait.
 *
 * Sous les pixels transparents, c'est la teinte de la **première** couche qui
 * est écrite : le plan de couleur est alors une constante, qu'un encodeur code
 * pour rien, hormis aux pixels d'une autre famille. Laissé à zéro sous la
 * transparence, un voile blanc deviendrait un semis de pics blancs sur du noir
 * — le motif le plus cher qui soit pour un encodeur.
 *
 * L'opacité est arrondie à 1/32 (des marches de trois pour cent), et tout ce
 * qui est sous un palier disparaît : un pixel à 1 % ne se voit pas, mais il
 * coûte autant qu'un autre.
 */
function enPixels({ cote, couches }) {
  const n = cote * cote;
  const rvba = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    let teinte = couches[0].teinte;
    let alpha = 0;
    for (const couche of couches) {
      const palier = Math.round(couche.voile[i] * PALIERS);
      if (palier > 0) { teinte = couche.teinte; alpha = palier / PALIERS; }
    }
    rvba[i * 4] = teinte[0];
    rvba[i * 4 + 1] = teinte[1];
    rvba[i * 4 + 2] = teinte[2];
    rvba[i * 4 + 3] = Math.round(alpha * 255);
  }
  return rvba;
}

/**
 * Les pixels d'une tuile, en RVBA brut : ce que les encodeurs reçoivent. Une
 * recette qui n'a qu'une résolution ignore l'échelle.
 */
export const pixels = (nom, echelle = 1) => enPixels(RECETTES[nom](echelle));

const brutDe = (cote) => ({ raw: { width: cote, height: cote, channels: 4 } });

/** Ce que l'œil voit d'un pixel de tuile posé sur un gris moyen, signé. */
const lumiere = (rvba, i) => (rvba[i * 4 + 3] / 255)
  * (0.2126 * rvba[i * 4] + 0.7152 * rvba[i * 4 + 1] + 0.0722 * rvba[i * 4 + 2] - 127.5);

/**
 * L'AVIF, seulement s'il gagne.
 *
 * On essaie de la meilleure qualité vers la moins bonne, et on garde la
 * première qui tient les deux conditions de l'en-tête :
 *
 *   — **pas plus lourd que le WebP**, sinon il coûte à presque tous les
 *     joueurs (le serveur le préfère dès qu'il existe) ;
 *   — **la même image**. L'erreur est mesurée sur deux plans : l'opacité, et
 *     la lumière que chaque pixel porte sur un gris moyen (son opacité fois
 *     l'écart de sa teinte à ce gris). Le second ne dit presque rien de plus
 *     quand la tuile n'a qu'une teinte ; il est là pour le béton, dont l'encodeur
 *     pourrait mêler le sable clair et les creux noirs en grains gris, à
 *     opacité égale — le mur perdrait ses creux sans qu'aucune opacité ait
 *     bougé. Chaque plan est jugé de deux façons : pixel à pixel, et après un
 *     flou de quelques pixels, qui est la distance à laquelle on regarde un
 *     mur. La seconde est celle qui compte : un bloc éclairci par la
 *     compression ne change presque aucun pixel, mais il revient à chaque
 *     tuile, et c'est lui qu'on voit. Toutes doivent rester sous le dixième
 *     de ce que la tuile contient elle-même.
 *
 * Le flou est de cinq pixels de tuile à l'échelle 1, et grandit avec elle :
 * on regarde le mur de la même distance, quelle que soit la tuile servie.
 *
 * Rend `null` quand aucune qualité ne tient le tout : il n'y aura pas d'AVIF.
 */
async function avifQuiGagne(sharp, brut, cote, poidsWebp) {
  const rayon = 5 * (cote / COTE);
  const plans = (rvba) => [
    Float32Array.from({ length: cote * cote }, (_, i) => rvba[i * 4 + 3]),
    Float32Array.from({ length: cote * cote }, (_, i) => lumiere(rvba, i)),
  ];
  const references = plans(brut).map((plan) => ({
    plan,
    dePres: ecartType(plan),
    deLoin: ecartType(flou(plan, rayon, cote)),
  }));

  for (const qualite of [90, 80, 70, 60]) {
    const avif = await sharp(brut, brutDe(cote)).avif({ quality: qualite, effort: 9 }).toBuffer();
    if (avif.length > poidsWebp) continue;
    const { data } = await sharp(avif).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const fidele = plans(data).every((decode, k) => {
      const { plan, dePres, deLoin } = references[k];
      const erreur = decode.map((v, i) => v - plan[i]);
      return ecartType(erreur) <= 0.1 * dePres && ecartType(flou(erreur, rayon, cote)) <= 0.1 * deLoin;
    });
    if (fidele) return { avif, qualite };
  }
  return null;
}

/* ================================================================ l'exécution

   Seulement quand on lance le script à la main, comme `logo-images.mjs` : un
   contrôle qui voudrait un jour lire `TUILES` ne doit pas réécrire les tuiles
   à chaque import. `pathToFileURL` et non une comparaison de chaînes — sous
   Windows, `process.argv[1]` arrive en `C:\…` et `import.meta.url` en
   `file:///C:/…`. */

const lanceALaMain = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (lanceALaMain) {
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    console.error('sharp est absent. Sur ton PC : npm install');
    process.exitCode = 1;
  }

  if (sharp) {
    fs.mkdirSync(CIBLE, { recursive: true });
    const ko = (octets) => `${(octets / 1024).toFixed(1)} ko`;

    let ecrites = 0;
    for (const nom of TUILES) {
      for (const echelle of ECHELLES[nom]) {
        const cote = COTE * echelle;
        const brut = pixels(nom, echelle);
        const nomFichier = nomDeFichier(nom, echelle);
        const fichier = (ext) => path.join(CIBLE, `${nomFichier}.${ext}`);

        /* Sans perte, les deux : un encodeur avec perte lisse précisément ce
           qu'on a fabriqué, le grain étant le détail le plus fin de l'image.
           Le PNG est en palette exacte — trente-trois couleurs au plus par
           teinte, les paliers et le transparent — et sans tramage, qui
           ajouterait son propre bruit. */
        const webp = await sharp(brut, brutDe(cote)).webp({ lossless: true, effort: 6 }).toBuffer();
        const png = await sharp(brut, brutDe(cote))
          .png({ palette: true, colours: 256, dither: 0, compressionLevel: 9, effort: 10 })
          .toBuffer();
        fs.writeFileSync(fichier('webp'), webp);
        fs.writeFileSync(fichier('png'), png);

        const gagnant = await avifQuiGagne(sharp, brut, cote, webp.length);
        let avif;
        if (gagnant) {
          fs.writeFileSync(fichier('avif'), gagnant.avif);
          avif = `avif ${ko(gagnant.avif.length)} (qualité ${gagnant.qualite})`;
        } else {
          // Un AVIF d'un passage précédent serait servi à sa place : on l'efface.
          fs.rmSync(fichier('avif'), { force: true });
          avif = 'pas d’avif : aucun ne bat le WebP sans abîmer le grain';
        }
        console.log(`  ok   ${nomFichier.padEnd(9)} ${cote}×${cote} · webp ${ko(webp.length)} · png ${ko(png.length)} · ${avif}`);
        ecrites++;
      }
    }

    console.log(`\n${ecrites} tuiles écrites dans public/img/grain.`);
    console.log('Une recette changée ? Change aussi l’adresse dans la feuille de style (?v=…).');
  }
}
