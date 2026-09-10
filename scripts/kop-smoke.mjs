/**
 * Test des KOP.
 *
 * Trois choses s'y jouent, et les trois se cassent en silence.
 *
 * **L'appartenance.** « Un seul KOP par club » est une règle d'argent : un
 * joueur inscrit à deux KOP du même club verserait dans les deux, ou dans
 * aucun, selon l'ordre des requêtes. Elle est tenue par une clé unique en base,
 * et ce fichier vérifie que la base la tient vraiment — pas que le code y
 * pense.
 *
 * **Le dépouillement.** Cinq voix au créateur, et il départage. Les bornes s'y
 * cachent : l'égalité exacte, le créateur qui n'a pas voté, le pot qui a fondu
 * entre le vote et la clôture.
 *
 * **La consommation des bonus.** Un bonus de match doit se dépenser une fois
 * par match, pas une fois par entrée dans le virage. Sans ça, quelqu'un qui
 * rafraîchit trois fois brûle trois matchs de bonus, et personne ne comprend
 * où ils sont passés.
 *
 * Usage : node scripts/kop-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createKop } from '../src/server/kop/index.js';
import { BONUS_PAR_ID, VOIX_CREATEUR, depouiller, nomValide, DUREE_VOTE_MS }
  from '../src/shared/kop.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ======================================================= le dépouillement

   Sans base : c'est de l'arithmétique de vote, et c'est là que sont les
   bornes.                                                                   */

const A = 'aaaa'; const B = 'bbbb'; const C = 'cccc'; const D = 'dddd';

check('le créateur pèse cinq voix',
  depouiller([{ userId: A, pour: true }], A).pour === VOIX_CREATEUR);
check('un membre en pèse une',
  depouiller([{ userId: B, pour: true }], A).pour === 1);
check('cinq contre quatre : le créateur l’emporte seul',
  depouiller([{ userId: A, pour: true }, { userId: B, pour: false },
    { userId: C, pour: false }, { userId: D, pour: false }], A).adopte === true);
check('mais pas contre six',
  depouiller([{ userId: A, pour: true },
    ...['b', 'c', 'd', 'e', 'f', 'g'].map((u) => ({ userId: u, pour: false }))], A)
    .adopte === false);
check('à égalité, le bulletin du créateur tranche',
  depouiller([{ userId: A, pour: true },
    ...['b', 'c', 'd', 'e', 'f'].map((u) => ({ userId: u, pour: false }))], A)
    .adopte === true);
check('et s’il a voté contre, l’égalité rejette',
  depouiller([{ userId: A, pour: false },
    ...['b', 'c', 'd', 'e', 'f'].map((u) => ({ userId: u, pour: true }))], A)
    .adopte === false);
check('sans le créateur, une égalité vaut rejet',
  depouiller([{ userId: B, pour: true }, { userId: C, pour: false }], A).adopte === false);
check('personne n’a voté : rien n’est adopté',
  depouiller([], A).adopte === false);

check('un nom vide est refusé', nomValide('  ') === null);
check('un nom trop long aussi', nomValide('x'.repeat(41)) === null);
check('le balisage est refusé', nomValide('<b>KOP</b>') === null);
check('un nom normal est nettoyé', nomValide('  Le   Virage  Nord ') === 'Le Virage Nord');

/* ============================================================== en base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops,
  user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
  souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
  duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
  leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'souvenirs.sql', 'fanzzy.sql',
                 'inventaire.sql', 'skins.sql', 'kop.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const U = ['1', '2', '3', '4'].map((i) => `kkkkkkkk-0000-0000-0000-00000000000${i}`);
for (const [i, id] of U.entries()) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, `k${i}@ex.fr`, `Kopiste${i}`]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves) VALUES (?,0)`, [id]);
}
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'Sion'),(91,'Bâle')`);
// Tout le monde suit Sion ; seul le premier suit aussi Bâle.
for (const id of U) {
  await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,85,1)`, [id]);
}
await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,91,0)`, [U[0]]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
const K = createKop({ pool, requireAuth: (r, _s, n) => n() });

/* ----------------------------------------------------- créer, rejoindre */

const kop = await K.creer(U[0], 85, 'Le Virage Nord');
check('un KOP se crée', Boolean(kop.id) && kop.nom === 'Le Virage Nord');

try {
  await K.creer(U[0], 91, 'Bâle aussi');
  check('un second KOP pour un autre club est permis', true);
} catch { check('un second KOP pour un autre club est permis', false); }

/* La règle qui protège l'argent : un seul KOP par club. Elle est tenue par la
   clé unique de la base, et c'est bien elle qu'on éprouve ici — pas la
   vérification du code, qui pourrait céder sur deux requêtes simultanées. */
try {
  await K.creer(U[0], 85, 'Un deuxième pour Sion');
  check('un second KOP pour le même club est refusé', false);
} catch (e) {
  check('un second KOP pour le même club est refusé', e.code === 'kop.error.deja_membre');
}

try {
  await K.creer(U[1], 60, 'Un club que je ne suis pas');
  check('on ne crée pas le KOP d’un club qu’on ne suit pas', false);
} catch (e) {
  check('on ne crée pas le KOP d’un club qu’on ne suit pas',
    e.code === 'kop.error.pas_ton_club');
}

for (const u of [U[1], U[2], U[3]]) await K.rejoindre(u, kop.id);
let etat = await K.etat(kop.id, U[0]);
check('les quatre sont membres', etat.membres.length === 4);
check('le créateur est marqué',
  etat.membres.find((m) => m.id === U[0])?.createur === true && etat.jeSuisCreateur);

/* -------------------------------------------------------------- le pot */

let r = await K.verser(U[1], 85, 60);
check('un versement remplit le pot', r.verse === 60 && r.kopId === kop.id);
await K.verser(U[2], 85, 40);
etat = await K.etat(kop.id, U[0]);
check('le pot cumule', etat.pot === 100 && etat.verseTotal === 100);
check('et chacun sait ce qu’il a versé',
  etat.membres.find((m) => m.id === U[1])?.verse === 60);

// Sans KOP pour ce club, les écharpes sont perdues — et ça se dit.
r = await K.verser(U[1], 91, 50);
check('sans KOP, la part est perdue et signalée', r.verse === 0 && r.sansKop === true);

/* ------------------------------------------------- ce qui est versé est versé

   Quitter ne rend rien. Sans cette règle, on entrerait la veille du match, on
   voterait, et on repartirait avec sa part.                                  */

await K.quitter(U[3], kop.id);
etat = await K.etat(kop.id, U[0]);
check('quitter retire du KOP', etat.membres.length === 3);
check('mais ne vide pas le pot', etat.pot === 100);
await K.rejoindre(U[3], kop.id);

/* ------------------------------------------------------------- le vote */

const CORDE = BONUS_PAR_ID.get('corde');
try {
  await K.proposer(U[1], kop.id, 'corde');
  check('un vote demande un pot suffisant', false);
} catch (e) {
  check('un vote demande un pot suffisant', e.code === 'kop.error.pot_insuffisant');
}

await pool.query('UPDATE kops SET pot = ? WHERE id = ?', [CORDE.prix + 100, kop.id]);
const vote = await K.proposer(U[1], kop.id, 'corde');
check('un vote s’ouvre', Boolean(vote.id) && vote.prix === CORDE.prix);
check('et il est court', vote.fermeDansMs === DUREE_VOTE_MS);

etat = await K.etat(kop.id, U[1]);
check('celui qui propose a voté pour d’office', etat.vote?.monBulletin === 1);
check('le décompte est visible en direct', etat.vote?.pour === 1 && etat.vote?.contre === 0);

try {
  await K.proposer(U[2], kop.id, 'souffle');
  check('un seul vote à la fois', false);
} catch (e) { check('un seul vote à la fois', e.code === 'kop.error.vote_en_cours'); }

await K.voter(U[2], vote.id, false);
await K.voter(U[3], vote.id, false);
etat = await K.etat(kop.id, U[0]);
check('les membres pèsent une voix chacun', etat.vote.pour === 1 && etat.vote.contre === 2);

// Le créateur arrive : cinq voix contre deux.
await K.voter(U[0], vote.id, true);
etat = await K.etat(kop.id, U[0]);
check('le créateur renverse le vote à lui seul',
  etat.vote.pour === VOIX_CREATEUR + 1 && etat.vote.adopte === true);

// On change d'avis tant que c'est ouvert : trois minutes, c'est la durée d'une
// discussion.
await K.voter(U[0], vote.id, false);
etat = await K.etat(kop.id, U[0]);
check('on peut changer d’avis', etat.vote.adopte === false);
await K.voter(U[0], vote.id, true);

/* ---------------------------------------------------- la clôture

   Le dépouillement se fait à la lecture. On force donc l'échéance dans le
   passé plutôt que d'attendre trois minutes : c'est la même porte.          */

await pool.query('UPDATE kop_votes SET ferme = NOW(3) - INTERVAL 1 SECOND WHERE id = ?',
  [vote.id]);
const faits = await K.depouillerEchus(kop.id);
check('le vote se dépouille au premier regard qui suit l’échéance',
  faits.length === 1 && faits[0].issue === 'adopte');

etat = await K.etat(kop.id, U[0]);
check('le pot est débité du prix', etat.pot === 100);
check('le bonus est actif', etat.bonus.length === 1 && etat.bonus[0].bonusId === 'corde');
check('et le vote n’est plus en cours', etat.vote === null);

try {
  await K.voter(U[2], vote.id, true);
  check('on ne vote plus après la clôture', false);
} catch (e) { check('on ne vote plus après la clôture', e.code === 'kop.error.vote_clos'); }

/* ------------------------------------------------- le bonus dans le virage */

let mods = await K.modsDe(U[1], 85);
check('le bonus arrive en modificateurs du moteur',
  mods.pushMult === CORDE.mods.pushMult && mods.kopNom === 'Le Virage Nord');
check('et il nomme le KOP qui l’offre', mods.kopId === kop.id);

check('un joueur sans KOP pour ce club n’a aucun bonus',
  Object.keys(await K.modsDe(U[2], 91)).length === 0);

/* La borne qui coûte cher : un bonus de match se consomme **une fois par
   match**. Trois entrées dans le virage du même match n'en brûlent qu'un. */
await K.modsDe(U[1], 85, 7001);
await K.modsDe(U[1], 85, 7001);
await K.modsDe(U[2], 85, 7001);
etat = await K.etat(kop.id, U[0]);
check('trois entrées dans le même match ne brûlent qu’un bonus',
  etat.bonus.length === 0);
check('et il est bien épuisé, pas supprimé',
  (await pool.query('SELECT COUNT(*) n FROM kop_bonus WHERE kop_id = ?',
    [kop.id]))[0][0].n === 1);

mods = await K.modsDe(U[1], 85);
check('épuisé, il n’apporte plus rien', mods.pushMult === undefined);

/* ------------------------------------ un pot qui fond avant la clôture

   Deux votes ne peuvent pas coexister, mais un achat peut vider le pot entre
   l'ouverture d'un vote et son dépouillement — un versement annulé, une
   correction d'administration. On rejette alors plutôt que de creuser un pot
   négatif, et on le dit autrement qu'un rejet ordinaire.                    */

await pool.query('UPDATE kops SET pot = ? WHERE id = ?', [CORDE.prix, kop.id]);
const v2 = await K.proposer(U[0], kop.id, 'corde');
await pool.query('UPDATE kops SET pot = 0 WHERE id = ?', [kop.id]);
await pool.query('UPDATE kop_votes SET ferme = NOW(3) - INTERVAL 1 SECOND WHERE id = ?',
  [v2.id]);
const faits2 = await K.depouillerEchus(kop.id);
check('un vote adopté sur un pot vide est rejeté',
  faits2[0].issue === 'rejete' && faits2[0].potInsuffisant === true);
check('et le pot ne devient jamais négatif',
  (await K.etat(kop.id, U[0])).pot === 0);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end();
process.exitCode = failures ? 1 : 0;
