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
];

export const SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));
export const STUFF_BY_ID = new Map(STUFF.map((s) => [s.id, s]));

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
 * Combine les modificateurs du Fanzzy et des deux pièces portées.
 * Les facteurs se multiplient, les décalages s'additionnent : deux pièces qui
 * élargissent la fenêtre ne la rendent pas absurde, elles se composent.
 */
export function combine(fanzzyMods = {}, stuffIds = []) {
  const out = { ...fanzzyMods };
  const facteurs = ['tempoWindow', 'mashBonus', 'holdBonus', 'perfectBonus',
    'parryBonus', 'parryResist', 'breathBonus', 'refundBonus', 'costPenalty'];
  const decalages = ['tempoInterval', 'mashTime', 'holdForgive'];

  for (const id of stuffIds.slice(0, 2)) {
    const s = STUFF_BY_ID.get(id);
    if (!s) continue;
    for (const [k, v] of Object.entries(s.mods)) {
      if (facteurs.includes(k)) out[k] = (out[k] ?? 1) * v;
      else if (decalages.includes(k)) out[k] = (out[k] ?? 0) + v;
      else out[k] = v;
    }
  }
  return out;
}
