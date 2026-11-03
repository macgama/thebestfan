/**
 * Test des défis de la semaine (demande de Gaël du 3 novembre 2026).
 *
 * Ce que ce banc défend :
 *
 *   - le tirage ne propose que ce que le joueur possède (une série, une pièce,
 *     une tenue), le même à chaque tirage, et rien qu'il ne puisse faire ;
 *   - un duel qui compte fait avancer les défis de série et de tenue, un chant
 *     au Virage celui de la pièce portée ; rien au-delà de la cible ;
 *   - un défi fini se récupère une fois : des écharpes et des tampons du
 *     carnet ; pas avant d'être fini ;
 *   - le défi PASS n'est proposé qu'aux membres d'un PASS lancé avec une
 *     tenue, et ne verse que des points de la voie PASS : ni écharpes, ni
 *     tampons du carnet, et la voie monte.
 *
 * Usage : node scripts/defis-smoke.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { createAbonnement } from '../src/server/abonnement/index.js';
import { createDefis } from '../src/server/defis/index.js';
import { chargerSaisons } from '../src/server/fanzzy/saisons.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { poserReglages } from '../src/shared/reglages.js';
import { niveauVoieDe } from '../src/shared/pass.js';
import {
  tirerDefis, rangsDuDuel, rangsDuChant, titreDefi, choisirParmi, gainDefi, SORTES,
} from '../src/shared/defis.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
const RACINE = fileURLToPath(new URL('..', import.meta.url));

let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };
const titre = (t) => console.log(`\n${t}\n`);

/* ======================================================= les règles pures */

titre('Le tirage');
{
  const possede = { series: ['AN', 'RP'], stuff: ['cornet'], tenues: ['carnaval', 'halloween'] };
  const a = tirerDefis({ semaine: '2026-11-02', userId: 'u1', possede });
  const b = tirerDefis({ semaine: '2026-11-02', userId: 'u1', possede: {
    series: ['RP', 'AN', 'AN'], stuff: ['cornet'], tenues: ['halloween', 'carnaval'] } });
  check('trois défis : série, pièce, tenue', a.map((x) => x.sorte).join(',') === 'serie,stuff,tenue');
  check('chacun parmi ce qu’il possède', possede.series.includes(a[0].objet)
    && a[1].objet === 'cornet' && possede.tenues.includes(a[2].objet));
  check('le même tirage, quel que soit l’ordre de la base', JSON.stringify(a) === JSON.stringify(b));
  check('rien à faire : aucun défi', tirerDefis({ semaine: '2026-11-02', userId: 'u1' }).length === 0);
  check('sans tenue : pas de défi de tenue', !tirerDefis({ semaine: '2026-11-02', userId: 'u1',
    possede: { series: ['AN'] } }).some((x) => x.sorte === 'tenue'));
  const p = tirerDefis({ semaine: '2026-11-02', userId: 'u1', possede, pass: { tenue: 'prehistorique' } });
  check('un membre du PASS a un quatrième défi, sa tenue', p.length === 4 && p[3].sorte === 'pass'
    && p[3].objet === 'prehistorique' && p[3].rang === 3);
  const semaines = new Set(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30']
    .map((s) => choisirParmi(['AN', 'RP', 'SU', 'TR'], { semaine: s, userId: 'u1', sorte: 'serie' })));
  check('le tirage change d’une semaine à l’autre', semaines.size > 1);
  check('les cibles : 5 duels, 30 chants, 3 duels, 5 duels',
    [SORTES.serie.cible, SORTES.stuff.cible, SORTES.tenue.cible, SORTES.pass.cible].join(',') === '5,30,3,5');
}

titre('Ce qui fait avancer');
{
  const defis = [
    { rang: 0, sorte: 'serie', objet: 'AN', fait: 0, cible: 5 },
    { rang: 1, sorte: 'stuff', objet: 'cornet', fait: 0, cible: 30 },
    { rang: 2, sorte: 'tenue', objet: 'carnaval', fait: 3, cible: 3 },
    { rang: 3, sorte: 'pass', objet: 'prehistorique', fait: 0, cible: 5 },
  ];
  check('un Fanzzy AN en tribune : la série', rangsDuDuel(defis, [{ serie: 'AN', tenues: [] }]).join() === '0');
  check('en Préhistorique : le PASS', rangsDuDuel(defis, [{ serie: 'RP', tenues: ['prehistorique'] }]).join() === '3');
  check('un défi fini n’avance plus', rangsDuDuel(defis, [{ serie: 'RP', tenues: ['carnaval'] }]).length === 0);
  check('une pièce portée au Virage : le stuff', rangsDuChant(defis, ['cornet', 'jumelles']).join() === '1');
  check('sans la pièce : rien', rangsDuChant(defis, ['jumelles']).length === 0);
  check('le stuff ne compte pas en duel', !rangsDuDuel(defis, [{ serie: 'XX', tenues: [], stuff: ['cornet'] }]).includes(1));
}

titre('Les intitulés, les gains et la voie');
check('« Joue 5 duels avec un Fanzzy LES TERRACES »',
  titreDefi('serie', 5, 'LES TERRACES') === 'Joue 5 duels avec un Fanzzy LES TERRACES');
check('le stuff se porte au Virage', /Grand Virage en portant «\u00a0Cornet de brume\u00a0»/.test(titreDefi('stuff', 30, 'Cornet de brume')));
check('un défi : 100 écharpes et 2 tampons', JSON.stringify(gainDefi('serie')) === '{"echarpes":100,"tampons":2,"points":0}');
check('le défi PASS : 10 points de voie, rien d’autre', JSON.stringify(gainDefi('pass')) === '{"echarpes":0,"tampons":0,"points":10}');
check('sans saison : pas de tampons promis', gainDefi('stuff', { avecSaison: false }).tampons === 0);
check('les points de voie s’ajoutent aux tampons face aux seuils',
  niveauVoieDe({ tampons: 50, points: 0, seuils: [60, 120] }) === 5
  && niveauVoieDe({ tampons: 50, points: 10, seuils: [60, 120] }) === 6
  && niveauVoieDe({ tampons: 0, points: 0, seuils: [] }) === 1
  && niveauVoieDe({ tampons: 0, points: 999, seuils: [] }) === 12);

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
                 'historique.sql', 'admin.sql', 'abonnement.sql', 'saisons.sql', 'quotidien.sql',
                 'pass.sql', 'defis.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8'));
}
const A = 'dddd0000-0000-0000-0000-000000000001';
const B = 'dddd0000-0000-0000-0000-000000000002';
for (const [i, id] of [A, B].entries()) {
  await raw.query("INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')",
    [id, `d${i}@ex.fr`, `Defi${i}`]);
  await raw.query('INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,0,0)', [id]);
  await raw.query("INSERT INTO user_fanzzy (user_id,fanzzy_id) VALUES (?,'AN1')", [id]);
  await raw.query("INSERT INTO user_stuff (user_id,stuff_id) VALUES (?,'cornet')", [id]);
  await raw.query(`INSERT INTO user_skins (user_id,fanzzy_id,stage,skin_id,equipped)
    VALUES (?,'AN1',1,'carnaval',1)`, [id]);
}
// A a le PASS 1, dont la saison est lancée : la tenue Préhistorique.
await raw.query("INSERT INTO user_pass (user_id,saison,source) VALUES (?,1,'offert')", [A]);
await raw.query('DELETE FROM saisons');
await raw.query(`INSERT INTO saisons (id, numero, nom, series, tenues, lancee_a, fin_le) VALUES
  (1, 1, 'Les héros du canapé', JSON_ARRAY(), JSON_ARRAY(), NOW(3) - INTERVAL 5 DAY, CURDATE() + INTERVAL 80 DAY)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 4, ...OPTIONS_BASE });
await chargerTenues(pool);
await chargerSaisons(pool);
poserReglages({});

let moi = A;
const requireAuth = (q, _s, n) => { q.user = { id: moi }; n(); };
const abonnement = createAbonnement({ pool, requireAuth });
const defis = createDefis({ pool, requireAuth, abonnement });
const app = express();
app.use(express.json());
app.use('/api/defis', defis.router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const get = async (p) => (await fetch(base + p)).json();
const post = async (p, corps) => {
  const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corps) });
  return { s: r.status, j: await r.json() };
};
const bourse = async (id) => Number((await pool.query(
  'SELECT scarves FROM user_wallet WHERE user_id = ?', [id]))[0][0].scarves);
const ANN1 = [{ id: 'AN1', tenues: { 1: 'carnaval' }, stuff: [] }];

titre('Le tirage en base');
let e = await get('/api/defis');
check('A (membre du PASS) : quatre défis', e.actif === true && e.liste.length === 4
  || console.log('       ', JSON.stringify(e)));
check('la série AN, le Cornet de brume, la tenue Carnaval, Préhistorique',
  e.liste.map((x) => x.objet).join(',') === 'AN,cornet,carnaval,prehistorique');
check('l’intitulé nomme la série', e.liste[0]?.titre === 'Joue 5 duels avec un Fanzzy LES TERRACES');
check('la fin de la semaine est servie', e.finSemaineMs > 0 && e.finSemaineMs <= 7 * 86400000);
moi = B;
const eB = await get('/api/defis');
check('B (sans PASS) : trois défis, pas de PASS', eB.liste.length === 3 && !eB.liste.some((x) => x.pass));
moi = A;
check('relu : pas de second tirage', (await pool.query(
  'SELECT COUNT(*) AS n FROM defis_semaine WHERE user_id = ?', [A]))[0][0].n === 4);

titre('La progression');
const r0 = await post('/api/defis/recuperer', { semaine: e.semaine, rang: 0 });
check('pas fini : refusé (incomplet)', r0.j.verse === false && r0.j.raison === 'incomplet');
for (let i = 0; i < 6; i++) await defis.apresDuel(A, ANN1);
e = await get('/api/defis');
check('six duels avec AN1 en Carnaval : série 5/5, tenue 3/3',
  e.liste[0].fait === 5 && e.liste[0].etat === 'pret' && e.liste[2].fait === 3 && e.liste[2].etat === 'pret');
check('le PASS n’avance pas sans sa tenue', e.liste[3].fait === 0);
for (let i = 0; i < 29; i++) await defis.apresChant(A, ['cornet']);
await defis.apresChant(A, ['jumelles']);
e = await get('/api/defis');
check('29 chants avec le cornet, un sans : 29/30', e.liste[1].fait === 29 && e.liste[1].etat === 'en_cours');
await defis.apresChant(A, ['cornet']);
check('le trentième : prêt', (await get('/api/defis')).liste[1].etat === 'pret');
check('trois défis prêts à récupérer', (await get('/api/defis')).aReclamer === 3);

titre('Le versement');
{
  const avant = await bourse(A);
  const r = await post('/api/defis/recuperer', { semaine: e.semaine, rang: 0 });
  check('récupéré : 100 écharpes et 2 tampons', r.j.verse === true && r.j.gain.echarpes === 100
    && r.j.gain.tampons === 2 && (await bourse(A)) === avant + 100 || console.log('       ', r.j));
  check('l’état rendu dit « récupéré »', r.j.defis?.liste?.[0]?.etat === 'reclamee');
  const r2 = await post('/api/defis/recuperer', { semaine: e.semaine, rang: 0 });
  check('une seconde fois : déjà', r2.j.verse === false && r2.j.raison === 'deja' && (await bourse(A)) === avant + 100);
  const [[l]] = await pool.query(
    "SELECT tampons, saison_id FROM recompenses WHERE user_id = ? AND source = 'hebdo'", [A]);
  check('la ligne du grand livre porte la saison et les tampons', Number(l.tampons) === 2 && Number(l.saison_id) === 1);
  const v = (await abonnement.voies(A))[0];
  check('les tampons des défis remplissent le carnet (la voie les voit)', v.tampons === 2 && v.points === 0);
  check('une requête mal formée : 400', (await post('/api/defis/recuperer', { semaine: 'x', rang: 0 })).s === 400);
}

titre('Le défi PASS');
{
  const avant = await bourse(A);
  for (let i = 0; i < 5; i++) await defis.apresDuel(A, [{ id: 'AN1', tenues: { 1: 'prehistorique' } }]);
  const r = await post('/api/defis/recuperer', { semaine: e.semaine, rang: 3 });
  check('récupéré : 10 points de voie', r.j.verse === true && r.j.gain.voie === 10 || console.log('       ', r.j));
  check('ni écharpes ni tampons', (await bourse(A)) === avant && r.j.gain.echarpes === 0 && r.j.gain.tampons === 0);
  const v = (await abonnement.voies(A))[0];
  check('la voie compte 10 points, le carnet reste à 2 tampons', v.points === 10 && v.tampons === 2);
  const [[t]] = await pool.query(
    `SELECT COALESCE(SUM(tampons), 0) AS n FROM recompenses
      WHERE user_id = ? AND source IN ('mission', 'sachet', 'hebdo') AND saison_id = 1`, [A]);
  check('le carnet ne compte jamais les points de voie', Number(t.n) === 2);
}

titre('L’interrupteur');
{
  poserReglages({ 'defis.actif': false });
  check('éteint : bloc absent', (await get('/api/defis')).actif === false);
  const r = await post('/api/defis/recuperer', { semaine: e.semaine, rang: 1 });
  check('éteint : réclamation refusée', r.j.verse === false && r.j.raison === 'inactif');
  const fait = (await pool.query('SELECT fait FROM defis_semaine WHERE user_id = ? AND rang = 0', [B]))[0][0].fait;
  await defis.apresDuel(B, ANN1);
  check('éteint : un duel ne fait rien avancer',
    (await pool.query('SELECT fait FROM defis_semaine WHERE user_id = ? AND rang = 0', [B]))[0][0].fait === fait);
  poserReglages({});
}

http.close();
await pool.end();
console.log(failures ? `\n${failures} échec(s)\n` : '\nTout est bon.\n');
process.exit(failures ? 1 : 0);
