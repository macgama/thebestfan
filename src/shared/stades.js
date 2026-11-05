/**
 * Les stades.
 *
 * Cinq lieux, vus du dessus. Ils servent de décor au Grand Virage et au duel,
 * et ils se collectionnent — mais **ils ne se portent pas**.
 *
 * ## La règle, et pourquoi elle n'est pas négociable
 *
 * Le jeu tient sur deux principes écrits dans `inventaire.js` : un skin ne
 * donne aucun bonus, et chaque pièce d'équipement a un revers. Les deux disent
 * la même chose — « un débutant qui chante juste bat un vétéran mal équipé ».
 *
 * Un stade qui donnerait un avantage à son propriétaire serait la première
 * chose du jeu à donner de la puissance **sans que l'adversaire l'ait
 * choisie**. On équipe son Fanzzy en sachant ce qu'on y perd ; on ne choisit
 * pas de jouer chez quelqu'un.
 *
 * Le stade appartient donc **au match**, jamais à un joueur : au Grand Virage
 * comme en duel, il vient du vrai match, et tous les duels d'un match se
 * jouent dans le stade de son Virage (décision de Gaël, 6 octobre 2026 ; le
 * tirage vit dans `stadeDuMatch`, `src/server/contenus/index.js`). Le duel
 * devait le tirer parmi ceux que **les deux** joueurs possèdent : ça n'a
 * jamais été écrit — il le tirait sur son propre identifiant —, et un lieu
 * qui dépendrait de l'adversaire ne se connaîtrait qu'après l'appariement,
 * quand la préparation du duel l'annonce avant l'entrée en file.
 *
 * Son effet s'applique aux deux camps. Collectionner n'achète pas de la force,
 * ni le lieu : il change avec les matchs, et avec lui les situations qu'un
 * deck doit savoir affronter. C'est une profondeur, pas un palier.
 *
 * ## Ce qu'un effet a le droit de faire
 *
 * Changer **la même règle pour tout le monde**. L'altitude raccourcit le
 * souffle des deux tribunes ; la poussière rend les cartes de poussée un peu
 * plus fortes, des deux côtés. Ce qui se départage ensuite, c'est qui a
 * construit le bon deck pour ce lieu-là — exactement ce que raconte déjà le
 * commentaire en tête de `actions.js` : « deux tribunes qui poussent pareil se
 * départagent sur le moment où elles jouent leurs cartes. »
 *
 * `mods` emploie le même vocabulaire que les Fanzzy, l'équipement et les KOP :
 * `breathBonus`, `pushMult`, `tempoWindow`… Le moteur ne sait pas d'où vient
 * un modificateur, et c'est ce qui permet d'en ajouter un sans le toucher.
 */

export const STADES = [
  {
    id: 'chaudron',
    nom: 'Le Chaudron',
    rar: 'commune',
    texte: 'Les tribunes sont à trois mètres de la touche. Tout s’entend, tout porte.',
    /* Une enceinte serrée renvoie le son : les deux tribunes poussent un peu
       plus fort, et les deux s'épuisent un peu plus vite. Un lieu où les
       matchs se jouent plus court. */
    mods: { pushMult: 1.08, breathBonus: 0.94 },
    effet: 'Tout le monde pousse plus fort, et se fatigue plus vite.',
  },
  {
    id: 'montagne',
    nom: 'Le Nid d’Aigle',
    rar: 'rare',
    texte: 'Mille six cents mètres, la neige sur les toits, et l’air qui manque.',
    /* L'altitude. Le souffle revient plus lentement pour tout le monde : les
       cartes qui rendent du souffle — Thermos, Collecte — y valent bien plus
       cher que leur coût ne le dit. */
    mods: { breathBonus: 0.8 },
    effet: 'L’air est rare : le souffle revient bien plus lentement, des deux côtés.',
  },
  {
    id: 'arene',
    nom: 'L’Arène',
    rar: 'rare',
    texte: 'Un bol fermé, un toit de verre, et pas un souffle d’air qui entre.',
    /* Le lieu neutre par excellence : rien ne gêne, rien n'aide. Le geste y
       est plus facile à placer, et c'est tout — un stade où l'écart se fait
       sur le deck et rien d'autre. */
    mods: { tempoWindow: 1.12 },
    effet: 'Rien ne perturbe le rythme : la fenêtre de tempo est plus large pour tous.',
  },
  {
    id: 'poussiere',
    nom: 'La Poussière',
    rar: 'epique',
    texte: 'La terre rouge monte dans les projecteurs et ne redescend jamais.',
    /* Un lieu bruyant et sec. Les gestes y sont plus durs à placer, mais un
       geste réussi porte beaucoup plus loin : le stade des joueurs qui
       préfèrent une grosse carte à dix petites. */
    mods: { tempoWindow: 0.88, perfectBonus: 1.25 },
    effet: 'Le rythme est difficile à tenir, mais un geste parfait paie double.',
  },
  {
    id: 'piste',
    nom: 'La Piste',
    rar: 'commune',
    texte: 'Une piste d’athlétisme entre la foule et le terrain. Le son se perd en route.',
    /* La tribune est loin. Tout est atténué — c'est le stade où le nombre
       compte plus que le geste, et où un Appel du capo change tout. */
    mods: { pushMult: 0.9, ferveurBonus: 1.1 },
    effet: 'La foule est loin : on pousse moins, mais la ferveur se gagne plus vite.',
  },

  /* ------------------------------------------------------- cinq lieux de plus

     Cinq stades pour dix, et c'était peu : en duel comme au Virage, le lieu se
     tire sur l'identifiant de la rencontre, donc un joueur revoyait le même
     décor un soir sur cinq. Dix lieux, c'est une saison sans se répéter.

     Chacun change **une** règle, ou deux au plus. Un stade qui toucherait à
     quatre choses ne s'apprendrait pas : le joueur doit pouvoir lire le nom du
     lieu et savoir ce qu'il va devoir faire autrement.                      */

  {
    id: 'tole',
    nom: 'Le Toit de Tôle',
    rar: 'rare',
    texte: 'Une casquette de tôle ondulée au-dessus du virage. Le bruit ne sort pas.',
    /* Le contraire du Chaudron : ça ne porte pas plus loin, ça revient sur
       soi. On s'entend pousser et on ne s'entend plus compter — la fenêtre se
       ferme et la poussée grossit. Le stade des cartes brutales. */
    mods: { pushMult: 1.14, tempoWindow: 0.86 },
    effet: 'On s’entend pousser, on ne s’entend plus compter : le rythme devient dur à tenir.',
  },
  {
    id: 'marin',
    nom: 'Le Bord de Mer',
    rar: 'rare',
    texte: 'Le vent de travers entre par la tribune ouverte et emporte la moitié des chants.',
    /* Le vent défait les gestes propres et lave la fatigue. Un lieu qui
       récompense le nombre plutôt que la précision : dix chants moyens y
       valent mieux qu'un geste parfait. */
    mods: { perfectBonus: 0.82, breathBonus: 1.22 },
    effet: 'Le vent emporte les beaux gestes et rend le souffle plus vite, pour tous.',
  },
  {
    id: 'huisclos',
    nom: 'Le Stade Vide',
    rar: 'epique',
    texte: 'Huis clos. On entend le ballon, les crampons, et chaque fausse note.',
    /* Sans foule pour couvrir, tout s'entend : le geste est facile à placer —
       plus rien ne masque le rythme — mais la ferveur ne monte pas, faute de
       monde pour la porter. Le lieu où l'on joue juste et où l'on gagne peu. */
    mods: { tempoWindow: 1.3, ferveurBonus: 0.7 },
    effet: 'Rien ne couvre le rythme, et rien ne le porte non plus : la ferveur monte à peine.',
  },
  {
    id: 'neige',
    nom: 'La Neige',
    rar: 'epique',
    texte: 'Les lignes ont été repassées en bleu trois fois. On ne les voit déjà plus.',
    /* Tout est lent. On a le temps de voir venir un contre — donc d'y
       résister — et on a moins d'occasions de chanter. Le stade des parties
       longues, où l'écart se creuse par petites touches. */
    mods: { tempoInterval: 130, parryResist: 1.3 },
    effet: 'Tout est ralenti : moins d’occasions de chanter, mais les contres portent moins.',
  },
  {
    id: 'annexe',
    nom: 'Le Terrain Annexe',
    rar: 'commune',
    texte: 'Deux cents personnes le long d’une main courante. Tout le monde se connaît.',
    /* Personne, mais tout le monde compte. La poussée est faible et chaque
       carte revient vite : un lieu où l'on joue beaucoup de petites choses, et
       le seul où une main entière peut se jouer deux fois. */
    mods: { pushMult: 0.86, refundBonus: 1.35 },
    effet: 'On pousse peu, mais le souffle dépensé revient bien mieux.',
  },

  /* ================================================== LA REPRISE (5)

     ## Ce qu'un lieu de reprise a de particulier

     La première journée ne se joue pas dans un stade prêt. La pelouse a été
     refaite en juillet et personne ne l'a encore usée ; une tribune est sous
     bâche parce que les travaux ont pris du retard ; il fait trente degrés un
     dimanche de fin août sur un gradin sans toit. Ce sont des lieux **en
     chantier**, et c'est ce qu'il faut qu'on sente.

     ## La règle, inchangée et non négociable

     Un stade appartient au match, jamais à un joueur : en duel comme au
     Virage, il est celui du match, et son effet s'applique aux deux camps.
     Ces cinq-là changent donc la même règle pour tout le monde. Ce qui
     départage ensuite, c'est qui a construit le bon deck pour ce lieu — pas qui
     l'a collectionné.

     ## Aucun n'est écrit « en mieux »

     Chacun **ouvre une porte et en ferme une**. Un lieu qui ne ferait que
     donner serait un lieu que tout le monde voudrait tirer, et le tirage
     cesserait d'être une situation pour devenir une récompense.               */

  {
    id: 'rp-pelouse',
    nom: 'La Pelouse Neuve',
    rar: 'commune',
    texte: 'Refaite en juillet, pas encore usée. Personne n’ose vraiment appuyer.',
    /* Un terrain neuf se joue prudemment : les gestes sont plus propres, les
       poussées plus timides. Les deux tribunes retiennent leur coup. */
    mods: { perfectBonus: 1.14, pushMult: 0.93 },
    effet: 'Les gestes parfaits rapportent plus, mais tout le monde pousse moins fort.',
  },
  {
    id: 'rp-travaux',
    nom: 'La Tribune en Travaux',
    rar: 'rare',
    texte: 'Un quart du virage est fermé. On s’entasse dans le reste.',
    /* Serrés, on s'entend de tout près et l'on se relaie mal : le contre porte,
       le souffle ne revient pas. */
    mods: { parryBonus: 1.28, breathBonus: 0.88 },
    effet: 'Entassés : on se contre bien mieux, et l’on récupère mal.',
  },
  {
    id: 'rp-canicule',
    nom: 'Le Dernier Dimanche d’Août',
    rar: 'rare',
    texte: 'Trente degrés sur un gradin sans toit. Le chant sort, il ne tient pas.',
    /* La chaleur : on part fort et on ne dure pas. Le martelage y gagne, tout
       ce qui demande de durer y perd. */
    mods: { mashBonus: 1.26, holdBonus: 0.82, breathBonus: 0.9 },
    effet: 'On démarre fort et l’on ne tient rien : le martelage gagne, l’endurance s’effondre.',
  },
  {
    id: 'rp-bache',
    nom: 'Le Virage sous Bâche',
    rar: 'epique',
    texte: 'La bâche du tifo n’est pas descendue. On chante derrière, sans rien voir.',
    /* On ne voit pas le terrain : le rythme se perd, mais rien ne se lit non
       plus de l'autre côté. Un lieu où l'on joue à l'oreille. */
    mods: { tempoWindow: 0.8, parryResist: 1.45, tempoInterval: 80 },
    effet: 'À l’aveugle : le rythme est bien plus dur à tenir, et personne ne se fait contrer.',
  },
  {
    id: 'rp-inauguration',
    nom: 'L’Inauguration',
    rar: 'legendaire',
    texte: 'Nouveau nom sur le fronton, nouveau virage, et pas une habitude en commun.',
    /* Tout est neuf, y compris les repères : on pousse comme jamais, et rien de
       ce qu'on savait faire ne sert. Le lieu le plus violent des quinze, dans
       les deux sens. */
    mods: { pushMult: 1.35, ferveurBonus: 1.2, tempoWindow: 0.78, refundBonus: 0.8 },
    effet: 'Tout le monde pousse comme jamais, et plus personne n’a ses repères.',
  },

  /* ------------------------------------------------------ les trois époques

     Un lieu par époque des tenues — Halloween, la préhistoire, l'après —
     et la même règle que les quinze d'avant : chacun ouvre une porte et en
     ferme une, pour les deux tribunes à la fois. Ils n'ont aucun lien avec
     la tenue portée : un Fanzzy préhistorique ne joue pas mieux à la
     caverne. Ce serait la première fois qu'une tenue donne de la force. */
  {
    id: 'citrouilles',
    nom: 'La Nuit des Citrouilles',
    rar: 'rare',
    texte: 'Le brouillard du 31 recouvre les gradins. On ne voit plus l’autre tribune, on l’entend.',
    /* La peur rend prudent : on contre tout ce qui vient, et l'on ose moins
       le geste parfait. */
    mods: { parryBonus: 1.22, perfectBonus: 0.88 },
    effet: 'La nuit fait peur : on se contre bien mieux, et les gestes parfaits rapportent moins.',
  },
  {
    id: 'caverne',
    nom: 'L’Arène des Cavernes',
    rar: 'rare',
    texte: 'Des gradins taillés dans la roche. Le moindre chant revient trois fois.',
    /* La pierre résonne : ce qui se tient porte loin, et la résonance
       ralentit tout le reste. Un lieu pour les voix longues. */
    mods: { holdBonus: 1.2, tempoInterval: 70 },
    effet: 'La pierre résonne : les chants tenus portent plus loin, et le rythme ralentit.',
  },
  {
    id: 'ruines',
    nom: 'Le Stade d’Après',
    rar: 'epique',
    texte: 'Un toit effondré, deux projecteurs qui tiennent encore, et plus rien à perdre.',
    /* Plus rien à perdre : on pousse plus fort, et rien de ce qu'on dépense
       ne revient. */
    mods: { pushMult: 1.15, refundBonus: 0.8 },
    effet: 'Plus rien à perdre : chaque poussée porte plus loin, et rien ne se récupère.',
  },

  /* ================================================== LES TERRACES (5)

     Cinq lieux pour la série AN (demande de Gaël du 3 novembre 2026). Le
     préfixe `an-` les range d'eux-mêmes sous LES TERRACES dans /admin, comme
     `rp-` le fait pour LA REPRISE. Ce sont des stades **anglais** sans être
     ceux d'un club : aucun nom, aucun écusson — la pluie fine, la terrace
     debout, le match du lendemain de Noël, le stade coincé entre les maisons
     de briques et la vieille tribune qu'on démolit.

     Ils naissent **fermés** (`publie: false`), comme les pièces `an-` de
     l'équipement : ils s'ouvrent avec la série, dans la BASE ou dans un PASS.
     Et la règle ne change pas : chacun ouvre une porte et en ferme une, pour
     les deux tribunes à la fois.                                            */
  {
    id: 'an-crachin',
    nom: 'Le Crachin',
    rar: 'commune',
    publie: false,
    texte: 'Il pleut depuis le coup d’envoi, finement, sans jamais s’arrêter. Personne ne bouge.',
    /* La pluie fine colle au chant : ce qui se tient porte loin, mais le
       rythme glisse sous les pieds. */
    mods: { holdBonus: 1.15, tempoWindow: 0.9 },
    effet: 'La pluie fine porte les chants tenus, et fait glisser le rythme.',
  },
  {
    id: 'an-terrace',
    nom: 'La Terrace Debout',
    rar: 'rare',
    publie: false,
    texte: 'Pas un siège : des marches de béton et des barrières d’acier où l’on s’appuie à dix.',
    /* Debout et serrés, on pousse ensemble et on se répond de tout près :
       la poussée grossit, et chaque contre porte. */
    mods: { pushMult: 1.12, parryBonus: 1.15 },
    effet: 'Debout contre les barrières : on pousse plus fort, et l’on se contre mieux.',
  },
  {
    id: 'an-lendemain',
    nom: 'Le Lendemain de Noël',
    rar: 'rare',
    publie: false,
    texte: 'Midi, le 26 décembre. Tout le monde est venu, et personne n’a vraiment dormi.',
    /* Le match où toute la famille vient : la ferveur monte d'elle-même,
       et le souffle revient mal après la veille. */
    mods: { ferveurBonus: 1.18, breathBonus: 0.88 },
    effet: 'Tout le monde est là : la ferveur monte vite, mais le souffle revient mal.',
  },
  {
    id: 'an-briques',
    nom: 'La Rue de Briques',
    rar: 'epique',
    publie: false,
    texte: 'Le stade tient entre deux rangées de maisons. On regarde le match depuis les fenêtres.',
    /* Un quartier entier qui se connaît : on se relaie, chaque souffle
       dépensé revient — mais on n'y frappe pas fort, on chante ensemble. */
    mods: { refundBonus: 1.25, mashBonus: 0.85 },
    effet: 'Tout le quartier se relaie : le souffle dépensé revient mieux, le martelage porte moins.',
  },
  {
    id: 'an-derniere',
    nom: 'La Dernière Terrace',
    rar: 'legendaire',
    publie: false,
    texte: 'La vieille tribune sera démolie lundi. Ce soir, on y chante une dernière fois.',
    /* L'adieu : on pousse et on tient comme jamais, et l'on n'a plus de
       souffle ni de repères. Le pendant de L'Inauguration, dans l'autre sens. */
    mods: { pushMult: 1.3, holdBonus: 1.2, breathBonus: 0.85, tempoWindow: 0.82 },
    effet: 'Un dernier soir : tout le monde pousse et tient comme jamais, et plus personne ne souffle.',
  },

  /* ============================================ LES PHÉNOMÈNES MÉTÉO (5)

     Cinq lieux pour la série MT, celle du PASS 2 (demande de Gaël du
     5 novembre 2026 : cinq stades par série). Le préfixe `mt-` les range
     avec la série, comme ses pièces d'équipement. La neige, le vent de mer,
     le crachin, la canicule et le givre ont déjà leur lieu : ceux-ci prennent
     le reste du ciel — la giboulée, le brouillard, la grêle, l'orage et
     l'arc-en-ciel. La pelouse reste verte et les tribunes dans l'ombre,
     comme partout.

     Fermés (`publie: false`) jusqu'au PASS 2 ; chacun ouvre une porte et en
     ferme une, pour les deux tribunes à la fois.                           */
  {
    id: 'mt-giboulee',
    nom: 'La Giboulée',
    rar: 'commune',
    publie: false,
    texte: 'Soleil, averse, soleil. Le virage ouvre et ferme ses capuches toutes les cinq minutes.',
    /* Le temps change sans arrêt : on reprend son souffle aux éclaircies,
       mais personne ne tient un rythme d'un bout à l'autre. */
    mods: { breathBonus: 1.12, tempoWindow: 0.9 },
    effet: 'Les éclaircies rendent le souffle, mais le rythme change sans prévenir.',
  },
  {
    id: 'mt-brouillard',
    nom: 'Le Brouillard',
    rar: 'rare',
    publie: false,
    texte: 'On ne voit plus le but d’en face. On devine le match au bruit de l’autre tribune.',
    /* On ne voit plus l'autre camp : on se contre mal, faute de le lire,
       et l'on chante pour soi, longtemps. */
    mods: { parryBonus: 0.85, holdBonus: 1.15 },
    effet: 'On ne voit plus l’autre tribune : on se contre mal, et les chants tenus portent loin.',
  },
  {
    id: 'mt-grele',
    nom: 'La Grêle',
    rar: 'rare',
    publie: false,
    texte: 'Les grêlons rebondissent sur la pelouse et tambourinent sur les toits. On chante plus fort que le ciel.',
    /* Le vacarme des grêlons : on martèle pour se faire entendre, et l'on
       n'a plus le calme d'un geste parfait. */
    mods: { mashBonus: 1.22, perfectBonus: 0.88 },
    effet: 'Il faut couvrir le vacarme : le martelage gagne, les gestes parfaits rapportent moins.',
  },
  {
    id: 'mt-orage',
    nom: 'L’Orage',
    rar: 'epique',
    publie: false,
    texte: 'Un éclair, et tout le stade compte jusqu’au tonnerre. Puis il repart, plus fort.',
    /* L'électricité dans l'air : la ferveur monte d'un coup et la poussée
       avec elle, mais ce qu'on dépense ne revient pas. */
    mods: { ferveurBonus: 1.2, pushMult: 1.08, refundBonus: 0.8 },
    effet: 'L’air est chargé : la ferveur et la poussée montent, et rien de ce qu’on dépense ne revient.',
  },
  {
    id: 'mt-arc-en-ciel',
    nom: 'L’Arc-en-Ciel',
    rar: 'legendaire',
    publie: false,
    texte: 'La pluie s’arrête à la dernière minute et un arc-en-ciel tombe pile sur le rond central.',
    /* Le moment que tout le monde regarde : on tient et on pousse comme
       jamais, et l'on en oublie de compter. Le pendant météo de la Dernière
       Terrace. */
    mods: { pushMult: 1.25, holdBonus: 1.2, tempoWindow: 0.8, breathBonus: 0.9 },
    effet: 'Tout le stade lève la tête : on pousse et on tient comme jamais, et plus personne ne compte.',
  },

  /* ================================================== LE PARCAGE (5)

     Cinq lieux pour la série de Ligue 1, celle du PASS 2 (demande de Gaël du
     5 novembre 2026). Des stades **français** sans être ceux d'un club :
     aucun nom, aucun écusson, aucune couleur d'équipe — le petit stade du
     Sud sous les platanes, le tifo géant en cartons, le stade au pied du
     terril, la nuit de coupe chez l'amateur et le soir de derby.

     Préfixe `fr-`, le code de la série LE PARCAGE (nom choisi par Gaël le
     5 novembre 2026). Fermés jusqu'au PASS 2.                     */
  {
    id: 'fr-platanes',
    nom: 'Les Platanes',
    rar: 'commune',
    publie: false,
    texte: 'Un petit stade du Sud bordé de platanes. Les cigales chantent plus fort que la tribune.',
    /* La chaleur douce d'un soir du Sud : on a le temps de reprendre son
       souffle, et personne ne pousse vraiment. */
    mods: { breathBonus: 1.15, pushMult: 0.92 },
    effet: 'On reprend son souffle à l’ombre, mais personne ne pousse vraiment.',
  },
  {
    id: 'fr-tifo',
    nom: 'Le Tifo Géant',
    rar: 'rare',
    publie: false,
    texte: 'Un carton sur chaque siège, et tout le virage les lève au même moment.',
    /* Tout le monde ensemble au même signal : le geste juste rapporte
       plus, et celui qui chante à côté du temps se fait vite entendre. */
    mods: { perfectBonus: 1.15, tempoWindow: 0.9 },
    effet: 'Tous au même signal : les gestes parfaits rapportent plus, mais le rythme se tient plus serré.',
  },
  {
    id: 'fr-terril',
    nom: 'Le Pied du Terril',
    rar: 'rare',
    publie: false,
    texte: 'Derrière la tribune de briques, la colline noire de l’ancienne mine. Ici, on chante pour ceux d’avant.',
    /* Une tribune qui ne lâche rien : les chants tenus portent loin, mais
       elle chante lentement, sans se presser. */
    mods: { holdBonus: 1.18, tempoInterval: 75 },
    effet: 'Une tribune qui ne lâche rien : les chants tenus portent, et le rythme ralentit.',
  },
  {
    id: 'fr-coupe',
    nom: 'La Nuit de Coupe',
    rar: 'epique',
    publie: false,
    texte: 'Le club du village reçoit un grand. Tribunes en tubes montées pour l’occasion, et tout le canton dedans.',
    /* Le petit contre le grand : chaque carte revient vite et la ferveur
       monte, mais les tribunes provisoires ne portent pas la poussée. */
    mods: { refundBonus: 1.25, ferveurBonus: 1.1, pushMult: 0.88 },
    effet: 'Tout le canton est là : le souffle revient et la ferveur monte, mais la poussée porte moins.',
  },
  {
    id: 'fr-derby',
    nom: 'Le Soir de Derby',
    rar: 'legendaire',
    publie: false,
    texte: 'La ville est coupée en deux depuis une semaine. Ce soir, on saura qui a raison.',
    /* Le match de l'année : tout le monde pousse et contre comme jamais, et
       personne n'a plus le souffle ni la tête à compter. */
    mods: { pushMult: 1.3, parryBonus: 1.2, breathBonus: 0.85, tempoWindow: 0.82 },
    effet: 'Le match de l’année : on pousse et on se contre comme jamais, et plus personne ne souffle.',
  },
];

export const STADE_BY_ID = new Map(STADES.map((s) => [s.id, s]));

/** Le stade par défaut : celui où l'on joue quand personne n'en possède. */
export const STADE_DEFAUT = 'chaudron';

/**
 * Le stade d'une rencontre.
 *
 * **Il appartient au match.** La fonction sait le tirer parmi ceux que les
 * deux camps possèdent — c'était la règle prévue pour le duel : un joueur qui
 * collectionne n'y emportait jamais un avantage, il ouvrait des lieux où la
 * rencontre *pouvait* se tenir. Aucun appelant ne lui passe de possessions :
 * le Virage et tous les duels d'un match le tirent sur le seul identifiant du
 * match, par `stadeDuMatch` (côté serveur), pour qu'un duel se joue dans le
 * stade de son Virage et que la préparation l'annonce avant l'appariement
 * (décision de Gaël, 6 octobre 2026).
 *
 * L'intersection et non la réunion : jouer dans un stade que l'adversaire n'a
 * jamais vu serait lui imposer une règle qu'il ne connaît pas. Si
 * l'intersection est vide — personne n'a rien, ou rien en commun — on retombe
 * sur le stade de départ, que tout le monde possède.
 *
 * `jouables` est la troisième condition, et la seule qui vienne de la base :
 * les stades qu'une saison a ouverts. Elle est **facultative** parce que ce
 * fichier est partagé et ne connaît ni le pool ni les saisons — c'est
 * l'appelant, côté serveur, qui la lui donne. Sans elle, les quinze sont
 * tirables : c'est l'état d'avant, et le bon repli pour une base où
 * `sql/contenus.sql` n'est pas appliqué.
 *
 * Le stade de départ échappe au filtre. Il est le repli de tous les autres
 * replis, et une saison qui le fermerait par mégarde laisserait les rencontres
 * sans aucun lieu où se tenir.
 *
 * @param possessions  un tableau par camp : les identifiants possédés.
 * @param graine       un nombre stable — l'identifiant du match, celui d'un
 *   duel sans match en repli — pour que les deux clients tirent le même stade
 *   sans se parler.
 * @param jouables     un Set d'identifiants ouverts, ou `null` pour tous.
 */
export function stadeDeLaRencontre(possessions, graine = 0, jouables = null) {
  const ouverts = jouables
    ? STADES.filter((s) => s.id === STADE_DEFAUT || jouables.has(s.id))
    : STADES;
  const listes = (possessions ?? []).map((p) => new Set(p ?? []));
  let communs = ouverts.filter((s) => s.id === STADE_DEFAUT
    || listes.every((l) => l.has(s.id)));
  if (!listes.length) communs = ouverts;
  if (!communs.length) return STADE_BY_ID.get(STADE_DEFAUT);
  const n = Math.abs(Math.floor(Number(graine) || 0)) % communs.length;
  return communs[n];
}
