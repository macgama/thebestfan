/**
 * Test du Grand Virage.
 *
 * Trois supporters, un vrai match. Deux chantent pour le club à domicile, un
 * pour l'adversaire. Un but réel tombe. On vérifie la corde, l'agrégation, le
 * classement, la minute double, et surtout qui reçoit une carte-souvenir.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { createSouvenirs } from '../src/server/souvenirs/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { createVirage } from '../src/server/ferveur/index.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(20); }
  return false;
}
const jitter = (t, a = 22) => Math.max(0, t + (Math.random() * a * 2 - a));
const tempoParfait = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560, 40));
const martelage = () => Array.from({ length: 21 }, (_, i) => jitter(i * 140));

/* ---------------------------------------------------------------- base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_fanzzy, user_souvenirs, virage_presence, souvenirs,
  user_wallet, souvenir_leagues, duel_results, duel_events, duels, user_follows,
  fixture_events, standings, fixtures, team_leagues, teams, leagues, api_quota,
  login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = ['bbbbbbbb-0000-0000-0000-00000000000' + 1,
           'bbbbbbbb-0000-0000-0000-00000000000' + 2,
           'bbbbbbbb-0000-0000-0000-00000000000' + 3];
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `v${i}@ex.fr`, `Virage${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id, scarves, active_fanzzy) VALUES (?, 100, 'V1')`, [id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'FC Sion'),(91,'FC Bâle')`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
await raw.query(`INSERT INTO souvenir_leagues (league_id,season,name,family,has_events,enabled)
                 VALUES (207,2026,'Super League','championnat',1,1)`);
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
                 VALUES (7001,207,2026,85,91,'1H',UTC_TIMESTAMP())`);
// Deux supporters de Sion, un de Bâle.
await raw.query(`INSERT INTO user_follows (user_id,team_id) VALUES (?,85),(?,85),(?,91)`,
  [U[0], U[1], U[2]]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, charset: 'utf8mb4' });

/* -------------------------------------------------------------- serveur */

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });
let identite = null;
io.use((socket, next) => {
  socket.data.user = { userId: socket.handshake.auth.token, name: 'Fan' };
  next();
});
const souvenirs = createSouvenirs({ pool, requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); } });
const fanzzy = createFanzzy({ pool, requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); } });
const virage = createVirage({ pool, io, souvenirs, fanzzy,
  requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); } });
app.use('/api/virage', virage.router);
await new Promise((r) => http.listen(0, r));
const url = `http://localhost:${http.address().port}`;

function connect(userId) {
  const socket = client(url, { transports: ['websocket'], auth: { token: userId } });
  const p = { socket, state: null, ticks: [], results: [], errors: [], realGoals: [], goals: [] };
  socket.on('virage:state', (s) => { p.state = s; });
  socket.on('virage:tick', (t) => p.ticks.push(t));
  socket.on('virage:result', (r) => p.results.push(r));
  socket.on('virage:error', (e) => p.errors.push(e.code));
  socket.on('virage:real_goal', (g) => p.realGoals.push(g));
  socket.on('virage:goal', (g) => p.goals.push(g));
  return p;
}

const A = connect(U[0]), B = connect(U[1]), C = connect(U[2]);
check('trois supporters connectés', await until(() => A.socket.connected && B.socket.connected && C.socket.connected));

for (const p of [A, B, C]) p.socket.emit('virage:join', { fixtureId: 7001 });
check('tous entrent dans le virage', await until(() => A.state && B.state && C.state));
check('camps déduits des clubs suivis',
  A.state.you.side === 0 && B.state.you.side === 0 && C.state.you.side === 1);
check('le match est identifié', A.state.fixture.homeName === 'FC Sion');
check('les cartes sont annoncées par le serveur', A.state.cards.length >= 4);

/* ------------------------------------------------------------- un match sans club suivi */

const D = connect('bbbbbbbb-0000-0000-0000-000000000009');
await until(() => D.socket.connected);
D.socket.emit('virage:join', { fixtureId: 7001 });
check('un match qui ne concerne pas ses clubs est refusé',
  await until(() => D.errors.includes('ferveur.error.not_your_match')));
D.socket.disconnect();

/* ----------------------------------------------------------------- chants */

A.socket.emit('virage:chant', { cardId: 'reprise', taps: tempoParfait() });
const ok1 = await until(() => A.results.length === 1);
if (!ok1) console.log('  DEBUG erreurs A :', JSON.stringify(A.errors));
check('chant accepté', ok1);
if (!ok1) { console.log('arrêt'); process.exit(1); }
check('la qualité est calculée par le serveur', A.results[0].quality > 0.6);
check('le souffle est débité', A.results[0].breath < 100);
check('la ferveur personnelle monte', A.results[0].ferveur > 0);

const ropeApres = await until(() => A.ticks.some((t) => t.rope < 0));
check('la corde penche du côté de Sion', ropeApres);

C.socket.emit('virage:chant', { cardId: 'roulement', taps: martelage() });
await until(() => C.results.length === 1);
check('le camp adverse pousse dans l\u2019autre sens', C.results[0].push > 0);

/* ------------------------------------------------------------ triche */

A.socket.emit('virage:chant', { cardId: 'reprise', taps: Array.from({ length: 30 }, (_, i) => i * 20) });
check('frappes inhumaines rejetées',
  await until(() => A.errors.some((e) => e.startsWith('ferveur.error.'))));

A.socket.emit('virage:chant', { cardId: 'inexistante', taps: tempoParfait() });
check('carte inconnue rejetée', await until(() => A.errors.includes('ferveur.error.unknown_card')));

for (let i = 0; i < 15; i++) {
  B.socket.emit('virage:chant', { cardId: 'reprise', taps: tempoParfait() });
}
check('cadence de chants plafonnée',
  await until(() => B.errors.includes('ferveur.error.rate_limited')));

/* -------------------------------------------------------------- but réel */

// B a chanté à l'instant, C il y a peu, A aussi : tous présents.
// On éloigne C pour vérifier qu'un inactif ne reçoit rien.
await pool.query(
  `UPDATE virage_presence SET last_push_at = NOW(3) - INTERVAL 10 MINUTE WHERE user_id = ?`, [U[2]]);

const avant = A.state.rope;
virage.realGoal({ fixtureId: 7001, teamId: 85, minute: 23, player: 'Diallo' });
check('but réel diffusé à toute la salle',
  await until(() => A.realGoals.length === 1 && C.realGoals.length === 1));
check('le but secoue la corde du bon côté', A.realGoals[0].side === 0);
check('la minute double s\u2019ouvre', A.realGoals[0].surgeUntil > Date.now());

const r = await souvenirs.mintGoal({
  fixtureId: 7001, seq: 1, leagueId: 207, teamId: 85, homeId: 85, awayId: 91,
  minute: 23, player: 'Diallo', scoreHome: 1, scoreAway: 0, kickoffAt: '2026-09-13 16:00:00',
});
check('carte-souvenir frappée', r.minted === true);
check('seuls les chanteurs récents la reçoivent', r.presents === 2);

identite = U[0];
const mesA = await souvenirs.collection(U[0]);
check('le supporter actif a sa carte', mesA.length === 1 && mesA[0].player === 'Diallo');
check('le Fanzzy équipé est gravé dessus', mesA[0].fanzzy_id === 'V1');
const mesC = await souvenirs.collection(U[2]);
check('l\u2019inactif ne l\u2019a pas', mesC.length === 0);

/* ------------------------------------------------------------ classement */

const room = virage.rooms.get(7001);
const rangA = room.rankOf(U[0]);
check('classement dans sa propre tribune', rangA.of === 2 && rangA.rank >= 1);
check('la ferveur cumulée est retenue', rangA.ferveur > 0);
// La foule (mémoire, 90 s) et la présence pour les souvenirs (base, 2 min)
// sont deux fenêtres distinctes : C reste dans la foule alors qu'il n'a plus
// droit aux cartes. C'est voulu — on ne le sort pas du virage parce qu'il a
// manqué un but.
const crowd = room.crowd();
check('la foule compte les deux tribunes', crowd[0] === 2 && crowd[1] === 1);

for (const m of room.members.values()) m.lastPush = Date.now() - 120_000;
check('après 90 s sans chanter, on ne compte plus dans la foule',
  room.crowd()[0] === 0 && room.crowd()[1] === 0);
for (const m of room.members.values()) m.lastPush = Date.now();

/* ------------------------------------------------------------ départ */

A.socket.disconnect();
check('un départ vide sa place', await until(() => room.crowd()[0] === 1, 2000));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
for (const p of [B, C]) p.socket.disconnect();
virage.stop(); io.close(); http.close(); await pool.end();
process.exit(failures ? 1 : 0);
