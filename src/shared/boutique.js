/**
 * Le catalogue de la boutique : ce qui est en vente, et à quel prix.
 *
 * ## L'argent réel n'achète qu'une chose : l'abonnement
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
 * Il y a eu une étape intermédiaire, et elle vaut d'être racontée. L'argent
 * réel a d'abord acheté des **billets**, une seconde monnaie qui n'achetait que
 * des objets nommés — cette pièce-là, cette tenue-là. La chaîne euro → tirage
 * était coupée par une séparation qu'il fallait tenir : deux compteurs, deux
 * règles, et la vigilance de ne jamais les mélanger.
 *
 * Les billets n'existent plus. **L'argent réel n'achète que l'abonnement**, et
 * les écharpes ne se gagnent qu'en jouant. La chaîne n'est plus coupée par une
 * séparation, elle est coupée **à la racine** : il n'y a plus de monnaie
 * achetable, donc plus rien à séparer, et plus rien à tenir.
 *
 * Les objets nommés se paient désormais en écharpes, comme les boosters. Ce
 * n'est pas un adoucissement de la règle, c'est sa version la plus simple.
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
/* Une seule monnaie, et elle se gagne. Ce mot reste servi par la route pour
   que la page n'écrive pas « écharpe » de son côté : le jour où elle changerait
   de nom, il y aurait un seul endroit à corriger. */
export const MONNAIE = { un: 'écharpe', plusieurs: 'écharpes', Un: 'Écharpe', Plusieurs: 'Écharpes' };

/** Les familles, pour ranger l'écran. L'ordre est celui de l'affichage. */
export const RAYONS = [
  /* **L'abonnement d'abord.** C'est le seul rayon qui ne s'achète pas à la
     pièce, et le seul dont le prix se paie tous les mois : il mérite d'être lu
     avant qu'on additionne des billets. */
  { id: 'abonnement', nom: 'L’abonnement',
    texte: 'Du rythme, de la mémoire et du confort. Jamais un avantage de jeu — '
      + 'tous les formats, tous les âges et tous les classements restent ouverts à tous.' },
];

/**
 * Ce qui s'achète en argent réel.
 *
 * `livraison` décrit ce que le serveur doit remettre, et rien d'autre ne le
 * décrit. Un seul type est permis — voir `LIVRAISONS_PAYANTES`.
 */
export const CATALOGUE = [
  /* ---------------------------------------------------------- l'abonnement

     `recurrence` est ce qui fait la différence entre un paiement et un
     abonnement, et c'est **le serveur** qui la lit : il ouvre alors une session
     Stripe en `mode: 'subscription'` au lieu de `'payment'`. La page, elle, ne
     fait rien de particulier — un article est un article, et lui apprendre la
     différence l'obligerait à la garder à jour.

     `jours` est le repli, pas la règle : ce qui fait foi est la fin de période
     que Stripe renvoie avec chaque facture payée. Il sert le premier jour, avant
     que la moindre facture soit arrivée, et le jour où l'on accorde un
     abonnement à la main. */
  {
    id: 'abo-mensuel', rayon: 'abonnement', nom: 'Abonnement mensuel',
    texte: 'Se renouvelle chaque mois. S’arrête quand tu veux.',
    prix: 399, recurrence: 'month',
    /* **Un booster avec l'abonnement**, et il est déclaré ici plutôt que
       glissé dans le moteur.

       C'est une décision de Gaël, prise en connaissance de la règle qu'elle
       entame : l'argent réel n'achetait jusqu'ici que l'abonnement, et un
       booster est un tirage. La chaîne euro → tirage, coupée à la racine
       quand la monnaie achetable a disparu, se rouvre donc d'un cran.

       Trois bornes la tiennent étroite, et elles sont le prix de la
       décision. Le cadeau est **attaché à une échéance** et ne s'achète pas
       séparément : on ne peut pas en prendre deux sans payer deux mois. Il
       est **déclaré dans le catalogue**, à la vue du contrôle qui surveille
       ce que l'argent achète, et non caché dans la livraison. Et aucune
       monnaie ne s'achète toujours — c'est la borne qui compte le plus,
       parce que c'est elle qui empêche de transformer une carte bancaire en
       tirages à volonté.

       La raison est celle qu'on avait écrite en face : un paiement qui ne
       donne rien tout de suite se vit comme un paiement qui n'a pas marché.
       L'abonnement n'ouvre que du confort, et rien de ce confort ne se voit
       dans la seconde qui suit. Le booster, si. */
    livraison: { type: 'abonnement', formule: 'mensuel', jours: 31, packs: 1 },
  },
  {
    id: 'abo-annuel', rayon: 'abonnement', nom: 'Abonnement annuel',
    texte: 'Douze mois d’un coup, au prix de dix.',
    prix: 3990, marque: 'deux mois offerts', recurrence: 'year',
    /* **Six, et non un.** Voir les bornes de l'abonnement mensuel : elles
       tiennent toujours, c'est le nombre qui bouge.

       Ce qui était écrit ici disait l'inverse — « douze fois moins souvent
       que le mensuel, pour douze mois, ce n'est pas une inégalité à
       corriger ». C'était juste vu du côté de la comptabilité et faux vu du
       côté de celui qui paie : quarante euros d'un coup contre quatre, et la
       même petite carte au bout. La formule annuelle demande douze mois de
       confiance d'avance ; elle ne rendait rien de plus le jour où on la
       donne.

       Six ouvre une série entière d'un coup — c'est un **moment**, pas un
       appoint, et c'est le seul de toute cette page qui se voie dans la
       seconde qui suit le paiement. Le reste de l'abonnement est du confort
       qui se découvre en jouant.

       Six et non douze : un par mois payé d'avance ferait du cadeau la
       raison de s'abonner, et l'abonnement se vendrait alors sur des cartes
       — c'est-à-dire exactement la pente que les bornes ci-dessus
       refusent. */
    livraison: { type: 'abonnement', formule: 'annuel', jours: 366, packs: 6 },
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
export const LIVRAISONS_PAYANTES = new Set(['abonnement']);

/**
 * L'argent réel produit-il de la monnaie de jeu ?
 *
 * La réponse doit être **non**, pour toujours, et cette fonction est là pour
 * qu'une suite puisse le demander plutôt que de le croire.
 *
 * Une écharpe achète un booster à quarante-cinq. Vendre des écharpes — sous
 * n'importe quel nom, y compris « billets » — rouvrirait la chaîne euro →
 * tirage, c'est-à-dire un coffre à contenu aléatoire payé en argent réel, que
 * la Belgique et les Pays-Bas traitent comme un jeu de hasard. Le jeu est en
 * français, il suit des clubs suisses et français, et il est ouvert à des
 * mineurs.
 *
 * L'abonnement ne rouvre pas cette porte : il n'ajoute aucune écharpe, il
 * change le **rythme** auquel les boosters gratuits reviennent. La nuance est
 * réelle et elle est fine — elle est notée dans `IDEES.md`, parce qu'elle
 * mérite d'être relue par quelqu'un dont c'est le métier avant l'ouverture.
 */
export const MONNAIES_ACHETABLES = ['billets', 'echarpes', 'écharpes', 'packs', 'boosters'];
export const VEND_DE_LA_MONNAIE = () =>
  CATALOGUE.filter((a) => MONNAIES_ACHETABLES.includes(a.livraison?.type))
    .map((a) => a.id);

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
