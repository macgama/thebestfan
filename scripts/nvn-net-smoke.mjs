/**
 * Test de la couche réseau du duel NvN.
 * Vraies sockets, vraie base : appariement, diffusion, coupure, reprise.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { createDecks } from '../src/server/deck/index.js';
import { createNvN } from '../src/server/nvn/index.js';
import { ACTIONS } from '../src/shared/duel/actions.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(25); }
  return false;
}

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql','football.sql','duel.sql','souvenirs.sql','fanzzy.sql',
                 'inventaire.sql','deck.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = ['e1','e2','e3','e4'].map((x, i) =>
  `eeee0000-0000-0000-0000-00000000000${i + 1}`);
const communes = ACTIONS.filter((a) => a.rar === 'd1').map((a) => a.id);
const dix = [...communes, ...communes].slice(0, 10);
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `n${i}@ex.fr`, `Duelliste${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,0)`, [id]);
  for (const f of ['V1','P1','F1']) {
    await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [id, f]);
  }
  await raw.query(`INSERT INTO user_decks (user_id,nom,contenu) VALUES (?,?,?)`,
    [id, 'Deck', JSON.stringify({ nom:'Deck',
      fanzzy:[{id:'V1',stuff:[]},{id:'P1',stuff:[]},{id:'F1',stuff:[]}], actions: dix })]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
  VALUES (900,207,2026,85,91,'1H',UTC_TIMESTAMP()),
         (901,207,2026,91,85,'NS',UTC_TIMESTAMP() + INTERVAL 3 DAY)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 10, charset:'utf8mb4' });
const app = express(); const http = createServer(app);
const io = new Server(http, { cors:{origin:'*'} });
io.use((s, next) => { s.data.user = { userId: s.handshake.auth.token, name: 'J' }; next(); });
const decks = createDecks({ pool, requireAuth: (r,_s,n)=>n() });
const N = createNvN({ pool, io, decks, requireAuth: (r,_s,n)=>{ r.user={id:U[0]}; n(); } });
app.use('/api/nvn', N.router);
await new Promise((r)=>http.listen(0,r));
const url = `http://localhost:${http.address().port}`;

function co(id) {
  const socket = client(url, { transports:['websocket'], auth:{ token:id }, reconnection:false });
  const p = { id, socket, state:null, events:[], errors:[], file:null, starts:0 };
  socket.on('nvn:start', (s)=>{ p.state=s; p.starts++; });
  socket.on('nvn:state', (s)=>{ p.state=s; });
  socket.on('nvn:events', (e)=>p.events.push(...e));
  socket.on('nvn:error', (e)=>p.errors.push(e.code));
  socket.on('nvn:file', (f)=>{ p.file=f; });
  return p;
}

/* ------------------------------------------------------- appariement 1v1 */

const A = co(U[0]), B = co(U[1]);
check('sockets connectées', await until(()=>A.socket.connected && B.socket.connected));

A.socket.emit('nvn:queue', { format:'1v1', fixtureId:900 });
check('mise en file confirmée', await until(()=>A.file !== null));
check('le mode du match est annoncé', A.file.mode === 'classe');
check('pas d\u2019appariement seul', A.state === null);

B.socket.emit('nvn:queue', { format:'1v1', fixtureId:900 });
check('duel formé à deux', await until(()=>A.state && B.state));
check('camps opposés', A.state.moi.side !== B.state.moi.side);
check('main de cinq cartes', A.state.moi.main.length === 5);
check('trois Fanzzy', A.state.moi.fanzzy.length === 3);
check('le match support est transmis', A.state.fixture?.id === 900);
check('duel classé', A.state.mode === 'classe');

/* ------------------------------------------------------------ actions */

A.socket.emit('nvn:chant', { geste:'tempo',
  taps: Array.from({length:8},(_,i)=>i*560 + (Math.random()*40-20)) });
check('le chant est diffusé aux deux', await until(()=>
  A.events.some((e)=>e.t==='chant') && B.events.some((e)=>e.t==='chant')));
check('la corde a bougé', await until(()=>A.state.rope !== 0));

// Souffle rétabli côté moteur : le chant précédent l'a entamé, et une carte
// refusée faute de souffle ferait passer les tests suivants pour de mauvaises
// raisons.
const salleA = [...N.salles.values()][0];
salleA.duel.joueurs.get(U[0]).breath = 100;

const carte = A.state.moi.main[0];
A.socket.emit('nvn:play', { cardId: carte });
check('la carte est jouée', await until(()=>A.events.some((e)=>e.t==='action')));
check('elle quitte la main', await until(()=>!A.state.moi.main.includes(carte)));

A.errors.length = 0;
A.socket.emit('nvn:play', { cardId: 'a-inexistante' });
check('carte inconnue refusée',
  await until(()=>A.errors.includes('ferveur.error.card_not_in_hand')));

A.errors.length = 0;
for (let i = 0; i < 40; i++) A.socket.emit('nvn:chant', { geste:'tempo', taps:[0] });
check('cadence plafonnée', await until(()=>A.errors.includes('nvn.error.rate_limited')));

/* --------------------------------------------------- coupure et reprise */

const salle = [...N.salles.values()][0];
B.socket.disconnect();
check('la coupure est annoncée', await until(()=>A.events.some((e)=>e.t==='disconnected')));
check('la place est gardée', salle.membres.get(U[1]).parti !== true);
check('le duel continue', !salle.duel.termine);

const B2 = co(U[1]);
await until(()=>B2.socket.connected);
B2.socket.emit('nvn:resume');
check('reprise acceptée', await until(()=>B2.state !== null));
check('l\u2019état est complet à la reprise',
  B2.state.moi.main.length > 0 && B2.state.moi.fanzzy.length === 3);
check('le retour est annoncé', await until(()=>A.events.some((e)=>e.t==='back')));

/* ------------------------------------------------------- fin et classement */

// Le plafond de cadence court sur dix secondes : il faut le laisser retomber,
// sinon le dernier chant serait refusé et la partie ne se terminerait jamais.
await wait(10_500);
salle.duel.goals = [2, 2];
salle.duel.rope = -299;
salle.duel.joueurs.get(U[0]).breath = 100;
A.errors.length = 0;
A.socket.emit('nvn:chant', { geste:'tempo',
  taps: Array.from({length:8},(_,i)=>i*560 + (Math.random()*30-15)) });
check('la partie se termine', await until(()=>A.events.some((e)=>e.t==='over')));
await wait(600);
const [res] = await pool.query('SELECT user_id, outcome FROM duel_results WHERE duel_id = ?',
  [salle.duel.id]);
check('le duel classé est enregistré', res.length === 2);
check('un gagnant et un perdant',
  res.filter((r)=>r.outcome==='win').length === 1 && res.filter((r)=>r.outcome==='loss').length === 1);

/* -------------------------------------------------- entraînement et bots */

const C = co(U[2]);
await until(()=>C.socket.connected);
C.socket.emit('nvn:queue', { format:'2v2', fixtureId:901, contreBot:true });
check('entraînement ouvert immédiatement', await until(()=>C.state !== null));
check('les places sont tenues par des bots',
  C.state.equipes.flat().length === 4);
check('un entraînement ne compte pas', C.state.mode === 'entrainement');
const avant = C.events.length;
check('les bots jouent', await until(()=>C.events.length > avant, 9000));

/* ---------------------------------------------------------- refus utiles */

const D = co(U[3]);
await until(()=>D.socket.connected);
D.socket.emit('nvn:queue', { format:'9v9', fixtureId:900 });
check('format inconnu refusé', await until(()=>D.errors.includes('ferveur.error.unknown_format')));
D.errors.length = 0;
D.socket.emit('nvn:queue', { format:'1v1', fixtureId:99999 });
check('match inconnu refusé', await until(()=>D.errors.includes('duel.error.fixture_unknown')));

await pool.query('DELETE FROM user_decks WHERE user_id = ?', [U[3]]);
D.errors.length = 0;
D.socket.emit('nvn:queue', { format:'1v1', fixtureId:900 });
check('sans deck, la file est refusée', await until(()=>D.errors.includes('ferveur.error.no_deck')));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
for (const p of [A, B2, C, D]) p.socket.disconnect();
N.stop(); io.close(); http.close(); await pool.end();
process.exit(failures ? 1 : 0);
