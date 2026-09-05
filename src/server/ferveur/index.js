import express from 'express';
import { VirageRoom, RULES } from './virage.js';
import { Cheat } from './gestures.js';

/**
 * Couche réseau du Grand Virage.
 *
 * Une salle socket.io par match réel en cours. Les gestes arrivent par
 * `virage:chant`, la position de la corde repart dix fois par seconde en une
 * seule diffusion pour toute la salle — pas un message par supporter, sinon
 * mille personnes produiraient un million de messages par seconde.
 */

const MAX_CHANTS_PER_10S = 12;

export function createVirage({ pool, io, requireAuth, souvenirs, fanzzy }) {
  const rooms = new Map();          // fixtureId -> VirageRoom
  const enCours = new Map();        // créations en vol, pour n'en faire qu'une
  const roomOfUser = new Map();     // userId -> fixtureId
  const buckets = new WeakMap();    // socket -> horodatages des chants

  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* -------------------------------------------------------------- salles */

  async function fixtureInfo(fixtureId) {
    const rows = await q(
      `SELECT f.id, f.league_id, f.home_id, f.away_id, f.kickoff_at, f.status_short,
              h.name AS home_name, h.logo AS home_logo,
              a.name AS away_name, a.logo AS away_logo,
              l.name AS league_name
         FROM fixtures f
         JOIN teams h ON h.id = f.home_id
         JOIN teams a ON a.id = f.away_id
         LEFT JOIN leagues l ON l.id = f.league_id
        WHERE f.id = ?`, [fixtureId]);
    return rows[0] ?? null;
  }

  /**
   * Ouvre la salle d'un match, une seule fois.
   *
   * La création demande un aller-retour en base. Sans mémoriser la promesse en
   * vol, trois supporters qui entrent à la même seconde — c'est-à-dire au coup
   * d'envoi, exactement quand ça arrive — créeraient trois salles distinctes,
   * dont deux seraient aussitôt perdues avec leurs membres.
   */
  async function roomFor(fixtureId) {
    if (rooms.has(fixtureId)) return rooms.get(fixtureId);
    if (enCours.has(fixtureId)) return enCours.get(fixtureId);

    const p = (async () => {
      const f = await fixtureInfo(fixtureId);
      if (!f) return null;
      const room = buildRoom(f, fixtureId);
      rooms.set(fixtureId, room);
      return room;
    })().finally(() => enCours.delete(fixtureId));

    enCours.set(fixtureId, p);
    return p;
  }

  function buildRoom(f, fixtureId) {
    return new VirageRoom({
      fixture: {
        id: f.id, leagueId: f.league_id,
        homeId: f.home_id, awayId: f.away_id,
        homeName: f.home_name, homeLogo: f.home_logo,
        awayName: f.away_name, awayLogo: f.away_logo,
        league: f.league_name, kickoffAt: f.kickoff_at,
      },
      emit: (event, payload) => io.to(`virage:${fixtureId}`).emit(event, payload),
      onPush: (p) => souvenirs.recordPush(p),
    });
  }

  /** Une seule horloge pour toutes les salles : dix battements par seconde. */
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
      try {
        room.tick(now);
        // Salle vide depuis un moment : on la libère.
        if (room.size === 0 && now - room.last > 60_000) rooms.delete(id);
      } catch (e) {
        console.error(`[virage ${id}]`, e.message);
      }
    }
  }, RULES.tickMs);
  timer.unref?.();

  /* ------------------------------------------------------------- socket */

  io.on('connection', (socket) => {
    const me = () => socket.data?.user ?? null;

    socket.on('virage:join', async ({ fixtureId } = {}) => {
      const u = me();
      if (!u) return socket.emit('virage:error', { code: 'auth.error.unauthenticated' });

      const room = await roomFor(Number(fixtureId));
      if (!room) return socket.emit('virage:error', { code: 'ferveur.error.no_fixture' });

      // Le camp n'est pas choisi : il découle des clubs que le joueur suit.
      const suivis = await q(
        `SELECT team_id FROM user_follows WHERE user_id = ? AND team_id IN (?, ?)`,
        [u.userId, room.fixture.homeId, room.fixture.awayId]);
      if (!suivis.length) {
        return socket.emit('virage:error', { code: 'ferveur.error.not_your_match' });
      }
      const side = suivis[0].team_id === room.fixture.awayId ? 1 : 0;

      const hero = await fanzzy.activeFanzzy(u.userId);
      const mods = hero ? { id: hero.id, ...hero.mods } : {};

      socket.join(`virage:${room.fixture.id}`);
      roomOfUser.set(u.userId, room.fixture.id);
      if (process.env.VIRAGE_DEBUG) console.log('[virage] join', u.userId, '->', room.fixture.id);
      socket.emit('virage:state', room.join(u.userId, { side, name: u.name, mods }));
      io.to(`virage:${room.fixture.id}`).emit('virage:crowd', { crowd: room.crowd() });
    });

    socket.on('virage:chant', async ({ cardId, taps } = {}) => {
      const u = me();
      if (!u) return;
      const fixtureId = roomOfUser.get(u.userId);
      const room = fixtureId ? rooms.get(fixtureId) : null;
      if (!room) {
        if (process.env.VIRAGE_DEBUG) {
          console.log('[virage] chant refusé pour', u.userId, '· salle', fixtureId,
            '· connus', [...roomOfUser.keys()]);
        }
        return socket.emit('virage:error', { code: 'ferveur.error.not_in_virage' });
      }

      // Un chant dure au moins trois secondes : douze par tranche de dix
      // secondes est déjà généreux, et ferme la porte au client modifié.
      const now = Date.now();
      const bucket = (buckets.get(socket) ?? []).filter((t) => now - t < 10_000);
      if (bucket.length >= MAX_CHANTS_PER_10S) {
        return socket.emit('virage:error', { code: 'ferveur.error.rate_limited' });
      }
      bucket.push(now);
      buckets.set(socket, bucket);

      try {
        socket.emit('virage:result', room.chant(u.userId, { cardId, taps }));
      } catch (e) {
        if (e instanceof Cheat) socket.emit('virage:error', { code: e.code });
        else {
          console.error('[virage] chant', e);
          socket.emit('virage:error', { code: 'ferveur.error.server' });
        }
      }
    });

    socket.on('virage:leave', () => {
      const u = me();
      if (!u) return;
      const fixtureId = roomOfUser.get(u.userId);
      const room = fixtureId ? rooms.get(fixtureId) : null;
      if (!room) return;
      room.leave(u.userId);
      roomOfUser.delete(u.userId);
      socket.leave(`virage:${fixtureId}`);
    });

    socket.on('disconnect', () => {
      const u = me();
      if (!u) return;
      const fixtureId = roomOfUser.get(u.userId);
      rooms.get(fixtureId)?.leave(u.userId);
      roomOfUser.delete(u.userId);
    });
  });

  /* ---------------------------------------------- but réel, venu du worker */

  /**
   * Appelé par le worker API-Football. Le but secoue la corde, ouvre la minute
   * double, et la frappe des cartes-souvenirs suit dans la foulée : les
   * présents sont exactement ceux qui viennent de chanter.
   */
  function realGoal(goal) {
    const room = rooms.get(goal.fixtureId);
    if (!room) return false;
    room.realGoal({ teamId: goal.teamId, minute: goal.minute, player: goal.player });
    return true;
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  /** Les matchs de mes clubs où je peux entrer maintenant. */
  router.get('/live', requireAuth, async (req, res) => {
    const rows = await q(
      `SELECT f.id, f.status_short, f.elapsed, f.home_goals, f.away_goals, f.kickoff_at,
              h.name AS home_name, h.logo AS home_logo,
              a.name AS away_name, a.logo AS away_logo, l.name AS league_name
         FROM fixtures f
         JOIN teams h ON h.id = f.home_id
         JOIN teams a ON a.id = f.away_id
         LEFT JOIN leagues l ON l.id = f.league_id
        WHERE (f.home_id IN (SELECT team_id FROM user_follows WHERE user_id = ?)
            OR f.away_id IN (SELECT team_id FROM user_follows WHERE user_id = ?))
          AND f.kickoff_at BETWEEN (UTC_TIMESTAMP() - INTERVAL 3 HOUR)
                               AND (UTC_TIMESTAMP() + INTERVAL 2 HOUR)
        ORDER BY f.kickoff_at`,
      [req.user.id, req.user.id]);

    res.json({
      matchs: rows.map((f) => ({
        ...f,
        crowd: rooms.get(f.id)?.crowd() ?? [0, 0],
        open: ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(f.status_short)
          || new Date(f.kickoff_at) - Date.now() < 30 * 60_000,
      })),
    });
  });

  router.get('/stats', requireAuth, (_req, res) => {
    res.json({
      rooms: [...rooms.values()].map((r) => ({
        fixtureId: r.fixture.id, crowd: r.crowd(), rope: Math.round(r.rope), goals: r.goals,
      })),
    });
  });

  return { router, realGoal, rooms, roomFor, stop: () => clearInterval(timer) };
}
