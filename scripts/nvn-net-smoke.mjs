/**
 * Test de la couche réseau du duel NvN.
 * Vraies sockets, vraie base : appariement, diffusion, coupure, reprise.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { io as client } from 'socket.io-client';
import { createDecks } from '../src/server/deck/index.js';
import { createNvN } from '../src/server/nvn/index.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn()) return true; await wait(25); }
  return false;
}

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql','football.sql', 'minutes.sql', 'couleurs.sql','duel.sql','souvenirs.sql', 'billets.sql','fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'tenues.sql','deck.sql', 'historique.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = ['e1','e2','e3','e4'].map((x, i) =>
  `eeee0000-0000-0000-0000-00000000000${i + 1}`);
const communes = ACTIONS.filter((a) => a.rar === 'commune').map((a) => a.id);
const dix = [...communes, ...communes].slice(0, 10);
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `n${i}@ex.fr`, `Duelliste${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,0)`, [id]);
  for (const f of ['TR32','MS30','TR33']) {
    await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`, [id, f]);
  }
  await raw.query(`INSERT INTO user_decks (user_id,nom,contenu) VALUES (?,?,?)`,
    [id, 'Deck', JSON.stringify({ nom:'Deck',
      fanzzy:[{id:'TR32',stuff:[]},{id:'MS30',stuff:[]},{id:'TR33',stuff:[]}], actions: dix })]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
// Le premier duelliste suit Sion, qui joue le match 900 ; le second ne suit
// personne. Pousser pour son club rapporte le double, et la comparaison des
// deux bourses à la fin du duel est le seul moyen de le vérifier.
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [U[0]]);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,kickoff_at)
  VALUES (900,207,2026,85,91,'1H',UTC_TIMESTAMP()),
         (901,207,2026,91,85,'NS',UTC_TIMESTAMP() + INTERVAL 3 DAY)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 10, ...OPTIONS_BASE });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);
const app = express(); const http = createServer(app);
const io = new Server(http, { cors:{origin:'*'} });
io.use((s, next) => { s.data.user = { userId: s.handshake.auth.token, name: 'J' }; next(); });
const decks = createDecks({ pool, requireAuth: (r,_s,n)=>n() });
const N = createNvN({ pool, io, decks, requireAuth: (r,_s,n)=>{ r.user={id:U[0]}; n(); } });
app.use('/api/nvn', N.router);
await new Promise((r)=>http.listen(0,r));
const url = `http://localhost:${http.address().port}`;

function co(id) {
  const socket = client(url, { transports:['websocket'], auth:{ token:id }, reconnection:false });
  const p = { id, socket, state:null, events:[], errors:[], file:null, starts:0 };
  socket.on('nvn:start', (s)=>{ p.state=s; p.starts++; });
  socket.on('nvn:state', (s)=>{ p.state=s; });
  socket.on('nvn:events', (e)=>p.events.push(...e));
  socket.on('nvn:error', (e)=>p.errors.push(e.code));
  socket.on('nvn:file', (f)=>{ p.file=f; });
  // `nvn:file` est la mienne, `nvn:attentes` sont toutes celles du serveur.
  socket.on('nvn:attentes', (d)=>{ p.attentes = d?.attentes ?? []; });
  return p;
}

/* ------------------------------------------------------- appariement 1v1 */

const A = co(U[0]), B = co(U[1]);
check('sockets connectées', await until(()=>A.socket.connected && B.socket.connected));

A.socket.emit('nvn:queue', { format:'1v1', fixtureId:900 });
check('mise en file confirmée', await until(()=>A.file !== null));
check('le mode du match est annoncé', A.file.mode === 'classe');
check('pas d\u2019appariement seul', A.state === null);

/* ------------------------------------------------------- les deux camps

   Les deux tribunes d'un duel sont les deux clubs du match. Le premier
   duelliste suit Sion, qui reçoit : son camp est décidé pour lui, et il n'a
   rien à choisir. Le second ne suit personne : il choisit, et il choisit le
   camp vide — c'est exactement le geste que le renfort doit payer. */

check('chez soi, le camp ne se choisit pas',
  A.file.camp === 0 && A.file.neutre === false);
check('et la file dit quel club on défend', A.file.club?.id === 85);
check('elle dit aussi ce qu’il manque en face', A.file.manqueEnFace === 1);
check('sans club dans ce match, rien à renforcer encore', A.file.renfort === 1);


/* ------------------------------------------------- qui attend, et où

   Personne ne voyait rien : on entrait en file seul et aveugle, et deux
   joueurs pouvaient attendre au même moment sur deux matchs différents sans
   jamais se croiser. C'était la moitié manquante du duel par camps — un bonus
   pour le camp délaissé ne sert à rien si personne ne voit qu'un camp est
   délaissé.

   Deux chemins, et il faut les deux : l'annonce **diffusée** à ceux qui sont
   déjà sur la page, et l'état **demandé** par qui vient d'arriver. */

check('l’attente est annoncée à tout le monde',
  await until(() => (B.attentes ?? []).length === 1));

{
  const a = (B.attentes ?? [])[0];
  check('elle nomme le match et le format',
    a?.fixtureId === 900 && a?.format === '1v1');
  check('et dit combien attendent de chaque côté',
    a?.camps?.[0] === 1 && a?.camps?.[1] === 0
    || (console.log('        elle dit :', JSON.stringify(a?.camps)), false));
  check('mais jamais qui', JSON.stringify(a ?? {}).includes(U[0]) === false);
}

{
  const r = await fetch(`${url}/api/nvn/attentes`).then((x) => x.json());
  check('et qui arrive après peut la demander', (r.attentes ?? []).length === 1);

  /* L'alerte de l'accueil : une seule attente, la plus pertinente. Le lecteur
     du banc suit Sion, qui joue ce match — c'est donc la sienne. */
  check('l’accueil reçoit une alerte', Boolean(r.alerte));
  check('elle porte sur un match de mes clubs', r.alerte?.mien === true);
  check('et désigne le camp qui manque de monde',
    r.alerte?.campQuiManque === 1 && r.alerte?.manque === 1
    || (console.log('        elle dit :', JSON.stringify(r.alerte)), false));
}
B.socket.emit('nvn:queue', { format:'1v1', fixtureId:900, camp:1 });
check('duel formé à deux', await until(()=>A.state && B.state));
check('le neutre a pris le camp qu’il a demandé',
  B.file.camp === 1 && B.file.neutre === true);
check('et tenir le camp vide double sa ferveur', B.file.renfort === 2
  || (console.log('        il dit :', B.file.renfort), false));
check('camps opposés', A.state.moi.side !== B.state.moi.side);
check('et le camp est le club', A.state.moi.side === 0 && B.state.moi.side === 1);
check('main de cinq cartes', A.state.moi.main.length === 5);
check('trois Fanzzy', A.state.moi.fanzzy.length === 3);
check('le match support est transmis', A.state.fixture?.id === 900);
check('duel classé', A.state.mode === 'classe');


/**
 * Une suite de frappes qui passe, geste par geste.
 *
 * Le serveur **note** ce qu'on lui envoie : une note nulle ne pousse pas la
 * corde, et « la corde a bougé » échouerait alors pour une raison qui n'a rien à
 * voir avec le réseau. On produit donc, pour chaque famille de geste, quelque
 * chose que le barème reconnaît — sans chercher la perfection, qui n'est pas le
 * sujet ici.
 */
function gestePassable(gest) {
  /* **Toutes les suites de frappes tremblent.**
   *
   * Le serveur refuse les frappes de métronome : deux intervalles identiques à
   * moins de six millisecondes près valent `inhuman_regularity`, et il a
   * raison — un humain ne tape pas deux fois de suite au même écart.
   *
   * Le premier jet ne faisait trembler que le tempo. Le répertoire étant tiré
   * de l'identifiant du duel, cette suite tombait donc **une fois sur deux**,
   * selon que le chant offert demandait un geste tremblé ou non — et sans rien
   * qui nomme la cause, puisque le refus part sur un autre canal que les
   * contrôles qui échouaient ensuite. */
  const bruit = (a = 18) => Math.random() * a * 2 - a;
  const tremble = (t) => t.map((x, i) => Math.round(i === 0 ? x : x + bruit(9)));

  switch (gest) {
    // Les gestes de maintien : un appui long, rendu par deux instants. Pas de
    // cadence, donc rien à trembler.
    case 'hold':   return [0, 3200];
    case 'tenue':  return [0, 3600];
    case 'relance': return [0, 1900];
    // Le martelage : le plus de frappes possible en trois secondes.
    case 'mash':   return tremble(Array.from({ length: 22 }, (_, i) => i * 135));
    case 'retenue': return tremble(Array.from({ length: 12 }, (_, i) => i * 330));
    case 'contretemps':
      return Array.from({ length: 6 }, (_, i) => Math.round(310 + i * 620 + bruit()));
    case 'crescendo': {
      const t = [0];
      let pas = 700;
      for (let i = 1; i < 10; i++) { t.push(t[i - 1] + pas); pas -= 49; }
      return tremble(t);
    }
    case 'salves': {
      const t = [];
      for (let r = 0; r < 3; r++) {
        for (let k = 0; k < 4; k++) t.push(r * 1400 + k * 160);
      }
      return tremble(t);
    }
    // Le tempo et tout le reste : huit frappes régulières.
    default:
      return Array.from({ length: 8 }, (_, i) => Math.round(i * 560 + bruit()));
  }
}

/* ------------------------------------------------------------ actions */

/* **On choisit un chant, pas un geste.**
 *
 * Le duel proposait dix gestes à tour de rôle et le client annonçait le sien :
 * un client modifié jouait alors toujours celui qu'il réussit. Il reçoit
 * maintenant un répertoire de cinq chants, tiré de l'identifiant de la partie,
 * et il en joue un — avec son coût et sa poussée. C'est exactement le Virage.
 *
 * Le chant est donc pris **dans l'état**, et pas écrit en dur : le répertoire
 * change d'un duel à l'autre, et un identifiant figé ici ne serait au
 * répertoire qu'une fois sur quatre. */
/* **Un chant de rythme**, et pas une épreuve.
 *
 * Sept des dix-sept mini-jeux sont des épreuves : le serveur envoie une consigne
 * — une forme à tracer, une grille à refaire — et note une *réponse*, pas des
 * frappes. Leur chanter des instants de frappe donne zéro, la corde ne bouge
 * pas, et ce contrôle-ci échoue une fois sur deux selon le répertoire tiré.
 *
 * Ce que cette suite éprouve est le **réseau** : que le chant parte, revienne
 * aux deux joueurs et déplace la corde. Les épreuves ont la leur,
 * `epreuves-ui-smoke`. On prend donc un chant qui se note aux frappes. */
/* Les gestes que cette suite sait **rejouer sans rien lire**.
 *
 * Ce sont ceux dont la consigne tient dans le barème : huit frappes sur une
 * pulsation, un appui de trois secondes, douze frappes exactement. On les
 * fabrique de mémoire et le serveur les reconnaît.
 *
 * `echo` n'en est pas, et c'est la deuxième cause d'échec intermittent trouvée
 * ici : son motif de cinq coups est **tiré par le serveur à chaque chant** et
 * envoyé dans la consigne. Le rejouer sans l'avoir lu donne zéro, la corde ne
 * bouge pas, et quatre contrôles tombent derrière. Les sept épreuves sont dans
 * le même cas, et sont déjà exclues.
 *
 * Ce que cette suite éprouve est le **réseau**. Les mini-jeux ont `epreuves:ui`
 * et `virage:ui`, qui lisent la consigne avant d'y répondre. */
const RYTHMES = new Set(['tempo', 'mash', 'hold', 'contretemps',
  'crescendo', 'relance', 'salves', 'tenue', 'retenue']);
const monChant = A.state.chants.find((c) => RYTHMES.has(c.gest));
check('le répertoire propose au moins un chant de rythme', Boolean(monChant)
  || (console.log('        répertoire :',
    A.state.chants.map((c) => `${c.id}/${c.gest}`).join(' ')), false));
/* **Le souffle est rempli avant de chanter**, et c'est nécessaire.
 *
 * Les chants coûtent de vingt-deux à trente-huit de souffle, et le répertoire
 * est tiré de l'identifiant du duel : selon la partie, le seul chant de rythme
 * offert est parfois le plus cher. Le moteur le refusait alors pour
 * `not_enough_breath`, la corde ne bougeait pas, et sept contrôles tombaient en
 * cascade — une fois sur deux, sans rien qui nomme la cause.
 *
 * Ce que cette suite éprouve est le **réseau** : que le chant parte, revienne
 * aux deux joueurs et déplace la corde. L'économie du souffle a la sienne. */
const salleA = [...N.salles.values()][0];
salleA.duel.joueurs.get(U[0]).breath = 100;

A.socket.emit('nvn:chant', { cardId: monChant.id,
  taps: gestePassable(monChant.gest) });
check('le chant est diffusé aux deux', await until(()=>
  A.events.some((e)=>e.t==='chant') && B.events.some((e)=>e.t==='chant'))
  || (console.log(`        chant ${monChant.id}/${monChant.gest} (coût ${monChant.cost})`,
    '· refus :', A.errors.at(-1)?.code ?? '—'), false));
check('la corde a bougé', await until(()=>A.state.rope !== 0));

/* Le neutre chante une fois lui aussi. Sans ferveur de son côté, le contrôle
   du renfort plus bas ne mesurerait que zéro contre zéro — et passerait au
   vert quelle que soit la règle. */
{
  const sonChant = B.state.chants.find((c) => RYTHMES.has(c.gest));
  salleA.duel.joueurs.get(U[1]).breath = 100;
  if (sonChant) {
    B.socket.emit('nvn:chant', { cardId: sonChant.id, taps: gestePassable(sonChant.gest) });
    await until(() => (salleA.duel.joueurs.get(U[1]).ferveur ?? 0) > 0);
  }
}

// Et rétabli après : le chant l'a entamé, et une carte refusée faute de souffle
// ferait passer les tests suivants pour de mauvaises raisons.
salleA.duel.joueurs.get(U[0]).breath = 100;

/* La première carte de la main, mais **jouable sans condition**.

   La main est mélangée, et depuis que « Relève » existe le deck en contient :
   c'est une commune, donc offerte à tout le monde, et elle ne se joue que si le
   Fanzzy en tribune a un âge débloqué — ce qui n'est pas le cas ici. Une fois
   sur cinq environ, elle sortait en tête et le test échouait sur un refus
   parfaitement légitime.

   Le test voulait dire « joue une carte », pas « joue celle-là ». */
const carte = A.state.moi.main.find((id) =>
  !ACTIONS.find((a) => a.id === id)?.condition) ?? A.state.moi.main[0];
A.socket.emit('nvn:play', { cardId: carte });
check('la carte est jouée', await until(()=>A.events.some((e)=>e.t==='action')));
check('elle quitte la main', await until(()=>!A.state.moi.main.includes(carte)));

A.errors.length = 0;
A.socket.emit('nvn:play', { cardId: 'a-inexistante' });
check('carte inconnue refusée',
  await until(()=>A.errors.includes('ferveur.error.card_not_in_hand')));

A.errors.length = 0;
for (let i = 0; i < 40; i++) A.socket.emit('nvn:chant', { geste:'tempo', taps:[0] });
check('cadence plafonnée', await until(()=>A.errors.includes('nvn.error.rate_limited')));

/* --------------------------------------------------- coupure et reprise */

const salle = [...N.salles.values()][0];
B.socket.disconnect();
check('la coupure est annoncée', await until(()=>A.events.some((e)=>e.t==='disconnected')));
check('la place est gardée', salle.membres.get(U[1]).parti !== true);
check('le duel continue', !salle.duel.termine);

const B2 = co(U[1]);
await until(()=>B2.socket.connected);
B2.socket.emit('nvn:resume');
check('reprise acceptée', await until(()=>B2.state !== null));
check('l\u2019état est complet à la reprise',
  B2.state.moi.main.length > 0 && B2.state.moi.fanzzy.length === 3);
check('le retour est annoncé', await until(()=>A.events.some((e)=>e.t==='back')));

/* ------------------------------------------------------- fin et classement */

// Le plafond de cadence court sur dix secondes : il faut le laisser retomber,
// sinon le dernier chant serait refusé et la partie ne se terminerait jamais.
await wait(10_500);
salle.duel.goals = [2, 2];
salle.duel.rope = -299;
salle.duel.joueurs.get(U[0]).breath = 100;
A.errors.length = 0;
// Le même chant qu'au début, et pris dans l'état pour la même raison : le
// répertoire est tiré de l'identifiant de la partie.
A.socket.emit('nvn:chant', { cardId: monChant.id, taps: gestePassable(monChant.gest) });
check('la partie se termine', await until(()=>A.events.some((e)=>e.t==='over')));
/* **On attend l'écriture au lieu de lui laisser six cents millisecondes.**
   La fin d'un duel récompense d'abord les joueurs, écrit ensuite le résultat,
   et les deux passent par la base : un délai fixe est un pari sur la charge de
   la machine. Il était perdu environ une fois sur trois — la table encore
   vide, les bourses à zéro, et trois contrôles rouges qui accusaient le calcul
   des gains alors que rien n'avait encore eu le temps d'être écrit. */
const resultats = async () => (await pool.query(
  'SELECT user_id, outcome, team_id, ferveur FROM duel_results WHERE duel_id = ?',
  [salle.duel.id]))[0];
check('le duel classé est enregistré',
  await until(async () => (await resultats()).length === 2));
const res = await resultats();
check('un gagnant et un perdant',
  res.filter((r)=>r.outcome==='win').length === 1 && res.filter((r)=>r.outcome==='loss').length === 1);


/* --------------------------------------------- ce que le duel a rapporté

   Le duel écrit maintenant de la ferveur, la même que le Grand Virage, et il
   dit pour quel club. Deux règles s'y croisent sur le neutre, et elles se
   compensent exactement : sa ferveur vaut moitié parce qu'il n'est pas chez
   lui, et double parce qu'il est venu tenir le camp que personne ne voulait.
   C'est le sens de tout ce mécanisme — venir pousser ailleurs vaut alors
   autant que rester chez soi, et le match part. */

const ligne = (u) => res.find((r) => r.user_id === u);
const brut = (u) => salle.duel.joueurs.get(u)?.ferveur ?? 0;

check('celui qui suit un club défend ce club', ligne(U[0])?.team_id === 85);
check('le neutre ne défend aucun club', ligne(U[1])?.team_id === null);

check('la ferveur du duel est inscrite', brut(U[0]) > 0 && ligne(U[0])?.ferveur > 0);
check('entière pour qui est chez lui',
  ligne(U[0])?.ferveur === Math.round(brut(U[0])));
check('et la moitié du neutre annule le double du renfort',
  brut(U[1]) > 0 && ligne(U[1])?.ferveur === Math.round(brut(U[1]) * 0.5 * 2)
  || (console.log('        brut', brut(U[1]), '· inscrit', ligne(U[1])?.ferveur), false));

/* ------------------------------------------ le double pour son club

   On peut jouer pour n’importe quel match — c’est ce qui permet de trouver un
   adversaire un mardi de trêve. Mais pousser pour son club doit rester ce qui
   rapporte le plus, sinon suivre une équipe ne veut plus rien dire.

   Le multiplicateur se calcule par joueur et non par duel : ici les deux ont
   vécu le même match, l’un pour son club et l’autre non, et leurs bourses
   doivent le montrer. */

const bourse = async (u) => (await pool.query(
  'SELECT scarves FROM user_wallet WHERE user_id = ?', [u]))[0][0].scarves;
const issue = (u) => res.find((r) => r.user_id === u)?.outcome;
const BAREME = { win: 30, loss: 12 };

const gainA = await bourse(U[0]);
const gainB = await bourse(U[1]);
check(`celui qui suit un club du match touche le double (${gainA})`,
  gainA === BAREME[issue(U[0])] * 2);
check(`l’autre touche le barème simple (${gainB})`,
  gainB === BAREME[issue(U[1])]);


/* -------------------------------------------------- entraînement et bots */

const C = co(U[2]);
await until(()=>C.socket.connected);
C.socket.emit('nvn:queue', { format:'2v2', fixtureId:901, contreBot:true });
check('entraînement ouvert immédiatement', await until(()=>C.state !== null));
check('les places sont tenues par des bots',
  C.state.equipes.flat().length === 4);
check('un entraînement ne compte pas', C.state.mode === 'entrainement');
const avant = C.events.length;
check('les bots jouent', await until(()=>C.events.length > avant, 9000));

/* ---------------------------------------------------------- refus utiles */

const D = co(U[3]);
await until(()=>D.socket.connected);
D.socket.emit('nvn:queue', { format:'9v9', fixtureId:900 });
check('format inconnu refusé', await until(()=>D.errors.includes('ferveur.error.unknown_format')));
D.errors.length = 0;
D.socket.emit('nvn:queue', { format:'1v1', fixtureId:99999 });
check('match inconnu refusé', await until(()=>D.errors.includes('duel.error.fixture_unknown')));

await pool.query('DELETE FROM user_decks WHERE user_id = ?', [U[3]]);
D.errors.length = 0;
D.socket.emit('nvn:queue', { format:'1v1', fixtureId:900 });
check('sans deck, la file est refusée', await until(()=>D.errors.includes('ferveur.error.no_deck')));


/* ============================================ quitter un duel : le forfait

   On pouvait partir sans rien. La salle attendait quatre-vingt-dix secondes,
   retirait le joueur « sans le punir », et le duel continuait à un contre zéro
   jusqu'au temps réglementaire : celui qui restait gagnait en regardant une
   corde immobile pendant trois minutes, celui qui partait ne perdait rien.

   Partir quand ça tourne mal était donc la façon la moins coûteuse de perdre,
   et le duel n'avait plus d'enjeu dès le second but encaissé.

   Trois choses se vérifient ici, et c'est le trio qui compte : le duel se
   **termine**, l'autre camp **gagne**, et le fuyard **ne touche rien** — ni
   écharpes, ni XP. Une sanction qui n'en est pas une vaut mieux annoncée
   qu'appliquée à moitié. */
{
  const E = co(U[2]), F = co(U[3]);
  check('deux nouveaux supporters connectés',
    await until(() => E.socket.connected && F.socket.connected));

  /* Le quatrième duelliste a perdu son deck au contrôle d’avant — celui qui
     vérifie qu’on refuse la file sans deck. On le lui rend : sans lui, le
     duel ne se forme pas et l’échec parle d’autre chose que du forfait. */
  await pool.query(`INSERT INTO user_decks (user_id,nom,contenu) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE contenu = VALUES(contenu)`,
    [U[3], 'Deck', JSON.stringify({ nom: 'Deck',
      fanzzy: [{ id: 'TR32', stuff: [] }, { id: 'MS30', stuff: [] },
               { id: 'TR33', stuff: [] }], actions: dix })]);
  await pool.query('UPDATE user_wallet SET scarves = 0 WHERE user_id IN (?, ?)', [U[2], U[3]]);
  E.socket.emit('nvn:queue', { format: '1v1', fixtureId: 900, camp: 0 });
  F.socket.emit('nvn:queue', { format: '1v1', fixtureId: 900, camp: 1 });
  const partis = await until(() => E.state && F.state, 8000);
  check('leur duel est formé', partis);

  if (partis) {
    E.events.length = 0; F.events.length = 0;
    E.socket.emit('nvn:forfait');

    const fini = await until(() => F.events.some((e) => e.t === 'over'), 6000);
    check('abandonner termine le duel sur-le-champ', fini
      || (console.log('        événements :',
        F.events.map((e) => e.t).join(', ')), false));

    const over = F.events.find((e) => e.t === 'over');
    check('et c’est un forfait, pas une fin au temps', over?.raison === 'forfait'
      || (console.log('        raison :', over?.raison), false));
    /* Le camp resté en place gagne. `side` de F est 1 : c'est lui le vainqueur
       puisque E, du camp 0, est parti. */
    check('celui qui reste gagne le duel', over?.vainqueur === 1
      || (console.log('        vainqueur :', over?.vainqueur), false));

    /* Et les bourses, qui sont la seule preuve qui compte : une fin de duel
       qui annonce un vainqueur sans rien verser serait un message, pas une
       règle. */
    await until(async () => {
      const [[x]] = await pool.query(
        'SELECT scarves FROM user_wallet WHERE user_id = ?', [U[3]]);
      return Number(x?.scarves ?? 0) > 0;
    }, 6000);
    const [[gagnant]] = await pool.query(
      'SELECT scarves FROM user_wallet WHERE user_id = ?', [U[3]]);
    const [[fuyard]] = await pool.query(
      'SELECT scarves FROM user_wallet WHERE user_id = ?', [U[2]]);
    check('le gagnant touche ce qui était prévu', Number(gagnant?.scarves) > 0
      || (console.log('        il touche :', gagnant?.scarves), false));
    check('et celui qui abandonne ne touche rien', Number(fuyard?.scarves) === 0
      || (console.log('        il touche :', fuyard?.scarves), false));
  }
  E.socket.disconnect(); F.socket.disconnect();
}


/* ------------------------ le repli aux bots ne sépare pas ceux qui sont là

 * `ouvrirAvecBots` ne lisait qu'**une** file — celle dont la minuterie venait
 * d'expirer — et remplissait l'autre côté de bots sans regarder qui
 * l'attendait. Sur un 2v2 avec un supporter de chaque côté, elle ouvrait donc
 * un duel à un humain contre trois bots, puis un second à un humain contre
 * trois bots : deux personnes présentes sur le même match, à la même seconde,
 * et aucune n'a joué contre l'autre.
 *
 * C'est le contraire de ce que le repli est censé faire. Il est là pour qu'on
 * puisse jouer quand il n'y a personne, pas pour séparer ceux qui sont venus.
 *
 * On force la bascule en vieillissant les entrées plutôt qu'en attendant vingt
 * secondes : ce qu'on éprouve est le partage, pas la minuterie.
 */
{
  /* Les deux derniers supporters, et pas `U[0]`/`U[1]` : ceux-là jouent
     encore plus haut, et `salleDe` est indexé par joueur — une seconde
     session sur le même identifiant le sort de sa salle. */
  const G = co(U[2]), H = co(U[3]);
  await until(() => G.socket.connected && H.socket.connected);
  G.state = null; H.state = null;

  G.socket.emit('nvn:queue', { format: '2v2', fixtureId: 901, camp: 0 });
  H.socket.emit('nvn:queue', { format: '2v2', fixtureId: 901, camp: 1 });
  const enFile = await until(() => G.file && H.file, 4000);
  check('deux supporters attendent, un de chaque côté', enFile);

  /* La veille bascule au bout du délai. On antidate leur arrivée pour ne pas
     faire durer la suite vingt secondes. */
  for (const f of N.files.values()) for (const x of f) x.depuis = 0;

  const ouvert = await until(() => G.state && H.state, 8000);
  check('le repli les fait jouer ensemble', ouvert
    || (console.log('        G:', Boolean(G.state), 'H:', Boolean(H.state)), false));

  if (ouvert) {
    /* Le même duel, et non deux : c'est l'identifiant qui le dit, pas le fait
       que les deux aient reçu quelque chose. */
    check('et dans le même duel', G.state.id === H.state.id
      || (console.log('        ', G.state.id, 'vs', H.state.id), false));
    check('chacun de son côté', G.state.moi.side !== H.state.moi.side);
    /* Les bots ne bouchent que ce qui reste vraiment vide : deux humains, deux
       machines, et non un humain contre trois machines. */
    const gens = G.state.equipes.flat()
      .filter((p) => !String(p.userId ?? '').startsWith('bot:'));
    check('les bots ne bouchent que les places restées vides', gens.length === 2
      || (console.log('        humains :', gens.length,
        'sur', G.state.equipes.flat().length), false));
  }
  G.socket.disconnect(); H.socket.disconnect();
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
for (const p of [A, B2, C, D]) p.socket.disconnect();
N.stop(); io.close(); http.close(); await pool.end();
process.exit(failures ? 1 : 0);
