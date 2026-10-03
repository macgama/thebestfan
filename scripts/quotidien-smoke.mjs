/**
 * Le quotidien (`src/server/quotidien/`, `src/shared/quotidien.js`) : les
 * missions du jour, le sachet, la carte de présence, la série, le carnet de
 * tampons, le relais, « depuis ta dernière visite » et la sonde du jour de jeu.
 *
 * ## Ce que cette suite défend
 *
 * **Le jour de jeu est celui de la base.** Chaque contrôle qui touche au temps
 * fige l'horloge de la base (`figerHorloge`) et sème en SQL, comme le serveur
 * écrit : `NOW(3)` pour un duel ou une présence, `CURDATE()` pour un compteur,
 * `UTC_TIMESTAMP()` pour un coup d'envoi. Node, lui, reste à l'heure réelle —
 * en octobre 2026 quand les dates figées tombent en novembre ou en mars : un
 * jour calculé en JavaScript n'y retrouve jamais celui de la base, et le
 * contrôle rougit. Les instants éprouvés sont ceux qui ont déjà coûté ailleurs :
 * midi, minuit et demi, 23:59:59 puis 00:00:01, le dimanche de 25 heures et
 * celui de 23 heures.
 *
 * **Une valeur exacte, jamais « plus que zéro »** : c'est ce qui avait caché le
 * forfait payé deux fois. Chaque versement est comparé au gain de sa ligne,
 * chaque course à un seul crédit.
 *
 * **Le serveur compte, le joueur ne déclare rien** : un corps qui porte
 * `{ echarpes: 9999 }` verse le montant de la ligne.
 *
 * **Abonné et non-abonné reçoivent la même chose**, et aucune mission ne
 * demande ce que le gratuit plafonne.
 *
 * **Rien ne passe par le pool sous le verrou de la bourse** : ni la recharge
 * d'un booster offert (comptée avant, sur le pool), ni la journée du football
 * d'une relance (lue avant). Sinon huit réclamations simultanées gèlent les
 * huit connexions de la production.
 *
 * **La lecture de l'état ne lit jamais la journée du football** hors tirage :
 * le hub la fait à chaque arrivée, et chaque lecture de la journée peut
 * réveiller l'API sportive. « Relançable » se juge sur le relevé d'une
 * minute qu'un tirage ou une relance a noté pour ce jour de jeu, ou se
 * présume ; la relance tranche.
 *
 * **Les vraies portes d'entrée** : un booster ouvert par la route du module
 * fanzzy, et un chant poussé par la socket de la salle du Virage, font
 * avancer leurs missions.
 *
 * ## Les doublures
 *
 * `niveau.gagnerDans` et `fanzzy.recharger` sont écrites par deux autres
 * périmètres. La suite prend **les vraies** dès qu'elles existent, et le dit
 * en tête ; sinon deux doublures qui suivent le code d'aujourd'hui
 * (celles de `recompenses-smoke`).
 *
 * ## Montréal
 *
 * À la fin, la suite se relance elle-même sous `TZ=America/Montreal`, en
 * gardant le verrou de la base : le fuseau de Node ne doit rien changer à ce
 * que le serveur compte.
 *
 * Usage : node scripts/quotidien-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server as SalleSocket } from 'socket.io';
import { io as client } from 'socket.io-client';
import { ORDRE } from './ordre-schema.mjs';
import { baseDeTest, OPTIONS_BASE, figerHorloge, enParallele } from './base-de-test.mjs';
import { createQuotidien, sonderJourDeJeu, phraseJourDeJeu } from '../src/server/quotidien/index.js';
import { createNiveau } from '../src/server/niveau/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { createAbonnement } from '../src/server/abonnement/index.js';
import { createSouvenirs } from '../src/server/souvenirs/index.js';
import { createVirage } from '../src/server/ferveur/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerSaisons } from '../src/server/fanzzy/saisons.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { assurerBourse } from '../src/server/bourse.js';
import { poserReglages, reglage, PAR_CLE } from '../src/shared/reglages.js';
import { niveauPour, progression, paliersEntre, ecarpesDuPalier } from '../src/shared/niveau.js';
import { CARNET_DEFAUT } from '../src/shared/saison.js';
import * as Q from '../src/shared/quotidien.js';

const DB = baseDeTest();
const SQL = fileURLToPath(new URL('../sql/', import.meta.url));
const ENFANT = process.env.TBF_QUOTIDIEN_ENFANT === '1';

let rates = 0;
let reussis = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (c) reussis++; else rates++; };
const voir = (...x) => (console.log('       ', ...x.map((v) => (typeof v === 'string' ? v
  : JSON.stringify(v)))), false);
const titre = (t) => console.log(`\n— ${t} —`);

const mysql = await import('mysql2/promise');

/* ================================================================ la base

   Table rase, puis le schéma entier dans l'ordre du déploiement
   (`ordre-schema.mjs`) : le quotidien lit une dizaine de tables posées par
   autant de fichiers, et c'est sur la base de production qu'il doit tourner.
   La liste des tables à supprimer se lit en base, et les clés étrangères sont
   coupées le temps du ménage : rien ne peut manquer. */
{
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  const [tables] = await raw.query(
    'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()');
  await raw.query('SET FOREIGN_KEY_CHECKS = 0');
  if (tables.length) await raw.query(`DROP TABLE IF EXISTS ${tables.map((r) => `\`${r.t}\``).join(', ')}`);
  await raw.query('SET FOREIGN_KEY_CHECKS = 1');
  for (const f of ORDRE) await raw.query(readFileSync(path.join(SQL, `${f}.sql`), 'utf8'));
  /* La saison 1 de la suite, à la place de celle qu'amorce saisons.sql :
     lancée le 1er octobre 2026, avant toutes les dates figées, et qui n'ouvre
     que LA REPRISE, comme la production. */
  await raw.query('DELETE FROM saisons');
  await raw.end();
}

/* Seize connexions : dix réclamations simultanées en tiennent dix pendant
   qu'elles attendent le verrou du joueur, et celle qui le tient doit encore
   pouvoir en prendre une. */
const pool = mysql.createPool({ uri: DB, connectionLimit: 16, ...OPTIONS_BASE });

/* Le compteur de requêtes : le budget de `GET /api/quotidien` se mesure ici. */
let compte = null;
for (const m of ['execute', 'query']) {
  const vraie = pool[m].bind(pool);
  pool[m] = (...a) => { if (compte) compte.push(String(a[0]).replace(/\s+/g, ' ').trim().slice(0, 70)); return vraie(...a); };
}
const q = async (sql, params = []) => (await pool.query(sql, params))[0];

const [{ insertId: S1 }] = await pool.query(
  `INSERT INTO saisons (numero, nom, series, tenues, lancee_a)
   VALUES (1, 'La reprise', JSON_ARRAY('RP'), JSON_ARRAY(), '2026-10-01 00:00:00')`);
await chargerCatalogue(pool);
await chargerTenues(pool);

/* --------------------------------------------------------- les doublures */

async function gagnerDansDoublure(conn, userId, montant) {
  const n = Math.max(0, Math.round(Number(montant) || 0));
  const [[r]] = await conn.execute('SELECT xp FROM user_wallet WHERE user_id = ? FOR UPDATE', [userId]);
  const avantXp = Number(r?.xp ?? 0);
  const apresXp = avantXp + n;
  const avant = niveauPour(avantXp);
  const apres = niveauPour(apresXp);
  let ecarpes = 0;
  for (let k = avant + 1; k <= apres; k++) ecarpes += ecarpesDuPalier(k);
  await conn.execute('UPDATE user_wallet SET xp = xp + ?, scarves = scarves + ? WHERE user_id = ?',
    [n, ecarpes, userId]);
  return { xp: apresXp, gain: n, ...progression(apresXp), avant, monte: apres > avant,
    paliers: paliersEntre(avant, apres), ecarpes, depart: { xp: avantXp, ...progression(avantXp) } };
}

async function rechargerDoublure(conn, userId) {
  const plafond = reglage('pack.max');
  const cadence = reglage('pack.regen_min') * 60_000;
  const [[w]] = await conn.execute(
    'SELECT packs, packs_at FROM user_wallet WHERE user_id = ? FOR UPDATE', [userId]);
  if (w.packs < plafond) {
    const gagnes = Math.floor((Date.now() - new Date(w.packs_at).getTime()) / cadence);
    if (gagnes > 0) {
      await conn.execute('UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?',
        [Math.min(plafond, w.packs + gagnes), new Date(new Date(w.packs_at).getTime() + gagnes * cadence),
          userId]);
    }
  } else {
    await conn.execute('UPDATE user_wallet SET packs_at = ? WHERE user_id = ?', [new Date(), userId]);
  }
}

/* -------------------------------------------------------------- le banc */

const requireAuth = (req, res, next) => (req.user ? next()
  : res.status(401).json({ error: 'auth.error.unauthenticated' }));
const niveauVrai = createNiveau({ pool, requireAuth });
const niveau = typeof niveauVrai.gagnerDans === 'function' ? niveauVrai
  : { ...niveauVrai, gagnerDans: gagnerDansDoublure };
const abonnement = createAbonnement({ pool, requireAuth });
const F = createFanzzy({ pool, requireAuth, niveau, abonnement });
const vraieRecharge = typeof F.recharger === 'function';
/* La porte de la recharge, telle que le quotidien la reçoit, avec un relevé
   de chaque appel : **sur le pool** (hors de tout verrou) ou **sur une
   connexion** (celle du versement, sous le verrou). Un versement qui porte
   un booster doit passer d'abord par le pool, pour n'avoir plus rien à
   demander au pool une fois le verrou pris. */
const appelsRecharge = [];
const fanzzy = {
  recharger: async (conn, userId) => {
    appelsRecharge.push(conn === pool ? 'pool' : 'connexion');
    return (vraieRecharge ? F.recharger : rechargerDoublure)(conn, userId);
  },
};
console.log(`\n  gagnerDans : ${niveau === niveauVrai ? 'la vraie (niveau)' : 'la doublure'}`
  + ` · recharger : ${vraieRecharge ? 'la vraie (fanzzy)' : 'la doublure'}`
  + ` · fuseau de Node : ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

/* La journée du football, fabriquée : des matchs placés à tant d'heures de
   l'instant figé de la base. Aucun appel à l'API.

   `surveille` : un joueur dont on veut savoir si quelqu'un tient le verrou de
   la bourse au moment où la journée est lue. En production, la journée passe
   par le pool (le cache du télétexte est une table) : la lire sous ce verrou,
   c'est demander une connexion en en tenant une, et huit relances simultanées
   gèlent le serveur. Une connexion à part tente le verrou sans attendre
   (`NOWAIT`) ; un refus veut dire qu'il était tenu.

   Comme en production, chaque lecture passe par le pool : là-bas, au moins
   deux requêtes (le cache du télétexte, puis les compétitions activées),
   ici une, assez pour que le budget d'une lecture de l'état la compte. */
let maintenant = 0;          // secondes Unix de l'horloge figée
let matchs = [];
let journeeLue = 0;
let surveille = null;
let journeeSousVerrou = 0;
const jourDuFoot = async () => {
  journeeLue++;
  await pool.query("SELECT 'journée du football' AS doublure");
  if (surveille) {
    try {
      await pool.query('SELECT user_id FROM user_wallet WHERE user_id = ? FOR UPDATE NOWAIT', [surveille]);
    } catch {
      journeeSousVerrou++;
    }
  }
  const parLigue = new Map();
  for (const x of matchs) {
    if (!parLigue.has(x.ligue)) parLigue.set(x.ligue, { ligue: { id: x.ligue, name: `L${x.ligue}` }, matchs: [] });
    parLigue.get(x.ligue).matchs.push({
      id: x.id, date: new Date((maintenant + x.dansH * 3600) * 1000).toISOString(),
      status: x.status, home: { id: x.home, name: `C${x.home}` }, away: { id: x.away, name: `C${x.away}` },
    });
  }
  return { groupes: [...parLigue.values()] };
};

const crochets = {};
const Qm = createQuotidien({ pool, requireAuth, niveau, fanzzy, jourDuFoot, crochets });

const app = express();
app.use((req, _res, next) => { const u = req.get('x-joueur'); if (u) req.user = { id: u }; next(); });
app.use('/api/quotidien', Qm.router);
app.use('/api/fanzzy', F.router);
app.use('/api/niveau', niveauVrai.router);
const http = createServer(app);

/* La salle du Virage, montée comme `server.js` la monte, sur la même base :
   un vrai chant, poussé par la socket, doit avancer la mission (contrôle
   d'intégration). L'identité vient du jeton de la poignée de main, comme
   dans `virage-smoke`. */
const io = new SalleSocket(http);
io.use((socket, next) => {
  socket.data.user = { userId: socket.handshake.auth.token, name: 'Fan' };
  next();
});
createVirage({ pool, io, requireAuth, souvenirs: createSouvenirs({ pool, requireAuth }), fanzzy: F });

await new Promise((r) => http.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${http.address().port}`;

async function appel(u, chemin, corps) {
  const r = await fetch(BASE + chemin, {
    method: corps === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(u ? { 'x-joueur': u } : {}) },
    body: corps === undefined ? undefined : (typeof corps === 'string' ? corps : JSON.stringify(corps)),
  });
  return { status: r.status, json: await r.json().catch(() => null) };
}
const lire = async (u, retour = false) => (await appel(u, `/api/quotidien${retour ? '?retour=1' : ''}`)).json;
const poster = async (u, route, corps = {}) => (await appel(u, `/api/quotidien/${route}`, corps)).json;

/* ------------------------------------------------------------- les aides */

async function figer(instant) {
  maintenant = await figerHorloge(pool, instant);
  /* `saisons.js` calcule ses durées au chargement : on le recharge à chaque
     changement d'horloge, comme un redémarrage le ferait. */
  await chargerSaisons(pool);
  return maintenant;
}
const jourSql = async (k = 0) => (await q(
  `SELECT DATE_FORMAT(CURDATE() - INTERVAL ${Number(k)} DAY, '%Y-%m-%d') AS j`))[0].j;

let numero = 0;
async function joueur({ clubs = [], scarves = 0 } = {}) {
  const id = randomUUID();
  numero++;
  await q(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [id, `quotidien${numero}@test.invalid`, `Quot${numero}`]);
  await assurerBourse(q, id);
  if (scarves) await q('UPDATE user_wallet SET scarves = ? WHERE user_id = ?', [scarves, id]);
  for (const c of clubs) await q('INSERT INTO user_follows (user_id, team_id) VALUES (?, ?)', [id, c]);
  return id;
}
const pseudo = async (u) => (await q('SELECT pseudo FROM users WHERE public_id = ?', [u]))[0].pseudo;

async function bourse(u) {
  const [w] = await q('SELECT scarves, packs, xp FROM user_wallet WHERE user_id = ?', [u]);
  return { scarves: Number(w.scarves), packs: Number(w.packs), xp: Number(w.xp) };
}

/** Le contrat d'un jour, écrit comme le tirage l'écrit : gains copiés des réglages. */
async function contrat(u, ids, { k = 0, saisonId = S1 } = {}) {
  const lignes = [];
  ids.forEach((id, rang) => {
    if (!id) return;
    const m = Q.MISSION_PAR_ID.get(id);
    const g = Q.gainMission(m.difficulte, { avecSaison: saisonId != null });
    lignes.push([rang, id, m.cible, g.echarpes, g.packs, g.xp, g.tampons]);
  });
  const s = Q.gainSachet({ avecSaison: saisonId != null });
  lignes.push([Q.RANG_SACHET, 'sachet', lignes.length, s.echarpes, s.packs, s.xp, s.tampons]);
  for (const l of lignes) {
    await q(`INSERT INTO missions_jour
               (user_id, jour, rang, mission, cible, echarpes, packs, xp, tampons, saison_id)
             VALUES (?, CURDATE() - INTERVAL ${Number(k)} DAY, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [u, ...l, saisonId]);
  }
}

/** Un duel fini, écrit comme la fin de duel l'écrit (`NOW(3)`). */
async function duel(u, { outcome = 'win', mode = 'entrainement', xp = 12, duree = 75, team = null,
  ilYaMin = 0 } = {}) {
  await q(`INSERT INTO duel_results
             (duel_id, user_id, opponent_id, outcome, mode, xp, duree_s, team_id, ended_at)
           VALUES (?, ?, 'adverse', ?, ?, ?, ?, ?, NOW(3) - INTERVAL ? MINUTE)`,
  [randomUUID(), u, outcome, mode, xp, duree, team, ilYaMin]);
}

/** Un match : le coup d'envoi en UTC, comme l'API le donne. */
async function match(id, { ligue = 61, home = 85, away = 91, coupDEnvoiMin = -30, statut = '1H',
  buts = [null, null] } = {}) {
  await q(`INSERT INTO fixtures (id, league_id, season, home_id, away_id, home_goals, away_goals,
                                 status_short, kickoff_at)
           VALUES (?, ?, 2026, ?, ?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)`,
  [id, ligue, home, away, buts[0], buts[1], statut, coupDEnvoiMin]);
}

/** Des chants au Virage : la présence d'un match, mise à jour à chaque poussée. */
async function chanter(u, fixtureId, { chants = 0, mt1 = 0, mt2 = 0, team = null } = {}) {
  await q(`INSERT INTO virage_presence (user_id, fixture_id, side, team_id, ferveur, chants,
                                        chants_mt1, chants_mt2)
           VALUES (?, ?, 0, ?, 10, ?, ?, ?)
           ON DUPLICATE KEY UPDATE chants = chants + VALUES(chants),
             chants_mt1 = chants_mt1 + VALUES(chants_mt1),
             chants_mt2 = chants_mt2 + VALUES(chants_mt2), last_push_at = NOW(3)`,
  [u, fixtureId, team, chants, mt1, mt2]);
}

async function compter(u, cle, n = 1) {
  await q(`INSERT INTO compteurs_jour (user_id, jour, cle, n) VALUES (?, CURDATE(), ?, ?)
           ON DUPLICATE KEY UPDATE n = n + VALUES(n)`, [u, cle, n]);
}

/** Des tampons déjà gagnés dans une saison, comme le grand livre les inscrit. */
async function tampons(u, saisonId, n, cle = 'ancien') {
  await q(`INSERT INTO recompenses (user_id, source, cle, saison_id, tampons)
           VALUES (?, 'mission', ?, ?, ?)`, [u, `${cle}:${saisonId}`, saisonId, n]);
}

const lignesDuJour = async (u, k = 0) => q(
  `SELECT rang, mission, cible, echarpes, packs, xp, tampons, saison_id, relancee
     FROM missions_jour WHERE user_id = ? AND jour = CURDATE() - INTERVAL ${Number(k)} DAY
    ORDER BY rang`, [u]);
const livre = async (u, source, cle) => q(
  'SELECT * FROM recompenses WHERE user_id = ? AND source = ? AND cle = ?', [u, source, cle]);
const ids = (e) => (e?.missions?.liste ?? []).map((x) => x.id);
const mission = (e, rang) => e?.missions?.liste?.find((x) => x.rang === rang);
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
/** Attend qu'une condition (éventuellement asynchrone) devienne vraie. */
async function jusqua(fn, ms = 4000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await fn()) return true;
    await attendre(25);
  }
  return false;
}
const somme = (rs, cle) => rs.reduce((s, r) => s + (r?.verse ? Number(r.gain?.[cle] ?? 0) : 0), 0);
const ecarpesDe = (rs) => rs.reduce((s, r) => s + (r?.verse ? Number(r.niveau?.ecarpes ?? 0) : 0), 0);
const reglagesDeDepart = () => poserReglages({});

/**
 * Ce que le tirage doit choisir, calculé ici : la première mission de l'ordre
 * du jour (`permutation`) qui est faisable, en évitant celle d'hier au même
 * rang quand une autre l'est.
 */
function attendu(jour, difficulte, faisables, hier = null) {
  let repli = null;
  for (const id of Q.permutation(jour, difficulte)) {
    if (!faisables.has(id)) continue;
    if (id !== hier) return id;
    repli = id;
  }
  return repli;
}

/* Les matchs du jour par défaut : deux compétitions, à venir. */
const JOURNEE = () => [
  { id: 7001, ligue: 61, dansH: 5, status: 'NS', home: 85, away: 91 },
  { id: 7002, ligue: 207, dansH: 4, status: 'NS', home: 300, away: 301 },
];
/* Ce qui est faisable pour un joueur sans club, sans Fanzzy, un jour de
   matchs : tout sauf « Fais grandir » et les deux missions de club. */
const SANS_CLUB = new Set(Q.MISSIONS.map((x) => x.id)
  .filter((id) => !['grandir', 'club_virage', 'club_duel'].includes(id)));

/* ============================================================ le catalogue */

titre('le catalogue');
{
  const CONTRAT = [
    ['boosters', 'facile', 3, 'boosters'], ['duel', 'facile', 1, 'duels'],
    ['virage', 'facile', 10, 'chants'], ['grandir', 'facile', 1, 'evolutions'],
    ['tribune', 'moyenne', 40, 'chants'], ['victoire', 'moyenne', 1, 'victoires'],
    ['classes', 'moyenne', 2, 'duels'], ['club_virage', 'moyenne', 20, 'chants'],
    ['club_duel', 'moyenne', 1, 'duels'], ['victoires', 'difficile', 3, 'victoires'],
    ['endurance', 'difficile', 5, 'duels'], ['mitemps', 'difficile', 10, 'chants_par_mi_temps'],
    ['ailleurs', 'difficile', 2, 'competitions'],
  ];
  const vu = Q.MISSIONS.map((x) => [x.id, x.difficulte, x.cible, x.unite]);
  check('treize missions, identifiants, difficultés, cibles et unités du contrat (§ 6.1)',
    JSON.stringify(vu) === JSON.stringify(CONTRAT) || voir(vu));
  check('chaque mission compte une source de la liste fermée',
    Q.MISSIONS.every((x) => Q.SOURCES.includes(x.source)));
  check('chaque mission se tire sur une condition de la liste fermée',
    Q.MISSIONS.every((x) => Q.CONDITIONS.includes(x.condition)));
  /* T6, T7 : rien qui paie la répétition, la note d'un geste, un ami, un
     parrainage, un KOP, un achat ou l'abonnement. */
  const interdites = Q.SOURCES.filter((s) =>
    /repet|geste|parfait|note|serie|ami|parrain|kop|achat|abonn|vote/i.test(s));
  check('aucune source ne compte la répétition, un geste noté, un ami, un parrainage ou un KOP',
    interdites.length === 0 || voir(interdites));
  check('chaque mission a sa bascule au registre, titrée de son intitulé',
    Q.MISSIONS.every((x) => PAR_CLE.get(`mission.${x.id}`)?.titre === x.titre(x.cible)
      && PAR_CLE.get(`mission.${x.id}`)?.type === 'booleen')
    || voir(Q.MISSIONS.filter((x) => PAR_CLE.get(`mission.${x.id}`)?.titre !== x.titre(x.cible))
      .map((x) => `${x.id} : « ${PAR_CLE.get(`mission.${x.id}`)?.titre} » ≠ « ${x.titre(x.cible)} »`)));
  /* L2 : sous les plafonds gratuits. */
  check('« Joue 2 duels classés » tient sous le plafond gratuit du registre',
    Q.MISSION_PAR_ID.get('classes').cible <= reglage('abo.duels_classes_jour'));
  check('aucune mission ne demande un Virage compté',
    !Q.MISSIONS.some((x) => /classe|compt/i.test(x.condition) && x.source === 'chants'));
  check('la carte de présence vaut 20, 25 … 50 écharpes, et un booster à la septième case',
    JSON.stringify(Q.montantsCarte().map((g) => [g.echarpes, g.packs]))
      === JSON.stringify([[20, 0], [25, 0], [30, 0], [35, 0], [40, 0], [45, 0], [50, 1]]));
}

/* =========================================================== l'horloge */

titre('l’horloge figée de la base');
{
  await figer('2026-11-10 12:00:00');
  const a = await pool.getConnection();
  const b = await pool.getConnection();
  const [[ra]] = await a.query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS n, CONNECTION_ID() AS c");
  const [[rb]] = await b.query("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS n, CONNECTION_ID() AS c");
  a.release(); b.release();
  check('SELECT NOW() rend l’instant figé, sur deux connexions différentes',
    ra.c !== rb.c && ra.n === '2026-11-10 12:00:00' && rb.n === '2026-11-10 12:00:00' || voir(ra, rb));
}

/* ============================================================ le tirage */

titre('le tirage du jour');
{
  await figer('2026-11-10 12:00:00');
  matchs = JOURNEE();
  const jour = await jourSql();
  const A = await joueur();

  const cinq = await enParallele(5, () => lire(A));
  const listes = cinq.map((e) => ids(e).join(','));
  check('cinq lectures simultanées au premier passage : les mêmes missions',
    new Set(listes).size === 1 && listes[0].split(',').length === 3 || voir(listes));
  const lignes = await lignesDuJour(A);
  check('et quatre lignes en base, pas davantage (trois missions et le sachet)',
    lignes.length === 4 && lignes[3].mission === 'sachet' && Number(lignes[3].cible) === 3
    || voir(lignes.map((l) => `${l.rang}:${l.mission}`)));
  const voulu = Q.DIFFICULTES.map((d) => attendu(jour, d, SANS_CLUB));
  check(`chaque difficulté prend la première mission faisable de l’ordre du jour (${voulu.join(', ')})`,
    listes[0] === voulu.join(',') || voir(listes[0], voulu));
  check('les gains sont copiés des réglages au tirage (30/20/1, 60/40/1, 100/60/2)',
    lignes.slice(0, 3).map((l) => [l.echarpes, l.xp, l.tampons].join('/')).join(' ')
      === '30/20/1 60/40/1 100/60/2' || voir(lignes));
  check('la saison du tirage est la saison en cours, ouverte',
    lignes.every((l) => Number(l.saison_id) === S1));

  /* Deux joueurs qui se parlent parlent de la même chose : le tirage ne
     dépend que du jour et des conditions, jamais du joueur. */
  const autres = [];
  for (let i = 0; i < 4; i++) autres.push(ids(await lire(await joueur())).join(','));
  check('quatre autres joueurs aux mêmes conditions : les mêmes missions',
    autres.every((x) => x === listes[0]) || voir(autres));

  const C = await joueur({ clubs: [85] });
  const avecClub = new Set([...SANS_CLUB, 'club_virage', 'club_duel']);
  const eC = await lire(C);
  check('un supporter dont le club joue tire dans un ensemble plus large',
    ids(eC).join(',') === Q.DIFFICULTES.map((d) => attendu(jour, d, avecClub)).join(',')
    || voir(ids(eC)));
}

titre('un joueur sans club suivi n’a jamais de mission de club');
{
  const G = await joueur();
  let vus = 0;
  let enTete = 0;
  let hier = null;
  for (let i = 0; i < 14; i++) {
    await figer(`2026-11-${String(11 + i).padStart(2, '0')} 12:00:00`);
    matchs = JOURNEE();
    const jour = await jourSql();
    if (['club_virage', 'club_duel'].includes(Q.permutation(jour, 'moyenne')[0])) enTete++;
    const e = await lire(G);
    const l = ids(e);
    if (l.some((id) => id.startsWith('club_'))) vus++;
    const voulu = Q.DIFFICULTES.map((d, r) => attendu(jour, d, SANS_CLUB, hier?.[r]));
    if (l.join(',') !== voulu.join(',')) { vus += 100; voir(jour, l, voulu); }
    hier = l;
  }
  check('quatorze jours, aucune mission de club, et chaque jour le bon tirage', vus === 0);
  check(`dont ${enTete} jour(s) où l’ordre du jour mettait une mission de club en tête`, enTete > 0);
}

titre('la mission d’hier au même rang est évitée quand une autre est faisable');
{
  await figer('2026-11-27 12:00:00');
  matchs = JOURNEE();
  const jour = await jourSql();
  const I = await joueur();
  const premiere = attendu(jour, 'facile', SANS_CLUB);
  await contrat(I, [premiere, 'victoire', 'endurance'], { k: 1 });
  const e = await lire(I);
  check(`hier « ${premiere} » au rang facile : aujourd’hui la suivante faisable`,
    mission(e, 0)?.id === attendu(jour, 'facile', SANS_CLUB, premiere) && mission(e, 0)?.id !== premiere
    || voir(ids(e)));
}

titre('une bascule éteinte sort la mission du tirage du lendemain');
{
  await figer('2026-11-28 12:00:00');
  matchs = JOURNEE();
  const H = await joueur();
  const aujourdhui = ids(await lire(H));
  await figer('2026-11-29 12:00:00');
  const demain = await jourSql();
  await figer('2026-11-28 12:30:00');
  const visee = attendu(demain, 'difficile', SANS_CLUB, aujourdhui[2]);
  poserReglages({ [`mission.${visee}`]: false });
  check('les missions déjà tirées aujourd’hui restent', ids(await lire(H)).join(',') === aujourdhui.join(','));
  await figer('2026-11-29 12:00:00');
  const sans = new Set([...SANS_CLUB].filter((x) => x !== visee));
  const e = await lire(H);
  check(`« ${visee} » éteinte : le lendemain, la difficile est une autre`,
    mission(e, 2)?.id !== visee && mission(e, 2)?.id === attendu(demain, 'difficile', sans, aujourdhui[2])
    || voir(ids(e)));
  reglagesDeDepart();
}

/* ========================================================= la progression */

titre('la progression, semée comme le serveur écrit');
{
  await figer('2026-12-01 15:00:00');
  matchs = JOURNEE();

  const P = await joueur();
  await contrat(P, ['boosters', 'victoire', 'endurance']);
  await compter(P, 'booster', 2);
  let e = await lire(P);
  check('deux boosters ouverts : « Ouvre 3 boosters » à 2 sur 3, en cours',
    mission(e, 0)?.fait === 2 && mission(e, 0)?.cible === 3 && mission(e, 0)?.etat === 'en_cours'
    || voir(mission(e, 0)));

  /* Le forfait de trois secondes et le joueur parti ne font rien. */
  await duel(P, { outcome: 'win', xp: 12, duree: 3 });
  await duel(P, { outcome: 'loss', xp: 0, duree: 300 });
  e = await lire(P);
  check('une victoire de trois secondes ne fait pas « Gagne un duel »', mission(e, 1)?.fait === 0
    || voir(mission(e, 1)));
  check('un duel quitté (sans XP) ne compte pas pour « Joue 5 duels »', mission(e, 2)?.fait === 0
    || voir(mission(e, 2)));
  await duel(P, { outcome: 'win', xp: 12, duree: 75 });
  e = await lire(P);
  check('la même victoire en 75 secondes la fait : prête', mission(e, 1)?.fait === 1
    && mission(e, 1)?.etat === 'pret' || voir(mission(e, 1)));
  check('et compte pour « Joue 5 duels » (1 sur 5)', mission(e, 2)?.fait === 1);
  check('aReclamer compte la mission prête, et le bonus du jour', e.aReclamer === 2 || voir(e.aReclamer));

  /* Un booster ouvert par la vraie route du module fanzzy. */
  const ecrit = readFileSync(fileURLToPath(new URL('../src/server/fanzzy/index.js', import.meta.url)),
    'utf8').includes('compteurs_jour');
  if (!ecrit) {
    console.log('   ..  en attente du périmètre fanzzy : il n’écrit pas encore compteurs_jour');
  } else {
    const r = await appel(P, '/api/fanzzy/open', { set: 'RP' });
    e = await lire(P);
    check('un booster ouvert par POST /api/fanzzy/open fait avancer « Ouvre 3 boosters » (3 sur 3)',
      r.status === 200 && mission(e, 0)?.fait === 3 && mission(e, 0)?.etat === 'pret'
      || voir(r.status, r.json?.error, mission(e, 0)));
  }

  /* Le Virage : les chants d'un match qui se joue aujourd'hui. */
  const V = await joueur();
  await contrat(V, ['virage', 'tribune', 'mitemps']);
  await match(8001, { coupDEnvoiMin: -30, statut: '1H' });
  await chanter(V, 8001, { chants: 12, mt1: 12 });
  e = await lire(V);
  check('douze chants : « Chante 10 fois » prête, « Chante 40 fois » à 12',
    mission(e, 0)?.etat === 'pret' && mission(e, 0)?.fait === 10 && mission(e, 1)?.fait === 12
    || voir(mission(e, 0), mission(e, 1)));
  check('une seule mi-temps chantée : « chaque mi-temps » reste à 0', mission(e, 2)?.fait === 0);
  await chanter(V, 8001, { chants: 11, mt2: 11 });
  e = await lire(V);
  check('onze dans la seconde : 10 sur 10, prête', mission(e, 2)?.fait === 10
    && mission(e, 2)?.etat === 'pret' || voir(mission(e, 2)));

  const W = await joueur();
  await contrat(W, ['duel', 'victoire', 'ailleurs']);
  await match(8002, { ligue: 207, home: 300, away: 301, coupDEnvoiMin: -20 });
  await chanter(W, 8001, { chants: 10 });
  await chanter(W, 8002, { chants: 9 });
  e = await lire(W);
  check('dix chants dans une compétition, neuf dans l’autre : une compétition sur deux',
    mission(e, 2)?.fait === 1 || voir(mission(e, 2)));
  await chanter(W, 8002, { chants: 1 });
  e = await lire(W);
  check('un chant de plus : deux compétitions, prête', mission(e, 2)?.fait === 2
    && mission(e, 2)?.etat === 'pret');

  /* Pour son club : la présence et le duel portent le club poussé. */
  const K = await joueur({ clubs: [85] });
  await contrat(K, ['duel', 'club_virage', 'victoires']);
  await chanter(K, 8001, { chants: 15, team: 91 });
  await chanter(K, 8002, { chants: 30, team: null });
  e = await lire(K);
  check('des chants pour un autre club ou en neutre ne font pas « pour ton club »',
    mission(e, 1)?.fait === 0 || voir(mission(e, 1)));
  await match(8003, { coupDEnvoiMin: -10, home: 85, away: 92 });
  await chanter(K, 8003, { chants: 20, team: 85 });
  e = await lire(K);
  check('vingt chants pour son club : prête', mission(e, 1)?.fait === 20 && mission(e, 1)?.etat === 'pret');
  const K2 = await joueur({ clubs: [85] });
  await contrat(K2, ['duel', 'club_duel', 'victoires']);
  await duel(K2, { team: 91 });
  e = await lire(K2);
  check('un duel pour un autre club ne fait pas « Joue un duel pour ton club »', mission(e, 1)?.fait === 0);
  await duel(K2, { team: 85 });
  e = await lire(K2);
  check('un duel pour son club la fait', mission(e, 1)?.fait === 1 && mission(e, 1)?.etat === 'pret');
}

titre('un vrai chant, par la salle du Virage');
{
  /* Le contrôle d'intégration du compteur de chants : la socket
     `virage:chant`, la salle, `recordPush` du module des souvenirs, la ligne
     de présence, puis la mission. La salle n'attend pas l'écriture : on relit
     la base jusqu'à ce que la ligne bouge. Un supporter neutre (aucun club
     suivi) : ses chants comptent aussi. */
  await figer('2026-12-02 15:00:00');
  matchs = JOURNEE();
  await q("INSERT IGNORE INTO teams (id, name) VALUES (85, 'FC Sion'), (91, 'FC Bâle')");
  const U = await joueur();
  await contrat(U, ['virage', 'tribune', 'mitemps']);
  await match(8101, { coupDEnvoiMin: -20, statut: '1H' });

  const sock = client(BASE, { transports: ['websocket'], auth: { token: U } });
  let etat = null;
  const resultats = [];
  const erreurs = [];
  sock.on('virage:state', (s) => { etat = s; });
  sock.on('virage:result', (r) => resultats.push(r));
  sock.on('virage:error', (x) => erreurs.push(x?.code));
  await jusqua(() => sock.connected);
  sock.emit('virage:join', { fixtureId: 8101, camp: 'domicile' });
  await jusqua(() => etat || erreurs.length);
  /* Un chant de rythme parmi ceux que la salle offre maintenant : des
     frappes humaines (écarts irréguliers), justes ou non — un chant raté
     compte aussi, le serveur l'a accepté. */
  const carte = (etat?.cards ?? []).find((c) => c.gest === 'tempo');
  check('la salle s’ouvre et offre un chant de rythme', Boolean(carte) || voir(erreurs, etat?.cards?.map((c) => c.gest)));
  if (carte) {
    sock.emit('virage:chant', { cardId: carte.id, taps: [0, 571, 1108, 1694, 2233, 2817, 3352, 3929] });
    await jusqua(() => resultats.length || erreurs.length);
    check('le chant est accepté par la salle', resultats.length === 1 && !erreurs.length || voir(resultats, erreurs));
    const ligne = async () => (await q(
      'SELECT chants, chants_mt1, chants_mt2 FROM virage_presence WHERE user_id = ? AND fixture_id = 8101', [U]))[0];
    await jusqua(async () => Number((await ligne())?.chants) >= 1);
    const l = await ligne();
    check('la présence compte un chant, en première mi-temps',
      Number(l?.chants) === 1 && Number(l?.chants_mt1) === 1 && Number(l?.chants_mt2) === 0 || voir(l));
    const e = await lire(U);
    check('et la mission le lit : « Chante 10 fois » à 1, « Chante 40 fois » à 1, « chaque mi-temps » à 0',
      mission(e, 0)?.fait === 1 && mission(e, 1)?.fait === 1 && mission(e, 2)?.fait === 0
      || voir(mission(e, 0), mission(e, 1), mission(e, 2)));
  }
  sock.disconnect();
}

/* ============================================================ les versements */

titre('les versements d’une mission');
{
  await figer('2026-12-03 12:00:00');
  matchs = JOURNEE();
  const jour = await jourSql();

  const V = await joueur();
  await contrat(V, ['boosters', 'victoire', 'endurance']);
  await duel(V, { outcome: 'win' });
  /* T9 : un réglage changé après le tirage ne change pas la promesse. */
  poserReglages({ 'missions.moyenne_echarpes': 300, 'missions.moyenne_xp': 200 });
  const avant = await bourse(V);
  const r = await poster(V, 'mission', { jour, rang: 1, id: 'victoire' });
  const apres = await bourse(V);
  check('la mission prête est versée', r?.verse === true || voir(r));
  check('le gain est celui de la ligne, copié au tirage (60 écharpes, 40 XP, 1 tampon), pas le réglage du moment',
    JSON.stringify(r?.gain) === JSON.stringify({ echarpes: 60, packs: 0, xp: 40, tampons: 1 }) || voir(r?.gain));
  check('la bourse monte exactement de 60 écharpes (et des écharpes de palier de niveau)',
    apres.scarves === avant.scarves + 60 + (r?.niveau?.ecarpes ?? 0) || voir(avant, apres, r?.niveau));
  check('l’XP monte exactement de 40', apres.xp === avant.xp + 40);
  check('la réponse porte la bourse et la jauge (R6, § 1)',
    r?.wallet?.scarves === apres.scarves && r?.wallet?.packs === apres.packs && r?.niveau?.gain === 40);
  check('et l’état à jour : la mission est « reclamee »', mission(r?.quotidien, 1)?.etat === 'reclamee');
  const ligne = (await livre(V, 'mission', `${jour}:1`))[0];
  check('une ligne au grand livre, à la clé du jour et du rang, dans la saison du contrat',
    ligne && Number(ligne.echarpes) === 60 && Number(ligne.tampons) === 1 && Number(ligne.saison_id) === S1);
  const encore = await poster(V, 'mission', { jour, rang: 1, id: 'victoire' });
  check('la redemander : « deja »', encore?.verse === false && encore?.raison === 'deja');

  /* Le lendemain, le nouveau montant. */
  await figer('2026-12-04 12:00:00');
  const e = await lire(V);
  const l1 = (await lignesDuJour(V)).find((l) => Number(l.rang) === 1);
  check('le lendemain, la mission moyenne tirée porte le nouveau montant (300 écharpes, 200 XP)',
    Number(l1?.echarpes) === 300 && Number(l1?.xp) === 200 && mission(e, 1)?.gain?.echarpes === 300
    || voir(l1));
  reglagesDeDepart();

  await figer('2026-12-03 13:00:00');
  for (const n of [2, 10]) {
    const D = await joueur();
    await contrat(D, ['boosters', 'victoire', 'endurance']);
    await duel(D);
    const b0 = await bourse(D);
    const rs = await enParallele(n, () => poster(D, 'mission', { jour, rang: 1, id: 'victoire' }));
    const b1 = await bourse(D);
    const verses = rs.filter((x) => x?.verse === true);
    check(`${n} réclamations simultanées : un seul versement, ${n - 1} « deja »`,
      verses.length === 1 && rs.filter((x) => x?.raison === 'deja').length === n - 1
      || voir(rs.map((x) => x?.raison ?? x?.verse)));
    check(`et la bourse ne monte qu’une fois (${n})`,
      b1.scarves === b0.scarves + 60 + (verses[0]?.niveau?.ecarpes ?? 0) && b1.xp === b0.xp + 40
      || voir(b0, b1));
  }

  /* T1 : le montant ne vient jamais du corps. */
  const T = await joueur();
  await contrat(T, ['boosters', 'victoire', 'endurance']);
  await duel(T);
  const b0 = await bourse(T);
  const rt = await poster(T, 'mission', { jour, rang: 1, id: 'victoire', montant: 9999, echarpes: 9999,
    xp: 9999, gain: { echarpes: 9999 } });
  const b1 = await bourse(T);
  check('un corps qui porte { montant: 9999, echarpes: 9999 } verse le montant de la ligne',
    rt?.verse === true && rt.gain.echarpes === 60 && b1.scarves === b0.scarves + 60 + (rt.niveau?.ecarpes ?? 0)
    || voir(rt?.gain, b0, b1));

  const X = await joueur();
  await contrat(X, ['boosters', 'victoire', 'endurance']);
  await duel(X);
  const rc = await poster(X, 'mission', { jour, rang: 1, id: 'tribune' });
  check('un identifiant qui n’est plus celui de la ligne : « change »', rc?.verse === false && rc.raison === 'change'
    || voir(rc));
  const ri = await poster(X, 'mission', { jour, rang: 2, id: 'endurance' });
  check('une mission pas terminée, au recompte : « incomplet »', ri?.raison === 'incomplet' || voir(ri));
  const Y = await joueur();
  await contrat(Y, ['boosters', 'victoire', 'endurance'], { k: 2 });
  await duel(Y, { ilYaMin: 2 * 24 * 60 });
  const rj = await poster(Y, 'mission', { jour: await jourSql(2), rang: 1, id: 'victoire' });
  check('une ligne d’avant-hier : « jour_passe »', rj?.verse === false && rj.raison === 'jour_passe' || voir(rj));
  /* Un joueur neuf : la réponse d'une réclamation porte l'état du jour, et le
     lire tire les missions — celui d'avant a déjà les siennes. */
  const Y2 = await joueur();
  const rn = await poster(Y2, 'mission', { jour, rang: 0, id: 'boosters' });
  check('une mission qui n’existe pas : « inconnu »', rn?.raison === 'inconnu' || voir(rn?.raison));

  /* Les refus HTTP du contrat (§ 11). */
  const r400 = await appel(Y, '/api/quotidien/mission', { jour, rang: 7, id: 'victoire' });
  check('un rang hors de 0 à 2 : 400 quotidien.error.requete',
    r400.status === 400 && r400.json?.error === 'quotidien.error.requete');
  const rjson = await appel(Y, '/api/quotidien/mission', '{pas du json');
  check('un corps qui n’est pas du JSON : 400 quotidien.error.requete',
    rjson.status === 400 && rjson.json?.error === 'quotidien.error.requete' || voir(rjson));
  const r401 = await appel(null, '/api/quotidien');
  check('sans session : 401 auth.error.unauthenticated',
    r401.status === 401 && r401.json?.error === 'auth.error.unauthenticated');
}

/* ================================================================= minuit */

titre('minuit : la mission d’hier se récupère le lendemain');
{
  await figer('2026-12-05 23:59:59');
  matchs = JOURNEE();
  const M = await joueur();
  await contrat(M, ['duel', 'victoire', 'endurance']);
  await duel(M);
  let e = await lire(M);
  check('à 23:59:59, « Joue un duel » est prête le 2026-12-05',
    e.jour === '2026-12-05' && mission(e, 0)?.etat === 'pret' || voir(e.jour, mission(e, 0)));
  await figer('2026-12-06 00:00:01');
  const r = await poster(M, 'mission', { jour: '2026-12-05', rang: 0, id: 'duel' });
  check('à 00:00:01, la mission d’hier est versée (délai de grâce)', r?.verse === true || voir(r));
  e = r?.quotidien;
  check('l’état relu montre les missions du jour (2026-12-06)',
    e?.jour === '2026-12-06' && e?.missions?.jour === '2026-12-06' && ids(e).length === 3 || voir(e?.jour, e?.missions?.jour));
  check('et, hier, ce qui reste à récupérer : « Gagne un duel », pas celle qu’on vient de prendre',
    e?.missions?.hier?.jour === '2026-12-05'
    && JSON.stringify(e.missions.hier.liste.map((x) => [x.id, x.etat, x.relancable]))
      === JSON.stringify([['victoire', 'pret', false]]) || voir(e?.missions?.hier));
  check('aReclamer compte la mission d’hier', e?.aReclamer === 2 || voir(e?.aReclamer));
}

/* ====================================================== J1 et J3 : le jour */

titre('J1 : à 00:30, les classés du jour comptent les mêmes lignes que le quota');
{
  await figer('2026-12-08 00:30:00');
  matchs = JOURNEE();
  const J = await joueur();
  await contrat(J, ['duel', 'classes', 'endurance']);
  await duel(J, { mode: 'classe', xp: 20, duree: 120, ilYaMin: 40 });   // 23:50, hier
  await duel(J, { mode: 'classe', xp: 20, duree: 120, ilYaMin: 20 });   // 00:10
  await duel(J, { mode: 'classe', xp: 20, duree: 120, ilYaMin: 10 });   // 00:20
  const e = await lire(J);
  const reste = await abonnement.duelsClassesRestants(J);
  check('« Joue 2 duels classés » : 2, comme le quota (deux joués depuis minuit)',
    mission(e, 1)?.fait === 2 && reglage('abo.duels_classes_jour') - reste === 2 || voir(mission(e, 1), reste));
  check('le duel de 23:50 compte pour hier dans les deux', mission(e, 2)?.fait === 2);
}

titre('J3 : la fin du jour, les jours de 25 et de 23 heures');
{
  const U = await joueur();
  for (const [instant, ms, quoi] of [
    ['2026-12-10 12:00:00', 43_200_000, 'un jour ordinaire, à midi : 12 h'],
    ['2026-10-25 00:30:00', 88_200_000, 'le 25 octobre à 00:30 : 24 h 30 (jour de 25 h)'],
    ['2027-03-28 00:30:00', 81_000_000, 'le 28 mars à 00:30 : 22 h 30 (jour de 23 h)'],
  ]) {
    await figer(instant);
    const e = await lire(U);
    check(`finDuJourMs, ${quoi}`, e.finDuJourMs === ms || voir(e.finDuJourMs, ms));
  }
}

/* =================================================== la carte de présence */

titre('la carte de présence et la série');
{
  const B = await joueur();
  const prendre = async (instant) => {
    await figer(instant);
    const avant = await lire(B);
    const b0 = await bourse(B);
    const r = await poster(B, 'bonus');
    const b1 = await bourse(B);
    return { avant, r, b0, b1 };
  };
  let x = await prendre('2026-12-12 10:00:00');
  check('jour 1 : case 1, 20 écharpes, versées exactement',
    x.avant.bonus?.carte?.case === 1 && x.avant.bonus.pret === true && x.avant.bonus.gain?.echarpes === 20
    && x.r?.verse === true && x.b1.scarves === x.b0.scarves + 20 || voir(x.avant.bonus, x.r));
  const apres = x.r.quotidien;
  check('après : la case 1 cochée, plus de gain, plus de bouton',
    apres.bonus?.pret === false && apres.bonus.carte.prise === true && apres.bonus.carte.case === 1
    && !('gain' in apres.bonus) || voir(apres.bonus));
  check('la série : 1 jour, record 1', JSON.stringify(apres.serie) === '{"jours":1,"record":1}' || voir(apres.serie));
  x = await prendre('2026-12-13 10:00:00');
  check('jour 2 : case 2, 25 écharpes', x.avant.bonus?.carte?.case === 2 && x.r?.gain?.echarpes === 25);
  x = await prendre('2026-12-14 10:00:00');
  check('trois jours d’affilée : case 3, série 3',
    x.r?.gain?.echarpes === 30 && x.r.quotidien.bonus.carte.case === 3 && x.r.quotidien.serie?.jours === 3);

  await figer('2026-12-16 10:00:00');
  let e = await lire(B);
  check('un trou d’un jour : la case continue (4), rien ne recule',
    e.bonus?.carte?.case === 4 && e.bonus.gain?.echarpes === 35 || voir(e.bonus));
  x = await prendre('2026-12-16 10:00:01');
  check('la série repart à 1, le record reste à 3',
    JSON.stringify(x.r?.quotidien?.serie) === '{"jours":1,"record":3}' || voir(x.r?.quotidien?.serie));

  await figer('2026-12-19 10:00:00');
  e = await lire(B);
  check('un trou de deux jours : la série est servie, à 0, le record inchangé',
    JSON.stringify(e.serie) === '{"jours":0,"record":3}' || voir(e.serie));
  check('et la case attend : 5', e.bonus?.carte?.case === 5);

  /* Le réglage du bonus vaut tout de suite. */
  poserReglages({ 'bonus.base': 30 });
  e = await lire(B);
  check('« bonus.base » changé à 30 : la case 5 vaut 50 tout de suite', e.bonus?.gain?.echarpes === 50
    || voir(e.bonus?.gain));
  reglagesDeDepart();

  x = await prendre('2026-12-19 10:00:01');
  x = await prendre('2026-12-20 10:00:00');
  const b0 = await bourse(B);
  appelsRecharge.length = 0;
  x = await prendre('2026-12-21 10:00:00');
  check('la septième case : 50 écharpes et un booster, la réserve monte d’un',
    x.r?.gain?.echarpes === 50 && x.r.gain.packs === 1 && x.b1.packs >= b0.packs + 1
    && x.r.quotidien.bonus.carte.case === 7 || voir(x.r?.gain, b0, x.b1));
  check('son booster : la recharge comptée avant le verrou, puis dessous',
    JSON.stringify(appelsRecharge) === '["pool","connexion"]' || voir(appelsRecharge));
  await figer('2026-12-22 10:00:00');
  e = await lire(B);
  check('après la septième, une carte neuve : case 1', e.bonus?.carte?.case === 1 && e.bonus.gain?.echarpes === 20);

  for (const n of [2, 10]) {
    const D = await joueur();
    const rs = await enParallele(n, () => poster(D, 'bonus'));
    const nb = Number((await q("SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND source = 'bonus'", [D]))[0].n);
    check(`${n} onglets : un seul bonus`, rs.filter((r) => r?.verse).length === 1 && nb === 1
      || voir(rs.map((r) => r?.raison ?? r?.verse)));
  }
}

/* ================================================================ le sachet */

titre('le sachet');
{
  await figer('2026-12-23 12:00:00');
  matchs = JOURNEE();
  const jour = await jourSql();
  const S = await joueur();
  await contrat(S, ['duel', 'victoire', 'victoires']);
  for (let i = 0; i < 3; i++) await duel(S);
  let r = await poster(S, 'sachet', { jour });
  check('le sachet avant les trois missions : « incomplet »', r?.raison === 'incomplet' || voir(r));
  appelsRecharge.length = 0;
  await poster(S, 'mission', { jour, rang: 0, id: 'duel' });
  check('une mission ne porte pas de booster : la recharge n’est pas appelée', appelsRecharge.length === 0
    || voir(appelsRecharge));
  await poster(S, 'mission', { jour, rang: 1, id: 'victoire' });
  let e = await lire(S);
  check('deux sur trois : le sachet est en cours, 2 / 3',
    JSON.stringify(e.missions.sachet) === JSON.stringify({ etat: 'en_cours', faites: 2, sur: 3,
      gain: { echarpes: 0, packs: 1, xp: 0, tampons: 1 } }) || voir(e.missions.sachet));
  await poster(S, 'mission', { jour, rang: 2, id: 'victoires' });
  e = await lire(S);
  check('les trois récupérées : le sachet est prêt, et compté', e.missions.sachet.etat === 'pret'
    && e.aReclamer === 2 || voir(e.missions.sachet, e.aReclamer));
  const b0 = await bourse(S);
  appelsRecharge.length = 0;
  r = await poster(S, 'sachet', { jour });
  const b1 = await bourse(S);
  check('le sachet est versé : un booster, un tampon', r?.verse === true && r.gain.packs === 1
    && r.gain.tampons === 1 && b1.packs >= b0.packs + 1 || voir(r));
  check('puis « reclame »', r?.quotidien?.missions?.sachet?.etat === 'reclame');
  /* Sous le verrou, la recharge ne doit plus rien demander au pool : elle a
     été comptée juste avant, sur le pool, hors de tout verrou. */
  check('la recharge est comptée avant le verrou (sur le pool), puis dessous (sur la connexion)',
    JSON.stringify(appelsRecharge) === '["pool","connexion"]' || voir(appelsRecharge));

  /* Deux onglets, puis dix : un seul sachet. La réserve est pleine, pour que
     la recharge ne brouille pas le compte : le cadeau entre au-dessus. */
  for (const n of [2, 10]) {
    const D = await joueur();
    await contrat(D, ['duel', 'victoire', 'victoires']);
    for (let i = 0; i < 3; i++) await duel(D);
    for (const [rang, id] of [[0, 'duel'], [1, 'victoire'], [2, 'victoires']]) {
      await poster(D, 'mission', { jour, rang, id });
    }
    await q('UPDATE user_wallet SET packs = ? WHERE user_id = ?', [reglage('pack.max'), D]);
    const p0 = (await bourse(D)).packs;
    const rs = await enParallele(n, () => poster(D, 'sachet', { jour }));
    const p1 = (await bourse(D)).packs;
    check(`${n} réclamations simultanées du sachet : un versement, ${n - 1} « deja », un booster de plus`,
      rs.filter((x) => x?.verse === true).length === 1
      && rs.filter((x) => x?.raison === 'deja').length === n - 1 && p1 === p0 + 1
      || voir(rs.map((x) => x?.raison ?? x?.verse), p0, p1));
  }

  /* Le sachet ne mange pas la recharge en attente. */
  const S2 = await joueur();
  await contrat(S2, ['duel', 'victoire', 'victoires']);
  for (let i = 0; i < 3; i++) await duel(S2);
  for (const [rang, id] of [[0, 'duel'], [1, 'victoire'], [2, 'victoires']]) {
    await poster(S2, 'mission', { jour, rang, id });
  }
  const cadence = reglage('pack.regen_min') * 60_000;
  await q('UPDATE user_wallet SET packs = 11, packs_at = ? WHERE user_id = ?',
    [new Date(Date.now() - cadence - 1000), S2]);
  r = await poster(S2, 'sachet', { jour });
  check('sachet reçu à 11 sur 12 avec une recharge due : 13, et non 12', r?.wallet?.packs === 13
    || voir(r?.wallet));
}

/* ============================================================ la relance */

titre('la relance');
{
  await figer('2027-01-05 12:00:00');
  matchs = JOURNEE();
  const jour = await jourSql();
  const R = await joueur();
  await contrat(R, ['boosters', 'victoire', 'endurance']);
  let e = await lire(R);
  check('une relance par jour, et les missions en cours sont relançables',
    e.missions.relances === 1 && e.missions.liste.every((x) => x.relancable === true) || voir(e.missions));
  const gain0 = (await lignesDuJour(R))[1];
  const r = await poster(R, 'relance', { rang: 1, id: 'victoire' });
  const remplacante = await Q.remplacante({ jour, difficulte: 'moyenne', actuelle: 'victoire',
    faisable: (id) => SANS_CLUB.has(id) });
  const gain1 = (await lignesDuJour(R))[1];
  check(`relancée : « victoire » devient « ${remplacante} », la suivante de l’ordre du jour`,
    r?.relancee === true && gain1.mission === remplacante && mission(r.quotidien, 1)?.id === remplacante
    || voir(r, gain1));
  check('la mission relancée garde le gain de la ligne (la promesse du matin)',
    [gain1.echarpes, gain1.xp, gain1.tampons].join() === [gain0.echarpes, gain0.xp, gain0.tampons].join()
    && Number(gain1.relancee) === 1);
  check('plus de relance : plus rien de relançable', r.quotidien.missions.relances === 0
    && r.quotidien.missions.liste.every((x) => x.relancable === false));
  const r2 = await poster(R, 'relance', { rang: 2, id: 'endurance' });
  check('une seconde relance : « epuisees »', r2?.relancee === false && r2.raison === 'epuisees' || voir(r2));
  const r3 = await poster(R, 'relance', { rang: 0, id: 'duel' });
  check('un identifiant qui n’est pas celui de la ligne : « change »', r3?.raison === 'change' || voir(r3));

  const R2 = await joueur();
  await contrat(R2, ['boosters', 'victoire', 'endurance']);
  await duel(R2);
  check('une mission prête ne se relance pas : « terminee »',
    (await poster(R2, 'relance', { rang: 1, id: 'victoire' }))?.raison === 'terminee');
  await poster(R2, 'mission', { jour, rang: 1, id: 'victoire' });
  check('une mission récupérée non plus', (await poster(R2, 'relance', { rang: 1, id: 'victoire' }))?.raison === 'terminee');

  const R3 = await joueur();
  await contrat(R3, ['boosters', 'victoire', 'endurance']);
  poserReglages({ 'mission.tribune': false, 'mission.classes': false });
  e = await lire(R3);
  check('aucune autre mission moyenne faisable : pas relançable', mission(e, 1)?.relancable === false
    && mission(e, 0)?.relancable === true);
  check('et la relancer : « aucune »', (await poster(R3, 'relance', { rang: 1, id: 'victoire' }))?.raison === 'aucune');
  reglagesDeDepart();

  /* La journée du football se lit **avant** le verrou de la bourse. Les seules
     remplaçantes faciles laissées allumées sont du Virage : la relance doit
     lire la journée pour savoir si un match se joue. Lue sous le verrou, elle
     demanderait une connexion au pool en en tenant une. */
  const R4 = await joueur();
  await contrat(R4, ['boosters', 'victoire', 'endurance']);
  poserReglages({ 'mission.duel': false, 'mission.grandir': false });
  const lues = journeeLue;
  journeeSousVerrou = 0;
  surveille = R4;
  const r4 = await poster(R4, 'relance', { rang: 0, id: 'boosters' });
  surveille = null;
  reglagesDeDepart();
  check('une relance vers le Virage lit la journée, et jamais sous le verrou de la bourse',
    r4?.relancee === true && mission(r4.quotidien, 0)?.id === 'virage' && journeeLue > lues
    && journeeSousVerrou === 0
    || voir(r4?.relancee ?? r4?.raison, mission(r4?.quotidien, 0)?.id, journeeLue - lues, journeeSousVerrou));

  /* La course, rendue certaine : la réclamation arrive pendant la relance,
     entre ses contrôles et son écriture. Sans le verrou de la bourse en tête
     de la relance, la réclamation inscrit « victoire » au grand livre pendant
     que la ligne passe à une autre mission. */
  const C = await joueur();
  await contrat(C, ['boosters', 'victoire', 'endurance']);
  let reclamation = null;
  crochets.relanceAvantEcriture = async () => {
    await duel(C);
    reclamation = poster(C, 'mission', { jour, rang: 1, id: 'victoire' });
    await Promise.race([reclamation, attendre(800)]);
  };
  const rr = await poster(C, 'relance', { rang: 1, id: 'victoire' });
  delete crochets.relanceAvantEcriture;
  const rc = await reclamation;
  const ligneC = (await lignesDuJour(C))[1];
  const payee = (await livre(C, 'mission', `${jour}:1`)).length;
  check('relance et réclamation croisées : jamais une mission payée que la ligne ne porte plus',
    !(payee && ligneC.mission !== 'victoire') || voir(rr, rc, ligneC.mission, payee));
  check('la relance passe, la réclamation lit « change »', rr?.relancee === true && rc?.raison === 'change'
    || voir(rr?.relancee ?? rr?.raison, rc?.raison ?? rc?.verse));

  /* Et vingt fois sans crochet, avec un duel qui tombe en même temps. */
  let fautes = 0;
  let doubles = 0;
  for (let i = 0; i < 20; i++) {
    const Z = await joueur();
    await contrat(Z, ['boosters', 'victoire', 'endurance']);
    const [a, b] = await Promise.all([
      poster(Z, 'relance', { rang: 1, id: 'victoire' }),
      poster(Z, 'mission', { jour, rang: 1, id: 'victoire' }),
      duel(Z),
    ]);
    const l = (await lignesDuJour(Z))[1];
    const p = (await livre(Z, 'mission', `${jour}:1`)).length;
    if (p && l.mission !== 'victoire') fautes++;
    if (a?.relancee && b?.verse) doubles++;
    if (Number(l.echarpes) !== 60) fautes++;
  }
  check('vingt courses : aucune ligne du grand livre pour une mission que la ligne ne porte plus',
    fautes === 0 || voir(fautes));
  check('et jamais relancée et payée à la fois', doubles === 0 || voir(doubles));
}

/* ================================== « relançable », sans lire la journée */

titre('« relançable » se juge sans lire la journée du football');
{
  /* Un jour sans match. « Duel » et « Fais grandir » éteintes : les seules
     remplaçantes de « boosters » sont du Virage. Pour « victoire », un joueur
     sans club n'a que le Virage et les classés, qui demandent un match eux
     aussi. Seule la journée peut dire qu'il n'y en a pas — et le hub lit
     l'état à chaque arrivée : la lire là, c'était réveiller l'API sportive à
     chaque expiration de son cache. Avant la correction, la première
     vérification rougit. */
  await figer('2027-01-06 12:00:00');
  matchs = [];
  poserReglages({ 'mission.duel': false, 'mission.grandir': false });
  const V = await joueur();
  await contrat(V, ['boosters', 'victoire', 'endurance']);
  const lues = journeeLue;
  await lire(V);
  let e = await lire(V);
  check('deux lectures de l’état hors tirage : la journée n’est pas lue',
    journeeLue === lues || voir(journeeLue - lues));
  check('sans relevé de ce jour de jeu, une remplaçante du Virage est présumée possible',
    mission(e, 0)?.relancable === true && mission(e, 1)?.relancable === true
    && mission(e, 2)?.relancable === true || voir(e?.missions?.liste));

  const r = await poster(V, 'relance', { rang: 0, id: 'boosters' });
  check('la relance, elle, lit la journée une fois et tranche : « aucune »',
    r?.relancee === false && r.raison === 'aucune' && journeeLue === lues + 1
    || voir(r?.relancee ?? r?.raison, journeeLue - lues));
  check('l’état qu’elle rend le sait déjà : « boosters » et « victoire » ne sont plus relançables',
    mission(r?.quotidien, 0)?.relancable === false && mission(r?.quotidien, 1)?.relancable === false
    && mission(r?.quotidien, 2)?.relancable === true && r.quotidien.missions.relances === 1
    || voir(r?.quotidien?.missions));
  e = await lire(V);
  check('la lecture suivante aussi, sans relire la journée',
    mission(e, 0)?.relancable === false && journeeLue === lues + 1
    || voir(mission(e, 0), journeeLue - lues));

  /* Le relevé ne vaut qu'une minute : au-delà, la présomption revient. */
  crochets.horloge = () => Date.now() + 61_000;
  e = await lire(V);
  delete crochets.horloge;
  check('une minute plus tard, le relevé est oublié : présumée possible, toujours sans lire',
    mission(e, 0)?.relancable === true && journeeLue === lues + 1
    || voir(mission(e, 0), journeeLue - lues));

  /* Et il ne vaut que pour son jour de jeu, même encore frais. */
  await figer('2027-01-08 12:00:00');
  const W = await joueur();
  await contrat(W, ['boosters', 'victoire', 'endurance']);
  e = await lire(W);
  check('le relevé d’un autre jour de jeu ne dit rien d’aujourd’hui : présumée possible, sans lire',
    mission(e, 0)?.relancable === true && journeeLue === lues + 1
    || voir(mission(e, 0), journeeLue - lues));
  reglagesDeDepart();
}

/* ============================================= abonné et non-abonné, plafonds */

titre('abonné et non-abonné, et les plafonds gratuits');
{
  await figer('2027-01-07 12:00:00');
  matchs = JOURNEE();
  const Ab = await joueur();
  await abonnement.accorder(Ab, { formule: 'mensuel', jours: 30 });
  const Na = await joueur();
  check('le contrôle compare bien un abonné et un gratuit',
    (await abonnement.estAbonne(Ab)) === true && (await abonnement.estAbonne(Na)) === false);
  const ea = await lire(Ab);
  const en = await lire(Na);
  const forme = (e) => JSON.stringify({ m: e.missions.liste.map((x) => [x.id, x.gain, x.cible]),
    s: e.missions.sachet.gain, b: e.bonus });
  check('mêmes missions, mêmes gains, même sachet, même carte', forme(ea) === forme(en) || voir(forme(ea), forme(en)));

  /* Un plafond gratuit abaissé sort « Joue 2 duels classés » du tirage. On
     cherche un jour où elle serait la première faisable. */
  let jourClasses = null;
  for (let i = 1; i < 60 && !jourClasses; i++) {
    await figer(`2027-02-${String(1 + (i % 28)).padStart(2, '0')} 12:00:00`);
    if (attendu(await jourSql(), 'moyenne', SANS_CLUB) === 'classes') jourClasses = await jourSql();
  }
  check('un jour où l’ordre du jour met « classes » en tête existe', Boolean(jourClasses));
  if (jourClasses) {
    await figer(`${jourClasses} 12:00:00`);
    const tem = await lire(await joueur());
    check('plafond à 5 : « Joue 2 duels classés » est tirée', mission(tem, 1)?.id === 'classes' || voir(ids(tem)));
    poserReglages({ 'abo.duels_classes_jour': 1 });
    const e1 = await lire(await joueur());
    check('plafond abaissé à 1 : elle sort du tirage, la suivante faisable la remplace',
      mission(e1, 1)?.id === attendu(jourClasses, 'moyenne', new Set([...SANS_CLUB].filter((x) => x !== 'classes')))
      || voir(ids(e1)));
    poserReglages({ 'xp.duel_classe': 0 });
    const e2 = await lire(await joueur());
    check('un classé qui ne rapporte rien : elle sort aussi', mission(e2, 1)?.id !== 'classes');
    reglagesDeDepart();
    /* Deux classés déjà joués sur cinq : il en reste trois, elle reste. */
    const P3 = await joueur();
    await duel(P3, { mode: 'classe', xp: 20, duree: 120 });
    await duel(P3, { mode: 'classe', xp: 20, duree: 120 });
    await duel(P3, { mode: 'classe', xp: 20, duree: 120 });
    await duel(P3, { mode: 'classe', xp: 0, duree: 5 });   // quitté : il compte au quota quand même
    const e3 = await lire(P3);
    check('quatre classés déjà joués (5 au plus) : « 2 de plus » dépasserait, elle sort',
      mission(e3, 1)?.id !== 'classes' || voir(ids(e3)));
  }

  /* L'entraînement qui ne rapporte rien sort les missions de duel. */
  poserReglages({ 'xp.duel_entrainement': 0 });
  const sansDuel = ['duel', 'victoire', 'victoires', 'endurance', 'club_duel'];
  const K = await joueur({ clubs: [85] });
  let vus = 0;
  let auraient = 0;
  for (let i = 0; i < 6; i++) {
    await figer(`2027-03-${String(1 + i).padStart(2, '0')} 12:00:00`);
    const jour = await jourSql();
    const avecClub = new Set([...SANS_CLUB, 'club_virage', 'club_duel']);
    if (Q.DIFFICULTES.some((d) => sansDuel.includes(attendu(jour, d, avecClub)))) auraient++;
    const l = ids(await lire(K));
    if (l.some((id) => sansDuel.includes(id))) vus++;
  }
  check('« xp.duel_entrainement » à 0 : aucune mission de duel tirée sur six jours', vus === 0);
  check(`dont ${auraient} jour(s) où l’une serait sortie sans cela`, auraient > 0);
  reglagesDeDepart();
}

/* ========================================================== les interrupteurs */

titre('les interrupteurs');
{
  await figer('2027-03-10 12:00:00');
  matchs = JOURNEE();
  const jour = await jourSql();
  const I = await joueur();
  await contrat(I, ['duel', 'victoire', 'endurance']);
  await duel(I);
  await tampons(I, S1, 10);

  poserReglages({ 'missions.actif': false, 'bonus.actif': false, 'saison.carnet_actif': false });
  const e = await lire(I);
  check('éteints : ni missions, ni bonus, ni carnet, et rien à réclamer',
    !('missions' in e) && !('bonus' in e) && !('carnet' in e) && e.aReclamer === 0 && e.actif === true
    || voir(Object.keys(e), e.aReclamer));
  const b0 = await bourse(I);
  const rm = await poster(I, 'mission', { jour, rang: 0, id: 'duel' });
  const rb = await poster(I, 'bonus');
  const rk = await poster(I, 'carnet', { saison: S1, n: 1 });
  const rs = await poster(I, 'sachet', { jour });
  const rl = await poster(I, 'relance', { rang: 2, id: 'endurance' });
  check('et chaque réclamation répond « inactif »',
    [rm, rb, rk, rs].every((r) => r?.verse === false && r.raison === 'inactif') && rl?.raison === 'inactif'
    || voir([rm, rb, rk, rs, rl].map((r) => r?.raison)));
  const b1 = await bourse(I);
  check('rien n’est versé', JSON.stringify(b0) === JSON.stringify(b1)
    && Number((await q('SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND source <> ?', [I, 'mission']))[0].n) === 0);
  reglagesDeDepart();
  const e2 = await lire(I);
  check('rallumés : la mission terminée redevient récupérable', mission(e2, 0)?.etat === 'pret'
    && e2.bonus?.pret === true && e2.carnet?.paliers?.[0]?.etat === 'pret');
}

/* =========================================================== le disjoncteur */

titre('le disjoncteur');
{
  await figer('2027-03-11 12:00:00');
  matchs = JOURNEE();
  const jour = await jourSql();
  const Z = await joueur();
  await contrat(Z, ['duel', 'victoire', 'victoires']);
  for (let i = 0; i < 3; i++) await duel(Z);
  poserReglages({ 'recompenses.plafond_echarpes_jour': 100 });
  const r1 = await poster(Z, 'mission', { jour, rang: 2, id: 'victoires' });
  check('100 écharpes sous un plafond de 100 : versées', r1?.verse === true || voir(r1));
  const b0 = await bourse(Z);
  const r2 = await poster(Z, 'bonus');
  check('le bonus au-delà : « plafond », bourse inchangée',
    r2?.raison === 'plafond' && JSON.stringify(await bourse(Z)) === JSON.stringify(b0) || voir(r2));
  const r3 = await poster(Z, 'mission', { jour, rang: 2, id: 'victoires' });
  check('une mission déjà versée, plafond atteint : « deja », pas « plafond »', r3?.raison === 'deja' || voir(r3));
  /* « tout » prend, dans l'ordre : le bonus, les missions 0 et 1 (prêtes),
     et le sachet qu'elles complètent. Le bonus bute sur le plafond : le
     grand livre s'arrête là, et les quatre restent dus. */
  const rt = await poster(Z, 'tout');
  check('« tout » au plafond : rien versé, et les quatre éléments restés dus sont comptés',
    rt?.verse === false && rt.raison === 'plafond' && rt.reste === 4 || voir(rt?.verse, rt?.raison, rt?.reste));
  reglagesDeDepart();
}

/* ============================================================ tout récupérer */

titre('tout récupérer');
{
  await figer('2027-03-12 12:00:00');
  matchs = JOURNEE();
  const T = await joueur();
  await contrat(T, ['duel', 'victoire', 'victoires']);
  for (let i = 0; i < 3; i++) await duel(T);
  await tampons(T, S1, 8);   // les deux tampons du passage atteignent le palier de 10
  const e = await lire(T);
  check('avant : le bonus et trois missions à récupérer', e.aReclamer === 4 || voir(e.aReclamer));
  const b0 = await bourse(T);
  appelsRecharge.length = 0;
  const r = await poster(T, 'tout');
  const b1 = await bourse(T);
  /* Une seule préparation pour tout le geste, puis la recharge du seul
     élément qui porte un booster (le sachet), sous son verrou. */
  check('« tout » compte la recharge une fois avant les verrous, puis sous celui du sachet',
    JSON.stringify(appelsRecharge) === '["pool","connexion"]' || voir(appelsRecharge));
  /* bonus 20 + missions 30 + 60 + 100 + palier 1 (100) ; un sachet (1 booster). */
  check('tout est versé, sachet et palier atteints dans le même geste compris',
    r?.verse === true && r.gain.echarpes === 20 + 30 + 60 + 100 + 100 && r.gain.packs === 1
    && r.gain.xp === 120 && r.gain.tampons === 5 || voir(r?.gain));
  check('la bourse monte exactement de la somme (et des écharpes de palier de niveau)',
    b1.scarves === b0.scarves + r.gain.echarpes + (r.niveau?.ecarpes ?? 0) && b1.xp === b0.xp + 120
    || voir(b0, b1, r.niveau));
  check('la jauge agrège : gain 120, départ d’avant le premier versement',
    r.niveau?.gain === 120 && r.niveau?.depart?.xp === b0.xp || voir(r.niveau));
  check('après, plus rien à récupérer', r.quotidien?.aReclamer === 0 || voir(r.quotidien?.aReclamer));
  check('rien n’est resté dû : pas de « reste » (R1)', !('reste' in r) || voir(r.reste));
  const r2 = await poster(T, 'tout');
  check('le redemander : rien à verser, « incomplet », sans « reste »',
    r2?.verse === false && r2.raison === 'incomplet' && !('reste' in r2) || voir(r2?.verse, r2?.raison, r2?.reste));

  /* Deux onglets, puis dix : chaque élément n'est versé qu'une fois, quel que
     soit l'onglet qui le prend. Un onglet qui arrive après les autres trouve
     tout pris (« deja ») ou plus rien à prendre (« incomplet »). La réserve
     est pleine, pour que la recharge ne brouille pas le compte. */
  for (const n of [2, 10]) {
    const D = await joueur();
    await contrat(D, ['duel', 'victoire', 'victoires']);
    for (let i = 0; i < 3; i++) await duel(D);
    await q('UPDATE user_wallet SET packs = ? WHERE user_id = ?', [reglage('pack.max'), D]);
    const d0 = await bourse(D);
    const rs = await enParallele(n, () => poster(D, 'tout'));
    const d1 = await bourse(D);
    const lignes = Number((await q('SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?', [D]))[0].n);
    check(`${n} « tout » simultanés : le bonus, les trois missions et le sachet, une fois chacun`,
      lignes === 5 && somme(rs, 'echarpes') === 20 + 30 + 60 + 100 && somme(rs, 'packs') === 1
      && somme(rs, 'xp') === 120 && somme(rs, 'tampons') === 5
      || voir(lignes, rs.map((x) => (x?.verse ? x.gain : x?.raison))));
    check(`et la bourse ne monte qu’une fois (${n})`,
      d1.scarves === d0.scarves + 210 + ecarpesDe(rs) && d1.xp === d0.xp + 120 && d1.packs === d0.packs + 1
      || voir(d0, d1, ecarpesDe(rs)));
    check(`chaque onglet répond : un versement, « deja » ou « incomplet » (${n})`,
      rs.every((x) => x?.verse === true || ['deja', 'incomplet'].includes(x?.raison))
      || voir(rs.map((x) => x?.raison ?? x?.verse)));
  }
}

/* ============================================================== le ticket */

titre('depuis ta dernière visite');
{
  await figer('2027-03-15 10:00:00');
  matchs = [];
  await q("INSERT IGNORE INTO teams (id, name) VALUES (85, 'FC Sion'), (91, 'FC Bâle'), (92, 'Lugano')");
  const T = await joueur({ clubs: [85] });
  const [F1, F2, F3] = [await joueur(), await joueur(), await joueur()];
  const KOP = randomUUID();
  await q(`INSERT INTO kops (id, team_id, nom, createur, pot, verse_total) VALUES (?, 85, 'Les Ultras', ?, 120, 500)`,
    [KOP, T]);
  await q('INSERT INTO kop_membres (kop_id, user_id, team_id) VALUES (?, ?, 85)', [KOP, T]);
  await match(9000, { home: 85, away: 92, coupDEnvoiMin: -300, statut: 'FT', buts: [0, 0] });

  let e = await lire(T, true);
  check('jamais marqué : pas de ticket', !('depuis' in e) || voir(e.depuis));
  let r = await poster(T, 'visite');
  const [m0] = await q("SELECT DATE_FORMAT(visite_a, '%Y-%m-%d %H:%i:%s') AS v, instantane FROM user_wallet WHERE user_id = ?", [T]);
  const photo = typeof m0.instantane === 'string' ? JSON.parse(m0.instantane) : m0.instantane;
  check('POST /visite pose la marque, et photographie le pot',
    r?.ok === true && m0.v === '2027-03-15 10:00:00' && photo?.[KOP]?.pot === 120 && photo[KOP].verse === 500
    || voir(r, m0));

  /* Le budget : une marque récente ne coûte rien de plus. Et la journée du
     football n'en fait jamais partie hors tirage : le hub lit l'état à
     chaque arrivée. */
  await lire(T);
  const luesAvant = journeeLue;
  compte = [];
  await lire(T);
  const sans = compte.length;
  compte = [];
  e = await lire(T, true);
  const avec = compte.length;
  compte = null;
  check(`au plus 7 requêtes par lecture (${sans})`, sans <= 7);
  check('aucune lecture de la journée du football dans ces lectures',
    journeeLue === luesAvant || voir(journeeLue - luesAvant));
  check(`?retour=1 avec une marque récente : le même nombre (${avec})`, avec === sans && !('depuis' in e));

  await figer('2027-03-15 10:00:10');
  await poster(T, 'visite');
  const [m1] = await q("SELECT DATE_FORMAT(visite_a, '%Y-%m-%d %H:%i:%s') AS v FROM user_wallet WHERE user_id = ?", [T]);
  check('deux visites en dix secondes : une seule écriture', m1.v === '2027-03-15 10:00:00' || voir(m1));

  await figer('2027-03-15 14:00:00');
  const [a, b] = T < F1 ? [T, F1] : [F1, T];
  await q(`INSERT INTO amities (a, b, par, etat, demande_le, repondu_le)
           VALUES (?, ?, ?, 'amis', NOW(3) - INTERVAL 1 DAY, NOW(3))`, [a, b, T]);
  const [c, d] = T < F2 ? [T, F2] : [F2, T];
  await q(`INSERT INTO amities (a, b, par, etat, demande_le) VALUES (?, ?, ?, 'demande', NOW(3))`, [c, d, F2]);
  await q('INSERT INTO kop_membres (kop_id, user_id, team_id) VALUES (?, ?, 85)', [KOP, F3]);
  await q('UPDATE kops SET pot = pot + 140, verse_total = verse_total + 140 WHERE id = ?', [KOP]);
  await q(`INSERT INTO kop_votes (id, kop_id, bonus_id, prix, ouvert_par, ouvre, ferme, issue)
           VALUES (?, ?, 'fumigenes', 100, ?, NOW(3) - INTERVAL 4 MINUTE, NOW(3) - INTERVAL 1 MINUTE, 'adopte')`,
  [randomUUID(), KOP, F3]);
  const KOP2 = randomUUID();
  await q(`INSERT INTO kops (id, team_id, nom, createur) VALUES (?, 92, 'Autre', ?)`, [KOP2, F1]);
  await q('INSERT INTO kop_invites (kop_id, user_id, par) VALUES (?, ?, ?)', [KOP2, T, F1]);
  await match(9001, { home: 85, away: 91, coupDEnvoiMin: -120, statut: 'FT', buts: [2, 1] });
  const [{ insertId: sv }] = await pool.query(
    `INSERT INTO souvenirs (fixture_id, seq, league_id, family, scorer_team, home_id, away_id,
                            score_home, score_away, kickoff_at, expires_at, price)
     VALUES (9001, 1, 61, 'championnat', 85, 85, 91, 1, 0, UTC_TIMESTAMP(), NOW(3) + INTERVAL 15 DAY, 30)`);
  await q('INSERT INTO user_souvenirs (user_id, souvenir_id, kind) VALUES (?, ?, ?)', [T, sv, 'presence']);
  const [{ insertId: S9 }] = await pool.query(
    `INSERT INTO saisons (numero, nom, series, tenues, lancee_a) VALUES (9, 'La neuve', JSON_ARRAY(), JSON_ARRAY(), NOW(3))`);
  await chargerSaisons(pool);

  compte = [];
  e = await lire(T, true);
  const coutTicket = compte.length;
  compte = null;
  const dep = e.depuis;
  const attenduDepuis = {
    ilYaMs: 4 * 3600 * 1000,
    amis: { nouveaux: [{ id: F1, pseudo: await pseudo(F1) }], demandes: 1 },
    kops: [{ id: KOP, nom: 'Les Ultras', arrivees: [await pseudo(F3)], verse: 140,
      pot: { avant: 120, apres: 260 }, votes: [{ bonusId: 'fumigenes', issue: 'adopte' }] }],
    invitationsKop: 1,
    matchs: [{ fixtureId: 9001, domicile: 'FC Sion', exterieur: 'FC Bâle', score: [2, 1], club: 'FC Sion',
      issue: 'gagne' }],
    souvenirs: 1,
    saison: { id: S9, numero: 9, nom: 'La neuve' },
  };
  check('quatre heures plus tard : le ticket dit ce qui s’est passé, et rien d’autre (§ 8.1)',
    JSON.stringify(dep) === JSON.stringify(attenduDepuis) || voir(dep, attenduDepuis));
  check(`un ticket coûte au plus 7 requêtes de plus (${coutTicket - sans})`, coutTicket - sans <= 7);
  e = await lire(T, true);
  check('un GET ne déplace pas la marque : le ticket est encore là', Boolean(e.depuis));
  await poster(T, 'visite');
  e = await lire(T, true);
  check('le POST la déplace : plus de ticket', !('depuis' in e) || voir(e.depuis));
  await q('DELETE FROM saisons WHERE id = ?', [S9]);
  await chargerSaisons(pool);
}

/* ============================================ le carnet, sa fin, le relais */

titre('le carnet de la saison');
{
  await figer('2027-03-20 12:00:00');
  matchs = JOURNEE();
  const jour = await jourSql();
  const C = await joueur();
  await tampons(C, S1, 9);
  await contrat(C, ['duel', 'victoire', 'endurance']);
  await duel(C);
  let e = await lire(C);
  check('le carnet de la saison 1 : le carnet par défaut, 9 tampons, le palier 1 à venir',
    e.carnet?.saison?.id === S1 && e.carnet.tampons === 9 && e.carnet.close === false
    && e.carnet.paliers.length === CARNET_DEFAUT.length && e.carnet.paliers[0].etat === 'a_venir'
    && JSON.stringify(e.carnet.prochain) === '{"n":1,"manque":1}' || voir(e.carnet));
  check('les paliers portent leur gain, leur insigne et leur titre',
    JSON.stringify(e.carnet.paliers[1].gain) === '{"echarpes":150,"packs":1,"xp":0,"tampons":0}'
    && e.carnet.paliers[1].insigne === 'lisere' && e.carnet.paliers[4].titre === 'Revenu pour de bon');
  check('un palier pas atteint : « incomplet »', (await poster(C, 'carnet', { saison: S1, n: 1 }))?.raison === 'incomplet');
  await poster(C, 'mission', { jour, rang: 0, id: 'duel' });
  e = await lire(C);
  check('la mission ajoute son tampon : 10, le palier 1 est prêt', e.carnet.tampons === 10
    && e.carnet.paliers[0].etat === 'pret' && JSON.stringify(e.carnet.prochain) === '{"n":2,"manque":30}'
    || voir(e.carnet));
  const rs = await enParallele(2, () => poster(C, 'carnet', { saison: S1, n: 1 }));
  check('deux réclamations du palier : un versement, 100 écharpes',
    rs.filter((r) => r?.verse).length === 1 && rs.find((r) => r?.verse)?.gain?.echarpes === 100
    || voir(rs.map((r) => r?.raison ?? r?.gain)));
  check('puis « reclame »', (await lire(C)).carnet.paliers[0].etat === 'reclame');
  const C10 = await joueur();
  await tampons(C10, S1, 10);
  const c0 = await bourse(C10);
  const r10 = await enParallele(10, () => poster(C10, 'carnet', { saison: S1, n: 1 }));
  check('dix réclamations du palier : un versement, neuf « deja », 100 écharpes une fois',
    r10.filter((r) => r?.verse).length === 1 && r10.filter((r) => r?.raison === 'deja').length === 9
    && (await bourse(C10)).scarves === c0.scarves + 100 || voir(r10.map((r) => r?.raison ?? r?.verse)));
  check('un palier qui n’existe pas : « inconnu »', (await poster(C, 'carnet', { saison: 999, n: 1 }))?.raison === 'inconnu');

  const C5 = await joueur();
  await tampons(C5, S1, 260);
  const r5 = await poster(C5, 'carnet', { saison: S1, n: 5 });
  const [l5] = await livre(C5, 'carnet', `S${S1}:5`);
  check('le palier 5 copie son titre dans le grand livre', r5?.verse === true && l5?.titre === 'Revenu pour de bon'
    || voir(r5, l5));
  appelsRecharge.length = 0;
  const r2 = await poster(C5, 'carnet', { saison: S1, n: 2 });
  const [l2] = await livre(C5, 'carnet', `S${S1}:2`);
  check('le palier 2 y copie son insigne (liseré)', r2?.verse === true && l2?.insigne === 'lisere');
  check('son booster : la recharge comptée avant le verrou, puis dessous',
    JSON.stringify(appelsRecharge) === '["pool","connexion"]' || voir(appelsRecharge));
}

titre('la fin de la saison 1, et les missions de son dernier jour');
{
  await figer('2027-03-25 12:00:00');
  matchs = JOURNEE();
  await q("UPDATE saisons SET fin_le = '2027-03-25' WHERE id = ?", [S1]);
  await chargerSaisons(pool);
  const L2 = await joueur();
  await lire(L2);
  const tirees = await lignesDuJour(L2);
  check('le dernier jour, le tirage remplit encore la saison 1', tirees.length === 4
    && tirees.every((l) => Number(l.saison_id) === S1) || voir(tirees));
  const L = await joueur();
  await tampons(L, S1, 5);
  await contrat(L, ['duel', 'victoire', 'endurance']);
  await duel(L);

  await figer('2027-03-26 12:00:00');
  let e = await lire(L);
  check('le lendemain : le carnet est clos', e.carnet?.close === true && e.carnet.tampons === 5 || voir(e.carnet));
  const neuves = await lignesDuJour(L);
  check('les missions tirées depuis ne remplissent aucun carnet (saison nulle, aucun tampon promis)',
    neuves.length === 4 && neuves.every((l) => l.saison_id === null && Number(l.tampons) === 0)
    && e.missions.liste.every((x) => x.gain.tampons === 0) || voir(neuves));
  const r = await poster(L, 'mission', { jour: '2027-03-25', rang: 0, id: 'duel' });
  check('la mission du dernier jour, récupérée le lendemain, ajoute son tampon au carnet clos',
    r?.verse === true && r.quotidien.carnet.tampons === 6 || voir(r?.raison, r?.quotidien?.carnet));
}

titre('la saison 2, le relais et la saison passée');
{
  await figer('2027-04-01 12:00:00');
  matchs = JOURNEE();
  const R1 = await joueur();
  await tampons(R1, S1, 12);
  const R2 = await joueur();
  await tampons(R2, S1, 9);
  const [{ insertId: S2 }] = await pool.query(
    `INSERT INTO saisons (numero, nom, series, tenues, lancee_a) VALUES (2, 'La trêve', JSON_ARRAY('RP'), JSON_ARRAY(), NOW(3))`);
  await chargerSaisons(pool);

  let e = await lire(R1);
  check('la saison 2 lancée : son carnet, vide', e.carnet?.saison?.id === S2 && e.carnet.tampons === 0
    && e.carnet.close === false || voir(e.carnet));
  check('le relais, à qui avait 12 tampons en saison 1 : deux boosters',
    JSON.stringify(e.relais) === JSON.stringify({ saison: { id: S1, numero: 1, nom: 'La reprise' }, tampons: 12,
      gain: { echarpes: 0, packs: 2, xp: 0, tampons: 0 } }) || voir(e.relais));
  check('et le palier 1 de la saison 1, atteint et pas récupéré, reste dû',
    e.saisonPassee?.saison?.id === S1 && e.saisonPassee.paliers.length === 1 && e.saisonPassee.paliers[0].n === 1
    && e.saisonPassee.paliers[0].etat === 'pret' || voir(e.saisonPassee));
  const b0 = await bourse(R1);
  const rs = await enParallele(2, () => poster(R1, 'relais'));
  const b1 = await bourse(R1);
  check('deux réclamations du relais : un versement, la réserve monte de deux',
    rs.filter((r) => r?.verse).length === 1 && b1.packs >= b0.packs + 2 || voir(rs.map((r) => r?.raison), b0, b1));
  const R10 = await joueur();
  await tampons(R10, S1, 12);
  await q('UPDATE user_wallet SET packs = ? WHERE user_id = ?', [reglage('pack.max'), R10]);
  const p0 = (await bourse(R10)).packs;
  appelsRecharge.length = 0;
  const rs10 = await enParallele(10, () => poster(R10, 'relais'));
  const p1 = (await bourse(R10)).packs;
  check('dix réclamations du relais : un versement, neuf « deja », deux boosters exactement (réserve pleine)',
    rs10.filter((r) => r?.verse).length === 1 && rs10.filter((r) => r?.raison === 'deja').length === 9
    && p1 === p0 + 2 || voir(rs10.map((r) => r?.raison ?? r?.verse), p0, p1));
  /* Chacune prépare la recharge sur le pool, sans verrou ; seule celle qui
     verse la recompte, sous le sien. */
  check('et la recharge : dix fois sur le pool, une fois sous le verrou',
    appelsRecharge.filter((x) => x === 'pool').length === 10
    && appelsRecharge.filter((x) => x === 'connexion').length === 1 || voir(appelsRecharge));
  check('sans le seuil (9 tampons) : pas de relais, et le réclamer : « incomplet »',
    !('relais' in (await lire(R2))) && (await poster(R2, 'relais'))?.raison === 'incomplet');
  const rp = await poster(R1, 'carnet', { saison: S1, n: 1 });
  check('le palier de la saison passée se récupère après sa fin', rp?.verse === true
    && !('saisonPassee' in rp.quotidien) || voir(rp));

  /* Deux saisons finies avec chacune un palier prêt : la plus récente seule. */
  await figer('2027-04-10 12:00:00');
  const W = await joueur();
  await tampons(W, S1, 10);
  await tampons(W, S2, 10);
  const [{ insertId: S3 }] = await pool.query(
    `INSERT INTO saisons (numero, nom, series, tenues, lancee_a) VALUES (3, 'Le printemps', JSON_ARRAY('RP'), JSON_ARRAY(), NOW(3))`);
  await chargerSaisons(pool);
  e = await lire(W);
  const prets = (e.bonus?.pret ? 1 : 0) + (e.relais ? 1 : 0) + (e.saisonPassee?.paliers?.length ?? 0);
  check('deux saisons finies : saisonPassee sert la plus récente (la 2)',
    e.saisonPassee?.saison?.id === S2 && e.saisonPassee.paliers.length === 1 || voir(e.saisonPassee));
  check(`aReclamer ne compte que ce qui est servi (${prets}, pas le palier de la saison 1)`,
    e.aReclamer === prets && prets === 3 || voir(e.aReclamer, prets));
  await poster(W, 'carnet', { saison: S2, n: 1 });
  e = await lire(W);
  check('vidée, la saison 2 laisse sa place à la 1', e.saisonPassee?.saison?.id === S1 || voir(e.saisonPassee));
  check('le relais de la saison 3 se lit sur la saison 2', e.relais?.saison?.id === S2);
  await q('DELETE FROM saisons WHERE id IN (?, ?)', [S2, S3]);
  await q('UPDATE saisons SET fin_le = NULL WHERE id = ?', [S1]);
  await chargerSaisons(pool);
}

/* ======================================================== le Virage à minuit */

titre('le Virage à minuit : les chants comptent au jour du coup d’envoi');
{
  await figer('2027-04-20 23:40:00');
  matchs = JOURNEE();
  const N = await joueur();
  await contrat(N, ['duel', 'tribune', 'endurance']);
  await match(9101, { coupDEnvoiMin: -10, statut: '2H' });        // 23:30
  await chanter(N, 9101, { chants: 40, mt1: 20, mt2: 20 });
  let e = await lire(N);
  check('à 23:40, quarante chants : « Chante 40 fois » est prête', mission(e, 1)?.etat === 'pret' || voir(mission(e, 1)));
  await figer('2027-04-21 00:10:00');
  await contrat(N, ['duel', 'tribune', 'endurance']);
  await chanter(N, 9101, { chants: 5, mt2: 5 });                   // une poussée après minuit
  e = await lire(N);
  check('à 00:10, après une poussée : la mission d’hier reste prête',
    e.missions?.hier?.liste?.some((x) => x.id === 'tribune' && x.etat === 'pret') || voir(e.missions?.hier));
  check('et la mission du jour ne compte aucun de ces chants', mission(e, 1)?.id === 'tribune' && mission(e, 1)?.fait === 0
    || voir(mission(e, 1)));
  const r = await poster(N, 'mission', { jour: '2027-04-20', rang: 1, id: 'tribune' });
  check('elle se verse', r?.verse === true || voir(r));
}

/* ================================================================ la forme */

titre('la forme du contrat (§ 6.1)');
{
  await figer('2027-04-25 12:00:00');
  matchs = JOURNEE();
  const U = await joueur();
  compte = [];
  const e = await lire(U);
  const premier = compte.length;
  compte = null;
  check(`le premier passage du jour, tirage compris : au plus 7 + 4 requêtes (${premier})`,
    premier <= 11 || voir(premier));
  const cles = (o) => Object.keys(o ?? {}).sort().join(',');
  const gainOk = (g) => cles(g) === 'echarpes,packs,tampons,xp' && Object.values(g).every((v) => Number.isInteger(v) && v >= 0);
  check('racine : actif, jour, finDuJourMs, bonus, missions, carnet, aReclamer',
    e.actif === true && /^\d{4}-\d{2}-\d{2}$/.test(e.jour) && Number.isInteger(e.finDuJourMs)
    && cles(e) === 'aReclamer,actif,bonus,carnet,finDuJourMs,jour,missions' || voir(cles(e)));
  check('bonus : pret, carte (case, cases, prise, montants ×7), gain',
    cles(e.bonus) === 'carte,gain,pret' && cles(e.bonus.carte) === 'case,cases,montants,prise'
    && e.bonus.carte.montants.length === 7 && e.bonus.carte.montants.every(gainOk) && gainOk(e.bonus.gain));
  check('une mission : les douze champs du contrat, et un gain R5',
    e.missions.liste.every((x) => cles(x) === 'bouton,cible,difficulte,etat,fait,gain,id,ou,rang,relancable,titre,unite'
      && gainOk(x.gain)) || voir(cles(e.missions.liste[0])));
  check('missions : jour, liste, relances, sachet (etat, faites, sur, gain)',
    cles(e.missions) === 'jour,liste,relances,sachet' && cles(e.missions.sachet) === 'etat,faites,gain,sur'
    && gainOk(e.missions.sachet.gain));
  check('carnet : saison, close, tampons, paliers, prochain',
    cles(e.carnet) === 'close,paliers,prochain,saison,tampons' && cles(e.carnet.saison) === 'id,nom,numero'
    && e.carnet.paliers.every((p) => gainOk(p.gain) && ['a_venir', 'pret', 'reclame'].includes(p.etat)));
  check('la série est absente sans aucun bonus jamais pris (record 0)', !('serie' in e));
  /* La sonde. */
  const s = await sonderJourDeJeu(pool);
  check('la sonde : le jour change à 00:00 à Zurich sur cette base', s.changeA === '00:00'
    && s.base.decalage === '+02:00' && /00:00, heure de Zurich/.test(phraseJourDeJeu(s)) || voir(s));
}

/* ====================================================== sans les tables (M1) */

titre('sans les tables du quotidien, rien ne casse');
{
  await figer('2027-04-26 12:00:00');
  const U = await joueur();
  const raw = await mysql.createConnection({ uri: DB });
  await raw.query('DROP TABLE missions_jour, compteurs_jour, recompenses');
  await raw.end();
  const r = await appel(U, '/api/quotidien');
  check('GET /api/quotidien : 200 et { actif: false }, rien d’autre',
    r.status === 200 && JSON.stringify(r.json) === '{"actif":false}' || voir(r));
  const b = await appel(U, '/api/quotidien/bonus', {});
  check('une réclamation : 200, « schema », et l’état éteint',
    b.status === 200 && b.json?.verse === false && b.json.raison === 'schema'
    && JSON.stringify(b.json.quotidien) === '{"actif":false}' || voir(b));
  const v = await appel(U, '/api/quotidien/visite', {});
  check('la marque de visite répond quand même', v.status === 200 && v.json?.ok === true);
  const st = await appel(U, '/api/fanzzy/state');
  const nv = await appel(U, '/api/niveau');
  check('/api/fanzzy/state et /api/niveau intacts', st.status === 200 && nv.status === 200
    || voir(st.status, st.json?.error, nv.status));
}

await figerHorloge(pool, null);
/* La salle du Virage ferme ses sockets, puis le serveur HTTP qu'elle porte. */
await new Promise((r) => io.close(() => r()));
await pool.end();

/* ================================================ et sous un autre fuseau

   Le fuseau de Node ne doit rien changer à ce que le serveur compte : tout
   est en SQL. La suite se relance elle-même sous Montréal, en gardant le
   verrou de la base (`TBF_SANS_VERROU` dans l'enfant seulement). */
if (!ENFANT && process.env.TBF_SANS_MONTREAL !== '1') {
  titre('la même suite, sous TZ=America/Montreal (J5)');
  const enfant = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, TZ: 'America/Montreal', TBF_SANS_VERROU: '1', TBF_QUOTIDIEN_ENFANT: '1' },
    encoding: 'utf8',
  });
  const lignes = (enfant.stdout ?? '').split('\n');
  const rouges = lignes.filter((l) => l.startsWith(' FAIL '));
  const verts = lignes.filter((l) => l.startsWith('  ok  ')).length;
  const ici = reussis;
  /* Un contrôle qui passerait sans que l'enfant ait rien éprouvé ne prouve
     rien : il doit avoir tourné sous Montréal, et autant de contrôles que
     nous. ICU nomme ce fuseau « America/Toronto », dont Montréal est un
     alias depuis 2015 : les deux noms disent la même heure. */
  check('l’enfant tourne bien sous Montréal',
    lignes.some((l) => /fuseau de Node : America\/(Montreal|Toronto)/.test(l))
    || voir(lignes.slice(0, 4).join(' | ')));
  check(`verte sous Montréal aussi (${verts} contrôles, comme ici : ${ici})`,
    enfant.status === 0 && verts === ici
    || voir(rouges.slice(0, 8).join('\n        ') || (enfant.stderr ?? '').slice(0, 800)));
}

console.log(rates ? `\n${rates} contrôle(s) en échec.` : '\nLe quotidien tient.');
process.exitCode = rates ? 1 : 0;
