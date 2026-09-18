/**
 * Test de sql/prefixes.sql, la reprise qui donne à chaque carte le préfixe de
 * sa série.
 *
 * ## Pourquoi il existe
 *
 * Cette migration a échoué au déploiement, et elle a échoué **sur le serveur
 * seulement** : la machine de développement l'acceptait. MySQL et MariaDB
 * refusent, selon la version, qu'un `DELETE` lise la table qu'il vide — « Table
 * 'f' is specified twice, both as a target for 'DELETE' and as a separate
 * source for data ». Une base neuve ne l'aurait pas montré davantage : sans
 * doublon, ces suppressions ne touchent rien et passent partout.
 *
 * Ce banc reproduit donc les deux conditions ensemble : **la migration
 * complète**, sur une base qui porte déjà les doublons qu'elle doit résorber.
 * C'est le seul état où elle fait vraiment quelque chose.
 *
 * ## Ce qui est éprouvé
 *
 *   — elle s'applique sans erreur ;
 *   — **aucun joueur ne perd rien** : les exemplaires s'additionnent, le stade
 *     le plus haut l'emporte, les tenues survivent. Perdre un doublon serait
 *     discret et définitif, et c'est le genre de perte qu'un joueur ne signale
 *     jamais parce qu'il ne la voit pas ;
 *   — elle se rejoue sans dommage, parce qu'un déploiement se relance.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
const SQL = fileURLToPath(new URL('../sql/', import.meta.url));
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* L'ordre de `scripts/appliquer-schema.mjs`, moins les deux reprises : on les
   applique après avoir semé les doublons, sinon il n'y aurait rien à reprendre. */
const SOCLE = ['auth', 'football', 'minutes', 'couleurs', 'duel', 'souvenirs', 'fanzzy',
  'teletext', 'inventaire', 'skins', 'tenues', 'deck', 'admin', 'kop', 'amis',
  'niveau', 'raretes', 'stades', 'boutique', 'billets', 'saisons', 'series-neuves'];

const mysql = await import('mysql2/promise');
const cnx = await mysql.createConnection({ uri: DB, multipleStatements: true });
const q = async (sql, params = []) => (await cnx.query(sql, params))[0];
const fichier = (n) => readFileSync(path.join(SQL, `${n}.sql`), 'utf8');

/* Table rase : les autres suites laissent la base dans l'état qui les arrange,
   et une migration mesurée sur un résidu ne mesure rien. */

/* La liste se lit **en base**, elle ne s'écrit pas à la main : c'est la seule
   qui n'a pas à être tenue à jour quand une table apparaît. Y ajouter un nom
   en dur le fait compter deux fois — `ER_NONUNIQ_TABLE`, et la suite entière
   tombe avant son premier contrôle. C'est arrivé le jour où `abonnements` a
   été ajoutée aux trente autres suites, qui, elles, ont bien une liste fixe. */
const tables = await q(
  `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()`);
if (tables.length) {
  await cnx.query('SET FOREIGN_KEY_CHECKS = 0');
  await cnx.query(`DROP TABLE IF EXISTS ${tables.map((r) => `\`${r.t}\``).join(', ')}`);
  await cnx.query('SET FOREIGN_KEY_CHECKS = 1');
}
for (const n of SOCLE) await cnx.query(fichier(n));

/* ------------------------------------------------- la base d'avant la reprise

   `X15` → `BG28` est la première correspondance du plan. On se met dans le cas
   le plus défavorable : un serveur qui a démarré avec le code neuf **avant** la
   migration, donc un catalogue qui porte les deux identifiants, et un joueur
   qui possède les deux — ce qui n'arrive que là, et c'est précisément le cas
   où un renommage direct se heurterait à la clé primaire. */

const MOI = '11111111-1111-1111-1111-111111111111';
await q(`INSERT INTO users (public_id,email,pseudo,password_hash)
         VALUES (?,'p@ex.fr','Prefixe','x')`, [MOI]);

const carte = (id, nom) => q(
  `INSERT INTO fanzzy (id,nom,type,set_id,stage,rar,mods,cri)
   VALUES (?,?,'perso','TR',1,'commune','{}','[]')`, [id, nom]);
await carte('X15', 'Le Loup du Virage');       // l'ancienne, celle que l'on possède
await carte('BG28', 'Le Loup du Virage');      // la neuve, écrite par l'amorçage

// Les deux possédées : trois exemplaires d'un côté, cinq de l'autre, et le
// stade le plus haut sur la ligne qui va disparaître.
await q(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies,stage) VALUES (?,?,?,?),(?,?,?,?)`,
  [MOI, 'X15', 3, 1, MOI, 'BG28', 5, 3]);

// Une tenue commune aux deux — le doublon à résorber — et une qui n'existe que
// sous l'ancien identifiant : elle doit survivre au renommage.
await q(`INSERT INTO user_skins (user_id,fanzzy_id,stage,skin_id) VALUES
         (?,?,1,'hiver'),(?,?,1,'hiver'),(?,?,1,'pluie')`,
  [MOI, 'X15', MOI, 'BG28', MOI, 'X15']);

await q(`INSERT INTO user_wallet (user_id,active_fanzzy) VALUES (?,'X15')`, [MOI]);
await q(`INSERT INTO user_decks (user_id,contenu) VALUES (?,?)`,
  [MOI, JSON.stringify({ fanzzy: [{ id: 'X15' }, { id: 'X13B' }] })]);

/* --------------------------------------------------------- la migration */

let erreur = null;
try { await cnx.query(fichier('prefixes')); } catch (e) { erreur = e.message; }
check('la reprise s’applique', erreur === null
  || (console.log('        elle dit :', erreur), false));

/* ------------------------------------------------------------ le compte */

const cat = await q(`SELECT id FROM fanzzy WHERE id IN ('X15','BG28')`);
check('le catalogue ne garde qu’un identifiant',
  cat.length === 1 && cat[0].id === 'BG28');

const [poss] = await q(
  `SELECT fanzzy_id, copies, stage FROM user_fanzzy WHERE user_id = ?`, [MOI]);
check('le joueur n’a plus qu’une ligne', (await q(
  `SELECT 1 FROM user_fanzzy WHERE user_id = ?`, [MOI])).length === 1);
check('sous le nouvel identifiant', poss?.fanzzy_id === 'BG28');
check('les exemplaires se sont additionnés', poss?.copies === 8
  || (console.log('        il en reste :', poss?.copies), false));
check('et le stade le plus haut l’emporte', poss?.stage === 3);

const tenues = await q(
  `SELECT fanzzy_id, skin_id FROM user_skins WHERE user_id = ? ORDER BY skin_id`, [MOI]);
check('les tenues ne sont plus en double', tenues.length === 2);
check('celle que l’ancien identifiant portait seul a survécu',
  tenues.some((t) => t.skin_id === 'pluie' && t.fanzzy_id === 'BG28'));
check('et l’autre a suivi le renommage',
  tenues.every((t) => t.fanzzy_id === 'BG28'));

const [w] = await q(`SELECT active_fanzzy FROM user_wallet WHERE user_id = ?`, [MOI]);
check('le Fanzzy équipé suit', w?.active_fanzzy === 'BG28');

const [d] = await q(`SELECT contenu FROM user_decks WHERE user_id = ?`, [MOI]);
const deck = typeof d.contenu === 'string' ? JSON.parse(d.contenu) : d.contenu;
check('le deck suit, dans son JSON', deck.fanzzy[0].id === 'BG28');
/* `X13B` → `VP15B` : la carte au suffixe éprouve le remplacement **avec les
   guillemets**. Sans eux, « X13B » aurait été touché par la règle de « X13 » et
   serait devenu « VP15B » par le mauvais chemin, ou pire. */
check('et la carte au suffixe n’a pas été coupée en deux',
  deck.fanzzy[1].id === 'VP15B'
  || (console.log('        elle dit :', deck.fanzzy[1].id), false));

/* ------------------------------------------------ elle se rejoue sans dommage

   Un déploiement se relance — parce qu'il a échoué plus loin, parce qu'on
   redéploie. Une reprise qui ne supporte pas d'être rejouée est une reprise
   qu'on n'ose plus lancer. */

erreur = null;
try { await cnx.query(fichier('prefixes')); } catch (e) { erreur = e.message; }
check('la rejouer ne lève pas', erreur === null
  || (console.log('        elle dit :', erreur), false));

const [poss2] = await q(
  `SELECT fanzzy_id, copies, stage FROM user_fanzzy WHERE user_id = ?`, [MOI]);
check('et ne change plus rien',
  poss2?.fanzzy_id === 'BG28' && poss2?.copies === 8 && poss2?.stage === 3);


/* ------------------------------------------------------------- le ménage

   **Ce banc rend la base comme il l'a trouvée**, et il est le seul à devoir le
   faire explicitement. Les autres suites commencent par supprimer les tables
   dont elles se servent ; `fanzzy-smoke`, lui, ne supprime **pas** `fanzzy` —
   le catalogue est amorcé depuis le code au démarrage, en `INSERT IGNORE`, et
   une ligne déjà posée ne se corrige donc jamais.

   Or la migration éprouvée ici finit par écrire `BG28`, qui est une vraie carte
   du catalogue, et **dépubliée**. Laissée derrière, elle se serait servie au
   classeur de la suite suivante comme une carte ordinaire : deux contrôles
   rouges dans un banc qui n'a rien fait de mal. Une suite qui fait échouer sa
   voisine est une suite à laquelle on cesse de croire. */

await q(`DELETE FROM user_decks  WHERE user_id = ?`, [MOI]);
await q(`DELETE FROM user_skins  WHERE user_id = ?`, [MOI]);
await q(`DELETE FROM user_fanzzy WHERE user_id = ?`, [MOI]);
await q(`DELETE FROM user_wallet WHERE user_id = ?`, [MOI]);
await q(`DELETE FROM users       WHERE public_id = ?`, [MOI]);
await q(`DELETE FROM fanzzy      WHERE id IN ('X15', 'BG28')`);

await cnx.end();
console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
process.exitCode = failures ? 1 : 0;
