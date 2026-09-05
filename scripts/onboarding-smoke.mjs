/** Test de l'inscription, des emplacements de suivi et de l'inventaire. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createOnboarding, SLOTS_DEPART } from '../src/server/onboarding/index.js';
import { BY_ID } from '../src/shared/fanzzy/dex.js';
import { STUFF_BY_ID, combine } from '../src/shared/fanzzy/inventaire.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence, souvenirs,
                 user_wallet, api_cache, souvenir_leagues, duel_results, duel_events, duels,
                 user_follows, fixture_events, standings, fixtures, team_leagues, teams, leagues,
                 api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'fanzzy.sql', 'inventaire.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const U = 'cccccccc-0000-0000-0000-000000000001';
await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
  [U, 'n@ex.fr', 'Nouveau']);
await raw.query(`INSERT INTO teams (id,name) VALUES (85,'FC Sion'),(91,'FC Bâle'),(61,'PSG'),(7,'OM')`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });
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
check('catalogue servi', r.json.skins.length === 7 && r.json.stuff.length === 7);

r = await call('/api/me/state');
check('deux emplacements au départ', r.json.slots.total === SLOTS_DEPART);
check('inscription non terminée', r.json.onboarded === false);

/* ------------------------------------------------------ le paquet */

r = await call('/api/me/welcome', { body: { teamId: 85 } });
const cartes = r.json.cartes;
check('cinq cartes', cartes.length === 5);
check('deux Fanzzy', cartes.filter((c) => c.type === 'fanzzy').length === 2);
check('au moins un Fanzzy peu commun ou mieux',
  cartes.some((c) => c.type === 'fanzzy' && BY_ID.get(c.id).rar !== 'd1'));
check('une pièce d\u2019équipement', cartes.filter((c) => c.type === 'stuff').length === 1);
check('une carte d\u2019action', cartes.filter((c) => c.type === 'action').length === 1);
check('des écharpes', r.json.scarves >= 80);
check('un Fanzzy équipé d\u2019office', Boolean(r.json.activeFanzzy));

r = await call('/api/me/state');
check('le club choisi est suivi et principal',
  r.json.follows[0]?.team_id === 85 && r.json.follows[0].is_main === 1);
check('inscription terminée', r.json.onboarded === true);
check('le skin de base est donné avec le Fanzzy',
  r.json.skins.some((s) => s.skin_id === 'base' && s.equipped === 1));
check('l\u2019équipement reçu est porté', r.json.stuff.some((s) => s.slot === 1));
check('la carte d\u2019action est en poche', r.json.actions.length === 1);

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
