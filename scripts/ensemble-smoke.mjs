/**
 * Test de « jouer entre amis » (`src/server/amis/ensemble.js`).
 *
 * Ce qui s'y joue :
 *
 *   1. **Entre amis mutuels, et entre eux seuls.** Une demande en attente, un
 *      inconnu, un compte effacé ne reçoivent ni geste, ni cadeau, ni fiche.
 *   2. **Jamais de texte.** Un geste hors de la liste fermée est refusé.
 *   3. **Une fois.** Un cadeau par ami et par jour, un défi par ami et par
 *      semaine, un prêt par jour : c'est la base et le grand livre qui le
 *      tiennent, pas une lecture avant d'écrire.
 *   4. **L'échange ne fabrique rien.** Un exemplaire part, un exemplaire
 *      arrive, des deux côtés ; un double qui n'en est plus un fait échouer.
 *   5. **Côte à côte.** Au Virage, un ami du même camp fait pousser plus fort,
 *      un ami d'en face non.
 *
 * Usage : node scripts/ensemble-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createEnsemble } from '../src/server/amis/ensemble.js';
import { createDecks } from '../src/server/deck/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerSaisons } from '../src/server/fanzzy/saisons.js';
import { poserReglages, DEFAUTS } from '../src/shared/reglages.js';
import { GESTES } from '../src/shared/amis-ensemble.js';
import { VirageRoom } from '../src/server/ferveur/virage.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ============================================================== la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS amis_gestes, amis_cadeaux, amis_echanges, amis_prets,
  jeux_jongles, jeux_tirs, jeux_parties, jeux_tifo, jeux_boss, pronostics, parrainages, contenus,
  abonnements, achats, kop_invites, amities, saisons, kop_bulletins, kop_votes, kop_bonus, kop_membres,
  kops, reglages, admin_audit, user_decks, user_stuff, user_etats, user_skins, user_fanzzy,
  user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results,
  duel_events, duels, user_league_follows, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users, recompenses,
  missions_jour, compteurs_jour, user_nouveautes`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
  'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'admin.sql',
  'kop.sql', 'amis.sql', 'niveau.sql', 'bourse.sql', 'saisons.sql', 'quotidien.sql',
  'amis-ensemble.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const A = 'aaaa0000-0000-0000-0000-00000000000a';
const B = 'bbbb0000-0000-0000-0000-00000000000b';
const C = 'cccc0000-0000-0000-0000-00000000000c';
const D = 'dddd0000-0000-0000-0000-00000000000d';
for (const [id, pseudo] of [[A, 'Alice'], [B, 'Bruno'], [C, 'Chloe'], [D, 'Dora']]) {
  await raw.query(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [id, `${pseudo}@ex.fr`, pseudo]);
  await raw.query(`INSERT INTO user_wallet (user_id, scarves, packs, active_fanzzy) VALUES (?, 0, 0, 'TR32')`,
    [id]);
}
// Alice et Bruno sont amis. Chloé a seulement demandé Alice. Dora est une inconnue.
await raw.query(`INSERT INTO amities (a, b, par, etat) VALUES (?, ?, ?, 'amis'), (?, ?, ?, 'demande')`,
  [A, B, A, A, C, C]);
// Alice a deux Choristes ; Bruno deux Capos et un Choriste.
await raw.query(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES
  (?, 'TR32', 2, 1), (?, 'TR1', 2, 2), (?, 'TR32', 1, 1)`, [A, B, B]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerSaisons(pool);
poserReglages({ ...DEFAUTS });

let moi = A;
const requireAuth = (req, _s, n) => { req.user = { id: moi }; n(); };
const E = createEnsemble({ pool, requireAuth });
const app = express();
app.use('/api/ensemble', E.router);
const http = createServer(app);
await new Promise((ok) => http.listen(0, ok));
const base = `http://localhost:${http.address().port}`;
const call = async (p, body) => {
  const res = await fetch(base + p, { method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const bourse = async (id) => Number((await pool.query(
  'SELECT scarves FROM user_wallet WHERE user_id = ?', [id]))[0][0].scarves);
const copies = async (id, f) => Number((await pool.query(
  'SELECT copies FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?', [id, f]))[0][0]?.copies ?? 0);

/* ------------------------------------------------------------ la fiche */

console.log('— la fiche d’un ami —');
let x = await call(`/api/ensemble/fiche/${B}`);
check('la fiche d’un ami se lit', x.status === 200 && x.json.ami?.pseudo === 'Bruno'
  || (console.log('        il y a :', x.status, JSON.stringify(x.json).slice(0, 300)), false));
check('avec sa collection et ce qu’on a en commun',
  x.json.collection?.total === 2 && x.json.collection?.communs === 1
  && x.json.collection.siens.some((f) => f.id === 'TR1' && f.double && !f.chezLautre && f.stage === 2));
check('et mes doubles, pour échanger', x.json.collection?.tesDoubles?.[0]?.id === 'TR32');
check('sans adresse e-mail', !/@/.test(JSON.stringify(x.json)));
x = await call(`/api/ensemble/fiche/${C}`);
check('une demande en attente n’ouvre pas de fiche', x.json.error === 'amis.error.pas_ami');
x = await call(`/api/ensemble/fiche/${D}`);
check('ni un inconnu', x.json.error === 'amis.error.pas_ami');

/* ------------------------------------------------------------ les gestes */

console.log('\n— les gestes —');
x = await call('/api/ensemble/geste', { id: B, geste: 'bravo' });
check('un geste part vers un ami', x.status === 200 && x.json.envoye === 'bravo');
x = await call('/api/ensemble/geste', { id: B, geste: 'tu es nul' });
check('un texte n’est pas un geste', x.json.error === 'amis.error.geste_inconnu');
x = await call('/api/ensemble/geste', { id: D, geste: 'bravo' });
check('un inconnu ne reçoit rien', x.json.error === 'amis.error.pas_ami');
x = await call('/api/ensemble/geste', { id: B, geste: 'bravo' });
check('le même geste ne repart pas tout de suite', x.json.error === 'amis.error.geste_recent');
poserReglages({ ...DEFAUTS, 'amis.gestes_jour': 2 });
await call('/api/ensemble/geste', { id: B, geste: 'allez' });
x = await call('/api/ensemble/geste', { id: B, geste: 'merci' });
check('au-delà du plafond du jour, plus de geste', x.json.error === 'amis.error.trop_de_gestes');
poserReglages({ ...DEFAUTS });

moi = B;
x = await call('/api/ensemble/nouveau');
check('l’ami voit deux gestes neufs', x.json.gestes === 2);
x = await call('/api/ensemble/fil');
check('le fil dit qui, quoi, avec son personnage',
  x.json.fil?.length === 2 && x.json.fil[0].de.pseudo === 'Alice' && x.json.fil[0].neuf
  && GESTES.some((g) => g.id === x.json.fil[0].geste) && x.json.fil[0].de.avatar);
await call('/api/ensemble/fil/vu', {});
check('une fois vus, ils ne sont plus neufs', (await call('/api/ensemble/nouveau')).json.gestes === 0);

/* ------------------------------------------------------------ le cadeau */

console.log('\n— le cadeau du jour —');
moi = A;
x = await call('/api/ensemble/cadeau', { id: B });
check('un cadeau part', x.status === 200 && x.json.offert === DEFAUTS['amis.cadeau_echarpes']);
check('l’ami reçoit les écharpes, celui qui offre son merci',
  await bourse(B) === DEFAUTS['amis.cadeau_echarpes'] && await bourse(A) === DEFAUTS['amis.cadeau_merci']);
x = await call('/api/ensemble/cadeau', { id: B });
check('un seul cadeau par ami et par jour', x.json.error === 'amis.error.deja_offert');
x = await call('/api/ensemble/cadeau', { id: C });
check('pas de cadeau à qui n’est pas ami', x.json.error === 'amis.error.pas_ami');
moi = B;
check('le cadeau laisse son geste dans le fil',
  (await call('/api/ensemble/fil')).json.fil?.[0]?.geste === 'cadeau');

/* -------------------------------------------------------------- le défi */

console.log('\n— le défi de la semaine —');
moi = A;
x = await call('/api/ensemble/defi', { id: B });
check('pas de défi relevé sans chants', x.json.error === 'amis.error.defi_incomplet');
const cible = DEFAUTS['amis.defi_cible'];
await pool.query(`INSERT INTO virage_presence (user_id, fixture_id, side, chants) VALUES (?, 1, 0, ?)`,
  [A, cible]);
x = await call(`/api/ensemble/fiche/${B}`);
check('seul, on ne relève pas un défi à deux', x.json.defi?.moi === cible && !x.json.defi.releve);
await pool.query(`INSERT INTO virage_presence (user_id, fixture_id, side, chants) VALUES (?, 1, 0, 1)`, [B]);
x = await call(`/api/ensemble/fiche/${B}`);
check('à deux, il est relevé', x.json.defi?.releve === true && x.json.defi.recupere === false);
const avant = await bourse(A);
x = await call('/api/ensemble/defi', { id: B });
check('il paie', x.status === 200 && await bourse(A) === avant + DEFAUTS['amis.defi_echarpes']);
x = await call('/api/ensemble/defi', { id: B });
check('une seule fois par semaine', x.json.error === 'amis.error.defi_deja');
check('et la fiche le dit', (await call(`/api/ensemble/fiche/${B}`)).json.defi?.recupere === true);

/* ---------------------------------------------------------- les échanges */

console.log('\n— l’échange de doubles —');
x = await call('/api/ensemble/echange', { id: B, donne: 'TR32', demande: 'TR1' });
check('Alice propose son Choriste en double contre un Capo', x.status === 200
  || (console.log('        refus :', x.json), false));
x = await call('/api/ensemble/echange', { id: B, donne: 'TR32', demande: 'TR1' });
check('une proposition à la fois', x.json.error === 'amis.error.echange_en_cours');
x = await call('/api/ensemble/echange', { id: B, donne: 'TR1', demande: 'TR32' });
check('on ne donne que ses doubles', x.json.error === 'amis.error.pas_ton_double');
moi = B;
x = await call(`/api/ensemble/fiche/${A}`);
const prop = x.json.echanges?.[0];
check('Bruno la voit sur la fiche d’Alice', prop && !prop.deMoi && prop.donne.id === 'TR32');
check('et sur sa pastille', (await call('/api/ensemble/nouveau')).json.echanges === 1);
x = await call('/api/ensemble/echange/reponse', { echange: prop.id, ok: true });
check('il accepte', x.status === 200 && x.json.etat === 'acceptee'
  || (console.log('        refus :', x.json), false));
check('un exemplaire part et arrive, des deux côtés',
  await copies(A, 'TR32') === 1 && await copies(A, 'TR1') === 1
  && await copies(B, 'TR1') === 1 && await copies(B, 'TR32') === 2);
x = await call('/api/ensemble/echange/reponse', { echange: prop.id, ok: true });
check('un échange ne se joue qu’une fois', x.json.error === 'amis.error.echange_introuvable');

/* Un double qui n'en est plus un au moment d'accepter. */
await pool.query(`UPDATE user_fanzzy SET copies = 2 WHERE user_id = ? AND fanzzy_id = 'TR1'`, [B]);
moi = B;
await call('/api/ensemble/echange', { id: A, donne: 'TR32', demande: 'TR32' });
x = await call('/api/ensemble/echange', { id: A, donne: 'TR1', demande: 'TR32' });
check('on ne demande que les doubles de l’autre', x.json.error === 'amis.error.pas_son_double');
await pool.query(`UPDATE user_fanzzy SET copies = 2 WHERE user_id = ? AND fanzzy_id = 'TR32'`, [A]);
x = await call('/api/ensemble/echange', { id: A, donne: 'TR1', demande: 'TR32' });
await pool.query(`UPDATE user_fanzzy SET copies = 1 WHERE user_id = ? AND fanzzy_id = 'TR32'`, [A]);
moi = A;
const id2 = (await call(`/api/ensemble/fiche/${B}`)).json.echanges?.find((e) => !e.deMoi)?.id;
x = await call('/api/ensemble/echange/reponse', { echange: id2, ok: true });
check('un double dépensé entre-temps fait échouer l’échange',
  x.json.error === 'amis.error.plus_de_double' && await copies(A, 'TR32') === 1);

/* -------------------------------------------------------------- le prêt */

console.log('\n— le prêt —');
await pool.query(`INSERT INTO user_fanzzy (user_id, fanzzy_id, copies, stage) VALUES (?, 'TR10', 1, 2)`, [B]);
moi = A;
x = await call('/api/ensemble/pret', { id: B, fanzzy: 'TR32' });
check('on n’emprunte pas ce qu’on a déjà', x.json.error === 'amis.error.pret_deja_a_toi');
x = await call('/api/ensemble/pret', { id: B, fanzzy: 'TR10' });
check('on emprunte un Fanzzy à un ami, à son âge', x.status === 200 && x.json.pret?.stage === 2
  || (console.log('        refus :', x.json), false));
x = await call('/api/ensemble/pret', { id: B, fanzzy: 'TR1' });
check('un seul prêt par jour', x.json.error === 'amis.error.pret_deja');

const decks = createDecks({ pool, requireAuth });
const dapp = express();
dapp.use('/api/deck', decks.router);
const dhttp = createServer(dapp);
await new Promise((ok) => dhttp.listen(0, ok));
const mien = await (await fetch(`http://localhost:${dhttp.address().port}/api/deck/mien`)).json();
check('le deck le compte parmi ses Fanzzy, en disant qui le prête',
  mien.possede?.fanzzy?.includes('TR10') && mien.possede?.pret?.preteur === 'Bruno'
  && mien.possede?.stades?.TR10 === 2);
await pool.query(`INSERT INTO user_decks (user_id, nom, contenu, actif) VALUES (?, 'x', ?, 1)`,
  [A, JSON.stringify({ fanzzy: [{ id: 'TR32', stuff: [] }, { id: 'TR10', stuff: [] }], actions: [] })]);
let l = await decks.loadout(A);
check('aujourd’hui, il se joue', l?.fanzzy?.some((f) => f.id === 'TR10'));
await pool.query(`UPDATE amis_prets SET jour = CURDATE() - INTERVAL 1 DAY WHERE emprunteur = ?`, [A]);
l = await decks.loadout(A);
check('demain, il est rendu : le deck joue sans lui',
  l?.fanzzy?.length === 1 && l.fanzzy[0].id === 'TR32');

/* ------------------------------------------------------ côte à côte */

console.log('\n— côte à côte au Virage —');
{
  const room = new VirageRoom({ fixture: { id: 9101, homeId: 1, awayId: 2 },
    emit: () => {}, emitVous: () => {}, log: { log() {}, warn() {}, error() {} } });
  room.join(A, { side: 0, name: 'Alice', mods: {} });
  room.join(B, { side: 0, name: 'Bruno', mods: {} });
  room.join(D, { side: 1, name: 'Dora', mods: {} });
  const ma = room.members.get(A);
  check('sans amis connus, pas de bonus', (room.modsDe(ma).pushMult ?? 1) === 1);
  ma.amis = new Set([B, D]);
  check('un ami caché ne compte pas', (room.modsDe(ma).pushMult ?? 1) === 1);
  room.members.get(B).montre = true;
  room.members.get(D).montre = true;
  const f = DEFAUTS['amis.cote_force'] / 100;
  check('un ami du même camp fait pousser plus fort, celui d’en face non',
    Math.abs(room.modsDe(ma).pushMult - (1 + f)) < 1e-9 && room.coteACote(ma).n === 1);
  poserReglages({ ...DEFAUTS, 'amis.actif': false });
  check('éteint, plus de bonus', (room.modsDe(ma).pushMult ?? 1) === 1);
  poserReglages({ ...DEFAUTS });
  room.members.delete(B);
  check('l’ami parti, le bonus tombe', (room.modsDe(ma).pushMult ?? 1) === 1);
}

/* ---------------------------------------------------------- éteint */

poserReglages({ ...DEFAUTS, 'amis.actif': false });
moi = A;
x = await call('/api/ensemble/geste', { id: B, geste: 'respect' });
check('éteint depuis /admin, rien ne part', x.json.error === 'amis.error.ensemble_eteint');
poserReglages({ ...DEFAUTS });

/* ------------------------------------------- le schéma pas appliqué

   Gaël construit souvent sans `schema:appliquer` : sans les quatre tables,
   la fonction se tait (fiche en pause, fil vide, deck intact) au lieu de
   rendre des erreurs du serveur. Dernière partie : on efface les tables. */

await pool.query('DROP TABLE amis_gestes, amis_cadeaux, amis_echanges, amis_prets');
x = await call(`/api/ensemble/fiche/${B}`);
check('sans les tables, la fiche s’ouvre, en pause', x.status === 200 && x.json.actif === false
  || (console.log('        il rend :', x.status, x.json), false));
x = await call('/api/ensemble/fil');
check('le fil est vide', x.status === 200 && Array.isArray(x.json.fil) && x.json.fil.length === 0);
x = await call('/api/ensemble/nouveau');
check('rien de neuf', x.status === 200 && x.json.gestes === 0 && x.json.echanges === 0);
x = await call('/api/ensemble/fil/vu', {});
check('marquer vu ne lève pas', x.status === 200);
x = await call('/api/ensemble/geste', { id: B, geste: 'merci' });
check('un geste répond « en pause », pas une erreur', x.json.error === 'amis.error.ensemble_eteint');
const dres = await fetch(`http://localhost:${dhttp.address().port}/api/deck/mien`);
check('le deck se charge sans la table des prêts', dres.status === 200);
check('et se joue', Boolean((await decks.loadout(A))?.fanzzy?.length));

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
http.close(); dhttp.close();
await pool.end();
process.exitCode = failures ? 1 : 0;
