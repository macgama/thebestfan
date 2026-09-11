/**
 * Les stades.
 *
 * Cinq lieux, vus du dessus. Ils servent de décor au Grand Virage et au duel,
 * et ils se collectionnent — mais **ils ne se portent pas**.
 *
 * ## La règle, et pourquoi elle n'est pas négociable
 *
 * Le jeu tient sur deux principes écrits dans `inventaire.js` : un skin ne
 * donne aucun bonus, et chaque pièce d'équipement a un revers. Les deux disent
 * la même chose — « un débutant qui chante juste bat un vétéran mal équipé ».
 *
 * Un stade qui donnerait un avantage à son propriétaire serait la première
 * chose du jeu à donner de la puissance **sans que l'adversaire l'ait
 * choisie**. On équipe son Fanzzy en sachant ce qu'on y perd ; on ne choisit
 * pas de jouer chez quelqu'un.
 *
 * Le stade appartient donc **au match**, jamais à un joueur :
 *
 *   — au Grand Virage, il vient du vrai match ;
 *   — en duel, il est tiré parmi ceux que **les deux** joueurs possèdent.
 *
 * Son effet s'applique aux deux camps. Collectionner n'achète pas de la force,
 * ça élargit les lieux où l'on peut tomber — et donc les situations qu'un deck
 * doit savoir affronter. C'est une profondeur, pas un palier.
 *
 * ## Ce qu'un effet a le droit de faire
 *
 * Changer **la même règle pour tout le monde**. L'altitude raccourcit le
 * souffle des deux tribunes ; la poussière rend les cartes de poussée un peu
 * plus fortes, des deux côtés. Ce qui se départage ensuite, c'est qui a
 * construit le bon deck pour ce lieu-là — exactement ce que raconte déjà le
 * commentaire en tête de `actions.js` : « deux tribunes qui poussent pareil se
 * départagent sur le moment où elles jouent leurs cartes. »
 *
 * `mods` emploie le même vocabulaire que les Fanzzy, l'équipement et les KOP :
 * `breathBonus`, `pushMult`, `tempoWindow`… Le moteur ne sait pas d'où vient
 * un modificateur, et c'est ce qui permet d'en ajouter un sans le toucher.
 */

export const STADES = [
  {
    id: 'chaudron',
    nom: 'Le Chaudron',
    rar: 'commune',
    texte: 'Les tribunes sont à trois mètres de la touche. Tout s’entend, tout porte.',
    /* Une enceinte serrée renvoie le son : les deux tribunes poussent un peu
       plus fort, et les deux s'épuisent un peu plus vite. Un lieu où les
       matchs se jouent plus court. */
    mods: { pushMult: 1.08, breathBonus: 0.94 },
    effet: 'Tout le monde pousse plus fort, et se fatigue plus vite.',
  },
  {
    id: 'montagne',
    nom: 'Le Nid d’Aigle',
    rar: 'rare',
    texte: 'Mille six cents mètres, la neige sur les toits, et l’air qui manque.',
    /* L'altitude. Le souffle revient plus lentement pour tout le monde : les
       cartes qui rendent du souffle — Thermos, Collecte — y valent bien plus
       cher que leur coût ne le dit. */
    mods: { breathBonus: 0.8 },
    effet: 'L’air est rare : le souffle revient bien plus lentement, des deux côtés.',
  },
  {
    id: 'arene',
    nom: 'L’Arène',
    rar: 'rare',
    texte: 'Un bol fermé, un toit de verre, et pas un souffle d’air qui entre.',
    /* Le lieu neutre par excellence : rien ne gêne, rien n'aide. Le geste y
       est plus facile à placer, et c'est tout — un stade où l'écart se fait
       sur le deck et rien d'autre. */
    mods: { tempoWindow: 1.12 },
    effet: 'Rien ne perturbe le rythme : la fenêtre de tempo est plus large pour tous.',
  },
  {
    id: 'poussiere',
    nom: 'La Poussière',
    rar: 'epique',
    texte: 'La terre rouge monte dans les projecteurs et ne redescend jamais.',
    /* Un lieu bruyant et sec. Les gestes y sont plus durs à placer, mais un
       geste réussi porte beaucoup plus loin : le stade des joueurs qui
       préfèrent une grosse carte à dix petites. */
    mods: { tempoWindow: 0.88, perfectBonus: 1.25 },
    effet: 'Le rythme est difficile à tenir, mais un geste parfait paie double.',
  },
  {
    id: 'piste',
    nom: 'La Piste',
    rar: 'commune',
    texte: 'Une piste d’athlétisme entre la foule et le terrain. Le son se perd en route.',
    /* La tribune est loin. Tout est atténué — c'est le stade où le nombre
       compte plus que le geste, et où un Appel du capo change tout. */
    mods: { pushMult: 0.9, ferveurBonus: 1.1 },
    effet: 'La foule est loin : on pousse moins, mais la ferveur se gagne plus vite.',
  },
];

export const STADE_BY_ID = new Map(STADES.map((s) => [s.id, s]));

/** Le stade par défaut : celui où l'on joue quand personne n'en possède. */
export const STADE_DEFAUT = 'chaudron';

/**
 * Le stade d'une rencontre.
 *
 * **Il appartient au match.** En duel, on le tire parmi ceux que les deux
 * camps possèdent — ce qui veut dire qu'un joueur qui collectionne n'emporte
 * jamais un avantage : il ouvre des lieux où la rencontre *peut* se tenir, et
 * l'adversaire y a exactement les mêmes règles que lui.
 *
 * L'intersection et non la réunion : jouer dans un stade que l'adversaire n'a
 * jamais vu serait lui imposer une règle qu'il ne connaît pas. Si
 * l'intersection est vide — personne n'a rien, ou rien en commun — on retombe
 * sur le stade de départ, que tout le monde possède.
 *
 * @param possessions  un tableau par camp : les identifiants possédés.
 * @param graine       un nombre stable — l'identifiant du duel, du match —
 *   pour que les deux clients tirent le même stade sans se parler.
 */
export function stadeDeLaRencontre(possessions, graine = 0) {
  const listes = (possessions ?? []).map((p) => new Set(p ?? []));
  let communs = STADES.filter((s) => s.id === STADE_DEFAUT
    || listes.every((l) => l.has(s.id)));
  if (!listes.length) communs = STADES;
  if (!communs.length) return STADE_BY_ID.get(STADE_DEFAUT);
  const n = Math.abs(Math.floor(Number(graine) || 0)) % communs.length;
  return communs[n];
}
