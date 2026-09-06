/** Test des classements. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createClassements } from '../src/server/classements/index.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql','football.sql','duel.sql','souvenirs.sql','fanzzy.sql','inventaire.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
await raw.query(`INSERT INTO teams (id,name,country) VALUES
  (85,'Petit Club','Suisse'),(91,'Gros Club','France')`);

// Petit Club : 2 supporters très actifs. Gros Club : 4 supporters mous.
const gens = [
  ['u1','Momo',85,900],['u2','Sarah',85,700],
  ['u3','Kevin',91,300],['u4','Lila',91,120],['u5','Theo',91,60],['u6','Ines',91,20],
];
for (const [id,pseudo,club,ferveur] of gens) {
  const pid = `${id}0000-0000-0000-0000-00000000000${id.slice(1)}`.slice(0,36);
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [pid,`${id}@ex.fr`,pseudo]);
  await raw.query(`INSERT INTO user_follows (user_id,team_id,is_main) VALUES (?,?,1)`,[pid,club]);
  await raw.query(`INSERT INTO virage_presence (user_id,fixture_id,side,ferveur) VALUES (?,?,0,?)`,
    [pid, 7001, ferveur]);
  await raw.query(`INSERT INTO duel_results (duel_id,user_id,opponent_id,outcome)
    VALUES (?,?,?,?),(?,?,?,?),(?,?,?,?)`,
    [`d1-${id}`,pid,'x','win', `d2-${id}`,pid,'x', ferveur>200?'win':'loss', `d3-${id}`,pid,'x','loss']);
}
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset:'utf8mb4' });
let moi = 'u10000-0000-0000-0000-000000000001'.slice(0,36);
const C = createClassements({ pool, requireAuth: (r,_s,n)=>{ r.user={id:moi}; n(); } });
const app = express(); app.use('/api/rank', C.router);
const http = createServer(app); await new Promise((r)=>http.listen(0,r));
const base = `http://localhost:${http.address().port}`;
const get = async (p) => (await fetch(base+p)).json();

let r = await get('/api/rank/supporters');
check('classement des supporters', r.classement.length === 6);
check('trié sur la ferveur', r.classement[0].pseudo === 'Momo' && Number(r.classement[0].ferveur) === 900);
check('le club du joueur est indiqué', r.classement[0].club === 'Petit Club');

r = await get('/api/rank/tribunes');
check('classement des tribunes', r.classement.length === 2);
check('le petit club passe devant grâce à la moyenne',
  r.classement[0].name === 'Petit Club');
const petit = r.classement.find((x)=>x.name==='Petit Club');
const gros = r.classement.find((x)=>x.name==='Gros Club');
check('la moyenne est bien par supporter',
  Number(petit.moyenne) === 800 && Number(gros.moyenne) === 125);
check('le gros club a plus de supporters mais moins de moyenne',
  gros.supporters > petit.supporters && Number(gros.moyenne) < Number(petit.moyenne));

r = await get('/api/rank/duellistes');
check('classement des duels', r.classement.length === 6);
check('trié sur les victoires', Number(r.classement[0].gagnes) === 2);
check('taux de victoire calculé', Number(r.classement[0].taux) === 67);

r = await get('/api/rank/moi');
check('ma ferveur', r.ferveur === 900);
check('mon rang', r.rang === 1 && r.sur === 6);
check('mes duels comptés', r.duels.joues === 3);

moi = 'u60000-0000-0000-0000-000000000006'.slice(0,36);
r = await get('/api/rank/moi');
check('le dernier est bien dernier', r.rang === 6);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
