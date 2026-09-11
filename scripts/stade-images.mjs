/**
 * Les stades, et l'endroit de leurs tribunes.
 *
 * Cinq stades vus du dessus, le terrain à la verticale et les deux grandes
 * tribunes à gauche et à droite — c'est le cadrage qui permet de poser les
 * deux camps d'un duel ou d'un Virage là où ils sont vraiment.
 *
 * ## Ce que fait ce script
 *
 * Il **range** les dessins, comme ses deux voisins. Mais il fait une chose de
 * plus, et c'est tout l'intérêt : il **mesure** où se trouvent le terrain et
 * les tribunes, et écrit ces mesures dans `public/img/stade/plans.json`.
 *
 * ## Pourquoi mesurer plutôt que placer à l'œil
 *
 * L'effet lumineux des tribunes a besoin de savoir quelle bande de l'image
 * éclairer. On pourrait écrire cinq rectangles à la main en regardant les
 * images ; ce serait juste au pixel près le jour où on l'écrit, et faux le
 * jour où un stade est redessiné — sans que rien ne le dise. Un stade dont le
 * terrain est deux pour cent plus à gauche allumerait la pelouse au lieu de la
 * foule, et personne ne saurait pourquoi.
 *
 * Le terrain se repère tout seul : c'est la seule grande zone franchement
 * verte et éclairée de l'image. Les tribunes sont les bandes qui le bordent à
 * gauche et à droite. Les mesures suivent donc le dessin, toujours.
 *
 * Usage :  node scripts/stade-images.mjs
 */
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STADES } from '../src/shared/stades.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = path.join(RACINE, 'art', 'stade');
const CIBLE = path.join(RACINE, 'public', 'img', 'stade');

/**
 * La taille servie.
 *
 * Le stade est un décor de fond, sur une colonne de cinq cent vingt pixels au
 * plus. On sert donc 720 de large : de quoi tenir un écran à densité double
 * sans télécharger les mille vingt-quatre pixels du générateur.
 */
const LARGEUR = 720;

/** La vignette de la carte à collectionner, bien plus petite. */
const VIGNETTE = 300;

/* ------------------------------------------------------- la mesure du plan */

/**
 * Un pixel est-il de la pelouse éclairée ?
 *
 * On juge sur la **teinte**, pas sur « vert plus grand que rouge ». Un premier
 * essai demandait `g > r * 1.25` : il trouvait quatre terrains sur cinq et
 * déclarait le cinquième introuvable, parce que ses projecteurs sont ambrés et
 * que sa pelouse y tire vers le jaune — rouge 179, vert 194, le rapport ne
 * tient pas. La teinte, elle, reste dans le vert-jaune quelle que soit la
 * couleur de la lumière : 69° sous l'ambre, 86° sous le blanc.
 *
 * Restent dehors : la terre ocre (30°), le bleu des sièges et des toits
 * (210°), et tout ce qui est sombre ou gris — la foule, les tribunes, le ciel.
 */
function estPelouse(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (mx < 90 || d < 25) return false;         // sombre, ou gris : pas de pelouse
  let h;
  if (mx === r) h = (((g - b) / d) % 6) * 60;
  else if (mx === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  if (h < 0) h += 360;
  return h >= 55 && h <= 160;                  // du vert-jaune au vert franc
}

/**
 * La boîte du terrain, en fractions de l'image.
 *
 * On prend les **centiles** et non les extrêmes : un seul pixel vert égaré sur
 * un toit suffirait sinon à étirer la boîte jusqu'au bord, et le plan serait
 * faux sans qu'aucune erreur ne soit levée.
 */
function boiteDuTerrain({ data, width, height }) {
  const colonnes = new Array(width).fill(0);
  const lignes = new Array(height).fill(0);
  let total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 3;
      if (!estPelouse(data[p], data[p + 1], data[p + 2])) continue;
      colonnes[x]++; lignes[y]++; total++;
    }
  }
  if (total < width * height * 0.02) return null;   // pas de terrain trouvé

  /* Une colonne compte comme « terrain » si elle porte au moins un dixième du
     maximum : le bord du terrain s'estompe, un seuil dur y coupe trop tôt. */
  const bornes = (t) => {
    const seuil = Math.max(...t) * 0.1;
    let a = 0; while (a < t.length && t[a] < seuil) a++;
    let b = t.length - 1; while (b > a && t[b] < seuil) b--;
    return [a, b];
  };
  const [x0, x1] = bornes(colonnes);
  const [y0, y1] = bornes(lignes);
  return { x0: x0 / width, x1: x1 / width, y0: y0 / height, y1: y1 / height };
}

/**
 * Le plan d'un stade : le terrain, et les deux tribunes qui le bordent.
 *
 * La tribune de gauche occupe la bande entre le bord du terrain et le tiers de
 * ce qui reste jusqu'au bord de l'image — au-delà, ce n'est plus la foule,
 * c'est le quartier. Symétrique à droite. Verticalement, on rentre un peu par
 * rapport au terrain : les coins d'un stade sont ouverts ou occupés par les
 * pylônes, et y allumer de la lumière ferait briller le ciel.
 */
function planDe(terrain) {
  if (!terrain) return null;
  const marge = 0.12;                      // rentrée verticale
  const h0 = terrain.y0 + (terrain.y1 - terrain.y0) * marge;
  const h1 = terrain.y1 - (terrain.y1 - terrain.y0) * marge;
  const epaisseur = (cote) => Math.min(0.14, cote * 0.62);
  const eG = epaisseur(terrain.x0);
  const eD = epaisseur(1 - terrain.x1);
  return {
    terrain,
    gauche: { x0: Math.max(0, terrain.x0 - eG), x1: terrain.x0, y0: h0, y1: h1 },
    droite: { x0: terrain.x1, x1: Math.min(1, terrain.x1 + eD), y0: h0, y1: h1 },
  };
}

/* ------------------------------------------------------------- l'exécution */

const sharp = (await import('sharp')).default;
await mkdir(CIBLE, { recursive: true });

if (!existsSync(SOURCE)) {
  console.error(`\n  ${SOURCE} n'existe pas.\n\n`
    + '  Les dessins produits par Artlist se déposent là, un fichier par stade,\n'
    + '  nommé de son identifiant : art/stade/chaudron.png\n');
  process.exit(1);
}

const sources = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const connus = new Set(STADES.map((s) => s.id));
const plans = {};
const manquants = [];
const douteux = [];
let faits = 0;

for (const s of STADES) {
  const src = sources.find((f) => f.replace(/\.[^.]+$/, '') === s.id);
  if (!src) { manquants.push(s.id); continue; }
  const entree = path.join(SOURCE, src);

  /* La mesure se fait sur une image réduite : le plan est le même et le
     parcours des pixels est cent fois plus court. */
  const petite = await sharp(entree).resize(200).removeAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const terrain = boiteDuTerrain({ data: petite.data, ...petite.info });
  const plan = planDe(terrain);
  if (!plan) douteux.push(`${s.id} (terrain introuvable)`);
  else plans[s.id] = plan;

  const base = sharp(entree).resize(LARGEUR);
  await base.clone().avif({ quality: 58 }).toFile(path.join(CIBLE, `${s.id}.avif`));
  await base.clone().webp({ quality: 80 }).toFile(path.join(CIBLE, `${s.id}.webp`));
  await base.clone().jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(CIBLE, `${s.id}.jpg`));

  const mini = sharp(entree).resize(VIGNETTE);
  await mini.clone().avif({ quality: 58 }).toFile(path.join(CIBLE, `${s.id}-mini.avif`));
  await mini.clone().webp({ quality: 80 }).toFile(path.join(CIBLE, `${s.id}-mini.webp`));
  await mini.clone().jpeg({ quality: 80, mozjpeg: true })
    .toFile(path.join(CIBLE, `${s.id}-mini.jpg`));

  faits++;
  process.stdout.write(`\r  ${faits} stade(s) rangé(s)`);
}

await writeFile(path.join(CIBLE, 'plans.json'), `${JSON.stringify(plans, null, 2)}\n`);

const orphelins = sources.map((f) => f.replace(/\.[^.]+$/, '')).filter((n) => !connus.has(n));

console.log(`\n${faits} stade(s) en trois formats dans public/img/stade.`);
for (const [id, p] of Object.entries(plans)) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  console.log(`  ${id.padEnd(10)} terrain ${pct(p.terrain.x0)}–${pct(p.terrain.x1)}`
    + ` × ${pct(p.terrain.y0)}–${pct(p.terrain.y1)}`
    + `  ·  tribunes ${pct(p.gauche.x0)}–${pct(p.gauche.x1)}`
    + ` et ${pct(p.droite.x0)}–${pct(p.droite.x1)}`);
}
if (manquants.length) console.log(`\nSans dessin : ${manquants.join(', ')}`);
if (douteux.length) console.log(`\nPlan douteux : ${douteux.join(', ')}`);
if (orphelins.length) {
  console.log(`\nFichiers qui ne correspondent à aucun stade : ${orphelins.join(', ')}`);
}
