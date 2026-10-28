/**
 * Un pas de plus dans `compteurs_jour`, la table de ce qui n'a de ligne datée
 * nulle part ailleurs : un Ultimate lancé, une partie de mini-jeu, un
 * pronostic nouveau. Les missions du jour les comptent (`missions.js`,
 * `lireCompteurs`). Le jour est celui de la base, `CURDATE()`, jamais un jour
 * fabriqué ici.
 *
 * **Annexe** : un compteur qui échoue ne fait jamais échouer le geste qu'il
 * compte. Le joueur a lancé son Ultimate ; qu'une mission ne l'ait pas vu est
 * un moindre mal qu'un coup fatal refusé.
 *
 * @param q  une fonction `(sql, params) => Promise`, celle du module appelant
 */
export async function compterDuJour(q, userId, cle) {
  if (!userId) return;
  try {
    await q(
      `INSERT INTO compteurs_jour (user_id, jour, cle, n) VALUES (?, CURDATE(), ?, 1)
       ON DUPLICATE KEY UPDATE n = n + 1`, [userId, cle]);
  } catch (e) {
    console.error(`[quotidien] compteur « ${cle} » non écrit :`, e?.code ?? e?.message ?? e);
  }
}
