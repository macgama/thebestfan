import express from 'express';
import { VirageRoom, RULES } from './virage.js';
import { Cheat } from './gestures.js';
// Le club qu'on soutient dans une rencontre : la même règle qu'au duel,
// écrite une seule fois. Elle remplace un `suivis[0]` qui laissait l'ordre
// de la base décider du camp dans un derby.
import { clubSoutenu } from '../football/suivis.js';
// La journée du football, lue une fois pour tous ceux qui en ont besoin :
// le Virage ici, le choix du match support dans deck/.
import { journeeParId } from '../football/journee.js';
import { ancrerDepuisLaJournee } from '../football/ancrage.js';

/**
 * Couche réseau du Grand Virage.
 *
 * Une salle socket.io par match réel en cours. Les gestes arrivent par
 * `virage:chant`, la position de la corde repart dix fois par seconde en une
 * seule diffusion pour toute la salle — pas un message par supporter, sinon
 * mille personnes produiraient un million de messages par seconde.
 */

const MAX_CHANTS_PER_10S = 12;
/* Les cartes ont leur propre cadence. Elles coûtent du souffle et se
   rechargent : la limite n'est qu'un filet contre le client modifié, et une
   main de cinq cartes jouées d'affilée est un coup légitime. */
const MAX_CARTES_PER_10S = 8;

/* `couleurs` est facultatif : les suites de test montent le virage sans
   lui, et un club sans couleur garde celle du jeu. Une teinte manquante ne
   doit jamais empêcher d'entrer dans une tribune. */
export function createVirage({ pool, io, requireAuth, souvenirs, fanzzy,
                               kop = null, couleurs = null, decks = null,
                               /* Facultatif, comme tout ce qui est optionnel
                                  ici : sans lui, aucun plafond, et tous les
                                  Virages comptent. C'est l'état d'avant. */
                               abonnement = null,
                               /* La journée du football, telle que la page des
                                  matchs la lit — un appel pour le monde entier,
                                  mis en cache. Elle est posée après coup par
                                  server.js : le télétexte se monte après le
                                  Virage. Absente, la liste retombe sur la base,
                                  qui ne connaît que les clubs suivis. */
                               jourDuFoot = null }) {
  const rooms = new Map();          // fixtureId -> VirageRoom
  const enCours = new Map();        // créations en vol, pour n'en faire qu'une
  const roomOfUser = new Map();     // userId -> fixtureId
  const buckets = new WeakMap();    // socket -> horodatages des chants
  const seauxCartes = new WeakMap();// socket -> horodatages des cartes jouées

  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  /* -------------------------------------------------------------- salles */

  /**
   * Ce que la base sait du vrai match, pour monter la salle.
   *
   * **`luA` est calculé en SQL, et ce n'est pas un détail.** `polled_at` est
   * écrit par `NOW(3)`, donc dans le fuseau de la session MySQL, tandis que le
   * pilote est réglé sur `timezone: 'Z'`. Le relire comme une date en
   * JavaScript le plaçait deux heures dans le futur : `Date.now() - vuA`
   * devenait négatif, l'horloge de la page cessait de compter, et la minute
   * restait figée jusqu'au rechargement — dans le Virage comme sur l'écran de
   * choix. C'est mot pour mot la panne des scores en direct, au même endroit
   * et pour la même raison. La règle vit dans `teletext/index.js` : **l'époque
   * se calcule en SQL, jamais en JavaScript.**
   */
  async function fixtureInfo(fixtureId) {
    const rows = await q(
      // `home_goals`, `away_goals` et `elapsed` : le fil affiche le score du
      // *vrai* match, distinct de celui de la tribune. Sans eux, un supporter
      // qui entre à la trente-quatrième minute d'un 1–0 lisait 0–0 jusqu'au
      // but suivant, ce qui est pire que de ne rien afficher.
      `SELECT f.id, f.league_id, f.home_id, f.away_id, f.kickoff_at, f.status_short,
              f.home_goals, f.away_goals, f.elapsed, f.elapsed_extra,
              UNIX_TIMESTAMP(f.polled_at) * 1000 AS luA,
              h.name AS home_name, h.logo AS home_logo,
              h.color1 AS home_c1, h.color2 AS home_c2,
              a.name AS away_name, a.logo AS away_logo,
              a.color1 AS away_c1, a.color2 AS away_c2,
              l.name AS league_name
         FROM fixtures f
         JOIN teams h ON h.id = f.home_id
         JOIN teams a ON a.id = f.away_id
         LEFT JOIN leagues l ON l.id = f.league_id
        WHERE f.id = ?`, [fixtureId]);
    return rows[0] ?? null;
  }

  /**
   * Le match que la base ne connaît pas encore, posé depuis la journée.
   *
   * ## La panne
   *
   * La liste « ailleurs en direct » vient de `journeeParId` — le monde entier,
   * en un appel. La table `fixtures`, elle, n'est remplie par le collecteur que
   * pour les clubs suivis et les salles occupées. L'écran proposait donc des
   * rencontres dont le serveur n'avait **jamais entendu parler** : on touchait
   * « Martina Franca », `fixtureInfo` ne trouvait rien, `virage:join` répondait
   * `no_fixture`, et la page affichait « Refusé par le serveur » tout en bas,
   * hors du champ de vision. Vu du joueur : rien ne se passe.
   *
   * C'est la troisième fois que cette même cause frappe — l'écran des scores,
   * la liste du duel, et maintenant l'entrée au Virage. Le motif est toujours
   * le même : **ce qui s'affiche vient de la journée, ce qui s'ouvre vient de
   * la base**, et les deux ne connaissent pas les mêmes matchs.
   *
   * ## Pourquoi on écrit, au lieu de monter la salle en mémoire
   *
   * Parce que tout ce qui suit l'entrée retombe en base : `virage_presence`
   * porte un `fixture_id`, les classements par compétition joignent `fixtures`,
   * et le collecteur ne suit que des matchs qu'il connaît. Une salle sans ligne
   * aurait marché à l'écran et perdu tout ce qui en sort.
   *
   * La saison vient de la table des compétitions quand elle y est ; sinon de
   * l'année du coup d'envoi. C'est une approximation assumée et bornée : elle
   * ne sert qu'à ranger le match dans un classement, et la ligne est corrigée
   * dès le premier passage du collecteur, qui, lui, tient la saison de l'API.
   */
  /* Le corps est parti dans `football/ancrage.js` : le duel en avait besoin
     **aussi**, et ne l'avait pas — d'où des duels enregistrés sur un match
     qu'aucune ligne ne nommait, affichés « match inconnu » pour toujours. Une
     écriture, deux appelants. */
  const poserDepuisLaJournee = (fixtureId) =>
    ancrerDepuisLaJournee({ q, jourDuFoot }, fixtureId);

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
      /* La base d’abord, la journée ensuite. Voir `poserDepuisLaJournee` :
         l'écran propose le monde entier, la table ne connaît que les clubs
         suivis, et il ne faut pas que la porte se referme là-dessus. */
      let f = await fixtureInfo(fixtureId);
      if (!f && await poserDepuisLaJournee(fixtureId)) f = await fixtureInfo(fixtureId);
      if (!f) return null;
      // Les couleurs des deux clubs, si on ne les a pas encore. La salle
      // s'ouvre sans les attendre : elles seront là au prochain match.
      couleurs?.assurerPlusTard([f.home_id, f.away_id]);
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
        /* Les couleurs du club, tirées de son blason. C'est ce qui permet de
           teindre « GOAL ! » aux couleurs de l'équipe. Vides tant qu'elles
           n'ont pas été extraites : la page garde sa couleur par défaut. */
        homeColors: [f.home_c1, f.home_c2].filter(Boolean),
        awayColors: [f.away_c1, f.away_c2].filter(Boolean),
        league: f.league_name, kickoffAt: f.kickoff_at,
        // Le vrai match, tel que la base le connaît à cet instant : le fil
        // doit pouvoir afficher 1–0 à la trente-quatrième minute sans avoir
        // vu tomber le but.
        status: f.status_short, elapsed: f.elapsed, elapsedExtra: f.elapsed_extra,
        // Quand le serveur a vu ce match pour la dernière fois. La page en a
        // besoin pour ne pas faire courir une horloge sur une donnée figée.
        // `Number` : mysql2 rend ce calcul en chaîne, et l'horloge ferait
        // alors sa soustraction sur du texte.
        vuA: f.luA == null ? null : Number(f.luA),
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

    socket.on('virage:join', async ({ fixtureId, camp } = {}) => {
      const u = me();
      if (!u) return socket.emit('virage:error', { code: 'auth.error.unauthenticated' });

      const room = await roomFor(Number(fixtureId));
      if (!room) return socket.emit('virage:error', { code: 'ferveur.error.no_fixture' });

      /* Le camp.
       *
       * **Chez soi, il ne se choisit pas** : il découle des clubs qu'on suit,
       * et c'est ce qui empêche d'aller pousser contre son propre club.
       *
       * **Ailleurs, il se choisit.** Le virage est ouvert à tous les matchs en
       * direct : on entre où l'on veut et on prend un camp. Le refus d'avant
       * — « aucun de tes clubs ne joue ce match » — fermait les neuf dixièmes
       * des rencontres d'un soir de Coupe d'Europe à quelqu'un qui voulait
       * juste pousser quelque part.
       *
       * Ce qu'on gagne n'est pas le même : voir `RULES.ferveurNeutre`. La
       * ferveur d'un neutre compte moitié — on peut venir pousser partout, on
       * ne se bâtit une réputation que chez soi. */
      const { teamId, neutre } = await clubSoutenu(q, u.userId,
        room.fixture.homeId, room.fixture.awayId);
      const side = neutre
        ? (camp === 'exterieur' || camp === 1 ? 1 : 0)
        : (teamId === room.fixture.awayId ? 1 : 0);

      const hero = await fanzzy.activeFanzzy(u.userId);
      const mods = hero ? { id: hero.id, ...hero.mods } : {};
      /* Le personnage, séparément du barème : c'est lui qu'on voit pousser
         dans la tribune, et il est montré **à l'âge atteint** — comme partout
         ailleurs dans le jeu. Une absence n'empêche rien : le virage se joue
         très bien sans Fanzzy équipé, la scène reste simplement vide. */
      const perso = await fanzzy.personnageActif?.(u.userId) ?? null;

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
      /* Les cartes d'action du deck, s'il en a un.
       *
       * `decks` est facultatif, et volontairement : le Virage s'est joué sans
       * cartes jusqu'ici et doit continuer de s'ouvrir pour quelqu'un qui n'a
       * jamais construit de deck. Une main vide n'est pas une erreur, c'est
       * simplement un supporter qui n'a que sa voix.
       *
       * Le tri — quelles cartes entrent au Virage — n'est pas fait ici : il
       * appartient à `dansLeVirage`, et la salle l'applique elle-même. Le
       * faire des deux côtés donnerait deux réponses le jour où la règle
       * bouge. */
      let actions = [];
      try {
        const l = decks ? await decks.loadout(u.userId) : null;
        actions = (l?.actions ?? []).map((a) => a.id);
      } catch (e) {
        // Un deck illisible ne doit pas fermer la porte du virage.
        console.warn('[virage] deck illisible pour', u.userId, '·', e.message);
      }

      /* **Ce Virage comptera-t-il au classement ?**

         La question se pose ici, une seule fois, à l'entrée : au-delà de
         `abo.virages_classes_jour`, un joueur sans abonnement entre quand
         même et joue tout le match — il pousse, il chante, les
         cartes-souvenirs tombent — mais sa ferveur ne rejoint pas le
         classement. **Aucune porte ne se ferme**, c'est le compteur qui
         s'arrête.

         La salle ne recalcule jamais : rejoindre à nouveau reprend la
         décision déjà posée sur le membre, sinon un match commencé compté
         cesserait de l'être parce qu'un tunnel a coupé le réseau.

         Une panne de ce compte **ne ferme rien** : on compte au classement,
         comme avant. Un plafond qui se déclenche sur une erreur de base
         punirait sans raison et ne se verrait nulle part. */
      let classe = true;
      if (abonnement && !room.members.has(u.userId)) {
        try {
          const reste = await abonnement.viragesClassesRestants(u.userId);
          classe = reste === null || reste > 0;
        } catch (e) {
          console.warn('[virage] plafond illisible pour', u.userId, '·', e.message);
        }
      }

      socket.emit('virage:state',
        room.join(u.userId, { side, name: u.name, mods, neutre, perso, actions,
          classe }));
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

    /**
     * Une carte d'action, jouée depuis le Virage.
     *
     * Deux choses partent, et pas au même endroit. Le **résultat** revient à
     * celui qui a joué : sa main, son souffle, ses recharges. Les
     * **événements** vont à toute la salle, parce que c'est là que se joue
     * l'intérêt de la chose — un Appel du capo qui n'est vu de personne
     * n'appelle personne.
     */
    socket.on('virage:jouer', async ({ cardId } = {}) => {
      const u = me();
      if (!u) return;
      const fixtureId = roomOfUser.get(u.userId);
      const room = fixtureId ? rooms.get(fixtureId) : null;
      if (!room) return socket.emit('virage:error', { code: 'ferveur.error.not_in_virage' });

      /* Sa propre cadence, séparée de celle des chants. Une carte coûte du
         souffle et a sa recharge : la limite n'est qu'un filet contre le
         client modifié, elle n'a pas à être serrée. */
      const now = Date.now();
      const seau = (seauxCartes.get(socket) ?? []).filter((t) => now - t < 10_000);
      if (seau.length >= MAX_CARTES_PER_10S) {
        return socket.emit('virage:error', { code: 'ferveur.error.rate_limited' });
      }
      seau.push(now);
      seauxCartes.set(socket, seau);

      try {
        const evenements = room.jouer(u.userId, cardId);
        io.to(`virage:${fixtureId}`).emit('virage:events', { evenements });
        socket.emit('virage:vous', room.snapshotFor(u.userId).you);
      } catch (e) {
        if (e instanceof Cheat) socket.emit('virage:error', { code: e.code });
        else {
          console.error('[virage] carte', e);
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

  /**
   * Les matchs où je peux entrer maintenant : les miens, et ceux d'ailleurs.
   *
   * ## Deux sources, et il en fallait deux
   *
   * La table `fixtures` ne connaît que ce que le guetteur relève, et le
   * guetteur ne relève que les clubs suivis et les salles occupées — c'est
   * ainsi qu'il tient dans le quota. Pour tout le reste, sa ligne est celle du
   * jour où quelqu'un s'y est intéressé, ou n'existe pas du tout.
   *
   * La liste « ailleurs en direct » sortait pourtant de cette table. Elle
   * affichait donc un 1–2 à la 57e sur une rencontre qui en était à 3–2 à la
   * 83e, et ignorait purement et simplement les matchs dont aucun club n'est
   * suivi par personne. La page des matchs, au même instant, avait juste : elle
   * lit la **journée entière**, un seul appel pour le monde entier, mis en
   * cache quarante-cinq secondes.
   *
   * C'est donc cette journée-là qui fait foi ici aussi. Elle ne coûte rien de
   * plus — le cache est partagé avec la page des matchs — et elle a l'autre
   * qualité qu'on cherchait : elle est **complète**.
   *
   * La base garde deux choses qu'elle seule sait : les couleurs des clubs, et
   * les matchs d'un club suivi dans une compétition que le jeu n'a pas activée.
   * On garde donc les deux, et la journée l'emporte quand les deux parlent du
   * même match.
   */
  router.get('/live', requireAuth, async (req, res) => {
    const rows = await q(
      // `home_id` et `away_id` : sans eux, l'accueil ne peut pas savoir de quel
      // côté est le club du joueur, donc pas dire si un but est le sien. Les
      // rapprocher par le nom marcherait presque, et « presque » veut dire que
      // le personnage se réjouit parfois d'un but encaissé.
      // `luA` en SQL, jamais `polled_at` relu comme une date : voir la note
      // dans `fixtureInfo`, quelques dizaines de lignes plus haut.
      `SELECT f.id, f.status_short, f.elapsed, f.elapsed_extra,
              UNIX_TIMESTAMP(f.polled_at) * 1000 AS luA,
              f.home_goals, f.away_goals, f.kickoff_at,
              f.home_id, f.away_id,
              h.name AS home_name, h.logo AS home_logo,
              a.name AS away_name, a.logo AS away_logo, l.name AS league_name
         FROM fixtures f
         JOIN teams h ON h.id = f.home_id
         JOIN teams a ON a.id = f.away_id
         LEFT JOIN leagues l ON l.id = f.league_id
        WHERE (f.status_short IN ('1H','HT','2H','ET','BT','P','LIVE','INT')
            OR f.home_id IN (SELECT team_id FROM user_follows WHERE user_id = ?)
            OR f.away_id IN (SELECT team_id FROM user_follows WHERE user_id = ?))
          AND f.kickoff_at BETWEEN (UTC_TIMESTAMP() - INTERVAL 3 HOUR)
                               AND (UTC_TIMESTAMP() + INTERVAL 2 HOUR)
        ORDER BY f.kickoff_at`,
      [req.user.id, req.user.id]);

    /* Les clubs suivis, pour distinguer « chez soi » d'« ailleurs ».
       La page en a besoin avant l'entrée : chez soi le camp est décidé, et
       ailleurs il faut le demander. Le lui faire deviner en comparant des
       noms d'équipes serait la même faute que partout ailleurs. */
    const suivis = new Set((await q(
      `SELECT team_id FROM user_follows WHERE user_id = ?`, [req.user.id]))
      .map((r) => r.team_id));

    const parId = new Map();
    for (const f of rows) parId.set(Number(f.id), { ...f });

    /* La journée se superpose à la base. Une panne de ce côté ne vide pas
       l'écran : `journeeParId` rend alors une liste vide et l'on retombe sur
       la base — incomplète, mais jamais rien.

       On ne garde que ce qui se joue : le Virage est un tir à la corde pendant
       un vrai match, et une rencontre terminée n'a pas de tribune. */
    for (const [id, m] of await journeeParId(jourDuFoot)) {
      if (!m.live) continue;
      parId.set(id, {
        ...parId.get(id),
        id,
        status_short: m.status, elapsed: m.elapsed, elapsed_extra: m.extra,
        luA: m.luA,
        home_goals: m.home.goals, away_goals: m.away.goals,
        kickoff_at: m.date,
        home_id: m.home.id, away_id: m.away.id,
        home_name: m.home.name, home_logo: m.home.logo,
        away_name: m.away.name, away_logo: m.away.logo,
        league_name: m.leagueName,
        // Le pays de la compétition : la page en fait un nom dans la langue du
        // lecteur, et un terme de recherche. Voir public/pays.js.
        pays: m.country, drapeau: m.drapeau,
        // Le palier de la compétition : il décide de l'ordre, plus bas.
        tier: m.tier,
      });
    }

    /* `mien` : un de mes clubs joue. Le camp découle alors du club suivi et
       la ferveur compte plein ; ailleurs, on choisit son camp et elle compte
       moitié. Écrit une fois, lu par le tri et par la réponse. */
    const estMien = (m) => suivis.has(m.home_id) || suivis.has(m.away_id);

    /* L'ordre, maintenant que la liste couvre le monde entier.
       Un samedi soir, c'est trente rencontres : triées par heure de coup
       d'envoi, une finale de Ligue des champions se retrouvait derrière un
       championnat U19. Les miennes d'abord, puis les grandes compétitions,
       puis l'heure. Le palier vient de `souvenir_leagues` ; une ligne que
       seule la base connaît prend le plus bas, faute de mieux. */
    const matchs = [...parId.values()].sort((a, b) =>
      (estMien(b) - estMien(a)) || ((a.tier ?? 3) - (b.tier ?? 3))
      || (new Date(a.kickoff_at) - new Date(b.kickoff_at)));

    /* Les couleurs, en une requête pour toute la liste. Elles ne pouvaient plus
       venir de la jointure du dessus : la moitié des matchs n'en sort plus. */
    const ids = [...new Set(matchs.flatMap((m) => [m.home_id, m.away_id]).filter(Boolean))];
    const teintes = new Map();
    if (ids.length) {
      for (const t of await q(
        `SELECT id, color1, color2 FROM teams WHERE id IN (${ids.map(() => '?').join(',')})`,
        ids)) {
        teintes.set(t.id, [t.color1, t.color2].filter(Boolean));
      }
    }

    /* Les couleurs manquantes partent se chercher **à côté** de la réponse.
       La liste s'affiche avec ce qu'on a ; les blasons lus maintenant
       teindront l'écran au prochain chargement. Attendre un téléchargement
       d'image pour montrer les matchs du soir serait payer une panne pour un
       dégradé. */
    couleurs?.assurerPlusTard(ids);

    res.json({
      matchs: matchs.map((f) => ({
        ...f,
        // L'écran de choix fait courir la minute avec, comme la page des
        // matchs : sans lui, il affichait la minute de son chargement pendant
        // toute la durée de la rencontre.
        luA: f.luA == null ? null : Number(f.luA),
        // Une à deux couleurs, jamais de tableau vide déguisé en couleur : la
        // page teste la longueur et retombe sur la sienne.
        homeColors: teintes.get(f.home_id) ?? [],
        awayColors: teintes.get(f.away_id) ?? [],
        crowd: rooms.get(Number(f.id))?.crowd() ?? [0, 0],
        mien: estMien(f),
        open: ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(f.status_short)
          || new Date(f.kickoff_at) - Date.now() < 30 * 60_000,
      })),
      ferveurNeutre: RULES.ferveurNeutre,
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
