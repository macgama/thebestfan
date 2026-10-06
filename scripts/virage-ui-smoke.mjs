/**
 * Test d'interface du Grand Virage : le fil du match.
 *
 * `virage-smoke` éprouve la salle — ce que le serveur calcule et diffuse. Il ne
 * dit rien de ce que le supporter voit, et c'est là que trois choses se
 * jouent, qu'aucune lecture du code ne tranche :
 *
 *   1. **Le fil arrive avec l'état.** Un joueur qui entre à la soixante-dixième
 *      minute doit trouver l'écran garni. Un fil qui ne se remplit qu'au
 *      prochain carton est un fil vide pour la plupart des visites.
 *
 *   2. **Le vocabulaire est français.** L'API parle anglais — `Red Card`,
 *      `Normal Goal`, `Substitution 1`. Ces mots traversaient la page tels
 *      quels tant que personne ne regardait le rendu.
 *
 *   3. **On peut refermer.** `ui.css` donne à la colonne un `z-index: 1`, ce
 *      qui en fait un contexte d'empilement : un panneau posé dedans passe
 *      *sous* les bandeaux plein écran de `fx.js`, tête et bouton de fermeture
 *      compris. Le calcul est invisible à la lecture ; seul un vrai navigateur
 *      dit qui est au-dessus de qui.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import express from 'express';
import { Server } from 'socket.io';
import puppeteer from 'puppeteer';
import { createSouvenirs } from '../src/server/souvenirs/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { createVirage } from '../src/server/ferveur/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops,
  user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
  souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
  duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
  leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
/* `stades.sql` en plus : le virage montre le Fanzzy **à l'âge atteint**, et
   cet âge est la colonne `stage` de `user_fanzzy`. Sans elle, la requête lève
   au moment d'entrer dans la tribune — c'est la panne la plus chère du projet,
   celle d'un code en ligne qui attend de la base quelque chose qu'elle n'a
   pas. Le garde-fou du démarrage la réclame déjà ; la suite doit monter le
   même schéma que le serveur, sinon elle éprouve un jeu qui n'existe pas. */
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql',
                 'tenues.sql', 'stades.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'cccccccc-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'virage-ui@ex.fr', 'Momo']);
await raw.query(`INSERT INTO user_wallet (user_id, scarves, active_fanzzy)
                 VALUES (?, 100, 'TR32')`, [U]);
/* Le Fanzzy équipé est **monté au second âge**, et c'est délibéré : la tribune
   doit montrer le Meneur de chant, pas le Choriste. Au premier âge, une page
   qui ignorerait complètement le stade passerait tous les contrôles. */
await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage)
                 VALUES (?, 'TR32', 1, 2)`, [U]);
/* Le club du joueur a ses couleurs, lues une fois dans son blason. Elles sont
   **volontairement sombres** : un bleu marine de blason, écrit tel quel sur le
   noir de l'écran, ne se lit pas du tout. C'est le cas qu'on veut éprouver —
   celui où la couleur juste donne un texte invisible. */
await raw.query(`INSERT INTO teams (id,name,color1,color2) VALUES
  (85,'FC Sion','#0B1E5B','#FFFFFF'),(91,'FC Bâle',NULL,NULL)`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
await raw.query(`INSERT INTO user_follows (user_id,team_id) VALUES (?,85)`, [U]);

/* Le match est en cours depuis un moment, et la base en sait déjà quelque
   chose : c'est le relevé du direct qui l'a remplie. Le joueur arrive au
   milieu — c'est le cas ordinaire, et celui qui montre si le fil est semé. */
/* `polled_at=NOW(3)` — écrit exactement comme le relevé du direct l'écrit, et
   c'est tout l'intérêt : NOW(3) date dans le fuseau de la session MySQL alors
   que le pilote lit en UTC. Un match semé sans cette colonne laissait `luA` à
   nul, et le contrôle de l'horloge ne pouvait rien éprouver du tout. */
/* Un second match du même club, en jeu lui aussi, pour les sorties (en fin
   de suite) : le premier a reçu son coup de sifflet entre-temps, et une page
   qui entre dans un match fini fait d'elle-même ce que fait le coup de
   sifflet — elle demande son bilan, puis quitte la salle. Sur lui, le
   contrôle de RESTER voyait partir un `virage:leave` qu'aucun bouton
   n'avait demandé. */
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,
                                       home_goals,away_goals,elapsed,kickoff_at,polled_at)
                 VALUES (8001,207,2026,85,91,'2H',2,1,71,UTC_TIMESTAMP(),NOW(3)),
                        (8002,207,2026,85,91,'2H',0,0,55,UTC_TIMESTAMP(),NOW(3))`);
await raw.query(`INSERT INTO fixture_events
                   (fixture_id,seq,type,detail,team_id,player,assist,minute)
                 VALUES (8001,0,'Card','Yellow Card',91,'Zambrano',NULL,12),
                        (8001,1,'Goal','Normal Goal',85,'Diallo','Morel',23),
                        (8001,2,'subst','Substitution 1',91,'Roth','Keller',30),
                        (8001,3,'Card','Red Card',91,'Keller',NULL,66)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerTenues(pool);

/* ----------------------------------------------------------- le serveur */

const app = express();
const http = createServer(app);
const io = new Server(http);
io.use((s, next) => { s.data.user = { userId: U, name: 'Momo' }; next(); });
const auth = (r, _s, n) => { r.user = { id: U }; n(); };
const souvenirs = createSouvenirs({ pool, requireAuth: auth });
const fanzzy = createFanzzy({ pool, requireAuth: auth });
const virage = createVirage({ pool, io, souvenirs, fanzzy, requireAuth: auth });
app.use('/api/virage', virage.router);
app.get('/virage', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'virage.html')));
/* `nav.js` demande qui est connecté avant de monter la barre du haut. Sans
   cette route, pas de bouton de menu — et depuis que la barre du bas a
   disparu, plus aucune sortie du Virage. */
app.get('/api/auth/me', (_q, s) => s.json({ user: { id: U, pseudo: 'Testeur' } }));
/* Le bandeau d'annonce de l'administration, que `nav.js` lit dans les
   réglages publics : aucun, comme le plus souvent en ligne ; le bloc qui
   l'éprouve en pose un le temps de charger sa page (voir plus bas). */
let annonceDuBanc = null;
app.get('/api/public/reglages', (_q, s) => s.json(annonceDuBanc ? { annonce: annonceDuBanc } : {}));
app.use(express.static(path.join(RACINE, 'public')));
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

/* -------------------------------------------------------------- la page */

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 880 });
await page.goto(base + '/virage', { waitUntil: 'networkidle0' });
await page.evaluate(() => socket.emit('virage:join', { fixtureId: 8001 }));
const entre = await page.waitForSelector('#fil:not([hidden])', { timeout: 8000 })
  .then(() => true).catch(() => false);
check('la bande du fil paraît dès l’entrée dans le virage', entre);

/* Des captures, à la demande : SHOT=<dossier> npm run virage:ui. Elles ne
   prouvent rien — elles servent à regarder ce que le joueur voit, ce qu'aucune
   mesure de rectangle ne raconte. */
if (process.env.SHOT) {
  await page.setViewport({ width: 1200, height: 900 });
  await wait(400);
  await page.screenshot({ path: process.env.SHOT + '/v-jeu-1200.png' });
  await page.setViewport({ width: 400, height: 880 });
  await wait(400);
  await page.screenshot({ path: process.env.SHOT + '/v-jeu-400.png' });

  const attente = await nav.newPage();
  await attente.setViewport({ width: 1200, height: 900 });
  await attente.goto(base + '/virage', { waitUntil: 'networkidle0' });
  await wait(900);
  await attente.screenshot({ path: process.env.SHOT + '/v-attente-1200.png' });
  await attente.setViewport({ width: 400, height: 880 });
  await wait(400);
  await attente.screenshot({ path: process.env.SHOT + '/v-attente-400.png' });
  await attente.close();
}

/* ------------------------------------------- l'horloge du vrai match

   La panne la plus chère du projet, et sa deuxième occurrence : `polled_at`
   est écrit par `NOW(3)`, donc dans le fuseau de la session MySQL, tandis que
   le pilote lit avec `timezone: 'Z'`. L'instant de lecture partait deux heures
   dans le futur ; `Date.now() - vuA` devenait négatif, l'horloge cessait de
   compter, et la minute restait figée jusqu'au rechargement — dans le Virage
   comme sur l'écran de choix.

   Aucune lecture de code ne l'attrape : les deux lignes sont justes chacune de
   son côté. Il faut une vraie base, un vrai fuseau, et comparer à l'horloge du
   moment. C'est exactement ce que fait ce contrôle. */
{
  const live = await page.evaluate(async () => {
    const r = await fetch('/api/virage/live', { credentials: 'same-origin' });
    return r.ok ? (await r.json()).matchs : null;
  });
  const m = (live ?? []).find((x) => x.luA != null);
  check('le serveur date la lecture de chaque match en direct', Boolean(m));
  const avance = m ? Math.round((m.luA - Date.now()) / 60_000) : 0;
  check('et cette date n’est pas dans le futur',
    Boolean(m) && m.luA <= Date.now() + 5_000
    || (console.log(`        luA en avance de ${avance} minutes`), false));

  /* Le même instant, côté salle : c'est lui qui fait courir la minute pendant
     qu'on pousse. Il vient de la même colonne et se trompait de la même façon. */
  const vuA = await page.evaluate(() => S?.vuA ?? null);
  check('la salle aussi date ce qu’elle sait du match', vuA != null);
  check('et sans partir dans le futur non plus',
    vuA != null && vuA <= Date.now() + 5_000
    || (console.log(`        vuA en avance de `
      + `${Math.round(((vuA ?? 0) - Date.now()) / 60_000)} minutes`), false));

  /* Et la conséquence, qui est ce que le joueur voyait : la minute affichée.
     Un `vuA` deux heures en avance la laisse exactement sur la valeur lue en
     base, pour toujours. On avance l'horloge de la page de six minutes et on
     regarde si elle suit. */
  const suit = await page.evaluate(() => {
    const vrai = Date.now;
    const avant = window.TBF_HORLOGE.texte(
      { statut: S.statut, minute: S.minute, extra: S.minuteExtra, vuA: S.vuA });
    Date.now = () => vrai() + 6 * 60_000;
    const apres = window.TBF_HORLOGE.texte(
      { statut: S.statut, minute: S.minute, extra: S.minuteExtra, vuA: S.vuA });
    Date.now = vrai;
    return { avant, apres };
  });
  check('six minutes plus tard, la minute affichée a bougé',
    suit.avant !== suit.apres
    || (console.log(`        elle dit « ${suit.avant} » avant comme après`), false));
}

/* ------------------------------------------ personne en face (§ 16.7)

   La retombée de la corde part depuis le 5 octobre 2026. Lue au sens de la
   corde, elle aurait fait sauter la tribune d'en face à chaque recul, vide
   comprise : la foule saute sur `pousse`, le signe du serveur. Et la tribune
   vide se dit en toutes lettres, au lieu d'un « 0 ». */
{
  const vu = await page.evaluate(() => {
    const garde = { rope: S.rope, crowd: S.crowd, goals: S.goals, surge: S.surge };
    const tick = (t) => { for (const f of socket.listeners('virage:tick')) f(t); };
    const mine = S.you.side;
    const camps = (nous, eux) => (mine === 0 ? [nous, eux] : [eux, nous]);
    const vers = (x) => (mine === 0 ? -x : x);          // positif : vers chez eux
    const foe = document.getElementById('crowdFoe');
    const me = document.getElementById('crowdMe');
    const compte = document.getElementById('compteEux');
    const calmer = () => { foe.classList.remove('pousse'); me.classList.remove('pousse'); };
    const t = { goals: S.goals, surge: false };
    P.compteJusqua = 0;                                  // le compte d'entrée est fini
    calmer();
    tick({ ...t, rope: vers(120), crowd: camps(1, 0), pousse: camps(true, false) });
    const seul = { compte: compte.textContent.trim(), marque: compte.hasAttribute('data-personne'),
                   moi: me.classList.contains('pousse') };
    calmer();
    tick({ ...t, rope: vers(117), crowd: camps(1, 0), pousse: camps(false, false) });
    const recul = { eux: foe.classList.contains('pousse'), moi: me.classList.contains('pousse') };
    calmer();
    tick({ ...t, rope: vers(90), crowd: camps(1, 2), pousse: camps(false, true) });
    const face = { eux: foe.classList.contains('pousse'), compte: compte.textContent.trim(),
                   marque: compte.hasAttribute('data-personne') };
    /* Un serveur d'avant ne sert pas `pousse` : la page lit le sens de la
       corde, sans jamais faire sauter une tribune vide. */
    calmer();
    tick({ ...t, rope: vers(60), crowd: camps(1, 0) });
    const avant = foe.classList.contains('pousse');
    calmer();
    Object.assign(S, garde);
    render();
    return { seul, recul, face, avant };
  });
  check(`personne en face, la tribune le dit (« ${vu.seul.compte} »)`,
    vu.seul.compte === 'PERSONNE EN FACE' && vu.seul.marque);
  check('ma foule saute quand mon camp a poussé', vu.seul.moi);
  check('la corde qui retombe ne fait sauter personne', !vu.recul.eux && !vu.recul.moi);
  check(`un camp qui pousse en face fait sauter sa foule (« ${vu.face.compte} »)`,
    vu.face.eux && vu.face.compte === '2 EN FACE' && !vu.face.marque);
  check('sans le signe, d’un serveur d’avant, une tribune vide ne saute pas', !vu.avant);
}

/* ------------------------------------ ce que le joueur voit par-dessus

   Trois défauts trouvés à l'œil sur une capture, qu'aucune mesure existante
   n'attrapait — chacun invisible tant que les cartes portaient des noms courts
   ou que personne ne regardait le coin de l'écran. */
{
  const vu = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect();
      return [b.left, b.top, b.right, b.bottom]; };
    const croise = (a, b) => a[0] < b[2] - 0.5 && b[0] < a[2] - 0.5
      && a[1] < b[3] - 0.5 && b[1] < a[3] - 0.5;
    const retour = document.querySelector('.tbf-retour');
    const burger = document.querySelector('.tbf-burger');
    const genants = [];
    for (const bouton of [retour, burger].filter(Boolean)) {
      for (const el of document.querySelectorAll('.hud *')) {
        const b = el.getBoundingClientRect();
        if (b.width && b.height && croise(r(bouton), r(el))) {
          genants.push(`${bouton.className.includes('retour') ? 'retour' : 'menu'}`
            + ` sur ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`);
        }
      }
    }
    return {
      retourHref: retour?.getAttribute('href') ?? null,
      genants,
      /* La *boîte* du nom va jusqu'au bord de la carte, réservation comprise :
         ce qu'on mesure, c'est là où le texte s'arrête vraiment. Comparer les
         rectangles bruts déclarerait une collision même après correction.

         La réservation n'est plus un `padding-right` sur toutes les lignes
         mais un flottant d'une ligne de haut (lot 0 : le geste a pris trois
         pixels, et dans l'arène le budget de hauteur passe d'abord). La boîte
         n'a donc plus de marge intérieure à retrancher, et sa droite est le
         bord de la carte : l'ancienne soustraction signalait les cinq cartes.
         On prend désormais les lignes du texte elles-mêmes (un Range sur le
         nom), et seules celles qui sont en face du coût — leur milieu tombe
         dans la hauteur de `.c` — doivent s'arrêter avant lui. Les suivantes
         passent dessous et ont droit à toute la largeur. Le milieu, et pas le
         simple croisement : la boîte de texte d'une ligne déborde son
         interligne serré, et la deuxième effleure le bas du coût sans que
         ses lettres le touchent. Un nom dont on ne mesure aucune ligne est
         signalé aussi : sinon la mesure deviendrait aveugle sans le dire. */
      cartesCollees: [...document.querySelectorAll('.card')]
        .filter((el) => {
          const b = el.querySelector('b'), c = el.querySelector('.c');
          const cb = c.getBoundingClientRect();
          const rg = document.createRange();
          rg.selectNodeContents(b);
          const lignes = [...rg.getClientRects()].filter((x) => x.width > 0);
          if (!lignes.length) return true;
          const enFace = lignes.filter((x) => {
            const milieu = (x.top + x.bottom) / 2;
            return milieu >= cb.top && milieu <= cb.bottom;
          });
          return enFace.length > 0
            && Math.max(...enFace.map((x) => x.right)) > cb.left + 0.5;
        })
        .map((el) => el.querySelector('b').textContent.trim()),
      /* Une hauteur en pixels dépendrait de la police ; le nombre de boîtes de
         ligne, non. Deux, c'est passé à la ligne. */
      libellesCasses: [...document.querySelectorAll('.club small, .club b')]
        .filter((el) => el.getClientRects().length > 1)
        .map((el) => el.textContent.trim()),
      voile: getComputedStyle(document.getElementById('veil')).backgroundColor,
    };
  });

  /* Le retour : le menu était la seule façon de rentrer, et il fallait deux
     gestes pour le mouvement le plus fréquent du jeu. */
  check('un écran de jeu a une flèche de retour', vu.retourHref === '/');
  check('et ni elle ni le menu ne recouvrent l’en-tête', vu.genants.length === 0);
  if (vu.genants.length) console.log('        ', vu.genants.join(' · '));

  /* Le coût est posé en absolu dans le coin de la carte ; le nom courait
     dessous. Tant que les chants portaient leur clé — « mur », « reprise » —
     le texte n'y arrivait pas. « À perdre haleine » l'a montré. */
  check('aucun nom de chant ne court sous son coût', vu.cartesCollees.length === 0);
  if (vu.cartesCollees.length) console.log('        ', vu.cartesCollees.join(' · '));

  /* Le dégagement des deux boutons a pris seize pixels à l'en-tête, et
     « TA TRIBUNE » s'est cassé en deux lignes. */
  check('et aucun libellé de club ne passe à la ligne', vu.libellesCasses.length === 0);
  if (vu.libellesCasses.length) console.log('        ', vu.libellesCasses.join(' · '));

  /* Le voile de l'écran de choix était à 96 % : l'en-tête du jeu, avec ses
     blasons vides et son « 0 – 0 » d'avant l'entrée, transparaissait dessous. */
  /* Et la case entière tient dans l'écran. La rangée est en bas : une case plus
     haute que les autres — un nom sur deux lignes, un geste au libellé long —
     pousse sa poussée hors du cadre, et c'est le chiffre qui décide du choix. */
  const rognees = await page.evaluate(() => [...document.querySelectorAll('.card')]
    .filter((el) => el.getBoundingClientRect().bottom > innerHeight + 1
      || el.querySelector('.p').getBoundingClientRect().bottom > innerHeight + 1)
    .map((el) => el.querySelector('b').textContent.trim()));
  check('et chaque chant montre sa poussée en entier', rognees.length === 0);
  if (rognees.length) console.log('        rognés :', rognees.join(' · '));

  check('le voile de l’écran de choix est opaque',
    !/rgba\([^)]*,\s*0?\.\d+\s*\)/.test(vu.voile)
    || (console.log('        il vaut', vu.voile), false));
}

if (!entre) {
  console.log('  arrêt : le joueur n’est pas entré dans le virage');
  await nav.close(); http.close(); virage.stop(); io.close(); await pool.end();
  process.exit(1);
}

/* ------------------------------------------------------ le répertoire

   Cinq chants à la fois, et pas douze : c'est la contrainte de l'écran qui a
   décidé du mécanisme, donc c'est ici qu'elle se vérifie. La rangée est un
   `flex` où chaque carte prend sa part — à douze, chacune ferait vingt pixels
   de large sur un iPhone SE, et le nom disparaîtrait.

   On contrôle aussi que ce nom est bien un *nom*. La page affichait la clé, et
   la tribune lisait « onetaitla ». */
{
  const chants = await page.evaluate(() => [...document.querySelectorAll('.card')]
    .map((el) => {
      const b = el.querySelector('b');
      const r = el.getBoundingClientRect();
      return { texte: b.textContent.trim(), largeur: r.width,
               rogne: b.scrollWidth > b.clientWidth + 1,
               dedans: r.right <= innerWidth + 1 && r.left >= -1 };
    }));

  check('la tribune ne voit que cinq chants à la fois', chants.length === 5);
  check('et chacun garde de quoi se lire',
    chants.every((c) => c.largeur >= 45)
    || (console.log('        largeurs :',
      chants.map((c) => Math.round(c.largeur)).join(', ')), false));
  check('aucun ne sort de l’écran', chants.every((c) => c.dedans));
  /* Un nom, pas une clé : les identifiants du serveur n'ont ni espace ni
     accent, et c'est exactement ce qui les trahit à l'écran. */
  check('ce sont des noms, pas des identifiants',
    chants.every((c) => /[ ’'À-ÿ]/.test(c.texte))
    || (console.log('        affiché :', chants.map((c) => c.texte).join(' · ')), false));
  check('et aucun n’est rogné', chants.every((c) => !c.rogne)
    || (console.log('        rognés :',
      chants.filter((c) => c.rogne).map((c) => c.texte).join(', ')), false));
}

/* ------------------------------------------- le « i » de ce qu'on porte

   Une plaque ronde dans la rangée du souffle (le tableau), et son panneau
   hors de la colonne (brief du lot 6). Au premier passage, il s'était posé
   au bout de la rangée d'actions ; on vérifie qu'il est à sa place, qu'il y
   reste quand la rangée d'actions est là, et que son panneau ne vit pas
   dans `#app`, contexte d'empilement. */
{
  const i = await page.evaluate(() => {
    render();
    const el = document.getElementById('apportsL');
    return { tableau: Boolean(el.closest('.tableau .tbf-tableau-droite')),
      rangee: Boolean(el.closest('#rangeeActes')),
      panneau: !document.getElementById('apportsP').closest('#app') };
  });
  check('le « i » de ce qu’on porte est dans la rangée du souffle',
    i.tableau && !i.rangee || (console.log('        tableau', i.tableau, '· rangée d’actions', i.rangee), false));
  check('et son panneau vit hors de la colonne', i.panneau);
}

/* ------------------------------------------- ce qu'il porte, à côté de lui

   Les pièces du sac qui compte ici (les lignes `stuff` d'`apports`, le même
   sac que le panneau du « i ») sont accrochées à côté du Fanzzy, dans sa
   boîte. Sans pièce, rien d'accroché ; une vue suivante identique ne les
   redessine pas (elles arrivent avec un geste, qui ne doit pas se rejouer). */
{
  await page.evaluate(() => {
    const avant = S.you.apports;
    window.__sac = [
      { quoi: 'stuff', id: 'megaphone', rar: 'epique', nom: 'Mégaphone', mods: { perfectBonus: 1.4 } },
      { quoi: 'stuff', id: 'jumelles', rar: 'commune', nom: 'Jumelles', mods: { tempoWindow: 1.25 } },
    ];
    S.you.apports = window.__sac;
    render();
    window.__sacAvant = avant;
    return null;
  });
  if (process.env.SHOT) {
    await new Promise((res) => setTimeout(res, 900));
    await page.screenshot({ path: process.env.SHOT + '/virage-sac.png' });
  }
  const r = await page.evaluate(() => {
    const avant = window.__sacAvant;
    const lire = () => [...document.querySelectorAll('#fzs > .tbf-porte .tbf-piece')]
      .map((p) => `${/\/img\/stuff\/([^.]+)\./.exec(p.querySelector('img')?.getAttribute('src') ?? '')?.[1]}:${
        [...p.classList].find((c) => c.startsWith('r-'))}`);
    /* Reposé : une vue du serveur a pu passer pendant la capture. */
    S.you.apports = window.__sac;
    render();
    const deux = lire();
    const el = document.querySelector('#fzs > .tbf-porte');
    render();
    const meme = document.querySelector('#fzs > .tbf-porte') === el;
    S.you.apports = [];
    render();
    const rien = document.querySelectorAll('#fzs .tbf-porte').length;
    S.you.apports = avant;
    delete window.__sacAvant;
    delete window.__sac;
    render();
    return { deux, meme, rien, nom: el?.getAttribute('aria-label') ?? '' };
  });
  check(`ses deux pièces sont accrochées à côté de lui, dans le cadre de leur rareté (${r.deux.join(', ')})`,
    r.deux.join() === 'megaphone:r-epique,jumelles:r-commune');
  check(`et elles se disent (${r.nom})`, r.nom === 'Porte : Mégaphone, Jumelles');
  check('une vue identique ne les redessine pas', r.meme);
  check('sans pièce, rien d’accroché', r.rien === 0);
}

/* ---------------------------------------------------------- la bande */

const bande = () => page.evaluate(() => ({
  score: document.getElementById('filScore').textContent.trim(),
  dernier: document.getElementById('filDer').textContent.replace(/\s+/g, ' ').trim(),
}));

{
  const b = await bande();
  /* Le score de la bande est celui du **terrain**, pas celui de la tribune qui
     est juste au-dessus. Les confondre serait pire que de ne rien montrer :
     le joueur pousse sur une corde dont le score n'a rien à voir avec la
     rencontre, et c'est justement ce que le fil est là pour démêler. */
  check('la bande donne le score du vrai match', b.score === '2 – 1');
  /* **Le ticket terrain tient court** (lot 6) : l'icône et le nom, rien
     d'autre — la minute du match a sa pastille à côté, la minute de l'action
     et son détail sont dans la feuille. Le carton rouge se dit par sa forme
     de couleur : sur le kraft, l'encre ne prend pas de teinte. */
  check('et la dernière chose arrivée sur le terrain',
    /^🟥 Keller$/.test(b.dernier) || (console.log('        elle dit :', b.dernier), false));
  check('le score de la tribune reste distinct, en haut',
    (await page.$eval('#score', (n) => n.textContent.trim())) === '0 – 0');

  /* **Le score est lu par sa position, pas par une convention.**
   *
   * Le bandeau montrait EN FACE à gauche, le score au milieu, TA TRIBUNE à
   * droite — et le score s'écrivait « toi d'abord », comme le reste du jeu. Un
   * joueur qui gagnait la corde quatre fois lisait donc « 4 – 0 » collé au
   * blason de l'adversaire, et en concluait qu'il perdait 4–0. La bande juste
   * en dessous disait l'inverse à deux centimètres de là.
   *
   * On mesure les abscisses plutôt que l'ordre du document : c'est ce que voit
   * le joueur, et un `row-reverse` mal placé ne se verrait pas autrement. */
  check('le bandeau range ta tribune du côté de son chiffre',
    await page.evaluate(() => {
      const x = (sel) => {
        const r = document.querySelector(sel)?.getBoundingClientRect();
        return r && r.width ? r.left + r.width / 2 : null;
      };
      const [moi, score, eux] = [x('#clubMe'), x('#score'), x('#clubFoe')];
      return moi != null && eux != null && moi < score && score < eux;
    }));

  // Le débordement est le défaut classique d'une bande ajoutée à un écran plein.
  check('l’écran du virage ne défile toujours pas', await page.evaluate(() =>
    document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1
    && document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check('et la main reste entièrement visible', await page.evaluate(() =>
    document.querySelector('.hand').getBoundingClientRect().bottom <= innerHeight + 1));

  /* Le libellé « TERRAIN » porte tout le sens de la bande : sans lui, deux
     scores se suivent à l'écran sans qu'on sache lequel est le match. Un
     libellé rogné ne se voit qu'à l'usage, sur un vrai téléphone — c'est le
     même contrôle que pour les libellés de rail de l'accueil. */
  check('le libellé du score tient dans la bande', await page.evaluate(() => {
    const f = document.getElementById('fil').getBoundingClientRect();
    const s = document.querySelector('#fil .sc small').getBoundingClientRect();
    return s.top >= f.top && s.bottom <= f.bottom && s.height > 0;
  }));
}

/* ------------------------------------------- le dernier fait, à l'étroit

   Le ticket ne porte que le nom (« 🟥 KELLER ») : l'API écrit l'initiale du
   prénom, et à 320 px en minute double, le sticker de phase prenait la
   place — « 🟥 M. KELLER » sortait coupé de vingt pixels (relevé de la
   mesure, lot 6). La page écrit le nom sans l'initiale, et **efface le
   dernier fait plutôt que de le couper** : il reste dans la feuille. On le
   pousse ici au plus étroit, avec un nom qui ne tient pas, puis on rend la
   page comme on l'a trouvée. */
{
  const formes = await page.evaluate(() =>
    [nomCourt('M. Keller'), nomCourt('J.-P. Dupont'), nomCourt('N’Golo Kanté'), nomCourt('Keller')].join('|'));
  check('le ticket écrit le nom sans l’initiale du prénom',
    formes === 'Keller|Dupont|N’Golo Kanté|Keller' || (console.log('        il écrit :', formes), false));

  await page.setViewport({ width: 320, height: 568 });
  const etroit = await page.evaluate(async () => {
    const lire = () => { const d = document.getElementById('filDer');
      return { texte: d.textContent, coupe: d.scrollWidth - d.clientWidth }; };
    const fil = S.fil, surge = S.surge, fin = P.doubleFin;
    S.surge = true; P.doubleFin = performance.now() + 45_000;
    S.fil = [...(fil ?? []), { genre: 'match', type: 'Card', detail: 'Red Card',
      joueur: 'M. Abdelhamid-Zambrano', minute: 80, side: 1, rang: 999 }];
    render(); renderFil();
    await new Promise((r) => setTimeout(r, 60));
    const long = lire();
    S.fil = [...(fil ?? []), { genre: 'match', type: 'Card', detail: 'Red Card', joueur: 'M. Roth', minute: 80, side: 1, rang: 999 }];
    S.surge = false; P.doubleFin = null;
    render(); renderFil();
    await new Promise((r) => setTimeout(r, 60));
    const court = lire();
    S.fil = fil; S.surge = surge; P.doubleFin = fin;
    render(); renderFil();
    return { long, court };
  });
  await page.setViewport({ width: 400, height: 880 });
  await wait(150);
  check('à l’étroit, un nom qui ne tient pas s’efface au lieu de se couper',
    etroit.long.texte === '' || (console.log('        il dit :', etroit.long.texte, 'coupé de', etroit.long.coupe), false));
  check('et un nom qui tient s’écrit en entier',
    etroit.court.texte === '🟥 Roth' && etroit.court.coupe <= 1
    || (console.log('        il dit :', etroit.court.texte, 'coupé de', etroit.court.coupe), false));
}

/* ------------------------------------------------- l'horloge du match

 * Trois fautes tenaient ensemble et donnaient le même symptôme : un match
 * resté « 90' EN DIRECT » dix minutes après le coup de sifflet.
 *
 *   — le temps additionnel n'existait nulle part : l'API le sert à part, on ne
 *     le stockait pas, et l'horloge s'arrêtait à « 90+ » sans dire combien ;
 *   — le compte partait de l'instant où la **page** avait reçu la donnée, si
 *     bien qu'une donnée vieille d'un quart d'heure repartait de zéro ;
 *   — rien ne faisait taire l'horloge, ni la fin du match, ni le silence du
 *     serveur.
 *
 * On éprouve la fonction elle-même, en lui posant des états : c'est du calcul
 * pur, et le faire par le vrai relevé demanderait d'attendre des minutes.
 */
{
  const dit = (etat) => page.evaluate((e) => {
    const avant = { minute: S.minute, minuteExtra: S.minuteExtra, statut: S.statut, vuA: S.vuA };
    Object.assign(S, e);
    const t = minuteTexte();
    Object.assign(S, avant);
    return t;
  }, etat);

  const maintenant = Date.now();
  check('en cours, elle donne la minute',
    (await dit({ minute: 63, minuteExtra: null, statut: '2H', vuA: maintenant })) === '63′');
  check('au-delà du terme, elle donne le temps additionnel',
    (await dit({ minute: 90, minuteExtra: 3, statut: '2H', vuA: maintenant })) === '90+3′');
  check('et « 90+ » seulement quand le relevé ne le connaît pas',
    (await dit({ minute: 92, minuteExtra: null, statut: '2H', vuA: maintenant })) === '90+′');
  check('les prolongations ont leur propre terme',
    (await dit({ minute: 120, minuteExtra: 2, statut: 'ET', vuA: maintenant })) === '120+2′');

  /* Le match fini n'a plus de minute. C'est le cœur de la panne : « 90' EN
     DIRECT » sur une rencontre terminée. */
  for (const statut of ['FT', 'AET', 'PEN']) {
    check(`un match ${statut} n’affiche plus de minute`,
      (await dit({ minute: 90, minuteExtra: null, statut, vuA: maintenant })) === '');
  }

  check('la mi-temps s’affiche, mais sans courir',
    (await dit({ minute: 45, minuteExtra: null, statut: 'HT', vuA: maintenant })) === '45′');
  check('et elle est marquée comme arrêtée',
    (await page.evaluate((v) => {
      const avant = { statut: S.statut, vuA: S.vuA };
      Object.assign(S, { statut: 'HT', vuA: v });
      const a = minuteCourante()?.arret === true;
      Object.assign(S, avant);
      return a;
    }, maintenant)));

  /* Le silence du serveur. Un match dont on n'a plus de nouvelles depuis un
     quart d'heure n'est pas un match à la centième minute : c'est un match
     dont on ne sait plus rien, et il vaut mieux ne rien dire que mentir. */
  check('après un long silence du serveur, elle se tait',
    (await dit({ minute: 63, minuteExtra: null, statut: '2H',
      vuA: maintenant - 20 * 60_000 })) === '');
}

/* --------------------------------------------------------- la feuille */

await page.click('#fil');
await wait(250);

const lignes = () => page.evaluate(() => [...document.querySelectorAll('#feuilleCorps .ev')]
  .map((n) => n.textContent.replace(/\s+/g, ' ').trim()));

{
  check('la feuille s’ouvre sur le fil complet',
    await page.$eval('#feuille', (n) => n.classList.contains('on')));
  const l = await lignes();
  /* Trois événements de terrain — le but de la vingt-troisième n'y est pas,
     il a son propre chemin — et la période en cours. */
  check('elle déroule tout ce que la base savait',
    l.length === 4 || (console.log('        ', l.join(' / ')), false));

  /* Le plus récent en tête : on ouvre le fil pour savoir ce qu'on vient de
     manquer, pas pour relire le début. */
  check('le plus récent est en tête', /66/.test(l[0] ?? ''));
  check('et le plus ancien ferme la marche', /12/.test(l.at(-1) ?? ''));

  /* L'API parle anglais. Ces mots-là traversaient la page tels quels. */
  const tout = l.join(' | ');
  /* La période en cours vaut à elle seule le fil les jours de quota serré :
     elle ne coûte aucun appel, et « reprise » explique déjà l'écran. */
  check('la période en cours est au fil, et elle est gratuite', /REPRISE/.test(tout));
  check('les cartons sont dits en français',
    /Carton rouge/.test(tout) && /Carton jaune/.test(tout));
  check('le remplacement aussi, sans son numéro',
    /Remplacement/.test(tout) && !/Substitution/.test(tout));
  check('et le but n’est pas annoncé « Goal »',
    !/\bGoal\b/.test(tout) && !/Red Card/.test(tout));

  /* Le camp décide du côté : le sien à gauche, l'adversaire à droite. Se
     tromper de côté fait lire un carton adverse comme un carton du club. */
  check('l’adversaire est rangé du côté opposé', await page.evaluate(() =>
    [...document.querySelectorAll('#feuilleCorps .ev')]
      .filter((n) => /Keller|Zambrano|Roth/.test(n.textContent))
      .every((n) => n.classList.contains('droite'))));
}

/* ------------------------------------- la feuille pendant un temps fort

 * `fx.js` pose ses bandeaux sur `body`, aux calques 89 à 93. `ui.css` donne à
 * la colonne un `z-index: 1`, donc un contexte d'empilement : un panneau posé
 * dedans est enfermé sous ces bandeaux, quel que soit son propre `z-index`.
 * La tête de la feuille — et son bouton de fermeture — disparaissait sous le
 * « MINUTE DOUBLE » d'un but pendant trois secondes.
 *
 * C'est la règle du booster, transposée : un plein écran doit rester lisible
 * et refermable tant qu'il est ouvert.
 *
 * **Le lot 6 a retiré ce bandeau-là du Virage** : la minute double se dit
 * dans le sticker de phase du HUD. Le but réel ne pose donc plus de calque
 * sur la tête de la feuille, et le contrôle garde son sens avec un autre :
 * un bandeau de `fx.js` posé exprès en haut de l'écran (le même calque que
 * tous ses titres), et la case du moment fort, que la scène pose sur le
 * document au même calque que la feuille. */
{
  /* **L'entrée dans la minute double claque** (partie B) : l'attribut
     basculait seul, sans claquement ni son, et l'or ne se voyait qu'en le
     cherchant. On relève, avant le but, chaque fois que le sticker de phase
     prend `.tbf-clac`, et chaque son que la page demande à `fx.js` : le
     claquement est une classe qui s'en va en 400 ms, la mesure d'après le
     but ne la verrait plus. */
  await page.evaluate(() => {
    window.__clacsPhase = 0;
    window.__sons = [];
    const ph = document.getElementById('phase');
    new MutationObserver(() => { if (ph.classList.contains('tbf-clac')) window.__clacsPhase++; })
      .observe(ph, { attributes: true, attributeFilter: ['class'] });
    const vrai = window.FX?.son?.bind(window.FX);
    if (vrai) window.FX.son = (nom, ...reste) => { window.__sons.push(nom); return vrai(nom, ...reste); };
  });
  virage.realGoal({ fixtureId: 8001, teamId: 85, minute: 73, player: 'Bonvin', score: [3, 1] });
  await wait(700);

  const apresBut = await page.evaluate(() => ({
    bandeau: Boolean(document.querySelector('.fx-bandeau')),
    phase: document.querySelector('#phase .long')?.textContent.trim() ?? '',
    double: document.getElementById('app').hasAttribute('data-double'),
    clacs: window.__clacsPhase, sons: [...window.__sons],
  }));
  check('le but réel ne pose plus de bandeau « MINUTE DOUBLE »', !apresBut.bandeau);
  /* Avec ou sans le chrono : un serveur qui sert `surgeMs` (CONTRATS § 16)
     donne « MINUTE DOUBLE 0:59 », un serveur d'avant « MINUTE DOUBLE ». */
  check('c’est le sticker de phase qui dit la minute double',
    (/^MINUTE DOUBLE( \d:\d\d)?$/.test(apresBut.phase) && apresBut.double)
    || (console.log('        il dit :', apresBut.phase, apresBut.double ? '(data-double)' : '(sans data-double)'), false));
  check('et son entrée claque : le sticker prend le coup de tampon, et le clac sonne',
    (apresBut.clacs >= 1 && apresBut.sons.includes('bache'))
    || (console.log('        claquements', apresBut.clacs, '· sons', apresBut.sons.join(', ') || 'aucun'), false));
  /* La case du moment fort est au calque de la feuille, et posée après elle
     dans le document : la page la redescend tant que la feuille est ouverte. */
  const cases = await page.evaluate(() => {
    const c = document.querySelector('body > .tbf-moment');
    const f = document.getElementById('feuille');
    return { on: Boolean(c?.classList.contains('on')), case: Number(getComputedStyle(c).zIndex),
      feuille: Number(getComputedStyle(f).zIndex) };
  });
  check('la case du but passe sous la feuille ouverte',
    (cases.on && cases.case < cases.feuille)
    || (console.log('        case', cases.case, '· feuille', cases.feuille, cases.on ? '' : '(case éteinte)'), false));

  await page.evaluate(() => window.FX.bandeau('TEMPS FORT'));
  await wait(400);

  /* On regarde les **pixels**, pas l'ordre de survol.
     `document.elementsFromPoint` ignore tout ce qui porte `pointer-events:none`
     — c'est le cas des calques de `fx.js` — et répondait donc « la feuille est
     au-dessus » alors qu'elle était peinte dessous. Un contrôle qui ne peut
     pas échouer ne prouve rien : celui-ci lit la couleur à l'écran. */
  const bandeau = await page.evaluate(() => {
    const b = document.querySelector('.fx-bandeau');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { bas: r.bottom, couleur: getComputedStyle(b).backgroundColor };
  });
  check('un bandeau d’effet est bien à l’écran', Boolean(bandeau));

  /* On compte les pixels de **la couleur du bandeau**, et pas simplement les
     pixels clairs : le titre « LE FIL » est écrit en craie, presque blanc, et
     une sonde qui cherche du clair le compte lui aussi — elle échouerait que
     la feuille soit dessus ou dessous. */
  const [br, bg, bb] = (bandeau?.couleur ?? '').match(/\d+/g)?.map(Number) ?? [];
  const zone = await page.evaluate(() => {
    const r = document.querySelector('.feuille .tete').getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top),
             width: Math.round(r.width), height: Math.round(r.height) };
  });
  const pixels = await page.screenshot({ clip: zone, encoding: 'binary' });
  const sharp = (await import('sharp')).default;
  const { data, info } = await sharp(pixels).raw().toBuffer({ resolveWithObject: true });
  let teintes = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (Math.abs(data[i] - br) < 26 && Math.abs(data[i + 1] - bg) < 26
      && Math.abs(data[i + 2] - bb) < 26) teintes++;
  }
  check('la tête de la feuille est peinte par-dessus le bandeau',
    teintes === 0
    || (console.log(`        ${teintes} pixels du bandeau sur la tête`), false));

  check('le but réel entre au fil sans le refermer',
    (await lignes())[0]?.includes('Bonvin'));
  check('et le score du terrain suit', (await bande()).score === '3 – 1');
}

/* ------------------------------------- le sticker de phase dit la mi-temps

   Hors de la minute double, le sticker disait « GRAND VIRAGE » (« VIRAGE »
   sous 390 px) quoi qu'il arrive, et le ticket ne montre à la pause qu'une
   minute arrêtée : la rumeur retombait, et rien à l'écran ne disait
   pourquoi. Il dit maintenant la phase du match quand elle en a une — la
   mi-temps ici. La minute double passe devant : on l'éteint le temps de
   lire, puis on rend la page telle qu'on l'a trouvée (un seul passage
   synchrone, qu'aucun message du serveur ne coupe). */
{
  const phases = await page.evaluate(() => {
    const lire = () => [document.querySelector('#phase .long')?.textContent.trim() ?? '',
      document.querySelector('#phase .court')?.textContent.trim() ?? ''].join('|');
    const statut = S.statut, surge = S.surge, fin = P.doubleFin;
    S.surge = false; P.doubleFin = null;
    S.statut = 'HT'; render();
    const pause = lire();
    S.statut = '2H'; render();
    const jeu = lire();
    S.statut = statut; S.surge = surge; P.doubleFin = fin; render();
    return { pause, jeu };
  });
  check('à la mi-temps, le sticker de phase le dit',
    phases.pause === 'MI-TEMPS|MI-TEMPS' || (console.log('        il dit :', phases.pause), false));
  check('et en jeu, il redit le Grand Virage, sous ses deux formes',
    phases.jeu === 'GRAND VIRAGE|VIRAGE' || (console.log('        il dit :', phases.jeu), false));
}

/* ------------------------------------------------------- on peut sortir */

await page.keyboard.press('Escape');
await wait(200);
check('Échap referme la feuille',
  !(await page.$eval('#feuille', (n) => n.classList.contains('on'))));

await page.click('#fil');
await wait(200);
await page.click('#feuilleX');
await wait(200);
check('et le bouton de fermeture aussi',
  !(await page.$eval('#feuille', (n) => n.classList.contains('on'))));

/* ======================================= la main se recharge d'elle-même

   « Est-ce que les cartes se régénèrent ? » (Gaël, 4 octobre 2026). Oui,
   côté serveur. Mais la page ne l'apprenait pas : les recharges arrivaient en
   secondes restantes et n'étaient jamais décomptées, si bien qu'une carte
   gardait son scotch sous un chiffre figé, et que la page la refusait
   elle-même. Quand toutes l'étaient, plus rien ne partait, donc plus aucun
   `virage:vous` n'arrivait : la main était bloquée jusqu'au rechargement, en
   une demi-minute de jeu. (Correctif d'urgence, reporté au lot 6 : la carte
   en recharge est ici le scotch qui se retire, `.tbf-carte-recharge`.)

   Le joueur de cette suite n'a pas de deck. On lui pose une main par le
   message même du serveur, `virage:vous`, rejoué par les écouteurs de la
   socket : c'est la page qu'on éprouve ici, la salle l'est par
   `virage-smoke`. */
const vous = (you) => page.evaluate((y) => {
  for (const f of socket.listeners('virage:vous')) f(y);
}, you);

/* Nommée `laScene` et non `scene` : dans un `page.evaluate`, le corps est
   évalué **dans la page**, où `scene` désigne la scène du virage. Deux noms
   identiques de part et d'autre du navigateur ne se mélangent pas, mais se
   relisent très mal. */
const laScene = () => page.evaluate(() => ({
  // `scene` est la scène de la page : un `const` de premier niveau d'un script
  // classique est bien visible ici, comme `S` et `minuteTexte` plus haut.
  etat: scene?.etat?.() ?? null,
  titre: document.querySelector('.tbf-moment b')?.textContent.trim() ?? '',
  sous: document.querySelector('.tbf-moment small')?.textContent.trim() ?? '',
  on: document.querySelector('.tbf-moment')?.classList.contains('on') ?? false,
  duree: document.querySelector('.tbf-moment')?.style.getPropertyValue('--mt') ?? '',
}));

{
  const id = await page.evaluate(() =>
    (S.actions ?? []).find((a) => a.id === 'a-fumigene')?.id ?? S.actions?.[0]?.id ?? null);
  const lire = () => page.evaluate(() => {
    const el = document.querySelector('#actes [data-acte]');
    const r = el?.querySelector('.tbf-carte-recharge');
    return {
      cachee: document.getElementById('actes').hidden,
      acte: el?.dataset.acte ?? null,
      cd: r?.firstElementChild?.textContent.trim() ?? null,
      h: r?.style.getPropertyValue('--h').trim() ?? null,
      meme: Boolean(el) && el === window.__carteEssai,
    };
  });
  /* Toucher la carte : ce que la page envoie est relevé, et la carte jouée
     retenue — le joueur de cette suite n'a pas de deck, la salle la
     refuserait et renverrait sa main vide. */
  const toucher = () => page.evaluate(() => {
    const vrai = socket.emit;
    const emis = [];
    socket.emit = (e, ...a) => {
      emis.push(e);
      return e === 'virage:jouer' ? socket : vrai.call(socket, e, ...a);
    };
    try {
      document.querySelector('#actes [data-acte]')
        ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    } finally { socket.emit = vrai; }
    return emis.includes('virage:jouer');
  });

  await vous({ main: [id], cooldowns: { [id]: 2 }, breath: 100 });
  await page.evaluate(() => {
    window.__carteEssai = document.querySelector('#actes [data-acte]');
  });
  const avant = await lire();
  check(`une carte reçue en recharge porte son scotch et son compte (${avant.cd}, ${avant.h})`,
    avant.cachee === false && avant.acte === id && avant.cd === '2' && avant.h === '100%'
    || (console.log('        ', JSON.stringify(avant)), false));
  check('et la page ne la joue pas encore', !(await toucher()));

  /* Trois secondes : la recharge en dure deux, et le rendu passe chaque
     seconde. Aucun message du serveur entre les deux — c'est tout l'objet. */
  await wait(3200);
  const apres = await lire();
  check('trois secondes plus tard, le scotch s’est retiré de lui-même',
    apres.acte === id && apres.cd === '' && apres.h === '0%'
    || (console.log('        ', JSON.stringify(apres)), false));
  check('et la carte se joue', await toucher());
  // Voir ETAT.md § 6 : une case refaite lâche le doigt posé dessus.
  check('et c’est la même case, retouchée en place', apres.meme);

  /* Le souffle. `virage:vous` le porte, et la jauge comptait pourtant le
     regain depuis le dernier chant : une minute après lui, elle promettait
     le plein à quelqu'un qui venait de dépenser. */
  const souffle = await page.evaluate(() => {
    const regen = S.you.regen;
    S.you.regen = 2;
    souffleVuA = Date.now() - 60_000;
    for (const f of socket.listeners('virage:vous')) f({ breath: 10 });
    const vu = souffleCourant();
    S.you.regen = regen;
    return vu;
  });
  check(`le souffle repart de celui que porte virage:vous (${Math.round(souffle)} pour 10)`,
    souffle < 12);

  /* L'état aussi — à l'entrée, au retour d'une coupure — porte le souffle
     et les recharges de l'instant. Décomptées depuis le chargement de la
     page, une recharge de trente secondes reçue une minute plus tard serait
     déjà finie : la carte se montrerait prête, et le serveur la refuserait.
     Rejoué sans le personnage, qu'un état referait entrer ; il est rendu
     après, avec le reste de ce qu'on emprunte. */
  const etat = await page.evaluate((id) => {
    const { regen, fanzzy } = S.you;
    souffleVuA = cdVuA = Date.now() - 60_000;
    const s = { ...S, you: { ...S.you, fanzzy: null, regen: 2, breath: 10,
      main: [id], cooldowns: { [id]: 30 } } };
    for (const f of socket.listeners('virage:state')) f(s);
    const vu = { souffle: souffleCourant(), reste: rechargeRestante(id) };
    S.you.regen = regen;
    S.you.fanzzy = fanzzy;
    return vu;
  }, id);
  check('l’état remet aussi les deux horloges à l’heure '
    + `(souffle ${Math.round(etat.souffle)} pour 10, recharge ${etat.reste.toFixed(1)} s pour 30)`,
  etat.souffle < 12 && etat.reste > 29);

  /* Une main vide cache la rangée ; la carte tirée ensuite doit la refaire
     paraître, sans quoi la main est perdue pour le reste du match. */
  await vous({ main: [], cooldowns: {}, breath: 100 });
  const vide = await lire();
  await vous({ main: [id], cooldowns: {}, breath: 100 });
  const revenue = await lire();
  check('une main vide cache la rangée', vide.cachee === true);
  check('et une carte tirée ensuite la refait paraître, jouable',
    revenue.cachee === false && revenue.acte === id && revenue.cd === ''
    || (console.log('        ', JSON.stringify(revenue)), false));

  /* **« DUEL SEULEMENT » sur une case qui le restera, et sur elle seule.**
     Il se posait sur autant de cases vides qu'il y a de cartes restées au
     duel : la case de la carte suivante, pas encore tirée, s'expliquait donc
     par le duel, à chaque carte jouée. Un deck de dix cartes : avec trois au
     duel, sept se jouent ici et la main se remplit toujours ; avec sept au
     duel, trois seulement, et les deux dernières cases restent vides. */
  const rangee = (ecartees, n) => page.evaluate(({ ecartees, n }) => {
    const main = (S.actions ?? []).slice(0, n).map((a) => a.id);
    for (const f of socket.listeners('virage:vous')) {
      f({ main, cooldowns: {}, breath: 100, ecartees, mainVisible: 5 });
    }
    return [...document.getElementById('actes').children].map((c) => (c.dataset.acte ? 'carte'
      : /DUEL SEULEMENT/.test(c.textContent) ? 'duel' : 'vide')).join(' ');
  }, { ecartees, n });
  const ecarteesAvant = await page.evaluate(() => S.you.ecartees ?? 0);
  const tirage = await rangee(3, 4);
  check(`trois cartes au duel : la case du tirage reste nue (${tirage})`,
    tirage === 'carte carte carte carte vide');
  const pleine = await rangee(7, 3);
  check(`sept au duel : les deux cases que rien ne remplira le disent (${pleine})`,
    pleine === 'carte carte carte duel duel');
  const enAttente = await rangee(7, 2);
  check(`et la case du tirage, entre les deux, reste nue (${enAttente})`,
    enAttente === 'carte carte vide duel duel');

  // On rend au joueur sans deck sa main vide : la suite le suppose.
  await vous({ main: [], cooldowns: {}, ecartees: ecarteesAvant });
}

/* ======================================== ce qui était déjà au tableau

   Le premier relevé d'un match qu'on n'avait jamais relevé envoie au fil
   tout ce qui s'est passé avant. Entrer à la cinquantième faisait jouer
   « ROUGE POUR EUX » pour un carton de la vingtième, et « BUT REFUSÉ » pour
   une vidéo de la trentième (S8 de l'enquête du 4 octobre 2026). Le joueur
   est entré ici à la soixante et onzième. */
{
  await page.evaluate(() => scene?.couper?.());
  virage.matchEvents(8001, [{ type: 'Card', detail: 'Red Card', teamId: 91,
    minute: 20, player: 'Ancien' }]);
  await wait(500);
  const vieux = await page.evaluate(() => ({
    on: document.querySelector('.tbf-moment')?.classList.contains('on') ?? false,
    auFil: (S.fil ?? []).some((e) => e.joueur === 'Ancien'),
    entree: entreeMinute,
  }));
  check(`un rouge d’avant l’entrée (20e, entré à la ${vieux.entree}e) ne fait pas réagir`,
    vieux.entree != null && !vieux.on);
  check('mais il entre au fil, et donc à la feuille', vieux.auFil);

  virage.matchEvents(8001, [{ type: 'Card', detail: 'Red Card', teamId: 91,
    minute: 76, player: 'Frais' }]);
  await wait(500);
  const frais = await laScene();
  check('un rouge d’après l’entrée le fait toujours réagir',
    frais.on && /ROUGE/.test(frais.titre)
    || (console.log('        il dit :', frais.titre), false));

  /* **Une reconnexion garde la garde.** L'état revient — la même salle, ou
     une salle libérée puis rouverte pendant la coupure, dont le premier
     relevé rapporterait tout le match —, et s'il ne dit pas la minute, la
     garde ne tombe pas : le rouge de la vingtième reste muet. L'état est
     rejoué tel que la page le tient, sans minute ni personnage. */
  await page.evaluate(() => scene?.couper?.());
  const retour = await page.evaluate(() => {
    const { fanzzy } = S.you;
    const minute = S.minute;
    const s = { ...S, minute: null, you: { ...S.you, fanzzy: null } };
    for (const f of socket.listeners('virage:state')) f(s);
    S.you.fanzzy = fanzzy;
    S.minute = minute;
    return entreeMinute;
  });
  virage.matchEvents(8001, [{ type: 'Var', detail: 'Goal cancelled', teamId: 85,
    minute: 21, player: 'Revenu' }]);
  await wait(500);
  const apresRetour = await laScene();
  check(`revenu sans minute, la garde tient (entré à la ${retour}e) : la vidéo de la 21e est muette`,
    retour != null && !apresRetour.on
    || (console.log('        il dit :', apresRetour.titre), false));
  await page.evaluate(() => scene?.couper?.());
}

/* La même garde, quand l'état ne dit pas la minute.

   Une salle qui ouvre sur une ligne de calendrier jamais relevée — un match
   « ailleurs », écrit « NS » avant le coup d'envoi — envoie un état sans
   minute, et rien n'était alors écarté : le premier relevé, à la
   cinquantième, apportait le rouge de la vingtième et la vidéo de la
   trentième, et le personnage jouait « BUT REFUSÉ » (trouvé par la
   vérification du correctif d'urgence). La minute de l'entrée s'apprend
   donc des minutes qui suivent.

   Et l'inverse, qu'une garde trop pressée casserait : un match vraiment pas
   commencé, où l'on attend depuis dix minutes, et dont le premier relevé
   n'arrive qu'à la cinquième. Le rouge de la première minute est tombé
   pendant que le joueur était là ; il doit le faire réagir.

   Sur une page à part, avec ses deux matchs (8004 et 8005 : 8002 sert aux
   sorties, plus bas) : celle du haut garde le sien pour la suite. */
{
  await pool.query(`INSERT INTO teams (id,name,color1,color2) VALUES (92,'FC Thoune',NULL,NULL)`);
  await pool.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,
                                          home_goals,away_goals,elapsed,kickoff_at,polled_at)
                    VALUES (8004,207,2026,91,92,'NS',NULL,NULL,NULL,UTC_TIMESTAMP(),NOW(3)),
                           (8005,207,2026,91,92,'NS',NULL,NULL,NULL,UTC_TIMESTAMP(),NOW(3))`);
  const ailleurs = await nav.newPage();
  ailleurs.on('pageerror', (e) => erreurs.push(e.message));
  await ailleurs.setViewport({ width: 400, height: 880 });
  await ailleurs.goto(base + '/virage', { waitUntil: 'networkidle0' });

  /* Entre dans le match, côté domicile, et attend son état. La sonde note
     chaque case de moment qui se pose : un `.on` lu à un seul instant
     manquerait celle qu'un second moment a déjà remplacée. */
  const entrer = (fixtureId) => ailleurs.evaluate((id) => {
    clearInterval(window.__sondeMoments);
    socket.emit('virage:join', { fixtureId: id, camp: 'domicile' });
  }, fixtureId).then(() => ailleurs.waitForFunction((id) => S?.fixture?.id === id,
    { timeout: 8000 }, fixtureId)).then(() => true).catch(() => false);
  const guetter = () => ailleurs.evaluate(() => {
    scene?.couper?.();
    window.__moments = [];
    window.__sondeMoments = setInterval(() => {
      const t = document.querySelector('.tbf-moment.on b')?.textContent.trim();
      if (t && !window.__moments.includes(t)) window.__moments.push(t);
    }, 40);
  });
  const vus = () => ailleurs.evaluate(() => [...window.__moments]);

  const dedans = await entrer(8004);
  const etat = await ailleurs.evaluate(() => ({ minute: S?.minute ?? null, entree: entreeMinute }));
  check(`on entre sur une ligne « NS » jamais relevée, sans minute (${etat.minute})`,
    dedans && etat.minute == null && etat.entree == null);

  await guetter();
  // Le premier relevé : le tableau, puis tout ce qui s'est passé avant.
  virage.matchStatus(8004, { status: '2H', elapsed: 50, homeGoals: 1, awayGoals: 0 });
  virage.matchEvents(8004, [
    { type: 'Card', detail: 'Red Card', teamId: 92, minute: 20, player: 'Rouge' },
    { type: 'Var', detail: 'Penalty cancelled', teamId: 91, minute: 30, player: 'Video' }]);
  await wait(900);
  const vieux = await ailleurs.evaluate(() => ({
    vus: [...window.__moments], entree: entreeMinute,
    auFil: (S.fil ?? []).filter((e) => ['Rouge', 'Video'].includes(e.joueur)).length,
  }));
  check(`un rouge de la 20e et une vidéo de la 30e, reçus à la 50e, ne font pas réagir `
    + `(vu : ${vieux.vus.join(', ') || 'rien'} ; entré à la ${vieux.entree ?? '?'}e)`,
  vieux.vus.length === 0 && vieux.entree != null);
  check('mais les deux entrent au fil', vieux.auFil === 2);

  // Sans quoi le contrôle du dessus passerait sur un personnage muet.
  virage.matchEvents(8004, [{ type: 'Card', detail: 'Red Card', teamId: 92,
    minute: 50, player: 'Frais' }]);
  await wait(600);
  const frais = await vus();
  check(`un rouge de la 50e, lui, le fait réagir (${frais.join(', ') || 'rien'})`,
    frais.some((t) => /ROUGE/.test(t)));

  const avantLeCoup = await entrer(8005);
  /* Le joueur attend depuis dix minutes quand le match commence : on recule
     l'instant de son entrée, plutôt que de les attendre. */
  await ailleurs.evaluate(() => { entreeA -= 10 * 60_000; });
  await guetter();
  virage.matchStatus(8005, { status: '1H', elapsed: 5, homeGoals: 0, awayGoals: 0 });
  virage.matchEvents(8005, [{ type: 'Card', detail: 'Red Card', teamId: 92,
    minute: 1, player: 'Premier' }]);
  await wait(900);
  const tot = await ailleurs.evaluate(() => ({ vus: [...window.__moments], entree: entreeMinute }));
  check('entré avant le coup d’envoi, le rouge de la 1re reçu à la 5e le fait réagir '
    + `(vu : ${tot.vus.join(', ') || 'rien'} ; entré à la ${tot.entree ?? '?'}e)`,
  avantLeCoup && tot.vus.some((t) => /ROUGE/.test(t)));

  /* **Le ticket terrain se retire quand on ne sait rien du vrai match.**
     La salle sème toujours le score réel (« 0 – 0 » avant le premier
     relevé) ; mais un état qui ne le porte pas — un serveur d'avant, une
     ligne que l'API ne détaille pas —, sans minute ni fait, laissait au
     ticket sa seule flèche : une bande de kraft vide sous le HUD, qui
     ouvrait une feuille vide. L'état est rejoué tel que la page le tient,
     sans score, minute ni fil ; le sticker de phase ne doit pas glisser à
     la place du ticket, et le relevé suivant, servi par la salle, doit le
     refaire paraître. */
  await ailleurs.evaluate(() => clearInterval(window.__sondeMoments));
  const sansRien = await ailleurs.evaluate(() => {
    const s = { ...S, scoreReel: null, minute: null, fil: [], you: { ...S.you, fanzzy: null } };
    for (const f of socket.listeners('virage:state')) f(s);
    const fil = document.getElementById('fil');
    const ligne = fil.parentElement, bord = ligne.getBoundingClientRect().right
      - parseFloat(getComputedStyle(ligne).paddingRight);
    return { retire: fil.hidden && fil.getBoundingClientRect().width === 0,
      ecart: Math.round(bord - document.getElementById('phase').getBoundingClientRect().right) };
  });
  check('sans score, minute ni fait, le ticket terrain se retire en entier', sansRien.retire);
  check(`et le sticker de phase reste au bout de sa rangée (à ${sansRien.ecart} px du bord)`,
    Math.abs(sansRien.ecart) <= 3);
  virage.matchStatus(8005, { status: '1H', elapsed: 7, homeGoals: 0, awayGoals: 0 });
  const revenu = await ailleurs.waitForFunction(() => {
    const fil = document.getElementById('fil');
    return !fil.hidden && fil.getBoundingClientRect().width > 0
      && document.getElementById('filMinute').textContent.trim() === '7′';
  }, { timeout: 4000 }).then(() => true).catch(() => false);
  check('le relevé suivant le refait paraître, avec sa minute', revenu);

  await ailleurs.close();
}

/* ============================================== un but pendant le geste

   Gaël, le 4 octobre 2026 : un but tombe pendant qu'il fait son geste, et
   l'alerte se pose sur le pavé. La fenêtre du geste vit dans `#app`, contexte
   d'empilement : la case du moment (z 95, quinze secondes) passait devant, et
   la secousse faisait trembler le pavé. Le chant raté coûtait quand même son
   souffle.

   Le geste est un vrai geste, ouvert au doigt sur un chant ; seule sa fin
   est tenue par la suite, pour mesurer pendant qu'il est ouvert. Une sonde
   regarde toutes les quarante millisecondes ce qui est à l'écran tant que
   la fenêtre l'est. */
{
  const idSocket = await page.evaluate(() => socket.id);
  await page.evaluate(() => {
    window.__vraiJouer = window.TBF_GESTE.jouer;
    window.TBF_GESTE.jouer = (...a) => {
      window.__vraiJouer(...a)?.catch?.(() => {});
      return new Promise((ok) => { window.__finirGeste = () => ok(null); });
    };
    /* Le tempo : un pavé qui compte ses frappes, de quoi voir qu'un appui
       arrive. Remis comme il était à la fin. */
    window.__chantEssai = { card: S.cards[0], gest: S.cards[0].gest };
    S.cards[0].gest = 'tempo';
  });
  const ouvrir = () => page.evaluate(() => {
    window.__finirGeste = null;
    S.you.breath = 100; souffleVuA = Date.now();
    const id = window.__chantEssai.card.id;
    const el = [...document.querySelectorAll('#hand [data-card]')]
      .find((n) => n.dataset.card === id);
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  });
  const pret = () => page.waitForFunction(
    () => document.querySelector('#mini.on #pad') && window.__finirGeste,
    { timeout: 6000 }).then(() => true).catch(() => false);
  const leSouvenir = () => page.evaluate(() => {
    const el = document.getElementById('souvenir');
    return {
      on: !el.hidden, face: el.dataset.etat === 'face',
      texte: el.querySelector('.tbf-souvenir-face > b')?.textContent.trim() ?? '',
      pile: P.souvenirs.length,
      opacite: Number(getComputedStyle(el).opacity),
      anims: el.getAnimations().length,
    };
  });
  const centreDuPave = () => page.evaluate(() => {
    const r = document.getElementById('pad').getBoundingClientRect();
    const n = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return n?.closest('#pad') ? 'le pavé' : `${n?.tagName}.${n?.className}`;
  });

  await page.evaluate(() => scene?.couper?.());
  await ouvrir();
  const ouvert = await pret();
  check('un geste s’ouvre sur son pavé', ouvert);
  /* **Le pavé se tient sur l'axe de la fenêtre**, avec son titre et sa
     consigne. La zone du geste prend toute la largeur (les épreuves s'y
     taillent en pour cent) ; le pavé rond n'en prend que 270 px au plus, et
     posé en bloc il partait au bord gauche de la zone pendant que le titre
     et la consigne restaient au centre : 43 px de décalage à cette largeur,
     227 à 768, sans qu'aucun autre contrôle le voie (le centre du pavé
     restait le pavé, l'appui comptait). Les centres horizontaux seuls :
     l'enfoncement d'une frappe ne déplace le pavé que vers le bas. */
  const axe = await page.evaluate(() => {
    const centre = (id) => {
      const r = document.getElementById(id)?.getBoundingClientRect();
      return r ? Math.round((r.left + r.width / 2) * 10) / 10 : null;
    };
    return { pave: centre('pad'), fenetre: centre('mini'), titre: centre('miniTitle'),
      consigne: centre('miniHint') };
  });
  check(`le pavé se tient sur l’axe de la fenêtre, avec son titre et sa consigne (pavé à ${
    axe.pave}, fenêtre ${axe.fenetre}, titre ${axe.titre}, consigne ${axe.consigne})`,
  axe.pave !== null
    && [axe.fenetre, axe.titre, axe.consigne].every((x) => x !== null && Math.abs(axe.pave - x) <= 2));
  const pileAvant = (await leSouvenir()).pile;

  await page.evaluate(() => {
    window.__vu = new Set();
    window.__sonde = setInterval(() => {
      if (!document.getElementById('mini').classList.contains('on')) return;
      const vu = (sel, nom) => { if (document.querySelector(sel)) window.__vu.add(nom); };
      vu('.tbf-moment.on', 'la case du moment');
      vu('.fx-titre', 'un titre');
      vu('.fx-flash', 'le flash');
      vu('#app.fx-shake', 'la secousse');
      vu('#souvenir:not([hidden])', 'la carte-souvenir');
      vu('.fx-bandeau', 'le bandeau');
    }, 40);
    // Un but de corde d'en face, né des chants des autres pendant le sien.
    for (const f of socket.listeners('virage:goal')) f({ side: S.you.side ^ 1 });
  });
  /* Un but réel de son club, puis un rouge frais d'en face : la case
     « ROUGE POUR EUX » arrive après « GOAL ! », et c'est pourtant le but qui
     doit rester à la fin — **un but réel passe en dernier**. */
  virage.realGoal({ fixtureId: 8001, teamId: 85, minute: 75, player: 'Mbaye', score: [4, 1] });
  await wait(300);
  virage.matchEvents(8001, [{ type: 'Card', detail: 'Red Card', teamId: 91,
    minute: 75, player: 'Pendant' }]);
  /* Et sa carte-souvenir, servie pendant le geste (`virage:souvenir`, à la
     seule socket de la page) : elle attend aussi. */
  io.to(idSocket).emit('virage:souvenir', { fixtureId: 8001, id: 601, minute: 75, joueur: 'Mbaye' });
  await wait(1300);

  const pendant = await page.evaluate(() => {
    const pad = document.getElementById('pad');
    const r = pad.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const n = document.elementFromPoint(x, y);
    return {
      x, y,
      dessus: n?.closest('#pad') ? 'le pavé' : `${n?.tagName}.${n?.className}`,
      vu: [...window.__vu],
      enAttente: apresLeGeste.length + momentsEnAttente.length,
      score: document.getElementById('filScore').textContent.trim(),
      double: document.getElementById('app').hasAttribute('data-double'),
      frappes: Number(document.getElementById('n')?.textContent),
    };
  });
  check('un but, un rouge ou une carte-souvenir pendant le geste ne posent rien sur l’écran '
    + `(${pendant.vu.join(', ') || 'rien'})`,
  pendant.vu.length === 0);
  check(`le centre du pavé reste le pavé (${pendant.dessus})`, pendant.dessus === 'le pavé');
  check('le score du terrain et la minute double, eux, suivent tout de suite',
    pendant.score === '4 – 1' && pendant.double
    || (console.log('        il dit :', pendant.score, pendant.double ? '(double)' : '(simple)'), false));
  // Le but de corde, le but réel et le rouge du fil : trois effets en file.
  check(`et le reste attend la fin du geste (${pendant.enAttente} en attente)`,
    pendant.enAttente >= 3);

  // Un vrai appui au centre : il doit compter.
  await page.mouse.click(pendant.x, pendant.y);
  await wait(120);
  const compte = await page.evaluate(() => Number(document.getElementById('n')?.textContent));
  check(`un appui au centre du pavé compte (${pendant.frappes} → ${compte})`,
    compte === pendant.frappes + 1);

  /* La carte-souvenir laisse passer le doigt, même posée là : c'est la garde
     de second rang (`pointer-events: none`, dans la pièce), pour ce qui
     passerait la file. */
  const souvenirDessus = await page.evaluate(({ x, y }) => {
    clearInterval(window.__sonde);
    const el = document.getElementById('souvenir');
    el.hidden = false;
    const r = el.getBoundingClientRect();
    const couvre = r.left <= x && x <= r.right && r.top <= y && y <= r.bottom;
    const n = document.elementFromPoint(x, y);
    const dessus = n?.closest('#pad') ? 'le pavé' : `${n?.tagName}.${n?.className}`;
    el.hidden = true;
    return { dessus, couvre };
  }, pendant);
  check(`la carte-souvenir laisse passer le doigt (${souvenirDessus.dessus}`
    + `${souvenirDessus.couvre ? ', posée sur le centre du pavé' : ', hors du centre'})`,
  souvenirDessus.dessus === 'le pavé');

  await page.evaluate(() => window.__finirGeste());
  await wait(600);
  /* **Le jeu d'abord** (Gaël, 6 octobre 2026) : les trois moments se
     montrent l'un après l'autre, chacun le temps de se lire — la corde qui a
     cédé, puis le rouge du match, et le but réel en dernier, qui reste.
     Posés d'un coup, on n'en voyait que le dernier. */
  const premier = await laScene();
  check(`à la fermeture, le jeu d’abord : la corde (${premier.titre})`,
    premier.on && premier.titre === 'ILS ONT FAIT CÉDER LA CORDE'
    || (console.log('        ', JSON.stringify(premier)), false));
  check('la carte-souvenir attend le but dont elle est le souvenir', !(await leSouvenir()).on);
  await wait(3500);
  const second = await laScene();
  check(`puis le match : le rouge (${second.titre})`,
    second.on && second.titre === 'ROUGE POUR EUX'
    || (console.log('        ', JSON.stringify(second)), false));
  await wait(3500);
  const apres = await laScene();
  const vide = await page.evaluate(() => apresLeGeste.length + momentsEnAttente.length);
  check(`et le but réel en dernier, qui reste à l’écran (${apres.titre})`,
    apres.on && apres.titre === 'GOAL !'
    || (console.log('        ', JSON.stringify(apres)), false));
  /* Et le personnage exulte : rien de ce que la fermeture remet en place ne
     doit passer devant la célébration qui se charge. */
  check(`et le personnage exulte (${apres.etat})`, apres.etat === 'but');
  check('et la file est vidée', vide === 0);
  const sv = await leSouvenir();
  check(`puis la carte-souvenir (${sv.texte})`, sv.on && /Mbaye/.test(sv.texte)
    || (console.log('        ', JSON.stringify(sv)), false));
  await wait(3200);
  check('qui rejoint la pile', (await leSouvenir()).pile === pileAvant + 1);

  /* Second cas : une case déjà à l'écran quand le geste s'ouvre. Posée sur
     `body` pour quinze secondes, elle passerait par-dessus le pavé. */
  await page.evaluate(() => scene.moment('but', 'ESSAI', {}));
  await ouvrir();
  const coupee = await page.evaluate(() =>
    !document.querySelector('.tbf-moment')?.classList.contains('on'));
  check('ouvrir un geste coupe la case déjà affichée', coupee);
  await pret();
  await page.evaluate(() => window.__finirGeste?.());
  await wait(200);

  /* Troisième cas : une carte-souvenir déjà à l'écran quand le geste
     s'ouvre. Elle paraît peu après un but de son club, en pleine minute
     double, et c'est justement là qu'on relance un chant : elle tenait le
     centre de l'écran jusqu'à partir vers la pile. Elle se range, et revient
     à la fermeture, déjà retournée, pour le temps qui lui restait — ni
     coupée, puisqu'on l'a à peine vue, ni rejouée en entier, puisqu'on
     croirait en avoir gagné deux. Ses minuteries ne doivent pas la poser
     dans la pile pendant le geste. */
  await page.evaluate(() => scene?.couper?.());
  io.to(idSocket).emit('virage:souvenir', { fixtureId: 8001, id: 602, minute: 80, joueur: 'Retour' });
  await page.waitForFunction(() => !document.getElementById('souvenir').hidden, { timeout: 3000 })
    .catch(() => {});
  await wait(1000);
  const p0 = (await leSouvenir()).pile;
  await ouvrir();
  await pret();
  const sousLeGeste = { ...(await leSouvenir()), dessus: await centreDuPave() };
  check('une carte-souvenir déjà là se range quand le geste s’ouvre '
    + `(centre du pavé : ${sousLeGeste.dessus})`,
  !sousLeGeste.on && sousLeGeste.dessus === 'le pavé'
    || (console.log('        ', JSON.stringify(sousLeGeste)), false));
  // Son départ vers la pile tombait 2,4 s après sa face : il est passé.
  await wait(1000);
  const pendantLeGeste = await leSouvenir();
  check('et ses minuteries ne la posent pas dans la pile pendant le geste',
    !pendantLeGeste.on && pendantLeGeste.pile === p0
    || (console.log('        ', JSON.stringify(pendantLeGeste)), false));
  await page.evaluate(() => window.__finirGeste?.());
  const fermeA = Date.now();
  await wait(650);
  const revenu = await leSouvenir();
  check(`et revient à la fermeture, déjà retournée (${revenu.texte})`,
    revenu.on && revenu.face && /Retour/.test(revenu.texte) && revenu.pile === p0
    || (console.log('        ', JSON.stringify(revenu)), false));
  /* Rangée après une seconde de face, il lui en restait moins d'une et
     demie : revenue 0,4 s après la fermeture, elle part vers la pile et s'y
     éteint vers 2,3 s. Rejouée en entier, retournement compris, elle
     tiendrait jusque vers 3,3 s : on regarde entre les deux. */
  await wait(Math.max(0, fermeA + 2850 - Date.now()));
  const partie = await leSouvenir();
  check('puis rejoint la pile au bout du temps qui lui restait seulement',
    !partie.on && partie.pile === p0 + 1
    || (console.log('        ', JSON.stringify(partie)), false));

  /* Moins d'une seconde de reste : elle a été lue, elle va droit à la pile,
     et ne revient pas. */
  io.to(idSocket).emit('virage:souvenir', { fixtureId: 8001, id: 603, minute: 81, joueur: 'Lue' });
  await page.waitForFunction(() => !document.getElementById('souvenir').hidden, { timeout: 3000 })
    .catch(() => {});
  await wait(1700);
  const p1 = (await leSouvenir()).pile;
  await ouvrir();
  const lueSous = await leSouvenir();
  await pret();
  await page.evaluate(() => window.__finirGeste?.());
  await wait(650);
  const lueApres = await leSouvenir();
  check('une carte-souvenir presque finie va droit à la pile, et ne revient pas',
    !lueSous.on && lueSous.pile === p1 + 1 && !lueApres.on && lueApres.pile === p1 + 1
    || (console.log('        ', JSON.stringify({ p1, lueSous, lueApres })), false));

  /* Deux cartes de suite : la seconde paraît après le glissement de la
     première, au centre et entière. Le glissement finit en
     `fill: 'forwards'` (la règle de la carte jouée) ; laissé en place, il
     poserait la seconde au coin de la pile, à moitié éteinte. */
  io.to(idSocket).emit('virage:souvenir', { fixtureId: 8001, id: 604, minute: 84, joueur: 'Premiere' });
  io.to(idSocket).emit('virage:souvenir', { fixtureId: 8001, id: 605, minute: 85, joueur: 'Seconde' });
  await wait(3400);
  const seconde = await leSouvenir();
  check(`la carte-souvenir suivante paraît au centre, entière (${seconde.texte}, `
    + `opacité ${seconde.opacite}, ${seconde.anims} animation(s))`,
  seconde.on && /Seconde/.test(seconde.texte) && seconde.opacite > 0.95 && seconde.anims === 0);
  await page.waitForFunction(() => document.getElementById('souvenir').hidden, { timeout: 5000 })
    .catch(() => {});

  /* On rend la page comme on l'a trouvée : le chant, le moteur des gestes,
     et une pile vide — le bloc de la carte-souvenir, plus bas, compte la
     sienne depuis zéro. */
  await page.evaluate(() => {
    window.TBF_GESTE.jouer = window.__vraiJouer;
    window.__chantEssai.card.gest = window.__chantEssai.gest;
    scene?.couper?.();
    P.souvenirs = [];
    renderPile();
  });
}

/* ------------------------------------------------------- le personnage

 * Le virage avait le fil et le but réel ; il lui manquait le supporter. La
 * corde bougeait toute seule au milieu d'un écran vide, et le Fanzzy que le
 * joueur avait choisi n'apparaissait nulle part — pas plus au but réel qu'au
 * moment de pousser.
 *
 * Ce qui se joue ici et qu'aucune lecture du code ne tranche :
 *
 *   1. **C'est le bon personnage, au bon âge.** Le serveur l'envoie résolu ;
 *      la page n'a rien à recalculer, donc rien à se tromper.
 *   2. **Il réagit.** Le but réel, la vidéo, le coup de sifflet : trois
 *      moments qui le font changer d'état. La plupart des Fanzzy n'ont pas
 *      leurs douze poses dessinées et gardent le même plein-pied — regarder
 *      l'image ne prouverait donc rien, on lit l'état de la scène.
 *   3. **Il ne coûte pas un chant.** Il occupe le bas de la tribune, là où le
 *      doigt passe : un personnage qui intercepte un appui vole un geste.
 */
{
  const monte = await page.waitForSelector('#fzs .tbf-scene', { timeout: 5000 })
    .then(() => true).catch(() => false);
  check('le Fanzzy est monté dans la tribune', monte);

  const arrive = await page.evaluate(() => new Promise((r) => {
    const t0 = Date.now();
    const voir = () => {
      const i = document.querySelector('#fzs .tbf-pose.on');
      if (i?.naturalWidth > 0) return r(true);
      if (Date.now() - t0 > 12000) return r(false);
      setTimeout(voir, 80);
    };
    voir();
  }));
  check('et son dessin est vraiment arrivé', arrive);

  const p = await page.evaluate(() => ({
    fanzzy: S.you?.fanzzy ?? null,
    src: document.querySelector('#fzs .tbf-pose.on')?.getAttribute('src') ?? '',
    souffle: getComputedStyle(document.querySelector('#fzs .tbf-souffle')).animationName,
    // `elementFromPoint` respecte `pointer-events`, contrairement à
    // `elementsFromPoint` qui rend tout ce qui se trouve sous le point et
    // rendrait ce contrôle incapable d'échouer.
    sous: (() => {
      const r = document.getElementById('fzs').getBoundingClientRect();
      const n = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return n?.closest('#fzs') ? 'le personnage' : (n?.className ?? 'rien');
    })(),
    dedans: (() => {
      const f = document.getElementById('fzs').getBoundingClientRect();
      const c = document.getElementById('rope').getBoundingClientRect();
      return f.bottom <= c.bottom + 1 && f.left >= c.left - 1 && f.right <= c.right + 1;
    })(),
  }));

  check('le serveur donne le personnage, pas seulement ses barèmes',
    p.fanzzy?.id === 'TR32');
  /* **Au premier âge, et c'était déjà vrai des chiffres.**

     `deck/index.js` le dit depuis longtemps : « un deck entre toujours au
     premier âge […] deux tribunes se rencontrent donc au même niveau, et
     l'écart se creuse par ce qu'on joue, pas par ce qu'on a payé ». Les
     effets employés dans la salle sont ceux du premier âge.

     Le **dessin**, lui, montrait l'âge choisi : on poussait avec les chiffres
     du Choriste sous les traits du Meneur de chant, et rien ne le disait.
     Ce contrôle affirmait « à l'âge atteint » sans jamais dire pourquoi — il
     figeait ce qui était, pas ce qui devait être.

     Ce qui se choisit sur la fiche — l'âge, l'expression — est de
     l'apparence, et l'apparence s'arrête à la porte du terrain. La tenue,
     elle, passe : elle ne dit rien sur la force de personne. */
  check('au premier âge, comme les chiffres qu’il emploie',
    p.fanzzy?.evo === 1 && /Choriste/.test(p.fanzzy?.nom ?? '')
    || (console.log('        il envoie :', JSON.stringify(p.fanzzy)), false));
  /* Et la tenue voyage avec lui : c'est le seul des trois réglages qui
     traverse, et celui qu'on a choisi doit se voir en tribune. */
  check('et sa tenue vient avec', typeof p.fanzzy?.skin === 'string'
    || (console.log('        il envoie :', JSON.stringify(p.fanzzy)), false));
  /* Le cri manquait entièrement : la page appelait `S.you.cri`, cette clé
     n'était jamais envoyée, et la vidéo du Cri ne s'est donc jamais jouée
     depuis le virage. Une faute muette — rien ne se casse quand une
     récompense n'arrive pas. */
  check('et son cri, qui déclenche la vidéo d’un geste parfait',
    Boolean(p.fanzzy?.cri));
  /* Le dessin suit : `TR32` et non `TR32B`. C'est la moitié qui manquait —
     un serveur qui annonce le bon âge et une page qui en dessine un autre
     se relisent tous les deux comme corrects. */
  check('le dessin montré est celui du premier âge',
    /TR32[.\-/]/.test(p.src) && !/TR32B/.test(p.src)
    || (console.log('        il montre :', p.src), false));
  check('il respire', p.souffle !== 'none' && p.souffle !== '');
  check('il n’intercepte pas les appuis de la tribune',
    p.sous !== 'le personnage' || (console.log('        sous le doigt :', p.sous), false));
  check('il tient dans la corde, au-dessus de la main', p.dedans);
}

/* ------------------------------------------------- ce qui le fait réagir */

// `laScene` est plus haut : la main, le fil et le geste s'en servent aussi.

{
  /* Un vrai but de son club. Le buteur et la minute viennent de l'événement
     lui-même — aucun appel de plus à l'API pour les afficher. Le cinquième
     au tableau, avec le score que le relevé lui donne : le quatrième,
     Mbaye, est tombé pendant le geste (plus haut). La vidéo le retire plus
     bas, d'où le 4 – 1 du coup de sifflet final. */
  virage.realGoal({ fixtureId: 8001, teamId: 85, minute: 78, player: 'Sarr', score: [5, 1] });
  await wait(600);
  const b = await laScene();
  check('un but réel le fait exulter', b.etat === 'but');
  check('« GOAL ! » s’affiche', /GOAL/.test(b.titre));
  check('avec le buteur et la minute',
    /Sarr/.test(b.sous) && /78/.test(b.sous)
    || (console.log('        il dit :', b.sous), false));
  /* Quinze secondes, et c'est délibérément long : le temps de sortir le
     téléphone de sa poche, une célébration de deux secondes et demie n'a
     laissé aucune trace. La durée vient de `fx.js`, une seule fois pour tout
     le jeu. */
  check('et le moment tient quinze secondes',
    b.duree.trim() === '15000ms'
    || (console.log('        il tient', b.duree), false));

  /* ---------------------------------- la carte-souvenir, et elle seule

   * La page l'annonçait 1,4 s après chaque but de son club — « Tu y étais.
   * Elle est dans ton carnet. » —, même quand la compétition n'est pas
   * couverte ou que le joueur n'avait pas poussé dans la fenêtre : la carte
   * n'existait pas. Elle ne s'annonce plus que sur `virage:souvenir`, servi
   * à ceux qui l'ont reçue (CONTRATS.md, § 16.3). On l'envoie ici à la seule
   * socket de la page, comme le serveur le fera. Le nom du buteur vient de
   * l'API sportive : il se pose en texte, jamais en balisage. */
  await wait(1300);
  check('un but de son club n’annonce pas, à lui seul, de carte-souvenir',
    await page.evaluate(() => document.getElementById('souvenir').hidden));
  const idSocket = await page.evaluate(() => socket.id);
  io.to(idSocket).emit('virage:souvenir', { fixtureId: 8001, id: 501, minute: 78, joueur: '<b>Sarr</b>' });
  await wait(900);
  const sv = await page.evaluate(() => {
    const el = document.getElementById('souvenir');
    return {
      montre: !el.hidden,
      nom: document.querySelector('#souvenir b')?.textContent ?? '',
      balise: Boolean(document.querySelector('#souvenir b b')),
      /* La pièce de la feuille (`.tbf-souvenir`) : retournée par
         `data-etat="face"`, la minute imprimée, et l'écharpe de mon club
         posée sur la carte elle-même — elle vit hors de la colonne. */
      piece: el.classList.contains('tbf-souvenir'),
      face: el.dataset.etat === 'face',
      minute: el.querySelector('i')?.textContent ?? '',
      echarpe: getComputedStyle(el).getPropertyValue('--e1').trim(),
      club: getComputedStyle(document.getElementById('app')).getPropertyValue('--e1').trim(),
    };
  });
  check('virage:souvenir l’annonce', sv.montre);
  check('et le nom du buteur y est un texte', (sv.nom === '<b>Sarr</b>' && !sv.balise)
    || (console.log('        il dit :', sv.nom, sv.balise ? '(balisage interprété)' : ''), false));
  check('la carte se retourne au centre, face visible, minute imprimée',
    sv.piece && sv.face && sv.minute === '78′'
    || (console.log('        pièce', sv.piece, '· face', sv.face, '· minute', sv.minute), false));
  check('et sa face porte l’écharpe de son club',
    Boolean(sv.echarpe) && sv.echarpe === sv.club
    || (console.log('        écharpe', sv.echarpe || '(aucune)', '· club', sv.club || '(aucun)'), false));
  await wait(2600);
  check('puis la carte rejoint la pile du match', await page.evaluate(() =>
    !document.getElementById('pile').hidden && document.getElementById('pile').textContent.trim() === '1'));
  /* Le même souvenir réannoncé ne s'empile pas deux fois. */
  io.to(idSocket).emit('virage:souvenir', { fixtureId: 8001, id: 501, minute: 78, joueur: 'Sarr' });
  await wait(300);
  check('et un souvenir déjà reçu ne s’annonce pas deux fois', await page.evaluate(() =>
    document.getElementById('souvenir').hidden && document.getElementById('pile').textContent.trim() === '1'));

  /* ------------------------------------------- aux couleurs du club

   * L'API ne donne pas les couleurs des équipes, elle donne un écusson. On les
   * en extrait une fois, on n'en garde que deux chaînes de sept caractères, et
   * le « GOAL ! » porte la couleur du club qui vient de marquer.
   *
   * **Il la porte autour de la lettre, et non plus dans la lettre** (lot 2,
   * la case unifiée de ui.css) : le mot est à la craie, et `--mc` colore le
   * liseré de la case, les rayons et la bouffée de fumigène. La lettre se lit
   * donc quel que soit le club ; c'est la couleur du camp qui doit encore se
   * voir.
   *
   * Le piège est toujours là, et il a seulement changé de place : ces
   * couleurs sont faites pour du papier blanc. Le bleu marine du blason, en
   * liseré et en fumée sur le noir de l'écran, ne se voit pas — un but
   * célébré sans qu'on sache de quel camp. `FX.lisible` l'éclaircit en
   * gardant sa teinte, et c'est ce que ce contrôle mesure. Il lit aussi ce
   * que `--mc` colore pour de bon : une variable juste qui ne peindrait plus
   * rien passerait sinon au vert.
   */
  {
    const teinte = await page.evaluate(() => {
      const moment = document.querySelector('.tbf-moment');
      const mc = moment.style.getPropertyValue('--mc').trim();
      /* La craie telle que le navigateur la calcule, lue sur une sonde : une
         valeur écrite ici en dur divergerait au premier réglage du jeton. */
      const sonde = document.createElement('i');
      sonde.style.color = 'var(--craie)';
      document.body.append(sonde);
      const craie = getComputedStyle(sonde).color;
      sonde.remove();
      const mot = moment.querySelector('b');
      const lettre = mot ? getComputedStyle(mot).color : null;
      const m = /^#([0-9a-f]{6})$/i.exec(mc);
      if (!m) return { mc, craie, lettre, clarte: null, bleuDominant: null, lisere: null };
      const n = parseInt(m[1], 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      const vignette = moment.querySelector('.tbf-vignette');
      return {
        mc,
        craie,
        lettre,
        /* Le liseré est la première ombre de la case : le navigateur y a déjà
           résolu `var(--mc)` en `rgb(…)`, et c'est cette couleur-là qu'on
           voit autour du mot. */
        lisere: vignette ? getComputedStyle(vignette).boxShadow.includes(`rgb(${r}, ${g}, ${b})`) : false,
        clarte: (Math.max(r, g, b) + Math.min(r, g, b)) / 510,
        // La teinte est conservée : c'est encore le bleu du club, pas un
        // blanc passe-partout. Un éclaircissement qui perd la teinte ne
        // servirait à rien — autant garder l'or du jeu.
        bleuDominant: b > r + 20 && b > g + 20,
      };
    });
    check('le but porte la couleur du club',
      /^#[0-9A-F]{6}$/i.test(teinte.mc)
      || (console.log('        sa couleur :', teinte.mc), false));
    check('elle borde la case du but',
      teinte.lisere === true
      || (console.log(`        ${teinte.mc} absente du liseré`), false));
    check('et le mot, lui, s’écrit à la craie',
      Boolean(teinte.lettre) && teinte.lettre === teinte.craie
      || (console.log(`        il s’écrit en ${teinte.lettre}, la craie est ${teinte.craie}`), false));
    check('éclaircie assez pour se voir sur le noir',
      (teinte.clarte ?? 0) > 0.5
      || (console.log(`        clarté ${teinte.clarte?.toFixed(2)}`), false));
    check('sans cesser d’être la couleur du club', teinte.bleuDominant === true);

    /* Et la garde en face : un club dont le blason n'a pas encore été lu n'a
       pas de couleur du tout. Son liseré ne doit pas être en « undefined » —
       la case perdrait son bord —, il doit garder l'or du jeu. */
    const defaut = await page.evaluate(() => couleurDuCamp(S.you.side ^ 1));
    check('un club sans couleur garde celle du jeu', defaut === 'var(--projo)');

    /* `lisible` ne devine pas : ce qui n'est pas une couleur ressort tel quel,
       et une couleur déjà claire n'est pas retouchée. */
    const brut = await page.evaluate(() => ({
      pasUneCouleur: FX.lisible('var(--projo)'),
      dejaClaire: FX.lisible('#F5C33B'),
    }));
    check('ce qui n’est pas une couleur n’est pas deviné',
      brut.pasUneCouleur === 'var(--projo)');
    check('et une couleur déjà claire n’est pas retouchée',
      brut.dejaClaire === '#F5C33B');
  }

  /* Le but refusé. Sans état de déception ni un mot sur la cause, le score se
     corrige tout seul à l'écran et le joueur y voit un bug. */
  virage.matchEvents(8001, [{ type: 'Var', detail: 'Goal cancelled',
    teamId: 85, minute: 79, player: 'Sarr' }]);
  await wait(500);
  const v = await laScene();
  check('la vidéo lui coupe la célébration', v.etat === 'decision');
  check('et le bandeau dit que le but est refusé',
    /REFUS/.test(v.titre) || (console.log('        il dit :', v.titre), false));

  /* Le coup de sifflet final. Le personnage doit **cesser de pousser** : sur
     l'accueil, il a continué après la fin du match pendant des semaines,
     parce qu'une minuterie oubliait de se vider. */
  virage.matchStatus(8001, { status: 'FT', elapsed: 90, homeGoals: 4, awayGoals: 1 });
  await wait(500);
  const f = await laScene();
  check('le coup de sifflet final le fait fêter la victoire',
    f.etat === 'victoire' && /VICTOIRE/.test(f.titre)
    || (console.log('        état', f.etat, '·', f.titre), false));
}

/* ------------------------------------------- la sortie, et ce qu'elle cache

 * La barre du bas a disparu : le bouton de menu est désormais la **seule**
 * façon de quitter le Virage. Il flotte au-dessus de l'écran, et un bouton
 * qui flotte se pose sur ce qui était là — ici, sur le nom du club de droite,
 * c'est-à-dire le sien. Trouvé à l'œil, éprouvé ici.
 */
{
  await page.waitForSelector('.tbf-burger', { timeout: 6000 }).catch(() => {});
  const sortie = await page.evaluate(() => {
    const b = document.querySelector('.tbf-burger');
    if (!b) return { absent: true };
    const rb = b.getBoundingClientRect();
    const genes = [];
    for (const sel of ['#clubMe b', '#clubFoe b', '#score', '#phase']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (rb.left < r.right && r.left < rb.right && rb.top < r.bottom && r.top < rb.bottom) {
        genes.push(sel);
      }
    }
    return { absent: false, genes, dansLEcran: rb.right <= innerWidth + 1 && rb.top >= -1 };
  });
  /* Et la même chose sur un grand écran. Le contrôle ci-dessus ne vaut qu'à
     quatre cents pixels, et c'est là que la place manque — mais les deux
     boutons flottent au bord de la **colonne**, pas de la fenêtre : sur un
     ordinateur, la colonne est plus étroite que l'écran, et rien ne dit a
     priori que le dégagement y tombe juste. C'est d'ailleurs sur un écran
     large que le défaut a été vu. */
  await page.setViewport({ width: 1200, height: 880 });
  await wait(300);
  const large = await page.evaluate(() => {
    const dedans = (bouton) => {
      const b = bouton.getBoundingClientRect();
      const g = [];
      for (const el of document.querySelectorAll('.hud *')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (b.left < r.right - 0.5 && r.left < b.right - 0.5
            && b.top < r.bottom - 0.5 && r.top < b.bottom - 0.5) {
          g.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''));
        }
      }
      return g;
    };
    const col = document.getElementById('app').getBoundingClientRect();
    const bur = document.querySelector('.tbf-burger').getBoundingClientRect();
    return {
      genants: [...dedans(document.querySelector('.tbf-burger')),
                ...dedans(document.querySelector('.tbf-retour'))],
      dansLaColonne: bur.right <= col.right + 1 && bur.left >= col.left - 1,
      colonnePlusEtroite: col.width < innerWidth - 200,
    };
  });
  check('sur un grand écran non plus, les boutons ne recouvrent rien',
    large.genants.length === 0
    || (console.log('        ', large.genants.join(' · ')), false));
  check('et ils restent accrochés à la colonne', large.dansLaColonne);
  // Ce qui rend le précédent honnête : la colonne n'est pas la fenêtre.
  check('or la colonne y est bien plus étroite que l’écran', large.colonnePlusEtroite);
  await page.setViewport({ width: 400, height: 880 });
  await wait(300);

  check('le Virage garde une sortie', sortie.absent === false);
  check('et le bouton de menu ne recouvre rien de l’en-tête',
    (sortie.genes ?? []).length === 0);
  if (sortie.genes?.length) console.log('        il recouvre :', sortie.genes.join(', '));
  check('il est bien dans l’écran', sortie.dansLEcran === true);
}


/* ================================ l'écran de choix, quand il y a du monde

   Depuis que la liste montre **tout** ce qui se joue et non plus les seuls
   clubs suivis, elle fait quarante lignes un samedi soir. Le voile centrait
   son contenu : au-delà d'un écran, le titre et le champ de recherche
   sortaient **par le haut**, hors d'atteinte — on ne remonte pas au-dessus du
   début d'une zone qui défile. L'écran s'ouvrait au milieu d'une liste de
   matchs turcs, sans rien dire de ce qu'on regardait.

   Le contrôle mesure donc une **position**, pas une présence : le titre existe
   dans les deux cas, il n'est simplement plus sur l'écran. */

{
  const page2 = await nav.newPage();
  page2.on('pageerror', (e) => erreurs.push(e.message));
  await page2.setViewport({ width: 400, height: 880 });
  await page2.goto(base + '/virage', { waitUntil: 'networkidle0' });

  // Quarante rencontres en direct, comme un soir de coupe.
  await page2.evaluateOnNewDocument(() => {
    window.__beaucoup = Array.from({ length: 40 }, (_, i) => ({
      id: 9000 + i, open: true, elapsed: 20 + i, status_short: '2H',
      luA: Date.now(), mien: false, crowd: [0, 0],
      home_id: 500 + i, away_id: 600 + i,
      home_name: `Club ${i}`, away_name: `Adverse ${i}`,
      home_goals: 0, away_goals: 0,
      league_name: i % 2 ? 'Türkiye Kupası' : 'Thai League 2',
      pays: i % 2 ? 'Turkey' : 'Thailand',
      drapeau: `https://media.api-sports.io/flags/${i % 2 ? 'tr' : 'th'}.svg`,
      homeColors: [], awayColors: [],
    }));

    // Le détournement voyage avec le talon : même document, même moment.
    const vrai = window.fetch;
    window.fetch = (u, o) => (String(u).includes('/api/virage/live')
      ? Promise.resolve(new Response(JSON.stringify(
        { matchs: window.__beaucoup, ferveurNeutre: 0.5 }),
      { headers: { 'content-type': 'application/json' } }))
      : vrai(u, o));
  });
  await page2.reload({ waitUntil: 'networkidle0' });
  await wait(900);

  const vu = await page2.evaluate(() => {
    const t = document.getElementById('veilTitle').getBoundingClientRect();
    const q = document.getElementById('q');
    return {
      titreEnHaut: Math.round(t.top),
      titreVisible: t.top >= 0 && t.bottom <= innerHeight,
      champ: Boolean(q) && !document.getElementById('rech').hidden,
      lignes: document.querySelectorAll('.match').length,
    };
  });
  check('quarante matchs sont proposés', vu.lignes === 40);
  check('et le titre reste à l’écran', vu.titreVisible
    || (console.log('        il est à', vu.titreEnHaut, 'px'), false));
  check('avec le champ de recherche', vu.champ === true);

  /* La recherche : une équipe, une compétition, ou **un pays dans sa langue**.
     La page est lue en français ; les matchs, eux, arrivent avec « Turkey ».
     Sans la traduction faite chez le lecteur, « turquie » ne trouverait rien. */
  const chercher = async (mot) => {
    await page2.evaluate((x) => {
      const q = document.getElementById('q');
      q.value = x;
      q.dispatchEvent(new Event('input'));
    }, mot);
    await wait(320);
    return page2.evaluate(() => document.querySelectorAll('.match').length);
  };

  check('chercher une compétition réduit la liste', await chercher('thai') === 20);
  check('chercher un club aussi', await chercher('Club 7') === 1);
  check('et un pays dans la langue du lecteur', await chercher('turquie') === 20
    || (console.log('        il en reste :', await chercher('turquie')), false));
  check('sans rien trouver, la page le dit',
    await chercher('zzzz') === 0 && /Aucun match ne répond/.test(
      await page2.evaluate(() => document.getElementById('matchs').textContent)));

  await chercher('');
  await page2.close();
}

/* ------------------------------------------- le menu, sur un écran de jeu

   La barre laisse passer les clics — entre ses deux boutons se trouve
   l'en-tête du jeu, qui doit rester cliquable — et elle les rend à ses
   boutons, nommés un par un. Le bouton de menu n'était pas de la liste : elle
   nommait le solde d'écharpes, retiré de la barre le jour où elle a été
   simplifiée. Le sélecteur ne désignait plus rien, et le menu du Virage ne
   s'ouvrait plus. Un écran de jeu sans menu est un cul-de-sac. */
{
  const ouvert = await page.evaluate(async () => {
    const b = document.querySelector('.tbf-burger');
    if (!b) return 'pas de bouton';
    // Ce que le doigt touche vraiment à cet endroit-là de l'écran.
    const r = b.getBoundingClientRect();
    const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!b.contains(dessus) && dessus !== b) return 'recouvert par ' + (dessus?.className ?? '?');
    b.click();
    await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    return document.querySelector('.tbf-tiroir.on') ? 'ouvert' : 'sans effet';
  });
  check('le bouton de menu ouvre le tiroir sur un écran de jeu', ouvert === 'ouvert'
    || (console.log('        il dit :', ouvert), false));
}


/* ------------------------------------------------ inviter sur ce match

   Un virage se pousse à plusieurs, et le jeu n'avait aucun moyen de faire
   venir quelqu'un. Ce qui est éprouvé ici est **ce qui part** : le lien doit
   porter le match, et rien d'autre. Porter aussi la tribune enverrait
   l'invité du côté de l'expéditeur — parfois contre son propre club. */
{
  const partage = await page.evaluate(async () => {
    // Le navigateur du banc ne sait pas partager : on lui apprend, et on note.
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (d) => { window.__partage = d; },
    });
    // `TBF_PARTAGE` a lu `navigator.share` au chargement : on redit au bouton
    // qu'il peut paraître, comme la page le fait au premier rendu.
    window.TBF_PARTAGE.possible = true;
    const b = document.getElementById('partager');
    b.hidden = false;
    b.click();
    await new Promise((ok) => setTimeout(ok, 120));
    return window.__partage ?? null;
  });

  check('le Virage sait inviter quelqu’un', Boolean(partage));
  check('et le lien porte le match', /\/virage\?match=8001/.test(partage?.url ?? '')
    || (console.log('        il envoie :', partage?.url), false));
  check('mais pas la tribune', !/camp/.test(partage?.url ?? ''));
  check('et le message nomme la rencontre', /Sion|Bâle/.test(partage?.text ?? '')
    || (console.log('        il dit :', partage?.text), false));
}

/* ==================== l'écran quand la bibliothèque du direct n'arrive pas

   Un joueur a décrit la panne en une phrase : « plus rien dans VIRAGE et
   DUEL ». Les deux écrans touchés étaient exactement les deux seuls à charger
   /socket.io/socket.io.js, et tous deux appelaient leur fonction de connexion
   **en première ligne du démarrage, hors de tout rattrapage**. `io` absent,
   l'appel levait, la fonction de démarrage rejetait, et rien de ce qui suit
   ne se jouait — ni la lecture des matchs, ni le rendu. Le Virage restait
   blanc, sans un mot, parce que le code qui aurait pu parler était après la
   ligne qui levait.

   On refuse le fichier au réseau : c'est la panne telle qu'elle arrive — un
   mandataire qui ne relaie pas ce chemin, une extension qui le bloque.

   Ce qu'on éprouve n'est pas que le direct marche. Il ne marche pas, c'est le
   postulat. On éprouve que **la page vive sans lui** : la liste arrive par un
   appel ordinaire, elle n'a jamais eu besoin d'une socket. */
{
  const sans = await nav.newPage();
  await sans.setViewport({ width: 400, height: 880 });
  await sans.setRequestInterception(true);
  sans.on('request', (r) => (/socket\.io/.test(r.url()) ? r.abort() : r.continue()));
  await sans.goto(base + '/virage', { waitUntil: 'domcontentloaded' });

  /* **Le contrôle qui porte.** Sans le rattrapage, `peindre()` ne tourne
     jamais et `#matchs` reste tel que le balisage l'a laissé. */
  let vu = null;
  for (let i = 0; i < 100 && !vu; i++) {
    await wait(120);
    vu = await sans.evaluate(() => {
      const el = document.getElementById('matchs');
      const txt = el ? el.textContent.replace(/\s+/g, ' ').trim() : null;
      return txt ? { txt } : null;
    });
  }
  check('sans la bibliothèque du direct, le Virage dessine quand même sa liste',
    Boolean(vu)
    || (console.log('        #matchs est resté vide'), false));

  /* Et il le dit. Montrer des matchs sur lesquels on ne peut pas pousser sans
     prévenir enverrait le joueur appuyer sur une porte fermée. */
  check('et il prévient qu’on ne peut pas y entrer',
    /PAS DE CONNEXION EN DIRECT/i.test(vu?.txt ?? '')
    || (console.log('        il dit :', (vu?.txt ?? '').slice(0, 80)), false));

  await sans.close();
}
/* ===================== quitter la tribune : le bilan, ou rien à demander

   « Si je sors d'un virage, je n'ai pas de message qui avertit et j'arrive
   sur une page vide. » Les deux moitiés étaient vraies : la page
   n'interceptait aucune sortie et n'émettait jamais `virage:leave`.

   **Le lot 6 a remplacé la question par le bilan de tribune** (QUESTIONS
   Q10) : à la flèche ou au menu, **si l'on a poussé pendant ce match**, la
   page demande `virage:bilan` et pose la page kraft, avec RESTER et SORTIR ;
   sans poussée, on sort sans rien demander — une confirmation qui ne dit
   rien apprend à passer outre. Sans bilan servi (un serveur d'avant la
   vague 2, le réseau), au-delà de trois secondes, la sortie reste celle
   d'avant : la boîte « QUITTER LA TRIBUNE ? ». Et au coup de sifflet final
   (`virage:fin`), la page demande son bilan, le pose sans qu'on touche rien,
   puis quitte la salle et n'y rentre plus.

   **Ce que le serveur répond ne décide pas du contrôle** : la page est
   espionnée (ce qu'elle émet est relevé, et `virage:bilan` ne part pas vers
   le serveur), et le bilan lui est envoyé par la socket du banc, à elle
   seule. Le même contrôle vaut donc avant et après la vague 2 du serveur.

   Chaque cas sur une page à part : les blocs précédents ont besoin de leur
   virage. **Et sur le second match (8002), encore en jeu** : le premier a
   reçu son coup de sifflet plus haut, et une page qui y entre le traite
   comme un coup de sifflet — elle quitterait la salle d'elle-même au
   milieu du contrôle. On vérifie à chaque fois que `virage:leave` part
   **avant** la navigation, et qu'on arrive sur une page qui répond — un
   404 a un corps vide dans ce serveur. */
const MATCH_SORTIE = 8002;
const BILAN = {
  fixtureId: MATCH_SORTIE, side: 0, classe: false, neutre: false,
  ferveur: 431, chants: 14, parfaits: 3, serie: 3,
  meilleur: { chant: 'montee', nom: 'La montée', verdict: 'parfait' },
  rang: 11, sur: 46,
  xp: { verse: false, raison: 'incomplet', manque: 2 },
};

/** Une page entrée dans la tribune, qui relève ce qu'elle émet et peut
    retenir un évènement (il n'atteint pas le serveur). */
async function tribuneEspionnee() {
  const p = await nav.newPage();
  const bruits = [];
  p.on('pageerror', (e) => bruits.push(e.message));
  await p.setViewport({ width: 400, height: 880 });
  await p.goto(base + '/virage', { waitUntil: 'networkidle0' });
  await p.evaluate((id) => socket.emit('virage:join', { fixtureId: id }), MATCH_SORTIE);
  const dedans = await p.waitForSelector('#fil:not([hidden])', { timeout: 8000 })
    .then(() => true).catch(() => false);
  await p.waitForSelector('.tbf-retour', { timeout: 6000 }).catch(() => {});
  await p.evaluate(() => {
    const vrai = socket.emit.bind(socket);
    window.__emis = [];
    window.__retenus = new Set(['virage:bilan']);
    socket.emit = (e, ...a) => { window.__emis.push(e); return window.__retenus.has(e) ? socket : vrai(e, ...a); };
  });
  return { p, bruits, dedans, id: await p.evaluate(() => socket.id) };
}
const emis = (p) => p.evaluate(() => [...(window.__emis ?? [])]);
/** Touche ce qui sort et attend la navigation ; relève ce qui est parti
    avant elle (la page part 180 ms après `virage:leave`). */
async function sortirPar(p, selecteur) {
  const [rep, avant] = await Promise.all([
    p.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => null),
    p.evaluate(async (s) => {
      document.querySelector(s).click();
      await new Promise((r) => setTimeout(r, 60));
      return { emis: [...window.__emis], boite: Boolean(document.querySelector('.tbf-dial, #bilan')) };
    }, selecteur).catch(() => null),
  ]);
  return { rep, avant };
}
async function arrivee(p, rep, bruits, cas) {
  check(`${cas} : on arrive quelque part (${rep?.status() ?? 'sans réponse'})`, rep?.status() === 200
    || (console.log('        code', rep?.status(), 'sur', p.url()), false));
  await wait(700);
  const corps = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim()).catch(() => '');
  check(`${cas} : et la page n’est pas vide (${corps.length} caractères)`, corps.length > 20
    || (console.log('        arrivée blanche sur', p.url()), false));
  check(`${cas} : et rien n’a cassé en chemin`, bruits.length === 0
    || (console.log('        ', bruits.join(' / ')), false));
}

/* --- sans avoir poussé : on sort, sans question ni bilan. */
{
  const { p, bruits, dedans } = await tribuneEspionnee();
  check('on entre dans la tribune pour éprouver la sortie', dedans);
  if (dedans) {
    const { rep, avant } = await sortirPar(p, '.tbf-retour');
    check('sans avoir poussé, la flèche sort sans rien demander',
      (avant && !avant.boite && !avant.emis.includes('virage:bilan'))
      || (console.log('        avant de partir :', JSON.stringify(avant)), false));
    check('et prévient le serveur avant de partir', Boolean(avant?.emis.includes('virage:leave'))
      || (console.log('        émis :', avant?.emis?.join(', ')), false));
    await arrivee(p, rep, bruits, 'sans poussée');
  }
  await p.close();
}

/* --- après avoir poussé, sans bilan servi : la boîte d'avant, trois
   secondes plus tard, et elle dit ce qu'on manque. */
{
  const { p, bruits, dedans } = await tribuneEspionnee();
  if (dedans) {
    // Poussé : le serveur lui connaît une ferveur (la page la lit dans l'état).
    await p.evaluate(() => { S.you.ferveur = 12; });
    await p.evaluate(() => document.querySelector('.tbf-retour').click());
    const t0 = Date.now();
    const demande = await p.waitForSelector('.tbf-dial [data-non]', { timeout: 6000 })
      .then(() => true).catch(() => false);
    const attendu = Date.now() - t0;
    check('après avoir poussé, la page demande son bilan',
      (await emis(p)).includes('virage:bilan'));
    check('sans bilan servi, la boîte d’avant vient au bout de trois secondes',
      (demande && attendu >= 2500)
      || (console.log('        boîte', demande ? `après ${attendu} ms` : 'jamais venue'), false));
    if (demande) {
      const dit = await p.evaluate(() =>
        document.querySelector('.tbf-dial')?.textContent.replace(/\s+/g, ' ').trim() ?? '');
      /* Elle dit ce qu’on manque : une tribune qu'on quitte ne se paie pas,
         elle se rate. */
      check('et elle dit ce qu’on manque en partant', /souvenir|pousse/i.test(dit)
        || (console.log('        elle dit :', dit.slice(0, 100)), false));
      const { rep, avant } = await sortirPar(p, '.tbf-dial [data-oui]');
      check('« SORTIR » prévient le serveur avant de partir', Boolean(avant?.emis.includes('virage:leave')));
      await arrivee(p, rep, bruits, 'boîte d’avant');
    }
  }
  await p.close();
}

/* --- après avoir poussé, avec un bilan servi : la page kraft. Le HUD a
   servi un palier (« 12ᵉ → TOP 10 », CONTRATS § 16.2) : la feuille dit ce
   qui reste à gagner depuis le rang du bilan (11ᵉ : à une place). */
{
  const { p, bruits, dedans, id } = await tribuneEspionnee();
  if (dedans) {
    await p.evaluate(() => { S.you.ferveur = 12; S.you.prochain = { rang: 10, ecart: 30 }; });
    await p.evaluate(() => document.querySelector('.tbf-retour').click());
    await wait(250);
    io.to(id).emit('virage:bilan', BILAN);
    const pose = await p.waitForSelector('#bilan', { timeout: 3000 }).then(() => true).catch(() => false);
    check('après avoir poussé, la flèche pose le bilan de tribune', pose);
    if (pose) {
      /* Les lignes comptent l'une après l'autre (700 ms d'écart) : on lit
         une fois les chiffres posés — et avant cinq secondes, le délai sous
         lequel la page ne redemande pas son bilan (voir plus bas). */
      await wait(2600);
      const vu = await p.evaluate(() => {
        const b = document.getElementById('bilan');
        return {
          titre: b.querySelector('#bilanTitre')?.textContent ?? '',
          // Le libellé, le chiffre, et ce qui est écrit dessous : « RANG DANS
          // TA TRIBUNE|11e|sur 46 ».
          lignes: [...b.querySelectorAll('.tbf-bilan-l')].map((l) => [l.firstElementChild?.textContent,
            l.querySelector('b')?.textContent, l.querySelector('small')?.textContent]
            .filter(Boolean).map((t) => t.trim()).join('|')),
          verdict: b.querySelector('.tbf-bilan-l [data-verdict]')?.dataset.verdict ?? null,
          notes: [...b.querySelectorAll('.tbf-bilan-note')].map((n) => n.textContent.trim()),
          oui: Boolean(b.querySelector('[data-oui]')), non: Boolean(b.querySelector('[data-non]')),
          xp: Boolean(b.querySelector('.tbf-bilan-xp')),
          // Sur le document, hors de la colonne : sinon le tiroir passerait dessus.
          horsColonne: !b.closest('#app'),
          /* Le rang ouvre la feuille, en grand, avec ce qui reste à gagner ;
             les autres chiffres gardent leur taille. */
          premiere: b.querySelector('.tbf-bilan-l')?.firstElementChild?.textContent.trim() ?? '',
          rangPx: parseFloat(getComputedStyle(b.querySelector('.tbf-bilan-l > b')).fontSize),
          autrePx: parseFloat(getComputedStyle(b.querySelector('.tbf-bilan-l:nth-child(2) > b')).fontSize),
          palier: b.querySelector('.tbf-bilan-l .tbf-sticker')?.textContent.trim() ?? '',
          // Les sorties d'en cours de match : RESTER en parpaing, SORTIR en flare.
          nonDit: b.querySelector('[data-non]')?.textContent.trim() ?? '',
          nonTon: b.querySelector('[data-non]')?.dataset.ton ?? null,
          ouiTon: b.querySelector('[data-oui]')?.dataset.ton ?? null,
          // Ni case de BD ni Fanzzy en pose : le match n'est pas fini.
          finVue: [...b.querySelectorAll('.bilan-case, .tbf-bilan-fz')].some((n) => !n.hidden),
        };
      });
      check('c’est une page de bilan, pas une boîte', /BILAN DE TRIBUNE/.test(vu.titre) && vu.horsColonne);
      check('elle dit le rang dans sa tribune, la ferveur et les chants',
        vu.lignes.includes('RANG DANS TA TRIBUNE|11e|sur 46')
        && vu.lignes.includes('FERVEUR|431') && vu.lignes.includes('CHANTS|14')
        || (console.log('        lignes :', vu.lignes.join(' | ')), false));
      check('le rang ouvre la feuille, en grand (32 px et plus, plus que les autres chiffres)',
        (vu.premiere === 'RANG DANS TA TRIBUNE' && vu.rangPx >= 32 && vu.rangPx > vu.autrePx)
        || (console.log('        en tête :', vu.premiere, '·', vu.rangPx, 'px contre', vu.autrePx), false));
      check('et il dit ce qui reste à gagner, depuis le palier du HUD',
        vu.palier === 'À 1 PLACE DU TOP 10' || (console.log('        il dit :', vu.palier || '(rien)'), false));
      check('le meilleur geste en tampon, avec le mot servi', vu.verdict === 'parfait');
      check('et ce qui manque à l’XP, sans ligne d’XP versée',
        !vu.xp && vu.notes.some((n) => /Encore 2 chants pour l’XP du match/.test(n)));
      check('un Virage non classé le dit', vu.notes.some((n) => /ne compte pas au classement/.test(n)));
      check('avec RESTER et SORTIR', vu.oui && vu.non);
      check('en cours de match : RESTER au parpaing, SORTIR en flare, ni case ni Fanzzy',
        (vu.nonDit === 'RESTER' && !vu.nonTon && vu.ouiTon === 'flare' && !vu.finVue)
        || (console.log('        ', JSON.stringify({ non: vu.nonDit, nonTon: vu.nonTon, ouiTon: vu.ouiTon, fin: vu.finVue })), false));

      // RESTER : on reste, rien ne part.
      await p.evaluate(() => document.querySelector('#bilan [data-non]').click());
      await wait(200);
      const reste = await p.evaluate(() => ({ ferme: !document.getElementById('bilan'), emis: [...window.__emis] }));
      check('RESTER referme le bilan, et l’on reste dans la tribune',
        reste.ferme && !reste.emis.includes('virage:leave'));
      // La flèche de nouveau, dans les cinq secondes : le même bilan, sans redemande.
      const avant = (await emis(p)).filter((e) => e === 'virage:bilan').length;
      await p.evaluate(() => document.querySelector('.tbf-retour').click());
      const revient = await p.waitForSelector('#bilan', { timeout: 2000 }).then(() => true).catch(() => false);
      const apres = (await emis(p)).filter((e) => e === 'virage:bilan').length;
      check('la flèche de nouveau rouvre le bilan gardé, sans le redemander', revient && apres === avant);
      if (revient) {
        const { rep, avant: av } = await sortirPar(p, '#bilan [data-oui]');
        check('SORTIR prévient le serveur avant de partir', Boolean(av?.emis.includes('virage:leave')));
        await arrivee(p, rep, bruits, 'bilan');
      }
    }
  }
  await p.close();
}

/* --- au coup de sifflet final : le bilan sans rien toucher, puis la salle
   quittée pour de bon. Le tirage du délai (0 à 8 s) est ramené à zéro.

   **Le rituel de sortie du duel** (partie B) : la case de BD du score final
   et le Fanzzy en pose de victoire, son club ayant gagné au terrain (2 – 1,
   posé ici). Le Fanzzy est pris dans une lignée dont les poses sont
   dessinées (RP1 : la victoire et la défaite n'y ont pas le même dessin) —
   avec un personnage sans poses, une pose de défaite passerait pour une
   victoire. **Et plus de RESTER** : la page a quitté la salle, RESTER y
   ramenait pour rien. UN AUTRE MATCH rend le voile de choix. */
{
  const { p, bruits, dedans, id } = await tribuneEspionnee();
  if (dedans) {
    await p.evaluate(async () => {
      S.you.ferveur = 12; Math.random = () => 0;
      S.scoreReel = [2, 1];
      S.you.fanzzy = { id: 'RP1', age: 'RP1', evo: 1, skin: 'base' };
      await window.TBF_ETATS?.charger?.();
    });
    io.to(id).emit('virage:fin', { statut: 'FT' });
    const demande = await p.waitForFunction(() => window.__emis.includes('virage:bilan'), { timeout: 3000 })
      .then(() => true).catch(() => false);
    check('au coup de sifflet final, la page demande son bilan', demande);
    io.to(id).emit('virage:bilan', { ...BILAN, fini: true, classe: true });
    const pose = await p.waitForSelector('#bilan', { timeout: 3000 }).then(() => true).catch(() => false);
    check('et le pose sans qu’on touche rien', pose);
    await wait(300);
    check('puis quitte la salle', (await emis(p)).includes('virage:leave'));
    // Une reconnexion après le coup de sifflet ne rejoint plus la salle.
    await p.evaluate(() => { socket.disconnect(); socket.connect(); });
    await wait(1500);
    check('et n’y rentre plus, même à la reconnexion', !(await emis(p)).includes('virage:join'));
    check('le coup de sifflet n’a rien cassé', bruits.length === 0
      || (console.log('        ', bruits.join(' / ')), false));
    if (pose) {
      const fin = await p.evaluate(() => {
        const b = document.getElementById('bilan');
        const c = b.querySelector('.bilan-case');
        const fz = b.querySelector('.tbf-bilan-fz');
        const av = S.you.fanzzy;
        return {
          caseVue: Boolean(c && !c.hidden),
          mot: c?.querySelector('.tbf-vignette-mot')?.textContent.trim() ?? '',
          score: c?.querySelector('.tbf-vignette small')?.textContent.trim() ?? '',
          ton: c?.querySelector('.tbf-vignette')?.dataset.ton ?? null,
          fzVu: Boolean(fz && !fz.hidden), fz: fz?.getAttribute('src') ?? '',
          victoire: window.FZART.dessinAvatar(av, 'plein', { etat: 'victoire' }),
          defaite: window.FZART.dessinAvatar(av, 'plein', { etat: 'defaite' }),
          // Les deux bâches, dans l'ordre de l'écran.
          sorties: [...b.querySelectorAll('.tbf-bilan-sortie > button')].map((n) =>
            `${'oui' in n.dataset ? 'oui' : 'non'}:${n.textContent.trim()}:${n.dataset.ton ?? '-'}`),
        };
      });
      check('au coup de sifflet, la case de BD dit le score final, en vert pour une victoire',
        (fin.caseVue && fin.mot === 'VICTOIRE' && fin.ton === 'vert' && /^2 – 1\b/.test(fin.score))
        || (console.log('        ', JSON.stringify({ vue: fin.caseVue, mot: fin.mot, ton: fin.ton, score: fin.score })), false));
      check('et le Fanzzy se pose au-dessus de la feuille, en pose de victoire',
        (fin.fzVu && fin.victoire !== fin.defaite && fin.fz === fin.victoire)
        || (console.log('        ', JSON.stringify({ vu: fin.fzVu, src: fin.fz, victoire: fin.victoire })), false));
      check('plus de RESTER : SORTIR au parpaing, puis UN AUTRE MATCH en flare',
        fin.sorties.join(' | ') === 'oui:SORTIR:- | non:UN AUTRE MATCH:flare'
        || (console.log('        ', fin.sorties.join(' | ')), false));
      /* UN AUTRE MATCH : le voile de choix, relu — l'adresse sans le match
         fini, qui y ramènerait. */
      const { rep } = await sortirPar(p, '#bilan [data-non]');
      const ou = new URL(p.url());
      check('UN AUTRE MATCH rend le voile de choix',
        (ou.pathname === '/virage' && !ou.search
          && await p.evaluate(() => document.getElementById('veil')?.classList.contains('on')).catch(() => false))
        || (console.log('        arrivé sur', p.url()), false));
      await arrivee(p, rep, bruits, 'un autre match');
    }
  }
  await p.close();
}

/* --- revenu après le coup de sifflet : `virage:fin` ne viendra pas (CONTRATS
   § 15.3), c'est l'état qui le dit. La page restait dans une salle finie,
   qu'elle rejoignait encore à chaque reconnexion et que le relevé du direct
   continuait de payer (contre-expertise, D1). Elle fait maintenant comme au
   coup de sifflet. L'état est renvoyé à la seule socket de la page, tel
   qu'elle le tient, le statut passé à FT. */
{
  const { p, bruits, dedans, id } = await tribuneEspionnee();
  if (dedans) {
    const fini = await p.evaluate(() => { Math.random = () => 0; S.you.ferveur = 12;
      return JSON.parse(JSON.stringify({ ...S, statut: 'FT' })); });
    io.to(id).emit('virage:state', fini);
    const demande = await p.waitForFunction(() => window.__emis.includes('virage:bilan'), { timeout: 3000 })
      .then(() => true).catch(() => false);
    check('revenu après le coup de sifflet, la page demande son bilan', demande);
    io.to(id).emit('virage:bilan', { ...BILAN, fini: true, classe: true });
    const pose = await p.waitForSelector('#bilan', { timeout: 3000 }).then(() => true).catch(() => false);
    check('et le pose', pose);
    await wait(300);
    check('puis quitte la salle finie', (await emis(p)).includes('virage:leave'));
    const joints = (await emis(p)).filter((e) => e === 'virage:join').length;
    await p.evaluate(() => { socket.disconnect(); socket.connect(); });
    await wait(1500);
    check('et n’y rentre plus', (await emis(p)).filter((e) => e === 'virage:join').length === joints);
    check('le retour après le coup de sifflet n’a rien cassé', bruits.length === 0
      || (console.log('        ', bruits.join(' / ')), false));
  }
  await p.close();
}

/* --- la flèche touchée, le bilan en route : un chant touché n'ouvre pas de
   geste. Le bilan l'aurait couvert, et le chant serait parti après
   `virage:leave`. La demande de bilan est retenue (pas de réponse) : la
   sortie attend ses trois secondes, on regarde avant. */
{
  const { p, bruits, dedans } = await tribuneEspionnee();
  if (dedans) {
    await p.evaluate(() => { S.you.ferveur = 12; S.you.breath = 100; S.you.regen = 0; });
    await p.evaluate(() => document.querySelector('.tbf-retour').click());
    await wait(200);
    await p.evaluate(() => document.querySelector('#hand [data-card]')
      ?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, isPrimary: true })));
    await wait(400);
    check('pendant la sortie, un chant touché n’ouvre pas de geste',
      !(await p.evaluate(() => document.getElementById('mini').classList.contains('on'))));
    check('et rien n’a cassé', bruits.length === 0 || (console.log('        ', bruits.join(' / ')), false));
  }
  await p.close();
}

/* ------------------------------------- un bandeau d'annonce dans la tribune

   L'administration peut poser un bandeau sur toutes les pages
   (`.tbf-annonce`) ; sur un écran de jeu, `nav.js` le range sous les deux
   rangées du HUD. Il y touchait le ticket terrain par le haut, et à
   320 × 568 l'arène butait sur son plancher de 150 px : la main sortait de
   l'écran, de 41 px sous un bandeau de trois lignes (mesuré au banc). La
   page donne au bandeau son air et lui cède la hauteur de l'arène, qui
   garde ses deux lignes de but écartées et dans l'ordre — à 44 px de
   chaque bout, une arène de 109 px ne laissait que vingt et un pixels
   entre elles. Le cas éprouvé : trois lignes de bandeau, un deck (la
   rangée des actions), le combo, une carte-souvenir et le « i ». */
{
  annonceDuBanc = { texte: 'Maintenance ce soir de 23 h à minuit : les tribunes ferment dix minutes. '
    + 'Les chants poussés avant la coupure restent comptés au bilan.', ton: 'attention' };
  const p = await nav.newPage();
  const bruits = [];
  p.on('pageerror', (e) => bruits.push(e.message));
  await p.setViewport({ width: 320, height: 568 });
  await p.goto(base + '/virage', { waitUntil: 'networkidle0' });
  annonceDuBanc = null;
  await p.evaluate((id) => socket.emit('virage:join', { fixtureId: id }), MATCH_SORTIE);
  const dedans = await p.waitForSelector('#fil:not([hidden])', { timeout: 8000 })
    .then(() => true).catch(() => false);
  const pose = await p.waitForSelector('#app > .tbf-annonce', { timeout: 4000 })
    .then(() => true).catch(() => false);
  check('le bandeau d’annonce paraît dans la tribune', dedans && pose);
  if (dedans && pose) {
    await p.evaluate(() => {
      // Un deck (la rangée des actions), le combo, une carte-souvenir et le « i ».
      S.you.main = (S.actions ?? []).slice(0, 4).map((a) => a.id);
      S.you.mainVisible = 5;
      S.you.ecartees = Math.max(1, S.you.ecartees ?? 0);
      S.you.serie = 3;
      P.souvenirs = [{ id: 901 }];
      render();
    });
    await wait(400);
    const vu = await p.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const b = document.querySelector('#app > .tbf-annonce');
      const a = b.getBoundingClientRect(), ticket = r('#fil .tbf-ticket'), rope = r('#rope');
      const ligne = (t) => { const x = r(`#rope .tbf-corde-but[data-tribune=${t}]`); return x.top + x.height / 2; };
      return {
        apres: b.previousElementSibling?.classList.contains('tbf-hudm-ligne') ?? false,
        air: Math.round(a.top - ticket.bottom),
        dessous: Math.round(rope.top - a.bottom),
        actions: !document.getElementById('actes').hidden,
        tableau: Math.round(r('.tableau').height),
        rope: Math.round(rope.height),
        bas: Math.round(Math.max(r('#hand').bottom,
          ...[...document.querySelectorAll('#hand .card')].map((c) => c.getBoundingClientRect().bottom))),
        ecran: innerHeight,
        ecartLignes: Math.round(ligne('moi') - ligne('eux')),
        foulard: document.getElementById('knot').offsetHeight,
        combo: { vu: !document.getElementById('combo').hidden, dit: document.getElementById('combo').textContent,
          ton: document.getElementById('combo').dataset.ton ?? null },
      };
    });
    const dit = () => (console.log('        ', JSON.stringify(vu)), false);
    /* Le combo est une récompense : le vert du PARFAIT (l'échelle unique du
       verdict, QUESTIONS Q3), jamais le rouge du RATÉ et des « −9 » de ce
       qui manque, posés juste en dessous. */
    check('le combo dit ses PARFAITS en vert, la couleur du PARFAIT',
      (vu.combo.vu && vu.combo.dit === '3 PARFAITS' && vu.combo.ton === 'vert') || dit());
    check('il se pose sous les deux rangées du HUD, avec de l’air au-dessus et dessous',
      (vu.apres && vu.air >= 4 && vu.dessous >= 4) || dit());
    /* Le cas n'est éprouvé que s'il est posé : sans la rangée des actions,
       ou avec un bandeau plus court, l'arène reste au-dessus de son
       plancher ordinaire, et le contrôle passerait sans rien mesurer. */
    check('à 320 × 568, avec un deck, l’arène passe sous son plancher et la main reste entière',
      (vu.actions && vu.rope < 150 && vu.bas <= vu.ecran) || dit());
    /* Plus d'un foulard entre les deux lignes : plus près, il les couvre
       toutes les deux, et l'on ne voit plus de quel côté penche la corde. */
    check('et l’arène qui cède garde ses deux lignes de but écartées, dans l’ordre',
      (vu.foulard > 0 && vu.ecartLignes > vu.foulard) || dit());
    check('le bandeau n’a rien cassé', bruits.length === 0
      || (console.log('        ', bruits.join(' / ')), false));
  }
  await p.close();
}

/* --------------------------------------------- aucun seuil dans la page

   Le mot du geste est servi (`verdict`, CONTRATS § 16.1) : la page ne
   compare plus la note à un nombre, ni pour le mot, ni pour une vibration,
   ni pour le Cri. Une comparaison remise à la main rougit ici. */
{
  const src = readFileSync(path.join(RACINE, 'public', 'virage.html'), 'utf8');
  const seuils = [...src.matchAll(/\bquality\s*[<>]=?\s*[\d.]+/g)].map((m) => m[0]);
  check('la page n’écrit aucun seuil de note', seuils.length === 0
    || (console.log('        trouvé :', seuils.join(' · ')), false));
}
check('aucune erreur de script sur le virage',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close(); virage.stop(); io.close(); await pool.end();
process.exit(failures ? 1 : 0);
