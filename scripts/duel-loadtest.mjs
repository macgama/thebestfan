/**
 * Test de charge du serveur de duel.
 * Mesure ce qui compte pour le joueur : le délai entre le moment où un joueur
 * agit et celui où l'autre voit l'action.
 *
 *   node scripts/duel-loadtest.mjs 100        # 100 duels = 200 sockets
 *   node scripts/duel-loadtest.mjs 100 https://thebestfan.online
 *
 * Sans URL, un serveur local est lancé dans le même process (mesure le moteur).
 * Avec URL, la mesure inclut le réseau et l'hébergement : c'est ce chiffre-là
 * qu'il faut regarder avant d'ouvrir aux joueurs.
 */
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { attachDuelServer, randomDeck } from '../dist-test/server/duel/index.js';

const PAIRS = Number(process.argv[2] ?? 50);
const REMOTE = process.argv[3];
const DURATION_MS = 20_000;

let url = REMOTE;
let http, ioServer, duels;

if (!REMOTE) {
  http = createServer();
  ioServer = new Server(http, { cors: { origin: '*' }, perMessageDeflate: false });
  duels = attachDuelServer(ioServer, { getDeck: async () => randomDeck(), tickMs: 1000 });
  await new Promise((r) => http.listen(0, r));
  url = `http://localhost:${http.address().port}`;
}

const latencies = [];
const errors = new Map();
const sentAt = new Map(); // duelId -> timestamp de la dernière intention

function connect(token) {
  const socket = client(url, { auth: { token }, transports: ['websocket'] });
  const p = { socket, snap: null };
  const open = (s) => {
    p.snap = s;
    // Le premier tour est dans le snapshot d'ouverture, pas dans un événement.
    if (s.turn === s.you && s.phase !== 'over') {
      sentAt.set(s.duelId, performance.now());
      socket.emit('duel:intent', { duelId: s.duelId, intent: { t: 'end_turn' } });
    }
  };
  socket.on('duel:start', open);
  socket.on('duel:state', open);
  socket.on('duel:event', ({ duelId, seq, event }) => {
    if (!p.snap) return;
    p.snap = { ...p.snap, seq, turn: event.t === 'turn_start' ? event.side : p.snap.turn,
               phase: event.t === 'over' ? 'over' : p.snap.phase };
    if (event.t === 'turn_start') {
      const t0 = sentAt.get(duelId);
      if (t0) { latencies.push(performance.now() - t0); sentAt.delete(duelId); }
      if (event.side === p.snap.you) {
        sentAt.set(duelId, performance.now());
        socket.emit('duel:intent', { duelId, intent: { t: 'end_turn' } });
      }
    }
  });
  socket.on('duel:error', (e) => errors.set(e.code, (errors.get(e.code) ?? 0) + 1));
  socket.on('connect_error', (e) => errors.set(`connect:${e.message}`, (errors.get(`connect:${e.message}`) ?? 0) + 1));
  return p;
}

const players = [];
for (let i = 0; i < PAIRS; i++) {
  players.push(connect(`load-a-${i}`), connect(`load-b-${i}`));
  if (i % 25 === 0) await new Promise((r) => setTimeout(r, 60)); // montée progressive
}
await new Promise((r) => setTimeout(r, 1500));
for (const p of players) p.socket.emit('duel:queue', {});

const t0 = performance.now();
const rssStart = process.memoryUsage().rss;
await new Promise((r) => setTimeout(r, DURATION_MS));

latencies.sort((a, b) => a - b);
const pct = (q) => (latencies.length ? latencies[Math.floor(latencies.length * q)].toFixed(1) : 'n/a');
const connected = players.filter((p) => p.socket.connected).length;

console.log(`\n${PAIRS} duels · ${players.length} sockets · ${REMOTE ?? 'serveur local'}`);
console.log(`sockets connectées : ${connected}/${players.length}`);
console.log(`tours mesurés      : ${latencies.length} en ${((performance.now() - t0) / 1000).toFixed(0)} s`);
console.log(`latence action→vue : p50 ${pct(0.5)} ms · p95 ${pct(0.95)} ms · p99 ${pct(0.99)} ms`);
if (!REMOTE) {
  console.log(`mémoire process    : +${(((process.memoryUsage().rss - rssStart) / 1e6)).toFixed(0)} Mo`);
  console.log(`rooms actives      : ${duels.stats.rooms}`);
}
if (errors.size) console.log('erreurs :', Object.fromEntries(errors));

for (const p of players) p.socket.disconnect();
await duels?.close();
ioServer?.close();
http?.close();
process.exit(0);
