/**
 * Le clignement d'un Fanzzy : ses paupières, posées sur son image de repos.
 *
 * Un Fanzzy qui cligne des yeux est vivant ; un Fanzzy qui ne cligne jamais
 * est une affiche. Il ne faut pour cela qu'une image : son repos, les yeux
 * fermés. Mais **seulement les yeux.** Une image de repos régénérée en entier,
 * même par un modèle à qui l'on demande de ne rien changer d'autre, revient
 * avec un sourcil plus haut, une larme déplacée, un grain de peau différent :
 * posée cent trente millisecondes sur le vrai repos, elle ferait tressaillir
 * tout le visage. On ne garde donc du dessin retouché que ce qui a changé
 * autour des yeux, et le reste du personnage reste celui qu'on connaît, au
 * pixel près.
 *
 * Deux temps, parce qu'entre les deux il y a Artlist :
 *
 *   npm run cligne -- tete RP1 [--age 1] [--tenue base]
 *
 *     Découpe la tête de l'image de repos publiée, l'agrandit quatre fois sur
 *     un fond gris, et la range dans `art/RP1/_src/RP1-e1-base-tete.png`. Elle
 *     dit aussi quoi demander à Artlist : une retouche, pas une génération.
 *
 *   npm run cligne -- poser RP1 <retouche> [--age 1] [--tenue base]
 *
 *     Recale la retouche sur la tête d'origine (le modèle la décale parfois
 *     d'un pixel ou deux, et la grossit d'un rien), trouve les yeux là où
 *     elle diffère nettement, recolle la peau autour sur la teinte d'origine,
 *     et publie **les paupières seules** : `cligne.{avif,webp,png}`, une image
 *     de la taille du repos, transparente partout sauf sur les yeux. La page
 *     la pose par-dessus le repos ; le contour, la lueur et l'ombre du
 *     personnage restent ceux du repos, une seule fois. Le manifeste gagne
 *     `cligne: true` sur cette tenue de cet âge, et `index.json` suit.
 *
 * La retouche choisie est **gardée dans le dépôt**, `art/RP1/cligne/`, et
 * pas avec les autres sources : comme les dessins des cartes d'action, on ne
 * sait pas la refaire — un modèle ne rend jamais deux fois la même image.
 *
 * Les paupières ne valent que pour l'image d'où elles viennent. Quand
 * `fanzzy-art.mjs` récrit un repos — une tenue de plus agrandit le cadre de
 * l'âge, et tout le personnage bouge de quelques pixels —, il les repose
 * lui-même depuis cette retouche. Si elle ne colle plus, parce que le visage
 * a été redessiné, il retire `cligne` du manifeste et le dit : il faut alors
 * repasser par ces deux temps.
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { agreger } from './fanzzy-manifeste.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = path.join(RACINE, 'public', 'img', 'fanzzy');

/* Le fond de la tête envoyée à Artlist. Un gris clair et neutre : sur la
   transparence, les modèles inventent un décor, et sur un blanc pur ils
   blanchissent le crâne qui le touche. */
const FOND = '#ECECEC';
/* La tête est agrandie quatre fois avant de partir : le modèle travaille
   mieux sur un visage qui occupe l'image que sur trois cents pixels. */
const AGRANDI = 4;
/* L'échelle de travail du recalage et de la recherche des yeux. C'est celle
   d'une retouche « 512 px », la moins chère, et elle suffit : à l'écran, la
   tête fait rarement plus de trois cents pixels de large. */
const N = 512;

/* Les trois formats, comme `fanzzy-art.mjs` — mêmes qualités, pour que les
   paupières et le repos sortent du même encodeur. */
const FORMATS = [
  ['avif', (i) => i.avif({ quality: 62 })],
  ['webp', (i) => i.webp({ quality: 82 })],
  ['png', (i) => i.png({ compressionLevel: 9 })],
];

const PROMPT = 'Close his eyes: both upper eyelids fully lowered, as in the middle of '
  + 'a natural blink, eyelashes resting on the lower lids. Change nothing else at '
  + 'all: same face, same eyebrows, same open or closed mouth, same skin, lighting, '
  + 'colors, framing and background, pixel for pixel.';

/**
 * La boîte de la tête dans une image de repos publiée.
 *
 * Calculée, jamais saisie : `tete` et `poser` la retrouvent chacun de leur
 * côté depuis le même repos, et tombent donc sur la même. Le sommet est la
 * première ligne où le sujet a de la matière ; le milieu, celui du crâne (les
 * douze premiers pour cent du personnage), pas celui de la silhouette — un
 * bras levé ou une écharpe qui flotte décentrerait la tête.
 *
 * **Elle peut déborder de l'image**, et c'est voulu. Un personnage que son
 * cadre pose tout en haut n'a pas la marge que la boîte prend au-dessus du
 * crâne ; la ramener dans l'image la décalait par rapport à la tête, de onze
 * pixels sur douze tolérés par le recalage pour RP1 recadré sur sa seule
 * tenue de base. Elle reste donc attachée à la tête, et ce qui dépasse est
 * vide (voir `decouper`).
 */
export async function boiteDeLaTete(repos) {
  const { data, info } = await sharp(repos).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: l, height: h } = info;
  const opaque = (x, y) => data[(y * l + x) * 4 + 3] >= 128;
  let y0 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    let n = 0;
    for (let x = 0; x < l; x++) if (opaque(x, y)) n++;
    if (n >= 3) { if (y0 < 0) y0 = y; y1 = y; }
  }
  if (y0 < 0) throw new Error(`${repos} est vide.`);
  const haut = y1 - y0;
  let somme = 0, n = 0;
  for (let y = y0; y <= y0 + haut * 0.12; y++) {
    for (let x = 0; x < l; x++) if (opaque(x, y)) { somme += x; n++; }
  }
  const cote = Math.min(l, Math.round(haut * 0.38));
  const cx = n ? somme / n : l / 2;
  return {
    left: Math.round(cx - cote / 2), top: y0 - Math.round(cote * 0.19),
    width: cote, height: cote,
  };
}

/** La tête découpée, transparente là où la boîte déborde de l'image. */
async function decouper(repos, boite) {
  const marge = boite.width;
  const large = await sharp(repos).ensureAlpha()
    .extend({ top: marge, bottom: marge, left: marge, right: marge,
      background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  return sharp(large).extract({ left: boite.left + marge, top: boite.top + marge,
    width: boite.width, height: boite.height });
}

/** Où vit la retouche gardée d'une tenue d'un âge, quel que soit son format. */
export const dossierDesRetouches = (id) => path.join(RACINE, 'art', id, 'cligne');
export const nomDeRetouche = (id, age, tenue) => `${id}-e${age}-${tenue}-retouche`;

/* ------------------------------------------------------------------ tete */

async function tete({ id, age, tenue }) {
  const repos = path.join(PUBLIC, id, `e${age}`, tenue, 'neutre.png');
  const src = path.join(RACINE, 'art', id, '_src');
  const boite = await boiteDeLaTete(repos);
  await mkdir(src, { recursive: true });
  const sortie = path.join(src, `${id}-e${age}-${tenue}-tete.png`);
  await (await decouper(repos, boite)).flatten({ background: FOND })
    .resize(boite.width * AGRANDI, boite.height * AGRANDI, { kernel: 'lanczos3' })
    .png().toFile(sortie);
  console.log(`${path.relative(RACINE, sortie)}  (tête ${boite.width} px, en ${boite.left},${boite.top})

Dans Artlist : une retouche de cette image (image vers image), pas une
génération. Nano Banana 2, carré, 512 px, deux variantes : environ 120 crédits.
Ce qu'on lui demande, mot pour mot :

  ${PROMPT}

Puis, avec la variante où les yeux sont le mieux fermés :

  npm run cligne -- poser ${id} <fichier>${age !== 1 ? ` --age ${age}` : ''}${tenue !== 'base' ? ` --tenue ${tenue}` : ''}
`);
}

/* ----------------------------------------------------------------- poser */

const lum = (b, i) => 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2];

/** Un échantillon bilinéaire de luminance, ou `null` hors de l'image. */
function echantillon(b, x, y) {
  if (x < 0 || y < 0 || x >= N - 1 || y >= N - 1) return null;
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const i = (y0 * N + x0) * 3;
  return lum(b, i) * (1 - fx) * (1 - fy) + lum(b, i + 3) * fx * (1 - fy)
    + lum(b, i + N * 3) * (1 - fx) * fy + lum(b, i + N * 3 + 3) * fx * fy;
}

/**
 * Le décalage et l'échelle qui posent la retouche sur l'origine.
 *
 * L'écart se mesure sur tout le visage, mais **plafonné** : les yeux, qui
 * ont changé exprès, pèsent autant qu'un pixel légèrement faux et pas plus.
 * Sans ce plafond, le recalage tirerait la retouche de travers pour
 * rapprocher des yeux fermés d'yeux ouverts. Une grille large d'abord, au
 * pixel et au pour cent, puis une fine autour du meilleur point.
 */
function recaler(O, R) {
  const points = [];
  for (let y = 8; y < N - 8; y += 3) for (let x = 8; x < N - 8; x += 3) points.push([x, y]);
  const c = N / 2;
  const ecart = (s, dx, dy) => {
    let e = 0, n = 0;
    for (const [x, y] of points) {
      const v = echantillon(R, c + (x - c) * s + dx, c + (y - c) * s + dy);
      if (v == null) continue;
      const d = v - lum(O, (y * N + x) * 3);
      e += Math.min(d * d, 900); n++;
    }
    return n ? e / n : Infinity;
  };
  let mieux = { e: Infinity, s: 1, dx: 0, dy: 0 };
  for (let s = 0.96; s <= 1.0401; s += 0.01) {
    for (let dx = -12; dx <= 12; dx++) for (let dy = -12; dy <= 12; dy++) {
      const e = ecart(s, dx, dy);
      if (e < mieux.e) mieux = { e, s, dx, dy };
    }
  }
  const gros = mieux;
  for (let s = gros.s - 0.01; s <= gros.s + 0.0101; s += 0.0025) {
    for (let dx = gros.dx - 1; dx <= gros.dx + 1.001; dx += 0.25) {
      for (let dy = gros.dy - 1; dy <= gros.dy + 1.001; dy += 0.25) {
        const e = ecart(s, dx, dy);
        if (e < mieux.e) mieux = { e, s, dx, dy };
      }
    }
  }
  return { ...mieux, sans: ecart(1, 0, 0) };
}

/** La retouche, recalée, en couleur. */
function appliquer(R, { s, dx, dy }) {
  const A = Buffer.alloc(N * N * 3);
  const c = N / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = Math.max(0, Math.min(N - 1.001, c + (x - c) * s + dx));
    const sy = Math.max(0, Math.min(N - 1.001, c + (y - c) * s + dy));
    const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    for (let k = 0; k < 3; k++) {
      const i = (y0 * N + x0) * 3 + k;
      A[(y * N + x) * 3 + k] = Math.round(R[i] * (1 - fx) * (1 - fy) + R[i + 3] * fx * (1 - fy)
        + R[i + N * 3] * (1 - fx) * fy + R[i + N * 3 + 3] * fx * fy);
    }
  }
  return A;
}

/**
 * Les yeux : les deux plus grandes taches où la retouche diffère nettement.
 *
 * Le seuil laisse passer le grain que le modèle redessine partout et ne
 * retient que ce qui a vraiment changé. Les miettes (moins d'une centaine de
 * pixels) ne sont pas des yeux ; deux taches au plus, parce qu'un Fanzzy de
 * profil n'en montre qu'une.
 */
function trouverLesYeux(O, A) {
  const fort = new Uint8Array(N * N);
  for (let p = 0; p < N * N; p++) fort[p] = Math.abs(lum(A, p * 3) - lum(O, p * 3)) > 28 ? 1 : 0;
  const vu = new Uint8Array(N * N);
  const taches = [];
  for (let p = 0; p < N * N; p++) {
    if (!fort[p] || vu[p]) continue;
    const pile = [p]; vu[p] = 1;
    let aire = 0, x0 = N, x1 = -1, y0 = N, y1 = -1;
    while (pile.length) {
      const q = pile.pop(); aire++;
      const x = q % N, y = (q - x) / N;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (const r of [q - 1, q + 1, q - N, q + N]) {
        if (r < 0 || r >= N * N || vu[r] || !fort[r]) continue;
        if (Math.abs((r % N) - x) > 1) continue;
        vu[r] = 1; pile.push(r);
      }
    }
    if (aire >= 100) taches.push({ aire, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2 });
  }
  return taches.sort((a, b) => b.aire - a.aire).slice(0, 2);
}

/** Une ellipse par œil, agrandie pour prendre la paupière et les cils. */
const ellipse = (o) => ({ cx: o.cx, cy: o.cy, rx: o.rx * 1.25 + 6, ry: o.ry * 1.6 + 6 });
const dans = (e, x, y) => ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2;

/**
 * Pose les paupières d'une retouche sur un repos publié, et les écrit à côté
 * de lui : `cligne.{avif,webp,png}` dans le dossier du repos.
 *
 * Ne touche ni au manifeste ni à l'index : c'est l'affaire de l'appelant —
 * cette commande-ci quand on pose à la main, `fanzzy-art.mjs` quand il
 * récrit le repos. Lève une erreur, sans rien écrire, quand la retouche ne
 * colle pas : c'est ce qui permet à la chaîne de retirer `cligne` plutôt que
 * de publier des paupières à côté des yeux.
 *
 * @returns {{touches:number, l:number, h:number, recalage:object, yeux:object[],
 *   complet:Buffer}} `complet` est le repos les yeux fermés, en RGBA brut.
 */
export async function poserLesPaupieres({ repos, retouche }) {
  const boite = await boiteDeLaTete(repos);
  const O = await (await decouper(repos, boite)).flatten({ background: FOND })
    .resize(N, N, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  const R = await sharp(retouche).flatten({ background: FOND })
    .resize(N, N, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();

  const recalage = recaler(O, R);
  const A = appliquer(R, recalage);
  const yeux = trouverLesYeux(O, A);
  const aireTete = N * N;
  const aireYeux = yeux.reduce((t, o) => t + o.aire, 0);

  /* Les garde-fous. Une retouche qui ne recale pas, ou qui change bien plus
     que les yeux, n'est pas une paupière : c'est un autre dessin. On refuse
     de la poser plutôt que de faire tressaillir le personnage. La retouche
     de RP1 se recale à un écart de 21 ; un autre visage dépasse 190. */
  if (!yeux.length) throw new Error('Aucun œil trouvé : la retouche ne diffère pas du repos.');
  if (recalage.e > 120) {
    throw new Error(`La retouche ne se recale pas sur le repos (écart ${recalage.e.toFixed(0)}) : `
      + 'ce n’est pas la même tête, ou elle a été recadrée. Repars de la tête produite par « tete ».');
  }
  if (aireYeux > aireTete * 0.06) {
    throw new Error(`La retouche change ${(100 * aireYeux / aireTete).toFixed(1)} % de la tête : `
      + 'bien plus que les yeux. Choisis une variante plus sage.');
  }

  // Le masque, adouci : les paupières se fondent dans la peau d'origine.
  const ellipses = yeux.map(ellipse);
  const M = Buffer.alloc(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (ellipses.some((e) => dans(e, x, y) <= 1)) M[y * N + x] = 255;
  }
  const Mf = await sharp(M, { raw: { width: N, height: N, channels: 1 } })
    .blur(5).extractChannel(0).raw().toBuffer();

  /* La teinte. Le modèle rend la peau à un ou deux tons près, ce qui suffit à
     dessiner une tache autour de chaque œil. On mesure l'écart sur un anneau
     de peau autour de chacun, canal par canal, et on le rattrape. */
  const correction = ellipses.map((e) => {
    const s = [0, 0, 0]; let n = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = dans(e, x, y);
      if (d > 1.15 && d < 1.9) {
        const i = (y * N + x) * 3;
        for (let k = 0; k < 3; k++) s[k] += O[i + k] - A[i + k];
        n++;
      }
    }
    return n ? s.map((v) => v / n) : [0, 0, 0];
  });
  const Ac = Buffer.from(A);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    // Chaque pixel prend la correction de l'œil le plus proche.
    let k = 0, meilleur = Infinity;
    ellipses.forEach((e, j) => { const d = dans(e, x, y); if (d < meilleur) { meilleur = d; k = j; } });
    const i = (y * N + x) * 3;
    for (let c = 0; c < 3; c++) Ac[i + c] = Math.max(0, Math.min(255, Math.round(A[i + c] + correction[k][c])));
  }

  // À l'échelle du repos publié : la tête retrouve sa taille et sa place.
  const cote = boite.width;
  const couleurs = await sharp(Ac, { raw: { width: N, height: N, channels: 3 } })
    .resize(cote, cote, { kernel: 'lanczos3' }).raw().toBuffer();
  const masque = await sharp(Mf, { raw: { width: N, height: N, channels: 1 } })
    .resize(cote, cote, { kernel: 'lanczos3' }).extractChannel(0).raw().toBuffer();
  const { data: pixels, info } = await sharp(repos).ensureAlpha().raw()
    .toBuffer({ resolveWithObject: true });
  const { width: l, height: h } = info;

  const paupieres = Buffer.alloc(l * h * 4);   // transparentes, sauf les yeux
  const complet = Buffer.from(pixels);         // le repos, les yeux fermés
  let touches = 0;
  for (let y = 0; y < cote; y++) for (let x = 0; x < cote; x++) {
    const m = masque[y * cote + x] / 255;
    if (m <= 0) continue;
    const px = boite.left + x, py = boite.top + y;
    if (px < 0 || py < 0 || px >= l || py >= h) continue;    // hors de l'image
    const j = (py * l + px) * 4, i = (y * cote + x) * 3;
    const a = m * (pixels[j + 3] / 255);
    if (a <= 0) continue;
    touches++;
    for (let k = 0; k < 3; k++) {
      paupieres[j + k] = couleurs[i + k];
      complet[j + k] = Math.round(pixels[j + k] * (1 - a) + couleurs[i + k] * a);
    }
    paupieres[j + 3] = Math.round(a * 255);
  }

  const dossier = path.dirname(repos);
  for (const [ext, fn] of FORMATS) {
    const buf = await fn(sharp(paupieres, { raw: { width: l, height: h, channels: 4 } })).toBuffer();
    await writeFile(path.join(dossier, `cligne.${ext}`), buf);
  }
  return { touches, l, h, recalage, yeux, complet };
}

/* ------------------------------------------------------- à la main */

async function poser({ id, age, tenue, retouche }) {
  const nom = `${id}-e${age}-${tenue}`;
  const repos = path.join(PUBLIC, id, `e${age}`, tenue, 'neutre.png');
  const r = await poserLesPaupieres({ repos, retouche });
  console.log(`recalage : échelle ${r.recalage.s.toFixed(4)}, décalage ${r.recalage.dx.toFixed(2)} × ${
    r.recalage.dy.toFixed(2)} px (écart ${r.recalage.sans.toFixed(1)} → ${r.recalage.e.toFixed(1)})`);
  console.log(`yeux : ${r.yeux.map((o) => `${Math.round(o.rx * 2)}×${Math.round(o.ry * 2)} en ${
    Math.round(o.cx)},${Math.round(o.cy)}`).join(' ; ')}`);

  /* La retouche est gardée, dans le dépôt : c'est d'elle que `fanzzy-art.mjs`
     repart quand il récrit le repos. Une retouche qu'on n'a plus, ce sont
     cent vingt crédits et un tirage qui ne retombera jamais pareil. */
  const garde = path.join(dossierDesRetouches(id),
    `${nomDeRetouche(id, age, tenue)}${path.extname(retouche).toLowerCase() || '.png'}`);
  if (path.resolve(retouche) !== garde) {
    await mkdir(path.dirname(garde), { recursive: true });
    await copyFile(retouche, garde);
  }

  /* Le repos les yeux fermés, en entier : de quoi le regarder. Il vit avec
     les sources, hors de `public/` et de git, et `fanzzy-art.mjs` l'ignore —
     « cligne » n'est pas un état. */
  const src = path.join(RACINE, 'art', id, '_src');
  await mkdir(src, { recursive: true });
  await sharp(r.complet, { raw: { width: r.l, height: r.h, channels: 4 } }).png()
    .toFile(path.join(src, `${nom}-cligne.png`));

  // Le manifeste, puis l'index : la page saura que ce repos sait cligner.
  const cheminManifeste = path.join(PUBLIC, id, 'manifeste.json');
  const manifeste = JSON.parse(await readFile(cheminManifeste, 'utf8'));
  const entree = manifeste.evolutions?.[`e${age}`]?.skins?.[tenue];
  if (!entree) throw new Error(`Le manifeste de ${id} n'a pas de tenue « ${tenue} » à l'âge ${age}.`);
  /* `rev` augmente même si `cligne` y était déjà : les paupières ont changé,
     et `/img` est servi en `immutable` pour un an — sans un numéro neuf,
     personne ne verrait les nouvelles. */
  entree.cligne = true;
  manifeste.rev = (manifeste.rev ?? 0) + 1;
  await writeFile(cheminManifeste, `${JSON.stringify(manifeste, null, 2)}\n`);
  const index = await agreger(PUBLIC);

  console.log(`${path.relative(RACINE, path.dirname(repos))}/cligne.{avif,webp,png} : ${r.touches} pixels `
    + `de paupières (${(100 * r.touches / (r.l * r.h)).toFixed(2)} % de l'image)`);
  console.log(`retouche gardée : ${path.relative(RACINE, garde)}`);
  console.log(`${id} rev ${manifeste.rev} ; index.json : ${index.fanzzy} Fanzzy`);
  console.log(`Le repos les yeux fermés, pour le regarder : ${path.relative(RACINE, path.join(src, `${nom}-cligne.png`))}`);
}

/* ------------------------------------------------- la ligne de commande

   Appelé directement : on lit les arguments et on agit. Importé — par
   `fanzzy-art.mjs` —, on ne fait rien de plus que prêter ses fonctions. */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const drapeau = (nom, defaut) => {
    const i = args.indexOf(`--${nom}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
  };
  const libres = args.filter((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const [ordre, id, retouche] = libres;
  const age = Number(drapeau('age', '1'));
  const tenue = drapeau('tenue', 'base');

  if (!['tete', 'poser'].includes(ordre) || !id || (ordre === 'poser' && !retouche)
    || ![1, 2, 3].includes(age)) {
    console.error('Usage :\n'
      + '  npm run cligne -- tete <ID> [--age 1] [--tenue base]\n'
      + '  npm run cligne -- poser <ID> <retouche> [--age 1] [--tenue base]');
    process.exit(1);
  }
  try {
    await (ordre === 'tete' ? tete({ id, age, tenue }) : poser({ id, age, tenue, retouche }));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
