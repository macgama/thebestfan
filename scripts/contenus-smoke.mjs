/**
 * Les contenus en base : cartes d'action, équipement, stades.
 *
 * ## Ce que cette suite défend
 *
 * Trois des quatre sortes de contenu qu'une saison veut livrer étaient
 * **décoratives** : elles vivaient dans `src/shared/`, une saison pouvait écrire
 * leur nom dans son texte, et elles étaient jouables depuis la livraison d'avant.
 * On pouvait annoncer « la saison 5 apporte quatre cartes d'action » sans que
 * rien ne change pour personne.
 *
 * La moitié des contrôles porte donc sur ce qui est **facile à casser en
 * voulant bien faire** :
 *
 *   — le semis n'écrase jamais ce que la base porte, sinon une correction faite
 *     depuis l'administration disparaît à la prochaine livraison ;
 *   — tout ce qui existait reste jouable, sinon la migration retire du jour au
 *     lendemain des cartes que les joueurs jouent ;
 *   — sans la table, le jeu tourne comme avant, sinon un fichier SQL oublié
 *     ferme le jeu en silence.
 *
 * Usage : node scripts/contenus-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContenus, tous, publies, ouverts, oublier, FAMILLES }
  from '../src/server/contenus/index.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';
import { STADES, STADE_DEFAUT, stadeDeLaRencontre } from '../src/shared/stades.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
await raw.query(`DROP TABLE IF EXISTS parrainages, contenus, saisons, abonnements, achats, kop_invites,
  amities, kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff,
  user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence, souvenirs, user_wallet,
  api_cache, souvenir_leagues, duel_results, duel_events, duels, user_league_follows,
  user_follows, fixture_events, standings, fixtures, team_leagues, teams, leagues,
  api_quota, login_attempts, auth_tokens, sessions, users, reglages, admin_audit, tenues,
  fanzzy, series`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });

/* ================================================= sans la table, rien ne casse

   C'est le premier contrôle parce que c'est le pire défaut possible : un
   fichier SQL oublié qui ferme le jeu. Le jeu doit tourner **exactement comme
   avant** sur une base incomplète — toutes les cartes du code, toutes
   jouables. */
{
  oublier();
  const c = createContenus({ pool });
  const r = await c.charger();
  check('sans la table, le chargement ne lève pas', r.charge === false);
  check('et toutes les cartes d’action restent jouables',
    publies('action').length === ACTIONS.length);
  check('tout l’équipement aussi', publies('stuff').length === STUFF.length);
  check('et tous les stades', publies('stade').length === STADES.length);
}

/* --------------------------------------------------------------- le semis */
/* `admin.sql` avant `saisons.sql` : la reprise de la saison 1 lit
   `reglages.series_actives`, et cette table vient de admin.sql. Sans elle, le
   fichier des saisons leve sur une table absente — et le message ne dit pas
   laquelle manque.

   `inventaire.sql` et `deck.sql` sont là pour la dernière section : elle
   éprouve les tirages eux-mêmes, et un tirage a besoin d'un joueur qui possède
   des choses. */
for (const f of ['auth.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql', 'deck.sql',
  'admin.sql', 'saisons.sql', 'contenus.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}

const contenus = createContenus({ pool });
{
  oublier();
  const r = await contenus.charger();
  check('avec la table, le catalogue se charge', r.charge === true);

  const attendu = ACTIONS.length + STUFF.length + STADES.length;
  check(`les trois familles sont semées (${r.total}/${attendu})`, r.total === attendu
    || (console.log('        semé :', r.total, '· attendu', attendu), false));

  /* **Tout ce qui existait reste jouable.** C'est la règle de la migration, et
     c'est celle qu'on casse en voulant « partir propre » : fermer le catalogue
     en attendant qu'une saison le rouvre retirerait du jour au lendemain des
     cartes que les joueurs jouent. */
  for (const [famille, { source, nom }] of Object.entries(FAMILLES)) {
    check(`tout ce qui existait reste jouable — ${nom}`,
      publies(famille).length === source.length
      || (console.log('        publiés', publies(famille).length,
        'sur', source.length), false));
  }

  /* La forme survit au passage en base : une carte d'action garde son coût et
     son effet, un stade ses modificateurs. Sans ça, le duel lirait des cartes
     sans effet et personne ne verrait d'erreur — les gestes ne feraient
     simplement plus rien. */
  const carte = publies('action').find((a) => a.id === ACTIONS[0].id);
  check('une carte d’action garde son coût et sa recharge',
    carte?.cost === ACTIONS[0].cost && carte?.cd === ACTIONS[0].cd
    || (console.log('        elle rend :', JSON.stringify(carte)), false));
  check('et son effet, qui est ce qui la fait agir',
    JSON.stringify(carte?.effet) === JSON.stringify(ACTIONS[0].effet));
  const stade = publies('stade').find((x) => x.id === STADES[0].id);
  check('un stade garde ses modificateurs de corde',
    JSON.stringify(stade?.mods) === JSON.stringify(STADES[0].mods));
  const piece = publies('stuff').find((x) => x.id === STUFF[0].id);
  check('une pièce d’équipement garde les siens',
    JSON.stringify(piece?.mods) === JSON.stringify(STUFF[0].mods));

  /* L'ordre du code, et non celui que le moteur veut bien rendre : les écrans
     les affichent dans cet ordre depuis le premier jour. */
  check('l’ordre du code est conservé',
    publies('action')[0]?.id === ACTIONS[0].id
    && publies('action').at(-1)?.id === ACTIONS.at(-1).id);
}

/* ======================================== le semis n'écrase pas ce qui est là

   C'est la contrepartie du patron « le code est la forme, la base est l'état ».
   Sans elle, un nom corrigé depuis l'administration disparaîtrait à la
   prochaine livraison — et personne ne ferait le lien entre les deux. */
{
  const cible = ACTIONS[1].id;
  await pool.query(
    'UPDATE contenus SET nom = ? WHERE famille = ? AND id = ?',
    ['Nom corrigé à la main', 'action', cible]);
  oublier();
  await contenus.charger();
  const relu = tous('action').find((a) => a.id === cible);
  check('un nom corrigé en base survit à un nouveau semis',
    relu?.nom === 'Nom corrigé à la main'
    || (console.log('        il dit :', relu?.nom), false));
  await pool.query('UPDATE contenus SET nom = ? WHERE famille = ? AND id = ?',
    [ACTIONS[1].nom, 'action', cible]);
}

/* ====================================================== publier, et refermer

   C'est ce qu'une saison appelle à son lancement. Le contrôle regarde les deux
   sens : une famille qui s'ouvrirait sans pouvoir se refermer laisserait une
   saison de brouillon impossible à reprendre. */
{
  const cible = STADES.at(-1).id;
  await contenus.publier('stade', [cible], false);
  check('un contenu se ferme', !publies('stade').some((x) => x.id === cible));
  check('et il reste au catalogue, pour qui le regarde',
    tous('stade').some((x) => x.id === cible));

  /* **Sans redémarrage.** Une saison lancée doit changer le jeu pour les
     joueurs déjà connectés — c'est tout l'intérêt d'un lancement. Si la mémoire
     n'était pas remise à jour, il faudrait relancer le serveur pour que la
     saison existe, ce qui est exactement ce qu'on cherchait à éviter. */
  await contenus.publier('stade', [cible], true);
  check('et il se rouvre, sans redémarrage',
    publies('stade').some((x) => x.id === cible));

  /* La base porte la même chose que la mémoire : sans ça, le redémarrage
     suivant défait ce que le lancement vient de faire. */
  await contenus.publier('stade', [cible], false);
  const [[l]] = await pool.query(
    'SELECT publie FROM contenus WHERE famille = ? AND id = ?', ['stade', cible]);
  check('la base porte la même chose que la mémoire', Number(l.publie) === 0);
  await contenus.publier('stade', [cible], true);
}

/* ------------------------------------------- une saison peut ouvrir des stades */
{
  const [[c]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'saisons' AND column_name = 'stades'`);
  check('la table des saisons porte une colonne pour les stades', Number(c.n) === 1);
}


/* =========================================== ce que `publie` change vraiment

   C'est la section qui manquait, et son absence était le défaut : `publier`
   écrivait, `publies` rendait, et **personne n'appelait `publies`**. Une saison
   pouvait fermer les dix stades, le Virage continuait de les tirer. Tout ce qui
   précède était donc vrai et sans effet — le pire état pour un contrôle, parce
   qu'il est vert.

   On éprouve ici les **tirages**, un par un, en fermant un contenu et en
   regardant s'il cesse d'être distribué. Six endroits distribuent : le booster,
   le paquet de bienvenue, la boutique, les communes offertes au deck, et les
   deux moteurs qui choisissent le stade d'une rencontre. */

/* ------------------------------------------------- le stade d'une rencontre

   Deux cents graines et non une : le lieu se tire sur l'identifiant du match,
   et un seul essai pourrait tomber à côté du stade fermé sans rien prouver. */
{
  const ferme = STADES.find((s) => s.id !== STADE_DEFAUT && s.id.startsWith('rp-'))
    ?? STADES.at(-1);
  await contenus.publier('stade', [ferme.id], false);

  const tires = new Set();
  for (let g = 0; g < 200; g++) tires.add(stadeDeLaRencontre([], g, ouverts('stade')).id);
  check(`un stade fermé ne se tire plus (${tires.size} lieux sur ${STADES.length - 1})`,
    !tires.has(ferme.id)
    || (console.log('        il est sorti quand même :', ferme.id), false));

  /* Et les autres continuent. Un filtre qui laisserait tout passer et un filtre
     qui ne laisserait rien passer échouent tous deux au contrôle précédent —
     non, le second le passerait. D'où celui-ci. */
  check('et les autres se tirent toujours', tires.size >= 3
    || (console.log('        lieux vus :', [...tires].join(', ')), false));

  /* **Le stade de départ échappe à la fermeture.** Il est le repli de tous les
     replis : une saison qui le fermerait par mégarde laisserait les rencontres
     sans aucun lieu où se tenir. */
  await contenus.publier('stade', [STADE_DEFAUT], false);
  const listeFermee = ouverts('stade');
  check('le stade de départ se ferme comme les autres, en base',
    !listeFermee.has(STADE_DEFAUT));
  const vus = new Set();
  for (let g = 0; g < 200; g++) vus.add(stadeDeLaRencontre([], g, listeFermee).id);
  check('mais il se tire quand même', vus.has(STADE_DEFAUT)
    || (console.log('        lieux vus :', vus.size), false));
  check('et il reste le repli quand plus rien n’est ouvert',
    stadeDeLaRencontre([], 3, new Set()).id === STADE_DEFAUT);
  await contenus.publier('stade', [STADE_DEFAUT, ferme.id], true);
}

/* ------------------------------------- les communes offertes au deck

   **C'est la fuite qui était la plus large**, et la moins visible : c'est le
   seul endroit du jeu où une carte d'action arrive dans la main d'un joueur
   sans avoir été tirée. Une commune ajoutée au code était jouable par tout le
   monde à la livraison, avant la saison censée l'annoncer.

   Le contrôle passe par `possessions` — la vraie fonction, pas une copie de sa
   logique. Une suite qui réécrirait la règle qu'elle éprouve ne vérifierait que
   sa propre copie. */
{
  const { createDecks } = await import('../src/server/deck/index.js');
  const decks = createDecks({ pool, requireAuth: (_q, _s, n) => n() });

  /* L'identifiant d'un joueur est son `public_id`, pas la clé auto-incrémentée :
     c'est lui que portent `user_wallet`, `user_stuff` et tout le reste. */
  const userId = `ct-${Date.now()}`;
  await pool.query(
    `INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [userId, `contenus-${Date.now()}@test`, 'Tirage']);
  await pool.query(`INSERT INTO user_wallet (user_id) VALUES (?)`, [userId]);

  const commune = ACTIONS.find((a) => a.rar === 'commune');
  const avant = await decks.possessions(userId);
  check(`une commune est offerte à tous (${commune.id})`, avant.actions.has(commune.id));

  await contenus.publier('action', [commune.id], false);
  const apres = await decks.possessions(userId);
  check('et une commune fermée ne l’est plus', !apres.actions.has(commune.id));
  check('les autres communes le restent', apres.actions.size === avant.actions.size - 1
    || (console.log('        avant', avant.actions.size, '· après', apres.actions.size), false));

  /* **Fermer, c'est cesser de distribuer, pas confisquer.** C'est la règle des
     séries, mot pour mot, et c'est celle qu'on casse en filtrant trop large :
     la carte que ce joueur a réellement gagnée reste à lui, fermée ou non. Sans
     ce contrôle, une saison remise en brouillon viderait des decks. */
  await pool.query(
    `UPDATE user_wallet SET action_cards = JSON_ARRAY(?) WHERE user_id = ?`,
    [commune.id, userId]);
  const gagnee = await decks.possessions(userId);
  check('mais celle qu’un joueur a gagnée lui reste', gagnee.actions.has(commune.id));

  await contenus.publier('action', [commune.id], true);
  await pool.query(`DELETE FROM user_wallet WHERE user_id = ?`, [userId]);
  await pool.query(`DELETE FROM users WHERE public_id = ?`, [userId]);
}

/* ------------------------------------------------ et les tirages qui restent

   Le booster, le paquet de bienvenue et la boutique tirent tous les trois dans
   `jouables(famille)` — c'est-à-dire dans ce que cette suite vient d'éprouver.
   Ce qu'on vérifie ici est qu'ils passent bien par là, et le seul moyen honnête
   de le vérifier sans monter trois modules est de le lire.

   **Un contrôle de lecture, et il est assumé.** Il ne remplace pas un tirage
   joué ; il attrape ce qu'un tirage joué n'attrape pas — un septième endroit de
   distribution écrit demain, qui lirait la liste du code et à qui personne ne
   dirait rien. C'est exactement la faute qu'on vient de corriger, et elle a
   vécu une livraison entière. */
{
  const SITES = [
    ['src/server/fanzzy/index.js', 'le booster et la boutique'],
    ['src/server/onboarding/index.js', 'le paquet de bienvenue'],
    ['src/server/deck/index.js', 'les communes offertes'],
    ['src/server/ferveur/virage.js', 'le stade du Virage'],
    ['src/server/nvn/engine.js', 'le stade du duel'],
  ];
  for (const [f, quoi] of SITES) {
    const src = readFileSync(path.join(RACINE, f), 'utf8');
    check(`${quoi} lit ce que les saisons ont ouvert`,
      /from '\.\.\/contenus\/index\.js'/.test(src)
      || (console.log('        ', f, 'n’importe pas le module des contenus'), false));
  }
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await raw.end();
await pool.end();
process.exitCode = failures ? 1 : 0;
