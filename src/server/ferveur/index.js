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
// La ventilation de ce qu'un joueur porte, partagée avec le duel : les deux
// arènes composent les mêmes modificateurs, elles doivent les nommer pareil.
import { apportsDe } from '../../shared/apports.js';

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
  /* **Une socket, pas un joueur.**

     La salle d'un supporter était rangée par joueur (`userId -> fixtureId`),
     et la déconnexion de n'importe laquelle de ses sockets la vidait : fermer
     un onglet KOP, Équipes ou duel — qui ouvrent tous une socket sur le même
     espace de noms — ou perdre l'ancienne socket d'un téléphone qui change de
     réseau après que la neuve est déjà entrée, et chaque chant de l'onglet
     resté ouvert recevait `not_in_virage` jusqu'au rechargement. Avec deux
     onglets sur deux matchs, le membre restait même pour toujours dans la
     première salle, qui continuait de payer son relevé à l'API.

     On tient donc ce que **chaque socket** a rejoint, et pour chaque salle les
     sockets de chaque joueur. On ne quitte la salle qu'à la dernière ; une
     socket qui n'a jamais rejoint ne fait rien en partant. */
  const salleDeSocket = new WeakMap(); // socket -> { fixtureId, userId }
  const socketsDe = new Map();      // fixtureId -> Map(userId -> Set de sockets)
  /* La dernière demande de chaque socket, entrée ou sortie, numérotée. Une
     entrée lit la base pendant de longues millisecondes : si la page est
     ressortie entre-temps, ou repartie vers un autre match, l'entrée qui
     arrive n'est plus celle qu'on attend, et elle ne doit pas s'asseoir. */
  const demandes = new WeakMap();   // socket -> numéro de la dernière demande
  const demander = (socket) => {
    const n = (demandes.get(socket) ?? 0) + 1;
    demandes.set(socket, n);
    return n;
  };
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
      /* La main d'un joueur, à **toutes ses sockets** dans cette salle : la
         carte tirée au battement doit apparaître dans chacun de ses onglets,
         pas seulement dans celui qui a joué. La table est celle qu'`attacher`
         remplit, rangée sous l'identifiant du match qu'elle tient — `f.id`. */
      emitVous: (userId, you) => aSesOnglets(f.id, userId, you),
      /* **Le `catch` n'est pas de la politesse.**

         La salle appelle ce crochet à chaque chant et ne l'attend pas : c'est
         une écriture en base posée à côté du jeu, pour que la corde ne ralentisse
         pas au rythme de MySQL. Mais une promesse lancée sans `catch` qui part
         en erreur est une `unhandledRejection`, et Node ferme le processus
         dessus — une table pleine, une connexion coupée, un verrou, et c'est
         **tout le site** qui tombe pendant qu'un joueur chante.

         La présence sert aux cartes-souvenirs et au classement : la perdre coûte
         une ligne de ferveur à un supporter. La perdre en sortant tout le monde
         du stade coûte le reste. */
      onPush: (p) => souvenirs.recordPush(p)
        .catch((e) => console.error(`[virage ${fixtureId}] présence non écrite :`, e.message)),
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

  /* ------------------------------------------- ce qu'un statut dit d'un match

     Lu par la libération, juste en dessous, et par le relevé, plus bas. */

  /* Les statuts d'un match qui ne bougera plus : les trois fins, l'annulation,
     le tapis vert et le forfait. */
  const TERMINES = new Set(['FT', 'AET', 'PEN', 'CANC', 'AWD', 'WO']);
  /* Le report et l'arrêt : le match ne bouge plus aujourd'hui, mais l'API peut
     le reprogrammer sous le même numéro, qui repasse alors « à venir ». */
  const REPORTES = new Set(['PST', 'ABD']);
  /* En attente d'un coup d'envoi ou d'une reprise. `TBD` est un `NS` dont
     l'heure est provisoire ; `SUSP`, un match interrompu qui reprendra
     peut-être, peut-être un autre jour. */
  const EN_ATTENTE = new Set(['NS', 'TBD', 'SUSP']);
  /* La demi-heure d'avant : la règle de `open`, plus bas. */
  const AVANT_COUP_D_ENVOI_MS = 30 * 60_000;
  /* Quatre heures d'après : la borne de `dueToStartIds`, celle qui arrête de
     guetter le coup d'envoi d'un club suivi. */
  const APRES_COUP_D_ENVOI_MS = 4 * 3600_000;
  /* Au-delà, un coup d'œil par demi-heure : de quoi ne jamais figer un match
     joué plus tard que prévu, pour quarante-huit appels par jour et par salle
     occupée au pire, au lieu de mille quatre cent quarante. */
  const RELEVE_LENT_MS = 30 * 60_000;
  /* Un match « en jeu » dont rien n'a bougé depuis une heure — ni statut, ni
     minute, ni temps additionnel, ni score — est un match que l'API a laissé
     en jeu : un vrai match change de minute à chaque tour, et la mi-temps dure
     un quart d'heure. Il passe au coup d'œil du quart d'heure. Voir
     `aRelever`. */
  const IMMOBILE_MS = 60 * 60_000;
  const COUP_D_OEIL_IMMOBILE_MS = 15 * 60_000;

  /* --------------------------------------------------------- la libération */

  /**
   * Une salle se libère quand plus personne n'y est — ni membre, ni socket —
   * et que ce qu'elle garde ne peut plus servir.
   *
   * **Cette ligne n'avait jamais rien libéré.** Elle lisait `room.last`, que
   * `tick()` pose à chaque battement juste avant elle : l'écart valait zéro,
   * toujours, et chaque match où quelqu'un était entré depuis le démarrage
   * gardait sa salle en mémoire jusqu'au redémarrage — comptée par le bilan de
   * santé et par l'administration comme une salle en vie. Elle lit maintenant
   * `occupeeA`, que le battement n'avance que s'il y a quelqu'un.
   *
   * **Mais une salle garde ce que la base n'a pas** : le score de la tribune,
   * la corde, le fil, et les partis — le souffle, la main, les recharges de
   * qui est sorti. La libérer une minute après le dernier départ rendait tout
   * ça au premier téléphone verrouillé : seul en tribune, sorti à la
   * mi-temps, on revenait à 40 de souffle, une main neuve et un 0–0 de
   * tribune, quand la salle d'avant attendait au 3–1. Repartir à neuf
   * redevenait gratuit, au prix d'une minute. Le délai suit donc le match :
   *
   *   - **fini ou reporté**, une minute : il ne bougera plus, et qui revient
   *     voir le bilan trouve une salle ressemée depuis la base ;
   *   - **sinon, tant qu'il peut encore se jouer** — de la demi-heure d'avant
   *     le coup d'envoi à trois heures après, prolongation et tirs au but
   *     compris —, la salle reste, vide ou non ; hors de cette fenêtre, une
   *     demi-heure de vide.
   *
   * La fenêtre a une fin, et elle compte : une salle vide n'est plus relevée,
   * et n'apprend donc jamais le coup de sifflet d'un match qu'aucun club suivi
   * ne joue. Attendre son « FT » serait attendre pour toujours — la fuite
   * d'avant. Une salle vide ne coûte aucun appel : `sallesOccupees` ne rend
   * que celles où quelqu'un est assis.
   */
  const LIBERATION_FINI_MS = 60_000;
  const LIBERATION_MS = 30 * 60_000;
  const MATCH_JOUABLE_MS = 3 * 3600_000;
  function libre(id, room, now) {
    if (room.size > 0 || socketsDe.has(id)) return false;
    const vide = now - room.occupeeA;
    if (TERMINES.has(room.statut) || REPORTES.has(room.statut)) return vide > LIBERATION_FINI_MS;
    if (vide <= LIBERATION_MS) return false;
    const coupDEnvoi = new Date(room.fixture.kickoffAt).getTime();
    return !(Number.isFinite(coupDEnvoi) && now >= coupDEnvoi - AVANT_COUP_D_ENVOI_MS
      && now <= coupDEnvoi + MATCH_JOUABLE_MS);
  }

  /** Une seule horloge pour toutes les salles : dix battements par seconde. */
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, room] of rooms) {
      try {
        room.tick(now);
        if (libre(id, room, now)) rooms.delete(id);
      } catch (e) {
        console.error(`[virage ${id}]`, e.message);
      }
    }
  }, RULES.tickMs);
  timer.unref?.();

  /* -------------------------------------------- les sockets d'une salle */

  /** Range une socket dans la salle qu'elle vient de rejoindre. */
  function attacher(socket, fixtureId, userId) {
    salleDeSocket.set(socket, { fixtureId, userId });
    let parJoueur = socketsDe.get(fixtureId);
    if (!parJoueur) socketsDe.set(fixtureId, (parJoueur = new Map()));
    let siennes = parJoueur.get(userId);
    if (!siennes) parJoueur.set(userId, (siennes = new Set()));
    siennes.add(socket);
    socket.join(`virage:${fixtureId}`);
  }

  /**
   * Retire une socket de sa salle — à la déconnexion, au `virage:leave`, ou
   * quand elle part pour un autre match.
   *
   * Une socket qui n'a jamais rejoint ne fait rien : c'est ce qui protège le
   * Virage ouvert à côté d'un onglet KOP qu'on ferme. Et le joueur ne quitte
   * la salle qu'avec sa **dernière** socket : l'ancienne socket d'un téléphone
   * qui a changé de réseau meurt souvent après que la neuve est entrée, et la
   * laisser vider la salle coupait celle qui vit.
   */
  function detacher(socket) {
    const prise = salleDeSocket.get(socket);
    if (!prise) return;
    salleDeSocket.delete(socket);
    const { fixtureId, userId } = prise;
    socket.leave(`virage:${fixtureId}`);
    const parJoueur = socketsDe.get(fixtureId);
    const siennes = parJoueur?.get(userId);
    siennes?.delete(socket);
    if (siennes?.size) return;
    parJoueur?.delete(userId);
    if (parJoueur && !parJoueur.size) socketsDe.delete(fixtureId);
    rooms.get(fixtureId)?.leave(userId);
  }

  /**
   * La main d'un joueur — `virage:vous` —, à chacune de ses sockets dans la
   * salle de ce match.
   *
   * Le seul chemin par lequel elle part : au tirage (le battement de la
   * salle) comme après une carte jouée. Un second onglet n'a pas d'autre
   * moyen de l'apprendre, et une main qu'il garde périmée ne se répare pas
   * seule — ses cartes répondent « plus dans ta main », les neuves restent
   * invisibles.
   */
  function aSesOnglets(fixtureId, userId, you) {
    for (const s of socketsDe.get(fixtureId)?.get(userId) ?? []) s.emit('virage:vous', you);
  }

  /* Les refus d'une carte qui disent que la page s'est trompée sur la main,
     les recharges ou le souffle — pas sur le match ni sur la carte. */
  const REFUS_DE_MAIN = new Set(['ferveur.error.card_not_in_hand',
    'ferveur.error.card_on_cooldown', 'ferveur.error.not_enough_breath']);

  /** La salle que cette socket a rejointe, s'il y en a une. */
  const salleDe = (socket) => {
    const prise = salleDeSocket.get(socket);
    return prise ? { fixtureId: prise.fixtureId, room: rooms.get(prise.fixtureId) } : {};
  };

  /**
   * Les Virages classés qu'un joueur tient sans les avoir encore consommés :
   * présent dans une autre salle au rang « classé », sans y avoir poussé.
   *
   * Le compteur de l'abonnement ne les voit pas — il lit les lignes de
   * présence, et une ligne n'existe qu'à la première poussée. Deux onglets
   * ouverts sur deux matchs avant tout chant se réserveraient donc chacun la
   * dernière place, et les deux compteraient.
   *
   * Les partis n'y sont pas : qui a regardé une tribune et en est ressorti
   * sans chanter ne doit pas perdre sa place dans celle où il va vraiment
   * jouer. S'il revient dans la première, sa réservation s'y refait contre le
   * compteur, qui voit alors la seconde.
   */
  function reservees(userId, saufFixture) {
    let n = 0;
    for (const [id, room] of rooms) {
      if (id === saufFixture) continue;
      const m = room.members.get(userId);
      if (m && m.classe !== false && !m.presenceEcrite) n++;
    }
    return n;
  }

  /* ------------------------------------------------------------- socket */

  io.on('connection', (socket) => {
    const me = () => socket.data?.user ?? null;

    /**
     * Un gestionnaire qui ne peut pas emporter le processus avec lui.
     *
     * **C'est la panne la plus chère qu'on ait eue, et elle ne laissait aucune
     * trace.** `socket.on('x', async …)` rend une promesse que socket.io ne
     * regarde pas : si elle part en erreur, c'est une `unhandledRejection`, et
     * Node ferme le processus dessus depuis la version 15. Une base qui bronche
     * pendant qu'un seul joueur entre dans une tribune fermait donc le port —
     * et tous les autres tombaient sur la page de maintenance de l'hébergeur,
     * qui se lit comme « le jeu ne marche plus ».
     *
     * Le gain n'est pas d'avaler l'erreur : `virage:chant` et `virage:jouer`
     * l'attrapaient déjà à l'intérieur, et pourtant le risque restait entier
     * pour tout ce qui se passe **avant** leur `try`. Le filet est ici, à
     * l'endroit où l'on ne peut pas l'oublier, et il répond au joueur au lieu
     * de le laisser devant un écran qui ne réagit pas.
     */
    const filet = (nom, fn) => (...args) => {
      Promise.resolve().then(() => fn(...args)).catch((e) => {
        console.error(`[virage] ${nom}`, e);
        socket.emit('virage:error', { code: 'ferveur.error.server' });
      });
    };
    const sur = (nom, fn) => socket.on(nom, filet(nom, fn));

    /* L'entrée prend son numéro **à la réception**, hors du filet : celui-ci
       lance le corps au tour suivant de la boucle, et un `virage:leave` arrivé
       dans le même paquet passerait sinon devant elle — la page ressortie
       aurait quand même été assise. Voir `demandes`. */
    const entrer = filet('virage:join', async ({ fixtureId, camp } = {}, demande) => {
      const u = me();
      if (!u) return socket.emit('virage:error', { code: 'auth.error.unauthenticated' });

      let room = await roomFor(Number(fixtureId));
      if (!room) return socket.emit('virage:error', { code: 'ferveur.error.no_fixture' });
      /* Les lectures qui suivent prennent du temps, et une salle vide finit
         par se libérer — une minute suffit, une fois le match fini : elle ne
         doit pas l'être sous les pieds de celui qui est en train d'y entrer. */
      room.occupeeA = Date.now();

      /* **Ce que le relevé a vu peut avoir vieilli.** Il survit à la salle,
         pour ne pas repayer un statut relu en base à chaque visite. Mais un
         match regardé par un lien à la veille, puis avancé à aujourd'hui,
         rouvrait sa salle sur la ligne de ce regard — « à venir demain » — et
         le relevé, qui l'avait vu, ne le regardait plus avant la demi-heure
         d'un coup d'envoi qui n'arriverait jamais : ni score, ni minute, ni
         but, ni carte, tout le match. La journée, elle, le sait : c'est le
         cache que la liste vient de remplir, et la lire ne coûte rien de plus.
         Quand elle contredit la salle sur le statut ou l'heure d'un match que
         le relevé laisserait de côté, on oublie ce regard, et le tour suivant
         le relève. */
      if (vusA.has(room.fixture.id) && !TERMINES.has(room.statut)
          && !aRelever(room, Date.now())) {
        const duJour = (await journeeParId(jourDuFoot)).get(room.fixture.id);
        const coupDEnvoi = new Date(room.fixture.kickoffAt).getTime();
        const annonce = Date.parse(duJour?.date ?? '');
        if (duJour && ((duJour.status && duJour.status !== room.statut)
            || (Number.isFinite(annonce) && annonce !== coupDEnvoi))) {
          oublierLeRegard(room.fixture.id);
        }
      }

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
      /* **Et sans demande, le neutre garde le sien.** La page qui se
         reconnecte renvoie `virage:join` sans camp : un neutre parti pousser
         à l'extérieur était remis à domicile par le réseau, au milieu de sa
         tribune et de son rang. Un neutre déjà connu de la salle — présent
         dans un autre onglet, ou parti et revenu — retrouve donc le sien
         quand la page n'en demande aucun.

         Mais **un camp demandé est un camp choisi**, et il l'emporte : la page
         repose la question à chaque entrée depuis la liste, et « je me suis
         trompé de camp, je ressors et je rechoisis » est un geste normal. Le
         garder en silence rendrait l'ancien camp pour toute la vie de la
         salle, pendant que la page dessinerait l'autre.

         Chez soi, rien ne change : le camp découle du club suivi à chaque
         entrée, revenant ou non. Un neutre qui se met à suivre le club d'en
         face en cours de match ne pousse donc pas contre lui en revenant.
         Le KOP, plus bas, se lit sur ce camp-là. */
      const connu = room.members.get(u.userId) ?? room.partis.get(u.userId);
      const choisi = neutre && ['domicile', 'exterieur', 0, 1].includes(camp);
      const side = choisi ? (camp === 'exterieur' || camp === 1 ? 1 : 0)
        : neutre ? (connu?.side ?? 0)
        : (teamId === room.fixture.awayId ? 1 : 0);

      const hero = await fanzzy.activeFanzzy(u.userId);
      const mods = hero ? { id: hero.id, ...hero.mods } : {};
      /* **Le sac, et il n'était nulle part.**

         Le Virage composait les modificateurs du Fanzzy et ceux du KOP, et
         sautait l'équipement : les deux pièces portées ne changeaient
         strictement rien ici, alors que trois commentaires du moteur
         supposent le contraire depuis longtemps — `gestures.js` raconte « un
         joueur portant les Jumelles », `epreuves.js` écrit « les
         modificateurs du Fanzzy **et de l'équipement** », et le `snapshotFor`
         d'à côté parle du « porteur d'équipement ». Le duel, lui, les compose
         depuis toujours via `loadout`. Une pièce qui agit dans une arène et
         pas dans l'autre est une règle qu'on ne peut pas apprendre.

         **Le sac est celui que le deck attache à ce personnage.** C'est le
         seul endroit où un Fanzzy porte quelque chose, et c'est celui que le
         joueur a rempli en connaissance de cause. Un avatar qui n'est dans
         aucun emplacement du deck entre donc sans sac — comme aujourd'hui,
         et c'est dit dans le panneau plutôt que laissé à deviner.

         Renseigné plus bas, avec le deck : les deux lectures partagent le même
         appel, et une seule panne. */
      let sac = [];
      /* Le personnage, séparément du barème : c'est lui qu'on voit pousser
         dans la tribune, et il est montré **à l'âge atteint** — comme partout
         ailleurs dans le jeu. Une absence n'empêche rien : le virage se joue
         très bien sans Fanzzy équipé, la scène reste simplement vide. */
      /* `enJeu` : au premier âge, au repos, dans sa tenue. C'est déjà la règle
         des effets — un deck entre toujours au premier âge — et le dessin la
         suit désormais : on poussait avec les chiffres du gamin sous les traits
         du Capo, et rien ne le disait. */
      const perso = await fanzzy.personnageActif?.(u.userId, { enJeu: true }) ?? null;

      /* Le deck : ses cartes d'action, et le sac du personnage qui entre.
       *
       * `decks` est facultatif, et volontairement : le Virage s'est joué sans
       * cartes jusqu'ici et doit continuer de s'ouvrir pour quelqu'un qui n'a
       * jamais construit de deck. Une main vide n'est pas une erreur, c'est
       * simplement un supporter qui n'a que sa voix.
       *
       * Le tri — quelles cartes entrent au Virage — n'est pas fait ici : il
       * appartient à `dansLeVirage`, et la salle l'applique elle-même. Le
       * faire des deux côtés donnerait deux réponses le jour où la règle
       * bouge.
       *
       * **Lu avant le KOP**, et l'ordre porte une règle : le groupe amplifie ce
       * que le supporter porte déjà, sac compris. Composé après, il aurait
       * multiplié un Fanzzy nu. */
      let actions = [];
      try {
        const l = decks ? await decks.loadout(u.userId) : null;
        actions = (l?.actions ?? []).map((a) => a.id);
        const place = hero ? (l?.fanzzy ?? []).find((f) => f.id === hero.id) : null;
        if (place) {
          sac = place.stuff ?? [];
          /* `place.mods` est déjà `combine(mods du Fanzzy, sac)` — le calcul du
             deck, pas un second ici. Le refaire sur place donnerait deux règles
             de composition, et c'est exactement ce que `combine` existe pour
             éviter. `id` est repris du personnage : le barème du Virage suit la
             racine, quel que soit l'âge que le deck a en tribune. */
          Object.assign(mods, place.mods, { id: hero.id });
        }
      } catch (e) {
        // Un deck illisible ne doit pas fermer la porte du virage.
        console.warn('[virage] deck illisible pour', u.userId, '·', e.message);
      }

      /* Le bonus du KOP se mêle à ceux du Fanzzy, dans le même objet.

         Il **multiplie** au lieu d’écraser : le bonus de tempo d’un KOP et
         celui d’un Fanzzy de la voix se composent, ce qui est exactement ce
         qu’on veut — le groupe amplifie le personnage, il ne le remplace
         pas. Une simple fusion aurait fait disparaître l’un des deux selon
         l’ordre, en silence.

         Le côté décide du club : on ne profite pas du KOP d’une équipe pour
         laquelle on ne pousse pas. */
      let bonusKop = null;
      if (kop) {
        const club = side ? room.fixture.awayId : room.fixture.homeId;
        bonusKop = await kop.modsDe(u.userId, club, room.fixture.id);
        for (const [cle, v] of Object.entries(bonusKop)) {
          if (typeof v !== 'number') { mods[cle] = v; continue; }
          mods[cle] = (mods[cle] ?? 1) * v;
        }
      }

      /* **Ce Virage comptera-t-il au classement ?**

         La question se pose ici, une seule fois, à l'entrée : au-delà de
         `abo.virages_classes_jour`, un joueur sans abonnement entre quand
         même et joue tout le match — il pousse, il chante, les
         cartes-souvenirs tombent — mais sa ferveur ne rejoint pas le
         classement. **Aucune porte ne se ferme**, c'est le compteur qui
         s'arrête.

         **Une fois la présence écrite, la salle ne recalcule plus** :
         rejoindre à nouveau reprend la décision posée sur le membre — ou sur
         le parti, que la salle garde tant que le match peut se jouer —,
         sinon un match commencé compté cesserait de l'être parce qu'un
         tunnel a coupé le réseau.

         **Avant, ce n'est qu'une réservation, et elle se refait.** Le compteur
         lit les lignes de présence, et une ligne n'existe qu'à la première
         poussée. Garder au parti une décision jamais consommée laisserait
         regarder trois tribunes au coup d'envoi, ressortir, puis revenir
         chanter dans les trois — trois Virages classés sur un plafond d'un.
         Voir aussi `reservees`, plus bas, pour deux onglets ouverts à la fois.

         Une panne de ce compte **ne ferme rien** : on compte au classement,
         comme avant. Un plafond qui se déclenche sur une erreur de base
         punirait sans raison et ne se verrait nulle part. */
      let reste = null;
      if (abonnement && !connu?.presenceEcrite) {
        try {
          reste = await abonnement.viragesClassesRestants(u.userId);
        } catch (e) {
          console.warn('[virage] plafond illisible pour', u.userId, '·', e.message);
        }
      }

      /* **La ventilation de ce qu'il porte**, construite ici parce que c'est le
         seul endroit où les morceaux existent encore séparément : plus bas, il
         n'y a que `mods`, le total, dont on ne peut plus rien déduire. Le lieu
         n'y est pas — il appartient à la salle, qui l'ajoute elle-même : elle
         seule sait où se joue la rencontre. */
      const apports = apportsDe({
        fanzzy: hero ? { nom: perso?.nom ?? hero.nom, mods: hero.mods } : null,
        stuff: sac,
        kop: bonusKop,
      });

      /* **D'ici à la fin, plus aucune attente** : ce qui suit doit voir la
         salle et la socket telles qu'elles sont, pas telles qu'elles étaient
         avant les lectures.

         La socket a pu se fermer pendant ces lectures. Son départ a déjà été
         traité, sur une socket qui n'était encore nulle part : la faire entrer
         maintenant laisserait dans la salle un membre que plus rien n'en
         sortirait — le fantôme qui gardait une salle « occupée » et son
         relevé payé jusqu'au redémarrage. */
      if (socket.connected === false) return;
      /* La page a pu ressortir pendant ces lectures (`virage:leave`), ou
         demander un autre match : celle-ci n'est plus l'entrée attendue. La
         laisser s'asseoir gardait dans la salle, et au relevé, quelqu'un qui
         regardait déjà la liste. */
      if (demandes.get(socket) !== demande) return;
      /* La salle a pu être libérée pendant ces lectures, si elles ont duré
         plus que son délai — une minute, pour un match fini. Y entrer
         enfermerait le joueur dans une salle qu'aucune horloge ne fait plus
         battre : on prend celle qu'un autre a rouverte entre-temps, ou l'on
         remet celle-ci en place. */
      const vive = rooms.get(room.fixture.id);
      if (!vive) rooms.set(room.fixture.id, room);
      else room = vive;

      /* Une socket ne tient qu'une salle. Partir pour un autre match quitte
         le premier — sans quoi elle chanterait dans l'un en étant comptée
         dans l'autre. Rejoindre la même salle ne détache rien. */
      if (salleDeSocket.get(socket)?.fixtureId !== room.fixture.id) detacher(socket);
      attacher(socket, room.fixture.id, u.userId);
      if (process.env.VIRAGE_DEBUG) console.log('[virage] join', u.userId, '->', room.fixture.id);

      /* La réservation se pèse ici, sans plus rien attendre, et après le
         détachement : deux entrées en vol sur deux matchs liraient sinon le
         même compteur et se réserveraient chacune la dernière place, et une
         socket qui change de match se compterait elle-même dans la salle
         qu'elle quitte. */
      const classe = reste === null || reste - reservees(u.userId, room.fixture.id) > 0;

      socket.emit('virage:state',
        room.join(u.userId, { side, name: u.name, mods, neutre, perso, actions,
          classe, apports }));
      io.to(`virage:${room.fixture.id}`).emit('virage:crowd', { crowd: room.crowd() });
    });
    socket.on('virage:join', (charge) => entrer(charge, demander(socket)));

    sur('virage:chant', async ({ cardId, taps } = {}) => {
      const u = me();
      if (!u) return;
      /* La salle de **cette socket**, et non celle du joueur : deux onglets
         sur deux matchs chantent chacun dans le leur. */
      const { fixtureId, room } = salleDe(socket);
      if (!room) {
        if (process.env.VIRAGE_DEBUG) {
          console.log('[virage] chant refusé pour', u.userId, '· salle', fixtureId,
            '· salles ouvertes', [...rooms.keys()]);
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
    sur('virage:jouer', async ({ cardId } = {}) => {
      const u = me();
      if (!u) return;
      const { fixtureId, room } = salleDe(socket);
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
        /* **À tous ses onglets**, et pas à celui-ci seul. Le tirage du
           battement les couvrait presque tous — une carte jouée en appelle
           une autre —, mais pas le Changement de chant : il refait cinq
           cartes d'un coup, sans tirage à venir, et l'autre onglet gardait
           l'ancienne main sans limite de temps. */
        aSesOnglets(fixtureId, u.userId, room.snapshotFor(u.userId).you);
      } catch (e) {
        if (e instanceof Cheat) {
          socket.emit('virage:error', { code: e.code });
          /* **Le filet.** Un tel refus prouve que cette page voit une autre
             main, d'autres recharges ou un autre souffle que la salle : on
             les lui renvoie, et l'écart se répare de lui-même au lieu de
             durer jusqu'au rechargement. À elle seule — rien n'a changé pour
             les autres onglets. Borné par le seau des cartes, plus haut. */
          if (REFUS_DE_MAIN.has(e.code) && room.members.has(u.userId)) {
            socket.emit('virage:vous', room.snapshotFor(u.userId).you);
          }
        } else {
          console.error('[virage] carte', e);
          socket.emit('virage:error', { code: 'ferveur.error.server' });
        }
      }
    });

    /* Les deux sorties passent par `detacher` : c'est la socket qui part, et
       le joueur ne quitte la salle qu'avec la dernière des siennes. Il y passe
       alors parmi les partis, qui lui rendront son état s'il revient. */
    socket.on('virage:leave', () => { demander(socket); detacher(socket); });
    socket.on('disconnect', () => detacher(socket));
  });

  /* ---------------------------------------------- but réel, venu du worker */

  /**
   * Appelé par le worker API-Football. Le but secoue la corde, ouvre la minute
   * double, et la frappe des cartes-souvenirs suit dans la foulée : les
   * présents sont exactement ceux qui viennent de chanter.
   *
   * Rend `true` quand une salle l'a annoncé. `false` sans salle, **et pour un
   * but que la salle connaît déjà** : au tableau à son ouverture — le relevé
   * l'apporte en retard, et personne dans la tribune ne l'a vu tomber —, ou
   * déjà annoncé ici et revenu sous une autre identité, quand l'API corrige
   * le buteur. Voir `VirageRoom.realGoal`. `server.js` ne lit pas ce retour
   * aujourd'hui : la carte-souvenir d'un but ancien se frappe quand même, et
   * va aux chanteurs des deux dernières minutes, quel que soit l'âge du but ;
   * celle d'un but revenu, non — elle porte son rang, déjà frappé.
   */
  function realGoal(goal) {
    const room = rooms.get(goal.fixtureId);
    if (!room) return false;
    return room.realGoal({
      teamId: goal.teamId, minute: goal.minute, player: goal.player,
      // Le relevé porte le score à l'instant du but. Le recompter à partir des
      // buts vus depuis l'ouverture de la salle afficherait 1–0 à qui est
      // entré à la soixantième minute d'un 3–2. C'est aussi lui qui date le
      // but : sans lui, la salle ne peut pas savoir qu'il est ancien.
      score: goal.score ?? null,
    });
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

  /* **Ce que le relevé a vu, au-delà de la vie des salles.**

     Une salle libérée puis rouverte repartait sans rien savoir, et le relevé
     « une fois » d'un statut lu en base se refaisait à chaque ouverture :
     trente matchs lointains visités trois minutes par heure coûtaient sept
     cent vingt appels par jour, pour relire un statut que le relevé venait
     lui-même d'écrire en base. La salle rouverte relit bien ce statut et
     cette heure ; il ne lui manquait que de savoir qu'un relevé les avait
     vus, et quand. C'est tenu ici, par match, et non dans la salle.

     Ce regard peut vieillir — un match avancé ou reprogrammé depuis — : à
     l'entrée, la journée le corrige. Voir `virage:join`.

     Bornée, comme les mémoires du relevé, par les matchs vus depuis le
     démarrage. */
  const vusA = new Map();           // fixtureId -> instant du dernier relevé qui l'a vu
  /* **Et ce qu'il a demandé sans réponse.** Un match que l'API ne rend pas, ou
     ne rend plus — supprimé, renuméroté, dont la ligne reste en base et
     qu'un lien ouvre encore — était relevé à chaque tour tant que sa salle
     était occupée : sept cent vingt appels par jour pour une salle sur un
     match qui n'existe plus. Jamais vu, rien ne l'arrêtait. Vu une fois, puis
     plus rendu, son regard ne se rafraîchissait plus, et chaque règle qui le
     compare à maintenant restait vraie à chaque tour — même pour une salle
     rouverte par un lien des heures plus tard. L'absence compte donc comme un
     regard : voir `aRelever`.

     **C'est le relevé qui la date, sur un lot qui a répondu** : voir
     `matchAbsent`. Dater chaque demande faisait passer une panne de l'API
     pour une disparition : au retour, une salle en jeu attendait sa
     demi-heure. Effacé dès que l'API rend le match. */
  const sansReponse = new Map();    // fixtureId -> { premier, dernier } instants d'absence
  /* **Et depuis quand il n'a pas bougé.** Un match que l'API laisse « en jeu »
     des heures après la fin — l'onglet resté ouvert sur le bilan est celui de
     D1, seul le statut ment — payait le direct à vingt secondes et ses
     événements chaque minute, cinq mille sept cent soixante appels par jour,
     de quoi épuiser le quota et figer le direct de tout le site. La borne
     porte sur l'immobilité, et non sur l'heure : une borne sur le coup
     d'envoi ralentirait une reprise après suspension, dont l'heure reste
     celle d'origine. */
  const mouvements = new Map();     // fixtureId -> { cle, bougeA }

  /**
   * Ce que le relevé a vu d'un match ne vaut plus : la journée le contredit.
   * Le tour suivant le relève, comme un match jamais vu. Voir `virage:join`.
   */
  function oublierLeRegard(fixtureId) {
    vusA.delete(fixtureId);
    sansReponse.delete(fixtureId);
  }

  /** Le score, la minute et la période, à chaque tour du relevé du direct. */
  function matchStatus(fixtureId, etat) {
    // Retenu même sans salle : celle qui s'ouvrira saura qu'il a été vu.
    if (etat?.status) {
      const vu = Date.now();
      vusA.set(fixtureId, vu);
      sansReponse.delete(fixtureId);
      const cle = [etat.status, etat.elapsed, etat.elapsedExtra,
        etat.homeGoals, etat.awayGoals].join('|');
      if (mouvements.get(fixtureId)?.cle !== cle) mouvements.set(fixtureId, { cle, bougeA: vu });
    }
    const room = rooms.get(fixtureId);
    if (!room) return 0;
    return room.matchStatus(etat).length;
  }

  /**
   * Un lot du relevé du direct a répondu sans ce match : l'API ne le rend
   * pas, ou plus. Retenu même sans salle, comme ce qu'il a vu. Voir
   * `sansReponse`.
   */
  function matchAbsent(fixtureId) {
    const now = Date.now();
    const premier = sansReponse.get(fixtureId)?.premier ?? now;
    sansReponse.set(fixtureId, { premier, dernier: now });
  }

  /**
   * Les matchs dont la salle est occupée.
   *
   * C'est ce qui borne la dépense du fil : le relevé ne demande les
   * événements — un appel par match — que pour ceux-là. Une salle vide ne
   * coûte donc pas un appel de plus qu'avant le fil, et un samedi où personne
   * ne joue ne coûte rien du tout.
   *
   * **Une salle occupée n'est pas une salle à relever.** La liste rendait
   * toute salle qui avait un membre, quel que soit le match : un onglet resté
   * ouvert sur un Virage fini — et le bilan garde les gens sur la page après
   * le coup de sifflet — payait un relevé du direct et un relevé d'événements
   * à chaque tour, jour et nuit, soit 1 440 appels par jour et par salle, le
   * cinquième de l'enveloppe. Neuf salles dépassaient le budget, et le quota
   * épuisé figeait alors le direct de tout le site.
   *
   * Voir `aRelever` pour ce qui reste, et à quelle cadence. Le tour qui voit
   * le coup de sifflet a déjà calculé cette liste : le dernier relevé part
   * quand même, puis la salle sort.
   */
  function sallesOccupees(now = Date.now()) {
    return [...rooms.values()]
      .filter((r) => r.size > 0 && aRelever(r, now))
      .map((r) => r.fixture.id);
  }

  /**
   * Une salle occupée mérite-t-elle le relevé de ce tour ?
   *
   *   - **un match terminé, jamais** : il ne bougera plus ;
   *   - **un statut qu'aucun relevé n'a vu, toujours, une fois** : pour un
   *     match qu'aucun club suivi ne relève, la ligne en base peut dater de
   *     semaines. Un report resté « PST » alors que le match se rejoue
   *     aujourd'hui sous le même numéro aurait sinon figé la salle pour tout
   *     le match — ni minute, ni score, ni but, ni carte. Le premier relevé
   *     tranche, pour un appel partagé dans le lot du direct ;
   *   - **un match que l'API ne rend pas, ou plus** — jamais rendu, ou vu
   *     puis disparu —, les règles ordinaires pendant la première demi-heure
   *     d'absence, puis un coup d'œil par demi-heure, compté sur la dernière
   *     absence. Seul un lot qui a répondu sans lui la compte : une panne ne
   *     ralentit rien. Voir `sansReponse` ;
   *   - **un report ou un arrêt vu par le relevé, un coup d'œil par
   *     demi-heure** : sans lui, un report reprogrammé aujourd'hui sous le
   *     même numéro resterait figé tant que le processus vit, puisque ce que
   *     le relevé a vu survit désormais aux salles ;
   *   - **un match en jeu, à chaque tour** — tant qu'il bouge. Rien n'ayant
   *     bougé depuis une heure, l'API l'a laissé en jeu : un coup d'œil par
   *     quart d'heure, et le premier mouvement le rend à chaque tour ;
   *   - **un match en attente** — à venir, heure provisoire, suspendu — dans
   *     la demi-heure qui précède son coup d'envoi et les quatre heures qui
   *     le suivent, à chaque tour : pour un match qu'aucun club suivi ne
   *     relève, la salle est le seul chemin de rafraîchissement, et l'écarter
   *     le laisserait « à venir » pour toujours. Plus tôt, rien ; plus tard,
   *     un coup d'œil par demi-heure. Sans ce plafond, une salle sur un match
   *     suspendu, ou sur une ligue sans direct que l'API laisse « à venir »
   *     toute la journée, coûtait ce que coûtait une salle finie.
   *
   * Le statut et l'heure sont ceux que le relevé a vus en dernier : voir
   * `matchStatus` dans la salle — et une salle rouverte les relit en base, où
   * ce même relevé les a écrits. Ce qui a été vu, et quand, se lit sur
   * `vusA`, qui survit à la salle — et que la journée corrige à l'entrée :
   * voir `virage:join`. Pas d'effet de bord ici : l'entrée l'interroge aussi.
   */
  function aRelever(room, now) {
    const st = room.statut;
    if (TERMINES.has(st)) return false;
    const id = room.fixture.id;
    /* L'absence passe avant le regard. Un match vu, puis que l'API ne rend
       plus, garde un regard qui ne se rafraîchit plus : chaque règle qui suit
       le dirait à relever à chaque tour, pour toujours. La première
       demi-heure d'absence ne change rien — une réponse incomplète, un numéro
       qui revient —, puis un coup d'œil par demi-heure. */
    const absent = sansReponse.get(id);
    if (absent && now - absent.premier >= RELEVE_LENT_MS) {
      return now - absent.dernier >= RELEVE_LENT_MS;
    }
    const vu = vusA.get(id);
    if (vu === undefined) return true;
    const coupDOeil = now - vu >= RELEVE_LENT_MS;
    if (REPORTES.has(st)) return coupDOeil;
    if (!EN_ATTENTE.has(st)) {
      const m = mouvements.get(id);
      if (!m || now - m.bougeA <= IMMOBILE_MS) return true;
      return now - vu >= COUP_D_OEIL_IMMOBILE_MS;
    }
    /* Une date illisible ne ferme rien : mieux vaut un appel de trop qu'un
       match figé avant son coup d'envoi. */
    const coupDEnvoi = new Date(room.fixture.kickoffAt).getTime();
    if (!Number.isFinite(coupDEnvoi)) return true;
    if (coupDEnvoi - now > AVANT_COUP_D_ENVOI_MS) return false;
    if (now - coupDEnvoi <= APRES_COUP_D_ENVOI_MS) return true;
    return coupDOeil;
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

       **Et elle se superpose aussi quand le match est fini.** La ligne d'avant
       écartait tout ce qui ne se jouait plus — « une rencontre terminée n'a pas
       de tribune » — mais elle n'écartait que la **nouvelle** : la vieille ligne
       de base restait en place, avec le statut du dernier relevé. Un match d'un
       club suivi gardait donc « 2H, 90' » pendant les trois heures que dure la
       fenêtre ci-dessus, longtemps après le coup de sifflet, et la liste avait
       l'air de ne plus se mettre à jour du tout.

       La règle se déplace donc d'un cran : la journée corrige **tout ce qu'on
       connaît déjà**, et n'ajoute que ce qui se joue. Ce qui est fini sort par
       `open`, plus bas, là où cette décision se prend. */
    for (const [id, m] of await journeeParId(jourDuFoot)) {
      if (!m.live && !parId.has(id)) continue;
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

    /**
     * Dans combien de temps le coup d'envoi — zéro si c'est déjà commencé.
     *
     * Le zéro pour le passé est tout l'intérêt : une soustraction de dates rend
     * un nombre **négatif** pour un match commencé, et un négatif est toujours
     * plus petit qu'une demi-heure. Voir `open`, plus bas.
     *
     * Une date illisible rend `NaN`, donc zéro : une ligne sans coup d'envoi
     * n'ouvre pas de tribune par accident.
     */
    const avantLeCoupDEnvoi = (m) => {
      const dans = new Date(m.kickoff_at) - Date.now();
      return dans > 0 && dans <= 30 * 60_000 ? dans : 0;
    };

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
        /* **Une tribune est ouverte pendant le match, et dans la demi-heure
           qui le précède.**

           La seconde moitié de cette condition n'avait pas de plancher :
           `coup d'envoi − maintenant < 30 min` est vrai pour un match à venir
           dans vingt minutes, et **tout aussi vrai** pour un match commencé il
           y a deux heures, où la différence est négative. Toute rencontre de la
           fenêtre de trois heures était donc « ouverte », coup de sifflet final
           compris : on la voyait dans TES CLUBS avec sa minute, on pouvait
           encore appuyer dessus, et elle n'en sortait jamais. C'est ce qui
           faisait croire que la page ne se mettait plus à jour.

           `fini` reste dans la réponse : la page dit « TERMINÉ » plutôt que de
           griser une ligne sans expliquer pourquoi. Il ne porte que les trois
           fins de match réelles — un report ou une annulation n'est pas un coup
           de sifflet final, et l'écrire ainsi serait mentir pour remplir une
           case. Ces lignes-là restent simplement éteintes. */
        fini: ['FT', 'AET', 'PEN'].includes(f.status_short),
        open: ['1H', 'HT', '2H', 'ET', 'P', 'LIVE'].includes(f.status_short)
          || avantLeCoupDEnvoi(f) > 0,
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

  return { router, realGoal, matchEvents, matchStatus, matchAbsent, sallesOccupees,
           rooms, roomFor, stop: () => clearInterval(timer) };
}
