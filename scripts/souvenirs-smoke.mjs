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
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
/* `quotidien.sql` pose les colonnes des chants sur `virage_presence`. Il
   complète aussi `saisons`, d'où `saisons.sql` avant lui, qui lit lui-même
   `reglages` (admin.sql) : le fichier s'applique en entier, tel que le
   déploiement l'applique, et non par morceaux choisis. */
const SCHEMA = ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
  'admin.sql', 'saisons.sql', 'quotidien.sql'];
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

r = await S.mintGoal(goal(1, 23, 85, 1, 0, 'Diallo'));
check('rejouer le même but ne refrappe rien', r.minted === false && r.reason === 'already_minted');

r = await S.mintGoal({ ...goal(2, 30, 85, 2, 0, 'Morel'), leagueId: 999 });
check('compétition désactivée : aucune carte', r.reason === 'league_not_eligible');

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

/* ------------------------------------------------- les chants, et leur repli

 * Les missions du Virage comptent des chants : « chante 10 fois », « 10 fois
 * dans chaque mi-temps ». Ils s'écrivent **dans l'upsert de présence qui
 * existe**, sans une instruction de plus — une tribune de mille chante plus
 * de dix fois par seconde.
 *
 * Et leur absence ne doit rien casser : sans `sql/quotidien.sql`, la présence
 * s'écrit comme avant (elle porte les cartes-souvenirs et le classement). Le
 * repli dure dix minutes, puis le comptage se retente, pour qu'un schéma
 * appliqué sur un processus déjà démarré se voie sans le redémarrer.
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
  const lire = async (colonnes) => (await pool.query(
    `SELECT ${colonnes} FROM virage_presence WHERE user_id = ? AND fixture_id = 5003`, [U[0]]))[0][0];
  /** Une poussée de 5 de ferveur ; rend le nombre d'instructions qu'elle a coûté. */
  const pousser = async (o = {}) => {
    const avant = instructions;
    await X.recordPush({ userId: U[0], fixtureId: 5003, side: 0, fanzzyId: 'TR32C', amount: 5, ...o });
    return instructions - avant;
  };

  try {
    let n = await pousser({ chant: 1, mt: 1 });
    let l = await lire('ferveur, chants, chants_mt1, chants_mt2');
    check('un chant en première mi-temps : chants 1, première 1, seconde 0',
      l?.chants === 1 && l.chants_mt1 === 1 && l.chants_mt2 === 0
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('et il ne coûte qu’une instruction', n === 1
      || (console.log(`        ${n} instructions`), false));

    n = await pousser({ chant: 1, mt: 2 });
    l = await lire('ferveur, chants, chants_mt1, chants_mt2');
    check('un chant en seconde mi-temps compte dans la seconde',
      l.chants === 2 && l.chants_mt1 === 1 && l.chants_mt2 === 1);
    check('une instruction encore, ligne existante comprise', n === 1);

    await pousser({ chant: 1, mt: 0 });
    l = await lire('ferveur, chants, chants_mt1, chants_mt2');
    check('un chant à la mi-temps compte, mais dans aucune des deux',
      l.chants === 3 && l.chants_mt1 === 1 && l.chants_mt2 === 1);

    /* Une carte : la salle transporte la mi-temps de toute poussée, et c'est
       ici que l'on refuse de la compter sans chant. */
    await pousser({ chant: 0, mt: 1 });
    await pousser();
    l = await lire('ferveur, chants, chants_mt1, chants_mt2');
    check('une carte n’est pas un chant, même en pleine mi-temps',
      l.chants === 3 && l.chants_mt1 === 1);
    check('et la ferveur s’ajoute comme avant, poussée par poussée (5 × 5)',
      l.ferveur === 25 || (console.log(`        ferveur ${l.ferveur}`), false));
    check('aucun mot au journal tant que les colonnes sont là', journal.length === 0);

    /* ---------------------------- le schéma n'a pas été appliqué */

    await pool.query(`ALTER TABLE virage_presence DROP COLUMN chants,
      DROP COLUMN chants_mt1, DROP COLUMN chants_mt2`);
    let leve = null;
    try { n = await pousser({ chant: 1, mt: 1 }); } catch (e) { leve = e; }
    check('sans les colonnes des chants, la poussée ne lève pas',
      leve === null || (console.log('        levé :', leve.message), false));
    l = await lire('ferveur');
    check('et la présence s’écrit toujours', l?.ferveur === 30
      || (console.log(`        ferveur ${l?.ferveur}`), false));
    check('au prix d’une seule instruction en échec, rejouée aussitôt (2)', n === 2
      || (console.log(`        ${n} instructions`), false));
    check('le journal le dit, et nomme le fichier à appliquer',
      journal.length === 1 && journal[0].includes('sql/quotidien.sql')
      || (console.log('        journal :', JSON.stringify(journal)), false));

    n = await pousser({ chant: 1, mt: 1 });
    check('pendant le repli, une poussée ne coûte qu’une instruction', n === 1
      || (console.log(`        ${n} instructions`), false));
    check('et le journal ne se répète pas', journal.length === 1);

    /* Dix minutes plus tard, toujours sans les colonnes : un seul nouvel essai,
       et le repli repart pour dix minutes. C'est la borne promise : une
       instruction en échec toutes les dix minutes, jamais deux par poussée. */
    decalage = REPLI_CHANTS_MS + 1;
    n = await pousser({ chant: 1, mt: 1 });
    check('passé dix minutes, le comptage se retente une fois (2)', n === 2);
    n = await pousser({ chant: 1, mt: 1 });
    check('puis se replie de nouveau pour dix minutes (1)', n === 1);
    l = await lire('ferveur');
    check('sans perdre une seule présence en route', l.ferveur === 45
      || (console.log(`        ferveur ${l.ferveur}`), false));
    check('et sans le redire au journal', journal.length === 1);

    /* ------------------- le schéma arrive, le module tourne toujours */

    const raw2 = await mysql.createConnection({ uri: DB, multipleStatements: true });
    await raw2.query(readFileSync(new URL('../sql/quotidien.sql', import.meta.url), 'utf8'));
    await raw2.end();

    await pousser({ chant: 1, mt: 2 });
    l = await lire('ferveur, chants, chants_mt1, chants_mt2');
    check('le repli tient ses dix minutes, même colonnes revenues',
      l.chants === 0 && l.ferveur === 50);

    decalage += REPLI_CHANTS_MS + 1;
    n = await pousser({ chant: 1, mt: 2 });
    l = await lire('ferveur, chants, chants_mt1, chants_mt2');
    check('dix minutes plus tard, les chants se comptent de nouveau, sans remonter le module',
      l.chants === 1 && l.chants_mt2 === 1 && l.chants_mt1 === 0
      || (console.log('        ligne :', JSON.stringify(l)), false));
    check('d’une seule instruction', n === 1);
    check('et le journal dit la reprise, une fois',
      journal.length === 2 && journal[1].includes('de nouveau')
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
