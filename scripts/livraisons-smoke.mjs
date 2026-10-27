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

check('sans livraison, le numéro de base : 0.0200', numeroPour(0) === '0.0200');
check('une livraison de plus, un cran de plus', numeroPour(1) === '0.0201' && numeroPour(57) === '0.0257');
check('les quatre décimales tiennent au-delà de cent', numeroPour(812) === '0.1012');
check('un compte absurde ne fait pas un numéro absurde', numeroPour(-3) === '0.0200' && numeroPour('x') === '0.0200');
poserLivraisons(4);
check('le numéro posé est celui qu’on lit', numero() === '0.0204');
check('l’étiquette du menu le reprend', etiquette() === 'version bêta — 0.0204');
check('et la réponse de /api/version aussi',
  versionPublique().numero === '0.0204' && versionPublique().etiquette === etiquette());

/* -------------------------------------------------------- le compte en base */

const mysql = await import('mysql2/promise');
const DB = baseDeTest();
const raw = await mysql.createConnection({ uri: DB });
const sql = readFileSync(new URL('../sql/admin.sql', import.meta.url), 'utf8');
const creer = /CREATE TABLE IF NOT EXISTS reglages[\s\S]*?;/.exec(sql)[0];
await raw.query('DROP TABLE IF EXISTS reglages');
await raw.query(creer);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });

check('la toute première mise en ligne compte déjà : 1', await compterLivraison(pool, 'aaa') === 1);
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
