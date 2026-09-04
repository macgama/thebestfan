import express from 'express';
import { createFootballStore } from './store.js';
import { createPoller, isLive } from './poller.js';

/**
 * Suivi des équipes : recherche, abonnement, calendrier, classement.
 *
 * Toutes les données servies ici viennent de la base, pas de l'API : une page
 * consultée mille fois ne coûte aucun appel. Seule la recherche d'un club
 * inconnu déclenche un appel, et seulement si la base ne sait pas répondre.
 */
export function createFootball({ pool, client, io, requireAuth, onGoal }) {
  const store = createFootballStore(pool);
  client.attachStore?.(store);

  // Termes déjà demandés à l'API : sans ça, une recherche sans résultat
  // relancerait un appel à chaque frappe de l'utilisateur.
  const searched = new Map();
  const SEARCH_TTL = 6 * 3600_000;

  const broadcast = (event, payload) => {
    const teams = event === 'football:goal'
      ? [payload.teamId, payload.home?.id, payload.away?.id]
      : [payload.home?.id, payload.away?.id];
    for (const id of new Set(teams.filter(Boolean))) {
      io?.to(`team:${id}`).emit(event, payload);
    }
  };

  const poller = createPoller({ client, store, broadcast, onGoal });

  /* -------------------------------------------------------------- socket */

  io?.on('connection', (socket) => {
    socket.on('football:watch', (teamIds) => {
      if (!Array.isArray(teamIds)) return;
      for (const id of teamIds.slice(0, 20)) {
        if (Number.isInteger(id)) socket.join(`team:${id}`);
      }
    });
    socket.on('football:unwatch', (teamIds) => {
      if (!Array.isArray(teamIds)) return;
      for (const id of teamIds) socket.leave(`team:${id}`);
    });
  });

  /* -------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  const fail = (res, code, status = 400) => res.status(status).json({ error: code });

  /** Recherche : base d'abord, API seulement si elle ne suffit pas. */
  router.get('/search', async (req, res) => {
    const term = String(req.query.q ?? '').trim();
    if (term.length < 3) return fail(res, 'football.error.query_short');

    try {
      const key = term.toLowerCase();
      let rows = await store.searchTeamsLocal(term);
      const asked = searched.get(key) ?? 0;

      // On ne dérange l'API que si la base ne connaît rien, et jamais deux
      // fois pour le même terme dans la journée.
      if (rows.length === 0 && Date.now() - asked > SEARCH_TTL) {
        searched.set(key, Date.now());
        const api = await client.searchTeams(term);
        for (const r of api.slice(0, 20)) await store.upsertTeam(r.team);
        rows = await store.searchTeamsLocal(term);
      }
      res.json({ teams: rows });
    } catch (e) {
      // Quota épuisé : on rend ce que la base connaît plutôt qu'une erreur.
      const rows = await store.searchTeamsLocal(term).catch(() => []);
      res.json({ teams: rows, partial: true });
    }
  });

  router.get('/follows', requireAuth, async (req, res) => {
    res.json({ teams: await store.followsOf(req.user.id) });
  });

  router.post('/follows', requireAuth, async (req, res) => {
    const teamId = Number(req.body?.teamId);
    if (!Number.isInteger(teamId)) return fail(res, 'football.error.team_invalid');

    const toLoad = await store.needsBootstrap(teamId);
    await store.follow(req.user.id, teamId, Boolean(req.body?.isMain));

    // Compétitions et calendrier chargés en arrière-plan au premier suivi.
    if (toLoad) {
      poller.refreshTeam(teamId).catch((e) => console.error('[foot] refreshTeam', e.message));
    }
    res.json({ teams: await store.followsOf(req.user.id), loading: toLoad });
  });

  router.delete('/follows/:teamId', requireAuth, async (req, res) => {
    await store.unfollow(req.user.id, Number(req.params.teamId));
    res.json({ teams: await store.followsOf(req.user.id) });
  });

  /** Le fil du joueur : pour chaque club suivi, le direct, le prochain, le dernier. */
  router.get('/feed', requireAuth, async (req, res) => {
    const teams = await store.followsOf(req.user.id);
    const feed = [];
    for (const t of teams) {
      const { past, upcoming } = await store.fixturesOfTeam(t.id, { past: 3, next: 3 });
      const live = upcoming.filter((f) => isLive(f.status_short));
      feed.push({
        team: t,
        live,
        next: upcoming.filter((f) => !isLive(f.status_short)).slice(0, 2),
        last: past,
      });
    }
    res.json({ feed });
  });

  /** Recharge manuelle d'un club : utile quand un chargement a échoué. */
  router.post('/refresh/:teamId', requireAuth, async (req, res) => {
    const teamId = Number(req.params.teamId);
    if (!Number.isInteger(teamId)) return fail(res, 'football.error.team_invalid');
    try {
      await poller.refreshTeam(teamId);
      res.json({ ok: true, ...(await store.fixturesOfTeam(teamId, { past: 1, next: 1 })) });
    } catch (e) {
      console.error('[foot] refresh', e.message);
      fail(res, 'football.error.refresh_failed', 502);
    }
  });

  router.get('/team/:id', async (req, res) => {
    const id = Number(req.params.id);
    const team = await store.teamById(id);
    if (!team) return fail(res, 'football.error.team_unknown', 404);

    const [fixtures, leagues] = await Promise.all([
      store.fixturesOfTeam(id, { past: 8, next: 8 }),
      store.leaguesOfTeam(id),
    ]);
    res.json({ team, leagues, ...fixtures });
  });

  router.get('/league/:id/standings', async (req, res) => {
    const leagueId = Number(req.params.id);
    const season = Number(req.query.season);
    const rows = await store.standingsOfLeague(leagueId, season);
    res.json({ standings: rows });
  });

  router.get('/fixture/:id/events', async (req, res) => {
    res.json({ events: await store.eventsOf(Number(req.params.id)) });
  });

  router.get('/quota', requireAuth, async (_req, res) => {
    res.json({ ...(await store.quotaToday()), ...client.quota });
  });

  return { router, store, poller };
}
