/**
 * La légende entre en jeu, elle n'y est pas au coup d'envoi.
 *
 * ## Pourquoi
 *
 * Un Fanzzy légendaire se tire d'un booster, et une pièce légendaire porte les
 * modificateurs les plus francs du sac. Rien ne les encadrait : un joueur qui
 * en avait gagné un l'alignait dès la première seconde, et un nouveau venu
 * affrontait d'entrée ce qu'il ne pouvait pas encore avoir. L'ancienneté
 * devenait de la puissance — exactement ce que `niveau.js` refuse au niveau.
 *
 * Gaël a choisi le 7 octobre 2026 la règle « Entrée en jeu » :
 *
 * — **Un seul légendaire par deck**, Fanzzy ou pièce d'équipement confondus.
 * — **Il commence sur le banc.** Un Fanzzy légendaire ne peut pas être
 *   titulaire ; une pièce légendaire ne fait rien tant qu'il dort.
 * — **Il s'éveille après `legende.chants` chants réussis** (BON ou PARFAIT) du
 *   joueur, une fois par duel ou par match de Virage. Le Fanzzy légendaire
 *   peut alors entrer : l'éveil offre un changement gratuit. La pièce se met
 *   à compter d'elle-même.
 *
 * Le compte est **celui du joueur**, pas celui de son camp : au Virage, une
 * tribune de cent personnes réussit cinq chants en une seconde, et la règle
 * n'y voudrait plus rien dire.
 *
 * Les légendaires déjà gagnés restent à leur propriétaire : la règle décide
 * quand ils jouent, elle ne confisque rien.
 */
import { reglage } from './reglages.js';
import { verdictDe, auMoins } from './verdict.js';

export const LEGENDAIRE = 'legendaire';

/** Le nombre de chants réussis qui éveille la légende. Zéro : éveillée d'emblée. */
export function seuilLegende() {
  const n = Number(reglage('legende.chants'));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 5;
}

/** Un chant compte pour l'éveil s'il est au moins BON, sur la note du geste. */
export const chantReussi = (note) => auMoins(verdictDe(note), 'bon');

/**
 * Les refus de deck propres aux légendaires.
 *
 * `rarete` est facultatif : sans lui (un test qui monte un deck à la main),
 * aucune règle de légende ne s'applique, comme avant.
 *
 * @param {{fanzzy: {id: string, stuff?: string[]}[]}} deck
 * @param {{fanzzy: (id: string) => string|undefined,
 *          stuff: (id: string) => string|undefined}} [rarete]
 * @returns {{code: string, [k: string]: unknown}[]}
 */
export function refusLegendes(deck, rarete) {
  if (!rarete) return [];
  const pb = [];
  const fanzzy = deck?.fanzzy ?? [];
  const legendes = [];
  fanzzy.forEach((f, i) => {
    if (rarete.fanzzy(f?.id) === LEGENDAIRE) legendes.push({ type: 'fanzzy', id: f.id, rang: i });
    for (const s of f?.stuff ?? []) {
      if (rarete.stuff(s) === LEGENDAIRE) legendes.push({ type: 'stuff', id: s, rang: i });
    }
  });
  if (legendes.length > 1) {
    pb.push({ code: 'deck.error.legende_une_seule', ids: legendes.map((l) => l.id) });
  }
  if (fanzzy.length && rarete.fanzzy(fanzzy[0]?.id) === LEGENDAIRE) {
    pb.push({ code: 'deck.error.legende_titulaire', id: fanzzy[0].id });
  }
  return pb;
}

/**
 * Le deck tel qu'il entre en jeu, ramené à la règle.
 *
 * Un deck enregistré avant la règle peut porter un légendaire titulaire, ou
 * plusieurs légendaires. On ne le refuse pas à l'entrée d'un duel — le joueur
 * n'y est pour rien —, on le joue selon la règle :
 *
 * — le premier légendaire rencontré (Fanzzy d'abord, dans l'ordre du deck,
 *   puis les pièces) est **la** légende ; les autres restent hors du jeu
 *   (Fanzzy retirés, pièces ôtées du sac) ;
 * — un Fanzzy légendaire titulaire passe derrière le premier remplaçant qui
 *   ne l'est pas. Seul au deck, il reste en tribune, mais il dort comme les
 *   autres : ses modificateurs ne comptent qu'à l'éveil.
 *
 * Rend une copie : `{ fanzzy: [{ id, stuff, legende, stuffLegende }] }`, où
 * `legende` marque le Fanzzy légendaire et `stuffLegende` la pièce
 * légendaire qu'il porte, s'il en porte une.
 */
export function selonLaRegle(fanzzy, rarete) {
  let prise = false;
  const garde = [];
  // Les Fanzzy d'abord : un légendaire en personne passe avant une pièce.
  for (const f of fanzzy ?? []) {
    const leg = rarete.fanzzy(f?.id) === LEGENDAIRE;
    if (leg && prise) continue;
    if (leg) prise = true;
    garde.push({ ...f, stuff: [...(f.stuff ?? [])], legende: leg, stuffLegende: null });
  }
  for (const f of garde) {
    f.stuff = f.stuff.filter((s) => {
      if (rarete.stuff(s) !== LEGENDAIRE) return true;
      if (prise) return false;
      prise = true;
      f.stuffLegende = s;
      return true;
    });
  }
  if (garde.length > 1 && garde[0].legende) {
    const i = garde.findIndex((f) => !f.legende);
    if (i > 0) garde.unshift(...garde.splice(i, 1));
  }
  return garde;
}
