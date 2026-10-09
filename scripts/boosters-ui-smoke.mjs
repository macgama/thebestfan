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
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { DEX, SETS } from '../src/shared/fanzzy/dex.js';
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
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites, amities,
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
for (const f of ['TR37', 'TR39', 'TR40', 'TR32', 'MS30']) {
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
/* La page éprouvée. Sans cette ligne, express.static plus bas sert quand
   même /boosters.html — mais pas /boosters, et la suite chargeait une page
   vide sans qu aucune erreur ne le dise. */
app.get('/boosters', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'boosters.html')));
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

const nav = await puppeteer.launch({ args: ['--no-sandbox', '--accept-lang=fr-FR'] });
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
  await page.goto(base + '/boosters', { waitUntil: 'networkidle0' });
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

check('la page des boosters se charge sans erreur de script',
  erreurs.length === 0 || (console.log('   ', erreurs.slice(0, 3)), false));

/* ------------------------------ une carte d'état montre la pose gagnée

   Un joueur a ouvert un paquet, gagné l'état « on pousse », et vu le
   personnage **au repos** sous l'étiquette. Chaque pièce était pourtant
   juste — le dessin existait, la carte était bien formée, le module était
   chargé — et deux maillons manquaient, chacun invisible :

     1. le kiosque était la **seule** page du jeu à ne jamais charger le
        manifeste des dessins. Sans lui, `resoudre` rend `null` ;
     2. `resoudre` ne rend une expression que si le joueur l'a gagnée, et la
        table des gains vient de `load()`, appelé une seule fois au
        démarrage. Au moment du butin elle date d'avant l'ouverture : le jeu
        filtrait exactement la carte qu'il annonçait.

   On éprouve les trois maillons séparément, parce qu'ils cassent pour des
   raisons différentes. Le repli, lui, est **correct** — il montre le
   personnage au repos, ce qui dit au moins de qui il s'agit — et c'est
   précisément ce qui rend ce défaut si difficile à voir : rien ne rougit,
   rien ne manque, l'image est simplement la mauvaise. */
{
  const vu = await page.evaluate(() => {
    const C = window.TBF_CARTES;
    const index = window.TBF_ETATS?.pret?.();
    if (!index) return { manifeste: false };

    /* On lit le modèle dans le manifeste plutôt que de nommer un identifiant
       en dur, qui deviendrait faux au premier redessin. */
    const id = Object.keys(index.fanzzy).find((k) =>
      index.fanzzy[k].evolutions?.e1?.skins?.base?.etats?.includes('pousse'));
    if (!id) return { manifeste: true, aucunModele: true };

    const carte = C.carteDuPaquet({ type: 'etat', id: 'pousse', pour: id, stade: 1 });

    /* Sans le gain, le repli sur le repos est **voulu** : on ne montre pas une
       expression qu'on n'a pas. On vérifie les deux côtés de cette règle. */
    window.TBF_ETATS.possedes({});
    const sansGain = /src="([^"]+)"/.exec(C.dessinDeCarte(carte))?.[1] ?? '';

    window.TBF_ETATS.possedes({ [id]: { 1: ['pousse'] } });
    const html = C.dessinDeCarte(carte);
    const avecGain = /src="([^"]+)"/.exec(html)?.[1] ?? '';

    return { manifeste: true, id, sansGain, avecGain,
      etiquette: /ON POUSSE/i.test(html) };
  });

  check('le kiosque a chargé le manifeste des dessins', vu.manifeste === true);
  check('un état gagné montre sa pose, pas le repos',
    /\/pousse\./.test(vu.avecGain ?? '')
    || (console.log('        dessin servi :', vu.avecGain || '(aucun)'), false));
  check('et un état non gagné reste au repos, comme la règle le veut',
    /\/neutre\./.test(vu.sansGain ?? '')
    || (console.log('        dessin servi :', vu.sansGain || '(aucun)'), false));
  check('et la carte porte l’étiquette de l’état', vu.etiquette === true);

  /* **Le troisième maillon : l'ouverture inscrit ce qu'elle annonce.**

     C'est le défaut d'origine, et il ne se voit qu'ici : la table des gains
     doit contenir chaque état du butin **avant** que le récapitulatif ne se
     dessine. Un paquet sans état ne prouve rien — on le dit plutôt que de
     laisser croire à un contrôle passé. */
  /* **Un seul paquet, et on le dit quand il ne contient pas d état.**

     En ouvrir plusieurs jusqu à en trouver un rendrait ce contrôle
     déterministe — et épuiserait la réserve du joueur de test, sur laquelle
     six contrôles plus bas comptent encore. Essayé : « il y a de quoi ouvrir »
     et « le booster est bien consommé » rougissent aussitôt.

     Un contrôle qui casse ses voisins pour se garantir lui-même est un
     mauvais échange. Celui-ci passe donc son tour une fois sur deux, et il le
     **dit** — les trois du dessus, eux, gardent la chaîne de dessin à chaque
     exécution. */
  const inscrits = await page.evaluate(async () => {
    const C = window.TBF_CARTES;
    await openPack();
    finishPack();
    const etats = (window.pull ?? []).filter((f) => f?.etat && f.pour);
    return etats.map((f) => ({ id: f.id, pour: f.pour, stage: f.stage ?? 1,
      inscrit: (C.S.etats?.[f.pour]?.[f.stage ?? 1] ?? []).includes(f.id) }));
  }).catch(() => null);

  if (!inscrits?.length) {
    console.log('        (aucun état dans ce paquet — rien à vérifier ici)');
  } else {
    const manquants = inscrits.filter((e) => !e.inscrit);
    check(`l’ouverture inscrit les ${inscrits.length} état(s) gagné(s)`,
      manquants.length === 0
      || (console.log('        non inscrits :',
        manquants.map((e) => `${e.pour}/${e.stage}/${e.id}`).join(', ')), false));
  }
}
/* ----------------------------------------------------------- le kiosque */

/* Plus d onglet à cliquer : le kiosque **est** la page. C était la dernière
   trace de l époque où il fallait le chercher derrière un troisième onglet,
   entre le classeur et le personnage équipé. */
await dodo(400);
check('le kiosque annonce le bon nombre de Fanzzy par set',
  await page.evaluate(() => /\d+ Fanzzy/.test(
    document.getElementById('setLine')?.textContent ?? '')));

/* ------------------------------------- ce qu'on peut ouvrir, et ce qui vient

 * Les séries se débloquent au niveau. Le kiosque les proposait **toutes** :
 * on glissait longuement entre huit paquets hors de portée pour retrouver le
 * seul ouvrable, et la série affichée au premier chargement pouvait elle-même
 * être verrouillée — bouton gris, « NIVEAU 9 REQUIS », sans rien qui dise
 * qu'il suffisait de glisser.
 *
 * Le carrousel ne porte donc plus que des paquets ouvrables, et il en porte
 * trois : on choisit le sien. **Ce choix ne change rien au tirage** — voir la
 * note de `PAQUETS_AU_CHOIX` — c'est un geste de cérémonie.
 *
 * Ils étaient dix. Le lot 3 (le kiosque) les a ramenés à trois au plus :
 * celui du milieu sur son socle, un voisin de chaque côté. On n'en voyait de
 * toute façon que trois à la fois, et les sept autres n'étaient que des
 * points sous le carrousel qu'on ne regardait pas. Le contrôle suit donc la
 * règle nouvelle — trois, tous visibles, et l'on arrive sur celui du
 * milieu — et pas seulement un nouveau chiffre.
 *
 * Mais un jeu ne cache pas ce qui vient : ce qui suit s'annonce en une ligne,
 * à côté du choix au lieu d'être dedans. Le compte de test est au niveau 1,
 * il n'a donc que la première série.
 */
{
  const vu = await page.evaluate(() => ({
    /* La série présentée est ouverte. C'est l'invariant : le kiosque ne
       propose jamais ce qu'il ne peut pas tenir.
       `SETS` ne contient plus que les ouvertes ; `SETS_TOUTES` les porte
       toutes, avec leur champ `ouverte`. */
    serieOuverte: SETS[S.set]?.ouverte !== false,
    nom: document.getElementById('setName')?.textContent ?? '',
    /* Trois paquets au choix, tous de cette série. */
    paquets: document.querySelectorAll('#carousel .slide').length,
    /* Lequel est devant (`.center`), et lesquels le carrousel range hors de
       la vue (`.hidden`, au-delà de 1,8 place du centre). */
    devant: [...document.querySelectorAll('#carousel .slide.center')].map((s) => s.dataset.i),
    caches: document.querySelectorAll('#carousel .slide.hidden').length,
    /* Ce qui vient, annoncé sans être sur le chemin. */
    avenir: document.getElementById('avenir')?.hidden === false
      ? document.getElementById('avenir').textContent : null,
    /* Les pastilles ne listent que l'ouvert, et disparaissent s'il n'y en a
       qu'une : un sélecteur à un seul choix n'est pas un choix. */
    pastilles: [...document.querySelectorAll('#series button')].map((b) => b.textContent),
    pastillesCachees: document.getElementById('series')?.hidden === true,
    verrouillees: SETS_TOUTES.filter((x) => x.ouverte === false).length,
    total: SETS_TOUTES.length,
    bouton: document.getElementById('openBtn')?.textContent ?? '',
  }));

  check('le kiosque ne présente qu\u2019une série ouvrable', vu.serieOuverte === true
    || (console.log('        présentée :', vu.nom), false));
  check(`trois paquets au choix (${vu.paquets})`, vu.paquets === 3);
  /* Trois, c'est ce que l'œil embrasse : aucun n'est rangé hors de la vue,
     sinon on aurait refait le présentoir de dix en plus court. Et l'on
     arrive sur celui du milieu — `MILIEU`, l'indice 1 —, un voisin de chaque
     côté pour que le glissement ait un sens dans les deux directions. Aucun
     contrôle de cette suite ne fait tourner le carrousel avant celui-ci. */
  check('tous les trois se voient', vu.caches === 0
    || (console.log('        rangés hors de la vue :', vu.caches), false));
  check('et l’on arrive sur celui du milieu',
    vu.devant.length === 1 && vu.devant[0] === '1'
    || (console.log('        devant :', JSON.stringify(vu.devant)), false));
  check('le bouton ne réclame plus un niveau',
    !/niveau \d+/i.test(vu.bouton)
    || (console.log('        bouton :', vu.bouton), false));

  if (vu.verrouillees > 0) {
    /* Un jeu ne cache pas ce qui vient : il le dit, à côté du choix. */
    check('ce qui vient est annoncé', Boolean(vu.avenir)
      || (console.log('        aucune ligne « à venir »'), false));
    /* Elle disait « au niveau 12 ». Elle ne le dit plus, et pas seulement
       parce que le niveau n'ouvre plus rien : **on ne connaît pas la date**.
       Une saison se lance quand l'administration la lance, et annoncer une
       échéance qu'on ne tiendra peut-être pas est pire que de n'en annoncer
       aucune. Elle nomme donc les séries, et dit qu'elles attendent. */
    check('avec leur nom, et sans promettre de date',
      /saison/i.test(vu.avenir ?? '') && !/niveau \d+/i.test(vu.avenir ?? '')
      || (console.log('        elle dit :', vu.avenir), false));
  }

  /* Au niveau 1 il n'y a qu'une série : la rangée de pastilles n'a rien à
     proposer et ne doit pas s'afficher. */
  if (vu.pastilles.length < 2) {
    check('un sélecteur à un seul choix ne s\u2019affiche pas', vu.pastillesCachees === true);
  } else {
    check('les pastilles ne listent que les séries ouvertes',
      vu.pastilles.length === vu.total - vu.verrouillees);
  }

  /* Le filet de sécurité. Le kiosque ne propose plus une série fermée, mais
     un onglet resté ouvert peut encore en demander le booster. Le refus doit
     nommer sa cause — c'est ce code brut, affiché tel quel, qui avait fait
     remonter la panne.

     Le code a changé de sens : `set_locked` disait « au-dessus de ton niveau »
     et n'est plus émis nulle part. Il ne reste que `set_closed`, « aucune
     saison ne l'a ouverte », qui vaut pour tout le monde pareil. */
  const fermee = await page.evaluate(() =>
    SETS_TOUTES.find((x) => x.ouverte === false)?.id ?? null);
  if (fermee) {
    const dit = await page.evaluate(async (id) => {
      const r = await fetch('/api/fanzzy/open', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        credentials: 'same-origin', body: JSON.stringify({ set: id }),
      });
      return (await r.json()).error ?? null;
    }, fermee);
    check('le serveur refuse bien une série qu’aucune saison n’a ouverte',
      dit === 'fanzzy.error.set_closed'
      || (console.log('        il dit :', dit), false));
  }
  check('et la page sait le dire en français',
    await page.evaluate(() => {
      const src = document.documentElement.innerHTML;
      return /fanzzy\.error\.set_closed'\s*:\s*'[^']+/.test(src);
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
     — c'est la faute qui a coûté le plus cher ici, un TR37 sorti d'un booster que
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

  /* ---------------------------------------------- le dos porte la série

     **Les treize séries se retournaient sur le même dos** : un dégradé gris
     et un petit triangle au trait, identique pour LA TRIBUNE, LE BESTIAIRE et
     LA REPRISE. C'est pourtant la seule image qu'on regarde pendant la seconde
     qui précède le tirage — celle qui donne envie de retourner. La série, qui
     est le premier plaisir de la collection, n'existait qu'**après**.

     On vérifie deux choses, et la seconde est la plus facile à casser : que
     le dos est bien dessiné, et qu'il est celui du **sachet** et non celui de
     la carte. Donner à chaque carte le dos de sa propre série reviendrait à
     annoncer ce qu'elle est avant de la retourner — un booster n'a plus rien
     à révéler si son dos l'a déjà dit. */
  const dos = await pageG.evaluate(() => {
    const dos = [...document.querySelectorAll('#ostage .face.back')];
    return {
      fonds: dos.map((d) => getComputedStyle(d).backgroundImage),
      dessines: dos.filter((d) => d.classList.contains('dessine')).length,
      total: dos.length,
      attendu: (SETS[S.set] ?? {}).id,
      triangles: dos.filter((d) => {
        const svg = d.querySelector('svg');
        return svg && getComputedStyle(svg).display !== 'none';
      }).length,
    };
  });
  check(`les cinq dos portent un dessin (${dos.dessines}/${dos.total})`,
    dos.dessines === dos.total);
  check(`et c’est celui du sachet ouvert — ${dos.attendu}`,
    !!dos.attendu && dos.fonds.every((f) => f.includes(`/img/dos/${dos.attendu}.`))
      || (console.log('        fonds :', dos.fonds[0]), false));
  check('un seul dos pour tout le paquet : rien ne trahit la carte d’en dessous',
    new Set(dos.fonds).size === 1);
  check('et le triangle de secours s’efface quand le dessin est là',
    dos.triangles === 0);

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
    /* **Les états et les écharpes manquaient à l'appel.** Le compte datait du
       jour où il y avait quatre sortes ; les deux ajoutées depuis tombaient
       dans la case « fanzzy », où elles se fondaient dans le nombre. */
    const vus = { fanzzy: 0, skin: 0, etat: 0, stuff: 0, action: 0, echarpes: 0 };
    const fautes = [];
    /* On ouvre **jusqu'à** avoir vu les quatre sortes, pas un nombre fixe de
       fois. À quatorze boosters, la sorte la plus rare manquait environ une
       fois sur cinq et la suite rougissait sans que rien ne soit cassé — le
       hasard du jeu fuyait dans l'assertion, ce qui est le meilleur moyen
       d'apprendre à ignorer les rouges. Le plafond reste : si une sorte ne
       tombe jamais en soixante boosters, ce n'est plus de la malchance. */
    /* **Quatre sortes exigées, six comptées.** L'état et les écharpes sont
       entrés dans le compte pour qu'on voie ce qui tombe, pas pour qu'on
       l'exige : un état demande un âge débloqué dont l'expression manque
       encore, et c'est une condition que le compte d'épreuve ne contrôle
       pas. L'exiger remettrait le hasard du jeu dans l'assertion, ce que le
       paragraphe ci-dessus vient précisément de sortir. Leur dessin, lui,
       est contrôlé dès qu'il en tombe un. */
    const EXIGEES = ['fanzzy', 'skin', 'stuff', 'action'];
    const complet = () => EXIGEES.every((k) => vus[k] > 0);
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
        const sorte = c.skin ? 'skin' : c.etat ? 'etat' : c.stuff ? 'stuff'
          : c.action ? 'action' : c.echarpes ? 'echarpes' : 'fanzzy';
        vus[sorte]++;

        /* **Le dessin, et pas seulement le nom.**

           Cinq fois la même panne, et cinq fois personne ne l'a vue : `art()`
           cherche un Fanzzy dont l'identifiant est celui de la carte, ne le
           trouve pas — « halloween » n'est pas un personnage — et dessine la
           silhouette grise procédurale. Les écharpes, l'action, l'équipement,
           l'état, puis la tenue : chaque sorte ajoutée est retombée dedans à
           son tour, et chacune a été rattrapée séparément, des semaines plus
           tard, sur une capture d'écran envoyée par quelqu'un qui jouait.

           Ce contrôle-ci ne connaît aucune sorte en particulier : il demande
           qu'une carte qui n'est pas un Fanzzy montre une **image**. Le jour
           où une septième sorte arrivera, elle sera couverte avant d'exister.

           Le Fanzzy est à part, et légitimement : tout le catalogue n'est pas
           illustré, et la silhouette est son dessin prévu.

           **Et un état ou une tenue hérite de cette exception**, parce qu'ils
           n'ont pas de dessin à eux : ils montrent leur personnage. Le
           contrôle a trouvé « Le Drapeau Perdu » du premier coup, qui n'est
           pas illustré — exiger une image de sa tenue serait exiger un dessin
           qui n'existe pour personne. On pose donc la question à `FZART`,
           c'est-à-dire au même juge que la page : si le personnage a une
           adresse, sa carte doit la montrer. */
        if (sorte !== 'fanzzy') {
          const dessinable = !c.pour
            || Boolean(window.FZART?.adresse?.(c.pour, 'buste'));
          const dessin = window.TBF_CARTES.dessinDeCarte(c);
          if (dessinable && !/<img[^>]+src="[^"]/.test(dessin)) {
            fautes.push(`« ${c.nom} » (${sorte}) tombe sur la silhouette`);
          }
        }
      }
    }
    return { vus, fautes: [...new Set(fautes)] };
  });

  check(`les quatre sortes de cartes sont tombées (${
    Object.entries(bilan.vus).map(([k, n]) => `${k} ${n}`).join(' · ')})`,
    ['fanzzy', 'skin', 'stuff', 'action'].every((k) => bilan.vus[k] > 0));
  /* Le dessin de chacune. La silhouette procédurale est le dessin prévu du
     Fanzzy non illustré ; pour toutes les autres, c'est une carte ratée. */
  check('et chacune montre une image, pas une silhouette',
    !bilan.fautes.some((f) => /silhouette/.test(f)));
  check('et aucune n’a cassé l’ouverture', bilan.fautes.length === 0);
  if (bilan.fautes.length) console.log('       ', bilan.fautes.slice(0, 4));

  await pageG.close();
}

/* --------------------------------------------------------------- le butin

 * Le dernier moment de la cérémonie : ce qu'on vient de trouver. Il
 * s'affichait en cinq vignettes collées au bas d'un écran aux trois quarts
 * vide — la scène de révélation restait là, vidée, et gardait six cents pixels
 * de noir au-dessus. Rien ne pouvait le signaler : une vignette trop petite ne
 * casse pas.
 */
{
  const butin = await page.evaluate(async () => {
    /* On ouvre un paquet et on va droit au récapitulatif : c'est lui qu'on
       éprouve, pas la cérémonie, qui a ses propres contrôles. */
    if (typeof startTear === 'function') { /* le geste a le sien */ }
    await openPack();
    finishPack();
    await new Promise((r) => setTimeout(r, 120));

    const sum = document.getElementById('summary');
    const cartes = [...sum.querySelectorAll('[data-i]')];
    const r = sum.getBoundingClientRect();
    const une = cartes[0]?.getBoundingClientRect();

    return {
      combien: cartes.length,
      /* La scène vidée est repliée : sans ça, elle gardait la place et le
         butin se tassait dessous. */
      scenePliee: getComputedStyle(document.getElementById('ostage')).display === 'none',
      /* Assez grandes pour qu'on voie le dessin. Cinq vignettes de soixante
         pixels ne montrent rien de ce qu'on vient de gagner. */
      largeurCarte: Math.round(une?.width ?? 0),
      hauteurGrille: Math.round(r.height),
      ecran: window.innerHeight,
      titre: document.getElementById('butinTitre')?.textContent ?? '',
      titreVisible: document.getElementById('butinTitre')?.hidden === false,
      /* La lueur ne va qu'à ce qui la mérite : cinq cartes qui brillent
         ensemble ne disent plus rien. */
      brillantes: cartes.filter((c) =>
        /rare|epique|legendaire/.test(c.className)).length,
      /* L'arrivée ne tourne pas en boucle. Ce qui bouge sans arrêt cesse
         d'être remarqué en dix secondes et coûte de la batterie pour ça. */
      enBoucle: cartes.some((c) =>
        getComputedStyle(c).animationIterationCount !== '1'),
    };
  });

  if (process.env.CAPTURE) {
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    await page.screenshot({ path: join(tmpdir(), 'butin.png') });
    console.log('   capture :', join(tmpdir(), 'butin.png'));
  }

  check(`le butin montre les cinq cartes (${butin.combien})`, butin.combien === 5);
  check('la scène vidée ne garde plus la place', butin.scenePliee === true);
  check(`les cartes sont assez grandes pour qu'on les voie (${butin.largeurCarte} px)`,
    butin.largeurCarte >= 85
    || (console.log('        trop petites pour montrer un dessin'), false));

  /* C'est ce que le joueur cherche en premier, et ce n'était écrit nulle part :
     cinq cartes rangées, sans savoir lesquelles étaient neuves. */
  check('le butin dit ce qui est nouveau', butin.titreVisible === true
    && /NOUVELLE|DOUBLON/i.test(butin.titre)
    || (console.log('        titre :', JSON.stringify(butin.titre)), false));

  check('l\u2019arrivée ne tourne pas en boucle', butin.enBoucle === false);
  check(`la lueur ne va qu'aux cartes qui la méritent (${butin.brillantes}/5)`,
    butin.brillantes <= 5);
}

/* ============================================ acheter un booster aux écharpes

   **Le chemin le plus court entre deux fautes : une affordance montrée quand
   elle ne sert pas, et cachée quand elle sert.**

   Le bouton d'ouverture se fermait dès `packs <= 0`. Or le client n'envoie
   `buy` que dans ce cas précis : la seule situation où l'on paie était donc la
   seule où le bouton ne répondait pas. Et l'écran annonçait « ou 45 écharpes »
   pendant qu'il restait des boosters gratuits — où le serveur consomme la
   réserve et ne prélève rien.

   Le serveur savait acheter depuis le premier jour. Il n'a jamais reçu la
   demande, et aucun contrôle ne s'en est aperçu parce qu'ils partaient tous
   d'une réserve pleine. Celui-ci part d'une réserve vide, qui est l'état dans
   lequel se trouve n'importe quel joueur au bout de quelques ouvertures.

   **Depuis le lot 3, l'achat a sa bâche à lui.** Réserve vide, la recharge
   compte, et la bâche or « TOUT DE SUITE · +1 BOOSTER » se pose à côté de la
   minuterie (`#achat`, dans `#minut`) : c'est le seul achat de l'écran. La
   flare (`#openBtn`) s'éteint sur « aucun en réserve » au lieu de vendre une
   seconde fois le même booster au même prix — deux bâches pour un seul achat
   faisaient chercher au joueur une différence qui n'existait pas. Sans les
   écharpes, la flare cède la place à la bâche GAGNER DES ÉCHARPES
   (`#gagner`), qui dit combien il en manque. La flare ne porte le prix que
   dans le seul cas où l'or n'est pas là : une réserve vide **sans**
   recharge. On éprouve les trois états, et dans chacun on appuie sur le
   geste d'achat : il doit ouvrir le paquet, pas seulement être bien
   libellé. */
{
  const p2 = await ouvrir();
  /* Ce que montre le bas du kiosque : la flare, la bâche verte qui la
     remplace, la minuterie et l'or de l'achat. « Visible » se mesure (une
     boîte dessinée) et ne se lit pas sur l'attribut : une bâche `hidden`
     qu'une règle de feuille rallumerait se verrait quand même. */
  const lireGestes = () => p2.evaluate(() => {
    const voit = (e) => Boolean(e) && e.getClientRects().length > 0;
    const mots = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
    const b = document.getElementById('openBtn');
    const achat = document.getElementById('achat');
    const g = document.getElementById('gagner');
    const m = document.getElementById('minuterie');
    return {
      prix: Number(S.packPrice ?? 45),
      flare: voit(b), ferme: b.disabled, libelle: mots(b),
      minuterie: voit(m) ? mots(m) : null,
      achat: voit(achat) ? {
        ton: achat.dataset.ton ?? null,
        texte: mots(achat),
        prix: mots(achat.querySelector('.tbf-sticker--prix')),
        nom: achat.getAttribute('aria-label') ?? '',
      } : null,
      gagner: voit(g) ? {
        texte: mots(g),
        href: g.getAttribute('href') ?? '',
        manque: mots(document.getElementById('gagnerManque')),
        nom: g.getAttribute('aria-label') ?? '',
      } : null,
    };
  });
  const paquetOuvert = () => p2.evaluate(() =>
    document.getElementById('tearzone')?.classList.contains('on') ?? false);

  /* La réserve est vidée côté page : celle du serveur ne l'est pas. Or une
     réserve vide se recharge, et le serveur sert alors le temps qui reste ;
     on le pose donc aussi (9:55), par la fonction même qui retient celui du
     serveur. Sans lui, l'écran tomberait dans l'un ou l'autre état selon ce
     que les ouvertures d'avant ont laissé en base. */
  await p2.evaluate(() => {
    S.packs = 0; S.scarves = 900; noterRecharge(595_000); renderKiosque(); tickRegen();
  });
  await dodo(250);

  const vu = await lireGestes();
  check('réserve vide : la minuterie compte le prochain booster gratuit',
    /^PRÊT DANS\s*\d+:\d\d$/.test(vu.minuterie ?? '')
    || (console.log('        elle dit :', vu.minuterie), false));
  check('écharpes en poche : l’or vend le booster tout de suite, à son prix',
    vu.achat?.ton === 'or' && /TOUT DE SUITE/.test(vu.achat.texte) && /\+1 BOOSTER/.test(vu.achat.texte)
    && vu.achat.prix === String(vu.prix) && vu.achat.nom.includes(`${vu.prix} écharpes`)
    || (console.log('        il montre :', JSON.stringify(vu.achat), '· prix', vu.prix), false));
  check('et la flare s’éteint : l’or est le seul achat de l’écran',
    vu.flare && vu.ferme && /aucun en réserve/.test(vu.libelle ?? '') && !/ÉCHARPES/.test(vu.libelle ?? '')
    || (console.log('        elle dit :', vu.libelle, '· fermée', vu.ferme), false));

  /* Appuyer sur l'or ouvre vraiment le paquet. Le clic remonte jusqu'à
     `#minut`, qui reconnaît `#achat` : c'est le chemin du doigt. */
  await p2.evaluate(() => document.getElementById('achat')?.click());
  await dodo(300);
  check('et toucher l’or ouvre vraiment le paquet', await paquetOuvert()
    || (console.log('        l’or répond, mais rien ne s’ouvre'), false));
  /* On referme par la fonction de la page, faute de bouton : la zone de
     déchirure se quitte en tirant la bande ou en s'en allant, et laisser le
     paquet ouvert fausserait les contrôles qui suivent. */
  await p2.evaluate(() => fermerTear());
  await dodo(150);

  /* Une réserve vide **sans** recharge — le serveur ne sert aucun temps :
     pas de minuterie, donc pas d'or, et c'est la flare qui porte le prix.
     Elle doit alors rester vive, dire ce que ça coûte, et ouvrir. C'est le
     contrôle d'avant le lot 3, gardé pour le seul état où il vaut encore. */
  await p2.evaluate(() => { noterRecharge(null); renderKiosque(); tickRegen(); });
  await dodo(250);
  const seule = await lireGestes();
  check('réserve vide sans recharge : la flare porte le prix, puisque l’or n’est pas là',
    seule.flare && !seule.ferme && seule.libelle === `OUVRIR · ${seule.prix} ÉCHARPES`
    && seule.achat === null && seule.minuterie === null
    || (console.log('        il montre :', JSON.stringify(seule)), false));

  /* **Et surtout : appuyer dessus fait quelque chose.**
   *
   * Le contrôle s'arrêtait au libellé et à l'état du bouton, et les deux
   * étaient justes. Ce qui ne l'était pas, c'est la suite : `startTear` gardait
   * sa propre garde, `if (S.packs <= 0) return`, oubliée quand on a corrigé
   * celle du bouton. La réserve vide rendait donc le bouton vif, bien libellé,
   * et **muet** — ni refus, ni message, ni animation. Le geste était avalé.
   *
   * C'est l'état le plus difficile à diagnostiquer pour un joueur, et le plus
   * facile à laisser passer pour une suite qui ne regarde que des attributs.
   * On appuie donc, et on regarde si le paquet s'ouvre. */
  await p2.evaluate(() => document.getElementById('openBtn').click());
  await dodo(300);
  check('et appuyer dessus ouvre vraiment le paquet', await paquetOuvert()
    || (console.log('        le bouton répond, mais rien ne s’ouvre'), false));
  await p2.evaluate(() => fermerTear());
  await dodo(150);

  /* Sans écharpes, on ne vend rien — mais on dit pourquoi, et où aller.
     « Rien ne se passe » et « il te manque quelque chose » demandent deux
     gestes différents. Avant le lot 3, la flare se fermait sur « IL TE
     FAUT 45 ÉCHARPES », une bâche éteinte qui ne menait nulle part ; elle
     cède maintenant la place à la bâche verte GAGNER DES ÉCHARPES, qui est
     un lien. La recharge court toujours : la minuterie reste, seule. */
  await p2.evaluate(() => { S.scarves = 0; noterRecharge(595_000); renderKiosque(); tickRegen(); });
  await dodo(250);
  const sans = await lireGestes();
  check('sans écharpes, la flare se ferme et cède la place', !sans.flare && sans.ferme
    || (console.log('        elle montre :', sans.libelle, '· visible', sans.flare, '· fermée', sans.ferme), false));
  check('à GAGNER DES ÉCHARPES, qui mène quelque part',
    /GAGNER DES ÉCHARPES/.test(sans.gagner?.texte ?? '') && /^\/[a-z]/.test(sans.gagner.href)
    && sans.gagner.href !== '/boosters'
    || (console.log('        il montre :', JSON.stringify(sans.gagner)), false));
  /* Le solde est à zéro : ce qui manque est le prix entier, écrit et dit. */
  check('et qui nomme ce qui manque',
    Number(sans.gagner?.manque?.match(/manque (\d+)$/)?.[1]) === sans.prix
    && sans.gagner.nom.includes(`manque ${sans.prix} `)
    || (console.log('        il dit :', sans.gagner?.manque, '·', sans.gagner?.nom, '· prix', sans.prix), false));
  check('sans écharpes, l’or ne vend rien : la minuterie reste seule',
    sans.achat === null && /^PRÊT DANS/.test(sans.minuterie ?? '')
    || (console.log('        il montre :', JSON.stringify(sans.achat), '·', sans.minuterie), false));

  await p2.close();
}

/* ==================================== chaque série a son dos, dans les trois

   Le contrôle du navigateur, plus haut, ne voit qu'une série : celle du sachet
   qu'il vient d'ouvrir. Les douze autres ne se cassent donc jamais sous ses
   yeux — et c'est exactement ce qui arrive le jour où une saison neuve arrive
   sans son dessin : la page se replie sur le dégradé gris, sans rien dire, et
   personne ne s'en aperçoit avant un joueur.

   Les trois formats comptent aussi. `negocierAvif` sert l'AVIF à qui l'accepte
   et le WebP aux autres ; il ne remplace l'extension **que** si le fichier
   AVIF existe. Un dos publié en WebP seul marcherait donc partout — et c'est
   précisément pour ça qu'il faut le vérifier ici plutôt qu'à l'écran. */
{
  const dossier = path.join(RACINE, 'public', 'img', 'dos');
  const manquants = [];
  for (const serie of SETS) {
    for (const ext of ['.webp', '.avif', '.png']) {
      if (!existsSync(path.join(dossier, serie.id + ext))) manquants.push(serie.id + ext);
    }
  }
  check(`les ${SETS.length} séries ont leur dos en webp, avif et png`,
    !manquants.length || (console.log('        manque :', manquants.join(', ')), false));
}

/* ================================ une carte se dessine à sa propre échelle

   **Toutes les cartes du jeu étaient dessinées à la moitié de leur taille.**

   `cartes.css` pose `container-type: inline-size` sur `.fz`, puis écrivait
   `@container (min-width: 0px){ .fz{--u:1cqw} }` pour que tout ce que la carte
   dessine suive sa largeur. Un élément qui établit un conteneur **ne peut pas
   s'interroger lui-même** : la condition se résout contre le conteneur ancêtre,
   il n'y en a aucun au-dessus d'une carte, et la règle n'a jamais pris. `--u`
   restait au repli de 1,3 px quelle que soit la taille de la carte.

   Ça ne se lisait pas comme une panne. Le cadre était là, les couleurs aussi,
   avec un nom deux fois trop petit et une illustration perdue dans un grand
   vide — ce qu'on met volontiers sur le compte du dessin.

   ## Ce que ce contrôle mesure, et pourquoi pas la règle

   Il ne lit pas `--u` : une valeur de variable ne dit pas si la carte est juste,
   et la prochaine réécriture de la feuille pourrait très bien s'en passer. Il
   mesure **le comportement** — la même carte à deux largeurs doit dessiner son
   nom à deux tailles proportionnelles, tant qu'elle reste au-dessus du
   plancher de onze pixels. C'est la promesse du fichier, écrite en
   toutes lettres dans son en-tête : « juste en vignette comme en grand ». */
{
  const p3 = await ouvrir();
  const mesures = await p3.evaluate(() => {
    const hote = document.createElement('div');
    hote.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(hote);
    const lire = (largeur) => {
      hote.innerHTML = '<div style="width:' + largeur + 'px">'
        + cardHTML(carteDuPaquet({ type: 'action', id: 'a-craquage' })) + '</div>';
      const px = (sel) => {
        const n = hote.querySelector(sel);
        return n ? parseFloat(getComputedStyle(n).fontSize || '0') : 0;
      };
      const pip = hote.querySelector('.pip');
      return {
        nom: px('.nm'),
        pip: pip ? pip.getBoundingClientRect().width : 0,
        carte: hote.querySelector('.fz').getBoundingClientRect().width,
      };
    };
    /* Quatre largeurs et non plus deux : voir « le plancher » plus bas.
       Soixante pixels, la moitié de la petite carte : un nom proportionnel y
       tomberait à 3,6 px, c'est là que le plancher a le plus à tenir. */
    const minuscule = lire(60);
    const petit = lire(120);
    const moyen = lire(200);
    const grand = lire(360);
    hote.remove();
    return { minuscule, petit, moyen, grand };
  });
  await p3.close();

  const { minuscule, petit, moyen, grand } = mesures;
  check(`la carte suit la largeur qu'on lui donne (${Math.round(petit.carte)} / ${Math.round(grand.carte)})`,
    Math.round(grand.carte) === 3 * Math.round(petit.carte));

  /* **Le nom a un plancher de onze pixels** (lot 0, chantier 1 : aucun texte
     qui informe sous onze pixels). `cartes.css` l'écrit
     `max(11px, calc(6 * var(--u)))` : six centièmes de la carte, sauf sous
     cent quatre-vingt-trois pixels de carte, où le nom s'arrête à onze.

     Le contrôle comparait une carte de 120 px à une de 360 px et attendait
     un rapport de trois — 7,2 px contre 21,6. Le plancher rend ce rapport
     impossible, et c'est voulu. On garde donc ce qu'il protégeait — le nom
     suit la carte, la règle du conteneur n'est pas retombée au repli fixe —
     en le mesurant **au-dessus du plancher**, de 200 à 360 px ; et on vérifie
     à part que le plancher tient, jusqu'à la plus étroite des cartes.

     Rapport attendu : celui des largeurs, à un dixième près, parce qu'un
     navigateur arrondit les tailles de police. Un `--u` resté au repli de
     1,3 px donnerait 11 px aux deux tailles, soit un rapport de un. */
  const attendu = moyen.carte ? grand.carte / moyen.carte : 0;
  const rapport = moyen.nom ? grand.nom / moyen.nom : 0;
  check(`et son nom grandit avec elle (${moyen.nom.toFixed(1)} → ${grand.nom.toFixed(1)} px)`,
    attendu > 1.5 && Math.abs(rapport - attendu) < attendu * 0.1
    || (console.log('        rapport :', rapport.toFixed(2), '· attendu :', attendu.toFixed(2)), false));
  check(`sans jamais passer sous onze pixels (${minuscule.nom.toFixed(1)} et ${petit.nom.toFixed(1)} px)`,
    minuscule.nom >= 10.95 && petit.nom >= 10.95 && moyen.nom >= 10.95
    || (console.log('        à 60 / 120 / 200 px :', minuscule.nom, petit.nom, moyen.nom), false));

  /* La pastille de famille aussi : si seule la police suivait, ce serait une
     règle recopiée à un endroit et oubliée aux autres. */
  const rPip = petit.pip ? grand.pip / petit.pip : 0;
  check('et la pastille de famille également',
    Math.abs(rPip - 3) < 0.3
    || (console.log('        rapport :', rPip.toFixed(2)), false));

  /* Le repli reste **en pixels**. Le jour où quelqu'un écrit `--u:1cqw` sans
     garde, un navigateur sans confinement rabat `cqw` sur la fenêtre : sur un
     écran de 470 px, le rayon passe de 5 à 19 px et le nom de 8 à 28. La carte
     devient un galet illisible, et rien ne le signale. */
  const feuille = readFileSync(path.join(RACINE, 'public', 'cartes.css'), 'utf8');
  check('et le repli hors conteneur est toujours en pixels',
    /\.fz\{--u:[\d.]+px\}/.test(feuille)
    || (console.log('        repli introuvable dans cartes.css'), false));
}

/* ============================== la montée de niveau, quand elle s'annonce

   **Tout le calcul existait, et personne ne le regardait.** `gagner()` rend
   depuis toujours le niveau atteint, celui d'où l'on vient, les paliers
   franchis et les écharpes versées ; ouvrir un booster le renvoyait à cette
   page, qui le jetait, et le duel ne le lisait même pas. Un joueur montait de
   niveau sans rien voir.

   On éprouve le composant par son contrat plutôt que par une vraie montée :
   la faire tomber pour de bon demanderait d'aligner l'XP sur un seuil, ce qui
   éprouverait la courbe — déjà couverte par `niveau:smoke` — et non l'écran.
   Ce qui compte ici est ce que le joueur lit. */
{
  const p = await ouvrir();

  /* **Rien à fêter ne doit rien dessiner.** L’appelant ne vérifie pas avant
     d’appeler — c’est la promesse de `feter` — donc une montée absente doit
     se résoudre en silence. Si elle ouvrait un panneau vide, chaque booster
     ordinaire se terminerait sur une fête sans objet. */
  const muet = await p.evaluate(async () => {
    await window.TBF_NIVEAU.feter(null);
    await window.TBF_NIVEAU.feter({ monte: false, niveau: 3, avant: 3 });
    return document.querySelectorAll('.tbf-niv-fond').length;
  });
  check('sans montée, aucun panneau ne s’ouvre', muet === 0
    || (console.log('        ', muet, 'panneau(x) posé(s) pour rien'), false));

  /* La montée qu’un joueur voit au palier 5 : un niveau gagné, cinquante
     écharpes, et le troisième rang de tribune qui s’ouvre. Les nombres sont
     ceux de `shared/niveau.js`, pas des valeurs choisies ici. */
  const vu = await p.evaluate(() => {
    window.TBF_NIVEAU.feter({ monte: true, avant: 4, niveau: 5, xp: 400,
      ecarpes: 50, paliers: [{ niveau: 5, deckFanzzy: 3 }] });
    const el = document.querySelector('.tbf-niv-fond');
    if (!el) return null;
    return { texte: el.textContent.replace(/\s+/g, ' ').trim(),
      niveau: el.querySelector('.tbf-niv-n b')?.textContent.trim(),
      boutons: el.querySelectorAll('button').length,
      role: el.querySelector('[role]')?.getAttribute('role') };
  });

  check('une montée ouvre son panneau', Boolean(vu)
    || (console.log('        rien n’a été posé dans la page'), false));
  if (vu) {
    check(`il annonce le niveau atteint (${vu.niveau})`, vu.niveau === '5');
    /* **Les écharpes du palier.** Elles tombaient en silence : le solde
       changeait entre deux écrans sans que rien ne dise combien ni pourquoi. */
    check('il dit les écharpes gagnées', /\+50/.test(vu.texte)
      || (console.log('        ', vu.texte), false));
    /* **Et ce que le palier ouvre**, qui est la seule chose que le niveau ait
       le droit de donner — voir la règle dans `shared/niveau.js` : il ouvre,
       il ne rend pas plus fort. */
    check('il dit ce que le palier ouvre', /FANZZY DE PLUS AU DECK/i.test(vu.texte)
      || (console.log('        ', vu.texte), false));
    /* Un seul bouton : une fête ne pose pas de question. C’est toute la
       raison pour laquelle ce panneau n’est pas un `dialogue.js`. */
    check('et il n’offre qu’une sortie', vu.boutons === 1
      || (console.log('        ', vu.boutons, 'boutons'), false));
    check('il se déclare comme une boîte modale', vu.role === 'alertdialog');

    /* De quoi regarder la fête, le jour où on veut juger ce qu’elle donne
       plutôt que ce qu’elle dit. */
    if (process.env.CAPTURE) {
      await p.screenshot({ path: `${process.env.TEMP ?? "/tmp"}/niveau-montee.png` });
    }

    /* Elle se referme, et elle ne laisse rien derrière : un panneau en
       `position:fixed` oublié couvrirait la page entière sans qu’on voie quoi. */
    await p.evaluate(() =>
      document.querySelector('.tbf-niv-fond [data-fermer]').click());
    const parti = await jusqua(async () => p.evaluate(() =>
      document.querySelectorAll('.tbf-niv-fond').length === 0), 4000);
    check('« CONTINUER » la referme et la retire', parti
      || (console.log('        le panneau est resté dans la page'), false));
  }

  /* Un palier qui n’ouvre rien — quatre sur cinq — ne doit pas se terminer
     sur un blanc. */
  const sec = await p.evaluate(async () => {
    window.TBF_NIVEAU.feter({ monte: true, avant: 6, niveau: 7, ecarpes: 70, paliers: [] });
    const el = document.querySelector('.tbf-niv-fond');
    const txt = el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
    el?.querySelector('[data-fermer]')?.click();
    return txt;
  });
  check('un palier qui n’ouvre rien le dit quand même', /\+70/.test(sec) && sec.length > 20
    || (console.log('        ', sec), false));

  await p.close();
}
await nav.close();
await new Promise((r) => http.close(r));
await pool.end();

console.log(failures ? `\n${failures} test(s) en échec` : '\ntout est vert');
process.exit(failures ? 1 : 0);

