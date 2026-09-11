/** Test de la collection Fanzzy côté serveur. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createFanzzy, MAX_PACKS, PACKS_DEPART, PACK_PRICE } from '../src/server/fanzzy/index.js';
import { DEX, BY_ID, SETS } from '../src/shared/fanzzy/dex.js';
import { SKINS } from '../src/shared/fanzzy/inventaire.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { baseDeTest } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
// admin.sql pour la table `reglages` : c'est elle qui porte les séries
// ouvertes, et la suite en éprouve la fermeture plus bas.
for (const f of ['auth.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql',
                 'skins.sql', 'tenues.sql', 'admin.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
// Les réglages ne sont pas dans le DROP ci-dessus : la table est partagée par
// les suites. Une restriction laissée par un passage précédent — ou par cette
// suite interrompue en plein milieu — fermerait les séries et ferait échouer
// tout ce qui ouvre un booster, très loin d'ici et sans rapport apparent.
await raw.query(`DELETE FROM reglages WHERE cle = 'series_actives'`);
const U = '11111111-2222-3333-4444-555555555555';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'f@ex.fr', 'Fan']);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);
const F = createFanzzy({ pool, requireAuth: (req, _r, next) => { req.user = { id: U }; next(); } });
const app = express(); app.use('/api/fanzzy', F.router);
const http = createServer(app); await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

let r = await call('/api/fanzzy/dex');
// Le nombre de séries n'est pas figé ici : il en existe trois depuis
// l'arrivée du VIRAGE IMPOSSIBLE, et il en existera d'autres. Un test qui
// écrit « 2 » en dur casse à chaque ajout sans rien avoir attrapé d'utile.
// `publies()` et non tout le catalogue : trente-deux anciennes cartes sont
// dépubliées parce qu'elles refont un personnage du lot de 2026. Comparer au
// total ferait échouer ce test à chaque carte retirée, alors que retirer une
// carte est une opération normale de l'administration.
const attendues = DEX.filter((f) => f.publie !== false);
check('catalogue servi', r.json.dex?.length === attendues.length
  && r.json.sets?.length === SETS.length);
// Et l'inverse compte autant : une carte retirée qui reste servie continuerait
// d'apparaître au classeur et de se tirer, sans que rien ne le signale.
{
  const servis = new Set((r.json.dex ?? []).map((f) => f.id));
  const fuites = DEX.filter((f) => f.publie === false && servis.has(f.id));
  check('aucune carte retirée n’est servie', fuites.length === 0);
  if (fuites.length) console.log('      ', fuites.map((f) => f.id).join(', '));
}

r = await call('/api/fanzzy/state');
// Trois et non douze : un nouveau joueur reçoit de quoi regarder, pas de quoi
// vider soixante cartes avant d'avoir compris ce qu'est un Fanzzy.
check('trois boosters au départ', r.json.wallet.packs === PACKS_DEPART);
check('et la réserve n’est donc pas pleine', PACKS_DEPART < MAX_PACKS);
check('aucune écharpe au départ', r.json.wallet.scarves === 0);
check('collection vide', Object.keys(r.json.collection).length === 0);

r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN' } });
check('cinq cartes tirées', r.json.cards?.length === 5);
check('toutes typées', r.json.cards.every((c) =>
  ['fanzzy', 'skin', 'stuff', 'action'].includes(c.type)));
/* Un skin habille un Fanzzy déjà possédé : au tout premier booster, il n'y a
   rien à habiller, et la catégorie se replie donc sur un supporter. C'est ce
   qui empêche une première ouverture de donner une tenue pour personne.

   L'équipement et les cartes d'action, eux, peuvent tomber dès le premier
   paquet — et c'est très bien : ils se comprennent seuls. */
check('aucun skin au premier booster',
  r.json.cards.every((c) => c.type !== 'skin'));
check('toutes du bon set',
  r.json.cards.filter((c) => c.type === 'fanzzy').every((c) => BY_ID.get(c.id).set === 'VN'));
check('trois communes garanties',
  r.json.cards.slice(0, 3).every((c) => c.type === 'fanzzy' && BY_ID.get(c.id).rar === 'commune'));
check('un booster consommé', r.json.wallet.packs === PACKS_DEPART - 1);
check('la recharge est amorcée', typeof r.json.wallet.nextPackInMs === 'number');
check('un Fanzzy est équipé d\u2019office', Boolean(r.json.wallet.active));

r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'NE' } });
check('deuxième série disponible',
  r.json.cards.filter((c) => c.type === 'fanzzy').every((c) => BY_ID.get(c.id).set === 'NE'));

const [[baseSkin]] = await pool.query(
  `SELECT COUNT(*) AS n FROM user_skins WHERE user_id = ? AND skin_id = 'base'`, [U]);
check('chaque Fanzzy reçoit son skin de base', baseSkin.n >= 1);

// Sur beaucoup d'ouvertures, des skins doivent finir par tomber.
await pool.query('UPDATE user_wallet SET packs = 40 WHERE user_id = ?', [U]);
let skinsTombes = 0;
let premieresToutesFanzzy = true;
for (let i = 0; i < 40; i++) {
  const o = await call('/api/fanzzy/open', { method: 'POST', body: { set: i % 2 ? 'NE' : 'VN' } });
  const cartes = o.json.cards ?? [];
  skinsTombes += cartes.filter((c) => c.type === 'skin').length;
  if (cartes.slice(0, 3).some((c) => c.type !== 'fanzzy')) premieresToutesFanzzy = false;
}
check(`des skins tombent dans les boosters (${skinsTombes} sur 200 cartes)`, skinsTombes > 5);
check('les trois premières cartes restent des supporters', premieresToutesFanzzy);

const [skinsRecus] = await pool.query(
  `SELECT DISTINCT fanzzy_id FROM user_skins WHERE user_id = ? AND skin_id <> 'base'`, [U]);
const [possedes] = await pool.query(`SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [U]);
const ids = new Set(possedes.map((p) => p.fanzzy_id));
check('un skin ne tombe que pour un Fanzzy possédé',
  skinsRecus.every((s) => ids.has(s.fanzzy_id)));

/* ------------------------------- ce que les places 4 et 5 apportent

   Sept pièces d’équipement et quinze cartes d’action sur vingt et une
   n’étaient obtenables nulle part : le paquet de bienvenue en donnait une de
   chaque, au hasard, et c’était tout. Un joueur pouvait ouvrir trois cents
   boosters sans jamais voir un mégaphone.

   Deux cents cartes tirées plus haut suffisent largement à en faire tomber :
   si rien n’arrive, c’est que la catégorie est morte, pas malchanceuse. */

const [stuffRecu] = await pool.query(
  `SELECT stuff_id FROM user_stuff WHERE user_id = ?`, [U]);
check(`l'équipement tombe dans les boosters (${stuffRecu.length} pièces)`,
  stuffRecu.length > 0);

{
  const w = (await pool.query(
    'SELECT action_cards FROM user_wallet WHERE user_id = ?', [U]))[0][0].action_cards;
  const a = typeof w === 'string' ? JSON.parse(w) : (w ?? []);
  check(`des cartes d'action aussi (${a.length})`, a.length > 0);
  // Et jamais de commune : elles sont déjà offertes à tout le monde. En
  // distribuer serait donner une carte que le joueur possède depuis le
  // premier jour.
  const communes = new Set(ACTIONS.filter((x) => x.rar === 'commune').map((x) => x.id));
  check('aucune carte commune distribuée : elles sont déjà offertes',
    a.every((id) => !communes.has(id)));
}

// Un skin appartient à un âge. Toutes les lignes doivent donc porter un stade
// que le joueur a réellement atteint — lui donner la tenue d’hiver d’un Capo
// qu’il n’a pas encore serait un cadeau qu’il ne peut pas ouvrir.
{
  const [lignes] = await pool.query(
    `SELECT s.fanzzy_id, s.stage, f.stage AS atteint FROM user_skins s
       JOIN user_fanzzy f ON f.user_id = s.user_id AND f.fanzzy_id = s.fanzzy_id
      WHERE s.user_id = ?`, [U]);
  check('chaque skin vise un âge réellement débloqué',
    lignes.length > 0 && lignes.every((l) => l.stage >= 1 && l.stage <= l.atteint));
}

// On vide la réserve pour vérifier le refus puis l'achat.
await pool.query('UPDATE user_wallet SET packs = 0 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN' } });
check('sans booster : refus', r.json.error === 'fanzzy.error.no_packs');

// Solde remis à zéro explicitement : les doublons des ouvertures précédentes
// pourraient sinon suffire à payer, et le test ne vérifierait plus rien.
await pool.query('UPDATE user_wallet SET scarves = 0 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN', buy: true } });
check('sans écharpes non plus', r.json.error === 'fanzzy.error.not_enough_scarves');

await pool.query('UPDATE user_wallet SET scarves = 500 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN', buy: true } });
check('booster acheté en écharpes', r.json.cards?.length === 5);
// Le prix est débité, mais les doublons du même booster recréditent aussitôt :
// c'est le solde net qu'il faut vérifier, pas une simple soustraction.
check('solde exact après achat et doublons',
  r.json.wallet.scarves === 500 - PACK_PRICE + r.json.scarvesGained);

r = await call('/api/fanzzy/state');
const col = r.json.collection;
check('les doublons sont comptés', Object.values(col).some((n) => n > 1));
check('les doublons ont rapporté', r.json.wallet.scarves > 500 - PACK_PRICE);

/* --------------------------------------------------------- évolution */

/* Faire évoluer ne remplace plus une carte par une autre : le personnage
   grandit sur place. Ce qui doit rester vrai après l'opération, c'est qu'il est
   toujours là — et avec autant d'exemplaires qu'avant. L'ancienne version en
   consommait un, ce qui, sur une ligne unique, revenait maintenant à
   confisquer la carte qu'on vient de payer. */

const base1 = DEX.find((f) => f.stage === 1 && f.evo);
await pool.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)
                  ON DUPLICATE KEY UPDATE copies = copies + 1`, [U, base1.id]);
// Sa tenue de base au premier âge, comme le ferait un booster. Sans elle, le
// contrôle « l'âge d'avant reste habillé » n'aurait rien à regarder — et il
// passerait ou échouerait selon ce que les quarante ouvertures ont tiré.
await pool.query(`INSERT IGNORE INTO user_skins (user_id,fanzzy_id,stage,skin_id,equipped)
                  VALUES (?,?,1,'base',1)`, [U, base1.id]);
const mien = async () => (await pool.query(
  'SELECT copies, stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?',
  [U, base1.id]))[0][0];

const avant = await mien();
await pool.query('UPDATE user_wallet SET scarves = 5 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: base1.id } });
check('évolution refusée sans écharpes', r.json.error === 'fanzzy.error.not_enough_scarves');
check('et rien n’a bougé', (await mien()).stage === 1);

await pool.query('UPDATE user_wallet SET scarves = 300 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: base1.id } });
check('évolution acceptée', r.json.stade === 2 && r.json.to === base1.evo);
check('écharpes débitées', r.json.wallet.scarves === 300 - r.json.spent);
check('elle porte le nom du nouvel âge', r.json.nom === DEX.find((f) => f.id === base1.evo).nom);

const apres = await mien();
check('le personnage reste en collection, au stade 2',
  apres !== undefined && apres.stage === 2);
check('et son doublon n’a pas été consommé', apres.copies === avant.copies);
check('l’âge supérieur n’est pas une carte à part',
  (await pool.query('SELECT 1 FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?',
    [U, base1.evo]))[0].length === 0);

r = await call('/api/fanzzy/state');
check('le stade atteint est annoncé au client', r.json.stades?.[base1.id] === 2);

/* Grandir habille le nouvel âge.

   Depuis qu’un skin appartient à un âge, monter de stade sans cette ligne
   laisserait le Capo sans rien à porter : la fiche n’aurait aucune tenue à
   montrer, et l’accueil chercherait un dossier `e2/` qu’aucun skin ne
   désigne. Le personnage grandirait tout nu, en silence. */
{
  const [lignes] = await pool.query(
    `SELECT stage, skin_id, equipped FROM user_skins
      WHERE user_id = ? AND fanzzy_id = ? ORDER BY stage`, [U, base1.id]);
  check('le nouvel âge reçoit sa tenue de base',
    lignes.some((l) => Number(l.stage) === 2 && l.skin_id === 'base'));
  check('et il la porte', lignes.find((l) => Number(l.stage) === 2)?.equipped === 1);
  check('celle du premier âge est intacte',
    lignes.some((l) => Number(l.stage) === 1 && l.skin_id === 'base' && l.equipped === 1));
}

// Deuxième cran, puis le mur : une lignée n'a que trois âges écrits.
r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: base1.id } });
check('deuxième évolution acceptée', r.json.stade === 3);
r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: base1.id } });
check('au bout de la lignée, refus', r.json.error === 'fanzzy.error.no_evolution');

const last = DEX.find((f) => f.stage === 1 && !f.evo);
await pool.query(`INSERT IGNORE INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)`,
  [U, last.id]);
r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: last.id } });
check('un personnage dont le deuxième âge n’est pas écrit est refusé',
  r.json.error === 'fanzzy.error.no_evolution');

r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: 'X-INEXISTANT' } });
check('identifiant inconnu refusé', r.json.error === 'fanzzy.error.unknown');

/* -------------------------------------------------------- équipement */

// On demande l'âge supérieur exprès : un lien ou un deck d'avant le repliage
// le désigne encore, et il doit se traduire au lieu d'échouer.
r = await call('/api/fanzzy/active', { method: 'POST', body: { id: base1.evo } });
check('équiper un âge équipe son personnage', r.json.active === base1.id);
const eq = await F.activeFanzzy(U);
check('le duel le lit à son premier âge', eq?.id === base1.id && Boolean(eq.mods));

const jamais = DEX.find((f) => !Object.keys(col).includes(f.id) && f.id !== base1.evo);
r = await call('/api/fanzzy/active', { method: 'POST', body: { id: 'Z9' } });
check('Fanzzy inexistant refusé', r.json.error === 'fanzzy.error.unknown');

/* ------------------------------------------------------- concurrence */

await pool.query('UPDATE user_wallet SET packs = 1, scarves = 0 WHERE user_id = ?', [U]);
const deux = await Promise.all([
  call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN' } }),
  call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN' } }),
]);
const ouverts = deux.filter((d) => d.json.cards).length;
check('un seul booster pour deux requêtes simultanées', ouverts === 1);

/* ------------------------------------------------------------- fiche */

const unPossede = [...ids][0];
r = await call('/api/fanzzy/fiche/' + unPossede);
check('fiche servie', r.json.fanzzy?.id === unPossede);
check('exemplaires comptés', r.json.possede >= 1);
check('toutes les tenues listées', r.json.skins.length === SKINS.length);
check('le skin de base est possédé et porté',
  r.json.skins.find((s) => s.id === 'base')?.possede === true);
check('la lignée est complète',
  r.json.lignee.length >= 1 && r.json.lignee.every((x) => 'possede' in x));
check('le coût d\u2019évolution est indiqué',
  r.json.lignee.every((x) => x.stage === 1 ? x.cout === 0 : x.cout > 0));
check('l\u2019effet réel est calculé', typeof r.json.effetReel === 'object');

// Avec une pièce portée, l'effet réel doit différer des modificateurs bruts.
await pool.query(`INSERT INTO user_stuff (user_id,stuff_id,copies,slot) VALUES (?,'jumelles',1,1)
                  ON DUPLICATE KEY UPDATE slot = 1`, [U]);
r = await call('/api/fanzzy/fiche/' + unPossede);
check('l\u2019équipement porté modifie l\u2019effet réel',
  JSON.stringify(r.json.effetReel) !== JSON.stringify(r.json.fanzzy.mods));
check('la pièce portée est nommée', r.json.stuffPorte?.[0]?.id === 'jumelles');

r = await call('/api/fanzzy/fiche/INEXISTANT');
check('Fanzzy inconnu : 404', r.status === 404);

r = await call('/api/fanzzy/stuff');
check('catalogue de l\u2019équipement servi', r.json.stuff.length === 7);

/* ------------------------------------------------- les séries ouvertes

   Ouvrir le jeu série par série. Ce qui se teste ici est le refus : le kiosque
   ne propose plus une série fermée, mais un onglet resté ouvert depuis avant la
   fermeture peut encore en demander le booster. */
{
  const { chargerSeries } = await import('../src/server/fanzzy/catalogue.js');
  const ouverte = 'TR';
  const fermee = SETS.map((s) => s.id).find((id) => id !== ouverte);

  await pool.execute(
    `INSERT INTO reglages (cle, valeur) VALUES ('series_actives', ?)
     ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`, [JSON.stringify([ouverte])]);
  await chargerSeries(pool);

  r = await call('/api/fanzzy/dex');
  check('le catalogue annonce les séries ouvertes',
    r.json.seriesOuvertes?.length === 1 && r.json.seriesOuvertes[0] === ouverte);
  check('et marque les autres comme fermées',
    r.json.sets.find((s) => s.id === fermee)?.ouverte === false);
  // Le catalogue reste entier : une carte d'une série fermée doit continuer à
  // s'afficher chez qui la possède déjà.
  check('mais il ne perd aucune carte', r.json.dex.some((f) => f.set === fermee));
  // Ce chiffre compte des **personnages**, pas des lignes de catalogue. Le
  // compter sur les lignes y ajouterait les âges supérieurs des lignées, qu'un
  // booster ne distribue jamais : la jauge n'aurait pas pu arriver au bout.
  check('et il dit combien de personnages restent à collectionner',
    r.json.aCollectionner > 0
    && r.json.aCollectionner === r.json.dex
      .filter((f) => f.set === ouverte && f.racine === f.id).length);
  check('chaque entrée dit de quel personnage elle est un âge',
    r.json.dex.every((f) => f.racine && f.stade >= 1));

  r = await call('/api/fanzzy/open', { method: 'POST', body: { set: fermee } });
  check('une série fermée ne distribue plus', r.json.error === 'fanzzy.error.set_closed');

  await pool.query('UPDATE user_wallet SET packs = 5 WHERE user_id = ?', [U]);
  r = await call('/api/fanzzy/open', { method: 'POST', body: { set: ouverte } });
  check('la série ouverte, elle, distribue toujours',
    Array.isArray(r.json.cards) && r.json.cards.length === 5);

  // On rouvre tout : les autres suites partagent cette base, et une restriction
  // oubliée les ferait échouer ailleurs, très loin d'ici.
  await pool.execute(`DELETE FROM reglages WHERE cle = 'series_actives'`);
  await chargerSeries(pool);
}

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
