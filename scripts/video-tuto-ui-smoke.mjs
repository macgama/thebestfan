/**
 * Les vidéos tutoriel de « Comment jouer » (public/video-tuto.js).
 *
 * ## Ce que cette suite défend
 *
 * **Pas de bouton vers un écran noir.** Les vidéos ne sont pas dans git :
 * elles partent au serveur avec les images. Tant que le fichier n'est pas
 * servi, le bouton « Voir la vidéo » reste caché.
 *
 * **La phrase du moment s'affiche sur la vidéo, dans la langue du joueur.**
 * Aucun texte n'est gravé dans l'image : les phrases vivent dans la page, et
 * `langue.js` les traduit comme le reste.
 *
 * **On en sort** : la croix et Échap ferment, la vidéo s'arrête.
 *
 * La vidéo servie ici est fabriquée par ffmpeg (mire de vingt secondes) : on
 * teste le lecteur, pas le film.
 *
 * Usage : node scripts/video-tuto-ui-smoke.mjs
 */
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const NOM = 'tuto-fanzzy-1';

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* La vidéo de test : une mire, sans son, de quoi passer plusieurs phrases. */
const dossier = mkdtempSync(path.join(tmpdir(), 'tbf-video-'));
let videoOk = true;
try {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=180x320:r=15:d=20',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(dossier, `${NOM}.mp4`)]);
} catch {
  videoOk = false;
}

let servie = false;
const app = express();
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: 7, pseudo: 'Momo', role: 'joueur' } }));
app.use('/api', (_q, s) => s.json({}));
app.get('/comment-jouer', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'comment-jouer.html')));
app.use('/video', (q, s, n) => (servie ? n() : s.status(404).end()), express.static(dossier));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR',
  '--autoplay-policy=no-user-gesture-required'] });
const page = await nav.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
const attendre = async (f, ms = 8000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await page.evaluate(f)) return true;
    await dodo(120);
  }
  return false;
};
const boutonVu = () => page.$eval('[data-video-tuto]', (b) => !b.hidden && b.getBoundingClientRect().height > 0);

try {
  /* ----------------------------------------------- vidéo absente : caché */
  await page.goto(`${base}/comment-jouer`, { waitUntil: 'networkidle0' });
  await dodo(400);
  check('la rubrique des Fanzzy porte un bouton vidéo',
    !!(await page.$('#fanzzy [data-video-tuto]')));
  check('sans vidéo sur le serveur, le bouton reste caché', !(await boutonVu()));
  check('ses phrases sont dans la page, cachées',
    await page.$eval(`.video-sous-titres[data-pour="${NOM}"]`, (ol) => ol.hidden && ol.children.length >= 5));
  check('les phrases se suivent sans se chevaucher', await page.$eval(`.video-sous-titres[data-pour="${NOM}"]`, (ol) => {
    let fin = -1;
    for (const li of ol.children) {
      const de = Number(li.dataset.de), a = Number(li.dataset.a);
      if (!(a > de) || de < fin) return false;
      fin = a;
    }
    return true;
  }));

  /* ---------------------------------------------- vidéo servie : visible */
  check('la vidéo de test est fabriquée (ffmpeg)', videoOk);
  servie = true;
  await page.goto(`${base}/comment-jouer`, { waitUntil: 'networkidle0' });
  check('vidéo servie, le bouton se montre', await attendre(async () => {
    const b = document.querySelector('[data-video-tuto]');
    return b && !b.hidden;
  }));

  await page.$eval('[data-video-tuto]', (b) => b.scrollIntoView());
  await page.tap('[data-video-tuto]');
  check('le toucher ouvre le lecteur', await attendre(() => !!document.querySelector('.vtuto video')));
  check('la vidéo démarre', await attendre(() => document.querySelector('.vtuto video')?.currentTime > 0.2));
  check('la première phrase s’affiche', await attendre(() => {
    const p = document.querySelector('.vtuto-phrase');
    return p?.classList.contains('on') && /supporter/.test(p.textContent);
  }));
  const deuxieme = await page.$eval(`.video-sous-titres[data-pour="${NOM}"] li:nth-child(2)`,
    (li) => ({ de: Number(li.dataset.de), texte: li.textContent.trim() }));
  await page.evaluate((t) => { document.querySelector('.vtuto video').currentTime = t + 0.5; }, deuxieme.de);
  await dodo(900);
  check('en avançant, la phrase suit la vidéo',
    await page.$eval('.vtuto-phrase', (p, txt) => p.textContent.trim() === txt, deuxieme.texte));
  check('la phrase tient dans la vidéo, au-dessus de ses commandes', await page.evaluate(() => {
    const v = document.querySelector('.vtuto video').getBoundingClientRect();
    const p = document.querySelector('.vtuto-phrase').getBoundingClientRect();
    return p.top >= v.top && p.bottom <= v.bottom - 40 && p.left >= v.left && p.right <= v.right;
  }));

  await page.tap('.vtuto-fermer');
  check('la croix ferme le lecteur', await attendre(() => !document.querySelector('.vtuto')));

  await page.tap('[data-video-tuto]');
  await attendre(() => !!document.querySelector('.vtuto video'));
  await page.keyboard.press('Escape');
  check('Échap ferme le lecteur', await attendre(() => !document.querySelector('.vtuto')));

  /* ------------------------------------------- dans la langue du joueur */
  /* Une version allemande (sa voix off) passe devant la vidéo commune. */
  if (videoOk) copyFileSync(path.join(dossier, `${NOM}.mp4`), path.join(dossier, `${NOM}-de.mp4`));
  await page.evaluate(() => localStorage.setItem('tbf_locale', 'de'));
  await page.goto(`${base}/comment-jouer`, { waitUntil: 'networkidle0' });
  await attendre(() => !document.querySelector('[data-video-tuto]')?.hidden);
  check('en allemand, le bouton est traduit',
    await page.$eval('[data-video-tuto]', (b) => b.textContent.trim() === 'Video ansehen'));
  await page.tap('[data-video-tuto]');
  check('en allemand, c’est la version allemande qui joue', await attendre(() =>
    /-de\.mp4$/.test(document.querySelector('.vtuto video')?.getAttribute('src') ?? '')));
  check('en allemand, la phrase aussi', await attendre(() =>
    /Fan/.test(document.querySelector('.vtuto-phrase.on')?.textContent ?? '')
    && !/supporter/.test(document.querySelector('.vtuto-phrase.on')?.textContent ?? '')));
  await page.evaluate(() => localStorage.removeItem('tbf_locale'));

  check('aucune erreur dans la page', erreurs.length === 0);
  if (erreurs.length) console.log(erreurs);
} finally {
  await nav.close();
  http.close();
  rmSync(dossier, { recursive: true, force: true });
}

console.log(failures ? `\n${failures} échec(s)` : '\ntout est vert');
process.exit(failures ? 1 : 0);
