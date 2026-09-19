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

  /* ------------------------------------------------------- cinq lieux de plus

     Cinq stades pour dix, et c'était peu : en duel comme au Virage, le lieu se
     tire sur l'identifiant de la rencontre, donc un joueur revoyait le même
     décor un soir sur cinq. Dix lieux, c'est une saison sans se répéter.

     Chacun change **une** règle, ou deux au plus. Un stade qui toucherait à
     quatre choses ne s'apprendrait pas : le joueur doit pouvoir lire le nom du
     lieu et savoir ce qu'il va devoir faire autrement.                      */

  {
    id: 'tole',
    nom: 'Le Toit de Tôle',
    rar: 'rare',
    texte: 'Une casquette de tôle ondulée au-dessus du virage. Le bruit ne sort pas.',
    /* Le contraire du Chaudron : ça ne porte pas plus loin, ça revient sur
       soi. On s'entend pousser et on ne s'entend plus compter — la fenêtre se
       ferme et la poussée grossit. Le stade des cartes brutales. */
    mods: { pushMult: 1.14, tempoWindow: 0.86 },
    effet: 'On s’entend pousser, on ne s’entend plus compter : le rythme devient dur à tenir.',
  },
  {
    id: 'marin',
    nom: 'Le Bord de Mer',
    rar: 'rare',
    texte: 'Le vent de travers entre par la tribune ouverte et emporte la moitié des chants.',
    /* Le vent défait les gestes propres et lave la fatigue. Un lieu qui
       récompense le nombre plutôt que la précision : dix chants moyens y
       valent mieux qu'un geste parfait. */
    mods: { perfectBonus: 0.82, breathBonus: 1.22 },
    effet: 'Le vent emporte les beaux gestes et rend le souffle plus vite, pour tous.',
  },
  {
    id: 'huisclos',
    nom: 'Le Stade Vide',
    rar: 'epique',
    texte: 'Huis clos. On entend le ballon, les crampons, et chaque fausse note.',
    /* Sans foule pour couvrir, tout s'entend : le geste est facile à placer —
       plus rien ne masque le rythme — mais la ferveur ne monte pas, faute de
       monde pour la porter. Le lieu où l'on joue juste et où l'on gagne peu. */
    mods: { tempoWindow: 1.3, ferveurBonus: 0.7 },
    effet: 'Rien ne couvre le rythme, et rien ne le porte non plus : la ferveur monte à peine.',
  },
  {
    id: 'neige',
    nom: 'La Neige',
    rar: 'epique',
    texte: 'Les lignes ont été repassées en bleu trois fois. On ne les voit déjà plus.',
    /* Tout est lent. On a le temps de voir venir un contre — donc d'y
       résister — et on a moins d'occasions de chanter. Le stade des parties
       longues, où l'écart se creuse par petites touches. */
    mods: { tempoInterval: 130, parryResist: 1.3 },
    effet: 'Tout est ralenti : moins d’occasions de chanter, mais les contres portent moins.',
  },
  {
    id: 'annexe',
    nom: 'Le Terrain Annexe',
    rar: 'commune',
    texte: 'Deux cents personnes le long d’une main courante. Tout le monde se connaît.',
    /* Personne, mais tout le monde compte. La poussée est faible et chaque
       carte revient vite : un lieu où l'on joue beaucoup de petites choses, et
       le seul où une main entière peut se jouer deux fois. */
    mods: { pushMult: 0.86, refundBonus: 1.35 },
    effet: 'On pousse peu, mais le souffle dépensé revient bien mieux.',
  },

  /* ================================================== LA REPRISE (5)

     ## Ce qu'un lieu de reprise a de particulier

     La première journée ne se joue pas dans un stade prêt. La pelouse a été
     refaite en juillet et personne ne l'a encore usée ; une tribune est sous
     bâche parce que les travaux ont pris du retard ; il fait trente degrés un
     dimanche de fin août sur un gradin sans toit. Ce sont des lieux **en
     chantier**, et c'est ce qu'il faut qu'on sente.

     ## La règle, inchangée et non négociable

     Un stade appartient au match, jamais à un joueur : en duel il est tiré
     parmi ceux que **les deux** possèdent, et son effet s'applique aux deux
     camps. Ces cinq-là changent donc la même règle pour tout le monde. Ce qui
     départage ensuite, c'est qui a construit le bon deck pour ce lieu — pas qui
     l'a collectionné.

     ## Aucun n'est écrit « en mieux »

     Chacun **ouvre une porte et en ferme une**. Un lieu qui ne ferait que
     donner serait un lieu que tout le monde voudrait tirer, et le tirage
     cesserait d'être une situation pour devenir une récompense.               */

  {
    id: 'rp-pelouse',
    nom: 'La Pelouse Neuve',
    rar: 'commune',
    texte: 'Refaite en juillet, pas encore usée. Personne n’ose vraiment appuyer.',
    /* Un terrain neuf se joue prudemment : les gestes sont plus propres, les
       poussées plus timides. Les deux tribunes retiennent leur coup. */
    mods: { perfectBonus: 1.14, pushMult: 0.93 },
    effet: 'Les gestes parfaits rapportent plus, mais tout le monde pousse moins fort.',
  },
  {
    id: 'rp-travaux',
    nom: 'La Tribune en Travaux',
    rar: 'rare',
    texte: 'Un quart du virage est fermé. On s’entasse dans le reste.',
    /* Serrés, on s'entend de tout près et l'on se relaie mal : le contre porte,
       le souffle ne revient pas. */
    mods: { parryBonus: 1.28, breathBonus: 0.88 },
    effet: 'Entassés : on se contre bien mieux, et l’on récupère mal.',
  },
  {
    id: 'rp-canicule',
    nom: 'Le Dernier Dimanche d’Août',
    rar: 'rare',
    texte: 'Trente degrés sur un gradin sans toit. Le chant sort, il ne tient pas.',
    /* La chaleur : on part fort et on ne dure pas. Le martelage y gagne, tout
       ce qui demande de durer y perd. */
    mods: { mashBonus: 1.26, holdBonus: 0.82, breathBonus: 0.9 },
    effet: 'On démarre fort et l’on ne tient rien : le martelage gagne, l’endurance s’effondre.',
  },
  {
    id: 'rp-bache',
    nom: 'Le Virage sous Bâche',
    rar: 'epique',
    texte: 'La bâche du tifo n’est pas descendue. On chante derrière, sans rien voir.',
    /* On ne voit pas le terrain : le rythme se perd, mais rien ne se lit non
       plus de l'autre côté. Un lieu où l'on joue à l'oreille. */
    mods: { tempoWindow: 0.8, parryResist: 1.45, tempoInterval: 80 },
    effet: 'À l’aveugle : le rythme est bien plus dur à tenir, et personne ne se fait contrer.',
  },
  {
    id: 'rp-inauguration',
    nom: 'L’Inauguration',
    rar: 'legendaire',
    texte: 'Nouveau nom sur le fronton, nouveau virage, et pas une habitude en commun.',
    /* Tout est neuf, y compris les repères : on pousse comme jamais, et rien de
       ce qu'on savait faire ne sert. Le lieu le plus violent des quinze, dans
       les deux sens. */
    mods: { pushMult: 1.35, ferveurBonus: 1.2, tempoWindow: 0.78, refundBonus: 0.8 },
    effet: 'Tout le monde pousse comme jamais, et plus personne n’a ses repères.',
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
