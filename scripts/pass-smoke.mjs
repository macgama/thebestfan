/**
 * Test du PASS de saison (choix de Gaël du 2 novembre 2026).
 *
 * Ce que ce banc défend :
 *
 *   - un PASS couvre la saison en cours, et aussi la suivante s'il est pris
 *     pendant le dernier mois ; une saison finie fait acheter la suivante ;
 *   - il s'achète en écharpes (40 000 par défaut, réglable), une fois par
 *     saison, et donne ses 3 boosters ;
 *   - sa voie monte avec les paliers du carnet : la tenue aux âges suivants,
 *     le cadre, le cadre animé, le badge en or ;
 *   - un club suivi et un KOP de plus par PASS, cumulés, pour toujours ;
 *   - sa tenue ne sort d'aucun booster, ne se vend pas à l'étal pendant sa
 *     saison, puis y revient une saison plus tard, à son prix à part ;
 *   - la reprise des anciens abonnements donne le bon PASS ;
 *   - les anciens PASS (Gaël, 3 novembre 2026) : en vente le 1er du deuxième
 *     mois après la fin de leur saison, au même prix ; l'acheteur tardif n'a
 *     que le contenu, sans « ÉDITION ORIGINALE » ni gain spécial ; la tenue
 *     d'un PASS fini tombe dans les boosters aux âges qui manquent.
 *
 * Usage : node scripts/pass-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { createAbonnement } from '../src/server/abonnement/index.js';
import { chargerSaisons, saisonEnCours } from '../src/server/fanzzy/saisons.js';
import { chargerTenues, tenuesTirables, tenuesEnEtal } from '../src/server/fanzzy/tenues.js';
import { poserReglages, reglage, PAR_CLE } from '../src/shared/reglages.js';
import { prixTenueDe } from '../src/shared/etal.js';
import {
  saisonsCouvertes, niveauVoie, ageTenue, cadreDe, tenueReservee, vitrineDe, NIVEAU_MAX, passDe,
  venteAncienPassLe, anciensPassEnVente, estTardif, voieSelonAchat,
} from '../src/shared/pass.js';
import { CATALOGUE, ARTICLE_PAR_ID, LIVRAISONS_PAYANTES, articleCommande, idAncienPass }
  from '../src/shared/boutique.js';
import { planifier, saisonDuJour } from './pass-reprise.mjs';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const titre = (t) => console.log(`\n${t}\n`);

/* ======================================================= les règles pures */

titre('Les saisons couvertes');
check('en pleine saison : la saison seule', JSON.stringify(saisonsCouvertes({ numero: 1, joursRestants: 80 }, 30)) === '[1]');
check('le dernier mois : la saison et la suivante', JSON.stringify(saisonsCouvertes({ numero: 1, joursRestants: 30 }, 30)) === '[1,2]');
check('saison finie : la suivante', JSON.stringify(saisonsCouvertes({ numero: 1, finie: true }, 30)) === '[2]');
check('sans saison : rien', saisonsCouvertes(null).length === 0);
check('sans date de fin : la saison seule', JSON.stringify(saisonsCouvertes({ numero: 3 }, 30)) === '[3]');

titre('La voie PASS');
check('niveau 1 à l’achat, 6 au plus', niveauVoie(0) === 1 && niveauVoie(99) === NIVEAU_MAX && NIVEAU_MAX === 6);
check('la tenue : âge 1, puis 2 et 3', ageTenue(1) === 1 && ageTenue(2) === 2 && ageTenue(3) === 3 && ageTenue(6) === 3);
check('le cadre au niveau 4, animé au 5', cadreDe(3) === null && cadreDe(4) === 'fixe' && cadreDe(5) === 'anime');
check('le badge en or au dernier niveau', vitrineDe(1, 6).or === true && vitrineDe(1, 5).or === false);
check('le PASS 1 est Préhistorique', passDe(1).tenue === 'prehistorique');

titre('Les tenues réservées');
check('pendant la saison 1, Préhistorique est réservée', tenueReservee('prehistorique', 1) === true);
check('sans saison connue, elle reste réservée', tenueReservee('prehistorique', null) === true);
check('à la saison 2, elle revient', tenueReservee('prehistorique', 2) === false);
check('Halloween n’est réservée à aucun PASS', tenueReservee('halloween', 1) === false);

titre('La boutique et les réglages');
const article = ARTICLE_PAR_ID.get('pass-saison');
check('le PASS est à 7,99 €, 3 boosters', article?.prix === 799 && article?.livraison?.type === 'pass'
  && article?.livraison?.packs === 3);
check('il ne se renouvelle pas', !article?.recurrence);
check('les anciens abonnements ne sont plus en vente',
  ['abo-mensuel', 'abo-annuel'].every((id) => ARTICLE_PAR_ID.get(id)?.retire === true));
check('le PASS est une livraison payante permise', LIVRAISONS_PAYANTES.has('pass'));
check('l’argent réel n’achète que le PASS', CATALOGUE.filter((a) => !a.retire)
  .every((a) => LIVRAISONS_PAYANTES.has(a.livraison?.type)));
check('40 000 écharpes par défaut, réglable', reglage('pass.prix_echarpes') === 40000
  && PAR_CLE.get('pass.prix_echarpes')?.section === 'abonnement');
check('les plafonds gratuits du classement ont disparu',
  ['abo.duels_classes_jour', 'abo.virages_classes_jour', 'abo.taille_classe_libre', 'abo.clubs_en_plus']
    .every((k) => !PAR_CLE.has(k)));

titre('Les anciens PASS : les règles');
check('fin le 28 février : en vente le 1er avril', venteAncienPassLe('2027-02-28') === '2027-04-01');
check('fin le 30 novembre : en vente le 1er janvier', venteAncienPassLe('2026-11-30') === '2027-01-01');
check('fin le 31 décembre : en vente le 1er février', venteAncienPassLe('2026-12-31') === '2027-02-01');
check('sans date de fin : jamais', venteAncienPassLe(null) === null && venteAncienPassLe('') === null);
{
  const S = [
    { numero: 0, fin: '2026-11-30', lancee: true },
    { numero: 1, fin: '2027-02-28', lancee: true },
    { numero: 2, fin: '2027-05-31', lancee: true },
    { numero: 3, fin: '2027-08-31', lancee: false },
  ];
  const ids = (l) => JSON.stringify(l.map((x) => x.numero));
  check('le 31 mars : rien encore', ids(anciensPassEnVente(S, '2027-03-31')) === '[]');
  check('le 1er avril : le PASS 1, jamais la BASE', ids(anciensPassEnVente(S, '2027-04-01')) === '[1]');
  check('le 1er juillet : les PASS 1 et 2', ids(anciensPassEnVente(S, '2027-07-01')) === '[1,2]');
  check('déjà à lui : pas proposé', ids(anciensPassEnVente(S, '2027-07-01', [1])) === '[2]');
  check('une saison pas lancée : jamais', ids(anciensPassEnVente(S, '2030-01-01')) === '[1,2]');
}
check('un achat tardif se lit sur la source', estTardif('stripe-tard') && estTardif('echarpes-tard')
  && !estTardif('stripe') && !estTardif('offert') && !estTardif(null));
{
  const t = voieSelonAchat(1, 6, { tardif: true });
  check('acheteur tardif : niveau 1, sans cadre ni or, pas original', t.niveau === 1 && t.cadre === null
    && t.or === false && t.original === false && t.tardif === true);
  const o = voieSelonAchat(1, 6);
  check('joueur de la saison : son niveau, original', o.niveau === 6 && o.or === true && o.original === true);
  const a = articleCommande(idAncienPass(1));
  check('l’article d’un ancien PASS : même prix, saison nommée, tardif', a?.prix === article?.prix
    && a?.livraison?.type === 'pass' && a?.livraison?.saison === 1 && a?.livraison?.tardif === true
    && a?.livraison?.packs === article?.livraison?.packs);
  check('un identifiant inventé ne donne rien', articleCommande('pass-saison@x') === null
    && articleCommande('pass-saison@0') === null && articleCommande('autre@1') === null);
  check('le PASS courant reste l’article du catalogue', articleCommande('pass-saison') === article);
}

titre('La reprise des anciens abonnements');
{
  const S = [
    { numero: 1, ouvre: '2026-10-28', fin: '2027-03-31', lancee: true },
    { numero: 2, ouvre: '2027-04-01', fin: '2027-06-30', lancee: false },
  ];
  check('un jour de la saison 2 tombe dans la saison 2', saisonDuJour(S, '2027-05-10')?.numero === 2);
  check('au-delà de tout, la dernière', saisonDuJour(S, '2028-01-01')?.numero === 2);
  const maintenant = new Date('2026-11-02T12:00:00Z');
  const p = planifier([
    { user_id: 'a', source: 'stripe', reference: 'sub_1', fin: new Date('2026-12-01T00:00:00Z') },
    { user_id: 'b', source: 'stripe', reference: 'sub_2', fin: new Date('2027-04-20T00:00:00Z') },
    { user_id: 'c', source: 'admin', formule: 'offert', reference: null, fin: null },
    { user_id: 'd', source: 'stripe', reference: 'sub_4', fin: new Date('2026-10-01T00:00:00Z') },
  ], S, maintenant);
  const de = (id) => p.find((x) => x.user_id === id);
  check('Stripe qui finit en décembre : PASS 1, résilié à l’échéance', de('a').quoi === 'stripe' && de('a').saison === 1);
  check('Stripe annuel qui finit en avril : PASS 2', de('b').saison === 2);
  check('offert : PASS de la saison en cours, ligne arrêtée à sa fin',
    de('c').quoi === 'offert' && de('c').saison === 1 && de('c').finAbo?.startsWith('2027-03-31'));
  check('déjà fini : rien', de('d').quoi === 'fini' && de('d').saison === null);
}

/* ================================================================= la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('SET FOREIGN_KEY_CHECKS = 0');
const [tables] = await raw.query('SHOW TABLES');
const noms = tables.map((r) => Object.values(r)[0]);
if (noms.length) await raw.query(`DROP TABLE ${noms.join(',')}`);
await raw.query('SET FOREIGN_KEY_CHECKS = 1');
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'duel.sql',
                 'souvenirs.sql', 'billets.sql', 'fanzzy.sql', 'inventaire.sql',
                 'skins.sql', 'etats.sql', 'tenues.sql', 'deck.sql', 'niveau.sql', 'kop.sql',
                 'historique.sql', 'admin.sql', 'abonnement.sql', 'saisons.sql', 'quotidien.sql', 'pass.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
const A = 'bbbb0000-0000-0000-0000-000000000001';
const B = 'bbbb0000-0000-0000-0000-000000000002';
for (const [i, id] of [A, B].entries()) {
  await raw.query("INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')",
    [id, `p${i}@ex.fr`, `Pass${i}`]);
  await raw.query('INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,0,0)', [id]);
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
await chargerTenues(pool);
const poserSaison = async (finDans) => {
  await pool.query('DELETE FROM saisons');
  await pool.query(`INSERT INTO saisons (id, numero, nom, series, tenues, lancee_a, fin_le) VALUES
    (1, 1, 'La reprise', JSON_ARRAY(), JSON_ARRAY(), NOW(3) - INTERVAL 5 DAY, CURDATE() + INTERVAL ${finDans} DAY)`);
  await chargerSaisons(pool);
};
await poserSaison(80);

let moi = A;
const requireAuth = (q, _s, n) => { q.user = { id: moi }; n(); };
const abonnement = createAbonnement({ pool, requireAuth });
const app = express();
app.use(express.json());
app.use((q, _s, n) => { q.user = { id: moi }; n(); });
app.use('/api/abonnement', abonnement.router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const get = async (p) => (await fetch(base + p)).json();
const post = async (p) => { const r = await fetch(base + p, { method: 'POST' }); return { s: r.status, j: await r.json() }; };
const bourse = async (id) => (await pool.query('SELECT scarves, packs FROM user_wallet WHERE user_id = ?', [id]))[0][0];

titre('Acheter en écharpes');
check('la saison 1 est en cours', saisonEnCours()?.numero === 1);
{
  const e = await get('/api/abonnement');
  check('sans PASS : pas actif, l’offre couvre la saison 1', e.actif === false
    && JSON.stringify(e.offre?.aAcheter) === '[1]' && e.offre?.echarpes === 40000);
  const r = await post('/api/abonnement/pass/echarpes');
  check('sans assez d’écharpes : refusé, rien ne bouge', r.s >= 400 && r.j.error === 'pass.error.pas_assez'
    && (await abonnement.saisonsDuPass(A)).length === 0);
  await pool.query('UPDATE user_wallet SET scarves = 40500 WHERE user_id = ?', [A]);
  const r2 = await post('/api/abonnement/pass/echarpes');
  const b = await bourse(A);
  check('avec 40 500 : PASS 1, 500 écharpes restent, 3 boosters', r2.s === 200
    && JSON.stringify(r2.j.saisons) === '[1]' && Number(b.scarves) === 500 && Number(b.packs) === 3
    || console.log('       ', r2, b));
  check('il est actif', (await abonnement.estAbonne(A)) === true);
  await pool.query('UPDATE user_wallet SET scarves = 90000 WHERE user_id = ?', [A]);
  const r3 = await post('/api/abonnement/pass/echarpes');
  check('une seconde fois : refusé (déjà), les écharpes restent', r3.j.error === 'pass.error.deja'
    && Number((await bourse(A)).scarves) === 90000);
  poserReglages({ 'pass.prix_echarpes': 0 });
  moi = B;
  await pool.query('UPDATE user_wallet SET scarves = 90000 WHERE user_id = ?', [B]);
  check('à 0 dans /admin, le paiement en écharpes est fermé',
    (await post('/api/abonnement/pass/echarpes')).j.error === 'pass.error.echarpes_fermees');
  poserReglages({ 'pass.prix_echarpes': 40000 });
  moi = A;
}

titre('Le dernier mois');
await poserSaison(12);
{
  moi = B;
  const e = await get('/api/abonnement');
  check('à 12 jours de la fin : l’offre couvre 1 et 2', JSON.stringify(e.offre?.aAcheter) === '[1,2]');
  const r = await post('/api/abonnement/pass/echarpes');
  check('un seul achat donne les PASS 1 et 2', JSON.stringify(r.j.saisons) === '[1,2]'
    && JSON.stringify(await abonnement.saisonsDuPass(B)) === '[1,2]');
  moi = A;
  const eA = await get('/api/abonnement');
  check('qui a déjà le PASS 1 n’achète que le 2', JSON.stringify(eA.offre?.aAcheter) === '[2]');
}
await poserSaison(80);

titre('Ce que les PASS donnent pour toujours');
{
  check('un PASS : un club suivi de plus', (await abonnement.clubsEnPlus(A)) === 1);
  check('deux PASS : deux clubs de plus', (await abonnement.clubsEnPlus(B)) === 2);
  check('un KOP à créer par PASS', (await abonnement.kopsAutorises(A)) === 1 && (await abonnement.kopsAutorises(B)) === 2);
  const badges = await abonnement.badgesDe([A, B, 'inconnu']);
  check('le badge d’une liste dit le dernier PASS', badges.get(A)?.saison === 1 && badges.get(B)?.saison === 2
    && !badges.has('inconnu'));
  const v = (await abonnement.voies(A))[0];
  check('la voie commence au niveau 1, tenue à l’âge 1', v?.niveau === 1 && v?.ageTenue === 1 && v?.tenue === 'prehistorique');
  check('la tenue du PASS se porte à l’âge 1', (await abonnement.ageTenuePass(A, 'prehistorique')) === 1
    && (await abonnement.ageTenuePass(A, 'halloween')) === 0);
  const e = await get('/api/abonnement');
  check('l’écran reçoit la voie, le PASS et ce qui reste libre', Array.isArray(e.voies) && e.voies.length === 1
    && Array.isArray(e.voie) && e.voie.length === NIVEAU_MAX && Array.isArray(e.libre) && e.libre.length > 0);
  /* Les tampons du carnet font monter la voie : deux paliers, niveau 3, la
     tenue jusqu'à l'âge 3. */
  const seuils = v?.seuils ?? [];
  check('la voie lit les paliers du carnet de la saison', seuils.length >= 5);
  await pool.query(`INSERT INTO recompenses (user_id, source, cle, saison_id, tampons)
    VALUES (?, 'mission', 'essai-1', 1, ?)`, [A, seuils[1] ?? 0]);
  const v3 = (await abonnement.voies(A))[0];
  check('deux paliers atteints : niveau 3, tenue à l’âge 3', v3?.niveau === 3 && v3?.ageTenue === 3
    && (await abonnement.ageTenuePass(A, 'prehistorique')) === 3 || console.log('       ', v3));
  await pool.query(`UPDATE recompenses SET tampons = ? WHERE user_id = ? AND cle = 'essai-1'`,
    [seuils.at(-1) ?? 0, A]);
  const v6 = (await abonnement.voies(A))[0];
  check('tout le carnet : niveau 6, cadre animé, badge en or', v6?.niveau === NIVEAU_MAX
    && v6?.cadre === 'anime' && v6?.or === true || console.log('       ', v6));
  check('les tampons d’une autre source ne comptent pas', await (async () => {
    await pool.query(`INSERT INTO recompenses (user_id, source, cle, saison_id, tampons)
      VALUES (?, 'carnet', 'essai-2', 1, 999)`, [B]);
    return (await abonnement.voies(B))[0]?.niveau === 1;
  })());
  const g = await get(`/api/abonnement/badge/${A}`);
  check('le badge public d’un joueur', g?.badge?.saison === 1 || g?.saison === 1 || console.log('       ', g));
}

titre('La tenue du PASS, hors des boosters et de l’étal');
{
  check('Préhistorique ne sort d’aucun booster', !tenuesTirables().some((t) => t.id === 'prehistorique')
    && tenuesTirables().some((t) => t.id === 'halloween'));
  check('elle n’est pas à l’étal pendant la saison 1', !tenuesEnEtal().some((t) => t.id === 'prehistorique'));
  await pool.query('DELETE FROM saisons');
  await pool.query(`INSERT INTO saisons (id, numero, nom, series, tenues, lancee_a, fin_le) VALUES
    (1, 1, 'La reprise', JSON_ARRAY(), JSON_ARRAY(), NOW(3) - INTERVAL 100 DAY, CURDATE() - INTERVAL 10 DAY),
    (2, 2, 'Le printemps', JSON_ARRAY(), JSON_ARRAY(), NOW(3) - INTERVAL 9 DAY, CURDATE() + INTERVAL 80 DAY)`);
  await chargerSaisons(pool);
  const t = tenuesEnEtal().find((x) => x.id === 'prehistorique');
  check('à la saison 2, elle revient à l’étal, marquée PASS', saisonEnCours()?.numero === 2 && t?.pass === true);
  check('à son prix à part (pass.prix_tenue_etal)', t && (prixTenueDe(t) === reglage('pass.prix_tenue_etal')
    || prixTenueDe(t) === null));
  check('et toujours jamais dans un booster', !tenuesTirables().some((x) => x.id === 'prehistorique'));
  check('le PASS 1 ne rend plus actif en saison 2', (await abonnement.estAbonne(A)) === false);
  check('mais la tenue reste portée, pour toujours', (await abonnement.ageTenuePass(A, 'prehistorique')) >= 1);
  check('et le club de plus aussi', (await abonnement.clubsEnPlus(A)) === 1);
}

titre('Les anciens PASS : en boutique');
{
  const C = 'bbbb0000-0000-0000-0000-000000000003';
  await pool.query("INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')",
    [C, 'p2@ex.fr', 'Pass2']);
  await pool.query('INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,90000,0)', [C]);
  const postJ = async (p, corps) => {
    const r = await fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps) });
    return { s: r.status, j: await r.json() };
  };
  moi = C;
  /* La saison 1 a fini il y a dix jours : son PASS n'est pas encore en vente. */
  check('dix jours après la fin : pas encore en vente', (await abonnement.anciensEnVente(C)).length === 0
    && (await get('/api/abonnement')).anciensPass?.length === 0);
  const r0 = await postJ('/api/abonnement/pass/echarpes', { saison: 1 });
  check('l’acheter quand même : refusé, rien ne bouge', r0.j.error === 'pass.error.pas_en_vente'
    && Number((await bourse(C)).scarves) === 90000);

  await pool.query(`UPDATE saisons SET fin_le = CURDATE() - INTERVAL 100 DAY WHERE numero = 1`);
  await chargerSaisons(pool);
  const e = await get('/api/abonnement');
  check('cent jours après : le PASS 1 est en vente', JSON.stringify(e.anciensPass?.map((p) => p.numero)) === '[1]'
    && e.anciensPass[0].tenue === 'prehistorique' || console.log('       ', e.anciensPass));
  moi = A;
  check('qui l’a déjà ne le voit pas', (await get('/api/abonnement')).anciensPass?.length === 0);
  moi = C;
  const r = await postJ('/api/abonnement/pass/echarpes', { saison: 1 });
  const b = await bourse(C);
  check('en écharpes, au même prix : le PASS 1 et ses 3 boosters', r.s === 200
    && JSON.stringify(r.j.saisons) === '[1]' && Number(b.scarves) === 50000 && Number(b.packs) === 3
    || console.log('       ', r, b));
  const [[ligne]] = await pool.query('SELECT source FROM user_pass WHERE user_id = ? AND saison = 1', [C]);
  check('la ligne est marquée tardive', ligne?.source === 'echarpes-tard');
  check('une seconde fois : déjà à lui', (await postJ('/api/abonnement/pass/echarpes', { saison: 1 })).j.error
    === 'pass.error.deja');
  const v = (await abonnement.voies(C))[0];
  check('sa voie : niveau 1, tenue au 1er âge, sans cadre ni or, pas d’édition originale',
    v?.niveau === 1 && v?.ageTenue === 1 && v?.cadre === null && v?.or === false
    && v?.original === false && v?.tardif === true || console.log('       ', v));
  check('ni club ni KOP en plus', (await abonnement.clubsEnPlus(C)) === 0 && (await abonnement.kopsAutorises(C)) === 0);
  check('ni badge', (await abonnement.badgeDe(C)) === null && !(await abonnement.badgesDe([C])).has(C));
  check('il n’ouvre pas le rythme de la saison', (await abonnement.estAbonne(C)) === false);
  check('la tenue se porte au 1er âge', (await abonnement.ageTenuePass(C, 'prehistorique')) === 1);
  check('ses autres âges tombent dans ses boosters',
    (await abonnement.tenuesAuxBoosters(C)).get('prehistorique') === 1);

  const vA = (await abonnement.voies(A))[0];
  check('le joueur de la saison : édition originale, voie close', vA?.original === true && vA?.close === true);
  await pool.query(`UPDATE recompenses SET tampons = ? WHERE user_id = ? AND cle = 'essai-1'`,
    [vA.seuils[0], A]);
  const vA2 = (await abonnement.voies(A))[0];
  check('voie pas finie : il garde ses âges, le 3e tombe dans ses boosters', vA2?.ageTenue === 2
    && (await abonnement.tenuesAuxBoosters(A)).get('prehistorique') === 2 || console.log('       ', vA2));
  moi = B;
  check('la voie de la saison en cours n’est pas close',
    (await abonnement.voies(B)).find((x) => x.saison === 2)?.close === false);
  moi = A;
}

http.close();
await pool.end();
console.log(failures ? `\n${failures} échec(s)\n` : '\ntout est vert\n');
process.exit(failures ? 1 : 0);
