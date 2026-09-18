#!/usr/bin/env node
/**
 * Les dos de carte, une par série.
 * =================================
 *
 * **Toutes les cartes se retournaient sur le même dos.** Un dégradé gris et un
 * petit triangle au trait : le même pour LA TRIBUNE, pour LE BESTIAIRE et pour
 * LA REPRISE. À l'ouverture d'un booster, c'est pourtant la seule image qu'on
 * regarde pendant une seconde entière — celle d'avant. Elle ne disait rien de
 * ce qu'on allait trouver, et la série, qui est le premier plaisir de la
 * collection, n'existait qu'après le retournement.
 *
 * Les treize dessins vivent dans `art/dos/<CODE>.png`, en 2K. Ce script les
 * réduit à la taille où ils sont réellement affichés et les écrit en trois
 * formats dans `public/img/dos/` — même chaîne, mêmes règles et mêmes formats
 * que `fanzzy-images.mjs` pour les personnages.
 *
 * On ne détoure rien ici : un dos **remplit** la carte, bord à bord. C'est
 * toute la différence avec un Fanzzy, qu'il faut découper de son fond blanc.
 *
 *   node scripts/dos-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(RACINE, 'art', 'dos');
const CIBLE = path.join(RACINE, 'public', 'img', 'dos');

/* La carte fait au plus 260 px de large à l'écran ; on double pour les écrans
   à forte densité et on s'arrête là. Un dos en 2K dans un booster, c'est trois
   mégaoctets téléchargés pour une image qu'on voit une seconde. */
const LARGEUR = 520;
const HAUTEUR = 780;

let sharp;
try {
  ({ default: sharp } = await import('sharp'));
} catch {
  console.error('sharp est absent. Sur ton PC : npm install');
  console.error('Sur le serveur : npm install --include=optional sharp');
  process.exitCode = 1;
}

if (sharp) {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Rien à faire : ${path.relative(RACINE, SOURCE)} n'existe pas.`);
    process.exitCode = 1;
  } else {
    fs.mkdirSync(CIBLE, { recursive: true });

    const dessins = fs.readdirSync(SOURCE)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort();

    if (!dessins.length) console.log('Aucun dos dans art/dos.');

    for (const fichier of dessins) {
      const code = path.basename(fichier, path.extname(fichier)).toUpperCase();
      const img = sharp(path.join(SOURCE, fichier))
        .resize(LARGEUR, HAUTEUR, { fit: 'cover', position: 'centre' });

      await Promise.all([
        img.clone().png({ quality: 90, compressionLevel: 9 })
          .toFile(path.join(CIBLE, `${code}.png`)),
        img.clone().webp({ quality: 86 }).toFile(path.join(CIBLE, `${code}.webp`)),
        img.clone().avif({ quality: 62 }).toFile(path.join(CIBLE, `${code}.avif`)),
      ]);

      const poids = fs.statSync(path.join(CIBLE, `${code}.webp`)).size;
      console.log(`  ok   ${code.padEnd(4)} ${LARGEUR}×${HAUTEUR} · webp ${Math.round(poids / 1024)} ko`);
    }

    console.log(`\n${dessins.length} dos écrits dans public/img/dos.`);
  }
}
