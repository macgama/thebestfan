/**
 * Les images du kit visuel du PASS 1 (Préhistorique) : la voie PASS et ses
 * gains (fil « Rendre le PASS attrayant », 3 novembre 2026).
 *
 * Il ne génère rien. Il **détoure et range** les quinze rendus Artlist
 * (Nano Banana 2, 2K) déposés dans un dossier source, et en tire les trois
 * formats servis dans `public/img/pass/`. Les sources (70 Mo) ne sont pas
 * dans main : elles vivent sur la branche orpheline `pass1-kit-images`,
 * dossier `pass1/` :
 *
 *   git fetch origin pass1-kit-images
 *   git archive FETCH_HEAD pass1 | tar -x -C /tmp/kit
 *   node scripts/pass-images.mjs /tmp/kit/pass1
 *
 * Trois rendus s'écartent de la commande, et on les rattrape ici plutôt que
 * de les refaire en crédits :
 * - `plaque-titre` est sur fond blanc : le détourage lit la couleur du coin ;
 * - `cadre-carte` porte un objet au centre : on vide l'intérieur du cadre ;
 * - `fond-grotte` a un emblème au milieu : servi tel quel, assombri par la page.
 */
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { enIcone, partSuspecte, ecrireLesTrois } from './detourage.mjs';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.resolve(process.argv[2] ?? path.join(RACINE, 'art', 'pass'));
const CIBLE = path.join(RACINE, 'public', 'img', 'pass');

/* `cote` : le carré servi ; `large` : une pièce en longueur, servie à cette
   largeur ; `vider` : la part du cadre (bord compris) à garder autour d'un
   intérieur rendu transparent. */
const PIECES = [
  { id: 'badge-p1', cote: 256 },
  { id: 'badge-p1-or', cote: 256 },
  { id: 'sticker-ouga', cote: 256 },
  { id: 'sticker-massue', cote: 256 },
  { id: 'sticker-os', cote: 256 },
  { id: 'sticker-feu', cote: 256 },
  { id: 'icone-tenue-1', cote: 256 },
  { id: 'icone-tenue-2', cote: 256 },
  { id: 'icone-tenue-3', cote: 256 },
  { id: 'icone-aura', cote: 256, despill: true },
  { id: 'cadre-profil', cote: 512 },
  { id: 'cadre-carte', large: 512, vider: { x: 0.105, y: 0.075 } },
  { id: 'plaque-titre', large: 768, trous: false },
  { id: 'entree-rochers', large: 768 },
];

if (!existsSync(SOURCE)) {
  console.error(`\n  ${SOURCE} n'existe pas. Voir l'en-tête du script.\n`);
  process.exit(1);
}
await mkdir(CIBLE, { recursive: true });

/* La lueur de l'anneau de braises se mêlait au vert du studio : le bord
   gardait un halo vert. Une pièce qui ne porte aucun vert le perd ainsi —
   un pixel s'efface d'autant qu'il est vert, et le vert ne dépasse plus le
   plus fort du rouge et du bleu. */
async function sansVert(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const m = Math.max(data[i], data[i + 2]);
    const vert = data[i + 1] - m;
    if (vert <= 0) continue;
    /* Plus le pixel est vert, plus il est fait de fond : il s'efface. */
    data[i + 3] = Math.round(data[i + 3] * Math.max(0, 1 - vert / 40));
    data[i + 1] = m;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

const suspectes = [];
for (const p of PIECES) {
  const src = path.join(SOURCE, `${p.id}.png`);
  if (!existsSync(src)) { console.log(`  sans source : ${p.id}`); continue; }
  const { png, part } = await enIcone(sharp, src, p.cote ?? 2048, p.id, { trous: p.trous ?? true });
  if (partSuspecte(part)) suspectes.push(`${p.id} (${Math.round(part * 100)} % de fond)`);
  let out = png;
  if (p.large) {
    /* `enIcone` rend un carré : on recoupe sur l'objet, puis on sert en largeur. */
    out = await sharp(png).trim({ threshold: 1 }).png().toBuffer();
    if (p.vider) {
      const { width, height } = await sharp(out).metadata();
      const x = Math.round(width * p.vider.x);
      const y = Math.round(height * p.vider.y);
      const trou = await sharp({ create: { width: width - 2 * x, height: height - 2 * y,
        channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer();
      out = await sharp(out).composite([{ input: trou, left: x, top: y, blend: 'dest-out' }])
        .png().toBuffer();
    }
    out = await sharp(out).resize({ width: p.large }).png().toBuffer();
  }
  if (p.despill) out = await sansVert(out);
  await ecrireLesTrois(sharp, out, CIBLE, p.id);
  console.log(`  ${p.id}`);
}

/* Le fond de grotte : une image pleine, servie en 720 de large. */
const grotte = path.join(SOURCE, 'fond-grotte.png');
if (existsSync(grotte)) {
  const g = await sharp(grotte).resize({ width: 720 }).toBuffer();
  await sharp(g).avif({ quality: 60 }).toFile(path.join(CIBLE, 'fond-grotte.avif'));
  await sharp(g).webp({ quality: 80 }).toFile(path.join(CIBLE, 'fond-grotte.webp'));
  await sharp(g).jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(CIBLE, 'fond-grotte.jpg'));
  console.log('  fond-grotte');
}

if (suspectes.length) console.log(`\nDétourage douteux — à regarder : ${suspectes.join(', ')}`);
