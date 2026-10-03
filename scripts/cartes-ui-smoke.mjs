#!/usr/bin/env node
/**
 * La carte, à toutes les tailles et dans tous ses états — le banc du lot 4.
 *
 * ## Pourquoi cette suite existe
 *
 * `cardHTML` (cartes.js, cartes.css) dessine **la** carte du jeu pour sept
 * écrans : le classeur, la collection, l'ouverture d'un booster, la
 * bienvenue, le profil, l'aide, et ce que le deck reprend de son dessin. Ses
 * pannes passées ne se voyaient sur aucun d'eux en particulier : une
 * étiquette d'état qui passait sous un nom de trois lignes, à 86 pixels
 * seulement ; un nom à six pixels sur une vignette, juste au-dessus de 183 ;
 * une forme de rareté qui couvrait l'âge, sur la commune seule ; un holo qui
 * brillait sans fin dans une grille de trente cartes. Chaque écran ne montre
 * qu'une ou deux tailles et qu'un ou deux états, et aucune suite d'écran ne
 * pouvait les attraper toutes.
 *
 * La suite monte donc **une planche** : cinq largeurs (86, 110, 150, 200 et
 * 300 pixels) × quatre raretés × les états de la carte — possédée, manquante
 * avec son numéro, âge secret avec son prix, doublon, AVATAR, TITULAIRE,
 * retournée, nom d'une, deux et trois lignes —, plus les autres sortes de
 * carte (un état, une tenue, une pièce, une action, des écharpes) et deux
 * cartes de vitrine. Puis elle mesure **ce qui doit être vrai partout** :
 *
 *   — aucun texte sous onze pixels, aucun texte coupé ni recouvert ;
 *   — l'étiquette d'un état jamais sous le nom, quel que soit son nombre de
 *     lignes ;
 *   — la forme et le mot de rareté sur chaque carte ;
 *   — aucune animation infinie sur une carte de grille, et aucune du tout
 *     sans mouvement ;
 *   — le nom tient 4,5:1 sur sa bande, au soleil compris ;
 *   — aucun petit texte en or, et plus aucun losange ni ★/♛ ;
 *   — et chacun des 765 noms du catalogue tient dans la bande d'une carte de
 *     86 pixels sans en sortir.
 *
 * ## Aucune base
 *
 * Ni pool, ni schéma, ni verrou : c'est du dessin. Le catalogue est celui des
 * modules partagés (`src/shared/fanzzy`), servi sous l'adresse que la page
 * demande (`/api/fanzzy/dex`). La suite se lance donc pendant qu'une autre
 * tient la base.
 *
 * **Oswald vient de Google Fonts**, comme pour le joueur : une mesure prise
 * dans une police de secours ne dit rien des retours à la ligne. Sans
 * réseau, la suite le dit et échoue plutôt que de mesurer autre chose.
 *
 * ## Usage
 *
 *   node scripts/cartes-ui-smoke.mjs                  la suite
 *   node scripts/cartes-ui-smoke.mjs --captures DIR   et une capture par largeur
 *   node scripts/cartes-ui-smoke.mjs --planche FICHIER
 *        écrit la planche en HTML, à ouvrir pendant que --servir tourne
 *   node scripts/cartes-ui-smoke.mjs --servir [PORT]  sert la planche (4317)
 *        sur http://127.0.0.1:PORT/banc, sans rien mesurer
 *
 * (npm install --no-save puppeteer)
 */
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { DEX, TYPES, SETS, RAR, SCARVES, EVO_COST, RATES } from '../src/shared/fanzzy/dex.js';
import { STUFF, SKINS } from '../src/shared/fanzzy/inventaire.js';
import { ACTIONS } from '../src/shared/duel/actions.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i < 0 ? null : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '');
};
const CAPTURES = option('--captures');
const PLANCHE = option('--planche');
const SERVIR = option('--servir');
const PORT_BANC = Number(SERVIR) || 4317;

let ko = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) ko++; };

/* ------------------------------------------------------------ le catalogue

   La forme de `/api/fanzzy/dex` (CONTRATS.md), tirée des modules partagés :
   `racine` et `stade` sont calculés comme le serveur les calcule, par la
   chaîne des `evo`. Tout le catalogue, séries fermées comprises : la planche
   doit pouvoir montrer n'importe quelle carte. */
const parent = new Map();
for (const f of DEX) if (f.evo) parent.set(f.evo, f.id);
const racineDe = (id) => { let r = id; while (parent.has(r)) r = parent.get(r); return r; };
const stadeDe = (id) => { let n = 1, r = id; while (parent.has(r)) { r = parent.get(r); n++; } return n; };
const CATALOGUE = {
  dex: DEX.map((f) => ({ ...f, racine: racineDe(f.id), stade: stadeDe(f.id) })),
  types: TYPES, sets: SETS.map((s) => ({ ...s, ouverte: s.id === 'RP' })),
  saison: null, aCollectionner: DEX.length, seriesOuvertes: ['RP'],
  rar: RAR, scarves: SCARVES, evoCost: EVO_COST, rates: RATES,
  stuff: STUFF, actions: ACTIONS, tenues: SKINS,
};

/* ------------------------------------------------------------- la planche

   Construite **dans le navigateur**, par les vraies fonctions de cartes.js
   (`cardHTML`, `carteDuPaquet`, `retourner`) sur le vrai catalogue : la
   planche n'a aucun dessin à elle, elle ne fait que ranger des cartes. Cette
   fonction n'est jamais appelée par Node : elle est sérialisée dans la page. */
function construirePlanche() {
  const C = window.TBF_CARTES;
  const TAILLES = [86, 110, 150, 200, 300];
  const RARETES = ['commune', 'rare', 'epique', 'legendaire'];
  /* Une lignée de LA REPRISE pour les trois premières raretés (ses trois
     âges), et sa première légendaire. Ce sont les cartes du jeu en
     production : la planche montre ce que voit le joueur. */
  const CARTE = { commune: 'RP1', rare: 'RP1B', epique: 'RP1C', legendaire: 'RP13' };
  /* Trois noms réels du catalogue, choisis pour leur longueur : une ligne à
     toutes les tailles, deux à 86 pixels, trois ou quatre à 86. */
  const NOMS = [['nom court', 'Choriste'], ['nom moyen', 'Colleur d’affiches'],
    ['nom long', 'L’Épouvantail du Terrain d’Entraînement']];
  const get = (id) => C.BY_ID.get(id);
  const echap = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

  /* Les états, ligne par ligne. `mini` partout : ce sont les cartes de
     grille, celles qui ne doivent pas bouger ; la vitrine a sa ligne à part. */
  const ETATS = [
    ['possédée', (f) => C.cardHTML(f, { mini: true })],
    ['manquante', (f, r) => C.cardHTML(f, { mini: true, verrou: true, numero: 11 + r })],
    ['manquante, raison', (f) => C.cardHTML(f, { mini: true, verrou: true, raison: 'NIV. 10' })],
    ['âge secret', (f) => C.cardHTML(f, { mini: true, secret: true, prix: 90 })],
    ['doublons', (f) => C.cardHTML(f, { mini: true, doublons: 3 })],
    ['avatar', (f) => C.cardHTML(f, { mini: true, avatar: true })],
    ['titulaire', (f) => C.cardHTML(f, { mini: true, titulaire: true, avatar: true, doublons: 12 })],
    ['retournée', (f) => C.cardHTML(f, { mini: true, flip: true })],
    ...NOMS.map(([mot, nom]) => [mot, (f) => C.cardHTML({ ...f, nom }, { mini: true })]),
  ];
  /* Les autres sortes, et l'étiquette d'un état sous les trois longueurs de
     nom : c'est elle que le correctif du lot 1 laissait passer sous un nom
     de trois lignes. */
  const etat = (nom) => ({ ...C.carteDuPaquet({ type: 'etat', id: 'joie', pour: 'RP1', stade: 1 }), ...(nom ? { nom } : {}) });
  /* **Le pin d'une page sans catalogue** : la fiche, à l'adresse
     /fanzzy/<id>, amorce `TYPES[type]` avec son nom et sa couleur, sans le
     tracé du pictogramme. On fait pareil le temps d'un rendu. */
  const sansTrace = (f) => {
    const t = C.TYPES[f.type];
    C.TYPES[f.type] = { nom: t.nom, c: t.c, ico: '' };
    try { return C.cardHTML(f, { mini: true }); } finally { C.TYPES[f.type] = t; }
  };
  const AUTRES = [
    ['état', () => C.cardHTML(etat(), { mini: true })],
    ...NOMS.map(([mot, nom]) => [`état, ${mot}`, () => C.cardHTML(etat(nom), { mini: true })]),
    ['tenue', () => C.cardHTML(C.carteDuPaquet({ type: 'skin', id: 'halloween', pour: 'RP1', stade: 2 }), { mini: true })],
    ['pièce', () => C.cardHTML(C.carteDuPaquet({ type: 'stuff', id: 'tambour' }), { mini: true })],
    ['action', () => C.cardHTML(C.carteDuPaquet({ type: 'action', id: 'a-craquage' }), { mini: true })],
    ['écharpes', () => C.cardHTML(C.carteDuPaquet({ type: 'echarpes', montant: 35 }), { mini: true })],
    ['manquante, secret', () => C.cardHTML(get('RP2C'), { mini: true, verrou: true, secret: true })],
    ['pin sans tracé', () => sansTrace(get('RP1'))],
  ];

  const caseHTML = (taille, etiquette, html, attrs) => `<figure class="case" style="--l:${taille}px"
      data-taille="${taille}" ${attrs}><div class="pose">${html}</div>
      <figcaption>${echap(etiquette)}</figcaption></figure>`;

  let h = '<h1>Le banc des cartes — lot 4</h1>';
  for (const taille of TAILLES) {
    h += `<section class="taille" data-taille="${taille}"><h2>${taille} px</h2>`;
    for (const [mot, rendu] of ETATS) {
      h += `<div class="rang"><h3>${echap(mot)}</h3>`;
      RARETES.forEach((rar, r) => {
        h += caseHTML(taille, `${mot} · ${rar}`, rendu(get(CARTE[rar]), r),
          `data-etat="${echap(mot)}" data-rar="${rar}" data-grille="1"`);
      });
      h += '</div>';
    }
    h += '<div class="rang"><h3>les autres sortes</h3>';
    for (const [mot, rendu] of AUTRES) {
      h += caseHTML(taille, mot, rendu(), `data-etat="${echap(mot)}" data-grille="1"`);
    }
    h += '</div>';
    /* La vitrine : une carte sans `mini`, animée. Seulement en grand, là où
       la vitrine, la fiche et la révélation la posent. Puis la même dans une
       pile figée (`.fz-fige`), comme les cartes encore face cachée d'une
       ouverture : elle ne bouge plus, quoi que dise sa matière. */
    if (taille >= 200) {
      h += '<div class="rang"><h3>vitrine (animée)</h3>';
      for (const rar of RARETES) {
        h += caseHTML(taille, `vitrine · ${rar}`, C.cardHTML(get(CARTE[rar]), { titulaire: rar === 'rare' }),
          `data-etat="vitrine" data-rar="${rar}"`);
      }
      h += '</div><div class="rang fz-fige"><h3>vitrine dans une pile figée</h3>';
      for (const rar of RARETES) {
        h += caseHTML(taille, `figée · ${rar}`, C.cardHTML(get(CARTE[rar])),
          `data-etat="figée" data-rar="${rar}" data-grille="1"`);
      }
      h += '</div>';
    }
    h += '</section>';
  }
  /* Les 765 noms à 86 pixels : la bande seule compte ici, l'image ne
     se charge pas (les cartes sont hors de l'écran, `loading="lazy"`). */
  h += '<section class="noms" data-taille="86"><h2>tous les noms, à 86 px</h2><div class="rang">';
  for (const f of C.DEX) h += `<div class="nomcase">${C.cardHTML(f, { mini: true })}</div>`;
  h += '</div></section>';
  document.getElementById('planche').innerHTML = h;
  for (const c of document.querySelectorAll('.case[data-etat="retournée"] .fz')) C.retourner(c, true);
  document.documentElement.dataset.planche = 'prete';
}

/* La page de la planche. **Servie par une route**, jamais posée par
   `setContent` : celui-ci laisse la page sur `about:blank`, où `/ui.css` et
   les images ne résolvent nulle part. `base` sert à la copie écrite hors du
   dépôt (`--planche`), qui va chercher ses fichiers sur le banc. */
const planche = (base = '') => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${base ? `<base href="${base}">` : ''}
<title>Banc des cartes</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/ui.css"><link rel="stylesheet" href="/cartes.css">
<style>
  body{margin:0;padding:20px 28px 60px;background:var(--parpaing);color:var(--craie);font-family:var(--ui)}
  h1{font:700 22px/1.2 var(--banner);letter-spacing:.08em;text-transform:uppercase}
  h2{margin:34px 0 4px;font:700 18px/1 var(--banner);letter-spacing:.1em}
  h3{flex:0 0 100%;margin:14px 0 0;font:600 12px/1 var(--banner);letter-spacing:.12em;text-transform:uppercase;opacity:.9}
  .rang{display:flex;flex-wrap:wrap;align-items:flex-start;gap:22px 26px}
  .case{margin:0;width:var(--l);display:flex;flex-direction:column;gap:12px;padding:10px 8px 0}
  .case .pose{width:var(--l)}
  .case figcaption{font:500 11px/1.2 var(--banner);letter-spacing:.06em;color:var(--gris);text-transform:uppercase}
  .noms .rang{gap:14px 12px}
  .nomcase{width:86px}
</style></head><body>
<main id="planche"></main>
<script src="/mods.js"></script>
<script src="/fanzzy-art.js"></script>
<script src="/fanzzy-fond.js"></script>
<script src="/cartes.js"></script>
<script src="/logo-art.js"></script>
<script src="/stuff-art.js"></script>
<script src="/action-art.js"></script>
<script src="/fanzzy-etats.js"></script>
<script src="/fx.js"></script>
<script>
(async () => {
  await window.TBF_ETATS?.charger?.();
  await window.TBF_CARTES.chargerCatalogue();
  (${construirePlanche.toString()})();
})().catch((e) => { document.body.dataset.erreur = String(e?.code ?? e?.message ?? e); });
</script></body></html>`;

/* ----------------------------------------------------------------- le banc */

const app = express();
/* La copie écrite hors du dépôt (`--planche`) est ouverte depuis le disque :
   ses requêtes au catalogue partent d'une autre origine, et `api()` pose un
   `content-type`, ce qui fait précéder chacune d'une demande de permission. */
app.use((q, s, n) => {
  s.set('access-control-allow-origin', '*');
  s.set('access-control-allow-headers', 'content-type');
  if (q.method === 'OPTIONS') { s.sendStatus(204); return; }
  n();
});
app.get('/banc', (_q, s) => s.type('html').send(planche()));
app.get('/api/fanzzy/dex', (_q, s) => s.json(CATALOGUE));
/* L'état d'un joueur, pour éprouver ce que `load()` en garde (les
   nouveautés) : la suite change `etatServi` entre deux lectures. Le moins
   qu'il faut pour que `load()` aille au bout, rien qui se dessine. */
const ETAT_JOUEUR = { collection: {}, stades: {}, etats: {}, packPrice: 45,
  wallet: { scarves: 0, packs: 3, active: null, nextPackInMs: null } };
let etatServi = ETAT_JOUEUR;
app.get('/api/fanzzy/state', (_q, s) => s.json(etatServi));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(SERVIR !== null ? PORT_BANC : 0, '127.0.0.1', r));
const base = `http://127.0.0.1:${http.address().port}`;

/* La copie hors du dépôt va chercher ses fichiers sur le port fixe du banc
   (`--servir`), et non sur celui, éphémère, de cette exécution. */
if (PLANCHE) {
  writeFileSync(PLANCHE, planche(`http://127.0.0.1:${PORT_BANC}/`));
  console.log(`planche écrite : ${PLANCHE} — à ouvrir pendant que « --servir ${PORT_BANC} » tourne`);
}
if (SERVIR !== null) {
  console.log(`banc servi sur ${base}/banc — Ctrl+C pour l'arrêter`);
} else {
  const { default: puppeteer } = await import('puppeteer');
  try { await mesurer(puppeteer); } finally { http.close(); }
  console.log(ko ? `\n${ko} contrôle(s) en échec` : '\nTout est vert.');
  process.exit(ko ? 1 : 0);
}

/* ------------------------------------------------------------- la mesure */

async function mesurer(puppeteer) {
  const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
  const erreurs = [];
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto(`${base}/banc`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.waitForFunction(() => document.documentElement.dataset.planche === 'prete'
    || document.body.dataset.erreur, { timeout: 60000 });
  const erreur = await page.evaluate(() => document.body.dataset.erreur ?? null);
  check('la planche se monte sur le vrai catalogue', !erreur
    || (console.log('        ', erreur), false));
  if (erreur) { await nav.close(); return; }

  /* Les polices d'abord : une mesure prise dans une police de secours ne dit
     rien des retours à la ligne. */
  const oswald = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('700 12px Oswald') && [...document.fonts]
      .some((f) => /Oswald/.test(f.family) && f.status === 'loaded');
  });
  check('Oswald est chargée (sinon tout se mesure dans une autre police)', oswald);
  /* Que fx.js ait eu le temps de poser la respiration sur chaque personnage :
     c'est elle que la grille doit arrêter. */
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
  /* Les objets se mesurent à leur dessin (voir `analyser`) : on les charge,
     où qu'ils soient dans la planche — les images sont paresseuses. */
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.case .illu.objet')].map((i) => {
    i.loading = 'eager';
    return i.decode().catch(() => null);
  })));

  const r = await page.evaluate(analyser);

  check(`la planche porte ${r.cartes} cartes, de 86 à 300 pixels`, r.cartes > 200);
  check('chaque carte a la largeur qu’on lui donne',
    r.largeurs.length === 0 || (console.log('        ', r.largeurs.slice(0, 4).join(' · ')), false));

  /* ---- le plancher et les coupes */
  check('aucun texte sous onze pixels', r.petits.length === 0
    || (console.log('        ', r.petits.slice(0, 6).join(' · ')), false));
  check('aucun texte coupé (ellipse, débord de sa boîte)', r.coupes.length === 0
    || (console.log('        ', r.coupes.slice(0, 6).join(' · ')), false));
  check('aucun texte recouvert par un autre objet de la carte', r.recouverts.length === 0
    || (console.log('        ', r.recouverts.slice(0, 6).join(' · ')), false));
  check('rien ne déborde de la carte de plus de huit pixels', r.debords.length === 0
    || (console.log('        ', r.debords.slice(0, 6).join(' · ')), false));

  /* ---- l'étiquette */
  check(`l’étiquette d’un état est sur la bande, jamais sous le nom (${r.etiquettes} vues)`,
    r.etiquettes >= 20 && r.etiquettesSous.length === 0
    || (console.log('        ', r.etiquettesSous.slice(0, 6).join(' · ')), false));
  check(`la planche éprouve des noms d’une, deux et trois lignes et plus (${
    Object.entries(r.lignes).map(([k, v]) => `${k} : ${v}`).join(', ')})`,
    r.lignes[1] > 0 && r.lignes[2] > 0 && (r.lignes[3] ?? 0) + (r.lignes[4] ?? 0) > 0);

  /* ---- la rareté */
  check('chaque carte porte sa forme de rareté, avec son mot', r.sansForme.length === 0
    || (console.log('        ', r.sansForme.slice(0, 6).join(' · ')), false));
  check('plus aucun losange ni ★/♛', r.vieuxSignes === 0);
  check('aucun petit texte en or sur une carte', r.or.length === 0
    || (console.log('        ', r.or.slice(0, 6).join(' · ')), false));
  check('la légendaire porte son liseré d’or', r.liseres > 0 && r.legendairesSansLisere.length === 0);

  /* ---- les états */
  check('une carte manquante porte la croix, le cadenas, son numéro, et pas d’âge',
    r.verrous > 0 && r.verrousFaux.length === 0
    || (console.log('        ', r.verrousFaux.slice(0, 4).join(' · ')), false));
  check('un âge secret dit « ÂGE À VENIR », floute le dessin et montre son prix',
    r.secrets > 0 && r.secretsFaux.length === 0
    || (console.log('        ', r.secretsFaux.slice(0, 4).join(' · ')), false));
  check('doublons, AVATAR et TITULAIRE se posent', r.stickersFaux.length === 0
    || (console.log('        ', r.stickersFaux.slice(0, 4).join(' · ')), false));
  check('une carte retournée montre son dos, construit au retournement',
    r.retournees > 0 && r.retourneesFaux.length === 0
    || (console.log('        ', r.retourneesFaux.slice(0, 4).join(' · ')), false));
  check('sous 150 px l’âge est un badge, au-dessus un tampon, et le pied n’y paraît qu’au-dessus',
    r.seuilFaux.length === 0 || (console.log('        ', r.seuilFaux.slice(0, 4).join(' · ')), false));

  /* ---- le pin et l'objet */
  check('avec le catalogue, chaque pin porte le tracé de sa famille', r.pinsVides.length === 0
    || (console.log('        ', r.pinsVides.slice(0, 4).join(' · ')), false));
  check(`sans le tracé (la fiche), le pin porte l’emblème de la famille, à l’encre (${r.pins} vus)`,
    r.pins >= 5 && r.pinsFaux.length === 0
    || (console.log('        ', r.pinsFaux.slice(0, 4).join(' · ')), false));
  const emblemes = await page.evaluate(() => Promise.all([...document.querySelectorAll('.pip img.fz-picto')]
    .map((i) => { i.loading = 'eager'; return i.decode().then(() => i.naturalWidth > 0, () => false); })));
  check('et cet emblème existe bien', emblemes.length > 0 && emblemes.every(Boolean));
  check(`l’objet tient 60 % de son cadre au moins, au-dessus de la bande (${r.objets} vus)`,
    r.objets >= 10 && r.objetsFaux.length === 0
    || (console.log('        ', r.objetsFaux.slice(0, 6).join(' · ')), false));

  /* ---- le contraste */
  check('le nom tient 4,5:1 sur sa bande, à l’ombre et au soleil', r.contrastes.length === 0
    || (console.log('        ', r.contrastes.slice(0, 6).join(' · ')), false));

  /* ---- le mouvement */
  check(`aucune animation infinie sur une carte de grille ou figée (${r.grille} vues)`,
    r.grille > 100 && r.infiniesGrille.length === 0
    || (console.log('        ', r.infiniesGrille.slice(0, 6).join(' · ')), false));
  check(`la vitrine, elle, anime l’épique et la légendaire, d’un seul mouvement de matière (${r.vitrinesAnimees} sur ${r.vitrinesRiches})`,
    r.vitrinesRiches > 0 && r.vitrinesAnimees === r.vitrinesRiches);

  /* ---- les 765 noms */
  check(`les ${r.noms} noms du catalogue tiennent dans la bande d’une carte de 86 px`,
    r.noms > 700 && r.nomsSortis.length === 0
    || (console.log('        ', r.nomsSortis.slice(0, 6).join(' · ')), false));
  check('et aucun n’y casse un mot en deux', r.motsCasses.length === 0
    || (console.log('        ', r.motsCasses.length, ':', r.motsCasses.slice(0, 8).join(' · ')), false));

  /* ---- sans mouvement : plus rien d'infini, nulle part */
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const sansMouvement = await page.evaluate(() => [...document.querySelectorAll('.case .fz')]
    .flatMap((c) => c.getAnimations({ subtree: true })
      .filter((a) => a.effect?.getComputedTiming?.().iterations === Infinity && a.playState === 'running')
      .map(() => c.closest('.case')?.querySelector('figcaption')?.textContent ?? '?')));
  check('sans mouvement, aucune carte n’anime plus rien sans fin', sansMouvement.length === 0
    || (console.log('        ', [...new Set(sansMouvement)].slice(0, 6).join(' · ')), false));
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]);

  /* ---- le mode calme du tiroir, son double */
  const calme = await page.evaluate(() => {
    document.documentElement.dataset.calme = 'animations';
    const n = [...document.querySelectorAll('.case .fz')].flatMap((c) => c.getAnimations({ subtree: true })
      .filter((a) => a.effect?.getComputedTiming?.().iterations === Infinity && a.playState === 'running')).length;
    delete document.documentElement.dataset.calme;
    return n;
  });
  check('et le mode calme du tiroir fait de même', calme === 0
    || (console.log('        ', calme, 'animation(s) encore en route'), false));

  /* ---- la réserve de boosters, la brique (BRIQUES § 1) */
  const res = await page.evaluate(verifierReserve);
  check(`reserveHTML garde sa forme d’avant, { enFentes, html }, au caractère près (${res.anciens} cas)`,
    res.anciens > 100 && res.anciennesFautes.length === 0
    || (console.log('        ', res.anciennesFautes.slice(0, 4).join(' · ')), false));
  check(`et rend la brique : le compte en premier <b>, places ou sachet seul, anneau, PROCHAIN, « + » (${res.cas} cas)`,
    res.cas > 1000 && res.fautes.length === 0
    || (console.log('        ', res.fautes.slice(0, 6).join(' · ')), false));
  console.log(`        largeurs : ${res.largeurs.join(' · ')}`);
  check('posée dans la planche, la brique n’écrit rien sous onze pixels', res.petits.length === 0
    || (console.log('        ', res.petits.slice(0, 4).join(' · ')), false));

  /* ---- les nouveautés de l'état (contrat § 2.1) */
  const nouv = [];
  for (const [mot, champ, attendu] of [['servies', [{ cle: 'fanzzy:RP4', sorte: 'fanzzy', id: 'RP4' }], 1],
    ['vides', [], 0], ['absentes', undefined, null], ['illisibles', { cle: 'x' }, null]]) {
    etatServi = { ...ETAT_JOUEUR, ...(champ === undefined ? {} : { nouveautes: champ }) };
    const lu = await page.evaluate(async () => {
      await window.TBF_CARTES.load();
      const n = window.TBF_CARTES.S.nouveautes;
      return n === null ? null : Array.isArray(n) ? n.length : 'autre chose';
    }).catch((e) => `erreur : ${e.message}`);
    if (lu !== attendu) nouv.push(`${mot} : ${JSON.stringify(lu)} au lieu de ${JSON.stringify(attendu)}`);
  }
  check('load() garde les nouveautés servies, et null quand le serveur ne sait pas', nouv.length === 0
    || (console.log('        ', nouv.join(' · ')), false));

  check('la page ne lève aucune erreur', erreurs.length === 0
    || (console.log('        ', erreurs.slice(0, 3).join(' · ')), false));

  if (CAPTURES !== null) await photographier(page, CAPTURES || path.join(RACINE, 'captures-cartes'));
  await nav.close();
}

/**
 * Ce qui se mesure sur la planche, dans le navigateur. Sérialisée par
 * puppeteer : elle ne voit rien de ce module.
 */
function analyser() {
  const nomDe = (el) => el.closest('.case')?.querySelector('figcaption')?.textContent?.trim()
    ?? `${el.closest('.fz')?.dataset.id ?? '?'}`;
  const taille = (el) => el.closest('[data-taille]')?.dataset.taille ?? '?';
  const qui = (el) => `${taille(el)}px ${nomDe(el)}`;

  /* Les textes d'une carte : les éléments qui portent un texte à eux, hors du
     mot réservé au lecteur d'écran. */
  const textes = (carte) => [...carte.querySelectorAll('*')].filter((el) =>
    !el.closest('.tbf-vh') && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const rectsTexte = (el) => {
    const rects = [];
    for (const n of el.childNodes) {
      if (n.nodeType !== 3 || !n.textContent.trim()) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      rects.push(...[...rg.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5));
    }
    return rects;
  };
  const croise = (a, b, marge = 1) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > marge && h > marge ? w * h : 0;
  };
  /* **Ce qu'un objet couvre à l'œil** : sa boîte, plus ses ombres extérieures.
     Le bord de craie, le cerne et l'ombre dure d'un sticker sont des
     `box-shadow` : hors de la boîte, ils couvrent pourtant ce qui est dessous.
     Le premier jet de cette suite ne voyait que la boîte, et laissait passer
     un AVATAR dont le cerne mangeait le haut du nom. */
  const etendue = (el) => {
    const q = el.getBoundingClientRect();
    let [g, d, h, b] = [0, 0, 0, 0];
    const ombres = getComputedStyle(el).boxShadow;
    if (ombres && ombres !== 'none') {
      for (const o of ombres.split(/,(?![^(]*\))/)) {
        if (/inset/.test(o)) continue;
        const n = (o.replace(/rgba?\([^)]*\)/g, '').match(/-?[\d.]+px/g) ?? []).map(parseFloat);
        const [x = 0, y = 0, flou = 0, ecart = 0] = n;
        const e = ecart + flou / 2;
        g = Math.max(g, e - x); d = Math.max(d, e + x); h = Math.max(h, e - y); b = Math.max(b, e + y);
      }
    }
    return { left: q.left - g, right: q.right + d, top: q.top - h, bottom: q.bottom + b };
  };
  /* **Qui est peint au-dessus de qui.** Les objets de la carte sont tous dans
     le même contexte d'empilement (la carte) : on compare le `z-index` de
     leur ancêtre posé directement dans le recto, puis l'ordre du document.
     La croix de scotch passe sous la forme de rareté ; elle ne la recouvre
     pas, même si leurs boîtes se croisent. */
  const plan = (el) => {
    const body = el.closest('.body');
    let e = el;
    while (e.parentElement && e.parentElement !== body) e = e.parentElement;
    const z = parseInt(getComputedStyle(e).zIndex, 10);
    return [Number.isFinite(z) ? z : 0, [...(body?.children ?? [])].indexOf(e)];
  };
  const dessus = (a, b) => {
    const [za, oa] = plan(a), [zb, ob] = plan(b);
    if (za !== zb) return za > zb;
    if (oa !== ob) return oa > ob;
    /* Le même ancêtre : le dernier venu dans le document est dessus. */
    return Boolean(b.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
  };
  /* La surface sur laquelle un texte est écrit : le premier ancêtre qui a un
     fond (la bande, un sticker, l'étiquette, le rectangle de la commune). */
  const surface = (el) => {
    for (let e = el; e && !e.classList?.contains('fz'); e = e.parentElement) {
      const c = getComputedStyle(e).backgroundColor;
      if (c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c)) return e;
    }
    return el;
  };
  const lire = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const poser = (dessus, dessous) => {
    const a = dessus[3] ?? 1;
    return [0, 1, 2].map((i) => dessus[i] * a + dessous[i] * (1 - a));
  };
  const ratio = (x, y) => { const a = lum(x), b = lum(y); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const soleil = (c) => c.map((v) => v * 0.6 + 255 * 0.4);

  const r = { cartes: 0, largeurs: [], petits: [], coupes: [], recouverts: [], debords: [],
    etiquettes: 0, etiquettesSous: [], lignes: {}, sansForme: [], vieuxSignes: 0, or: [],
    liseres: 0, legendairesSansLisere: [], verrous: 0, verrousFaux: [], secrets: 0, secretsFaux: [],
    stickersFaux: [], retournees: 0, retourneesFaux: [], seuilFaux: [], contrastes: [],
    grille: 0, infiniesGrille: [], vitrinesRiches: 0, vitrinesAnimees: 0, noms: 0, nomsSortis: [],
    motsCasses: [], pins: 0, pinsFaux: [], pinsVides: [], objets: 0, objetsFaux: [] };
  const MOTS = { commune: 'COMMUNE', rare: 'RARE', epique: 'ÉPIQUE', legendaire: 'LÉGENDAIRE' };

  for (const kase of document.querySelectorAll('.case')) {
    const carte = kase.querySelector('.fz');
    if (!carte) continue;
    r.cartes++;
    const voulu = Number(kase.dataset.taille);
    const rc = carte.getBoundingClientRect();
    if (Math.abs(rc.width - voulu) > 1) r.largeurs.push(`${qui(carte)} : ${rc.width.toFixed(1)}`);
    const rar = carte.dataset.rar;
    const etat = kase.dataset.etat;
    const retournee = carte.classList.contains('fz-retournee');

    /* La forme et son mot, sur toute carte. */
    const forme = carte.querySelector(`:scope > .body > .tbf-forme[data-rar="${rar}"]`);
    const mot = forme?.querySelector('b');
    const rf = forme?.getBoundingClientRect();
    if (!forme || !mot || mot.textContent.trim() !== MOTS[rar] || !rf || rf.width < 14
      || parseFloat(getComputedStyle(mot).fontSize) < 10.95) r.sansForme.push(qui(carte));
    if (carte.querySelector('.rar .d, .rar .s') || /[★♛]/.test(carte.textContent)) r.vieuxSignes++;
    if (rar === 'legendaire') {
      if (carte.querySelector('.lisere')) r.liseres++;
      else r.legendairesSansLisere.push(qui(carte));
    }

    /* **Le pin n'est jamais un rond vide.** Avec le catalogue, le tracé de
       la famille ; sans son tracé (la fiche), l'emblème, en grisaille
       d'encre — jamais ses couleurs d'émail sur une carte. */
    const pip = carte.querySelector('.pip');
    if (etat === 'pin sans tracé') {
      r.pins++;
      const img = pip?.querySelector('img.fz-picto');
      const faute = !img ? 'pas d’emblème' : pip.querySelector('svg') ? 'un tracé vide reste'
        : !/\/img\/logo\/type-[a-z]+\.\w+$/.test(img.getAttribute('src') ?? '') ? `adresse ${img.getAttribute('src')}`
          : !/grayscale\(1\)/.test(getComputedStyle(img).filter) ? 'l’émail en couleurs'
            : !pip.getAttribute('aria-label') ? 'le pin ne dit pas sa famille' : null;
      if (faute) r.pinsFaux.push(`${qui(carte)} : ${faute}`);
    } else if (!pip?.querySelector('svg path')?.getAttribute('d')) r.pinsVides.push(qui(carte));

    /* **L'objet n'est pas un timbre** (la suite du tour mesure la même chose
       dans la coque de la bienvenue) : au moins 60 % de son cadre en largeur
       et en hauteur, et son pied au-dessus de la bande du nom — elle le
       coupait à mi-hauteur. Le pied est celui du dessin, pas de sa boîte :
       l'image est contenue (`contain`) et centrée dans une boîte un peu
       plus haute qu'elle ; la suite charge ces images avant de mesurer. */
    const objet = carte.querySelector('.illu.objet');
    if (objet) {
      r.objets++;
      const c = objet.closest('.illuwrap').getBoundingClientRect();
      const m = objet.getBoundingClientRect();
      const bande = carte.querySelector('.top')?.getBoundingClientRect();
      const large = m.width / c.width, haut = m.height / c.height;
      const echelle = objet.naturalWidth && objet.naturalHeight
        ? Math.min(m.width / objet.naturalWidth, m.height / objet.naturalHeight) : 0;
      const pied = echelle ? m.top + (m.height + objet.naturalHeight * echelle) / 2 : m.bottom;
      if (large < 0.6 || haut < 0.6) r.objetsFaux.push(`${qui(carte)} : ${large.toFixed(2)} × ${haut.toFixed(2)}`);
      else if (bande && pied > bande.top + 2) {
        r.objetsFaux.push(`${qui(carte)} : le pied ${(pied - bande.top).toFixed(1)} px sous la bande`);
      }
    }

    /* La carte retournée : son dos, et rien d'autre à lire. */
    if (etat === 'retournée') {
      r.retournees++;
      const v = carte.querySelector(':scope > .verso');
      const bg = v ? getComputedStyle(v).backgroundImage : '';
      if (!v || !retournee || !/\/img\/dos\//.test(bg)) r.retourneesFaux.push(`${qui(carte)} : ${bg || 'pas de verso'}`);
      continue;
    }
    if (carte.querySelector(':scope > .verso')) r.retourneesFaux.push(`${qui(carte)} : un verso sans retournement`);

    const ts = textes(carte);
    /* Les objets de la carte, ceux qui peuvent en recouvrir un autre. */
    const objets = [...carte.querySelectorAll('.haut > *, .tbf-forme, .tbf-forme > b, .cadenas, .fz-croix, '
      + '.fz-prix, .fz-doublons, .sur > *, .top')];
    for (const el of ts) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      const fs = parseFloat(s.fontSize);
      if (fs < 10.95) r.petits.push(`${qui(el)} « ${el.textContent.trim()} » ${fs}px`);
      /* Coupé : une ellipse, ou un texte plus large que sa boîte. */
      if ((s.textOverflow === 'ellipsis' || s.overflow !== 'visible') && el.scrollWidth > el.clientWidth + 1) {
        r.coupes.push(`${qui(el)} « ${el.textContent.trim()} »`);
      }
      const rs = rectsTexte(el);
      /* Le texte sort de la surface qui le porte (son fond) : c'est une
         coupe aussi, à l'œil — la lettre tombe sur le dessin. En hauteur,
         la boîte d'une ligne de texte est celle de la police (ses jambages
         compris), plus haute que l'interligne serré d'une étiquette : on lui
         laisse cette différence. */
      const rb = surface(el).getBoundingClientRect();
      for (const q of rs) {
        const jeu = Math.max(1, (q.height - fs) / 2 + 1);
        if (q.left < rb.left - 1 || q.right > rb.right + 1 || q.top < rb.top - jeu || q.bottom > rb.bottom + jeu) {
          r.coupes.push(`${qui(el)} « ${el.textContent.trim()} » sort de sa surface`);
          break;
        }
      }
      /* Recouvert : un objet de la carte qui n'est ni lui, ni un des siens,
         peint au-dessus de lui et posé sur une de ses lignes — ombres
         comprises. On mesure la ligne à la hauteur des lettres (la taille
         de la police, centrée), pas à celle des jambages vides. */
      for (const o of objets) {
        if (o === el || o.contains(el) || el.contains(o) || !dessus(o, el)) continue;
        const ro = etendue(o);
        const lettres = rs.map((q) => {
          const m = (q.height - fs * 0.78) / 2;
          return { left: q.left, right: q.right, top: q.top + m, bottom: q.bottom - m };
        });
        if (lettres.some((q) => croise(q, ro, 1) > 2)) {
          r.recouverts.push(`${qui(el)} « ${el.textContent.trim()} » sous ${o.className || o.tagName}`);
        }
      }
      /* Aucun petit texte en or. */
      const c = lire(s.color);
      if (c.length >= 3 && c[0] > 200 && c[1] > 150 && c[1] < 235 && c[2] < 150) {
        r.or.push(`${qui(el)} « ${el.textContent.trim()} »`);
      }
    }

    /* Rien ne déborde de la carte de plus de huit pixels (le pin, la forme
       et la bande en passent le bord de quelques-uns, c'est voulu). */
    for (const el of carte.querySelectorAll('.body *')) {
      if (el.closest('.art')) continue;
      const q = el.getBoundingClientRect();
      if (!q.width || !q.height) continue;
      const d = Math.max(rc.left - q.left, q.right - rc.right, rc.top - q.top, q.bottom - rc.bottom);
      if (d > 8) { r.debords.push(`${qui(el)} ${el.className} : ${d.toFixed(1)} px`); break; }
    }

    /* Le nom, sa bande, ses lignes, son contraste. */
    const nm = carte.querySelector('.nm');
    const top = carte.querySelector('.top');
    if (nm && top) {
      const lh = parseFloat(getComputedStyle(nm).lineHeight);
      const n = Math.max(1, Math.round(nm.getBoundingClientRect().height / lh - 0.15));
      if (/^nom|état, nom/.test(etat)) r.lignes[n] = (r.lignes[n] ?? 0) + 1;
      const fond = lire(getComputedStyle(top).backgroundColor);
      const encre = lire(getComputedStyle(nm).color);
      const vu = poser(encre, fond);
      const dedans = ratio(vu, fond);
      const dehors = ratio(soleil(vu), soleil(fond));
      if (dedans < 4.5 || dehors < 4.5) {
        r.contrastes.push(`${qui(nm)} ${dedans.toFixed(2)} / soleil ${dehors.toFixed(2)}`);
      }
      if (top.getBoundingClientRect().top < rc.top) r.coupes.push(`${qui(nm)} la bande sort par le haut`);
    }

    /* L'étiquette : au-dessus du nom, toujours — son cerne et son ombre
       compris, et jusqu'au haut des lettres de la première ligne. */
    const et = carte.querySelector('.tbf-etiq');
    if (et && nm) {
      r.etiquettes++;
      const re = etendue(et);
      const fsn = parseFloat(getComputedStyle(nm).fontSize);
      const lignes = rectsTexte(nm);
      const hautNom = Math.min(...lignes.map((q) => q.top + (q.height - fsn * 0.78) / 2));
      if (!lignes.length || re.bottom > hautNom + 0.5 || !et.closest('.sur')) {
        r.etiquettesSous.push(`${qui(et)} : bas ${re.bottom.toFixed(1)} / lettres ${hautNom.toFixed(1)}`);
      }
    }

    /* Les états. */
    if (carte.classList.contains('fz-verrou')) {
      r.verrous++;
      const num = carte.querySelector('.nm.numero');
      const faute = !carte.querySelector('.cadenas') ? 'pas de cadenas'
        : !carte.querySelector('.fz-croix') ? 'pas de croix'
          : carte.querySelector('.age') ? 'un âge'
            : etat === 'manquante' && !/^N° \d{3}$/.test(num?.lastChild?.textContent?.trim() ?? '') ? 'pas de numéro'
              : etat === 'manquante, raison' && !/NIV\. 10/.test(carte.querySelector('.cadenas')?.textContent ?? '') ? 'pas de raison'
                : null;
      if (faute) r.verrousFaux.push(`${qui(carte)} : ${faute}`);
    }
    if (carte.classList.contains('fz-secret') && !carte.classList.contains('fz-verrou')) {
      r.secrets++;
      const illu = carte.querySelector('.illu');
      const faute = carte.querySelector('.nm')?.textContent.trim() !== 'ÂGE À VENIR' ? 'le nom se lit'
        : illu && !/blur/.test(getComputedStyle(illu).filter) ? 'le dessin est net'
          : !/90/.test(carte.querySelector('.fz-prix')?.textContent ?? '') ? 'pas de prix' : null;
      if (faute) r.secretsFaux.push(`${qui(carte)} : ${faute}`);
    }
    if (etat === 'doublons' && carte.querySelector('.fz-doublons')?.textContent.trim() !== '×3') r.stickersFaux.push(`${qui(carte)} : ×3`);
    if (etat === 'avatar' && !carte.querySelector('.sur .fz-avatar')) r.stickersFaux.push(`${qui(carte)} : AVATAR`);
    if (etat === 'titulaire' && !(carte.querySelector('.sur .fz-titulaire') && carte.querySelector('.sur .fz-avatar')
      && carte.querySelector('.fz-doublons')?.textContent.trim() === '×12')) r.stickersFaux.push(`${qui(carte)} : TITULAIRE`);

    /* Le seuil des 150 pixels. */
    const age = carte.querySelector('.age');
    const foot = carte.querySelector('.foot');
    const grand = rc.width > 150.5;
    if (age) {
      const vert = lire(getComputedStyle(age).color);
      const tampon = vert[1] > vert[0] + 20;
      if (tampon !== grand) r.seuilFaux.push(`${qui(age)} : ${tampon ? 'tampon' : 'badge'} à ${rc.width}px`);
    }
    if (foot && (getComputedStyle(foot).display !== 'none') !== grand) {
      r.seuilFaux.push(`${qui(foot)} : pied ${grand ? 'absent' : 'présent'} à ${rc.width}px`);
    }

    /* Le mouvement. */
    const infinies = carte.getAnimations({ subtree: true })
      .filter((a) => a.effect?.getComputedTiming?.().iterations === Infinity && a.playState === 'running');
    if (kase.dataset.grille) {
      r.grille++;
      if (infinies.length) {
        r.infiniesGrille.push(`${qui(carte)} : ${infinies.map((a) => a.animationName ?? '?').join(', ')}`);
      }
    } else if (rar === 'epique' || rar === 'legendaire') {
      r.vitrinesRiches++;
      /* Une animation de matière, et une seule : l'éclat de la forme ne
         tourne pas en plus du liseré (trois mouvements au plus par écran,
         la vitrine en a déjà un à elle). */
      const matiere = infinies.filter((a) => /fz-derive|fz-tourne|tbf-holo/.test(a.animationName ?? ''));
      if (matiere.length === 1) r.vitrinesAnimees++;
    }
  }

  /* Les 765 noms : la bande les tient, à 86 pixels. */
  for (const c of document.querySelectorAll('.nomcase .fz')) {
    r.noms++;
    const nm = c.querySelector('.nm');
    const top = c.querySelector('.top');
    if (!nm || !top) { r.nomsSortis.push(`${c.dataset.id} : pas de bande`); continue; }
    const rb = top.getBoundingClientRect();
    const rs = rectsTexte(nm);
    if (nm.scrollWidth > nm.clientWidth + 1 || rs.some((q) => q.left < rb.left - 1 || q.right > rb.right + 1)) {
      r.nomsSortis.push(`${c.dataset.id} « ${nm.textContent.trim()} »`);
    }
    /* **Aucun mot cassé** : un mot qui commence sur une ligne et finit sur la
       suivante, faute de place (« STATISTICIEN / NE »), se lit comme deux
       mots. Mesuré mot par mot sur le nœud de texte. Le trait d'union d'un
       nom composé est une coupe permise (« MARTEAU- / PIQUEUR ») : il sépare
       deux mots. */
    const texte = nm.firstChild;
    if (texte?.nodeType === 3) {
      const s = texte.textContent;
      for (const m of s.matchAll(/[^\s\-‐]+/g)) {
        const rg = document.createRange();
        rg.setStart(texte, m.index); rg.setEnd(texte, m.index + m[0].length);
        const hauts = new Set([...rg.getClientRects()].filter((q) => q.width > 0.5).map((q) => Math.round(q.top)));
        if (hauts.size > 1) { r.motsCasses.push(`${c.dataset.id} « ${m[0]} »`); break; }
      }
    }
    if (top.getBoundingClientRect().top < c.getBoundingClientRect().top) {
      r.nomsSortis.push(`${c.dataset.id} : la bande sort par le haut`);
    }
  }
  return r;
}

/**
 * **La réserve de boosters** : ce que `reserveHTML` rend, en entier.
 *
 * Deux promesses. La forme d'avant (`{ enFentes, html }`) ne bouge pas au
 * caractère près — le kiosque la lit encore ; on la compare à la règle telle
 * qu'elle était avant la brique, recopiée ici exprès (c'est la référence,
 * pas une seconde règle). Et la brique (BRIQUES § 1) tient dans toutes les
 * combinaisons : le compte premier `<b>`, cinq places au plus, la forme du
 * compte forcée, l'anneau dans la première place vide ou à côté du compte,
 * jamais d'anneau ni de compte à rebours sur une réserve pleine, PROCHAIN ou
 * le temps seul, le « + » au bout, tout le reste caché au lecteur d'écran.
 * Puis les quatre emplois du tableau de BRIQUES posés dans une planche, pour
 * le plancher de onze pixels et pour les largeurs (lues, pas jugées : c'est
 * la feuille qui les tient). Sérialisée par puppeteer.
 */
function verifierReserve() {
  const C = window.TBF_CARTES;
  const ancienne = ({ packs, max = null, recharge = false }) => {
    const n = Math.max(0, Math.floor(Number(packs) || 0));
    const plafond = Number(max) > 0 ? Math.floor(Number(max)) : null;
    const places = plafond === null ? Infinity : Math.max(plafond, n + (recharge ? 1 : 0));
    if (places <= 5) {
      const html = Array.from({ length: places }, (_, i) =>
        (i < n ? '<span class="tbf-fente"></span>'
          : i === n && recharge
            ? '<span class="tbf-fente tbf-fente--vide"><span class="tbf-recharge" aria-hidden="true"></span></span>'
            : '<span class="tbf-fente tbf-fente--vide"></span>')).join('');
      return { enFentes: true, html };
    }
    return { enFentes: false,
      html: `<span class="tbf-fente${n ? '' : ' tbf-fente--vide'}"></span>`
        + `<b class="tbf-sticker" aria-hidden="true">${n}</b>` };
  };
  const r = { anciens: 0, anciennesFautes: [], cas: 0, fautes: [], largeurs: [], petits: [] };
  for (const packs of [0, 1, 3, 4, 5, 6, 8, 12, 14, 1234]) {
    for (const max of [null, 0, 3, 4, 5, 6, 12, 24]) {
      for (const recharge of [false, true]) {
        r.anciens++;
        const a = ancienne({ packs, max, recharge });
        const x = C.reserveHTML({ packs, max, recharge });
        if (a.enFentes !== x.enFentes || a.html !== x.html) r.anciennesFautes.push(`${packs}/${max}/${recharge}`);
        for (const forme of ['auto', 'compte']) {
          for (const prochain of [false, 'mot', 'temps']) {
            for (const plus of [false, true]) {
              for (const anneau of [true, false]) {
                for (const part of [null, 0.35, 1.4]) {
                  r.cas++;
                  const y = C.reserveHTML({ packs, max, recharge, forme, prochain, plus, anneau, part, temps: '9:55' });
                  const d = document.createElement('div');
                  d.innerHTML = y.contenu;
                  const places = forme === 'compte' || !(max > 0) ? Infinity : Math.max(max, packs + (recharge ? 1 : 0));
                  const enPlaces = places <= 5;
                  const b = d.querySelector('b');
                  const rond = d.querySelector('.tbf-recharge');
                  const pr = d.querySelector('.tbf-reserve-prochain');
                  const faute = y.contenu !== `${y.brique.avant}<b>${packs}</b>${y.brique.apres}` ? 'contenu ≠ brique'
                    : !b || b.parentElement !== d || b.textContent !== String(packs) ? 'le compte n’est pas le premier <b>'
                      : d.querySelector('.tbf-sticker') ? 'un sticker rectangulaire'
                        : enPlaces !== Boolean(d.querySelector(':scope > .tbf-fentes')) ? 'places ou compte'
                          : enPlaces && d.querySelectorAll('.tbf-fentes > .tbf-fente').length !== places ? 'nombre de places'
                            : enPlaces && d.querySelectorAll('.tbf-fentes > .tbf-fente:not(.tbf-fente--vide)').length !== packs ? 'places pleines'
                              : !enPlaces && (d.querySelectorAll(':scope > .tbf-fente').length !== 1
                                || d.querySelector(':scope > .tbf-fente').classList.contains('tbf-fente--vide') !== (packs === 0)) ? 'le sachet seul'
                                : Boolean(rond) !== (recharge && anneau) ? 'l’anneau'
                                  : rond && !(enPlaces ? rond.parentElement === d.querySelectorAll('.tbf-fentes > .tbf-fente')[packs]
                                    : rond.parentElement === d && rond.previousElementSibling === b) ? 'l’anneau mal posé'
                                    : rond && !rond.hasAttribute('data-recharge') ? 'l’anneau sans crochet'
                                      : rond && rond.style.getPropertyValue('--part') !== (part === null ? '' : part > 1 ? '1.000' : '0.350') ? `part ${rond.style.getPropertyValue('--part')}`
                                        : Boolean(pr) !== (recharge && Boolean(prochain)) ? 'le compte à rebours'
                                          : pr && pr.textContent !== (prochain === 'mot' ? 'PROCHAIN9:55' : '9:55') ? `« ${pr.textContent} »`
                                            : pr && !pr.querySelector(':scope > b[data-prochain]') ? 'le temps sans crochet'
                                              : Boolean(d.querySelector(':scope > .tbf-monnaie-plus')) !== plus
                                                || (plus && !d.lastElementChild.classList.contains('tbf-monnaie-plus')) ? 'le « + »'
                                                : [...d.children].some((e) => e !== b && e.getAttribute('aria-hidden') !== 'true') ? 'visible au lecteur d’écran'
                                                  : null;
                  if (faute) r.fautes.push(`${packs}/${max}/${recharge ? 'en route' : 'pleine'}/${forme}/${prochain}/${plus ? '+' : '-'}/${anneau ? 'anneau' : '-'}/${part} : ${faute}`);
                }
              }
            }
          }
        }
      }
    }
  }
  /* Les quatre emplois de BRIQUES § 1, aux valeurs du banc des briques. */
  const EMPLOIS = [
    ['kiosque', 'div', { packs: 4, max: 5, recharge: true, part: 0.35, prochain: 'mot', temps: '9:55' }],
    ['boutique', 'a', { packs: 8, max: 12, recharge: true, part: 0.35, prochain: 'mot', temps: '9:55', plus: true }],
    ['vestiaire', 'a', { packs: 8, max: 12, recharge: true, part: 0.35, forme: 'compte', prochain: 'temps', temps: '7:12' }],
    ['bande du HUD', 'a', { packs: 3, max: 5, recharge: true, part: 0.35, forme: 'compte', plus: true }],
  ];
  const sec = document.createElement('section');
  sec.className = 'reserve';
  sec.innerHTML = `<h2>la réserve de boosters</h2>${EMPLOIS.map(([mot, balise, o]) =>
    `<div class="tbf-reserve" data-emploi="${mot}"><${balise} class="tbf-monnaie tbf-boosters"${
      balise === 'a' ? ' href="#"' : ' role="img"'} aria-label="${mot}">${C.reserveHTML(o).contenu}</${balise}></div>`).join('')}`;
  document.getElementById('planche').append(sec);
  for (const el of sec.querySelectorAll('.tbf-boosters')) {
    const mot = el.closest('[data-emploi]').dataset.emploi;
    r.largeurs.push(`${mot} ${Math.round(el.getBoundingClientRect().width)} px`);
    for (const t of el.querySelectorAll('*')) {
      if (![...t.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const fs = parseFloat(getComputedStyle(t).fontSize);
      if (fs < 10.95) r.petits.push(`${mot} « ${t.textContent.trim()} » ${fs}px`);
    }
  }
  return r;
}

/** Une capture par largeur, pour regarder la carte de ses yeux. */
async function photographier(page, dossier) {
  mkdirSync(dossier, { recursive: true });
  /* Les images sont paresseuses (`loading="lazy"`) : la capture d'une section
     prise hors de l'écran montrerait des plaques sans personnage. On les
     charge toutes avant — sauf les 765 noms, qui ne se photographient pas. */
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.taille img')].map((i) => {
    i.loading = 'eager';
    return i.decode().catch(() => null);
  })));
  for (const t of [86, 110, 150, 200, 300]) {
    /* Les petites tailles à double densité : à 86 pixels, un pixel d'écran
       cache tout ce qu'on veut voir. */
    await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: t <= 150 ? 2 : 1 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 300)));
    const sec = await page.$(`section.taille[data-taille="${t}"]`);
    const fichier = path.join(dossier, `carte-${t}.png`);
    await sec.screenshot({ path: fichier });
    console.log(`       capture : ${fichier}`);
  }
}
