/**
 * Les cartes d'action.
 *
 * Elles ne servent pas à faire des dégâts — la poussée vient des chants. Elles
 * servent à changer les règles pendant quelques secondes, et c'est de là que
 * vient la profondeur : deux tribunes qui poussent pareil se départagent sur
 * le moment où elles jouent leurs cartes.
 *
 * Sept familles de mécaniques, pour qu'aucun deck ne se joue comme un autre :
 *
 *   pousse    — un gain immédiat, sans geste
 *   entrave   — gêne l'adversaire sans lui retirer le contrôle
 *   souffle   — déplace la ressource plutôt que la corde
 *   geste     — modifie le mini-jeu lui-même, pour soi ou contre l'autre
 *   garde     — absorbe ou renvoie
 *   collectif — ne vaut que si les coéquipiers suivent : le cœur du NvN
 *   bascule   — ne se joue que dans une situation précise
 *
 * Chaque carte a un coût en souffle, un délai de réutilisation, et beaucoup
 * ont un revers. Une carte sans revers finit toujours par être la seule jouée.
 */

export const ACTIONS = [
  /* ------------------------------------------------------------- pousse */
  { id: 'a-fumigene', nom: 'Fumigène', fam: 'pousse', rar: 'commune', cost: 20, cd: 8,
    texte: 'Une poussée immédiate, sans geste à réussir.',
    effet: { type: 'push', valeur: 22 } },

  { id: 'a-craquage', nom: 'Craquage', fam: 'pousse', rar: 'rare', cost: 34, cd: 16,
    texte: 'Grosse poussée, mais ton souffle revient deux fois moins vite pendant 6 s.',
    effet: { type: 'push', valeur: 48 }, revers: { type: 'breath_mult', valeur: 0.5, duree: 6000 } },

  { id: 'a-torche', nom: 'Torche', fam: 'pousse', rar: 'commune', cost: 26, cd: 12,
    texte: 'Poussée moyenne. Double si ta tribune est en train de reculer.',
    effet: { type: 'push', valeur: 26, doubleSiMene: true } },

  /* ------------------------------------------------------------ entrave */
  { id: 'a-silence', nom: 'Silence radio', fam: 'entrave', rar: 'rare', cost: 30, cd: 20,
    texte: 'Coupe le souffle adverse 4 s. Leur colère monte pendant ce temps.',
    effet: { type: 'silence', duree: 4000 } },

  { id: 'a-brouillard', nom: 'Brouillard', fam: 'entrave', rar: 'rare', cost: 26, cd: 18,
    texte: 'Cache les cartes de l\u2019adversaire pendant 6 s. Il joue à l\u2019aveugle.',
    effet: { type: 'blind', duree: 6000 } },

  { id: 'a-parcage', nom: 'Parcage fermé', fam: 'entrave', rar: 'epique', cost: 38, cd: 26,
    texte: 'L\u2019adversaire ne peut plus jouer de carte d\u2019action pendant 8 s.',
    effet: { type: 'lock_actions', duree: 8000 } },

  /* ------------------------------------------------------------ souffle */
  { id: 'a-vol', nom: 'Vol de souffle', fam: 'souffle', rar: 'rare', cost: 22, cd: 14,
    texte: 'Prend 25 de souffle à l\u2019adversaire, t\u2019en rend 15.',
    effet: { type: 'steal', valeur: 25, rendu: 0.6 } },

  { id: 'a-thermos', nom: 'Thermos', fam: 'souffle', rar: 'commune', cost: 12, cd: 18,
    texte: 'Rend la moitié de ton souffle manquant.',
    effet: { type: 'refill', part: 0.5 } },

  { id: 'a-collecte', nom: 'Collecte', fam: 'souffle', rar: 'epique', cost: 30, cd: 30,
    texte: 'Rend 20 de souffle à toute ta tribune, toi compris.',
    effet: { type: 'team_breath', valeur: 20 } },

  /* -------------------------------------------------------------- geste */
  { id: 'a-metronome', nom: 'Métronome', fam: 'geste', rar: 'rare', cost: 24, cd: 20,
    texte: 'Tes deux prochains chants ont une fenêtre de tempo deux fois plus large.',
    effet: { type: 'mod_self', mods: { tempoWindow: 2 }, charges: 2 } },

  { id: 'a-vent', nom: 'Vent de face', fam: 'geste', rar: 'epique', cost: 32, cd: 24,
    texte: 'Rétrécit d\u2019un tiers la fenêtre de tempo adverse pendant 10 s.',
    effet: { type: 'mod_foe', mods: { tempoWindow: 0.66 }, duree: 10000 } },

  { id: 'a-secondsouffle', nom: 'Second souffle', fam: 'geste', rar: 'rare', cost: 28, cd: 22,
    texte: 'Ton prochain geste raté compte comme moyen au lieu de zéro.',
    effet: { type: 'floor_quality', valeur: 0.5, charges: 1 } },

  /* -------------------------------------------------------------- garde */
  { id: 'a-bache', nom: 'Bâche', fam: 'garde', rar: 'commune', cost: 24, cd: 15,
    texte: 'Absorbe la prochaine poussée adverse, jusqu\u2019à 40.',
    effet: { type: 'shield', valeur: 40 } },

  { id: 'a-miroir', nom: 'Renvoi', fam: 'garde', rar: 'legendaire', cost: 40, cd: 40,
    texte: 'La prochaine carte d\u2019action adverse se retourne contre elle.',
    effet: { type: 'reflect', charges: 1 } },

  /* ---------------------------------------------------------- collectif */
  { id: 'a-appel', nom: 'Appel du capo', fam: 'collectif', rar: 'rare', cost: 26, cd: 25,
    texte: 'Ouvre une fenêtre de 5 s : chaque coéquipier qui chante dedans pousse +40 %.',
    effet: { type: 'rally', duree: 5000, bonus: 1.4 } },

  { id: 'a-mosaique', nom: 'Mosaïque', fam: 'collectif', rar: 'epique', cost: 34, cd: 30,
    texte: 'Ne fait rien seul. Poussée de 18 par coéquipier ayant chanté dans les 10 s.',
    effet: { type: 'per_mate', valeur: 18, fenetre: 10000 } },

  { id: 'a-choeur', nom: 'Chœur', fam: 'collectif', rar: 'legendaire', cost: 30, cd: 45,
    texte: 'Toute la tribune doit taper dans la même seconde. Décuplé si tout le monde suit.',
    effet: { type: 'sync', duree: 3000, max: 10 } },

  /* ----------------------------------------------------------- bascule */
  { id: 'a-remontada', nom: 'Remontada', fam: 'bascule', rar: 'epique', cost: 30, cd: 60,
    texte: 'Jouable seulement si tu es mené d\u2019au moins un but. Grosse poussée.',
    effet: { type: 'push', valeur: 70 }, condition: { mene: 1 } },

  { id: 'a-arbitre', nom: 'Arbitre — changement', fam: 'bascule', rar: 'commune', cost: 18, cd: 20,
    texte: 'Fait entrer un autre Fanzzy de ton deck. Son équipement le suit.',
    effet: { type: 'swap_fanzzy' } },

  /**
   * La Relève : le personnage grandit en pleine partie.
   *
   * Tout le monde entre au premier âge — c'est la règle du deck. Ce que les
   * écharpes ont acheté, ce n'est pas un avantage acquis au coup d'envoi, c'est
   * le **droit de jouer cette carte**. Deux tribunes se rencontrent au même
   * niveau et l'écart se creuse sur ce qu'on joue.
   *
   * **Son vrai coût est ailleurs que dans le souffle.** Un joueur qui veut
   * faire grandir ses trois Fanzzy doit en embarquer trois exemplaires : trente
   * pour cent d'un deck en cartes qui ne poussent pas, ne gênent pas et ne
   * protègent pas. En face, celui qui n'a rien débloqué joue dix cartes d'effet
   * pur. L'arbitrage s'équilibre seul, sans table de réglage — et c'est ce qui
   * empêche la carte d'être un simple retard de vingt secondes sur la victoire
   * du joueur le plus riche.
   *
   * Commune, donc offerte : posséder la carte n'est pas une seconde barrière.
   * La seule barrière est d'avoir fait grandir le personnage.
   *
   * Un cran par carte. Atteindre le troisième âge en duel coûte donc deux
   * emplacements et deux moments de jeu : la montée en puissance se voit, et
   * elle pèse dans la construction du deck.
   */
  { id: 'a-releve', nom: 'Relève', fam: 'bascule', rar: 'commune', cost: 30, cd: 30,
    texte: 'Ton Fanzzy en tribune passe à son âge suivant, si tu l’as débloqué. '
      + 'Son équipement le suit.',
    effet: { type: 'evolve' }, condition: { evolution: true } },

  { id: 'a-prolongations', nom: 'Prolongations', fam: 'bascule', rar: 'legendaire', cost: 45, cd: 90,
    texte: 'Après la 75e minute du vrai match seulement. Double ta poussée pendant 15 s.',
    effet: { type: 'mod_self', mods: { pushMult: 2 }, duree: 15000 },
    condition: { minuteReelle: 75 } },
];

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

/* ------------------------------------------------- où une carte se joue */

/**
 * Ce que chaque sorte d'effet atteint.
 *
 * Trois portées, et une seule compte vraiment : `adverse`. Un effet marqué
 * ainsi va chercher quelqu'un en face — lui couper le souffle, lui cacher sa
 * main, lui prendre sa réserve.
 *
 * La table est ici, et pas une liste d'identifiants ailleurs, pour une raison
 * précise : une liste d'identifiants ne sait pas ce qu'elle contient. Le jour
 * où l'on ajoute une carte d'entrave, il faudrait penser à l'inscrire dans la
 * liste — et personne n'y pense. Déclarer la portée **sur la sorte d'effet**
 * fait que la carte se range toute seule.
 */
const PORTEE = {
  push: 'soi',
  refill: 'soi',
  team_breath: 'tribune',
  mod_self: 'soi',
  floor_quality: 'soi',
  breath_mult: 'soi',
  rally: 'tribune',
  per_mate: 'tribune',
  sync: 'tribune',
  swap_fanzzy: 'soi',
  evolve: 'soi',

  silence: 'adverse',
  blind: 'adverse',
  lock_actions: 'adverse',
  steal: 'adverse',
  mod_foe: 'adverse',
  /* La bâche et le renvoi n'agressent personne, et pourtant ils sont
     `adverse` : ils attendent **le geste d'en face** — la prochaine poussée
     adverse, la prochaine carte adverse. Dans une salle où la corde bouge en
     continu et où trois cents personnes jouent, « la prochaine poussée
     adverse » n'est pas un événement : c'est du bruit de fond. La carte
     n'aurait pas de moment. */
  shield: 'adverse',
  reflect: 'adverse',
};

/**
 * Une carte se joue-t-elle dans le Grand Virage ?
 *
 * **Le Virage n'est pas un duel avec plus de monde.** En face, il n'y a pas un
 * adversaire : il y a une foule d'inconnus. Une carte qui traverse y est soit
 * écrasante — une personne coupe le souffle de trois cents autres — soit nulle
 * une fois divisée par l'effectif. Les deux sont mauvais, et pour la même
 * raison : le Virage se joue **avec sa tribune**, pas contre l'autre.
 *
 * On garde donc ce qui agit sur soi ou sur les siens. L'effet de bord est le
 * meilleur de l'affaire : la famille `collectif` — la plus faible en un contre
 * un, où « chaque coéquipier » veut dire zéro personne — devient la reine du
 * Virage. Un deck de Virage cesse d'être un deck de duel, et c'est ce qui
 * donne une seconde vie aux dix emplacements.
 *
 * Le revers compte autant que l'effet : une carte dont la contrepartie viserait
 * l'adversaire serait refusée elle aussi.
 */
export function dansLeVirage(a) {
  if (!a?.effet) return false;
  const portee = (e) => PORTEE[e?.type] ?? 'adverse';
  return portee(a.effet) !== 'adverse'
    && (!a.revers || portee(a.revers) !== 'adverse');
}

/** Les cartes jouables au Virage, dans l'ordre du catalogue. */
export const ACTIONS_VIRAGE = ACTIONS.filter(dansLeVirage);

/**
 * Règles de construction du deck. Elles vivent ici pour être partagées.
 *
 * **Un deck incomplet est un deck valide.** Il fallait exactement trois Fanzzy,
 * et c'était un mur : un joueur qui vient d'ouvrir son premier booster n'en a
 * souvent qu'un ou deux, et il se voyait refuser l'entrée du virage par une
 * règle qu'il ne pouvait pas satisfaire. Il joue maintenant avec ce qu'il a —
 * simplement, avec un seul Fanzzy, il n'a personne à faire entrer en cours de
 * duel. La contrainte se paie en jeu au lieu de bloquer à la porte.
 *
 * L'équipement suit la même logique : deux pièces au plus, zéro accepté.
 */
export const DECK_RULES = {
  fanzzy: 3,          // au plus trois, dont un entre en jeu au coup d'envoi
  fanzzyMin: 1,       // au moins un, sinon il n'y a personne sur la corde
  stuffParFanzzy: 2,  // au plus deux pièces par Fanzzy, liées à lui
  actions: 10,        // exactement dix cartes d'action
  mainVisible: 5,     // cinq visibles à la fois, les autres arrivent en remplacement
  // Plus de plafond par carte : dix exemplaires de la même sont permis. La
  // limite de deux venait d'un temps où l'on supposait un large choix de
  // cartes ; en pratique un débutant en possède cinq, et dix emplacements à
  // remplir avec cinq cartes sans doublon est arithmétiquement impossible.
  copiesMax: null,
  /**
   * Tout le monde entre au premier âge.
   *
   * La règle est déjà vraie par construction — le deck ramène chaque Fanzzy à
   * son personnage, et le loadout ne met en tribune que son premier âge. Elle
   * est écrite ici parce que la page du deck l'annonce au joueur : sans ça,
   * quelqu'un qui a payé quatre-vingt-dix écharpes ne comprendrait pas pourquoi
   * son Capo entre en gamin, et il le prendrait pour un bug.
   *
   * Ce que les écharpes achètent, c'est la carte Relève : le droit de le faire
   * grandir en cours de partie, en y consacrant un de ses dix emplacements.
   */
  stadeEnJeu: 1,
};

/**
 * Valide un deck. Renvoie la liste des problèmes, vide si tout va bien.
 * `possede` décrit ce que le joueur a réellement : on ne fait jamais confiance
 * à ce que le client envoie.
 */
export function validerDeck(deck, possede) {
  const pb = [];
  const fanzzy = deck?.fanzzy ?? [];
  const actions = deck?.actions ?? [];

  /* Le nombre d'emplacements dépend du niveau : deux au départ, trois à partir
     du cinquième. `possede.fanzzyMax` porte ce plafond, et vaut le maximum de
     la règle quand l'appelant ne le renseigne pas — un test qui monte le deck
     seul, ou une installation sans progression, se comportent comme avant.

     Le plafond est aussi **borné par la règle** : un niveau ne pourra jamais
     ouvrir un quatrième emplacement sans qu'on l'ait décidé ici. */
  const maxFanzzy = Math.min(DECK_RULES.fanzzy, possede?.fanzzyMax ?? DECK_RULES.fanzzy);
  if (fanzzy.length < DECK_RULES.fanzzyMin || fanzzy.length > maxFanzzy) {
    pb.push({ code: 'deck.error.fanzzy_count',
      min: DECK_RULES.fanzzyMin, max: maxFanzzy });
  }
  if (new Set(fanzzy.map((f) => f.id)).size !== fanzzy.length) {
    pb.push({ code: 'deck.error.fanzzy_duplicate' });
  }
  for (const f of fanzzy) {
    if (!possede.fanzzy.has(f.id)) pb.push({ code: 'deck.error.fanzzy_not_owned', id: f.id });
    const stuff = f.stuff ?? [];
    if (stuff.length > DECK_RULES.stuffParFanzzy) {
      pb.push({ code: 'deck.error.too_much_stuff', id: f.id });
    }
    for (const s of stuff) {
      if (!possede.stuff.has(s)) pb.push({ code: 'deck.error.stuff_not_owned', id: s });
    }
  }

  // Une pièce d'équipement est un objet, pas une licence : elle ne peut pas
  // être portée par deux Fanzzy à la fois.
  const toutStuff = fanzzy.flatMap((f) => f.stuff ?? []);
  if (new Set(toutStuff).size !== toutStuff.length) {
    pb.push({ code: 'deck.error.stuff_shared' });
  }

  if (actions.length !== DECK_RULES.actions) {
    pb.push({ code: 'deck.error.actions_count', attendu: DECK_RULES.actions });
  }
  const compte = {};
  for (const a of actions) {
    if (!ACTION_BY_ID.has(a)) { pb.push({ code: 'deck.error.action_unknown', id: a }); continue; }
    if (!possede.actions.has(a)) pb.push({ code: 'deck.error.action_not_owned', id: a });
    compte[a] = (compte[a] ?? 0) + 1;
    // `copiesMax: null` veut dire « aucun plafond ». On garde le test plutôt
    // que de supprimer la règle : le jour où l'on voudra en remettre un, il
    // suffira d'écrire un nombre.
    if (DECK_RULES.copiesMax != null && compte[a] > DECK_RULES.copiesMax) {
      pb.push({ code: 'deck.error.too_many_copies', id: a });
    }
  }

  // Un deck sans « arbitre » enferme le joueur sur son premier Fanzzy : ce
  // n'est pas interdit, mais il vaut mieux le lui dire.
  const avertissements = actions.includes('a-arbitre') ? []
    : [{ code: 'deck.warn.no_substitution' }];

  // Le piège le plus silencieux du nouveau modèle : quelqu'un a payé pour faire
  // grandir un Fanzzy, il l'aligne, et il entre en gamin sans que rien ne le
  // lui explique. Il en conclura que son achat n'a servi à rien. La carte
  // Relève est le seul moyen d'en profiter en duel : si elle manque alors qu'il
  // y a quelque chose à relever, on le dit.
  const relevables = fanzzy.filter((f) => (possede?.stades?.[f?.id] ?? 1) > 1);
  if (relevables.length && !actions.includes('a-releve')) {
    avertissements.push({ code: 'deck.warn.no_evolution_card',
      ids: relevables.map((f) => f.id) });
  }

  /* Et le cas inverse, qui est le plus fréquent au début. « Relève » est une
     commune : elle est offerte à tout le monde, y compris à qui n'a jamais fait
     évoluer un Fanzzy. Elle occupe alors un emplacement sur dix pour ne rien
     faire — une carte morte que rien ne signale, dans le deck de quelqu'un qui
     découvre le jeu et qui conclura que le duel est mal réglé. */
  const releves = actions.filter((a) => a === 'a-releve').length;
  if (releves && !relevables.length) {
    avertissements.push({ code: 'deck.warn.useless_evolution_card', n: releves });
  }

  return { valide: pb.length === 0, problemes: pb, avertissements };
}
