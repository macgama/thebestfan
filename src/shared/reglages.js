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
  { id: 'etal', titre: 'L’ÉTAL EN BILLETS',
    aide: 'Ce que coûtent les objets achetés en billets. Les prix en euros, eux, ' +
      'vivent dans le catalogue de la boutique et ne se règlent pas ici : un prix ' +
      'qu’un écran peut changer d’un doigt est un prix qui finira changé par erreur.' },
  { id: 'exploitation', titre: 'L’EXPLOITATION',
    aide: 'Ce qui s’adresse aux joueurs depuis l’administration.' },
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

  { cle: 'duel.chant_cout', section: 'duel', type: 'entier',
    titre: 'Un chant coûte', unite: 'souffle', min: 0, max: 100, defaut: 18 },

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

  { cle: 'xp.duel_entrainement', section: 'progression', type: 'entier',
    titre: 'Un duel d’entraînement rapporte', unite: 'XP', min: 0, max: 500, defaut: 12 },

  { cle: 'xp.duel_classe', section: 'progression', type: 'entier',
    titre: 'Un duel classé rapporte', unite: 'XP', min: 0, max: 500, defaut: 20 },

  { cle: 'xp.victoire', section: 'progression', type: 'entier',
    titre: 'Gagner rapporte en plus', unite: 'XP', min: 0, max: 500, defaut: 15,
    aide: 'En plus du duel joué. La victoire ajoute, elle ne multiplie pas : ' +
      'perdre trois duels doit rester plus profitable que ne pas jouer.' },

  /* --------------------------------------------------------------- étal */
  { cle: 'billets.stuff_commune', section: 'etal', type: 'entier',
    titre: 'Pièce d’équipement commune', unite: 'billets', min: 1, max: 9999, defaut: 45 },

  { cle: 'billets.stuff_rare', section: 'etal', type: 'entier',
    titre: 'Pièce rare', unite: 'billets', min: 1, max: 9999, defaut: 110 },

  { cle: 'billets.stuff_epique', section: 'etal', type: 'entier',
    titre: 'Pièce épique', unite: 'billets', min: 1, max: 9999, defaut: 260 },

  { cle: 'billets.stuff_legendaire', section: 'etal', type: 'entier',
    titre: 'Pièce légendaire', unite: 'billets', min: 1, max: 9999, defaut: 520,
    aide: 'Une pièce légendaire porte les modificateurs les plus francs : son prix ' +
      'est ce qui tient la distance entre un joueur qui paie et un joueur qui joue.' },

  { cle: 'billets.tenue', section: 'etal', type: 'entier',
    titre: 'Une tenue, sur un Fanzzy', unite: 'billets', min: 1, max: 9999, defaut: 130,
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
