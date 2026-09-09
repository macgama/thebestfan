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
 *   node scripts/fanzzy-art.mjs art/TR1/_src
 *
 * Tout le lot passe d'un coup : les trois âges, toutes les tenues, les objets
 * portés et les objets seuls. Rien à déclarer en ligne de commande — c'est le
 * **nom du fichier** qui dit ce que contient chaque image :
 *
 *   <numéro>-<âge>-<tenue>-<état>[-<objet>].png
 *   stuff-<objet>.png
 *
 *   001-e1-base-neutre.png
 *   001-e2-prehistorique-neutre.png
 *   001-e3-base-neutre-drapeau.png
 *   stuff-drapeau.png
 *
 * Quatre champs obligatoires, un cinquième facultatif. Les positions sont
 * fixes : le découpage ne devine rien. L'ancienne forme — `001-neutre`,
 * `001evo2-victoire` — collait un âge optionnel au numéro, il fallait deviner
 * où finissait le nombre, et rien n'y exprimait une tenue.
 *
 * Le numéro est traduit en identifiant de catalogue par
 * `src/shared/fanzzy/rendus.js` ; un fichier nommé avec l'identifiant
 * (`TR1-e1-base-neutre.png`) marche aussi.
 *
 * ---
 *
 * **Tout un âge partage un cadrage** — ses douze états, ses tenues et ses
 * objets portés. C'est la seule chose subtile ici, et elle a déjà coûté une
 * reprise sur les quatre poses du
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
/* Un objet d'inventaire se regarde dans une liste, pas en pied : deux cent
   cinquante pixels de côté suffisent, et il se recadre sur lui-même — il n'a
   personne avec qui aligner ses pieds. */
const OBJET = { l: 250, h: 250 };

const args = process.argv.slice(2);
const drapeau = (nom, defaut = null) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : defaut;
};
const SOURCE = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));

const SORTIE = drapeau('sortie') ? path.resolve(drapeau('sortie')) : SORTIE_DEFAUT;

if (!SOURCE) {
  console.error('Usage : node scripts/fanzzy-art.mjs <dossier-source> '
    + '[--sortie public/img/fanzzy]');
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

/**
 * Le nom d'un rendu : `<numéro>-<âge>-<tenue>-<état>[-<objet>]`.
 *
 *   001-e1-base-neutre.png
 *   001-e2-prehistorique-neutre.png
 *   001-e3-base-neutre-drapeau.png
 *
 * **Quatre champs obligatoires, un cinquième facultatif.** L'ancienne forme —
 * `001-neutre`, `001evo2-victoire` — avait un préfixe d'âge optionnel collé au
 * numéro : il fallait deviner où finissait le nombre, et rien ne permettait
 * d'exprimer une tenue. Ici les positions sont fixes, le découpage ne devine
 * rien, et le nom se lit dans l'ordre même des dossiers produits :
 * `TR1/e1/base/neutre`.
 *
 * `stuff-<objet>` désigne l'objet seul, sans personnage : ni âge, ni état.
 */
function lireNom2(f) {
  const base = path.basename(f, path.extname(f)).toLowerCase();

  const objet = /^stuff-([a-z0-9]+)$/.exec(base);
  if (objet) return { objetSeul: objet[1] };

  const m = /^([a-z0-9]+)-e([123])-([a-z0-9]+)-([a-z]+)(?:-([a-z0-9]+))?$/.exec(base);
  if (!m) return null;
  return { cle: m[1], evo: Number(m[2]), tenue: m[3], etat: m[4], objet: m[5] ?? null };
}

/* -------------------------------------------------------------------- main */

const fichiers = (await readdir(SOURCE)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
if (!fichiers.length) {
  console.error(`Aucune image dans ${SOURCE}.`);
  process.exit(1);
}

/* Regroupement par âge.

   Un lot peut mélanger e1, e2 et e3, plusieurs tenues et des objets portés.
   Chaque **âge** a son propre cadrage commun — le personnage change de
   silhouette en grandissant, et un cadre partagé entre stades le ferait
   rétrécir. En revanche, à l'intérieur d'un âge, **toutes les tenues et tous
   les objets partagent le même cadre** : sans ça, changer de tenue ferait
   sauter les pieds du personnage, exactement comme le faisait un changement
   d'état avant qu'on impose la boîte commune.                                */

const parEvo = new Map();      // evo -> [{ tenue, etat, objet, chemin }]
const objetsSeuls = new Map(); // nom -> chemin
const ignores = [];
let cle = null;

for (const f of fichiers.sort()) {
  const n = lireNom2(f);
  if (!n) { ignores.push(f); continue; }

  if (n.objetSeul) { objetsSeuls.set(n.objetSeul, path.join(SOURCE, f)); continue; }
  if (!ETATS.includes(n.etat)) { ignores.push(f); continue; }

  cle ??= n.cle;
  if (n.cle !== cle) { ignores.push(f); continue; }
  if (!parEvo.has(n.evo)) parEvo.set(n.evo, []);
  parEvo.get(n.evo).push({ ...n, chemin: path.join(SOURCE, f) });
}

/* ------------------------------------------------------- les objets seuls

   Un objet d'inventaire n'a ni âge ni état : c'est une vignette dans une liste
   d'équipement. Il sort donc ailleurs que les personnages, et se recadre sur
   lui-même — il n'a personne avec qui aligner ses pieds.                     */

for (const [nom, chemin] of objetsSeuls) {
  const a = await analyser(chemin);
  const dossier = path.join(SORTIE, '..', 'stuff');
  await mkdir(dossier, { recursive: true });
  const cadre = { left: a.boite.x0, top: a.boite.y0,
    width: a.boite.x1 - a.boite.x0 + 1, height: a.boite.y1 - a.boite.y0 + 1 };
  const decoupe = await sharp(a.rgba, { raw: { width: a.l, height: a.h, channels: 4 } })
    .extract(cadre).png().toBuffer();
  await ecrire(sharp(decoupe).resize({
    width: OBJET.l, height: OBJET.h, fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }), dossier, nom, createHash('sha1'));
  console.log(`objet « ${nom} » → ${path.relative(RACINE, path.join(dossier, nom))}.*`);
}

if (!parEvo.size) {
  if (objetsSeuls.size) process.exit(0);        // que des objets : c'est fini
  console.error(`Aucun état reconnu dans ${SOURCE}.

Les fichiers doivent s'appeler <numéro>-<âge>-<tenue>-<état>[-<objet>].png,
par exemple 001-e1-base-neutre.png ou 001-e2-prehistorique-neutre-drapeau.png.
Un objet seul s'appelle stuff-<nom>.png.

  âges  : e1, e2, e3
  états : ${ETATS.join(', ')}`);
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

/* ------------------------------------ tout lire et tout vérifier d'abord

   **Rien n'est écrit tant que le lot entier n'est pas validé.**

   La version d'avant lisait, vérifiait et écrivait âge par âge : un e2 mal
   formé s'arrêtait *après* que e1 avait été réécrit, et le manifeste, produit
   à la toute fin, ne l'était pas. Le lot refusé laissait donc des fichiers
   neufs décrits par un manifeste ancien — un désaccord silencieux entre le
   disque et ce que le jeu croit trouver.

   Ça ne se voyait pas tant qu'on lançait la chaîne à la main sur un dossier
   complet. Avec une veille qui se déclenche à chaque fichier déposé, le lot
   incomplet devient le cas **normal**.                                       */

const EXPLICATION = [
  'Le cadrage commun suppose un format unique par âge : c’est ce qui garde les',
  'pieds du personnage à la même hauteur d’une tenue et d’un état à l’autre.',
].join('\n');

const ages = [];
const refus = [];

for (const [evo, entrees] of [...parEvo].sort((a, b) => a[0] - b[0])) {
  // Tout l'âge est lu d'abord : la boîte commune se calcule sur l'ensemble,
  // tenues et objets compris.
  const lus = entrees.map((e) => ({ ...e }));
  for (const e of lus) e.img = await analyser(e.chemin);

  const tailles = new Map();
  for (const e of lus) {
    const t = `${e.img.l}×${e.img.h}`;
    (tailles.get(t) ?? tailles.set(t, []).get(t)).push(path.basename(e.chemin));
  }
  if (tailles.size > 1) {
    // On nomme les fichiers de chaque taille : « deux formats » ne dit pas
    // lequel corriger, et c'est pourtant la seule chose qu'on veut savoir.
    refus.push(`e${evo} : les rendus n'ont pas tous la même taille.`
      + [...tailles].map(([t, noms]) =>
        `\n    ${t} — ${noms.join(', ')}`).join(''));
    continue;
  }

  const u = lus.map((e) => e.img.boite).reduce((a, b) => ({
    x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0),
    x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1),
  }));
  const { l, h } = lus[0].img;
  ages.push({ evo, lus, l, h,
    cadre: { left: u.x0, top: u.y0, width: u.x1 - u.x0 + 1, height: u.y1 - u.y0 + 1 } });
}

/* **Un âge refusé n'en bloque aucun autre.**
 *
 * Chaque âge a son dossier et son propre cadre : ils ne se doivent rien. Faire
 * échouer le lot entier parce qu'un fichier d'e2 est au mauvais format gèlerait
 * e1 et e3, qui n'y sont pour rien — et avec une veille, un seul rendu de
 * travers arrêterait la production du personnage jusqu'à ce qu'on le remarque.
 *
 * L'âge fautif garde donc ce qu'il avait, les autres avancent, et le message
 * dit lequel corriger. */
if (refus.length && !ages.length) {
  console.error(refus.join('\n') + '\n\n' + EXPLICATION);
  process.exit(1);
}

const compte = [];
for (const { evo, lus, l, h, cadre } of ages) {

  const decouper = async (img, dossier, nom, empreinte) => {
    const decoupe = await sharp(img.rgba, { raw: { width: l, height: h, channels: 4 } })
      .extract(cadre)
      // `.png()` avant `.toBuffer()` : un tampon issu de pixels bruts repart en
      // pixels bruts, et sharp ne sait pas les relire sans leurs dimensions.
      .png().toBuffer();
    await ecrire(sharp(decoupe).resize({
      width: CADRE.l, height: CADRE.h, fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    }), dossier, nom, empreinte);
  };

  const eCle = `e${evo}`;
  manifeste.evolutions[eCle] ??= { skins: {} };

  const tenues = [...new Set(lus.map((e) => e.tenue))].sort();
  for (const tenue of tenues) {
    const dossier = path.join(dossierId, eCle, tenue);
    await mkdir(dossier, { recursive: true });
    const empreinte = createHash('sha1');

    // Les états nus, dans l'ordre du catalogue.
    const nus = new Map(lus.filter((e) => e.tenue === tenue && !e.objet)
      .map((e) => [e.etat, e.img]));
    for (const etat of ETATS) {
      if (nus.has(etat)) await decouper(nus.get(etat), dossier, etat, empreinte);
    }

    /* Les objets portés : `drapeau-neutre.*` à côté de `neutre.*`.

       Un objet est une **variante d'un état**, pas un état de plus. Le
       vocabulaire des douze états reste donc fermé, et toute la mécanique de
       repli du jeu — état manquant vers `neutre`, tenue partielle vers `base` —
       continue de fonctionner sans rien savoir des objets. */
    const objets = {};
    for (const e of lus.filter((x) => x.tenue === tenue && x.objet)) {
      await decouper(e.img, dossier, `${e.objet}-${e.etat}`, empreinte);
      (objets[e.objet] ??= []).push(e.etat);
    }

    /**
     * Le portrait ne se tire que de `neutre`, ou pas du tout.
     *
     * On peut le calculer depuis n'importe quel état, et c'est une mauvaise
     * idée : sur « victoire » les bras sont en l'air, l'érosion prend un
     * poignet pour un crâne, et le buste sort cadré sur la poitrine. Mieux vaut
     * aucun portrait qu'un portrait de travers — le jeu retombera sur celui du
     * stade précédent, ou sur le plein-pied.
     */
    const source = nus.get('neutre');
    if (source) {
      const rayon = Math.max(3, Math.round((source.boite.x1 - source.boite.x0) * 0.035));
      const tete = centreTete(source.alpha, l, h, source.boite, rayon);
      const cote = Math.round((source.boite.y1 - source.boite.y0) * 0.42);
      const gx = Math.max(0, Math.min(l - cote, Math.round(tete.x - cote / 2)));
      const gy = Math.max(0, Math.min(h - cote, Math.round(tete.y - cote * 0.08)));
      await ecrire(sharp(source.rgba, { raw: { width: l, height: h, channels: 4 } })
        .extract({ left: gx, top: gy,
          width: Math.min(cote, l - gx), height: Math.min(cote, h - gy) })
        .resize(PORTRAIT.l, PORTRAIT.h, { fit: 'cover' }), dossier, 'portrait', empreinte);
    }

    manifeste.evolutions[eCle].skins[tenue] = {
      etats: ETATS.filter((e) => nus.has(e)),
      portrait: nus.has('neutre'),
      ...(Object.keys(objets).length ? { objets } : {}),
      /* Une tenue autre que `base` se replie sur elle, par défaut et sans
         qu'on ait à le déclarer : une tenue partielle — deux poses sur douze —
         doit emprunter le reste, sinon le personnage se fige dès qu'on
         l'habille. `base` n'a pas de repli, c'est lui le fond du puits. */
      ...(tenue !== 'base' ? { repli: 'base' } : {}),
      sha: empreinte.digest('hex').slice(0, 12),
    };

    compte.push({ evo: eCle, tenue, etats: nus.size,
      objets: Object.keys(objets).length, cadre: `${cadre.width}×${cadre.height}` });
  }
}

/**
 * `rev` sert au cache. `/img` est servi en `immutable, 365 jours` : sans un
 * numéro qui change, une carte redessinée n'atteint jamais quelqu'un qui l'a
 * déjà chargée. Il n'augmente que si une empreinte a bougé — republier à
 * l'identique ne force personne à retélécharger.
 */
const avant = JSON.stringify(manifeste.evolutions);
try {
  const ancien = JSON.parse(await readFile(cheminManifeste, 'utf8'));
  if (JSON.stringify(ancien.evolutions) !== avant) manifeste.rev = (ancien.rev ?? 0) + 1;
  else manifeste.rev = ancien.rev ?? 1;
} catch { manifeste.rev = 1; }

await writeFile(cheminManifeste, `${JSON.stringify(manifeste, null, 2)}\n`);

console.log(`${ID}  (rendu ${cle})  rev ${manifeste.rev}`);
for (const c of compte) {
  console.log(`  ${c.evo}/${c.tenue.padEnd(14)} ${String(c.etats).padStart(2)} état(s)`
    + (c.objets ? ` · ${c.objets} objet(s)` : '')
    + ` · cadre ${c.cadre}`);
}
for (const f of ignores) console.log(`  ignoré : ${f}`);

if (refus.length) {
  console.error(['', ...refus, '', EXPLICATION,
    'Les autres âges ont été produits ; celui-là garde ce qu’il avait.'].join('\n'));
}

// L'agrégat se refait à chaque passage, sans qu'on ait à y penser. C'est la
// seule façon qu'il reste juste : reconstruit à la main, il finit par décrire
// un état du disque qui n'existe plus, et le jeu demande des images absentes.
const agr = await agreger(SORTIE);
console.log(`\n→ ${path.relative(RACINE, dossierId)}`);
console.log(`  index.json : ${agr.fanzzy} Fanzzy, ${(agr.octets / 1024).toFixed(1)} Ko`);

// Sortie non nulle si un âge a été refusé : la veille doit pouvoir le dire,
// même quand le reste est passé.
if (refus.length) process.exitCode = 1;
