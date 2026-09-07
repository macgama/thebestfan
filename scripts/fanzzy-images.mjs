/**
 * Chaîne de production des illustrations de Fanzzy.
 *
 * `ETAT.md` § 9 décrit cette méthode et les trois erreurs qui ont coûté
 * plusieurs essais. Elle n'était écrite nulle part en code : chaque nouvelle
 * illustration repartait à la main, et les mêmes pièges revenaient. Ce script
 * l'exécute, et il sera relancé cent fois.
 *
 *   npm install --no-save sharp
 *   node scripts/fanzzy-images.mjs <dossier-des-rendus> [--sortie public/img/fanzzy]
 *
 * Chaque fichier du dossier nommé `<ID>.png` — `X9.png`, `X10.png`… — produit
 * les six fichiers attendus : `X9.{avif,webp,png}` en 520×945 et
 * `X9-buste.{avif,webp,png}` en 320×320, fond transparent.
 *
 * Les trois pièges, et ce que le code en fait :
 *
 *   1. **Le détourage ne se fait pas au seuil global.** Un personnage peut
 *      tenir des cartes blanches sur fond blanc, ou porter une fourrure
 *      anthracite sur fond noir. On isole donc les zones de fond *connexes au
 *      bord*, et rien d'autre : une tache claire au milieu du sujet reste
 *      opaque parce qu'aucun chemin ne la relie au bord.
 *
 *   2. **L'alpha suit la distance à la couleur de fond entre deux seuils.**
 *      Un seuil unique découpe les cheveux et la fourrure au couteau. Le
 *      dégradé conserve l'anticrénelage.
 *
 *   3. **Le buste se centre sur la tête, pas sur le sujet.** Centrer sur la
 *      matière la plus haute rate — une main levée monte aussi haut qu'un
 *      crâne. Centrer sur la plage continue la plus large rate aussi — un
 *      éventail de cartes fait une plage large. Ce qui marche : éroder le
 *      masque, les bras et objets tenus sont trop fins et disparaissent, la
 *      tête survit.
 */
import { readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

const args = process.argv.slice(2);
const SOURCE = args.find((a) => !a.startsWith('--'));
const SORTIE = (() => {
  const i = args.indexOf('--sortie');
  return i >= 0 ? args[i + 1] : path.join(RACINE, 'public', 'img', 'fanzzy');
})();

if (!SOURCE) {
  console.error('Usage : node scripts/fanzzy-images.mjs <dossier-des-rendus> [--sortie <dossier>]');
  process.exit(1);
}

/** Formats attendus par le jeu. Le PNG est le repli, il doit toujours exister. */
const PLEIN = { l: 520, h: 945 };
const BUSTE = { l: 320, h: 320 };

/* ----------------------------------------------------------- détourage */

/** Distance euclidienne dans l'espace des couleurs, sur 0-255. */
const distance = (r, g, b, f) =>
  Math.sqrt((r - f[0]) ** 2 + (g - f[1]) ** 2 + (b - f[2]) ** 2);

/**
 * La couleur du fond, lue sur le pourtour.
 *
 * On prend la médiane et non la moyenne : un seul pixel de sujet touchant le
 * bord — une mèche, un pied — décalerait une moyenne, pas une médiane.
 */
function couleurDeFond(px, l, h, c) {
  const ech = [];
  const lire = (x, y) => { const i = (y * l + x) * c; ech.push([px[i], px[i + 1], px[i + 2]]); };
  for (let x = 0; x < l; x += Math.max(1, Math.floor(l / 60))) { lire(x, 0); lire(x, h - 1); }
  for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 60))) { lire(0, y); lire(l - 1, y); }
  const med = (k) => {
    const t = ech.map((e) => e[k]).sort((a, b) => a - b);
    return t[Math.floor(t.length / 2)];
  };
  return [med(0), med(1), med(2)];
}

/**
 * Alpha par propagation depuis le bord.
 *
 * Une file, pas une récursion : à 1536×2752 une récursion explose la pile, et
 * elle le fait sur les grandes images seulement — donc en production, jamais
 * sur l'exemple qu'on teste.
 */
function detourer(px, l, h, c, fond, seuilBas, seuilHaut) {
  const alpha = new Uint8Array(l * h).fill(255);
  const vu = new Uint8Array(l * h);
  const file = [];

  const proche = (idx) => {
    const i = idx * c;
    return distance(px[i], px[i + 1], px[i + 2], fond) <= seuilHaut;
  };

  for (let x = 0; x < l; x++) {
    for (const y of [0, h - 1]) { const i = y * l + x; if (!vu[i] && proche(i)) { vu[i] = 1; file.push(i); } }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, l - 1]) { const i = y * l + x; if (!vu[i] && proche(i)) { vu[i] = 1; file.push(i); } }
  }

  for (let t = 0; t < file.length; t++) {
    const idx = file[t];
    const i = idx * c;
    const d = distance(px[i], px[i + 1], px[i + 2], fond);
    // Entre les deux seuils, l'alpha monte progressivement : c'est ce qui
    // garde les cheveux et la fourrure.
    alpha[idx] = d <= seuilBas ? 0
      : Math.round(Math.min(1, (d - seuilBas) / (seuilHaut - seuilBas)) * 255);

    const x = idx % l, y = (idx / l) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= l || ny >= h) continue;
      const n = ny * l + nx;
      if (vu[n] || !proche(n)) continue;
      vu[n] = 1; file.push(n);
    }
  }
  return alpha;
}

/* -------------------------------------------------------------- cadrage */

/** Boîte du sujet : ce qui reste après détourage. */
function boite(alpha, l, h, seuil = 40) {
  let x0 = l, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (alpha[y * l + x] < seuil) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/**
 * Le centre de la tête.
 *
 * On érode le masque : un bras tendu, une spatule, un éventail de cartes sont
 * trop fins et disparaissent ; le crâne survit. On prend ensuite le centre
 * horizontal de ce qui reste dans la première tranche du sujet.
 */
function centreTete(alpha, l, h, b, rayon) {
  const dur = (x, y) => {
    if (x < 0 || y < 0 || x >= l || y >= h) return false;
    return alpha[y * l + x] >= 128;
  };
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
  // On cherche d'abord la première ligne où il reste de la matière érodée :
  // c'est le sommet du crâne, pas celui d'une main levée.
  let sommet = -1;
  for (let y = b.y0; y <= b.y0 + hauteur * 0.5; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (erode(x, y)) { sommet = y; break; }
    }
    if (sommet >= 0) break;
  }
  if (sommet < 0) return { x: (b.x0 + b.x1) / 2, y: b.y0 + hauteur * 0.12 };

  // Centre horizontal de la matière érodée sur la tranche du crâne.
  const bas = Math.min(b.y1, sommet + hauteur * 0.14);
  let somme = 0, n = 0;
  for (let y = sommet; y <= bas; y++) {
    for (let x = b.x0; x <= b.x1; x++) if (erode(x, y)) { somme += x; n++; }
  }
  return { x: n ? somme / n : (b.x0 + b.x1) / 2, y: sommet };
}

/* ------------------------------------------------------------ une carte */

async function produire(fichier, id) {
  const brut = sharp(fichier).ensureAlpha();
  const meta = await brut.metadata();
  const { data, info } = await brut.raw().toBuffer({ resolveWithObject: true });
  const { width: l, height: h, channels: c } = info;

  const fond = couleurDeFond(data, l, h, c);
  // Seuils relatifs : un fond noir et un fond blanc ne tolèrent pas le même
  // écart absolu avant qu'on cesse de le considérer comme du fond.
  const alpha = detourer(data, l, h, c, fond, 28, 92);

  const b = boite(alpha, l, h);
  if (!b) throw new Error('aucun sujet trouvé après détourage');

  // On recompose l'image avec son alpha, puis on recadre sur le sujet.
  const rgba = Buffer.alloc(l * h * 4);
  for (let i = 0; i < l * h; i++) {
    rgba[i * 4] = data[i * c];
    rgba[i * 4 + 1] = data[i * c + 1];
    rgba[i * 4 + 2] = data[i * c + 2];
    rgba[i * 4 + 3] = alpha[i];
  }
  const base = sharp(rgba, { raw: { width: l, height: h, channels: 4 } });

  /* -- plein pied : le sujet entier, posé sur la base du cadre -- */
  // `.png()` avant `.toBuffer()` : un tampon issu d'une entrée brute repart
  // en pixels bruts, et sharp ne sait pas les relire sans qu'on lui redonne
  // leurs dimensions. Un format nommé évite de les trimballer.
  const sujet = await base.clone()
    .extract({ left: b.x0, top: b.y0, width: b.x1 - b.x0 + 1, height: b.y1 - b.y0 + 1 })
    .png().toBuffer();

  const plein = sharp(sujet).resize({
    width: PLEIN.l, height: PLEIN.h, fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  /* -- buste : un carré centré sur la tête -- */
  const rayon = Math.max(3, Math.round((b.x1 - b.x0) * 0.035));
  const tete = centreTete(alpha, l, h, b, rayon);
  const cote = Math.round((b.y1 - b.y0) * 0.42);
  let gx = Math.round(tete.x - cote / 2);
  let gy = Math.round(tete.y - cote * 0.08);
  gx = Math.max(0, Math.min(l - cote, gx));
  gy = Math.max(0, Math.min(h - cote, gy));

  const buste = sharp(rgba, { raw: { width: l, height: h, channels: 4 } })
    .extract({ left: gx, top: gy, width: Math.min(cote, l - gx), height: Math.min(cote, h - gy) })
    .resize(BUSTE.l, BUSTE.h, { fit: 'cover' });

  await mkdir(SORTIE, { recursive: true });
  const ecrire = async (img, nom) => {
    // Le PNG en dernier : c'est le repli, et il doit exister même si un
    // encodeur moderne manque à l'appel sur cette machine.
    for (const [ext, fn] of [['avif', (i) => i.avif({ quality: 62 })],
                             ['webp', (i) => i.webp({ quality: 82 })],
                             ['png', (i) => i.png({ compressionLevel: 9 })]]) {
      await fn(img.clone()).toFile(path.join(SORTIE, `${nom}.${ext}`));
    }
  };
  await ecrire(plein, id);
  await ecrire(buste, `${id}-buste`);

  return { id, source: `${meta.width}×${meta.height}`, fond,
           sujet: `${b.x1 - b.x0 + 1}×${b.y1 - b.y0 + 1}`, tete: Math.round(tete.x) };
}

/* ----------------------------------------------------------------- main */

const fichiers = (await readdir(SOURCE))
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
  .sort();

if (!fichiers.length) {
  console.error(`Aucune image dans ${SOURCE}. Nomme chaque rendu du nom du Fanzzy : X9.png, X10.png…`);
  process.exit(1);
}

console.log(`\n${fichiers.length} rendu(s) · sortie : ${SORTIE}\n`);
let erreurs = 0;
for (const f of fichiers) {
  const id = path.basename(f, path.extname(f));
  try {
    const r = await produire(path.join(SOURCE, f), id);
    console.log(`  ok   ${id.padEnd(5)} ${r.source} → sujet ${r.sujet}`
      + ` · fond rgb(${r.fond.join(',')}) · six fichiers écrits`);
  } catch (e) {
    erreurs++;
    console.log(` FAIL  ${id.padEnd(5)} ${e.message}`);
  }
}

console.log(erreurs
  ? `\n${erreurs} rendu(s) en échec.\n`
  : '\nTerminé. Ajoute les identifiants à ILLUSTRES dans public/fanzzy-art.js,'
    + '\npuis lance node scripts/verif-pages.mjs pour vérifier les six fichiers.\n');
process.exit(erreurs ? 1 : 0);
