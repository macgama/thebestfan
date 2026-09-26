/**
 * Test de la collection : la vitrine, et ce qu'elle promet.
 *
 * ## Pourquoi cette suite existe
 *
 * La page était une liste de compteurs, et une liste de compteurs se relit. Elle
 * ouvre maintenant **chaque chose qui se gagne** dans la carte du jeu, avec un
 * feuilletage, une pile de vues, une planche par personnage et deux replis — et
 * rien de tout cela ne se vérifie à la lecture. Une vitrine qui lève à la
 * première vignette compile parfaitement.
 *
 * Ce qu'elle attrape, et que la relecture ne voit pas :
 *   - une carte qui ne se dessine pas parce que sa sorte n'a pas de branche —
 *     la faute que `dessinDeCarte` raconte cinq fois dans `cartes.js`, une par
 *     sorte oubliée ;
 *   - un rang qui ne suit pas le feuilletage : « 1 / 35 » sur la douzième ;
 *   - la rareté du **premier** âge affichée sur le troisième, c'est-à-dire un
 *     épique payé quatre-vingt-dix écharpes et rendu en gris ;
 *   - une planche vide parce que `parAge` arrive avec des clés de chaîne ;
 *   - un âge non débloqué présenté comme un manque ordinaire, alors qu'aucun
 *     booster ne peut le donner.
 *
 * ## Ni base, ni navigateur
 *
 * On charge le vrai `public/collection.html` avec les vraies bibliothèques de
 * dessin, et on simule les trois réponses d'API — construites, elles, à partir
 * des **vrais** catalogues partagés. Recopier une carte ou une pièce ici ferait
 * passer la suite sur des données qui ne sont pas celles du jeu : c'est la faute
 * que `vitrine-smoke.mjs` explique déjà, et elle vaut ici mot pour mot.
 *
 * Le mouvement réduit est déclaré : jsdom n'implémente ni `Element.animate` ni
 * les particules, et `fx.js` s'abstient de tout mouvement dans ce cas. On
 * éprouve donc la page, pas l'outil.
 *
 * Avant de lancer :  npm install
 * Usage : node scripts/collection-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { DEX, TYPES, RAR, SCARVES, EVO_COST, RATES, SETS } from '../src/shared/fanzzy/dex.js';
import { STUFF, SKINS } from '../src/shared/fanzzy/inventaire.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { ETATS_DESSINES, ETAT_DESSIN } from '../src/shared/fanzzy/rendus.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

let fautes = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) fautes++; };

/* ------------------------------------------------- le catalogue, en lignées

   `racine` et `stade` viennent du serveur dans la vraie réponse. On les
   recalcule ici depuis les chaînes `evo`, comme `catalogue.js` le fait : la
   page les lit pour ranger les âges, et une suite qui les inventerait
   n'éprouverait pas la rangée ÂGES. */

const parId = new Map(DEX.map((f) => [f.id, f]));
const racine = new Map();
const chaine = new Map();
const suivants = new Set(DEX.map((f) => f.evo).filter(Boolean));
for (const f of DEX) {
  if (suivants.has(f.id)) continue;            // ce n'est pas un premier âge
  const ages = [];
  let c = f;
  while (c && !ages.includes(c)) { ages.push(c); c = c.evo ? parId.get(c.evo) : null; }
  chaine.set(f.id, ages);
  for (const a of ages) racine.set(a.id, f.id);
}
const dexServi = DEX.map((f) => {
  const r = racine.get(f.id) ?? f.id;
  return { ...f, racine: r, stade: (chaine.get(r) ?? [f]).findIndex((x) => x.id === f.id) + 1 };
});
const persos = dexServi.filter((f) => f.racine === f.id);
const agesDe = (id) => (chaine.get(id) ?? []).length || 1;

const tenues = SKINS.map((s) => ({ ...s, pour: '*', publie: s.publie !== false }));
const tenuesGagnables = tenues.filter((t) => t.publie && t.id !== 'base');

/* ---------------------------------------------------- la bibliothèque servie

   Un joueur à mi-chemin : les cinq premiers personnages, deux pièces, les
   communes des cartes d'action. C'est le seul état qui exerce les **deux**
   faces de chaque vignette — possédée et en silhouette — et donc les deux
   pieds de la vitrine, celui qui félicite et celui qui montre le chemin. */

const MIENS = new Set(persos.slice(0, 5).map((f) => f.id));

const biblio = (() => {
  const T = {
    fanzzy: { gagnes: MIENS.size, possibles: persos.length,
      items: persos.map((f) => ({ id: f.id, nom: f.nom, rar: f.rar, possede: MIENS.has(f.id) })) },
    etats: { gagnes: 3, possibles: 0 },
    tenues: { gagnes: 2, possibles: 0 },
  };
  const parFanzzy = [];
  for (const f of persos) {
    const ages = agesDe(f.id);
    T.etats.possibles += ages * ETATS_DESSINES.length;
    T.tenues.possibles += ages * tenuesGagnables.length;
    if (!MIENS.has(f.id)) continue;
    parFanzzy.push({ id: f.id, nom: f.nom, stade: 1, ages,
      etats: { gagnes: 1, possibles: ages * ETATS_DESSINES.length },
      tenues: { gagnes: 1, possibles: ages * tenuesGagnables.length } });
  }
  T.stuff = { possibles: STUFF.length, gagnes: 2,
    items: STUFF.map((s, i) => ({ id: s.id, nom: s.nom, rar: s.rar, possede: i < 2 })) };
  T.actions = { possibles: ACTIONS.length,
    items: ACTIONS.map((a) => ({ id: a.id, nom: a.nom, rar: a.rar,
      possede: a.rar === 'commune' })) };
  T.actions.gagnes = T.actions.items.filter((a) => a.possede).length;
  const total = Object.values(T).reduce((s, t) => ({
    gagnes: s.gagnes + t.gagnes, possibles: s.possibles + t.possibles }),
  { gagnes: 0, possibles: 0 });
  return { total, types: T, parFanzzy };
})();

const dexPayload = {
  dex: dexServi, types: TYPES, rar: RAR, scarves: SCARVES, evoCost: EVO_COST,
  rates: RATES, stuff: STUFF, actions: ACTIONS, tenues,
  sets: SETS.map((s) => ({ ...s, ouverte: true, saison: 1 })),
  saison: { n: 1 }, aCollectionner: persos.length,
};

/**
 * La fiche d'un personnage, dans la forme exacte de la route.
 *
 * Un seul état gagné au premier âge, une seule tenue, et **les âges deux et
 * trois non débloqués** : c'est le cas qui vérifie que la planche dit « âge pas
 * encore débloqué » au lieu de compter ces cases comme un manque ordinaire.
 */
function fiche(id) {
  const f = parId.get(id);
  if (!f) return null;
  const ages = chaine.get(id) ?? [f];
  return {
    fanzzy: { id, ageId: id, nom: f.nom, type: f.type, set: f.set, stage: 1, rar: f.rar,
      mods: f.mods, cri: f.cri, histoire: f.histoire ?? null },
    possede: 1, stade: 1, echarpes: 40,
    lignee: ages.map((a, i) => ({ id: a.id, nom: a.nom, stage: i + 1, rar: a.rar,
      mods: a.mods ?? {}, cri: a.cri ?? null, possede: i === 0, cout: i ? 90 : 0 })),
    /* Les clés sont des nombres ici et des chaînes après JSON : la page doit
       lire les deux, et c'est le genre de détail qui ne se voit qu'en montant
       la vraie réponse. */
    parAge: Object.fromEntries([1, 2, 3].map((n) => [n, {
      skins: tenues.map((t, i) => ({ ...t, possede: n === 1 && i === 1, porte: false })),
      etats: ETATS_DESSINES.map((e, i) => ({ id: e, nom: e, dessin: ETAT_DESSIN[e] ?? '',
        possede: n === 1 && i === 0 })),
    }])),
  };
}

/* ------------------------------------------------------------------ la page */

const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  /* « Not implemented » n'est pas une faute de la page : c'est jsdom qui annonce
     ce qu'il ne sait pas faire — `canvas.toDataURL`, que `fanzzy-art.js` appelle
     pour choisir entre AVIF et WebP, et qu'il entoure déjà d'un `try`. Le
     compter ferait rougir la suite pour une limite de l'outil, ce qui est le
     meilleur moyen d'apprendre à ignorer les rouges. */
  if (/Not implemented/i.test(e.message)) return;
  console.log(` FAIL  erreur de script dans la page : ${e.message}`);
  if (e.detail?.stack) console.log(String(e.detail.stack).split('\n').slice(0, 4).join('\n'));
  fautes++;
});

const html = readFileSync(path.join(RACINE, 'public', 'collection.html'), 'utf8');
const reponse = (corps, ok = true) => Promise.resolve({
  ok, status: ok ? 200 : 404, json: async () => corps });

const dom = new JSDOM(html, {
  url: 'http://localhost/collection',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    /* Posé avant l'analyse : le script de la page part dès son exécution, et un
       fetch injecté après aurait laissé la page échouer en silence pendant que
       la suite mesurait le mauvais objet. */
    window.fetch = (u) => {
      const s = String(u);
      if (s.includes('/bibliotheque')) return reponse(biblio);
      if (s.includes('/api/fanzzy/dex')) return reponse(dexPayload);
      if (s.includes('/api/fanzzy/fiche/')) {
        const id = decodeURIComponent(s.split('/fiche/')[1].split('?')[0]);
        const d = fiche(id);
        return d ? reponse(d) : reponse({ error: 'fanzzy.error.unknown' }, false);
      }
      /* Le manifeste des dessins est absent : c'est le repli que la page
         garantit — les cartes se dessinent alors sur le portrait au repos. */
      return reponse(null, false);
    };
    window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      dispatchEvent() { return false; } });
    /* `resources: 'usable'` n'est pas activé : on injecte les vraies
       bibliothèques, dans l'ordre de la page. `cartes.js` lit `FZART` dès sa
       première ligne — l'ordre n'est pas un détail. */
    for (const f of ['fanzzy-art.js', 'fanzzy-fond.js', 'cartes.js', 'stuff-art.js',
      'action-art.js', 'fanzzy-etats.js']) {
      window.eval(readFileSync(path.join(RACINE, 'public', f), 'utf8'));
    }
  },
});

const w = dom.window;
const D = w.document;
/* `fx.js` arrive **après** l'analyse, comme dans la page : il est chargé en
   `defer` et pose sa feuille dans `document.head`, qui n'existe pas encore
   quand `beforeParse` tourne. */
w.eval(readFileSync(path.join(RACINE, 'public', 'fx.js'), 'utf8'));
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await attendre(20); }
  return false;
}
const clic = (el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
const touche = (key) => D.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
/** Le texte réellement affiché : sans les scripts, dont le source contient tout. */
function texte() {
  const c = D.body.cloneNode(true);
  for (const s of c.querySelectorAll('script,style')) s.remove();
  return c.textContent.replace(/\s+/g, ' ');
}
const rang = () => D.querySelector('.vitr-pas span')?.textContent.trim() ?? '';

/* ======================================================= 1. la page se monte */

console.log('\n  la bibliothèque');
await jusqua(() => D.querySelectorAll('.type').length >= 5);
check('les cinq types sont rangés',
  ['fanzzy', 'etats', 'tenues', 'stuff', 'actions']
    .every((k) => D.querySelector(`.type[data-type="${k}"]`)));
check('le total est chiffré', /\d+ \/ \d+/.test(D.querySelector('.total .n')?.textContent ?? ''));
check('le manque mène au kiosque, au lieu de rester une impasse',
  D.querySelector('.total .aller')?.getAttribute('href') === '/boosters');
check('le manque est écrit en mots dans chaque bloc', /Il t’en manque \d+/.test(texte()));
check('chaque vignette est un bouton',
  D.querySelectorAll('.type[data-type="fanzzy"] button.vig').length
    === biblio.types.fanzzy.items.length);
check('la rareté porte le cadre des vignettes possédées',
  /r-(commune|rare|epique|legendaire)/.test(D.querySelector('.vig.oui')?.className ?? ''));

/* ==================================================== 2. une carte possédée */

console.log('\n  la carte, en grand');
clic(D.querySelector('.type[data-type="fanzzy"] .vig.oui'));
await jusqua(() => D.getElementById('vitr').classList.contains('on'));
check('la vitrine s’ouvre au clic', D.getElementById('vitr').classList.contains('on'));
check('elle montre la carte du jeu, pas une vignette maison',
  Boolean(D.querySelector('#vitr .fz')));
check('la page ne défile plus derrière',
  D.documentElement.classList.contains('vitrine-ouverte'));
check('elle dit qu’on la possède', /DANS TA COLLECTION/.test(texte()));
check('la rareté vit sur le carton, une seule fois',
  /r-(commune|rare|epique|legendaire)/.test(D.getElementById('vitr-carton').className));
check('elle chiffre le rang', /^1 \/ \d+$/.test(rang()));
check('la flèche arrière est éteinte au premier rang',
  D.querySelector('[data-pas="-1"]').disabled === true);
check('elle ouvre les deux portes états / tenues',
  D.querySelectorAll('[data-planche]').length === 2);
check('et mène à la fiche', /VOIR SA FICHE/.test(texte()));

/* ======================================================== 3. le feuilletage */

console.log('\n  le feuilletage');
const nom1 = D.querySelector('.vitr-nom').textContent.trim();
clic(D.querySelector('[data-pas="1"]'));
await attendre(40);
check('la flèche avant avance d’un rang', /^2 \/ \d+$/.test(rang()));
check('et change de carte', D.querySelector('.vitr-nom').textContent.trim() !== nom1);
clic(D.querySelector('[data-pas="-1"]'));
await attendre(40);
check('la flèche arrière revient exactement d’où l’on vient',
  /^1 \/ \d+$/.test(rang()) && D.querySelector('.vitr-nom').textContent.trim() === nom1);
touche('ArrowRight');
await attendre(40);
check('le clavier feuillette aussi', /^2 \/ \d+$/.test(rang()));
touche('ArrowLeft');
await attendre(40);

/* ============================================================= 4. les âges */

console.log('\n  les âges d’une lignée');
/* On repart de la grille. Dans un navigateur la vitrine couvre la page et
   avale le clic ; jsdom n'a pas de pointeur, et cliquer une vignette « sous »
   la vitrine empilerait une vue de plus — ce que la suite prendrait pour la
   faute qu'elle cherche justement à mesurer. */
clic(D.querySelector('.vitr-x'));
await attendre(40);
/* On cherche un personnage qui en a plusieurs : cent cinquante-deux n'ont que
   leur premier âge, et tomber sur l'un d'eux ferait passer la suite sans
   éprouver la rangée. */
const iLignee = biblio.types.fanzzy.items.findIndex((f) => MIENS.has(f.id) && agesDe(f.id) > 1);
if (iLignee < 0) {
  console.log('  --   aucun personnage possédé n’a plus d’un âge : rangée non éprouvée');
} else {
  clic(D.querySelectorAll('.type[data-type="fanzzy"] .vig')[iLignee]);
  await attendre(60);
  const ages = D.querySelectorAll('[data-age]');
  check(`la rangée ÂGES montre les ${agesDe(biblio.types.fanzzy.items[iLignee].id)} âges écrits`,
    ages.length === agesDe(biblio.types.fanzzy.items[iLignee].id));
  check('l’âge regardé est marqué', D.querySelectorAll('[data-age].ici').length === 1);
  check('les âges non débloqués sont éteints', D.querySelectorAll('[data-age].pas').length >= 1);
  const avant = D.querySelector('.vitr-nom').textContent.trim();
  const rarAvant = D.getElementById('vitr-carton').className;
  clic(ages[ages.length - 1]);
  await attendre(60);
  check('toucher un âge change le visage', D.querySelector('.vitr-nom').textContent.trim() !== avant);
  check('et la rareté suit l’âge regardé, pas celle de la lignée',
    D.getElementById('vitr-carton').className !== rarAvant);
  check('sans empiler : le retour ramènerait à la grille',
    D.querySelector('.vitr-dos') === null);
  check('et sans bouger le rang', /^\d+ \/ \d+$/.test(rang()));
}

/* ========================================================= 5. la planche */

console.log('\n  la planche d’un personnage');
if (D.querySelector('.vitr-x')) clic(D.querySelector('.vitr-x'));
await attendre(40);
clic(D.querySelector('.type[data-type="fanzzy"] .vig.oui'));
await attendre(60);
clic(D.querySelector('[data-planche="etats"]'));
await jusqua(() => D.querySelector('.vitr-planche'));
check('la porte ouvre la planche des états', Boolean(D.querySelector('.vitr-planche')));
check('elle range par âge', D.querySelectorAll('.vitr-groupe').length >= 1);
check('elle montre les quatre états de chaque âge, gagnés ou non',
  [...D.querySelectorAll('.vitr-groupe')]
    .every((g) => g.querySelectorAll('.vitr-case').length === ETATS_DESSINES.length));
check('une flèche de retour est apparue', Boolean(D.querySelector('.vitr-dos')));
check('un âge non débloqué le dit, au lieu de compter comme un manque ordinaire',
  /âge pas encore débloqué/.test(texte()));

const nCases = D.querySelectorAll('.vitr-case').length;
clic(D.querySelectorAll('.vitr-case')[1]);
await attendre(60);
check('une case ouvre la carte de cet état', Boolean(D.querySelector('#vitr .fz')));
check('elle dit qu’il reste à gagner', /À GAGNER/.test(texte()));
check('elle dit où', /booster/i.test(texte()));
check('et elle se feuillette entre tous les états de tous les âges',
  Number(rang().split('/')[1]) === nCases);

clic(D.querySelector('.vitr-dos'));
await attendre(60);
check('le retour ramène à la planche, pas à la grille', Boolean(D.querySelector('.vitr-planche')));
clic(D.querySelector('.vitr-x'));
await attendre(40);
check('la croix ferme tout', !D.getElementById('vitr').classList.contains('on'));
check('et la page redevient défilable',
  !D.documentElement.classList.contains('vitrine-ouverte'));

/* ========================================== 6. les tenues, par la même porte */

console.log('\n  les tenues');
clic(D.querySelectorAll('.type[data-type="tenues"] .perso')[0]);
await jusqua(() => D.querySelector('.vitr-planche'));
check('la ligne d’un personnage ouvre ses tenues', /SES TENUES/.test(texte()));
check('et la planche est garnie', D.querySelectorAll('.vitr-case').length > 0);
clic(D.querySelectorAll('.vitr-case')[1]);
await attendre(60);
check('une tenue s’ouvre en carte', Boolean(D.querySelector('#vitr .fz')));
check('elle nomme le personnage et l’âge concernés', /ÂGE \d/.test(texte()));
clic(D.querySelector('.vitr-x'));
await attendre(40);

/* ============================================ 7. l’équipement et les actions */

console.log('\n  l’équipement et les cartes d’action');
clic(D.querySelector('.type[data-type="stuff"] .vig'));
await jusqua(() => D.getElementById('vitr').classList.contains('on'));
check('une pièce s’ouvre en carte', Boolean(D.querySelector('#vitr .fz')));
check('elle liste son bonus et son revers', D.querySelectorAll('.vitr-mods span').length >= 2);
clic(D.querySelector('.vitr-x'));
await attendre(40);

clic(D.querySelector('.type[data-type="actions"] .vig'));
await jusqua(() => D.getElementById('vitr').classList.contains('on'));
check('une carte d’action s’ouvre', Boolean(D.querySelector('#vitr .fz')));
check('avec son coût en souffle', /DE SOUFFLE/.test(texte()));
check('et une commune dit qu’elle est à tout le monde', /premier jour/.test(texte()));
touche('Escape');
await attendre(40);
check('Échap ferme', !D.getElementById('vitr').classList.contains('on'));

/* ==================================================== 8. tout est atteignable */

console.log('\n  rien ne lève, sur aucune sorte');
/* La faute que `dessinDeCarte` raconte cinq fois : une sorte sans branche
   tombait sur le bonhomme gris, ou levait. On ouvre donc **tout** — les cent
   soixante-six personnages, les dix-sept pièces, les trente-neuf cartes — et on
   compte les cadres obtenus. Un seul manquant est une sorte oubliée. */
let dessinees = 0;
let ouvertes = 0;
for (const [type, sel] of [['fanzzy', '.type[data-type="fanzzy"] .vig'],
  ['stuff', '.type[data-type="stuff"] .vig'], ['actions', '.type[data-type="actions"] .vig']]) {
  const vignettes = [...D.querySelectorAll(sel)];
  for (const v of vignettes) {
    clic(v);
    await attendre(0);
    ouvertes++;
    if (D.querySelector('#vitr .fz')) dessinees++;
    else console.log(`        ${type} : ${v.textContent.trim()} sans carte`);
    /* Enchaîné sans un souffle : c'est ce rythme-là qui a fait apparaître le
       `history.back()` en vol, celui qui refermait la carte suivante. */
    const x = D.querySelector('.vitr-x');
    if (x) clic(x); else console.log(`        ${type} : ${v.textContent.trim()} sans croix`);
  }
}
check(`les ${ouvertes} cartes des trois grilles se dessinent toutes (${dessinees})`,
  dessinees === ouvertes);

console.log(fautes ? `\n${fautes} faute(s) — ne pas livrer en l’état.`
  : '\nLa collection s’ouvre, se feuillette et dit où trouver ce qui manque.');
process.exitCode = fautes ? 1 : 0;
