/**
 * Test de l'inventaire des compétitions (`src/server/football/inventaire.js`).
 *
 * Ce que le serveur fait seul une fois par jour, et que `coverage.mjs` faisait
 * à la main : la saison nouvelle d'une compétition arrive en base, avec ses
 * dates, sans que les choix de l'administration (interrupteur, palier) soient
 * défaits.
 */
import { readFileSync } from 'node:fs';
import { inventorier, palier } from '../src/server/football/inventaire.js';
import { createPoller } from '../src/server/football/poller.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS souvenir_leagues`);
/* La table seule, telle que les fichiers du déploiement la posent : la
   création de `souvenirs.sql`, puis les colonnes de `teletext.sql`. Le reste de
   ces fichiers touche aux comptes, dont cette suite n'a pas besoin. */
const sql = (f) => readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8');
await raw.query(sql('souvenirs.sql').match(/CREATE TABLE IF NOT EXISTS souvenir_leagues[\s\S]*?;/)[0]);
for (const l of sql('teletext.sql').match(/^ALTER TABLE souvenir_leagues .*;$/gm)) await raw.query(l);
const pool = mysql.createPool({ uri: DB, connectionLimit: 2 });

/* Une compétition de `/leagues`, au format de l'API. */
const ligue = (id, name, country, year, { start, end, events = true, type = 'League' } = {}) => ({
  league: { id, name, type },
  country: { name: country, code: country === 'World' ? null : 'CH' },
  seasons: [{ year, current: true, start, end,
    coverage: { fixtures: { events }, standings: true, top_scorers: true } }],
});

// La saison 2025 en base, telle que le script l'a laissée — puis réglée à la
// main : la Super League éteinte et passée en palier 1 dans /admin.
await raw.query(`INSERT INTO souvenir_leagues
  (league_id, season, name, country, family, has_events, tier, starts_on, ends_on, enabled)
  VALUES (207, 2025, 'Super League', 'Switzerland', 'championnat', 1, 1, '2025-07-19', '2026-05-23', 0),
         (61,  2026, 'Ligue 1', 'France', 'championnat', 1, 3, '2026-08-15', '2027-05-20', 0)`);

const reponse = [
  ligue(207, 'Super League', 'Switzerland', 2026, { start: '2026-07-25', end: '2027-05-22' }),
  ligue(61, 'Ligue 1', 'France', 2026, { start: '2026-08-14', end: '2027-05-23' }),
  ligue(208, 'Challenge League', 'Switzerland', 2026, { start: '2026-07-24', end: '2027-05-21' }),
  ligue(667, 'Friendlies Clubs', 'World', 2026, { start: '2026-01-01', end: '2026-12-31' }),
  ligue(999, 'Sans événements', 'Switzerland', 2026, { events: false }),
];
let appels = 0;
const api = async (p) => { appels++; check('un seul appel, à /leagues', p === '/leagues'); return reponse; };

const r = await inventorier({ api, pool });
check('un appel en tout', appels === 1);
check('quatre compétitions écrites, celle sans événements écartée', r.ecrites === 4);
check('trois saisons nouvelles (207/2026, 208, 667)', r.nouvelles === 3);

const ligne = async (id, s) => (await pool.query(
  `SELECT enabled, tier, DATE_FORMAT(starts_on,'%Y-%m-%d') AS d, DATE_FORMAT(ends_on,'%Y-%m-%d') AS f
     FROM souvenir_leagues WHERE league_id = ? AND season = ?`, [id, s]))[0][0];

const sl26 = await ligne(207, 2026);
check('la saison 2026 de la Super League existe', Boolean(sl26));
check('avec ses dates', sl26?.d === '2026-07-25' && sl26?.f === '2027-05-22');
check('elle reprend l’interrupteur de 2025 (éteinte)', Number(sl26?.enabled) === 0);
check('et son palier (1, pas le 2 de la règle)', Number(sl26?.tier) === 1 && palier({ nom: 'Super League', pays: 'Switzerland' }) === 2);
const sl25 = await ligne(207, 2025);
check('la saison 2025 reste en base, intacte', sl25?.f === '2026-05-23' && Number(sl25?.enabled) === 0);

const l1 = await ligne(61, 2026);
check('une ligne connue garde son interrupteur', Number(l1?.enabled) === 0);
check('et son palier', Number(l1?.tier) === 3);
check('mais ses dates suivent l’API', l1?.d === '2026-08-14' && l1?.f === '2027-05-23');

const cl = await ligne(208, 2026);
check('une compétition jamais vue : palier de la règle, allumée', Number(cl?.tier) === 3 && Number(cl?.enabled) === 1);
check('un amical jamais vu : éteint', Number((await ligne(667, 2026))?.enabled) === 0);

// Deuxième passage : rien de nouveau, rien de défait.
await pool.query(`UPDATE souvenir_leagues SET enabled = 1, tier = 2 WHERE league_id = 208`);
const r2 = await inventorier({ api: async () => reponse, pool });
check('deuxième passage : aucune saison nouvelle', r2.nouvelles === 0);
const cl2 = await ligne(208, 2026);
check('le réglage fait entre-temps tient', Number(cl2?.tier) === 2 && Number(cl2?.enabled) === 1);

/* Le relevé : l'inventaire passe par lui, et une panne ne le fait pas lever. */
const journal = [];
const log = { log: (m) => journal.push(m), warn: (m) => journal.push(m), error: (m) => journal.push(m) };
const poller = createPoller({ client: {}, store: {}, broadcast: () => {}, log,
  inventaire: () => inventorier({ api: async () => [
    ...reponse, ligue(209, 'Promotion League', 'Switzerland', 2026, {})], pool }) });
check('le relevé passe l’inventaire', (await poller.passerInventaire()) === 5);
check('et le dit au journal', journal.some((m) => /1 saison\(s\) nouvelle/.test(m)));

await pool.end();
await raw.end();
console.log(failures ? `\n${failures} échec(s)` : '\ninventaire : tout est vert');
process.exit(failures ? 1 : 0);
