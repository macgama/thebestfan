#!/usr/bin/env node
/**
 * Les décors peints, une plaque par série et par rareté.
 * ======================================================
 *
 * ## Ce qu'ils ajoutent, et ce qu'ils ne remplacent pas
 *
 * `public/fanzzy-fond.js` dessine un décor pour chaque carte : un lieu par
 * série, une palette par tenue, une lumière par âge, une aura par rareté. Ça
 * couvre les treize séries sans un seul fichier, ça change d'époque avec le
 * costume, et une saison neuve en hérite le jour où on l'ajoute.
 *
 * Une plaque peinte ne sait rien faire de tout ça. Elle ne sait faire qu'une
 * chose, que le dessin ne fera jamais : **être belle**.
 *
 * Les deux cohabitent donc, et la règle est stricte — la plaque remplace le
 * *lieu*, rien d'autre. Le motif de famille, la lumière de l'âge et l'aura de
 * rareté se posent par-dessus, comme avant. Une carte sans plaque garde son
 * décor dessiné, et c'est le cas de douze séries sur treize.
 *
 * ## Pourquoi seulement la tenue de base
 *
 * Parce qu'une tenue fait basculer toute la palette : le même comptoir en
 * nocturne, en ocre préhistorique, en cendre apocalyptique. Une plaque peinte
 * en fin d'été ne devient pas préhistorique, et la poser sous une tenue qui
 * l'est ferait mentir la seule chose qui rend une tenue visible de loin.
 *
 * Quatre plaques par série, c'est déjà cinquante-deux images pour le catalogue
 * actuel et quatre de plus à chaque saison. Les multiplier par les tenues n'a
 * pas de fin.
 *
 *   node scripts/fonds-images.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(RACINE, 'art', 'fonds');
const CIBLE = path.join(RACINE, 'public', 'img', 'fonds');
const MODULE = path.join(RACINE, 'public', 'fanzzy-fond.js');

/* La vitrine de la fiche monte à six cents pixels de large sur un grand écran.
   On double pour les écrans à forte densité et on s'arrête là : un décor est
   derrière un personnage, il n'a pas à être net au pixel. */
const LARGEUR = 720;
const HAUTEUR = 1080;

const RARETES = ['commune', 'rare', 'epique', 'legendaire'];

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

    const plaques = fs.readdirSync(SOURCE)
      .filter((f) => /\.(png|jpe?g|webp)$/i.test(f))
      .sort();

    const faits = [];
    const rejetes = [];

    for (const fichier of plaques) {
      const code = path.basename(fichier, path.extname(fichier));

      /* Le nom porte la règle : `<SÉRIE>-<rareté>`. On refuse plutôt que de
         deviner — une plaque mal nommée ne s'afficherait jamais, et chercher
         pourquoi coûte une heure. */
      const m = /^([A-Z]{2})-(commune|rare|epique|legendaire)$/.exec(code);
      if (!m) { rejetes.push(code); continue; }

      const img = sharp(path.join(SOURCE, fichier))
        .resize(LARGEUR, HAUTEUR, { fit: 'cover', position: 'centre' });

      await Promise.all([
        img.clone().webp({ quality: 82 }).toFile(path.join(CIBLE, `${code}.webp`)),
        img.clone().avif({ quality: 58 }).toFile(path.join(CIBLE, `${code}.avif`)),
        img.clone().png({ compressionLevel: 9 }).toFile(path.join(CIBLE, `${code}.png`)),
      ]);

      const poids = fs.statSync(path.join(CIBLE, `${code}.webp`)).size;
      console.log(`  ok   ${code.padEnd(16)} ${LARGEUR}×${HAUTEUR} · webp ${Math.round(poids / 1024)} ko`);
      faits.push(code);
    }

    if (rejetes.length) {
      console.error(`\nIgnorées, nom hors règle « <SÉRIE>-<rareté> » : ${rejetes.join(', ')}`);
      console.error(`Raretés acceptées : ${RARETES.join(', ')}`);
      process.exitCode = 1;
    }

    /* La liste est réécrite dans le module, comme `maj-illustres.mjs` le fait
       pour les Fanzzy dessinés. Un manifeste JSON demanderait une requête et
       un état asynchrone à un module qui rend du SVG en une ligne. */
    const brut = fs.readFileSync(MODULE, 'utf8');
    const crlf = brut.includes('\r\n');
    let s = brut.replace(/\r\n/g, '\n');
    const DEBUT = '  const FONDS = new Set([';
    const FIN = '  ]);';
    const i = s.indexOf(DEBUT);
    const j = s.indexOf(FIN, i);
    if (i < 0 || j < 0) {
      console.error('bornes de FONDS introuvables dans fanzzy-fond.js');
      process.exitCode = 1;
    } else {
      const liste = faits.sort().map((c) => `    '${c}',`).join('\n');
      s = s.slice(0, i) + DEBUT + '\n' + liste + '\n' + s.slice(j);
      fs.writeFileSync(MODULE, crlf ? s.replace(/\n/g, '\r\n') : s);
      console.log(`\n${faits.length} plaque(s) publiée(s), et la liste est à jour dans fanzzy-fond.js.`);
    }
  }
}
