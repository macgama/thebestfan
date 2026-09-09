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

const RACINE = fileURLToPath(new URL('..', import.meta.url));
export const SORTIE_DEFAUT = path.join(RACINE, 'public', 'img', 'fanzzy');

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
        skins[skin] = { etats: s.etats, portrait: s.portrait === true,
          ...(s.repli ? { repli: s.repli } : {}) };
      }
      evolutions[evo] = { skins };
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
