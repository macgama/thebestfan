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

export function createVirage({ pool, io, requireAuth, souvenirs, fanzzy, kop = null }) {
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
      // `home_goals`, `away_goals` et `elapsed` : le fil affiche le score du
      // *vrai* match, distinct de celui de la tribune. Sans eux, un supporter
      // qui entre à la trente-quatrième minute d'un 1–0 lisait 0–0 jusqu'au
      // but suivant, ce qui est pire que de ne rien afficher.
      `SELECT f.id, f.league_id, f.home_id, f.away_id, f.kickoff_at, f.status_short,
              f.home_goals, f.away_goals, f.elapsed,
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
      await semerLeFil(room, fixtureId);
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
        // Le vrai match, tel que la base le connaît à cet instant : le fil
        // doit pouvoir afficher 1–0 à la trente-quatrième minute sans avoir
        // vu tomber le but.
        status: f.status_short, elapsed: f.elapsed,
        homeGoals: f.home_goals, awayGoals: f.away_goals,
      },
      emit: (event, payload) => io.to(`virage:${fixtureId}`).emit(event, payload),
      onPush: (p) => souvenirs.recordPush(p),
    });
  }

  /**
   * Sème le fil avec ce que la base sait déjà du match.
   *
   * `fixture_events` est rempli par le relevé du direct. Entrer dans un virage
   * ne coûte donc pas un appel à l'API : ce qui s'est passé avant l'arrivée du
   * joueur est déjà là. Sans cette lecture, un supporter qui entre à la
   * soixantième minute voit un fil vide et croit qu'il ne s'est rien passé.
   *
   * Les buts sont écartés comme partout ailleurs : ils entrent par
   * `matchEvents`, qui les retire, pour ne pas être racontés deux fois. Ceux
   * d'avant l'arrivée sont donc absents du fil — c'est assumé, le score les
   * porte, et les réintroduire ici les ferait sonner comme des buts frais au
   * moment de l'entrée.
   */
  async function semerLeFil(room, fixtureId) {
    try {
      const evs = await q(
        `SELECT type, detail, team_id, player, assist, minute, extra
           FROM fixture_events WHERE fixture_id = ? ORDER BY seq`, [fixtureId]);
      room.matchEvents(evs.map((e) => ({
        type: e.type, detail: e.detail, teamId: e.team_id,
        player: e.player, assist: e.assist, minute: e.minute, extra: e.extra,
      })));
      // La période en cours ouvre le fil : « mi-temps » explique à lui seul
      // pourquoi la corde ne bouge plus.
      room.ajouterAuFil([room.entreePeriode(room.statut)]);
    } catch (e) {
      // Un fil vide est un défaut d'agrément ; une salle qui n'ouvre pas est
      // une panne. On nomme la cause et on laisse entrer.
      console.error(`[virage ${fixtureId}] fil non semé :`, e.message);
    }
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

      /* Le bonus du KOP se mêle à ceux du Fanzzy, dans le même objet.

         Il **multiplie** au lieu d’écraser : le bonus de tempo d’un KOP et
         celui d’un Fanzzy de la voix se composent, ce qui est exactement ce
         qu’on veut — le groupe amplifie le personnage, il ne le remplace
         pas. Une simple fusion aurait fait disparaître l’un des deux selon
         l’ordre, en silence.

         Le côté décide du club : on ne profite pas du KOP d’une équipe pour
         laquelle on ne pousse pas. */
      if (kop) {
        const club = side ? room.fixture.awayId : room.fixture.homeId;
        const bonus = await kop.modsDe(u.userId, club, room.fixture.id);
        for (const [cle, v] of Object.entries(bonus)) {
          if (typeof v !== 'number') { mods[cle] = v; continue; }
          mods[cle] = (mods[cle] ?? 1) * v;
        }
      }

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
    room.realGoal({
      teamId: goal.teamId, minute: goal.minute, player: goal.player,
      // Le relevé porte le score à l'instant du but. Le recompter à partir des
      // buts vus depuis l'ouverture de la salle afficherait 1–0 à qui est
      // entré à la soixantième minute d'un 3–2.
      score: goal.score ?? null,
    });
    return true;
  }

  /* ------------------------------------------------- le fil, venu du worker */

  /**
   * Le relevé d'événements d'un match : cartons, remplacements, vidéo.
   * Rendu muet quand la salle n'existe pas — un match que personne ne regarde
   * n'a pas de fil à tenir.
   */
  function matchEvents(fixtureId, events = []) {
    const room = rooms.get(fixtureId);
    if (!room) return 0;
    return room.matchEvents(events).length;
  }

  /** Le score, la minute et la période, à chaque tour du relevé du direct. */
  function matchStatus(fixtureId, etat) {
    const room = rooms.get(fixtureId);
    if (!room) return 0;
    return room.matchStatus(etat).length;
  }

  /**
   * Les matchs dont la salle est occupée.
   *
   * C'est ce qui borne la dépense du fil : le relevé ne demande les
   * événements — un appel par match — que pour ceux-là. Une salle vide ne
   * coûte donc pas un appel de plus qu'avant le fil, et un samedi où personne
   * ne joue ne coûte rien du tout.
   */
  function sallesOccupees() {
    return [...rooms.values()].filter((r) => r.size > 0).map((r) => r.fixture.id);
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '8kb' }));

  /** Les matchs de mes clubs où je peux entrer maintenant. */
  router.get('/live', requireAuth, async (req, res) => {
    const rows = await q(
      // `home_id` et `away_id` : sans eux, l'accueil ne peut pas savoir de quel
      // côté est le club du joueur, donc pas dire si un but est le sien. Les
      // rapprocher par le nom marcherait presque, et « presque » veut dire que
      // le personnage se réjouit parfois d'un but encaissé.
      `SELECT f.id, f.status_short, f.elapsed, f.home_goals, f.away_goals, f.kickoff_at,
              f.home_id, f.away_id,
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

  return { router, realGoal, matchEvents, matchStatus, sallesOccupees,
           rooms, roomFor, stop: () => clearInterval(timer) };
}
