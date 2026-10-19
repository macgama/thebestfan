/**
 * Le premier duel guidé (`nvn:tuto`) : un match fictif, contre un bot
 * patient, qui ne rapporte rien et ne s'écrit nulle part.
 *
 *   npm run duel-guide:smoke
 *
 * Ce qui est vérifié :
 *   — le duel part tout de suite, sans file, sur un match fictif sans
 *     identifiant, en 1v1 contre un bot, en trois minutes ;
 *   — le bot laisse le temps d'apprendre (premier chant à quinze secondes) ;
 *   — le redemander remet dans le même duel, sans en ouvrir un second ;
 *   — à la fin, le bilan part, sans écharpes, sans XP, sans ligne de
 *     résultat ;
 *   — sans deck, le serveur refuse ;
 *   — les pages : le bouton après le sachet de bienvenue, le lien de
 *     « Comment jouer », les bulles chargées par la page du duel.
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
const lire = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

/* ------------------------------------------------------------ les pages */

{
  const bienvenue = lire('public/bienvenue.html');
  check('le sachet de bienvenue finit sur JOUER MON PREMIER DUEL',
    /id="b4d">JOUER MON PREMIER DUEL</.test(bienvenue)
    && bienvenue.includes(`$('b4d').onclick = () => { location.href = '/duel-nvn?tuto=1'; };`));
  check('et garde une sortie vers l’accueil', bienvenue.includes(`$('b4').onclick = () => { location.href = '/'; };`));
  const cj = lire('public/comment-jouer.html');
  check('« Comment jouer » le propose à nouveau', cj.includes('href="/duel-nvn?tuto=1"'));
  const duel = lire('public/duel-nvn.html');
  check('la page du duel charge les bulles', duel.includes('<script src="/duel-guide.js" defer></script>'));
  check('elle reconnaît le duel guidé à son match fictif', duel.includes('S.tuto = Boolean(vue.fixture?.fictif);'));
  check('elle le lance depuis l’adresse', duel.includes("socket.emit('nvn:tuto');"));
}

/* ------------------------------------------------------------ la base */

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

const NOUVEAU = 'bbbb0000-0000-0000-0000-000000000001';
const SANS_DECK = 'bbbb0000-0000-0000-0000-000000000002';
const communes = ACTIONS.filter((a) => a.rar === 'commune').map((a) => a.id);
const dix = [...communes, ...communes].slice(0, 10);
for (const [i, id] of [NOUVEAU, SANS_DECK].entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `g${i}@ex.fr`, `Guide${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,0)`, [id]);
}
for (const f of ['TR32', 'MS30']) {
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [NOUVEAU, f]);
}
await raw.query(`INSERT INTO user_decks (user_id,nom,contenu) VALUES (?,?,?)`,
  [NOUVEAU, 'Deck', JSON.stringify({ nom: 'Deck',
    fanzzy: [{ id: 'TR32', stuff: [] }, { id: 'MS30', stuff: [] }], actions: dix })]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 10, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const app = express(); const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });
io.use((s, next) => { s.data.user = { userId: s.handshake.auth.token, name: 'Débutant' }; next(); });
const decks = createDecks({ pool, requireAuth: (r, _s, n) => n() });
const N = createNvN({ pool, io, decks,
  requireAuth: (r, _s, n) => { r.user = { id: r.get('x-joueur') }; n(); } });
app.use('/api/nvn', N.router);
await new Promise((r) => http.listen(0, r));
const url = `http://localhost:${http.address().port}`;

function co(id) {
  const socket = client(url, { transports: ['websocket'], auth: { token: id }, reconnection: false });
  const p = { socket, state: null, starts: 0, fin: null, errors: [] };
  socket.on('nvn:start', (s) => { p.state = s; p.starts++; });
  socket.on('nvn:fin', (b) => { p.fin = b; });
  socket.on('nvn:error', (e) => p.errors.push(e.code));
  return p;
}

/* --------------------------------------------------------- le duel part */

const j = co(NOUVEAU);
await until(() => j.socket.connected);
const t0 = Date.now();
j.socket.emit('nvn:tuto');
check('le duel guidé part tout de suite, sans file', await until(() => j.state, 3000));
const v = j.state ?? {};
check('sur un match fictif, sans identifiant',
  v.fixture?.fictif === true && v.fixture?.id === null
  || (console.log('        fixture :', JSON.stringify(v.fixture)), false));
check('L’Académie contre Les Anciens',
  v.fixture?.home?.name === 'L’Académie' && v.fixture?.away?.name === 'Les Anciens');
check('le joueur tient la tribune de l’Académie', v.moi?.side === 0);
const salle = [...N.salles.values()][0];
check('une seule salle, marquée guidée', N.salles.size === 1 && salle?.tuto === true);
check('en 1v1, à l’entraînement', salle?.duel.format === '1v1' && salle?.duel.mode === 'entrainement');
const bot = [...(salle?.membres.values() ?? [])].find((m) => m.bot);
check('contre un bot', Boolean(bot) && salle.duel.joueurs.size === 2);
check('qui attend quinze secondes avant son premier chant',
  bot && bot.bot.prochain - t0 >= 14_000 && bot.bot.prochain - t0 <= 16_500);
check('puis chante lentement, et rate beaucoup',
  bot?.bot.pas?.[0] >= 15_000 && bot?.bot.adresse <= 0.2);
const reste = salle ? salle.duel.fin - Date.now() : 0;
check('trois minutes, et non cinq', reste > 170_000 && reste <= 180_000);

/* ------------------------------------------- le redemander n'en ouvre pas */

j.socket.emit('nvn:tuto');
check('le redemander remet dans le même duel',
  await until(() => j.starts >= 2, 3000) && N.salles.size === 1 && j.state?.id === v.id);

/* ------------------------------------------------- la fin ne paie rien */

salle.duel.fin = Date.now() - 1;
check('à la fin, le bilan part', await until(() => j.fin, 5000));
check('sans gains', j.fin?.gains === null);
await wait(500);
const [[w]] = await pool.query(`SELECT scarves, xp FROM user_wallet WHERE user_id = ?`, [NOUVEAU]);
check('aucune écharpe, aucune XP', Number(w.scarves) === 0 && Number(w.xp) === 0);
const [res] = await pool.query(`SELECT 1 FROM duel_results WHERE user_id = ?`, [NOUVEAU]);
check('aucune ligne de résultat : l’étape « Joue un duel » reste à faire', res.length === 0);
j.socket.disconnect();

/* ------------------------------------------------------- sans deck */

const s = co(SANS_DECK);
await until(() => s.socket.connected);
s.socket.emit('nvn:tuto');
check('sans deck, le serveur refuse', await until(() => s.errors.includes('ferveur.error.no_deck'), 3000)
  || (console.log('        erreurs :', s.errors), false));
s.socket.disconnect();

for (const salle of N.salles.values()) clearInterval(salle.timer);
await pool.end();
io.close();
http.close();
console.log(failures ? `\n${failures} échec(s)` : '\ntout est vert');
process.exit(failures ? 1 : 0);
