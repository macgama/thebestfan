/**
 * Le derby automatique (`derbyPour`, `src/server/nvn/index.js`).
 *
 * Deux supporters sont en ligne en même temps, l'un suit Sion, l'autre Bâle,
 * et Sion–Bâle se joue aujourd'hui : chacun doit se voir proposer le duel.
 * Puis, quand le premier entre en file, l'autre doit lire qu'un supporter de
 * l'autre club l'attend — et le duel partir quand il entre à son tour.
 *
 * Vraie base, vraies sockets, comme `nvn:net`. Ce qui est vérifié :
 *   — la proposition va aux deux, chacun dans la tribune de son club ;
 *   — jamais qui : ni identifiant ni pseudo dans la réponse ;
 *   — personne ne se propose à soi-même, ni à un neutre, ni sur un match
 *     d'un autre jour, ni sur un match reporté ;
 *   — un joueur en file ou en duel n'est proposé à personne ;
 *   — un joueur parti depuis trop longtemps non plus.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { createDecks } from '../src/server/deck/index.js';
import { createNvN } from '../src/server/nvn/index.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
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
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql', 'souvenirs.sql',
                 'billets.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql',
                 'deck.sql', 'historique.sql', 'niveau.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}

/* Quatre joueurs : SION et BALE font le derby ; NEUTRE ne suit personne ;
   LES_DEUX suit Sion d'abord (club principal), puis Bâle. */
const SION = 'dddd0000-0000-0000-0000-000000000001';
const BALE = 'dddd0000-0000-0000-0000-000000000002';
const NEUTRE = 'dddd0000-0000-0000-0000-000000000003';
const LES_DEUX = 'dddd0000-0000-0000-0000-000000000004';
const communes = ACTIONS.filter((a) => a.rar === 'commune').map((a) => a.id);
const dix = [...communes, ...communes].slice(0, 10);
for (const [i, id] of [SION, BALE, NEUTRE, LES_DEUX].entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `d${i}@ex.fr`, `Derbyste${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,0)`, [id]);
  for (const f of ['TR32', 'MS30', 'TR33']) {
    await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [id, f]);
  }
  await raw.query(`INSERT INTO user_decks (user_id,nom,contenu) VALUES (?,?,?)`,
    [id, 'Deck', JSON.stringify({ nom: 'Deck',
      fanzzy: [{ id: 'TR32', stuff: [] }, { id: 'MS30', stuff: [] }, { id: 'TR33', stuff: [] }], actions: dix })]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle'),(77,'Lugano')`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1),(?,91,1)`, [SION, BALE]);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main,created_at)
  VALUES (?,85,1,NOW() - INTERVAL 1 DAY),(?,91,0,NOW())`, [LES_DEUX, LES_DEUX]);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
/* Le derby du jour (900), plus tard dans la journée UTC si possible : un
   coup d'envoi « maintenant » tombe toujours aujourd'hui. Le même derby dans
   trois jours (901, entraînement) et un Sion–Lugano reporté (902) ne doivent
   jamais être proposés. */
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
  VALUES (900,207,2026,85,91,'NS',UTC_TIMESTAMP()),
         (901,207,2026,91,85,'NS',UTC_TIMESTAMP() + INTERVAL 3 DAY),
         (902,207,2026,85,77,'PST',UTC_TIMESTAMP())`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 10, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const app = express(); const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });
io.use((s, next) => { s.data.user = { userId: s.handshake.auth.token, name: 'J' }; next(); });
const decks = createDecks({ pool, requireAuth: (r, _s, n) => n() });
/* Le lecteur est dans l'en-tête : chaque lecture du panneau est celle d'un
   joueur différent, comme sur le jeu. */
const N = createNvN({ pool, io, decks,
  requireAuth: (r, _s, n) => { r.user = { id: r.get('x-joueur') }; n(); } });
app.use('/api/nvn', N.router);
await new Promise((r) => http.listen(0, r));
const url = `http://localhost:${http.address().port}`;

const lire = (qui) => fetch(`${url}/api/nvn/attentes`, { headers: { 'x-joueur': qui } })
  .then((x) => x.json());

/* ---------------------------------------------------- seul, rien à proposer */

{
  const r = await lire(SION);
  check('seul en ligne, aucun derby', r.derby === null);
  check('et le panneau des files répond comme avant',
    Array.isArray(r.attentes) && r.alerte === null);
}

/* -------------------------------------------- un neutre ne fait pas de derby */

{
  await lire(NEUTRE);
  const r = await lire(SION);
  check('un neutre en ligne ne fait pas de derby', r.derby === null);
  check('et le neutre n’en reçoit pas', (await lire(NEUTRE)).derby === null);
}

/* ------------------------------------------- les deux clubs : le derby du jour */

{
  const b = await lire(BALE);
  check('le supporter de Bâle se voit proposer le derby',
    b.derby?.fixtureId === 900 || (console.log('        il reçoit :', JSON.stringify(b.derby)), false));
  check('dans la tribune de son club, à l’extérieur', b.derby?.monCamp === 1);
  check('en 1v1, classé', b.derby?.format === '1v1' && b.derby?.mode === 'classe');
  check('avec les deux clubs nommés',
    b.derby?.clubs?.[0]?.name === 'Sion' && b.derby?.clubs?.[1]?.name === 'Bâle');

  const s = await lire(SION);
  check('et celui de Sion aussi, chez lui', s.derby?.fixtureId === 900 && s.derby?.monCamp === 0);

  const tout = JSON.stringify([b, s]);
  check('jamais qui : ni identifiant ni pseudo',
    !tout.includes(SION) && !tout.includes(BALE) && !tout.includes('Derbyste'));
  check('jamais le match d’un autre jour, jamais un match reporté',
    !tout.includes('"fixtureId":901') && !tout.includes('"fixtureId":902'));
}

/* ------------------------------ qui suit les deux clubs est chez son principal */

{
  const r = await lire(LES_DEUX);
  check('qui suit les deux clubs est chez son club principal',
    r.derby?.fixtureId === 900 && r.derby?.monCamp === 0
    || (console.log('        il reçoit :', JSON.stringify(r.derby)), false));
}

/* --------------------- le premier appuie : l'autre lit qu'on l'attend, et joue */

function co(id) {
  const socket = client(url, { transports: ['websocket'], auth: { token: id }, reconnection: false });
  const p = { socket, file: null, state: null, errors: [] };
  socket.on('nvn:file', (f) => { p.file = f; });
  socket.on('nvn:start', (s) => { p.state = s; });
  socket.on('nvn:error', (e) => p.errors.push(e.code));
  return p;
}

const S = co(SION);
const B = co(BALE);
check('sockets connectées', await until(() => S.socket.connected && B.socket.connected));

S.socket.emit('nvn:queue', { format: '1v1', fixtureId: 900, camp: 0 });
check('le supporter de Sion entre en file', await until(() => S.file !== null));

{
  /* LES_DEUX, chez Sion lui aussi, est parti entre-temps : sans quoi il
     resterait, à juste titre, un derby à proposer au Bâlois. */
  N.guetteurs.get(LES_DEUX).vu -= 5 * 60_000;
  const s = await lire(SION);
  check('en file, on ne lui propose plus de derby', s.derby === null);

  const b = await lire(BALE);
  check('celui de Bâle ne reçoit plus une proposition…', b.derby === null);
  check('…mais une attente : un supporter de Sion l’attend',
    b.alerte?.fixtureId === 900 && b.alerte?.derby === true && b.alerte?.monCamp === 1
    || (console.log('        il reçoit :', JSON.stringify(b.alerte)), false));
  check('et sa place est la sienne, celle qui manque', b.alerte?.campQuiManque === 1);

  const n = await lire(NEUTRE);
  check('un neutre voit l’attente, pas un derby',
    n.alerte?.fixtureId === 900 && !n.alerte?.derby);
}

B.socket.emit('nvn:queue', { format: '1v1', fixtureId: 900, camp: 1 });
check('le derby part quand il entre', await until(() => S.state && B.state));
check('Sion contre Bâle, chacun chez soi',
  S.state?.moi?.side === 0 && B.state?.moi?.side === 1);
check('sans erreur', !S.errors.length && !B.errors.length
  || (console.log('        erreurs :', S.errors, B.errors), false));

{
  const r = await lire(LES_DEUX);
  check('en duel, ils ne sont proposés à personne', r.derby === null);
}

/* ------------------------------------------- parti depuis trop longtemps */

{
  /* Sion et Bâle sont en duel : on prend LES_DEUX, chez Sion, et un Bâlois
     tout neuf, dont on vieillit ensuite la marque de cinq minutes. */
  const raw2 = await mysql.createConnection({ uri: DB });
  const BALE2 = 'dddd0000-0000-0000-0000-000000000005';
  await raw2.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [BALE2, 'd5@ex.fr', 'Derbyste5']);
  await raw2.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,91,1)`, [BALE2]);
  await raw2.end();

  await lire(BALE2);
  check('un Bâlois tout juste arrivé fait un derby',
    (await lire(LES_DEUX)).derby?.fixtureId === 900);
  N.guetteurs.get(BALE2).vu -= 5 * 60_000;
  check('parti depuis cinq minutes, il n’en fait plus', (await lire(LES_DEUX)).derby === null);
}

S.socket.close(); B.socket.close();
N.stop();
io.close();
http.close();
await pool.end();
console.log(failures ? `\n${failures} échec(s)` : '\ntout est vert');
process.exit(failures ? 1 : 0);
