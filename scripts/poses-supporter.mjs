/**
 * Les poses du supporter, cadrées ensemble.
 *
 * Le personnage de l'accueil change de pose selon ce qui se passe dans le vrai
 * match : il attend, il pousse, il exulte, il encaisse. Les quatre dessins se
 * croisent en fondu sur deux calques superposés — et c'est là qu'est le piège.
 *
 * **Recadrer chaque pose sur son propre sujet ferait sauter le personnage.**
 * `fanzzy-images.mjs` fait exactement ça : il détoure, cherche la boîte du
 * sujet, et l'étale dans le cadre de sortie. C'est juste pour une carte, qu'on
 * regarde seule. Ici les images se remplacent l'une l'autre au même endroit :
 * si « bras levés » est recadrée sur elle-même, le personnage rapetisse d'un
 * coup et ses pieds remontent de trente pixels au moment du but. L'œil ne voit
 * pas une pose changer, il voit un défaut d'affichage.
 *
 * On calcule donc **une seule boîte, l'union des quatre**, et on l'applique
 * telle quelle à toutes. Chaque pose garde sa taille et sa ligne de sol ; seuls
 * les bras bougent, ce qui est précisément ce qu'on veut voir.
 *
 * Usage :
 *   node scripts/poses-supporter.mjs img_x/poses
 *   node scripts/poses-supporter.mjs img_x/poses --sortie public/img/supporter
 *
 * Les fichiers d'entrée se nomment par leur pose : `idle`, `push`, `goal`,
 * `sad`. Toute autre image du dossier est ignorée, avec un mot pour le dire —
 * un fichier silencieusement écarté est un fichier qu'on croit livré.
 */
import { readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

/** Les quatre poses que l'accueil sait jouer, et ce qui les déclenche. */
export const POSES = {
  idle: 'avant le match, ou rien en cours',
  push: 'un match de ton club est en cours',
  goal: 'ton club marque',
  sad: 'ton club encaisse',
};

/** Le cadre de sortie. Rapport 448×900, celui des rendus fournis. */
const CADRE = { l: 448, h: 900 };

/**
 * Le décor de la tribune accompagne les poses dans le même dossier de rendus.
 *
 * Il est traité ici plutôt qu'à part : à la première passe il s'est retrouvé
 * dans la liste des fichiers ignorés, et un décor « ignoré » ne se remarque pas
 * — la page a un fond de repli, elle s'affiche, et personne ne voit qu'elle
 * affiche le mauvais.
 */
const FOND = { nom: 'bg', sortie: 'accueil', largeur: 1080 };

/**
 * L'alpha du sujet, en un octet par pixel.
 *
 * Les rendus arrivent avec un fond transparent : l'alpha est déjà là, il n'y a
 * rien à deviner. On garde quand même le cas du fond plein, parce qu'un export
 * en JPEG ou un aplatissement involontaire arrive, et qu'un détourage raté est
 * plus facile à voir qu'à diagnostiquer.
 */
function alphaDuSujet(data, l, h, c) {
  if (c === 4) {
    // Transparent quelque part ? Alors l'alpha fait foi.
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) {
        const a = new Uint8Array(l * h);
        for (let p = 0; p < l * h; p++) a[p] = data[p * 4 + 3];
        return { alpha: a, source: 'canal alpha' };
      }
    }
  }
  // Fond plein : on prend la couleur du coin et on écarte ce qui lui ressemble.
  // Suffisant pour un rendu sur fond uni ; ça ne prétend pas remplacer le
  // détourage par propagation de fanzzy-images.mjs.
  const fr = data[0], fg = data[1], fb = data[2];
  const a = new Uint8Array(l * h);
  for (let p = 0; p < l * h; p++) {
    const i = p * c;
    const d = Math.abs(data[i] - fr) + Math.abs(data[i + 1] - fg) + Math.abs(data[i + 2] - fb);
    a[p] = d > 40 ? 255 : 0;
  }
  return { alpha: a, source: 'fond uni écarté' };
}

/** La boîte du sujet : premier et dernier pixel non transparent. */
function boite(alpha, l, h) {
  let x0 = l, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (alpha[y * l + x] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** L'union de plusieurs boîtes. C'est tout l'intérêt du script. */
export function union(boites) {
  return boites.reduce((u, b) => ({
    x0: Math.min(u.x0, b.x0), y0: Math.min(u.y0, b.y0),
    x1: Math.max(u.x1, b.x1), y1: Math.max(u.y1, b.y1),
  }));
}

/** Lit une image et en tire ses pixels RGBA plus la boîte de son sujet. */
export async function analyser(fichier) {
  const brut = sharp(fichier).ensureAlpha();
  const { data, info } = await brut.raw().toBuffer({ resolveWithObject: true });
  const { width: l, height: h, channels: c } = info;

  const { alpha, source } = alphaDuSujet(data, l, h, c);
  const b = boite(alpha, l, h);
  if (!b) throw new Error(`${path.basename(fichier)} : aucun sujet trouvé`);

  const rgba = Buffer.alloc(l * h * 4);
  for (let p = 0; p < l * h; p++) {
    rgba[p * 4] = data[p * c];
    rgba[p * 4 + 1] = data[p * c + 1];
    rgba[p * 4 + 2] = data[p * c + 2];
    rgba[p * 4 + 3] = alpha[p];
  }
  return { rgba, l, h, boite: b, source };
}

/**
 * Écrit une pose dans les trois formats.
 *
 * `fit: 'contain'` avec un fond transparent : la boîte commune n'a aucune
 * raison d'avoir le rapport du cadre, et déformer le personnage pour l'y faire
 * entrer serait pire que de laisser du vide autour.
 */
async function ecrire(rgba, l, h, cadre, sortie, nom) {
  const decoupe = await sharp(rgba, { raw: { width: l, height: h, channels: 4 } })
    .extract(cadre)
    // `.png()` avant `.toBuffer()` : un tampon issu de pixels bruts repart en
    // pixels bruts, et sharp ne sait pas les relire sans leurs dimensions.
    .png().toBuffer();

  const img = sharp(decoupe).resize({
    width: CADRE.l, height: CADRE.h, fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  // Le PNG en dernier : c'est le repli, il doit exister même si un encodeur
  // moderne manque sur la machine.
  for (const [ext, fn] of [['avif', (i) => i.avif({ quality: 62 })],
                           ['webp', (i) => i.webp({ quality: 82 })],
                           ['png', (i) => i.png({ compressionLevel: 9 })]]) {
    await fn(img.clone()).toFile(path.join(sortie, `${nom}.${ext}`));
  }
}

/**
 * Produit les quatre poses depuis un dossier source.
 *
 * Renvoie un compte rendu : ce qui a été écrit, ce qui manque, et la boîte
 * commune retenue. Exporté pour que le test puisse l'appeler sans passer par
 * la ligne de commande.
 */
export async function produire(source, sortie) {
  const fichiers = (await readdir(source)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));

  const retenus = new Map();
  const ignores = [];
  let fond = null;
  for (const f of fichiers) {
    // `fan-goal.webp` comme `goal.png` : le préfixe est celui de la maquette
    // fournie, et renommer quatre fichiers à la main avant chaque passage est
    // exactement le genre d'étape qu'on oublie.
    const nom = path.basename(f, path.extname(f)).toLowerCase().replace(/^(fan|pose)[-_]/, '');
    if (nom in POSES) retenus.set(nom, path.join(source, f));
    else if (nom === FOND.nom) fond = path.join(source, f);
    else ignores.push(f);
  }

  const manquants = Object.keys(POSES).filter((p) => !retenus.has(p));
  if (!retenus.size) {
    throw new Error(`aucune pose reconnue dans ${source}. `
      + `Les fichiers doivent s'appeler ${Object.keys(POSES).join(', ')} `
      + `(l'extension est libre).`);
  }

  const analyses = new Map();
  for (const [nom, f] of retenus) analyses.set(nom, await analyser(f));

  // Toutes les sources doivent avoir la même taille, sinon une boîte commune
  // exprimée en pixels ne veut rien dire d'une image à l'autre.
  const tailles = new Set([...analyses.values()].map((a) => `${a.l}×${a.h}`));
  if (tailles.size > 1) {
    throw new Error('les poses n’ont pas toutes la même taille : '
      + `${[...tailles].join(', ')}. Le cadrage commun suppose des rendus au `
      + 'même format — c’est ce qui garde les pieds du personnage à la '
      + 'même hauteur d’une pose à l’autre.');
  }

  const commune = union([...analyses.values()].map((a) => a.boite));
  const { l, h } = [...analyses.values()][0];
  const cadre = {
    left: commune.x0, top: commune.y0,
    width: commune.x1 - commune.x0 + 1, height: commune.y1 - commune.y0 + 1,
  };

  await mkdir(sortie, { recursive: true });
  for (const [nom, a] of analyses) await ecrire(a.rgba, l, h, cadre, sortie, nom);

  // Le décor : pas de détourage, pas de cadre commun — c'est une photo, on la
  // met juste aux trois formats. Le JPEG remplace le PNG comme repli : un
  // décor photographique en PNG pèse dix fois son prix.
  let decor = null;
  if (fond) {
    const img = sharp(fond).resize({ width: FOND.largeur, withoutEnlargement: true });
    for (const [ext, fn] of [['avif', (i) => i.avif({ quality: 58 })],
                             ['webp', (i) => i.webp({ quality: 80 })],
                             ['jpg', (i) => i.jpeg({ quality: 82, mozjpeg: true })]]) {
      await fn(img.clone()).toFile(path.join(sortie, '..', `${FOND.sortie}.${ext}`));
    }
    const m = await sharp(fond).metadata();
    decor = { source: `${m.width}×${m.height}`, sortie: `${FOND.sortie}.{avif,webp,jpg}` };
  }

  return {
    ecrits: [...analyses.keys()],
    manquants,
    ignores,
    decor,
    source: `${l}×${h}`,
    cadre,
    detourage: [...new Set([...analyses.values()].map((a) => a.source))],
  };
}

/* ----------------------------------------------------------------- main */

if (import.meta.url === `file://${process.argv[1]}`
    || process.argv[1]?.endsWith('poses-supporter.mjs')) {
  const args = process.argv.slice(2);
  const source = args.find((a) => !a.startsWith('--')) ?? path.join(RACINE, 'img_x/poses');
  const i = args.indexOf('--sortie');
  const sortie = i >= 0 && args[i + 1]
    ? path.resolve(args[i + 1])
    : path.join(RACINE, 'public/img/supporter');

  const r = await produire(path.resolve(source), sortie);

  console.log(`source ${r.source}, détourage par ${r.detourage.join(' et ')}`);
  console.log(`cadre commun ${r.cadre.width}×${r.cadre.height} `
    + `à (${r.cadre.left}, ${r.cadre.top}) — le même pour toutes les poses`);
  for (const nom of r.ecrits) console.log(`  ${nom} → ${nom}.{avif,webp,png}`);
  if (r.decor) console.log(`  décor ${r.decor.source} → ../${r.decor.sortie}`);
  else console.log('  aucun décor : pas de bg.* dans le dossier source');
  for (const f of r.ignores) console.log(`  ignoré : ${f} (nom de pose inconnu)`);
  if (r.manquants.length) {
    console.log(`\nposes absentes : ${r.manquants.join(', ')}. L'accueil `
      + 'les ignorera sans rien casser, mais elles ne se joueront jamais.');
  }
  console.log(`\n${r.ecrits.length} pose(s) écrite(s) dans ${sortie}`);
}
