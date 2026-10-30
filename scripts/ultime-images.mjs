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
 * Une tenue a son image à elle : `<racine>-e<âge>-<tenue>.png`
 * (`RP4-e2-halloween.png`), clé `RP4-e2-halloween` ; la scène la prend quand
 * le Fanzzy porte cette tenue, la base sinon.
 *
 * Les entrées déjà dans la table dont le fichier est toujours dans
 * `public/img/ultime/` restent, même sans leur source : un poste qui n'a que
 * les sources d'une série n'efface plus les autres. Pour retirer une image,
 * retirer son fichier.
 *
 * Les clips (Artlist, 4 s, 9:16, sans son) suivent la même règle : source
 * `<racine>-e<âge>.mp4` dans le même dossier, réencodée par ffmpeg en MP4
 * H.264 de 540 × 960 sans piste son (`FFMPEG` pour un autre ffmpeg que celui
 * du PATH), puis la table `CLIPS` de `public/ultime.js`.
 *
 *   node scripts/ultime-images.mjs
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(RACINE, 'art', 'ultime', '_src');
const CIBLE = path.join(RACINE, 'public', 'img', 'ultime');
const SCENE = path.join(RACINE, 'public', 'ultime.js');
const LARGEUR = 720;
const HAUTEUR = 1280;
const NOM = /^([A-Z]{2}\d+)-e([1-3])(-[a-z]+)?\.(png|jpe?g|webp)$/i;
const NOM_CLIP = /^([A-Z]{2}\d+)-e([1-3])(-[a-z]+)?\.mp4$/i;
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

if (!fs.existsSync(SOURCE)) {
  console.error(`Pas de sources dans ${path.relative(RACINE, SOURCE)} : rien à faire.`);
  process.exit(1);
}
fs.mkdirSync(CIBLE, { recursive: true });

/** Écrit `tampon` sous `<clé>.<empreinte>.<ext>` et retire les anciennes versions. */
function ecrire(cle, ext, tampon) {
  const empreinte = crypto.createHash('sha1').update(tampon).digest('hex').slice(0, 8);
  const sortie = `${cle}.${empreinte}.${ext}`;
  for (const vieux of fs.readdirSync(CIBLE)) {
    if (vieux.startsWith(`${cle}.`) && vieux.endsWith(`.${ext}`) && vieux !== sortie) fs.unlinkSync(path.join(CIBLE, vieux));
  }
  fs.writeFileSync(path.join(CIBLE, sortie), tampon);
  return sortie;
}

/* L'encodeur H.264 : libx264 s'il est là ; sinon libopenh264 (le ffmpeg
   livré avec certains logiciels n'a que lui), à débit fixe. */
let ENCODEUR = null;
function encodeur() {
  if (ENCODEUR) return ENCODEUR;
  const liste = execFileSync(FFMPEG, ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  if (/\slibx264\s/.test(liste)) {
    ENCODEUR = ['-c:v', 'libx264', '-profile:v', 'main', '-crf', '26', '-preset', 'slow'];
  } else if (/\slibopenh264\s/.test(liste)) {
    ENCODEUR = ['-c:v', 'libopenh264', '-b:v', '1400k'];
  } else {
    console.error(`${FFMPEG} n'a ni libx264 ni libopenh264 : impossible d'encoder les clips.`);
    process.exit(1);
  }
  return ENCODEUR;
}

const table = {};
const clips = {};
for (const fichier of fs.readdirSync(SOURCE).sort()) {
  const m = NOM_CLIP.exec(fichier);
  if (!m) continue;
  const cle = `${m[1].toUpperCase()}-e${m[2]}${(m[3] ?? '').toLowerCase()}`;
  const tmp = path.join(os.tmpdir(), `ultime-${process.pid}-${cle}.mp4`);
  encodeur();
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-i', path.join(SOURCE, fichier),
    '-vf', `scale=540:960:force_original_aspect_ratio=increase,crop=540:960`,
    ...ENCODEUR, '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', tmp]);
  const tampon = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  clips[cle] = ecrire(cle, 'mp4', tampon);
  console.log(`  clip ${cle.padEnd(16)} ${Math.round(tampon.length / 1024)} ko`);
}
for (const fichier of fs.readdirSync(SOURCE).sort()) {
  const m = NOM.exec(fichier);
  if (!m) continue;
  const cle = `${m[1].toUpperCase()}-e${m[2]}${(m[3] ?? '').toLowerCase()}`;
  const tampon = await sharp(path.join(SOURCE, fichier))
    .resize(LARGEUR, HAUTEUR, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80 })
    .toBuffer();
  // Les versions précédentes de la même image partent : une seule par clé.
  table[cle] = ecrire(cle, 'webp', tampon);
  console.log(`  ok   ${cle.padEnd(16)} ${Math.round(tampon.length / 1024)} ko`);
}

/** Réécrit la table `nom` de la scène entre ses deux repères. */
function reecrire(scene, nom, t) {
  const cles = Object.keys(t).sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
  const bloc = cles.length
    ? `  const ${nom} = {\n${cles.map((k) => `    '${k}': '${t[k]}',`).join('\n')}\n  };`
    : `  const ${nom} = {};`;
  const avant = new RegExp(`(/\\* ${nom}: début \\*/\\n)[\\s\\S]*?(\\n {2}/\\* ${nom}: fin \\*/)`);
  if (!avant.test(scene)) {
    console.error(`Les repères « ${nom}: début / fin » manquent dans public/ultime.js.`);
    process.exit(1);
  }
  console.log(`  ${cles.length} ${nom === 'IMAGES' ? 'image(s)' : 'clip(s)'} dans public/ultime.js`);
  return scene.replace(avant, `$1${bloc}$2`);
}

/** Les entrées de la table `nom` déjà écrites, dont le fichier est encore là. */
function deja(scene, nom) {
  const bloc = new RegExp(`/\\* ${nom}: début \\*/([\\s\\S]*?)/\\* ${nom}: fin \\*/`).exec(scene)?.[1] ?? '';
  const t = {};
  for (const [, k, f] of bloc.matchAll(/'([^']+)': '([^']+)'/g)) {
    if (fs.existsSync(path.join(CIBLE, f))) t[k] = f;
  }
  return t;
}

console.log('');
let scene = fs.readFileSync(SCENE, 'utf8');
Object.assign(table, { ...deja(scene, 'IMAGES'), ...table });
Object.assign(clips, { ...deja(scene, 'CLIPS'), ...clips });
scene = reecrire(scene, 'IMAGES', table);
scene = reecrire(scene, 'CLIPS', clips);
fs.writeFileSync(SCENE, scene);
