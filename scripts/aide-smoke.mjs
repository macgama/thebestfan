/**
 * L'aide : le parcours des premiers pas, et la FAQ.
 *
 * ## Ce que cette suite défend
 *
 * Un tutoriel a deux façons de mentir, et cet écran les cumule toutes les deux.
 *
 * **Il peut cocher une étape que le joueur n'a pas faite.** C'est la faute la
 * plus coûteuse : elle transforme un guide en décoration, et le joueur qui s'y
 * fie saute l'étape qu'on prétend lui avoir apprise. Chaque signal est donc
 * éprouvé seul — on le pose, et on exige que **lui seul** bascule.
 *
 * **Il peut dire un nombre faux.** « 45 écharpes le booster », « trois paquets
 * au départ » : trois des nombres cités par la FAQ se règlent depuis
 * l'administration. Une réponse qui les recopie devient fausse le jour où
 * quelqu'un déplace un curseur, sans que rien ne lève et sans que personne ne
 * s'en aperçoive — sauf le joueur, qui croira s'être trompé. La suite déplace
 * donc un réglage et exige que la réponse bouge avec lui.
 *
 * Et une troisième, qui n'est pas propre au tutoriel : **la récompense**. Elle
 * se verse une fois. Deux onglets ouverts sur cet écran, c'est deux appels
 * simultanés, et un versement accordé deux fois est un défaut qu'on ne
 * découvre jamais parce que personne ne s'en plaint. Et elle ne doit rien
 * coûter : un booster offert qui efface la recharge en attente reprend d'une
 * main ce qu'il donne de l'autre, sans que rien ne lève. Quand elle ne peut
 * pas se verser, la cause doit se lire au journal : la page, elle, se tait.
 *
 * Usage : node scripts/aide-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createAide } from '../src/server/aide/index.js';
import { createFanzzy } from '../src/server/fanzzy/index.js';
import { ETAPES, faq, etapes, RECOMPENSE } from '../src/shared/aide.js';
import { poserReglages, reglage, DEFAUTS } from '../src/shared/reglages.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  virage_presence, user_wallet, duel_results, duel_events, duels, souvenirs,
  user_souvenirs, sessions, auth_tokens, login_attempts, users, reglages, fanzzy`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');

/* `aide.sql` n'est PAS appliqué tout de suite : la première section éprouve
   précisément la base qui ne l'a pas. */
for (const f of ['auth.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql',
  'deck.sql', 'duel.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
const U = 'aide-test-joueur';
await pool.query(
  `INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
  [U, 'aide@test', 'Guide']);
await pool.query(`INSERT INTO user_wallet (user_id, packs) VALUES (?, 0)`, [U]);

const requireAuth = (_q, _s, n) => n();
/* Le vrai module fanzzy, pour sa seule `recharger` : c'est la règle de la
   réserve qu'on veut voir jouer au versement, plafond et cadence compris, et
   non une copie qui pourrait s'en écarter. */
const F = createFanzzy({ pool, requireAuth });
const aide = createAide({ pool, requireAuth, fanzzy: F });

/* `packs_at` se date en JavaScript, comme le serveur la date (le pavé de
   `wallet` dans `fanzzy/index.js`) : le défaut de la colonne est l'heure de
   la base, que le pool relit comme de l'UTC. Le versement compte maintenant
   la recharge due, et ses contrôles dépendraient sinon du fuseau de la base. */
const cadence = () => reglage('pack.regen_min') * 60_000;
const poserReserve = (id, packs, ilYaMs) => pool.execute(
  'UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?',
  [packs, new Date(Date.now() - ilYaMs), id]);
const reserve = async (id) => Number((await pool.query(
  'SELECT packs FROM user_wallet WHERE user_id = ?', [id]))[0][0].packs);

/* ======================================== sans sql/aide.sql, rien ne se casse

   C'est le premier contrôle parce que c'est le pire défaut possible ici : une
   erreur sur **l'écran qu'on ouvre quand quelque chose ne va pas**. Un joueur
   perdu qui tombe sur une page en panne n'a plus aucun recours. */
{
  const p = await aide.parcours(U);
  check('sans la colonne, le parcours se lit quand même',
    Array.isArray(p.etapes) && p.etapes.length === ETAPES.length);
  check('l’étape du booster reste simplement « pas faite »',
    p.etapes.find((e) => e.cle === 'booster')?.fait === false);
  /* Le repli vaut « déjà payé » : sans la colonne aucun versement n'est
     possible, et annoncer une récompense qu'on ne pourra pas donner serait
     promettre puis se dédire. */
  check('et aucune récompense n’est annoncée', p.paye === true);
  const r = await aide.recompenser(U);
  check('la demander ne lève pas', r.verse === false);
}

await raw.query(readFileSync(path.join(RACINE, 'sql', 'aide.sql'), 'utf8'));

/* ================================================= les six signaux, un par un

   Chacun est posé seul, et l'on exige que lui seul bascule. Un contrôle qui se
   contenterait de vérifier « six sur six à la fin » laisserait passer le défaut
   le plus probable : deux étapes branchées sur le même signal. */
{
  const etat0 = await aide.faits(U);
  check(`au départ, aucune étape n’est faite (${Object.values(etat0).filter(Boolean).length})`,
    Object.values(etat0).every((v) => v === false)
    || (console.log('        ', JSON.stringify(etat0)), false));

  const POSER = {
    fanzzy: async () => pool.query(
      `INSERT INTO user_fanzzy (user_id, fanzzy_id, stage) VALUES (?, 'RP1', 1)`, [U]),
    booster: async () => pool.query(
      `UPDATE user_wallet SET packs_ouverts = 1 WHERE user_id = ?`, [U]),
    evolution: async () => pool.query(
      `UPDATE user_fanzzy SET stage = 2 WHERE user_id = ? AND fanzzy_id = 'RP1'`, [U]),
    /* Le deck de départ s'écrit tout seul à l'ouverture du paquet de
       bienvenue : on pose donc d'abord celui-là, qui ne doit **rien** cocher,
       puis la sauvegarde du joueur. Sans les deux, ce contrôle ne
       distinguerait pas « a un deck » de « a composé son deck ». */
    deck: async () => {
      await pool.query(
        `INSERT INTO user_decks (user_id, nom, contenu) VALUES (?, 'Mon deck', ?)`,
        [U, JSON.stringify({ fanzzy: [{ id: 'RP1', stuff: [] }], actions: [] })]);
      const auto = await aide.faits(U);
      check('un deck écrit par le jeu ne coche rien', auto.deck === false
        || (console.log('        il coche déjà'), false));
      /* **Une seconde après `cree`, et non `NOW(3)`.** La sauvegarde du jeu
         écrit bien `maj = NOW(3)`, mais ici les deux instructions se suivent de
         si près qu'elles tombaient dans la même milliseconde : le contrôle
         mesurait alors la vitesse de la base plutôt que la règle, et rougissait
         une fois sur deux. Un test qui dépend de l'horloge ne dit rien. */
      await pool.query(
        `UPDATE user_decks SET maj = DATE_ADD(cree, INTERVAL 1 SECOND) WHERE user_id = ?`,
        [U]);
    },
    virage: async () => pool.query(
      `INSERT INTO virage_presence (user_id, fixture_id, side, ferveur)
       VALUES (?, 1, 0, 12)`, [U]),
    duel: async () => pool.query(
      `INSERT INTO duel_results (duel_id, user_id, opponent_id, outcome)
       VALUES ('d-aide-1', ?, 'autre', 'win')`, [U]),
  };

  const vus = [];
  for (const { cle } of ETAPES) {
    await POSER[cle]();
    vus.push(cle);
    const etat = await aide.faits(U);
    const bascules = Object.entries(etat).filter(([, v]) => v).map(([k]) => k).sort();
    check(`« ${cle} » se coche, et rien d’autre avec`,
      JSON.stringify(bascules) === JSON.stringify([...vus].sort())
      || (console.log('        cochées :', bascules.join(', ')), false));
  }
}

/* ======================================== entrer au Virage n'est pas pousser */
{
  await pool.query(
    `INSERT INTO virage_presence (user_id, fixture_id, side, ferveur)
     VALUES (?, 2, 1, 0)`, [U]);
  await pool.query(`UPDATE virage_presence SET ferveur = 0 WHERE user_id = ?`, [U]);
  const etat = await aide.faits(U);
  check('rester assis dans un virage ne coche pas l’étape', etat.virage === false
    || (console.log('        elle se coche sans ferveur'), false));
  await pool.query(
    `UPDATE virage_presence SET ferveur = 12 WHERE user_id = ? AND fixture_id = 1`, [U]);
}

/* ================================================== le deck du joueur sans
   deck de départ

   `premierDeck` a le droit d'échouer : il préfère rendre `null` plutôt que de
   faire rater une ouverture de paquet. Le joueur enregistre alors son premier
   deck lui-même, et `maj` vaut `cree` — l'étape ne se cocherait jamais si l'on
   s'en tenait aux dates. */
{
  const V = 'aide-test-sans-auto';
  await pool.query(
    `INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [V, 'aide2@test', 'SansAuto']);
  await pool.query(`INSERT INTO user_wallet (user_id) VALUES (?)`, [V]);
  await pool.query(
    `INSERT INTO user_decks (user_id, nom, contenu, cree, maj)
     VALUES (?, 'Mon deck', ?, NOW(3), NOW(3))`,
    [V, JSON.stringify({ fanzzy: [{ id: 'RP1' }, { id: 'RP2' }], actions: [] })]);
  const etat = await aide.faits(V);
  check('un deck de deux Fanzzy compte, même sans seconde sauvegarde',
    etat.deck === true);
  await pool.query(`DELETE FROM user_decks WHERE user_id = ?`, [V]);
  await pool.query(`DELETE FROM user_wallet WHERE user_id = ?`, [V]);
  await pool.query(`DELETE FROM users WHERE public_id = ?`, [V]);
}

/**
 * Un joueur neuf qui a fait les six étapes, réserve vide et datée de
 * maintenant : pour les contrôles qui ne portent que sur le versement.
 */
async function auBoutDuParcours(id, pseudo) {
  await pool.query(
    `INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [id, `${id}@test`, pseudo]);
  await pool.query(`INSERT INTO user_wallet (user_id, packs) VALUES (?, 0)`, [id]);
  await poserReserve(id, 0, 0);
  await pool.query(
    `INSERT INTO user_fanzzy (user_id, fanzzy_id, stage) VALUES (?, 'RP1', 2)`, [id]);
  await pool.query(`UPDATE user_wallet SET packs_ouverts = 1 WHERE user_id = ?`, [id]);
  await pool.query(
    `INSERT INTO user_decks (user_id, nom, contenu, cree, maj)
     VALUES (?, 'd', ?, NOW(3), NOW(3))`,
    [id, JSON.stringify({ fanzzy: [{ id: 'RP1' }, { id: 'RP2' }] })]);
  await pool.query(
    `INSERT INTO virage_presence (user_id, fixture_id, side, ferveur) VALUES (?, 9, 0, 5)`, [id]);
  await pool.query(
    `INSERT INTO duel_results (duel_id, user_id, opponent_id, outcome)
     VALUES (?, ?, 'autre', 'draw')`, [`d-${id}`, id]);
}

/* ============================================================ la récompense */
{
  await poserReserve(U, 0, 0);
  const avant = Number((await pool.query(
    `SELECT packs FROM user_wallet WHERE user_id = ?`, [U]))[0][0].packs);

  const un = await aide.recompenser(U);
  check('le parcours fini verse le booster', un.verse === true
    || (console.log('        il dit :', JSON.stringify(un)), false));

  const apres = Number((await pool.query(
    `SELECT packs FROM user_wallet WHERE user_id = ?`, [U]))[0][0].packs);
  check(`la réserve monte de ${RECOMPENSE} (${avant} → ${apres})`,
    apres === avant + RECOMPENSE);

  const deux = await aide.recompenser(U);
  check('et il ne se verse pas deux fois',
    deux.verse === false && deux.raison === 'deja');
  const encore = Number((await pool.query(
    `SELECT packs FROM user_wallet WHERE user_id = ?`, [U]))[0][0].packs);
  check('la seconde demande ne change rien à la réserve', encore === apres);

  /* **Deux onglets.** Le verrou est la seule chose qui sépare un versement
     d'un doublement, et il ne se voit dans aucune lecture du code : on le pose
     donc en situation, sur un joueur neuf, avec deux appels lancés ensemble. */
  const W = 'aide-test-deux-onglets';
  await auBoutDuParcours(W, 'DeuxOnglets');

  const [a, b] = await Promise.all([aide.recompenser(W), aide.recompenser(W)]);
  const verses = [a, b].filter((x) => x.verse).length;
  const packsW = Number((await pool.query(
    `SELECT packs FROM user_wallet WHERE user_id = ?`, [W]))[0][0].packs);
  check(`deux demandes simultanées n’en versent qu’une (${verses})`, verses === 1);
  check(`et la réserve n’a monté que d’un (${packsW})`, packsW === RECOMPENSE);
}

/* ======================== la recharge due entre avant le booster de fin

   Le défaut que cette section aurait attrapé. Le booster de fin entrait dans
   la réserve sans compter d'abord la recharge en attente : à 11 sur 12 avec
   une recharge due, le cadeau la remplissait à 12, et la lecture suivante —
   réserve pleine — remettait le compte à rebours à zéro. La recharge était
   perdue, le joueur finissait à 12 au lieu de 13, et rien ne levait nulle
   part : le commentaire du versement affirmait même l'inverse. Le grand
   livre avait déjà la règle (`recompenses.js`, étape 7) ; l'aide versait à
   côté de lui. */
{
  const max = reglage('pack.max');
  const attendu = max - 1 + 1 + RECOMPENSE;   // la réserve, la recharge due, le cadeau

  const R = 'aide-test-recharge';
  await auBoutDuParcours(R, 'Recharge');
  await poserReserve(R, max - 1, cadence() + 1000);
  const r = await aide.recompenser(R);
  const juste = await reserve(R);
  check(`à ${max - 1} sur ${max} avec une recharge due, le booster de fin mène à ${attendu} (${juste})`,
    r.verse === true && juste === attendu
    || (console.log('        il dit :', JSON.stringify(r)), false));
  /* La lecture suivante, celle de la barre : au-dessus du plafond, elle ne
     reprend pas le cadeau et n'ajoute rien. */
  await F.recharger(pool, R);
  check('et la lecture suivante ne reprend rien', (await reserve(R)) === attendu);

  /* **Sous le verrou du versement, et pas seulement avant.** Le versement
     compte la recharge une première fois sur le pool, avant de prendre le
     verrou (pour poser le souvenir de l'abonnement) : ce passage-là suffirait
     à faire passer le contrôle du dessus. On le casse donc exprès, et la
     recharge doit entrer quand même — par la connexion du versement, pendant
     qu'elle tient la ligne. `NOWAIT` le prouve : une autre connexion qui
     demande la ligne à cet instant doit être refusée sur-le-champ.

     **Et l'appel préalable a bien lieu, avant le verrou.** C'est lui qui
     évite qu'une demande tenant la ligne attende cinquante secondes une
     connexion libre pour lire l'abonnement (`ECARTS.md`, fanzzy § 1). Le
     module fanzzy de cette suite n'a pas d'abonnement : il ne touche jamais
     le pool pour ça, et ni sa disparition ni son passage sous le verrou ne
     changeraient un nombre. On exige donc l'ordre exact — le pool, puis la
     connexion — et, au moment de l'appel sur le pool, une ligne **libre** :
     le même `NOWAIT` doit y passer. */
  const appels = [];
  let tenue = null;
  let libreAvant = null;
  const aideSousVerrou = createAide({ pool, requireAuth, fanzzy: {
    recharger: async (lecteur, id) => {
      if (lecteur === pool) {
        appels.push('pool');
        try {
          await pool.query('SELECT 1 FROM user_wallet WHERE user_id = ? FOR UPDATE NOWAIT', [id]);
          libreAvant = true;
        } catch (e) {
          libreAvant = false;
          console.log('        NOWAIT avant le verrou a rendu :', e?.code, e?.message);
        }
        throw new Error('préchauffe cassée exprès par la suite');
      }
      appels.push('connexion');
      try {
        await pool.query('SELECT 1 FROM user_wallet WHERE user_id = ? FOR UPDATE NOWAIT', [id]);
        tenue = false;
      } catch (e) {
        tenue = e?.code === 'ER_LOCK_WAIT_TIMEOUT' || e?.code === 'ER_LOCK_NOWAIT'
          || (console.log('        NOWAIT a rendu :', e?.code, e?.message), false);
      }
      return F.recharger(lecteur, id);
    },
  } });
  const V = 'aide-test-recharge-verrou';
  await auBoutDuParcours(V, 'RechargeVerrou');
  await poserReserve(V, max - 1, cadence() + 1000);
  console.log('        (la ligne « recharge préalable impossible » qui suit est voulue)');
  const v = await aideSousVerrou.recompenser(V);
  const sousVerrou = await reserve(V);
  check(`préchauffe en panne : la recharge entre quand même, sous le verrou (${sousVerrou})`,
    v.verse === true && sousVerrou === attendu
    || (console.log('        il dit :', JSON.stringify(v)), false));
  check('la recharge est comptée sur le pool d’abord, puis sur la connexion du versement',
    JSON.stringify(appels) === '["pool","connexion"]'
    || (console.log('        appels :', JSON.stringify(appels)), false));
  check('l’appel sur le pool a lieu avant le verrou : la ligne est encore libre',
    libreAvant === true);
  check('et la ligne était bien tenue par le versement à cet instant', tenue === true);

  /* **Et `server.js` câblé comme on le croit.** En production, la porte ne
     tient que par ce câblage : retirer `fanzzy` de l'appel, ou monter l'aide
     avant fanzzy, et chaque booster de fin lève — sans qu'aucune autre suite
     ne rougisse, puisque toutes posent leur porte elles-mêmes. On lit donc
     l'appel dans `server.js`, comme `verif-cablage.mjs` le fait pour le
     quotidien : `createAide` doit venir après `createFanzzy`, et recevoir
     `fanzzy`.

     La globale qui en a tenu lieu au lot 4 (`globalThis.fanzzy`) n'est
     plus lue par l'aide : la poser ne suffit plus, et ce contrôle ne
     l'accepte plus. */
  {
    const serveur = readFileSync(path.join(RACINE, 'server.js'), 'utf8');
    const monteFanzzy = serveur.indexOf('fanzzy = createFanzzy(');
    const debut = serveur.indexOf('createAide({');
    const fin = debut < 0 ? -1 : serveur.indexOf('})', debut);
    const appel = debut < 0 || fin < 0 ? '' : serveur.slice(debut, fin);
    /* `fanzzy` en raccourci ou `fanzzy: fanzzy` ; pas `fanzzy: null`. */
    const passe = /[{,]\s*fanzzy\s*(?::\s*fanzzy\s*)?(?:,|$)/.test(appel);
    check('server.js construit l’aide après le module fanzzy',
      appel.length > 0 && monteFanzzy >= 0 && debut > monteFanzzy
      || (console.log('        createFanzzy à', monteFanzzy, '· createAide à', debut), false));
    check('et lui passe fanzzy, la porte de la recharge',
      passe || (console.log('        appel :', appel.replace(/\s+/g, ' ')), false));
  }

  /* **Sans porte du tout, rien.** Verser quand même reproduirait le défaut en
     silence ; le versement refuse donc, et avant d'écrire quoi que ce soit —
     ni booster, ni drapeau, qui fermerait la récompense pour toujours. */
  const S = 'aide-test-sans-porte';
  await auBoutDuParcours(S, 'SansPorte');
  await poserReserve(S, max - 1, cadence() + 1000);
  let leve = null;
  try {
    await createAide({ pool, requireAuth }).recompenser(S);
  } catch (e) {
    leve = e;
  }
  check('sans « recharger », le versement refuse au lieu de perdre la recharge',
    /recharger/.test(leve?.message ?? '')
    || (console.log('        il n’a pas levé'), false));
  const [[s]] = await pool.query(
    'SELECT packs, parcours_paye AS p FROM user_wallet WHERE user_id = ?', [S]);
  check('et rien n’est écrit : ni booster, ni drapeau',
    Number(s.packs) === max - 1 && Number(s.p) === 0
    || (console.log('        bourse :', JSON.stringify(s)), false));
}

/* ============================ une panne se dit au journal, et en 503

   Le refus du dessus ne sert à rien s'il ne se voit nulle part. La page se
   tait devant une erreur (`CONTRATS.md`, R2) : c'est donc le journal qui
   doit nommer la cause, et la page qui doit recevoir un code stable — 503,
   « bloc absent » — et non le code brut de MySQL en 400. On passe par le
   routeur, comme la page, sans porte d'abord, puis avec un verrou expiré
   pendant le versement. */
{
  const max = reglage('pack.max');
  let qui = null;
  const authDeTest = (req, _res, next) => { req.user = { id: qui }; next(); };
  const expire = new Error('Lock wait timeout exceeded; try restarting transaction');
  expire.code = 'ER_LOCK_WAIT_TIMEOUT';
  const app = express();
  app.use('/sans-porte', createAide({ pool, requireAuth: authDeTest }).router);
  app.use('/verrou-expire', createAide({ pool, requireAuth: authDeTest, fanzzy: {
    recharger: async (lecteur) => { if (lecteur !== pool) throw expire; return null; },
  } }).router);
  const http = app.listen(0, '127.0.0.1');
  await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}`;

  /* Le journal de la route, relevé le temps de deux demandes. */
  const journal = [];
  const errorDOrigine = console.error;
  console.error = (...a) => { journal.push(a.map(String).join(' ')); };
  const demander = async (prefixe, id) => {
    qui = id;
    journal.length = 0;
    const r = await fetch(`${base}${prefixe}/recompense`, { method: 'POST' });
    return { statut: r.status, corps: await r.json().catch(() => null), lignes: [...journal] };
  };
  const bourse = async (id) => (await pool.query(
    'SELECT packs, parcours_paye AS p FROM user_wallet WHERE user_id = ?', [id]))[0][0];

  try {
    const P = 'aide-test-route-sans-porte';
    await auBoutDuParcours(P, 'RouteSansPorte');
    await poserReserve(P, max - 1, cadence() + 1000);
    const a = await demander('/sans-porte', P);
    check(`sans porte, la route répond 503 « aide.error.indisponible » (${a.statut} ${a.corps?.error})`,
      a.statut === 503 && a.corps?.error === 'aide.error.indisponible');
    check('et la cause est au journal : une ligne de l’aide qui nomme « recharger »',
      a.lignes.some((l) => l.startsWith('[aide]') && l.includes('recharger'))
      || (console.log('        journal :', JSON.stringify(a.lignes)), false));
    const bp = await bourse(P);
    check('rien n’est écrit par la route non plus',
      Number(bp.packs) === max - 1 && Number(bp.p) === 0);

    const L = 'aide-test-route-verrou';
    await auBoutDuParcours(L, 'RouteVerrou');
    await poserReserve(L, max - 1, cadence() + 1000);
    const b = await demander('/verrou-expire', L);
    check(`un verrou expiré répond 503, sans le code de MySQL (${b.statut} ${b.corps?.error})`,
      b.statut === 503 && b.corps?.error === 'aide.error.indisponible');
    check('et la cause est au journal',
      b.lignes.some((l) => l.startsWith('[aide]') && l.includes('Lock wait timeout'))
      || (console.log('        journal :', JSON.stringify(b.lignes)), false));
    const bl = await bourse(L);
    check('le versement est annulé en entier : ni booster, ni drapeau',
      Number(bl.packs) === max - 1 && Number(bl.p) === 0
      || (console.log('        bourse :', JSON.stringify(bl)), false));
  } finally {
    console.error = errorDOrigine;
    await new Promise((r) => http.close(r));
  }
}

/* ================================================= un parcours incomplet ne
   paie pas

   Le serveur recompte les six étapes à chaque demande : la page en connaît le
   résultat, et c'est exactement pour ça qu'on ne l'écoute pas. */
{
  const X = 'aide-test-incomplet';
  await pool.query(
    `INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [X, 'aide4@test', 'Incomplet']);
  await pool.query(`INSERT INTO user_wallet (user_id, packs) VALUES (?, 0)`, [X]);
  await pool.query(
    `INSERT INTO user_fanzzy (user_id, fanzzy_id, stage) VALUES (?, 'RP1', 1)`, [X]);
  const r = await aide.recompenser(X);
  check('un parcours incomplet ne verse rien',
    r.verse === false && r.raison === 'incomplet');
  const p = Number((await pool.query(
    `SELECT packs FROM user_wallet WHERE user_id = ?`, [X]))[0][0].packs);
  check('et la réserve reste à zéro', p === 0);
}

/* ========================================== le parcours n'envoie personne
   dans le vide

   Chaque étape porte un bouton vers un écran. Une route qui n'existe pas
   rendrait une page blanche à quelqu'un qui suit le tutoriel à la lettre — et
   ce serait la faute la plus vexante de tout le jeu. */
{
  const serveur = readFileSync(path.join(RACINE, 'server.js'), 'utf8');
  const servies = new Set([...serveur.matchAll(/app\.get\('([^']+)'/g)].map((m) => m[1]));
  const perdus = ETAPES.filter((e) => !servies.has(e.ou)).map((e) => `${e.cle} → ${e.ou}`);
  check(`les ${ETAPES.length} étapes mènent à un écran qui existe`, perdus.length === 0
    || (console.log('        ', perdus.join(' · ')), false));

  const sansBouton = ETAPES.filter((e) => !e.bouton || !e.titre);
  check('et chacune a un titre et un bouton', sansBouton.length === 0);
}

/* ====================================== les textes disent ce que le code fait

   Ce n'est pas un contrôle d'orthographe : c'est le seul moyen d'empêcher une
   aide de vieillir en silence. Une réponse qui cite un nombre doit le lire, pas
   le recopier. */
{
  const rendu = () => faq().flatMap((r) => r.questions.map((x) => x.r)).join('\n');
  const avant = rendu();
  check('la FAQ a des rubriques et des réponses',
    faq().length >= 3 && faq().every((r) => r.questions.length >= 3));
  check('aucune réponse n’est vide',
    faq().every((r) => r.questions.every((x) => x.q.length > 8 && x.r.length > 40)));

  /* On triple le prix d'un booster. Si le nombre était recopié, la réponse ne
     bougerait pas d'un caractère — et personne ne le saurait jamais. */
  poserReglages({ 'pack.prix_echarpes': 137, 'pack.max': 41 });
  const apres = rendu();
  check('un prix changé depuis l’administration change la réponse',
    apres.includes('137') && !avant.includes('137')
    || (console.log('        la réponse ne suit pas le réglage'), false));
  check('et un plafond changé aussi',
    apres.includes('41') && !avant.includes('41'));
  poserReglages(DEFAUTS);
  check('et remettre le réglage remet la réponse', rendu() === avant);

  /* Les textes du parcours suivent la même règle, et par le même chemin. */
  const pas = () => etapes().map((e) => `${e.quoi} ${e.pourquoi}`).join('\n');
  const t0 = pas();
  check('les textes du parcours se rendent entièrement',
    etapes().every((e) => e.quoi.length > 40 && e.pourquoi.length > 40));
  check('et ils ne dépendent d’aucun état du joueur', pas() === t0);
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await raw.end();
await pool.end();
process.exitCode = failures ? 1 : 0;
