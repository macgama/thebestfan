/**
 * Le pronostic (`src/server/pronostics/index.js`).
 *
 * Ce qu'on éprouve, à la valeur exacte :
 *
 *   1. l'issue : score exact, bon vainqueur, bon nul, raté ;
 *   2. la porte : seulement les matchs d'un club suivi, seulement avant le
 *      coup d'envoi, et rien quand le pronostic est éteint ;
 *   3. le règlement : 50 pour l'exact, 15 pour le vainqueur, 0 pour le raté,
 *      **une seule fois**, que ce soit au coup de sifflet, à la lecture, ou
 *      par les deux en même temps ;
 *   4. le disjoncteur retient un versement sans le perdre : il passe le jour
 *      où il redevient possible ;
 *   5. sans la table, les routes répondent sans planter.
 *
 * Aucun débit, jamais : la bourse ne descend pas.
 */
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer } from 'node:http';
import { createPronostics, issueDe, BUTS_MAX } from '../src/server/pronostics/index.js';
import { poserReglages } from '../src/shared/reglages.js';
import { baseDeTest, OPTIONS_BASE, enParallele } from './base-de-test.mjs';

const DB = baseDeTest();
const SQL = fileURLToPath(new URL('../sql/', import.meta.url));
let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };
const meme = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const mysql = await import('mysql2/promise');

async function appliquer(...fichiers) {
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  try {
    for (const f of fichiers) await raw.query(await readFile(path.join(SQL, `${f}.sql`), 'utf8'));
  } finally {
    await raw.end();
  }
}

{
  const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
  await raw.query('SET FOREIGN_KEY_CHECKS = 0');
  await raw.query(`DROP TABLE IF EXISTS pronostics, recompenses, missions_jour, compteurs_jour,
    user_nouveautes, user_wallet, user_follows, fixtures, teams, users`);
  await raw.query('SET FOREIGN_KEY_CHECKS = 1');
  await raw.end();
}
await appliquer('auth', 'football', 'admin', 'souvenirs', 'niveau', 'saisons', 'quotidien',
  'pronostics');

const pool = mysql.createPool({ uri: DB, connectionLimit: 12, ...OPTIONS_BASE });
const q = async (sql, params) => (await pool.execute(sql, params))[0];

/* ------------------------------------------------------------ 1. l'issue */

check('score exact', issueDe({ home: 2, away: 1 }, { home: 2, away: 1 }) === 'exact');
check('bon vainqueur à domicile', issueDe({ home: 1, away: 0 }, { home: 3, away: 1 }) === 'vainqueur');
check('bon vainqueur à l’extérieur', issueDe({ home: 0, away: 2 }, { home: 1, away: 4 }) === 'vainqueur');
check('bon nul, pas le bon score', issueDe({ home: 1, away: 1 }, { home: 2, away: 2 }) === 'vainqueur');
check('nul exact', issueDe({ home: 0, away: 0 }, { home: 0, away: 0 }) === 'exact');
check('raté', issueDe({ home: 2, away: 0 }, { home: 0, away: 1 }) === 'rate');
check('raté : un nul annoncé, une victoire', issueDe({ home: 1, away: 1 }, { home: 2, away: 1 }) === 'rate');

/* ---------------------------------------------------------- la scène */

async function joueur() {
  const id = randomUUID();
  await q(`INSERT INTO users (public_id, email, pseudo, password_hash) VALUES (?, ?, ?, 'x')`,
    [id, `${id}@t.local`, id.slice(0, 12)]);
  return id;
}
const SION = 85, BALE = 86, ZURICH = 87, GENEVE = 88;
for (const [id, name] of [[SION, 'Sion'], [BALE, 'Bâle'], [ZURICH, 'Zurich'], [GENEVE, 'Servette']]) {
  await q('INSERT INTO teams (id, name) VALUES (?, ?)', [id, name]);
}
let prochainMatch = 9000;
async function unMatch(home, away, { dansMinutes = 120, statut = 'NS' } = {}) {
  const id = ++prochainMatch;
  await q(`INSERT INTO fixtures (id, league_id, season, home_id, away_id, status_short, kickoff_at)
           VALUES (?, 207, 2026, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? MINUTE)`,
  [id, home, away, statut, dansMinutes]);
  return id;
}
async function finir(id, h, a, statut = 'FT') {
  await q(`UPDATE fixtures SET status_short = ?, home_goals = ?, away_goals = ?,
             kickoff_at = UTC_TIMESTAMP() - INTERVAL 2 HOUR WHERE id = ?`, [statut, h, a, id]);
}
const suivre = (u, t) => q('INSERT INTO user_follows (user_id, team_id) VALUES (?, ?)', [u, t]);
const echarpes = async (u) => Number((await q('SELECT scarves FROM user_wallet WHERE user_id = ?', [u]))[0]?.scarves ?? 0);

const app = express();
app.use((req, _res, suite) => { req.user = { id: req.get('x-joueur') }; suite(); });
const requireAuth = (req, res, suite) => (req.user?.id ? suite() : res.status(401).end());
const prono = createPronostics({ pool, requireAuth });
app.use('/api/pronostics', prono.router);
const http = createServer(app);
await new Promise((r) => http.listen(0, r));
const base = `http://127.0.0.1:${http.address().port}/api/pronostics`;
const lire = async (u, chemin = '') => {
  const r = await fetch(base + chemin, { headers: { 'x-joueur': u } });
  return { status: r.status, ...(await r.json()) };
};
const donner = async (u, id, home, away) => {
  const r = await fetch(`${base}/match/${id}`, { method: 'POST',
    headers: { 'x-joueur': u, 'content-type': 'application/json' },
    body: JSON.stringify({ home, away }) });
  return { status: r.status, ...(await r.json()) };
};

try {
  poserReglages({});

  /* ---------------------------------------------------------- 2. la porte */

  const A = await joueur();
  await suivre(A, SION);
  const m1 = await unMatch(SION, BALE);
  const ailleurs = await unMatch(ZURICH, GENEVE);

  let r = await lire(A, `/match/${m1}`);
  check('un match de mon club, avant le coup d’envoi : ouvert, sans pronostic',
    r.ouvert === true && r.prono === null && meme(r.gains, { vainqueur: 15, exact: 50 }));

  r = await lire(A, `/match/${ailleurs}`);
  check('un match d’autres clubs : fermé (pas_suivi)', r.ouvert === false && r.raison === 'pas_suivi');
  r = await donner(A, ailleurs, 1, 0);
  check('… et le pronostic y est refusé', r.status === 409 && r.error === 'prono.error.pas_suivi');

  r = await lire(A, '/match/123456');
  check('un match que le relevé ne connaît pas : inconnu', r.ouvert === false && r.raison === 'inconnu');

  r = await donner(A, m1, 2, 1);
  check('donner 2 – 1', r.status === 200 && meme(r.prono, { home: 2, away: 1 }));
  r = await donner(A, m1, 3, 1);
  check('le changer avant le coup d’envoi : 3 – 1', r.status === 200 && meme(r.prono, { home: 3, away: 1 }));
  r = await lire(A, `/match/${m1}`);
  check('une seule ligne, le dernier score', meme(r.prono, { home: 3, away: 1 })
    && (await q('SELECT COUNT(*) AS n FROM pronostics WHERE user_id = ?', [A]))[0].n === 1);

  for (const [h, a, nom] of [[-1, 0, 'négatif'], [1.5, 0, 'décimal'], [BUTS_MAX + 1, 0, 'au-delà du maximum'],
    ['deux', 1, 'du texte'], [null, 1, 'absent']]) {
    r = await donner(A, m1, h, a);
    check(`score ${nom} refusé`, r.status === 400 && r.error === 'prono.error.score_invalide');
  }
  r = await donner(A, m1, '2', '0');
  check('des chiffres en texte sont acceptés', r.status === 200 && meme(r.prono, { home: 2, away: 0 }));

  const commence = await unMatch(SION, ZURICH, { dansMinutes: -10, statut: '1H' });
  r = await donner(A, commence, 1, 0);
  check('match commencé : refusé (commence)', r.status === 409 && r.error === 'prono.error.commence');
  const enRetard = await unMatch(SION, GENEVE, { dansMinutes: -1 });
  r = await donner(A, enRetard, 1, 0);
  check('heure du coup d’envoi passée, statut pas encore relevé : refusé', r.status === 409);

  poserReglages({ 'prono.actif': false });
  r = await donner(A, m1, 1, 1);
  check('pronostic éteint : refusé (inactif)', r.status === 409 && r.error === 'prono.error.inactif');
  poserReglages({});

  /* ------------------------------------------------------ 3. le règlement */

  const B = await joueur();
  const C = await joueur();
  for (const u of [B, C]) await suivre(u, BALE);
  await donner(A, m1, 2, 0);     // exact
  await donner(B, m1, 1, 0);     // vainqueur
  await donner(C, m1, 0, 0);     // raté
  const avant = { A: await echarpes(A), B: await echarpes(B), C: await echarpes(C) };

  check('rien ne se règle avant la fin', (await prono.regler(m1)) === 0);
  await finir(m1, 2, 0);
  check('au coup de sifflet : trois réglés', (await prono.regler(m1)) === 3);
  check('exact : +50 écharpes', (await echarpes(A)) - avant.A === 50);
  check('vainqueur : +15 écharpes', (await echarpes(B)) - avant.B === 15);
  check('raté : rien, et rien de retiré', (await echarpes(C)) - avant.C === 0);
  const livre = await q(`SELECT user_id, echarpes FROM recompenses WHERE source = 'prono' AND cle = ? ORDER BY echarpes`,
    [String(m1)]);
  check('deux lignes au grand livre, clé le match', livre.length === 2
    && meme(livre.map((l) => l.echarpes), [15, 50]));

  check('régler deux fois ne paie rien de plus', (await prono.regler(m1)) === 0
    && (await echarpes(A)) - avant.A === 50);
  r = await lire(A, `/match/${m1}`);
  check('la fiche dit l’issue et le gain', meme(r.prono, { home: 2, away: 0, issue: 'exact', echarpes: 50 })
    && r.ouvert === false && r.raison === 'commence');
  r = await lire(C, `/match/${m1}`);
  check('… et le raté', meme(r.prono, { home: 0, away: 0, issue: 'rate', echarpes: 0 }));
  r = await donner(A, m1, 5, 5);
  check('un match fini ne se pronostique plus', r.status === 409);

  /* Le filet : le coup de sifflet manqué (redémarrage) se rattrape à la
     lecture, et la lecture et le règlement simultanés ne paient qu'une fois. */
  const m2 = await unMatch(BALE, SION);
  await donner(B, m2, 1, 1);
  await donner(A, m2, 0, 3);
  await finir(m2, 1, 1, 'AET');
  const avB = await echarpes(B);
  r = await lire(B, `/match/${m2}`);
  check('lu après la fin, sans coup de sifflet : réglé à la lecture (nul exact, +50)',
    meme(r.prono, { home: 1, away: 1, issue: 'exact', echarpes: 50 }) && (await echarpes(B)) - avB === 50);

  const avA = await echarpes(A);
  await enParallele(6, (i) => (i % 2 ? prono.regler(m2) : lire(A, `/match/${m2}`)));
  check('six règlements simultanés : payé une fois (raté, 0)', (await echarpes(A)) === avA
    && (await q(`SELECT issue FROM pronostics WHERE user_id = ? AND fixture_id = ?`, [A, m2]))[0].issue === 'rate');

  const m3 = await unMatch(SION, GENEVE);
  await donner(A, m3, 2, 1);
  await finir(m3, 3, 2);
  const avA3 = await echarpes(A);
  const promesses = [];
  for (let i = 0; i < 8; i++) promesses.push(i % 2 ? prono.regler(m3) : lire(A, `/match/${m3}`));
  await Promise.all(promesses);
  check('huit règlements simultanés d’un bon vainqueur : +15, une fois', (await echarpes(A)) - avA3 === 15
    && (await q(`SELECT COUNT(*) AS n FROM recompenses WHERE user_id = ? AND source = 'prono' AND cle = ?`,
      [A, String(m3)]))[0].n === 1);

  const liste = await lire(A);
  check('la liste rend mes pronostics, avec le score final', liste.pronostics.length === 3
    && liste.pronostics.every((p) => p.match.score && p.prono.issue)
    && liste.pronostics.some((p) => p.match.domicile === 'Sion' && p.match.exterieur === 'Bâle'));

  /* Éteint : rien ne se règle, rien n'est perdu. */
  const m4 = await unMatch(SION, BALE);
  await donner(A, m4, 1, 0);
  await finir(m4, 1, 0);
  poserReglages({ 'prono.actif': false });
  const avA4 = await echarpes(A);
  check('éteint : le coup de sifflet ne règle rien', (await prono.regler(m4)) === 0 && (await echarpes(A)) === avA4);
  poserReglages({});
  r = await lire(A, `/match/${m4}`);
  check('rallumé : réglé à la lecture (+50)', r.prono.issue === 'exact' && (await echarpes(A)) - avA4 === 50);

  /* ------------------------------------------------- 4. le disjoncteur */

  const D = await joueur();
  await suivre(D, SION);
  const m5 = await unMatch(SION, ZURICH);
  await donner(D, m5, 2, 2);
  await finir(m5, 2, 2);
  await q(`INSERT INTO user_wallet (user_id, scarves) VALUES (?, 0) ON DUPLICATE KEY UPDATE scarves = scarves`, [D]);
  await q(`INSERT INTO recompenses (user_id, source, cle, echarpes) VALUES (?, 'mission', 'essai', 80)`, [D]);
  poserReglages({ 'recompenses.plafond_echarpes_jour': 100 });
  check('au-delà du disjoncteur : pas réglé', (await prono.regler(m5)) === 0
    && (await q('SELECT regle_a FROM pronostics WHERE user_id = ?', [D]))[0].regle_a === null);
  r = await lire(D, `/match/${m5}`);
  check('… et la fiche montre le pronostic sans issue', meme(r.prono, { home: 2, away: 2 }));
  poserReglages({});
  r = await lire(D, `/match/${m5}`);
  check('le disjoncteur levé : réglé à la lecture suivante (+50)',
    r.prono.issue === 'exact' && (await echarpes(D)) === 50);

  /* ------------------------------------------------- 5. sans la table */

  const m6 = await unMatch(SION, BALE);
  await q('DROP TABLE pronostics');
  r = await lire(A, `/match/${m1}`);
  check('sans la table : la fiche répond, fermée (schema)', r.status === 200 && r.raison === 'schema');
  r = await donner(A, m6, 1, 0);
  check('… le pronostic est refusé proprement (503)', r.status === 503 && r.error === 'prono.error.schema');
  r = await lire(A);
  check('… la liste est vide', r.status === 200 && meme(r.pronostics, []));
  check('… et le coup de sifflet ne lève pas', (await prono.regler(m1)) === 0);
} finally {
  http.close();
  await pool.end();
}

console.log(rates ? `\n${rates} contrôle(s) en échec` : '\ntout est vert');
process.exitCode = rates ? 1 : 0;
