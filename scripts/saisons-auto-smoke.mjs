/**
 * Les saisons qui se lancent seules (choix de Gaël, 18 octobre 2026).
 *
 * Trois choses : les saisons prévues de `shared/saisons-prevues.js` se posent
 * en brouillon une fois chacune ; un brouillon dont le jour d'ouverture est
 * arrivé se lance seul, et pas avant ; et le premier lancement d'une saison
 * qui nomme une série ne referme pas les autres quand tout était ouvert.
 */
import { readFileSync } from 'node:fs';
import { createAdmin, ACTEUR_AUTO } from '../src/server/admin/index.js';
import { SETS } from '../src/shared/fanzzy/dex.js';
import { charger as chargerCatalogue, seriesOuvertes }
  from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { toutesLesSaisons } from '../src/server/fanzzy/saisons.js';
import { SAISONS_PREVUES, CARNET_TRIMESTRE } from '../src/shared/saisons-prevues.js';
import { validerCarnet } from '../src/shared/saison.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, contenus, abonnements, achats, kop_invites, amities, saisons,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, reglages, admin_audit, user_decks, user_stuff, user_etats, user_skins,
  user_fanzzy, user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache,
  souvenir_leagues, duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings,
  fixtures, team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users,
  recompenses, missions_jour, compteurs_jour, user_nouveautes`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
  'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'teletext.sql', 'admin.sql',
  'saisons.sql', 'contenus.sql', 'abonnement.sql', 'quotidien.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const { createContenus } = await import('../src/server/contenus/index.js');
const contenus = createContenus({ pool });
await contenus.semer();
await contenus.charger();
const adm = createAdmin({ pool, requireAuth: (_r, _s, n) => n(), deps: { contenus } });

/* ------------------------------------------------------ le calendrier */

check('le carnet d’un trimestre est un carnet valide', validerCarnet(CARNET_TRIMESTRE).length === 5);
check('quatre saisons prévues, de trois mois, qui se suivent sans trou',
  SAISONS_PREVUES.length === 4 && SAISONS_PREVUES.every((s, i, t) => {
    const fin = new Date(`${s.fin}T12:00:00Z`);
    const ouvre = new Date(`${s.ouvre}T12:00:00Z`);
    const mois = (fin.getUTCMonth() - ouvre.getUTCMonth() + 12) % 12;
    const suivante = t[i + 1];
    const lendemain = new Date(fin.getTime() + 86_400_000).toISOString().slice(0, 10);
    return mois === 2 && ouvre.getUTCDate() === 1 && (!suivante || suivante.ouvre === lendemain);
  }));
check('la première ouvre au lendemain de la saison 1', SAISONS_PREVUES[0].ouvre === '2027-01-01');
check('chaque série prévue existe', SAISONS_PREVUES.every((s) => s.series.every((id) =>
  SETS.some((x) => x.id === id))));

/* ------------------------------------------------- posées une seule fois */

let posees = await adm.amorcerSaisonsPrevues();
check('les quatre saisons prévues sont posées', posees.join() === '2,3,4,5');
const s2 = toutesLesSaisons().find((s) => s.numero === 2);
check('en brouillon, avec leurs dates et leur carnet', s2 && !s2.lancee
  && s2.fin === '2027-03-31' && s2.ouvre === '2027-01-01'
  && s2.series.join() === 'HC' && s2.stuff.length === 10 && s2.stuff.every((id) => id.startsWith('hc-'))
  && JSON.stringify(s2.carnet ?? null) === JSON.stringify(CARNET_TRIMESTRE));
check('les revenants n’ouvrent aucune pièce',
  toutesLesSaisons().find((s) => s.numero === 5)?.stuff.length === 0);

posees = await adm.amorcerSaisonsPrevues();
check('un second démarrage ne pose rien', posees.length === 0
  && toutesLesSaisons().filter((s) => s.numero === 3).length === 1);

await adm.supprimerSaison('test', toutesLesSaisons().find((s) => s.numero === 5).id, null);
posees = await adm.amorcerSaisonsPrevues();
check('une saison prévue supprimée n’est pas recréée', posees.length === 0
  && !toutesLesSaisons().some((s) => s.numero === 5));

/* Vrai jusqu'au 31 décembre 2026 ; ensuite la saison 2 serait due, à juste titre. */
if (new Date() < new Date('2026-12-31T00:00:00Z')) {
  check('rien de 2027 ne se lance avant son jour', (await adm.lancerAuto()).length === 0);
}

/* ------------------------------------------------ le lancement à sa date */

const toutesAvant = seriesOuvertes();
const [ins] = await pool.query(
  `INSERT INTO saisons (numero, nom, series, tenues, stuff, actions, stades, ouvre_le, fin_le)
   VALUES (9, 'Essai du jour', '["HC"]', '[]', '[]', '[]', '[]', CURDATE(), CURDATE() + INTERVAL 30 DAY),
          (10, 'Essai de demain', '[]', '[]', '[]', '[]', '[]', CURDATE() + INTERVAL 1 DAY, NULL),
          (11, 'Essai fini', '[]', '[]', '[]', '[]', '[]', CURDATE() - INTERVAL 9 DAY, CURDATE() - INTERVAL 1 DAY)`);
const { chargerSaisons } = await import('../src/server/fanzzy/saisons.js');
await chargerSaisons(pool);

const lancees = await adm.lancerAuto();
check('la saison du jour se lance seule', lancees.join() === String(ins.insertId)
  && toutesLesSaisons().find((s) => s.numero === 9)?.lancee === true);
check('celle de demain attend son jour', toutesLesSaisons().find((s) => s.numero === 10)?.lancee === false);
check('une saison déjà finie ne se lance pas', toutesLesSaisons().find((s) => s.numero === 11)?.lancee === false);
check('la saison du jour n’a pas refermé les autres séries',
  toutesAvant === null && (seriesOuvertes() ?? []).length === SETS.length);
check('la saison 1 nomme désormais ce qu’elle ouvrait',
  toutesLesSaisons().find((s) => s.numero === 1)?.series.length === SETS.length);

const [[j]] = await pool.query(
  `SELECT COUNT(*) AS n FROM admin_audit WHERE acteur = ? AND action = 'saison.lancee'`, [ACTEUR_AUTO]);
check('le lancement est au journal, au nom du serveur', Number(j.n) === 1);
check('un second passage ne relance rien', (await adm.lancerAuto()).length === 0);

await pool.end();
if (failures) { console.error(`\n${failures} échec(s)`); process.exit(1); }
console.log('\nles saisons se lancent seules.');
