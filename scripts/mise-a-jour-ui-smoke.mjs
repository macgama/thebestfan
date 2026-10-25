/**
 * La mise à jour des joueurs restés sur une page d'hier.
 *
 * Une application posée sur l'écran d'un téléphone ne navigue pas : on la
 * rouvre, elle revient telle qu'on l'avait laissée, avec le code d'avant la
 * mise en ligne. `pwa.js` compare la construction de la page à celle que sert
 * `/api/version`, et recharge quand elles diffèrent. Ce qui s'y joue :
 *
 *   1. **Rien ne bouge tant que rien n'a changé.** Un écran qui recouvrirait le
 *      jeu sans raison serait pire que la panne qu'il répare.
 *   2. **Une mise en ligne fait recharger**, derrière un écran qui le dit, et
 *      la page revient avec la nouvelle construction.
 *   3. **Un proxy qui s'obstine ne fait pas boucler la page** : deux essais,
 *      puis on laisse la page d'hier plutôt qu'une page qui se recharge sans fin.
 *   4. **Un joueur qui écrit ne perd pas ce qu'il tape.**
 *   5. Les deux repères du serveur (`src/server/construction.js`).
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { empreinteDuJeu, commitDuDepot } from '../src/server/construction.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    // En plein rechargement, la page ne répond pas : on réessaie.
    if (await fn().catch(() => false)) return true;
    await dodo(70);
  }
  return false;
}

/* ------------------------------------------------- les repères du serveur */
{
  const d = mkdtempSync(path.join(os.tmpdir(), 'tbf-construction-'));
  mkdirSync(path.join(d, 'img'));
  writeFileSync(path.join(d, 'a.js'), 'un');
  writeFileSync(path.join(d, 'img', 'x.png'), 'dessin');
  const e1 = empreinteDuJeu(d);
  check('l’empreinte du jeu se calcule', /^[0-9a-f]{12}$/.test(e1 ?? ''));
  check('elle est stable', empreinteDuJeu(d) === e1);
  writeFileSync(path.join(d, 'img', 'x.png'), 'autre dessin');
  check('un dessin ne la change pas (il a sa propre adresse)', empreinteDuJeu(d) === e1);
  writeFileSync(path.join(d, 'a.js'), 'deux');
  check('un script changé la change', empreinteDuJeu(d) !== e1);
  check('un dossier absent ne lève pas', empreinteDuJeu(path.join(d, 'rien')) === null);

  const sha = 'a'.repeat(40);
  mkdirSync(path.join(d, '.git', 'refs', 'heads'), { recursive: true });
  writeFileSync(path.join(d, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(path.join(d, '.git', 'refs', 'heads', 'main'), `${sha}\n`);
  check('le commit se lit dans la branche', commitDuDepot(d) === sha);
  rmSync(path.join(d, '.git', 'refs', 'heads', 'main'));
  writeFileSync(path.join(d, '.git', 'packed-refs'),
    `# pack-refs with: peeled\n${'b'.repeat(40)} refs/heads/main\n`);
  check('et dans packed-refs après un git gc', commitDuDepot(d) === 'b'.repeat(40));
  writeFileSync(path.join(d, '.git', 'HEAD'), `${'c'.repeat(40)}\n`);
  check('et détaché', commitDuDepot(d) === 'c'.repeat(40));
  check('sans dépôt : null', commitDuDepot(path.join(d, 'img')) === null);
  rmSync(d, { recursive: true, force: true });

  /* `page()` pose bien la balise que `pwa.js` lit : sans elle, une page ne
     saurait jamais de quelle construction elle est. */
  const serveur = readFileSync(path.join(RACINE, 'server.js'), 'utf8');
  check('server.js marque les pages et dit la construction',
    /marquer\(estampiller\(/.test(serveur) && /construction: CONSTRUCTION/.test(serveur));
}

/* ------------------------------------------------------------- le banc */

let deLaPage = 'aaaaaaaaaaaa'; // la construction écrite dans les pages servies
let duServeur = 'aaaaaaaaaaaa'; // celle que dit /api/version
let chargements = 0;
const app = express();
app.get('/', (q, s) => {
  chargements++;
  s.set('cache-control', 'no-store').type('html').send(
    `<!DOCTYPE html><html lang="fr"><head>
     <meta name="tbf-construction" content="${deLaPage}"><meta charset="utf-8"><title>banc</title></head>
     <body><input id="champ"><script src="/pwa.js"></script></body></html>`);
});
app.get('/api/version', (_q, s) => s.set('cache-control', 'no-store')
  .json({ numero: '0.0200', construction: duServeur }));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
const page = await nav.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 880 });

const construction = () => page.evaluate(
  () => document.querySelector('meta[name="tbf-construction"]')?.content);
const ecran = () => page.evaluate(() => document.getElementById('tbf-maj')?.textContent ?? null);

/* 1. Rien n'a changé. */
await page.goto(base + '/', { waitUntil: 'networkidle0' });
await page.evaluate(() => { window.TBF_MAJ.verifier(); });
await dodo(600);
check('même construction : pas d’écran, pas de rechargement',
  (await ecran()) === null && chargements === 1);
check('la page ne lève aucune erreur', erreurs.length === 0
  || (console.log('   ', erreurs.slice(0, 2)), false));

/* 2. Une mise en ligne : le serveur sert une autre construction, et ses pages
      la portent. La page ouverte, elle, est restée d'hier. */
deLaPage = 'bbbbbbbbbbbb';
duServeur = 'bbbbbbbbbbbb';
await page.evaluate(() => { window.TBF_MAJ.verifier(); });
check('une mise en ligne montre l’écran de mise à jour',
  await jusqua(async () => /MISE À JOUR/.test((await ecran()) ?? '')));
check('puis la page revient avec la nouvelle construction',
  await jusqua(async () => {
    try { return (await construction()) === 'bbbbbbbbbbbb' && (await ecran()) === null; }
    catch { return false; } // en plein rechargement
  }));
await dodo(500);
check('en un seul rechargement', chargements === 2 || (console.log('        chargements :', chargements), false));
check('et sans laisser de suivi derrière elle',
  await page.evaluate(() => sessionStorage.getItem('tbf-maj')) === null);

/* 3. Un proxy qui garde l'ancienne page : le serveur dit « cccc », la page
      revient toujours « bbbb ». Deux essais — le second par une autre adresse —
      puis plus rien. */
duServeur = 'cccccccccccc';
const avant = chargements;
await page.evaluate(() => { window.TBF_MAJ.verifier(); });
await jusqua(async () => chargements >= avant + 2, 10000);
await dodo(2500);
check('un proxy obstiné : deux essais, pas un de plus',
  chargements === avant + 2 || (console.log('        chargements :', chargements - avant), false));
check('et l’adresse perd le ?maj= du second essai',
  await jusqua(async () => !(await page.evaluate(() => location.search)).includes('maj')));
await page.evaluate(() => { window.TBF_MAJ.verifier(); });
await dodo(1800);
check('ensuite on n’insiste plus pour cette construction', chargements === avant + 2);

/* 4. Un joueur qui écrit : l'écran attend qu'il quitte le champ. */
duServeur = 'dddddddddddd';
deLaPage = 'dddddddddddd';
const avantChamp = chargements;
await page.focus('#champ');
await page.keyboard.type('mon message');
await page.evaluate(() => { window.TBF_MAJ.verifier(); });
await dodo(1800);
check('pendant qu’il écrit, rien ne se recharge',
  chargements === avantChamp && (await ecran()) === null);
await page.evaluate(() => document.activeElement.blur());
check('il quitte le champ : la mise à jour passe',
  await jusqua(async () => {
    try { return (await construction()) === 'dddddddddddd'; } catch { return false; }
  }));

/* 5. Une page sans balise prend la première réponse pour repère. */
{
  const app2 = express();
  app2.get('/', (_q, s) => s.type('html').send(
    '<!DOCTYPE html><html><head><title>nue</title></head><body><script src="/pwa.js"></script></body></html>'));
  app2.get('/api/version', (_q, s) => s.json({ construction: 'eeeeeeeeeeee' }));
  app2.use(express.static(path.join(RACINE, 'public')));
  const h2 = createServer(app2);
  await new Promise((r) => h2.listen(0, r));
  const p2 = await nav.newPage();
  await p2.goto(`http://localhost:${h2.address().port}/`, { waitUntil: 'networkidle0' });
  await p2.evaluate(() => { window.TBF_MAJ.verifier(); });
  await dodo(800);
  check('une page sans balise ne se recharge pas pour rien',
    await p2.evaluate(() => !document.getElementById('tbf-maj')));
  await p2.close();
  h2.close();
}

/* 6. Sans la route — l'ancien serveur, un banc d'essai : rien. */
{
  const app3 = express();
  app3.get('/', (_q, s) => s.type('html').send(
    '<!DOCTYPE html><html><head><meta name="tbf-construction" content="ffffffffffff"></head>'
    + '<body><script src="/pwa.js"></script></body></html>'));
  app3.use(express.static(path.join(RACINE, 'public')));
  const h3 = createServer(app3);
  await new Promise((r) => h3.listen(0, r));
  const p3 = await nav.newPage();
  const err3 = [];
  p3.on('pageerror', (e) => err3.push(e.message));
  await p3.goto(`http://localhost:${h3.address().port}/`, { waitUntil: 'networkidle0' });
  await p3.evaluate(() => { window.TBF_MAJ.verifier(); });
  await dodo(800);
  check('sans /api/version, la page reste tranquille',
    err3.length === 0 && await p3.evaluate(() => !document.getElementById('tbf-maj')));
  await p3.close();
  h3.close();
}

await nav.close();
http.close();
console.log(failures ? `\n${failures} échec(s)` : '\ntout est vert');
process.exit(failures ? 1 : 0);
