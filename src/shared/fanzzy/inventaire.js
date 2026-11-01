/**
 * Skins et équipement.
 *
 * Deux règles tiennent tout l'équilibre du jeu, et elles ne sont pas
 * négociables une fois des joueurs en ligne :
 *
 *   1. Un skin ne donne aucun bonus. Il change l'apparence, rien d'autre.
 *      C'est ce qui se collectionne le plus volontiers, et ça ne déséquilibre
 *      rien — celui qui ouvre mille paquets est plus beau, pas plus fort.
 *
 *   2. Chaque pièce d'équipement a un revers. Deux emplacements au maximum.
 *      Un joueur équipé n'est pas plus fort, il joue autrement, et il doit
 *      choisir. Un débutant qui chante juste bat un vétéran mal équipé.
 */

import { reglage } from '../reglages.js';

/**
 * L'amorçage des tenues.
 *
 * **Ce n'est plus le catalogue.** Il vit en base, dans la table `tenues`, et se
 * gère depuis l'administration : ajouter un thème ne doit pas demander un
 * déploiement. Cette liste sert à peupler une base neuve, et à rien d'autre —
 * comme `dex.js` pour les Fanzzy.
 *
 * Les six thèmes d'origine y restent avec `publie: false`. Ils ne se tirent
 * plus, mais dix-neuf joueurs en possèdent : les effacer confisquerait des
 * tenues gagnées, et laisserait la fiche chercher un identifiant disparu.
 * **Rien ne se supprime, on dépublie** — c'est la règle du catalogue Fanzzy, et
 * elle vaut ici pour la même raison.
 */
export const SKINS = [
  { id: 'base', nom: 'Tenue de base', rar: 'commune', pour: '*',
    texte: 'Ce qu’il porte tous les samedis.' },
  { id: 'prehistorique', nom: 'Préhistorique', rar: 'epique', pour: '*',
    texte: 'Le virage avant le virage. Peaux de bête et cris d’avant les mots.' },
  { id: 'apocalyptique', nom: 'Apocalyptique', rar: 'epique', pour: '*',
    texte: 'Le dernier match, joué sur un terrain que personne ne tond plus.' },

  /* **La première tenue qui apporte son propre décor.**
   *
   * Les trois du dessus repeignent la palette du décor dessiné — le même
   * lieu en ocre, en cendre. Celle-ci pose quatre plaques peintes, une par
   * rareté, rangées dans `public/img/fonds/` sous `halloween-<rareté>`. Voir
   * `plaque()` dans `public/fanzzy-fond.js` : sous une tenue, c'est la tenue
   * qui décide du lieu, ou personne.
   *
   * `epique` et non `legendaire` : une tenue de saison se porte, elle ne se
   * vénère pas. Les trois légendaires du catalogue sont toutes hors
   * circulation, et en sortir une neuve chaque automne les banaliserait. */
  { id: 'halloween', nom: 'Halloween', rar: 'epique', pour: '*',
    texte: 'Le virage a sorti ses masques. On ne sait plus qui chante.' },

  // Sortis de la circulation en septembre 2026. Conservés pour ceux qui les ont.
  { id: 'pluie', nom: 'Sous la pluie', rar: 'rare', pour: '*', publie: false },
  { id: 'nocturne', nom: 'Nocturne', rar: 'rare', pour: '*', publie: false },
  { id: 'derby', nom: 'Soir de derby', rar: 'epique', pour: '*', publie: false },
  { id: 'anniv', nom: 'Cinquantenaire', rar: 'legendaire', pour: '*', publie: false },
  { id: 'promo', nom: 'Jour de montée', rar: 'legendaire', pour: '*', publie: false },
  { id: 'legende', nom: 'Légende du virage', rar: 'legendaire', pour: '*', publie: false },
];

/**
 * L'équipement. `bonus` et `malus` s'appliquent aux mêmes modificateurs que les
 * Fanzzy — fenêtre de tempo, durée de martelage, souffle, contre.
 */
export const STUFF = [
  { id: 'jumelles', nom: 'Jumelles', rar: 'commune',
    texte: 'Tu vois venir le rythme, mais tu chantes plus lentement.',
    mods: { tempoWindow: 1.25, tempoInterval: 70 } },
  { id: 'echarpe', nom: 'Écharpe du club', rar: 'commune',
    texte: 'Tiens plus longtemps, respire moins bien.',
    mods: { holdBonus: 1.15, breathBonus: 0.9 } },
  { id: 'tambour', nom: 'Tambour de poche', rar: 'rare',
    texte: 'Martelage plus court à réussir, mais moins récompensé.',
    mods: { mashTime: -600, mashBonus: 0.94 } },
  { id: 'capuche', nom: 'Capuche', rar: 'rare',
    texte: 'On te contre moins bien, tu contres moins bien aussi.',
    mods: { parryBonus: 0.8, parryResist: 1.3 } },
  { id: 'megaphone', nom: 'Mégaphone', rar: 'epique',
    texte: 'Tes gestes parfaits comptent double, tes ratés se retournent.',
    mods: { perfectBonus: 1.4, backfire: true } },
  { id: 'thermos', nom: 'Thermos', rar: 'epique',
    texte: 'Le souffle revient plus vite, les grosses cartes coûtent plus cher.',
    mods: { breathBonus: 1.2, costPenalty: 1.15 } },
  { id: 'bache', nom: 'Bout de bâche', rar: 'legendaire',
    texte: 'Le contre devient redoutable, le chant s\u2019affaiblit.',
    mods: { parryBonus: 1.6, tempoWindow: 0.85 } },

  /* ---------------------------------------------------- le second sac (10)

     Sept pièces pour deux emplacements, c'était **vingt et une combinaisons** —
     dont la moitié sans intérêt, une pièce commune et une légendaire n'ayant
     rien à se dire. En pratique tout le monde finissait sur mégaphone +
     thermos, et le sac cessait d'être une décision.

     Dix de plus en font cent trente-six. Ce n'est pas le nombre qui compte :
     c'est qu'aucune ne soit universellement meilleure. Chacune de ces dix vise
     **un geste précis** ou **une façon de jouer**, et coûte quelque chose à
     ceux qui jouent autrement.

     La règle du module tient : **pas une seule n'a que des bonus.** Elles ont
     été écrites en pensant au revers d'abord.                                */

  { id: 'gants', nom: 'Gants coupés', rar: 'commune',
    texte: 'Le martelage part plus vite, la tenue glisse des doigts.',
    mods: { mashBonus: 1.18, holdForgive: -1 } },
  { id: 'sifflet', nom: 'Sifflet à roulette', rar: 'commune',
    texte: 'Le contretemps devient lisible, le tempo se brouille.',
    mods: { tempoInterval: -55, tempoWindow: 0.92 } },
  { id: 'carnet', nom: 'Carnet de chants', rar: 'commune',
    texte: 'Tu te souviens mieux, tu improvises moins.',
    mods: { perfectBonus: 1.22, mashBonus: 0.9 } },

  { id: 'bonnet', nom: 'Bonnet de virage', rar: 'rare',
    texte: 'Le souffle revient, la fenêtre se resserre.',
    mods: { breathBonus: 1.24, tempoWindow: 0.9 } },
  { id: 'brassard', nom: 'Brassard de capo', rar: 'rare',
    texte: 'Tu tiens la corde longtemps, tu la reprends mal.',
    mods: { holdBonus: 1.3, holdForgive: 2, refundBonus: 0.82 } },
  { id: 'drapeau', nom: 'Drapeau à deux mains', rar: 'rare',
    texte: 'Les tifos portent loin ; les deux mains prises, le martelage souffre.',
    mods: { parryBonus: 1.3, mashTime: 500 } },

  { id: 'tifosac', nom: 'Sac de cartons', rar: 'epique',
    texte: 'La mosaïque se monte vite, le souffle y passe.',
    mods: { perfectBonus: 1.34, breathBonus: 0.84 } },
  { id: 'cornet', nom: 'Cornet de brume', rar: 'epique',
    texte: 'Une poussée qui ne se retourne jamais contre toi, et qui coûte.',
    mods: { backfire: false, costPenalty: 1.3 } },
  { id: 'chrono', nom: 'Chronomètre de poche', rar: 'epique',
    texte: 'Le rythme se lit à la seconde près, le contre ne se lit plus du tout.',
    mods: { tempoWindow: 1.3, parryResist: 0.78 } },

  { id: 'fanion', nom: 'Fanion de 1904', rar: 'legendaire',
    texte: 'Tout tient plus longtemps. Rien ne repart vite.',
    mods: { holdBonus: 1.5, parryResist: 1.35, tempoInterval: 120, mashBonus: 0.8 } },

  /* ================================================ LA REPRISE (20)

     ## Ce que la série raconte, et ce que ça donne comme objets

     La première journée après la coupure. On s'est habillé pour un match de
     mai et il fait dix degrés de moins que prévu ; l'écharpe est encore raide
     de son sachet, les chaussures n'ont pas servi depuis trois mois, et la voix
     ne sait plus où elle se pose. **Tout est neuf ou tout est rouillé** — et
     c'est précisément ce que doit dire un sac : quelque chose qu'on maîtrise
     mal, en échange de quelque chose qu'on n'avait plus.

     Les deux règles du module tiennent, et la seconde est la seule qui compte
     vraiment : **pas une seule de ces vingt pièces n'a que des bonus.** Elles
     ont été écrites en pensant au revers d'abord, comme les dix précédentes.

     ## Pourquoi un préfixe `rp-`

     Les dix-sept pièces d'origine portent un identifiant nu — `jumelles`,
     `tambour`. C'était tenable à dix-sept ; à trente-sept, et avec une saison
     par trimestre, l'écran CONTENUS de l'administration devient une liste où
     l'on ne sait plus ce qui vient d'où. Le préfixe range sans rien coûter, et
     il se filtre. Les anciens gardent le leur : **rien ne se renomme**, un
     identifiant est référencé dans `user_stuff` et dans les decks.

     ## Ce qu'une pièce d'équipement n'a pas le droit de toucher

     **`pushMult`.** Aucune des dix-sept d'origine ne l'emploie, et ce n'est pas
     un oubli : la poussée brute appartient aux **lieux** et aux **moments** —
     un stade, un appel de tribune — pas à ce qu'on porte. Un sac qui
     multiplierait la poussée donnerait de la puissance, là où il doit donner
     une façon de jouer.

     Deux gardes le disent déjà à qui l'essaierait. `combine` ne le connaît pas
     dans ses facteurs : deux pièces qui le porteraient s'écraseraient l'une
     l'autre au lieu de se multiplier. Et `modsText` n'a pas de phrase pour lui :
     la carte afficherait un effet muet. Les deux sont éprouvés par
     `catalogue-smoke.mjs`, qui a refusé quatre de ces vingt pièces avant
     qu'elles n'arrivent ici.

     ## L'équilibre, en un coup d'œil

     Six communes, six rares, cinq épiques, trois légendaires — la même pente
     que les dix-sept d'avant. Chacune vise **un geste précis** parmi les dix,
     et coûte quelque chose à ceux qui jouent autrement. Aucune n'est meilleure
     partout ; c'est la seule chose qui fasse du sac une décision.                */

  /* ------------------------------------------------------------ communes */

  { id: 'rp-echarpe-neuve', nom: 'Écharpe encore pliée', rar: 'commune',
    texte: 'Elle tient chaud sans plier. Elle ne se noue pas vite.',
    mods: { holdBonus: 1.2, mashTime: 350 } },

  { id: 'rp-lunettes', nom: 'Lunettes sur le front', rar: 'commune',
    texte: 'Tu vois la pulsation arriver ; le soleil te la reprend.',
    mods: { tempoWindow: 1.18, perfectBonus: 0.9 } },

  { id: 'rp-gourde', nom: 'Gourde d’été', rar: 'commune',
    texte: 'Le souffle revient, les gestes longs s’écourtent.',
    mods: { breathBonus: 1.16, holdBonus: 0.9 } },

  { id: 'rp-ticket-mai', nom: 'Ticket du mois de mai', rar: 'commune',
    texte: 'Tu te souviens du dernier match. Tu ne regardes pas celui-ci.',
    mods: { perfectBonus: 1.2, tempoWindow: 0.9 } },

  { id: 'rp-crampons', nom: 'Chaussures jamais nettoyées', rar: 'commune',
    texte: 'Tu t’arc-boutes bien. Tu ne te relèves pas vite.',
    mods: { holdBonus: 1.18, refundBonus: 0.86 } },

  { id: 'rp-casquette', nom: 'Casquette de vacances', rar: 'commune',
    texte: 'Rien ne t’atteint. Tu ne renvoies rien non plus.',
    mods: { parryResist: 1.24, parryBonus: 0.84 } },

  /* --------------------------------------------------------------- rares */

  { id: 'rp-voix-rouillee', nom: 'Pastilles pour la gorge', rar: 'rare',
    texte: 'Deux mois sans chanter : la voix revient vite, elle sonne moins juste.',
    mods: { breathBonus: 1.3, perfectBonus: 0.86 } },

  { id: 'rp-maillot-passe', nom: 'Maillot de l’an dernier', rar: 'rare',
    texte: 'Tu connais le refrain par cœur ; personne ne reprend avec toi.',
    mods: { perfectBonus: 1.32, parryBonus: 0.82 } },

  { id: 'rp-veste', nom: 'Veste de mi-saison', rar: 'rare',
    texte: 'Ouverte, fermée, ouverte : tu t’adaptes vite et tu tiens mal.',
    mods: { mashBonus: 1.26, mashTime: -400, holdForgive: -1 } },

  { id: 'rp-carnet-ete', nom: 'Carnet de l’intersaison', rar: 'rare',
    texte: 'Trois mois de chants notés. Aucun ne sort tout seul.',
    mods: { tempoWindow: 1.28, tempoInterval: 90 } },

  { id: 'rp-sifflet-sac', nom: 'Sifflet retrouvé au fond du sac', rar: 'rare',
    texte: 'Le contretemps redevient lisible, et il coûte du souffle.',
    mods: { tempoInterval: -60, breathBonus: 0.86 } },

  { id: 'rp-abonnement', nom: 'Abonnement neuf', rar: 'rare',
    texte: 'Ta place est payée pour l’année : tu restes. Tu ne bouges plus.',
    mods: { holdBonus: 1.34, holdForgive: 2, mashBonus: 0.82 } },

  /* ------------------------------------------------------------- épiques */

  { id: 'rp-tambour-detendu', nom: 'Tambour détendu', rar: 'epique',
    texte: 'La peau a pris l’humidité de l’été : elle roule vite, elle répond tard.',
    mods: { mashBonus: 1.3, tempoInterval: 130 } },

  { id: 'rp-bombe', nom: 'Bombe de peinture', rar: 'epique',
    texte: 'La bâche se repeint en une nuit. La main tremble le lendemain.',
    mods: { perfectBonus: 1.38, tempoWindow: 0.82 } },

  { id: 'rp-radio', nom: 'Radio à pile', rar: 'epique',
    texte: 'Tu entends les autres matchs : rien ne te surprend, rien ne t’emporte.',
    mods: { parryResist: 1.4, perfectBonus: 0.86 } },

  { id: 'rp-creme', nom: 'Crème solaire', rar: 'epique',
    texte: 'Tu tiens tout l’après-midi ; les doigts glissent sur tout le reste.',
    mods: { holdBonus: 1.4, mashBonus: 0.86, holdForgive: 1 } },

  { id: 'rp-programme', nom: 'Programme de la saison', rar: 'epique',
    texte: 'Tu sais ce qui vient. Tu ne joues plus qu’à ça.',
    mods: { tempoWindow: 1.36, mashTime: 600 } },

  /* --------------------------------------------------------- légendaires */

  { id: 'rp-premiere-journee', nom: 'Billet de la première journée', rar: 'legendaire',
    texte: 'Tout recommence, et rien ne va aussi vite qu’en mai.',
    mods: { perfectBonus: 1.35, breathBonus: 1.2, tempoInterval: 150, mashBonus: 0.78 } },

  { id: 'rp-drapeau-grenier', nom: 'Le drapeau resté au grenier', rar: 'legendaire',
    texte: 'Il pèse encore plus lourd qu’avant. Ce qu’il couvre, personne ne le perce.',
    mods: { parryBonus: 1.55, parryResist: 1.3, mashTime: 800, breathBonus: 0.84 } },

  { id: 'rp-corde-neuve', nom: 'Corde neuve', rar: 'legendaire',
    texte: 'Elle ne casse pas. Elle ne pardonne aucun temps mort.',
    mods: { holdBonus: 1.55, holdForgive: -2, refundBonus: 0.8, perfectBonus: 1.15 } },

  /* ---------------------------------------------------- les trois époques

     Quatre pièces par époque des tenues, une par rareté, et chacune avec
     son revers comme toutes les autres. Elles se portent sur n'importe quel
     Fanzzy, dans n'importe quelle tenue : l'époque est un univers de
     collection, pas une condition de jeu. */
  { id: 'hw-bougie', nom: 'Bougie de citrouille', rar: 'commune',
    texte: 'La flamme vacille en mesure. Elle ne réchauffe personne.',
    mods: { tempoWindow: 1.16, breathBonus: 0.9 } },

  { id: 'hw-cape', nom: 'Cape de vampire', rar: 'rare',
    texte: 'On s’y drape, rien ne passe. On s’y prend aussi les bras.',
    mods: { parryResist: 1.3, mashBonus: 0.86 } },

  { id: 'hw-grimoire', nom: 'Grimoire des chants oubliés', rar: 'epique',
    texte: 'Des refrains d’avant-guerre, parfaits et interminables.',
    mods: { perfectBonus: 1.36, tempoInterval: 110 } },

  { id: 'hw-lanterne', nom: 'La Lanterne du 31', rar: 'legendaire',
    texte: 'On la lève, et la tribune d’en face recule. Elle pèse au bout du bras.',
    mods: { parryBonus: 1.45, holdBonus: 1.3, breathBonus: 0.84, tempoWindow: 0.88 } },

  { id: 'ph-os', nom: 'Os à frapper', rar: 'commune',
    texte: 'On tape sur ce qu’on trouve. On ne tient rien longtemps.',
    mods: { mashBonus: 1.18, holdForgive: -1 } },

  { id: 'ph-peau', nom: 'Peau de bête', rar: 'rare',
    texte: 'Chaude pour tenir la note. Lourde pour marteler.',
    mods: { holdBonus: 1.3, mashTime: 450 } },

  { id: 'ph-silex', nom: 'Silex taillé', rar: 'epique',
    texte: 'Un geste net, sans reprise possible. On ne contre rien avec.',
    mods: { perfectBonus: 1.34, parryBonus: 0.84 } },

  { id: 'ph-mammouth', nom: 'Corne de mammouth', rar: 'legendaire',
    texte: 'Soufflée, elle fait trembler la roche. Il faut des bras pour la porter.',
    mods: { mashBonus: 1.4, breathBonus: 1.2, tempoWindow: 0.84, refundBonus: 0.82 } },

  { id: 'ap-bidon', nom: 'Bidon d’eau recyclée', rar: 'commune',
    texte: 'On boit, on repart. Le goût gâche le geste parfait.',
    mods: { breathBonus: 1.18, perfectBonus: 0.88 } },

  { id: 'ap-cle', nom: 'Clé à molette', rar: 'rare',
    texte: 'On cogne fort et vite. On ne la tient pas longtemps.',
    mods: { mashBonus: 1.28, mashTime: -400, holdForgive: -1 } },

  { id: 'ap-compteur', nom: 'Compteur Geiger', rar: 'epique',
    texte: 'Il crépite en rythme. Tout le monde l’entend venir.',
    mods: { tempoWindow: 1.34, parryResist: 0.82 } },

  { id: 'ap-drapeau', nom: 'Le dernier drapeau', rar: 'legendaire',
    texte: 'Recousu vingt fois, il tient encore. Rien ne le perce, et il ralentit tout.',
    mods: { holdBonus: 1.5, parryResist: 1.3, tempoInterval: 130, mashBonus: 0.8 } },

  /* ============================================= LES CINQ SÉRIES NEUVES (51)

     ## Pourquoi cent

     Gaël a voulu cent pièces (6 octobre 2026). Les quarante-neuf d'avant
     viennent de trois sources : le sac d'origine, LA REPRISE, les époques.
     Les cinquante et une qui manquaient suivent les **cinq séries qui
     attendent leur saison** (`dex-series-neuves.js`) : dix par série, et une
     centième qui n'appartient à personne.

     ## Elles naissent fermées

     `publie: false` sur chaque fiche : c'est la règle de
     `contenus/index.js` pour un contenu neuf. Le semis les pose fermées en
     base ; une saison les ouvre avec sa série (le champ `stuff` d'une
     saison), ou l'onglet CONTENUS de l'administration une par une. Ce qu'on
     possède se joue toujours : fermer, c'est cesser de distribuer.

     ## Le même équilibre

     Par série : trois communes, trois rares, trois épiques, une
     légendaire. Les mêmes effets que les quarante-neuf d'avant, rien de
     neuf, et **pas une seule n'a que des bonus** — `catalogue-smoke.mjs` le
     vérifie sur toutes. `pushMult` reste interdit, pour la raison écrite
     au-dessus de LA REPRISE.

     Préfixe : le code de la série en minuscules, comme `rp-`.             */

  /* ------------------------------------------------------- LES VIP (vp-) */

  { id: 'vp-flute', nom: 'Flûte de champagne', rar: 'commune', publie: false,
    texte: 'Les bulles montent en mesure. Le bras ne se lève pas pour autant.',
    mods: { tempoWindow: 1.18, mashBonus: 0.88 } },
  { id: 'vp-badge', nom: 'Badge d’accès', rar: 'commune', publie: false,
    texte: 'Il ouvre toutes les portes. Derrière, personne ne t’écoute.',
    mods: { parryResist: 1.2, perfectBonus: 0.88 } },
  { id: 'vp-coussin', nom: 'Coussin de loge', rar: 'commune', publie: false,
    texte: 'Assis, tu tiens tout le match. Debout, plus jamais.',
    mods: { holdBonus: 1.2, mashTime: 400 } },
  { id: 'vp-telephone', nom: 'Téléphone en selfie', rar: 'rare', publie: false,
    texte: 'Chaque geste parfait est filmé. Le reste du match, tu le rates.',
    mods: { perfectBonus: 1.3, tempoWindow: 0.88 } },
  { id: 'vp-jumelles-opera', nom: 'Jumelles de théâtre', rar: 'rare', publie: false,
    texte: 'Tu vois le capo d’en face respirer. Tu oublies de respirer toi-même.',
    mods: { tempoWindow: 1.28, breathBonus: 0.86 } },
  { id: 'vp-plaid', nom: 'Plaid en cachemire', rar: 'rare', publie: false,
    texte: 'Le froid ne passe pas. Les mains non plus.',
    mods: { parryResist: 1.3, mashBonus: 0.84 } },
  { id: 'vp-carte-or', nom: 'Carte de membre or', rar: 'epique', publie: false,
    texte: 'Tout est compris, même ce que tu ne voulais pas.',
    mods: { breathBonus: 1.3, costPenalty: 1.25 } },
  { id: 'vp-montre', nom: 'Montre de collection', rar: 'epique', publie: false,
    texte: 'Elle avance à la seconde. Elle ne pardonne aucun temps mort.',
    mods: { tempoInterval: -75, holdForgive: -2 } },
  { id: 'vp-cigare', nom: 'Cigare de la présidence', rar: 'epique', publie: false,
    texte: 'La fumée couvre la loge : rien ne t’atteint. Ta voix y reste.',
    mods: { parryResist: 1.38, breathBonus: 0.84 } },
  { id: 'vp-cles-loge', nom: 'Les clés de la loge présidentielle', rar: 'legendaire', publie: false,
    texte: 'La meilleure place du stade. D’ici, on ne voit plus le virage.',
    mods: { parryBonus: 1.5, parryResist: 1.35, tempoWindow: 0.85, mashBonus: 0.82 } },

  /* ------------------------------------ LA GASTRONOMIE DE COMPTOIR (gc-) */

  { id: 'gc-frites', nom: 'Cornet de frites', rar: 'commune', publie: false,
    texte: 'Ça tient au corps. Les doigts collent au tambour.',
    mods: { holdBonus: 1.16, mashBonus: 0.88 } },
  { id: 'gc-gobelet', nom: 'Gobelet consigné', rar: 'commune', publie: false,
    texte: 'Tu le gardes et tu tapes dessus. Il ne sonne pas juste.',
    mods: { mashBonus: 1.2, perfectBonus: 0.88 } },
  { id: 'gc-moutarde', nom: 'Pot de moutarde', rar: 'commune', publie: false,
    texte: 'Ça monte au nez et ça réveille. Tu en pleures un peu.',
    mods: { breathBonus: 1.18, tempoWindow: 0.9 } },
  { id: 'gc-saucisse', nom: 'Saucisse de buvette', rar: 'rare', publie: false,
    texte: 'Avalée debout à la mi-temps : tu repars vite, tu digères mal.',
    mods: { refundBonus: 1.25, holdBonus: 0.86 } },
  { id: 'gc-biere-tiede', nom: 'Bière tiède', rar: 'rare', publie: false,
    texte: 'Elle passe toute seule. Le refrain aussi, avec un temps de retard.',
    mods: { tempoWindow: 1.26, tempoInterval: 80 } },
  { id: 'gc-sandwich', nom: 'Sandwich triangle', rar: 'rare', publie: false,
    texte: 'Trois bouchées et le souffle revient. Le contre reste coincé.',
    mods: { breathBonus: 1.28, parryBonus: 0.84 } },
  { id: 'gc-plateau', nom: 'Plateau de la buvette', rar: 'epique', publie: false,
    texte: 'Tu portes pour toute la rangée : personne ne te bouscule, tu ne martèles plus.',
    mods: { parryResist: 1.34, mashTime: 600 } },
  { id: 'gc-piment', nom: 'Sauce piquante maison', rar: 'epique', publie: false,
    texte: 'Le geste parfait brûle. Le geste raté aussi.',
    mods: { perfectBonus: 1.36, backfire: true } },
  { id: 'gc-chocolat', nom: 'Chocolat chaud de la buvette', rar: 'epique', publie: false,
    texte: 'Il réchauffe les mains et la voix. Il coûte trois fois son prix.',
    mods: { holdBonus: 1.32, breathBonus: 1.12, costPenalty: 1.25 } },
  { id: 'gc-recette', nom: 'La recette secrète de la buvette', rar: 'legendaire', publie: false,
    texte: 'Tout le virage vient la goûter. Il faut la servir avant de chanter.',
    mods: { perfectBonus: 1.4, breathBonus: 1.25, tempoInterval: 140, refundBonus: 0.8 } },

  /* ------------------------------------ LES GALÈRES DE DÉPLACEMENT (gd-) */

  { id: 'gd-billet-train', nom: 'Billet de train composté', rar: 'commune', publie: false,
    texte: 'Tu es parti à l’heure. Tu arrives en retard sur le refrain.',
    mods: { perfectBonus: 1.18, tempoInterval: 60 } },
  { id: 'gd-coussin-nuque', nom: 'Coussin de nuque', rar: 'commune', publie: false,
    texte: 'Tu tiens les neuf heures de car. Tu tournes mal la tête.',
    mods: { holdBonus: 1.2, parryBonus: 0.88 } },
  { id: 'gd-carte-routiere', nom: 'Carte routière mal repliée', rar: 'commune', publie: false,
    texte: 'Tu sais où tu vas. Tu ne sais plus la replier.',
    mods: { tempoWindow: 1.18, mashTime: 300 } },
  { id: 'gd-sac-couchage', nom: 'Sac de couchage', rar: 'rare', publie: false,
    texte: 'Tu dors n’importe où et tu repars frais. Tu sors du sac lentement.',
    mods: { breathBonus: 1.28, mashTime: 450 } },
  { id: 'gd-glaciere', nom: 'Glacière du car', rar: 'rare', publie: false,
    texte: 'Tout le monde vient se servir : tu tiens ta place, tu ne bouges plus.',
    mods: { parryResist: 1.3, tempoWindow: 0.9 } },
  { id: 'gd-gilet', nom: 'Gilet fluo de l’aire d’autoroute', rar: 'rare', publie: false,
    texte: 'On te voit de loin et on te suit. On te voit venir aussi.',
    mods: { parryBonus: 1.3, parryResist: 0.84 } },
  { id: 'gd-batterie', nom: 'Batterie externe', rar: 'epique', publie: false,
    texte: 'Le souffle ne s’éteint jamais. Chaque chant tire sur la charge.',
    mods: { breathBonus: 1.34, costPenalty: 1.2 } },
  { id: 'gd-valise', nom: 'Valise à une roue', rar: 'epique', publie: false,
    texte: 'Elle claque à chaque pas, en mesure. Elle se traîne quand il faut taper.',
    mods: { tempoWindow: 1.32, mashBonus: 0.84 } },
  { id: 'gd-gps', nom: 'GPS qui recalcule', rar: 'epique', publie: false,
    texte: 'Il retrouve toujours le rythme. Il passe par le chemin le plus long.',
    mods: { tempoInterval: -70, refundBonus: 0.84 } },
  { id: 'gd-car', nom: 'Le car des neuf cents kilomètres', rar: 'legendaire', publie: false,
    texte: 'Tout le monde est dedans et personne ne lâche. Il arrive à la mi-temps.',
    mods: { holdBonus: 1.5, holdForgive: 2, tempoInterval: 140, mashBonus: 0.8 } },

  /* ------------------------------------------ LES PHÉNOMÈNES MÉTÉO (mt-) */

  { id: 'mt-poncho', nom: 'Poncho en plastique', rar: 'commune', publie: false,
    texte: 'La pluie ne passe pas. Le poncho colle aux bras.',
    mods: { parryResist: 1.2, mashBonus: 0.88 } },
  { id: 'mt-parapluie', nom: 'Parapluie retourné', rar: 'commune', publie: false,
    texte: 'Il tient tête au vent. Il ne tient rien d’autre.',
    mods: { holdBonus: 1.18, perfectBonus: 0.88 } },
  { id: 'mt-chaufferette', nom: 'Chaufferette de poche', rar: 'commune', publie: false,
    texte: 'Les doigts dégèlent, le martelage repart. Elle refroidit en route.',
    mods: { mashBonus: 1.18, holdBonus: 0.9 } },
  { id: 'mt-bottes', nom: 'Bottes de pluie', rar: 'rare', publie: false,
    texte: 'Les pieds au sec et bien plantés. Lourds à décoller.',
    mods: { holdBonus: 1.28, mashTime: 450 } },
  { id: 'mt-girouette', nom: 'Girouette de toit', rar: 'rare', publie: false,
    texte: 'Elle sent venir le vent. Elle tourne avec.',
    mods: { tempoWindow: 1.28, parryResist: 0.84 } },
  { id: 'mt-eventail', nom: 'Éventail de canicule', rar: 'rare', publie: false,
    texte: 'Le souffle revient à chaque coup. Le bras fatigue.',
    mods: { breathBonus: 1.28, mashBonus: 0.86 } },
  { id: 'mt-paratonnerre', nom: 'Paratonnerre de poche', rar: 'epique', publie: false,
    texte: 'La foudre tombe sur toi et repart vers eux. Tout coûte plus cher.',
    mods: { parryBonus: 1.38, costPenalty: 1.2 } },
  { id: 'mt-barometre', nom: 'Baromètre de grand-père', rar: 'epique', publie: false,
    texte: 'Il dit le temps qu’il fera. Il ne dit jamais quand.',
    mods: { tempoWindow: 1.36, tempoInterval: 100 } },
  { id: 'mt-grelons', nom: 'Seau de grêlons', rar: 'epique', publie: false,
    texte: 'Ça tape dru et vite. Ça fond dans les mains.',
    mods: { mashBonus: 1.34, mashTime: -450, holdForgive: -2 } },
  { id: 'mt-manche-a-air', nom: 'La manche à air du stade', rar: 'legendaire', publie: false,
    texte: 'Elle dit d’où vient le vent, et le virage suit. Elle claque à chaque rafale.',
    mods: { parryBonus: 1.4, tempoWindow: 1.3, mashTime: 700, breathBonus: 0.84 } },

  /* ------------------------------------------- LES HÉROS DU CANAPÉ (hc-) */

  { id: 'hc-telecommande', nom: 'Télécommande', rar: 'commune', publie: false,
    texte: 'Tu zappes vite. Tu rates le refrain.',
    mods: { mashBonus: 1.2, tempoWindow: 0.9 } },
  { id: 'hc-chips', nom: 'Paquet de chips', rar: 'commune', publie: false,
    texte: 'Une poignée et ça repart. Le sel gâche le geste parfait.',
    mods: { breathBonus: 1.16, perfectBonus: 0.88 } },
  { id: 'hc-pantoufles', nom: 'Pantoufles du club', rar: 'commune', publie: false,
    texte: 'Rien ne te déloge. Rien ne te fait lever non plus.',
    mods: { parryResist: 1.22, mashTime: 350 } },
  { id: 'hc-casque', nom: 'Casque audio', rar: 'rare', publie: false,
    texte: 'Tu entends le rythme avant tout le monde. Tu n’entends plus ton voisin.',
    mods: { tempoWindow: 1.26, parryBonus: 0.84 } },
  { id: 'hc-tablette', nom: 'Tablette des statistiques', rar: 'rare', publie: false,
    texte: 'Tu sais tout du match. Tu ne le vis plus.',
    mods: { perfectBonus: 1.3, holdBonus: 0.86 } },
  { id: 'hc-canette', nom: 'Canette ouverte à la mi-temps', rar: 'rare', publie: false,
    texte: 'Le souffle revient d’un trait. La suite pique.',
    mods: { breathBonus: 1.3, tempoInterval: 70 } },
  { id: 'hc-fauteuil', nom: 'Fauteuil inclinable', rar: 'epique', publie: false,
    texte: 'Tu tiens jusqu’aux tirs au but. Tu ne te relèves qu’après.',
    mods: { holdBonus: 1.4, holdForgive: 1, mashTime: 650 } },
  { id: 'hc-ecran', nom: 'Grand écran', rar: 'epique', publie: false,
    texte: 'Le ralenti ne ment pas : tes gestes parfaits pèsent, tes ratés repassent en boucle.',
    mods: { perfectBonus: 1.38, backfire: true } },
  { id: 'hc-pizza', nom: 'Pizza de fin de match', rar: 'epique', publie: false,
    texte: 'Elle arrive à point et tout repart. Elle se paie.',
    mods: { breathBonus: 1.24, refundBonus: 1.2, costPenalty: 1.25 } },
  { id: 'hc-canape', nom: 'Le canapé des grands soirs', rar: 'legendaire', publie: false,
    texte: 'Il a vu toutes les finales. On ne le contre pas, on ne le soulève pas.',
    mods: { parryResist: 1.45, holdBonus: 1.4, mashBonus: 0.78, tempoWindow: 0.86 } },

  /* ------------------------------------------- LES TERRACES, les pièces de club

     Demande de Gaël du 28 octobre 2026 : deux pièces par club de la série AN,
     une commune et une rare, **gagnables par tout le monde**. `club` est
     l'identifiant API-Football du club, comme dans `shared/fanzzy/clubs.js` ;
     le nom en commentaire n'est là que pour qui relit, il ne descend jamais
     plus bas. Même prudence que les fiches et les cris : ni écusson, ni nom,
     ni maillot, ni surnom — les couleurs ou la ville.

     Portée par un Fanzzy lié au même club, une pièce de club fait **COMBO**
     (son revers s'adoucit, `modsDeLaPiece`) ; dans un match du club
     principal du joueur, elle rapporte en plus (`pleinClub`, `clubs.js`).
     Jamais plus de force : la récompense du fan est dans ce qu'il gagne.

     Fermées tant que leur dessin n'est pas fait : elles s'ouvrent une par une
     dans CONTENUS. Une série de clubs sans ses deux pièces par club ne passe
     pas `stuff-clubs:smoke`. */

  // Arsenal
  { id: 'an-mitaines', nom: 'Mitaines rouge et blanc', rar: 'commune', club: 42, publie: false,
    texte: 'Les doigts au chaud jusqu’au bout. Ils tapent moins fort.',
    mods: { holdBonus: 1.2, mashBonus: 0.88 } },
  { id: 'an-horloge', nom: 'Horloge de la tribune', rar: 'rare', club: 42, publie: false,
    texte: 'Elle bat la mesure au-dessus de toi. Tu retiens ton souffle pour l’entendre.',
    mods: { tempoWindow: 1.28, breathBonus: 0.86 } },
  // Aston Villa
  { id: 'an-thermos', nom: 'Thermos bordeaux et ciel', rar: 'commune', club: 66, publie: false,
    texte: 'Une gorgée et la voix revient. Les mains, elles, restent sur le gobelet.',
    mods: { breathBonus: 1.18, parryBonus: 0.9 } },
  { id: 'an-enclume', nom: 'Enclume de poche', rar: 'rare', club: 66, publie: false,
    texte: 'Chaque coup sonne comme à la forge. Il faut le temps de relever le marteau.',
    mods: { mashBonus: 1.28, tempoInterval: 70 } },
  // Bournemouth
  { id: 'an-seau-plage', nom: 'Seau de plage rayé', rar: 'commune', club: 35, publie: false,
    texte: 'On y remet ce qu’on a perdu. Il y reste toujours un peu de sable.',
    mods: { refundBonus: 1.18, perfectBonus: 0.88 } },
  { id: 'an-transat', nom: 'Transat de la promenade', rar: 'rare', club: 35, publie: false,
    texte: 'Tu tiens tout le match face à la mer. Tu en sors lentement.',
    mods: { holdBonus: 1.28, mashTime: 400 } },
  // Brentford
  { id: 'an-bob', nom: 'Bob rayé rouge et blanc', rar: 'commune', club: 55, publie: false,
    texte: 'Il garde l’œil sur le rythme. Il ne garde pas la tête au chaud.',
    mods: { tempoWindow: 1.18, holdBonus: 0.9 } },
  { id: 'an-rame', nom: 'Rame d’aviron', rar: 'rare', club: 55, publie: false,
    texte: 'Tout le virage rame dans le même sens. Ça essouffle.',
    mods: { mashBonus: 1.26, breathBonus: 0.86 } },
  // Brighton
  { id: 'an-sucre-orge', nom: 'Bâton de sucre d’orge', rar: 'commune', club: 51, publie: false,
    texte: 'Le sucre redonne de la voix. Il colle un peu au refrain.',
    mods: { breathBonus: 1.18, tempoWindow: 0.9 } },
  { id: 'an-jeton', nom: 'Jeton d’arcade de la jetée', rar: 'rare', club: 51, publie: false,
    texte: 'Un jeton, un geste parfait. Le suivant, il faut le gagner.',
    mods: { perfectBonus: 1.3, holdBonus: 0.86 } },
  // Chelsea
  { id: 'an-gants-roi', nom: 'Gants bleu roi', rar: 'commune', club: 49, publie: false,
    texte: 'Rien ne t’atteint dans ces gants-là. Rien ne claque non plus.',
    mods: { parryResist: 1.2, mashBonus: 0.88 } },
  { id: 'an-arrosoir', nom: 'Arrosoir du salon des fleurs', rar: 'rare', club: 49, publie: false,
    texte: 'La voix repousse comme un massif au printemps. Pas d’épines pour piquer.',
    mods: { breathBonus: 1.28, parryBonus: 0.84 } },
  // Coventry City
  { id: 'an-sonnette', nom: 'Sonnette de vélo bleu ciel', rar: 'commune', club: 1346, publie: false,
    texte: 'Elle sonne pile à temps. Elle n’impressionne personne.',
    mods: { tempoWindow: 1.18, parryBonus: 0.9 } },
  { id: 'an-guidon', nom: 'Guidon chromé', rar: 'rare', club: 1346, publie: false,
    texte: 'Tu prends le refrain en danseuse. Pas le temps de souffler dans la descente.',
    mods: { tempoInterval: -60, refundBonus: 0.86 } },
  // Crystal Palace
  { id: 'an-bonnet-rb', nom: 'Bonnet rouge et bleu', rar: 'commune', club: 52, publie: false,
    texte: 'Il tient chaud jusqu’au bout. Il tombe sur les yeux au mauvais moment.',
    mods: { holdBonus: 1.18, perfectBonus: 0.9 } },
  { id: 'an-dinosaure', nom: 'Dinosaure de pierre du parc', rar: 'rare', club: 52, publie: false,
    texte: 'Rien ne le fait bouger depuis des siècles. Toi non plus.',
    mods: { parryResist: 1.3, mashTime: 450 } },
  // Everton
  { id: 'an-cire', nom: 'Ciré bleu marine', rar: 'commune', club: 45, publie: false,
    texte: 'Les embruns glissent dessus. Il serre un peu à la poitrine.',
    mods: { parryResist: 1.2, breathBonus: 0.9 } },
  { id: 'an-corne-brume', nom: 'Corne de brume du port', rar: 'rare', club: 45, publie: false,
    texte: 'On l’entend de l’autre rive. Elle dit aussi où tu es.',
    mods: { parryBonus: 1.28, parryResist: 0.86 } },
  // Fulham
  { id: 'an-parapluie', nom: 'Parapluie noir et blanc', rar: 'commune', club: 36, publie: false,
    texte: 'Tu tiens sous l’averse. La main prise ne contre plus.',
    mods: { holdBonus: 1.2, parryBonus: 0.88 } },
  { id: 'an-theiere', nom: 'Théière du cottage', rar: 'rare', club: 36, publie: false,
    texte: 'Une tasse au bord du fleuve et la voix revient. Le thé ne se presse jamais.',
    mods: { breathBonus: 1.28, tempoInterval: 70 } },
  // Hull City
  { id: 'an-bonnet-pecheur', nom: 'Bonnet de pêcheur ambre et noir', rar: 'commune', club: 64, publie: false,
    texte: 'Il a tenu des marées entières. Il pèse sur les bras.',
    mods: { holdBonus: 1.18, mashBonus: 0.9 } },
  { id: 'an-lanterne-chalutier', nom: 'Lanterne de chalutier', rar: 'rare', club: 64, publie: false,
    texte: 'Elle montre le rythme dans la nuit. Il faut la tenir à deux mains.',
    mods: { tempoWindow: 1.28, mashBonus: 0.86 } },
  // Ipswich Town
  { id: 'an-moulin', nom: 'Petit moulin à vent', rar: 'commune', club: 57, publie: false,
    texte: 'Il tourne au moindre souffle. Au moindre coup aussi.',
    mods: { breathBonus: 1.18, parryResist: 0.9 } },
  { id: 'an-panier', nom: 'Panier de pique-nique', rar: 'rare', club: 57, publie: false,
    texte: 'Il y a toujours de quoi repartir. Le temps de l’ouvrir, le refrain file.',
    mods: { refundBonus: 1.26, tempoWindow: 0.86 } },
  // Leeds United
  { id: 'an-pudding', nom: 'Pudding du dimanche', rar: 'commune', club: 63, publie: false,
    texte: 'Ça tient au corps et ça remet en voix. Le geste fin attendra.',
    mods: { breathBonus: 1.18, perfectBonus: 0.88 } },
  { id: 'an-lampe-mineur', nom: 'Lampe de mineur', rar: 'rare', club: 63, publie: false,
    texte: 'Elle éclaire le geste juste au fond du bruit. Elle s’éteint si tu tiens trop.',
    mods: { perfectBonus: 1.28, holdBonus: 0.86 } },
  // Liverpool
  { id: 'an-amarre', nom: 'Corde d’amarrage rouge', rar: 'commune', club: 40, publie: false,
    texte: 'Amarré au virage, tu ne lâches rien. Tu ne bouges plus non plus.',
    mods: { holdBonus: 1.2, tempoWindow: 0.9 } },
  { id: 'an-guitare', nom: 'Guitare rouge des caves', rar: 'rare', club: 40, publie: false,
    texte: 'Tout le monde suit ton tempo. Personne ne pense à se défendre.',
    mods: { tempoWindow: 1.3, parryBonus: 0.84 } },
  // Manchester City
  { id: 'an-impermeable', nom: 'Imperméable bleu ciel', rar: 'commune', club: 50, publie: false,
    texte: 'La pluie du Nord glisse dessus. Les bras restent raides.',
    mods: { parryResist: 1.18, mashBonus: 0.9 } },
  { id: 'an-lanterne-ecluse', nom: 'Lanterne d’écluse', rar: 'rare', club: 50, publie: false,
    texte: 'Le souffle monte comme l’eau dans le sas. Il faut attendre que ça s’ouvre.',
    mods: { breathBonus: 1.28, mashTime: 400 } },
  // Manchester United
  { id: 'an-bobine', nom: 'Bobine de coton rouge', rar: 'commune', club: 33, publie: false,
    texte: 'Ça tape comme les métiers d’antan. Le fil coupe le souffle.',
    mods: { mashBonus: 1.18, breathBonus: 0.9 } },
  { id: 'an-navette', nom: 'Navette de tisserand', rar: 'rare', club: 33, publie: false,
    texte: 'Elle file d’un bord à l’autre sans s’arrêter. Elle ne tient jamais en place.',
    mods: { tempoInterval: -60, holdBonus: 0.86 } },
  // Newcastle United
  { id: 'an-echarpe-tricot', nom: 'Écharpe tricotée noir et blanc', rar: 'commune', club: 34, publie: false,
    texte: 'Tricotée pour durer tout le match. Elle ne se dénoue pas pour repartir.',
    mods: { holdBonus: 1.18, refundBonus: 0.9 } },
  { id: 'an-cle-pont', nom: 'Clé à boulons du pont', rar: 'rare', club: 34, publie: false,
    texte: 'Chaque coup serre un rivet de plus. Pas de place pour la finesse.',
    mods: { mashBonus: 1.28, perfectBonus: 0.86 } },
  // Nottingham Forest
  { id: 'an-bonnet-plume', nom: 'Bonnet rouge à plume', rar: 'commune', club: 65, publie: false,
    texte: 'La plume pointe le geste juste. Elle chatouille quand il faut tenir.',
    mods: { perfectBonus: 1.18, holdBonus: 0.9 } },
  { id: 'an-carquois', nom: 'Carquois de l’archer', rar: 'rare', club: 65, publie: false,
    texte: 'Chaque contre part en flèche. Le carquois se vide, le souffle aussi.',
    mods: { parryBonus: 1.3, breathBonus: 0.86 } },
  // Sunderland
  { id: 'an-chope', nom: 'Chope de verre soufflé', rar: 'commune', club: 746, publie: false,
    texte: 'Elle rend la voix claire. Elle se casse au premier choc.',
    mods: { breathBonus: 1.18, parryBonus: 0.9 } },
  { id: 'an-boule-verre', nom: 'Boule de verre rouge', rar: 'rare', club: 746, publie: false,
    texte: 'Soufflée d’un seul geste parfait. Elle ne supporte pas d’attendre.',
    mods: { perfectBonus: 1.3, holdBonus: 0.84 } },
  // Tottenham Hotspur
  { id: 'an-boutons', nom: 'Boutons nacrés', rar: 'commune', club: 47, publie: false,
    texte: 'Ils brillent au rythme du refrain. Ils sautent quand on tape.',
    mods: { tempoWindow: 1.18, mashBonus: 0.88 } },
  { id: 'an-gilet-nacre', nom: 'Gilet nacré bleu nuit', rar: 'rare', club: 47, publie: false,
    texte: 'Cousu de mille boutons, il arrête tout. Il ne laisse pas danser.',
    mods: { parryResist: 1.28, tempoWindow: 0.86 } },

  /* --------------------------------------------- DIE KURVE, les pièces de club

     Les mêmes règles que LES TERRACES, pour les douze clubs suisses (demande
     de Gaël du 1er novembre 2026). Les couleurs ou la ville, jamais ce que
     dessinent les écussons ni les armoiries : ni ours, ni étoile, ni aigle,
     ni clé, ni insecte, ni grande lettre V, ni croix. */

  // Bâle
  { id: 'su-piccolo', nom: 'Piccolo rouge et bleu', rar: 'commune', club: 551, publie: false,
    texte: 'Il donne la note avant tout le monde. Il s’essouffle avant tout le monde aussi.',
    mods: { tempoWindow: 1.18, breathBonus: 0.9 } },
  { id: 'su-lanterne-cortege', nom: 'Lanterne peinte du cortège', rar: 'rare', club: 551, publie: false,
    texte: 'Elle éclaire le geste juste au cœur de la nuit. Elle se porte à pas lents.',
    mods: { perfectBonus: 1.28, mashTime: 400 } },
  // Grasshopper
  { id: 'su-casquette-matelot', nom: 'Casquette de matelot bleu nuit', rar: 'commune', club: 1013, publie: false,
    texte: 'Le vent du lac glisse dessus. Elle tombe au premier coup de bras.',
    mods: { parryResist: 1.2, mashBonus: 0.88 } },
  { id: 'su-cloche-aubes', nom: 'Cloche du bateau à aubes', rar: 'rare', club: 1013, publie: false,
    texte: 'On l’entend d’une rive à l’autre. Il faut attendre qu’elle se taise.',
    mods: { parryBonus: 1.28, tempoInterval: 70 } },
  // Lausanne-Sport
  { id: 'su-gants-vendange', nom: 'Gants de vendange bleu roi', rar: 'commune', club: 1014, publie: false,
    texte: 'Ils tiennent la grappe jusqu’au bout. Ils n’ont pas la finesse des doigts nus.',
    mods: { holdBonus: 1.18, perfectBonus: 0.9 } },
  { id: 'su-porte-voix-guet', nom: 'Porte-voix du guet', rar: 'rare', club: 1014, publie: false,
    texte: 'Il porte ta voix jusqu’au lac. Les mains prises, tu ne contres plus.',
    mods: { breathBonus: 1.28, parryBonus: 0.84 } },
  // Lucerne
  { id: 'su-mirliton', nom: 'Mirliton bleu lac', rar: 'commune', club: 644, publie: false,
    texte: 'Il fait du bruit pour dix. Pas toujours en mesure.',
    mods: { mashBonus: 1.18, tempoWindow: 0.9 } },
  { id: 'su-planche-pont', nom: 'Planche peinte du vieux pont', rar: 'rare', club: 644, publie: false,
    texte: 'Elle tient au-dessus de l’eau depuis des siècles. Elle ne se presse jamais.',
    mods: { parryResist: 1.3, mashTime: 450 } },
  // Lugano
  { id: 'su-cornet-marrons', nom: 'Cornet de marrons chauds', rar: 'commune', club: 606, publie: false,
    texte: 'On y puise de quoi repartir. Les doigts brûlants ratent le geste fin.',
    mods: { refundBonus: 1.18, perfectBonus: 0.88 } },
  { id: 'su-manivelle', nom: 'Manivelle du funiculaire', rar: 'rare', club: 606, publie: false,
    texte: 'Le refrain monte sans s’arrêter. Pas un palier pour souffler.',
    mods: { tempoInterval: -60, breathBonus: 0.86 } },
  // Saint-Gall
  { id: 'su-de-coudre', nom: 'Dé à coudre vert et blanc', rar: 'commune', club: 1011, publie: false,
    texte: 'Le geste fin passe par le bout du doigt. Il ne tape pas.',
    mods: { perfectBonus: 1.18, mashBonus: 0.9 } },
  { id: 'su-cerceau-broderie', nom: 'Cerceau de broderie', rar: 'rare', club: 1011, publie: false,
    texte: 'Tu tiens tout le motif sans lâcher le fil. Le rythme attendra.',
    mods: { holdBonus: 1.28, tempoWindow: 0.86 } },
  // Servette
  { id: 'su-marmite', nom: 'Petite marmite grenat', rar: 'commune', club: 2184, publie: false,
    texte: 'On la casse en chantant. Elle ne protège de rien.',
    mods: { breathBonus: 1.18, parryResist: 0.9 } },
  { id: 'su-echelle', nom: 'Échelle des remparts', rar: 'rare', club: 2184, publie: false,
    texte: 'Chaque contre monte d’un barreau. Sur une échelle, on ne tient pas en place.',
    mods: { parryBonus: 1.3, holdBonus: 0.84 } },
  // Sion
  { id: 'su-gourde-glacier', nom: 'Gourde rouge du glacier', rar: 'commune', club: 630, publie: false,
    texte: 'Une gorgée d’eau de glace et la voix revient. Elle pèse au bout du bras.',
    mods: { breathBonus: 1.18, mashBonus: 0.9 } },
  { id: 'su-cloche-alpage', nom: 'Grande cloche de l’alpage', rar: 'rare', club: 630, publie: false,
    texte: 'Chaque coup sonne dans toute la vallée. Il faut le temps qu’elle se taise.',
    mods: { mashBonus: 1.28, tempoInterval: 70 } },
  // Thoune
  { id: 'su-sciure', nom: 'Sac de sciure', rar: 'commune', club: 1012, publie: false,
    texte: 'Une poignée et tu te relèves. Elle glisse entre les doigts.',
    mods: { refundBonus: 1.18, tempoWindow: 0.9 } },
  { id: 'su-planche-vague', nom: 'Planche de la vague du fleuve', rar: 'rare', club: 1012, publie: false,
    texte: 'Tu tiens la vague du refrain. Le premier choc te jette à l’eau.',
    mods: { tempoWindow: 1.28, parryResist: 0.86 } },
  // Vaduz
  { id: 'su-loupe', nom: 'Loupe de philatéliste', rar: 'commune', club: 660, publie: false,
    texte: 'Elle voit le geste juste dans le moindre détail. Elle ne tient rien.',
    mods: { perfectBonus: 1.18, holdBonus: 0.9 } },
  { id: 'su-luge', nom: 'Luge en bois rouge', rar: 'rare', club: 660, publie: false,
    texte: 'Le refrain file comme la piste. Rien à reprendre en route.',
    mods: { tempoInterval: -60, refundBonus: 0.86 } },
  // Young Boys
  { id: 'su-tresse-oignons', nom: 'Tresse d’oignons', rar: 'commune', club: 565, publie: false,
    texte: 'Elle tient tout le marché. Elle fait un peu pleurer.',
    mods: { holdBonus: 1.2, breathBonus: 0.9 } },
  { id: 'su-rouage', nom: 'Rouage de la tour de l’horloge', rar: 'rare', club: 565, publie: false,
    texte: 'Tout tourne à la seconde près. Rien ne force un rouage.',
    mods: { tempoWindow: 1.3, mashBonus: 0.84 } },
  // Zurich
  { id: 'su-casque-audio', nom: 'Casque audio blanc et bleu', rar: 'commune', club: 783, publie: false,
    texte: 'Le rythme dans les oreilles. Les coups, tu ne les entends pas venir.',
    mods: { tempoWindow: 1.18, parryBonus: 0.9 } },
  { id: 'su-poignee-tram', nom: 'Poignée du tram', rar: 'rare', club: 783, publie: false,
    texte: 'Tu tiens jusqu’au terminus. Il faut du temps pour lâcher.',
    mods: { holdBonus: 1.28, mashTime: 400 } },

  /* ----------------------------------------------------- la centième

     Hors série : elle ne s'ouvre avec aucune saison, mais quand on le
     décide, depuis CONTENUS. */
  { id: 'boite-souvenirs', nom: 'La boîte à souvenirs', rar: 'legendaire', publie: false,
    texte: 'Cent objets dedans, et tu les connais tous. Le temps de choisir, le refrain est passé.',
    mods: { perfectBonus: 1.3, holdBonus: 1.3, costPenalty: 1.2, tempoInterval: 120 } },
];

export const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));
export const STUFF_BY_ID = new Map(STUFF.map((s) => [s.id, s]));

/**
 * Les pièces qu'un Fanzzy porte, telles qu'un écran les dessine : l'identifiant
 * (le dessin), le nom (ce qu'on lit au toucher) et la rareté (le cadre).
 *
 * Deux au plus, dans l'ordre du sac — la borne de `combine` : une pièce que le
 * moteur ignore ne doit pas paraître portée. Une pièce inconnue du catalogue
 * (retirée depuis, ou un deck abîmé) est sautée plutôt que dessinée vide.
 */
export function piecesPortees(stuffIds = []) {
  return (Array.isArray(stuffIds) ? stuffIds : []).slice(0, 2)
    .map((id) => STUFF_BY_ID.get(id))
    .filter(Boolean)
    .map(({ id, nom, rar }) => ({ id, nom, rar }));
}

/* **Il n'y a plus de liste de cartes d'action ici.**
 *
 * Il y en avait une, de quatre lignes, présentée comme « les cartes du paquet de
 * bienvenue ». C'était une **seconde vérité** : le vrai catalogue vit dans
 * `src/shared/duel/actions.js`, et les deux ont divergé.
 *
 * `a-relance` — « Seconde jeunesse » — figurait ici et **n'existait pas** dans
 * le catalogue, où la carte s'appelle `a-secondsouffle`. Le paquet de bienvenue
 * tirait au hasard dans ces quatre-là : **un nouveau joueur sur quatre
 * repartait donc avec une carte d'action inexistante**. Elle était écrite dans
 * sa bourse, elle n'apparaissait dans aucun catalogue, et son deck la refusait
 * en « carte inconnue » — pour une carte qu'on venait de lui offrir.
 *
 * L'accueil des nouveaux importe maintenant `ACTIONS` de `duel/actions.js`,
 * comme tout le reste du jeu. */

/**
 * **Le revers d'une modification**, qui dépend de la clé : un facteur sous 1
 * est un revers, sauf `costPenalty`, qui coûte au-dessus de 1 ; un décalage
 * de cadence ou de martelage positif ralentit ; `holdForgive` négatif pardonne
 * moins. `backfire` ne s'adoucit pas : aucune pièce de club n'en porte.
 */
const FACTEURS = ['tempoWindow', 'mashBonus', 'holdBonus', 'perfectBonus',
  'parryBonus', 'parryResist', 'breathBonus', 'refundBonus', 'costPenalty'];
const DECALAGES = ['tempoInterval', 'mashTime', 'holdForgive'];

function estUnRevers(k, v) {
  if (k === 'costPenalty') return v > 1;
  if (FACTEURS.includes(k)) return v < 1;
  if (k === 'holdForgive') return v < 0;
  if (DECALAGES.includes(k)) return v > 0;
  return false;
}

/** La part du revers qu'efface le COMBO, réglée dans /admin (`stuff.club_revers`). */
export function partDuCombo() {
  return (reglage('stuff.club_revers') ?? 50) / 100;
}

/**
 * **Le COMBO** (demande de Gaël du 28 octobre 2026) : une pièce de club
 * portée par un Fanzzy lié au même club. Partout, quel que soit le match :
 * c'est le Fanzzy qui sait s'en servir, pas le joueur qui est chez lui.
 *
 * `clubDuPorteur` : le club du Fanzzy qui la porte (`clubDe`, ou le club
 * acheté), nul pour un neutre.
 */
export function faitCombo(piece, clubDuPorteur) {
  return piece?.club != null && clubDuPorteur != null
    && Number(piece.club) === Number(clubDuPorteur);
}

/**
 * Les modificateurs d'une pièce telle qu'elle est portée : ceux qu'elle
 * déclare, et au COMBO, son revers adouci de `part` (0,5 : moitié moins). Le
 * bonus ne bouge jamais — le combo ne rend pas plus fort, il gêne moins.
 */
export function modsDeLaPiece(piece, clubDuPorteur = null, part = partDuCombo()) {
  if (!piece) return {};
  if (!faitCombo(piece, clubDuPorteur) || !(part > 0)) return piece.mods;
  const out = {};
  for (const [k, v] of Object.entries(piece.mods)) {
    if (typeof v !== 'number' || !estUnRevers(k, v)) { out[k] = v; continue; }
    out[k] = FACTEURS.includes(k)
      ? Math.round((1 + (v - 1) * (1 - part)) * 1000) / 1000
      : Math.round(v * (1 - part));
  }
  return out;
}

/**
 * Combine les modificateurs du Fanzzy et des deux pièces portées.
 * Les facteurs se multiplient, les décalages s'additionnent : deux pièces qui
 * élargissent la fenêtre ne la rendent pas absurde, elles se composent.
 *
 * `club` : le club du Fanzzy qui les porte, pour le COMBO (`modsDeLaPiece`).
 */
export function combine(fanzzyMods = {}, stuffIds = [], { club = null } = {}) {
  const out = { ...fanzzyMods };

  for (const id of stuffIds.slice(0, 2)) {
    const s = STUFF_BY_ID.get(id);
    if (!s) continue;
    for (const [k, v] of Object.entries(modsDeLaPiece(s, club))) {
      if (FACTEURS.includes(k)) out[k] = (out[k] ?? 1) * v;
      else if (DECALAGES.includes(k)) out[k] = (out[k] ?? 0) + v;
      else out[k] = v;
    }
  }
  return out;
}
