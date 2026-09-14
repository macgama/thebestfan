/**
 * Le niveau du joueur.
 *
 * Tout est ici : la courbe, ce que rapporte chaque geste, et ce que chaque
 * palier ouvre. Le serveur s'en sert pour créditer et pour autoriser, le client
 * pour afficher — une seule définition, donc aucun risque que l'écran promette
 * un déblocage que le serveur refuse.
 *
 * **Le niveau ouvre, il ne donne pas.** C'est la règle qui tient tout le
 * reste : il élargit ce qu'on a le droit de faire — une série de plus, un
 * emplacement de plus — sans jamais rendre plus fort en duel. Un joueur de
 * niveau 30 n'a aucun avantage sur un joueur de niveau 2 sur la corde ; il a
 * simplement plus de choix avant d'y monter. Sans cette règle, l'ancienneté
 * deviendrait de la puissance, et le nouveau venu n'aurait plus aucune raison
 * de rester.
 */
import { reglage } from './reglages.js';


/** Le dernier palier. Au-delà, l'XP continue de compter mais n'ouvre plus rien. */
export const NIVEAU_MAX = 30;

/**
 * Ce qu'il faut d'XP pour passer du niveau `n` au suivant : 60, puis 100, 140…
 *
 * Une progression linéaire de l'écart, pas de la valeur. Les premiers paliers
 * tombent en quelques minutes — c'est ce qui donne envie de continuer — et les
 * derniers demandent des semaines sans jamais devenir absurdes. Une courbe
 * exponentielle aurait fait le contraire : trois jours pour le niveau 5, six
 * mois pour le niveau 12.
 */
export const coutDuPalier = (n) => 60 + 40 * (n - 1);

/** L'XP cumulée nécessaire pour atteindre le niveau `n`. */
export function seuil(n) {
  let total = 0;
  for (let k = 1; k < n; k++) total += coutDuPalier(k);
  return total;
}

/** Le niveau correspondant à une XP cumulée. */
export function niveauPour(xp) {
  let n = 1;
  while (n < NIVEAU_MAX && xp >= seuil(n + 1)) n++;
  return n;
}

/**
 * Où en est le joueur dans son palier : de quoi dessiner une jauge honnête.
 *
 * Au niveau maximum il n'y a plus de palier à remplir. On rend une jauge pleine
 * plutôt qu'une division par zéro — et `max` à `true`, pour que l'écran puisse
 * dire autre chose que « 0/0 ».
 */
export function progression(xp) {
  const niveau = niveauPour(xp);
  if (niveau >= NIVEAU_MAX) return { niveau, dans: 0, pour: 0, part: 1, max: true };
  const bas = seuil(niveau);
  const haut = seuil(niveau + 1);
  return {
    niveau,
    dans: xp - bas,
    pour: haut - bas,
    part: (xp - bas) / (haut - bas),
    max: false,
  };
}

/**
 * Ce que rapporte chaque geste.
 *
 * **L'entraînement rapporte de l'XP.** Moins qu'un duel classé, mais il en
 * rapporte : un joueur qui apprend le jeu contre des bots ne doit pas voir sa
 * barre immobile pendant que les autres montent. C'est la même raison qui lui
 * fait déjà gagner des écharpes.
 *
 * La victoire ajoute, elle ne multiplie pas. Perdre trois duels doit rester plus
 * profitable que ne pas jouer, sinon le joueur en difficulté quitte la salle
 * avant la fin — et un duel abandonné gâche la soirée des deux camps.
 */
export const XP = {
  get pack() { return reglage('xp.pack'); },              // un booster ouvert
  get duel() {
    return { entrainement: reglage('xp.duel_entrainement'), classe: reglage('xp.duel_classe') };
  },
  get victoire() { return reglage('xp.victoire'); },      // en plus du duel joué
};

/**
 * Les écharpes offertes en montant d'un palier : dix par niveau atteint.
 *
 * Un complément, pas une source. Les trente paliers rapportent en tout 4 640
 * écharpes, à comparer aux 15 870 qu'il faut pour faire grandir tout le monde :
 * de quoi sentir la montée, jamais de quoi remplacer les doublons.
 */
export const ecarpesDuPalier = (n) => 10 * n;

/**
 * Ce que chaque palier ouvre.
 *
 * ## Le niveau n'ouvre plus de séries
 *
 * Il en ouvrait : LA TRIBUNE au niveau 1, LES MÉTIERS DU STADE au 3, LE VIRAGE
 * IMPOSSIBLE au 26. Ça marchait, et ça avait un défaut qu'on ne voit qu'en
 * regardant le jeu vivre : **rien n'arrivait jamais à personne en même temps**.
 * Chacun découvrait une série le jour où son compteur d'expérience passait un
 * seuil, seul, sans que ce jour-là existe pour qui que ce soit d'autre. Deux
 * joueurs qui se parlent ne parlent alors jamais de la même chose, et il n'y a
 * rien à annoncer — puisqu'il n'y a rien de neuf, seulement quelqu'un qui
 * rattrape.
 *
 * Les séries s'ouvrent désormais par **saison**, depuis l'administration, pour
 * tout le monde le même jour. Voir `src/server/fanzzy/saisons.js`.
 *
 * ## Ce qu'il ouvre encore
 *
 * Des **capacités**, et rien que des capacités : des emplacements de club à
 * suivre, des rangs de tribune dans le deck. C'est la bonne chose à confier au
 * niveau — elles n'ont de sens que pour un joueur donné, et personne n'a envie
 * qu'on les lui annonce.
 *
 * Le niveau ne donne toujours **aucune puissance** : un joueur de niveau 30 n'a
 * pas un gramme d'avance sur la corde. S'il en avait, l'ancienneté deviendrait
 * de la force et le nouveau venu n'aurait plus de raison de rester.
 */
export const PALIERS = [
  { niveau: 4, slots: 3 },
  { niveau: 5, deckFanzzy: 3 },
  { niveau: 9, slots: 4 },
  { niveau: 14, slots: 5 },
  { niveau: 19, slots: 6 },
  { niveau: 24, slots: 7 },
  { niveau: 30, slots: 8 },
];

/**
 * Ce qu'un joueur de ce niveau a le droit de faire.
 *
 * `series` n'y est plus. Ceux qui s'en servaient croisaient le niveau avec les
 * séries ouvertes de l'administration ; il n'y a plus qu'une règle, et elle vit
 * dans `catalogue.js`. Laisser un `series` vide ici aurait été pire que de le
 * retirer : chaque lecteur aurait dû deviner s'il veut dire « aucune série » ou
 * « ce n'est plus ma question ».
 */
export function droits(niveau) {
  let slots = 2;                 // ce que reçoit un nouveau venu
  let deckFanzzy = 2;
  for (const p of PALIERS) {
    if (p.niveau > niveau) continue;
    if (p.slots) slots = p.slots;
    if (p.deckFanzzy) deckFanzzy = p.deckFanzzy;
  }
  return { slots, deckFanzzy };
}

/** Ce que ce palier précis apporte, pour l'annoncer au moment où il tombe. */
export const palier = (niveau) => PALIERS.find((p) => p.niveau === niveau) ?? null;

/**
 * Les paliers franchis entre deux niveaux, pour l'écran de montée.
 * Deux niveaux d'un coup arrivent — une grosse victoire après une série de
 * boosters — et il ne faut pas en avaler un au passage.
 */
export const paliersEntre = (avant, apres) =>
  PALIERS.filter((p) => p.niveau > avant && p.niveau <= apres);
