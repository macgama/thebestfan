/**
 * Le catalogue de la boutique : ce qui est en vente, et à quel prix.
 *
 * ## L'argent réel n'achète qu'une chose : des billets
 *
 * C'est la règle qui gouverne tout ce fichier, et elle n'est pas commerciale,
 * elle est structurelle.
 *
 * Auparavant, les quatre rayons menaient tous à de l'aléatoire. Les boosters,
 * évidemment. Mais aussi « une tenue » et « une pièce d'équipement », qui
 * étaient des **tirages** et non des objets choisis. Et les écharpes, parce
 * qu'une écharpe achète un booster à quarante-cinq : les vendre revenait à
 * vendre des boosters avec une étape de plus.
 *
 * Maintenant, l'argent réel achète des **billets**, et rien d'autre. Les
 * billets achètent des objets **nommés** : cette pièce-là, cette tenue-là, sur
 * ce Fanzzy-là. On voit ce qu'on prend avant de le prendre.
 *
 * Les boosters restent : gratuits, à la recharge, ou payés en écharpes gagnées
 * en poussant. Aucun chemin ne mène d'un euro à un tirage.
 *
 * Ce n'est pas une précaution de façade. Plusieurs pays traitent les coffres à
 * contenu aléatoire achetés avec de l'argent comme un jeu de hasard — la
 * Belgique et les Pays-Bas les ont interdits. Le jeu est en français, il suit
 * des clubs suisses et français, et il est ouvert à des mineurs. Couper la
 * chaîne à la racine vaut mieux que la border de garde-fous.
 *
 * `verifierCatalogue()`, plus bas, fait de cette phrase une **vérification** et
 * non une intention : un article payant qui livrerait autre chose que des
 * billets fait rougir un contrôle.
 *
 * ## Le prix vit ici, et nulle part ailleurs
 *
 * La page l'affiche, elle ne le décide pas. Une commande ne porte qu'un
 * **identifiant d'article** ; le serveur en tire le montant lui-même. Sans
 * cette règle, il suffit de modifier un champ dans le navigateur pour s'offrir
 * mille billets à un centime, et l'on ne s'en aperçoit qu'en lisant les
 * relevés.
 *
 * Les prix en euros ne sont **pas** réglables depuis l'administration, à la
 * différence de l'équilibrage du jeu : un prix qu'un écran peut changer d'un
 * doigt est un prix qui finira changé par erreur.
 *
 * ## Les montants sont en centimes
 *
 * Jamais en euros, jamais en flottant. Stripe compte en centimes, la base
 * compte en centimes, et ce fichier compte en centimes — une seule unité
 * traverse toute la chaîne, et personne n'a à diviser par cent quelque part.
 */

/**
 * Le nom de la monnaie, écrit une fois.
 *
 * La renommer est une ligne : rien d'autre dans le code ne la nomme en
 * français. « Fanion » avait été écarté — c'est déjà un motif de tifo, et le
 * joueur lirait « dessine un fanion » et « tu as 200 fanions » sur le même
 * écran.
 */
export const MONNAIE = { un: 'billet', plusieurs: 'billets', Un: 'Billet', Plusieurs: 'Billets' };

/** Les familles, pour ranger l'écran. L'ordre est celui de l'affichage. */
export const RAYONS = [
  { id: 'billets', nom: 'Billets',
    texte: 'La monnaie qui achète les tenues et l’équipement, à l’unité.' },
];

/**
 * Ce qui s'achète en argent réel.
 *
 * `livraison` décrit ce que le serveur doit remettre, et rien d'autre ne le
 * décrit. Un seul type est permis — voir `LIVRAISONS_PAYANTES`.
 */
export const CATALOGUE = [
  {
    id: 'billets-100', rayon: 'billets', nom: '100 billets',
    texte: 'De quoi prendre deux pièces d’équipement communes.',
    prix: 199, livraison: { type: 'billets', n: 100 },
  },
  {
    id: 'billets-550', rayon: 'billets', nom: '550 billets',
    texte: 'Une tenue et quelques pièces, ou une pièce légendaire.',
    prix: 899, marque: 'le plus pris', livraison: { type: 'billets', n: 550 },
  },
  {
    id: 'billets-1200', rayon: 'billets', nom: '1 200 billets',
    texte: 'De quoi habiller toute une tribune.',
    prix: 1799, livraison: { type: 'billets', n: 1200 },
  },
];

export const ARTICLE_PAR_ID = new Map(CATALOGUE.map((a) => [a.id, a]));

/**
 * Ce qu'un article payé en argent réel a le droit de livrer.
 *
 * Une **liste blanche**, et c'est délibéré : une liste noire laisserait passer
 * le prochain type de livraison qu'on ajoutera, et ce jour-là personne ne
 * penserait à la mettre à jour. Ici, ajouter un type de livraison payante
 * oblige à venir écrire son nom sur cette ligne — c'est-à-dire à décider.
 */
export const LIVRAISONS_PAYANTES = new Set(['billets']);

/**
 * Vérifie que le catalogue tient sa promesse.
 *
 * Appelée par la suite, et non au chargement : un catalogue fautif doit faire
 * rougir un contrôle, pas empêcher le serveur de démarrer en production un
 * dimanche soir. Elle rend la liste des fautes plutôt que de lever à la
 * première — corriger une faute pour en découvrir une autre fait perdre trois
 * fois le temps qu'il faut.
 *
 * Elle prend un catalogue en argument **pour pouvoir être éprouvée**. Sans ça
 * elle ne voyait jamais que le vrai, qui est correct : on pouvait lui retirer
 * sa règle principale sans qu'un contrôle bouge. Un validateur qu'on n'a jamais
 * vu refuser quelque chose n'est pas un validateur.
 */
export function verifierCatalogue(catalogue = CATALOGUE) {
  const fautes = [];

  for (const a of catalogue) {
    if (!LIVRAISONS_PAYANTES.has(a.livraison?.type)) {
      fautes.push(`${a.id} : livre « ${a.livraison?.type} », or l’argent réel `
        + `n’achète que ${[...LIVRAISONS_PAYANTES].join(', ')}`);
    }
    if (!Number.isInteger(a.prix) || a.prix <= 0) {
      fautes.push(`${a.id} : le prix doit être un entier de centimes`);
    }
    if (!RAYONS.some((r) => r.id === a.rayon)) {
      fautes.push(`${a.id} : rayon « ${a.rayon} » non déclaré`);
    }
  }

  if (new Set(catalogue.map((a) => a.id)).size !== catalogue.length) {
    fautes.push('deux articles portent le même identifiant');
  }

  return fautes;
}

/** « 1 799 » centimes devient « 17,99 € ». Écrit une fois, lu partout. */
export const enEuros = (centimes) =>
  `${(centimes / 100).toFixed(2).replace('.', ',')} €`;

/* ---------------------------------------------------------------------------
   Ce qu'il faut savoir avant de mettre cet écran en ligne.

   ## La question des coffres payants ne se pose plus

   Elle se posait tant que l'argent achetait des boosters — directement, ou par
   l'intermédiaire des écharpes. Elle ne se pose plus : aucun article payant ne
   livre autre chose que des billets, et les billets n'achètent que des objets
   nommés. Un joueur sait exactement ce qu'il reçoit avant de payer.

   Ce n'est pas une opinion sur la réglementation, c'est une propriété du
   catalogue, et `verifierCatalogue()` la tient.

   **Le jour où quelqu'un voudra revendre des boosters**, il faudra ajouter
   `packs` à `LIVRAISONS_PAYANTES`. Cette ligne-là est le point de décision : à
   ce moment reviennent l'affichage des taux de tirage, la question des
   territoires, et celle d'un garde-fou d'âge. Elles sont écartées aujourd'hui
   parce que la chaîne est coupée, pas parce qu'elles ont été résolues.

   ## Ce qui est en vente ne décide pas d'un duel

   L'équipement porte des modificateurs, donc la ligne entre « acheter du
   confort » et « acheter une victoire » est mince. Elle est tenue par une
   seule chose : **le geste reste le geste**. Un joueur équipé a une fenêtre
   plus large ; il n'a pas une note qu'il n'a pas jouée. Voir la note en tête
   de `gestures.js`. Le jour où un article vendra de la poussée directe, cette
   ligne sera franchie.

   Les écharpes, elles, ne s'achètent plus du tout. Elles se gagnent en
   poussant, et elles seules font grandir un Fanzzy : la progression du jeu
   reste entièrement hors de portée d'une carte bancaire.
--------------------------------------------------------------------------- */
