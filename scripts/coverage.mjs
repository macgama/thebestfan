/**
 * Inventaire de couverture API-Football.
 *
 * Une carte-souvenir a besoin du buteur et de la minute, donc de l'endpoint
 * `fixtures/events`. Or cette donnée n'existe pas partout : le drapeau
 * `coverage.fixtures.events` de `/leagues` est vrai ou faux compétition par
 * compétition, et saison par saison. Ce script fait l'inventaire une fois,
 * range le résultat en base, et le jeu n'ouvre le Grand Virage que sur les
 * compétitions éligibles.
 *
 * Coût : 1 appel sur les 7 500 quotidiens. Le serveur fait ce passage seul,
 * une fois par jour (`src/server/football/inventaire.js`) : ce script ne sert
 * plus qu'à lire le rapport, ou à forcer un passage sans attendre.
 *
 *   node scripts/coverage.mjs           # inventaire + écriture en base
 *   node scripts/coverage.mjs --dry     # affichage seul, sans écrire
 */

import { trier, ecrireInventaire } from '../src/server/football/inventaire.js';

const KEY = process.env.API_FOOTBALL_KEY;
const DB = process.env.DATABASE_URL;
const DRY = process.argv.includes('--dry');

if (!KEY) {
  console.error('API_FOOTBALL_KEY manquant. Lance depuis le dossier du site : node --env-file=.env scripts/coverage.mjs');
  process.exit(1);
}

async function api(path) {
  const res = await fetch(`https://v3.football.api-sports.io${path}`, {
    headers: { 'x-apisports-key': KEY, accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`API-Football ${res.status}`);
  const body = await res.json();
  const errs = body?.errors;
  if (errs && !Array.isArray(errs) && Object.keys(errs).length) {
    throw new Error(Object.values(errs).join(' / '));
  }
  console.error(`  appels restants aujourd'hui : ${res.headers.get('x-ratelimit-requests-remaining') ?? '?'}`);
  return body.response ?? [];
}

const { eligibles, recalees } = trier(await api('/leagues'));
console.error(`${eligibles.length + recalees.length} compétitions avec une saison renvoyées par l'API\n`);

/* ------------------------------------------------------------- rapport */

const parFamille = {};
for (const e of eligibles) parFamille[e.famille] = (parFamille[e.famille] ?? 0) + 1;

console.log('=== COMPÉTITIONS ÉLIGIBLES AUX CARTES-SOUVENIRS ===');
console.log(`${eligibles.length} éligibles · ${recalees.length} sans données d'événements\n`);
for (const [f, n] of Object.entries(parFamille).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${f.padEnd(15)} ${n}`);
}

const parPays = {};
for (const e of eligibles) parPays[e.pays ?? '—'] = (parPays[e.pays ?? '—'] ?? 0) + 1;
console.log('\n  Top 15 pays :');
for (const [p, n] of Object.entries(parPays).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`    ${p.padEnd(22)} ${n}`);
}

// Les compétitions qui comptent pour toi en priorité.
const phares = [
  'Ligue 1', 'Super League', 'Challenge League', 'Premier League', 'La Liga',
  'Serie A', 'Bundesliga', 'UEFA Champions League', 'UEFA Europa League',
  'UEFA Conference League', 'Coupe de France', 'Schweizer Cup', 'World Cup', 'Euro Championship',
];
console.log('\n  Compétitions phares :');
for (const nom of phares) {
  const trouvees = eligibles.filter((e) => e.nom === nom);
  const rate = recalees.filter((e) => e.nom === nom);
  if (trouvees.length) {
    for (const t of trouvees.slice(0, 3)) {
      console.log(`    ✓ ${t.nom} (${t.pays}) · saison ${t.saison}`);
    }
  } else if (rate.length) {
    console.log(`    ✗ ${nom} — pas d'événements pour ${rate[0].pays}`);
  } else {
    console.log(`    ? ${nom} — introuvable sous ce nom exact`);
  }
}

/* --------------------------------------------------------- écriture SQL */

if (DRY || !DB) {
  console.log(DRY ? '\n(mode --dry : rien écrit en base)' : '\nDATABASE_URL absent : rien écrit en base');
  process.exit(0);
}

const mysql = await import('mysql2/promise');
const pool = mysql.createPool({ uri: DB, connectionLimit: 4, charset: 'utf8mb4' });

await pool.query(`
  CREATE TABLE IF NOT EXISTS souvenir_leagues (
    league_id  INT          NOT NULL,
    season     SMALLINT     NOT NULL,
    name       VARCHAR(120) NOT NULL,
    country    VARCHAR(80)  NULL,
    country_code CHAR(2)    NULL,
    type       VARCHAR(20)  NULL,
    family     VARCHAR(20)  NOT NULL,
    has_events TINYINT(1)   NOT NULL DEFAULT 0,
    has_lineups TINYINT(1)  NOT NULL DEFAULT 0,
    has_standings TINYINT(1) NOT NULL DEFAULT 0,
    has_top_scorers TINYINT(1) NOT NULL DEFAULT 0,
    has_top_assists TINYINT(1) NOT NULL DEFAULT 0,
    has_top_cards TINYINT(1) NOT NULL DEFAULT 0,
    tier       TINYINT      NOT NULL DEFAULT 3,
    starts_on  DATE         NULL,
    ends_on    DATE         NULL,
    enabled    TINYINT(1)   NOT NULL DEFAULT 1,
    updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (league_id, season),
    KEY idx_enabled (enabled, family)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

const { ecrites, nouvelles } = await ecrireInventaire(pool, eligibles);
console.log(`\n${nouvelles} saison(s) nouvelle(s)`);

const [[{ n }]] = await pool.query(
  `SELECT COUNT(*) AS n FROM souvenir_leagues WHERE enabled = 1`);
const [[{ p1 }]] = await pool.query(`SELECT COUNT(*) AS p1 FROM souvenir_leagues WHERE tier = 1`);
const [[{ p2 }]] = await pool.query(`SELECT COUNT(*) AS p2 FROM souvenir_leagues WHERE tier = 2`);
console.log(`${ecrites} compétitions écrites · ${n} activées`);
console.log(`paliers : ${p1} majeures · ${p2} solides · ${ecrites - p1 - p2} autres`);
await pool.end();
