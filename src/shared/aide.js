/**
 * Ce qu'on explique au joueur : le parcours des premiers pas, et la FAQ.
 *
 * ## Pourquoi ce fichier est partagé, et pourquoi il est du code
 *
 * Une aide ment toujours en premier sur les nombres. « 45 écharpes le
 * booster », « trois paquets au départ », « dix cartes d'action » : ce sont des
 * réglages, et trois d'entre eux se changent depuis l'administration sans
 * déployer quoi que ce soit. Une FAQ qui les recopie devient fausse le jour où
 * quelqu'un déplace un curseur, et personne ne fait le lien — surtout pas le
 * joueur, qui croit simplement s'être trompé.
 *
 * Les réponses sont donc des **fonctions**, pas des chaînes. Elles lisent
 * `reglage()`, `EVO_COST`, `DECK_RULES` et `SCARVES` au moment où on les rend.
 * Il n'y a pas un seul nombre écrit à la main dans les réponses, et
 * `scripts/aide-smoke.mjs` le vérifie : il change un réglage et exige que la
 * réponse change avec lui.
 *
 * ## Ce que ce fichier ne contient pas
 *
 * Aucune mise en forme, aucune balise. Les réponses sont du texte, et c'est la
 * page qui décide de leur apparence. Un jour où l'aide sera aussi lue par un
 * courriel ou par une autre langue, elle n'aura pas à démonter du HTML.
 *
 * ## Le parcours
 *
 * Six étapes, et **aucune ne se coche en cliquant**. Chacune nomme un signal
 * que le serveur lit dans ce que le joueur possède déjà — voir
 * `src/server/aide/index.js`. Une étape est donc soit vraie, soit fausse ; il
 * n'y a pas d'état « vu » à conserver, et rien à remettre à zéro.
 */
import { EVO_COST, SCARVES } from './fanzzy/dex.js';
import { DECK_RULES } from './duel/actions.js';
import { reglage } from './reglages.js';

/**
 * Les six premiers pas, dans l'ordre où on les fait.
 *
 * `cle` nomme le signal que le serveur va chercher ; `ou` est l'écran où l'on
 * va le faire, et il doit exister dans le menu — sinon on envoie quelqu'un
 * dans le vide. `visuel` dit à la page ce qu'elle dessine : « carte » tire la
 * vraie carte du joueur, « dos » le vrai dos de booster, les autres sont des
 * emblèmes.
 */
export const ETAPES = [
  {
    cle: 'fanzzy',
    titre: 'Ton premier Fanzzy',
    visuel: 'carte',
    quoi: 'Un Fanzzy est un supporter. Il n’a pas de statistique de combat : '
      + 'il a un cri, et ce cri est un geste que tu vas devoir tenir.',
    pourquoi: 'C’est lui qui décide de ce que tu joues. Un Fanzzy de la Voix te '
      + 'demande du rythme, un Déplacement te demande de la mémoire. Tu ne choisis '
      + 'pas une puissance, tu choisis un geste que tu aimes faire.',
    ou: '/fanzzy',
    bouton: 'Voir ma collection',
  },
  {
    cle: 'booster',
    titre: 'Ouvre un booster',
    visuel: 'dos',
    quoi: 'Cinq cartes. Une ou deux sont des supporters — la deuxième sept fois '
      + 'sur dix. Les trois dernières donnent autre chose : de l’équipement, une '
      + 'carte d’action, une tenue, ou des écharpes.',
    pourquoi: () => 'Un double ne se perd pas : il se change en écharpes, '
      + `${SCARVES.commune} pour une commune et jusqu’à ${SCARVES.legendaire} `
      + 'pour une légendaire. Et les écharpes sont ce qui fait grandir tes '
      + 'supporters, donc les doubles paient les âges que tu ne tireras jamais.',
    ou: '/boosters',
    bouton: 'Ouvrir un booster',
  },
  {
    cle: 'evolution',
    titre: 'Fais grandir un Fanzzy',
    visuel: 'ages',
    quoi: () => 'La rareté d’un Fanzzy, c’est son âge. Commune, c’est le premier ; '
      + `rare, le deuxième — ${EVO_COST[2]} écharpes ; épique, le troisième — `
      + `${EVO_COST[3]} de plus. Même personnage, nouveau nom, nouvelle histoire.`,
    pourquoi: 'C’est la seule façon d’obtenir une rare ou une épique : aucun '
      + 'booster n’en donne. Les légendaires, elles, n’ont pas d’âge — elles '
      + 'arrivent entières ou pas du tout.',
    ou: '/fanzzy',
    bouton: 'Choisir qui grandit',
  },
  {
    cle: 'deck',
    titre: 'Compose ton deck',
    visuel: 'deck',
    quoi: () => `${DECK_RULES.fanzzy} Fanzzy, ${DECK_RULES.stuffParFanzzy} pièces `
      + `d’équipement pour chacun, et ${DECK_RULES.actions} cartes d’action. `
      + 'Le premier Fanzzy est ton titulaire : c’est lui qui entre sur le terrain.',
    pourquoi: 'Chaque pièce d’équipement a un revers — elle donne quelque chose '
      + 'et en retire un autre. Il n’existe pas de meilleur équipement, seulement '
      + 'celui qui va avec le geste de ton titulaire.',
    ou: '/deck',
    bouton: 'Monter ma tribune',
  },
  {
    cle: 'virage',
    titre: 'Pousse dans le Grand Virage',
    visuel: 'corde',
    quoi: 'Une salle par match réel. Deux tribunes tirent sur la même corde '
      + 'pendant toute la rencontre, et tu chantes dedans avec tout le monde.',
    pourquoi: 'Personne n’y gagne seul : une tribune deux fois plus nombreuse ne '
      + 'pousse pas deux fois plus fort. Ce que tu décides, c’est ta place dans '
      + 'ta propre tribune. Et quand un vrai but tombe, la corde se secoue.',
    ou: '/virage',
    bouton: 'Entrer dans un virage',
    repeter: 'Répéter les gestes d’abord',
  },
  {
    cle: 'duel',
    titre: 'Joue un duel',
    visuel: 'duel',
    quoi: () => `Deux tribunes face à face, de ${DECK_RULES.fanzzyMin} contre `
      + `${DECK_RULES.fanzzyMin} à cinq contre cinq. Ton deck y entre tel que tu `
      + `l’as rangé, et ${DECK_RULES.mainVisible} cartes d’action te sont visibles `
      + 'à la fois.',
    pourquoi: 'Le duel s’adosse à un vrai match. Un match du jour ou en cours '
      + 'donne un duel classé, qui compte au classement ; un autre jour donne un '
      + 'entraînement, qui ne compte pas. On ne rejoue pas une soirée qu’on n’a '
      + 'pas vécue.',
    ou: '/duel-nvn',
    bouton: 'Chercher un duel',
    repeter: 'Répéter les gestes d’abord',
  },
];

/**
 * La FAQ, en rubriques.
 *
 * L'ordre suit celui du parcours : on répond d'abord à ce qu'on vient de voir.
 * Une rubrique « divers » a été refusée — c'est l'endroit où l'on range ce
 * qu'on n'a pas eu le courage de classer, et personne ne l'ouvre.
 */
const RUBRIQUES = [
  {
    titre: 'Les Fanzzy',
    questions: [
      ['Qu’est-ce qu’un Fanzzy, au juste ?',
        () => 'Un supporter, et rien d’autre. Il n’a ni attaque ni défense : il a '
          + 'un cri, et ce cri désigne un geste. Quand tu le joues, c’est ce geste '
          + 'qu’on te demande de tenir, et c’est ta main qui décide du résultat.'],
      ['Pourquoi ma carte est-elle « commune » alors qu’elle est forte ?',
        () => 'Parce que la rareté dit l’âge, pas la force. Commune est le premier '
          + `âge, rare le deuxième, épique le troisième. Un Fanzzy commun bien joué `
          + 'bat un épique mal joué : la rareté raconte le chemin parcouru, elle ne '
          + 'donne pas d’avantage automatique.'],
      ['Et les légendaires, alors ?',
        () => 'Elles sont à part. Une légendaire n’a pas de lignée : elle ne grandit '
          + 'pas et elle n’est l’âge de personne. Elle arrive entière, directement '
          + `dans un booster, et un double en rend ${SCARVES.legendaire} écharpes.`],
      ['C’est quoi une « famille » ?',
        () => 'Six façons de supporter : la Voix, la Percussion, la Fidélité, le '
          + 'Tifo, la Pyro et le Déplacement. Chaque famille annonce les gestes '
          + 'qu’elle joue, et le geste qui porte son nom y est toujours le plus '
          + 'fréquent — une Voix qui ne ferait pas surtout du rythme ne serait pas '
          + 'une Voix.'],
      ['Une tenue rend-elle mon Fanzzy meilleur ?',
        () => 'Non. Jamais. Une tenue change ce qu’on voit et rien d’autre — c’est '
          + 'une règle du jeu, pas un oubli. Ce qui compte, c’est l’équipement, et '
          + 'lui se voit dans le deck.'],
      ['Pourquoi certaines de mes cartes sont-elles floues et verrouillées ?',
        () => 'Ce sont les âges que tu n’as pas encore payés. On te montre qu’ils '
          + 'existent sans te montrer qui ils sont : découvrir le personnage fait '
          + 'partie de l’évolution.'],
    ],
  },
  {
    titre: 'Les boosters et les écharpes',
    questions: [
      ['Combien de boosters ai-je, et comment en avoir plus ?',
        () => `Tu commences avec ${reglage('pack.depart')}. La réserve se remplit `
          + `ensuite toute seule, un paquet toutes les ${reglage('pack.regen_min')} `
          + `minutes, jusqu’à ${reglage('pack.max')}. Tu peux aussi en acheter un `
          + `pour ${reglage('pack.prix_echarpes')} écharpes quand la réserve est vide.`],
      ['Il y a quoi dans un booster ?',
        () => 'Cinq cartes. La première est toujours un supporter, la deuxième l’est '
          + 'sept fois sur dix. Les trois dernières donnent une carte d’action, une '
          + 'pièce d’équipement, une tenue ou une poignée d’écharpes — jamais un '
          + 'supporter de plus.'],
      ['Que valent mes doubles ?',
        () => 'Ils deviennent des écharpes, au tarif de la rareté : '
          + `${SCARVES.commune} pour une commune, ${SCARVES.rare} pour une rare, `
          + `${SCARVES.epique} pour une épique et ${SCARVES.legendaire} pour une `
          + 'légendaire. Rien ne se perd, jamais.'],
      ['À quoi servent les écharpes ?',
        () => 'À faire grandir tes supporters, d’abord — c’est leur premier emploi. '
          + 'Ensuite à acheter un booster de plus, un emplacement de club, ou ce que '
          + 'propose la boutique.'],
      ['Pourquoi je ne tire jamais de rare ni d’épique ?',
        () => 'Parce qu’aucun booster n’en donne. Une rare est le deuxième âge d’une '
          + 'commune que tu possèdes déjà, et une épique le troisième. Elles ne se '
          + 'tirent pas : elles se paient.'],
      ['Toutes les cartes du jeu sont-elles distribuées ?',
        () => 'Non. Le jeu s’ouvre par saisons, et une saison ouvre pour tout le '
          + 'monde le même jour. Ce qui n’est pas encore ouvert ne sort d’aucun '
          + 'booster — mais rien de ce que tu possèdes déjà ne t’est jamais retiré.'],
    ],
  },
  {
    titre: 'Le deck et l’équipement',
    questions: [
      ['Que dois-je mettre dans mon deck ?',
        () => `${DECK_RULES.fanzzy} Fanzzy au plus et ${DECK_RULES.fanzzyMin} au `
          + `minimum, jusqu’à ${DECK_RULES.stuffParFanzzy} pièces d’équipement sur `
          + `chacun, et exactement ${DECK_RULES.actions} cartes d’action. Le premier `
          + 'Fanzzy est le titulaire : c’est lui qui entre.'],
      ['Pourquoi mon équipement me retire quelque chose ?',
        () => 'Parce que chaque pièce a un revers, sans exception. Elle donne d’un '
          + 'côté et reprend de l’autre. C’est ce qui fait qu’il n’existe pas de '
          + 'meilleur équipement — seulement celui qui convient au geste de ton '
          + 'titulaire.'],
      ['Puis-je mettre dix fois la même carte d’action ?',
        () => 'Oui. Une carte d’action se possède une fois et le deck en accepte '
          + `${DECK_RULES.actions} exemplaires : c’est le même droit répété. Mais un `
          + 'deck d’une seule carte ne te laisse aucune décision à prendre en duel.'],
      ['D’où viennent les cartes d’action que je n’ai jamais gagnées ?',
        () => 'Les communes sont offertes à tout le monde. Sans elles, un joueur qui '
          + `débute ne pourrait pas remplir ses ${DECK_RULES.actions} emplacements le `
          + 'premier jour.'],
      ['Mon deck change-t-il quelque chose au Grand Virage ?',
        () => 'Très peu : le Virage se joue au chant, pas au deck. Il compte pour le '
          + 'duel, où ton titulaire et ton équipement pèsent sur chaque geste.'],
    ],
  },
  {
    titre: 'Le Virage et les duels',
    questions: [
      ['C’est quoi, le Grand Virage ?',
        () => 'Une salle par match réel. Deux tribunes tirent sur une corde pendant '
          + `toute la rencontre, et la corde bascule quand un camp atteint `
          + `${reglage('virage.but_a')}. Tu y chantes avec tous ceux qui sont entrés `
          + 'du même côté que toi.'],
      ['Puis-je pousser pour un club dont je ne suis pas ?',
        () => 'Oui, tous les matchs en direct sont ouverts. Ta poussée compte '
          + 'entièrement pour la tribune — on ne décourage personne de venir. Ce qui '
          + 'est réduit de moitié, c’est la ferveur que tu gagnes, toi : on vient '
          + 'pousser partout, on ne se bâtit une réputation que chez soi.'],
      ['Si je reste sans rien faire, je compte quand même ?',
        () => `Non. Après ${reglage('virage.inactif_sec')} secondes sans geste, tu ne `
          + 'comptes plus dans la foule. Il faut chanter pour être là.'],
      ['Mon duel compte-t-il au classement ?',
        () => 'Seulement s’il s’adosse à un match du jour ou en cours. Un match d’un '
          + 'autre jour donne un entraînement, qui ne compte pas — et un match déjà '
          + 'passé est refusé.'],
      ['Qui choisit le stade ?',
        () => 'Personne. Le stade appartient au match, pas à un joueur : il se '
          + 'déduit de la rencontre, les deux camps y ont exactement les mêmes '
          + 'règles, et la même rencontre rejouée donne le même lieu. On ne peut '
          + 'pas acheter un avantage de terrain.'],
      ['Je rate toujours le même geste. Je peux m’entraîner ?',
        () => 'Oui : La répétition, dans le menu. Les vingt gestes du jeu y sont à '
          + 'l’essai, autant de fois que tu veux. Rien n’y compte — ni ferveur, ni '
          + 'écharpes, ni classement — et rien ne t’y aide non plus : aucun Fanzzy, '
          + 'aucun équipement. C’est ta main, et le même moteur qui te note en duel.'],
      ['Que se passe-t-il quand un vrai but est marqué ?',
        () => 'La corde se secoue, et une fenêtre s’ouvre où tout compte double '
          + 'pendant une minute. Le souffle offert ne va qu’à ceux qui suivent le '
          + 'club buteur.'],
    ],
  },
  {
    titre: 'Mon compte',
    questions: [
      ['À quoi sert mon niveau ?',
        () => 'À ouvrir des droits, jamais à taper plus fort : une place de deck de '
          + 'plus, un emplacement de club de plus. Le niveau ne donne aucune '
          + 'puissance — c’est une règle du jeu, écrite et tenue.'],
      ['Et l’abonnement, il donne un avantage ?',
        () => `De la largeur et du confort, jamais de la puissance : une réserve de `
          + `${reglage('abo.pack_max')} paquets au lieu de ${reglage('pack.max')}, qui `
          + `se remplit toutes les ${reglage('abo.pack_regen_min')} minutes, un club `
          + 'suivi de plus, et le droit de porter toute tenue publiée. Rien de tout '
          + 'cela ne pèse sur la corde.'],
      ['Quelle différence entre mes amis et mon KOP ?',
        () => 'Un ami est un lien entre deux personnes. Un KOP est un groupe qui '
          + 'pousse ensemble et qui apparaît comme tel dans les classements. On peut '
          + 'avoir des amis partout et n’être que d’un seul KOP.'],
      ['Puis-je changer de club ?',
        () => 'Tu peux en suivre plusieurs : tu commences avec deux emplacements, et '
          + 'les suivants s’achètent en écharpes. Ton club principal est celui qui te '
          + 'rattache à une tribune pour les classements.'],
      ['Que se passe-t-il si je perds mes cartes ?',
        () => 'Rien de ce que tu possèdes ne disparaît. Une série qui se referme '
          + 'cesse d’être distribuée, elle ne se reprend pas : ta carte reste dans '
          + 'ton classeur, dans ton deck et sur ton accueil.'],
    ],
  },
];

/** Une réponse est une fonction quand elle cite un nombre, une chaîne sinon. */
const rendre = (v) => (typeof v === 'function' ? v() : v);

/**
 * La FAQ, nombres à jour.
 *
 * Rendue à chaque appel et non mise en cache : les réglages qu'elle cite
 * changent depuis l'administration, et une aide mise en cache au démarrage
 * dirait le tarif d'avant jusqu'au prochain redémarrage.
 */
export function faq() {
  return RUBRIQUES.map((r) => ({
    titre: r.titre,
    questions: r.questions.map(([q, a]) => ({ q, r: rendre(a) })),
  }));
}

/** Le parcours, textes rendus. L'état de chaque étape vient du serveur. */
export function etapes() {
  return ETAPES.map((e) => ({
    cle: e.cle, titre: e.titre, visuel: e.visuel, ou: e.ou, bouton: e.bouton,
    repeter: e.repeter ?? null,
    quoi: rendre(e.quoi), pourquoi: rendre(e.pourquoi),
  }));
}

/** Combien de paquets rapporte le parcours entier. */
export const RECOMPENSE = 1;
