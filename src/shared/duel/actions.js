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
  { id: 'a-fumigene', nom: 'Fumigène', fam: 'pousse', rar: 'd1', cost: 20, cd: 8,
    texte: 'Une poussée immédiate, sans geste à réussir.',
    effet: { type: 'push', valeur: 22 } },

  { id: 'a-craquage', nom: 'Craquage', fam: 'pousse', rar: 'd2', cost: 34, cd: 16,
    texte: 'Grosse poussée, mais ton souffle revient deux fois moins vite pendant 6 s.',
    effet: { type: 'push', valeur: 48 }, revers: { type: 'breath_mult', valeur: 0.5, duree: 6000 } },

  { id: 'a-torche', nom: 'Torche', fam: 'pousse', rar: 'd1', cost: 26, cd: 12,
    texte: 'Poussée moyenne. Double si ta tribune est en train de reculer.',
    effet: { type: 'push', valeur: 26, doubleSiMene: true } },

  /* ------------------------------------------------------------ entrave */
  { id: 'a-silence', nom: 'Silence radio', fam: 'entrave', rar: 'd2', cost: 30, cd: 20,
    texte: 'Coupe le souffle adverse 4 s. Leur colère monte pendant ce temps.',
    effet: { type: 'silence', duree: 4000 } },

  { id: 'a-brouillard', nom: 'Brouillard', fam: 'entrave', rar: 'd2', cost: 26, cd: 18,
    texte: 'Cache les cartes de l\u2019adversaire pendant 6 s. Il joue à l\u2019aveugle.',
    effet: { type: 'blind', duree: 6000 } },

  { id: 'a-parcage', nom: 'Parcage fermé', fam: 'entrave', rar: 'd3', cost: 38, cd: 26,
    texte: 'L\u2019adversaire ne peut plus jouer de carte d\u2019action pendant 8 s.',
    effet: { type: 'lock_actions', duree: 8000 } },

  /* ------------------------------------------------------------ souffle */
  { id: 'a-vol', nom: 'Vol de souffle', fam: 'souffle', rar: 'd2', cost: 22, cd: 14,
    texte: 'Prend 25 de souffle à l\u2019adversaire, t\u2019en rend 15.',
    effet: { type: 'steal', valeur: 25, rendu: 0.6 } },

  { id: 'a-thermos', nom: 'Thermos', fam: 'souffle', rar: 'd1', cost: 12, cd: 18,
    texte: 'Rend la moitié de ton souffle manquant.',
    effet: { type: 'refill', part: 0.5 } },

  { id: 'a-collecte', nom: 'Collecte', fam: 'souffle', rar: 'd3', cost: 30, cd: 30,
    texte: 'Rend 20 de souffle à toute ta tribune, toi compris.',
    effet: { type: 'team_breath', valeur: 20 } },

  /* -------------------------------------------------------------- geste */
  { id: 'a-metronome', nom: 'Métronome', fam: 'geste', rar: 'd2', cost: 24, cd: 20,
    texte: 'Tes deux prochains chants ont une fenêtre de tempo deux fois plus large.',
    effet: { type: 'mod_self', mods: { tempoWindow: 2 }, charges: 2 } },

  { id: 'a-vent', nom: 'Vent de face', fam: 'geste', rar: 'd3', cost: 32, cd: 24,
    texte: 'Rétrécit d\u2019un tiers la fenêtre de tempo adverse pendant 10 s.',
    effet: { type: 'mod_foe', mods: { tempoWindow: 0.66 }, duree: 10000 } },

  { id: 'a-secondsouffle', nom: 'Second souffle', fam: 'geste', rar: 'd2', cost: 28, cd: 22,
    texte: 'Ton prochain geste raté compte comme moyen au lieu de zéro.',
    effet: { type: 'floor_quality', valeur: 0.5, charges: 1 } },

  /* -------------------------------------------------------------- garde */
  { id: 'a-bache', nom: 'Bâche', fam: 'garde', rar: 'd1', cost: 24, cd: 15,
    texte: 'Absorbe la prochaine poussée adverse, jusqu\u2019à 40.',
    effet: { type: 'shield', valeur: 40 } },

  { id: 'a-miroir', nom: 'Renvoi', fam: 'garde', rar: 'star', cost: 40, cd: 40,
    texte: 'La prochaine carte d\u2019action adverse se retourne contre elle.',
    effet: { type: 'reflect', charges: 1 } },

  /* ---------------------------------------------------------- collectif */
  { id: 'a-appel', nom: 'Appel du capo', fam: 'collectif', rar: 'd2', cost: 26, cd: 25,
    texte: 'Ouvre une fenêtre de 5 s : chaque coéquipier qui chante dedans pousse +40 %.',
    effet: { type: 'rally', duree: 5000, bonus: 1.4 } },

  { id: 'a-mosaique', nom: 'Mosaïque', fam: 'collectif', rar: 'd3', cost: 34, cd: 30,
    texte: 'Ne fait rien seul. Poussée de 18 par coéquipier ayant chanté dans les 10 s.',
    effet: { type: 'per_mate', valeur: 18, fenetre: 10000 } },

  { id: 'a-choeur', nom: 'Chœur', fam: 'collectif', rar: 'star', cost: 30, cd: 45,
    texte: 'Toute la tribune doit taper dans la même seconde. Décuplé si tout le monde suit.',
    effet: { type: 'sync', duree: 3000, max: 10 } },

  /* ----------------------------------------------------------- bascule */
  { id: 'a-remontada', nom: 'Remontada', fam: 'bascule', rar: 'd3', cost: 30, cd: 60,
    texte: 'Jouable seulement si tu es mené d\u2019au moins un but. Grosse poussée.',
    effet: { type: 'push', valeur: 70 }, condition: { mene: 1 } },

  { id: 'a-arbitre', nom: 'Arbitre — changement', fam: 'bascule', rar: 'd1', cost: 18, cd: 20,
    texte: 'Fait entrer un autre Fanzzy de ton deck. Son équipement le suit.',
    effet: { type: 'swap_fanzzy' } },

  { id: 'a-prolongations', nom: 'Prolongations', fam: 'bascule', rar: 'crown', cost: 45, cd: 90,
    texte: 'Après la 75e minute du vrai match seulement. Double ta poussée pendant 15 s.',
    effet: { type: 'mod_self', mods: { pushMult: 2 }, duree: 15000 },
    condition: { minuteReelle: 75 } },
];

export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

/** Règles de construction du deck. Elles vivent ici pour être partagées. */
export const DECK_RULES = {
  fanzzy: 3,          // exactement trois, dont un entre en jeu au coup d'envoi
  stuffParFanzzy: 2,  // au plus deux pièces par Fanzzy, liées à lui
  actions: 10,        // exactement dix cartes d'action
  mainVisible: 5,     // cinq visibles à la fois, les autres arrivent en remplacement
  copiesMax: 2,       // pas plus de deux exemplaires d'une même carte
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

  if (fanzzy.length !== DECK_RULES.fanzzy) {
    pb.push({ code: 'deck.error.fanzzy_count', attendu: DECK_RULES.fanzzy });
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
    if (compte[a] > DECK_RULES.copiesMax) pb.push({ code: 'deck.error.too_many_copies', id: a });
  }

  // Un deck sans « arbitre » enferme le joueur sur son premier Fanzzy : ce
  // n'est pas interdit, mais il vaut mieux le lui dire.
  const avertissements = actions.includes('a-arbitre') ? []
    : [{ code: 'deck.warn.no_substitution' }];

  return { valide: pb.length === 0, problemes: pb, avertissements };
}
