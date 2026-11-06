/**
 * Le carnet en album (6 novembre 2026, maquette « L'album de la saison »
 * choisie par Gaël).
 *
 * La page est servie telle quelle, les routes du carnet répondent des
 * cartes écrites ici : on vérifie ce que le joueur voit — une page par club
 * suivi, la barre de ce qui est collé, les buts encore à récupérer en cases
 * vides avec leur prix, le marché entier dans son onglet, et l'album vide
 * d'un débutant qui l'envoie au Grand Virage.
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(80); }
  return false;
}

const LS = { id: 1, name: 'Lausanne-Sport' };
const YB = { id: 2, name: 'Young Boys' };
const SION = { id: 3, name: 'Sion' };
const BALE = { id: 4, name: 'Bâle' };
let n = 0;
function carte(kind, h, a, joueur, { heures = 50 } = {}) {
  n += 1;
  return { id: n, kind, home_id: h.id, away_id: a.id, home_name: h.name, away_name: a.name,
    home_logo: '', away_logo: '', score_home: 1, score_away: 0, scorer_team: h.id, minute: 10 + n,
    player: joueur, kickoff_at: '2026-10-25T18:00:00Z', league_name: 'Super League', price: 60,
    ferveur: kind === 'presence' ? 120 : null,
    expires_at: new Date(Date.now() + heures * 36e5).toISOString() };
}

const D = {
  mine: [carte('presence', LS, YB, 'Okoh'), carte('vignette', LS, YB, 'Bair'),
    carte('presence', SION, BALE, 'Itten')],
  market: [carte(null, LS, YB, 'Sène', { heures: 9 })],
  clubs: [{ id: 1, nom: 'Lausanne-Sport', total: 12, couleurs: ['#1f3f8f', '#ffffff'] }],
  scarves: 85,
};

const app = express();
app.use(express.json());
app.get('/carnet', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'carnet.html')));
app.get('/api/souvenirs/mine', (_q, s) => s.json({ souvenirs: D.mine, total: D.mine.length }));
app.get('/api/souvenirs/market', (_q, s) => s.json({ souvenirs: D.market, windowDays: 15 }));
app.get('/api/souvenirs/album', (_q, s) => s.json({ clubs: D.clubs }));
let achete = null;
app.post('/api/souvenirs/buy', (q, s) => {
  achete = q.body?.souvenirId;
  const c = D.market.find((x) => x.id === achete);
  D.market = D.market.filter((x) => x.id !== achete);
  if (c) D.mine = [{ ...c, kind: 'vignette' }, ...D.mine];
  s.json({ ok: true, spent: 60 });
});
app.get('/api/fanzzy/state', (_q, s) => s.json({ wallet: { scarves: D.scarves, avatar: null } }));
app.use('/api', (_q, s) => s.json({}));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
const erreurs = [];
async function ouvrir() {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(base + '/carnet', { waitUntil: 'networkidle0' });
  await jusqua(async () => page.evaluate(() =>
    document.querySelector('#list .sv, #list .debut, #list .empty') !== null));
  return page;
}
const texte = (page, sel = '#app') => page.evaluate((s) =>
  document.querySelector(s)?.textContent.replace(/\s+/g, ' ') ?? '', sel);

let page = await ouvrir();
check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

let t = await texte(page, '#tete');
check('la page du club suivi s’ouvre d’abord', /Lausanne-Sport/i.test(t) && /ALBUM DU CLUB/.test(t));
check('avec ce qui est collé sur ce que ses matchs ont frappé', /2 \/ 12/.test(t));
check('et ses compteurs : vécus, récupérés, à prendre',
  /1\s*VÉCU/.test(t) && /1\s*RÉCUPÉRÉ/.test(t) && /1\s*À PRENDRE/.test(t));
check('les cartes sont rangées en album',
  await page.evaluate(() => document.getElementById('list').classList.contains('album')));
check('un but encore à récupérer est une case vide, avec son temps et son prix',
  await page.evaluate(() => {
    const v = document.querySelector('#list .sv.vide');
    return Boolean(v?.querySelector('[data-buy]')) && /encore [89] h/.test(v.textContent);
  }));
check('la page du club ne montre que les cartes de ses matchs',
  !/Itten/.test(await texte(page, '#list')) && /Okoh/.test(await texte(page, '#list')));
check('un onglet par page : le club, et les autres matchs',
  await page.evaluate(() => [...document.querySelectorAll('#pages [data-page]')]
    .map((b) => b.textContent.trim()).join('|')) === 'Lausanne-Sport|AUTRES MATCHS');
check('le marché dit combien de buts attendent',
  (await texte(page, '#nmarche')).trim() === '1');

await page.evaluate(() => document.querySelector('[data-page="autres"]')?.click());
await dodo(200);
check('la page des autres matchs garde ce qui n’est d’aucun club suivi',
  /Itten/.test(await texte(page, '#list')) && !/Okoh/.test(await texte(page, '#list')));

await page.evaluate(() => document.querySelector('[data-page="1"]')?.click());
await dodo(200);
await page.evaluate(() => document.querySelector('#list .sv.vide [data-buy]')?.click());
await jusqua(async () => achete !== null && !(await page.$('#list .sv.vide')));
check('récupérer depuis l’album achète ce but', achete === D.mine[0].id);
check('et la case vide devient une vignette collée',
  !(await page.$('#list .sv.vide')) && /Sène/.test(await texte(page, '#list')));

D.market = [carte(null, LS, YB, 'Mendy')];
await page.reload({ waitUntil: 'networkidle0' });
await jusqua(async () => (await page.$('#list .sv')) !== null);
await page.evaluate(() => document.querySelector('[data-tab="market"]')?.click());
await dodo(200);
check('au marché, toutes les vignettes en vente, en grand',
  await page.evaluate(() => !document.getElementById('list').classList.contains('album')
    && document.querySelectorAll('#list [data-buy]').length === 1
    && document.getElementById('tete').hidden));

D.mine = []; D.market = [];
page = await ouvrir();
t = await texte(page, '#list');
check('un album vide envoie au Grand Virage',
  /MON ALBUM EST VIDE/.test(t) && await page.evaluate(() =>
    Boolean(document.querySelector('#list a[href="/virage"]'))));
check('et dit pourquoi', /personne ne pourra t.acheter/.test(t));

check('aucune erreur de script sur toute la session', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close();
http.close();
process.exitCode = failures ? 1 : 0;
