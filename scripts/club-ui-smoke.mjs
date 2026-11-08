/**
 * La page d'un club, « Le stade du club » (choix de Gaël, 7 novembre 2026) :
 * l'API `/api/club/:id` et la page `/club/:id` dans un vrai navigateur.
 *
 * Ce qui s'y joue :
 *   — le haut : nom, rang au championnat TBFO, quatre chiffres (fans,
 *     Fanzzy liés, duels, Virages gagnés), la forme TBFO ;
 *   — le prochain match (ici, celui qui se joue) avec son score TBFO, les
 *     points en jeu et FAIS PENCHER LA BALANCE vers le duel de ce match ;
 *   — les trois onglets : TRIBUNE, LE VRAI CLUB, FANZZY ;
 *   — un club inconnu : 404, et une phrase sur la page.
 *
 * `CAPTURES=<dossier>` garde des captures (téléphone et ordinateur).
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createClassements } from '../src/server/classements/index.js';
import { createClub } from '../src/server/club/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

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

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, recompenses, missions_jour, compteurs_jour, user_nouveautes,
  saisons, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, virage_tribunes, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql',
  'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'admin.sql',
  'kop.sql', 'niveau.sql', 'billets.sql', 'saisons.sql', 'historique.sql', 'abonnement.sql',
  'quotidien.sql', 'virage-tribunes.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
await raw.query('DELETE FROM saisons');
await raw.query(`INSERT INTO saisons (id, numero, nom, series, tenues, lancee_a)
  VALUES (1, 1, 'La reprise', JSON_ARRAY('RP', 'AN'), JSON_ARRAY(), NOW(3) - INTERVAL 10 DAY)`);
/* La BASE ouvre RP et AN (Les Terraces, Premier League), comme en production ;
   DIE KURVE (Super League, PASS 1) reste fermée : son club dit « BIENTÔT ». */

/* Arsenal (42) : la lignée AN1, AN21, AN41 lui est liée d'office. */
await raw.query(`INSERT INTO leagues (id,name,country,type,current_season) VALUES (39,'Premier League','England','League',2026)`);
await raw.query(`INSERT INTO teams (id,name,country,logo,founded,color1,color2) VALUES
  (42,'Arsenal','England','',1886,'#ef0107','#ffffff'),(66,'Aston Villa','England','',1874,'#670e36','#95bfe5'),
  (49,'Chelsea','England','',1905,NULL,NULL)`);
await raw.query(`INSERT INTO team_leagues (team_id,league_id,season) VALUES (42,39,2026),(66,39,2026),(49,39,2026)`);
await raw.query(`INSERT INTO leagues (id,name,country,type,current_season) VALUES (207,'Super League','Switzerland','League',2026)`);
await raw.query(`INSERT INTO teams (id,name,country,logo,founded,color1,color2) VALUES (551,'FC Basel','Switzerland','',1893,'#e2001a','#0033a0')`);
await raw.query(`INSERT INTO team_leagues (team_id,league_id,season) VALUES (551,207,2026)`);
await raw.query(`INSERT INTO standings (league_id,season,team_id,\`rank\`,points,played,win,draw,lose,goals_for,goals_against,form)
  VALUES (39,2026,42,2,24,11,7,3,1,21,8,'WWDWL'),(39,2026,66,5,19,11,5,4,2,15,11,'WDDWW'),(39,2026,49,4,20,11,6,2,3,18,12,'LWWDW')`);
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,home_goals,away_goals,status_short,elapsed,kickoff_at,venue) VALUES
  (9001,39,2026,42,49,2,0,'FT',90,UTC_TIMESTAMP() - INTERVAL 2 DAY,'Emirates Stadium'),
  (9002,39,2026,42,66,1,1,'2H',67,UTC_TIMESTAMP() - INTERVAL 70 MINUTE,'Emirates Stadium'),
  (9003,39,2026,66,49,NULL,NULL,'NS',NULL,UTC_TIMESTAMP() + INTERVAL 3 DAY,'Villa Park')`);

const ID = (n) => `c${String(n).padStart(7, '0')}-0000-0000-0000-000000000000`;
const gens = [[1, 'Gael', 42], [2, 'NordBank', 42], [3, 'Kurve_K', 42], [4, 'Villan', 66], [5, 'Blue', 49]];
for (const [n, pseudo, club] of gens) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`, [ID(n), `c${n}@ex.fr`, pseudo]);
  await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,?,1)`, [ID(n), club]);
}
await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,stage) VALUES (?, 'AN1', 2)`, [ID(1)]);
/* Un duel, ses deux lignes ; `ilya` en minutes. */
let d = 0;
async function duel(fixture, gagnant, perdant, sideGagnant, ilya) {
  const id = `cd-${++d}`;
  for (const [u, issue, side] of [[gagnant, 'win', sideGagnant], [perdant, 'loss', 1 - sideGagnant]]) {
    await raw.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,fixture_id,ferveur,mode,side,ended_at)
      VALUES (?,?,'x',?,?,200,'classe',?,NOW(3) - INTERVAL ? MINUTE)`, [id, ID(u), issue, fixture, side, ilya]);
  }
}
// 9001, fini il y a deux jours : Arsenal gagne 2–1 aux duels, et le Virage.
await duel(9001, 1, 5, 0, 2 * 24 * 60 - 30);
await duel(9001, 2, 5, 0, 2 * 24 * 60 - 40);
await duel(9001, 5, 3, 1, 2 * 24 * 60 - 50);
await raw.query(`INSERT INTO virage_tribunes (fixture_id,buts_dom,buts_ext) VALUES (9001,3,1)`);
await raw.query(`INSERT INTO virage_presence (user_id,fixture_id,side,ferveur,classe,team_id) VALUES (?,9001,0,500,1,42)`, [ID(1)]);
// 9002, en cours : Arsenal mène 2–1 aux duels.
await duel(9002, 1, 4, 0, 20);
await duel(9002, 3, 4, 0, 10);
await duel(9002, 4, 2, 1, 5);
const KOP = 'cccc0000-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO kops (id,team_id,nom,createur) VALUES (?,42,'North Bank 88',?)`, [KOP, ID(2)]);
await raw.query(`INSERT INTO kop_membres (kop_id,user_id,team_id) VALUES (?,?,42),(?,?,42)`, [KOP, ID(2), KOP, ID(1)]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);
let moi = ID(1);
const classements = createClassements({ pool, requireAuth: (r, _s, n) => { r.user = { id: moi }; n(); } });
const app = express();
app.use((req, _res, next) => { if (moi) req.user = { id: moi }; next(); });
app.use('/api/rank', classements.router);
const club = createClub({ pool, classements });
app.use('/api/club', club.router);
app.get('/club/:id', (_req, res) => res.sendFile(path.join(RACINE, 'public', 'club.html')));
app.get('/tbfo/:id', (_req, res) => res.sendFile(path.join(RACINE, 'public', 'tbfo.html')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'absent' }));
app.use(express.static(path.join(RACINE, 'public')));
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- l'API */
let r = await (await fetch(`${base}/api/club/42`)).json();
check('le club est servi', r.team?.name === 'Arsenal' && r.team.couleurs?.[0] === '#ef0107');
check('ses fans', r.fans === 3);
check('ses trois Fanzzy liés d’office', r.fanzzy?.lies?.map((f) => f.id).join() === 'AN1,AN21,AN41'
  || (console.log('        lies :', JSON.stringify(r.fanzzy)), false));
check('et ceux que je possède', r.moi?.fanzzy?.AN1 === 2 && r.moi.principal === true);
check('son bilan TBFO de la saison : 9001 gagné 2–1, et le Virage',
  r.tbfo?.joues === 1 && r.tbfo.gagnes === 1 && r.tbfo.points === 5 && r.tbfo.virages === 1
  || (console.log('        tbfo :', JSON.stringify(r.tbfo)), false));
check('ses duels de la saison, match en cours compris', r.tbfo?.duels === 6 && r.tbfo.duelsGagnes === 4);
check('son rang au championnat TBFO de son championnat',
  r.tbfo?.rang?.position === 1 && r.tbfo.rang.ligue?.id === 39
  || (console.log('        rang :', JSON.stringify(r.tbfo?.rang)), false));
check('sa forme TBFO', r.tbfo?.forme?.join() === 'V');
check('le match qui se joue, avec son score TBFO en direct',
  r.prochain?.id === 9002 && r.prochain.tbfo?.score?.join() === '2,1' && r.prochain.tbfo.direct === true
  && r.prochain.tbfo.points?.join() === '3,0'
  || (console.log('        prochain :', JSON.stringify(r.prochain)), false));
check('ses meilleurs fans de la saison', r.meilleursFans?.length >= 1 && r.meilleursFans[0].pseudo === 'Gael'
  || (console.log('        fans :', JSON.stringify(r.meilleursFans)), false));
check('ses KOP', r.kops?.[0]?.nom === 'North Bank 88' && r.kops[0].membres === 2);
check('le vrai club : classement et forme réels',
  r.vrai?.classement?.rang === 2 && r.vrai.classement.sur === 3 && r.vrai.classement.forme === 'WWDWL');
check('le cri du club', typeof r.cri === 'string' && r.cri.length > 0);
let st = (await fetch(`${base}/api/club/4242`)).status;
check('un club inconnu : 404', st === 404);
st = (await fetch(`${base}/api/club/abc`)).status;
check('un identifiant qui n’en est pas un : 400', st === 400);

/* Sans compte : la page se lit aussi, sans « moi ». */
moi = null;
r = await (await fetch(`${base}/api/club/42`)).json();
check('sans compte, le club se lit, sans ce qui est à moi', r.team?.name === 'Arsenal' && r.moi === null);
moi = ID(1);

/* ------------------------------------- les écharpes d'un match TBFO
   (choix de Gaël, 7 novembre 2026 : victoire 20, nul 5, Virage +10). */
{
  const pq = async (sql, p = []) => (await pool.query(sql, p))[0];
  await pq(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,home_goals,away_goals,status_short,elapsed,kickoff_at) VALUES
    (9004,39,2026,42,66,0,0,'FT',90,UTC_TIMESTAMP() - INTERVAL 1 DAY),
    (9005,39,2026,49,66,1,0,'FT',90,UTC_TIMESTAMP() - INTERVAL 1 DAY),
    (9006,39,2026,42,49,3,0,'FT',90,UTC_TIMESTAMP() - INTERVAL 6 DAY)`);
  const conn = await mysql.createConnection({ uri: DB });
  const ajouter = async (fixture, gagnant, perdant, sideGagnant, ilya) => {
    const id = `cd-${++d}`;
    for (const [u, issue, side] of [[gagnant, 'win', sideGagnant], [perdant, 'loss', 1 - sideGagnant]]) {
      await conn.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,fixture_id,ferveur,mode,side,ended_at)
        VALUES (?,?,'x',?,?,200,'classe',?,NOW(3) - INTERVAL ? MINUTE)`, [id, ID(u), issue, fixture, side, ilya]);
    }
  };
  // 9004 : 1–1 aux duels, nul (NordBank pour Arsenal, Villan pour Aston Villa).
  await ajouter(9004, 2, 4, 0, 24 * 60 - 30);
  await ajouter(9004, 4, 2, 1, 24 * 60 - 40);
  // 9005 : aucun duel, Aston Villa (extérieur) gagne la corde : Villan était au Virage.
  await conn.query(`INSERT INTO virage_tribunes (fixture_id,buts_dom,buts_ext) VALUES (9005,0,2)`);
  await conn.query(`INSERT INTO virage_presence (user_id,fixture_id,side,ferveur,classe,team_id) VALUES (?,9005,1,300,1,66)`, [ID(4)]);
  // 9006 : gagné il y a six jours, trop vieux pour être payé.
  await ajouter(9006, 1, 5, 0, 6 * 24 * 60 - 30);
  await conn.end();

  const bourse = async (n) => Number((await pq('SELECT scarves FROM user_wallet WHERE user_id = ?', [ID(n)]))[0]?.scarves ?? 0);
  const lire = async (n) => { moi = ID(n); const j = await (await fetch(`${base}/api/club/victoires`)).json(); return j.victoires ?? []; };
  const avant1 = await bourse(1);
  const matchsDe = (l) => l.filter((x) => x.type === 'match');
  let v = matchsDe(await lire(1));
  check('Gael : 9001 gagné aux duels et au Virage, 20 + 10 écharpes',
    v.length === 1 && v[0].match === 9001 && v[0].echarpes === 30 && v[0].issue === 'V' && v[0].viragegagne
    && v[0].club.name === 'Arsenal' && v[0].adverse.name === 'Chelsea' && v[0].score.join() === '2,1'
    || (console.log('        v :', JSON.stringify(v)), false));
  /* L'homme du match (Gaël, 8 novembre 2026) : sur 9001, Gael, NordBank et
     Blue ont gagné un duel chacun ; Gael départage par sa ferveur au Virage. */
  const tout1 = await lire(1);
  const hdm = tout1.find((x) => x.type === 'hdm');
  check('Gael, homme du match de 9001 : 15 écharpes de plus et le titre',
    hdm?.match === 9001 && hdm.echarpes === 15 && hdm.gagnes === 1 && hdm.club?.name === 'Arsenal'
    && (await pq(`SELECT titre FROM recompenses WHERE source='tbfo-hdm' AND cle='9001' AND user_id=?`, [ID(1)]))[0]?.titre === 'Homme du match TBFO'
    || (console.log('        hdm :', JSON.stringify(tout1)), false));
  check('versées dans la bourse', (await bourse(1)) - avant1 === 45
    || (console.log('        bourse :', avant1, await bourse(1)), false));
  v = matchsDe(await lire(1));
  check('une seule fois : relu, rien de plus, la fête reste à montrer', v.length === 1
    && (await bourse(1)) - avant1 === 45);
  check('un seul homme du match par match', (await pq(`SELECT COUNT(*) AS n FROM recompenses WHERE source='tbfo-hdm' AND cle='9001'`))[0].n == 1);
  check('le match en cours (9002) et le match trop vieux (9006) ne paient pas',
    !(await pq(`SELECT 1 FROM recompenses WHERE source='tbfo' AND cle IN ('9002','9006')`)).length);
  v = matchsDe(await lire(3));
  check('Kurve_K a perdu son duel, mais sa tribune a gagné : 30 aussi', v.find((x) => x.match === 9001)?.echarpes === 30);
  v = await lire(2);
  check('NordBank, homme du match de 9004 (sa victoire est la première)',
    v.find((x) => x.type === 'hdm')?.match === 9004 || (console.log('        v :', JSON.stringify(v)), false));
  v = matchsDe(v);
  check('NordBank : 30 pour 9001, 5 pour le nul de 9004',
    v.find((x) => x.match === 9001)?.echarpes === 30 && v.find((x) => x.match === 9004)?.echarpes === 5
    && v.find((x) => x.match === 9004)?.issue === 'N' || (console.log('        v :', JSON.stringify(v)), false));
  v = await lire(4);
  check('Villan, à égalité de duels gagnés sur 9004, n’est pas homme du match', !v.some((x) => x.type === 'hdm'));
  v = matchsDe(v);
  check('Villan : 5 pour le nul de 9004, 10 pour le Virage gagné de 9005 sans duel',
    v.find((x) => x.match === 9004)?.echarpes === 5 && v.find((x) => x.match === 9005)?.echarpes === 10
    && v.find((x) => x.match === 9005)?.issue === null || (console.log('        v :', JSON.stringify(v)), false));
  v = await lire(5);
  check('Blue, tribune battue aux duels et au Virage : rien', v.length === 0);
  moi = null;
  st = (await fetch(`${base}/api/club/victoires`)).status;
  check('sans compte : 401', st === 401);
  moi = ID(1);
}

/* ----------------------------------------------------------- la page */
const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 900 });
await page.goto(`${base}/club/42`, { waitUntil: 'domcontentloaded' });
check('la page se dessine', await jusqua(() => page.$eval('#page', (n) => n.textContent.includes('ARSENAL')
  || n.querySelector('h1')?.textContent === 'Arsenal').catch(() => false)));
const txt = async (sel) => page.$eval(sel, (n) => n.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
check('le nom du club en grand', (await txt('.blason h1')) === 'Arsenal');
check('son rang TBFO en plaque', (await txt('.rang')).startsWith('1er'));
check('TON CLUB, quand c’est le mien', (await txt('.toi')) === 'TON CLUB');
check('les quatre chiffres', /^3\s*FANS 3\s*FANZZY LIÉS 6\s*DUELS 1\s*VIRAGES? GAGNÉS?$/.test(await txt('.stats'))
  || (console.log('        stats :', await txt('.stats')), false));
check('la forme TBFO', (await txt('.forme')).endsWith('V'));
check('le match en cours et son score TBFO', /2 – 1/.test(await txt('.prochain .sc'))
  && /EN DIRECT/.test(await txt('.prochain .quand')));
check('ce que vaudrait la fin du match', /Arsenal \+3 · Aston Villa \+0/.test(await txt('.prochain .enjeu'))
  || (console.log('        enjeu :', await txt('.prochain .enjeu')), false));
check('FAIS PENCHER LA BALANCE mène au duel du match, tribune du club',
  await page.$eval('.pousser', (a) => a.getAttribute('href')) === '/duel-nvn?match=9002&amp;camp=0'
  || await page.$eval('.pousser', (a) => a.getAttribute('href')) === '/duel-nvn?match=9002&camp=0');
check('et le Virage du match qui se joue', await page.$eval('.boutons .virage', (a) => a.getAttribute('href')) === '/virage?match=9002');
check('TRIBUNE : le podium des fans', /Gael/.test(await txt('.podium')));
check('TRIBUNE : le championnat TBFO, le club en surbrillance', /Arsenal/.test(await txt('tr.moi')));
check('TRIBUNE : les clubs voisins mènent à leur page',
  (await page.$$eval('#onglet td a', (l) => l.map((a) => a.getAttribute('href')))).every((h) => /^\/club\/\d+$/.test(h)));
check('TRIBUNE : les KOP du club', /North Bank 88/.test(await txt('.kops')));
await page.click('.onglets [data-o=vrai]');
check('LE VRAI CLUB : le classement réel', await jusqua(async () => /2e sur 3 · 24 PTS/.test(await txt('#onglet'))));
check('LE VRAI CLUB : fondé en', /Fondé en\s*1886/.test(await txt('#onglet')));
await page.click('.onglets [data-o=fanzzy]');
check('FANZZY : les trois Fanzzy liés, un à moi', await jusqua(async () =>
  (await page.$$('.fzc')).length === 3 && (await page.$$('.fzc.non')).length === 2));
/* Gaël, 8 novembre 2026 : les Fanzzy d'une série pas encore ouverte ne se
   montrent pas, on les croirait disponibles. */
const bale = await (await fetch(`${base}/api/club/551`)).json();
check('un club de série fermée : « BIENTÔT », avec le numéro du PASS',
  bale.serie?.code === 'SU' && bale.serie.bientot?.pass === 1
  || (console.log('        serie :', JSON.stringify(bale.serie)), false));
check('un club de série ouverte n’a pas de « BIENTÔT »', r.serie?.code === 'AN' && !r.serie.bientot);
await page.goto(`${base}/club/551`, { waitUntil: 'domcontentloaded' });
await jusqua(async () => (await page.$('.onglets [data-o=fanzzy]')) !== null);
await page.click('.onglets [data-o=fanzzy]');
check('FANZZY d’une série fermée : silhouettes, BIENTÔT · PASS 1, lien vers le PASS', await jusqua(async () =>
  /BIENTÔT · PASS 1/.test(await txt('#onglet')) && (await page.$$('#onglet img[data-fz]')).length === 0
  && (await page.$$('.fzc.non')).length === 3
  && await page.$eval('#onglet a.bientot', (a) => a.getAttribute('href')) === '/abonnement'));
check('aucune erreur de page', erreurs.length === 0 || (console.log('        ', erreurs.join(' | ')), false));
const large = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
check('rien ne dépasse en largeur au téléphone', large);

if (process.env.CAPTURES) {
  mkdirSync(process.env.CAPTURES, { recursive: true });
  await page.click('.onglets [data-o=tribune]');
  await dodo(600);
  await page.setViewport({ width: 400, height: 900, deviceScaleFactor: 2 });
  await page.screenshot({ path: path.join(process.env.CAPTURES, 'club-telephone.png'), fullPage: true });
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
  await dodo(400);
  await page.screenshot({ path: path.join(process.env.CAPTURES, 'club-ordinateur.png'), fullPage: true });
}

await page.goto(`${base}/club/4242`, { waitUntil: 'domcontentloaded' });
check('un club inconnu : une phrase, pas une page vide',
  await jusqua(async () => /Impossible de lire ce club/.test(await txt('#page'))));

/* La fête du match TBFO (`tbfo-fete.js`), dans la case commune : ce que
   l'API rend pour Gael, fêté sur sa page. */
{
  moi = ID(1);
  const tous = (await (await fetch(`${base}/api/club/victoires`)).json()).victoires;
  const v = tous.filter((x) => x.type === 'match');
  const p2 = await nav.newPage();
  p2.on('pageerror', (e) => erreurs.push(e.message));
  await p2.setViewport({ width: 400, height: 860, deviceScaleFactor: process.env.CAPTURES ? 2 : 1 });
  await p2.goto(`${base}/club/42`, { waitUntil: 'domcontentloaded' });
  await p2.addScriptTag({ url: '/tbfo-fete.js' });
  await p2.evaluate((liste) => { window.__choix = window.TBF_TBFO_FETE.feter(liste); }, v);
  const vu = await jusqua(() => p2.evaluate(() => /VICTOIRE \+ VIRAGE/.test(document.body.innerText)
    && /\+30/.test(document.body.innerText) && /ARSENAL/.test(document.body.innerText)));
  check('la fête : VICTOIRE + VIRAGE, +30 écharpes, le club', vu
    || (console.log('        texte :', await p2.evaluate(() => document.body.innerText.slice(-400))), false));
  if (process.env.CAPTURES) {
    await dodo(2200);
    await p2.screenshot({ path: path.join(process.env.CAPTURES, 'fete-tbfo.png') });
  }
  await p2.evaluate(() => [...document.querySelectorAll('button')].find((b) => /VOIR MON CLUB/.test(b.textContent))?.click());
  check('VOIR MON CLUB mène à la page du club', await p2.evaluate(() => window.__choix) === '/club/42');
  await p2.close();
  check('aucune erreur de page pendant la fête', erreurs.length === 0 || (console.log('        ', erreurs), false));
}

/* Le résumé d'un match TBFO (Gaël, 8 novembre 2026) : l'API, puis la page. */
{
  const res = await (await fetch(`${base}/api/club/match/9001`)).json();
  check('résumé : le vrai match et son score TBFO',
    res.match?.home?.name === 'Arsenal' && res.match.buts?.join() === '2,0' && res.tbfo?.score?.join() === '2,1'
    && res.tbfo.points?.join() === '5,0' && res.match.fini === true
    || (console.log('        résumé :', JSON.stringify(res).slice(0, 400)), false));
  check('résumé : les trois duels, dans l’ordre, qui les a gagnés',
    res.duels?.length === 3 && res.duels.every((x) => x.compte)
    && res.duels.map((x) => x.gagnant).join() === '0,0,1' && res.duels[0].joueurs[0].join() === 'Gael'
    || (console.log('        duels :', JSON.stringify(res.duels)), false));
  check('résumé : le Virage, la corde et ses présents', res.virage?.corde?.join() === '3,1'
    && res.virage.presents[0][0]?.pseudo === 'Gael' && res.virage.total.join() === '1,0');
  check('résumé : les meneurs et les écharpes', res.meneurs?.[0]?.length === 2 && res.echarpes?.join() === '30,0'
    || (console.log('        :', JSON.stringify(res.meneurs), res.echarpes), false));
  const ancien = await (await fetch(`${base}/api/club/match/9006`)).json();
  check('résumé : un vieux match garde ses duels', ancien.duels?.length === 1);
  const inconnu = (await fetch(`${base}/api/club/match/123456`)).status;
  check('résumé : un match inconnu, 404', inconnu === 404);

  const p3 = await nav.newPage();
  p3.on('pageerror', (e) => erreurs.push(e.message));
  await p3.setViewport({ width: 400, height: 860, deviceScaleFactor: process.env.CAPTURES ? 2 : 1 });
  await p3.goto(`${base}/tbfo/9001`, { waitUntil: 'domcontentloaded' });
  const t3 = async (sel) => p3.$eval(sel, (n) => n.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  check('la page du match TBFO se dessine', await jusqua(async () => /SCORE TBFO/.test(await t3('.score'))));
  check('le vrai score en petit, le score TBFO en grand', /VRAI SCORE 2–0/.test(await t3('.vs'))
    && /^2\s*SCORE TBFO/.test(await t3('.score .l')));
  check('les duels et le Virage', (await p3.$$('.duel')).length === 3 && /CORDE/.test(await t3('.corde')));
  check('les écharpes de chaque tribune', /\+30/.test(await t3('.ech')));
  check('les clubs mènent à leur page', await p3.$eval('.vs .nom.a', (a) => a.getAttribute('href')) === '/club/42');
  if (process.env.CAPTURES) {
    await p3.screenshot({ path: path.join(process.env.CAPTURES, 'match-tbfo.png'), fullPage: true });
  }
  /* Un match fini où personne n'a joué : son 0–0 d'office. */
  await pool.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,home_goals,away_goals,status_short,elapsed,kickoff_at)
    VALUES (9007,39,2026,49,42,1,1,'FT',90,UTC_TIMESTAMP() - INTERVAL 3 HOUR)`);
  await p3.goto(`${base}/tbfo/9007`, { waitUntil: 'domcontentloaded' });
  check('un match vide : 0–0 d’office, d’une autre couleur', await jusqua(async () => /0–0 D’OFFICE/.test(await t3('.vide-msg'))
    && await p3.$('.score.vide') !== null));
  if (process.env.CAPTURES) {
    await p3.screenshot({ path: path.join(process.env.CAPTURES, 'match-tbfo-vide.png'), fullPage: true });
  }
  await p3.close();
}

/* ------------------------------------------------ les exploits TBFO
   (Gaël, 8 novembre 2026, « les 4 idées m'intéressent ») : l'homme du match,
   le derby de la semaine, l'alerte « ton club perd », la fin de saison. */
{
  const pq = async (sql, p = []) => (await pool.query(sql, p))[0];
  const lire = async (n) => { moi = ID(n); const j = await (await fetch(`${base}/api/club/victoires`)).json(); return j.victoires ?? []; };
  const ajouter = async (fixture, gagnant, perdant, sideGagnant, ilya) => {
    const id = `cd-${++d}`;
    for (const [u, issue, side] of [[gagnant, 'win', sideGagnant], [perdant, 'loss', 1 - sideGagnant]]) {
      await pq(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome,fixture_id,ferveur,mode,side,ended_at)
        VALUES (?,?,'x',?,?,200,'classe',?,NOW(3) - INTERVAL ? MINUTE)`, [id, ID(u), issue, fixture, side, ilya]);
    }
  };
  const p4 = await nav.newPage();
  p4.on('pageerror', (e) => erreurs.push(e.message));
  await p4.setViewport({ width: 400, height: 860, deviceScaleFactor: process.env.CAPTURES ? 2 : 1 });
  const t4 = async (sel) => p4.$eval(sel, (n) => n.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');

  /* 1. L'homme du match, sur la page du match et dans la fête. */
  moi = ID(1);
  const res = await (await fetch(`${base}/api/club/match/9001`)).json();
  check('résumé : l’homme du match, son camp et son titre', res.homme?.pseudo === 'Gael' && res.homme.gagnes === 1
    && res.homme.camp === 0 && res.homme.titres === 1 && res.homme.echarpes === 15
    || (console.log('        homme :', JSON.stringify(res.homme)), false));
  check('résumé : un match en cours n’a pas encore d’homme du match',
    (await (await fetch(`${base}/api/club/match/9002`)).json()).homme === null);
  await p4.goto(`${base}/tbfo/9001`, { waitUntil: 'domcontentloaded' });
  check('la page du match : HOMME DU MATCH TBFO, Gael', await jusqua(async () => /HOMME DU MATCH TBFO Gael/.test(await t4('.hdm'))));
  if (process.env.CAPTURES) {
    await dodo(300);
    await p4.screenshot({ path: path.join(process.env.CAPTURES, 'homme-du-match.png'), fullPage: true });
  }
  await p4.goto(`${base}/tbfo/9002`, { waitUntil: 'domcontentloaded' });
  check('match en cours : le titre est à prendre, le meneur du moment', await jusqua(async () =>
    /À PRENDRE Gael/.test(await t4('.hdm.attente'))));
  const hdm = (await lire(1)).find((x) => x.type === 'hdm');
  await p4.goto(`${base}/club/42`, { waitUntil: 'domcontentloaded' });
  await p4.addScriptTag({ url: '/tbfo-fete.js' });
  await p4.evaluate((l) => { window.__choix = window.TBF_TBFO_FETE.feter(l); }, [hdm]);
  check('la fête de l’homme du match', await jusqua(() => p4.evaluate(() => /HOMME DU MATCH/.test(document.body.innerText)
    && /\+15/.test(document.body.innerText))));
  if (process.env.CAPTURES) {
    await dodo(2200);
    await p4.screenshot({ path: path.join(process.env.CAPTURES, 'fete-homme-du-match.png') });
  }
  await p4.evaluate(() => [...document.querySelectorAll('button')].find((b) => /VOIR LE MATCH/.test(b.textContent))?.click());
  check('VOIR LE MATCH mène au résumé', await p4.evaluate(() => window.__choix) === '/tbfo/9001');

  /* 2. Le derby de la semaine : les suivis d'avant le lundi comptent. */
  await pq(`UPDATE user_follows SET created_at = NOW(3) - INTERVAL 30 DAY`);
  await pq(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,home_goals,away_goals,status_short,elapsed,kickoff_at)
    VALUES (9010,39,2026,42,49,1,0,'FT',90,UTC_TIMESTAMP() + INTERVAL 1 MINUTE)`);
  await ajouter(9010, 3, 5, 0, 5);
  club.oublier();
  let dz = (await (await fetch(`${base}/api/club/derby`)).json()).derby;
  check('le derby de la semaine : le match qui réunit le plus de supporters', dz?.id === 9010 && dz.coef === 2
    && dz.home.name === 'Arsenal' && dz.home.fans === 3 && dz.away.fans === 1
    || (console.log('        derby :', JSON.stringify(dz)), false));
  let v = await lire(3);
  const x = v.find((y) => y.type === 'match' && y.match === 9010);
  check('au derby, les écharpes de la tribune doublent : 40', x?.echarpes === 40 && x.derby === true && x.coef === 2
    || (console.log('        v :', JSON.stringify(v)), false));
  check('le résumé du derby le dit', (await (await fetch(`${base}/api/club/match/9010`)).json()).derby?.coef === 2);
  await p4.goto(`${base}/tbfo/9010`, { waitUntil: 'domcontentloaded' });
  check('la page du match : le ruban DERBY DE LA SEMAINE', await jusqua(async () => /DERBY DE LA SEMAINE ÉCHARPES ×2/.test(await t4('.derby'))));
  await p4.goto(`${base}/club/42`, { waitUntil: 'domcontentloaded' });
  await p4.evaluate(() => {
    const a = document.createElement('div'); a.dataset.derby = 'carte'; a.style.padding = '12px';
    const b = document.createElement('div'); b.dataset.derby = 'bandeau'; b.style.padding = '0 12px';
    const m = document.querySelector('main') ?? document.body;
    m.prepend(b); m.prepend(a);
  });
  await p4.addScriptTag({ url: '/derby.js' });
  check('l’affiche du derby (matchs) et sa ligne dorée (accueil)', await jusqua(async () =>
    /LE DERBY DE LA SEMAINE/.test(await t4('.tbf-derby-c')) && /DERBY : Arsenal – Chelsea/.test(await t4('.tbf-derby-b'))));
  if (process.env.CAPTURES) {
    await p4.screenshot({ path: path.join(process.env.CAPTURES, 'derby.png'), clip: { x: 0, y: 40, width: 400, height: 320 } });
  }

  /* 3. « Ton club perd au TBFO » : 9002 se joue, Arsenal mène 2–1. */
  moi = ID(4);
  let al = (await (await fetch(`${base}/api/club/alertes`)).json()).alertes;
  check('alerte : Villan (Aston Villa, menée 1–2) est prévenu', al?.length === 1 && al[0].match === 9002
    && al[0].camp === 1 && al[0].score.join() === '1,2' && al[0].club.name === 'Aston Villa'
    || (console.log('        alertes :', JSON.stringify(al)), false));
  moi = ID(1);
  al = (await (await fetch(`${base}/api/club/alertes`)).json()).alertes;
  check('alerte : Gael (Arsenal, qui mène) ne l’est pas', Array.isArray(al) && al.length === 0);
  moi = null;
  check('alerte : sans compte, 401', (await fetch(`${base}/api/club/alertes`)).status === 401);
  moi = ID(4);
  await p4.goto(`${base}/club/66`, { waitUntil: 'domcontentloaded' });
  await p4.addScriptTag({ url: '/tbfo-alerte.js' });
  await p4.evaluate(() => window.TBF_TBFO_ALERTE.lire());
  check('alerte : le bandeau rouge, et le duel pour son camp', await jusqua(async () =>
    /TON CLUB PERD AU TBFO Aston Villa 1–2 Arsenal/.test(await t4('.tbf-alerte')))
    && await p4.$eval('.tbf-alerte .duel', (a) => a.getAttribute('href')) === '/duel-nvn?match=9002&camp=1');
  if (process.env.CAPTURES) {
    await dodo(600);
    await p4.screenshot({ path: path.join(process.env.CAPTURES, 'alerte-club-perd.png') });
  }
  await p4.click('.tbf-alerte .tard');
  await p4.evaluate(() => window.TBF_TBFO_ALERTE.lire());
  await dodo(400);
  check('alerte : PLUS TARD la fait taire tant que l’écart ne grandit pas', (await p4.$('.tbf-alerte')) === null);

  /* 4. La fin de saison TBFO : 2025 finie il y a cinq jours, Arsenal champion. */
  await pq(`INSERT INTO souvenir_leagues (league_id,season,name,country,type,family,starts_on,ends_on) VALUES
    (39,2025,'Premier League','England','League','top',CURDATE() - INTERVAL 280 DAY,CURDATE() - INTERVAL 5 DAY),
    (39,2026,'Premier League','England','League','top',CURDATE() - INTERVAL 60 DAY,CURDATE() + INTERVAL 200 DAY)`);
  await pq(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,home_goals,away_goals,status_short,elapsed,kickoff_at)
    VALUES (9020,39,2025,42,49,1,1,'FT',90,UTC_TIMESTAMP() - INTERVAL 10 DAY)`);
  await ajouter(9020, 1, 5, 0, 10 * 24 * 60 - 30);
  club.oublier();
  const fin = (await (await fetch(`${base}/api/club/fin/39?saison=2025`)).json()).fin;
  check('fin de saison : 2025 finie, Arsenal champion TBFO', fin?.finie === true && fin.champion?.name === 'Arsenal'
    && fin.echarpes === 100 || (console.log('        fin :', JSON.stringify(fin)), false));
  const course = (await (await fetch(`${base}/api/club/fin/39?saison=2026`)).json()).fin;
  check('fin de saison : 2026 se joue, la course au titre et son leader', course?.finie === false
    && course.reste === 200 && course.leader?.name === 'Arsenal' && course.champion === null
    || (console.log('        course :', JSON.stringify(course)), false));
  v = await lire(2);
  const sacre = v.find((y) => y.type === 'champion');
  check('le champion gâte ses supporters : NordBank reçoit 100 écharpes et le titre',
    sacre?.echarpes === 100 && sacre.club?.name === 'Arsenal' && sacre.saison === 2025 && sacre.ligue?.name === 'Premier League'
    && (await pq(`SELECT titre FROM recompenses WHERE source='tbfo-champ' AND cle='39-2025' AND user_id=?`, [ID(2)]))[0]?.titre === 'Champion TBFO'
    || (console.log('        v :', JSON.stringify(v)), false));
  v = await lire(5);
  check('un supporter de Chelsea ne reçoit rien', !v.some((y) => y.type === 'champion'));
  moi = ID(1);
  const fiche = await (await fetch(`${base}/api/club/42`)).json();
  check('la page du club : son titre de champion TBFO', fiche.tbfo?.titres?.[0]?.saison === 2025
    || (console.log('        titres :', JSON.stringify(fiche.tbfo?.titres)), false));
  await p4.goto(`${base}/club/42`, { waitUntil: 'domcontentloaded' });
  check('la vitrine des trophées', await jusqua(async () => /CHAMPION 2025/.test(await t4('.vitrine'))));
  await p4.addScriptTag({ url: '/tbfo-fete.js' });
  await p4.evaluate((l) => { window.TBF_TBFO_FETE.feter(l); }, [sacre]);
  check('la fête du champion TBFO', await jusqua(() => p4.evaluate(() => /CHAMPION TBFO !/.test(document.body.innerText)
    && /\+100/.test(document.body.innerText))));
  if (process.env.CAPTURES) {
    await dodo(2200);
    await p4.screenshot({ path: path.join(process.env.CAPTURES, 'fete-champion.png') });
  }
  await p4.close();
  check('aucune erreur de page pendant les exploits', erreurs.length === 0 || (console.log('        ', erreurs), false));
}

await nav.close();
await pool.end();
http.close();
console.log(failures ? `\n${failures} échec(s)` : '\ntout est vert');
process.exit(failures ? 1 : 0);
