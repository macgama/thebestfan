/**
 * Test du classeur Fanzzy.
 *
 * Cette page ne contient plus de catalogue : elle le lit sur
 * `/api/fanzzy/dex`. Ce qui était une constante immédiate est devenu un appel
 * réseau, et tout le rendu en dépend. Ce test existe pour ça — vérifier que
 * la grille, le kiosque et l'écran de duel se peuplent bien depuis la
 * réponse du serveur, et qu'un catalogue absent ou amputé le dise au lieu de
 * laisser une page vide.
 *
 * Il attrape aussi la faute qui a coûté le plus cher ici : une carte tirée
 * d'un booster que la page ne saurait pas afficher.
 *
 * Usage : node scripts/fanzzy-ui-smoke.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { DEX } from '../src/shared/fanzzy/dex.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
// Voir deck-ui-smoke : `.pathname` donne « /C:/… » sous Windows, ce qui rend
// la suite inutilisable là où elle est justement censée tourner avant livraison.
const RACINE = fileURLToPath(new URL('..', import.meta.url));

const PUBLIE = DEX.filter((f) => f.publie !== false);

/**
 * Un Fanzzy **réellement dessiné**, lu sur le disque.
 *
 * La suite nommait 'TR37' en dur comme « le Fanzzy illustré ». Le jour où ce
 * dessin est parti — il montrait Le Petit Teigneux sous un autre nom — quatre
 * contrôles sont devenus rouges sans que rien ne soit cassé dans le jeu : ils
 * éprouvaient une carte qui ne remplissait plus leur hypothèse.
 *
 * Un test qui écrit en dur un fait sur le contenu se casse à chaque fois que
 * le contenu bouge, et — bien pire — il peut cesser de mesurer quoi que ce
 * soit sans le dire. On demande donc au disque, et le contrôle suit le lot.
 */
const IMG = path.join(RACINE, 'public', 'img', 'fanzzy');

/* Les quatre que la suite emploie pour eux-mêmes, et qu'on ne remplace pas :
   `TR32` est monté au second âge — c'est lui qui prouve que la fiche montre le
   dessin de l'âge atteint et non celui de la lignée — et les trois autres
   peuplent la grille. Le cinquième est choisi pour une seule propriété :
   être dessiné. */
const NOMMES = ['TR39', 'TR40', 'TR32', 'MS30'];

/* Un **personnage**, pas un âge supérieur — et d'une lignée que le compte ne
   possède pas déjà. Le premier jet prenait le premier dessin venu et tombait
   sur `TR32B`, le second âge de `TR32` : la grille range des personnages, donc
   posséder les deux ne faisait qu'une case, et trois contrôles de comptage
   sont devenus rouges en annonçant autre chose que la cause. */
const SUITE = new Set(PUBLIE.map((f) => f.evo).filter(Boolean));
const lignee = (id) => {
  let r = PUBLIE.find((f) => f.id === id);
  for (let g = 0; g < 8 && r; g++) {
    const p = PUBLIE.find((f) => f.evo === r.id);
    if (!p) break;
    r = p;
  }
  return r?.id ?? id;
};
const PRISES = new Set(NOMMES.map(lignee));
const ILLUSTRE = PUBLIE.find((f) =>
  !SUITE.has(f.id)
  && !PRISES.has(lignee(f.id))
  && existsSync(path.join(IMG, f.id + '.png'))
  && existsSync(path.join(IMG, f.id + '-buste.png')))?.id;
if (!ILLUSTRE) throw new Error(
  'aucun Fanzzy dessiné dans public/img/fanzzy : la suite ne peut rien éprouver.');

/** Ce que le compte d’essai possède. Une seule liste, lue partout. */
const COLLECTION = [ILLUSTRE, ...NOMMES];

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(60); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS contenus, abonnements, achats, kop_invites, amities, saisons, reglages, admin_audit,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
// `stades.sql` ajoute la colonne `stage` à `user_fanzzy`. Sans elle, toute la
// collection reste au premier âge, donc entièrement commune — et la grille
// n'aurait aucune rareté à montrer.
// `niveau.sql` en plus : sans la colonne `xp`, le module de progression ouvre
// *toutes* les séries — c'est sa règle, un schéma incomplet ne confisque rien —
// et le kiosque n'aurait alors rien à verrouiller. La suite passerait au vert
// sans jamais éprouver le cas qui a produit la panne.
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'tenues.sql', 'deck.sql', 'stades.sql',
                 // Les saisons décident de ce que le classeur range. Sans cette table,
                 // le jeu tourne toutes séries ouvertes et la restriction ne s'éprouve pas.
                 // 'admin.sql' vient avec : la reprise de la saison 1 lit 'reglages'.
                 'niveau.sql', 'admin.sql', 'saisons.sql', 'contenus.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'bbbbbbbb-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'classeur@ex.fr', 'Classeuse']);
/* Assez d'écharpes et de boosters pour ouvrir sans attendre la régénération,
   et **niveau 9** : c'est le palier qui débloque « NUITS EUROPÉENNES », la
   série que les contrôles d'ouverture emploient. Un compte au niveau 1 les
   verrait tous refusés. Le niveau 9 laisse verrouillées les séries des paliers
   suivants, ce qui est exactement ce qu'il faut pour éprouver le kiosque. */
const { seuil } = await import('../src/shared/niveau.js');
/* Le Fanzzy équipé est **TR32 au second âge**, et c'est délibéré : l'écran
   « Mon Fanzzy » doit montrer le Meneur de chant et non le Choriste, dans un
   cadre rare et non commun. Équipé d'un TR37 resté au premier âge, la page
   pouvait ignorer le stade et ignorer la rareté sans qu'aucun contrôle ne
   bouge — tout le catalogue est commun au premier âge. */
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,active_fanzzy)
                 VALUES (?,900,9,?,'TR32')`, [U, seuil(9)]);
// TR37 est possédé : c'est le Fanzzy illustré, et c'est lui qui cassait la page.
// TR32 est monté au second âge : la rareté suit le stade, donc c'est la seule
// façon d'avoir autre chose que du commun dans la grille — et c'est ce qui
// permet de vérifier que la rareté se voit.
for (const f of COLLECTION) {
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage) VALUES (?,?,1,?)`,
    [U, f, f === 'TR32' ? 2 : 1]);
}
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);
const requireAuth = (q, _s, n) => { q.user = { id: U }; n(); };
/* La progression est montée ici, et c'est nécessaire : sans elle, `createFanzzy`
   ouvre toutes les séries et le kiosque ne peut rien verrouiller. C'est
   justement la configuration où la panne se cachait — le kiosque proposait les
   neuf séries, le joueur en choisissait une hors de portée, et découvrait le
   refus après avoir appuyé, sous la forme d'un code brut. */
const { createNiveau } = await import('../src/server/niveau/index.js');
const niveau = createNiveau({ pool, requireAuth });
/* Le module de deck est monté lui aussi : la fiche s'en sert pour dire où le
   personnage se trouve dans la tribune du joueur, et pour l'y placer. Sans lui
   la fiche retire son bouton d'action — ce qui est le bon comportement en
   production, mais fait éprouver ici une page qui n'existe nulle part. */
const { createDecks } = await import('../src/server/deck/index.js');
const decks = createDecks({ pool, requireAuth, niveau });
const fanzzy = createFanzzy({ pool, requireAuth, niveau, decks });

/**
 * Un interrupteur pour amputer la réponse du catalogue.
 * Il sert au dernier contrôle : une page privée de catalogue doit nommer la
 * cause, pas afficher une grille vide sans un mot.
 */
let amputer = null;
const app = express();
app.use('/api/fanzzy', (q, s, n) => {
  if (amputer && q.path === '/dex') {
    const envoyer = s.json.bind(s);
    s.json = (v) => envoyer({ ...v, [amputer]: undefined });
  }
  n();
}, fanzzy.router);
app.use('/api/deck', decks.router);
app.get('/fanzzy', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'fanzzy.html')));
// La fiche d'un Fanzzy, servie comme `server.js` le fait : c'est la page que
// la grille ouvre quand on touche une carte.
app.get('/fanzzy/:id', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'fanzzy-fiche.html')));
app.use('/api/me', (await import('../src/server/onboarding/index.js'))
  .createOnboarding({ pool, requireAuth }).router);
/* `nav.js` demande qui est connecté avant de monter la barre du haut. Sans
   cette route, pas de barre, donc pas de bouton de menu — et depuis que la
   barre du bas a disparu, pas de navigation du tout. Le banc doit répondre
   comme le vrai serveur, sinon il éprouve son propre manque. */
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: U, pseudo: 'Testeur' } }));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];

async function ouvrir({ sansCache = false } = {}) {
  const page = await nav.newPage();
  page.on('pageerror', (e) => erreurs.push(e.message));
  // /api/fanzzy/dex est servie avec un cache d'une heure. Sans cette coupure,
  // le second chargement rejouait la réponse mise en cache et n'atteignait
  // jamais le serveur : le test croyait avoir amputé le catalogue alors que
  // la page recevait toujours le bon.
  if (sansCache) await page.setCacheEnabled(false);
  await page.setViewport({ width: 400, height: 880, deviceScaleFactor: 1 });
  await page.goto(base + '/fanzzy', { waitUntil: 'networkidle0' });
  return page;
}

/* ------------------------------------------ le catalogue vient du réseau

   `PUBLIE` et non `DEX` : trente-deux anciennes cartes sont dépubliées parce
   qu'elles refont un personnage du lot de 2026. Le classeur ne doit montrer que
   ce qui se joue — une carte retirée qui resterait dans la grille laisserait
   une case impossible à remplir, et la progression n'atteindrait jamais 100 %. */




{
  const reponse = await (await fetch(base + '/api/fanzzy/dex')).json();
  check('la route sert le catalogue publié', reponse.dex?.length === PUBLIE.length);
  check('et tout ce que la page utilisait en dur',
    Boolean(reponse.types && reponse.sets && reponse.rar
            && reponse.scarves && reponse.evoCost && reponse.rates));
  check('les taux de tirage couvrent les deux emplacements rares',
    Boolean(reponse.rates?.[4] && reponse.rates?.[5]));
}

const page = await ouvrir();

check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

check('le catalogue est arrivé du serveur',
  await page.evaluate(() => DEX.length) === PUBLIE.length);
check('la table des identifiants est reconstruite',
  await page.evaluate(() => BY_ID.size) === PUBLIE.length);
check('les types sont là, sinon aucune carte n\u2019a de couleur',
  await page.evaluate(() => Object.keys(TYPES).length) === 6);

if (process.env.SHOT) {
  const p = await ouvrir();
  await p.evaluate(() => [...document.querySelectorAll("button")]
    .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
  await dodo(700);
  await p.screenshot({ path: process.env.SHOT + "/classeur.png" });
  await p.close();
}

/* --------------------------------------------------------- le classeur */

await page.evaluate(() => [...document.querySelectorAll('button')]
  .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
await jusqua(async () => await page.evaluate(() =>
  document.querySelectorAll('#grid .slot').length > 0));

/* L âge d un Fanzzy, lisible sur la carte.

   Il n était écrit que dans le pied, en « ét. 2 », à trois pixels de haut et
   derrière le nom du type — or c est ce qu on paie quatre-vingt-dix écharpes
   pour obtenir. Il doit se voir d un coup d œil sur une grille de vingt
   cartes, pas se déchiffrer une par une. */
{
  const ages = await page.evaluate(() => [...document.querySelectorAll("#grid .fz")]
    .map((c) => {
      const a = c.querySelector(".age");
      if (!a) return null;
      const r = a.getBoundingClientRect();
      const duel = c.querySelector(".duel, .eq, [data-duel]");
      const d = duel?.getBoundingClientRect();
      return {
        texte: a.textContent.trim(),
        visible: r.width > 8 && r.height > 4,
        chevauche: Boolean(d && r.left < d.right && d.left < r.right
          && r.top < d.bottom && d.top < r.bottom),
      };
    }).filter(Boolean));

  check("les cartes possédées annoncent leur âge", ages.length > 0);
  check("et il est écrit en clair, pas en abrégé",
    ages.every((a) => /^(ÉVO \d|LÉGENDAIRE)$/.test(a.texte))
    || (console.log("        vu :", [...new Set(ages.map((a) => a.texte))].join(" · ")), false));
  check("il se voit vraiment", ages.every((a) => a.visible));
  /* La pastille du deck occupe le coin en haut à gauche. L âge y était aussi,
     et les deux se recouvraient sur toute carte du deck. */
  check("et rien ne le recouvre", ages.every((a) => !a.chevauche));
}

const grille = await page.evaluate(() => ({
  cases: document.querySelectorAll('#grid .slot').length,
  possedees: document.querySelectorAll('#grid .slot:not(.locked)').length,
  progression: document.getElementById('progTxt')?.textContent ?? '',
  /* L'ordre affiche, pour verifier qu'une lignee se lit d'un bloc : TR1, TR1B,
     TR1C, puis TR2. Trois par rangee, donc une lignee par rangee. */
  ordre: [...document.querySelectorAll('#grid .slot [data-id]')]
    .map((c) => c.getAttribute('data-id')),
}));

/* **Une case par age**, et non plus une par personnage.

   Le classeur ne montrait qu'une case par lignee — celle du personnage, au
   stade atteint. Les deux autres ages existaient, avec leur nom, leur dessin,
   leur cri et leur prix, et n'apparaissaient nulle part : on ne pouvait ni les
   regarder avant de payer, ni les revoir apres. Un classeur est une promesse,
   et il en cachait les deux tiers. */
const PERSOS = PUBLIE.filter((f) => !PUBLIE.some((x) => x.evo === f.id));
check(`la grille affiche un age par case (${grille.cases})`,
  grille.cases === PUBLIE.length
  || (console.log('        vu', grille.cases, 'pour', PUBLIE.length, 'cartes publiees'), false));

/* Les ages d'une meme lignee se suivent, et les lignees sont dans l'ordre
   numerique : TR1, TR1B, TR1C, TR2… C'est ce qui rend la progression lisible
   d'un coup d'oeil sur une grille de trois colonnes. */
{
  const racine = (id) => /^([A-Z]+\d+)/.exec(id)?.[1] ?? id;
  const groupes = [];
  for (const id of grille.ordre) {
    const r = racine(id);
    if (groupes[groupes.length - 1]?.r !== r) groupes.push({ r, n: 0 });
    groupes[groupes.length - 1].n++;
  }
  check('les ages d une lignee se suivent',
    new Set(groupes.map((g) => g.r)).size === groupes.length
    || (console.log('        une lignee est coupee en deux'), false));
  const num = (r) => Number(/\d+/.exec(r)?.[0] ?? 0);
  const serie = (r) => /^[A-Z]+/.exec(r)[0];
  /* Serie par serie : la grille range TR1, TR2, TR3 dans une serie, puis passe
     a la suivante. Comparer la liste a plat melangerait deux series et ferait
     echouer un ordre parfaitement juste — c'est ce qu'a fait le premier jet. */
  const parSerie = new Map();
  for (const g of groupes) {
    if (!parSerie.has(serie(g.r))) parSerie.set(serie(g.r), []);
    parSerie.get(serie(g.r)).push(num(g.r));
  }
  const fautive = [...parSerie].find(([, ns]) => ns.some((n, i) => i > 0 && n < ns[i - 1]));
  check('et les lignees sont dans l ordre numerique', !fautive
    || (console.log('        serie', fautive[0], ':', fautive[1].slice(0, 10).join(' ')), false));
}

/* Le compte possede suit la meme regle que l'affichage : on possede « le
   Choriste au stade 2 », donc ses deux premiers ages, pas le troisieme. Le
   banc possede cinq personnages, dont un monte au second age. */
check(`les cartes possedees sont distinguees (${grille.possedees})`,
  grille.possedees === 6
  || (console.log('        cases non verrouillees :', grille.possedees), false));
/* Le dénominateur compte des **personnages**, pas des lignes de catalogue.
   Les quatorze âges supérieurs des sept lignées ne s'obtiennent pas en booster,
   ils s'achètent en écharpes : les mettre au dénominateur promettait au joueur
   quatorze cartes qu'aucune ouverture ne pouvait lui donner, et la jauge
   n'aurait jamais atteint le bout. */

check('la progression compte les personnages, pas leurs âges',
  grille.progression === `5/${PERSOS.length}`);

// La grille se peuplait déjà mal quand une seule chose manquait : ce contrôle
// vaut pour toutes les cartes non possédées, celles qui passent par `esc`.
check('les Fanzzy non possédés portent leur nom',
  await page.evaluate(() => {
    const v = document.querySelector('#grid .slot.locked');
    return Boolean(v && v.textContent.trim().length > 2);
  }));

/* --------------------------------------------- ce que la grille montre

 * Une grille de collection doit répondre à deux questions sans qu'on lise
 * quoi que ce soit : **qu'est-ce que je n'ai pas**, et **qu'est-ce qui est
 * rare**. Elle ne répondait ni à l'une ni à l'autre.
 *
 * Les cases non possédées étaient des rectangles pointillés avec un nom en
 * gris — neuf sur douze à l'écran, et la grille ressemblait à un formulaire.
 * Et le cadre des cartes portait la couleur du **type**, si bien qu'une
 * commune et une légendaire du même type se ressemblaient trait pour trait.
 */
{
  const vide = await page.evaluate(() => {
    const v = document.querySelector('#grid .slot.locked');
    const dessin = v?.querySelector('.art') ?? null;
    return {
      dessin: Boolean(dessin),
      cadenas: Boolean(v?.querySelector('.cadenas')),
      // Assombri, mais pas éteint : une silhouette qu'on ne distingue pas ne
      // vaut pas mieux qu'une case vide.
      // Lu sous garde : quand le dessin disparaît, ce contrôle doit rougir,
      // pas faire tomber la suite entière sur un `null`. Un test qui plante
      // n'annonce pas ce qu'il a trouvé.
      filtre: dessin ? getComputedStyle(dessin).filter : '',
    };
  });
  check('un Fanzzy qu’on n’a pas montre quand même son personnage', vide.dessin);
  check('en ombre, avec un cadenas', vide.cadenas && /grayscale|brightness/.test(vide.filtre));

  /* La rareté est la seule chose qu'on montre aux autres : elle doit se lire
     sur la vignette. On compare la couleur de cadre d'une commune et d'une
     rare — si les deux se valent, le code de rareté ne dit rien. */
  const teintes = await page.evaluate(() => {
    const lu = (r) => {
      const n = document.querySelector(`#grid .fz.r-${r}`);
      return n ? getComputedStyle(n).getPropertyValue('--rc').trim() : null;
    };
    return { commune: lu('commune'), rare: lu('rare'), legendaire: lu('legendaire') };
  });
  check('chaque rareté a sa couleur de cadre',
    Boolean(teintes.commune) && Boolean(teintes.rare)
    && teintes.commune !== teintes.rare);
  check('et la légendaire ne se confond avec aucune',
    !teintes.legendaire || (teintes.legendaire !== teintes.commune
      && teintes.legendaire !== teintes.rare));

  /* `\s` et non un espace littéral : un espace insécable s'était glissé dans
     le gabarit, invisible dans l'éditeur comme dans le message d'échec, et le
     contrôle échouait sur un texte qui paraissait exactement juste. Un test
     qui ne peut pas montrer ce qu'il reproche coûte une demi-heure. */
  const reste = await page.$eval('#progReste', (n) => n.textContent);
  check('l’en-tête annonce ce qui reste à trouver',
    /\d+\s+à\s+trouver|complète/.test(reste)
    || (console.log('        il dit :',
      [...reste].map((c) => c.codePointAt(0).toString(16)).join(' ')), false));
}

/* ------------------------------------------- la fiche, en un seul écran

 * Elle défilait sur mille deux cents pixels pour une fenêtre de huit cent
 * quatre-vingts, et le bouton « emmener en duel » était tout en bas de
 * l'écran qui sert justement à décider si on l'emmène.
 *
 * Elle tient maintenant en un écran, et surtout elle est **la seule** : le
 * classeur montrait auparavant son propre aperçu, qui ne disait ni les tenues
 * ni l'équipement. Ce qui se vérifie ici est donc double — que tout tienne, et
 * que ce soit bien ce rendu-là qu'on obtienne aux deux adresses.
 *
 * Les cases sont le cœur de la mise en page : âges, tenues, effets, celles
 * qu'on n'a pas portant un cadenas et disant ce qu'elles demandent. C'est la
 * différence entre « il me manque des choses » et « il me manque *ça* ».
 */
{
  const fiche = await nav.newPage();
  fiche.on('pageerror', (e) => erreurs.push(e.message));
  await fiche.setViewport({ width: 400, height: 880 });
  await fiche.goto(`${base}/fanzzy/${ILLUSTRE}`, { waitUntil: 'networkidle0' });
  const prete = await fiche.waitForSelector('.fiche .case', { timeout: 8000 })
    .then(() => true).catch(() => false);
  check('la fiche d’un Fanzzy s’affiche', prete);

  if (prete) {
    const m = await fiche.evaluate(() => ({
      defile: document.documentElement.scrollHeight > innerHeight + 1,
      vitrine: document.querySelector('.vitrine').getBoundingClientRect().height,
      ecran: innerHeight,
      bouton: document.querySelector('.actions .bt')?.getBoundingClientRect().bottom ?? 1e9,
      rangs: [...document.querySelectorAll('.rang h4')].map((n) => n.textContent.trim()),
      cases: document.querySelectorAll('.case').length,
      // Une case verrouillée reste **visible** : c'est elle qui donne envie.
      verrous: document.querySelectorAll('.case.verrou').length,
      detail: document.getElementById('fiche-detail').textContent.replace(/\s+/g, ' ').trim(),
      choisies: document.querySelectorAll('.case.choisie').length,
    }));
    check('elle tient dans l’écran, sans défilement',
      !m.defile || (console.log('        elle défile'), false));
    check('le personnage occupe plus du tiers de la hauteur',
      m.vitrine > m.ecran * 0.34
      || (console.log(`        ${Math.round(m.vitrine)} px sur ${m.ecran}`), false));
    check('et le bouton d’action est visible sans chercher', m.bouton <= m.ecran + 1);
    check('les trois rangées de cases sont là',
      /* L'ordre compte : la bande défile, et les tenues sont trop nombreuses
         pour tenir avant les effets. Placées au milieu, elles les repoussaient
         hors de l'écran. */
      m.rangs.join('/') === 'ÂGES/EFFETS/TENUES'
      || (console.log('        rangées :', m.rangs.join(', ')), false));
    check('et il y a des cases à regarder', m.cases >= 4);
    check('celles qu’on n’a pas restent visibles, verrouillées', m.verrous > 0);
    /* Une case est choisie d'entrée, sinon le bloc de détail s'ouvre vide et
       personne ne devine qu'il faut toucher un losange. */
    check('une case est regardée dès l’ouverture', m.choisies === 1);
    check('et son détail est écrit dessous', m.detail.length > 10);

    /* Toucher une case change ce qu'on lit — et **ne fait pas sauter le
       personnage** : le bloc de détail a une hauteur fixe pour ça. */
    const avant = m.detail;
    const hautAvant = m.vitrine;
    await fiche.evaluate(() => {
      const autre = [...document.querySelectorAll('.case')]
        .find((n) => !n.classList.contains('choisie'));
      autre.click();
    });
    await dodo(200);
    const apres = await fiche.evaluate(() => ({
      detail: document.getElementById('fiche-detail').textContent.replace(/\s+/g, ' ').trim(),
      haut: document.querySelector('.vitrine').getBoundingClientRect().height,
      choisies: document.querySelectorAll('.case.choisie').length,
    }));
    check('toucher une case change le détail', apres.detail !== avant);
    check('et une seule case reste choisie', apres.choisies === 1);
    check('le personnage ne saute pas d’une case à l’autre',
      Math.abs(hautAvant - apres.haut) < 2
      || (console.log(`        ${Math.round(hautAvant)} puis ${Math.round(apres.haut)}`), false));

    /* La case qu'on n'a pas dit ce qu'il faut pour l'avoir. Un cadenas sans
       explication ne donne envie de rien — il faut lire « à trouver dans un
       booster » ou « 90 écharpes », sinon on cherche un bouton qui n'existe pas. */
    const verrou = await fiche.evaluate(() => {
      const v = document.querySelector('.case.verrou');
      v.click();
      return document.getElementById('fiche-detail').textContent.replace(/\s+/g, ' ').trim();
    });
    check('une case verrouillée dit ce qu’elle demande',
      /écharpes|booster|niveau/.test(verrou)
      || (console.log('        elle dit :', verrou), false));

    check('la fiche ne défile toujours pas après trois cases',
      await fiche.evaluate(() =>
        document.documentElement.scrollHeight <= innerHeight + 1));

    /* Le dessin est celui de **l'age atteint**. La fiche demandait
       l'illustration sous le nom de la lignee : elle montrait donc le premier
       age sous le nom du dernier, ce qui ressemble a un personnage parfaitement
       valide et ne se voit jamais.

       **On revient d'abord sur l'age courant.** Les trois cases touchees juste
       au-dessus l'ont ete au hasard, et depuis que la vitrine suit l'age
       choisi, l'une d'elles a pu la deplacer — ce controle lisait alors le
       dessin d'un autre age et accusait la fiche a tort. Ce qu'il eprouve est
       le rendu de l'age courant : on le lui redonne explicitement. */
    await fiche.evaluate(() => {
      document.querySelector('[data-case^="age:"]')?.click();
    });
    const dessin = await fiche.evaluate(() =>
      document.querySelector('.fiche .art img')?.getAttribute('src') ?? '');
    check('le dessin de la vitrine est bien celui du personnage',
      new RegExp(ILLUSTRE + '[-.]').test(dessin)
      || (console.log('        il montre :', dessin, '— attendu', ILLUSTRE), false));

    /* Le dessin est celui de **l'âge atteint**, et c'est TR32 qui le prouve :
       ce compte l'a monté au second âge. La fiche demandait l'illustration
       sous le nom de la lignée — elle montrait donc le Choriste sous le nom
       du Meneur de chant, ce qui ressemble à un personnage parfaitement
       valide et ne se voit jamais. TR37, resté au premier âge, ne pouvait pas
       faire la différence. */
    const evolue = await nav.newPage();
    evolue.on('pageerror', (e) => erreurs.push(e.message));
    await evolue.setViewport({ width: 400, height: 880 });
    await evolue.goto(`${base}/fanzzy/TR32`, { waitUntil: 'networkidle0' });
    await evolue.waitForSelector('.fiche .art img', { timeout: 8000 }).catch(() => {});
    const age = await evolue.evaluate(() => ({
      dessin: document.querySelector('.fiche .art img')?.getAttribute('src') ?? '',
      nom: document.querySelector('.fiche h2')?.textContent.trim() ?? '',
    }));
    check('la fiche montre le dessin de l’âge atteint, pas celui de la lignée',
      /TR32B/.test(age.dessin)
      || (console.log('        elle montre :', age.dessin), false));
    check('et son nom va avec', /Meneur/.test(age.nom)
      || (console.log('        elle nomme :', age.nom), false));

    /* **On peut revenir voir l'enfant.**

       La rangee ÂGES n'existe que pour regarder les trois visages d'une
       lignee. Toucher la premiere case changeait le texte en dessous — « Tu es
       passe par la » — et laissait le dessin sur l'age atteint : quelqu'un qui
       avait paye son evolution ne pouvait plus jamais revoir son premier age.

       TR32 est monte au second age sur ce banc, et ses trois ages sont
       dessines : c'est donc lui qui permet de le verifier. */
    const premier = await evolue.evaluate(() => {
      const cases = [...document.querySelectorAll('[data-case^="age:"]')];
      cases[0]?.click();
      return cases.length;
    });
    check('la rangee des ages porte bien les trois', premier === 3
      || (console.log('        cases d age :', premier), false));

    const revenu = await jusqua(async () => evolue.evaluate(() =>
      /TR32[.-]/.test(document.querySelector('.fiche .art img')?.getAttribute('src') ?? '')));
    check('toucher le premier age ramene son dessin', revenu
      || (console.log('        elle montre toujours :', await evolue.evaluate(() =>
        document.querySelector('.fiche .art img')?.getAttribute('src'))), false));

    /* Et le retour : on rouvre l'age atteint, on retrouve son dessin. Sans ce
       controle, une vitrine qui se figerait sur le premier age passerait. */
    await evolue.evaluate(() => {
      [...document.querySelectorAll('[data-case^="age:"]')][1]?.click();
    });
    const rendu = await jusqua(async () => evolue.evaluate(() =>
      /TR32B/.test(document.querySelector('.fiche .art img')?.getAttribute('src') ?? '')));
    check('et revenir a l age atteint le retrouve', rendu);
    await evolue.close();
  }
  if (process.env.CAPTURE) {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    await fiche.screenshot({ path: join(tmpdir(), 'fiche.png') });
  }
  await fiche.close();
}


/* --------------------------------- les onglets du classeur, même gabarit

 * « PYRO n'a pas les mêmes proportions que les autres. » Il en a huit,
 * `.chips` est un `display:flex` qui défile, et rien ne portait `flex:none` :
 * les boutons se **rétrécissent** pour tenir dans la largeur avant que le
 * défilement ne serve à quoi que ce soit. Le rétrécissement est proportionnel
 * à la largeur de départ, donc chaque onglet perd une quantité différente —
 * le texte se serre contre les bords, et pas également.
 *
 * On mesure le blanc réel de chaque côté du texte. Une page où tous les
 * onglets ont le même gabarit a le même blanc partout.
 */
{
  const onglets = await page.evaluate(() => {
    const p = document.getElementById('filters');
    return [...p.querySelectorAll('.filt')].map((b) => {
      const r = b.getBoundingClientRect();
      const t = document.createRange();
      t.selectNodeContents(b);
      const m = t.getBoundingClientRect();
      return { nom: b.textContent.trim(),
        gauche: Math.round((m.left - r.left) * 10) / 10,
        droite: Math.round((r.right - m.right) * 10) / 10 };
    });
  });
  const marges = onglets.flatMap((o) => [o.gauche, o.droite]);
  const ecart = Math.max(...marges) - Math.min(...marges);
  check('tous les onglets du classeur ont le même blanc autour du mot',
    ecart <= 1
    || (console.log('        écart de', ecart, 'px :',
      onglets.map((o) => `${o.nom} ${o.gauche}/${o.droite}`).join(', ')), false));
  check('et aucun n’est rogné', onglets.every((o) => o.gauche >= 6 && o.droite >= 6)
    || (console.log('        ', JSON.stringify(onglets)), false));
}

/* ------------------------------------ emmener ce Fanzzy en duel, vraiment

 * Le bouton le plus important de la fiche, et celui que rien n'éprouvait. Il
 * ouvre une question — titulaire ou remplaçant ? — puis écrit dans le deck.
 * Trois pièces indépendantes doivent tenir ensemble : le bouton, la boîte de
 * dialogue, et `/api/deck/placer`. Deux d'entre elles peuvent disparaître
 * **sans aucune erreur** : `window.TBF_DIALOGUE?.confirmer` sur un module
 * absent ne fait rien du tout, et une tribune sans place ouverte non plus.
 *
 * « Il ne se passe rien » est exactement la forme que prend cette panne, et
 * c'est la seule qu'aucune lecture du code ne rattrape. On appuie donc.
 */
{
  const fiche = await nav.newPage();
  fiche.on('pageerror', (e) => erreurs.push(`fiche duel : ${e.message}`));
  await fiche.setViewport({ width: 400, height: 880 });
  await fiche.goto(`${base}/fanzzy/${ILLUSTRE}`, { waitUntil: 'networkidle0' });
  await fiche.waitForSelector('.fiche .case', { timeout: 8000 }).catch(() => {});

  const bouton = await fiche.evaluate(() => {
    const b = document.querySelector('[data-emmener]');
    return b ? b.textContent.replace(/\s+/g, ' ').trim() : null;
  });
  check('la fiche offre d’emmener le personnage en duel', bouton !== null
    || (console.log('        aucun bouton [data-emmener]'), false));

  await fiche.evaluate(() => document.querySelector('[data-emmener]')?.click());
  const ouverte = await jusqua(async () => fiche.evaluate(() =>
    document.querySelectorAll('.tbf-dial-places .place').length > 0));
  check('appuyer dessus ouvre le choix de la place', ouverte
    || (console.log('        rien ne s’est ouvert —',
      await fiche.evaluate(() => JSON.stringify({
        dialogue: typeof window.TBF_DIALOGUE,
        boites: document.querySelectorAll('.tbf-dial, [data-oui]').length,
      }))), false));

  if (ouverte) {
    const places = await fiche.evaluate(() =>
      [...document.querySelectorAll('.tbf-dial-places .place')].map((b) => ({
        role: b.querySelector('.role')?.textContent.trim(),
        bloque: b.disabled,
      })));
    check('elle propose un titulaire et des remplaçants', places.length >= 2
      || (console.log('        places :', JSON.stringify(places)), false));
    check('et la première est prenable', places[0] && !places[0].bloque);

    /* On choisit le titulaire et on valide. Ce qui compte n'est pas le toast :
       c'est que le deck, relu depuis le serveur, contienne ce personnage. Un
       message de réussite sur une écriture qui n'a pas eu lieu est précisément
       ce que ce projet a déjà payé. */
    await fiche.evaluate(() => {
      document.querySelector('.tbf-dial-places [data-place="0"]').click();
      document.querySelector('[data-oui]').click();
    });
    const pose = await jusqua(async () => {
      const d = await (await fetch(`${base}/api/deck/mien`)).json().catch(() => null);
      return d?.deck?.fanzzy?.[0]?.id === ILLUSTRE;
    }, 6000);
    check('valider le pose vraiment titulaire dans le deck', pose
      || (console.log('        deck :', JSON.stringify(
        await (await fetch(`${base}/api/deck/mien`)).json().catch(() => null)).slice(0, 200)), false));

    /* Et la fiche se met à jour sans rechargement : le verbe passe de
       « EMMENER » à « CHANGER DE PLACE ». Sans ça, le joueur appuie une
       seconde fois en croyant que rien n'a marché. */
    const apres = await jusqua(async () => fiche.evaluate(() =>
      /CHANGER/.test(document.querySelector('[data-emmener]')?.textContent ?? '')));
    check('et la fiche dit désormais qu’il y est', apres);
  }
  await fiche.close();
}

/* ------------------------- le classeur ne range que ce qui est ouvert

 * Il montrait **tout le catalogue publié**, séries à venir comprises : deux
 * cent quarante-sept silhouettes grises, dont une bonne part n'existe encore
 * pour personne. Un classeur est une promesse — « voilà ce qu'il y a à
 * trouver » — et une promesse qu'on ne peut pas tenir n'est pas un but, c'est
 * un mur. La surprise d'une saison neuve disparaissait avec : tout avait déjà
 * été vu, en gris.
 *
 * Les saisons sont additives, donc « la saison en cours et toutes celles
 * d'avant » est exactement la liste des séries ouvertes.
 *
 * Le contrôle lance une vraie saison qui n'ouvre qu'une série, recharge le
 * serveur comme le fait l'administration, et compte les cases. C'est le seul
 * moyen d'éprouver la restriction : jusqu'ici aucune suite n'avait de saison
 * lancée, donc tout était ouvert et le filtre n'avait rien à filtrer.
 */
{
  const { chargerSaisons } = await import('../src/server/fanzzy/saisons.js');
  const { chargerSeries } = await import('../src/server/fanzzy/catalogue.js');

  // La série du Fanzzy équipé, pour que l'écran « Mon Fanzzy » reste sensé.
  const laSerie = PUBLIE.find((f) => f.id === 'TR32').set;
  await pool.query('DELETE FROM saisons');
  await pool.query(
    `INSERT INTO saisons (numero, nom, texte, series, tenues, lancee_a)
     VALUES (9, 'Essai', 'Pour voir.', ?, JSON_ARRAY(), NOW(3))`,
    [JSON.stringify([laSerie])]);
  await chargerSaisons(pool);
  await chargerSeries(pool);

  /* `sansCache`, et c'est essentiel. `/api/fanzzy/dex` est servie avec une
     minute de cache — la bonne durée en production, puisqu'une saison se lance
     depuis l'administration. Ici, la page rejouait la réponse d'avant : elle
     recevait toutes les séries ouvertes et le contrôle mesurait un classeur
     qui n'avait jamais entendu parler de la saison qu'on venait de lancer. */
  const p = await ouvrir({ sansCache: true });
  await p.evaluate(() => [...document.querySelectorAll('button')]
    .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
  await dodo(400);

  const vu = await p.evaluate(() => ({
    cases: [...document.querySelectorAll('#grid .slot')].map((s) => s.dataset.open),
    total: document.getElementById('progTxt')?.textContent ?? '',
  }));

  /* Ce qui doit s'y trouver : les personnages de la série ouverte, **plus**
     ceux qu'on possède déjà ailleurs. Fermer une série cesse de distribuer ;
     ça n'efface pas les cartes de qui les a, et les faire disparaître du
     classeur transformerait une collection en trou. */
  const PERSOS_TOUS = PUBLIE.filter((f) => !PUBLIE.some((x) => x.evo === f.id));
  /* La collection du compte, écrite une seule fois plus haut : la recopier ici
     ferait deux listes, et la seconde se tromperait le jour où la première
     change — ce qui vient exactement d’arriver. */
  const MIENS = COLLECTION;
  const attendus = PERSOS_TOUS
    .filter((f) => f.set === laSerie || MIENS.includes(f.id)).map((f) => f.id);

  const trop = vu.cases.filter((id) => !attendus.includes(id));
  const manque = attendus.filter((id) => !vu.cases.includes(id));

  check('une saison lancée restreint le classeur à ses séries',
    vu.cases.length < PERSOS_TOUS.length && trop.length === 0);
  if (trop.length) console.log('    en trop :', trop.slice(0, 8).join(' '));
  check('et rien de ce qui est ouvert ne manque', manque.length === 0);
  if (manque.length) console.log('    manquent :', manque.slice(0, 8).join(' '));

  /* Le cas qui compte vraiment : une carte possédée dans une série **fermée**
     reste au classeur. C'est la promesse faite au collectionneur, et c'est ce
     qu'un filtre écrit trop vite casse en premier. */
  const dehors = MIENS.filter((id) => PERSOS_TOUS.find((f) => f.id === id)?.set !== laSerie);
  check('une carte possédée dans une série fermée reste rangée',
    dehors.length > 0 && dehors.every((id) => vu.cases.includes(id))
    || (console.log('    hors saison :', dehors.join(' ')), false));

  await p.close();

  /* On rend le banc comme on l'a trouvé : les contrôles qui suivent comptent
     sur un catalogue entier, et une suite qui laisse son décor derrière elle
     fait tomber la suivante sans dire pourquoi. */
  await pool.query('DELETE FROM saisons');
  await chargerSaisons(pool);
  await chargerSeries(pool);
}

/* ------------------------- la fiche d'un Fanzzy qu'on ne possède pas

 * La grille le montre en silhouette grise. L'ouvrir le rendait à ses
 * couleurs, avec ses âges, ses effets et ses tenues à fouiller case par case :
 * deux images contradictoires du même personnage, à un doigt l'une de l'autre,
 * et la seconde livrait tout ce que la première disait ne pas avoir.
 *
 * Elle reste maintenant éteinte, et inerte. « Inerte » se mesure des deux
 * côtés : la souris (`pointer-events`) et le clavier (`disabled`). Il en
 * manquait un dans le premier jet — une rangée de boutons muets accessible à
 * la tabulation.
 */
{
  const pas = await nav.newPage();
  pas.on('pageerror', (e) => erreurs.push(e.message));
  await pas.setViewport({ width: 400, height: 880 });
  /* TR35 : publié, jamais possédé par ce compte — les cinq possédés sont TR37, TR39,
     TR40, TR32 et MS30. Pris dans le catalogue plutôt qu'écrit en dur, pour que le
     contrôle survive à un catalogue qui bouge. */
  const absent = PUBLIE.find((f) => !COLLECTION.includes(f.id)
    && !PUBLIE.some((x) => x.evo === f.id));
  await pas.goto(`${base}/fanzzy/${absent.id}`, { waitUntil: 'networkidle0' });
  const la = await pas.waitForSelector('.fiche', { timeout: 8000 })
    .then(() => true).catch(() => false);
  check('la fiche d’un Fanzzy non possédé s’affiche', la);

  if (la) {
    const e = await pas.evaluate(() => {
      const f = document.querySelector('.fiche');
      const art = document.querySelector('.fiche .art');
      const rangs = document.querySelector('.fiche .rangs');
      const cases = [...document.querySelectorAll('.fiche .case')];
      return {
        marquee: f.classList.contains('pas-a-moi'),
        // Le même gris que la grille : ce doit être reconnaissable comme le
        // même état, pas comme un défaut d'affichage.
        gris: getComputedStyle(art).filter,
        rangsInertes: getComputedStyle(rangs).pointerEvents === 'none',
        casesMortes: cases.length > 0 && cases.every((c) => c.disabled),
        auClavier: cases.every((c) => c.tabIndex < 0),
        // Le cri ne se crie pas : c'était le seul élément qui répondait encore
        // sur une carte éteinte.
        criBouton: Boolean(document.querySelector('.fiche [data-cri]')),
        // Ce qu'on a le droit de savoir avant de l'avoir reste lisible.
        nom: document.querySelector('.fiche h1')?.textContent ?? '',
        detail: document.querySelector('#fiche-detail')?.textContent ?? '',
        bouton: document.querySelector('.actions .bt')?.textContent ?? '',
      };
    });
    check('elle est marquée comme telle', e.marquee);
    check('le personnage y est gris, comme dans la grille',
      /grayscale/.test(e.gris) || (console.log('        filtre :', e.gris), false));
    check('les rangées ne répondent pas à la souris', e.rangsInertes);
    check('ni au clavier', e.casesMortes && e.auClavier);
    check('le cri n’est plus un bouton', !e.criBouton);
    check('le nom, la famille et la rareté restent lisibles',
      e.nom.trim().length > 3 && /Commune|Rare|Épique|Légendaire/.test(e.nom));
    check('et la fiche dit comment l’obtenir',
      /booster/i.test(e.detail) || (console.log('        dit :', e.detail), false));
    check('en nommant sa série', /LA TRIBUNE|LES |LE |CE QUI/i.test(e.detail)
      || (console.log('        dit :', e.detail), false));
    check('l’action reste « pas encore à toi »', /PAS ENCORE/i.test(e.bouton));
  }
  await pas.close();
}

/* ------------------------------------ la fiche par-dessus le classeur

 * Le même rendu, monté en panneau. Ce qui se joue ici n'est pas l'affichage —
 * il vient d'être éprouvé — mais **la navigation** : la grille reste derrière,
 * l'adresse suit, et le bouton retour du téléphone referme le panneau au lieu
 * de quitter le classeur. C'est tout ce qu'on entend par fluidité, et rien de
 * cela ne se lit dans le code.
 */
{
  const p = await ouvrir();
  await p.evaluate(() => [...document.querySelectorAll('button')]
    .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
  await jusqua(async () => await p.evaluate(() =>
    document.querySelectorAll('#grid .slot').length > 0));

  await p.evaluate(() => document.querySelector('#grid .slot').click());
  const ouverte = await jusqua(async () => await p.evaluate(() =>
    Boolean(document.querySelector('#detail.on .fiche .case'))));
  check('toucher une carte ouvre la fiche par-dessus la grille', ouverte);

  const etat = await p.evaluate(() => ({
    adresse: location.pathname,
    grille: document.querySelectorAll('#grid .slot').length,
    croix: Boolean(document.querySelector('#detail [data-fermer]')),
    fleche: Boolean(document.querySelector('#detail .head a[href="/fanzzy"]')),
  }));
  /* L'adresse suit : elle se partage, se met en favori, et un rechargement
     tombe sur la page complète du même Fanzzy. */
  check('l’adresse devient celle du Fanzzy', /^\/fanzzy\/.+/.test(etat.adresse));
  check('et la grille est toujours là, derrière', etat.grille > 0);
  /* Une croix ici, une flèche sur la page : le geste dit où l'on va. Fermer un
     panneau et revenir en arrière ne sont pas la même chose. */
  check('le panneau se ferme par une croix, pas par une flèche',
    etat.croix && !etat.fleche);

  // Le bouton retour du téléphone referme le panneau.
  await p.goBack();
  await dodo(300);
  const apresRetour = await p.evaluate(() => ({
    ouvert: document.querySelector('#detail')?.classList.contains('on') ?? false,
    adresse: location.pathname,
    grille: document.querySelectorAll('#grid .slot').length,
  }));
  check('le retour arrière referme le panneau', !apresRetour.ouvert);
  check('et ramène à l’adresse du classeur', apresRetour.adresse === '/fanzzy');
  check('sans quitter la grille', apresRetour.grille > 0);

  /* Et en avant : la fiche se rouvre.

     Ce chemin-là ne se voit pas à l'usage courant, et c'est bien pour ça
     qu'il faut l'éprouver — il porte tout le reste. C'est la même branche
     qui rouvre le panneau quand on arrive sur le classeur depuis un lien
     partagé puis un retour arrière. Sans elle, l'adresse affiche un Fanzzy
     et l'écran montre la grille. */
  await p.goForward();
  await dodo(400);
  const apresAvant = await p.evaluate(() => ({
    ouvert: document.querySelector('#detail')?.classList.contains('on') ?? false,
    adresse: location.pathname,
    fiche: Boolean(document.querySelector('#detail .fiche .case')),
  }));
  check('et le bouton suivant la rouvre', apresAvant.ouvert && apresAvant.fiche
    || (console.log('        ouvert :', apresAvant.ouvert, '· fiche :', apresAvant.fiche), false));
  check('à la bonne adresse', apresAvant.adresse.startsWith('/fanzzy/'));
  await p.goBack();
  await dodo(300);

  // Et la croix fait la même chose.
  await p.evaluate(() => document.querySelector('#grid .slot').click());
  await jusqua(async () => await p.evaluate(() =>
    Boolean(document.querySelector('#detail.on .fiche'))));
  await p.evaluate(() => document.querySelector('#detail [data-fermer]').click());
  await dodo(300);
  const apresCroix = await p.evaluate(() => ({
    ouvert: document.querySelector('#detail')?.classList.contains('on') ?? false,
    adresse: location.pathname,
  }));
  check('la croix referme aussi', !apresCroix.ouvert);
  check('et ne laisse pas l’adresse du Fanzzy derrière elle',
    apresCroix.adresse === '/fanzzy'
    || (console.log('        elle laisse :', apresCroix.adresse), false));

  /* Un Fanzzy qu'on ne possede pas ouvre la **meme** fiche. Avant, il changeait
     de page : deux gestes differents pour deux cartes de la meme grille, sans
     que rien ne l'explique.

     On vise un personnage **absent de la collection**, et non le premier
     verrou venu : depuis que la grille montre les trois ages, un verrou est
     le plus souvent un age non atteint d'un personnage qu'on possede — sa
     fiche dit alors tout autre chose, et a juste titre. */
  const ouvert = await p.evaluate((miens) => {
    const c = [...document.querySelectorAll('#grid .slot.locked[data-open]')]
      .find((x) => !miens.includes(x.dataset.open));
    c?.click();
    return Boolean(c);
  }, COLLECTION);
  check('la grille montre un personnage qu on ne possede pas', ouvert);
  const absent = await jusqua(async () => await p.evaluate(() =>
    Boolean(document.querySelector('#detail.on .fiche'))));
  check('une carte qu’on n’a pas ouvre la même fiche', absent);
  check('et elle dit qu’elle n’est pas encore à nous',
    await p.evaluate(() =>
      /pas encore/i.test(document.querySelector('#detail .fiche')?.textContent ?? '')));
  await p.close();
}

/* --------------------------- un catalogue amputé nomme sa cause */

/**
 * Le texte réellement affiché.
 *
 * `body.textContent` inclut le contenu des balises <script> : une recherche
 * de message y trouve la chaîne dans le code source de la page et passe même
 * quand rien n'est affiché. Ce test s'y est laissé prendre.
 */
const texteAffiche = (p) => p.evaluate(() => {
  const corps = document.body.cloneNode(true);
  for (const s of corps.querySelectorAll('script,style')) s.remove();
  return corps.textContent.replace(/\s+/g, ' ');
});

amputer = 'types';
const page2 = await ouvrir({ sansCache: true });
const messageAmputé = await jusqua(async () =>
  /catalogue incomplet/i.test(await texteAffiche(page2)), 6000);
check('un catalogue amputé est refusé en nommant le champ manquant', messageAmputé);
if (!messageAmputé) {
  console.log('    affiché :', (await texteAffiche(page2)).slice(0, 200));
}
check('la grille ne se remplit pas avec un catalogue amputé',
  await page2.evaluate(() => document.querySelectorAll('#grid .slot').length) === 0);
check('et elle explique pourquoi au lieu de rester vide',
  /n\u2019a pas pu charger le catalogue/.test(await texteAffiche(page2)));

/* ------------------------------------------- le menu, seule navigation

 * La barre du bas a disparu, et trois contrôles éprouvaient sa largeur, son
 * centrage et ses sept entrées. Ce qu'ils surveillaient n'existe plus — mais
 * le risque, lui, a seulement changé de place : le menu est désormais la
 * **seule** façon d'aller quelque part, et un menu qui déborde, qui rogne un
 * libellé ou qui oublie une destination laisse le joueur enfermé.
 *
 * Trois cent vingt pixels — un iPhone SE — restent le cas dur.
 */
{
  const petit = await nav.newPage();
  petit.on('pageerror', (e) => erreurs.push(e.message));
  await petit.setViewport({ width: 320, height: 640 });
  await petit.goto(base + '/fanzzy', { waitUntil: 'networkidle0' });
  await petit.waitForSelector('.tbf-burger', { timeout: 6000 }).catch(() => {});

  check('la barre du bas a bien disparu',
    await petit.evaluate(() => !document.getElementById('tbf-nav')));
  check('et le bouton de menu la remplace',
    await petit.evaluate(() => Boolean(document.querySelector('.tbf-burger'))));

  await petit.click('.tbf-burger');
  await petit.evaluate(() => new Promise((r) => setTimeout(r, 300)));

  const menu = await petit.evaluate(() => {
    const t = document.getElementById('tbf-tiroir');
    if (!t) return null;
    const liens = [...t.querySelectorAll('a')];
    const r = t.getBoundingClientRect();
    return {
      ouvert: t.classList.contains('on'),
      href: liens.map((a) => a.getAttribute('href')),
      debordePage: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      sortDeLEcran: r.left < 0 || r.right > innerWidth + 1,
      rognes: liens.filter((a) => a.scrollWidth > a.clientWidth + 1).map((a) => a.textContent.trim()),
    };
  });

  check('le menu s’ouvre', menu?.ouvert === true);

  /* Le KOP est au centre du jeu, et il n'était accessible que par un second
     menu. C'est la demande explicite : il doit être là. */
  check('le menu mène au KOP', (menu?.href ?? []).includes('/kop'));

  /* Et à tout le reste : un menu unique qui oublie une destination enferme,
     puisqu'il n'y a plus de barre pour rattraper. On les nomme une par une —
     un simple compte laisserait passer un remplacement. */
  for (const [href, nom] of [['/', 'l’accueil'], ['/virage', 'au Virage'],
    ['/duel-nvn', 'au duel'], ['/deck', 'au deck'], ['/fanzzy', 'au classeur'],
    ['/carnet', 'au carnet'], ['/amis', 'aux amis'], ['/matchs', 'aux matchs'],
    ['/equipes', 'aux clubs'], ['/teletext', 'au télétexte'],
    ['/classement', 'au classement'], ['/profil', 'au profil']]) {
    check(`le menu mène ${nom}`, (menu?.href ?? []).includes(href));
  }

  check('il tient dans 320 px sans déborder',
    menu?.debordePage === false && menu?.sortDeLEcran === false);
  check('aucun libellé du menu n’est rogné', (menu?.rognes ?? []).length === 0);
  if (menu?.rognes?.length) console.log('   rognés :', menu.rognes);
  await petit.close();
}

/* Et sur un grand écran, le menu reste accroché à la colonne plutôt que de
   partir au bord de la fenêtre : c'est ce que faisait déjà la barre, pour la
   même raison — un menu à seize cents pixels d'une colonne de quatre cent
   quarante n'appartient plus à la page qu'il sert. */
{
  const grand = await nav.newPage();
  grand.on('pageerror', (e) => erreurs.push(e.message));
  await grand.setViewport({ width: 1200, height: 900 });
  await grand.goto(base + '/fanzzy', { waitUntil: 'networkidle0' });
  await grand.waitForSelector('.tbf-burger', { timeout: 6000 }).catch(() => {});
  await grand.click('.tbf-burger');
  await grand.evaluate(() => new Promise((r) => setTimeout(r, 300)));

  const m = await grand.evaluate(() => {
    const t = document.getElementById('tbf-tiroir').getBoundingClientRect();
    const c = document.getElementById('app').getBoundingClientRect();
    return { droiteMenu: t.right, droiteColonne: c.right, ecran: innerWidth,
             colonne: c.width };
  });
  check('sur un grand écran, le menu reste contre la colonne',
    Math.abs(m.droiteMenu - m.droiteColonne) <= 14
    || (console.log(`        menu à ${Math.round(m.droiteMenu)} px, `
      + `colonne à ${Math.round(m.droiteColonne)} px`), false));
  /* Le contrôle qui rend le précédent honnête : sur cet écran-là, la colonne
     est bien plus étroite que la fenêtre. Sans ça, « menu = colonne »
     resterait vrai d'un menu collé au bord d'une colonne pleine largeur. */
  check('et l’écran était bien plus large qu’elle', m.ecran > m.colonne + 200);
  if (process.env.CAPTURE) {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    await grand.screenshot({ path: join(tmpdir(), 'fanzzy-large.png') });
  }
  await grand.close();
}

/* ------------------------------------------------ trouver la boutique

 * Elle était servie sur /boutique depuis qu'elle a été écrite, et rangée dans
 * le menu accordéon au milieu de treize entrées : c'est-à-dire nulle part.
 * Personne n'ouvre un menu pour découvrir qu'une boutique existe — on l'ouvre
 * quand on sait déjà ce qu'on y cherche.
 *
 * Toucher sa monnaie est le geste que tout joueur essaie en premier. Les deux
 * jetons de la barre commune étaient des div inertes.
 */
{
  /* La barre porte trois choses : de quoi sortir, le nom de l'écran, le menu.

     Elle en portait cinq — l'avatar avec le pseudo et le club, deux jetons de
     monnaie — qui se disputaient trois cent soixante pixels sans jamais dire
     **où l'on est**, qui est la seule chose qu'on demande à une barre.

     Les contrôles des jetons ne sont pas effacés, ils sont remplacés par ce qui
     les remplace : ce qu'ils défendaient n'était pas « il y a deux jetons »,
     c'était « la boutique est atteignable ». Elle l'est par la tuile de
     l'accueil et par le menu. */
  const barre = await page.evaluate(() => {
    const h = document.querySelector('.tbf-haut');
    if (!h) return null;
    return {
      retour: Boolean(h.querySelector('.tbf-retour')),
      ou: h.querySelector('.tbf-ou')?.textContent.trim() ?? '',
      menu: Boolean(h.querySelector('.tbf-burger')),
      // Ce qui n'a plus rien à y faire.
      restes: ['.tbf-jeton', '.tbf-moi'].filter((sel) => h.querySelector(sel)),
    };
  });

  check('la barre dit ou l\u2019on est', barre?.ou === 'Fanzzy'
    || (console.log('        titre vu :', JSON.stringify(barre?.ou)), false));
  check('et elle offre de sortir', barre?.retour === true);
  check('le menu reste atteignable', barre?.menu === true);
  check('ni pseudo ni jeton n\u2019encombrent plus la barre',
    (barre?.restes.length ?? 1) === 0
    || (console.log('        restes :', barre.restes.join(', ')), false));
}

/* ------------------------------------------- le personnage est vivant

 * Il respirait, et c'est tout : une boucle unique de trois secondes six.
 * L'œil apprend ça en dix secondes, et le personnage redevient une image
 * fixe avec un défaut de compression.
 *
 * Ce qu'on éprouve ici n'est pas « ça bouge » — une capture d'écran ne dira
 * jamais ça. C'est ce qui décide que ça bouge : la pile de calques, la mise
 * en sommeil, et la réponse au toucher.
 */
{
  await page.evaluate(() => document.querySelector('[data-go="equipe"]')?.click());
  await new Promise((r) => setTimeout(r, 400));

  const pile = await page.evaluate(() => {
    const sc = document.querySelector('.tbf-scene');
    if (!sc) return null;
    const vie = sc.querySelector('.tbf-vie');
    const souffle = sc.querySelector('.tbf-souffle');
    const nom = (el) => (el ? getComputedStyle(el).animationName : null);
    return {
      aVie: Boolean(vie),
      /* Le calque de vie doit **contenir** celui de la respiration. S'ils
         étaient frères, ou pire le même élément, le geste de repos effacerait
         le souffle — définitivement, et sans rien casser d'autre. */
      enveloppe: Boolean(vie && souffle && vie.contains(souffle) && vie !== souffle),
      animSouffle: nom(souffle),
      animVie: nom(vie),
      poses: sc.querySelectorAll('.tbf-pose').length,
    };
  });

  check('la scène porte un calque de vie', pile?.aVie === true);
  check('il enveloppe la respiration au lieu de la remplacer', pile?.enveloppe === true);
  check('la respiration tourne toujours sur son propre calque',
    pile?.animSouffle === 'tbf-souffle'
    || (console.log('        animation du souffle :', pile?.animSouffle), false));
  check('et le calque de vie est libre entre deux gestes', pile?.animVie === 'none');
  check('les deux poses sont toujours là', pile?.poses === 2);

  /* Le repos passe par la même mécanique que les autres gestes : une classe
     posée sur la scène, retirée à la fin de son animation nommée. On la pose
     à la main plutôt que d'attendre le tirage — entre cinq et douze secondes,
     une suite ne peut pas se le permettre, et ce n'est pas le hasard qu'on
     éprouve ici, c'est que le geste existe et qu'il anime le bon calque. */
  const gestes = await page.evaluate(async () => {
    const sc = document.querySelector('.tbf-scene');
    const vie = sc.querySelector('.tbf-vie');
    const vus = [];
    for (const g of ['vie1', 'vie2', 'vie3']) {
      sc.classList.add(g);
      await new Promise((r) => setTimeout(r, 30));
      vus.push(getComputedStyle(vie).animationName);
      sc.classList.remove(g);
    }
    return vus;
  });
  check('les trois gestes de repos animent le calque de vie',
    JSON.stringify(gestes) === JSON.stringify(['tbf-vie1', 'tbf-vie2', 'tbf-vie3'])
    || (console.log('        vu :', gestes.join(', ')), false));

  /* Le sommeil. C'est là que se gagne la fluidité, bien plus que dans le
     poids des images : le navigateur ralentit les minuteries d'un onglet
     caché, il ne ralentit pas une animation composée — elle continue donc de
     faire tourner le compositeur pour personne. */
  const sommeil = await page.evaluate(async () => {
    const sc = document.querySelector('.tbf-scene');
    const souffle = sc.querySelector('.tbf-souffle');
    const etat = () => getComputedStyle(souffle).animationPlayState;
    const avant = etat();
    sc.classList.add('dort');
    await new Promise((r) => setTimeout(r, 30));
    const pendant = etat();
    sc.classList.remove('dort');
    await new Promise((r) => setTimeout(r, 30));
    return { avant, pendant, apres: etat() };
  });
  check('éveillée, la scène respire', sommeil?.avant === 'running');
  check('endormie, la respiration se met en pause',
    sommeil?.pendant === 'paused'
    || (console.log('        état pendant le sommeil :', sommeil?.pendant), false));
  check('et elle repart au réveil', sommeil?.apres === 'running');

  /* La réponse au toucher n'est allumée que sur cet écran : c'est celui du
     personnage. Dans le Virage la même zone sert à chanter, et un saut non
     demandé au milieu d'un chant se lit comme un défaut. */
  const touche = await page.evaluate(async () => {
    const sc = document.querySelector('.tbf-scene');
    sc.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    const saut = sc.querySelector('.tbf-saut');
    return { classe: sc.classList.contains('saute'),
      anim: getComputedStyle(saut).animationName, doigt: getComputedStyle(sc).cursor,
      bascule: getComputedStyle(sc.querySelector('.tbf-change')).animationName };
  });
  check('toucher le personnage le fait réagir', touche?.classe === true);
  /* La bascule du changement de pose partageait ce calque, et comme sa règle
     vient plus bas dans la feuille, c'est elle qui gagnait : un saut demandé
     juste après un changement de pose n'existait pas. */
  check('et c’est bien le saut qui part, pas la bascule du changement de pose',
    touche?.anim === 'tbf-saut'
    || (console.log('        animation vue :', touche?.anim), false));
  check('l’écran dit qu’on peut le toucher', touche?.doigt === 'pointer');
}

if (process.env.CAPTURE) {
  // Dossier temporaire du système : « /tmp » en dur ne marche pas sous Windows.
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  // On bascule sur le classeur : c'est la grille de cartes qu'on veut voir,
  // pas le kiosque où le test s'arrête.
  await page.evaluate(() => [...document.querySelectorAll('button,[data-tab],[data-onglet]')]
    .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
  await pause(500);
  await page.screenshot({ path: join(tmpdir(), 'classeur.png'), fullPage: true });

  // Et la fiche de détail, l'écran dont les cadres pesaient le plus.
  // La grille ouvre par `data-open`, et seulement pour un Fanzzy possédé :
  // les autres mènent directement à la fiche complète.
  // La grille est `#grid`, et elle n'ouvre l'aperçu que pour un Fanzzy
  // possédé : les autres mènent directement à la fiche complète.
  // Le premier de la grille est un Fanzzy possédé — le classeur les met en
  // tête —, donc il ouvre l'aperçu plutôt que la fiche complète.
  await page.evaluate(() => document.querySelector('#grid [data-open]')?.click());
  await pause(500);
  await page.screenshot({ path: join(tmpdir(), 'classeur-detail.png') });
  console.log(`   captures : ${join(tmpdir(), 'classeur.png')}`);
}

/* ------------------------------------------- personne n’a jeté en chemin

 * `erreurs` se remplit depuis huit pages, et une seule ligne la regardait —
 * tout en haut, avant que la plupart n'existent. Tout ce qui tombait ensuite
 * était collecté puis oublié.
 *
 * C'est ainsi qu'un `ReferenceError` dans l'écouteur du bouton « EMMENER EN
 * DUEL » a vécu : une exception dans un écouteur ne remonte à personne, la
 * page continue, et le bouton ne fait simplement rien. Le seul témoin était
 * cette liste, que rien ne lisait. */
check('aucune page n’a jeté d’erreur de script', erreurs.length === 0
  || (console.log('       ', erreurs.slice(0, 5)), false));

await nav.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
