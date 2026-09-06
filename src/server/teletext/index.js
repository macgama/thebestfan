import express from 'express';

/**
 * Le télétexte : tous les championnats, leurs classements, leurs résultats et
 * leurs meilleurs joueurs.
 *
 * Le sujet ici n'est pas l'affichage, c'est le quota. Sept mille cinq cents
 * appels par jour ne suffisent pas si chaque consultation en déclenche un.
 * Tout passe donc par un cache en base : le premier joueur qui ouvre la Ligue 1
 * paie un appel, les mille suivants ne paient rien. Et quand le budget est
 * atteint, on sert la version périmée plutôt qu'une page vide.
 */

/** Durées de vie, en secondes. Elles suivent le rythme réel des données. */
const TTL = {
  jour: 900,          // les matchs d'une journée, hors direct
  jourLive: 45,       // dès qu'un match est en cours
  match: 600,         // fiche d'un match à venir ou terminé
  matchLive: 25,      // fiche d'un match en cours
  standings: 6 * 3600,
  scorers: 12 * 3600,
  assists: 12 * 3600,
  cards: 12 * 3600,
  fixtures: 3600,
  fixturesLive: 60,
  day: 300,
  dayLive: 60,
};

export function createTeletext({ pool, client, footballStore = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* --------------------------------------------------------------- cache */

  /**
   * Selon la version du pilote et la configuration, une colonne JSON revient
   * déjà décodée ou sous forme de chaîne. Les deux cas doivent marcher, sinon
   * le cache lève à chaque lecture et n'économise plus rien.
   */
  const decode = (v) => (typeof v === 'string' ? JSON.parse(v) : v);

  async function cached(key, ttlSec, fetcher) {
    const hit = (await q(
      `SELECT payload, expires_at, fetched_at FROM api_cache WHERE k = ?`, [key]))[0];
    if (hit && new Date(hit.expires_at) > new Date()) {
      // `luA` : l'instant de la lecture chez l'API, pas celui du service.
      // Sans cette distinction, le client croit la donnée fraîche à chaque
      // requête et le chrono d'un match en cours ne bouge jamais.
      return { data: decode(hit.payload), fresh: true,
               luA: new Date(hit.fetched_at).getTime() };
    }

    try {
      const luA = Date.now();
      const data = await fetcher();
      await q(
        `INSERT INTO api_cache (k, payload, expires_at)
         VALUES (?, ?, NOW(3) + INTERVAL ? SECOND)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload),
           expires_at = VALUES(expires_at), fetched_at = NOW(3)`,
        [key, JSON.stringify(data), ttlSec]);
      return { data, fresh: true, luA };
    } catch (e) {
      // Quota épuisé ou API en panne : la version périmée vaut mieux que rien.
      if (hit) {
        return { data: decode(hit.payload), fresh: false, stale: true,
                 luA: new Date(hit.fetched_at).getTime() };
      }
      throw e;
    }
  }

  /* ------------------------------------------------------------- saisons */

  /**
   * La saison en cours d'une compétition, déduite des dates.
   *
   * On ne se fie pas au drapeau `current` de l'API : il traîne parfois d'une
   * saison sur l'autre. La date du jour comparée au début et à la fin de la
   * saison est plus sûre. Hors saison, on garde la dernière connue — c'est ce
   * qu'un supporter veut voir en juillet.
   */
  async function seasonOf(leagueId) {
    const rows = await q(
      `SELECT season, starts_on, ends_on, name, country, family, type,
              has_standings, has_top_scorers, has_top_assists, has_top_cards
         FROM souvenir_leagues WHERE league_id = ? ORDER BY season DESC`,
      [leagueId]);
    if (!rows.length) return null;

    const today = new Date().toISOString().slice(0, 10);
    const enCours = rows.find((r) => r.starts_on && r.ends_on
      && String(r.starts_on).slice(0, 10) <= today
      && today <= String(r.ends_on).slice(0, 10));
    return enCours ?? rows[0];
  }

  /** Un match de cette compétition est-il en cours ? Décide de la fraîcheur. */
  async function hasLive(leagueId) {
    const r = await q(
      `SELECT 1 FROM fixtures
        WHERE league_id = ? AND status_short IN ('1H','HT','2H','ET','BT','P','LIVE')
        LIMIT 1`, [leagueId]);
    return r.length > 0;
  }

  /* --------------------------------------------------------- invalidation */

  /**
   * Un match vient de se terminer : le classement et les buteurs de sa
   * compétition sont désormais faux. On les efface plutôt que d'attendre six
   * heures — c'est précisément à ce moment que les gens vont les regarder.
   */
  async function invalider(leagueId) {
    await q(`DELETE FROM api_cache WHERE k LIKE ? OR k LIKE ? OR k LIKE ? OR k LIKE ?`,
      [`standings:${leagueId}:%`, `scorers:${leagueId}:%`,
       `assists:${leagueId}:%`, `cards:${leagueId}:%`]);
  }

  /* ------------------------------------------------------- matchs du jour */

  const enDirect = (s) => ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(s);
  const fini = (s) => ['FT', 'AET', 'PEN'].includes(s);

  /**
   * Tous les matchs d'une journée, toutes compétitions confondues.
   *
   * Un seul appel à l'API couvre le monde entier : c'est bien plus économe que
   * d'interroger chaque compétition. On ne garde que celles qui sont activées,
   * et on les regroupe pour que la page n'ait rien à trier.
   */
  async function jour(date, { userId = null } = {}) {
    const jourISO = /^\d{4}-\d{2}-\d{2}$/.test(String(date))
      ? date : new Date().toISOString().slice(0, 10);
    const aujourdhui = jourISO === new Date().toISOString().slice(0, 10);

    const { data, stale, luA } = await cached(`jour:${jourISO}`,
      aujourdhui ? TTL.jourLive : TTL.jour,
      () => client.call('/fixtures', { date: jourISO, timezone: 'UTC' }));

    const activees = new Map((await q(
      `SELECT league_id, name, country, tier, family FROM souvenir_leagues WHERE enabled = 1`))
      .map((l) => [l.league_id, l]));

    const suivis = userId ? new Set((await q(
      `SELECT team_id FROM user_follows WHERE user_id = ?`, [userId])).map((r) => r.team_id))
      : new Set();

    const parLigue = new Map();
    for (const r of data ?? []) {
      const l = activees.get(r.league?.id);
      if (!l) continue;
      const m = {
        id: r.fixture.id,
        date: r.fixture.date,
        status: r.fixture.status?.short,
        elapsed: r.fixture.status?.elapsed ?? null,
        // Instant de la lecture chez l'API : le client fait défiler le chrono
        // à partir de là, sans redemander quoi que ce soit.
        luA: luA ?? Date.now(),
        round: r.league?.round,
        home: { id: r.teams.home.id, name: r.teams.home.name, logo: r.teams.home.logo,
                goals: r.goals?.home, vainqueur: r.teams.home.winner },
        away: { id: r.teams.away.id, name: r.teams.away.name, logo: r.teams.away.logo,
                goals: r.goals?.away, vainqueur: r.teams.away.winner },
        live: enDirect(r.fixture.status?.short),
        fini: fini(r.fixture.status?.short),
        mien: suivis.has(r.teams.home.id) || suivis.has(r.teams.away.id),
      };
      if (!parLigue.has(l.league_id)) {
        parLigue.set(l.league_id, { ligue: l, matchs: [] });
      }
      parLigue.get(l.league_id).matchs.push(m);
    }

    // Ordre : mes clubs d'abord, puis les matchs en cours, puis le palier.
    const groupes = [...parLigue.values()].map((g) => ({
      ...g,
      matchs: g.matchs.sort((a, b) => new Date(a.date) - new Date(b.date)),
      mien: g.matchs.some((m) => m.mien),
      live: g.matchs.some((m) => m.live),
    })).sort((a, b) =>
      (b.mien - a.mien) || (b.live - a.live) || (a.ligue.tier - b.ligue.tier)
      || a.ligue.name.localeCompare(b.ligue.name));

    return {
      date: jourISO,
      groupes,
      total: groupes.reduce((n, g) => n + g.matchs.length, 0),
      enDirect: groupes.reduce((n, g) => n + g.matchs.filter((m) => m.live).length, 0),
      stale: Boolean(stale),
    };
  }

  /* ------------------------------------------------------- fiche du match */

  /**
   * Un match, avant, pendant et après.
   * Avant : la composition n'existe pas encore, on donne l'affiche et l'heure.
   * Pendant : le score, la minute et le fil des événements.
   * Après : le score final et le résumé complet.
   */
  async function match(fixtureId) {
    const { data, stale, luA } = await cached(`match:${fixtureId}`, TTL.matchLive, async () => {
      const [f] = await client.call('/fixtures', { id: fixtureId });
      if (!f) throw new Error('match introuvable');
      // Les événements ne sont demandés que s'il y a quelque chose à raconter.
      const evs = (enDirect(f.fixture.status?.short) || fini(f.fixture.status?.short))
        ? await client.call('/fixtures/events', { fixture: fixtureId }) : [];
      return { f, evs };
    });

    const f = data.f;
    const live = enDirect(f.fixture.status?.short);

    return {
      fixture: {
        id: f.fixture.id, date: f.fixture.date,
        status: f.fixture.status?.short, statusLong: f.fixture.status?.long,
        elapsed: f.fixture.status?.elapsed ?? null, luA: luA ?? Date.now(),
        venue: f.fixture.venue?.name, ville: f.fixture.venue?.city,
        arbitre: f.fixture.referee,
        live, fini: fini(f.fixture.status?.short),
      },
      ligue: { id: f.league?.id, nom: f.league?.name, pays: f.league?.country,
               logo: f.league?.logo, journee: f.league?.round, saison: f.league?.season },
      equipes: {
        home: { ...f.teams.home, goals: f.goals?.home },
        away: { ...f.teams.away, goals: f.goals?.away },
      },
      periodes: f.score ?? null,
      evenements: (data.evs ?? []).map((e) => ({
        minute: e.time?.elapsed, extra: e.time?.extra,
        equipe: e.team?.id, equipeNom: e.team?.name,
        type: e.type, detail: e.detail,
        joueur: e.player?.name, passeur: e.assist?.name,
      })).sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0)),
      stale: Boolean(stale),
    };
  }

  /* ------------------------------------------------------------- lecture */

  async function standings(leagueId) {
    const s = await seasonOf(leagueId);
    if (!s) return null;
    if (!s.has_standings) return { league: s, groups: [], unsupported: true };

    const { data, stale } = await cached(`standings:${leagueId}:${s.season}`,
      TTL.standings, () => client.standings(leagueId, s.season));

    const groups = (data[0]?.league?.standings ?? []).map((g) => g.map((r) => ({
      rank: r.rank, teamId: r.team.id, name: r.team.name, logo: r.team.logo,
      played: r.all?.played ?? 0, win: r.all?.win ?? 0, draw: r.all?.draw ?? 0,
      lose: r.all?.lose ?? 0, gf: r.all?.goals?.for ?? 0, ga: r.all?.goals?.against ?? 0,
      points: r.points, form: r.form, group: r.group,
    })));
    return { league: s, groups, stale: Boolean(stale) };
  }

  async function ranking(leagueId, kind) {
    const s = await seasonOf(leagueId);
    if (!s) return null;
    const drapeau = { scorers: 'has_top_scorers', assists: 'has_top_assists',
                      cards: 'has_top_cards' }[kind];
    if (!s[drapeau]) return { league: s, players: [], unsupported: true };

    const appel = {
      scorers: () => client.call('/players/topscorers', { league: leagueId, season: s.season }),
      assists: () => client.call('/players/topassists', { league: leagueId, season: s.season }),
      cards: () => client.call('/players/topyellowcards', { league: leagueId, season: s.season }),
    }[kind];

    const { data, stale } = await cached(`${kind}:${leagueId}:${s.season}`, TTL[kind], appel);

    const players = (data ?? []).slice(0, 25).map((p) => {
      const st = p.statistics?.[0] ?? {};
      return {
        name: p.player?.name, photo: p.player?.photo,
        team: st.team?.name, teamLogo: st.team?.logo,
        played: st.games?.appearences ?? 0,
        goals: st.goals?.total ?? 0,
        assists: st.goals?.assists ?? 0,
        yellow: st.cards?.yellow ?? 0,
        red: st.cards?.red ?? 0,
      };
    });
    return { league: s, players, stale: Boolean(stale) };
  }

  async function results(leagueId) {
    const s = await seasonOf(leagueId);
    if (!s) return null;
    const live = await hasLive(leagueId);
    const from = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10);

    const { data, stale } = await cached(
      `fixtures:${leagueId}:${s.season}:${from}`,
      live ? TTL.fixturesLive : TTL.fixtures,
      () => client.call('/fixtures', { league: leagueId, season: s.season, from, to, timezone: 'UTC' }));

    // Ce qu'on vient de lire sert à tout le monde : équipes, calendriers et
    // matchs terminés sont rangés durablement. Un match fini ne change plus
    // jamais — le redemander un jour serait un appel perdu.
    if (footballStore) {
      for (const r of data ?? []) {
        try {
          await footballStore.upsertTeam(r.teams.home);
          await footballStore.upsertTeam(r.teams.away);
          await footballStore.upsertFixture({
            id: r.fixture.id, leagueId: r.league.id, season: r.league.season,
            round: r.league.round, homeId: r.teams.home.id, awayId: r.teams.away.id,
            homeGoals: r.goals?.home ?? null, awayGoals: r.goals?.away ?? null,
            status: r.fixture.status?.short ?? 'NS', elapsed: r.fixture.status?.elapsed ?? null,
            venue: r.fixture.venue?.name ?? null,
            kickoffAt: new Date(r.fixture.date).toISOString().slice(0, 19).replace('T', ' '),
          });
        } catch { /* le télétexte ne doit pas tomber pour une écriture */ }
      }
    }

    const matchs = (data ?? []).map((r) => ({
      id: r.fixture.id,
      date: r.fixture.date,
      status: r.fixture.status?.short,
      elapsed: r.fixture.status?.elapsed,
      round: r.league?.round,
      home: { id: r.teams.home.id, name: r.teams.home.name, logo: r.teams.home.logo, goals: r.goals?.home },
      away: { id: r.teams.away.id, name: r.teams.away.name, logo: r.teams.away.logo, goals: r.goals?.away },
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    return { league: s, matchs, stale: Boolean(stale) };
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();

  /**
   * Durée pendant laquelle le navigateur peut se resservir tout seul.
   * Un joueur qui fait des allers-retours entre classement et buteurs ne
   * redemande alors rien au serveur, qui ne redemande rien à l'API.
   */
  const BROWSER = { '': 900, '/results': 120, '/scorers': 3600, '/assists': 3600, '/cards': 3600 };

  const send = (res, p, maxAge = 900) => p.then((v) => {
    if (v) res.set('cache-control', `private, max-age=${maxAge}`);
    return v ? res.json(v) : res.status(404).json({ error: 'teletext.error.unknown_league' });
  })
    .catch((e) => {
      console.error('[teletext]', e.message);
      res.status(503).json({ error: 'teletext.error.unavailable' });
    });

  /**
   * Enveloppe obligatoire pour toute route asynchrone.
   *
   * Sans elle, une requête SQL qui échoue rejette la promesse et Express ne
   * répond jamais : le navigateur attend indéfiniment, et l'utilisateur voit
   * une page qui tourne en boucle sans aucun message. C'est exactement ce qui
   * arrive quand le schéma n'est pas à jour — une colonne manquante suffit.
   */
  const safe = (fn) => (req, res) => {
    Promise.resolve(fn(req, res)).catch((e) => {
      console.error('[teletext]', req.path, e.message);
      if (res.headersSent) return;
      const manque = /Unknown column|doesn't exist/i.test(e.message);
      res.status(503).json({
        error: manque ? 'teletext.error.schema' : 'teletext.error.unavailable',
        detail: manque ? 'Applique sql/teletext.sql puis relance scripts/coverage.mjs' : undefined,
      });
    });
  };

  /** Le sommaire : servi depuis la base, jamais un appel à l'API. */
  router.get('/leagues', safe(async (req, res) => {
    const terme = String(req.query.q ?? '').trim();
    const pays = String(req.query.country ?? '').trim();
    const famille = String(req.query.family ?? '').trim();

    const where = ['enabled = 1'];
    const args = [];
    if (terme) { where.push('(name LIKE ? OR country LIKE ?)'); args.push(`%${terme}%`, `%${terme}%`); }
    if (pays) { where.push('country = ?'); args.push(pays); }
    if (famille) { where.push('family = ?'); args.push(famille); }

    const rows = await q(
      `SELECT league_id, name, country, type, family, season, tier,
              has_standings, has_top_scorers
         FROM souvenir_leagues
        WHERE ${where.join(' AND ')}
        ORDER BY tier, country, name
        LIMIT 200`, args);
    res.json({ leagues: rows });
  }));

  /** Les pays disponibles, pour le sélecteur. */
  router.get('/countries', safe(async (_req, res) => {
    const rows = await q(
      `SELECT country, COUNT(*) AS n FROM souvenir_leagues
        WHERE enabled = 1 AND country IS NOT NULL
        GROUP BY country ORDER BY n DESC`);
    res.json({ countries: rows });
  }));

  router.get('/league/:id', (req, res) =>
    send(res, standings(Number(req.params.id)), BROWSER['']));
  router.get('/league/:id/results', (req, res) =>
    send(res, results(Number(req.params.id)), BROWSER['/results']));
  router.get('/league/:id/scorers', (req, res) =>
    send(res, ranking(Number(req.params.id), 'scorers'), BROWSER['/scorers']));
  router.get('/league/:id/assists', (req, res) =>
    send(res, ranking(Number(req.params.id), 'assists'), BROWSER['/assists']));
  router.get('/league/:id/cards', (req, res) =>
    send(res, ranking(Number(req.params.id), 'cards'), BROWSER['/cards']));

  /** État du cache et du quota : utile pour surveiller la consommation. */
  /** Les matchs d'une journée. `mien` marque ceux des clubs suivis. */
  router.get('/jour', safe(async (req, res) => {
    const d = await jour(String(req.query.date ?? ''), { userId: req.user?.id ?? null });
    res.set('cache-control', 'private, max-age=30');
    res.json(d);
  }));

  router.get('/match/:id', safe(async (req, res) => {
    res.set('cache-control', 'private, max-age=20');
    res.json(await match(Number(req.params.id)));
  }));

  router.get('/cache', safe(async (_req, res) => {
    const [stats] = await pool.query(
      `SELECT COUNT(*) AS entrees,
              SUM(expires_at > NOW(3)) AS fraiches,
              MIN(fetched_at) AS plus_ancienne
         FROM api_cache`);
    res.json({ ...stats[0], quota: client.quota });
  }));

  /** Purge des entrées périmées depuis longtemps. À lancer une fois par jour. */
  async function cleanup() {
    await q(`DELETE FROM api_cache WHERE expires_at < NOW(3) - INTERVAL 7 DAY`);
  }

  return { router, standings, ranking, results, seasonOf, cleanup, jour, match, invalider };
}
