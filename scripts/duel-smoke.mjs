/**
 * Test de bout en bout du duel : lance un vrai serveur socket.io, connecte deux
 * clients, joue une partie complète, coupe la connexion d'un joueur en cours de
 * route et vérifie qu'il reprend là où il en était.
 *
 *   npx tsx scripts/duel-smoke.mjs
 */
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { attachDuelServer, randomDeck } from '../dist-test/server/duel/index.js';
import { project } from '../dist-test/shared/duel/project.js';
import { cardDef } from '../dist-test/shared/duel/cards.js';

const http = createServer();
const ioServer = new Server(http, { cors: { origin: '*' } });
const duels = attachDuelServer(ioServer, { getDeck: async () => randomDeck(), tickMs: 250 });
await new Promise((r) => http.listen(0, r));
const url = `http://localhost:${http.address().port}`;

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}`);
  if (!cond) failures++;
};

function makePlayer(token) {
  const socket = client(url, { auth: { token }, transports: ['websocket'] });
  const p = { token, socket, snap: null, events: [], errors: [], gaps: 0, blocked: new Set(), lastChant: null };
  const open = (s) => { p.snap = s; };
  socket.on('duel:start', open);
  socket.on('duel:state', open);
  socket.on('duel:event', ({ seq, event }) => {
    if (!p.snap) return;
    if (seq <= p.snap.seq) return;
    if (seq > p.snap.seq + 1) { p.gaps++; socket.emit('duel:resync', { duelId: p.snap.duelId, sinceSeq: p.snap.seq }); return; }
    if (event.t === 'turn_start') p.blocked.clear();
    p.snap = project(p.snap, seq, event);
    p.events.push(event);
  });
  socket.on('duel:error', (e) => {
    p.errors.push(e.code);
    // Un refus ne doit jamais bloquer le bot : on note et on passe la main.
    if (p.lastChant) p.blocked.add(p.lastChant);
    if (p.snap && p.snap.turn === p.snap.you && p.snap.phase === 'playing') {
      p.socket.emit('duel:intent', { duelId: p.snap.duelId, intent: { t: 'end_turn' } });
    }
  });
  return p;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await wait(20);
  }
  return false;
}

const a = makePlayer('joueur-nord');
const b = makePlayer('joueur-sud');
await until(() => a.socket.connected && b.socket.connected);

a.socket.emit('duel:queue', {});
b.socket.emit('duel:queue', {});
check('appariement des deux joueurs', await until(() => a.snap && b.snap));
check('même duel des deux côtés', a.snap.duelId === b.snap.duelId);
// 5 cartes piochées, 1 promue au premier rang, +1 pour celui qui commence.
const expectedHand = 4 + (a.snap.turn === a.snap.you ? 1 : 0);
check('main de mise en place correcte', a.snap.hand.length === expectedHand);
check('main adverse visible seulement en compteur',
  typeof a.snap.players[1 - a.snap.you].handCount === 'number' &&
  !('hand' in a.snap.players[1 - a.snap.you]));
check('un groupe au premier rang de chaque côté',
  !!a.snap.players[0].active && !!a.snap.players[1].active);

// La main de l'adversaire ne doit jamais fuiter dans les événements reçus.
const leaked = a.events.some((e) => e.t === 'draw' && e.side !== a.snap.you && e.card);
check('aucune fuite de la main adverse', !leaked);

// Un joueur qui n'est pas de tour est refusé.
const off = a.snap.turn === a.snap.you ? b : a;
off.socket.emit('duel:intent', { duelId: off.snap.duelId, intent: { t: 'end_turn' } });
check('intention hors tour refusée', await until(() => off.errors.includes('error.not_your_turn')));

/* --------------------------- déroulé automatique d'une partie --------------------------- */

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

function bestMove(p) {
  const s = p.snap;
  const me = s.players[s.you];
  if (s.phase === 'ko_promote') {
    if (me.bench[0]) return { t: 'promote', benchUid: me.bench[0].uid };
    return null;
  }
  if (s.turn !== s.you || s.phase === 'over') return null;

  if (me.bench.length < 3 && s.hand.length) return { t: 'play_support', uid: s.hand[0].uid };
  if (s.souffleAvailable && me.active) return { t: 'attach_souffle', targetUid: me.active.uid };

  if (me.active) {
    const def = cardDef(me.active.cardId);
    const affordable = def.chants
      .filter((c) => canPay(me.active.souffle, c.cost) && !p.blocked.has(c.id))
      .sort((x, y) => y.power - x.power)[0];
    if (affordable) return { t: 'chant', chantId: affordable.id };
  }
  return { t: 'end_turn' };
}

let disconnectedOnce = false;
let steps = 0;

while (steps++ < 900) {
  const acting = [a, b].filter((p) => p.snap && p.snap.phase !== 'over');
  if (!acting.length) break;
  if (a.snap?.phase === 'over' || b.snap?.phase === 'over') break;

  for (const p of acting) {
    const mv = bestMove(p);
    if (mv) {
      p.lastChant = mv.t === 'chant' ? mv.chantId : null;
      if (mv.t === 'turn_start') continue;
      p.socket.emit('duel:intent', { duelId: p.snap.duelId, intent: mv });
      await wait(12);
    }
  }

  // Au 40e pas, on coupe brutalement le joueur A pour tester la reprise.
  if (steps === 6 && !disconnectedOnce) {
    disconnectedOnce = true;
    const seqBefore = a.snap.seq;
    a.socket.disconnect();
    await wait(400);
    a.socket.connect();
    await until(() => a.socket.connected);
    a.socket.emit('duel:resync', { duelId: a.snap.duelId, sinceSeq: seqBefore });
    await wait(300);
    check('reprise après coupure réseau', a.snap.seq >= seqBefore && a.snap.phase !== 'over');
  }
  await wait(10);
}

await until(() => a.snap?.phase === 'over' && b.snap?.phase === 'over', 5000);

check('la partie se termine', a.snap.phase === 'over');
check('même vainqueur des deux côtés', a.snap.winner === b.snap.winner);
check('scores identiques des deux côtés',
  a.snap.players[0].score === b.snap.players[0].score &&
  a.snap.players[1].score === b.snap.players[1].score);
check('les deux vues sont au même numéro de séquence', a.snap.seq === b.snap.seq);
check('90 minutes non dépassées', a.snap.minute <= 90);
check('aucune room orpheline', duels.stats.queue === 0);

console.log(`\nscore final ${a.snap.players[0].score}-${a.snap.players[1].score} · ${a.snap.minute}' · ` +
  `vainqueur ${a.snap.winner} · ${a.snap.seq} événements`);

a.socket.disconnect();
b.socket.disconnect();
await duels.close();
ioServer.close();
http.close();
process.exit(failures ? 1 : 0);
