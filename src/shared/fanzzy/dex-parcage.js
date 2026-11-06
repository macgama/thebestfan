/**
 * LE PARCAGE — le foot français vu de la tribune des visiteurs.
 *
 * ## Ce que la série raconte
 *
 * Les vieux métiers, les fêtes et les gourmandises des villes de France.
 * Chaque Fanzzy porte les couleurs d'un club du championnat de France de la
 * saison 2026-2027, **et rien d'autre de ce club**. Il vit dans un morceau de
 * culture de sa ville — la boule de fort, le canut, la socca, le porteur de
 * géant, le bagad, la galette-saucisse — et son troisième âge garde toujours
 * un détail du premier.
 *
 * Demandée par Gaël le 21 octobre 2026 (nom de travail « Les Kops »),
 * renommée « Le Parcage » le 5 novembre 2026 : PASS 2, avec la tenue
 * Apocalyptique et LES PHÉNOMÈNES MÉTÉO (`saisons-prevues.js`,
 * PROGRAMME_DES_PASS). Trois Fanzzy par club, une femme, un homme et une
 * créature, soit cinquante-quatre lignées pour dix-huit clubs. Fiches et
 * invites des dessins : `/mnt/project-files/fanzzy-prompts/FR-les-kops.md` :
 * FR1 à FR18 les femmes, FR19 à FR36 les hommes, FR37 à FR54 les créatures,
 * toujours dans le même ordre des clubs (`clubs.js`). Branchée le 6 novembre
 * 2026 (« Tu peux brancher la série dans l'application »).
 *
 * ## La prudence juridique, la même que LES TERRACES et DIE KURVE
 *
 * **Le club de référence n'apparaît nulle part dans le jeu.** Ni son nom, ni
 * son surnom, ni son écusson, ni ce que l'écusson dessine (pas de dogue, de
 * lion, d'aigle, de coq, d'hermine, de cigogne, de losanges ni de tour), ni
 * son stade, ni ses chants. Il n'est écrit que dans la ligne « Couleurs » de
 * chaque fiche, pour qui dessine. Les histoires parlent du métier, de la
 * fête et de la ville, jamais du club.
 *
 * ## Elle arrive fermée
 *
 * Aucune saison lancée ne la nomme : aucun booster ni aucun kiosque ne la
 * distribue tant que Gaël ne la coche pas dans une saison (onglet SAISONS de
 * /admin). Ses six légendaires (FR55 à FR60, validées le 5 novembre 2026)
 * sont en bas de la liste.
 *
 * ## Le barème et les familles
 *
 * Celui de DIE KURVE : `commune` → `rare` → `epique`, un cri à ~53 / ~66 /
 * ~79, un bonus franc de la famille et un petit défaut qui se résorbe en
 * grandissant. Les deuxième et troisième âges sont dans `dex-ages.js`.
 *
 * Neuf lignées par famille, dont cinq au moins au geste éponyme : la série
 * ne fait passer aucune famille sous la moitié. Les gestes suivent le
 * métier : l'horlogère, le groom à sa sonnette, l'accordéoniste, le croissant
 * de chaque matin et la galette-saucisse d'avant-match battent la mesure
 * (tempo) ; le gabier répond au chant de la mâture et la cigale fait vibrer
 * la colline (écho) ; le sonneur mène le bagad (capo) ; le korrigan joue ses
 * tours à contretemps. Le phare, l'aviatrice, l'allumeuse, le four à socca et
 * le kougelhopf qui lève relancent (relance) ; la fusée et le calendrier de
 * l'Avent comptent à rebours (compte) ; le pointeur vise (visée) ; la grosse
 * tête lance ses confettis (rouleaux). Les marteaux, les maillets, la pagaie
 * et les tentacules frappent (mash) ; le porteur de géant fait monter la
 * danse (crescendo), la coquille claque de ses deux valves (deux voix), les
 * fleurs et les briques partent par volées (salves). La rosiériste, le
 * docker, le mineur, le boulanger et le conteneur tiennent (hold) ; la course
 * de nuit et l'escargot durent (tenue), la jardinière des cactus retient sa
 * main (retenue), la voiture à vapeur surveille sa pression (jauge). Les
 * écharpes, les cordes et les fils passent de main en main (écharpe) ; la
 * chineuse se souvient de chaque stand et le cheval de mine de chaque
 * galerie (mémoire) ; la ballerine et la chaussette sans sa paire se
 * cherchent dans le miroir ; la boule de fort roule sur sa piste courbe
 * (bascule). Le peintre, le canut, le galettier, la gaufre, le ver à soie et
 * la colonne d'affiches couvrent la tribune (tifo) ; la trieuse trie, la
 * verrière assemble sa mosaïque, la danseuse du cercle entraîne la ronde
 * (ola).
 *
 * Le gris-bleu de l'ardoise et des grilles du parcage : la couleur que dix-huit
 * clubs aux couleurs différentes ont en commun, celle du coin de tribune où
 * l'on reçoit les visiteurs.
 */
export const SET_PARCAGE = {
  id: 'FR',
  nom: 'LE PARCAGE',
  ligne: 'derrière la grille, on chante plus fort que tout le stade',
  desc: 'Les tribunes des dix-huit clubs du championnat de France, trois Fanzzy par club, de la boule de fort au korrigan de la lande. Avec le cri de chaque club.',
  c1: '#5E6B8C',
  c2: '#12141C',
};

/**
 * Les cinquante-quatre premiers âges. Leurs suites sont dans `dex-ages.js`.
 * `set` est posé une fois, en bas, comme dans `dex-kurve.js`.
 */
const PREMIERS_AGES = [

  /* ------------------------------------------------------ les femmes */

  /* FR1 — la rosiériste : noir et blanc, fond magenta. */
  { id: 'FR1', nom: 'La Petite Bouturière', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Dans la serre, elle aligne ses boutures de roses dans de vieux pots de yaourt '
      + 'et les arrose une à une avec son petit arrosoir noir. Elle ne les quitte pas des yeux : '
      + 'une rose, ça s’attend.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'ÇA POUSSE !', gest: 'hold', power: 53 } },

  /* FR2 — l'horlogère de la tour : bleu roi et blanc. */
  { id: 'FR2', nom: 'La Petite Remonteuse', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Sur la table de la cuisine, il y a des rouages partout et un tournevis derrière '
      + 'son oreille. Elle a démonté tous les réveils de la maison, et elle les a tous remontés '
      + 'à l’heure juste.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'TIC, TAC, ON Y VA', gest: 'tempo', power: 53 } },

  /* FR3 — la gardienne de phare : rouge et blanc en bandes. */
  { id: 'FR3', nom: 'La Gamine du Phare', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur les rochers mouillés, à la tombée du jour, elle lève sa petite lanterne '
      + 'rayée vers le large. Le vent lui couche la tresse, et elle compte les éclats du phare '
      + 'jusqu’à ce qu’on l’appelle pour dîner.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'ALLUMEZ LE PHARE', gest: 'relance', power: 53 } },

  /* FR4 — la peintre du port : bleu ciel et marine. */
  { id: 'FR4', nom: 'La Petite Barbouilleuse', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Assise sur une bitte d’amarrage à l’aube, elle barbouille les grues du port sur '
      + 'son carnet, sa petite palette bleu ciel à la main. Elle a de la peinture sur le nez, '
      + 'et elle ne s’en est pas aperçue.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'TOUT EN COULEURS', gest: 'tifo', power: 53 } },

  /* FR5 — la mécanicienne des courses de nuit : rouge vif, jaune, damier. */
  { id: 'FR5', nom: 'La Gamine du Paddock', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Elle a dormi sous la tente à côté du circuit, et elle n’a pas fermé l’œil. Sa '
      + 'petite clé jaune à la main, elle attend le départ de la course qui dure toute la nuit.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'JUSQU’AU MATIN', gest: 'tenue', power: 53 } },

  /* FR6 — la trieuse de charbon : rouge profond et jaune d'or. */
  { id: 'FR6', nom: 'La Petite Trieuse', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Elle grimpe sur la montagne noire avec son petit panier rouge et ramasse les '
      + 'boulets de charbon un par un. Les beaux d’un côté, les autres de l’autre : on ne trie '
      + 'pas à moitié.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'LES BEAUX DEVANT', gest: 'tri', power: 53 } },

  /* FR7 — la reine de la braderie : rouge, marine et blanc. */
  { id: 'FR7', nom: 'La Petite Chineuse', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Elle arrive au vide-grenier avant le jour, une lampe de poche à la main. Elle '
      + 'repart avec une petite cafetière rouge cabossée, et elle se souvient de chaque stand '
      + 'où elle s’est arrêtée.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'J’AI TROUVÉ !', gest: 'memoire', power: 53 } },

  /* FR8 — la danseuse du cercle celtique : orange et noir. */
  { id: 'FR8', nom: 'La Petite Danseuse', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Dans la cuisine, son petit tablier brodé noué par-dessus son jogging, elle répète '
      + 'les pas de la ronde avec un cavalier qui n’est pas là. Les cheveux volent, et la '
      + 'chaise suit le mouvement.',
    mods: { parryBonus: 1.16, refundBonus: 0.92 },
    cri: { label: 'TOUS DANS LA RONDE', gest: 'ola', power: 53 } },

  /* FR9 — l'allumeuse de lumignons : blanc, rouge et bleu. */
  { id: 'FR9', nom: 'La Petite Éclaireuse', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Un soir de décembre, elle pose une bougie dans un petit verre rouge à sa fenêtre, '
      + 'le visage éclairé par en dessous. Dans la rue, une autre fenêtre s’allume, puis une '
      + 'autre.',
    mods: { perfectBonus: 1.18, breathBonus: 0.92 },
    cri: { label: 'UNE FENÊTRE, PUIS MILLE', gest: 'relance', power: 53 } },

  /* FR10 — la savonnière du vieux port : blanc et bleu ciel. */
  { id: 'FR10', nom: 'La Petite Mouleuse', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Sur une marche du port en plein soleil, elle tient un cube de savon blanc d’une '
      + 'main et sa petite pagaie bleu ciel de l’autre. Elle remue, elle tape, et les bulles '
      + 'lui montent jusqu’aux cheveux.',
    mods: { mashBonus: 1.16, holdBonus: 0.92 },
    cri: { label: 'ÇA MOUSSE !', gest: 'mash', power: 53 } },

  /* FR11 — la gardienne du jardin exotique : rouge et blanc, fond magenta. */
  { id: 'FR11', nom: 'La Petite Jardinière', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sur un balcon au-dessus de la mer, elle tient à deux mains un petit pot rouge et '
      + 'son cactus tout rond. Elle a appris qu’avec les épines, on ne se précipite jamais.',
    mods: { holdBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'DOUCEMENT, LES ÉPINES', gest: 'retenue', power: 53 } },

  /* FR12 — la bataille de fleurs : rouge et noir en rayures, fond magenta. */
  { id: 'FR12', nom: 'La Petite Lanceuse de Fleurs', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Sur la promenade au bord de la mer, elle ramasse un œillet rouge tombé d’un char. '
      + 'Elle en a déjà un petit bouquet, et elle n’attend qu’une chose : pouvoir les lancer '
      + 'tous à la fois.',
    mods: { mashBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'LES FLEURS VOLENT', gest: 'salves', power: 53 } },

  /* FR13 — la couvreuse-zingueuse : bleu nuit et bleu ciel. */
  { id: 'FR13', nom: 'La Petite Grimpeuse des Toits', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Assise sur un toit de zinc au coucher du soleil, entre les cheminées, elle a sa '
      + 'petite ceinture à outils et un seul marteau. De là-haut, toute la ville lui appartient.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'ÇA TAPE SUR LE ZINC', gest: 'mash', power: 53 } },

  /* FR14 — la ballerine de l'opéra : marine, rouge et blanc. */
  { id: 'FR14', nom: 'La Petite Danseuse en Chaussons', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Dans le couloir de l’immeuble, une main contre le mur, elle monte sur les pointes '
      + 'de ses chaussons rouges. Le miroir de l’entrée lui renvoie chaque geste, et elle '
      + 'recommence jusqu’à ce qu’il soit juste.',
    mods: { breathBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'SUR LES POINTES', gest: 'miroir', power: 53 } },

  /* FR15 — la charpentière des pans de bois : rouge, empiècements noirs. */
  { id: 'FR15', nom: 'La Petite Apprentie', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Dans l’atelier plein de sciure, elle construit une cabane avec les chutes de bois, '
      + 'un crayon derrière l’oreille. Son petit maillet rouge ne s’arrête pas de taper.',
    mods: { mashBonus: 1.15, refundBonus: 0.92 },
    cri: { label: 'UN CLOU, UN COUP', gest: 'mash', power: 52 } },

  /* FR16 — la danseuse au grand nœud : bleu ciel vif et blanc. */
  { id: 'FR16', nom: 'La Petite Alsacienne', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'À la fête du village, son grand ruban bleu est noué de travers et bien trop grand. '
      + 'Elle le tient droit d’une main, une part de tarte de l’autre, et elle le prête à qui '
      + 'veut danser.',
    mods: { breathBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'NOUEZ LES RUBANS', gest: 'echarpe', power: 53 } },

  /* FR17 — l'aviatrice de la ligne postale : violet et blanc. */
  { id: 'FR17', nom: 'La Petite Rêveuse d’Avions', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Penchée à la fenêtre au-dessus des toits de brique rose, son petit casque violet '
      + 'sur la tête, elle lance un avion en papier. Quand il retombe, elle en plie un autre et '
      + 'le relance aussitôt.',
    mods: { perfectBonus: 1.17, parryResist: 0.92 },
    cri: { label: 'LE COURRIER DOIT PASSER', gest: 'relance', power: 53 } },

  /* FR18 — la maîtresse verrière : bleu profond et blanc. */
  { id: 'FR18', nom: 'La Petite Ramasseuse de Verre', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Sur le sol poussiéreux de l’atelier, elle lève un éclat de verre bleu vers la '
      + 'lumière. Elle ramasse tous les morceaux, et elle sait déjà comment ils iront ensemble.',
    mods: { parryBonus: 1.16, holdBonus: 0.92 },
    cri: { label: 'PIÈCE PAR PIÈCE', gest: 'mosaique', power: 53 } },

  /* ------------------------------------------------------- les hommes */

  /* FR19 — l'ardoisier fendeur : noir et blanc. */
  { id: 'FR19', nom: 'Le Petit Casseur d’Ardoises', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Au bord de la carrière inondée, il fait des ricochets avec les chutes d’ardoise, '
      + 'sa petite ardoise noire pendue à son cou. Six rebonds : il a battu son record.',
    mods: { mashBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'D’UN SEUL COUP', gest: 'mash', power: 53 } },

  /* FR20 — le flotteur de bois : bleu roi et blanc. */
  { id: 'FR20', nom: 'Le Petit Pêcheur de Bûches', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Dans la rivière jusqu’aux genoux, il tire vers lui une bûche avec sa petite gaffe '
      + 'bleue. Il les attache ensemble avec une corde, et son radeau grandit chaque jour.',
    mods: { breathBonus: 1.16, refundBonus: 0.92 },
    cri: { label: 'TOUS ENCORDÉS', gest: 'echarpe', power: 53 } },

  /* FR21 — le gabier des grands voiliers : rouge et blanc. */
  { id: 'FR21', nom: 'Le Petit Mousse', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Sur le quai, son béret à pompon rouge trop grand pour lui, il regarde le haut du '
      + 'mât. Là-haut, les gabiers chantent, et il leur répond d’en bas, de toutes ses forces.',
    mods: { tempoWindow: 1.16, holdBonus: 0.92 },
    cri: { label: 'OH HISSE, LA TRIBUNE', gest: 'echo', power: 53 } },

  /* FR22 — le docker du grand port : bleu ciel et marine. */
  { id: 'FR22', nom: 'Le Petit Gars des Quais', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Assis au bout de la digue, un sandwich à la main, il regarde passer un '
      + 'porte-conteneurs grand comme un immeuble. Son petit crochet pend à sa ceinture : un '
      + 'jour, c’est lui qui tiendra la charge.',
    mods: { holdBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'ON TIENT LA CHARGE', gest: 'hold', power: 53 } },

  /* FR23 — le conducteur de la diligence à vapeur : rouge vif, jaune, damier. */
  { id: 'FR23', nom: 'Le Petit Chauffeur', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Dans la cuisine, la bouilloire siffle à côté de lui, et il tient un petit volant '
      + 'comme s’il conduisait. Son chapeau melon est trop grand, et il guette la vapeur pour '
      + 'savoir quand partir.',
    mods: { holdBonus: 1.16, parryBonus: 0.92 },
    cri: { label: 'LA PRESSION MONTE', gest: 'jauge', power: 53 } },

  /* FR24 — le mineur de fond : rouge profond et jaune d'or. */
  { id: 'FR24', nom: 'Le Petit Galibot', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'En haut du puits, il serre à deux mains sa lampe de mineur, trop lourde pour lui, '
      + 'sa gamelle sous le bras. C’est sa première descente, et il ne lâchera pas la lampe.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'ON REMONTE ENSEMBLE', gest: 'hold', power: 53 } },

  /* FR25 — le porteur de géant : rouge, marine et blanc. */
  { id: 'FR25', nom: 'Le Petit Porteur', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'À la fête de l’école, il porte au-dessus de sa tête un géant en carton au bout '
      + 'd’un bâton, le grand chapeau de feutre rouge sur la sienne. Plus la musique monte, '
      + 'plus son géant danse.',
    mods: { mashBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'FAITES DANSER LE GÉANT', gest: 'crescendo', power: 53 } },

  /* FR26 — le sonneur de bagad : orange et noir. */
  { id: 'FR26', nom: 'Le Petit Sonneur', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Dans la cour, il gonfle les joues dans une petite cornemuse orange bien trop '
      + 'grande pour lui. Il n’en sort qu’une note qui couine, mais tous les enfants du quartier '
      + 'le suivent déjà.',
    mods: { tempoWindow: 1.16, mashBonus: 0.92 },
    cri: { label: 'DERRIÈRE LE BAGAD', gest: 'capo', power: 53 } },

  /* FR27 — le canut : blanc, rouge et bleu. */
  { id: 'FR27', nom: 'Le Petit Bobineur', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Sur son tabouret, dans l’atelier haut de plafond, il enroule la soie sur les '
      + 'bobines, sa petite navette rouge sur les genoux. Les fils s’emmêlent à ses doigts, et '
      + 'il en est très fier.',
    mods: { parryBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'TISSEZ LA TRIBUNE', gest: 'tifo', power: 53 } },

  /* FR28 — le joueur de pétanque : blanc et bleu ciel. Des boules de loisir. */
  { id: 'FR28', nom: 'Le Petit Pointeur', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Accroupi sur la place poussiéreuse sous les platanes, une boule à la main, il '
      + 'plisse les yeux vers le petit cochonnet bleu ciel. Les anciens se taisent : il va '
      + 'pointer.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'TU TIRES OU TU POINTES', gest: 'visee', power: 53 } },

  /* FR29 — le chasseur du grand hôtel : rouge et blanc en aplats. */
  { id: 'FR29', nom: 'Le Petit Groom', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Devant le grand hôtel, il porte une valise plus grande que lui, son petit '
      + 'calot rouge sur la tête. À chaque coup de sonnette, il arrive en courant, toujours à '
      + 'l’heure.',
    mods: { tempoWindow: 1.16, parryResist: 0.92 },
    cri: { label: 'ON SONNE, J’ARRIVE', gest: 'tempo', power: 53 } },

  /* FR30 — le marchand de socca : rouge et noir en rayures. */
  { id: 'FR30', nom: 'Le Petit Mitron', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Au marché, il tient une part de socca brûlante dans un cornet de papier, du '
      + 'poivre plein les doigts. Il a attendu devant le four depuis l’ouverture, et il '
      + 'attendra la fournée suivante.',
    mods: { perfectBonus: 1.18, holdBonus: 0.92 },
    cri: { label: 'CHAUD DEVANT !', gest: 'relance', power: 53 } },

  /* FR31 — le boulanger de baguettes : bleu nuit et bleu ciel. */
  { id: 'FR31', nom: 'Le Petit Mitron Parisien', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Il rentre à l’aube, une baguette sous le bras dont il a déjà croqué le bout, de la '
      + 'farine sur le nez. Sa petite pelle à pain est sanglée dans son dos, et il a appris à '
      + 'laisser la pâte lever.',
    mods: { holdBonus: 1.16, refundBonus: 0.92 },
    cri: { label: 'LE CROÛTON EST À MOI', gest: 'hold', power: 53 } },

  /* FR32 — l'accordéoniste du bal musette : marine, rouge et blanc. */
  { id: 'FR32', nom: 'Le Petit Musicien de Rue', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Assis sur les marches du métro, il joue de l’harmonica, son petit accordéon '
      + 'rangé à ses pieds dans son étui ouvert. Les passants ralentissent, et certains '
      + 'marchent en mesure sans s’en rendre compte.',
    mods: { tempoWindow: 1.16, breathBonus: 0.92 },
    cri: { label: 'UN TOUR DE VALSE', gest: 'tempo', power: 53 } },

  /* FR33 — le galettier du marché : rouge, empiècements noirs. */
  { id: 'FR33', nom: 'Le Petit Tourneur de Galettes', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Dans la cuisine de la ferme, il étale la pâte avec son petit rouleau rouge sur la '
      + 'crêpière de sa grand-mère. La galette est déchirée et de travers, il en rit, et il en '
      + 'refait une plus grande.',
    mods: { parryBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'ON ÉTALE TOUT', gest: 'tifo', power: 53 } },

  /* FR34 — l'artisan du marché de Noël : bleu ciel vif et blanc. */
  { id: 'FR34', nom: 'Le Petit Marchand', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Dans la neige, devant la cathédrale, il vend des étoiles en papier pendues à un '
      + 'plateau. Il compte les jours jusqu’à Noël sur ses doigts, et il lui en manque toujours.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'PLUS QUE TROIS DODOS', gest: 'compte', power: 53 } },

  /* FR35 — le briquetier de la ville rose : violet et blanc. */
  { id: 'FR35', nom: 'Le Petit Mouleur de Briques', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Sur la berge boueuse du fleuve, il tasse l’argile dans son petit moule violet, et '
      + 'une rangée de briques sèche au soleil à côté de lui. Il les sort par fournées entières.',
    mods: { mashBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'BRIQUE APRÈS BRIQUE', gest: 'salves', power: 53 } },

  /* FR36 — le bonnetier : bleu profond et blanc. */
  { id: 'FR36', nom: 'Le Petit Dévideur', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Sur son tabouret, il est emmêlé dans une écharpe bleue si longue qu’elle fait déjà '
      + 'le tour de la pièce. Il la tricote pour tout le quartier, et il n’a pas l’intention de '
      + 's’arrêter.',
    mods: { breathBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'UNE ÉCHARPE POUR TOUS', gest: 'echarpe', power: 53 } },

  /* ---------------------------------------------------- les créatures */

  /* FR37 — la boule de fort : noir et blanc. */
  { id: 'FR37', nom: 'La Petite Boule', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Une petite boule de bois cerclée de fer, sur ses chaussons de feutre. Sur la '
      + 'piste courbe, elle penche d’un côté, puis de l’autre, et elle ne roule jamais tout '
      + 'droit.',
    mods: { breathBonus: 1.16, holdBonus: 0.92 },
    cri: { label: 'ÇA PENCHE, ÇA PASSE', gest: 'bascule', power: 53 } },

  /* FR38 — l'escargot de Bourgogne : bleu roi et blanc. */
  { id: 'FR38', nom: 'Le Petit Escargot', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sur une feuille de chou dans la rosée du matin, il sort à peine les yeux de sa '
      + 'coquille, son petit bonnet bleu entre les cornes. Il lui faut une journée pour '
      + 'traverser le potager, mais il arrive toujours.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'LENTEMENT MAIS SÛREMENT', gest: 'tenue', power: 53 } },

  /* FR39 — la coquille Saint-Jacques : rouge et blanc en bandes. */
  { id: 'FR39', nom: 'La Petite Coquille', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Sur le sable mouillé à marée basse, une petite coquille vivante, sa bouée rayée '
      + 'autour du corps. Pour avancer, elle claque des deux valves, une fois, deux fois.',
    mods: { mashBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'CLIC, CLAC, EN AVANT', gest: 'deuxvoix', power: 53 } },

  /* FR40 — le conteneur : bleu ciel et marine. */
  { id: 'FR40', nom: 'Le Petit Conteneur', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Seul sur le quai mouillé, un petit conteneur cabossé, des plumes de mouette sur '
      + 'le toit. On l’a oublié là, mais il tient bon : un jour, il fera le tour du monde.',
    mods: { holdBonus: 1.16, parryBonus: 0.92 },
    cri: { label: 'CHARGEZ, ON TIENT', gest: 'hold', power: 53 } },

  /* FR41 — le pot de rillettes : rouge vif, jaune, damier. */
  { id: 'FR41', nom: 'Le Petit Pot de Rillettes', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Sur une nappe à carreaux au bord de la route, un petit pot de grès vivant, son '
      + 'couvercle de tissu un peu de travers, un couteau rouge à la main. Il ne demande qu’à '
      + 'passer de main en main.',
    mods: { breathBonus: 1.16, parryBonus: 0.92 },
    cri: { label: 'FAITES PASSER', gest: 'echarpe', power: 53 } },

  /* FR42 — le cheval de mine : rouge profond et jaune d'or. */
  { id: 'FR42', nom: 'Le Petit Poulain du Fond', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'À l’entrée d’une galerie sombre, un petit poulain hirsute, la crinière dans les '
      + 'yeux, son licol rouge sur la tête. Il a peur, mais il retient déjà chaque tournant.',
    mods: { breathBonus: 1.16, perfectBonus: 0.92 },
    cri: { label: 'JE CONNAIS LE CHEMIN', gest: 'memoire', power: 53 } },

  /* FR43 — la gaufre fourrée : rouge, marine et blanc. */
  { id: 'FR43', nom: 'La Petite Gaufre', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Une petite gaufre vivante qui se cache dans sa boîte rouge au ruban marine, au '
      + 'fond de la vitrine, du sucre sur la tête. Ses petits carreaux dessinent déjà une '
      + 'tribune.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'TOUT EN CARREAUX', gest: 'tifo', power: 53 } },

  /* FR44 — le korrigan : orange et noir. Une créature, jamais un enfant déguisé. */
  { id: 'FR44', nom: 'Le Petit Korrigan', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Caché derrière une touffe de bruyère sur la lande, au crépuscule, un minuscule '
      + 'korrigan au bonnet orange beaucoup trop grand, le doigt sur la bouche. Il prépare une '
      + 'farce, et elle tombera au moment où personne ne l’attend.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'SURPRISE SUR LA LANDE', gest: 'contretemps', power: 53 } },

  /* FR45 — le ver à soie : blanc, rouge et bleu. */
  { id: 'FR45', nom: 'Le Petit Ver à Soie', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Roulé sur une étagère de bois, un petit ver à soie grignote sa feuille, sa bobine '
      + 'rouge entre les pattes. Un fil brillant lui sort de la bouche, et il en couvrira toute '
      + 'la pièce.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'UN FIL, MILLE COULEURS', gest: 'tifo', power: 53 } },

  /* FR46 — la cigale : blanc et bleu ciel. */
  { id: 'FR46', nom: 'La Petite Cigale', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Sur l’écorce d’un platane en plein soleil, une petite cigale chante faux, son '
      + 'tambourin bleu ciel à l’épaule. Elle chante quand même, et la colline lui répond.',
    mods: { tempoWindow: 1.16, perfectBonus: 0.92 },
    cri: { label: 'TOUT L’ÉTÉ !', gest: 'echo', power: 53 } },

  /* FR47 — la pieuvre de l'aquarium : rouge et blanc en aplats. */
  { id: 'FR47', nom: 'La Petite Pieuvre', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'La nuit, une petite pieuvre enjambe le bord de son bassin, sa bouée rayée autour '
      + 'de la tête. Avec huit bras, elle tape sur toutes les vitres de l’aquarium à la fois.',
    mods: { mashBonus: 1.16, holdBonus: 0.92 },
    cri: { label: 'HUIT BRAS EN L’AIR', gest: 'mash', power: 53 } },

  /* FR48 — la grosse tête de carnaval : rouge et noir en rayures. */
  { id: 'FR48', nom: 'La Petite Grosse Tête', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Dans un atelier de carnaval poussiéreux, une petite tête de papier mâché s’est '
      + 'mise à marcher toute seule, la peinture encore fraîche sur la joue. Elle tient un '
      + 'cornet de confettis, et elle vise déjà les passants.',
    mods: { perfectBonus: 1.17, tempoWindow: 0.92 },
    cri: { label: 'CONFETTIS PARTOUT', gest: 'rouleaux', power: 53 } },

  /* FR49 — le croissant : bleu nuit et bleu ciel. */
  { id: 'FR49', nom: 'Le Petit Croissant', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Au fond de la panière, un petit croissant tout tordu, un sac de papier rayé sur la '
      + 'tête comme une capuche. Il sort du four à la même heure chaque matin, et pas une '
      + 'minute plus tard.',
    mods: { tempoWindow: 1.16, mashBonus: 0.92 },
    cri: { label: 'TOUS LES MATINS', gest: 'tempo', power: 53 } },

  /* FR50 — la colonne d'affiches : marine, rouge et blanc. */
  { id: 'FR50', nom: 'La Petite Colonne', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Une petite colonne d’affiches toute neuve, sur le trottoir du boulevard, son '
      + 'bandeau encore vide. Elle tient sa brosse à colle et une affiche roulée : elle attend '
      + 'le grand spectacle.',
    mods: { parryBonus: 1.16, refundBonus: 0.92 },
    cri: { label: 'COLLEZ LES AFFICHES', gest: 'tifo', power: 53 } },

  /* FR51 — la galette-saucisse : rouge, empiècements noirs. */
  { id: 'FR51', nom: 'La Petite Galette-Saucisse', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Sur le comptoir de la buvette, avant le match, une petite galette-saucisse fume '
      + 'dans sa serviette à carreaux, une goutte de moutarde sur la tête. Elle connaît par cœur '
      + 'l’heure du coup d’envoi.',
    mods: { tempoWindow: 1.16, holdBonus: 0.92 },
    cri: { label: 'AVANT LE COUP D’ENVOI', gest: 'tempo', power: 53 } },

  /* FR52 — le kougelhopf : bleu ciel vif et blanc. */
  { id: 'FR52', nom: 'Le Petit Kougelhopf', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sorti du four un peu trop tôt, un petit kougelhopf penche sur le côté, à côté de '
      + 'son bol bleu, le sucre glace qui lui glisse de la tête. Il retournerait bien au four '
      + 'pour lever encore.',
    mods: { perfectBonus: 1.18, refundBonus: 0.92 },
    cri: { label: 'ÇA LÈVE ENCORE', gest: 'relance', power: 53 } },

  /* FR53 — la fusée : violet et blanc. */
  { id: 'FR53', nom: 'La Petite Fusée', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Dans un jardin, une petite fusée en carton peinte en violet et blanc, sa visière '
      + 'de travers. Un petit nuage de fumée de carton sous ses ailerons : elle compte, et elle '
      + 'y croit.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'DIX, NEUF… DÉCOLLAGE', gest: 'compte', power: 53 } },

  /* FR54 — la chaussette : bleu profond et blanc. */
  { id: 'FR54', nom: 'La Petite Chaussette', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Derrière la machine à laver, une petite chaussette toute seule, poussiéreuse, un '
      + 'trou au bout. Elle cherche sa paire dans chaque reflet, ses aiguilles à tricoter dans '
      + 'les bras.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'OÙ EST MA PAIRE ?', gest: 'miroir', power: 53 } },

  /* **Les six légendaires de la série** (validées par Gaël le 5 novembre
     2026). Un seul âge : elles se trouvent, elles ne grandissent pas. FR55 à
     FR57 sont liées aux équipes de France (A, féminine, espoirs), FR58 à FR60
     au championnat, sans club (`clubs.js`, `lienEcrit`). Ni coq, ni
     Marianne, ni drapeau officiel : le bleu, le blanc et le rouge passent par
     la tenue. Fiches et prompts : `fanzzy-prompts/FR-legendaires.md`. */
  { id: 'FR55', nom: 'Le Grand Tambour Tricolore', type: 'perc', stage: 1, rar: 'legendaire',
    histoire: 'Il n’a pas de nom, pas d’âge, et il ne sait jouer qu’en marchant. Quand l’équipe '
      + 'joue loin, on l’entend arriver deux rues avant le car.',
    mods: { mashBonus: 1.38, mashTime: 900, holdBonus: 0.86 },
    cri: { label: 'QUE ÇA RÉSONNE', gest: 'mash', power: 81 } },

  { id: 'FR56', nom: 'La Voix des Bleues', type: 'depl', stage: 1, rar: 'legendaire',
    histoire: 'Au premier match, elles étaient onze sur le terrain et elle seule en tribune. '
      + 'Elle chantait pour cent. Elle n’a jamais manqué un match depuis.',
    mods: { breathBonus: 1.36, refundBonus: 1.22, mashBonus: 0.86 },
    cri: { label: 'ON EST LÀ', gest: 'echarpe', power: 80 } },

  { id: 'FR57', nom: 'Le Gamin de l’Équipe Espoir', type: 'fide', stage: 1, rar: 'legendaire',
    histoire: 'Chaque génération de jeunes croit l’avoir vu en tribune à leur premier match. Ils '
      + 'ont raison : c’est le même gamin, il a toujours douze ans.',
    mods: { holdBonus: 1.42, holdForgive: 3, parryResist: 1.2, tempoInterval: 90 },
    cri: { label: 'NOTRE TOUR VIENDRA', gest: 'hold', power: 80 } },

  { id: 'FR58', nom: 'Le Multiplex du Dimanche', type: 'voix', stage: 1, rar: 'legendaire',
    histoire: 'Le dimanche, il parle de dix stades à la fois et ne se trompe jamais. Quand il '
      + 'crie « but », tout le pays se demande : chez qui ?',
    mods: { tempoWindow: 1.3, breathBonus: 1.18, parryResist: 0.84 },
    cri: { label: 'BUT, BUT, BUT', gest: 'echo', power: 83 } },

  { id: 'FR59', nom: 'La Pelouse de Province', type: 'tifo', stage: 1, rar: 'legendaire',
    histoire: 'Elle est sous chaque terrain du pays à la fois. Les écharpes, ce sont les '
      + 'supporters qui les lui ont laissées, un soir de victoire.',
    mods: { parryBonus: 1.5, perfectBonus: 1.22, tempoWindow: 0.86 },
    cri: { label: 'TOUTE LA FRANCE', gest: 'mosaique', power: 82 } },

  { id: 'FR60', nom: 'Le Car du Déplacement', type: 'pyro', stage: 1, rar: 'legendaire',
    histoire: 'Il part le samedi à cinq heures, il rentre le dimanche à l’aube. Personne n’a '
      + 'jamais su qui le conduit.',
    mods: { perfectBonus: 1.46, refundBonus: 1.32, backfire: 1.45 },
    cri: { label: 'EN ROUTE', gest: 'relance', power: 82 } },
];

export const DEX_PARCAGE = PREMIERS_AGES.map((f) => ({ ...f, set: SET_PARCAGE.id }));
