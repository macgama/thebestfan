/**
 * Le passage au calendrier des PASS (scripts/calendrier-base.mjs) : la saison
 * lancée devient la saison 0, la BASE ; les brouillons HC, MT, GD, RV
 * deviennent les PASS 1 à 4 ; un PASS acheté pendant la BASE est le PASS 1.
 */
import { readFileSync } from 'node:fs';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';
import { planifier, appliquer, FIN_BASE } from './calendrier-base.mjs';
import { chargerSaisons, toutesLesSaisons, saisonEnCours } from '../src/server/fanzzy/saisons.js';
import { saisonsCouvertes, passDe } from '../src/shared/pass.js';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('DROP TABLE IF EXISTS saisons, admin_audit, contenus');
for (const f of ['admin.sql', 'saisons.sql', 'contenus.sql', 'quotidien.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
/* La production du 3 novembre 2026 : la saison 1 lancée le 26 octobre, les
   brouillons 2 à 5 posés par l'ancien calendrier. */
await raw.query(`UPDATE saisons SET nom = 'C''est parti pour TBFO !', fin_le = '2027-03-31' WHERE numero = 1`);
await raw.query(`INSERT INTO saisons (numero, nom, series, tenues, stuff, actions, stades, ouvre_le, fin_le) VALUES
  (2, 'Les héros du canapé', '[]', '[]', '[]', '[]', '[]', '2027-04-01', '2027-06-30'),
  (3, 'Les phénomènes météo', '["MT"]', '[]', '[]', '[]', '[]', '2027-07-01', '2027-09-30'),
  (4, 'Les galères de déplacement', '["GD"]', '[]', '[]', '[]', '[]', '2027-10-01', '2027-12-31'),
  (5, 'Les revenants', '["RV"]', '[]', '[]', '[]', '[]', '2028-01-01', '2028-03-31')`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 2, ...OPTIONS_BASE });
const q = async (sql, p) => (await pool.query(sql, p))[0];

let saisons = await q('SELECT id, numero, nom, series, lancee_a FROM saisons ORDER BY numero, id');
const plan = planifier(saisons);
check('le plan se fait', !plan.erreur || (console.log('       ', plan.erreur), false));
/* Comme en production : le brouillon HC n'a pas de série (création refusée sans carte). */
check('il reprend les quatre brouillons, sans en créer, HC retrouvé par son nom',
  plan.pass.every((p) => p.id) && plan.pass.find((p) => p.numero === 4).avant === 5);

await appliquer(q, plan, { tenuePass: true });
await chargerSaisons(pool);
const t = toutesLesSaisons();
const base = t.find((s) => s.numero === 0);
check('la saison lancée est la saison 0, jusqu’au 30 novembre', base?.lancee && base.fin === FIN_BASE
  && base.nom === 'C\'est parti pour TBFO !');
const p1 = t.find((s) => s.numero === 1);
check('le PASS 1 est les héros du canapé, du 1er décembre au 28 février', p1 && !p1.lancee
  && p1.series.join() === 'HC' && p1.ouvre === '2026-12-01' && p1.fin === '2027-02-28'
  && p1.stuff.every((id) => id.startsWith('hc-')) && p1.stuff.length > 0);
check('et garde Préhistorique pour ses membres', passDe(1).tenue === 'prehistorique');
check('PASS 2 à 4 : météo, déplacement, revenants', ['MT', 'GD', 'RV'].every((c, i) =>
  t.find((s) => s.numero === i + 2)?.series.join() === c));
check('aucun numéro en double', new Set(t.map((s) => s.numero)).size === t.length);
check('la saison en cours est la BASE', saisonEnCours()?.numero === 0);
check('un PASS acheté pendant la BASE est le PASS 1', saisonsCouvertes(saisonEnCours(), 30).join() === '1');

saisons = await q('SELECT id, numero, nom, series, lancee_a FROM saisons ORDER BY numero, id');
check('le script ne s’applique pas deux fois', Boolean(planifier(saisons).erreur));

/* Le PASS 1 nomme HC avant ses dessins : on peut encore le corriger dans
   l'admin, mais pas le lancer tant qu'aucune carte HC n'est publiée. */
{
  const { createAdmin } = await import('../src/server/admin/index.js');
  const { charger: chargerCatalogue } = await import('../src/server/fanzzy/catalogue.js');
  const raw2 = await mysql.createConnection({ uri: DB, multipleStatements: true });
  await raw2.query(`DROP TABLE IF EXISTS fanzzy, tenues`);
  for (const f of ['fanzzy.sql', 'tenues.sql']) {
    await raw2.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
  }
  await raw2.query(`UPDATE fanzzy SET publie = 0 WHERE set_id = 'HC'`).catch(() => {});
  await raw2.end();
  await chargerCatalogue(pool);
  const { chargerTenues } = await import('../src/server/fanzzy/tenues.js');
  await chargerTenues(pool);
  const adm = createAdmin({ pool, requireAuth: (_r, _s, n) => n() });
  let ok = true;
  try {
    await adm.modifierSaison('test', p1.id, { nom: 'Les héros du canapé', series: p1.series });
  } catch (e) { ok = false; console.log('       ', e.code, e.message, e.stack?.split('\n')[1]); }
  check('le PASS 1 se modifie avant les dessins de sa série', ok);
}

await pool.end();
if (failures) { console.error(`\n${failures} échec(s)`); process.exit(1); }
console.log('\ntout est vert');
