/**
 * Le club qu'un joueur soutient dans une rencontre donnée.
 *
 * ## Pourquoi ce fichier existe
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
 *   — il n'en suit **aucun** : il est neutre. Il peut venir pousser et
 *     choisir son camp, il ne se bâtit pas de réputation, et sa ferveur ne
 *     rapporte rien à un club.
 *
 * `teamId` nul veut dire neutre, et c'est la seule chose que les classements
 * ont besoin de lire.
 */

/**
 * Le club soutenu, à partir de clubs **déjà lus**.
 *
 * La liste des matchs en montre soixante d'un coup : une requête par ligne pour
 * relire une table de deux entrées serait absurde. On lit les clubs suivis une
 * fois, et cette fonction applique la règle autant de fois qu'il le faut.
 *
 * `suivis` doit arriver **trié** — le club principal d'abord — parce que c'est
 * cet ordre qui départage un derby, et que le retrier ici ferait deux tris
 * pour une seule règle.
 */
export function clubParmi(suivis, homeId, awayId) {
  const pour = (suivis ?? []).filter(
    (s) => s.team_id === homeId || s.team_id === awayId);
  if (!pour.length) return { teamId: null, neutre: true };
  return { teamId: pour[0].team_id, neutre: false };
}

/**
 * Le camp d'un club dans une rencontre : 0 à domicile, 1 à l'extérieur.
 *
 * Deux lignes, mais écrites une seule fois : le Virage, le Duel et la liste
 * des matchs s'en servent, et trois versions de `id === away ? 1 : 0`
 * finiraient par ne plus dire la même chose le jour où l'une d'elles change.
 */
export const campDe = (teamId, homeId, awayId) =>
  (teamId == null ? null : (teamId === awayId ? 1 : 0));

/** La même règle, quand on n'a pas déjà les clubs suivis sous la main. */
export async function clubSoutenu(q, userId, homeId, awayId) {
  if (!userId) return { teamId: null, neutre: true };

  /* `is_main` d'abord, puis l'ancienneté : deux critères écrits ici plutôt
     qu'un tri laissé au hasard. Le derby est rare, mais c'est exactement le
     jour où l'on remarque que le jeu a choisi à notre place. */
  return clubParmi(await q(
    `SELECT team_id FROM user_follows
      WHERE user_id = ? AND team_id IN (?, ?)
      ORDER BY is_main DESC, created_at`,
    [userId, homeId, awayId]), homeId, awayId);
}
