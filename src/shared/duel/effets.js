/**
 * La tenue des effets.
 *
 * Un effet, c'est une entrée posée sur quelqu'un : `{ type, fin?, charges?,
 * mods?, valeur? }`. Quatre gestes suffisent à tout ce que le jeu en fait — en
 * poser un, nettoyer ceux qui sont finis, demander si l'un est actif, et
 * empiler les modificateurs qu'ils portent.
 *
 * ## Pourquoi un module partagé
 *
 * Le duel avait ces quatre gestes ; le Grand Virage en avait besoin des mêmes
 * le jour où les cartes d'action y sont entrées. Les recopier, c'était se
 * donner deux réponses à « un effet qui se renouvelle s'empile-t-il ? » et
 * « une charge à zéro compte-t-elle encore ? » — et ces deux réponses-là ne
 * divergent pas bruyamment : elles divergent en silence, pendant des mois.
 *
 * ## Ce qui n'est **pas** ici, et ne doit pas y venir
 *
 * La résolution d'une carte. Elle ressemble beaucoup d'un côté à l'autre et
 * elle est pourtant différente pour de bonnes raisons : au duel une poussée
 * vaut sa valeur, au Virage elle est divisée par l'effectif de la tribune ;
 * une fenêtre collective y est mise à l'échelle de la foule. Fondre les deux
 * `appliquer` en un seul demanderait une exception à presque chaque ligne, et
 * c'est le genre de partage qui coûte plus cher qu'il ne rapporte.
 *
 * Ce qui est commun ici, c'est la **mécanique** d'un effet. Ce qui reste chez
 * chacun, c'est ce que l'arène en fait.
 */

/**
 * Pose un effet sur quelqu'un.
 *
 * Un même type ne s'empile pas : il se renouvelle. Deux Métronomes joués coup
 * sur coup ne donnent pas quatre chants à fenêtre large, ils en donnent deux —
 * sinon la carte la plus jouable du jeu serait celle qu'on spamme.
 */
export function poserEffet(j, effet) {
  j.effets = (j.effets ?? []).filter((e) => e.type !== effet.type);
  j.effets.push(effet);
}

/** Retire ce qui est expiré, et ce qui n'a plus de charge. */
export function nettoyerEffets(j, t) {
  j.effets = (j.effets ?? []).filter(
    (e) => (!e.fin || e.fin > t) && (e.charges === undefined || e.charges > 0));
}

/** Un effet de ce type est-il actif ? */
export const aEffet = (j, type, t) =>
  (j.effets ?? []).some((e) => e.type === type && (!e.fin || (t > 0 && e.fin > t)));

/**
 * Les modificateurs en vigueur : ceux du personnage, plus ceux des effets.
 *
 * Deux façons de composer, et le choix n'est pas cosmétique. Une **fenêtre**
 * ou un **barème** se multiplie : deux effets qui élargissent la fenêtre de
 * tempo de moitié la doublent, ce qui reste une proportion. Un **temps** en
 * millisecondes s'additionne : `tempoInterval` et `mashTime` sont des durées,
 * et multiplier une durée par un barème donnerait des nombres sans rapport
 * avec le geste qu'on demande au joueur.
 *
 * @param base  les modificateurs du personnage, avant effets.
 */
export function modsAvecEffets(base, effets, t) {
  const out = { ...(base ?? {}) };
  for (const e of effets ?? []) {
    if (e.fin && t > e.fin) continue;
    if (!e.mods) continue;
    for (const [k, v] of Object.entries(e.mods)) {
      out[k] = typeof v === 'number' && k !== 'tempoInterval' && k !== 'mashTime'
        ? (out[k] ?? 1) * v
        : (out[k] ?? 0) + v;
    }
  }
  return out;
}
