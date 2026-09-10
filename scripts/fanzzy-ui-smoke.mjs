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
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { DEX } from '../src/shared/fanzzy/dex.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
// Voir deck-ui-smoke : `.pathname` donne « /C:/… » sous Windows, ce qui rend
// la suite inutilisable là où elle est justement censée tourner avant livraison.
const RACINE = fileURLToPath(new URL('..', import.meta.url));

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
await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
// `stades.sql` ajoute la colonne `stage` à `user_fanzzy`. Sans elle, toute la
// collection reste au premier âge, donc entièrement commune — et la grille
// n'aurait aucune rareté à montrer.
// `niveau.sql` en plus : sans la colonne `xp`, le module de progression ouvre
// *toutes* les séries — c'est sa règle, un schéma incomplet ne confisque rien —
// et le kiosque n'aurait alors rien à verrouiller. La suite passerait au vert
// sans jamais éprouver le cas qui a produit la panne.
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'souvenirs.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'tenues.sql', 'deck.sql', 'stades.sql',
                 'niveau.sql']) {
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
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,active_fanzzy)
                 VALUES (?,900,9,?,'G1')`, [U, seuil(9)]);
// G1 est possédé : c'est le Fanzzy illustré, et c'est lui qui cassait la page.
// V1 est monté au second âge : la rareté suit le stade, donc c'est la seule
// façon d'avoir autre chose que du commun dans la grille — et c'est ce qui
// permet de vérifier que la rareté se voit.
for (const f of ['G1', 'X7', 'X8', 'V1', 'P1']) {
  await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage) VALUES (?,?,1,?)`,
    [U, f, f === 'V1' ? 2 : 1]);
}
await raw.end();

/* ----------------------------------------------------------- le serveur */

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
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
const fanzzy = createFanzzy({ pool, requireAuth, niveau });

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
app.get('/fanzzy', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'fanzzy.html')));
// La fiche d'un Fanzzy, servie comme `server.js` le fait : c'est la page que
// la grille ouvre quand on touche une carte.
app.get('/fanzzy/:id', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'fanzzy-fiche.html')));
app.use('/api/me', (await import('../src/server/onboarding/index.js'))
  .createOnboarding({ pool, requireAuth }).router);
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

const PUBLIE = DEX.filter((f) => f.publie !== false);


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

/* --------------------------------------------------------- le classeur */

await page.evaluate(() => [...document.querySelectorAll('button')]
  .find((b) => /CLASSEUR/i.test(b.textContent))?.click());
await jusqua(async () => await page.evaluate(() =>
  document.querySelectorAll('#grid .slot').length > 0));

const grille = await page.evaluate(() => ({
  cases: document.querySelectorAll('#grid .slot').length,
  possedees: document.querySelectorAll('#grid .slot:not(.locked)').length,
  progression: document.getElementById('progTxt')?.textContent ?? '',
}));
/* Une case par personnage, pas une par âge. Le classeur montrait vingt et une
   cases pour les sept lignées alors que la jauge n'en comptait que sept : le
   joueur voyait « 5/159 » sous cent soixante-six vignettes. */
const PERSOS = PUBLIE.filter((f) => !PUBLIE.some((x) => x.evo === f.id));
check('la grille affiche un personnage par case', grille.cases === PERSOS.length);
check('les cartes possédées sont distinguées', grille.possedees === 5);
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
 * quatre-vingts : vitrine, pastilles, effets, équipement, six tenues, lignée,
 * boutons. Il fallait défiler trois fois pour faire le tour de l'écran qui
 * sert justement à décider si on équipe ce personnage — et le bouton
 * « emmener en duel » était tout en bas.
 *
 * Le personnage occupe maintenant l'écran et le reste passe en onglets : trois
 * contenus qu'on ne consulte jamais ensemble se remplacent dans un volet de
 * hauteur fixe. Ce contrôle vérifie les deux moitiés — que ça tient, et que
 * les onglets changent vraiment ce qu'on lit.
 */
{
  const fiche = await nav.newPage();
  fiche.on('pageerror', (e) => erreurs.push(e.message));
  await fiche.setViewport({ width: 400, height: 880 });
  await fiche.goto(`${base}/fanzzy/G1`, { waitUntil: 'networkidle0' });
  const prete = await fiche.waitForSelector('.vitrine', { timeout: 8000 })
    .then(() => true).catch(() => false);
  check('la fiche d’un Fanzzy s’affiche', prete);

  if (prete) {
    const m = await fiche.evaluate(() => ({
      defile: document.documentElement.scrollHeight > innerHeight + 1,
      vitrine: document.querySelector('.vitrine').getBoundingClientRect().height,
      ecran: innerHeight,
      bouton: document.querySelector('.actions .btn')?.getBoundingClientRect().bottom ?? 1e9,
      onglets: document.querySelectorAll('.onglet').length,
    }));
    check('elle tient dans l’écran, sans défilement',
      !m.defile || (console.log(`        ${document ? '' : ''}elle défile`), false));
    check('le personnage occupe plus du tiers de la hauteur',
      m.vitrine > m.ecran * 0.34
      || (console.log(`        ${Math.round(m.vitrine)} px sur ${m.ecran}`), false));
    check('et le bouton d’action est visible sans chercher', m.bouton <= m.ecran + 1);
    check('les trois volets ont leur onglet', m.onglets === 3);

    /* Changer d'onglet doit changer ce qu'on lit — et **ne pas** faire sauter
       le personnage : le volet a une hauteur fixe pour ça. */
    const avant = await fiche.evaluate(() => ({
      texte: document.getElementById('volet').textContent.trim().slice(0, 40),
      haut: document.querySelector('.vitrine').getBoundingClientRect().height,
    }));
    await fiche.evaluate(() =>
      document.querySelector('[data-volet="tenues"]').click());
    await dodo(250);
    const apres = await fiche.evaluate(() => ({
      texte: document.getElementById('volet').textContent.trim().slice(0, 40),
      haut: document.querySelector('.vitrine').getBoundingClientRect().height,
      tenues: document.querySelectorAll('#volet .skin').length,
    }));
    check('un autre onglet montre un autre contenu', avant.texte !== apres.texte);
    check('les tenues y sont', apres.tenues > 0);
    check('et le personnage ne saute pas d’un onglet à l’autre',
      Math.abs(avant.haut - apres.haut) < 2
      || (console.log(`        ${Math.round(avant.haut)} puis ${Math.round(apres.haut)}`), false));

    await fiche.evaluate(() => document.querySelector('[data-volet="lignee"]').click());
    await dodo(250);
    check('la lignée aussi',
      await fiche.evaluate(() => document.getElementById('volet').textContent.trim().length > 5));
    check('la fiche ne défile toujours pas après trois onglets',
      await fiche.evaluate(() =>
        document.documentElement.scrollHeight <= innerHeight + 1));
  }
  await fiche.close();
}

/* ----------------------------------------------------------- le kiosque */

await page.evaluate(() => [...document.querySelectorAll('button')]
  .find((b) => /KIOSQUE/i.test(b.textContent))?.click());
await dodo(400);
check('le kiosque annonce le bon nombre de Fanzzy par set',
  await page.evaluate(() => /\d+ Fanzzy/.test(
    document.getElementById('setLine')?.textContent ?? '')));

/* ------------------------------------------- une série hors de portée

 * Les séries se débloquent au niveau. Le kiosque les proposait **toutes** :
 * le joueur en choisissait une hors de portée, appuyait sur « ouvrir le
 * booster », et découvrait le refus après coup — sous la forme d'un code brut,
 * « Ouverture impossible (fanzzy.error.set_locked) ». Deux fautes en une : le
 * kiosque promettait ce qu'il ne pouvait pas tenir, et le message ne nommait
 * pas sa cause.
 *
 * Un jeu ne cache pas ce qui vient : il le montre verrouillé, avec ce qu'il
 * demande. Le compte de test est au niveau 1 — il n'a donc que la première
 * série, et toutes les autres doivent s'annoncer comme telles.
 */
{
  const etat = await page.evaluate(async () => {
    const debut = SETS.findIndex((s) => !S.series || !S.series.has(s.id));
    if (debut < 0) return null;
    S.set = debut;
    renderKiosque();
    return {
      id: SETS[debut].id,
      ligne: document.getElementById('setLine').textContent,
      bouton: document.getElementById('openBtn').textContent,
      ferme: document.getElementById('openBtn').disabled,
      verrou: document.getElementById('carousel').classList.contains('verrou'),
    };
  });

  if (!etat) {
    console.log('  --   toutes les séries sont débloquées : section sautée');
  } else {
    check('une série hors de portée annonce le niveau qu’elle demande',
      /niveau \d+/i.test(etat.ligne)
      || (console.log('        elle dit :', etat.ligne), false));
    check('le bouton le répète au lieu de promettre un booster',
      /niveau \d+/i.test(etat.bouton));
    check('et il est fermé', etat.ferme === true);
    check('le paquet se voit, éteint : c’est ce qui donne envie', etat.verrou);
  }

  /* Le filet de sécurité. Le kiosque ne propose plus une série verrouillée,
     mais un onglet resté ouvert peut encore en demander le booster. Le refus
     doit alors nommer sa cause — c'est ce code brut, affiché tel quel, qui a
     fait remonter la panne. */
  const dit = await page.evaluate(async () => {
    const r = await fetch('/api/fanzzy/open', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      credentials: 'same-origin', body: JSON.stringify({ set: 'IM' }),
    });
    return (await r.json()).error ?? null;
  });
  check('le serveur refuse bien une série hors de portée',
    dit === 'fanzzy.error.set_locked');
  check('et la page sait le dire en français',
    await page.evaluate(() => {
      const src = document.documentElement.innerHTML;
      return /fanzzy\.error\.set_locked'\s*:\s*'[^']+/.test(src);
    }));
}

/* ---------------------------------------- ouvrir un booster ne casse rien */

const ouverture = await page.evaluate(async () => {
  const r = await fetch('/api/fanzzy/open', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    credentials: 'same-origin', body: JSON.stringify({ set: 'VN' }),
  });
  const j = await r.json();
  /* Chaque **Fanzzy** tiré doit être connu de la page, sinon l'ouverture casse
     — c'est la faute qui a coûté le plus cher ici, un G1 sorti d'un booster que
     le catalogue recopié ne connaissait pas.

     Les autres types ne sont pas dans `BY_ID` et n'ont rien à y faire : un skin,
     une pièce d'équipement et une carte d'action vivent dans d'autres
     catalogues. Depuis que les places 4 et 5 s'ouvrent à eux, les exiger ici
     faisait échouer ce contrôle une fois sur trois, au hasard du tirage. */
  return (j.cards ?? []).filter((c) => c.type === 'fanzzy' && !BY_ID.has(c.id));
});
check('tous les Fanzzy tirés sont connus de la page', ouverture.length === 0);
if (ouverture.length) console.log('    inconnues :', ouverture);

/* ------------------------------------------------ le geste d'ouverture

   **Ce geste n'était couvert par rien**, et c'est exactement pour ça qu'il a
   pu cesser de fonctionner sans qu'aucune suite ne bronche : les tests
   appelaient `/api/fanzzy/open` directement, donc ils éprouvaient le serveur
   et jamais la seule chose que le joueur touche.

   Ce qui s'était cassé : la version précédente demandait de maintenir le doigt
   pour « chauffer », et la chauffe se comptait en **images** — `charge += 0.02`
   par `requestAnimationFrame`. Cette page rend une douzaine d'images par
   seconde entre le carrousel, les lueurs et le paquet qui tremble : la chauffe
   réclamait quatre secondes d'immobilité parfaite au lieu des huit dixièmes
   prévus, et le moindre relâchement remettait le compteur invisible à zéro.
   Sur une machine rapide, instantané ; sur une machine lente, impossible.

   D'où ce que ce bloc surveille, dans l'ordre de ce qui a fait mal :

   1. la déchirure n'avance qu'avec la **distance**, jamais avec le temps ni
      les images — c'est la règle qui rend le geste indépendant de la machine ;
   2. lâcher trop tôt **se voit** et ne coûte pas le booster ;
   3. on peut **sortir** de l'écran sans réussir le geste.

   Les événements sont dispatchés depuis la page, et non par `page.mouse` : le
   pilotage CDP ne délivre à cette page que deux `pointermove` sur douze — la
   fenêtre elle-même n'en voit pas davantage. Un test écrit avec `page.mouse`
   échouerait donc toujours, quel que soit l'état du code, et ne mesurerait que
   le simulateur.                                                            */
{
  const pageG = await ouvrir();
  const $ = (id) => pageG.evaluate((i) =>
    document.getElementById(i)?.textContent.replace(/\s+/g, ' ').trim(), id);
  const avancee = () => pageG.evaluate(() =>
    Number(getComputedStyle(document.getElementById('tearpack')).getPropertyValue('--p')));
  const boosters = () => pageG.evaluate(() => S.packs);
  const ouvert = () => pageG.evaluate(() =>
    document.getElementById('opener')?.classList.contains('on') === true);
  const zone = () => pageG.evaluate(() =>
    document.getElementById('tearzone').classList.contains('on'));
  const saisir = async () => {
    await pageG.evaluate(() => document.getElementById('openBtn').click());
    await jusqua(async () => await zone());
  };

  /**
   * Tire la bande, de `de` à `a` en fractions de largeur, en `pas` mouvements.
   * `pas` compte : c'est lui qui prouve que l'avancée suit la main et non le
   * nombre d'images — un même trajet en six ou en vingt gestes doit donner
   * exactement la même déchirure.
   */
  const tirer = (de, a, pas = 14) => pageG.evaluate(async (d, f, n) => {
    const el = document.getElementById('tearpack');
    const r = el.getBoundingClientRect();
    const y = r.y + r.height * 0.08;
    const env = (t, pc) => el.dispatchEvent(new PointerEvent(t, {
      pointerId: 1, pointerType: 'mouse', bubbles: true, cancelable: true,
      clientX: r.x + r.width * pc, clientY: y,
      buttons: t === 'pointerup' ? 0 : 1, isPrimary: true }));
    env('pointerdown', d);
    for (let k = 1; k <= n; k++) {
      env('pointermove', d + (f - d) * (k / n));
      await new Promise((res) => requestAnimationFrame(res));
    }
    /* On attend que l'avancée cesse de bouger avant de la lire.
       Une fois le seuil franchi, `doOpen` pose `--p` à 1 et retire `tire` :
       la transition CSS de 320 ms reprend et amène la valeur à destination.
       Lire dans la foulée échantillonne donc cette animation au hasard —
       0,95 sur une machine, 1 sur une autre, et le contrôle rougissait sans
       que le geste ait changé. C'est le même piège que le hasard du tirage :
       ce qui varie n'est pas ce qu'on mesure.
       Quand rien n'est en transition — une déchirure partielle, où `tire`
       garde `transition:none` — deux lectures suffisent et la boucle sort. */
    const lire = () => Number(getComputedStyle(el).getPropertyValue('--p'));
    let avant = -1, apres = lire();
    for (let k = 0; k < 40 && avant !== apres; k++) {
      avant = apres;
      await new Promise((res) => setTimeout(res, 25));
      apres = lire();
    }
    return apres;
  }, de, a, pas);

  const lacher = () => pageG.evaluate(() => document.getElementById('tearpack')
    .dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse',
      bubbles: true, clientX: 0, clientY: 0, buttons: 0, isPrimary: true })));

  const avant = await boosters();
  check('il y a de quoi ouvrir', avant > 2);

  await saisir();
  check('l’écran de déchirure s’ouvre', await zone());
  check('et la bande est entière', Math.abs(await avancee()) < 0.02);

  /* 1 — le geste complet, d'un seul trait, sans rien maintenir. */
  const plein = await tirer(0.94, 0.06);
  check('tirer en travers déchire la bande d’un bout à l’autre', plein > 0.99
    || (console.log('        avancée :', plein), false));
  check('le booster s’ouvre', await jusqua(async () => await ouvert()));
  check('et cinq cartes sortent',
    await pageG.evaluate(() => document.querySelectorAll('#ostage > *').length) === 5);
  check('un booster a été consommé', await boosters() === avant - 1);

  /* 2 — l'avancée suit la main, pas les images.

     Le même trajet en six mouvements et en vingt-quatre doit donner la même
     déchirure. C'est la faute d'origine, exactement : elle comptait les images
     et rendait le geste impossible sur une machine lente. */
  await pageG.evaluate(() => document.getElementById('oClose')?.click());
  await saisir();
  const court = await tirer(0.9, 0.5, 6);
  await lacher();
  await pageG.evaluate(() => document.getElementById('tearquit').click());
  await saisir();
  const long = await tirer(0.9, 0.5, 24);
  check(`le même trajet donne la même déchirure (${court.toFixed(2)} / ${long.toFixed(2)})`,
    Math.abs(court - long) < 0.02);

  /* 3 — lâcher trop tôt se voit, et ne coûte rien. */
  const restants = await boosters();
  await lacher();
  check('la bande revient à sa place', await jusqua(async () => await avancee() < 0.02));
  check('l’écran dit ce qui s’est passé', /revenue/i.test(await $('tearlbl')));
  check('et le booster n’a pas été consommé', await boosters() === restants);
  check('on est toujours devant le paquet', await zone() && !(await ouvert()));

  // Au deuxième essai manqué, l'écran cesse de laisser deviner : quelqu'un qui
  // n'y arrive pas deux fois ne réussira pas à la troisième par insistance.
  await tirer(0.9, 0.6, 8);
  await lacher();
  check('après deux essais manqués, la sortie au clavier est nommée',
    /entr[ée]e/i.test(await $('tearlbl')));

  /* 4 — les deux sorties. Un plein écran dont on ne s'échappe qu'en
     réussissant un geste est un piège : la seule issue était de recharger. */
  await pageG.keyboard.press('Escape');
  check('échap referme l’écran', await jusqua(async () => !(await zone())));
  check('sans rien consommer', await boosters() === restants);

  await saisir();
  await pageG.evaluate(() => document.getElementById('tearquit').click());
  check('« plus tard » aussi', await jusqua(async () => !(await zone())));

  await saisir();
  await pageG.evaluate(() => document.getElementById('tearpack').focus());
  await pageG.keyboard.press('Enter');
  check('entrée ouvre sans le geste — c’est l’accès clavier et la sortie de secours',
    await jusqua(async () => await ouvert()));
  check('et là, le booster est bien consommé', await boosters() === restants - 1);

  /* 5 — de gauche à droite aussi : la languette est à droite, mais rien ne
     justifie de refuser le geste à un gaucher. */
  await pageG.evaluate(() => document.getElementById('oClose')?.click());
  await saisir();
  await tirer(0.06, 0.94);
  check('on déchire dans les deux sens', await jusqua(async () => await ouvert()));

  /* 6 — les quatre sortes de cartes s'affichent.

     C'est la panne elle-même, et elle n'était visible nulle part. `modsText`
     lisait `f.mods` sans garde ; seuls un supporter et une pièce d'équipement
     en portent. Une tenue ou une carte d'action tirée en quatrième place
     faisait lever `cardHTML`, la boucle qui monte les cinq cartes s'arrêtait
     au milieu, et sa dernière ligne — celle qui affiche l'écran — ne
     s'exécutait jamais : booster débité, écran vide, rien à l'écran pour le
     dire. Depuis que les places 4 et 5 s'ouvrent à tout l'inventaire, c'était
     le cas de la plupart des boosters.

     On ouvre donc en série jusqu'à avoir vu les quatre sortes, et on vérifie
     que chacune arrive entière et nommée. Un test qui n'ouvrirait qu'un
     booster passerait quatre fois sur cinq. */
  await pageG.evaluate(() => document.getElementById('oClose')?.click());
  const bilan = await pageG.evaluate(async () => {
    const vus = { fanzzy: 0, skin: 0, stuff: 0, action: 0 };
    const fautes = [];
    /* On ouvre **jusqu'à** avoir vu les quatre sortes, pas un nombre fixe de
       fois. À quatorze boosters, la sorte la plus rare manquait environ une
       fois sur cinq et la suite rougissait sans que rien ne soit cassé — le
       hasard du jeu fuyait dans l'assertion, ce qui est le meilleur moyen
       d'apprendre à ignorer les rouges. Le plafond reste : si une sorte ne
       tombe jamais en soixante boosters, ce n'est plus de la malchance. */
    const complet = () => Object.values(vus).every((n) => n > 0);
    for (let i = 0; i < 60 && !complet(); i++) {
      //  : une carte qui fait lever le rendu doit se lire comme un échec
      // nommé, pas faire exploser la suite. C'est exactement ce qui arrivait,
      // et un joueur, lui, ne voyait rien du tout.
      try { await openPack(); }
      catch (e) { fautes.push('l’ouverture a levé : ' + e.message); continue; }
      const posees = document.querySelectorAll('#ostage > *').length;
      if (posees !== 5) fautes.push(`${posees} cartes affichées au lieu de 5`);
      if (!document.getElementById('opener').classList.contains('on')) {
        fautes.push('l’écran d’ouverture ne s’est pas affiché');
      }
      for (const c of pull) {
        if (!c) { fautes.push('une carte est arrivée vide'); continue; }
        // Le nom, pas l'identifiant : une tenue s'appelait « prehistorique ».
        if (!c.nom || c.nom === c.id) fautes.push(`« ${c.id} » n’a pas de nom`);
        vus[c.skin ? 'skin' : c.stuff ? 'stuff' : c.action ? 'action' : 'fanzzy']++;
      }
    }
    return { vus, fautes: [...new Set(fautes)] };
  });

  check(`les quatre sortes de cartes sont tombées (${
    Object.entries(bilan.vus).map(([k, n]) => `${k} ${n}`).join(' · ')})`,
    Object.values(bilan.vus).every((n) => n > 0));
  check('et aucune n’a cassé l’ouverture', bilan.fautes.length === 0);
  if (bilan.fautes.length) console.log('       ', bilan.fautes.slice(0, 4));

  await pageG.close();
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

/* ------------------------------- la barre commune sur un petit téléphone

 * Ce contrôle vivait dans accueil-ui-smoke. L’accueil est devenu un écran de
 * jeu plein cadre qui ne porte plus la barre : le contrôle a déménagé ici,
 * sur une page qui l’affiche encore. Sept entrées sur 320 px — un iPhone SE —
 * font quarante-cinq pixels chacune. Une barre qui déborde ne se voit pas en
 * développement, seulement sur le téléphone d’un joueur.
 */
{
  const petit = await nav.newPage();
  petit.on('pageerror', (e) => erreurs.push(e.message));
  await petit.setViewport({ width: 320, height: 640 });
  await petit.goto(base + '/fanzzy', { waitUntil: 'networkidle0' });
  await petit.waitForSelector('#tbf-nav', { timeout: 6000 }).catch(() => {});

  const barre = await petit.evaluate(() => {
    const n = document.getElementById('tbf-nav');
    if (!n) return null;
    const liens = [...n.querySelectorAll('a')];
    return {
      entrees: liens.length,
      debordePage: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      debordeBarre: n.scrollWidth > n.clientWidth,
      rognes: liens.filter((a) => a.scrollWidth > a.clientWidth + 1).map((a) => a.textContent.trim()),
    };
  });

  check('la barre commune porte ses sept entrées', barre?.entrees === 7);
  check('elle tient dans 320 px sans déborder',
    barre?.debordePage === false && barre?.debordeBarre === false);
  check('aucun libellé de la barre n’est rogné', (barre?.rognes ?? []).length === 0);
  if (barre?.rognes?.length) console.log('   rognés :', barre.rognes);
  await petit.close();
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

await nav.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);
