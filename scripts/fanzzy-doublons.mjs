/**
 * Deux personnages, un seul visage.
 *
 * ## Ce qu'on cherche
 *
 * Le Petit Teigneux (TR1) et Le Gamin de Devant (G1) sont deux cartes
 * différentes : deux noms, deux histoires, deux cris, deux séries d'effets. Ils
 * montrent **le même gamin**, même parka, même écharpe, même moue. Deux
 * fichiers, deux empreintes, un seul personnage.
 *
 * C'est la faute la plus coûteuse qu'un jeu de collection puisse commettre, et
 * la seule qu'aucune vérification technique n'attrape : les deux images
 * existent, chacune est valide, chacune est au bon endroit, et `images:test`
 * compte deux dessins. Rien n'est cassé. C'est simplement une carte de moins à
 * collectionner, et un joueur qui se demande s'il a mal vu.
 *
 * Elle se repère à l'œil, et seulement à l'œil — sauf à cent cinquante-huit
 * dessins, où l'œil ne compare pas tout avec tout. D'où ce script.
 *
 * ## Comment
 *
 * Une **empreinte de différence** (dHash) : l'image est réduite en niveaux de
 * gris à neuf colonnes sur huit lignes, et chaque bit dit si un pixel est plus
 * clair que son voisin de droite. Soixante-quatre bits qui décrivent la
 * structure des contrastes, pas les couleurs.
 *
 * C'est ce qu'il faut ici. Deux rendus du même prompt ne sont jamais identiques
 * à l'octet — grain, compression, une mèche ailleurs — mais leur structure de
 * contrastes l'est. Une comparaison de fichiers ne verrait rien ; une
 * comparaison pixel à pixel se ferait tromper par un décalage d'un pixel.
 *
 * Le seuil est la **distance de Hamming**, c'est-à-dire le nombre de bits qui
 * diffèrent sur soixante-quatre. Zéro à deux : c'est le même rendu, sans
 * discussion. Trois à six : à regarder — on y trouve de vraies collisions et des
 * personnages qui se ressemblent honnêtement. Vers onze : le même personnage
 * redessiné, comme TR1 et G1. Au-delà : deux personnages.
 *
 * On ne rend jamais de verdict : le script **montre les paires**, et c'est
 * quelqu'un qui regarde. Un seuil qui déciderait tout seul finirait par faire
 * supprimer une lignée dont les trois âges se ressemblent — ce qui est
 * exactement ce qu'on leur demande.
 *
 * Usage :
 *   npm run doublons                              les paires suspectes
 *   npm run doublons -- --seuil 12                plus large : le même
 *                                                 personnage redessiné
 *   npm run doublons -- --planche X.png           une planche à regarder
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { DEX } from '../src/shared/fanzzy/dex.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const IMG = path.join(RACINE, 'public', 'img', 'fanzzy');
const args = process.argv.slice(2);
const drapeau = (nom, defaut) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut;
};
const SEUIL = Number(drapeau('seuil', 6));
const PLANCHE = drapeau('planche', null);

/**
 * L'empreinte de différence d'une image.
 *
 * Le fond est aplati sur du noir avant la réduction : ces dessins sont détourés,
 * et deux images identiques dont l'une garde un canal alpha et l'autre non
 * donneraient deux empreintes éloignées — un faux négatif, c'est-à-dire
 * précisément ce qu'on ne veut pas manquer.
 */
async function empreinte(fichier) {
  const { data } = await sharp(fichier)
    .flatten({ background: '#000000' })
    .greyscale()
    .resize(9, 8, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const bits = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits.push(data[y * 9 + x] > data[y * 9 + x + 1] ? 1 : 0);
    }
  }
  return bits;
}

const distance = (a, b) => a.reduce((n, v, i) => n + (v === b[i] ? 0 : 1), 0);

/* ------------------------------------------------------------ le catalogue */

const suite = new Set(DEX.map((f) => f.evo).filter(Boolean));
/** Un personnage est un âge dont aucun autre n'est la suite. */
const racineDe = new Map();
for (const f of DEX) {
  let r = f;
  // On remonte : l'âge dont celui-ci est la suite, et ainsi de suite.
  for (let garde = 0; garde < 8; garde++) {
    const p = DEX.find((x) => x.evo === r.id);
    if (!p) break;
    r = p;
  }
  racineDe.set(f.id, r.id);
}

const cartes = [];
for (const f of DEX.filter((x) => x.publie !== false)) {
  const fichier = path.join(IMG, `${f.id}.png`);
  if (!existsSync(fichier)) continue;
  cartes.push({ ...f, fichier, racine: racineDe.get(f.id) ?? f.id,
    estPersonnage: !suite.has(f.id) });
}

console.log(`${cartes.length} illustrations à comparer.\n`);

const empreintes = new Map();
for (const c of cartes) empreintes.set(c.id, await empreinte(c.fichier));

/* --------------------------------------------------------- les rapprochements

   On ne compare que ce qui **devrait** différer : deux âges d'une même lignée
   se ressemblent par construction — c'est le personnage qui vieillit — et les
   signaler noierait les vraies collisions sous cinquante paires légitimes. */

const paires = [];
for (let i = 0; i < cartes.length; i++) {
  for (let j = i + 1; j < cartes.length; j++) {
    const a = cartes[i];
    const b = cartes[j];
    if (a.racine === b.racine) continue;
    const d = distance(empreintes.get(a.id), empreintes.get(b.id));
    if (d <= SEUIL) paires.push({ a, b, d });
  }
}
paires.sort((x, y) => x.d - y.d);

if (!paires.length) {
  console.log(`Aucune paire sous ${SEUIL} bits d'écart. Chaque personnage a son visage.`);
  process.exit(0);
}

/* Deux bits, et pas six. À deux bits c'est le même rendu, sans discussion.
   Entre trois et six on trouve des personnages qui se ressemblent
   légitimement — le Tambour Major et l'Abonné se croisent à six, et ce sont
   deux dessins différents. Étiqueter ces paires-là « le même dessin » ferait
   perdre confiance dans les dix-sept premières, qui sont vraies. */
const verdict = (d) => (d <= 2 ? 'LE MÊME RENDU' : 'à regarder');
for (const { a, b, d } of paires) {
  console.log(`${String(d).padStart(2)} bits  ${verdict(d).padEnd(15)} `
    + `${a.id} « ${a.nom} » (${a.set})`);
  console.log(`${' '.repeat(24)}${b.id} « ${b.nom} » (${b.set})`);
}
console.log(`\n${paires.length} paire(s) à regarder, seuil ${SEUIL} bits sur 64.`);
console.log('Rien n’est supprimé : c’est une liste à examiner, pas un verdict.');

/* La planche. Le script ne peut pas trancher — deux personnages peuvent
   légitimement se ressembler — donc il met les paires côte à côte et laisse
   quelqu'un décider en trois secondes au lieu de trois minutes. */
if (PLANCHE) {
  const H = 220;
  const lignes = [];
  for (const { a, b, d } of paires.slice(0, 24)) {
    const [ia, ib] = await Promise.all([a, b].map((c) =>
      sharp(c.fichier).resize({ height: H }).toBuffer()));
    const [ma, mb] = await Promise.all([ia, ib].map((x) => sharp(x).metadata()));
    lignes.push({ ia, ib, ma, mb, d, a, b });
  }
  const large = Math.max(...lignes.map((l) => l.ma.width + l.mb.width + 24));
  const haut = lignes.length * (H + 10);
  const fond = sharp({ create: { width: large, height: haut, channels: 4,
    background: { r: 14, g: 18, b: 24, alpha: 1 } } });
  const pieces = [];
  lignes.forEach((l, i) => {
    pieces.push({ input: l.ia, left: 0, top: i * (H + 10) });
    pieces.push({ input: l.ib, left: l.ma.width + 24, top: i * (H + 10) });
  });
  await fond.composite(pieces).png().toFile(PLANCHE);
  console.log(`\nPlanche : ${PLANCHE}`);
  lignes.forEach((l, i) => console.log(`  ligne ${i + 1} : ${l.a.id} | ${l.b.id} `
    + `(${l.d} bits)`));
}
