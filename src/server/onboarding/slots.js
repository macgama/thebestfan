/**
 * Les emplacements de suivi : combien de clubs on a le droit de suivre.
 *
 * ## Pourquoi cette règle vit dans son propre fichier
 *
 * Elle était écrite dans `onboarding.follow`, avec un commentaire qui disait :
 * « c'est ici que les emplacements sont défendus : la route football ne les
 * connaît pas ». C'était exact, et c'était la faute — **il y avait deux portes
 * et une seule était gardée**. La page « Mes clubs » suit par
 * `POST /api/football/follows`, qui écrivait directement en base ; on pouvait
 * donc suivre autant de clubs qu'on voulait, sans client modifié, sans rien
 * forcer, juste en s'en servant normalement. Un joueur s'est retrouvé avec
 * « 4/2 clubs » dans sa barre.
 *
 * La règle est donc sortie des deux endroits pour n'en habiter qu'un. Tout
 * chemin qui écrit dans `user_follows` passe par ici — c'est ce qui fait
 * qu'une troisième porte, le jour où elle s'ouvrira, ne pourra pas l'oublier.
 *
 * ## Ce qui est déjà là reste
 *
 * Le contrôle porte sur **ajouter**, jamais sur ce qui existe. Les comptes qui
 * ont dépassé le plafond par la porte non gardée gardent leurs clubs : on ne
 * retire pas à quelqu'un ce que le jeu lui a laissé prendre. Ils ne peuvent
 * simplement plus en ajouter tant qu'ils n'ont pas la place — et leur barre
 * affiche un honnête « 4/2 » en attendant, ce qui est la vérité.
 */

/** Ce que reçoit un nouveau venu. */
export const SLOTS_DEPART = 2;

/** Le plus qu'on puisse en avoir, quel que soit le niveau ou la bourse. */
export const SLOTS_MAX = 8;

/**
 * Vérifie qu'il reste de la place pour ce club, et lève sinon.
 *
 * Re-suivre un club déjà suivi ne consomme rien : c'est ce qui permet de le
 * repasser en club principal sans libérer un emplacement d'abord.
 *
 * @param {(sql:string, p?:any[]) => Promise<any[]>} q  l'accès à la base du module appelant
 * @param {string} userId
 * @param {number} teamId
 * @throws {Error} `onboarding.error.no_slot`, avec le compte et le plafond en
 *   pièces jointes — la page doit pouvoir écrire « 2 clubs sur 2 », et non
 *   « impossible ».
 */
export async function verifierEmplacement(q, userId, teamId) {
  const w = (await q(`SELECT follow_slots FROM user_wallet WHERE user_id = ?`, [userId]))[0];
  const deja = await q(`SELECT team_id FROM user_follows WHERE user_id = ?`, [userId]);
  const total = w?.follow_slots ?? SLOTS_DEPART;

  if (deja.some((d) => Number(d.team_id) === Number(teamId))) return;
  if (deja.length < total) return;

  throw Object.assign(new Error('onboarding.error.no_slot'), {
    code: 'onboarding.error.no_slot',
    suivis: deja.length,
    slots: total,
  });
}
