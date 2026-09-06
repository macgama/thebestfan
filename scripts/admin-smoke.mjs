/** Test de l'administration : rôles, actions, traçabilité. */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createAdmin } from '../src/server/admin/index.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS reglages, admin_audit, user_decks, user_stuff, user_skins,
  user_fanzzy, user_souvenirs, virage_presence, souvenirs, user_wallet, api_cache,
  souvenir_leagues, duel_results, duel_events, duels, user_follows, fixture_events, standings,
  fixtures, team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql','football.sql','souvenirs.sql','fanzzy.sql','inventaire.sql',
                 'teletext.sql','admin.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const A = 'aaaa0000-0000-0000-0000-000000000001';   // futur admin
const B = 'bbbb0000-0000-0000-0000-000000000002';   // joueur
const C = 'cccc0000-0000-0000-0000-000000000003';   // second admin
for (const [id, mail, pseudo] of [[A,'patron@ex.fr','Patron'],[B,'joueur@ex.fr','Joueur'],
                                  [C,'second@ex.fr','Second']]) {
  await raw.query(`INSERT INTO users (public_id,email,pseudo,password_hash) VALUES (?,?,?,'x')`,
    [id, mail, pseudo]);
  await raw.query(`INSERT INTO user_wallet (user_id,scarves,packs) VALUES (?,100,5)`,[id]);
}
await raw.query(`INSERT INTO souvenir_leagues (league_id,season,name,country,family,tier,enabled,has_events)
  VALUES (207,2026,'Super League','Switzerland','championnat',2,1,1),
         (999,2026,'Petite Coupe','France','coupe',3,1,1)`);
await raw.query(`INSERT INTO api_cache (k,payload,expires_at) VALUES
  ('x','{}', NOW(3) + INTERVAL 1 HOUR),('y','{}', NOW(3) + INTERVAL 1 HOUR)`);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset:'utf8mb4' });
let moi = B;   // on commence en simple joueur
const adm = createAdmin({ pool,
  requireAuth: (r,_s,n)=>{ r.user = { id: moi, email: moi===A?'patron@ex.fr':'joueur@ex.fr' }; n(); } });
const app = express(); app.use('/api/admin', adm.router);
const http = createServer(app); await new Promise((r)=>http.listen(0,r));
const base = `http://localhost:${http.address().port}`;
const call = async (p,o={}) => {
  const r = await fetch(base+p,{ method:o.method ?? (o.body?'POST':'GET'),
    headers:{'content-type':'application/json'}, body:o.body?JSON.stringify(o.body):undefined });
  return { status:r.status, json: await r.json().catch(()=>({})) };
};

/* --------------------------------------------------------- amorçage */

let r = await call('/api/admin/suis-je');
check('un joueur n\u2019est pas admin', r.json.admin === false);
r = await call('/api/admin/apercu');
check('un joueur ne voit pas l\u2019aperçu', r.status === 403);

const n = await adm.amorcer('patron@ex.fr, inconnu@ex.fr');
check('promotion par ADMIN_EMAILS', n === 1);
moi = A;
r = await call('/api/admin/suis-je');
check('l\u2019admin est reconnu', r.json.admin === true);
check('l\u2019amorçage est journalisé',
  (await call('/api/admin/journal')).json.journal.some((l)=>l.action==='admin.promu'));

/* ---------------------------------------------------------- aperçu */

r = await call('/api/admin/apercu');
check('aperçu des joueurs', r.json.joueurs.total === 3 && r.json.joueurs.admins === 1);
check('aperçu des compétitions', r.json.competitions.competitions === 2);

/* --------------------------------------------------------- joueurs */

r = await call('/api/admin/joueurs?q=Joueur');
check('recherche de joueur', r.json.joueurs.length === 1 && r.json.joueurs[0].pseudo === 'Joueur');
check('aucun hachage exposé', !JSON.stringify(r.json).includes('password'));

r = await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ scarves: 250 } });
check('écharpes créditées', r.json.scarves === 250);
const [[w]] = await pool.query('SELECT scarves FROM user_wallet WHERE user_id = ?', [B]);
check('le solde a bien bougé', w.scarves === 350);

r = await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ scarves: -1000 } });
const [[w2]] = await pool.query('SELECT scarves FROM user_wallet WHERE user_id = ?', [B]);
check('un solde ne peut pas devenir négatif', w2.scarves === 0);

r = await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ status:'locked' } });
check('compte bloqué', r.json.status === 'locked');

await pool.query(`INSERT INTO sessions (token_hash,user_id,expires_at)
  SELECT REPEAT('a',64), id, NOW(3)+INTERVAL 1 DAY FROM users WHERE public_id = ?`, [B]);
await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ status:'active' } });
await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{ status:'locked' } });
const [sess] = await pool.query(`SELECT 1 FROM sessions s JOIN users u ON u.id = s.user_id
  WHERE u.public_id = ?`, [B]);
check('bloquer ferme les sessions ouvertes', sess.length === 0);

r = await call(`/api/admin/joueur/${A}`, { method:'PATCH', body:{ role:'joueur' } });
check('un admin ne peut pas se retirer ses droits', r.json.error === 'admin.error.not_yourself');

r = await call(`/api/admin/joueur/${A}`, { method:'PATCH', body:{ status:'locked' } });
check('un admin ne peut pas se bloquer', r.json.error === 'admin.error.not_yourself');

r = await call(`/api/admin/joueur/${C}`, { method:'PATCH', body:{ role:'admin' } });
check('un second admin peut être nommé', r.json.role === 'admin');

r = await call('/api/admin/joueur/inexistant', { method:'PATCH', body:{ scarves: 10 } });
check('joueur inconnu : 404', r.status === 404);

r = await call(`/api/admin/joueur/${B}`, { method:'PATCH', body:{} });
check('une modification vide est refusée', r.json.error === 'admin.error.nothing_to_do');

/* ---------------------------------------------------- compétitions */

r = await call('/api/admin/competitions?q=Super');
check('recherche de compétition', r.json.competitions.length === 1);

r = await call('/api/admin/competition/999/2026', { method:'PATCH',
  body:{ enabled:false, tier:1, debut:'2026-08-01' } });
check('compétition désactivée et repalierée',
  r.json.enabled === false && r.json.tier === 1 && r.json.debut === '2026-08-01');
const [[c]] = await pool.query(
  'SELECT enabled,tier,starts_on FROM souvenir_leagues WHERE league_id=999', []);
check('la base reflète le changement', c.enabled === 0 && c.tier === 1);

r = await call('/api/admin/competition/999/2026', { method:'PATCH', body:{ debut:'pas-une-date' } });
check('date invalide refusée', r.json.error === 'admin.error.nothing_to_do');

/* -------------------------------------------------------- réglages */

r = await call('/api/admin/reglage/annonce', { method:'PUT',
  body:{ valeur:{ texte:'Maintenance ce soir', actif:true } } });
check('réglage enregistré', r.json.cle === 'annonce');
r = await call('/api/admin/reglages');
check('réglage relu', r.json.annonce.texte === 'Maintenance ce soir');

r = await call('/api/admin/reglage/Mauvaise Clé!', { method:'PUT', body:{ valeur:1 } });
check('clé invalide refusée', r.json.error === 'admin.error.bad_key');

/* ----------------------------------------------------------- outils */

r = await call('/api/admin/cache/purge', { method:'POST' });
check('cache purgé', r.json.purge === 2);

/* ------------------------------------------------------------ audit */

r = await call('/api/admin/journal');
const actions = r.json.journal.map((l)=>l.action);
check('les modifications de joueur sont tracées', actions.includes('joueur.modifie'));
check('les compétitions aussi', actions.includes('competition.modifiee'));
check('les réglages aussi', actions.includes('reglage.modifie'));
check('la purge aussi', actions.includes('cache.purge'));
check('l\u2019auteur est nommé', r.json.journal.some((l)=>l.acteur === 'Patron'));
check('le détail est conservé',
  r.json.journal.some((l)=>l.detail && JSON.stringify(l.detail).includes('scarves')));

const avant = r.json.journal.length;
moi = B;
await call('/api/admin/joueur/' + A, { method:'PATCH', body:{ role:'joueur' } });
moi = A;
r = await call('/api/admin/journal');
check('une tentative refusée n\u2019écrit rien', r.json.journal.length === avant);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'}`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
