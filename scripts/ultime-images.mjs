#!/usr/bin/env node
/**
 * Les images Ultimate, plein cadre, pour la grande scène (`public/ultime.js`).
 * =========================================================================
 *
 * Une image par lignée et par âge, générée dans Artlist (Nano Banana 2, 9:16,
 * la carte de l'âge en référence ; prompts et fonds propres à chaque Fanzzy
 * hors du dépôt, dans `fanzzy-prompts/ULT-generation/`). Les sources, en 2K,
 * restent hors de git dans `art/ultime/_src/`, nommées `<racine>-e<âge>.png`
 * (`RP4-e2.png`) ; ce script en tire un WebP de 720 × 1280 par image, au nom
 * marqué de son empreinte (`RP4-e2.1a2b3c4d.webp`) pour que le cache du
 * navigateur ne serve jamais une ancienne version, puis réécrit la table
 * `IMAGES` de `public/ultime.js` entre ses deux repères.
 *
 * Une lignée sans image garde la scène dessinée avec sa carte : rien ne
 * casse tant que la série n'est pas complète.
 *
 *   node scripts/ultime-images.mjs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(RACINE, 'art', 'ultime', '_src');
const CIBLE = path.join(RACINE, 'public', 'img', 'ultime');
const SCENE = path.join(RACINE, 'public', 'ultime.js');
const LARGEUR = 720;
const HAUTEUR = 1280;
const NOM = /^([A-Z]{2}\d+)-e([1-3])\.(png|jpe?g|webp)$/i;

if (!fs.existsSync(SOURCE)) {
  console.error(`Pas de sources dans ${path.relative(RACINE, SOURCE)} : rien à faire.`);
  process.exit(1);
}
fs.mkdirSync(CIBLE, { recursive: true });

const table = {};
for (const fichier of fs.readdirSync(SOURCE).sort()) {
  const m = NOM.exec(fichier);
  if (!m) continue;
  const cle = `${m[1].toUpperCase()}-e${m[2]}`;
  const tampon = await sharp(path.join(SOURCE, fichier))
    .resize(LARGEUR, HAUTEUR, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80 })
    .toBuffer();
  const empreinte = crypto.createHash('sha1').update(tampon).digest('hex').slice(0, 8);
  const sortie = `${cle}.${empreinte}.webp`;
  // Les versions précédentes de la même image partent : une seule par clé.
  for (const vieux of fs.readdirSync(CIBLE)) {
    if (vieux.startsWith(`${cle}.`) && vieux !== sortie) fs.unlinkSync(path.join(CIBLE, vieux));
  }
  fs.writeFileSync(path.join(CIBLE, sortie), tampon);
  table[cle] = sortie;
  console.log(`  ok   ${cle.padEnd(8)} ${Math.round(tampon.length / 1024)} ko`);
}

const cles = Object.keys(table).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
const bloc = cles.length
  ? `  const IMAGES = {\n${cles.map((k) => `    '${k}': '${table[k]}',`).join('\n')}\n  };`
  : '  const IMAGES = {};';
const scene = fs.readFileSync(SCENE, 'utf8');
const avant = /(\/\* IMAGES: début \*\/\n)[\s\S]*?(\n {2}\/\* IMAGES: fin \*\/)/;
if (!avant.test(scene)) {
  console.error('Les repères « IMAGES: début / fin » manquent dans public/ultime.js.');
  process.exit(1);
}
fs.writeFileSync(SCENE, scene.replace(avant, `$1${bloc}$2`));
console.log(`\n  ${cles.length} image(s) dans public/ultime.js`);
