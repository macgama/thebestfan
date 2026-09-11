import { verifierEmplacement } from '../onboarding/slots.js';

/** Requêtes SQL du suivi des équipes. Aucun appel réseau ici. */
export function createFootballStore(pool) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  return {
    /* ------------------------------------------------------- référentiel */

    async upsertTeam(t) {
      await q(
        `INSERT INTO teams (id, name, code, country, logo, founded, national)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code),
           country=VALUES(country), logo=VALUES(logo), founded=VALUES(founded),
           national=VALUES(national)`,
        [t.id, t.name, t.code ?? null, t.country ?? null, t.logo ?? null,
         t.founded ?? null, t.national ? 1 : 0],
      );
    },

    async upsertLeague(l) {
      await q(
        `INSERT INTO leagues (id, name, country, logo, type, current_season)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), country=VALUES(country),
           logo=VALUES(logo), type=VALUES(type),
           current_season=COALESCE(VALUES(current_season), current_season)`,
        [l.id, l.name, l.country ?? null, l.logo ?? null, l.type ?? null, l.season ?? null],
      );
    },

    async linkTeamLeague(teamId, leagueId, season) {
      await q(
        `INSERT IGNORE INTO team_leagues (team_id, league_id, season) VALUES (?, ?, ?)`,
        [teamId, leagueId, season],
      );
    },

    async searchTeamsLocal(term) {
      return q(
        `SELECT id, name, country, logo FROM teams
          WHERE name LIKE ? ORDER BY CHAR_LENGTH(name) LIMIT 12`,
        [`%${term}%`],
      );
    },

    /**
     * Un club connu de nom n'est pas un club chargé : la recherche enregistre
     * la fiche, mais ni les compétitions ni le calendrier. C'est cette
     * distinction qui décide du premier chargement.
     */
    async needsBootstrap(teamId) {
      const rows = await q(
        `SELECT (SELECT COUNT(*) FROM team_leagues WHERE team_id = ?) AS leagues,
                (SELECT COUNT(*) FROM fixtures WHERE home_id = ? OR away_id = ?) AS fixtures`,
        [teamId, teamId, teamId],
      );
      return !rows[0] || rows[0].leagues === 0 || rows[0].fixtures === 0;
    },

    async teamById(id) {
      const rows = await q(`SELECT * FROM teams WHERE id = ?`, [id]);
      return rows[0] ?? null;
    },

    /* ------------------------------------------------------------ suivis */

    /**
     * Suivre un club — **avec la règle des emplacements**.
     *
     * Elle manquait ici, et c'était la porte de derrière : la page « Mes
     * clubs » suit par cette route, qui écrivait sans rien demander à
     * personne. On pouvait donc suivre quatre clubs avec deux emplacements,
     * sans rien forcer, juste en s'en servant.
     *
     * La règle n'est pas recopiée : elle est appelée là où elle vit. Deux
     * écritures de la même règle finissent par ne plus dire la même chose.
     */
    async follow(userId, teamId, isMain) {
      await verifierEmplacement(q, userId, teamId);
      if (isMain) await q(`UPDATE user_follows SET is_main = 0 WHERE user_id = ?`, [userId]);
      await q(
        `INSERT INTO user_follows (user_id, team_id, is_main) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE is_main = VALUES(is_main)`,
        [userId, teamId, isMain ? 1 : 0],
      );
    },

    async unfollow(userId, teamId) {
      await q(`DELETE FROM user_follows WHERE user_id = ? AND team_id = ?`, [userId, teamId]);
    },

    async followsOf(userId) {
      return q(
        `SELECT t.id, t.name, t.country, t.logo, f.is_main
           FROM user_follows f JOIN teams t ON t.id = f.team_id
          WHERE f.user_id = ? ORDER BY f.is_main DESC, t.name`,
        [userId],
      );
    },

    /** Les équipes réellement suivies : le worker n'interroge rien d'autre. */
    async followedTeamIds() {
      const rows = await q(`SELECT DISTINCT team_id FROM user_follows`);
      return rows.map((r) => r.team_id);
    },

    async followersOfTeam(teamId) {
      const rows = await q(`SELECT user_id FROM user_follows WHERE team_id = ?`, [teamId]);
      return rows.map((r) => r.user_id);
    },

    /* ----------------------------------------------------------- matchs */

    /**
     * Renvoie ce qui a changé, pour ne diffuser que du nouveau.
     * `null` si le match était inconnu, sinon l'ancien score et l'ancien statut.
     */
    async upsertFixture(f) {
      const before = (await q(
        `SELECT home_goals, away_goals, status_short, elapsed FROM fixtures WHERE id = ?`,
        [f.id],
      ))[0] ?? null;

      await q(
        `INSERT INTO fixtures (id, league_id, season, round, home_id, away_id,
                               home_goals, away_goals, status_short, elapsed, elapsed_extra, venue,
                               kickoff_at, polled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(3))
         ON DUPLICATE KEY UPDATE
           home_goals=VALUES(home_goals), away_goals=VALUES(away_goals),
           status_short=VALUES(status_short), elapsed=VALUES(elapsed),
           elapsed_extra=VALUES(elapsed_extra),
           kickoff_at=VALUES(kickoff_at), round=VALUES(round),
           polled_at=NOW(3)`,
        [f.id, f.leagueId, f.season, f.round ?? null, f.homeId, f.awayId,
         f.homeGoals ?? null, f.awayGoals ?? null, f.status, f.elapsed ?? null,
         f.elapsedExtra ?? null,
         f.venue ?? null, f.kickoffAt],
      );
      return before;
    },

    /**
     * Enregistre le relevé d'événements d'un match, tel qu'il est à cet instant.
     *
     * `seq` est la place dans la liste de l'API, et **cette place bouge** : une
     * correction d'arbitrage vidéo, un carton ajouté après coup, et tout ce qui
     * suit se décale d'un cran.
     *
     * Le relevé était écrit en `INSERT IGNORE`. Les lignes déjà présentes
     * gardaient donc leur ancien contenu, et seules les positions de queue —
     * celles qui n'existaient pas encore — étaient écrites, avec un contenu
     * décalé d'un rang. La base finissait par porter un événement en double et
     * en perdre un autre, sans que rien ne le signale : la déduplication des
     * buts passe par leur identité, pas par leur rang, donc les
     * cartes-souvenirs restaient justes et personne ne voyait la dérive.
     * Le fil du match, lui, la montre.
     *
     * On réécrit donc tout le relevé à chaque passage, et on coupe la queue
     * quand l'API raccourcit sa liste — ce qui arrive quand un but est
     * finalement refusé. `created_at` n'est pas touché : c'est l'instant où
     * l'événement a été vu pour la première fois.
     */
    async insertEvents(fixtureId, events) {
      if (!events.length) return 0;
      const values = events.map((e, i) => [
        fixtureId, i, e.type, e.detail ?? null, e.teamId,
        e.player ?? null, e.assist ?? null, e.minute ?? null, e.extra ?? null,
      ]);
      await pool.query(
        `INSERT INTO fixture_events
           (fixture_id, seq, type, detail, team_id, player, assist, minute, extra)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           type = VALUES(type), detail = VALUES(detail), team_id = VALUES(team_id),
           player = VALUES(player), assist = VALUES(assist),
           minute = VALUES(minute), extra = VALUES(extra)`,
        [values],
      );
      await q(`DELETE FROM fixture_events WHERE fixture_id = ? AND seq >= ?`,
        [fixtureId, events.length]);
      return events.length;
    },

    async eventsOf(fixtureId) {
      return q(
        `SELECT seq, type, detail, team_id, player, assist, minute, extra
           FROM fixture_events WHERE fixture_id = ? ORDER BY seq`,
        [fixtureId],
      );
    },

    /** Matchs en cours parmi les équipes suivies : la cible du direct. */
    async liveFixtureIds() {
      const rows = await q(
        `SELECT DISTINCT f.id FROM fixtures f
          WHERE f.status_short IN ('1H','HT','2H','ET','BT','P','LIVE','INT')
            AND (f.home_id IN (SELECT team_id FROM user_follows)
              OR f.away_id IN (SELECT team_id FROM user_follows))`,
      );
      return rows.map((r) => r.id);
    },

    /** Matchs qui devraient avoir commencé mais qu'on croit encore à venir. */
    async dueToStartIds(withinMinutes = 15) {
      const rows = await q(
        `SELECT DISTINCT f.id FROM fixtures f
          WHERE f.status_short IN ('NS','TBD')
            AND f.kickoff_at <= (UTC_TIMESTAMP() + INTERVAL ? MINUTE)
            AND f.kickoff_at >  (UTC_TIMESTAMP() - INTERVAL 4 HOUR)
            AND (f.home_id IN (SELECT team_id FROM user_follows)
              OR f.away_id IN (SELECT team_id FROM user_follows))`,
        [withinMinutes],
      );
      return rows.map((r) => r.id);
    },

    async fixturesOfTeam(teamId, { past = 5, next = 5 } = {}) {
      /* `elapsed_extra` et `polled_at` : la page fait courir la minute
         elle-même à partir de l'instant du relevé. Sans eux, elle ne peut
         qu'afficher la minute telle qu'elle a été lue — figée jusqu'au
         prochain passage du relevé, et sans jamais pouvoir dire « 90+3 ». */
      const sel = `f.id, f.league_id, f.season, f.round, f.home_id, f.away_id,
                   f.home_goals, f.away_goals, f.status_short, f.elapsed,
                   f.elapsed_extra, f.polled_at, f.kickoff_at,
                   h.name AS home_name, h.logo AS home_logo,
                   a.name AS away_name, a.logo AS away_logo,
                   l.name AS league_name, l.logo AS league_logo`;
      const join = `FROM fixtures f
                    JOIN teams h ON h.id = f.home_id
                    JOIN teams a ON a.id = f.away_id
                    LEFT JOIN leagues l ON l.id = f.league_id`;
      const passed = await q(
        `SELECT ${sel} ${join}
          WHERE (f.home_id = ? OR f.away_id = ?) AND f.status_short IN ('FT','AET','PEN')
          ORDER BY f.kickoff_at DESC LIMIT ${Number(past)}`,
        [teamId, teamId],
      );
      const upcoming = await q(
        `SELECT ${sel} ${join}
          WHERE (f.home_id = ? OR f.away_id = ?) AND f.status_short NOT IN ('FT','AET','PEN','CANC')
          ORDER BY f.kickoff_at ASC LIMIT ${Number(next)}`,
        [teamId, teamId],
      );
      return { past: passed, upcoming };
    },

    /* ------------------------------------------------------- classements */

    async upsertStandings(leagueId, season, rows) {
      for (const r of rows) {
        await q(
          `INSERT INTO standings (league_id, season, team_id, \`rank\`, points, played,
                                  win, draw, lose, goals_for, goals_against, form, group_label)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE \`rank\`=VALUES(\`rank\`), points=VALUES(points),
             played=VALUES(played), win=VALUES(win), draw=VALUES(draw), lose=VALUES(lose),
             goals_for=VALUES(goals_for), goals_against=VALUES(goals_against),
             form=VALUES(form), group_label=VALUES(group_label)`,
          [leagueId, season, r.teamId, r.rank, r.points, r.played, r.win, r.draw,
           r.lose, r.goalsFor, r.goalsAgainst, r.form ?? null, r.group ?? null],
        );
      }
    },

    async standingsOfLeague(leagueId, season) {
      return q(
        `SELECT s.*, t.name, t.logo FROM standings s
           JOIN teams t ON t.id = s.team_id
          WHERE s.league_id = ? AND s.season = ?
          ORDER BY s.group_label, s.\`rank\``,
        [leagueId, season],
      );
    },

    async leaguesOfTeam(teamId) {
      return q(
        `SELECT l.id, l.name, l.logo, l.type, tl.season
           FROM team_leagues tl JOIN leagues l ON l.id = tl.league_id
          WHERE tl.team_id = ? ORDER BY l.type DESC, l.name`,
        [teamId],
      );
    },

    async staleLeagues(maxAgeHours = 6) {
      return q(
        `SELECT DISTINCT tl.league_id, tl.season
           FROM team_leagues tl
          WHERE tl.team_id IN (SELECT team_id FROM user_follows)
            AND NOT EXISTS (
              SELECT 1 FROM standings s
               WHERE s.league_id = tl.league_id AND s.season = tl.season
                 AND s.updated_at > (NOW(3) - INTERVAL ? HOUR))`,
        [maxAgeHours],
      );
    },

    /* ------------------------------------------------------------ quota */

    async recordApiCall(remaining) {
      await q(
        `INSERT INTO api_quota (day, used, remaining) VALUES (UTC_DATE(), 1, ?)
         ON DUPLICATE KEY UPDATE used = used + 1, remaining = COALESCE(VALUES(remaining), remaining)`,
        [remaining ?? null],
      );
    },

    async quotaToday() {
      const rows = await q(`SELECT used, remaining FROM api_quota WHERE day = UTC_DATE()`);
      return rows[0] ?? { used: 0, remaining: null };
    },
  };
}
