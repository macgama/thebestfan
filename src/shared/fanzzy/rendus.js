/**
 * De quel rendu vient chaque carte.
 *
 * Les dessins arrivent numérotés — `001.png`, `047.png`, et depuis peu
 * `001-victoire.png` ou `001evo2-neutre.png` pour les états. Le catalogue, lui,
 * les connaît sous `TR1`, `MS15`, `BG22`. Sans cette table, plus personne ne
 * peut relier les deux — et c'est passé près : elle n'a vécu qu'en fichier
 * temporaire de session pendant deux jours.
 *
 * Elle sert à chaque nouveau lot : on renomme les rendus avec l'identifiant de
 * catalogue avant de les passer dans `scripts/fanzzy-images.mjs`.
 *
 * **On n'y touche plus.** Un numéro déjà attribué le reste : le réattribuer
 * ferait pointer un futur lot d'états sur le mauvais personnage, et personne ne
 * s'en apercevrait avant de voir un capybara faire la tête d'un vampire.
 */
export const RENDU = {
  // --- LA TRIBUNE
  TR1: '001', TR2: '002', TR3: '007', TR4: '010', TR5: '019', TR6: '046',
  TR7: '047', TR8: '048', TR9: '056', TR10: '085', TR11: '086', TR12: '089',
  TR13: '090', TR14: '091', TR15: '092', TR16: '094', TR17: '095', TR18: '099',
  TR19: '106', TR20: '107', TR21: '109', TR22: '111', TR23: '114', TR24: '115',
  TR25: '116', TR26: '117', TR27: '125',
  // --- LES MÉTIERS DU STADE
  MS1: '003', MS2: '015', MS3: '017', MS4: '022', MS5: '025', MS6: '050',
  MS7: '051', MS8: '052', MS9: '053', MS10: '054', MS11: '055', MS12: '068',
  MS13: '069', MS14: '070', MS15: '071', MS16: '072', MS17: '076', MS18: '083',
  MS19: '097', MS20: '098', MS21: '119', MS22: '121', MS23: '122', MS24: '123',
  MS25: '124', MS26: '126',
  // --- LE BESTIAIRE DES GRADINS
  BG1: '012', BG2: '029', BG3: '036', BG4: '037', BG5: '038', BG6: '039',
  BG7: '040', BG8: '041', BG9: '042', BG10: '043', BG11: '044', BG12: '045',
  BG13: '066', BG14: '067', BG15: '075', BG16: '079', BG17: '084', BG18: '088',
  BG19: '096', BG20: '101', BG21: '103', BG22: '108', BG23: '120',
  // --- LES REVENANTS
  RV1: '024', RV2: '026', RV3: '027', RV4: '028', RV5: '030', RV6: '031',
  RV7: '032', RV8: '033', RV9: '034', RV10: '035', RV11: '058', RV12: '062',
  RV13: '063', RV14: '064', RV15: '073', RV16: '077', RV17: '081', RV18: '105',
  RV19: '112', RV20: '113', RV21: '118',
  // --- CE QUI TRAÎNE AU STADE
  OB1: '014', OB2: '016', OB3: '018', OB4: '020', OB5: '021', OB6: '023',
  OB7: '061', OB8: '065', OB9: '080', OB10: '093', OB11: '100', OB12: '104',
  // --- LES ÉPOQUES
  EP1: '004', EP2: '005', EP3: '006', EP4: '008', EP5: '009', EP6: '011',
  EP7: '013', EP8: '049', EP9: '057', EP10: '059', EP11: '060', EP12: '074',
  EP13: '078', EP14: '082', EP15: '087', EP16: '102', EP17: '110',
};

/** L'inverse : d'un numéro de rendu vers l'identifiant de catalogue. */
export const PAR_NUMERO = new Map(Object.entries(RENDU).map(([id, n]) => [n, id]));

/**
 * Les douze états d'un Fanzzy.
 *
 * Ils ne sont **pas obligatoires**, et c'est la seule façon que ça tienne : la
 * matrice complète fait douze états × trois stades × cent trente-huit cartes,
 * soit 4 968 dessins. Attendre qu'elle soit pleine reviendrait à n'en montrer
 * aucun pendant des mois.
 *
 * Un état absent retombe donc sur `neutre`, et un `neutre` absent sur le
 * plein-pied de la carte. Les dessins peuvent arriver dans n'importe quel
 * ordre, et le jeu s'enrichit tout seul à mesure.
 */
export const ETATS = ['neutre', 'salut', 'pousse', 'but', 'encaisse', 'attente',
  'victoire', 'defaite', 'occasion', 'decision', 'progression', 'ennui'];

/** Ce que chaque état raconte, et quand le jeu le déclenche. */
export const ETAT_QUAND = {
  neutre: 'au repos, et repli de tous les autres',
  salut: 'à l’arrivée sur l’accueil, une fois par session',
  pousse: 'un match de ton club est en cours',
  but: 'ton club marque',
  encaisse: 'ton club encaisse',
  attente: 'avant le coup d’envoi, ou en file d’attente de duel',
  victoire: 'duel gagné, ou match gagné par ton club',
  defaite: 'duel perdu, ou match perdu',
  occasion: 'un tir de ton club passe à côté',
  decision: 'carton ou but refusé contre ton club',
  progression: 'montée de niveau, évolution, série complétée',
  ennui: 'aucun match, aucune activité depuis longtemps',
};
