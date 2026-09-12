/**
 * Le catalogue de la boutique : ce qui est en vente, et à quel prix.
 *
 * ## Le prix vit ici, et nulle part ailleurs
 *
 * La page l'affiche, elle ne le décide pas. Une commande ne porte qu'un
 * **identifiant d'article** ; le serveur en tire le montant lui-même. C'est la
 * règle la plus importante de tout ce fichier : sans elle, il suffit de
 * modifier un champ dans le navigateur pour s'acheter un booster à un centime,
 * et l'on ne s'en aperçoit qu'en lisant les relevés.
 *
 * ## Les montants sont en centimes
 *
 * Jamais en euros, jamais en flottant. Stripe compte en centimes, la base
 * compte en centimes, et ce fichier compte en centimes — une seule unité
 * traverse toute la chaîne, et personne n'a à diviser par cent quelque part.
 *
 * ## Ce qui n'est pas ici
 *
 * **Rien qui se gagne.** Les âges d'un Fanzzy s'achètent en écharpes, et les
 * écharpes se gagnent en poussant. Ce que la boutique vend, ce sont des
 * raccourcis vers ce qui se collectionne — jamais vers ce qui décide d'un
 * duel. Voir la note sur l'équilibre en fin de fichier.
 */

/** Les familles, pour ranger l'écran. L'ordre est celui de l'affichage. */
export const RAYONS = [
  { id: 'boosters', nom: 'Boosters', texte: 'Cinq cartes, dont un ou deux supporters.' },
  { id: 'echarpes', nom: 'Écharpes', texte: 'La monnaie qui fait grandir les Fanzzy.' },
  { id: 'tenues', nom: 'Tenues', texte: 'De quoi habiller un supporter que tu as déjà.' },
  { id: 'stuff', nom: 'Équipement', texte: 'Ce qu’on emporte dans la tribune.' },
];

/**
 * Les articles.
 *
 * `livraison` décrit ce que le serveur doit remettre, et rien d'autre ne le
 * décrit : le jour où un article changera de contenu, c'est cette ligne-ci
 * qu'on modifiera, et la livraison suivra sans qu'on touche au moteur.
 */
export const CATALOGUE = [
  {
    id: 'pack-1', rayon: 'boosters', nom: 'Un booster',
    texte: 'Cinq cartes d’une série de ton choix.',
    prix: 199, livraison: { type: 'packs', n: 1 },
  },
  {
    id: 'pack-5', rayon: 'boosters', nom: 'Cinq boosters',
    texte: 'De quoi ouvrir une série pour de bon.',
    prix: 899, marque: 'le plus pris', livraison: { type: 'packs', n: 5 },
  },
  {
    id: 'pack-12', rayon: 'boosters', nom: 'Douze boosters',
    texte: 'La caisse du samedi.',
    prix: 1899, livraison: { type: 'packs', n: 12 },
  },

  {
    id: 'ech-500', rayon: 'echarpes', nom: '500 écharpes',
    texte: 'Une évolution, et de quoi voir venir.',
    prix: 299, livraison: { type: 'scarves', n: 500 },
  },
  {
    id: 'ech-1400', rayon: 'echarpes', nom: '1 400 écharpes',
    texte: 'Trois évolutions, ou un troisième âge.',
    prix: 699, livraison: { type: 'scarves', n: 1400 },
  },
  {
    id: 'ech-4000', rayon: 'echarpes', nom: '4 000 écharpes',
    texte: 'La réserve de toute une saison.',
    prix: 1799, livraison: { type: 'scarves', n: 4000 },
  },

  {
    id: 'tenue-1', rayon: 'tenues', nom: 'Une tenue',
    texte: 'Tirée parmi celles qui te manquent, pour un Fanzzy que tu as.',
    prix: 249, livraison: { type: 'skin', n: 1 },
  },
  {
    id: 'stuff-1', rayon: 'stuff', nom: 'Une pièce d’équipement',
    texte: 'Tirée parmi celles qui te manquent.',
    prix: 249, livraison: { type: 'stuff', n: 1 },
  },
];

export const ARTICLE_PAR_ID = new Map(CATALOGUE.map((a) => [a.id, a]));

/** « 1 899 » centimes devient « 18,99 € ». Écrit une fois, lu partout. */
export const enEuros = (centimes) =>
  `${(centimes / 100).toFixed(2).replace('.', ',')} €`;

/* ---------------------------------------------------------------------------
   Deux choses qu'il faut savoir avant de mettre cet écran en ligne, et qui ne
   sont pas des détails d'implémentation.

   ## 1. Un booster payé en argent réel est un objet réglementé

   Plusieurs pays traitent les coffres à contenu aléatoire achetés avec de
   l'argent comme un jeu de hasard : la Belgique et les Pays-Bas les ont
   interdits, et d'autres imposent l'affichage des probabilités de tirage. Le
   jeu est en français, il suit des clubs suisses et français, et il est
   ouvert à des mineurs.

   Trois choses au moins sont à trancher avant d'encaisser un euro :
     — afficher les taux de tirage (ils sont dans `RATES`, côté serveur) ;
     — décider si l'on vend des boosters dans les pays qui les interdisent ;
     — un garde-fou d'âge, ou un plafond de dépense.

   Ce fichier ne tranche rien de tout cela. Il ne peut pas : ce sont des
   décisions, pas du code.

   ## 2. Ce qui est en vente ne décide pas d'un duel

   Les écharpes achètent des âges, et un âge donne des modificateurs. La ligne
   entre « acheter du temps » et « acheter une victoire » est donc mince, et
   elle est tenue par une seule chose : **le geste reste le geste**. Un joueur
   équipé a une fenêtre plus large ; il n'a pas une note qu'il n'a pas jouée.
   Voir la note en tête de `gestures.js`. Le jour où un article vendra de la
   poussée directe, cette ligne sera franchie.
--------------------------------------------------------------------------- */
