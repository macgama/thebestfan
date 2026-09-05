/**
 * Test de l'adversaire d'entraînement.
 *
 * Un seul compte entre en file. Personne en face. Le serveur doit lui proposer
 * un entraînement plutôt que de le laisser attendre, et la partie doit aller
 * jusqu'au bout — le bot ne se déconnecte pas, ne déclenche pas de forfait, et
 * ne fait pas expirer ses propres tours.
 *
 *   node scripts/duel-bot.mjs
 */
import { spawn } from 'node:child_process';
import { io as client } from 'socket.io-client';
import { cardDef, project } from '../dist/duel-server.mjs';

const PORT = 4620;
const ORIGIN = `http://localhost:${PORT}`;
const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(25); }
  return false;
}

const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, DATABASE_URL: DB, PUBLIC_ORIGIN: ORIGIN, SESSION_SECRET: 'test',
         PORT: String(PORT), DUEL_BOT_AFTER_MS: '2000', DUEL_DEBUG: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (b) => { logs += b; });
server.stderr.on('data', (b) => { logs += b; });
check('serveur démarré', await until(() => logs.includes('écoute sur'), 20000));

const res = await fetch(`${ORIGIN}/api/auth/register`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: ORIGIN },
  body: JSON.stringify({ email: `solo-${Date.now()}@exemple.fr`, pseudo: 'Solo' + Math.floor(Math.random() * 1e5),
    password: 'une-phrase-de-passe-solide', locale: 'fr' }),
});
const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0])
  .find((c) => c.startsWith('tbf_session='));
check('compte créé', res.status === 201 && Boolean(cookie));

const socket = client(ORIGIN, { transports: ['websocket'], extraHeaders: { cookie } });
const P = { snap: null, events: [], errors: [], queued: null, over: null, training: null, blocked: false };
const open = (s) => { P.snap = s; P.training = s.training; };
socket.on('duel:start', open);
socket.on('duel:state', open);
socket.on('duel:queued', (q) => { P.queued = q; });
socket.on('duel:event', ({ seq, event }) => {
  if (!P.snap || seq <= P.snap.seq) return;
  P.snap = project(P.snap, seq, event);
  if (event.t === 'turn_start') P.blocked = false;
  P.events.push(event);
  if (event.t === 'over') P.over = event;
});
socket.on('duel:error', (e) => {
  P.errors.push(e.code);
  // Ce client de test est rudimentaire : quand une action est refusée, il
  // passe la main au lieu de la retenter en boucle.
  if (P.snap && P.snap.turn === P.snap.you && P.snap.phase === 'playing') {
    P.blocked = true;
    socket.emit('duel:intent', { duelId: P.snap.duelId, intent: { t: 'end_turn' } });
  }
});

check('socket connectée', await until(() => socket.connected));
socket.emit('duel:queue', {});
check('mise en file confirmée', await until(() => P.queued !== null));
check('le serveur annonce le délai avant entraînement', typeof P.queued?.botInMs === 'number');

const t0 = Date.now();
check('un adversaire arrive sans personne en face', await until(() => P.snap !== null, 12000));
const delay = Date.now() - t0;
check(`bascule rapide (${(delay / 1000).toFixed(1)} s)`, delay < 10000);
check('la partie est annoncée comme un entraînement', P.training === true);
check('adversaire nommé', P.snap.players.some((p) => p.name === 'Entraînement'));

/* --------------------------------------------------------- la partie */

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
function move(s) {
  if (!s || s.phase === 'over') return null;
  const me = s.players[s.you];
  if (s.phase === 'ko_promote') return me.bench[0] ? { t: 'promote', benchUid: me.bench[0].uid } : null;
  if (s.turn !== s.you) return null;
  if (me.bench.length < 3 && s.hand.length) return { t: 'play_support', uid: s.hand[0].uid };
  if (s.souffleAvailable && me.active) return { t: 'attach_souffle', targetUid: me.active.uid };
  if (me.active && !P.blocked) {
    const c = cardDef(me.active.cardId).chants
      .filter((x) => canPay(me.active.souffle, x.cost)).sort((x, y) => y.power - x.power)[0];
    if (c) return { t: 'chant', chantId: c.id };
  }
  return { t: 'end_turn' };
}

const deadline = Date.now() + 150_000;   // un match complet dure ~90 s
while (Date.now() < deadline && !P.over) {
  const m = move(P.snap);
  if (m) { socket.emit('duel:intent', { duelId: P.snap.duelId, intent: m }); await wait(120); }
  await wait(40);
}
await until(() => P.over, 5000);

const types={};for(const e of P.events)types[e.t]=(types[e.t]||0)+1;
console.log('DEBUG événements:',JSON.stringify(types));
console.log('DEBUG derniers:',P.events.slice(-8).map(e=>e.t+(e.side!==undefined?':'+e.side:'')).join(' > '));
console.log('DEBUG erreurs:',JSON.stringify([...new Set(P.errors)]));
console.log('DEBUG phase:',P.snap.phase,'tour à',P.snap.turn,'moi',P.snap.you,
  'main',P.snap.hand.length,'banc',P.snap.players[P.snap.you].bench.length,
  'souffle actif',JSON.stringify(P.snap.players[P.snap.you].active?.souffle));
console.log('DEBUG bot:',logs.split('\n').filter(l=>l.startsWith('[bot]')).slice(-8).join(' | ')||'AUCUNE DECISION');
check('la partie va jusqu\u2019au bout', Boolean(P.over));
const foe = P.snap.you ^ 1;
const botActions = P.events.filter((e) => e.side === foe).length;
check(`le bot a joué, pas seulement subi (${botActions} actions)`, botActions >= 5);
check('aucun forfait du bot', P.over?.reason !== 'surrender');
check('aucun tour perdu par expiration', P.over?.reason !== 'timeout');
// Les refus liés au rythme du client de test ne comptent pas : ils viennent
// de ce script, pas du serveur.
// `rate_limited` est le serveur qui fait son travail : ce client de test
// envoie ses intentions bien plus vite qu'un humain.
const attendus = ['error.not_enough_souffle', 'error.promote_first', 'error.not_your_turn',
  'error.no_chant_first_turn', 'error.bench_full', 'error.rate_limited'];
check('aucune erreur inattendue',
  P.errors.filter((e) => !attendus.includes(e)).length === 0);

const chants = { moi: 0, bot: 0 };
for (const e of P.events) if (e.t === 'chant') chants[e.side === P.snap.you ? 'moi' : 'bot']++;
console.log(`\nscore ${P.snap.players[0].score}-${P.snap.players[1].score} · ${P.snap.minute}' · ` +
  `${P.over?.winner === P.snap.you ? 'joueur' : 'bot'} gagne (${P.over?.reason}) · ` +
  `chants ${chants.moi} contre ${chants.bot}`);

socket.disconnect();
server.kill('SIGTERM');
await wait(500);
console.log(failures ? `${failures} échec(s)` : 'tout est vert');
process.exit(failures ? 1 : 0);
