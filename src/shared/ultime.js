/**
 * L'Ultimate : le coup fatal d'un Fanzzy.
 *
 * ## Ce que Gaël a demandé
 *
 * « Pour chaque Fanzzy et pour chaque âge, un système d'Ultimate (coup
 * fatal), avec un visuel fort qui marque les esprits, que les joueurs aient
 * envie d'y arriver et de pouvoir l'utiliser » (26 octobre 2026). Choix du
 * même jour, sur la carte de décision : **« Visuel à collectionner »**.
 *
 * ## La règle
 *
 * — **Une jauge qui se remplit en chantant bien.** Un chant BON compte un
 *   point, un PARFAIT deux. Le geste, pas la carte ni l'argent : c'est ce que
 *   le joueur fait qui l'amène au coup fatal.
 * — **Une fois par partie** : une fois par duel, une fois par match de
 *   Virage. Un coup qu'on peut lancer toutes les minutes n'est plus fatal.
 * — **Son geste**, celui de la spécialité du Fanzzy en tribune, et la
 *   poussée suit la note : un Ultimate raté pousse encore la moitié.
 * — **Plus fort avec l'âge.** Au duel, on entre au premier âge et la Relève
 *   fait grandir : l'Ultimate du troisième âge est la raison de la jouer. Au
 *   Virage, on reste au premier âge.
 * — **Son nom est le cri de l'âge** (`dex-ages.js`) : chaque Fanzzy en a un
 *   par âge, déjà écrit et traduit — « ON LÂCHE RIEN », puis « C'EST JAMAIS
 *   FINI ». C'est ce qu'il hurle en frappant.
 *
 * ## Ce que la carte du booster donne, et ce qu'elle ne donne pas
 *
 * **Tout le monde a l'Ultimate, et il pousse pareil pour tous.** La carte
 * Ultimate d'un âge, gagnée en booster, débloque **la grande scène** — plus
 * longue, en plein écran, vue par la tribune d'en face — et se range dans la
 * collection. Elle ne donne aucune puissance : la même ligne que la Relève
 * (« posséder la carte n'est pas une seconde barrière ») et que les
 * légendaires. Un booster s'achète ; une victoire ne doit pas s'acheter.
 *
 * La carte se range dans `user_etats`, sous l'état `ultime` : c'est la pose
 * du coup fatal d'un âge, comme la joie ou la colère sont les siennes, et la
 * table a été voulue sans ENUM pour qu'un cinquième dessin n'y demande aucun
 * changement de schéma.
 */
import { reglage } from './reglages.js';
import { verdictDe } from './verdict.js';

/** L'état sous lequel la carte Ultimate se range dans `user_etats`. */
export const ETAT_ULTIME = 'ultime';

/** Les points qu'un chant apporte à la jauge, selon son verdict. */
export const POINTS_ULTIME = Object.freeze({ parfait: 2, bon: 1, moyen: 0, rate: 0 });

/** Ce qu'il faut de points pour lancer l'Ultimate. Zéro : prêt d'emblée. */
export function seuilUltime() {
  const n = Number(reglage('ultime.charge'));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 8;
}

/** Les points d'un chant, sur la note du geste (avant les modificateurs). */
export const pointsDuChant = (note) => POINTS_ULTIME[verdictDe(note)] ?? 0;

/** La part de la poussée gardée par un Ultimate raté : il frappe quand même. */
export const PLANCHER_ULTIME = 0.5;

/**
 * La poussée d'un Ultimate, avant ce que l'arène y ajoute (modificateurs,
 * effectif, bouclier).
 *
 * @param stade  l'âge du Fanzzy en tribune (1 à 3)
 * @param quality la note finale du geste, entre 0 et 1
 */
export function pousseeUltime(stade, quality) {
  const base = Number(reglage('ultime.puissance')) || 70;
  const parAge = (Number(reglage('ultime.bonus_age')) || 0) / 100;
  const age = Math.min(3, Math.max(1, Number(stade) || 1));
  const q = Math.min(1, Math.max(0, Number(quality) || 0));
  return base * (1 + parAge * (age - 1)) * (PLANCHER_ULTIME + (1 - PLANCHER_ULTIME) * q);
}

/** Une jauge neuve, pour une partie. */
export function nouvelleJauge() {
  const seuil = seuilUltime();
  return { points: 0, seuil, utilise: false };
}

/** La jauge est-elle pleine, et l'Ultimate encore à lancer ? */
export const ultimePret = (u) => Boolean(u && !u.utilise && u.points >= u.seuil);

/**
 * Ajoute les points d'un chant. Rend `true` si ce chant vient de la remplir :
 * c'est le moment que l'arène annonce.
 */
export function chargerJauge(u, note) {
  if (!u || u.utilise || u.points >= u.seuil) return false;
  u.points = Math.min(u.seuil, u.points + pointsDuChant(note));
  return u.points >= u.seuil;
}

/** Ce que la page reçoit de sa jauge. */
export const vueJauge = (u) => (u
  ? { points: u.points, seuil: u.seuil, pret: ultimePret(u), utilise: u.utilise }
  : null);
