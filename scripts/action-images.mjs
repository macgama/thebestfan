/**
 * Les illustrations des cartes d'action.
 *
 * Vingt et une cartes, un dessin chacune. Elles étaient des vignettes de sept
 * pixels de texte sur un rectangle coloré : on jouait « Parcage fermé » sans
 * jamais savoir à quoi ça ressemblait, et deux cartes de la même famille se
 * distinguaient à la lecture seule — en plein duel, c'est-à-dire jamais.
 *
 * ## Ce que fait ce script
 *
 * Il ne génère rien. Il **range** : il prend les dessins produits par Artlist,
 * déposés dans `art/action/<id>.png`, et en tire les trois formats que le jeu
 * sert — AVIF, WebP, JPEG — à la taille où ils s'affichent vraiment.
 *
 * Le format de secours est le JPEG et pas le PNG, contrairement aux Fanzzy :
 * eux sont découpés sur du vide et ont besoin d'un canal alpha, ces dessins-ci
 * remplissent leur cadre. Le même lot pesait treize mégaoctets en PNG et huit
 * cents kilo-octets en JPEG — pour une image que personne ne verra, puisque
 * l'AVIF et le WebP couvrent tout ce qui a moins de dix ans.
 *
 * La génération, elle, se fait à la main avec les invites de `INVITES` ci-
 * dessous. Elles sont ici et pas dans un carnet : le jour où une carte est
 * redessinée, c'est cette formulation-là qu'il faut reprendre, et une invite
 * perdue est un dessin qu'on ne sait plus refaire dans le même style.
 *
 * Usage :  node scripts/action-images.mjs
 *          node scripts/action-images.mjs --invites   (les imprime)
 */
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACTIONS } from '../src/shared/duel/actions.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = path.join(RACINE, 'art', 'action');
const CIBLE = path.join(RACINE, 'public', 'img', 'action');

/**
 * La taille servie.
 *
 * La carte la plus grande du jeu — celle qui s'affiche quand on la joue —
 * fait deux cent quarante pixels de large sur un écran à deux fois la
 * densité : quatre cent quatre-vingts. On sert donc 480×640, et pas les mille
 * deux cents pixels que rend le générateur. Un dessin quatre fois trop grand
 * ne se voit pas ; il se télécharge.
 */
const LARGEUR = 480;
const HAUTEUR = 640;

/* Le style commun. Il est écrit une fois : vingt et une cartes dessinées
   chacune dans son coin ne font pas un jeu, elles font vingt et une images.

   Les interdits pèsent autant que le sujet. « Pas de cadre » surtout : le
   premier essai est revenu avec une bordure de carte dessinée dedans, alors
   que le jeu dessine la sienne — couleur de famille, gemme de coût, nom. Et
   « visages découverts » : sans cette ligne, le modèle met des cagoules à tout
   le monde, ce qui n'est pas le jeu qu'on fait. */
const STYLE = `Style: stylised 3D render, modern mobile game art, bold readable
silhouette, strong rim lighting, deep navy stadium night background, subject
centred and filling the frame.

Full-bleed illustration, edge to edge, NO card frame, NO border, NO decorative
corners, NO panel — the artwork must fill the entire image with no margin.

Strictly forbidden: any text, letters, numbers, logos, real club crests, card
borders or frames, masks, balaclavas, covered faces, watermark.`;

/** Le sujet de chaque carte, et la couleur d'accent de sa famille. */
export const INVITES = {
  'a-fumigene': ['red', 'a lit red smoke flare raised high in a packed terrace at night, '
    + 'thick crimson smoke curling upward, sparks, joyful supporters with open visible '
    + 'faces singing behind, striped scarves held overhead'],
  'a-craquage': ['red', 'an entire terrace erupting at once in a wall of red smoke and '
    + 'flame, dozens of flares lit together, embers filling the air, arms raised '
    + 'everywhere, overwhelming and slightly reckless'],
  'a-torche': ['red', 'a single burning torch held over the barrier by a supporter '
    + 'leaning forward, a trail of sparks behind it, the rest of the stand dark'],

  'a-silence': ['violet', 'a stadium gone suddenly silent, one supporter with a finger '
    + 'to his lips in the foreground, a dropped megaphone, violet light, fading sound '
    + 'ripples in the air, the crowd behind frozen mid-shout'],
  'a-brouillard': ['violet', 'thick violet fog rolling across a terrace, supporters '
    + 'reduced to soft silhouettes, floodlight beams cutting through the haze'],
  'a-parcage': ['violet', 'a closed and padlocked away-section gate seen from inside, '
    + 'heavy fencing, violet floodlight behind it, an empty caged stand'],

  'a-vol': ['blue', 'a swirling current of glowing blue breath being pulled out of a '
    + 'distant terrace and drawn toward the viewer, ribbons of air, supporters gasping'],
  'a-thermos': ['blue', 'a battered metal thermos flask pouring steaming tea into a cup, '
    + 'gloved hands, cold blue floodlight, breath visible in the freezing air'],
  'a-collecte': ['blue', 'a bucket passed hand to hand along a row of supporters in the '
    + 'stand, many reaching arms, blue light, coins and scarves'],

  'a-metronome': ['gold', 'a golden metronome standing on a big terrace drum, its arm '
    + 'mid-swing, glowing arcs marking the beat, drummers around it'],
  'a-vent': ['gold', 'a violent headwind blowing across a terrace, banners and scarves '
    + 'streaming sideways, one supporter leaning hard into the gust, golden dust'],
  'a-secondsouffle': ['gold', 'a supporter bent over catching his breath, then rising '
    + 'again, a warm golden glow blooming from his chest, the crowd lifting behind him'],

  'a-bache': ['silver', 'an enormous plain tarpaulin banner raised like a shield across '
    + 'the whole front of a terrace, many hands holding it up, silver-grey light'],
  'a-miroir': ['silver', 'a mirror-bright banner reflecting an incoming wave of light '
    + 'straight back out of the frame, silver sheen, supporters shielding their eyes'],

  'a-appel': ['green', 'a capo standing on a podium with his back to us, facing the '
    + 'terrace, megaphone raised high, the whole stand answering with raised arms, '
    + 'green light'],
  'a-mosaique': ['green', 'a tifo mosaic in progress, hundreds of coloured cards held up '
    + 'across a stand forming an abstract pattern, seen from the side, green accents'],
  'a-choeur': ['green', 'an entire terrace singing in unison, mouths open, heads back, '
    + 'arms around shoulders, green glow rising from the crowd'],

  'a-remontada': ['orange', 'the moment a terrace turns, supporters exploding out of '
    + 'their seats as the tide swings back, warm orange light breaking through the '
    + 'darkness above the stand'],
  'a-arbitre': ['orange', 'a glowing electronic substitution board held up at the '
    + 'touchline at night, blank amber panel with no digits, a fourth official '
    + 'silhouette, stadium lights behind'],
  'a-releve': ['orange', 'an older supporter draping his club scarf around the shoulders '
    + 'of a young one in the stand, both smiling, warm orange light, the crowd behind'],
  'a-prolongations': ['orange', 'floodlights blazing over a stadium deep into extra '
    + 'time, long shadows stretched across the terrace, a weary but still roaring crowd, '
    + 'orange night sky'],

  /* Les trois cartes du souffle et du temps. Elles ne montrent pas un objet
     mais un *moment* : on reprend une main, on retrouve son air, on déplie une
     bâche. Le dessin doit donc raconter le geste collectif, pas l'accessoire. */
  'a-relais': ['violet', 'a capo turning to face his terrace and starting a different '
    + 'song, arms wide, the crowd behind him picking it up, fresh energy passing '
    + 'through the rows, violet night light'],
  'a-souffleneuf': ['violet', 'a supporter filling his lungs at the front of a terrace, '
    + 'head tilted back, breath visible in the cold night air, the whole stand lifting '
    + 'again around him, radiant violet glow'],
  'a-tifo': ['red', 'a giant painted banner unfurling down the whole height of a terrace, '
    + 'hundreds of hands passing it over their heads, the crowd disappearing beneath it, '
    + 'red night stadium'],
};

export const inviteDe = (id) => {
  const [couleur, sujet] = INVITES[id] ?? [];
  if (!sujet) return null;
  return `Subject: ${sujet}, glowing ${couleur} accent light.\n\n${STYLE}`;
};

/* ------------------------------------------------------------- l'exécution */

if (process.argv.includes('--invites')) {
  for (const a of ACTIONS) {
    console.log(`\n=== ${a.id} — ${a.nom} (${a.fam})\n${inviteDe(a.id) ?? '(aucune invite)'}`);
  }
  process.exit(0);
}

const sharp = (await import('sharp')).default;
await mkdir(CIBLE, { recursive: true });

if (!existsSync(SOURCE)) {
  console.error(`\n  ${SOURCE} n'existe pas.\n\n`
    + '  Les dessins produits par Artlist se déposent là, un fichier par carte,\n'
    + '  nommé de son identifiant : art/action/a-fumigene.png\n\n'
    + '  Les invites : node scripts/action-images.mjs --invites\n');
  process.exit(1);
}

const sources = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const connus = new Set(ACTIONS.map((a) => a.id));
let faits = 0;
const manquantes = [];

for (const a of ACTIONS) {
  const src = sources.find((f) => f.replace(/\.[^.]+$/, '') === a.id);
  if (!src) { manquantes.push(a.id); continue; }
  const entree = path.join(SOURCE, src);
  const base = sharp(entree).resize(LARGEUR, HAUTEUR, { fit: 'cover', position: 'centre' });
  await base.clone().avif({ quality: 62 }).toFile(path.join(CIBLE, `${a.id}.avif`));
  await base.clone().webp({ quality: 82 }).toFile(path.join(CIBLE, `${a.id}.webp`));
  await base.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(CIBLE, `${a.id}.jpg`));
  faits++;
  process.stdout.write(`\r  ${faits} carte(s) rangée(s)`);
}

/* Un fichier qui ne correspond à aucune carte est presque toujours une faute
   de frappe dans son nom — et il ne se verrait jamais, puisque la carte
   garderait simplement son dessin géométrique. */
const orphelins = sources.map((f) => f.replace(/\.[^.]+$/, '')).filter((n) => !connus.has(n));

console.log(`\n${faits} illustration(s) en trois formats dans public/img/action.`);
if (manquantes.length) console.log(`Sans dessin : ${manquantes.join(', ')}`);
if (orphelins.length) {
  console.log(`\nFichiers qui ne correspondent à aucune carte : ${orphelins.join(', ')}`);
  console.log('Vérifie leur nom : il doit être exactement l’identifiant de la carte.');
}

await writeFile(path.join(CIBLE, 'liste.json'),
  `${JSON.stringify(ACTIONS.filter((a) => !manquantes.includes(a.id)).map((a) => a.id))}\n`);
