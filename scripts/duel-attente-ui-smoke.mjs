/**
 * Un duel qui attend, dans deux vrais navigateurs (voir `duel-attente:smoke`
 * pour le serveur seul).
 *
 * Gaël, 19 octobre 2026 : quitter la page d'attente ne doit pas cacher le
 * duel ; rejoindre le duel d'un ami doit être facile ; un lien d'invitation
 * doit mener droit à la page d'attente du duel. Le parcours éprouvé :
 *
 *   1. le créateur entre en file : le vestiaire dit que le duel reste ouvert,
 *      et propose INVITER UN AMI et le lien (qui porte le code du duel) ;
 *   2. il invite son ami, puis part voir une autre page : un rappel l'y suit ;
 *   3. l'ami, sur une autre page, voit l'invitation ; REJOINDRE l'amène
 *      directement au vestiaire de ce duel, où le créateur est « rappelé » ;
 *   4. le rappel du créateur devient TON ADVERSAIRE EST LÀ ; JOUER le ramène,
 *      et le duel part pour les deux.
 *
 * `CAPTURE=<dossier>` y range les captures de chaque étape.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import puppeteer from 'puppeteer';
import { createDecks } from '../src/server/deck/index.js';
import { createNvN } from '../src/server/nvn/index.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CAPTURE = process.env.CAPTURE ?? '';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    // Une page qui navigue entre deux lectures : on relit au tour suivant.
    if (await Promise.resolve().then(fn).catch(() => false)) return true;
    await dodo(80);
  }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
                 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'duel.sql',
                 'historique.sql', 'niveau.sql', 'kop.sql', 'amis.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

/* HOTE suit Sion ; AMI ne suit personne : invité, il prend la tribune d'en
   face. Ils sont amis. */
const HOTE = '33333333-0000-0000-0000-000000000001';
const AMI = '44444444-0000-0000-0000-000000000002';
const NOMS = { [HOTE]: 'Sédunois', [AMI]: 'Copine' };
const communes = ACTIONS.filter((a) => a.rar === 'commune').map((a) => a.id);
const dix = [...communes, ...communes].slice(0, 10);
for (const [i, id] of [HOTE, AMI].entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `att${i}@ex.fr`, NOMS[id]]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,300)`, [id]);
  for (const f of ['TR32', 'MS30', 'TR33']) {
    await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [id, f]);
  }
  await raw.query(`INSERT INTO user_decks (user_id,nom,contenu,actif) VALUES (?,?,?,1)`,
    [id, 'Test', JSON.stringify({ nom: 'Test',
      fanzzy: [{ id: 'TR32', stuff: [] }, { id: 'MS30', stuff: [] }, { id: 'TR33', stuff: [] }],
      actions: dix })]);
}
const [pa, pb] = HOTE < AMI ? [HOTE, AMI] : [AMI, HOTE];
await raw.query(`INSERT INTO amities (a,b,par,etat) VALUES (?,?,?,'amis')`, [pa, pb, HOTE]);
await raw.query(`INSERT INTO teams (id,name,color1,color2) VALUES (85,'Sion','#D7141A','#F2EEE4'),
  (91,'Bâle','#C8102E','#003DA5')`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
  VALUES (7,207,2026,85,91,'1H', UTC_TIMESTAMP() - INTERVAL 20 MINUTE)`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [HOTE]);
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);
const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: true } });
const lireCookie = (entete, nom) => (entete ?? '').split(';')
  .map((c) => c.trim().split('=')).find(([k]) => k === nom)?.[1];
io.use((socket, next) => {
  const id = lireCookie(socket.handshake.headers?.cookie, 'tbf_test');
  if (!id) return next(new Error('sans identité'));
  socket.data.user = { userId: id, name: NOMS[id] ?? 'Joueur' };
  next();
});
const requireAuth = (r, s, n) => {
  const id = lireCookie(r.headers.cookie, 'tbf_test');
  if (!id) return s.status(401).json({ error: 'auth.error.unauthenticated' });
  r.user = { id };
  n();
};
const decks = createDecks({ pool, requireAuth });
const nvn = createNvN({ pool, io, decks, requireAuth });
app.use('/api/deck', decks.router);
app.use('/api/nvn', nvn.router);
app.get('/api/auth/me', requireAuth, (r, s) => s.json({ user: { id: r.user.id, pseudo: NOMS[r.user.id] } }));
// La liste d'amis telle que `amis/index.js` la sert (`tableau`), réduite à ce que lit le duel.
app.get('/api/amis', requireAuth, (r, s) => s.json({
  amis: [{ id: r.user.id === HOTE ? AMI : HOTE, pseudo: NOMS[r.user.id === HOTE ? AMI : HOTE], etat: 'amis' }],
  recues: [], envoyees: [], invitations: [] }));
app.get('/duel-nvn', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'duel-nvn.html')));
app.get('/comment-jouer', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'comment-jouer.html')));
app.use(express.static(path.join(RACINE, 'public')));
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* ------------------------------------------------------- les navigateurs */

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
async function ouvrir(userId, adresse) {
  const contexte = await nav.createBrowserContext();
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 400, height: 860 });
  await contexte.setCookie({ name: 'tbf_test', value: userId, domain: 'localhost', path: '/' });
  await page.goto(`${base}${adresse}`, { waitUntil: 'networkidle0' });
  await dodo(700);
  return { page, erreurs };
}
const capture = async (p, nom) => {
  if (CAPTURE) await p.screenshot({ path: path.join(CAPTURE, `${nom}.png`) });
};
const texte = (p, sel) => p.evaluate((s) => document.querySelector(s)?.innerText ?? '', sel);

/* 1. Le créateur entre en file. */
const H = await ouvrir(HOTE, '/duel-nvn');
await H.page.evaluate(() => entrerEnFile());
check('le vestiaire s’ouvre', await jusqua(() => H.page.evaluate(() =>
  Boolean(document.getElementById('inviterAmi')))));
check('il dit que le duel reste ouvert si l’on part',
  /reste ouvert/.test(await texte(H.page, '.ailleurs')));
const lien = await H.page.evaluate(() => lienDeMaFile(S.derniereSalle));
const code = await H.page.evaluate(() => S.derniereSalle?.code);
check('le lien d’invitation porte le code du duel',
  Boolean(code) && lien.includes(`duel=${code}`) || (console.log('        lien :', lien), false));

/* 2. Il invite son ami depuis le jeu. */
await H.page.click('#inviterAmi');
check('la liste de ses amis se déplie', await jusqua(() => H.page.evaluate(() =>
  /Copine/.test(document.querySelector('.amis-duel')?.innerText ?? ''))));
await H.page.click('[data-inviter-ami]');
check('l’ami passe à INVITÉ', await jusqua(() => H.page.evaluate(() =>
  document.querySelector('[data-inviter-ami]')?.innerText.trim() === 'INVITÉ')));
await capture(H.page, '1-vestiaire-inviter');

/* Puis il part voir une autre page. */
await H.page.goto(`${base}/comment-jouer`, { waitUntil: 'networkidle0' });
check('ailleurs, un rappel dit que son duel l’attend', await jusqua(() =>
  H.page.evaluate(() => /TON DUEL T’ATTEND/.test(
    document.querySelector('.tbf-rappel-duel')?.innerText ?? '')), 10000));
await capture(H.page, '2-rappel-duel-ouvert');

/* 3. L'ami, sur une autre page, reçoit l'invitation. */
const A = await ouvrir(AMI, '/comment-jouer');
check('l’ami voit l’invitation là où il est', await jusqua(() =>
  A.page.evaluate(() => /SÉDUNOIS T’INVITE EN DUEL/i.test(
    document.querySelector('.tbf-rappel-duel')?.innerText ?? '')), 10000));
await capture(A.page, '3-invitation-ami');
await Promise.all([
  A.page.waitForNavigation({ waitUntil: 'networkidle0' }),
  A.page.evaluate(() => document.querySelector('.tbf-rappel-duel a').click()),
]);
check('REJOINDRE l’amène directement au vestiaire de ce duel', await jusqua(() =>
  A.page.evaluate(() => /VESTIAIRE/i.test(document.getElementById('voileTitre')?.innerText ?? '')
    && document.querySelectorAll('.place-att.pris').length === 2)));
check('dans la tribune d’en face, le créateur est marqué rappelé', await jusqua(() =>
  A.page.evaluate(() => Boolean(document.querySelector('[data-tribune="eux"] .place-att.absent')))));
await capture(A.page, '4-vestiaire-de-l-ami');

/* 4. Le créateur est rappelé, revient, et le duel part. */
check('le rappel du créateur devient TON ADVERSAIRE EST LÀ', await jusqua(() =>
  H.page.evaluate(() => /TON ADVERSAIRE EST LÀ/.test(
    document.querySelector('.tbf-rappel-duel')?.innerText ?? '')), 25000));
await dodo(400);
await capture(H.page, '5-adversaire-la');
await Promise.all([
  H.page.waitForNavigation({ waitUntil: 'networkidle0' }),
  H.page.evaluate(() => document.querySelector('.tbf-rappel-duel a').click()),
]);
check('JOUER le ramène, et le duel part pour les deux', await jusqua(() => Promise.all([
  H.page.evaluate(() => document.getElementById('jeu')?.classList.contains('on')),
  A.page.evaluate(() => document.getElementById('jeu')?.classList.contains('on')),
]).then(([h, a]) => h && a), 15000));
check('l’ami joue en face du créateur', await H.page.evaluate(() => S.vue?.moi?.side) === 0
  && await A.page.evaluate(() => S.vue?.moi?.side) === 1);
await dodo(1800);
await capture(A.page, '6-duel-parti');

check('aucune erreur de script', H.erreurs.length === 0 && A.erreurs.length === 0
  || (console.log('        ', [...H.erreurs, ...A.erreurs].slice(0, 3).join(' / ')), false));

await nav.close();
nvn.stop();
io.close();
await new Promise((r) => http.close(r));
await pool.end();
console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
