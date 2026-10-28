/**
 * Remet à la bonne taille les images d'état de `tailles-fanzzy.mjs`, à partir
 * des images servies — sans repasser par les rendus d'Artlist.
 *
 *   node scripts/retailler-fanzzy.mjs                 réécrit les fichiers
 *   node scripts/retailler-fanzzy.mjs --apercu x.png  une planche, rien d'écrit
 *
 * Chaque image est agrandie ou réduite autour de ses pieds, dans le même cadre :
 * le personnage reste au sol, à la même place, et seul son corps change de
 * taille. Le repos emporte ses paupières (`cligne`), découpées dans le même
 * cadre. Le portrait ne bouge pas : il se recadre sur la tête, quelle que soit
 * la taille du repos.
 *
 * **Une seule fois par image.** Ce qui a été appliqué est noté dans le
 * manifeste du Fanzzy (`retailles`) ; relancer ne fait que ce qui manque. Une
 * chaîne repassée (`fanzzy-art.mjs`) réécrit le manifeste sans cette note : les
 * images neuves sont alors remises à l'échelle à la prochaine passe — à
 * vérifier d'abord si le Fanzzy a été redessiné entre-temps, la table ne vaut
 * que pour le dessin qu'elle a mesuré.
 *
 * Ensuite, comme après un lot : `rev` monte dans le manifeste (le cache des
 * joueurs lâche l'ancienne image) et `index.json` se recolle, avec la taille
 * d'âge de `AGES`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ECHELLES } from './tailles-fanzzy.mjs';
import { agreger } from './fanzzy-manifeste.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DOSSIER = path.join(RACINE, 'public', 'img', 'fanzzy');
const ETATS = ['neutre', 'joie', 'colere', 'depit', 'pousse'];
const args = process.argv.slice(2);
const apercu = args.includes('--apercu') ? args[args.indexOf('--apercu') + 1] : null;

const FORMATS = [
  ['avif', (i) => i.avif({ quality: 62 })],
  ['webp', (i) => i.webp({ quality: 82 })],
  ['png', (i) => i.png({ compressionLevel: 9 })],
];

async function lire(fichier) {
  const { data, info } = await sharp(fichier).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, l: info.width, h: info.height };
}

/** Les pieds d'un dessin : le bas du sujet, et le milieu de ses jambes. */
function pieds({ data, l, h }) {
  let y1 = -1; let y0 = h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) if (data[(y * l + x) * 4 + 3] >= 128) { if (y < y0) y0 = y; y1 = y; break; }
  }
  if (y1 < 0) return null;
  let x0 = l; let x1 = -1;
  for (let y = Math.round(y1 - (y1 - y0) * 0.3); y <= y1; y++) {
    for (let x = 0; x < l; x++) if (data[(y * l + x) * 4 + 3] >= 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  }
  return { x: (x0 + x1) / 2, y: y1 + 1 };
}

/** L'image `img` à l'échelle `k`, le point `p` restant à sa place. */
async function aLEchelle(img, k, p) {
  const { l, h } = img;
  const L = Math.max(1, Math.round(l * k)); const H = Math.max(1, Math.round(h * k));
  const grand = await sharp(img.data, { raw: { width: l, height: h, channels: 4 } })
    .resize(L, H, { kernel: 'lanczos3' }).raw().toBuffer();
  // Où tombe le coin haut gauche de l'image agrandie, dans le cadre.
  const dx = Math.round(p.x - p.x * k); const dy = Math.round(p.y - p.y * k);
  // La part de l'image agrandie qui reste dans le cadre.
  const sx = Math.max(0, -dx); const sy = Math.max(0, -dy);
  const w = Math.min(L - sx, l - Math.max(0, dx)); const hh = Math.min(H - sy, h - Math.max(0, dy));
  const morceau = await sharp(grand, { raw: { width: L, height: H, channels: 4 } })
    .extract({ left: sx, top: sy, width: w, height: hh }).raw().toBuffer();
  return sharp({ create: { width: l, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: morceau, raw: { width: w, height: hh, channels: 4 }, left: Math.max(0, dx), top: Math.max(0, dy) }])
    .png();
}

const vignettes = [];
const manifestes = new Map();
const touches = new Set();
const manifeste = async (racine) => {
  if (!manifestes.has(racine)) {
    manifestes.set(racine, JSON.parse(await readFile(path.join(DOSSIER, racine, 'manifeste.json'), 'utf8')));
  }
  return manifestes.get(racine);
};

for (const [cle, facteurs] of Object.entries(ECHELLES)) {
  const [racine, age, tenue] = cle.split('/');
  const dossier = path.join(DOSSIER, racine, age, tenue);
  if (!existsSync(path.join(dossier, 'neutre.png'))) { console.log(`  —    ${cle} : pas de repos, ignoré`); continue; }
  const m = await manifeste(racine);
  m.retailles ??= {};
  const pReposAvant = pieds(await lire(path.join(dossier, 'neutre.png')));
  for (const etat of [...ETATS, 'cligne']) {
    const fichier = path.join(dossier, `${etat}.png`);
    if (!existsSync(fichier)) continue;
    // Le repos et ses paupières suivent la tenue ; un état, la tenue et lui.
    const voulu = (facteurs['*'] ?? 1) * (etat === 'cligne' || etat === 'neutre' ? 1 : facteurs[etat] ?? 1);
    const deja = m.retailles[`${age}/${tenue}/${etat}`] ?? 1;
    const k = voulu / deja;
    if (Math.abs(k - 1) < 0.005) continue;
    const img = await lire(fichier);
    // Les paupières n'ont pas de pieds : elles tournent autour de ceux du repos.
    const p = etat === 'cligne' || etat === 'neutre' ? pReposAvant : pieds(img);
    if (!p) continue;
    const sortie = await aLEchelle(img, k, p);
    if (apercu) {
      if (etat !== 'cligne') vignettes.push({ nom: `${cle} ${etat} ×${k.toFixed(2)}`, avant: await readFile(fichier), apres: await sortie.toBuffer() });
      continue;
    }
    const brut = await sortie.toBuffer();
    for (const [ext, fn] of FORMATS) await writeFile(path.join(dossier, `${etat}.${ext}`), await fn(sharp(brut)).toBuffer());
    m.retailles[`${age}/${tenue}/${etat}`] = Math.round(voulu * 1000) / 1000;
    touches.add(racine);
    console.log(`  ok   ${cle} ${etat} ×${k.toFixed(3)}`);
  }
}

if (apercu) {
  // Avant à gauche, après à droite, pieds sur la même ligne.
  const V = 150; const cols = 6; const H = Math.round(V * 960 / 560);
  const lignes = Math.ceil(vignettes.length / cols);
  const calques = [];
  for (const [i, v] of vignettes.entries()) {
    const x = (i % cols) * (2 * V + 24); const y = Math.floor(i / cols) * (H + 22);
    calques.push({ input: await sharp(v.avant).resize(V, H).toBuffer(), left: x, top: y });
    calques.push({ input: await sharp(v.apres).resize(V, H).toBuffer(), left: x + V + 4, top: y });
    calques.push({ input: Buffer.from(`<svg width="${2 * V}" height="18"><text x="2" y="14" font-size="12" fill="#ff8">${v.nom}</text></svg>`),
      left: x, top: y + H + 2 });
  }
  await sharp({ create: { width: cols * (2 * V + 24), height: Math.max(1, lignes) * (H + 22), channels: 4,
    background: { r: 64, g: 68, b: 78, alpha: 1 } } }).composite(calques).png().toFile(apercu);
  console.log(`planche : ${apercu} (${vignettes.length} images)`);
  process.exit(0);
}

for (const racine of touches) {
  const m = manifestes.get(racine);
  m.rev = (m.rev ?? 0) + 1;
  await writeFile(path.join(DOSSIER, racine, 'manifeste.json'), `${JSON.stringify(m, null, 2)}\n`);
  console.log(`  ${racine} rev ${m.rev}`);
}
const index = await agreger(DOSSIER);
console.log(`index.json : ${index.fanzzy} Fanzzy`);
