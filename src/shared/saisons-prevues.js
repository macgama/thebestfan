/**
 * Les saisons prévues : le calendrier de Gaël, posé d'avance.
 *
 * Décision du 18 octobre 2026 : une saison par trimestre (du 1er janvier au
 * 31 mars, du 1er avril au 30 juin, du 1er juillet au 30 septembre, du
 * 1er octobre au 31 décembre), qui se lance seule à son jour d'ouverture. La
 * saison 1, « La reprise », finit le 31 décembre 2026 ; les quatre de 2027
 * sont ici, avec les séries que Gaël a validées le même jour.
 *
 * Au démarrage, le serveur crée **en brouillon** chacune de ces saisons qui
 * n'existe pas encore (même numéro), une seule fois : une fiche modifiée ou
 * supprimée dans l'onglet SAISONS n'est jamais recréée ni réécrite. C'est
 * l'administration qui fait foi ; ce fichier n'est qu'un point de départ.
 *
 * Les noms et les annonces sont du français du code : `npm run langues` les
 * relève, et ils se traduisent comme le reste du jeu.
 */

/* Le carnet d'une saison de trois mois. Celui du code (`CARNET_DEFAUT`,
   `shared/saison.js`) est calibré sur 63 jours ; un trimestre en compte de
   90 à 92. Mêmes paliers, mêmes gains, seuils multipliés par environ 1,45 et
   arrondis. */
export const CARNET_TRIMESTRE = Object.freeze([
  { tampons: 15, nom: 'De retour', echarpes: 100, packs: 0 },
  { tampons: 50, nom: 'Dans le bain', echarpes: 150, packs: 1, insigne: 'lisere' },
  { tampons: 110, nom: 'Remis en voix', echarpes: 250, packs: 2, insigne: 'tampon' },
  { tampons: 160, nom: 'Au rendez-vous', echarpes: 400, packs: 3 },
  { tampons: 205, nom: 'Revenu pour de bon', echarpes: 600, packs: 4, titre: true },
].map((p) => Object.freeze(p)));

/* `stuff` : le préfixe des pièces neuves de la série (`hc-`, `mt-`, `gd-`,
   `shared/fanzzy/inventaire.js`), fermées jusqu'à la saison qui les ouvre.
   LES REVENANTS n'en ont pas. */
export const SAISONS_PREVUES = Object.freeze([
  { numero: 2, nom: 'Les héros du canapé', ouvre: '2027-01-01', fin: '2027-03-31',
    series: ['HC'], stuff: 'hc-',
    texte: 'L’hiver, on supporte depuis le canapé. Les héros du salon entrent en tribune.' },
  { numero: 3, nom: 'Les phénomènes météo', ouvre: '2027-04-01', fin: '2027-06-30',
    series: ['MT'], stuff: 'mt-',
    texte: 'Pluie, vent, grêle : la tribune tient bon. La météo descend sur la pelouse.' },
  { numero: 4, nom: 'Les galères de déplacement', ouvre: '2027-07-01', fin: '2027-09-30',
    series: ['GD'], stuff: 'gd-',
    texte: 'Car en panne, train raté : on arrive quand même. L’été, la tribune prend la route.' },
  { numero: 5, nom: 'Les revenants', ouvre: '2027-10-01', fin: '2027-12-31',
    series: ['RV'], stuff: null,
    texte: 'Ils reviennent hanter le virage. Les revenants sortent pour Halloween.' },
].map((s) => Object.freeze(s)));
