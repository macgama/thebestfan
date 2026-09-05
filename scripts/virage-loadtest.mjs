/**
 * Test de charge du Grand Virage.
 *
 * Mesure ce qui décide de l'hébergement : le délai entre le chant d'un
 * supporter et le moment où toute la tribune voit la corde bouger. C'est le
 * seul chiffre qui compte à mille personnes.
 *
 *   node scripts/virage-loadtest.mjs 200                       # serveur local
 *   node scripts/virage-loadtest.mjs 200 https://thebestfan.online
 *
 * En local, un serveur est monté dans le même process : la mesure porte sur le
 * moteur. Avec une URL, elle inclut le réseau et l'hébergement.
 */
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';

const N = Number(process.argv[2] ?? 100);
const REMOTE = process.argv[3];
const DUREE_MS = 25_000;
const FIXTURE = Number(process.env.FIXTURE_ID ?? 7001);

let url = REMOTE, http, io, virage, pool;

if (!REMOTE) {
  const { readFileSync } = await import('node:fs');
  const express = (await import('express')).default;
  const mysql = await import('mysql2/promise');
  const { createSouvenirs } = await import('../src/server/souvenirs/index.js');
  const { createFanzzy } = await import('../src/server/fanzzy/index.js');
  const { createVirage } = await import('../src/server/ferveur/index.js');

  const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  await raw.query(`DROP TABLE IF EXISTS user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence, souvenirs,
                 user_wallet, api_cache, souvenir_leagues, duel_results, duel_events, duels,
                 user_follows, fixture_events, standings, fixtures, team_leagues, teams, leagues,
                 api_quota, login_attempts, auth_tokens, sessions, users`);
  for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql']) {
    await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
  }
  await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Domicile'),(91,'Visiteur')`);
  await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Test')`);
  await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
                   VALUES (?,207,2026,85,91,'1H',UTC_TIMESTAMP())`, [FIXTURE]);
  for (let i = 0; i < N; i++) {
    const id = `load-${String(i).padStart(5, '0')}-0000-0000-000000000000`.slice(0, 36);
    await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
      [id, `l${i}@ex.fr`, `L${i}`]);
    await raw.query(`INSERT INTO user_wallet (user_id,scarves,active_fanzzy) VALUES (?,0,'V1')`, [id]);
    await raw.query(`INSERT INTO user_follows (user_id,team_id) VALUES (?,?)`, [id, i % 2 ? 91 : 85]);
  }
  await raw.end();

  pool = mysql.createPool({ uri: DB, connectionLimit: 12, charset: 'utf8mb4' });
  const app = express();
  http = createServer(app);
  io = new Server(http, { cors: { origin: '*' }, perMessageDeflate: false });
  io.use((s, next) => { s.data.user = { userId: s.handshake.auth.token, name: 'L' }; next(); });
  const souvenirs = createSouvenirs({ pool, requireAuth: (r, _s, n) => n() });
  const fanzzy = createFanzzy({ pool, requireAuth: (r, _s, n) => n() });
  virage = createVirage({ pool, io, souvenirs, fanzzy, requireAuth: (r, _s, n) => n() });
  await new Promise((r) => http.listen(0, r));
  url = `http://localhost:${http.address().port}`;
}

const jitter = (t, a = 22) => Math.max(0, t + (Math.random() * a * 2 - a));
const tempo = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560, 55));

const latences = [];
const erreurs = new Map();
const chantAt = new Map();     // userId -> instant du chant
let chants = 0, ticks = 0;

function join(i) {
  const id = `load-${String(i).padStart(5, '0')}-0000-0000-000000000000`.slice(0, 36);
  const socket = client(url, { transports: ['websocket'], auth: { token: id } });
  const p = { id, socket, ready: false };
  socket.on('virage:state', () => { p.ready = true; });
  socket.on('virage:tick', () => {
    ticks++;
    // Un tick qui suit un chant : on mesure le délai pour ce supporter.
    for (const [uid, t] of chantAt) {
      latences.push(performance.now() - t);
      chantAt.delete(uid);
    }
  });
  socket.on('virage:error', (e) => erreurs.set(e.code, (erreurs.get(e.code) ?? 0) + 1));
  socket.on('connect_error', (e) =>
    erreurs.set('connect:' + e.message, (erreurs.get('connect:' + e.message) ?? 0) + 1));
  socket.on('connect', () => socket.emit('virage:join', { fixtureId: FIXTURE }));
  return p;
}

const gens = [];
for (let i = 0; i < N; i++) {
  gens.push(join(i));
  if (i % 25 === 0) await new Promise((r) => setTimeout(r, 60));   // montée progressive
}
// L'entrée demande une lecture en base par supporter : à plusieurs centaines,
// il faut laisser le temps à la file de se vider avant de compter.
await new Promise((r) => setTimeout(r, 1500 + N * 12));
const entres = gens.filter((g) => g.ready).length;

const rssAvant = process.memoryUsage?.().rss ?? 0;
const t0 = performance.now();

// Chaque supporter chante toutes les 4 à 8 secondes, comme un vrai.
const boucles = gens.map((g) => setInterval(() => {
  if (!g.ready || !g.socket.connected) return;
  chantAt.set(g.id, performance.now());
  g.socket.emit('virage:chant', { cardId: 'reprise', taps: tempo() });
  chants++;
}, 4000 + Math.random() * 4000));

await new Promise((r) => setTimeout(r, DUREE_MS));
for (const b of boucles) clearInterval(b);

latences.sort((a, b) => a - b);
const pct = (q) => (latences.length ? latences[Math.floor(latences.length * q)].toFixed(0) : 'n/a');
const secondes = (performance.now() - t0) / 1000;

console.log(`\n${N} supporters · ${REMOTE ?? 'serveur local'}`);
console.log(`entrés dans le virage : ${entres}/${N}`);
console.log(`chants envoyés        : ${chants} (${(chants / secondes).toFixed(1)}/s)`);
console.log(`diffusions reçues     : ${ticks} (${(ticks / secondes / Math.max(1, entres)).toFixed(1)}/s par client)`);
console.log(`chant → corde vue     : p50 ${pct(0.5)} ms · p95 ${pct(0.95)} ms · p99 ${pct(0.99)} ms`);
if (!REMOTE) {
  console.log(`mémoire du process    : +${((process.memoryUsage().rss - rssAvant) / 1e6).toFixed(0)} Mo`);
  const salle = virage.rooms.get(FIXTURE);
  if (salle) console.log(`foule vue par le serveur : ${JSON.stringify(salle.crowd())}`);
}
if (erreurs.size) console.log('erreurs :', Object.fromEntries(erreurs));

for (const g of gens) g.socket.disconnect();
virage?.stop(); io?.close(); http?.close(); await pool?.end();
process.exit(0);
