#!/usr/bin/env node
/**
 * L'écran de la répétition, dans un vrai navigateur.
 *
 * ## Pourquoi un navigateur, alors que `repetition:smoke` couvre déjà la salle
 *
 * Parce que ce que cet écran promet ne vit pas dans le serveur.
 *
 * **Le pavé doit apparaître.** Le lecteur de gestes est chargé en `defer`,
 * l'écran est un script en ligne : le second s'exécute avant le premier. Cette
 * course-là ne se voit ni dans le code ni dans une lecture du fichier — elle se
 * voit quand un joueur touche une tuile et que rien ne se passe.
 *
 * **Le meilleur score doit survivre à une sortie.** Il vit dans le navigateur
 * et nulle part ailleurs : aucune requête ne le porte, aucune table ne le
 * garde. Le seul endroit où l'on peut constater qu'il tient est un navigateur.
 *
 * **Et l'écran doit dire que rien ne compte.** C'est la phrase qui fait entrer
 * quelqu'un qui n'ose pas essayer. Elle n'est pas décorative : sans elle, la
 * salle est un écran de plus où l'on a peur de mal faire.
 *
 * Usage : node scripts/repetition-ui-smoke.mjs
 * (npm install --no-save puppeteer)
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createRepetition } from '../src/server/repetition/index.js';
import { GESTES } from '../src/server/ferveur/gestures.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let ko = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) ko++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* Aucune base ici non plus : la salle n'en a pas besoin, et cette suite tient
   à le montrer autant que la précédente. */
const app = express();
app.use('/api/repetition', createRepetition().router);
app.get('/api/admin/suis-je', (_q, s) => s.json({ admin: false }));
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: 'u', pseudo: 'Banc' } }));
app.use('/api', (_q, s) => s.json({ ok: true, items: [], liste: [] }));
app.get('/repetition', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'repetition.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 390, height: 860 });
await page.goto(`${base}/repetition`, { waitUntil: 'networkidle0' });

/* ============================================================ la liste */

check('les gestes s’affichent', await jusqua(async () =>
  page.evaluate(() => document.querySelectorAll('.g').length > 0)));

const liste = await page.evaluate(() => ({
  gestes: [...document.querySelectorAll('.g')].map((b) => ({
    cle: b.dataset.g,
    nom: b.querySelector('b')?.textContent.trim(),
    dit: b.querySelector('span')?.textContent.trim() ?? '',
    best: b.querySelector('.best')?.textContent.trim() ?? '',
  })),
  familles: [...document.querySelectorAll('.fam h2')].map((h) => h.textContent.trim()),
  texte: document.body.innerText,
}));

check(`les ${GESTES.length} gestes sont là (${liste.gestes.length})`,
  liste.gestes.length === GESTES.length
  && GESTES.every((g) => liste.gestes.some((x) => x.cle === g))
  || (console.log('        manquent :',
    GESTES.filter((g) => !liste.gestes.some((x) => x.cle === g)).join(' ')), false));

check(`ils sont rangés par famille (${liste.familles.length})`, liste.familles.length >= 5);

/* Un geste sans nom ni consigne est une tuile muette : on la touche pour
   savoir ce qu'elle est, ce qui est exactement ce que cet écran doit éviter. */
check('chacun porte un nom et une consigne',
  liste.gestes.every((g) => (g.nom ?? '').length > 2 && g.dit.length > 12)
  || (console.log('        ',
    JSON.stringify(liste.gestes.find((g) => !g.dit || g.dit.length <= 12))), false));

check('aucun n’a encore de meilleur score',
  liste.gestes.every((g) => /JAMAIS/.test(g.best)));

/* **La phrase qui fait entrer.** Quelqu'un qui hésite à essayer un geste
   n'entre que si on lui dit que rien n'est en jeu — et qu'on le lui dit avant
   qu'il touche quoi que ce soit. */
check('l’écran dit que rien n’y compte', /rien ne compte/i.test(liste.texte)
  || (console.log('        il dit :', liste.texte.slice(0, 160)), false));
check('et qu’aucun Fanzzy n’y aide', /aucun fanzzy/i.test(liste.texte));

/* =========================================================== un essai */

await page.click('.g[data-g="tempo"]');
check('toucher un geste ouvre la salle', await jusqua(async () =>
  page.evaluate(() => document.getElementById('salle')?.classList.contains('on'))));

check('la salle annonce le geste et sa consigne', await page.evaluate(() =>
  document.getElementById('titre')?.textContent.trim() === 'TEMPO'
  && (document.getElementById('consigne')?.textContent ?? '').length > 12));

/* Le pavé vient de `geste.js`. S'il n'arrive pas, c'est la course entre le
   script en ligne et les scripts différés — le défaut que cette suite existe
   d'abord pour attraper. */
check('le pavé du geste apparaît', await jusqua(async () =>
  page.evaluate(() => Boolean(document.getElementById('pad')))));

/* On joue le tempo pour de vrai : la page a reçu l'intervalle du serveur, on
   le lui relit plutôt que d'en écrire un ici — un nombre recopié dans un banc
   d'essai est un nombre qui divergera. */
const joue = await page.evaluate(async () => {
  const d = await fetch('/api/repetition').then((r) => r.json());
  const t = d.gestes.tempo;
  const pad = document.getElementById('pad');
  for (let i = 0; i < t.beats; i++) {
    pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    /* Une attente qui tremble : le moteur refuse une régularité mécanique, et
       un banc qui tomberait dessus éprouverait la défense au lieu de la note. */
    await new Promise((r) => setTimeout(r, t.interval + (Math.random() - 0.5) * 30));
  }
  return t.beats;
});
check(`le tempo se joue (${joue} frappes)`, joue > 0);

check('une note s’affiche', await jusqua(async () =>
  page.evaluate(() => Boolean(document.querySelector('#resultat .n'))), 12000));

const apres = await page.evaluate(() => ({
  note: document.querySelector('#resultat .n')?.textContent.trim() ?? '',
  mot: document.querySelector('#resultat .q')?.textContent.trim() ?? '',
  record: Boolean(document.querySelector('#resultat .record')),
  boutons: document.getElementById('apres')?.style.display,
}));
check(`la note est un nombre sur un (${apres.note})`, /^0[.,]\d\d\/1$|^1[.,]00\/1$/
  .test(apres.note.replace(/\s/g, ''))
  || (console.log('        elle dit :', apres.note), false));
check(`et elle est commentée (${apres.mot})`, apres.mot.length > 2);
check('un premier essai est un record', apres.record);
check('les deux suites sont proposées', apres.boutons === 'grid');

/* ============================================== le meilleur score survit

   Il ne part sur aucune requête et ne s'écrit dans aucune table : s'il tient,
   c'est qu'il vit dans le navigateur, ce qui est exactement la promesse. */
await page.click('#autre');
check('on revient à la liste', await jusqua(async () =>
  page.evaluate(() => !document.getElementById('salle')?.classList.contains('on'))));

const garde = await page.evaluate(() =>
  document.querySelector('.g[data-g="tempo"] .best')?.textContent.trim() ?? '');
check(`le meilleur score s’affiche sur la tuile (${garde})`, /TON MEILLEUR/.test(garde)
  || (console.log('        elle dit :', garde), false));

await page.reload({ waitUntil: 'networkidle0' });
await jusqua(async () => page.evaluate(() => document.querySelectorAll('.g').length > 0));
const apresRechargement = await page.evaluate(() =>
  document.querySelector('.g[data-g="tempo"] .best')?.textContent.trim() ?? '');
check('et il survit au rechargement de la page', /TON MEILLEUR/.test(apresRechargement)
  || (console.log('        elle dit :', apresRechargement), false));

/* ======================================== sortir en cours ne note rien

   La promesse du lecteur se résout quand même quand on quitte. Noter ce
   qu'on n'a pas fini afficherait un zéro à quelqu'un qui n'a rien raté — et
   l'inscrirait comme son meilleur score s'il n'en avait aucun. */
{
  await page.click('.g[data-g="mash"]');
  await jusqua(async () => page.evaluate(() => Boolean(document.getElementById('pad'))));
  await page.click('#sortir');
  await dodo(900);
  const apresSortie = await page.evaluate(() => ({
    ouverte: document.getElementById('salle')?.classList.contains('on'),
    best: document.querySelector('.g[data-g="mash"] .best')?.textContent.trim() ?? '',
  }));
  check('sortir referme la salle', apresSortie.ouverte === false);
  check('et n’inscrit aucun score pour un geste abandonné',
    /JAMAIS/.test(apresSortie.best)
    || (console.log('        elle dit :', apresSortie.best), false));
}

/* ================================================= rien ne fuit à l'écran */
{
  const t = await page.evaluate(() => document.body.innerText);
  const fuites = ['undefined', 'NaN', '[object Object]', 'repetition.error']
    .filter((m) => t.includes(m));
  check('aucune fuite technique à l’écran', fuites.length === 0
    || (console.log('        ', fuites.join(' · ')), false));
}

check('aucune erreur de script', erreurs.length === 0
  || (console.log('        ', erreurs.slice(0, 3).join(' · ')), false));

await nav.close();
await new Promise((r) => http.close(r));
console.log(`\n${ko ? `${ko} échec(s)` : 'tout est vert'}`);
process.exitCode = ko ? 1 : 0;
