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
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';
import { VirageRoom } from '../src/server/ferveur/virage.js';
import { poserReglages, reglagesVivants } from '../src/shared/reglages.js';
import { resoudreGeste, GESTES } from '../src/server/ferveur/gestures.js';
import { ORDRE } from '../src/shared/duel/chants.js';
import { EFFETS_CONNUS } from '../src/server/ferveur/virage.js';
import { ACTIONS, ACTIONS_VIRAGE, ACTION_BY_ID, dansLeVirage }
  from '../src/shared/duel/actions.js';

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
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'tenues.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = ['bbbbbbbb-0000-0000-0000-00000000000' + 1,
           'bbbbbbbb-0000-0000-0000-00000000000' + 2,
           'bbbbbbbb-0000-0000-0000-00000000000' + 3];
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `v${i}@ex.fr`, `Virage${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id, scarves, active_fanzzy) VALUES (?, 100, 'TR32')`, [id]);
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

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, ...OPTIONS_BASE });
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
/* La journée du football, telle que le télétexte la sert. Nulle par défaut :
   la plupart des contrôles n'en ont que faire, et le Virage doit tenir sans
   elle. Le bloc de `/live` la remplit le moment venu. */
let journee = null;
const virage = createVirage({ pool, io, souvenirs, fanzzy,
  requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); },
  jourDuFoot: () => (typeof journee === 'function' ? journee() : journee) });
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

/* Le répertoire n'offre que cinq chants sur douze, et il tourne avec la minute
   du vrai match. Un contrôle qui veut un chant précis règle donc l'horloge sur
   le moment où ce chant est offert — plutôt que d'aller neutraliser la règle
   qu'il est justement censé traverser. */
/* Les chants, écrits ici à la main : le contrôle « ils finissent tous par
   passer » ne veut rien dire s'il lit sa liste de référence dans le fichier
   qu'il contrôle. Cinq se sont ajoutés — les cinq épreuves qui ne sont pas du
   rythme — et cette liste-ci se met à jour à la main aussi. C'est le prix de
   la discipline, et il est bon marché. */
const ORDRE_ATTENDU = ['reprise', 'roulement', 'bache', 'repons', 'renverse',
  'onetaitla', 'damier', 'salves', 'trilage', 'fumigenes', 'contrechant',
  'moulinet', 'craquage', 'montee', 'tension', 'aupoint', 'rebours', 'tenir',
  'mur', 'appel', 'relance', 'cadence'];

/* **La liste écrite à la main est confrontée à celle du jeu.**
 *
 * Elle est écrite ici pour forcer une décision consciente : ajouter un chant
 * doit obliger à venir dire où il se place dans la rotation. Mais elle ne force
 * cette décision que si l'on est prévenu qu'elle a divergé — sinon elle reste
 * vraie sur elle-même et fausse sur le jeu, ce qui est exactement ce qui vient
 * d'arriver avec le tri et le compte. */
{
  const enTrop = ORDRE.filter((id) => !ORDRE_ATTENDU.includes(id));
  const enMoins = ORDRE_ATTENDU.filter((id) => !ORDRE.includes(id));
  check(`la rotation attendue couvre les ${ORDRE.length} chants du jeu`,
    enTrop.length === 0 && enMoins.length === 0
    || (console.log('        absents de la liste :', enTrop.join(', ') || '—'),
      console.log('        inconnus du jeu :', enMoins.join(', ') || '—'),
      console.log('        — dis ici où le nouveau chant se place dans la '
        + 'rotation, puis vérifie qu’il y est bien intercalé'), false));
}

/* Les quinze gestes du jeu, écrits à la main pour la même raison. Le duel les
   fait tourner depuis toujours ; le Virage n'en portait que dix, et **rien ne
   le comptait** — douze chants couvraient dix gestes, et les cinq épreuves
   étaient inatteignables dans le mode où l'on passe quatre-vingt-dix minutes. */
/* **Les gestes attendus sont ceux du jeu**, et non une liste à part.
 *
 * Elle en portait quinze, écrits à la main. Le jeu en a dix-sept depuis que le
 * tri et le compte existent : la liste est restée vraie sur elle-même et fausse
 * sur le jeu, et les deux nouveaux mini-jeux se sont retrouvés injouables au
 * Virage sans qu'un seul contrôle ne rougisse.
 *
 * Une liste écrite à la main force une décision consciente — c'est pour ça
 * qu'elle avait été choisie. Mais elle ne force cette décision que si l'on est
 * prévenu qu'elle a divergé : elle est donc **confrontée** à `GESTES`, et c'est
 * cette confrontation qui rougit le jour où l'on ajoute un geste.
 *
 * L'ordre reste à la main : c'est une décision de jeu — quel geste on rencontre
 * en premier — et elle ne se déduit de rien. */
const GESTES_ATTENDUS = ['tempo', 'mash', 'hold', 'contretemps', 'echo',
  'crescendo', 'relance', 'salves', 'tenue', 'retenue',
  'tifo', 'memoire', 'mosaique', 'echarpe', 'capo', 'tri', 'compte',
  // Les trois épreuves de décision de LA REPRISE : décider, viser, doser.
  'bascule', 'visee', 'jauge'];

{
  const oublies = GESTES.filter((g) => !GESTES_ATTENDUS.includes(g));
  const inventes = GESTES_ATTENDUS.filter((g) => !GESTES.includes(g));
  check(`la liste attendue couvre les ${GESTES.length} gestes du jeu`,
    oublies.length === 0 && inventes.length === 0
    || (console.log('        absents de la liste :', oublies.join(', ') || '—'),
      console.log('        inconnus du jeu :', inventes.join(', ') || '—'),
      console.log('        — un geste sans chant est injouable au Virage : '
        + 'écris-lui le sien dans chants.js'), false));
}

const offrir = (id) => {
  const salle = virage.rooms.get(7001);
  for (let rang = 0; rang < 12; rang++) {
    if (salle.repertoire(rang).includes(id)) {
      salle.minute = rang * 10;
      salle.rangChangeA = 0;      // hors de la bascule : un seul motif admis
      return id;
    }
  }
  throw new Error(`aucun répertoire n’offre le chant « ${id} »`);
};

/* --------------------------------------------------- le répertoire tourne

   Douze chants, cinq offerts à la fois, une fenêtre qui glisse toutes les dix
   minutes de match. C'est ce qui remplace une rangée de douze boutons de vingt
   pixels — et ce qui fait qu'une tribune apprend les douze gestes au lieu d'en
   marteler deux. Chacune des propriétés ci-dessous est une raison d'avoir
   écrit `ORDRE` à la main plutôt que de trier les clés. */
{
  const salle = virage.rooms.get(7001);
  const tous = new Set();
  const tailles = new Set();
  let melange = true, glisse = true;

  const tousGestes = new Set();
  /* On parcourt un tour complet : autant de rangs que de chants. Douze était
     le compte d'alors, pas une propriété — le figer aurait fait passer les
     cinq derniers à la trappe sans qu'un contrôle bouge. */
  for (let rang = 0; rang < ORDRE_ATTENDU.length; rang++) {
    const r = salle.repertoire(rang);
    r.forEach((id) => tous.add(id));
    salle.chantsOfferts(rang).forEach((c) => tousGestes.add(c.gest));
    tailles.add(r.length);
    tailles.add(new Set(r).size);          // cinq chants *distincts*
    const gestes = new Set(salle.chantsOfferts(rang).map((c) => c.gest));
    if (gestes.size < 4) melange = false;
    const suivant = salle.repertoire(rang + 1);
    if (r.filter((id) => suivant.includes(id)).length !== 4) glisse = false;
  }

  check('le répertoire n’offre que cinq chants à la fois',
    [...tailles].every((n) => n === 5));
  check(`mais les ${ORDRE_ATTENDU.length} finissent tous par passer`,
    tous.size === ORDRE_ATTENDU.length && ORDRE_ATTENDU.every((id) => tous.has(id))
    || (console.log('        vus :', tous.size, '· manquants :',
      ORDRE_ATTENDU.filter((id) => !tous.has(id)).join(', ')), false));

  /* Et **les quinze gestes** avec eux. C'est la propriété qui manquait : les
     cinq épreuves — dessiner, se souvenir, allumer, tourner, suivre — étaient
     écrites, éprouvées, jouables en duel, et n'apparaissaient jamais au Virage
     faute d'un chant qui les demande. */
  check(`les ${GESTES_ATTENDUS.length} gestes du jeu passent tous au Virage`,
    GESTES_ATTENDUS.every((g) => tousGestes.has(g))
    || (console.log('        absents :',
      GESTES_ATTENDUS.filter((g) => !tousGestes.has(g)).join(', ')), false));
  /* Sans cette propriété, dix minutes de match pourraient se jouer entièrement
     au martelage : c'est elle, et elle seule, qui justifie l'ordre écrit. */
  check('et cinq chants consécutifs mêlent toujours au moins quatre gestes', melange);
  /* Un répertoire qui changerait entièrement d'un coup ferait perdre à la
     tribune tout ce qu'elle vient d'apprendre. Il n'en change qu'un. */
  check('d’un répertoire au suivant, un seul chant change', glisse);

  const avant = salle.minute;
  salle.minute = 0;
  const r0 = salle.repertoire();
  salle.minute = 10;
  check('et il tourne bien avec la minute du vrai match',
    JSON.stringify(salle.repertoire()) !== JSON.stringify(r0));
  salle.minute = avant;
}

/* Le changement doit être **annoncé** : la page ne reçoit `virage:state` qu'à
   l'entrée, donc sans ce message un supporter garderait jusqu'au coup de
   sifflet final les cinq chants du moment où il est arrivé. */
{
  const repertoires = [];
  A.socket.on('virage:repertoire', (r) => repertoires.push(r));
  virage.matchStatus(7001, { elapsed: 2 });   // on se place, puis on observe
  /* Se placer peut déjà faire tourner le répertoire, et le message met un
     instant à traverser la socket : le vider tout de suite laisserait arriver
     l'annonce d'*avant* dans la fenêtre qu'on s'apprête à observer. */
  await wait(150);
  repertoires.length = 0;
  virage.matchStatus(7001, { elapsed: 4 });
  virage.matchStatus(7001, { elapsed: 7 });
  check('une minute qui ne change pas de répertoire n’annonce rien',
    await until(() => repertoires.length > 0, 300) === false);
  virage.matchStatus(7001, { elapsed: 14 });
  check('mais la bascule est annoncée à toute la tribune',
    await until(() => repertoires.length === 1));
  check('avec les cinq chants nommés',
    (repertoires[0]?.cards ?? []).length === 5
    && repertoires[0].cards.every((c) => c.nom && c.gest));
  /* Le motif de l'écho voyage avec : il appartient à la tribune, qui le chante
     ensemble. La fenêtre, elle, est personnelle et n'a rien à faire ici. */
  check('et le motif d’écho du moment', Number.isInteger(repertoires[0]?.echo?.motif)
    && Array.isArray(repertoires[0]?.echo?.instants));
  check('sans y mêler la fenêtre, qui est propre à chacun',
    repertoires[0]?.echo?.window === undefined);
}

/* Un chant hors répertoire est refusé, et il est refusé **pour cette
   raison-là** : un « carte inconnue » enverrait chercher un bogue là où il n'y
   a qu'une horloge. */
{
  const salle = virage.rooms.get(7001);
  const rang = salle.rangRepertoire();
  const avant = salle.repertoire(rang - 1);
  /* Un chant qu'aucun des deux répertoires voisins n'offre : celui d'avant
     reste admis un court moment, et le prendre pour cible ferait passer ce
     contrôle pour une erreur alors que c'est la règle. */
  const dehors = ORDRE_ATTENDU.find(
    (id) => !salle.repertoire(rang).includes(id) && !avant.includes(id));

  salle.rangChangeA = 0;            // loin de la bascule : un seul répertoire
  A.errors.length = 0;
  A.socket.emit('virage:chant', { cardId: dehors, taps: tempoParfait() });
  check('un chant qui n’est plus au répertoire est refusé',
    await until(() => A.errors.length === 1));
  check('et l’erreur dit que c’est le répertoire',
    A.errors[0] === 'ferveur.error.chant_hors_repertoire');

  /* La tolérance de la bascule, elle aussi, doit exister : un chant commencé
     quatre secondes avant que l'horloge tourne se termine après, et le compter
     faux serait punir le supporter d'une minute qui n'est pas la sienne. */
  salle.rangChangeA = Date.now();
  A.errors.length = 0;
  const sortant = avant.find((id) => !salle.repertoire(rang).includes(id));
  const compte = A.results.length;
  A.socket.emit('virage:chant', { cardId: sortant, taps: tempoParfait() });
  check('mais celui qui vient d’en sortir passe encore, un court instant',
    await until(() => A.results.length > compte) && A.errors.length === 0);
  salle.rangChangeA = 0;
}

A.socket.emit('virage:chant', { cardId: offrir('reprise'), taps: tempoParfait() });
const ok1 = await until(() => A.results.length === 1);
if (!ok1) console.log('  DEBUG erreurs A :', JSON.stringify(A.errors));
check('chant accepté', ok1);
if (!ok1) { console.log('arrêt'); process.exit(1); }
check('la qualité est calculée par le serveur', A.results[0].quality > 0.6);
check('le souffle est débité', A.results[0].breath < 100);
check('la ferveur personnelle monte', A.results[0].ferveur > 0);

const ropeApres = await until(() => A.ticks.some((t) => t.rope < 0));
check('la corde penche du côté de Sion', ropeApres);

C.socket.emit('virage:chant', { cardId: offrir('roulement'), taps: martelage() });
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

  /* **Le plancher de partage est mis de c\u00f4t\u00e9 le temps de ce bloc.**

     La ferveur se partage d\u00e9sormais par `max(virage.tribune_min, effectif)`,
     et cette salle d'\u00e9preuve compte une poign\u00e9e de monde : le plancher y
     mord, et le rapport entre la pouss\u00e9e et la ferveur n'est plus un demi.
     Le contr\u00f4le rougissait en annon\u00e7ant \u00ab la ferveur d'un neutre ne vaut
     pas la moiti\u00e9 \u00bb alors que la r\u00e8gle du neutre \u00e9tait intacte \u2014 il
     mesurait deux r\u00e8gles \u00e0 la fois et nommait la mauvaise.

     Une r\u00e8gle par contr\u00f4le : celui-ci garde le neutre, le plancher a le
     sien juste en dessous. */
  const avantNeutre = reglagesVivants();
  poserReglages({ ...avantNeutre, 'virage.tribune_min': 1 });

  D.socket.emit('virage:chant', { cardId: offrir('roulement'), taps: martelage() });
  const ok = await until(() => D.results.length === 1);
  check('un neutre peut chanter', ok);
  if (ok) {
    check('sa pouss\u00e9e n\u2019est pas rabot\u00e9e', D.results[0].push > 0);
    check('mais sa ferveur ne vaut que la moiti\u00e9 de sa pouss\u00e9e',
      Math.abs(av.ferveur - D.results[0].push * 0.5) <= 1
      || (console.log(`        ferveur ${av.ferveur} pour ${D.results[0].push} de pouss\u00e9e`), false));
  }
  poserReglages(avantNeutre);

  /* ---------------------------------------- le Virage solitaire

     **\u00catre seul \u00e9tait l'\u00e9tat le plus rentable du jeu.** `crowdFactor`
     vaut 1 en dessous de cent personnes, donc ce qu'un supporter touche est
     sa pouss\u00e9e divis\u00e9e par l'effectif : tout entier \u00e0 un, un
     cinquanti\u00e8me \u00e0 cinquante. Arriver le premier sur un match obscur et
     pousser une heure sans personne en face \u2014 la corde ne retombant que de
     1,4 par seconde, les buts s'encha\u00eenent \u2014 rapportait cinquante fois la
     m\u00eame heure pass\u00e9e dans une vraie tribune. Le classement de ferveur
     r\u00e9compensait le contraire de ce que le jeu raconte.

     On \u00e9prouve les **deux moiti\u00e9s** de la r\u00e8gle, parce qu'elles se
     contredisent si on n'y prend pas garde : la corde garde l'effectif r\u00e9el
     \u2014 un match d\u00e9sert doit rester jouable, et arriver t\u00f4t est ce qu'on
     veut encourager \u2014 mais la r\u00e9colte se partage au plancher. */
  {
    const PLANCHER = 10;
    poserReglages({ ...avantNeutre, 'virage.tribune_min': PLANCHER });
    const seul = new VirageRoom({
      fixture: { id: 9931, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
        leagueId: 1, kickoffAt: new Date() },
      emit: () => {}, log: { warn() {}, error() {} },
    });
    const m = { userId: 'u-seul', side: 1, ferveur: 0, mods: {}, neutre: false,
      souffle: 100, lastPush: 0, dernierChant: 0 };
    seul.members.set('u-seul', m);
    const rendu = seul.pousserDepuisCarte(m, 100, Date.now(), []);
    check(`seul, la corde re\u00e7oit la pouss\u00e9e enti\u00e8re (${Math.round(rendu)})`,
      Math.abs(rendu - 100) <= 1);
    check(`mais la ferveur se partage par ${PLANCHER} (${m.ferveur})`,
      Math.abs(m.ferveur - 100 / PLANCHER) <= 1);
    poserReglages(avantNeutre);
  }
}
D.socket.disconnect();

/* ------------------------------------------------------------ triche */

A.socket.emit('virage:chant', { cardId: offrir('reprise'), taps: Array.from({ length: 30 }, (_, i) => i * 20) });
check('frappes inhumaines rejetées',
  await until(() => A.errors.some((e) => e.startsWith('ferveur.error.'))));

A.socket.emit('virage:chant', { cardId: 'inexistante', taps: tempoParfait() });
check('carte inconnue rejetée', await until(() => A.errors.includes('ferveur.error.unknown_card')));

for (let i = 0; i < 15; i++) {
  B.socket.emit('virage:chant', { cardId: offrir('reprise'), taps: tempoParfait() });
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
check('le Fanzzy équipé est gravé dessus', mesA[0].fanzzy_id === 'TR32');
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
 * réjouit parfois d'un but encaissé.
 *
 * ## La journée fait foi
 *
 * La table `fixtures` ne connaît que ce que le guetteur relève, et le guetteur
 * ne relève que les clubs suivis. La liste « ailleurs en direct » en sortait :
 * elle annonçait un 1–0 à la 34e sur une rencontre qui en était à 3–2 à la
 * 83e, et ignorait les matchs que personne ne suit.
 *
 * Le talon ci-dessous met les deux cas dans la même réponse : le match déjà en
 * base, mais plus avancé, et un match que la base ignore. */
{
  journee = {
    groupes: [
      { ligue: { id: 207, name: 'Super League' },
        matchs: [{
          id: 7001, date: new Date().toISOString(), status: '2H',
          elapsed: 83, extra: null, luA: Date.now(), live: true, fini: false,
          home: { id: 85, name: 'FC Sion', logo: '', goals: 3 },
          away: { id: 91, name: 'FC Bâle', logo: '', goals: 2 },
        }] },
      { ligue: { id: 333, name: 'U19 League' },
        matchs: [{
          id: 9100, date: new Date().toISOString(), status: '1H',
          elapsed: 37, extra: null, luA: Date.now(), live: true, fini: false,
          home: { id: 700, name: 'Metalist 1925 U19', logo: '', goals: 1 },
          away: { id: 701, name: 'Zhytomyr U19', logo: '', goals: 1 },
        }] },
    ],
  };

  const r = await fetch(`${url}/api/virage/live`).then((x) => x.json());
  const par = (id) => (r.matchs ?? []).find((m) => Number(m.id) === id);
  const m = par(7001);

  check('/live nomme les deux équipes par leur identifiant',
    typeof m?.home_id === 'number' && typeof m?.away_id === 'number');
  check('et donne le score et la minute',
    'home_goals' in (m ?? {}) && 'elapsed' in (m ?? {}));

  check('le score vient de la journée, pas de la ligne en base',
    m?.home_goals === 3 && m?.away_goals === 2
    || (console.log('        il dit :', m?.home_goals, '–', m?.away_goals), false));
  check('et la minute aussi', m?.elapsed === 83);
  check('la compétition est nommée', m?.league_name === 'Super League');

  const autre = par(9100);
  check('un match que la base ignore paraît quand même', Boolean(autre));
  check('avec son score et sa compétition',
    autre?.home_goals === 1 && autre?.league_name === 'U19 League');
  check('et il est ouvert, puisqu’il se joue', autre?.open === true);
  check('mais ce n’est pas chez moi', autre?.mien === false);


  /* ------------------------ entrer dans un match que la base ignore

     Le contrôle du dessus prouve que le match **paraît** dans la liste. Le
     joueur, lui, touchait son camp et il ne se passait rien : `roomFor` ne lit
     que `fixtures`, la ligne n'existait pas, `virage:join` répondait
     `no_fixture`, et la page l'écrivait tout en bas de l'écran, hors du champ
     de vision.

     Une liste qui propose plus large que la porte n'ouvre est pire qu'une
     liste courte : elle promet, et elle referme sans le dire. Voir
     `poserDepuisLaJournee`. */
  /* Un supporter à lui, et non `U[0]` : `roomOfUser` est indexé par joueur,
     donc réutiliser A l'aurait déplacé de salle — et le contrôle du départ,
     cent lignes plus bas, serait devenu rouge pour une raison sans rapport. */
  const E = connect('bbbbbbbb-0000-0000-0000-000000000008');
  await until(() => E.socket.connected);
  E.socket.emit('virage:join', { fixtureId: 9100, camp: 'exterieur' });
  const entre = await until(() => E.state?.fixture?.id === 9100, 4000);
  check('on entre vraiment dans un match que la base ignorait', entre
    || (console.log('        refus :', E.errors.join(', ') || '(silence)'), false));

  if (entre) {
    check('la salle nomme les deux clubs',
      E.state.fixture.homeName === 'Metalist 1925 U19'
      && E.state.fixture.awayName === 'Zhytomyr U19');
    check('et le camp choisi est respecté', E.state.you.side === 1);
    /* La ligne est **écrite**, pas seulement montée en mémoire : la présence
       au virage, les classements par compétition et le guetteur retombent
       tous sur `fixtures`. Une salle sans ligne aurait marché à l'écran et
       perdu tout ce qui en sort. */
    const [[f]] = await pool.query(
      'SELECT league_id, home_id, away_id, status_short FROM fixtures WHERE id = 9100');
    check('et le match est désormais connu de la base', Boolean(f)
      || (console.log('        rien en base pour 9100'), false));
    check('avec sa compétition et ses deux clubs',
      f?.league_id === 333 && f?.home_id === 700 && f?.away_id === 701);
  }
  E.socket.disconnect();

  /* Une panne du télétexte ne doit pas vider l'écran : on retombe sur la base,
     c'est-à-dire sur ce qu'on avait avant — incomplet, jamais rien. */
  journee = () => { throw new Error('télétexte injoignable'); };
  const repli = await fetch(`${url}/api/virage/live`).then((x) => x.json());
  check('sans la journée, la liste tient encore sur la base',
    (repli.matchs ?? []).some((x) => Number(x.id) === 7001));
  journee = null;
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

/* ================================= les cartes d'action au Virage =========

   Le Virage joue les cartes qui agissent sur soi ou sur sa tribune. Ce banc
   travaille sur la salle directement — pas de socket, pas de base : ce qu'on
   veut savoir ici, c'est si une carte fait ce qu'elle dit, et une salle est
   déterministe quand on lui donne son horloge.
   ===================================================================== */
{
  const salle = new VirageRoom({
    fixture: { id: 9001, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
    emit: () => {}, log: { warn() {}, error() {} },
  });
  const toutes = ACTIONS_VIRAGE.map((a) => a.id);
  salle.join('c1', { side: 0, name: 'Un', actions: toutes });
  salle.join('c2', { side: 0, name: 'Deux', actions: toutes });
  const m = salle.members.get('c1');

  /* La main ne contient que des cartes jouables ici. On donne au deck les
     vingt et une cartes du jeu — y compris celles qui restent au duel — et on
     vérifie que la salle a fait le tri elle-même. */
  salle.join('c3', { side: 1, name: 'Trois', actions: ACTIONS.map((a) => a.id) });
  const m3 = salle.members.get('c3');
  const duel = new Set(ACTIONS.filter((a) => !dansLeVirage(a)).map((a) => a.id));
  check('la main du Virage est tirée du deck', m3.main.length === 5);
  check('et aucune carte de duel n’y entre',
    ![...m3.main, ...m3.pioche].some((id) => duel.has(id)));

  /* **Et elle dit combien sont restées dehors.**

     Le tri se faisait en silence : le joueur voyait une carte et quatre
     cases vides, et il en a conclu que ses cartes ne se rechargeaient pas.
     La rangée du Virage s'explique maintenant, et elle ne le peut que si ce
     nombre lui parvient. */
  check('et la salle dit combien sont restées au duel', m3.ecartees === duel.size);
  /* **Les cartes nommées, et non leur nombre.**
   *
   * Ce contrôle disait `duel.size === 7`. Un nombre ne dit rien de ce qu'il
   * compte : il rougit dès qu'on ajoute une carte, quelle qu'elle soit, et il
   * se répare en écrivant 8 — ce qui ne vérifie plus rien du tout.
   *
   * La liste, elle, force une décision : ajouter une carte qui vise l'adversaire
   * oblige à venir l'écrire ici, donc à se demander si elle a sa place au
   * Virage. C'est exactement la question que ce contrôle existe pour poser. */
  const RESTENT_AU_DUEL = ['a-silence', 'a-brouillard', 'a-parcage', 'a-vol',
    'a-vent', 'a-bache', 'a-miroir', 'a-retournement',
    /* LA REPRISE. Les trois visent quelqu'un, et au Virage il n'y a personne
       en face : la « Rouille » affaiblit les gestes de l'adversaire, le
       « Hors-jeu » lui verrouille la main, et la « Bâche neuve » attend sa
       prochaine poussée. Dans une salle où trois cents personnes poussent en
       continu, cette prochaine poussée n'est pas un événement — c'est du bruit
       de fond, et la carte n'aurait pas de moment. Même raison que « Bâche »,
       juste au-dessus.

       Les sept autres de la saison entrent, elles : elles n'agissent que sur
       celui qui les joue ou sur sa tribune. */
    'a-rp-rouille', 'a-rp-horsjeu', 'a-rp-bache-neuve',

    /* **Ces deux-là ne visent personne : elles n'ont pas d'objet.**

       L'Arbitre fait entrer quelqu'un du banc, la Relève fait grandir un
       personnage en cours de partie. Le Virage met un seul personnage en
       tribune et n'a pas de banc — il n'y a ni remplaçant à appeler, ni
       évolution à déclencher.

       Elles étaient acceptées et traitées en « sans objet » : la carte
       partait de la main, coûtait son souffle, et ne faisait rien. Un deck
       de Virage pouvait porter deux cartes mortes sur dix sans que rien ne
       le signale. Voir `SANS_OBJET_AU_VIRAGE` dans `shared/duel/actions.js`. */
    'a-arbitre', 'a-releve'];

  /* **Toute carte jouable ici a un effet que le moteur sait rendre.**

     C'est le contrôle qui manquait, et son absence a coûté cher. Cinq cartes
     étaient déclarées jouables au Virage — leur portée dit `soi`, ce qui est
     exact — et le `switch` du moteur ne les connaissait pas. Elles tombaient
     dans son `default`, qui lève ; or ce `throw` arrivait **après** que le
     souffle ait été débité et la carte retirée de la main.

     Le joueur payait, perdait sa carte, et lisait une erreur. C'est ce qui
     lui a fait signaler « cette carte n'est plus dans ta main » et « les
     cartes ne se rechargent pas » — deux symptômes d'une seule faute.

     Rien ne pouvait l'attraper : les deux listes vivent dans deux fichiers
     et personne ne les comparait. Ce contrôle les compare. */
  const sansMoteur = ACTIONS_VIRAGE.filter((a) => !EFFETS_CONNUS.has(a.effet?.type));
  check('chaque carte du Virage a un effet que le moteur sait rendre'
    + (sansMoteur.length ? ' — sans moteur : '
      + sansMoteur.map((a) => a.id + ' → ' + a.effet?.type).join(', ') : ''),
    sansMoteur.length === 0);
  const ecart = [
    ...RESTENT_AU_DUEL.filter((id) => !duel.has(id)).map((id) => `+${id}`),
    ...[...duel].filter((id) => !RESTENT_AU_DUEL.includes(id)).map((id) => `-${id}`),
  ];
  check('les cartes qui traversent restent au duel, et ce sont celles-là',
    ecart.length === 0
    || (console.log('        écart :', ecart.join(' ')),
      console.log('        — une carte qui vise l’adversaire n’entre pas au '
        + 'Virage : dis-le ici si c’est voulu'), false));

  /* Une carte de duel forcée dans la main est refusée, et le refus nomme sa
     cause. C'est le filet contre le client modifié. */
  m.main = ['a-silence']; m.breath = 100;
  let refus = null;
  try { salle.jouer('c1', 'a-silence'); } catch (e) { refus = e.code; }
  check('une carte de duel forcée dans la main est refusée',
    refus === 'ferveur.error.card_not_in_virage');

  /* Une poussée bouge la corde, du côté de celui qui l'a jouée. La tribune de
     `c1` est à domicile : chez elle, pousser rend la corde négative. */
  const forcer = (id) => { m.main = [id]; m.breath = 100; m.cooldowns = {}; };
  forcer('a-fumigene');
  salle.rope = 0;
  const ev = salle.jouer('c1', 'a-fumigene');
  check('un Fumigène pousse la corde du bon côté', salle.rope < 0);
  check('la salle l’annonce comme une action',
    ev.some((e) => e.t === 'action' && e.cardId === 'a-fumigene'));

  /* La poussée d'une carte est **divisée par l'effectif**, exactement comme un
     chant. C'est la règle qui tient tout le Virage : le nombre aide, il ne
     décide pas. Sans elle, un Fumigène dans une salle de mille vaudrait mille
     fois ce qu'il vaut dans une salle de dix, et il n'y aurait plus aucune
     raison de chanter.
     
     Une première version comparait les deux salles et attendait un résultat
     « du même ordre » — c'est-à-dire exactement ce que produit une carte qui
     **échappe** à la division. Le contrôle était vert dans les deux cas. On
     mesure donc le rapport : dix fois plus de monde, dix fois moins par tête. */
  {
    const pousseeDe = (id, n) => {
      const x = new VirageRoom({
        fixture: { id, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
        emit: () => {}, log: { warn() {}, error() {} } });
      for (let i = 0; i < n; i++) {
        x.join(`p${i}`, { side: 0, name: `P${i}`, actions: ['a-fumigene'] });
        // Actif dans la foule : sans ça `crowd()` ne les compte pas.
        x.members.get(`p${i}`).lastPush = Date.now();
      }
      const p0 = x.members.get('p0');
      p0.main = ['a-fumigene']; p0.breath = 100; p0.cooldowns = {};
      x.rope = 0;
      x.jouer('p0', 'a-fumigene');
      return Math.abs(x.rope);
    };
    const petite = pousseeDe(9002, 4);
    const grande = pousseeDe(9003, 40);
    const rapport = petite / grande;
    const divise = grande > 0 && rapport > 8 && rapport < 12;
    check('une carte est divisée par l’effectif, comme un chant', divise);
    if (!divise) {
      console.log(`        4 membres ${petite.toFixed(2)} · 40 membres ${grande.toFixed(2)}`
        + ` · rapport ${rapport.toFixed(2)} (attendu ≈ 10)`);
    }
  }

  /* La recharge, et le fait qu'elle soit plus longue qu'au duel : une salle
     dure quatre-vingt-dix minutes, un duel cinq. */
  forcer('a-fumigene');
  salle.jouer('c1', 'a-fumigene');
  m.main = ['a-fumigene']; m.breath = 100;
  refus = null;
  try { salle.jouer('c1', 'a-fumigene'); } catch (e) { refus = e.code; }
  check('une carte à peine jouée se recharge', refus === 'ferveur.error.card_on_cooldown');
  check('et la recharge du Virage est plus longue que celle du duel',
    m.cooldowns['a-fumigene'] - Date.now() > ACTION_BY_ID.get('a-fumigene').cd * 1000);

  /* Un refus nomme sa cause : « pas assez de souffle » et non « impossible ». */
  m.main = ['a-craquage']; m.breath = 3; m.cooldowns = {};
  refus = null;
  try { salle.jouer('c1', 'a-craquage'); } catch (e) { refus = e.code; }
  check('sans souffle, la carte est refusée pour cette raison-là',
    refus === 'ferveur.error.not_enough_breath');

  /* Collecte : le souffle va à toute la tribune, et à elle seule. */
  {
    const allie = salle.members.get('c2');
    const enFace = salle.members.get('c3');
    m.main = ['a-collecte']; m.breath = 100; m.cooldowns = {};
    allie.breath = 10; enFace.breath = 10;
    salle.jouer('c1', 'a-collecte');
    check('la Collecte remplit le souffle du coéquipier', allie.breath > 10);
    check('et pas celui d’en face', enFace.breath === 10);
  }

  /* Appel du capo : une fenêtre pour la tribune. Ce n'est pas la carte qui
     pousse, c'est le chant des autres pendant la fenêtre — on vérifie donc
     l'effet là où il se produit, et pas au moment où la carte part. */
  {
    m.main = ['a-appel']; m.breath = 100; m.cooldowns = {};
    salle.rallies = [];
    const evA = salle.jouer('c1', 'a-appel');
    check('l’Appel du capo ouvre une fenêtre pour la tribune',
      salle.rallies.length === 1 && salle.rallies[0].side === 0);
    check('et la salle en est prévenue', evA.some((e) => e.t === 'rally'));

    const chanterParfait = (qui) => {
      const x = salle.members.get(qui);
      x.breath = 100;
      salle.rope = 0;
      /* `beats`, et pas `need` : le barème nomme ses pulsations `beats`, et une
         clé inventée donnait un tableau vide — donc zéro frappe, zéro note,
         zéro poussée des deux côtés, et un contrôle qui comparait deux zéros. */
      const g = resoudreGeste(x.mods).tempo;
      const taps = Array.from({ length: g.beats }, (_, i) => Math.round(i * g.interval));
      salle.chant(qui, { cardId: offrir('reprise'), taps });
      return Math.abs(salle.rope);
    };
    const dedans = chanterParfait('c2');
    salle.rallies = [];
    const dehors = chanterParfait('c2');
    const plus = dedans > dehors * 1.15;
    check('un chant dans la fenêtre du capo pousse plus qu’en dehors', plus);
    if (!plus) console.log(`        dedans ${dedans.toFixed(1)} · dehors ${dehors.toFixed(1)}`);
  }

  /* Mosaïque : ne vaut rien seul. C'est écrit sur la carte, et c'est ce qui la
     rend intéressante — on vérifie donc le cas où personne ne suit. */
  {
    const seul = new VirageRoom({
      fixture: { id: 9004, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
      emit: () => {}, log: { warn() {}, error() {} } });
    seul.join('s1', { side: 0, name: 'Seul', actions: ['a-mosaique'] });
    const x = seul.members.get('s1');
    x.main = ['a-mosaique']; x.breath = 100; x.cooldowns = {};
    seul.rope = 0;
    const evM = seul.jouer('s1', 'a-mosaique');
    check('la Mosaïque ne pousse pas quand personne ne suit', seul.rope === 0);
    check('et elle dit combien ont suivi',
      evM.some((e) => e.t === 'effect' && e.type === 'per_mate' && e.mates === 0));
  }

  /* Le Métronome élargit la fenêtre de tempo, et l'état le dit à la page.
     Sans ça la carte coûtait du souffle et la page dessinait l'ancienne
     pulsation : le joueur tapait à côté sans jamais comprendre pourquoi. */
  {
    m.main = ['a-metronome']; m.breath = 100; m.cooldowns = {}; m.effets = [];
    const avant = salle.snapshotFor('c1').you.gestes.tempo.window;
    salle.jouer('c1', 'a-metronome');
    const apres = salle.snapshotFor('c1').you.gestes.tempo.window;
    check('le Métronome élargit la fenêtre de tempo', apres > avant);
    check('et l’état l’annonce à la page pour qu’elle la dessine',
      salle.snapshotFor('c1').you.effets.some((e) => e.type === 'mod_self'));
  }

  /* La main se remplit toute seule, avec un temps de retard : jouer coûte
     aussi du choix. */
  {
    m.main = ['a-fumigene', 'a-thermos']; m.breath = 100; m.cooldowns = {};
    m.pioche = ['a-torche']; m.remplirA = 0;
    salle.jouer('c1', 'a-fumigene');
    salle.entretenirCartes(Date.now());
    check('la carte suivante n’arrive pas tout de suite', m.main.length === 1);
    salle.entretenirCartes(Date.now() + 9999);
    check('mais elle arrive', m.main.length === 2 && m.main.includes('a-torche'));
  }

  /* Rejoindre à nouveau ne redistribue pas la main : ce serait un moyen gratuit
     de se débarrasser d'une recharge. */
  {
    const avant = [...m.main];
    const cd = { ...m.cooldowns };
    salle.join('c1', { side: 0, name: 'Un', actions: toutes });
    check('revenir dans la salle ne redistribue pas la main',
      JSON.stringify(salle.members.get('c1').main) === JSON.stringify(avant));
    check('et n’efface pas les recharges',
      JSON.stringify(salle.members.get('c1').cooldowns) === JSON.stringify(cd));
  }

  /* Changement de chant : on jette la main et on en reprend cinq. Ce qu'on
     jette doit revenir dans la pioche — sinon la carte serait un moyen lent de
     vider son propre deck, et le dernier quart d'heure se jouerait à mains
     nues. On contrôle donc les deux moitiés : la main est pleine, ET le compte
     total de cartes n'a pas bougé. */
  {
    m.main = ['a-relais', 'a-fumigene', 'a-thermos'];
    m.pioche = ['a-torche', 'a-tambour', 'a-bache', 'a-cloche', 'a-drapeau'];
    m.defausse = ['a-silence'];
    m.breath = 100; m.cooldowns = {}; m.effets = [];
    const avantTotal = m.main.length + m.pioche.length + m.defausse.length;
    const avantMain = [...m.main];
    salle.jouer('c1', 'a-relais');
    check('le Changement de chant rend une main pleine',
      m.main.length === 5);
    /* Il restait deux cartes en main après avoir posé le Relais : une main de
       cinq contient donc forcément du neuf. On le dit ainsi plutôt qu'en
       comptant les cartes communes — un tirage peut légitimement ramener une
       ancienne, et un contrôle qui dépend du hasard finit par mentir. */
    check('et il y a forcément du neuf dedans',
      m.main.some((c) => !avantMain.includes(c)));
    /* Ce qu'on jette revient : la carte renouvelle la main, elle ne vide pas
       le deck. La carte posée elle-même est partie en défausse avant l'effet,
       donc elle rentre dans le compte — le total ne bouge pas d'une carte. */
    check('sans perdre une seule carte au passage',
      m.main.length + m.pioche.length + m.defausse.length === avantTotal
      || (console.log(`        ${avantTotal} avant, `
        + `${m.main.length + m.pioche.length + m.defausse.length} après`), false));
    check('et la main n’attend pas un remplissage en plus', m.remplirA === 0);
  }

  /* Nouveau souffle : toutes les recharges tombent d'un coup. Au Virage elles
     durent une fois et demie celles du duel, donc la carte y vaut plus cher —
     raison de plus pour vérifier qu'elle fait bien son travail ici aussi. */
  {
    m.main = ['a-fumigene']; m.breath = 100; m.cooldowns = {}; m.effets = [];
    salle.jouer('c1', 'a-fumigene');
    const enRecharge = Object.values(m.cooldowns).filter((f) => f > Date.now()).length;
    m.main = ['a-souffleneuf']; m.breath = 100;
    salle.jouer('c1', 'a-souffleneuf');
    check('avant le Nouveau souffle, une carte était bien en recharge',
      enRecharge > 0);
    check('et après, plus aucune ne l’est',
      Object.values(m.cooldowns).filter((f) => f > Date.now()).length === 0);
  }

  /* Le Tifo s'arme, se voit, puis frappe. Les trois moments comptent : s'il
     poussait à la pose, il ne serait qu'un fumigène cher ; s'il ne poussait
     jamais, il ne serait rien. Et il passe par le chemin ordinaire, donc il
     est divisé par l'effectif comme tout le reste. */
  {
    m.main = ['a-tifo']; m.breath = 100; m.cooldowns = {}; m.effets = [];
    salle.differes = [];
    const corde0 = salle.rope;
    const evT = salle.jouer('c1', 'a-tifo');
    check('le Tifo ne pousse pas quand on le pose', salle.rope === corde0);
    check('mais il s’annonce à tout le stade',
      evT.some((e) => e.t === 'arme') && salle.differes.length === 1);
    salle.entretenirCartes(Date.now() + 4000);
    check('à mi-parcours il n’a toujours rien fait', salle.rope === corde0);
    salle.entretenirCartes(Date.now() + 9000);
    check('puis il se déplie et pousse', salle.rope !== corde0);
    check('et il ne pousse qu’une fois', salle.differes.length === 0);
  }

  /* Sans deck, on entre quand même. Le Virage s'est joué au chant seul pendant
     tout ce temps, et il doit continuer de s'ouvrir à qui n'a rien construit. */
  {
    const nu = salle.join('c9', { side: 0, name: 'Nu' });
    check('sans deck, la salle s’ouvre quand même', nu.you !== null);
    check('et la main est simplement vide', nu.you.main.length === 0);
  }
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
for (const p of [B, C]) p.socket.disconnect();
virage.stop(); io.close(); http.close(); await pool.end();
process.exit(failures ? 1 : 0);
