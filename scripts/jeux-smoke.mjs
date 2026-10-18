/**
 * Les mini-jeux d'entre les matchs, côté serveur : les règles pures, puis les
 * routes sur une vraie base (jongles, tirs au but, classements, écharpes).
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createJeux } from '../src/server/jeux/index.js';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerSaisons, toutesLesSaisons } from '../src/server/fanzzy/saisons.js';
import { poserReglages, DEFAUTS } from '../src/shared/reglages.js';
import {
  JONGLES, scoreDeJongles, gainDeJongles, TIRS, jeuDeTirs, issueDuTir, reglerTirs, jeuDeLaMachine,
} from '../src/shared/mini-jeux.js';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

/* ================================================================ les règles */

console.log('— les règles —');
const frappes = (n, pas = 400) => Array.from({ length: n }, (_, i) => i * pas);
check('des frappes possibles donnent leur score', scoreDeJongles(20, frappes(20), 9000) === 20);
check('zéro jongle, c’est une partie', scoreDeJongles(0, [], 500) === 0);
check('deux frappes trop serrées sont refusées',
  scoreDeJongles(3, [0, 400, 400 + JONGLES.ECART_MIN_MS - 1], 5000) === null);
check('un score qui ne compte pas ses frappes est refusé', scoreDeJongles(5, frappes(4), 9000) === null);
check('des frappes après l’envoi sont refusées', scoreDeJongles(10, frappes(10), 1000) === null);
check('un score négatif ou absurde est refusé',
  scoreDeJongles(-1, [], 10) === null && scoreDeJongles(JONGLES.SCORE_MAX + 1, frappes(1), 1e9) === null);
check('une écharpe tous les cinq jongles, au plus le plafond de la partie',
  gainDeJongles(24, { parEcharpe: 5, maxPartie: 15 }) === 4
  && gainDeJongles(400, { parEcharpe: 5, maxPartie: 15 }) === 15);

const jeu = (zones, force = 0.7, arrets = [0, 1, 2, 3, 4]) => ({
  tirs: zones.map((zone) => ({ zone, force })), arrets,
});
check('un jeu de tirs valide se normalise', jeuDeTirs(jeu([0, 1, 2, 3, 4], 0.7777))?.tirs[0].force === 0.78);
check('un jeu incomplet est refusé', jeuDeTirs({ tirs: [{ zone: 0, force: 0.5 }], arrets: [0] }) === null);
check('une zone hors du but est refusée', jeuDeTirs(jeu([0, 1, 2, 3, 6])) === null);
check('une force hors de 0 à 1 est refusée', jeuDeTirs(jeu([0, 1, 2, 3, 4], 1.2)) === null);
check('trop fort, au-dessus', issueDuTir({ zone: 0, force: 0.95 }, 5) === 'dessus');
check('le gardien dans la zone arrête tout', issueDuTir({ zone: 4, force: 0.9 }, 4) === 'arret');
check('bonne colonne, mauvais rang : il n’arrête qu’un tir mou',
  issueDuTir({ zone: 4, force: 0.4 }, 1) === 'arret' && issueDuTir({ zone: 4, force: 0.8 }, 1) === 'but');
check('ailleurs, c’est but', issueDuTir({ zone: 0, force: 0.6 }, 2) === 'but');
const r = reglerTirs(jeu([0, 0, 0, 0, 0], 0.7, [2, 2, 2, 2, 2]), jeu([2, 2, 2, 2, 2], 0.7, [5, 5, 5, 5, 5]));
check('la série se règle tour à tour', r.coups.length === 10 && r.coups[0].tireur === 'a'
  && r.butsA === 5 && r.butsB === 0 && r.gagnant === 'a');
const m = jeuDeLaMachine(42);
check('la machine joue un jeu valide, le même pour la même graine',
  jeuDeTirs(m) !== null && JSON.stringify(m) === JSON.stringify(jeuDeLaMachine(42))
  && m.tirs.every((t) => t.force <= TIRS.FORCE_MAX));

/* ============================================================== la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS jeux_jongles, jeux_tirs, pronostics, parrainages, contenus, abonnements,
  achats, kop_invites, amities, saisons, kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, reglages,
  admin_audit, user_decks, user_stuff, user_etats, user_skins, user_fanzzy, user_souvenirs, virage_presence,
  souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events, duels, user_league_follows,
  user_follows, fixture_events, standings, fixtures, team_leagues, teams, leagues, api_quota, login_attempts,
  auth_tokens, sessions, users, recompenses, missions_jour, compteurs_jour, user_nouveautes`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql',
  'fanzzy.sql', 'inventaire.sql', 'skins.sql', 'etats.sql', 'tenues.sql', 'admin.sql', 'kop.sql', 'amis.sql',
  'niveau.sql', 'bourse.sql', 'saisons.sql', 'quotidien.sql', 'mini-jeux.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const A = 'aaaa0000-0000-0000-0000-00000000000a';
const B = 'bbbb0000-0000-0000-0000-00000000000b';
const C = 'cccc0000-0000-0000-0000-00000000000c';
for (const [id, pseudo] of [[A, 'Alice'], [B, 'Bruno'], [C, 'Chloe']]) {
  await raw.query(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [id, `${pseudo}@ex.fr`, pseudo]);
  await raw.query(`INSERT INTO user_wallet (user_id, scarves, packs) VALUES (?, 0, 0)`, [id]);
}
await raw.query(`INSERT INTO amities (a, b, par, etat) VALUES (?, ?, ?, 'amis')`, [A, B, A]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });
await chargerCatalogue(pool);
await chargerSaisons(pool);
poserReglages({ ...DEFAUTS });
const saison1 = toutesLesSaisons().find((s) => s.numero === 1);

let moi = A;
const jeux = createJeux({ pool, requireAuth: (req, _s, n) => { req.user = { id: moi }; n(); } });
const app = express();
app.use('/api/jeux', jeux.router);
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

/* ------------------------------------------------------------- jongles */

console.log('\n— les jongles —');
let x = await call('/api/jeux');
check('l’état se lit, avec la saison en cours', x.status === 200 && x.json.saison?.id === saison1.id
  && x.json.jongles.record === null && x.json.echarpes.plafond === DEFAUTS['jeux.echarpes_jour']);

x = await call('/api/jeux/jongles', {});
const p1 = x.json;
check('une partie s’ouvre avec sa graine', Number.isInteger(p1.id) && Number.isInteger(p1.graine));
/* Le serveur mesure le temps écoulé : la partie est vieillie d'une minute. */
await pool.query('UPDATE jeux_jongles SET debut_a = NOW(3) - INTERVAL 60 SECOND WHERE id = ?', [p1.id]);
x = await call(`/api/jeux/jongles/${p1.id}`, { score: 23, frappes: frappes(23) });
check('une partie se ferme : score, écharpes, record', x.status === 200 && x.json.score === 23
  && x.json.echarpes === 4 && x.json.nouveauRecord === true && x.json.record === 23);
check('les écharpes sont dans la bourse', await bourse(A) === 4);
x = await call(`/api/jeux/jongles/${p1.id}`, { score: 23, frappes: frappes(23) });
check('une partie ne se ferme qu’une fois', x.status === 409);

x = await call('/api/jeux/jongles', {});
await pool.query('UPDATE jeux_jongles SET debut_a = NOW(3) - INTERVAL 60 SECOND WHERE id = ?', [x.json.id]);
const triche = await call(`/api/jeux/jongles/${x.json.id}`, { score: 500, frappes: frappes(500, 50) });
check('des frappes impossibles sont refusées', triche.status === 400);

x = await call('/api/jeux/jongles', {});
const p3 = x.json.id;
await pool.query('UPDATE jeux_jongles SET debut_a = NOW(3) - INTERVAL 5 SECOND WHERE id = ?', [p3]);
x = await call(`/api/jeux/jongles/${p3}`, { score: 60, frappes: frappes(60) });
check('des frappes plus longues que la partie sont refusées', x.status === 400);

moi = B;
x = await call('/api/jeux/jongles', {});
await pool.query('UPDATE jeux_jongles SET debut_a = NOW(3) - INTERVAL 60 SECOND WHERE id = ?', [x.json.id]);
x = await call(`/api/jeux/jongles/${x.json.id}`, { score: 31, frappes: frappes(31, 350) });
check('un second joueur jongle', x.json.score === 31);
x = await call(`/api/jeux/jongles/${p1.id}`, { score: 1, frappes: [0] });
check('la partie d’un autre est introuvable', x.status === 404);

moi = A;
x = await call('/api/jeux/classement/jongles');
check('le classement range par record', x.json.lignes.map((l) => l.pseudo).join() === 'Bruno,Alice'
  && x.json.moi?.rang === 2 && x.json.lignes[1].moi === true && x.json.lignes[0].valeur === 31);

/* --------------------------------------------------------- le plafond */

console.log('\n— le plafond du jour —');
await pool.query(`INSERT INTO recompenses (user_id, source, cle, echarpes) VALUES (?, 'jongles', 'essai', ?)`,
  [C, DEFAUTS['jeux.echarpes_jour'] - 2]);
moi = C;
x = await call('/api/jeux/jongles', {});
await pool.query('UPDATE jeux_jongles SET debut_a = NOW(3) - INTERVAL 60 SECOND WHERE id = ?', [x.json.id]);
x = await call(`/api/jeux/jongles/${x.json.id}`, { score: 50, frappes: frappes(50, 350) });
check('le plafond du jour ramène le gain', x.json.echarpes === 2);
x = await call('/api/jeux');
check('l’état dit ce qui a été gagné aujourd’hui', x.json.echarpes.aujourdhui === DEFAUTS['jeux.echarpes_jour']);

/* -------------------------------------------------------- tirs au but */

console.log('\n— les tirs au but —');
/* `fort` tire à gauche et plonge à droite, là où tire `faible` ; `faible`
   plonge en haut à droite, loin des tirs de `fort`. */
const fort = jeu([0, 0, 0, 0, 0], 0.7, [2, 2, 2, 2, 2]);
const faible = jeu([2, 2, 2, 2, 2], 0.7, [5, 5, 5, 5, 5]);
moi = A;
const avantA = await bourse(A);
x = await call('/api/jeux/tirs', { jeu: fort });
check('sans adversaire, la série attend', x.status === 200 && x.json.etat === 'attend');
const s1 = x.json.id;
x = await call('/api/jeux/tirs', { jeu: { tirs: [], arrets: [] } });
check('un jeu mal formé est refusé', x.status === 400);

moi = C;
x = await call('/api/jeux/tirs', { jeu: faible });
check('le joueur suivant relève la série et la règle aussitôt', x.json.etat === 'jouee'
  && x.json.id === s1 && x.json.mesButs === 0 && x.json.sesButs === 5 && x.json.issue === 'defaite');

moi = A;
check('le premier tireur est payé de sa victoire', await bourse(A) === avantA + DEFAUTS['jeux.tirs_victoire']);
x = await call('/api/jeux/attente');
check('le sticker du menu compte le résultat neuf', x.json.resultats === 1 && x.json.defis === 0);
x = await call('/api/jeux');
const vue = x.json.tirs.series.find((s) => s.id === s1);
check('il voit la série gagnée, marquée nouvelle', vue?.etat === 'jouee' && vue.issue === 'victoire'
  && vue.nouveau === true && vue.adversaire?.pseudo === 'Chloe' && vue.coups.length === 10);
await call('/api/jeux/tirs-vus', {});
x = await call('/api/jeux/attente');
check('vu, il ne compte plus', x.json.resultats === 0);

x = await call('/api/jeux/tirs', { jeu: fort, ami: C });
check('on ne défie pas quelqu’un qui n’est pas un ami', x.status === 403);
x = await call('/api/jeux/tirs', { jeu: fort, ami: B });
check('on défie un ami', x.json.etat === 'attend');
const defi = x.json.id;
x = await call('/api/jeux/tirs', { jeu: fort, ami: B });
check('un seul défi en cours au même ami', x.status === 409);

moi = C;
x = await call('/api/jeux/tirs', { jeu: faible });
check('un défi d’ami n’est pas relevé par un inconnu', x.json.etat === 'attend' && x.json.id !== defi);
const s3 = x.json.id;
x = await call(`/api/jeux/tirs/${defi}`, { jeu: faible });
check('ni par quelqu’un d’autre que l’ami', x.status === 404);

moi = B;
x = await call('/api/jeux/attente');
check('l’ami voit le défi qui l’attend', x.json.defis === 1);
x = await call('/api/jeux');
check('le défi est à relever', x.json.tirs.series.some((s) => s.id === defi && s.etat === 'a_relever'));
x = await call(`/api/jeux/tirs/${defi}`, { jeu: fort });
check('l’ami relève le défi', x.json.etat === 'jouee' && x.json.issue === 'nul');
x = await call(`/api/jeux/tirs/${defi}`, { jeu: fort });
check('un défi ne se relève qu’une fois', x.status === 409);

/* La série de Chloé attend depuis trop longtemps : la machine la joue. */
await pool.query(`UPDATE jeux_tirs SET cree_a = NOW(3) - INTERVAL ? HOUR WHERE id = ?`,
  [DEFAUTS['jeux.tirs_attente_h'] + 1, s3]);
moi = C;
x = await call('/api/jeux');
const machine = x.json.tirs.series.find((s) => s.id === s3);
check('sans adversaire trop longtemps, la machine joue la série', machine?.etat === 'jouee'
  && machine.machine === true && machine.adversaire?.machine === true);

moi = A;
x = await call('/api/jeux/classement/tirs');
const ligne = (p) => x.json.lignes.find((l) => l.pseudo === p);
check('le classement des tirs : 3 points la victoire, 1 le nul, rien contre la machine',
  ligne('Alice')?.valeur === 4 && ligne('Alice').victoires === 1 && ligne('Alice').nuls === 1
  && ligne('Bruno')?.valeur === 1 && ligne('Chloe')?.valeur === 0 && ligne('Chloe').parties === 1
  && x.json.lignes[0].pseudo === 'Alice');
x = await call('/api/jeux/classement/tirs?portee=amis');
check('le classement entre amis ne garde que moi et mes amis',
  x.json.lignes.map((l) => l.pseudo).sort().join() === 'Alice,Bruno');

/* ------------------------------------------------------- une saison neuve */

console.log('\n— une saison neuve —');
await pool.query(`INSERT INTO saisons (numero, nom, series, tenues, lancee_a)
  VALUES (2, 'Essai', '[]', '[]', NOW(3) + INTERVAL 1 SECOND)`);
await new Promise((ok) => setTimeout(ok, 1100));
await chargerSaisons(pool);
x = await call('/api/jeux/classement/jongles');
check('les compteurs repartent de zéro', x.json.lignes.length === 0 && x.json.saison?.numero === 2);
x = await call('/api/jeux');
check('le record de la saison aussi', x.json.jongles.record === null);
x = await call('/api/jeux/tirs', { jeu: fort });
check('une série d’une saison ne rencontre pas celles de la précédente', x.json.etat === 'attend');

/* ---------------------------------------------------------- éteint */

poserReglages({ ...DEFAUTS, 'jeux.actif': false });
x = await call('/api/jeux/jongles', {});
check('éteint, plus de partie neuve', x.status === 409);
poserReglages({ ...DEFAUTS });

http.close();
await pool.end();
if (failures) { console.error(`\n${failures} échec(s)`); process.exit(1); }
console.log('\nles mini-jeux tiennent.');
