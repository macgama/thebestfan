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
 * Le 21 octobre, il en a voulu trois par club — une femme, un homme et une
 * créature (un animal ou un objet vivant de la ville) —, soit soixante
 * lignées. Les fiches (noms, histoires, invites des dessins) sont dans
 * `/mnt/project-files/fanzzy-prompts/AN-les-terraces.md` pour AN1 à AN20, et
 * dans `AN-les-terraces-2.md` pour les quarante autres : AN21 à AN40 le
 * second humain de chaque club, AN41 à AN60 les créatures, dans le même ordre
 * des clubs (`clubs.js`).
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
 * ## Trente lignées sur soixante, et pourquoi elle arrive fermée
 *
 * Les trente premières (AN1 à AN30) ont leurs dessins : trois cartes en
 * pied et cinq états par âge, en tenue de base (AN17 n'a encore que deux
 * états au deuxième âge, AN9, AN22, AN26 et AN29 quatre au premier : leurs
 * planches sont à refaire). Elles entrent par lots de cinq, à mesure que
 * leurs dessins arrivent : une lignée sans dessin aurait mis au catalogue une
 * silhouette procédurale. Les trente autres suivront de la même façon.
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
 * Les cinq dernières les rattrapent, et deux familles en prennent une de
 * plus : le gamin aux gants trop grands (perc), qui frappe par séries de
 * quatre comme au sac de sable, d'où les salves ; le gamin au pion (fide),
 * qui joue à la pendule sans jamais la laisser tomber, d'où la tenue ;
 * le gamin à l'arc en bois (pyro), qui bande l'arc et lâche au bon temps,
 * d'où la relance ; le gamin du fauteuil tournant (voix), qui reprend en écho
 * la chanson du salon ; et le gamin aux boutons (tifo), qui coud ses motifs
 * de nacre bouton par bouton, d'où la mosaïque. Les vingt premières finissent
 * à quatre lignées en fide et tifo, trois dans les quatre autres familles.
 *
 * Les seconds humains (AN21 à AN40) commencent par rattraper ces quatre-là :
 * la petite poinçonneuse (voix), qui fait monter toute la file à son signal,
 * d'où le capo ; la gamine à la bague en fer-blanc (pyro), qui vise le
 * moindre reflet à la loupe avant de poser sa goutte d'émail, d'où la
 * visée ; la gamine à la burette (perc), qui tape sur les tuyaux des deux
 * mains l'une après l'autre comme les pistons de la grande pompe, d'où les
 * deux voix ; et le gamin au petit train (depl), qui connaît par cœur chaque
 * arrêt de la ligne du bord de mer, d'où la mémoire. La gamine au ballon rouge
 * (pyro), qui compte jusqu'à trois avant de lâcher la ficelle, d'où le
 * compte, donne une lignée de plus à la Pyro, la famille la plus mince du
 * catalogue. Vingt-cinq lignées : cinq en pyro, quatre dans chacune des cinq
 * autres familles ; les suivantes reprennent par celles-là.
 *
 * Le lot suivant donne donc une lignée à chacune des cinq : le gamin au
 * masque de carton (tifo), qui lève son masque et toute la pièce lève le sien,
 * d'où l'ola ; le gamin à la montre démontée (voix), qui fait le tic-tac
 * lui-même entre les secondes, d'où le contretemps ; la gamine au cierge
 * magique (perc), qui tape du pied de plus en plus vite à chaque étincelle
 * jusqu'au bouquet final, d'où le crescendo ; le petit allumeur (fide), qui
 * tient à deux mains une perche trop grande sans la lâcher, d'où la garde ;
 * et la petite fouilleuse de vase (depl), à qui le fleuve rend à la marée
 * suivante ce qu'il a repris, d'où le miroir. Trente lignées : cinq dans
 * chacune des six familles. Les trois variantes prises étaient les plus
 * minces de leur famille (huit chacune), ce qui laisse de la marge aux lots
 * suivants.
 *
 * L'allumeur, lui, n'avait pas le choix : les Fidélités comptaient
 * quatre-vingt-quatre personnages de premier âge dont quarante-deux à la
 * garde (`hold`), pile la moitié. Un quatre-vingt-cinquième à une variante
 * aurait mis le geste éponyme en minorité, ce que `catalogue:smoke` refuse.
 *
 * La burette n'a pas le choix de son geste. Les Percussions comptaient
 * quarante-huit personnages de premier âge dont six aux `deuxvoix` — pile le
 * huitième. Une quarante-neuvième au geste éponyme aurait fait passer les
 * deux voix sous le plancher de `catalogue:smoke` ; elle les remonte à sept
 * sur quarante-neuf, ce qui laisse la place à une Percussion au martelage
 * dans le lot suivant.
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
 * Les trente premiers âges. Leurs suites sont dans `dex-ages.js`.
 *
 * `set` est posé une fois, en bas, comme dans `dex-saison.js` : trente fois
 * le même mot, ce sont trente occasions de l'oublier.
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

  /* AN16 — la percussion des poings : le gamin perdu dans des gants trop
     grands qui finit champion à l'ancienne, à la loyale. Rouge, blanc et
     noir. La moustache cirée reste jusqu'au troisième âge. Il frappe par
     séries de quatre, comme au sac de sable, d'où les salves ; son défaut :
     il s'emballe et perd la cadence. */
  { id: 'AN16', nom: 'Le Gamin aux Gants Trop Grands', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Les gants rouges lui arrivent aux coudes et il a peur de son ombre. Il lève quand '
      + 'même la garde, comme sur les vieilles photos, et il tape quatre fois de suite sur le sac '
      + 'du club de boxe, jamais plus, jamais moins.',
    mods: { mashBonus: 1.16, tempoWindow: 0.92 },
    cri: { label: 'GARDE HAUTE !', gest: 'salves', power: 53 } },

  /* AN17 — la fidélité de l'échiquier : le gamin au pion du jeu d'échecs
     géant du parc, qui finit roi noir et blanc. Rayures noir et blanc. Le
     petit pion blanc pend à sa ceinture jusqu'au troisième âge. Il joue à la
     pendule sans jamais laisser tomber son temps, d'où la tenue ; son défaut :
     il réfléchit avant de frapper. */
  { id: 'AN17', nom: 'Le Gamin au Pion', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sous la pluie du parc, il serre contre lui un grand pion blanc du jeu d’échecs '
      + 'géant, le seul qu’on lui laisse jouer. Il attend son tour sans bouger, une heure s’il le '
      + 'faut, et il n’a encore jamais perdu son pion.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'À MOI DE JOUER', gest: 'tenue', power: 52 } },

  /* AN18 — la pyro des fanions : le gamin qui jouait au hors-la-loi des
     vieilles ballades, en rouge et pas en vert, et dont les flèches portent
     des fanions au lieu de pointes. Rouge et blanc. La plume blanche reste à
     son capuchon jusqu'au troisième âge. Il bande l'arc, tient, et lâche au
     bon temps, d'où la relance ; son défaut : chaque flèche lui coûte. */
  { id: 'AN18', nom: 'Le Gamin à l’Arc en Bois', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Capuchon rouge trop grand, plume blanche, un petit arc de bois et des flèches '
      + 'au bout de feutre rouge : il joue au hors-la-loi des vieilles ballades dans la rue. Il '
      + 'vise longtemps, il rit avant de tirer, et le fanion retombe toujours pile dans le virage.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'TENEZ… ET LÂCHEZ !', gest: 'relance', power: 54 } },

  /* AN19 — la voix du salon : le gamin qui tournait sur le fauteuil du
     barbier en attendant son père et finit maître barbier. Rayures rouge et
     blanc. La moustache cirée reste jusqu'au troisième âge. Au salon, on
     chante à plusieurs voix et chacune reprend la phrase de l'autre, d'où
     l'écho ; son défaut : il rend moins qu'il ne prend. */
  { id: 'AN19', nom: 'Le Gamin du Fauteuil Tournant', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'Il tourne sur le vieux fauteuil du barbier en attendant son père, le petit poteau '
      + 'rayé sur les genoux et un peigne derrière l’oreille. Les clients chantent à plusieurs '
      + 'voix en attendant leur tour, et lui reprend chaque phrase juste après eux.',
    mods: { tempoWindow: 1.16, refundBonus: 0.92 },
    cri: { label: 'ET UN TOUR DE PLUS', gest: 'echo', power: 53 } },

  /* AN20 — le tifo de nacre : le gamin qui cousait des boutons de nacre sur
     sa casquette et finit roi des marchés, couvert de milliers de boutons
     qui brillent. Bleu marine et blanc. Les boutons blancs restent sur sa
     coiffe jusqu'au troisième âge. Il coud ses motifs bouton par bouton,
     d'où la mosaïque ; son défaut : il s'essouffle à la tâche. */
  { id: 'AN20', nom: 'Le Gamin aux Boutons', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Dans la rue du marché, il coud des boutons de nacre sur sa casquette marine, un '
      + 'par semaine, avec l’aiguille de sa grand-mère. Il n’en a encore que quatre, mais au '
      + 'soleil ils dessinent déjà une étoile.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'ENCORE UN BOUTON', gest: 'mosaique', power: 53 } },
  /* AN21 — la voix de l'impériale : la gamine qui jouait à poinçonner les
     tickets et finit receveuse en chef du bus à impériale, la cloche en main.
     Rouge vif et blanc. Les baskets rouges restent jusqu'au troisième âge.
     Elle fait monter toute la file à son signal, d'où le capo ; son défaut :
     elle ne tient pas en place. */
  { id: 'AN21', nom: 'La Petite Poinçonneuse', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'À l’arrêt de bus, sous la pluie, elle poinçonne des tickets de papier blanc avec '
      + 'sa petite machine rouge en bandoulière. Toute la file attend son signal pour monter, et '
      + 'personne ne monte avant qu’elle l’ait dit.',
    mods: { tempoWindow: 1.16, holdBonus: 0.92 },
    cri: { label: 'TOUT LE MONDE MONTE !', gest: 'capo', power: 53 } },

  /* AN22 — la pyro de l'émail : la gamine à la bague de pacotille qui finit
     reine des émaux du vieux quartier des bijoutiers. Bordeaux et bleu ciel.
     La bague de fer-blanc reste à son doigt jusqu'au troisième âge. Elle vise
     le moindre reflet à la loupe avant de poser sa goutte, d'où la visée ;
     son défaut : chaque goutte lui coûte. */
  { id: 'AN22', nom: 'La Gamine à la Bague en Fer-Blanc', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Dans l’atelier encombré du quartier des bijoutiers, elle lève une bague de '
      + 'fer-blanc à la lumière, la petite loupe remontée sur le front. Elle vise longtemps le '
      + 'moindre reflet avant de poser sa goutte d’émail, et elle ne la rate jamais.',
    mods: { perfectBonus: 1.17, costPenalty: 1.06 },
    cri: { label: 'PILE DANS LE SERTI', gest: 'visee', power: 54 } },

  /* AN23 — la pyro du grand ballon : la gamine au ballon rouge de la falaise
     qui finit aéronaute, sa nacelle d'osier autour de la taille. Rayures
     rouge et noir. Les baskets blanches restent jusqu'au troisième âge. Elle
     compte jusqu'à trois avant de lâcher la ficelle, d'où le compte ; son
     défaut : chaque envol lui coûte. */
  { id: 'AN23', nom: 'La Gamine au Ballon Rouge', type: 'pyro', stage: 1, rar: 'commune',
    histoire: 'Sur la falaise, dans le vent, elle serre la ficelle d’un petit ballon rayé rouge '
      + 'et noir. Elle compte jusqu’à trois avant chaque rafale, et le ballon monte toujours pile '
      + 'au bon moment, jamais avant.',
    mods: { perfectBonus: 1.18, costPenalty: 1.06 },
    cri: { label: 'TROIS, DEUX, UN…', gest: 'compte', power: 53 } },

  /* AN24 — la percussion des pistons : la gamine qui graissait tout ce qui
     grince et finit par devenir la grande machine à vapeur du bord du
     fleuve. Rayures rouge et blanc. Le foulard noué reste sur sa tête
     jusqu'au troisième âge. Elle frappe des deux mains l'une après l'autre,
     comme les deux pistons du balancier, d'où les deux voix ; son défaut :
     elle rend moins qu'elle ne prend. */
  { id: 'AN24', nom: 'La Gamine à la Burette', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Dans l’atelier humide, une trace de suie sur la joue, elle tient à deux mains une '
      + 'petite burette rouge et graisse tout ce qui grince. Puis elle tape sur les vieux tuyaux, '
      + 'une main après l’autre, comme les pistons de la grande pompe.',
    mods: { mashBonus: 1.16, refundBonus: 0.92 },
    cri: { label: 'ÇA NE GRINCE PLUS', gest: 'deuxvoix', power: 53 } },

  /* AN25 — le déplacement du bord de mer : le gamin au petit train de bois
     qui finit par marcher dans les vagues comme le vieux tram sur échasses.
     Rayures bleu et blanc. Les tongs restent à ses pieds jusqu'au troisième
     âge. Il connaît par cœur chaque arrêt de la ligne, d'où la mémoire ; son
     défaut : il frappe sans force. */
  { id: 'AN25', nom: 'Le Gamin au Petit Train', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'Sur la promenade, il fait rouler un petit train de bois dans le sable mouillé, une '
      + 'poignée de conduite au manche bleu dans l’autre main. Il connaît par cœur chaque arrêt de '
      + 'la ligne du bord de mer, et il les annonce tous, dans l’ordre.',
    mods: { breathBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'PROCHAIN ARRÊT, LA PLAGE', gest: 'memoire', power: 53 } },
  /* AN26 — le tifo du bal masqué : le gamin qui découpait des masques dans
     les boîtes de céréales et finit roi du grand bal costumé des artistes du
     quartier. Bleu roi et blanc. Les mocassins éraflés restent à ses pieds
     jusqu'au troisième âge. Il lève son masque et toute la pièce lève le
     sien, d'où l'ola ; son défaut : il se met en scène et oublie de souffler. */
  { id: 'AN26', nom: 'Le Gamin au Masque de Carton', type: 'tifo', stage: 1, rar: 'commune',
    histoire: 'Dans son petit appartement en désordre, il découpe des masques dans les boîtes de '
      + 'céréales et les peint en bleu roi. Quand il en lève un, tout le monde dans la pièce lève '
      + 'le sien après lui, l’un après l’autre, comme une vague.',
    mods: { parryBonus: 1.16, breathBonus: 0.92 },
    cri: { label: 'TOUT LE MONDE MASQUÉ !', gest: 'ola', power: 52 } },

  /* AN27 — la voix des horlogers : le gamin qui démontait la montre de son
     grand-père sans savoir la remonter et finit couvert de rouages qui
     tournent tous à l'heure. Bleu ciel et blanc. Les petites lunettes rondes
     cerclées de fer restent sur son nez jusqu'au troisième âge. Il fait le
     tic-tac lui-même entre les secondes, d'où le contretemps ; son défaut :
     il s'inquiète, et il ne tient pas la note. */
  { id: 'AN27', nom: 'Le Gamin à la Montre Démontée', type: 'voix', stage: 1, rar: 'commune',
    histoire: 'À la table de la cuisine, il a ouvert la montre de son grand-père et trois petits '
      + 'rouages sont tombés. Il ne sait pas la remonter, alors il fait le tic-tac lui-même, entre '
      + 'les secondes, pour qu’elle ne s’arrête pas.',
    mods: { tempoWindow: 1.15, holdBonus: 0.92 },
    cri: { label: 'TIC… ET TAC', gest: 'contretemps', power: 53 } },

  /* AN28 — la percussion du feu d'artifice : la gamine qui avait peur de son
     cierge magique et finit reine du grand feu d'artifice du parc. Rayures
     rouge et bleu. Le bonnet rouge à pompon reste sur sa tête jusqu'au
     troisième âge. Elle tape du pied de plus en plus vite à chaque étincelle,
     jusqu'au bouquet final, d'où le crescendo ; son défaut : elle tient mal
     la distance. */
  { id: 'AN28', nom: 'La Gamine au Cierge Magique', type: 'perc', stage: 1, rar: 'commune',
    histoire: 'Par un soir de brume, dans le parc, elle tient son cierge magique à bout de bras, '
      + 'morte de peur. Mais à chaque étincelle elle tape du pied un peu plus vite, et quand il '
      + 's’éteint, elle danse.',
    mods: { mashBonus: 1.15, holdBonus: 0.92 },
    cri: { label: 'ENCORE UNE ÉTINCELLE', gest: 'crescendo', power: 53 } },

  /* AN29 — la fidélité des réverbères : le gamin qui courait derrière
     l'allumeur et finit par allumer toutes les lumières de la colline. Bleu
     et blanc. La vieille casquette plate reste sur sa tête jusqu'au troisième
     âge. Il tient à deux mains une perche trop grande sans jamais la lâcher,
     d'où la garde (voir l'en-tête) ; son défaut : il frappe sans force. */
  { id: 'AN29', nom: 'Le Petit Allumeur', type: 'fide', stage: 1, rar: 'commune',
    histoire: 'Sur les pavés, à la tombée du jour, il court derrière l’allumeur de réverbères '
      + 'avec une perche bleue bien trop grande pour lui. Il la tient à deux mains, la petite '
      + 'flamme tremble, mais il ne la lâche pas avant que toute la rue soit allumée.',
    mods: { holdBonus: 1.16, mashBonus: 0.92 },
    cri: { label: 'JE LA TIENS !', gest: 'hold', power: 52 } },

  /* AN30 — le déplacement de la grève : la gamine qui fouillait la vase à
     marée basse et finit reine des trésors que le fleuve rend. Blanc et
     noir. Les bottes de caoutchouc noires restent à ses pieds jusqu'au
     troisième âge. Le fleuve lui rend à la marée suivante ce qu'il a repris,
     d'où le miroir ; son défaut : elle se laisse surprendre au premier
     contre. */
  { id: 'AN30', nom: 'La Petite Fouilleuse de Vase', type: 'depl', stage: 1, rar: 'commune',
    histoire: 'À marée basse, sur la rive boueuse du fleuve, elle remplit son petit seau blanc de '
      + 'ce que l’eau a laissé : un bout de pipe en terre, un bouton, une clé. Le fleuve reprend '
      + 'tout à la marée haute, et le lui rend à la suivante.',
    mods: { breathBonus: 1.16, parryResist: 0.92 },
    cri: { label: 'CE QUE LE FLEUVE REND', gest: 'miroir', power: 53 } },
];

export const DEX_TERRACES = PREMIERS_AGES.map((f) => ({ ...f, set: SET_TERRACES.id }));
