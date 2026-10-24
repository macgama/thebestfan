/**
 * LES TERRACES — le foot anglais vu des gradins debout.
 *
 * ## Ce que la série raconte
 *
 * La pluie, le thé, le bord de mer, les pubs, les vieux métiers des villes
 * ouvrières. Chaque Fanzzy porte les couleurs d'un club du championnat anglais
 * de la saison 2026-2027, **et rien d'autre de ce club**. Il vit dans un
 * morceau de culture anglaise à lui — le transat de la promenade, l'enseigne
 * peinte du pub, la péniche des canaux, le bâton de sucre rayé — et son
 * troisième âge garde toujours un détail du premier.
 *
 * Demandée par Gaël le 19 octobre 2026 : un Fanzzy par club, vingt lignées.
 * Les fiches (noms, histoires, invites des dessins) sont dans
 * `/mnt/project-files/fanzzy-prompts/AN-les-terraces.md`.
 *
 * ## La prudence juridique, et pourquoi elle est écrite ici aussi
 *
 * **Le club de référence n'apparaît nulle part dans le jeu.** Ni son nom, ni
 * son surnom, ni son écusson, ni son stade, ni ses joueurs, ni ses chants, ni
 * ce que l'écusson dessine. Il n'est écrit que dans la ligne « Couleurs » de
 * chaque fiche, pour qui dessine, et il ne doit jamais descendre plus bas.
 *
 * Ce n'est pas une précaution de style. Les couleurs n'appartiennent à
 * personne — une écharpe rouge et blanche n'est à aucun club — mais un nom,
 * un surnom ou un écusson, si. C'est la règle de `VISUELS.md`, et elle vaut
 * pour le texte comme pour l'image : une histoire qui nommerait le stade ou
 * citerait un chant ferait à l'écrit ce que le dessin s'est interdit.
 *
 * D'où les histoires ci-dessous : elles parlent du métier, de la ville, du
 * temps qu'il fait, jamais du club. Qui relit une fiche pour l'enrichir doit
 * garder cette règle — c'est la seule de cette série qui ne se rattrape pas
 * après coup.
 *
 * ## Quinze lignées sur vingt, et pourquoi elle arrive fermée
 *
 * Les quinze premières (AN1 à AN15) ont leurs dessins : trois cartes en pied
 * et cinq états par âge, en tenue de base. Les cinq autres arriveront avec
 * les leurs ; les écrire maintenant mettrait au catalogue cinq silhouettes
 * procédurales, et une série dont le quart n'est pas dessiné.
 *
 * Elle arrive **fermée** : aucune saison lancée ne la nomme, donc aucun
 * booster ni aucun kiosque ne la distribue (`chargerSeries`, dans
 * `src/server/fanzzy/catalogue.js`). Elle s'ouvre le jour où Gaël la coche
 * dans une saison lancée — onglet SAISONS de /admin —, sans livraison.
 *
 * Une installation **sans** saison lancée ouvre tout, celle-ci comprise :
 * c'est le comportement voulu du jeu (« le jeu s'ouvre plutôt que de se fermer
 * à double tour »), et il ne change pas pour elle.
 *
 * ## Aucune légendaire, pour l'instant
 *
 * Aucune n'est dessinée, et la fiche le dit : « pas de légendaire dans cette
 * série pour l'instant ». Le catalogue exige pourtant cinq légendaires par
 * série — avec raison, une série sans sommet donne des boosters qu'on ouvre
 * sans espoir. `catalogue-smoke.mjs` l'exempte donc **nommément**, et
 * l'exemption tombe d'elle-même le jour où la série en compte cinq.
 *
 * ## Le barème, celui des séries voisines
 *
 *   — chaque lignée monte `commune` → `rare` → `epique` ;
 *   — la puissance du cri suit : ~53 / ~66 / ~79, par la règle linéaire de
 *     `ages.js` (+13 par âge) ;
 *   — les modificateurs sont ceux de la famille, un bonus franc et un petit
 *     défaut qui se résorbe en grandissant (`modsAuStade`).
 *
 * Les deuxième et troisième âges ne sont écrits qu'en nom, histoire et cri,
 * dans `dex-ages.js` ; le reste s'en déduit.
 *
 * ## Les familles, et le geste des bâtons de sucre
 *
 * Les six premières lignées ont pris les six familles : la garde (fide), la
 * péniche (depl), le crieur de promenade (voix), le peintre d'enseignes
 * (tifo), la confiseuse (pyro), et la punk du grand boulevard (perc), qui bat
 * la mesure du talon de ses bottes sur le béton des marches. Les quatre
 * suivantes en reprennent quatre, une chacune, pour que la série reste
 * équilibrée : la coursière à vélo (depl), le gamin aux dinosaures de plâtre
 * (tifo), la danseuse aux grelots (perc) et le banlieusard au parapluie
 * (fide). La voix et la pyro passent en tête pour les suivantes.
 *
 * Les cinq d'après les rattrapent d'abord, puis en reprennent trois : la
 * ramendeuse du port (pyro), qui jette son filet pile quand la vague retombe ;
 * la gamine au moulinet (tifo) ; le gamin à la batte (fide), qui tient son
 * guichet sans frapper ; le gamin au cheval-bâton (depl), qui se balance
 * avant chaque haie ; et le petit livreur de lait (voix), qui fait sa tournée
 * au même pas tous les matins. La série compte alors trois lignées en fide,
 * depl et tifo, deux en voix, pyro et perc : ces trois-là passent en tête
 * pour les cinq dernières.
 *
 * Le geste de la confiseuse n'est pas libre. Les Pyro comptaient trente-deux
 * personnages de premier âge dont quatre aux `rouleaux` — pile le huitième que
 * `catalogue:smoke` exige d'une variante. Un trente-troisième Pyro au geste
 * éponyme aurait fait passer les rouleaux sous le plancher. Elle lance donc
 * ses bâtons de sucre par-dessus la rambarde, ce qui est exactement le geste,
 * et les rouleaux remontent à cinq sur trente-trois.
 *
 * Même calcul pour le gamin aux dinosaures : les Tifo comptaient cinquante-six
 * personnages de premier âge dont sept à l'`ola`, pile le huitième. Un
 * cinquante-septième au geste éponyme l'aurait fait passer dessous. Il lève
 * donc la vague — l'échine de plâtre qui se dresse d'un bout à l'autre de la
 * tribune —, et l'ola passe à huit sur cinquante-sept.
 */

/**
 * La série.
 *
 * `AN` comme ANgleterre : deux lettres, comme les treize autres, pour que
 * `racineDe` lise sans hésiter où finit la série et où commence le numéro.
 *
 * Le vert bouteille de la pelouse sous la pluie : c'est la seule couleur que
 * vingt clubs aux couleurs différentes ont en commun. Il reste à distance du
 * vert du Déplacement (`#1E9E6A`), plus clair et plus vif.
 */
export const SET_TERRACES = {
  id: 'AN',
  nom: 'LES TERRACES',
  ligne: 'debout sous le crachin, et le thé a déjà refroidi',
  c1: '#3B7A57',
  c2: '#0F1913',
};

/**
 * Les quinze premiers âges. Leurs suites sont dans `dex-ages.js`.
 *
 * `set` est posé une fois, en bas, comme dans `dex-saison.js` : quinze fois
 * le même mot, ce sont quinze occasions de l'oublier.
 */
const PREMIERS_AGES = [

  /* AN1 — la garde : le gamin qui donne ses miettes au seul corbeau qui ne
     s'envole pas, et qui finit par veiller sur toute la volée. Rouge vif,
     manches blanches. La fidélité tient : elle reste. */
  { id: 'AN1', nom: 'Le Petit Visiteur de la Tour', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Il était venu visiter la vieille forteresse un jour sans match. Un corbeau '
      + 's’est posé sur son épaule et n’en est plus reparti : depuis, ils vont au stade à '
      + 'deux, avec un sachet de miettes.',
    mods: { holdBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'UNE MIETTE CHACUN', gest: 'hold', power: 53 } },

  /* AN2 — le déplacement par les canaux : la péniche peinte de roses et de
     châteaux. Bordeaux et bleu ciel. */
  { id: 'AN2', nom: 'Le Gamin de l’Écluse', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Assis sur la porte de l’écluse, il regardait passer les péniches peintes en '
      + 'se demandant où elles allaient. Il l’a compris un samedi : à l’extérieur, à six '
      + 'kilomètres à l’heure.',
    mods: { breathBonus: 1.15, parryResist: 0.92 },
    cri: { label: 'ON ATTEND L’ÉCLUSE', gest: 'echarpe', power: 54 } },

  /* AN3 — la voix du bord de mer : le loueur de transats qui crie sa
     marchandise sous la pluie. Rayures rouges et noires. */
  { id: 'AN3', nom: 'Le Loueur de Transats', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Il loue des transats sur une promenade où il pleut neuf jours sur dix. Il '
      + 'les annonce quand même, à pleine voix, au rythme des vagues — et le dixième jour, '
      + 'il a raison.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'UN TRANSAT, MONSIEUR ?', gest: 'tempo', power: 53 } },

  /* AN4 — le tifo à la main : l'enseigne de pub peinte, sans une lettre.
     Rayures rouges et blanches. */
  { id: 'AN4', nom: 'Le Gamin du Comptoir', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Trop jeune pour entrer, il attend sur le trottoir que son père finisse sa '
      + 'pinte. Il regarde l’enseigne peinte grincer au vent, et il la recopie sur tout ce '
      + 'qu’il trouve.',
    mods: { parryBonus: 1.17, mashBonus: 0.91 },
    cri: { label: 'JE LA REPEINDRAI', gest: 'tifo', power: 52 } },

  /* AN5 — la pyro sucrée : le bâton de sucre rayé du front de mer, cuit au
     cuivre et lancé par-dessus la rambarde. Rayures bleues et blanches. Son
     défaut : le sucre coûte, et elle en donne plus qu'elle n'en vend. */
  { id: 'AN5', nom: 'La Gamine au Sucre d’Orge', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur la plage de galets, elle suce un bâton de sucre rayé plus long que sa '
      + 'main. Au but, elle lance tous ses bonbons par-dessus la rambarde, et elle le '
      + 'regrette jusqu’à la mi-temps.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'ATTENTION, ÇA COLLE', gest: 'rouleaux', power: 54 } },

  /* AN6 — la percussion des bottes : la lycéenne trop sage de la grande rue
     des boutiques, qui finit reine punk, épingles comprises. Bleu roi et
     blanc. Le petit baladeur à cassettes la suit jusqu'au troisième âge. Son
     défaut : elle tape si fort qu'elle s'essouffle avant le refrain. */
  { id: 'AN6', nom: 'La Timide du Grand Boulevard', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Elle remonte la grande rue des boutiques en uniforme, le blouson de cuir bleu '
      + 'plié sur le bras : elle n’ose pas encore le mettre. Dans son baladeur, une cassette '
      + 'prêtée, et le pied qui bat la mesure sans qu’elle s’en rende compte.',
    mods: { mashBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'J’OSE PAS ENCORE', gest: 'mash', power: 53 } },

  /* AN7 — le déplacement à vélo : la coursière qui crève sous la pluie et
     finit reine du vélodrome sur une roue géante. Bleu ciel et blanc. La
     petite sonnette de laiton la suit jusqu'au troisième âge. Elle fait
     tourner sa roue comme on fait tourner l'écharpe ; son défaut : elle part
     si vite qu'elle se fait surprendre au premier contre. */
  { id: 'AN7', nom: 'La Coursière à Vélo', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Elle livre des plis dans toute la ville, sous la pluie, et elle crève toujours '
      + 'au pied des trois clochers. Elle finit le chemin à pied jusqu’au stade, la roue sous '
      + 'le bras, la pompe à la main, et elle sourit quand même.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'ENCORE UNE CREVAISON', gest: 'echarpe', power: 53 } },

  /* AN8 — le tifo de plâtre : le gamin fasciné par les vieux dinosaures
     sculptés du parc, qui finit par en devenir un. Rayures rouges et bleues.
     Les lunettes rondes restent sur son nez jusqu'au troisième âge. Il lève
     la vague (voir l'en-tête) ; son défaut : il s'émerveille, et il oublie de
     souffler. */
  { id: 'AN8', nom: 'Le Gamin au Dinosaure en Plâtre', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Dans le vieux parc embrumé, il connaît chaque monstre de plâtre par son nom. '
      + 'Il garde une petite figurine rayée tout contre ses lunettes, et quand la tribune se '
      + 'lève, il la lève avec elle.',
    mods: { parryBonus: 1.17, breathBonus: 0.92 },
    cri: { label: 'ILS SONT VIVANTS', gest: 'ola', power: 52 } },

  /* AN9 — la percussion des grelots : la danseuse folklorique qu'on
     n'entendait que de loin, et dont les grelots finissent par faire trembler
     la tribune. Bleu et blanc. Le mouchoir blanc reste à sa ceinture jusqu'au
     troisième âge. Elle accélère à chaque refrain, d'où le crescendo ; son
     défaut : elle ne sait pas rester immobile. */
  { id: 'AN9', nom: 'La Danseuse aux Grelots', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Mouchoirs blancs, grelots aux tibias, baudriers bleus un peu de travers : elle '
      + 'débute dans la troupe de danse du village. On ne l’entend encore que de loin, mais '
      + 'elle accélère à chaque refrain.',
    mods: { mashBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'ÉCOUTEZ LES GRELOTS', gest: 'crescendo', power: 53 } },

  /* AN10 — la fidélité du parapluie : le monsieur du train de 7 h 42,
     toujours trop poli, qui finit par abriter tout le virage. Blanc et noir.
     La moustache blanche reste impeccable jusqu'au troisième âge. Il tient
     son parapluie sans jamais le lâcher trop tôt, d'où la tenue ; son
     défaut : il ne se presse jamais. */
  { id: 'AN10', nom: 'Le Banlieusard au Parapluie', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Il prend le train de 7 h 42 depuis trente ans, costume rayé, chapeau melon, '
      + 'parapluie blanc plié au bras. Il s’excuse quand on le bouscule, et il n’a jamais '
      + 'manqué un coup d’envoi.',
    mods: { holdBonus: 1.17, mashBonus: 0.91 },
    cri: { label: 'PARDON, EXCUSEZ-MOI', gest: 'tenue', power: 52 } },
  /* AN11 — la pyro du port : la ramendeuse qui raccommodait les filets sur le
     quai et finit par porter le grand chalut comme un manteau. Ambre et noir.
     Le petit filet noir reste à son bras jusqu'au troisième âge. Elle jette
     son filet à l'instant juste, d'où la visée ; son défaut : chaque maille
     lui coûte. */
  { id: 'AN11', nom: 'La Ramendeuse du Port', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur le quai mouillé, elle raccommode les filets maille après maille, l’aiguille '
      + 'de bois à la main. Elle ne lève les yeux qu’à l’instant où le bateau passe la jetée, '
      + 'et elle ne s’est jamais trompée d’une seconde.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'MAILLE APRÈS MAILLE', gest: 'visee', power: 53 } },

  /* AN12 — le tifo du vent : la gamine au moulinet de papier qui finit par
     porter un vrai moulin. Bleu et blanc. La farine reste sur sa joue jusqu'au
     troisième âge. Ses ailes dessinent la forme au-dessus de la tribune ; son
     défaut : elle tourne au vent, et elle perd le tempo. */
  { id: 'AN12', nom: 'La Gamine au Moulinet', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Elle courait contre le vent dans les champs, un moulinet de papier bleu et blanc '
      + 'tendu à bout de bras, de la farine plein la joue. Les jours de match, elle le fait '
      + 'tourner au-dessus de la tribune, et elle rit avant tout le monde.',
    mods: { parryBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'PLUS DE VENT !', gest: 'tifo', power: 53 } },

  /* AN13 — la fidélité du guichet : le gamin qui ratait toutes les balles sur
     la pelouse du village et finit capitaine de tout le comté. Blanc, jaune et
     bleu. La casquette bleue reste dans son casque jusqu'au troisième âge. Il
     tient son guichet sans frapper chaque balle, d'où la retenue ; son
     défaut : il garde son souffle pour plus tard. */
  { id: 'AN13', nom: 'Le Gamin à la Batte', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sur la pelouse du village, il rate toutes les balles avec une batte bien trop '
      + 'grande pour lui et une seule jambière. Il reste quand même au guichet jusqu’au soir, '
      + 'sans jamais lâcher, au cas où la prochaine serait la bonne.',
    mods: { holdBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'ENCORE UNE BALLE', gest: 'retenue', power: 53 } },

  /* AN14 — le déplacement au galop : le gamin au cheval-bâton qui finit dans
     un grand costume de cheval de pantomime. Rouge et blanc. Le petit
     cheval-bâton ne le quitte pas jusqu'au troisième âge. Il se balance
     d'avant en arrière avant chaque haie, d'où la bascule ; son défaut : il ne
     tient pas en place. */
  { id: 'AN14', nom: 'Le Gamin au Cheval-Bâton', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Il galope dans les rues sur un cheval-bâton à bonnet rouge, une casaque trop '
      + 'grande sur le dos, et il saute chaque bordure de trottoir comme une haie. Les jours '
      + 'de match, il fait tout le chemin jusqu’au stade au petit galop.',
    mods: { breathBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'HOP, UNE HAIE', gest: 'bascule', power: 54 } },

  /* AN15 — la voix de l'aube : le petit livreur de lait qui finit par porter
     toute la voiture de livraison. Bleu ciel, blanc et un peu de marine. La
     casquette plate reste sous le toit jusqu'au troisième âge. Il fait sa
     tournée au même pas tous les matins, d'où le tempo ; son défaut : il est
     encore à moitié endormi quand il faut frapper. */
  { id: 'AN15', nom: 'Le Petit Livreur de Lait', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'À l’aube, sous la pluie, il dépose quatre bouteilles de lait sur chaque perron, '
      + 'la casquette trempée, à moitié endormi. Il siffle toujours le même air, au même pas, '
      + 'et toute la rue se réveille en mesure.',
    mods: { tempoWindow: 1.16, mashBonus: 0.92 },
    cri: { label: 'LE LAIT, LE LAIT !', gest: 'tempo', power: 53 } },
];

export const DEX_TERRACES = PREMIERS_AGES.map((f) => ({ ...f, set: SET_TERRACES.id }));
