/**
 * Test de l'écran d'administration du catalogue.
 *
 * Le serveur est couvert par admin-smoke ; ce qui manque, c'est l'écran lui-
 * même. C'est lui qui doit permettre d'atteindre cent cartes sans toucher au
 * code, et une liste qui ne se peuple pas, un formulaire qui ne renvoie pas ce
 * qu'on a tapé ou un refus affiché en code brut rendent l'outil inutilisable
 * sans qu'aucun test serveur ne s'en aperçoive.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createAdmin } from '../src/server/admin/index.js';
import { charger as chargerCatalogue, parIdentifiant }
  from '../src/server/fanzzy/catalogue.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users,
  admin_audit, reglages`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql',
                 'inventaire.sql', 'deck.sql', 'admin.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
// On repart d'un catalogue propre : les essais précédents laissent des ZZ.
await raw.query(`DELETE FROM fanzzy WHERE id LIKE 'ZZ%'`);

const U = 'dddddddd-0000-0000-0000-0000000000d1';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash,role)
                 VALUES (?,?,?,'x','admin')`, [U, 'admin@ex.fr', 'Patronne']);
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
await chargerCatalogue(pool);

const app = express();
// La page interroge /api/auth/me à son ouverture, et son `catch` renvoie vers
// /compte à la moindre erreur. Sans cette route, le test mesurait une page
// dont le corps avait déjà été remplacé.
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Patronne' } }));
const admin = createAdmin({ pool,
  requireAuth: (r, _s, n) => { r.user = { id: U, email: 'admin@ex.fr' }; n(); } });
app.use('/api/admin', admin.router);
app.get('/admin', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'admin.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 1100, height: 900 });
await page.goto(base + '/admin', { waitUntil: 'networkidle0' });

check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

/* ------------------------------------------------------------ la liste */

await page.evaluate(() => [...document.querySelectorAll('nav button')]
  .find((b) => /FANZZY/i.test(b.textContent))?.click());

check('la liste se peuple', await jusqua(async () =>
  await page.evaluate(() => document.querySelectorAll('#corps .fzrow').length > 20)));

const vue = await page.evaluate(() => ({
  lignes: document.querySelectorAll('#corps .fzrow').length,
  compte: document.querySelector('.compte')?.textContent.replace(/\s+/g, ' ').trim(),
  vignettes: document.querySelectorAll('#corps .fzrow img').length,
}));
check('chaque carte a sa ligne', vue.lignes >= 70);
check('le compte annonce publiées, retirées et dessinées',
  /publiées/.test(vue.compte) && /retirées/.test(vue.compte) && /dessinées/.test(vue.compte));
// La vignette est ce qui rend cent lignes lisibles : sans elle on lit des noms.
check('les Fanzzy dessinés montrent leur vignette', vue.vignettes > 40);

/* ------------------------------------------------------------ le filtre */

await page.type('#q', 'fantôme');
check('le filtre réduit la liste', await jusqua(async () =>
  await page.evaluate(() => document.querySelectorAll('#corps .fzrow').length === 1)));
check('et il trouve la bonne carte',
  /Fantôme/.test(await page.$eval('#corps .fzrow', (e) => e.textContent)));

await page.evaluate(() => { const q = document.getElementById('q'); q.value = ''; });
await page.type('#q', ' ');
await jusqua(async () => await page.evaluate(() =>
  document.querySelectorAll('#corps .fzrow').length > 20));

/* --------------------------------------------------------- la création */

await page.evaluate(() => document.getElementById('nouveau').click());
check('le formulaire de création s’ouvre',
  await page.$('#f-id') !== null && await page.$eval('#f-id', (e) => e.disabled) === false);

await page.evaluate(() => {
  document.getElementById('f-id').value = 'ZZ1';
  document.getElementById('f-nom').value = 'La Testeuse';
  document.getElementById('f-cri').value = 'ESSAI';
  document.getElementById('f-power').value = '52';
  document.getElementById('f-mods').value = '{"holdBonus":1.2}';
});
await page.evaluate(() => document.getElementById('f-ok').click());

check('la carte est créée et la liste se rafraîchit', await jusqua(async () =>
  await page.evaluate(() => [...document.querySelectorAll('#corps .fzrow')]
    .some((r) => r.textContent.includes('La Testeuse')))));
check('le serveur l’a bien enregistrée', Boolean(parIdentifiant('ZZ1')));
check('avec les effets saisis', parIdentifiant('ZZ1')?.mods?.holdBonus === 1.2);

/* ------------------------------------- un JSON fautif ne part pas au serveur */

await page.evaluate(() => {
  const l = [...document.querySelectorAll('#corps .fzrow')]
    .find((r) => r.textContent.includes('La Testeuse'));
  l.querySelector('[data-editer]').click();
});
await jusqua(async () => await page.$('#f-mods') !== null);
await page.evaluate(() => { document.getElementById('f-mods').value = '{oups'; });
await page.evaluate(() => document.getElementById('f-ok').click());
await dodo(300);
check('un JSON d’effets invalide est refusé côté écran, en clair',
  /JSON valide/.test(await page.$eval('#f-err', (e) => e.textContent)));

/* ------------------------------ un refus du serveur s’affiche en français */

await page.evaluate(() => {
  document.getElementById('f-mods').value = '{}';
  document.getElementById('f-evo').value = 'NEXISTEPAS';
});
await page.evaluate(() => document.getElementById('f-ok').click());
check('un refus du serveur est traduit, pas affiché en code', await jusqua(async () => {
  const t = await page.$eval('#f-err', (e) => e.textContent);
  return /n’existe pas/.test(t) && !/admin\.error/.test(t);
}, 4000));

/* --------------------------------------------------------- la dépublication */

await page.evaluate(() => {
  const l = [...document.querySelectorAll('#corps .fzrow')]
    .find((r) => r.textContent.includes('La Testeuse'));
  l.querySelector('[data-publier]').click();
});
check('une carte se retire des tirages depuis la liste', await jusqua(async () =>
  await page.evaluate(() => [...document.querySelectorAll('#corps .fzrow')]
    .some((r) => r.textContent.includes('La Testeuse') && r.textContent.includes('RETIRÉ')))));
check('et elle reste dans le catalogue', Boolean(parIdentifiant('ZZ1')));

// Aucun bouton de suppression : c'est délibéré, un identifiant effacé
// orphelinerait les collections de tous ceux qui possèdent la carte.
check('aucun bouton ne supprime une carte', await page.evaluate(() =>
  ![...document.querySelectorAll('#corps button')]
    .some((b) => /supprim/i.test(b.textContent))));

check('aucune erreur de script pendant toute la session', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

if (process.env.CAPTURE) {
  const { tmpdir } = await import('node:os');
  await page.screenshot({ path: path.join(tmpdir(), 'admin-fanzzy.png'), fullPage: false });
  console.log(`   capture : ${path.join(tmpdir(), 'admin-fanzzy.png')}`);
}

await nav.close();
await pool.execute(`DELETE FROM fanzzy WHERE id LIKE 'ZZ%'`);
await pool.end();
await new Promise((r) => http.close(r));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
// Pas de process.exit : voir le piège documenté dans ETAT.md.
process.exitCode = failures ? 1 : 0;
