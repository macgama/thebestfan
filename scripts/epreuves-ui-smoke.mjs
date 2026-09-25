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
import { EPREUVES } from '../src/server/ferveur/epreuves.js';

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await nav.newPage();
const erreurs = [];
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 880 });
/* **La feuille de style vient avec.**

   Le banc se contentait du HTML nu, et c'était tenable tant que toutes les
   épreuves se dimensionnaient sur leur contenu — une grille de cases prend la
   place de ses cases. La visée et la jauge, elles, sont des cadres vides en
   `height:100%` : sans `ui.css`, elles font zéro pixel de haut, chaque touche
   tombe hors du cadre et la page rend une réponse vide. Le contrôle accusait
   alors le mini-jeu d'être cassé, alors qu'il manquait sa feuille.

   Une page de test sans les styles du jeu n'éprouve pas le jeu. */
await page.setContent('<style>' + readFileSync('public/ui.css', 'utf8') + '</style>'
  + '<div id="zone" style="width:320px;height:320px"></div>');
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

/* ------------------------------------------------------------------ le tri

   Rien n'est caché ici, donc rien à éprouver sur l'aperçu. Ce qui compte est
   que **le mauvais carton coûte** : c'est la seule épreuve du répertoire où
   ramasser tout l'écran donne zéro, et c'est toute son idée. */
{
  const g = gestes.tri;
  const bons = g.plateau.map((c, i) => (c === g.cible ? i : -1)).filter((i) => i >= 0);
  const mauvais = g.plateau.map((c, i) => (c === g.cible ? -1 : i)).filter((i) => i >= 0);

  const propre = await page.evaluate(async (gestes, cases) => {
    const p = window.TBF_GESTE.jouer('tri', gestes, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    for (const i of cases) {
      pad.children[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 130 + Math.random() * 110));
    }
    return p;
  }, gestes, bons.slice(0, 6));

  check('le tri rend les cartons ramassés',
    Array.isArray(propre?.touches) && propre.touches.length === Math.min(6, bons.length));
  const note = grade('tri', propre, {}, { motif: GRAINE });
  check(`ramasser la bonne couleur paie (${note.toFixed(2)})`, note > 0.5);

  /* Le contrôle qui porte tout. Sans pénalité, tout balayer donnerait la note
     pleine, et l'épreuve ne mesurerait plus que la vitesse du doigt. */
  const brouillon = await page.evaluate(async (gestes, cases) => {
    const p = window.TBF_GESTE.jouer('tri', gestes, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    for (const i of cases) {
      pad.children[i].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 120 + Math.random() * 100));
    }
    return p;
  }, gestes, [...bons, ...mauvais.slice(0, bons.length)]);
  const noteBrouillon = grade('tri', brouillon, {}, { motif: GRAINE });
  check(`tout ramasser sans regarder ne vaut rien (${noteBrouillon.toFixed(2)})`,
    noteBrouillon <= 0.05);
}

/* --------------------------------------------------------------- le compte

   La seule épreuve où il n'y a rien à regarder au moment d'agir. On éprouve
   les deux choses qui la font exister : le compte **s'éteint**, et tomber près
   de la cible paie plus que tomber loin. */
{
  const g = gestes.compte;
  const res = await page.evaluate(async (gestes) => {
    const p = window.TBF_GESTE.jouer('compte', gestes, { zone: document.getElementById('zone') });
    const cpt = document.getElementById('cpt');
    await new Promise((r) => setTimeout(r, 300));
    const pendant = cpt.textContent.trim();
    await new Promise((r) => setTimeout(r, gestes.compte.visible + 250));
    const apres = cpt.classList.contains('noir');
    /* On vise la cible, à cent millisecondes près : c'est un très bon joueur,
       pas un calcul — un écart nul serait refusé par le serveur. */
    const reste = gestes.compte.cible - (gestes.compte.visible + 550);
    await new Promise((r) => setTimeout(r, Math.max(0, reste)));
    document.getElementById('pad').dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }));
    return { reponse: await p, pendant, apres };
  }, gestes);

  check('le compte à rebours s’affiche d’abord', res.pendant !== '');
  /* Sans cette ligne, l'épreuve mesurerait la vue et non l'horloge. */
  check('puis s’éteint avant l’instant à trouver', res.apres === true);
  check('et la page rend la durée écoulée',
    Number.isFinite(res.reponse?.ecoule) && res.reponse.ecoule > 0);

  const note = grade('compte', res.reponse, {}, { motif: GRAINE });
  const ecart = Math.abs((res.reponse?.ecoule ?? 0) - g.cible);
  check(`tomber près de la cible paie (${note.toFixed(2)}, à ${Math.round(ecart)} ms)`,
    note > 0
    || (console.log('        cible', g.cible, 'ms · rendu',
      Math.round(res.reponse?.ecoule ?? 0), 'ms'), false));

  /* Et tomber loin ne paie pas. Un contrôle qui ne vérifierait que le haut de
     l'échelle passerait au vert sur une note constante. */
  const loin = grade('compte', { ecoule: Math.max(1, g.cible - g.tolerance * 2) },
    {}, { motif: GRAINE });
  check(`tomber très loin ne vaut rien (${loin.toFixed(2)})`, loin === 0);
}


/* ------------------------------------------------------------- la bascule

   La seule épreuve où il faut **arrêter un geste déjà parti**. Ce qui compte
   ici n'est pas qu'on puisse répondre juste — c'est que répondre sans lire
   l'inversion ne paie pas. Le premier réglage laissait 0,70 à qui suivait
   bêtement le côté montré, et l'épreuve entière ne valait que trois dixièmes
   de sa note. */
{
  const g = gestes.bascule;
  const jouer = (choisir) => page.evaluate(async (gestes, quoi) => {
    const p = window.TBF_GESTE.jouer('bascule', gestes, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    const sig = gestes.bascule.signaux;
    const t0 = performance.now();
    /* **On répond au rythme des signaux, pas à celui de la boucle.**

       Le mini-jeu n'accepte qu'une réponse par signal et avance tout seul
       toutes les `pas` millisecondes. Une boucle qui tapait dix fois en deux
       secondes voyait donc sept de ses réponses ignorées, et l'exécution
       parfaite récoltait 0,30 — le banc mesurait sa propre impatience.

       Le retard varie dans la fenêtre : `humain()` refuse une régularité
       mécanique, et tomber dessus éprouverait la défense au lieu de la note. */
    for (let i = 0; i < sig.length; i++) {
      const quand = i * gestes.bascule.pas + 140 + Math.random() * 260;
      const reste = quand - (performance.now() - t0);
      if (reste > 0) await new Promise((r) => setTimeout(r, reste));
      const bon = sig[i].contre ? (sig[i].cote ^ 1) : sig[i].cote;
      const k = quoi === 'juste' ? bon : quoi === 'sansLire' ? sig[i].cote : 0;
      pad.querySelector(`[data-k="${k}"]`)
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    }
    return p;
  }, gestes, choisir);

  const juste = await jouer('juste');
  check('la bascule rend un choix par signal',
    Array.isArray(juste?.choix) && juste.choix.length === g.signaux.length
    || (console.log('        elle rend :', JSON.stringify(juste).slice(0, 90)), false));
  const noteJuste = grade('bascule', juste, {}, { motif: GRAINE });
  check(`lire l’inversion paie (${noteJuste.toFixed(2)})`, noteJuste >= 0.9);

  const sansLire = await jouer('sansLire');
  const noteSansLire = grade('bascule', sansLire, {}, { motif: GRAINE });
  check(`suivre le côté montré sans lire ne paie pas (${noteSansLire.toFixed(2)})`,
    noteSansLire <= 0.6 && noteSansLire < noteJuste - 0.3
    || (console.log('        contre juste :', noteJuste.toFixed(2)), false));

  const memeCote = await jouer('meme');
  const noteMeme = grade('bascule', memeCote, {}, { motif: GRAINE });
  check(`et taper toujours du même côté encore moins (${noteMeme.toFixed(2)})`,
    noteMeme <= 0.45);
}

/* --------------------------------------------------------------- la visée

   L'endroit **et** l'instant, et les deux se multiplient : c'est ce qui
   empêche de marteler le centre de l'écran en rythme. Les deux ratés ci-dessous
   sont exactement ces deux moitiés-là, jouées séparément. */
{
  const g = gestes.visee;
  const viser = (ou, retard) => page.evaluate(async (gestes, ou, retard) => {
    const p = window.TBF_GESTE.jouer('visee', gestes, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    const r = pad.getBoundingClientRect();
    const t0 = performance.now();
    for (const c of gestes.visee.cibles) {
      const quand = c.t + retard;
      const reste = quand - (performance.now() - t0);
      if (reste > 0) await new Promise((res) => setTimeout(res, reste));
      const x = ou === 'dessus' ? c.x : 0.5;
      const y = ou === 'dessus' ? c.y : 0.5;
      pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true,
        clientX: r.left + x * r.width, clientY: r.top + y * r.height }));
    }
    return p;
  }, gestes, ou, retard);

  const pile = await viser('dessus', 20);
  check('la visée rend une touche par cible',
    Array.isArray(pile?.touches) && pile.touches.length === g.cibles.length
    || (console.log('        elle rend :', JSON.stringify(pile).slice(0, 90)), false));
  check('et chaque touche porte un endroit et un instant',
    (pile?.touches ?? []).every((t) =>
      Number.isFinite(t.x) && Number.isFinite(t.y) && Number.isFinite(t.t)));

  const notePile = grade('visee', pile, {}, { motif: GRAINE });
  check(`toucher au bon endroit et à l’heure paie (${notePile.toFixed(2)})`, notePile >= 0.8);

  /* **À la vitesse d'une main.** Le contrôle du dessus touche vingt
     millisecondes après l'apparition, et c'est tout ce qu'on vérifiait :
     personne ne joue ainsi. Un joueur voit le fumigène, puis y porte le
     doigt — six cents millisecondes. Il finissait à zéro, à chaque partie,
     parce que sa touche était donnée au fumigène suivant, pas encore
     allumé. */
  const humain = await viser('dessus', 600);
  const noteHumain = grade('visee', humain, {}, { motif: GRAINE });
  check(`à la vitesse d’une main, sur chaque rond, ça paie (${noteHumain.toFixed(2)})`,
    noteHumain >= 0.6);
  const lent = await viser('dessus', 900);
  const noteLent = grade('visee', lent, {}, { motif: GRAINE });
  check(`lentement, un peu moins, mais pas rien (${noteLent.toFixed(2)})`,
    noteLent > 0.1 && noteLent < noteHumain);

  const tard = await viser('dessus', g.fenetre * 2.5);
  const noteTard = grade('visee', tard, {}, { motif: GRAINE });
  check(`au bon endroit mais trop tard ne paie pas (${noteTard.toFixed(2)})`, noteTard <= 0.2);

  const ailleurs = await viser('milieu', 20);
  const noteAilleurs = grade('visee', ailleurs, {}, { motif: GRAINE });
  check(`à l’heure mais au milieu de l’écran non plus (${noteAilleurs.toFixed(2)})`,
    noteAilleurs <= 0.35);
}

/* --------------------------------------------------------------- la jauge

   La seule épreuve notée **en continu**. Le contrôle qui porte tout est le
   doigt immobile : le premier réglage lui donnait 0,48 — la moitié de la note
   sans rien faire — parce que la bande glissait d'un extrême à l'autre et le
   croisait à chaque passage. Elle tient puis saute, désormais. */
{
  const g = gestes.jauge;
  const centreDe = (t) => {
    const s = g.sommets;
    if (t <= s[0].t) return s[0].v;
    for (let i = 1; i < s.length; i++) {
      if (t <= s[i].t) {
        const part = (t - s[i - 1].t) / Math.max(1, s[i].t - s[i - 1].t);
        return s[i - 1].v + (s[i].v - s[i - 1].v) * part;
      }
    }
    return s[s.length - 1].v;
  };
  const tenir = (suivre) => page.evaluate(async (gestes, suivre) => {
    const p = window.TBF_GESTE.jouer('jauge', gestes, { zone: document.getElementById('zone') });
    const pad = document.getElementById('pad');
    const r = pad.getBoundingClientRect();
    const s = gestes.jauge.sommets;
    const centre = (t) => {
      if (t <= s[0].t) return s[0].v;
      for (let i = 1; i < s.length; i++) {
        if (t <= s[i].t) {
          const part = (t - s[i - 1].t) / Math.max(1, s[i].t - s[i - 1].t);
          return s[i - 1].v + (s[i].v - s[i - 1].v) * part;
        }
      }
      return s[s.length - 1].v;
    };
    const t0 = performance.now();
    const poser = (v) => pad.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true, buttons: 1,
      clientX: r.left + r.width / 2,
      clientY: r.top + (1 - v) * r.height }));
    poser(0.5);
    while (performance.now() - t0 < gestes.jauge.ms) {
      const t = performance.now() - t0;
      /* **Un tremblement, et il n'est pas décoratif.** La notation refuse une
         réponse dont plus de la moitié des mesures tombent au millième sur la
         bande : personne ne suit une jauge à la virgule près, et un client qui
         le fait calcule au lieu de jouer. Un banc qui suivrait exactement
         éprouverait donc ce refus au lieu de la note. */
      poser(suivre ? centre(t) + (Math.random() - 0.5) * 0.03 : 0.5);
      await new Promise((res) => setTimeout(res, 30));
    }
    return p;
  }, gestes, suivre);

  const suivi = await tenir(true);
  check(`la jauge rend ses mesures (${(suivi?.mesures ?? []).length})`,
    Array.isArray(suivi?.mesures) && suivi.mesures.length >= g.minMesures
    || (console.log('        elle rend :', (suivi?.mesures ?? []).length), false));
  check('et chacune porte un instant et une valeur',
    (suivi?.mesures ?? []).every((m) => Number.isFinite(m.t) && Number.isFinite(m.v)));

  const noteSuivi = grade('jauge', suivi, {}, { motif: GRAINE });
  check(`suivre la bande paie (${noteSuivi.toFixed(2)})`, noteSuivi >= 0.8);

  /* Et le refus lui-même, qui est le seul garde-fou de cette épreuve : elle
     est notée en continu, donc un client modifié rendrait cent mesures
     parfaites sans effort. On ne peut pas l'empêcher, on peut refuser ce qu'un
     humain ne produit jamais. */
  const machine = { mesures: suivi.mesures.map((m) => ({ t: m.t, v: centreDe(m.t) })) };
  let refuse = null;
  try { grade('jauge', machine, {}, { motif: GRAINE }); }
  catch (e) { refuse = e.code ?? e.message; }
  check(`suivre au millième est refusé (${refuse ?? 'accepté'})`,
    /trop_juste/.test(refuse ?? ''));

  const immobile = await tenir(false);
  const noteImmobile = grade('jauge', immobile, {}, { motif: GRAINE });
  check(`le doigt posé au milieu ne paie pas (${noteImmobile.toFixed(2)})`,
    noteImmobile <= 0.35 && noteImmobile < noteSuivi - 0.4
    || (console.log('        contre suivi :', noteSuivi.toFixed(2)), false));
}

/* ======================================================== les quatre de l'automne

   Chacune est jouée par la page, avec de vrais événements, **à la vitesse
   d'une main** et non vingt millisecondes après le signal : la visée a
   passé ce contrôle-là pendant des semaines en rendant zéro à tous les
   joueurs. Et chacune a son raté typique, joué aussi : c'est lui qui dit
   que l'épreuve mesure quelque chose. */

/* Attendre jusqu'à un instant de l'épreuve, depuis l'appel à `jouer`. */
const JUSQUA = `var jusqua = (t0, t) => new Promise((r) => setTimeout(r, Math.max(0, t - (performance.now() - t0))));`;

/* ---------------------------------------------------------------- la ola */
{
  const g = gestes.ola;
  const jouerOla = (retard) => page.evaluate(async (gestes, retard, aide) => {
    eval(aide);
    const p = window.TBF_GESTE.jouer('ola', gestes, { zone: document.getElementById('zone') });
    const t0 = performance.now();
    const pad = document.getElementById('pad');
    const haut = pad.getBoundingClientRect().height;
    for (const [i, t] of gestes.ola.passages.entries()) {
      await jusqua(t0, t + retard + (i % 2 ? 25 : -15));
      pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    }
    return { rendu: await p, haut };
  }, gestes, retard, JUSQUA);

  const bien = await jouerOla(40);
  check(`l’anneau de la ola a une taille à lui (${Math.round(bien.haut)} px)`, bien.haut > 100);
  const note = grade('ola', bien.rendu, {}, { motif: GRAINE });
  check(`se lever quand la vague passe paie (${note.toFixed(2)})`, note >= 0.8);
  const tard = await jouerOla(400);
  const noteTard = grade('ola', tard.rendu, {}, { motif: GRAINE });
  check(`se lever quand elle est déjà passée ne paie pas (${noteTard.toFixed(2)})`, noteTard <= 0.2);
}

/* ------------------------------------------------------- l'écho inversé */
{
  const jouerMiroir = (inverser) => page.evaluate(async (gestes, inverser, aide) => {
    eval(aide);
    const p = window.TBF_GESTE.jouer('miroir', gestes, { zone: document.getElementById('zone') });
    const t0 = performance.now();
    for (const m of gestes.miroir.manches) {
      /* On répond une demi-seconde après le « à toi », au rythme du motif. */
      for (const [i, c] of m.coups.entries()) {
        await jusqua(t0, m.reponse + 500 + c.t + (i % 2 ? 30 : -20));
        const cote = inverser ? c.cote ^ 1 : c.cote;
        document.querySelector(`#pad [data-k="${cote}"]`)
          .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      }
    }
    return p;
  }, gestes, inverser, JUSQUA);

  const juste = await jouerMiroir(true);
  const note = grade('miroir', juste, {}, { motif: GRAINE });
  check(`rejouer le motif en miroir paie (${note.toFixed(2)})`, note >= 0.8);
  const pareil = await jouerMiroir(false);
  const notePareil = grade('miroir', pareil, {}, { motif: GRAINE });
  check(`le rejouer sans le retourner ne paie pas (${notePareil.toFixed(2)})`, notePareil <= 0.2);
}

/* ------------------------------------------------------------ les rouleaux */
{
  const g = gestes.rouleaux;
  /* Où glisser pour que le rouleau tombe sur la cible : on part du bas du
     cadre et l'on résout la formule à l'envers — avec ou sans le vent. */
  const viser = (l, vent) => {
    const x0 = 0.5, y0 = 0.88, P = g.portee;
    const vy = (l.cible.y - y0) / (1 + P);
    let dx = (l.cible.x - x0) / (1 + P);
    for (let k = 0; k < 30; k++) dx = (l.cible.x - x0 - vent * Math.hypot(dx, vy) * P) / (1 + P);
    return { x0, y0, x1: x0 + dx, y1: y0 + vy };
  };
  const lancer = (compenser) => page.evaluate(async (gestes, gestesVises, aide) => {
    eval(aide);
    const p = window.TBF_GESTE.jouer('rouleaux', gestes, { zone: document.getElementById('zone') });
    const t0 = performance.now();
    const pad = document.getElementById('pad');
    const r = pad.getBoundingClientRect();
    const ev = (type, x, y) => pad.dispatchEvent(new PointerEvent(type, { bubbles: true,
      clientX: r.left + x * r.width, clientY: r.top + y * r.height }));
    for (const [i, l] of gestes.rouleaux.liste.entries()) {
      const v = gestesVises[i];
      /* Des écarts de main, pas de métronome : `humain()` refuse les seconds. */
      await jusqua(t0, l.t + 350 + [0, 140, 30, 210, 90][i % 5]);
      ev('pointerdown', v.x0, v.y0);
      await new Promise((res) => setTimeout(res, 150));
      ev('pointerup', v.x1, v.y1);
    }
    return { rendu: await p, haut: r.height };
  }, gestes, g.liste.map((l) => viser(l, compenser ? l.vent : 0)), JUSQUA);

  const bien = await lancer(true);
  check(`le cadre des rouleaux a une taille à lui (${Math.round(bien.haut)} px)`, bien.haut > 100);
  check('un lancer par rouleau', bien.rendu?.lancers?.length === g.liste.length
    || (console.log('        il rend :', JSON.stringify(bien.rendu).slice(0, 90)), false));
  const note = grade('rouleaux', bien.rendu, {}, { motif: GRAINE });
  check(`viser en tenant compte du vent paie (${note.toFixed(2)})`, note >= 0.8);
  const naif = await lancer(false);
  const noteNaif = grade('rouleaux', naif.rendu, {}, { motif: GRAINE });
  check(`viser droit sur la cible, sans le vent, paie bien moins (${noteNaif.toFixed(2)})`,
    noteNaif <= 0.5 && noteNaif < note - 0.4);
}

/* ----------------------------------------------------------- les deux voix */
{
  const jouerVoix = (inverser) => page.evaluate(async (gestes, inverser, aide) => {
    eval(aide);
    const p = window.TBF_GESTE.jouer('deuxvoix', gestes, { zone: document.getElementById('zone') });
    const t0 = performance.now();
    let vues = 0;
    for (const [i, n] of gestes.deuxvoix.notes.entries()) {
      await jusqua(t0, n.t + (i % 2 ? 30 : -25));
      /* La note est-elle bien descendue dans son couloir ? */
      if (document.querySelectorAll('.tbf-voie')[n.cote]?.querySelector('.tbf-note')) vues++;
      const cote = inverser ? n.cote ^ 1 : n.cote;
      document.querySelector(`#pad .tbf-cote[data-k="${cote}"]`)
        .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    }
    return { rendu: await p, vues, haut: document.querySelector('.tbf-voies')?.getBoundingClientRect().height ?? 0 };
  }, gestes, inverser, JUSQUA);

  const bien = await jouerVoix(false);
  const n = gestes.deuxvoix.notes.length;
  check(`chaque note descend dans son couloir (${bien.vues}/${n})`, bien.vues === n);
  const note = grade('deuxvoix', bien.rendu, {}, { motif: GRAINE });
  check(`frapper du bon côté à l’heure paie (${note.toFixed(2)})`, note >= 0.8);
  const inv = await jouerVoix(true);
  const noteInv = grade('deuxvoix', inv.rendu, {}, { motif: GRAINE });
  check(`à l’heure mais du mauvais côté ne paie pas (${noteInv.toFixed(2)})`, noteInv <= 0.1);
}

check(`aucune erreur de script pendant les ${EPREUVES.length} épreuves`,
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${rates ? `${rates} échec(s)` : 'tout est vert'}`);
await nav.close();
process.exit(rates ? 1 : 0);
