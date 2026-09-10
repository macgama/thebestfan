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
await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops,
  user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
  souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
  duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
  leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql', 'tenues.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'cccccccc-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash)
                 VALUES (?,?,?,'x')`, [U, 'virage-ui@ex.fr', 'Momo']);
await raw.query(`INSERT INTO user_wallet (user_id, scarves, active_fanzzy)
                 VALUES (?, 100, 'V1')`, [U]);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'FC Sion'),(91,'FC Bâle')`);
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

check('aucune erreur de script sur le virage',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close(); virage.stop(); io.close(); await pool.end();
process.exit(failures ? 1 : 0);
