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
import { VirageRoom, RULES, crowdFactor } from '../src/server/ferveur/virage.js';
import { poserReglages, reglagesVivants, reglage } from '../src/shared/reglages.js';
import { resoudreGeste, GESTES } from '../src/server/ferveur/gestures.js';
import { ORDRE } from '../src/shared/duel/chants.js';
import { EFFETS_CONNUS } from '../src/server/ferveur/virage.js';
import { ACTIONS, ACTIONS_VIRAGE, ACTION_BY_ID, dansLeVirage }
  from '../src/shared/duel/actions.js';
import { createNiveau } from '../src/server/niveau/index.js';
import { createPresence } from '../src/server/presence/index.js';
import { createBilan } from '../src/server/ferveur/bilan.js';
import { AVATAR_PUBLIC } from '../src/server/fanzzy/avatar.js';
import { grade } from '../src/server/ferveur/gestures.js';
import { enParallele, figerHorloge } from './base-de-test.mjs';

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
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, recompenses, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'tenues.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
/* Les colonnes des chants, **prises dans `sql/quotidien.sql`** et non
   réécrites ici : la suite éprouve le schéma qu'on déploie.

   Seulement ses trois `ALTER TABLE virage_presence`, et c'est voulu. Le
   fichier complète aussi `saisons` ; l'appliquer en entier demanderait
   `saisons.sql`, dont la saison d'amorce change les séries ouvertes que lit
   le catalogue, donc le Virage que tout ce qui suit éprouve. `souvenirs-smoke`
   applique le fichier entier, lui, et éprouve le repli quand il manque.

   Le tri se fait au motif : le contrôle juste en dessous exige les trois
   colonnes en base, pour qu'un fichier qui changerait de forme fasse rougir
   la suite au lieu de la laisser compter sur rien. */
const CHANTS_SQL = readFileSync(new URL('../sql/quotidien.sql', import.meta.url), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => /^ALTER TABLE virage_presence ADD COLUMN/i.test(l));
for (const instruction of CHANTS_SQL) await raw.query(instruction);
{
  const [cols] = await raw.query(
    `SELECT column_name AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'virage_presence'
        AND column_name IN ('chants', 'chants_mt1', 'chants_mt2')`);
  check('sql/quotidien.sql pose les trois colonnes des chants',
    CHANTS_SQL.length === 3 && cols.length === 3
    || (console.log(`        ${CHANTS_SQL.length} instruction(s), ${cols.length} colonne(s)`), false));
}
/* **La vague 2, telle qu'on la déploie.** `arenes.sql` entier (les PARFAITS,
   la série, le meilleur geste, l'index du bilan, le choix de présence) ;
   `niveau.sql` pour l'XP ; et, pris dans leurs fichiers au motif, le grand
   livre (`recompenses`, de `quotidien.sql`) et les amitiés (`amities`, de
   `amis.sql`) — sans le reste de ces fichiers, qui demanderait les saisons et
   les KOP, que ce banc n'éprouve pas. */
{
  const sql = (f) => readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8');
  await raw.query(sql('arenes.sql'));
  await raw.query(sql('niveau.sql'));
  const table = (f, nom) => new RegExp(`CREATE TABLE IF NOT EXISTS ${nom} \\([\\s\\S]*?\\) ENGINE[^;]*;`)
    .exec(sql(f))?.[0];
  const recompenses = table('quotidien.sql', 'recompenses');
  const amities = table('amis.sql', 'amities');
  check('le grand livre et les amitiés se prennent dans leurs fichiers',
    Boolean(recompenses && amities) || (console.log('        motif introuvable'), false));
  if (recompenses) await raw.query(recompenses);
  if (amities) await raw.query(amities);
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
/* Les matchs de la vague 2, un par bloc : le bilan lit la ligne de présence
   d'un match, et deux blocs sur le même se compteraient l'un l'autre. */
for (const id of [7101, 7102, 7103, 7105, 7106, 7107, 7108, 7109, 7110, 7111,
                 7112, 7113, 7114, 7115]) {
  await raw.query(`INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,
                                         home_goals,away_goals,elapsed,kickoff_at)
                   VALUES (?,207,2026,85,91,'2H',0,0,60,UTC_TIMESTAMP())`, [id]);
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, ...OPTIONS_BASE });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);

/** Des joueurs de plus, avec leur bourse : `prefixe-0001`… Le Fanzzy, s'il est donné, est équipé. */
async function creerJoueurs(prefixe, n, { fanzzy = null } = {}) {
  const ids = Array.from({ length: n }, (_, i) => `${prefixe}-${String(i + 1).padStart(4, '0')}`);
  for (const id of ids) {
    await pool.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
      [id, `${id}@ex.fr`, id.slice(0, 20)]);
    await pool.query(`INSERT INTO user_wallet (user_id, scarves, active_fanzzy) VALUES (?, 0, ?)`,
      [id, fanzzy]);
  }
  return ids;
}

/** Une ligne de présence, écrite comme le serveur l'écrit, avec ce qu'on veut y lire. */
async function semer(userId, fixtureId, o = {}) {
  const l = { side: 0, team_id: 85, ferveur: 0, classe: 1, chants: 0, parfaits: 0, serie_max: 0,
    meilleur_q: 0, meilleur_chant: null, ...o };
  await pool.query(
    `INSERT INTO virage_presence (user_id, fixture_id, side, team_id, ferveur, classe, chants,
                                  parfaits, serie_max, meilleur_q, meilleur_chant)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [userId, fixtureId, l.side, l.team_id, l.ferveur, l.classe, l.chants, l.parfaits,
      l.serie_max, l.meilleur_q, l.meilleur_chant]);
}

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
/* Le module niveau, pour l'XP du match, et la présence, éteinte comme à la
   livraison : le bloc des amis l'allume le temps de ses contrôles. */
const niveau = createNiveau({ pool, requireAuth: (_q, _r, n) => n() });
const presence = createPresence({ pool, requireAuth: (_q, _r, n) => n() });
/* La présence telle que le Virage la voit : la vraie, dont on note les appels.
   L'ordre des deux lectures d'une entrée est un contrat entre les deux
   modules — `aPrevenir` relit en mémoire la liste d'amis qu'`amisPresents`
   vient de lire, et ne lit le choix de l'entrant que s'il a un ami présent
   (`ferveur/index.js`, `annoncerArrivee`). */
const appelsPresence = [];
/* Une lecture qu'on retient pour un joueur : la promesse à attendre avant de
   lire. C'est ainsi qu'on laisse une entrée se faire dépasser par la suivante. */
const retenues = new Map();
const presenceVue = { ...presence };
for (const f of ['amisPresents', 'aPrevenir']) {
  presenceVue[f] = async (userId, ids) => {
    appelsPresence.push({ f, t: 'debut', id: String(userId) });
    try {
      await retenues.get(String(userId));
      return await presence[f](userId, ids);
    } finally { appelsPresence.push({ f, t: 'fin', id: String(userId) }); }
  };
}
const virage = createVirage({ pool, io, souvenirs, fanzzy, niveau, presence: presenceVue,
  requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); },
  jourDuFoot: () => (typeof journee === 'function' ? journee() : journee) });
presence.brancher({ estAuVirage: virage.estAuVirage, estEnDuel: () => false });
app.use('/api/virage', virage.router);
await new Promise((r) => http.listen(0, r));
const url = `http://localhost:${http.address().port}`;

function connect(userId) {
  const socket = client(url, { transports: ['websocket'], auth: { token: userId } });
  const p = { socket, state: null, ticks: [], results: [], errors: [],
              realGoals: [], goals: [], fils: [],
              // La vague 2 : ce que la salle dit à chacun, et ce qu'elle ne doit pas dire.
              souvenirs: [], bilans: [], fins: [], fermes: [], amis: [], ami: [], crowds: [] };
  socket.on('virage:state', (s) => { p.state = s; });
  socket.on('virage:tick', (t) => p.ticks.push(t));
  socket.on('virage:result', (r) => p.results.push(r));
  socket.on('virage:error', (e) => p.errors.push(e.code));
  socket.on('virage:real_goal', (g) => p.realGoals.push(g));
  socket.on('virage:goal', (g) => p.goals.push(g));
  socket.on('virage:fil', (f) => p.fils.push(f));
  socket.on('virage:souvenir', (x) => p.souvenirs.push(x));
  socket.on('virage:bilan', (x) => p.bilans.push(x));
  socket.on('virage:fin', (x) => p.fins.push(x));
  socket.on('virage:ferme', (x) => p.fermes.push(x));
  socket.on('virage:amis', (x) => p.amis.push(x));
  socket.on('virage:ami', (x) => p.ami.push(x));
  socket.on('virage:crowd', (x) => p.crowds.push(x));
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
  'onetaitla', 'vague', 'damier', 'salves', 'trilage', 'fumigenes', 'contrechant',
  'renvoi', 'moulinet', 'craquage', 'montee', 'tension', 'aupoint', 'pluie',
  'rebours', 'tenir', 'mur', 'canon', 'appel', 'relance', 'cadence'];

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
  'bascule', 'visee', 'jauge',
  // Les quatre de l'automne 2026 : anticiper, retourner, compenser, dédoubler.
  'ola', 'miroir', 'rouleaux', 'deuxvoix'];

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

/* **Le but de Diallo, à la 23e, était au tableau quand la salle a ouvert** —
   1–0 à la 34e. Le relevé peut l'apporter en retard, avec son score : l'API
   publie le score avant l'événement, ou le télétexte a rangé le score avant
   le tour du direct. Il sonnait alors « GOAL ! » pour toute la tribune,
   ouvrait la minute double et ramenait la minute à 23. Le vrai chemin, celui
   de `ferveur/index.js` ; le but sans score, juste après, sert de témoin :
   les mêmes sockets l'entendent. (Correctif d'urgence du 4 octobre 2026,
   reporté au lot 6.) */
{
  const salle = virage.rooms.get(7001);
  const minute = salle.minute, surge = salle.surgeUntil;
  const score = JSON.stringify(salle.scoreReel), fil = salle.fil.length;
  const dit = virage.realGoal({ fixtureId: 7001, teamId: 85, minute: 23, player: 'Diallo',
    score: [1, 0] });
  await wait(200);
  check('un but qui était au tableau à l’ouverture ne sonne pas',
    dit === false && A.realGoals.length === 0 && C.realGoals.length === 0
    || (console.log(`        rendu ${dit} · ${A.realGoals.length} annonce(s)`), false));
  /* La corde n'est pas comparée ici : l'horloge commune la fait retomber
     pendant l'attente. La salle seule, plus bas, la lit sans horloge. */
  check('ni minute double, ni minute, ni score, ni fil qui bougent',
    salle.surgeUntil === surge && salle.minute === minute
    && JSON.stringify(salle.scoreReel) === score && salle.fil.length === fil);
}

const avant = A.state.rope;
const annonce = virage.realGoal({ fixtureId: 7001, teamId: 85, minute: 23, player: 'Diallo' });
check('but réel diffusé à toute la salle',
  await until(() => A.realGoals.length === 1 && C.realGoals.length === 1));
// Sans score, rien ne le date : la salle l'annonce, et le dit.
check('et la salle dit l’avoir annoncé', annonce === true);
check('le but secoue la corde du bon côté', A.realGoals[0].side === 0);
/* La durée part à côté de l'instant : une horloge de téléphone en avance
   lirait `surgeUntil` de travers, et le compte à rebours part de `surgeMs`. */
check('et dit combien de temps dure la minute double',
  A.realGoals[0].surgeMs > 0 && A.realGoals[0].surgeMs <= 60_000);
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

  /* D1 \u2014 **mais pas une salle dont le match est fini.** Elle restait au
     relev\u00e9 tant qu'un onglet \u00e9tait ouvert, et payait un relev\u00e9 du direct et
     un relev\u00e9 d'\u00e9v\u00e9nements \u00e0 chaque tour, jour et nuit : 1 440 appels par
     jour et par salle. Le vrai chemin, celui du relev\u00e9 qui apprend le coup de
     sifflet ; puis on rend \u00e0 la salle son statut, la suite rejoue un match en
     cours. */
  const statutAvant = salle.statut;
  virage.matchStatus(7001, { status: 'FT' });
  check('une salle dont le match est fini sort du relev\u00e9',
    !virage.sallesOccupees().includes(7001));
  check('sans que personne en soit chass\u00e9', salle.members.has(U[0]));
  /* \u00c0 venir, elle n'y entre que dans la demi-heure d'avant \u2014 et y reste
     ensuite : pour un match qu'aucun club suivi ne rel\u00e8ve, elle est le seul
     chemin qui le rafra\u00eechit. */
  const coupDEnvoi = salle.fixture.kickoffAt;
  salle.statut = 'NS';
  salle.fixture.kickoffAt = new Date(Date.now() + 2 * 3600_000);
  check('un match \u00e0 deux heures de son coup d\u2019envoi n\u2019est pas relev\u00e9',
    !virage.sallesOccupees().includes(7001));
  salle.fixture.kickoffAt = new Date(Date.now() - 5 * 60_000);
  check('mais l\u2019heure pass\u00e9e, il l\u2019est, m\u00eame encore \u00ab \u00e0 venir \u00bb',
    virage.sallesOccupees().includes(7001));
  salle.fixture.kickoffAt = coupDEnvoi;
  salle.statut = statutAvant;
}

const r = await souvenirs.mintGoal({
  fixtureId: 7001, seq: 1, leagueId: 207, teamId: 85, homeId: 85, awayId: 91,
  minute: 23, player: 'Diallo', scoreHome: 1, scoreAway: 0, kickoffAt: '2026-09-13 16:00:00',
});
check('carte-souvenir frappée', r.minted === true);
check('seuls les chanteurs récents la reçoivent', r.presents === 2);

/* ---------------------------------- D5 : l'annoncer à eux, et à eux seuls

 * La page l'annonçait à chaque but de son club — « Elle est dans ton
 * carnet » —, à C comme aux autres, alors que C n'avait pas chanté dans la
 * fenêtre et ne l'a pas. La frappe nomme ses receveurs, et le Virage ne
 * l'annonce qu'à leurs sockets : c'est le chemin que `server.js` prend après
 * `mintGoal` (`verif-cablage` en garde le branchement). */
{
  const n = virage.souvenirFrappe(7001, { souvenirId: r.souvenirId, minute: 23, joueur: 'Diallo',
    userIds: r.userIds });
  check('la frappe nomme ses deux receveurs',
    JSON.stringify([...(r.userIds ?? [])].sort()) === JSON.stringify([U[0], U[1]].sort()));
  check('virage:souvenir part à leurs sockets', n === 2
    && await until(() => A.souvenirs.length === 1 && B.souvenirs.length === 1));
  await wait(150);
  check('et pas à celui qui regardait sans chanter, ni à la salle',
    C.souvenirs.length === 0 && A.souvenirs.length === 1 && B.souvenirs.length === 1
    || (console.log('        A', A.souvenirs.length, 'B', B.souvenirs.length, 'C', C.souvenirs.length), false));
  check('avec la forme du contrat (§ 16.3)',
    JSON.stringify(A.souvenirs[0]) === JSON.stringify({ fixtureId: 7001, id: r.souvenirId,
      minute: 23, joueur: 'Diallo' })
    || (console.log('        reçu :', JSON.stringify(A.souvenirs[0])), false));
  /* Une compétition non couverte ne frappe rien et ne nomme personne : rien
     ne part, pas même à ceux qui chantaient. */
  const nulle = await souvenirs.mintGoal({
    fixtureId: 7001, seq: 9, leagueId: 999, teamId: 85, homeId: 85, awayId: 91,
    minute: 80, player: 'Bonvin', scoreHome: 2, scoreAway: 0, kickoffAt: '2026-09-13 16:00:00' });
  const rien = virage.souvenirFrappe(7001, { souvenirId: nulle.souvenirId, userIds: nulle.userIds });
  await wait(150);
  check('un but d’une compétition non couverte n’annonce rien',
    nulle.minted === false && rien === 0 && A.souvenirs.length === 1 && B.souvenirs.length === 1);
}

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

  /* ------------------------ une rencontre finie n'est plus une tribune

     `open` disait « le coup d'envoi est dans moins de trente minutes », écrit
     `coup d'envoi − maintenant < 30 min`. Sans plancher, c'est vrai aussi — et
     toujours — pour un match commencé il y a deux heures, où la différence est
     **négative**. Toute rencontre de la fenêtre de trois heures était donc
     ouverte, coup de sifflet final compris : celle d'un club suivi restait dans
     TES CLUBS avec la minute de son dernier relevé, sans jamais en sortir. Vu
     du joueur, la page du Grand Virage ne se mettait plus à jour.

     Les deux bornes se vérifient ensemble, et il faut les deux : un contrôle
     qui n'éprouverait que le match fini repasserait au vert le jour où
     quelqu'un supprime la condition au lieu de la corriger. */
  await pool.query(
    `INSERT INTO fixtures (id,league_id,season,home_id,away_id,status_short,
                           home_goals,away_goals,elapsed,kickoff_at)
     VALUES (7002,207,2026,85,91,'FT',0,3,90,UTC_TIMESTAMP() - INTERVAL 2 HOUR),
            (7003,207,2026,85,91,'NS',NULL,NULL,NULL,
             UTC_TIMESTAMP() + INTERVAL 20 MINUTE)`);

  const apres = await fetch(`${url}/api/virage/live`).then((x) => x.json());
  const parApres = (id) => (apres.matchs ?? []).find((m) => Number(m.id) === id);
  const fini = parApres(7002);
  const bientot = parApres(7003);

  check('un match terminé d’un club suivi paraît encore', Boolean(fini));
  check('mais sa tribune est fermée', fini?.open === false
    || (console.log('        il dit open :', fini?.open), false));
  check('et l’écran peut dire pourquoi plutôt que de griser sans raison',
    fini?.fini === true);
  check('un match qui commence dans vingt minutes, lui, ouvre sa tribune',
    bientot?.open === true
    || (console.log('        il dit open :', bientot?.open), false));
  check('et il n’est pas annoncé comme terminé', bientot?.fini === false);


  /* ------------------------ entrer dans un match que la base ignore

     Le contrôle du dessus prouve que le match **paraît** dans la liste. Le
     joueur, lui, touchait son camp et il ne se passait rien : `roomFor` ne lit
     que `fixtures`, la ligne n'existait pas, `virage:join` répondait
     `no_fixture`, et la page l'écrivait tout en bas de l'écran, hors du champ
     de vision.

     Une liste qui propose plus large que la porte n'ouvre est pire qu'une
     liste courte : elle promet, et elle referme sans le dire. Voir
     `poserDepuisLaJournee`. */
  /* Un supporter à lui, et non `U[0]` : une socket ne tient qu'une salle,
     donc faire entrer A ici l'aurait fait sortir de 7001 — et le contrôle du
     départ, cent lignes plus bas, serait devenu rouge pour une raison sans
     rapport. */
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

/* ---------------------------------------- les chants, jusqu'en base

 * Les missions du Virage comptent les chants et les mi-temps dans
 * `virage_presence`. Ce bloc passe par le vrai chemin : la socket, la salle,
 * le crochet de présence de `ferveur/index.js`, l'upsert de `souvenirs`. Un
 * maillon qui oublierait de transporter `chant` ou `mt` laisserait les
 * missions à zéro sans une erreur nulle part.
 *
 * La mi-temps se lit sur le statut du vrai match que tient la salle : on le
 * pose à la main avant chaque chant, sans passer par le relevé, pour que
 * rien d'autre ne bouge entre deux lectures. */
{
  const salle = virage.rooms.get(7001);
  const moi = salle.members.get(U[0]);
  const lire = async () => (await pool.query(
    `SELECT ferveur, chants, chants_mt1, chants_mt2 FROM virage_presence
      WHERE user_id = ? AND fixture_id = 7001`, [U[0]]))[0][0];
  /* La présence s'écrit à côté du jeu, sans être attendue : on relit la base
     jusqu'à ce que la ligne ait bougé. */
  const quandLaLigne = async (fn, ms = 3000) => {
    const t0 = Date.now();
    let l = await lire();
    while (!(l && fn(l)) && Date.now() - t0 < ms) { await wait(25); l = await lire(); }
    return l;
  };
  const chanter = async (statut) => {
    salle.statut = statut;
    moi.breath = 100;
    const avant = await lire();
    const n = A.results.length;
    A.socket.emit('virage:chant', { cardId: offrir('reprise'), taps: tempoParfait() });
    const accepte = await until(() => A.results.length > n);
    const apres = await quandLaLigne((l) => l.chants !== avant?.chants);
    return { accepte, avant, apres,
      d: (k) => Number(apres?.[k] ?? NaN) - Number(avant?.[k] ?? NaN) };
  };

  let c = await chanter('1H');
  check('un chant en première mi-temps : chants + 1, première + 1, seconde inchangée',
    c.accepte && c.d('chants') === 1 && c.d('chants_mt1') === 1 && c.d('chants_mt2') === 0
    || (console.log('        avant', JSON.stringify(c.avant), '· après', JSON.stringify(c.apres)), false));

  c = await chanter('2H');
  check('un chant en seconde mi-temps : chants + 1, seconde + 1, première inchangée',
    c.accepte && c.d('chants') === 1 && c.d('chants_mt2') === 1 && c.d('chants_mt1') === 0
    || (console.log('        avant', JSON.stringify(c.avant), '· après', JSON.stringify(c.apres)), false));

  c = await chanter('HT');
  check('un chant à la pause compte, mais dans aucune mi-temps',
    c.accepte && c.d('chants') === 1 && c.d('chants_mt1') === 0 && c.d('chants_mt2') === 0
    || (console.log('        avant', JSON.stringify(c.avant), '· après', JSON.stringify(c.apres)), false));

  /* Une carte d'action pousse et rapporte de la ferveur comme avant : le même
     nombre dans la salle et en base. Mais elle ne chante pas, et une mission
     « chante 10 fois » ne doit pas se remplir à coups de Fumigène. */
  salle.statut = '1H';
  moi.main = ['a-fumigene']; moi.breath = 100; moi.cooldowns = {};
  const avant = await lire();
  const f0 = moi.ferveur;
  salle.jouer(U[0], 'a-fumigene');
  const gagne = moi.ferveur - f0;
  const apres = await quandLaLigne((l) => l.ferveur !== avant.ferveur);
  check(`une carte jouée crédite en base la ferveur de la salle (${gagne})`,
    gagne > 0 && apres.ferveur === avant.ferveur + gagne
    || (console.log(`        salle +${gagne} · base ${avant.ferveur} → ${apres?.ferveur}`), false));
  check('mais ne compte ni comme un chant ni dans une mi-temps',
    apres.chants === avant.chants && apres.chants_mt1 === avant.chants_mt1
    && apres.chants_mt2 === avant.chants_mt2);
}

for (const m of room.members.values()) m.lastPush = Date.now() - 120_000;
check('après 90 s sans chanter, on ne compte plus dans la foule',
  room.crowd()[0] === 0 && room.crowd()[1] === 0);
for (const m of room.members.values()) m.lastPush = Date.now();

/* ------------------------------------- deux onglets, puis un retour

 * **D3.** La salle d'un supporter était rangée par joueur : la déconnexion de
 * n'importe laquelle de ses sockets la vidait. Fermer un onglet KOP — qui ouvre
 * sa propre socket — ou perdre l'ancienne socket d'un téléphone qui change de
 * réseau, et l'onglet resté ouvert recevait `not_in_virage` à chaque chant
 * jusqu'au rechargement.
 *
 * **D2.** Et ce rechargement rendait un supporter neuf : 40 de souffle, une
 * main neuve, les recharges effacées. On éprouve le vrai chemin — la dernière
 * socket coupée, une socket neuve qui rejoint sans camp, comme la page qui se
 * reconnecte. */
{
  const QUI = 'bbbbbbbb-0000-0000-0000-000000000007';
  const vous = [];
  const P1 = connect(QUI), P2 = connect(QUI);
  P2.socket.on('virage:vous', (v) => vous.push(v));
  await until(() => P1.socket.connected && P2.socket.connected);
  P1.socket.emit('virage:join', { fixtureId: 7001, camp: 'exterieur' });
  await until(() => P1.state);
  P2.socket.emit('virage:join', { fixtureId: 7001 });
  await until(() => P2.state);
  check('un second onglet sans camp ne change pas celui du supporter',
    P1.state?.you?.side === 1 && P2.state?.you?.side === 1);

  P1.socket.disconnect();
  await wait(200);
  check('fermer le premier onglet ne vide pas la place', room.members.has(QUI));
  P2.socket.emit('virage:chant', { cardId: offrir('reprise'), taps: tempoParfait() });
  check('et le second chante encore', await until(() => P2.results.length === 1)
    || (console.log('        refus :', P2.errors.join(', ') || '(silence)'), false));

  /* Un onglet KOP, Équipes ou duel : une socket du même joueur, qui n'a
     jamais rejoint le Virage. */
  const K = connect(QUI);
  await until(() => K.socket.connected);
  K.socket.disconnect();
  await wait(200);
  check('une socket qui n’a jamais rejoint ne fait rien en partant', room.members.has(QUI));

  /* Une carte jouée avant de partir : elle doit se recharger encore au retour. */
  const x = room.members.get(QUI);
  x.main = ['a-fumigene']; x.breath = 100; x.cooldowns = {};
  P2.socket.emit('virage:jouer', { cardId: 'a-fumigene' });
  await until(() => vous.length === 1);
  P2.socket.disconnect();
  check('à la dernière socket, il part', await until(() => !room.members.has(QUI)));
  check('et la salle le garde parmi les partis', room.partis.has(QUI));
  // Lus au départ : le souffle s'y arrête, il remontait jusque-là.
  const souffle = x.breath, ferveur = x.ferveur;

  const P3 = connect(QUI);
  await until(() => P3.socket.connected);
  P3.socket.emit('virage:join', { fixtureId: 7001 });
  await until(() => P3.state);
  check('il revient dans son camp', P3.state?.you?.side === 1);
  check('avec le souffle qu’il avait laissé', Math.abs((P3.state?.you?.breath ?? -99) - souffle) <= 1
    || (console.log(`        ${Math.round(souffle)} laissé, ${P3.state?.you?.breath} rendu`), false));
  check('et sa ferveur', P3.state?.you?.ferveur === ferveur);
  check('la recharge de sa carte court toujours', (P3.state?.you?.cooldowns?.['a-fumigene'] ?? 0) > 0);
  room.members.get(QUI).main = ['a-fumigene'];
  P3.socket.emit('virage:jouer', { cardId: 'a-fumigene' });
  check('et la rejouer aussitôt est refusé',
    await until(() => P3.errors.includes('ferveur.error.card_on_cooldown')));

  /* Mais un camp demandé est un camp choisi : « je me suis trompé de camp,
     je ressors et je rechoisis ». La page repose la question à chaque entrée
     depuis la liste, et dessine tout d'après la réponse du serveur. */
  P3.socket.emit('virage:leave');
  await until(() => !room.members.has(QUI));
  P3.state = null;
  P3.socket.emit('virage:join', { fixtureId: 7001, camp: 'domicile' });
  await until(() => P3.state);
  check('un neutre qui ressort et rechoisit obtient le camp demandé',
    P3.state?.you?.side === 0 && room.members.get(QUI)?.side === 0);
  P3.socket.disconnect();
  await until(() => !room.members.has(QUI));
}

/* ------------------------------------- la carte tirée, dans chaque onglet

 * Le battement tirait la carte suivante et ne le disait à personne :
 * `virage:vous` ne partait qu'après une carte jouée, sur la socket qui
 * l'avait jouée — donc avant le tirage. La page gardait une case vide pour
 * toujours (correctif d'urgence du 4 octobre 2026, reporté au lot 6). On
 * éprouve le vrai chemin — l'horloge commune de `ferveur/index.js` et la
 * table des sockets, par `auJoueur` — avec deux onglets du même joueur, et
 * un voisin de tribune qui ne doit rien recevoir. */
{
  const QUI = 'bbbbbbbb-0000-0000-0000-000000000006';
  const T1 = connect(QUI), T2 = connect(QUI);
  const vus1 = [], vus2 = [], voisin = [];
  T1.socket.on('virage:vous', (v) => vus1.push(v));
  T2.socket.on('virage:vous', (v) => vus2.push(v));
  const espion = (v) => voisin.push(v);
  B.socket.on('virage:vous', espion);
  await until(() => T1.socket.connected && T2.socket.connected);
  T1.socket.emit('virage:join', { fixtureId: 7001 });
  await until(() => T1.state);
  T2.socket.emit('virage:join', { fixtureId: 7001 });
  await until(() => T2.state);

  /* Deux cartes en main, une en pioche, et la suivante due maintenant. */
  const x = room.members.get(QUI);
  x.main = ['a-fumigene', 'a-fumigene']; x.pioche = ['a-tifo']; x.defausse = [];
  x.remplirA = Date.now();
  check('la carte tirée au battement part aux deux onglets du joueur',
    await until(() => vus1.length >= 1 && vus2.length >= 1)
    || (console.log(`        ${vus1.length} et ${vus2.length} reçu(s)`), false));
  check('avec la main entière, la carte tirée comprise',
    vus1[0]?.main?.length === 3 && vus1[0]?.main?.includes('a-tifo')
    && JSON.stringify(vus2[0]?.main) === JSON.stringify(vus1[0]?.main));
  /* Le tirage suivant attend `refillMs`, et la pioche est vide : d'ici là,
     cinq battements ne doivent rien envoyer de plus. */
  await wait(RULES.tickMs * 5);
  check('une fois, et à lui seul',
    vus1.length === 1 && vus2.length === 1 && voisin.length === 0
    || (console.log(`        ${vus1.length}, ${vus2.length}, voisin ${voisin.length}`), false));

  /* **Le Changement de chant**, joué dans un onglet, refait cinq cartes d'un
     coup et n'appelle aucun tirage : seul le message de la carte jouée peut
     l'apprendre à l'autre. Il ne partait qu'à la socket qui avait joué, et
     l'autre onglet gardait l'ancienne main — ses cartes refusées, les
     neuves invisibles — sans limite de temps. */
  vus1.length = 0; vus2.length = 0;
  x.main = ['a-relais', 'a-fumigene', 'a-fumigene', 'a-fumigene', 'a-fumigene'];
  x.pioche = Array(6).fill('a-tifo'); x.defausse = []; x.breath = 100; x.cooldowns = {};
  T1.socket.emit('virage:jouer', { cardId: 'a-relais' });
  const mainServeur = () => JSON.stringify(room.members.get(QUI)?.main);
  check('le Changement de chant joué dans un onglet refait la main des deux',
    await until(() => vus1.length >= 1 && vus2.length >= 1)
    && x.remplirA === 0 && x.main.length === 5
    && JSON.stringify(vus1[0].main) === mainServeur()
    && JSON.stringify(vus2[0].main) === mainServeur()
    || (console.log(`        ${vus1.length} et ${vus2.length} reçu(s) · serveur ${mainServeur()}`
      + ` · onglet 2 ${JSON.stringify(vus2[0]?.main)}`), false));

  /* **Le filet.** La salle change la main sans rien dire — on le simule —,
     et l'onglet joue la carte qu'il croit tenir. Le refus lui renvoie la
     main, les recharges et le souffle : l'écart se répare de lui-même, au
     lieu de durer jusqu'au rechargement. À lui seul : rien n'a changé pour
     l'autre onglet. Ni tirage ici — `remplirA` reste à zéro. */
  vus1.length = 0; vus2.length = 0; T2.errors.length = 0;
  x.main = ['a-tifo']; x.cooldowns = {};
  T2.socket.emit('virage:jouer', { cardId: 'a-fumigene' });
  check('une carte qui n’est plus en main : refusée, et la main renvoyée à cet onglet',
    await until(() => T2.errors.includes('ferveur.error.card_not_in_hand') && vus2.length === 1)
    && JSON.stringify(vus2[0].main) === '["a-tifo"]'
    || (console.log(`        ${T2.errors.join(', ')} · ${vus2.length} reçu(s)`), false));
  x.main = ['a-fumigene']; x.cooldowns = { 'a-fumigene': Date.now() + 9000 };
  T2.socket.emit('virage:jouer', { cardId: 'a-fumigene' });
  check('une carte en recharge : refusée, et la recharge renvoyée',
    await until(() => T2.errors.includes('ferveur.error.card_on_cooldown') && vus2.length === 2)
    && vus2[1].cooldowns?.['a-fumigene'] > 0
    || (console.log(`        ${T2.errors.join(', ')} · ${vus2.length} reçu(s)`), false));
  x.cooldowns = {}; x.breath = 0; x.regenAt = Date.now();
  T2.socket.emit('virage:jouer', { cardId: 'a-fumigene' });
  check('trop peu de souffle : refusée, et le souffle renvoyé',
    await until(() => T2.errors.includes('ferveur.error.not_enough_breath') && vus2.length === 3)
    && vus2[2].breath < 20
    || (console.log(`        ${T2.errors.join(', ')} · ${vus2.length} reçu(s)`), false));
  await wait(RULES.tickMs * 3);
  check('et l’autre onglet n’en reçoit rien', vus1.length === 0 && voisin.length === 0
    || (console.log(`        onglet 1 ${vus1.length}, voisin ${voisin.length}`), false));
  B.socket.off('virage:vous', espion);
  T1.socket.disconnect();
  T2.socket.disconnect();
  await until(() => !room.members.has(QUI));
}

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

  /* Partir puis revenir ne redistribue pas la main : ce serait un moyen gratuit
     de se débarrasser d'une recharge.

     **Ce contrôle rejoignait sans partir**, et il était vert pour cette
     raison-là : le départ supprimait le membre, et le vrai retour — une
     reconnexion, un rechargement — arrivait avec une main neuve, 40 de souffle
     et les recharges effacées. Il passe maintenant par `leave`, qui est ce que
     font la déconnexion et `virage:leave`. Le témoin sans départ reste. */
  {
    const avant = [...m.main];
    const cd = { ...m.cooldowns };
    const foule = salle.crowd()[0];
    m.regenAt = Date.now(); m.breath = 63;
    salle.leave('c1');
    check('parti, il sort de la foule de sa tribune', salle.crowd()[0] === foule - 1);
    check('et du rang', salle.rankOf('c1') === null);
    // Dans son camp : c'est l'entrée qui le décide, voir « deux onglets ».
    salle.join('c1', { side: 0, name: 'Un', actions: toutes });
    check('revenir dans la salle ne redistribue pas la main',
      JSON.stringify(salle.members.get('c1').main) === JSON.stringify(avant));
    check('et n’efface pas les recharges',
      JSON.stringify(salle.members.get('c1').cooldowns) === JSON.stringify(cd));
    check('ni ne rend du souffle', Math.abs(salle.members.get('c1').breath - 63) < 1);
    const garde = [...m.main];
    m.main = ['a-fumigene']; m.breath = 100;
    refus = null;
    try { salle.jouer('c1', 'a-fumigene'); } catch (e) { refus = e.code; }
    check('la carte jouée avant de partir se recharge encore',
      refus === 'ferveur.error.card_on_cooldown');
    m.main = garde;
    salle.join('c1', { side: 0, name: 'Un', actions: toutes });
    check('rejoindre sans partir ne redistribue rien non plus',
      JSON.stringify(salle.members.get('c1').main) === JSON.stringify(garde));
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

/* =============================== ce que la salle transporte à la présence

   Le bloc « jusqu'en base » éprouve le chemin entier sur trois statuts. Ici,
   la salle seule, sans base ni socket : chaque statut du vrai match qui peut
   arriver, et chaque façon de pousser — un chant, une carte, un tifo qui se
   déplie plus tard. Une poussée doit produire **un** appel au crochet de
   présence, jamais deux : c'est ce qui garde une instruction par poussée. */
{
  const recues = [];
  const salle = new VirageRoom({
    fixture: { id: 9010, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
    emit: () => {}, onPush: (p) => { recues.push(p); }, log: { warn() {}, error() {} },
  });
  salle.join('k1', { side: 0, name: 'Un', actions: ['a-fumigene', 'a-tifo'] });
  const k = salle.members.get('k1');

  /* La minute est nulle : le répertoire est celui du rang 0, qui offre
     « reprise » — voir le Capo plus haut, qui chante de la même façon. */
  const chanter = (statut) => {
    salle.statut = statut;
    k.breath = 100;
    const g = resoudreGeste(k.mods).tempo;
    const taps = Array.from({ length: g.beats }, (_, i) => Math.round(i * g.interval));
    recues.length = 0;
    salle.chant('k1', { cardId: 'reprise', taps });
    return recues.slice();
  };

  const MI_TEMPS = [['1H', 1], ['2H', 2], ['HT', 0], ['ET', 0], ['P', 0], ['LIVE', 0],
    ['NS', 0], [null, 0]];
  const fautes = [];
  for (const [statut, attendu] of MI_TEMPS) {
    const r = chanter(statut);
    if (r.length !== 1 || r[0].chant !== 1 || r[0].mt !== attendu) {
      fautes.push(`${statut} → ${JSON.stringify(r.map((p) => ({ chant: p.chant, mt: p.mt })))}`);
    }
  }
  check('un chant part une fois, marqué chant, avec la mi-temps du statut du match',
    fautes.length === 0 || (console.log('        ' + fautes.join('\n        ')), false));

  salle.statut = '1H';
  k.main = ['a-fumigene']; k.breath = 100; k.cooldowns = {};
  recues.length = 0;
  salle.jouer('k1', 'a-fumigene');
  check('une carte qui pousse part une fois, et pas comme un chant',
    recues.length === 1 && recues[0].chant === 0 && recues[0].amount >= 0
    || (console.log('        reçu :', JSON.stringify(recues)), false));

  k.main = ['a-tifo']; k.breath = 100; k.cooldowns = {};
  salle.differes = [];
  recues.length = 0;
  salle.jouer('k1', 'a-tifo');
  const pose = recues.length;
  salle.entretenirCartes(Date.now() + 9000);
  check('un tifo qui se déplie n’est pas un chant non plus',
    pose === 0 && recues.length === 1 && recues[0].chant === 0
    || (console.log(`        à la pose ${pose} · au dépli`, JSON.stringify(recues)), false));
}

/* ================================== la fin de la minute double

   La diffusion de la corde ne partait que si quelque chose avait bougé, et
   l'expiration de la minute double ne bouge rien : dans une salle calme, la
   page gardait « TOUT COMPTE DOUBLE » après les soixante secondes, jusqu'au
   chant suivant — qui comptait alors simple. La salle seule, sur son horloge,
   sans un geste après le but. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9011, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('s1', { side: 0, name: 'Un' });
  salle.realGoal({ teamId: 1, minute: 10, player: 'Diallo' });
  const reste = salle.snapshotFor('s1').surgeMs;
  check('l’état dit ce qui reste de la minute double', reste > 0 && reste <= 60_000);
  emis.length = 0;
  for (let t = Date.now() + 100; t <= salle.surgeUntil + 1000; t += RULES.tickMs) salle.tick(t);
  const ticks = emis.filter((x) => x.e === 'virage:tick');
  check('la fin de la minute double est diffusée, même quand rien ne bouge',
    ticks.at(-1)?.p.surge === false && ticks.filter((x) => x.p.surge === false).length === 1
    || (console.log('        ticks :', ticks.map((x) => x.p.surge).join(' ')), false));
}

/* ##################################################### la vague 2 (lot 6)

   Le verdict, la série, le rang et le palier, le plancher de ferveur, le
   coup de sifflet et la tribune qui se vide, le bilan, l'XP du match, la
   foule qui ne se diffuse plus à l'entrée, et les amis dans la tribune
   (`serveur/CONTRATS.md`, § 15, § 16, § 18.3). Chaque bloc a son match : le
   bilan lit la ligne de présence d'un match, et deux blocs sur le même se
   compteraient l'un l'autre.
   ######################################################################## */

/** Deux objets égaux, clés dans n'importe quel ordre. */
const canon = (x) => (Array.isArray(x) ? x.map(canon)
  : x && typeof x === 'object'
    ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canon(x[k])])) : x);
const pareil = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const montrer = (quoi, x) => (console.log(`        ${quoi} :`, JSON.stringify(x)), false);

/**
 * Les `n` premières frappes d'un tempo, une sur deux décalée de `d` ms : de
 * quoi viser une note au millième. Toutes, et sans décalage, par défaut.
 */
const frappesTempo = (mods, d, n = Infinity) => {
  const g = resoudreGeste(mods).tempo;
  return Array.from({ length: Math.min(n, g.beats) },
    (_, i) => Math.round(i * g.interval + (i % 2 ? d : 0)));
};
/**
 * Le geste qui donne une note brute dans `]min, max]`, cherché avec `grade`
 * — la fonction même que le serveur appelle — plutôt que supposé : le stade
 * d'un match change la fenêtre du tempo. Le décalage d'abord, puis des
 * frappes en moins pour descendre sous ce qu'un décalage atteint.
 */
const viser = (mods, min, max, motif = 0) => {
  for (let n = resoudreGeste(mods).tempo.beats; n >= 1; n--) {
    for (let d = 0; d <= 600; d++) {
      /* Trop décalées, deux frappes se touchent, et le serveur les refuse
         (`taps_too_fast`) : ce décalage-là ne vise rien. */
      let q;
      try { q = grade('tempo', frappesTempo(mods, d, n), mods, { motif }); } catch { continue; }
      if (q > min && q <= max) return { d, n, q };
    }
  }
  throw new Error(`aucun geste ne note entre ${min} et ${max}`);
};

/* ================================== le verdict, la série, le Cri (§ 16.1)

   Le mot se mesure sur la note brute du geste, relevée par le plancher s'il
   mord, **avant** les modificateurs du Fanzzy (D7) ; le Cri et la série
   lisent la même note. Ce que la salle transporte à la base pour le bilan
   part dans le même appel au crochet de présence. */
{
  const recues = [];
  const salle = new VirageRoom({
    fixture: { id: 9020, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
    emit: () => {}, onPush: (p) => { recues.push(p); }, log: { warn() {}, error() {} },
  });
  salle.join('v1', { side: 0, name: 'Un', actions: ['a-fumigene'] });
  const v = salle.members.get('v1');
  const mods = salle.modsDe(v);
  const cri = viser(mods, 0.95, 1.2);
  const parfait = viser(mods, 0.9, 0.95);
  const bon = viser(mods, 0.7, 0.9);
  const moyen = viser(mods, 0.4, 0.7);
  const rate = viser(mods, -1, 0.4);
  const chanter = (x, qui = 'v1') => {
    salle.members.get(qui).breath = 100;
    recues.length = 0;
    return salle.chant(qui, { cardId: 'reprise', taps: frappesTempo(salle.modsDe(salle.members.get(qui)), x.d, x.n) });
  };

  let r = chanter(cri);
  check(`une note de ${cri.q.toFixed(3)} : PARFAIT, le Cri, une série de 1`,
    r.verdict === 'parfait' && r.cri === true && r.serie === 1 || montrer('réponse', r));
  check('la première place n’a pas de palier au-dessus, et le rang est servi',
    r.rang === 1 && r.sur === 1 && !('prochain' in r) || montrer('réponse', r));
  check('la base reçoit le PARFAIT, la note en millièmes et le chant, dans le même appel',
    recues.length === 1 && recues[0].parfait === 1 && recues[0].serie === 1
    && recues[0].q === Math.ceil(cri.q * 1000 - 1e-6) && recues[0].chantId === 'reprise'
    || montrer('appel', recues));

  r = chanter(parfait);
  check(`${parfait.q.toFixed(3)} : PARFAIT sans le Cri, la série monte à 2`,
    r.verdict === 'parfait' && !('cri' in r) && r.serie === 2 || montrer('réponse', r));

  /* Une carte ne coupe pas la série : elle ne chante pas. */
  v.main = ['a-fumigene']; v.breath = 100; v.cooldowns = {};
  recues.length = 0;
  salle.jouer('v1', 'a-fumigene');
  check('une carte ne coupe pas la série, et ne compte ni chant, ni PARFAIT, ni note',
    v.serie === 2 && recues.length === 1 && recues[0].chant === 0 && recues[0].parfait === 0
    && recues[0].q === 0 && recues[0].chantId === null && recues[0].serie === 2
    || montrer('appel', recues));

  r = chanter(bon);
  check(`${bon.q.toFixed(3)} : BON, et la série retombe à 0`,
    r.verdict === 'bon' && r.serie === 0 || montrer('réponse', r));
  check('mais la meilleure série part toujours à la base', recues[0]?.serie === 2
    && recues[0].parfait === 0);
  check(`${moyen.q.toFixed(3)} : MOYEN`, chanter(moyen).verdict === 'moyen');
  check(`${rate.q.toFixed(3)} : RATÉ`, chanter(rate).verdict === 'rate');
  check('les chants et les PARFAITS se comptent sur le membre',
    v.chants === 5 && v.parfaits === 2 && v.serieMax === 2 || montrer('membre',
      { chants: v.chants, parfaits: v.parfaits, serieMax: v.serieMax }));

  /* D7 : un Fanzzy qui paie mal le parfait (`perfectBonus` 0,82) fait d'un
     geste parfait une poussée de 0,78. Le mot reste PARFAIT. */
  salle.join('v2', { side: 0, name: 'Deux', mods: { perfectBonus: 0.82 } });
  const p2 = viser(salle.modsDe(salle.members.get('v2')), 0.94, 0.96);
  r = chanter(p2, 'v2');
  check('un Fanzzy qui paie mal le parfait ne change pas un PARFAIT en BON (D7)',
    r.verdict === 'parfait' && r.quality < 0.8 || montrer('réponse', r));

  /* Le plancher d'une carte (« Second souffle ») relève la note mesurée
     quand il mord : un raté compte comme moyen, et se dit MOYEN. */
  v.effets = [{ type: 'floor_quality', valeur: 0.6, charges: 1 }];
  r = chanter(rate);
  check('un raté relevé par le Second souffle se dit MOYEN, et le plancher se consomme',
    r.verdict === 'moyen' && v.effets[0].charges === 0 && recues[0]?.q === 600
    || montrer('réponse', { r, effets: v.effets, q: recues[0]?.q }));
}

/* ================================== le rang en direct et le palier (§ 16.2)

   Parmi les présents de sa tribune, dans l'ordre du bilan : la ferveur, puis
   les chants, puis les PARFAITS. Le palier suivant (100, 50, 10, 3, 1) et ce
   qui manque pour y passer. */
{
  const salle = new VirageRoom({
    fixture: { id: 9021, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
    emit: () => {}, log: { warn() {}, error() {} },
  });
  const F = [500, 480, 460, 440, 420, 400, 380, 360, 340, 320, 300, 280, 260, 240, 220];
  F.forEach((f, i) => {
    salle.join(`r${i + 1}`, { side: 0, name: `R${i + 1}` });
    salle.members.get(`r${i + 1}`).ferveur = f;
  });
  salle.join('x1', { side: 1, name: 'En face' });
  salle.classer();
  const place = (id) => salle.placeDe(salle.members.get(id));
  check('12ᵉ sur 15 : TOP 10, à 41 de ferveur (320 − 280 + 1)',
    pareil(place('r12'), { rang: 12, sur: 15, prochain: { rang: 10, ecart: 41 } })
    || montrer('place', place('r12')));
  check('4ᵉ : TOP 3', pareil(place('r4').prochain, { rang: 3, ecart: 21 }) || montrer('place', place('r4')));
  check('2ᵉ : la première place, à 21', pareil(place('r2').prochain, { rang: 1, ecart: 21 }));
  check('1ᵉʳ : pas de palier', place('r1').rang === 1 && place('r1').prochain === null);
  check('l’autre tribune a son propre classement', pareil(place('x1'), { rang: 1, sur: 1, prochain: null }));

  /* À ferveur égale, les chants départagent ; à chants égaux aussi, le même rang. */
  const a = salle.members.get('r14'), b = salle.members.get('r15');
  a.ferveur = 0; b.ferveur = 0; a.chants = 3; b.chants = 5;
  salle.classer();
  check('à ferveur nulle, le plus de chants passe devant', place('r15').rang === 14 && place('r14').rang === 15);
  a.chants = 5; a.parfaits = 1;
  salle.classer();
  check('à chants égaux, les PARFAITS', place('r14').rang === 14 && place('r15').rang === 15);
  a.parfaits = 0;
  salle.classer();
  check('égaux sur les trois : la même place', place('r14').rang === 14 && place('r15').rang === 14);

  /* L'état de l'entrée porte la même place, et le palier. */
  const vue = salle.snapshotFor('r12').you;
  check('l’état porte rank, of, prochain et serie',
    vue.rank === 12 && vue.of === 15 && pareil(vue.prochain, { rang: 10, ecart: 41 }) && vue.serie === 0
    || montrer('you', { rank: vue.rank, of: vue.of, prochain: vue.prochain, serie: vue.serie }));
  check('et un parti n’a plus de place', salle.rankOf('r12') !== null
    && (salle.leave('r12'), salle.rankOf('r12') === null) && salle.rankOf('r13').of === 14);

  /* **Au plus une fois par seconde**, et seulement si quelque chose a bougé :
     mille chants par seconde dans une tribune de mille ne paient pas mille tris. */
  let tris = 0;
  const vrai = salle.classer.bind(salle);
  salle.classer = (...x) => { tris++; return vrai(...x); };
  const t0 = Date.now() + 10_000;
  const r1 = salle.members.get('r1');
  salle.crediter(r1, 10);
  salle.tick(t0);
  for (let k = 1; k <= 9; k++) { salle.crediter(r1, 10); salle.tick(t0 + k * 100); }
  check('dix tours d’horloge qui bougent dans la même seconde : un seul tri', tris === 1
    || montrer('tris', tris));
  salle.tick(t0 + 1000);
  check('la seconde d’après, un de plus', tris === 2);
  salle.tick(t0 + 3000);
  check('et rien quand rien n’a bougé', tris === 2);
}

/* ================================== le plancher de ferveur (Q4, § 16.2)

   Dans une grande tribune, la part d'un chant s'arrondissait à zéro : tout le
   monde y finissait le match à zéro de ferveur. Un chant noté au moins MOYEN
   rapporte au moins 1, tous facteurs appliqués ; un raté, une carte, rien de
   plus qu'avant. */
{
  const avant = reglagesVivants();
  poserReglages({ ...avant, 'virage.tribune_min': 1 });
  try {
    const recues = [];
    const grande = new VirageRoom({
      fixture: { id: 9022, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
      emit: () => {}, onPush: (p) => { recues.push(p); }, log: { warn() {}, error() {} },
    });
    for (let i = 0; i < 300; i++) {
      grande.join(`g${i}`, { side: 0, name: 'G', neutre: i === 1,
        actions: i === 0 ? ['a-fumigene'] : [] });
      grande.members.get(`g${i}`).lastPush = Date.now();
    }
    const g0 = grande.members.get('g0');
    const mods = grande.modsDe(g0);
    const gain = (qui, x) => {
      const m = grande.members.get(qui);
      m.breath = 100;
      const f = m.ferveur;
      recues.length = 0;
      grande.chant(qui, { cardId: 'reprise', taps: frappesTempo(grande.modsDe(m), x.d, x.n) });
      return { delta: m.ferveur - f, base: recues[0]?.amount };
    };
    /* La prémisse : sans plancher, ce chant ne rapporterait rien ici. */
    const brute = 26 * crowdFactor(300) / 300 * (mods.ferveurBonus ?? 1);
    check(`la part d’un chant parfait dans une tribune de 300 s’arrondit à zéro (${brute.toFixed(2)})`,
      brute < 0.5);
    const p = gain('g0', viser(mods, 0.9, 1.2));
    check('un PARFAIT y rapporte 1, dans la salle comme en base', p.delta === 1 && p.base === 1
      || montrer('gain', p));
    const m = gain('g0', viser(mods, 0.4, 0.7));
    check('un MOYEN aussi', m.delta === 1 && m.base === 1 || montrer('gain', m));
    const r = gain('g0', viser(mods, -1, 0.4));
    check('un RATÉ, rien', r.delta === 0 && r.base === 0 || montrer('gain', r));
    const n = gain('g1', viser(grande.modsDe(grande.members.get('g1')), 0.4, 0.7));
    check('un neutre, dont la part est encore divisée par deux, reçoit 1 aussi',
      n.delta === 1 || montrer('gain', n));
    g0.main = ['a-fumigene']; g0.breath = 100; g0.cooldowns = {};
    const f0 = g0.ferveur;
    grande.jouer('g0', 'a-fumigene');
    check('une carte n’y entre pas : elle rapporte ce qu’elle rapportait', g0.ferveur === f0);

    /* **La proportion, là où le plancher ne mord pas.** Dix fois plus de
       monde, dix fois moins par tête : mesuré avec un bonus de ferveur qui
       met les deux parts loin au-dessus de 1, sur le même match (le stade,
       donc les mêmes modificateurs). Mesuré dans une grande tribune sans ce
       bonus, le contrôle rougirait à raison : le plancher y relève tout. */
    const parTete = (n) => {
      const x = new VirageRoom({
        fixture: { id: 9023, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
        emit: () => {}, log: { warn() {}, error() {} } });
      for (let i = 0; i < n; i++) {
        x.join(`p${i}`, { side: 0, name: 'P', mods: { ferveurBonus: 100 } });
        x.members.get(`p${i}`).lastPush = Date.now();
      }
      const p0 = x.members.get('p0');
      p0.breath = 100;
      x.chant('p0', { cardId: 'reprise', taps: frappesTempo(x.modsDe(p0), 0) });
      return p0.ferveur;
    };
    const petite = parTete(4), grande40 = parTete(40);
    check(`la ferveur d’un chant se partage par l’effectif (${petite} à 4, ${grande40} à 40)`,
      grande40 > 10 && petite / grande40 > 8 && petite / grande40 < 12);
  } finally {
    poserReglages(avant);
  }
}

/* ================================== le coup de sifflet, dans la salle (§ 15.3) */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9025, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', status: '2H' },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  check('un match en jeu n’a pas de coup de sifflet', salle.finA === 0);
  salle.matchStatus({ status: 'FT', elapsed: 90 });
  salle.matchStatus({ status: 'FT', elapsed: 90 });
  const premierA = salle.finA;
  /* L'API revient parfois sur une fin (une correction de statut) : la
     tribune n'est plus à fermer, et quand la fin revient, elle ne se
     réannonce pas — la page a déjà demandé son bilan. */
  salle.matchStatus({ status: '2H', elapsed: 90 });
  const rouverte = salle.finA === 0;
  salle.matchStatus({ status: 'FT', elapsed: 90 });
  const fins = emis.filter((x) => x.e === 'virage:fin');
  check('virage:fin part une fois à la salle, avec son statut, même si l’API se reprend',
    fins.length === 1 && fins[0].p.statut === 'FT' && premierA > 0 && rouverte && salle.finA > 0
    || montrer('fins', { fins, premierA, rouverte, finA: salle.finA }));
  const prolong = new VirageRoom({
    fixture: { id: 9026, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', status: 'ET' },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} } });
  emis.length = 0;
  prolong.matchStatus({ status: 'AET' });
  check('après prolongation, AET', emis.filter((x) => x.e === 'virage:fin')[0]?.p.statut === 'AET');
  const annule = new VirageRoom({
    fixture: { id: 9027, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', status: '1H' },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} } });
  emis.length = 0;
  annule.matchStatus({ status: 'CANC' });
  check('un match annulé n’a pas de coup de sifflet',
    !emis.some((x) => x.e === 'virage:fin') && annule.finA === 0);
  emis.length = 0;
  const tard = new VirageRoom({
    fixture: { id: 9028, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B', status: 'FT' },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} } });
  const connue = tard.finA > 0;
  /* Même si l'API se reprend ensuite : la page l'a lu dans l'état. */
  tard.matchStatus({ status: '2H' });
  tard.matchStatus({ status: 'FT' });
  check('une salle ouverte après la fin ne l’annonce pas, mais la connaît',
    !emis.some((x) => x.e === 'virage:fin') && connue && tard.finA > 0);
  /* La minute double : sa durée relative est toujours servie, à 0 hors de la
     minute (`CONTRATS.md`, § 16.2, comme le correctif l'a posée). Absente,
     elle ne se distinguerait plus d'un serveur d'avant. */
  tard.join('t1', { side: 0, name: 'T' });
  check('hors de la minute double, l’état sert surgeMs à 0', tard.snapshotFor('t1').surgeMs === 0
    || montrer('surgeMs', tard.snapshotFor('t1').surgeMs));
}

/* ================================== le bilan de tribune (§ 15.1)

   Cinq joueurs à domicile, dont un parti avant la fin, deux à ferveur nulle
   que leurs chants départagent ; un neutre non classé en face ; un entré qui
   n'a jamais poussé. Les chiffres viennent de la base, tous passages
   compris, et sont comparés à la valeur exacte. */
const J = await creerJoueurs('bilan', 8, { fanzzy: 'TR32' });
{
  await semer(J[0], 7101, { ferveur: 120, chants: 30, parfaits: 9, serie_max: 4,
    meilleur_q: 970, meilleur_chant: 'mur' });
  await semer(J[1], 7101, { ferveur: 120, chants: 25, parfaits: 12, serie_max: 1,
    meilleur_q: 880, meilleur_chant: 'reprise' });
  await semer(J[2], 7101, { ferveur: 80, chants: 12 });          // parti avant la fin
  await semer(J[3], 7101, { ferveur: 0, chants: 5 });
  await semer(J[4], 7101, { ferveur: 0, chants: 3 });
  await semer(J[5], 7101, { side: 1, team_id: 91, ferveur: 50, chants: 20 });
  await semer(J[6], 7101, { side: 1, team_id: null, classe: 0, ferveur: 10, chants: 10 });
  const [s1] = await pool.query(
    `INSERT INTO souvenirs (fixture_id, seq, league_id, family, scorer_team, home_id, away_id,
                            minute, player, score_home, score_away, kickoff_at, expires_at, price)
     VALUES (7101, 1, 207, 'championnat', 85, 85, 91, 23, 'Diallo', 1, 0, NOW(), NOW() + INTERVAL 15 DAY, 60)`);
  const [s2] = await pool.query(
    `INSERT INTO souvenirs (fixture_id, seq, league_id, family, scorer_team, home_id, away_id,
                            minute, player, score_home, score_away, kickoff_at, expires_at, price)
     VALUES (7101, 2, 207, 'championnat', 85, 85, 91, 71, NULL, 2, 0, NOW(), NOW() + INTERVAL 15 DAY, 60)`);
  const S1 = s1.insertId, S2 = s2.insertId;
  await pool.query(`INSERT INTO user_souvenirs (user_id, souvenir_id, kind) VALUES
    (?, ?, 'presence'), (?, ?, 'presence'), (?, ?, 'presence'), (?, ?, 'vignette')`,
    [J[0], S2, J[0], S1, J[1], S1, J[2], S2]);

  const attendus = {
    [J[0]]: { fixtureId: 7101, side: 0, classe: true, neutre: false, ferveur: 120, chants: 30,
      parfaits: 9, serie: 4, meilleur: { chant: 'mur', nom: 'Le mur', verdict: 'parfait' },
      rang: 1, sur: 5,
      souvenirs: [{ id: S1, minute: 23, joueur: 'Diallo' }, { id: S2, minute: 71 }] },
    [J[1]]: { fixtureId: 7101, side: 0, classe: true, neutre: false, ferveur: 120, chants: 25,
      parfaits: 12, meilleur: { chant: 'reprise', nom: 'La reprise', verdict: 'bon' },
      rang: 2, sur: 5, souvenirs: [{ id: S1, minute: 23, joueur: 'Diallo' }] },
    [J[2]]: { fixtureId: 7101, side: 0, classe: true, neutre: false, ferveur: 80, chants: 12,
      parfaits: 0, rang: 3, sur: 5 },
    [J[3]]: { fixtureId: 7101, side: 0, classe: true, neutre: false, ferveur: 0, chants: 5,
      parfaits: 0, rang: 4, sur: 5 },
    [J[4]]: { fixtureId: 7101, side: 0, classe: true, neutre: false, ferveur: 0, chants: 3,
      parfaits: 0, rang: 5, sur: 5 },
    [J[5]]: { fixtureId: 7101, side: 1, classe: true, neutre: false, ferveur: 50, chants: 20,
      parfaits: 0, rang: 1, sur: 2 },
    [J[6]]: { fixtureId: 7101, side: 1, classe: false, neutre: true, ferveur: 10, chants: 10,
      parfaits: 0, rang: 2, sur: 2 },
    [J[7]]: { fixtureId: 7101, side: 0 },
  };
  const noms = ['le meilleur, ses PARFAITS, sa série, son geste et ses deux cartes',
    'à ferveur égale, deux de moins en chants : deuxième, sans série d’un seul',
    'le parti avant la fin compte, sans sa vignette',
    'à ferveur nulle, cinq chants', 'à ferveur nulle, trois chants : derrière',
    'en face, premier de sa tribune', 'le neutre non classé', 'entré, jamais poussé : rien à poser'];
  for (const [i, id] of J.entries()) {
    const b = await virage.bilan.bilanDe(id, 7101, { xp: false });
    check(`bilan — ${noms[i]}`, pareil(b, attendus[id]) || montrer('bilan', b));
  }
  /* Fini, la même chose, lue autrement : toute la salle en une fois. */
  const fautes = [];
  for (const id of J) {
    const b = await virage.bilan.bilanDe(id, 7101, { xp: false, fini: true });
    if (!pareil(b, { ...attendus[id], fini: true })) fautes.push(b);
  }
  check('le bilan du coup de sifflet, lu par salle, dit la même chose', fautes.length === 0
    || montrer('écarts', fautes));

  /* Par la socket : la page demande, la socket reçoit, l'XP part avec. */
  const P = connect(J[0]);
  await until(() => P.socket.connected);
  P.socket.emit('virage:join', { fixtureId: 7101 });
  await until(() => P.state);
  P.socket.emit('virage:bilan');
  check('virage:bilan répond à cette socket', await until(() => P.bilans.length === 1));
  const b = P.bilans[0] ?? {};
  const { xp, ...sansXp } = b;
  check('le même bilan', pareil(sansXp, attendus[J[0]]) || montrer('bilan', b));
  check('avec l’XP du match, versée : 15, et rien d’autre (R5)',
    xp?.verse === true && pareil(xp.gain, { echarpes: 0, packs: 0, xp: 15, tampons: 0 })
    && xp.niveau?.gain === 15 && typeof xp.wallet?.scarves === 'number' || montrer('xp', xp));
  const [lignes] = await pool.query(
    `SELECT source, cle, xp, echarpes, packs FROM recompenses WHERE user_id = ?`, [J[0]]);
  const [[w]] = await pool.query('SELECT xp FROM user_wallet WHERE user_id = ?', [J[0]]);
  check('une ligne au grand livre : virage, le match, 15 XP — et 15 XP au joueur',
    lignes.length === 1 && lignes[0].source === 'virage' && lignes[0].cle === '7101'
    && lignes[0].xp === 15 && lignes[0].echarpes === 0 && w.xp === 15
    || montrer('grand livre', { lignes, xp: w.xp }));
  P.socket.emit('virage:bilan');
  check('une seconde demande dans les cinq secondes : rate_limited',
    await until(() => P.errors.includes('ferveur.error.rate_limited')) && P.bilans.length === 1);
  const deja = await virage.bilan.bilanDe(J[0], 7101, {});
  check('l’XP ne se verse qu’une fois : « deja » ensuite',
    pareil(deja.xp, { verse: false, raison: 'deja' }) || montrer('xp', deja.xp));
  const H = connect(J[7]);
  await until(() => H.socket.connected);
  H.socket.emit('virage:bilan');
  check('une socket dans aucune salle : not_in_virage',
    await until(() => H.errors.includes('ferveur.error.not_in_virage')));
  P.socket.disconnect(); H.socket.disconnect();
}

/* ================================== P5 : mille bilans au coup de sifflet

   Une fois le match fini, la salle entière se lit en deux requêtes, gardées
   deux minutes et partagées : le nombre de lectures ne dépend plus de
   l'effectif. On compte au pool lui-même. */
{
  const C50 = await creerJoueurs('coup', 50);
  for (const [i, id] of C50.entries()) await semer(id, 7102, { ferveur: 100 + i, chants: 3 });
  let lectures = 0, connexions = 0;
  const compteur = new Proxy(pool, {
    get(cible, cle) {
      const v = cible[cle];
      if (typeof v !== 'function') return v;
      if (cle === 'execute' || cle === 'query') return (...a) => { lectures++; return v.apply(cible, a); };
      if (cle === 'getConnection') return (...a) => { connexions++; return v.apply(cible, a); };
      return v.bind(cible);
    },
  });
  const B = createBilan({ pool: compteur, niveau });
  const bilans = await Promise.all(C50.map((id) => B.bilanDe(id, 7102, { fini: true })));
  check(`cinquante bilans au coup de sifflet : deux lectures en tout (${lectures})`, lectures === 2);
  check('et aucun versement ouvert pour une XP qui manque de chants', connexions === 0);
  check('chacun a sa place, sur cinquante, et ce qui lui manque pour l’XP',
    bilans.every((b, i) => b.rang === 50 - i && b.sur === 50
      && pareil(b.xp, { verse: false, raison: 'incomplet', manque: 7 }))
    || montrer('un bilan', bilans[0]));
  lectures = 0;
  await Promise.all(C50.slice(0, 10).map((id) => B.bilanDe(id, 7102, { fini: false, xp: false })));
  check(`en cours de match, trois lectures par bilan (${lectures} pour dix)`, lectures === 30);
}

/* ================================== l'XP du match (§ 15.2)

   15 XP par match, une fois, à partir de dix chants, trois matchs par jour ;
   ni le club, ni l'abonnement, ni la neutralité, ni le classement n'y
   changent rien. */
{
  /* Deux, puis dix demandes simultanées : une ligne. */
  const deux = await enParallele(2, () => virage.bilan.verserXp(J[1], 7101));
  const [l2] = await pool.query(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?`, [J[1]]);
  check('deux demandes simultanées : un versement, une ligne',
    deux.filter((r) => r.verse).length === 1 && Number(l2[0].n) === 1 || montrer('rendus', deux));
  const [K] = await creerJoueurs('dix', 1);
  await semer(K, 7105, { chants: 12 });
  const dix = await enParallele(10, () => virage.bilan.verserXp(K, 7105));
  const [l10] = await pool.query(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?`, [K]);
  check('dix demandes simultanées : un versement, une ligne, et « deja » pour les neuf autres',
    dix.filter((r) => r.verse).length === 1 && Number(l10[0].n) === 1
    && dix.filter((r) => r.raison === 'deja').length === 9 || montrer('rendus', dix));

  /* Neuf chants : il en manque un. Par le recompte du grand livre, et par le bilan. */
  const [N9] = await creerJoueurs('neuf', 1);
  await semer(N9, 7106, { chants: 9, ferveur: 30 });
  check('neuf chants : « incomplet », il en manque un (recompte sous verrou)',
    pareil(await virage.bilan.verserXp(N9, 7106), { verse: false, raison: 'incomplet', manque: 1 }));
  check('et le bilan dit la même chose',
    pareil((await virage.bilan.bilanDe(N9, 7106, {})).xp, { verse: false, raison: 'incomplet', manque: 1 }));

  /* Le plafond du jour : trois matchs ont rapporté, le quatrième non. Les
     versements d'hier ne comptent pas. */
  const Q = await creerJoueurs('quota', 2);
  for (const q of Q) await semer(q, 7106, { chants: 12 });
  for (const cle of ['8001', '8002', '8003']) {
    await pool.query(`INSERT INTO recompenses (user_id, source, cle, xp) VALUES (?, 'virage', ?, 15)`, [Q[0], cle]);
  }
  for (const [cle, hier] of [['8001', 0], ['8002', 0], ['8003', 1], ['8004', 1]]) {
    await pool.query(`INSERT INTO recompenses (user_id, source, cle, xp, verse_a)
                      VALUES (?, 'virage', ?, 15, NOW(3) - INTERVAL ? DAY)`, [Q[1], cle, hier]);
  }
  check('le quatrième match du jour : « quota »',
    pareil(await virage.bilan.verserXp(Q[0], 7106), { verse: false, raison: 'quota' }));
  const [lq] = await pool.query(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND cle = '7106'`, [Q[0]]);
  check('et rien d’écrit', Number(lq[0].n) === 0);
  check('deux aujourd’hui, deux hier : le troisième du jour passe',
    (await virage.bilan.verserXp(Q[1], 7106)).verse === true);

  /* La même chose pour tous : un joueur classé chez lui, un neutre, un
     Virage non classé. L'abonnement, lui, ne se lit nulle part dans le
     module (le contrôle lit le code, commentaires ôtés). */
  const T = await creerJoueurs('egal', 3);
  await semer(T[0], 7107, { chants: 10 });
  await semer(T[1], 7107, { chants: 10, team_id: null });
  await semer(T[2], 7107, { chants: 10, classe: 0 });
  const rendus = [];
  for (const t of T) rendus.push(await virage.bilan.verserXp(t, 7107));
  check('classé chez lui, neutre, non classé : exactement la même XP',
    rendus.every((r) => r.verse && pareil(r.gain, { echarpes: 0, packs: 0, xp: 15, tampons: 0 })
      && r.niveau?.gain === 15) || montrer('rendus', rendus.map((r) => [r.verse, r.raison, r.gain])));
  const code = readFileSync(new URL('../src/server/ferveur/bilan.js', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const xpSeule = code.slice(code.indexOf('async function verserXp'), code.indexOf('async function xpDuBilan'));
  check('l’XP ne lit ni l’abonnement, ni le classement, ni le club',
    xpSeule.length > 100 && !/abonn|estAbonne|classe|team_id|neutre/i.test(xpSeule)
    && !/abonn/i.test(code));

  /* Sans la colonne d'XP : « schema », ni XP ni ligne. */
  const [S] = await creerJoueurs('schema', 1);
  await semer(S, 7106, { chants: 12 });
  await pool.query('ALTER TABLE user_wallet DROP COLUMN xp');
  let rs;
  try { rs = await virage.bilan.verserXp(S, 7106); } finally {
    const brut = await mysql.createConnection({ uri: DB, multipleStatements: true });
    await brut.query(readFileSync(new URL('../sql/niveau.sql', import.meta.url), 'utf8'));
    await brut.end();
  }
  const [ls] = await pool.query(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?`, [S]);
  check('sans la colonne xp : « schema », et pas de ligne',
    pareil(rs, { verse: false, raison: 'schema' }) && Number(ls[0].n) === 0 || montrer('rendu', rs));

  /* `xp.virage` à 0 : l'XP du Virage est éteinte, rien ne part au grand livre. */
  const avant = reglagesVivants();
  poserReglages({ ...avant, 'xp.virage': 0 });
  try {
    check('xp.virage à 0 : « inactif »',
      pareil((await virage.bilan.bilanDe(S, 7106, {})).xp, { verse: false, raison: 'inactif' }));
  } finally { poserReglages(avant); }
  const [li] = await pool.query(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?`, [S]);
  check('et rien d’écrit', Number(li[0].n) === 0);

  /* **Le filet** : un membre qui a chanté et qui s'en va sans demander de
     bilan reçoit son XP au départ ; celui qui n'a fait qu'entrer, rien. */
  const [Pc, Pe] = await creerJoueurs('filet', 2);
  const X = connect(Pc), Y = connect(Pe);
  await until(() => X.socket.connected && Y.socket.connected);
  X.socket.emit('virage:join', { fixtureId: 7108 });
  Y.socket.emit('virage:join', { fixtureId: 7108 });
  await until(() => X.state && Y.state);
  const salle = virage.rooms.get(7108);
  salle.minute = 0; salle.rangChangeA = 0;             // « reprise » au répertoire
  const mx = salle.members.get(Pc);
  mx.breath = 100;
  X.socket.emit('virage:chant', { cardId: 'reprise', taps: frappesTempo(salle.modsDe(mx), 0) });
  await until(() => X.results.length === 1);
  const ligne = async () => (await pool.query(
    'SELECT chants FROM virage_presence WHERE user_id = ? AND fixture_id = 7108', [Pc]))[0][0];
  for (let t = 0; t < 50 && !(await ligne()); t++) await wait(40);
  await pool.query('UPDATE virage_presence SET chants = 12 WHERE user_id = ? AND fixture_id = 7108', [Pc]);
  /* Celui qui n'a fait qu'entrer a pourtant, en base, de quoi toucher l'XP
     (un passage d'avant) : c'est d'être entré sans chanter qui ne la verse
     pas au départ — son bilan, s'il le demande, la versera. */
  await semer(Pe, 7108, { chants: 12 });
  X.socket.disconnect(); Y.socket.disconnect();
  const versee = async (u) => Number((await pool.query(
    `SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND source = 'virage' AND cle = '7108'`,
    [u]))[0][0].n);
  let n = 0;
  for (let t = 0; t < 60 && !n; t++) { await wait(50); n = await versee(Pc); }
  check('le filet verse au départ de qui a chanté sans demander son bilan', n === 1);
  check('et rien à qui n’a fait qu’entrer', await versee(Pe) === 0);
}

/* ================================== le coup de sifflet, par la socket (§ 15.3)

   `virage:fin` une fois ; le bilan devient `fini` ; `virage.bilan_min`
   minutes après, `virage:ferme` à chaque socket, qui quitte la salle — sauf
   qui est arrivé après la fin, qui a les mêmes minutes que les autres. */
{
  const X = await creerJoueurs('fin', 3);
  const S1 = connect(X[0]), S2 = connect(X[1]);
  await until(() => S1.socket.connected && S2.socket.connected);
  S1.socket.emit('virage:join', { fixtureId: 7109 });
  S2.socket.emit('virage:join', { fixtureId: 7109 });
  await until(() => S1.state && S2.state);
  check('au Virage pendant le match (estAuVirage)', virage.estAuVirage(X[0]) === true);
  virage.matchStatus(7109, { status: 'FT', elapsed: 90 });
  virage.matchStatus(7109, { status: 'FT', elapsed: 90 });
  await until(() => S1.fins.length && S2.fins.length);
  await wait(150);
  check('virage:fin une fois à chaque socket, statut FT',
    S1.fins.length === 1 && S2.fins.length === 1 && S1.fins[0].statut === 'FT'
    || montrer('fins', [S1.fins, S2.fins]));
  check('après le coup de sifflet, on n’est plus « au Virage »', virage.estAuVirage(X[0]) === false);
  check('et la salle ne coûte plus de relevé', !virage.sallesOccupees().includes(7109));
  S1.socket.emit('virage:bilan');
  await until(() => S1.bilans.length === 1);
  check('le bilan dit fini, et rien d’autre sans ligne de présence',
    pareil(S1.bilans[0], { fixtureId: 7109, side: 0, fini: true }) || montrer('bilan', S1.bilans[0]));

  const S3 = connect(X[2]);
  await until(() => S3.socket.connected);
  S3.socket.emit('virage:join', { fixtureId: 7109 });
  await until(() => S3.state);
  await wait(150);
  check('qui entre après la fin ne reçoit pas virage:fin, mais l’état le dit',
    S3.fins.length === 0 && S3.state.statut === 'FT');
  check('assis dans une salle finie, il n’est pas « au Virage » : il y lit son bilan',
    virage.rooms.get(7109)?.members.has(X[2]) && virage.estAuVirage(X[2]) === false);

  const avant = reglagesVivants();
  poserReglages({ ...avant, 'virage.bilan_min': 1 });
  try {
    const salle = virage.rooms.get(7109);
    const ilYa = Date.now() - 61_000;
    salle.finA = ilYa;
    salle.members.get(X[0]).entreA = ilYa;
    salle.members.get(X[1]).entreA = ilYa;
    check('virage.bilan_min après le coup de sifflet, virage:ferme à chaque socket',
      await until(() => S1.fermes.length === 1 && S2.fermes.length === 1, 2000));
    check('et la tribune se vide d’eux', !salle.members.has(X[0]) && !salle.members.has(X[1]));
    check('après virage:ferme, ni l’un ni l’autre n’est « au Virage »',
      virage.estAuVirage(X[0]) === false && virage.estAuVirage(X[1]) === false);
    check('mais pas de qui est arrivé après : il a ses minutes à lui',
      S3.fermes.length === 0 && salle.members.has(X[2]));
    S2.socket.emit('virage:bilan');
    check('après virage:ferme, le bilan répond not_in_virage',
      await until(() => S2.errors.includes('ferveur.error.not_in_virage')));
    const tardif = salle.members.get(X[2]);
    if (tardif) tardif.entreA = ilYa;
    check('ses minutes passées, il sort à son tour',
      await until(() => S3.fermes.length === 1 && salle.size === 0, 2000));
  } finally {
    poserReglages(avant);
    for (const s of [S1, S2, S3]) s.socket.disconnect();
  }
}

/* ================================== D4 : une entrée ne diffuse rien à la salle

   La foule part avec la corde : `join` lève `dirty`, et le battement suivant
   la porte. `virage:crowd` à toute la salle à chaque entrée, c'était un
   demi-million de messages au coup d'envoi d'un match à mille. */
{
  const [d1, d2] = await creerJoueurs('foule', 2);
  const P1 = connect(d1), P2 = connect(d2);
  await until(() => P1.socket.connected && P2.socket.connected);
  P1.socket.emit('virage:join', { fixtureId: 7110 });
  await until(() => P1.state);
  await wait(150);
  P1.crowds.length = 0; P1.ticks.length = 0;
  P2.socket.emit('virage:join', { fixtureId: 7110 });
  await until(() => P2.state);
  await wait(300);
  check('une entrée n’émet pas virage:crowd à la salle', P1.crowds.length === 0
    || montrer('virage:crowd', P1.crowds.length));
  check('la foule part avec la corde, au battement suivant',
    P1.ticks.length >= 1 && Array.isArray(P1.ticks.at(-1).crowd));
  P1.socket.disconnect(); P2.socket.disconnect();
}

/* ================================== les amis dans la tribune (§ 18.3)

   Une salle de cinquante. L'entrant a deux amis mutuels présents — l'un
   visible, l'autre caché —, une demande en attente et des inconnus. « 2 AMIS
   ICI » ne dit que les visibles, à lui seul ; son arrivée ne part qu'aux
   sockets de ses amis, cachés compris, jamais à la salle. Éteinte, la
   présence ne dit rien. */
{
  const [E] = await creerJoueurs('entrant', 1, { fanzzy: 'TR32' });
  const [F1] = await creerJoueurs('ami-vu', 1, { fanzzy: 'TR32' });
  const [F2] = await creerJoueurs('ami-cache', 1);
  const [F3] = await creerJoueurs('demande', 1);
  const O = await creerJoueurs('foule50', 46);
  await pool.query(`INSERT INTO amities (a, b, par, etat) VALUES (?, ?, ?, 'amis'), (?, ?, ?, 'amis'),
    (?, ?, ?, 'demande')`, [E, F1, E, E, F2, E, E, F3, F3]);
  await pool.query('UPDATE user_wallet SET presence = 0 WHERE user_id = ?', [F2]);
  const avant = reglagesVivants();
  const salleDe50 = [F1, F2, F3, ...O].map((id) => ({ id, p: connect(id) }));
  const tous = [];
  try {
    poserReglages({ ...avant, 'presence.actif': true });
    for (const { p } of salleDe50) {
      await until(() => p.socket.connected);
      p.socket.emit('virage:join', { fixtureId: 7103 });
      tous.push(p);
    }
    check('quarante-neuf dans la tribune',
      await until(() => tous.every((p) => p.state), 8000) && virage.rooms.get(7103)?.size === 49);
    const e1 = connect(E);
    await until(() => e1.socket.connected);
    e1.socket.emit('virage:join', { fixtureId: 7103 });
    check('l’entrant reçoit virage:amis', await until(() => e1.amis.length === 1, 3000));
    const amis = e1.amis[0]?.amis ?? [];
    check('ses seuls amis mutuels visibles : ni le caché, ni la demande, ni les inconnus',
      amis.length === 1 && amis[0].id === F1 || montrer('amis', amis));
    check('avec un pseudo, et l’avatar en liste blanche (§ 3)',
      typeof amis[0]?.pseudo === 'string'
      && JSON.stringify(Object.keys(amis[0]?.avatar ?? {})) === JSON.stringify(AVATAR_PUBLIC)
      || montrer('ami', amis[0]));
    const parId = new Map(salleDe50.map(({ id, p }) => [id, p]));
    await until(() => parId.get(F1).ami.length === 1 && parId.get(F2).ami.length === 1, 3000);
    await wait(200);
    const recoivent = salleDe50.filter(({ p }) => p.ami.length).map(({ id }) => id).sort();
    check('virage:ami part exactement aux sockets de ses deux amis, le caché compris',
      JSON.stringify(recoivent) === JSON.stringify([F1, F2].sort()) || montrer('reçoivent', recoivent));
    const annonce = parId.get(F1).ami[0] ?? {};
    check('et dit qui, présent', annonce.id === E && annonce.present === true
      && typeof annonce.pseudo === 'string' && Boolean(annonce.avatar) || montrer('annonce', annonce));
    check('personne d’autre ne reçoit virage:amis', tous.every((p) => p.amis.length === 0));
    /* L'ordre des lectures : ses amis d'abord, puis à qui l'annoncer, la
       seconde partie une fois la première rendue — en parallèle, elles
       liraient chacune de leur côté ce que l'autre allait garder. */
    const deE = appelsPresence.filter((x) => x.id === E).map((x) => `${x.f}:${x.t}`);
    check('ses amis d’abord, puis à qui l’annoncer, l’une après l’autre',
      JSON.stringify(deE) === JSON.stringify(
        ['amisPresents:debut', 'amisPresents:fin', 'aPrevenir:debut', 'aPrevenir:fin'])
      || montrer('appels', deE));
    check('présent dans la tribune : « au Virage » (estAuVirage)', virage.estAuVirage(E) === true);

    /* Un second onglet n'est pas une arrivée. */
    const e2 = connect(E);
    await until(() => e2.socket.connected);
    e2.socket.emit('virage:join', { fixtureId: 7103 });
    await until(() => e2.state);
    await wait(200);
    check('un second onglet ne se réannonce pas',
      parId.get(F1).ami.length === 1 && e2.amis.length === 0);
    e2.socket.disconnect();
    await wait(200);
    check('le fermer n’est pas un départ', parId.get(F1).ami.length === 1
      && virage.estAuVirage(E) === true);
    e1.socket.disconnect();
    check('le départ réel part aux mêmes, et à eux seuls',
      await until(() => parId.get(F1).ami.length === 2 && parId.get(F2).ami.length === 2, 3000)
      && parId.get(F1).ami[1].present === false
      && salleDe50.filter(({ p }) => p.ami.length).length === 2);
    check('après son départ réel, il n’est plus « au Virage »',
      await until(() => virage.estAuVirage(E) === false, 2000)
      && virage.rooms.get(7103)?.partis.has(E));

    /* Éteinte : rien. */
    poserReglages(avant);
    const e3 = connect(E);
    await until(() => e3.socket.connected);
    e3.socket.emit('virage:join', { fixtureId: 7103 });
    await until(() => e3.state);
    await wait(300);
    check('présence éteinte : ni virage:amis, ni virage:ami',
      e3.amis.length === 0 && parId.get(F1).ami.length === 2);
    e3.socket.disconnect();
  } finally {
    poserReglages(avant);
    for (const { p } of salleDe50) p.socket.disconnect();
  }
}

/* ================================== une entrée dépassée ne s'annonce pas
   (§ 18.3)

   Parti puis revenu pendant que la présence lit encore — un téléphone qui
   change de réseau au moment d'entrer : c'est la seconde entrée qui annonce,
   une fois, et la première s'efface (`annoncerArrivee`). Sans quoi l'ami
   présent l'apprendrait deux fois, et l'entrant recevrait deux fois ses amis. */
{
  const [G] = await creerJoueurs('revient', 1);
  const [H] = await creerJoueurs('ami-la', 1);
  await pool.query(`INSERT INTO amities (a, b, par, etat) VALUES (?, ?, ?, 'amis')`, [G, H, G]);
  const avant = reglagesVivants();
  let lacher = null;
  const h = connect(H);
  const g = [];
  try {
    poserReglages({ ...avant, 'presence.actif': true });
    await until(() => h.socket.connected);
    h.socket.emit('virage:join', { fixtureId: 7111 });
    await until(() => h.state);
    retenues.set(G, new Promise((r) => { lacher = r; }));
    g.push(connect(G));
    await until(() => g[0].socket.connected);
    g[0].socket.emit('virage:join', { fixtureId: 7111 });
    await until(() => g[0].state);
    g[0].socket.disconnect();
    const salle = virage.rooms.get(7111);
    await until(() => salle?.partis.has(G));
    g.push(connect(G));
    await until(() => g[1].socket.connected);
    g[1].socket.emit('virage:join', { fixtureId: 7111 });
    await until(() => g[1].state);
    lacher();
    retenues.delete(G);
    await until(() => h.ami.length >= 1 && g[1].amis.length >= 1, 3000);
    await wait(300);
    check('parti puis revenu pendant les lectures : une seule arrivée, annoncée par la seconde entrée',
      h.ami.length === 1 && h.ami[0].id === G && h.ami[0].present === true && g[1].amis.length === 1
      || montrer('annonces', { h: h.ami, revenu: g[1].amis }));
  } finally {
    lacher?.();
    retenues.delete(G);
    poserReglages(avant);
    for (const p of [h, ...g]) p.socket.disconnect();
  }
}

/* ================================== la présence éteinte en cours de match
   (§ 18)

   Allumée à l'entrée d'un ami, éteinte depuis `/admin` avant son départ :
   « tant que `presence.actif` est faux, rien de ce paragraphe n'est servi ».
   Son départ ne part plus à ceux qui l'avaient vu entrer. */
{
  const [G] = await creerJoueurs('eteinte', 1);
  const [H] = await creerJoueurs('eteinte-ami', 1);
  await pool.query(`INSERT INTO amities (a, b, par, etat) VALUES (?, ?, ?, 'amis')`, [G, H, G]);
  const avant = reglagesVivants();
  const h = connect(H), g = connect(G);
  try {
    poserReglages({ ...avant, 'presence.actif': true });
    await until(() => h.socket.connected && g.socket.connected);
    h.socket.emit('virage:join', { fixtureId: 7114 });
    await until(() => h.state);
    g.socket.emit('virage:join', { fixtureId: 7114 });
    check('allumée, son arrivée est dite à son ami',
      await until(() => h.ami.length === 1, 3000) && h.ami[0].present === true);
    poserReglages(avant);
    g.socket.disconnect();
    await until(() => virage.rooms.get(7114)?.partis.has(G), 2000);
    await wait(300);
    check('éteinte avant son départ, son départ ne part plus',
      h.ami.length === 1 || montrer('virage:ami', h.ami));
  } finally {
    poserReglages(avant);
    for (const p of [h, g]) p.socket.disconnect();
  }
}

/* ================================== une transaction par versement dû
   (§ 15.2 ; revue de la partie B)

   Un versement tenté coûte une connexion, le verrou de la bourse et une
   place au sémaphore, qu'il verse ou non. Le bilan n'en ouvrait aucune pour
   un chanteur sous le seuil ; le départ qui le suit (la page quitte la salle
   après son bilan, § 15.3) et `virage:ferme` en rouvraient une par chanteur.
   Un « quota » redemandé, dix sockets du même joueur, en rouvraient autant.

   Un second Virage, sur le même pool **compté** et une socket.io en
   mémoire : on compte au pool lui-même, et une connexion, c'est une
   transaction de bourse. */
{
  const compte = { lectures: 0, connexions: 0 };
  const zero = () => { compte.lectures = 0; compte.connexions = 0; };
  const poolCompte = new Proxy(pool, {
    get(cible, cle) {
      const v = cible[cle];
      if (typeof v !== 'function') return v;
      if (cle === 'execute' || cle === 'query') return (...a) => { compte.lectures++; return v.apply(cible, a); };
      if (cle === 'getConnection') return (...a) => { compte.connexions++; return v.apply(cible, a); };
      return v.bind(cible);
    },
  });
  /* Une socket.io en mémoire : ce que reçoit chaque socket, et quand. */
  const fauxIo = () => {
    const sockets = new Set();
    const io2 = { conn: [], on(ev, fn) { if (ev === 'connection') this.conn.push(fn); },
      to(salle) {
        return { emit: (e, p) => { for (const s of sockets) if (s.rooms.has(salle)) s.got.push([e, p, Date.now()]); } };
      } };
    io2.connecter = (userId) => {
      const s = { connected: true, data: { user: { userId, name: 'Fan' } }, rooms: new Set(), h: new Map(), got: [],
        on(n, fn) { (this.h.get(n) ?? this.h.set(n, []).get(n)).push(fn); },
        emit(e, p) { this.got.push([e, p, Date.now()]); },
        join(r) { this.rooms.add(r); }, leave(r) { this.rooms.delete(r); },
        fire(n, ...a) { for (const fn of this.h.get(n) ?? []) fn(...a); },
        de(ev) { return this.got.filter(([e]) => e === ev).map(([, p]) => p); },
        couper() { this.connected = false; this.rooms.clear(); sockets.delete(this); this.fire('disconnect', 'test'); } };
      sockets.add(s);
      for (const fn of io2.conn) fn(s);
      return s;
    };
    return io2;
  };
  const io2 = fauxIo();
  const V2 = createVirage({ pool: poolCompte, io: io2, souvenirs, fanzzy, niveau,
    requireAuth: (r, _s, n) => { r.user = { id: identite }; n(); } });
  const lignesVirage = async (u, f) => Number((await pool.query(
    `SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND source = 'virage' AND cle = ?`,
    [u, String(f)]))[0][0].n);
  const fermeDans = (salle) => {
    salle.finA = Date.now() - reglage('virage.bilan_min') * 60_000 - 1000;
    for (const m of salle.members.values()) m.entreA = 0;
  };
  const avant = reglagesVivants();
  try {
    /* 1. Six chanteurs sous le seuil et un qui a droit à l'XP sans l'avoir
          demandée. Le bilan, le départ après lui, puis `virage:ferme`. */
    const R = await creerJoueurs('rien', 7);
    const du = R[6];
    for (const id of R.slice(0, 6)) await semer(id, 7112, { chants: 1, ferveur: 1 });
    await semer(du, 7112, { chants: 12, ferveur: 5 });
    const S = R.map((id) => io2.connecter(id));
    for (const s of S) s.fire('virage:join', { fixtureId: 7112 });
    check('sept dans la tribune du second Virage',
      await until(() => S.every((s) => s.de('virage:state').length), 6000));
    const salle = V2.rooms.get(7112);
    for (const id of R) salle.members.get(id).chants = 1;   // ils ont chanté dans cette salle
    V2.matchStatus(7112, { status: 'FT', elapsed: 90 });
    zero();
    for (const s of S.slice(0, 6)) s.fire('virage:bilan');
    await until(() => S.slice(0, 6).every((s) => s.de('virage:bilan').length));
    check('six « incomplet » au coup de sifflet : la salle lue en deux requêtes, aucune connexion '
      + `(${compte.lectures} lectures, ${compte.connexions} connexions)`,
    compte.connexions === 0 && compte.lectures === 2
      && S.slice(0, 6).every((s) => pareil(s.de('virage:bilan')[0]?.xp,
        { verse: false, raison: 'incomplet', manque: 9 }))
      || montrer('xp', S[0].de('virage:bilan')[0]?.xp));
    zero();
    for (const s of S.slice(0, 3)) s.fire('virage:leave');
    await until(() => R.slice(0, 3).every((id) => salle.partis.has(id)));
    await wait(200);
    check('la page quitte la salle après son bilan : une lecture par départ, aucune connexion '
      + `(${compte.lectures} lectures, ${compte.connexions} connexions)`,
    compte.connexions === 0 && compte.lectures === 3);
    zero();
    fermeDans(salle);
    check('virage:ferme sort les quatre qui restaient',
      await until(() => S.slice(3).every((s) => s.de('virage:ferme').length), 3000));
    let n = 0;
    for (let t = 0; t < 60 && !n; t++) { await wait(50); n = await lignesVirage(du, 7112); }
    await wait(100);
    check('virage:ferme : rien pour les trois « incomplet », une connexion pour qui a droit à l’XP '
      + `sans l’avoir demandée (${compte.connexions})`, compte.connexions === 1 && n === 1);

    /* 2. Au plafond du jour, trois sockets du même joueur demandent leur
          bilan ensemble, puis il s'en va. */
    const [P] = await creerJoueurs('plafond', 1);
    await semer(P, 7113, { chants: 12, ferveur: 4 });
    for (const cle of ['8101', '8102', '8103']) {
      await pool.query(`INSERT INTO recompenses (user_id, source, cle, xp) VALUES (?, 'virage', ?, 15)`, [P, cle]);
    }
    const T = [io2.connecter(P), io2.connecter(P), io2.connecter(P)];
    for (const s of T) s.fire('virage:join', { fixtureId: 7113 });
    await until(() => T.every((s) => s.de('virage:state').length));
    V2.rooms.get(7113).members.get(P).chants = 1;
    zero();
    for (const s of T) s.fire('virage:bilan');
    await until(() => T.every((s) => s.de('virage:bilan').length));
    check('au plafond, trois sockets demandent leur bilan ensemble : « quota » à chacune, '
      + `une seule connexion (${compte.connexions})`,
    compte.connexions === 1 && T.every((s) => s.de('virage:bilan')[0]?.xp?.raison === 'quota')
      || montrer('xp', T.map((s) => s.de('virage:bilan')[0]?.xp)));
    for (const s of T) s.couper();
    await until(() => V2.rooms.get(7113)?.partis.has(P));
    await wait(200);
    check(`et son départ n’en rouvre pas (${compte.connexions})`, compte.connexions === 1);

    /* 3. Dix demandes ensemble d'un joueur à qui l'XP est due : une
          transaction, pas dix qui s'attendent sur le même verrou. */
    const [K2] = await creerJoueurs('ensemble', 1);
    await semer(K2, 7113, { chants: 12 });
    const B2 = createBilan({ pool: poolCompte, niveau, log: { warn() {} } });
    zero();
    const dix = await enParallele(10, () => B2.verserXp(K2, 7113));
    check(`dix demandes ensemble : une transaction (${compte.connexions}), un versement, `
      + '« deja » pour les neuf autres',
    compte.connexions === 1 && dix.filter((r) => r.verse).length === 1
      && dix.filter((r) => r.raison === 'deja').length === 9 && await lignesVirage(K2, 7113) === 1
      || montrer('rendus', dix.map((r) => (r.verse ? 'verse' : r.raison))));

    /* 4. Un joueur sans bourse : « inconnu », retenu. */
    zero();
    const i1 = await B2.verserXp('fantome-0000', 7113, { chants: 12 });
    const i2 = await B2.verserXp('fantome-0000', 7113, { chants: 12 });
    check(`un joueur sans bourse : « inconnu », retenu (${compte.connexions} connexion)`,
      i1.raison === 'inconnu' && i2.raison === 'inconnu' && compte.connexions === 1
      || montrer('rendus', [i1, i2]));

    /* 5. Le « quota » tient jusqu'au minuit **de la base**, et pas plus ; le
          plafond relevé depuis /admin le lève. L'horloge de la base est figée
          à 23:59:30, celle du module avancée à la main. */
    let maintenant = Date.now();
    const B3 = createBilan({ pool: poolCompte, niveau, log: { warn() {} }, horloge: () => maintenant });
    const [[{ jour }]] = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS jour`);
    await figerHorloge(pool, `${jour} 23:59:30`);
    try {
      zero();
      const q1 = await B3.verserXp(P, 7113, { chants: 12 });
      maintenant += 29_000;
      const q2 = await B3.verserXp(P, 7113, { chants: 12 });
      check(`« quota » à 23:59:30, encore retenu 29 s plus tard (${compte.connexions} connexion)`,
        q1.raison === 'quota' && q2.raison === 'quota' && compte.connexions === 1
        || montrer('rendus', [q1, q2]));
      maintenant += 2_000;
      await B3.verserXp(P, 7113, { chants: 12 });
      check(`minuit passé pour la base, on redemande au grand livre (${compte.connexions})`,
        compte.connexions === 2);
      poserReglages({ ...avant, 'xp.virage_matchs_jour': 4 });
      const q4 = await B3.verserXp(P, 7113, { chants: 12 });
      check(`le plafond relevé depuis /admin : le refus ne tient plus, et le match paie (${compte.connexions})`,
        q4.verse === true && compte.connexions === 3 || montrer('rendu', q4));
    } finally {
      await figerHorloge(pool, null);
      poserReglages(avant);
    }

    /* 6. Le recompte sous verrou fait foi : la lecture que le filet fait avant
          le sémaphore, si elle se trompait vers le haut, n'y change rien. */
    const [N9] = await creerJoueurs('neuf-verrou', 1);
    await semer(N9, 7113, { chants: 9 });
    const menteur = new Proxy(pool, {
      get(cible, cle) {
        const v = cible[cle];
        if (cle === 'execute') {
          return (sql, p) => (/^SELECT chants FROM virage_presence/.test(sql)
            ? Promise.resolve([[{ chants: 12 }], []]) : v.call(cible, sql, p));
        }
        return typeof v === 'function' ? v.bind(cible) : v;
      },
    });
    const B4 = createBilan({ pool: menteur, niveau, log: { warn() {} } });
    check('neuf chants, un filet dont la lecture d’avant en voit douze : le recompte sous verrou dit « incomplet », il en manque un',
      pareil(await B4.verserXp(N9, 7113, { filet: true }), { verse: false, raison: 'incomplet', manque: 1 })
      && await lignesVirage(N9, 7113) === 0);

    /* 7. Une tribune de vingt-cinq se vide par battements de dix au plus :
          sortie d'un coup, elle lançait le filet de chacun dans le même
          battement. */
    const VG = await creerJoueurs('vague', 25);
    const SV = VG.map((id) => io2.connecter(id));
    for (const s of SV) s.fire('virage:join', { fixtureId: 7115 });
    await until(() => SV.every((s) => s.de('virage:state').length), 8000);
    V2.matchStatus(7115, { status: 'FT', elapsed: 90 });
    fermeDans(V2.rooms.get(7115));
    check('virage:ferme les sort tous', await until(() => SV.every((s) => s.de('virage:ferme').length), 5000));
    const instants = SV.map((s) => s.got.find(([e]) => e === 'virage:ferme')?.[2] ?? 0).sort((a, b) => a - b);
    const vagues = [];
    for (const t of instants) {
      if (vagues.length && t - vagues.at(-1).at(-1) <= 40) vagues.at(-1).push(t);
      else vagues.push([t]);
    }
    check(`dix par battement au plus (${vagues.map((v) => v.length).join(' + ')})`,
      vagues.length >= 3 && vagues.every((v) => v.length <= 10));
  } finally {
    poserReglages(avant);
    V2.stop();
  }
}

/* ================================== le bilan avant le filet, au sémaphore

   Une page attend son bilan trois secondes au plus (§ 15.4) ; un départ
   n'attend personne. Quatre filets tiennent le sémaphore, deux attendent ;
   un bilan arrive, puis un second pour le même joueur et le même match qu'un
   filet en attente : les deux bilans passent avant les filets. Sans base : un
   grand livre doublé, qui ne rend la main qu'à la demande — et qui rend
   toutes les mains d'un même joueur à la fois, pour qu'un code qui ouvrirait
   deux versements au lieu d'un rougisse au lieu de rester suspendu. */
{
  const ordre = [];
  const portes = new Map();         // joueur -> les versements qui attendent sa porte
  const ouvrir = (u) => { for (const r of portes.get(u) ?? []) r(); portes.delete(u); };
  const B = createBilan({
    pool: { execute: async () => [[{ chants: 99 }], []] },
    niveau: { gagnerDans() {} }, log: { warn() {} },
    verser: async (_p, o) => {
      ordre.push(o.userId);
      await new Promise((r) => portes.set(o.userId, [...(portes.get(o.userId) ?? []), r]));
      return { verse: false, raison: 'deja' };
    },
  });
  const tous = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((u) => B.verserXp(u, 1, { filet: true }));
  await wait(20);
  tous.push(B.verserXp('b1', 1, { chants: 99 }));
  await wait(20);
  tous.push(B.verserXp('f6', 1, { chants: 99 }));   // une page attend désormais f6
  await wait(20);
  check('quatre au grand livre, trois en attente dont un filet',
    ordre.join(' ') === 'f1 f2 f3 f4' && B.etatXp().enAttente === 3 && B.etatXp().filets === 1
    || montrer('état', { ordre, etat: B.etatXp() }));
  for (const u of ['f1', 'f2', 'f3', 'f4']) { ouvrir(u); await wait(10); }
  for (let k = 0; k < 4 && portes.size; k++) {
    for (const u of [...portes.keys()]) ouvrir(u);
    await wait(10);
  }
  const fini = await Promise.race([Promise.all(tous).then(() => true), wait(2000).then(() => false)]);
  check(`le bilan d’abord, puis le filet qu’une page attend, puis les autres (${ordre.join(' ')})`,
    fini && ordre.join(' ') === 'f1 f2 f3 f4 b1 f6 f5');
}

/* ================================== la carte tirée, annoncée

   Le tirage posait `dirtyMain`, que personne ne lisait : la page montrait au
   plus quatre cartes, et quand celles qu'elle voyait étaient toutes en
   recharge, plus rien ne partait — ni carte, ni message — jusqu'au
   rechargement. La salle seule, sur son horloge, avec un espion à la place
   des sockets. */
{
  const vues = [];
  let horloge = 0;
  const salle = new VirageRoom({
    fixture: { id: 9012, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
    emit: () => {}, emitVous: (userId, you) => vues.push({ userId, you, a: horloge }),
    log: { warn() {}, error() {} },
  });
  const tic = (t) => { horloge = t; salle.tick(t); };
  const dix = ACTIONS_VIRAGE.slice(0, 10).map((a) => a.id);
  salle.join('t1', { side: 0, name: 'Un', actions: dix });
  salle.join('t2', { side: 0, name: 'Deux', actions: dix });
  const m = salle.members.get('t1');
  check('un deck de dix cartes du Virage : cinq en main, cinq en pioche',
    m.main.length === 5 && m.pioche.length === 5);

  m.main[0] = 'a-fumigene'; m.breath = 100; m.cooldowns = {};
  const t0 = Date.now();
  salle.jouer('t1', 'a-fumigene');
  tic(t0 + RULES.refillMs - 100);
  check('rien ne part avant le tirage', vues.length === 0);
  tic(t0 + RULES.refillMs + 100);
  check('le tirage est annoncé à celui qui la tient, avec une main de cinq',
    vues.length === 1 && vues[0].userId === 't1' && vues[0].you?.main?.length === 5
    && vues[0].you?.mainVisible === RULES.mainVisible
    || (console.log('        reçu :', JSON.stringify(vues.map((v) => [v.userId, v.you?.main?.length]))), false));
  check('et la marque est effacée', m.dirtyMain === false);

  /* Au plus un message toutes les `refillMs` : une main vide, une pioche
     pleine, et vingt secondes de battements. */
  vues.length = 0;
  const tc = t0 + RULES.refillMs + 200;   // l'horloge de la salle ne recule pas
  m.main = []; m.pioche = [...dix]; m.defausse = []; m.remplirA = tc;
  for (let t = tc; t <= tc + 20_000; t += RULES.tickMs) tic(t);
  const ecarts = vues.slice(1).map((v, i) => v.a - vues[i].a);
  check('cinq tirages, cinq messages, jamais deux à moins de refillMs',
    vues.length === 5 && vues.every((v) => v.userId === 't1')
    && ecarts.every((e) => e >= RULES.refillMs) && vues.at(-1)?.you?.main?.length === 5
    || (console.log(`        ${vues.length} message(s), écarts ${ecarts.join(', ')}`), false));

  /* **Un parti ne reçoit rien**, et ne tire pas : la salle garde sa main
     telle qu'il l'a laissée, et la lui rend à l'entrée. Le tirage dû pendant
     l'absence tombe au premier battement après son retour. */
  vues.length = 0;
  const p = salle.members.get('t2');
  const tp = tc + 21_000;
  p.main.pop(); p.remplirA = tp;          // une carte jouée : la suivante est due à `tp`
  salle.leave('t2', tp - 1000);
  for (let t = tp; t <= tp + 3 * RULES.refillMs; t += RULES.tickMs) tic(t);
  check('un parti ne reçoit rien et ne tire pas', vues.length === 0 && p.main.length === 4);
  const retour = salle.join('t2', { side: 0, name: 'Deux', actions: dix });
  check('à son retour, l’état porte la main qu’il a laissée', retour.you?.main?.length === 4);
  tic(tp + 3 * RULES.refillMs + RULES.tickMs);
  check('et le battement suivant tire et l’annonce',
    vues.length === 1 && vues[0].userId === 't2' && vues[0].you?.main?.length === 5);

  /* Une salle montée sans le canal — les suites — tire quand même, en
     silence, et efface sa marque. */
  const muette = new VirageRoom({
    fixture: { id: 9013, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B' },
    emit: () => {}, log: { warn() {}, error() {} },
  });
  muette.join('t3', { side: 0, name: 'Trois', actions: dix });
  const q3 = muette.members.get('t3');
  q3.main.pop(); q3.remplirA = Date.now();
  muette.tick(Date.now() + RULES.tickMs);
  check('sans canal, la salle tire sans rien casser',
    q3.main.length === 5 && q3.dirtyMain === false);
}

/* ================================== un but d'avant l'ouverture

   La salle ouvre à 2–1, à la cinquantième. Le relevé lui apporte en retard
   un but de la neuvième : l'API a publié le score avant l'événement, ou le
   télétexte a rangé le score avant le tour du direct. Il sonnait « GOAL ! »,
   secouait la corde, ouvrait la minute double et ramenait la salle à la
   neuvième minute — et au score de ce moment-là. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9014, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      status: '2H', elapsed: 50, homeGoals: 2, awayGoals: 1 },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('o1', { side: 0, name: 'Un' });
  const annonces = () => emis.filter((x) => x.e === 'virage:real_goal');
  const butsAuFil = () => salle.fil.filter((e) => e.type === 'Goal').length;

  // Rang 2 : le but de la neuvième. Rang 3 : le dernier d'avant l'ouverture.
  const r2 = salle.realGoal({ teamId: 1, minute: 9, player: 'Ancien', score: [1, 1] });
  const r3 = salle.realGoal({ teamId: 1, minute: 41, player: 'Borne', score: [2, 1] });
  check('un but d’avant l’ouverture ne sonne pas, le dernier compris',
    r2 === false && r3 === false && annonces().length === 0
    || (console.log(`        rendu ${r2}/${r3} · ${annonces().length} annonce(s)`), false));
  check('il ne secoue pas la corde et n’ouvre pas la minute double',
    salle.rope === 0 && salle.surgeUntil === 0);
  check('ni la minute ni le score de la salle ne reculent jusqu’à lui',
    salle.minute === 50 && salle.scoreReel[0] === 2 && salle.scoreReel[1] === 1);
  check('et il n’entre ni au fil ni au compte des buts vus',
    butsAuFil() === 0 && salle.realGoals[0] === 0 && salle.realGoals[1] === 0);

  /* Au même tour, le relevé fait monter le tableau **avant** d'apporter le
     but : la garde compare à l'ouverture, pas au score du moment. */
  salle.matchStatus({ status: '2H', elapsed: 51, homeGoals: 3, awayGoals: 1 });
  const r4 = salle.realGoal({ teamId: 1, minute: 51, player: 'Frais', score: [3, 1] });
  check('le but suivant sonne, même quand le tableau l’a déjà compté',
    r4 === true && annonces().length === 1 && annonces()[0].p.player === 'Frais');
  check('avec sa secousse, sa minute double et sa minute',
    salle.rope < 0 && salle.surgeUntil > Date.now() && salle.minute === 51 && butsAuFil() === 1);
}

/* ================================== un but refusé par la vidéo

   Ouverte à 1–0, la salle voit la vidéo retirer ce but : le tableau
   redescend à 0–0. Le vrai but suivant reprend le rang 1 ; si le compte de
   l'ouverture ne redescendait pas avec le tableau, il serait tu. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9015, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      status: '1H', elapsed: 30, homeGoals: 1, awayGoals: 0 },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('v1', { side: 1, name: 'Un' });
  salle.matchStatus({ status: '1H', elapsed: 32, homeGoals: 0, awayGoals: 0 });
  salle.matchStatus({ status: '1H', elapsed: 35, homeGoals: 0, awayGoals: 1 });
  const r = salle.realGoal({ teamId: 2, minute: 35, player: 'Apres', score: [0, 1] });
  check('après un but refusé par la vidéo, le vrai but suivant sonne',
    r === true && emis.filter((x) => x.e === 'virage:real_goal').length === 1
    || (console.log(`        rendu ${r} · buts connus ${salle.butsConnus}`), false));
}

/* ================================== un but déjà annoncé, revenu sous un autre nom

   La salle ouvre au coup d'envoi et annonce le but de la neuvième. À la
   cinquantième, l'API corrige le buteur — « K. Buteur » devient « Karim
   Buteur » : pour le relevé, qui reconnaît un but à son buteur, c'est un but
   jamais vu, et il le renvoie avec son score d'alors. La garde de
   l'ouverture ne le couvrait pas — la salle avait ouvert à 0–0 —, et il
   sonnait une seconde fois : « GOAL ! », corde, minute double, et la salle
   revenait à la neuvième minute. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9016, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      status: '1H', elapsed: 5, homeGoals: 0, awayGoals: 0 },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('k1', { side: 0, name: 'Un' });
  const annonces = () => emis.filter((x) => x.e === 'virage:real_goal');
  const butsAuFil = () => salle.fil.filter((e) => e.type === 'Goal').length;

  // Comme au même tour du relevé : le tableau d'abord, le but ensuite.
  salle.matchStatus({ status: '1H', elapsed: 9, homeGoals: 1, awayGoals: 0 });
  const r1 = salle.realGoal({ teamId: 1, minute: 9, player: 'K. Buteur', score: [1, 0] });
  check('le but de la neuvième sonne, une fois', r1 === true && annonces().length === 1);

  /* La corde et la minute double repartent de zéro : ce qui suit ne doit
     pas les toucher, et une minute double reposée dans la même milliseconde
     ne se verrait pas. */
  salle.matchStatus({ status: '2H', elapsed: 50, homeGoals: 1, awayGoals: 0 });
  salle.rope = 0; salle.surgeUntil = 0;
  const r2 = salle.realGoal({ teamId: 1, minute: 9, player: 'Karim Buteur', score: [1, 0] });
  check('revenu sous un buteur corrigé, il ne sonne pas une seconde fois',
    r2 === false && annonces().length === 1
    || (console.log(`        rendu ${r2} · ${annonces().length} annonce(s) · buts connus ${salle.butsConnus}`), false));
  check('ni corde, ni minute double, ni minute qui recule, ni fil, ni compte',
    salle.rope === 0 && salle.surgeUntil === 0 && salle.minute === 50
    && butsAuFil() === 1 && salle.realGoals[0] === 1 && salle.realGoals[1] === 0);

  const r3 = salle.realGoal({ teamId: 2, minute: 60, player: 'Frais', score: [1, 1] });
  check('le but suivant, lui, sonne',
    r3 === true && annonces().length === 2 && annonces()[1].p.player === 'Frais');

  /* La vidéo retire ce but annoncé : le tableau redescend, le compte avec
     lui, et le but qui reprend son rang sonne. */
  salle.matchStatus({ status: '2H', elapsed: 62, homeGoals: 1, awayGoals: 0 });
  salle.matchStatus({ status: '2H', elapsed: 70, homeGoals: 2, awayGoals: 0 });
  const r4 = salle.realGoal({ teamId: 1, minute: 70, player: 'Encore', score: [2, 0] });
  check('un but annoncé puis refusé ne tait pas celui qui reprend son rang',
    r4 === true && annonces().length === 3
    || (console.log(`        rendu ${r4} · buts connus ${salle.butsConnus}`), false));
}

/* ================================== un but frais, au rang d'un but connu

   Le relevé compte le rang d'un but dans **sa liste d'événements**, pas au
   tableau. Qu'elle manque un but d'avant l'ouverture — jamais publié, ou
   publié après le suivant —, et le premier but frais prend son rang : la
   salle le taisait, pour toute la tribune — ni « GOAL ! », ni corde, ni
   minute double. Ouverte à la 20e à 2–0, buts de la 9e et de la 15e ; au
   tour de la 31e, le tableau passe à 3–0 et la liste ne porte que le but de
   la 30e, rang 1. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9017, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      status: '1H', elapsed: 20, homeGoals: 2, awayGoals: 0 },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('f1', { side: 0, name: 'Un' });
  const annonces = () => emis.filter((x) => x.e === 'virage:real_goal');

  salle.matchStatus({ status: '1H', elapsed: 31, homeGoals: 3, awayGoals: 0 });
  const r1 = salle.realGoal({ teamId: 1, minute: 30, player: 'Frais', score: [1, 0] });
  check('un but frais au rang d’un but d’avant l’ouverture sonne',
    r1 === true && annonces().length === 1 && salle.rope < 0 && salle.surgeUntil > Date.now()
    || (console.log(`        rendu ${r1} · ${annonces().length} annonce(s) · buts connus ${salle.butsConnus}`), false));
  /* Le score qu'il porte est celui de la liste, en retard de deux buts : la
     page affichait 1–0 sous « GOAL ! » d'un 3–0, et la minute revenait à
     la 30e. */
  check('sans faire reculer le tableau ni la minute de la salle',
    JSON.stringify(salle.scoreReel) === '[3,0]' && salle.minute === 31
    && JSON.stringify(annonces()[0]?.p.scoreReel) === '[3,0]'
    || (console.log(`        ${JSON.stringify(salle.scoreReel)} à la ${salle.minute}e`), false));

  /* Les événements des buts d'avant paraissent enfin, rangs 1 et 2. Le but
     frais annoncé au rang 1 n'a pas fait oublier à la salle qu'elle en
     connaissait deux. */
  salle.rope = 0; salle.surgeUntil = 0;
  const r2 = salle.realGoal({ teamId: 1, minute: 9, player: 'Neuf', score: [1, 0] });
  const r3 = salle.realGoal({ teamId: 1, minute: 15, player: 'Quinze', score: [2, 0] });
  check('les buts d’avant, publiés enfin, ne sonnent toujours pas',
    r2 === false && r3 === false && annonces().length === 1
    && salle.rope === 0 && salle.surgeUntil === 0
    || (console.log(`        rendus ${r2}/${r3} · buts connus ${salle.butsConnus}`), false));

  /* Le même club, la minute suivante : un but déjà annoncé à une minute
     près, mais un rang neuf. C'est le rang qui le distingue d'un buteur
     corrigé. */
  salle.matchStatus({ status: '1H', elapsed: 32, homeGoals: 4, awayGoals: 0 });
  const r4 = salle.realGoal({ teamId: 1, minute: 31, player: 'Encore', score: [4, 0] });
  check('deux buts du même club en deux minutes qui se suivent sonnent tous les deux',
    r4 === true && annonces().length === 2
    || (console.log(`        rendu ${r4} · buts connus ${salle.butsConnus}`), false));
}

/* ================================== la vidéo retire un but annoncé, le même club remarque

   Le but de la 30e est annoncé, la vidéo le retire — le tableau redescend
   au tour suivant —, et le même club marque à la 31e. Même club, à une
   minute près : sans la redescente du compte, la salle l'aurait pris pour
   le premier revenu sous un autre buteur. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9021, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      status: '1H', elapsed: 1, homeGoals: 0, awayGoals: 0 },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('w1', { side: 0, name: 'Un' });
  salle.matchStatus({ status: '1H', elapsed: 30, homeGoals: 1, awayGoals: 0 });
  salle.realGoal({ teamId: 1, minute: 30, player: 'Refuse', score: [1, 0] });
  salle.matchStatus({ status: '1H', elapsed: 31, homeGoals: 0, awayGoals: 0 });
  salle.matchStatus({ status: '1H', elapsed: 32, homeGoals: 1, awayGoals: 0 });
  const r = salle.realGoal({ teamId: 1, minute: 31, player: 'Valable', score: [1, 0] });
  check('après un but annoncé puis refusé, le même club qui remarque aussitôt sonne',
    r === true && emis.filter((x) => x.e === 'virage:real_goal').length === 2
    || (console.log(`        rendu ${r} · buts connus ${salle.butsConnus}`), false));
}

/* ================================== la vidéo retire un but, un autre tombe

   Entre deux tours du relevé, la vidéo retire B (30e) et C est marqué
   (33e) : le tableau reste à 2–0 et ne redescend jamais, la liste passe de
   [A, B] à [A, C]. C a le rang de B. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9018, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      status: '1H', elapsed: 1, homeGoals: 0, awayGoals: 0 },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('c1', { side: 0, name: 'Un' });
  const annonces = () => emis.filter((x) => x.e === 'virage:real_goal').map((x) => x.p.player);
  salle.matchStatus({ status: '1H', elapsed: 10, homeGoals: 1, awayGoals: 0 });
  salle.realGoal({ teamId: 1, minute: 10, player: 'A', score: [1, 0] });
  salle.matchStatus({ status: '1H', elapsed: 30, homeGoals: 2, awayGoals: 0 });
  salle.realGoal({ teamId: 1, minute: 30, player: 'B', score: [2, 0] });
  salle.matchStatus({ status: '1H', elapsed: 34, homeGoals: 2, awayGoals: 0 });
  const r = salle.realGoal({ teamId: 1, minute: 33, player: 'C', score: [2, 0] });
  check('un but marqué pendant que la vidéo en retire un autre sonne',
    r === true && annonces().join() === 'A,B,C'
    || (console.log(`        rendu ${r} · annoncés ${annonces().join()}`), false));
}

/* ================================== deux buts publiés dans le désordre

   Ouverte au coup d'envoi. L'API publie le but de la 11e avant celui de la
   9e : celui-ci arrive avec le rang de l'autre. Deux buts frais, deux
   annonces — et la salle ne revient ni à la 9e minute ni à 1–0. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9019, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      status: '1H', elapsed: 1, homeGoals: 0, awayGoals: 0 },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('d1', { side: 0, name: 'Un' });
  const annonces = () => emis.filter((x) => x.e === 'virage:real_goal').map((x) => x.p.player);
  salle.matchStatus({ status: '1H', elapsed: 11, homeGoals: 1, awayGoals: 1 });
  const rB = salle.realGoal({ teamId: 2, minute: 11, player: 'Onze', score: [0, 1] });
  const rA = salle.realGoal({ teamId: 1, minute: 9, player: 'Neuf', score: [1, 0] });
  check('un but frais publié après un plus tardif sonne aussi',
    rB === true && rA === true && annonces().join() === 'Onze,Neuf'
    || (console.log(`        rendus ${rB}/${rA} · annoncés ${annonces().join()}`), false));
  check('sans ramener la salle à sa minute ni à son score',
    salle.minute === 11 && JSON.stringify(salle.scoreReel) === '[1,1]'
    || (console.log(`        ${JSON.stringify(salle.scoreReel)} à la ${salle.minute}e`), false));
}

/* ================================== une salle ouverte sans minute

   Rien ne date alors un but : le rang décide seul, comme avant. */
{
  const emis = [];
  const salle = new VirageRoom({
    fixture: { id: 9020, homeId: 1, awayId: 2, homeName: 'A', awayName: 'B',
      status: '1H', elapsed: null, homeGoals: 1, awayGoals: 0 },
    emit: (e, p) => emis.push({ e, p }), log: { warn() {}, error() {} },
  });
  salle.join('n1', { side: 0, name: 'Un' });
  const r1 = salle.realGoal({ teamId: 1, minute: 9, player: 'Ancien', score: [1, 0] });
  const r2 = salle.realGoal({ teamId: 2, minute: 30, player: 'Frais', score: [1, 1] });
  check('sans minute à l’ouverture, le rang seul tait l’ancien et laisse sonner le frais',
    r1 === false && r2 === true
    && emis.filter((x) => x.e === 'virage:real_goal').length === 1
    || (console.log(`        rendus ${r1}/${r2}`), false));
}

/* ================================== une salle vide se libère

   `tick()` posait `last` juste avant que l'horloge commune teste
   `now - room.last > 60 s` : l'écart valait zéro, toujours, et aucune salle
   n'a jamais été libérée. C'est le seul endroit où la vraie horloge de
   `ferveur/index.js` tourne : on la laisse battre, puis on l'avance d'une
   minute.

   **Mais pas tant que le match se joue** : la salle garde ce que la base n'a
   pas — le score de la tribune, les partis et leur souffle —, et la libérer
   au premier téléphone verrouillé rendait un supporter neuf à qui était seul
   en tribune. Une minute suffit une fois le match fini. */
{
  const salle = virage.rooms.get(7001);
  for (const p of [B, C]) p.socket.disconnect();
  check('les derniers partis, la salle est vide', await until(() => salle.size === 0, 2000)
    || (console.log('        encore là :', [...salle.members.keys()].join(', ')), false));
  await wait(RULES.tickMs * 3);
  check('une salle vide reste ouverte', virage.rooms.has(7001));
  const tribune = JSON.stringify(salle.goals);
  const vrai = Date.now;
  const uneMinutePlusTard = async () => {
    Date.now = () => vrai() + 61_000;          // même ruse que virage-ui-smoke.mjs:202
    try { await wait(RULES.tickMs * 3); } finally { Date.now = vrai; }
  };
  await uneMinutePlusTard();
  check('le match en jeu, une minute plus tard, elle l’est encore, partis et score de tribune compris',
    virage.rooms.get(7001) === salle && salle.partis.size > 0 && JSON.stringify(salle.goals) === tribune);
  /* Le coup de sifflet, par le vrai chemin du relevé. */
  virage.matchStatus(7001, { status: 'FT', elapsed: 90 });
  await uneMinutePlusTard();
  check('le match fini, elle est libérée une minute après, malgré le battement',
    !virage.rooms.has(7001));
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
virage.stop(); io.close();
/* `exitCode` et non `process.exit()` : sous Windows, couper la boucle pendant
   que le pool rend ses sockets fait échouer la suite une fois sur cinq quand
   elle tourne à la file (ETAT.md, § 2). */
await pool.end();
await new Promise((r) => http.close(r));
process.exitCode = failures ? 1 : 0;
