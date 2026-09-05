import express from 'express';

/**
 * Cartes-souvenirs.
 *
 * Un but réel frappe une carte. Ceux qui poussaient dans le Grand Virage au
 * moment où le serveur a vu ce but en reçoivent la version « présence » :
 * nominative, incessible, teintée du Fanzzy qu'ils portaient. Les autres
 * peuvent en acheter la « vignette » en écharpes, pendant quinze jours.
 *
 * Les deux montrent la même image. Une seule prouve quelque chose.
 */

export const PRESENCE_WINDOW_MS = 2 * 60 * 1000;   // avoir poussé dans les 2 minutes
export const MARKET_DAYS = 15;

/** Prix d'une vignette, en écharpes. Une finale vaut plus qu'un match de poule. */
const PRICE = { championnat: 60, coupe: 90, international: 140, amical: 30 };

export function createSouvenirs({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* ------------------------------------------------------- présence */

  /**
   * Enregistre une poussée dans le Grand Virage.
   * Appelée par la couche temps réel à chaque contribution, pas par le client.
   */
  async function recordPush({ userId, fixtureId, side, fanzzyId, amount }) {
    await q(
      `INSERT INTO virage_presence (user_id, fixture_id, side, fanzzy_id, ferveur)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ferveur = ferveur + VALUES(ferveur),
         fanzzy_id = VALUES(fanzzy_id),
         last_push_at = NOW(3)`,
      [userId, fixtureId, side ? 1 : 0, fanzzyId ?? null, Math.max(0, Math.round(amount ?? 0))],
    );
  }

  /* ---------------------------------------------------------- frappe */

  /**
   * Frappe la carte d'un but et la distribue aux présents.
   * Idempotent : rejouer le même but ne crée ni doublon ni seconde
   * distribution, ce qui compte parce que le worker peut relire un match.
   */
  async function mintGoal(goal) {
    const family = (await q(
      `SELECT family FROM souvenir_leagues WHERE league_id = ? AND enabled = 1 LIMIT 1`,
      [goal.leagueId],
    ))[0]?.family;

    // Compétition non couverte ou désactivée : pas de carte, et c'est voulu.
    if (!family) return { minted: false, reason: 'league_not_eligible' };

    const price = PRICE[family] ?? 60;
    const expires = new Date(Date.now() + MARKET_DAYS * 864e5);

    const res = await q(
      `INSERT IGNORE INTO souvenirs
        (fixture_id, seq, league_id, family, scorer_team, home_id, away_id,
         minute, player, score_home, score_away, kickoff_at, expires_at, price)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [goal.fixtureId, goal.seq, goal.leagueId, family, goal.teamId, goal.homeId, goal.awayId,
       goal.minute ?? null, goal.player ?? null, goal.scoreHome ?? 0, goal.scoreAway ?? 0,
       goal.kickoffAt, expires, price],
    );

    if (!res.affectedRows) return { minted: false, reason: 'already_minted' };

    const souvenirId = res.insertId;

    // Les présents : ceux qui ont poussé dans les deux minutes précédentes.
    // Laisser son téléphone ouvert ne suffit pas, il faut avoir chanté.
    const presents = await q(
      `SELECT user_id, fanzzy_id, ferveur FROM virage_presence
        WHERE fixture_id = ? AND last_push_at > (NOW(3) - INTERVAL ? SECOND)`,
      [goal.fixtureId, Math.floor(PRESENCE_WINDOW_MS / 1000)],
    );

    if (presents.length) {
      await pool.query(
        `INSERT IGNORE INTO user_souvenirs (user_id, souvenir_id, kind, fanzzy_id, ferveur)
         VALUES ?`,
        [presents.map((p) => [p.user_id, souvenirId, 'presence', p.fanzzy_id, p.ferveur])],
      );
    }
    return { minted: true, souvenirId, presents: presents.length, family, price };
  }

  /* --------------------------------------------------------- lecture */

  const CARD = `s.id, s.fixture_id, s.seq, s.league_id, s.family, s.minute, s.player,
                s.score_home, s.score_away, s.kickoff_at, s.expires_at, s.price,
                s.scorer_team, s.home_id, s.away_id,
                h.name AS home_name, h.logo AS home_logo,
                a.name AS away_name, a.logo AS away_logo,
                l.name AS league_name`;
  const JOINS = `FROM souvenirs s
                 JOIN teams h ON h.id = s.home_id
                 JOIN teams a ON a.id = s.away_id
                 LEFT JOIN leagues l ON l.id = s.league_id`;

  async function collection(userId) {
    return q(
      `SELECT ${CARD}, us.kind, us.fanzzy_id, us.ferveur, us.acquired_at
         ${JOINS}
         JOIN user_souvenirs us ON us.souvenir_id = s.id
        WHERE us.user_id = ?
        ORDER BY s.kickoff_at DESC, s.seq`,
      [userId],
    );
  }

  /** Le marché : quinze jours, et seulement ce que le joueur n'a pas déjà. */
  async function market(userId, { teamId, family, limit = 40 } = {}) {
    return q(
      `SELECT ${CARD}
         ${JOINS}
        WHERE s.expires_at > NOW(3)
          AND NOT EXISTS (SELECT 1 FROM user_souvenirs us
                           WHERE us.souvenir_id = s.id AND us.user_id = ?)
          ${teamId ? 'AND (s.home_id = ? OR s.away_id = ?)' : ''}
          ${family ? 'AND s.family = ?' : ''}
        ORDER BY s.seen_at DESC
        LIMIT ${Number(limit) || 40}`,
      teamId && family ? [userId, teamId, teamId, family]
        : teamId ? [userId, teamId, teamId]
        : family ? [userId, family]
        : [userId],
    );
  }

  /* ----------------------------------------------------------- achat */

  async function buy(userId, souvenirId) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [[s]] = await conn.query(
        `SELECT id, price, expires_at FROM souvenirs WHERE id = ? FOR UPDATE`, [souvenirId]);
      if (!s) throw Object.assign(new Error(), { code: 'souvenir.error.unknown' });
      if (new Date(s.expires_at) < new Date()) {
        throw Object.assign(new Error(), { code: 'souvenir.error.expired' });
      }

      const [[owned]] = await conn.query(
        `SELECT kind FROM user_souvenirs WHERE user_id = ? AND souvenir_id = ?`,
        [userId, souvenirId]);
      if (owned) throw Object.assign(new Error(), { code: 'souvenir.error.already_owned' });

      // Les écharpes vivent dans la collection Fanzzy. On les débite d'abord,
      // et la ligne n'est écrite que si le débit a réussi : sans transaction,
      // deux achats simultanés videraient le compte deux fois.
      const [deb] = await conn.query(
        `UPDATE user_wallet SET scarves = scarves - ? WHERE user_id = ? AND scarves >= ?`,
        [s.price, userId, s.price]);
      if (!deb.affectedRows) throw Object.assign(new Error(), { code: 'souvenir.error.not_enough_scarves' });

      await conn.query(
        `INSERT INTO user_souvenirs (user_id, souvenir_id, kind) VALUES (?, ?, 'vignette')`,
        [userId, souvenirId]);

      await conn.commit();
      return { ok: true, spent: s.price };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  router.get('/mine', requireAuth, async (req, res) => {
    res.json({ souvenirs: await collection(req.user.id) });
  });

  router.get('/market', requireAuth, async (req, res) => {
    res.json({
      souvenirs: await market(req.user.id, {
        teamId: req.query.teamId ? Number(req.query.teamId) : null,
        family: req.query.family ?? null,
      }),
      windowDays: MARKET_DAYS,
    });
  });

  router.post('/buy', requireAuth, async (req, res) => {
    try {
      res.json(await buy(req.user.id, Number(req.body?.souvenirId)));
    } catch (e) {
      res.status(400).json({ error: e.code ?? 'souvenir.error.server' });
    }
  });

  /** Ce qu'un joueur a vécu d'un match : utile pour la page du match. */
  router.get('/fixture/:id', requireAuth, async (req, res) => {
    const rows = await q(
      `SELECT ${CARD}, us.kind, us.fanzzy_id
         ${JOINS}
         LEFT JOIN user_souvenirs us ON us.souvenir_id = s.id AND us.user_id = ?
        WHERE s.fixture_id = ? ORDER BY s.seq`,
      [req.user.id, Number(req.params.id)]);
    res.json({ souvenirs: rows });
  });

  return { router, mintGoal, recordPush, collection, market, buy };
}
