/**
 * Le registre des réglages.
 *
 * ## Ce qu'on éprouve, et pourquoi c'est ce qui compte
 *
 * L'écran de réglages existait déjà, et il ne servait à rien : on pouvait y
 * écrire n'importe quelle clé, la relire, la voir listée — et **une seule**
 * clé sur toutes celles qu'on pouvait taper était réellement lue par le jeu.
 * L'écran proposait même en exemple une clé `annonce` censée afficher un
 * bandeau à tous les joueurs ; rien, nulle part, ne la lisait.
 *
 * Un réglage qui ne règle rien ne casse rien : il se contente de ne pas être
 * là, et personne ne s'en aperçoit avant d'en avoir besoin. C'est exactement
 * le genre de défaut qu'aucune suite ne trouve si elle se contente de vérifier
 * que l'écriture a bien écrit.
 *
 * La suite éprouve donc, dans cet ordre :
 *   1. **qu'écrire change le jeu** — la valeur que le moteur lit, pas celle
 *      que la base contient ;
 *   2. **qu'une valeur refusée dit pourquoi** — nommer la borne, pas « refusé » ;
 *   3. **que la remise au défaut efface la ligne** plutôt que d'y écrire le
 *      défaut, sans quoi un changement de registre serait figé pour toujours ;
 *   4. **que la route publique ne publie pas l'équilibrage**.
 */
import express from 'express';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {
  DEFAUTS, PAR_CLE, REGLAGES, SECTIONS, ReglageInvalide, valider, resoudre,
} from '../src/shared/reglages.js';
import {
  chargerReglages, ecrireReglage, oublierReglages, reglagesPublics, rendreAuDefaut,
  tousLesReglages,
} from '../src/server/reglages/index.js';
import { RULES as VIRAGE } from '../src/server/ferveur/virage.js';
import { RULES as DUEL } from '../src/server/nvn/engine.js';
import { DECK_RULES } from '../src/shared/duel/actions.js';
import { XP } from '../src/shared/niveau.js';
import { MAX_PACKS, PACK_PRICE, PACK_REGEN_MS, PACKS_DEPART } from '../src/server/fanzzy/index.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS abonnements, achats, admin_journal, reglages, competitions,
  user_stuff, user_skins, user_fanzzy, user_souvenirs, user_decks, virage_presence,
  user_wallet, users`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
for (const f of ['auth.sql', 'admin.sql']) {
  await raw.query(await readFile(`sql/${f}`, 'utf8'));
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });

/* ------------------------------------------------ le registre, hors base

   Ces contrôles-ci n'ont besoin de rien : ils éprouvent la déclaration
   elle-même. Ils passent en premier parce qu'un registre incohérent rendrait
   tout le reste illisible — on chercherait une panne de base là où c'est une
   ligne de déclaration qui se contredit. */

console.log('\n— le registre —');

check('chaque réglage appartient à une section déclarée',
  REGLAGES.every((r) => SECTIONS.some((s) => s.id === r.section))
  || (console.log('        orphelins :', REGLAGES.filter((r) =>
    !SECTIONS.some((s) => s.id === r.section)).map((r) => r.cle).join(', ')), false));

check('aucune clé n’est déclarée deux fois', PAR_CLE.size === REGLAGES.length);

/* Un défaut hors bornes se lirait comme un réglage valide jusqu'au jour où
   quelqu'un l'enregistre sans le changer — et se le verrait refuser. */
const defautsInvalides = REGLAGES.filter((r) => {
  try { valider(r.cle, r.defaut); return false; } catch { return true; }
});
check('chaque valeur par défaut passe sa propre validation',
  defautsInvalides.length === 0
  || (console.log('        fautives :', defautsInvalides.map((r) => r.cle).join(', ')), false));

check('les réglages chiffrés portent tous des bornes',
  REGLAGES.filter((r) => r.type === 'entier' || r.type === 'decimal')
    .every((r) => Number.isFinite(r.min) && Number.isFinite(r.max) && r.min < r.max));

check('les réglages chiffrés portent tous une unité',
  REGLAGES.filter((r) => r.type === 'entier' || r.type === 'decimal')
    .every((r) => typeof r.unite === 'string' && r.unite.length > 0));

/* ------------------------------------------------------ la validation */

console.log('\n— la validation —');

let leve = null;
try { valider('pack.regen_min', 0); } catch (e) { leve = e; }
check('une valeur sous la borne est refusée', leve instanceof ReglageInvalide);
check('et le refus nomme la borne, pas « invalide »',
  /entre 1 et 1440/.test(leve?.raison ?? '')
  || (console.log('        raison :', leve?.raison), false));
check('le refus nomme aussi la clé', leve?.cle === 'pack.regen_min');

leve = null;
try { valider('pack.regen_min', 10.5); } catch (e) { leve = e; }
check('un entier attendu refuse une décimale', /entier/.test(leve?.raison ?? ''));

leve = null;
try { valider('inexistante.cle', 1); } catch (e) { leve = e; }
check('une clé hors registre est refusée', leve instanceof ReglageInvalide);

check('un texte trop long est refusé',
  (() => { try { valider('annonce.texte', 'x'.repeat(400)); return false; } catch { return true; } })());
check('mais un texte est rogné de ses espaces, pas refusé',
  valider('annonce.texte', '  bonjour  ') === 'bonjour');
check('une bascule refuse autre chose que vrai ou faux',
  (() => { try { valider('annonce.actif', 'oui'); return false; } catch { return true; } })());
check('un choix refuse une option qui n’existe pas',
  (() => { try { valider('annonce.ton', 'panique'); return false; } catch { return true; } })());

/* C'est le seul endroit où l'on corrige en silence, et pour une raison
   précise : refuser de démarrer parce qu'une main est passée dans la base
   serait une panne fabriquée par le garde-fou lui-même. */
check('une valeur stockée devenue illégale retombe sur le défaut',
  resoudre('pack.regen_min', 99999) === DEFAUTS['pack.regen_min']);
check('une clé absente vaut son défaut',
  resoudre('virage.but_a', undefined) === DEFAUTS['virage.but_a']);

/* ------------------------------------------ ce que le jeu lit vraiment

   Le cœur de la suite. Écrire dans la base ne prouve rien : ce qu'on veut
   savoir, c'est si le moteur du Virage, celui du duel, les règles de deck et
   le barème d'expérience **changent**. C'est précisément ce qui manquait, et
   ce qu'aucun contrôle ne disait. */

console.log('\n— ce que le jeu lit —');

await chargerReglages(pool);

check('sans rien en base, le jeu tourne sur les valeurs du registre',
  VIRAGE.goalAt === DEFAUTS['virage.but_a']
  && DUEL.goalAt === DEFAUTS['duel.but_a']
  && DECK_RULES.actions === DEFAUTS['deck.actions']
  && XP.pack === DEFAUTS['xp.pack']);

/* Les constantes exportées se déduisent du registre et ne sont plus écrites
   deux fois. Deux endroits qui portent la même valeur finissent toujours par
   diverger — ici le désaccord serait muet, le jeu tournant sur l'une pendant
   que l'administration afficherait l'autre. */
check('les constantes exportées se déduisent du même registre',
  MAX_PACKS === DEFAUTS['pack.max']
  && PACKS_DEPART === DEFAUTS['pack.depart']
  && PACK_PRICE === DEFAUTS['pack.prix_echarpes']
  && PACK_REGEN_MS === DEFAUTS['pack.regen_min'] * 60000);

await ecrireReglage(pool, 'virage.but_a', 777, null);
check('écrire le seuil du Virage change ce que le moteur lit (777)',
  VIRAGE.goalAt === 777 || (console.log('        lu :', VIRAGE.goalAt), false));

await ecrireReglage(pool, 'duel.duree_min', 9, null);
check('la durée d’un duel arrive en millisecondes au moteur',
  DUEL.dureeMs === 9 * 60000 || (console.log('        lu :', DUEL.dureeMs), false));

await ecrireReglage(pool, 'virage.inactif_sec', 30, null);
check('le délai d’inactivité aussi', VIRAGE.idleMs === 30000);

await ecrireReglage(pool, 'deck.actions', 6, null);
check('la taille du deck change pour tout le jeu', DECK_RULES.actions === 6);

await ecrireReglage(pool, 'xp.duel_classe', 44, null);
check('le barème d’expérience change', XP.duel.classe === 44);

check('et les réglages non touchés ne bougent pas',
  DECK_RULES.fanzzy === DEFAUTS['deck.fanzzy'] && XP.pack === DEFAUTS['xp.pack']);

/* ------------------------------------------------- le retour au défaut */

console.log('\n— le retour au défaut —');

await rendreAuDefaut(pool, 'virage.but_a', null);
check('rendre au défaut remet la valeur du registre',
  VIRAGE.goalAt === DEFAUTS['virage.but_a']);

const [lignes] = await pool.query('SELECT cle FROM reglages WHERE cle = ?', ['virage.but_a']);
/* En supprimant la ligne, et non en y écrivant le défaut. Les deux se
   ressemblent aujourd'hui ; ils diffèrent le jour où le défaut change au
   registre — une ligne écrite figerait l'ancienne valeur pour toujours, et il
   faudrait se souvenir d'aller la retirer. */
check('et elle efface la ligne au lieu d’y écrire le défaut', lignes.length === 0);

let refus = null;
try { await ecrireReglage(pool, 'virage.but_a', 5, null); } catch (e) { refus = e; }
check('une écriture hors bornes ne touche pas la base', refus instanceof ReglageInvalide);
const [apres] = await pool.query('SELECT cle FROM reglages WHERE cle = ?', ['virage.but_a']);
check('rien n’a été écrit', apres.length === 0);
check('et le moteur n’a pas bougé', VIRAGE.goalAt === DEFAUTS['virage.but_a']);

/* ------------------------------------------------- la base qui divergerait */

console.log('\n— la base et le cache —');

/* Une écriture faite dans le dos du cache : c'est ce qui arriverait si
   quelqu'un touchait la table à la main, ou si une seconde instance écrivait.
   Le cache ne peut pas le deviner, mais il doit le rattraper au rechargement —
   sinon les deux serveurs d'un même site joueraient des règles différentes. */
await pool.query(
  `INSERT INTO reglages (cle, valeur) VALUES ('duel.but_a', '1111')
   ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`);
check('une écriture directe en base ne change rien tant qu’on n’a pas relu',
  DUEL.goalAt !== 1111);
await chargerReglages(pool);
check('et le rechargement la prend', DUEL.goalAt === 1111);

/* Une valeur **illisible** ne peut pas exister : la colonne est `JSON NOT
   NULL` et la base la refuse elle-même — vérifié ici, parce que c'est sur
   cette garantie qu'on s'appuie pour ne pas mettre de filet dans le code. */
let refuseParLaBase = false;
try {
  await pool.query(`UPDATE reglages SET valeur = 'pas du json' WHERE cle = 'duel.but_a'`);
} catch { refuseParLaBase = true; }
check('la base refuse elle-même une valeur qui n’est pas du JSON', refuseParLaBase);

/* Le pilote analyse lui-même les colonnes JSON : un texte revient déjà
   analysé. Analyser une seconde fois casserait tout réglage textuel — c est ce
   qui est arrivé au premier d entre eux, pendant que les réglages chiffrés
   passaient sans rien dire. L aller-retour le prouve. */
/* L'aller-retour est enveloppé : analysé deux fois, le chargement **lève**, et
   la suite mourrait là en emportant tout ce qui suit. Un contrôle qui tue la
   suite est une détection, mais il ne dit pas ce qui est cassé — il faut
   remonter une pile d'appels pour le savoir. Enveloppé, il le nomme. */
let allerRetour = null;
try {
  await ecrireReglage(pool, 'maintenance.texte', 'Retour à 21 h.', null);
  await chargerReglages(pool);
  allerRetour = tousLesReglages()['maintenance.texte'];
} catch (e) {
  console.log('        le chargement a levé :', e.message);
}
check('un réglage textuel fait l’aller-retour sans être analysé deux fois',
  allerRetour === 'Retour à 21 h.'
  || (console.log('        lu :', JSON.stringify(allerRetour)), false));

await pool.query('DELETE FROM reglages WHERE cle = ?', ['maintenance.texte']);
await chargerReglages(pool);

/* Le cas qui, lui, arrive vraiment : une valeur parfaitement lisible mais hors
   bornes, parce que le registre a changé depuis qu'elle a été écrite. */
await pool.query(`UPDATE reglages SET valeur = '99999' WHERE cle = 'duel.but_a'`);
await chargerReglages(pool);
check('une valeur devenue hors bornes retombe sur le défaut sans rien casser',
  DUEL.goalAt === DEFAUTS['duel.but_a']
  || (console.log('        lu :', DUEL.goalAt), false));

await pool.query('DELETE FROM reglages');
await chargerReglages(pool);

/* -------------------------------------------------- la route publique */

console.log('\n— la route publique —');

/* La route monte `reglagesPublics()` sans rien y ajouter — exactement comme
   server.js. C'est cette fonction-là qu'on éprouve, et non une copie. */
const app = express();
app.get('/api/public/reglages', (_req, res) => res.json(reglagesPublics()));
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://127.0.0.1:${http.address().port}`;
const lire = async () => (await fetch(base + '/api/public/reglages')).json();

check('sans annonce active, la route ne rend rien à afficher',
  (await lire()).annonce === null);

await ecrireReglage(pool, 'annonce.texte', 'Le Virage ouvre à 20 h.', null);
check('un texte sans la bascule ne s’affiche pas',
  (await lire()).annonce === null);

await ecrireReglage(pool, 'annonce.actif', true, null);
const d = await lire();
check('bascule et texte ensemble, l’annonce sort',
  d.annonce?.texte === 'Le Virage ouvre à 20 h.');
check('avec son ton', d.annonce?.ton === DEFAUTS['annonce.ton']);

/* L'équilibrage n'est pas public. Le publier revient à publier le mode
   d'emploi de ce qu'il faut exploiter : le seuil exact d'un but, le coût d'un
   chant, la seconde où l'on sort de la foule. */
const brut = JSON.stringify(d);
check('la route ne publie pas l’équilibrage du jeu',
  !/virage\.|duel\.|deck\.|xp\.|pack\./.test(brut)
  || (console.log('        rendu :', brut), false));

await ecrireReglage(pool, 'maintenance.actif', true, null);
check('la fermeture s’annonce, avec son message',
  (await lire()).maintenance?.texte === DEFAUTS['maintenance.texte']);

/* ------------------------------------------------------------------ fin */

await new Promise((r) => http.close(r));
oublierReglages();
await pool.end();

console.log(rates ? `\n${rates} test(s) en échec` : '\ntout est vert');
process.exit(rates ? 1 : 0);
