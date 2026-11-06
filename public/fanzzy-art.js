/**
 * Dessin des Fanzzy — source unique.
 *
 * Ce fichier existait en double avant : le classeur savait dessiner un Fanzzy,
 * et l'accueil en avait besoin à son tour. Recopier cent lignes de SVG aurait
 * refait exactement la faute du catalogue, qui a divergé jusqu'à ce qu'une
 * carte tirée d'un booster casse la page. Une seule définition, donc.
 *
 * Script classique, pas module : tout ce qui vit dans `public/` est chargé par
 * une balise `<script src>` ordinaire, et `verif-pages.mjs` compile ces
 * fichiers comme tels. On expose donc un global, comme `fx.js` et `nav.js`.
 *
 * Le catalogue, lui, n'est pas ici : il vient de `/api/fanzzy/dex`. Ce module
 * ne connaît que la manière de dessiner, jamais la liste de ce qu'il dessine.
 * La table des types est fournie par la page via `setTypes()`.
 */
(() => {
  /**
   * Le format d'image servi. La règle est écrite une seule fois, dans
   * `fanzzy-etats.js` — pourquoi on ne la devine plus, et pourquoi le WebP est
   * le format de tout le monde, s'y lisent en entier. Ce module la reprend de
   * là quand elle est chargée, et garde la même valeur en dur sinon : il sert
   * des pages — le classeur, la boutique — qui n'ont pas besoin des états.
   *
   * **Deux extensions, pas une**, et c'est la faute qu'on corrige ici : un
   * Fanzzy est détouré, il n'existe qu'en AVIF, WebP et PNG. Le `.jpg` que
   * l'ancienne détection servait à tout ce qui n'est pas Chrome ne désignait
   * aucun fichier du dépôt — d'où l'accueil sans personnage. Le JPEG reste le
   * dernier recours des **photos** : décors, cartes d'action, chants.
   */
  const IMG_EXT = window.TBF_ETATS?.EXT ?? '.webp';
  const IMG_EXT_ALPHA = window.TBF_ETATS?.EXT_ALPHA ?? '.webp';

  /**
   * L'adresse de secours d'un dessin détouré qui n'a pas pu se charger.
   *
   * On remplace l'extension, on ne coupe pas la fin de la chaîne : une adresse
   * d'état porte sa révision — `portrait.webp?v=3` —, et `slice` en rendait
   * `portrait.webp?v` suivi de `.png`, c'est-à-dire un second 404 à la place du
   * repli. `fanzzy-etats.js` sait déjà le faire ; on le refait ici à
   * l'identique pour les pages qui ne le chargent pas.
   */
  const secours = (src) => window.TBF_ETATS?.secours?.(src)
    ?? String(src).replace(/\.(avif|webp|png|jpe?g)(?=$|\?)/i, '.png');

  /** Table des types, renseignée par la page une fois le catalogue reçu. */
  let TYPES = {};
  const setTypes = (t) => { TYPES = t ?? {}; };

  /**
   * Un type inconnu ne doit pas casser un dessin : une page peut demander un
   * Fanzzy avant que le catalogue soit arrivé, ou après l'ajout d'un type que
   * sa version ne connaît pas. On retombe sur la craie plutôt que sur une
   * exception qui viderait toute la grille.
   */
  const couleur = (f) => TYPES[f.type]?.c ?? '#C2CAD6';

  let uid = 0;

  /** Générateur pseudo-aléatoire stable : un Fanzzy se dessine toujours pareil. */
  function seeded(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909);
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }

  /**
   * Fanzzy disposant d'une illustration dessinée.
   *
   * Le reste du catalogue garde le rendu procédural : mieux vaut un dessin
   * géométrique cohérent qu'un trou en attendant l'illustration. On ajoute
   * simplement les identifiants ici au fur et à mesure — `verif-pages.mjs`
   * vérifie que les six fichiers existent avant de laisser livrer.
   */
  const ILLUSTRES = new Set([
    'TR32', 'TR32B', 'TR32C', 'MS30', 'MS30B', 'MS30C', 'TR33', 'TR33B',
    'TR33C', 'MS31', 'MS31B', 'MS31C', 'TR34', 'TR34B', 'TR34C', 'MS32',
    'MS32B', 'MS32C', 'TR35', 'MT14', 'TR36', 'GD10', 'GD11', 'TR37',
    'TR38', 'TR39', 'TR40', 'GC15', 'GC16', 'TR41', 'TR42', 'VP15',
    'BG28', 'TR43', 'TR44', 'TR45', 'TR46', 'GC17', 'TR47', 'TR48',
    'TR49', 'MS34', 'TR50', 'TR51', 'TR52', 'TR53', 'GD12', 'GD13',
    'MS35', 'HC15', 'HC16', 'TR54', 'IM1', 'IM2', 'IM3', 'IM4',
    'IM5', 'IM6', 'IM7', 'IM8', 'IM9', 'IM12', 'IM13', 'IM14',
    'IM15', 'IM16', 'IM17', 'TR1', 'TR2', 'TR3', 'TR4', 'TR5',
    'TR6', 'TR7', 'TR8', 'TR9', 'TR10', 'TR11', 'TR12', 'TR13',
    'TR14', 'TR15', 'TR16', 'TR17', 'TR18', 'TR19', 'TR20', 'TR21',
    'TR22', 'TR23', 'TR24', 'TR25', 'TR26', 'TR27', 'TR60', 'TR61',
    'TR62', 'TR63', 'TR64', 'TR65', 'TR66', 'TR67', 'TR68', 'MS1',
    'MS2', 'MS3', 'MS4', 'MS5', 'MS6', 'MS7', 'MS8', 'MS9',
    'MS10', 'MS11', 'MS12', 'MS13', 'MS14', 'MS15', 'MS16', 'MS17',
    'MS18', 'MS19', 'MS20', 'MS21', 'MS22', 'MS23', 'MS24', 'MS25',
    'MS26', 'BG1', 'BG2', 'BG3', 'BG4', 'BG5', 'BG6', 'BG7',
    'BG8', 'BG9', 'BG10', 'BG11', 'BG12', 'BG13', 'BG14', 'BG15',
    'BG16', 'BG17', 'BG18', 'BG19', 'BG20', 'BG21', 'BG22', 'BG23',
    'RV1', 'RV2', 'RV3', 'RV4', 'RV5', 'RV6', 'RV7', 'RV8',
    'RV9', 'RV10', 'RV11', 'RV12', 'RV13', 'RV14', 'RV15', 'RV16',
    'RV17', 'RV18', 'RV19', 'RV20', 'RV21', 'OB1', 'OB2', 'OB3',
    'OB4', 'OB5', 'OB6', 'OB7', 'OB8', 'OB9', 'OB10', 'OB11',
    'OB12', 'EP1', 'EP2', 'EP3', 'EP4', 'EP5', 'EP6', 'EP7',
    'EP8', 'EP9', 'EP10', 'EP11', 'EP12', 'EP13', 'EP14', 'EP15',
    'EP16', 'EP17', 'TR55', 'TR56', 'TR57', 'TR58', 'TR59', 'GD14',
    'GD15', 'GD16', 'TR28', 'TR29', 'TR30', 'TR31', 'VP1', 'VP2',
    'VP3', 'VP4', 'VP5', 'VP6', 'VP7', 'VP8', 'VP9', 'VP10',
    'VP11', 'VP12', 'VP13', 'VP14', 'VP16', 'VP17', 'VP18', 'VP19',
    'VP20', 'VP21', 'VP22', 'VP23', 'VP24', 'VP25', 'VP26', 'VP27',
    'VP28', 'VP29', 'VP30', 'VP31', 'VP32', 'VP33', 'VP34', 'VP35',
    'VP36', 'VP37', 'VP38', 'VP39', 'VP40', 'VP41', 'VP42', 'VP43',
    'VP44', 'VP45', 'VP46', 'VP47', 'VP48', 'VP49', 'VP50', 'GC1',
    'GD1', 'GD2', 'GD3', 'GD4', 'GD5', 'GD6', 'GD7', 'GD8',
    'GD9', 'GD17', 'GD18', 'GD19', 'GD20', 'GD21', 'GD22', 'GD23',
    'GD24', 'GD25', 'GD26', 'GD27', 'GD28', 'GD29', 'GD30', 'GD31',
    'GD33', 'GD34', 'GD35', 'GD36', 'GD37', 'GD38', 'GD39', 'GD40',
    'GD41', 'GD42', 'GD43', 'GD44', 'GD45', 'GD46', 'GD47', 'GD48',
    'GD49', 'GD50', 'GD51', 'GD52', 'MT1', 'MT2', 'MT3', 'MT4',
    'MT5', 'MT6', 'MT7', 'MT8', 'MT9', 'MT10', 'MT11', 'MT12',
    'MT13', 'MT15', 'MT16', 'MT17', 'MT18', 'MT19', 'MT20', 'MT21',
    'MT22', 'MT23', 'MT24', 'MT25', 'MT26', 'MT27', 'MT28', 'MT29',
    'MT30', 'MT31', 'MT32', 'MT33', 'MT34', 'MT35', 'MT36', 'MT37',
    'MT38', 'MT39', 'MT40', 'MT41', 'MT42', 'MT43', 'MT44', 'MT45',
    'MT46', 'MT47', 'MT48', 'MT49', 'MT50', 'HC1', 'HC2', 'HC3',
    'HC4', 'HC5', 'HC6', 'HC7', 'HC8', 'HC9', 'HC10', 'HC11',
    'HC12', 'HC13', 'HC14', 'HC17', 'HC18', 'HC19', 'HC20', 'HC21',
    'HC22', 'HC23', 'HC24', 'HC25', 'HC26', 'HC27', 'HC28', 'HC29',
    'HC30', 'HC31', 'HC32', 'HC33', 'HC34', 'HC35', 'HC36', 'HC37',
    'HC38', 'HC39', 'HC40', 'HC41', 'HC42', 'HC43', 'HC44', 'HC45',
    'HC46', 'HC47', 'HC48', 'HC49', 'HC50', 'HC51', 'RP1', 'RP1B',
    'RP1C', 'RP2', 'RP2B', 'RP2C', 'RP18', 'RP18B', 'RP18C', 'RP19',
    'RP19B', 'RP19C', 'RP20', 'RP20B', 'RP20C', 'RP3', 'RP3B', 'RP3C',
    'RP4', 'RP4B', 'RP4C', 'RP21', 'RP21B', 'RP21C', 'RP22', 'RP22B',
    'RP22C', 'RP23', 'RP23B', 'RP23C', 'RP5', 'RP5B', 'RP5C', 'RP6',
    'RP6B', 'RP6C', 'RP24', 'RP24B', 'RP24C', 'RP25', 'RP25B', 'RP25C',
    'RP26', 'RP26B', 'RP26C', 'RP7', 'RP7B', 'RP7C', 'RP8', 'RP8B',
    'RP8C', 'RP27', 'RP27B', 'RP27C', 'RP28', 'RP28B', 'RP28C', 'RP29',
    'RP29B', 'RP29C', 'RP9', 'RP9B', 'RP9C', 'RP10', 'RP10B', 'RP10C',
    'RP30', 'RP30B', 'RP30C', 'RP31', 'RP31B', 'RP31C', 'RP32', 'RP32B',
    'RP32C', 'RP11', 'RP11B', 'RP11C', 'RP12', 'RP12B', 'RP12C', 'RP33',
    'RP33B', 'RP33C', 'RP34', 'RP34B', 'RP34C', 'RP35', 'RP35B', 'RP35C',
    'RP13', 'RP14', 'RP15', 'RP16', 'RP17', 'AN1', 'AN2', 'AN3',
    'AN4', 'AN5', 'AN6', 'AN7', 'AN8', 'AN9', 'AN10', 'AN11',
    'AN12', 'AN13', 'AN14', 'AN15', 'AN16', 'AN17', 'AN18', 'AN19',
    'AN20', 'AN21', 'AN22', 'AN23', 'AN24', 'AN25', 'AN26', 'AN27',
    'AN28', 'AN29', 'AN30', 'AN31', 'AN32', 'AN33', 'AN34', 'AN35',
    'AN36', 'AN37', 'AN38', 'AN39', 'AN40', 'AN41', 'AN42', 'AN43',
    'AN44', 'AN45', 'AN46', 'AN47', 'AN48', 'AN49', 'AN50', 'AN51',
    'AN52', 'AN53', 'AN54', 'AN55', 'AN56', 'AN57', 'AN58', 'AN59',
    'AN60', 'AN61', 'AN62', 'AN63', 'AN64', 'AN65', 'AN66', 'SU1',
    'SU2', 'SU3', 'SU4', 'SU5', 'SU6', 'SU7', 'SU8', 'SU9',
    'SU10', 'SU11', 'SU12', 'SU13', 'SU14', 'SU15', 'SU16', 'SU17',
    'SU18', 'SU19', 'SU20', 'SU21', 'SU22', 'SU23', 'SU24', 'SU25',
    'SU26', 'SU27', 'SU28', 'SU29', 'SU30', 'SU31', 'SU32', 'SU33',
    'SU34', 'SU35', 'SU36', 'SU37', 'SU38', 'SU39', 'SU40', 'SU41',
    'SU42', 'TR1B', 'TR1C', 'TR3B', 'TR3C', 'TR23B', 'TR23C', 'MT14B',
    'MT14C', 'TR50B', 'TR50C', 'VP15B', 'VP15C', 'HC15B', 'HC15C', 'HC17B',
    'HC17C', 'HC18B', 'HC18C', 'HC19B', 'HC19C', 'HC20B', 'HC20C', 'HC21B',
    'HC21C', 'HC22B', 'HC22C', 'HC23B', 'HC23C', 'HC24B', 'HC24C', 'HC25B',
    'HC25C', 'HC26B', 'HC26C', 'HC27B', 'HC27C', 'HC28B', 'HC28C', 'HC29B',
    'HC29C', 'HC30B', 'HC30C', 'HC31B', 'HC31C', 'HC32B', 'HC32C', 'HC33B',
    'HC33C', 'HC34B', 'HC34C', 'HC35B', 'HC35C', 'HC36B', 'HC36C', 'HC37B',
    'HC37C', 'HC38B', 'HC38C', 'HC39B', 'HC39C', 'HC40B', 'HC40C', 'HC41B',
    'HC41C', 'HC42B', 'HC42C', 'HC43B', 'HC43C', 'HC44B', 'HC44C', 'HC45B',
    'HC45C', 'HC46B', 'HC46C', 'HC47B', 'HC47C', 'HC48B', 'HC48C', 'HC49B',
    'HC49C', 'HC50B', 'HC50C', 'HC51B', 'HC51C', 'VP1B', 'VP1C', 'VP2B',
    'VP2C', 'VP3B', 'VP3C', 'VP4B', 'VP4C', 'VP5B', 'VP5C', 'VP6B',
    'VP6C', 'VP7B', 'VP7C', 'VP8B', 'VP8C', 'VP9B', 'VP9C', 'VP16B',
    'VP16C', 'VP17B', 'VP17C', 'VP18B', 'VP18C', 'VP19B', 'VP19C', 'VP20B',
    'VP20C', 'VP21B', 'VP21C', 'VP22B', 'VP22C', 'VP23B', 'VP23C', 'VP24B',
    'VP24C', 'VP25B', 'VP25C', 'VP26B', 'VP26C', 'VP27B', 'VP27C', 'VP28B',
    'VP28C', 'VP29B', 'VP29C', 'VP30B', 'VP30C', 'VP31B', 'VP31C', 'VP32B',
    'VP32C', 'VP33B', 'VP33C', 'VP34B', 'VP34C', 'VP35B', 'VP35C', 'VP36B',
    'VP36C', 'VP37B', 'VP37C', 'VP38B', 'VP38C', 'VP39B', 'VP39C', 'VP40B',
    'VP40C', 'VP41B', 'VP41C', 'VP42B', 'VP42C', 'VP43B', 'VP43C', 'VP44B',
    'VP44C', 'VP45B', 'VP45C', 'VP46B', 'VP46C', 'VP47B', 'VP47C', 'VP48B',
    'VP48C', 'VP49B', 'VP49C', 'VP50B', 'VP50C', 'GD1B', 'GD1C', 'GD2B',
    'GD2C', 'GD3B', 'GD3C', 'GD4B', 'GD4C', 'GD5B', 'GD5C', 'GD6B',
    'GD6C', 'GD7B', 'GD7C', 'GD8B', 'GD8C', 'GD9B', 'GD9C', 'GD17B',
    'GD17C', 'GD18B', 'GD18C', 'GD19B', 'GD19C', 'GD20B', 'GD20C', 'GD21B',
    'GD21C', 'GD22B', 'GD22C', 'GD23B', 'GD23C', 'GD24B', 'GD24C', 'GD25B',
    'GD25C', 'GD26B', 'GD26C', 'GD27B', 'GD27C', 'GD28B', 'GD28C', 'GD29B',
    'GD29C', 'GD30B', 'GD30C', 'GD31B', 'GD31C', 'GD33B', 'GD33C', 'GD34B',
    'GD34C', 'GD35B', 'GD35C', 'GD36B', 'GD36C', 'GD37B', 'GD37C', 'GD38B',
    'GD38C', 'GD39B', 'GD39C', 'GD40B', 'GD40C', 'GD41B', 'GD41C', 'GD42B',
    'GD42C', 'GD43B', 'GD43C', 'GD44B', 'GD44C', 'GD45B', 'GD45C', 'GD46B',
    'GD46C', 'GD47B', 'GD47C', 'GD48B', 'GD48C', 'GD49B', 'GD49C', 'GD50B',
    'GD50C', 'GD51B', 'GD51C', 'GD52B', 'GD52C', 'MT1B', 'MT1C', 'MT2B',
    'MT2C', 'MT3B', 'MT3C', 'MT4B', 'MT4C', 'MT5B', 'MT5C', 'MT6B',
    'MT6C', 'MT7B', 'MT7C', 'MT8B', 'MT8C', 'MT15B', 'MT15C', 'MT16B',
    'MT16C', 'MT17B', 'MT17C', 'MT18B', 'MT18C', 'MT19B', 'MT19C', 'MT20B',
    'MT20C', 'MT21B', 'MT21C', 'MT22B', 'MT22C', 'MT23B', 'MT23C', 'MT24B',
    'MT24C', 'MT25B', 'MT25C', 'MT26B', 'MT26C', 'MT27B', 'MT27C', 'MT28B',
    'MT28C', 'MT29B', 'MT29C', 'MT30B', 'MT30C', 'MT31B', 'MT31C', 'MT32B',
    'MT32C', 'MT33B', 'MT33C', 'MT34B', 'MT34C', 'MT35B', 'MT35C', 'MT36B',
    'MT36C', 'MT37B', 'MT37C', 'MT38B', 'MT38C', 'MT39B', 'MT39C', 'MT40B',
    'MT40C', 'MT41B', 'MT41C', 'MT42B', 'MT42C', 'MT43B', 'MT43C', 'MT44B',
    'MT44C', 'MT45B', 'MT45C', 'MT46B', 'MT46C', 'MT47B', 'MT47C', 'MT48B',
    'MT48C', 'MT49B', 'MT49C', 'MT50B', 'MT50C', 'HC1B', 'HC1C', 'HC2B',
    'HC2C', 'HC3B', 'HC3C', 'HC4B', 'HC4C', 'HC5B', 'HC5C', 'HC6B',
    'HC6C', 'HC7B', 'HC7C', 'HC8B', 'HC8C', 'HC9B', 'HC9C', 'AN1B',
    'AN1C', 'AN2B', 'AN2C', 'AN3B', 'AN3C', 'AN4B', 'AN4C', 'AN5B',
    'AN5C', 'AN6B', 'AN6C', 'AN7B', 'AN7C', 'AN8B', 'AN8C', 'AN9B',
    'AN9C', 'AN10B', 'AN10C', 'AN11B', 'AN11C', 'AN12B', 'AN12C', 'AN13B',
    'AN13C', 'AN14B', 'AN14C', 'AN15B', 'AN15C', 'AN16B', 'AN16C', 'AN17B',
    'AN17C', 'AN18B', 'AN18C', 'AN19B', 'AN19C', 'AN20B', 'AN20C', 'AN21B',
    'AN21C', 'AN22B', 'AN22C', 'AN23B', 'AN23C', 'AN24B', 'AN24C', 'AN25B',
    'AN25C', 'AN26B', 'AN26C', 'AN27B', 'AN27C', 'AN28B', 'AN28C', 'AN29B',
    'AN29C', 'AN30B', 'AN30C', 'AN31B', 'AN31C', 'AN32B', 'AN32C', 'AN33B',
    'AN33C', 'AN34B', 'AN34C', 'AN35B', 'AN35C', 'AN36B', 'AN36C', 'AN37B',
    'AN37C', 'AN38B', 'AN38C', 'AN39B', 'AN39C', 'AN40B', 'AN40C', 'AN41B',
    'AN41C', 'AN42B', 'AN42C', 'AN43B', 'AN43C', 'AN44B', 'AN44C', 'AN45B',
    'AN45C', 'AN46B', 'AN46C', 'AN47B', 'AN47C', 'AN48B', 'AN48C', 'AN49B',
    'AN49C', 'AN50B', 'AN50C', 'AN51B', 'AN51C', 'AN52B', 'AN52C', 'AN53B',
    'AN53C', 'AN54B', 'AN54C', 'AN55B', 'AN55C', 'AN56B', 'AN56C', 'AN57B',
    'AN57C', 'AN58B', 'AN58C', 'AN59B', 'AN59C', 'AN60B', 'AN60C', 'SU1B',
    'SU1C', 'SU2B', 'SU2C', 'SU3B', 'SU3C', 'SU4B', 'SU4C', 'SU5B',
    'SU5C', 'SU6B', 'SU6C', 'SU7B', 'SU7C', 'SU8B', 'SU8C', 'SU9B',
    'SU9C', 'SU10B', 'SU10C', 'SU11B', 'SU11C', 'SU12B', 'SU12C', 'SU13B',
    'SU13C', 'SU14B', 'SU14C', 'SU15B', 'SU15C', 'SU16B', 'SU16C', 'SU17B',
    'SU17C', 'SU18B', 'SU18C', 'SU19B', 'SU19C', 'SU20B', 'SU20C', 'SU21B',
    'SU21C', 'SU22B', 'SU22C', 'SU23B', 'SU23C', 'SU24B', 'SU24C', 'SU25B',
    'SU25C', 'SU26B', 'SU26C', 'SU27B', 'SU27C', 'SU28B', 'SU28C', 'SU29B',
    'SU29C', 'SU30B', 'SU30C', 'SU31B', 'SU31C', 'SU32B', 'SU32C', 'SU33B',
    'SU33C', 'SU34B', 'SU34C', 'SU35B', 'SU35C', 'SU36B', 'SU36C',
    'FR1', 'FR1B', 'FR1C', 'FR2', 'FR2B', 'FR2C', 'FR3', 'FR3B',
    'FR3C', 'FR4', 'FR4B', 'FR4C', 'FR5', 'FR5B', 'FR5C', 'FR6',
    'FR6B', 'FR6C', 'FR7', 'FR7B', 'FR7C', 'FR8', 'FR8B', 'FR8C',
    'FR9', 'FR9B', 'FR9C', 'FR10', 'FR10B', 'FR10C', 'FR11', 'FR11B',
    'FR11C', 'FR12', 'FR12B', 'FR12C', 'FR13', 'FR13B', 'FR13C', 'FR14',
    'FR14B', 'FR14C', 'FR15', 'FR15B', 'FR15C', 'FR16', 'FR16B', 'FR16C',
    'FR17', 'FR17B', 'FR17C', 'FR18', 'FR18B', 'FR18C', 'FR19', 'FR19B',
    'FR19C', 'FR20', 'FR20B', 'FR20C', 'FR21', 'FR21B', 'FR21C', 'FR22',
    'FR22B', 'FR22C', 'FR23', 'FR23B', 'FR23C', 'FR24', 'FR24B', 'FR24C',
    'FR25', 'FR25B', 'FR25C', 'FR26', 'FR26B', 'FR26C', 'FR27', 'FR27B',
    'FR27C', 'FR28', 'FR28B', 'FR28C', 'FR29', 'FR29B', 'FR29C', 'FR30',
    'FR30B', 'FR30C', 'FR31', 'FR31B', 'FR31C', 'FR32', 'FR32B', 'FR32C',
    'FR33', 'FR33B', 'FR33C', 'FR34', 'FR34B', 'FR34C', 'FR35', 'FR35B',
    'FR35C', 'FR36', 'FR36B', 'FR36C', 'FR37', 'FR37B', 'FR37C', 'FR38',
    'FR38B', 'FR38C', 'FR39', 'FR39B', 'FR39C', 'FR40', 'FR40B', 'FR40C',
    'FR41', 'FR41B', 'FR41C', 'FR42', 'FR42B', 'FR42C', 'FR43', 'FR43B',
    'FR43C', 'FR44', 'FR44B', 'FR44C', 'FR45', 'FR45B', 'FR45C',
    'FR46', 'FR46B', 'FR46C', 'FR47', 'FR47B', 'FR47C', 'FR48', 'FR48B',
    'FR48C', 'FR49', 'FR49B', 'FR49C', 'FR50', 'FR50B', 'FR50C', 'FR51',
    'FR51B', 'FR51C', 'FR52', 'FR52B', 'FR52C', 'FR53', 'FR53B', 'FR53C',
    'FR54', 'FR54B', 'FR54C', 'FR55', 'FR56', 'FR57', 'FR58', 'FR59',
    'FR60',
  ]);

  /**
   * L'empreinte de chaque illustration, que porte son adresse.
   *
   * **Une carte redessinée restait l'ancienne chez qui l'avait déjà vue.**
   * Les images sont servies « immuables, un an » et le service worker les
   * garde sans les redemander : c'est juste tant qu'un dessin ne change pas,
   * et RP1 a changé de visage le 24 septembre sous la même adresse. Les
   * états portaient déjà leur révision (`joie.webp?v=6`) ; les cartes, non.
   * Avec l'empreinte, un nouveau dessin a une nouvelle adresse.
   *
   * Réécrite par `scripts/maj-illustres.mjs`, avec ILLUSTRES — ne pas
   * modifier à la main. Le calcul est dans `scripts/empreinte-illustration.mjs`.
   */
  const EMPREINTES = {
    TR32: 'f976862bf7', TR32B: '4cd7add98f', TR32C: '8ce6354ad8', MS30: 'cc495cf87f',
    MS30B: '8c203c52db', MS30C: 'dbff0fa4e3', TR33: 'cd23f0e1a9', TR33B: '2c100904a1',
    TR33C: '677e61bc31', MS31: '73b80e4e92', MS31B: '4afbe967c5', MS31C: '99e8ff525e',
    TR34: 'f0c92de515', TR34B: 'c623d150e6', TR34C: '6fd443caba', MS32: '1b77de8fa1',
    MS32B: '56ede9f174', MS32C: 'c7b831d37c', TR35: '9786ebdb5a', MT14: '6612218b6f',
    TR36: '02508e8d0f', GD10: '431c56bd84', GD11: 'e4b7c7342e', TR37: 'eeab16d1f0',
    TR38: 'd929f72fc6', TR39: '0c2398585c', TR40: '79022b59c8', GC15: 'b057c91b09',
    GC16: '79225b4375', TR41: '6ad1fb581e', TR42: '181451ed8d', VP15: '71dabff276',
    BG28: '63cd5ec38a', TR43: '30cfc0be89', TR44: '728409cf93', TR45: '97f354c9d9',
    TR46: 'b8c363407b', GC17: 'e363c49767', TR47: '7ee74a9972', TR48: '6d1dcf1c70',
    TR49: '1377a1d016', MS34: 'e92987b456', TR50: 'f5e01316c2', TR51: 'e06bf969cb',
    TR52: 'ff7d6ad9cc', TR53: '00e0eb334c', GD12: '156fd6dde1', GD13: '7405b411c4',
    MS35: '15270428fc', HC15: '6e94a5dba2', HC16: 'a6b09c64a6', TR54: 'c90d1a6080',
    IM1: '2a2a628f91', IM2: 'd2cb42df8b', IM3: '04e8d7158d', IM4: '47ac4b8c5c',
    IM5: 'b755653ce1', IM6: '3f2a7f93fe', IM7: 'fd33407cb7', IM8: 'cbdb34fc24',
    IM9: '77ee7dc8bd', IM12: '6b77e37583', IM13: 'cf5bc2e54f', IM14: '943a445722',
    IM15: '4c9279250b', IM16: '39b7610af9', IM17: 'e3aef3884b', TR1: '062cea48ea',
    TR2: '33f6488c90', TR3: '3889fb90ca', TR4: '39761f3bb4', TR5: '375ebc1c0c',
    TR6: 'fc013ad3d5', TR7: 'e6a3d3c459', TR8: '693e68db4f', TR9: '7ebe82a885',
    TR10: 'f22fd644a3', TR11: '6905710fc9', TR12: '983da3a9ae', TR13: 'f3ce893e89',
    TR14: '2757d8bc12', TR15: 'ed79e72b8d', TR16: '987c731098', TR17: 'd7b61aeaf7',
    TR18: 'b65da643d4', TR19: '3dc8708311', TR20: '2fa8f10318', TR21: '59b1e22d57',
    TR22: '2f60bc0520', TR23: '35364eae5e', TR24: '7e8f5ec763', TR25: '51670de651',
    TR26: '75647026fb', TR27: '514abc9558', TR60: '93d09d23c4', TR61: '13af417ed1',
    TR62: '2de8134b29', TR63: '18b00ec881', TR64: '7b3367b254', TR65: '13c5c193ff',
    TR66: 'e6572e1027', TR67: '5218068b5b', TR68: 'da62413763', MS1: 'e4c754162b',
    MS2: '44e2b3c9e1', MS3: '3a0cd8c3d8', MS4: '6a839b7cd3', MS5: 'bcd83ed2d5',
    MS6: '83bd0aa7f1', MS7: 'd731dc414f', MS8: 'd06bafa67a', MS9: '75bcbc4bc7',
    MS10: '82ac5d3e79', MS11: 'e019e0e7c3', MS12: '8c31de9aa4', MS13: 'eecb9aa478',
    MS14: '57b2ee3bb3', MS15: 'c13c8af82d', MS16: '79f6be37a6', MS17: '27fd6c6cf8',
    MS18: '8f1ed37933', MS19: '86ee201ddc', MS20: 'ce9ed8ceb5', MS21: 'e39480d7d8',
    MS22: '36c8acd348', MS23: '6f413888eb', MS24: 'fdf298ff7b', MS25: '52592c5073',
    MS26: '5cde135476', BG1: '0d4ee84fd6', BG2: '80c6335603', BG3: '96599ee6fc',
    BG4: '4950e22cfa', BG5: '6ca45f0ff6', BG6: '2fc2d51d24', BG7: 'fe3d0c519a',
    BG8: '895062d0ab', BG9: '606da17258', BG10: '0311373a8c', BG11: '2c5958a449',
    BG12: '0433580256', BG13: '07522d1556', BG14: '6208c6dfd5', BG15: '5152154c76',
    BG16: 'f0fd6d36fa', BG17: '3b57fa25d7', BG18: '442c6d3988', BG19: '24694c122d',
    BG20: '7974905645', BG21: 'bc366a7fc3', BG22: '4077abfeb3', BG23: '3644dce9ee',
    RV1: 'b4ba3d4b18', RV2: 'a2309dd99b', RV3: '02dc044c0a', RV4: '02da8791e5',
    RV5: 'cbd2852fd8', RV6: 'eed4fc6528', RV7: '4cd6b951d6', RV8: 'ced59013df',
    RV9: '0c489d6165', RV10: 'c5b537554a', RV11: '41814a8c1b', RV12: '5158b94dda',
    RV13: 'ef2fdbb443', RV14: '5c0e1db8b9', RV15: 'b4bf9c7a27', RV16: 'c6095792e6',
    RV17: '74e1188ecc', RV18: '1862a34e6e', RV19: '9ca6b07730', RV20: 'c6ae94b7c1',
    RV21: '5b002e4144', OB1: '3f57c9a865', OB2: '519ad77327', OB3: '8e06838c48',
    OB4: 'a9ab8c8f52', OB5: '1bd2b182e6', OB6: 'd62a4cee2e', OB7: '2838fed583',
    OB8: '8330f7cc05', OB9: 'a131ac629f', OB10: 'd0fc78a894', OB11: '0e3109d88b',
    OB12: 'b921557cf4', EP1: '55021262bd', EP2: '90da17304a', EP3: 'a0d20661c2',
    EP4: 'dbe410e97d', EP5: '150b1c4d3a', EP6: '8b6553f1bb', EP7: 'e5561c5248',
    EP8: '5de7ac7ac3', EP9: '015129713c', EP10: 'd8e23a0588', EP11: '82b5b842e4',
    EP12: 'ff264eb246', EP13: '5fedcf0db6', EP14: '8960fad06c', EP15: 'd3cb14e319',
    EP16: '34cd3ed320', EP17: '53fc9ba534', TR55: '7e3a0de849', TR56: '29252a3e3f',
    TR57: 'c618da2c53', TR58: 'd90e103ad6', TR59: '796910e11e', GD14: 'c827f38f29',
    GD15: '06e2033502', GD16: '2ddc328fa4', TR28: '79a759aa85', TR29: 'e8fd96211b',
    TR30: '41c0bbc75f', TR31: 'b52bd33437', VP1: '1a94067467', VP2: 'ec9c75281b',
    VP3: '58631f7a13', VP4: '1f9c899608', VP5: '34d7859f27', VP6: 'a68da25697',
    VP7: 'ff31ea02d3', VP8: '8ee51cff21', VP9: '87aca218bf', VP10: 'c1ee773984',
    VP11: 'cb5a8a3ea8', VP12: 'c958df7d22', VP13: 'fc2d3c0279', VP14: '5e00cc59d1',
    VP16: '128cdbcde2', VP17: '653e86ac30', VP18: 'a0f2f45b1b', VP19: 'b0e2c83d6a',
    VP20: '59422c5aa2', VP21: '91c72ac8e8', VP22: 'd5e51539c4', VP23: '4a71647d93',
    VP24: '86a235dd98', VP25: 'ad9a859395', VP26: '1e9d1b16cf', VP27: 'fcc345a199',
    VP28: 'b46c79feec', VP29: '51c1a0885a', VP30: '0f565e3f94', VP31: '17e977fff7',
    VP32: '755659e7cf', VP33: '9dd9bbbe50', VP34: '371c68e6ba', VP35: '169c39114a',
    VP36: 'bc581c0025', VP37: '3a09ceaa6b', VP38: '06c9ffa903', VP39: 'ed1201c0f8',
    VP40: '4a78c6fc90', VP41: '79f6ebf929', VP42: '2147d060b7', VP43: '13a7767a68',
    VP44: 'c702c9fd3b', VP45: '19abc70160', VP46: '9bd6f13a90', VP47: '9dbeb81c1f',
    VP48: '4893fd96fe', VP49: 'bdb2eba3eb', VP50: '35e41d2b39', GC1: '098816b9d2',
    GD1: '9689658e16', GD2: '30b570de96', GD3: 'ffc805bb1a', GD4: '4c2ac76259',
    GD5: '369ee05e10', GD6: '4d3775ca84', GD7: 'b111639815', GD8: '44e187d962',
    GD9: '6955403906', GD17: '0be0e80679', GD18: '8c2c4d2969', GD19: 'e6c1ae250c',
    GD20: 'a6de3acfb9', GD21: '899b8a3d59', GD22: 'e5bd2a9ed8', GD23: 'a6f9b33b93',
    GD24: '50793c31a7', GD25: 'c44e029ecd', GD26: 'dd858ec234', GD27: 'b438080d70',
    GD28: 'b7514ae3f3', GD29: '1d332e3607', GD30: 'edbdd63e35', GD31: '94a5bfece3',
    GD33: '24da339960', GD34: 'f5c399df41', GD35: '20cc9022ad', GD36: '3192314440',
    GD37: '73581f02b5', GD38: '51749ca56a', GD39: '0c4cc277e1', GD40: 'c2c82b189d',
    GD41: '4aa53264eb', GD42: 'f7071dd159', GD43: 'f300008c5e', GD44: '5bd7995936',
    GD45: 'ec806e0144', GD46: '722bcac2d9', GD47: 'd59a192a10', GD48: '95a2b4aa0d',
    GD49: '8e258c8953', GD50: 'e141f30369', GD51: '9eced97235', GD52: 'a519c4e7f6',
    MT1: '5658944c7d', MT2: '57865447cf', MT3: 'a9f9791c11', MT4: 'e23427a4be',
    MT5: '2149126e10', MT6: '2a637507e2', MT7: 'ae84527426', MT8: '1cac05492e',
    MT9: '75d17f919a', MT10: '949c0cc873', MT11: 'a314b3c588', MT12: '5eb1861156',
    MT13: 'a9725143e2', MT15: 'ff3ee0abef', MT16: 'b6c62562b7', MT17: '7366f30b81',
    MT18: '206393b281', MT19: '304fbd8861', MT20: 'b564f2f5c7', MT21: 'd9b8fa06fc',
    MT22: '322df09848', MT23: '78d90825d1', MT24: '2a6d823e92', MT25: '97ca411d65',
    MT26: 'cb34e29558', MT27: '68e9bedd1d', MT28: '9ca9b3960c', MT29: 'f776d10de3',
    MT30: '33116855d9', MT31: 'd1d4920517', MT32: 'cb938c9515', MT33: 'd3d3d2329d',
    MT34: '6288d538a7', MT35: 'ac41f2c462', MT36: '833b21acac', MT37: '0473048f3c',
    MT38: '3c1226d152', MT39: 'cb2d6c8095', MT40: '2c2ca29101', MT41: 'e9543647e6',
    MT42: '3316a32c22', MT43: '648267ba3e', MT44: '5934e54f59', MT45: 'db18218e66',
    MT46: '1c62930f65', MT47: 'ec648d5b0e', MT48: '60ecb73cdb', MT49: '52c2c197ee',
    MT50: '39affbf098', HC1: 'e196091ecf', HC2: '31bb04b7b6', HC3: '21d7218c0d',
    HC4: '1784735cb6', HC5: 'afb862ff26', HC6: 'e4b15a3e07', HC7: 'a5214cef6d',
    HC8: '891cdef4ee', HC9: '08a4b2cb6e', HC10: 'f5965418f9', HC11: '6a7fe7b5e1',
    HC12: 'ba432aa10b', HC13: '1382ff2a35', HC14: '634bc53220', HC17: '35b5b44895',
    HC18: '62474a67b8', HC19: 'd6edd35c94', HC20: '40a4999cc9', HC21: 'b047e6a2e6',
    HC22: '627e21cbe6', HC23: 'b2c734f82b', HC24: 'a767200253', HC25: 'f719c60d8a',
    HC26: '8f4173617e', HC27: 'c30046777a', HC28: 'd0cf60da84', HC29: 'e1a4621662',
    HC30: 'aff48b781c', HC31: '475ee38523', HC32: '6329eff0ca', HC33: '022bf6ae9e',
    HC34: '13480f1245', HC35: '7e208ccd6b', HC36: 'ee717a196f', HC37: '8ede622ed7',
    HC38: '2f1a206672', HC39: '52f03e9e09', HC40: 'd2fbf707fc', HC41: 'f9c4c08079',
    HC42: '611de9fe13', HC43: '33299468ba', HC44: '44a58fb919', HC45: '20e75a0895',
    HC46: 'c952336b32', HC47: '647f0cf299', HC48: '4810d538ce', HC49: '252a8b9757',
    HC50: '6dba3ac5a4', HC51: 'c033375100', RP1: '3d4dbbfd57', RP1B: 'd49965a313',
    RP1C: '0da91b4626', RP2: '02c57533e6', RP2B: '1d3c68fe7c', RP2C: '85b2131a9b',
    RP18: '6cfbefc72f', RP18B: '390334639e', RP18C: '7fcb426d0e', RP19: 'e32c0ae0aa',
    RP19B: '73200aff53', RP19C: '50b44ba323', RP20: 'bb33eae8f9', RP20B: '3d79006d8e',
    RP20C: 'b9de227602', RP3: '3e023ff311', RP3B: 'e53e1abc77', RP3C: '639acaca6b',
    RP4: 'ee2ef7f127', RP4B: '13c0abe3df', RP4C: 'd4fab77d4b', RP21: '4131ea66ea',
    RP21B: '4e00311c42', RP21C: 'b0e13936a7', RP22: '0dc726d2f4', RP22B: '2365711b89',
    RP22C: '7749597bac', RP23: '1baea506d4', RP23B: 'f931128115', RP23C: 'dae03cb1f1',
    RP5: 'd8ac91bdc0', RP5B: 'cbfe18d1f0', RP5C: '9f952eddcb', RP6: 'a720b22cca',
    RP6B: 'eddc81760f', RP6C: 'a6d042cc6f', RP24: '4ac972f8a5', RP24B: 'd77203b802',
    RP24C: '0ec5ffb9e0', RP25: '2f2aaea947', RP25B: 'e493ac30df', RP25C: '6ef1baff79',
    RP26: '21b07535fb', RP26B: 'eeae68335f', RP26C: 'cd3a7ad93c', RP7: '9b5756122c',
    RP7B: '079e252374', RP7C: 'f759d166cf', RP8: 'ecb008530f', RP8B: '9c11b00eae',
    RP8C: 'e3b7ede742', RP27: '968579f908', RP27B: '306c1cd1ee', RP27C: '6fe92dad15',
    RP28: '55e5a24d91', RP28B: 'e249ef018f', RP28C: '7a646d17d6', RP29: '532a44becc',
    RP29B: '8f7043386e', RP29C: 'd6189cddc1', RP9: '6911d82e91', RP9B: '2e2e432a4b',
    RP9C: 'b8a5ab93e8', RP10: 'bafd9a1364', RP10B: '6e4514593e', RP10C: '8411954897',
    RP30: '5f0a92445e', RP30B: '5f2cfcc831', RP30C: 'f86562c844', RP31: '6154bb4426',
    RP31B: '04264a873a', RP31C: '9330c39945', RP32: 'b7b49f2fff', RP32B: '93757fda33',
    RP32C: 'f47c8118e6', RP11: 'd7c5f37830', RP11B: '74734d6a53', RP11C: '674255e9bb',
    RP12: 'f56e663b75', RP12B: 'e0c2e2d8fe', RP12C: 'ad27c10d35', RP33: '3a1babb5b8',
    RP33B: 'aa551899b1', RP33C: '8b553a812f', RP34: '1acee1446d', RP34B: 'a06f115802',
    RP34C: '9d0c62ca3a', RP35: '351d492a25', RP35B: '0c3da85760', RP35C: 'f327c5b065',
    RP13: 'c9a4c7ff36', RP14: '13bdc5d503', RP15: '3ba235a24c', RP16: '326db622b1',
    RP17: 'cd0dca177c', AN1: 'af35339763', AN2: '3701609829', AN3: 'bf76357b07',
    AN4: '9a7186f901', AN5: '9b443283f1', AN6: '056bf58585', AN7: '26773f4c6e',
    AN8: 'c67c931184', AN9: 'bac8873cb6', AN10: '39c82285ff', AN11: '7b872e9a93',
    AN12: '2bd00dead0', AN13: '721eb3330b', AN14: '4825717de0', AN15: '3b45b130b5',
    AN16: '08493def97', AN17: 'a427354ee3', AN18: 'c0f26f3793', AN19: 'c0f66cd215',
    AN20: 'd7cae21359', AN21: 'dec1d18deb', AN22: '6728617b7b', AN23: 'ba47c8a8d8',
    AN24: 'ffab489861', AN25: '75a3c12a7a', AN26: '53088a86b6', AN27: '591c13e420',
    AN28: '729e2e1b9a', AN29: 'a90d170b29', AN30: 'e625843101', AN31: 'a9320c0b6d',
    AN32: 'e5c3681140', AN33: '44603307b0', AN34: 'c9db08d0d0', AN35: '043ad50b8a',
    AN36: '5edf187acd', AN37: '2c89ba6e93', AN38: '8fa9569039', AN39: 'd7b5b142e2',
    AN40: '3c173e9078', AN41: '7c390800d7', AN42: 'b3cfb3849b', AN43: 'aab0084e83',
    AN44: 'd66498c0d6', AN45: '37b23cf1ae', AN46: '0f1c08fee5', AN47: '66e471df54',
    AN48: '6cc66bc907', AN49: '396606c153', AN50: '41c4a0830a', AN51: '3edea40325',
    AN52: 'c9b751e14d', AN53: '8327451633', AN54: 'f0dce8a12a', AN55: '7741bfaaae',
    AN56: '56bf0f7fb5', AN57: '55b22ef065', AN58: '3dba0a3cd9', AN59: '379cdc07e8',
    AN60: '06d482dc90', AN61: '1eb2bc4153', AN62: 'cd7dc143b1', AN63: 'fa4c95619b',
    AN64: '783fe10d3b', AN65: '760355e83c', AN66: 'a28debbd2a', SU1: 'b7be3e1224',
    SU2: '894e1dcff0', SU3: '0b406e2fc8', SU4: 'd8f399bcde', SU5: 'ab7f864bed',
    SU6: '5ab25f72c0', SU7: '0b74664bcf', SU8: 'd08b86b055', SU9: '40c4ca9b97',
    SU10: '4c1b7e93a0', SU11: '168630e080', SU12: '9ae666bfbd', SU13: 'f7697df82d',
    SU14: 'e92e305cc4', SU15: '77bc5e68c5', SU16: 'ceaf01adf0', SU17: 'cc8ad06025',
    SU18: 'd4db8033e7', SU19: 'efd5f1dc2e', SU20: '8845efccdb', SU21: '1561f477f6',
    SU22: '5d9be0ebca', SU23: '7f876441f5', SU24: '7382594803', SU25: 'a720d119c9',
    SU26: '3e53c1ec00', SU27: 'baa22632c3', SU28: '8f0033fc64', SU29: 'acd7f692a3',
    SU30: '5b0a918a28', SU31: 'c8aad80d72', SU32: '79683fae08', SU33: '961e4700ed',
    SU34: '1e414b37b6', SU35: 'd326a29a11', SU36: 'cea5d8ca36', SU37: '768256a937',
    SU38: '57865496a2', SU39: '87461a6e42', SU40: '9305bc766d', SU41: 'f00d1b4af6',
    SU42: '5a65f3d294', TR1B: 'b631f5efed', TR1C: '2c36567b61', TR3B: '553f88c22a',
    TR3C: '017bf8b281', TR23B: '53b5dcb30e', TR23C: 'bc86bd410c', MT14B: '006e5f50d5',
    MT14C: 'e8cd255ac4', TR50B: 'c416c02c3f', TR50C: '2abca26f16', VP15B: '96b6acc3a2',
    VP15C: '6f5ab2a6ab', HC15B: 'b7f46b508b', HC15C: 'fda8480fce', HC17B: '3df215b950',
    HC17C: '26c952d0b8', HC18B: '61902a4f3a', HC18C: 'af3f786eba', HC19B: '9350327163',
    HC19C: '826f9acfeb', HC20B: '4aa87f1518', HC20C: '7f65ddcc93', HC21B: '2fc0e55b90',
    HC21C: 'c94938c2a9', HC22B: '81e2bfb97f', HC22C: '95331bf266', HC23B: '4c766690df',
    HC23C: 'bff0228db6', HC24B: 'e2acf424f8', HC24C: 'e4bb529a65', HC25B: 'c15a8f34f2',
    HC25C: 'fffdee809a', HC26B: '66b069e1e6', HC26C: '2ab0f2d964', HC27B: '8408475547',
    HC27C: 'c865b262c0', HC28B: '0d2a2d52ca', HC28C: '226f4718f5', HC29B: '1559ef928f',
    HC29C: '28cd4bfcfc', HC30B: '2ae33ef0a8', HC30C: 'f0b2b17046', HC31B: '17d884d4a5',
    HC31C: 'e8447d66e3', HC32B: '447219c636', HC32C: 'add119013a', HC33B: 'd39a013e69',
    HC33C: '7dd7ad30a1', HC34B: '3e7f2a17f4', HC34C: '06e4e66ff6', HC35B: '06a81afc71',
    HC35C: '583ee68d0b', HC36B: 'd54a10c362', HC36C: '2474a868c0', HC37B: '0ec9d149ad',
    HC37C: '7d05768170', HC38B: '8ad8742833', HC38C: 'd3f08df22c', HC39B: '362038a77d',
    HC39C: 'bcff793a0c', HC40B: '2a1eb27150', HC40C: '200051b535', HC41B: 'e4745ab2e5',
    HC41C: '33ffe4cf88', HC42B: '2b1f54fed1', HC42C: '6db98d23f9', HC43B: '743140fcee',
    HC43C: 'cbc71217ff', HC44B: '6c8f240815', HC44C: '9a67409ee9', HC45B: 'c8fa2374ee',
    HC45C: 'd8684ff531', HC46B: '2731f8aa5f', HC46C: '0490d9469c', HC47B: 'aa2e32abc0',
    HC47C: '1e5d024d31', HC48B: 'f167659f9d', HC48C: '6cafbeb0ee', HC49B: '7e162d37d5',
    HC49C: 'd1e5546bf2', HC50B: 'e760eccafe', HC50C: '20c53bbd47', HC51B: 'f3adc8392a',
    HC51C: 'b26bcd6240', VP1B: 'a27a961e0c', VP1C: 'a88d7be826', VP2B: 'dec5041848',
    VP2C: 'bf7016f059', VP3B: '29de42b11d', VP3C: '51e543a6cd', VP4B: '7cd41e8bd7',
    VP4C: '602f744812', VP5B: 'dc147179bc', VP5C: '1a8805247b', VP6B: '009eda271c',
    VP6C: 'c4c9f9c54e', VP7B: '63f64d8bed', VP7C: '9d13585ee4', VP8B: '29a5a50f86',
    VP8C: '3a80617a61', VP9B: '27a71b6aa8', VP9C: 'fc431c8b85', VP16B: 'f1c7ce4c10',
    VP16C: '4a89c0fa10', VP17B: '4e21df0469', VP17C: '5f46e61c95', VP18B: '5cd666e894',
    VP18C: 'b0e4e05687', VP19B: '3d127d8dbf', VP19C: 'ed2682219c', VP20B: '9cb0a4b4df',
    VP20C: 'e175286d17', VP21B: 'e961dccd1b', VP21C: '0dff3fe6b5', VP22B: '9042cafaf2',
    VP22C: 'c50f455b57', VP23B: '576e18dba2', VP23C: '935222776c', VP24B: '72a6a88a39',
    VP24C: 'cb5561e876', VP25B: 'f134808359', VP25C: '2ea8eb251d', VP26B: '0e0fdd22ae',
    VP26C: 'b6d00ed403', VP27B: '96aca7c9b8', VP27C: '60cb078842', VP28B: '220fc305ae',
    VP28C: '526a04ba5d', VP29B: '363f2bf8b0', VP29C: 'cbc41bff0a', VP30B: 'efde327203',
    VP30C: '01c25f70f4', VP31B: 'a13aab9ea8', VP31C: '0694bddbb1', VP32B: '67dc5c636a',
    VP32C: '07e4adf3cb', VP33B: '93c386343d', VP33C: '81b0e015d6', VP34B: '5797099d40',
    VP34C: 'a0553cc4f9', VP35B: 'd6374520bd', VP35C: 'd3d1b52b54', VP36B: '3fadf1a3cb',
    VP36C: 'b9ff41133c', VP37B: 'e73e60ce6d', VP37C: '01173a3a88', VP38B: 'ce63590216',
    VP38C: '3e84bef989', VP39B: 'fa7b3fb27f', VP39C: 'fa253e8f13', VP40B: 'eca50acc6a',
    VP40C: '3a76c3c345', VP41B: 'a722b7e646', VP41C: 'f411d92014', VP42B: '9fbcea3b92',
    VP42C: 'cc45dacd1c', VP43B: '935be5c5a4', VP43C: '978458293a', VP44B: 'c32bdd572b',
    VP44C: 'a2fd57b28a', VP45B: '13f3a42c4f', VP45C: '80b4aff423', VP46B: '7aa038589f',
    VP46C: '2cf9f57a62', VP47B: 'f65d45452a', VP47C: 'c9978d1cb3', VP48B: 'b12f42e9b9',
    VP48C: '249ecbe768', VP49B: 'd4bd18e0ed', VP49C: 'dac28e4e38', VP50B: '5f5485a4e6',
    VP50C: '7eca638fc1', GD1B: 'b1d775f60d', GD1C: 'e03069650b', GD2B: '9775bb4aef',
    GD2C: 'caf14752cf', GD3B: 'c959155e63', GD3C: 'f861f63fab', GD4B: '3bcf6f77b8',
    GD4C: 'f80005e081', GD5B: '79a7f52ab4', GD5C: '0a656609b6', GD6B: '967d2e65e2',
    GD6C: '7720e5b301', GD7B: '3401b7f908', GD7C: '1ca41d9d6c', GD8B: '20765b7ea9',
    GD8C: '81be5af81f', GD9B: '2c74340647', GD9C: 'f06dacbbf1', GD17B: 'b6cbafe996',
    GD17C: '6c478d857c', GD18B: 'ec767009c0', GD18C: 'a225f374a7', GD19B: 'd68af1470a',
    GD19C: 'c8db47dccd', GD20B: '6b5fa163cc', GD20C: '8a5b2e36b7', GD21B: 'ac46eda58a',
    GD21C: '90697f99d3', GD22B: '59ce647083', GD22C: 'ec6908e0a3', GD23B: '90c538272f',
    GD23C: '1e8e324fb6', GD24B: 'f7b811cf75', GD24C: 'abf6e1cfd9', GD25B: '8812e42557',
    GD25C: '88d5819a04', GD26B: '4366780fbf', GD26C: 'ac83a152a4', GD27B: '30359a1ac3',
    GD27C: '2c66c47f2f', GD28B: 'b792b22e91', GD28C: '0128eb76ca', GD29B: '2118c47f6f',
    GD29C: 'b2f04c3fa4', GD30B: '46a3ee2fb4', GD30C: 'dc8eafac54', GD31B: '139dc9983c',
    GD31C: 'e414fd6d45', GD33B: 'cd768864c4', GD33C: 'c759c4597a', GD34B: '61894b9d8a',
    GD34C: 'd7608bcaa0', GD35B: 'd4b7d4a53b', GD35C: '81d4bd78b4', GD36B: 'c891a9295e',
    GD36C: '96c9e90962', GD37B: '5cecc528f9', GD37C: 'd488f57821', GD38B: '94e79a5334',
    GD38C: '465f5863ba', GD39B: 'af8b869787', GD39C: '2792328dbe', GD40B: '741cd1c9eb',
    GD40C: '6578bccca1', GD41B: '5b301497e9', GD41C: '1af637a0db', GD42B: 'd398fd12b4',
    GD42C: '585e4b38fb', GD43B: '350a4d8379', GD43C: '577ff4c876', GD44B: '0ea15f3098',
    GD44C: '374c3c9447', GD45B: 'a4a3188b20', GD45C: '44edb7b19e', GD46B: '0b6a38b33a',
    GD46C: '49f8ec6140', GD47B: '7615ac01e5', GD47C: 'bb8d23bf63', GD48B: '4d477d541e',
    GD48C: 'e76de09e60', GD49B: 'be104d71b7', GD49C: '9cd2bcd6cb', GD50B: 'bbf541dde6',
    GD50C: 'f80edb0a56', GD51B: 'f44ad75e47', GD51C: 'fbb6cbd242', GD52B: 'c813037ac0',
    GD52C: '30876a36a0', MT1B: 'ad27d1e59d', MT1C: 'c7e2c6ea90', MT2B: 'a0dc92e8b4',
    MT2C: 'cc2d31cd8a', MT3B: 'd4b6bd2887', MT3C: 'b10db034fa', MT4B: '4fadbce11f',
    MT4C: '1e2df567a4', MT5B: '314cd1276e', MT5C: 'ec34ad0ade', MT6B: 'b19d59e003',
    MT6C: 'a2a02bfe0e', MT7B: '3d5aa1264a', MT7C: 'be7aad31fd', MT8B: '7baeb2c6a0',
    MT8C: '36f668e574', MT15B: '928acc107e', MT15C: '3537249549', MT16B: '4751a4f980',
    MT16C: '0638ef663b', MT17B: '8af111d2a2', MT17C: 'c571f83ce5', MT18B: 'c9895531af',
    MT18C: 'a85adc366f', MT19B: '53e17b3081', MT19C: '76ec433603', MT20B: 'a12e324a3c',
    MT20C: '5f4fd1daac', MT21B: 'cefcd1f7bb', MT21C: 'bfaa3812ea', MT22B: '4bffc92c13',
    MT22C: '0aaea94107', MT23B: 'a6dfaa1c0b', MT23C: '16807a9404', MT24B: 'f8168f6ada',
    MT24C: '0349471e9b', MT25B: '5a22a0ff29', MT25C: '84cadf0110', MT26B: '5607785182',
    MT26C: '4b02a55426', MT27B: '62f76aa956', MT27C: 'fcf8c77654', MT28B: 'd171341e42',
    MT28C: '8f88a9dacd', MT29B: 'edfd7035ed', MT29C: 'da3669ce65', MT30B: 'a994acb7f1',
    MT30C: '45f2e7e9f5', MT31B: 'bfa4accf56', MT31C: '11afc06d78', MT32B: '0b1cf52310',
    MT32C: '9b7c30d6d3', MT33B: '65b5dddff4', MT33C: '4ad54044b2', MT34B: 'abfbd96e11',
    MT34C: 'db92bbfdd3', MT35B: '137d10f28b', MT35C: '7a1b5b7e74', MT36B: 'cfb876c66a',
    MT36C: '52d6433cc1', MT37B: '1db96067e3', MT37C: 'c10b519921', MT38B: 'a3b26f8901',
    MT38C: '8d2c48ea7f', MT39B: 'dd5dbaaaf5', MT39C: '6e63508763', MT40B: '30fbf48d61',
    MT40C: 'f1bacc3af9', MT41B: '6483189d06', MT41C: 'c9e0a6a39f', MT42B: '310097dca2',
    MT42C: 'b0041b9d6a', MT43B: 'a0f250701a', MT43C: '45a0ba9a49', MT44B: '5fec3c7d82',
    MT44C: '64511232b9', MT45B: '940e755403', MT45C: '653008b550', MT46B: '4f2d7b87ac',
    MT46C: 'd0d18f76f8', MT47B: '590eff5d2a', MT47C: '83f781368e', MT48B: '26354a7c09',
    MT48C: 'a3a4b1de26', MT49B: 'b4fe3226a1', MT49C: 'decf3c9809', MT50B: '460e891680',
    MT50C: '35453609c8', HC1B: '33734fcbc8', HC1C: 'a5091be6e7', HC2B: '52a2f517e9',
    HC2C: 'b8427b4b77', HC3B: '9d8cb8ed38', HC3C: '1fd4b15223', HC4B: 'deb3a6070d',
    HC4C: '43b0d375cf', HC5B: 'f6741a9bbd', HC5C: 'b386e0f4b3', HC6B: 'd06cb133c8',
    HC6C: '7bc5e8bda1', HC7B: '930f3d5350', HC7C: '887ebe37bc', HC8B: 'e7b31eedf6',
    HC8C: 'eb0004bbbf', HC9B: '1a2712c0f0', HC9C: '4fc62d10af', AN1B: '054480eab6',
    AN1C: '4fdb96cc74', AN2B: '6c2d4b8ed7', AN2C: '6ab17fc74a', AN3B: '71d845d2e8',
    AN3C: '4f0c82ef52', AN4B: 'cad6d63478', AN4C: 'bb28256c7c', AN5B: '525de731fd',
    AN5C: 'c04bcd7ad5', AN6B: 'b25acb05eb', AN6C: '0794d72792', AN7B: '58732dcf46',
    AN7C: 'a2b2e46edb', AN8B: 'e71795820e', AN8C: 'a33ed98743', AN9B: '3f3820e6b2',
    AN9C: '0e7baecc7d', AN10B: 'ef0b11b245', AN10C: '115392c283', AN11B: '75e35b3b16',
    AN11C: 'fbd8d0d651', AN12B: 'eba667e213', AN12C: 'e0fbb71827', AN13B: '1e4ed9ac08',
    AN13C: '577b17f5e3', AN14B: '2fd8e91c3a', AN14C: '5423ba0bbc', AN15B: '1b78e14c65',
    AN15C: 'de2e556dc8', AN16B: '7a18cbf034', AN16C: '265315acf4', AN17B: '65a97c0df0',
    AN17C: '0bc45e91fa', AN18B: '9fdbc4a049', AN18C: 'f7343b0648', AN19B: 'b051b25cb2',
    AN19C: '258c025a65', AN20B: '7793fe21f2', AN20C: 'f3bf6433da', AN21B: '39f0fae089',
    AN21C: '39eaa8c2a7', AN22B: 'b3dbb17234', AN22C: '0366fb74e4', AN23B: 'ee4f36ee46',
    AN23C: '1711bb8837', AN24B: 'ff34451ba5', AN24C: 'e7294b9718', AN25B: 'dfd0f45b4c',
    AN25C: '98f5731f57', AN26B: 'dc539ed1ba', AN26C: '62bf05e62f', AN27B: 'd6642688de',
    AN27C: 'd38eb19abe', AN28B: '11802b458a', AN28C: '2d13abf6c3', AN29B: '15a524a149',
    AN29C: '2a7f90dd1e', AN30B: '41b8fc467f', AN30C: '002e932b07', AN31B: '0ae5f62a1a',
    AN31C: 'b782eafb9c', AN32B: 'b187592999', AN32C: '389aaf4a42', AN33B: 'a8c7795489',
    AN33C: '11e1388d7c', AN34B: '16646e7843', AN34C: '6d93a0393e', AN35B: 'a2dad31ea6',
    AN35C: '9431e4e51b', AN36B: 'f1593f1d5c', AN36C: 'a877c5deb2', AN37B: 'f5d09f0433',
    AN37C: '81700a1540', AN38B: '6cf86eb0fe', AN38C: 'f5ec94571a', AN39B: '026eae9405',
    AN39C: '01ef857b14', AN40B: '9d12fcd93b', AN40C: '3f9e5de409', AN41B: '5f2a0b225c',
    AN41C: 'b7e720c07a', AN42B: '8d3b2833cc', AN42C: '9073437e7b', AN43B: 'cafc14a582',
    AN43C: '766c41665b', AN44B: '62816dcd2b', AN44C: '42dabf2b3b', AN45B: '0cd44cf23b',
    AN45C: '12a2bc3fb5', AN46B: '521198485c', AN46C: '5b77241380', AN47B: '70d70a1240',
    AN47C: '0b2b7135ee', AN48B: '718491c855', AN48C: '2f839c9d39', AN49B: 'e24e62c43d',
    AN49C: 'efa7835da2', AN50B: 'b64020e4e3', AN50C: 'a60d7192c4', AN51B: '2bc9d0ca45',
    AN51C: '5b88b721a5', AN52B: 'aa7c6d33cc', AN52C: 'be0b736c53', AN53B: '76e76f348d',
    AN53C: 'bc750e1391', AN54B: '2c722a0c01', AN54C: '9a00dcc0e1', AN55B: 'fe99c9651e',
    AN55C: '6d614f4c03', AN56B: 'aac4bdd035', AN56C: '9392feafbb', AN57B: '72d14a181b',
    AN57C: '3b2ad6adc0', AN58B: '73e381625c', AN58C: '6a1efa2b0d', AN59B: '3a9abfca70',
    AN59C: '90789a6706', AN60B: 'a1d84eb108', AN60C: 'b7fda335aa', SU1B: '152b42dea3',
    SU1C: '11bb2dedaa', SU2B: '04e082ec9c', SU2C: '6859442de7', SU3B: '3f29f6ba9a',
    SU3C: '4c2e83d653', SU4B: 'b96d15020c', SU4C: '34848992df', SU5B: '80a535e60f',
    SU5C: '4e293745b0', SU6B: 'd3547b880c', SU6C: 'a3429558c7', SU7B: 'ec25a47b49',
    SU7C: '8d9bb7f6c2', SU8B: '34905a8d7b', SU8C: '776cc5d38e', SU9B: 'de2a3234a8',
    SU9C: '3d4efdf5e7', SU10B: 'b4e4678d0c', SU10C: '2e4999aacc', SU11B: 'e5ba4b5d07',
    SU11C: '488478e0d0', SU12B: '7e4930910a', SU12C: '57b4528f9d', SU13B: 'd4a7ac5e33',
    SU13C: '67ffccfa2a', SU14B: '8c95fcae24', SU14C: '84314db06d', SU15B: 'b45773b913',
    SU15C: '69dea983c2', SU16B: '6ee7497830', SU16C: '7f7b9cb449', SU17B: '367ff21a32',
    SU17C: 'ac77226538', SU18B: '70733fea63', SU18C: 'c166b7f5c7', SU19B: 'd2e502f775',
    SU19C: '6d7d478528', SU20B: '2954fa14e0', SU20C: '3ab7ada72b', SU21B: '4f5da78410',
    SU21C: '3ab5c7c7b0', SU22B: 'cdf3d5fa75', SU22C: 'cf9e7cc151', SU23B: '7686e2570d',
    SU23C: '0a1ca20a34', SU24B: '6c145bb2bd', SU24C: '96bfa8ff81', SU25B: '77e1d4465b',
    SU25C: '47b9efeb00', SU26B: '3f04e824f1', SU26C: 'd0301dc8ac', SU27B: '05ac114221',
    SU27C: '8e7c4bc207', SU28B: '0f8d2a74cd', SU28C: 'e6c15612bc', SU29B: 'ff3fdf4286',
    SU29C: '9f1f9a3b44', SU30B: '55a9e106d4', SU30C: 'cd1ef75a58', SU31B: '4c6335a3c7',
    SU31C: '8f0d3d6287', SU32B: '61a0a40f79', SU32C: '1041d07c51', SU33B: '884759aa25',
    SU33C: '582510c96c', SU34B: '53a3666553', SU34C: 'ea2c428878', SU35B: 'e38a390ef9',
    SU35C: 'cc93cdfd4e', SU36B: '2f38c72be3', SU36C: '5eee6824b7',
    FR1: '3737949832', FR1B: '5f466c0cdd', FR1C: 'b9da0fdbbd', FR2: '63a0c4ef0a',
    FR2B: 'da83abe460', FR2C: 'd29f447b3a', FR3: '6c11aa6ab6', FR3B: '29026fde78',
    FR3C: '00af11f59b', FR4: 'eb42d57b0b', FR4B: '7770d75052', FR4C: 'a7d729267a',
    FR5: '8a61d90802', FR5B: '4faea33596', FR5C: '263e43193e', FR6: '25e1d12d87',
    FR6B: '0c853fe800', FR6C: '022a527ce7', FR7: '0f748d12a7', FR7B: '94ee1b1a99',
    FR7C: 'e7be7d0195', FR8: '351abf905c', FR8B: '48c758b902', FR8C: 'c36c31540e',
    FR9: '3e863cfee0', FR9B: '55c74fa4d9', FR9C: '6598988eea', FR10: '1de1352fe6',
    FR10B: '35725145c5', FR10C: '80252cd981', FR11: 'c399ff16f9', FR11B: '305e16be9d',
    FR11C: '6b393c0421', FR12: 'd38299ff91', FR12B: 'b5e7c82028', FR12C: 'cc219638e5',
    FR13: 'b7149d521e', FR13B: '6d94da598e', FR13C: '481d9294e4', FR14: '6c01b3e75a',
    FR14B: '841b98591a', FR14C: '0450c900f1', FR15: 'a04c743ff4', FR15B: '4bac7aefe8',
    FR15C: 'c48ce5c7d2', FR16: '695241fda8', FR16B: '1be1801294', FR16C: 'db2f45c7eb',
    FR17: 'b0f74dbda6', FR17B: '07d1cc1634', FR17C: 'de6d513ce4', FR18: '253d8afac5',
    FR18B: '9f19c6df2c', FR18C: '39cbf782f5', FR19: '01b9e36ad2', FR19B: '13f361e3ce',
    FR19C: '17de456dda', FR20: 'edd9401a4d', FR20B: '948888b66f', FR20C: 'fdd2810f6b',
    FR21: '4386be828b', FR21B: '1bd1f0a9b0', FR21C: '8d5bad1784', FR22: '1d8bbe28eb',
    FR22B: '06dad20e1f', FR22C: '9c1750a5ff', FR23: '480f8546d4', FR23B: 'baca5b45b8',
    FR23C: 'ae195c8c41', FR24: 'd483cfa090', FR24B: 'b9f16c82d0', FR24C: 'fc82fa96d9',
    FR25: 'a95ea7e2a9', FR25B: 'ae98b158f7', FR25C: 'd02b32d15f', FR26: 'c37f448b5e',
    FR26B: '10abfc214b', FR26C: '08686d8d72', FR27: 'a33b3af54c', FR27B: 'da09f8b870',
    FR27C: '6a1c75b546', FR28: '24303f1802', FR28B: '92d0d9aa36', FR28C: '0b0ccbe314',
    FR29: 'ba498424e6', FR29B: 'e19c01a1b8', FR29C: 'f7163fabb5', FR30: '89108b4b04',
    FR30B: '8eec8b11fc', FR30C: '60bbcc404d', FR31: 'c2a9d001dd', FR31B: 'b9cd72ac19',
    FR31C: '417c0f429e', FR32: 'd0a3dbc559', FR32B: '130f56f077', FR32C: '78263f2393',
    FR33: '4c18ea0d32', FR33B: 'c75a169e29', FR33C: '5266114768', FR34: 'dfbdd9c564',
    FR34B: '3e585ff5f6', FR34C: '0b291a26ab', FR35: '763d4a76c3', FR35B: '0571bfc880',
    FR35C: '1d72c73246', FR36: '44ba1b5f6d', FR36B: '1191b976af', FR36C: '26cec31a6c',
    FR37: '5b7dc1d0fa', FR37B: '9c82d81990', FR37C: '5468f5ad8c', FR38: '270009d8b8',
    FR38B: 'b091f6ba4f', FR38C: 'f30be695cd', FR39: 'efbfaab0d1', FR39B: 'a16401b169',
    FR39C: '4b3c39f294', FR40: '0d690ac419', FR40B: '376b9e08d5', FR40C: 'ba3459aecf',
    FR41: '5008d80254', FR41B: '994c85a31f', FR41C: '730520a491', FR42: 'fe84169d64',
    FR42B: '7e187177d9', FR42C: 'eb62ddf06f', FR43: '2d74493541', FR43B: '8577e58eb5',
    FR43C: 'a7e04167b5', FR44: 'a93cc95974', FR44B: '6d0c3172ea', FR44C: '81101fe15e',
    FR45: '42238be7ae', FR45B: 'e899a2940e', FR45C: 'f219b8f490',
    FR46: 'bd3cb697ff', FR46B: 'a1520141a6', FR46C: 'b9f9be134d', FR47: '7a9b7fcaa6',
    FR47B: 'a3085f463c', FR47C: 'c9e6f8b6b2', FR48: '10c4e463ee', FR48B: '9c9eced4dd',
    FR48C: 'e751bc4bac', FR49: 'a9f360e8e1', FR49B: '2eda105e07', FR49C: 'df98f4198e',
    FR50: 'cdf2b1c131', FR50B: 'b9097b62b0', FR50C: '49027f9c9f', FR51: '5e94ac1ec2',
    FR51B: '604f586ea2', FR51C: '77350681dc', FR52: '54c55346ab', FR52B: '40b69f5792',
    FR52C: '10f9dc4a84', FR53: 'c43b9042eb', FR53B: '00a42b6e2a', FR53C: 'b5bf2efca7',
    FR54: '192ab87f78', FR54B: 'c5f0ed8777', FR54C: 'b3dc1dc0f3', FR55: 'cdf25515f7',
    FR56: 'a168a7743a', FR57: '48561622bc', FR58: '876c474aa3', FR59: 'cbdcd895e6',
    FR60: 'ac6ae160e4',
  };

  /**
   * `variante` vaut 'buste' (320×320, pour une carte) ou 'plein' (520×945,
   * pour un affichage en pied). Le repli en PNG couvre les navigateurs qui
   * annoncent l'AVIF sans savoir le décoder — ça existe.
   */
  const illustration = (f, variante = 'buste') => {
    const src = adresse(f?.id, variante);
    if (!src) return null;
    return `<img class="illu" alt="" loading="lazy" decoding="async" src="${src}"
      onerror="this.onerror=null;this.src='${secours(src)}'">`;
  };

  /**
   * **Un âge sans dessin retombe sur celui de son premier âge.**
   *
   * Les identifiants d'une lignée s'écrivent `MS9`, `MS9B`, `MS9C` : le premier
   * âge est la racine, les suivants ajoutent une lettre. Deux cent soixante-deux
   * cartes du catalogue sont des âges supérieurs **de personnages qui, eux, sont
   * dessinés** — c'est tout le reliquat d'illustrations annoncé dans `ETAT.md`.
   *
   * Sans ce repli, elles tombaient toutes sur le rendu procédural : une
   * silhouette géométrique dans un cône de projecteur. Or le rendu procédural
   * est le repli du **personnage inconnu**, pas celui d'un personnage connu
   * qu'on n'a pas encore redessiné plus vieux. Montrer La Chance du Stade au
   * premier âge, c'est montrer le bon personnage ; montrer une silhouette,
   * c'est n'en montrer aucun.
   *
   * Rien ne ment au joueur : la carte affiche son étage à côté du dessin, et
   * `ages.js` décrit ce que l'âge change. Le jour où le troisième âge est
   * dessiné, il prend la place sans qu'on touche à cette fonction.
   */
  const racineIllustree = (id) => {
    if (!id) return null;
    if (ILLUSTRES.has(id)) return id;
    const racine = /^([A-Z]+\d+)/.exec(id)?.[1];
    return racine && racine !== id && ILLUSTRES.has(racine) ? racine : null;
  };

  /**
   * Le numero d'age que porte un identifiant.
   *
   * Une lignee s'ecrit `TR2`, `TR2B`, `TR2C` : le premier age est la racine
   * nue, les suivants ajoutent une lettre. B vaut donc deux, C vaut trois.
   */
  const evoDe = (id) => {
    const m = /^[A-Z]+\d+([A-Z])$/.exec(String(id ?? ''));
    return m ? m[1].charCodeAt(0) - 64 : 1;
  };

  /**
   * L'adresse du dessin, sans la balise autour.
   *
   * `illustration` rend du HTML tout fait, ce qui convient a une carte mais
   * pas a une page qui pose l'image elle-meme — l'accueil croise deux calques
   * et a besoin de l'adresse seule. Elle la construisait sinon de son cote, et
   * une seconde facon d'ecrire le meme chemin finit toujours par diverger.
   *
   * ## Les ages superieurs passent d'abord par les etats
   *
   * Le depot porte **deux** systemes d'images. Les fichiers plats —
   * `/img/fanzzy/TR2.png` — que lisent les cartes, le classeur, la fiche et le
   * deck ; et les dossiers d'etats — `/img/fanzzy/TR2/e2/base/neutre.png` —
   * que lisent l'accueil et le virage.
   *
   * Sur trois cent quatre-vingt-deux ages superieurs, **douze** ont leur
   * fichier plat. Les autres retombaient donc sur le dessin de leur premier
   * age : on payait cent quinze echarpes pour faire grandir son supporter, et
   * la carte montrait toujours l'enfant. Alors que pour une partie d'entre eux
   * le dessin d'adulte **existe**, range dans le second systeme, et que l'ecran
   * « Mon FANZZY » le montrait deja — d'ou deux ecrans du meme jeu qui
   * affichaient deux personnages differents sous le meme nom.
   *
   * On regarde donc les etats avant de se rabattre, et on n'accepte que l'age
   * **exactement demande** : `portrait()` sait redescendre d'un stade, et
   * accepter sa descente reviendrait a reprendre le repli qu'on corrige.
   *
   * Facultatif de bout en bout : sans `fanzzy-etats.js` charge, ou sans
   * manifeste, on retombe sur le fichier plat comme avant.
   */
  /**
   * @param {object} [opt]
   * @param {string} [opt.skin] la tenue à montrer. `base` par défaut, et c'est
   *   le cas de presque tous les appels : on ne connaît la tenue que de
   *   **son** Fanzzy, pas de celui d'en face.
   *
   * **Le manifeste n'était interrogé qu'au-delà du premier âge**, et c'était
   * juste tant qu'on n'y cherchait qu'un âge : le fichier plat montre le
   * premier, et il a l'avantage d'exister pour deux cents personnages.
   *
   * Une tenue, elle, n'existe que dans le manifeste — `e1/halloween/` — et
   * jamais dans l'art plat. Sans cette ouverture, un joueur qui choisissait
   * un déguisement sur un Fanzzy au premier âge ne le voyait nulle part, et
   * la moitié du catalogue est au premier âge.
   *
   * On n'accepte la réponse que si elle porte **la tenue demandée** :
   * `resoudre` retombe seul sur `base`, ce qui est le bon réflexe ailleurs et
   * le mauvais ici — il rendrait un dessin d'âge supérieur là où le fichier
   * plat, juste en dessous, a le bon.
   */
  const adresse = (id, variante = 'buste', { skin = 'base' } = {}) => {
    const evo = evoDe(id);
    const racine = /^([A-Z]+\d+)/.exec(String(id ?? ''))?.[1];
    if ((evo > 1 || skin !== 'base') && racine && window.TBF_ETATS?.pret?.()) {
      const r = variante === 'buste'
        ? window.TBF_ETATS.portrait(racine, { evo, skin })
        : window.TBF_ETATS.resoudre(racine, { evo, skin, etat: 'neutre' });
      if (r?.evo === evo && (skin === 'base' || r.skin === skin)) return r.src;
    }
    const vu = racineIllustree(id);
    if (!vu) return null;
    const v = EMPREINTES[vu];
    return `/img/fanzzy/${vu}${variante === 'buste' ? '-buste' : ''}${IMG_EXT_ALPHA}`
      + (v ? `?v=${v}` : '');
  };

  /**
   * Fond seul, sans silhouette : sert de décor aux illustrations.
   *
   * **Il délègue à `fanzzy-fond.js` quand ce module est chargé**, pour que la
   * carte du classeur et la fiche montrent le même lieu. Deux décors pour le
   * même personnage, c'est le joueur qui apprend deux fois où il habite.
   *
   * Le repli — le halo teinté d'origine — reste pour les pages qui ne chargent
   * pas le module des décors. Une carte sans fond du tout se lirait comme une
   * image manquante ; un fond simple ne se lit pas du tout, ce qui est le but.
   */
  function artFond(f) {
    const neuf = window.TBF_FOND?.fond?.(f);
    if (neuf) return neuf;
    const tc = couleur(f);
    return `<svg viewBox="0 0 128 100" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="hf${f.id}"><stop offset="0" stop-color="${tc}" stop-opacity=".5"/>
        <stop offset="1" stop-color="${tc}" stop-opacity="0"/></radialGradient></defs>
      <rect width="128" height="100" fill="#101821"/>
      <polygon points="16,-4 30,-4 58,64 4,64" fill="#F5C33B" opacity=".1"/>
      <polygon points="98,-4 112,-4 124,64 70,64" fill="#F5C33B" opacity=".1"/>
      <circle cx="64" cy="78" r="52" fill="url(#hf${f.id})"/>
    </svg>`;
  }

  const artCache = new Map();

  function artProcedural(f) {
    if (artCache.has(f.id)) return artCache.get(f.id);
    const r = seeded(f.id), tc = couleur(f), u = 'g' + uid++;
    let s = `<svg viewBox="0 0 128 100" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
     <defs><linearGradient id="s${u}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16202C"/>
       <stop offset="1" stop-color="#05080C"/></linearGradient>
     <radialGradient id="h${u}"><stop offset="0" stop-color="${tc}" stop-opacity=".55"/>
       <stop offset="1" stop-color="${tc}" stop-opacity="0"/></radialGradient>
     <filter id="b${u}"><feGaussianBlur stdDeviation="3"/></filter></defs>
     <rect width="128" height="100" fill="url(#s${u})"/>
     <polygon points="16,-4 30,-4 58,64 4,64" fill="#F5C33B" opacity=".09"/>
     <polygon points="98,-4 112,-4 124,64 70,64" fill="#F5C33B" opacity=".09"/>
     <circle cx="64" cy="84" r="50" fill="url(#h${u})" opacity=".65"/>`;

    // Silhouette du supporter, plus imposante selon l'étage d'évolution.
    // `stage` absent donnerait une échelle NaN et un dessin vide : toutes les
    // sources ne le transmettent pas, on retombe sur le premier étage.
    const scale = 0.85 + (Number(f.stage) || 1) * 0.12;
    s += `<g transform="translate(64,60) scale(${scale.toFixed(2)}) translate(-64,-60)">
      <circle cx="64" cy="34" r="11" fill="#0A0E13" stroke="${tc}" stroke-width="1.6"/>
      <path d="M52 78 v-20 a12 12 0 0 1 24 0 v20z" fill="#0A0E13" stroke="${tc}" stroke-width="1.4"/>`;
    if (f.type === 'voix') s += `<path d="M74 40 l16-11 4 7 -16 9z" fill="${tc}"/>`;
    if (f.type === 'perc') s += `<ellipse cx="64" cy="66" rx="15" ry="11" fill="#E9E3D4" stroke="${tc}" stroke-width="2"/>`;
    if (f.type === 'fide') s += `<path d="M44 56 q20 -12 40 0" stroke="${tc}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    if (f.type === 'tifo') s += `<rect x="40" y="44" width="48" height="20" fill="#E9E3D4" stroke="${tc}" stroke-width="1.6"/>`;
    if (f.type === 'pyro') s += `<circle cx="86" cy="48" r="4" fill="#FFF3D0"/><circle cx="86" cy="48" r="11" fill="${tc}" opacity=".5" filter="url(#b${u})"/>`;
    if (f.type === 'depl') s += `<rect x="34" y="52" width="60" height="18" rx="3" fill="#12202F" stroke="${tc}" stroke-width="1.4"/>`;
    s += `</g>`;

    let steps = 'M0 100';
    for (let i = 0; i < 9; i++) steps += `L${i * 14.5} ${100 - i * 4.2}L${(i + 1) * 14.5} ${100 - i * 4.2}`;
    s += `<path d="${steps}L128 100Z" fill="#080B10" opacity=".9"/>`;
    for (let row = 0; row < 3; row++) {
      const y = 93 - row * 8;
      for (let i = 0; i < 15; i++) {
        const x = (4 + i * 8.6 + r() * 3).toFixed(1);
        s += `<circle cx="${x}" cy="${y}" r="2" fill="${r() > .88 ? tc : '#1C2530'}"/>`;
      }
    }
    s += `<rect width="128" height="100" fill="#000" opacity=".07"/></svg>`;
    artCache.set(f.id, s);
    return s;
  }

  function art(f) {
    const dessin = illustration(f);
    if (dessin) {
      // Le fond de tribune reste procédural : c'est lui qui porte la couleur du
      // type. Le personnage se pose dessus.
      return `<div class="illuwrap">${artFond(f)}${dessin}</div>`;
    }
    return artProcedural(f);
  }

  /**
   * **Le dessin d'un avatar, tel que le serveur le rend.** La seule.
   *
   * Six écrans dessinaient « le personnage du joueur », chacun avec sa
   * propre recette : l'âge ici, la tenue là, l'expression à un seul endroit.
   * Chaque dimension ajoutée devait l'être six fois, et le joueur voyait
   * le même personnage sous trois visages selon l'écran.
   *
   * Cette fonction ne **décide** rien : l'objet vient de `construireAvatar`,
   * côté serveur, déjà résolu. Elle le traduit en image, et c'est tout ce
   * qu'un écran a le droit de faire avec lui.
   *
   * @param {object} av         `wallet.avatar` ou `wallet.avatarEnJeu`
   * @param {string} [variante] `buste` ou `plein`
   * @param {object} [opt]
   * @param {string} [opt.etat] une expression à montrer à la place de celle
   *   de l'avatar — le match qui fait exulter le personnage, par exemple.
   *
   * **On n'accepte que l'âge exactement demandé.** `resoudre` sait
   * redescendre d'un âge, et ce n'est jamais la bonne réponse ici : le
   * plein-pied de l'âge demandé existe pour deux cents personnages. C'est ce
   * repli-là qui a affiché une Bâche Repliée sous le nom de la Bâche
   * Déployée. La tenue et l'expression, elles, gardent le leur.
   */
  function dessinAvatar(av, variante = 'buste', opt = {}) {
    if (!av?.id) return null;
    const etat = opt.etat || av.etat || 'neutre';
    const skin = av.skin || 'base';
    const E = window.TBF_ETATS;
    if (E?.pret?.()) {
      const r = variante === 'buste' && etat === 'neutre'
        ? E.portrait(av.id, { evo: av.evo, skin })
        : E.resoudre(av.id, { evo: av.evo, skin, etat });
      if (r && r.evo === av.evo) return r.src;
    }
    return adresse(av.age ?? av.id, variante, { skin });
  }

  /**
   * Les Fanzzy **jouables** et dessinés : ceux qu'un booster peut sortir
   * aujourd'hui (série ouverte), dont on a le dessin.
   *
   * Les vitrines — le kop de l'écran d'ouverture, les visages de la page
   * d'accueil — tiraient dans `ILLUSTRES`, qui dessine aussi les séries
   * fermées : un visiteur y voyait des personnages qu'il ne pouvait pas
   * avoir (Gaël, 27 octobre 2026 : « uniquement ceux activés »). La liste
   * vient du serveur (`/api/fanzzy/jouables`), seul à savoir quelles séries
   * sont ouvertes ; elle est gardée dans le téléphone pour la visite
   * suivante, et sert de repli si le réseau ne répond pas à temps.
   *
   * Rend toujours une liste, vide au pire : une vitrine sans visages vaut
   * mieux qu'une vitrine de personnages qu'on ne peut pas avoir.
   */
  const CLE_JOUABLES = 'tbf.jouables';
  let jouablesEnCours = null;
  /* La saison annoncée, servie avec la liste (`prochaine`) : la vitrine y lit
     le jour d'ouverture du PASS. `null` sans annonce. */
  let annonce = null;
  const jouablesGardes = () => {
    try {
      const v = JSON.parse(localStorage.getItem(CLE_JOUABLES) ?? 'null');
      return Array.isArray(v) ? v.filter((id) => ILLUSTRES.has(id)) : null;
    } catch { return null; }
  };
  const jouables = ({ attente = 2500 } = {}) => {
    jouablesEnCours ??= fetch('/api/fanzzy/jouables', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        annonce = d?.prochaine ?? null;
        if (!Array.isArray(d?.ids)) return null;
        try { localStorage.setItem(CLE_JOUABLES, JSON.stringify(d.ids)); } catch { /* privé */ }
        return d.ids.filter((id) => ILLUSTRES.has(id));
      })
      .catch(() => null);
    const delai = new Promise((r) => { setTimeout(() => r(null), attente); });
    return Promise.race([jouablesEnCours, delai]).then((ids) => ids ?? jouablesGardes() ?? []);
  };

  window.FZART = {
    dessinAvatar,
    jouables,
    /** La saison annoncée (`{ numero, nom, ouvre, … }`), ou `null`. */
    prochaine: () => jouables().then(() => annonce),
    IMG_EXT,
    IMG_EXT_ALPHA,
    secours,
    // `src` sert aux **photos** — les sachets de la boutique, les décors : elles
    // sont publiées en AVIF, WebP et JPEG, jamais en PNG.
    src: (base) => base + IMG_EXT,
    /**
     * Le dos d'une carte, par série.
     *
     * **Les treize séries se retournaient toutes sur le même dos** : un
     * dégradé gris et un petit triangle au trait. C'est pourtant la seule
     * image qu'on regarde pendant la seconde qui précède le tirage — celle
     * d'avant, celle qui fait qu'on a envie de retourner. Elle ne disait rien
     * du sachet qu'on venait d'ouvrir, et la série, qui est le premier plaisir
     * de la collection, n'existait qu'**après** le retournement.
     *
     * Le repli garde l'ancien fond : une série neuve dont le dos n'est pas
     * encore dessiné doit s'ouvrir quand même. C'est exactement le cas qui
     * arrive à chaque saison.
     *
     * **Sans série, le dos neutre** (demande de Gaël du 3 novembre 2026) :
     * une poignée d'écharpes, une pièce ou une action communes ont leur dos à
     * part, au blason du jeu, plutôt que celui d'une série qui n'est pas la
     * leur. Il vient de `art/dos/NEUTRE.png` comme les autres, s'il y est.
     */
    dos: (code) => `/img/dos/${code ? String(code).toUpperCase() : 'NEUTRE'}${IMG_EXT}`,
    setTypes,
    seeded,
    ILLUSTRES,
    racineIllustree,
    illustration,
    adresse,
    art,
    artFond,
    artProcedural,
  };
})();
