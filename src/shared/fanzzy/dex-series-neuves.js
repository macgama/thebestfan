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
 * d'une carte, jamais sa série : `TR55` reste `TR55`, dans son deck, dans son
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
    desc: 'L’influenceur, le sponsor, la coupe de champagne : ils ont la meilleure place et ne regardent pas le match. Ils poussent mal, mais ils gênent bien.',
    c1: '#C9A227', c2: '#1C1810' },
  { id: 'GC', nom: 'LA GASTRONOMIE DE COMPTOIR', ligne: 'ce qu’on mange debout, et qu’on regrette',
    desc: 'La merguez carbonisée, la frite molle, la bière renversée : ce qu’on mange debout à la mi-temps. On y mange mal, on tient quand même.',
    c1: '#E08A2C', c2: '#1E1610' },
  { id: 'GD', nom: 'LES GALÈRES DE DÉPLACEMENT', ligne: 'neuf cents kilomètres, et ça commence mal',
    desc: 'Le minibus en panne, le dernier train, l’aire d’autoroute à 4 h : la route jusqu’au stade d’en face. On arrive fatigué, on reste jusqu’au bout.',
    c1: '#4A8FC0', c2: '#101821' },
  { id: 'MT', nom: 'LES PHÉNOMÈNES MÉTÉO', ligne: 'le onzième joueur, et il n’est d’aucun camp',
    desc: 'La pluie horizontale, le brouillard de novembre, l’orage à la 80e : le ciel qui décide du match sans jouer. Une série instable, pour ceux qui aiment parier.',
    c1: '#7FB3B5', c2: '#121A1C' },
  { id: 'HC', nom: 'LES HÉROS DU CANAPÉ', ligne: 'ils n’y étaient pas, et ils savent mieux',
    desc: 'Ceux qui regardent le match de chez eux et savent mieux que tout le monde. La série la plus défensive du jeu : on ne pousse pas depuis un canapé, on commente.',
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
    /* « UN PEU DE TENUE » était déjà le cri de BG11, Le Manchot en Nœud
       Papillon — qui, lui, parle vraiment de tenue vestimentaire. Celui-ci ne
       reproche pas une tenue, il reproche le bruit : son cri le dit
       maintenant. */
    cri: { label: 'MOINS FORT, MERCI', gest: 'hold', power: 44 } },

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
    cri: { label: 'JE REPASSERAI', gest: 'jauge', power: 78 } },

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
    cri: { label: 'ON VOIT NOTRE LOGO ?', gest: 'bascule', power: 79 } },

  /* VP16 à VP50 — les trente-cinq VIP de la refonte du 2 novembre 2026
     (45 personnages et 5 légendaires par série, demande de Gaël). Fiches et
     dessins : fanzzy-prompts/SERIES-50/VP-les-vip.md. */
  { id: 'VP16', nom: 'La Coupe de Champagne', type: 'pyro', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La coupe de cristal qui ne trinque qu’avec les invités. Elle fait tinter son '
      + 'bord quand la loge applaudit, jamais avant.',
    mods: { perfectBonus: 1.18, breathBonus: 0.92 },
    cri: { label: 'SANTÉ, LA LOGE', gest: 'relance', power: 46 } },

  { id: 'VP17', nom: 'L’Hôtesse d’Accueil', type: 'fide', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'L’hôtesse qui vérifie les invitations à l’entrée de la loge, sourire figé. '
      + 'Personne n’entre sans être sur sa liste.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'VOTRE INVITATION ?', gest: 'hold', power: 45 } },

  { id: 'VP18', nom: 'Le Petit-Four', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le petit-four du buffet que personne ne mange, posé sur sa serviette en '
      + 'dentelle. Il attend depuis la mi-temps.',
    mods: { parryBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'PERSONNE N’EN VEUT ?', gest: 'tifo', power: 45 } },

  { id: 'VP19', nom: 'La Femme du Président', type: 'depl', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La femme du président qui s’ennuie en loge, son bouquet sur les genoux. Elle '
      + 'regarde le virage plus que le terrain.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'IL EST QUELLE HEURE ?', gest: 'echarpe', power: 45 } },

  { id: 'VP20', nom: 'Le Parapluie de Loge', type: 'fide', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le grand parapluie de la loge, toujours plié, qui n’a jamais vu la pluie. La '
      + 'loge a un toit.',
    mods: { holdBonus: 1.17, perfectBonus: 0.92 },
    cri: { label: 'IL NE PLEUT PAS', gest: 'hold', power: 45 } },

  { id: 'VP21', nom: 'Le Badge VIP', type: 'voix', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le badge VIP plastifié qui ouvre toutes les portes du stade. Il bipe à chaque '
      + 'porte, toujours au même rythme.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'ACCÈS AUTORISÉ', gest: 'tempo', power: 45 } },

  { id: 'VP22', nom: 'Le Chef du Traiteur', type: 'pyro', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le chef du traiteur de la loge, toque haute et assiettes minuscules. Il n’a '
      + 'jamais servi de frites.',
    mods: { perfectBonus: 1.17, tempoWindow: 0.92 },
    cri: { label: 'OUI, CHEF', gest: 'rouleaux', power: 45 } },

  { id: 'VP23', nom: 'La Star de Téléréalité', type: 'voix', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La candidate de téléréalité invitée en loge pour les photos. Elle tourne le '
      + 'dos au match pour son meilleur profil.',
    mods: { tempoWindow: 1.17, breathBonus: 0.92 },
    cri: { label: 'UNE PHOTO ?', gest: 'capo', power: 45 } },

  { id: 'VP24', nom: 'Le Siège Chauffant', type: 'fide', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le siège chauffant de la tribune d’honneur, réglé sur le maximum. Celui qui '
      + 's’y assoit s’endort à la mi-temps.',
    mods: { holdBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'IL FAIT BON ICI', gest: 'jauge', power: 45 } },

  { id: 'VP25', nom: 'La Banquière', type: 'pyro', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La banquière invitée en loge qui compte les places vides au lieu des buts. Son '
      + 'tableau de chiffres ne la quitte pas.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'LES CHIFFRES SONT BONS', gest: 'compte', power: 46 } },

  { id: 'VP26', nom: 'La Journaliste de Plateau', type: 'voix', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La journaliste du plateau télé, bien au chaud derrière la vitre. Elle commente '
      + 'un virage qu’elle n’a jamais vu de près.',
    mods: { tempoWindow: 1.16, parryResist: 0.92 },
    cri: { label: 'À VOUS LES STUDIOS', gest: 'echo', power: 45 } },

  { id: 'VP27', nom: 'Le Plaid en Cachemire', type: 'fide', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le plaid en cachemire plié sur les genoux d’un invité. Il ne couvre qu’une '
      + 'personne, et il n’en bouge jamais.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'J’AI FROID AUX GENOUX', gest: 'retenue', power: 45 } },

  { id: 'VP28', nom: 'Le Voiturier', type: 'depl', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le voiturier qui gare les berlines des invités, gants blancs et casquette. Il '
      + 'n’a jamais vu un match.',
    mods: { breathBonus: 1.17, perfectBonus: 0.92 },
    cri: { label: 'VOS CLÉS, MONSIEUR', gest: 'echarpe', power: 45 } },

  { id: 'VP29', nom: 'La Sommelière', type: 'perc', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La sommelière de la loge qui sert les grands crus, son tastevin au cou. Elle '
      + 'ne trouve jamais l’invité qui sait goûter.',
    mods: { mashBonus: 1.17, holdBonus: 0.92 },
    cri: { label: 'UN GRAND CRU', gest: 'mash', power: 45 } },

  { id: 'VP30', nom: 'Le Majordome', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le majordome de la loge présidentielle, raide comme un piquet. Il range les '
      + 'invités par ordre d’importance.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'LE THÉ EST SERVI', gest: 'tri', power: 45 } },

  { id: 'VP31', nom: 'Le Chapeau Melon', type: 'pyro', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le chapeau melon de la tribune d’honneur, sage et bien droit. Il n’a jamais '
      + 'quitté une tête.',
    mods: { perfectBonus: 1.17, mashBonus: 0.92 },
    cri: { label: 'CHAPEAU !', gest: 'relance', power: 45 } },

  { id: 'VP32', nom: 'La Danseuse de la Mi-Temps', type: 'perc', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La danseuse du spectacle de la mi-temps, pompons aux poings. Elle danse devant '
      + 'les loges et le virage ne la voit pas.',
    mods: { mashBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'À LA MI-TEMPS', gest: 'crescendo', power: 45 } },

  { id: 'VP33', nom: 'Le Rideau de la Loge', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le rideau de velours tiré sur la vitre de la loge quand le virage est trop '
      + 'bruyant. Il cache tout.',
    mods: { parryBonus: 1.17, tempoWindow: 0.92 },
    cri: { label: 'ON FERME', gest: 'tifo', power: 45 } },

  { id: 'VP34', nom: 'Le Petit Chien de la Présidente', type: 'perc', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le petit chien de salon de la présidente, nœud dans les poils, porté dans un '
      + 'sac à main. Il aboie aux mauvais moments.',
    mods: { mashBonus: 1.17, parryResist: 0.92 },
    cri: { label: 'WAF', gest: 'mash', power: 45 } },

  { id: 'VP35', nom: 'La Notaire', type: 'depl', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La notaire invitée en loge, stylo plume à la main. Elle lit les petites lignes '
      + 'du programme du match.',
    mods: { breathBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'SIGNEZ ICI', gest: 'memoire', power: 45 } },

  { id: 'VP36', nom: 'La Fille du Sponsor', type: 'depl', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La fille du sponsor qui s’ennuie en loge dans sa robe de cérémonie. Elle colle '
      + 'son nez à la vitre pour voir le virage.',
    mods: { breathBonus: 1.17, refundBonus: 0.92 },
    cri: { label: 'JE M’ENNUIE', gest: 'echarpe', power: 45 } },

  { id: 'VP37', nom: 'La Vitrine', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La vitrine du salon VIP où dorment des souvenirs que personne ne regarde. Elle '
      + 'est fermée à clé.',
    mods: { parryBonus: 1.16, holdBonus: 0.92 },
    cri: { label: 'NE PAS TOUCHER', gest: 'mosaique', power: 45 } },

  { id: 'VP38', nom: 'L’Ambassadeur', type: 'voix', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'L’ambassadeur invité pour un match amical, qui serre toutes les mains. Il ne '
      + 'connaît aucun chant.',
    mods: { tempoWindow: 1.17, refundBonus: 0.92 },
    cri: { label: 'ENCHANTÉ', gest: 'tempo', power: 45 } },

  { id: 'VP39', nom: 'La Styliste', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La styliste invitée en loge qui juge les tenues des supporters. Son carnet de '
      + 'croquis est plein de croix.',
    mods: { parryBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'CE N’EST PAS LA SAISON', gest: 'tifo', power: 45 } },

  { id: 'VP40', nom: 'Le Plateau d’Argent', type: 'perc', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le plateau d’argent poli qui ne porte que des coupes. Il n’a jamais porté une '
      + 'frite.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'ATTENTION, ÇA PASSE', gest: 'mash', power: 45 } },

  { id: 'VP41', nom: 'La Mécène Anonyme', type: 'depl', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La mécène qui paie les déplacements sans jamais se montrer. Personne ne '
      + 'connaît son visage.',
    mods: { breathBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'MERCI QUI ?', gest: 'bascule', power: 45 } },

  { id: 'VP42', nom: 'La Cheffe d’Entreprise', type: 'perc', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La cheffe d’entreprise qui achète une loge pour ses clients. Elle regarde ses '
      + 'chiffres pendant le match.',
    mods: { mashBonus: 1.18, tempoWindow: 0.92 },
    cri: { label: 'C’EST RENTABLE ?', gest: 'mash', power: 46 } },

  { id: 'VP43', nom: 'Le Billet d’Or', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le billet doré de la loge, rangé dans une enveloppe. Il n’a jamais servi.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'C’EST POUR TOI', gest: 'ola', power: 45 } },

  { id: 'VP44', nom: 'Le Paon de la Loge', type: 'tifo', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le paon qui fait la roue dans la loge pour être pris en photo. Il tourne le '
      + 'dos au terrain.',
    mods: { parryBonus: 1.17, mashBonus: 0.92 },
    cri: { label: 'REGARDEZ-MOI', gest: 'tifo', power: 45 } },

  { id: 'VP45', nom: 'La Pianiste du Salon', type: 'voix', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La pianiste du salon VIP que personne n’écoute. Elle joue du Chopin pendant le '
      + 'derby.',
    mods: { tempoWindow: 1.18, perfectBonus: 0.92 },
    cri: { label: 'UN PEU DE CHOPIN ?', gest: 'tempo', power: 46 } },

  { id: 'VP46', nom: 'L’Ascenseur de la Tribune', type: 'perc', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'L’ascenseur doré réservé aux VIP. Il tombe en panne au premier étage, et tout '
      + 'le monde prend l’escalier.',
    mods: { mashBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'EN PANNE', gest: 'salves', power: 45 } },

  { id: 'VP47', nom: 'Le Golfeur', type: 'pyro', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le golfeur qui parle de son handicap pendant tout le match. Il vise le trou '
      + 'même au stade.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'MON HANDICAP', gest: 'visee', power: 46 } },

  { id: 'VP48', nom: 'La Speakerine', type: 'voix', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'La speakerine qui annonce les compositions d’une voix polie. Elle prononce '
      + 'chaque nom avec soin.',
    mods: { tempoWindow: 1.16, mashBonus: 0.92 },
    cri: { label: 'MESDAMES, MESSIEURS', gest: 'tempo', power: 45 } },

  { id: 'VP49', nom: 'Le Bouquet de Fleurs', type: 'pyro', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le bouquet de la loge, sous cellophane, qui ne sert qu’à la photo. Il fane '
      + 'sans avoir rien vu.',
    mods: { perfectBonus: 1.17, holdBonus: 0.92 },
    cri: { label: 'POUR LA PHOTO', gest: 'relance', power: 45 } },

  { id: 'VP50', nom: 'Le Vieux Comte', type: 'fide', set: 'VP', stage: 1, rar: 'commune',
    histoire: 'Le vieux comte qui a sa loge depuis cinquante ans, monocle à l’œil. Il n’a '
      + 'jamais chanté.',
    mods: { holdBonus: 1.17, breathBonus: 0.92 },
    cri: { label: 'DEPUIS CINQUANTE ANS', gest: 'hold', power: 45 } },

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
    cri: { label: 'ONZE ANS', gest: 'bascule', power: 81 } },

  { id: 'GC12', nom: 'La Recette de la Buvette', type: 'fide', set: 'GC', stage: 1, rar: 'legendaire',
    histoire: 'Un cahier à spirale, quatre lignes, et le nom de celle qui l’a écrite. '
      + 'Trois générations l’ont suivi sans jamais y changer une virgule.',
    mods: { holdBonus: 1.44, refundBonus: 1.24, mashBonus: 0.84 },
    cri: { label: 'ON N’Y TOUCHE PAS', gest: 'leurres', power: 80 } },

  { id: 'GC13', nom: 'Le Barbecue du Parking Nord', type: 'pyro', set: 'GC', stage: 1, rar: 'legendaire',
    histoire: 'Allumé à onze heures pour un match à vingt et une. La fumée se voit de '
      + 'l’autoroute et c’est le seul panneau dont le club ait besoin.',
    mods: { perfectBonus: 1.46, breathBonus: 1.2, costPenalty: 1.3 },
    cri: { label: 'ÇA SENT D’ICI', gest: 'visee', power: 83 } },

  { id: 'GC14', nom: 'La Dernière Tournée', type: 'voix', set: 'GC', stage: 1, rar: 'legendaire',
    histoire: 'Payée par celui qui a le moins de raisons de payer, un soir de défaite. '
      + 'C’est de ces soirs-là qu’on se souvient, pas des victoires.',
    mods: { tempoWindow: 1.3, refundBonus: 1.36, perfectBonus: 0.86 },
    cri: { label: 'C’EST MA TOURNÉE', gest: 'justesse', power: 82 } },

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

  /* GD17 à GD52 — les trente-six galères de la refonte du 1er novembre 2026
     (45 personnages et 5 légendaires par série, demande de Gaël). Fiches et
     dessins : fanzzy-prompts/SERIES-50/GD-les-galeres-de-deplacement.md. */
  { id: 'GD17', nom: 'La Glacière du Car', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La glacière qu’on ouvre au premier péage et qui nourrit tout le car. Elle '
      + 'penche d’un côté, le couvercle ferme mal, et il reste toujours un sandwich.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'QUI A FAIM ?', gest: 'leurres', power: 45 } },

  { id: 'GD18', nom: 'Le Sac de Couchage', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le sac de couchage qu’on déroule dans l’allée du car à trois heures du matin. '
      + 'Il ne ferme plus, il garde chaud quand même.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'CHUT, ILS DORMENT', gest: 'leurres', power: 45 } },

  { id: 'GD19', nom: 'Le Billet Perdu', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Elle perd son billet dans le car, le cherche une heure et le retrouve dans sa '
      + 'chaussette. Elle n’a jamais compris comment.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'JE L’AI !', gest: 'cortege', power: 45 } },

  { id: 'GD20', nom: 'Le Chauffeur du Car', type: 'voix', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le chauffeur du car qui a fait mille déplacements sans jamais voir un match. '
      + 'Il attend sur le parking et il compte les chants.',
    mods: { tempoWindow: 1.17, refundBonus: 0.92 },
    cri: { label: 'ON Y VA', gest: 'tempo', power: 46 } },

  { id: 'GD21', nom: 'La Valise Cassée', type: 'perc', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La valise à roulette cassée qui racle le trottoir jusqu’à la gare. On l’entend '
      + 'arriver de loin, par petits coups.',
    mods: { mashBonus: 1.16, holdBonus: 0.92 },
    cri: { label: 'CLAC, CLAC', gest: 'salves', power: 45 } },

  { id: 'GD22', nom: 'La Grand-Mère du Covoiturage', type: 'pyro', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La grand-mère qui conduit quatre jeunes au stade dans sa petite voiture. Elle '
      + 'connaît tous les raccourcis et elle ne ralentit jamais.',
    mods: { perfectBonus: 1.18, breathBonus: 0.92 },
    cri: { label: 'ATTACHEZ-VOUS', gest: 'relance', power: 46 } },

  { id: 'GD23', nom: 'Le Panneau de Sortie', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le panneau de sortie qu’on rate toujours, à chaque déplacement. Le car fait '
      + 'demi-tour, tout le monde chante.',
    mods: { breathBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'C’ÉTAIT LÀ !', gest: 'echarpe', power: 45 } },

  { id: 'GD24', nom: 'La Carte Routière', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La carte routière qu’on n’arrive jamais à replier. Elle prend tout le '
      + 'pare-brise et personne ne sait la lire.',
    mods: { breathBonus: 1.17, tempoWindow: 0.92 },
    cri: { label: 'ON EST OÙ ?', gest: 'cortege', power: 45 } },

  { id: 'GD25', nom: 'Le Premier Déplacement', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le gamin de onze ans qui part pour son premier déplacement avec un sac trop '
      + 'lourd. Il ne dort pas de la nuit.',
    mods: { breathBonus: 1.18, refundBonus: 0.92 },
    cri: { label: 'MON PREMIER', gest: 'echarpe', power: 46 } },

  { id: 'GD26', nom: 'Le Ferry de Nuit', type: 'voix', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le ferry de nuit où le virage dort sur le pont. Les chants reviennent avec les '
      + 'vagues.',
    mods: { tempoWindow: 1.16, parryResist: 0.92 },
    cri: { label: 'ÇA TANGUE', gest: 'justesse', power: 45 } },

  { id: 'GD27', nom: 'La Sandwicherie de l’Aire', type: 'pyro', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La vendeuse de l’aire d’autoroute qui sert quarante sandwichs à quatre heures '
      + 'du matin. Elle les lance par-dessus le comptoir sans en rater un.',
    mods: { perfectBonus: 1.17, mashBonus: 0.92 },
    cri: { label: 'QUARANTE SANDWICHS', gest: 'meche', power: 45 } },

  { id: 'GD28', nom: 'Le Ticket de Métro', type: 'voix', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le ticket de métro usé qu’on garde pour le retour. Il est passé dans toutes '
      + 'les poches du groupe.',
    mods: { tempoWindow: 1.17, breathBonus: 0.92 },
    cri: { label: 'TERMINUS', gest: 'tempo', power: 45 } },

  { id: 'GD29', nom: 'Le Coussin de Nuque', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le coussin de nuque gonflable qui ne tient jamais. On le regonfle à chaque '
      + 'péage.',
    mods: { holdBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'IL SE DÉGONFLE', gest: 'leurres', power: 45 } },

  { id: 'GD30', nom: 'La Stoppeuse', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Elle rejoint le stade en stop avec un carton à bout de bras. Elle arrive '
      + 'toujours avant le car.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'LE STADE ?', gest: 'echarpe', power: 45 } },

  { id: 'GD31', nom: 'Le Klaxon', type: 'perc', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le klaxon du car qui répond à tous les klaxons de l’autoroute. Il est enroué '
      + 'depuis le dernier déplacement.',
    mods: { mashBonus: 1.18, tempoWindow: 0.92 },
    cri: { label: 'TÛT TÛT', gest: 'mash', power: 46 } },

  { id: 'GD32', nom: 'Le Bouchon', type: 'pyro', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'L’embouteillage du retour, des kilomètres de feux rouges. On compte les '
      + 'voitures pour passer le temps.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'ÇA AVANCE ?', gest: 'compte', power: 46 } },

  { id: 'GD33', nom: 'La Pompe à Essence', type: 'tifo', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La pompe de la station-service où tout le car descend à minuit. Elle éclaire '
      + 'le parking comme une scène.',
    mods: { parryBonus: 1.17, breathBonus: 0.92 },
    cri: { label: 'TOUT LE MONDE DESCEND', gest: 'tifo', power: 46 } },

  { id: 'GD34', nom: 'Le Vélo du Déplacement', type: 'perc', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Il va au match à vélo, deux cents kilomètres. Il arrive à la mi-temps et il '
      + 'chante plus fort que tout le monde.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'DEUX CENTS BORNES', gest: 'accents', power: 45 } },

  { id: 'GD35', nom: 'La Photographe du Car', type: 'tifo', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Elle photographie chaque déplacement depuis la fenêtre du car, avec un '
      + 'appareil jetable. Elle ne regarde jamais les photos.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'SOURIEZ', gest: 'mosaique', power: 45 } },

  { id: 'GD36', nom: 'L’Essuie-Glace', type: 'voix', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'L’essuie-glace qui bat sous l’orage pendant tout le trajet. Il grince toujours '
      + 'à contretemps.',
    mods: { tempoWindow: 1.16, backfire: 1.06 },
    cri: { label: 'ÇA GRINCE', gest: 'contretemps', power: 45 } },

  { id: 'GD37', nom: 'La Doyenne du Car', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Elle a quatre-vingt-deux ans et elle n’a raté aucun déplacement depuis 1968. '
      + 'Elle tricote dans le car.',
    mods: { holdBonus: 1.17, tempoWindow: 0.92 },
    cri: { label: 'DEPUIS 1968', gest: 'hold', power: 46 } },

  { id: 'GD38', nom: 'La Contrôleuse du Train', type: 'voix', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La contrôleuse du train spécial qui vérifie trois cents billets en chantant. '
      + 'Tout le wagon reprend après elle.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'BILLETS, S’IL VOUS PLAÎT', gest: 'justesse', power: 45 } },

  { id: 'GD39', nom: 'La Tente du Camping', type: 'tifo', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La tente montée de travers au camping municipal la veille du match. Elle '
      + 's’effondre deux fois dans la nuit.',
    mods: { parryBonus: 1.16, holdBonus: 0.92 },
    cri: { label: 'ELLE S’EFFONDRE', gest: 'tifo', power: 45 } },

  { id: 'GD40', nom: 'Le Vol Retardé', type: 'pyro', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le steward du vol charter qui annonce trois heures de retard. Il finit par '
      + 'chanter avec la cabine.',
    mods: { perfectBonus: 1.17, tempoWindow: 0.92 },
    cri: { label: 'TROIS HEURES DE RETARD', gest: 'relance', power: 45 } },

  { id: 'GD41', nom: 'La Clé d’Hôtel', type: 'tifo', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La clé de la chambre 12 de l’hôtel bon marché où dorment six supporters. Elle '
      + 'se perd tous les soirs.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'CHAMBRE 12', gest: 'puzzle', power: 45 } },

  { id: 'GD42', nom: 'La Pèlerine des Stades', type: 'tifo', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Elle veut voir un match dans tous les stades d’Europe, et elle coche son '
      + 'carnet à chaque nouvelle tribune.',
    mods: { parryBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'ET D’UN DE PLUS', gest: 'ola', power: 45 } },

  { id: 'GD43', nom: 'Le Mal des Transports', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Il a le mal des transports au premier virage, le sac en papier à la main. Il '
      + 'vient quand même, à chaque fois.',
    mods: { holdBonus: 1.17, breathBonus: 0.92 },
    cri: { label: 'ÇA VA ALLER', gest: 'hold', power: 45 } },

  { id: 'GD44', nom: 'Le Scooter', type: 'perc', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le scooter qui part au stade avec deux passagers et trois drapeaux. Il tousse '
      + 'à chaque côte.',
    mods: { mashBonus: 1.17, parryResist: 0.92 },
    cri: { label: 'BIP BIP', gest: 'mash', power: 45 } },

  { id: 'GD45', nom: 'La Chanteuse du Car', type: 'voix', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Elle lance les chants au micro du car pendant six heures. Personne n’a jamais '
      + 'réussi à lui prendre le micro.',
    mods: { tempoWindow: 1.17, perfectBonus: 0.92 },
    cri: { label: 'UN, DEUX, TROIS', gest: 'tempo', power: 46 } },

  { id: 'GD46', nom: 'Le Chien de l’Aire', type: 'depl', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le chien errant de l’aire d’autoroute que le car adopte. Il dort sous les '
      + 'sièges et il aboie aux buts.',
    mods: { breathBonus: 1.17, tempoWindow: 0.92 },
    cri: { label: 'OUAF', gest: 'echarpe', power: 45 } },

  { id: 'GD47', nom: 'Le Retour à 5 h', type: 'tifo', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Elle rentre du déplacement à cinq heures du matin et part directement '
      + 'travailler. Elle n’a pas fermé l’œil.',
    mods: { parryBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'BONNE NUIT, BONJOUR', gest: 'tifo', power: 45 } },

  { id: 'GD48', nom: 'Le Bagagiste', type: 'fide', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le bagagiste de la gare qui porte les sacs de tout le groupe. Il ne pose '
      + 'jamais rien.',
    mods: { holdBonus: 1.17, perfectBonus: 0.92 },
    cri: { label: 'DONNEZ-MOI ÇA', gest: 'hold', power: 46 } },

  { id: 'GD49', nom: 'La Lampe Frontale', type: 'pyro', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La lampe frontale qu’on sort pour trouver la sortie du parking de nuit. Elle '
      + 'vise toujours à côté.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'LA SORTIE ?', gest: 'meche', power: 46 } },

  { id: 'GD50', nom: 'La Carte Postale', type: 'pyro', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La carte postale qu’on envoie à la grand-mère de chaque déplacement. Elle '
      + 'arrive toujours après le retour.',
    mods: { perfectBonus: 1.17, holdBonus: 0.92 },
    cri: { label: 'BONS BAISERS', gest: 'relance', power: 45 } },

  { id: 'GD51', nom: 'La Couchette du Train de Nuit', type: 'pyro', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'La couchette du train de nuit, trop courte, où l’on dort mal. On refait le '
      + 'match jusqu’à l’aube.',
    mods: { perfectBonus: 1.17, breathBonus: 0.92 },
    cri: { label: 'ON REFAIT LE MATCH', gest: 'meche', power: 45 } },

  { id: 'GD52', nom: 'Le Triangle de Signalisation', type: 'perc', set: 'GD', stage: 1, rar: 'commune',
    histoire: 'Le triangle rouge posé derrière le minibus en panne. Il a vu passer tous les '
      + 'cars des autres clubs.',
    mods: { mashBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'ATTENTION', gest: 'mash', power: 45 } },
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
    cri: { label: 'ON RESTE', gest: 'puzzle', power: 82 } },

  { id: 'MT11', nom: 'Le Vent de Face Permanent', type: 'depl', set: 'MT', stage: 1, rar: 'legendaire',
    histoire: 'Il souffle dans le même sens depuis que le stade existe, parce qu’on l’a '
      + 'construit dans le mauvais. L’adversaire ne le sait jamais.',
    mods: { breathBonus: 1.38, parryResist: 1.24, perfectBonus: 0.84 },
    cri: { label: 'ON CONNAÎT', gest: 'bascule', power: 80 } },

  { id: 'MT12', nom: 'Le Terrain Inondé', type: 'fide', set: 'MT', stage: 1, rar: 'legendaire',
    histoire: 'Le ballon s’arrête là où il tombe et le match devient autre chose. '
      + 'C’est le seul soir où l’équipe la plus faible a une chance.',
    mods: { holdBonus: 1.44, parryResist: 1.3, mashBonus: 0.8 },
    cri: { label: 'IL S’ARRÊTE', gest: 'jauge', power: 81 } },

  { id: 'MT13', nom: 'L’Éclipse de la Mi-Temps', type: 'voix', set: 'MT', stage: 1, rar: 'legendaire',
    histoire: 'Trois minutes de nuit à seize heures, et trente mille personnes qui se '
      + 'taisent d’un coup. Le seul silence que ce stade ait connu.',
    mods: { tempoWindow: 1.34, perfectBonus: 1.26, breathBonus: 0.84 },
    cri: { label: 'PLUS UN BRUIT', gest: 'justesse', power: 83 } },


  /* MT15 à MT50 — les trente-six phénomènes de la refonte du 1er novembre 2026
     (45 personnages et 5 légendaires par série, demande de Gaël). Fiches et
     dessins : fanzzy-prompts/SERIES-50/MT-les-phenomenes-meteo.md. */
  { id: 'MT15', nom: 'La Bruine', type: 'voix', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'La pluie fine qu’on ne sent pas, celle qui ne mérite même pas une capuche. Au '
      + 'bout d’une heure elle est trempée et elle jure qu’il ne pleut pas.',
    mods: { tempoWindow: 1.16, backfire: 1.1 },
    cri: { label: 'ÇA MOUILLE PAS', gest: 'contretemps', power: 46 } },

  { id: 'MT16', nom: 'L’Arc-en-Ciel du But', type: 'tifo', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Il sort pile au moment du but, d’un bout à l’autre du ciel. Personne ne l’a '
      + 'jamais vu un jour de défaite.',
    mods: { parryBonus: 1.18, backfire: 1.12 },
    cri: { label: 'IL EST SORTI', gest: 'tifo', power: 47 } },

  { id: 'MT17', nom: 'Le Gamin au Parapluie', type: 'tifo', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Son parapluie est trop petit pour un, et il abrite quand même ses deux '
      + 'voisins. Le parapluie s’est retourné trois fois, il ne l’a jamais lâché.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'TOUS DESSOUS', gest: 'tifo', power: 46 } },

  { id: 'MT18', nom: 'Le Nuage Bas', type: 'fide', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Un petit nuage descendu si bas qu’il s’est posé sur le toit de la tribune. Il '
      + 'devait passer, il est resté.',
    mods: { holdBonus: 1.18, backfire: 1.1 },
    cri: { label: 'JE RESTE LÀ', gest: 'hold', power: 46 } },

  { id: 'MT19', nom: 'La Flaque du Parvis', type: 'depl', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'La flaque devant l’entrée dans laquelle tout le monde marche, à chaque match, '
      + 'depuis des années. Personne ne l’a jamais vue sécher.',
    mods: { breathBonus: 1.16, backfire: 1.1 },
    cri: { label: 'PLOUF', gest: 'miroir', power: 46 } },

  { id: 'MT20', nom: 'Le Thermomètre de la Buvette', type: 'fide', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le thermomètre de la buvette, que tout le monde regarde avant de commander. '
      + 'Sous cinq degrés, c’est vin chaud pour tout le rang.',
    mods: { holdBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'COMBIEN IL FAIT ?', gest: 'jauge', power: 46 } },

  { id: 'MT21', nom: 'Le Sable dans les Yeux', type: 'depl', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Partie en déplacement dans le sud, elle a ramené du sable dans les chaussures, '
      + 'le sac et les cheveux. Six mois après, elle en trouve encore.',
    mods: { breathBonus: 1.18, backfire: 1.12 },
    cri: { label: 'ON TRAVERSE', gest: 'echarpe', power: 47 } },

  { id: 'MT22', nom: 'Le Coup de Chaleur', type: 'fide', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Un jour de canicule, elle a fait passer sa gourde dans tout le rang. Elle est '
      + 'revenue vide, et elle est repartie la remplir.',
    mods: { holdBonus: 1.16, backfire: 1.1 },
    cri: { label: 'BOIS UN COUP', gest: 'tenue', power: 46 } },

  { id: 'MT23', nom: 'Le Flocon Égaré', type: 'pyro', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le premier flocon tombé sur la pelouse en novembre, qui tournoie tout seul '
      + 'sous les projecteurs. Tout le virage l’a montré du doigt.',
    mods: { perfectBonus: 1.2, backfire: 1.16 },
    cri: { label: 'IL NEIGE !', gest: 'relance', power: 46 } },

  { id: 'MT24', nom: 'Le Givre sur les Sièges', type: 'fide', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'La grand-mère qui tricote au premier rang du match de décembre. Sa laine gèle '
      + 'au fil des minutes, et elle continue.',
    mods: { holdBonus: 1.17, tempoWindow: 0.92 },
    cri: { label: 'MAILLE À L’ENDROIT', gest: 'hold', power: 46 } },

  { id: 'MT25', nom: 'Le Courant d’Air', type: 'voix', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le courant d’air glacé qui siffle dans le couloir d’accès. On l’entend avant '
      + 'd’entrer, on l’entend encore en sortant.',
    mods: { tempoWindow: 1.17, backfire: 1.1 },
    cri: { label: 'ÇA SIFFLE', gest: 'justesse', power: 46 } },

  { id: 'MT26', nom: 'L’Éclair de Chaleur', type: 'pyro', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Elle photographie les éclairs muets d’un soir d’août, loin à l’horizon. Elle '
      + 'n’en a jamais eu un net.',
    mods: { perfectBonus: 1.18, backfire: 1.14 },
    cri: { label: 'TU AS VU ?', gest: 'relance', power: 46 } },

  { id: 'MT27', nom: 'La Rosée du Soir', type: 'tifo', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le jardinier du club regarde la rosée briller sur la pelouse au coup d’envoi '
      + 'tardif. Il dit que c’est la plus belle pelouse du championnat, et il a raison.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'LA ROSÉE BRILLE', gest: 'tri', power: 46 } },

  { id: 'MT28', nom: 'Le Pluviomètre', type: 'voix', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Il note la pluie de chaque match dans un carnet, depuis trente ans. Il sait '
      + 'exactement combien il est tombé le soir de la finale.',
    mods: { tempoWindow: 1.18, perfectBonus: 0.92 },
    cri: { label: 'TROIS MILLIMÈTRES', gest: 'tempo', power: 46 } },

  { id: 'MT29', nom: 'La Tornade de Gobelets', type: 'perc', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le petit tourbillon qui fait danser les gobelets vides dans la tribune. Il ne '
      + 'sait pas s’arrêter, et personne ne le lui demande.',
    mods: { mashBonus: 1.17, backfire: 1.12 },
    cri: { label: 'ÇA TOURNE', gest: 'accents', power: 46 } },

  { id: 'MT30', nom: 'La Mouette de Tempête', type: 'depl', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'La mouette poussée dans le stade par le vent du large, qui a volé un sandwich '
      + 'en tribune. Elle est revenue la semaine suivante.',
    mods: { breathBonus: 1.17, backfire: 1.1 },
    cri: { label: 'ELLE EST ENTRÉE', gest: 'echarpe', power: 46 } },

  { id: 'MT31', nom: 'Le Soleil d’Hiver', type: 'pyro', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le petit soleil pâle d’un match de janvier, et elle qui tend son visage vers '
      + 'lui. Il ne chauffe pas, elle sourit quand même.',
    mods: { perfectBonus: 1.18, breathBonus: 0.92 },
    cri: { label: 'UN RAYON', gest: 'relance', power: 46 } },

  { id: 'MT32', nom: 'Le Bob de Plage', type: 'tifo', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Il vient au match de juillet comme à la plage, bob sur la tête et serviette '
      + 'sur l’épaule. Il manque juste le sable.',
    mods: { parryBonus: 1.16, backfire: 1.1 },
    cri: { label: 'À LA PLAGE', gest: 'ola', power: 46 } },

  { id: 'MT33', nom: 'La Glissade', type: 'pyro', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Elle a glissé sur les marches gelées et elle en a fait une figure. Tout le '
      + 'rang a applaudi.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'OUPS', gest: 'meche', power: 46 } },

  { id: 'MT34', nom: 'La Buée', type: 'depl', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Ses lunettes s’embuent dès qu’il entre à la buvette. Il ressort, ça '
      + 's’éclaircit, il rentre, ça recommence.',
    mods: { breathBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'JE VOIS RIEN', gest: 'bascule', power: 46 } },

  { id: 'MT35', nom: 'Le Nuage Noir du Kop', type: 'perc', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le nuage noir qui arrive en même temps que le but adverse. Il boude au-dessus '
      + 'du kop jusqu’à la fin.',
    mods: { mashBonus: 1.18, backfire: 1.12 },
    cri: { label: 'IL GRONDE', gest: 'mash', power: 47 } },

  { id: 'MT36', nom: 'La Feuille Morte', type: 'tifo', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'La feuille qui tombe sur la pelouse au premier match de la rentrée. Le '
      + 'jardinier la ramasse, le vent en ramène une autre.',
    mods: { parryBonus: 1.17, backfire: 1.1 },
    cri: { label: 'LA PREMIÈRE FEUILLE', gest: 'mosaique', power: 46 } },

  { id: 'MT37', nom: 'L’Éternuement d’Avril', type: 'tifo', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Allergique, elle éternue au premier match d’avril et tout le rang lui répond « '
      + 'à tes souhaits ». Elle vient quand même, le mouchoir à la main.',
    mods: { parryBonus: 1.16, backfire: 1.1 },
    cri: { label: 'ATCHOUM', gest: 'tifo', power: 46 } },

  { id: 'MT38', nom: 'La Gouttière Percée', type: 'perc', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le plombier bénévole qui répare la gouttière qui arrose toujours le même '
      + 'siège. Elle fuit à nouveau le match suivant.',
    mods: { mashBonus: 1.16, backfire: 1.1 },
    cri: { label: 'PLIC, PLOC', gest: 'deuxvoix', power: 46 } },

  { id: 'MT39', nom: 'Le Vent Fou', type: 'voix', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Les jours de vent chaud, ses cheveux sont en bataille dès l’entrée. Elle a '
      + 'renoncé à les attacher.',
    mods: { tempoWindow: 1.16, backfire: 1.12 },
    cri: { label: 'MES CHEVEUX !', gest: 'capo', power: 46 } },

  { id: 'MT40', nom: 'La Pluie d’Été', type: 'perc', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'La goutte d’averse tiède de juillet qu’on accueille les bras ouverts. Elle '
      + 'rebondit sur les sièges et tout le monde rit.',
    mods: { mashBonus: 1.17, perfectBonus: 0.92 },
    cri: { label: 'ENFIN !', gest: 'mash', power: 46 } },

  { id: 'MT41', nom: 'Le Ballon de l’École', type: 'pyro', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le petit ballon météo lâché par l’école d’en face, qui passe au-dessus du '
      + 'stade pendant le match. Tout le virage compte jusqu’à ce qu’il disparaisse.',
    mods: { perfectBonus: 1.18, backfire: 1.12 },
    cri: { label: 'LÂCHEZ !', gest: 'meche', power: 46 } },

  { id: 'MT42', nom: 'La Brume du Fleuve', type: 'depl', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Elle vient du port à pied, dans la brume du fleuve, une petite lampe à la '
      + 'main. Elle n’est jamais en retard.',
    mods: { breathBonus: 1.16, backfire: 1.1 },
    cri: { label: 'ON Y VOIT RIEN', gest: 'echarpe', power: 46 } },

  { id: 'MT43', nom: 'La Lune Haute', type: 'voix', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'La petite lune qui se lève au-dessus du match du soir, timide derrière le '
      + 'toit. À la mi-temps, elle est déjà plus haute.',
    mods: { tempoWindow: 1.17, backfire: 1.1 },
    cri: { label: 'ELLE SE LÈVE', gest: 'tempo', power: 46 } },

  { id: 'MT44', nom: 'Le Ciel du Retour', type: 'depl', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le gamin qui regarde les étoiles par la vitre du car, au retour d’un '
      + 'déplacement. Il les compte jusqu’à s’endormir.',
    mods: { breathBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'REGARDE DEHORS', gest: 'memoire', power: 46 } },

  { id: 'MT45', nom: 'L’Aurore', type: 'voix', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Elle descend du car au lever du soleil après une nuit de déplacement, les yeux '
      + 'à moitié fermés. Elle est la première à chanter.',
    mods: { tempoWindow: 1.16, perfectBonus: 0.92 },
    cri: { label: 'DÉJÀ LE MATIN ?', gest: 'tempo', power: 46 } },

  { id: 'MT46', nom: 'La Congère', type: 'perc', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le bénévole à la pelle qui déblaie la neige devant les portes avant chaque '
      + 'match d’hiver. Il commence à six heures.',
    mods: { mashBonus: 1.16, backfire: 1.1 },
    cri: { label: 'À LA PELLE', gest: 'mash', power: 46 } },

  { id: 'MT47', nom: 'La Goutte au Nez', type: 'fide', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Enrhumée, la goutte au nez, elle vient quand même. Elle n’a pas raté un match '
      + 'en douze hivers.',
    mods: { holdBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'JE VIENS QUAND MÊME', gest: 'hold', power: 46 } },

  { id: 'MT48', nom: 'Le Coup de Soleil', type: 'pyro', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Rouge comme une tomate après un match d’août, il a oublié la crème. Il '
      + 'l’oublie à chaque fois.',
    mods: { perfectBonus: 1.17, backfire: 1.12 },
    cri: { label: 'ÇA BRÛLE', gest: 'rouleaux', power: 46 } },

  { id: 'MT49', nom: 'La Bourrasque de Confettis', type: 'perc', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Le coup de vent qui renvoie les confettis du tifo droit dans le kop. On en '
      + 'retrouve dans les poches jusqu’à Noël.',
    mods: { mashBonus: 1.17, backfire: 1.14 },
    cri: { label: 'ILS REVIENNENT', gest: 'salves', power: 46 } },

  { id: 'MT50', nom: 'L’Accalmie', type: 'fide', set: 'MT', stage: 1, rar: 'commune',
    histoire: 'Elle sourit en silence quand la pluie s’arrête, et elle referme son parapluie '
      + 'la première. Elle sent toujours le moment avant les autres.',
    mods: { holdBonus: 1.17, backfire: 1.1 },
    cri: { label: 'ÇA S’ARRÊTE', gest: 'retenue', power: 46 } },
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
    cri: { label: 'C’ÉTAIT QUOI CE MATCH', gest: 'justesse', power: 81 } },

  { id: 'HC11', nom: 'La Chaîne Cryptée', type: 'tifo', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Elle a le match, et elle seule. Quatre générations ont appris à '
      + 'reconnaître un but au son étouffé qui traverse le mur du voisin.',
    mods: { parryBonus: 1.5, parryResist: 1.22, breathBonus: 0.84 },
    cri: { label: 'CHEZ LE VOISIN', gest: 'tri', power: 80 } },

  { id: 'HC12', nom: 'Le Forum de 2004', type: 'fide', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Encore en ligne, encore actif, et le même débat qu’au premier jour. '
      + 'Quarante-sept mille messages sur un penalty non sifflé.',
    mods: { holdBonus: 1.46, parryResist: 1.26, tempoInterval: 110 },
    cri: { label: 'PAGE 1 204', gest: 'jauge', power: 79 } },

  { id: 'HC13', nom: 'Le Direct Commenté', type: 'perc', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Du texte, rafraîchi toutes les trente secondes, et rien d’autre. C’est '
      + 'comme ça qu’une génération entière a vécu ses déplacements.',
    mods: { mashBonus: 1.42, perfectBonus: 1.22, breathBonus: 0.86 },
    cri: { label: 'F5 · F5 · F5', gest: 'accents', power: 82 } },

  { id: 'HC14', nom: 'La Streameuse de Minuit', type: 'depl', set: 'HC', stage: 1, rar: 'legendaire',
    histoire: 'Elle commente seule, pour trois cents personnes, un match que personne '
      + 'd’autre ne diffuse. À deux heures du matin ils sont encore là.',
    mods: { breathBonus: 1.36, refundBonus: 1.28, mashBonus: 0.84 },
    cri: { label: 'VOUS ÊTES ENCORE LÀ ?', gest: 'cortege', power: 80 } },

  /* HC17 à HC51 — les trente-cinq héros du canapé de la refonte (45 personnages
     et 5 légendaires par série, demande de Gaël). Fiches et dessins :
     series-prompts/HC-les-heros-du-canape.md. */
  { id: 'HC17', nom: 'Le Canapé', type: 'fide', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Le vieux canapé qui a vu tous les matchs de la famille. Il a un creux à la '
      + 'place de chacun, et personne ne s’assoit dans celui du grand-père.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'TOUT LE MONDE ASSIS', gest: 'hold', power: 45 } },

  { id: 'HC18', nom: 'La Mamie Devant la Télé', type: 'depl', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle ne rate aucun match depuis 1970 et elle connaît tous les joueurs par leur '
      + 'prénom. Elle les appelle aussi par celui de leur père.',
    mods: { breathBonus: 1.16, mashBonus: 0.9 },
    cri: { label: 'C’EST LE PETIT DE…', gest: 'cortege', power: 44 } },

  { id: 'HC19', nom: 'La Télécommande', type: 'tifo', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Introuvable au coup d’envoi, toujours coincée entre deux coussins. Il lui '
      + 'manque un bouton, et c’était celui du son.',
    mods: { parryBonus: 1.16, refundBonus: 0.9 },
    cri: { label: 'QUI M’A VUE ?', gest: 'tri', power: 45 } },

  { id: 'HC20', nom: 'La Box Internet', type: 'pyro', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle redémarre toute seule à la 88e minute, au pire moment, et le salon entier '
      + 'retient son souffle devant ses petites lumières.',
    mods: { perfectBonus: 1.16, breathBonus: 0.9 },
    cri: { label: 'REDÉMARRAGE…', gest: 'relance', power: 46 } },

  { id: 'HC21', nom: 'Le Joueur de Console', type: 'perc', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Tous les soirs il rejoue la finale sur sa console, et tous les soirs son club '
      + 'gagne. La manette a perdu sa croix directionnelle en 2024.',
    mods: { mashBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'PAUSE, PAUSE !', gest: 'mash', power: 45 } },

  { id: 'HC22', nom: 'La Podcasteuse', type: 'voix', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Chaque lundi, deux heures d’analyse enregistrées dans sa cuisine, entre le '
      + 'frigo et la bouilloire. Elle a quatre cents auditeurs fidèles et un chat qui '
      + 'miaule au générique.',
    mods: { tempoWindow: 1.16, holdBonus: 0.9 },
    cri: { label: 'BIENVENUE DANS L’ÉPISODE', gest: 'tempo', power: 45 } },

  { id: 'HC23', nom: 'Le Plaid', type: 'fide', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Le plaid à carreaux sous lequel toute la famille regarde le match d’hiver. On '
      + 'se le dispute à la mi-temps, et une frange est déjà partie.',
    mods: { holdBonus: 1.14, tempoInterval: 60 },
    cri: { label: 'PLACE POUR UN', gest: 'leurres', power: 44 } },

  { id: 'HC24', nom: 'La Coloc Qui Dort', type: 'pyro', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle dort sur le canapé du coup d’envoi au coup de sifflet final, et elle se '
      + 'réveille pile pour le but. Elle ne l’a jamais raté.',
    mods: { perfectBonus: 1.18, refundBonus: 0.9 },
    cri: { label: 'QUOI ? BUT ?', gest: 'visee', power: 46 } },

  { id: 'HC25', nom: 'La Fille Qui Lit les Stats', type: 'tifo', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle sait combien de corners le club a tirés en 1998, et elle a raison. Elle '
      + 'le note dans un cahier vert d’eau, au crayon, avec la date.',
    mods: { parryBonus: 1.18, breathBonus: 0.9 },
    cri: { label: 'EN FAIT, NON', gest: 'tifo', power: 46 } },

  { id: 'HC26', nom: 'Le Réveil', type: 'pyro', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Réglé à 4 h 55 pour le match à l’autre bout du monde. Il sonne un peu trop '
      + 'fort et il a la cloche cabossée.',
    mods: { perfectBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'DEBOUT, ÇA COMMENCE', gest: 'relance', power: 45 } },

  { id: 'HC27', nom: 'Le Livreur de Pizza', type: 'depl', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il sonne pile au but et il reste regarder la reprise sur le pas de la porte, '
      + 'le carton encore chaud dans les mains.',
    mods: { breathBonus: 1.16, perfectBonus: 0.9 },
    cri: { label: 'QUI A COMMANDÉ ?', gest: 'echarpe', power: 45 } },

  { id: 'HC28', nom: 'L’Antenne du Toit', type: 'pyro', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'On la tourne à la main sur le toit pendant que quelqu’un crie depuis le salon. '
      + 'Une de ses branches est tordue depuis l’orage de 2009.',
    mods: { perfectBonus: 1.14, parryResist: 0.9 },
    cri: { label: 'LÀ ! ÇA MARCHE !', gest: 'relance', power: 45 } },

  { id: 'HC29', nom: 'La Supportrice Expatriée', type: 'depl', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle vit à l’étranger et regarde chaque match de son club à l’heure du '
      + 'déjeuner, seule au bureau, le téléphone calé contre un sandwich.',
    mods: { breathBonus: 1.14, holdBonus: 0.9 },
    cri: { label: 'ICI, ON EST LÀ', gest: 'echarpe', power: 44 } },

  { id: 'HC30', nom: 'Le Grand-Père à la Radio', type: 'voix', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il écoute le match à la radio en même temps qu’il le regarde à la télé, le son '
      + 'coupé. La radio, elle, ne ment pas.',
    mods: { tempoWindow: 1.14, mashBonus: 0.9 },
    cri: { label: 'ÉCOUTEZ LA RADIO', gest: 'justesse', power: 45 } },

  { id: 'HC31', nom: 'Le Fauteuil Inclinable', type: 'fide', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il se renverse tout seul au moment du penalty, et il grince à chaque but. '
      + 'Personne n’a jamais retrouvé le manuel.',
    mods: { holdBonus: 1.14, breathBonus: 0.9 },
    cri: { label: 'TOUT EN ARRIÈRE', gest: 'retenue', power: 44 } },

  { id: 'HC32', nom: 'La Voisine Qui Crie au But', type: 'voix', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'On l’entend crier depuis son balcon trente secondes avant son propre écran. '
      + 'Tout l’immeuble sait le score avant elle.',
    mods: { tempoWindow: 1.18, refundBonus: 0.9 },
    cri: { label: 'BUUUUUT !', gest: 'tempo', power: 46 } },

  { id: 'HC33', nom: 'Le Mug du Match', type: 'fide', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Le mug ébréché qu’on ne lave jamais les soirs de victoire, pour ne pas briser '
      + 'le sort. Le sachet de thé y est depuis le dernier titre.',
    mods: { holdBonus: 1.18, parryResist: 0.9 },
    cri: { label: 'ON NE ME LAVE PAS', gest: 'hold', power: 46 } },

  { id: 'HC34', nom: 'Le Dessinateur de BD', type: 'tifo', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il dessine chaque match en trois cases et il les poste le lendemain matin. La '
      + 'troisième case est toujours la plus drôle.',
    mods: { parryBonus: 1.16, tempoWindow: 0.9 },
    cri: { label: 'EN TROIS CASES', gest: 'puzzle', power: 45 } },

  { id: 'HC35', nom: 'Le Projecteur du Bar', type: 'tifo', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Le vieux projecteur du bar du coin, calé sur un sous-bock. Les soirs de match '
      + 'il transforme le mur en écran géant, et il chauffe un peu.',
    mods: { parryBonus: 1.2, holdBonus: 0.9 },
    cri: { label: 'ÉTEIGNEZ LA LUMIÈRE', gest: 'tifo', power: 46 } },

  { id: 'HC36', nom: 'La Reine du Karaoké', type: 'voix', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle connaît tous les chants du virage par cœur et elle les chante au karaoké '
      + 'du bar après le match. Elle ne regarde jamais l’écran.',
    mods: { tempoWindow: 1.14, breathBonus: 0.9 },
    cri: { label: 'TOUT LE BAR AVEC MOI', gest: 'justesse', power: 45 } },

  { id: 'HC37', nom: 'Le Câble HDMI', type: 'depl', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'On le cherche cinq minutes avant le coup d’envoi, toujours derrière le meuble. '
      + 'Il a un nœud au milieu que personne n’a jamais défait.',
    mods: { breathBonus: 1.14, tempoWindow: 0.9 },
    cri: { label: 'JE SUIS LÀ-DERRIÈRE', gest: 'miroir', power: 44 } },

  { id: 'HC38', nom: 'La Maman Qui Explique', type: 'tifo', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle explique le hors-jeu avec des tasses et des cuillères sur la table de la '
      + 'cuisine. Tout le monde a compris, sauf l’arbitre.',
    mods: { parryBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'REGARDE, LA TASSE', gest: 'tifo', power: 45 } },

  { id: 'HC39', nom: 'La Petite Sœur Qui S’en Fiche', type: 'fide', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle lit pendant tout le match, le livre à l’envers, et elle demande à la 89e '
      + 'minute qui sont les bleus.',
    mods: { holdBonus: 1.14, perfectBonus: 0.9 },
    cri: { label: 'C’EST QUI, LES BLEUS ?', gest: 'jauge', power: 44 } },

  { id: 'HC40', nom: 'Le Poisson Rouge', type: 'depl', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il tourne dans son bocal à côté de la télé depuis onze ans. Il a vu plus de '
      + 'matchs que tout le monde, et il ne s’en souvient d’aucun.',
    mods: { breathBonus: 1.18, parryResist: 0.9 },
    cri: { label: 'BLOUP', gest: 'echarpe', power: 46 } },

  { id: 'HC41', nom: 'L’Ordinateur Portable', type: 'perc', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Ouvert au bureau, avec le match dans un petit coin de l’écran. Un post-it '
      + 'jaune cache la fenêtre quand le chef passe.',
    mods: { mashBonus: 1.14, holdBonus: 0.9 },
    cri: { label: 'RÉUNION, RÉUNION', gest: 'accents', power: 44 } },

  { id: 'HC42', nom: 'La Prof de Sport', type: 'perc', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle commente chaque match à la récré du lundi, sifflet au cou et chronomètre '
      + 'au poignet. Elle refait les actions avec les élèves.',
    mods: { mashBonus: 1.14, tempoWindow: 0.9 },
    cri: { label: 'ON ACCÉLÈRE !', gest: 'accents', power: 44 } },

  { id: 'HC43', nom: 'La Cloche des Notifications', type: 'perc', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'La petite cloche du téléphone qui sonne à chaque but, même pendant la messe, '
      + 'même pendant le mariage.',
    mods: { mashBonus: 1.18, breathBonus: 0.9 },
    cri: { label: 'DING DING DING', gest: 'mash', power: 46 } },

  { id: 'HC44', nom: 'Le Mec du Rétro', type: 'depl', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il regarde chaque soir de vieux matchs en VHS, en survêtement de 1991. Il jure '
      + 'que c’était mieux avant, et il a les cassettes pour le prouver.',
    mods: { breathBonus: 1.14, refundBonus: 0.9 },
    cri: { label: 'C’ÉTAIT MIEUX AVANT', gest: 'bascule', power: 44 } },

  { id: 'HC45', nom: 'La Cassette VHS', type: 'pyro', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'La cassette de la finale de 1998, rembobinée tellement de fois que la bande '
      + 'grince. L’étiquette est rayée, mais tout le monde sait ce qu’il y a dessus.',
    mods: { perfectBonus: 1.14, holdBonus: 0.9 },
    cri: { label: 'ON REMBOBINE', gest: 'rouleaux', power: 44 } },

  { id: 'HC46', nom: 'Le Frère Qui Spoile', type: 'voix', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il a vu le résultat sur son téléphone et il le dit à tout le monde avant la '
      + 'rediffusion. Il fait semblant que ça lui a échappé.',
    mods: { tempoWindow: 1.14, perfectBonus: 0.9 },
    cri: { label: 'J’AI RIEN DIT', gest: 'justesse', power: 44 } },

  { id: 'HC47', nom: 'Le Voisin du Dessous', type: 'perc', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il tape au plafond avec son balai à chaque but, en peignoir et en filet à '
      + 'cheveux. Personne ne sait pour quelle équipe il est.',
    mods: { mashBonus: 1.16, refundBonus: 0.9 },
    cri: { label: 'UN PEU DE CALME !', gest: 'mash', power: 45 } },

  { id: 'HC48', nom: 'La Doubleuse de Jeux Vidéo', type: 'voix', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle prête sa voix aux commentateurs des jeux de foot, et elle crie le but en '
      + 'cinq langues. Elle a mal à la gorge tous les vendredis.',
    mods: { tempoWindow: 1.16, parryResist: 0.9 },
    cri: { label: 'GOAL, BUT, TOR !', gest: 'tempo', power: 45 } },

  { id: 'HC49', nom: 'Le Ventilateur', type: 'tifo', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Le ventilateur du match d’été. Il tourne la tête vers tout le monde sauf vers '
      + 'soi, et le petit ruban rose sur sa grille vole dans tous les sens.',
    mods: { parryBonus: 1.14, breathBonus: 0.9 },
    cri: { label: 'À GAUCHE, À DROITE', gest: 'puzzle', power: 44 } },

  { id: 'HC50', nom: 'Le Retraité au Jardin', type: 'fide', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Il écoute le match en arrosant ses tomates, la radio posée sur la brouette. Il '
      + 'arrose deux fois le même pied quand on marque.',
    mods: { holdBonus: 1.16, mashBonus: 0.9 },
    cri: { label: 'ÇA POUSSE', gest: 'hold', power: 45 } },

  { id: 'HC51', nom: 'La Tante au Téléphone', type: 'perc', set: 'HC', stage: 1, rar: 'commune',
    histoire: 'Elle appelle pendant chaque match pour demander le score, et elle raconte '
      + 'toute sa semaine. Elle raccroche juste avant le but.',
    mods: { mashBonus: 1.14, parryResist: 0.9 },
    cri: { label: 'ALORS, ÇA DONNE QUOI ?', gest: 'deuxvoix', power: 44 } },
];
