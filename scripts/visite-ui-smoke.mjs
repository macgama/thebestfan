/**
 * Le tutoriel : la visite guidée de l'accueil et la page « Comment jouer ».
 *
 * ## Ce que cette suite défend
 *
 * **La visite ne montre jamais le vide.** Chaque arrêt pointe un élément de
 * l'accueil ; un sélecteur qui ne trouve plus rien (une tuile renommée, un
 * bouton déplacé) doit faire rougir ici, et pas laisser un projecteur sur
 * du noir. On parcourt donc la visite entière et on exige que chaque arrêt
 * à projecteur éclaire bien un élément visible.
 *
 * **Elle ne revient pas.** Passée ou finie, elle ne se rejoue pas au
 * rechargement — sauf quand on la demande (`/?visite=1`, le bouton de
 * « Comment jouer »).
 *
 * **Elle ne gêne pas les autres suites.** Un navigateur piloté ne la voit
 * pas sans la demander : sinon son voile couvrirait l'accueil de toutes les
 * suites qui y cliquent.
 *
 * **Chaque porte de « Comment jouer » mène à un écran qui existe**, et la
 * page est dans le menu.
 *
 * Usage : node scripts/visite-ui-smoke.mjs
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const app = express();
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: 7, pseudo: 'Momo', role: 'joueur' } }));
app.get('/api/fanzzy/state', (_q, s) => s.json({ onboarded: true, wallet: { scarves: 120 }, scarves: 120, follows: [] }));
app.get('/api/admin/suis-je', (_q, s) => s.json({ admin: false }));
app.use('/api', (_q, s) => s.json({}));
app.get('/', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'index.html')));
app.get('/comment-jouer', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'comment-jouer.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
const page = await nav.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

const attendre = async (f, ms = 15000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(f)) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return false;
};

/* ------------------------------------------------ sans la demander : rien */

await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));
check('un navigateur piloté ne la voit pas sans la demander',
  !(await page.$('.tbf-visite')));

/* ------------------------------------------------------- demandée : tous les arrêts */

await page.goto(`${base}/?visite=1`, { waitUntil: 'networkidle0' });
check('demandée, elle s’ouvre sur l’accueil',
  await attendre(() => !!document.querySelector('.tbf-visite')));

const arrets = [];
for (let n = 0; n < 12; n++) {
  const a = await page.evaluate(() => {
    const v = document.querySelector('.tbf-visite');
    if (!v) return null;
    const trou = v.querySelector('.tbf-visite-trou');
    const bulle = v.querySelector('.tbf-visite-bulle').getBoundingClientRect();
    let eclaire = null;
    if (!trou.hidden) {
      const r = trou.getBoundingClientRect();
      eclaire = r.width > 10 && r.height > 10
        && r.bottom > 0 && r.top < innerHeight;
    }
    return {
      titre: v.querySelector('h2').textContent,
      eclaire,
      bulleDansEcran: bulle.top >= 0 && bulle.bottom <= innerHeight + 1,
      fin: !!v.querySelector('.tbf-visite-fin'),
    };
  });
  if (!a) break;
  arrets.push(a);
  if (a.fin) break;
  await page.click('.tbf-visite [data-suivant]');
  await new Promise((r) => setTimeout(r, 120));
}
console.log('    arrêts :', arrets.map((a) => a.titre).join(' · '));
check('la visite a ses sept arrêts', arrets.length === 7);
check('chaque projecteur éclaire un élément visible',
  arrets.filter((a) => a.eclaire !== null).length === 5 && arrets.every((a) => a.eclaire !== false));
check('la bulle tient toujours dans l’écran', arrets.every((a) => a.bulleDansEcran));
check('elle finit sur les missions et « Comment jouer »', await page.evaluate(() =>
  [...document.querySelectorAll('.tbf-visite-fin a')].map((a) => a.getAttribute('href')).join() === '/aide,/comment-jouer'));

await page.click('.tbf-visite [data-fin]');
check('« C’est parti » la referme', !(await page.$('.tbf-visite')));
check('et l’adresse perd sa demande', !page.url().includes('visite='));
check('elle se garde comme vue', await page.evaluate(() => localStorage.getItem('tbf.visite') === '1'));

/* ------------------------------------------- vue : un joueur ne la revoit pas

   On simule le joueur ordinaire (non piloté) : `webdriver` masqué avant
   que la page ne se charge. */
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
});
await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));
check('vue une fois, elle ne revient pas au rechargement', !(await page.$('.tbf-visite')));

await page.evaluate(() => localStorage.removeItem('tbf.visite'));
await page.goto(`${base}/`, { waitUntil: 'networkidle0' });
check('un joueur qui ne l’a jamais vue la reçoit à son arrivée',
  await attendre(() => !!document.querySelector('.tbf-visite')));
await page.keyboard.press('Escape');
check('Échap la referme', !(await page.$('.tbf-visite')));

/* ------------------------------------------------------------ Comment jouer */

await page.goto(`${base}/comment-jouer`, { waitUntil: 'networkidle0' });
const cj = await page.evaluate(() => ({
  rubriques: [...document.querySelectorAll('.rub')].map((s) => s.id),
  sommaire: [...document.querySelectorAll('.sommaire a')].map((a) => a.getAttribute('href').slice(1)),
  portes: [...document.querySelectorAll('.aller a, .depart .boutons a')].map((a) => a.getAttribute('href')),
  largeur: document.documentElement.scrollWidth <= innerWidth,
}));
check('le sommaire mène à chaque rubrique',
  cj.sommaire.length === cj.rubriques.length - 1 && cj.sommaire.every((id) => cj.rubriques.includes(id)));
check('elle relance la visite', cj.portes.includes('/?visite=1'));
const server = readFileSync(path.join(RACINE, 'server.js'), 'utf8');
const sansEcran = cj.portes.map((h) => h.split('?')[0])
  .filter((h) => h !== '/' && !server.includes(`app.get('${h}'`));
check('chaque porte mène à un écran du jeu', sansEcran.length === 0
  || (console.log('    sans écran :', sansEcran.join(' ')), false));
check('pas de défilement de côté au téléphone', cj.largeur);

const menu = await page.evaluate(async () => {
  document.querySelector('.tbf-burger')?.click();
  await new Promise((r) => setTimeout(r, 600));
  const t = document.querySelector('.tbf-tiroir');
  return t ? [...t.querySelectorAll('a')].map((a) => a.getAttribute('href')) : [];
});
check('« Comment jouer » est dans le menu', menu.includes('/comment-jouer'));

check('aucune erreur de script', erreurs.length === 0 || (console.log('   ', erreurs), false));

await nav.close();
http.close();
console.log(failures ? `\n${failures} échec(s)` : '\nTout passe.');
process.exit(failures ? 1 : 0);
