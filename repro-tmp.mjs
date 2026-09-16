/**
 * Reproduction de la panne de prefixes.sql, sur la base de test.
 *
 * On applique la vraie liste de `appliquer-schema.mjs`, dans le même ordre et
 * avec la même connexion : c'est la seule façon de savoir si le correctif tient
 * dans les conditions du déploiement, et non dans celles d'un extrait.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('.', import.meta.url));
const SQL = path.join(RACINE, 'sql');
const DB = 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';

const ORDRE = ['auth', 'football', 'minutes', 'couleurs', 'duel', 'souvenirs', 'fanzzy',
  'teletext', 'inventaire', 'skins', 'tenues', 'deck', 'admin', 'kop', 'amis',
  'niveau', 'raretes', 'stades', 'boutique', 'billets', 'saisons',
  'series-neuves', 'prefixes', 'identites'];

const mysql = await import('mysql2/promise');
const cnx = await mysql.createConnection({ uri: DB, multipleStatements: true });

// Table rase : on éprouve une base neuve, comme au premier déploiement.
const [tables] = await cnx.query(
  `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()`);
if (tables.length) {
  await cnx.query('SET FOREIGN_KEY_CHECKS = 0');
  await cnx.query(`DROP TABLE IF EXISTS ${tables.map((r) => `\`${r.t}\``).join(', ')}`);
  await cnx.query('SET FOREIGN_KEY_CHECKS = 1');
}

let echec = 0;
for (const nom of ORDRE) {
  process.stdout.write(`  ${nom}.sql `.padEnd(22, '.'));
  try {
    await cnx.query(readFileSync(path.join(SQL, `${nom}.sql`), 'utf8'));
    console.log(' appliqué');
  } catch (e) {
    console.log(' ÉCHEC');
    console.error(`     ${e.message}`);
    echec++;
    break;
  }
}

await cnx.end();
console.log(echec ? '\n→ la migration échoue' : '\n→ tout passe');
process.exitCode = echec ? 1 : 0;
