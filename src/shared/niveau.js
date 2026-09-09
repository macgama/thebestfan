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
  pack: 5,               // un booster ouvert
  duel: { entrainement: 12, classe: 20 },
  victoire: 15,          // en plus du duel joué
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
 * Les séries sont rangées de la plus lisible à la plus étrange : on commence
 * par des gens de tribune, on finit par ceux qui n'ont rien à faire là. Un
 * joueur qui découvre le jeu ne doit pas tomber sur un vampire à sa deuxième
 * carte.
 *
 * **Le niveau et l'administration se combinent, ils ne se remplacent pas.** Une
 * série est proposée si elle est ouverte *et* si le joueur l'a atteinte :
 * l'administration décide de ce qui existe pour tout le monde, le niveau de ce
 * qui existe pour lui.
 */
export const PALIERS = [
  { niveau: 1, series: ['TR'] },
  { niveau: 3, series: ['MS'] },
  { niveau: 4, slots: 3 },
  { niveau: 5, deckFanzzy: 3 },
  { niveau: 6, series: ['BG'] },
  { niveau: 9, series: ['VN'], slots: 4 },
  { niveau: 12, series: ['NE'] },
  { niveau: 14, slots: 5 },
  { niveau: 15, series: ['OB'] },
  { niveau: 18, series: ['RV'] },
  { niveau: 19, slots: 6 },
  { niveau: 22, series: ['EP'] },
  { niveau: 24, slots: 7 },
  { niveau: 26, series: ['IM'] },
  { niveau: 30, slots: 8 },
];

/** Ce qu'un joueur de ce niveau a le droit de faire. */
export function droits(niveau) {
  const series = new Set();
  let slots = 2;                 // ce que reçoit un nouveau venu
  let deckFanzzy = 2;
  for (const p of PALIERS) {
    if (p.niveau > niveau) continue;
    for (const s of p.series ?? []) series.add(s);
    if (p.slots) slots = p.slots;
    if (p.deckFanzzy) deckFanzzy = p.deckFanzzy;
  }
  return { series, slots, deckFanzzy };
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
