/**
 * Le pronostic : le score qu'on attend d'un match de son club.
 *
 * ## La règle
 *
 * Avant le coup d'envoi d'un match où joue un club qu'il suit, le joueur donne
 * un score. Il peut le changer tant que le match n'a pas commencé. Au coup de
 * sifflet final :
 *
 *   — le score exact rapporte `prono.exact_echarpes` (50 au départ) ;
 *   — sinon, le bon vainqueur, ou le bon nul, rapporte
 *     `prono.vainqueur_echarpes` (15) ;
 *   — sinon, rien. Et rien n'est perdu non plus.
 *
 * Le score qui compte est celui que le relevé range dans `fixtures` à la fin
 * du match : prolongations comprises, tirs au but non compris (c'est ce que
 * l'API appelle les buts du match).
 *
 * ## Pourquoi sans mise
 *
 * Le dossier juridique tient sur une idée : un gain gratuit, sans mise, ne
 * crée pas de jeu d'argent (`JURIDIQUE.md`, `serveur/RISQUES.md` § 6). Une
 * mise d'écharpes sur l'issue d'un vrai match, alors que l'abonnement fait
 * gagner plus d'écharpes par la bande, ressemblerait à un pari sportif.
 * Gaël a choisi la version gratuite le 6 octobre 2026. Ce module ne débite
 * donc jamais rien : il ne fait que verser.
 *
 * ## Pourquoi seulement les clubs suivis
 *
 * Le pronostic rapporte : ouvert à tous les matchs du monde, il se jouerait à
 * la chaîne, cent pronostics par jour pour en toucher quarante. Borné aux
 * clubs suivis (dont le nombre est lui-même plafonné), il reste ce qu'il doit
 * être : le petit rituel d'avant-match de son club. Le disjoncteur du grand
 * livre borne le reste.
 *
 * ## Le règlement
 *
 * Il passe par le grand livre (`recompenses.js`, source `prono`, clé
 * l'identifiant du match), qui garantit qu'un pronostic ne paie qu'une fois,
 * même réglé par deux chemins à la fois. Deux chemins, justement :
 *
 *   — **au coup de sifflet final**, `regler(fixtureId)`, appelé par le relevé
 *     du football (`onFinished`), règle tous les pronostics du match ;
 *   — **à la lecture**, chaque route règle ce qu'elle montre et qui ne l'a pas
 *     été. C'est le filet : l'annonce de fin de match vit en mémoire et se
 *     perd à un redémarrage, et un versement retenu par le disjoncteur du jour
 *     doit pouvoir passer le lendemain.
 *
 * Les colonnes `issue`, `echarpes` et `regle_a` de `pronostics` ne retiennent
 * que le fait que le règlement a eu lieu, pour ne pas le refaire à chaque
 * lecture. Ce n'est pas elles qui protègent du double versement.
 */
import express from 'express';
import { verser } from '../recompenses.js';
import { reglage } from '../../shared/reglages.js';

const FINIS = new Set(['FT', 'AET', 'PEN']);

/** Au-delà, ce n'est plus un pronostic, c'est une faute de frappe. */
export const BUTS_MAX = 20;

const SCHEMA_INCOMPLET = new Set(['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR']);

/** Le signe d'un score : 1 victoire à domicile, 0 nul, -1 victoire à l'extérieur. */
const signe = (h, a) => Math.sign(h - a);

/**
 * Ce qu'un pronostic vaut face au score final. Pure : la suite l'éprouve sans
 * base.
 *
 * @returns 'exact' | 'vainqueur' | 'rate'
 */
export function issueDe(prono, final) {
  if (prono.home === final.home && prono.away === final.away) return 'exact';
  if (signe(prono.home, prono.away) === signe(final.home, final.away)) return 'vainqueur';
  return 'rate';
}

/** Les écharpes d'une issue, aux réglages du moment. */
export function gainDe(issue) {
  if (issue === 'exact') return reglage('prono.exact_echarpes');
  if (issue === 'vainqueur') return reglage('prono.vainqueur_echarpes');
  return 0;
}

const entierDeButs = (v) => {
  const n = typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : v;
  return Number.isInteger(n) && n >= 0 && n <= BUTS_MAX ? n : null;
};

export function createPronostics({ pool, requireAuth }) {
  const q = async (sql, params = []) => (await pool.execute(sql, params))[0];

  /** Le match tel que le relevé l'a rangé, ou `null`. */
  async function match(fixtureId) {
    const [f] = await q(
      `SELECT f.id, f.home_id, f.away_id, f.home_goals, f.away_goals, f.status_short,
              f.kickoff_at, f.kickoff_at > UTC_TIMESTAMP() AS avenir
         FROM fixtures f WHERE f.id = ?`, [fixtureId]);
    return f ?? null;
  }

  const estFini = (f) => f && FINIS.has(f.status_short)
    && f.home_goals != null && f.away_goals != null;

  /**
   * Règle un pronostic sur un match fini. Rend le règlement posé, ou `null`
   * s'il n'a pas pu l'être (match pas fini, pronostic éteint, disjoncteur,
   * schéma) : il sera retenté à la prochaine lecture.
   */
  async function reglerUn(userId, p, f) {
    if (!estFini(f) || p.regle_a != null) return null;
    if (!reglage('prono.actif')) return null;
    const issue = issueDe({ home: Number(p.home_goals), away: Number(p.away_goals) },
      { home: Number(f.home_goals), away: Number(f.away_goals) });
    let echarpes = gainDe(issue);
    if (echarpes > 0) {
      const r = await verser(pool, {
        userId, source: 'prono', cle: String(f.id), saisonId: null, gain: { echarpes },
      });
      if (!r.verse && r.raison !== 'deja') return null;
      /* Déjà versé par l'autre chemin : on retient ce que le grand livre a
         réellement versé, pas ce que le réglage dirait aujourd'hui. */
      if (!r.verse) {
        const [l] = await q(
          `SELECT echarpes FROM recompenses WHERE user_id = ? AND source = 'prono' AND cle = ?`,
          [userId, String(f.id)]);
        echarpes = Number(l?.echarpes ?? echarpes);
      }
    }
    await q(
      `UPDATE pronostics SET issue = ?, echarpes = ?, regle_a = CURRENT_TIMESTAMP(3)
        WHERE user_id = ? AND fixture_id = ? AND regle_a IS NULL`,
      [issue, echarpes, userId, f.id]);
    return { issue, echarpes };
  }

  /** Tous les pronostics d'un match qui vient de finir. */
  async function regler(fixtureId) {
    let f;
    let lignes;
    try {
      f = await match(fixtureId);
      if (!estFini(f)) return 0;
      lignes = await q(
        'SELECT user_id, home_goals, away_goals, regle_a FROM pronostics '
        + 'WHERE fixture_id = ? AND regle_a IS NULL', [fixtureId]);
    } catch (e) {
      if (SCHEMA_INCOMPLET.has(e?.code)) return 0;
      throw e;
    }
    let n = 0;
    for (const p of lignes) {
      try { if (await reglerUn(p.user_id, p, f)) n++; }
      catch (e) { console.error('[prono] règlement', fixtureId, e.message); }
    }
    return n;
  }

  /**
   * Ce qu'un joueur peut faire sur un match : `{ ouvert, raison? }`.
   * `raison` : `inactif`, `inconnu` (le relevé ne connaît pas ce match),
   * `pas_suivi`, `commence`.
   */
  async function porte(userId, f) {
    if (!reglage('prono.actif')) return { ouvert: false, raison: 'inactif' };
    if (!f) return { ouvert: false, raison: 'inconnu' };
    const [s] = await q(
      'SELECT 1 AS ok FROM user_follows WHERE user_id = ? AND team_id IN (?, ?) LIMIT 1',
      [userId, f.home_id, f.away_id]);
    if (!s) return { ouvert: false, raison: 'pas_suivi' };
    if (f.status_short !== 'NS' || !Number(f.avenir)) return { ouvert: false, raison: 'commence' };
    return { ouvert: true };
  }

  const vueDu = (p) => p ? {
    home: Number(p.home_goals), away: Number(p.away_goals),
    ...(p.regle_a != null ? { issue: p.issue, echarpes: Number(p.echarpes ?? 0) } : {}),
  } : null;

  const gains = () => ({
    vainqueur: reglage('prono.vainqueur_echarpes'),
    exact: reglage('prono.exact_echarpes'),
  });

  /* -------------------------------------------------------------- routes */

  const router = express.Router();
  router.use(express.json({ limit: '2kb' }));

  const idDe = (req) => {
    const n = Number(req.params.id);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  /** Le pronostic d'un match : ce qu'on a donné, et si on peut encore le donner. */
  router.get('/match/:id', requireAuth, async (req, res) => {
    const id = idDe(req);
    if (!id) return res.status(400).json({ error: 'prono.error.match_invalide' });
    try {
      const f = await match(id);
      const [p] = await q(
        'SELECT home_goals, away_goals, issue, echarpes, regle_a FROM pronostics '
        + 'WHERE user_id = ? AND fixture_id = ?', [req.user.id, id]);
      let vue = vueDu(p);
      if (p && p.regle_a == null && estFini(f)) {
        const r = await reglerUn(req.user.id, p, f);
        if (r) vue = { ...vue, ...r };
      }
      res.json({ ...(await porte(req.user.id, f)), prono: vue, gains: gains() });
    } catch (e) {
      if (SCHEMA_INCOMPLET.has(e?.code)) return res.json({ ouvert: false, raison: 'schema', prono: null });
      console.error('[prono] lecture', e.message);
      res.status(500).json({ error: 'prono.error.lecture' });
    }
  });

  /** Donner, ou changer, son pronostic. Jusqu'au coup d'envoi seulement. */
  router.post('/match/:id', requireAuth, async (req, res) => {
    const id = idDe(req);
    if (!id) return res.status(400).json({ error: 'prono.error.match_invalide' });
    const home = entierDeButs(req.body?.home);
    const away = entierDeButs(req.body?.away);
    if (home == null || away == null) return res.status(400).json({ error: 'prono.error.score_invalide' });
    try {
      const f = await match(id);
      const p = await porte(req.user.id, f);
      if (!p.ouvert) return res.status(409).json({ error: `prono.error.${p.raison}`, ...p });
      await q(
        `INSERT INTO pronostics (user_id, fixture_id, home_goals, away_goals) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE home_goals = VALUES(home_goals), away_goals = VALUES(away_goals)`,
        [req.user.id, id, home, away]);
      res.json({ ouvert: true, prono: { home, away }, gains: gains() });
    } catch (e) {
      if (SCHEMA_INCOMPLET.has(e?.code)) return res.status(503).json({ error: 'prono.error.schema' });
      console.error('[prono] écriture', e.message);
      res.status(500).json({ error: 'prono.error.ecriture' });
    }
  });

  /** Mes derniers pronostics, réglés au passage s'ils peuvent l'être. */
  router.get('/', requireAuth, async (req, res) => {
    try {
      const lignes = await q(
        `SELECT p.fixture_id, p.home_goals, p.away_goals, p.issue, p.echarpes, p.regle_a,
                f.id, f.home_id, f.away_id, f.home_goals AS f_home, f.away_goals AS f_away,
                f.status_short, f.kickoff_at, th.name AS home_name, ta.name AS away_name
           FROM pronostics p
           LEFT JOIN fixtures f ON f.id = p.fixture_id
           LEFT JOIN teams th ON th.id = f.home_id
           LEFT JOIN teams ta ON ta.id = f.away_id
          WHERE p.user_id = ?
          ORDER BY f.kickoff_at DESC LIMIT 20`, [req.user.id]);
      const out = [];
      for (const l of lignes) {
        let vue = vueDu(l);
        const f = l.id == null ? null : { id: l.id, home_goals: l.f_home, away_goals: l.f_away,
          status_short: l.status_short };
        if (l.regle_a == null && estFini(f)) {
          const r = await reglerUn(req.user.id, l, f);
          if (r) vue = { ...vue, ...r };
        }
        out.push({
          match: { id: l.fixture_id, coupDEnvoi: l.kickoff_at, statut: l.status_short ?? null,
            domicile: l.home_name ?? null, exterieur: l.away_name ?? null,
            score: estFini(f) ? { home: Number(f.home_goals), away: Number(f.away_goals) } : null },
          prono: vue,
        });
      }
      res.json({ pronostics: out, gains: gains() });
    } catch (e) {
      if (SCHEMA_INCOMPLET.has(e?.code)) return res.json({ pronostics: [], raison: 'schema' });
      console.error('[prono] liste', e.message);
      res.status(500).json({ error: 'prono.error.lecture' });
    }
  });

  return { router, regler };
}
