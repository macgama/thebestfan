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
 * Coût : 1 à 2 appels sur les 7 500 quotidiens. À relancer à chaque
 * intersaison, pas plus.
 *
 *   node scripts/coverage.mjs           # inventaire + écriture en base
 *   node scripts/coverage.mjs --dry     # affichage seul, sans écrire
 */

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

/** Ce qu'on considère comme une compétition intéressante pour le jeu. */
function classer(l) {
  const nom = l.league.name.toLowerCase();
  const pays = l.country?.name ?? '';
  if (pays === 'World') {
    if (/friendl|amical/.test(nom)) return 'amical';
    return 'international';
  }
  if (l.league.type === 'Cup') return 'coupe';
  return 'championnat';
}

const rows = await api('/leagues');
console.error(`${rows.length} compétitions renvoyées par l'API\n`);

const eligibles = [];
const recalees = [];

for (const l of rows) {
  // Saison en cours, ou la plus récente si aucune n'est marquée courante.
  const saison = (l.seasons ?? []).find((s) => s.current) ?? (l.seasons ?? []).at(-1);
  if (!saison) continue;

  const c = saison.coverage?.fixtures ?? {};
  const cov = saison.coverage ?? {};
  const entree = {
    id: l.league.id,
    nom: l.league.name,
    pays: l.country?.name ?? null,
    type: l.league.type,
    famille: classer(l),
    saison: saison.year,
    events: Boolean(c.events),
    lineups: Boolean(c.lineups),
    classement: Boolean(cov.standings),
    buteurs: Boolean(cov.top_scorers),
    passeurs: Boolean(cov.top_assists),
    cartons: Boolean(cov.top_cards),
    debut: saison.start ?? null,
    fin: saison.end ?? null,
  };
  (entree.events ? eligibles : recalees).push(entree);
}

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

// Les amicaux sont éligibles techniquement mais désactivés : un souvenir de
// match amical ne vaut rien, et l'API prévient elle-même que leur couverture
// est irrégulière.
/**
 * Palier de notoriété : il décide du prix des vignettes et de l'ordre
 * d'affichage dans le télétexte.
 *
 * La règle doit nommer les compétitions, pas se contenter de leur pays.
 * « toutes les ligues anglaises » classait la National League South Play-offs
 * au même rang que la Premier League — c'est absurde, et ça noyait les grandes
 * compétitions au milieu de leurs divisions inférieures.
 */
const MAJEURES = new Set([
  'UEFA Champions League', 'World Cup', 'Euro Championship',
  'Copa America', 'Africa Cup of Nations', 'UEFA Nations League',
]);

/** Première division de chaque grand pays, nommée explicitement. */
const ELITES = new Map([
  ['England', 'Premier League'],
  ['Spain', 'La Liga'],
  ['Italy', 'Serie A'],
  ['Germany', 'Bundesliga'],
  ['France', 'Ligue 1'],
]);

/** Deuxièmes divisions des grands pays, et élites des pays solides. */
const SECONDES = new Map([
  ['England', 'Championship'],
  ['Spain', 'Segunda División'],
  ['Italy', 'Serie B'],
  ['Germany', '2. Bundesliga'],
  ['France', 'Ligue 2'],
]);

const SOLIDES = new Map([
  ['Switzerland', 'Super League'],
  ['Netherlands', 'Eredivisie'],
  ['Portugal', 'Primeira Liga'],
  ['Belgium', 'Jupiler Pro League'],
  ['Brazil', 'Serie A'],
  ['Argentina', 'Liga Profesional Argentina'],
  ['Turkey', 'Süper Lig'],
  ['Scotland', 'Premiership'],
  ['Austria', 'Bundesliga'],
  ['Denmark', 'Superliga'],
  ['USA', 'Major League Soccer'],
  ['Mexico', 'Liga MX'],
]);

const COUPES_MAJEURES = new Set([
  'UEFA Europa League', 'UEFA Europa Conference League', 'UEFA Conference League',
  'FA Cup', 'Copa del Rey', 'Coppa Italia', 'DFB Pokal', 'Coupe de France',
  'Copa Libertadores',
]);

function palier(e) {
  if (MAJEURES.has(e.nom)) return 1;
  if (ELITES.get(e.pays) === e.nom) return 1;
  if (COUPES_MAJEURES.has(e.nom)) return 2;
  if (SECONDES.get(e.pays) === e.nom) return 2;
  if (SOLIDES.get(e.pays) === e.nom) return 2;
  // Les compétitions de sélections restent visibles sans être majeures.
  if (e.famille === 'international' && !/friendl|qualif|u1[7-9]|u2[0-3]|women/i.test(e.nom)) {
    return 2;
  }
  return 3;
}

const values = eligibles.map((e) => [
  e.id, e.saison, e.nom, e.pays, e.type, e.famille,
  1, e.lineups ? 1 : 0, e.classement ? 1 : 0,
  e.buteurs ? 1 : 0, e.passeurs ? 1 : 0, e.cartons ? 1 : 0,
  palier(e), e.debut, e.fin,
  e.famille === 'amical' ? 0 : 1,
]);

for (let i = 0; i < values.length; i += 200) {
  await pool.query(
    `INSERT INTO souvenir_leagues
       (league_id, season, name, country, type, family, has_events, has_lineups,
        has_standings, has_top_scorers, has_top_assists, has_top_cards, tier,
        starts_on, ends_on, enabled)
     VALUES ?
     ON DUPLICATE KEY UPDATE name=VALUES(name), country=VALUES(country), type=VALUES(type),
       family=VALUES(family), has_events=VALUES(has_events), has_lineups=VALUES(has_lineups),
       has_standings=VALUES(has_standings), has_top_scorers=VALUES(has_top_scorers),
       has_top_assists=VALUES(has_top_assists), has_top_cards=VALUES(has_top_cards),
       tier=VALUES(tier), starts_on=VALUES(starts_on), ends_on=VALUES(ends_on)`,
    [values.slice(i, i + 200)],
  );
}

const [[{ n }]] = await pool.query(
  `SELECT COUNT(*) AS n FROM souvenir_leagues WHERE enabled = 1`);
const [[{ p1 }]] = await pool.query(`SELECT COUNT(*) AS p1 FROM souvenir_leagues WHERE tier = 1`);
const [[{ p2 }]] = await pool.query(`SELECT COUNT(*) AS p2 FROM souvenir_leagues WHERE tier = 2`);
console.log(`\n${values.length} compétitions écrites · ${n} activées`);
console.log(`paliers : ${p1} majeures · ${p2} solides · ${values.length - p1 - p2} autres`);
await pool.end();
