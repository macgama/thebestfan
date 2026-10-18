/**
 * La page des mini-jeux, dans un vrai navigateur, sur des réponses de serveur
 * écrites à la main : on jongle en touchant le ballon, on tire en
 * arrêtant la visée puis en chargeant la puissance, on plonge en glissant le
 * doigt, et l'on regarde ce que la page envoie.
 *
 * Aucune base : rien ici ne passe par le serveur du jeu.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import {
  JONGLES, TIRS, jeuDeTirs, scoreDeJongles, partitionDuChant, noterChant, rejouerCourse, motifDuTifo,
} from '../src/shared/mini-jeux.js';
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
check('et avec les forces des tirs', pageT && pageT.FORCE_MAX === TIRS.FORCE_MAX
  && pageT.FORCE_ARRET === TIRS.FORCE_ARRET && pageT.NOMBRE === TIRS.NOMBRE);

/* Le chant et la course sont recopiés mot pour mot dans leurs scripts. */
const partage = readFileSync(path.join(RACINE, 'src/shared/mini-jeux.js'), 'utf8');
const bloc = (texte, nom) => {
  const a = texte.indexOf(`/* @page:debut ${nom} */`);
  const b = texte.indexOf(`/* @page:fin ${nom} */`);
  return a < 0 || b < 0 ? null : texte.slice(a, b);
};
for (const [nom, fichier] of [['chant', 'jeux-chant.js'], ['course', 'jeux-course.js']]) {
  const page = readFileSync(path.join(RACINE, 'public', fichier), 'utf8');
  check(`la page recopie les règles du ${nom === 'chant' ? 'chant' : 'déplacement'} mot pour mot`,
    bloc(partage, nom) !== null && bloc(page, nom) === bloc(partage, nom));
}

/* --------------------------------------------------- les réponses servies */

const recu = { jongles: null, tirs: null, vus: 0, chant: null, course: null, tifo: [] };
const GRAINE = 4242;
const motif = motifDuTifo('OL');
const casesLevees = motif.map((c, i) => (i % 5 ? c : null));
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
app.post('/api/jeux/partie/:jeu', (q, s) => s.json({ id: 50, graine: GRAINE }));
app.post('/api/jeux/partie/chant/:id', (q, s) => {
  recu.chant = q.body;
  const b = noterChant(partitionDuChant(GRAINE), q.body.frappes);
  s.json({ ...b, echarpes: 3, record: b.score, nouveauRecord: true });
});
app.post('/api/jeux/partie/deplacement/:id', (q, s) => {
  recu.course = q.body;
  const c = rejouerCourse(GRAINE, q.body.gestes);
  s.json({ ...c, echarpes: 1, record: c.score, nouveauRecord: false });
});
app.get('/api/jeux/tifo', (_q, s) => s.json({ actif: true,
  club: { id: 80, nom: 'Lyon', lettres: 'OL', couleurs: ['#1B3A8C', '#E5484D', '#F2EEE4'] },
  motif, casesJour: 15, mesCasesAujourdhui: 2, seuil: 60, gain: 15,
  prochain: { id: 900, coupEnvoi: '2026-10-20 19:00:00', adversaire: 'Monaco', domicile: true,
    cases: new Array(240).fill(null), peintres: 3, fidelite: 0.12 },
  leve: { id: 899, coupEnvoi: '2026-10-17 19:00:00', adversaire: 'Nice', domicile: false,
    cases: casesLevees, peintres: 9, fidelite: 0.8, reussi: true, verse: 15 } }));
app.post('/api/jeux/tifo', (q, s) => { recu.tifo.push(q.body); s.json({ ok: true, mesCasesAujourdhui: 3 }); });
app.get('/api/jeux/boss', (_q, s) => s.json({ actif: true, club: { id: 80, nom: 'Lyon' }, gain: 20,
  semaine: { lundi: '2026-10-12', voix: 40, retire: 10, mesCoups: 3, tombe: false, verse: 0 },
  precedente: { lundi: '2026-10-05', voix: 40, retire: 41, mesCoups: 2, tombe: true, verse: 0 } }));
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
/* Viser, charger, plonger : chaque geste part de la page elle-même, à l'image
   près où le curseur ou la jauge passe dans la bande voulue (`T`, déclaré au
   niveau du script), pour ne pas dépendre du temps que met Puppeteer. */
const geste = (type, quand, x, y) => page.evaluate((type, quand, x, y) => new Promise((ok) => {
  const c = document.getElementById('t-canvas');
  const r = c.getBoundingClientRect();
  const pas = () => {
    // eslint-disable-next-line no-new-func
    if (!Function('T', `return ${quand}`)(T)) { requestAnimationFrame(pas); return; } // eslint-disable-line no-undef
    c.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1,
      clientX: r.left + r.width * x, clientY: r.top + r.height * y }));
    ok();
  };
  pas();
}), type, quand, x, y);
const phase = (p) => jusqua(() => page.evaluate((p) => T.phase === p, p), 5000); // eslint-disable-line no-undef
for (let i = 0; i < TIRS.NOMBRE; i++) {
  await phase('visee');
  /* La visée arrêtée dans le tiers gauche du cadre. */
  await geste('pointerdown', "T.phase === 'visee' && T.curseur > 0.08 && T.curseur < 0.25", 0.5, 0.6);
  await geste('pointerup', 'true', 0.5, 0.6);
  if (i === 0) await capture(page, 'tirs-visee');
  /* La puissance lâchée dans la bande d'or : la lucarne. */
  await geste('pointerdown', "T.phase === 'puissance'", 0.5, 0.6);
  await geste('pointerup', 'T.puissance > 0.76 && T.puissance < 0.86', 0.5, 0.6);
  await phase('arret');
  if (i === 0) await capture(page, 'tirs-plongeon');
  /* Un geste vers la droite, sans monter : plongeon au ras du sol à droite. */
  await geste('pointerdown', 'true', 0.5, 0.5);
  await geste('pointermove', 'true', 0.8, 0.52);
  await geste('pointerup', 'true', 0.8, 0.52);
  await jusqua(() => page.evaluate(() => T.phase === 'visee' || T.tour >= 5), 4000); // eslint-disable-line no-undef
}
check('la série s’envoie après cinq tirs et cinq plongeons', await jusqua(async () => recu.tirs != null));
const jeu = jeuDeTirs(recu.tirs?.jeu);
check('le jeu envoyé est valide', jeu !== null && !recu.tirs.ami);
check('visée à gauche et puissance dans l’or : la lucarne gauche',
  jeu?.tirs.every((t) => t.zone === 3 && t.force >= 0.7 && t.force <= TIRS.FORCE_MAX));
check('le doigt glissé à droite plonge en bas à droite', jeu?.arrets.every((z) => z === 2));
check('le résultat s’affiche', await jusqua(() => page.evaluate(() =>
  !document.getElementById('t-fin').hidden
  && document.getElementById('t-score').textContent === '3 – 2'
  && document.getElementById('t-resume').textContent.includes('+10 écharpes'))));

await capture(page, 'tirs-fin');

/* ------------------------------------------------------- le chant en rythme */

await page.evaluate(() => window.scrollTo(0, 0));
await page.click('[data-tab="chant"]');
check('l’onglet du chant s’ouvre, et l’adresse le garde', await page.evaluate(() =>
  !document.getElementById('v-chant').hidden && document.getElementById('v-jongles').hidden
  && location.hash === '#chant'));
await page.click('#ch-jouer');
await jusqua(() => page.evaluate(() => !document.getElementById('ch-terrain').hidden && CH.partition)); // eslint-disable-line no-undef
/* Chaque note frappée à son instant, sur son tambour : la page programme
   elle-même ses toucher, pour ne pas dépendre du temps que met Puppeteer. */
await page.evaluate(() => {
  const c = document.getElementById('ch-canvas');
  const r = c.getBoundingClientRect();
  /* eslint-disable no-undef */
  for (const n of CH.partition.notes) {
    setTimeout(() => c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 2,
      clientX: r.left + r.width * (n.c + 0.5) / 3, clientY: r.top + r.height * 0.8 })),
    CH.t0 + n.t - performance.now());
  }
  /* eslint-enable no-undef */
});
await dodo(6000);
await capture(page, 'chant-jeu');
check('le chant joué s’envoie à la fin', await jusqua(async () => recu.chant != null, 45000));
const noteChant = noterChant(partitionDuChant(GRAINE), recu.chant?.frappes ?? []);
check('ce que la page envoie, le serveur le note presque tout PARFAIT', noteChant
  && noteChant.reussis === partitionDuChant(GRAINE).notes.length
  && noteChant.parfaits >= noteChant.reussis * 0.9);
check('le bilan dit le score, le record et les écharpes', await jusqua(() => page.evaluate((sc) =>
  !document.getElementById('ch-fin').hidden && document.getElementById('ch-total').textContent === String(sc)
  && document.getElementById('ch-bilan').textContent.includes('+3 écharpes'), noteChant?.score)));
await capture(page, 'chant-fin');

/* ------------------------------------------------------------ le déplacement */

await page.evaluate(() => window.scrollTo(0, 0));
await page.click('[data-tab="deplacement"]');
await page.click('#d-jouer');
await jusqua(() => page.evaluate(() => !document.getElementById('d-terrain').hidden && D.course)); // eslint-disable-line no-undef
/* Un coureur appliqué pendant huit secondes, puis plus rien : il finit par
   tomber. La page lit la route et touche l'écran au bon moment. */
await page.evaluate(() => new Promise((ok) => {
  const c = document.getElementById('d-canvas');
  const fin = performance.now() + 8000;
  /* eslint-disable no-undef */
  const pas = () => {
    if (performance.now() > fin || D.fini) { ok(); return; }
    const s = D.course.etat;
    const devant = s.route.find((o) => o.type !== 'ticket' && o.x + o.l > s.dist + COURSE.X);
    if (devant && s.y === 0 && !D.attente) {
      const d = devant.x - (s.dist + COURSE.X + COURSE.LARGEUR);
      if (devant.type === 'peage' && d < s.v * 0.2 && s.glisse < 2) {
        c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 100 }));
        c.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientY: 160 }));
        c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: 160 }));
      } else if (devant.type !== 'peage' && d < s.v * 0.12 + 8 && d > 0) {
        c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientY: 100 }));
        c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientY: 100 }));
      }
    }
    requestAnimationFrame(pas);
  };
  /* eslint-enable no-undef */
  pas();
}));
await capture(page, 'deplacement-jeu');
check('la course finit par tomber, et s’envoie', await jusqua(async () => recu.course != null, 30000));
const local = await page.evaluate(() => ({ ...scoreDeCourse(D.course.etat), images: D.course.etat.image })); // eslint-disable-line no-undef
const rejoue = rejouerCourse(GRAINE, recu.course?.gestes ?? []);
check('le serveur rejoue exactement la course de la page', rejoue && rejoue.images === local.images
  && rejoue.score === local.score && local.metres > 60 && recu.course.gestes.length > 0);
check('le bilan dit les mètres', await jusqua(() => page.evaluate((m) =>
  !document.getElementById('d-fin').hidden && document.getElementById('d-total').textContent === `${m} m`,
local.metres)));
await capture(page, 'deplacement-fin');

/* -------------------------------------------------------------------- le tifo */

await page.evaluate(() => window.scrollTo(0, 0));
await page.click('[data-tab="tifo"]');
check('le tifo du prochain match : 240 cases, la palette du club', await jusqua(() => page.evaluate(() =>
  document.querySelectorAll('#tf-corps .tifo i').length === 240
  && document.querySelectorAll('.palette button').length === 3
  && document.getElementById('tf-corps').textContent.includes('Monaco'))));
await page.click('.palette [data-couleur="1"]');
await page.click('#tf-corps .tifo i[data-n="27"]');
check('une case touchée part au serveur, de la couleur choisie', await jusqua(async () =>
  recu.tifo.length === 1 && recu.tifo[0].case === 27 && recu.tifo[0].couleur === 1 && recu.tifo[0].match === 900));
check('et se peint aussitôt', await jusqua(() => page.evaluate(() => {
  const i = document.querySelector('#tf-corps .tifo i[data-n="27"]');
  return i.classList.contains('moi') && !i.classList.contains('vide')
    && document.getElementById('tf-reste').textContent === '12';
})));
check('le tifo du dernier match est levé, réussi', await page.evaluate(() =>
  !document.getElementById('tf-leve').hidden
  && document.getElementById('tf-leve').textContent.includes('TIFO RÉUSSI')
  && document.querySelectorAll('#tf-leve .tifo i.vide').length === 48));
await capture(page, 'tifo');

/* --------------------------------------------------------------------- le boss */

await page.evaluate(() => window.scrollTo(0, 0));
await page.click('[data-tab="boss"]');
check('le boss de la semaine : son nom, sa voix qui baisse', await jusqua(() => page.evaluate(() =>
  document.querySelector('.boss-nom')?.textContent.length > 3
  && document.querySelector('.voix i')?.style.width === '75%'
  && document.getElementById('b-corps').textContent.includes('Tes chants : 3'))));
await capture(page, 'boss');
await page.click('[data-aller="chant"]');
check('le boss envoie vers le chant en rythme', await page.evaluate(() =>
  !document.getElementById('v-chant').hidden));

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
