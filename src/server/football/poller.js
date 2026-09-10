import { QuotaExhausted } from './client.js';

/* ------------------------------------------------------- normalisation */

const LIVE = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT']);
const DONE = new Set(['FT', 'AET', 'PEN']);

export const isLive = (s) => LIVE.has(s);
export const isDone = (s) => DONE.has(s);

/**
 * Intervalle minimal entre deux relevés d'événements d'un même match.
 *
 * Le direct tourne toutes les vingt secondes ; y accrocher un appel
 * d'événements ferait trois appels par minute et par match suivi, soit près de
 * quatre cents pour un match de deux heures. À la minute, c'est cent vingt —
 * et seulement pour les matchs dont une salle de virage est occupée.
 */
export const EVENTS_MIN_MS = 60_000;

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
export function createPoller({ client, store, broadcast, onGoal, onFinished,
                               onEvents, onStatus, fixturesAuFil = () => [],
                               log = console }) {
  // Matchs dont la fin a déjà été signalée. Sans ce garde, chaque tour
  // d'horloge réinvaliderait le cache d'une compétition déjà à jour.
  const finis = new Set();
  // Dernier relevé d'événements par match, pour ne pas en demander deux dans
  // la même minute.
  const releves = new Map();
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

    // Les matchs dont une salle de virage est occupée : eux seuls justifient
    // un relevé d'événements en dehors d'un changement de score.
    let auFil = new Set();
    try { auFil = new Set(fixturesAuFil() ?? []); }
    catch (e) { log.error('[foot] salles au fil', e.message); }

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

        /* Le score, la minute et la période partent à chaque tour, sans un
           appel de plus : ils sont déjà dans la réponse qu'on vient de lire.
           C'est ce qui permet au fil du Grand Virage d'annoncer la mi-temps
           et le coup de sifflet final même les jours où le quota est serré. */
        try {
          onStatus?.(f.id, { status: f.status, elapsed: f.elapsed,
            homeGoals: f.homeGoals, awayGoals: f.awayGoals });
        } catch (e) { log.error('[foot] onStatus', e.message); }

        /* Match terminé : les classements de sa compétition sont désormais
           faux, et c'est exactement le moment où on va les regarder.

           L'annonce vivait dans `pullEvents`, qui ne s'exécutait que sur un
           changement de score : un match sans but ne l'a jamais déclenchée, et
           un match à but l'a déclenchée au dernier but plutôt qu'au coup de
           sifflet. Ici elle est adossée au statut, qu'on lit de toute façon —
           et elle ne coûte toujours rien. */
        if (isDone(f.status) && !finis.has(f.id)) {
          finis.add(f.id);
          try { await onFinished?.(f); }
          catch (e) { log.error('[poller] fin de match', e.message); }
        }

        /* Les événements, eux, coûtent un appel par match. Deux raisons
           seulement de les demander :

             — le score a bougé : il faut le buteur pour la carte-souvenir ;
             — quelqu'un est dans le virage de ce match et attend son fil.

           Le second cas est borné à un relevé par minute. Un match que
           personne ne regarde ne coûte donc pas un appel de plus qu'avant le
           fil, et le fil ne peut pas coûter plus d'un appel par minute et par
           salle occupée. */
        const attendu = auFil.has(f.id)
          && Date.now() - (releves.get(f.id) ?? 0) >= EVENTS_MIN_MS;
        if (scoreChanged || attendu) await pullEvents(f);
      }
    }
    return live;
  }

  /**
   * Identité d'un événement.
   *
   * On ne peut pas se fier à sa position dans la liste : l'API en insère
   * parfois un plus tôt — correction VAR, carton ajouté après coup — et tout
   * ce qui suit se décale. Un but pouvait alors être considéré comme déjà vu
   * et n'être jamais annoncé. C'est ce qui explique un 3-1 avec seulement
   * trois cartes-souvenirs.
   */
  const identite = (e) => {
    // Les lignes lues en base nomment la colonne `team_id`, les événements de
    // l'API `teamId`. Sans cette normalisation, aucune identité ne correspond
    // et chaque relevé réannonce tous les buts du match.
    const equipe = e.teamId ?? e.team_id;
    return `${e.type}|${equipe}|${e.minute ?? '?'}|${e.extra ?? 0}|` +
           `${e.player ?? ''}|${e.detail ?? ''}`;
  };

  async function pullEvents(f) {
    const known = await store.eventsOf(f.id);
    const rows = await client.eventsOfFixture(f.id);
    const events = rows.map(mapEvent);
    releves.set(f.id, Date.now());
    await store.insertEvents(f.id, events);

    const dejaVus = new Set(known.map(identite));

    /* Tout ce qui n'avait pas encore été vu part au fil du Grand Virage :
       cartons, remplacements, arbitrage vidéo. Les buts sont du lot, mais la
       salle les écarte — ils ont déjà leur chemin, celui qui secoue la corde
       et ouvre la minute double, et le fil ne doit pas les raconter deux
       fois. */
    const nouveaux = events.filter((e) => !dejaVus.has(identite(e)));
    if (nouveaux.length) {
      try { onEvents?.(f.id, nouveaux); }
      catch (e) { log.error('[foot] onEvents', e.message); }
    }

    const buts = events.filter((e) => e.type === 'Goal');

    // Le rang d'un but est sa place parmi tous les buts du match, dans
    // l'ordre chronologique. Il ne dépend plus de ce qui l'entoure, donc il
    // reste le même d'un relevé à l'autre : la frappe est rejouable.
    const ordonnes = buts.slice().sort((a, b) =>
      (a.minute ?? 0) - (b.minute ?? 0) || (a.extra ?? 0) - (b.extra ?? 0));

    for (const [i, g] of ordonnes.entries()) {
      if (dejaVus.has(identite(g))) continue;

      // Score à cet instant précis, reconstitué en comptant les buts
      // précédents. L'ancien code prenait le score courant, ce qui datait
      // faussement toutes les cartes frappées dans le même relevé.
      const avant = ordonnes.slice(0, i + 1);
      const marques = (equipe) => avant.filter((x) => x.teamId === equipe).length;

      const payload = {
        fixtureId: f.id,
        seq: i + 1,
        leagueId: f.leagueId,
        kickoffAt: f.kickoffAt,
        teamId: g.teamId,
        minute: g.minute,
        player: g.player,
        score: [marques(f.teams.home?.id), marques(f.teams.away?.id)],
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
