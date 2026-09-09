/**
 * Le KOP : la caisse commune d'un groupe de supporters.
 *
 * Un joueur pousse pour son club, une part des écharpes tombe dans le pot de
 * son KOP, et le groupe décide **ensemble** de ce qu'il en fait. Ce qu'il
 * achète profite à tous ses membres présents dans le VIRAGE le soir du match.
 *
 * Trois règles gouvernent tout le reste.
 *
 * **Un KOP par club, plusieurs clubs possibles.** On peut être au KOP du club A
 * et au KOP du club B, jamais à deux KOP du club A. La contrainte est posée en
 * base — `UNIQUE (user_id, team_id)` — et non dans le code : c'est une règle
 * d'appartenance, et une règle d'appartenance qui ne tient qu'à une
 * vérification finit par céder sur une requête simultanée.
 *
 * **Ce qui est versé est versé.** Quitter un KOP ne rend rien. Sans cette
 * règle, on entrerait la veille du match, on voterait, et on repartirait avec
 * sa part : le pot cesserait d'être commun et deviendrait un compte
 * d'épargne.
 *
 * **Un bonus est un jeu de modificateurs**, écrit dans le vocabulaire que le
 * moteur emploie déjà — `tempoWindow`, `breathBonus`, `pushMult`… C'est ce qui
 * permet à un KOP de peser sur la corde, la ferveur, les écharpes, le souffle,
 * le tempo ou les contres sans que le KOP connaisse aucune de ces mécaniques.
 * Une mécanique ajoutée demain sera couverte par une clé de plus, pas par une
 * réécriture.
 */

/** Ce qu'un membre ordinaire pèse dans un vote. */
export const VOIX_MEMBRE = 1;

/**
 * Ce que pèse le créateur : **cinq voix**, et il départage.
 *
 * Un KOP n'est pas une démocratie de club, c'est un groupe de copains dont
 * quelqu'un a pris l'initiative. Cinq voix lui donnent le dernier mot dans un
 * petit groupe sans le lui donner dans un grand — à partir de onze membres
 * actifs, il redevient minoritaire, ce qui est exactement le moment où un KOP
 * cesse d'être un groupe de copains.
 */
export const VOIX_CREATEUR = 5;

/**
 * La durée d'un vote : **trois minutes**.
 *
 * « Le système de vote doit être très court » — et il doit l'être pour une
 * raison précise : un vote qui dure une journée se décide sans ceux qui jouent
 * ce soir-là. Trois minutes, c'est la mi-temps ; tout le monde est devant son
 * téléphone, et celui qui ne l'est pas a délégué de fait.
 */
export const DUREE_VOTE_MS = 3 * 60 * 1000;

/**
 * Ce qu'un KOP peut acheter.
 *
 * Les prix sont volontairement au-dessus de ce qu'un joueur seul accumule : un
 * KOP à trois personnes met deux ou trois soirées à s'offrir un bonus de match,
 * une saison entière pour un bonus de saison. C'est ce qui fait qu'on en parle
 * avant de voter.
 *
 * `portee` dit ce qui consomme le bonus :
 *   - `match`  — un seul match réel, puis il s'éteint ;
 *   - `charges`— un nombre de matchs, décompté à chaque match joué ;
 *   - `saison` — jusqu'à la fin de la saison.
 */
export const BONUS = [
  { id: 'corde', nom: 'La corde tient', prix: 400, portee: 'match',
    texte: 'Chaque poussée du KOP compte 15 % de plus, pendant tout le match.',
    mods: { pushMult: 1.15 } },

  { id: 'souffle', nom: 'Deuxième souffle', prix: 350, portee: 'match',
    texte: 'Le souffle des membres revient 25 % plus vite.',
    mods: { breathBonus: 1.25 } },

  { id: 'tempo', nom: 'Tous en cadence', prix: 450, portee: 'match',
    texte: 'La fenêtre de tempo s’élargit d’un tiers pour tout le KOP.',
    mods: { tempoWindow: 1.33 } },

  { id: 'contres', nom: 'Mur de bâches', prix: 500, portee: 'match',
    texte: 'Les contres du KOP portent 40 % plus loin.',
    mods: { parryBonus: 1.4, parryResist: 1.2 } },

  { id: 'ferveur', nom: 'La ferveur monte', prix: 700, portee: 'charges', charges: 3,
    texte: 'La ferveur gagnée augmente de 30 %. Trois matchs.',
    mods: { ferveurBonus: 1.3 } },

  { id: 'echarpes', nom: 'La quête', prix: 900, portee: 'charges', charges: 3,
    texte: 'Les écharpes gagnées augmentent de 25 %. Trois matchs.',
    mods: { scarvesBonus: 1.25 } },

  { id: 'saison', nom: 'Le virage debout', prix: 5000, portee: 'saison',
    texte: 'Souffle, tempo et corde légèrement relevés, jusqu’à la fin de la saison.',
    mods: { breathBonus: 1.08, tempoWindow: 1.08, pushMult: 1.05 } },
];

export const BONUS_PAR_ID = new Map(BONUS.map((b) => [b.id, b]));

/**
 * La part du gain d'un duel qui tombe dans le pot.
 *
 * Elle ne se prend pas au joueur : elle s'ajoute. Pousser pour son club
 * rapporte le double **et** remplit le pot — c'est le même geste qui sert les
 * deux, et il n'y a aucune raison de faire choisir entre soi et son groupe.
 */
export const PART_POT = 1;

/**
 * Dépouille un vote.
 *
 * `bulletins` : `[{ userId, pour }]`. Les voix du créateur pèsent cinq, et en
 * cas d'égalité **c'est son bulletin qui tranche**. S'il n'a pas voté, une
 * égalité vaut rejet : on ne dépense pas le pot sur un partage.
 */
export function depouiller(bulletins, createurId) {
  let pour = 0;
  let contre = 0;
  let bulletinDuCreateur = null;

  for (const b of bulletins) {
    const poids = b.userId === createurId ? VOIX_CREATEUR : VOIX_MEMBRE;
    if (b.userId === createurId) bulletinDuCreateur = b.pour;
    if (b.pour) pour += poids; else contre += poids;
  }

  const adopte = pour > contre
    || (pour === contre && pour > 0 && bulletinDuCreateur === true);

  return { pour, contre, adopte, votants: bulletins.length,
    departage: pour === contre && pour > 0 && bulletinDuCreateur !== null };
}

/** Un nom de KOP lisible : ni vide, ni un roman, ni du HTML. */
export function nomValide(nom) {
  const n = String(nom ?? '').trim().replace(/\s+/g, ' ');
  if (n.length < 3 || n.length > 40) return null;
  // Rien qui ressemble à du balisage : ces noms s'affichent dans des listes.
  if (/[<>]/.test(n)) return null;
  return n;
}
