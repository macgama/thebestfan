/**
 * Devenir testeur de l'appli Android : la page /beta et la plaque de
 * l'accueil (public/beta-android.js). La plaque ne se montre que sur Android,
 * jamais dans l'appli elle-même, et se tait une semaine après une visite de
 * /beta. `--photos <dossier>` enregistre des captures.
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const i = process.argv.indexOf('--photos');
const PHOTOS = i > 0 ? process.argv[i + 1] : null;
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const app = express();
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: 'p1', pseudo: 'Banc' } }));
app.use('/api', (_q, s) => s.status(503).json({ error: 'banc' }));
app.get('/', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'index.html')));
app.get('/beta', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'beta.html')));
app.use(express.static(path.join(RACINE, 'public')));
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const ANDROID = 'Mozilla/5.0 (Linux; Android 15; SM-S926B) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 '
  + '(KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
async function ouvrir(url, ua, { referer, avant } = {}) {
  const page = await nav.newPage();
  await page.setUserAgent(ua);
  await page.setViewport({ width: 411, height: 855, isMobile: true, hasTouch: true });
  if (avant) await page.evaluateOnNewDocument(avant);
  await page.goto(base + url, { waitUntil: 'networkidle2', ...(referer ? { referer } : {}) });
  return page;
}
const plaqueDe = (page) => page.waitForSelector('#betaPlaque', { timeout: 15000 })
  .then(() => true).catch(() => false);

try {
  let p = await ouvrir('/', ANDROID);
  const vue = await plaqueDe(p);
  check('sur Android, la plaque « Appli Android » se pose sur l’accueil', vue);
  if (vue) {
    const info = await p.$eval('#betaPlaque', (a) => {
      const r = a.getBoundingClientRect();
      return { href: a.getAttribute('href'), texte: a.textContent.replace(/\s+/g, ' ').trim(),
        dedans: r.left >= 0 && r.right <= innerWidth && r.top >= 0 };
    });
    check('elle mène à /beta et dit « APPLI ANDROID · DEVIENS TESTEUR »',
      info.href === '/beta' && /APPLI ANDROID/.test(info.texte) && /DEVIENS TESTEUR/.test(info.texte));
    check('elle tient dans l’écran', info.dedans);
    if (PHOTOS) await p.screenshot({ path: path.join(PHOTOS, 'accueil-android.png') });
  }
  await p.close();

  p = await ouvrir('/', IPHONE);
  check('sur iPhone, pas de plaque', !(await plaqueDe(p)));
  await p.close();

  /* Chrome n'envoie pas un référent `android-app://` depuis Puppeteer : on le
     pose comme l'appli le donne à sa première page. */
  p = await ouvrir('/', ANDROID, { avant: () => Object.defineProperty(Document.prototype, 'referrer',
    { get: () => 'android-app://online.thebestfan.app/' }) });
  check('dans l’appli Android elle-même, pas de plaque', !(await plaqueDe(p)));
  await p.close();

  p = await ouvrir('/beta', ANDROID);
  const liens = await p.evaluate(() => ({
    groupe: document.getElementById('lienGroupe').href,
    test: document.getElementById('lienTest').href,
    store: document.getElementById('lienStore').href,
    qr: getComputedStyle(document.querySelector('.qr')).display,
    vu: localStorage.getItem('tbf-beta-vu'),
    large: document.documentElement.scrollWidth <= innerWidth,
  }));
  check('/beta donne les trois liens : groupe, test, Play Store',
    /groups\.google\.com\/g\//.test(liens.groupe)
    && liens.test === 'https://play.google.com/apps/testing/online.thebestfan.app'
    && liens.store === 'https://play.google.com/store/apps/details?id=online.thebestfan.app');
  check('sur Android, /beta cache le QR code et ne déborde pas', liens.qr === 'none' && liens.large);
  if (PHOTOS) await p.screenshot({ path: path.join(PHOTOS, 'beta-android.png'), fullPage: true });
  check('la visite est notée', Boolean(liens.vu));
  await p.close();

  p = await ouvrir('/', ANDROID, { avant: () => localStorage.setItem('tbf-beta-vu', String(Date.now())) });
  check('après une visite de /beta, la plaque se tait', !(await plaqueDe(p)));
  await p.close();

  const bureau = await nav.newPage();
  await bureau.setViewport({ width: 1366, height: 900 });
  await bureau.goto(`${base}/beta`, { waitUntil: 'networkidle2' });
  const qr = await bureau.$eval('.qr img', (img) => img.complete && img.naturalWidth > 0
    && getComputedStyle(img.closest('.qr')).display !== 'none');
  check('sur un ordinateur, /beta montre le QR code', qr);
  if (PHOTOS) await bureau.screenshot({ path: path.join(PHOTOS, 'beta-ordinateur.png'), fullPage: true });
  await bureau.close();
} finally {
  await nav.close();
  http.close();
}
console.log(failures ? `\n${failures} contrôle(s) rouge(s)` : '\nbeta:ui ok');
process.exit(failures ? 1 : 0);
