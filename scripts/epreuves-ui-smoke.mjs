/**
 * Les cinq épreuves, jouées à la main dans un vrai navigateur.
 *
 * `epreuves.js` est éprouvé sur banc — il note ce qu'on lui donne. Ce qu'aucun
 * banc ne dit, c'est si la page **produit** ce qu'il attend : un tracé en
 * coordonnées de zéro à un, une grille de la bonne taille, une suite. Entre le
 * pointeur et l'objet rendu il y a un `getBoundingClientRect` et une division,
 * et c'est exactement le genre de calcul qui se trompe en silence — la note
 * tombe, le joueur ne comprend pas, et rien ne rougit.
 *
 * On ne simule donc pas la réponse : on la **fait produire** par le fichier de
 * la page, avec de vrais événements de pointeur, puis on la donne au serveur.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { resoudreGeste, grade } from '../src/server/ferveur/gestures.js';

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await nav.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 880 });
await page.setContent('<div id="zone" style="width:320px;height:320px"></div>');
await page.evaluate(readFileSync('public/geste.js', 'utf8'));

let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

/* La graine décide de la forme, de la grille et de la suite. On en prend une
   qui donne autre chose qu'un rond — le générateur a déjà rendu quatre fois la
   même forme sur quatre graines, et un contrôle qui n'éprouve qu'un cas ne
   l'aurait pas vu. */
const GRAINE = 9;
const gestes = resoudreGeste({}, { motif: GRAINE });
console.log(`   forme du tifo : ${gestes.tifo.forme} · suite du capo : ${gestes.capo.suite.join('')}`);

/* ---------------------------------------------------------------- le tifo */
{
  const reponse = await page.evaluate(async (g) => {
    const p = window.TBF_GESTE.jouer('tifo', g, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    const r = pad.getBoundingClientRect();
    const env = (x, y, type) => pad.dispatchEvent(new PointerEvent(type, {
      clientX: r.left + x * r.width, clientY: r.top + y * r.height, bubbles: true }));
    const pts = g.tifo.points;
    env(pts[0].x, pts[0].y, 'pointerdown');
    // Trois points par segment : un doigt rend bien plus de points que la
    // forme n'en compte, et le tracé doit rester noté plein pour autant.
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      for (let k = 0; k < 3; k++) {
        env(a.x + (b.x - a.x) * (k / 3), a.y + (b.y - a.y) * (k / 3), 'pointermove');
      }
    }
    env(pts[0].x, pts[0].y, 'pointermove');
    return p;
  }, gestes);
  check('le tifo rend un tracé', Array.isArray(reponse?.trace) && reponse.trace.length > 40);
  const note = grade('tifo', reponse, {}, { motif: GRAINE });
  check(`et suivre le modèle vaut plein (${note.toFixed(2)})`, note > 1);

  /* Le même tracé décalé d'un quart de cadre : la page pourrait rendre des
     coordonnées d'écran au lieu de coordonnées de cadre, et on ne le verrait
     qu'à la note. Ce contrôle-ci dit que la note dépend bien de l'endroit. */
  const ailleurs = { trace: reponse.trace.map((p) => ({ x: p.x * 0.4, y: p.y * 0.4 })) };
  check('et tracer ailleurs ne vaut plus rien',
    grade('tifo', ailleurs, {}, { motif: GRAINE }) < 0.3);

  /* Les **mêmes points, dans le désordre**. Précision identique — ils sont
     tous sur le trait. Couverture identique — ils couvrent toute la forme.
     Seul l ordre change, et il doit suffire à tout perdre : c est ce qui
     sépare un tracé d un gribouillis, et rien d autre ne le mesure.

     Sans ce contrôle, retirer le facteur d ordre laissait la suite verte. */
  /* La permutation est **tirée avec une graine fixe**, et on en essaie huit.
     Avec `Math.random()`, ce contrôle échouait une fois sur deux autour de la
     barre : on aurait fini par le relancer jusqu'au vert, ce qui revient à ne
     plus l'avoir. On juge la pire des huit — un gribouillis n'a pas droit à la
     chance. */
  let graineMelange = 20260912;
  const dé = () => (graineMelange = (graineMelange * 16807) % 2147483647) / 2147483647;
  let pire = 0;
  for (let essai = 0; essai < 8; essai++) {
    const melange = [...reponse.trace];
    for (let i = melange.length - 1; i > 0; i--) {
      const j = Math.floor(dé() * (i + 1));
      [melange[i], melange[j]] = [melange[j], melange[i]];
    }
    pire = Math.max(pire, grade('tifo', { trace: melange }, {}, { motif: GRAINE }));
  }
  check(`et les mêmes points dans le désordre ne valent rien (au pire ${pire.toFixed(2)})`,
    pire < 0.25);
}

/* ------------------------------------------------------------ la mosaïque */
{
  const g = gestes.mosaique;
  const allumees = g.grille.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const res = await page.evaluate(async (gestes, cases) => {
    const p = window.TBF_GESTE.jouer('mosaique', gestes, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    const avant = [...pad.children].filter((c) => c.classList.contains('on')).length;
    await new Promise((r) => setTimeout(r, gestes.mosaique.apercu + 150));
    const apres = [...pad.children].filter((c) => c.classList.contains('on')).length;
    for (const i of cases) {
      pad.children[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 110));
    }
    return { reponse: await p, avant, apres };
  }, gestes, allumees);

  check('la mosaïque montre la grille pendant l’aperçu', res.avant === g.allumees);
  /* Le contrôle qui porte tout : si la grille restait allumée, on recopierait
     au lieu de retenir, et l'épreuve ne mesurerait plus rien du tout. */
  check('puis l’éteint avant de laisser jouer', res.apres === 0);
  const note = grade('mosaique', res.reponse, {}, { motif: GRAINE });
  check(`et la refaire exactement vaut plein (${note.toFixed(2)})`, note >= 1);
}

/* ---------------------------------------------------------------- le capo */
{
  const g = gestes.capo;
  const reponse = await page.evaluate(async (gestes) => {
    const p = window.TBF_GESTE.jouer('capo', gestes, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    await new Promise((r) => setTimeout(r, gestes.capo.pas * (gestes.capo.suite.length + 2)));
    for (const z of gestes.capo.suite) {
      pad.children[z].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 130));
    }
    return p;
  }, gestes);
  check('le capo rend la suite jouée',
    Array.isArray(reponse?.suite) && reponse.suite.length === g.suite.length);
  const note = grade('capo', reponse, {}, { motif: GRAINE });
  check(`et la répéter juste vaut plein (${note.toFixed(2)})`, note >= 1);
}

/* ------------------------------------------------------------- l'écharpe */
{
  const reponse = await page.evaluate(async (g) => {
    const p = window.TBF_GESTE.jouer('echarpe', g, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    const r = pad.getBoundingClientRect();
    const env = (x, y, type) => pad.dispatchEvent(new PointerEvent(type, {
      clientX: r.left + x * r.width, clientY: r.top + y * r.height, bubbles: true }));
    const pt = (i, n) => {
      const a = g.echarpe.sens * (i / n) * Math.PI * 2 * (g.echarpe.tours + 0.4);
      return { x: 0.5 + Math.cos(a) * 0.3, y: 0.5 + Math.sin(a) * 0.3 };
    };
    const q0 = pt(0, 240);
    env(q0.x, q0.y, 'pointerdown');
    for (let i = 1; i <= 240; i++) { const q = pt(i, 240); env(q.x, q.y, 'pointermove'); }
    return p;
  }, gestes);
  check('l’écharpe rend un tracé', Array.isArray(reponse?.trace) && reponse.trace.length > 100);
  const note = grade('echarpe', reponse, {}, { motif: GRAINE });
  check(`et trois tours ronds valent plein (${note.toFixed(2)})`, note > 1);

  /* Le sens demandé compte. On retourne le tracé, ce qui inverse la rotation
     sans rien changer d'autre — même rondeur, même rayon, même nombre de
     points. Seul le sens diffère, et il doit suffire à tout perdre. */
  const envers = { trace: reponse.trace.map((p) => ({ x: p.x, y: 1 - p.y })) };
  check('mais les mêmes tours à l’envers ne valent rien',
    grade('echarpe', envers, {}, { motif: GRAINE }) === 0);
}

/* ------------------------------------------------------------ les visages */
{
  const g = gestes.memoire;
  const rangs = {};
  g.cartes.forEach((v, i) => (rangs[v] = rangs[v] || []).push(i));
  const paires = Object.values(rangs);
  const res = await page.evaluate(async (gestes, aJouer) => {
    const p = window.TBF_GESTE.jouer('memoire', gestes, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    const avant = [...pad.children].filter((c) => c.classList.contains('vue')).length;
    await new Promise((r) => setTimeout(r, gestes.memoire.apercu + 160));
    const apres = [...pad.children].filter((c) => c.classList.contains('vue')).length;
    for (const [a, b] of aJouer) {
      for (const i of [a, b]) {
        pad.children[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        await new Promise((r) => setTimeout(r, 220 + Math.random() * 150));
      }
    }
    return { reponse: await p, avant, apres };
  }, gestes, paires);

  check('les visages sont montrés pendant l’aperçu', res.avant === g.paires * 2);
  check('puis retournés avant de laisser jouer', res.apres === 0);
  check('et la page rend les paires jouées',
    Array.isArray(res.reponse?.paires) && res.reponse.paires.length === g.paires);
  const note = grade('memoire', res.reponse, {}, { motif: GRAINE });
  check(`les retrouver toutes vaut plein (${note.toFixed(2)})`, note >= 1);
}

check('aucune erreur de script pendant les cinq épreuves',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${rates ? `${rates} échec(s)` : 'tout est vert'}`);
await nav.close();
process.exit(rates ? 1 : 0);
