/**
 * Test du télétexte.
 *
 * Le sujet est le quota : on vérifie surtout qu'une deuxième consultation ne
 * coûte rien, et qu'une panne de l'API ne laisse pas une page vide.
 */
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import express from 'express';
import { createTeletext } from '../src/server/teletext/index.js';

const DB = process.env.DATABASE_URL ?? 'mysql://tbf:tbfpass@127.0.0.1:3307/tbf';
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS api_cache, user_fanzzy, user_souvenirs, virage_presence,
  souvenirs, user_wallet, souvenir_leagues, user_follows, fixture_events, standings, fixtures,
  team_leagues, teams, leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'souvenirs.sql', 'teletext.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const today = new Date().toISOString().slice(0, 10);
const debut = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
const fin = new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10);
await raw.query(
  `INSERT INTO souvenir_leagues (league_id,season,name,country,type,family,has_events,
     has_standings,has_top_scorers,has_top_assists,has_top_cards,tier,starts_on,ends_on,enabled)
   VALUES (207,2026,'Super League','Switzerland','League','championnat',1,1,1,1,1,2,?,?,1),
          (207,2025,'Super League','Switzerland','League','championnat',1,1,1,1,1,2,'2025-07-01','2026-05-30',1),
          (61,2026,'Ligue 1','France','League','championnat',1,1,1,1,1,1,?,?,1),
          (999,2026,'Petite Coupe','France','Cup','coupe',1,0,0,0,0,3,?,?,1)`,
  [debut, fin, debut, fin, debut, fin]);
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, charset: 'utf8mb4' });

/* -------------------------------------------------------- faux client API */

let appels = 0;
let enPanne = false;
const client = {
  quota: { usedToday: 0, remaining: 7000, budgetLeft: 6800 },
  async call(path, params) {
    appels++;
    if (enPanne) throw new Error('API injoignable');
    if (path === '/players/topscorers') {
      return [{ player: { name: 'Diallo', photo: 'p.png' },
                statistics: [{ team: { name: 'FC Sion', logo: 'l.png' },
                  games: { appearences: 12 }, goals: { total: 9, assists: 3 },
                  cards: { yellow: 2, red: 0 } }] }];
    }
    if (path === '/players/topassists') return [];
    if (path === '/players/topyellowcards') return [];
    if (path === '/fixtures') {
      return [{ fixture: { id: 1, date: '2026-09-13T16:00:00+00:00', status: { short: 'FT' } },
                league: { round: 'Journée 5' },
                teams: { home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } },
                goals: { home: 2, away: 1 } }];
    }
    return [];
  },
  async standings(leagueId, season) {
    appels++;
    if (enPanne) throw new Error('API injoignable');
    return [{ league: { id: leagueId, season, standings: [[
      { rank: 1, team: { id: 85, name: 'FC Sion', logo: 'l.png' }, points: 27,
        all: { played: 12, win: 9, draw: 0, lose: 3, goals: { for: 24, against: 11 } }, form: 'WWLWW' },
      { rank: 2, team: { id: 91, name: 'FC Bâle', logo: 'b.png' }, points: 22,
        all: { played: 12, win: 7, draw: 1, lose: 4, goals: { for: 19, against: 14 } }, form: 'LWWDW' },
    ]] } }];
  },
};

const T = createTeletext({ pool, client });
const app = express(); app.use('/api/tt', T.router);
const http = createServer(app); await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const get = async (p) => {
  const r = await fetch(base + p);
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

/* ------------------------------------------------------------- sommaire */

let r = await get('/api/tt/leagues');
check('sommaire servi sans appel API', r.json.leagues.length >= 3 && appels === 0);
check('trié par palier', r.json.leagues[0].tier === 1);

r = await get('/api/tt/leagues?q=Super');
check('recherche par nom', r.json.leagues.every((l) => l.name.includes('Super')));

r = await get('/api/tt/leagues?country=France');
check('filtre par pays', r.json.leagues.every((l) => l.country === 'France'));

r = await get('/api/tt/countries');
check('liste des pays', r.json.countries.some((c) => c.country === 'Switzerland'));

/* ------------------------------------------------------------- saisons */

const s = await T.seasonOf(207);
check('saison choisie sur les dates du jour', s.season === 2026);

/* ---------------------------------------------------------- classement */

appels = 0;
r = await get('/api/tt/league/207');
check('classement chargé', r.json.groups[0]?.length === 2);
check('un appel API consommé', appels === 1);
check('premier du classement correct', r.json.groups[0][0].name === 'FC Sion');
check('la saison retenue est annoncée', r.json.league.season === 2026);

r = await get('/api/tt/league/207');
check('deuxième consultation servie par le cache',
  appels === 1 && r.json.groups?.[0]?.[0]?.name === 'FC Sion');

r = await get('/api/tt/league/999');
check('compétition sans classement : pas d\u2019appel gaspillé',
  r.json.unsupported === true && appels === 1);

/* ------------------------------------------------------- buteurs, etc. */

r = await get('/api/tt/league/207/scorers');
check('buteurs chargés', r.json.players[0]?.name === 'Diallo' && r.json.players[0].goals === 9);
r = await get('/api/tt/league/207/scorers');
check('buteurs mis en cache', appels === 2 && r.json.players?.[0]?.goals === 9);

r = await get('/api/tt/league/999/scorers');
check('pas de buteurs quand la couverture manque', r.json.unsupported === true);

r = await get('/api/tt/league/207/results');
check('résultats chargés', r.json.matchs[0]?.home?.goals === 2);

/* ------------------------------------------------------------- panne */

enPanne = true;
const avant = appels;
r = await get('/api/tt/league/61');           // jamais chargée, aucun cache
check('sans cache, la panne est signalée', r.status === 503);

await pool.query(`UPDATE api_cache SET expires_at = NOW(3) - INTERVAL 1 HOUR`);
r = await get('/api/tt/league/207');
check('avec cache périmé, on sert la version ancienne',
  r.json.groups[0]?.length === 2 && r.json.stale === true);
check('la tentative a bien eu lieu', appels > avant);

enPanne = false;
r = await get('/api/tt/league/207');
check('le cache se rafraîchit dès que l\u2019API revient', r.json.stale === false);

/* --------------------------------------------------------------- état */

r = await get('/api/tt/cache');
check('état du cache exposé', r.json.entrees >= 3);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'} · ${appels} appels API pour toute la session`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
