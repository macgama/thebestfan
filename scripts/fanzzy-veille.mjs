/**
 * La veille : dépose un rendu, les images du jeu se refont.
 *
 * Elle surveille `art/` et relance `fanzzy-art.mjs` sur le dossier concerné dès
 * qu'un fichier y arrive. Rien de plus — c'est la chaîne qui fait le travail,
 * et elle reste la seule vérité sur la façon de produire une image. Une veille
 * qui redécouperait elle-même finirait par découper autrement, un jour, sans
 * qu'on s'en aperçoive.
 *
 * Trois précautions, et chacune répond à une façon précise de se tromper.
 *
 * **On attend que le fichier soit fini d'écrire.** Copier une image de cinq
 * mégaoctets n'est pas instantané : le système signale le fichier dès qu'il est
 * créé, et le lire à cet instant donne un PNG tronqué. On attend donc que sa
 * taille cesse de bouger.
 *
 * **On regroupe.** Déposer douze états d'un coup, c'est douze signaux — donc
 * douze passes de la chaîne sur le même dossier, dont onze pour rien. Un délai
 * de grâce les rassemble en une seule.
 *
 * **On ne relance jamais deux passes en même temps sur un dossier.** Elles
 * écriraient les mêmes fichiers, et le manifeste garderait le résultat de celle
 * qui finit la dernière — pas forcément celle qui a lu les bonnes sources.
 *
 * Usage :
 *   node scripts/fanzzy-veille.mjs            → surveille art/
 *   node scripts/fanzzy-veille.mjs art/TR1    → un seul personnage
 *
 * Ctrl+C pour arrêter.
 */
import { watch } from 'node:fs';
import { stat, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CIBLE = path.resolve(process.argv[2] ?? path.join(RACINE, 'art'));

/** Le temps qu'on laisse aux dépôts groupés pour se terminer. */
const GRACE_MS = 1500;
/** Deux mesures identiques à cet intervalle : le fichier est posé. */
const STABLE_MS = 400;
const ATTENTE_MAX_MS = 30_000;

const IMAGE = /\.(png|jpe?g|webp)$/i;

const enAttente = new Map();   // dossier _src -> minuterie
const enCours = new Set();     // dossiers dont une passe tourne
const aRefaire = new Set();    // dossiers modifiés pendant leur propre passe

const heure = () => new Date().toLocaleTimeString('fr-CH');

/**
 * Attend qu'un fichier ait fini d'être écrit.
 *
 * On compare sa taille à `STABLE_MS` d'intervalle. Un fichier encore en cours
 * de copie grossit entre les deux mesures ; un fichier posé ne bouge plus.
 * Au-delà de trente secondes on renonce et on tente quand même — mieux vaut une
 * erreur de lecture claire qu'une veille bloquée pour toujours.
 */
async function attendreStabilite(fichier) {
  const t0 = Date.now();
  let precedent = -1;
  while (Date.now() - t0 < ATTENTE_MAX_MS) {
    let taille;
    try { taille = (await stat(fichier)).size; }
    catch { return false; }                    // disparu entre-temps
    if (taille > 0 && taille === precedent) return true;
    precedent = taille;
    await new Promise((r) => setTimeout(r, STABLE_MS));
  }
  return true;
}

/** Lance la chaîne sur un dossier `_src`, et attend qu'elle finisse. */
function lancer(dossier) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath,
      [path.join(RACINE, 'scripts', 'fanzzy-art.mjs'), dossier],
      { cwd: RACINE, stdio: 'inherit' });
    p.on('close', (code) => resolve(code ?? 1));
  });
}

async function traiter(dossier) {
  if (enCours.has(dossier)) { aRefaire.add(dossier); return; }
  enCours.add(dossier);

  try {
    // Tous les fichiers du dossier doivent être posés, pas seulement celui qui
    // a déclenché : un dépôt groupé arrive en désordre.
    let fichiers = [];
    try { fichiers = (await readdir(dossier)).filter((f) => IMAGE.test(f)); }
    catch { return; }                          // dossier supprimé
    if (!fichiers.length) return;

    for (const f of fichiers) await attendreStabilite(path.join(dossier, f));

    const relatif = path.relative(RACINE, dossier);
    console.log(`\n[${heure()}] ${fichiers.length} image(s) · ${relatif}`);
    const code = await lancer(dossier);
    if (code !== 0) console.log(`[${heure()}] refusé — rien n’a été écrit.`);
  } finally {
    enCours.delete(dossier);
    if (aRefaire.delete(dossier)) planifier(dossier);
  }
}

function planifier(dossier) {
  clearTimeout(enAttente.get(dossier));
  enAttente.set(dossier, setTimeout(() => {
    enAttente.delete(dossier);
    void traiter(dossier);
  }, GRACE_MS));
}

/**
 * Le dossier `_src` auquel appartient un chemin, ou `null`.
 *
 * On ne réagit qu'à ce qui est **dans** un `_src` : les sorties du jeu vivent
 * ailleurs, et une veille qui se déclencherait sur ce qu'elle vient d'écrire
 * tournerait en rond indéfiniment.
 */
function dossierSource(rel) {
  const parts = rel.split(path.sep);
  const i = parts.indexOf('_src');
  if (i < 0 || i === parts.length - 1) return null;
  return path.join(CIBLE, ...parts.slice(0, i + 1));
}

console.log(`Veille sur ${path.relative(RACINE, CIBLE) || 'art'}/**/_src/`);
console.log('Dépose un rendu, les trois formats se refont. Ctrl+C pour arrêter.\n');

try {
  watch(CIBLE, { recursive: true }, (_type, nom) => {
    if (!nom || !IMAGE.test(nom)) return;
    const dossier = dossierSource(nom);
    if (dossier) planifier(dossier);
  });
} catch (e) {
  console.error(`Impossible de surveiller ${CIBLE} : ${e.message}\n`
    + 'Le dossier existe-t-il ? La surveillance récursive demande Windows ou macOS ; '
    + 'sous Linux, lance la chaîne à la main : node scripts/fanzzy-art.mjs <dossier>');
  process.exit(1);
}

// Une passe au démarrage : les fichiers déposés pendant que la veille était
// éteinte doivent être pris en compte, sinon il faut les retoucher pour rien.
for (const d of await readdir(CIBLE, { withFileTypes: true }).catch(() => [])) {
  if (!d.isDirectory()) continue;
  const src = path.join(CIBLE, d.name, '_src');
  const y = await stat(src).then((s) => s.isDirectory()).catch(() => false);
  if (y) planifier(src);
}
