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
    'MS32B', 'MS32C', 'TR35', 'TR36', 'TR37', 'TR38', 'TR39', 'TR40',
    'GC15', 'GC16', 'TR41', 'TR42', 'BG28', 'TR43', 'TR44', 'TR45',
    'TR46', 'GC17', 'TR47', 'TR48', 'TR49', 'MS34', 'TR50', 'TR51',
    'TR52', 'TR53', 'GD12', 'GD13', 'MS35', 'HC16', 'TR54', 'IM1',
    'IM2', 'IM3', 'IM4', 'IM5', 'IM6', 'IM7', 'IM8', 'IM9',
    'IM12', 'IM13', 'IM14', 'IM15', 'IM16', 'IM17', 'TR1', 'TR2',
    'TR3', 'TR4', 'TR5', 'TR6', 'TR7', 'TR8', 'TR9', 'TR10',
    'TR11', 'TR12', 'TR13', 'TR14', 'TR15', 'TR16', 'TR17', 'TR18',
    'TR19', 'TR20', 'TR21', 'TR22', 'TR23', 'TR24', 'TR25', 'TR26',
    'TR27', 'TR60', 'TR61', 'TR62', 'TR63', 'TR64', 'TR65', 'TR66',
    'TR67', 'TR68', 'MS1', 'MS2', 'MS3', 'MS4', 'MS5', 'MS6',
    'MS7', 'MS8', 'MS9', 'MS10', 'MS11', 'MS12', 'MS13', 'MS14',
    'MS15', 'MS16', 'MS17', 'MS18', 'MS19', 'MS20', 'MS21', 'MS22',
    'MS23', 'MS24', 'MS25', 'MS26', 'BG1', 'BG2', 'BG3', 'BG4',
    'BG5', 'BG6', 'BG7', 'BG8', 'BG9', 'BG10', 'BG11', 'BG12',
    'BG13', 'BG14', 'BG15', 'BG16', 'BG17', 'BG18', 'BG19', 'BG20',
    'BG21', 'BG22', 'BG23', 'RV1', 'RV2', 'RV3', 'RV4', 'RV5',
    'RV6', 'RV7', 'RV8', 'RV9', 'RV10', 'RV11', 'RV12', 'RV13',
    'RV14', 'RV15', 'RV16', 'RV17', 'RV18', 'RV19', 'RV20', 'RV21',
    'OB1', 'OB2', 'OB3', 'OB4', 'OB5', 'OB6', 'OB7', 'OB8',
    'OB9', 'OB10', 'OB11', 'OB12', 'EP1', 'EP2', 'EP3', 'EP4',
    'EP5', 'EP6', 'EP7', 'EP8', 'EP9', 'EP10', 'EP11', 'EP12',
    'EP13', 'EP14', 'EP15', 'EP16', 'EP17', 'TR55', 'TR56', 'TR57',
    'TR58', 'TR59', 'TR28', 'TR29', 'TR30', 'TR31', 'VP1', 'VP2',
    'VP3', 'VP4', 'GC1', 'RP1', 'RP1B', 'RP1C', 'RP2', 'RP2B',
    'RP2C', 'RP18', 'RP18B', 'RP18C', 'RP19', 'RP19B', 'RP19C', 'RP20',
    'RP20B', 'RP20C', 'RP3', 'RP3B', 'RP3C', 'RP4', 'RP4B', 'RP4C',
    'RP21', 'RP21B', 'RP21C', 'RP22', 'RP22B', 'RP22C', 'RP23', 'RP23B',
    'RP23C', 'RP5', 'RP5B', 'RP5C', 'RP6', 'RP6B', 'RP6C', 'RP24',
    'RP24B', 'RP24C', 'RP25', 'RP25B', 'RP25C', 'RP26', 'RP26B', 'RP26C',
    'RP7', 'RP7B', 'RP7C', 'RP8', 'RP8B', 'RP8C', 'RP27', 'RP27B',
    'RP27C', 'RP28', 'RP28B', 'RP28C', 'RP29', 'RP29B', 'RP29C', 'RP9',
    'RP9B', 'RP9C', 'RP10', 'RP10B', 'RP10C', 'RP30', 'RP30B', 'RP30C',
    'RP31', 'RP31B', 'RP31C', 'RP32', 'RP32B', 'RP32C', 'RP11', 'RP11B',
    'RP11C', 'RP12', 'RP12B', 'RP12C', 'RP33', 'RP33B', 'RP33C', 'RP34',
    'RP34B', 'RP34C', 'RP35', 'RP35B', 'RP35C', 'RP13', 'RP14', 'RP15',
    'RP16', 'RP17', 'TR1B', 'TR1C', 'TR3B', 'TR3C', 'TR23B', 'TR23C',
    'TR50B', 'TR50C',
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
    MS32B: '56ede9f174', MS32C: 'c7b831d37c', TR35: '9786ebdb5a', TR36: '02508e8d0f',
    TR37: 'eeab16d1f0', TR38: 'd929f72fc6', TR39: '0c2398585c', TR40: '79022b59c8',
    GC15: 'b057c91b09', GC16: '79225b4375', TR41: '6ad1fb581e', TR42: '181451ed8d',
    BG28: '63cd5ec38a', TR43: '30cfc0be89', TR44: '728409cf93', TR45: '97f354c9d9',
    TR46: 'b8c363407b', GC17: 'e363c49767', TR47: '7ee74a9972', TR48: '6d1dcf1c70',
    TR49: '1377a1d016', MS34: 'e92987b456', TR50: 'f5e01316c2', TR51: 'e06bf969cb',
    TR52: 'ff7d6ad9cc', TR53: '00e0eb334c', GD12: '156fd6dde1', GD13: '7405b411c4',
    MS35: '15270428fc', HC16: 'a6b09c64a6', TR54: 'c90d1a6080', IM1: '2a2a628f91',
    IM2: 'd2cb42df8b', IM3: '04e8d7158d', IM4: '47ac4b8c5c', IM5: 'b755653ce1',
    IM6: '3f2a7f93fe', IM7: 'fd33407cb7', IM8: 'cbdb34fc24', IM9: '77ee7dc8bd',
    IM12: '6b77e37583', IM13: 'cf5bc2e54f', IM14: '943a445722', IM15: '4c9279250b',
    IM16: '39b7610af9', IM17: 'e3aef3884b', TR1: '062cea48ea', TR2: '33f6488c90',
    TR3: '3889fb90ca', TR4: '39761f3bb4', TR5: '375ebc1c0c', TR6: 'fc013ad3d5',
    TR7: 'e6a3d3c459', TR8: '693e68db4f', TR9: '7ebe82a885', TR10: 'f22fd644a3',
    TR11: '6905710fc9', TR12: '983da3a9ae', TR13: 'f3ce893e89', TR14: '2757d8bc12',
    TR15: 'ed79e72b8d', TR16: '987c731098', TR17: 'd7b61aeaf7', TR18: 'b65da643d4',
    TR19: '3dc8708311', TR20: '2fa8f10318', TR21: '59b1e22d57', TR22: '2f60bc0520',
    TR23: '35364eae5e', TR24: '7e8f5ec763', TR25: '51670de651', TR26: '75647026fb',
    TR27: '514abc9558', TR60: '93d09d23c4', TR61: '13af417ed1', TR62: '2de8134b29',
    TR63: '18b00ec881', TR64: '7b3367b254', TR65: '13c5c193ff', TR66: 'e6572e1027',
    TR67: '5218068b5b', TR68: 'da62413763', MS1: 'e4c754162b', MS2: '44e2b3c9e1',
    MS3: '3a0cd8c3d8', MS4: '6a839b7cd3', MS5: 'bcd83ed2d5', MS6: '83bd0aa7f1',
    MS7: 'd731dc414f', MS8: 'd06bafa67a', MS9: '75bcbc4bc7', MS10: '82ac5d3e79',
    MS11: 'e019e0e7c3', MS12: '8c31de9aa4', MS13: 'eecb9aa478', MS14: '57b2ee3bb3',
    MS15: 'c13c8af82d', MS16: '79f6be37a6', MS17: '27fd6c6cf8', MS18: '8f1ed37933',
    MS19: '86ee201ddc', MS20: 'ce9ed8ceb5', MS21: 'e39480d7d8', MS22: '36c8acd348',
    MS23: '6f413888eb', MS24: 'fdf298ff7b', MS25: '52592c5073', MS26: '5cde135476',
    BG1: '0d4ee84fd6', BG2: '80c6335603', BG3: '96599ee6fc', BG4: '4950e22cfa',
    BG5: '735044f6e3', BG6: '2fc2d51d24', BG7: 'fe3d0c519a', BG8: '895062d0ab',
    BG9: '606da17258', BG10: '0311373a8c', BG11: '2c5958a449', BG12: '0433580256',
    BG13: '07522d1556', BG14: '6208c6dfd5', BG15: '5152154c76', BG16: 'f0fd6d36fa',
    BG17: '3b57fa25d7', BG18: '442c6d3988', BG19: '24694c122d', BG20: '7974905645',
    BG21: 'bc366a7fc3', BG22: '4077abfeb3', BG23: '3644dce9ee', RV1: '93f52a6ca9',
    RV2: 'a2309dd99b', RV3: '02dc044c0a', RV4: '02da8791e5', RV5: 'cbd2852fd8',
    RV6: 'eed4fc6528', RV7: '4cd6b951d6', RV8: 'ced59013df', RV9: '0c489d6165',
    RV10: 'c5b537554a', RV11: '41814a8c1b', RV12: '5158b94dda', RV13: 'ef2fdbb443',
    RV14: '5c0e1db8b9', RV15: 'b4bf9c7a27', RV16: 'c6095792e6', RV17: '74e1188ecc',
    RV18: '1862a34e6e', RV19: '9ca6b07730', RV20: 'c6ae94b7c1', RV21: '5b002e4144',
    OB1: '3f57c9a865', OB2: '519ad77327', OB3: '8e06838c48', OB4: 'a9ab8c8f52',
    OB5: '1bd2b182e6', OB6: 'd62a4cee2e', OB7: '2838fed583', OB8: '8330f7cc05',
    OB9: 'a131ac629f', OB10: 'd0fc78a894', OB11: '0e3109d88b', OB12: 'b921557cf4',
    EP1: '55021262bd', EP2: '90da17304a', EP3: 'a0d20661c2', EP4: 'dbe410e97d',
    EP5: '150b1c4d3a', EP6: '8b6553f1bb', EP7: 'e5561c5248', EP8: '5de7ac7ac3',
    EP9: '015129713c', EP10: 'd8e23a0588', EP11: '82b5b842e4', EP12: 'ff264eb246',
    EP13: '5fedcf0db6', EP14: '8960fad06c', EP15: 'd3cb14e319', EP16: '34cd3ed320',
    EP17: '53fc9ba534', TR55: '7e3a0de849', TR56: '29252a3e3f', TR57: 'c618da2c53',
    TR58: 'd90e103ad6', TR59: '796910e11e', TR28: '79a759aa85', TR29: 'e8fd96211b',
    TR30: '41c0bbc75f', TR31: 'b52bd33437', VP1: 'c0c5cf226a', VP2: '38f3aa2a50',
    VP3: '11b53dc602', VP4: '5bc33979d6', GC1: '098816b9d2', RP1: '474785273d',
    RP1B: '559c28d89c', RP1C: 'c89ab35860', RP2: '415407df1c', RP2B: '551f836c5c',
    RP2C: '2b3aa0e7f8', RP18: '92b77b81c4', RP18B: 'de233c647e', RP18C: '0094ba93ec',
    RP19: 'fa6b986d26', RP19B: '0f63493358', RP19C: 'b1edb3595c', RP20: 'fa555e08ab',
    RP20B: '7e15798fce', RP20C: '29f3ab5f82', RP3: '00c0572179', RP3B: '431c5b9585',
    RP3C: '48711daba2', RP4: '966d7e0fe1', RP4B: '25e46fc880', RP4C: 'c2e5718d7d',
    RP21: 'a93c90d742', RP21B: 'c1591fcd6a', RP21C: '8b65f65c9b', RP22: '8c7c81d8f7',
    RP22B: '436eadb3a6', RP22C: 'f1ec82c805', RP23: '3f5de672fa', RP23B: '01b0f55cbf',
    RP23C: 'fc1e8f26f3', RP5: '5343e0409b', RP5B: '9f18a5b5f4', RP5C: '2046f9ee2d',
    RP6: '0cef360a76', RP6B: '50a835f143', RP6C: 'f5c1c11e6e', RP24: '373da8945e',
    RP24B: '841c1ffc1a', RP24C: '3847dec747', RP25: '4895e66aa9', RP25B: 'e91a0c20c1',
    RP25C: '7daafd8a53', RP26: '59a49f4c9a', RP26B: '657ffe17f3', RP26C: '25a6b434bc',
    RP7: 'a811af76a5', RP7B: '6cd3b7cb00', RP7C: '072f62353b', RP8: '323cef7f1f',
    RP8B: 'f36b505058', RP8C: '8be8efb8ea', RP27: '5870ab97e1', RP27B: '72caa3562b',
    RP27C: 'a85b528e04', RP28: '633944baf3', RP28B: '164f0f6f70', RP28C: '3bb2b95a94',
    RP29: '307491fe21', RP29B: 'f7deae42fb', RP29C: 'd117defa79', RP9: '4854a4bf18',
    RP9B: '7cd5160936', RP9C: 'c1df913689', RP10: '04e308618e', RP10B: '5e7eda5da0',
    RP10C: '0de7108543', RP30: 'ddcb66d121', RP30B: '2a032026b9', RP30C: '048b557d67',
    RP31: '5f665b03fc', RP31B: 'cd0e12d58a', RP31C: 'c6fcc62ebc', RP32: '8a11d4ca14',
    RP32B: 'cd3f8373f5', RP32C: '9ec137d16b', RP11: '2977d6fb61', RP11B: 'd7b59e6bb2',
    RP11C: 'c53dcfd317', RP12: '50d8085640', RP12B: 'b1cb355503', RP12C: '299437ec55',
    RP33: '71feeef772', RP33B: 'f9e0c478d3', RP33C: '1b6557870a', RP34: '964ab22671',
    RP34B: '492db4cf76', RP34C: '347674bcb5', RP35: '70259f4e91', RP35B: 'b90ba93943',
    RP35C: 'b676b15db8', RP13: 'd35bbc3779', RP14: 'c08433e005', RP15: 'b84e68ff74',
    RP16: 'e8ccc0ab99', RP17: '6e66382798', TR1B: 'b631f5efed', TR1C: '2c36567b61',
    TR3B: '553f88c22a', TR3C: '017bf8b281', TR23B: '53b5dcb30e', TR23C: 'bc86bd410c',
    TR50B: 'c416c02c3f', TR50C: '2abca26f16',
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

  window.FZART = {
    dessinAvatar,
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
     */
    dos: (code) => (code ? `/img/dos/${String(code).toUpperCase()}${IMG_EXT}` : null),
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
