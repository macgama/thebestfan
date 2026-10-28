/**
 * DIE KURVE — le foot suisse vu du virage debout.
 *
 * ## Ce que la série raconte
 *
 * Les lacs et leurs bateaux, les montagnes, les carnavals, les marchés et les
 * vieux métiers des villes. Chaque Fanzzy porte les couleurs d'un club du
 * championnat suisse de la saison 2026-2027, **et rien d'autre de ce club**.
 * Il vit dans un morceau de culture de sa ville ou de son canton — la
 * lanterne du carnaval, le bac du fleuve, le guet de la cathédrale, la
 * raclette, la reine de l'alpage — et son troisième âge garde toujours un
 * détail du premier.
 *
 * Demandée par Gaël le 21 octobre 2026, sur le modèle de LES TERRACES : trois
 * Fanzzy par club, une femme, un homme et une créature (un animal ou un objet
 * vivant de la ville), soit trente-six lignées pour douze clubs. Les fiches
 * (noms, histoires, invites des dessins) sont dans
 * `/mnt/project-files/fanzzy-prompts/SU-die-kurve.md` : SU1 à SU12 le premier
 * humain de chaque club, SU13 à SU24 le second, SU25 à SU36 les créatures,
 * toujours dans le même ordre des clubs (`clubs.js`). Le 28 octobre, Gaël a
 * demandé de les créer : les trente-six sont dessinées ensemble, aux trois
 * âges, et entrent d'un coup.
 *
 * ## La prudence juridique, la même que LES TERRACES
 *
 * **Le club de référence n'apparaît nulle part dans le jeu.** Ni son nom, ni
 * son surnom, ni son écusson, ni ce que l'écusson dessine (pas d'ours, pas
 * d'étoile, pas d'aigle ni de clé, pas d'insecte, pas de grand V), ni son
 * stade, ni ses chants. La croix suisse et les drapeaux des cantons non plus.
 * Il n'est écrit que dans la ligne « Couleurs » de chaque fiche, pour qui
 * dessine. Les histoires ci-dessous parlent du métier, de la ville, du lac et
 * de la montagne, jamais du club : c'est la règle de `dex-terraces.js`, et
 * elle ne se rattrape pas après coup.
 *
 * ## Elle arrive fermée, et sans légendaire
 *
 * Aucune saison lancée ne la nomme : aucun booster ni aucun kiosque ne la
 * distribue tant que Gaël ne la coche pas dans une saison lancée (onglet
 * SAISONS de /admin). Aucune légendaire n'est conçue : `catalogue-smoke.mjs`
 * l'exempte nommément, comme LES TERRACES, et l'exemption tombe d'elle-même
 * le jour où la série en compte cinq.
 *
 * ## Le barème et les familles
 *
 * Celui des séries voisines : `commune` → `rare` → `epique`, un cri à ~53 /
 * ~66 / ~79, un bonus franc de la famille et un petit défaut qui se résorbe
 * en grandissant. Les deuxième et troisième âges ne sont écrits qu'en nom,
 * histoire et cri, dans `dex-ages.js`.
 *
 * Six lignées par famille, et dans chaque famille trois au geste éponyme et
 * une à chacune des trois variantes : la série ne déplace aucun équilibre du
 * catalogue. Avant elle, quatre familles étaient pile au bord de la moitié
 * (garde, écharpe, tifo, relance) ; trois éponymes sur six les gardent du bon
 * côté. Les gestes suivent le métier : le guet crie l'heure (tempo), la
 * fanfare masquée joue faux exprès (contretemps), le klaxon du car des cols
 * revient de la montagne (écho), le maître des corporations mène le cortège
 * (capo) ; le bouffon accélère derrière les enfants (crescendo), les pétards
 * du bonhomme de neige éclatent par rafales (salves), le sac-poisson nage la
 * brasse (deux voix) ; la marmite tient jusqu'au coup qui la casse (tenue),
 * la graveuse perce ses timbres au trou près (retenue), la gardienne du jet
 * dose sa vanne (jauge) ; la brodeuse pique point par point (mosaïque), le
 * bibliothécaire range ses livres (tri), les vendangeuses se penchent l'une
 * après l'autre le long des terrasses (ola) ; le funiculaire part au compte
 * à rebours (compte), le chamois vise la crête d'en face (visée), la
 * marchande lance ses marrons dans les cornets (rouleaux) ; le bac se laisse
 * porter par le courant d'une rive à l'autre (bascule), le cygne se regarde
 * dans le lac (miroir), le tram connaît toutes ses lignes par cœur (mémoire).
 *
 * L'identifiant `SU` est court et en majuscules, comme les autres, pour que
 * `racineDe` lise sans hésiter où finit la série et où commence le numéro.
 *
 * Le bleu-vert d'un lac de montagne : la couleur que douze clubs aux couleurs
 * différentes ont en commun, l'eau qu'on voit de presque toutes leurs villes.
 * Il reste loin du bleu de LES GALÈRES DE DÉPLACEMENT et du gris-vert pâle des
 * PHÉNOMÈNES MÉTÉO.
 */
export const SET_KURVE = {
  id: 'SU',
  nom: 'DIE KURVE',
  ligne: 'debout dans le virage, et la montagne regarde le match',
  c1: '#2E8B9A',
  c2: '#0D1A1D',
};

/**
 * Les trente-six premiers âges. Leurs suites sont dans `dex-ages.js`.
 * `set` est posé une fois, en bas, comme dans `dex-terraces.js`.
 */
const PREMIERS_AGES = [

  /* ------------------------------------------------ les premiers humains */

  /* SU1 — le tifo des lanternes : le gamin du carnaval de quatre heures du
     matin. Rouge et bleu. Le petit lampion pend à sa ceinture au troisième
     âge. */
  { id: 'SU1', nom: 'Le Gamin au Lampion', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'À quatre heures du matin, toutes les lumières de la vieille ville s’éteignent '
      + 'et il ne reste que les lanternes. Il suit le cortège avec un petit lampion de papier au '
      + 'bout d’un bâton, à moitié endormi et parfaitement heureux.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'ON ÉTEINT TOUT', gest: 'tifo', power: 53 } },

  /* SU2 — l'écharpe des bateaux à aubes : la gamine du ponton. Bleu nuit et
     blanc. */
  { id: 'SU2', nom: 'La Gamine du Ponton', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Elle attend au bout du ponton de bois et fait de grands signes à chaque bateau '
      + 'qui passe. Le petit levier de télégraphe sous le bras, elle sait déjà par cœur l’heure '
      + 'de tous les départs du lac.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'TOUS À BORD', gest: 'echarpe', power: 53 } },

  /* SU3 — le tempo du guet : le gamin qui comptait les marches du clocher.
     Bleu roi et blanc. Celui qui crie l'heure à la ville, la nuit. */
  { id: 'SU3', nom: 'Le Gamin de l’Escalier', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'La nuit, il monte l’escalier de pierre vers la cathédrale, une petite lanterne '
      + 'bleue levée devant lui, et il compte les marches sur ses doigts. Il en connaît le '
      + 'nombre exact, et il le dit à voix haute à chaque fois.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'C’EST L’HEURE !', gest: 'tempo', power: 53 } },

  /* SU4 — le tifo du pont couvert : la gamine aux géraniums. Bleu lac et
     blanc, fond magenta. Ses tableaux sous le toit du pont sont blancs, sans
     image. */
  { id: 'SU4', nom: 'La Gamine aux Géraniums', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Accoudée à la rambarde du vieux pont de bois, elle arrose un seul pot de '
      + 'géraniums rouges avec son petit arrosoir bleu. Elle dit qu’un pont sans fleurs, c’est '
      + 'une tribune sans drapeaux.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'FLEURISSEZ LE PONT', gest: 'tifo', power: 52 } },

  /* SU5 — le compte du funiculaire : le gamin du quai. Noir et blanc. Le
     départ se donne au compte à rebours. */
  { id: 'SU5', nom: 'Le Gamin du Quai', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur le quai ensoleillé, il serre son petit levier de commande en plastique et '
      + 'regarde la montagne. Il compte les cabines du funiculaire qui montent, et il donne '
      + 'lui-même le départ, à voix basse, à chacune.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'TROIS, DEUX, UN… ON MONTE', gest: 'compte', power: 53 } },

  /* SU6 — la mosaïque de la broderie : la gamine au tambour à broder. Vert
     et blanc, fond magenta, aura blanche. */
  { id: 'SU6', nom: 'La Gamine au Tambour à Broder', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Assise sur un banc, un fil accroché à ses lunettes, elle brode une fleur blanche '
      + 'un peu de travers sur son petit tambour vert. Point par point, sans se presser : la '
      + 'fleur finit toujours par apparaître.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'POINT PAR POINT', gest: 'mosaique', power: 53 } },

  /* SU7 — le tempo de l'horloge fleurie : le gamin qui plantait une fleur
     par heure. Grenat. */
  { id: 'SU7', nom: 'Le Gamin au Pot de Fleurs', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'À genoux devant un pot de bégonias rouges, de la terre sur le nez, il plante une '
      + 'fleur par heure avec son petit transplantoir. Il n’a pas de montre : il dit que les '
      + 'fleurs lui donnent l’heure.',
    mods: { tempoWindow: 1.16, mashBonus: 0.92 },
    cri: { label: 'UNE FLEUR PAR HEURE', gest: 'tempo', power: 53 } },

  /* SU8 — la relance de la cordée : la gamine à la gourde. Rouge et blanc.
     La gourde cabossée reste accrochée au troisième âge. */
  { id: 'SU8', nom: 'La Gamine à la Gourde', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur le sentier, elle monte toujours la première sur les rochers, la petite corde '
      + 'rouge sur l’épaule et sa gourde cabossée à la main. Elle tend la corde, attend le bon '
      + 'moment, et elle saute.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'TENDEZ… ET HOP !', gest: 'relance', power: 54 } },

  /* SU9 — le crescendo du bouffon : le gamin au masque de carton, poursuivi
     par le bouffon de la fête des cadets. Rouge et blanc. */
  { id: 'SU9', nom: 'Le Gamin au Masque de Bouffon', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Il dévale la vieille rue pavée, un masque de bouffon en carton sur le front et '
      + 'un petit bâton à boule rouge à la main. Le bouffon de la fête le poursuit, et plus il '
      + 'court, plus il rit.',
    mods: { mashBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'PLUS VITE, IL ARRIVE !', gest: 'crescendo', power: 53 } },

  /* SU10 — la retenue des timbres : la gamine au carnet. Rouge et blanc.
     Timbres blancs, sans image ni chiffre. */
  { id: 'SU10', nom: 'La Gamine au Carnet de Timbres', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Penchée sur son petit album, la pince dans une main et le burin dans l’autre, '
      + 'elle compte les dents de chaque timbre avant de le coller. Il en faut le compte exact, '
      + 'pas une de plus.',
    mods: { holdBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'PAS UNE DENT DE TROP', gest: 'retenue', power: 53 } },

  /* SU11 — l'écho du car des cols : le gamin au car en plastique. Jaune et
     noir, aura jaune citron. Le klaxon à trois tons revient de la montagne. */
  { id: 'SU11', nom: 'Le Gamin au Car en Plastique', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Sur la place du village, il tient un petit volant jaune devant lui et fait le '
      + 'bruit du moteur, la bouche fermée. Dans les virages, il imite le klaxon à trois notes, '
      + 'et il attend que la montagne le lui rende.',
    mods: { tempoWindow: 1.16, holdBonus: 0.92 },
    cri: { label: 'TA-TI-TA !', gest: 'echo', power: 53 } },

  /* SU12 — le tempo de la parade : la gamine au casque audio. Blanc et bleu
     roi. */
  { id: 'SU12', nom: 'La Gamine au Casque Audio', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Dans sa petite chambre, un vieux casque bleu sur une oreille et une platine '
      + 'jouet dans les mains, elle hoche la tête en rythme. Elle ne rate jamais le temps, même '
      + 'quand la musique s’arrête.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'SUR LE TEMPS', gest: 'tempo', power: 53 } },

  /* ------------------------------------------------- les seconds humains */

  /* SU13 — la bascule du bac : la gamine des marches du fleuve. Rouge et
     bleu. Le bac traverse sans moteur, poussé par le seul courant. */
  { id: 'SU13', nom: 'La Gamine des Marches du Rhin', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Assise sur les marches de pierre du fleuve, les pieds dans l’eau, elle tient '
      + 'une petite cloche rouge sur ses genoux. Elle regarde le bac passer d’une rive à l’autre, '
      + 'sans moteur, rien qu’avec le courant.',
    mods: { breathBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'D’UNE RIVE À L’AUTRE', gest: 'bascule', power: 54 } },

  /* SU14 — le capo des corporations : le gamin au bouquet du cortège du
     printemps. Bleu nuit et blanc. */
  { id: 'SU14', nom: 'Le Gamin au Bouquet', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Dans le cortège du printemps, il marche un bouquet de fleurs blanches dans une '
      + 'main et une petite bannière bleue dans l’autre. Il est le plus petit du défilé, mais '
      + 'c’est lui que tout le monde suit.',
    mods: { tempoWindow: 1.16, holdBonus: 0.92 },
    cri: { label: 'SUIVEZ LA BANNIÈRE', gest: 'capo', power: 53 } },

  /* SU15 — la ola des terrasses : la gamine au grappillon. Bleu roi et
     blanc, fond magenta. Les vendangeuses se penchent l'une après l'autre,
     de terrasse en terrasse. */
  { id: 'SU15', nom: 'La Gamine au Grappillon', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Sur un muret au-dessus du lac, une grappe violette dans les mains et du jus sur '
      + 'le menton, elle remplit son petit panier bleu. Quand elle se lève, toute la rangée de '
      + 'vigne se lève derrière elle.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'DE TERRASSE EN TERRASSE', gest: 'ola', power: 52 } },

  /* SU16 — le contretemps de la fanfare masquée : le gamin au mirliton.
     Bleu lac et blanc. La fanfare joue faux exprès. */
  { id: 'SU16', nom: 'Le Gamin au Mirliton', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Dans une ruelle enneigée, des confettis dans les cheveux, il souffle dans un '
      + 'petit trombone bleu qu’il tient de travers. Il joue faux, et à côté du temps — exprès, '
      + 'jure-t-il.',
    mods: { tempoWindow: 1.15, holdBonus: 0.92 },
    cri: { label: 'FAUX, MAIS ENSEMBLE', gest: 'contretemps', power: 53 } },

  /* SU17 — les rouleaux des marrons : la gamine aux châtaignes. Noir et
     blanc. Elle lance ses marrons chauds dans les cornets. */
  { id: 'SU17', nom: 'La Gamine aux Marrons', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Dans la rue d’automne, sa petite poêle noire à la main et un cornet de '
      + 'châtaignes sous le bras, elle en lance une aux passants, de loin. Elle tombe presque '
      + 'toujours dans le cornet.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'CHAUD, ATTRAPEZ !', gest: 'rouleaux', power: 54 } },

  /* SU18 — le tri de la bibliothèque : le gamin aux patins de feutre. Vert
     et blanc, fond magenta, aura blanche. Livres à dos blancs, sans titre. */
  { id: 'SU18', nom: 'Le Gamin aux Patins de Feutre', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Les pantoufles de feutre vertes enfilées sur ses chaussures, il glisse sur le '
      + 'parquet ciré de la vieille bibliothèque, un livre serré contre lui. Il remet chaque '
      + 'livre à sa place sans jamais s’arrêter.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'CHACUN À SA PLACE', gest: 'tri', power: 53 } },

  /* SU19 — la jauge du jet d'eau : la gamine au pistolet à eau. Grenat. Elle
     dose la vanne. */
  { id: 'SU19', nom: 'La Gamine au Pistolet à Eau', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sur la jetée de pierre, trempée jusqu’aux genoux, elle arrose les passants avec '
      + 'un petit pistolet à eau. La petite roue de vanne pend à sa ceinture : elle dose, ni '
      + 'trop fort, ni trop peu.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'NI TROP, NI TROP PEU', gest: 'jauge', power: 53 } },

  /* SU20 — le martelage de la raclette : le gamin à la tranche de fromage.
     Rouge et blanc. */
  { id: 'SU20', nom: 'Le Gamin à la Tranche de Fromage', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'À la table de la fête du village, du fromage sur le menton, il racle plus vite '
      + 'que tout le monde avec son petit racloir de bois. Une pomme de terre dans l’autre main, '
      + 'il n’en laisse pas une goutte.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'RACLE, RACLE, RACLE', gest: 'mash', power: 53 } },

  /* SU21 — la garde de la lutte : la gamine à la sciure. Rouge et blanc.
     Celle qui ne tombe jamais sur le dos. */
  { id: 'SU21', nom: 'La Gamine à la Sciure', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Pieds nus dans le rond de sciure, de la sciure plein les cheveux, elle lutte avec '
      + 'ses cousins dans une culotte de toile trop grande. Ils la poussent tous ensemble, et '
      + 'elle ne tombe jamais sur le dos.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'JAMAIS SUR LE DOS', gest: 'hold', power: 53 } },

  /* SU22 — la relance de la piste : le gamin à la luge. Rouge et blanc. Il
     se ramasse, puis lâche au bon moment. */
  { id: 'SU22', nom: 'Le Gamin à la Luge', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'En haut de la pente enneigée, la petite luge de bois sous le bras et les lunettes '
      + 'rouges relevées sur le bandeau, il attend. Il se ramasse, il retient son souffle, et il '
      + 'part pile au bon moment.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'ACCROCHEZ-VOUS… PARTEZ !', gest: 'relance', power: 54 } },

  /* SU23 — le martelage du marché aux oignons : la gamine à la tresse.
     Jaune et noir, aura jaune citron. Le petit marteau couineur en
     plastique. */
  { id: 'SU23', nom: 'La Gamine à la Tresse d’Oignons', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Dans la rue du marché pleine de confettis, elle tient une tresse de trois oignons '
      + 'de travers et un petit marteau jaune qui couine. Elle tape sur toutes les têtes qui '
      + 'passent, très vite, en riant.',
    mods: { mashBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'COUIC, COUIC, COUIC !', gest: 'mash', power: 53 } },

  /* SU24 — la relance des pralines : le gamin aux doigts chocolatés. Blanc
     et bleu roi. Il attend la bonne température et démoule pile. */
  { id: 'SU24', nom: 'Le Gamin aux Doigts Chocolatés', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Devant la vitrine de la vieille confiserie, du chocolat plein les doigts, il cache '
      + 'une petite boîte de pralines bleue dans son dos. Il sait exactement quand le chocolat '
      + 'est prêt : il n’attend pas une seconde de plus.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'ATTENDS… DÉMOULE !', gest: 'relance', power: 54 } },

  /* -------------------------------------------------------- les créatures */

  /* SU25 — les deux voix du sac-poisson : le petit sac étanche dans lequel
     on roule ses habits pour descendre le fleuve à la nage. Rouge et bleu.
     Il nage la brasse, un bras après l'autre. */
  { id: 'SU25', nom: 'Le Petit Sac-Poisson', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'À moitié vide, un peu froissé, des gouttes d’eau sur la peau, il porte sa petite '
      + 'bouée bleue autour de la taille. Il rêve de descendre le fleuve tout l’été, un bras après '
      + 'l’autre, avec les habits de quelqu’un roulés dans le ventre.',
    mods: { mashBonus: 1.16, refundBonus: 0.92 },
    cri: { label: 'UN BRAS, PUIS L’AUTRE', gest: 'deuxvoix', power: 53 } },

  /* SU26 — les salves du bonhomme de neige : le petit bonhomme en coton qui
     annonce la fin de l'hiver, la tête pleine de pétards. Bleu nuit et
     blanc. */
  { id: 'SU26', nom: 'Le Petit Bonhomme de Neige', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Un peu de travers, le petit chapeau haut de forme qui lui glisse sur l’œil, il '
      + 'a un seul serpentin de papier sur la tête. Il sait que l’hiver finira quand ses pétards '
      + 'éclateront, par rafales, l’un après l’autre.',
    mods: { mashBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'PAN, PAN, PAN !', gest: 'salves', power: 53 } },

  /* SU27 — l'écharpe de la rame : la petite rame de métro qui avait peur de
     la pente. Bleu roi et blanc. Pas de chiffre, pas de ligne écrite. */
  { id: 'SU27', nom: 'La Petite Rame', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Dans la rue en pente, elle se penche en arrière, les roues qui patinent, et tire '
      + 'de toutes ses forces sur son petit frein bleu. Elle a peur de la colline, mais elle y '
      + 'monte tous les jours de match.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'ON MONTE QUAND MÊME', gest: 'echarpe', power: 53 } },

  /* SU28 — le miroir du cygne : le petit cygne gris du quai. Bleu lac et
     blanc. Il se regarde dans l'eau, et l'eau lui répond. */
  { id: 'SU28', nom: 'Le Petit Cygne Gris', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Tout en duvet gris, un peu maladroit, une miette de pain sur le bec, il fait la '
      + 'queue sur le quai de pierre avec sa petite cloche bleue au cou. Il se penche sur le lac '
      + 'et copie les grands cygnes qu’il y voit.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'COMME DANS L’EAU', gest: 'miroir', power: 53 } },

  /* SU29 — l'écharpe du chevreau : le petit chevreau noir qui tombait de
     tous les rochers. Noir et blanc. */
  { id: 'SU29', nom: 'Le Petit Chevreau Noir', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Les pattes qui tremblent, perché de travers sur un caillou, une touffe de foin '
      + 'dans la bouche, il fait sonner sa petite cloche noire à chaque chute. Il tombe de tous '
      + 'les rochers, et il remonte sur le suivant.',
    mods: { breathBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'ENCORE UN ROCHER', gest: 'echarpe', power: 53 } },

  /* SU30 — le tifo du biscuit : le petit biscuit au miel décoré de sucre
     comme une broderie. Vert et blanc, fond magenta, aura blanche. */
  { id: 'SU30', nom: 'Le Petit Biscuit au Miel', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Un coin grignoté, quelques points de sucre blanc sur le ventre et une miette sur '
      + 'la joue, il serre son petit moule vert dans ses bras. Il a peur d’être mangé avant '
      + 'd’avoir fini son dessin.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'PAS AVANT LA FIN DU DESSIN', gest: 'tifo', power: 52 } },

  /* SU31 — la tenue de la marmite : la petite marmite en chocolat qu'on
     casse en décembre pour fêter la ville. Grenat. Elle tient jusqu'au coup,
     sans se fendre avant. */
  { id: 'SU31', nom: 'La Petite Marmite en Chocolat', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Une petite fêlure sur le côté, des légumes en pâte d’amande qui dépassent sous '
      + 'son couvercle, elle serre sa petite louche grenat. Elle sait qu’on la cassera en '
      + 'décembre ; elle tient jusque-là, sans craquer une seconde trop tôt.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'PAS ENCORE !', gest: 'tenue', power: 53 } },

  /* SU32 — la garde de la génisse : la petite génisse noire et têtue de
     l'alpage. Rouge et blanc. La pâquerette reste sur sa corne. */
  { id: 'SU32', nom: 'La Petite Génisse Noire', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'La tête baissée, une pâquerette coincée sur une corne, elle pousse de toutes ses '
      + 'forces contre rien du tout. Elle bouscule tout le troupeau, et personne n’a jamais réussi '
      + 'à la faire reculer.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'PAS UN PAS EN ARRIÈRE', gest: 'hold', power: 53 } },

  /* SU33 — la garde du bouvier : le petit chiot tricolore. Rouge et blanc.
     La goutte de lait reste sur sa truffe. */
  { id: 'SU33', nom: 'Le Petit Chiot Tricolore', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Assis, les grosses pattes écartées, une goutte de lait sur la truffe, il serre '
      + 'son petit bidon rouge contre lui. Il trébuche sur tout, mais le bidon, il ne le lâche '
      + 'jamais.',
    mods: { holdBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'JE NE LÂCHE PAS', gest: 'hold', power: 53 } },

  /* SU34 — la visée du chamois : le petit chamois des éboulis. Rouge et
     blanc. Il vise la crête d'en face avant de sauter. */
  { id: 'SU34', nom: 'Le Petit Chamois', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Les pattes écartées sur les cailloux qui roulent, le petit sac à dos rouge sur '
      + 'le dos, il glisse un peu et il rougit beaucoup. Avant chaque saut, il fixe longtemps la '
      + 'pierre d’en face.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'LA PIERRE D’EN FACE', gest: 'visee', power: 54 } },

  /* SU35 — le martelage du bateau gonflable : le petit bateau jaune qui
     tournait sur lui-même. Jaune et noir, aura jaune citron. Il pagaie
     très vite pour ne plus tourner. */
  { id: 'SU35', nom: 'Le Petit Bateau Gonflable', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'À moitié gonflé, un peu fripé, il serre sa petite pagaie noire dans ses bras. '
      + 'Dans le courant, il tourne sur lui-même ; alors il pagaie, très vite, jusqu’à aller '
      + 'droit.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'PAGAIE, PAGAIE !', gest: 'mash', power: 53 } },

  /* SU36 — la mémoire du tram : le petit tram qui avait peur des virages.
     Blanc et bleu roi. Pas de chiffre, pas de ligne écrite. */
  { id: 'SU36', nom: 'Le Petit Tram', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Il hésite à chaque courbe des rails, tout penché, sa petite cloche bleue sur le '
      + 'toit. Mais il connaît par cœur tous les arrêts de toutes les lignes, et l’ordre dans '
      + 'lequel ils viennent.',
    mods: { breathBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'PROCHAIN ARRÊT : LE STADE', gest: 'memoire', power: 53 } },
];

export const DEX_KURVE = PREMIERS_AGES.map((f) => ({ ...f, set: SET_KURVE.id }));
