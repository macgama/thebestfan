/**
 * Le numéro du menu qui monte à chaque mise en ligne (demande de Gaël,
 * 27 octobre 2026).
 *
 * Le format d'abord, puis le compte en base : un nouveau commit fait monter le
 * numéro d'un cran, un redémarrage sur le même commit ne le touche pas, et deux
 * démarrages simultanés ne comptent qu'une livraison.
 */
import { readFileSync } from 'node:fs';
import {
  numeroPour, poserLivraisons, numero, etiquette, versionPublique,
} from '../src/shared/version.js';
import { compterLivraison, CLE } from '../src/server/livraisons.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ------------------------------------------------------------ le format */

check('sans livraison, la 1.0.0', numeroPour(0) === '1.0.0');
check('la première mise en ligne de la 1.0 est la 1.0.0', numeroPour(1) === '1.0.0');
check('puis 1.0.01, 1.0.02…', numeroPour(2) === '1.0.01' && numeroPour(3) === '1.0.02' && numeroPour(11) === '1.0.10');
check('au-delà de cent, le numéro grandit sans casser', numeroPour(101) === '1.0.100');
check('un compte absurde ne fait pas un numéro absurde', numeroPour(-3) === '1.0.0' && numeroPour('x') === '1.0.0');
poserLivraisons(5);
check('le numéro posé est celui qu’on lit', numero() === '1.0.04');
check('l’étiquette du menu le reprend', etiquette() === 'version bêta — 1.0.04');
check('et la réponse de /api/version aussi',
  versionPublique().numero === '1.0.04' && versionPublique().etiquette === etiquette());
check('la 1.0 a sa propre clé : l’ancien compte 0.02xx n’est pas repris', CLE === 'version.livraisons.1.0');

/* -------------------------------------------------------- le compte en base */

const mysql = await import('mysql2/promise');
const DB = baseDeTest();
const raw = await mysql.createConnection({ uri: DB });
const sql = readFileSync(new URL('../sql/admin.sql', import.meta.url), 'utf8');
const creer = /CREATE TABLE IF NOT EXISTS reglages[\s\S]*?;/.exec(sql)[0];
await raw.query('DROP TABLE IF EXISTS reglages');
await raw.query(creer);
await raw.query('INSERT INTO reglages (cle, valeur) VALUES (?, ?)',
  ['version.livraisons', JSON.stringify({ n: 54, repere: 'zzz' })]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });

check('la toute première mise en ligne de la 1.0 compte 1, malgré les 54 de la bêta', await compterLivraison(pool, 'aaa') === 1);
check('un redémarrage sur le même commit ne bouge rien', await compterLivraison(pool, 'aaa') === 1);
check('un nouveau commit, un cran de plus', await compterLivraison(pool, 'bbb') === 2);
check('sans repère, on lit sans compter', await compterLivraison(pool, null) === 2);
const ensemble = await Promise.all([compterLivraison(pool, 'ccc'), compterLivraison(pool, 'ccc')]);
check('deux démarrages ensemble ne comptent qu’une livraison',
  ensemble.every((n) => n === 3) || (console.log('        vu :', ensemble), false));
const [[ligne]] = await pool.query('SELECT valeur FROM reglages WHERE cle = ?', [CLE]);
const v = typeof ligne.valeur === 'string' ? JSON.parse(ligne.valeur) : ligne.valeur;
check('la base garde le compte et le dernier commit', v.n === 3 && v.repere === 'ccc');

await pool.query('DROP TABLE IF EXISTS reglages');
await pool.end();

console.log(failures ? `\n${failures} échec(s)` : '\ntout est bon');
process.exit(failures ? 1 : 0);
