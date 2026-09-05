/**
 * Test des cartes-souvenirs.
 *
 * Trois joueurs, un match, trois buts. L'un pousse tout le match, l'autre
 * s'arrête à la mi-temps, le troisième n'est jamais venu. On vérifie qui
 * reçoit quoi, ce qui s'achète, et pendant combien de temps.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createSouvenirs, PRESENCE_WINDOW_MS } from '../src/server/souvenirs/index.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence, souvenirs,
                 user_wallet, api_cache, souvenir_leagues, duel_results, duel_events, duels,
                 user_follows, fixture_events, standings, fixtures, team_leagues, teams, leagues,
                 api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = ['aaaaaaaa-0000-0000-0000-000000000001',
           'aaaaaaaa-0000-0000-0000-000000000002',
           'aaaaaaaa-0000-0000-0000-000000000003'];
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?,?,?,'x')`,
    [id, `j${i}@ex.fr`, `Joueur${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id, scarves) VALUES (?, 200)`, [id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'FC Sion'),(91,'FC Bâle')`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
await raw.query(`INSERT INTO souvenir_leagues (league_id,season,name,family,has_events,enabled)
                 VALUES (207,2026,'Super League','championnat',1,1),
                        (999,2026,'Coupe Fantôme','coupe',1,0)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
let who = U[0];
const S = createSouvenirs({ pool, requireAuth: (req, _r, next) => { req.user = { id: who }; next(); } });

const app = express();
app.use('/api/souvenirs', S.router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const goal = (seq, minute, team, sh, sa, player) => ({
  fixtureId: 5001, seq, leagueId: 207, teamId: team, homeId: 85, awayId: 91,
  minute, player, scoreHome: sh, scoreAway: sa, kickoffAt: '2026-09-13 16:00:00',
});

/* --------------------------------------------------- les deux premiers buts */

await S.recordPush({ userId: U[0], fixtureId: 5001, side: 0, fanzzyId: 'V3', amount: 40 });
await S.recordPush({ userId: U[1], fixtureId: 5001, side: 0, fanzzyId: 'P2', amount: 25 });

let r = await S.mintGoal(goal(1, 23, 85, 1, 0, 'Diallo'));
check('but frappé', r.minted === true);
check('les deux présents reçoivent la carte', r.presents === 2);
check('prix de championnat', r.price === 60);

r = await S.mintGoal(goal(1, 23, 85, 1, 0, 'Diallo'));
check('rejouer le même but ne refrappe rien', r.minted === false && r.reason === 'already_minted');

r = await S.mintGoal({ ...goal(2, 30, 85, 2, 0, 'Morel'), leagueId: 999 });
check('compétition désactivée : aucune carte', r.reason === 'league_not_eligible');

/* --------------------------------- le deuxième joueur décroche à la mi-temps */

await pool.query(
  `UPDATE virage_presence SET last_push_at = NOW(3) - INTERVAL 10 MINUTE WHERE user_id = ?`, [U[1]]);
await S.recordPush({ userId: U[0], fixtureId: 5001, side: 0, fanzzyId: 'V3', amount: 30 });

r = await S.mintGoal(goal(2, 67, 91, 1, 1, 'Keller'));
check('seul celui qui poussait encore reçoit la deuxième', r.presents === 1);

r = await S.mintGoal(goal(3, 87, 85, 2, 1, 'Diallo'));
check('troisième but frappé', r.minted === true && r.presents === 1);

/* ---------------------------------------------------------------- collections */

who = U[0];
r = await call('/api/souvenirs/mine');
check('le fidèle a les trois souvenirs', r.json.souvenirs.length === 3);
check('tous en présence', r.json.souvenirs.every((s) => s.kind === 'presence'));
check('le Fanzzy porté est conservé', r.json.souvenirs[0].fanzzy_id === 'V3');
check('le buteur et la minute sont sur la carte',
  r.json.souvenirs.some((s) => s.player === 'Diallo' && s.minute === 87));
check('le score final figure',
  r.json.souvenirs.some((s) => s.score_home === 2 && s.score_away === 1));

who = U[1];
r = await call('/api/souvenirs/mine');
check('celui qui a décroché n\u2019a que la première', r.json.souvenirs.length === 1);

who = U[2];
r = await call('/api/souvenirs/mine');
check('l\u2019absent n\u2019a rien', r.json.souvenirs.length === 0);

/* ------------------------------------------------------------------ marché */

r = await call('/api/souvenirs/market');
check('l\u2019absent voit les trois vignettes en vente', r.json.souvenirs.length === 3);
check('fenêtre de quinze jours annoncée', r.json.windowDays === 15);

const cible = r.json.souvenirs[0].id;
r = await call('/api/souvenirs/buy', { method: 'POST', body: { souvenirId: cible } });
check('achat accepté', r.json.ok === true && r.json.spent === 60);

const [[w]] = await pool.query('SELECT scarves FROM user_wallet WHERE user_id = ?', [U[2]]);
check('écharpes débitées', w.scarves === 140);

r = await call('/api/souvenirs/buy', { method: 'POST', body: { souvenirId: cible } });
check('deuxième achat refusé', r.json.error === 'souvenir.error.already_owned');

r = await call('/api/souvenirs/mine');
check('la vignette apparaît, marquée comme telle',
  r.json.souvenirs.length === 1 && r.json.souvenirs[0].kind === 'vignette');
check('aucune présence usurpée', r.json.souvenirs[0].fanzzy_id === null);

r = await call('/api/souvenirs/market');
check('ce qu\u2019on possède sort du marché', r.json.souvenirs.length === 2);

who = U[0];
r = await call('/api/souvenirs/market');
check('le présent n\u2019a rien à acheter', r.json.souvenirs.length === 0);

/* ------------------------------------------------------- fonds et péremption */

who = U[2];
await pool.query('UPDATE user_wallet SET scarves = 10 WHERE user_id = ?', [U[2]]);
const reste = (await call('/api/souvenirs/market')).json.souvenirs[0].id;
r = await call('/api/souvenirs/buy', { method: 'POST', body: { souvenirId: reste } });
check('achat refusé sans écharpes', r.json.error === 'souvenir.error.not_enough_scarves');

await pool.query('UPDATE user_wallet SET scarves = 500 WHERE user_id = ?', [U[2]]);
await pool.query('UPDATE souvenirs SET expires_at = NOW(3) - INTERVAL 1 DAY WHERE id = ?', [reste]);
r = await call('/api/souvenirs/buy', { method: 'POST', body: { souvenirId: reste } });
check('vignette périmée : achat refusé', r.json.error === 'souvenir.error.expired');

r = await call('/api/souvenirs/market');
check('une vignette périmée disparaît du marché',
  !r.json.souvenirs.some((s) => s.id === reste));

/* ---------------------------------------------------- présence trop ancienne */

await pool.query('DELETE FROM virage_presence');
await S.recordPush({ userId: U[2], fixtureId: 5002, side: 0, fanzzyId: 'Y1', amount: 10 });
await pool.query(
  `UPDATE virage_presence SET last_push_at = NOW(3) - INTERVAL ? SECOND WHERE user_id = ?`,
  [Math.floor(PRESENCE_WINDOW_MS / 1000) + 30, U[2]]);
r = await S.mintGoal({ ...goal(1, 12, 85, 1, 0, 'Bento'), fixtureId: 5002 });
check('avoir laissé l\u2019app ouverte ne suffit pas', r.presents === 0);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
