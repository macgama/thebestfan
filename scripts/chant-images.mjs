/**
 * Les illustrations des douze chants du Grand Virage.
 *
 * La rangée des chants était douze rectangles de texte. On choisissait « La
 * cadence » plutôt que « Les salves » en lisant deux mots de huit pixels, en
 * plein match, c'est-à-dire jamais : on prenait la première case, toujours la
 * même. Un dessin derrière le nom fait la différence avant la lecture.
 *
 * ## Ce que fait ce script
 *
 * Il ne génère rien. Il **range** : il prend les dessins produits par Artlist,
 * déposés dans `art/chant/<id>.png`, et en tire les trois formats que le jeu
 * sert — AVIF, WebP, JPEG.
 *
 * ## Pourquoi un format plus large que les cartes d'action
 *
 * Une carte d'action est un portrait qu'on montre en grand quand on la joue.
 * Un chant ne se montre jamais autrement qu'en vignette, derrière son nom, sur
 * une case plus large que haute. On sert donc du paysage, cadré large, et bien
 * plus petit : servir 480×640 pour une case de 72×60 ferait télécharger seize
 * fois ce qu'on affiche.
 *
 * ## Pourquoi ces sujets-là
 *
 * Le dessin doit dire **le geste**, pas le chant. Un supporter qui tape en
 * rythme, un autre qui retient son souffle, une tribune qui répond à son capo :
 * c'est ce que le joueur va devoir faire dans les quatre secondes qui suivent.
 * Un dessin de tribune générique ne l'aiderait en rien, et il y en aurait douze
 * identiques.
 *
 * Usage :  node scripts/chant-images.mjs
 *          node scripts/chant-images.mjs --invites   (les imprime)
 */
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LISTE_CHANTS } from '../src/shared/duel/chants.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = path.join(RACINE, 'art', 'chant');
const CIBLE = path.join(RACINE, 'public', 'img', 'chant');

/* La case fait 72 pixels de large sur un téléphone étroit, 150 sur une colonne
   large ; à deux fois la densité, 300. On sert 320×240 et pas davantage. */
const LARGEUR = 320;
const HAUTEUR = 240;

/* Le style commun, écrit une fois. Il tient de celui des cartes d'action —
   c'est le même jeu — mais il demande un cadrage **large** et un haut de cadre
   sombre : le nom du chant s'écrit par-dessus, et un sujet clair à cet
   endroit-là le rendrait illisible. C'est la contrainte qui a décidé de la
   formulation, pas un goût. */
const STYLE = `Style: stylised 3D render, modern mobile game art, wide
cinematic framing, deep navy stadium night background, strong rim lighting,
subject off-centre and low in the frame, the upper part of the image dark and
uncluttered so that text can sit over it.

Full-bleed illustration, edge to edge, NO card frame, NO border, NO decorative
corners, NO panel — the artwork must fill the entire image with no margin.

Strictly forbidden: any text, letters, numbers, logos, real club crests, card
borders or frames, masks, balaclavas, covered faces, watermark.`;

/**
 * Le sujet de chaque chant, et sa couleur d'accent.
 *
 * La couleur suit le **geste**, pas le chant : deux chants de tempo partagent
 * la leur, comme la rangée les affiche déjà. C'est ce qui fait qu'on reconnaît
 * un martelage avant d'avoir lu son nom.
 */
export const INVITES = {
  reprise: ['amber', 'a capo standing on the barrier with his back to the pitch, '
    + 'clapping a steady beat above his head, the front rows picking it up with him'],
  roulement: ['blue', 'a wall of supporters drumming fast on the advertising boards '
    + 'with both hands, blurred motion, a rolling thunder of arms'],
  repons: ['violet', 'a capo calling out a phrase with one hand cupped to his mouth '
    + 'while the terrace behind him answers, split composition, call and response'],
  onetaitla: ['silver', 'a handful of older supporters standing still and unmoved in '
    + 'a half-empty stand on a cold night, arms folded, refusing to leave'],
  salves: ['orange', 'a terrace clapping in sharp bursts, three ranks caught mid-clap '
    + 'and the rest perfectly still between them, rhythm frozen in the crowd'],
  contrechant: ['teal', 'two halves of a terrace singing against each other, one rank '
    + 'rising as the other drops, an off-beat wave crossing the stand'],
  craquage: ['red', 'a supporter roaring himself hoarse at the front, veins in his '
    + 'neck, smoke and red light around him, everything given at once'],
  montee: ['gold', 'a chant building through a terrace from the bottom rows to the '
    + 'top, arms rising in a gradient, the tempo visibly accelerating upward'],
  tenir: ['crimson', 'a supporter holding one long note with his eyes shut and his '
    + 'fists clenched, the stand around him blurred, everything on that one breath'],
  mur: ['amber', 'a solid block of supporters arm in arm singing in perfect unison, '
    + 'an unbroken wall of bodies across the whole frame'],
  relance: ['green', 'a terrace fallen completely silent, heads down, one supporter '
    + 'already drawing breath to start it again, the pause before the restart'],
  cadence: ['sky blue', 'a supporter counting out an exact measured beat with a raised '
    + 'finger, calm and precise amid a crowd that follows him note for note'],

  /* Les cinq qui ne sont pas du rythme. Leur sujet ne montre pas des mains qui
     frappent mais un geste qu'on trace, qu'on retient, qu'on suit : c'est ce
     qui les distingue à l'œil dans le répertoire. */
  bache: ['violet', 'supporters unrolling an enormous painted banner across the whole '
    + 'stand, arms high, the cloth rippling as it catches the light'],
  damier: ['emerald', 'a chequerboard of coloured cards held up across the stand, half '
    + 'of them already flipped, a pattern forming row by row'],
  aupoint: ['sky blue', 'two supporters pointing at each other across the stand having '
    + 'found the same gesture at the same instant, recognition on both faces'],
  moulinet: ['amber', 'a supporter whirling his scarf overhead in a fast circle, the '
    + 'whole row doing the same, a wheel of colour above the crowd'],
  appel: ['crimson', 'a capo high on the barrier, megaphone raised, calling a section '
    + 'of the stand that rises to answer him'],

  /* Les deux derniers mini-jeux. Ni l'un ni l'autre ne montre quelqu'un qui
     chante : l'un trie à vue, l'autre compte dans le noir. Leur sujet est donc
     le **geste des mains** et le **regard**, pas la bouche ouverte — c'est ce
     qui les distingue à l'œil des dix-sept autres. */
  trilage: ['amber', 'supporters sorting a huge pile of coloured tifo cards at speed, '
    + 'hands flying, sorted stacks growing beside them, concentration and hurry on '
    + 'their faces'],
  rebours: ['crimson', 'a whole terrace counting down together in the dark before the '
    + 'flares, every hand raised with fingers extended, faces lit only by the pitch, '
    + 'the instant before it all goes off'],

  /* Les trois de LA REPRISE. Chacune porte une **épreuve de décision**, et non
     un rythme : on y choisit un côté, un point, ou un niveau à tenir. Leur
     couleur est donc neuve — un joueur qui voit du magenta dans le répertoire
     sait avant d'avoir lu que ce n'est pas un chant qu'il connaît.

     Et leur sujet montre l'instant où la décision se prend, pas le chant qui en
     sort : le renversement est saisi **pendant** qu'il s'inverse, la visée au
     moment où le bras se tend, la tension quand plus rien ne bouge. Un tifo
     achevé et une bouche ouverte se ressemblent d'une image à l'autre ; ces
     trois instants-là ne ressemblent à rien d'autre. */
  renverse: ['magenta', 'a whole terrace leaning hard to one side while the front ranks '
    + 'throw themselves the opposite way, caught at the exact instant the wave reverses, '
    + 'bodies split into two directions across the stand'],
  fumigenes: ['orange', 'a supporter reaching out to set a lit flare down on one exact '
    + 'point of the barrier, arm fully extended and eyes fixed on that spot, thick smoke '
    + 'already pouring from it, the rest of the stand blurred behind him'],
  /* Les quatre de l'automne 2026. */
  vague: ['gold', 'a Mexican wave rolling around a packed stadium bowl at night, one '
    + 'section of the crowd rising with arms up while the next ones wait seated, the '
    + 'wave clearly travelling around the ring'],
  renvoi: ['teal', 'a capo on a platform beating two big drums, one on each side, while '
    + 'the stand opposite answers on its own two drums in mirror image, split symmetric '
    + 'composition, call and mirrored response'],
  pluie: ['red', 'supporters throwing long white paper streamer rolls from the terrace '
    + 'towards the pitch, the ribbons unrolling in wide arcs through the floodlights and '
    + 'bending in the wind'],
  canon: ['gold', 'two halves of a terrace singing against each other in a round, left '
    + 'side and right side each led by its own capo, two waves of raised arms offset in '
    + 'time'],
  tension: ['cyan', 'a row of supporters hauling on a rope and holding it dead still at '
    + 'one exact level, arms locked and heels dug in, every muscle taut, nothing moving '
    + 'anywhere in the frame'],
};

export const inviteDe = (id) => {
  const [couleur, sujet] = INVITES[id] ?? [];
  if (!sujet) return null;
  return `Subject: ${sujet}, at night, glowing ${couleur} accent light.\n\n${STYLE}`;
};

/* ------------------------------------------------------------- l'exécution */

if (process.argv.includes('--invites')) {
  for (const c of LISTE_CHANTS) {
    console.log(`\n=== ${c.id} — ${c.nom} (${c.gest})\n${inviteDe(c.id) ?? '(aucune invite)'}`);
  }
  process.exit(0);
}

const sharp = (await import('sharp')).default;
await mkdir(CIBLE, { recursive: true });

if (!existsSync(SOURCE)) {
  console.error(`\n  ${SOURCE} n'existe pas.\n\n`
    + '  Les dessins produits par Artlist se déposent là, un fichier par chant,\n'
    + '  nommé de son identifiant : art/chant/reprise.png\n\n'
    + '  Les invites : node scripts/chant-images.mjs --invites\n');
  process.exit(1);
}

const sources = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const connus = new Set(LISTE_CHANTS.map((c) => c.id));
let faits = 0;
const manquantes = [];

for (const c of LISTE_CHANTS) {
  const src = sources.find((f) => f.replace(/\.[^.]+$/, '') === c.id);
  if (!src) { manquantes.push(c.id); continue; }
  const base = sharp(path.join(SOURCE, src))
    .resize(LARGEUR, HAUTEUR, { fit: 'cover', position: 'centre' });
  await base.clone().avif({ quality: 58 }).toFile(path.join(CIBLE, `${c.id}.avif`));
  await base.clone().webp({ quality: 78 }).toFile(path.join(CIBLE, `${c.id}.webp`));
  await base.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(path.join(CIBLE, `${c.id}.jpg`));
  faits++;
  process.stdout.write(`\r  ${faits} chant(s) rangé(s)`);
}

/* Un fichier qui ne correspond à aucun chant est presque toujours une faute de
   frappe dans son nom — et elle ne se verrait pas, puisque la case garderait
   simplement son fond uni. */
const orphelins = sources.map((f) => f.replace(/\.[^.]+$/, '')).filter((n) => !connus.has(n));

console.log(`\n${faits} illustration(s) en trois formats dans public/img/chant.`);
if (manquantes.length) console.log(`Sans dessin : ${manquantes.join(', ')}`);
if (orphelins.length) {
  console.log(`\nFichiers qui ne correspondent à aucun chant : ${orphelins.join(', ')}`);
  console.log('Vérifie leur nom : il doit être exactement l’identifiant du chant.');
}

await writeFile(path.join(CIBLE, 'liste.json'),
  `${JSON.stringify(LISTE_CHANTS.filter((c) => !manquantes.includes(c.id)).map((c) => c.id))}\n`);
