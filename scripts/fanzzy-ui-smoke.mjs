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
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

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
await raw.query(`DROP TABLE IF EXISTS achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
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
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'fanzzy.sql',
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
/* Le Fanzzy équipé est **V1 au second âge**, et c'est délibéré : l'écran
   « Mon Fanzzy » doit montrer le Meneur de chant et non le Choriste, dans un
   cadre rare et non commun. Équipé d'un G1 resté au premier âge, la page
   pouvait ignorer le stade et ignorer la rareté sans qu'aucun contrôle ne
   bouge — tout le catalogue est commun au premier âge. */
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,xp,active_fanzzy)
                 VALUES (?,900,9,?,'V1')`, [U, seuil(9)]);
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
  await fiche.goto(`${base}/fanzzy/G1`, { waitUntil: 'networkidle0' });
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

    /* Le dessin est celui de **l'âge atteint**. La fiche demandait
       l'illustration sous le nom de la lignée : elle montrait donc le premier
       âge sous le nom du dernier, ce qui ressemble à un personnage
       parfaitement valide et ne se voit jamais. */
    const dessin = await fiche.evaluate(() =>
      document.querySelector('.fiche .art img')?.getAttribute('src') ?? '');
    check('le dessin de la vitrine est bien celui du personnage',
      /G1/.test(dessin) || (console.log('        il montre :', dessin), false));

    /* Le dessin est celui de **l'âge atteint**, et c'est V1 qui le prouve :
       ce compte l'a monté au second âge. La fiche demandait l'illustration
       sous le nom de la lignée — elle montrait donc le Choriste sous le nom
       du Meneur de chant, ce qui ressemble à un personnage parfaitement
       valide et ne se voit jamais. G1, resté au premier âge, ne pouvait pas
       faire la différence. */
    const evolue = await nav.newPage();
    evolue.on('pageerror', (e) => erreurs.push(e.message));
    await evolue.setViewport({ width: 400, height: 880 });
    await evolue.goto(`${base}/fanzzy/V1`, { waitUntil: 'networkidle0' });
    await evolue.waitForSelector('.fiche .art img', { timeout: 8000 }).catch(() => {});
    const age = await evolue.evaluate(() => ({
      dessin: document.querySelector('.fiche .art img')?.getAttribute('src') ?? '',
      nom: document.querySelector('.fiche h2')?.textContent.trim() ?? '',
    }));
    check('la fiche montre le dessin de l’âge atteint, pas celui de la lignée',
      /V2/.test(age.dessin)
      || (console.log('        elle montre :', age.dessin), false));
    check('et son nom va avec', /Meneur/.test(age.nom)
      || (console.log('        elle nomme :', age.nom), false));
    await evolue.close();
  }
  if (process.env.CAPTURE) {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    await fiche.screenshot({ path: join(tmpdir(), 'fiche.png') });
  }
  await fiche.close();
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

  /* Un Fanzzy qu'on ne possède pas ouvre la **même** fiche. Avant, il
     changeait de page : deux gestes différents pour deux cartes de la même
     grille, sans que rien ne l'explique. */
  await p.evaluate(() => document.querySelector('#grid .slot.locked').click());
  const absent = await jusqua(async () => await p.evaluate(() =>
    Boolean(document.querySelector('#detail.on .fiche'))));
  check('une carte qu’on n’a pas ouvre la même fiche', absent);
  check('et elle dit qu’elle n’est pas encore à nous',
    await p.evaluate(() =>
      /pas encore/i.test(document.querySelector('#detail .fiche')?.textContent ?? '')));
  await p.close();
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
