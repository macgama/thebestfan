/**
 * Test du Grand Virage.
 *
 * Trois supporters, un vrai match. Deux chantent pour le club à domicile, un
 * pour l'adversaire. Un but réel tombe. On vérifie la corde, l'agrégation, le
 * classement, la minute double, et surtout qui reçoit une carte-souvenir.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { createSouvenirs } from '../src/server/souvenirs/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { createVirage } from '../src/server/ferveur/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await wait(20); }
  return false;
}
const jitter = (t, a = 22) => Math.max(0, t + (Math.random() * a * 2 - a));
const tempoParfait = () => Array.from({ length: 8 }, (_, i) => jitter(i * 560, 40));
const martelage = () => Array.from({ length: 21 }, (_, i) => jitter(i * 140));

/* ---------------------------------------------------------------- base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'souvenirs.sql', 'fanzzy.sql', 'tenues.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = ['bbbbbbbb-0000-0000-0000-00000000000' + 1,
           'bbbbbbbb-0000-0000-0000-00000000000' + 2,
           'bbbbbbbb-0000-0000-0000-00000000000' + 3];
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `v${i}@ex.fr`, `Virage${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id, scarves, active_fanzzy) VALUES (?, 100, 'V1')`, [id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'FC Sion'),(91,'FC Bâle')`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
await raw.query(`INSERT INTO souvenir_leagues (league_id,season,name,family,has_events,enabled)
                 VALUES (207,2026,'Super League','championnat',1,1)`);
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,
                                       home_goals,away_goals,elapsed,kickoff_at)
                 VALUES (7001,207,2026,85,91,'1H',1,0,34,UTC_TIMESTAMP())`);
/* Ce que le relevé du direct a déjà mis en base avant que quiconque entre.
   C'est ce qui doit semer le fil : un supporter qui arrive à la trente-
   quatrième minute doit trouver ce qui s'est passé avant lui, sans qu'on
   paie un appel à l'API pour le lui dire. */
await raw.query(`INSERT INTO fixture_events (fixture_id,seq,type,detail,team_id,player,assist,minute)
                 VALUES (7001,0,'Card','Yellow Card',91,'Zambrano',NULL,12),
                        (7001,1,'Goal','Normal Goal',85,'Diallo','Morel',23),
                        (7001,2,'subst',NULL,91,'Roth','Keller',30)`);
// Deux supporters de Sion, un de Bâle.
await raw.query(`INSERT INTO user_follows (user_id,team_id) VALUES (?,85),(?,85),(?,91)`,
  [U[0], U[1], U[2]]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, charset: 'utf8mb4' });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);

/* -------------------------------------------------------------- serveur */

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });
let identite = null;
io.use((socket, next) => {
  socket.data.user = { userId: socket.handshake.auth.token, name: 'Fan' };
  next();
});
const souvenirs = createSouvenirs({ pool, requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); } });
const fanzzy = createFanzzy({ pool, requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); } });
const virage = createVirage({ pool, io, souvenirs, fanzzy,
  requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); } });
app.use('/api/virage', virage.router);
await new Promise((r) => http.listen(0, r));
const url = `http://localhost:${http.address().port}`;

function connect(userId) {
  const socket = client(url, { transports: ['websocket'], auth: { token: userId } });
  const p = { socket, state: null, ticks: [], results: [], errors: [],
              realGoals: [], goals: [], fils: [] };
  socket.on('virage:state', (s) => { p.state = s; });
  socket.on('virage:tick', (t) => p.ticks.push(t));
  socket.on('virage:result', (r) => p.results.push(r));
  socket.on('virage:error', (e) => p.errors.push(e.code));
  socket.on('virage:real_goal', (g) => p.realGoals.push(g));
  socket.on('virage:goal', (g) => p.goals.push(g));
  socket.on('virage:fil', (f) => p.fils.push(f));
  return p;
}

const A = connect(U[0]), B = connect(U[1]), C = connect(U[2]);
check('trois supporters connectés', await until(() => A.socket.connected && B.socket.connected && C.socket.connected));

for (const p of [A, B, C]) p.socket.emit('virage:join', { fixtureId: 7001 });
check('tous entrent dans le virage', await until(() => A.state && B.state && C.state));
check('camps déduits des clubs suivis',
  A.state.you.side === 0 && B.state.you.side === 0 && C.state.you.side === 1);
check('le match est identifié', A.state.fixture.homeName === 'FC Sion');
check('les cartes sont annoncées par le serveur', A.state.cards.length >= 4);

/* ------------------------------------------------------------- le fil

 * Le joueur pousse sur une corde pendant un vrai match. Sans fil, la corde
 * tressaille et il ne sait pas pourquoi : c'est le manque que ce bloc éprouve.
 *
 * Le fil part **avec l'état**, semé depuis `fixture_events`. Entrer à la
 * trente-quatrième minute doit donner ce qui s'est passé avant, et ne doit
 * coûter aucun appel à l'API — la base sait déjà tout ça. */
{
  const fil = A.state.fil ?? [];
  check('le fil arrive avec l’état, semé depuis la base', fil.length >= 3);
  check('il porte le carton et le remplacement',
    fil.some((e) => e.type === 'Card' && e.joueur === 'Zambrano')
    && fil.some((e) => e.type === 'subst'));
  check('il dit de quel côté chaque entrée se range',
    fil.find((e) => e.joueur === 'Zambrano')?.side === 1);

  /* Les buts d'avant l'arrivée ne sont pas rejoués comme frais. Ils entrent
     par `realGoal`, qui secoue la corde et ouvre la minute double : les
     laisser aussi passer par le relevé les raconterait deux fois, et un but
     de la vingt-troisième minute sonnerait comme un but de maintenant au
     moment où quelqu'un entre. Le score les porte, lui. */
  check('mais pas les buts, qui ont leur propre chemin',
    !fil.some((e) => e.type === 'Goal'));
  check('le score du vrai match est là dès l’entrée',
    A.state.scoreReel?.[0] === 1 && A.state.scoreReel?.[1] === 0);
  /* La période ouvre le fil, et à sa vraie place.
     Elle était datée de l'horloge du moment plutôt que de la frontière de
     période : une salle ouverte à la trente-quatrième minute rangeait son
     « coup d'envoi » entre le carton de la douzième et le remplacement de la
     trentième, c'est-à-dire au milieu du match qu'il est censé ouvrir. */
  const coupDEnvoi = fil.find((e) => e.genre === 'periode' && e.type === '1H');
  check('la période ouvre le fil, et elle ne coûte rien', Boolean(coupDEnvoi));
  check('le coup d’envoi est daté du coup d’envoi', coupDEnvoi?.minute === 0);
  check('et il ouvre bien le fil', fil[0]?.type === '1H');
  check('le fil est le même pour toute la salle',
    (C.state.fil ?? []).length === fil.length);
}

/* ------------------------------------------------------------- un match sans club suivi */

/* Le virage est **ouvert à tous les matchs en direct**. Il ne montrait que
   ceux de ses clubs et refusait le reste : un soir de Coupe d'Europe avec huit
   rencontres, il en proposait une, et le joueur en concluait qu'il n'y avait
   rien à faire. On entre donc partout — mais on choisit son camp, et ce qu'on
   y gagne n'est pas le même. */
const D = connect('bbbbbbbb-0000-0000-0000-000000000009');
await until(() => D.socket.connected);
D.socket.emit('virage:join', { fixtureId: 7001, camp: 'exterieur' });
check('un match qu’on ne suit pas s’ouvre quand même', await until(() => D.state));
check('et le camp demandé est respecté', D.state?.you?.side === 1);
check('le supporter sait qu’il est neutre', D.state?.you?.neutre === true);
check('et de combien sa ferveur est réduite',
  D.state?.you?.ferveurNeutre > 0 && D.state.you.ferveurNeutre < 1);

/* Chez soi, le camp ne se choisit pas : il découle du club suivi. C'est ce qui
   empêche d'aller pousser contre son propre club, et un `camp` envoyé par un
   client modifié ne doit pas y changer quoi que ce soit. */
A.socket.emit('virage:join', { fixtureId: 7001, camp: 'exterieur' });
await until(() => A.state?.you);
check('chez soi, le camp ne se choisit pas', A.state.you.side === 0);
check('et la ferveur n’y est pas réduite', A.state.you.neutre === false);


/* ----------------------------------------------------------------- chants */

A.socket.emit('virage:chant', { cardId: 'reprise', taps: tempoParfait() });
const ok1 = await until(() => A.results.length === 1);
if (!ok1) console.log('  DEBUG erreurs A :', JSON.stringify(A.errors));
check('chant accepté', ok1);
if (!ok1) { console.log('arrêt'); process.exit(1); }
check('la qualité est calculée par le serveur', A.results[0].quality > 0.6);
check('le souffle est débité', A.results[0].breath < 100);
check('la ferveur personnelle monte', A.results[0].ferveur > 0);

const ropeApres = await until(() => A.ticks.some((t) => t.rope < 0));
check('la corde penche du côté de Sion', ropeApres);

C.socket.emit('virage:chant', { cardId: 'roulement', taps: martelage() });
await until(() => C.results.length === 1);
check('le camp adverse pousse dans l\u2019autre sens', C.results[0].push > 0);

/* La ferveur d'un neutre compte moiti\u00e9. C'est la contrepartie de l'ouverture,
   et la seule : sa pouss\u00e9e, elle, vaut autant que celle des autres \u2014 on r\u00e9duit
   ce qu'il gagne, pas ce qu'il apporte. Une tribune qui pousserait \u00e0 moiti\u00e9
   serait une tribune qu'on d\u00e9courage de venir, et le but est l'inverse.

   Le bloc est ici, apr\u00e8s les contr\u00f4les de corde, et pas au moment de l'entr\u00e9e :
   un chant de plus d\u00e9place le n\u0153ud, et il faussait \u00ab la corde penche du c\u00f4t\u00e9
   de Sion \u00bb deux \u00e9crans plus haut. */
{
  const salle = virage.rooms.get(7001);
  const av = salle.members.get('bbbbbbbb-0000-0000-0000-000000000009');
  D.socket.emit('virage:chant', { cardId: 'roulement', taps: martelage() });
  const ok = await until(() => D.results.length === 1);
  check('un neutre peut chanter', ok);
  if (ok) {
    check('sa pouss\u00e9e n\u2019est pas rabot\u00e9e', D.results[0].push > 0);
    check('mais sa ferveur ne vaut que la moiti\u00e9 de sa pouss\u00e9e',
      Math.abs(av.ferveur - D.results[0].push * 0.5) <= 1
      || (console.log(`        ferveur ${av.ferveur} pour ${D.results[0].push} de pouss\u00e9e`), false));
  }
}
D.socket.disconnect();

/* ------------------------------------------------------------ triche */

A.socket.emit('virage:chant', { cardId: 'reprise', taps: Array.from({ length: 30 }, (_, i) => i * 20) });
check('frappes inhumaines rejetées',
  await until(() => A.errors.some((e) => e.startsWith('ferveur.error.'))));

A.socket.emit('virage:chant', { cardId: 'inexistante', taps: tempoParfait() });
check('carte inconnue rejetée', await until(() => A.errors.includes('ferveur.error.unknown_card')));

for (let i = 0; i < 15; i++) {
  B.socket.emit('virage:chant', { cardId: 'reprise', taps: tempoParfait() });
}
check('cadence de chants plafonnée',
  await until(() => B.errors.includes('ferveur.error.rate_limited')));

/* -------------------------------------------------------------- but réel */

// B a chanté à l'instant, C il y a peu, A aussi : tous présents.
// On éloigne C pour vérifier qu'un inactif ne reçoit rien.
await pool.query(
  `UPDATE virage_presence SET last_push_at = NOW(3) - INTERVAL 10 MINUTE WHERE user_id = ?`, [U[2]]);

const avant = A.state.rope;
virage.realGoal({ fixtureId: 7001, teamId: 85, minute: 23, player: 'Diallo' });
check('but réel diffusé à toute la salle',
  await until(() => A.realGoals.length === 1 && C.realGoals.length === 1));
check('le but secoue la corde du bon côté', A.realGoals[0].side === 0);
check('la minute double s\u2019ouvre', A.realGoals[0].surgeUntil > Date.now());

/* --------------------------------------------------- le fil, en direct */
{
  const salle = virage.rooms.get(7001);

  check('le but r\u00e9el s\u2019\u00e9crit au fil',
    salle.fil.some((e) => e.type === 'Goal' && e.joueur === 'Diallo' && e.minute === 23));
  check('et il est diffus\u00e9 \u00e0 la salle',
    await until(() => A.fils.some((f) =>
      f.entrees?.some((e) => e.type === 'Goal' && e.joueur === 'Diallo'))));

  /* Le terrain hors les buts : ce sont ces \u00e9v\u00e9nements-l\u00e0 qui se paient un
     appel, et qui n'arrivaient jamais avant le fil. */
  A.fils.length = 0;
  const pris = virage.matchEvents(7001, [{
    type: 'Card', detail: 'Red Card', teamId: 91, player: 'Keller', minute: 66,
  }]);
  check('un carton rouge entre au fil', pris === 1);
  check('la salle le re\u00e7oit',
    await until(() => A.fils.at(-1)?.entrees?.[0]?.detail === 'Red Card'));
  /* On cherche l'entr\u00e9e, on ne suppose pas sa place : le fil est rang\u00e9 par
     minute et non par ordre d'arriv\u00e9e, sinon un carton relev\u00e9 apr\u00e8s coup
     s'afficherait apr\u00e8s la mi-temps qu'il pr\u00e9c\u00e8de. */
  check('le d\u00e9tail du carton est conserv\u00e9, rouge et jaune ne se valent pas',
    salle.fil.find((e) => e.joueur === 'Keller' && e.type === 'Card')?.detail === 'Red Card');

  /* Le relev\u00e9 rejoue toute la liste du match \u00e0 chaque passage : sans
     d\u00e9duplication, chaque tour r\u00e9annoncerait le match entier. */
  A.fils.length = 0;
  const encore = virage.matchEvents(7001, [{
    type: 'Card', detail: 'Red Card', teamId: 91, player: 'Keller', minute: 66,
  }]);
  check('un relev\u00e9 qui se r\u00e9p\u00e8te n\u2019ajoute rien', encore === 0);
  await wait(120);
  check('et ne diffuse rien non plus', A.fils.length === 0);

  /* Un but venu du relev\u00e9 est le m\u00eame but que celui du jeu : il est \u00e9cart\u00e9,
     sinon le fil raconte deux fois le m\u00eame. */
  const butRejoue = virage.matchEvents(7001, [{
    type: 'Goal', detail: 'Normal Goal', teamId: 85, player: 'Bonvin', minute: 71,
  }]);
  check('un but venu du relev\u00e9 n\u2019entre pas au fil', butRejoue === 0);

  /* La p\u00e9riode et le score ne co\u00fbtent aucun appel : ils sont d\u00e9j\u00e0 dans la
     r\u00e9ponse que le relev\u00e9 du direct vient de lire. */
  A.fils.length = 0;
  virage.matchStatus(7001, { status: 'HT', elapsed: 45, homeGoals: 2, awayGoals: 1 });
  check('la mi-temps s\u2019\u00e9crit au fil',
    salle.fil.some((e) => e.genre === 'periode' && e.type === 'HT'));
  check('et le score du terrain se met \u00e0 jour',
    salle.scoreReel[0] === 2 && salle.scoreReel[1] === 1);
  virage.matchStatus(7001, { status: 'HT', elapsed: 45, homeGoals: 2, awayGoals: 1 });
  check('un statut inchang\u00e9 n\u2019\u00e9crit pas une seconde mi-temps',
    salle.fil.filter((e) => e.genre === 'periode' && e.type === 'HT').length === 1);

  /* ------------------------- le score et la minute, entre deux entr\u00e9es

   * Ils ne descendaient qu'**avec une entr\u00e9e de fil** : un but r\u00e9el en produit
   * une, un changement de p\u00e9riode aussi. Entre les deux, rien. Le supporter
   * voyait donc \u00ab 2 \u2013 1 \u00b7 45\u2032 \u00bb pendant une demi-heure, et en concluait \u2014 \u00e0
   * raison \u2014 que la page ne suivait plus le match.
   *
   * Le relev\u00e9 du direct lit ces deux valeurs toutes les vingt secondes. Il ne
   * manquait qu'un message pour les faire descendre. */
  const matchs = [];
  A.socket.on('virage:match', (v) => matchs.push(v));
  matchs.length = 0;

  /* On compte les entr\u00e9es **dans la salle** et non les messages re\u00e7us : le
     socket est asynchrone, et un `virage:fil` encore en vol depuis le bloc
     pr\u00e9c\u00e9dent tomberait dans le compteur. La salle, elle, est la v\u00e9rit\u00e9. */
  const filAvant = salle.fil.length;
  virage.matchStatus(7001, { status: 'HT', elapsed: 52, homeGoals: 3, awayGoals: 1 });
  check('un score qui bouge est diffus\u00e9 sans attendre une entr\u00e9e de fil',
    await until(() => matchs.some((v) => v.scoreReel?.[0] === 3)));
  check('et il n\u2019\u00e9crit rien au fil, puisque rien ne s\u2019est pass\u00e9 sur le terrain',
    salle.fil.length === filAvant);

  matchs.length = 0;
  virage.matchStatus(7001, { status: 'HT', elapsed: 60, homeGoals: 3, awayGoals: 1 });
  check('une minute qui avance est diffus\u00e9e aussi',
    await until(() => matchs.some((v) => v.minute === 60)));

  matchs.length = 0;
  virage.matchStatus(7001, { status: 'HT', elapsed: 60, homeGoals: 3, awayGoals: 1 });
  await wait(120);
  check('un relev\u00e9 identique ne diffuse rien', matchs.length === 0);

  /* La tribune a sa voix dans le fil. C'est elle qui explique la corde : sans
     cette entr\u00e9e, le n\u0153ud repart du milieu sans qu'on sache qui a c\u00e9d\u00e9. */
  A.fils.length = 0;
  salle.scoreGoal(0);
  const tribune = salle.fil.find((e) => e.genre === 'tribune');
  check('le but de tribune s\u2019\u00e9crit au fil, marqu\u00e9 comme tel', tribune?.side === 0);
  check('et il porte le score de la corde', Array.isArray(tribune?.goals));
  check('la salle l\u2019apprend en m\u00eame temps que le but',
    await until(() => A.fils.some((f) =>
      f.entrees?.some((e) => e.genre === 'tribune'))));

  /* Le fil est born\u00e9. Un match \u00e0 prolongations avec vingt remplacements ne
     doit pas gonfler sans fin dans la m\u00e9moire du serveur. */
  const avant = salle.fil.length;
  virage.matchEvents(7001, Array.from({ length: 80 }, (_, i) => ({
    type: 'Card', detail: 'Yellow Card', teamId: 85, player: `Joueur${i}`, minute: 80,
  })));
  check('le fil est born\u00e9', salle.fil.length <= 60 && salle.fil.length < avant + 80);
  check('et c\u2019est la fin du match qu\u2019il garde',
    salle.fil.at(-1)?.joueur === 'Joueur79');

  check('un match sans salle ne tient pas de fil',
    virage.matchEvents(9999, [{ type: 'Card', teamId: 85, minute: 5 }]) === 0
    && virage.matchStatus(9999, { status: 'FT' }) === 0);

  /* La r\u00e8gle d'\u00e9conomie, vue du virage : c'est cette liste que le relev\u00e9
     interroge avant de payer un appel d'\u00e9v\u00e9nements. */
  check('la salle occup\u00e9e se d\u00e9clare au relev\u00e9',
    virage.sallesOccupees().includes(7001));
}

const r = await souvenirs.mintGoal({
  fixtureId: 7001, seq: 1, leagueId: 207, teamId: 85, homeId: 85, awayId: 91,
  minute: 23, player: 'Diallo', scoreHome: 1, scoreAway: 0, kickoffAt: '2026-09-13 16:00:00',
});
check('carte-souvenir frappée', r.minted === true);
check('seuls les chanteurs récents la reçoivent', r.presents === 2);

identite = U[0];
const mesA = await souvenirs.collection(U[0]);
check('le supporter actif a sa carte', mesA.length === 1 && mesA[0].player === 'Diallo');
check('le Fanzzy équipé est gravé dessus', mesA[0].fanzzy_id === 'V1');
const mesC = await souvenirs.collection(U[2]);
check('l\u2019inactif ne l\u2019a pas', mesC.length === 0);

/* ------------------------------------------------------------ classement */

const room = virage.rooms.get(7001);
const rangA = room.rankOf(U[0]);
check('classement dans sa propre tribune', rangA.of === 2 && rangA.rank >= 1);
check('la ferveur cumulée est retenue', rangA.ferveur > 0);
// La foule (mémoire, 90 s) et la présence pour les souvenirs (base, 2 min)
// sont deux fenêtres distinctes : C reste dans la foule alors qu'il n'a plus
// droit aux cartes. C'est voulu — on ne le sort pas du virage parce qu'il a
// manqué un but.
const crowd = room.crowd();
check('la foule compte les deux tribunes', crowd[0] === 2 && crowd[1] === 1);

/* ------------------------------------------ ce que /live doit renvoyer

 * L'accueil s'en sert pour animer le supporter : il pousse pendant le match,
 * exulte quand *son* club marque, encaisse quand c'est l'autre. Décider de
 * quel côté on est demande les identifiants des équipes. Les rapprocher par
 * le nom marcherait presque, et « presque » veut dire que le personnage se
 * réjouit parfois d'un but encaissé. */
{
  const r = await fetch(`${url}/api/virage/live`).then((x) => x.json());
  const m = r.matchs?.[0];
  check('/live nomme les deux équipes par leur identifiant',
    typeof m?.home_id === 'number' && typeof m?.away_id === 'number');
  check('et donne le score et la minute',
    'home_goals' in (m ?? {}) && 'elapsed' in (m ?? {}));
}

for (const m of room.members.values()) m.lastPush = Date.now() - 120_000;
check('après 90 s sans chanter, on ne compte plus dans la foule',
  room.crowd()[0] === 0 && room.crowd()[1] === 0);
for (const m of room.members.values()) m.lastPush = Date.now();

/* ------------------------------------------------------------ départ */

A.socket.disconnect();
check('un départ vide sa place', await until(() => room.crowd()[0] === 1, 2000));

/* ------------------------------------------- le barème du geste affiché */

/**
 * Le client doit afficher le geste tel que le serveur le note.
 *
 * Il ne le faisait pas : la pulsation était écrite en dur à 560 ms côté page
 * alors que la notation applique `tempoInterval`. Un joueur portant les
 * Jumelles tapait juste sur ce qu'il voyait et récoltait 0,36 au lieu de 0,99,
 * et le Capo di Curva, carte étoile, était puni plus fort qu'un commun.
 * Ces trois contrôles sont ceux qui l'auraient vu.
 */
{
  const { grade, resoudreGeste, GESTURES } = await import('../src/server/ferveur/gestures.js');

  // A vient de se déconnecter juste au-dessus : on interroge un membre encore présent.
  const vueA = room.snapshotFor(U[1]);
    /* Le souffle remonte dix fois par seconde côté serveur, mais la diffusion de
     la corde part à toute la salle : elle ne peut pas porter une valeur propre
     à chacun. La jauge ne bougeait donc qu'au chant suivant, et le joueur
     croyait son souffle bloqué. La vue donne le taux, la page anime. */
  check('la vue donne le regain de souffle par seconde',
    typeof vueA.you?.regen === 'number' && vueA.you.regen > 0);
  check('et le plafond, sans quoi la jauge dépasserait cent',
    vueA.you?.breathMax === 100);

check('la vue donne le barème du geste au client', Boolean(vueA.you?.gestes?.tempo));
  check('sans équipement, le barème est celui de base',
    vueA.you.gestes.tempo.interval === GESTURES.tempo.interval);

  // Un joueur qui tape parfaitement sur la pulsation qu'on lui affiche doit
  // être bien noté, équipé ou non.
  const parfait = (mods) => {
    const g = resoudreGeste(mods).tempo;
    const frappes = Array.from({ length: g.beats },
      (_, i) => Math.round(i * g.interval + (i % 3) - 1));
    return grade('tempo', frappes, mods);
  };
  check('taper sur la pulsation affichée paie, sans équipement',
    parfait({}) > 0.9);
  check('taper sur la pulsation affichée paie aussi avec les Jumelles',
    parfait({ tempoInterval: 70, tempoWindow: 1.25 }) > 0.9);
  check('et avec un Fanzzy étoile : la rareté ne pénalise plus',
    parfait({ tempoInterval: 80, tempoWindow: 1.7 }) > 0.9);

  // Le martelage suit la même règle : la durée annoncée est celle notée.
  const gm = resoudreGeste({ mashTime: -600 }).mash;
  check('un martelage raccourci annonce sa vraie durée', gm.ms === GESTURES.mash.ms - 600);
  check('et sa cible baisse d\u2019autant, sinon le raccourci serait un cadeau',
    gm.target < GESTURES.mash.target);
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
for (const p of [B, C]) p.socket.disconnect();
virage.stop(); io.close(); http.close(); await pool.end();
process.exit(failures ? 1 : 0);
