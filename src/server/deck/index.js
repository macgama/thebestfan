import express from 'express';
import { ACTIONS, ACTION_BY_ID, DECK_RULES, validerDeck } from '../../shared/duel/actions.js';
import { BY_ID as FANZZY_BY_ID } from '../../shared/fanzzy/dex.js';
import { STUFF_BY_ID, combine } from '../../shared/fanzzy/inventaire.js';

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

export function createDecks({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };
  const fail = (code, extra) => Object.assign(new Error(code), { code, extra });

  /* ------------------------------------------------- ce que possède le joueur */

  async function possessions(userId) {
    const [fz, st, w] = await Promise.all([
      q(`SELECT fanzzy_id FROM user_fanzzy WHERE user_id = ?`, [userId]),
      q(`SELECT stuff_id FROM user_stuff WHERE user_id = ?`, [userId]),
      q(`SELECT action_cards FROM user_wallet WHERE user_id = ?`, [userId]),
    ]);
    const brut = w[0]?.action_cards;
    const actions = typeof brut === 'string' ? JSON.parse(brut) : (brut ?? []);
    return {
      fanzzy: new Set(fz.map((f) => f.fanzzy_id)),
      stuff: new Set(st.map((s) => s.stuff_id)),
      // Les communes sont offertes à tous : sans elles, un joueur qui débute
      // ne pourrait pas remplir ses dix emplacements.
      actions: new Set([...actions, ...ACTIONS.filter((a) => a.rar === 'd1').map((a) => a.id)]),
    };
  }

  /* ------------------------------------------------------------- lecture */

  async function deckDe(userId) {
    const rows = await q(
      `SELECT contenu FROM user_decks WHERE user_id = ? AND actif = 1 LIMIT 1`, [userId]);
    if (!rows.length) return null;
    const c = rows[0].contenu;
    return typeof c === 'string' ? JSON.parse(c) : c;
  }

  /** Le deck déplié : tout ce dont le moteur a besoin, sans relire la base. */
  async function loadout(userId) {
    const deck = await deckDe(userId);
    if (!deck) return null;
    return {
      fanzzy: deck.fanzzy.map((f) => {
        const def = FANZZY_BY_ID.get(f.id);
        return {
          id: f.id, nom: def?.nom, type: def?.type, cri: def?.cri,
          stuff: f.stuff ?? [],
          // Les modificateurs sont calculés une fois pour toutes : le moteur
          // ne doit pas refaire ce calcul à chaque geste.
          mods: { id: f.id, ...combine(def?.mods ?? {}, f.stuff ?? []) },
        };
      }),
      actions: deck.actions.map((id) => ACTION_BY_ID.get(id)).filter(Boolean),
      mainVisible: DECK_RULES.mainVisible,
    };
  }

  async function enregistrer(userId, deck) {
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
  async function matchSupport(fixtureId) {
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

    const jour = String(f.jour).slice(0, 10);
    const auj = String(f.aujourdhui).slice(0, 10);
    const enCours = LIVE.includes(f.status_short);
    const termine = ['FT', 'AET', 'PEN'].includes(f.status_short);

    // Un match terminé, ou d'un jour passé : refusé. On ne rejoue pas une
    // soirée qu'on n'a pas vécue.
    if (termine || jour < auj) throw fail('duel.error.fixture_past');

    const mode = (jour === auj || enCours) ? 'classe' : 'entrainement';
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

    return rows.map((f) => ({
      ...f,
      enCours: LIVE.includes(f.status_short),
      mode: (f.aujourdhui || LIVE.includes(f.status_short)) ? 'classe' : 'entrainement',
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
    res.json(await matchSupport(Number(req.params.id)))));

  return { router, deckDe, loadout, enregistrer, matchSupport, matchsProposables, possessions };
}
