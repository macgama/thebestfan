/**
 * Le registre des réglages.
 *
 * ## Pourquoi un registre et non une table libre
 *
 * L'administration avait déjà un écran « RÉGLAGES » : deux champs de texte,
 * une clé et une valeur JSON. Pour s'en servir il fallait connaître de mémoire
 * le nom de la clé, son type, et l'étendue de ce qu'elle accepte — c'est-à-dire
 * qu'il fallait avoir lu le code. Ce n'est pas un écran d'administration,
 * c'est une console de base de données avec une mise en page.
 *
 * Pire : **une seule clé était réellement lue par le jeu** (`series_actives`).
 * L'écran proposait en exemple une clé `annonce` censée afficher un bandeau à
 * tous les joueurs ; rien, nulle part, ne lisait cette clé. On pouvait donc
 * l'écrire, la relire, la voir listée — et il ne se passait rien. Un réglage
 * qui ne règle rien est pire qu'un réglage absent : il fait croire que le
 * levier existe.
 *
 * Le registre corrige les deux à la fois. Chaque réglage y déclare son type,
 * ses bornes, son unité et sa valeur par défaut ; l'écran se **dessine** à
 * partir de ces déclarations, et le serveur **valide** contre elles. Ajouter
 * un réglage, c'est ajouter une ligne ici — l'écran et la validation suivent.
 *
 * ## La valeur par défaut est la seule source de vérité
 *
 * Les constantes du jeu ne sont plus écrites deux fois. `PACK_REGEN_MS` se
 * déduit de `pack.regen_min`, et non l'inverse. Deux endroits qui portent la
 * même valeur finissent toujours par diverger, et c'est d'autant plus vicieux
 * ici que le désaccord serait silencieux : le jeu tournerait avec une valeur,
 * l'administration en afficherait une autre, et les deux auraient l'air juste.
 *
 * ## Ce qui n'est délibérément pas réglable
 *
 * Rien de ce qui touche à l'argent, aux droits, ou à ce qui est déjà écrit
 * dans la base d'un joueur. Le prix en euros d'un article vit dans le
 * catalogue de la boutique et nulle part ailleurs (voir `boutique.js`) ; un
 * prix qu'un écran d'administration pourrait changer d'un doigt est un prix
 * qui finira changé par erreur. De même, les taux de tirage d'un booster
 * payant sont une donnée réglementée dans plusieurs pays : ils ne bougent pas
 * sans que quelqu'un décide de les faire bouger, et sûrement pas depuis un
 * champ de saisie.
 */

/* ------------------------------------------------------------ les sections

   Elles n'existent que pour l'écran, mais elles comptent : vingt-six réglages
   à la file, c'est une liste qu'on ne lit pas. Rangés par ce qu'ils
   gouvernent, ce sont six listes courtes qu'on parcourt. */

export const SECTIONS = [
  { id: 'boosters', titre: 'BOOSTERS ET ÉCHARPES',
    aide: 'Le rythme auquel on reçoit des cartes, et ce qu’elles coûtent.' },
  { id: 'virage', titre: 'LE GRAND VIRAGE',
    aide: 'La salle collective adossée à un vrai match.' },
  { id: 'duel', titre: 'LES DUELS',
    aide: 'Les parties courtes, entre joueurs ou contre la machine.' },
  { id: 'deck', titre: 'LA COMPOSITION DU DECK',
    aide: 'Ce qu’un joueur peut emmener. Changer ces nombres rend des decks ' +
      'existants invalides : le serveur les refusera au prochain enregistrement.' },
  { id: 'progression', titre: 'LA PROGRESSION',
    aide: 'L’expérience gagnée par action.' },
  { id: 'etal', titre: 'L’ÉTAL EN ÉCHARPES',
    aide: 'Ce que coûtent les objets nommés — une pièce d’équipement, une tenue — ' +
      'payés en écharpes gagnées en jouant. Les prix en euros, eux, ' +
      'vivent dans le catalogue de la boutique et ne se règlent pas ici : un prix ' +
      'qu’un écran peut changer d’un doigt est un prix qui finira changé par erreur.' },
  { id: 'abonnement', titre: 'L’ABONNEMENT',
    aide: 'Ce que l’abonnement ouvre. Il vend de la largeur et du confort, ' +
      'jamais de la puissance : tous les formats de duel, tous les âges et ' +
      'tous les classements restent ouverts à tout le monde. Un avantage sur ' +
      'la corde ferait à l’argent ce que le jeu refuse déjà au temps — voir ' +
      '`shared/niveau.js`, « le niveau ne donne aucune puissance ».' },
  { id: 'exploitation', titre: 'L’EXPLOITATION',
    aide: 'Ce qui s’adresse aux joueurs depuis l’administration.' },
  /* Les trois sections du quotidien (chantier serveur, vague 1). Chaque source
     de gain y a son interrupteur : couper une source arrête le neuf **et**
     refuse les réclamations de cette source. C'est un disjoncteur qu'on
     actionne un samedi soir sans livraison, et ce qui était dû le redevient
     quand on rallume, dans les délais de chaque source. */
  { id: 'quotidien', titre: 'LE QUOTIDIEN',
    aide: 'Les missions du jour, leur sachet, la carte de présence et le ' +
      'disjoncteur. Les montants des missions sont copiés au tirage du matin : ' +
      'un changement vaut pour le lendemain, le joueur reçoit ce qu’on lui a ' +
      'promis. Le bonus de présence, lui, se calcule au moment où on le ' +
      'récupère : ses réglages valent tout de suite.' },
  { id: 'missions', titre: 'LES MISSIONS DU JOUR',
    aide: 'Une bascule par mission. En éteindre une la sort du tirage dès le ' +
      'lendemain ; les missions déjà tirées aujourd’hui restent. Les cibles ' +
      '(« 3 boosters », « 2 duels classés ») ne se règlent pas : ce sont des ' +
      'règles du jeu, et une cible mal réglée pourrait passer au-dessus du ' +
      'plafond gratuit.' },
  { id: 'saison', titre: 'LA SAISON ET SES PALIERS',
    aide: 'Le carnet de tampons, le passage de relais, les crans de collection ' +
      'et les divisions. Les divisions n’ont aucun montant à régler : elles ne ' +
      'paient que l’insigne et le titre, parce que la ferveur classée n’a pas ' +
      'de plafond pour un abonné et qu’une division payée s’achèterait en partie.' },
];

/* ------------------------------------------------------------ les réglages

   `type` décide du contrôle à l'écran **et** de la validation au serveur :
   les deux lisent la même ligne, ils ne peuvent donc pas diverger.

     entier   — un nombre rond, borné par `min`/`max`
     decimal  — un nombre à virgule, borné
     booleen  — une bascule
     texte    — une ligne, longueur bornée par `max`
     liste    — un tableau de chaînes

   `unite` n'est qu'une étiquette, mais c'est elle qui évite la faute la plus
   coûteuse : lire « 600000 » et croire à des minutes. */

export const REGLAGES = [
  /* ---------------------------------------------------------- boosters */
  { cle: 'pack.regen_min', section: 'boosters', type: 'entier',
    titre: 'Un booster tous les', unite: 'minutes', min: 1, max: 1440, defaut: 10,
    aide: 'Le temps de recharge d’un booster gratuit. Raccourcir remplit les ' +
      'collections plus vite et dévalue les écharpes.' },

  { cle: 'pack.depart', section: 'boosters', type: 'entier',
    titre: 'Boosters offerts à l’inscription', unite: 'boosters', min: 0, max: 20, defaut: 3,
    aide: 'Trois laissent le temps de regarder les cartes. Au-delà de cinq, on ' +
      'voit soixante cartes avant d’avoir compris ce qu’est un Fanzzy.' },

  { cle: 'pack.max', section: 'boosters', type: 'entier',
    titre: 'Réserve maximale', unite: 'boosters', min: 1, max: 99, defaut: 12,
    aide: 'Au-delà, la recharge s’arrête. Sans plafond, une absence d’un mois ' +
      'rapporterait quatre mille boosters.' },

  { cle: 'pack.prix_echarpes', section: 'boosters', type: 'entier',
    titre: 'Acheter un booster coûte', unite: 'écharpes', min: 1, max: 999, defaut: 45,
    aide: 'En écharpes, la monnaie du jeu. Le prix en euros, lui, vit dans le ' +
      'catalogue de la boutique et ne se règle pas ici.' },

  /* ------------------------------------------------------------ virage */
  { cle: 'virage.but_a', section: 'virage', type: 'entier',
    titre: 'La corde marque à', unite: 'points', min: 50, max: 2000, defaut: 260,
    aide: 'L’effort collectif qu’il faut pour arracher un but de jeu. À 400, le ' +
      'marqueur restait à zéro toute la rencontre : il fallait plus de cent ' +
      'secondes de chant ininterrompu, sans personne en face.' },

  { cle: 'virage.souffle_max', section: 'virage', type: 'entier',
    titre: 'Souffle maximum', unite: 'points', min: 20, max: 500, defaut: 100 },

  { cle: 'virage.souffle_par_sec', section: 'virage', type: 'decimal',
    titre: 'Souffle regagné', unite: 'par seconde', min: 1, max: 60, pas: 0.5, defaut: 13,
    aide: 'Ce nombre décide du rythme réel de la salle bien plus que le reste : ' +
      'c’est lui qui dit combien de gestes on peut enchaîner.' },

  { cle: 'virage.decroissance', section: 'virage', type: 'decimal',
    titre: 'La corde retombe de', unite: 'points/seconde', min: 0, max: 30, pas: 0.1, defaut: 1.4,
    aide: 'À zéro, la corde ne redescend jamais et le but finit toujours par ' +
      'tomber tout seul. À 3, elle mangeait l’essentiel de ce qu’une tribune ' +
      'poussait, et le marqueur ne bougeait pas.' },

  { cle: 'virage.inactif_sec', section: 'virage', type: 'entier',
    titre: 'On sort de la foule après', unite: 'secondes sans geste', min: 15, max: 600, defaut: 90,
    aide: 'Sans ça, une tribune de trois cents dont deux cents sont partis ' +
      'dilue l’effort de ceux qui restent.' },

  { cle: 'ferveur.neutre', section: 'virage', type: 'decimal',
    titre: 'Ferveur en soutenant un club qu’on ne suit pas', unite: '× la normale',
    min: 0, max: 1, pas: 0.05, defaut: 0.5,
    aide: 'Au Virage comme au Duel. Ce qui est réduit, c’est ce que le ' +
      'supporter gagne — jamais ce qu’il apporte : une tribune qui pousserait ' +
      'à moitié serait une tribune qu’on décourage de venir, et le but est ' +
      'l’inverse. À 1, venir pousser ailleurs vaut autant que chez soi et les ' +
      'classements de compétition n’ont plus de chez-soi ; à 0, plus personne ' +
      'n’a de raison d’entrer dans un match qui n’est pas le sien.' },

  { cle: 'virage.tribune_min', section: 'virage', type: 'entier',
    titre: 'Une tribune partage la ferveur par au moins', unite: 'supporters',
    min: 1, max: 200, defaut: 10,
    aide: 'La ferveur d’un supporter est sa poussée divisée par l’effectif de ' +
      'sa tribune. Seul, il gardait donc tout : à cinquante on touche un ' +
      'cinquantième, à un on touche tout — **être seul était l’état le plus ' +
      'rentable du jeu**, sur un match où personne ne retient la corde. Ce ' +
      'plancher ne change rien à ce qu’on ressent — la corde bouge pareil —, ' +
      'seulement à ce qu’on récolte. À 1, on revient à l’ancien calcul.' },

  { cle: 'virage.secousse_but_reel', section: 'virage', type: 'entier',
    titre: 'Un vrai but secoue la corde de', unite: 'points', min: 0, max: 400, defaut: 90 },

  /* -------------------------------------------------------------- duel */
  { cle: 'duel.but_a', section: 'duel', type: 'entier',
    titre: 'La corde marque à', unite: 'points', min: 50, max: 2000, defaut: 200,
    aide: 'À 300, un duel de cinq minutes se terminait sur un nul : les deux ' +
      'camps se neutralisaient et la décroissance mangeait le reste.' },

  /* Elle était la seule des cinq valeurs du duel à être écrite en dur, et c'est
     justement celle qu'il a fallu changer. Une valeur d'équilibrage qui échappe
     au registre est une valeur qu'on ne retouche pas en regardant jouer. */
  { cle: 'duel.decroissance', section: 'duel', type: 'decimal',
    titre: 'La corde retombe de', unite: 'points/seconde', min: 0, max: 30, pas: 0.1, defaut: 1.2,
    aide: 'À 2,5, elle mangeait tout l’écart entre les deux camps : la corde ' +
      'oscillait autour de zéro pendant cinq minutes.' },

  { cle: 'duel.buts_pour_gagner', section: 'duel', type: 'entier',
    titre: 'Buts pour gagner', unite: 'buts', min: 1, max: 10, defaut: 3 },

  { cle: 'duel.duree_min', section: 'duel', type: 'entier',
    titre: 'Durée d’un duel', unite: 'minutes', min: 1, max: 30, defaut: 5 },

  { cle: 'duel.chant_puissance', section: 'duel', type: 'entier',
    titre: 'Un chant parfait pousse de', unite: 'points', min: 1, max: 200, defaut: 44,
    aide: 'Avant les modificateurs du Fanzzy. Un geste de tempo demande quatre ' +
      'secondes et demie : à 30, un bon chant ne se voyait pas sur la corde.' },

  /* Les deux réglages de l'appariement par camp. Ils gouvernent ensemble une
     seule chose : est-ce qu'un duel classé trouve de vrais adversaires. */

  { cle: 'duel.renfort_max', section: 'duel', type: 'decimal',
    titre: 'Ferveur en tenant le camp délaissé', unite: '× la normale au maximum',
    min: 1, max: 4, pas: 0.1, defaut: 2,
    aide: 'Un duel est tribune contre tribune : un match dont personne ne suit ' +
      'le visiteur ne se remplirait jamais. Celui qui va tenir ce camp-là est ' +
      'donc payé de sa peine, d’autant plus que le camp était vide à son ' +
      'arrivée. À 1, le renfort ne rapporte rien et les matchs déséquilibrés ' +
      'ne partent plus.' },

  { cle: 'duel.attente_classe_sec', section: 'duel', type: 'entier',
    titre: 'Avant que des bots complètent un duel classé', unite: 'secondes',
    min: 20, max: 900, defaut: 120,
    aide: 'Un entraînement bascule au bout de vingt secondes : on vient y ' +
      'jouer seul, tout de suite. Un duel classé mérite qu’on laisse à ' +
      'quelqu’un le temps de venir tenir le camp qui manque — vingt secondes ' +
      'n’en laissent aucun, et on jouerait toujours contre des machines. Trop ' +
      'long, et le joueur repart avant que le duel commence.' },

  /* La prime des grands formats.

     Un 2v2 demandait de réunir quatre personnes au lieu de deux, et payait
     exactement pareil : le format n'entrait nulle part dans le calcul. Un 3v3
     était donc un mauvais marché — plus dur à remplir, pas mieux payé — et
     personne n'avait de raison d'attendre.

     Elle reste **modeste**, et c'est délibéré : un 3v3 n'est pas trois fois
     plus d'effort pour toi, c'est le même chant avec plus de monde autour. Ce
     qu'on paie est l'attente et la coordination, pas la peine.

     Elle porte sur le format **joué** et non demandé : un 3v3 parti à deux
     contre deux au repli est un 2v2, et il paie comme un 2v2. À 0, les formats
     redeviennent équivalents. */
  { cle: 'duel.prime_format', section: 'duel', type: 'decimal',
    titre: 'Prime par supporter en plus par camp', unite: '× les écharpes',
    min: 0, max: 1, pas: 0.05, defaut: 0.15,
    aide: 'À 0,15 : un 1v1 paie 30 écharpes en victoire classée, un 2v2 en ' +
      'paie 35, un 3v3 39, un 5v5 48. Elle ne touche pas l’expérience — le ' +
      'niveau mesure le temps passé à jouer, et un 3v3 n’en demande pas plus ' +
      'qu’un 1v1.' },

  { cle: 'duel.chant_cout', section: 'duel', type: 'entier',
    titre: 'Un chant coûte', unite: 'souffle', min: 0, max: 100, defaut: 18 },


  /* ------------------------------------------------------- abonnement

     Ce que l'abonnement ouvre, et rien d'autre. Chacun de ces réglages a son
     jumeau gratuit juste au-dessus dans sa propre section : c'est ce qui permet
     de lire l'écart d'un coup d'œil, et de le ramener à zéro sans livraison si
     l'abonnement se révèle trop généreux — ou pas assez. */

  { cle: 'abo.pack_max', section: 'abonnement', type: 'entier',
    titre: 'Réserve maximale d’un abonné', unite: 'boosters', min: 1, max: 99, defaut: 24,
    aide: 'Le plafond gratuit est de douze. Ce qui s’achète ici est le droit ' +
      'de s’absenter deux jours sans rien perdre, pas des cartes en plus : la ' +
      'réserve se remplit au même rythme pour tout le monde si l’autre réglage ' +
      'reste égal.' },

  { cle: 'abo.pack_regen_min', section: 'abonnement', type: 'entier',
    titre: 'Un booster tous les, pour un abonné', unite: 'minutes',
    min: 1, max: 1440, defaut: 6,
    aide: 'Dix minutes pour un joueur inscrit, six pour un abonné. C’est du ' +
      'rythme, donc de la collection plus vite remplie — et la collection ne ' +
      'pèse rien sur la corde, puisqu’un deck entre toujours au premier âge.' },

  { cle: 'abo.clubs_en_plus', section: 'abonnement', type: 'entier',
    titre: 'Emplacements de club en plus', unite: 'clubs', min: 0, max: 8, defaut: 2,
    aide: 'Par-dessus ce que le niveau ouvre déjà, de deux à huit. Suivre un ' +
      'club de plus donne des matchs de plus à vivre ; ça ne donne aucun ' +
      'avantage en duel.' },

  { cle: 'abo.parcours_libre', section: 'abonnement', type: 'entier',
    titre: 'Parties gardées au parcours sans abonnement', unite: 'parties',
    min: 5, max: 500, defaut: 20,
    aide: 'Un joueur inscrit voit ses vingt dernières parties ; un abonné a ' +
      'tout son historique. Les parties ne sont jamais effacées — c’est la ' +
      'lecture qui s’arrête, et elle rouvre entièrement dès l’abonnement.' },

  { cle: 'abo.souvenirs_libres', section: 'abonnement', type: 'entier',
    titre: 'Cartes-souvenirs lisibles sans abonnement', unite: 'cartes',
    min: 5, max: 500, defaut: 20,
    aide: 'Mêmes règles que le parcours : rien n’est perdu, la vitrine est ' +
      'plus courte. Ce qu’on vend est la mémoire longue, pas les souvenirs ' +
      'eux-mêmes.' },

  /* ------------------------------------------- ce que le gratuit plafonne

     **Ces trois-là ne sont pas comme les autres, et il faut le savoir.** Tout
     ce qui précède élargit quelque chose à l'abonné ; ceux-ci **retirent**
     quelque chose à celui qui ne paie pas. C'est une décision de Gaël, prise
     en septembre 2026, et elle entame la règle inscrite en tête du module
     d'abonnement — voir ce fichier-là, où le raisonnement est écrit en entier.

     **Zéro désarme le plafond**, et c'est la valeur à poser si l'on veut
     revenir en arrière sans livraison : c'est tout l'intérêt d'avoir mis ces
     trois nombres ici plutôt que dans le code. */

  { cle: 'abo.duels_classes_jour', section: 'abonnement', type: 'entier',
    titre: 'Duels classés par jour, sans abonnement', unite: 'duels',
    min: 0, max: 200, defaut: 5,
    aide: 'Au-delà, on joue toujours — sur un match d’un autre jour, qui est ' +
      'de l’entraînement. C’est le **compteur** qui ferme, pas le jeu. Zéro ' +
      'désarme le plafond.' },

  { cle: 'abo.virages_classes_jour', section: 'abonnement', type: 'entier',
    titre: 'Virages comptés au classement par jour, sans abonnement',
    unite: 'matchs', min: 0, max: 100, defaut: 2,
    aide: 'Le troisième Virage de la journée se joue entièrement — on pousse, ' +
      'on chante, les cartes-souvenirs tombent — mais sa ferveur ne compte ' +
      'pas au classement. Aucune porte ne se ferme. Zéro désarme le plafond.' },

  { cle: 'abo.taille_classe_libre', section: 'abonnement', type: 'entier',
    titre: 'Plus grand format classé sans abonnement', unite: 'joueurs par camp',
    min: 1, max: 5, defaut: 1,
    aide: 'Le 2v2 et au-dessus restent jouables par tout le monde — en ' +
      'entraînement. À 5, plus aucun format n’est réservé.' },

  /* -------------------------------------------------------------- deck */
  { cle: 'deck.fanzzy', section: 'deck', type: 'entier',
    titre: 'Fanzzy par deck', unite: 'personnages', min: 1, max: 8, defaut: 3 },

  { cle: 'deck.actions', section: 'deck', type: 'entier',
    titre: 'Cartes d’action par deck', unite: 'cartes', min: 1, max: 30, defaut: 10 },

  { cle: 'deck.main_visible', section: 'deck', type: 'entier',
    titre: 'Cartes en main', unite: 'cartes', min: 1, max: 10, defaut: 5,
    aide: 'Les autres arrivent en remplacement. Au-delà de six, l’écran de jeu ' +
      'ne les tient plus sur la largeur d’un téléphone.' },

  { cle: 'deck.stuff_par_fanzzy', section: 'deck', type: 'entier',
    titre: 'Pièces d’équipement par Fanzzy', unite: 'pièces', min: 0, max: 6, defaut: 2 },

  /* ------------------------------------------------------- progression */
  { cle: 'xp.pack', section: 'progression', type: 'entier',
    titre: 'Ouvrir un booster rapporte', unite: 'XP', min: 0, max: 500, defaut: 5 },

  /* Les missions de duel ne comptent qu'un duel qui a rapporté de l'XP (le
     joueur qui quitte n'en gagne pas) : à zéro, elles ne pourraient plus se
     faire, et le tirage les écarte. Les deux textes le disent, parce que
     l'effet est loin du réglage. */
  { cle: 'xp.duel_entrainement', section: 'progression', type: 'entier',
    titre: 'Un duel d’entraînement rapporte', unite: 'XP', min: 0, max: 500, defaut: 12,
    aide: 'À 0, les missions de duel qui comptent l’entraînement (jouer un ' +
      'duel, en gagner un, en gagner trois, en jouer cinq, jouer pour son club) ' +
      'sortent du tirage du lendemain : un duel ne compte pour une mission que ' +
      's’il a rapporté de l’XP.' },

  { cle: 'xp.duel_classe', section: 'progression', type: 'entier',
    titre: 'Un duel classé rapporte', unite: 'XP', min: 0, max: 500, defaut: 20,
    aide: 'À 0, la mission « Joue 2 duels classés » sort du tirage du lendemain.' },

  { cle: 'xp.victoire', section: 'progression', type: 'entier',
    titre: 'Gagner rapporte en plus', unite: 'XP', min: 0, max: 500, defaut: 15,
    aide: 'En plus du duel joué. La victoire ajoute, elle ne multiplie pas : ' +
      'perdre trois duels doit rester plus profitable que ne pas jouer.' },

  /* --------------------------------------------------------------- étal

     L'unité disait « billets », la monnaie que l'argent réel achetait et qui a
     disparu. L'étal se paie en écharpes depuis (`src/shared/etal.js`,
     `boutique/index.js`) : une étiquette qui nomme une autre monnaie que celle
     qu'on débite fait lire un prix faux à qui règle l'économie. */
  { cle: 'etal.stuff_commune', section: 'etal', type: 'entier',
    titre: 'Pièce d’équipement commune', unite: 'écharpes', min: 1, max: 9999, defaut: 45 },

  { cle: 'etal.stuff_rare', section: 'etal', type: 'entier',
    titre: 'Pièce rare', unite: 'écharpes', min: 1, max: 9999, defaut: 110 },

  { cle: 'etal.stuff_epique', section: 'etal', type: 'entier',
    titre: 'Pièce épique', unite: 'écharpes', min: 1, max: 9999, defaut: 260 },

  { cle: 'etal.stuff_legendaire', section: 'etal', type: 'entier',
    titre: 'Pièce légendaire', unite: 'écharpes', min: 1, max: 9999, defaut: 520,
    aide: 'Une pièce légendaire porte les modificateurs les plus francs : son prix ' +
      'est ce qui tient la distance entre un joueur qui paie et un joueur qui joue.' },

  { cle: 'etal.tenue', section: 'etal', type: 'entier',
    titre: 'Une tenue, sur un Fanzzy', unite: 'écharpes', min: 1, max: 9999, defaut: 130,
    aide: 'Le même prix quelle que soit la rareté : une tenue ne change rien au jeu, ' +
      'elle change ce qu’on regarde.' },

  /* ------------------------------------------------------- exploitation */
  { cle: 'annonce.actif', section: 'exploitation', type: 'booleen',
    titre: 'Afficher un bandeau d’annonce', defaut: false,
    aide: 'Le bandeau s’affiche en haut de toutes les pages, pour tout le monde.' },

  { cle: 'annonce.texte', section: 'exploitation', type: 'texte',
    titre: 'Texte de l’annonce', max: 240, defaut: '',
    aide: 'Une phrase. Pas de HTML : elle est posée en texte, jamais interprétée.' },

  { cle: 'annonce.ton', section: 'exploitation', type: 'choix',
    titre: 'Ton du bandeau', defaut: 'info',
    choix: [['info', 'Information'], ['attention', 'Attention'], ['fete', 'Fête']] },

  { cle: 'maintenance.actif', section: 'exploitation', type: 'booleen',
    titre: 'Fermer le jeu aux joueurs', defaut: false,
    aide: 'Les administrateurs gardent l’accès. Tout autre joueur reçoit un ' +
      'refus nommé plutôt qu’une page qui s’écroule.' },

  { cle: 'maintenance.texte', section: 'exploitation', type: 'texte',
    titre: 'Message de fermeture', max: 240,
    defaut: 'Le jeu est fermé quelques minutes, le temps d’une mise à jour.' },

  /* ========================================================== le quotidien

     Les valeurs de départ sont celles de `SERVEUR.md` (§ 8), raisonnées sur
     les barèmes réels du jeu : une mission paie à peu près ce qu'une heure de
     duels classés rapporte déjà, en plus de ce que la partie verse.

     **Des entiers et des bascules, rien d'autre.** L'écran d'administration
     dessine un type inconnu en champ numérique : une liste y serait
     inéditable, et les missions ont donc une bascule chacune plutôt qu'une
     liste à cocher. */

  /* --------------------------------------------- la carte de présence

     Ses trois montants valent **tout de suite**, à l'inverse de ceux des
     missions : le bonus se calcule au moment où on le récupère, il n'est pas
     copié au tirage. Le nombre de cases (sept) ne se règle pas, il est
     dessiné. */
  { cle: 'bonus.actif', section: 'quotidien', type: 'booleen',
    titre: 'Proposer le bonus de présence', defaut: true,
    aide: 'Éteint : plus de carte de présence, et une réclamation en cours est ' +
      'refusée. Rien n’est perdu : la case suivante attend qu’on rallume.' },

  { cle: 'bonus.base', section: 'quotidien', type: 'entier',
    titre: 'Première case de la carte', unite: 'écharpes', min: 0, max: 200, defaut: 20,
    aide: 'Un changement vaut tout de suite : le bonus se calcule au moment où ' +
      'on le récupère. Une carte entière vaut 245 écharpes et un booster aux ' +
      'valeurs de départ — un rituel d’entrée, pas une source de revenu.' },

  { cle: 'bonus.pas', section: 'quotidien', type: 'entier',
    titre: 'Chaque case suivante ajoute', unite: 'écharpes', min: 0, max: 50, defaut: 5,
    aide: 'Vaut tout de suite, comme la première case. De 20 à 50 écharpes de ' +
      'la première à la septième case, aux valeurs de départ.' },

  { cle: 'bonus.j7_packs', section: 'quotidien', type: 'entier',
    titre: 'La septième case ajoute', unite: 'boosters', min: 0, max: 3, defaut: 1,
    aide: 'Vaut tout de suite. Le booster entre dans la réserve même pleine : ' +
      'c’est un cadeau, pas une réserve plus grande.' },

  /* ---------------------------------------------------- les missions

     Leurs montants sont **copiés au tirage** : un changement vaut pour le
     lendemain. Le joueur reçoit ce qu'on lui a promis le matin. */
  { cle: 'missions.actif', section: 'quotidien', type: 'booleen',
    titre: 'Proposer les missions du jour', defaut: true,
    aide: 'Éteint : plus de tirage, et les réclamations de missions et de ' +
      'sachet sont refusées. Rallumé, une mission terminée reste récupérable ' +
      'jusqu’à la fin du lendemain.' },

  { cle: 'missions.relances', section: 'quotidien', type: 'entier',
    titre: 'Relances gratuites par jour', unite: 'relances', min: 0, max: 3, defaut: 1,
    aide: 'Remplacer une mission pas encore terminée. La mission de ' +
      'remplacement garde le gain de celle qu’elle remplace.' },

  { cle: 'missions.facile_echarpes', section: 'quotidien', type: 'entier',
    titre: 'Une mission facile rapporte', unite: 'écharpes', min: 0, max: 300, defaut: 30,
    aide: 'Environ cinq minutes de jeu. Un changement vaut pour le lendemain : ' +
      'les montants sont copiés au tirage du matin.' },

  { cle: 'missions.facile_xp', section: 'quotidien', type: 'entier',
    titre: 'Une mission facile rapporte aussi', unite: 'XP', min: 0, max: 200, defaut: 20,
    aide: 'Vaut pour le lendemain. Une mission vaut à peu près un duel en XP.' },

  { cle: 'missions.moyenne_echarpes', section: 'quotidien', type: 'entier',
    titre: 'Une mission moyenne rapporte', unite: 'écharpes', min: 0, max: 400, defaut: 60,
    aide: 'Environ douze minutes de jeu. Vaut pour le lendemain.' },

  { cle: 'missions.moyenne_xp', section: 'quotidien', type: 'entier',
    titre: 'Une mission moyenne rapporte aussi', unite: 'XP', min: 0, max: 300, defaut: 40,
    aide: 'Vaut pour le lendemain.' },

  { cle: 'missions.difficile_echarpes', section: 'quotidien', type: 'entier',
    titre: 'Une mission difficile rapporte', unite: 'écharpes', min: 0, max: 600, defaut: 100,
    aide: 'Environ vingt-cinq minutes de jeu. Vaut pour le lendemain.' },

  { cle: 'missions.difficile_xp', section: 'quotidien', type: 'entier',
    titre: 'Une mission difficile rapporte aussi', unite: 'XP', min: 0, max: 400, defaut: 60,
    aide: 'Vaut pour le lendemain. Les trois missions font 120 XP par jour aux ' +
      'valeurs de départ, autant que 24 boosters ouverts.' },

  { cle: 'missions.sachet_packs', section: 'quotidien', type: 'entier',
    titre: 'Le sachet des trois missions', unite: 'boosters', min: 0, max: 3, defaut: 1,
    aide: 'Versé quand toutes les missions du jour sont récupérées. Copié au ' +
      'tirage, comme les missions : un changement vaut pour le lendemain. Il ' +
      'entre dans la réserve même pleine.' },

  { cle: 'quotidien.retour_heures', section: 'quotidien', type: 'entier',
    titre: 'Une nouvelle visite commence après', unite: 'heures d’absence',
    min: 1, max: 48, defaut: 3,
    aide: 'Le ticket « depuis ta dernière visite » ne paraît qu’après cette ' +
      'absence. Plus court, il revient à chaque passage et on cesse de le lire.' },

  /* Le disjoncteur. Il est lu par le grand livre (`src/server/recompenses.js`)
     et par lui seul : au pire, une faute de réglage ou un défaut coûte une
     journée de gains, pas plus. Ce qui est bloqué reste dû le lendemain. */
  { cle: 'recompenses.plafond_echarpes_jour', section: 'quotidien', type: 'entier',
    titre: 'Disjoncteur : au plus, par joueur et par jour', unite: 'écharpes',
    min: 100, max: 20000, defaut: 2500,
    aide: 'Toutes les récompenses nouvelles additionnées (missions, sachet, ' +
      'bonus, carnet, relais, crans, séries). Un versement qui le dépasserait ' +
      'est refusé et reste dû le lendemain. Ce n’est pas un plafond de jeu : ' +
      'c’est ce qui borne le coût d’une erreur de réglage.' },

  { cle: 'recompenses.plafond_packs_jour', section: 'quotidien', type: 'entier',
    titre: 'Disjoncteur : au plus, par joueur et par jour', unite: 'boosters',
    min: 1, max: 50, defaut: 15,
    aide: 'Les boosters offerts par les récompenses nouvelles, additionnés. La ' +
      'recharge gratuite et l’abonnement n’y entrent pas.' },

  /* ------------------------------------------- les treize missions

     Une bascule par identifiant du catalogue (`src/shared/quotidien.js`), et
     son titre est l'intitulé de la mission : c'est ce qu'on cherche des yeux
     quand une mission pose problème un samedi soir. */
  { cle: 'mission.boosters', section: 'missions', type: 'booleen',
    titre: 'Ouvre 3 boosters', defaut: true,
    aide: 'Facile. Proposée tous les jours.' },
  { cle: 'mission.duel', section: 'missions', type: 'booleen',
    titre: 'Joue un duel jusqu’au bout', defaut: true,
    aide: 'Facile, entraînement compris. Un duel compte s’il a duré au moins ' +
      'une minute et que le joueur ne l’a pas quitté.' },
  { cle: 'mission.virage', section: 'missions', type: 'booleen',
    titre: 'Chante 10 fois au Grand Virage', defaut: true,
    aide: 'Facile. Proposée quand un match se joue encore aujourd’hui.' },
  { cle: 'mission.grandir', section: 'missions', type: 'booleen',
    titre: 'Fais grandir un Fanzzy', defaut: true,
    aide: 'Facile. Proposée à qui a un Fanzzy qui peut grandir et de quoi le payer.' },
  { cle: 'mission.tribune', section: 'missions', type: 'booleen',
    titre: 'Chante 40 fois au Grand Virage', defaut: true,
    aide: 'Moyenne. Proposée quand un match se joue encore aujourd’hui.' },
  { cle: 'mission.victoire', section: 'missions', type: 'booleen',
    titre: 'Gagne un duel', defaut: true,
    aide: 'Moyenne, entraînement compris.' },
  { cle: 'mission.classes', section: 'missions', type: 'booleen',
    titre: 'Joue 2 duels classés', defaut: true,
    aide: 'Moyenne. Proposée seulement s’il reste au joueur au moins deux duels ' +
      'classés gratuits aujourd’hui : aucune mission ne demande plus que le ' +
      'plafond gratuit.' },
  { cle: 'mission.club_virage', section: 'missions', type: 'booleen',
    titre: 'Chante 20 fois pour ton club', defaut: true,
    aide: 'Moyenne. Proposée quand un des clubs suivis joue aujourd’hui.' },
  { cle: 'mission.club_duel', section: 'missions', type: 'booleen',
    titre: 'Joue un duel pour ton club', defaut: true,
    aide: 'Moyenne. Proposée à qui suit au moins un club.' },
  { cle: 'mission.victoires', section: 'missions', type: 'booleen',
    titre: 'Gagne 3 duels', defaut: true,
    aide: 'Difficile, entraînement compris.' },
  { cle: 'mission.endurance', section: 'missions', type: 'booleen',
    titre: 'Joue 5 duels', defaut: true,
    aide: 'Difficile, entraînement compris.' },
  { cle: 'mission.mitemps', section: 'missions', type: 'booleen',
    titre: 'Chante 10 fois dans chaque mi-temps d’un même match', defaut: true,
    aide: 'Difficile. Proposée quand un match du jour n’a pas encore commencé ' +
      'sa seconde mi-temps.' },
  { cle: 'mission.ailleurs', section: 'missions', type: 'booleen',
    titre: 'Chante 10 fois dans deux compétitions différentes', defaut: true,
    aide: 'Difficile. Proposée quand deux compétitions jouent encore aujourd’hui.' },

  /* ------------------------------------------ le carnet et le relais

     Les tampons sont copiés au tirage avec les missions : un changement vaut
     pour le lendemain. Le relais se calcule au moment où on le récupère. */
  { cle: 'saison.carnet_actif', section: 'saison', type: 'booleen',
    titre: 'Carnet de tampons de la saison', defaut: true,
    aide: 'Éteint : plus de carnet à l’écran, et ses paliers comme le relais ' +
      'sont refusés à la réclamation. Un palier atteint reste dû : rallumé, ' +
      'il se récupère, même après la fin de la saison.' },

  { cle: 'saison.tampons_facile', section: 'saison', type: 'entier',
    titre: 'Une mission facile rapporte', unite: 'tampons', min: 0, max: 10, defaut: 1,
    aide: 'Copié au tirage : un changement vaut pour le lendemain.' },

  { cle: 'saison.tampons_moyenne', section: 'saison', type: 'entier',
    titre: 'Une mission moyenne rapporte', unite: 'tampons', min: 0, max: 10, defaut: 1,
    aide: 'Copié au tirage : un changement vaut pour le lendemain.' },

  { cle: 'saison.tampons_difficile', section: 'saison', type: 'entier',
    titre: 'Une mission difficile rapporte', unite: 'tampons', min: 0, max: 10, defaut: 2,
    aide: 'Copié au tirage : un changement vaut pour le lendemain.' },

  { cle: 'saison.tampons_sachet', section: 'saison', type: 'entier',
    titre: 'Le sachet rapporte', unite: 'tampons', min: 0, max: 10, defaut: 1,
    aide: 'Copié au tirage. Avec les valeurs de départ, une journée complète ' +
      'fait cinq tampons ; le carnet de la saison 1 est calibré là-dessus.' },

  { cle: 'saison.relais_packs', section: 'saison', type: 'entier',
    titre: 'Passage de relais : boosters offerts', unite: 'boosters', min: 0, max: 5, defaut: 2,
    aide: 'Au lancement d’une saison, « les sachets de la trêve », à qui a ' +
      'assez joué la précédente. C’est ce qui fait revenir les joueurs le jour ' +
      'où il se passe quelque chose.' },

  { cle: 'saison.relais_seuil', section: 'saison', type: 'entier',
    titre: 'Passage de relais : à qui a au moins', unite: 'tampons dans la saison précédente',
    min: 0, max: 1000, defaut: 10 },

  /* ------------------------------------------------ la collection

     Lus à la réclamation par le module fanzzy. Un cran est payé une fois, au
     seuil franchi le plus haut : changer la taille d'un cran ne repaie rien
     et ne reprend rien. */
  { cle: 'collection.actif', section: 'saison', type: 'booleen',
    titre: 'Paliers de collection', defaut: true,
    aide: 'Éteint : plus de crans ni de séries complètes à récupérer, et les ' +
      'réclamations sont refusées. Un cran atteint reste dû.' },

  { cle: 'collection.cran', section: 'saison', type: 'entier',
    titre: 'Un cran tous les', unite: 'objets', min: 5, max: 200, defaut: 25,
    aide: 'Tout ce qu’un booster peut donner : personnages, états, tenues, ' +
      'pièces et cartes d’action des séries ouvertes. Changer la taille ne ' +
      'repaie aucun cran déjà payé, et n’en reprend aucun.' },

  { cle: 'collection.cran_echarpes', section: 'saison', type: 'entier',
    titre: 'Chaque cran rapporte', unite: 'écharpes', min: 0, max: 300, defaut: 25 },

  { cle: 'collection.cran_booster_tous', section: 'saison', type: 'entier',
    titre: 'Un booster en plus tous les', unite: 'crans (0 = jamais)', min: 0, max: 20, defaut: 4,
    aide: 'Le booster s’ajoute au cran qui tombe sur ce rythme (100, 200, ' +
      '300 objets… aux valeurs de départ).' },

  { cle: 'collection.serie_echarpes', section: 'saison', type: 'entier',
    titre: 'Une série complète rapporte', unite: 'écharpes', min: 0, max: 1000, defaut: 100,
    aide: 'Tous les personnages d’une série ouverte.' },

  { cle: 'collection.serie_packs', section: 'saison', type: 'entier',
    titre: 'Une série complète rapporte aussi', unite: 'boosters', min: 0, max: 5, defaut: 1 },

  /* ------------------------------------------------ les divisions

     **Des seuils, et rien à payer.** La ferveur classée n'est plafonnée que
     pour le joueur gratuit : une division qui verserait des écharpes ou des
     boosters se gagnerait en partie en payant, et la règle « l'argent
     n'achète que du confort » tomberait. Les deux réglages de gains qui
     existaient au plan ont été retirés, et `reglages-smoke` refuse qu'une clé
     `rang.*` revienne avec une unité en écharpes ou en boosters.

     Les seuils ne sont pas contrôlés entre eux ici : `src/shared/saison.js`
     les rend monotones (chacun vaut au moins le précédent) avant de s'en
     servir. */
  { cle: 'rang.actif', section: 'saison', type: 'booleen',
    titre: 'Divisions de saison', defaut: true,
    aide: 'Éteint : plus d’insigne de division, et les réclamations sont refusées.' },

  { cle: 'rang.habitue', section: 'saison', type: 'entier',
    titre: 'Seuil d’Habitué', unite: 'ferveur classée de la saison',
    min: 0, max: 100000000, defaut: 5000,
    aide: 'Sympathisant dès la première ferveur, puis ces quatre seuils fixes, ' +
      'jamais des pourcentages : une division atteinte reste acquise. À viser ' +
      'sur les seuls joueurs sans abonnement : environ 70 % des actifs.' },

  { cle: 'rang.fervent', section: 'saison', type: 'entier',
    titre: 'Seuil de Fervent', unite: 'ferveur classée de la saison',
    min: 0, max: 100000000, defaut: 30000,
    aide: 'Environ 40 % des joueurs actifs sans abonnement.' },

  { cle: 'rang.ultra', section: 'saison', type: 'entier',
    titre: 'Seuil d’Ultra', unite: 'ferveur classée de la saison',
    min: 0, max: 100000000, defaut: 100000,
    aide: 'Environ 15 % des joueurs actifs sans abonnement.' },

  { cle: 'rang.capo', section: 'saison', type: 'entier',
    titre: 'Seuil de Capo', unite: 'ferveur classée de la saison',
    min: 0, max: 100000000, defaut: 300000,
    aide: 'Environ 4 % des joueurs actifs sans abonnement, et jamais plus que ce ' +
      'qu’un joueur gratuit assidu peut faire dans la saison (cinq duels ' +
      'classés et deux Virages comptés par jour) : le titre « Capo de la ' +
      'saison » doit rester atteignable sans payer. Relever un seuil en cours ' +
      'de saison ne retire rien à qui l’a déjà récupéré.' },
];

/** Le registre indexé par clé. */
export const PAR_CLE = new Map(REGLAGES.map((r) => [r.cle, r]));

/** Les valeurs par défaut, seule source de vérité des constantes du jeu. */
export const DEFAUTS = Object.fromEntries(REGLAGES.map((r) => [r.cle, r.defaut]));

/**
 * Une valeur refusée par le registre.
 *
 * Elle nomme la clé **et** ce qui n'allait pas. « Valeur invalide » oblige à
 * relire le registre pour comprendre ; « pack.regen_min : attendu un entier
 * entre 1 et 1440, reçu 0 » se corrige sans rien ouvrir.
 */
export class ReglageInvalide extends Error {
  constructor(cle, raison) {
    super(`${cle} : ${raison}`);
    this.code = 'admin.error.reglage_invalide';
    this.cle = cle;
    this.raison = raison;
  }
}

/**
 * Valide une valeur contre la déclaration de sa clé, et la rend normalisée.
 *
 * Elle **lève** plutôt que de corriger en silence. Une valeur hors bornes
 * ramenée discrètement dans les clous donnerait un écran qui affiche autre
 * chose que ce qu'on vient d'y taper — et personne ne saurait laquelle des
 * deux valeurs le jeu utilise.
 */
export function valider(cle, brut) {
  const r = PAR_CLE.get(cle);
  if (!r) throw new ReglageInvalide(cle, 'cette clé n’est pas au registre');

  if (r.type === 'booleen') {
    if (typeof brut !== 'boolean') throw new ReglageInvalide(cle, 'attendu vrai ou faux');
    return brut;
  }

  if (r.type === 'texte') {
    if (typeof brut !== 'string') throw new ReglageInvalide(cle, 'attendu du texte');
    const t = brut.trim();
    if (t.length > (r.max ?? 240)) {
      throw new ReglageInvalide(cle, `${t.length} caractères, ${r.max ?? 240} au plus`);
    }
    return t;
  }

  if (r.type === 'choix') {
    const permis = r.choix.map(([v]) => v);
    if (!permis.includes(brut)) {
      throw new ReglageInvalide(cle, `attendu l’un de ${permis.join(', ')}`);
    }
    return brut;
  }

  if (r.type === 'liste') {
    if (!Array.isArray(brut) || brut.some((x) => typeof x !== 'string')) {
      throw new ReglageInvalide(cle, 'attendu une liste de textes');
    }
    return brut;
  }

  // entier et decimal
  const n = Number(brut);
  if (!Number.isFinite(n)) throw new ReglageInvalide(cle, 'attendu un nombre');
  if (r.type === 'entier' && !Number.isInteger(n)) {
    throw new ReglageInvalide(cle, 'attendu un nombre entier');
  }
  if (n < r.min || n > r.max) {
    throw new ReglageInvalide(cle, `attendu entre ${r.min} et ${r.max}, reçu ${n}`);
  }
  return n;
}

/**
 * Résout la valeur d'une clé à partir de ce que la base contient.
 *
 * Une valeur stockée qui ne passe plus la validation — parce que les bornes
 * ont changé depuis, parce qu'une main est passée dans la base — **retombe sur
 * la valeur par défaut** au lieu de faire tomber le serveur. C'est le seul
 * endroit où l'on corrige en silence, et pour une raison précise : refuser de
 * démarrer parce qu'un réglage cosmétique est hors bornes serait une panne
 * fabriquée par le garde-fou lui-même.
 */
export function resoudre(cle, stocke) {
  const r = PAR_CLE.get(cle);
  if (!r) return undefined;
  if (stocke === undefined || stocke === null) return r.defaut;
  try { return valider(cle, stocke); } catch { return r.defaut; }
}

/** Toutes les valeurs effectives, défauts compris. */
export function toutes(stockes = {}) {
  return Object.fromEntries(REGLAGES.map((r) => [r.cle, resoudre(r.cle, stockes[r.cle])]));
}

/* ------------------------------------------------------- les valeurs vivantes

   Les constantes du jeu lisent ici, par `reglage(...)`. Le porteur est dans le
   registre et non dans un module serveur, parce que `src/shared/` est lu par
   des modules qui ne connaissent pas le serveur : `duel/actions.js` et
   `niveau.js` décrivent des règles de jeu, ils n'ont pas à savoir qu'il existe
   une base de données.

   Le serveur remplit ce porteur au démarrage et après chaque écriture
   (`src/server/reglages/`). Tant qu'il ne l'a pas fait — au chargement des
   modules, ou dans un script qui n'ouvre aucune base — ce sont les valeurs du
   registre qui répondent. Jamais `undefined` : un `undefined` propagé dans un
   calcul de corde donne `NaN`, et un `NaN` ne fait rien tomber, il rend
   simplement le jeu injouable sans le dire. */

let vivantes = { ...DEFAUTS };

/** La valeur effective d'un réglage, à l'instant où on la lit. */
export function reglage(cle) {
  return vivantes[cle];
}

/** Remplace les valeurs vivantes. Appelé par le serveur, et par lui seul. */
export function poserReglages(valeurs) {
  vivantes = { ...DEFAUTS, ...valeurs };
  return vivantes;
}

/** Les valeurs vivantes, pour qui veut toutes les lire d'un coup. */
export function reglagesVivants() {
  return { ...vivantes };
}
