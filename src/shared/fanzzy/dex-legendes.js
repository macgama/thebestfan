/**
 * Les légendaires, cinq par série.
 *
 * ## Pourquoi un fichier de plus
 *
 * Il y en avait quatorze pour neuf séries, et elles étaient très mal réparties :
 * cinq aux REVENANTS, trois aux ÉPOQUES, deux ailleurs, et **zéro** à VIRAGE
 * NORD, au VIRAGE IMPOSSIBLE et à CE QUI TRAÎNE AU STADE. Un joueur qui
 * collectionnait ces trois séries-là n'avait aucune carte haute à espérer : il
 * ouvrait des boosters sans sommet.
 *
 * Elles vivent à part parce qu'elles se lisent ensemble. Une légendaire n'est
 * pas une commune avec de meilleurs chiffres : c'est la carte qui donne son
 * point le plus haut à une série, et les neuf points hauts doivent se tenir.
 * Éparpillées dans deux mille lignes, personne ne pouvait les comparer — et
 * c'est exactement comme ça qu'on se retrouve avec cinq d'un côté et zéro de
 * l'autre.
 *
 * ## Ce qu'est une légendaire ici
 *
 * — **Elle ne grandit pas.** Pas de `evo`, pas d'entrée dans `dex-ages.js` :
 *   `dex.js` lève si on lui en écrit une. C'est sa définition. Elle ne se
 *   fabrique pas à l'écharpe, elle se tire.
 * — **Elle a un défaut.** Toutes. Une carte qui n'a que des bonus ne se
 *   choisit pas, elle s'empile : à trois Fanzzy en tribune on prendrait les
 *   trois plus forts, et le deck cesserait d'être une décision.
 * — **Sa puissance de cri va de 72 à 84.** En dessous, elle ne se distingue
 *   pas d'une bonne commune ; au-dessus, elle rend les autres inutiles. Les
 *   quatorze existantes tiennent déjà dans cette plage, et les trente et une
 *   nouvelles s'y rangent.
 * — **Son geste n'est pas toujours du rythme.** Cinq des quinze gestes
 *   n'étaient portés par presque personne au catalogue. Les légendaires les
 *   prennent en charge : c'est la carte qu'on regarde, donc celle par qui on
 *   découvre qu'un geste existe.
 *
 * Vocabulaire des modificateurs : voir l'en-tête de `dex-2026.js`.
 */

export const DEX_LEGENDES = [

  /* ======================================= L'ANCIEN VIRAGE NORD (5 neuves)

     Sa série a été dissoute et ces cinq-là sont passées à LA TRIBUNE : capo,
     bâche, tambour, muret, torche sont les archétypes du virage ordinaire.

     Le virage d'origine, celui des cartes `X`. Sa numérotation reprend là où
     le lot de 2026 l'avait laissée — X52 et suivants — plutôt que de rouvrir
     des trous : un identifiant réutilisé désigne deux cartes dans les
     sauvegardes des joueurs qui possédaient la première.                   */

  { id: 'X52', nom: 'Le Capo Historique', type: 'voix', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Trente et un ans dos au terrain. Il n’a jamais vu un but de sa vie et '
      + 'il les a tous entendus.',
    mods: { tempoWindow: 1.28, breathBonus: 1.2, parryResist: 0.85 },
    cri: { label: 'TOUT LE MONDE DEBOUT', gest: 'echo', power: 82 } },

  { id: 'X53', nom: 'La Bâche de 89', type: 'tifo', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Repeinte quatre fois, recousue partout. On devine encore le premier nom '
      + 'dessous, et personne n’ose le recouvrir tout à fait.',
    mods: { parryBonus: 1.55, perfectBonus: 1.2, tempoWindow: 0.86 },
    cri: { label: 'ELLE A TOUT VU', gest: 'mosaique', power: 80 } },

  { id: 'X54', nom: 'Le Tambour Fêlé', type: 'perc', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'La peau est crevée depuis un derby de 2011. Il sonne faux et le virage '
      + 'tape dessus quand même, parce que c’est ce son-là qu’il connaît.',
    mods: { mashBonus: 1.34, mashTime: 900, holdBonus: 0.88 },
    cri: { label: 'ÇA SONNE PAS, ON TAPE', gest: 'crescendo', power: 78 } },

  { id: 'X55', nom: 'Le Muret du Fond', type: 'fide', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Deux mètres de béton où quatre générations ont écrit au marqueur. '
      + 'Il ne bouge pas, il ne chante pas, et sans lui le virage s’assoit.',
    mods: { holdBonus: 1.4, holdForgive: 3, parryResist: 1.25, tempoInterval: 90 },
    cri: { label: 'ON NE RECULE PAS', gest: 'tenue', power: 81 } },

  { id: 'X56', nom: 'La Torche de Minuit', type: 'pyro', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Allumée une seule fois par saison, au moment que personne ne choisit. '
      + 'Elle décide toute seule et le virage suit.',
    mods: { perfectBonus: 1.5, refundBonus: 1.3, backfire: 1.45 },
    cri: { label: 'MAINTENANT', gest: 'compte', power: 84 } },

  /* =================================== LES ANCIENNES NUITS (3 neuves)

     Elle en avait déjà deux — le Parcage 400 places et la Nuit du 8e. La série
     a été dissoute : les cinq sont passées aux GALÈRES DE DÉPLACEMENT, qui sont
     exactement leur sujet.                                                  */

  { id: 'X57', nom: 'Le Douanier du Car 3', type: 'depl', set: 'GD', stage: 1, rar: 'legendaire',
    histoire: 'Il a compté les mêmes trente-neuf personnes à l’aller et au retour, '
      + 'pendant vingt ans, et il n’en a jamais perdu une.',
    mods: { breathBonus: 1.38, refundBonus: 1.25, mashBonus: 0.88 },
    cri: { label: 'PERSONNE NE RESTE', gest: 'memoire', power: 77 } },

  { id: 'X58', nom: 'La Mosaïque de Séville', type: 'tifo', set: 'GD', stage: 1, rar: 'legendaire',
    histoire: 'Douze mille cartons distribués en quarante minutes par huit personnes '
      + 'qui ne s’étaient jamais rencontrées.',
    mods: { perfectBonus: 1.42, parryBonus: 1.2, costPenalty: 1.18 },
    cri: { label: 'LEVEZ, MAINTENANT', gest: 'tri', power: 83 } },

  { id: 'X59', nom: 'Le Dernier Train', type: 'depl', set: 'GD', stage: 1, rar: 'legendaire',
    histoire: 'Il part à 23 h 14 et le match finit à 23 h 09. Ceux qui le prennent '
      + 'chantent plus fort que tout le monde jusqu’à la 88e.',
    mods: { tempoInterval: -80, breathBonus: 1.22, holdForgive: 0 },
    cri: { label: 'ON A CINQ MINUTES', gest: 'memoire', power: 79 } },

  /* =========================================== LE VIRAGE IMPOSSIBLE (5 neuves)

     La série des situations qui ne devraient pas exister. Elle n'avait aucune
     carte haute, ce qui était le comble pour une série qui porte ce nom.    */

  { id: 'X60', nom: 'Le But Refusé Trois Fois', type: 'pyro', set: 'IM', stage: 1, rar: 'legendaire',
    histoire: 'Trois arbitres, trois décisions, trois fois le même silence. Le virage '
      + 'a chanté les trois fois, plus fort à chaque reprise.',
    mods: { perfectBonus: 1.46, refundBonus: 1.4, backfire: 1.5 },
    cri: { label: 'ON RECOMMENCE', gest: 'compte', power: 83 } },

  { id: 'X61', nom: 'La Minute 97', type: 'voix', set: 'IM', stage: 1, rar: 'legendaire',
    histoire: 'Il n’y avait que six minutes annoncées. Personne n’a jamais su d’où '
      + 'venait la septième, et personne ne l’a réclamée.',
    mods: { tempoWindow: 1.32, tempoInterval: -60, parryResist: 0.8 },
    cri: { label: 'ENCORE UNE', gest: 'capo', power: 84 } },

  { id: 'X62', nom: 'Le Gardien qui Monte', type: 'depl', set: 'IM', stage: 1, rar: 'legendaire',
    histoire: 'Il a traversé tout le terrain sur un corner et il n’est jamais redescendu '
      + 'dans les mémoires.',
    mods: { mashBonus: 1.42, breathBonus: 1.15, parryResist: 0.72 },
    cri: { label: 'IL MONTE', gest: 'memoire', power: 82 } },

  { id: 'X63', nom: 'Le Virage à Sept', type: 'fide', set: 'IM', stage: 1, rar: 'legendaire',
    histoire: 'Huis clos partiel, sept personnes autorisées. Ils ont fait le service '
      + 'complet, chant par chant, pour un stade vide.',
    mods: { holdBonus: 1.44, breathBonus: 1.3, mashBonus: 0.82 },
    cri: { label: 'ON EST LÀ QUAND MÊME', gest: 'retenue', power: 80 } },

  { id: 'X64', nom: 'La Remontada de Nulle Part', type: 'perc', set: 'IM', stage: 1, rar: 'legendaire',
    histoire: 'Zéro-trois à la mi-temps. Personne n’est parti, et c’est la seule chose '
      + 'que le virage revendique.',
    mods: { mashBonus: 1.3, perfectBonus: 1.34, costPenalty: 1.22 },
    cri: { label: 'RIEN N’EST FINI', gest: 'salves', power: 84 } },

  /* ==================================================== LA TRIBUNE (4 neuves)

     Elle n'en avait qu'une — le Ballon de Cuir — pour vingt-sept cartes. La
     série la plus nombreuse était celle où l'on espérait le moins.          */

  { id: 'TR28', nom: 'L’Abonné du Siège 1', type: 'fide', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Première rangée, première place, depuis l’ouverture du stade. Le club a '
      + 'changé trois fois de propriétaire, lui n’a jamais changé de siège.',
    mods: { holdBonus: 1.38, holdForgive: 3, refundBonus: 1.2, tempoWindow: 0.88 },
    cri: { label: 'J’ÉTAIS DÉJÀ LÀ', gest: 'tenue', power: 80 } },

  { id: 'TR29', nom: 'La Mère du Virage', type: 'voix', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Elle engueule l’arbitre, l’attaquant et son propre fils dans la même '
      + 'phrase. Trois rangées se taisent quand elle reprend son souffle.',
    mods: { tempoWindow: 1.26, breathBonus: 1.24, parryResist: 0.86 },
    cri: { label: 'ET TIENS-TOI DROIT', gest: 'capo', power: 81 } },

  { id: 'TR30', nom: 'Le Gamin sur les Épaules', type: 'voix', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Il ne connaît pas les paroles et il crie plus fort que tout le monde. '
      + 'Dans douze ans ce sera lui qui portera quelqu’un.',
    mods: { tempoInterval: -70, perfectBonus: 1.3, holdBonus: 0.84 },
    cri: { label: 'PLUS FORT', gest: 'contretemps', power: 76 } },

  { id: 'TR31', nom: 'L’Écharpe des Trois Générations', type: 'tifo', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Le grand-père l’a tricotée, le père l’a brûlée à moitié, le fils l’a '
      + 'recousue. Elle est trop courte pour le cou de personne.',
    mods: { parryBonus: 1.48, holdBonus: 1.18, mashBonus: 0.86 },
    cri: { label: 'ELLE RESTE DANS LA FAMILLE', gest: 'mosaique', power: 79 } },

  /* ======================================== LES MÉTIERS DU STADE (3 neuves) */

  { id: 'MS27', nom: 'Le Jardinier de Nuit', type: 'fide', set: 'MS', stage: 1, rar: 'legendaire',
    histoire: 'Il tond en diagonale depuis 1994 parce qu’un entraîneur le lui a demandé '
      + 'une fois. L’entraîneur est mort, la diagonale reste.',
    mods: { holdBonus: 1.32, parryResist: 1.3, tempoInterval: 100 },
    cri: { label: 'LE TERRAIN EST PRÊT', gest: 'retenue', power: 78 } },

  { id: 'MS28', nom: 'La Voix des Annonces', type: 'voix', set: 'MS', stage: 1, rar: 'legendaire',
    histoire: 'Quarante mille personnes reconnaissent sa voix et douze savent son nom. '
      + 'Elle annonce les buts comme on annonce une naissance.',
    mods: { tempoWindow: 1.3, refundBonus: 1.28, backfire: 1.3 },
    cri: { label: 'BUTEUR, NUMÉRO…', gest: 'contretemps', power: 82 } },

  { id: 'MS29', nom: 'Le Régisseur des Lumières', type: 'tifo', set: 'MS', stage: 1, rar: 'legendaire',
    histoire: 'Il éteint tout pendant huit secondes avant le coup d’envoi. Il a inventé '
      + 'ça un soir de panne et personne ne l’a jamais su.',
    mods: { perfectBonus: 1.44, parryBonus: 1.22, breathBonus: 0.88 },
    cri: { label: 'NOIR COMPLET', gest: 'tri', power: 81 } },

  /* ==================================== LE BESTIAIRE DES GRADINS (4 neuves) */

  { id: 'BG24', nom: 'Le Chien du Parcage', type: 'depl', set: 'BG', stage: 1, rar: 'legendaire',
    histoire: 'Il monte dans le car sans billet et il descend au bon arrêt. Personne ne '
      + 'sait à qui il est et tout le monde l’attend.',
    mods: { breathBonus: 1.34, mashBonus: 1.14, parryResist: 0.8 },
    cri: { label: 'IL EST DÉJÀ MONTÉ', gest: 'memoire', power: 77 } },

  { id: 'BG25', nom: 'Le Corbeau des Projecteurs', type: 'tifo', set: 'BG', stage: 1, rar: 'legendaire',
    histoire: 'Il se pose sur le pylône nord à la 70e, tous les matchs. Le virage a '
      + 'décidé que c’était bon signe, et il a rarement eu tort.',
    mods: { parryBonus: 1.42, perfectBonus: 1.26, tempoInterval: 110 },
    cri: { label: 'IL EST REVENU', gest: 'tri', power: 80 } },

  { id: 'BG26', nom: 'La Guêpe de Septembre', type: 'pyro', set: 'BG', stage: 1, rar: 'legendaire',
    histoire: 'Un rang entier debout, les bras en l’air, et pas une note chantée. '
      + 'Le virage d’en face a cru à un tifo et a répondu.',
    mods: { perfectBonus: 1.48, tempoInterval: -90, backfire: 1.55 },
    cri: { label: 'BOUGE PAS', gest: 'compte', power: 79 } },

  /* Il s'appelait « Le Chat du Terrain », **exactement comme BG15** — deux
     cartes, un seul nom, dans la même série. Un collectionneur qui voit deux
     fois la même ligne dans son classeur croit à un doublon et cherche ce
     qu'il a raté.
     Celle-ci est la légendaire, et elle raconte un moment précis : les neuf
     minutes. C'est ce moment qui la nomme désormais. BG15, la commune, garde le
     nom générique — c'est le même chat, ce n'est pas la même carte. */
  { id: 'BG27', nom: 'Les Neuf Minutes', type: 'fide', set: 'BG', stage: 1, rar: 'legendaire',
    histoire: 'Neuf minutes d’arrêt de jeu, quatre stadiers à quatre pattes, et lui '
      + 'assis au point de penalty à se laver une patte.',
    mods: { holdBonus: 1.36, holdForgive: 4, mashBonus: 0.8 },
    cri: { label: 'IL PREND SON TEMPS', gest: 'tenue', power: 78 } },

  /* ================================= CE QUI TRAÎNE AU STADE (5 neuves)

     Les objets qui se sont levés. Elle n'avait aucune carte haute non plus. */

  { id: 'OB13', nom: 'Le Siège 12B', type: 'fide', set: 'OB', stage: 1, rar: 'legendaire',
    histoire: 'Cassé depuis onze ans, jamais remplacé. Son abonné s’assoit dessus quand '
      + 'même et prétend que c’est plus confortable.',
    mods: { holdBonus: 1.42, parryResist: 1.28, tempoWindow: 0.85 },
    cri: { label: 'IL TIENT ENCORE', gest: 'retenue', power: 80 } },

  { id: 'OB14', nom: 'Le Mégaphone Rouillé', type: 'voix', set: 'OB', stage: 1, rar: 'legendaire',
    histoire: 'Il grésille et il déforme, et c’est précisément pour ça qu’on l’entend '
      + 'du virage d’en face.',
    mods: { tempoWindow: 1.34, perfectBonus: 1.2, refundBonus: 0.82 },
    cri: { label: 'RÉPÉTEZ APRÈS MOI', gest: 'contretemps', power: 83 } },

  { id: 'OB15', nom: 'Le Bidon Percé', type: 'perc', set: 'OB', stage: 1, rar: 'legendaire',
    histoire: 'Ramassé derrière la buvette en 2007. Il a remplacé un vrai tambour '
      + 'pendant deux saisons et personne n’a demandé à le changer.',
    mods: { mashBonus: 1.4, mashTime: 850, holdBonus: 0.86 },
    cri: { label: 'ÇA FERA L’AFFAIRE', gest: 'salves', power: 79 } },

  { id: 'OB16', nom: 'Le Filet du But Nord', type: 'tifo', set: 'OB', stage: 1, rar: 'legendaire',
    histoire: 'Il a encaissé tous les buts de la décennie et il en a rendu trois, sur '
      + 'des frappes que personne ne revoit sans rire.',
    mods: { parryBonus: 1.52, parryResist: 1.2, tempoInterval: 120 },
    cri: { label: 'IL GONFLE', gest: 'mosaique', power: 81 } },

  { id: 'OB17', nom: 'La Pancarte Oubliée', type: 'depl', set: 'OB', stage: 1, rar: 'legendaire',
    histoire: '« ON REVIENDRA ». Accrochée un soir de descente, jamais décrochée. '
      + 'Ils sont revenus, et elle est toujours là.',
    mods: { breathBonus: 1.36, refundBonus: 1.32, mashBonus: 0.84 },
    cri: { label: 'ON REVIENDRA', gest: 'memoire', power: 80 } },

  /* ======================================================= LES ÉPOQUES (2) */

  { id: 'EP18', nom: 'Le Supporter de 1902', type: 'fide', set: 'EP', stage: 1, rar: 'legendaire',
    histoire: 'Chapeau melon, canne, moustache. Il applaudit poliment les buts adverses '
      + 'et il trouve qu’on exagère avec les fumigènes.',
    mods: { holdBonus: 1.34, parryResist: 1.32, tempoInterval: 130 },
    cri: { label: 'BIEN JOUÉ, MESSIEURS', gest: 'retenue', power: 78 } },

  { id: 'EP19', nom: 'Le Hooligan Repenti', type: 'pyro', set: 'EP', stage: 1, rar: 'legendaire',
    histoire: 'Il a tout fait dans les années quatre-vingt et il tient la buvette des '
      + 'jeunes depuis quinze ans. Il connaît les chants d’avant les chants.',
    mods: { perfectBonus: 1.4, parryBonus: 1.3, backfire: 1.4 },
    cri: { label: 'C’ÉTAIT UNE AUTRE ÉPOQUE', gest: 'compte', power: 82 } },
];
