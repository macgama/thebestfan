/**
 * Comment un Fanzzy grandit.
 *
 * Un personnage a trois âges. Le premier est écrit à la main — c'est lui qui
 * porte l'idée. Les deux suivants ont, eux, deux moitiés très différentes :
 *
 *   - **ce qu'il devient** — un nom, une histoire, un cri. Ça ne se calcule
 *     pas, ça s'écrit. C'est dans `dex-ages.js`, une entrée par personnage.
 *
 *   - **ce qu'il vaut** — ses modificateurs et la puissance de son cri. Ça, au
 *     contraire, ne doit surtout pas s'écrire à la main : quatre cent
 *     trente-cinq cartes réglées une par une, ce sont quatre cent trente-cinq
 *     occasions de se tromper, et aucun moyen de rattraper l'ensemble le jour
 *     où l'échelle bouge. Une règle, donc, tirée des sept lignées déjà
 *     équilibrées à la main.
 *
 * Ce que ces sept lignées disent, en trois observations :
 *
 * **Un bonus double, puis triple.** Le Choriste ouvre sa fenêtre de tempo de
 * 20 % ; le Meneur de chant de 45 %, le Capo de 70 %. C'est l'*écart à 1* qui
 * suit la progression, pas la valeur — sans quoi un petit bonus deviendrait
 * énorme et un gros, absurde.
 *
 * **Un malus s'efface.** Le Gamin de Devant respire mal (0,85) ; le Gamin du
 * Virage un peu mieux (0,92) ; le Gosse est Capo n'a plus le défaut du tout.
 * C'est ce qui rend l'évolution désirable au-delà des chiffres : le personnage
 * ne devient pas seulement plus fort, il se débarrasse de ce qui le gênait.
 *
 * **Chaque geste gagne sa marque au second âge.** La voix gagne de l'intervalle
 * de tempo, la percussion du temps de martelage, la fidélité une tolérance sur
 * la tenue. C'est ce qui fait qu'un stade 2 ne se joue pas comme un stade 1 en
 * plus gros — il se joue autrement.
 */

/** Les clés qui sont des multiplicateurs : au-dessus de 1 un bonus, en dessous un malus. */
const MULTIPLICATIFS = new Set(['tempoWindow', 'breathBonus', 'holdBonus', 'parryBonus',
  'perfectBonus', 'mashBonus', 'refundBonus', 'parryResist']);

/**
 * `costPenalty` est le mouton noir : c'est un multiplicateur dont **plus haut
 * veut dire pire**. Le traiter comme les autres ferait grandir le défaut au
 * lieu de le résorber, et le personnage deviendrait moins jouable en montant
 * de stade.
 */
const MALUS_INVERSES = new Set(['costPenalty']);

/** Ce que chaque geste gagne en grandissant, quand la carte ne l'a pas déjà. */
const MARQUE_DU_GESTE = {
  tempo: ['tempoInterval', 40, 80],
  mash: ['mashTime', -500, -800],
  hold: ['holdForgive', 1, 2],
};

/** Bornes, pour qu'aucune règle ne parte en vrille sur une valeur extrême. */
const PLAFONDS = { tempoInterval: 120, mashTime: -1400, holdForgive: 4 };

const arrondir = (v) => Math.round(v * 100) / 100;

/**
 * Applique la progression à un jeu de modificateurs.
 * @param {object} mods  les modificateurs du premier âge
 * @param {2|3} stade
 */
export function modsAuStade(mods, stade) {
  const facteur = stade === 2 ? 2 : 3;
  const out = {};

  for (const [k, v] of Object.entries(mods ?? {})) {
    if (typeof v === 'boolean') { out[k] = v; continue; }

    if (MULTIPLICATIFS.has(k)) {
      if (v > 1) { out[k] = arrondir(1 + (v - 1) * facteur); continue; }
      // Un malus se résorbe de moitié au deuxième âge et disparaît au
      // troisième. On l'omet alors au lieu d'écrire 1 : un modificateur neutre
      // encombrerait la fiche sans rien dire au joueur.
      if (stade === 2) out[k] = arrondir(1 - (1 - v) * 0.5);
      continue;
    }

    if (MALUS_INVERSES.has(k)) {
      if (stade === 2) out[k] = arrondir(1 + (v - 1) * 0.5);
      continue;
    }

    /* `holdForgive` compte des gestes pardonnés : 1, 2, 3. Il s'ajoute, il ne
       se multiplie pas — c'est ainsi que la lignée de l'Abonné progresse (0,
       puis 1, puis 2), et c'est la seule échelle qui ait un sens pour un
       nombre aussi petit.

       Le multiplier passait par l'arrondi à la dizaine des deux autres clés et
       ramenait 1 à **zéro** : la carte perdait sa tolérance en grandissant, et
       rien ne le signalait. */
    if (k === 'holdForgive') {
      out[k] = Math.min(PLAFONDS.holdForgive, v + (stade === 2 ? 1 : 2));
      continue;
    }

    if (k === 'tempoInterval' || k === 'mashTime') {
      // Additifs, et leur signe dit s'ils aident ou gênent : un
      // `tempoInterval` négatif et un `mashTime` positif sont des malus, et
      // suivent donc la même résorption que les autres.
      const aide = k === 'mashTime' ? v < 0 : v > 0;
      if (aide) {
        const brut = v * (stade === 2 ? 1.6 : 2.2);
        out[k] = k === 'mashTime'
          ? Math.max(PLAFONDS.mashTime, Math.round(brut / 50) * 50)
          : Math.min(PLAFONDS.tempoInterval, Math.round(brut / 10) * 10);
      } else if (stade === 2) {
        out[k] = Math.round((v * 0.5) / 10) * 10;
      }
      continue;
    }

    out[k] = v;                       // clé inconnue : on la laisse telle quelle
  }

  return out;
}

/**
 * Ajoute au jeu de modificateurs la marque du geste, si elle n'y est pas déjà.
 * Une carte qui la possède déjà l'a vue grandir par `modsAuStade` : la lui
 * rajouter écraserait sa propre valeur par la valeur générique.
 */
export function marqueDuGeste(mods, geste, stade) {
  const marque = MARQUE_DU_GESTE[geste];
  if (!marque) return mods;
  const [cle, v2, v3] = marque;
  if (mods[cle] !== undefined) return mods;
  return { ...mods, [cle]: stade === 2 ? v2 : v3 };
}

/**
 * La puissance du cri : **+13 par âge, en linéaire**.
 *
 * Les sept lignées montent de 12 à 16 points par cran, sans rapport avec leur
 * point de départ. Une progression en pourcentage aurait creusé l'écart — une
 * carte à 90 serait montée à 135 quand une carte à 44 plafonnerait à 66 — et
 * les cartes faibles ne rattraperaient jamais rien. En linéaire, l'évolution
 * profite surtout à qui en a besoin, ce qui est le contraire d'un mécanisme de
 * riche.
 */
export const puissanceAuStade = (p, stade) => p + (stade === 2 ? 13 : 26);

/** L'identifiant d'un âge : `TR1` → `TR1B`, `TR1C`. Court, et il trie à côté. */
export const idDuStade = (id, stade) => id + (stade === 2 ? 'B' : 'C');

/**
 * Construit les deuxième et troisième âges d'un personnage.
 *
 * @param {object} base   la carte du premier âge
 * @param {Array}  ecrits [[nom, histoire, cri], [nom, histoire, cri]]
 */
export function agesDe(base, ecrits) {
  return ecrits.map(([nom, histoire, cri], i) => {
    const stade = i + 2;
    const mods = marqueDuGeste(modsAuStade(base.mods, stade), base.cri?.gest, stade);
    return {
      id: idDuStade(base.id, stade),
      nom,
      type: base.type,
      set: base.set,
      stage: stade,
      // La rareté suit le stade, elle ne se décide plus carte par carte.
      rar: stade === 2 ? 'rare' : 'epique',
      // Le dernier âge ne mène nulle part : pas de champ `evo`.
      ...(stade === 2 ? { evo: idDuStade(base.id, 3) } : {}),
      histoire,
      mods,
      cri: { label: cri, gest: base.cri.gest,
        power: puissanceAuStade(base.cri.power, stade) },
    };
  });
}
