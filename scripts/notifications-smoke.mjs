/**
 * Les notifications (`src/server/notifications/index.js`).
 *
 * Ce qui se vérifie ici, c'est surtout **ce qui ne part pas** : une
 * notification de trop ne casse rien et ne lève rien, elle réveille un
 * mineur à minuit ou annonce les votes d'un KOP sur le téléphone que son
 * ancien propriétaire a rendu. Rien ne le montrerait autrement.
 *
 *   1. **L'inscription d'un appareil** : une adresse `https:` et ses deux
 *      clés, rien d'autre ; une ligne par appareil, qui change de
 *      propriétaire sans se dédoubler ; les deux cases à faux l'effacent.
 *   2. **On ne lit que son propre appareil** : inscrit au nom d'un autre, il
 *      se lit « non inscrit ».
 *   3. **Les clés** se créent une fois, même demandées deux fois de suite.
 *   4. **Ce qui part** : le sujet coché seulement, jamais la nuit, jamais
 *      l'interrupteur éteint, jamais à un compte suspendu ; un appareil
 *      disparu (410) est oublié.
 *   5. **Le vote du KOP** prévient les membres sauf celui qui l'ouvre, sans
 *      nommer personne — et c'est le vrai `proposer` du KOP qui l'appelle.
 *   6. **Le duel** prévient ceux qui suivent le club qui manque, une fois par
 *      match, et pas deux duels de suite dans la pause.
 *   6b. **Le club qui joue** : trente minutes avant, puis le Virage au coup
 *      d'envoi, à ceux qui suivent l'un des deux clubs, une fois par match.
 *   6c. **Les amis** : une demande, un oui (jamais un non), une invitation
 *      en duel — par le vrai module des amis, sans nommer personne.
 *   7. **Supprimer son compte** efface ses appareils.
 *   8. **Une table absente** éteint sans lever.
 *
 * Rien n'est envoyé pour de bon : l'envoi est remplacé par un relevé.
 *
 * Usage : node scripts/notifications-smoke.mjs
 */
import express from 'express';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createNotifications, abonnementValide, estLaNuit, empreinteAppareil, deClub,
} from '../src/server/notifications/index.js';
/* Le catalogue des bonus : celui du partagé, qui ne garde plus que ce que le
   Virage applique depuis que « La quête » et « Mur de bâches » en sont
   sortis (`EN_VENTE` a disparu avec eux). */
import { createKop } from '../src/server/kop/index.js';
import { createAmis } from '../src/server/amis/index.js';
import { BONUS } from '../src/shared/kop.js';
import { createStore } from '../src/server/auth/store.js';
import { poserReglages } from '../src/shared/reglages.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ------------------------------------------------------------- la base */

const mysql = await import('mysql2/promise');
{
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  await raw.query('SET FOREIGN_KEY_CHECKS = 0');
  await raw.query(`DROP TABLE IF EXISTS notif_appareils, notif_cles, parrainages, amities,
    fixtures, kop_invites, kop_bulletins,
    kop_votes, kop_bonus, kop_membres, kops, user_follows, teams, sessions, auth_tokens, users`);
  await raw.query('SET FOREIGN_KEY_CHECKS = 1');
  for (const f of ['auth', 'football', 'kop', 'amis', 'notifications']) {
    await raw.query(readFileSync(path.join(RACINE, 'sql', `${f}.sql`), 'utf8'));
  }
  await raw.end();
}

const U = {
  ANA: 'aaaaaaaa-0000-0000-0000-00000000000a', // ouvre le vote, attend en duel
  BOB: 'bbbbbbbb-0000-0000-0000-00000000000b', // membre, a tout coché
  CLA: 'cccccccc-0000-0000-0000-00000000000c', // membre, n'a coché que le duel
  DAN: 'dddddddd-0000-0000-0000-00000000000d', // membre, compte suspendu
  EVE: 'eeeeeeee-0000-0000-0000-00000000000e', // suit l'autre club
};
const { ANA, BOB, CLA, DAN, EVE } = U;
{
  const raw = await mysql.createConnection({ uri: DB });
  for (const [nom, id] of Object.entries(U)) {
    await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash,status)
      VALUES (?,?,?,'x',?)`, [id, `${nom.toLowerCase()}@ex.fr`, nom, id === DAN ? 'locked' : 'active']);
  }
  await raw.query(`INSERT INTO teams (id,name) VALUES (85,'FC Sion'),(91,'Servette FC')`);
  for (const id of [ANA, BOB, CLA, DAN]) {
    await raw.query('INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)', [id]);
  }
  await raw.query('INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,91,1)', [EVE]);
  await raw.end();
}

const pool = mysql.createPool({ uri: DB, connectionLimit: 8, ...OPTIONS_BASE });
const ligne = async (sql, p = []) => (await pool.execute(sql, p))[0];

/* L'heure : midi à Zurich (10 h UTC en octobre), ou onze heures et demie du soir. */
const MIDI = Date.UTC(2026, 9, 6, 10, 0);
const SOIR = Date.UTC(2026, 9, 6, 21, 30);
let maintenant = MIDI;
const horloge = () => maintenant;

/* L'envoi, relevé. Une adresse qui finit par `/parti` répond 410, comme un
   appareil dont on a désinstallé le navigateur. */
const envois = [];
const envoyer = async (abo, corps, options) => {
  if (abo.endpoint.endsWith('/parti')) {
    throw Object.assign(new Error('Gone'), { statusCode: 410 });
  }
  envois.push({ endpoint: abo.endpoint, message: JSON.parse(corps), options });
};
const journal = [];
const log = {
  warn: (...a) => journal.push(['warn', a.join(' ')]),
  error: (...a) => journal.push(['error', a.join(' ')]),
  log() {},
};

const requireAuth = (req, res, next) => (req.user ? next()
  : res.status(401).json({ error: 'auth.error.unauthenticated' }));
const N = createNotifications({ pool, requireAuth, envoyer, horloge, log });

const app = express();
app.use((req, _res, next) => {
  const qui = req.headers['x-qui'];
  if (qui) req.user = { id: qui };
  next();
});
app.use('/api/notifications', N.router);
const http = createServer(app);
await new Promise((ok) => http.listen(0, ok));
const BASE = `http://127.0.0.1:${http.address().port}/api/notifications`;
const appel = async (qui, chemin, methode = 'GET', corps) => {
  const r = await fetch(BASE + chemin, {
    method: methode,
    headers: { 'x-qui': qui, ...(corps ? { 'content-type': 'application/json' } : {}) },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const appareil = (nom) => ({
  endpoint: `https://push.exemple.net/${nom}`,
  keys: { p256dh: 'BOr' + 'a'.repeat(84), auth: 'c2VjcmV0c2VjcmV0' },
});

/* ------------------------------------------------- 1. ce qu'on accepte */

console.log('\n— l’inscription d’un appareil');
check('une adresse https et ses deux clés sont acceptées', Boolean(abonnementValide(appareil('x'))));
check('une adresse http est refusée (le serveur n’écrit pas vers n’importe quel hôte)',
  abonnementValide({ ...appareil('x'), endpoint: 'http://push.exemple.net/x' }) === null);
check('une adresse qui n’en est pas une est refusée',
  abonnementValide({ ...appareil('x'), endpoint: 'javascript:alert(1)' }) === null);
check('des clés manquantes ou étranges sont refusées',
  abonnementValide({ endpoint: 'https://a.b/c', keys: { p256dh: 'a b', auth: 'x' } }) === null
  && abonnementValide({ endpoint: 'https://a.b/c' }) === null);

let r = await appel(BOB, '');
check('le serveur dit qu’il peut envoyer, et sert sa clé publique',
  r.json.actif === true && typeof r.json.cle === 'string' && r.json.cle.length > 40);
const cleServie = r.json.cle;
check('sans session, rien', (await appel('', '')).status === 401);

r = await appel(BOB, '/appareil', 'PUT', { abonnement: appareil('bob'), sujets: { kop: true, duel: true } });
check('Bob inscrit son téléphone, les deux cases cochées',
  r.status === 200 && r.json.sujets?.kop === true && r.json.sujets?.duel === true);
r = await appel(BOB, '/appareil', 'PUT', { abonnement: { endpoint: 'http://x/y', keys: {} },
  sujets: { kop: true } });
check('un appareil mal formé est refusé', r.status === 400);
await appel(CLA, '/appareil', 'PUT', { abonnement: appareil('cla'), sujets: { kop: false, duel: true } });
await appel(DAN, '/appareil', 'PUT', { abonnement: appareil('dan'), sujets: { kop: true, duel: true } });
await appel(EVE, '/appareil', 'PUT', { abonnement: appareil('eve'), sujets: { kop: true, duel: true } });
/* Bob a aussi un vieux téléphone, dont le navigateur a été désinstallé. */
await appel(BOB, '/appareil', 'PUT', { abonnement: appareil('parti'), sujets: { kop: true, duel: true } });

let lignes = await ligne('SELECT * FROM notif_appareils WHERE user_id = ?', [BOB]);
check('une ligne par appareil, clée sur l’empreinte de l’adresse',
  lignes.length === 2
  && lignes.some((l) => l.id === empreinteAppareil('https://push.exemple.net/bob')));
check('rien d’autre n’est gardé que l’adresse, les clés, les cases et la date',
  Object.keys(lignes[0]).sort().join() === 'amis,auth,club,cree_le,duel,endpoint,id,kop,p256dh,user_id,virage');

/* ------------------------------------------- 2. son propre appareil */

console.log('\n— on ne lit que son propre appareil');
r = await appel(BOB, '/etat', 'POST', { endpoint: appareil('bob').endpoint });
check('Bob lit ses cases', r.json.sujets?.kop === true && r.json.sujets?.duel === true);
r = await appel(CLA, '/etat', 'POST', { endpoint: appareil('bob').endpoint });
check('Clara, devant le téléphone de Bob, le lit « non inscrit »', r.json.sujets === null);

/* Le téléphone partagé : Ana se connecte sur l'ancien appareil de Clara et
   l'inscrit. La ligne change de propriétaire, elle ne se dédouble pas. */
await appel(ANA, '/appareil', 'PUT', { abonnement: appareil('cla'), sujets: { kop: true, duel: false } });
lignes = await ligne('SELECT user_id, kop, duel FROM notif_appareils WHERE id = ?',
  [empreinteAppareil(appareil('cla').endpoint)]);
check('un appareil réinscrit par un autre compte change de propriétaire, sans doublon',
  lignes.length === 1 && lignes[0].user_id === ANA && lignes[0].kop === 1 && lignes[0].duel === 0);
await appel(CLA, '/appareil', 'PUT', { abonnement: appareil('cla'), sujets: { kop: false, duel: true } });

r = await appel(EVE, '/appareil', 'PUT', { abonnement: appareil('eve'), sujets: { kop: false, duel: false } });
check('les deux cases à faux effacent l’appareil',
  r.json.sujets === null
  && (await ligne('SELECT 1 FROM notif_appareils WHERE user_id = ?', [EVE])).length === 0);
await appel(EVE, '/appareil', 'PUT', { abonnement: appareil('eve'), sujets: { kop: true, duel: true } });
await appel(EVE, '/appareil', 'DELETE', { endpoint: appareil('eve').endpoint });
check('la déconnexion oublie l’appareil',
  (await ligne('SELECT 1 FROM notif_appareils WHERE user_id = ?', [EVE])).length === 0);
await appel(EVE, '/appareil', 'PUT', { abonnement: appareil('eve'), sujets: { kop: true, duel: true } });

/* ------------------------------------------------------- 3. les clés */

console.log('\n— les clés');
{
  const N2 = createNotifications({ pool, requireAuth, envoyer, horloge, log });
  const [a, b] = await Promise.all([N2.lesCles(), N.lesCles()]);
  check('demandées deux fois, les clés sont les mêmes, et celles déjà servies',
    a?.publique === b?.publique && a?.publique === cleServie);
  check('une seule ligne de clés', (await ligne('SELECT COUNT(*) AS n FROM notif_cles'))[0].n === 1);
}

/* ------------------------------------------------------ 4. ce qui part */

console.log('\n— ce qui part');
envois.length = 0;
let n = await N.prevenir([BOB, CLA, DAN], 'kop', { titre: 'T', corps: 'C', url: '/kop', tag: 'kop-1' });
const vers = () => envois.map((e) => e.endpoint.split('/').pop()).sort().join();
check('le sujet « kop » ne va qu’aux appareils qui l’ont coché, et pas au compte suspendu',
  n === 1 && vers() === 'bob' || (console.log('        partis vers :', vers()), false));
check('l’appareil disparu (410) est oublié',
  (await ligne('SELECT 1 FROM notif_appareils WHERE endpoint LIKE ?', ['%/parti'])).length === 0);
check('le message est signé, avec une durée de vie courte et un sujet qui remplace',
  envois[0]?.options?.vapidDetails?.publicKey === cleServie
  && envois[0].options.TTL === 180 && envois[0].options.topic === 'kop-1');

envois.length = 0;
maintenant = SOIR;
check('la nuit, rien ne part (23 h 30 à Zurich)', estLaNuit(SOIR) && !estLaNuit(MIDI)
  && (await N.prevenir([BOB], 'kop', { titre: 'T' })) === 0 && envois.length === 0);
maintenant = MIDI;
poserReglages({ 'notifications.actif': false });
check('l’interrupteur éteint, rien ne part, et la page ne propose plus rien',
  (await N.prevenir([BOB], 'kop', { titre: 'T' })) === 0 && envois.length === 0
  && (await appel(BOB, '')).json.actif === false
  && (await appel(BOB, '/appareil', 'PUT', { abonnement: appareil('bob'), sujets: { kop: true } }))
    .status === 409);
poserReglages({});
check('un sujet inconnu ne part pas', (await N.prevenir([BOB], 'pub', { titre: 'T' })) === 0);

/* ------------------------------------------------------ 5. le KOP */

console.log('\n— le vote du KOP');
{
  const kopId = 'k0000000-0000-0000-0000-000000000001';
  await ligne(`INSERT INTO kops (id, team_id, nom, createur, pot) VALUES (?, 85, 'Le Virage Nord', ?, 100000)`,
    [kopId, ANA]);
  for (const u of [ANA, BOB, CLA, DAN]) {
    await ligne('INSERT INTO kop_membres (kop_id, user_id, team_id) VALUES (?, ?, 85)', [kopId, u]);
  }
  /* Le vrai KOP, avec les notifications branchées comme dans server.js. */
  const K = createKop({ pool, requireAuth, notifications: N });
  envois.length = 0;
  const vote = await K.proposer(ANA, kopId, BONUS[0].id);
  // L'envoi n'est pas attendu par le vote : on lui laisse le temps de partir.
  for (let i = 0; i < 50 && !envois.length; i++) await new Promise((ok) => setTimeout(ok, 20));
  check('un vote ouvert prévient les membres qui l’ont demandé, pas celui qui l’ouvre',
    vers() === 'bob' || (console.log('        partis vers :', vers()), false));
  const m = envois[0]?.message ?? {};
  check('le message dit le KOP, le bonus, le prix et les trois minutes, et mène au KOP',
    m.titre === 'Vote du KOP Le Virage Nord' && m.corps.includes(String(vote.prix))
    && m.corps.includes('3 minutes') && m.url === '/kop' && m.tag === `kop-${vote.id}`);
  check('il ne nomme aucun joueur',
    !Object.keys(U).some((nom) => JSON.stringify(m).includes(nom)));
}

/* ------------------------------------------------------ 6. le duel */

console.log('\n— le duel qui attend');
{
  const sion = { id: 85, name: 'FC Sion' };
  const servette = { id: 91, name: 'Servette FC' };
  envois.length = 0;
  /* Eve, supportrice du Servette, attend : il manque un supporter de Sion. */
  n = await N.duelAttend({ fixtureId: 777, club: sion, contre: servette, format: '1v1', camp: 0,
    exclus: [ANA] });
  check('ceux qui suivent le club qui manque et ont coché le duel sont prévenus, sauf ceux déjà en file',
    vers() === 'bob,cla' || (console.log('        partis vers :', vers()), false));
  const m = envois[0]?.message ?? {};
  check('le message nomme les deux clubs et mène au bon camp du bon match',
    m.titre === 'Un duel t’attend' && m.corps.startsWith('Servette FC contre FC Sion')
    && m.corps.includes('supporter de FC Sion')
    && m.url === '/duel-nvn?match=777&format=1v1&camp=0');

  envois.length = 0;
  maintenant = MIDI + 5 * 60_000;
  await N.duelAttend({ fixtureId: 777, club: sion, contre: servette, format: '2v2', camp: 0 });
  check('le même match ne s’annonce pas deux fois', envois.length === 0);
  await N.duelAttend({ fixtureId: 778, club: sion, contre: servette, format: '1v1', camp: 0 });
  check('un autre match, dans la pause d’une heure, non plus', envois.length === 0);
  maintenant = MIDI + 61 * 60_000;
  await N.duelAttend({ fixtureId: 778, club: sion, contre: servette, format: '1v1', camp: 0 });
  check('après la pause, l’autre match s’annonce', vers() === 'bob,cla');
  maintenant = MIDI;

  check('« de », « du », « d’ » : la même règle que l’accueil',
    deClub('FC Sion') === 'de FC Sion' && deClub('Le Servette') === 'du Servette'
    && deClub('Arsenal') === 'd’Arsenal');
}

/* ------------------------------------------------ 6b. le club qui joue */

console.log('\n— le club qui joue, et son Virage');
{
  const tout = { kop: true, duel: true, club: true, virage: true, amis: true };
  r = await appel(CLA, '/appareil', 'PUT', { abonnement: appareil('cla'), sujets: tout });
  check('les trois cases neuves s’inscrivent et se relisent',
    r.json.sujets?.club === true && r.json.sujets?.virage === true && r.json.sujets?.amis === true
    && (await appel(CLA, '/etat', 'POST', { endpoint: appareil('cla').endpoint }))
      .json.sujets?.amis === true);
  await appel(EVE, '/appareil', 'PUT', { abonnement: appareil('eve'),
    sujets: { club: true, virage: false } });
  r = await appel(EVE, '/etat', 'POST', { endpoint: appareil('eve').endpoint });
  check('une case que la page n’envoie pas vaut non',
    r.json.sujets?.club === true && r.json.sujets?.kop === false && r.json.sujets?.amis === false);

  /* Sion – Servette à 10 h 30 UTC, un autre à 13 h : il est 10 h. */
  await ligne(`INSERT INTO fixtures (id, league_id, season, home_id, away_id, status_short, kickoff_at)
    VALUES (900, 207, 2026, 85, 91, 'NS', '2026-10-06 10:30:00'),
           (901, 207, 2026, 85, 91, 'NS', '2026-10-06 13:00:00')`);
  envois.length = 0;
  n = await N.avantMatch();
  check('trente minutes avant, ceux qui suivent l’un des deux clubs et ont coché la case',
    vers() === 'cla,eve' || (console.log('        partis vers :', vers()), false));
  let m = envois[0]?.message ?? {};
  check('le message nomme le match, sans heure ni joueur, et mène aux matchs du jour',
    m.titre === 'Ton club joue bientôt' && m.corps.startsWith('FC Sion – Servette FC')
    && m.corps.includes('30 minutes') && m.url === '/aujourdhui' && m.tag === 'match-900'
    && !Object.keys(U).some((nom) => JSON.stringify(m).includes(nom)));
  envois.length = 0;
  maintenant = MIDI + 2 * 60_000;
  await N.avantMatch();
  check('la minute suivante ne le redit pas, et le match de 13 h attend son heure',
    envois.length === 0);

  envois.length = 0;
  await N.coupDEnvoi(900, { status: 'NS', elapsed: null });
  check('avant le coup d’envoi, le Virage ne s’annonce pas', envois.length === 0);
  await N.coupDEnvoi(900, { status: '1H', elapsed: 1 });
  check('au coup d’envoi, le Virage s’ouvre pour ceux qui ont coché sa case',
    vers() === 'cla' || (console.log('        partis vers :', vers()), false));
  m = envois[0]?.message ?? {};
  check('il mène droit à la tribune du match, et remplace le message d’avant',
    m.titre === 'Le Virage est ouvert' && m.url === '/virage?match=900' && m.tag === 'match-900');
  envois.length = 0;
  await N.coupDEnvoi(900, { status: '1H', elapsed: 2 });
  await N.coupDEnvoi(901, { status: '1H', elapsed: 35 });
  check('le tour suivant ne le redit pas, et un match déjà bien entamé non plus',
    envois.length === 0);
  maintenant = MIDI;
}

/* ------------------------------------------------------ 6c. les amis */

console.log('\n— les amis');
{
  const A = createAmis({ pool, requireAuth, notifications: N });
  const attendre = async () => {
    for (let i = 0; i < 50 && !envois.length; i++) await new Promise((ok) => setTimeout(ok, 20));
  };
  envois.length = 0;
  await A.demander(ANA, CLA);
  await attendre();
  check('une demande d’ami prévient celui qu’on demande',
    vers() === 'cla' || (console.log('        partis vers :', vers()), false));
  const m = envois[0]?.message ?? {};
  check('sans nommer celui qui demande, et mène aux amis',
    m.titre === 'Nouvelle demande d’ami' && m.url === '/amis'
    && !Object.keys(U).some((nom) => JSON.stringify(m).includes(nom)));
  envois.length = 0;
  await A.retirer(ANA, CLA);
  await A.demander(ANA, CLA);
  await new Promise((ok) => setTimeout(ok, 100));
  check('demander, retirer, redemander : le téléphone ne vibre qu’une fois', envois.length === 0);

  await A.demander(CLA, EVE);
  envois.length = 0;
  await A.repondre(EVE, CLA, true);
  await attendre();
  check('un oui prévient celui qui avait demandé',
    vers() === 'cla' && envois[0].message.titre === 'Demande acceptée');
  envois.length = 0;
  await A.repondre(CLA, ANA, false);
  await new Promise((ok) => setTimeout(ok, 100));
  check('un non ne prévient personne', envois.length === 0);

  envois.length = 0;
  await N.inviteDuel(CLA, 'abc123');
  check('l’invitation d’un ami en duel mène au vestiaire, et ne vit que cinq minutes',
    envois[0]?.message.url === '/duel-nvn?duel=abc123' && envois[0].options.TTL === 300);
}

/* ------------------------------------- 6d. une case neuve pas encore en base */

console.log('\n— le code en ligne avant le schéma');
{
  await ligne('ALTER TABLE notif_appareils DROP COLUMN amis');
  const N4 = createNotifications({ pool, requireAuth, envoyer, horloge, log });
  const app4 = express();
  app4.use((req, _r, next) => { req.user = { id: CLA }; next(); });
  app4.use('/n', N4.router);
  const h4 = createServer(app4);
  await new Promise((ok) => h4.listen(0, ok));
  const u4 = `http://127.0.0.1:${h4.address().port}/n`;
  const lu = await fetch(`${u4}/etat`, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ endpoint: appareil('cla').endpoint }) }).then((x) => x.json());
  check('sans la colonne « amis », les autres cases se lisent encore',
    lu.sujets?.kop === true && lu.sujets?.amis === false);
  const pose = await fetch(`${u4}/appareil`, { method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ abonnement: appareil('cla'), sujets: { kop: true, amis: true } }) });
  check('et s’inscrivent encore', pose.status === 200);
  envois.length = 0;
  check('ce sujet se tait sans lever', (await N4.inviteDuel(CLA, 'x')) === 0 && envois.length === 0);
  h4.close();
  await ligne('ALTER TABLE notif_appareils ADD COLUMN amis TINYINT(1) NOT NULL DEFAULT 1');
}

/* --------------------------------------------- 7. supprimer son compte */

console.log('\n— supprimer son compte');
{
  const store = createStore(pool);
  const id = (await ligne('SELECT id FROM users WHERE public_id = ?', [BOB]))[0].id;
  await store.deleteUser(id);
  check('les appareils de Bob partent avec son compte',
    (await ligne('SELECT 1 FROM notif_appareils WHERE user_id = ?', [BOB])).length === 0);
}

/* --------------------------------------------- 8. une table absente */

console.log('\n— sans sql/notifications.sql');
{
  await ligne('DROP TABLE notif_appareils, notif_cles');
  journal.length = 0;
  const N3 = createNotifications({ pool, requireAuth, envoyer, horloge, log });
  const sans = await N3.lesCles();
  check('pas de clés, pas d’erreur levée', sans === null);
  check('le journal nomme le fichier à appliquer, une fois',
    journal.filter(([, l]) => l.includes('sql/notifications.sql')).length === 1);
  check('rien ne part, sans lever', (await N3.prevenir([CLA], 'duel', { titre: 'T' })) === 0);
  const app3 = express();
  app3.use((req, _r, next) => { req.user = { id: CLA }; next(); });
  app3.use('/n', N3.router);
  const h3 = createServer(app3);
  await new Promise((ok) => h3.listen(0, ok));
  const g = await fetch(`http://127.0.0.1:${h3.address().port}/n`).then((x) => x.json());
  check('la page du compte ne propose rien', g.actif === false);
  h3.close();
}

http.close();
await pool.end();
console.log(failures ? `\n${failures} échec(s)` : '\nToutes les notifications se tiennent.');
process.exit(failures ? 1 : 0);
