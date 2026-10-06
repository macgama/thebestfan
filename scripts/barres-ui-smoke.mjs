/**
 * Les barres du téléphone, dans un vrai navigateur.
 *
 * Sur son Samsung (S24+, Chrome et l'icône de l'écran d'accueil), Gaël voyait
 * le haut ou le bas des écrans coupé par la barre d'état et les boutons du
 * bas, sans pouvoir faire défiler pour retrouver les boutons (« Les barres du
 * téléphone », public/ui.css). Deux règles, éprouvées ici :
 *
 *   - sur Android, chaque page retire `viewport-fit=cover` avant d'être
 *     dessinée : Chrome la tient alors entre les barres. Un iPhone le garde ;
 *   - un écran de jeu ne s'écrase plus sous `--ecran-min` : dans une fenêtre
 *     courte (zoom ou grand texte du téléphone), il garde sa mise en page et
 *     la page défile jusqu'à son dernier bouton ; dans une fenêtre de
 *     téléphone ordinaire, il tient toujours d'un coup d'œil, sans défiler.
 *
 * Aucune base : on regarde le cadre des écrans, pas ce que le serveur y met.
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const ECRANS = [['/', 'index', 'l’accueil'], ['/fanzzy', 'fanzzy', 'le Fanzzy'],
  ['/fanzzy/RP1', 'fanzzy-fiche', 'la fiche d’un Fanzzy'], ['/virage', 'virage', 'le Virage'],
  ['/duel-nvn', 'duel-nvn', 'le duel'], ['/bienvenue', 'bienvenue', 'la bienvenue']];

const app = express();
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: 'p1', pseudo: 'Banc' } }));
app.use('/api', (_q, s) => s.status(503).json({ error: 'banc' }));
for (const [url, fichier] of [...ECRANS, ['/boutique', 'boutique']]) {
  app.get(url, (_q, s) => s.sendFile(path.join(RACINE, 'public', `${fichier}.html`)));
}
app.use(express.static(path.join(RACINE, 'public')));
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });

/* ------------------------------------------------- viewport-fit, par système */

const ANDROID = 'Mozilla/5.0 (Linux; Android 15; SM-S926B) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
for (const [ua, nom, garde] of [[ANDROID, 'Android', false], [IPHONE, 'iPhone', true]]) {
  for (const url of ['/', '/virage', '/boutique']) {
    const page = await nav.newPage();
    await page.setUserAgent(ua);
    await page.setViewport({ width: 384, height: 780, isMobile: true, hasTouch: true });
    await page.goto(base + url, { waitUntil: 'domcontentloaded' });
    const vp = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
    check(`${nom}, ${url} : viewport-fit=cover ${garde ? 'gardé' : 'retiré'} (${vp})`,
      vp.includes('viewport-fit=cover') === garde);
    await page.close();
  }
}

/* ------------------------------------------------ les écrans de jeu, en hauteur */

const mesurer = async (url, w, h) => {
  const page = await nav.newPage();
  page.on('dialog', (d) => d.dismiss());
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true });
  try { await page.goto(base + url, { waitUntil: 'networkidle2', timeout: 15000 }); } catch {}
  await new Promise((r) => setTimeout(r, 600));
  const m = await page.evaluate(async () => {
    const app = document.getElementById('app');
    const haut = app.getBoundingClientRect().height;
    scrollTo(0, 1e5);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const bas = app.getBoundingClientRect().bottom;
    return { haut, defile: scrollY, bas, fenetre: innerHeight, sh: document.scrollingElement.scrollHeight };
  });
  await page.close();
  return m;
};
for (const [url, , nom] of ECRANS) {
  const court = await mesurer(url, 296, 480);
  check(`${nom}, fenêtre courte (296 × 480) : l’écran garde 560 px et défile jusqu’à son bas`,
    court.haut >= 559 && court.defile > 0 && Math.abs(court.bas - court.fenetre) < 2
    || (console.log('        ', court), false));
  const normal = await mesurer(url, 384, 720);
  check(`${nom}, fenêtre de téléphone (384 × 720) : il tient la fenêtre, sans défiler`,
    Math.abs(normal.haut - 720) < 2 && normal.sh <= 721 || (console.log('        ', normal), false));
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close();
http.close();
process.exitCode = failures ? 1 : 0;
