/**
 * Chaîne de production des états d'un Fanzzy.
 *
 * Elle produit l'arborescence que le jeu sert :
 *
 *   public/img/fanzzy/TR1/
 *     manifeste.json
 *     e1/base/neutre.{avif,webp,png}   … les douze états
 *              portrait.{avif,webp,png}
 *     e1/hiver/…                        un skin, états partiels
 *     e2/…  e3/…
 *
 * Les sources restent dans `art/TR1/_src/`, **hors de `public/`**. Tout ce qui
 * est sous `public/` est servi tel quel : y laisser les rendus d'origine, c'est
 * publier cinq mégaoctets par image et les prompts avec. Ce projet a déjà payé
 * cette faute une fois, avec une copie du télétexte qui exposait ses requêtes
 * SQL sur `thebestfan.online/index.js`.
 *
 * Usage :
 *   node scripts/fanzzy-art.mjs art/TR1/_src            → e1, skin « base »
 *   node scripts/fanzzy-art.mjs art/TR1/_src --skin hiver --repli base
 *
 * Les fichiers d'entrée se nomment `<numéro>[evo2|evo3]-<état>.png`, comme les
 * rendus arrivent — `001-neutre.png`, `001evo2-victoire.png`. Le numéro est
 * traduit en identifiant de catalogue par `src/shared/fanzzy/rendus.js` ; un
 * fichier déjà nommé avec l'identifiant (`TR1-neutre.png`) marche aussi.
 *
 * ---
 *
 * **Les états d'une même évolution partagent un cadrage.** C'est la seule
 * chose subtile ici, et elle a déjà coûté une reprise sur les quatre poses du
 * supporter : recadrer chaque dessin sur son propre sujet fait rapetisser le
 * personnage dès qu'il lève les bras, et ses pieds remontent de trente pixels
 * au moment du but. L'œil ne voit pas un état changer, il voit un défaut
 * d'affichage. On calcule donc une seule boîte, l'union de tous les états de
 * l'évolution, et on l'applique à tous.
 */
import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { PAR_NUMERO, ETATS } from '../src/shared/fanzzy/rendus.js';
import { agreger } from './fanzzy-manifeste.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SORTIE_DEFAUT = path.join(RACINE, 'public', 'img', 'fanzzy');

/** Le cadre de sortie, au rapport des rendus fournis. */
const CADRE = { l: 560, h: 960 };
const PORTRAIT = { l: 320, h: 320 };

const args = process.argv.slice(2);
const drapeau = (nom, defaut = null) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut;
};
const SOURCE = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const SKIN = drapeau('skin', 'base');
const REPLI = drapeau('repli', null);
const SORTIE = drapeau('sortie') ? path.resolve(drapeau('sortie')) : SORTIE_DEFAUT;

if (!SOURCE) {
  console.error('Usage : node scripts/fanzzy-art.mjs <dossier-source> '
    + '[--skin base] [--repli base] [--sortie public/img/fanzzy]');
  process.exit(1);
}

/* ------------------------------------------------------------ détourage */

/**
 * L'alpha du sujet.
 *
 * Les rendus arrivent avec leur transparence : elle est exacte là où toute
 * reconstruction est approximative — mèches, franges d'écharpe, doigts. On ne
 * devine un fond que si le fichier n'a rien à dire.
 */
function alphaDuSujet(data, l, h, c) {
  if (c === 4) {
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) {
        const a = new Uint8Array(l * h);
        for (let p = 0; p < l * h; p++) a[p] = data[p * 4 + 3];
        return { alpha: a, via: 'alpha du rendu' };
      }
    }
  }
  // Fond plein : on écarte ce qui ressemble au coin supérieur gauche. Les
  // seuils sont serrés — un fond gris moyen est à portée d'une veste olive, et
  // un seuil large laisse passer le décor à travers les vêtements.
  const [fr, fg, fb] = [data[0], data[1], data[2]];
  const a = new Uint8Array(l * h);
  for (let p = 0; p < l * h; p++) {
    const i = p * c;
    const d = Math.abs(data[i] - fr) + Math.abs(data[i + 1] - fg) + Math.abs(data[i + 2] - fb);
    a[p] = d > 30 ? 255 : 0;
  }
  return { alpha: a, via: 'fond uni écarté' };
}

const boite = (alpha, l, h) => {
  let x0 = l, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (alpha[y * l + x] <= 24) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
};

async function analyser(fichier) {
  const { data, info } = await sharp(fichier).ensureAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const { width: l, height: h, channels: c } = info;
  const { alpha, via } = alphaDuSujet(data, l, h, c);
  const b = boite(alpha, l, h);
  if (!b) throw new Error(`${path.basename(fichier)} : aucun sujet trouvé`);
  const rgba = Buffer.alloc(l * h * 4);
  for (let p = 0; p < l * h; p++) {
    rgba[p * 4] = data[p * c];
    rgba[p * 4 + 1] = data[p * c + 1];
    rgba[p * 4 + 2] = data[p * c + 2];
    rgba[p * 4 + 3] = alpha[p];
  }
  return { rgba, alpha, l, h, boite: b, via };
}

/* --------------------------------------------------------------- écriture */

/**
 * Les trois formats, toujours.
 *
 * Le manifeste ne liste que les états : l'extension se décide dans le
 * navigateur, qui sonde AVIF puis WebP puis PNG. Ne produire que de l'AVIF
 * laisserait un personnage invisible chez qui ne le lit pas — sans erreur,
 * sans message, juste un trou à l'écran.
 */
const FORMATS = [
  ['avif', (i) => i.avif({ quality: 62 })],
  ['webp', (i) => i.webp({ quality: 82 })],
  ['png', (i) => i.png({ compressionLevel: 9 })],
];

async function ecrire(img, dossier, nom, empreinte) {
  for (const [ext, fn] of FORMATS) {
    const buf = await fn(img.clone()).toBuffer();
    await writeFile(path.join(dossier, `${nom}.${ext}`), buf);
    // L'empreinte ne porte que sur le PNG : il est sans perte, donc stable
    // d'une version de l'encodeur à l'autre. Hacher l'AVIF ferait bouger `rev`
    // à chaque mise à jour de sharp, sans qu'un pixel ait changé.
    if (ext === 'png') empreinte.update(buf);
  }
}

/**
 * Le portrait : un carré centré sur la tête, pas sur le sujet.
 *
 * Centrer sur la matière la plus haute rate — un bras levé monte plus haut
 * qu'un crâne, et l'état « but » a les deux bras en l'air. On érode le masque :
 * les bras et les objets tenus sont trop fins et disparaissent, la tête
 * survit.
 */
function centreTete(alpha, l, h, b, rayon) {
  const dur = (x, y) => x >= 0 && y >= 0 && x < l && y < h && alpha[y * l + x] >= 128;
  const erode = (x, y) => {
    for (let dy = -rayon; dy <= rayon; dy++) {
      for (let dx = -rayon; dx <= rayon; dx++) {
        if (dx * dx + dy * dy > rayon * rayon) continue;
        if (!dur(x + dx, y + dy)) return false;
      }
    }
    return true;
  };
  const hauteur = b.y1 - b.y0;
  let sommet = -1;
  for (let y = b.y0; y <= b.y0 + hauteur * 0.5 && sommet < 0; y++) {
    for (let x = b.x0; x <= b.x1; x++) if (erode(x, y)) { sommet = y; break; }
  }
  if (sommet < 0) return { x: (b.x0 + b.x1) / 2, y: b.y0 + hauteur * 0.12 };
  const bas = Math.min(b.y1, sommet + hauteur * 0.16);
  let somme = 0, n = 0;
  for (let y = sommet; y <= bas; y++) {
    for (let x = b.x0; x <= b.x1; x++) if (erode(x, y)) { somme += x; n++; }
  }
  return { x: n ? somme / n : (b.x0 + b.x1) / 2, y: sommet + hauteur * 0.06 };
}

/* ----------------------------------------------------------------- lecture */

/** `001evo2-victoire.png` → { num:'001', evo:2, etat:'victoire' } */
function lireNom(f) {
  const base = path.basename(f, path.extname(f)).toLowerCase();
  const m = /^([a-z0-9]+?)(?:evo([23]))?-([a-z]+)$/.exec(base);
  if (!m) return null;
  return { cle: m[1], evo: Number(m[2] ?? 1), etat: m[3] };
}

/* -------------------------------------------------------------------- main */

const fichiers = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!fichiers.length) {
  console.error(`Aucune image dans ${SOURCE}.`);
  process.exit(1);
}

// Regroupement par évolution. Un lot peut mélanger e1 et e2 : chaque évolution
// a son propre cadrage commun, parce que le personnage change de silhouette en
// grandissant et qu'un cadre partagé entre stades le ferait rétrécir.
const parEvo = new Map();
const ignores = [];
let cle = null;
for (const f of fichiers.sort()) {
  const n = lireNom(f);
  if (!n || !ETATS.includes(n.etat)) { ignores.push(f); continue; }
  cle ??= n.cle;
  if (n.cle !== cle) { ignores.push(f); continue; }
  if (!parEvo.has(n.evo)) parEvo.set(n.evo, new Map());
  parEvo.get(n.evo).set(n.etat, path.join(SOURCE, f));
}

if (!parEvo.size) {
  console.error(`Aucun état reconnu dans ${SOURCE}. Les fichiers doivent s'appeler `
    + `<numéro>[evo2|evo3]-<état>.png, par exemple 001-neutre.png ou `
    + `001evo2-victoire.png. États connus : ${ETATS.join(', ')}.`);
  process.exit(1);
}

// Le numéro de rendu vers l'identifiant du catalogue. Un fichier déjà nommé
// avec l'identifiant passe tel quel — c'est utile pour refaire un seul état.
const ID = PAR_NUMERO.get(cle) ?? cle.toUpperCase();
if (!PAR_NUMERO.has(cle) && !/^[A-Z]{2}\d+$|^[A-Z]\d+$/.test(ID)) {
  console.error(`« ${cle} » n'est ni un numéro de rendu connu ni un identifiant `
    + 'de catalogue. Ajoute-le à src/shared/fanzzy/rendus.js, ou renomme les '
    + 'fichiers avec l\'identifiant.');
  process.exit(1);
}

const dossierId = path.join(SORTIE, ID);
const cheminManifeste = path.join(dossierId, 'manifeste.json');

/**
 * Le manifeste est **produit**, jamais écrit à la main.
 *
 * Écrit à la main, ce serait une seconde vérité à côté du disque : un fichier
 * ajouté ou supprimé, et il ment sans que rien ne le dise. Ce projet a déjà
 * payé deux fois cette duplication — le catalogue recopié dans la page, puis le
 * tirage recopié dans la page.
 *
 * Il ne porte pas le nom du Fanzzy non plus : le nom vit en base et se modifie
 * depuis l'administration. Deux endroits, deux noms, dès le premier jour.
 */
let manifeste = { id: ID, rev: 0, evolutions: {} };
try { manifeste = JSON.parse(await readFile(cheminManifeste, 'utf8')); }
catch { /* premier passage */ }

const compte = [];
for (const [evo, etats] of [...parEvo].sort((a, b) => a[0] - b[0])) {
  const dossier = path.join(dossierId, `e${evo}`, SKIN);
  await mkdir(dossier, { recursive: true });

  const lus = new Map();
  for (const [etat, f] of etats) lus.set(etat, await analyser(f));

  const tailles = new Set([...lus.values()].map((a) => `${a.l}×${a.h}`));
  if (tailles.size > 1) {
    console.error(`e${evo} : les états n'ont pas tous la même taille (${[...tailles].join(', ')}). `
      + 'Le cadrage commun suppose des rendus au même format — c\'est ce qui garde '
      + 'les pieds du personnage à la même hauteur d\'un état à l\'autre.');
    process.exit(1);
  }

  // La boîte commune : l'union de tous les états de cette évolution.
  const u = [...lus.values()].map((a) => a.boite).reduce((a, b) => ({
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
  }));
  const { l, h } = [...lus.values()][0];
  const cadre = { left: u.x0, top: u.y0, width: u.x1 - u.x0 + 1, height: u.y1 - u.y0 + 1 };

  const empreinte = createHash('sha1');
  for (const etat of ETATS) {
    const a = lus.get(etat);
    if (!a) continue;
    const decoupe = await sharp(a.rgba, { raw: { width: l, height: h, channels: 4 } })
      .extract(cadre)
      // `.png()` avant `.toBuffer()` : un tampon issu de pixels bruts repart en
      // pixels bruts, et sharp ne sait pas les relire sans leurs dimensions.
      .png().toBuffer();
    await ecrire(sharp(decoupe).resize({
      width: CADRE.l, height: CADRE.h, fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }), dossier, etat, empreinte);
  }

  /**
   * Le portrait ne se tire que de `neutre`, ou pas du tout.
   *
   * On peut le calculer depuis n'importe quel état, et c'est une mauvaise
   * idée : sur « victoire » les bras sont en l'air, l'érosion prend un poignet
   * pour un crâne, et le buste sort cadré sur la poitrine. Mieux vaut aucun
   * portrait qu'un portrait de travers — le jeu retombera sur celui du stade
   * précédent, ou sur le plein-pied.
   */
  const source = lus.get('neutre');
  if (source) {
    const rayon = Math.max(3, Math.round((source.boite.x1 - source.boite.x0) * 0.035));
    const tete = centreTete(source.alpha, l, h, source.boite, rayon);
    const cote = Math.round((source.boite.y1 - source.boite.y0) * 0.42);
    const gx = Math.max(0, Math.min(l - cote, Math.round(tete.x - cote / 2)));
    const gy = Math.max(0, Math.min(h - cote, Math.round(tete.y - cote * 0.08)));
    await ecrire(sharp(source.rgba, { raw: { width: l, height: h, channels: 4 } })
      .extract({ left: gx, top: gy, width: Math.min(cote, l - gx), height: Math.min(cote, h - gy) })
      .resize(PORTRAIT.l, PORTRAIT.h, { fit: 'cover' }), dossier, 'portrait', empreinte);
  }

  const eCle = `e${evo}`;
  manifeste.evolutions[eCle] ??= { skins: {} };
  manifeste.evolutions[eCle].skins[SKIN] = {
    etats: ETATS.filter((e) => lus.has(e)),
    portrait: lus.has('neutre'),
    // Le repli d'un skin partiel. `base` n'en a pas : c'est lui le dernier
    // recours, et un repli circulaire ferait boucler la résolution.
    ...(SKIN !== 'base' && REPLI ? { repli: REPLI } : {}),
    sha: empreinte.digest('hex').slice(0, 12),
  };
  compte.push({ evo: eCle, etats: lus.size, cadre: `${cadre.width}×${cadre.height}` });
}

/**
 * `rev` sert au cache. `/img` est servi en `immutable, 365 jours` : sans un
 * numéro qui change, une carte redessinée n'atteint jamais quelqu'un qui l'a
 * déjà chargée. Il n'augmente que si une empreinte a bougé — republier à
 * l'identique ne force personne à retélécharger.
 */
const avant = JSON.stringify(manifeste.evolutions);
manifeste.rev = (manifeste.rev ?? 0);
try {
  const ancien = JSON.parse(await readFile(cheminManifeste, 'utf8'));
  if (JSON.stringify(ancien.evolutions) !== avant) manifeste.rev = (ancien.rev ?? 0) + 1;
  else manifeste.rev = ancien.rev ?? 1;
} catch { manifeste.rev = 1; }

await writeFile(cheminManifeste, `${JSON.stringify(manifeste, null, 2)}\n`);

console.log(`${ID}  (rendu ${cle})  skin « ${SKIN} »  rev ${manifeste.rev}`);
for (const c of compte) console.log(`  ${c.evo} : ${c.etats} état(s), cadre commun ${c.cadre}`);
const absents = ETATS.filter((e) => !manifeste.evolutions.e1?.skins?.[SKIN]?.etats?.includes(e));
if (absents.length) {
  console.log(`  absents en e1 : ${absents.join(', ')} — ils retomberont sur « neutre »`);
}
for (const f of ignores) console.log(`  ignoré : ${f}`);

// L'agrégat se refait à chaque passage, sans qu'on ait à y penser. C'est la
// seule façon qu'il reste juste : reconstruit à la main, il finit par décrire
// un état du disque qui n'existe plus, et le jeu demande des images absentes.
const agr = await agreger(SORTIE);
console.log(`\n→ ${path.relative(RACINE, dossierId)}`);
console.log(`  index.json : ${agr.fanzzy} Fanzzy, ${(agr.octets / 1024).toFixed(1)} Ko`);
