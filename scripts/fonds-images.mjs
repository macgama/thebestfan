#!/usr/bin/env node
/**
 * Les décors peints, une plaque par série et par rareté.
 * ======================================================
 *
 * ## Ce qu'ils ajoutent, et ce qu'ils ne remplacent pas
 *
 * `public/fanzzy-fond.js` dessine un décor pour chaque carte : un lieu par
 * série, une palette par tenue, une lumière par âge, une aura par rareté. Ça
 * couvre les treize séries sans un seul fichier, ça change d'époque avec le
 * costume, et une saison neuve en hérite le jour où on l'ajoute.
 *
 * Une plaque peinte ne sait rien faire de tout ça. Elle ne sait faire qu'une
 * chose, que le dessin ne fera jamais : **être belle**.
 *
 * Les deux cohabitent donc, et la règle est stricte — la plaque remplace le
 * *lieu*, rien d'autre. Le motif de famille, la lumière de l'âge et l'aura de
 * rareté se posent par-dessus, comme avant. Une carte sans plaque garde son
 * décor dessiné, et c'est le cas de douze séries sur treize.
 *
 * ## Pourquoi seulement la tenue de base
 *
 * Parce qu'une tenue fait basculer toute la palette : le même comptoir en
 * nocturne, en ocre préhistorique, en cendre apocalyptique. Une plaque peinte
 * en fin d'été ne devient pas préhistorique, et la poser sous une tenue qui
 * l'est ferait mentir la seule chose qui rend une tenue visible de loin.
 *
 * Quatre plaques par série, c'est déjà cinquante-deux images pour le catalogue
 * actuel et quatre de plus à chaque saison. Les multiplier par les tenues n'a
 * pas de fin.
 *
 *   node scripts/fonds-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(RACINE, 'art', 'fonds');
const CIBLE = path.join(RACINE, 'public', 'img', 'fonds');
const MODULE = path.join(RACINE, 'public', 'fanzzy-fond.js');

/* La vitrine de la fiche monte à six cents pixels de large sur un grand écran.
   On double pour les écrans à forte densité et on s'arrête là : un décor est
   derrière un personnage, il n'a pas à être net au pixel. */
const LARGEUR = 720;
const HAUTEUR = 1080;

const RARETES = ['commune', 'rare', 'epique', 'legendaire'];

/* Le catalogue des tenues, pour distinguer « halloween-commune » d'une faute
   de frappe. Il renseigne, il ne refuse jamais : voir `inconnues` plus bas. */
const { SKINS } = await import('../src/shared/fanzzy/inventaire.js');
const TENUES = new Set(SKINS.map((s) => s.id));

/* ---------------------------------------------------------- les invites

   Ses deux voisins — `action-images` et `stuff-images` — gardent leurs
   invites dans le code et savent les imprimer. Celui-ci ne le faisait pas,
   et les quatre plaques de LA REPRISE ont donc été produites sans qu'on
   garde la recette. Le jour où il en faut une cinquième, ou celles d'une
   série neuve, il n'y a rien à relire : on recommence à tâtons, et le lot
   ne ressemble plus au premier.

       node scripts/fonds-images.mjs --invites

   Ce que le format impose, et qui n'est pas négociable :

   1. **Portrait 2:3**, 720×1080 servis. La plaque est recadrée en `cover` —
      un rendu carré perdrait ses bords gauche et droit.

   2. **Le tiers bas reste vide et calme.** C'est là que le personnage se
      tient, détouré, par-dessus. Un décor chargé en bas le rend illisible,
      et c'est le personnage qu'on vient voir.

   3. **Aucun personnage net.** Des silhouettes lointaines, jamais un visage
      ni une figure au premier plan : deux personnages sur la même carte se
      disputent le regard.

   4. **Palette sourde.** Le jeu pose par-dessus l'aura de rareté, le motif
      de famille et la lumière de l'âge. Un décor saturé les écrase, et il
      ne reste qu'une image bruyante.

   5. Ni texte, ni chiffre, ni écusson — la règle de tout le jeu.           */

const STYLE_FOND = `Style: painterly digital illustration, flat shapes and soft
gradients, restrained desaturated palette, calm and atmospheric. NOT
photorealistic, NOT a 3D render, NOT a busy scene.

Composition: vertical portrait 2:3. A football terrace or stand interior seen
from within it. The LOWER THIRD of the frame must stay simple, open and
uncluttered — a character will be composited standing there. No figure in the
foreground; at most a few small distant silhouettes high up.

Strictly forbidden: any text, letters, numbers, club crests, sponsor boards,
scoreboards, watermark, faces, foreground characters.`;

/**
 * Le sujet de chaque plaque, par rareté.
 *
 * **La rareté est une intensité de lieu, pas une quantité d'or.** Une
 * commune est un gradin ordinaire, une légendaire est le même gradin à son
 * heure la plus rare. C'est ce qui permet à une commune de rester belle — et
 * une collection dont les communes sont laides est une collection qu'on
 * n'ouvre pas.
 */
export const INVITES = {
  halloween: {
    commune: 'an empty concrete terrace on the evening of 31 October, dusk '
      + 'already blue, a few carved pumpkins set along the crush barriers and '
      + 'lit from inside, thin mist gathering low on the steps',
    rare: 'an empty terrace at night under an enormous low orange moon, the '
      + 'concrete steps washed amber, long bare tree branches reaching over the '
      + 'back of the stand, drifting mist',
    epique: 'an empty terrace at night lit only by green and violet floodlight '
      + 'haze, thick fog pouring down the steps, bats crossing high above, the '
      + 'back of the stand lost in darkness',
    legendaire: 'an empty terrace at night on All Hallows, a colossal blood-red '
      + 'moon filling the sky behind the stand, the concrete steps glowing faint '
      + 'crimson, heavy fog, a single line of guttering candles along the front '
      + 'barrier',
  },
};

export const inviteDe = (cle) => {
  const [famille, rarete] = String(cle).split('-');
  const sujet = INVITES[famille]?.[rarete];
  return sujet ? `Subject: ${sujet}.\n\n${STYLE_FOND}` : null;
};

if (process.argv.includes('--invites')) {
  for (const [famille, par] of Object.entries(INVITES)) {
    for (const rarete of RARETES) {
      const cle = `${famille}-${rarete}`;
      console.log(`\n=== ${cle}  →  art/fonds/${cle}.png`);
      console.log(inviteDe(cle) ?? '(aucune invite)');
    }
  }
  console.log('\nDépose les fichiers dans art/fonds/, puis : npm run fonds');
  process.exit(0);
}

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('sharp est absent. Sur ton PC : npm install');
  console.error('Sur le serveur : npm install --include=optional sharp');
  process.exitCode = 1;
}

if (sharp) {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Rien à faire : ${path.relative(RACINE, SOURCE)} n'existe pas.`);
    process.exitCode = 1;
  } else {
    fs.mkdirSync(CIBLE, { recursive: true });

    const plaques = fs.readdirSync(SOURCE)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort();

    const faits = [];
    const rejetes = [];
    /* Une tenue absente du catalogue n'est pas une faute : l'administration en
       crée sans livraison, et ce script tourne sur un poste qui n'a pas la
       base. On le **signale** sans rien refuser — une plaque produite pour une
       tenue pas encore déclarée ne gêne personne, une plaque refusée à tort
       coûte un aller-retour au dessinateur. */
    const inconnues = new Set();

    for (const fichier of plaques) {
      const code = path.basename(fichier, path.extname(fichier));

      /* Le nom porte la règle, et il y en a maintenant **deux** :

           RP-commune          — <SÉRIE> en deux majuscules : plaque de série
           halloween-commune   — <tenue> en minuscules : plaque de tenue

         Les deux espaces de noms ne peuvent pas se croiser : un identifiant de
         série est exactement deux majuscules, celui d'une tenue commence par
         une minuscule. C'est ce qui permet à `plaque()` de choisir sa famille
         sans avoir à se demander laquelle des deux il regarde.

         On refuse plutôt que de deviner — une plaque mal nommée ne
         s'afficherait jamais, et chercher pourquoi coûte une heure. */
      const m = /^([A-Z]{2}|[a-z][a-z0-9]*)-(commune|rare|epique|legendaire)$/.exec(code);
      if (!m) { rejetes.push(code); continue; }
      if (/^[a-z]/.test(m[1]) && !TENUES.has(m[1])) inconnues.add(m[1]);

      const img = sharp(path.join(SOURCE, fichier))
        .resize(LARGEUR, HAUTEUR, { fit: 'cover', position: 'centre' });

      await Promise.all([
        img.clone().webp({ quality: 82 }).toFile(path.join(CIBLE, `${code}.webp`)),
        img.clone().avif({ quality: 58 }).toFile(path.join(CIBLE, `${code}.avif`)),
        img.clone().png({ compressionLevel: 9 }).toFile(path.join(CIBLE, `${code}.png`)),
      ]);

      const poids = fs.statSync(path.join(CIBLE, `${code}.webp`)).size;
      console.log(`  ok   ${code.padEnd(16)} ${LARGEUR}×${HAUTEUR} · webp ${Math.round(poids / 1024)} ko`);
      faits.push(code);
    }

    if (rejetes.length) {
      console.error(`\nIgnorées, nom hors règle « <SÉRIE>-<rareté> » ni « <tenue>-<rareté> » : ${rejetes.join(', ')}`);
      console.error(`Raretés acceptées : ${RARETES.join(', ')}`);
      process.exitCode = 1;
    }
    if (inconnues.size) {
      console.log('');
      console.log(`Tenue(s) hors catalogue, produites quand même : ${[...inconnues].join(', ')}`);
      console.log('Pour qu’une tenue se porte, ajoute-la à SKINS dans'
        + ' src/shared/fanzzy/inventaire.js, ou crée-la depuis /admin.');
    }

    /* La liste est réécrite dans le module, comme `maj-illustres.mjs` le fait
       pour les Fanzzy dessinés. Un manifeste JSON demanderait une requête et
       un état asynchrone à un module qui rend du SVG en une ligne. */
    const brut = fs.readFileSync(MODULE, 'utf8');
    const crlf = brut.includes('\r\n');
    let s = brut.replace(/\r\n/g, '\n');
    const DEBUT = '  const FONDS = new Set([';
    const FIN = '  ]);';
    const i = s.indexOf(DEBUT);
    const j = s.indexOf(FIN, i);
    if (i < 0 || j < 0) {
      console.error('bornes de FONDS introuvables dans fanzzy-fond.js');
      process.exitCode = 1;
    } else {
      const liste = faits.sort().map((c) => `    '${c}',`).join('\n');
      s = s.slice(0, i) + DEBUT + '\n' + liste + '\n' + s.slice(j);
      fs.writeFileSync(MODULE, crlf ? s.replace(/\n/g, '\r\n') : s);
      console.log(`\n${faits.length} plaque(s) publiée(s), et la liste est à jour dans fanzzy-fond.js.`);
    }
  }
}
