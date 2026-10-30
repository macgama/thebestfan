/**
 * Les barres du téléphone, dans un vrai navigateur.
 *
 * Sur son Samsung (S24+, Chrome et l'icône de l'écran d'accueil), Gaël voyait
 * le haut ou le bas des écrans coupé par la barre d'état et les boutons du
 * bas, sans pouvoir faire défiler pour retrouver les boutons (« Les barres du
 * téléphone », public/ui.css). Deux règles, éprouvées ici :
 *
 *   - dans un onglet Android, chaque page retire `viewport-fit=cover` avant
 *     d'être dessinée : Chrome la tient alors entre les barres. Un iPhone le
 *     garde, et Android depuis l'icône aussi : la page y passe sous les
 *     boutons du bas, et s'en garde par `var(--bas)` (l'inset, ou 52 px
 *     déduits quand Chrome le dit nul) ;
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

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });

/* ------------------------------------------------- viewport-fit, par système */

const ANDROID = 'Mozilla/5.0 (Linux; Android 15; SM-S926B) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
/* Depuis l'icône (`display-mode: standalone`), Android garde `cover` : Chrome
   y dessine la page sous les boutons du bas, et seul `cover` lui fait dire leur
   hauteur. Puppeteer ne sait pas émuler `display-mode` : on répond à la place
   de `matchMedia`, avant le script de la page. */
const ICONE = () => {
  const vrai = window.matchMedia.bind(window);
  window.matchMedia = (q) => (/display-mode:\s*browser/.test(q)
    ? { matches: false, media: q, addEventListener() {}, removeEventListener() {} } : vrai(q));
};
for (const [ua, nom, garde, icone] of [[ANDROID, 'Android, dans un onglet', false],
  [ANDROID, 'Android, depuis l’icône', true, true], [IPHONE, 'iPhone', true]]) {
  for (const url of ['/', '/virage', '/boutique']) {
    const page = await nav.newPage();
    if (icone) await page.evaluateOnNewDocument(ICONE);
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
/* **Les boutons du bas d'Android, depuis l'icône** (25 octobre 2026) : la
   page va jusqu'au bord de l'écran et `env(safe-area-inset-bottom)` dit la
   hauteur des boutons — 52 px sur le S24+ de Gaël, à 411 × 855. Aucun
   bouton d'un écran de jeu ne descend dessous. */
const sousLesBoutons = async (url, { inset = 52 } = {}) => {
  const page = await nav.newPage();
  page.on('dialog', (d) => d.dismiss());
  await page.evaluateOnNewDocument(ICONE);
  await page.setUserAgent(ANDROID);
  await page.setViewport({ width: 411, height: 855, isMobile: true, hasTouch: true });
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: inset, left: 0, right: 0 } });
  try { await page.goto(base + url, { waitUntil: 'networkidle2', timeout: 15000 }); } catch {}
  await new Promise((r) => setTimeout(r, 600));
  const m = await page.evaluate(() => {
    let bas = 0, qui = '';
    for (const e of document.querySelectorAll('button, a, [role=button], .ouverture .pied')) {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height || r.top >= innerHeight || getComputedStyle(e).visibility === 'hidden') continue;
      if (r.bottom > bas) { bas = r.bottom; qui = String(e.className || e.textContent).trim().slice(0, 40); }
    }
    return { bas: Math.round(bas), qui, fenetre: innerHeight };
  });
  await page.close();
  return m;
};
for (const [url, , nom] of ECRANS) {
  const m = await sousLesBoutons(url);
  check(`${nom}, depuis l’icône sur Android : rien sous les boutons du bas (${m.bas} ≤ ${m.fenetre - 52})`,
    m.bas <= m.fenetre - 52 || (console.log('        ', m), false));
}

/* **Et quand Chrome ne la dit pas** (27 octobre 2026). Les captures de
   Gaël du 26 montraient encore le bas de l'accueil sous les boutons :
   depuis l'icône, sur son S24+, l'inset vaut zéro alors que la fenêtre
   descend jusqu'au bas de l'écran. L'accueil le déduit (`--bas-cache`, en
   tête de `index.html`) : une fenêtre à moins de 60 px du bas de l'écran,
   c'est une fenêtre qui passe sous les boutons. Ici l'écran émulé a la
   hauteur de la fenêtre, le cas exact. Le 28, la fiche d'un Fanzzy avait
   le même bas caché : chaque page porte maintenant ce script, et ui.css
   déclare `--bas` pour toutes. */
for (const [url, , nom] of ECRANS) {
  const m = await sousLesBoutons(url, { inset: 0 });
  check(`${nom}, depuis l’icône, inset à zéro : rien sous les boutons du bas (${m.bas} ≤ ${m.fenetre - 52})`,
    m.bas <= m.fenetre - 52 || (console.log('        ', m), false));
}

/* **Le plein écran de l'icône** (30 octobre 2026). Le manifeste dit
   `fullscreen` : Android cache la barre d'état et les trois boutons, la
   fenêtre fait tout l'écran. Rien n'est alors sous des boutons absents :
   le repli de 52 px laisserait une bande vide en bas. */
for (const [url, , nom] of ECRANS) {
  const page = await nav.newPage();
  page.on('dialog', (d) => d.dismiss());
  await page.evaluateOnNewDocument(() => {
    const vrai = window.matchMedia.bind(window);
    window.matchMedia = (q) => (/display-mode:\s*(browser|fullscreen)/.test(q)
      ? { matches: /fullscreen/.test(q), media: q, addEventListener() {}, removeEventListener() {} } : vrai(q));
  });
  await page.setUserAgent(ANDROID);
  await page.setViewport({ width: 411, height: 915, isMobile: true, hasTouch: true });
  try { await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 15000 }); } catch {}
  const cache = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--bas-cache').trim());
  check(`${nom}, plein écran depuis l’icône : aucun bas gardé pour des boutons cachés (« ${cache} »)`, !cache);
  await page.close();
}

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
