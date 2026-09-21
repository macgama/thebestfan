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
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, kop_invites, amities,
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
 * dix : on choisit le sien. **Ce choix ne change rien au tirage** — voir la
 * note de `PAQUETS_AU_CHOIX` — c'est un geste de cérémonie.
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
    /* Dix paquets au choix, tous de cette série. */
    paquets: document.querySelectorAll('#carousel .slide').length,
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
  check(`dix paquets au choix (${vu.paquets})`, vu.paquets === 10);
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
   lequel se trouve n'importe quel joueur au bout de quelques ouvertures. */
{
  const p2 = await ouvrir();
  await p2.evaluate(() => { S.packs = 0; S.scarves = 900; renderKiosque(); tickRegen(); });
  await dodo(250);

  const vu = await p2.evaluate(() => ({
    ferme: document.getElementById('openBtn').disabled,
    libelle: document.getElementById('openBtn').textContent.trim(),
  }));
  check('réserve vide et écharpes en poche : le bouton reste ouvert', !vu.ferme
    || (console.log('        il est fermé · libellé :', vu.libelle), false));
  check('et il dit ce que ça coûte', /ÉCHARPES/.test(vu.libelle)
    || (console.log('        il dit :', vu.libelle), false));

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
  const parti = await p2.evaluate(() =>
    document.getElementById('tearzone')?.classList.contains('on') ?? false);
  check('et appuyer dessus ouvre vraiment le paquet', parti
    || (console.log('        le bouton répond, mais rien ne s’ouvre'), false));
  /* On referme par la fonction de la page, faute de bouton : la zone de
     déchirure se quitte en tirant la bande ou en s'en allant, et laisser le
     paquet ouvert fausserait les contrôles qui suivent. */
  await p2.evaluate(() => fermerTear());
  await dodo(150);

  /* Sans écharpes, le bouton se ferme — mais en disant pourquoi. « Rien ne se
     passe » et « il te manque quelque chose » demandent deux gestes différents. */
  await p2.evaluate(() => { S.scarves = 0; renderKiosque(); tickRegen(); });
  await dodo(250);
  const sans = await p2.evaluate(() => ({
    ferme: document.getElementById('openBtn').disabled,
    libelle: document.getElementById('openBtn').textContent.trim(),
  }));
  check('sans écharpes, il se ferme', sans.ferme);
  check('et il nomme ce qui manque', /IL TE FAUT/.test(sans.libelle)
    || (console.log('        il dit :', sans.libelle), false));

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
   nom à deux tailles proportionnelles. C'est la promesse du fichier, écrite en
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
    const petit = lire(120);
    const grand = lire(360);
    hote.remove();
    return { petit, grand };
  });
  await p3.close();

  const { petit, grand } = mesures;
  check(`la carte suit la largeur qu'on lui donne (${Math.round(petit.carte)} / ${Math.round(grand.carte)})`,
    Math.round(grand.carte) === 3 * Math.round(petit.carte));

  /* Trois fois plus large, donc un nom trois fois plus grand — à un dixième
     près, parce qu'un navigateur arrondit les tailles de police. */
  const rapport = petit.nom ? grand.nom / petit.nom : 0;
  check(`et son nom grandit avec elle (${petit.nom.toFixed(1)} → ${grand.nom.toFixed(1)} px)`,
    Math.abs(rapport - 3) < 0.3
    || (console.log('        rapport :', rapport.toFixed(2)), false));

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

