/**
 * LA REPRISE — la première série **transversale**, et le gabarit des suivantes.
 *
 * ## Pourquoi une série qui ne raconte pas une famille
 *
 * Jusqu'ici, une série était un **style** : LA TRIBUNE, ses supporters ; LE
 * BESTIAIRE, ses bestioles ; LES REVENANTS, ses fantômes. Ouvrir une série,
 * c'était donc ouvrir soixante personnages qui se ressemblent — et LA TRIBUNE
 * en compte soixante à elle seule, soit un quart du catalogue d'un coup.
 *
 * Une saison transversale fait l'inverse : douze personnages venus des six
 * familles, réunis par **le moment où ils arrivent** plutôt que par ce qu'ils
 * sont. Un booster de la saison donne quatre styles en cinq cartes.
 *
 * ## Ce qui n'a pas changé, et pourquoi c'est l'essentiel
 *
 * **La série reste l'unité de collection.** C'est elle que `aCollectionner`
 * compte, elle que la jauge de l'accueil remplit, elle qu'on choisit en ouvrant
 * un booster. Une saison qui aurait pioché trois cartes dans LA TRIBUNE, trois
 * dans LE BESTIAIRE et trois chez LES REVENANTS aurait laissé quatre séries
 * **partiellement ouvertes, et pour toujours** : plus rien à finir, jamais. Pour
 * un jeu de collection, c'est la seule chose à ne pas faire.
 *
 * D'où une série **neuve** à chaque saison, de douze lignées : variée à
 * l'intérieur, et finissable. Douze, et non soixante, pour que deux saisons
 * aient la même taille — et pour qu'on puisse la terminer avant la suivante.
 *
 * ## Ce que celle-ci raconte
 *
 * La première journée après la coupure. Tout le monde revient, et rien n'est
 * tout à fait comme avant l'été : la voix a rouillé, la peau du tambour est
 * neuve et sonne mal, la bâche sent la cave, et il y a une chaise vide au
 * troisième rang.
 *
 * C'est un sujet qui **traverse** les six familles par nature — chacun revient
 * à sa manière — et c'est pour ça qu'il fait une bonne première saison
 * transversale. Les suivantes prendront d'autres moments du calendrier : le
 * derby, le dernier match, la trêve.
 *
 * ## La répartition, et pourquoi elle est régulière
 *
 * Deux lignées communes par famille — voix, perc, fide, tifo, pyro, depl —
 * plus **cinq légendaires**. Un tirage déséquilibré ferait une série qui
 * ressemble à une famille, c'est-à-dire exactement ce qu'on cherchait à
 * éviter.
 *
 * Cinq, et non une : le catalogue exige au moins cinq légendaires par série,
 * et la raison est bonne — une série sans sommet donne des boosters qu'on
 * ouvre sans espoir. Trois séries en avaient zéro, et ça s'est vu.
 *
 * ## Les légendaires ne s'évoluent pas, et ce n'est pas un oubli
 *
 * Les soixante-cinq légendaires du catalogue ont **un seul âge**, sans
 * exception. Une légendaire arrive entière : elle ne se fait pas grandir, on la
 * trouve. C'est ce qui la distingue d'une commune, dont les trois âges se
 * paient en écharpes.
 *
 * Conséquence pour la production : une légendaire demande **36 fichiers
 * d'états** (1 âge × 12 états × 3 tenues) et une carte, au lieu de 108 et
 * trois. Les cinq réunies coûtent donc moins que deux lignées communes.
 *
 * ## Le barème, tel que le catalogue le pratique
 *
 *   — une lignée commune monte `commune` → `rare` → `epique` ;
 *   — la puissance du cri suit : ~50 / ~66 / ~80 ;
 *   — les modificateurs s'empilent, un de plus à chaque âge ;
 *   — une légendaire tourne autour de 84, et **porte un défaut** : celle-ci
 *     pousse mal au tambour. Sans lui, elle serait strictement meilleure que
 *     tout, et le deck n'aurait plus de choix à faire.
 *
 * Les modificateurs suivent la famille, comme partout : `tempoWindow` pour la
 * voix, `mashBonus` pour la percussion, `holdBonus` pour les fidèles,
 * `parryBonus` pour le tifo, `perfectBonus` et `backfire` pour la pyro,
 * `breathBonus` et `refundBonus` pour le déplacement.
 *
 * ## Les images
 *
 * Chaque lignée commune demande, pour être **vivante** — c'est-à-dire pour
 * réagir au match sur l'écran d'accueil et dans le virage :
 *
 *   — 3 âges × 12 états × 3 tenues = **108 fichiers** sous
 *     `art/<ID>/_src/<ID>-e<n>-<tenue>-<état>.png` ;
 *   — 3 cartes en pied sous `art/neuves/<ID>.png`, `<ID>B.png`, `<ID>C.png`.
 *
 * Soit 1 296 fichiers pour les douze communes, plus 180 et cinq cartes pour les
 * légendaires — 1 481 en tout.
 * `npm run dessins` dit à tout moment ce qui manque, et `npm run art:tout`
 * produit ce qui a bougé. Les trois tenues — `base`, `prehistorique`,
 * `apocalyptique` — existent déjà : rien à déclarer de ce côté.
 */

/**
 * La série de la saison d'essai.
 *
 * `RP` : deux lettres, comme les douze autres séries. Un code à chiffre — `S1`
 * — aurait donné des identifiants `S11`, `S12` où l'on ne sait plus où finit la
 * série et où commence le numéro, et `racineDe` lit justement cette frontière.
 */
export const SET_SAISON = {
  id: 'RP',
  nom: 'LA REPRISE',
  ligne: 'la première journée, et rien n’a le même son qu’en mai',
  c1: '#C7563A',
  c2: '#1A1210',
};

/* ------------------------------------------------------------------- la voix */

const VOIX = [
  { id: 'RP1', nom: 'Gosier Rouillé', type: 'voix', stage: 1, rar: 'commune', evo: 'RP1B',
    histoire: 'Deux mois sans chanter. Il attaque le premier refrain trop haut, casse au troisième mot, et regarde ailleurs.',
    mods: { tempoWindow: 1.06 },
    cri: { label: 'ÇA REVIENT', gest: 'tempo', power: 47 } },
  { id: 'RP1B', nom: 'Gosier Rodé', type: 'voix', stage: 2, rar: 'rare', evo: 'RP1C',
    histoire: 'Troisième journée. La voix a retrouvé sa place, un peu plus bas qu’avant, et elle tient toute la seconde mi-temps.',
    mods: { tempoWindow: 1.12, tempoInterval: 60 },
    cri: { label: 'PLEINE VOIX', gest: 'tempo', power: 65 } },
  { id: 'RP1C', nom: 'Gosier de Bronze', type: 'voix', stage: 3, rar: 'epique',
    histoire: 'Il ne force plus. Il lance, s’arrête, et deux mille personnes continuent sans lui — c’est à ça qu’on voit qu’il a repris.',
    mods: { tempoWindow: 1.19, tempoInterval: 52, breathBonus: 1.07 },
    cri: { label: 'CONTINUEZ', gest: 'tempo', power: 80 } },

  { id: 'RP2', nom: 'Chant Oublié', type: 'voix', stage: 1, rar: 'commune', evo: 'RP2B',
    histoire: 'Personne ne se rappelle le deuxième couplet. On chante le premier deux fois et on fait semblant que c’était prévu.',
    mods: { tempoWindow: 1.05 },
    cri: { label: 'LA LA LA', gest: 'echo', power: 45 } },
  { id: 'RP2B', nom: 'Chant Retrouvé', type: 'voix', stage: 2, rar: 'rare', evo: 'RP2C',
    histoire: 'Quelqu’un a remis la main sur les paroles. Elles étaient au dos d’un programme de 2019, dans une poche de veste.',
    mods: { tempoWindow: 1.1, refundBonus: 1.08 },
    cri: { label: 'ON L’A RETROUVÉ', gest: 'echo', power: 64 } },
  { id: 'RP2C', nom: 'Chant Transmis', type: 'voix', stage: 3, rar: 'epique',
    histoire: 'Les gamins du dernier rang le connaissent maintenant. Ils l’ont appris sans qu’on le leur explique, ce qui est la seule façon.',
    mods: { tempoWindow: 1.16, refundBonus: 1.14, perfectBonus: 1.08 },
    cri: { label: 'ILS LE SAVENT', gest: 'echo', power: 79 } },
];

/* ------------------------------------------------------------ la percussion */

const PERC = [
  { id: 'RP3', nom: 'Peau Neuve', type: 'perc', stage: 1, rar: 'commune', evo: 'RP3B',
    histoire: 'Le tambour a été retendu en juillet. Il sonne clair, net, et absolument faux — il lui manque dix matchs d’humidité.',
    mods: { mashBonus: 1.06 },
    cri: { label: 'PREMIER COUP', gest: 'mash', power: 48 } },
  { id: 'RP3B', nom: 'Fût Rodé', type: 'perc', stage: 2, rar: 'rare', evo: 'RP3C',
    histoire: 'Cinq matchs plus tard, la peau s’est détendue juste ce qu’il faut. Le son est revenu s’asseoir dans le grave.',
    mods: { mashBonus: 1.12, mashTime: 58 },
    cri: { label: 'IL EST REVENU', gest: 'mash', power: 66 } },
  { id: 'RP3C', nom: 'Tambour de la Reprise', type: 'perc', stage: 3, rar: 'epique',
    histoire: 'On le reconnaît du parking. Deux saisons qu’il n’avait plus ce son-là, et il ne l’aura plus après décembre.',
    mods: { mashBonus: 1.2, mashTime: 50, breathBonus: 1.06 },
    cri: { label: 'DU PARKING', gest: 'mash', power: 81 } },

  { id: 'RP4', nom: 'Mains Molles', type: 'perc', stage: 1, rar: 'commune', evo: 'RP4B',
    histoire: 'La corne a fondu pendant l’été. Vingt minutes de frappe et les paumes sont à vif, comme la première année.',
    mods: { mashBonus: 1.05 },
    cri: { label: 'ÇA PIQUE', gest: 'crescendo', power: 46 } },
  { id: 'RP4B', nom: 'Mains Revenues', type: 'perc', stage: 2, rar: 'rare', evo: 'RP4C',
    histoire: 'Les ampoules ont percé, séché, durci. Il tient la mi-temps entière sans regarder ses mains.',
    mods: { mashBonus: 1.11, mashTime: 62 },
    cri: { label: 'PLUS RIEN', gest: 'crescendo', power: 63 } },
  { id: 'RP4C', nom: 'Mains Dures', type: 'perc', stage: 3, rar: 'epique',
    histoire: 'Il ne sent plus rien. C’est un avantage neuf mois par an, et un inconvénient les trois autres.',
    mods: { mashBonus: 1.18, mashTime: 54, parryBonus: 1.07 },
    cri: { label: 'JUSQU’AU BOUT', gest: 'crescendo', power: 78 } },
];

/* --------------------------------------------------------------- les fidèles */

const FIDE = [
  { id: 'RP5', nom: 'Abonnement Renouvelé', type: 'fide', stage: 1, rar: 'commune', evo: 'RP5B',
    histoire: 'Repris en juillet, sans réfléchir, le lendemain de l’ouverture. Même rang, même place, même voisin.',
    mods: { holdBonus: 1.06 },
    cri: { label: 'MÊME PLACE', gest: 'hold', power: 49 } },
  { id: 'RP5B', nom: 'Carte Tamponnée', type: 'fide', stage: 2, rar: 'rare', evo: 'RP5C',
    histoire: 'Douze tampons, douze samedis. Elle ne sert à rien — le contrôle se fait au téléphone — et il la fait tamponner quand même.',
    mods: { holdBonus: 1.12, holdForgive: 1 },
    cri: { label: 'DOUZE SUR DOUZE', gest: 'hold', power: 66 } },
  { id: 'RP5C', nom: 'Siège à Son Nom', type: 'fide', stage: 3, rar: 'epique',
    histoire: 'Une petite plaque vissée sur l’accoudoir. Ce n’est pas le club qui l’a mise, c’est le rang.',
    mods: { holdBonus: 1.2, holdForgive: 2, breathBonus: 1.06 },
    cri: { label: 'C’EST LA MIENNE', gest: 'hold', power: 81 } },

  { id: 'RP6', nom: 'Chaise Vide', type: 'fide', stage: 1, rar: 'commune', evo: 'RP6B',
    histoire: 'Troisième rang, côté couloir. Personne ne s’assied dessus le premier jour, et personne n’en parle.',
    mods: { holdBonus: 1.07 },
    cri: { label: 'ON SAIT', gest: 'jauge', power: 50 } },
  { id: 'RP6B', nom: 'Chaise Reprise', type: 'fide', stage: 2, rar: 'rare', evo: 'RP6C',
    histoire: 'Sa fille s’y est mise à la troisième journée. Elle ne connaît pas les chants et elle est à l’heure.',
    mods: { holdBonus: 1.13, holdForgive: 1 },
    cri: { label: 'ELLE EST LÀ', gest: 'jauge', power: 67 } },
  { id: 'RP6C', nom: 'Chaise Léguée', type: 'fide', stage: 3, rar: 'epique',
    histoire: 'Elle connaît les chants maintenant. Elle les a appris comme lui les avait appris, en les entendant.',
    mods: { holdBonus: 1.21, holdForgive: 2, parryResist: 1.1 },
    cri: { label: 'ELLE CONTINUE', gest: 'jauge', power: 83 } },
];

/* ------------------------------------------------------------------ le tifo */

const TIFO = [
  { id: 'RP7', nom: 'Bâche Repliée', type: 'tifo', stage: 1, rar: 'commune', evo: 'RP7B',
    histoire: 'Sortie de la cave le matin même. Elle sent l’humidité et elle a pris un pli au milieu du mot.',
    mods: { parryBonus: 1.06 },
    cri: { label: 'ON LA DÉPLIE', gest: 'tifo', power: 47 } },
  { id: 'RP7B', nom: 'Bâche Déployée', type: 'tifo', stage: 2, rar: 'rare', evo: 'RP7C',
    histoire: 'Deux heures de fers à repasser dans le local. Le pli est encore là si on cherche, et personne ne cherche.',
    mods: { parryBonus: 1.12, tempoWindow: 1.06 },
    cri: { label: 'ELLE TIENT', gest: 'tifo', power: 65 } },
  { id: 'RP7C', nom: 'Bâche Repeinte', type: 'tifo', stage: 3, rar: 'epique',
    histoire: 'Refaite à neuf, même dessin, même faute d’orthographe. La corriger aurait été la remplacer.',
    mods: { parryBonus: 1.19, tempoWindow: 1.1, parryResist: 1.08 },
    cri: { label: 'LA MÊME', gest: 'tifo', power: 80 } },

  { id: 'RP8', nom: 'Carré Manquant', type: 'tifo', stage: 1, rar: 'commune', evo: 'RP8B',
    histoire: 'La mosaïque a un trou au rang neuf. Quelqu’un a gardé son carton pour s’asseoir dessus.',
    mods: { parryBonus: 1.05 },
    cri: { label: 'IL EN MANQUE UN', gest: 'mosaique', power: 45 } },
  { id: 'RP8B', nom: 'Carré Retrouvé', type: 'tifo', stage: 2, rar: 'rare', evo: 'RP8C',
    histoire: 'On a refait le comptage trois fois. Le carton était sous un siège, plié en quatre, encore tiède.',
    mods: { parryBonus: 1.11, perfectBonus: 1.07 },
    cri: { label: 'RANG NEUF', gest: 'mosaique', power: 64 } },
  { id: 'RP8C', nom: 'Mosaïque Entière', type: 'tifo', stage: 3, rar: 'epique',
    histoire: 'Vue d’en face, elle est parfaite. Vue d’ici, c’est deux mille personnes qui ont levé un carton en même temps.',
    mods: { parryBonus: 1.18, perfectBonus: 1.13, breathBonus: 1.05 },
    cri: { label: 'D’EN FACE', gest: 'mosaique', power: 79 } },
];

/* ------------------------------------------------------------------ la pyro */

const PYRO = [
  { id: 'RP9', nom: 'Mèche Humide', type: 'pyro', stage: 1, rar: 'commune', evo: 'RP9B',
    histoire: 'Stockée tout l’été dans un garage. Elle part au troisième essai, avec quatre secondes de retard sur le but.',
    mods: { perfectBonus: 1.05, backfire: 1.1 },
    cri: { label: 'ALLEZ, PARS', gest: 'relance', power: 46 } },
  { id: 'RP9B', nom: 'Mèche Sèche', type: 'pyro', stage: 2, rar: 'rare', evo: 'RP9C',
    histoire: 'Rangée au sec cette fois, et comptée. Elle part du premier coup et c’est déjà une nouvelle.',
    mods: { perfectBonus: 1.12, backfire: 1.04 },
    cri: { label: 'DU PREMIER COUP', gest: 'relance', power: 65 } },
  { id: 'RP9C', nom: 'Mèche Courte', type: 'pyro', stage: 3, rar: 'epique',
    histoire: 'Il l’allume une seconde avant le corner. Personne ne lui a jamais demandé comment il sait.',
    mods: { perfectBonus: 1.2, backfire: 0.96, refundBonus: 1.08 },
    cri: { label: 'MAINTENANT', gest: 'relance', power: 82 } },

  { id: 'RP10', nom: 'Décompte Oublié', type: 'pyro', stage: 1, rar: 'commune', evo: 'RP10B',
    histoire: 'Cinq, quatre, trois — et deux tribunes qui partent à des moments différents. C’est la reprise.',
    mods: { perfectBonus: 1.06, costPenalty: 1.05 },
    cri: { label: 'CINQ, QUATRE…', gest: 'visee', power: 48 } },
  { id: 'RP10B', nom: 'Décompte Repris', type: 'pyro', stage: 2, rar: 'rare', evo: 'RP10C',
    histoire: 'On a remis quelqu’un au mégaphone. Les deux tribunes partent ensemble, à une demi-seconde près.',
    mods: { perfectBonus: 1.13, costPenalty: 1 },
    cri: { label: 'ENSEMBLE', gest: 'visee', power: 66 } },
  { id: 'RP10C', nom: 'Décompte Tenu', type: 'pyro', stage: 3, rar: 'epique',
    histoire: 'Plus besoin de mégaphone. Il lève la main, et trois mille personnes comptent dans leur tête.',
    mods: { perfectBonus: 1.2, backfire: 0.95, breathBonus: 1.06 },
    cri: { label: 'ZÉRO', gest: 'visee', power: 81 } },
];

/* ---------------------------------------------------------- le déplacement */

const DEPL = [
  { id: 'RP11', nom: 'Car Repeint', type: 'depl', stage: 1, rar: 'commune', evo: 'RP11B',
    histoire: 'Refait pendant l’été, aux couleurs du club. Ça sent la peinture et personne n’ose manger dedans.',
    mods: { breathBonus: 1.06 },
    cri: { label: 'IL EST BEAU', gest: 'echarpe', power: 47 } },
  { id: 'RP11B', nom: 'Car Rodé', type: 'depl', stage: 2, rar: 'rare', evo: 'RP11C',
    histoire: 'Quatre déplacements plus tard, il y a une trace de kebab au rang six et plus personne ne sent la peinture.',
    mods: { breathBonus: 1.12, refundBonus: 1.08 },
    cri: { label: 'IL EST À NOUS', gest: 'echarpe', power: 65 } },
  { id: 'RP11C', nom: 'Car de Tête', type: 'depl', stage: 3, rar: 'epique',
    histoire: 'Celui qui ouvre le convoi. On s’y bat pour une place, et il n’a pas de toilettes.',
    mods: { breathBonus: 1.19, refundBonus: 1.14, holdBonus: 1.06 },
    cri: { label: 'DERRIÈRE NOUS', gest: 'echarpe', power: 80 } },

  { id: 'RP12', nom: 'Itinéraire Perdu', type: 'depl', stage: 1, rar: 'commune', evo: 'RP12B',
    histoire: 'La feuille de route de l’an dernier a servi à caler une table. On refait tout au téléphone, sur l’autoroute.',
    mods: { breathBonus: 1.05 },
    cri: { label: 'À DROITE, NON', gest: 'bascule', power: 45 } },
  { id: 'RP12B', nom: 'Itinéraire Refait', type: 'depl', stage: 2, rar: 'rare', evo: 'RP12C',
    histoire: 'Tapé au propre, imprimé en douze exemplaires, plastifié par quelqu’un qui y tient.',
    mods: { breathBonus: 1.11, refundBonus: 1.09 },
    cri: { label: 'SORTIE 14', gest: 'bascule', power: 64 } },
  { id: 'RP12C', nom: 'Itinéraire par Cœur', type: 'depl', stage: 3, rar: 'epique',
    histoire: 'Il connaît les trois stations-service qui ouvrent la nuit et celle où le café est buvable. C’est une science.',
    mods: { breathBonus: 1.18, refundBonus: 1.15, parryResist: 1.07 },
    cri: { label: 'JE CONNAIS', gest: 'bascule', power: 79 } },
];

/* ------------------------------------------------------------ les cinq sommets

   **Cinq, et non une.** C'était une au premier jet, et le contrôle du catalogue
   l'a refusée : « chaque série a au moins cinq légendaires de stade 1 ». La
   raison est écrite dans `catalogue-smoke.mjs`, et elle est bonne — trois
   séries en avaient zéro, et « un joueur qui collectionnait ces trois-là
   ouvrait des boosters sans sommet ». Une série est une étagère ; une étagère
   sans rien de rare en haut ne donne envie de rien.

   **Aucune n'a d'âge supérieur.** Les soixante-cinq légendaires du catalogue
   sont dans ce cas, sans exception : une légendaire arrive entière, on ne la
   fait pas grandir. C'est ce qui la distingue d'une commune, dont les trois
   âges se paient en écharpes — et le catalogue refuse de démarrer si on lui en
   écrit une qui évolue, parce qu'elle se déclasserait au premier passage.

   **Chacune porte un défaut**, comme celles d'avant. Sans lui, une légendaire
   serait strictement meilleure que tout, et le deck n'aurait plus de choix à
   faire — ce qui est la façon la plus sûre de tuer une composition.

   **Et chacune joue le geste de sa famille.** Ce n'est pas un ornement : le
   catalogue vérifie que le geste éponyme reste majoritaire chez chaque famille,
   et il a rougi sur les fidèles au premier jet — trente-huit `hold` sur
   soixante-dix-sept, à un demi près. Une Voix dont le tempo serait minoritaire
   ne serait plus une Voix, quelle que soit sa liste.

   Côté production, une légendaire coûte **36 fichiers d'états** (un seul âge)
   et une carte, au lieu de 108 et trois. Les cinq réunies coûtent donc moins
   que deux lignées communes. */

const LEGENDAIRE = [
  { id: 'RP13', nom: 'La Clé du Local', type: 'fide', stage: 1, rar: 'legendaire',
    histoire: 'Elle ouvre une porte en tôle derrière la tribune. Il arrive deux heures avant tout le monde, allume la lumière, met le chauffage, et à midi le local sent le café. Personne ne lui a donné cette clé — il l’a, c’est tout.',
    mods: { holdBonus: 1.24, holdForgive: 2, breathBonus: 1.12, mashBonus: 0.92 },
    cri: { label: 'C’EST OUVERT', gest: 'hold', power: 84 } },

  { id: 'RP14', nom: 'Le Premier Cri', type: 'voix', stage: 1, rar: 'legendaire',
    histoire: 'Quatorze heures cinquante-huit. Deux mille personnes attendent que quelqu’un commence, et personne n’ose. Il se lève, prend son souffle, et lance quatre notes de travers — après quoi le stade entier sait que la saison a repris.',
    mods: { tempoWindow: 1.26, tempoInterval: 46, perfectBonus: 1.14, holdBonus: 0.9 },
    cri: { label: 'C’EST REPARTI', gest: 'tempo', power: 86 } },

  { id: 'RP15', nom: 'Le Fût Jamais Rangé', type: 'perc', stage: 1, rar: 'legendaire',
    histoire: 'Il n’est pas descendu à la cave. Il a passé l’été sur un parking, sous une bâche de camion, et on l’a entendu tous les mercredis. Il n’a aucune peau neuve à roder : il n’a jamais arrêté.',
    mods: { mashBonus: 1.25, mashTime: 44, breathBonus: 1.1, tempoWindow: 0.92 },
    cri: { label: 'JAMAIS ARRÊTÉ', gest: 'mash', power: 85 } },

  { id: 'RP16', nom: 'La Bâche de la Trêve', type: 'tifo', stage: 1, rar: 'legendaire',
    histoire: 'Douze mètres, peinte en juillet dans un hangar prêté, par six personnes qui ne se sont pas vues de l’année. Personne ne l’a montrée avant. Elle tombe des balcons à la quarantième seconde, et il n’y a plus un bruit.',
    mods: { parryBonus: 1.26, parryResist: 1.14, perfectBonus: 1.1, mashBonus: 0.9 },
    cri: { label: 'DOUZE MÈTRES', gest: 'tifo', power: 85 } },

  { id: 'RP17', nom: 'La Première Torche', type: 'pyro', stage: 1, rar: 'legendaire',
    histoire: 'Celle de la reprise, gardée d’une saison sur l’autre dans une boîte à chaussures. On la garde trop longtemps, et elle finit par partir dans un nuage bien plus gros que prévu. C’est la seule qu’on annonce à personne.',
    mods: { perfectBonus: 1.24, backfire: 0.9, refundBonus: 1.12, holdBonus: 0.92 },
    cri: { label: 'ELLE EST PARTIE', gest: 'relance', power: 83 } },
];

/**
 * Les dix-sept lignées, quarante et une entrées.
 *
 * `set` est posé **ici, une fois**, et non recopié sur chaque entrée. Trente-sept
 * fois le même mot est trente-sept occasions de l'oublier — et l'oubli ne se
 * voit pas en relisant : la carte part au catalogue avec une série `undefined`,
 * elle devient tirable et invisible. Le contrôle de `dex.js` l'attrape, ce qui
 * est exactement pourquoi il existe, mais autant ne pas lui donner de travail.
 */
export const DEX_SAISON = [
  ...VOIX, ...PERC, ...FIDE, ...TIFO, ...PYRO, ...DEPL, ...LEGENDAIRE,
].map((f) => ({ ...f, set: SET_SAISON.id }));
