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
const TAILLE_AGE = { 1: 0.6, 2: 0.68, 3: 0.76, L: 0.88 };

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

console.log('\n— chaque âge a sa mesure dans index.json');
/* Sans `pieds`, le jeu ne sait pas quelle part de son cadre le personnage
   occupe, et le pose au cadre entier : la moitié de sa carte, une taille
   différente d'un Fanzzy à l'autre. Une agrégation faite sans les images
   (le cloud) les avait effacés (6 novembre 2026). */
const sansMesure = [];
for (const [id, f] of Object.entries(index)) {
  for (const [evo, v] of Object.entries(f.evolutions ?? {})) {
    const repos = Object.values(v.skins ?? {}).some((s) => s.etats?.includes('neutre'));
    if (repos && !(Array.isArray(v.pieds) && v.pieds[0] > 0)) sansMesure.push(`${id}/${evo}`);
  }
}
check(`chaque âge dessiné est mesuré${sansMesure.length ? ` — ${sansMesure.length} sans : ${sansMesure.slice(0, 8).join(', ')}` : ''}`,
  sansMesure.length === 0);

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
    const part = index[id]?.legendaire ? TAILLE_AGE.L : TAILLE_AGE[e];
    if (part * vrai / p[0] > 0.98) check(`${id} âge ${e} : le dessin sort de la boîte`, false);
  }
  if (failures === avantId) check(`${id} : tient dans la boîte à chaque âge`, true);
}

/* ## Le légendaire, au-dessus de l'âge 3 (Gaël, 6 novembre 2026)

   Un légendaire n'a qu'un âge, le premier : sans la marque `legendaire`
   d'index.json, il reprenait la taille d'un âge 1, la plus petite. */
console.log('\n— un légendaire est marqué, et plus grand qu\'un âge 3');
{
  const { BY_ID } = await import('../src/shared/fanzzy/dex.js');
  const faux = Object.entries(index).filter(([id, f]) => (f.legendaire === true) !== (BY_ID.get(id)?.rar === 'legendaire'));
  check(`index.json marque exactement les légendaires du catalogue${faux.length ? ` (${faux.map(([id]) => id).join(', ')})` : ''}`, faux.length === 0);
  check('au moins un légendaire marqué', Object.values(index).some((f) => f.legendaire === true));
  const source = await readFile(path.join(RACINE, 'public', 'fanzzy-etats.js'), 'utf8');
  const lu = /const TAILLE_AGE = \{ 1: ([\d.]+), 2: ([\d.]+), 3: ([\d.]+), L: ([\d.]+) \}/.exec(source);
  check('TAILLE_AGE de la page a sa ligne L, la même qu\'ici', lu && Number(lu[4]) === TAILLE_AGE.L && Number(lu[3]) === TAILLE_AGE[3]);
  check('L est au-dessus de l\'âge 3', TAILLE_AGE.L > TAILLE_AGE[3]);
  /* Chaque table de tailles des pages : une ligne L au-dessus de son âge 3. */
  const pages = ['cartes.js', 'carnet.html', 'duel-nvn.html', 'virage.html', 'deck.html', 'profil.html', 'niveau-fete.js', 'fanzzy-fiche.js'];
  for (const nom of pages) {
    const t = await readFile(path.join(RACINE, 'public', nom), 'utf8');
    const tables = [...t.matchAll(/\{\s*1:\s*([\d.]+),\s*2:\s*([\d.]+),\s*3:\s*([\d.]+)(?:,\s*L:\s*([\d.]+))?\s*\}/g)];
    const sans = tables.filter((m) => !(Number(m[4]) > Number(m[3])));
    check(`${nom} : ${tables.length} table(s) de tailles, chacune avec un L au-dessus de l'âge 3`, tables.length > 0 && sans.length === 0);
  }
}

console.log(failures ? `\n${failures} échec(s)` : '\nTout est vert.');
process.exit(failures ? 1 : 0);
