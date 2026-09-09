/**
 * Le lot de cent vingt-six — six séries, septembre 2026.
 *
 * Il vit dans son propre fichier plutôt qu'à la suite de `dex.js` pour une
 * raison pratique : le catalogue est en base depuis la mise en ligne d'août, et
 * ces deux fichiers ne sont plus que l'**amorçage**. Les garder séparés dit
 * lequel est le lot d'origine et lequel est arrivé après ; mélangés, on ne
 * saurait plus, et on n'oserait plus toucher ni à l'un ni à l'autre.
 *
 * **Le classement suit les dessins, pas une grille décidée d'avance.** Les
 * cent vingt-six rendus se rangeaient d'eux-mêmes en six familles : le public
 * ordinaire, ceux qui font tourner le stade, les bêtes qui ont pris une place,
 * ce qui revient la nuit, les objets qui se sont levés, et les visiteurs venus
 * d'une autre époque. Forcer un septième groupe aurait obligé à couper une de
 * ces familles en deux.
 *
 * **Chaque carte a un bonus et, souvent, un malus.** Une carte qui n'a que des
 * bonus ne se choisit pas, elle s'accumule : à trois Fanzzy en tribune, le
 * joueur prendrait simplement les trois plus forts. Un défaut assumé — un
 * souffle qui brûle, un contre qui expose, un tempo large mais lent — rend le
 * deck discutable, et un deck discutable est un deck qu'on construit.
 *
 * Vocabulaire des modificateurs (voir `inventaire.js`, qui les combine) :
 *   tempoWindow, tempoInterval — la fenêtre du chant et sa cadence
 *   mashBonus, mashTime        — le martelage
 *   holdBonus, holdForgive     — la tenue, et le droit de lâcher
 *   parryBonus, parryResist    — le contre, subi et rendu
 *   perfectBonus, backfire     — le geste parfait, et ce qu'il coûte s'il rate
 *   breathBonus, refundBonus, costPenalty — le souffle, la reprise, le prix
 */

/** Les six séries. Une couleur chaude par famille, un fond qui la porte. */
export const SETS_2026 = [
  { id: 'TR', nom: 'LA TRIBUNE', ligne: 'ceux qui reviennent chaque samedi',
    c1: '#E0402C', c2: '#1A1F27' },
  { id: 'MS', nom: 'LES MÉTIERS DU STADE', ligne: 'ceux qui font tourner la baraque',
    c1: '#E08A2C', c2: '#1E1710' },
  { id: 'BG', nom: 'LE BESTIAIRE DES GRADINS', ligne: 'ils ont pris une place, personne n’a rien dit',
    c1: '#1E9E6A', c2: '#101C17' },
  { id: 'RV', nom: 'LES REVENANTS', ligne: 'le virage d’après minuit',
    c1: '#8257DA', c2: '#12101C' },
  { id: 'OB', nom: 'CE QUI TRAÎNE AU STADE', ligne: 'un siège, un cône, une main en mousse',
    c1: '#3C82E8', c2: '#101722' },
  { id: 'EP', nom: 'LES ÉPOQUES', ligne: 'ils ont trouvé une porte, on ne sait pas laquelle',
    c1: '#C2CAD6', c2: '#1A1A22' },
];

export const DEX_2026 = [

  /* ==================================================== LA TRIBUNE (27)

     Le public ordinaire. C'est la série la plus nombreuse et la plus
     commune : c'est elle qu'on tire en ouvrant un booster, et c'est bien —
     le jeu parle de gens qui viennent au stade, pas de créatures.        */

  { id: 'TR1', nom: 'Le Petit Teigneux', type: 'voix', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Onze ans, une parka trop grande, et l’air de quelqu’un qu’on a déjà '
      + 'déçu. Il connaît les chants avant les paroles.',
    mods: { tempoWindow: 1.1 },
    cri: { label: 'C’EST PAS FINI', gest: 'tempo', power: 48 } },

  { id: 'TR2', nom: 'Le Collectionneur', type: 'fide', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il a l’album complet de 2019 et il le sort à la moindre occasion. '
      + 'Il regarde plus ses cartes que le match, mais il est toujours là.',
    mods: { holdBonus: 1.06, refundBonus: 1.15 },
    cri: { label: 'JE L’AI EN DOUBLE', gest: 'hold', power: 46 } },

  { id: 'TR3', nom: 'Le Porteur de Banderole', type: 'tifo', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Sa banderole est vide. Il attend le bon soir pour écrire dessus, et '
      + 'ça fait trois saisons que le bon soir n’est pas venu.',
    mods: { parryBonus: 1.25, tempoWindow: 0.94 },
    cri: { label: 'CE SOIR PEUT-ÊTRE', gest: 'hold', power: 56 } },

  { id: 'TR4', nom: 'Le Casque sur les Oreilles', type: 'voix', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il filme tout et n’entend rien. Quand il enlève le casque, il chante '
      + 'plus fort que les six rangées devant lui.',
    mods: { tempoWindow: 1.18, tempoInterval: 30 },
    cri: { label: 'ATTENDS JE COUPE', gest: 'tempo', power: 50 } },

  { id: 'TR5', nom: 'La Cagoule Timide', type: 'fide', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il a la tenue du type qu’on évite et la peluche de sa fille sous le '
      + 'bras. Personne n’a jamais osé lui demander pourquoi.',
    mods: { holdBonus: 1.12, parryResist: 1.15, tempoWindow: 0.9 },
    cri: { label: 'JE DIS RIEN', gest: 'hold', power: 58 } },

  { id: 'TR6', nom: 'Celui Qui Ne Regarde Pas', type: 'fide', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il met son écharpe sur les yeux dans les dix dernières minutes. Il '
      + 'connaît le score au bruit, et il ne s’est jamais trompé.',
    mods: { holdBonus: 1.16, holdForgive: 1, tempoWindow: 0.85 },
    cri: { label: 'DIS-MOI QUAND C’EST FINI', gest: 'hold', power: 59 } },

  { id: 'TR7', nom: 'Les Doigts Croisés', type: 'fide', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Elle croise les doigts sur chaque coup franc depuis 1974. Le jour où '
      + 'elle a oublié, on a perdu 4-0, et elle n’oubliera plus.',
    mods: { holdBonus: 1.14, perfectBonus: 1.1 },
    cri: { label: 'PITIÉ, UNE SEULE', gest: 'hold', power: 57 } },

  { id: 'TR8', nom: 'Le Porteur d’Épaules', type: 'depl', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Le petit dort sur ses épaules depuis la mi-temps. Il ne bougera pas, '
      + 'même sur le but, et ça lui coûte plus que tout le monde croit.',
    mods: { breathBonus: 1.2, holdBonus: 1.08, mashBonus: 0.88 },
    cri: { label: 'CHUT, IL DORT', gest: 'hold', power: 60 } },

  { id: 'TR9', nom: 'L’Écharpe Levée', type: 'tifo', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Première rangée, place réservée, écharpe tendue à bout de bras pendant '
      + 'quatre-vingt-dix minutes. C’est elle qu’on regarde quand on ne sait plus chanter.',
    mods: { parryBonus: 1.5, holdBonus: 1.1 },
    cri: { label: 'TOUS ENSEMBLE', gest: 'hold', power: 68 } },

  { id: 'TR10', nom: 'Le Paquet de Chips', type: 'depl', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il a passé le contrôle avec un paquet format familial. C’est sa plus '
      + 'grande victoire de la saison et il en parle encore.',
    mods: { refundBonus: 1.25, breathBonus: 0.96 },
    cri: { label: 'QUELQU’UN EN VEUT ?', gest: 'tempo', power: 45 } },

  { id: 'TR11', nom: 'La Tricoteuse', type: 'fide', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Son écharpe fait quatre mètres et grandit d’une rangée par match. Elle '
      + 'la finira le jour où le club sera champion, dit-elle, sans y croire.',
    mods: { holdBonus: 1.2, holdForgive: 1, breathBonus: 1.06 },
    cri: { label: 'ENCORE UN RANG', gest: 'hold', power: 70 } },

  { id: 'TR12', nom: 'Le Ballon de Cuir', type: 'fide', set: 'TR', stage: 1, rar: 'legendaire',
    histoire: 'Il apporte le ballon de la finale de 68 à chaque match. Il ne le prête '
      + 'à personne et il désigne du bout de sa canne ceux qui ne chantent pas.',
    mods: { holdBonus: 1.26, holdForgive: 2, parryResist: 1.2, mashBonus: 0.9 },
    cri: { label: 'DE MON TEMPS', gest: 'hold', power: 79 } },

  { id: 'TR13', nom: 'Le Bébé Vainqueur', type: 'voix', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Assis sur un ballon plus gros que lui, une coupe dans la main. Il a gagné '
      + 'quelque chose, personne ne sait quoi, et il n’a pas l’intention de le rendre.',
    mods: { tempoWindow: 1.2, perfectBonus: 1.12 },
    cri: { label: 'À MOI', gest: 'tempo', power: 58 } },

  { id: 'TR14', nom: 'La Chaise Pliante', type: 'depl', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Chaise, glacière, sandwich, casquette. Il est installé deux heures avant '
      + 'et il repartira une heure après tout le monde.',
    mods: { breathBonus: 1.15, refundBonus: 1.1, tempoWindow: 0.92 },
    cri: { label: 'J’AI DE LA PLACE', gest: 'hold', power: 49 } },

  { id: 'TR15', nom: 'Le Torse Peint', type: 'perc', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Moins cinq degrés, pas de manteau, deux couleurs sur la peau. Il ne '
      + 'sentira le froid que dans le train du retour.',
    mods: { mashBonus: 1.14, breathBonus: 0.92 },
    cri: { label: 'J’AI PAS FROID', gest: 'mash', power: 60 } },

  { id: 'TR16', nom: 'La Perche à Selfie', type: 'voix', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Elle raconte le match à des gens qui ne le regardent pas. Sa lampe '
      + 'éclaire trois rangées et tout le monde s’en plaint sauf elle.',
    mods: { tempoWindow: 1.12, parryResist: 0.9, refundBonus: 1.2 },
    cri: { label: 'VOUS VOYEZ L’AMBIANCE ?', gest: 'tempo', power: 47 } },

  { id: 'TR17', nom: 'Le Pyjama Hippopotame', type: 'depl', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il a perdu un pari en août. Il porte le pyjama à chaque match depuis, '
      + 'y compris en juin, et il a arrêté d’expliquer.',
    mods: { breathBonus: 1.22, parryResist: 1.1, tempoWindow: 0.88 },
    cri: { label: 'NE DEMANDEZ PAS', gest: 'hold', power: 57 } },

  { id: 'TR18', nom: 'Le Mégaphone', type: 'voix', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il lance les chants et il ne les termine jamais : c’est le virage qui '
      + 'les finit. Sa voix tient une mi-temps, pas deux.',
    mods: { tempoWindow: 1.35, tempoInterval: 60, breathBonus: 0.9 },
    cri: { label: 'TOUS AVEC MOI', gest: 'tempo', power: 71 } },

  { id: 'TR19', nom: 'Le Tambour de Guerre', type: 'perc', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il frappe avec deux maillets et il frappe fort. Les gens autour de lui '
      + 'n’entendent plus rien pendant deux jours et reviennent quand même.',
    mods: { mashBonus: 1.22, mashTime: -600, tempoWindow: 0.9 },
    cri: { label: 'LE SOL TREMBLE', gest: 'mash', power: 72 } },

  { id: 'TR20', nom: 'Le Héros du Dimanche', type: 'tifo', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Cape cousue main, collants trop grands, ballon sous le bras. Il pense '
      + 'sincèrement que sa présence change quelque chose. Elle la change.',
    mods: { parryBonus: 1.2, perfectBonus: 1.08, breathBonus: 0.94 },
    cri: { label: 'ME VOILÀ', gest: 'tempo', power: 50 } },

  { id: 'TR21', nom: 'Le Fumigène', type: 'pyro', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il craque le torche à la minute prévue, jamais avant. Ça coûte cher au '
      + 'club, et il paye sa part depuis trois ans sans se plaindre.',
    mods: { perfectBonus: 1.3, backfire: true, costPenalty: 1.1 },
    cri: { label: 'ROUGE PARTOUT', gest: 'tempo', power: 73 } },

  { id: 'TR22', nom: 'La Manette', type: 'perc', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Il connaît chaque joueur par ses statistiques et aucun par sa voix. Au '
      + 'stade, il a compris en dix minutes que ce n’était pas le même jeu.',
    mods: { mashBonus: 1.1, mashTime: -300, holdBonus: 0.94 },
    cri: { label: 'JE CONNAIS SES STATS', gest: 'mash', power: 48 } },

  { id: 'TR23', nom: 'La Coupe Levée', type: 'voix', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Le trophée vient d’un tournoi de quartier. Il le lève à chaque but comme '
      + 'si c’était la Coupe, et il a raison.',
    mods: { tempoWindow: 1.14 },
    cri: { label: 'ON EST LES MEILLEURS', gest: 'tempo', power: 47 } },

  { id: 'TR24', nom: 'La Poussette', type: 'fide', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Son premier match. Il ne comprend rien, il ne se souviendra de rien, et '
      + 'dans vingt ans il aura l’abonnement.',
    mods: { holdBonus: 1.08, breathBonus: 1.1, mashBonus: 0.88 },
    cri: { label: 'OH', gest: 'hold', power: 44 } },

  { id: 'TR25', nom: 'La Remplaçante', type: 'perc', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Elle a le maillot, les crampons et le brassard d’échauffement. Elle n’est '
      + 'pas entrée du match et elle le fait savoir en croisant les bras.',
    mods: { mashBonus: 1.16, mashTime: -400, parryResist: 0.92 },
    cri: { label: 'FAIS-MOI RENTRER', gest: 'mash', power: 59 } },

  { id: 'TR26', nom: 'La Boue aux Genoux', type: 'depl', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Elle a joué le matin et perdu. Elle est venue l’après-midi sans se '
      + 'changer, pour voir comment les grands font.',
    mods: { breathBonus: 1.16, mashBonus: 1.06, parryResist: 0.94 },
    cri: { label: 'MOI AUSSI JE JOUE', gest: 'mash', power: 58 } },

  { id: 'TR27', nom: 'Le Pyjama à Pompon', type: 'voix', set: 'TR', stage: 1, rar: 'commune',
    histoire: 'Costume de monstre, pompon fait maison, une main en mousse plus grande '
      + 'qu’elle. Elle hurle à contretemps et personne ne la corrige.',
    mods: { tempoWindow: 1.22, tempoInterval: -40 },
    cri: { label: 'ALLEZ ALLEZ ALLEZ', gest: 'tempo', power: 46 } },

  /* ============================================ LES MÉTIERS DU STADE (26)

     Ceux sans qui il n'y aurait pas de match. Ils ont tendance à tenir plutôt
     qu'à hurler : leurs bonus penchent vers l'endurance et la reprise.     */

  { id: 'MS1', nom: 'La Tireuse de Pression', type: 'depl', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Elle sert quatre cents bières à la mi-temps et connaît le prénom de la '
      + 'moitié du virage. Elle voit six minutes de jeu par saison.',
    mods: { refundBonus: 1.35, breathBonus: 1.08 },
    cri: { label: 'SUIVANT', gest: 'hold', power: 56 } },

  { id: 'MS2', nom: 'Le Mime du Parvis', type: 'tifo', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il rejoue les actions litigieuses devant la buvette, sans un mot. On lui '
      + 'donne raison plus souvent qu’à l’arbitre.',
    mods: { parryBonus: 1.45, tempoWindow: 0.8 },
    cri: { label: '…', gest: 'hold', power: 57 } },

  { id: 'MS3', nom: 'Le Marchand de Gobelets', type: 'depl', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il monte et descend les marches tout le match avec une colonne de '
      + 'gobelets. Il fait plus de kilomètres que les vingt-deux réunis.',
    mods: { breathBonus: 1.18, refundBonus: 1.12, holdBonus: 0.94 },
    cri: { label: 'GOBELETS ! GOBELETS !', gest: 'tempo', power: 48 } },

  { id: 'MS4', nom: 'La Dame du Vent', type: 'fide', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Elle mesure le vent avant chaque coup franc et note tout dans un carnet. '
      + 'Elle a prédit deux poteaux la saison dernière.',
    mods: { holdBonus: 1.12, perfectBonus: 1.15, mashBonus: 0.9 },
    cri: { label: 'ÇA VA TOURNER', gest: 'hold', power: 58 } },

  { id: 'MS5', nom: 'La Stadière', type: 'tifo', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Elle regarde le virage, pas le terrain, pendant quatre-vingt-dix minutes. '
      + 'Elle sait avant tout le monde quand une tribune va basculer.',
    mods: { parryBonus: 1.4, parryResist: 1.15, tempoWindow: 0.9 },
    cri: { label: 'ON SE CALME', gest: 'hold', power: 60 } },

  { id: 'MS6', nom: 'Le Laveur de Vitres', type: 'depl', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il nettoie les baies de la tribune présidentielle en rappel, et il '
      + 'regarde le match par-dessus son épaule, en balançant.',
    mods: { breathBonus: 1.2, refundBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'D’ICI ON VOIT MIEUX', gest: 'tempo', power: 57 } },

  { id: 'MS7', nom: 'Le Bûcheron de Buvette', type: 'perc', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il a fendu le bois des bancs de touche et il le rappelle à quiconque s’y '
      + 'assoit. Sa hache reste au vestiaire, en principe.',
    mods: { mashBonus: 1.2, mashTime: -300, tempoWindow: 0.88 },
    cri: { label: 'ÇA VA COUPER', gest: 'mash', power: 61 } },

  { id: 'MS8', nom: 'L’Apicultrice', type: 'fide', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Les ruches sont derrière la tribune sud et le miel se vend à la buvette. '
      + 'Elle demande le silence pendant les corners, sans succès.',
    mods: { holdBonus: 1.18, breathBonus: 1.12, tempoWindow: 0.86 },
    cri: { label: 'DOUCEMENT', gest: 'hold', power: 66 } },

  { id: 'MS9', nom: 'Le Ramoneur', type: 'pyro', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il vient toucher la casquette de tous ceux qui le demandent avant le coup '
      + 'd’envoi. La file fait vingt mètres les soirs de derby.',
    mods: { perfectBonus: 1.2, refundBonus: 1.2, breathBonus: 0.92 },
    cri: { label: 'ÇA PORTE CHANCE', gest: 'tempo', power: 60 } },

  { id: 'MS10', nom: 'La Cheffe de la Buvette', type: 'perc', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Sa louche a arrêté deux bagarres. Elle nourrit trois cents personnes en '
      + 'quinze minutes et elle n’a jamais dit merci à personne.',
    mods: { mashBonus: 1.24, parryBonus: 1.2, tempoWindow: 0.9 },
    cri: { label: 'ÇA SUFFIT', gest: 'mash', power: 69 } },

  { id: 'MS11', nom: 'Le Pompier de Garde', type: 'tifo', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il est là pour les fumigènes et il aime les fumigènes. C’est un conflit '
      + 'qu’il gère très bien depuis douze ans.',
    mods: { parryBonus: 1.35, parryResist: 1.25 },
    cri: { label: 'JE SURVEILLE', gest: 'hold', power: 62 } },

  { id: 'MS12', nom: 'Le Vieux Marin', type: 'fide', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il tenait le filet du port avant de tenir celui des buts. Il salue le '
      + 'terrain avant chaque match, comme on salue un quai.',
    mods: { holdBonus: 1.16, holdForgive: 1, breathBonus: 1.05 },
    cri: { label: 'TENEZ BON', gest: 'hold', power: 61 } },

  { id: 'MS13', nom: 'L’Infirmière du Stade', type: 'fide', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Elle a recousu plus de supporters que de joueurs. Elle garde toujours une '
      + 'place libre à l’infirmerie pour la fin du match.',
    mods: { holdBonus: 1.15, breathBonus: 1.2, refundBonus: 1.2 },
    cri: { label: 'RESPIRE', gest: 'hold', power: 67 } },

  { id: 'MS14', nom: 'Le Boulanger d’En Face', type: 'depl', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il ouvre à quatre heures et vient à quinze. Il apporte les invendus au '
      + 'virage et repart avant les prolongations pour dormir.',
    mods: { breathBonus: 1.16, refundBonus: 1.2, holdBonus: 0.95 },
    cri: { label: 'ENCORE CHAUD', gest: 'tempo', power: 50 } },

  { id: 'MS15', nom: 'La Fanfare à Elle Seule', type: 'perc', set: 'MS', stage: 1, rar: 'legendaire',
    histoire: 'Elle tient le tempo de la fanfare depuis dix-neuf ans. Quand elle s’arrête, '
      + 'le virage s’arrête, et elle ne s’arrête jamais avant la fin.',
    mods: { mashBonus: 1.34, mashTime: -900, breathBonus: 1.1 },
    cri: { label: 'UN — DEUX — VIRAGE', gest: 'mash', power: 82 } },

  { id: 'MS16', nom: 'L’Homme au Carton', type: 'tifo', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il sort le jaune avant même que la faute soit commise. On dit qu’il en a '
      + 'un dans chaque poche, pour ne jamais chercher.',
    mods: { parryBonus: 1.55, parryResist: 1.1, tempoWindow: 0.85 },
    cri: { label: 'AVERTISSEMENT', gest: 'hold', power: 70 } },

  { id: 'MS17', nom: 'Le Facteur', type: 'depl', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il distribue le courrier du quartier le matin et les programmes le soir. '
      + 'Il connaît l’adresse de tout le virage.',
    mods: { breathBonus: 1.14, refundBonus: 1.15 },
    cri: { label: 'RECOMMANDÉ', gest: 'tempo', power: 48 } },

  { id: 'MS18', nom: 'La Marchande de Bretzels', type: 'depl', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Elle vend à la criée dans les travées et elle crie plus fort que le '
      + 'speaker. Ses bretzels sont mauvais, tout le monde en achète.',
    mods: { breathBonus: 1.15, refundBonus: 1.3, holdBonus: 0.94 },
    cri: { label: 'BRETZELS ! CHAUDS !', gest: 'tempo', power: 56 } },

  { id: 'MS19', nom: 'Le Juge de Touche', type: 'tifo', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il court la ligne depuis vingt ans sans avoir jamais eu raison, selon la '
      + 'tribune. Il lève son drapeau quand même.',
    mods: { parryBonus: 1.4, breathBonus: 1.1, tempoWindow: 0.88 },
    cri: { label: 'HORS-JEU', gest: 'hold', power: 60 } },

  { id: 'MS20', nom: 'Le Vendeur à la Sauvette', type: 'depl', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Vingt maillets de vingt clubs sous un manteau. Il vend celui du club '
      + 'adverse aux nôtres et l’inverse, avec le même sourire.',
    mods: { refundBonus: 1.55, breathBonus: 1.1, parryResist: 0.9 },
    cri: { label: 'TOUTES LES TAILLES', gest: 'tempo', power: 66 } },

  { id: 'MS21', nom: 'Le Costume Cravate', type: 'tifo', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il porte les crampons du prochain transfert dans un sac de sport. Il '
      + 'sourit à tout le monde et personne ne lui fait confiance.',
    mods: { parryBonus: 1.5, refundBonus: 1.25, holdBonus: 0.88 },
    cri: { label: 'C’EST DÉJÀ SIGNÉ', gest: 'tempo', power: 68 } },

  { id: 'MS22', nom: 'La Trompette du Dimanche', type: 'voix', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il joue deux notes, toujours les mêmes, toujours au mauvais moment. Le '
      + 'virage a fini par construire un chant autour de ses deux notes.',
    mods: { tempoWindow: 1.28, tempoInterval: 50, mashBonus: 0.92 },
    cri: { label: 'TA — TAAA', gest: 'tempo', power: 59 } },

  { id: 'MS23', nom: 'La Voyante du Parvis', type: 'pyro', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Elle annonce le score exact avant chaque match. Elle s’est trompée '
      + 'quatre-vingt-onze fois sur quatre-vingt-douze, et la tribune y croit encore.',
    mods: { perfectBonus: 1.35, backfire: true, tempoWindow: 1.1 },
    cri: { label: 'JE L’AVAIS VU', gest: 'tempo', power: 71 } },

  { id: 'MS24', nom: 'Le Sifflet', type: 'tifo', set: 'MS', stage: 1, rar: 'legendaire',
    histoire: 'Quarante ans d’arbitrage en district et deux mille insultes par saison. '
      + 'Il siffle la fin quand il l’a décidé, pas quand la montre le dit.',
    mods: { parryBonus: 1.8, parryResist: 1.3, tempoWindow: 0.8 },
    cri: { label: 'C’EST MOI QUI SIFFLE', gest: 'hold', power: 80 } },

  { id: 'MS25', nom: 'Le Roi de la Grillade', type: 'pyro', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Sa fumée monte jusqu’à la tribune d’honneur et on s’en plaint chaque '
      + 'année. Elle sent tellement bon que rien ne change.',
    mods: { perfectBonus: 1.18, breathBonus: 1.12, costPenalty: 1.08 },
    cri: { label: 'DEUX MINUTES CHAQUE FACE', gest: 'mash', power: 58 } },

  { id: 'MS26', nom: 'Le Recruteur', type: 'fide', set: 'MS', stage: 1, rar: 'commune',
    histoire: 'Il regarde les remplaçants, jamais le ballon. Il a trouvé trois '
      + 'internationaux et il ne le dira jamais à personne.',
    mods: { holdBonus: 1.14, perfectBonus: 1.12, tempoWindow: 0.9 },
    cri: { label: 'CELUI-LÀ, LÀ-BAS', gest: 'hold', power: 59 } },

  /* ======================================= LE BESTIAIRE DES GRADINS (23)

     Les bêtes du stade. Elles penchent vers le déplacement et le martelage :
     ce sont elles qui bougent, grimpent et volent pendant que le public
     tient sa place.                                                       */

  { id: 'BG1', nom: 'Le Hibou Statisticien', type: 'fide', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il tient les feuilles de match depuis 1961, perché sur la même poutre. Il '
      + 'lève un doigt quand quelqu’un cite un chiffre faux.',
    mods: { holdBonus: 1.14, perfectBonus: 1.16, mashBonus: 0.88 },
    cri: { label: 'DEUXIÈME BUT EN QUATRE ANS', gest: 'hold', power: 60 } },

  { id: 'BG2', nom: 'Le Pigeon à la Frite', type: 'depl', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il a pris la frite à un enfant en pleine action de but. Personne n’a vu '
      + 'le but, tout le monde a vu la frite.',
    mods: { refundBonus: 1.3, breathBonus: 1.06, holdBonus: 0.9 },
    cri: { label: 'ELLE EST À MOI', gest: 'tempo', power: 45 } },

  { id: 'BG3', nom: 'Le Morse de la Tribune Nord', type: 'fide', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il occupe trois sièges et ne s’est jamais levé, pas même sur le but du '
      + 'titre. On lui apporte à boire.',
    mods: { holdBonus: 1.28, holdForgive: 2, breathBonus: 1.1, mashBonus: 0.78 },
    cri: { label: 'JE NE ME LÈVE PAS', gest: 'hold', power: 68 } },

  { id: 'BG4', nom: 'Le Coq de la Pelouse', type: 'voix', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il chante à l’aube et il chante à la 90e. Entre les deux, il dort sur le '
      + 'poteau de corner et le juge de touche fait avec.',
    mods: { tempoWindow: 1.24, tempoInterval: -30 },
    cri: { label: 'DEBOUT LÀ-DEDANS', gest: 'tempo', power: 59 } },

  { id: 'BG5', nom: 'Le Crabe de Touche', type: 'perc', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il se déplace uniquement de côté, ce qui en fait un excellent juge de '
      + 'ligne et un très mauvais attaquant.',
    mods: { mashBonus: 1.12, parryBonus: 1.15, breathBonus: 0.94 },
    cri: { label: 'DE CÔTÉ', gest: 'mash', power: 48 } },

  { id: 'BG6', nom: 'L’Élan des Travées', type: 'depl', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Ses bois bloquent la vue de quatre rangées. Il s’excuse à chaque match et '
      + 'revient au même endroit la semaine suivante.',
    mods: { breathBonus: 1.24, holdBonus: 1.08, parryResist: 0.9 },
    cri: { label: 'PARDON, PARDON', gest: 'hold', power: 58 } },

  { id: 'BG7', nom: 'Le Hérisson Emmitouflé', type: 'fide', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il porte une écharpe six fois trop longue et il en est très fier. Ses '
      + 'piquants ont crevé onze ballons de la buvette.',
    mods: { holdBonus: 1.1, parryResist: 1.2 },
    cri: { label: 'NE ME SERREZ PAS', gest: 'hold', power: 47 } },

  { id: 'BG8', nom: 'Le Lama Blasé', type: 'tifo', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il crache sur les supporters adverses et parfois sur les nôtres. On a '
      + 'renoncé à l’expliquer aux stadiers.',
    mods: { parryBonus: 1.4, tempoWindow: 0.86, breathBonus: 1.05 },
    cri: { label: 'TIENS, PRENDS ÇA', gest: 'hold', power: 58 } },

  { id: 'BG9', nom: 'Le Raton du Vestiaire', type: 'depl', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il fouille les poubelles du parvis et connaît le contenu de tous les sacs. '
      + 'Il a rendu deux portefeuilles, il en a gardé neuf.',
    mods: { refundBonus: 1.45, breathBonus: 1.08, holdBonus: 0.9 },
    cri: { label: 'IL RESTAIT ÇA', gest: 'tempo', power: 57 } },

  { id: 'BG10', nom: 'Le Teckel Interminable', type: 'perc', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il fait la longueur d’une rangée entière et sert de barrière quand il '
      + 's’endort. Sa laisse est plus courte que lui.',
    mods: { mashBonus: 1.12, holdBonus: 1.06, breathBonus: 0.94 },
    cri: { label: 'JE PRENDS DEUX PLACES', gest: 'mash', power: 47 } },

  { id: 'BG11', nom: 'Le Manchot en Nœud Papillon', type: 'fide', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il vient en tenue de soirée à chaque match, même en préparation. Il '
      + 'considère qu’un stade est un lieu où l’on se tient.',
    mods: { holdBonus: 1.16, parryResist: 1.12, mashBonus: 0.92 },
    cri: { label: 'UN PEU DE TENUE', gest: 'hold', power: 58 } },

  { id: 'BG12', nom: 'La Tortue de la Rampe', type: 'fide', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Elle met vingt minutes à monter à sa place et ne repart jamais avant que '
      + 'le stade soit vide. Elle a vu quatre-vingts saisons.',
    mods: { holdBonus: 1.3, holdForgive: 2, breathBonus: 1.06, mashBonus: 0.8 },
    cri: { label: 'J’ARRIVE', gest: 'hold', power: 69 } },

  { id: 'BG13', nom: 'La Fourmi Porteuse', type: 'perc', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Elle porte la caisse de la buvette, seule, à travers tout le stade. Elle '
      + 'refuse toute aide depuis qu’on lui en a proposé une fois.',
    mods: { mashBonus: 1.22, breathBonus: 1.12, tempoWindow: 0.88 },
    cri: { label: 'JE GÈRE', gest: 'mash', power: 61 } },

  { id: 'BG14', nom: 'La Méduse Fluo', type: 'tifo', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Elle éclaire le virage quand les projecteurs tombent en panne, ce qui est '
      + 'arrivé deux fois. Les deux fois, on a gagné.',
    mods: { parryBonus: 1.45, breathBonus: 1.1, mashBonus: 0.85 },
    cri: { label: 'ÇA BRILLE', gest: 'hold', power: 67 } },

  { id: 'BG15', nom: 'Le Chat du Terrain', type: 'depl', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il a interrompu trois matchs en traversant la pelouse au ralenti. Le '
      + 'stade s’est levé les trois fois.',
    mods: { breathBonus: 1.25, refundBonus: 1.2, parryResist: 0.88 },
    cri: { label: 'C’EST MON TERRAIN', gest: 'tempo', power: 68 } },

  { id: 'BG16', nom: 'Le Pigeon à Casquette', type: 'voix', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Chef de la colonie du toit nord. Il distribue les places aux jeunes '
      + 'pigeons et garde la meilleure pour lui.',
    mods: { tempoWindow: 1.14, refundBonus: 1.12 },
    cri: { label: 'PLACE AUX ANCIENS', gest: 'tempo', power: 47 } },

  { id: 'BG17', nom: 'Le Paresseux de la Barre', type: 'fide', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il est suspendu à la barrière depuis le début de la saison. Il applaudit '
      + 'les buts environ deux minutes après tout le monde.',
    mods: { holdBonus: 1.24, holdForgive: 2, tempoInterval: 90, mashBonus: 0.75 },
    cri: { label: 'ATTENDEZ… BUT', gest: 'hold', power: 60 } },

  { id: 'BG18', nom: 'La Pieuvre du Virage', type: 'perc', set: 'BG', stage: 1, rar: 'legendaire',
    histoire: 'Huit bras : le tambour, l’écharpe, la bière, le téléphone, la main en '
      + 'mousse, le hot-dog, la calculette et les lunettes. Elle ne lâche rien.',
    mods: { mashBonus: 1.35, mashTime: -800, refundBonus: 1.2, holdBonus: 1.08 },
    cri: { label: 'LES HUIT À LA FOIS', gest: 'mash', power: 83 } },

  { id: 'BG19', nom: 'Le Capybara Serein', type: 'fide', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Rien ne l’atteint : ni le penalty raté, ni la relégation, ni le derby. '
      + 'Trois rangées autour de lui se sentent mieux.',
    mods: { holdBonus: 1.22, breathBonus: 1.2, parryResist: 1.2, mashBonus: 0.85 },
    cri: { label: 'TOUT VA BIEN', gest: 'hold', power: 70 } },

  { id: 'BG20', nom: 'L’Abeille de Chantier', type: 'depl', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Elle règle la circulation du parvis avec un panneau et un casque jaune. '
      + 'Personne ne l’écoute et elle revient chaque semaine.',
    mods: { breathBonus: 1.16, parryBonus: 1.15, holdBonus: 0.94 },
    cri: { label: 'ON AVANCE', gest: 'tempo', power: 49 } },

  { id: 'BG21', nom: 'L’Orang-outan en Costume', type: 'tifo', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Chef de la sécurité de la tribune d’honneur. Il n’a jamais eu à lever la '
      + 'main : il lui suffit de se lever.',
    mods: { parryBonus: 1.6, parryResist: 1.3, tempoWindow: 0.8 },
    cri: { label: 'ON NE PASSE PAS', gest: 'hold', power: 71 } },

  { id: 'BG22', nom: 'Le Caméléon en Smoking', type: 'tifo', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il lit le programme dans la tribune des deux camps et prend les couleurs '
      + 'de celui qui mène. Tout le monde le sait, personne ne le chasse.',
    mods: { parryBonus: 1.35, parryResist: 1.25, holdBonus: 0.9 },
    cri: { label: 'J’AI TOUJOURS ÉTÉ AVEC VOUS', gest: 'hold', power: 59 } },

  { id: 'BG23', nom: 'Le Loup du Parcage', type: 'perc', set: 'BG', stage: 1, rar: 'commune',
    histoire: 'Il vient avec le parcage adverse, un ballon sous le bras et une main en '
      + 'mousse. Il chante en face et il chante juste.',
    mods: { mashBonus: 1.18, tempoWindow: 1.08, breathBonus: 0.94 },
    cri: { label: 'ON EST VENUS QUAND MÊME', gest: 'mash', power: 60 } },

  /* ================================================ LES REVENANTS (21)

     Ce qui revient la nuit. C'est la série la plus rare et la plus
     déséquilibrée : de gros bonus, de vrais défauts. Elle se tire moins
     souvent et elle se joue autrement.                                    */

  { id: 'RV1', nom: 'La Chose du Bocal', type: 'pyro', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Trouvée dans la réserve de la buvette en 1998, jamais identifiée. Elle '
      + 'tape sur le verre quand on marque.',
    mods: { perfectBonus: 1.3, backfire: true, parryResist: 1.2 },
    cri: { label: 'TOC — TOC — TOC', gest: 'mash', power: 70 } },

  { id: 'RV2', nom: 'Le Phénix du Virage', type: 'pyro', set: 'RV', stage: 1, rar: 'legendaire',
    histoire: 'Il brûle à chaque relégation et il revient à chaque montée. Il en est à '
      + 'son quatrième cycle et il ne semble pas fatigué.',
    mods: { perfectBonus: 1.5, refundBonus: 1.6, backfire: true, costPenalty: 1.15 },
    cri: { label: 'ON RENAÎT TOUJOURS', gest: 'tempo', power: 84 } },

  { id: 'RV3', nom: 'Le Lutin des Vestiaires', type: 'depl', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Il cache une chaussure sur deux avant chaque match. Les joueurs s’y sont '
      + 'faits, ils arrivent avec trois paires.',
    mods: { refundBonus: 1.4, parryBonus: 1.2, holdBonus: 0.88 },
    cri: { label: 'CHERCHE ENCORE', gest: 'tempo', power: 58 } },

  { id: 'RV4', nom: 'La Vapeur de la Théière', type: 'fide', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Elle sort de la théière de la buvette entre la 60e et la 75e, réchauffe '
      + 'la tribune, et rentre. On ne lui a jamais parlé.',
    mods: { holdBonus: 1.2, breathBonus: 1.25, mashBonus: 0.82 },
    cri: { label: 'RESTE AU CHAUD', gest: 'hold', power: 68 } },

  { id: 'RV5', nom: 'Le Loup-Garou du Samedi', type: 'perc', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Employé de bureau du lundi au vendredi. Le samedi à 19 h, il perd son '
      + 'costume, sa voix et ses bonnes manières.',
    mods: { mashBonus: 1.3, mashTime: -700, holdBonus: 0.85 },
    cri: { label: 'C’EST L’HEURE', gest: 'mash', power: 72 } },

  { id: 'RV6', nom: 'Le Recousu', type: 'fide', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'On l’a fabriqué avec les morceaux de onze supporters du siècle dernier. '
      + 'Il connaît onze chants différents et les mélange tous.',
    mods: { holdBonus: 1.26, holdForgive: 2, tempoWindow: 0.85 },
    cri: { label: 'JE ME SOUVIENS DE TOUT', gest: 'hold', power: 70 } },

  { id: 'RV7', nom: 'L’Abonné d’Outre-Tombe', type: 'fide', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Son abonnement court jusqu’en 2041 et il compte l’honorer. Il perd un '
      + 'doigt par saison et ça ne le ralentit pas.',
    mods: { holdBonus: 1.2, holdForgive: 3, breathBonus: 0.88 },
    cri: { label: 'J’AI PAYÉ', gest: 'hold', power: 59 } },

  { id: 'RV8', nom: 'Le Troll du Pont', type: 'perc', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Il tient le pont qui mène au stade et demande un chant à qui veut passer. '
      + 'Beaucoup préfèrent le tunnel.',
    mods: { mashBonus: 1.2, parryBonus: 1.25, tempoWindow: 0.85 },
    cri: { label: 'CHANTE OU FAIS DEMI-TOUR', gest: 'mash', power: 61 } },

  { id: 'RV9', nom: 'La Sirène du Seau', type: 'voix', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Elle vit dans le seau de l’intendant depuis la crue de 2003. Elle chante '
      + 'juste et personne d’autre dans ce virage ne peut en dire autant.',
    mods: { tempoWindow: 1.4, tempoInterval: -60, breathBonus: 0.9 },
    cri: { label: 'LA VRAIE MÉLODIE', gest: 'tempo', power: 71 } },

  { id: 'RV10', nom: 'Le Minotaure des Coursives', type: 'tifo', set: 'RV', stage: 1, rar: 'legendaire',
    histoire: 'Il connaît chaque couloir du stade et il s’y est pourtant perdu deux fois. '
      + 'Il tient l’entrée du virage les soirs de derby.',
    mods: { parryBonus: 1.75, parryResist: 1.35, breathBonus: 0.9 },
    cri: { label: 'PERSONNE NE MONTE', gest: 'hold', power: 81 } },

  { id: 'RV11', nom: 'La Sorcière du Parking', type: 'pyro', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Elle jette un sort sur le bus adverse à chaque match. Le bus tombe en '
      + 'panne une fois sur douze, ce qui lui suffit largement.',
    mods: { perfectBonus: 1.35, parryBonus: 1.2, backfire: true },
    cri: { label: 'QUE ÇA CALE', gest: 'tempo', power: 71 } },

  { id: 'RV12', nom: 'Le Golem du Muret', type: 'fide', set: 'RV', stage: 1, rar: 'legendaire',
    histoire: 'Il est fait des pierres de l’ancienne tribune, démolie en 1987. Il n’a '
      + 'jamais accepté la démolition et il ne bougera plus.',
    mods: { holdBonus: 1.35, holdForgive: 3, parryResist: 1.4, mashBonus: 0.72 },
    cri: { label: 'JE SUIS D’ICI', gest: 'hold', power: 82 } },

  { id: 'RV13', nom: 'Le Cyclope du Grand Écran', type: 'voix', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Un œil, mais il voit tout, et surtout les hors-jeu. Il conteste chaque '
      + 'ralenti à voix haute et il a souvent raison.',
    mods: { tempoWindow: 1.2, perfectBonus: 1.15, parryResist: 0.9 },
    cri: { label: 'JE L’AI VU', gest: 'tempo', power: 58 } },

  { id: 'RV14', nom: 'Le Petit Fantôme', type: 'depl', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Il traverse les tourniquets sans billet depuis quarante ans. Le club le '
      + 'sait et a renoncé à facturer.',
    mods: { refundBonus: 1.4, breathBonus: 1.1, holdBonus: 0.9 },
    cri: { label: 'JE PASSE À TRAVERS', gest: 'tempo', power: 50 } },

  { id: 'RV15', nom: 'Le Bébé Dragon', type: 'pyro', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Il souffle des étincelles quand il s’excite, c’est-à-dire tout le temps. '
      + 'La bâche du virage a brûlé deux fois cette saison.',
    mods: { perfectBonus: 1.28, costPenalty: 1.12, backfire: true },
    cri: { label: 'PARDON PARDON', gest: 'mash', power: 69 } },

  { id: 'RV16', nom: 'La Momie du Musée', type: 'fide', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Elle a quitté la vitrine du musée du club pour venir voir un match. Elle '
      + 'perd une bande par déplacement et elle continue.',
    mods: { holdBonus: 1.22, holdForgive: 2, breathBonus: 0.9 },
    cri: { label: 'ÇA FAIT LONGTEMPS', gest: 'hold', power: 59 } },

  { id: 'RV17', nom: 'Le Yéti à la Trompette', type: 'voix', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Descendu de la montagne pour un huitième de finale en janvier. Il a joué '
      + 'trois notes et le virage entier a repris.',
    mods: { tempoWindow: 1.32, breathBonus: 1.15, mashBonus: 0.88 },
    cri: { label: 'ÇA S’ENTEND DE LOIN', gest: 'tempo', power: 72 } },

  { id: 'RV18', nom: 'La Faucheuse au Pop-corn', type: 'tifo', set: 'RV', stage: 1, rar: 'legendaire',
    histoire: 'Elle vient pour les fins de match serrées et elle ne prend jamais '
      + 'personne. Elle dit qu’elle vient juste regarder. On préfère la croire.',
    mods: { parryBonus: 1.9, parryResist: 1.5, refundBonus: 1.3, breathBonus: 0.85 },
    cri: { label: 'JE REGARDE, C’EST TOUT', gest: 'hold', power: 88 } },

  { id: 'RV19', nom: 'Le Vampire du Nocturne', type: 'depl', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Il n’a jamais vu un match à quinze heures et n’en éprouve aucun regret. '
      + 'Les jeudis européens sont sa saison entière.',
    mods: { breathBonus: 1.3, refundBonus: 1.3, perfectBonus: 0.9 },
    cri: { label: 'ENFIN LA NUIT', gest: 'tempo', power: 70 } },

  { id: 'RV20', nom: 'Le Fantôme du Bloc C', type: 'fide', set: 'RV', stage: 1, rar: 'legendaire',
    histoire: 'Il tient encore son billet de la finale de 1974, celle qu’il n’a pas pu '
      + 'voir. Il occupe sa place à chaque match depuis, et il chante.',
    mods: { holdBonus: 1.4, holdForgive: 3, breathBonus: 1.2, tempoWindow: 0.82 },
    cri: { label: 'J’AI TOUJOURS MON BILLET', gest: 'hold', power: 87 } },

  { id: 'RV21', nom: 'La Plante du Parvis', type: 'perc', set: 'RV', stage: 1, rar: 'commune',
    histoire: 'Plantée devant la buvette en 2016, elle a mangé deux ballons et un '
      + 'parapluie. Elle porte l’écharpe du club depuis qu’on la nourrit.',
    mods: { mashBonus: 1.2, parryBonus: 1.2, breathBonus: 0.9 },
    cri: { label: 'ENCORE UN', gest: 'mash', power: 59 } },

  /* ========================================= CE QUI TRAÎNE AU STADE (12)

     Les objets qui se sont levés. La série la plus courte, et volontairement :
     un stade contient beaucoup de choses, mais peu qui méritent une carte. */

  { id: 'OB1', nom: 'La Main en Mousse', type: 'tifo', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Elle désigne le coupable à chaque décision arbitrale. Elle a un doigt et '
      + 'elle s’en sert beaucoup.',
    mods: { parryBonus: 1.3, tempoWindow: 0.92 },
    cri: { label: 'NUMÉRO UN', gest: 'hold', power: 49 } },

  { id: 'OB2', nom: 'Le Siège 14B', type: 'fide', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Personne ne s’est assis dessus depuis huit ans à cause du ressort. Il a '
      + 'fini par se lever et par aller voir le match debout.',
    mods: { holdBonus: 1.2, parryResist: 1.2, mashBonus: 0.88 },
    cri: { label: 'MA PLACE EST LIBRE', gest: 'hold', power: 58 } },

  { id: 'OB3', nom: 'Le Pantin Remontable', type: 'perc', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'On le remonte au coup d’envoi et il s’arrête à la 78e, toujours. Le '
      + 'virage a appris à finir les matchs sans lui.',
    mods: { mashBonus: 1.28, mashTime: -600, breathBonus: 0.82 },
    cri: { label: 'TIC — TAC', gest: 'mash', power: 60 } },

  { id: 'OB4', nom: 'Le Danseur Gonflable', type: 'voix', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Récupéré chez le concessionnaire d’en face. Il ne tient aucun rythme et il '
      + 'ne s’arrête jamais, ce qui finit par faire un rythme.',
    mods: { tempoWindow: 1.3, tempoInterval: 70 },
    cri: { label: 'WOOOOOOO', gest: 'tempo', power: 48 } },

  { id: 'OB5', nom: 'Le Cône du Parking', type: 'depl', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Il gardait la place du président. Il a estimé qu’il serait plus utile dans '
      + 'le virage et personne ne l’a contredit.',
    mods: { breathBonus: 1.14, parryBonus: 1.2, holdBonus: 0.94 },
    cri: { label: 'PLACE RÉSERVÉE', gest: 'tempo', power: 47 } },

  { id: 'OB6', nom: 'Le Distributeur', type: 'depl', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Il rend la monnaie une fois sur trois et garde le reste depuis 2011. Il '
      + 'porte une écharpe achetée avec ce qu’il a volé.',
    mods: { refundBonus: 1.6, breathBonus: 1.08, holdBonus: 0.9 },
    cri: { label: 'PAS DE MONNAIE', gest: 'tempo', power: 66 } },

  { id: 'OB7', nom: 'L’Épouvantail du Terrain d’Entraînement', type: 'tifo', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Il servait de mur pour les coups francs. Il a pris tellement de ballons '
      + 'qu’il a fini par apprendre à les arrêter.',
    mods: { parryBonus: 1.5, parryResist: 1.2, tempoWindow: 0.85 },
    cri: { label: 'LE MUR TIENT', gest: 'hold', power: 60 } },

  { id: 'OB8', nom: 'Le Bonhomme de Neige', type: 'fide', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Construit par les enfants du club en décembre. Il fond un peu à chaque '
      + 'match et il refuse de rentrer avant la fin de la saison.',
    mods: { holdBonus: 1.22, breathBonus: 1.1, costPenalty: 1.1 },
    cri: { label: 'JE TIENS ENCORE', gest: 'hold', power: 59 } },

  { id: 'OB9', nom: 'La Machine à Thé', type: 'fide', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Robot de la salle de presse, réformé en 2004. Elle sert le thé à la '
      + 'tribune de presse à la mi-temps, sans qu’on lui ait rien demandé.',
    mods: { holdBonus: 1.16, breathBonus: 1.22, mashBonus: 0.86 },
    cri: { label: 'AVEC OU SANS SUCRE', gest: 'hold', power: 58 } },

  { id: 'OB10', nom: 'Le Téléviseur du Café', type: 'perc', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Il a diffusé trente ans de matchs dans un café qui a fermé. Il s’est levé, '
      + 'il a mis une écharpe, et il est venu voir en vrai.',
    mods: { mashBonus: 1.24, mashTime: -500, tempoInterval: 30 },
    cri: { label: 'EN DIRECT DU VIRAGE', gest: 'mash', power: 69 } },

  { id: 'OB11', nom: 'Le Nain de Jardin', type: 'tifo', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'Volé dans le jardin du président adverse lors d’un déplacement. Il est '
      + 'devenu mascotte et il refuse de rentrer chez lui.',
    mods: { parryBonus: 1.25, parryResist: 1.15, breathBonus: 0.94 },
    cri: { label: 'JE RESTE ICI', gest: 'hold', power: 50 } },

  { id: 'OB12', nom: 'Le Poulet en Caoutchouc', type: 'voix', set: 'OB', stage: 1, rar: 'commune',
    histoire: 'On le presse quand l’adversaire rate un penalty. Le bruit qu’il fait a '
      + 'donné son nom à un chant du virage.',
    mods: { tempoWindow: 1.26, parryBonus: 1.15, holdBonus: 0.9 },
    cri: { label: 'COUIC', gest: 'tempo', power: 58 } },

  /* ================================================== LES ÉPOQUES (17)

     Des visiteurs. Ils ne comprennent pas tout et compensent par la manière :
     beaucoup de geste parfait, beaucoup de contre, et des défauts assumés. */

  { id: 'EP1', nom: 'L’Homme des Cavernes', type: 'perc', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Premier supporter connu. Il tapait déjà sur des choses pour encourager '
      + 'ceux qui couraient, bien avant qu’il y ait un ballon.',
    mods: { mashBonus: 1.26, mashTime: -600, tempoWindow: 0.8 },
    cri: { label: 'OUGH ! OUGH !', gest: 'mash', power: 61 } },

  { id: 'EP2', nom: 'Le Bouffon', type: 'pyro', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Il chambrait déjà les seigneurs, il chambre maintenant l’arbitre. C’est le '
      + 'seul métier qui n’a pas changé en six cents ans.',
    mods: { perfectBonus: 1.32, parryBonus: 1.2, backfire: true },
    cri: { label: 'ET UN, ET DEUX', gest: 'tempo', power: 70 } },

  { id: 'EP3', nom: 'L’Aviateur', type: 'depl', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Il survolait le stade en 1936 pour donner le score par radio. Il a fini par '
      + 'se poser et par prendre un abonnement.',
    mods: { breathBonus: 1.24, refundBonus: 1.2, mashBonus: 0.9 },
    cri: { label: 'JE VOIS TOUT LE TERRAIN', gest: 'tempo', power: 59 } },

  { id: 'EP4', nom: 'Le Mousquetaire', type: 'tifo', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Elle défend l’honneur du club à la moindre insulte. Elle a été expulsée '
      + 'quatre fois et elle revient toujours par la même porte.',
    mods: { parryBonus: 1.55, perfectBonus: 1.12, holdBonus: 0.9 },
    cri: { label: 'UN POUR TOUS', gest: 'hold', power: 71 } },

  { id: 'EP5', nom: 'Le Samouraï', type: 'fide', set: 'EP', stage: 1, rar: 'legendaire',
    histoire: 'Il a juré fidélité au club, pas à ses résultats. La distinction lui a '
      + 'permis de traverser deux relégations sans broncher.',
    mods: { holdBonus: 1.3, holdForgive: 2, perfectBonus: 1.2, mashBonus: 0.85 },
    cri: { label: 'MA PAROLE TIENT', gest: 'hold', power: 80 } },

  { id: 'EP6', nom: 'Le Légionnaire', type: 'tifo', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Il forme la tortue avec son bouclier quand les gobelets volent. Trois '
      + 'rangées se mettent à l’abri derrière lui.',
    mods: { parryBonus: 1.45, parryResist: 1.3, tempoWindow: 0.85 },
    cri: { label: 'EN FORMATION', gest: 'hold', power: 60 } },

  { id: 'EP7', nom: 'La Viking', type: 'voix', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Elle a inventé le clap lent avant tout le monde, et elle le rappelle à '
      + 'chaque déplacement, très fort.',
    mods: { tempoWindow: 1.34, tempoInterval: -50, holdBonus: 0.92 },
    cri: { label: 'HU ! HU ! HU !', gest: 'tempo', power: 71 } },

  { id: 'EP8', nom: 'Le Crieur Public', type: 'voix', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Il annonçait les compositions sur la place du marché avant qu’il y ait des '
      + 'haut-parleurs. Il n’a jamais accepté les haut-parleurs.',
    mods: { tempoWindow: 1.25, breathBonus: 1.1, mashBonus: 0.9 },
    cri: { label: 'OYEZ, OYEZ', gest: 'tempo', power: 59 } },

  { id: 'EP9', nom: 'Le Savant Fou', type: 'pyro', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Il a calculé la formule du but parfait et l’a perdue. Il refait ses '
      + 'expériences dans les toilettes de la tribune sud.',
    mods: { perfectBonus: 1.4, backfire: true, costPenalty: 1.15 },
    cri: { label: 'ÇA VA MARCHER', gest: 'tempo', power: 72 } },

  { id: 'EP10', nom: 'Le Cowboy', type: 'fide', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Il a fait deux mille kilomètres à cheval pour un match amical. Il est resté '
      + 'et il attache encore sa monture au parking vélos.',
    mods: { holdBonus: 1.18, breathBonus: 1.12, tempoWindow: 0.9 },
    cri: { label: 'J’AI FAIT LA ROUTE', gest: 'hold', power: 59 } },

  { id: 'EP11', nom: 'La Pirate', type: 'depl', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Elle aborde le parcage adverse à chaque déplacement pour échanger des '
      + 'écharpes. Elle rentre toujours avec plus qu’elle n’a donné.',
    mods: { refundBonus: 1.55, parryBonus: 1.25, holdBonus: 0.88 },
    cri: { label: 'À L’ABORDAGE', gest: 'tempo', power: 69 } },

  { id: 'EP12', nom: 'L’Astronaute', type: 'depl', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Elle a suivi la finale depuis l’orbite avec vingt-deux secondes de retard. '
      + 'Elle a hurlé quand même, dans le vide.',
    mods: { breathBonus: 1.3, refundBonus: 1.2, tempoInterval: 60 },
    cri: { label: 'REÇU CINQ SUR CINQ', gest: 'tempo', power: 68 } },

  { id: 'EP13', nom: 'Le Scaphandrier', type: 'fide', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Il a repêché le ballon du canal quatre-vingt-treize fois. Il descend '
      + 'toujours avec la même corde et il n’en changera pas.',
    mods: { holdBonus: 1.2, holdForgive: 1, breathBonus: 1.15, mashBonus: 0.86 },
    cri: { label: 'JE REDESCENDS', gest: 'hold', power: 60 } },

  { id: 'EP14', nom: 'Le Chevalier', type: 'tifo', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Son bouclier porte les couleurs du club depuis quatre cents ans, ce qui '
      + 'pose un problème de date que personne n’a osé soulever.',
    mods: { parryBonus: 1.6, parryResist: 1.25, breathBonus: 0.88 },
    cri: { label: 'POUR LE BLASON', gest: 'hold', power: 71 } },

  { id: 'EP15', nom: 'Le Touriste d’Ailleurs', type: 'depl', set: 'EP', stage: 1, rar: 'legendaire',
    histoire: 'Il a traversé la galaxie pour un match de milieu de tableau. Il a pris un '
      + 'hot-dog et il trouve que ça valait le voyage.',
    mods: { breathBonus: 1.3, refundBonus: 1.6, parryBonus: 1.2 },
    cri: { label: 'ON N’A PAS ÇA CHEZ NOUS', gest: 'tempo', power: 81 } },

  { id: 'EP16', nom: 'Le Flottant', type: 'voix', set: 'EP', stage: 1, rar: 'commune',
    histoire: 'Il jongle en apesanteur pendant les temps morts. Le ballon met onze '
      + 'minutes à retomber et il compte les secondes à voix haute.',
    mods: { tempoWindow: 1.3, tempoInterval: 80, mashBonus: 0.85 },
    cri: { label: 'IL RETOMBE… BIENTÔT', gest: 'tempo', power: 58 } },

  { id: 'EP17', nom: 'Le Gladiateur', type: 'perc', set: 'EP', stage: 1, rar: 'legendaire',
    histoire: 'Il a joué devant cinquante mille personnes bien avant qu’on invente le '
      + 'football. Il trouve que le public d’aujourd’hui manque un peu d’engagement.',
    mods: { mashBonus: 1.4, mashTime: -1000, parryBonus: 1.3, breathBonus: 0.85 },
    cri: { label: 'ENCORE ! ENCORE !', gest: 'mash', power: 88 } },
];
