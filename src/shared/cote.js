/**
 * La cote d'un duelliste.
 *
 * ## Pourquoi une cote plutôt qu'un compte de victoires
 *
 * L'onglet DUELS classait sur le **nombre de victoires**. Ça récompense celui
 * qui joue beaucoup : quelqu'un qui gagne une fois sur deux mais joue trois
 * soirs par semaine passe devant quelqu'un qui gagne quatre fois sur cinq et
 * joue le samedi. Ce n'est pas faux — l'assiduité compte — mais ce n'est pas ce
 * que le mot « duelliste » promet.
 *
 * Une cote répond à une autre question : **contre qui as-tu gagné ?** Battre
 * quelqu'un de plus fort rapporte plus que battre quelqu'un de plus faible, et
 * perdre contre plus faible coûte plus que perdre contre plus fort. Le nombre de
 * parties cesse d'être l'ingrédient principal, et l'assiduité garde son tableau
 * à elle — celui des entraînements.
 *
 * ## Elo, et rien d'inventé
 *
 * C'est la formule des échecs, vieille de soixante ans, comprise de tout le
 * monde et facile à vérifier. En inventer une autre aurait demandé de
 * l'expliquer, de la défendre, et de découvrir ses défauts nous-mêmes.
 *
 *     attendu   = 1 / (1 + 10^((coteAdverse - coteMienne) / 400))
 *     nouvelle  = coteMienne + K × (résultat − attendu)
 *
 * `résultat` vaut 1 pour une victoire, 0,5 pour un nul, 0 pour une défaite.
 *
 * ## Les trois choix qui ne sont pas dans la formule
 *
 * **1. Un camp est noté par sa moyenne.** Un 3v3 n'est pas trois duels : c'est
 * une équipe contre une autre. Chaque joueur est donc évalué contre la **cote
 * moyenne du camp d'en face**, et tous les membres d'un camp gagnent ou perdent
 * la même chose. Les noter un par un contre un adversaire tiré au hasard
 * donnerait trois résultats différents pour une seule partie, et personne ne
 * saurait expliquer lequel est le sien.
 *
 * **2. K plus grand au début.** Les dix premières parties bougent la cote deux
 * fois plus vite : un nouveau venu doit rejoindre son niveau réel en une soirée,
 * pas en trois mois. Passé ce cap, la cote se stabilise, ce qui est toute son
 * utilité.
 *
 * **3. Une cote ne descend pas sous un plancher.** Sans lui, une série de
 * défaites peut envoyer quelqu'un à 200, d'où il ne remonte plus qu'en battant
 * des gens qui ne lui rapportent presque rien. Un plancher garde le jeu
 * jouable après une mauvaise semaine.
 *
 * ## Ce que la cote ne fait pas
 *
 * **Elle ne donne aucune puissance.** C'est la règle du jeu, écrite dans
 * `shared/niveau.js` : « le niveau ne donne aucune puissance ; s'il en avait,
 * l'ancienneté deviendrait de la force ». La cote classe, elle n'avantage pas —
 * elle ne change ni les cartes, ni les gains, ni l'appariement.
 *
 * Et **seules les parties classées comptent**. L'entraînement s'écrit, il ne
 * cote pas : c'est toute sa différence, et c'est le tri qui se fait à la
 * lecture partout ailleurs.
 */

/** La cote de départ. Le milieu conventionnel d'Elo, et celui que la colonne
    `duel_results.elo_before` porte comme défaut depuis le premier jour. */
export const COTE_DEPART = 1000;

/** En dessous, on ne descend plus. Voir le troisième choix, en tête. */
export const COTE_PLANCHER = 600;

/** Le coefficient ordinaire, et celui des débuts. */
export const K_NORMAL = 24;
export const K_DEBUT = 48;

/** Combien de parties classées durent les débuts. */
export const PARTIES_DEBUT = 10;

/**
 * Le coefficient qui s'applique à quelqu'un, selon son expérience.
 *
 * `jouees` compte les parties **classées** déjà jouées, celle-ci exclue.
 */
export function coefficient(jouees) {
  return Number(jouees) < PARTIES_DEBUT ? K_DEBUT : K_NORMAL;
}

/**
 * Ce qu'on attend d'une rencontre, entre 0 et 1.
 *
 * 0,5 à cotes égales ; 0,76 avec deux cents points d'avance ; 0,91 avec quatre
 * cents. C'est la courbe d'Elo, et elle n'a pas de paramètre à régler.
 */
export function attendu(mienne, adverse) {
  return 1 / (1 + 10 ** ((Number(adverse) - Number(mienne)) / 400));
}

/**
 * La cote après la partie.
 *
 * @param mienne   ma cote avant
 * @param adverse  la cote **moyenne** du camp d'en face
 * @param issue    'win', 'draw' ou 'loss'
 * @param jouees   mes parties classées d'avant, pour le coefficient
 */
export function apres(mienne, adverse, issue, jouees = 0) {
  const resultat = issue === 'win' ? 1 : issue === 'draw' ? 0.5 : 0;
  const k = coefficient(jouees);
  const brut = Number(mienne) + k * (resultat - attendu(mienne, adverse));
  /* Arrondi **avant** le plancher : arrondir après laisserait passer 599,6, qui
     s'afficherait 600 tout en étant sous la barre. */
  return Math.max(COTE_PLANCHER, Math.round(brut));
}

/**
 * La moyenne d'un camp, arrondie.
 *
 * Un camp vide rend la cote de départ : c'est le cas d'un duel entièrement
 * contre des machines, qui ne cote pas — mais mieux vaut un nombre sensé qu'un
 * `NaN` qui se propagerait jusqu'en base.
 */
export function moyenne(cotes) {
  /* **On écarte l'absence avant de convertir.** `Number(null)` vaut zéro, et
     zéro est un nombre fini : filtrer sur `Number.isFinite` après conversion
     laissait donc passer les absences et les comptait pour zéro. Un camp dont
     une cote manque voyait sa moyenne s'effondrer, et tout le monde en face
     gagnait beaucoup trop — ce qui ne se serait vu nulle part, une moyenne basse
     étant parfaitement plausible. */
  const liste = cotes
    .filter((v) => v !== null && v !== undefined && v !== '')
    .map(Number)
    .filter((n) => Number.isFinite(n));
  if (!liste.length) return COTE_DEPART;
  return Math.round(liste.reduce((a, b) => a + b, 0) / liste.length);
}
