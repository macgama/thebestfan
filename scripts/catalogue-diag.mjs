/**
 * Pourquoi le classeur annonce-t-il ce nombre-là ?
 *
 * Le classeur ne montre pas « le catalogue ». Il montre les **personnages** —
 * une ligne par lignée, pas une par âge — qui sont **publiés** et dont la
 * série est **ouverte** par une saison lancée. Trois filtres, trois endroits
 * différents, et rien à l'écran ne dit lequel a retiré une carte.
 *
 * D'où ce diagnostic. Il ne répare rien et n'écrit rien : il relit la base
 * telle qu'elle est et nomme, série par série, ce que chaque filtre enlève.
 * Il est donc sans danger sur la base de production — c'est même le seul
 * endroit où il sert, puisque le problème qu'il éclaire est toujours un écart
 * entre `dex.js` et une base **déjà en service** : le catalogue s'amorce en
 * `INSERT IGNORE`, donc une ligne qui existe déjà ne se met jamais à jour.
 *
 * Usage :
 *
 *     DATABASE_URL=mysql://… node scripts/catalogue-diag.mjs
 *     DATABASE_URL=mysql://… node scripts/catalogue-diag.mjs TR   (une série)
 */
import mysql from 'mysql2/promise';
import { DEX } from '../src/shared/fanzzy/dex.js';

const URL_BASE = process.env.DATABASE_URL;
if (!URL_BASE) {
  console.error('DATABASE_URL manquant. Exemple :\n'
    + '  DATABASE_URL=mysql://tbf:tbfpass@127.0.0.1:3307/tbf node scripts/catalogue-diag.mjs');
  process.exit(1);
}
const serieVoulue = process.argv[2] ?? null;

const db = await mysql.createConnection({ uri: URL_BASE });
const [lignes] = await db.query('SELECT id, nom, set_id, stage, rar, evo, publie FROM fanzzy');

/* La racine d'une lignée, calculée **comme le serveur la calcule** : est racine
   ce qui n'est l'`evo` de personne. Recopier « stage = 1 » ici donnerait un
   diagnostic qui contredit le jeu, ce qui est pire que pas de diagnostic. */
const suivi = new Set(lignes.map((f) => f.evo).filter(Boolean));
const racines = lignes.filter((f) => !suivi.has(f.id));

/* Les séries ouvertes : l'union des saisons lancées. Une base sans saison
   lancée n'ouvre rien de particulier — le jeu lit ça comme « aucune
   restriction », et il faut le lire pareil ici. */
let ouvertes = null;
try {
  const [s] = await db.query(
    'SELECT series FROM saisons WHERE lancee_a IS NOT NULL');
  const vues = new Set();
  for (const r of s) {
    const l = typeof r.series === 'string' ? JSON.parse(r.series) : r.series;
    for (const id of l ?? []) vues.add(id);
  }
  if (vues.size) ouvertes = vues;
} catch { /* pas encore de table `saisons` : aucune restriction. */ }

console.log('');
console.log(`base    : ${new URL(URL_BASE).pathname.slice(1)} sur ${new URL(URL_BASE).hostname}`);
console.log(`lignes  : ${lignes.length} dans la table, ${DEX.length} dans dex.js`);
console.log(`séries  : ${ouvertes ? [...ouvertes].join(', ') : 'toutes (aucune saison ne restreint)'}`);
console.log('');

const series = [...new Set(racines.map((f) => f.set_id))].sort();
const table = {};
for (const set of series) {
  if (serieVoulue && set !== serieVoulue) continue;
  const r = racines.filter((f) => f.set_id === set);
  const pub = r.filter((f) => f.publie);
  table[set] = {
    personnages: r.length,
    publiés: pub.length,
    'au classeur': (!ouvertes || ouvertes.has(set)) ? pub.length : 0,
  };
}
console.table(table);

const auClasseur = Object.values(table).reduce((a, b) => a + b['au classeur'], 0);
console.log(`Le classeur montre ${auClasseur} personnage(s), et la jauge dit /${auClasseur}.`);
console.log('');

/* Le détail, pour la série qu'on interroge : ce n'est plus un nombre à
   expliquer mais une liste de noms, qu'on peut comparer à ce qu'on croyait
   avoir publié. */
for (const set of series) {
  if (serieVoulue && set !== serieVoulue) continue;
  const caches = racines.filter((f) => f.set_id === set && !f.publie);
  if (!caches.length) continue;
  console.log(`${set} — ${caches.length} personnage(s) dépublié(s), donc absent(s) du classeur :`);
  for (const f of caches) console.log(`   ${f.id.padEnd(7)} ${f.nom}`);
  console.log('');
}

/* L'écart avec `dex.js`. C'est la panne la plus discrète du lot : une carte
   ajoutée au fichier d'amorçage arrive bien en base au redémarrage, mais une
   carte **déjà présente** qui change de série ou de nom n'y arrive jamais —
   `INSERT IGNORE` n'écrase rien. Les migrations de `sql/` sont là pour ça, et
   une migration non appliquée ne se voit qu'ici. */
const enBase = new Map(lignes.map((f) => [f.id, f]));
const absentes = DEX.filter((f) => !enBase.has(f.id));
const deplacees = DEX.filter((f) => enBase.get(f.id) && enBase.get(f.id).set_id !== f.set);
if (absentes.length) {
  console.log(`${absentes.length} carte(s) de dex.js absente(s) de la base `
    + '— un redémarrage du serveur les posera :');
  console.log(`   ${absentes.map((f) => f.id).join(' ')}`);
  console.log('');
}
if (deplacees.length) {
  console.log(`${deplacees.length} carte(s) rangée(s) dans une autre série que dex.js `
    + '— il manque une migration de sql/ (raretes.sql, series-neuves.sql) :');
  for (const f of deplacees.slice(0, 40)) {
    console.log(`   ${f.id.padEnd(7)} base : ${enBase.get(f.id).set_id.padEnd(3)} dex.js : ${f.set}`);
  }
  if (deplacees.length > 40) console.log(`   … et ${deplacees.length - 40} autre(s)`);
  console.log('');
}
if (!absentes.length && !deplacees.length) {
  console.log('La base et dex.js disent la même chose : aucune migration ne manque.');
  console.log('');
}

await db.end();
