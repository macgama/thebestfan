/**
 * Test de la page /equipes : les emplacements de suivi.
 *
 * C'est la page par laquelle la faute est passée. La règle — deux clubs au
 * départ, davantage en montant de niveau ou en payant — était défendue dans
 * un module que cette page n'appelle pas : elle suit par
 * `POST /api/football/follows`, qui écrivait sans rien vérifier. On pouvait
 * donc suivre quatre clubs avec deux emplacements, sans rien forcer, et la
 * barre du haut affichait un « 4/2 » que personne n'avait prévu.
 *
 * `football-smoke` éprouve désormais le refus côté serveur. Ce qui se joue
 * **ici** est l'autre moitié du même défaut, et c'est la troisième fois qu'on
 * la rencontre dans ce jeu — après le kiosque et le deck :
 *
 *   **une page qui ignore le plafond et laisse le serveur refuser après coup.**
 *
 * Le joueur cherche un club, le choisit, et découvre le refus. Ici, il doit le
 * savoir avant de choisir — et lire ce qu'il faut faire pour en sortir.
 *
 * Avant de lancer :  npm install --no-save puppeteer
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import puppeteer from 'puppeteer';
import { createFootball } from '../src/server/football/routes.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const dodo = (ms) => new Promise((r) => setTimeout(r, ms));
async function jusqua(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await dodo(70); }
  return false;
}

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS achats, kop_invites, amities, kop_bulletins, kop_votes,
  kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql',
                 'fanzzy.sql', 'inventaire.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = 'eeee0000-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'clubs@ex.fr', 'Michel']);
// Deux emplacements, ceux d'un nouveau venu : c'est le cas qui a produit la
// faute, et celui où la page doit savoir dire non.
await raw.query(`INSERT INTO user_wallet (user_id,follow_slots) VALUES (?,2)`, [U]);
await raw.query(`INSERT INTO teams (id,name,country) VALUES
  (85,'Lausanne','Suisse'),(91,'Bâle','Suisse'),(99,'Lugano','Suisse'),(77,'Servette','Suisse')`);
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1),(?,91,0)`,
  [U, U]);
await raw.end();

/* ----------------------------------------------------------- le serveur */

/* `timezone: 'Z'`, comme le pool de l'application (voir src/server/auth/db.js).

   Sans lui, le pilote lit une DATETIME comme une heure **locale** : une date
   écrite par `UTC_TIMESTAMP()` revient alors décalée du fuseau de la machine
   — deux heures en Suisse l'été. L'horloge du match, qui compte depuis
   l'instant du relevé, se croyait muette parce qu'elle voyait une donnée
   vieille de deux heures. Le défaut n'existait **que dans cette suite**, et
   il a coûté une demi-heure à chercher dans la page. Une suite qui ne monte
   pas la configuration de l'application n'éprouve pas l'application. */
const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE,
  timezone: 'Z' });
const requireAuth = (r, _s, n) => { r.user = { id: U }; n(); };
/* Un client d'API muet : la recherche lit la base d'abord, et tous les clubs
   de cette suite y sont. Aucun appel réseau n'est donc nécessaire — ni
   souhaitable, une suite qui sort de la machine n'est plus reproductible. */
const client = {
  get: async () => ({ response: [] }),
  quota: () => ({}),
  // Le premier suivi d'un club déclenche le chargement de son calendrier, en
  // arrière-plan. On rend du vide plutôt que de laisser le talon manquer une
  // méthode : une erreur de fond qui s'écrit dans la sortie d'un test finit
  // par s'y confondre avec les vraies.
  teamById: async () => [],
  leaguesOfTeam: async () => [],
  fixturesOfTeam: async () => [],
};
const foot = createFootball({ pool, client, io: null, requireAuth });

const app = express();
app.use('/api/football', foot.router);
app.get('/api/auth/me', (_q, s) => s.json({ user: { pseudo: 'Michel' } }));
/* L'état du joueur, tel que `onboarding` le sert : c'est là que la page lit le
   nombre d'emplacements. La vraie route est éprouvée par onboarding-smoke. */
app.get('/api/me/state', async (_q, s) => {
  const [[w]] = await pool.query(`SELECT follow_slots FROM user_wallet WHERE user_id = ?`, [U]);
  const [[n]] = await pool.query(`SELECT COUNT(*) c FROM user_follows WHERE user_id = ?`, [U]);
  s.json({ slots: { used: n.c, total: w.follow_slots, max: 8 } });
});
app.get('/equipes', (_q, s) => s.sendFile(path.join(RACINE, 'public', 'equipes.html')));
app.use(express.static(path.join(RACINE, 'public')));

const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const nav = await puppeteer.launch({ args: ['--no-sandbox'] });
const erreurs = [];
const page = await nav.newPage();
page.on('pageerror', (e) => erreurs.push(e.message));
await page.setViewport({ width: 400, height: 900 });
await page.goto(base + '/equipes', { waitUntil: 'networkidle0' });
await jusqua(async () => await page.$('.team') !== null);

check('la page se charge sans erreur de script', erreurs.length === 0);
if (erreurs.length) console.log('   ', erreurs.slice(0, 3));

/** Cherche un club et rend l'état des résultats proposés. */
async function chercher(terme) {
  await page.evaluate((t) => {
    const q = document.getElementById('q');
    q.value = t;
    q.dispatchEvent(new Event('input'));
  }, terme);
  await jusqua(async () => await page.evaluate(() =>
    document.getElementById('results').classList.contains('on')
    && document.querySelectorAll('#results button').length > 0));
  return page.evaluate(() => ({
    boutons: [...document.querySelectorAll('#results button[data-follow]')]
      .map((b) => ({ nom: b.textContent.trim(), bloque: b.disabled })),
    mot: document.getElementById('mot').classList.contains('on')
      ? document.getElementById('mot').textContent.trim() : '',
  }));
}

/* ----------------------------------------- le plafond, dit avant le clic */

{
  const r = await chercher('Lugano');
  check('la recherche montre bien le club cherché',
    r.boutons.some((b) => /Lugano/.test(b.nom)));
  /* Le cœur de l'affaire : deux clubs suivis sur deux emplacements, on ne
     peut plus en ajouter — et ça se voit **avant** de choisir. */
  check('avec deux clubs sur deux, on ne peut plus en ajouter',
    r.boutons.every((b) => b.bloque)
    || (console.log('        proposés :', JSON.stringify(r.boutons)), false));
  check('et la page dit pourquoi, avec le compte',
    /2 clubs sur 2/.test(r.mot)
    || (console.log('        elle dit :', r.mot || '(rien)'), false));
  /* Elle dit aussi **comment s'en sortir** : retirer un club, ou acheter un
     emplacement. Un refus sans issue est un cul-de-sac. */
  check('et comment en sortir',
    /[Rr]etire/.test(r.mot) && /emplacement/.test(r.mot));
}

/* ------------------------------------- une place se libère, la porte s'ouvre */

{
  await page.evaluate(() => document.querySelector('[data-unfollow]').click());
  await jusqua(async () => await page.evaluate(() =>
    document.querySelectorAll('.team').length === 1));

  const r = await chercher('Lugano');
  check('une place libérée, le club redevient ajoutable',
    r.boutons.some((b) => /Lugano/.test(b.nom) && !b.bloque)
    || (console.log('        proposés :', JSON.stringify(r.boutons)), false));

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#results button[data-follow]')]
      .find((x) => /Lugano/.test(x.textContent));
    b.click();
  });
  await jusqua(async () => await page.evaluate(() =>
    [...document.querySelectorAll('.club b')].some((n) => /Lugano/.test(n.textContent))));
  const [suivis] = await pool.query(
    `SELECT team_id FROM user_follows WHERE user_id = ?`, [U]);
  check('et il est vraiment suivi',
    suivis.some((s) => s.team_id === 99) && suivis.length === 2);
}

/* ------------------------- le refus du serveur, s'il arrive quand même

   La page peut montrer un état périmé — un autre onglet, une minute
   d'écart. Le serveur tranche alors, et son refus doit être **lu**, pas
   avalé : un clic qui ne produit rien se lit comme une panne et fait
   recommencer. On force le cas en abaissant le plafond dans son dos. */
{
  /* On fabrique l'écart : la page recharge avec trois emplacements — elle se
     croit donc de la place — et la base retombe à deux juste après. Sans cette
     mise en scène, la page bloquerait d'elle-même et le contrôle passerait au
     vert **sans jamais atteindre le serveur** : c'est exactement ce qui s'est
     produit au premier essai, et c'est la définition d'un test creux. */
  await pool.query(`UPDATE user_wallet SET follow_slots = 3 WHERE user_id = ?`, [U]);
  await page.evaluate(() => load());
  await jusqua(async () => await page.evaluate(() => slots === 3));
  await pool.query(`UPDATE user_wallet SET follow_slots = 2 WHERE user_id = ?`, [U]);

  await page.evaluate(() => {
    const q = document.getElementById('q');
    q.value = 'Servette';
    q.dispatchEvent(new Event('input'));
  });
  await jusqua(async () => await page.evaluate(() =>
    [...document.querySelectorAll('#results button[data-follow]')]
      .some((b) => /Servette/.test(b.textContent))));
  /* On efface le mot précédent **avant** de cliquer. Sans ça, le contrôle
     verrait le message du bloc d'avant — qui tient quatre secondes et demie —
     et passerait au vert sans qu'aucun refus n'ait été affiché. Un contrôle
     qui mesure un reste ne mesure rien. */
  const bloque = await page.evaluate(() => {
    const m = document.getElementById('mot');
    m.classList.remove('on'); m.textContent = '';
    const b = [...document.querySelectorAll('#results button[data-follow]')]
      .find((x) => /Servette/.test(x.textContent));
    const fige = b.disabled;
    b.click();
    return fige;
  });
  // La page croyait avoir de la place : c'est bien le serveur qu'on éprouve.
  check('la page laissait cliquer, c’est donc le serveur qui refuse',
    bloque === false);
  await jusqua(async () => await page.evaluate(() =>
    document.getElementById('mot').classList.contains('on')));
  const mot = await page.evaluate(() => document.getElementById('mot').textContent.trim());
  check('un refus venu du serveur s’affiche quand même',
    /clubs sur/.test(mot) || (console.log('        elle dit :', mot || '(rien)'), false));
  check('et jamais sous forme de code',
    !/onboarding\.error|football\.error/.test(mot));
  const [apres] = await pool.query(
    `SELECT COUNT(*) n FROM user_follows WHERE user_id = ?`, [U]);
  check('et rien n’a été suivi', apres[0].n === 2);
}


/* ------------------------------------------- la minute d'un match en cours

 * Elle sortait de la base telle quelle : celle du dernier passage du relevé,
 * figée entre deux. Un joueur qui regardait cette page voyait « 19′ » pendant
 * une minute et demie, puis « 21′ » d'un coup — et croyait la page morte.
 *
 * Elle court maintenant depuis l'instant du relevé, comme sur la page des
 * matchs et dans le Grand Virage. Le match posé ici a été **vu il y a deux
 * minutes** à la dix-neuvième : la page doit afficher vingt et une.
 */
{
  await pool.query(`INSERT INTO leagues (id,name) VALUES (77,'Super League')
                    ON DUPLICATE KEY UPDATE name=VALUES(name)`);
  await pool.query(
  /* `polled_at` se sème avec NOW(3), comme le relevé du direct l'écrit — et
     non avec UTC_TIMESTAMP, qui est la convention de `kickoff_at`. Les deux
     colonnes de la même table ne suivent pas le même fuseau, et une suite qui
     sème autrement que la production éprouve une application qui n'existe pas.
     Celle-ci le faisait : elle était verte sur une donnée que le serveur
     n'écrit jamais. */
  `INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,
                           home_goals,away_goals,elapsed,elapsed_extra,polled_at,kickoff_at)
     VALUES (9100,77,2026,85,99,'2H',1,0,19,NULL,
             NOW(3) - INTERVAL 2 MINUTE, UTC_TIMESTAMP() - INTERVAL 25 MINUTE)`);

  const p = await nav.newPage();
  p.on('pageerror', (e) => erreurs.push(e.message));
  await p.setViewport({ width: 400, height: 900 });
  await p.goto(base + '/equipes', { waitUntil: 'networkidle0' });
  await jusqua(async () => await p.$('.team .live') !== null);
  const min = await p.evaluate(() =>
    document.querySelector('.team .live')?.textContent.trim() ?? '');
  check('la minute d’un match en cours court depuis le relevé',
    min === '21′' || (console.log('        elle dit :', min || '(rien)'), false));

  /* Au-delà du terme, le temps additionnel — que la base ne connaissait pas
     avant `minutes.sql`, et que cette page ne demandait pas. */
  await pool.query(
    `UPDATE fixtures SET elapsed = 90, elapsed_extra = 3,
            polled_at = NOW(3) WHERE id = 9100`);
  await p.evaluate(() => load());
  await jusqua(async () => /90\+3/.test(await p.evaluate(() =>
    document.querySelector('.team .live')?.textContent ?? '')));
  check('et elle sait dire le temps additionnel',
    /90\+3/.test(await p.evaluate(() =>
      document.querySelector('.team .live')?.textContent ?? '')));

  /* Le silence. Un match dont le relevé n'a rien dit depuis un quart d'heure
     n'est pas un match à la centième minute : la page cesse d'annoncer une
     minute plutôt que d'en inventer une. */
  await pool.query(
    `UPDATE fixtures SET elapsed = 60, elapsed_extra = NULL,
            polled_at = NOW(3) - INTERVAL 30 MINUTE WHERE id = 9100`);
  await p.evaluate(() => load());
  await dodo(300);
  check('après un long silence, elle se tait plutôt que d’inventer',
    !(await p.evaluate(() => Boolean(document.querySelector('.team .live')))));

  await p.close();
  await pool.query(`DELETE FROM fixtures WHERE id = 9100`);
}

/* La page se relit toute seule, et le direct la réveille : deux chemins, et
   c'est voulu. Le socket porte le but à la seconde ; la minuterie couvre le
   cas où il n'est pas joignable — un réseau d'entreprise, un proxy. */
{
  const p = await nav.newPage();
  await p.goto(base + '/equipes', { waitUntil: 'networkidle0' });
  const relit = await p.evaluate(() => typeof load === 'function');
  check('la page sait se relire', relit);
  await p.close();
}

check('aucune erreur de script sur la page des clubs',
  erreurs.length === 0 || (console.log('    ', erreurs.join(' / ')), false));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await nav.close(); http.close(); foot.stop?.(); await pool.end();
process.exit(failures ? 1 : 0);
