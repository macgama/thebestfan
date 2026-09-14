/**
 * Cinq séries neuves — et la dissolution de deux anciennes.
 *
 * ## Pourquoi VIRAGE NORD et NUITS EUROPÉENNES disparaissent
 *
 * C'étaient les deux plus maigres : seize et neuf personnages publiés, quand
 * LA TRIBUNE en compte trente-cinq. Une série est une **étagère à compléter** ;
 * une étagère de neuf cases ne se collectionne pas, elle se remplit par accident.
 *
 * Et leurs sujets appartenaient ailleurs. VIRAGE NORD — « béton, pluie, hiver »
 * — c'était la tribune ordinaire, celle de LA TRIBUNE. NUITS EUROPÉENNES —
 * « jeudi soir, 900 km » — c'était le déplacement, et le déplacement a
 * maintenant sa série.
 *
 * **Rien n'est perdu.** Les possessions d'un joueur référencent l'identifiant
 * d'une carte, jamais sa série : `X52` reste `X52`, dans son deck, dans son
 * classeur, avec ses tenues. Ce qui change est l'étagère sur laquelle elle est
 * rangée. Le déménagement se fait dans `dex.js` — le champ `set` — et en base
 * par `sql/series-neuves.sql`, parce que le catalogue vit en base et que
 * l'amorçage écrit en `INSERT IGNORE` : sans la migration, le code dirait une
 * chose et la base une autre.
 *
 * ## Où vont les quarante-deux cartes
 *
 *   VIRAGE NORD → LA TRIBUNE, pour l'essentiel. Ses cinq légendaires — le Capo
 *     Historique, la Bâche de 89, le Tambour Fêlé, le Muret du Fond, la Torche
 *     de Minuit — sont les archétypes du virage, et LA TRIBUNE est leur place.
 *     Quelques métiers partent aux MÉTIERS DU STADE et au comptoir.
 *
 *   NUITS EUROPÉENNES → LES GALÈRES DE DÉPLACEMENT, presque en entier. Ses cinq
 *     légendaires sont des nuits de car et de train : elles fondent la série
 *     neuve au lieu de la remplir.
 *
 * ## Ce que les cinq séries racontent
 *
 * Le jeu parlait de la tribune, de ceux qui la font tourner, de ce qui y traîne
 * et de ce qui la hante. Il lui manquait **ce qu'on subit** : les gens qui ne
 * sont pas là pour le match, ce qu'on mange debout, la route pour y arriver, le
 * ciel au-dessus, et ceux qui regardent de chez eux.
 *
 * Vocabulaire des modificateurs : voir l'en-tête de `dex-2026.js`.
 * Règle des gestes : chaque cri porte un geste de la famille du personnage —
 * `catalogue:test` le vérifie sur tout le catalogue.
 */

/** Les cinq séries, avec leurs couleurs. */
export const SETS_NEUVES = [
  { id: 'VP', nom: 'LES VIP', ligne: 'ils ont la meilleure place et ils regardent leur téléphone',
    c1: '#C9A227', c2: '#1C1810' },
  { id: 'GC', nom: 'LA GASTRONOMIE DE COMPTOIR', ligne: 'ce qu’on mange debout, et qu’on regrette',
    c1: '#E08A2C', c2: '#1E1610' },
  { id: 'GD', nom: 'LES GALÈRES DE DÉPLACEMENT', ligne: 'neuf cents kilomètres, et ça commence mal',
    c1: '#4A8FC0', c2: '#101821' },
  { id: 'MT', nom: 'LES PHÉNOMÈNES MÉTÉO', ligne: 'le onzième joueur, et il n’est d’aucun camp',
    c1: '#7FB3B5', c2: '#121A1C' },
  { id: 'HC', nom: 'LES HÉROS DU CANAPÉ', ligne: 'ils n’y étaient pas, et ils savent mieux',
    c1: '#9A6FD0', c2: '#181224' },
];

export const DEX_NEUVES = [

  /* ===================================================== LES VIP (VP)

     Ils ont la meilleure place du stade et ils ne regardent pas le match.
     C'est toute la série : une tribune où l'on est vu, pas où l'on voit.

     Leurs modificateurs vont dans le même sens — ils poussent mal, et ils
     gênent bien. Beaucoup de `parryBonus` et de `parryResist`, peu de souffle :
     un deck de VIP tient la corde, il ne la tire pas.                       */

  { id: 'VP1', nom: 'Le Chat Person Snob', type: 'fide', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Il a payé la loge pour le buffet et il trouve que les chants font du '
      + 'bruit. Il applaudit une passe latérale.',
    mods: { parryResist: 1.14, breathBonus: 0.94 },
    cri: { label: 'UN PEU DE TENUE', gest: 'hold', power: 44 } },

  { id: 'VP2', nom: 'L’Influenceur de Dos', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Il filme le virage en se filmant devant. On ne verra jamais le match, '
      + 'on verra sa nuque pendant quatre-vingt-dix minutes.',
    mods: { perfectBonus: 1.16, holdBonus: 0.9 },
    cri: { label: 'VOUS ÊTES CHAUDS ?', gest: 'tifo', power: 46 } },

  { id: 'VP3', nom: 'Le Ministre en Campagne', type: 'voix', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Il connaît le nom de l’attaquant depuis ce matin et il le prononce très '
      + 'fort. Il partira à la mi-temps.',
    mods: { tempoWindow: 1.18, refundBonus: 0.86 },
    cri: { label: 'JE SUIS DES VÔTRES', gest: 'tempo', power: 47 } },

  { id: 'VP4', nom: 'Le Client du Sponsor', type: 'fide', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'On lui a offert la place et il n’a pas osé refuser. Il ne sait pas de '
      + 'quel côté est son équipe et il n’osera pas demander.',
    mods: { holdBonus: 1.12, tempoInterval: 80 },
    cri: { label: 'C’EST LEQUEL, LE NÔTRE ?', gest: 'hold', power: 42 } },

  { id: 'VP5', nom: 'La Loge Vide', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Douze places, zéro personne, un buffet intact. Elle reste allumée toute '
      + 'la rencontre, en face du virage qui la regarde.',
    mods: { parryBonus: 1.2, mashBonus: 0.88 },
    cri: { label: 'PERSONNE', gest: 'tifo', power: 45 } },

  { id: 'VP6', nom: 'Le Consultant en Costume', type: 'voix', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Il explique le hors-jeu à sa voisine, qui est arbitre de touche depuis '
      + 'onze ans. Elle le laisse finir.',
    mods: { tempoWindow: 1.14, perfectBonus: 0.9 },
    cri: { label: 'ALORS TECHNIQUEMENT', gest: 'tempo', power: 44 } },

  { id: 'VP7', nom: 'L’Enfant de la Direction', type: 'depl', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Onze ans, un maillot floqué à son nom, et il s’ennuie fermement. Il a '
      + 'demandé quand est-ce qu’on rentre à la quatrième minute.',
    mods: { breathBonus: 1.16, parryResist: 0.88 },
    cri: { label: 'ON RENTRE QUAND', gest: 'echarpe', power: 43 } },

  { id: 'VP8', nom: 'Le Photographe Accrédité', type: 'perc', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Il a le seul angle correct du stade et il l’utilise pour photographier '
      + 'le banc de touche pendant l’action.',
    mods: { mashBonus: 1.15, holdForgive: -1 },
    cri: { label: 'JE L’AI RATÉE', gest: 'mash', power: 45 } },

  { id: 'VP9', nom: 'La Table des Partenaires', type: 'fide', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Ils ont réservé pour le troisième mi-temps et ils sont arrivés à la '
      + 'première. Personne ne s’est levé une seule fois.',
    mods: { parryResist: 1.22, mashBonus: 0.86 },
    cri: { label: 'ET LE DESSERT ?', gest: 'hold', power: 48 } },

  /* Les cinq légendaires. Elles ne poussent pas, elles pèsent — c'est la série
     où la carte haute est une gêne, pas une force. */

  { id: 'VP10', nom: 'Le Propriétaire de Passage', type: 'fide', set: 'VP', stage: 1, rar: 'legendaire',
    histoire: 'Il vient une fois par saison, s’assoit trois minutes, et repart avant '
      + 'la mi-temps. Le stade porte son nom depuis avant qu’il l’achète.',
    mods: { parryResist: 1.4, parryBonus: 1.25, breathBonus: 0.82 },
    cri: { label: 'JE REPASSERAI', gest: 'retenue', power: 78 } },

  { id: 'VP11', nom: 'La Tribune Présidentielle', type: 'tifo', set: 'VP', stage: 1, rar: 'legendaire',
    histoire: 'Vitrée, chauffée, insonorisée. On y voit tout et on n’y entend rien — '
      + 'c’est exactement ce qui a été demandé à l’architecte.',
    mods: { parryBonus: 1.5, perfectBonus: 1.2, tempoWindow: 0.85 },
    cri: { label: 'DERRIÈRE LA VITRE', gest: 'tri', power: 80 } },

  { id: 'VP12', nom: 'L’Ancienne Gloire', type: 'voix', set: 'VP', stage: 1, rar: 'legendaire',
    histoire: 'Quatre cents matchs pour le club, et maintenant une place en loge et un '
      + 'micro à la mi-temps. Le virage chante encore son nom, il ne se retourne plus.',
    mods: { tempoWindow: 1.32, refundBonus: 1.28, mashBonus: 0.84 },
    cri: { label: 'C’ÉTAIT MIEUX DEBOUT', gest: 'echo', power: 82 } },

  { id: 'VP13', nom: 'Le Diffuseur', type: 'perc', set: 'VP', stage: 1, rar: 'legendaire',
    histoire: 'C’est lui qui a décidé que le derby se jouerait un lundi à vingt et une '
      + 'heures. Il n’est jamais venu au stade et il n’a pas prévu de venir.',
    mods: { mashBonus: 1.36, costPenalty: 1.3, holdBonus: 0.86 },
    cri: { label: 'LUNDI VINGT ET UNE HEURES', gest: 'salves', power: 83 } },

  { id: 'VP14', nom: 'Le Sponsor Maillot', type: 'depl', set: 'VP', stage: 1, rar: 'legendaire',
    histoire: 'Son nom est sur la poitrine de onze personnes et sur trente mille dos. '
      + 'Il change tous les trois ans, et personne ne se souvient du précédent.',
    mods: { breathBonus: 1.34, refundBonus: 1.26, perfectBonus: 0.84 },
    cri: { label: 'ON VOIT NOTRE LOGO ?', gest: 'memoire', power: 79 } },

  /* ============================= LA GASTRONOMIE DE COMPTOIR (GC)

     Ce qu'on mange debout, en trois minutes, et qu'on regrette pendant la
     deuxième mi-temps. Une série d'objets qui ne devraient pas être des
     personnages, et qui en sont.

     Elle joue le souffle et la reprise : on y mange mal, on tient quand même. */

  { id: 'GC1', nom: 'La Merguez Carbonisée', type: 'pyro', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Noire dehors, glacée dedans, et c’est la même depuis 1998. On la '
      + 'commande en connaissance de cause.',
    mods: { perfectBonus: 1.18, backfire: 1.2 },
    cri: { label: 'ELLE EST CUITE ?', gest: 'relance', power: 46 } },

  { id: 'GC2', nom: 'La Bière Renversée', type: 'depl', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Elle a tenu quatre rangs et elle est tombée sur le dernier. Trois '
      + 'personnes ont la nuque mouillée et personne ne dira rien.',
    mods: { breathBonus: 1.16, holdForgive: -1 },
    cri: { label: 'PARDON PARDON PARDON', gest: 'echarpe', power: 44 } },

  { id: 'GC3', nom: 'Le Sandwich Triangle', type: 'fide', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Sous plastique depuis une date qu’on préfère ne pas lire. Il a la '
      + 'température exacte de la buvette.',
    mods: { holdBonus: 1.14, tempoWindow: 0.92 },
    cri: { label: 'C’EST DU THON', gest: 'hold', power: 42 } },

  { id: 'GC4', nom: 'La Frite Molle', type: 'fide', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Tiède, souple, et vendue au poids du carton. Elle plie sous son propre '
      + 'poids avant d’arriver à la bouche.',
    mods: { holdBonus: 1.12, mashBonus: 0.9 },
    cri: { label: 'ELLE TOMBE', gest: 'hold', power: 41 } },

  { id: 'GC5', nom: 'Le Gobelet Consigné', type: 'fide', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Un euro de caution, et personne ne le rend jamais. Il finira dans une '
      + 'cuisine, avec quarante autres.',
    mods: { refundBonus: 1.2, parryBonus: 0.9 },
    cri: { label: 'JE LE GARDE', gest: 'hold', power: 43 } },

  { id: 'GC6', nom: 'La Queue de la Mi-Temps', type: 'depl', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Quinze minutes de pause, douze de file, et on rate le début de la '
      + 'reprise. Tous les samedis, depuis toujours.',
    mods: { breathBonus: 1.18, tempoInterval: 70 },
    cri: { label: 'ÇA AVANCE PAS', gest: 'echarpe', power: 45 } },

  { id: 'GC7', nom: 'Le Thermos du Grand-Père', type: 'fide', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Du café depuis 1987, dans le même récipient. Il en propose à tout le '
      + 'rang et deux personnes acceptent encore.',
    mods: { refundBonus: 1.22, breathBonus: 1.1, mashBonus: 0.86 },
    cri: { label: 'UNE GOUTTE ?', gest: 'hold', power: 47 } },

  { id: 'GC8', nom: 'La Saucisse du Parking', type: 'pyro', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Cuite sur un barbecue de camping deux heures avant le coup d’envoi. '
      + 'C’est la meilleure du stade et elle n’y est même pas.',
    mods: { perfectBonus: 1.2, costPenalty: 1.12 },
    cri: { label: 'AVANT LE MATCH', gest: 'relance', power: 48 } },

  { id: 'GC9', nom: 'Le Chewing-Gum sous le Siège', type: 'tifo', set: 'GC', stage: 1, rar: 'commune',
    histoire: 'Il a vu plus de matchs que la moitié du virage. Personne ne sait de '
      + 'quelle décennie il date et personne ne veut savoir.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'IL EST TOUJOURS LÀ', gest: 'tifo', power: 44 } },

  { id: 'GC10', nom: 'La Buvette à Sec', type: 'voix', set: 'GC', stage: 1, rar: 'legendaire',
    histoire: 'Plus rien à trente minutes de la fin, un soir de prolongations. Le '
      + 'virage a chanté à la buvette vide, et elle a fermé en riant.',
    mods: { tempoWindow: 1.34, breathBonus: 1.2, refundBonus: 0.82 },
    cri: { label: 'Y A PLUS RIEN', gest: 'capo', power: 79 } },

  { id: 'GC11', nom: 'Le Fût de la Montée', type: 'depl', set: 'GC', stage: 1, rar: 'legendaire',
    histoire: 'Gardé en cave depuis la relégation, avec une date au marqueur. Il a été '
      + 'ouvert onze ans plus tard, et il était encore bon.',
    mods: { breathBonus: 1.4, refundBonus: 1.3, tempoWindow: 0.86 },
    cri: { label: 'ONZE ANS', gest: 'memoire', power: 81 } },

  { id: 'GC12', nom: 'La Recette de la Buvette', type: 'fide', set: 'GC', stage: 1, rar: 'legendaire',
    histoire: 'Un cahier à spirale, quatre lignes, et le nom de celle qui l’a écrite. '
      + 'Trois générations l’ont suivi sans jamais y changer une virgule.',
    mods: { holdBonus: 1.44, refundBonus: 1.24, mashBonus: 0.84 },
    cri: { label: 'ON N’Y TOUCHE PAS', gest: 'tenue', power: 80 } },

  { id: 'GC13', nom: 'Le Barbecue du Parking Nord', type: 'pyro', set: 'GC', stage: 1, rar: 'legendaire',
    histoire: 'Allumé à onze heures pour un match à vingt et une. La fumée se voit de '
      + 'l’autoroute et c’est le seul panneau dont le club ait besoin.',
    mods: { perfectBonus: 1.46, breathBonus: 1.2, costPenalty: 1.3 },
    cri: { label: 'ÇA SENT D’ICI', gest: 'compte', power: 83 } },

  { id: 'GC14', nom: 'La Dernière Tournée', type: 'voix', set: 'GC', stage: 1, rar: 'legendaire',
    histoire: 'Payée par celui qui a le moins de raisons de payer, un soir de défaite. '
      + 'C’est de ces soirs-là qu’on se souvient, pas des victoires.',
    mods: { tempoWindow: 1.3, refundBonus: 1.36, perfectBonus: 0.86 },
    cri: { label: 'C’EST MA TOURNÉE', gest: 'contretemps', power: 82 } },

  /* ========================= LES GALÈRES DE DÉPLACEMENT (GD)

     Neuf cents kilomètres, et ça commence mal. La série reprend les cinq
     légendaires de NUITS EUROPÉENNES, qui sont exactement ça : des nuits de car
     et de train. Elles fondent la série neuve au lieu de la remplir.

     Elle joue le souffle et la tenue — on y arrive fatigué, on y reste quand
     même. C'est le déplacement.                                             */

  { id: 'GD1', nom: 'Le Minibus en Panne', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Immobilisé sur la bande d’arrêt d’urgence à cent quarante kilomètres du '
      + 'stade. Neuf personnes et une seule idée de ce qu’il faut faire.',
    mods: { breathBonus: 1.16, tempoInterval: 80 },
    cri: { label: 'QUELQU’UN S’Y CONNAÎT ?', gest: 'echarpe', power: 45 } },

  { id: 'GD2', nom: 'Le GPS Menteur', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Il annonçait vingt minutes il y a une heure. Il annonce toujours vingt '
      + 'minutes et personne n’ose le contredire.',
    mods: { breathBonus: 1.14, perfectBonus: 0.9 },
    cri: { label: 'VINGT MINUTES', gest: 'echarpe', power: 44 } },

  { id: 'GD3', nom: 'Le Péagiste Endormi', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Trois heures du matin, une cabine, et un car de supporters qui chante. '
      + 'Il lève la barrière sans ouvrir les yeux.',
    mods: { holdBonus: 1.15, tempoWindow: 0.92 },
    cri: { label: 'IL DORT', gest: 'hold', power: 43 } },

  { id: 'GD4', nom: 'Le Pneu Crevé', type: 'perc', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'À la sortie du parking, avant même d’avoir pris l’autoroute. La roue de '
      + 'secours est sous les écharpes et les écharpes sont sous tout le reste.',
    mods: { mashBonus: 1.18, holdForgive: -1 },
    cri: { label: 'DÉJÀ ?', gest: 'mash', power: 46 } },

  { id: 'GD5', nom: 'L’Aire d’Autoroute à 4 h', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Un café tiède, un néon qui grésille, et quarante personnes qui ne '
      + 'parlent plus depuis deux cents kilomètres.',
    mods: { holdBonus: 1.16, refundBonus: 1.1, mashBonus: 0.88 },
    cri: { label: 'ON REPART DANS DIX', gest: 'hold', power: 47 } },

  { id: 'GD6', nom: 'Le Car sans Chauffage', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Moins trois dehors, moins un dedans, et cinq heures de route. On dort à '
      + 'quatre sous deux drapeaux.',
    mods: { breathBonus: 1.2, parryResist: 0.9 },
    cri: { label: 'SERREZ-VOUS', gest: 'echarpe', power: 45 } },

  { id: 'GD7', nom: 'Le Contrôle à la Frontière', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Quarante passeports, deux agents, et le coup d’envoi dans une heure. '
      + 'Personne ne dit un mot de travers.',
    mods: { parryResist: 1.2, tempoInterval: 90 },
    cri: { label: 'ON A LE TEMPS', gest: 'hold', power: 46 } },

  { id: 'GD8', nom: 'Le Train Supprimé', type: 'voix', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Annoncé sur le quai, deux minutes avant l’heure. Trente personnes en '
      + 'maillot regardent le même panneau sans y croire.',
    mods: { tempoWindow: 1.16, refundBonus: 0.9 },
    cri: { label: 'C’EST PAS VRAI', gest: 'tempo', power: 45 } },

  { id: 'GD9', nom: 'L’Escorte de Police', type: 'perc', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Du péage au parking, gyrophares allumés, sans un arrêt. C’est la seule '
      + 'fois de l’année où l’on se sent important.',
    mods: { mashBonus: 1.16, breathBonus: 1.08, holdBonus: 0.88 },
    cri: { label: 'ON PASSE', gest: 'mash', power: 48 } },

  /* ============================= LES PHÉNOMÈNES MÉTÉO (MT)

     Le onzième joueur, et il n'est d'aucun camp. La série des choses qui
     décident du match sans jouer.

     Elle est volontairement **instable** : beaucoup de bonus au geste parfait et
     de retours de bâton. Un deck de météo se joue en pariant.                */

  { id: 'MT1', nom: 'Le Vent Contre Son Camp', type: 'depl', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Il a tourné à la mi-temps, exactement quand il ne fallait pas. Les deux '
      + 'gardiens l’ont senti en même temps.',
    mods: { breathBonus: 1.18, perfectBonus: 0.9 },
    cri: { label: 'IL A TOURNÉ', gest: 'echarpe', power: 45 } },

  { id: 'MT2', nom: 'La Pluie Horizontale', type: 'pyro', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Elle n’arrive pas d’en haut, elle arrive de côté. Les capuches ne '
      + 'servent à rien et tout le monde en porte une.',
    mods: { perfectBonus: 1.2, backfire: 1.18 },
    cri: { label: 'ÇA VIENT DE CÔTÉ', gest: 'relance', power: 46 } },

  { id: 'MT3', nom: 'Le Rayon de Soleil Aveuglant', type: 'tifo', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Dix-sept heures pile, tribune ouest, et le gardien ne voit plus rien '
      + 'pendant quatre minutes. C’est toujours le même quart d’heure.',
    mods: { parryBonus: 1.2, tempoWindow: 0.9 },
    cri: { label: 'IL VOIT RIEN', gest: 'tifo', power: 46 } },

  { id: 'MT4', nom: 'Le Brouillard de Novembre', type: 'tifo', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'On entend le match, on ne le voit plus. Le virage chante un but quatre '
      + 'secondes avant de savoir s’il a été marqué.',
    mods: { parryBonus: 1.22, perfectBonus: 0.88 },
    cri: { label: 'ON ENTEND SEULEMENT', gest: 'tifo', power: 47 } },

  { id: 'MT5', nom: 'La Grêle de Cinq Minutes', type: 'perc', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Arrivée de nulle part, repartie aussi vite, et la pelouse est blanche. '
      + 'L’arbitre regarde sa montre et laisse jouer.',
    mods: { mashBonus: 1.2, holdBonus: 0.88 },
    cri: { label: 'ÇA TAPE', gest: 'mash', power: 47 } },

  { id: 'MT6', nom: 'La Canicule de Seize Heures', type: 'fide', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Trente-huit degrés au coup d’envoi, une pause fraîcheur à la demi-heure, '
      + 'et personne qui ne pense plus qu’à l’ombre.',
    mods: { holdBonus: 1.18, breathBonus: 0.86 },
    cri: { label: 'DE L’EAU', gest: 'hold', power: 46 } },

  { id: 'MT7', nom: 'Le Gel du Matin', type: 'fide', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le terrain a été déclaré praticable par quelqu’un qui n’a pas marché '
      + 'dessus. Trois joueurs sont tombés avant la première minute.',
    mods: { parryResist: 1.2, mashBonus: 0.9 },
    cri: { label: 'ÇA GLISSE', gest: 'hold', power: 45 } },

  { id: 'MT8', nom: 'La Bourrasque du Corner', type: 'voix', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Elle se lève quand le ballon part et retombe quand il arrive. Deux buts '
      + 'lui sont attribués cette saison, aucun n’était pour le même camp.',
    mods: { tempoWindow: 1.2, refundBonus: 0.9 },
    cri: { label: 'REGARDE ÇA', gest: 'tempo', power: 46 } },

  { id: 'MT9', nom: 'L’Orage à la 80e', type: 'pyro', set: 'MT', stage: 1, rar: 'legendaire',
    histoire: 'Arbitre rentré, tribunes évacuées, match suspendu à un partout. Le '
      + 'virage est resté sous le préau et a chanté quarante minutes.',
    mods: { perfectBonus: 1.5, refundBonus: 1.3, backfire: 1.45 },
    cri: { label: 'ON ATTEND', gest: 'relance', power: 84 } },

  { id: 'MT10', nom: 'La Neige du Derby', type: 'tifo', set: 'MT', stage: 1, rar: 'legendaire',
    histoire: 'Un ballon orange, des lignes bleues, et douze mille personnes qui n’ont '
      + 'jamais eu aussi froid. Personne n’est parti.',
    mods: { parryBonus: 1.48, holdBonus: 1.2, tempoWindow: 0.86 },
    cri: { label: 'ON RESTE', gest: 'mosaique', power: 82 } },

  { id: 'MT11', nom: 'Le Vent de Face Permanent', type: 'depl', set: 'MT', stage: 1, rar: 'legendaire',
    histoire: 'Il souffle dans le même sens depuis que le stade existe, parce qu’on l’a '
      + 'construit dans le mauvais. L’adversaire ne le sait jamais.',
    mods: { breathBonus: 1.38, parryResist: 1.24, perfectBonus: 0.84 },
    cri: { label: 'ON CONNAÎT', gest: 'memoire', power: 80 } },

  { id: 'MT12', nom: 'Le Terrain Inondé', type: 'fide', set: 'MT', stage: 1, rar: 'legendaire',
    histoire: 'Le ballon s’arrête là où il tombe et le match devient autre chose. '
      + 'C’est le seul soir où l’équipe la plus faible a une chance.',
    mods: { holdBonus: 1.44, parryResist: 1.3, mashBonus: 0.8 },
    cri: { label: 'IL S’ARRÊTE', gest: 'tenue', power: 81 } },

  { id: 'MT13', nom: 'L’Éclipse de la Mi-Temps', type: 'voix', set: 'MT', stage: 1, rar: 'legendaire',
    histoire: 'Trois minutes de nuit à seize heures, et trente mille personnes qui se '
      + 'taisent d’un coup. Le seul silence que ce stade ait connu.',
    mods: { tempoWindow: 1.34, perfectBonus: 1.26, breathBonus: 0.84 },
    cri: { label: 'PLUS UN BRUIT', gest: 'echo', power: 83 } },

  /* ============================== LES HÉROS DU CANAPÉ (HC)

     Ils n'y étaient pas, et ils savent mieux. La série de ceux qui regardent
     de chez eux — et qui ont un avis plus ferme que ceux qui ont fait
     neuf cents kilomètres.

     Elle joue le contre et la mémoire : on ne pousse pas depuis un canapé, on
     commente. C'est la série la plus défensive du jeu.                       */

  { id: 'HC1', nom: 'L’Expert Tactique Twitter', type: 'tifo', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il avait prévu le 3-5-2 et il le dit à la mi-temps. Il n’avait rien '
      + 'prévu du tout et il a effacé le message d’avant.',
    mods: { parryBonus: 1.18, breathBonus: 0.9 },
    cri: { label: 'JE L’AVAIS DIT', gest: 'tifo', power: 45 } },

  { id: 'HC2', nom: 'Le Troll d’Après-Match', type: 'voix', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il arrive dans les commentaires exactement au coup de sifflet final, et '
      + 'seulement les soirs de défaite. Il suit six clubs.',
    mods: { tempoWindow: 1.16, refundBonus: 0.88 },
    cri: { label: 'ALORS, CETTE SAISON ?', gest: 'tempo', power: 46 } },

  { id: 'HC3', nom: 'Le Footix', type: 'fide', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il a acheté le maillot en juin, après la coupe. Il connaît trois joueurs '
      + 'et il les cite dans le désordre.',
    mods: { holdBonus: 1.14, mashBonus: 0.9 },
    cri: { label: 'ON A GAGNÉ !', gest: 'hold', power: 42 } },

  { id: 'HC4', nom: 'Le Commentateur du Salon', type: 'voix', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il double le commentaire télé en plus fort et légèrement en avance. '
      + 'Personne d’autre n’entend plus rien.',
    mods: { tempoWindow: 1.2, perfectBonus: 0.9 },
    cri: { label: 'IL VA TIRER', gest: 'tempo', power: 45 } },

  { id: 'HC5', nom: 'Le Ralenti Décisif', type: 'tifo', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Vu quatorze fois sous six angles, et toujours pas d’accord. Le débat '
      + 'durera plus longtemps que la saison.',
    mods: { parryBonus: 1.2, tempoInterval: 80 },
    cri: { label: 'REGARDE ENCORE', gest: 'tifo', power: 46 } },

  { id: 'HC6', nom: 'Le Flux qui Rame', type: 'perc', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il apprend les buts par les cris du voisin, trente secondes avant de les '
      + 'voir. Il a arrêté de s’en étonner.',
    mods: { mashBonus: 1.16, tempoWindow: 0.9 },
    cri: { label: 'ÇA CHARGE', gest: 'mash', power: 45 } },

  { id: 'HC7', nom: 'Le Groupe de la Famille', type: 'depl', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Quarante messages en quatre minutes, dont trente-huit de l’oncle. Il '
      + 'écrit en majuscules depuis 2011.',
    mods: { breathBonus: 1.16, holdForgive: -1 },
    cri: { label: 'RÉPONDEZ', gest: 'echarpe', power: 44 } },

  { id: 'HC8', nom: 'Le Pronostiqueur du Lundi', type: 'fide', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il annonce les résultats de dimanche le lundi suivant, avec beaucoup '
      + 'd’assurance. Son taux de réussite est remarquable.',
    mods: { parryResist: 1.18, refundBonus: 0.9 },
    cri: { label: 'C’ÉTAIT ÉVIDENT', gest: 'hold', power: 44 } },

  { id: 'HC9', nom: 'Le Fantasy Manager', type: 'perc', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il soutient l’attaquant adverse parce qu’il l’a dans son équipe. Il le '
      + 'dit tout haut une fois, et une seule.',
    mods: { mashBonus: 1.18, parryResist: 0.88 },
    cri: { label: 'PAS LUI, L’AUTRE', gest: 'mash', power: 45 } },

  { id: 'HC10', nom: 'Le Supporter d’Un Seul Soir', type: 'voix', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Il n’avait jamais regardé un match et il a pleuré à la finale. Il n’en '
      + 'reverra pas d’autre, et celui-là il s’en souviendra toujours.',
    mods: { tempoWindow: 1.36, refundBonus: 1.28, holdBonus: 0.82 },
    cri: { label: 'C’ÉTAIT QUOI CE MATCH', gest: 'echo', power: 81 } },

  { id: 'HC11', nom: 'La Chaîne Cryptée', type: 'tifo', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Elle a le match, et elle seule. Quatre générations ont appris à '
      + 'reconnaître un but au son étouffé qui traverse le mur du voisin.',
    mods: { parryBonus: 1.5, parryResist: 1.22, breathBonus: 0.84 },
    cri: { label: 'CHEZ LE VOISIN', gest: 'tri', power: 80 } },

  { id: 'HC12', nom: 'Le Forum de 2004', type: 'fide', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Encore en ligne, encore actif, et le même débat qu’au premier jour. '
      + 'Quarante-sept mille messages sur un penalty non sifflé.',
    mods: { holdBonus: 1.46, parryResist: 1.26, tempoInterval: 110 },
    cri: { label: 'PAGE 1 204', gest: 'retenue', power: 79 } },

  { id: 'HC13', nom: 'Le Direct Commenté', type: 'perc', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Du texte, rafraîchi toutes les trente secondes, et rien d’autre. C’est '
      + 'comme ça qu’une génération entière a vécu ses déplacements.',
    mods: { mashBonus: 1.42, perfectBonus: 1.22, breathBonus: 0.86 },
    cri: { label: 'F5 · F5 · F5', gest: 'salves', power: 82 } },

  { id: 'HC14', nom: 'La Streameuse de Minuit', type: 'depl', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Elle commente seule, pour trois cents personnes, un match que personne '
      + 'd’autre ne diffuse. À deux heures du matin ils sont encore là.',
    mods: { breathBonus: 1.36, refundBonus: 1.28, mashBonus: 0.84 },
    cri: { label: 'VOUS ÊTES ENCORE LÀ ?', gest: 'memoire', power: 80 } },
];
