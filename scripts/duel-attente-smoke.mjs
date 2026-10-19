/**
 * Un duel qui attend (`src/server/nvn/index.js`, « un duel qui attend »).
 *
 * Gaël, 19 octobre 2026 : « Si le user sort de la page d'attente pour aller
 * voir autre chose, le duel reste actif mais les autres users ne voient pas
 * les duels en attente. » Et : rejoindre facilement le duel d'un ami, et
 * qu'un lien d'invitation mène droit à la page d'attente de ce duel.
 *
 * Vraie base, vraies sockets, comme `nvn:net`. Ce qui est vérifié :
 *   — quitter l'écran du duel ne retire pas la place : elle reste affichée ;
 *   — on n'apparie jamais un absent : le duel attend qu'il revienne, et
 *     `/api/nvn/moi` lui dit que quelqu'un est arrivé en face ;
 *   — revenir (`nvn:reprendre`) fait partir le duel aussitôt ;
 *   — une place absente expire après `duel.attente_absent_min` ;
 *   — le code d'invitation mène dans ce duel-là, en face ; un code inconnu
 *     se refuse avec sa raison ;
 *   — inviter un ami dans le jeu : seulement un ami mutuel, l'invitation se
 *     lit dans `/moi`, et un refus ne coûte pas sa place.
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
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [HOTE]);
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
  socket.on('nvn:attentes', (d) => { p.attentes = d?.attentes ?? []; });
  return p;
}
const connecte = (p) => until(() => p.socket.connected);

/* ------------------------------------------- partir ne retire pas la place */

let code;
{
  const h = co(HOTE);
  await connecte(h);
  h.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901 });
  check('le créateur entre en file', await until(() => h.file !== null));
  code = h.file?.code;
  check('sa file porte un code d’invitation', typeof code === 'string' && code.length >= 8);

  h.socket.disconnect();
  await wait(300);
  check('il quitte la page : sa place reste', Boolean(N.placeDe(HOTE)));
  const r = await fetch(`${url}/api/nvn/attentes`, { headers: { 'x-joueur': TIERS } }).then((x) => x.json());
  check('et les autres voient toujours le duel en attente',
    (r.attentes ?? []).some((a) => a.fixtureId === 901 && a.camps[0] === 1)
    || (console.log('        attentes :', JSON.stringify(r.attentes)), false));
  const m = await moi(HOTE);
  check('/moi lui dit que son duel attend, sans adversaire',
    m.file?.fixtureId === 901 && m.file?.absent === true && m.file?.adversaire === false
    || (console.log('        /moi :', JSON.stringify(m)), false));
  check('et /etat qu’il est en file', (await etat(HOTE)).enFile === true);
}

/* --------------------------------------- un adversaire arrive : on l'attend */

let tiers;
{
  tiers = co(TIERS);
  await connecte(tiers);
  tiers.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901, camp: 1 });
  check('un adversaire entre en face', await until(() => tiers.file !== null));
  check('il voit le créateur dans le vestiaire, marqué absent',
    tiers.file?.tribunes?.eux?.[0]?.absent === true
    || (console.log('        vestiaire :', JSON.stringify(tiers.file?.tribunes)), false));
  /* Vingt secondes en entraînement, puis les bots : un absent rappelé en a
     soixante. Trois tours de veille suffisent à voir que rien ne part. */
  await wait(6500);
  check('le duel ne part pas sans le créateur', tiers.state === null && N.salles.size === 0);
  const m = await moi(HOTE);
  check('/moi lui dit que son adversaire est là', m.file?.adversaire === true
    || (console.log('        /moi :', JSON.stringify(m)), false));
}

/* --------------------------------------------- il revient : le duel part */

{
  const h = co(HOTE);
  await connecte(h);
  h.socket.emit('nvn:reprendre');
  check('revenu sur la page, le duel part aussitôt',
    await until(() => h.state && tiers.state));
  check('dans les deux camps du match',
    h.state?.moi?.side === 0 && tiers.state?.moi?.side === 1);
  check('les deux ont quitté la file', !N.placeDe(HOTE) && !N.placeDe(TIERS));
  check('un second retour ne trouve plus de file', await (async () => {
    const h2 = co(HOTE); await connecte(h2);
    h2.socket.emit('nvn:reprendre');
    const ok = await until(() => h2.horsFile > 0);
    h2.socket.disconnect();
    return ok;
  })());
  h.socket.disconnect();
  tiers.socket.disconnect();
}

/* ------------------------------------------------- une place absente expire */

{
  const i = co(INCONNU);
  await connecte(i);
  i.socket.emit('nvn:queue', { format: '2v2', fixtureId: 901, camp: 1 });
  await until(() => i.file !== null);
  i.socket.disconnect();
  await wait(200);
  check('absent, sa place tient', Boolean(N.placeDe(INCONNU)));
  /* Le réglage au minimum, et l'absence vieillie à la main : on ne va pas
     attendre une minute. */
  poserReglages({ 'duel.attente_absent_min': 1 });
  N.placeDe(INCONNU).absentDepuis = Date.now() - 2 * 60_000;
  check('passé le délai, elle disparaît', await until(() => !N.placeDe(INCONNU), 5000));
  poserReglages({});
}

/* --------------------------------------------- le lien d'invitation */

{
  const h = co(HOTE);
  await connecte(h);
  h.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901 });
  await until(() => h.file !== null);
  const lien = h.file.code;

  const a = co(AMI);
  await connecte(a);
  a.socket.emit('nvn:queue', { duel: 'inconnu123' });
  check('un code inconnu se refuse avec sa raison',
    await until(() => a.errors.includes('ferveur.error.duel_parti')));

  a.socket.emit('nvn:queue', { duel: lien });
  check('le bon code mène dans ce duel, en face, et il part',
    await until(() => a.state && h.state)
    && a.state.fixture?.id === 901 && a.state.moi.side === 1 && h.state.moi.side === 0);
  h.socket.disconnect(); a.socket.disconnect();
}

/* ------------------------------------------------ inviter un ami du jeu */

{
  const h = co(HOTE);
  await connecte(h);
  h.socket.emit('nvn:inviter', { ami: AMI });
  check('hors file, on n’invite personne',
    await until(() => h.invites.some((d) => d.refus === 'ferveur.error.pas_en_file')));

  h.socket.emit('nvn:queue', { format: '1v1', fixtureId: 901 });
  await until(() => h.file !== null);
  h.socket.emit('nvn:inviter', { ami: INCONNU });
  check('on n’invite pas un inconnu',
    await until(() => h.invites.some((d) => d.refus === 'ferveur.error.pas_ami')));
  check('et le refus ne coûte pas sa place', Boolean(N.placeDe(HOTE)) && !h.errors.length);
  check('l’inconnu ne voit aucune invitation', (await moi(INCONNU)).invitations.length === 0);

  h.socket.emit('nvn:inviter', { ami: AMI });
  check('un ami s’invite', await until(() => h.invites.some((d) => d.ami === AMI && !d.refus)));
  const m = await moi(AMI);
  const inv = m.invitations?.[0];
  check('l’ami lit l’invitation sur la page où il est',
    inv?.code === h.file.code && inv?.de === 'Nom-1' && inv?.format === '1v1'
    || (console.log('        /moi :', JSON.stringify(m)), false));
  check('avec les clubs du match', inv?.club?.name === 'Sion' && inv?.enFaceClub?.name === 'Bâle');

  const a = co(AMI);
  await connecte(a);
  a.socket.emit('nvn:queue', { duel: inv?.code });
  check('un appui l’amène dans le duel', await until(() => a.state && h.state));
  check('et l’invitation disparaît avec la file', (await moi(AMI)).invitations.length === 0);
  h.socket.disconnect(); a.socket.disconnect();
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
N.stop(); io.close();
await new Promise((r) => http.close(() => r()));
await pool.end();
process.exitCode = failures ? 1 : 0;
