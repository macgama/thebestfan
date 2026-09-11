/**
 * Les illustrations de l'équipement.
 *
 * Sept pièces, un objet chacune. Elles étaient un nom en gras et une phrase :
 * on choisissait « Bout de bâche » contre « Thermos » sans avoir jamais vu ni
 * l'un ni l'autre, et l'emplacement d'équipement du deck — un écran où l'on
 * passe du temps — n'était qu'un rectangle de texte.
 *
 * ## Ce que fait ce script
 *
 * Il ne génère rien. Il **détoure et range** : il prend les dessins produits
 * par Artlist, déposés dans `art/stuff/<id>.png`, découpe le fond, et en tire
 * les trois formats que le jeu sert.
 *
 * ## Pourquoi un détourage, alors que les cartes d'action n'en ont pas
 *
 * Parce que ces objets-là ne restent pas dans leur cadre. Une carte d'action
 * est une scène : elle remplit sa carte et n'en sort jamais. Une pièce
 * d'équipement est un **objet**, et un objet finit sur le personnage qui le
 * porte — une écharpe autour d'un cou, un mégaphone dans une main. Servi avec
 * son fond, il arriverait là-bas avec un carré noir autour.
 *
 * Le fond est donc demandé **plat et uniforme** à la génération, et découpé
 * ici par propagation depuis les bords : seul ce qui touche le bord et lui
 * ressemble disparaît. Les noirs intérieurs de l'objet — l'ombre d'un pli, le
 * creux d'un pavillon de mégaphone — ne sont jamais atteints, puisqu'ils ne
 * sont pas reliés au bord. C'est toute la raison d'un remplissage par
 * propagation plutôt que d'un simple seuil sur la couleur, qui, lui, aurait
 * troué les objets.
 *
 * Le format de secours est le **PNG** et pas le JPEG, contrairement aux cartes
 * d'action : ici il y a une transparence à garder, et un JPEG n'en a pas.
 *
 * Usage :  node scripts/stuff-images.mjs
 *          node scripts/stuff-images.mjs --invites   (les imprime)
 */
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = path.join(RACINE, 'art', 'stuff');
const CIBLE = path.join(RACINE, 'public', 'img', 'stuff');

/**
 * La taille servie.
 *
 * Le plus grand usage est la pastille de l'emplacement d'équipement, environ
 * cent vingt pixels de côté sur un écran à deux fois la densité. On sert donc
 * du 256 carré, et pas les mille vingt-quatre pixels du générateur : un objet
 * quatre fois trop grand ne se voit pas, il se télécharge.
 */
const COTE = 256;

/* Le style commun. Il est écrit une fois : sept objets dessinés chacun dans
   son coin ne font pas un inventaire, ils font sept images.

   Deux exigences portent tout le reste. Le **fond parfaitement plat** : c'est
   lui qui rend le détourage fiable, et un dégradé ou une ombre portée le
   ferait échouer en laissant une auréole. Et **l'objet seul** : pas de main
   qui le tient, pas de sol sous lui — la main viendra du personnage. */
const STYLE = `Style: stylised 3D game item icon, modern mobile game art,
chunky readable silhouette, bold simplified shapes, clean edges, soft key light
with a strong cool rim light separating the object from the background,
painterly texture. NOT photorealistic.

Composition: the object alone, centred, filling most of the frame, seen at a
slight three-quarter angle, floating.

Background: a completely flat, uniform, very dark navy-black (#04060A). No
gradient, no vignette, no floor, no surface, no cast shadow, no reflection, no
glow spilling onto the background.

Strictly forbidden: any text, letters, numbers, logos, real club crests, card
frame or border, human figures or hands, watermark.`;

/** Le sujet de chaque pièce. */
export const INVITES = {
  jumelles: 'a pair of compact well-used binoculars with a worn leather neck strap '
    + 'curling beside them, rubber armour, textured focus wheel',
  echarpe: 'a thick knitted football supporter scarf, chunky wool with bold horizontal '
    + 'stripes, folded over on itself with the ends hanging, slightly worn, no text and '
    + 'no crest on it',
  tambour: 'a small hand-held supporter drum, a shallow wooden shell with a taut skin '
    + 'and rope tensioning, a canvas shoulder strap, one worn wooden beater resting '
    + 'against it',
  /* La capuche est la seule pièce qui se porte : il faut donc dire deux fois
     qu'elle est vide, sinon le modèle met quelqu'un dedans — et on se retrouve
     avec une tête encagoulée, ce qui n'est pas le jeu qu'on fait. */
  capuche: 'a dark grey hooded sweatshirt, empty and unworn, neatly bundled with its '
    + 'hood standing up and open at the front, drawstrings hanging, worn fabric. Nobody '
    + 'is wearing it, the hood is empty and you can see through the opening',
  megaphone: 'a battered handheld megaphone, wide flared horn, pistol grip with a '
    + 'trigger, a short carrying strap, scuffed paint and dents',
  thermos: 'a battered metal vacuum flask, dented brushed steel body, its screw-on cup '
    + 'sitting beside it, a faint wisp of steam rising from the open neck',
  bache: 'a heavy plain tarpaulin banner, rolled and bundled into a thick coil, brass '
    + 'eyelets along its edge, a length of rope threaded through them, creased and '
    + 'weather-stained canvas, completely blank with nothing painted on it',
};

export const inviteDe = (id) => (INVITES[id]
  ? `Subject: ${INVITES[id]}.\n\n${STYLE}` : null);

/* ------------------------------------------------------------- le détourage */

/**
 * Jusqu'où une couleur compte encore comme le fond.
 *
 * Le fond demandé est un noir bleuté uni, mais un générateur d'images ne rend
 * jamais deux pixels exactement identiques : il reste un bruit de quelques
 * unités. Trop bas, le seuil laisse un grain de fond tout autour de l'objet ;
 * trop haut, il mange les parties sombres de l'objet reliées au bord — la
 * sangle noire d'un mégaphone qui sort du cadre. Quarante-quatre est la valeur
 * qui passe les sept pièces, vérifiée à l'œil sur une planche contact.
 */
const TOLERANCE = 44;

/** Largeur de l'adoucissement du bord, en pixels. */
const FRANGE = 1.2;

/**
 * Rend l'image transparente partout où le fond se propage depuis les bords.
 *
 * On part de **tous** les pixels du bord, pas d'un coin : un objet qui touche
 * un côté couperait le fond en deux, et la moitié non visitée resterait
 * opaque. C'est arrivé sur une première version avec le mégaphone, dont la
 * sangle sortait par la droite.
 */
function detourer({ data, width, height }, reference) {
  const n = width * height;
  const fond = new Uint8Array(n);
  const pile = [];

  const ressemble = (i) => {
    const p = i * 4;
    return Math.abs(data[p] - reference[0]) <= TOLERANCE
      && Math.abs(data[p + 1] - reference[1]) <= TOLERANCE
      && Math.abs(data[p + 2] - reference[2]) <= TOLERANCE;
  };

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const i = y * width + x;
      if (!fond[i] && ressemble(i)) { fond[i] = 1; pile.push(i); }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const i = y * width + x;
      if (!fond[i] && ressemble(i)) { fond[i] = 1; pile.push(i); }
    }
  }

  while (pile.length) {
    const i = pile.pop();
    const x = i % width;
    const y = (i - x) / width;
    if (x > 0) { const j = i - 1; if (!fond[j] && ressemble(j)) { fond[j] = 1; pile.push(j); } }
    if (x < width - 1) { const j = i + 1; if (!fond[j] && ressemble(j)) { fond[j] = 1; pile.push(j); } }
    if (y > 0) { const j = i - width; if (!fond[j] && ressemble(j)) { fond[j] = 1; pile.push(j); } }
    if (y < height - 1) { const j = i + width; if (!fond[j] && ressemble(j)) { fond[j] = 1; pile.push(j); } }
  }

  for (let i = 0; i < n; i++) data[i * 4 + 3] = fond[i] ? 0 : 255;
  return { decoupes: fond.reduce((s, v) => s + v, 0), total: n };
}

/* ------------------------------------------------------------- l'exécution */

if (process.argv.includes('--invites')) {
  for (const s of STUFF) {
    console.log(`\n=== ${s.id} — ${s.nom} (${s.rar})\n${inviteDe(s.id) ?? '(aucune invite)'}`);
  }
  process.exit(0);
}

const sharp = (await import('sharp')).default;
await mkdir(CIBLE, { recursive: true });

if (!existsSync(SOURCE)) {
  console.error(`\n  ${SOURCE} n'existe pas.\n\n`
    + '  Les dessins produits par Artlist se déposent là, un fichier par pièce,\n'
    + '  nommé de son identifiant : art/stuff/echarpe.png\n\n'
    + '  Les invites : node scripts/stuff-images.mjs --invites\n');
  process.exit(1);
}

const sources = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const connus = new Set(STUFF.map((s) => s.id));
let faits = 0;
const manquantes = [];
const suspectes = [];

for (const s of STUFF) {
  const src = sources.find((f) => f.replace(/\.[^.]+$/, '') === s.id);
  if (!src) { manquantes.push(s.id); continue; }

  const entree = path.join(SOURCE, src);
  const { data, info } = await sharp(entree).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });

  /* La couleur de référence est lue dans un coin, pas écrite en dur : le
     générateur rend le noir demandé à quelques unités près, et d'une image à
     l'autre ce n'est pas le même écart. */
  const reference = [data[0], data[1], data[2]];
  const { decoupes, total } = detourer({ data, width: info.width, height: info.height },
    reference);

  /* Un détourage qui n'emporte presque rien, ou presque tout, a raté : dans le
     premier cas le fond n'était pas celui qu'on croit, dans le second l'objet
     lui-même a été mangé. Les deux donnent une image que personne ne regarde
     avant la mise en ligne, donc on le dit ici. */
  const part = decoupes / total;
  if (part < 0.2 || part > 0.92) suspectes.push(`${s.id} (${Math.round(part * 100)} % de fond)`);

  /* On adoucit **le masque seul**, jamais l'image.
     Un flou posé sur les quatre canaux ensemble rendait aussi le dessin flou :
     la maille de l'écharpe et les dents du pavillon du mégaphone y perdaient
     tout leur piqué, pour un bord qu'on ne regarde jamais de si près. */
  const n = info.width * info.height;
  const rvb = Buffer.allocUnsafe(n * 3);
  const alpha = Buffer.allocUnsafe(n);
  for (let i = 0; i < n; i++) {
    rvb[i * 3] = data[i * 4];
    rvb[i * 3 + 1] = data[i * 4 + 1];
    rvb[i * 3 + 2] = data[i * 4 + 2];
    alpha[i] = data[i * 4 + 3];
  }
  /* `toColourspace('b-w')` n'est pas décoratif : sans lui, sharp **rend trois
     canaux** pour un masque qui n'en a qu'un. `joinChannel` relit alors le
     tampon avec un pas de un, décale chaque ligne d'un tiers, et sort un objet
     cisaillé — une image fausse, jamais une erreur. La vérification de
     longueur juste en dessous est là pour que ça se dise, si le jour vient où
     une version de sharp change encore d'avis. */
  const masque = await sharp(alpha, { raw: { width: info.width, height: info.height, channels: 1 } })
    .blur(FRANGE).toColourspace('b-w').raw().toBuffer();
  if (masque.length !== n) {
    throw new Error(`masque de ${s.id} : ${masque.length} octets pour ${n} pixels `
      + `(${masque.length / n} canaux au lieu d'un). Le détourage sortirait cisaillé.`);
  }

  /* Le recollage et la réduction se font en **deux passes**, et pas en une.
     `joinChannel` recolle en fin de chaîne, à la taille d'origine : un
     `resize` posé dans la même chaîne est silencieusement sans effet, et les
     fichiers sortaient en mille vingt-quatre pixels — quatre fois trop lourds,
     sans un mot d'erreur. */
  const pleine = await sharp(rvb, { raw: { width: info.width, height: info.height, channels: 3 } })
    .joinChannel(masque, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png().toBuffer();

  const decoupe = await sharp(pleine)
    .resize(COTE, COTE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  await sharp(decoupe).avif({ quality: 66 }).toFile(path.join(CIBLE, `${s.id}.avif`));
  await sharp(decoupe).webp({ quality: 86 }).toFile(path.join(CIBLE, `${s.id}.webp`));
  await sharp(decoupe).png({ compressionLevel: 9, palette: true })
    .toFile(path.join(CIBLE, `${s.id}.png`));
  faits++;
  process.stdout.write(`\r  ${faits} pièce(s) rangée(s)`);
}

const orphelins = sources.map((f) => f.replace(/\.[^.]+$/, '')).filter((n) => !connus.has(n));

console.log(`\n${faits} pièce(s) détourée(s) en trois formats dans public/img/stuff.`);
if (manquantes.length) console.log(`Sans dessin : ${manquantes.join(', ')}`);
if (suspectes.length) {
  console.log(`\nDétourage douteux — à regarder : ${suspectes.join(', ')}`);
  console.log('Le fond du dessin est-il bien plat et uniforme ?');
}
if (orphelins.length) {
  console.log(`\nFichiers qui ne correspondent à aucune pièce : ${orphelins.join(', ')}`);
  console.log('Vérifie leur nom : il doit être exactement l’identifiant de la pièce.');
}

await writeFile(path.join(CIBLE, 'liste.json'),
  `${JSON.stringify(STUFF.filter((s) => !manquantes.includes(s.id)).map((s) => s.id))}\n`);
