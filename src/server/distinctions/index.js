/**
 * Lire et poser les distinctions (`sql/distinctions.sql`).
 *
 * Tout ce qui lit est **tu par l'absence de la table** : une base où
 * `sql/distinctions.sql` n'est pas encore appliqué garde ses classements, ses
 * amis et ses duels, simplement sans badge.
 */
import { DISTINCTION_PAR_ID } from '../../shared/distinctions.js';

const sansTable = (e, vide) => {
  if (e?.code === 'ER_NO_SUCH_TABLE') return vide;
  throw e;
};

/** `Map(userId → ['fondateur', …])`, sans ceux qui n'en ont aucune. */
export async function distinctionsDe(q, ids = []) {
  const uniques = [...new Set(ids.filter(Boolean).map(String))]
    .filter((id) => !id.startsWith('bot:'));
  const out = new Map();
  if (!uniques.length) return out;
  const rows = await q(
    `SELECT user_id, distinction FROM user_distinctions
      WHERE user_id IN (${uniques.map(() => '?').join(',')}) ORDER BY recue_le`, uniques)
    .catch((e) => sansTable(e, []));
  for (const r of rows) {
    if (!DISTINCTION_PAR_ID.has(r.distinction)) continue;
    (out.get(String(r.user_id)) ?? out.set(String(r.user_id), []).get(String(r.user_id)))
      .push(r.distinction);
  }
  return out;
}

/** Celles d'un joueur, `[]` sans. */
export async function distinctionsDuJoueur(q, id) {
  return (await distinctionsDe(q, [id])).get(String(id)) ?? [];
}

/** Pose une distinction. `true` si elle est neuve. La table doit exister. */
export async function accorderDistinction(q, userId, distinction, par = null) {
  if (!DISTINCTION_PAR_ID.has(distinction)) {
    throw Object.assign(new Error('distinction inconnue'), { code: 'distinction_inconnue' });
  }
  const r = await q(
    `INSERT IGNORE INTO user_distinctions (user_id, distinction, par) VALUES (?, ?, ?)`,
    [userId, distinction, par]);
  return Number(r?.affectedRows ?? 0) > 0;
}

/** Retire une distinction (une erreur d'administration). `true` si elle y était. */
export async function retirerDistinction(q, userId, distinction) {
  const r = await q(`DELETE FROM user_distinctions WHERE user_id = ? AND distinction = ?`,
    [userId, distinction]);
  return Number(r?.affectedRows ?? 0) > 0;
}
