/**
 * Test de la collection : l'album, la vitrine, et ce qu'ils promettent.
 *
 * ## Pourquoi cette suite existe
 *
 * La page était une liste de compteurs, et une liste de compteurs se relit. Elle
 * ouvre maintenant **chaque chose qui se gagne** dans la carte du jeu, avec un
 * feuilletage, une pile de vues, une planche par personnage et deux replis — et
 * rien de tout cela ne se vérifie à la lecture. Une vitrine qui lève à la
 * première vignette compile parfaitement.
 *
 * ## L'album (lot 4 de la refonte FAIT MAIN)
 *
 * L'accordéon de cinq blocs — treize mille pixels une fois tout ouvert — est
 * devenu un album : en tête, **le niveau de collectionneur** (l'anneau des
 * crans, le titre de palier, ce que rapporte le prochain cran, RÉCUPÉRER) ;
 * dessous, **cinq rayons** (`.tbf-rayon[data-vue]`), chacun ouvrant sa
 * sous-vue — l'album des Fanzzy, le même composant que le classeur
 * (`.tbf-album`, une page par série, seules la page ouverte et ses voisines
 * montées), les planches d'états et de tenues, les grilles de l'équipement et
 * des actions. Tout ce qui s'y touche (`[data-open][data-liste][data-i]`)
 * s'ouvre dans **la vitrine**, la modale commune (`.tbf-vitrine-*`).
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
 *     booster ne peut le donner ;
 *   - un album qui monte ses cent cinquante cartes d'un coup, ou une page qui
 *     ne compte pas ce qu'elle montre ;
 *   - un anneau qui met le total de la bibliothèque sous le seuil d'un cran
 *     (contrat § 5.1), une nouveauté éteinte avant d'avoir été montrée
 *     (§ 2.2), un RÉCUPÉRER qui reste après avoir versé.
 *
 * ## Ni base, ni navigateur
 *
 * On charge le vrai `public/collection.html` avec les vraies bibliothèques de
 * dessin, et on simule les réponses d'API — construites, elles, à partir des
 * **vrais** catalogues partagés et dans la forme que `serveur/CONTRATS.md`
 * écrit. Recopier une carte ou une pièce ici ferait passer la suite sur des
 * données qui ne sont pas celles du jeu : c'est la faute que
 * `vitrine-smoke.mjs` explique déjà, et elle vaut ici mot pour mot.
 *
 * Le mouvement réduit est déclaré : jsdom n'implémente ni `Element.animate` ni
 * les particules, et `fx.js` s'abstient de tout mouvement dans ce cas. On
 * éprouve donc la page, pas l'outil. Pour la même raison, l'album tourne ses
 * pages d'un coup (sans glisser) : c'est le chemin du mode calme.
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
/** Les âges d'une lignée, du premier au dernier. */
const lignee = (id) => chaine.get(id) ?? [parId.get(id)].filter(Boolean);
const agesDe = (id) => lignee(id).length || 1;

const tenues = SKINS.map((s) => ({ ...s, pour: '*', publie: s.publie !== false }));
const tenuesGagnables = tenues.filter((t) => t.publie && t.id !== 'base');

/* ---------------------------------------------------- la bibliothèque servie

   Un joueur à mi-chemin : les cinq premiers personnages, deux pièces, les
   communes des cartes d'action. C'est le seul état qui exerce les **deux**
   faces de chaque case — possédée et en pochette — et donc les deux pieds de
   la vitrine, celui qui félicite et celui qui montre le chemin. */

const MIENS = new Set(persos.slice(0, 5).map((f) => f.id));
/* **Le personnage de la suite** : possédé, et doté d'une lignée — sans le
   second âge, la rangée des âges ne paraît pas (« ÂGE 1 » seul n'apprend
   rien) et les contrôles des âges passeraient sans rien avoir regardé. C'est
   lui qui arrive en dernier (NOUVEAU), qui a trois exemplaires (×3), et que
   le joueur montre (AVATAR). Sa série est la page d'arrivée de l'album. */
const MIEN = persos.find((f) => MIENS.has(f.id) && agesDe(f.id) > 1) ?? null;
if (!MIEN) throw new Error('aucun des personnages possédés n’a de lignée : la suite ne peut rien éprouver.');
const SERIE = MIEN.set;
const itemsSerie = persos.filter((f) => f.set === SERIE);

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
  /* **Les paliers, tels que la route les sert** (`CONTRATS.md`, § 5.1) : les
     crans se comptent **sans les tenues** (`gagnes` et `possibles` de la même
     réponse, moins ceux des tenues), un cran franchi et pas encore récupéré
     attend dans `aReclamer`, le prochain dit ce qu'il rapporte, et la série
     du personnage de la suite dit ce que rapporte sa page complète.

     Le cran est de dix, et non de vingt-cinq comme dans l'exemple du contrat :
     sa taille est une donnée (`cran`), et c'est le seul moyen d'avoir un cran
     dû avec une collection à mi-chemin — RÉCUPÉRER ne s'éprouve qu'ainsi. */
  const gain = (echarpes, packs) => ({ echarpes, packs, xp: 0, tampons: 0 });
  const cran = 10;
  const gagnes = total.gagnes - T.tenues.gagnes;
  const possibles = total.possibles - T.tenues.possibles;
  const franchi = Math.floor(gagnes / cran) * cran;
  const paliers = {
    cran, gagnes, possibles,
    prochain: { a: franchi + cran, manque: franchi + cran - gagnes, gain: gain(25, 0) },
    aReclamer: franchi >= cran ? [{ sorte: 'cran', cle: String(franchi), gain: gain(25, 0) }] : [],
    series: [{ id: SERIE, possedes: itemsSerie.filter((f) => MIENS.has(f.id)).length,
      total: itemsSerie.length, etat: 'a_venir', gain: gain(100, 1) }],
  };
  return { total, types: T, parFanzzy, paliers };
})();

const dexPayload = {
  dex: dexServi, types: TYPES, rar: RAR, scarves: SCARVES, evoCost: EVO_COST,
  rates: RATES, stuff: STUFF, actions: ACTIONS, tenues,
  sets: SETS.map((s) => ({ ...s, ouverte: true, saison: 1 })),
  saison: { n: 1 }, aCollectionner: persos.length,
};

/* **L'état du joueur** (`/api/fanzzy/state`) : ses exemplaires — trois du
   personnage de la suite —, ses nouveautés dans la forme du contrat (§ 2.1),
   et l'avatar que le serveur résout (§ 3). La page en tire le « ×3 », NOUVEAU
   et AVATAR ; sans lui, elle s'afficherait sans, et ne lèverait pas. */
const etatServi = {
  collection: Object.fromEntries([...MIENS].map((id) => [id, id === MIEN.id ? 3 : 1])),
  nouveautes: [{ cle: `fanzzy:${MIEN.id}`, sorte: 'fanzzy', id: MIEN.id }],
  wallet: { scarves: 40, packs: 3,
    avatar: { id: MIEN.id, age: MIEN.id, evo: 1, nom: MIEN.nom, skin: 'base', etat: null, rar: MIEN.rar } },
};

/** Ce que verse RÉCUPÉRER : tout ce qui attendait, et les paliers à jour (R6). */
function recuperation() {
  const dus = biblio.paliers.aReclamer;
  const somme = (k) => dus.reduce((s, x) => s + (x.gain?.[k] ?? 0), 0);
  return { verse: dus.length > 0,
    gain: { echarpes: somme('echarpes'), packs: somme('packs'), xp: 0, tampons: 0 },
    wallet: { scarves: 40 + somme('echarpes'), packs: 3 },
    paliers: { ...biblio.paliers, aReclamer: [] } };
}

/**
 * La fiche d'un personnage, dans la forme exacte de la route.
 *
 * Un seul état gagné au premier âge, une seule tenue, et **les âges deux et
 * trois non débloqués** : c'est le cas qui vérifie que la planche dit « âge pas
 * encore atteint » au lieu de compter ces cases comme un manque ordinaire.
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
/* Une copie à chaque réponse, comme le réseau en rend une : la page écrit
   dans ce qu'elle reçoit (`E.B.paliers = j.paliers` après RÉCUPÉRER), et
   rendre l'objet de la suite lui-même ferait changer les attendus en douce. */
const reponse = (corps, ok = true) => Promise.resolve({
  ok, status: ok ? 200 : 404, json: async () => structuredClone(corps) });

/** Ce que la page a envoyé au serveur, par route : le corps de chaque POST. */
const postes = { vu: [], palier: [] };

const dom = new JSDOM(html, {
  url: 'http://localhost/collection',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    /* Posé avant l'analyse : le script de la page part dès son exécution, et un
       fetch injecté après aurait laissé la page échouer en silence pendant que
       la suite mesurait le mauvais objet. */
    window.fetch = (u, o = {}) => {
      const s = String(u);
      const corps = () => { try { return JSON.parse(o.body ?? 'null'); } catch { return null; } };
      if (s.includes('/api/fanzzy/vu')) { postes.vu.push(corps()); return reponse({ restantes: 0 }); }
      if (s.includes('/api/fanzzy/palier')) { postes.palier.push(corps()); return reponse(recuperation()); }
      if (s.includes('/api/fanzzy/state')) return reponse(etatServi);
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
    /* **Le défilement d'un élément**, que jsdom n'a pas (`Element.scrollTo`
       n'existe pas, `window.scrollTo` ne fait qu'annoncer qu'il manque).
       L'album s'en sert pour tourner ses pages et ramener le rail sous le
       doigt : sans lui, le premier toucher d'un onglet levait — une limite de
       l'outil, pas une faute de la page. On pose la position, sans plus. */
    window.Element.prototype.scrollTo = function scrollTo(x, y) {
      const o = x && typeof x === 'object' ? x : { left: x, top: y };
      if (Number.isFinite(o.left)) this.scrollLeft = o.left;
      if (Number.isFinite(o.top)) this.scrollTop = o.top;
    };
    window.scrollTo = () => {};
    /* `resources: 'usable'` n'est pas activé : on injecte les vraies
       bibliothèques, dans l'ordre de la page. `cartes.js` lit `FZART` dès sa
       première ligne — l'ordre n'est pas un détail.

       `mods.js` est en tête parce qu'il ne dépend de rien, et parce que
       `cartes.js` l'appelle pour nommer les effets d'une carte : sans lui, la
       vitrine affiche la carte mais sa liste d'effets reste vide. Cette liste
       étant **écrite en dur**, elle est une seconde vérité à côté de la page —
       et elle a déjà vieilli d'un fichier : `logo-art.js` (les emblèmes des
       séries et des familles, lot 4) l'a rejointe. */
    for (const f of ['mods.js', 'fanzzy-art.js', 'fanzzy-fond.js', 'cartes.js',
      'stuff-art.js', 'action-art.js', 'logo-art.js', 'fanzzy-etats.js']) {
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
/* Un toucher sur rien ne fait pas tomber la suite : l'ancienne s'arrêtait là
   (`clic(null)`), et aucun de ses contrôles ne disait ce qu'il avait trouvé.
   Le contrôle qui suit rougit, et dit pourquoi. */
const clic = (el) => {
  if (!el) { console.log('        (rien à toucher ici)'); return false; }
  el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  return true;
};
const touche = (key) => D.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true }));
/** Le texte réellement affiché : sans les scripts, dont le source contient tout. */
function texte() {
  const c = D.body.cloneNode(true);
  for (const s of c.querySelectorAll('script,style')) s.remove();
  return c.textContent.replace(/\s+/g, ' ');
}
const $ = (id) => D.getElementById(id);
/* **Le texte de la vitrine seule.** La page garde l'accueil et la sous-vue
   montés derrière elle, et l'album dit déjà « 1 BOOSTER » dans l'en-tête de
   sa série : chercher « booster » dans toute la page passerait même si la
   vitrine ne le disait pas. */
const vitrine = () => ($('vitr')?.textContent ?? '').replace(/\s+/g, ' ');
const vitrineOuverte = () => $('vitr').classList.contains('on');
const rang = () => D.querySelector('#vitr .tbf-vitrine-pas span')?.textContent.trim() ?? '';
const nomVitrine = () => D.querySelector('#vitr .tbf-vitrine-nom')?.textContent.trim() ?? '';
const scene = () => $('vitr-scene');
const pageAlbum = (serie) => [...D.querySelectorAll('#vue .tbf-album-page')]
  .find((p) => p.dataset.page === serie) ?? null;
const caseDe = (serie, id) => pageAlbum(serie)?.querySelector(`[data-open="${id}"]`) ?? null;
/* **Le numéro de pochette attendu : la place de la carte dans l'album de sa
   série, plus un** — la règle du classeur (fanzzy.html, `cartesDe`), que
   /collection reprend parce que c'est le même album (`numeroDe`). Tous les
   âges de la série à la suite, les légendaires à la fin, puis par numéro de
   lignée, puis par âge : TR2 vient après TR1, TR1B et TR1C, il est donc
   « N° 004 », et c'est ce que montre la maquette du classeur (N° 004, 005,
   006 pour la deuxième lignée).

   Les chiffres de l'identifiant (TR2 → « N° 002 ») ne sont pas ce numéro :
   ils ne comptent pas les âges des lignées d'avant. Ce contrôle les lisait,
   et il aurait laissé passer la même carte manquante numérotée d'une façon
   au classeur et d'une autre ici. On ne se contente pas non plus de la forme
   « N° ddd » : on attend le numéro exact de chaque pochette.

   Recompté ici depuis le catalogue que la suite sert (`dexServi`, dont
   `racine` et `stade` sont tirés des chaînes `evo`), sur la série entière,
   et non relu dans la page : c'est la donnée qu'on compare, pas la recette
   à elle-même. Un identifiant inconnu n'a pas de numéro attendu (`null`),
   et sa pochette rougit. */
const NUMEROS = new Map();
for (const set of new Set(dexServi.map((f) => f.set))) {
  const deLignee = (f) => Number(/^[A-Z]+(\d+)/.exec(f.racine)?.[1] ?? 0);
  const leg = (f) => (f.rar === 'legendaire' ? 1 : 0);
  dexServi.filter((f) => f.set === set)
    .sort((a, b) => leg(a) - leg(b) || deLignee(a) - deLignee(b) || a.stade - b.stade)
    .forEach((f, i) => NUMEROS.set(f.id, i + 1));
}
const numero = (id) => (NUMEROS.has(id) ? `N° ${String(NUMEROS.get(id)).padStart(3, '0')}` : null);

/* **L'album pose une case par âge, comme le classeur** (fanzzy.html,
   `cartesDe` ; ici `ordreSerie`) : TR1, TR1B, TR1C, puis TR2 — et non plus
   une par personnage. C'est ce qui donne aux pochettes des numéros qui se
   suivent sans trou, les mêmes d'un écran à l'autre. La série de la suite a
   donc autant de cases que d'âges (168 pour 68 personnages en TR), dans
   l'ordre des numéros. L'en-tête, lui, reste compté en personnages : un âge
   supérieur ne sort d'aucun booster, il s'achète.

   **Ce que chaque case doit être**, tiré de l'âge atteint que sert la
   bibliothèque (`parFanzzy[].stade`), et non de la page :
     atteint   l'âge est atteint — sa carte, collée (`.fz` sans secret) ;
     secret    un âge plus loin d'une lignée qu'on a — sa carte au secret
               (`.fz.fz-secret`), le prix sur le suivant seulement ;
     pochette  tout le reste — la pochette au numéro de l'âge. */
const AGES = dexServi.filter((f) => f.set === SERIE)
  .sort((a, b) => NUMEROS.get(a.id) - NUMEROS.get(b.id));
const atteintDe = (racine) => biblio.parFanzzy.find((p) => p.id === racine)?.stade ?? 0;
function formeAttendue(id) {
  const f = dexServi.find((x) => x.id === id);
  if (!f) return null;
  const a = atteintDe(f.racine);
  return a >= f.stade ? 'atteint' : a ? 'secret' : 'pochette';
}
/** Le prix qu'une carte au secret doit porter : celui du **seul** âge
    suivant (il s'achète), rien pour ceux d'après (il faudra d'abord l'autre). */
function prixAttendu(id) {
  const f = dexServi.find((x) => x.id === id);
  const prix = Number(EVO_COST[f?.stade]);
  return f && f.stade === atteintDe(f.racine) + 1 && prix > 0 ? String(prix) : '';
}

/** Ferme la vitrine par sa croix. */
async function fermerVitrine() {
  clic(D.querySelector('#vitr .tbf-vitrine-x'));
  await attendre(40);
}
/** Ouvre un rayon de l'accueil, et attend sa sous-vue. */
async function ouvrirRayon(vue) {
  clic(D.querySelector(`#accueil .tbf-rayon[data-vue="${vue}"]`));
  await jusqua(() => !$('vue').hidden && Boolean(D.querySelector('#vue .vue-tete')));
}
/**
 * Revient à l'accueil par la flèche de la sous-vue. On laisse d'abord arriver
 * le retour d'historique d'une vitrine qu'on vient de fermer : la flèche, elle
 * aussi, recule dans l'historique, et deux retours en vol n'en font pas deux.
 */
async function revenirAccueil() {
  await attendre(60);
  clic(D.querySelector('#vue [data-retour-vue]'));
  await jusqua(() => !$('accueil').hidden && Boolean(D.querySelector('#rayons')));
}

/* ======================================================= 1. l'accueil */

console.log('\n  l’accueil : le collectionneur et ses rayons');
await jusqua(() => D.querySelectorAll('.tbf-rayon[data-vue]').length >= 5);
/* La clé de la sous-vue, et celle du type dans la bibliothèque : elles ne
   s'écrivent pas pareil pour l'équipement. */
const RAYONS = { fanzzy: 'fanzzy', etats: 'etats', tenues: 'tenues', equipement: 'stuff', actions: 'actions' };
{
  const rayons = [...D.querySelectorAll('#accueil .tbf-rayon[data-vue]')];
  check('les cinq rayons sont rangés, dans l’ordre',
    JSON.stringify(rayons.map((r) => r.dataset.vue)) === JSON.stringify(Object.keys(RAYONS)));
  check('chacun est un bouton', rayons.length === 5 && rayons.every((r) => r.tagName === 'BUTTON'));
  const comptes = Object.entries(RAYONS).map(([vue, type]) => {
    const r = rayons.find((x) => x.dataset.vue === vue);
    const t = biblio.types[type];
    return { vue, montre: r?.querySelector('small')?.textContent.replace(/\s+/g, ' ').trim() ?? '',
      dit: r?.getAttribute('aria-label') ?? '', attendu: `${t.gagnes} / ${t.possibles}`,
      enMots: `${t.gagnes} sur ${t.possibles}` };
  });
  check('chaque rayon chiffre son compte, celui de la bibliothèque',
    comptes.every((c) => c.montre === c.attendu)
    || (console.log('        ', comptes.map((c) => `${c.vue} « ${c.montre} »`).join(' · ')), false));
  check('et le dit en mots, pour qui ne voit pas l’anneau',
    comptes.every((c) => c.dit.includes(c.enMots)));
  /* Le drapeau du serveur (§ 2.1) : une nouveauté, sur le rayon de sa sorte,
     et sur lui seul. */
  check('le rayon des Fanzzy annonce sa nouveauté (+1)',
    rayons.find((r) => r.dataset.vue === 'fanzzy')?.dataset.pastille === '+1');
  check('et lui seul', rayons.filter((r) => r.dataset.pastille).length === 1);

  /* **L'anneau compte les crans**, tenues à part, et jamais le total de la
     bibliothèque sous le seuil d'un cran (§ 5.1). **Il vise le palier en
     cours** (amendement 22), comme la tuile de la collection sur le hub
     (index.html, `palierDe`) : « 20/30 », le prochain cran (`prochain.a`),
     et non « 20/3311 », un anneau vide à l'œil à côté d'un sticker qui
     promet le cran de 30. Sans cran au-dessus du compte (tout est gagné), il
     vise le total. Le compte des crans et le total se disent dans son
     étiquette.

     Le prochain cran servi tombe entre le compte et le total des crans :
     sans quoi « le palier » et « le total » seraient le même chiffre, et le
     contrôle ne départagerait pas l'ancien anneau du nouveau. */
  const P = biblio.paliers;
  const vise = P.prochain.a > P.gagnes ? P.prochain.a : P.possibles;
  const cercle = D.querySelector('#collectionneur .tbf-cercle');
  const montre = `${cercle?.querySelector('b')?.textContent.trim() ?? ''}${cercle?.querySelector('small')?.textContent.trim() ?? ''}`;
  check(`l’anneau du collectionneur vise le palier en cours, tenues à part (${montre})`,
    P.gagnes < P.prochain.a && P.prochain.a < P.possibles
    && montre === `${P.gagnes}/${vise}`);
  /* Ce que l'anneau montre, il le dit aussi en mots ; et ce qu'il ne montre
     plus — le compte des crans, le total de la bibliothèque — il le dit
     encore, puisque c'est le seul endroit de la page où ils figurent. */
  const dit = cercle?.getAttribute('aria-label') ?? '';
  check('et son étiquette dit le palier visé, le compte des crans et le total de la bibliothèque',
    dit.includes(`${P.gagnes} sur ${vise}`)
    && dit.includes(`${P.gagnes} sur ${P.possibles}`)
    && dit.includes(`${biblio.total.gagnes} sur ${biblio.total.possibles} en tout`)
    || (console.log('        il dit :', dit), false));
  check('le titre de palier est écrit',
    /^(ABONNÉ|ULTRA|CAPO)$/.test(D.querySelector('#collectionneur .tbf-banderole')?.textContent.trim() ?? ''));
  /* Écrit par ce qu'il ouvre, jamais par le mot « cran » (amendement 22). */
  const jalon = D.querySelector('#collectionneur .tbf-sticker--jalon')?.textContent.replace(/\s+/g, ' ') ?? '';
  check('le prochain cran dit ce qu’il rapporte, par ce qu’il ouvre',
    new RegExp(`${P.prochain.a}\\s*→\\s*25 ÉCHARPES`).test(jalon) && !/cran/i.test(jalon)
    || (console.log('        il dit :', jalon), false));

  /* RÉCUPÉRER : là seulement si un cran attend, et parti une fois versé. Le
     gain monte sur un ticket — un gain n'est jamais un toast. */
  const bouton = $('recuperer');
  check('RÉCUPÉRER paraît, puisqu’un cran attend, avec ce qu’il verse',
    Boolean(bouton) && /\+25/.test(bouton?.textContent ?? ''));
  clic(bouton);
  await jusqua(() => Boolean(D.querySelector('.tbf-pile .tbf-ticket--gain')) && !$('recuperer'));
  check('il demande tout ce qui attend, d’un seul geste',
    postes.palier.length === 1 && postes.palier[0]?.tout === true);
  const ticket = D.querySelector('.tbf-pile .tbf-ticket--gain');
  check('le gain monte sur un ticket',
    ticket?.querySelector('b')?.textContent.trim() === '+25' && /ÉCHARPES/.test(ticket?.textContent ?? ''));
  check('et le bouton s’en va : plus rien n’attend', !$('recuperer'));
  check('aucune nouveauté n’est éteinte au chargement', postes.vu.length === 0);
}

/* ======================================================= 2. l'album des Fanzzy */

console.log('\n  l’album des Fanzzy');
await ouvrirRayon('fanzzy');
{
  /* L'arrivée : la page de la série du dernier arrivé, pour que NOUVEAU se
     voie sans chercher. */
  check('il s’ouvre sur la série du dernier arrivé',
    D.querySelector(`#vue .tbf-album-onglet[data-serie="${SERIE}"]`)?.getAttribute('aria-current') === 'true');
  /* **Seules la page ouverte et ses deux voisines sont montées** : un album
     de cent cinquante cartes n'en monte pas cent cinquante. Les autres pages
     existent, vides, pour garder leur largeur au balayage. */
  const pages = [...D.querySelectorAll('#vue .tbf-album-page')];
  const ici = pages.findIndex((p) => p.dataset.page === SERIE);
  const montees = pages.map((p, k) => (p.childElementCount > 0 ? k : -1)).filter((k) => k >= 0);
  check(`une page par série (${pages.length})`, pages.length === SETS.length);
  check(`seules la page ouverte et ses voisines sont montées (${montees.join(', ')})`,
    ici >= 0 && JSON.stringify(montees) === JSON.stringify([ici - 1, ici, ici + 1].filter((k) => k >= 0 && k < pages.length)));
  check('et seule la page ouverte se touche', pages.every((p, k) => p.inert === (k !== ici)));

  const page = pageAlbum(SERIE);
  const cases = [...(page?.querySelectorAll('[data-open][data-liste][data-i]') ?? [])];
  /* Une case par âge (`AGES`), et dans l'ordre des numéros : c'est sur cet
     ordre que la vitrine compte son rang et que les pochettes se suivent. */
  check(`chaque âge de la série a sa case, dans l’ordre de l’album (${cases.length} pour ${AGES.length} âges de ${itemsSerie.length} personnages)`,
    JSON.stringify(cases.map((c) => c.dataset.open)) === JSON.stringify(AGES.map((f) => f.id)));
  check('chaque case se touche, au doigt et au clavier',
    cases.length > 0 && cases.every((c) => c.tagName === 'BUTTON'
      || (c.getAttribute('role') === 'button' && c.tabIndex === 0)));
  /* Un âge atteint : sa carte, collée. Un âge plus loin d'une lignée qu'on
     a : sa carte au secret, floutée — le flou est ce qu'on paie —, avec son
     prix sur le seul âge suivant. Tout le reste : une pochette, au numéro de
     l'âge dans l'album de la série (« N° 013 », `numero`, le même qu'au
     classeur) — on sait ce qu'on cherche sans qu'on nous le donne. En cas
     d'écart, on dit la forme attendue, le numéro lu et l'attendu : la classe
     seule ne disait pas lequel des deux manquait. */
  const prixLu = (c) => (c.querySelector('.fz.fz-secret .fz-prix')?.textContent ?? '').replace(/\D+/g, '');
  const malRangees = cases.filter((c) => {
    const forme = formeAttendue(c.dataset.open);
    if (forme === 'atteint') {
      return !(c.classList.contains('tbf-album-case') && c.querySelector('.fz:not(.fz-secret)'));
    }
    if (forme === 'secret') {
      return !(c.classList.contains('tbf-album-case') && c.querySelector('.fz.fz-secret')
        && prixLu(c) === prixAttendu(c.dataset.open));
    }
    return !(c.classList.contains('tbf-album-pochette')
      && c.querySelector('b')?.textContent.trim() === numero(c.dataset.open));
  });
  check('un âge atteint est sa carte, l’âge à venir sa carte au secret, le reste une pochette numérotée',
    cases.length > 0 && malRangees.length === 0
    || (console.log('        ', malRangees.slice(0, 3).map((c) => `${c.dataset.open} (${formeAttendue(c.dataset.open)}) : ${c.className}`
      + ` « ${c.querySelector('b')?.textContent.trim() ?? ''} », attendu « ${numero(c.dataset.open)} »`
      + `, prix « ${prixLu(c)} » pour « ${prixAttendu(c.dataset.open)} »`)
      .join(' · ')), false));
  /* Les trois formes sont bien là toutes trois : sans âge au secret (une
     lignée à un seul âge, un stub qui donnerait le dernier âge), le contrôle
     d'au-dessus passerait sans avoir vu la carte floutée ni son prix. */
  const formes = new Set(cases.map((c) => formeAttendue(c.dataset.open)));
  check('la page exerce les trois formes : atteint, au secret, en pochette',
    ['atteint', 'secret', 'pochette'].every((f) => formes.has(f))
    && cases.some((c) => prixAttendu(c.dataset.open) !== ''));
  check('la rareté porte le cadre des cartes collées',
    cases.filter((c) => c.querySelector('.fz')).every((c) =>
      c.querySelector('.fz').classList.contains(`r-${parId.get(c.dataset.open).rar}`)));

  const mienne = caseDe(SERIE, MIEN.id);
  check('le dernier arrivé porte NOUVEAU',
    /NOUVEAU/.test(mienne?.querySelector('.tbf-sticker[data-ton="flare"]')?.textContent ?? ''));
  check('ses doublons se comptent sur sa carte (×3)',
    mienne?.querySelector('.fz-doublons')?.textContent.trim() === '×3');
  check('et l’avatar est marqué, lui seul',
    page?.querySelectorAll('.fz-avatar').length === 1 && Boolean(mienne?.querySelector('.fz-avatar')));

  /* L'en-tête de la série : ce qu'on en a, et ce que rapporte la page
     complète quand le serveur le sert (§ 5.1). Il compte **des personnages**,
     pas leurs âges, alors que la grille en pose un par case : un âge
     supérieur ne se trouve dans aucun booster, il s'achète, et la série se
     complète en personnages (le compte du classeur, et celui de `series`). */
  const tete = page?.querySelector('.tbf-album-tete');
  const eus = itemsSerie.filter((f) => MIENS.has(f.id)).length;
  check(`l’en-tête de la série chiffre ce qu’on en a (${eus} / ${itemsSerie.length})`,
    tete?.querySelector('.tbf-album-compte')?.textContent.replace(/\s+/g, ' ').trim() === `${eus} / ${itemsSerie.length}`);
  check('et dit ce que rapporte la série complète',
    /→ 1 BOOSTER ET 100 ÉCHARPES/.test(tete?.textContent.replace(/\s+/g, ' ') ?? ''));

  /* Les filtres : MANQUANTS, puis une famille. Les pages montées se
     refont ; on les relit. Ils se comptent **en âges**, comme les cases :
     MANQUANTS retire les âges atteints et eux seuls — un âge au secret
     reste à gagner (il s'achète), une pochette aussi ; une famille garde
     tous les âges de ses personnages. L'interrupteur s'appelait « Ce qu'il
     me reste » ici : il porte maintenant le mot du classeur, et le contrôle
     aussi, pour qu'un rouge nomme ce qu'on voit à l'écran. */
  const inter = D.querySelector('#vue .tbf-interrupteur');
  clic(inter);
  await attendre(20);
  const reste = [...(pageAlbum(SERIE)?.querySelectorAll('[data-open]') ?? [])];
  check('MANQUANTS ne garde que ce qui manque',
    inter?.getAttribute('aria-checked') === 'true'
    && reste.length === AGES.filter((f) => formeAttendue(f.id) !== 'atteint').length
    && reste.every((c) => formeAttendue(c.dataset.open) !== 'atteint'));
  clic(inter);
  await attendre(20);
  const famille = MIEN.type;
  const filtre = D.querySelector(`#vue .tbf-filtre[data-famille="${famille}"]`);
  check(`six familles en stickers ronds (${D.querySelectorAll('#vue .tbf-filtre[data-famille]').length})`,
    D.querySelectorAll('#vue .tbf-filtre[data-famille]').length === Object.keys(TYPES).length);
  clic(filtre);
  await attendre(20);
  const deLaFamille = [...(pageAlbum(SERIE)?.querySelectorAll('[data-open]') ?? [])];
  check('un filtre de famille ne garde que la sienne',
    filtre?.getAttribute('aria-pressed') === 'true'
    && deLaFamille.length === AGES.filter((f) => f.type === famille).length
    && deLaFamille.every((c) => parId.get(c.dataset.open)?.type === famille));
  clic(filtre);
  await attendre(20);
  check('et le retirer rend la page entière',
    pageAlbum(SERIE)?.querySelectorAll('[data-open]').length === AGES.length);
}

/* ==================================================== 3. une carte possédée */

console.log('\n  la carte, en grand');
const iMien = Number(caseDe(SERIE, MIEN.id)?.dataset.i ?? -1);
clic(caseDe(SERIE, MIEN.id));
await jusqua(vitrineOuverte);
check('la vitrine s’ouvre au toucher', vitrineOuverte());
check('elle montre la carte du jeu, pas une vignette maison', Boolean(D.querySelector('#vitr .fz')));
check('la page ne défile plus derrière',
  D.documentElement.classList.contains('tbf-vitrine-ouverte'));
check('elle dit qu’on la possède', /DANS TA COLLECTION/.test(vitrine()));
check('la rareté vit sur la scène, celle de la carte',
  scene()?.dataset.rar === MIEN.rar && D.querySelector('#vitr .fz')?.dataset.rar === MIEN.rar);
/* Le rang se compte sur ce qu'on feuillette : les cases de la page, donc
   les âges de la série (« 79 / 168 »), et non ses personnages. */
check(`elle chiffre le rang dans la série (${rang()})`, rang() === `${iMien + 1} / ${AGES.length}`);
check('ses doublons y sont tamponnés', /×3/.test(scene()?.querySelector('.tbf-tampon')?.textContent ?? ''));
check('elle ouvre les deux portes états / tenues', D.querySelectorAll('#vitr [data-planche]').length === 2);
/* Le prix vient du catalogue servi : un prix écrit ici mentirait au premier
   réglage. */
const grandir = [...D.querySelectorAll(`#vitr a[href="/fanzzy/${MIEN.id}"]`)]
  .find((a) => /FAIRE GRANDIR/.test(a.textContent));
check('elle offre de le faire grandir, au prix du catalogue',
  new RegExp(`\\b${EVO_COST[2]}\\b`).test(grandir?.textContent ?? ''));
check('et mène à sa fiche', [...D.querySelectorAll(`#vitr a[href="/fanzzy/${MIEN.id}"]`)]
  .some((a) => /VOIR SA FICHE/.test(a.textContent)));

/* ======================================================== 4. le feuilletage */

console.log('\n  le feuilletage');
{
  const nom1 = nomVitrine();
  clic(D.querySelector('#vitr [data-pas="1"]'));
  await attendre(40);
  check('la flèche avant avance d’un rang', rang() === `${iMien + 2} / ${AGES.length}`);
  check('et change de carte', nomVitrine() !== nom1);
  clic(D.querySelector('#vitr [data-pas="-1"]'));
  await attendre(40);
  check('la flèche arrière revient exactement d’où l’on vient',
    rang() === `${iMien + 1} / ${AGES.length}` && nomVitrine() === nom1);
  touche('ArrowRight');
  await attendre(40);
  check('le clavier feuillette aussi', rang() === `${iMien + 2} / ${AGES.length}`);
  touche('ArrowLeft');
  await attendre(40);
  await fermerVitrine();

  /* Les deux bouts : on ne boucle pas. Le dernier rang est le dernier âge
     de la série, la dernière case de la page. */
  clic(pageAlbum(SERIE)?.querySelector('[data-i="0"]'));
  await jusqua(vitrineOuverte);
  check('la flèche arrière est éteinte au premier rang',
    rang() === `1 / ${AGES.length}` && D.querySelector('#vitr [data-pas="-1"]')?.disabled === true);
  await fermerVitrine();
  clic(pageAlbum(SERIE)?.querySelector(`[data-i="${AGES.length - 1}"]`));
  await jusqua(vitrineOuverte);
  check('et la flèche avant au dernier',
    rang() === `${AGES.length} / ${AGES.length}` && D.querySelector('#vitr [data-pas="1"]')?.disabled === true);
  await fermerVitrine();

  /* Une carte qu'on n'a pas montre le chemin : le paquet de sa série, et la
     bâche qui y mène. Le manque ne reste pas une impasse. */
  const absente = [...(pageAlbum(SERIE)?.querySelectorAll('.tbf-album-pochette[data-open]') ?? [])][0];
  clic(absente);
  await jusqua(vitrineOuverte);
  check('une carte qu’on n’a pas dit qu’elle est à gagner', /À GAGNER/.test(vitrine()));
  check('le manque mène au kiosque, au lieu de rester une impasse',
    Boolean(D.querySelector('#vitr .tbf-vitrine-paquet a[href="/boosters"]')));
  await fermerVitrine();
}

/* ============================================================= 5. les âges

   **Signalé par le propriétaire du jeu, et en deux endroits d'une seule phrase :**
   « je vois l'image suivante même si je ne l'ai pas encore découvert dans un PACK
   et qu'elle ne fait pas partie de ma collection. »

   Ici, la rangée ÂGES remplaçait l'âge affiché sans toucher à `possede`, qui
   restait celui de la lignée. Un joueur qui possède son personnage voyait donc
   n'importe lequel de ses âges **en pleine couleur, sans cadenas, sous le bandeau
   « ✓ DANS TA COLLECTION »**. Ce n'était pas seulement montrer l'image : c'était
   l'affirmer à lui en mots.

   La rangée reste cliquable, et c'est voulu — cette vitrine existe pour montrer
   ce qui se gagne, et elle le montre partout ailleurs sous cadenas. Ce qui
   manquait n'était pas le verrou du bouton, c'était celui de la carte qu'il
   ouvre.

   Le stub donne `stade: 1` à tout ce qui est possédé : n'importe quel âge
   au-dessus du premier est donc non atteint, ce qui est exactement le cas à
   éprouver. Depuis le lot 4, l'âge **suivant** est la carte au secret avec son
   prix (on peut le payer), et ceux d'après le sont aussi, sous cadenas (il
   faudra d'abord l'autre). */

console.log('\n  les âges d’une lignée');
{
  const ages = lignee(MIEN.id);
  clic(caseDe(SERIE, MIEN.id));
  await jusqua(vitrineOuverte);
  const boutons = [...D.querySelectorAll('#vitr .tbf-vitrine-age[data-age]')];
  check(`la rangée ÂGES montre les ${ages.length} âges écrits`, boutons.length === ages.length);
  check('le premier âge est celui qu’on regarde',
    D.querySelectorAll('#vitr [data-age][aria-current="true"]').length === 1
    && boutons[0]?.getAttribute('aria-current') === 'true');
  check('et les suivants sont marqués non atteints',
    boutons.length > 1 && boutons.slice(1).every((b) => b.hasAttribute('data-verrou')));

  const nom1 = nomVitrine();
  const rang1 = rang();
  const dernier = ages[ages.length - 1];
  clic(boutons[boutons.length - 1]);
  await attendre(40);
  check('toucher un âge change le visage', nomVitrine() === dernier.nom && nomVitrine() !== nom1);
  check('et la rareté suit l’âge regardé, pas celle de la lignée',
    scene()?.dataset.rar === dernier.rar && dernier.rar !== MIEN.rar);
  check('sans empiler : le retour ramènerait à la grille', D.querySelector('#vitr [data-retour]') === null);
  check('et sans bouger le rang', rang() === rang1);

  const carte = () => D.querySelector('#vitr .fz');
  check('l’âge non atteint s’ouvre au secret, sous cadenas',
    Boolean(carte()?.classList.contains('fz-secret')) && Boolean(carte()?.classList.contains('fz-verrou'))
    && Boolean(D.querySelector('#vitr .fz .cadenas')));
  check('le bandeau ne dit plus qu’elle est à soi', !/DANS TA COLLECTION/.test(vitrine()));
  check('il dit ce qu’elle est', /ÂGE À DÉBLOQUER/.test(vitrine()));
  /* Un âge ne se trouve pas dans un booster — il se paie. Envoyer ouvrir des
     paquets serait envoyer chercher ce qu'aucun paquet ne contient. */
  check('et il n’envoie pas ouvrir un booster pour ça',
    /se paie en écharpes/.test(vitrine()) && !D.querySelector('#vitr a[href="/boosters"]'));

  /* On relit la rangée : `remplacer` a réécrit la vitrine, et `boutons` ne
     désigne plus que des nœuds détachés. Un clic sur l'un d'eux ne remonte
     nulle part — le contrôle échouait sans qu'il y ait de défaut. */
  clic(D.querySelectorAll('#vitr .tbf-vitrine-age[data-age]')[1]);
  await attendre(40);
  check('l’âge suivant, lui, porte son prix plutôt qu’un cadenas',
    Boolean(carte()?.classList.contains('fz-secret')) && !D.querySelector('#vitr .fz .cadenas')
    && new RegExp(`\\b${EVO_COST[2]}\\b`).test(D.querySelector('#vitr .fz .fz-prix')?.textContent ?? ''));

  clic(D.querySelectorAll('#vitr .tbf-vitrine-age[data-age]')[0]);
  await attendre(40);
  check('revenir au premier âge le rend à sa collection',
    /DANS TA COLLECTION/.test(vitrine())
    && !carte()?.classList.contains('fz-secret') && !carte()?.classList.contains('fz-verrou'));
}

/* ========================================================= 6. la planche */

console.log('\n  la planche d’un personnage');
{
  const ages = agesDe(MIEN.id);
  clic(D.querySelector('#vitr [data-planche="etats"]'));
  await jusqua(() => Boolean(D.querySelector('#vitr .tbf-planche')));
  check('la porte ouvre la planche des états',
    Boolean(D.querySelector('#vitr .tbf-planche[data-quoi="etats"]')) && /SES ÉTATS/.test(vitrine()));
  const cases = [...D.querySelectorAll('#vitr .tbf-planche-case')];
  const ageDe = (c) => c.querySelector('small')?.textContent.trim() ?? '';
  check(`elle montre les ${ETATS_DESSINES.length} états de chaque âge, gagnés ou non`,
    cases.length === ages * ETATS_DESSINES.length);
  check('elle les range par âge', Array.from({ length: ages }, (_, n) => n + 1)
    .every((n) => cases.filter((c) => ageDe(c) === `ÂGE ${n}`).length === ETATS_DESSINES.length));
  check('une flèche de retour est apparue', Boolean(D.querySelector('#vitr [data-retour]')));
  /* L'âge non débloqué se dit, et se marque — au lieu de compter comme un
     manque ordinaire, que n'importe quel booster comblerait. */
  const fermees = cases.filter((c) => ageDe(c) !== 'ÂGE 1');
  const ouvertes = cases.filter((c) => ageDe(c) === 'ÂGE 1' && c.dataset.etat !== 'possede');
  check('un âge non débloqué le dit, au lieu de compter comme un manque ordinaire',
    fermees.length > 0 && fermees.every((c) => c.hasAttribute('data-verrou')
      && /âge pas encore atteint/.test(c.getAttribute('aria-label') ?? ''))
    && ouvertes.every((c) => !c.hasAttribute('data-verrou') && /à gagner/.test(c.getAttribute('aria-label') ?? '')));
  check('et ce qu’on a est plein', cases[0]?.dataset.etat === 'possede');

  const nCases = cases.length;
  clic(cases[1]);
  await attendre(60);
  check('une case ouvre la carte de cet état', Boolean(D.querySelector('#vitr .fz')));
  check('elle dit qu’il reste à gagner', /À GAGNER/.test(vitrine()));
  check('elle dit où, et y mène',
    /booster/i.test(vitrine()) && Boolean(D.querySelector('#vitr .tbf-vitrine-paquet a[href="/boosters"]')));
  check('et elle se feuillette entre tous les états de tous les âges',
    Number(rang().split('/')[1]) === nCases);

  clic(D.querySelector('#vitr [data-retour]'));
  await attendre(60);
  check('le retour ramène à la planche, pas à la grille', Boolean(D.querySelector('#vitr .tbf-planche')));

  /* Et l'autre porte, par le même chemin : la planche des tenues. */
  clic(D.querySelector('#vitr [data-retour]'));
  await attendre(60);
  clic(D.querySelector('#vitr [data-planche="tenues"]'));
  await jusqua(() => Boolean(D.querySelector('#vitr .tbf-planche[data-quoi="tenues"]')));
  check('l’autre porte ouvre ses tenues, âge par âge',
    /SES TENUES/.test(vitrine())
    && D.querySelectorAll('#vitr .tbf-planche-case').length === ages * tenuesGagnables.length);

  await fermerVitrine();
  check('la croix ferme tout', !vitrineOuverte());
  check('et la page redevient défilable',
    !D.documentElement.classList.contains('tbf-vitrine-ouverte'));
}

/* ======================================= 7. quitter l'album éteint ce qu'on a vu

   **On éteint après avoir montré, jamais au chargement** (contrat § 2.2) : la
   nouveauté de la page d'arrivée a été montrée, elle part s'éteindre quand on
   quitte la sous-vue — et la pastille de son rayon s'éteint avec. */

console.log('\n  les nouveautés');
{
  check('rien ne s’éteint tant qu’on est dans l’album', postes.vu.length === 0);
  await revenirAccueil();
  await jusqua(() => postes.vu.length > 0, 2000);
  check('le quitter éteint ce qui y a été montré',
    postes.vu.length === 1 && Boolean(postes.vu[0]?.cles?.includes(`fanzzy:${MIEN.id}`)));
  check('et la pastille du rayon s’éteint avec',
    !D.querySelector('#accueil .tbf-rayon[data-vue="fanzzy"]')?.dataset.pastille);
}

/* ============================================== 8. les tenues, par leur rayon */

console.log('\n  les tenues');
await ouvrirRayon('tenues');
{
  /* Une planche par personnage qu'on a, son compte servi par la
     bibliothèque, ses cases demandées à sa fiche quand elle approche de
     l'écran (jsdom n'a pas d'observateur : la page remplit les premières).

     **Une planche de l'album ne montre que les âges atteints** : un âge
     pas encore atteint n'a rien à gagner — une tenue s'habille sur l'âge
     qui la reçoit. Son compte suit ce qui est dessiné : celui de la
     bibliothèque (`parFanzzy`, compté sur tous les âges, autant de cases à
     chacun) ramené aux âges atteints, `possibles / ages × stade`. La
     vitrine d'un personnage (SES TENUES, plus haut) garde, elle, les trois
     âges, ceux d'après sous cadenas : c'est là qu'on regarde ce que fera
     grandir. */
  const planches = [...D.querySelectorAll('#vue .tbf-planche[data-quoi="tenues"]')];
  check(`une planche par personnage qu’on a (${planches.length})`, planches.length === biblio.parFanzzy.length);
  const tampons = biblio.parFanzzy.map((p) => ({ id: p.id,
    lu: planches.find((x) => x.dataset.perso === p.id)
      ?.querySelector('.tbf-planche-tete .tbf-tampon')?.textContent.trim() ?? '',
    attendu: `${p.tenues.gagnes}/${Math.round((p.tenues.possibles / p.ages) * p.stade)}` }));
  check('chacune chiffre ses tenues gagnées, sur ses âges atteints',
    tampons.every((t) => t.lu === t.attendu)
    || (console.log('        ', tampons.filter((t) => t.lu !== t.attendu).slice(0, 3)
      .map((t) => `${t.id} « ${t.lu} » pour « ${t.attendu} »`).join(' · ')), false));
  const planche = planches.find((p) => p.dataset.perso === MIEN.id);
  await jusqua(() => (planche?.querySelectorAll('.tbf-planche-case').length ?? 0) > 0);
  const cases = [...(planche?.querySelectorAll('.tbf-planche-case') ?? [])];
  /* Autant de cases que de tenues à gagner sur chaque âge atteint, et aucune
     sous cadenas : une case d'âge fermé serait un manque qu'aucun booster ne
     comble, précisément ce que la planche ne montre plus. Le personnage de
     la suite a des âges qu'il n'a pas atteints (le premier sur trois) :
     sans eux, l'ancienne planche et la nouvelle auraient le même compte. */
  const stadeMien = atteintDe(MIEN.id);
  check(`et la sienne est garnie, des âges atteints seulement (${cases.length} pour ${stadeMien} × ${tenuesGagnables.length})`,
    stadeMien > 0 && stadeMien < agesDe(MIEN.id)
    && cases.length === stadeMien * tenuesGagnables.length
    && cases.every((c) => !c.hasAttribute('data-verrou')));
  clic(cases[1]);
  await jusqua(vitrineOuverte);
  check('une tenue s’ouvre en carte', Boolean(D.querySelector('#vitr .fz')));
  const galons = D.querySelector('#vitr .tbf-vitrine-galons')?.textContent.replace(/\s+/g, ' ') ?? '';
  check('elle nomme le personnage et l’âge concernés',
    galons.includes(MIEN.nom.toUpperCase()) && /ÂGE \d/.test(galons)
    || (console.log('        galons :', galons), false));
  await fermerVitrine();
}

/* ============================================ 9. l'équipement et les actions */

console.log('\n  l’équipement et les cartes d’action');
await revenirAccueil();
await ouvrirRayon('equipement');
{
  const pieces = [...D.querySelectorAll('#vue [data-liste="equipement"][data-i]')];
  check(`chaque pièce a sa case (${pieces.length})`, pieces.length === STUFF.length);
  /* Ce qui manque est la carte elle-même, sous son pochoir, son scotch en
     croix et son cadenas : c'est précisément ce qu'on cherche. */
  const possedees = new Set(biblio.types.stuff.items.filter((s) => s.possede).map((s) => s.id));
  check('ce qui manque est la carte sous son pochoir et son cadenas',
    pieces.filter((p) => !possedees.has(p.dataset.open))
      .every((p) => p.querySelector('.fz.fz-verrou .cadenas')));
  clic(pieces.find((p) => possedees.has(p.dataset.open)));
  await jusqua(vitrineOuverte);
  check('une pièce s’ouvre en carte', Boolean(D.querySelector('#vitr .fz')));
  check('elle liste son bonus et son revers',
    D.querySelectorAll('#vitr .tbf-detail .tbf-detail-l').length >= 2);
  await fermerVitrine();
  clic(pieces.find((p) => !possedees.has(p.dataset.open)));
  await jusqua(vitrineOuverte);
  check('une pièce qui manque mène au kiosque, et à la boutique',
    Boolean(D.querySelector('#vitr a[href="/boosters"]')) && Boolean(D.querySelector('#vitr a[href="/boutique"]')));
  await fermerVitrine();
}

await revenirAccueil();
await ouvrirRayon('actions');
{
  /* « Commune : à tout le monde depuis le premier jour » : la page le dit en
     tête de sa sous-vue, et la vitrine d'une commune la montre à soi — le
     serveur la compte comme gagnée. */
  check('une commune est dite à tout le monde', /communes sont à tout le monde/.test(texte()));
  const commune = [...D.querySelectorAll('#vue [data-liste="actions"][data-i]')]
    .find((c) => ACTIONS.find((a) => a.id === c.dataset.open)?.rar === 'commune');
  clic(commune);
  await jusqua(vitrineOuverte);
  check('une carte d’action s’ouvre', Boolean(D.querySelector('#vitr .fz')));
  check('avec son coût en souffle', /DE SOUFFLE/.test(vitrine()));
  check('et une commune est à soi, sans chemin à suivre',
    /DANS TA COLLECTION/.test(vitrine()) && !D.querySelector('#vitr a[href="/boosters"]'));
  touche('Escape');
  await attendre(40);
  check('Échap ferme', !vitrineOuverte());
}

/* ==================================================== 10. tout est atteignable */

console.log('\n  rien ne lève, sur aucune sorte');
/* La faute que `dessinDeCarte` raconte cinq fois : une sorte sans branche
   tombait sur le bonhomme gris, ou levait. On ouvre donc **tout** — chaque
   âge de chaque page de l'album, chaque pièce, chaque carte d'action —
   et on compte les cadres obtenus. Un seul manquant est une sorte oubliée.
   L'album ne monte que trois pages : on les tourne une à une, par le rail. */
let dessinees = 0;
let ouvertes = 0;
/* **Le retour en vol, un seul à la fois.** Chaque croix recule dans
   l'historique, et ce retour est asynchrone : jsdom le livre deux tours de
   minuterie plus tard. L'ancienne boucle n'attendait qu'un tour entre deux
   cartes ; deux retours finissaient en vol, et le second, sans vitrine à
   refermer, reculait d'une entrée de trop — sur l'ancienne page, jusqu'à son
   entrée de départ, sans effet ; sur l'album, il quitte la sous-vue, ce qui
   est exactement ce qu'un vrai retour doit faire. Ce rythme-là n'existe sur
   aucun téléphone : un navigateur livre son retour avant le toucher suivant.

   On garde donc l'épreuve qui compte — ouvrir la carte suivante **pendant**
   que le retour de la précédente est en vol, celui qui la refermait — et on
   laisse ce retour arriver, carte ouverte, avant de la mesurer : elle doit
   avoir survécu. On compte les retours demandés (une croix sur une vitrine
   qui a posé son marqueur d'historique) et ceux arrivés (`popstate`). */
let arrives = 0;
w.addEventListener('popstate', () => { arrives += 1; });
const vol = { depart: 0, demandes: 0 };
const armer = () => { vol.depart = arrives; vol.demandes = 0; };
const atterrir = () => jusqua(() => arrives - vol.depart >= vol.demandes, 1500);
async function toutOuvrir(sorte, cases) {
  for (const v of cases) {
    clic(v);
    await atterrir();
    ouvertes++;
    if (vitrineOuverte() && D.querySelector('#vitr .fz')) dessinees++;
    else console.log(`        ${sorte} : ${v.dataset.open} sans carte`);
    /* Enchaîné sans un souffle : c'est ce rythme-là qui a fait apparaître le
       `history.back()` en vol, celui qui refermait la carte suivante. */
    const x = D.querySelector('#vitr .tbf-vitrine-x');
    const marque = Boolean(w.history.state?.vitrine);
    if (x) { clic(x); if (marque) vol.demandes += 1; }
    else console.log(`        ${sorte} : ${v.dataset.open} sans croix`);
  }
  await atterrir();
}
await revenirAccueil();
await ouvrirRayon('fanzzy');
armer();
let fanzzyOuverts = 0;
for (const o of [...D.querySelectorAll('#vue .tbf-album-onglet:not([data-verrou])')]) {
  clic(o);
  await attendre(0);
  const cases = [...(pageAlbum(o.dataset.serie)?.querySelectorAll('[data-liste][data-i]') ?? [])];
  fanzzyOuverts += cases.length;
  await toutOuvrir('fanzzy', cases);
}
/* Une case par âge : la traversée ouvre donc chaque âge du catalogue servi
   (765 cartes pour 323 personnages), toutes les séries de la suite étant
   ouvertes (`ouverte: true`) et chacune ayant ses personnages à gagner. */
check(`l’album, page après page, ouvre chaque âge de chaque Fanzzy (${fanzzyOuverts} sur ${dexServi.length})`,
  fanzzyOuverts === dexServi.length);
check('et l’on y est toujours : aucun retour n’a quitté l’album', !$('vue').hidden
  && Boolean(D.querySelector('#vue .tbf-album')));
await revenirAccueil();
await ouvrirRayon('equipement');
armer();
await toutOuvrir('stuff', [...D.querySelectorAll('#vue [data-liste="equipement"][data-i]')]);
await revenirAccueil();
await ouvrirRayon('actions');
armer();
await toutOuvrir('actions', [...D.querySelectorAll('#vue [data-liste="actions"][data-i]')]);
check(`les ${ouvertes} cartes des trois sous-vues se dessinent toutes (${dessinees})`,
  dessinees === ouvertes && ouvertes === dexServi.length + STUFF.length + ACTIONS.length);

console.log(fautes ? `\n${fautes} faute(s) — ne pas livrer en l’état.`
  : '\nLa collection s’ouvre, se feuillette et dit où trouver ce qui manque.');
process.exitCode = fautes ? 1 : 0;
