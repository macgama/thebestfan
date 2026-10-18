/**
 * Les mini-jeux d'entre les matchs, côté serveur : les règles pures, puis les
 * routes sur une vraie base (jongles, tirs au but, chant en rythme,
 * déplacement, tifo du club, boss de la semaine, classements, écharpes).
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
  CHANT, partitionDuChant, noterChant, COURSE, nouvelleCourse, rejouerCourse, gainDeScore,
  TIFO, lettresDuClub, motifDuTifo, fideliteDuTifo,
} from '../src/shared/mini-jeux.js';
import { brancherLaVoix, chantReussiPour, verserLaVoix } from '../src/server/jeux/voix.js';
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


/* Le chant en rythme. */
const part = partitionDuChant(12345);
check('la partition sort de la graine, la même à chaque fois',
  JSON.stringify(part) === JSON.stringify(partitionDuChant(12345))
  && JSON.stringify(part) !== JSON.stringify(partitionDuChant(54321)));
check('des notes sur trois tambours, dans le temps du chant', part.notes.length >= 40
  && part.notes.every((n, i) => n.c >= 0 && n.c < 3 && n.t >= CHANT.DEBUT_MS && n.t <= CHANT.DUREE_MS
    && (i === 0 || n.t > part.notes[i - 1].t)));
const pile = part.notes.map((n) => ({ c: n.c, t: n.t + 10 }));
let note = noterChant(part, pile);
check('frappé pile : tout est PARFAIT, et la série multiplie', note.parfaits === part.notes.length
  && note.serieMax === part.notes.length && note.score > part.notes.length * CHANT.POINTS_PARFAIT * 2);
note = noterChant(part, part.notes.map((n) => ({ c: n.c, t: n.t + 100 })));
check('un peu en retard : BON', note.bons === part.notes.length && note.parfaits === 0);
note = noterChant(part, part.notes.map((n) => ({ c: (n.c + 1) % 3, t: n.t })));
check('le mauvais tambour : tout est raté, et chaque frappe est fausse',
  note.reussis === 0 && note.rates === part.notes.length && note.fausses === part.notes.length && note.score === 0);
const avecFausses = [...pile];
avecFausses.splice(20, 0, { c: (pile[20].c + 1) % 3, t: pile[20].t - 5 });
note = noterChant(part, avecFausses);
check('une frappe fausse casse la série', note.fausses === 1 && note.serieMax < part.notes.length);
const partout = [];
for (let t = 0; t < CHANT.DUREE_MS; t += 40) for (let c = 0; c < 3; c++) partout.push({ c, t });
check('taper partout tout le temps est refusé', noterChant(part, partout) === null);
check('des frappes dans le désordre sont refusées', noterChant(part, [{ c: 0, t: 900 }, { c: 0, t: 800 }]) === null);
check('un tambour inconnu est refusé', noterChant(part, [{ c: 3, t: 900 }]) === null);
check('une écharpe tous les tant de points, au plus le plafond',
  gainDeScore(9000, { parEcharpe: 2000, maxPartie: 12 }) === 4
  && gainDeScore(1e6, { parEcharpe: 2000, maxPartie: 12 }) === 12);

/* Le déplacement. Un joueur appliqué : il saute ce qui est bas, glisse sous
   le péage, au bon moment, et note ses gestes. */
function courir(graine, imagesMax = 60 * 40) {
  const c = nouvelleCourse(graine);
  const gestes = [];
  while (!c.etat.fini && c.etat.image < imagesMax) {
    const s = c.etat;
    const devant = s.route.find((o) => o.type !== 'ticket' && o.x + o.l > s.dist + COURSE.X);
    let g = 0;
    if (devant && s.y === 0) {
      const d = devant.x - (s.dist + COURSE.X + COURSE.LARGEUR);
      if (devant.type === 'peage' && d < s.v * 0.2 && s.glisse < 2) g = 2;
      else if (devant.type !== 'peage' && d < s.v * 0.12 + 8 && d > 0) g = 1;
    }
    if (g) gestes.push([s.image, g]);
    c.pas(g);
  }
  return { gestes, etat: c.etat };
}
const sansRien = rejouerCourse(7, []);
check('sans geste, la course s’arrête à la première barrière', sansRien.images < 60 * 8 && sansRien.metres > 0);
const bien = courir(7);
const rejouee = rejouerCourse(7, bien.gestes);
check('un joueur appliqué va loin', rejouee.metres > 150);
check('le serveur rejoue la même course que la page', rejouee.images === bien.etat.image
  || (bien.etat.image === 60 * 40 && !bien.etat.fini));
check('des gestes dans le désordre ou inconnus sont refusés', rejouerCourse(7, [[10, 1], [5, 1]]) === null
  && rejouerCourse(7, [[10, 3]]) === null && rejouerCourse(7, 'x') === null);

/* Le tifo. */
const motif = motifDuTifo(lettresDuClub('PSG', 'Paris'));
check('le motif : 20 × 12 cases, trois couleurs, les lettres du club',
  motif.length === TIFO.COLONNES * TIFO.RANGS && motif.every((c) => c >= 0 && c < 3)
  && motif.filter((c) => c === 1).length > 60);
check('les lettres : le code, sinon le nom sans accents', lettresDuClub(null, 'Bâle FC') === 'BAL'
  && lettresDuClub('ol', 'Lyon') === 'OL');
check('la fidélité compte les cases justes', fideliteDuTifo(motif, motif) === 1
  && fideliteDuTifo(motif, new Array(motif.length).fill(null)) === 0);

/* ============================================================== la base */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS jeux_jongles, jeux_tirs, jeux_parties, jeux_tifo, jeux_boss, pronostics, parrainages, contenus, abonnements,
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

/* ------------------------------------------------- chant, déplacement */

console.log('\n— le chant en rythme et le déplacement —');
poserReglages({ ...DEFAUTS, 'jeux.echarpes_jour': 500 });
moi = C;
x = await call('/api/jeux/partie/chant', {});
const pc = x.json;
check('une partie de chant s’ouvre avec sa graine', Number.isInteger(pc.id) && Number.isInteger(pc.graine));
const partC = partitionDuChant(pc.graine);
const frappesC = partC.notes.map((n) => ({ c: n.c, t: n.t + 20 }));
x = await call(`/api/jeux/partie/chant/${pc.id}`, { frappes: frappesC });
check('des frappes venues trop tôt sont refusées', x.status === 400);
await pool.query('UPDATE jeux_parties SET debut_a = NOW(3) - INTERVAL 50 SECOND WHERE id = ?', [pc.id]);
const attendu = noterChant(partC, frappesC);
x = await call(`/api/jeux/partie/chant/${pc.id}`, { frappes: frappesC, score: 999999 });
check('le serveur note le chant lui-même', x.status === 200 && x.json.score === attendu.score
  && x.json.parfaits === partC.notes.length && x.json.nouveauRecord === true);
check('et le paie', x.json.echarpes === gainDeScore(attendu.score, { parEcharpe: DEFAUTS['jeux.chant_par_echarpe'],
  maxPartie: DEFAUTS['jeux.chant_max_partie'] }) && await bourse(C) >= x.json.echarpes);
x = await call(`/api/jeux/partie/chant/${pc.id}`, { frappes: frappesC });
check('une partie finie ne se rejoue pas', x.status === 409);
x = await call('/api/jeux/partie/deplacement', {});
const pd = x.json;
const course = courir(pd.graine);
x = await call(`/api/jeux/partie/deplacement/${pd.id}`, { gestes: course.gestes });
check('une course plus rapide que le temps est refusée', x.status === 400);
await pool.query(`UPDATE jeux_parties SET debut_a = NOW(3) - INTERVAL ? SECOND WHERE id = ?`,
  [Math.ceil(course.etat.image / 60) + 2, pd.id]);
const attenduC = rejouerCourse(pd.graine, course.gestes);
x = await call(`/api/jeux/partie/deplacement/${pd.id}`, { gestes: course.gestes });
check('le serveur rejoue la course et garde sa distance', x.status === 200
  && x.json.score === attenduC.score && x.json.metres === attenduC.metres);
x = await call('/api/jeux/partie/rien', {});
check('un jeu inconnu n’existe pas', x.status === 404);
x = await call('/api/jeux');
check('l’état dit les records des deux jeux', x.json.chant.record === attendu.score
  && x.json.deplacement.record === attenduC.score && x.json.gains.chant.parEcharpe > 0);
x = await call('/api/jeux/classement/chant');
check('le chant a son classement', x.json.lignes.length === 1 && x.json.lignes[0].pseudo === 'Chloe'
  && x.json.lignes[0].valeur === attendu.score);
poserReglages({ ...DEFAUTS });

/* ---------------------------------------------------------- le tifo */

console.log('\n— le tifo du club —');
await pool.query(`INSERT INTO leagues (id, name) VALUES (61, 'Ligue 1')`).catch(() => {});
await pool.query(`INSERT INTO teams (id, name, code, color1, color2) VALUES (85, 'Paris SG', 'PSG', '#004170', '#DA291C'),
  (91, 'Monaco', 'MON', '#E51B22', '#FFFFFF')`);
await pool.query(`INSERT INTO fixtures (id, league_id, season, home_id, away_id, status_short, kickoff_at) VALUES
  (900, 61, 2026, 85, 91, 'NS', UTC_TIMESTAMP() + INTERVAL 2 DAY),
  (899, 61, 2026, 91, 85, 'FT', UTC_TIMESTAMP() - INTERVAL 1 DAY)`);
await pool.query(`INSERT INTO user_follows (user_id, team_id, is_main) VALUES (?, 91, 0), (?, 85, 1), (?, 85, 0)`,
  [A, A, B]);
moi = C;
x = await call('/api/jeux/tifo');
check('sans club suivi, pas de tifo', x.status === 200 && x.json.club === null);
moi = A;
x = await call('/api/jeux/tifo');
const motifPsg = motifDuTifo('PSG');
check('le tifo du prochain match du club, aux couleurs du club', x.json.club?.lettres === 'PSG'
  && x.json.club.couleurs[0] === '#004170' && x.json.prochain?.id === 900
  && x.json.prochain.adversaire === 'Monaco' && x.json.prochain.cases.every((c) => c === null)
  && JSON.stringify(x.json.motif) === JSON.stringify(motifPsg));
x = await call('/api/jeux/tifo', { match: 900, case: 21, couleur: motifPsg[21] });
check('on peint une case', x.status === 200 && x.json.mesCasesAujourdhui === 1);
x = await call('/api/jeux/tifo', { match: 899, case: 22, couleur: 0 });
check('le tifo d’un match commencé ne se peint plus', x.status === 409);
x = await call('/api/jeux/tifo', { match: 900, case: 240, couleur: 0 });
check('une case hors du tifo est refusée', x.status === 400);
poserReglages({ ...DEFAUTS, 'jeux.tifo_cases_jour': 2 });
x = await call('/api/jeux/tifo', { match: 900, case: 22, couleur: 1 });
const x2 = await call('/api/jeux/tifo', { match: 900, case: 23, couleur: 1 });
check('au plus tant de cases par jour', x.status === 200 && x2.status === 409
  && x2.json.error === 'jeux.error.tifo_plus_de_cases');
poserReglages({ ...DEFAUTS });
moi = B;
await call('/api/jeux/tifo', { match: 900, case: 22, couleur: motifPsg[22] });
x = await call('/api/jeux/tifo');
check('les cases de tous les supporters du club, la dernière couleur gagne',
  x.json.prochain.cases[21] === motifPsg[21] && x.json.prochain.cases[22] === motifPsg[22]
  && x.json.prochain.peintres === 2);
/* Le tifo du match d'hier, peint à 70 % juste par Alice. */
const justes = Math.ceil(motifPsg.length * 0.7);
await pool.query(`INSERT INTO jeux_tifo (team_id, fixture_id, case_n, couleur, user_id) VALUES ${
  motifPsg.slice(0, justes).map((c, i) => `(85, 899, ${i}, ${c}, '${A}')`).join(',')}`);
moi = A;
const avantTifo = await bourse(A);
x = await call('/api/jeux/tifo');
check('le tifo du match commencé est levé, réussi, et paie ceux qui ont peint',
  x.json.leve?.id === 899 && x.json.leve.reussi === true && x.json.leve.fidelite >= 0.7
  && x.json.leve.verse === DEFAUTS['jeux.tifo_gain'] && await bourse(A) === avantTifo + DEFAUTS['jeux.tifo_gain']);
x = await call('/api/jeux/tifo');
check('une seule fois', x.json.leve.verse === 0 && await bourse(A) === avantTifo + DEFAUTS['jeux.tifo_gain']);
moi = B;
x = await call('/api/jeux/tifo');
check('qui n’a pas peint ne reçoit rien', x.json.leve.reussi === true && x.json.leve.verse === 0);

/* ---------------------------------------------------------- le boss */

console.log('\n— la tribune contre le boss —');
poserReglages({ ...DEFAUTS, 'jeux.boss_voix_min': 5, 'jeux.boss_voix_par_supporter': 2 });
const debrancher = brancherLaVoix(pool);
await pool.query(`INSERT INTO jeux_boss (team_id, semaine, user_id, coups)
  VALUES (85, CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY - INTERVAL 1 WEEK, ?, 1)`, [A]);
moi = A;
x = await call('/api/jeux/boss');
check('le boss de la semaine : sa voix, rien de retiré encore', x.json.club?.id === 85
  && x.json.semaine.voix === 5 && x.json.semaine.retire === 0 && x.json.semaine.tombe === false
  && x.json.precedente.retire === 1 && x.json.precedente.tombe === false);
chantReussiPour(A, 3);
chantReussiPour(B, 1);
chantReussiPour(C, 4);
await verserLaVoix();
x = await call('/api/jeux/boss');
check('les chants réussis du club lui retirent sa voix (pas ceux d’un supporter sans club)',
  x.json.semaine.retire === 4 && x.json.semaine.mesCoups === 3 && x.json.semaine.tombe === false);
chantReussiPour(B, 1);
await verserLaVoix();
const avantBoss = await bourse(A);
x = await call('/api/jeux/boss');
check('le club le fait taire : chacun de ceux qui ont poussé est payé', x.json.semaine.tombe === true
  && x.json.semaine.verse === DEFAUTS['jeux.boss_gain'] && await bourse(A) === avantBoss + DEFAUTS['jeux.boss_gain']);
x = await call('/api/jeux/boss');
check('une seule fois par semaine', x.json.semaine.verse === 0);
moi = C;
x = await call('/api/jeux/boss');
check('sans club, pas de boss', x.json.club === null);
debrancher();
poserReglages({ ...DEFAUTS });

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
