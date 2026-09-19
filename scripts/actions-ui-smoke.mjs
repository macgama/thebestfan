#!/usr/bin/env node
/**
 * Ce qu'on voit quand une carte part, et ce que rapporte un geste.
 *
 * ## Ce qui manquait
 *
 * Une carte jouée se montrait en grand, avec son dessin et son nom — et sans
 * un chiffre. Pendant une seconde et demie, au milieu de l'écran, au moment
 * exact où elle compte le plus, rien ne disait si elle valait vingt-deux ou
 * quatre-vingt-quinze. L'adversaire, qui ne l'a pas en main, ne pouvait pas le
 * savoir du tout.
 *
 * Le chiffre du geste, lui, existait : vingt-deux pixels qui montaient du nœud
 * et s'effaçaient en une seconde, par-dessus une corde qui bouge et une foule
 * qui s'anime. Quelqu'un qui venait de tenir une jauge huit secondes ne voyait
 * pas ce que ça lui avait rapporté.
 *
 * ## Pourquoi les trente-neuf, et pas une
 *
 * Le résumé d'une carte se calcule sur son effet, et il y a **vingt-cinq
 * sortes d'effets** pour sept familles : une poussée porte une valeur, une
 * entrave une durée, un ralliement un facteur, et cinq n'ont rien du tout. Une
 * suite qui n'éprouverait qu'un fumigène ne dirait rien des vingt-quatre
 * autres branches — et la branche oubliée n'échoue pas bruyamment : elle
 * affiche « undefined », ou « 0,5 point » sur une carte qui plafonne une
 * qualité à la moitié.
 *
 * On les joue donc **toutes**, et on regarde ce qui s'écrit.
 *
 * ## Aucune base
 *
 * Ni pool, ni schéma, ni verrou : ces deux couches sont du dessin. C'est aussi
 * ce qui rend cette suite lançable pendant qu'une autre tourne.
 *
 * Usage : node scripts/actions-ui-smoke.mjs
 * (npm install --no-save puppeteer)
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { ACTIONS } from '../src/shared/duel/actions.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let ko = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) ko++; };

/* Une page nue qui charge les vraies feuilles et les vraies couches. **Servie
   par une route**, jamais posée par `setContent` : celui-ci laisse la page sur
   `about:blank`, où `/ui.css` et `/img/action/…` ne résolvent nulle part — la
   suite mesurerait alors une page sans style et le dirait sans le savoir. */
const app = express();
app.get('/banc', (_q, s) => s.type('html').send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="utf-8"><link rel="stylesheet" href="/ui.css"></head>
<body style="background:#04060A"><div id="corde"
  style="position:fixed;left:50%;top:60%;width:8px;height:8px"></div>
<script src="/fanzzy-art.js"></script><script src="/action-art.js"></script>
<script src="/fx.js"></script></body></html>`));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 390, height: 844 });
await page.goto(`${base}/banc`, { waitUntil: 'networkidle0' });

check('les deux couches sont chargées', await page.evaluate(() =>
  Boolean(window.TBF_ACTION?.jouee && window.TBF_ACTION?.resume && window.FX?.points)));

/* ======================================= les trente-neuf cartes, une par une */

const vues = await page.evaluate((cartes) => cartes.map((a) => {
  document.querySelectorAll('.tbf-jouee').forEach((x) => x.remove());
  window.TBF_ACTION.jouee(a, { pour: true, vers: { x: 195, y: 500 } });
  const el = document.querySelector('.tbf-jouee');
  const bande = el?.querySelector('.tbf-jouee-somme');
  const fc = el ? getComputedStyle(el).getPropertyValue('--fc').trim() : '';
  return {
    id: a.id, fam: a.fam, type: a.effet?.type ?? null,
    carte: Boolean(el?.querySelector('.tbf-jouee-carte')),
    nom: el?.querySelector('.nm')?.textContent.trim() ?? '',
    bande: Boolean(bande),
    n: bande?.querySelector('b')?.textContent.trim() ?? '',
    quoi: bande?.querySelector('span')?.textContent.trim() ?? '',
    sansNombre: Boolean(bande?.classList.contains('sansnombre')),
    couleur: bande ? getComputedStyle(bande).borderTopColor : '',
    fc,
  };
}), ACTIONS.map((a) => ({ id: a.id, nom: a.nom, fam: a.fam, cost: a.cost,
  texte: a.texte, effet: a.effet })));

check(`les ${ACTIONS.length} cartes se dessinent (${vues.length})`,
  vues.length === ACTIONS.length && vues.every((v) => v.carte && v.nom.length > 1)
  || (console.log('        ', JSON.stringify(vues.find((v) => !v.carte || !v.nom))), false));

check('chacune porte son bandeau de résumé',
  vues.every((v) => v.bande)
  || (console.log('        sans bandeau :',
    vues.filter((v) => !v.bande).map((v) => v.id).join(' ')), false));

/* Le mot ne manque jamais : c'est lui qui reste quand la carte n'a pas de
   nombre, et sans lui le bandeau serait une pastille vide. Quatre lettres
   suffisent — « VOLÉ » en fait quatre, et il dit tout ce qu'il a à dire. */
check('et chacune dit de quoi il s’agit',
  vues.every((v) => v.quoi.length >= 4)
  || (console.log('        muettes :',
    vues.filter((v) => v.quoi.length < 4).map((v) => `${v.id}:"${v.quoi}"`).join(' ')), false));

/* **La faute qui ne lève pas.** Une branche oubliée dans le résumé n'échoue
   pas : elle écrit `undefined`, `NaN` ou `+null` en vingt-six pixels au milieu
   de l'écran, et personne ne le voit avant un joueur. */
{
  const sales = vues.filter((v) => /undefined|NaN|null|\[object/.test(`${v.n} ${v.quoi}`));
  check('aucun résumé n’écrit un mot de programmeur', sales.length === 0
    || (console.log('        ', sales.map((v) => `${v.id}:"${v.n} ${v.quoi}"`).join(' · ')), false));
}

/* La couleur est celle de la famille : c'est tout le code de lecture demandé —
   une poussée rouge, un souffle bleu — et il doit être **le même** que celui de
   la cerne de la carte, qui vient de `--fc`. */
{
  const faux = vues.filter((v) => v.couleur && v.fc && !memeCouleur(v.couleur, v.fc));
  check('le bandeau porte la couleur de sa famille', faux.length === 0
    || (console.log('        ', faux.slice(0, 4)
      .map((v) => `${v.id} ${v.couleur} ≠ ${v.fc}`).join(' · ')), false));
}

/* ================================================ ce que chaque sorte annonce

   On ne vérifie pas un libellé mot pour mot — il se réécrira — mais la règle
   qui le gouverne : une carte qui porte un nombre le montre, une carte qui n'en
   porte pas n'en invente pas. */
{
  const pousses = vues.filter((v) => v.type === 'push');
  const attendu = new Map(ACTIONS.filter((a) => a.effet?.type === 'push')
    .map((a) => [a.id, `+${a.effet.valeur}`]));
  check(`les poussées annoncent leur valeur (${pousses.length})`,
    pousses.every((v) => v.n === attendu.get(v.id))
    || (console.log('        ', pousses.map((v) => `${v.id}:${v.n}`).join(' ')), false));

  const durees = vues.filter((v) => ['silence', 'blind', 'lock_actions'].includes(v.type));
  check(`les entraves annoncent une durée (${durees.length})`,
    durees.length > 0 && durees.every((v) => /^\d+\s*s$/.test(v.n))
    || (console.log('        ', durees.map((v) => `${v.id}:${v.n}`).join(' ')), false));

  /* Les cartes qui n'ont rien à compter — échanger un Fanzzy, rendre la main,
     renvoyer une fois — doivent le dire en ne montrant qu'un mot. Un « ×1 » y
     serait pire que rien : le joueur le lirait comme une valeur. */
  const muettes = vues.filter((v) => v.sansNombre);
  check(`celles qui ne se comptent pas ne montrent qu’un mot (${muettes.length})`,
    muettes.length > 0 && muettes.every((v) => v.n === '' && v.quoi.length >= 4)
    || (console.log('        ', muettes.map((v) => `${v.id}:"${v.n}"`).join(' ')), false));

  const compte = vues.filter((v) => !v.sansNombre);
  check(`et les autres montrent bien un nombre (${compte.length})`,
    compte.every((v) => /\d/.test(v.n))
    || (console.log('        ', compte.filter((v) => !/\d/.test(v.n))
      .map((v) => `${v.id}:"${v.n}"`).join(' ')), false));
}

/* ======================================== le gain d'un geste, en grand

   La demande tenait en deux mots — « plus visibles » — et elle se mesure :
   le nombre qu'on vient de gagner doit être nettement plus gros que celui qui
   passait avant, et porter un mot qui dit de quoi il s'agit. */
{
  const t = await page.evaluate(() => {
    document.querySelectorAll('.fx-points,.fx-nombre').forEach((x) => x.remove());
    window.FX.nombre(42, { x: 100, y: 300 });
    window.FX.points(42, document.getElementById('corde'), { quoi: 'POUSSÉE' });
    const p = document.querySelector('.fx-points');
    const n = document.querySelector('.fx-nombre');
    return {
      avant: parseFloat(getComputedStyle(n).fontSize),
      apres: parseFloat(getComputedStyle(p.querySelector('b')).fontSize),
      dit: p.querySelector('span')?.textContent.trim() ?? '',
      chiffre: p.querySelector('b')?.textContent.trim() ?? '',
      /* Au-dessus de la carte jouée et du reste de l'écran : un gain caché
         derrière une carte qui vole ne serait pas plus visible qu'avant. */
      couche: Number(getComputedStyle(p).zIndex),
    };
  });
  check(`le gain est nettement plus gros qu’un nombre ordinaire `
    + `(${t.apres}px contre ${t.avant}px)`, t.apres >= t.avant * 1.8
    || (console.log('        il ne grossit pas assez'), false));
  check(`il porte le signe et la valeur (${t.chiffre})`, t.chiffre === '+42');
  check(`et le mot qui dit quoi (${t.dit})`, t.dit === 'POUSSÉE');
  check(`il passe au-dessus de tout (z-index ${t.couche})`, t.couche >= 92);
}

check('aucune erreur de script', erreurs.length === 0
  || (console.log('        ', erreurs.slice(0, 3).join(' · ')), false));

/**
 * Deux écritures d'une même couleur : `rgb(224, 64, 44)` et `#E0402C`.
 *
 * **L'hexadécimal se reconnaît en premier**, à son croisillon. Le tester en
 * second laissait l'expression des nombres décimaux mordre dessus : `3C82E8`
 * contient trois suites de chiffres séparées par des lettres, donc elle y
 * lisait `3, 82, 8` et déclarait toutes les couleurs différentes. Le contrôle
 * rougissait sur du code juste, ce qui est la pire sorte de rouge.
 */
function memeCouleur(a, b) {
  const rgb = (s) => {
    const t = String(s).trim();
    if (t.startsWith('#')) {
      const h = t.slice(1);
      return h.length === 6 ? [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) : null;
    }
    const m = t.match(/(\d+)\D+(\d+)\D+(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : null;
  };
  const x = rgb(a); const y = rgb(b);
  return Boolean(x && y && x.every((v, i) => Math.abs(v - y[i]) <= 1));
}

await nav.close();
await new Promise((r) => http.close(r));
console.log(`\n${ko ? `${ko} échec(s)` : 'tout est vert'}`);
process.exitCode = ko ? 1 : 0;
