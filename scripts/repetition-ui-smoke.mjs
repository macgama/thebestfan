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
 * ## Et le lecteur des trois arènes (lot 6)
 *
 * La salle charge `geste.js`, le même lecteur que le Virage et le duel : c'est
 * ici qu'on éprouve ce qu'il fait sous le doigt et comment il pose le verdict,
 * dans un vrai navigateur.
 *
 *   - **le pavé-bâche** (la brique de `ui.css`) : il s'enfonce et lâche une
 *     bouffée sur les quatre gestes de frappe, rien sur le martelage (un tic
 *     et huit millisecondes), et ne bouge jamais sur un geste positionnel ;
 *   - **le verdict servi** : le mot est celui de la réponse, jamais celui
 *     qu'une note ferait deviner ; sans mot, pas de tampon ;
 *   - **l'attente de la fenêtre** (`TBF_GESTE.attendre`) : six cents
 *     millisecondes après la dernière frappe au plus, le tampon dans la
 *     fenêtre s'il arrive à temps, sur la carte jouée sinon ; et le geste de
 *     rythme qui finit sur sa dernière frappe attendue ;
 *   - **les retours qui tombent à l'heure** : le clac du tampon à l'impact,
 *     le signal de la relance une fois, le premier temps du crescendo qui se
 *     voit venir ;
 *   - **la fin de la salle** : la note chiffrée et le record restent, le
 *     record est un tampon, et « LE JOUER EN DUEL » mène à l'arène ;
 *   - **l'épreuve jugée reste entière** : la grille du tri et sa ligne
 *     « RAMASSE LE ■ » tiennent dans la zone que la note et les portes leur
 *     laissent, à 360 × 640 et 320 × 568, sans rien de coupé ; pendant le
 *     geste, l'épreuve est à sa taille.
 *
 * La route de la répétition est la vraie, et le premier essai compare le
 * tampon au mot qu'elle a réellement servi ; pour les réponses qu'elle ne
 * produit pas sur commande (un mot qui contredit la note, un mot inconnu, pas
 * de mot du tout comme un serveur d'avant), la suite en impose une
 * (`IMPOSEE`) le temps d'un essai.
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
   à le montrer autant que la précédente.

   `IMPOSEE` : la réponse que le POST rend à la place de la vraie route, le
   temps d'un essai. Elle sert à poser la page devant ce que le contrat permet
   et que la route ne produira pas sur commande — un mot qui contredit la note,
   un mot inconnu, pas de mot du tout. Remise à `null` après chaque essai. */
let IMPOSEE = null;
const app = express();
app.post('/api/repetition', (_q, s, suite) => (IMPOSEE ? s.json(IMPOSEE) : suite()));
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
/* Ce que la vraie route a servi au dernier essai : la suite compare le tampon
   au mot qu'elle a réellement rendu, pas à celui qu'on attendrait. */
const servies = [];
page.on('response', async (r) => {
  if (r.request().method() !== 'POST' || !r.url().endsWith('/api/repetition')) return;
  try { servies.push(await r.json()); } catch { servies.push(null); }
});
/* Les vibrations et les sons, relevés au lieu d'être joués. La vibration est
   posée avant tout script de la page ; le son est relevé sur `FX.son`, que
   `geste.js` appelle à chaque toucher — il le demande à l'instant, jamais
   gardé de côté, donc l'enveloppe posée après le chargement le voit. */
await page.evaluateOnNewDocument(() => {
  window.__vib = [];
  window.__sons = [];
  try {
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true, value(x) { window.__vib.push(x); return true; },
    });
  } catch { /* le relevé des vibrations manquera, et le contrôle le dira */ }
});
/** Relève les sons demandés à `FX.son` ; à reposer après chaque chargement. */
async function espionner() {
  await jusqua(async () => page.evaluate(() => Boolean(window.FX?.son && window.TBF_GESTE)));
  await page.evaluate(() => {
    const son = window.FX.son;
    window.FX.son = (nom, o) => { window.__sons.push(nom); return son(nom, o); };
  });
}
await page.setViewport({ width: 390, height: 860 });
await page.goto(`${base}/repetition`, { waitUntil: 'networkidle0' });
await espionner();

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

/* **Les pulsations, relevées comme un joueur les voit** : l'anneau qui bat
   (`battre` retire puis remet la classe `beat` dans la même tâche — deux
   mutations, une seule pulsation). L'observateur est posé avant d'ouvrir le
   geste : la première pulsation ne doit pas passer pendant qu'on regarde
   ailleurs. */
await page.evaluate(() => {
  window.__pulses = [];
  new MutationObserver((ms) => {
    const t = performance.now();
    for (const m of ms) {
      if (m.target.id === 'ring' && m.target.classList.contains('beat')
        && !/\bbeat\b/.test(m.oldValue ?? '')
        && !(window.__pulses.length && t - window.__pulses[window.__pulses.length - 1] < 50)) {
        window.__pulses.push(t);
      }
    }
  }).observe(document.getElementById('zone'), { subtree: true, attributes: true,
    attributeFilter: ['class'], attributeOldValue: true });
});
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

/* ============================ le pavé est durci contre le navigateur

   **Il était écrit trois fois, et deux fois mal.** Les dix épreuves vivent
   dans `ui.css` depuis toujours ; les dix gestes de rythme partagent le même
   pavé rond, et chaque écran en gardait sa version — le duel l'avait durci, le
   Virage non, et cette salle-ci n'en avait aucune.
 *
   Ce qui manquait n'est pas cosmétique. Sans `touch-action:none`, un navigateur
   de téléphone se réserve le droit de lire la frappe comme un début de
   défilement ou un double-toucher à agrandir : elle arrive en retard, ou pas du
   tout. Sans `user-select:none`, garder le doigt appuyé — ce que trois gestes
   demandent explicitement — sélectionne le compteur, ouvre la loupe ou fait
   surgir le menu de copie par-dessus le jeu. Et sur ordinateur, marteler
   sélectionne le chiffre au lieu de le frapper.
 *
   La règle est désormais unique, donc l'éprouver ici couvre les trois écrans.
   Une page qui reprendrait la sienne serait un retour en arrière, et ce
   contrôle ne le verrait pas — mais `verif-pages.mjs` interdit déjà à une page
   de restyler le vocabulaire partagé. */
{
  const dur = await page.evaluate(() => {
    const p = document.getElementById('pad');
    const s = getComputedStyle(p);
    const r = p.getBoundingClientRect();
    return {
      toucher: s.touchAction,
      selection: s.userSelect || s.webkitUserSelect,
      large: Math.round(r.width), haut: Math.round(r.height),
    };
  });
  check(`le pavé refuse le défilement du navigateur (touch-action: ${dur.toucher})`,
    dur.toucher === 'none'
    || (console.log('        une frappe peut être lue comme un défilement'), false));
  check(`et la sélection de texte (user-select: ${dur.selection})`,
    dur.selection === 'none'
    || (console.log('        un appui long ouvrira la loupe ou le menu de copie'), false));
  /* Et il a une taille. Sans règle du tout — le défaut de cette salle — le pavé
     existait dans le document et ne se voyait pas : un geste qu'on ne peut pas
     viser est un geste qu'on rate sans comprendre pourquoi. */
  check(`et il est assez grand pour être visé (${dur.large}×${dur.haut})`,
    dur.large >= 180 && dur.haut >= 180
    || (console.log('        il est trop petit, ou sans style du tout'), false));
}

/* ===================================================== le pavé-bâche

   Les dix gestes de rythme se jouent sur la bâche ronde (`.pad.tbf-pave`),
   et les quatre gestes de frappe portent `data-frappe` : c'est lui, et lui
   seul, qui permet à la feuille d'enfoncer la bâche. */
{
  const pave = await page.evaluate(() => {
    const p = document.getElementById('pad');
    return {
      bache: p.classList.contains('tbf-pave') && p.classList.contains('pad'),
      frappe: p.hasAttribute('data-frappe'),
      geste: p.dataset.geste,
      couleur: p.style.getPropertyValue('--c').trim(),
    };
  });
  check(`le tempo se joue sur le pavé-bâche, en geste de frappe (${pave.geste}, ${pave.couleur})`,
    pave.bache && pave.frappe && pave.geste === 'tempo' && /^#/.test(pave.couleur));
}

/* On joue le tempo pour de vrai : la page a reçu l'intervalle du serveur, on
   le lui relit plutôt que d'en écrire un ici — un nombre recopié dans un banc
   d'essai est un nombre qui divergera.

   **On tape sur ce que l'écran montre** : la première frappe sur la première
   pulsation, les suivantes sur la grille qu'elle ouvre. Cette suite tapait
   dès l'ouverture, avant toute pulsation — ce qu'aucun joueur ne fait —, et
   c'est pourquoi elle n'a jamais vu que taper sur la pulsation dessinée
   rendait 0,00 (voir `grille` dans `geste.js`).

   **La première frappe est regardée sur le fait** : un geste de frappe
   enfonce le pavé et lâche une bouffée de sa couleur, avec le tic et les huit
   millisecondes. Relevé dans la même tâche que la frappe, avant que la page
   ait pu rendre une image : c'est ce que le doigt déclenche, pas ce qui reste
   une seconde après. */
const joue = await page.evaluate(async () => {
  const d = await fetch('/api/repetition').then((r) => r.json());
  const t = d.gestes.tempo;
  const pad = document.getElementById('pad');
  const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
  const t1 = performance.now();
  while (!window.__pulses.length && performance.now() - t1 < 4000) await dodo(4);
  const premier = window.__pulses[0];
  let premiere = null;
  for (let i = 0; i < t.beats; i++) {
    /* Une attente qui tremble : le moteur refuse une régularité mécanique, et
       un banc qui tomberait dessus éprouverait la défense au lieu de la note.
       Comptée depuis le premier temps et non d'une frappe à l'autre : des
       attentes enchaînées dérivent de quelques millisecondes à chaque tour. */
    const quand = premier + i * t.interval + (i ? (Math.random() - 0.5) * 30 : 0);
    if (quand > performance.now()) await dodo(quand - performance.now());
    /* Vidé juste avant la frappe : la pulsation vibre elle aussi (douze
       millisecondes, une consigne), et elle vient de battre. */
    if (i === 0) { window.__vib.length = 0; window.__sons.length = 0; }
    pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    if (i === 0) {
      const b = pad.querySelector(':scope > .tbf-bouffee');
      premiere = {
        /* `.hit` sur un pavé qui porte `data-frappe` : c'est le contrat avec
           la feuille, qui l'enfonce (ou l'assombrit au calme). On ne mesure
           pas le déplacement lui-même : il passe par une transition, et
           relevé dans la même tâche il vaut encore zéro. */
        enfonce: pad.classList.contains('hit') && pad.hasAttribute('data-frappe'),
        bouffee: Boolean(b) && pad.firstElementChild === b,
        couleur: b ? getComputedStyle(b).getPropertyValue('--c1').trim() : '',
        vib: [...window.__vib], sons: [...window.__sons],
      };
      await new Promise((r) => setTimeout(r, 220));
      premiere.remonte = !pad.classList.contains('hit');
      // Une seule bouffée vit à la fois : la frappe suivante remplacera
      // celle-ci, et celle-ci part d'elle-même une fois dissipée.
      premiere.bouffees = pad.querySelectorAll('.tbf-bouffee').length;
    }
  }
  return { n: t.beats, premiere, vu: Boolean(premier) };
});
check(`le tempo se joue (${joue.n} frappes, sur les pulsations de l’anneau)`, joue.n > 0 && joue.vu);
{
  const p = joue.premiere;
  check('une frappe de tempo enfonce le pavé', p.enfonce);
  check(`et lâche une bouffée de la couleur du geste, dans le pavé (${p.couleur})`,
    p.bouffee && p.couleur.toUpperCase() === '#F5C33B' && p.bouffees <= 1);
  check(`avec le tic et huit millisecondes (${p.sons.join(',')} · ${p.vib.join(',')})`,
    p.sons.includes('tic') && p.vib.length === 1 && p.vib[0] === 8);
  check('et le pavé remonte de lui-même', p.remonte);
}

check('une note s’affiche', await jusqua(async () =>
  page.evaluate(() => Boolean(document.querySelector('#resultat .n'))), 12000));

/* Le tampon peut arriver un souffle après la note : on lui laisse le temps de
   la fenêtre, pas davantage. */
await dodo(150);
const apres = await page.evaluate(() => ({
  note: document.querySelector('#resultat .n')?.textContent.trim() ?? '',
  tampon: document.querySelector('#pad > .tbf-verdict')?.textContent.trim() ?? null,
  code: document.querySelector('#pad > .tbf-verdict')?.dataset.verdict ?? null,
  /* Sous le tampon, la feuille retire le chiffre et la consigne du pavé :
     un tampon posé sur un chiffre encore lisible ne se lit pas. */
  dessous: getComputedStyle(document.getElementById('n') ?? document.body).visibility,
  ailleurs: document.querySelectorAll('.tbf-verdict').length,
  record: document.querySelector('#resultat .record .tbf-tampon')?.textContent.trim() ?? null,
  /* Le « /1 » de la note, en quinze pixels : la couleur du geste lui
     donnait l'or du tempo, du petit or que l'audit relevait. */
  petit: (() => {
    const s = document.querySelector('#resultat .n small');
    if (!s) return null;
    const sonde = document.createElement('span');
    sonde.style.color = 'var(--craie)';
    document.body.appendChild(sonde);
    const craie = getComputedStyle(sonde).color;
    sonde.remove();
    return { vu: getComputedStyle(s).color, craie };
  })(),
  etoile: /★/.test(document.getElementById('resultat')?.textContent ?? ''),
  boutons: document.getElementById('apres')?.style.display,
  duel: (() => {
    const a = document.getElementById('enDuel');
    const r = a?.getBoundingClientRect();
    return a ? { href: a.getAttribute('href'), texte: a.textContent.trim(),
      vu: r.width > 0 && r.height > 0 && r.bottom <= innerHeight } : null;
  })(),
}));
check(`la note est un nombre sur un (${apres.note})`, /^0[.,]\d\d\/1$|^1[.,]00\/1$/
  .test(apres.note.replace(/\s/g, ''))
  || (console.log('        elle dit :', apres.note), false));
check(`son « /1 » est à la craie, pas dans la couleur du geste (${apres.petit?.vu})`,
  Boolean(apres.petit) && apres.petit.vu === apres.petit.craie);

/* **Taper sur la pulsation dessinée paie, à la vraie route.** Le lecteur
   dessinait le tempo un temps trop tard pour la note : sur chaque pulsation,
   pile, la route rendait 0,00 et RATÉ. Ici, la note que la route a réellement
   servie à un joueur qui tape sur l'anneau (la première frappe dès qu'il a
   vu le premier temps, les autres sur sa grille). */
{
  const servie = servies.at(-1);
  check(`taper sur la pulsation dessinée paie (la route a noté ${Number(servie?.note).toFixed(2)})`,
    Number(servie?.note) >= 0.8 && !servie?.refuse
    || (console.log('        servie :', JSON.stringify(servie)), false));
}

/* **Le mot est celui que la route a servi.** Avec `verdict` (la vague 2), le
   tampon claque sur le pavé avec ce mot-là ; sans (un serveur d'avant), il n'y
   a pas de tampon du tout — jamais un mot deviné d'après la note. */
{
  const servie = servies.at(-1);
  const MOTS = { parfait: 'PARFAIT', bon: 'BON', moyen: 'MOYEN', rate: 'RATÉ' };
  const attendu = servie && !servie.refuse ? (MOTS[servie.verdict] ?? null) : null;
  check(`le tampon du pavé dit le mot servi (servi : ${servie?.verdict ?? 'aucun'}, posé : ${apres.tampon ?? 'aucun'})`,
    apres.tampon === attendu && apres.ailleurs === (attendu ? 1 : 0)
    && (!attendu || apres.code === servie.verdict));
  if (attendu) check(`et le chiffre du pavé s’efface dessous (${apres.dessous})`, apres.dessous === 'hidden');
}
check(`un premier essai est un record, en tampon (${apres.record})`,
  apres.record === 'TON MEILLEUR' && !apres.etoile);
check('les trois suites sont proposées', apres.boutons === 'grid');
check(`« LE JOUER EN DUEL » mène à l’arène (${apres.duel?.href})`,
  apres.duel?.href === '/duel-nvn' && apres.duel.texte === 'LE JOUER EN DUEL' && apres.duel.vu);

/* **Le geste fini ne répond plus.** Le pavé reste à l'écran sous son tampon ;
   une frappe de plus ne doit ni l'enfoncer, ni faire son tic : ce serait dire
   qu'elle compte. */
{
  const tard = await page.evaluate(() => {
    window.__vib.length = 0; window.__sons.length = 0;
    const p = document.getElementById('pad');
    /* La bouffée de la dernière vraie frappe peut finir de se dissiper : on
       regarde si la frappe tardive en pose **une autre**, pas s'il en reste. */
    const avant = p.querySelector('.tbf-bouffee');
    p.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const apres = p.querySelector('.tbf-bouffee');
    return { hit: p.classList.contains('hit'), bouffee: Boolean(apres) && apres !== avant,
      tic: window.__sons.includes('tic'), vib: window.__vib.length };
  });
  check(`une frappe après la fin ne fait plus rien (${JSON.stringify(tard)})`,
    !tard.hit && !tard.bouffee && !tard.tic && tard.vib === 0);
}

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
await espionner();

/* ======================================== sortir en cours ne note rien

   La promesse du lecteur se résout quand même quand on quitte. Noter ce
   qu'on n'a pas fini afficherait un zéro à quelqu'un qui n'a rien raté — et
   l'inscrirait comme son meilleur score s'il n'en avait aucun.

   **Et le martelage ne bouge pas.** Huit à dix frappes par seconde : un tic
   et huit millisecondes chacune, rien d'autre — ni enfoncement, ni éclat, ni
   bouffée. Chaque image perdue à animer se paierait sur la note. */
{
  await page.click('.g[data-g="mash"]');
  await jusqua(async () => page.evaluate(() => Boolean(document.getElementById('pad'))));
  const mart = await page.evaluate(async () => {
    window.__vib.length = 0; window.__sons.length = 0;
    const p = document.getElementById('pad');
    const vu = [];
    for (let i = 0; i < 3; i++) {
      p.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      vu.push(p.hasAttribute('data-frappe') || p.classList.contains('hit')
        || Boolean(p.querySelector('.tbf-bouffee')));
      await new Promise((r) => setTimeout(r, 120));
    }
    return { bouge: vu.some(Boolean), vib: [...window.__vib],
      tics: window.__sons.filter((n) => n === 'tic').length,
      compte: document.getElementById('n')?.textContent };
  });
  check(`le martelage compte ses frappes (${mart.compte})`, mart.compte === '3');
  check('sans enfoncer le pavé, sans éclat ni bouffée', !mart.bouge);
  check(`un tic et huit millisecondes par frappe (${mart.tics} · ${mart.vib.join(',')})`,
    mart.tics === 3 && mart.vib.length === 3 && mart.vib.every((v) => v === 8));
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

/** Ouvre un geste dans la salle et attend son pavé. */
async function ouvrir(g) {
  await page.click(`.g[data-g="${g}"]`);
  return jusqua(async () => page.evaluate(() => Boolean(document.getElementById('pad'))));
}
/** Referme la salle et attend la liste. */
async function fermer() {
  await page.evaluate(() => document.getElementById('sortir')?.click());
  await jusqua(async () => page.evaluate(() => !document.getElementById('salle')?.classList.contains('on')));
}

/* =================================== un geste positionnel ne bouge pas

   Le tifo se trace du doigt : le cadre qui se déroberait sous lui fausserait
   la mesure. Le toucher a son tic et ses huit millisecondes, rien d'autre. */
{
  await ouvrir('tifo');
  const pos = await page.evaluate(() => {
    window.__vib.length = 0; window.__sons.length = 0;
    const p = document.getElementById('pad');
    const r = p.getBoundingClientRect();
    p.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 3 }));
    return { enfonce: p.classList.contains('hit') || p.classList.contains('tbf-pave')
        || p.hasAttribute('data-frappe'),
      transforme: getComputedStyle(p).transform !== 'none' && getComputedStyle(p).transform !== '',
      bouffee: Boolean(document.querySelector('#zone .tbf-bouffee')),
      vib: [...window.__vib], tic: window.__sons.includes('tic') };
  });
  check('le tifo ne s’enfonce pas, ne bouge pas et ne lâche pas de bouffée',
    !pos.enfonce && !pos.transforme && !pos.bouffee);
  check(`et son toucher rend le tic et huit millisecondes (${pos.vib.join(',')})`,
    pos.tic && pos.vib.length === 1 && pos.vib[0] === 8);
  await fermer();
}

/* ====================================== le calme coupe la vibration

   Le joueur qui a calmé les vibrations n'en reçoit plus aucune — la question
   est posée à chaque frappe, il peut changer d'avis en pleine partie. */
{
  await ouvrir('mash');
  const calme = await page.evaluate(() => {
    window.__vib.length = 0;
    document.documentElement.dataset.calme = 'vibrations';
    document.getElementById('pad').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const n = window.__vib.length;
    delete document.documentElement.dataset.calme;
    return n;
  });
  check('sous le calme « vibrations », la frappe ne vibre pas', calme === 0);
  await fermer();
}

/* ============================================ le verdict est servi

   Le compte se joue d'une touche : c'est le plus court des essais, et c'est
   la page qu'on éprouve ici, pas le geste. La réponse est imposée pour poser
   la page devant ce que le contrat permet (`CONTRATS.md` § 16.1 et § 17). */
async function essai(reponse) {
  IMPOSEE = reponse;
  try {
    await ouvrir('compte');
    await page.evaluate(() => document.getElementById('pad')
      .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await jusqua(async () => page.evaluate(() => Boolean(document.querySelector('#resultat .n'))), 6000);
    await dodo(120);
    return await page.evaluate(() => {
      const t = document.querySelector('#pad > .tbf-verdict');
      return {
        tampon: t?.textContent.trim() ?? null, code: t?.dataset.verdict ?? null,
        /* La couleur se lit sur la feuille, pas sur un attribut : c'est elle
           qui teint le tampon d'après `data-verdict`. Sur l'épreuve (un fond
           sombre), l'encre claire du ton. */
        couleur: t ? getComputedStyle(t).color : null,
        attendue: t ? (() => {
          const VAR = { parfait: '--vert-clair', bon: '--bleu-clair', moyen: '--projo', rate: '--flare-clair' };
          const sonde = document.createElement('span');
          sonde.style.color = `var(${VAR[t.dataset.verdict]})`;
          document.body.appendChild(sonde);
          const c = getComputedStyle(sonde).color;
          sonde.remove();
          return c;
        })() : null,
        clac: t?.classList.contains('tbf-clac') ?? false,
        centre: t ? (() => {
          const a = t.getBoundingClientRect();
          const b = document.getElementById('pad').getBoundingClientRect();
          /* Au centre dans les deux sens : posé dans le flux de l'épreuve, il y
             prenait une ligne — ou une case de grille — sous ce qu'il juge. */
          return Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2) < 3
            && Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) < 3;
        })() : false,
        tampons: document.querySelectorAll('.tbf-verdict').length,
        note: document.querySelector('#resultat .n')?.textContent.trim() ?? '',
        resultat: document.getElementById('resultat')?.innerText ?? '',
      };
    });
  } finally {
    IMPOSEE = null;
    await fermer();
  }
}
const ANCIENS = /PARFAIT|TRÈS BIEN|ÇA VIENT|À REPRENDRE|\bBON\b|MOYEN|RATÉ/;
{
  /* Une note de 0,95 et le mot « bon » : un seuil écrit dans la page dirait
     PARFAIT. C'est le mot servi qui s'écrit. */
  const r = await essai({ note: 0.95, refuse: null, verdict: 'bon' });
  check(`le mot servi l’emporte sur la note (0.95 et « bon » → ${r.tampon})`,
    r.tampon === 'BON' && r.code === 'bon' && r.tampons === 1);
  check(`il claque au milieu de l’épreuve, dans l’encre de son ton (${r.couleur})`,
    r.clac && r.centre && r.couleur === r.attendue);
  check(`la note chiffrée reste (${r.note})`, /^0[.,]95\/1$/.test(r.note.replace(/\s/g, '')));
}
{
  const r = await essai({ note: 0.3, refuse: null, verdict: 'parfait' });
  check(`et dans l’autre sens (0.30 et « parfait » → ${r.tampon})`,
    r.tampon === 'PARFAIT' && r.code === 'parfait' && r.couleur === r.attendue);
}
{
  const r = await essai({ note: 0.6, refuse: null, verdict: 'moyen' });
  const s = await essai({ note: 0.2, refuse: null, verdict: 'rate' });
  check(`MOYEN et RATÉ prennent chacun leur encre (${r.couleur}, ${s.couleur})`,
    r.tampon === 'MOYEN' && r.couleur === r.attendue && s.tampon === 'RATÉ' && s.couleur === s.attendue
    && r.couleur !== s.couleur);
}
{
  /* Un serveur d'avant la vague 2 : la note, et rien d'autre. Jamais un mot
     deviné — ni sur le pavé, ni sous la note. */
  const r = await essai({ note: 0.93, refuse: null });
  check(`sans mot servi, pas de tampon et pas de mot (${r.note})`,
    r.tampons === 0 && !ANCIENS.test(r.resultat) && /^0[.,]93\/1$/.test(r.note.replace(/\s/g, '')));
}
{
  const r = await essai({ note: 0.5, refuse: null, verdict: 'genial' });
  check('un mot inconnu ne s’écrit pas', r.tampons === 0 && !/genial/i.test(r.resultat));
}
{
  /* Un refus n'a pas de verdict, même si une réponse en portait un. */
  const r = await essai({ note: 0, refuse: 'trop_regulier', verdict: 'parfait' });
  check(`un geste refusé dit REFUSÉ, sans verdict (${r.resultat.split('\n')[0]})`,
    r.tampons === 0 && /REFUSÉ/.test(r.resultat) && !/PARFAIT/.test(r.resultat));
}

/* ================================== l'épreuve jugée reste entière

   Le verdict tombé, la note et les trois portes reprennent leur hauteur — cent
   cinquante pixels à 360 × 640 — et la zone de l'épreuve rétrécit d'autant.
   La grille du tri n'y tenait plus : la zone la coupait, la rangée du haut
   tronquée et la ligne « RAMASSE LE ■ », qui nomme la couleur à ramasser et
   donne leur sens aux cartons cerclés de rouge, coupée en deux (audit du lot
   6, `repetition@tri`, aux deux formats où la salle se joue le plus serré).
   La salle réduit désormais l'épreuve jugée, d'un bloc, pour qu'elle tienne
   entière ; pendant le geste, rien ne change.

   Trois choses, vues comme le joueur les voit : chaque carton et la ligne de
   la couleur sont **dans le cadre** de la zone (son cadre de mise en page,
   entre la consigne et la note) ; ils y sont **peints** — le point de chacun
   de leurs coins rend le carton lui-même, ou le tampon posé dessus, et pas
   ce qui est dessous : une coupe au bord de la zone, avant ou après la
   réduction, cache sans déplacer ; et le tampon reste **au centre** de la
   grille. Avant le verdict, la grille est à sa taille : rien n'est réduit. */
{
  const vus = [];
  for (const [largeur, hauteur] of [[360, 640], [320, 568]]) {
    await page.setViewport({ width: largeur, height: hauteur });
    IMPOSEE = { note: 0.82, refuse: null, verdict: 'bon' };
    try {
      await ouvrir('tri');
      /* La largeur peinte de la grille rapportée à sa largeur de mise en
         page : 1 tant que rien ne la réduit, quelle que soit la part de la
         zone que la feuille lui donne. */
      const pendant = await page.evaluate(() => {
        const pad = document.getElementById('pad');
        return { reduite: getComputedStyle(document.getElementById('zone')).transform !== 'none',
          echelle: pad.getBoundingClientRect().width / parseFloat(getComputedStyle(pad).width) };
      });
      for (const i of [0, 1]) {
        await page.evaluate((n) => document.querySelector(`#pad [data-c="${n}"]`)
          ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), i);
        await dodo(120);
      }
      await page.evaluate(() => document.getElementById('valider')?.click());
      const jugee = await jusqua(async () => page.evaluate(() =>
        Boolean(document.querySelector('#salle.jugee #pad > .tbf-verdict'))), 6000);
      await dodo(400);
      const vu = await page.evaluate(() => {
        const zone = document.getElementById('zone');
        const salle = document.getElementById('salle').getBoundingClientRect();
        // Le cadre de la zone tel que la mise en page le pose, réduction ou non.
        const haut = salle.top + zone.offsetTop;
        const cadre = { haut, bas: haut + zone.offsetHeight };
        const dehors = (r) => r.top < cadre.haut - 0.5 || r.bottom > cadre.bas + 0.5;
        const peint = (el) => {
          const r = el.getBoundingClientRect();
          return [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2],
            [r.right - 2, r.bottom - 2]].every(([x, y]) => {
            const h = document.elementFromPoint(x, y);
            return Boolean(h && (el.contains(h) || h.closest('.tbf-verdict')));
          });
        };
        const cartons = [...document.querySelectorAll('#pad [data-c]')];
        const ligne = document.querySelector('#zone > #s');
        const t = document.querySelector('#pad > .tbf-verdict')?.getBoundingClientRect();
        const g = document.getElementById('pad').getBoundingClientRect();
        return {
          cartons: cartons.length,
          horsCadre: cartons.filter((c) => dehors(c.getBoundingClientRect())).length,
          caches: cartons.filter((c) => !peint(c)).length,
          ligne: ligne ? { texte: ligne.textContent.trim(), dehors: dehors(ligne.getBoundingClientRect()),
            peinte: peint(ligne) } : null,
          centre: Boolean(t && Math.abs((t.top + t.bottom) / 2 - (g.top + g.bottom) / 2) < 3
            && Math.abs((t.left + t.right) / 2 - (g.left + g.right) / 2) < 3),
          reduite: getComputedStyle(zone).getPropertyValue('--ajuste').trim() || '1',
        };
      });
      vus.push({ format: `${largeur}×${hauteur}`, jugee, pendant, ...vu });
    } finally {
      IMPOSEE = null;
      await fermer();
    }
  }
  await page.setViewport({ width: 390, height: 860 });
  for (const v of vus) {
    check(`${v.format} : avant le verdict, la grille du tri est à sa taille (échelle `
      + `${v.pendant.echelle.toFixed(2)}${v.pendant.reduite ? ', zone réduite' : ''})`,
      !v.pendant.reduite && Math.abs(v.pendant.echelle - 1) < 0.01);
    check(`${v.format} : jugée, ses ${v.cartons} cartons tiennent dans le cadre de la zone `
      + `(${v.horsCadre} dehors, réduite à ${v.reduite})`, v.jugee && v.cartons > 0 && v.horsCadre === 0);
    check(`${v.format} : et aucun n’y est coupé (${v.caches} caché${v.caches > 1 ? 's' : ''})`,
      v.jugee && v.cartons > 0 && v.caches === 0);
    check(`${v.format} : la ligne « ${v.ligne?.texte ?? '?'} » est entière, sous la grille`,
      Boolean(v.ligne && /RAMASSE/.test(v.ligne.texte) && !v.ligne.dehors && v.ligne.peinte));
    check(`${v.format} : le tampon reste au centre de la grille`, v.centre);
  }
}

/* ====================================== la fenêtre attend son verdict

   Ce que les deux arènes appellent (`TBF_GESTE.attendre`) : la fenêtre du
   geste attend la réponse six cents millisecondes au plus après la dernière
   frappe, y claque le tampon et se laisse lire ; trop tard, elle rend la main
   et le tampon claque sur la carte jouée ; sans mot, elle rend la main tout
   de suite. Éprouvé ici sur des réponses fabriquées, à des instants choisis. */
{
  const r = await page.evaluate(async () => {
    const G = window.TBF_GESTE;
    const dodo = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const zone = () => {
      const z = document.createElement('div');
      z.innerHTML = '<div id="pad" style="width:220px;height:220px"></div>';
      document.body.appendChild(z);
      return z;
    };
    const plusTard = (ms, v, rate = false) => new Promise((ok, ko) =>
      setTimeout(() => (rate ? ko(new Error('réseau')) : ok(v)), ms));
    const mesure = async (reponse, o) => {
      const t0 = performance.now();
      const s = await G.attendre(reponse, o);
      return { ...s, ms: Math.round(performance.now() - t0) };
    };
    const out = {};

    let z = zone();
    out.aTemps = await mesure(plusTard(150, 'parfait'), { zone: z });
    out.aTemps.tampon = z.querySelector('#pad > .tbf-verdict')?.textContent ?? null;
    z.remove();

    z = zone();
    const carte = document.createElement('div');
    // Hors du flux : le corps de la page est une rangée flexible, qui rétrécirait
    // une carte posée à sa suite jusqu'à zéro.
    carte.style.cssText = 'position:fixed;left:0;top:0;width:62px;height:93px';
    document.body.appendChild(carte);
    out.tard = await mesure(plusTard(900, { verdict: 'bon' }), { zone: z, carte: () => carte, duree: 300 });
    out.tard.fenetre = Boolean(z.querySelector('.tbf-verdict'));
    await dodo(450);
    const t = carte.querySelector('.tbf-verdict');
    out.tard.carte = t?.textContent ?? null;
    out.tard.plein = t?.classList.contains('tbf-tampon--plein') ?? false;
    await dodo(450);
    out.tard.retire = !carte.querySelector('.tbf-verdict');
    z.remove(); carte.remove();

    // Chaque réponse est fabriquée au moment de l'appel, pas avant : prête
    // d'avance, elle ne mesurerait plus le « tout de suite ».
    for (const [cle, reponse] of [['vide', () => plusTard(40, null)], ['rejet', () => plusTard(40, null, true)],
      ['inconnu', () => plusTard(40, 'genial')]]) {
      z = zone();
      out[cle] = await mesure(reponse(), { zone: z, carte: () => z });
      out[cle].tampon = Boolean(document.querySelector('.tbf-verdict'));
      z.remove();
    }

    /* L'échéance se compte depuis la dernière frappe, pas depuis l'appel : un
       compte joué — sa touche est sa dernière frappe, et elle le finit —,
       puis 400 ms d'attente avant d'appeler : il ne reste que 200 ms, et une
       réponse à 300 ms arrive trop tard. */
    z = document.createElement('div');
    document.body.appendChild(z);
    const g = await fetch('/api/repetition').then((x) => x.json());
    const p = G.jouer('compte', g.gestes, { zone: z });
    await dodo(60);
    z.querySelector('#pad').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await p;
    await dodo(400);
    out.depuisLaFin = await mesure(plusTard(300, 'parfait'), { zone: z, carte: () => null });
    out.depuisLaFin.tampon = Boolean(z.querySelector('.tbf-verdict'));
    z.remove();
    return out;
  });

  check(`à temps : le tampon claque dans la fenêtre, puis se lit (${r.aTemps.pose}, ${r.aTemps.ms} ms)`,
    r.aTemps.verdict === 'parfait' && r.aTemps.pose === 'fenetre' && r.aTemps.tampon === 'PARFAIT'
    && r.aTemps.ms >= 700 && r.aTemps.ms < 1200);
  check(`trop tard : la fenêtre rend la main à 600 ms (${r.tard.pose}, ${r.tard.ms} ms), sans tampon`,
    r.tard.pose === 'carte' && r.tard.verdict === null && !r.tard.fenetre
    && r.tard.ms >= 550 && r.tard.ms < 850);
  check(`et le tampon claque sur la carte jouée à l’arrivée, plein (${r.tard.carte})`,
    r.tard.carte === 'BON' && r.tard.plein);
  check('puis s’en retire', r.tard.retire);
  check(`sans mot, rejetée ou inconnue : la main tout de suite, rien de posé (${r.vide.ms}, ${r.rejet.ms}, ${r.inconnu.ms} ms)`,
    [r.vide, r.rejet, r.inconnu].every((x) => x.pose === null && x.verdict === null && !x.tampon && x.ms < 300));
  check(`l’échéance part de la dernière frappe, pas de l’appel (${r.depuisLaFin.pose}, ${r.depuisLaFin.ms} ms)`,
    r.depuisLaFin.pose === 'carte' && !r.depuisLaFin.tampon && r.depuisLaFin.ms < 290);
}

/* ================================= « 600 ms après la dernière frappe »

   Le brief à la lettre. Pour qu'elle tienne, **le geste de rythme finit sur
   sa dernière frappe attendue** : la fenêtre du tempo restait ouverte 420 ms
   après le dernier temps, celle du contretemps un demi-temps et 360 ms,
   celle de l'écho 900 ms, et l'échéance d'une attente comptée depuis la
   frappe était passée avant que les frappes partent.

     - **toutes les frappes données** : le geste finit sur la dernière, qui
       enfonce le pavé comme les autres ; la fenêtre rend la main six cents
       millisecondes après elle, pas une de plus ;
     - **une frappe manquée** : la fenêtre l'a attendue jusqu'à sa
       fermeture ; l'échéance, comptée depuis la dernière frappe prise, est
       passée, et elle rend la main tout de suite (le tampon claquera sur la
       carte) ;
     - **la relance** : le lâcher la finit, et l'attente part de lui — pas
       des 120 ms qui suivent ; son signal « lâche » vibre une fois, à
       l'instant attendu (il vibrait toutes les quarante millisecondes
       jusqu'au lâcher) ; et un pointeur qui sort du pavé sans avoir appuyé
       ne la finit pas. */
{
  const r = await page.evaluate(async () => {
    const G = window.TBF_GESTE;
    const dodo = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const jamais = new Promise(() => {});
    const zone = () => {
      const z = document.createElement('div');
      z.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:300px';
      document.body.appendChild(z);
      return z;
    };
    const carte = () => {
      const c = document.createElement('div');
      c.style.cssText = 'position:fixed;left:0;top:0;width:62px;height:93px';
      document.body.appendChild(c);
      return c;
    };
    const releve = (z) => {
      const vus = [];
      const v = new MutationObserver((ms) => {
        const t = performance.now();
        for (const m of ms) {
          if (m.target.id === 'ring' && m.target.classList.contains('beat')
            && !/\bbeat\b/.test(m.oldValue ?? '') && !(vus.length && t - vus[vus.length - 1] < 50)) vus.push(t);
        }
      });
      v.observe(z, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
      return { vus, fin: () => v.disconnect() };
    };
    const frapper = (pad) => pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const TEMPO = { tempo: { interval: 300, beats: 3, window: 150 } };
    const out = {};

    /* Les trois temps frappés, chacun sur sa pulsation. */
    let z = zone();
    let o = releve(z);
    let c = carte();
    let rendu = null;
    const p = G.jouer('tempo', TEMPO, { zone: z }).then((t) => { rendu = performance.now(); return t; });
    let pad = z.querySelector('#pad');
    let derniere = 0;
    let enfoncee = false;
    for (let k = 0; k < 3; k++) {
      const borne = performance.now() + 3000;
      while (o.vus.length <= k && performance.now() < borne) await dodo(2);
      frapper(pad);
      derniere = performance.now();
      if (k === 2) enfoncee = pad.classList.contains('hit');
    }
    let taps = await p;
    o.fin();
    let s = await G.attendre(jamais, { zone: z, carte: () => c });
    out.complet = { frappes: taps.length, finApres: Math.round(rendu - derniere), enfoncee,
      attente: Math.round(performance.now() - derniere), pose: s.pose };
    z.remove(); c.remove();

    /* Deux temps frappés sur trois : la fenêtre attend le troisième jusqu'à
       sa fermeture. */
    z = zone();
    o = releve(z);
    c = carte();
    const p2 = G.jouer('tempo', TEMPO, { zone: z });
    pad = z.querySelector('#pad');
    for (let k = 0; k < 2; k++) {
      const borne = performance.now() + 3000;
      while (o.vus.length <= k && performance.now() < borne) await dodo(2);
      frapper(pad);
    }
    taps = await p2;
    o.fin();
    const appel = performance.now();
    s = await G.attendre(jamais, { zone: z, carte: () => c });
    out.manque = { frappes: taps.length, attente: Math.round(performance.now() - appel), pose: s.pose };
    z.remove(); c.remove();

    /* La relance : un survol sans appui, puis tenir et lâcher 600 ms après
       l'instant attendu. Les vibrations sont relevées avec leur instant. */
    const vibs = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true,
      value: (x) => { vibs.push({ x, t: performance.now() }); return true; } });
    z = zone();
    c = carte();
    const t0 = performance.now();
    let resolue = false;
    const p3 = G.jouer('relance', { relance: { attente: 400, tenirMin: 100, window: 230 } }, { zone: z });
    p3.then(() => { resolue = true; });
    pad = z.querySelector('#pad');
    pad.dispatchEvent(new PointerEvent('pointerleave'));
    await dodo(250);
    const survol = !resolue;
    frapper(pad);
    await dodo(Math.max(0, 1000 - (performance.now() - t0)));
    pad.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const lache = performance.now();
    await p3;
    s = await G.attendre(jamais, { zone: z, carte: () => c });
    out.relance = { survol, attente: Math.round(performance.now() - lache), pose: s.pose,
      signaux: vibs.filter((v) => v.x === 18).map((v) => Math.round(v.t - t0)) };
    delete navigator.vibrate;
    z.remove(); c.remove();
    return out;
  });
  check(`toutes les frappes données, le geste finit sur la dernière (${r.complet.frappes} frappes, rendues ${
    r.complet.finApres} ms après)`, r.complet.frappes === 3 && r.complet.finApres >= 0 && r.complet.finApres < 40);
  check('et cette dernière frappe enfonce le pavé comme les autres', r.complet.enfoncee);
  check(`la fenêtre rend la main 600 ms après la dernière frappe (${r.complet.pose}, ${r.complet.attente} ms)`,
    r.complet.pose === 'carte' && r.complet.attente >= 570 && r.complet.attente < 680);
  check(`une frappe manquée : l’échéance est déjà passée, la main tout de suite (${r.manque.frappes} frappes, ${
    r.manque.pose}, ${r.manque.attente} ms)`,
  r.manque.frappes === 2 && r.manque.pose === 'carte' && r.manque.attente < 60);
  check(`la relance : l’attente part du lâcher (${r.relance.pose}, ${r.relance.attente} ms)`,
    r.relance.pose === 'carte' && r.relance.attente >= 560 && r.relance.attente < 670);
  check(`son signal « lâche » vibre une fois, à l’instant attendu (${r.relance.signaux.join(', ') || 'aucun'} ms)`,
    r.relance.signaux.length === 1 && Math.abs(r.relance.signaux[0] - 400) <= 40);
  check('un pointeur qui sort du pavé sans avoir appuyé ne la finit pas', r.relance.survol);
}

/* ======================================== la grille, sous le doigt

   Ce que le lecteur fait de sa grille (`TBF_GESTE.grille`) dans un vrai
   navigateur, sur des configurations choisies : `gestes:test` la joue contre
   la note, ici on regarde l'anneau battre et le pavé compter.

     - **exactement les temps servis** : à 250 ms d'intervalle, la minuterie
       d'avant battait un cinquième temps après le quatrième (elle courait
       jusqu'à la fermeture, 420 ms plus tard) ;
     - **le décompte ne compte pas** : avant le premier temps (moins une
       fenêtre), le pavé ne prend rien — ni compte, ni tic, ni bouffée —, et
       la frappe sur le premier temps vaut zéro ;
     - **l'origine prêtée** par la page (celle du chant) devient le zéro des
       pulsations ; trop vieille, elle est ignorée ;
     - **sans durées**, la fenêtre se referme aussitôt, sans battre ni
       vibrer — le tempo sans intervalle battait toutes les quatre
       millisecondes, sans fin ;
     - **l'écho se compte depuis la première frappe**, pas depuis « À TOI » ;
     - **sa démonstration a un temps d'avance**, comme le crescendo : elle ne
       bat plus à l'ouverture. */
{
  const r = await page.evaluate(async () => {
    const G = window.TBF_GESTE;
    const dodo = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const zone = () => {
      const z = document.createElement('div');
      z.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:300px';
      document.body.appendChild(z);
      return z;
    };
    /* L'anneau, relevé comme plus haut : une classe `beat` remise sur
       l'anneau lui-même (deux mutations, une pulsation). Pas une mutation
       quelconque de la zone : le pavé qui remonte à la fermeture en est une. */
    const releve = (z) => {
      const vus = [];
      const v = new MutationObserver((ms) => {
        const t = performance.now();
        for (const m of ms) {
          if (m.target.id === 'ring' && m.target.classList.contains('beat')
            && !/\bbeat\b/.test(m.oldValue ?? '') && !(vus.length && t - vus[vus.length - 1] < 50)) vus.push(t);
        }
      });
      v.observe(z, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
      return { vus, fin: () => v.disconnect() };
    };
    const out = {};

    let z = zone();
    let o = releve(z);
    let t0 = performance.now();
    await G.jouer('tempo', { tempo: { interval: 250, beats: 4, window: 120 } }, { zone: z });
    o.fin();
    out.vite = o.vus.map((t) => Math.round(t - t0));
    z.remove();

    z = zone();
    o = releve(z);
    window.__vib.length = 0; window.__sons.length = 0;
    const p = G.jouer('tempo', { tempo: { interval: 500, beats: 3, window: 150 } }, { zone: z });
    const pad = z.querySelector('#pad');
    pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    out.decompte = { compte: z.querySelector('#n')?.textContent, hit: pad.classList.contains('hit'),
      bouffee: Boolean(pad.querySelector('.tbf-bouffee')), sons: window.__sons.length, vib: window.__vib.length };
    while (!o.vus.length) await dodo(2);
    pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    out.premier = await p;
    o.fin();
    z.remove();

    z = zone();
    o = releve(z);
    const origine = performance.now() - 120;
    await G.jouer('tempo', { tempo: { interval: 300, beats: 2, window: 150 } }, { zone: z, origine });
    o.fin();
    out.origine = o.vus.map((t) => Math.round(t - origine));
    z.remove();

    z = zone();
    o = releve(z);
    t0 = performance.now();
    await G.jouer('tempo', { tempo: { interval: 300, beats: 2, window: 150 } }, { zone: z, origine: t0 - 5000 });
    o.fin();
    out.vieille = o.vus.map((t) => Math.round(t - t0));
    z.remove();

    z = zone();
    o = releve(z);
    window.__vib.length = 0;
    t0 = performance.now();
    const vide = await G.jouer('tempo', {}, { zone: z });
    out.sans = { ms: Math.round(performance.now() - t0), frappes: vide.length, pulsations: o.vus.length,
      vib: window.__vib.length };
    o.fin();
    z.remove();

    z = zone();
    o = releve(z);
    t0 = performance.now();
    const pe = G.jouer('echo', { echo: { instants: [0, 300], window: 190 } }, { zone: z });
    while (!/À TOI/.test(z.querySelector('#s')?.textContent ?? '') && performance.now() - t0 < 4000) await dodo(5);
    out.echoTour = Math.round(performance.now() - t0);
    o.fin();
    out.echoDemo = o.vus.map((t) => Math.round(t - t0));
    await dodo(250);
    const pe2 = z.querySelector('#pad');
    pe2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await dodo(300);
    pe2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    out.echo = await pe;
    z.remove();
    return out;
  });
  const pres = (a, b, tol) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= tol);
  check(`à 250 ms d’intervalle, quatre pulsations pour quatre temps (${r.vite.join(', ')})`,
    pres(r.vite, [250, 500, 750, 1000], 30));
  check(`une frappe du décompte n’est pas prise (${JSON.stringify(r.decompte)})`,
    r.decompte.compte === '0' && !r.decompte.hit && !r.decompte.bouffee
    && r.decompte.sons === 0 && r.decompte.vib === 0);
  check(`la frappe sur le premier temps vaut zéro (${r.premier.join(', ')})`,
    r.premier.length === 1 && Math.abs(r.premier[0]) < 60);
  check(`l’origine prêtée par la page est le zéro des pulsations (${r.origine.join(', ')})`,
    pres(r.origine, [300, 600], 30));
  check(`trop vieille, elle est ignorée (${r.vieille.join(', ')})`, pres(r.vieille, [300, 600], 30));
  check(`sans durées, la fenêtre se referme aussitôt, sans battre (${JSON.stringify(r.sans)})`,
    r.sans.ms < 150 && r.sans.frappes === 0 && r.sans.pulsations === 0 && r.sans.vib === 0);
  check(`l’écho se compte depuis la première frappe, pas depuis « À TOI » (${r.echo.join(', ')})`,
    r.echo.length === 2 && r.echo[0] === 0 && Math.abs(r.echo[1] - 300) < 40);
  /* La démonstration d'un motif de 0 et 300 ms : un temps d'avance (le plus
     court du motif, 300), ses deux coups à 300 et 600, puis « À TOI » sept
     cents millisecondes après le dernier. Elle battait à 0 et 300 : la
     tribune, qui chante ces instants, trouvait le premier déjà passé. */
  check(`la démonstration de l’écho a un temps d’avance (${r.echoDemo.join(', ')}, « À TOI » à ${r.echoTour})`,
    pres(r.echoDemo, [300, 600], 30) && Math.abs(r.echoTour - 1300) <= 40);
}

/* ================================ le crescendo voit venir son premier temps

   Il le battait à l'ouverture même : personne ne pouvait le frapper à
   temps. L'ouverture est désormais le temps zéro, qu'on ne frappe pas, et
   le premier temps vient un intervalle plus tard (le premier du crescendo) ;
   une frappe à l'ouverture tombe dans le décompte et n'est pas prise. Les
   frappes rendues, elles, ne bougent pas : comptées depuis le premier temps.

   **Et le tampon claque à l'impact** : `.tbf-clac` descend en 260 ms et
   touche à 60 %, le son du clac partait à la pose, un sixième de seconde
   avant le coup. Sous le calme « animations », le tampon est posé sans
   descendre : le son part tout de suite. */
{
  const r = await page.evaluate(async () => {
    const G = window.TBF_GESTE;
    const dodo = (ms) => new Promise((ok) => setTimeout(ok, ms));
    const z = document.createElement('div');
    z.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:300px';
    document.body.appendChild(z);
    const vus = [];
    const v = new MutationObserver((ms) => {
      const t = performance.now();
      for (const m of ms) {
        if (m.target.id === 'ring' && m.target.classList.contains('beat')
          && !/\bbeat\b/.test(m.oldValue ?? '') && !(vus.length && t - vus[vus.length - 1] < 50)) vus.push(t);
      }
    });
    v.observe(z, { subtree: true, attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    const t0 = performance.now();
    const p = G.jouer('crescendo', { crescendo: { instants: [0, 300, 500], window: 150 } }, { zone: z });
    const pad = z.querySelector('#pad');
    const frapper = () => pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    frapper();
    const ouverture = z.querySelector('#n')?.textContent;
    for (let k = 0; k < 3; k++) {
      const borne = performance.now() + 3000;
      while (vus.length <= k && performance.now() < borne) await dodo(2);
      frapper();
    }
    const frappes = await p;
    v.disconnect();
    z.remove();

    /* Le clac, relevé avec son instant sur `FX.son`, le temps de deux
       tampons ; l'enveloppe d'avant est remise ensuite. */
    const sons = [];
    const son = window.FX.son;
    window.FX.son = (n, o) => { sons.push({ n, t: performance.now() }); return son(n, o); };
    const hote = document.createElement('div');
    hote.style.cssText = 'position:fixed;left:0;top:0;width:220px;height:220px';
    document.body.appendChild(hote);
    const poseVive = performance.now();
    G.tamponner(hote, 'bon');
    await dodo(400);
    const vif = sons.find((x) => x.n === 'bache');
    sons.length = 0;
    document.documentElement.dataset.calme = 'animations';
    const poseCalme = performance.now();
    G.tamponner(hote, 'moyen');
    await dodo(120);
    const calme = sons.find((x) => x.n === 'bache');
    delete document.documentElement.dataset.calme;
    window.FX.son = son;
    hote.remove();
    return { pulsations: vus.map((t) => Math.round(t - t0)), ouverture, frappes,
      impact: vif ? Math.round(vif.t - poseVive) : null,
      calme: calme ? Math.round(calme.t - poseCalme) : null };
  });
  const pres = (a, b, tol) => a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) <= tol);
  check(`le premier temps du crescendo vient un intervalle après l’ouverture (${r.pulsations.join(', ')})`,
    pres(r.pulsations, [300, 600, 800], 30));
  check(`une frappe à l’ouverture tombe dans le décompte (le compte reste à ${r.ouverture})`, r.ouverture === '0');
  check(`les frappes rendues se comptent depuis le premier temps (${r.frappes.join(', ')})`,
    pres(r.frappes, [0, 300, 500], 40));
  check(`le clac du tampon tombe à l’impact, pas à la pose (${r.impact} ms)`,
    r.impact !== null && r.impact >= 130 && r.impact < 230);
  check(`et tout de suite sous le calme « animations », où le tampon ne descend pas (${r.calme} ms)`,
    r.calme !== null && r.calme < 40);
}

/* ================================================== sur grand écran

   Au-delà de 1 180 px, la salle est une page large (`tbf-large`) : les
   familles se rangent deux par rangée, chacune avec ses tuiles sous son
   titre, et rien ne déborde. En dessous, une famille par rangée. */
{
  const familles = () => page.evaluate(() => ({
    f: [...document.querySelectorAll('#vue .fam')].map((f) => {
      const b = f.getBoundingClientRect();
      return { l: Math.round(b.left), t: Math.round(b.top) };
    }),
    deborde: document.documentElement.scrollWidth > window.innerWidth,
  }));
  await page.setViewport({ width: 1366, height: 682 });
  await page.goto(`${base}/repetition`, { waitUntil: 'networkidle0' });
  const g = await familles();
  check('à 1 366 px, les deux premières familles se tiennent côte à côte',
    g.f.length >= 2 && g.f[0].t === g.f[1].t && g.f[1].l > g.f[0].l
    || (console.log('        vu :', JSON.stringify(g.f.slice(0, 3))), false));
  check('et rien ne déborde de l’écran', !g.deborde);
  await page.setViewport({ width: 1100, height: 800 });
  const e = await familles();
  check('à 1 100 px, une famille par rangée',
    e.f.length >= 2 && e.f[1].t > e.f[0].t && e.f[1].l === e.f[0].l
    || (console.log('        vu :', JSON.stringify(e.f.slice(0, 3))), false));
  await page.setViewport({ width: 390, height: 860 });
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
