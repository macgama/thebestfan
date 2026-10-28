/**
 * Le Fanzzy a la taille de son âge, dans toutes ses tenues — test des images
 * servies, sans base ni serveur.
 *
 * Ce qu'on vérifie, sur `tailles-fanzzy.mjs` et `public/img/fanzzy/` :
 *
 *   — chaque correction d'âge (`AGES`) est passée dans `index.json` : c'est
 *     elle, et non la hauteur du dessin, que le jeu met à la taille de l'âge ;
 *   — chaque remise à l'échelle (`ECHELLES`) a été appliquée aux images, une
 *     fois (la note `retailles` du manifeste) ;
 *   — une image remise à l'échelle garde ses pieds où ils étaient : le Fanzzy
 *     ne flotte pas, ne s'enfonce pas ;
 *   — un âge agrandi ne sort pas de la boîte de l'accueil, ce qu'il tient
 *     au-dessus de sa tête compris.
 *
 * Usage : node scripts/tailles-smoke.mjs
 */
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { AGES, ECHELLES } from './tailles-fanzzy.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = path.join(RACINE, 'public', 'img', 'fanzzy');
// Les mêmes que `TBF_ETATS.taille` (public/fanzzy-etats.js).
const TAILLE_AGE = { 1: 0.6, 2: 0.68, 3: 0.76 };

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const index = JSON.parse(await readFile(path.join(PUBLIC, 'index.json'), 'utf8')).fanzzy;

/** Le bas du sujet d'une image, en part de sa hauteur. */
async function bas(fichier) {
  const { data, info } = await sharp(fichier).ensureAlpha().extractChannel(3).raw()
    .toBuffer({ resolveWithObject: true });
  const { width: l, height: h } = info;
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < l; x++) if (data[y * l + x] > 128) return (h - 1 - y) / h;
  return null;
}

console.log('\n— les âges corrigés sont dans index.json');
let absents = 0;
for (const [id, ages] of Object.entries(AGES)) {
  for (const [age, corps] of Object.entries(ages)) {
    const p = index[id]?.evolutions?.[`e${age}`]?.pieds;
    if (!p) { absents++; continue; }
    if (p[0] !== corps) check(`${id} âge ${age} : pieds ${p[0]} au lieu de ${corps}`, false);
  }
}
check(`${Object.keys(AGES).length} Fanzzy, chaque âge corrigé mesuré au corps`, failures === 0 && absents === 0);

console.log('\n— les remises à l\'échelle sont appliquées, une fois');
const avant = failures;
let images = 0;
for (const [cle, facteurs] of Object.entries(ECHELLES)) {
  const [id, age, tenue] = cle.split('/');
  const m = JSON.parse(await readFile(path.join(PUBLIC, id, 'manifeste.json'), 'utf8'));
  for (const etat of ['neutre', 'joie', 'colere', 'depit', 'pousse']) {
    if (!existsSync(path.join(PUBLIC, id, age, tenue, `${etat}.png`))) continue;
    const voulu = (facteurs['*'] ?? 1) * (etat === 'neutre' ? 1 : facteurs[etat] ?? 1);
    if (Math.abs(voulu - 1) < 0.005) continue;
    images++;
    const note = m.retailles?.[`${age}/${tenue}/${etat}`];
    if (Math.abs((note ?? 1) - voulu) > 0.002) check(`${cle} ${etat} : ×${voulu} attendu, ${note ?? 'rien'} noté`, false);
  }
}
check(`${images} images notées dans leur manifeste`, failures === avant && images > 0);

console.log('\n— les pieds restent au sol');
const repos = Object.keys(ECHELLES).filter((c) => ECHELLES[c]['*']).slice(0, 12);
for (const cle of repos) {
  const [id, age, tenue] = cle.split('/');
  const b = await bas(path.join(PUBLIC, id, age, 'base', 'neutre.png'));
  const t = await bas(path.join(PUBLIC, id, age, tenue, 'neutre.png'));
  check(`${cle} : pieds de la tenue au niveau de la base (${(t * 100).toFixed(1)} % / ${(b * 100).toFixed(1)} %)`,
    Math.abs(t - b) < 0.02);
}

console.log('\n— un âge agrandi tient dans sa boîte');
for (const id of Object.keys(AGES)) {
  const ev = index[id]?.evolutions ?? {};
  const avantId = failures;
  // Le dessin entier à l'écran : il ne sort pas de la boîte de l'accueil.
  for (const e of [1, 2, 3]) {
    const p = ev[`e${e}`]?.pieds;
    if (!p) continue;
    const vrai = await (async () => {
      const f = path.join(PUBLIC, id, `e${e}`, 'base', 'neutre.png');
      const { data, info } = await sharp(f).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
      let y0 = 0; while (y0 < info.height && !data.subarray(y0 * info.width, (y0 + 1) * info.width).some((v) => v > 128)) y0++;
      let y1 = info.height - 1; while (y1 > y0 && !data.subarray(y1 * info.width, (y1 + 1) * info.width).some((v) => v > 128)) y1--;
      return (y1 - y0 + 1) / info.height;
    })();
    if (TAILLE_AGE[e] * vrai / p[0] > 0.98) check(`${id} âge ${e} : le dessin sort de la boîte`, false);
  }
  if (failures === avantId) check(`${id} : tient dans la boîte à chaque âge`, true);
}

console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
