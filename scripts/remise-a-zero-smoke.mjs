/**
 * La remise à zéro de la Saison 1 (`scripts/remise-a-zero-saison1.mjs`).
 *
 * Ce qu'on éprouve, sur une base complète (tout `sql/`) et un faux Stripe :
 *
 *   1. le calendrier : la saison 1 finit le jour dit, les suivantes durent
 *      trois mois chacune, bout à bout ;
 *   2. l'essai ne touche à rien, ni à la base ni à Stripe ;
 *   3. sans « SAISON 1 » tapé, rien ne se fait ;
 *   4. pour de bon : une sauvegarde complète d'abord, chaque abonnement Stripe
 *      résilié (celui de la ligne et celui retrouvé par la commande), les
 *      joueurs et tout ce qui est à eux supprimés, l'admin gardé, connecté et
 *      remis à neuf, le catalogue et les réglages intacts, la saison 1
 *      relancée et les suivantes repoussées ;
 *   5. une table inconnue qui parle d'un joueur arrête tout.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseDeTest } from './base-de-test.mjs';
import { calendrier, VIDER } from './remise-a-zero-saison1.mjs';

const DB = baseDeTest();
const ICI = path.dirname(fileURLToPath(import.meta.url));
let rates = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) rates++; };
const meme = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------------------------------- 1. le calendrier */

check('fin mars : avril-juin, juillet-septembre, octobre-décembre, janvier-mars',
  meme(calendrier('2027-03-31', [2, 3, 4, 5]), [
    { numero: 2, ouvre_le: '2027-04-01', fin_le: '2027-06-30' },
    { numero: 3, ouvre_le: '2027-07-01', fin_le: '2027-09-30' },
    { numero: 4, ouvre_le: '2027-10-01', fin_le: '2027-12-31' },
    { numero: 5, ouvre_le: '2028-01-01', fin_le: '2028-03-31' },
  ]));
check('une fin au 30 mars : la saison 2 ouvre le 31 et finit le 30 juin',
  meme(calendrier('2027-03-30', [2]), [{ numero: 2, ouvre_le: '2027-03-31', fin_le: '2027-06-30' }]));

/* ------------------------------------------------------- la base complète */

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
const q = async (sql, p) => (await raw.query(sql, p))[0];
const vider = async () => {
  await q('SET FOREIGN_KEY_CHECKS = 0');
  for (const r of await q(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()`)) {
    await q(`DROP TABLE IF EXISTS \`${r.t}\``);
  }
  await q('SET FOREIGN_KEY_CHECKS = 1');
};
await vider();

const lancer = (args, entree = '', env = {}) => new Promise((resolve) => {
  const p = spawn(process.execPath, [path.join(ICI, ...args.slice(0, 1)), ...args.slice(1)], {
    env: { ...process.env, DATABASE_URL: DB, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.stdin.end(entree);
  p.on('close', (code) => resolve({ code, out }));
});

const schema = await lancer(['appliquer-schema.mjs']);
check('le schéma complet est posé', schema.code === 0);

/* Un admin, deux joueurs, et de quoi remplir les tables. */
const ADMIN = 'aaaaaaaa-0000-0000-0000-000000000001';
const J1 = 'bbbbbbbb-0000-0000-0000-000000000002';
const J2 = 'cccccccc-0000-0000-0000-000000000003';
await q(`INSERT INTO users (public_id, email, pseudo, password_hash, role, main_team_id) VALUES
  (?, 'gael@x.ch', 'Gael', 'h', 'admin', 33), (?, 'j1@x.ch', 'Joueur1', 'h', 'joueur', 40),
  (?, 'j2@x.ch', 'Joueur2', 'h', 'joueur', NULL)`, [ADMIN, J1, J2]);
const ids = Object.fromEntries((await q('SELECT public_id, id FROM users')).map((r) => [r.public_id, r.id]));
await q(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES
  (REPEAT('a', 64), ?, NOW() + INTERVAL 1 DAY), (REPEAT('b', 64), ?, NOW() + INTERVAL 1 DAY)`,
  [ids[ADMIN], ids[J1]]);
for (const u of [ADMIN, J1, J2]) {
  await q('INSERT INTO user_wallet (user_id, scarves) VALUES (?, 500)', [u]);
  await q(`INSERT INTO user_fanzzy (user_id, fanzzy_id) VALUES (?, 'RP1')`, [u]);
  await q('INSERT INTO pronostics (user_id, fixture_id, home_goals, away_goals) VALUES (?, 1, 2, 1)', [u]);
}
await q(`INSERT INTO duels (id, player0_id, player1_id, state_json) VALUES ('d1', ?, ?, '{}')`, [J1, ADMIN]);
await q(`INSERT INTO duel_results (duel_id, user_id, opponent_id, outcome) VALUES ('d1', ?, ?, 'win'),
  ('d1', ?, ?, 'loss')`, [J1, ADMIN, ADMIN, J1]);
await q(`INSERT INTO kops (id, team_id, nom, createur) VALUES ('k1', 40, 'Le Kop', ?)`, [J1]);
await q(`INSERT INTO kop_membres (kop_id, user_id, team_id) VALUES ('k1', ?, 40)`, [J1]);
await q(`INSERT INTO abonnements (user_id, formule, source, reference) VALUES (?, 'mensuel', 'stripe', 'sub_LIGNE')`, [J1]);
await q(`INSERT INTO achats (id, user_id, article, montant, stripe_session, etat) VALUES
  (1, ?, 'abo-mensuel', 399, 'cs_COMMANDE', 'livre')`, [ADMIN]);
await q(`INSERT IGNORE INTO fanzzy (id, nom, type, set_id, rar, mods, cri) VALUES
  ('RP1', 'Le Premier', 'chant', 'RP', 'commune', '{}', '{}')`);
await q(`INSERT IGNORE INTO tenues (id, nom) VALUES ('maillot-retro', 'Maillot rétro')`);
await q(`INSERT INTO notif_cles (id, publique, privee) VALUES (1, 'pub', 'priv')`);
await q(`INSERT INTO reglages (cle, valeur) VALUES ('pronostic.actif', 'true')
  ON DUPLICATE KEY UPDATE valeur = valeur`);
await q(`UPDATE saisons SET fin_le = '2026-12-31' WHERE numero = 1`);
for (const n of [2, 3, 4, 5]) {
  await q(`INSERT INTO saisons (numero, nom, ouvre_le, fin_le) VALUES (?, ?, ?, ?)`,
    [n, `Saison ${n}`, `${2026 + Math.ceil((n - 1) / 4)}-01-01`, '2027-03-31']);
}
const fanzzyAvant = (await q('SELECT COUNT(*) AS n FROM fanzzy'))[0].n;
const tenuesAvant = (await q('SELECT COUNT(*) AS n FROM tenues'))[0].n;

/* Le faux Stripe : il lit les commandes et les abonnements, et note les résiliations. */
const resilies = [];
const lus = [];
const faux = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'DELETE') resilies.push(req.url);
  else lus.push(req.url);
  if (req.url.startsWith('/checkout/sessions/cs_COMMANDE')) return res.end(JSON.stringify({ subscription: 'sub_COMMANDE' }));
  if (req.url.startsWith('/subscriptions/')) {
    return res.end(JSON.stringify({ id: req.url.split('/').pop(), status: req.method === 'DELETE' ? 'canceled' : 'active' }));
  }
  res.statusCode = 404; res.end('{}');
});
await new Promise((r) => faux.listen(0, '127.0.0.1', r));
const STRIPE = { STRIPE_SECRET_KEY: 'sk_test_x', TBF_STRIPE_API: `http://127.0.0.1:${faux.address().port}` };
const sauvegardes = mkdtempSync(path.join(os.tmpdir(), 'tbf-sauvegardes-'));
const env = { ...STRIPE, TBF_SAUVEGARDES: sauvegardes };
const compter = async () => (await q('SELECT COUNT(*) AS n FROM users'))[0].n;

/* ---------------------------------------------------------- 2. l'essai */

const essai = await lancer(['remise-a-zero-saison1.mjs'], '', env);
check('l’essai finit sans erreur', essai.code === 0);
check('l’essai annonce les deux abonnements Stripe à résilier',
  (essai.out.match(/résilié tout de suite/g) || []).length === 2);
check('l’essai annonce la saison 2 du 1er avril au 30 juin', /2 « Saison 2 » : du 2027-04-01 au 2027-06-30/.test(essai.out));
check('l’essai ne supprime personne', await compter() === 3);
check('l’essai ne résilie rien chez Stripe', resilies.length === 0);
check('l’essai ne sauvegarde rien', readdirSync(sauvegardes).length === 0);

/* ----------------------------------------------- 3. sans la confirmation */

const non = await lancer(['remise-a-zero-saison1.mjs', '--pour-de-bon'], 'oui\n', env);
check('« oui » n’est pas « SAISON 1 » : annulé', non.code === 1 && /Annulé/.test(non.out));
check('annulé : personne n’est supprimé, rien n’est résilié', await compter() === 3 && resilies.length === 0);

/* ------------------------------------------------------- 4. pour de bon */

const oui = await lancer(['remise-a-zero-saison1.mjs', '--pour-de-bon'], 'SAISON 1\n', env);
if (oui.code !== 0) console.log(oui.out);
check('pour de bon : fini sans erreur', oui.code === 0);
const fichiers = readdirSync(sauvegardes);
check('une sauvegarde est faite', fichiers.length === 1 && /^tbf-avant-saison1-.*\.sql\.gz$/.test(fichiers[0]));
const dump = fichiers[0] ? gunzipSync(readFileSync(path.join(sauvegardes, fichiers[0]))).toString('utf8') : '';
check('la sauvegarde contient les joueurs d’avant', dump.includes('Joueur1') && dump.includes('Dump completed'));
check('Stripe : les deux abonnements sont résiliés',
  meme(resilies.sort(), ['/subscriptions/sub_COMMANDE', '/subscriptions/sub_LIGNE']));
const restants = await q('SELECT public_id, pseudo, role, main_team_id FROM users');
check('seul le compte admin reste', restants.length === 1 && restants[0].public_id === ADMIN);
check('l’admin n’a plus de club de cœur (il le rechoisit)', restants[0]?.main_team_id === null);
check('la session de l’admin reste, celle du joueur non',
  meme((await q('SELECT user_id FROM sessions')).map((r) => r.user_id), [ids[ADMIN]]));
let pleines = [];
for (const t of VIDER) {
  const [n] = await q(`SELECT COUNT(*) AS n FROM \`${t}\``);
  if (Number(n.n)) pleines.push(`${t} (${n.n})`);
}
check(`toutes les tables des joueurs sont vides${pleines.length ? ` — pas : ${pleines.join(', ')}` : ''}`, !pleines.length);
check('le catalogue des Fanzzy et des tenues est intact',
  (await q('SELECT COUNT(*) AS n FROM fanzzy'))[0].n === fanzzyAvant
  && (await q('SELECT COUNT(*) AS n FROM tenues'))[0].n === tenuesAvant && fanzzyAvant > 0);
check('les réglages et les clés des notifications restent',
  (await q(`SELECT COUNT(*) AS n FROM reglages WHERE cle = 'pronostic.actif'`))[0].n === 1
  && (await q('SELECT COUNT(*) AS n FROM notif_cles'))[0].n === 1);
const saisons = await q(`SELECT numero, DATE_FORMAT(ouvre_le, '%Y-%m-%d') AS o, DATE_FORMAT(fin_le, '%Y-%m-%d') AS f,
  lancee_a IS NOT NULL AS lancee, TIMESTAMPDIFF(SECOND, lancee_a, NOW()) AS age,
  ouvre_le = CURDATE() AS ajd FROM saisons ORDER BY numero`);
check('la saison 1 est relancée à l’instant, ouverte aujourd’hui, dernier jour le 31 mars 2027',
  saisons[0].lancee === 1 && Number(saisons[0].age) < 60 && saisons[0].ajd === 1 && saisons[0].f === '2027-03-31');
check('les saisons 2 à 5 sont repoussées d’un trimestre, et pas lancées',
  meme(saisons.slice(1).map((s) => [s.numero, s.o, s.f, s.lancee]), [
    [2, '2027-04-01', '2027-06-30', 0], [3, '2027-07-01', '2027-09-30', 0],
    [4, '2027-10-01', '2027-12-31', 0], [5, '2028-01-01', '2028-03-31', 0]]));

/* -------------------------------------------- 5. une table inconnue */

await q(`CREATE TABLE vieux_scores (user_id CHAR(36) NOT NULL, score INT)`);
const bloque = await lancer(['remise-a-zero-saison1.mjs'], '', env);
check('une table inconnue avec user_id arrête même l’essai', bloque.code === 1 && /vieux_scores/.test(bloque.out));
await q('DROP TABLE vieux_scores');

faux.close();
await vider();
await raw.end();
console.log(rates ? `\n${rates} contrôle(s) en échec` : '\nTout passe.');
process.exit(rates ? 1 : 0);
