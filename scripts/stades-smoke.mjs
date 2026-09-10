/**
 * Test du repliage des âges sur le personnage.
 *
 * `sql/stades.sql` touche des collections **réelles** : c'est la seule
 * migration du projet qui déplace ce que des joueurs possèdent déjà. Une faute
 * ici ne se voit pas dans un log, elle se voit dans un classeur qui a perdu une
 * carte — et à ce moment-là il est trop tard, la ligne d'origine est supprimée.
 *
 * On la fait donc tourner sur une collection fabriquée qui contient les trois
 * cas qui font mal :
 *
 *   1. un joueur qui possède **le personnage et son âge supérieur** en même
 *      temps — les doublons doivent se cumuler, pas s'écraser ;
 *   2. un joueur qui ne possède **que** l'âge supérieur, parce qu'il a fait
 *      évoluer sa seule copie : la ligne du personnage n'existe pas encore et
 *      doit être créée, sans quoi il perd la carte ;
 *   3. un joueur dont le **Fanzzy équipé** est un âge supérieur : l'avatar
 *      pointerait sur un identifiant que la collection ne connaît plus.
 *
 * Et surtout : elle est **rejouée deux fois**. Une migration qu'on ne peut
 * lancer qu'une fois est une migration qu'on n'ose pas relancer, donc qu'on
 * applique à moitié le jour où elle échoue au milieu.
 *
 * Usage : node scripts/stades-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { charger as chargerCatalogue, racineDe, lignee, auStade, personnages, obtenables, parIdentifiant, tous }
  from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });

await raw.query(`DROP TABLE IF EXISTS kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues,
  duel_results, duel_events, duels, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'tenues.sql', 'deck.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

// Le catalogue vit en base : on l'amorce comme le fait le serveur, sinon la
// migration n'a aucune lignée à replier.
const pool = mysql.createPool({ uri: DB, connectionLimit: 4, charset: 'utf8mb4' });
await chargerCatalogue(pool);
await chargerTenues(pool);

/* ------------------------------------------ ce que le catalogue sait dire */

check('un âge supérieur remonte à son personnage', racineDe('V3') === 'V1');
check('un personnage est sa propre racine', racineDe('V1') === 'V1');
check('un identifiant inconnu se rend tel quel', racineDe('ZZ404') === 'ZZ404');

const ch = lignee('V2');
check('la lignée se lit depuis n’importe lequel de ses âges',
  ch.length === 3 && ch.map((f) => f.id).join(',') === 'V1,V2,V3');
check('le deuxième âge porte son propre nom',
  auStade('V1', 2)?.nom === 'Meneur de chant');
// Une légendaire n'a pas de lignée : c'est sa définition. Elle sert donc de
// témoin pour le cas « personnage à un seul âge », que TR1 incarnait avant
// d'avoir la sienne.
check('une légendaire n’a qu’un âge', lignee('TR12').length === 1);
check('et pas de deuxième', auStade('TR12', 2) === undefined);

/* Le catalogue compte exactement deux lignes de plus que de personnages par
   lignée. Le chiffre se déduit du dex plutôt que de s'écrire en dur : il valait
   14 quand il y avait sept lignées, il en vaut 276, et il changera encore. Un
   test qui fige un total casse à chaque carte ajoutée sans avoir rien attrapé. */
const lignes = (await pool.query('SELECT COUNT(*) n FROM fanzzy'))[0][0].n;
const attenduSuites = tous().filter((f) => f.stage > 1).length;
check(`${lignes} lignes au catalogue pour ${personnages().length} personnages`,
  lignes - personnages().length === attenduSuites);

/* Le vrai piège de ce lot, et il n'aurait rien dit : l'amorçage n'écrase
   jamais une ligne existante. Donner une lignée à des personnages **déjà en
   base** insère bien leurs nouveaux âges, mais laisse leur `evo` à NULL — les
   cartes existent et personne ne les désigne. */
const debranches = tous().filter((f) => f.stage === 1 && f.rar !== 'legendaire'
  && f.publie && lignee(f.id).length === 1);
check('aucun personnage n’a ses âges débranchés',
  debranches.length === 0 || (console.log('       ', debranches.slice(0, 8)
    .map((f) => f.id).join(' ')), false));
check('aucun âge supérieur ne compte dans la collection à faire',
  obtenables().every((f) => racineDe(f.id) === f.id));

/* ------------------------------------------------- une collection à replier */

const A = 'ffffffff-0000-0000-0000-00000000000a';   // possède V1 ×2 et V2 ×1
const B = 'ffffffff-0000-0000-0000-00000000000b';   // n'a plus que V3
const C = 'ffffffff-0000-0000-0000-00000000000c';   // rien d'évolué

for (const [u, mail, nom] of [[A, 'a@ex.fr', 'Ana'], [B, 'b@ex.fr', 'Bo'], [C, 'c@ex.fr', 'Cy']]) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [u, mail, nom]);
}
await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs,active_fanzzy) VALUES
  (?,10,0,'V2'), (?,10,0,'V3'), (?,10,0,'TR1')`, [A, B, C]);
await raw.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES
  (?,'V1',2), (?,'V2',1), (?,'F1',1),
  (?,'V3',1),
  (?,'TR1',3), (?,'V1',1)`, [A, A, A, B, C, C]);

const migrer = async () =>
  raw.query(readFileSync(path.join(RACINE, 'sql', 'stades.sql'), 'utf8'));

await migrer();

const collec = async (u) => Object.fromEntries(
  (await pool.query('SELECT fanzzy_id, copies, stage FROM user_fanzzy WHERE user_id = ?', [u]))[0]
    .map((r) => [r.fanzzy_id, { copies: r.copies, stage: r.stage }]));

let a = await collec(A);
check('le personnage et son âge supérieur fusionnent', a.V1 !== undefined && a.V2 === undefined);
check('au plus haut stade atteint', a.V1?.stage === 2);
check('et les doublons se cumulent au lieu de disparaître', a.V1?.copies === 3);
check('les autres cartes ne bougent pas', a.F1?.copies === 1 && a.F1?.stage === 1);

let b = await collec(B);
check('qui n’avait plus que le dernier âge garde son personnage',
  b.V1 !== undefined && b.V3 === undefined);
check('au stade 3', b.V1?.stage === 3);

let c = await collec(C);
check('une collection sans évolution est intacte',
  c.TR1?.copies === 3 && c.TR1?.stage === 1 && c.V1?.stage === 1);

const equipe = async (u) =>
  (await pool.query('SELECT active_fanzzy f FROM user_wallet WHERE user_id = ?', [u]))[0][0].f;

check('le Fanzzy équipé suit son personnage', await equipe(A) === 'V1');
check('même depuis le dernier âge', await equipe(B) === 'V1');
check('et celui qui n’avait rien d’évolué garde le sien', await equipe(C) === 'TR1');

/* --------------------------------------------------------- rejouable

   Le vrai test de cette migration. Appliquée deux fois, elle doit laisser la
   base exactement dans le même état — sinon les doublons doubleraient à chaque
   passage, et personne ne s'en apercevrait avant qu'un joueur se retrouve avec
   quatre-vingt-seize exemplaires d'un Choriste.                              */

const avant = JSON.stringify([await collec(A), await collec(B), await collec(C)]);
await migrer();
const apres = JSON.stringify([await collec(A), await collec(B), await collec(C)]);
check('la rejouer ne change plus rien', avant === apres);
if (avant !== apres) { console.log('    avant :', avant); console.log('    après :', apres); }

/* ------------------------------------------------------ le catalogue reste

   La migration déplace des collections, jamais le catalogue. Les trois âges
   doivent rester lisibles : ce sont eux qui portent les noms, les histoires et
   les modificateurs de chaque stade.                                          */

check('les trois âges existent toujours au catalogue',
  ['V1', 'V2', 'V3'].every((id) => parIdentifiant(id) !== undefined));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await raw.end();
await pool.end();
process.exitCode = failures ? 1 : 0;
