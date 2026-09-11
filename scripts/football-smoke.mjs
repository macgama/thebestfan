/**
 * Test de bout en bout du suivi des équipes.
 * Monte une fausse API-Football qui respecte la forme réelle des réponses,
 * une vraie base MariaDB, et déroule : recherche, abonnement, calendrier,
 * passage en direct, but marqué, diffusion, classement, quota.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createClient } from '../src/server/football/client.js';
import { createFootball } from '../src/server/football/routes.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}`);
  if (!cond) failures++;
};

/* ------------------------------------------------------ fausse API */

const TEAM = { id: 85, name: 'Paris Sportif', code: 'PSP', country: 'France', logo: 'l.png', founded: 1970, national: false };
const OPPO = { id: 91, name: 'Union Portelle', code: 'UPO', country: 'France', logo: 'o.png', national: false };
let apiCalls = 0;
const state = {
  status: 'NS', elapsed: null, home: 0, away: 0,
  events: [],
  kickoff: new Date(Date.now() + 5 * 60_000).toISOString(),
};

const fakeApi = express();
fakeApi.use((req, _res, next) => { apiCalls++; next(); });
fakeApi.get('/teams', (req, res) => {
  const list = [TEAM, OPPO].filter((t) =>
    (req.query.id && Number(req.query.id) === t.id) ||
    (req.query.search && t.name.toLowerCase().includes(String(req.query.search).toLowerCase())));
  res.set('x-ratelimit-requests-remaining', '7000');
  res.json({ response: list.map((team) => ({ team, venue: {} })), errors: [] });
});
fakeApi.get('/leagues', (_req, res) => res.json({
  errors: [],
  response: [{
    league: { id: 61, name: 'Ligue 1', type: 'League', logo: 'l1.png' },
    country: { name: 'France' },
    seasons: [{ year: 2025, current: false }, { year: 2026, current: true }],
  }],
}));
const fixturePayload = () => ({
  fixture: {
    id: 5001, date: state.kickoff, venue: { name: 'Stade du Nord' },
    status: { short: state.status, elapsed: state.elapsed },
  },
  league: { id: 61, name: 'Ligue 1', season: 2026, round: 'Journée 5', logo: 'l1.png' },
  teams: { home: TEAM, away: OPPO },
  goals: { home: state.home, away: state.away },
});
fakeApi.get('/fixtures', (_req, res) => res.json({ errors: [], response: [fixturePayload()] }));
fakeApi.get('/fixtures/events', (_req, res) => res.json({ errors: [], response: state.events }));
fakeApi.get('/standings', (_req, res) => res.json({
  errors: [],
  response: [{
    league: {
      id: 61, season: 2026,
      standings: [[
        { rank: 1, team: TEAM, points: 12, all: { played: 5, win: 4, draw: 0, lose: 1, goals: { for: 11, against: 4 } }, form: 'WWWLW', group: 'Ligue 1' },
        { rank: 2, team: OPPO, points: 9, all: { played: 5, win: 3, draw: 0, lose: 2, goals: { for: 7, against: 6 } }, form: 'WLWLW', group: 'Ligue 1' },
      ]],
    },
  }],
}));
const apiServer = createServer(fakeApi);
await new Promise((r) => apiServer.listen(0, r));
const apiUrl = `http://localhost:${apiServer.address().port}`;

/* ------------------------------------------------------------- base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
// Les tables des souvenirs référencent users : on les enlève d'abord.
await raw.query(`DROP TABLE IF EXISTS kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
await raw.query(readFileSync(new URL('../sql/auth.sql', import.meta.url), 'utf8'));
await raw.query(readFileSync(new URL('../sql/football.sql', import.meta.url), 'utf8'));
// `minutes.sql` ajoute `elapsed_extra` à `fixtures` : le relevé l'écrit, donc
// sans lui la suite échoue sur un `Unknown column` dès le premier match.
await raw.query(readFileSync(new URL('../sql/minutes.sql', import.meta.url), 'utf8'));
/* `souvenirs.sql` porte `user_wallet`, et suivre un club en a besoin depuis
   que la règle des emplacements est appliquée **des deux côtés** : la route
   football écrivait sans rien vérifier, et on pouvait suivre quatre clubs avec
   deux emplacements. Une suite qui ne monte pas la table que le code lit
   n'éprouve pas le jeu tel qu'il tourne. */
await raw.query(readFileSync(new URL('../sql/couleurs.sql', import.meta.url), 'utf8'));
await raw.query(readFileSync(new URL('../sql/souvenirs.sql', import.meta.url), 'utf8'));
// `inventaire.sql` ajoute la colonne `follow_slots` : c'est elle, le plafond.
await raw.query(readFileSync(new URL('../sql/fanzzy.sql', import.meta.url), 'utf8'));
await raw.query(readFileSync(new URL('../sql/inventaire.sql', import.meta.url), 'utf8'));
const USER = '11111111-2222-3333-4444-555555555555';
await raw.query(
  `INSERT INTO users (public_id, email, pseudo, password_hash, locale)
   VALUES (?, 'fan@exemple.fr', 'KopDuLac', 'scrypt$x', 'fr')`, [USER]);
// Trois emplacements : de quoi suivre les clubs de cette suite, et un de
// libre. Un compte sans portefeuille tomberait au minimum de deux.
await raw.query(`INSERT INTO user_wallet (user_id, follow_slots) VALUES (?, 3)`, [USER]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, charset: 'utf8mb4' });

/* ----------------------------------------------------------- module */

const emitted = [];
const rooms = new Map();
const io = {
  to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
  on: (_e, handler) => { io._conn = handler; },
};
const goals = [];
const client = createClient({ apiKey: 'clef-de-test', baseUrl: apiUrl, minIntervalMs: 0 });

/* Ce que le fil du Grand Virage reçoit du relevé, et ce qu'il lui demande.
   `auFil` est la liste des matchs dont une salle est occupée : c'est elle qui
   décide si le relevé paie un appel d'événements en dehors d'un but. */
const statuts = [];
const evenements = [];
const finis = [];
let auFil = [];

const foot = createFootball({
  pool, client, io,
  requireAuth: (req, _res, next) => { req.user = { id: USER }; next(); },
  onGoal: async (g) => {
    const followers = await foot.store.followersOfTeam(g.teamId);
    goals.push({ ...g, followers });
  },
  onFinished: (f) => { finis.push(f.id); },
  onStatus: (id, etat) => { statuts.push({ id, ...etat }); },
  onEvents: (id, evs) => { evenements.push({ id, evs }); },
  fixturesAuFil: () => auFil,
});

const app = express();
app.use('/api/football', foot.router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;

const call = async (path, opts = {}) => {
  const res = await fetch(base + path, {
    method: opts.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

/* --------------------------------------------------------- recherche */

let r = await call('/api/football/search?q=pa');
check('recherche trop courte refusée', r.status === 400);

r = await call('/api/football/search?q=Portelle');
check('club inconnu de la base : recherche via l\u2019API', r.json.teams?.some((t) => t.id === 91));

const callsAfterFirstSearch = apiCalls;
await call('/api/football/search?q=Portelle');
check('même recherche servie par la base, sans appel API', apiCalls === callsAfterFirstSearch);
r = await call('/api/football/search?q=Paris');
check('recherche suivante trouve un autre club', r.json.teams?.some((t) => t.id === 85));

/* ------------------------------------------------------- abonnement */

// Le club a déjà été enregistré par la recherche : son calendrier doit quand
// même être chargé au premier abonnement.
await foot.store.upsertTeam(TEAM);
check('club connu de nom mais pas chargé', await foot.store.needsBootstrap(85) === true);

r = await call('/api/football/follows', { method: 'POST', body: { teamId: 85, isMain: true } });
check('abonnement enregistré', r.json.teams?.[0]?.id === 85);
check('club principal marqué', r.json.teams?.[0]?.is_main === 1);
check('chargement du calendrier déclenché', r.json.loading === true);

await new Promise((r) => setTimeout(r, 400));
check('club chargé après le premier suivi', await foot.store.needsBootstrap(85) === false);
const [teamRows] = await pool.query('SELECT * FROM teams WHERE id = 85');
check('équipe enregistrée en base', teamRows[0]?.name === 'Paris Sportif');
const [leagueRows] = await pool.query('SELECT * FROM leagues WHERE id = 61');
check('compétition enregistrée', leagueRows[0]?.name === 'Ligue 1');
const [tl] = await pool.query('SELECT * FROM team_leagues WHERE team_id = 85');
check('saison en cours retenue (2026 et non 2025)', tl[0]?.season === 2026);
const [fx] = await pool.query('SELECT * FROM fixtures WHERE id = 5001');
check('match enregistré', fx[0]?.home_id === 85 && fx[0]?.status_short === 'NS');
check('adversaire enregistré au passage', (await pool.query('SELECT 1 FROM teams WHERE id = 91'))[0].length === 1);
/* ------------------------------------- les emplacements, par cette porte

 * **La faute la plus bête du projet, et la plus visible.** La règle des
 * emplacements de suivi était défendue dans `onboarding.follow`, avec un
 * commentaire qui le disait fièrement — et cette route-ci, celle qu'emploie la
 * page « Mes clubs », écrivait directement en base sans rien vérifier.
 *
 * Résultat : on suivait autant de clubs qu'on voulait. Pas en trafiquant le
 * client, pas en forçant quoi que ce soit — en se servant du jeu normalement.
 * Un joueur s'est retrouvé avec « 4/2 clubs » affiché dans sa propre barre.
 *
 * Le contrôle est donc ici, sur **cette** route, et pas seulement sur celle
 * qui était déjà gardée. C'est la porte qui n'avait pas de serrure.
 */
{
  // Le compte a trois emplacements et suit déjà le 85. Deux de plus, et c'est
  // plein ; le troisième doit être refusé.
  await call('/api/football/follows', { method: 'POST', body: { teamId: 91 } });
  await foot.store.upsertTeam({ id: 77, name: 'Club de Trop' });
  await foot.store.upsertTeam({ id: 78, name: 'Club de Bien Trop' });
  const troisieme = await call('/api/football/follows', { method: 'POST', body: { teamId: 77 } });
  check('on remplit ses trois emplacements', troisieme.status === 200);

  const refus = await call('/api/football/follows', { method: 'POST', body: { teamId: 78 } });
  check('le club de trop est refusé par cette route aussi',
    refus.json?.error === 'onboarding.error.no_slot'
    || (console.log('        elle répond :', refus.status, JSON.stringify(refus.json)), false));
  /* Le refus porte le compte et le plafond : la page doit pouvoir écrire
     « 3 clubs sur 3 », et non « impossible ». */
  check('et le refus dit combien sur combien',
    refus.json?.suivis === 3 && refus.json?.slots === 3);
  const [apres] = await pool.query('SELECT COUNT(*) n FROM user_follows WHERE user_id = ?', [USER]);
  check('rien n’a été écrit en base', apres[0].n === 3);

  /* Re-suivre un club déjà suivi ne consomme pas d'emplacement : c'est ce qui
     permet de le passer en club principal sans en libérer un d'abord. */
  const encore = await call('/api/football/follows',
    { method: 'POST', body: { teamId: 91, isMain: true } });
  check('repasser un club déjà suivi en principal reste possible',
    encore.status === 200
    && encore.json.teams?.find((t) => t.id === 91)?.is_main === 1);

  // On libère ce qu'on vient de prendre : la suite continue avec 85 seul.
  await call('/api/football/follows/77', { method: 'DELETE' });
  await call('/api/football/follows/91', { method: 'DELETE' });
  await pool.query('UPDATE user_follows SET is_main = 1 WHERE user_id = ? AND team_id = 85', [USER]);
}


r = await call('/api/football/feed');
check('le fil montre le prochain match', r.json.feed?.[0]?.next?.[0]?.id === 5001);
check('aucun match joué pour l\u2019instant', r.json.feed?.[0]?.last?.length === 0);

/* ------------------------------------------------------------ direct */

// Le match démarre, et un carton tombe tout de suite. Le carton sert au fil
// du Grand Virage : c'est l'événement qui n'accompagne aucun but, donc celui
// qui n'arrivait jamais avant.
state.status = '1H'; state.elapsed = 3;
state.kickoff = new Date(Date.now() - 3 * 60_000).toISOString();
state.events = [{
  time: { elapsed: 3, extra: null }, team: OPPO,
  player: { name: 'Keller' }, type: 'Card', detail: 'Yellow Card',
}];
emitted.length = 0;
let appelsAvant = apiCalls;
let live = await foot.poller.pollLive();
check('match détecté en cours', live === 1);
check('changement de statut diffusé', emitted.some((e) => e.event === 'football:fixture'));

/* ------------------------------------------- le fil, et ce qu'il coûte

 * Le fil du Grand Virage a besoin de ce qui n'est pas un but : cartons,
 * remplacements, arbitrage vidéo. Ça se paie — un appel par match et par
 * relevé — alors que le score, la minute et la période sont déjà dans la
 * réponse qu'on vient de lire.
 *
 * D'où la règle, et c'est elle qu'on éprouve ici : gratuit pour tout le
 * monde, payant seulement pour les matchs dont une salle de virage est
 * occupée, et jamais plus d'un relevé par minute. Une règle d'économie qu'on
 * n'éprouve pas est une règle qu'on découvre en lisant sa facture. */

check('le score et la période partent à chaque tour, sans un appel de plus',
  statuts.at(-1)?.status === '1H' && statuts.at(-1)?.elapsed === 3
  && statuts.at(-1)?.homeGoals === 0);
check('un match que personne ne regarde ne paie pas son fil',
  apiCalls - appelsAvant === 1 && evenements.length === 0);

// Quelqu'un entre dans le virage de ce match.
auFil = [5001];
appelsAvant = apiCalls;
await foot.poller.pollLive();
check('une salle occupée fait relever les événements', apiCalls - appelsAvant === 2);
check('et le carton atteint le fil',
  evenements.at(-1)?.evs?.some((e) => e.type === 'Card' && e.player === 'Keller'));

// Deuxième tour dans la foulée : le relevé du direct tourne toutes les vingt
// secondes, le fil ne doit pas le suivre à ce rythme.
appelsAvant = apiCalls;
const dejaVus = evenements.length;
await foot.poller.pollLive();
check('mais pas plus d’un relevé par minute', apiCalls - appelsAvant === 1);
check('et rien n’est réannoncé au fil', evenements.length === dejaVus);

// But du club suivi. Il s'ajoute au carton : l'API sert la liste entière du
// match à chaque relevé, elle ne la remplace pas.
state.home = 1; state.elapsed = 23;
state.events.push({
  time: { elapsed: 23, extra: null }, team: TEAM,
  player: { name: 'Diallo' }, assist: { name: 'Morel' },
  type: 'Goal', detail: 'Normal Goal',
});
emitted.length = 0;
await foot.poller.pollLive();

check('but diffusé', emitted.some((e) => e.event === 'football:goal'));
const goalEvent = emitted.find((e) => e.event === 'football:goal');
check('but attribué au bon club', goalEvent?.payload.teamId === 85);
check('minute et buteur transmis', goalEvent?.payload.minute === 23 && goalEvent?.payload.player === 'Diallo');
check('score transmis', JSON.stringify(goalEvent?.payload.score) === '[1,0]');
check('diffusion dans le salon du club', emitted.some((e) => e.room === 'team:85'));
check('crochet duel appelé', goals.length === 1);
check('abonné du club identifié pour le bonus', goals[0]?.followers?.includes(USER));

// Nouveau tour sans changement : rien ne doit être rejoué.
emitted.length = 0; goals.length = 0;
await foot.poller.pollLive();
check('aucun doublon de but au tour suivant', goals.length === 0);
const [evRows] = await pool.query(
  `SELECT * FROM fixture_events WHERE fixture_id = 5001 AND type = 'Goal'`);
check('un seul but en base', evRows.length === 1);

// Deuxième but, cette fois pour l'adversaire.
state.away = 1; state.elapsed = 67;
state.events.push({
  time: { elapsed: 67, extra: null }, team: OPPO,
  player: { name: 'Keller' }, type: 'Goal', detail: 'Penalty',
});
goals.length = 0;
await foot.poller.pollLive();
check('deuxième but détecté', goals.length === 1 && goals[0].teamId === 91);
check('but adverse attribué au bon club', goals[0].followers.length === 0);

/* ------------------------------------- le relevé qui se décale en cours de route

 * L'API insère parfois un événement **plus tôt** dans la liste : une décision
 * d'arbitrage vidéo, un carton ajouté après coup. Tout ce qui suit se décale
 * alors d'un rang — et `seq`, en base, est justement ce rang.
 *
 * Le relevé était écrit en `INSERT IGNORE` : les lignes déjà là gardaient leur
 * ancien contenu, et seules les positions de queue étaient insérées, avec un
 * contenu décalé. La base finissait par porter un événement en double et en
 * perdre un autre. Personne ne le voyait : les cartes-souvenirs se
 * dédoublonnent par identité, pas par rang. Le fil du match, lui, le montre —
 * c'est un vrai fil qui affiche deux fois le même carton.
 *
 * On rejoue donc exactement ça : une décision insérée en tête. */
state.events.unshift({
  time: { elapsed: 2, extra: null }, team: TEAM,
  player: { name: 'Morel' }, type: 'Var', detail: 'Goal cancelled',
});
// Le match repart dans le même temps : c'est le changement de score qui
// déclenche le relevé, et c'est bien ainsi que la chose arrive en vrai.
state.away = 2; state.elapsed = 78;
state.events.push({
  time: { elapsed: 78, extra: null }, team: OPPO,
  player: { name: 'Roth' }, type: 'Goal', detail: 'Normal Goal',
});
await foot.poller.pollLive();
{
  const [rows] = await pool.query(
    `SELECT seq, type, player FROM fixture_events WHERE fixture_id = 5001 ORDER BY seq`);
  const attendu = state.events.map((e) => `${e.type}|${e.player?.name ?? ''}`);
  const obtenu = rows.map((r) => `${r.type}|${r.player ?? ''}`);
  check('un événement inséré en tête ne décale pas la base',
    JSON.stringify(obtenu) === JSON.stringify(attendu)
    || (console.log('        base :', obtenu.join(' / ')),
        console.log('        API  :', attendu.join(' / ')), false));
  check('et aucun événement n’est perdu ni doublé',
    new Set(obtenu).size === obtenu.length && obtenu.length === state.events.length);
}

/* Le but est finalement refusé : l'API retire l'entrée de sa liste et le score
   revient en arrière. La base doit raccourcir avec elle, sinon le fil garde un
   but que le match n'a plus — et c'est le genre de fantôme qu'on ne remarque
   qu'en le voyant à l'écran. */
{
  state.events.pop();
  state.away = 1;
  await foot.poller.pollLive();
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM fixture_events WHERE fixture_id = 5001`);
  check('une liste raccourcie ne laisse pas de queue en base',
    rows[0].n === state.events.length
    || (console.log(`        ${rows[0].n} en base pour ${state.events.length} annoncés`), false));
}

// Fin du match.
state.status = 'FT'; state.elapsed = 90;
await foot.poller.pollLive();
live = await foot.poller.pollLive();
check('match terminé : plus de direct', live === 0);
check('la fin du match est annoncée une fois et une seule',
  finis.filter((id) => id === 5001).length === 1);

r = await call('/api/football/feed');
check('le match passe dans les résultats', r.json.feed?.[0]?.last?.[0]?.id === 5001);
check('score final conservé',
  r.json.feed?.[0]?.last?.[0]?.home_goals === 1 && r.json.feed?.[0]?.last?.[0]?.away_goals === 1);

/* -------------------------------------------------------- classement */

await foot.poller.refreshStandings();
r = await call('/api/football/league/61/standings?season=2026');
check('classement enregistré', r.json.standings?.length === 2);
check('premier du classement correct', r.json.standings?.[0]?.team_id === 85 && r.json.standings?.[0]?.points === 12);

const before = apiCalls;
await foot.poller.refreshStandings();
check('classement récent non redemandé à l\u2019API', apiCalls === before);

/* ------------------------------------------------------------- quota */

r = await call('/api/football/quota');
check('quota compté en base', r.json.used > 0);
check('quota restant lu dans les en-têtes', r.json.remaining === 7000);

/* --------------------------------------------------------- fiche club */

r = await call('/api/football/team/85');
check('fiche du club servie', r.json.team?.name === 'Paris Sportif');
check('compétitions du club listées', r.json.leagues?.[0]?.id === 61);

r = await call('/api/football/team/999');
check('club inconnu : 404 propre', r.status === 404);

/* ---------------------------------------------------- désabonnement */

r = await call('/api/football/follows/85', { method: 'DELETE' });
check('désabonnement', r.json.teams?.length === 0);

const [suivis] = await pool.query('SELECT * FROM user_follows');
check('plus rien à interroger pour ce club', suivis.length === 0);
const restants = await foot.store.liveFixtureIds();
check('un club que personne ne suit ne coûte plus rien', restants.length === 0);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'} · ${apiCalls} appels API simulés`);
foot.poller.stop();
await pool.end();
http.close();
apiServer.close();
process.exit(failures ? 1 : 0);
