/**
 * Le grand livre des récompenses (`src/server/recompenses.js`), et les deux
 * aides de test que toutes les suites du quotidien emploient.
 *
 * ## Ce qu'on éprouve, et pourquoi c'est ce qui compte
 *
 * Le grand livre est la seule porte des versements nouveaux : missions,
 * sachet, bonus, carnet, relais, crans, séries, divisions. S'il paie deux
 * fois, les huit sources paient deux fois ; s'il paie sans sa ligne, aucune
 * ne peut plus être rattrapée. La suite vérifie donc ses quatre promesses,
 * chacune **à la valeur exacte** — jamais « supérieur à zéro », c'est ce qui
 * avait caché le forfait payé deux fois :
 *
 *   1. une seule fois, même à deux puis à dix appels simultanés, et même
 *      quand une écriture passe sous le verrou ;
 *   2. entier ou rien : écharpes, boosters, XP et ligne dans la même
 *      transaction ;
 *   3. jamais au-delà du disjoncteur, et « déjà récupéré » avant « demain » ;
 *   4. jamais sans son registre, ni avec un registre sans sa clé.
 *
 * Et la recharge en attente comptée avant un booster offert : 11 sur 12, une
 * recharge due, un sachet → 13.
 *
 * ## Les doublures
 *
 * `niveau.gagnerDans` et `fanzzy.recharger` sont écrites par deux autres
 * périmètres. Tant qu'elles n'existent pas, la suite emploie deux doublures
 * qui suivent le code d'aujourd'hui ligne pour ligne (`niveau/index.js`,
 * `gagner` ; `fanzzy/index.js`, `wallet`). Dès qu'elles existent, la suite
 * prend **les vraies**, et le dit en tête : une doublure qui diverge du vrai
 * code ne prouve rien. `TBF_DOUBLURES=1` force les doublures.
 */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verser, verserTout, SOURCES, RAISONS, GAIN_NUL,
} from '../src/server/recompenses.js';
import { verifierSchema, messageDeManque, grandLivreFerme } from '../src/server/auth/schema.js';
import { assurerBourse } from '../src/server/bourse.js';
import { reglage, poserReglages } from '../src/shared/reglages.js';
import { niveauPour, progression, paliersEntre, ecarpesDuPalier } from '../src/shared/niveau.js';
import { baseDeTest, OPTIONS_BASE, figerHorloge, enParallele } from './base-de-test.mjs';

const DB = baseDeTest();
const SQL = fileURLToPath(new URL('../sql/', import.meta.url));
let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };
const meme = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const mysql = await import('mysql2/promise');

/** Applique des fichiers de `sql/`, dans l'ordre donné. */
async function appliquer(...fichiers) {
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  try {
    for (const f of fichiers) await raw.query(await readFile(path.join(SQL, `${f}.sql`), 'utf8'));
  } finally {
    await raw.end();
  }
}

/* La base : ce que le grand livre touche, et rien d'autre. Les clés étrangères
   sont coupées le temps du ménage, comme `reglages-smoke` : la suite ne
   reconstruit que ses tables, et les filles de `users` qu'elle ne touche pas
   restent où elles sont. */
{
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  await raw.query('SET FOREIGN_KEY_CHECKS = 0');
  await raw.query(`DROP TABLE IF EXISTS recompenses, missions_jour, compteurs_jour,
    user_nouveautes, user_wallet, users`);
  await raw.query('SET FOREIGN_KEY_CHECKS = 1');
  await raw.end();
}
/* `admin` pour `reglages` (que `saisons.sql` lit), `souvenirs` pour la bourse
   et `virage_presence`, `niveau` pour l'XP, `saisons` pour la table que
   `quotidien.sql` complète. */
await appliquer('auth', 'admin', 'souvenirs', 'niveau', 'saisons', 'quotidien');

/* Douze connexions : dix versements simultanés en tiennent dix pendant qu'ils
   attendent le verrou du joueur, et celui qui le tient doit encore pouvoir en
   prendre une. Avec quatre, une mutation qui sort une écriture de la
   transaction affamait le pool et tuait la suite sur une attente de verrou de
   cinquante secondes, avant le contrôle qui la vise. */
const pool = mysql.createPool({ uri: DB, connectionLimit: 12, ...OPTIONS_BASE });
const q = async (sql, params) => (await pool.execute(sql, params))[0];

/* --------------------------------------------------------- les doublures */

/** `gagner()` d'aujourd'hui, sur la connexion de l'appelant, et qui lève. */
async function gagnerDansDoublure(conn, userId, montant) {
  const n = Math.max(0, Math.round(Number(montant) || 0));
  const [[r]] = await conn.execute(
    'SELECT xp FROM user_wallet WHERE user_id = ? FOR UPDATE', [userId]);
  const avantXp = Number(r?.xp ?? 0);
  const apresXp = avantXp + n;
  const avant = niveauPour(avantXp);
  const apres = niveauPour(apresXp);
  let ecarpes = 0;
  for (let k = avant + 1; k <= apres; k++) ecarpes += ecarpesDuPalier(k);
  await conn.execute('UPDATE user_wallet SET xp = xp + ?, scarves = scarves + ? WHERE user_id = ?',
    [n, ecarpes, userId]);
  return { xp: apresXp, gain: n, ...progression(apresXp), avant, monte: apres > avant,
    paliers: paliersEntre(avant, apres), ecarpes,
    depart: { xp: avantXp, ...progression(avantXp) } };
}

/** La recharge de `wallet()`, sur la connexion de l'appelant, joueur gratuit. */
async function rechargerDoublure(conn, userId) {
  const plafond = reglage('pack.max');
  const cadence = reglage('pack.regen_min') * 60_000;
  const [[w]] = await conn.execute(
    'SELECT packs, packs_at FROM user_wallet WHERE user_id = ? FOR UPDATE', [userId]);
  if (w.packs < plafond) {
    const gagnes = Math.floor((Date.now() - new Date(w.packs_at).getTime()) / cadence);
    if (gagnes > 0) {
      await conn.execute('UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?',
        [Math.min(plafond, w.packs + gagnes),
          new Date(new Date(w.packs_at).getTime() + gagnes * cadence), userId]);
    }
  } else {
    await conn.execute('UPDATE user_wallet SET packs_at = ? WHERE user_id = ?', [new Date(), userId]);
  }
}

let niveau = null;
let recharger = null;
if (process.env.TBF_DOUBLURES !== '1') {
  const requireAuth = (_req, _res, suite) => suite();
  try {
    const { createNiveau } = await import('../src/server/niveau/index.js');
    const n = createNiveau({ pool, requireAuth });
    if (typeof n.gagnerDans === 'function') niveau = n;
  } catch (e) { console.log(`  (module niveau illisible : ${e.message})`); }
  try {
    const { createFanzzy } = await import('../src/server/fanzzy/index.js');
    const f = createFanzzy({ pool, requireAuth });
    if (typeof f.recharger === 'function') recharger = f.recharger;
  } catch (e) { console.log(`  (module fanzzy illisible : ${e.message})`); }
}
console.log(`\n  gagnerDans : ${niveau ? 'la vraie (niveau)' : 'la doublure'}`
  + ` · recharger : ${recharger ? 'la vraie (fanzzy)' : 'la doublure'}`);
niveau ??= { gagnerDans: gagnerDansDoublure };
recharger ??= rechargerDoublure;

/* ------------------------------------------------------------- les aides */

let numero = 0;
/** Un joueur neuf, avec sa bourse : chaque contrôle part d'un état connu. */
async function joueur() {
  const id = randomUUID();
  numero++;
  await q(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [id, `livre${numero}@test.invalid`, `Livre${numero}`]);
  await assurerBourse(q, id);
  return id;
}

async function bourse(id, { xp = true } = {}) {
  const [w] = await q(`SELECT scarves, packs${xp ? ', xp' : ''} FROM user_wallet WHERE user_id = ?`,
    [id]);
  if (!w) return null;
  return { scarves: Number(w.scarves), packs: Number(w.packs), ...(xp ? { xp: Number(w.xp) } : {}) };
}

const lignes = (id, cle) => q('SELECT * FROM recompenses WHERE user_id = ? AND cle = ?', [id, cle]);

/** Un versement de mission, avec les deux portes de la suite. */
const mission = (userId, cle, gain, plus = {}) => ({
  userId, source: 'mission', cle, saisonId: null, gain, niveau, recharger, ...plus });

const leveSur = async (fn) => { try { await fn(); return null; } catch (e) { return e; } };

/* =================================================== l'horloge figée

   Le contrôle du contrôle d'abord : toutes les suites du quotidien
   s'appuient sur `figerHorloge`, et une horloge qui ne serait figée que sur
   une connexion sur deux ferait mentir un contrôle sur deux. */

console.log('\n— l’horloge figée de la base —');
{
  const t = await figerHorloge(pool, '2026-10-02 12:00:00');
  const a = await pool.getConnection();
  const b = await pool.getConnection();
  const lire = async (c) => (await c.query(
    `SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS n, CONNECTION_ID() AS id`))[0][0];
  const ra = await lire(a);
  const rb = await lire(b);
  a.release();
  b.release();
  check('deux connexions différentes du pool', ra.id !== rb.id);
  check('SELECT NOW() rend l’instant figé sur la première (12:00:00)',
    ra.n === '2026-10-02 12:00:00' || (console.log('        lu :', ra.n), false));
  check('et sur la seconde', rb.n === '2026-10-02 12:00:00' || (console.log('        lu :', rb.n), false));

  /* Plus d'appels que de connexions : certains reçoivent la leur des mains
     d'un autre, par la file d'attente — le chemin où mysql2 ne sonne pas
     `acquire`. */
  const vus = await enParallele(30, () => pool.query('SELECT UNIX_TIMESTAMP() AS t')
    .then(([[r]]) => Number(r.t)));
  check('trente lectures pour douze connexions, toutes à l’heure figée',
    vus.every((x) => x === t) || (console.log('        lus :', vus.join(' ')), false));

  await figerHorloge(pool, '2026-10-24 23:59:59');
  const [[veille]] = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS j`);
  await figerHorloge(pool, '2026-10-25 00:00:01');
  const [[lendemain]] = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS j`);
  check('23:59:59 puis 00:00:01 : le jour de jeu change à minuit de la base',
    veille.j === '2026-10-24' && lendemain.j === '2026-10-25');

  /* Les deux dimanches de changement d'heure, comptés comme le serveur doit
     compter un reste : en secondes Unix, jamais en heure murale. */
  const reste = async () => Number((await pool.query(
    `SELECT UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY) - UNIX_TIMESTAMP(NOW(3)) AS s`))[0][0].s);
  await figerHorloge(pool, '2026-10-25 00:30:00');
  const r25 = await reste();
  check('le 2026-10-25 à 00:30, 88 200 s jusqu’au jour suivant (journée de 25 h)',
    r25 === 88200 || (console.log('        lu :', r25), false));
  await figerHorloge(pool, '2027-03-28 00:30:00');
  const r23 = await reste();
  check('le 2027-03-28 à 00:30, 81 000 s (journée de 23 h)',
    r23 === 81000 || (console.log('        lu :', r23), false));

  await figerHorloge(pool, null);
  const [[libre]] = await pool.query('SELECT UNIX_TIMESTAMP() AS t');
  check('relâchée, l’horloge de la base repart à l’heure réelle',
    Math.abs(Number(libre.t) - Date.now() / 1000) < 5);

  const leve = await leveSur(() => figerHorloge(pool, 'demain midi'));
  check('un instant illisible lève en le nommant', /demain midi/.test(leve?.message ?? ''));

  const d = await enParallele(3, async (i) => i * 2);
  check('enParallele rend les résultats dans l’ordre des appels', meme(d, [0, 2, 4]));
  let fini = 0;
  const e = await leveSur(() => enParallele(3, async (i) => {
    if (i === 0) throw new Error('premier');
    await new Promise((r) => setTimeout(r, 30));
    fini++;
  }));
  check('et un échec n’est rendu qu’une fois tous les appels finis',
    e?.message === 'premier' && fini === 2);
}

/* ================================================= le contrat du module */

console.log('\n— ce que le module promet —');
check('les neuf sources, liste fermée (la neuvième : l’XP du Virage, vague 2)',
  meme(SOURCES, ['bonus', 'mission', 'sachet', 'carnet', 'relais', 'cran', 'serie', 'division',
    'virage']));
check('les raisons de refus sont celles du contrat (§ 11), quota compris',
  meme([...RAISONS].sort(), ['deja', 'incomplet', 'jour_passe', 'change', 'inactif', 'plafond',
    'schema', 'inconnu', 'quota'].sort()));
check('le gain nul a les quatre clés à zéro', meme(GAIN_NUL, { echarpes: 0, packs: 0, xp: 0, tampons: 0 }));
{
  /* L1 : le grand livre ne peut pas savoir qui est abonné. Le meilleur moyen
     de garantir qu'aucun montant n'en dépend est qu'il ne puisse pas le lire. */
  const texte = await readFile(new URL('../src/server/recompenses.js', import.meta.url), 'utf8');
  const imports = [...texte.matchAll(/^import[^;]*from\s+'([^']+)'/gm)].map((m) => m[1]);
  check('il n’importe ni l’abonnement, ni le KOP, ni les amis',
    imports.length > 0 && !imports.some((m) => /abonnement|kop|amis/.test(m))
    || (console.log('        imports :', imports.join(', ')), false));
  check('et ne lit nulle part estAbonne', !/estAbonne/.test(texte));
}

/* ================================================= un versement, exact */

console.log('\n— un versement —');
{
  const A = await joueur();
  const avant = await bourse(A);
  const r = await verser(pool, mission(A, '2026-10-02:0', { echarpes: 30, packs: 0, xp: 20, tampons: 1 },
    { saisonId: 1 }));
  check('il est versé', r.verse === true || (console.log('        rendu :', JSON.stringify(r)), false));
  check('la réponse a la forme du contrat (verse, gain, wallet, niveau)',
    meme(Object.keys(r).sort(), ['gain', 'niveau', 'verse', 'wallet']));
  check('le gain rendu est exactement celui versé',
    meme(r.gain, { echarpes: 30, packs: 0, xp: 20, tampons: 1 }));
  const apres = await bourse(A);
  check('la bourse monte exactement de 30 écharpes et 20 XP, pas un booster de plus',
    apres.scarves === avant.scarves + 30 && apres.xp === avant.xp + 20 && apres.packs === avant.packs
    || (console.log('        avant', JSON.stringify(avant), 'après', JSON.stringify(apres)), false));
  check('le solde rendu est le solde réel',
    r.wallet.scarves === apres.scarves && r.wallet.packs === apres.packs);
  const [l] = await lignes(A, '2026-10-02:0');
  check('la ligne du grand livre porte exactement le gain et la saison',
    l && l.source === 'mission' && l.echarpes === 30 && l.packs === 0 && l.xp === 20
      && l.tampons === 1 && l.saison_id === 1 && l.titre === null);
  check('la jauge d’XP est celle du contrat : gain, départ, arrivée',
    r.niveau?.gain === 20 && r.niveau?.xp === avant.xp + 20 && r.niveau?.depart?.xp === avant.xp
      && typeof r.niveau?.part === 'number' && typeof r.niveau?.depart?.part === 'number');

  const re = await verser(pool, mission(A, '2026-10-02:0', { echarpes: 30, packs: 0, xp: 20, tampons: 1 }));
  check('la même clé une seconde fois : « deja », sous la forme du contrat',
    meme(re, { verse: false, raison: 'deja' }));
  check('et rien n’a bougé', meme(await bourse(A), apres));

  /* Une division ne verse que de l'honneur : la ligne porte le titre, la
     bourse ne bouge pas, et il n'y a pas de jauge. */
  const div = await verser(pool, { userId: A, source: 'division', cle: 'S1:capo', saisonId: 1,
    gain: GAIN_NUL, titre: 'Capo de la saison 1' });
  check('un gain nul se verse, sans jauge ni écharpe',
    div.verse === true && meme(div.gain, GAIN_NUL) && !('niveau' in div)
      && meme(await bourse(A), apres));
  const [d] = await lignes(A, 'S1:capo');
  check('et sa ligne porte le titre', d?.titre === 'Capo de la saison 1' && d?.echarpes === 0);
}

/* ==================================================== deux onglets, dix */

console.log('\n— deux onglets, puis dix —');
{
  const B = await joueur();
  const avant = await bourse(B);
  const deux = await enParallele(2, () => verser(pool, mission(B, 'deux', { echarpes: 60, xp: 10 })));
  check('deux appels simultanés : un versé, un « deja »',
    deux.filter((r) => r.verse).length === 1 && deux.filter((r) => r.raison === 'deja').length === 1
    || (console.log('        rendus :', JSON.stringify(deux)), false));
  const dix = await enParallele(10, () => verser(pool, mission(B, 'dix', { echarpes: 25, xp: 5 })));
  check('dix appels simultanés : un versé, neuf « deja »',
    dix.filter((r) => r.verse).length === 1 && dix.filter((r) => r.raison === 'deja').length === 9
    || (console.log('        rendus :', JSON.stringify(dix.map((r) => r.raison ?? 'verse'))), false));
  const apres = await bourse(B);
  check('la bourse n’a monté qu’une fois chacun : +85 écharpes exactement',
    apres.scarves === avant.scarves + 85 || (console.log('        lu :', apres.scarves), false));
  check('et l’XP qu’une fois : +15 exactement', apres.xp === avant.xp + 15);
  check('une seule ligne par clé', (await lignes(B, 'deux')).length === 1
    && (await lignes(B, 'dix')).length === 1);

  /* Le même, avec un booster : la recharge passe sous le verrou à chaque
     tentative, et le cadeau n'entre qu'une fois. */
  const sachets = await enParallele(10, () => verser(pool, { userId: B, source: 'sachet',
    cle: 'sachet-dix', gain: { packs: 1, tampons: 1 }, recharger }));
  check('dix sachets simultanés : un seul booster de plus',
    sachets.filter((r) => r.verse).length === 1 && (await bourse(B)).packs === apres.packs + 1);
}

/* La course que l'étape 2 ne voit pas : une écriture qui n'est pas passée par
   le verrou du joueur arrive entre le contrôle et l'INSERT. C'est le gain,
   calculé dans la transaction, qui la plante ici. L'INSERT doit buter sur la
   clé et tout annuler — un `INSERT IGNORE` sans lecture des lignes touchées
   verserait quand même.

   **Deux bases, deux façons de buter.** MariaDB 11.6 et après (le poste de
   développement) arrêtent l'INSERT par `ER_CHECKREAD`, l'isolation par
   instantané ; les versions d'avant, par `ER_DUP_ENTRY`. La production peut
   être l'une ou l'autre. La course se joue donc deux fois : avec la base
   telle qu'elle est, puis sur un pool dont chaque connexion éteint
   l'isolation par instantané — c'est ce second passage qui voit un
   `INSERT IGNORE`, le premier rejouant la course de toute façon. */
console.log('\n— la course que le contrôle ne voit pas —');
async function course(p, nom) {
  const C = await joueur();
  const avant = await bourse(C);
  let plantees = 0;
  const r = await verser(p, mission(C, 'course', async () => {
    plantees++;
    await pool.query(`INSERT INTO recompenses (user_id, source, cle, echarpes) VALUES (?, 'mission', 'course', 1)`,
      [C]);
    return { echarpes: 40, xp: 10 };
  }));
  check(`${nom} : le doublon à l’INSERT rend « deja »`, r.raison === 'deja'
    || (console.log('        rendu :', JSON.stringify(r)), false));
  check(`${nom} : rien de crédité, ni écharpe ni XP`, meme(await bourse(C), avant)
    || (console.log('        lu :', JSON.stringify(await bourse(C))), false));
  const l = await lignes(C, 'course');
  check(`${nom} : la seule ligne est celle qui était là`, l.length === 1 && l[0].echarpes === 1
    && plantees === 1);
}
{
  let strict = null;
  try {
    strict = Number((await pool.query('SELECT @@session.innodb_snapshot_isolation AS s'))[0][0].s);
  } catch { /* une base qui ne connaît pas la variable : l'ancien comportement */ }
  await course(pool, strict === 1 ? 'instantanés stricts' : 'cette base');
  if (strict !== null) {
    const ancienne = mysql.createPool({ uri: DB, connectionLimit: 2, ...OPTIONS_BASE });
    ancienne.on('connection', (c) => c.query('SET SESSION innodb_snapshot_isolation = OFF', () => {}));
    const [[eteinte]] = await ancienne.query('SELECT @@session.innodb_snapshot_isolation AS s');
    check('le second pool a bien éteint l’isolation par instantané', Number(eteinte.s) === 0);
    await course(ancienne, 'sans instantanés stricts');
    await ancienne.end();
  }
}

/* ========================================================= le recompte */

console.log('\n— le recompte de l’appelant —');
{
  const D = await joueur();
  const avant = await bourse(D);
  const r = await verser(pool, mission(D, 'pas-fini', { echarpes: 30 }, {
    verifier: async (conn) => {
      const [[x]] = await conn.query('SELECT 1 AS un');
      return x.un === 1 ? 'incomplet' : true;
    } }));
  check('un recompte qui refuse rend sa raison', meme(r, { verse: false, raison: 'incomplet' }));
  check('et rien n’est écrit', (await lignes(D, 'pas-fini')).length === 0 && meme(await bourse(D), avant));

  const faux = await leveSur(() => verser(pool, mission(D, 'faux', { echarpes: 30 },
    { verifier: async () => false })));
  check('un recompte qui rend autre chose qu’une raison connue lève en le disant',
    /verifier a rendu/.test(faux?.message ?? ''));
  check('sans rien écrire non plus', (await lignes(D, 'faux')).length === 0);

  const oui = await verser(pool, mission(D, 'fini', { echarpes: 5 }, { verifier: async () => true }));
  check('un recompte qui dit oui laisse verser', oui.verse === true);
}

/* ===================================================== l'XP du Virage

   La vague 2 (lot 6) fait verser au Virage **15 XP par match poussé, une fois
   par match, à partir de 10 chants, 3 matchs par jour au plus** (décision de
   Gaël du 3 octobre 2026, `CONTRATS.md` § 15.2). Le bilan qui l'appelle est
   écrit par un autre périmètre ; ce que le grand livre doit tenir, lui, se
   vérifie ici : la source existe, le montant est exact, l'idempotence est
   celle du match, et le quota d'une source traverse tel quel.

   Les appels passent par `essayer` : une source retirée de la liste lève
   (faute d'appelant), et ce contrôle-là doit rougir avec son nom, pas tuer
   la suite. */
console.log('\n— l’XP du Virage —');
{
  const essayer = (o) => verser(pool, o).catch((e) => ({ leve: e.message }));
  /* Le montant vient du registre, comme le bilan le prendra : jamais de la
     page, jamais écrit en dur. La clé est l'identifiant du match. */
  const virage = (userId, fixtureId, plus = {}) => ({
    userId, source: 'virage', cle: String(fixtureId), saisonId: null,
    gain: { xp: reglage('xp.virage') }, niveau, recharger, ...plus });
  check('le registre dit 15 XP par match au départ', reglage('xp.virage') === 15);

  const V = await joueur();
  const avant = await bourse(V);
  const r = await essayer(virage(V, 1208051));
  const apres = await bourse(V);
  check('un match poussé : versé, exactement 15 XP et rien d’autre',
    r.verse === true && meme(r.gain, { echarpes: 0, packs: 0, xp: 15, tampons: 0 })
      && apres.xp === avant.xp + 15 && apres.scarves === avant.scarves && apres.packs === avant.packs
    || (console.log('        rendu :', JSON.stringify(r), 'bourse', JSON.stringify([avant, apres])), false));
  const l = await lignes(V, '1208051');
  check('une ligne au grand livre, source virage, clé = le match, 15 XP',
    l.length === 1 && l[0].source === 'virage' && l[0].xp === 15 && l[0].echarpes === 0
      && l[0].packs === 0 && l[0].tampons === 0
    || (console.log('        lignes :', JSON.stringify(l)), false));
  check('et la réponse porte la jauge d’XP du § 1 (gain 15, départ)',
    r.niveau?.gain === 15 && r.niveau?.depart?.xp === avant.xp);
  check('le même match une seconde fois : « deja »',
    meme(await essayer(virage(V, 1208051)), { verse: false, raison: 'deja' }));

  /* Deux onglets, puis dix : le premier bilan au coup de sifflet et le filet
     du départ peuvent se croiser. Une ligne par match, jamais deux. */
  const W = await joueur();
  const avantW = await bourse(W);
  const deux = await enParallele(2, () => essayer(virage(W, 7001)));
  check('deux demandes simultanées pour un match : un versé, un « deja »',
    deux.filter((x) => x.verse).length === 1 && deux.filter((x) => x.raison === 'deja').length === 1
    || (console.log('        rendus :', JSON.stringify(deux)), false));
  const dix = await enParallele(10, () => essayer(virage(W, 7002)));
  check('dix demandes simultanées pour un autre match : un versé, neuf « deja »',
    dix.filter((x) => x.verse).length === 1 && dix.filter((x) => x.raison === 'deja').length === 9
    || (console.log('        rendus :', JSON.stringify(dix.map((x) => x.raison ?? x.leve ?? 'verse'))), false));
  check('l’XP n’est montée qu’une fois par match : +30 exactement',
    (await bourse(W)).xp === avantW.xp + 30);
  check('une seule ligne par match',
    (await lignes(W, '7001')).length === 1 && (await lignes(W, '7002')).length === 1);

  /* Le quota : au plus `xp.virage_matchs_jour` matchs par jour de jeu. Il
     n'est pas au grand livre — le disjoncteur ne regarde que les écharpes et
     les boosters — mais dans le recompte de la source, sur la connexion du
     versement, et sa raison doit traverser telle quelle. Les trois lignes du
     jour sont semées comme le serveur les écrit : la base les date. */
  const Q = await joueur();
  for (const f of [8001, 8002, 8003]) {
    await pool.query(`INSERT INTO recompenses (user_id, source, cle, xp) VALUES (?, 'virage', ?, 15)`,
      [Q, String(f)]);
  }
  const avantQ = await bourse(Q);
  const quota = async (conn) => {
    const [[n]] = await conn.query(`SELECT COUNT(*) AS n FROM recompenses
      WHERE user_id = ? AND source = 'virage' AND verse_a >= CURDATE()`, [Q]);
    return Number(n.n) >= reglage('xp.virage_matchs_jour') ? 'quota' : true;
  };
  const rq = await essayer(virage(Q, 8004, { verifier: quota }));
  check('le quatrième match du jour : « quota », tel quel',
    meme(rq, { verse: false, raison: 'quota' }) || (console.log('        rendu :', JSON.stringify(rq)), false));
  check('rien d’écrit, ni XP ni ligne', meme(await bourse(Q), avantQ)
    && (await lignes(Q, '8004')).length === 0);

  /* `incomplet`, avec ce qui manque : le grand livre ne transporte que la
     raison, et c'est voulu — ce que le recompte veut dire de plus reste dans
     sa fermeture (le bilan y lit `manque`). Le motif est montré ici, pour
     qu'il soit éprouvé une fois là où il se décide. */
  let manque = null;
  const ri = await essayer(virage(Q, 8005, { verifier: async (conn) => {
    const [[x]] = await conn.query('SELECT 9 AS chants');
    if (x.chants < reglage('xp.virage_chants')) {
      manque = reglage('xp.virage_chants') - x.chants;
      return 'incomplet';
    }
    return true;
  } }));
  check('neuf chants : « incomplet », et le recompte sait qu’il en manque un',
    meme(ri, { verse: false, raison: 'incomplet' }) && manque === 1
    && (await lignes(Q, '8005')).length === 0);
  check('xp.virage à 0 : le recompte rend « inactif », qui traverse aussi',
    meme(await essayer(virage(Q, 8006, { verifier: async () => 'inactif' })),
      { verse: false, raison: 'inactif' }));

  /* L'XP seule ne bute jamais sur le disjoncteur : il borne les écharpes et
     les boosters d'un jour, pas l'expérience. Un joueur qui a touché tout son
     plafond d'écharpes reçoit encore l'XP de son match. */
  poserReglages({ 'recompenses.plafond_echarpes_jour': 100 });
  const P = await joueur();
  const plein = await essayer(mission(P, 'plein', { echarpes: 100 }));
  const rp = await essayer(virage(P, 9001));
  poserReglages({});
  check('disjoncteur des écharpes atteint : l’XP du Virage passe quand même',
    plein.verse === true && rp.verse === true && rp.gain?.xp === 15
    || (console.log('        rendus :', JSON.stringify([plein, rp])), false));
}

/* =================================================== les fautes d'appel */

console.log('\n— les fautes de l’appelant lèvent, sans rien écrire —');
{
  const E = await joueur();
  const avant = await bourse(E);
  const cas = [
    ['une clé de gain inconnue (echarpe)', mission(E, 'f1', { echarpe: 30 })],
    ['un gain négatif', mission(E, 'f2', { echarpes: -5 })],
    ['un gain décimal', mission(E, 'f3', { echarpes: 2.5 })],
    ['une source hors liste', { ...mission(E, 'f4', { echarpes: 1 }), source: 'cadeau' }],
    ['une clé de plus de 40 caractères', mission(E, 'x'.repeat(41), { echarpes: 1 })],
    ['des boosters sans recharger', { userId: E, source: 'sachet', cle: 'f5', gain: { packs: 1 }, niveau }],
    ['de l’XP sans le module niveau', { userId: E, source: 'mission', cle: 'f6', gain: { xp: 5 },
      recharger }],
  ];
  for (const [quoi, o] of cas) {
    const e = await leveSur(() => verser(pool, o));
    check(`${quoi} : lève`, e instanceof Error || (console.log('        rien levé'), false));
  }
  const [[n]] = await pool.query('SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?', [E]);
  check('aucune ligne, aucune écharpe', Number(n.n) === 0 && meme(await bourse(E), avant));

  /* Un joueur qui n'existe pas : la bourse ne peut pas s'ouvrir, rien ne
     s'inscrit. */
  const fantome = randomUUID();
  let r = null;
  const e = await leveSur(async () => { r = await verser(pool, mission(fantome, 'g', { echarpes: 10 })); });
  check('un joueur inconnu ne reçoit rien et n’inscrit rien',
    !e && r?.raison === 'inconnu'
      && (await q('SELECT 1 FROM recompenses WHERE user_id = ?', [fantome])).length === 0
    || (console.log('        rendu :', JSON.stringify(r), e?.message ?? ''), false));
}

/* ======================================================= le disjoncteur */

console.log('\n— le disjoncteur —');
{
  poserReglages({ 'recompenses.plafond_echarpes_jour': 100, 'recompenses.plafond_packs_jour': 2 });
  const F = await joueur();
  const r1 = await verser(pool, mission(F, 'p1', { echarpes: 60, xp: 5 }));
  const apres1 = await bourse(F);
  const r2 = await verser(pool, mission(F, 'p2', { echarpes: 60, xp: 5 }));
  check('au-delà du plafond du jour : « plafond »', r1.verse === true
    && meme(r2, { verse: false, raison: 'plafond' })
    || (console.log('        rendus :', JSON.stringify([r1, r2])), false));
  check('la bourse n’a pas bougé, l’XP non plus', meme(await bourse(F), apres1));
  check('et la ligne n’est pas inscrite : elle reste due', (await lignes(F, 'p2')).length === 0);

  /* L'ordre compte : une chose déjà payée, un jour de plafond, ne doit pas
     répondre « tu récupéreras demain » pour un versement qui ne viendra
     jamais. */
  const r3 = await verser(pool, mission(F, 'p1', { echarpes: 60, xp: 5 }));
  check('un élément déjà versé, disjoncteur atteint : « deja », pas « plafond »',
    r3.raison === 'deja' || (console.log('        rendu :', JSON.stringify(r3)), false));

  const r4 = await verser(pool, mission(F, 'p3', { echarpes: 40 }));
  check('jusqu’au plafond exactement, ça passe (60 + 40 = 100)', r4.verse === true);
  const r5 = await verser(pool, { userId: F, source: 'division', cle: 'S1:ultra', saisonId: 1, gain: GAIN_NUL });
  check('un gain nul passe toujours, même au plafond', r5.verse === true);

  const k1 = await verser(pool, { userId: F, source: 'sachet', cle: 'k1', gain: { packs: 2 }, recharger });
  const k2 = await verser(pool, { userId: F, source: 'sachet', cle: 'k2', gain: { packs: 1 }, recharger });
  check('les boosters ont leur propre plafond', k1.verse === true && k2.raison === 'plafond');

  /* Hier ne compte pas. La ligne est semée comme le serveur l'écrit : la
     base la date, et la veille est sa veille. */
  const G = await joueur();
  await pool.query(`INSERT INTO recompenses (user_id, source, cle, echarpes, verse_a)
    VALUES (?, 'mission', 'hier', 5000, NOW(3) - INTERVAL 1 DAY)`, [G]);
  const g = await verser(pool, mission(G, 'aujourdhui', { echarpes: 100 }));
  check('ce qui a été versé hier ne compte pas aujourd’hui', g.verse === true);

  /* Et minuit est celui de la base : ce qui est bloqué à 23:59 passe à 00:00. */
  const H = await joueur();
  await figerHorloge(pool, '2026-11-14 23:59:58');
  const h1 = await verser(pool, mission(H, 'm1', { echarpes: 100 }));
  const h2 = await verser(pool, mission(H, 'm2', { echarpes: 1 }));
  await figerHorloge(pool, '2026-11-15 00:00:01');
  const h3 = await verser(pool, mission(H, 'm2', { echarpes: 1 }));
  await figerHorloge(pool, null);
  check('bloqué à 23:59:58, versé à 00:00:01 : c’est dû le lendemain',
    h1.verse === true && h2.raison === 'plafond' && h3.verse === true
    || (console.log('        rendus :', JSON.stringify([h1, h2, h3])), false));
  poserReglages({});
}

/* ===================================== la recharge, avant le booster offert */

console.log('\n— le booster offert et la recharge —');
{
  const plafond = reglage('pack.max');
  const cadence = reglage('pack.regen_min') * 60_000;

  const I = await joueur();
  await q('UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?', [plafond, new Date(), I]);
  const r = await verser(pool, { userId: I, source: 'sachet', cle: 'plein', gain: { packs: 1 }, recharger });
  check(`réserve pleine (${plafond}) + 1 booster : ${plafond + 1}, au-dessus du plafond`,
    r.wallet?.packs === plafond + 1 && (await bourse(I)).packs === plafond + 1
    || (console.log('        rendu :', JSON.stringify(r)), false));

  /* `packs_at` est daté comme le serveur le date : en JavaScript, par le
     pilote. Une cadence et une seconde : une recharge est due. */
  const J = await joueur();
  await q('UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?',
    [plafond - 1, new Date(Date.now() - cadence - 1000), J]);
  const s = await verser(pool, { userId: J, source: 'sachet', cle: 'du', gain: { packs: 1 }, recharger });
  check(`à ${plafond - 1} sur ${plafond} avec une recharge due, un sachet donne ${plafond + 1}, pas ${plafond}`,
    s.wallet?.packs === plafond + 1 && (await bourse(J)).packs === plafond + 1
    || (console.log('        rendu :', JSON.stringify(s)), false));
}

/* =================================================== entier, ou rien */

console.log('\n— entier ou rien —');
{
  /* La table du grand livre absente : la fonction s'éteint, et rien n'est
     crédité, dix fois de suite. Une seule réussite sans sa ligne serait un
     versement qu'on ne pourrait plus jamais rattraper. */
  const K = await joueur();
  const avant = await bourse(K);
  await pool.query('DROP TABLE recompenses');
  const dix = await enParallele(10, (k) => verser(pool, mission(K, `sans-${k}`,
    { echarpes: 30, xp: 5 })));
  check('sans la table : « schema », dix fois sur dix',
    dix.every((r) => meme(r, { verse: false, raison: 'schema' }))
    || (console.log('        rendus :', JSON.stringify(dix)), false));
  check('et la bourse n’a pas bougé', meme(await bourse(K), avant));
  await appliquer('quotidien');

  /* La colonne d'XP absente : `gagnerDans` lève, et c'est tout le versement
     qui tombe — ni écharpes, ni ligne. Créditée après la validation, l'XP
     manquerait sous une ligne qui la dit versée. */
  const L = await joueur();
  const avantL = await bourse(L, { xp: false });
  await pool.query('ALTER TABLE user_wallet DROP COLUMN xp');
  const r = await verser(pool, mission(L, 'sans-xp', { echarpes: 30, xp: 20 }));
  const apresL = await bourse(L, { xp: false });
  const sansLigne = (await lignes(L, 'sans-xp')).length === 0;
  await appliquer('niveau');
  check('sans la colonne d’XP : « schema »', meme(r, { verse: false, raison: 'schema' })
    || (console.log('        rendu :', JSON.stringify(r)), false));
  check('ni écharpes', meme(apresL, avantL) || (console.log('        lu :', JSON.stringify(apresL)), false));
  check('ni ligne au grand livre', sansLigne);
}

/* ================================== la clé primaire, vue au démarrage */

console.log('\n— le grand livre sans sa clé —');
{
  await verifierSchema(pool, SQL);
  check('une base juste laisse le grand livre ouvert', grandLivreFerme() === null);

  await pool.query('ALTER TABLE recompenses DROP PRIMARY KEY');
  check('la clé retirée ne ferme rien tant que le démarrage n’a pas regardé',
    grandLivreFerme() === null);
  const manques = await verifierSchema(pool, SQL);
  const m = manques.find((x) => x.fichier === 'quotidien.sql');
  check('au démarrage suivant, le contrôle nomme sql/quotidien.sql et la clé',
    m?.cles?.some((c) => c.startsWith('recompenses (user_id, source, cle)'))
    || (console.log('        vu :', JSON.stringify(m)), false));
  const msg = messageDeManque(manques) ?? '';
  check('et le message dit qu’on ne la répare pas en rejouant le fichier',
    msg.includes('sql/quotidien.sql') && msg.includes('clé(s) primaire(s) fausse(s)')
      && msg.includes('ne se corrige PAS'));
  check('le grand livre est fermé', typeof grandLivreFerme() === 'string');

  const M = await joueur();
  const avant = await bourse(M);
  const r = await verser(pool, mission(M, 'ferme', { echarpes: 10 }));
  check('fermé, il refuse : « schema »', meme(r, { verse: false, raison: 'schema' }));
  check('sans rien créditer ni inscrire', meme(await bourse(M), avant)
    && (await lignes(M, 'ferme')).length === 0);

  /* Une autre table du fichier sans sa clé se dit, mais ne ferme pas le
     grand livre : ce n'est pas lui qui en dépend. */
  await pool.query('DROP TABLE recompenses');
  await appliquer('quotidien');
  await pool.query('ALTER TABLE missions_jour DROP PRIMARY KEY');
  const autres = await verifierSchema(pool, SQL);
  check('missions_jour sans sa clé est signalée, et le grand livre rouvre',
    autres.find((x) => x.fichier === 'quotidien.sql')?.cles?.some((c) => c.startsWith('missions_jour '))
      && grandLivreFerme() === null);
  await pool.query('DROP TABLE missions_jour');
  await appliquer('quotidien');
  await verifierSchema(pool, SQL);
  const r2 = await verser(pool, mission(M, 'ferme', { echarpes: 10 }));
  check('la base corrigée et le démarrage refait, il verse de nouveau', r2.verse === true);
}

/* ====================================================== tout récupérer */

console.log('\n— tout récupérer —');
{
  poserReglages({ 'recompenses.plafond_echarpes_jour': 100 });
  const N = await joueur();
  const liste = [
    { userId: N, source: 'mission', cle: 'a', gain: { echarpes: 30, xp: 20 } },
    { userId: N, source: 'mission', cle: 'b', gain: { echarpes: 50, xp: 30 } },
    { userId: N, source: 'mission', cle: 'c', gain: { echarpes: 40, xp: 10 } },
    { userId: N, source: 'sachet', cle: 'd', gain: { packs: 1 } },
  ];
  const r = await verserTout(pool, liste, { niveau, recharger });
  check('le disjoncteur arrête en route : ce qui est versé l’est',
    r.verse === true && meme(r.gain, { echarpes: 80, packs: 0, xp: 50, tampons: 0 })
    || (console.log('        rendu :', JSON.stringify(r)), false));
  check('et « reste » compte les éléments restés dus (2)', r.reste === 2);
  check('le solde rendu est celui d’après le dernier versement', r.wallet?.scarves === 80);
  check('la jauge part d’avant le premier et finit après le dernier',
    r.niveau?.depart?.xp === 0 && r.niveau?.xp === 50 && r.niveau?.gain === 50 && r.niveau?.avant === 1);
  check('aucune ligne pour ce qui est resté dû',
    (await lignes(N, 'c')).length === 0 && (await lignes(N, 'd')).length === 0);
  poserReglages({});

  const re = await verserTout(pool, liste.slice(0, 2), { niveau, recharger });
  check('tout déjà versé : rien, et la première raison', meme(re, { verse: false, raison: 'deja' }));
  check('une liste vide : « incomplet »',
    meme(await verserTout(pool, [], { niveau, recharger }), { verse: false, raison: 'incomplet' }));

  /* Avec une montée de niveau au milieu : les écharpes du palier sont dans
     le solde et dans la somme, la montée est dite une fois. */
  const P = await joueur();
  await q('UPDATE user_wallet SET xp = 50 WHERE user_id = ?', [P]);
  const t = await verserTout(pool, [
    { userId: P, source: 'mission', cle: 'x1', gain: { xp: 20 } },
    { userId: P, source: 'mission', cle: 'x2', gain: { xp: 10 } },
  ], { niveau, recharger });
  const palier = ecarpesDuPalier(2);
  check('une montée en route : avant 1, niveau 2, monte',
    t.niveau?.avant === 1 && t.niveau?.niveau === 2 && t.niveau?.monte === true
    || (console.log('        rendu :', JSON.stringify(t.niveau)), false));
  check(`les écharpes du palier (${palier}) sont dans la jauge et dans le solde`,
    t.niveau?.ecarpes === palier && t.wallet?.scarves === palier
      && meme(t.niveau?.paliers, paliersEntre(1, 2)));
  check('la jauge garde le départ du premier versement', t.niveau?.depart?.xp === 50
    && t.niveau?.xp === 80 && t.niveau?.gain === 30);
}

/* ------------------------------------------------------------------ fin */

await figerHorloge(pool, null);
poserReglages({});
await pool.end();
console.log(rates ? `\n${rates} échec(s)` : '\ntout est vert');
process.exitCode = rates ? 1 : 0;
