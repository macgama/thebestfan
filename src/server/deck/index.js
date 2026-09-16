import express from 'express';
import { ACTIONS, ACTION_BY_ID, DECK_RULES, validerDeck } from '../../shared/duel/actions.js';
import { parIdentifiant, racineDe, lignee } from '../fanzzy/catalogue.js';
import { STUFF_BY_ID, combine } from '../../shared/fanzzy/inventaire.js';
import { jourISO } from '../../shared/jour.js';
// Le club qu'on soutient dans une rencontre, et de quel côté il joue :
// la même règle qu'au Virage et qu'au Duel, écrite une seule fois.
import { clubParmi, campDe } from '../football/suivis.js';
// La journée du football : la seule source complète de ce qui se joue
// aujourd'hui. La table `fixtures` ne connaît que les clubs suivis.
import { journeeParId, TERMINE } from '../football/journee.js';
import { PALIERS } from '../../shared/niveau.js';

/**
 * Le palier qui ouvrira l'emplacement de tribune suivant.
 *
 * L'écran affichait deux rangs à un joueur de niveau 1 sans jamais lui dire
 * pourquoi — ni qu'un troisième existe, ni quand il arrive. Une limite qu'on
 * subit sans l'expliquer passe pour un bug ; expliquée, elle devient un but.
 *
 * Le calcul vit ici et pas dans la page : la table des paliers est déjà la
 * seule source de cette règle, et la recopier côté client donnerait une
 * deuxième vérité à tenir à jour.
 */
function prochainPalierFanzzy(actuel) {
  const p = PALIERS
    .filter((x) => x.deckFanzzy && x.deckFanzzy > actuel)
    .sort((a, b) => a.niveau - b.niveau)[0];
  return p ? { niveau: p.niveau, places: p.deckFanzzy } : null;
}

/**
 * Decks et choix du match support.
 *
 * Deux règles structurent tout :
 *
 * **Le deck est validé par le serveur, jamais par le client.** Un client
 * modifié enverrait trois couronnes et vingt cartes ; ici on vérifie que
 * chaque Fanzzy, chaque pièce et chaque carte appartient réellement au joueur.
 *
 * **Le match support décide de ce que vaut le duel.** Un match du jour ou en
 * cours donne un duel classé, qui compte au classement. Un match d'un autre
 * jour donne un entraînement, qui ne compte pas. Un match passé est refusé :
 * on ne rejoue pas une soirée qu'on n'a pas vécue, sinon les souvenirs et les
 * classements ne veulent plus rien dire.
 */

export const FORMATS = { '1v1': 1, '2v2': 2, '3v3': 3, '4v4': 4, '5v5': 5 };
const LIVE = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];

export function createDecks({ pool, requireAuth, niveau = null,
                             /* Posée après coup par server.js : le télétexte
                                se monte après les decks. Absente, on retombe
                                sur la base — incomplète, jamais rien. */
                             jourDuFoot = null }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, extra) => Object.assign(new Error(code), { code, extra });

  /* ------------------------------------------------- ce que possède le joueur */

  async function possessions(userId) {
    // Le plafond d’emplacements Fanzzy vient du niveau. Sans module de
    // progression, il vaut la règle — le comportement d’avant, exactement.
    const fanzzyMax = niveau ? (await niveau.droitsDe(userId)).deckFanzzy : DECK_RULES.fanzzy;
    const [fz, st, w] = await Promise.all([
      q(`SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ?`, [userId]),
      q(`SELECT stuff_id FROM user_stuff WHERE user_id = ?`, [userId]),
      q(`SELECT action_cards FROM user_wallet WHERE user_id = ?`, [userId]),
    ]);
    const brut = w[0]?.action_cards;
    const actions = typeof brut === 'string' ? JSON.parse(brut) : (brut ?? []);
    return {
      fanzzy: new Set(fz.map((f) => f.fanzzy_id)),
      fanzzyMax,
      // Jusqu'où chaque personnage a été fait grandir. Ne sert pas à valider —
      // un deck n'exprime plus de stade — mais à avertir le joueur qui a payé
      // une évolution et oublie la carte qui lui donne accès.
      stades: Object.fromEntries(fz.map((f) => [f.fanzzy_id, Number(f.stage)])),
      stuff: new Set(st.map((s) => s.stuff_id)),
      // Les communes sont offertes à tous : sans elles, un joueur qui débute
      // ne pourrait pas remplir ses dix emplacements.
      actions: new Set([...actions, ...ACTIONS.filter((a) => a.rar === 'commune').map((a) => a.id)]),
    };
  }

  /* ------------------------------------------------------------- lecture */

  /**
   * Un deck entre toujours **au premier âge**.
   *
   * C'est la règle du duel : personne n'arrive avec un personnage déjà grandi.
   * Ce qu'un joueur a débloqué en écharpes lui donne le droit de le faire
   * grandir *pendant* la partie, en y consacrant une carte de ses dix. Deux
   * tribunes se rencontrent donc au même niveau, et l'écart se creuse par ce
   * qu'on joue, pas par ce qu'on a payé.
   *
   * D'où la traduction faite ici : un deck enregistré avant le repliage des
   * âges désigne encore « TR32B ». On le ramène à son personnage à la lecture
   * comme à l'écriture — c'est ce qui répare tout seul les decks existants, et
   * ce qui évite d'aller réécrire du JSON en SQL dans la migration.
   */
  const auPremierAge = (deck) => (!deck ? deck : {
    ...deck,
    fanzzy: (deck.fanzzy ?? []).map((f) => ({ ...f, id: racineDe(f.id) })),
  });

  async function deckDe(userId) {
    const rows = await q(
      `SELECT contenu FROM user_decks WHERE user_id = ? AND actif = 1 LIMIT 1`, [userId]);
    if (!rows.length) return null;
    const c = rows[0].contenu;
    return auPremierAge(typeof c === 'string' ? JSON.parse(c) : c);
  }

  /** Le deck déplié : tout ce dont le moteur a besoin, sans relire la base. */
  async function loadout(userId) {
    const deck = await deckDe(userId);
    if (!deck) return null;

    // Jusqu'où chaque personnage a été fait grandir. Le duel ne s'en sert pas
    // pour renforcer qui que ce soit au coup d'envoi — tout le monde entre au
    // premier âge — mais pour savoir **jusqu'où la carte Relève peut aller**.
    const stades = Object.fromEntries((await q(
      `SELECT fanzzy_id, stage FROM user_fanzzy WHERE user_id = ?`, [userId]))
      .map((r) => [r.fanzzy_id, Number(r.stage)]));

    return {
      fanzzy: deck.fanzzy.map((f) => {
        const stuff = f.stuff ?? [];
        // L'équipement suit le personnage à travers ses âges : c'est déjà ce que
        // promet la carte de remplacement, et il serait incompréhensible qu'il
        // tombe au moment précis où le personnage grandit.
        //
        // Les modificateurs sont combinés ici une fois pour toutes, âge par
        // âge : le moteur ne doit pas refaire ce calcul à chaque geste.
        const habiller = (def, i) => ({
          id: f.id, nom: def?.nom, type: def?.type, cri: def?.cri,
          // `stage` sert au dessin : la silhouette procédurale grandit avec
          // l'âge. Sans lui, l'écran de duel dessine un Fanzzy à l'échelle NaN,
          // c'est-à-dire rien du tout.
          stage: i + 1,
          mods: { id: f.id, ...combine(def?.mods ?? {}, stuff) },
        });

        const ages = lignee(f.id);
        const debloque = Math.min(stades[f.id] ?? 1, ages.length);
        const jouables = ages.slice(0, debloque).map(habiller);

        return {
          // Le premier âge est celui qui entre en tribune, toujours.
          ...(jouables[0] ?? habiller(parIdentifiant(f.id), 0)),
          stuff,
          // Le stade **en jeu**. Il démarre à 1 et c'est la Relève qui le fait
          // monter — à ne pas confondre avec `ages.length`, qui dit jusqu'où ce
          // joueur a le droit d'aller.
          stade: 1,
          ages: jouables,
        };
      }),
      actions: deck.actions.map((id) => ACTION_BY_ID.get(id)).filter(Boolean),
      mainVisible: DECK_RULES.mainVisible,
    };
  }

  async function enregistrer(userId, deckBrut) {
    const deck = auPremierAge(deckBrut) ?? deckBrut;
    const possede = await possessions(userId);
    const v = validerDeck(deck, possede);
    if (!v.valide) throw fail('deck.error.invalid', v.problemes);

    const propre = {
      fanzzy: deck.fanzzy.map((f) => ({
        id: f.id,
        stuff: (f.stuff ?? []).slice(0, DECK_RULES.stuffParFanzzy),
      })),
      actions: deck.actions.slice(0, DECK_RULES.actions),
      nom: String(deck.nom ?? 'Mon deck').slice(0, 32),
    };

    await q(
      `INSERT INTO user_decks (user_id, nom, contenu, actif) VALUES (?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE nom = VALUES(nom), contenu = VALUES(contenu), maj = NOW(3)`,
      [userId, propre.nom, JSON.stringify(propre)]);

    return { deck: propre, avertissements: v.avertissements };
  }

  /* ------------------------------------------------------- choix du match */

  /**
   * Décide si un match peut servir de support, et ce que vaut le duel.
   *
   * **La journée l'emporte sur la base.** La table `fixtures` ne connaît que
   * les clubs suivis ; un match qu'elle ignore serait refusé alors qu'il se
   * joue et que la liste vient de le proposer. Voir `football/journee.js`.
   *
   * On compare des jours, pas des heures : un match programmé à 20h45
   * aujourd'hui doit pouvoir être choisi dès le matin.
   */
  async function matchSupport(fixtureId, userId = null) {
    const rows = await q(
      `SELECT f.id, f.status_short, f.kickoff_at, f.elapsed,
              DATE(f.kickoff_at) AS jour, UTC_DATE() AS aujourdhui,
              h.name AS home_name, h.logo AS home_logo, h.id AS home_id,
              a.name AS away_name, a.logo AS away_logo, a.id AS away_id,
              l.name AS league_name
         FROM fixtures f
         JOIN teams h ON h.id = f.home_id
         JOIN teams a ON a.id = f.away_id
         LEFT JOIN leagues l ON l.id = f.league_id
        WHERE f.id = ?`, [fixtureId]);

    const duJour = (await journeeParId(jourDuFoot)).get(Number(fixtureId));
    if (!rows.length && !duJour) throw fail('duel.error.fixture_unknown');

    const base = rows[0] ?? {};
    const auj = new Date().toISOString().slice(0, 10);
    const f = duJour ? {
      id: duJour.id,
      status_short: duJour.status,
      elapsed: duJour.elapsed,
      kickoff_at: duJour.date,
      jour: String(duJour.date).slice(0, 10),
      aujourdhui: auj,
      home_id: duJour.home.id, home_name: duJour.home.name, home_logo: duJour.home.logo,
      away_id: duJour.away.id, away_name: duJour.away.name, away_logo: duJour.away.logo,
      league_name: duJour.leagueName,
    } : base;

    // jourISO et pas String(...).slice(0, 10) : voir src/shared/jour.js. La
    // seconde forme comparait des noms de jours de la semaine et refusait un
    // match à venir comme s'il était passé.
    const jour = jourISO(f.jour);
    const ajd = jourISO(f.aujourdhui);
    const enCours = LIVE.includes(f.status_short);
    const termine = TERMINE.includes(f.status_short);

    // Un match terminé, ou d'un jour passé : refusé. On ne rejoue pas une
    // soirée qu'on n'a pas vécue.
    if (termine || jour < ajd) throw fail('duel.error.fixture_past');

    /* **Classé, c'est en cours.** La règle disait « le match est aujourd'hui »,
       et un duel joué à dix heures du matin comptait pour une rencontre du
       soir : on poussait pour une tribune qui n'existait pas encore. Un duel de
       tribunes se joue pendant le match, sinon il ne se distingue en rien d'un
       entraînement — et c'est exactement ce qu'il devient. */
    const mode = enCours ? 'classe' : 'entrainement';

    /* Le club soutenu, et donc le camp. La page en a besoin **avant**
       l'entrée en file : chez soi le camp est décidé et il n'y a rien à
       demander ; ailleurs, c'est au joueur de dire quelle tribune il vient
       tenir. Lui montrer un choix qu'il n'a pas, ou l'envoyer sans choisir,
       seraient deux façons de lui mentir. */
    const club = userId ? clubParmi(await q(
      `SELECT team_id, is_main FROM user_follows
        WHERE user_id = ? AND team_id IN (?, ?)
        ORDER BY is_main DESC, created_at`,
      [userId, f.home_id, f.away_id]), f.home_id, f.away_id)
      : { teamId: null, neutre: true };
    const mien = !club.neutre;
    return {
      fixture: {
        id: f.id, jour, status: f.status_short, elapsed: f.elapsed,
        kickoffAt: f.kickoff_at, league: f.league_name,
        home: { id: f.home_id, name: f.home_name, logo: f.home_logo },
        away: { id: f.away_id, name: f.away_name, logo: f.away_logo },
      },
      mode,
      enCours,
      monCamp: campDe(club.teamId, f.home_id, f.away_id),
      neutre: club.neutre,
      // L'explication est renvoyée au client : il ne doit pas avoir à deviner
      // pourquoi un duel ne compte pas.
      raison: enCours
        ? 'Le match est en cours : ce duel comptera au classement.'
        : (jour === ajd
          ? 'Le match n’a pas commencé : entraînement, sans effet sur le classement.'
          : 'Match à venir : entraînement, sans effet sur le classement.'),
      // Ce match met-il en jeu un club suivi ? Le duel rapporte alors le
      // double. `userId` est facultatif : appelé sans lui — depuis la file du
      // NvN, qui ne veut que le support du duel — la question ne se pose pas.
      mien,
      ...(mien ? { bonus: 2 } : {}),
    };
  }

  /** Les matchs proposables : aujourd'hui d'abord, puis les jours suivants. */
  async function matchsProposables(userId, { tousLesClubs = false } = {}) {
    const filtre = tousLesClubs ? '' :
      `AND (f.home_id IN (SELECT team_id FROM user_follows WHERE user_id = ?)
         OR f.away_id IN (SELECT team_id FROM user_follows WHERE user_id = ?))`;
    const args = tousLesClubs ? [] : [userId, userId];

    const rows = await q(
      `SELECT f.id, f.status_short, f.elapsed, f.kickoff_at, f.home_goals, f.away_goals,
              DATE(f.kickoff_at) = UTC_DATE() AS aujourdhui,
              f.home_id, f.away_id,
              h.name AS home_name, h.logo AS home_logo,
              a.name AS away_name, a.logo AS away_logo, l.name AS league_name
         FROM fixtures f
         JOIN teams h ON h.id = f.home_id
         JOIN teams a ON a.id = f.away_id
         LEFT JOIN leagues l ON l.id = f.league_id
        WHERE f.status_short NOT IN ('FT','AET','PEN','CANC','PST')
          AND DATE(f.kickoff_at) >= UTC_DATE()
          AND f.kickoff_at < (UTC_TIMESTAMP() + INTERVAL 8 DAY)
          ${filtre}
        ORDER BY aujourdhui DESC, f.kickoff_at
        LIMIT 60`, args);

    /* Triés — le club principal d'abord — parce que c'est cet ordre qui
       départage un derby, et que `clubParmi` compte dessus. */
    const suivis = await q(
      `SELECT team_id, is_main FROM user_follows WHERE user_id = ?
        ORDER BY is_main DESC, created_at`, [userId]);
    const mesClubs = new Set(suivis.map((r) => r.team_id));

    const parId = new Map();
    for (const f of rows) parId.set(Number(f.id), { ...f });

    /* **La journée du football se superpose à la base.**
     *
     * La base ne connaît que les clubs suivis : la liste ignorait la moitié
     * des rencontres en direct, et affichait « classé » sur des matchs dont
     * elle croyait encore qu'ils n'avaient pas commencé. La journée a tout ce
     * qui se joue aujourd'hui, et elle l'a juste ; la base garde les huit
     * prochains jours, qu'elle seule connaît. Voir `football/journee.js`. */
    for (const [id, m] of await journeeParId(jourDuFoot)) {
      /* Un match fini n'est le support de rien : on ne rejoue pas une soirée.
         On l'**efface** au lieu de l'ignorer : la base peut le croire encore en
         cours, et l'ignorer laisserait sa ligne périmée en tête de liste. */
      if (m.fini) { parId.delete(id); continue; }
      parId.set(id, {
        ...parId.get(id),
        id,
        status_short: m.status,
        elapsed: m.elapsed,
        kickoff_at: m.date,
        home_goals: m.home.goals, away_goals: m.away.goals,
        home_id: m.home.id, away_id: m.away.id,
        home_name: m.home.name, home_logo: m.home.logo,
        away_name: m.away.name, away_logo: m.away.logo,
        league_name: m.leagueName,
        tier: m.tier,
      });
    }

    const liste = [...parId.values()].map((f) => {
      const club = clubParmi(suivis, f.home_id, f.away_id);
      const enCours = LIVE.includes(f.status_short);
      return {
        ...f,
        enCours,
        /* **Classé, c'est en cours.** Voir `matchSupport`, qui applique la
           même règle — et qui fait autorité, puisque c'est lui qui décide au
           moment de l'entrée en file. */
        mode: enCours ? 'classe' : 'entrainement',
        // Pousser pour son club rapporte le double. Le dire **avant** le choix :
        // une règle qu'on ne découvre qu'en lisant son solde après coup ne pèse
        // sur aucune décision, et c'est pourtant là qu'elle doit peser.
        mien: !club.neutre,
        // Et de quel côté : la page en fait un camp imposé ou un choix.
        monCamp: campDe(club.teamId, f.home_id, f.away_id),
      };
    });

    /* L'ordre, maintenant que la liste couvre le monde entier. Ce qui se joue
       d'abord — c'est ce qu'on vient chercher — puis mes clubs, puis les
       grandes compétitions, puis l'heure. Trié par heure seule, une finale de
       Ligue des champions se retrouvait derrière un championnat U19. */
    liste.sort((a, b) =>
      (b.enCours - a.enCours) || (b.mien - a.mien)
      || ((a.tier ?? 3) - (b.tier ?? 3))
      || (new Date(a.kickoff_at) - new Date(b.kickoff_at)));

    const visibles = tousLesClubs ? liste : liste.filter((f) => f.mien);

    /* Soixante, comme avant : la requête s'arrêtait là, et la journée pourrait
       en ajouter trois cents un samedi soir. Ce qui se joue est en tête, donc
       ce qui tombe est ce qu'on n'allait pas choisir de toute façon. */
    return visibles.slice(0, 60);  }


  /* ------------------------------------------------- placer depuis la fiche

     La fiche d'un Fanzzy porte un bouton « EMMENER EN DUEL ». Il écrivait
     `user_wallet.active_fanzzy` — c'est-à-dire **l'avatar**, celui que voient
     les amis et l'accueil. Le personnage n'entrait pas en duel pour autant, et
     la fiche affichait ensuite « DÉJÀ EN DUEL » sur quelqu'un qui n'était dans
     aucun deck. Le bouton disait une chose et en faisait une autre.

     Il fait maintenant ce qu'il dit, et il demande **où** : un deck a un
     titulaire, celui qui entre au coup d'envoi, et des remplaçants que la carte
     Changement fait entrer. Ce n'est pas la même décision, et la fiche ne peut
     pas la prendre à la place du joueur.

     Le reste du deck n'est pas touché : les pièces des autres rangs, les dix
     cartes d'action et le nom restent exactement où ils sont.
  */
  async function placer(userId, { id: brut, place: placeBrute }) {
    const id = racineDe(String(brut ?? ''));
    if (!parIdentifiant(id)) throw fail('deck.error.fanzzy_unknown');

    const possede = await possessions(userId);
    if (!possede.fanzzy.has(id)) throw fail('deck.error.fanzzy_not_owned', { id });

    const places = Math.min(DECK_RULES.fanzzy, possede.fanzzyMax);
    /* `typeof === 'number'` avant tout le reste, et ce n'est pas de la
       pédanterie : `Number(null)`, `Number('')`, `Number(false)` et `Number([])`
       valent tous **zéro**. Un appel sans place, ou avec une place vide, aurait
       donc nommé un titulaire en silence — en sortant celui qui y était.
       C'est le contraire exact de ce que la question « titulaire ou
       remplaçant ? » est là pour obtenir. */
    const place = typeof placeBrute === 'number' ? placeBrute
      : (typeof placeBrute === 'string' && placeBrute.trim() !== '' ? Number(placeBrute) : NaN);
    if (!Number.isInteger(place) || place < 0 || place >= places) {
      throw fail('deck.error.place_hors_deck', { place: placeBrute, places });
    }

    const deck = (await deckDe(userId)) ?? { fanzzy: [], actions: [], nom: 'Mon deck' };
    const rangs = [...(deck.fanzzy ?? [])];

    /* **Le trou au milieu.** Placer en remplaçant 2 quand le remplaçant 1 est
       vide laisserait un trou dans la liste, et le premier rang non vide n'est
       plus le titulaire — c'est `loadout` qui décide, et il lit `fanzzy[0]`.
       On comble donc les places manquantes… avec quoi ? Rien. Alors on refuse,
       et la page n'ouvre ce choix que sur une place atteignable. */
    if (place > rangs.length) throw fail('deck.error.place_vide_avant', { place });

    /* Un personnage déjà au deck qu'on place ailleurs **se déplace**, il ne se
       duplique pas : `validerDeck` refuse les doublons, et le joueur qui glisse
       son titulaire en remplaçant veut à l'évidence l'y déplacer. Il emporte son
       équipement avec lui — c'est le sien. */
    const dejaLa = rangs.findIndex((f) => f.id === id);
    const sortant = rangs[place] ?? null;
    const entrant = dejaLa >= 0 ? rangs[dejaLa] : { id, stuff: [] };

    if (dejaLa >= 0 && dejaLa !== place) {
      /* L'échange plutôt que le décalage : sans lui, déplacer le titulaire en
         remplaçant laisserait le rang 0 vide et le deck invalide. Les deux
         personnages échangent leur place, équipement compris. */
      rangs[dejaLa] = sortant ?? null;
      if (!sortant) rangs.splice(dejaLa, 1);
    }
    rangs[place] = entrant;

    const propre = { ...deck, fanzzy: rangs.filter(Boolean) };
    const r = await enregistrer(userId, propre);
    return {
      ...r,
      place,
      // Qui a cédé sa place, pour que l'écran puisse le dire plutôt que de
      // laisser le joueur s'apercevoir plus tard qu'il a perdu un rang.
      remplace: sortant && sortant.id !== id ? sortant.id : null,
    };
  }

  /* -------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '16kb' }));
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    if (!res.headersSent) {
      res.status(400).json({ error: e.code ?? 'deck.error.server', detail: e.extra });
    }
  });

  /** Catalogue et règles : tout ce qu'il faut pour construire l'écran de deck. */
  router.get('/catalogue', (_req, res) => {
    res.set('cache-control', 'public, max-age=3600');
    res.json({ actions: ACTIONS, regles: DECK_RULES, formats: Object.keys(FORMATS) });
  });

  router.get('/mien', requireAuth, safe(async (req, res) => {
    const [deck, possede] = await Promise.all([deckDe(req.user.id), possessions(req.user.id)]);
    res.json({
      deck,
      possede: {
        fanzzy: [...possede.fanzzy],
        // Le plafond du moment : la page affiche autant de rangs, ni plus
        // ni moins. Le lui faire déduire du niveau serait une seconde règle
        // à tenir à jour, et elle divergerait.
        fanzzyMax: possede.fanzzyMax,
        // Et à quel niveau le suivant s'ouvre, pour que l'écran puisse le dire
        // au lieu de laisser croire à une limite arbitraire. `null` quand il
        // n'y a plus rien à ouvrir.
        fanzzyProchain: prochainPalierFanzzy(possede.fanzzyMax),
        // Le stade atteint par personnage : la page en a besoin pour avertir
        // celui qui aligne un Fanzzy évolué sans embarquer de Relève.
        stades: possede.stades,
        stuff: [...possede.stuff],
        actions: [...possede.actions],
      },
      regles: DECK_RULES,
    });
  }));

  router.put('/mien', requireAuth, safe(async (req, res) =>
    res.json(await enregistrer(req.user.id, req.body ?? {}))));

  /** Poser un Fanzzy à une place précise, depuis sa fiche. Voir `placer`. */
  router.post('/placer', requireAuth, safe(async (req, res) =>
    res.json(await placer(req.user.id, req.body ?? {}))));

  router.get('/loadout', requireAuth, safe(async (req, res) =>
    res.json((await loadout(req.user.id)) ?? { error: 'deck.error.none' })));

  router.get('/matchs', requireAuth, safe(async (req, res) =>
    res.json({ matchs: await matchsProposables(req.user.id,
      { tousLesClubs: req.query.tous === '1' }) })));

  router.get('/match/:id', requireAuth, safe(async (req, res) =>
    res.json(await matchSupport(Number(req.params.id), req.user.id))));

  return { router, deckDe, loadout, enregistrer, placer, matchSupport, matchsProposables,
    possessions };
}
