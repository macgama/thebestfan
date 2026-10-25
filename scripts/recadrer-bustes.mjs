/**
 * Refait les bustes et les portraits des Fanzzy de `cadrage-bustes.mjs`, à
 * partir des images servies — sans repasser par les rendus d'Artlist.
 *
 *   node scripts/recadrer-bustes.mjs                 réécrit les fichiers
 *   node scripts/recadrer-bustes.mjs --apercu x.png  une planche, rien d'écrit
 *
 * Le buste plat (`RP34-buste`) se tire du plein-pied plat (`RP34.png`), le
 * portrait d'une tenue (`RP34/e1/base/portrait`) de son état de repos
 * (`neutre.png`). Ensuite, comme après un lot : `rev` monte dans le manifeste
 * de chaque Fanzzy touché (le cache des joueurs lâche l'ancien portrait),
 * `index.json` se recolle, et `maj-illustres` recalcule l'empreinte des
 * bustes plats.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { CADRAGES, bustCadre } from './cadrage-bustes.mjs';
import { agreger } from './fanzzy-manifeste.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DOSSIER = path.join(RACINE, 'public', 'img', 'fanzzy');
const TAILLE = { l: 320, h: 320 };
const args = process.argv.slice(2);
const apercu = args.includes('--apercu') ? args[args.indexOf('--apercu') + 1] : null;

const FORMATS = [
  ['avif', (i) => i.avif({ quality: 62 })],
  ['webp', (i) => i.webp({ quality: 82 })],
  ['png', (i) => i.png({ compressionLevel: 9 })],
];

async function lire(fichier) {
  const { data, info } = await sharp(fichier).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: l, height: h } = info;
  const b = { x0: l, y0: h, x1: -1, y1: -1 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      if (data[(y * l + x) * 4 + 3] < 128) continue;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    }
  }
  if (b.x1 < 0) throw new Error(`${fichier} : aucun sujet`);
  return { data, l, h, b };
}

const travaux = [];
for (const [carte, k] of Object.entries(CADRAGES)) {
  const plat = path.join(DOSSIER, `${carte}.png`);
  if (existsSync(plat)) travaux.push({ nom: `${carte}-buste`, source: plat, sortie: path.join(DOSSIER, `${carte}-buste`), k });
  const [, racine, suffixe] = /^([A-Z]+\d+)([BC]?)$/.exec(carte);
  const evo = { '': 1, B: 2, C: 3 }[suffixe];
  const dossierAge = path.join(DOSSIER, racine, `e${evo}`);
  if (!existsSync(dossierAge)) continue;
  for (const tenue of (await readdir(dossierAge, { withFileTypes: true })).filter((d) => d.isDirectory())) {
    const repos = path.join(dossierAge, tenue.name, 'neutre.png');
    if (!existsSync(repos) || !existsSync(path.join(dossierAge, tenue.name, 'portrait.png'))) continue;
    travaux.push({ nom: `${racine}/e${evo}/${tenue.name}`, source: repos,
      sortie: path.join(dossierAge, tenue.name, 'portrait'), k, racine });
  }
}

const vignettes = [];
const touches = new Set();
for (const t of travaux) {
  const { data, l, h, b } = await lire(t.source);
  const buste = await bustCadre(sharp, data, l, h, b, t.k, TAILLE);
  if (apercu) {
    vignettes.push({ nom: t.nom, png: await buste.png().toBuffer(), avant: await readFile(`${t.sortie}.png`) });
    continue;
  }
  for (const [ext, fn] of FORMATS) await writeFile(`${t.sortie}.${ext}`, await fn(buste.clone()).toBuffer());
  if (t.racine) touches.add(t.racine);
  console.log(`  ok   ${t.nom}`);
}

if (apercu) {
  // Avant à gauche, après à droite, sur le gris des planches de contrôle.
  const V = 160, cols = 6;
  const lignes = Math.ceil(vignettes.length / cols);
  const calques = [];
  for (const [i, v] of vignettes.entries()) {
    const x = (i % cols) * (2 * V + 24), y = Math.floor(i / cols) * (V + 22);
    calques.push({ input: await sharp(v.avant).resize(V, V).toBuffer(), left: x, top: y });
    calques.push({ input: await sharp(v.png).resize(V, V).toBuffer(), left: x + V + 4, top: y });
    calques.push({ input: Buffer.from(`<svg width="${2 * V}" height="18"><text x="2" y="14" font-size="13" fill="#ff8">${v.nom}</text></svg>`),
      left: x, top: y + V + 2 });
  }
  await sharp({ create: { width: cols * (2 * V + 24), height: lignes * (V + 22), channels: 4,
    background: { r: 64, g: 68, b: 78, alpha: 1 } } }).composite(calques).png().toFile(apercu);
  console.log(`planche : ${apercu} (${vignettes.length} bustes)`);
  process.exit(0);
}

for (const racine of touches) {
  const chemin = path.join(DOSSIER, racine, 'manifeste.json');
  const m = JSON.parse(await readFile(chemin, 'utf8'));
  m.rev = (m.rev ?? 0) + 1;
  await writeFile(chemin, `${JSON.stringify(m, null, 2)}\n`);
  console.log(`  ${racine} rev ${m.rev}`);
}
const index = await agreger(DOSSIER);
console.log(`index.json : ${index.fanzzy} Fanzzy`);
await import('./maj-illustres.mjs');
