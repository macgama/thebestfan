/**
 * Un duel privé (`src/server/nvn/index.js`, « un duel privé »).
 *
 * Gaël, 6 novembre 2026 : « Si un joueur a créé un duel pour un match, les
 * autres USER n'ont pas d'autres choix que d'y participer », et : « Est-il
 * possible de bloquer la venue d'autres USER car le USER organisateur a
 * envoyé le lien à quelqu'un pour jouer avec ? »
 *
 * Vraie base, vraies sockets, comme `duel-attente:smoke`. Ce qui est vérifié :
 *   — un duel privé ne se voit dans aucune liste, et un joueur de la file
 *     publique du même match n'y tombe pas ; la file publique vit à côté ;
 *   — le lien y mène, dans la tribune vide, même pour un ami du même club ;
 *   — pas de supporters d'appoint d'office ; le salon expire sans duel ;
 *   — le cadenas du vestiaire ferme et rouvre le duel.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { createDecks } from '../src/server/deck/index.js';
import { createNvN } from '../src/server/nvn/index.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { poserReglages } from '../src/shared/reglages.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(25); }
  return false;
}

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql', 'souvenirs.sql',
                 'billets.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql',
                 'deck.sql', 'historique.sql', 'niveau.sql', 'kop.sql', 'amis.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}

/* HOTE suit Sion ; AMI, INCONNU et TIERS ne suivent personne. HOTE et AMI
   sont amis ; INCONNU ne l'est de personne. */
const HOTE = 'aaaa0000-0000-0000-0000-000000000001';
const AMI = 'aaaa0000-0000-0000-0000-000000000002';
const INCONNU = 'aaaa0000-0000-0000-0000-000000000003';
const TIERS = 'aaaa0000-0000-0000-0000-000000000004';
const communes = ACTIONS.filter((a) => a.rar === 'commune').map((a) => a.id);
const dix = [...communes, ...communes].slice(0, 10);
for (const [i, id] of [HOTE, AMI, INCONNU, TIERS].entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `w${i}@ex.fr`, `Attente${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,0)`, [id]);
  for (const f of ['TR32', 'MS30', 'TR33']) {
    await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [id, f]);
  }
  await raw.query(`INSERT INTO user_decks (user_id,nom,contenu) VALUES (?,?,?)`,
    [id, 'Deck', JSON.stringify({ nom: 'Deck',
      fanzzy: [{ id: 'TR32', stuff: [] }, { id: 'MS30', stuff: [] }, { id: 'TR33', stuff: [] }], actions: dix })]);
}
const [pa, pb] = HOTE < AMI ? [HOTE, AMI] : [AMI, HOTE];
await raw.query(`INSERT INTO amities (a,b,par,etat) VALUES (?,?,?,'amis')`, [pa, pb, HOTE]);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
/* HOTE et AMI suivent tous deux Sion : sans le duel privé, ils ne
   pourraient jamais jouer l'un contre l'autre. */
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1),(?,85,1)`, [HOTE, AMI]);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
/* Un match dans trois jours : de l'entraînement, où les bots viennent vite.
   C'est le cas le plus dur pour une place absente — vingt secondes. */
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
  VALUES (901,207,2026,85,91,'NS',UTC_TIMESTAMP() + INTERVAL 3 DAY)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 10, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const app = express(); const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });
io.use((s, next) => { s.data.user = { userId: s.handshake.auth.token, name: `Nom-${s.handshake.auth.token.slice(-1)}` }; next(); });
const decks = createDecks({ pool, requireAuth: (r, _s, n) => n() });
const N = createNvN({ pool, io, decks,
  requireAuth: (r, _s, n) => { r.user = { id: r.get('x-joueur') }; n(); } });
app.use('/api/nvn', N.router);
await new Promise((r) => http.listen(0, r));
const url = `http://localhost:${http.address().port}`;

const moi = (qui) => fetch(`${url}/api/nvn/moi`, { headers: { 'x-joueur': qui } }).then((x) => x.json());
const etat = (qui) => fetch(`${url}/api/nvn/etat`, { headers: { 'x-joueur': qui } }).then((x) => x.json());

function co(id) {
  const socket = client(url, { transports: ['websocket'], auth: { token: id }, reconnection: false });
  const p = { id, socket, state: null, file: null, errors: [], invites: [], horsFile: 0, attentes: [] };
  socket.on('nvn:start', (s) => { p.state = s; });
  socket.on('nvn:file', (f) => { p.file = f; });
  socket.on('nvn:error', (e) => p.errors.push(e.code));
  socket.on('nvn:invite', (d) => p.invites.push(d));
  socket.on('nvn:hors_file', () => { p.horsFile++; });
  socket.on('nvn:prive_expire', () => { p.expire = (p.expire ?? 0) + 1; });
  socket.on('nvn:attentes', (d) => { p.attentes = d?.attentes ?? []; });
  return p;
}
const connecte = (p) => until(() => p.socket.connected);


const attentes = (qui) => fetch(`${url}/api/nvn/attentes`, { headers: { 'x-joueur': qui } })
  .then((x) => x.json()).then((r) => r.attentes ?? []);

/* ------------------------------- un duel privé, à côté de la file publique */

{
  const h = co(HOTE);
  await connecte(h);
  h.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901, prive: true });
  check('le créateur entre dans son duel privé', await until(() => h.file !== null));
  check('son vestiaire le dit privé, sans rebours des bots',
    h.file?.prive === true && h.file?.botDansMs === undefined
    || (console.log('        file :', JSON.stringify(h.file)), false));
  check('il porte un code d’invitation', typeof h.file?.code === 'string');
  check('personne ne le voit dans les duels en attente',
    !(await attentes(TIERS)).some((a) => a.fixtureId === 901));
  check('/moi le lui dit privé', (await moi(HOTE)).file?.prive === true);

  const t = co(TIERS);
  await connecte(t);
  t.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901, camp: 1 });
  await until(() => t.file !== null);
  await wait(2500);
  check('un joueur de la file publique n’y tombe pas',
    t.state === null && h.state === null && t.file?.enFace === 0);
  check('il attend dans la file publique, visible de tous',
    (await attentes(INCONNU)).some((a) => a.fixtureId === 901 && a.camps[1] === 1));

  const i = co(INCONNU);
  await connecte(i);
  i.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901, camp: 0 });
  check('la file publique joue son duel à côté', await until(() => i.state && t.state));
  check('et le duel privé attend toujours', Boolean(N.placeDe(HOTE)) && h.state === null);

  /* L'ami suit Sion, comme le créateur : il prend quand même la tribune vide. */
  const a = co(AMI);
  await connecte(a);
  a.socket.emit('nvn:queue', { duel: h.file.code });
  check('le lien mène l’ami dans le duel privé, et il part',
    await until(() => a.state && h.state));
  check('l’ami du même club est en face',
    a.state?.moi?.side === 1 && h.state?.moi?.side === 0
    || (console.log('        côtés :', a.state?.moi?.side, h.state?.moi?.side), false));
  check('entre eux deux, sans bot',
    (h.state?.equipes ?? []).flat().every((p) => !String(p.userId).startsWith('bot:')));
  for (const p of [h, t, i, a]) p.socket.disconnect();
}

/* ------------------------------------ pas de bots d'office, puis il expire */

{
  const h = co(HOTE);
  await connecte(h);
  h.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901, prive: true });
  await until(() => h.file !== null);
  /* Une minute d'attente, trois fois plus que les vingt secondes d'un
     entraînement : une file publique serait partie contre des bots. */
  N.placeDe(HOTE).depuis = Date.now() - 60_000;
  await wait(4500);
  check('aucun supporter d’appoint n’entre d’office', h.state === null && Boolean(N.placeDe(HOTE)));

  poserReglages({ 'duel.attente_absent_min': 1 });
  N.placeDe(HOTE).depuis = Date.now() - 2 * 60_000;
  check('sans duel au bout du délai, il se ferme',
    await until(() => !N.placeDe(HOTE), 5000) && await until(() => h.expire === 1));
  poserReglages({});

  h.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901, prive: true });
  await until(() => Boolean(N.placeDe(HOTE)));
  h.socket.emit('nvn:entrainement');
  check('JOUER CONTRE DES BOTS reste possible', await until(() => h.state !== null, 3000)
    && h.state?.mode === 'entrainement');
  h.socket.disconnect();
}

/* ------------------------------------------ le cadenas du vestiaire */

{
  const h = co(HOTE);
  await connecte(h);
  h.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901 });
  await until(() => h.file !== null);
  check('un duel ouvert n’est pas privé', !h.file?.prive);
  h.socket.emit('nvn:prive', { prive: true });
  check('RENDRE PRIVÉ le ferme', await until(() => h.file?.prive === true));
  check('et il sort des duels en attente',
    !(await attentes(TIERS)).some((a) => a.fixtureId === 901));

  const t = co(TIERS);
  await connecte(t);
  t.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901, camp: 1 });
  await until(() => t.file !== null);
  await wait(1500);
  check('un inconnu n’y entre plus', t.state === null && h.state === null);

  h.socket.emit('nvn:prive', { prive: false });
  check('OUVRIR À TOUS le rend à la file publique, et le duel part',
    await until(() => h.state && t.state));
  const x = co(INCONNU);
  await connecte(x);
  x.socket.emit('nvn:prive', { prive: true });
  check('hors file, le cadenas ne fait rien', await until(() => x.horsFile > 0));
  for (const p of [h, t, x]) p.socket.disconnect();
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
N.stop(); io.close();
await new Promise((r) => http.close(() => r()));
await pool.end();
process.exitCode = failures ? 1 : 0;
