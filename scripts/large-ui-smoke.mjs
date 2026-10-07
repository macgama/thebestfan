/**
 * Sur un ordinateur, toutes les pages ont la largeur du téléphone.
 *
 * Gaël, le 7 octobre 2026 : « trop large, trop d'informations ; je préfère
 * un affichage style mobile », et « pour toutes les pages de notre
 * application, la même largeur ». La colonne fait 480 px au plus
 * (`--colonne`, ui.css, « La largeur de la colonne »), au milieu de l'écran,
 * sans les tuiles de l'accueil autour. Les pages qui ont leur suite (amis,
 * KOP, matchs, compétitions, clubs, missions, profil, répétition) y font ce
 * contrôle (`controlerColonne`) ; les autres le font ici, sur des réponses
 * de serveur écrites à la main, l'accueil et les deux arènes compris.
 *
 * Aucune base : rien ici ne passe par le serveur du jeu.
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { controlerColonne } from './colonne-ui.mjs';

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
const PAGES = [['/', 'index', 'l’accueil'], ['/classement', 'classement', 'le classement'],
  ['/carnet', 'carnet', 'le carnet'], ['/collection', 'collection', 'le classeur'],
  ['/abonnement', 'abonnement', 'l’abonnement'], ['/compte', 'compte', 'le compte'],
  ['/deck', 'deck', 'le deck'], ['/boosters', 'boosters', 'les boosters'],
  ['/boutique', 'boutique', 'la boutique'], ['/fanzzy', 'fanzzy', 'la page du Fanzzy'],
  ['/fanzzy/RP1', 'fanzzy-fiche', 'la fiche d’un Fanzzy'], ['/virage', 'virage', 'le Virage'],
  ['/duel-nvn', 'duel-nvn', 'le duel']];
for (const [url, fichier] of PAGES) {
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

/* ------------------------------------------------------------ les pages

   Sans serveur derrière, la plupart disent qu'elles n'ont rien pu lire ;
   c'est leur colonne qu'on regarde. Le classement et le carnet ont leurs
   lignes, pour qu'une liste pleine ne pousse pas la colonne. */
for (const [url, , nom] of PAGES) {
  const page = await ouvrir(url);
  const pret = url === '/classement'
    ? () => jusqua(async () => page.evaluate(() => document.querySelectorAll('.lignes .row').length > 0))
    : url === '/carnet'
      ? () => jusqua(async () => page.evaluate(() => document.querySelectorAll('.list>.sv').length === 5))
      : undefined;
  await controlerColonne(page, check, { nom, pret });
  await page.close();
}


const fautes = erreurs.filter((e) => !/Failed to fetch|JSON/.test(e));
check('aucune erreur de script', fautes.length === 0);
if (fautes.length) console.log('   ', fautes.slice(0, 3));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close();
http.close();
process.exitCode = failures ? 1 : 0;
