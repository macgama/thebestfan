/**
 * Ouvrir la bourse d'un joueur.
 *
 * ## La faute que ce fichier corrige
 *
 * **Cinq modules créaient la ligne `user_wallet`, et un seul connaissait la
 * règle.** `fanzzy/index.js` écrivait `packs = reglage('pack.depart')` ;
 * l'inscription, le deck, le niveau, le duel et l'administration écrivaient
 * `INSERT IGNORE INTO user_wallet (user_id) VALUES (?)` et laissaient la
 * **base** décider du nombre.
 *
 * Or la base ne décide pas de la même chose partout. `CREATE TABLE IF NOT
 * EXISTS` ne touche pas à une table qui existe déjà : le jour où le défaut de
 * `packs` est passé de douze à trois dans `sql/souvenirs.sql`, les bases neuves
 * ont pris trois et la base de production a gardé douze. Le fichier disait
 * trois, l'administration affichait trois, et un nouveau joueur en recevait
 * douze — sans qu'aucun des deux endroits qui l'annoncent ne soit faux.
 *
 * Et c'est l'inscription qui crée la ligne en premier, donc c'est toujours le
 * chemin qui ignore le réglage qui gagne.
 *
 * ## La règle
 *
 * Personne n'écrit plus `INSERT INTO user_wallet` pour ouvrir une bourse. On
 * appelle ceci, qui **nomme** le nombre au lieu de l'emprunter. Un défaut de
 * colonne est une valeur qu'on ne peut ni lire dans l'écran d'administration
 * ni changer sans migration : ce n'est pas un endroit où ranger une règle du
 * jeu.
 *
 * `sql/bourse.sql` réaligne le défaut de la colonne par la même occasion — non
 * pas parce que le code en dépend encore, mais parce qu'une base dont le défaut
 * ment reste une base où la prochaine requête écrite à la va-vite se trompera.
 */
import { reglage } from '../shared/reglages.js';

/**
 * S'assure qu'une bourse existe, avec la réserve de départ du réglage.
 *
 * Sans effet si elle existe déjà : `INSERT IGNORE` ne réajuste jamais la
 * réserve de quelqu'un qui joue depuis six mois. Ouvrir une bourse et la
 * remplir sont deux gestes, et un seul se répète.
 *
 * @param {(sql: string, params?: any[]) => Promise<any>} q  la fonction de
 *   requête du module appelant — chacun a la sienne, autour du même pool.
 * @param {string} userId
 */
export async function assurerBourse(q, userId) {
  await q(
    `INSERT IGNORE INTO user_wallet (user_id, packs) VALUES (?, ?)`,
    [userId, packsDepart()]);
}

/**
 * La réserve offerte à l'inscription.
 *
 * Passe par `reglage` à chaque appel et non par une constante : la valeur
 * change depuis l'administration, et une constante lue au démarrage ferait
 * exactement ce qu'on vient de corriger — un écran qui annonce un nombre et un
 * serveur qui en applique un autre.
 */
export function packsDepart() {
  return reglage('pack.depart');
}
