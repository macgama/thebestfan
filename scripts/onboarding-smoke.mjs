/** Test de l'inscription, des emplacements de suivi et de l'inventaire. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createOnboarding, SLOTS_DEPART } from '../src/server/onboarding/index.js';
import { BY_ID } from '../src/shared/fanzzy/dex.js';
import { STUFF, STUFF_BY_ID, combine } from '../src/shared/fanzzy/inventaire.js';
import { ACTION_BY_ID } from '../src/shared/duel/actions.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues, toutesTenues, tenuesPubliees } from '../src/server/fanzzy/tenues.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'tenues.sql', 'saisons.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = 'cccccccc-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'n@ex.fr', 'Nouveau']);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'FC Sion'),(91,'FC Bâle'),(61,'PSG'),(7,'OM')`);
/* **Une seule série ouverte**, LA TRIBUNE, comme au lancement du jeu. Sans
   saison lancée, tout est ouvert et le paquet de bienvenue pourrait puiser
   partout sans qu'on s'en aperçoive — c'est précisément ce qu'il faisait. */
await raw.query(
  `INSERT INTO saisons (id, numero, nom, series, lancee_a) VALUES (1, 1, 'Saison 1', ?, NOW(3))
     ON DUPLICATE KEY UPDATE series = VALUES(series), lancee_a = VALUES(lancee_a)`,
  [JSON.stringify(['TR'])]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
// Le catalogue vit en base depuis qu il se gère par l administration :
// on le charge comme le fait server.js, sinon les modules travaillent
// sur un catalogue vide.
await chargerCatalogue(pool);
await chargerTenues(pool);
const O = createOnboarding({ pool, requireAuth: (r, _s, n) => { r.user = { id: U }; n(); } });
const app = express(); app.use('/api/me', O.router);
const http = createServer(app); await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method ?? (o.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json' },
    body: o.body ? JSON.stringify(o.body) : undefined });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

let r = await call('/api/me/catalogue');
/* Les thèmes de tenue vivent en base depuis que l’administration peut en
   créer : le nombre n’est plus une constante et ne s’écrit plus en dur ici.
   Ce qui compte, c’est que la route serve *tout* le catalogue et pas
   seulement les thèmes publiés — un joueur qui possède un ancien thème doit
   continuer de le voir nommé et illustré, même s’il ne tombe plus. */
/* Le compte de l’équipement se déduit lui aussi. Il était écrit « 7 » en dur,
   juste sous un commentaire qui explique pourquoi celui des tenues ne l’est
   plus. Il a rougi le jour où dix pièces sont arrivées, et personne ne l’a su :
   cette suite n’était dans aucune commande de la batterie. */
check(`catalogue servi (${r.json.stuff.length} pièces)`,
  r.json.skins.length === toutesTenues().length
  && r.json.stuff.length === STUFF.length);
check('y compris les thèmes dépubliés, pour ceux qui les possèdent',
  tenuesPubliees().length < toutesTenues().length
  && r.json.skins.some((t) => t.id === 'pluie'));

r = await call('/api/me/state');
check('deux emplacements au départ', r.json.slots.total === SLOTS_DEPART);
check('inscription non terminée', r.json.onboarded === false);

/* ------------------------------------------------------ le paquet */

r = await call('/api/me/welcome', { body: { teamId: 85 } });
const cartes = r.json.cartes;
/* Le paquet ne se compte plus en lignes : il en a neuf depuis que les cartes
   d'action sont cinq. Ce qui doit rester vrai, c'est **ce qu'il contient**, et
   chaque sorte a son contrôle juste en dessous. */
check(`le paquet est complet (${cartes.length} lots)`,
  ['fanzzy', 'stuff', 'action', 'scarves'].every(
    (t) => cartes.some((c) => c.type === t)));
check('deux Fanzzy', cartes.filter((c) => c.type === 'fanzzy').length === 2);
check('au moins un Fanzzy peu commun ou mieux',
  cartes.some((c) => c.type === 'fanzzy' && BY_ID.get(c.id).rar !== 'commune'));

/* **Ce qu'il ne doit pas contenir**, et c'est là que le paquet était faux.

   Il tirait dans tout le catalogue publié : des séries fermées, qu'on ne peut
   ni jouer ni retrouver au kiosque, et des **âges avancés** — un Capo di Curva
   offert à quelqu'un qui n'a jamais vu le Choriste, alors que l'évolution
   coûte cent quinze écharpes. Le booster s'en gardait déjà ; ce paquet-ci
   n'avait jamais reçu la consigne. */
{
  const siens = cartes.filter((c) => c.type === 'fanzzy').map((c) => BY_ID.get(c.id));
  check('les Fanzzy du paquet sont au premier âge',
    siens.every((f) => f.stage === 1)
    || (console.log('        âges :', siens.map((f) => `${f.id}/${f.stage}`).join(' ')), false));
  check('et d’une série ouverte', siens.every((f) => f.set === 'TR')
    || (console.log('        séries :', siens.map((f) => `${f.id}/${f.set}`).join(' ')), false));
}
check('une pièce d\u2019équipement', cartes.filter((c) => c.type === 'stuff').length === 1);
const actions = cartes.filter((c) => c.type === 'action').map((c) => c.id);
check(`cinq cartes d\u2019action (${actions.length})`, actions.length === 5);

/* **Et l'Arbitre est dedans.**
 *
 * C'est la carte qui ouvre le changement de Fanzzy. Le paquet de bienvenue
 * donne deux personnages : sans elle, le second reste sur le banc pendant tout
 * le duel et le joueur ne découvre jamais qu'une tribune se relaie. Une
 * mécanique entière dépendait sinon d'un tirage à une chance sur dix-sept.
 *
 * Le contrôle nomme la carte plutôt que de chercher son effet : si elle est un
 * jour remplacée, c'est ici qu'on doit venir le dire, pas ailleurs. */
check('dont l\u2019Arbitre, qui ouvre le changement',
  actions.includes('a-arbitre')
  || (console.log('        reçues :', actions.join(', ')), false));

/* Sans remise : quatre fois le même Fumigène ramènerait exactement au problème
   qu'on vient de corriger — dix emplacements de deck et rien à y décider. */
check('et cinq cartes différentes', new Set(actions).size === actions.length);

/* **Et elle existe.**
 *
 * Le contrôle comptait la carte sans jamais demander si elle était réelle.
 * `inventaire.js` portait une liste de quatre cartes de bienvenue, doublon du
 * vrai catalogue, et les deux avaient divergé : `a-relance` y figurait quand la
 * carte du jeu s'appelle `a-secondsouffle`.
 *
 * **Un nouveau joueur sur quatre repartait donc avec une carte inexistante** —
 * écrite dans sa bourse, absente de tout catalogue, et refusée par son propre
 * deck en « carte inconnue », pour une carte qu'on venait de lui offrir.
 *
 * Un compte ne pouvait pas voir ça. L'existence, si. */
{
  const inconnues = actions.filter((id) => !ACTION_BY_ID.has(id));
  check('et ces cinq cartes existent au catalogue', inconnues.length === 0
    || (console.log('        ', inconnues.join(', '),
      'ne sont pas des cartes du jeu'), false));
  const hautes = actions.filter(
    (id) => !['commune', 'rare'].includes(ACTION_BY_ID.get(id)?.rar));
  check('et ce sont des cartes de début, pas des légendaires',
    hautes.length === 0 || (console.log('        ', hautes.join(', ')), false));
}
check('des écharpes', r.json.scarves >= 80);
check('un Fanzzy équipé d\u2019office', Boolean(r.json.activeFanzzy));

r = await call('/api/me/state');
check('le club choisi est suivi et principal',
  r.json.follows[0]?.team_id === 85 && r.json.follows[0].is_main === 1);
check('inscription terminée', r.json.onboarded === true);
check('le skin de base est donné avec le Fanzzy',
  r.json.skins.some((s) => s.skin_id === 'base' && s.equipped === 1));
check('l\u2019équipement reçu est porté', r.json.stuff.some((s) => s.slot === 1));
check(`les cinq cartes sont en poche (${r.json.actions.length})`,
  r.json.actions.length === 5);

r = await call('/api/me/welcome', { body: { teamId: 91 } });
check('le paquet de bienvenue ne s\u2019ouvre qu\u2019une fois',
  r.json.error === 'onboarding.error.already_done');

/* ------------------------------------------------- emplacements */

r = await call('/api/me/follow', { body: { teamId: 91 } });
check('deuxième club suivi', r.json.slots.used === 2);

r = await call('/api/me/follow', { body: { teamId: 61 } });
check('troisième club refusé sans emplacement', r.json.error === 'onboarding.error.no_slot');

await pool.query('UPDATE user_wallet SET scarves = 50 WHERE user_id = ?', [U]);
r = await call('/api/me/slot', { body: {} });
check('emplacement refusé sans écharpes', r.json.error === 'onboarding.error.not_enough_scarves');

await pool.query('UPDATE user_wallet SET scarves = 500 WHERE user_id = ?', [U]);
r = await call('/api/me/slot', { body: {} });
check('emplacement acheté', r.json.slots === 3 && r.json.spent === 120);

r = await call('/api/me/follow', { body: { teamId: 61 } });
check('troisième club accepté ensuite', r.json.slots.used === 3);

r = await call('/api/me/follow/91', { method: 'DELETE' });
check('un club libéré rend son emplacement', r.json.slots.used === 2);

/* ---------------------------------------------------- inventaire */

await pool.query(`INSERT INTO user_stuff (user_id,stuff_id,copies) VALUES (?,'jumelles',1),(?,'bache',1)
                  ON DUPLICATE KEY UPDATE copies=copies+1`, [U, U]);
r = await call('/api/me/equip', { body: { stuffId: 'jumelles', slot: 1 } });
check('objet porté', r.json.slot === 1);
r = await call('/api/me/equip', { body: { stuffId: 'bache', slot: 2 } });
check('deuxième emplacement', r.json.slot === 2);

r = await call('/api/me/equip', { body: { stuffId: 'megaphone', slot: 1 } });
check('objet non possédé refusé', r.json.error === 'onboarding.error.not_owned');

r = await call('/api/me/equip', { body: { stuffId: 'jumelles', slot: 3 } });
check('troisième emplacement refusé', r.json.error === 'onboarding.error.bad_slot');

const l = await O.loadout(U);
check('les modificateurs combinent Fanzzy et équipement',
  l.stuff.length === 2 && l.mods.tempoWindow !== undefined);
check('le skin n\u2019entre pas dans les modificateurs',
  !JSON.stringify(l.mods).includes('skin'));

// Un même objet ne peut pas occuper deux emplacements.
await call('/api/me/equip', { body: { stuffId: 'jumelles', slot: 2 } });
const l2 = await O.loadout(U);
check('un objet ne se porte qu\u2019une fois', l2.stuff.length === 1);

const nu = combine({ tempoWindow: 1.7 }, []);
const arme = combine({ tempoWindow: 1.7 }, ['jumelles']);
check('l\u2019équipement a bien un revers',
  arme.tempoWindow > nu.tempoWindow && arme.tempoInterval > 0);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
