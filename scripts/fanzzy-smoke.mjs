/** Test de la collection Fanzzy côté serveur. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { createFanzzy, MAX_PACKS, PACKS_DEPART, PACK_PRICE, CHEMINS_NOUVEAUTES,
  SORTES_NOUVEAUTE, cleDeCarte } from '../src/server/fanzzy/index.js';
import { DEX, BY_ID, SETS } from '../src/shared/fanzzy/dex.js';
import { SKINS } from '../src/shared/fanzzy/inventaire.js';
import { ACTIONS } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue, obtenables, chargerSeries, lignee } from '../src/server/fanzzy/catalogue.js';
import { createOnboarding } from '../src/server/onboarding/index.js';
import { chargerTenues, tenuesPubliees } from '../src/server/fanzzy/tenues.js';
import * as moduleSaisons from '../src/server/fanzzy/saisons.js';
import { verser } from '../src/server/recompenses.js';
import { reglage, poserReglages } from '../src/shared/reglages.js';
import { baseDeTest, OPTIONS_BASE, figerHorloge, enParallele } from './base-de-test.mjs';
import { STUFF } from '../src/shared/fanzzy/inventaire.js';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');

/** Applique des fichiers de `sql/`, dans l'ordre donné, comme le déploiement. */
async function appliquer(...fichiers) {
  const c = await mysql.createConnection({ uri: DB, multipleStatements: true });
  try {
    for (const f of fichiers) {
      await c.query(readFileSync(new URL(`../sql/${f}.sql`, import.meta.url), 'utf8'));
    }
  } finally {
    await c.end();
  }
}

const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
/* Les quatre tables de `sql/quotidien.sql` partent avec le reste : elles n'ont
   pas de clé étrangère (ECARTS.md, socle § 1), donc rien ne les vide si on ne
   les nomme pas. `saisons` aussi : la suite la rebâtit par son vrai fichier, que
   `quotidien.sql` complète. */
await raw.query(`DROP TABLE IF EXISTS parrainages, abonnements, achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions,
                 recompenses, missions_jour, compteurs_jour, user_nouveautes, saisons, users`);
await raw.end();
/* admin.sql pour la table `reglages` : c'est elle qui porte les séries
   ouvertes, et `saisons.sql` la lit. `saisons.sql` avant `quotidien.sql`, qui
   lui ajoute ses colonnes datées : c'est l'ordre de `scripts/ordre-schema.mjs`. */
await appliquer('auth', 'souvenirs', 'billets', 'fanzzy', 'inventaire', 'skins', 'etats', 'tenues',
  'admin', 'saisons', 'quotidien');

const raw2 = await mysql.createConnection({ uri: DB, multipleStatements: true });
/* La table des saisons est partagée par les suites, et c'est elle qui décide
   des séries ouvertes. `saisons.sql` vient d'y reposer sa saison 1 de reprise :
   on repart de « aucune saison », c'est-à-dire tout ouvert. La fin de la suite
   éprouve, elle, le monde de la production — LA REPRISE seule. */
await raw2.query('DELETE FROM saisons');
const U = '11111111-2222-3333-4444-555555555555';
await raw2.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'f@ex.fr', 'Fan']);
await raw2.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);
/* Le joueur de la requête : `U` par défaut, un autre quand l'en-tête le nomme.
   Les contrôles du chantier serveur partent chacun d'un joueur neuf, pour ne
   pas hériter de ce que les blocs d'avant ont ouvert. */
const authentifier = (req, _r, next) => { req.user = { id: req.get('x-joueur') || U }; next(); };
const F = createFanzzy({ pool, requireAuth: authentifier });
const app = express(); app.use('/api/fanzzy', F.router);
const http = createServer(app); await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(o.qui ? { 'x-joueur': o.qui } : {}) },
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

r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR' } });
check('cinq cartes tirées', r.json.cards?.length === 5);
check('toutes typées', r.json.cards.every((c) =>
  ['fanzzy', 'skin', 'etat', 'stuff', 'action', 'echarpes'].includes(c.type)));
/* Un skin habille un Fanzzy déjà possédé : au tout premier booster, il n'y a
   rien à habiller, et la catégorie se replie donc sur un supporter. C'est ce
   qui empêche une première ouverture de donner une tenue pour personne.

   L'équipement et les cartes d'action, eux, peuvent tomber dès le premier
   paquet — et c'est très bien : ils se comprennent seuls. */
check('aucun skin au premier booster',
  r.json.cards.every((c) => c.type !== 'skin'));
check('toutes du bon set',
  r.json.cards.filter((c) => c.type === 'fanzzy').every((c) => BY_ID.get(c.id).set === 'TR'));
/* **Un supporter, oui. Commune, non.**
 *
 * Ce contrôle exigeait une commune, et c'était vrai tant qu'aucune place du
 * booster ne tirait sa rareté. Depuis que les deux premières la tirent — sans
 * quoi aucune légendaire n'était atteignable — la première carte peut être
 * rare, épique ou légendaire, et c'est exactement ce qu'on voulait.
 *
 * Il passait quand même, parce qu'il tirait dans une série trop pauvre pour
 * avoir autre chose que des communes. Ce qui reste garanti, et qui est
 * l'invariant réel : **la première carte est toujours un supporter**. C'est ce
 * qu'un joueur vient chercher, et un booster qui s'ouvre sur trois écharpes
 * n'est pas un booster. */
check('la première carte est un supporter, toujours',
  r.json.cards[0].type === 'fanzzy'
  || (console.log('        elle est :', r.json.cards[0].type), false));
check('un booster consommé', r.json.wallet.packs === PACKS_DEPART - 1);
check('la recharge est amorcée', typeof r.json.wallet.nextPackInMs === 'number');
check('un Fanzzy est équipé d\u2019office', Boolean(r.json.wallet.active));

r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'MS' } });
check('deuxième série disponible',
  r.json.cards.filter((c) => c.type === 'fanzzy').every((c) => BY_ID.get(c.id).set === 'MS'));

const [[baseSkin]] = await pool.query(
  `SELECT COUNT(*) AS n FROM user_skins WHERE user_id = ? AND skin_id = 'base'`, [U]);
check('chaque Fanzzy reçoit son skin de base', baseSkin.n >= 1);

// Sur beaucoup d'ouvertures, des skins doivent finir par tomber.
await pool.query('UPDATE user_wallet SET packs = 40 WHERE user_id = ?', [U]);
let skinsTombes = 0;
/* Les catégories vues **depuis le début**. Les compter sur une série
   d'ouvertures tardives ne prouverait rien : à ce stade le joueur possède déjà
   toutes les cartes d'action non communes, et la catégorie se replie donc
   légitimement sur les écharpes. Une catégorie morte et une catégorie épuisée
   se ressemblent, et seule la première est un défaut. */
const vus = new Set(r.json.cards.map((c) => c.type));
let premiereToujoursFanzzy = true;
let maxFanzzy = 0;
let echarpesTombees = 0;
let etatsTombes = 0;
let etatsDoublesDansUnPaquet = 0;
const ouvertures = 40;
for (let i = 0; i < ouvertures; i++) {
  const o = await call('/api/fanzzy/open', { method: 'POST', body: { set: i % 2 ? 'MS' : 'TR' } });
  const cartes = o.json.cards ?? [];
  skinsTombes += cartes.filter((c) => c.type === 'skin').length;
  echarpesTombees += cartes.filter((c) => c.type === 'echarpes').length;
  const etatsDuPaquet = cartes.filter((c) => c.type === 'etat');
  etatsTombes += etatsDuPaquet.length;
  const cles = new Set(etatsDuPaquet.map((c) => `${c.pour}:${c.stade}:${c.id}`));
  etatsDoublesDansUnPaquet += etatsDuPaquet.length - cles.size;
  for (const c of cartes) vus.add(c.type);
  if (cartes[0]?.type !== 'fanzzy') premiereToujoursFanzzy = false;
  maxFanzzy = Math.max(maxFanzzy, cartes.filter((c) => c.type === 'fanzzy').length);
}
check(`des skins tombent dans les boosters (${skinsTombes} sur 200 cartes)`, skinsTombes > 5);

/* ------------------------------------ un ou deux supporters, jamais plus

   Un booster en donnait quatre sur cinq en moyenne — trois garantis, plus une
   chance sur deux à chacune des deux dernières places. La collection avançait,
   mais l'équipement, les tenues et les cartes d'action n'arrivaient presque
   jamais, et deux ouvertures se ressemblaient.

   Les deux bornes comptent autant l'une que l'autre : **jamais plus de deux**,
   pour que le reste de l'inventaire ait de la place ; **jamais zéro**, parce
   qu'un booster sans un seul personnage est une ouverture pour rien. */
check('la première carte est toujours un supporter', premiereToujoursFanzzy);
check(`jamais plus de deux supporters par booster (vu : ${maxFanzzy})`, maxFanzzy <= 2);
/* Et les écharpes tombent vraiment. Sans ce contrôle, une catégorie morte
   passerait pour de la malchance : sur deux cents cartes, un quart des trois
   places ouvertes en donne des dizaines. */
check(`des écharpes tombent aussi (${echarpesTombees} poignées)`, echarpesTombees > 5);
/* Les quatre catégories déclarées doivent toutes **tomber pour de vrai**. Sans
   ce contrôle, une ligne ajoutée à la table sans la branche qui va avec donne
   silencieusement autre chose — c'est ce qui s'est passé : toute catégorie
   inconnue sortait en carte d'action, et une table qui promettait des
   supporters n'en donnait aucun sans que rien ne rougisse. */
for (const t of ['fanzzy', 'skin', 'etat', 'stuff', 'action', 'echarpes']) {
  check(`la catégorie « ${t} » tombe vraiment`, vus.has(t));
}

const [skinsRecus] = await pool.query(
  `SELECT DISTINCT fanzzy_id FROM user_skins WHERE user_id = ? AND skin_id <> 'base'`, [U]);
const [possedes] = await pool.query(`SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [U]);
const ids = new Set(possedes.map((p) => p.fanzzy_id));
check('un skin ne tombe que pour un Fanzzy possédé',
  skinsRecus.every((s) => ids.has(s.fanzzy_id)));

/* ------------------------------------------------ les états, quatre règles

   Ils étaient **donnés** avec le personnage : le posséder suffisait, et ses
   quatre expressions s'affichaient sans que rien ne les ait fait gagner. Ils
   se tirent maintenant en booster, et ces contrôles sont exactement ce qui
   distingue « gagné » de « donné ». Le jour où l'un d'eux rougit, les états
   sont redevenus un cadeau sans que personne ne l'ait décidé. */
const [etatsRecus] = await pool.query(
  `SELECT fanzzy_id, stage, etat FROM user_etats WHERE user_id = ?`, [U]);
const [stades] = await pool.query(
  `SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ?`, [U]);
const stadeDe = new Map(stades.map((s) => [s.fanzzy_id, Number(s.stage)]));

check(`des états tombent dans les boosters (${etatsTombes} sur 200 cartes)`,
  etatsTombes > 3);
check('ils sont bien rangés en base', etatsRecus.length > 0);
check('un état ne tombe que pour un Fanzzy possédé',
  etatsRecus.every((e) => ids.has(e.fanzzy_id)));
/* Un état appartient à un âge : on ne gagne pas la joie d'un Capo qu'on n'a
   pas fait grandir. C'est la règle des tenues appliquée aux expressions, et
   c'est elle qui donne une raison d'évoluer. */
check('et jamais pour un âge qu’il n’a pas débloqué',
  etatsRecus.every((e) => Number(e.stage) <= (stadeDe.get(e.fanzzy_id) ?? 1)));
check('chaque état tiré est l’un des quatre dessinés',
  etatsRecus.every((e) => ['joie', 'depit', 'pousse', 'colere'].includes(e.etat)));
check('aucun état annoncé deux fois dans le même paquet',
  etatsDoublesDansUnPaquet === 0);

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
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR' } });
check('sans booster : refus', r.json.error === 'fanzzy.error.no_packs');

// Solde remis à zéro explicitement : les doublons des ouvertures précédentes
// pourraient sinon suffire à payer, et le test ne vérifierait plus rien.
await pool.query('UPDATE user_wallet SET scarves = 0 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR', buy: true } });
check('sans écharpes non plus', r.json.error === 'fanzzy.error.not_enough_scarves');

await pool.query('UPDATE user_wallet SET scarves = 500 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR', buy: true } });
check('booster acheté en écharpes', r.json.cards?.length === 5);
// Le prix est débité, mais les doublons du même booster recréditent aussitôt :
// c'est le solde net qu'il faut vérifier, pas une simple soustraction.
check('solde exact après achat et doublons',
  r.json.wallet.scarves === 500 - PACK_PRICE + r.json.scarvesGained);

r = await call('/api/fanzzy/state');
const col = r.json.collection;
check('les doublons sont comptés', Object.values(col).some((n) => n > 1));
/* **Un doublon rapporte**, et on le vérifie sur un booster qui en contient
   un. Le contrôle lisait le solde après un seul achat, en pariant qu'il en
   sortirait au moins un : le pari tenait tant que l'équipement était court,
   il a cessé de tenir une fois sur six quand douze pièces sont arrivées — un
   booster sort plus souvent du neuf, donc moins de doublons. On ouvre donc
   jusqu'à en voir un, et c'est celui-là qu'on juge. */
{
  let avecDoublon = null;
  for (let i = 0; i < 12 && !avecDoublon; i++) {
    await pool.query('UPDATE user_wallet SET scarves = 500 WHERE user_id = ?', [U]);
    const o = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR', buy: true } });
    if ((o.json.cards ?? []).some((c) => c.type === 'fanzzy' && c.new === false)) avecDoublon = o.json;
  }
  check('les doublons ont rapporté', Boolean(avecDoublon) && avecDoublon.scarvesGained > 0
    || (console.log('        booster :', JSON.stringify(avecDoublon?.cards?.map((c) => [c.type, c.new]))), false));
}

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

/* ==================== la garde-robe part au client, âge par âge

   **Ce contrôle existe à cause d'un défaut visible à l'écran.**

   L'accueil laisse faire défiler les âges de son Fanzzy avant d'en valider un.
   Il gardait la tenue de l'âge affiché en changeant d'âge, et montrait donc le
   Capo dans le déguisement du gamin — **une tenue que le joueur ne possède pas à
   cet âge-là**. Rapporté en ces termes : « je vois l'image suivante même si elle
   ne fait pas partie de ma collection ».

   La faute n'était pas dans le défilé. Le portefeuille n'envoyait qu'une seule
   tenue — `activeSkin`, celle de l'âge montré — et une page qui n'a qu'une
   valeur pour trois âges finit par la réemployer pour les trois. C'est
   `tenuesParAge` qui manquait, et c'est elle qu'on vérifie ici : le client ne
   peut être juste que si on lui donne de quoi l'être.

   La règle est celle de `sql/skins.sql` — clé `(joueur, personnage, stade,
   tenue)`, « le Capo n'hérite pas de la garde-robe du gamin ». */
{
  // Une tenue autre que `base`, gagnée au **premier âge seulement**.
  const autre = tenuesPubliees().find((t) => t.id !== 'base');
  /* **Le personnage regardé doit être celui qu'on porte.** `tenuesParAge` est
     la garde-robe du Fanzzy équipé, et ce bloc habille `base1` sans l'avoir
     jamais équipé : le premier booster en avait équipé un autre, tiré au
     hasard. Ces deux contrôles étaient rouges depuis avant le lot 0 (« les
     trois rouges connus ») pour cette seule raison — c'était le scénario qui
     était faux, pas le portefeuille. On l'équipe donc, comme le ferait le
     classeur, au dernier âge atteint. */
  await pool.query('UPDATE user_wallet SET active_fanzzy = ?, active_evo = NULL WHERE user_id = ?',
    [base1.id, U]);
  if (autre) {
    await pool.query(
      `INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id, equipped)
       VALUES (?, ?, 1, ?, 1)`, [U, base1.id, autre.id]);
    /* On la **porte** au premier âge, à la place de `base` : `tenuesParAge` ne
       rend que ce qui est porté, et deux tenues portées au même âge seraient une
       base incohérente que ce contrôle n'a pas à fabriquer. */
    await pool.query(
      `UPDATE user_skins SET equipped = IF(skin_id = ?, 1, 0)
        WHERE user_id = ? AND fanzzy_id = ? AND stage = 1`, [autre.id, U, base1.id]);

    r = await call('/api/fanzzy/state');
    const t = r.json.wallet?.tenuesParAge ?? {};
    check(`la tenue du premier âge part au client (${autre.id})`, t['1'] === autre.id
      || (console.log('        la table dit :', JSON.stringify(t)), false));
    check('celle du deuxième est la sienne, et non celle du premier',
      t['2'] === 'base'
      || (console.log('        la table dit :', JSON.stringify(t)), false));
    /* Le troisième âge n'est pas encore atteint à ce point du scénario : il ne
       doit pas figurer. Proposer la garde-robe d'un âge qu'on n'a pas payé
       serait le montrer en aperçu, et c'est ce que le défilé refuse de faire
       pour les âges eux-mêmes. */
    check('et l’âge non atteint n’a pas d’entrée', t['3'] === undefined);
  }
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

/* -------------------------------------------------- et à quel âge le montrer

 * `active_fanzzy` dit **qui**, `active_evo` dit **à quel âge**. Une seule
 * décision — « voilà de quoi j'ai l'air » — donc un seul geste : la même route
 * porte les deux. Deux routes laisseraient exister l'instant où la bourse
 * porte un personnage et l'âge d'un autre, et c'est l'écran d'accueil de
 * quelqu'un qui l'apprendrait.
 *
 * Le joueur qui a payé le deuxième âge peut vouloir montrer le premier : ce
 * n'est pas une version inférieure du personnage, c'est un autre dessin, celui
 * avec lequel il a commencé. Ce que le jeu refuse, c'est l'inverse — montrer un
 * âge qu'on n'a pas fait grandir.
 */
await pool.query('UPDATE user_fanzzy SET stage = 2 WHERE user_id = ? AND fanzzy_id = ?',
  [U, base1.id]);

r = await call('/api/fanzzy/active', { method: 'POST', body: { id: base1.id, evo: 1 } });
check('on peut demander à se montrer au premier âge', r.json.activeEvo === 1
  || (console.log('        rendu :', JSON.stringify(r.json)), false));
let perso = await F.personnageActif(U);
check('et c’est cet âge-là que voient les autres', perso?.evo === 1
  && perso?.age === base1.id);
check('la bourse le dit à l’écran qui le propose',
  (await F.wallet(U)).activeEvo === 1);

/* **L'âge atteint s'écrit nul plutôt que son numéro.** Sans cela, choisir « le
   dernier » aujourd'hui figerait l'affichage sur cet âge-là, et le joueur qui
   fait grandir son Fanzzy demain ne le verrait pas changer — il reviendrait ici
   sans savoir pourquoi, ou n'y reviendrait pas. */
r = await call('/api/fanzzy/active', { method: 'POST', body: { id: base1.id, evo: 2 } });
check('choisir l’âge atteint veut dire « le dernier », et non « celui-ci »',
  r.json.activeEvo === null || (console.log('        rendu :', JSON.stringify(r.json)), false));
perso = await F.personnageActif(U);
check('on se montre donc à l’âge atteint', perso?.evo === 2 && perso?.age === base1.evo);

/* Un âge qu'on n'a pas fait grandir : refusé. L'accepter afficherait aux amis
   un personnage que son propriétaire n'a pas, et le retour au vrai âge — au
   prochain calcul — se lirait comme une perte. */
r = await call('/api/fanzzy/active', { method: 'POST', body: { id: base1.id, evo: 3 } });
check('un âge non atteint est refusé', r.json.error === 'fanzzy.error.age_non_atteint'
  || (console.log('        rendu :', JSON.stringify(r.json)), false));
r = await call('/api/fanzzy/active', { method: 'POST', body: { id: base1.id, evo: 0 } });
check('un âge qui n’existe pas aussi', r.json.error === 'fanzzy.error.age_inconnu');

/* Et le personnage reste montré à l'âge qu'il avait : un refus ne doit rien
   changer, sans quoi une demande invalide serait une façon de remettre à
   zéro. */
check('un refus ne touche pas à ce qui était choisi',
  (await F.wallet(U)).activeEvo === null);

/* Sans âge demandé — c'est ce qu'envoie le classeur, qui change de personnage
   et ne parle pas d'âge — on repart de l'âge atteint. Garder l'âge du
   précédent montrerait le nouveau venu à un stade qu'il n'a peut-être jamais
   atteint. */
await call('/api/fanzzy/active', { method: 'POST', body: { id: base1.id, evo: 1 } });
r = await call('/api/fanzzy/active', { method: 'POST', body: { id: base1.id } });
check('équiper sans parler d’âge repart de l’âge atteint', r.json.activeEvo === null
  && (await F.wallet(U)).activeEvo === null);

/* ------------------------------------------------------- concurrence */

await pool.query('UPDATE user_wallet SET packs = 1, scarves = 0 WHERE user_id = ?', [U]);
const deux = await Promise.all([
  call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR' } }),
  call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR' } }),
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
/* Le nombre vient de la source et non d'un 7 en dur : il en valait sept, il en
   vaut dix-sept, et il changera encore. Un test qui fige un total casse à chaque
   pièce ajoutée sans avoir rien attrapé. */
check(`catalogue de l'équipement servi (${STUFF.length})`,
  r.json.stuff.length === STUFF.length
  || (console.log('        servi :', r.json.stuff?.length), false));

/* ------------------------------------------------- les séries ouvertes

   Ouvrir le jeu série par série. Ce qui se teste ici est le refus : le kiosque
   ne propose plus une série fermée, mais un onglet resté ouvert depuis avant la
   fermeture peut encore en demander le booster. */
{
  const { chargerSeries } = await import('../src/server/fanzzy/catalogue.js');
  const { chargerSaisons } = await import('../src/server/fanzzy/saisons.js');
  const ouverte = 'TR';
  const fermee = SETS.map((s) => s.id).find((id) => id !== ouverte);

  /* **Une saison lancée**, et c'est elle qui ouvre. Le réglage
     `series_actives` n'a plus aucun effet : les séries ouvertes sont l'union
     des saisons lancées, et rien d'autre ne les décide. */
  await pool.execute(
    `INSERT INTO saisons (numero, nom, series, lancee_a) VALUES (1, 'Essai', ?, NOW(3))`,
    [JSON.stringify([ouverte])]);
  await chargerSaisons(pool);
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

  // On rouvre tout : les autres suites partagent cette base, et une saison
  // oubliée les ferait échouer ailleurs, très loin d'ici.
  await pool.execute('DELETE FROM saisons');
  await chargerSaisons(pool);
  await chargerSeries(pool);
}

/* ============================================================ la bibliothèque

   Tout ce qui se gagne, par type. Deux choses comptent plus que les
   chiffres eux-mêmes : **chaque gain compte pour un, à sa place**, et **le
   total possible ne bouge pas quand on progresse**. Une bibliothèque qui
   ajouterait les âges à l'univers au fur et à mesure qu'on les paie ferait
   reculer le pourcentage au moment où l'on avance. */
{
  const lire = async () => (await call('/api/fanzzy/bibliotheque')).json;
  const avant = await lire();
  const types = ['fanzzy', 'etats', 'tenues', 'stuff', 'actions'];
  check('la bibliothèque range les cinq types',
    types.every((k) => Number.isFinite(avant.types?.[k]?.possibles))
    || (console.log('        elle rend :', Object.keys(avant.types ?? {}).join(', ')), false));
  const somme = types.reduce((s, k) => s + avant.types[k].possibles, 0);
  check(`et son total est leur somme (${avant.total?.possibles})`, avant.total?.possibles === somme);
  check('les cartes d’action communes sont à tout le monde dès le début',
    avant.types.actions.gagnes >= ACTIONS.filter((a) => a.rar === 'commune').length);

  /* Un personnage, une tenue, un état, une pièce : chacun doit compter pour
     un, dans son type, et nulle part ailleurs. */
  const X = avant.types.fanzzy.items.find((f) => !f.possede)?.id;
  const tenue = tenuesPubliees().find((s) => s.id !== 'base')?.id;
  const piece = avant.types.stuff.items.find((s) => !s.possede)?.id;
  await pool.execute(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?, ?, 1, 1)
    ON DUPLICATE KEY UPDATE stage = 1`, [U, X]);
  if (tenue) {
    await pool.execute(`INSERT IGNORE INTO user_skins (user_id, fanzzy_id, stage, skin_id) VALUES (?, ?, 1, ?)`,
      [U, X, tenue]);
  }
  await pool.execute(`INSERT IGNORE INTO user_etats (user_id, fanzzy_id, stage, etat) VALUES (?, ?, 1, 'joie')`, [U, X]);
  await pool.execute(`INSERT IGNORE INTO user_stuff (user_id, stuff_id) VALUES (?, ?)`, [U, piece]);
  const apres = await lire();
  const plus = (k) => apres.types[k].gagnes - avant.types[k].gagnes;
  check(`un gain compte pour un, à sa place (${types.map((k) => `${k} +${plus(k)}`).join(' · ')})`,
    plus('fanzzy') === 1 && plus('etats') === 1 && plus('tenues') === (tenue ? 1 : 0)
      && plus('stuff') === 1 && plus('actions') === 0);
  check('et le personnage apparaît avec ses états et ses tenues',
    apres.parFanzzy.some((p) => p.id === X && p.etats.gagnes === 1));

  await pool.execute('UPDATE user_fanzzy SET stage = 3 WHERE user_id = ? AND fanzzy_id = ?', [U, X]);
  const evolue = await lire();
  check(`faire grandir un Fanzzy ne change pas ce qui reste à gagner (${evolue.total.possibles})`,
    evolue.total.possibles === apres.total.possibles && evolue.total.gagnes === apres.total.gagnes);

  await pool.execute('DELETE FROM user_etats WHERE user_id = ? AND fanzzy_id = ?', [U, X]);
  await pool.execute('DELETE FROM user_skins WHERE user_id = ? AND fanzzy_id = ?', [U, X]);
  await pool.execute('DELETE FROM user_stuff WHERE user_id = ? AND stuff_id = ?', [U, piece]);
  await pool.execute('DELETE FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?', [U, X]);
}

/* ==================================================================
   LE CHANTIER SERVEUR, VAGUE 1 (PLAN.md, § 6.4)

   La recharge qui n'écrase plus un débit, les nouveautés, les compteurs du
   jour, la progression des séries dans la réponse du booster, les paliers de
   collection et la saison annoncée. Chaque contrôle part d'un joueur neuf,
   et compare **à la valeur exacte** : « plus que zéro » est ce qui avait
   caché le forfait payé deux fois.
   ================================================================== */

let numero = 0;
/** Un joueur neuf, sa bourse ouverte comme le ferait sa première page. */
async function joueur(nom) {
  const id = randomUUID();
  numero++;
  await pool.execute(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [id, `essai${numero}@test.invalid`, `${nom}${numero}`]);
  await call('/api/fanzzy/state', { qui: id });
  return id;
}
const cadence = () => reglage('pack.regen_min') * 60_000;
async function bourse(id) {
  const [[w]] = await pool.execute('SELECT scarves, packs, packs_at FROM user_wallet WHERE user_id = ?', [id]);
  return { scarves: Number(w.scarves), packs: Number(w.packs), packsAt: new Date(w.packs_at) };
}
/* `packs_at` se date comme le serveur la date : en JavaScript, par le pilote
   (voir le pavé de `wallet`). */
const poserReserve = (id, packs, ilYaMs) => pool.execute(
  'UPDATE user_wallet SET packs = ?, packs_at = ? WHERE user_id = ?',
  [packs, new Date(Date.now() - ilYaMs), id]);
const ouvrir = (qui, set = 'TR') => call('/api/fanzzy/open', { method: 'POST', body: { set }, qui });
const lignesNouveautes = async (id) =>
  (await pool.execute('SELECT cle, sorte FROM user_nouveautes WHERE user_id = ?', [id]))[0];
const eteindre = (qui, body) => call('/api/fanzzy/vu', { method: 'POST', body, qui });
const compteur = async (id, cle) => Number((await pool.execute(
  `SELECT n FROM compteurs_jour WHERE user_id = ? AND jour = CURDATE() AND cle = ?`, [id, cle]))[0][0]?.n ?? 0);

/* ------------------------------------------------------- la recharge (E3)

   La recharge écrivait une valeur absolue calculée sur une lecture d'avant :
   un débit passé entre les deux était effacé, et le booster gratuit. */
console.log('\n  la recharge ne peut plus écraser un débit');
check('le module livre recharger(conn, userId)',
  typeof F.recharger === 'function' && F.recharger.length === 2);
{
  /* Le contrôle de base, d'abord : l'écriture conditionnelle compare une date
     relue à une date écrite. Si l'aller-retour par le pilote perdait une
     milliseconde, la condition ne serait jamais vraie, et plus personne ne
     rechargerait — sans un message. */
  const A = await joueur('Recharge');
  await poserReserve(A, 0, 2 * cadence() + 1000);
  const r = await call('/api/fanzzy/state', { qui: A });
  check('deux cadences écoulées : la lecture recharge deux boosters',
    r.json.wallet?.packs === 2 && (await bourse(A)).packs === 2
    || (console.log('        lu :', r.json.wallet?.packs, '· en base :', (await bourse(A)).packs), false));
  check('et le compte à rebours repart d’où il en était, pas de zéro',
    r.json.wallet.nextPackInMs <= cadence() - 1000 && r.json.wallet.nextPackInMs > cadence() - 6000);
  await poserReserve(A, reglage('pack.max'), 3 * cadence());
  const p = await call('/api/fanzzy/state', { qui: A });
  check('réserve pleine : pas de minuterie, et elle repartira de maintenant',
    p.json.wallet.nextPackInMs === null && p.json.wallet.packs === reglage('pack.max')
    && Math.abs(Date.now() - (await bourse(A)).packsAt.getTime()) < 5000);
}
{
  /* `RISQUES.md`, E3, mot pour mot : réserve à zéro, une recharge due, dix
     ouvertures ensemble. */
  const B = await joueur('Dix');
  await poserReserve(B, 0, cadence() + 1000);
  const rep = await enParallele(10, () => ouvrir(B));
  const passees = rep.filter((x) => Array.isArray(x.json.cards)).length;
  const refus = rep.filter((x) => x.json.error === 'fanzzy.error.no_packs').length;
  check(`dix ouvertures sur une recharge due : une seule passe (${passees}), neuf refus (${refus})`,
    passees === 1 && refus === 9);
  check('et la réserve finit à zéro', (await bourse(B)).packs === 0);
}
{
  /* **La course placée exactement là où elle fait mal**, et non espérée : une
     lecture de l'état (`wallet()`, donc la barre de n'importe quelle page) lit
     la réserve, s'arrête avant d'écrire, une ouverture passe et débite, puis
     la lecture reprend. L'ancienne écriture absolue remettait le booster
     débité ; la conditionnelle voit que la ligne a bougé et relit. */
  const V = await joueur('Course');
  await poserReserve(V, 0, cadence() + 1000);
  let relacher;
  const porte = new Promise((r) => { relacher = r; });
  let signaler;
  const arrivee = new Promise((r) => { signaler = r; });
  let premiere = true;
  const F2 = createFanzzy({ pool, requireAuth: authentifier, crochets: {
    apresLectureRecharge: async (qui) => {
      if (qui !== V || !premiere) return;
      premiere = false;
      signaler();
      await porte;
    },
  } });
  const lecture = F2.wallet(V);
  await arrivee;
  const o = await ouvrir(V);
  relacher();
  const w = await lecture;
  check('pendant la lecture suspendue, l’ouverture passe (recharge due)', o.json.cards?.length === 5);
  check(`la lecture reprise ne rend pas le booster débité (elle dit ${w.packs})`, w.packs === 0);
  check('ni en base', (await bourse(V)).packs === 0);
  check('et une seconde ouverture est refusée', (await ouvrir(V)).json.error === 'fanzzy.error.no_packs');
}
{
  const C = await joueur('Annule');
  await poserReserve(C, 0, cadence() + 1000);
  const avant = await bourse(C);
  const conn = await pool.getConnection();
  let vu = null;
  try {
    await conn.beginTransaction();
    vu = await F.recharger(conn, C);
    await conn.rollback();
  } finally {
    conn.release();
  }
  const apres = await bourse(C);
  check('dans une transaction, recharger recharge sur sa connexion', vu?.packs === 1);
  check('et une annulation la défait entièrement',
    apres.packs === 0 && apres.packsAt.getTime() === avant.packsAt.getTime());
}
{
  /* Le même contrôle que le grand livre (`recompenses-smoke`), mais avec la
     vraie fonction : 11 sur 12, une recharge due, un booster offert → 13. */
  const D = await joueur('Cadeau');
  const max = reglage('pack.max');
  await poserReserve(D, max - 1, cadence() + 1000);
  const r = await verser(pool, { userId: D, source: 'sachet', cle: 'essai-recharge', saisonId: null,
    gain: { packs: 1 }, recharger: F.recharger });
  check(`à ${max - 1} sur ${max} avec une recharge due, un booster offert donne ${max + 1}`,
    r.verse === true && r.wallet.packs === max + 1 && (await bourse(D)).packs === max + 1
    || (console.log('        rendu :', JSON.stringify(r)), false));
}

/* --------------------- la durée d'une recharge et le plafond (cadenceMs, packMax)

   L'anneau du kiosque tire sa part écoulée de `1 − reste ⁄ durée`, et ses
   fentes du plafond (une place par booster, s'il tient en cinq). L'une et
   l'autre sont **celles de ce joueur** : un abonné recharge plus vite et plus
   haut, et un réglage changé depuis l'administration vaut tout de suite. Une
   page qui approche la durée avec dix minutes, ou le plafond avec le
   `maxPacks` du joueur gratuit (la racine de `/state`), ment à l'abonné. */
console.log('\n  la durée d’une recharge et le plafond, dans le portefeuille');
{
  const A = await joueur('Cadence');
  const s = await call('/api/fanzzy/state', { qui: A });
  check(`/state la sert, en millisecondes (${s.json.wallet?.cadenceMs})`,
    s.json.wallet?.cadenceMs === cadence());
  check(`/state sert le plafond de ce joueur (${s.json.wallet?.packMax})`,
    s.json.wallet?.packMax === reglage('pack.max'));
  const o = await ouvrir(A);
  check('/open aussi, dans le portefeuille de sa réponse',
    Array.isArray(o.json.cards) && o.json.wallet?.cadenceMs === cadence()
    && o.json.wallet?.packMax === reglage('pack.max')
    || (console.log('        rendu :', JSON.stringify(o.json.wallet)), false));
  await poserReserve(A, reglage('pack.max'), 0);
  const plein = await call('/api/fanzzy/state', { qui: A });
  check('réserve pleine : pas de minuterie, mais la durée et le plafond restent — la même forme pour tous',
    plein.json.wallet?.nextPackInMs === null && plein.json.wallet?.cadenceMs === cadence()
    && plein.json.wallet?.packMax === reglage('pack.max'));
  try {
    poserReglages({ 'pack.regen_min': 7, 'pack.max': 5 });
    const r = await call('/api/fanzzy/state', { qui: A });
    check('un réglage changé depuis l’administration vaut tout de suite',
      r.json.wallet?.cadenceMs === 7 * 60_000);
    check('le plafond aussi (cinq places : le kiosque les dessine en fentes)',
      r.json.wallet?.packMax === 5);
  } finally {
    poserReglages({});
  }

  /* L'abonné, par le **vrai** module d'abonnement : une doublure qui dirait la
     règle à sa façon ne prouverait rien sur celle du jeu. */
  await appliquer('abonnement');
  const { createAbonnement } = await import('../src/server/abonnement/index.js');
  const abonnement = createAbonnement({ pool, requireAuth: authentifier });
  const FA = createFanzzy({ pool, requireAuth: authentifier, abonnement });
  const ABO = await joueur('Abonne');
  await abonnement.accorder(ABO);
  const wAbo = await FA.wallet(ABO);
  const wLibre = await FA.wallet(A);
  const attendue = reglage('abo.pack_regen_min') * 60_000;
  check(`un abonné reçoit sa cadence à lui (${wAbo.cadenceMs} contre ${wLibre.cadenceMs})`,
    attendue !== cadence() && wAbo.cadenceMs === attendue && wLibre.cadenceMs === cadence());
  check(`et son plafond à lui (${wAbo.packMax} contre ${wLibre.packMax})`,
    reglage('abo.pack_max') !== reglage('pack.max')
    && wAbo.packMax === reglage('abo.pack_max') && wLibre.packMax === reglage('pack.max'));
}

/* ------------------------------------------- ce qu'une ouverture a prélevé (paye)

   Le kiosque déduisait le ticket « −45 » de l'écart entre un solde relu au
   chargement et le solde rendu : un achat fait dans un autre onglet le
   faisait annoncer pour un booster gratuit. Le serveur dit ce qu'il a pris,
   et zéro quand la réserve a payé — même pour un paquet demandé à l'achat. */
console.log('\n  ce qu’une ouverture a prélevé');
{
  const P = await joueur('Paye');
  const acheter = () => call('/api/fanzzy/open', { method: 'POST', body: { set: 'TR', buy: true }, qui: P });
  const solde = (n) => pool.execute('UPDATE user_wallet SET scarves = ? WHERE user_id = ?', [n, P]);
  await solde(500);
  const gratuit = await ouvrir(P);
  check('un booster de la réserve : rien de prélevé (paye à 0, pas absent)',
    Array.isArray(gratuit.json.cards) && gratuit.json.paye === 0
    || (console.log('        rendu :', gratuit.json.paye), false));
  await solde(500);
  const demande = await acheter();
  check('demandé à l’achat, payé par la réserve : rien de prélevé non plus',
    Array.isArray(demande.json.cards) && demande.json.paye === 0
    && demande.json.wallet.scarves === 500 + demande.json.scarvesGained
    || (console.log('        rendu :', demande.json.paye, demande.json.wallet?.scarves), false));
  await poserReserve(P, 0, 0);
  await solde(500);
  const achete = await acheter();
  check(`réserve vide, à l’achat : le prix du booster (${achete.json.paye})`,
    achete.json.paye === reglage('pack.prix_echarpes')
    && achete.json.wallet.scarves === 500 - achete.json.paye + achete.json.scarvesGained);
  try {
    poserReglages({ 'pack.prix_echarpes': 60 });
    await poserReserve(P, 0, 0);
    await solde(500);
    const cher = await acheter();
    check('un prix changé depuis l’administration : le prix rendu est celui débité',
      cher.json.paye === 60 && cher.json.wallet.scarves === 440 + cher.json.scarvesGained
      || (console.log('        rendu :', cher.json.paye, cher.json.wallet?.scarves), false));
  } finally {
    poserReglages({});
  }
}

/* ------------------------------------------------------- les nouveautés (§ 2) */
console.log('\n  les nouveautés');
const W = await joueur('Neuf');
{
  const r = await call('/api/fanzzy/state', { qui: W });
  check('un joueur neuf : « rien de nouveau », et non « je ne sais pas »',
    Array.isArray(r.json.nouveautes) && r.json.nouveautes.length === 0);
}
await pool.execute('UPDATE user_wallet SET packs = 200 WHERE user_id = ?', [W]);
const FORMES = { fanzzy: /^fanzzy:[^:]+$/, etat: /^etat:[^:]+:[1-3]:[^:]+$/,
  skin: /^skin:[^:]+:[1-3]:[^:]+$/, stuff: /^stuff:[^:]+$/, action: /^action:[^:]+$/ };
const sortesDuBooster = new Set();
{
  let clesJustes = true;
  let lignesJustes = true;
  for (let i = 0; i < 20; i++) {
    const avant = (await lignesNouveautes(W)).length;
    const cartes = (await ouvrir(W, i % 2 ? 'MS' : 'TR')).json.cards ?? [];
    for (const c of cartes) {
      if (c.type === 'echarpes') { if (c.cle !== undefined) clesJustes = false; continue; }
      if (!FORMES[c.type]?.test(c.cle ?? '') || c.cle !== cleDeCarte(c)) clesJustes = false;
    }
    const neuves = cartes.filter((c) => c.new).map((c) => c.cle);
    const enBase = new Map((await lignesNouveautes(W)).map((l) => [l.cle, l.sorte]));
    if (enBase.size - avant !== neuves.length) lignesJustes = false;
    for (const k of neuves) {
      if (enBase.get(k) !== k.split(':')[0]) lignesJustes = false;
      else sortesDuBooster.add(k.split(':')[0]);
    }
  }
  check('chaque carte porte sa clé, au format du contrat — sauf les écharpes', clesJustes);
  check('une nouveauté en base par carte neuve, de la bonne sorte, et pas une de plus', lignesJustes);
}
{
  /* Un doublon n'est pas nouveau. On éteint tout, puis on ouvre jusqu'à
     tomber sur un personnage déjà possédé — en écartant le cas où le même
     booster le donne deux fois, la première neuve. */
  await eteindre(W, { tout: true });
  let vu = null;
  for (let i = 0; i < 30 && !vu; i++) {
    const cartes = (await ouvrir(W)).json.cards ?? [];
    const neuves = new Set(cartes.filter((c) => c.new).map((c) => c.cle));
    const doublon = cartes.find((c) => c.type === 'fanzzy' && !c.new && !neuves.has(c.cle));
    if (doublon) vu = { doublon, lignes: new Set((await lignesNouveautes(W)).map((l) => l.cle)) };
    else await eteindre(W, { tout: true });
  }
  check('un doublon n’écrit aucune nouveauté', Boolean(vu) && !vu.lignes.has(vu.doublon.cle));
}
{
  const r = await call('/api/fanzzy/state', { qui: W });
  const nv = r.json.nouveautes ?? [];
  const avecAge = ['etat', 'skin', 'age'];
  const avecPour = ['etat', 'skin'];
  check(`l’état sert les nouveautés au format du contrat (${nv.length})`, nv.length > 0
    && nv.every((n) => SORTES_NOUVEAUTE.includes(n.sorte) && typeof n.id === 'string' && n.id
      && n.cle.startsWith(`${n.sorte}:`)
      && (avecAge.includes(n.sorte) ? Number.isInteger(n.stade) : n.stade === undefined)
      && (avecPour.includes(n.sorte) ? typeof n.pour === 'string' : n.pour === undefined))
    || (console.log('        servi :', JSON.stringify(nv.slice(0, 3))), false));
}
{
  /* Éteindre, sous les trois formes, et seulement chez soi. */
  await eteindre(W, { tout: true });
  const W2 = await joueur('Voisin');
  const poser = (id, cles) => pool.execute(
    `INSERT INTO user_nouveautes (user_id, cle, sorte) VALUES ${cles.map(() => '(?, ?, ?)').join(', ')}`,
    cles.flatMap((k) => [id, k, k.split(':')[0]]));
  await poser(W, ['stuff:essai-a', 'stuff:essai-b', 'etat:XX1:1:joie', 'etat:XX1:2:depit', 'action:essai-c']);
  await poser(W2, ['stuff:essai-a']);
  let v = await eteindre(W, { cles: ['stuff:essai-a', 'action:essai-c', 'stuff:jamais-vue'] });
  check('par clés : il en reste trois', v.status === 200 && v.json.restantes === 3);
  v = await eteindre(W, { sorte: 'etat' });
  check('par sorte : il en reste une', v.json.restantes === 1
    && (await lignesNouveautes(W)).map((l) => l.cle).join() === 'stuff:essai-b');
  v = await eteindre(W, { tout: true });
  check('tout : zéro', v.json.restantes === 0 && (await lignesNouveautes(W)).length === 0);
  check('et celles d’un autre joueur sont intactes', (await lignesNouveautes(W2)).length === 1);

  const invalides = [{}, [], { cles: 'stuff:a' }, { sorte: 'tenue' }, { tout: false }, { tout: 'oui' },
    { cles: Array.from({ length: 201 }, (_, i) => `stuff:x${i}`) }, { cles: ['stuff:a'], tout: true },
    { cles: [42] }, { cles: [''] }];
  const rendus = [];
  for (const b of invalides) rendus.push(await eteindre(W, b));
  check(`un corps invalide : 400 nommé, sous ses ${invalides.length} formes`,
    rendus.every((x) => x.status === 400 && x.json.error === 'fanzzy.error.vu_invalide')
    || (console.log('        rendus :', rendus.map((x) => `${x.status}:${x.json.error}`).join(' ')), false));
  check('deux cents clés passent encore', (await eteindre(W, {
    cles: Array.from({ length: 200 }, (_, i) => `stuff:x${i}`) })).status === 200);
}
{
  /* Deux cents au plus, les plus récentes d'abord, et la purge à soixante
     jours. Semé en SQL, comme le serveur date ses lignes. */
  const n = 230;
  const k = Array.from({ length: n }, (_, i) => i);
  await pool.execute(
    `INSERT INTO user_nouveautes (user_id, cle, sorte, got_at) VALUES ${
      k.map(() => '(?, ?, \'stuff\', NOW(3) - INTERVAL ? SECOND)').join(', ')}`,
    k.flatMap((i) => [W, `stuff:pile-${i}`, i]));
  await pool.execute(
    `INSERT INTO user_nouveautes (user_id, cle, sorte, got_at) VALUES
       (?, 'stuff:vieille-1', 'stuff', NOW(3) - INTERVAL 61 DAY),
       (?, 'stuff:vieille-2', 'stuff', NOW(3) - INTERVAL 61 DAY),
       (?, 'stuff:presque', 'stuff', NOW(3) - INTERVAL 59 DAY)`, [W, W, W]);
  const nv = (await call('/api/fanzzy/state', { qui: W })).json.nouveautes ?? [];
  check(`deux cents au plus (${nv.length})`, nv.length === 200);
  check('les plus récentes d’abord', nv[0]?.cle === 'stuff:pile-0' && nv[199]?.cle === 'stuff:pile-199'
    && nv.every((x, i) => x.cle === `stuff:pile-${i}`));
  const reste = new Set((await lignesNouveautes(W)).map((l) => l.cle));
  check('au-delà de soixante jours, la lecture les purge',
    !reste.has('stuff:vieille-1') && !reste.has('stuff:vieille-2'));
  check('en deçà, elles restent, même hors de la liste servie',
    reste.has('stuff:presque') && reste.has('stuff:pile-229'));
  check('« restantes » compte comme la liste sert : deux cents au plus',
    (await eteindre(W, { cles: [] })).json.restantes === 200);
  await eteindre(W, { tout: true });
}

/* ------------------------------------- chaque chemin de la liste exportée

   La liste vient du module, pas d'un motif lu dans son source. Chaque chemin
   qui s'y déclare est éprouvé pour de vrai ; un chemin que la suite ne sait
   pas éprouver la fait rougir au lieu de passer en silence. */
console.log('\n  les chemins qui écrivent une nouveauté');
const base1W = DEX.find((f) => f.stage === 1 && f.evo);
{
  const nouvelles = async (id, faire) => {
    const avant = new Set((await lignesNouveautes(id)).map((l) => l.cle));
    await faire();
    return (await lignesNouveautes(id)).filter((l) => !avant.has(l.cle));
  };
  const dansUneTransaction = async (fn) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await fn(conn);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  };
  const E = await joueur('Chemins');
  await pool.execute('UPDATE user_wallet SET packs = 200, scarves = 1000 WHERE user_id = ?', [E]);
  const EPREUVES = {
    /* Les cinq sortes ne tombent pas toutes au premier booster : on ouvre
       jusqu'à les avoir vues, en partant de ce que les vingt d'en haut ont
       déjà montré. */
    openPack: async (sortes) => {
      const vues = new Set(sortesDuBooster);
      for (let i = 0; i < 80 && sortes.some((s) => !vues.has(s)); i++) {
        for (const l of await nouvelles(E, () => ouvrir(E, i % 2 ? 'MS' : 'TR'))) vues.add(l.sorte);
      }
      return vues;
    },
    evolve: async () => {
      await pool.execute(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?, ?, 1, 1)
        ON DUPLICATE KEY UPDATE stage = 1`, [E, base1W.id]);
      const l = await nouvelles(E, () => call('/api/fanzzy/evolve', {
        method: 'POST', body: { id: base1W.id }, qui: E }));
      return new Set(l.filter((x) => x.cle === `age:${base1W.id}:2`).map((x) => x.sorte));
    },
    remettreStuff: async () => {
      const [ont] = await pool.execute('SELECT stuff_id FROM user_stuff WHERE user_id = ?', [E]);
      const piece = STUFF.find((s) => !ont.some((o) => o.stuff_id === s.id));
      const l = await nouvelles(E, () => dansUneTransaction((c) => F.remettreStuff(c, E, piece.id)));
      /* Et un exemplaire de plus n'est pas une nouveauté : on éteint, puis
         on remet la même pièce. */
      await eteindre(E, { cles: [`stuff:${piece.id}`] });
      const doublon = await nouvelles(E, () => dansUneTransaction((c) => F.remettreStuff(c, E, piece.id)));
      check('un exemplaire de plus d’une pièce déjà à soi n’est pas nouveau', doublon.length === 0);
      return new Set(l.filter((x) => x.cle === `stuff:${piece.id}`).map((x) => x.sorte));
    },
    remettreTenue: async () => {
      const [[f]] = await pool.execute('SELECT stage FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?',
        [E, base1W.id]);
      const [ont] = await pool.execute(
        'SELECT skin_id FROM user_skins WHERE user_id = ? AND fanzzy_id = ? AND stage = ?',
        [E, base1W.id, f.stage]);
      const tenue = tenuesPubliees().find((t) => t.id !== 'base' && !ont.some((o) => o.skin_id === t.id));
      if (!tenue) return new Set();
      const l = await nouvelles(E, () => dansUneTransaction((c) => F.remettreTenue(c, E,
        { tenue: tenue.id, fanzzy: base1W.id, stage: f.stage })));
      return new Set(l.filter((x) => x.cle === `skin:${base1W.id}:${f.stage}:${tenue.id}`)
        .map((x) => x.sorte));
    },
  };
  for (const [chemin, sortes] of Object.entries(CHEMINS_NOUVEAUTES.ecrivent)) {
    if (!EPREUVES[chemin]) {
      check(`« ${chemin} » se déclare, et la suite ne sait pas l’éprouver`, false);
      continue;
    }
    const vues = await EPREUVES[chemin](sortes);
    check(`« ${chemin} » écrit ${sortes.join(', ')}`, sortes.every((s) => vues.has(s))
      || (console.log('        vu :', [...vues].join(', ') || 'rien'), false));
  }
  check('ceux qui n’en écrivent pas disent pourquoi',
    Object.values(CHEMINS_NOUVEAUTES.nEcriventPas).every((r) => typeof r === 'string' && r.length > 10));
  const nv = (await call('/api/fanzzy/state', { qui: E })).json.nouveautes ?? [];
  check('l’âge gagné est servi avec son stade',
    nv.some((x) => x.sorte === 'age' && x.id === base1W.id && x.stade === 2 && x.pour === undefined));
}

/* -------------------------------------------------- les compteurs du jour */
console.log('\n  les compteurs du jour');
{
  const G = await joueur('Compte');
  await pool.execute('UPDATE user_wallet SET packs = 10, scarves = 1000 WHERE user_id = ?', [G]);
  await ouvrir(G);
  await ouvrir(G);
  check('deux ouvertures : booster = 2', await compteur(G, 'booster') === 2);
  await pool.execute(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?, ?, 1, 1)
    ON DUPLICATE KEY UPDATE stage = 1`, [G, base1W.id]);
  const ev = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: base1W.id }, qui: G });
  check('une évolution : evolution = 1', ev.json.stade === 2 && await compteur(G, 'evolution') === 1);
  const refus = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: 'X-INEXISTANT' }, qui: G });
  check('une évolution refusée ne compte pas', refus.json.error && await compteur(G, 'evolution') === 1);

  /* Le jour est celui de la base, `CURDATE()`, jamais un jour fabriqué en
     JavaScript : on fige l'horloge de la base sur une autre date que celle
     de Node, et la ligne doit porter la date de la base. */
  const H = await joueur('Minuit');
  await figerHorloge(pool, '2026-10-25 00:30:00');
  try {
    const [[t]] = await pool.query(`SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS j`);
    check('contrôle du contrôle : la base est au 25 octobre', t.j === '2026-10-25');
    await ouvrir(H);
    const [l] = await pool.query(
      `SELECT DATE_FORMAT(jour, '%Y-%m-%d') AS j, n FROM compteurs_jour WHERE user_id = ? AND cle = 'booster'`, [H]);
    check('le booster compte au jour de la base, pas à celui de Node',
      l.length === 1 && l[0].j === '2026-10-25' && Number(l[0].n) === 1
      || (console.log('        lignes :', JSON.stringify(l)), false));
  } finally {
    await figerHorloge(pool, null);
  }
}

/* ---------------------------------------- sans les tables du quotidien

   Une écriture annexe ne fait jamais échouer l'action, et elle le dit. */
console.log('\n  sans sql/quotidien.sql');
{
  const J = await joueur('Sans');
  await pool.execute('UPDATE user_wallet SET packs = 10, scarves = 1000 WHERE user_id = ?', [J]);
  const journal = [];
  const erreur = console.error;
  console.error = (...a) => { journal.push(a.map(String).join(' ')); };
  try {
    await pool.query('DROP TABLE user_nouveautes');
    await pool.query('DROP TABLE compteurs_jour');
    const o = await ouvrir(J);
    check('le booster s’ouvre quand même', o.json.cards?.length === 5);
    await pool.execute(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?, ?, 1, 1)
      ON DUPLICATE KEY UPDATE stage = 1`, [J, base1W.id]);
    const ev = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: base1W.id }, qui: J });
    check('l’évolution aussi', ev.json.stade === 2);
    const s = await call('/api/fanzzy/state', { qui: J });
    check('l’état ne dit rien des nouveautés : il ne sait pas',
      s.status === 200 && !('nouveautes' in s.json) && Boolean(s.json.wallet));
    const v = await eteindre(J, { tout: true });
    check('éteindre ne lève pas', v.status === 200 && v.json.restantes === 0);
  } finally {
    console.error = erreur;
  }
  const nomme = (table) => journal.some((l) => l.includes(table) && l.includes('sql/quotidien.sql'));
  check('le journal nomme le fichier, pour le compteur et pour les nouveautés',
    nomme('compteurs_jour') && nomme('user_nouveautes')
    || (console.log('        journal :', journal.join(' | ')), false));
  check('et ne le répète pas à chaque booster',
    journal.filter((l) => l.includes('compteurs_jour')).length === 1);
  await appliquer('quotidien');
}

/* ===================== le monde de la production : LA REPRISE seule

   Sans saison, le code tourne tout ouvert, et la collection paraît sans fin.
   La production n'a qu'une série ouverte : c'est là que les crans et la série
   complète se lisent comme le joueur les verra. */
console.log('\n  LA REPRISE seule, comme en production');
await pool.execute(`INSERT INTO saisons (numero, nom, series, lancee_a) VALUES (1, 'La reprise', ?, NOW(3))`,
  [JSON.stringify(['RP'])]);
await moduleSaisons.chargerSaisons(pool);
await chargerSeries(pool);
const RP = obtenables().filter((f) => f.set === 'RP');
check(`seule LA REPRISE est ouverte (${RP.length} personnages)`,
  RP.length > 1 && obtenables().every((f) => f.set === 'RP'));

/* ------------------------------------- la progression des séries (§ 2.3) */
console.log('\n  la ligne de la série, dans la réponse du booster');
{
  const X = await joueur('Serie');
  await pool.execute('UPDATE user_wallet SET packs = 50 WHERE user_id = ?', [X]);
  let precedent = 0;
  let justes = true;
  for (let i = 0; i < 6; i++) {
    const s = (await ouvrir(X, 'RP')).json.series;
    const [poss] = await pool.execute('SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?', [X]);
    const enBase = RP.filter((f) => poss.some((p) => p.fanzzy_id === f.id)).length;
    if (!Array.isArray(s) || s.length !== 1 || s[0].id !== 'RP' || s[0].total !== RP.length
      || s[0].avant !== precedent || s[0].apres !== enBase || s[0].complete !== false) {
      justes = false;
      console.log('        series :', JSON.stringify(s), '· en base :', enBase, '· avant attendu :', precedent);
    }
    precedent = s?.[0]?.apres ?? precedent;
  }
  check('avant, après et total exacts, booster après booster', justes);
}
{
  /* La série complétée : tout sauf une commune, puis on ouvre jusqu'à ce
     qu'elle tombe. Une chance sur vingt environ par booster ; trois cents
     essais laissent une probabilité d'échec de l'ordre de 1e-7. */
  const Y = await joueur('Complete');
  const manquant = RP.find((f) => f.rar === 'commune');
  for (const f of RP) {
    if (f.id !== manquant.id) {
      await pool.execute('INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)', [Y, f.id]);
    }
  }
  await pool.execute('UPDATE user_wallet SET packs = 400 WHERE user_id = ?', [Y]);
  const completes = [];
  let suivant = null;
  for (let i = 0; i < 300 && !suivant; i++) {
    const s = (await ouvrir(Y, 'RP')).json.series?.[0];
    if (completes.length) suivant = s;
    else if (s?.complete) completes.push(s);
  }
  check(`le booster qui complète le dit (${RP.length - 1} → ${RP.length} sur ${RP.length})`,
    completes.length === 1 && completes[0].avant === RP.length - 1
    && completes[0].apres === RP.length && completes[0].total === RP.length
    || (console.log('        vu :', JSON.stringify(completes)), false));
  check('et celui d’après ne le redit pas',
    suivant?.complete === false && suivant.avant === RP.length && suivant.apres === RP.length);
}

/* --------------------------------------- les paliers de collection (§ 5.1) */
console.log('\n  les paliers de collection');
const GAIN = (echarpes, packs) => ({ echarpes, packs, xp: 0, tampons: 0 });
const memeGain = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const palier = (qui, body) => call('/api/fanzzy/palier', { method: 'POST', body, qui });
const biblio = async (qui) => (await call('/api/fanzzy/bibliotheque', { qui })).json;
const crans = async (id) => (await pool.execute(
  `SELECT cle FROM recompenses WHERE user_id = ? AND source = 'cran'`, [id]))[0]
  .map((l) => l.cle).sort((a, b) => Number(a) - Number(b));

/**
 * Amène un joueur à exactement `n` objets gagnés : des pièces, puis des
 * personnages de LA REPRISE — **tous sauf le dernier**, pour que la série
 * complète ne vienne pas se mêler aux crans qu'on éprouve —, puis des états
 * de ces personnages. Écrit comme le jeu écrit, et vérifié par la
 * bibliothèque elle-même : c'est son compte qui fait foi.
 */
async function atteindre(id, n) {
  const b = await F.bibliotheque(id);
  let g = b.total.gagnes;
  if (g > n) throw new Error(`atteindre : ${g} objets déjà, plus que ${n}`);
  const ajouter = async (sql, params) => {
    if (g >= n) return;
    const [r] = await pool.execute(sql, params);
    if (r.affectedRows) g++;
  };
  for (const s of b.types.stuff.items.filter((x) => !x.possede)) {
    await ajouter('INSERT IGNORE INTO user_stuff (user_id, stuff_id, copies) VALUES (?, ?, 1)', [id, s.id]);
  }
  for (const f of RP.slice(0, -1)) {
    await ajouter('INSERT IGNORE INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)', [id, f.id]);
  }
  const [miens] = await pool.execute('SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?', [id]);
  for (const f of RP.filter((x) => miens.some((m) => m.fanzzy_id === x.id))) {
    for (const e of ['joie', 'depit', 'pousse', 'colere']) {
      await ajouter('INSERT IGNORE INTO user_etats (user_id, fanzzy_id, stage, etat) VALUES (?, ?, 1, ?)',
        [id, f.id, e]);
    }
  }
  const fin = (await F.bibliotheque(id)).total.gagnes;
  if (fin !== n) throw new Error(`atteindre : ${fin} objets au lieu de ${n}`);
}

const P = await joueur('Cran');
{
  const b = await biblio(P);
  const p = b.paliers;
  check('la bibliothèque sert ses paliers', Boolean(p));
  /* Le total de la même réponse, tenues mises à part : elles se
     collectionnent, elles ne paient pas (voir « ce que l'abonnement ouvre ne
     paie pas », plus bas). */
  check('« gagnes » et « possibles » : le total de la même réponse, sans les tenues',
    p?.gagnes === b.total?.gagnes - b.types?.tenues?.gagnes
    && p.possibles === b.total.possibles - b.types.tenues.possibles
    && b.types.tenues.possibles > 0
    || (console.log('        paliers :', p?.gagnes, '/', p?.possibles, '· total :',
      JSON.stringify(b.total), '· tenues :', JSON.stringify(b.types?.tenues)), false));
  check('un cran tous les 25 objets', p?.cran === 25);
  check(`rien à réclamer à ${b.total?.gagnes} objets`, Array.isArray(p?.aReclamer) && p.aReclamer.length === 0);
  check('le prochain cran est chiffré, avec son gain',
    p?.prochain?.a === 25 && p.prochain.manque === 25 - b.total.gagnes
    && memeGain(p.prochain.gain, GAIN(25, 0))
    || (console.log('        prochain :', JSON.stringify(p?.prochain)), false));
  check('une entrée par série ouverte, et une seule',
    p?.series?.length === 1 && p.series[0].id === 'RP' && p.series[0].total === RP.length
    && p.series[0].possedes === 0 && p.series[0].etat === 'a_venir'
    && memeGain(p.series[0].gain, GAIN(100, 1))
    || (console.log('        séries :', JSON.stringify(p?.series)), false));
}
await atteindre(P, 63);
await pool.execute(`INSERT INTO recompenses (user_id, source, cle, echarpes) VALUES (?, 'cran', '25', 25),
  (?, 'cran', '50', 25)`, [P, P]);
{
  const p = (await biblio(P)).paliers;
  check('63 objets, 25 et 50 payés : rien à réclamer', p?.gagnes === 63 && p.aReclamer.length === 0
    || (console.log('        à réclamer :', JSON.stringify(p?.aReclamer)), false));
  check('le prochain est 75, à 12 objets', p?.prochain?.a === 75 && p.prochain.manque === 12);
}
poserReglages({ 'collection.cran': 20 });
try {
  const p = (await biblio(P)).paliers;
  check('le cran passe à 20 : seul 60 est payable',
    JSON.stringify(p?.aReclamer?.map((x) => x.cle)) === '["60"]'
    || (console.log('        à réclamer :', JSON.stringify(p?.aReclamer?.map((x) => x.cle))), false));
  check('le prochain est 80, le quatrième cran, avec son booster',
    p?.prochain?.a === 80 && p.prochain.manque === 17 && memeGain(p.prochain.gain, GAIN(25, 1)));
  const avant = await bourse(P);
  const r40 = await palier(P, { sorte: 'cran', cle: '40' });
  check('40, couvert par le 50 payé, ne se paie pas', r40.json.verse === false && r40.json.raison === 'inconnu'
    || (console.log('        rendu :', JSON.stringify(r40.json)), false));
  const r = await palier(P, { sorte: 'cran', cle: '60' });
  check('60 se paie, au montant du réglage', r.json.verse === true && memeGain(r.json.gain, GAIN(25, 0))
    && r.json.wallet?.scarves === avant.scarves + 25 && (await bourse(P)).scarves === avant.scarves + 25
    || (console.log('        rendu :', JSON.stringify(r.json)), false));
  check('la réponse porte les paliers à jour',
    Array.isArray(r.json.paliers?.aReclamer) && !r.json.paliers.aReclamer.some((x) => x.sorte === 'cran'));
  check('sans niveau quand le gain ne porte pas d’XP', !('niveau' in r.json));
  const re = await palier(P, { sorte: 'cran', cle: '60' });
  check('une seconde fois : déjà récupéré', re.json.verse === false && re.json.raison === 'deja'
    && (await bourse(P)).scarves === avant.scarves + 25);
} finally {
  poserReglages({});
}
{
  /* Le compte baisse — huit pièces retirées : rien n'est repris, et le
     prochain cran est au-dessus du plus haut payé (60), pas du compte. */
  const [st] = await pool.execute('SELECT stuff_id FROM user_stuff WHERE user_id = ? ORDER BY stuff_id LIMIT 8',
    [P]);
  for (const s of st) await pool.execute('DELETE FROM user_stuff WHERE user_id = ? AND stuff_id = ?', [P, s.stuff_id]);
  const avant = await bourse(P);
  const b = await biblio(P);
  check(`le compte baisse (${b.total.gagnes}) : rien n’est repris`, b.total.gagnes === 55
    && (await crans(P)).join() === '25,50,60' && (await bourse(P)).scarves === avant.scarves);
  check('et rien n’est dû : le prochain cran passe le plus haut payé',
    b.paliers.aReclamer.length === 0 && b.paliers.prochain?.a === 75 && b.paliers.prochain.manque === 20);
}
{
  const Q = await joueur('Deux');
  await atteindre(Q, 30);
  const avant = await bourse(Q);
  const deux = await enParallele(2, () => palier(Q, { sorte: 'cran', cle: '25' }));
  check('deux réclamations simultanées : un versement, un « déjà »',
    deux.filter((x) => x.json.verse === true).length === 1
    && deux.filter((x) => x.json.raison === 'deja').length === 1
    || (console.log('        rendus :', deux.map((x) => JSON.stringify(x.json)).join(' | ')), false));
  check('crédité une fois, exactement', (await bourse(Q)).scarves === avant.scarves + 25);
  await atteindre(Q, 80);
  const avant2 = await bourse(Q);
  const dix = await enParallele(10, () => palier(Q, { tout: true }));
  check('dix « tout récupérer » simultanés : 50 et 75, une fois chacun',
    (await crans(Q)).join() === '25,50,75' && (await bourse(Q)).scarves === avant2.scarves + 50
    || (console.log('        crans :', (await crans(Q)).join(), '·', (await bourse(Q)).scarves - avant2.scarves), false));
  check('et aucune réponse n’est une erreur', dix.every((x) => x.status === 200));
}
{
  const R = await joueur('Ordre');
  await atteindre(R, 55);
  const r = await palier(R, { sorte: 'cran', cle: '50' });
  check('récupérer 50 avant 25 verse les deux, dans l’ordre',
    r.json.verse === true && memeGain(r.json.gain, GAIN(50, 0)) && (await crans(R)).join() === '25,50'
    || (console.log('        rendu :', JSON.stringify(r.json), '· crans :', (await crans(R)).join()), false));
  const loin = await palier(R, { sorte: 'cran', cle: '100' });
  check('un cran pas encore atteint : « incomplet », et rien d’autre de versé',
    loin.json.verse === false && loin.json.raison === 'incomplet' && (await crans(R)).join() === '25,50');
}
{
  const S = await joueur('Quatre');
  await atteindre(S, 100);
  const max = reglage('pack.max');
  await poserReserve(S, max - 1, cadence() + 1000);
  /* Le cran 100 seul : il verse aussi les trois d'en dessous, et c'est lui
     qui porte le booster. */
  const r = await palier(S, { sorte: 'cran', cle: '100' });
  check('récupérer 100 : quatre crans, dont un booster',
    r.json.verse === true && memeGain(r.json.gain, GAIN(100, 1)) && (await crans(S)).join() === '25,50,75,100'
    || (console.log('        rendu :', JSON.stringify(r.json)), false));
  check(`la recharge due passe avant le booster offert : ${max - 1} → ${max + 1}`,
    r.json.wallet?.packs === max + 1 && (await bourse(S)).packs === max + 1);
}
{
  const T = await joueur('Pleine');
  for (const f of RP) {
    await pool.execute('INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)', [T, f.id]);
  }
  const b = await biblio(T);
  const s = b.paliers?.series?.[0];
  check('toute la série possédée : prête', s?.etat === 'pret' && s.possedes === RP.length
    && b.paliers.aReclamer.some((x) => x.sorte === 'serie' && x.cle === 'RP' && memeGain(x.gain, GAIN(100, 1))));
  const avant = await bourse(T);
  const r = await palier(T, { sorte: 'serie', cle: 'RP' });
  check('la série complète se paie : 100 écharpes et un booster',
    r.json.verse === true && memeGain(r.json.gain, GAIN(100, 1))
    && r.json.wallet?.scarves === avant.scarves + 100 && r.json.wallet.packs === avant.packs + 1
    || (console.log('        rendu :', JSON.stringify(r.json)), false));
  check('puis réclamée', r.json.paliers?.series?.[0]?.etat === 'reclame'
    && !r.json.paliers.aReclamer.some((x) => x.sorte === 'serie'));
  check('une seconde fois : déjà', (await palier(T, { sorte: 'serie', cle: 'RP' })).json.raison === 'deja');
  check('une série fermée, ou qui n’existe pas : inconnue',
    (await palier(T, { sorte: 'serie', cle: 'TR' })).json.raison === 'inconnu'
    && (await palier(T, { sorte: 'serie', cle: 'ZZ' })).json.raison === 'inconnu');
  const X2 = await joueur('Partiel');
  await pool.execute('INSERT INTO user_fanzzy (user_id, fanzzy_id, copies) VALUES (?, ?, 1)', [X2, RP[0].id]);
  check('une série incomplète : pas encore', (await palier(X2, { sorte: 'serie', cle: 'RP' })).json.raison === 'incomplet');

  /* Le montant ne vient jamais du corps : un client qui en glisse un reçoit
     celui du réglage (T1). */
  const avantT = await bourse(T);
  const t1 = await palier(T, { sorte: 'cran', cle: '25', echarpes: 9999, gain: { echarpes: 9999 } });
  check('un montant glissé dans le corps est ignoré', t1.json.verse === true
    && memeGain(t1.json.gain, GAIN(25, 0)) && (await bourse(T)).scarves === avantT.scarves + 25);

  /* L'interrupteur, avec quelque chose de dû : sans cela, « rien versé » ne
     dirait rien. */
  await atteindre(T, 50);
  check('le cran 50 est dû', (await biblio(T)).paliers?.aReclamer?.some((x) => x.cle === '50'));
  poserReglages({ 'collection.actif': false });
  try {
    const [[n0]] = await pool.execute('SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?', [T]);
    const coupe = await biblio(T);
    const refus = await palier(T, { tout: true });
    const [[n1]] = await pool.execute('SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ?', [T]);
    check('interrupteur coupé : pas de paliers servis', coupe.total && !('paliers' in coupe));
    check('et toute réclamation refuse, sans rien verser',
      refus.json.verse === false && refus.json.raison === 'inactif' && Number(n1.n) === Number(n0.n));
  } finally {
    poserReglages({});
  }

  const invalides = [{}, [], { sorte: 'cran' }, { sorte: 'cran', cle: 'abc' }, { sorte: 'cran', cle: 25 },
    { sorte: 'cran', cle: '0' }, { sorte: 'autre', cle: '1' }, { tout: 1 },
    { tout: true, sorte: 'cran', cle: '25' }, { sorte: 'serie', cle: 'R P' }];
  const rendus = [];
  for (const b2 of invalides) rendus.push(await palier(T, b2));
  check(`un corps invalide : 400 nommé, sous ses ${invalides.length} formes`,
    rendus.every((x) => x.status === 400 && x.json.error === 'fanzzy.error.palier_requete')
    || (console.log('        rendus :', rendus.map((x) => `${x.status}:${x.json.error}`).join(' ')), false));
}
{
  /* **Ce que l'abonnement ouvre ne paie pas.** Un abonné porte n'importe
     quelle tenue publiée, et la porter l'inscrit dans `user_skins` comme une
     tenue gagnée : il la garde à l'échéance (`wearSkin`). Comptées dans les
     crans, les tenues changeaient l'abonnement, payé en argent réel, en
     écharpes et en boosters (`CONTRATS.md`, R9). Le chemin est le vrai — la
     route de l'avatar, sous un abonnement simulé : une ligne posée à la main
     prouverait la règle du compte, pas que le geste de l'abonné y tombe. */
  console.log('\n  ce que l’abonnement ouvre ne paie pas');
  const O = createOnboarding({ pool, requireAuth: authentifier,
    abonnement: { estAbonne: async () => true, clubsEnPlus: () => 0 } });
  app.use('/api/onboarding', O.router);
  const tenues = tenuesPubliees().filter((t) => t.id !== 'base');
  const cran = reglage('collection.cran');
  /* Assez de personnages pour que leurs tenues passent deux crans, et jamais
     toute la série : la série complète ne doit pas se mêler aux crans. */
  const habilles = [];
  let attendu = 0;
  for (const f of RP.slice(0, -1)) {
    if (attendu >= 2 * cran) break;
    habilles.push(f);
    attendu += lignee(f.id).length * tenues.length;
  }
  /* Deux joueurs aux mêmes personnages, à tous leurs âges : l'abonné, et un
     joueur gratuit qui ne porte rien. */
  const A = await joueur('Abonne');
  const L = await joueur('Libre');
  for (const id of [A, L]) {
    for (const f of habilles) {
      await pool.execute('INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?, ?, 1, ?)',
        [id, f.id, lignee(f.id).length]);
    }
  }
  const avant = await biblio(A);
  const bourseAvant = await bourse(A);
  const refus = [];
  for (const f of habilles) {
    for (let s = 1; s <= lignee(f.id).length; s++) {
      for (const t of tenues) {
        const r = await call('/api/onboarding/avatar', { method: 'POST', qui: A,
          body: { fanzzyId: f.id, stade: s, skinId: t.id } });
        if (r.status !== 200) refus.push(`${f.id}:${s}:${t.id} → ${r.status} ${r.json.error ?? ''}`);
      }
    }
  }
  const apres = await biblio(A);
  /* Le contrôle du contrôle : sans tenues inscrites, « rien ne bouge »
     passerait sans rien prouver. */
  check(`l’abonné a pris ${attendu} tenues en les portant, et la jauge les montre`,
    tenues.length > 0 && attendu >= 2 * cran && refus.length === 0
    && apres.types?.tenues?.gagnes === avant.types.tenues.gagnes + attendu
    && apres.total.gagnes === avant.total.gagnes + attendu
    || (console.log('        tenues :', JSON.stringify(avant.types?.tenues), '→', JSON.stringify(apres.types?.tenues),
      '· refus :', refus.slice(0, 3).join(' | ')), false));
  check('ses crans ne bougent pas : ni compte, ni cran à réclamer, ni prochain',
    Boolean(apres.paliers) && JSON.stringify(apres.paliers) === JSON.stringify(avant.paliers)
    || (console.log('        avant :', JSON.stringify(avant.paliers), '\n        après :', JSON.stringify(apres.paliers)), false));
  /* Le recompte du versement, et non la seule jauge : un client qui demande
     un seuil que seules ses tenues atteignent est refusé. */
  const seuil = Math.floor(apres.total.gagnes / cran) * cran;
  const demande = await palier(A, { sorte: 'cran', cle: String(seuil) });
  const bourseApres = await bourse(A);
  check(`le cran ${seuil}, que seules ses tenues atteignent, ne se paie pas`,
    seuil > apres.paliers?.gagnes && demande.json.verse === false && demande.json.raison === 'incomplet'
    && (await crans(A)).length === 0
    && bourseApres.scarves === bourseAvant.scarves && bourseApres.packs === bourseAvant.packs
    || (console.log('        rendu :', JSON.stringify(demande.json)), false));
  check('abonné habillé et joueur gratuit, mêmes personnages : mêmes paliers',
    JSON.stringify(apres.paliers) === JSON.stringify((await biblio(L)).paliers));
}

/* ----------------------------------------- la saison en cours, servie (§ 7.1)

   `/dex` et `/state` servent la saison en cours avec sa fin datée, et rien
   de plus : le carnet propre que `saisonEnCours()` porte pour le quotidien
   n'a rien à faire dans une réponse publique mise en cache. */
console.log('\n  la saison en cours, telle que /dex et /state la servent');
{
  const { CARNET_DEFAUT } = await import('../src/shared/saison.js');
  await pool.execute(
    `UPDATE saisons SET carnet = ?, fin_le = CURDATE() + INTERVAL 9 DAY WHERE numero = 1`,
    [JSON.stringify(CARNET_DEFAUT)]);
  await moduleSaisons.chargerSaisons(pool);
  try {
    /* Le contrôle du contrôle : sans carnet dans la saison du module, « pas
       de carnet servi » passerait sans rien prouver. */
    check('le module des saisons porte bien le carnet propre de la saison',
      Array.isArray(moduleSaisons.saisonEnCours()?.carnet));
    const servies = [['/dex', (await call('/api/fanzzy/dex')).json.saison],
      ['/state', (await call('/api/fanzzy/state')).json.saison]];
    for (const [route, s] of servies) {
      check(`${route} : la saison en cours, sans son carnet`,
        s?.numero === 1 && s.nom === 'La reprise' && !('carnet' in s)
        || (console.log('        saison :', JSON.stringify(s)), false));
      /* Neuf jours après aujourd'hui : dix jours de jeu, aujourd'hui compris
         (`CONTRATS.md`, § 7.1). La durée, elle, compte jusqu'à la fin du
         dernier jour : entre neuf et dix jours, à une heure près pour un
         changement d'heure. */
      check(`${route} : avec la fin du contrat (${s?.fin} · ${s?.joursRestants} jours)`,
        /^\d{4}-\d{2}-\d{2}$/.test(s?.fin ?? '') && s.joursRestants === 10 && s.finie === false
        && Number.isInteger(s.finDansMs) && s.finDansMs > 9 * 86_400_000 - 3_600_000
        && s.finDansMs <= 10 * 86_400_000 + 3_600_000);
    }
  } finally {
    await pool.execute('UPDATE saisons SET carnet = NULL, fin_le = NULL WHERE numero = 1');
    await moduleSaisons.chargerSaisons(pool);
  }
  const sansDate = (await call('/api/fanzzy/dex')).json.saison;
  check('sans date de fin : ni fin, ni durée, ni jours, et pas finie',
    sansDate?.finie === false && !('fin' in sansDate) && !('finDansMs' in sansDate)
    && !('joursRestants' in sansDate));
}

/* --------------------------------------------- la saison annoncée (§ 7.2) */
console.log('\n  la saison annoncée');
{
  const d = (await call('/api/fanzzy/dex')).json;
  check('sans annonce : ni « prochaine », ni série marquée',
    !('prochaine' in d) && d.sets.every((s) => !('prochaine' in s)));
  /* Livrée par le périmètre des saisons : son absence n'est plus une étape
     du chantier, c'est une régression — et un contrôle qui se saute en
     silence rétrécit sans que personne le voie. */
  check('saisonProchaine() et seriesAnnoncees() sont livrées par le module des saisons',
    typeof moduleSaisons.saisonProchaine === 'function'
    && typeof moduleSaisons.seriesAnnoncees === 'function');
  if (typeof moduleSaisons.saisonProchaine === 'function') {
    /* LA REPRISE y figure aussi : déjà ouverte, elle ne « s'ouvre » pas à la
       saison 2, et ne doit pas porter son numéro. C'est la règle du périmètre
       des saisons (`seriesAnnoncees`), que ce module emploie sans la refaire. */
    await pool.execute(`INSERT INTO saisons (numero, nom, series, ouvre_le)
      VALUES (2, 'La trêve', ?, CURDATE() + INTERVAL 3 DAY)`, [JSON.stringify(['HC', 'RP'])]);
    await moduleSaisons.chargerSaisons(pool);
    const a = (await call('/api/fanzzy/dex')).json;
    check('une saison dont l’ouverture est posée est annoncée',
      a.prochaine?.numero === 2 && a.prochaine.nom === 'La trêve' && /^\d{4}-\d{2}-\d{2}$/.test(a.prochaine.ouvre ?? '')
      || (console.log('        prochaine :', JSON.stringify(a.prochaine)), false));
    check('avec les seuls champs du contrat', Object.keys(a.prochaine ?? {})
      .every((k) => ['id', 'numero', 'nom', 'ouvre', 'ouvreDansMs', 'joursAvant'].includes(k)));
    check('et ses séries portent son numéro, elles seules',
      a.sets.find((s) => s.id === 'HC')?.prochaine === 2 && a.sets.filter((s) => 'prochaine' in s).length === 1);
    await pool.execute(`UPDATE saisons SET ouvre_le = NULL WHERE numero = 2`);
    await moduleSaisons.chargerSaisons(pool);
    const b = (await call('/api/fanzzy/dex')).json;
    check('sans date posée, plus rien n’est promis', !('prochaine' in b) && b.sets.every((s) => !('prochaine' in s)));
  } else {
    console.log('  --   saisonProchaine() manque au module des saisons : '
      + 'l’annonce elle-même ne peut pas être éprouvée');
  }
}

/* On rouvre tout : les autres suites partagent cette base. */
await pool.execute('DELETE FROM saisons');
await moduleSaisons.chargerSaisons(pool);
await chargerSeries(pool);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end();
/* `process.exitCode` et non `process.exit()` : la sortie forcée coupe les
   fermetures du pool en vol et fait échouer la suite au hasard sous Windows
   (`ETAT.md`, § 2). */
http.closeAllConnections?.();
await new Promise((r) => http.close(r));
process.exitCode = failures ? 1 : 0;
