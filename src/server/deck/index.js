import express from 'express';
import { ACTIONS, ACTION_BY_ID, DECK_RULES, validerDeck } from '../../shared/duel/actions.js';
import { parIdentifiant, racineDe, lignee } from '../fanzzy/catalogue.js';
import { STUFF_BY_ID, combine } from '../../shared/fanzzy/inventaire.js';
import { jourISO } from '../../shared/jour.js';

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

export function createDecks({ pool, requireAuth, niveau = null }) {
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
   * âges désigne encore « V2 ». On le ramène à son personnage à la lecture
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
    if (!rows.length) throw fail('duel.error.fixture_unknown');
    const f = rows[0];

    // jourISO et pas String(...).slice(0, 10) : voir src/shared/jour.js. La
    // seconde forme comparait des noms de jours de la semaine et refusait un
    // match à venir comme s'il était passé.
    const jour = jourISO(f.jour);
    const auj = jourISO(f.aujourdhui);
    const enCours = LIVE.includes(f.status_short);
    const termine = ['FT', 'AET', 'PEN'].includes(f.status_short);

    // Un match terminé, ou d'un jour passé : refusé. On ne rejoue pas une
    // soirée qu'on n'a pas vécue.
    if (termine || jour < auj) throw fail('duel.error.fixture_past');

    const mode = (jour === auj || enCours) ? 'classe' : 'entrainement';

    const mien = userId ? (await q(
      `SELECT 1 FROM user_follows WHERE user_id = ? AND team_id IN (?, ?) LIMIT 1`,
      [userId, f.home_id, f.away_id])).length > 0 : false;
    return {
      fixture: {
        id: f.id, jour, status: f.status_short, elapsed: f.elapsed,
        kickoffAt: f.kickoff_at, league: f.league_name,
        home: { id: f.home_id, name: f.home_name, logo: f.home_logo },
        away: { id: f.away_id, name: f.away_name, logo: f.away_logo },
      },
      mode,
      enCours,
      // L'explication est renvoyée au client : il ne doit pas avoir à deviner
      // pourquoi un duel ne compte pas.
      raison: mode === 'classe'
        ? (enCours ? 'Le match est en cours : ce duel comptera au classement.'
                   : 'Match du jour : ce duel comptera au classement.')
        : 'Match à venir : entraînement, sans effet sur le classement.',
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

    // Les clubs suivis, une fois pour toute la liste. Avec `tous=1` elle peut
    // contenir soixante matchs, et une requête par ligne pour lire une table de
    // deux entrées serait absurde.
    const mesClubs = new Set((await q(
      `SELECT team_id FROM user_follows WHERE user_id = ?`, [userId])).map((r) => r.team_id));

    return rows.map((f) => ({
      ...f,
      enCours: LIVE.includes(f.status_short),
      mode: (f.aujourdhui || LIVE.includes(f.status_short)) ? 'classe' : 'entrainement',
      // Pousser pour son club rapporte le double. Le dire **avant** le choix :
      // une règle qu'on ne découvre qu'en lisant son solde après coup ne pèse
      // sur aucune décision, et c'est pourtant là qu'elle doit peser.
      mien: mesClubs.has(f.home_id) || mesClubs.has(f.away_id),
    }));
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

  router.get('/loadout', requireAuth, safe(async (req, res) =>
    res.json((await loadout(req.user.id)) ?? { error: 'deck.error.none' })));

  router.get('/matchs', requireAuth, safe(async (req, res) =>
    res.json({ matchs: await matchsProposables(req.user.id,
      { tousLesClubs: req.query.tous === '1' }) })));

  router.get('/match/:id', requireAuth, safe(async (req, res) =>
    res.json(await matchSupport(Number(req.params.id), req.user.id))));

  return { router, deckDe, loadout, enregistrer, matchSupport, matchsProposables, possessions };
}
