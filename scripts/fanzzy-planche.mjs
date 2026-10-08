/**
 * Une planche d'expressions, découpée en sources pour `fanzzy-art.mjs`.
 *
 * ## Pourquoi
 *
 * Artlist fait payer une image, pas un personnage. Une planche où le même
 * Fanzzy prend ses quatre expressions (joie, dépit, pousse, colère) coûte une
 * image au lieu de quatre, et sur les mille trois cents expressions qui
 * manquent, c'est la plus grosse économie possible.
 *
 * ## Ce qu'il fait
 *
 *   npm run planche -- RP3 2 base <planche.png>
 *
 * La planche porte six figures, lues de gauche à droite puis de haut en bas :
 * le repos, joie, dépit, pousse, colère, et une sixième qu'on laisse (le
 * prompt la demande pour essayer d'en tirer un clignement). Le repos est
 * **dans** la planche : les cinq images d'un âge sortent alors du même tirage
 * et se ressemblent, ce qu'une planche d'expressions posée à côté d'une carte
 * générée un autre jour ne garantit pas — le premier essai, sur Fût Rodé, en
 * est sorti plus gros et avec une tête plus grande que sa carte.
 *
 *   npm run planche -- RP3 2 base <planche.png> --repos <repos.png>
 *
 * Variante : quatre expressions seules, mises à l'échelle d'un repos à part.
 *
 * 1. Détoure la planche : le fond uni (vert ou magenta, lu sur les bords)
 *    devient transparent, avec un bord adouci, et la couleur du fond est
 *    retirée des pixels du bord — sans quoi un liseré magenta resterait
 *    autour du personnage.
 * 2. Trouve les personnages, lus de gauche à droite puis de haut en bas,
 *    dans l'ordre du prompt.
 * 3. Les met **sur les pieds du repos**, et à son échelle s'il vient d'une
 *    autre image. C'est le point délicat : `fanzzy-art.mjs` cadre tous les
 *    états d'un âge dans une seule boîte, et ne compare que des images de
 *    même taille où le personnage est dessiné à la même échelle.
 *
 *    Avec un repos à part, l'échelle se prend sur la hauteur du personnage **dans l'axe de ses
 *    jambes**, des pieds au sommet de la tête : un bras levé ou une mailloche
 *    tendue ne comptent pas. La planche demande la même échelle aux quatre
 *    figures ; on en prend la médiane, et une seule échelle vaut pour toute
 *    la planche, pour qu'un personnage accroupi reste plus petit qu'un
 *    personnage debout.
 * 4. Écrit les cinq sources de cet âge dans `art/<ID>/_src/`, toutes à la
 *    même taille, le repos compris : `npm run art art/<ID>/_src` fait le
 *    reste.
 *
 * `--ordre neutre,joie,depit,pousse,colere,-` change l'ordre si la planche
 * en suit un autre (`-` : figure laissée) ; `--echelle 1.1` corrige l'échelle trouvée si l'œil n'est pas
 * d'accord ; `--sortie <dossier>` écrit ailleurs que dans `art/<ID>/_src/` ;
 * `--lueur`, sur fond magenta, rend sa couleur chaude à une aura devenue rose.
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { ETATS_DESSINES } from '../src/shared/fanzzy/rendus.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

/* Le détourage. En dessous de SEUIL_BAS (distance à la couleur du fond, sur
   les trois canaux), c'est du fond ; au-dessus de SEUIL_HAUT, c'est le
   personnage ; entre les deux, le bord, en demi-teinte. Un générateur rend un
   fond uni à quelques unités près : quarante laisse passer ce bruit. */
const SEUIL_BAS = 40;
const SEUIL_HAUT = 110;
/* Une composante plus petite que ce rapport à la plus grande n'est pas un
   personnage : c'est une mailloche détachée, une goutte, un reste de fond. On
   la rattache au personnage le plus proche. */
const PART_FIGURE = 0.12;
/* La bande, autour de l'axe des jambes, où l'on cherche le haut de la tête. */
const BANDE = 0.1;

const args = process.argv.slice(2);
const drapeau = (nom) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : null;
};
const SANS_VALEUR = ['--lueur'];
const libres = args.filter((a, i) => !a.startsWith('--')
  && (!args[i - 1]?.startsWith('--') || SANS_VALEUR.includes(args[i - 1])));
/* `--lueur` : le Fanzzy a une aura lumineuse, rendue rose par le magenta. */
const LUEUR = args.includes('--lueur');
const [ID, AGE, TENUE, PLANCHE] = libres;
const REPOS = drapeau('repos');
/* Sans `--repos`, le repos est dans la planche : c'est la meilleure façon de
   faire, les cinq images sortent du même tirage et se ressemblent. La planche
   de six cases porte alors, dans l'ordre de lecture, le repos, les quatre
   expressions, et une sixième figure qu'on laisse (`-`). */
const ORDRE_DEFAUT = REPOS ? ETATS_DESSINES : ['neutre', ...ETATS_DESSINES, '-'];
const ORDRE = (drapeau('ordre') ?? ORDRE_DEFAUT.join(',')).split(',');
const ECHELLE = Number(drapeau('echelle') ?? 1);
const SORTIE = path.resolve(drapeau('sortie') ?? path.join(RACINE, 'art', ID ?? '', '_src'));

if (!ID || !/^\d$/.test(AGE ?? '') || !TENUE || !PLANCHE) {
  console.error(`Usage : npm run planche -- <ID> <âge> <tenue> <planche.png> [--repos <repos.png>]
  [--ordre neutre,${ETATS_DESSINES.join(',')},-] [--echelle 1] [--sortie art/<ID>/_src]

  RP3 2 base planche.png
    planche de six cases (repos, quatre expressions, une figure laissée) :
    écrit les cinq sources de Fût Rodé dans art/RP3/_src/RP3-e2-base-<état>.png.

  RP3 2 base planche.png --repos RP3B-source.png
    planche des quatre expressions seules, mises à l'échelle d'un repos à part.`);
  process.exit(1);
}
for (const e of ORDRE) {
  if (e !== '-' && !(e === 'neutre' && !REPOS) && !ETATS_DESSINES.includes(e)) {
    console.error(`« ${e} » n'est pas un état dessiné (${ETATS_DESSINES.join(', ')}).`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------ détourage */

/** La couleur du fond : la médiane, canal par canal, des pixels du bord. */
function couleurDuFond(px, l, h) {
  const r = [], g = [], b = [];
  const prendre = (x, y) => { const i = (y * l + x) * 4; r.push(px[i]); g.push(px[i + 1]); b.push(px[i + 2]); };
  for (let x = 0; x < l; x += 4) { prendre(x, 0); prendre(x, h - 1); }
  for (let y = 0; y < h; y += 4) { prendre(0, y); prendre(l - 1, y); }
  const med = (t) => t.sort((a, c) => a - c)[t.length >> 1];
  return [med(r), med(g), med(b)];
}

/**
 * Rend le fond transparent, sur place.
 *
 * Un pixel du bord est un mélange du personnage et du fond. Garder sa couleur
 * telle quelle, c'est garder un peu de magenta : on le retire, en sachant
 * combien il y en a (1 − alpha), et il reste la couleur du personnage.
 */
function detourer(px, l, h, fond) {
  const [fr, fg, fb] = fond;
  const n2 = fr * fr + fg * fg + fb * fb;
  const vert = fg > fr && fg > fb;
  const orig = vert ? null : px.slice();
  for (let p = 0; p < l * h; p++) {
    const i = p * 4;
    let d = Math.hypot(px[i] - fr, px[i + 1] - fg, px[i + 2] - fb);
    /* L'ombre au sol est le fond assombri (k fois sa couleur) : c'est du fond.
       Le jeu dessine sa propre ombre sous le Fanzzy. */
    const k = (px[i] * fr + px[i + 1] * fg + px[i + 2] * fb) / n2;
    let ref = fond;
    if (k >= 0.35 && k < 1) {
      // Seulement une ombre franche : un gris foncé (un pantalon) en est loin.
      const dk = Math.hypot(px[i] - k * fr, px[i + 1] - k * fg, px[i + 2] - k * fb);
      if (dk < SEUIL_BAS / 2 && dk < d) { d = dk; ref = fond.map((c) => k * c); }
    }
    if (!vert && ref === fond) {
      /* Sur le magenta, l'ombre perd son vert plus vite que le reste : on la
         reconnaît au rapport rouge/bleu du fond, avec moins de vert que lui. */
      const kb = (px[i] * fr + px[i + 2] * fb) / (fr * fr + fb * fb);
      if (kb >= 0.3 && kb < 1 && px[i + 1] <= kb * fg + 5) {
        const dk = Math.hypot(px[i] - kb * fr, px[i + 2] - kb * fb);
        if (dk < SEUIL_BAS / 2 && dk < d) { d = dk; ref = [kb * fr, Math.min(px[i + 1], kb * fg), kb * fb]; }
      }
    }
    const a = Math.min(1, Math.max(0, (d - SEUIL_BAS) / (SEUIL_HAUT - SEUIL_BAS)));
    if (a < 1 && a > 0) {
      for (let c = 0; c < 3; c++) {
        const v = (px[i + c] - (1 - a) * ref[c]) / a;
        px[i + c] = Math.min(255, Math.max(0, Math.round(v)));
      }
    }
    /* Une aura est une lueur, pas un mélange : elle garde un reflet du fond
       que le calcul du bord ne retire pas. Le Fanzzy ne porte jamais la
       couleur de son fond (le prompt le demande), on la retire partout. */
    if (vert) {
      // Au bord, la lueur prend sa couleur chaude ; dedans, le vert est retiré.
      const [hi, lo] = px[i] > px[i + 2] ? [px[i], px[i + 2]] : [px[i + 2], px[i]];
      const plafond = a < 1 ? (hi + lo) / 2 : 0.75 * hi + 0.25 * lo;
      px[i + 1] = Math.min(px[i + 1], Math.round(plafond));
    }
    else if (a < 1) {
      // Le violet d'une tenue ressemble au magenta : on ne touche qu'au bord.
      const trop = Math.min(px[i], px[i + 2]) - px[i + 1];
      if (trop > 0) { px[i] -= trop; px[i + 2] -= trop; }
      // Une lueur chaude (plus rouge que bleue) garde du rose : son bleu vient du fond.
      if (px[i] > px[i + 2]) px[i + 2] = Math.min(px[i + 2], px[i + 1]);
    }
    px[i + 3] = Math.round(a * px[i + 3]);
  }
  if (!vert && LUEUR) lueurSurMagenta(px, orig, l, h, fond);
}

/* Une lueur chaude rendue sur le magenta en devient rose, et assez loin du
   fond pour paraître opaque. Avec `--lueur`, près du bord seulement (une joue
   rose est loin dedans), on la lit comme une lueur orangée (bleu = moitié du
   vert) posée sur le fond : on en tire sa transparence et sa vraie couleur.
   Sans l'option, un jean lavande ou une frange rose resteraient intacts. */
const BORD_LUEUR = 200;
function lueurSurMagenta(px, orig, l, h, [fr, fg, fb]) {
  const dist = new Uint8Array(l * h).fill(255);
  let file = [];
  for (let p = 0; p < l * h; p++) if (px[p * 4 + 3] < 128) { dist[p] = 0; file.push(p); }
  for (let n = 1; n <= BORD_LUEUR && file.length; n++) {
    const suite = [];
    for (const p of file) {
      const x = p % l;
      for (const q of [p - 1, p + 1, p - l, p + l]) {
        if (q < 0 || q >= l * h || dist[q] !== 255) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === l - 1)) continue;
        dist[q] = n; suite.push(q);
      }
    }
    file = suite;
  }
  const mf = fb - 0.5 * fg;
  for (let p = 0; p < l * h; p++) {
    if (dist[p] > BORD_LUEUR || px[p * 4 + 3] === 0) continue;
    const i = p * 4;
    const [r, g, b] = [orig[i], orig[i + 1], orig[i + 2]];
    if (b - g < 25 || r <= b || r - g < 80) continue;
    const f = Math.min(1, Math.max(0, (b - 0.5 * g) / mf));
    const a = 1 - f;
    if (a < 0.02) { px[i + 3] = 0; continue; }
    px[i] = Math.min(255, Math.round((r - f * fr) / a));
    px[i + 1] = Math.min(255, Math.max(0, Math.round((g - f * fg) / a)));
    px[i + 2] = Math.min(255, Math.max(0, Math.round((b - f * fb) / a)));
    px[i + 3] = Math.min(px[i + 3], Math.round(a * 255));
  }
}

async function lire(fichier) {
  const { data, info } = await sharp(fichier).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const px = new Uint8ClampedArray(data);
  const l = info.width, h = info.height;
  // Une source déjà détourée garde sa transparence : elle est exacte.
  let transparent = false;
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { transparent = true; break; }
  if (!transparent) detourer(px, l, h, couleurDuFond(px, l, h));
  return { px, l, h };
}

/* ------------------------------------------------------- les personnages */

/** Les composantes connexes du masque (alpha > moitié), avec leur boîte. */
function composantes(px, l, h) {
  const etiq = new Int32Array(l * h).fill(-1);
  const liste = [];
  const pile = [];
  for (let p = 0; p < l * h; p++) {
    if (etiq[p] >= 0 || px[p * 4 + 3] < 128) continue;
    const c = { n: 0, x0: l, y0: h, x1: -1, y1: -1, id: liste.length };
    etiq[p] = c.id; pile.push(p);
    while (pile.length) {
      const q = pile.pop();
      const x = q % l, y = (q - x) / l;
      c.n++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (const v of [x > 0 ? q - 1 : -1, x < l - 1 ? q + 1 : -1, y > 0 ? q - l : -1, y < h - 1 ? q + l : -1]) {
        if (v >= 0 && etiq[v] < 0 && px[v * 4 + 3] >= 128) { etiq[v] = c.id; pile.push(v); }
      }
    }
    liste.push(c);
  }
  return { etiq, liste };
}

/**
 * Le personnage dont un morceau détaché touche presque un pixel : on s'étend
 * autour du morceau, pas à pas. Une boîte ne suffit pas : la semelle d'une
 * figure de la rangée du haut tombe dans la boîte de la figure d'en dessous
 * quand celle-ci lève un mégaphone.
 */
function plusProche(c, etiq, l, h, proprietaire) {
  const vu = new Set();
  let front = [];
  for (let y = c.y0; y <= c.y1; y++) for (let x = c.x0; x <= c.x1; x++) {
    const p = y * l + x;
    if (etiq[p] === c.id) { vu.add(p); front.push(p); }
  }
  for (let pas = 0; pas < 80 && front.length; pas++) {
    const suivant = [];
    for (const q of front) {
      const x = q % l, y = (q - x) / l;
      for (const v of [x > 0 ? q - 1 : -1, x < l - 1 ? q + 1 : -1, y > 0 ? q - l : -1, y < h - 1 ? q + l : -1]) {
        if (v < 0 || vu.has(v)) continue;
        vu.add(v);
        const o = etiq[v] >= 0 ? proprietaire.get(etiq[v]) : null;
        if (o && etiq[v] === o.id) return o;
        suivant.push(v);
      }
    }
    front = suivant;
  }
  return null;
}

function parBoite(c, grands, centre) {
  const [cx, cy] = centre(c);
  let meilleur = null, dmin = Infinity;
  for (const g of grands) {
    const dx = Math.max(g.x0 - cx, 0, cx - g.x1), dy = Math.max(g.y0 - cy, 0, cy - g.y1);
    const d = Math.hypot(dx, dy);
    if (d < dmin) { dmin = d; meilleur = g; }
  }
  return meilleur;
}

/** Les personnages d'une image : les grosses composantes, et ce qui s'y rattache. */
function personnages(img) {
  const { px, l, h } = img;
  const { etiq, liste } = composantes(px, l, h);
  const max = Math.max(...liste.map((c) => c.n));
  const grands = liste.filter((c) => c.n >= max * PART_FIGURE);
  const centre = (c) => [(c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2];
  const proprietaire = new Map(grands.map((g) => [g.id, g]));
  for (const c of liste) {
    if (proprietaire.has(c.id) || c.n < 30) continue;
    proprietaire.set(c.id, plusProche(c, etiq, l, h, proprietaire) ?? parBoite(c, grands, centre));
  }
  return grands.map((g) => {
    const ids = new Set([...proprietaire].filter(([, o]) => o === g).map(([id]) => id));
    let x0 = l, y0 = h, x1 = -1, y1 = -1;
    for (const c of liste) if (ids.has(c.id)) {
      x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1);
    }
    return { ids, x0, y0, x1, y1, etiq };
  });
}

/**
 * Où sont ses pieds, et quelle taille il fait.
 *
 * L'axe : le milieu de ce qui touche le sol (le dixième le plus bas). La
 * taille : des pieds au plus haut pixel dans une bande étroite autour de cet
 * axe — la tête, pas le bras levé.
 */
function mesurer(img, f) {
  const { px, l } = img;
  const dedans = (x, y) => {
    const p = y * l + x;
    return px[p * 4 + 3] >= 128 && (!f.etiq || f.ids.has(f.etiq[p]));
  };
  const hautSol = f.y1 - Math.round((f.y1 - f.y0) * 0.1);
  let somme = 0, n = 0;
  for (let y = hautSol; y <= f.y1; y++) for (let x = f.x0; x <= f.x1; x++) if (dedans(x, y)) { somme += x; n++; }
  const axe = n ? somme / n : (f.x0 + f.x1) / 2;
  const demi = Math.max(4, Math.round((f.x1 - f.x0) * BANDE));
  let sommet = f.y1;
  for (let y = f.y0; y <= f.y1 && sommet === f.y1; y++) {
    for (let x = Math.max(f.x0, Math.round(axe - demi)); x <= Math.min(f.x1, Math.round(axe + demi)); x++) {
      if (dedans(x, y)) { sommet = y; break; }
    }
  }
  return { axe, sol: f.y1, taille: f.y1 - sommet };
}

/* ------------------------------------------------------------ assemblage */

const planche = await lire(path.resolve(PLANCHE));
const repos = REPOS ? await lire(path.resolve(REPOS)) : null;

let figures = personnages(planche);
if (figures.length !== ORDRE.length) {
  console.error(`La planche montre ${figures.length} personnage(s), il en faut ${ORDRE.length}. `
    + 'Deux figures qui se touchent comptent pour une : redemande des espaces plus larges.');
  process.exit(1);
}
// Lecture : par rangées (un centre plus bas que le bas d'un autre ouvre une
// rangée), puis de gauche à droite.
figures.sort((a, b) => a.y0 - b.y0);
const rangees = [];
for (const f of figures) {
  const r = rangees.find((rg) => (f.y0 + f.y1) / 2 < rg[0].y1 && (f.y0 + f.y1) / 2 > rg[0].y0);
  if (r) r.push(f); else rangees.push([f]);
}
figures = rangees.flatMap((r) => r.sort((a, b) => a.x0 - b.x0));

/* **Les autres tenues du même âge.** `fanzzy-art.mjs` exige que toutes les
   sources d'un âge aient la même taille, toutes tenues confondues. Une planche
   Halloween découpée à sa propre taille, à côté d'un repos de base de
   1536 × 2752, ferait refuser l'âge entier : c'est arrivé au premier RP1 du
   nouveau style. Quand le dossier porte déjà des sources de cet âge dans une
   autre tenue, on s'y accorde : leur repos donne l'échelle, les pieds et la
   taille de la toile. */
const motif = new RegExp(`^${ID}-e${AGE}-([a-z]+)-([a-z]+)\\.png$`);
const voisins = (await readdir(SORTIE).catch(() => []))
  .filter((n) => { const m = n.match(motif); return m && m[1] !== TENUE; })
  .sort((a, b) => Number(!a.includes('-base-')) - Number(!b.includes('-base-')));
const accord = !repos && voisins.find((n) => n.endsWith('-neutre.png'));

/* Le repère : le repos, ses pieds et son axe.
   - Repos à part (`--repos`) : sa propre image, et l'échelle qui ramène la
     planche à sa taille.
   - Repos d'une autre tenue déjà dans le dossier : pareil, mais l'échelle se
     prend repos contre repos, ce qui est plus juste qu'une médiane de poses.
   - Sinon : le repos de la planche, et aucune mise à l'échelle. */
const tailleMediane = () => {
  const t = figures.map((g) => mesurer(planche, g).taille).sort((a, b) => a - b);
  return (t[(t.length - 1) >> 1] + t[t.length >> 1]) / 2;
};
const iNeutre = ORDRE.indexOf('neutre');
let reference, echelle;
if (repos || accord) {
  const image = repos ?? await lire(path.join(SORTIE, accord));
  const [f] = personnages(image).sort((a, b) => (b.x1 - b.x0) * (b.y1 - b.y0) - (a.x1 - a.x0) * (a.y1 - a.y0));
  const m = mesurer(image, f);
  reference = { axe: m.axe, sol: m.sol, l: image.l, h: image.h };
  const enFace = iNeutre >= 0 ? mesurer(planche, figures[iNeutre]).taille : tailleMediane();
  echelle = (m.taille / enFace) * ECHELLE;
} else {
  const f = figures[iNeutre];
  const m = mesurer(planche, f);
  reference = { axe: m.axe - f.x0, sol: m.sol - f.y0, l: f.x1 - f.x0 + 1, h: f.y1 - f.y0 + 1 };
  echelle = ECHELLE;
}

/* Chaque figure, isolée sur sa boîte, mise à l'échelle, puis placée pieds sur
   les pieds du repos et axe sur son axe. On calcule d'abord où chacune tombe,
   pour agrandir la toile commune d'autant qu'il faut : un bras levé peut
   dépasser le haut du repos, et rien ne doit être coupé. */
/* La frange (alpha sous la moitié) n'a pas d'étiquette. Avec une aura, elle
   est large, et celle d'une figure voisine entrerait dans la boîte : chaque
   pixel de frange va à l'étiquette la plus proche, de proche en proche. */
const proche = Int32Array.from(figures[0].etiq);
{
  const { l: L0, h: H0, px } = planche;
  let front = [];
  for (let p = 0; p < proche.length; p++) if (proche[p] >= 0) front.push(p);
  while (front.length) {
    const suivant = [];
    for (const q of front) {
      const x = q % L0, y = (q - x) / L0;
      for (const v of [x > 0 ? q - 1 : -1, x < L0 - 1 ? q + 1 : -1, y > 0 ? q - L0 : -1, y < H0 - 1 ? q + L0 : -1]) {
        if (v < 0 || proche[v] >= 0 || px[v * 4 + 3] === 0) continue;
        proche[v] = proche[q];
        suivant.push(v);
      }
    }
    front = suivant;
  }
}
// Une miette (moins de 30 pixels) n'a pas de propriétaire : elle ne compte pour personne.
const proprio = new Map();
for (const f of figures) for (const id of f.ids) proprio.set(id, f);
const places = [];
for (const [k, f] of figures.entries()) {
  if (ORDRE[k] === '-') continue;
  const m = mesurer(planche, f);
  const l = f.x1 - f.x0 + 1, h = f.y1 - f.y0 + 1;
  const isole = Buffer.alloc(l * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < l; x++) {
    const p = (f.y0 + y) * planche.l + (f.x0 + x);
    // Un pixel d'un voisin, franc ou de sa frange, reste dehors.
    if (proche[p] >= 0 && (proprio.get(proche[p]) ?? f) !== f) continue;
    for (let c = 0; c < 4; c++) isole[(y * l + x) * 4 + c] = planche.px[p * 4 + c];
  }
  const L = Math.max(1, Math.round(l * echelle)), H = Math.max(1, Math.round(h * echelle));
  const tampon = await sharp(isole, { raw: { width: l, height: h, channels: 4 } })
    .resize(L, H).png().toBuffer();
  const gauche = Math.round(reference.axe - (m.axe - f.x0) * echelle);
  const haut = Math.round(reference.sol - (m.sol - f.y0) * echelle);
  places.push({ etat: ORDRE[k], tampon, gauche, haut, L, H });
}
const ext = {
  g: Math.max(0, ...places.map((p) => -p.gauche)),
  h: Math.max(0, ...places.map((p) => -p.haut)),
  d: Math.max(0, ...places.map((p) => p.gauche + p.L - reference.l)),
  b: Math.max(0, ...places.map((p) => p.haut + p.H - reference.h)),
};
const toile = { width: reference.l + ext.g + ext.d, height: reference.h + ext.h + ext.b };
const vide = { create: { ...toile, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } };

await mkdir(SORTIE, { recursive: true });
const nom = (etat) => path.join(SORTIE, `${ID}-e${AGE}-${TENUE}-${etat}.png`);
if (repos) {
  const png = await sharp(Buffer.from(repos.px.buffer), { raw: { width: repos.l, height: repos.h, channels: 4 } })
    .png().toBuffer();
  await sharp(vide).composite([{ input: png, left: ext.g, top: ext.h }]).png().toFile(nom('neutre'));
}
for (const p of places) {
  await sharp(vide).composite([{ input: p.tampon, left: p.gauche + ext.g, top: p.haut + ext.h }])
    .png().toFile(nom(p.etat));
}

/* La toile a grandi (un bras tendu dépasse) : les autres tenues de l'âge
   reçoivent la même marge transparente, pour garder une seule taille. Leur
   dessin ne bouge pas d'un pixel par rapport au repos ; `fanzzy-art.mjs`
   recadre de toute façon sur l'union des personnages. */
const agrandis = [];
if (accord && (ext.g || ext.h || ext.d || ext.b)) {
  for (const n of voisins) {
    const fichier = path.join(SORTIE, n);
    const meta = await sharp(fichier).metadata();
    if (meta.width !== reference.l || meta.height !== reference.h) continue;
    const png = await sharp(await readFile(fichier)).ensureAlpha()
      .extend({ left: ext.g, top: ext.h, right: ext.d, bottom: ext.b, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    await writeFile(fichier, png);
    agrandis.push(n);
  }
}

console.log(`Planche découpée : ${[...(repos ? ['neutre (à part)'] : []), ...places.map((p) => p.etat)].join(', ')}, échelle ${echelle.toFixed(3)}.`);
console.log(`${places.length + (repos ? 1 : 0)} sources de ${toile.width} × ${toile.height} dans ${path.relative(RACINE, SORTIE) || SORTIE}.`);
if (accord) console.log(`Accordée à ${accord}${agrandis.length ? ` ; marge ajoutée à ${agrandis.length} source(s) des autres tenues` : ''}.`);
console.log(`Suite : npm run art ${path.relative(RACINE, SORTIE)}`);
