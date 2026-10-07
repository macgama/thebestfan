/**
 * Le manifeste d'ensemble : un fichier pour tout le catalogue.
 *
 * Chaque Fanzzy a son `manifeste.json` dans son dossier, écrit par
 * `fanzzy-art.mjs`. C'est la bonne granularité pour produire — on retouche une
 * lignée sans toucher aux autres — et la mauvaise pour servir : la page du deck
 * a besoin de savoir, avant de dessiner quoi que ce soit, quels états existent
 * pour les cartes affichées. Aller les chercher un par un, ce serait cent
 * trente-huit requêtes pour ouvrir une page.
 *
 * On les recolle donc en un seul `index.json`, produit à partir du disque et
 * jamais écrit à la main. Il est régénéré à la fin de chaque passage de
 * `fanzzy-art.mjs`, ce qui est le seul moyen fiable de le garder juste : un
 * agrégat qu'il faut penser à reconstruire est un agrégat faux.
 *
 * Usage : node scripts/fanzzy-manifeste.mjs [--sortie public/img/fanzzy]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
export const SORTIE_DEFAUT = path.join(RACINE, 'public', 'img', 'fanzzy');

/**
 * La place du personnage dans le cadre de son âge : `[haut, sous, decal]`.
 *
 * `haut` est la part de la hauteur du cadre qu'occupe son repos, des pieds au
 * sommet du dessin ; `sous`, la part laissée sous ses pieds. Toutes les tenues
 * et tous les états d'un âge partagent un cadre, que la tenue la plus large
 * ou la plus haute décide : sans cette mesure, le jeu ne sait pas quelle
 * taille a vraiment le personnage, et un âge 3 en cape paraît plus petit que
 * son âge 1 (Gaël, 7 octobre 2026). Mesuré sur le repos de la tenue de base,
 * le même pour toutes les tenues de l'âge. `decal` est l'écart entre le
 * milieu de ses jambes et celui du cadre, en hauteurs de cadre.
 *
 * @returns {Promise<[number, number, number] | null>}
 */
async function mesurerPieds(dossierAge, skins) {
  const tenue = skins.base?.etats?.includes('neutre') ? 'base'
    : Object.keys(skins).find((t) => skins[t].etats?.includes('neutre'));
  if (!tenue) return null;
  let data; let info;
  try {
    ({ data, info } = await sharp(path.join(dossierAge, tenue, 'neutre.png'))
      .ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true }));
  } catch { return null; }
  const { width: l, height: h } = info;
  const plein = (y) => { for (let x = 0; x < l; x++) if (data[y * l + x] > 128) return true; return false; };
  let y0 = 0; while (y0 < h && !plein(y0)) y0++;
  let y1 = h - 1; while (y1 > y0 && !plein(y1)) y1--;
  if (y0 >= h) return null;
  /* Le milieu de ses jambes, sur le bas du dessin : c'est lui qu'on centre.
     Le milieu du cadre ne l'est pas toujours — un mégaphone sur l'épaule de
     RP1, à l'âge 3, étire le dessin d'un côté et le corps partait à gauche
     (Gaël, 7 octobre 2026). Exprimé en hauteurs de cadre, comme le reste. */
  let x0 = l; let x1 = -1;
  for (let y = Math.round(y1 - (y1 - y0) * 0.3); y <= y1; y++) {
    for (let x = 0; x < l; x++) if (data[y * l + x] > 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  }
  const r = (v) => Math.round(v * 1000) / 1000;
  const decal = x1 >= x0 ? r(((x0 + x1) / 2 - (l - 1) / 2) / h) : 0;
  return [r((y1 - y0 + 1) / h), r((h - 1 - y1) / h), decal];
}

/**
 * Recolle les manifestes de `dossier` en un `index.json`.
 *
 * Le `sha` de chaque skin ne suit pas : c'est un détail de production, il sert
 * à décider si `rev` doit augmenter et à rien d'autre. Le client n'a besoin que
 * de `rev`, qui casse le cache, et de la liste des états, qui décide du repli.
 *
 * @returns {{fanzzy:number, octets:number, chemin:string}}
 */
export async function agreger(dossier = SORTIE_DEFAUT) {
  const entrees = await readdir(dossier, { withFileTypes: true });
  const fanzzy = {};

  for (const e of entrees.filter((d) => d.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    let m;
    try { m = JSON.parse(await readFile(path.join(dossier, e.name, 'manifeste.json'), 'utf8')); }
    catch { continue; } // un dossier sans manifeste n'est pas encore passé par la chaîne
    const evolutions = {};
    for (const [evo, contenu] of Object.entries(m.evolutions ?? {})) {
      const skins = {};
      for (const [skin, s] of Object.entries(contenu.skins ?? {})) {
        /* `cligne` ne suit que s'il est vrai : trente-cinq Fanzzy n'ont pas
           de paupières, et un `false` de plus par tenue pèserait sur chaque
           ouverture de page pour ne rien dire. */
        skins[skin] = { etats: s.etats, portrait: s.portrait === true,
          ...(s.repli ? { repli: s.repli } : {}),
          ...(s.cligne === true ? { cligne: true } : {}) };
      }
      const pieds = await mesurerPieds(path.join(dossier, e.name, evo), contenu.skins ?? {});
      evolutions[evo] = { skins, ...(pieds ? { pieds } : {}) };
    }
    fanzzy[m.id ?? e.name] = { rev: m.rev ?? 1, evolutions };
  }

  const chemin = path.join(dossier, 'index.json');
  // Sur une seule ligne : ce fichier se lit par le réseau, pas par un humain.
  // L'indentation lui coûterait la moitié de son poids pour rien.
  const texte = `${JSON.stringify({ fanzzy })}\n`;
  await writeFile(chemin, texte);
  return { fanzzy: Object.keys(fanzzy).length, octets: Buffer.byteLength(texte), chemin };
}

// Appelé directement : on agrège et on le dit. Importé : on ne fait rien.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--sortie');
  const r = await agreger(i > 0 && process.argv[i + 1] ? path.resolve(process.argv[i + 1]) : SORTIE_DEFAUT);
  console.log(`${r.fanzzy} Fanzzy, ${(r.octets / 1024).toFixed(1)} Ko → ${path.relative(RACINE, r.chemin)}`);
}
