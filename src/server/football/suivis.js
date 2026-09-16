/**
 * Le club qu'un joueur soutient dans une rencontre donnée.
 *
 * ## Pourquoi cette fonction existe
 *
 * Le Grand Virage et le Duel posent la même question au même moment — « ce
 * match est-il le sien, et de quel club ? » — et ils y répondaient chacun de
 * leur côté, avec deux requêtes différentes. Le Virage prenait `suivis[0]`,
 * c'est-à-dire **l'ordre de la base** : un supporter qui suit les deux clubs
 * d'un derby découvrait son camp au hasard de ce que MySQL rendait en premier.
 * Le Duel, lui, ne répondait que par oui ou non et ne savait pas nommer le
 * club.
 *
 * ## La règle
 *
 *   — il suit **un** des deux clubs : c'est celui-là, et il est chez lui ;
 *   — il suit **les deux** : le club principal l'emporte, et à défaut le
 *     premier suivi. Il est chez lui dans tous les cas — c'est un derby, pas
 *     une sortie ;
 *   — il n'en suit **aucun** : il est neutre. Il peut venir pousser, il ne se
 *     bâtit pas de réputation, et sa ferveur ne rapporte rien à un club.
 *
 * `teamId` nul veut dire neutre, et c'est la seule chose que les classements
 * ont besoin de lire.
 */
export async function clubSoutenu(q, userId, homeId, awayId) {
  if (!userId) return { teamId: null, neutre: true };

  /* `is_main` d'abord, puis l'ancienneté : deux critères écrits ici plutôt
     qu'un tri laissé au hasard. Le derby est rare, mais c'est exactement le
     jour où l'on remarque que le jeu a choisi à notre place. */
  const rows = await q(
    `SELECT team_id FROM user_follows
      WHERE user_id = ? AND team_id IN (?, ?)
      ORDER BY is_main DESC, created_at`,
    [userId, homeId, awayId]);

  if (!rows.length) return { teamId: null, neutre: true };
  return { teamId: rows[0].team_id, neutre: false };
}
