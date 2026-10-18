/**
 * La page des mini-jeux, dans un vrai navigateur, sur des réponses de serveur
 * écrites à la main : on jongle en touchant le ballon, on tire en glissant le
 * doigt, on plonge en touchant le but, et l'on regarde ce que la page envoie.
 *
 * Aucune base : rien ici ne passe par le serveur du jeu.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { JONGLES, TIRS, jeuDeTirs, scoreDeJongles } from '../src/shared/mini-jeux.js';
import { controlerColonne } from './colonne-ui.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* ---------------------------------------- la page recopie bien les règles */

const source = readFileSync(path.join(RACINE, 'public/jeux.html'), 'utf8');
const lu = (nom) => {
  const m = source.match(new RegExp(`const ${nom} = (\\{[^}]*\\});`));
  return m ? Function(`return (${m[1]})`)() : null;
};
const pageJ = lu('JONGLES');
const pageT = lu('TIRS');
check('la page joue avec la physique des jongles du serveur', pageJ
  && Object.entries(pageJ).every(([k, v]) => JONGLES[k] === v));
check('et avec la force maximale des tirs', pageT && pageT.FORCE_MAX === TIRS.FORCE_MAX
  && pageT.NOMBRE === TIRS.NOMBRE);

/* --------------------------------------------------- les réponses servies */

const recu = { jongles: null, tirs: null, vus: 0 };
const etat = () => ({
  actif: true, saison: { id: 1, numero: 1, nom: 'La reprise' }, avatar: null,
  echarpes: { aujourdhui: 6, plafond: 40 },
  gains: { jongles: { parEcharpe: 5, maxPartie: 15 }, tirs: { victoire: 10, nul: 4, defaite: 1 } },
  jongles: { record: 12, parties: 3 },
  tirs: { aRelever: 1, nouveaux: 1, series: [
    { id: 7, ami: true, etat: 'a_relever', adversaire: { pseudo: 'Bruno' } },
    { id: 8, ami: false, etat: 'jouee', nouveau: true, adversaire: { pseudo: 'Chloe' }, issue: 'victoire',
      mesButs: 4, sesButs: 2, coups: [] },
  ] },
});
const app = express();
app.use(express.json());
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: 'p1', pseudo: 'Alice' } }));
app.get('/api/jeux', (_q, s) => s.json(etat()));
app.get('/api/jeux/classement/:jeu', (q, s) => s.json({ jeu: q.params.jeu, portee: q.query.portee,
  total: 2, moi: { rang: 2, valeur: 12 },
  lignes: [{ rang: 1, pseudo: 'Bruno', valeur: 31, parties: 4, victoires: 2, nuls: 0, defaites: 1 },
    { rang: 2, pseudo: 'Alice', valeur: 12, parties: 3, moi: true, victoires: 1, nuls: 1, defaites: 0 }] }));
app.post('/api/jeux/tirs-vus', (_q, s) => { recu.vus++; s.json({ ok: true }); });
app.post('/api/jeux/jongles', (_q, s) => s.json({ id: 99, graine: 12345 }));
app.post('/api/jeux/jongles/:id', (q, s) => {
  recu.jongles = q.body;
  s.json({ score: q.body.score, echarpes: 2, record: Math.max(12, q.body.score), nouveauRecord: false });
});
app.post('/api/jeux/tirs', (q, s) => {
  recu.tirs = q.body;
  s.json({ id: 3, etat: 'jouee', mesButs: 3, sesButs: 2, issue: 'victoire', echarpes: 10,
    coups: Array.from({ length: 10 }, (_, i) => ({ tireur: i % 2 ? 'b' : 'a', moi: !(i % 2), issue: 'but' })) });
});
app.get('/jeux', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'jeux.html')));
app.use(express.static(path.join(RACINE, 'public')));
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 860 });
await page.goto(`${base}/jeux`, { waitUntil: 'networkidle0' });

check('la page dit la saison et les écharpes du jour', await jusqua(() => page.evaluate(() =>
  document.getElementById('saison').textContent.includes('La reprise')
  && document.getElementById('jour').textContent.includes('6 / 40'))));
check('le record et le classement des jongles', await page.evaluate(() =>
  document.getElementById('j-record').textContent === '12'
  && document.querySelectorAll('#c-jongles .ligne').length === 2
  && document.querySelector('#c-jongles .ligne.moi .ps')?.textContent === 'Alice'));
check('un résultat neuf est marqué vu', await jusqua(async () => recu.vus === 1));

/* ------------------------------------------------------------ les jongles */

await page.click('#j-jouer');
await jusqua(() => page.evaluate(() => !document.getElementById('j-terrain').hidden));
/* On touche le ballon chaque fois qu'il redescend à mi-hauteur : la page dit
   où il est (`J`, déclaré au niveau du script). */
const touche = async () => {
  const p = await page.evaluate(() => {
    const c = document.getElementById('j-canvas').getBoundingClientRect();
    const k = c.width / 360;
    // eslint-disable-next-line no-undef
    return { x: c.left + J.balle.x * k, y: c.top + J.balle.y * k, vy: J.balle.vy, fini: J.fini };
  });
  return p;
};
let p = await touche();
await page.mouse.click(p.x, p.y);
let frappes = 1;
const t0 = Date.now();
while (frappes < 6 && Date.now() - t0 < 15000) {
  p = await touche();
  if (p.fini) break;
  if (p.vy > 0 && p.y > 330) { await page.mouse.click(p.x, p.y); frappes++; await dodo(150); }
  else await dodo(16);
}
check('on jongle en touchant le ballon', await page.evaluate(() =>
  Number(document.getElementById('j-compte').textContent)) >= 5);
check('le ballon finit par tomber, et la partie s’envoie', await jusqua(async () => recu.jongles != null, 15000));
/* `CAPTURES=<dossier>` : des captures pour les montrer, sans rien contrôler de plus. */
const capture = async (pg, nom) => process.env.CAPTURES
  && pg.screenshot({ path: path.join(process.env.CAPTURES, `${nom}.png`) });
await dodo(400);
await capture(page, 'jongles-fin');
const { score, frappes: f } = recu.jongles ?? {};
check('ce que la page envoie, le serveur l’accepte', Number.isInteger(score) && score >= 5
  && scoreDeJongles(score, f, f.at(-1) + 500) === score);
check('le bilan dit le score et les écharpes', await jusqua(() => page.evaluate(() =>
  !document.getElementById('j-fin').hidden
  && document.getElementById('j-bilan').textContent.includes('+2 écharpes'))));

/* ------------------------------------------------------------ les tirs */

await page.click('[data-tab="tirs"]');
check('le défi d’un ami attend d’être relevé', await page.evaluate(() =>
  document.querySelector('[data-relever="7"]') !== null));
await page.click('#t-hasard');
await jusqua(() => page.evaluate(() => !document.getElementById('t-terrain').hidden));
const terrain = await page.evaluate(() => {
  const r = document.getElementById('t-canvas').getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
for (let i = 0; i < TIRS.NOMBRE; i++) {
  /* Un geste du point de penalty vers le haut à gauche du but. */
  const de = { x: terrain.x + terrain.w / 2, y: terrain.y + terrain.h * 0.82 };
  const vers = { x: terrain.x + terrain.w * 0.2, y: terrain.y + terrain.h * 0.16 };
  await page.mouse.move(de.x, de.y);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) {
    await page.mouse.move(de.x + (vers.x - de.x) * k / 6, de.y + (vers.y - de.y) * k / 6);
    await dodo(30);
  }
  await page.mouse.up();
  await jusqua(() => page.evaluate(() => T.phase === 'arret'), 4000); // eslint-disable-line no-undef
  if (i === 0) await capture(page, 'tirs-plongeon');
  /* Plonger en bas à droite. */
  await page.mouse.click(terrain.x + terrain.w * 0.8, terrain.y + terrain.h * 0.36);
  await jusqua(() => page.evaluate(() => T.phase === 'tir' || T.tour >= 5), 4000); // eslint-disable-line no-undef
}
check('la série s’envoie après cinq tirs et cinq plongeons', await jusqua(async () => recu.tirs != null));
const jeu = jeuDeTirs(recu.tirs?.jeu);
check('le jeu envoyé est valide', jeu !== null && !recu.tirs.ami);
check('les tirs vont où le doigt les envoie, en haut à gauche',
  jeu?.tirs.every((t) => t.zone === 3 && t.force > 0));
check('les plongeons aussi, en bas à droite', jeu?.arrets.every((z) => z === 2));
check('le résultat s’affiche', await jusqua(() => page.evaluate(() =>
  !document.getElementById('t-fin').hidden
  && document.getElementById('t-score').textContent === '3 – 2'
  && document.getElementById('t-resume').textContent.includes('+10 écharpes'))));

await capture(page, 'tirs-fin');
await page.close();
const p2 = await nav.newPage();
await p2.setViewport({ width: 1366, height: 900 });
await p2.goto(`${base}/jeux`, { waitUntil: 'networkidle0' });
await controlerColonne(p2, check, { nom: 'les mini-jeux' });

check('aucune erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));
await nav.close();
http.close();
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
