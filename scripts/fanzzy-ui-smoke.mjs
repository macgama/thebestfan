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
await raw.query(`DROP TABLE IF EXISTS parrainages, contenus, abonnements, achats, kop_invites, amities, saisons, reglages, admin_audit,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
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
                 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'stades.sql',
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

/* ============ dans le classeur : un premier âge se montre, une évolution se cache

   Les deux cases sont grises, et elles ne demandent pas le même geste.

   Un personnage qu'on n'a pas se **tire** dans un booster : le voir en ombre
   donne envie de l'ouvrir, et c'est tout le ressort du genre. Ses âges
   supérieurs ne se tirent pas — ils s'**achètent** en écharpes, sur un
   personnage qu'on possède déjà. Les montrer revient à donner d'avance la seule
   chose qu'on paie, exactement comme le faisait la fiche avant qu'on la
   corrige.

   Le flou, donc, et pas la case vide : on garde la carrure et la lumière. */
{
  const cases = await page.evaluate(() => {
    const l = [...document.querySelectorAll('.slot.locked')];
    return {
      total: l.length,
      /* L'étoile dit l'âge : une pour le deuxième, deux pour le troisième.
         C'est la seule marque lisible depuis le DOM de la grille. */
      premiers: l.filter((n) => !n.querySelector('.stade')).length,
      superieurs: l.filter((n) => n.querySelector('.stade')).length,
      premiersFloutes: l.filter((n) => !n.querySelector('.stade')
        && n.classList.contains('secret')).length,
      superieursFloutes: l.filter((n) => n.querySelector('.stade')
        && n.classList.contains('secret')).length,
      /* On lit le filtre calculé, pas la classe : c'est lui qui décide de ce
         qu'on voit, et une feuille de style renommée le dirait aussitôt. */
      flouReel: (() => {
        const n = l.find((x) => x.classList.contains('secret'))?.querySelector('.art');
        return n ? getComputedStyle(n).filter : null;
      })(),
    };
  });

  check(`le classeur montre des cases verrouillées (${cases.total})`, cases.total > 0);
  check(`un premier âge reste en ombre, sans flou (${cases.premiers})`,
    cases.premiersFloutes === 0
    || (console.log('        floutés :', cases.premiersFloutes, 'sur', cases.premiers), false));
  check(`un âge supérieur non acheté est flouté (${cases.superieurs})`,
    cases.superieurs === 0 || cases.superieursFloutes === cases.superieurs
    || (console.log('        floutés :', cases.superieursFloutes, 'sur', cases.superieurs), false));
  check('et le flou est bien appliqué, pas seulement annoncé',
    cases.superieurs === 0 || /blur\(/.test(cases.flouReel ?? '')
    || (console.log('        filtre :', cases.flouReel), false));
}
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

  /* ================ le bouton d'évolution est là **en arrivant**

     Il ne l'était pas. L'action était accrochée à la seule case de l'âge
     suivant, alors que la case regardée à l'ouverture est l'âge actuel : un
     joueur ouvrait la fiche d'une commune qu'il voulait faire grandir et n'y
     trouvait aucun bouton. Il lui fallait deviner qu'un losange plus loin dans
     la rangée le ferait apparaître.

     Rien ne rougissait : la suite ne regardait le bouton d'action qu'**après**
     avoir cliqué une case, et il était bien là. Le contrôle mesure donc
     maintenant ce que voit quelqu'un qui n'a rien touché — c'est-à-dire tout
     le monde, la première seconde. */
  if (prete) {
    const ouverture = await fiche.evaluate(() => {
      const bt = document.querySelector('#fiche-actions [data-evoluer]');
      return {
        evoluer: Boolean(bt),
        libelle: bt ? (bt.textContent || '').replace(/\s+/g, ' ').trim() : null,
        choisie: document.querySelector('.case.choisie')?.textContent
          .replace(/\s+/g, ' ').trim().slice(0, 40) ?? null,
        touche: false,
      };
    });
    check('le bouton d’évolution est visible sans toucher une case',
      ouverture.evoluer
      || (console.log('        la case regardée est « ', ouverture.choisie,
        ' » et aucun bouton d’évolution n’est proposé'), false));
    /* Et il dit **lequel des deux états** il est : une promesse, ou ce qu'il
       manque. Un bouton présent mais muet ne vaut pas mieux qu'un bouton
       absent — c'est la règle déjà tenue plus bas, pour le cas de la bourse
       vide. */
    check(`et il dit ce qu’il propose (${ouverture.libelle})`,
      /ÉVOLUER|IL TE FAUT/.test(ouverture.libelle ?? '')
      || (console.log('        il dit :', ouverture.libelle), false));
  }

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
    check('les quatre rangées de cases sont là',
      /* L'ordre compte : la bande défile, et les tenues sont trop nombreuses
         pour tenir avant les effets. Placées au milieu, elles les repoussaient
         hors de l'écran.

         Les états s'insèrent **avant** elles pour la même raison : ils sont
         quatre, toujours, donc ils ne repoussent rien. Et ils viennent après
         les effets parce que ce qui change le jeu se lit avant ce qui se
         voit — un état ne donne aucun bonus, c'est même toute sa règle. */
      m.rangs.join('/') === 'ÂGES/EFFETS/ÉTATS/TENUES'
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

    /* ================================ la fiche sur un vrai téléphone

       Tout ce qui précède est mesuré sur une fenêtre de huit cent quatre-vingts
       pixels de haut. **Aucun téléphone n'a ça.** Un iPhone SE offre six cent
       soixante-sept pixels, moins la barre d'adresse : autour de cinq cent
       soixante utilisables. Un Android d'entrée de gamme fait à peine mieux.

       Et la fiche est un écran **sans défilement** — `#app` est en `height:
       100dvh` avec `overflow:hidden`. C'est voulu : elle doit tenir d'un coup
       d'œil. Mais ça veut dire que ce qui déborde n'est pas repoussé plus bas,
       il est **coupé**, et un bouton coupé n'existe pas. Le joueur ne le voit
       pas, ne peut pas défiler pour le trouver, et conclut que sa carte ne peut
       pas évoluer.

       On mesure donc aux hauteurs qui existent vraiment, et on regarde la seule
       chose qui compte : le bouton est-il **entièrement** dans l'écran. */
    for (const [w, h, quoi] of [[360, 640, 'petit Android'],
      [375, 560, 'iPhone SE, barre comprise'], [390, 664, 'iPhone 14, barre comprise']]) {
      await fiche.setViewport({ width: w, height: h });
      await dodo(260);
      const p = await fiche.evaluate(() => {
        const bt = document.querySelector('.actions .bt') ?? document.querySelector('.actions > *');
        const r = bt?.getBoundingClientRect();
        const app = document.getElementById('app').getBoundingClientRect();
        return {
          trouve: Boolean(r),
          bas: r ? Math.round(r.bottom) : null,
          haut: r ? Math.round(r.top) : null,
          ecran: innerHeight,
          coupeDeApp: r ? Math.round(r.bottom - app.bottom) : null,
        };
      });
      check(`${quoi} (${w}×${h}) : la fiche garde un bouton`, p.trouve
        || (console.log('        aucun bouton dans .actions'), false));
      if (!p.trouve) continue;
      check(`${quoi} : le bouton est entier dans l’écran `
        + `(bas à ${p.bas} sur ${p.ecran})`,
        p.bas <= p.ecran + 1
        || (console.log(`        il dépasse de ${p.bas - p.ecran} px `
          + `— et la fiche ne défile pas, donc il est perdu`), false));
    }
    /* ============ et la fiche quand `--nav-h` n'a pas encore été déclarée

       Toutes les mesures ci-dessus tournent avec nav.js chargé, donc avec
       `--nav-h` à zéro. Elles étaient vertes pendant qu'un joueur
       photographiait ses boutons coupés.

       `#app` réserve `calc(var(--nav-h,62px) + env(safe-area-inset-bottom))`
       en bas. La variable n'était déclarée que par nav.js, dans une feuille
       injectée à l'exécution : avant que ce script différé ne tourne — et
       pour toujours si nav.js échoue ou sort avant, ce qu'il fait sur trois
       pages — le repli de **soixante-deux pixels** s'applique.

       Sur neuf cents pixels de haut, invisible. Sur six cent soixante, c'est
       la rangée d'actions qui passe sous la coupe.

       On refuse donc nav.js au réseau : c'est la panne telle qu'elle arrive,
       et c'est le seul moyen de mesurer ce que voit la première image. */
    {
      const ctx = await nav.createBrowserContext();
      const p = await ctx.newPage();
      await p.setViewport({ width: 390, height: 664 });
      await ctx.setCookie({ name: 'tbf_test', value: U, domain: 'localhost', path: '/' });
      await p.setRequestInterception(true);
      p.on('request', (r) => (/\/nav\.js/.test(r.url()) ? r.abort() : r.continue()));
      await p.goto(`${base}/fanzzy/${ILLUSTRE}`, { waitUntil: 'networkidle0' });
      await p.waitForSelector('.fiche .case', { timeout: 8000 }).catch(() => null);
      await dodo(300);

      const m = await p.evaluate(() => {
        const app = document.getElementById('app');
        const bt = document.querySelector('.actions .bt');
        const r = bt?.getBoundingClientRect();
        const ar = app.getBoundingClientRect();
        return {
          trouve: Boolean(r),
          bas: r ? Math.round(r.bottom) : null,
          borne: Math.round(ar.bottom - parseFloat(getComputedStyle(app).paddingBottom)),
          navh: getComputedStyle(document.documentElement)
            .getPropertyValue('--nav-h').trim() || '(non déclarée)',
        };
      });

      check(`sans nav.js, --nav-h vaut quand même zéro (${m.navh})`,
        m.navh === '0px'
        || (console.log('        elle vaut', m.navh, '— le repli de 62px s’applique'), false));
      check('sans nav.js, la fiche garde sa rangée d’actions', m.trouve
        || (console.log('        plus aucun bouton'), false));
      if (m.trouve) {
        check(`et le bouton tient entier au-dessus de la coupe (${m.bas}/${m.borne})`,
          m.bas <= m.borne + 1
          || (console.log(`        il dépasse de ${m.bas - m.borne} px`), false));
      }
      await ctx.close();
    }
    /* ================== et maintenant, la fiche sur un vrai téléphone

       Les trois mesures ci-dessus tournent dans un navigateur sans châssis,
       et c'est pour ça qu'elles étaient vertes pendant qu'un joueur
       photographiait sa fiche sans aucun bouton. Trois hauteurs manquaient à
       l'appel, et aucune ne se voit sur un écran d'ordinateur :

         — **l'encoche**. `.tbf-haut` se rembourre de
           `env(safe-area-inset-top)` : une trentaine de pixels sur un
           téléphone récent, zéro ici.
         — **la barre gestuelle**. `#app` réserve
           `env(safe-area-inset-bottom)` en bas, autant, et zéro ici.
         — **le bandeau d'annonce**, que nav.js insère dans `#app` quand
           l'administration en a écrit une. La base de test n'en a jamais ;
           une base en service en a presque toujours.

       Cent pixels, contre la dizaine de marge que les mesures d'au-dessus
       constataient. C'est tout l'écart entre une suite verte et une fiche
       tronquée.

       On ne peut pas donner une encoche à un navigateur sans écran. On pose
       donc les trois hauteurs à la main, là où elles arriveraient. Ce qu'on
       éprouve n'est pas le téléphone : c'est la **tolérance de la mise en
       page** à ce qu'on lui reprenne cent pixels — et c'est le seul
       invariant qu'une suite puisse tenir. */
    for (const [w, h, haut, bas, annonce, quoi] of [
      [390, 664, 47, 34, true, 'iPhone 14, encoche, barre et annonce'],
      [360, 640, 24, 24, true, 'Android à gestes, avec annonce'],
      [375, 560, 20, 21, false, 'iPhone SE, sans annonce'],
    ]) {
      await fiche.setViewport({ width: w, height: h });
      await fiche.evaluate((c) => {
        let s = document.getElementById('tbf-chassis');
        if (!s) { s = document.createElement('style'); s.id = 'tbf-chassis';
          document.head.appendChild(s); }
        s.textContent = `#app{padding-bottom:calc(var(--nav-h,62px) + ${c.bas}px) !important}`
          + `.tbf-haut{padding-top:${c.haut + 10}px !important}`;
        /* Le bandeau tel que nav.js le pose : dans `#app`, juste après la
           barre du haut. On reprend sa classe, donc ses vraies marges. */
        document.getElementById('tbf-annonce-faux')?.remove();
        if (c.annonce) {
          const b = document.createElement('div');
          b.id = 'tbf-annonce-faux';
          b.className = 'tbf-annonce ton-info';
          b.textContent = 'La saison LA REPRISE est ouverte.';
          document.querySelector('.tbf-haut').after(b);
        }
      }, { haut, bas, annonce });
      await dodo(300);
      const p = await fiche.evaluate(() => {
        const bt = document.querySelector('.actions .bt') ?? document.querySelector('.actions > *');
        const r = bt?.getBoundingClientRect();
        const app = document.getElementById('app');
        const ar = app.getBoundingClientRect();
        /* La borne n'est pas l'écran mais **le bas du contenu de `#app`** :
           c'est lui qui coupe, puisque `#app` est en `overflow:hidden`. */
        return { trouve: Boolean(r), haut: r ? Math.round(r.top) : null,
          bas: r ? Math.round(r.bottom) : null,
          borne: Math.round(ar.bottom - parseFloat(getComputedStyle(app).paddingBottom)) };
      });
      check(`${quoi} : la rangée d’actions existe encore`, p.trouve
        || (console.log('        plus aucun bouton dans .actions'), false));
      if (!p.trouve) continue;
      /* **Le contrôle qui porte.** Entier, pas « presque » : un bouton dont
         il reste trois pixels ne se touche pas et ne se lit pas. */
      /* De quoi regarder la fiche telle qu'un joueur la voit, le jour où une
         capture d'écran contredit une suite verte. */
      if (process.env.CAPTURE) {
        await fiche.screenshot({ path: `${process.env.TEMP ?? "/tmp"}/fiche-${w}x${h}.png` });
      }
      check(`${quoi} : le bouton tient entier au-dessus de la coupe`,
        p.bas <= p.borne + 1 && p.haut >= -1
        || (console.log(`        il dépasse de ${p.bas - p.borne} px sous la coupe`), false));
      /* ============ et les trois textes de la vitrine ne se touchent pas

         La vitrine est le **seul** élément souple de la colonne : elle
         encaissait donc seule tout ce qu'un téléphone reprend à la page. À
         cent vingt pixels elle ne tenait plus rien, et les trois textes
         posés dessus se rejoignaient — le nom en grand, la phrase « fais-le
         grandir pour le découvrir » placée au milieu de la silhouette, et la
         ligne des exemplaires. Trois textes l'un sur l'autre.

         C'est un défaut qui ne casse rien et que rien ne signale : la page
         se charge, les boutons répondent, et le joueur lit une bouillie.
         Aucune mesure de bouton ne pouvait le voir.

         On compare donc les rectangles, et non les hauteurs : c'est le
         chevauchement qu'on interdit, pas une valeur qu'on aurait choisie. */
      const chevauche = await fiche.evaluate(() => {
        const mot = document.querySelector('.art .secret-mot');
        const txt = document.querySelector('.vitrine .txt');
        if (!mot || !txt) return null;
        const a = mot.getBoundingClientRect();
        const b = txt.getBoundingClientRect();
        return { sur: a.bottom > b.top + 1, de: Math.round(a.bottom - b.top),
          vitrine: Math.round(document.querySelector('.vitrine').getBoundingClientRect().height) };
      });
      if (chevauche) {
        check(`${quoi} : la phrase ne tombe pas dans le nom du Fanzzy`,
          chevauche.sur === false
          || (console.log(`        elle mord de ${chevauche.de} px, vitrine à `
            + `${chevauche.vitrine} px de haut`), false));
      }

      /* Et la bande des rangées dit qu'elle continue. Sur ces largeurs elle
         déborde toujours : une case coupée sans un mot se lit comme cassée. */
      const bande = await fiche.evaluate(() => {
        const b = document.querySelector('.rangs');
        if (!b) return null;
        return { deborde: b.scrollWidth - b.clientWidth > 2,
          dit: b.classList.contains('deborde') };
      });
      if (bande?.deborde) {
        check(`${quoi} : la bande des rangées annonce sa suite`, bande.dit
          || (console.log('        elle déborde sans aucune ombre au bord'), false));
      }
    }
    await fiche.evaluate(() => {
      document.getElementById('tbf-chassis')?.remove();
      document.getElementById('tbf-annonce-faux')?.remove();
    });

    await fiche.setViewport({ width: 400, height: 880 });
    await dodo(200);

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

    /* ============================ le prix se lit avant le clic, pas après

       **La fiche proposait ÉVOLUER sans jamais savoir si le joueur pouvait
       payer.** On ouvrait le panneau, on confirmait, et le refus arrivait au
       troisième geste sous la forme d'un petit message — qui ne disait pas
       combien il manquait, donc pas ce qu'il fallait aller faire.

       C'est la faute du bouton d'ouverture du kiosque, au même endroit de la
       boucle : une affordance montrée quand elle ne sert pas. Le contrôle part
       donc d'une bourse vide, qui est l'état de n'importe qui après deux
       évolutions. */
    {
      const lire = () => fiche.evaluate(() => {
        const b = document.querySelector('[data-evoluer]');
        return b ? { ferme: b.disabled, texte: b.textContent.replace(/\s+/g, ' ').trim() } : null;
      });

      // On revient sur l'âge courant : les cases touchées plus haut l'ont peut-être
      // déplacé, et le bouton d'évolution n'existe que sur l'âge juste après.
      await fiche.evaluate(() => {
        const cases = [...document.querySelectorAll('[data-case^="age:"]')];
        (cases[1] ?? cases[0])?.click();
      });
      const riche = await lire();
      check('avec des écharpes en poche, le bouton propose d’évoluer',
        riche && !riche.ferme && /ÉVOLUER/.test(riche.texte)
        || (console.log('        il dit :', JSON.stringify(riche)), false));

      await pool.query('UPDATE user_wallet SET scarves = 0 WHERE user_id = ?', [U]);
      await fiche.reload({ waitUntil: 'networkidle0' });
      await fiche.evaluate(() => {
        const cases = [...document.querySelectorAll('[data-case^="age:"]')];
        (cases[1] ?? cases[0])?.click();
      });
      const pauvre = await lire();
      check('sans écharpes, il se ferme', pauvre?.ferme === true
        || (console.log('        il dit :', JSON.stringify(pauvre)), false));
      check('et il dit combien il en manque',
        pauvre && /IL TE FAUT/.test(pauvre.texte) && /\d+ écharpes/.test(pauvre.texte)
        || (console.log('        il dit :', pauvre?.texte), false));

      await pool.query('UPDATE user_wallet SET scarves = 900 WHERE user_id = ?', [U]);
      await fiche.reload({ waitUntil: 'networkidle0' });

      /* --------------------------- et on évolue pour de vrai

         Les contrôles du dessus éprouvent le bouton et la mécanique de la
         cérémonie séparément. Celui-ci fait le geste entier — confirmer, payer,
         recharger, jouer l'arrivée — parce que c'est là que les trois se
         rencontrent, et que rien n'y était éprouvé : la cérémonie rend la main
         au milieu, `recharger` reconstruit la fiche, et l'élément sur lequel
         jouer l'arrivée n'existe pas encore au moment où on l'attend. Une
         promesse qui ne se résout jamais laisserait un écran figé, sans une
         seule erreur dans la console. */
      const avantEvo = await pool.query(
        'SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?',
        [U, ILLUSTRE]).then(([r]) => Number(r[0]?.stage ?? 0));

      await fiche.evaluate(() => {
        const cases = [...document.querySelectorAll('[data-case^="age:"]')];
        (cases[1] ?? cases[0])?.click();
      });
      const aBouton = await fiche.evaluate(() => {
        const b = document.querySelector('[data-evoluer]');
        if (!b || b.disabled) return false;
        b.click();
        return true;
      });

      if (!aBouton) {
        console.log('  --   ce Fanzzy est déjà au dernier âge : évolution sautée');
      } else {
        await new Promise((r) => setTimeout(r, 200));
        await fiche.evaluate(() => document.querySelector('[data-oui]')?.click());

        /* Deux secondes et demie : une charge d'une seconde, le rechargement,
           puis l'attente du dessin. On sort dès que le stade a bougé plutôt que
           d'attendre le plafond — un contrôle qui dort toujours la même durée
           finit par dormir moins longtemps que la machine la plus lente. */
        let apresEvo = avantEvo;
        for (let i = 0; i < 50 && apresEvo === avantEvo; i++) {
          await new Promise((r) => setTimeout(r, 50));
          apresEvo = await pool.query(
            'SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?',
            [U, ILLUSTRE]).then(([r]) => Number(r[0]?.stage ?? 0));
        }
        check(`évoluer fait vraiment grandir le Fanzzy (${avantEvo} → ${apresEvo})`,
          apresEvo === avantEvo + 1);

        /* La cérémonie doit **finir** : le dessin revient, l'arrivée se joue
           dessus, et la fiche se laisse toucher de nouveau. Un écran qui reste
           blanc après un paiement est la pire panne possible ici. */
        const fini = await fiche.waitForFunction(
          () => document.querySelector('#fiche-art img, #fiche-art svg') !== null,
          { timeout: 4000 }).then(() => true).catch(() => false);
        check('et la vitrine remontre le personnage après la cérémonie', fini);
        check('sans rien jeter en chemin', erreurs.length === 0
          || (console.log('        ', erreurs.slice(0, 2).join(' | ')), false));

        await pool.query('UPDATE user_fanzzy SET stage = ? WHERE user_id = ? AND fanzzy_id = ?',
          [avantEvo, U, ILLUSTRE]);
        await pool.query('UPDATE user_wallet SET scarves = 900 WHERE user_id = ?', [U]);
        await fiche.reload({ waitUntil: 'networkidle0' });
      }
    }

    /* ====================== ce qu'on n'a pas encore ne se montre pas

       **Toucher un âge verrouillé le dessinait en grand dans la vitrine.**

       La rangée ÂGES existe pour regarder les trois visages d'une lignée, et
       c'est très bien pour ceux qu'on a payés. Mais elle donnait aussi,
       gratuitement et en pleine taille, le visage de celui qu'on n'a pas —
       c'est-à-dire la seule chose qu'on achète en évoluant. L'évolution n'avait
       plus rien à révéler, et la cérémonie révélait quelque chose de déjà vu.

       Le flou et non l'absence : on garde la silhouette, la carrure et la
       lumière de la rareté, on retire le visage. Une case vide ne donne envie
       de rien. */
    {
      const etat = () => fiche.evaluate(() => {
        const art = document.getElementById('fiche-art');
        return {
          secret: art.classList.contains('secret'),
          mot: art.querySelector('.secret-mot')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
          /* Le décor doit rester **net** : c'est lui qui porte l'aura de
             rareté, et flouter les deux ferait une tache. */
          flouDecor: (() => {
            const d = art.querySelector('svg');
            return d ? getComputedStyle(d).filter : null;
          })(),
        };
      });

      const ages = await fiche.evaluate(() =>
        [...document.querySelectorAll('[data-case^="age:"]')].map((b) => ({
          cle: b.dataset.case,
          verrou: b.classList.contains('verrou'),
          secret: b.classList.contains('secret'),
        })));

      check(`la lignée montre ses âges (${ages.length})`, ages.length > 1);

      const verrouille = ages.find((a) => a.verrou);
      const acquis = ages.find((a) => !a.verrou);

      check('un âge non atteint porte la marque du secret',
        !verrouille || verrouille.secret === true
        || (console.log('        ', JSON.stringify(verrouille)), false));
      check('un âge atteint ne la porte pas',
        !acquis || acquis.secret === false);

      /* Une tenue verrouillée reste nette : on la vise, elle n'a pas de visage
         à révéler, et la flouter ferait une garde-robe illisible pour rien. */
      const tenueFloue = await fiche.evaluate(() =>
        [...document.querySelectorAll('[data-case^="tenue:"]')]
          .some((b) => b.classList.contains('secret')));
      check('mais une tenue verrouillée, elle, reste lisible', tenueFloue === false);

      if (verrouille) {
        await fiche.evaluate((cle) =>
          document.querySelector(`[data-case="${cle}"]`)?.click(), verrouille.cle);
        await new Promise((r) => setTimeout(r, 120));
        const v = await etat();
        check('toucher un âge à venir ne le dévoile pas', v.secret === true);
        check('et l’écran dit que c’est volontaire',
          /ÂGE À VENIR/.test(v.mot ?? '')
          || (console.log('        il dit :', v.mot), false));
        check('le décor, lui, reste net — c’est lui qui porte la rareté',
          !v.flouDecor || v.flouDecor === 'none'
          || (console.log('        filtre :', v.flouDecor), false));
      } else {
        console.log('  --   ce Fanzzy est déjà au dernier âge : secret sauté');
      }

      if (acquis) {
        await fiche.evaluate((cle) =>
          document.querySelector(`[data-case="${cle}"]`)?.click(), acquis.cle);
        await new Promise((r) => setTimeout(r, 120));
        const v = await etat();
        check('revenir sur un âge atteint le remontre en entier', v.secret === false);
        check('et le mot disparaît avec lui', v.mot === null);
      }
    }

    /* ==================================== la rareté se voit dans le décor

       Elle ne se voyait pas. La montée existait — « un projecteur au premier
       âge, trois au troisième » — mais elle suivait l'âge et non la rareté, et
       son amplitude tenait dans quelques centièmes d'opacité. Une commune, une
       rare et une épique se tenaient devant le même fond ; seule la légendaire
       avait sa lumière. Trois quarts du catalogue ne se distinguaient que par
       la couleur d'un liseré, à côté de la carte.

       On compare les quatre décors rendus pour le **même** personnage : seule
       la rareté change, donc toute différence vient d'elle. */
    {
      const fonds = await fiche.evaluate(() =>
        ['commune', 'rare', 'epique', 'legendaire'].map((rar) =>
          window.TBF_FOND.fond({ id: 'TR37', set: 'TR', type: 'voix', stage: 2, rar })));

      check('les quatre raretés rendent quatre décors différents',
        new Set(fonds).size === 4
        || (console.log('        distincts :', new Set(fonds).size), false));

      /* Une commune n'a pas d'aura : c'est le point de départ, et tout le reste
         se mesure à elle. Sans ça, « plus riche » ne veut rien dire. */
      check('la commune n’a pas d’aura', !/id="au/.test(fonds[0])
        || /stop-opacity="0\.000"/.test(fonds[0]));

      /* Chaque palier ajoute des anneaux : c'est ce qui se lit en vignette, là
         où la couleur du ciel est trop fine pour se voir. */
      const anneaux = fonds.map((f) => (f.match(/<circle cx="50" cy="62"/g) ?? []).length);
      check(`et les anneaux montent d'un palier à l'autre (${anneaux.join(' → ')})`,
        anneaux[0] < anneaux[1] && anneaux[1] < anneaux[2] && anneaux[2] < anneaux[3]);

      /* Déterministe, comme tout le module : deux appels pour la même carte
         rendent le même SVG, sinon le fond changerait à chaque rendu — et la
         poussière de l'aura est semée, donc c'est elle qui risquait de bouger. */
      const deux = await fiche.evaluate(() => {
        const f = () => window.TBF_FOND.fond({ id: 'TR37', set: 'TR', type: 'voix',
          stage: 2, rar: 'epique' }).replace(/id="[a-z]+fd\d+"/g, '');
        return [f(), f()];
      });
      check('et l’aura reste la même d’un rendu à l’autre',
        deux[0].replace(/fd\d+/g, '') === deux[1].replace(/fd\d+/g, ''));
    }

    /* ================= le décor peint remplace le lieu, et rien d'autre

       Douze séries sur treize ont un décor **dessiné** : un lieu par série, une
       palette par tenue, une lumière par âge, une aura par rareté. Ça ne coûte
       aucun fichier et une saison neuve en hérite le jour où on l'ajoute.

       LA REPRISE a en plus quatre plaques peintes, une par rareté. Elles ne
       remplacent que le **lieu** : le motif de famille, la lumière et l'aura se
       posent par-dessus, sans quoi une carte peinte et une carte dessinée
       feraient deux collections au lieu d'une.

       Et jamais sous une autre tenue que `base`. Une tenue fait basculer toute
       la palette du décor — c'est ce qui la rend visible de loin, au lieu de se
       chercher sur le costume. Une plaque peinte en fin d'été ne devient pas
       préhistorique. */
    {
      const rendus = await fiche.evaluate(() => {
        const f = (o) => window.TBF_FOND.fond({ id: 'RP1', set: 'RP', type: 'tifo', ...o });
        return {
          peinte: f({ stage: 3, rar: 'epique', skin: 'base' }),
          sansTenue: f({ stage: 3, rar: 'epique' }),
          autreTenue: f({ stage: 3, rar: 'epique', skin: 'prehistorique' }),
          sansPlaque: window.TBF_FOND.fond({ id: 'TR1', set: 'TR', type: 'voix',
            stage: 3, rar: 'epique', skin: 'base' }),
        };
      });

      check('LA REPRISE en tenue de base montre sa plaque peinte',
        /<image href="\/img\/fonds\/RP-epique\./.test(rendus.peinte)
        || (console.log('        ', rendus.peinte.slice(0, 160)), false));
      check('sans tenue nommée, c’est la base, donc la plaque aussi',
        /<image href="\/img\/fonds\/RP-epique\./.test(rendus.sansTenue));

      /* La condition qui compte : une autre époque reprend le décor dessiné,
         dont la palette bascule. C'est aussi la plus facile à perdre au
         prochain remaniement, parce qu'elle ne se voit que sur une tenue. */
      check('mais une autre tenue reprend le décor dessiné',
        !/<image href/.test(rendus.autreTenue)
        || (console.log('        ', rendus.autreTenue.slice(0, 160)), false));
      check('et une série sans plaque garde le sien',
        !/<image href/.test(rendus.sansPlaque));

      /* L'aura et la lumière restent posées par-dessus la plaque : c'est ce qui
         garde les deux sortes de cartes dans le même jeu. */
      check('la plaque ne mange ni l’aura de rareté ni la lumière',
        /url\(#au/.test(rendus.peinte) && /<circle cx="50" cy="62"/.test(rendus.peinte));

      /* Les trois formats, comme partout : `negocierAvif` ne remplace
         l'extension que si le fichier AVIF existe, donc un décor publié en WebP
         seul marcherait — et c'est pour ça qu'on le vérifie ici. */
      const { existsSync } = await import('node:fs');
      const manquants = [];
      for (const r of ['commune', 'rare', 'epique', 'legendaire']) {
        for (const ext of ['.webp', '.avif', '.png']) {
          const f = path.join(RACINE, 'public', 'img', 'fonds', 'RP-' + r + ext);
          if (!existsSync(f)) manquants.push('RP-' + r + ext);
        }
      }
      check('les quatre plaques sont publiées en webp, avif et png',
        !manquants.length
        || (console.log('        manque :', manquants.join(', ')), false));
    }

    /* ======================= la cérémonie d'évolution existe et tient le rythme

       Le geste le plus cher du jeu était le seul sans récompense à l'écran : on
       confirmait, un éclair passait, et le nouveau personnage était là. Rien
       n'avait eu lieu.

       On ne rejoue pas l'animation ici — une suite qui mesure des images
       mesure sa machine. On vérifie ce qui se casse silencieusement : que
       l'effet existe, qu'il rend la main **au flash** et non à la fin, et qu'il
       tienne sans portrait à l'écran, ce qui est le cas du classeur. */
    {
      const ceremonie = await fiche.evaluate(async () => {
        if (!window.FX?.evolution) return { absent: true };
        const t0 = performance.now();
        const suite = await window.FX.evolution(null, { nom: 'Test', rar: 'epique' });
        return { absent: false, ms: performance.now() - t0,
                 rendArrivee: typeof suite?.arrivee === 'function' };
      });
      check('la cérémonie d’évolution existe', ceremonie.absent === false);
      check('elle rend la main avant la fin, pour qu’on substitue sous le flash',
        ceremonie.rendArrivee === true);
      check(`et sans portrait elle n'attend pas une seconde pour rien (${
        Math.round(ceremonie.ms ?? -1)} ms)`, (ceremonie.ms ?? 999) < 600);

      /* Jouée sur un élément, elle doit poser ses classes : c'est tout ce qui
         relie le code à l'animation, et un renommage de classe passerait
         inaperçu jusqu'au prochain joueur qui évolue. */
      const classes = await fiche.evaluate(async () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        const p2 = window.FX.evolution(el, { nom: 'Test', rar: 'rare' });
        const charge = el.className;
        const suite = await p2;
        suite.arrivee(el);
        const arrive = el.className;
        el.remove();
        return { charge, arrive };
      });
      check('elle marque la charge sur l’ancien', /fx-charge/.test(classes.charge)
        || (console.log('        classe :', classes.charge), false));
      check('et l’arrivée sur le nouveau', /fx-arrive/.test(classes.arrive)
        || (console.log('        classe :', classes.arrive), false));
    }

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

/* ============ le portrait mène à la fiche, et le classeur n'a qu'un gris

   Deux demandes du même joueur, le même jour, et deux fautes de la même
   famille : un écran qui montre quelque chose sans dire ce qu'on peut en
   faire. */
{
  /* **Toucher le personnage ouvre sa fiche.**

     Il ne se touchait pas : « SA FICHE » attendait tout en bas, sous les
     effets. Or ce qu'on touche sur cet écran, c'est le portrait — il occupe
     les deux tiers de la hauteur, et une image qui ne répond pas se lit comme
     un écran figé.

     Un vrai lien et non un gestionnaire de clic : il se tabule, s'ouvre dans un
     onglet, et marche avant que le script de la page n'arrive. Le contrôle
     regarde donc la balise, pas un écouteur. */
  const sc = await page.evaluate(() => {
    const el = document.getElementById('tscene');
    if (!el) return null;
    return { balise: el.tagName, href: el.getAttribute('href'),
      dit: el.getAttribute('aria-label') ?? '',
      doigt: getComputedStyle(el).cursor };
  });
  check('le portrait de « MON FANZZY » est un lien', sc?.balise === 'A'
    || (console.log('        c’est un', sc?.balise ?? 'néant'), false));
  check(`et il mène à la fiche de ce Fanzzy (${sc?.href})`,
    /^\/fanzzy\/[A-Z0-9]+$/i.test(sc?.href ?? '')
    || (console.log('        il mène à', sc?.href), false));
  check('il se nomme pour qui ne voit pas l’image', (sc?.dit ?? '').length > 10);
  check('et l’écran dit qu’on peut le toucher', sc?.doigt === 'pointer');
}

{
  /* **Une lignée qu'on n'a pas du tout s'affiche d'un seul ton.**

     Le flou des évolutions est fait pour une lignée qu'on possède : on a le
     personnage, il reste à payer l'âge suivant, et le flou est ce qu'on achète.
     Il éclaircissait la case — trois quarts de gris au lieu d'un gris plein —
     si bien qu'une lignée entièrement absente s'affichait en deux tons, ses
     âges supérieurs paraissant **moins** verrouillés que le premier. C'est
     l'inverse de ce qui est vrai.

     On mesure le filtre calculé, et non la classe : c'est lui que l'œil voit,
     et une classe posée sans règle derrière passerait le contrôle. */
  await page.evaluate(() => [...document.querySelectorAll('button,[data-tab],[data-onglet]')]
    .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
  await dodo(400);

  const tons = await page.evaluate(() => {
    const gris = (el) => {
      const f = getComputedStyle(el.querySelector('.art')).filter;
      return { g: Number(/grayscale\(([\d.]+)\)/.exec(f)?.[1] ?? 0),
        l: Number(/brightness\(([\d.]+)\)/.exec(f)?.[1] ?? 1),
        flou: /blur\(/.test(f) };
    };
    const base = document.querySelector('.slot.locked:not(.secret)');
    const orph = document.querySelector('.slot.locked.secret.orphelin');
    return { base: base ? gris(base) : null, orph: orph ? gris(orph) : null };
  });

  check('le classeur montre un premier âge manquant, en gris', Boolean(tons.base)
    || (console.log('        aucune case verrouillée de premier âge'), false));
  check('et une évolution d’une lignée qu’on n’a pas', Boolean(tons.orph)
    || (console.log('        aucune évolution orpheline dans la grille'), false));

  if (tons.base && tons.orph) {
    check(`les deux portent le même gris (${tons.orph.g} contre ${tons.base.g})`,
      Math.abs(tons.orph.g - tons.base.g) < 0.01
      || (console.log('        l’évolution est plus colorée que son premier âge'), false));
    check(`et la même lumière (${tons.orph.l} contre ${tons.base.l})`,
      Math.abs(tons.orph.l - tons.base.l) < 0.01);
    /* Le flou reste : elle est du même ton, pas révélée pour autant. Sans lui,
       on donnerait d'avance ce que l'évolution est censée révéler. */
    check('mais l’évolution reste floutée', tons.orph.flou === true);
    check('et le premier âge, lui, ne l’est pas', tons.base.flou === false);
  }

/* ================= un âge atteint n'est pas verrouillé dans le classeur

   `TR32` est monté au second âge : la grille doit donc montrer `TR32` **et**
   `TR32B` en clair, et ne verrouiller que `TR32C`. Un âge qu'on a payé et qui
   reste sous cadenas dit au joueur qu'il n'a pas ce qu'il vient d'acheter. */
{
  await page.evaluate(() => [...document.querySelectorAll('button,[data-tab],[data-onglet]')]
    .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
  await dodo(500);

  const vu = await page.evaluate(() => {
    const lu = (id) => {
      const el = [...document.querySelectorAll('#grid .slot')]
        .find((s) => s.querySelector(`.fz[data-id="${id}"]`));
      return el ? { la: true, verrou: el.classList.contains('locked') } : { la: false };
    };
    /* On lit le **rendu**, et non l'état interne de la page : celui-ci vit dans
       une fermeture et n'est pas à portée d'ici. C'est d'ailleurs le bon choix —
       ce qu'un joueur voit est la grille, pas une variable. */
    return { un: lu('TR32'), deux: lu('TR32B'), trois: lu('TR32C') };
  });
  check('le premier âge est en clair', vu.un.la && vu.un.verrou === false
    || (console.log('        ', JSON.stringify(vu.un)), false));
  /* **Le cœur du contrôle.** L'âge payé doit être en clair comme le premier :
     un cadenas dessus, et le joueur cherche ce qu'il a déjà. */
  check('l’âge atteint aussi', vu.deux.la && vu.deux.verrou === false
    || (console.log('        ', JSON.stringify(vu.deux)), false));
  check('et seul l’âge suivant reste verrouillé',
    vu.trois.la && vu.trois.verrou === true
    || (console.log('        ', JSON.stringify(vu.trois)), false));
}

/* ============ payer une évolution la fait apparaître **sans rafraîchir**

   C'est le défaut qu'un joueur a signalé, et il tenait en une phrase : « si je
   rafraîchis la page, c'est à ce moment-là que le nouveau personnage apparaît ».

   La logique de verrouillage était juste — le contrôle du dessus le montre, un
   âge atteint s'affiche en clair au chargement. Ce qui manquait était le
   redessin. `load()` relit la collection et les étages puis émet `tbf:bourse`,
   en laissant chaque écran redessiner ce qu'il a ; le kiosque écoutait, le
   classeur non. Les données étaient à jour **dans la page**, et la grille
   montrait l'état d'avant.

   Le pire des défauts d'affichage : le joueur a payé, le serveur est d'accord,
   et l'écran dit non. Rien ne lui suggère un problème de rendu — il conclut
   que son achat a échoué.

   On l'éprouve donc par le seul chemin qui vaut : on paie pour de vrai, depuis
   la fiche, et on regarde la grille **sans recharger**. */
{
  await page.evaluate(() => [...document.querySelectorAll('button,[data-tab],[data-onglet]')]
    .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
  await dodo(400);

  /* `MS30` est possédé au premier âge, et la bourse du banc porte de quoi
     payer : c'est la lignée qu'on fait grandir ici, pour ne pas dépendre de
     `TR32`, déjà monté par le montage. */
  const avant = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#grid .slot')]
      .find((s) => s.querySelector('.fz[data-id="MS30B"]'));
    return el ? el.classList.contains('locked') : null;
  });
  check('le second âge de MS30 part verrouillé', avant === true
    || (console.log('        il est déjà en clair, ou introuvable :', avant), false));

  if (avant === true) {
    /* On ouvre la fiche par la grille — le chemin du joueur — puis on paie.
       Le bouton est là dès l'ouverture depuis qu'il ne dépend plus de la case
       regardée ; c'est le contrôle d'au-dessus qui le garantit. */
    await page.evaluate(() => [...document.querySelectorAll('#grid .slot')]
      .find((s) => s.querySelector('.fz[data-id="MS30"]'))?.click());
    const ouverte = await jusqua(async () => page.evaluate(() =>
      Boolean(document.querySelector('#fiche-actions [data-evoluer]:not([disabled])'))), 8000);
    check('la fiche s’ouvre avec de quoi payer', ouverte
      || (console.log('        pas de bouton d’évolution payable'), false));

    if (ouverte) {
      await page.evaluate(() =>
        document.querySelector('#fiche-actions [data-evoluer]').click());
      /* La confirmation demande ce qu'on va perdre — c'est la doctrine des
         panneaux de ce dépôt — puis la cérémonie dure une seconde et demie. */
      const confirme = await jusqua(async () => page.evaluate(() =>
        Boolean(document.querySelector('[data-oui]'))), 6000);
      check('elle demande confirmation avant de dépenser', confirme);
      if (confirme) {
        await page.evaluate(() => document.querySelector('[data-oui]').click());
        /* On attend que la grille change d'avis, sans jamais recharger : c'est
           tout l'objet du contrôle. Généreux en temps — la cérémonie d'évolution
           tient la main pendant plus d'une seconde — et strict sur le geste. */
        const vivant = await jusqua(async () => page.evaluate(() => {
          const el = [...document.querySelectorAll('#grid .slot')]
            .find((s) => s.querySelector('.fz[data-id="MS30B"]'));
          return Boolean(el) && !el.classList.contains('locked');
        }), 12000);
        check('et l’âge payé apparaît dans le classeur sans rafraîchir', vivant
          || (console.log('        la grille montre encore l’état d’avant'), false));
      }
    }
  }
}
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
