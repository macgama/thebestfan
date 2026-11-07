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
  VALUES (1, 1, 'La reprise', JSON_ARRAY('RP'), JSON_ARRAY(), NOW(3) - INTERVAL 10 DAY)`);

/* Arsenal (42) : la lignée AN1, AN21, AN41 lui est liée d'office. */
await raw.query(`INSERT INTO leagues (id,name,country,type,current_season) VALUES (39,'Premier League','England','League',2026)`);
await raw.query(`INSERT INTO teams (id,name,country,logo,founded,color1,color2) VALUES
  (42,'Arsenal','England','',1886,'#ef0107','#ffffff'),(66,'Aston Villa','England','',1874,'#670e36','#95bfe5'),
  (49,'Chelsea','England','',1905,NULL,NULL)`);
await raw.query(`INSERT INTO team_leagues (team_id,league_id,season) VALUES (42,39,2026),(66,39,2026),(49,39,2026)`);
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
app.use('/api/club', createClub({ pool, classements }).router);
app.get('/club/:id', (_req, res) => res.sendFile(path.join(RACINE, 'public', 'club.html')));
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

await nav.close();
await pool.end();
http.close();
console.log(failures ? `\n${failures} échec(s)` : '\ntout est vert');
process.exit(failures ? 1 : 0);
