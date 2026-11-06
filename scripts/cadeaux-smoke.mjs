/**
 * Les cadeaux de l'administration, annoncés au joueur (`src/server/cadeaux`).
 *
 *   — le journal devient une liste de cadeaux : écharpes et boosters ajoutés
 *     (sommés), Fanzzy, tenue, Ultimate, pièce, PASS, abonnement, badge
 *     Fondateur ; un retrait, un statut ou un rôle n'en sont pas ; le Fanzzy
 *     TheBestFan du cadeau Fondateur n'est dit qu'une fois ;
 *   — la route ne rend que ce qui n'a pas été vu, ne recule jamais, et garde
 *     la mémoire au compte (`user_wallet.cadeau_vu`) ou, sans la colonne, sur
 *     l'appareil (`?depuis=`) ;
 *   — un cadeau à un autre joueur ou vieux de plus de trente jours ne sort pas.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';
import { charger as chargerCatalogue } from '../src/server/fanzzy/catalogue.js';
import { chargerTenues } from '../src/server/fanzzy/tenues.js';
import { cadeauxDe, createCadeaux } from '../src/server/cadeaux/index.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
let echecs = 0;
const check = (l, c, ...x) => {
  console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`);
  if (!c) { echecs++; if (x.length) console.log('       ', JSON.stringify(x)); }
};

const DB = baseDeTest();
const mysql = await import('mysql2/promise');
const pool = mysql.createPool({ uri: DB, connectionLimit: 3, ...OPTIONS_BASE });
await chargerCatalogue(pool).catch(() => {});
await chargerTenues(pool).catch(() => {});

/* ---------------------------------------------------- le journal, traduit */
console.log('\n  le journal devient une liste de cadeaux');
const l = (action, detail) => ({ action, detail: JSON.stringify(detail) });
const liste = cadeauxDe([
  l('joueur.modifie', { scarves: 100 }),
  l('joueur.modifie', { scarves: 50, packs: 5 }),
  l('joueur.modifie', { scarves: -30, status: 'locked' }),
  l('joueur.modifie', { role: 'admin' }),
  l('joueur.offert', { sorte: 'fanzzy', fanzzy: 'TB1' }),
  l('fondateur.offert', { badge: true, fanzzy: true }),
  l('pass.accorder', { saison: 1 }),
  l('abonnement.accorder', { formule: 'offert', jours: null }),
]);
const sortes = liste.map((c) => c.sorte);
check('écharpes et boosters sommés (retrait déduit), en tête',
  liste[0]?.sorte === 'echarpes' && liste[0].n === 120 && liste[1]?.sorte === 'boosters' && liste[1].n === 5, liste);
check('un statut, un rôle ne sont pas des cadeaux', !liste.some((c) => c.n < 0) && liste.length === 6, liste);
check('le badge Fondateur et son Fanzzy, une fois chacun',
  sortes.filter((s) => s === 'distinction').length === 1
  && liste.filter((c) => c.sorte === 'fanzzy' && c.fanzzy === 'TB1').length === 1, sortes);
check('le PASS et l’abonnement', sortes.includes('pass') && sortes.includes('abonnement'), sortes);
check('un retrait se soustrait : on annonce le solde net, jamais plus',
  cadeauxDe([l('joueur.modifie', { scarves: 100 }), l('joueur.modifie', { scarves: -100 })]).length === 0);
const plafond = cadeauxDe([l('joueur.modifie', { packs: 5, recu: { scarves: 0, packs: 2 } })]);
check('les boosters vraiment reçus (plafond de 99), pas ceux demandés',
  plafond.length === 1 && plafond[0].n === 2, plafond);
check('un PASS qu’il avait déjà n’est pas annoncé',
  cadeauxDe([l('pass.accorder', { saison: 1, nouveau: false })]).length === 0);
check('un cadeau Fondateur déjà reçu (ni badge ni Fanzzy) n’annonce rien',
  cadeauxDe([l('fondateur.offert', { badge: false, fanzzy: false })]).length === 0);
check('rien du tout pour un journal sans cadeau',
  cadeauxDe([l('joueur.modifie', { status: 'locked' }), l('kop.supprime', {})]).length === 0);

/* -------------------------------------------------------------- la route */
console.log('\n  la route, vu jusqu’où');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query('DROP TABLE IF EXISTS admin_audit');
for (const f of ['admin.sql']) {
  await raw.query(readFileSync(path.join(RACINE, 'sql', f), 'utf8').replace(/ALTER TABLE users[^;]*;/g, ''));
}
await raw.query(`CREATE TABLE IF NOT EXISTS user_wallet (user_id CHAR(36) NOT NULL PRIMARY KEY)
  ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
await raw.query('ALTER TABLE user_wallet DROP COLUMN IF EXISTS cadeau_vu');
const A = 'aaaaaaaa-0000-0000-0000-00000000ca01';
const B = 'aaaaaaaa-0000-0000-0000-00000000ca02';
await raw.query('DELETE FROM user_wallet WHERE user_id IN (?, ?)', [A, B]);
/* La base des suites a souvent `users` et sa clé étrangère : on y pose les
   deux joueurs ; une base vide n'a que la petite bourse ci-dessus. */
for (const [id, n] of [[A, 1], [B, 2]]) {
  await raw.query(`INSERT IGNORE INTO users (public_id, email, pseudo, password_hash)
    VALUES (?, ?, ?, 'x')`, [id, `cadeau${n}@ex.fr`, `Cadeau${n}`]).catch(() => {});
}
await raw.query('INSERT INTO user_wallet (user_id) VALUES (?), (?)', [A, B]);
const journal = (cible, action, detail, au = null) => raw.query(
  `INSERT INTO admin_audit (acteur, action, cible, detail${au ? ', au' : ''}) VALUES ('adm', ?, ?, ?${au ? ', ?' : ''})`,
  [action, cible, JSON.stringify(detail), ...(au ? [au] : [])]);
await journal(A, 'joueur.modifie', { scarves: 999 }, '2026-01-01 10:00:00');
await journal(A, 'joueur.modifie', { scarves: 100 });
await journal(B, 'joueur.modifie', { packs: 3 });
await journal(A, 'joueur.offert', { sorte: 'stuff', stuff: 'inconnu' });

const C = createCadeaux({ pool, requireAuth: (_q, _r, n) => n() });

let r = await C.lire(A);
check('sans la colonne : la mémoire est sur l’appareil', r.memoire === 'appareil', r);
check('seulement ses cadeaux, des trente derniers jours',
  r.cadeaux.length === 2 && r.cadeaux[0].sorte === 'echarpes' && r.cadeaux[0].n === 100, r.cadeaux);
const r2 = await C.lire(A, r.jusqua);
check('l’appareil envoie ce qu’il a vu : plus rien', r2.cadeaux.length === 0, r2);
check('et marquer vu sans la colonne ne casse rien', (await C.marquerVu(A, r.jusqua)) === false);

await raw.query(readFileSync(path.join(RACINE, 'sql', 'cadeaux.sql'), 'utf8'));
r = await C.lire(A);
check('avec la colonne : la mémoire est au compte, et tout revient tant que rien n’est vu',
  r.memoire === 'compte' && r.cadeaux.length === 2, r);
await C.marquerVu(A, r.jusqua);
check('vu au compte : plus rien, sur n’importe quel appareil', (await C.lire(A)).cadeaux.length === 0);
await C.marquerVu(A, 1);
check('et le numéro vu ne recule jamais', (await C.lire(A)).cadeaux.length === 0);
await journal(A, 'pass.accorder', { saison: 1 });
r = await C.lire(A);
check('un nouveau cadeau arrive seul', r.cadeaux.length === 1 && r.cadeaux[0].sorte === 'pass', r.cadeaux);
check('l’autre joueur a le sien', (await C.lire(B)).cadeaux[0]?.n === 3);
await journal(B, 'joueur.modifie', { status: 'locked' });
const vuB = (await C.lire(B)).jusqua;
await C.marquerVu(B, vuB);
await journal(B, 'joueur.modifie', { role: 'admin' });
const rb = await C.lire(B);
const [[w]] = await raw.query('SELECT cadeau_vu FROM user_wallet WHERE user_id = ?', [B]);
check('une ligne sans cadeau est marquée vue d’elle-même', rb.cadeaux.length === 0 && Number(w.cadeau_vu) === rb.jusqua, rb, w);

await pool.end();
await raw.end();
console.log(echecs ? `\n${echecs} échec(s)` : '\ntout est vert');
process.exit(echecs ? 1 : 0);
