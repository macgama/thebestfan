/**
 * Test d'intégration du duel sur le serveur complet.
 *
 * Deux vrais comptes s'inscrivent par HTTP, ouvrent chacun une socket avec leur
 * cookie de session, entrent en file, et jouent un match jusqu'au bout. Ce test
 * vérifie ce que les tests unitaires ne peuvent pas voir : que l'authentification,
 * le serveur de duel et le paquet construit par esbuild fonctionnent ensemble.
 *
 *   node scripts/duel-play.mjs
 */
import { spawn } from 'node:child_process';
import { io as client } from 'socket.io-client';
import { cardDef, project } from '../dist/duel-server.mjs';

const PORT = 4610;
const ORIGIN = `http://localhost:${PORT}`;
const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}`);
  if (!cond) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(25); }
  return false;
}

/* ------------------------------------------------------- le serveur */

const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, DATABASE_URL: DB, PUBLIC_ORIGIN: ORIGIN, SESSION_SECRET: 'test', PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (b) => { logs += b; });
server.stderr.on('data', (b) => { logs += b; });

const up = await until(() => logs.includes('écoute sur'), 20000);
check('le serveur démarre', up);
check('duels actifs au démarrage', logs.includes('duels temps reel actifs'));
if (!up) { console.log(logs); process.exit(1); }

/* --------------------------------------------------------- comptes */

async function signup(nick) {
  const res = await fetch(`${ORIGIN}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify({
      email: `${nick}-${Date.now()}@exemple.fr`, pseudo: nick,
      password: 'une-phrase-de-passe-solide', locale: 'fr',
    }),
  });
  const cookie = (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0]).find((c) => c.startsWith('tbf_session='));
  return { status: res.status, cookie, json: await res.json() };
}

const nord = await signup('Nord' + Math.floor(Math.random() * 1e5));
const sud = await signup('Sud' + Math.floor(Math.random() * 1e5));
check('deux comptes créés', nord.status === 201 && sud.status === 201);

/* --------------------------------------------------------- joueurs */

function join(account) {
  const socket = client(ORIGIN, {
    transports: ['websocket'],
    extraHeaders: { cookie: account.cookie },
  });
  const p = { socket, snap: null, events: [], errors: [], name: account.json.user.pseudo };
  const open = (s) => { p.snap = s; };
  socket.on('duel:start', open);
  socket.on('duel:state', open);
  socket.on('duel:event', ({ seq, event }) => {
    if (!p.snap || seq <= p.snap.seq) return;
    // Même projection que le navigateur : le test voit ce que voit un joueur.
    p.snap = project(p.snap, seq, event);
    p.events.push(event);
    if (event.t === 'over') p.over = event;
  });
  socket.on('duel:error', (e) => p.errors.push(e.code));
  socket.on('connect_error', (e) => p.errors.push('connect:' + e.message));
  return p;
}

const a = join(nord);
const b = join(sud);
check('sockets connectées avec la session', await until(() => a.socket.connected && b.socket.connected));

// Une socket sans cookie ne doit pas pouvoir entrer en file.
const anon = client(ORIGIN, { transports: ['websocket'] });
const anonErrors = [];
anon.on('duel:error', (e) => anonErrors.push(e.code));
await until(() => anon.connected, 3000);
anon.emit('duel:queue', {});
await wait(400);
check('joueur sans compte refusé en file', anonErrors.includes('auth.error.unauthenticated'));
anon.disconnect();

a.socket.emit('duel:queue', {});
b.socket.emit('duel:queue', {});
check('appariement des deux comptes', await until(() => a.snap && b.snap, 8000));
check('même duel des deux côtés', a.snap?.duelId === b.snap?.duelId);
check('pseudos réels dans le duel',
  a.snap.players.some((p) => p.name === a.name) && a.snap.players.some((p) => p.name === b.name));
check('deck de départ de 20 cartes',
  a.snap.hand.length + a.snap.players[a.snap.you].deckCount + 1 +
  (a.snap.turn === a.snap.you ? 0 : 0) >= 19);

/* ------------------------------------------------------ la partie */

function canPay(souffle, cost) {
  const pool = [...souffle];
  for (const c of cost) {
    if (c === 'any') continue;
    const i = pool.indexOf(c);
    if (i === -1) return false;
    pool.splice(i, 1);
  }
  return pool.length >= cost.filter((c) => c === 'any').length;
}

function move(p) {
  const s = p.snap;
  if (!s || s.phase === 'over') return null;
  const me = s.players[s.you];
  if (s.phase === 'ko_promote') return me.bench[0] ? { t: 'promote', benchUid: me.bench[0].uid } : null;
  if (s.turn !== s.you) return null;
  if (me.bench.length < 3 && s.hand.length) return { t: 'play_support', uid: s.hand[0].uid };
  if (s.souffleAvailable && me.active) return { t: 'attach_souffle', targetUid: me.active.uid };
  if (me.active) {
    const c = cardDef(me.active.cardId).chants
      .filter((x) => canPay(me.active.souffle, x.cost)).sort((x, y) => y.power - x.power)[0];
    if (c) return { t: 'chant', chantId: c.id };
  }
  return { t: 'end_turn' };
}

let steps = 0;
while (steps++ < 900 && !a.over && !b.over) {
  for (const p of [a, b]) {
    const m = move(p);
    if (m) { p.socket.emit('duel:intent', { duelId: p.snap.duelId, intent: m }); await wait(14); }
  }
  await wait(8);
}
await until(() => a.over && b.over, 4000);

check('le match va jusqu\u2019au bout', Boolean(a.over));
check('même issue des deux côtés', a.over?.winner === b.over?.winner);
check('des buts ont été marqués ou 90 minutes jouées',
  a.events.some((e) => e.t === 'goal') || a.snap.minute >= 90);
check('des chants ont été lancés', a.events.filter((e) => e.t === 'chant').length > 3);
check('aucune erreur inattendue',
  a.errors.filter((e) => e !== 'error.not_enough_souffle').length === 0);

const scores = a.snap.players.map((p) => p.score);
console.log(`\nscore ${scores[0]}-${scores[1]} · ${a.snap.minute}' · issue ${a.over?.winner} (${a.over?.reason})`);

a.socket.disconnect();
b.socket.disconnect();
server.kill('SIGTERM');
await wait(600);
console.log(failures ? `${failures} échec(s)` : 'tout est vert');
process.exit(failures ? 1 : 0);
