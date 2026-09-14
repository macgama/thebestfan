/**
 * Passe toute l'écurie : chaque `art/<ID>/_src` qui a bougé.
 *
 * ## Pourquoi ce script existe
 *
 * `fanzzy-art.mjs` prend **un** dossier et le produit. C'est la bonne
 * granularité — on retouche une lignée sans toucher aux autres — et c'est aussi
 * ce qui fait qu'on croit que rien ne marche : on dépose trois images dans
 * `art/TR2/_src`, on attend, et il ne se passe rien. Rien ne surveille ce
 * dossier, et rien ne devrait : un observateur qui réencode cinq mégaoctets à
 * chaque écriture de fichier pendant qu'on en copie quarante est une nuisance.
 *
 * Ce qu'il fallait n'était donc pas une surveillance, mais **une seule commande
 * à connaître**. Celle-ci fait le tour, et ne refait que ce qui a changé.
 *
 * ## Ce qui décide qu'un lot a bougé
 *
 * La date du fichier source le plus récent, comparée à celle du
 * `manifeste.json` produit. C'est grossier et c'est juste : le manifeste est
 * réécrit à chaque passage, donc il est toujours postérieur à ce qui l'a
 * produit. Une image déposée après lui est une image qui n'y est pas.
 *
 * On ne se fie pas à l'empreinte du contenu ici — `fanzzy-art.mjs` la calcule
 * déjà pour décider du `rev`, et la recalculer d'avance voudrait dire lire
 * tous les fichiers deux fois pour n'en produire aucun.
 *
 * Usage :
 *   node scripts/fanzzy-art-tout.mjs           ce qui a changé
 *   node scripts/fanzzy-art-tout.mjs --force   tout, quoi qu'il arrive
 */
import { readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const ART = path.join(RACINE, 'art');
const SORTIE = path.join(RACINE, 'public', 'img', 'fanzzy');
const force = process.argv.includes('--force');

/** La date du fichier le plus récent d'un dossier. `0` s'il est vide. */
async function plusRecent(dossier) {
  let t = 0;
  for (const f of await readdir(dossier)) {
    const s = await stat(path.join(dossier, f));
    if (s.isFile()) t = Math.max(t, s.mtimeMs);
  }
  return t;
}

const dossiers = [];
for (const e of await readdir(ART, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const src = path.join(ART, e.name, '_src');
  try { if (!(await stat(src)).isDirectory()) continue; } catch { continue; }
  dossiers.push({ id: e.name, src });
}

if (!dossiers.length) {
  console.log('Aucun dossier art/<ID>/_src. Rien à produire.');
  process.exit(0);
}

let faits = 0;
let sautes = 0;
let echecs = 0;

for (const { id, src } of dossiers) {
  const source = await plusRecent(src);
  let produit = 0;
  try { produit = (await stat(path.join(SORTIE, id, 'manifeste.json'))).mtimeMs; }
  catch { /* jamais produit */ }

  if (!force && produit && produit >= source) {
    console.log(`${id.padEnd(6)} à jour`);
    sautes++;
    continue;
  }

  /* On appelle le vrai script plutôt que d'en recopier le travail. Il fait
     six cents lignes de détourage, de cadrage commun et de manifeste ; une
     seconde implémentation « juste pour boucler » serait la plus coûteuse des
     secondes vérités de ce projet. */
  const code = await new Promise((r) => {
    const p = spawn(process.execPath,
      [path.join(RACINE, 'scripts', 'fanzzy-art.mjs'), path.relative(RACINE, src)],
      { cwd: RACINE, stdio: 'inherit' });
    p.on('close', r);
  });
  if (code === 0) faits++;
  else { echecs++; console.error(`${id} : la chaîne a refusé quelque chose (code ${code}).`); }
}

console.log(`\n${faits} lot(s) produit(s), ${sautes} déjà à jour`
  + (echecs ? `, ${echecs} en échec` : ''));
process.exitCode = echecs ? 1 : 0;
