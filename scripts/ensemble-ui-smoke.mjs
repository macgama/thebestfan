/**
 * La page des amis, côté « jouer ensemble » : la fiche d'un ami et ce qu'on y
 * fait, les gestes reçus, et ce que l'amitié ouvre, dit en clair.
 *
 * Le serveur a sa suite (`ensemble:smoke`) ; on éprouve ici la page : qu'elle
 * mène à la fiche, que chaque geste y part et y est dit, et qu'elle ne lève
 * rien.
 *
 * Usage : node scripts/ensemble-ui-smoke.mjs
 *   (TBF_CAPTURE=<dossier> pour garder des captures de la fiche)
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createAmis } from '../src/server/amis/index.js';
import { createEnsemble } from '../src/server/amis/ensemble.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerSaisons } from '../src/server/fanzzy/saisons.js';
import { poserReglages, DEFAUTS } from '../src/shared/reglages.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));
const CAPTURE = process.env.TBF_CAPTURE;
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(70); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS amis_gestes, amis_cadeaux, amis_echanges, amis_prets,
  jeux_jongles, jeux_tirs, jeux_parties, jeux_tifo, jeux_boss, pronostics, parrainages, contenus,
  abonnements, achats, kop_invites, amities, saisons, kop_bulletins, kop_votes, kop_bonus, kop_membres,
  kops, reglages, admin_audit, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results,
  duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users, recompenses,
  missions_jour, compteurs_jour, user_nouveautes`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
  'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'admin.sql',
  'kop.sql', 'amis.sql', 'niveau.sql', 'bourse.sql', 'saisons.sql', 'quotidien.sql',
  'amis-ensemble.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
const A = 'aaaa0000-0000-0000-0000-00000000000a';
const B = 'bbbb0000-0000-0000-0000-00000000000b';
const NOMS = { [A]: 'Alice', [B]: 'Bruno' };
for (const [id, pseudo] of Object.entries(NOMS)) {
  await raw.query(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [id, `${pseudo}@ex.fr`, pseudo]);
  await raw.query(`INSERT INTO user_wallet (user_id, scarves, packs, active_fanzzy) VALUES (?, 0, 0, 'TR32')`,
    [id]);
}
await raw.query(`INSERT INTO amities (a, b, par, etat) VALUES (?, ?, ?, 'amis')`, [A, B, A]);
// Alice a deux Choristes ; Bruno deux Capos et un Tambour qu'Alice n'a pas.
await raw.query(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES
  (?, 'TR32', 2, 1), (?, 'TR1', 2, 2), (?, 'TR10', 1, 1)`, [A, B, B]);
// Bruno a déjà fait signe à Alice.
await raw.query(`INSERT INTO amis_gestes (de, a, geste) VALUES (?, ?, 'bravo')`, [B, A]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerSaisons(pool);
poserReglages({ ...DEFAUTS });

let moi = A;
const requireAuth = (r, _s, n) => { r.user = { id: moi }; n(); };
const ensemble = createEnsemble({ pool, requireAuth });
const amis = createAmis({ pool, requireAuth, ensemble });
const app = express();
app.use('/api/amis', amis.router);
app.use('/api/ensemble', ensemble.router);
app.get('/api/kop/miens', (_q, s) => s.json({ kops: [] }));
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: NOMS[moi] } }));
app.get('/amis', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'amis.html')));
app.use(express.static(path.join(RACINE, 'public')));
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
const erreurs = [];
async function ouvrir(chemin = '/amis') {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 400, height: 900 });
  await page.goto(base + chemin, { waitUntil: 'networkidle0' });
  await jusqua(async () => !/Chargement/.test(await texte(page)));
  return page;
}
const texte = (p) => p.evaluate(() =>
  document.getElementById('corps').textContent.replace(/\s+/g, ' ').trim());
const toucher = (p, sel) => p.evaluate((s) => document.querySelector(s)?.click(), sel);
const dernierToast = (p) => p.evaluate(() => document.getElementById('toast').textContent.trim());
const capture = async (p, nom) => {
  if (CAPTURE) await p.screenshot({ path: path.join(CAPTURE, `${nom}.png`), fullPage: true });
};
const bourse = async (id) => Number((await pool.query(
  'SELECT scarves FROM user_wallet WHERE user_id = ?', [id]))[0][0].scarves);

/* ------------------------------------------------------------ la liste */

const page = await ouvrir();
let t = await texte(page);
check('le geste reçu se voit, avec qui l’a fait', /ILS T’ONT FAIT SIGNE/.test(t) && /Bruno BRAVO/.test(t)
  || (console.log('        il y a :', t.slice(0, 200)), false));
check('ce que l’amitié ouvre est dit', /ENTRE AMIS, VOUS POUVEZ/.test(t) && /Échanger vos doubles/.test(t));
check('chaque ami porte JOUER ENSEMBLE', /JOUER ENSEMBLE/.test(t));
await capture(page, 'liste');
const vus = Number((await pool.query(`SELECT COUNT(*) n FROM amis_gestes WHERE a = ? AND vu = 0`, [A]))[0][0].n);
check('affiché, le geste est vu', await jusqua(async () => Number((await pool.query(
  `SELECT COUNT(*) n FROM amis_gestes WHERE a = ? AND vu = 0`, [A]))[0][0].n) === 0) || vus === 0);

/* ------------------------------------------------------------ la fiche */

await toucher(page, `[data-fiche="${B}"].bt`);
await jusqua(async () => /SA COLLECTION/.test(await texte(page)));
t = await texte(page);
check('JOUER ENSEMBLE ouvre sa fiche', /FAIS-LUI SIGNE/.test(t) && /LE CADEAU DU JOUR/.test(t)
  && /LE DÉFI DE LA SEMAINE/.test(t) && /SON DECK/.test(t));
check('sa collection dit ce qu’on n’a pas', /2 Fanzzy, dont 0 que tu as aussi/.test(t)
  && /TU NE L’AS PAS/.test(t) && /DOUBLE/.test(t));
await capture(page, 'fiche');

await toucher(page, '[data-geste="allez"]');
await jusqua(async () => /Geste envoyé/.test(await dernierToast(page)));
check('un geste part, et la page le dit', /Geste envoyé/.test(await dernierToast(page))
  && Number((await pool.query(`SELECT COUNT(*) n FROM amis_gestes WHERE de = ? AND geste = 'allez'`, [A]))[0][0].n) === 1);

await toucher(page, '[data-cadeau]');
await jusqua(async () => /Déjà offert/.test(await texte(page)));
check('le cadeau part, et la fiche dit qu’il est offert',
  /Déjà offert aujourd’hui/.test(await texte(page)) && await bourse(B) === DEFAUTS['amis.cadeau_echarpes']);

await toucher(page, '[data-carte="TR10"]');
await jusqua(async () => /L’EMPRUNTER/.test(await texte(page)));
await toucher(page, '[data-emprunter="TR10"]');
await jusqua(async () => /TON FANZZY EMPRUNTÉ/.test(await texte(page)));
check('un Fanzzy qu’on n’a pas s’emprunte jusqu’à minuit', /TON FANZZY EMPRUNTÉ/.test(await texte(page)));

await toucher(page, '[data-carte="TR1"]');
await jusqua(async () => /L’ÉCHANGER/.test(await texte(page)));
await toucher(page, '[data-echanger="TR1"]');
await jusqua(async () => /Contre lequel/.test(await texte(page)));
await toucher(page, '[data-donne="TR32"]');
await jusqua(async () => /ÉCHANGES EN COURS/.test(await texte(page)));
check('un double se propose contre un double', /Tu proposes/.test(await texte(page)));
await capture(page, 'fiche-apres');

await toucher(page, '[data-retour]');
await jusqua(async () => /JOUER ENSEMBLE/.test(await texte(page)));
check('on revient à la liste', /JOUER ENSEMBLE/.test(await texte(page)));

/* --------------------------------------------- de l'autre côté */

moi = B;
const chezLui = await ouvrir(`/amis?ami=${A}`);
await jusqua(async () => /SA COLLECTION/.test(await texte(chezLui)));
t = await texte(chezLui);
check('?ami= ouvre droit la fiche', /FAIS-LUI SIGNE/.test(t));
check('l’échange proposé attend sa réponse', /Alice te propose/.test(t));
await toucher(chezLui, '[data-echoui]');
await jusqua(async () => !/te propose/.test(await texte(chezLui)));
check('il l’accepte', Number((await pool.query(
  `SELECT copies FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = 'TR1'`, [A]))[0][0]?.copies) === 1);

check('aucune erreur de script', erreurs.length === 0 || (console.log('        ', erreurs), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close(); await pool.end();
process.exitCode = failures ? 1 : 0;
