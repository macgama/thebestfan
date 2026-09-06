/** Test de la collection Fanzzy côté serveur. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createFanzzy, MAX_PACKS, PACK_PRICE } from '../src/server/fanzzy/index.js';
import { DEX, BY_ID } from '../src/shared/fanzzy/dex.js';
import { SKINS } from '../src/shared/fanzzy/inventaire.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = '11111111-2222-3333-4444-555555555555';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'f@ex.fr', 'Fan']);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
const F = createFanzzy({ pool, requireAuth: (req, _r, next) => { req.user = { id: U }; next(); } });
const app = express(); app.use('/api/fanzzy', F.router);
const http = createServer(app); await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const call = async (p, o = {}) => {
  const r = await fetch(base + p, { method: o.method ?? 'GET',
    headers: { 'content-type': 'application/json' },
    body: o.body === undefined ? undefined : JSON.stringify(o.body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

let r = await call('/api/fanzzy/dex');
check('catalogue servi', r.json.dex?.length === DEX.length && r.json.sets?.length === 2);

r = await call('/api/fanzzy/state');
check('réserve pleine au départ', r.json.wallet.packs === MAX_PACKS);
check('aucune écharpe au départ', r.json.wallet.scarves === 0);
check('collection vide', Object.keys(r.json.collection).length === 0);

r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN' } });
check('cinq cartes tirées', r.json.cards?.length === 5);
check('toutes typées', r.json.cards.every((c) => c.type === 'fanzzy' || c.type === 'skin'));
check('aucun skin au premier booster',
  r.json.cards.every((c) => c.type === 'fanzzy'));
check('toutes du bon set',
  r.json.cards.filter((c) => c.type === 'fanzzy').every((c) => BY_ID.get(c.id).set === 'VN'));
check('trois communes garanties',
  r.json.cards.slice(0, 3).every((c) => c.type === 'fanzzy' && BY_ID.get(c.id).rar === 'd1'));
check('un booster consommé', r.json.wallet.packs === MAX_PACKS - 1);
check('la recharge est amorcée', typeof r.json.wallet.nextPackInMs === 'number');
check('un Fanzzy est équipé d\u2019office', Boolean(r.json.wallet.active));

r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'NE' } });
check('deuxième série disponible',
  r.json.cards.filter((c) => c.type === 'fanzzy').every((c) => BY_ID.get(c.id).set === 'NE'));

const [[baseSkin]] = await pool.query(
  `SELECT COUNT(*) AS n FROM user_skins WHERE user_id = ? AND skin_id = 'base'`, [U]);
check('chaque Fanzzy reçoit son skin de base', baseSkin.n >= 1);

// Sur beaucoup d'ouvertures, des skins doivent finir par tomber.
await pool.query('UPDATE user_wallet SET packs = 40 WHERE user_id = ?', [U]);
let skinsTombes = 0;
let premieresToutesFanzzy = true;
for (let i = 0; i < 40; i++) {
  const o = await call('/api/fanzzy/open', { method: 'POST', body: { set: i % 2 ? 'NE' : 'VN' } });
  const cartes = o.json.cards ?? [];
  skinsTombes += cartes.filter((c) => c.type === 'skin').length;
  if (cartes.slice(0, 3).some((c) => c.type !== 'fanzzy')) premieresToutesFanzzy = false;
}
check(`des skins tombent dans les boosters (${skinsTombes} sur 200 cartes)`, skinsTombes > 5);
check('les trois premières cartes restent des supporters', premieresToutesFanzzy);

const [skinsRecus] = await pool.query(
  `SELECT DISTINCT fanzzy_id FROM user_skins WHERE user_id = ? AND skin_id <> 'base'`, [U]);
const [possedes] = await pool.query(`SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [U]);
const ids = new Set(possedes.map((p) => p.fanzzy_id));
check('un skin ne tombe que pour un Fanzzy possédé',
  skinsRecus.every((s) => ids.has(s.fanzzy_id)));

// On vide la réserve pour vérifier le refus puis l'achat.
await pool.query('UPDATE user_wallet SET packs = 0 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN' } });
check('sans booster : refus', r.json.error === 'fanzzy.error.no_packs');

// Solde remis à zéro explicitement : les doublons des ouvertures précédentes
// pourraient sinon suffire à payer, et le test ne vérifierait plus rien.
await pool.query('UPDATE user_wallet SET scarves = 0 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN', buy: true } });
check('sans écharpes non plus', r.json.error === 'fanzzy.error.not_enough_scarves');

await pool.query('UPDATE user_wallet SET scarves = 500 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN', buy: true } });
check('booster acheté en écharpes', r.json.cards?.length === 5);
// Le prix est débité, mais les doublons du même booster recréditent aussitôt :
// c'est le solde net qu'il faut vérifier, pas une simple soustraction.
check('solde exact après achat et doublons',
  r.json.wallet.scarves === 500 - PACK_PRICE + r.json.scarvesGained);

r = await call('/api/fanzzy/state');
const col = r.json.collection;
check('les doublons sont comptés', Object.values(col).some((n) => n > 1));
check('les doublons ont rapporté', r.json.wallet.scarves > 500 - PACK_PRICE);

/* --------------------------------------------------------- évolution */

const base1 = DEX.find((f) => f.stage === 1 && f.evo);
await pool.query(`INSERT INTO user_fanzzy (user_id,fanzzy_id,copies) VALUES (?,?,1)
                  ON DUPLICATE KEY UPDATE copies = copies + 1`, [U, base1.id]);
await pool.query('UPDATE user_wallet SET scarves = 5 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: base1.id } });
check('évolution refusée sans écharpes', r.json.error === 'fanzzy.error.not_enough_scarves');

await pool.query('UPDATE user_wallet SET scarves = 300 WHERE user_id = ?', [U]);
r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: base1.id } });
check('évolution acceptée', r.json.to === base1.evo);
check('écharpes débitées', r.json.wallet.scarves === 300 - r.json.spent);

const [[after]] = await pool.query(
  'SELECT copies FROM user_fanzzy WHERE user_id = ? AND fanzzy_id = ?', [U, base1.evo]);
check('la forme évoluée est en collection', after.copies >= 1);

const last = DEX.find((f) => !f.evo);
r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: last.id } });
check('un Fanzzy sans évolution est refusé', r.json.error === 'fanzzy.error.no_evolution');

r = await call('/api/fanzzy/evolve', { method: 'POST', body: { id: 'X-INEXISTANT' } });
check('identifiant inconnu refusé', r.json.error === 'fanzzy.error.no_evolution');

/* -------------------------------------------------------- équipement */

r = await call('/api/fanzzy/active', { method: 'POST', body: { id: base1.evo } });
check('Fanzzy équipé', r.json.active === base1.evo);
const eq = await F.activeFanzzy(U);
check('le duel peut le lire', eq?.id === base1.evo && Boolean(eq.mods));

const jamais = DEX.find((f) => !Object.keys(col).includes(f.id) && f.id !== base1.evo);
r = await call('/api/fanzzy/active', { method: 'POST', body: { id: 'Z9' } });
check('Fanzzy inexistant refusé', r.json.error === 'fanzzy.error.unknown');

/* ------------------------------------------------------- concurrence */

await pool.query('UPDATE user_wallet SET packs = 1, scarves = 0 WHERE user_id = ?', [U]);
const deux = await Promise.all([
  call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN' } }),
  call('/api/fanzzy/open', { method: 'POST', body: { set: 'VN' } }),
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
check('catalogue de l\u2019équipement servi', r.json.stuff.length === 7);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
