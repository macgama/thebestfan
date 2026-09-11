/**
 * Remplit d'un coup les couleurs de tous les clubs connus.
 *
 * Le jeu les remplit déjà tout seul, au fil des matchs affichés : ce script ne
 * sert qu'à ne pas attendre. Après la mise en ligne de `sql/couleurs.sql`, un
 * passage ici donne leurs couleurs à toute la base en quelques minutes, au
 * lieu de les voir arriver match après match.
 *
 * **Il ne détruit rien.** Contrairement aux suites de test, il n'efface aucune
 * table : il lit `teams` et écrit trois colonnes. Il n'emploie donc pas la
 * garde de `base-de-test.mjs`, et il peut viser la base de production — c'est
 * même son seul emploi utile.
 *
 * Il ne coûte pas un appel d'API : un blason se télécharge sur le CDN, qui est
 * gratuit et hors quota.
 *
 * Usage :
 *   DATABASE_URL=mysql://… node scripts/couleurs-equipes.mjs
 *   DATABASE_URL=mysql://… node scripts/couleurs-equipes.mjs --rejouer
 *
 * `--rejouer` reprend aussi les clubs dont la lecture avait échoué : un blason
 * peut avoir été remplacé depuis, ou n'avoir pas répondu ce jour-là.
 */
import { createCouleurs } from '../src/server/football/couleurs.js';

const URL_BASE = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
const rejouer = process.argv.includes('--rejouer');

const mysql = await import('mysql2/promise');
const pool = mysql.createPool({ uri: URL_BASE, connectionLimit: 4, charset: 'utf8mb4' });

const [[{ total }]] = await pool.query(
  `SELECT COUNT(*) total FROM teams WHERE logo IS NOT NULL`);
const [[{ reste }]] = await pool.query(
  `SELECT COUNT(*) reste FROM teams
    WHERE logo IS NOT NULL AND ${rejouer ? 'color1 IS NULL' : 'colors_at IS NULL'}`);

console.log(`${total} club(s) avec un blason, ${reste} à lire.`);

const couleurs = createCouleurs({ pool });
const [clubs] = await pool.query(
  `SELECT id FROM teams
    WHERE logo IS NOT NULL AND ${rejouer ? 'color1 IS NULL' : 'colors_at IS NULL'}`);

/* Par vagues, et non tout d'un coup : quelques centaines de téléchargements
   simultanés se font fermer la porte par n'importe quel CDN, et on repartirait
   avec des couleurs manquantes marquées comme « déjà tentées ». */
let faits = 0;
for (let i = 0; i < clubs.length; i += 8) {
  const lot = clubs.slice(i, i + 8).map((c) => c.id);
  faits += await couleurs.assurer(lot, { rejouer, parVague: lot.length });
  process.stdout.write(`\r  ${Math.min(i + 8, clubs.length)} / ${clubs.length}`);
}

const [[{ lus }]] = await pool.query(
  `SELECT COUNT(*) lus FROM teams WHERE color1 IS NOT NULL`);
console.log(`\n${faits} club(s) lus dans cette passe · ${lus} clubs ont désormais leurs couleurs.`);
await pool.end();
