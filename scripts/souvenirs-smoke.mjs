/**
 * Test des cartes-souvenirs.
 *
 * Trois joueurs, un match, trois buts. L'un pousse tout le match, l'autre
 * s'arrête à la mi-temps, le troisième n'est jamais venu. On vérifie qui
 * reçoit quoi, ce qui s'achète, et pendant combien de temps.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createSouvenirs, PRESENCE_WINDOW_MS, REPLI_CHANTS_MS } from '../src/server/souvenirs/index.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS pronostics, parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
/* `quotidien.sql` pose les colonnes des chants sur `virage_presence`. Il
   complète aussi `saisons`, d'où `saisons.sql` avant lui, qui lit lui-même
   `reglages` (admin.sql) : le fichier s'applique en entier, tel que le
   déploiement l'applique, et non par morceaux choisis. `arenes.sql` vient en
   dernier, comme dans `ORDRE` : les PARFAITS, la série et le meilleur geste
   du bilan de tribune. */
const SCHEMA = ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
  'admin.sql', 'saisons.sql', 'quotidien.sql', 'arenes.sql'];
for (const f of SCHEMA) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = ['aaaaaaaa-0000-0000-0000-000000000001',
           'aaaaaaaa-0000-0000-0000-000000000002',
           'aaaaaaaa-0000-0000-0000-000000000003'];
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?,?,?,'x')`,
    [id, `j${i}@ex.fr`, `Joueur${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id, scarves) VALUES (?, 200)`, [id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'FC Sion'),(91,'FC Bâle')`);
await raw.query(`INSERT INTO leagues (id,name) VALUES (207,'Super League')`);
await raw.query(`INSERT INTO souvenir_leagues (league_id,season,name,family,has_events,enabled)
                 VALUES (207,2026,'Super League','championnat',1,1),
                        (999,2026,'Coupe Fantôme','coupe',1,0)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
let who = U[0];
const S = createSouvenirs({ pool, requireAuth: (req, _r, next) => { req.user = { id: who }; next(); } });

const app = express();
app.use('/api/souvenirs', S.router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

const goal = (seq, minute, team, sh, sa, player) => ({
  fixtureId: 5001, seq, leagueId: 207, teamId: team, homeId: 85, awayId: 91,
  minute, player, scoreHome: sh, scoreAway: sa, kickoffAt: '2026-09-13 16:00:00',
});

/* --------------------------------------------------- les deux premiers buts */

await S.recordPush({ userId: U[0], fixtureId: 5001, side: 0, fanzzyId: 'TR32C', amount: 40 });
await S.recordPush({ userId: U[1], fixtureId: 5001, side: 0, fanzzyId: 'MS30B', amount: 25 });

let r = await S.mintGoal(goal(1, 23, 85, 1, 0, 'Diallo'));
check('but frappé', r.minted === true);
check('les deux présents reçoivent la carte', r.presents === 2);
check('prix de championnat', r.price === 60);
/* **Les receveurs, nommés** (D5) : c'est la liste à qui le Virage annonce la
   carte (`virage:souvenir`), sous ce nom exact — `server.js` le lit, et un
   autre nom ne lèverait rien : la carte ne s'annoncerait simplement plus. */
check('la frappe nomme ses receveurs (userIds), eux et eux seuls',
  JSON.stringify([...(r.userIds ?? [])].sort()) === JSON.stringify([U[0], U[1]].sort())
  || (console.log('        userIds :', JSON.stringify(r.userIds)), false));

r = await S.mintGoal(goal(1, 23, 85, 1, 0, 'Diallo'));
check('rejouer le même but ne refrappe rien', r.minted === false && r.reason === 'already_minted');
check('et ne nomme personne : un but déjà frappé ne se réannonce pas',
  Array.isArray(r.userIds) && r.userIds.length === 0);

r = await S.mintGoal({ ...goal(2, 30, 85, 2, 0, 'Morel'), leagueId: 999 });
check('compétition désactivée : aucune carte', r.reason === 'league_not_eligible');
check('et personne à qui l’annoncer', Array.isArray(r.userIds) && r.userIds.length === 0);

/* --------------------------------- le deuxième joueur décroche à la mi-temps */

await pool.query(
  `UPDATE virage_presence SET last_push_at = NOW(3) - INTERVAL 10 MINUTE WHERE user_id = ?`, [U[1]]);
await S.recordPush({ userId: U[0], fixtureId: 5001, side: 0, fanzzyId: 'TR32C', amount: 30 });

r = await S.mintGoal(goal(2, 67, 91, 1, 1, 'Keller'));
check('seul celui qui poussait encore reçoit la deuxième', r.presents === 1);

r = await S.mintGoal(goal(3, 87, 85, 2, 1, 'Diallo'));
check('troisième but frappé', r.minted === true && r.presents === 1);

/* ---------------------------------------------------------------- collections */

who = U[0];
r = await call('/api/souvenirs/mine');
check('le fidèle a les trois souvenirs', r.json.souvenirs.length === 3);
check('tous en présence', r.json.souvenirs.every((s) => s.kind === 'presence'));
check('le Fanzzy porté est conservé', r.json.souvenirs[0].fanzzy_id === 'TR32C');
check('le buteur et la minute sont sur la carte',
  r.json.souvenirs.some((s) => s.player === 'Diallo' && s.minute === 87));
check('le score final figure',
  r.json.souvenirs.some((s) => s.score_home === 2 && s.score_away === 1));

who = U[1];
r = await call('/api/souvenirs/mine');
check('celui qui a décroché n\u2019a que la première', r.json.souvenirs.length === 1);

who = U[2];
r = await call('/api/souvenirs/mine');
check('l\u2019absent n\u2019a rien', r.json.souvenirs.length === 0);

/* ------------------------------------------------------------------ marché */

r = await call('/api/souvenirs/market');
check('l\u2019absent voit les trois vignettes en vente', r.json.souvenirs.length === 3);
check('fenêtre de quinze jours annoncée', r.json.windowDays === 15);

const cible = r.json.souvenirs[0].id;
r = await call('/api/souvenirs/buy', { method: 'POST', body: { souvenirId: cible } });
check('achat accepté', r.json.ok === true && r.json.spent === 60);

const [[w]] = await pool.query('SELECT scarves FROM user_wallet WHERE user_id = ?', [U[2]]);
check('écharpes débitées', w.scarves === 140);

r = await call('/api/souvenirs/buy', { method: 'POST', body: { souvenirId: cible } });
check('deuxième achat refusé', r.json.error === 'souvenir.error.already_owned');

r = await call('/api/souvenirs/mine');
check('la vignette apparaît, marquée comme telle',
  r.json.souvenirs.length === 1 && r.json.souvenirs[0].kind === 'vignette');
check('aucune présence usurpée', r.json.souvenirs[0].fanzzy_id === null);

r = await call('/api/souvenirs/market');
check('ce qu\u2019on possède sort du marché', r.json.souvenirs.length === 2);

who = U[0];
r = await call('/api/souvenirs/market');
check('le présent n\u2019a rien à acheter', r.json.souvenirs.length === 0);

/* ------------------------------------------------------- fonds et péremption */

who = U[2];
await pool.query('UPDATE user_wallet SET scarves = 10 WHERE user_id = ?', [U[2]]);
const reste = (await call('/api/souvenirs/market')).json.souvenirs[0].id;
r = await call('/api/souvenirs/buy', { method: 'POST', body: { souvenirId: reste } });
check('achat refusé sans écharpes', r.json.error === 'souvenir.error.not_enough_scarves');

await pool.query('UPDATE user_wallet SET scarves = 500 WHERE user_id = ?', [U[2]]);
await pool.query('UPDATE souvenirs SET expires_at = NOW(3) - INTERVAL 1 DAY WHERE id = ?', [reste]);
r = await call('/api/souvenirs/buy', { method: 'POST', body: { souvenirId: reste } });
check('vignette périmée : achat refusé', r.json.error === 'souvenir.error.expired');

r = await call('/api/souvenirs/market');
check('une vignette périmée disparaît du marché',
  !r.json.souvenirs.some((s) => s.id === reste));

/* ---------------------------------------------------- présence trop ancienne */

await pool.query('DELETE FROM virage_presence');
await S.recordPush({ userId: U[2], fixtureId: 5002, side: 0, fanzzyId: 'TR34', amount: 10 });
await pool.query(
  `UPDATE virage_presence SET last_push_at = NOW(3) - INTERVAL ? SECOND WHERE user_id = ?`,
  [Math.floor(PRESENCE_WINDOW_MS / 1000) + 30, U[2]]);
r = await S.mintGoal({ ...goal(1, 12, 85, 1, 0, 'Bento'), fixtureId: 5002 });
check('avoir laissé l\u2019app ouverte ne suffit pas', r.presents === 0);
check('et qui n’a pas chanté dans la fenêtre n’est pas nommé',
  r.minted === true && Array.isArray(r.userIds) && r.userIds.length === 0);

/* ------------------------------------------------- les chants, et leur repli

 * Les missions du Virage comptent des chants : « chante 10 fois », « 10 fois
 * dans chaque mi-temps ». Le bilan de tribune compte les PARFAITS, la
 * meilleure série et le meilleur geste. Tout s'écrit **dans l'upsert de
 * présence qui existe**, sans une instruction de plus — une tribune de mille
 * chante plus de dix fois par seconde (P8).
 *
 * Et leur absence ne doit rien casser. Trois formes, de la plus riche à la
 * plus nue : sans `sql/arenes.sql`, les chants se comptent toujours ; sans
 * `sql/quotidien.sql` non plus, la présence s'écrit comme avant (elle porte
 * les cartes-souvenirs et le classement). Le repli dure dix minutes, puis la
 * forme la plus riche se retente, pour qu'un schéma appliqué sur un processus
 * déjà démarré se voie sans le redémarrer.
 *
 * Tout passe par une instance à part : un pool qui compte ses instructions,
 * une horloge du repli qu'on avance à la main, un journal qu'on lit. */
{
  let instructions = 0;
  const compteur = new Proxy(pool, {
    get(cible, cle) {
      const v = cible[cle];
      if (typeof v !== 'function') return v;
      /* `getConnection` compte aussi : une transaction ouverte pour écrire un
         compteur serait une écriture de plus, même si elle passe ailleurs. */
      if (cle === 'execute' || cle === 'query' || cle === 'getConnection') {
        return (...a) => { instructions++; return v.apply(cible, a); };
      }
      return v.bind(cible);
    },
  });
  let decalage = 0;
  const journal = [];
  const warnAvant = console.warn;
  console.warn = (...a) => { journal.push(a.join(' ')); };

  const X = createSouvenirs({ pool: compteur, requireAuth: (_q, _r, next) => next(),
    horloge: () => Date.now() + decalage });
  const lire = async (colonnes, fixture = 5003) => (await pool.query(
    `SELECT ${colonnes} FROM virage_presence WHERE user_id = ? AND fixture_id = ?`,
    [U[0], fixture]))[0][0];
  /** Une poussée de 5 de ferveur ; rend le nombre d'instructions qu'elle a coûté. */
  const pousser = async (o = {}, fixture = 5003) => {
    const avant = instructions;
    await X.recordPush({ userId: U[0], fixtureId: fixture, side: 0, fanzzyId: 'TR32C', amount: 5, ...o });
    return instructions - avant;
  };
  /* Les colonnes des deux fichiers, lues au motif dans les fichiers eux-mêmes
     (une instruction par ligne, `schema-smoke` le garde) : on retire et on
     remet exactement ce qu'on déploie. */
  const colonnesDe = (fichier) => readFileSync(new URL('../sql/' + fichier, import.meta.url), 'utf8')
    .split('\n').map((l) => /^ALTER TABLE virage_presence ADD COLUMN IF NOT EXISTS (\w+)/i.exec(l.trim())?.[1])
    .filter(Boolean);
  const ARENES = colonnesDe('arenes.sql');
  const CHANTS = colonnesDe('quotidien.sql');
  const retirer = (cols) => pool.query(
    `ALTER TABLE virage_presence ${cols.map((c) => `DROP COLUMN ${c}`).join(', ')}`);
  const appliquer = async (fichier) => {
    const raw2 = await mysql.createConnection({ uri: DB, multipleStatements: true });
    await raw2.query(readFileSync(new URL('../sql/' + fichier, import.meta.url), 'utf8'));
    await raw2.end();
  };

  try {
    check('sql/arenes.sql pose les quatre colonnes du bilan sur virage_presence',
      JSON.stringify(ARENES) === JSON.stringify(['parfaits', 'serie_max', 'meilleur_q', 'meilleur_chant'])
      || (console.log('        lues :', ARENES.join(', ')), false));

    let n = await pousser({ chant: 1, mt: 1, parfait: 1, serie: 1, q: 920, chantId: 'montee' });
    let l = await lire('ferveur, chants, chants_mt1, chants_mt2, parfaits, serie_max, meilleur_q, meilleur_chant');
    check('un chant en première mi-temps : chants 1, première 1, seconde 0',
      l?.chants === 1 && l.chants_mt1 === 1 && l.chants_mt2 === 0
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('un PARFAIT, sa série et son geste s’écrivent avec lui',
      l?.parfaits === 1 && l.serie_max === 1 && l.meilleur_q === 920 && l.meilleur_chant === 'montee'
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('et il ne coûte qu’une instruction, colonnes des arènes comprises (P8)', n === 1
      || (console.log(`        ${n} instructions`), false));

    /* **Le meilleur geste**, et l'ordre de l'upsert. 0,97 sur « mur » passe
       devant 0,92 sur « montée » ; 0,93 sur « cadence », ensuite, ne le
       détrône pas. Écrite avant le chant, la note se comparerait à elle-même
       et « montée » resterait le meilleur geste pour toujours (règle 15). */
    n = await pousser({ chant: 1, mt: 2, parfait: 1, serie: 2, q: 970, chantId: 'mur' });
    l = await lire('chants, chants_mt1, chants_mt2, parfaits, serie_max, meilleur_q, meilleur_chant');
    check('un chant en seconde mi-temps compte dans la seconde',
      l.chants === 2 && l.chants_mt1 === 1 && l.chants_mt2 === 1);
    check('une instruction encore, ligne existante comprise', n === 1);
    check('0,97 sur « mur » devient le meilleur geste',
      l.meilleur_chant === 'mur' && l.meilleur_q === 970 && l.parfaits === 2 && l.serie_max === 2
      || (console.log('        ligne :', JSON.stringify(l)), false));
    await pousser({ chant: 1, mt: 0, parfait: 1, serie: 2, q: 930, chantId: 'cadence' });
    l = await lire('chants, chants_mt1, chants_mt2, parfaits, serie_max, meilleur_q, meilleur_chant');
    check('0,93 sur « cadence » ne le détrône pas',
      l.meilleur_chant === 'mur' && l.meilleur_q === 970
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('un chant à la mi-temps compte, mais dans aucune des deux',
      l.chants === 3 && l.chants_mt1 === 1 && l.chants_mt2 === 1);
    /* La série d'une salle rouverte repart de zéro en mémoire : la base garde
       la plus grande, jamais la dernière. */
    await pousser({ chant: 1, mt: 1, parfait: 0, serie: 1, q: 850, chantId: 'reprise' });
    l = await lire('chants, parfaits, serie_max, meilleur_chant');
    check('un BON ne compte pas comme PARFAIT, et la meilleure série reste la plus grande',
      l.chants === 4 && l.parfaits === 3 && l.serie_max === 2 && l.meilleur_chant === 'mur');

    /* Une carte : la salle transporte la mi-temps de toute poussée, et c'est
       ici que l'on refuse de la compter sans chant — ni comme PARFAIT, ni
       comme geste noté, même si on le lui passe. */
    await pousser({ chant: 0, mt: 1, parfait: 1, q: 999, chantId: 'mur' });
    await pousser();
    l = await lire('ferveur, chants, chants_mt1, parfaits, meilleur_q');
    check('une carte n’est pas un chant, même en pleine mi-temps',
      l.chants === 4 && l.chants_mt1 === 2);
    check('ni un PARFAIT, ni un geste noté', l.parfaits === 3 && l.meilleur_q === 970);
    check('et la ferveur s’ajoute comme avant, poussée par poussée (6 × 5)',
      l.ferveur === 30 || (console.log(`        ferveur ${l.ferveur}`), false));

    /* Une ligne ouverte par une carte, puis un chant noté 0 : le match a un
       chant, il a donc un meilleur geste, si mauvais soit-il. */
    await pousser({ chant: 0 }, 5004);
    await pousser({ chant: 1, q: 0, chantId: 'repons' }, 5004);
    l = await lire('meilleur_q, meilleur_chant', 5004);
    check('une ligne ouverte par une carte prend le premier chant pour meilleur geste',
      l?.meilleur_chant === 'repons' && l.meilleur_q === 0
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('aucun mot au journal tant que les colonnes sont là', journal.length === 0);

    /* ------------------- sans sql/arenes.sql : les chants comptent toujours */

    await retirer(ARENES);
    let leve = null;
    try { n = await pousser({ chant: 1, mt: 1, parfait: 1, serie: 3, q: 990, chantId: 'mur' }); }
    catch (e) { leve = e; }
    check('sans les colonnes des arènes, la poussée ne lève pas',
      leve === null || (console.log('        levé :', leve.message), false));
    l = await lire('ferveur, chants, chants_mt1');
    check('et les chants se comptent toujours : la forme du quotidien prend le relais',
      l?.chants === 5 && l.chants_mt1 === 3 && l.ferveur === 35
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('au prix d’une seule instruction en échec, rejouée aussitôt (2)', n === 2
      || (console.log(`        ${n} instructions`), false));
    check('le journal le dit, et nomme sql/arenes.sql',
      journal.length === 1 && journal[0].includes('sql/arenes.sql')
      || (console.log('        journal :', JSON.stringify(journal)), false));
    n = await pousser({ chant: 1, mt: 1 });
    check('pendant le repli, une poussée ne coûte qu’une instruction', n === 1
      || (console.log(`        ${n} instructions`), false));

    /* ------------- ni les arènes ni le quotidien : la présence s'écrit */

    await retirer(CHANTS);
    leve = null;
    try { n = await pousser({ chant: 1, mt: 1 }); } catch (e) { leve = e; }
    check('sans les colonnes des chants non plus, la poussée ne lève pas',
      leve === null || (console.log('        levé :', leve.message), false));
    l = await lire('ferveur');
    check('et la présence s’écrit toujours', l?.ferveur === 45
      || (console.log(`        ferveur ${l?.ferveur}`), false));
    check('une instruction en échec, rejouée sur la forme nue (2)', n === 2
      || (console.log(`        ${n} instructions`), false));
    check('le journal le dit une fois, et nomme sql/quotidien.sql',
      journal.length === 2 && journal[1].includes('sql/quotidien.sql')
      || (console.log('        journal :', JSON.stringify(journal)), false));
    n = await pousser({ chant: 1, mt: 1 });
    check('pendant le repli, une instruction seulement (1)', n === 1);
    check('et le journal ne se répète pas', journal.length === 2);

    /* Dix minutes plus tard, toujours sans rien : un seul nouvel essai de
       chaque forme, et le repli repart pour dix minutes. C'est la borne
       promise : deux instructions en échec toutes les dix minutes, jamais
       plus. */
    decalage = REPLI_CHANTS_MS + 1;
    n = await pousser({ chant: 1, mt: 1 });
    check('passé dix minutes, les deux formes se retentent une fois (3)', n === 3
      || (console.log(`        ${n} instructions`), false));
    n = await pousser({ chant: 1, mt: 1 });
    check('puis se replient de nouveau pour dix minutes (1)', n === 1);
    l = await lire('ferveur');
    check('sans perdre une seule présence en route', l.ferveur === 60
      || (console.log(`        ferveur ${l.ferveur}`), false));
    check('et sans le redire au journal', journal.length === 2);

    /* ------------------- le schéma arrive, le module tourne toujours */

    await appliquer('quotidien.sql');
    await pousser({ chant: 1, mt: 2 });
    l = await lire('ferveur, chants');
    check('le repli tient ses dix minutes, même colonnes revenues',
      l.chants === 0 && l.ferveur === 65);

    decalage += REPLI_CHANTS_MS + 1;
    n = await pousser({ chant: 1, mt: 2 });
    l = await lire('ferveur, chants, chants_mt1, chants_mt2');
    check('dix minutes plus tard, les chants se comptent de nouveau, sans remonter le module',
      l.chants === 1 && l.chants_mt2 === 1 && l.chants_mt1 === 0
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('au prix de la forme des arènes, toujours absente (2)', n === 2
      || (console.log(`        ${n} instructions`), false));
    check('et le journal dit la reprise des chants, une fois',
      journal.length === 3 && journal[2].includes('chants') && journal[2].includes('de nouveau')
      || (console.log('        journal :', JSON.stringify(journal)), false));

    await appliquer('arenes.sql');
    decalage += REPLI_CHANTS_MS + 1;
    n = await pousser({ chant: 1, mt: 2, parfait: 1, serie: 1, q: 940, chantId: 'canon' });
    l = await lire('chants, parfaits, meilleur_q, meilleur_chant');
    check('les colonnes des arènes revenues, tout se recompte',
      l.chants === 2 && l.parfaits === 1 && l.meilleur_chant === 'canon' && l.meilleur_q === 940
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('d’une seule instruction', n === 1);
    check('et le journal dit la reprise des PARFAITS',
      journal.length === 4 && journal[3].includes('PARFAITS') && journal[3].includes('de nouveau')
      || (console.log('        journal :', JSON.stringify(journal)), false));
  } finally {
    console.warn = warnAvant;
  }
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
/* `exitCode` et non `process.exit()` : sous Windows, couper la boucle pendant
   que le pool rend ses sockets fait échouer la suite une fois sur cinq quand
   elle tourne à la file (ETAT.md, § 2). */
await pool.end();
await new Promise((r) => http.close(r));
process.exitCode = failures ? 1 : 0;
