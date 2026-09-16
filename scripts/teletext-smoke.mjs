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
import { baseDeTest, OPTIONS_BASE } from './base-de-test.mjs';

const DB = baseDeTest();
let failures = 0;
const check = (l, c) => { console.log(`${c ? '  ok  ' : ' FAIL '} ${l}`); if (!c) failures++; };

const mysql = await import('mysql2/promise');
const raw = await mysql.createConnection({ uri: DB, multipleStatements: true });
await raw.query(`DROP TABLE IF EXISTS achats, kop_invites, amities,
  kop_bulletins, kop_votes, kop_bonus, kop_membres, kops, user_decks, user_stuff, user_skins, user_fanzzy, user_souvenirs, virage_presence,
                 souvenirs, user_wallet, api_cache, souvenir_leagues, duel_results, duel_events,
                 duels, user_league_follows, user_follows, fixture_events, standings, fixtures, team_leagues, teams,
                 leagues, api_quota, login_attempts, auth_tokens, sessions, users`);
for (const f of ['auth.sql', 'football.sql', 'minutes.sql', 'couleurs.sql', 'souvenirs.sql', 'billets.sql', 'teletext.sql']) {
  await raw.query(readFileSync(new URL('../sql/' + f, import.meta.url), 'utf8'));
}
const today = new Date().toISOString().slice(0, 10);
const debut = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
const fin = new Date(Date.now() + 200 * 864e5).toISOString().slice(0, 10);
const jourDe = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/* Sept lignes pour quatre compétitions : le sommaire doit savoir en écarter
   trois. Une saison ancienne de la même compétition, une Coupe du monde close
   qu'on veut pourtant revoir, un Euro trop vieux pour l'être, et une ligue
   entre deux saisons. */
await raw.query(
  `INSERT INTO souvenir_leagues (league_id,season,name,country,country_code,type,family,has_events,
     has_standings,has_top_scorers,has_top_assists,has_top_cards,tier,starts_on,ends_on,enabled)
   VALUES (207,2026,'Super League','Switzerland','CH','League','championnat',1,1,1,1,1,2,?,?,1),
          (207,2025,'Super League','Switzerland','CH','League','championnat',1,1,1,1,1,2,'2025-07-01','2026-05-30',1),
          (61,2026,'Ligue 1','France','FR','League','championnat',1,1,1,1,1,1,?,?,1),
          (999,2026,'Petite Coupe','France','FR','Cup','coupe',1,0,0,0,0,3,?,?,1),
          (1,2022,'World Cup','World',NULL,'Cup','international',1,0,0,0,0,1,?,?,1),
          (1,2018,'World Cup','World',NULL,'Cup','international',1,0,0,0,0,1,?,?,1),
          (2,2016,'Euro Championship','World',NULL,'Cup','international',1,0,0,0,0,1,?,?,1),
          (500,2026,'Eliteserien','Norway','NO','League','championnat',1,1,0,0,0,3,?,?,1)`,
  [debut, fin, debut, fin, debut, fin,
   jourDe(-1400), jourDe(-1370),        // Coupe du monde : moins de quatre ans
   jourDe(-2900), jourDe(-2870),        // l'édition d'avant : trop vieille
   jourDe(-3700), jourDe(-3670),        // Euro : trop vieux
   jourDe(-400), jourDe(-200)]);        // Eliteserien : entre deux saisons

/* Un joueur, pour les compétitions suivies. Le banc n'a pas
   d'authentification : `req.user` est posé à la main plus bas, comme le fait
   `attachUser` en production. */
await raw.query(
  `INSERT INTO users (email, pseudo, password_hash, public_id, email_verified_at)
   VALUES ('tt@test.local', 'Teletexte', 'x', UUID(), NOW())`);
const [[moi]] = await raw.query('SELECT public_id FROM users LIMIT 1');
const MOI = moi.public_id;
await raw.end();

const pool = mysql.createPool({ uri: DB, connectionLimit: 6, ...OPTIONS_BASE });

/* -------------------------------------------------------- faux client API */

let appels = 0;
let enPanne = false;
let compoPubliee = false;
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
    if (path === '/fixtures/events') return [];
    if (path === '/fixtures/statistics') {
      const ligne = (poss, tirs, cadres, corners, hj) => [
        { type: 'Ball Possession', value: poss },
        { type: 'Total Shots', value: tirs },
        { type: 'Shots on Goal', value: cadres },
        { type: 'Corner Kicks', value: corners },
        { type: 'Offsides', value: hj },
        { type: 'Red Cards', value: null },      // nulle des deux côtés
        { type: 'Shots insidebox', value: 9 },   // hors de la sélection
      ];
      return [
        { team: { id: 85 }, statistics: ligne('61%', 14, 6, 7, 2) },
        { team: { id: 91 }, statistics: ligne('39%', 5, 2, 3, 1) },
      ];
    }
    if (path === '/fixtures/lineups') {
      if (!compoPubliee) return [];              // pas encore parue
      return [
        { team: { id: 85 }, formation: '4-3-3', coach: { name: 'Tramezzani' },
          startXI: [{ player: { id: 1, name: 'Fickentscher', number: 1, pos: 'G' } },
                    { player: { id: 2, name: 'Baltazar', number: 9, pos: 'F' } }],
          substitutes: [{ player: { id: 3, name: 'Berdayes', number: 17, pos: 'M' } }] },
        { team: { id: 91 }, formation: '4-2-3-1', coach: { name: 'Degen' },
          startXI: [{ player: { id: 4, name: 'Hitz', number: 30, pos: 'G' } }],
          substitutes: [] },
      ];
    }
    if (path === '/fixtures') {
      /* Trois journées, datées **par rapport à aujourd'hui** : c'est la seule
         façon d'éprouver « la journée en cours » sans que le banc devienne
         faux le mois prochain. La cinquième se joue à l'instant, et c'est donc
         elle que le service doit choisir tout seul. */
      const m = (id, jours, round, statut, h, a) => ({
        fixture: { id, date: new Date(Date.now() + jours * 864e5).toISOString(),
                   status: { short: statut } },
        league: { id: 207, season: 2026, round },
        teams: { home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } },
        goals: { home: h, away: a },
      });
      const saison = [m(1, -8, 'Journée 4', 'FT', 1, 0),
                      m(2, -0.04, 'Journée 5', 'FT', 2, 1),
                      m(3, 7, 'Journée 6', 'NS', null, null)];
      // Une fiche demande un match, et un seul.
      if (params?.id) return saison.filter((x) => x.fixture.id === Number(params.id));
      // La fenêtre du direct : deux jours de part et d'autre, pas la saison.
      if (params?.from) {
        return saison.filter((x) =>
          Math.abs(Date.now() - Date.parse(x.fixture.date)) < 2 * 864e5);
      }
      return saison;
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
const app = express();
/* Le banc n'a pas d'authentification : on pose `req.user` comme le fait
   `attachUser` en production, et on le retire pour éprouver ce que voit un
   visiteur sans compte. */
let qui = null;
app.use((req, _res, next) => { if (qui) req.user = { id: qui }; next(); });
app.use('/api/tt', T.router);
const http = createServer(app); await new Promise((r) => http.listen(0, r));
const base = `http://localhost:${http.address().port}`;
const get = async (p) => {
  const r = await fetch(base + p);
  return { status: r.status, json: await r.json().catch(() => ({})) };
};
const envoyer = async (methode, p) => {
  const r = await fetch(base + p, { method: methode });
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

/* --------------------------------------- ce que le sommaire montre, et pas

   Neuf cent cinquante compétitions, c'est un annuaire. Ce qu'on vient
   chercher, c'est ce qui se joue — plus les grandes compétitions de
   sélections, qu'on veut revoir longtemps après leur finale. Ces contrôles
   tiennent les deux bords : ce qui doit rester, et ce qui doit partir. */

r = await get('/api/tt/leagues');
let noms = r.json.leagues.map((l) => l.name);
check('une compétition n’est listée qu’une fois, pas une fois par saison',
  noms.filter((n) => n === 'Super League').length === 1);
check('la dernière Coupe du monde reste au sommaire', noms.includes('World Cup'));
check('mais pas l’Euro d’il y a dix ans', !noms.includes('Euro Championship'));
check('une ligue entre deux saisons ne paraît pas', !noms.includes('Eliteserien'));
check('ce qui court est marqué en cours',
  r.json.leagues.find((l) => l.name === 'Ligue 1')?.en_cours === true);
check('et la Coupe du monde close ne l’est pas',
  r.json.leagues.find((l) => l.name === 'World Cup')?.en_cours === false);

/* Nommer une compétition lève la restriction : on a dit ce qu'on cherchait,
   ce serait absurde de le cacher parce que sa saison est finie. */
r = await get('/api/tt/leagues?q=Eliteserien');
check('mais on la retrouve dès qu’on la nomme',
  r.json.leagues.some((l) => l.name === 'Eliteserien'));

/* Le pays arrive **en anglais**, traduit par le navigateur : c'est ainsi que
   la base le range, et c'est ce qui permet à « norvège » de trouver Norway. */
r = await get('/api/tt/leagues?pays=Norway');
check('un pays retraduit en anglais trouve ses compétitions',
  r.json.leagues.some((l) => l.name === 'Eliteserien'));

/* Le code ISO seul, sans le nom : c'est la voie qui reste quand l'API et
   `Intl` n'écrivent pas le pays de la même façon. */
r = await get('/api/tt/leagues?codes=NO');
check('et son code ISO aussi, quand les deux noms divergent',
  r.json.leagues.some((l) => l.name === 'Eliteserien'));

r = await get('/api/tt/countries');
check('le code ISO du pays part avec la liste',
  r.json.countries.find((c) => c.country === 'Switzerland')?.code === 'CH');

/* ------------------------------------------------ les compétitions suivies

   On suit une compétition comme on suit un club, mais sans qu'elle coûte le
   moindre appel. Le contrôle qui compte est le troisième : une compétition
   suivie ne doit **jamais** quitter le sommaire, même hors saison — c'est
   toute la raison de l'étoile. */

r = await get('/api/tt/favoris');
check('sans compte, on ne suit rien', r.status === 401);

qui = MOI;
let f = await envoyer('POST', '/api/tt/favoris/500');
check('on suit une compétition', f.json.leagues.includes(500));

r = await get('/api/tt/leagues');
check('une compétition suivie reste au sommaire, même hors saison',
  r.json.leagues.some((l) => l.name === 'Eliteserien' && l.favori === true));
check('et elle passe devant', r.json.leagues[0]?.league_id === 500);

f = await envoyer('POST', '/api/tt/favoris/424242');
check('une compétition inconnue se refuse', f.status === 404);

f = await envoyer('DELETE', '/api/tt/favoris/500');
check('on cesse de la suivre', !f.json.leagues.includes(500));
r = await get('/api/tt/leagues');
check('et elle quitte le sommaire',
  !r.json.leagues.some((l) => l.name === 'Eliteserien'));
qui = null;


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

/* ------------------------------------------------------- les journées

   La page ne montrait qu'une fenêtre de vingt jours : ni la troisième
   journée, ni la fin du calendrier. Ce qui est éprouvé ici, ce n'est pas
   seulement qu'elles sont toutes là, c'est **ce que ça coûte** — la saison
   entière tient dans un appel, et en changer ne doit plus rien coûter. */

check('toutes les journées de la saison sont offertes',
  (r.json.journees ?? []).length === 3);
check('et celle du jour est choisie d’office', r.json.journee === 'Journée 5');
check('l’instant de lecture accompagne une journée qui se joue',
  Number.isFinite(r.json.luA));

const avantJournee = appels;
r = await get('/api/tt/league/207/results?journee=' + encodeURIComponent('Journée 4'));
check('on peut remonter à une journée passée',
  r.json.journee === 'Journée 4' && r.json.matchs[0]?.id === 1);
check('une journée hors du direct ne fait pas courir la minute', r.json.luA === null);

r = await get('/api/tt/league/207/results?journee=' + encodeURIComponent('Journée 6'));
check('et descendre au calendrier à venir',
  r.json.journee === 'Journée 6' && r.json.matchs[0]?.home?.goals === null);
check('changer de journée ne redemande rien à l’API', appels === avantJournee);

r = await get('/api/tt/league/207/results?journee=Journée%2099');
check('une journée qui n’existe pas retombe sur celle du jour',
  r.json.journee === 'Journée 5');


/* ------------------------------------------- le lien vers la compétition

   La page des matchs bâtit « /teletext?ligue=… » sur `ligue.id`. La colonne,
   elle, s'appelle `league_id` : sans ce renvoi, la page écrivait
   « ligue=undefined » et le clic retombait sur le sommaire — la compétition
   était à un clic, et ce clic n'existait pas. */
{
  const j = await T.jour(new Date().toISOString().slice(0, 10));
  const g = (j.groupes ?? [])[0];
  check('chaque compétition du jour porte son identifiant', g?.ligue?.id === 207);
  check('et le drapeau dont la page tire le nom du pays', g?.ligue && 'drapeau' in g.ligue);
}

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

/* ------------------------------------------- fiche d'un match : les volets */

/**
 * La page a toujours eu ses trois onglets, mais le serveur ne renvoyait ni
 * statistiques ni composition : les deux volets affichaient « indisponibles »
 * pour tous les matchs, y compris terminés. Ces contrôles ferment la porte.
 */
await pool.query(`DELETE FROM api_cache`);
compoPubliee = true;

r = await get('/api/tt/match/1');
const st = r.json.statistiques ?? [];
check('la fiche renvoie des statistiques', st.length > 0);

const poss = st.find((s) => s.nom === 'Possession');
check('les intitulés sont traduits', Boolean(poss));
check('la valeur affichée est conservée telle quelle', poss?.home === '61%');
check('la part de la barre est calculée', poss?.partHome === 61);

const tirs = st.find((s) => s.nom === 'Tirs');
check('un décompte donne aussi sa part', tirs?.home === 14 && tirs?.partHome === 74);
check('une ligne nulle des deux côtés est écartée',
  !st.some((s) => s.nom === 'Cartons rouges'));
check('les statistiques hors sélection ne passent pas',
  !st.some((s) => /insidebox/i.test(s.nom)));

const c = r.json.compositions;
check('la fiche renvoie les compositions', Boolean(c?.home && c?.away));
check('le dispositif est donné', c?.home?.dispositif === '4-3-3');
check('les titulaires sont numérotés et nommés',
  c?.home?.titulaires?.[0]?.numero === 1 && c?.home?.titulaires?.[0]?.nom === 'Fickentscher');
check('le poste anglais « F » devient « A »', c?.home?.titulaires?.[1]?.poste === 'A');
check('le banc est séparé', c?.home?.remplacants?.[0]?.nom === 'Berdayes');
check('l’entraîneur est nommé', c?.home?.entraineur === 'Tramezzani');

/* ------------------------------------------------ le quota, encore lui */

let avantFiche = appels;
r = await get('/api/tt/match/1');
check('une deuxième consultation de la fiche ne coûte aucun appel', appels === avantFiche);

const duree = async (cle) => {
  const [[row]] = await pool.query(
    `SELECT TIMESTAMPDIFF(SECOND, NOW(3), expires_at) AS s FROM api_cache WHERE k = ?`, [cle]);
  return row?.s ?? null;
};

// Un match terminé ne change plus jamais : le garder vingt-cinq secondes
// faisait repayer un appel à chaque visiteur.
check('la fiche d’un match terminé est gardée longtemps', (await duree('match:1')) > 3600);
check('ses statistiques aussi', (await duree('stats:1')) > 3600);
check('sa composition aussi', (await duree('compo:1')) > 3600);

/* ------------------------- une composition pas encore publiée revient vite */

/**
 * Une composition demandée avant sa parution revient vide. La garder six
 * heures ferait manquer sa publication : les réponses vides vivent quatre-
 * vingt-dix secondes.
 */
compoPubliee = false;
await pool.query(`DELETE FROM api_cache WHERE k IN ('match:2','compo:2','stats:2')`);
const dansUneHeure = new Date(Date.now() + 3600e3).toISOString();
const avantVide = appels;
// Un match à venir : ni statistiques ni fil, mais la composition est tentée.
client.call = ((base) => async function (path, params) {
  if (path === '/fixtures') {
    return [{ fixture: { id: 2, date: dansUneHeure, status: { short: 'NS' } },
              league: { round: 'Journée 6' },
              teams: { home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } },
              goals: { home: null, away: null } }];
  }
  return base.call(client, path, params);
})(client.call);

r = await get('/api/tt/match/2');
check('avant le coup d’envoi, la composition est tentée', appels > avantVide);
check('et son absence est annoncée sans planter', r.json.compositions === null);
check('aucune statistique n’est demandée avant le coup d’envoi',
  (r.json.statistiques ?? []).length === 0);
const vide = await duree('compo:2');
check('une composition vide n’est gardée que quatre-vingt-dix secondes',
  vide !== null && vide <= 90);

/* ============================= le cache et les fuseaux ==================

   La panne : tous les scores en direct gelés pendant des heures, sans une
   seule erreur nulle part.

   `expires_at` et `fetched_at` sont écrits avec `NOW(3)`, dans le fuseau de la
   session MySQL. Le pilote de production est réglé sur `timezone: 'Z'` et
   relisait donc ces colonnes comme de l'UTC : sur un serveur à l'heure de
   Zurich, elles revenaient **deux heures dans le futur**. Le cache du jour,
   réglé à quarante-cinq secondes, servait la même réponse pendant trois
   heures, et `luA` parti dans le futur figeait aussi la minute chez le client.

   Ce banc force un décalage franc — la session en `+05:00`, le pilote en
   `Z` — et vérifie les deux conséquences séparément. Avec l'ancien code il
   rougit des deux côtés ; avec le nouveau, la comparaison se fait en SQL et
   `UNIX_TIMESTAMP` rend l'instant déjà converti, donc le réglage du pilote
   n'a plus prise.
   ===================================================================== */
{
  const decale = mysql.createPool({
    uri: DB, connectionLimit: 2, ...OPTIONS_BASE,
    // Comme en production : le pilote relit toute date comme de l'UTC…
    timezone: 'Z',
  });
  // …tandis que la session écrit dans un tout autre fuseau.
  await decale.query(`SET time_zone = '+05:00'`);

  let vus = 0;
  /* Un client qui ne sait dire que oui, et qui compte. Ce qui est mesuré
     ici, ce sont les allers chez l’API, pas ce qu’ils rapportent. */
  const bavard = {
    async call(path) {
      if (path !== '/fixtures') return [];
      vus++;
      /* Un match, et un seul, dans une compétition activée : il faut que
         `jour()` produise une ligne, sinon `luA` n'a nulle part où sortir et
         le contrôle plus bas ne mesurerait rien. */
      return [{ fixture: { id: 4242, date: `${new Date().toISOString()}`,
                           status: { short: '2H', elapsed: 61 } },
                league: { id: 207, round: 'Journée 5' },
                teams: { home: { id: 85, name: 'Sion' }, away: { id: 91, name: 'Bâle' } },
                goals: { home: 1, away: 0 } }];
    },
  };
  const TZ = createTeletext({ pool: decale, client: bavard });

  await decale.query(`DELETE FROM api_cache WHERE k LIKE 'jour:%'`);
  const jour = new Date().toISOString().slice(0, 10);

  const a = await TZ.jour(jour);
  const apresPremier = vus;
  check('le premier appel va chercher la donnée', apresPremier === 1);

  /* La fraîcheur. On ramène l'expiration dans le passé : le prochain appel
     doit repartir chez l'API. Avec l'ancienne lecture, `expires_at` revenait
     cinq heures trop tard et la ligne restait « fraîche » tout ce temps. */
  await decale.query(
    `UPDATE api_cache SET expires_at = NOW(3) - INTERVAL 5 SECOND WHERE k = ?`,
    [`jour:${jour}`]);
  await TZ.jour(jour);
  check('une entrée expirée est bien redemandée, quel que soit le fuseau',
    vus === apresPremier + 1);
  if (vus !== apresPremier + 1) {
    console.log(`        appels : ${vus} au lieu de ${apresPremier + 1}`);
  }

  /* Et l'entrée encore valable ne doit pas être redemandée : sans ce
     contrôle-ci, « toujours redemander » passerait le précédent au vert. */
  const avantTroisieme = vus;
  await TZ.jour(jour);
  check('une entrée encore valable n’est pas redemandée', vus === avantTroisieme);

  /* L'instant de lecture, **tel que la page le reçoit**. C'est lui qui fait
     défiler la minute : parti dans le futur, `Date.now() - luA` devient
     négatif et `horloge.js` ramène l'écoulé à zéro — le chrono ne bouge plus.

     On le lit sur le match rendu, et surtout pas en réinterrogeant la base
     soi-même : une première version le faisait, et elle mesurait alors sa
     propre requête au lieu du code. Elle restait verte avec l'ancienne
     lecture. */
  const rendu = await TZ.jour(jour);
  const match = (rendu.groupes ?? []).flatMap((g) => g.matchs)[0];
  check('la journée rendue porte bien un match', Boolean(match));
  const ecart = match ? Math.abs(Date.now() - Number(match.luA)) : Infinity;
  check('l’instant de lecture est celui du moment, pas un fuseau plus loin',
    ecart < 60_000);
  if (ecart >= 60_000) {
    console.log(`        écart de ${Math.round(ecart / 60_000)} minute(s) —`
      + ' une date a traversé de MySQL vers JavaScript.');
  }

  await decale.end();
}

/* --------------------------------------------------------------- état */

r = await get('/api/tt/cache');
check('état du cache exposé', r.json.entrees >= 3);

console.log(`\n${failures ? `${failures} échec(s)` : 'tout est vert'} · ${appels} appels API pour toute la session`);
await pool.end(); http.close();
process.exit(failures ? 1 : 0);
