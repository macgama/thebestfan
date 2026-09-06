import express from 'express';

/**
 * Les classements.
 *
 * Trois échelles, et elles ne récompensent pas la même chose :
 *
 *   — les supporters, sur la ferveur donnée dans le Grand Virage. C'est du
 *     temps et de la justesse, pas de la collection : un joueur qui n'a jamais
 *     ouvert un booster peut être premier.
 *   — les tribunes, c'est-à-dire les clubs classés par la ferveur cumulée de
 *     leurs supporters, ramenée à leur nombre. Sans cette division, le plus
 *     gros club gagnerait toujours et personne ne défendrait le sien.
 *   — les duellistes, sur les duels gagnés, entraînements exclus.
 *
 * Tout est calculé par agrégation et mis en cache : un classement n'a pas
 * besoin d'être exact à la seconde, et une requête lourde toutes les cinq
 * minutes vaut mieux que la même à chaque affichage.
 */

const TTL_MS = 5 * 60 * 1000;

export function createClassements({ pool, requireAuth }) {
  const q = async (sql, params = []) => {
    const [rows] = await pool.execute(sql, params);
    return rows;
  };

  const cache = new Map();
  async function memo(cle, fn) {
    const hit = cache.get(cle);
    if (hit && Date.now() < hit.expire) return hit.valeur;
    const valeur = await fn();
    cache.set(cle, { valeur, expire: Date.now() + TTL_MS });
    return valeur;
  }

  /** Fenêtre : la saison en cours, ou les trente derniers jours. */
  const depuis = (periode) => (periode === 'mois'
    ? 'AND vp.last_push_at > (NOW(3) - INTERVAL 30 DAY)' : '');

  /* -------------------------------------------------------- supporters */

  async function supporters(periode = 'saison', limite = 50) {
    return memo(`sup:${periode}:${limite}`, () => q(
      `SELECT u.public_id, u.pseudo,
              SUM(vp.ferveur) AS ferveur,
              COUNT(DISTINCT vp.fixture_id) AS matchs,
              (SELECT COUNT(*) FROM user_souvenirs us
                WHERE us.user_id = u.public_id AND us.kind = 'presence') AS vecus,
              (SELECT t.name FROM user_follows f JOIN teams t ON t.id = f.team_id
                WHERE f.user_id = u.public_id ORDER BY f.is_main DESC LIMIT 1) AS club
         FROM virage_presence vp
         JOIN users u ON u.public_id = vp.user_id
        WHERE u.status = 'active' ${depuis(periode)}
        GROUP BY u.public_id, u.pseudo
        ORDER BY ferveur DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* ----------------------------------------------------------- tribunes */

  /**
   * Les clubs, classés sur la ferveur moyenne par supporter.
   * Un petit club dont trente fidèles chantent juste passe devant un géant
   * dont mille abonnés regardent — c'est exactement ce qu'on veut célébrer.
   */
  async function tribunes(limite = 50) {
    return memo(`trib:${limite}`, () => q(
      `SELECT t.id, t.name, t.logo, t.country,
              COUNT(DISTINCT f.user_id) AS supporters,
              COALESCE(SUM(vp.ferveur), 0) AS ferveur,
              ROUND(COALESCE(SUM(vp.ferveur), 0) / GREATEST(COUNT(DISTINCT f.user_id), 1)) AS moyenne
         FROM user_follows f
         JOIN teams t ON t.id = f.team_id
         LEFT JOIN virage_presence vp ON vp.user_id = f.user_id
         GROUP BY t.id, t.name, t.logo, t.country
        HAVING supporters >= 1
        ORDER BY moyenne DESC, ferveur DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* -------------------------------------------------------- duellistes */

  async function duellistes(limite = 50) {
    return memo(`duel:${limite}`, () => q(
      `SELECT u.public_id, u.pseudo,
              SUM(dr.outcome = 'win') AS gagnes,
              COUNT(*) AS joues,
              ROUND(100 * SUM(dr.outcome = 'win') / COUNT(*)) AS taux
         FROM duel_results dr
         JOIN users u ON u.public_id = dr.user_id
        WHERE u.status = 'active'
        GROUP BY u.public_id, u.pseudo
       HAVING joues >= 3
        ORDER BY gagnes DESC, taux DESC
        LIMIT ${Number(limite) || 50}`));
  }

  /* ------------------------------------------------------------- ma place */

  /**
   * Le rang d'un joueur, calculé à part.
   * Le voir dans une liste de cinquante n'a d'intérêt que si on y figure ;
   * pour tous les autres, savoir qu'on est 312e sur 1 400 vaut mieux que rien.
   */
  async function maPlace(userId) {
    const [ferveur] = await q(
      `SELECT COALESCE(SUM(ferveur), 0) AS f, COUNT(DISTINCT fixture_id) AS m
         FROM virage_presence WHERE user_id = ?`, [userId]);

    const [rang] = await q(
      `SELECT COUNT(*) + 1 AS rang FROM (
         SELECT user_id, SUM(ferveur) AS f FROM virage_presence GROUP BY user_id
       ) x WHERE x.f > ?`, [ferveur.f]);

    const [total] = await q(
      `SELECT COUNT(DISTINCT user_id) AS n FROM virage_presence`);

    const [duels] = await q(
      `SELECT SUM(outcome = 'win') AS gagnes, COUNT(*) AS joues
         FROM duel_results WHERE user_id = ?`, [userId]);

    return {
      ferveur: Number(ferveur.f), matchs: ferveur.m,
      rang: ferveur.f > 0 ? rang.rang : null,
      sur: total.n,
      duels: { gagnes: Number(duels.gagnes ?? 0), joues: Number(duels.joues ?? 0) },
    };
  }

  /* ---------------------------------------------------------- routes */

  const router = express.Router();
  const safe = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
    console.error('[classement]', e.message);
    if (!res.headersSent) res.status(503).json({ error: 'rank.error.unavailable' });
  });

  router.get('/supporters', safe(async (req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await supporters(String(req.query.periode ?? 'saison')) });
  }));

  router.get('/tribunes', safe(async (_req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await tribunes() });
  }));

  router.get('/duellistes', safe(async (_req, res) => {
    res.set('cache-control', 'private, max-age=120');
    res.json({ classement: await duellistes() });
  }));

  router.get('/moi', requireAuth, safe(async (req, res) =>
    res.json(await maPlace(req.user.id))));

  return { router, supporters, tribunes, duellistes, maPlace };
}
