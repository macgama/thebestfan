/**
 * Applique le plan de `fanzzy-prefixes.mjs` : sources, dessins, migration SQL.
 *
 * ## Ce qu'un identifiant touche
 *
 * Bien plus qu'une ligne de catalogue :
 *
 *   — **le code** : `dex*.js` (l'entrée et son champ `evo`), `dex-ages.js` (la
 *     clé de la lignée), `rendus.js` (le numéro de rendu), et les suites qui en
 *     nomment un ;
 *   — **le disque** : `public/img/fanzzy/<ID>.{avif,webp,png}`, son buste, son
 *     dossier d'états, et les sources dans `art/<ID>/_src/` ;
 *   — **la base**, et c'est là que ça devient sérieux : `user_fanzzy`,
 *     `user_skins`, `user_wallet.active_fanzzy`, `souvenirs`, `souvenir_*`, et
 *     le **JSON** de `user_decks.contenu`.
 *
 * Rater une seule de ces places, c'est effacer une carte de la collection de
 * quelqu'un. D'où un seul script qui les fait toutes, à partir du même plan, et
 * un contrôle final qui cherche ce qui traîne encore.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il n'écrit pas en base : il **produit** `sql/prefixes.sql`. La base de
 * production s'applique à la main, comme toutes les migrations de ce projet,
 * et le fichier se relit avant.
 *
 * Usage :
 *   node scripts/fanzzy-prefixes-appliquer.mjs --essai   ce qu'il ferait
 *   node scripts/fanzzy-prefixes-appliquer.mjs           il le fait
 */
import { readFileSync, writeFileSync, existsSync, renameSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const essai = process.argv.includes('--essai');

const plan = JSON.parse(execFileSync(process.execPath,
  [path.join(RACINE, 'scripts', 'fanzzy-prefixes.mjs'), '--json'],
  { encoding: 'utf8', cwd: RACINE }));

/* Du plus long au plus court. `X1` et `X13` cohabitent : remplacer `X1` en
   premier laisserait `X13` intact ici — les motifs sont ancrés — mais l'ordre
   protège de toute forme de motif qu'on ajouterait plus tard sans y penser. */
plan.sort((a, b) => b.de.length - a.de.length);

console.log(`${plan.length} carte(s) à renommer.${essai ? '  (essai)' : ''}\n`);

/* ------------------------------------------------------------ les sources */

/* Les identifiants n'apparaissent que sous deux formes dans le code : entre
   apostrophes — `'X1'`, `id: 'X1'`, `evo:'X1'` — et en clé d'objet en début de
   ligne — `  X1: [` dans AGES, `X1: '001'` dans RENDU.

   On ne remplace **que** ces deux formes. Un remplacement de `X1` partout
   toucherait le mot dans une phrase de documentation, et il y en a. */
const FICHIERS = [
  'src/shared/fanzzy/dex.js',
  'src/shared/fanzzy/dex-2026.js',
  'src/shared/fanzzy/dex-legendes.js',
  'src/shared/fanzzy/dex-series-neuves.js',
  'src/shared/fanzzy/dex-ages.js',
  'src/shared/fanzzy/rendus.js',
  // La liste des dessinés est régénérée après coup, mais la renommer ici évite
  // que le contrôle final la signale comme un reste.
  'public/fanzzy-art.js',
  'scripts/accueil-ui-smoke.mjs',
  'scripts/fanzzy-ui-smoke.mjs',
  'scripts/deck-ui-smoke.mjs',
  'scripts/boosters-ui-smoke.mjs',
  'scripts/nvn-ui-smoke.mjs',
  'scripts/deck-smoke.mjs',
  'scripts/fanzzy-smoke.mjs',
  'scripts/stades-smoke.mjs',
  'scripts/catalogue-smoke.mjs',
  'scripts/amis-smoke.mjs',
  'scripts/amis-ui-smoke.mjs',
  'scripts/matchs-ui-smoke.mjs',
  'scripts/niveau-smoke.mjs',
  'scripts/nvn-net-smoke.mjs',
  'scripts/nvn-smoke.mjs',
  'scripts/souvenirs-smoke.mjs',
  'scripts/virage-loadtest.mjs',
  'scripts/virage-smoke.mjs',
  'scripts/virage-ui-smoke.mjs',
  'scripts/kop-smoke.mjs',
  'scripts/kop-ui-smoke.mjs',
  'scripts/boutique-smoke.mjs',
  'scripts/classement-smoke.mjs',
  'scripts/epreuves-ui-smoke.mjs',
  'scripts/admin-ui-smoke.mjs',
  'scripts/admin-smoke.mjs',
  'scripts/bienvenue-smoke.mjs',
];

let touchesCode = 0;
for (const rel of FICHIERS) {
  const f = path.join(RACINE, rel);
  if (!existsSync(f)) continue;
  const avant = readFileSync(f, 'utf8');
  let s = avant;
  for (const { de, vers } of plan) {
    s = s.split(`'${de}'`).join(`'${vers}'`);
    s = s.replace(new RegExp(`^(\\s*)${de}:`, 'gmu'), `$1${vers}:`);
  }
  if (s !== avant) {
    touchesCode++;
    const n = [...avant].length - [...s].length;
    console.log(`  code  ${rel}${n ? ` (${n > 0 ? '−' : '+'}${Math.abs(n)} car.)` : ''}`);
    if (!essai) writeFileSync(f, s);
  }
}
console.log(`  → ${touchesCode} fichier(s) de code\n`);

/* ------------------------------------------------------------- les dessins */

const IMG = path.join(RACINE, 'public', 'img', 'fanzzy');
const ART = path.join(RACINE, 'art');
let touchesDisque = 0;

for (const { de, vers } of plan) {
  // Le plein-pied, le buste, leurs trois formats.
  for (const variante of ['', '-buste']) {
    for (const ext of ['.avif', '.webp', '.png']) {
      const a = path.join(IMG, `${de}${variante}${ext}`);
      if (!existsSync(a)) continue;
      touchesDisque++;
      if (!essai) renameSync(a, path.join(IMG, `${vers}${variante}${ext}`));
    }
  }
  // Le dossier des douze états, et les sources.
  for (const base of [IMG, ART]) {
    const a = path.join(base, de);
    if (!existsSync(a)) continue;
    touchesDisque++;
    console.log(`  dossier ${path.relative(RACINE, a)} → ${vers}`);
    if (!essai) renameSync(a, path.join(base, vers));
  }
}
console.log(`  → ${touchesDisque} fichier(s) et dossier(s) sur le disque\n`);

/* Les manifestes d'états portent l'identifiant **dans** leur contenu. */
if (!essai) {
  for (const { de, vers } of plan) {
    const m = path.join(IMG, vers, 'manifeste.json');
    if (!existsSync(m)) continue;
    const j = JSON.parse(readFileSync(m, 'utf8'));
    if (j.id === de) {
      j.id = vers;
      writeFileSync(m, `${JSON.stringify(j, null, 2)}\n`);
      console.log(`  manifeste ${vers}/manifeste.json`);
    }
  }
}

/* --------------------------------------------------------- la migration */

/**
 * Une migration qui se relit.
 *
 * Elle est **ordonnée du plus long identifiant au plus court** et chaque mise à
 * jour est exacte (`= 'X1'`, jamais `LIKE 'X1%'`) : un `LIKE` toucherait `X13`
 * en croyant toucher `X1`.
 *
 * Le JSON des decks est traité par `REPLACE` sur le texte, mais **avec les
 * apostrophes** : dans `{"id":"X1"}` la chaîne cherchée est `"X1"`, jamais
 * `X1`. Sans les guillemets, `"X13"` deviendrait `"TR32""3"`.
 */
const lignes = [];
lignes.push('-- Les identifiants disent leur série.');
lignes.push('--');
lignes.push('-- Cent dix-neuf cartes portaient un préfixe étranger à leur série :');
lignes.push('-- `V1` « Choriste » et `X23` étaient dans LA TRIBUNE sans que rien ne le');
lignes.push('-- dise. Après cette migration, `TR32` est dans LA TRIBUNE, et on le sait');
lignes.push('-- sans rien ouvrir.');
lignes.push('--');
lignes.push('-- **Aucune carte n’est supprimée et aucun joueur ne perd rien.** Chaque');
lignes.push('-- table qui référence un identifiant est mise à jour dans la même');
lignes.push('-- transaction : le catalogue, les possessions, les tenues portées, le');
lignes.push('-- Fanzzy équipé, les souvenirs, et le JSON des decks.');
lignes.push('--');
lignes.push('-- Produit par scripts/fanzzy-prefixes-appliquer.mjs. Ne pas modifier à la');
lignes.push('-- main : le plan vient du catalogue, et deux vérités divergeraient.');
lignes.push('');
lignes.push('START TRANSACTION;');
lignes.push('');
lignes.push('-- On désarme le temps de la migration : `fanzzy.evo` pointe sur');
lignes.push('-- `fanzzy.id`, et renommer les deux colonnes ligne par ligne casse la');
lignes.push('-- contrainte à chaque étape intermédiaire.');
lignes.push('SET @@session.foreign_key_checks = 0;');
lignes.push('');

const q = (s) => s.replace(/'/g, "''");
for (const { de, vers, nom } of plan) {
  lignes.push(`-- ${de} → ${vers}  «${nom}»`);
  lignes.push(`UPDATE fanzzy      SET id = '${q(vers)}'            WHERE id = '${q(de)}';`);
  lignes.push(`UPDATE fanzzy      SET evo = '${q(vers)}'           WHERE evo = '${q(de)}';`);
  lignes.push(`UPDATE user_fanzzy SET fanzzy_id = '${q(vers)}'     WHERE fanzzy_id = '${q(de)}';`);
  lignes.push(`UPDATE user_skins  SET fanzzy_id = '${q(vers)}'     WHERE fanzzy_id = '${q(de)}';`);
  lignes.push(`UPDATE user_wallet SET active_fanzzy = '${q(vers)}' WHERE active_fanzzy = '${q(de)}';`);
  lignes.push(`UPDATE souvenirs   SET fanzzy_id = '${q(vers)}'     WHERE fanzzy_id = '${q(de)}';`);
  /* Les guillemets font partie du motif : voir le commentaire au-dessus. */
  lignes.push(`UPDATE user_decks  SET contenu = REPLACE(contenu, '"${q(de)}"', '"${q(vers)}"');`);
  lignes.push('');
}

lignes.push('SET @@session.foreign_key_checks = 1;');
lignes.push('COMMIT;');
lignes.push('');

const sortie = path.join(RACINE, 'sql', 'prefixes.sql');
console.log(`  migration : ${path.relative(RACINE, sortie)} — `
  + `${plan.length * 7} mises à jour`);
if (!essai) writeFileSync(sortie, lignes.join('\n'));

/* ------------------------------------------------------- ce qui traîne */

if (!essai) {
  const anciens = new Set(plan.map((p) => p.de));
  const restes = [];
  const visiter = (dossier) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === 'img') continue;
      const p = path.join(dossier, e.name);
      if (e.isDirectory()) { visiter(p); continue; }
      if (!/\.(js|mjs)$/.test(e.name)) continue;
      const t = readFileSync(p, 'utf8');
      for (const id of anciens) {
        if (t.includes(`'${id}'`)) restes.push(`${path.relative(RACINE, p)} : '${id}'`);
      }
    }
  };
  visiter(path.join(RACINE, 'src'));
  visiter(path.join(RACINE, 'scripts'));
  visiter(path.join(RACINE, 'public'));
  if (restes.length) {
    console.log(`\n  ⚠  ${restes.length} référence(s) à un ancien identifiant :`);
    for (const r of restes.slice(0, 20)) console.log(`     ${r}`);
    process.exitCode = 1;
  } else {
    console.log('\n  aucun ancien identifiant ne traîne dans le code.');
  }
}

console.log(essai
  ? '\nEssai : rien n’a été écrit.'
  : '\nFait. Reste à lancer : npm run manifeste && node scripts/maj-illustres.mjs');
