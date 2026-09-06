import { QuotaExhausted } from './client.js';

/* ------------------------------------------------------- normalisation */

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const DONE = new Set(['FT', 'AET', 'PEN']);

export const isLive = (s) => LIVE.has(s);
export const isDone = (s) => DONE.has(s);

/** Convertit une date ISO renvoyée par l'API en DATETIME MySQL, en UTC. */
const toSqlDate = (iso) => new Date(iso).toISOString().slice(0, 19).replace('T', ' ');

export function mapFixture(r) {
  return {
    id: r.fixture.id,
    leagueId: r.league.id,
    season: r.league.season,
    round: r.league.round ?? null,
    homeId: r.teams.home.id,
    awayId: r.teams.away.id,
    homeGoals: r.goals?.home ?? null,
    awayGoals: r.goals?.away ?? null,
    status: r.fixture.status?.short ?? 'NS',
    elapsed: r.fixture.status?.elapsed ?? null,
    venue: r.fixture.venue?.name ?? null,
    kickoffAt: toSqlDate(r.fixture.date),
    teams: r.teams,
    league: r.league,
  };
}

export function mapEvent(e) {
  return {
    type: e.type,
    detail: e.detail ?? null,
    teamId: e.team?.id,
    player: e.player?.name ?? null,
    assist: e.assist?.name ?? null,
    minute: e.time?.elapsed ?? null,
    extra: e.time?.extra ?? null,
  };
}

/* ---------------------------------------------------------------- worker */

/**
 * Interroge API-Football et tient la base à jour.
 *
 * Principe d'économie : on n'interroge que les équipes réellement suivies par
 * au moins un joueur. Une équipe que personne ne suit ne coûte rien. Le direct
 * regroupe jusqu'à 20 matchs par appel, ce qui rend un samedi après-midi
 * abordable même avec beaucoup d'utilisateurs.
 */
export function createPoller({ client, store, broadcast, onGoal, onFinished, log = console }) {
  // Matchs dont la fin a déjà été signalée. Sans ce garde, chaque tour
  // d'horloge réinvaliderait le cache d'une compétition déjà à jour.
  const finis = new Set();
  let timers = [];
  let running = false;

  /* ---------------------------------------------------- rafraîchissements */

  /** Appelé quand un joueur suit un club, puis une fois par jour. */
  async function refreshTeam(teamId) {
    const [teamRow] = await client.teamById(teamId);
    if (!teamRow) return null;
    await store.upsertTeam({ ...teamRow.team, country: teamRow.team.country });

    // Compétitions en cours de l'équipe.
    const leagues = await client.leaguesOfTeam(teamId);
    const current = [];
    for (const l of leagues) {
      const season = (l.seasons ?? []).find((s) => s.current)?.year
        ?? (l.seasons ?? []).at(-1)?.year;
      if (!season) continue;
      await store.upsertLeague({ ...l.league, country: l.country?.name, season });
      await store.linkTeamLeague(teamId, l.league.id, season);
      current.push({ leagueId: l.league.id, season });
    }

    // Calendrier : 45 jours en arrière, 45 en avant. Un seul appel par saison.
    const seasons = [...new Set(current.map((c) => c.season))];
    const from = new Date(Date.now() - 45 * 864e5).toISOString().slice(0, 10);
    const to = new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10);

    for (const season of seasons) {
      const rows = await client.fixturesOfTeam(teamId, season, from, to);
      for (const r of rows) {
        const f = mapFixture(r);
        await store.upsertTeam(f.teams.home);
        await store.upsertTeam(f.teams.away);
        await store.upsertLeague({ ...f.league, season: f.season });
        await store.upsertFixture(f);
      }
    }
    return teamRow.team;
  }

  /* ------------------------------------------------------------- direct */

  /**
   * Un tour de direct. Renvoie le nombre de matchs suivis en cours, ce qui
   * permet à la boucle d'accélérer ou de se mettre en veille.
   */
  async function pollLive() {
    const ids = [...new Set([...(await store.liveFixtureIds()), ...(await store.dueToStartIds())])];
    if (!ids.length) return 0;

    let live = 0;
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      const rows = await client.fixturesByIds(batch);

      for (const r of rows) {
        const f = mapFixture(r);
        const before = await store.upsertFixture(f);
        if (isLive(f.status)) live++;

        const scoreChanged = before
          && (before.home_goals !== f.homeGoals || before.away_goals !== f.awayGoals);
        const statusChanged = !before || before.status_short !== f.status;

        if (scoreChanged || statusChanged) {
          broadcast?.('football:fixture', publicFixture(f));
        }

        // Les événements ne sont demandés que lorsque le score a bougé :
        // c'est ce qui évite de payer un appel par match et par minute.
        if (scoreChanged) await pullEvents(f);
      }
    }
    return live;
  }

  async function pullEvents(f) {
    const known = await store.eventsOf(f.id);
    const rows = await client.eventsOfFixture(f.id);
    const events = rows.map(mapEvent);
    const inserted = await store.insertEvents(f.id, events);
    if (!inserted) return;

    // Seuls les buts nouveaux depuis le dernier passage sont annoncés.
    // Match terminé : les classements de sa compétition sont désormais faux.
    if (['FT', 'AET', 'PEN'].includes(f.status) && !finis.has(f.id)) {
      finis.add(f.id);
      try { await onFinished?.(f); } catch (e) { log.error('[poller] fin de match', e.message); }
    }

    const fresh = events.slice(known.length).filter((e) => e.type === 'Goal');
    let rank = events.slice(0, known.length).filter((e) => e.type === 'Goal').length;
    for (const g of fresh) {
      const payload = {
        fixtureId: f.id,
        // Rang du but dans le match : c'est la clé qui rend la frappe des
        // cartes-souvenirs rejouable sans doublon.
        seq: ++rank,
        leagueId: f.leagueId,
        kickoffAt: f.kickoffAt,
        teamId: g.teamId,
        minute: g.minute,
        player: g.player,
        score: [f.homeGoals, f.awayGoals],
        home: f.teams.home,
        away: f.teams.away,
      };
      broadcast?.('football:goal', payload);
      try {
        await onGoal?.(payload);
      } catch (e) {
        log.error('[foot] onGoal', e.message);
      }
    }
  }

  /* -------------------------------------------------------- classements */

  async function refreshStandings() {
    const stale = await store.staleLeagues(6);
    for (const { league_id: leagueId, season } of stale) {
      const rows = await client.standings(leagueId, season);
      const groups = rows[0]?.league?.standings ?? [];
      for (const group of groups) {
        await store.upsertStandings(leagueId, season, group.map((s) => ({
          teamId: s.team.id,
          rank: s.rank,
          points: s.points,
          played: s.all?.played ?? 0,
          win: s.all?.win ?? 0,
          draw: s.all?.draw ?? 0,
          lose: s.all?.lose ?? 0,
          goalsFor: s.all?.goals?.for ?? 0,
          goalsAgainst: s.all?.goals?.against ?? 0,
          form: s.form ?? null,
          group: s.group ?? null,
        })));
        for (const s of group) await store.upsertTeam(s.team);
      }
    }
    return stale.length;
  }

  async function refreshAllTeams() {
    const ids = await store.followedTeamIds();
    for (const id of ids) {
      try {
        await refreshTeam(id);
      } catch (e) {
        if (e instanceof QuotaExhausted) throw e;
        log.error(`[foot] équipe ${id}`, e.message);
      }
    }
    return ids.length;
  }

  /* ----------------------------------------------------------- boucles */

  async function safely(name, fn) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof QuotaExhausted) log.warn(`[foot] ${name} reporté : ${e.message}`);
      else log.error(`[foot] ${name}`, e.message);
      return null;
    }
  }

  function start() {
    if (running) return;
    running = true;

    // Direct : 20 s tant qu'un match suivi est en cours, sinon un simple
    // coup d'œil à la base toutes les 2 minutes, qui ne coûte aucun appel.
    let liveDelay = 120_000;
    const liveLoop = async () => {
      if (!running) return;
      const live = await safely('direct', pollLive);
      liveDelay = live > 0 ? 20_000 : 120_000;
      timers.push(setTimeout(liveLoop, liveDelay));
    };
    timers.push(setTimeout(liveLoop, 3_000));

    timers.push(setInterval(() => safely('classements', refreshStandings), 6 * 3600_000));
    timers.push(setInterval(() => safely('calendriers', refreshAllTeams), 24 * 3600_000));
    timers.push(setInterval(() => client.resetDay(), 24 * 3600_000));

    // Premier remplissage peu après le démarrage.
    timers.push(setTimeout(() => safely('classements', refreshStandings), 30_000));
    return this;
  }

  function stop() {
    running = false;
    for (const t of timers) { clearTimeout(t); clearInterval(t); }
    timers = [];
  }

  return { start, stop, refreshTeam, refreshAllTeams, pollLive, refreshStandings };
}

/** Forme envoyée aux clients : pas de données brutes de l'API. */
export function publicFixture(f) {
  return {
    id: f.id,
    league: { id: f.league?.id, name: f.league?.name, logo: f.league?.logo, round: f.round },
    home: { id: f.homeId, name: f.teams?.home?.name, logo: f.teams?.home?.logo, goals: f.homeGoals },
    away: { id: f.awayId, name: f.teams?.away?.name, logo: f.teams?.away?.logo, goals: f.awayGoals },
    status: f.status,
    elapsed: f.elapsed,
    kickoffAt: f.kickoffAt,
    live: isLive(f.status),
    done: isDone(f.status),
  };
}
