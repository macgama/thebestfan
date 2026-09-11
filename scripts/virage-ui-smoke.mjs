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
import { baseDeTest } from './base-de-test.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops,
  user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
  souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
  duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
  leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
/* `stades.sql` en plus : le virage montre le Fanzzy **à l'âge atteint**, et
   cet âge est la colonne `stage` de `user_fanzzy`. Sans elle, la requête lève
   au moment d'entrer dans la tribune — c'est la panne la plus chère du projet,
   celle d'un code en ligne qui attend de la base quelque chose qu'elle n'a
   pas. Le garde-fou du démarrage la réclame déjà ; la suite doit monter le
   même schéma que le serveur, sinon elle éprouve un jeu qui n'existe pas. */
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'fanzzy.sql',
                 'tenues.sql', 'stades.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'cccccccc-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'virage-ui@ex.fr', 'Momo']);
await raw.query(`INSERT INTO user_wallet (user_id, scarves, active_fanzzy)
                 VALUES (?, 100, 'V1')`, [U]);
/* Le Fanzzy équipé est **monté au second âge**, et c'est délibéré : la tribune
   doit montrer le Meneur de chant, pas le Choriste. Au premier âge, une page
   qui ignorerait complètement le stade passerait tous les contrôles. */
await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage)
                 VALUES (?, 'V1', 1, 2)`, [U]);
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
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,
                                       home_goals,away_goals,elapsed,kickoff_at)
                 VALUES (8001,207,2026,85,91,'2H',2,1,71,UTC_TIMESTAMP())`);
await raw.query(`INSERT INTO fixture_events
                   (fixture_id,seq,type,detail,team_id,player,assist,minute)
                 VALUES (8001,0,'Card','Yellow Card',91,'Zambrano',NULL,12),
                        (8001,1,'Goal','Normal Goal',85,'Diallo','Morel',23),
                        (8001,2,'subst','Substitution 1',91,'Roth','Keller',30),
                        (8001,3,'Card','Red Card',91,'Keller',NULL,66)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
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
if (!entre) {
  console.log('  arrêt : le joueur n’est pas entré dans le virage');
  await nav.close(); http.close(); virage.stop(); io.close(); await pool.end();
  process.exit(1);
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
  check('et la dernière chose arrivée sur le terrain',
    /66'.*Keller/.test(b.dernier) || (console.log('        elle dit :', b.dernier), false));
  check('le score de la tribune reste distinct, en haut',
    (await page.$eval('#score', (n) => n.textContent.trim())) === '0 – 0');

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
 * et refermable tant qu'il est ouvert. */
{
  virage.realGoal({ fixtureId: 8001, teamId: 85, minute: 73, player: 'Bonvin', score: [3, 1] });
  await wait(700);

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
    p.fanzzy?.id === 'V1');
  check('à l’âge atteint',
    p.fanzzy?.evo === 2 && /Meneur/.test(p.fanzzy?.nom ?? '')
    || (console.log('        il envoie :', JSON.stringify(p.fanzzy)), false));
  /* Le cri manquait entièrement : la page appelait `S.you.cri`, cette clé
     n'était jamais envoyée, et la vidéo du Cri ne s'est donc jamais jouée
     depuis le virage. Une faute muette — rien ne se casse quand une
     récompense n'arrive pas. */
  check('et son cri, qui déclenche la vidéo d’un geste parfait',
    Boolean(p.fanzzy?.cri));
  check('le dessin montré est celui du second âge',
    /V2/.test(p.src) || (console.log('        il montre :', p.src), false));
  check('il respire', p.souffle !== 'none' && p.souffle !== '');
  check('il n’intercepte pas les appuis de la tribune',
    p.sous !== 'le personnage' || (console.log('        sous le doigt :', p.sous), false));
  check('il tient dans la corde, au-dessus de la main', p.dedans);
}

/* ------------------------------------------------- ce qui le fait réagir */

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
  /* Un vrai but de son club. Le buteur et la minute viennent de l'événement
     lui-même — aucun appel de plus à l'API pour les afficher. */
  virage.realGoal({ fixtureId: 8001, teamId: 85, minute: 78, player: 'Sarr', score: [4, 1] });
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

  /* ------------------------------------------- aux couleurs du club

   * L'API ne donne pas les couleurs des équipes, elle donne un écusson. On les
   * en extrait une fois, on n'en garde que deux chaînes de sept caractères, et
   * « GOAL ! » s'écrit dans la couleur du club qui vient de marquer.
   *
   * Le piège est là et pas ailleurs : ces couleurs sont faites pour du papier
   * blanc. Le bleu marine du blason, écrit sur le noir de l'écran, est un texte
   * invisible — un but célébré que personne ne voit. `FX.lisible` l'éclaircit
   * en gardant sa teinte, et c'est ce que ce contrôle mesure.
   */
  {
    const teinte = await page.evaluate(() => {
      const mc = document.querySelector('.tbf-moment').style.getPropertyValue('--mc').trim();
      const m = /^#([0-9a-f]{6})$/i.exec(mc);
      if (!m) return { mc, clarte: null, bleuDominant: null };
      const n = parseInt(m[1], 16);
      const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return {
        mc,
        clarte: (Math.max(r, g, b) + Math.min(r, g, b)) / 510,
        // La teinte est conservée : c'est encore le bleu du club, pas un
        // blanc passe-partout. Un éclaircissement qui perd la teinte ne
        // servirait à rien — autant garder l'or du jeu.
        bleuDominant: b > r + 20 && b > g + 20,
      };
    });
    check('le but s’écrit dans la couleur du club',
      /^#[0-9A-F]{6}$/i.test(teinte.mc)
      || (console.log('        il s’écrit en', teinte.mc), false));
    check('éclaircie assez pour se lire sur le noir',
      (teinte.clarte ?? 0) > 0.5
      || (console.log(`        clarté ${teinte.clarte?.toFixed(2)}`), false));
    check('sans cesser d’être la couleur du club', teinte.bleuDominant === true);

    /* Et la garde en face : un club dont le blason n'a pas encore été lu n'a
       pas de couleur du tout. Il ne doit pas écrire en « undefined », il doit
       garder l'or du jeu. */
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

check('aucune erreur de script sur le virage',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close(); virage.stop(); io.close(); await pool.end();
process.exit(failures ? 1 : 0);
