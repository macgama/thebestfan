/**
 * Le club principal qui se change une fois par saison, et la sélection
 * principale (choix de Gaël du 28 octobre 2026, `football/principal.js`).
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createOnboarding } from '../src/server/onboarding/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { cleDeSaison, principauxDe } from '../src/server/football/principal.js';
import { pleinClub } from '../src/shared/fanzzy/clubs.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, contenus, abonnements, saisons, reglages, admin_audit,
  achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
  'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql',
  'admin.sql', 'saisons.sql', 'contenus.sql', 'principal.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = 'cccccccc-0000-0000-0000-0000000000a1';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'p@ex.fr', 'Principal']);
await raw.query(`INSERT INTO teams (id,name,national) VALUES
  (40,'Liverpool',0),(42,'Arsenal',0),(50,'Manchester City',0),(10,'Angleterre',1),(15,'Suisse',1)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const q = async (sql, p = []) => (await pool.execute(sql, p))[0];
const requireAuth = (r, _s, n) => { r.user = { id: U }; n(); };
const { createDecks } = await import('../src/server/deck/index.js');
const decks = createDecks({ pool, requireAuth });
const O = createOnboarding({ pool, requireAuth, decks });
const app = express(); app.use(express.json()); app.use('/api/me', O.router);
const http = createServer(app); await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method ?? (o.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json' },
    body: o.body ? JSON.stringify(o.body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const cle = cleDeSaison();
const principal = async () => principauxDe(q, U);

console.log('\nLe premier choix est libre');
let r = await call('/api/me/welcome', { body: { teamId: 40 } });
check('le paquet de bienvenue pose le club principal', (await principal()).club === 40);
r = await call('/api/me/state');
check('sans compter de changement', r.json.principalChange?.club === false);

console.log('\nUn changement par saison');
await call('/api/me/slot', {}).catch(() => null);
await q(`UPDATE user_wallet SET follow_slots = 6 WHERE user_id = ?`, [U]);
for (const t of [42, 50, 10, 15]) await call('/api/me/follow', { body: { teamId: t } });
r = await call('/api/me/principal', { body: { teamId: 42 } });
check('un club suivi devient principal', r.status === 200 && (await principal()).club === 42
  && r.json.principalChange?.club === true);
check('un seul club principal', (await q(`SELECT COUNT(*) n FROM user_follows WHERE user_id = ? AND is_main = 1`, [U]))[0].n === 1);
r = await call('/api/me/principal', { body: { teamId: 50 } });
check('le second changement de la saison est refusé', r.status === 400
  && r.json.error === 'onboarding.error.principal_saison' && (await principal()).club === 42);
r = await call('/api/me/follow', { body: { teamId: 50, main: true } });
check('suivre « en principal » ne contourne pas la règle', (await principal()).club === 42);
await call('/api/me/follow/42', { method: 'DELETE' });
r = await call('/api/me/principal', { body: { teamId: 50 } });
check('retirer son principal ne rend pas le changement', r.status === 400 && (await principal()).club === null);
await q(`UPDATE user_wallet SET principal_saison = 'S0' WHERE user_id = ?`, [U]);
r = await call('/api/me/principal', { body: { teamId: 50 } });
check('à la saison suivante, on change de nouveau', r.status === 200 && (await principal()).club === 50);
r = await call('/api/me/principal', { body: { teamId: 99 } });
check('un club qu’on ne suit pas ne devient pas principal', r.json.error === 'onboarding.error.principal_non_suivi');
check('la saison retenue est celle d’aujourd’hui', (await q(`SELECT principal_saison s FROM user_wallet WHERE user_id = ?`, [U]))[0].s === cle);

console.log('\nLa sélection principale, à côté du club');
r = await call('/api/me/principal', { body: { teamId: 10 } });
let p = await principal();
check('une sélection devient la sélection principale, le club reste', r.status === 200
  && p.selection === 10 && p.club === 50);
r = await call('/api/me/principal', { body: { teamId: 15 } });
check('une fois par saison aussi', r.json.error === 'onboarding.error.principal_saison'
  && (await principal()).selection === 10);
r = await call('/api/me/state');
check('le profil lit la sélection et ce qui a changé',
  r.json.follows.some((f) => f.team_id === 10 && f.is_main_nation === 1 && f.national === 1)
  && r.json.principalChange.selection === true);
check('le PLEIN CLUB vaut pour le club et pour la sélection',
  pleinClub({ fanzzyId: 'AN14', stuff: ['an-guitare'], teamId: 40, principal: [40, 10] }) === 1
  && pleinClub({ fanzzyId: 'AN14', stuff: ['an-guitare'], teamId: 40, principal: [10] }) === 0);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
