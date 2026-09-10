/**
 * Test de la page /kop, dans un vrai navigateur.
 *
 * Quatre gestes : créer, rejoindre, voir le pot, voter. Ils passent tous par
 * le serveur, et `kop-smoke` les éprouve déjà de ce côté-là. Ce qui se vérifie
 * **ici et nulle part ailleurs**, c'est que la page les rende praticables :
 *
 *   - qu'un club sans KOP propose d'en créer un plutôt que de ne rien dire ;
 *   - que le pot se lise d'un coup d'œil, avec ce qui manque pour le prochain
 *     bonus — un chiffre brut ne donne envie de rien ;
 *   - que le **compte à rebours** du vote tourne. Trois minutes, c'est court :
 *     un chrono figé fait voter après la clôture, et le joueur ne comprend pas
 *     pourquoi son clic n'a rien fait ;
 *   - qu'un bonus hors de prix soit désactivé plutôt que refusé après coup.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createKop } from '../src/server/kop/index.js';
import { BONUS_PAR_ID } from '../src/shared/kop.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(80); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops,
  user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
  souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
  duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
  leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'souvenirs.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'kop.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = ['1', '2'].map((i) => `pppppppp-0000-0000-0000-00000000000${i}`);
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `p${i}@ex.fr`, `Kopiste${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves,onboarded_at) VALUES (?,0,NOW(3))`, [id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
// Le premier suit deux clubs : un avec KOP, un sans. La page doit montrer les
// deux situations en même temps, c'est là qu'elle peut se tromper.
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES
  (?,85,1), (?,91,0), (?,85,1)`, [U[0], U[0], U[1]]);
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
let moi = U[0];
const requireAuth = (r, _s, n) => { r.user = { id: moi }; n(); };
const K = createKop({ pool, requireAuth });

const app = express();
app.use('/api/kop', K.router);
// L'état du joueur donne les clubs suivis : la page en a besoin pour savoir
// lesquels n'ont pas encore de KOP. La vraie route est éprouvée ailleurs.
app.get('/api/me/state', async (_q, s) => {
  const [rows] = await pool.query(
    `SELECT f.team_id, t.name FROM user_follows f JOIN teams t ON t.id = f.team_id
      WHERE f.user_id = ?`, [moi]);
  s.json({ follows: rows.map((r) => ({ team_id: r.team_id, name: r.name })) });
});
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Kopiste0' } }));
app.get('/kop', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'kop.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
async function ouvrir() {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 400, height: 900 });
  await page.goto(base + '/kop', { waitUntil: 'networkidle0' });
  await jusqua(async () => await page.$('[data-nouveau], [data-ouvrir]') !== null);
  return page;
}

const texte = (page) => page.evaluate(() =>
  document.getElementById('corps').textContent.replace(/\s+/g, ' '));

/* ------------------------------------------------- un club sans KOP */

let page = await ouvrir();
check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

let t = await texte(page);
check('les deux clubs suivis sont proposés', /Sion/.test(t) && /Bâle/.test(t));
check('et ils sont annoncés sans KOP', /sans KOP/.test(t));
check('deux boutons de création', (await page.$$('[data-nouveau]')).length === 2);

/* -------------------------------------------------------------- créer */

await page.evaluate(() =>
  document.querySelector('[data-nouveau]')?.click());
await dodo(300);
await page.type('input.champ', 'Le Virage Nord');
await page.evaluate(() => document.querySelector('[data-creer]')?.click());
await jusqua(async () => /Le Virage Nord/.test(await texte(page)));

t = await texte(page);
check('le KOP créé apparaît dans « mes KOP »', /MES KOP/.test(t) && /Le Virage Nord/.test(t));
check('il s’ouvre tout seul après la création',
  (await page.$$('[data-proposer]')).length > 0);
check('et le club restant est toujours proposé', /sans KOP/.test(t));

const kopId = await page.evaluate(() =>
  document.querySelector('[data-quitter]')?.dataset.quitter);
check('le KOP a bien un identifiant', Boolean(kopId));

/* ------------------------------------------------------- voir le pot */

check('le pot est affiché', /DANS LE POT/.test(t));
check('et ce qui manque pour le prochain bonus est chiffré',
  /écharpes avant/.test(t));
check('un bonus hors de prix est désactivé plutôt que refusé après coup',
  await page.evaluate(() =>
    [...document.querySelectorAll('[data-proposer]')].every((b) => b.disabled)));

/* ------------------------------------------------------------ voter */

const CORDE = BONUS_PAR_ID.get('corde');
await pool.query('UPDATE kops SET pot = ? WHERE id = ?', [CORDE.prix + 50, kopId]);
await page.reload({ waitUntil: 'networkidle0' });
await jusqua(async () => await page.$('[data-ouvrir]') !== null);
await page.evaluate(() => document.querySelector('[data-ouvrir]')?.click());
await jusqua(async () => (await page.$$('[data-proposer]')).length > 0);

check('avec un pot suffisant, le bonus devient proposable',
  await page.evaluate(() =>
    document.querySelector('[data-proposer="corde"]')?.disabled === false));

await page.evaluate(() => document.querySelector('[data-proposer="corde"]')?.click());
await jusqua(async () => await page.$('[data-chrono]') !== null);

t = await texte(page);
check('le vote s’ouvre et il est nommé', /VOTE EN COURS/.test(t) && /La corde tient/.test(t));
check('celui qui propose est déjà « pour »',
  await page.evaluate(() =>
    document.querySelector('[data-pour="1"]')?.classList.contains('on') === true));
check('le créateur est prévenu que ses voix comptent cinq fois',
  /cinq voix/.test(t));

/* Le compte à rebours. Trois minutes, c'est court : un chrono figé fait voter
   après la clôture, et le clic ne fait rien sans que rien ne l'explique. */
const t0 = await page.$eval('[data-chrono]', (n) => n.textContent);
await dodo(2200);
const t1 = await page.$eval('[data-chrono]', (n) => n.textContent);
check(`le compte à rebours tourne (${t0} → ${t1})`, t0 !== t1);

// Changer d'avis : trois minutes, c'est la durée d'une discussion.
await page.evaluate(() => document.querySelector('[data-pour="0"]')?.click());
await jusqua(async () => await page.evaluate(() =>
  document.querySelector('[data-pour="0"]')?.classList.contains('on') === true));
check('on peut passer son bulletin de « pour » à « contre »',
  await page.evaluate(() =>
    document.querySelector('[data-pour="0"]')?.classList.contains('on') === true
    && document.querySelector('[data-pour="1"]')?.classList.contains('on') === false));

/* ---------------------------------------------------------- rejoindre

   Le second joueur suit Sion et n'a pas de KOP : la page doit lui proposer
   celui qui existe, avant de lui proposer d'en créer un.                    */

moi = U[1];
const page2 = await ouvrir();
t = await texte(page2);
check('un KOP existant est proposé à qui n’en a pas',
  /Des KOP existent déjà/.test(t) && /Le Virage Nord/.test(t));
check('avec son nombre de membres', /1 membre/.test(t));

await page2.evaluate(() => document.querySelector('[data-rejoindre]')?.click());
await jusqua(async () => /MES KOP/.test(await texte(page2)));
check('rejoindre marche', /MES KOP/.test(await texte(page2)));
check('et il n’est plus proposé à la création',
  !/Des KOP existent déjà/.test(await texte(page2)));

const membres = (await K.etat(kopId, U[1])).membres.length;
check(`le KOP compte deux membres (${membres})`, membres === 2);

check('aucune erreur de script sur toute la session', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close();
http.close();
await pool.end();
process.exitCode = failures ? 1 : 0;
