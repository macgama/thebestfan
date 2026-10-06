/**
 * Les pages larges sans suite de navigateur à elles, dans un vrai navigateur.
 *
 * Sur grand écran (≥ 1 180 × 560), chaque page de l'application porte
 * `<body class="tbf-large">` : sa colonne s'élargit, les dix tuiles de
 * l'accueil la bordent, et ses listes se rangent en colonnes de la largeur
 * d'un téléphone (« Les pages larges » dans public/ui.css). Les pages qui ont
 * leur suite (amis, KOP, matchs, compétitions, clubs, missions, profil,
 * répétition) y font ce contrôle ; celles-ci n'en ont pas, et le font ici,
 * sur des réponses de serveur écrites à la main :
 *
 *   - le classement : le podium à gauche, la liste à droite, ta place
 *     épinglée sous le podium ; vide, la place vide au milieu ;
 *   - le carnet : les souvenirs en deux colonnes ;
 *   - le classeur, l'abonnement et le compte : la colonne élargie ;
 *   - le deck, les boosters, le Fanzzy et sa fiche : leur cadre.
 *
 * Aucune base : rien ici ne passe par le serveur du jeu.
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { controlerLarge } from './large-ui.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(80); }
  return false;
}

/* ------------------------------------------------- les réponses du serveur */

let classes = 14;
const supporter = (i) => ({
  public_id: `p${i}`, pseudo: `Supporter${i}`, club: 'FC Sion',
  matchs: 20 - i, vecus: 3, ferveur: 5000 - i * 200,
});
const souvenir = (i) => ({
  id: i, kind: i % 2 ? 'presence' : 'vignette', league_name: 'Super League',
  kickoff_at: '2026-09-13 18:00:00', minute: 10 + i, player: `Buteur ${i}`,
  home_name: 'FC Sion', away_name: 'BSC Young Boys', score_home: 2, score_away: 1,
  home_logo: '/img/logo.png', away_logo: '/img/logo.png', fanzzy_id: 'RP1', ferveur: 40,
});

const app = express();
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: 'p5', pseudo: 'Supporter5' } }));
app.get('/api/rank/moi', (_q, s) => s.json({
  rang: 5, sur: classes, ferveur: 4000,
  saison: { numero: 1, nom: 'LA REPRISE', rang: 5, sur: classes, ferveur: 4000 },
}));
app.get('/api/rank/:onglet', (_q, s) => s.json({
  classement: Array.from({ length: classes }, (_, i) => supporter(i)), plancher: 0,
}));
app.get('/api/souvenirs/mine', (_q, s) => s.json({ souvenirs: [1, 2, 3, 4, 5].map(souvenir) }));
app.get('/api/souvenirs/market', (_q, s) => s.json({ souvenirs: [] }));
app.get('/api/fanzzy/state', (_q, s) => s.json({ wallet: { scarves: 25 } }));
for (const [url, fichier] of [['/classement', 'classement'], ['/carnet', 'carnet'],
  ['/collection', 'collection'], ['/abonnement', 'abonnement'], ['/compte', 'compte'],
  ['/deck', 'deck'], ['/boosters', 'boosters'], ['/fanzzy', 'fanzzy'], ['/fanzzy/RP1', 'fanzzy-fiche']]) {
  app.get(url, (_q, s) => s.sendFile(path.join(RACINE, 'public', `${fichier}.html`)));
}
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
async function ouvrir(url) {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(`${url} : ${e.message}`));
  await page.setViewport({ width: 400, height: 900 });
  await page.goto(base + url, { waitUntil: 'networkidle0' });
  return page;
}

/* ------------------------------------------------------------ le classement */

const lignesPretes = (page) => () => jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('.lignes .row').length > 0));
let page = await ouvrir('/classement');
await lignesPretes(page)();
await controlerLarge(page, check, { nom: 'le classement', pret: lignesPretes(page) });

await page.setViewport({ width: 1366, height: 682 });
await page.reload({ waitUntil: 'networkidle0' });
await lignesPretes(page)();
const mur = () => page.evaluate(() => {
  const b = (s) => document.querySelector(s)?.getBoundingClientRect();
  const [podium, lignes, moi] = [b('.tbf-podium'), b('.lignes'), b('#moi')];
  return {
    podium: podium && { l: podium.left, r: podium.right, t: podium.top },
    lignes: lignes && { l: lignes.left, t: lignes.top },
    moi: moi && { l: moi.left, r: moi.right, b: moi.bottom },
    fenetre: innerHeight,
  };
});
let m = await mur();
check('la liste du classement se range à droite du podium, à sa hauteur',
  m.podium && m.lignes && m.lignes.l > m.podium.r && Math.abs(m.lignes.t - m.podium.t) < 30
  || (console.log('        ', m), false));
check('ta place est épinglée sous le podium, en bas de l’écran',
  m.moi && Math.abs(m.moi.l - m.podium.l) < 4 && m.moi.r <= m.podium.r + 1
  && m.moi.b <= m.fenetre && m.moi.b > m.fenetre - 80
  || (console.log('        ', m), false));
await page.close();

classes = 0;
page = await ouvrir('/classement');
await page.setViewport({ width: 1366, height: 682 });
await page.reload({ waitUntil: 'networkidle0' });
await jusqua(async () => page.evaluate(() => Boolean(document.querySelector('.place'))));
const vide = await page.evaluate(() => {
  const p = document.querySelector('.place').getBoundingClientRect();
  return { centre: (p.left + p.right) / 2, w: p.width, milieu: innerWidth / 2 };
});
check('vide, la place vide garde sa largeur de lecture, au milieu',
  vide.w <= 600 && Math.abs(vide.centre - vide.milieu) < 30 || (console.log('        ', vide), false));
await page.close();

/* ---------------------------------------------------------------- le carnet */

page = await ouvrir('/carnet');
const souvenirsPrets = () => jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('.list>.sv').length === 5));
await souvenirsPrets();
await controlerLarge(page, check, { nom: 'le carnet', liste: '.list>.sv', pret: souvenirsPrets });
await page.close();

/* ------------------------------- le classeur, l'abonnement et le compte */

for (const [url, nom] of [['/collection', 'le classeur'], ['/abonnement', 'l’abonnement'],
  ['/compte', 'le compte']]) {
  page = await ouvrir(url);
  await controlerLarge(page, check, { nom });
  await page.close();
}

/* ---------------- le deck, les boosters, le Fanzzy et sa fiche

   Des scènes plus que des listes : elles ne s'étalent pas en colonnes, mais
   leur colonne, leur barre et leurs tuiles se posent au même endroit que sur
   toutes les autres pages. Sans serveur derrière, elles disent qu'elles
   n'ont rien pu lire ; c'est leur cadre qu'on regarde. */
const avantScenes = erreurs.length;
for (const [url, nom] of [['/deck', 'le deck'], ['/boosters', 'les boosters'],
  ['/fanzzy', 'la page du Fanzzy'], ['/fanzzy/RP1', 'la fiche d’un Fanzzy']]) {
  page = await ouvrir(url);
  await controlerLarge(page, check, { nom });
  await page.close();
}
erreurs.length = avantScenes;

const fautes = erreurs.filter((e) => !/Failed to fetch|JSON/.test(e));
check('aucune erreur de script', fautes.length === 0);
if (fautes.length) console.log('   ', fautes.slice(0, 3));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close();
http.close();
process.exitCode = failures ? 1 : 0;
