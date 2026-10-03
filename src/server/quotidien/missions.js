/**
 * Les missions du jour : ce que le serveur lit pour les compter, et ce qu'il
 * regarde pour savoir s'il peut les proposer.
 *
 * ## Le jour de jeu est celui de la base
 *
 * Tout ce qui découpe le temps ici est écrit **en SQL** : `CURDATE()`, `NOW(3)`
 * et `UNIX_TIMESTAMP()`, l'horloge de la base, celle qui compte déjà les cinq
 * duels classés et les deux Virages comptés du joueur gratuit. Missions, bonus
 * et quotas changent ainsi au même minuit. Jamais un jour fabriqué en
 * JavaScript, jamais un `new Date()` passé au pool (il est en `timezone: 'Z'`) :
 * entre minuit et deux heures, la mission d'hier se serait remplie avec les
 * duels d'aujourd'hui.
 *
 * Une seule exception, et elle est voulue : `fixtures.kickoff_at` est écrit en
 * **UTC** (l'API le donne ainsi). Il ne se compare donc qu'à `UTC_TIMESTAMP()`,
 * décalé du temps écoulé depuis le minuit de la base — ce qui reste juste les
 * dimanches de 23 h et de 25 h, puisque l'écart est mesuré en secondes Unix.
 *
 * ## Ce qu'un duel et un chant doivent prouver
 *
 * **Un duel compte s'il a duré au moins une minute et que le joueur ne l'a
 * pas quitté** (`xp > 0 AND duree_s >= 60`). Le joueur resté après un forfait
 * est payé en entier, et sa ligne dit « win » avec de l'XP : un second compte
 * qui entre en file et abandonne aussitôt offrait donc une victoire en trois
 * secondes. Une minute coûte au tricheur autant qu'une vraie victoire rapide,
 * et un vrai duel ne se joue presque jamais en moins — trois buts demandent
 * environ quatorze chants parfaits de quatre secondes et demie. Si un vrai
 * duel le contredit un jour, le seuil baisse ; il ne disparaît pas.
 *
 * **Les chants d'un match comptent pour le jour de son coup d'envoi.** La
 * présence au Virage tient une ligne par match, et chaque poussée réécrit
 * `last_push_at`. Compter sur elle déplaçait tous les chants d'un match à
 * cheval sur minuit vers le lendemain : la mission prête la veille redevenait
 * incomplète au moment de la réclamer. Le coup d'envoi, lui, ne bouge pas.
 */
import { reglage } from '../../shared/reglages.js';
import { MISSION_PAR_ID, faitPour } from '../../shared/quotidien.js';
import { EVO_COST } from '../../shared/fanzzy/dex.js';
import { stadesEcrits } from '../fanzzy/catalogue.js';
import { journeeParId, EN_DIRECT } from '../football/journee.js';

/* Les clubs suivis du joueur, en sous-requête : une lecture par clé, et pas
   une requête de plus.

   sql-sur : les requêtes de ce fichier n'interpolent que ce fragment
   constant et `debutUtc(k)`, dont `k` est un entier du code, vérifié ; les
   valeurs du joueur passent toutes par `?`. */
const SUIVIS = '(SELECT team_id FROM user_follows WHERE user_id = ?)';

/**
 * Le début du jour de jeu `k` (0 aujourd'hui, 1 hier, -1 demain), **en UTC**,
 * pour se comparer à `fixtures.kickoff_at`.
 *
 * Le temps écoulé depuis ce minuit se mesure en secondes Unix des deux côtés
 * — `UNIX_TIMESTAMP()` et `UNIX_TIMESTAMP(<minuit de la base>)` — puis se
 * retranche de l'heure UTC. Une différence d'heures murales
 * (`TIMESTAMPDIFF`) se tromperait d'une heure les deux dimanches de
 * changement d'heure. `k` vient du code, jamais d'une requête.
 */
export function debutUtc(k) {
  if (!Number.isInteger(k)) throw new Error(`debutUtc : jour relatif invalide « ${k} »`);
  return `(UTC_TIMESTAMP() - INTERVAL (UNIX_TIMESTAMP() - UNIX_TIMESTAMP(CURDATE() - INTERVAL ${k} DAY)) SECOND)`;
}

/* ================================================================ les lectures

   Trois lectures, une par famille de source, et les mêmes partout : à
   l'affichage, au recompte d'une réclamation, à la relance. Elles rendent des
   lignes brutes, que `faitPour` (src/shared/quotidien.js) compte. `k` est
   calculé en SQL : 0 pour aujourd'hui, 1 pour hier. */

/** Les duels d'hier et d'aujourd'hui, avec ce qu'il faut pour les compter. */
export function lireDuels(lire, userId) {
  return lire(
    `SELECT IF(ended_at >= CURDATE(), 0, 1) AS k, outcome, mode,
            COALESCE(xp > 0 AND duree_s >= 60, 0) AS compte,
            COALESCE(team_id IN ${SUIVIS}, 0) AS club
       FROM duel_results
      WHERE user_id = ? AND ended_at >= CURDATE() - INTERVAL 1 DAY`,
    [userId, userId]);
}

/**
 * Les présences au Virage des matchs dont le coup d'envoi tombe hier ou
 * aujourd'hui.
 *
 * Le filtre reste indexé : `user_id` et `joined_at` d'abord (une présence ne
 * peut pas commencer plus d'un jour avant le coup d'envoi d'un match d'hier),
 * puis la jointure par clé sur `fixtures`.
 */
export function lirePresences(lire, userId) {
  return lire(
    `SELECT IF(f.kickoff_at >= ${debutUtc(0)}, 0, 1) AS k,
            vp.chants, vp.chants_mt1 AS mt1, vp.chants_mt2 AS mt2, f.league_id AS ligue,
            COALESCE(vp.team_id IN ${SUIVIS}, 0) AS club
       FROM virage_presence vp
       JOIN fixtures f ON f.id = vp.fixture_id
      WHERE vp.user_id = ? AND vp.joined_at >= CURDATE() - INTERVAL 2 DAY
        AND f.kickoff_at >= ${debutUtc(1)} AND f.kickoff_at < ${debutUtc(-1)}`,
    [userId, userId]);
}

/** Les compteurs d'hier et d'aujourd'hui : boosters ouverts, évolutions. */
export function lireCompteurs(lire, userId) {
  return lire(
    `SELECT IF(jour = CURDATE(), 0, 1) AS k, cle, n
       FROM compteurs_jour
      WHERE user_id = ? AND jour >= CURDATE() - INTERVAL 1 DAY`,
    [userId]);
}

const FAMILLE = {
  boosters: 'compteurs', evolutions: 'compteurs',
  duels: 'duels', victoires: 'duels', classes: 'duels', duels_club: 'duels',
  chants: 'presences', chants_club: 'presences', mitemps: 'presences', competitions: 'presences',
};

/**
 * `fait` pour une mission du jour `k`, recompté sur la connexion donnée — la
 * transaction d'un versement, sous le verrou du joueur. Une seule lecture : la
 * famille de la source.
 */
export async function recompter(lire, userId, mission, cible, k) {
  const famille = FAMILLE[mission.source];
  const donnees = {};
  if (famille === 'duels') donnees.duels = await lireDuels(lire, userId);
  else if (famille === 'presences') donnees.presences = await lirePresences(lire, userId);
  else if (famille === 'compteurs') donnees.compteurs = await lireCompteurs(lire, userId);
  return faitPour(mission, cible, donnees, k);
}

/* ============================================================ les conditions

   La journée du football ne se lit qu'au tirage et à la relance. Chaque
   condition ne coûte que ce qu'elle demande, et seulement si l'ordre du jour
   y arrive : la journée n'est lue que si une mission du Virage se présente,
   les Fanzzy du joueur que si « Fais grandir » se présente.

   **La lecture de l'état ne la lit jamais** (`presumer`). Le hub demande
   l'état à chaque arrivée, et « relançable » y pose la question des
   conditions : lire la journée là, c'était une requête sur le cache du
   télétexte, le décodage de tous les matchs du monde et une requête sur les
   compétitions à chaque arrivée — et, le cache expiré, un appel à l'API
   sportive déclenché par le hub, de jour comme de nuit. */

/* Le relevé de la journée vaut une minute : un peu plus que le cache du
   télétexte (45 s), assez pour que l'état rendu par une relance dise déjà
   ce qu'elle vient d'apprendre. */
const DUREE_DU_RELEVE_MS = 60_000;

/**
 * La mémoire du dernier relevé : les matchs du jour **déjà filtrés** sur le
 * jour de jeu, notés par la dernière lecture de la journée qu'un tirage ou
 * une relance a faite, pour tous les joueurs (la journée est la même pour
 * tous ; le club de chacun se juge après).
 *
 * Elle ne vaut que pour **le même jour de jeu** — ses bornes en secondes
 * Unix, lues en SQL — et pour une minute. L'âge se mesure à l'horloge de ce
 * processus : c'est une durée, pas un jour, et aucun jour n'est calculé ici.
 * Elle ne fait jamais lire la journée : elle sert ce qui a déjà été lu.
 *
 * @param horloge  l'instant en millisecondes ; les suites l'avancent
 */
export function memoireDeJournee({ dureeMs = DUREE_DU_RELEVE_MS, horloge = () => Date.now() } = {}) {
  let releve = null;
  return {
    noter(debut, fin, matchs) {
      releve = { debut, fin, matchs, a: horloge() };
    },
    /** Les matchs du jour de jeu `[debut, fin[`, ou `null` sans relevé valable. */
    relire(debut, fin) {
      if (!releve || releve.debut !== debut || releve.fin !== fin) return null;
      const age = horloge() - releve.a;
      return age >= 0 && age <= dureeMs ? releve.matchs : null;
    },
  };
}

/* « Se joue encore » : à venir à une heure fixée, ou en cours. `TBD` n'y est
   pas — son heure est provisoire, souvent minuit — ni les reportés, arrêtés
   ou donnés sur tapis vert (`PST`, `SUSP`, `ABD`, `AWD`, `WO`, `CANC`) : une
   mission qui demanderait de chanter pour eux ne pourrait pas se faire. */
const SE_JOUE = new Set(['NS', ...EN_DIRECT]);
/* Avant la seconde mi-temps : à venir, première mi-temps, mi-temps. */
const AVANT_MT2 = new Set(['NS', '1H', 'HT']);

let catalogueMuet = false;

/**
 * Le contexte des conditions d'un joueur pour aujourd'hui.
 *
 * @param base      ce que l'appelant a déjà lu, pour ne pas le relire :
 *                  `{ debut, fin, suivis, scarves, classes }` (`debut` et `fin`
 *                  en secondes Unix, le jour de jeu lu en SQL). Ce qui manque
 *                  est lu une fois, à la première question qui en a besoin.
 * @param memoire   la mémoire du relevé (`memoireDeJournee`) : une lecture de
 *                  la journée y est notée ; une question sans lecture s'y sert
 * @param presumer  vrai pour une question qui ne doit **rien lire** de la
 *                  journée (la lecture de l'état). Elle se sert du relevé du
 *                  même jour de jeu s'il a moins d'une minute ; sinon, une
 *                  condition qui dépend de la journée est **présumée
 *                  remplie** une fois ses autres prérequis vérifiés (bascule,
 *                  XP du duel, plafond des classés, club suivi). Jamais pour
 *                  un tirage ni une relance : eux lisent, et tranchent.
 */
export function contexte({ lire, userId, jourDuFoot = null, base = null, memoire = null,
  presumer = false }) {
  let socle = base;
  /* `undefined` : pas encore demandée ; `null` : inconnue (présumée) ; un
     tableau : les matchs du jour de jeu. */
  let journee;
  let grandir = null;

  async function lireSocle() {
    if (socle) return socle;
    const [r] = await lire(
      `SELECT UNIX_TIMESTAMP(CURDATE()) AS debut,
              UNIX_TIMESTAMP(CURDATE() + INTERVAL 1 DAY) AS fin,
              (SELECT scarves FROM user_wallet WHERE user_id = ?) AS scarves,
              (SELECT GROUP_CONCAT(team_id) FROM user_follows WHERE user_id = ?) AS suivis,
              (SELECT COUNT(*) FROM duel_results
                WHERE user_id = ? AND mode = 'classe' AND ended_at >= CURDATE()) AS classes`,
      [userId, userId, userId]);
    socle = {
      debut: Number(r.debut), fin: Number(r.fin),
      scarves: Number(r.scarves ?? 0),
      suivis: suivisDe(r.suivis),
      classes: Number(r.classes ?? 0),
    };
    return socle;
  }

  /* Les matchs de la journée dont le coup d'envoi tombe **dans le jour de
     jeu**. La journée du télétexte est un jour UTC (`teletext/index.js`,
     `jour()`), le jour de jeu est celui de la base : entre minuit et deux
     heures, la journée peut ne pas couvrir la fin du jour de jeu, et une
     mission du Virage n'être pas proposée alors qu'un match du soir se
     jouera. On l'accepte — le tirage se fait en général plus tard, et une
     mission qu'on ne propose pas ne promet rien. La comparaison se fait en
     instants absolus : la date ISO de l'API contre les bornes en secondes
     Unix lues dans la base. Aucun jour n'est calculé ici.

     Sans lecture permise (`presumer`), c'est le relevé de la mémoire, ou
     `null` : la journée est inconnue. Une lecture faite est notée, même
     vide — sans télétexte ou l'API en panne, aucune mission du Virage ne se
     ferait, et la relance le dirait aussi. */
  async function matchsDuJour() {
    if (journee !== undefined) return journee;
    const { debut, fin } = await lireSocle();
    if (presumer) {
      journee = memoire?.relire(debut, fin) ?? null;
      return journee;
    }
    const parId = await journeeParId(jourDuFoot);
    journee = [...parId.values()].filter((x) => {
      const t = Date.parse(x.date ?? '');
      return Number.isFinite(t) && t >= debut * 1000 && t < fin * 1000;
    });
    memoire?.noter(debut, fin, journee);
    return journee;
  }

  /* Une condition qui se juge sur la journée : `juger` reçoit les matchs du
     jour. Journée inconnue (une question qui ne lit rien, sans relevé
     valable) : présumée remplie. Une relance présumée à tort répond
     « aucune », et l'état qu'elle rend le sait déjà — elle vient de noter
     son relevé. */
  async function surLaJournee(juger) {
    const matchs = await matchsDuJour();
    return matchs === null ? true : juger(matchs);
  }
  const seJoue = (matchs) => matchs.some((x) => SE_JOUE.has(x.status));

  async function unFanzzyPeutGrandir() {
    if (grandir !== null) return grandir;
    const { scarves } = await lireSocle();
    const lignes = await lire(
      'SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ? AND copies >= 1', [userId]);
    let moinsCher = Infinity;
    try {
      for (const l of lignes) {
        const stade = Number(l.stage);
        if (stade < stadesEcrits(l.fanzzy_id)) {
          moinsCher = Math.min(moinsCher, EVO_COST[stade + 1] ?? 90);
        }
      }
    } catch (e) {
      /* Le catalogue n'est pas chargé : on ne sait pas qui peut grandir, et
         une mission qu'on ne sait pas faisable ne se propose pas. Dit une
         fois : c'est une faute de montage, pas un état du joueur. */
      if (!catalogueMuet) {
        catalogueMuet = true;
        console.error('[quotidien] catalogue Fanzzy illisible, « Fais grandir » écartée du tirage :',
          e.message);
      }
      moinsCher = Infinity;
    }
    grandir = moinsCher <= scarves;
    return grandir;
  }

  /**
   * La mission `id` est-elle proposable à ce joueur aujourd'hui ? Sa bascule
   * d'abord (`mission.<id>`), puis sa condition.
   */
  async function faisable(id) {
    const mission = MISSION_PAR_ID.get(id);
    if (!mission || reglage(`mission.${id}`) !== true) return false;
    const entrainement = reglage('xp.duel_entrainement') > 0;
    switch (mission.condition) {
      case 'toujours': return true;
      /* Un duel ne compte que s'il a rapporté de l'XP : à zéro, ces missions
         ne pourraient plus se faire. */
      case 'duel': return entrainement;
      case 'suit_un_club': return entrainement && (await lireSocle()).suivis.size > 0;
      case 'classes': {
        /* Le classé se joue le jour d'un match, rapporte de l'XP, et reste
           sous le plafond gratuit : les classés déjà joués aujourd'hui plus la
           cible, comptés comme le quota (`mode = 'classe'`, depuis
           `CURDATE()`), sans lire l'abonnement. Un plafond à 0 ne plafonne
           rien. */
        if (!(reglage('xp.duel_classe') > 0)) return false;
        const plafond = reglage('abo.duels_classes_jour');
        if (plafond > 0 && (await lireSocle()).classes + mission.cible > plafond) return false;
        return surLaJournee(seJoue);
      }
      case 'match_du_jour':
        return surLaJournee(seJoue);
      case 'club_joue': {
        const { suivis } = await lireSocle();
        if (!suivis.size) return false;
        return surLaJournee((matchs) => matchs.some((x) => SE_JOUE.has(x.status)
          && (suivis.has(Number(x.home?.id)) || suivis.has(Number(x.away?.id)))));
      }
      case 'avant_seconde_mi_temps':
        return surLaJournee((matchs) => matchs.some((x) => AVANT_MT2.has(x.status)));
      case 'deux_competitions':
        return surLaJournee((matchs) => new Set(matchs
          .filter((x) => SE_JOUE.has(x.status) && x.leagueId != null)
          .map((x) => x.leagueId)).size >= 2);
      case 'grandir': return unFanzzyPeutGrandir();
      default: return false;
    }
  }

  return { faisable, lireSocle };
}

/** `GROUP_CONCAT(team_id)` → un ensemble d'entiers. */
export function suivisDe(texte) {
  return new Set(String(texte ?? '').split(',').filter(Boolean).map(Number)
    .filter(Number.isInteger));
}
