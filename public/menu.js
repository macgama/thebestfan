/**
 * Le menu accordéon — et la seule liste des destinations du jeu.
 *
 * ## Pourquoi ce fichier existe
 *
 * Il y avait deux menus. `nav.js` en montait un sur les dix-huit pages de
 * contenu : onze destinations rangées en trois rubriques, avec l'accueil en
 * tête. L'accueil, lui, ne charge pas `nav.js` — il porte sa navigation dans
 * ses deux rails — et s'était donc écrit **le sien**, à la main, dans son
 * HTML : cinq lignes à plat, sans rubriques, sans le Virage, sans le duel,
 * sans la boutique, sans les boosters, sans le carnet, sans les amis.
 *
 * Un joueur qui ouvrait le menu depuis l'accueil et le rouvrait depuis le
 * classeur voyait deux jeux différents. C'est la faute que ce projet a déjà
 * corrigée quatre fois ailleurs, sous le même nom : **une règle écrite à deux
 * endroits finit par ne plus dire la même chose**. Ici elle avait déjà
 * divergé de six entrées, et l'accueil confirmait la déconnexion pendant que
 * les autres pages déconnectaient sans demander.
 *
 * La liste, les icônes, la construction du tiroir, la confirmation de sortie,
 * l'entrée d'administration et les états des destinations (le direct, le duel
 * qui attend, les boosters à ouvrir, les missions à récupérer) vivent donc
 * ici, et nulle part ailleurs.
 * `nav.js` l'appelle pour les pages de contenu ; l'accueil l'appelle pour
 * lui-même. Le jour où une entrée change, elle change une fois.
 *
 * Quatre réglages y vivent aussi, pour la même raison — le tiroir est le seul
 * endroit présent sur toutes les pages d'un joueur connecté : **le mode
 * calme** (sons, vibrations, animations décoratives), **le volume** des sons,
 * **l'installation** de l'application sur l'appareil et, quand le serveur
 * sert la présence, **apparaître hors ligne** pour ses amis (lot 6).
 *
 * ## Ce que ce fichier ne fait pas
 *
 * Il ne pose pas de barre du haut, pas de décor, pas de bouton. Il reçoit le
 * bouton que la page a déjà dessiné — chaque page a le sien, et celui de
 * l'accueil est une plaque qui suit la hauteur de sa rangée. Ce fichier
 * branche l'ouverture, remplit le tiroir et gère la sortie ; sur le bouton,
 * il ne pose que l'état le plus urgent (`data-urgence`).
 *
 * L'apparence vit dans `ui.css` (`.tbf-tiroir`, `.tbf-tiroir-tete`,
 * `.tbf-rubrique`, `.tbf-tiroir-grille`, `.tbf-case`, `.tbf-tiroir-pied`,
 * `.tbf-voile`).
 * Seuls les interrupteurs, le curseur du volume, l'entrée d'installation, la
 * place de la ligne « apparaître hors ligne », et la place et le sticker de
 * la bâche des MISSIONS dans la tête, qui n'existent qu'ici, ont leur feuille
 * à eux, posée par ce fichier — voir `CSS_REGLAGES`.
 */
(() => {
  const chemin = location.pathname.replace(/\/$/, '') || '/';

  /* ------------------------------------------------------ le mode calme

     Clé « tbf-calme » : des jetons séparés par des espaces, parmi « sons »,
     « vibrations », « animations ». Recopiée à chaque chargement sur la
     racine du document, où les feuilles de style la lisent
     (html[data-calme~="animations"]) et où `FX.calme()` la consulte.

     **fx.js fait exactement la même recopie**, et c'est voulu : /bienvenue
     charge fx.js sans ce fichier, et là où les deux sont chargés, l'ordre
     change d'une page à l'autre — fx.js est différé partout, et ce
     fichier, lu sans attendre sur l'accueil, l'administration et la
     boutique, y passe avant lui. Les deux copies écrivent la même valeur
     au même endroit ; la seconde qui passe ne change rien. Qui modifie
     l'une modifie l'autre — normalisation et reprise de l'ancienne clé du
     son comprises.

     Pendant la visite, c'est l'attribut qui fait foi : un stockage fermé
     (navigation privée) laisse le réglage valoir au moins pour la page. */
  const FACETTES = ['sons', 'vibrations', 'animations'];
  const normaliser = (brut) => {
    const jetons = String(brut ?? '').split(/\s+/);
    return FACETTES.filter((f) => jetons.includes(f)).join(' ');
  };
  const poserCalme = (v) => {
    if (v) document.documentElement.dataset.calme = v;
    else delete document.documentElement.dataset.calme;
  };
  function lireCalme() {
    let brut = '';
    try {
      brut = localStorage.getItem('tbf-calme') ?? '';
      // L'ancienne clé du bouton de son du duel : voir fx.js.
      const ancien = localStorage.getItem('tbf-son');
      if (ancien !== null) {
        if (ancien === 'coupe') brut += ' sons';
        brut = normaliser(brut);
        localStorage.setItem('tbf-calme', brut);
        localStorage.removeItem('tbf-son');
      }
    } catch { /* pas de stockage : rien de calmé, comme avant */ }
    return normaliser(brut);
  }
  const calme = (facette) =>
    (document.documentElement.dataset.calme ?? '').split(' ').includes(facette);
  function reglerCalme(facette, oui) {
    const jetons = new Set((document.documentElement.dataset.calme ?? '').split(' '));
    if (oui) jetons.add(facette); else jetons.delete(facette);
    const v = normaliser([...jetons].join(' '));
    try { localStorage.setItem('tbf-calme', v); } catch { /* vaut pour la page */ }
    poserCalme(v);
    window.dispatchEvent(new CustomEvent('tbf-calme', { detail: v }));
  }
  poserCalme(lireCalme());
  window.addEventListener('storage', (e) => {
    if (e.key === 'tbf-calme' || e.key === null) poserCalme(lireCalme());
  });

  /**
   * Le nom de l'écran, tel qu'il s'affiche dans la barre du haut.
   *
   * Court, et différent du libellé du menu : « Mes Fanzzy » dit où l'on **va**,
   * « Fanzzy » dit où l'on **est**. Le second se lit d'un coup d'œil, ce qui
   * est tout ce qu'on demande à un titre de barre.
   *
   * Une route absente de cette table n'affiche pas de titre plutôt qu'un titre
   * deviné : « /duel-nvn » rendu en « Duel Nvn » est pire que rien.
   */
  const TITRES = {
    '/fanzzy': 'Fanzzy', '/boosters': 'Boosters', '/deck': 'Deck',
    '/boutique': 'Boutique', '/virage': 'Virage', '/duel-nvn': 'Duel',
    '/kop': 'KOP', '/amis': 'Amis', '/equipes': 'Clubs', '/matchs': 'Matchs',
    '/teletext': 'Compétitions', '/classement': 'Classement', '/carnet': 'Carnet',
    /* `/aide` est devenu l'écran des MISSIONS (lot 5) : on y vient chercher
       ce qui se gagne aujourd'hui, et il garde les premiers pas et les
       questions dans ses rails. L'adresse ne change pas — des liens partagés
       et le tunnel d'arrivée y mènent —, seul son nom change. */
    '/profil': 'Profil', '/compte': 'Compte', '/aide': 'Missions',
    '/repetition': 'Répétition', '/admin': 'Administration',
    '/diagnostic': 'Diagnostic',
    /* Ces deux-là manquaient, et le manque se voyait : `nav.js` lit cette table
       pour écrire le titre de la barre, et une route absente n'affiche **rien**.
       La collection et l'abonnement s'ouvraient donc sur une barre muette,
       alors que les vingt autres écrans se nomment. */
    '/collection': 'Collection', '/abonnement': 'Abonnement',
  };

  const ICONES = {
    virage: 'M3 20l9-16 9 16zM7 20l5-9 5 9',
    duel: 'M4 4l7 7M20 4l-7 7M12 13v7M8 20h8',
    fanzzy: 'M4 4h13l3 3v13H4zM8 8h6M8 12h8M8 16h5',
    carnet: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18h14M9 8h6',
    /* Une grille de quatre cases : ce qu'on voit en ouvrant un classeur de
       collection, et ce qu'aucune autre icône du menu ne dit. Elle empruntait
       celle du carnet, juste au-dessus d'elle dans la même rubrique — deux
       lignes voisines avec le même dessin ne se distinguent plus. */
    collection: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    classement: 'M6 21V9M12 21V4M18 21v-7M3 21h18',
    accueil: 'M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    deck: 'M4 7h10v13H4zM8 4h10v13',
    profil: 'M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM5 20a7 7 0 0 1 14 0',
    clubs: 'M12 3l7 3v5c0 4.4-2.9 8.2-7 10-4.1-1.8-7-5.6-7-10V6z',
    // Trois silhouettes serrées : un groupe, pas une personne.
    kop: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a7 7 0 0 1 14 0M17 20a5 5 0 0 0-3-4.6M16 11a3 3 0 0 0 0-6',
    // Deux silhouettes côte à côte, et un plus : on en ajoute une.
    amis: 'M9 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4M2 20a7 7 0 0 1 14 0M18 8v6M15 11h6',
    teletext: 'M3 4h18v16H3zM7 9h10M7 13h6',
    /* Les matchs du jour : une grille d'horaires, la même que sur la tuile
       MATCHS du hub. Ils empruntaient l'écran du télétexte, et depuis que le
       tiroir est une grille de tuiles (lot 2), les deux se tenaient côte à
       côte sur la même rangée avec le même dessin : deux portes qu'on ne
       distingue qu'en lisant. */
    matchs: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 9h18M8 9v10',
    /* L'abonnement : une carte d'abonné, sa bande et son nom. Il prenait le
       panier de la boutique, sa voisine de rubrique — même raison. */
    abonnement: 'M3 6h18v12H3zM3 10h18M7 14h5',
    compte: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 3v3M12 18v3M3 12h3M18 12h3',
    admin: 'M12 3l7 3v5c0 4.4-2.9 8.2-7 10-4.1-1.8-7-5.6-7-10V6zM9 12l2 2 4-4',
    sortie: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h9',
    // Une croix : ce qui referme le tiroir (lot 2), là où était le menu.
    fermer: 'M6 6l12 12M18 6L6 18',
    // Un panier : deux roues et une anse. Reconnaissable à vingt pixels.
    boutique: 'M6 6h15l-1.5 9h-12zM6 6L5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
    // Un paquet fermé, avec sa bande à déchirer en haut.
    pack: 'M4 8h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 8l1.5-4h13L20 8M9 4v4M15 4v4',
    // Une flèche vers la gauche, pour rentrer. Volontairement pas un chevron
    // seul : à quarante pixels, un chevron se confond avec un bouton de repli.
    retour: 'M15 5l-7 7 7 7',
    /* Une case cochée, celle de la maquette (écran 2, « le tiroir ») : les
       MISSIONS sont une liste de choses à faire, qu'on coche. Elles
       remplacent l'entrée de l'aide, et son point d'interrogation avec elle —
       il promettait une page d'explications, et l'on y trouve d'abord ce qui
       se gagne aujourd'hui. */
    missions: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
    // Un métronome : le socle, la tige, le poids. Le seul objet du jeu qui ne
    // serve qu'à s'exercer — et il dit le rythme, qui est ce que la moitié des
    // gestes demandent.
    repetition: 'M9 21h6l-1.2-15h-3.6zM7 21h10M12 6v9M10.4 12h3.2',
    /* Les trois facettes du mode calme. Chacune dessine ce qu'elle coupe —
       un haut-parleur, un téléphone qui tremble, une étincelle —, pas un
       interdit : l'interrupteur dit déjà si c'est coupé. */
    sons: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
    vibrations: 'M8.5 3.5h7v17h-7zM11 17.5h2M5 9v6M19 9v6M2.5 10.5v3M21.5 10.5v3',
    animations: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
    // Une flèche qui descend dans l'appareil : ce qu'on télécharge chez soi.
    installer: 'M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5M5 20h14',
    /* La présence (lot 6) : une silhouette et, à son pied, le rond d'« en
       ligne ». Comme les facettes du calme, l'icône dessine ce que
       l'interrupteur coupe — être vu de ses amis —, pas un interdit. */
    presence: 'M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M3.5 20a6.5 6.5 0 0 1 11.2-4.5M18.5 20.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  };

  /**
   * Les destinations, en rubriques.
   *
   * Onze destinations à plat, c'est un mur. Rangées par ce qu'on vient y
   * faire — jouer, collectionner, suivre le football — on retrouve la sienne
   * sans lire les autres. L'ordre à l'intérieur d'une rubrique est celui de
   * la fréquence, pas de l'alphabet.
   */
  /* `ton` : la couleur de la rubrique, et de chacune de ses tuiles (lot 2).
     Chaque ton ne dit qu'une chose dans tout le jeu — rouge on joue, bleu on
     possède, vert on regarde, violet les gens, or on achète —, et le tiroir
     le redit au lieu d'en inventer un sixième. La table des tons de `ui.css`
     ne s'applique qu'à l'élément qui porte l'attribut : il est donc posé sur
     le titre **et** sur chaque tuile, la rubrique ne le transmet pas.

     **Une destination peut porter le sien**, en quatrième case. Le ton de la
     rubrique dit pourquoi on vient ; celui d'une destination dit ce qu'on y
     trouve, et c'est lui que le hub montre. Peintes au ton de leur rubrique,
     les mêmes portes changeaient de couleur entre le hub et le tiroir : le
     KOP et les amis, violets sur le hub (« le violet reste les gens »,
     amendement 4), passaient au rouge et au bleu ; les boosters et la
     boutique, or sur le hub (« l'or : acheter », amendements 3 et 18),
     passaient au rouge. Le code couleur ne tenait plus d'un écran à
     l'autre. Le deck suit la même règle : bleu, parce qu'on le possède
     (amendement 18), même rangé parmi ce qu'on joue. La rubrique garde son
     écharpe, son ordre et ses autres tuiles.

     **Des rangées pleines : six, six et quatre** (reliquat du lot 2). Le
     tiroir faisait deux écrans de haut à 360 px — 1 284 px pour 640 —, et
     la grille en prenait l'essentiel : huit, quatre et quatre tuiles, soit
     sept rangées de trois, dont trois incomplètes. Seize tuiles en
     demandent six au moins ; avec huit, quatre et quatre, il en fallait
     sept, et huit à 320 px, où la grille passe à deux colonnes. Six, six et
     quatre en font six à trois colonnes et huit à deux : la rangée gagnée à
     360 ne se reperd pas à 320, ce que neuf, trois et quatre aurait fait.

     Quatre portes ont donc changé de rubrique, et chacune y gagne un sens :
     les amis rejoignent le KOP (« les gens », violets tous les deux : ce
     qu'on fait à plusieurs), et les trois portes or — les boosters, la
     boutique, l'abonnement — passent sous MA COLLECTION, en une rangée or
     sous la rangée bleue : ce qu'on possède, puis de quoi le remplir. La
     maquette range déjà les boosters là (écran 2, « le tiroir »), et le
     kiosque est rattaché au classeur (`parentDe`, dans nav.js). */
  const MENU = [
    { titre: 'JOUER', ton: 'flare', liens: [
      ['/virage', 'virage', 'Le Grand Virage'],
      ['/duel-nvn', 'duel', 'Duel de tribunes'],
      // Le KOP est au centre du jeu : il ouvre la rubrique de ce qu'on fait à
      // plusieurs, et il n'est plus derrière un second menu.
      ['/kop', 'kop', 'Mon KOP', 'violet'],
      // Juste après le KOP : les deux portes violettes, celles des gens.
      ['/amis', 'amis', 'Mes amis', 'violet'],
      ['/deck', 'deck', 'Mon deck', 'bleu'],
      /* Dernière de JOUER, et bien dans JOUER : on y va pour jouer, pas parce
         qu'on est perdu. Après les deux écrans qu'elle prépare et jamais avant
         eux — ce n'est pas une étape à franchir pour entrer au Virage, c'est
         un endroit où revenir quand un geste résiste. */
      ['/repetition', 'repetition', 'La répétition'],
    ] },
    { titre: 'MA COLLECTION', ton: 'bleu', liens: [
      /* **Elle n'était dans aucun menu.** L'en-tête de ce fichier promet « la
         seule liste des destinations du jeu », et `menu-smoke.mjs` le redit :
         « ce qui n'y est pas n'existe pas ». La collection n'y était pas. On
         ne pouvait l'atteindre que par une carte de l'accueil — donc jamais
         depuis les vingt-trois autres écrans, et jamais du tout pour qui ne
         l'avait pas remarquée là.

         En tête de la rubrique parce qu'elle la résume : elle compte tout ce
         qui se gagne, Fanzzy compris, quand les autres entrées n'en montrent
         chacune qu'une part. */
      ['/collection', 'collection', 'Ma collection'],
      ['/fanzzy', 'fanzzy', 'Mes Fanzzy'],
      ['/carnet', 'carnet', 'Mon carnet'],
      // La rangée or : de quoi remplir ce qui précède (voir plus haut).
      ['/boosters', 'pack', 'Mes boosters', 'or'],
      ['/boutique', 'boutique', 'La boutique', 'or'],
      /* Juste après la boutique, et pas ailleurs : c'est le même geste — on
         vient dépenser. Il manquait, et la seule façon d'atteindre l'écran de
         l'abonnement était de connaître son adresse. */
      ['/abonnement', 'abonnement', 'L’abonnement', 'or'],
    ] },
    { titre: 'LE FOOTBALL', ton: 'vert', liens: [
      ['/matchs', 'matchs', 'Les matchs du jour'],
      ['/equipes', 'clubs', 'Mes clubs'],
      ['/teletext', 'teletext', 'Toutes les compétitions'],
      ['/classement', 'classement', 'Classement des supporters'],
    ] },
  ];

  const item = (href, cle, texte, classe = '') =>
    `<a href="${href}" class="${classe}"><svg viewBox="0 0 24 24"><path d="${ICONES[cle]}"/></svg>${texte}</a>`;

  /* **La tuile du tiroir** (lot 2) : une bâche de la grille, la même que
     celles du hub, au ton de sa rubrique — ou au sien, quand la destination
     en porte un (voir `MENU`) : le même que sur le hub. Le libellé est dans
     `.lib` et nulle part ailleurs : la tuile est une grille, et un texte nu
     y deviendrait un élément anonyme que la feuille ne sait pas placer. Il a
     le droit de passer sur deux lignes (« DUEL DE TRIBUNES ») ; une
     troisième serait coupée, c'est au libellé d'être court.

     Le texte du lien reste le libellé, mot pour mot : `menu-smoke` compare
     les libellés du tiroir d'une page à l'autre, et l'état d'une tuile —
     LIVE, « 4 », « 2 » — n'en fait pas partie, puisque c'est la feuille qui
     l'écrit (`::after`, à partir de `data-etat` et `data-pastille`). */
  const tuile = (href, cle, texte, ton, ici) =>
    `<a class="tbf-case${ici ? ' on' : ''}" data-ton="${ton}" href="${href}"`
    + `${ici ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path`
    + ` d="${ICONES[cle]}"/></svg><span class="lib">${texte}</span></a>`;

  /* Les trois facettes du mode calme, dans l'ordre du tiroir. Le libellé dit
     ce que fait l'interrupteur quand on l'allume : il **coupe**. Un
     interrupteur « Sons » allumé laisserait deviner s'il veut dire « sons
     actifs » ou « mode calme actif » ; celui-ci ne laisse rien à deviner.

     Et il ne promet que ce qu'il tient. La troisième facette coupe le décor
     qui bouge — respiration, rayons, particules, secousses, vols — mais
     laisse les barres de temps, qui sont des informations ; un solde qui
     change se pose sur sa nouvelle valeur au lieu de défiler, il ne
     disparaît pas. « Couper les animations » tout court ferait croire à une
     panne au premier compte à rebours qui file encore.

     **Le nom entier est celui de l'interrupteur, le mot seul est à l'œil**
     (reliquat du lot 2). Les trois lignes empilées prenaient cent
     trente-deux pixels du pied ; elles sont devenues la rangée de trois
     interrupteurs de la maquette (écran 2, « le tiroir »), sous MODE
     CALME : l'icône et la piste, et dessous le mot seul — SONS,
     VIBRATIONS, ANIMATIONS —, que le titre de la rubrique éclaire. La
     phrase ci-dessus reste le nom que lit un lecteur d'écran
     (`aria-label`), et elle contient le mot affiché : celui qui dit
     « animations » à sa commande vocale touche le bon. */
  const REGLAGES = [
    ['sons', 'Couper les sons', 'Sons'],
    ['vibrations', 'Couper les vibrations', 'Vibrations'],
    ['animations', 'Couper les animations décoratives', 'Animations'],
  ];

  const interrupteur = ([facette, nom, mot]) =>
    `<button type="button" class="tbf-tiroir-bt" role="switch" aria-checked="false"
      aria-label="${nom}" data-facette="${facette}"><svg viewBox="0 0 24 24" aria-hidden="true"><path
      d="${ICONES[facette]}"/></svg><span class="tbf-inter" aria-hidden="true"></span><span
      class="lib">${mot}</span></button>`;

  /* ------------------------------------------- la feuille des réglages

     Ce qui manque à ui.css pour ce que seul le tiroir porte, et seulement
     ça : la ligne-bouton reprend exactement la ligne-lien (.tbf-tiroir a),
     qu'un sélecteur de lien ne peut pas atteindre ; l'interrupteur, le
     curseur du volume, la place et le sticker de la bâche des MISSIONS
     n'existent nulle part ailleurs. Posée une fois, par le premier tiroir
     monté.

     Quarante-quatre pixels de haut : la pulpe d'un doigt, et le plancher du
     socle pour toute cible. Les liens du tiroir en font autant (ui.css), et
     la ligne-bouton ne descend pas sous eux : un interrupteur manqué, lui,
     change un réglage sans qu'on l'ait voulu.

     Pas d'accent grave dans ce texte : il vit dans un gabarit de chaîne. */
  const CSS_REGLAGES = `
  .tbf-tiroir-bt{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;
    padding:10px 12px;border:0;border-radius:10px;background:none;color:inherit;
    font:inherit;font-size:14px;line-height:1.25;text-align:left;cursor:pointer}
  .tbf-tiroir-bt:hover,.tbf-tiroir-bt:focus-visible{background:rgba(242,238,228,.08)}
  .tbf-tiroir-bt svg{width:17px;height:17px;flex:none;stroke:currentColor;fill:none;
    stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.7}
  /* L'interrupteur : une piste et un palet. Allumé, il prend le vert de ce
     qui est acquis dans le jeu, et le palet passe à droite — deux signes au
     lieu d'un, pour qui ne distingue pas les couleurs.

     **Le vert foncé, sur le kraft éclairci** (arbitrage du 2 octobre 2026).
     L'interrupteur ne vit plus que sur le ticket du pied, et le papier y est
     passé à #E4D3B5 : le vert vif n'y tenait plus que 2,3:1, sous les 3:1
     qu'on doit à un composant ; le vert foncé en tient 5,3, et c'est l'encre
     des tampons pleins posés sur le même papier. La piste éteinte, presque
     noire, en tient 8,8. */
  .tbf-inter{position:relative;flex:none;margin-left:auto;width:36px;height:22px;
    border-radius:11px;background:#2A323D;box-shadow:inset 0 0 0 1px rgba(242,238,228,.3);
    transition:background .15s ease}
  .tbf-inter::after{content:"";position:absolute;top:4px;left:4px;width:14px;height:14px;
    border-radius:50%;background:var(--craie);transition:transform .15s ease}
  .tbf-tiroir-bt[aria-checked="true"] .tbf-inter{background:var(--vert-fonce);box-shadow:none}
  .tbf-tiroir-bt[aria-checked="true"] .tbf-inter::after{transform:translateX(14px)}
  /* **La rangée du mode calme** (reliquat du lot 2) : trois cases côte à côte
     au lieu de trois lignes empilées, l'icône et la piste en haut, le mot
     dessous — les « interrupteurs en rangée » de la maquette. Chaque case
     prend le tiers du ticket, quatre-vingt-seize pixels à 360 et
     quatre-vingt-trois à 320, quand « ANIMATIONS », le plus long, en demande
     soixante et onze en Oswald ; elle garde ses quarante-quatre pixels de
     haut au moins, et en fait cinquante-cinq. Sur un téléphone qui ne vibre
     pas, deux cases se partagent la rangée. Trois classes, pour passer
     devant la ligne-bouton du pied, que ui.css écrit à deux.

     **Sous 350 px, le mot se serre** : douze pixels, sans espacement. Une
     police de repli aussi large qu'Arial — Roboto sur Android, tant
     qu'Oswald n'est pas arrivée — écrit « ANIMATIONS » sur quatre-vingt-huit
     pixels en treize, et déborderait de sa case de quatre-vingt-trois ; en
     douze et serré, sur soixante-quinze : il tient. Un mot ne se coupe pas. */
  .tbf-calme{display:flex;gap:6px}
  .tbf-tiroir .tbf-calme .tbf-tiroir-bt{flex:1 1 0;width:auto;min-width:0;flex-wrap:wrap;
    justify-content:center;align-content:center;gap:4px 6px;padding:6px 2px 7px;text-align:center}
  .tbf-calme .tbf-inter{margin-left:0}
  .tbf-calme .lib{flex:0 0 100%}
  @media (max-width:349px){.tbf-calme .lib{font-size:12px;letter-spacing:0}}
  @media (prefers-reduced-motion:reduce){.tbf-inter,.tbf-inter::after{transition:none}}
  html[data-calme~="animations"] .tbf-inter,
  html[data-calme~="animations"] .tbf-inter::after{transition:none}
  /* **Le volume** (chantier du son, 2 octobre 2026) : sur sa ligne, juste
     sous les trois interrupteurs du calme, et hors de leur groupe — ce n'est
     pas un interrupteur, et la rubrique n'en compte que trois. Le mot a la
     taille et la graisse de ceux des interrupteurs, et le noir du kraft qu'il
     hérite du ticket : cette feuille ne lui donne aucune couleur.

     Le curseur est dessiné ici, et pas laissé au navigateur : sa piste grise
     ne se voit pas sur le kraft. Une piste de huit pixels cernée d'encre,
     remplie d'encre jusqu'au niveau (--v, que menu.js tient à jour), et un
     palet craie cerné d'encre, celui des interrupteurs : c'est l'encre qui
     porte les 3:1 d'un composant, sur le papier comme autour du palet.
     Quarante-quatre pixels de haut : le doigt l'attrape sans viser la piste.

     Quand les sons sont calmés, il s'éteint à 45 % et ne se touche plus ; le
     mot reste plein. Un réglage inactif n'a pas de contraste à tenir, un mot
     qu'on lit, si. */
  .tbf-volume{display:flex;align-items:center;gap:12px;min-height:44px;margin:4px 0 0;
    font-family:var(--banner);font-weight:600;font-size:13px;line-height:1.2;
    letter-spacing:.05em;text-transform:uppercase;cursor:pointer}
  .tbf-volume input{--v:100%;flex:1 1 auto;min-width:0;height:44px;margin:0;padding:0;
    background:none;-webkit-appearance:none;appearance:none;cursor:pointer}
  .tbf-volume input::-webkit-slider-runnable-track{height:8px;border-radius:4px;
    background:linear-gradient(90deg,var(--encre-kraft,#000) var(--v),transparent var(--v));
    box-shadow:inset 0 0 0 1.5px var(--encre-kraft,#000)}
  .tbf-volume input::-moz-range-track{height:8px;border-radius:4px;
    background:linear-gradient(90deg,var(--encre-kraft,#000) var(--v),transparent var(--v));
    box-shadow:inset 0 0 0 1.5px var(--encre-kraft,#000)}
  .tbf-volume input::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
    width:22px;height:22px;margin-top:-7px;border:0;border-radius:50%;background:var(--craie);
    box-shadow:0 0 0 2px var(--encre-kraft,#000),1px 2px 0 2px rgba(7,9,12,.45)}
  .tbf-volume input::-moz-range-thumb{width:22px;height:22px;border:0;border-radius:50%;
    background:var(--craie);box-shadow:0 0 0 2px var(--encre-kraft,#000),1px 2px 0 2px rgba(7,9,12,.45)}
  .tbf-volume input:focus-visible{outline:3px solid var(--encre-kraft,#000);outline-offset:2px}
  .tbf-volume input:disabled{opacity:.45;cursor:not-allowed}
  /* **Apparaître hors ligne** (lot 6) : une ligne-bouton du pied, le mot à
     gauche, la piste au bord droit (sa marge automatique, plus haut) — elle
     se lit comme une phrase qu'on coche. Sa matière (l'encre du kraft, le
     corps, la piste) est celle des autres lignes du pied ; cette feuille
     n'en décide que la place.

     **À côté du volume, dans la seconde colonne du pied** (à partir de
     350 px, là où le pied en a deux). Sur sa propre ligne, sous le volume,
     elle ajoutait cinquante et un pixels à un tiroir qui en avait déjà
     neuf cent cinquante-sept à 360 × 640 : mille huit, un écran et
     cinquante-huit centièmes, au-delà de l'écran et demi que le lot 2 a
     fixé (« un écran et demi au plus, sur un téléphone », ui.css), et que
     l'audit relève sur le tiroir avec la présence servie. Rangée avec le
     volume, elle ne coûte rien : neuf cent cinquante-sept, comme sans elle.
     Les deux sont des réglages de la façon dont le jeu se comporte, et
     tiennent chacun dans sa colonne : VOLUME et son curseur dans la
     première (quatre-vingt-cinq pixels de curseur à 360), le mot et la
     piste dans la seconde. Un filet tireté vertical, celui des liens du
     pied, posé dans l'écart des colonnes, les sépare : ce n'est ni le
     volume, ni une facette du calme.

     **Le mot passe sur deux lignes**, « APPARAÎTRE » puis « HORS LIGNE »
     (une espace insécable les tient ensemble, voir presenceHTML) : deux
     lignes de treize pixels tiennent dans les quarante-quatre de la cible.
     Sous 420 px, l'icône s'efface de cette rangée-là : à 360, la colonne a
     cent quarante-trois pixels, et l'icône, le mot, la piste et leurs
     écarts en demandaient cent quarante-sept en Oswald, cent soixante-cinq
     dans la police de repli tant qu'Oswald n'est pas arrivée (le mot seul y
     fait quatre-vingt-dix pixels au lieu de soixante-douze). Sans l'icône,
     cent trente-huit au plus. Le mot reste, c'est lui qu'on cherche ; le
     volume, à côté, n'a pas d'icône non plus.

     La classe tbf-volume--rangee est posée sur le volume par ce fichier,
     seulement quand la ligne existe (voir montrerPresence) : un sélecteur
     ne sait pas regarder vers un frère qui suit sans :has, que l'on
     n'emploie pas ici pour la même raison que la marge des MISSIONS, plus
     bas. Un volume caché (un appareil sans son) laisse la ligne seule, sur
     toute la largeur, comme sous 350 px, où le pied n'a qu'une colonne :
     un filet tireté horizontal la sépare alors du volume. */
  .tbf-presence{margin:6px 0 0;border-top:1.5px dashed rgba(7,9,12,.38)}
  .tbf-presence .lib{min-width:0}
  @media (min-width:350px){
    .tbf-tiroir-pied>.tbf-volume--rangee:not([hidden]){grid-column:1}
    .tbf-tiroir-pied>.tbf-volume--rangee:not([hidden])+.tbf-presence{grid-column:2;position:relative;
      margin:4px 0 0;border-top:0}
    .tbf-tiroir-pied>.tbf-volume--rangee:not([hidden])+.tbf-presence::before{content:"";position:absolute;
      left:-8px;top:8px;bottom:8px;border-left:1.5px dashed rgba(7,9,12,.38)}
  }
  @media (min-width:350px) and (max-width:419px){
    .tbf-tiroir-pied>.tbf-volume--rangee:not([hidden])+.tbf-presence .tbf-tiroir-bt{gap:8px}
    .tbf-tiroir-pied>.tbf-volume--rangee:not([hidden])+.tbf-presence svg{display:none}
  }
  /* **La bâche des MISSIONS, dans la tête** (lots 3 et 5). Elle prend la
     matière de celle de l'accueil, dont elle porte la classe ; cette feuille
     n'en décide que la place et le sticker.

     La place : contre l'accueil, et la croix seule au bord droit. ui.css
     pousse le reste à droite depuis le premier élément de la tête qui n'est
     pas suivi du mot MENU : c'était l'accueil, ce sont maintenant les
     MISSIONS. Leur marge est écrite sans :has, pour qu'un navigateur qui ne
     le lit pas garde la croix au bord.

     Le sticker : la pastille des MISSIONS (contrat du serveur, R10), celui
     des tuiles et du bouton de menu — son chiffre, sa face, son bord craie
     cerné d'encre —, au bout du mot et non sur le coin. Sur le coin, il
     sortirait de la bâche de dix pixels, et le lien passerait pour rogné
     aux suites qui comparent sa largeur à son contenu ; il ne pourrait pas
     non plus monter de ses huit pixels, la tête n'en ayant que huit
     au-dessus d'elle avant le bord du tiroir, qui rogne. Il prend la place
     de l'icône, qui part quand il paraît : la bâche garde sa largeur à
     deux pixels près, et la récompense se lit mieux qu'une case cochée. Il
     ne respire pas, comme tout sticker du tiroir. menu.js le pose comme
     sur une tuile, par data-etat et data-pastille (voir poser). L'or est
     une face, celle d'une récompense prête, l'encre dessus : 11,7:1.

     **Sous 350 px, la bâche se serre.** À 320, la tête a deux cent
     quatre-vingt-douze pixels : l'accueil, les MISSIONS avec leur icône et
     la croix les prennent tous, au pixel près, et avec « 12 » au lieu de
     l'icône, deux de plus. La bâche y perd donc son icône, toujours, et
     avec son sticker, un peu de rembourrage et d'espacement : il reste
     huit pixels. Le mot reste — c'est lui qu'on cherche. Tant qu'Oswald
     n'est pas arrivée, une police de repli aussi large qu'Arial déborde
     encore d'une dizaine de pixels à 320 quand le sticker est là ; à 360,
     tout tient, même en Arial. */
  .tbf-tiroir .tbf-tiroir-tete>.tbf-tiroir-ici:has(+ .tbf-tiroir-missions){margin-right:0}
  .tbf-tiroir .tbf-tiroir-tete>.tbf-tiroir-missions{margin-right:auto}
  .tbf-tiroir-tete>.tbf-tiroir-missions[data-etat]::after,
  .tbf-tiroir-tete>.tbf-tiroir-missions[data-pastille]::after{
    content:attr(data-pastille);flex:none;
    box-sizing:border-box;min-width:22px;height:22px;padding:0 5px;border-radius:5px;
    background:var(--pf,var(--craie));color:var(--pl,var(--encre));
    font-family:var(--banner);font-size:13px;font-weight:700;line-height:22px;
    text-align:center;letter-spacing:.02em;text-shadow:none;
    font-variant-numeric:tabular-nums;white-space:nowrap;
    box-shadow:0 0 0 2px var(--craie),0 0 0 3.5px var(--encre),2px 2px 0 3.5px rgba(7,9,12,.6);
    rotate:4deg;pointer-events:none}
  .tbf-tiroir-tete>.tbf-tiroir-missions[data-etat=pret]::after{--pf:var(--projo);--pl:var(--encre)}
  .tbf-tiroir-tete>.tbf-tiroir-missions[data-etat] svg{display:none}
  @media (max-width:349px){
    .tbf-tiroir-tete>.tbf-tiroir-missions svg{display:none}
    .tbf-tiroir .tbf-tiroir-tete>.tbf-tiroir-missions[data-etat]{padding:0 9px;letter-spacing:.06em}
  }
  /* La consigne de l'iPhone, sous son entrée. Un texte qu'on lit pour agir :
     treize pixels. Elle vit sur le ticket kraft du pied depuis le lot 2, et
     y est peinte par ui.css, au noir pur du kraft éclairci (arbitrage du
     2 octobre 2026), comme tout ce que porte ce ticket — les mots des
     interrupteurs compris : cette feuille ne leur donne aucune couleur.
     Elle la peignait en craie, pour le fond sombre d'avant — la craie sur
     le kraft ne se lit pas, et seule la règle plus lourde de ui.css l'en
     empêchait. */
  .tbf-installer-ios{margin:0 10px 6px 39px;font-size:13px;line-height:1.5}
  .tbf-installer-ios b{font-weight:700}`;

  /* Une seule interrogation du serveur pour toute la page, quel que soit le
     nombre d'appelants. L'accueil demandait `role` à `/api/auth/me` pendant
     que `nav.js` demandait `/api/admin/suis-je` : deux sources pour la même
     question, et `estAdmin` est celle qui fait foi côté serveur. */
  let promesseAdmin = null;
  /** Le tiroir monté sur cette page, s'il l'est : voir `poser`, tout en bas. */
  let monte = null;
  const suisJeAdmin = () => {
    promesseAdmin ??= fetch('/api/admin/suis-je', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((j) => Boolean(j.admin))
      .catch(() => false);
    return promesseAdmin;
  };

  /* ------------------------------------------ la pastille des MISSIONS

     **Le tiroir ne demande jamais le quotidien au serveur** (contrat R10).
     Le hub et l'écran des MISSIONS le lisent déjà, et retiennent dans
     l'onglet ce qu'un RÉCUPÉRER verserait : `{ qui, t, aReclamer }` sous
     « tbf-quotidien ». Le tiroir le relit — même joueur, moins d'une minute
     —, et sans clé valide il ne pose rien. Une lecture de plus par page pour
     un sticker serait le défaut que `pastille`, plus bas, a déjà corrigé
     pour le direct.

     `qui` peut avoir été écrit en nombre par une page et en texte par une
     autre : les deux se comparent en texte, comme le HUD de nav.js. Rend le
     nombre à afficher, zéro pour rien. */
  const CLE_MISSIONS = 'tbf-quotidien';
  const DUREE_MISSIONS = 60_000;
  function missionsDe(brut, qui) {
    let d = null;
    try { d = JSON.parse(brut || 'null'); } catch { return 0; }
    if (!d || typeof d !== 'object' || d.qui == null || String(d.qui) !== qui) return 0;
    const age = Date.now() - Number(d.t);
    if (!(age >= 0 && age < DUREE_MISSIONS)) return 0;
    const n = Math.floor(Number(d.aReclamer));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /* --------------------------------------------------------- le volume

     Le réglage du joueur, de 0 à 1, sous « tbf-volume » : un nombre écrit
     en texte. Il appartient au moteur du son (son.js, TBF_SON.volume), que
     toutes les pages du tiroir reçoivent par fx.js — mais fx.js est différé
     et l'ajoute après coup, en script qui arrive quand il arrive. Le tiroir
     peut donc être monté avant lui : sur l'accueil, l'administration et la
     boutique, ce fichier est lu avant fx.js, et nav.js monte le tiroir dès
     que le joueur est connu. Et le moteur peut ne jamais arriver (script
     bloqué, réseau coupé). Sans moteur, le tiroir lit et écrit la clé
     lui-même, sous la même forme : le moteur la relit en se chargeant, et
     les autres onglets à l'événement « storage ». Une valeur illisible vaut
     le volume plein, comme dans son.js. */
  const CLE_VOLUME = 'tbf-volume';
  const borner = (v) => Math.min(1, Math.max(0, v));
  function volumeRetenu() {
    const lu = window.TBF_SON?.volume?.();
    if (typeof lu === 'number' && Number.isFinite(lu)) return borner(lu);
    try {
      const brut = localStorage.getItem(CLE_VOLUME);
      if (brut !== null && brut.trim() !== '' && Number.isFinite(Number(brut))) return borner(Number(brut));
    } catch { /* stockage fermé : le volume plein, comme le moteur */ }
    return 1;
  }
  /* Un appareil sans Web Audio n'a pas de son du tout : un curseur qui ne
     change rien ferait douter des réglages voisins (même règle que les
     vibrations, plus bas). */
  const sonPossible = () =>
    typeof (window.AudioContext ?? window.webkitAudioContext) === 'function';

  /* **Combien de monde, et où** (5 octobre 2026). Deux comptes, écrits ici
     une fois : le tiroir les met sur ses tuiles, l'accueil dans son bandeau
     (`TBF_MENU.auVirage`, `TBF_MENU.duelsEnAttente`). Deux pages qui
     compteraient chacune de leur côté finiraient par annoncer deux nombres
     pour la même soirée.

     `auVirage` : les supporters des tribunes ouvertes, les deux camps, tels
     que `/api/virage/live` les sert (`crowd` : ceux qui ont chanté depuis
     une minute et demie — la foule même que la tribune affiche en entrant).
     `duelsEnAttente` : les files de `/api/nvn/attentes` où quelqu'un
     attend, une par match et par format, c'est-à-dire un duel chacune. */
  const auVirage = (matchs) => (Array.isArray(matchs) ? matchs : [])
    .filter((m) => m?.open && !m.fini)
    .reduce((n, m) => n + (Number(m.crowd?.[0]) || 0) + (Number(m.crowd?.[1]) || 0), 0);
  const duelsEnAttente = (attentes) => (Array.isArray(attentes) ? attentes : [])
    .filter((a) => a?.camps?.some((n) => Number(n) > 0)).length;

  /**
   * Monte le tiroir et le branche sur un bouton déjà dessiné par la page.
   *
   * @param {HTMLElement} bouton le bouton « menu » de la page.
   * @param {{qui?: (string|number|null)}} [options] `qui` : l'identifiant du
   *   joueur, celui que nav.js passe au HUD (`user.id ?? user.pseudo`). Il
   *   signe la clé de la pastille des MISSIONS : sans lui, le tiroir ne la
   *   lit pas, et c'est la page qui pose l'état (le hub le fait).
   * @returns {{tiroir: HTMLElement, voile: HTMLElement, ouvrir: (oui:boolean)=>void,
   *   poser: (href:string, etat:?string, pastille?:(string|number)) => void}}
   *   `poser` : l'état d'une destination — une tuile, ou la bâche des
   *   MISSIONS dans la tête (`/aide`) — (`direct`, `pret`, `attend`,
   *   `nouveau`, `monde`, ou rien pour l'éteindre), et le bouton prend le
   *   plus urgent (`monde`, du monde au Virage, n'en est jamais un).
   */
  function monter(bouton, { qui = null } = {}) {
    if (!document.getElementById('tbf-menu-css')) {
      const feuille = document.createElement('style');
      feuille.id = 'tbf-menu-css';
      feuille.textContent = CSS_REGLAGES;
      document.head.appendChild(feuille);
    }

    const tiroir = document.createElement('nav');
    tiroir.id = 'tbf-tiroir';
    tiroir.className = 'tbf-tiroir';
    tiroir.setAttribute('aria-label', 'Le reste du jeu');
    tiroir.hidden = true;

    /* La page où l'on est se marque, et ne se propose pas.
       Sans ça le menu offre d'aller là où on est déjà, ce qui est le meilleur
       moyen de faire douter quelqu'un de l'endroit où il se trouve. */
    const ici = (href) => chemin === href;

    /* **La tête** (lot 2). Le tiroir est une bâche qu'on déroule depuis le
       haut, et elle couvre la barre — sur un téléphone, tout l'écran : le
       bouton de menu qui l'a ouverte est dessous. Elle porte donc elle-même
       de quoi se refermer, une bâche « × » de 44 px là où était le menu, et
       le retour à l'accueil là où était la flèche. Sans ce bouton, à 360 px,
       on ne pouvait plus refermer le menu qu'avec Échap — c'est-à-dire pas
       du tout sur un téléphone.

       **Les MISSIONS, juste à côté de l'accueil** (lots 3 et 5). Elles
       ouvraient le pied, sur le ticket kraft, comme dans la maquette (écran
       2, « le tiroir »). Mais la maquette range neuf tuiles, et le tiroir en
       porte seize : à 360 × 640, le format de référence, le pied commence
       sous le bord de l'écran, et les MISSIONS avec lui (à 695 px du haut,
       pour 640). C'est pourtant sur elles qu'une récompense attend, et le
       bouton de menu la montre avant celle des boosters (voir `porteurs`) :
       on ouvrait le tiroir sur un sticker « 2 » pour n'y trouver que le
       « 6 » des boosters. Dans la tête, elles se voient en ouvrant, à tous
       les formats, et sans un pixel de hauteur de plus.

       Une bâche de la tête, la même que celle de l'accueil
       (`.tbf-tiroir-ici` : sa matière, son appui, son anneau de focus, sa
       toile craie quand on est sur la page), et pas une tuile : on y vient
       chercher quelque chose, ce n'est pas un endroit où jouer. Son sticker
       se pose au bout du mot, à la place de l'icône (voir `CSS_REGLAGES`).
       C'était « Aide et premiers pas » ; l'écran est devenu MISSIONS au
       lot 5, l'adresse reste `/aide`, et les premiers pas et les questions
       y sont restés — quelqu'un de perdu les trouve maintenant tout en haut.

       Elle prend la place du mot MENU sur son scotch, qui était pour l'œil
       seul (le tiroir s'annonce par son `aria-label`) : à 360 px, la tête
       n'a pas la place des quatre — l'accueil, les MISSIONS et la croix
       laissent trente pixels au mot, qui en demande cinquante-six, et le
       scotch se serait coupé en « M… ». */
    const tete = '<div class="tbf-tiroir-tete">'
      + `<a class="tbf-tiroir-ici${chemin === '/' ? ' on' : ''}" href="/"`
      + `${chemin === '/' ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path`
      + ` d="${ICONES.accueil}"/></svg>L’accueil</a>`
      + `<a class="tbf-tiroir-ici tbf-tiroir-missions${ici('/aide') ? ' on' : ''}" href="/aide"`
      + `${ici('/aide') ? ' aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path`
      + ` d="${ICONES.missions}"/></svg>Missions</a>`
      + '<button type="button" class="tbf-tiroir-fermer" aria-label="Fermer le menu">'
      + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONES.fermer}"/></svg></button>`
      + '</div>';

    /* **Les trois rubriques, en grilles de bâches-tuiles** (lot 2). C'étaient
       seize lignes de texte à plat, la seule surface du jeu sans matière ; ce
       sont maintenant les tuiles du hub, aux mêmes tons que sur le hub, avec
       les mêmes stickers d'état. Le titre est un vrai titre de section — un `h2`
       au pochoir —, et son texte reste le mot seul : `menu-smoke` le lit. */
    const rubriques = MENU.map((r) => '<section class="tbf-tiroir-rub">'
      + `<h2 class="tbf-rubrique" data-ton="${r.ton}"><span class="tbf-pochoir">${r.titre}</span></h2>`
      + '<div class="tbf-tiroir-grille">'
      + r.liens.map(([href, cle, texte, ton]) => tuile(href, cle, texte, ton ?? r.ton, ici(href))).join('')
      + '</div></section>').join('');

    /* **Le mode calme**, en dernière rubrique : ce n'est pas un endroit où
       aller, c'est la façon dont le jeu se comporte partout. Des boutons et
       non des liens : un lien mène quelque part, un interrupteur change
       quelque chose ici, et un lecteur d'écran doit pouvoir le dire.

       Trois facettes séparées, parce que les raisons ne sont pas les mêmes :
       on coupe le son dans le train, les vibrations la nuit, les animations
       parce qu'elles fatiguent ou qu'elles donnent le mal de mer. Les
       barres de temps et les chiffres restent : ce sont des informations.

       Il a rejoint le pied (lot 2), après la déconnexion : sur le ticket
       kraft, avec tout ce qui ne se joue pas. Il reste la dernière rubrique,
       comme avant — ses trois interrupteurs en une rangée (`.tbf-calme`,
       voir `CSS_REGLAGES`). */
    const calmeHTML = '<div class="tbf-rubrique" id="tbf-calme-titre">MODE CALME</div>'
      + '<div class="tbf-calme" role="group" aria-labelledby="tbf-calme-titre">'
      + REGLAGES.map(interrupteur).join('') + '</div>';

    /* **Le volume** (chantier du son), sur sa ligne, juste sous les
       interrupteurs — et hors de leur groupe : ce n'est pas un interrupteur,
       et `menu-smoke` compte ceux du calme par leur rôle. Un curseur de 0 à
       100 par pas de 5 : vingt crans, assez fins pour l'oreille et assez
       gros pour le doigt. Le nom que lit un lecteur d'écran dit ce qu'il
       règle ; le mot à l'œil suffit sous MODE CALME. Il naît sans valeur :
       elle est relue au montage (voir `reglerVolume`). */
    const volumeHTML = '<label class="tbf-volume">Volume'
      + '<input type="range" min="0" max="100" step="5" aria-label="Volume des sons"></label>';

    /* **Apparaître hors ligne** (lot 6, décision de Gaël sur Q2 ; contrat
       § 18.2). La présence — en ligne, au Virage, en duel — est vue des seuls
       amis mutuels, et visible par défaut : chacun doit pouvoir s'en retirer,
       et le tiroir est le seul endroit présent sur toutes les pages. Au pied,
       juste sous le mode calme, à côté du volume : c'est la façon dont le
       jeu se comporte, pas un endroit où aller.

       Un interrupteur, comme ceux du calme, et pour la même raison : le
       libellé dit ce qu'il fait quand on l'allume — **apparaître hors
       ligne**. Allumé, on est caché ; un « Présence » allumé laisserait
       deviner si l'on se montre ou si l'on se cache. Le nom que lit un
       lecteur d'écran précise auprès de qui, et contient le mot affiché.

       Hors du groupe du calme, et sans titre de rubrique : ce n'est pas une
       facette du calme, et une rubrique de plus pour une ligne allongerait
       le pied (`menu-smoke` compare aussi la liste des rubriques mot pour
       mot). Dans la seconde colonne du pied, sur la rangée du volume : sur
       sa propre ligne, elle faisait passer le tiroir au-delà d'un écran et
       demi à 360 × 640 (voir `CSS_REGLAGES`). Le mot y passe sur deux
       lignes, « APPARAÎTRE » puis « HORS LIGNE » : l'espace insécable
       empêche une coupure en « APPARAÎTRE HORS » puis « LIGNE ».

       **Absent du tiroir tant que le serveur ne sert pas la présence**, et
       non pas caché : la ligne n'est construite qu'à la réponse qui la
       permet, et retirée à celle qui l'éteint (voir `lirePresence`). Née
       cachée, elle restait dans l'arbre, et `menu-smoke` — qui relève tous
       les `[role="switch"]` du tiroir, cachés compris — y comptait quatre
       interrupteurs du calme au lieu de trois, sur un serveur où la
       présence est éteinte (le cas de la livraison). Servie, le tiroir en
       compte quatre, dont trois dans le groupe du calme : un contrôle qui
       les relève tous doit alors le savoir. */
    const presenceHTML = '<button type="button" class="tbf-tiroir-bt" role="switch" aria-checked="false"'
      + ' aria-label="Apparaître hors ligne pour mes amis" data-presence>'
      + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONES.presence}"/></svg>`
      + '<span class="lib">Apparaître hors&nbsp;ligne</span>'
      + '<span class="tbf-inter" aria-hidden="true"></span></button>';

    /* **Le pied, sur un ticket kraft** (lot 2) : une liste calme, en deux
       colonnes, pour ce qu'on vient chercher en sachant ce qu'on cherche — et
       qui n'est pas un endroit où jouer. Les liens gardent leur balisage et
       leur ordre ; seul le papier change, et ui.css les passe au noir du
       kraft (`--encre-kraft`, arbitrage du 2 octobre 2026). */
    tiroir.innerHTML = tete + rubriques
      + '<div class="tbf-ticket tbf-tiroir-pied">'
      /* **Rien ne disait nulle part qu'on est abonné.**
       *
       * On paie, on est débité, et l'application ne change pas d'un pixel :
       * ce que l'abonnement ouvre est du confort — des réserves plus grandes,
       * une mémoire plus longue — donc rien qui saute aux yeux. Un joueur
       * dans ce cas croit que son paiement n'a pas abouti, et il a raison de
       * le croire : rien ne lui prouve le contraire.
       *
       * Le menu est le seul endroit présent sur **toutes** les pages. La
       * marque s'y pose donc, et elle est remplie après coup : le tiroir ne
       * doit pas attendre une requête pour s'ouvrir. */
      + '<div class="tbf-abo" id="tbf-abo" hidden></div>'
      /* **Installer l'application.** Elle était sur l'accueil, en bas de
         l'écran de jeu, où elle prenait une ligne à chaque visite pour un geste
         qu'on ne fait qu'une fois. Ici elle est à portée sur toutes les pages,
         et elle ne coûte rien à qui ne la cherche pas.

         Née cachée, et elle ne paraît que si elle a quelque chose à faire :
         voir « proposerInstallation », plus bas.

         Elle suivait l'Aide, devenue les MISSIONS, qui ouvrait le pied parce
         que c'est l'entrée qu'on cherche quand on est perdu. Les MISSIONS
         sont montées dans la tête (voir `tete`, plus haut) : les jours où
         elle paraît, c'est elle qui ouvre le pied, avant le profil — et sa
         place ne bouge pas, pour que le focus qu'elle rend en se cachant
         tombe toujours sur le profil et jamais sur la déconnexion (voir
         « proposerInstallation »). */
      + '<button type="button" class="tbf-tiroir-bt" id="tbf-installer" hidden>'
      + `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONES.installer}"/></svg>`
      + 'Installer l’application</button>'
      + '<p class="tbf-installer-ios" id="tbf-installer-ios" hidden>Pour l’avoir en plein écran : '
      + '<b>Partager</b>, puis <b>Sur l’écran d’accueil</b>.</p>'
      + item('/profil', 'profil', 'Mon profil', ici('/profil') ? 'on' : '')
      + item('/compte', 'compte', 'Mon compte', ici('/compte') ? 'on' : '')
      + item('#', 'sortie', 'Se déconnecter', 'sortie')
      + calmeHTML
      + volumeHTML
      /* Ici, entre le volume et la version, la ligne « apparaître hors
         ligne » quand le serveur la permet (`presenceHTML`, plus haut), sur
         la rangée du volume à partir de 350 px. */
      /* **La version, tout en bas, et sur toutes les pages.**

         Un joueur qui signale un défaut décrit ce qu'il voit ; il ne peut pas
         dire sur quelle version il le voit. Sans ce numéro, chaque retour
         commence par « as-tu rechargé ? » — une question qui fait porter au
         joueur la charge de notre déploiement.

         Et le mot **bêta** n'est pas de la modestie : il prévient que les
         soldes peuvent bouger et qu'une saison peut être rejouée. Un joueur
         prévenu pardonne, un joueur surpris s'en va.

         Le tiroir est le seul élément présent sur **toutes** les pages —
         c'est déjà pour ça que la marque d'abonnement y vit.

         **Pas de data-legal**, et c'est voulu : ce numéro n'est pas une
         mention qu'on a le droit de lire mal, c'est le texte qu'un joueur doit
         pouvoir recopier dehors, pressé, quand on lui demande « quelle version
         as-tu ? ». ui.css le pose à onze pixels, à l'encre pleine sur le
         kraft du pied — au-dessus du plancher des textes qui informent
         (0,85), où l'audit doit continuer à le tenir plutôt que de le laisser
         redescendre sous la tolérance des mentions légales (0,55) sans que
         rien ne le signale. */
      + '<div class="tbf-version" id="tbf-version"></div>'
      + '</div>';

    const voile = document.createElement('div');
    voile.className = 'tbf-voile';
    document.body.append(tiroir, voile);

    bouton.setAttribute('aria-controls', 'tbf-tiroir');
    bouton.setAttribute('aria-expanded', 'false');

    /* ----------------------------------------------- les interrupteurs

       Leur état est **relu** à chaque ouverture et à chaque changement
       annoncé, jamais retenu ici : le bouton de son du duel règle la même
       facette, un autre onglet peut la régler aussi, et un interrupteur qui
       dit le contraire du jeu est pire que pas d'interrupteur. */
    const interrupteurs = [...tiroir.querySelectorAll('[data-facette]')];
    const majInterrupteurs = () => {
      for (const b of interrupteurs) {
        b.setAttribute('aria-checked', String(calme(b.dataset.facette)));
      }
    };
    /* Un téléphone qui ne sait pas vibrer — l'iPhone, entre autres : Safari
       n'a pas l'interface — n'a rien à couper. Un interrupteur qui ne change
       rien fait douter des deux autres. */
    if (typeof navigator.vibrate !== 'function') {
      tiroir.querySelector('[data-facette="vibrations"]')?.setAttribute('hidden', '');
    }
    for (const b of interrupteurs) {
      b.addEventListener('click', () => {
        const facette = b.dataset.facette;
        const oui = !calme(facette);
        reglerCalme(facette, oui);
        majInterrupteurs();
        /* Rétablir se prouve tout de suite : on entend le son revenir, on
           sent la vibration revenir. Sans ça, rien ne dit que le geste a pris
           avant le prochain but. */
        if (!oui && facette === 'sons') window.FX?.son?.('tic');
        if (!oui && facette === 'vibrations') {
          try { navigator.vibrate?.(18); } catch { /* pas de moteur */ }
        }
      });
    }
    window.addEventListener('tbf-calme', majInterrupteurs);
    window.addEventListener('storage', majInterrupteurs);
    majInterrupteurs();

    /* ------------------------------------------------------- le volume

       Relu comme les interrupteurs, jamais retenu ici : à chaque ouverture,
       quand le moteur l'annonce (« tbf-volume »), quand un autre onglet
       l'écrit (« storage »), et quand le calme des sons change
       (« tbf-calme ») — un curseur actif sous le calme ferait croire que le
       son revient si on le pousse, alors il s'éteint. */
    const ligneVolume = tiroir.querySelector('.tbf-volume');
    const curseur = ligneVolume.querySelector('input');
    const peindreVolume = () => curseur.style.setProperty('--v', `${curseur.value}%`);
    const reglerVolume = () => {
      const v = String(Math.round(volumeRetenu() * 100));
      if (curseur.value !== v) curseur.value = v;
      peindreVolume();
      const coupe = calme('sons');
      curseur.disabled = coupe;
      if (coupe) curseur.setAttribute('aria-disabled', 'true');
      else curseur.removeAttribute('aria-disabled');
    };
    if (!sonPossible()) ligneVolume.hidden = true;
    curseur.addEventListener('input', () => {
      const v = Number(curseur.value) / 100;
      peindreVolume();
      if (typeof window.TBF_SON?.volume === 'function') window.TBF_SON.volume(v);
      else {
        try { localStorage.setItem(CLE_VOLUME, String(v)); }
        catch { /* stockage fermé : sans moteur sur cette page, rien d'autre à régler */ }
      }
    });
    /* Le niveau choisi s'entend une fois, au lâcher : un tic à chaque cran
       crépiterait pendant qu'on glisse. */
    curseur.addEventListener('change', () => window.FX?.son?.('tic'));
    window.addEventListener('tbf-volume', reglerVolume);
    window.addEventListener('tbf-calme', reglerVolume);
    /* Un autre onglet a écrit la clé : le moteur de cette page la relit sur
       le même événement, et son écoute peut passer après celle-ci — il est
       chargé par fx.js, parfois après le tiroir. On relit donc une fois que
       tout le monde a entendu, sans quoi le curseur prendrait l'ancien
       volume du moteur. */
    window.addEventListener('storage', (e) => {
      if (e.key === CLE_VOLUME || e.key === 'tbf-calme' || e.key === null) setTimeout(reglerVolume, 0);
    });
    reglerVolume();

    /* ------------------------------------------ apparaître hors ligne

       **Lu à l'ouverture du tiroir, jamais au chargement d'une page**
       (contrat § 18.2) : la présence n'ajoute aucune requête par écran, et
       ne coûte une ligne qu'à qui ouvre le menu. Relu à chaque ouverture,
       comme les interrupteurs du calme : un autre onglet a pu changer le
       choix, et Gaël peut éteindre la présence entre deux ouvertures.

       **Ce qui fait paraître l'interrupteur** : `{ actif: true, visible }`,
       avec un vrai booléen. `{ actif: false }` (la présence éteinte, comme à
       la livraison), une autre forme, un 404 (un serveur d'avant), un 503 ou
       pas de réseau : il ne paraît pas, ou disparaît (R2). Un interrupteur
       qui dirait un état qu'on ne connaît pas est pire que pas
       d'interrupteur — et ici, il parlerait de ce que les autres voient.

       **Le toucher.** La piste bascule tout de suite, sous le doigt, puis le
       serveur répond : `{ actif: true, visible }`, et son `visible` fait foi.
       **Toute autre réponse retire l'interrupteur**, comme à l'ouverture :
       `{ actif: false }` (la présence éteinte entre-temps, ou une base sans
       `sql/arenes.sql`), un refus (400 `presence.error.requete` — le corps
       envoyé est toujours juste, un refus dit donc un serveur qui ne parle
       pas ce contrat), une session perdue (401), une panne (503
       `presence.error.server`) ou pas de réseau. Il revenait auparavant où
       il était ; mais après une panne ou une coupure, on ne sait pas si le
       choix a été écrit avant elle, et l'interrupteur dirait alors un état
       qu'on ne connaît pas. La prochaine ouverture relit, et il revient si
       le serveur répond. Rien en console : l'absence n'est pas une faute de
       la page (R2).

       Un seul envoi à la fois ; tant qu'il est en route, l'ouverture ne
       relit pas (une lecture partie avant l'envoi rendrait l'état d'avant),
       et `tour` écarte toute réponse plus vieille que la dernière question
       posée. */
    let lignePresence = null;
    let tourPresence = 0;
    let envoiPresence = false;
    const etatPresence = (j) => (j?.actif === true && typeof j.visible === 'boolean' ? j.visible : null);
    const montrerPresence = (visible) => {
      if (visible === null) {
        if (!lignePresence) return;
        /* Le focus ne tombe pas avec elle (même règle que l'installation) :
           il passe au volume s'il se touche, sinon à la croix de la tête. */
        if (lignePresence.contains(document.activeElement)) {
          (ligneVolume.hidden || curseur.disabled ? tiroir.querySelector('.tbf-tiroir-fermer') : curseur)
            .focus({ preventScroll: true });
        }
        lignePresence.remove();
        lignePresence = null;
        // Le volume reprend toute la largeur (voir `CSS_REGLAGES`).
        ligneVolume.classList.remove('tbf-volume--rangee');
        return;
      }
      if (!lignePresence) {
        lignePresence = document.createElement('div');
        lignePresence.className = 'tbf-presence';
        lignePresence.id = 'tbf-presence';
        lignePresence.innerHTML = presenceHTML;
        lignePresence.querySelector('[data-presence]').addEventListener('click', basculerPresence);
        /* Juste après le volume, dont elle partage la rangée à partir de
           350 px : la feuille la range à côté de lui par la classe qu'il
           prend ici. Avant la version, qui reste tout en bas. */
        ligneVolume.after(lignePresence);
        ligneVolume.classList.add('tbf-volume--rangee');
      }
      lignePresence.querySelector('[data-presence]').setAttribute('aria-checked', String(!visible));
    };
    async function lirePresence() {
      if (envoiPresence) return;
      const n = ++tourPresence;
      let j = null;
      try {
        const r = await fetch('/api/presence', { credentials: 'same-origin' });
        if (r.ok) j = await r.json();
      } catch { /* pas de réseau, ou pas du JSON : pas d'interrupteur */ }
      if (n === tourPresence) montrerPresence(etatPresence(j));
    }
    async function basculerPresence(e) {
      const inter = e.currentTarget;
      if (envoiPresence) return;
      const cache = inter.getAttribute('aria-checked') === 'true';
      const n = ++tourPresence;
      envoiPresence = true;
      inter.setAttribute('aria-checked', String(!cache));
      inter.setAttribute('aria-busy', 'true');
      let j = null;
      try {
        const r = await fetch('/api/presence', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          // Le nouveau choix : visible si l'on était caché, caché sinon.
          body: JSON.stringify({ visible: cache }),
        });
        if (r.ok) j = await r.json();
      } catch { /* pas de réseau, ou pas du JSON : pas d'interrupteur */ }
      envoiPresence = false;
      inter.removeAttribute('aria-busy');
      if (n === tourPresence) montrerPresence(etatPresence(j));
    }

    /* --------------------------------------- installer l'application

       Trois cas, les mêmes que l'invitation que portait l'accueil, et le
       troisième est celui qu'on oublie toujours :

         — le navigateur sait installer (pwa.js a retenu sa proposition) : un
           bouton, et le geste est fait ;
         — c'est un iPhone ou un iPad : Safari ne sait pas installer tout seul
           et n'envoie aucun événement. On ne peut qu'expliquer le geste, et
           l'entrée déplie la consigne ;
         — le jeu tourne **déjà** comme une application, ou le navigateur n'a
           rien proposé : l'entrée reste cachée. Un « installer » dans une
           application installée fait douter de ce qu'on a sous les yeux.

       pwa.js est chargé en différé, et la proposition du navigateur arrive
       plus tard encore : on regarde au montage, à chaque ouverture du
       tiroir, et à chaque fois que pwa.js annonce du nouveau (« tbf-pwa »). */
    const installer = tiroir.querySelector('#tbf-installer');
    const consigne = tiroir.querySelector('#tbf-installer-ios');
    const proposerInstallation = () => {
      const p = window.TBF_PWA;
      const facon = !p || p.installe ? '' : p.possible ? 'proposer' : p.ios ? 'expliquer' : '';
      /* **Le focus ne tombe pas avec elle.** Sur Android, l'entrée se cache
         juste après la fenêtre d'installation — acceptée ou refusée, la
         proposition est consommée — et c'est elle qu'on vient de toucher :
         cachée avec le focus, elle le laisserait retomber sur le corps de la
         page, tiroir ouvert, et un clavier ou un lecteur d'écran repartirait
         du tout début. Il passe donc d'abord à l'entrée qui prend sa place
         (la suivante qu'on peut atteindre), ou à la précédente s'il n'y en a
         pas. */
      if (!facon && document.activeElement === installer) {
        const atteignable = (n) => !n.hidden && n.matches('a[href], button');
        let voisine = installer.nextElementSibling;
        while (voisine && !atteignable(voisine)) voisine = voisine.nextElementSibling;
        if (!voisine) {
          voisine = installer.previousElementSibling;
          while (voisine && !atteignable(voisine)) voisine = voisine.previousElementSibling;
        }
        voisine?.focus();
      }
      installer.hidden = !facon;
      installer.dataset.facon = facon;
      if (facon === 'expliquer') {
        installer.setAttribute('aria-controls', 'tbf-installer-ios');
        installer.setAttribute('aria-expanded', String(!consigne.hidden));
      } else {
        consigne.hidden = true;
        installer.removeAttribute('aria-controls');
        installer.removeAttribute('aria-expanded');
      }
    };
    installer.addEventListener('click', async () => {
      if (installer.dataset.facon === 'expliquer') {
        consigne.hidden = !consigne.hidden;
        installer.setAttribute('aria-expanded', String(!consigne.hidden));
        return;
      }
      /* La fenêtre du navigateur. Acceptée ou refusée, la proposition est
         consommée : pwa.js le dit par « tbf-pwa », et l'entrée se cache. */
      try { await window.TBF_PWA?.installer?.(); } catch { /* le navigateur a refusé de l'ouvrir */ }
      proposerInstallation();
    });
    window.addEventListener('tbf-pwa', proposerInstallation);
    proposerInstallation();

    /* ---------------------------------------- dérouler, et ranger

       `hidden` et la classe : la classe anime, l'attribut sort vraiment le
       menu de l'ordre de tabulation. Sans lui, la tabulation traverse un
       menu invisible.

       **Un calcul forcé entre les deux** (`offsetWidth`), et non plus une
       image d'attente : la bâche part de son état replié, posé par la feuille,
       et le navigateur doit l'avoir calculé avant qu'on lui donne `.on` — sans
       quoi il saute directement à l'état final, sans dérouler. Les navigateurs
       qui connaissent `@starting-style` s'en passeraient ; les autres, non.

       **Deux cent quarante millisecondes avant de la cacher**, la durée du
       déroulé (ui.css). Elle en attendait deux cents, réglées sur l'ancienne
       boîte : la fin de la bâche qui remonte aurait été coupée net.

       **Le focus suit la bâche.** Elle couvre la barre, et sur un téléphone
       tout l'écran : le bouton qui l'a ouverte est dessous. Le focus entre
       donc sur le bouton qui la ferme, et revient au bouton de menu quand
       elle se range — seulement s'il était resté dedans : un joueur qui a
       touché le voile a déjà le doigt ailleurs. */
    const fermer = tiroir.querySelector('.tbf-tiroir-fermer');
    let rangement = 0;
    const ouvert = () => tiroir.classList.contains('on');
    const ouvrir = (oui) => {
      if (oui === ouvert()) return;
      clearTimeout(rangement);
      if (oui) {
        tiroir.hidden = false;
        majInterrupteurs();
        reglerVolume();
        proposerInstallation();
        void lirePresence();
        void tiroir.offsetWidth;
        tiroir.classList.add('on');
        voile.classList.add('on');
        bouton.setAttribute('aria-expanded', 'true');
        fermer.focus({ preventScroll: true });
        return;
      }
      const avaitLeFocus = tiroir.contains(document.activeElement);
      tiroir.classList.remove('on');
      voile.classList.remove('on');
      bouton.setAttribute('aria-expanded', 'false');
      rangement = setTimeout(() => { if (!ouvert()) tiroir.hidden = true; }, 240);
      if (avaitLeFocus) bouton.focus({ preventScroll: true });
    };

    /* Le focus ne sort pas d'une bâche qui couvre l'écran : au bout de la
       liste, la tabulation repart du début au lieu de filer sur la page
       cachée derrière le voile — où elle se poserait sur des liens qu'on ne
       voit pas. Même règle que la boîte de confirmation (dialogue.js). */
    tiroir.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !ouvert()) return;
      const cibles = [...tiroir.querySelectorAll('a[href], button')]
        .filter((n) => !n.closest('[hidden]') && n.getClientRects().length);
      if (!cibles.length) return;
      const premier = cibles[0];
      const dernier = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === premier) {
        e.preventDefault(); dernier.focus();
      } else if (!e.shiftKey && document.activeElement === dernier) {
        e.preventDefault(); premier.focus();
      }
    });
    /* Le numéro de version. Une seule requête par page, mise en cache une
       heure par le serveur — et si elle échoue, la ligne reste vide plutôt
       que de mentir : un menu ne tombe pas parce qu'un numéro manque. */
    void (async () => {
      try {
        const r = await fetch('/api/version');
        if (!r.ok) return;
        const v = await r.json();
        const n = document.getElementById('tbf-version');
        if (n && v?.etiquette) n.textContent = v.etiquette;
      } catch { /* pas de numéro : le menu marche quand même */ }
    })();

    /* L'état de l'abonnement, demandé une fois et sans bloquer.
       *
       * Sous garde entière : cette route peut ne pas être montée, la table
       * peut manquer, le joueur peut ne pas être connecté. Dans tous ces cas
       * la marque reste cachée — c'est exactement ce qu'elle doit faire, et
       * un menu ne tombe pas parce qu'un abonnement est injoignable.
       *
       * **Une seule question par page** (`window.TBF_ABO`, comme `TBF_MOI`
       * pour « qui es-tu ? », nav.js). Le KOP la pose pour savoir si la
       * création d'un KOP lui est ouverte, la boutique pour son rayon du
       * PASS, la page de l'abonnement pour tout dire ; le tiroir la reposait
       * de son côté, et elle partait deux fois sur ces écrans. Le premier
       * script qui passe pose la promesse, les autres la reprennent — ici,
       * c'est presque toujours la page, le tiroir attendant le compte avant
       * de se monter. **Sa forme est un contrat entre eux** : le corps d'une
       * réponse réussie (`r.ok`), `null` sinon — refus, panne, route
       * absente —, et elle ne rejette jamais. Une page qui veut la cause
       * d'un refus la retient à part, au passage (`/abonnement`, son
       * statut), sans changer cette forme. L'objet rendu est commun : on le
       * lit, on n'y écrit pas. */
    void (async () => {
      try {
        const a = await (window.TBF_ABO ??= fetch('/api/abonnement', { credentials: 'same-origin' })
          .then((r) => (r.ok ? r.json() : null)).catch(() => null));
        const n = document.getElementById('tbf-abo');
        if (!n || !a?.abonne) return;
        const fin = a.fin
          ? new Date(a.fin).toLocaleDateString('fr-FR',
            { day: 'numeric', month: 'long', year: 'numeric' })
          : null;
        n.innerHTML = '<b>ABONNÉ</b><span>'
          + (fin ? 'jusqu’au ' + fin : 'sans terme') + '</span>';
        n.hidden = false;
      } catch { /* un menu ne tombe pas pour ça */ }
    })();

    bouton.addEventListener('click', () => ouvrir(!ouvert()));
    fermer.addEventListener('click', () => ouvrir(false));
    voile.addEventListener('click', () => ouvrir(false));
    /* Échap ferme toujours — sauf quand quelqu'un l'a déjà pris : la boîte de
       confirmation de sortie s'ouvre par-dessus le tiroir, et son Échap
       répond « non » à sa question ; il ne doit pas ranger le menu avec. */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && ouvert()) ouvrir(false);
    });

    /* La déconnexion se demande — partout, et non sur le seul écran d'accueil.
       Ce bouton est le dernier d'un tiroir qu'on ouvre pour aller ailleurs :
       c'est celui qu'on touche en visant le précédent. */
    tiroir.querySelector('.sortie').addEventListener('click', async (e) => {
      e.preventDefault();
      if (!(await window.TBF_DIALOGUE?.confirmer({
        titre: 'SE DÉCONNECTER ?',
        texte: 'Ta collection et tes duels restent. Il faudra te reconnecter pour y revenir.',
        oui: 'SE DÉCONNECTER', ton: 'flare',
      }))) return;
      /* Cet appareil cesse d'être prévenu pour ce joueur : un téléphone
         prêté n'annonce plus les votes du KOP de celui qui l'a rendu. Avant
         la déconnexion, qui ferme la session dont l'oubli a besoin. */
      await window.TBF_NOTIF?.oublier();
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
      catch { /* hors ligne : on recharge quand même, la session locale ne sert plus */ }
      /* Ce que l'onglet retenait de ce joueur part avec lui : les états du
         tiroir (ses clubs en direct, le duel qu'on lui propose, ses missions
         à récupérer) et le HUD de la barre. Quelqu'un d'autre peut se
         connecter dans la minute — la clé des missions est signée, mais une
         clé qu'on n'a plus à lire n'a pas à rester. */
      try {
        for (const cle of ['tbf-hud', 'tbf-etat-virage', 'tbf-etat-duel', CLE_MISSIONS]) {
          sessionStorage.removeItem(cle);
        }
      } catch { /* stockage fermé : il n'y avait rien de retenu */ }
      location.href = '/';
    });

    /* L'entrée d'administration, si le compte y a droit.
       Elle se posait auparavant dans `nav.js` sur une variable `nav` qui
       n'existait plus — reste de la barre du bas supprimée. La référence
       levait, le `catch` du bloc l'avalait, et **aucun administrateur n'a plus
       jamais vu l'entrée** sans qu'aucune suite ne s'en aperçoive. C'est
       pourquoi elle est montée ici, dans le seul endroit qui construit le
       menu, et vérifiée par `scripts/menu-smoke.mjs`. */
    suisJeAdmin().then((admin) => {
      if (!admin) return;
      tiroir.querySelector('.sortie')
        .insertAdjacentHTML('beforebegin',
          item('/admin', 'admin', 'Administration', ici('/admin') ? 'on' : ''));
    });

    /* Les pastilles, et ce qu'elles coûtaient.
     *
     * **`/api/virage/live` est la route la plus chère du jeu** : une requête
     * qui joint quatre tables, la journée entière du football par-dessus, le
     * tri de trente rencontres et la mise en file des couleurs de club à
     * extraire. Le menu l'appelait **à chaque chargement de chaque page** —
     * vingt-quatre écrans, cinq appels de menu par page avec elle — pour
     * décider d'un point rouge de six pixels.
     *
     * C'est cher pour le serveur, et ça compte double : le garde de débit
     * autorise deux cent quarante lectures par minute et par adresse, et ces
     * appels-là y entrent comme les autres. Quelqu'un qui navigue vite, ou une
     * famille derrière la même connexion, s'y heurtait sans rien faire
     * d'anormal.
     *
     * La réponse tient donc **trente secondes dans l'onglet**. Une pastille
     * dit « il se passe quelque chose », pas « il se passe quelque chose à
     * cette seconde précise » : un match en cours le reste un quart d'heure, et
     * une file d'attente vit deux minutes. Une demi-minute de retard sur un
     * point rouge n'a jamais fait manquer un match à personne.
     *
     * Le stockage peut lever — navigation privée, site bloqué — et on redemande
     * alors au serveur, c'est-à-dire qu'on retombe exactement sur le
     * comportement d'avant. Un menu ne tombe pas parce qu'un cache est fermé.
     */
    const DUREE_PASTILLE = 30_000;
    /* La valeur retenue est désormais **ce qu'on sait**, et non plus un
       oui ou non : le duel dit combien de supporters attendent (« 2 »), et le
       sticker l'écrit. Nouvelles clés, `tbf-etat-*` : une ancienne entrée
       `tbf-pip-*` restée dans l'onglet porte un booléen sans chiffre ;
       personne ne la relit plus, et l'onglet l'oublie en se fermant. */
    async function pastille(cle, url, decide) {
      try {
        const vu = JSON.parse(sessionStorage.getItem(cle) || 'null');
        if (vu && Date.now() - vu.t < DUREE_PASTILLE) return vu.v;
      } catch { /* pas de mémoire ici : on demande, comme avant */ }
      let v = null;
      try {
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) return null;
        v = decide(await r.json()) ?? null;
      } catch { return null; }
      try { sessionStorage.setItem(cle, JSON.stringify({ t: Date.now(), v })); }
      catch { /* tant pis : on redemandera */ }
      return v;
    }

    /* ------------------------------------------- les états, et l'urgence

       **Le point rouge aveugle est parti** (lot 2). Le bouton de menu avait
       une pastille de six pixels quand un match était en direct ou qu'un duel
       attendait : elle ne disait ni quoi ni combien, et rien pour des boosters
       à ouvrir. Chaque destination porte maintenant **le sticker de son
       état** sur sa tuile — LIVE rouge sur le Grand Virage, « 2 » violet sur
       le duel quand deux supporters attendent, « 4 » or sur les boosters
       quand la réserve en a quatre — et le bouton porte **celui de l'état le
       plus urgent** : le direct, puis la récompense prête, puis le duel. On
       retrouve en ouvrant le sticker qu'on a vu fermé.

       Tout passe par `poser`, et par rien d'autre : la tuile reçoit son
       attribut, le bouton est recalculé depuis les tuiles. Un état sans donnée
       ne se pose pas — l'attribut est retiré, jamais un tiret.

       **La bâche des MISSIONS aussi** (lots 3 et 5) : dans la tête, à côté
       de l'accueil (voir `tete`), et leur sticker or s'y pose par le même
       chemin, au bout du mot (voir `CSS_REGLAGES`).

       `poser` est rendue à l'appelant : `nav.js` y pose les boosters, qu'il
       connaît par le HUD de la barre, et l'accueil peut y poser ce qu'il sait
       déjà (ce fichier n'y demande rien, voir plus bas) — les missions
       comprises : le hub monte le tiroir avant que le quotidien lui
       réponde, et lui pose `aReclamer` à chaque recomposition. */
    const URGENCES = ['direct', 'pret', 'attend'];
    /* **Les deux écrans de jeu aussi** (lot 6, reliquat du lot 2). Le Grand
       Virage et le duel gardaient le point rouge d'avant, dans le bouton :
       leur barre flottait à huit pixels du haut et dix du bord, et le
       sticker, qui déborde de neuf pixels au-dessus du bouton et de huit à
       droite — treize et demi avec son bord de craie, son cerne et son
       ombre —, y était rogné par le haut de l'écran. Le HUD de match leur
       laisse maintenant cet air : ses deux boutons sont ses deux bouts, à
       quatorze pixels du haut et du bord (ui.css, `.tbf-haut-jeu` et « le
       HUD de match »). Le bouton y porte donc le sticker de l'état le plus
       urgent, comme partout ailleurs — LIVE, « 2 », « 4 » au lieu d'un point
       qui ne disait ni quoi ni combien —, et ce fichier n'y pose plus rien
       d'autre. La branche qui posait le point est partie avec lui. */
    /* Les porteurs d'état : la bâche des MISSIONS **d'abord**, puis les
       tuiles. Pour deux récompenses prêtes, le bouton prend donc les
       MISSIONS avant les boosters : une mission prête ne se récupère que
       jusqu'à la fin du jour suivant, quand un booster attend dans la
       réserve — et la réserve se lit déjà dans le HUD de la barre, pas les
       missions. */
    const porteurs = () => [...tiroir.querySelectorAll('.tbf-tiroir-missions[data-etat]'),
      ...tiroir.querySelectorAll('.tbf-case[data-etat]')];
    function urgence() {
      const etats = porteurs();
      for (const u of URGENCES) {
        const t = etats.find((n) => n.dataset.etat === u);
        if (!t) continue;
        bouton.dataset.urgence = u;
        /* **Le direct dit LIVE** (reliquat du lot 2). Sans chiffre, le bouton
           ne portait qu'un rond rouge à point de craie : un code qu'il faut
           connaître pour le lire. Le mot est celui du sticker de la tuile du
           Virage, et il s'écrit par le même chemin que les chiffres — la
           feuille pose `data-pastille` sur la face rouge du direct, la craie
           dessus (5,2:1). Trente-trois pixels de large au lieu de vingt-deux :
           il mord sur le bout du premier trait du bouton, que les deux autres
           suffisent à faire lire comme un menu. */
        const texte = t.dataset.pastille || (u === 'direct' ? 'LIVE' : '');
        if (texte) bouton.dataset.pastille = texte;
        else delete bouton.dataset.pastille;
        return;
      }
      delete bouton.dataset.urgence;
      delete bouton.dataset.pastille;
    }
    function poser(href, etat, pastilleTexte) {
      const t = tiroir.querySelector(`.tbf-case[href="${href}"], .tbf-tiroir-missions[href="${href}"]`);
      if (!t) return;
      if (etat) t.dataset.etat = etat; else delete t.dataset.etat;
      if (etat && pastilleTexte != null && pastilleTexte !== '') {
        t.dataset.pastille = String(pastilleTexte);
      } else delete t.dataset.pastille;
      urgence();
    }

    /* Un match des clubs suivis est en cours : sur le bouton pour qu'on le
       voie sans ouvrir, sur la tuile du Virage pour qu'on sache où il mène.

       `mien` : la liste couvre tous les matchs en direct, et un sticker
       allumé en permanence ne prévient plus de rien.

       **Sauf sur les deux écrans qui montrent déjà le match.** L'accueil
       affiche la rencontre en cours dans sa bande du bas, le Grand Virage en
       donne la liste entière : un sticker y dit, sans le nommer, ce que
       l'écran raconte en toutes lettres juste à côté. Et il le dit au prix de
       `/api/virage/live`, la route la plus chère du jeu — demandée une
       seconde fois sur ces deux pages, puisque toutes deux l'appellent déjà
       pour leur propre compte. Un état redondant n'est pas neutre : il coûte
       un aller-retour, et il apprend à ne plus regarder les stickers. */
    /* **Et le monde qui chante, ailleurs** (5 octobre 2026, à la demande de
       Gaël : rien ne disait qu'on jouait au Virage quand ce n'était pas le
       match d'un de ses clubs). La même réponse porte la foule de chaque
       tribune ouverte (`crowd`) : la tuile en dit le total, en violet — ce
       sont des gens —, dans l'état `monde`, qui **ne passe pas au bouton du
       menu** (voir `URGENCES`). Un sticker allumé chaque soir sur le bouton
       a déjà appris à ne plus le regarder ; dans le tiroir, on le lit quand
       on cherche où aller. Le direct d'un club suivi passe devant. Une
       valeur retenue d'avant (un booléen) se lit comme avant. */
    if (!['/', '/virage'].includes(chemin)) {
      void pastille('tbf-etat-virage', '/api/virage/live', (d) => ({
        direct: Boolean(d?.matchs?.some((m) => m.open && m.mien)),
        monde: auVirage(d?.matchs),
      })).then((v) => {
        const direct = v === true || v?.direct === true;
        if (direct) poser('/virage', 'direct');
        else if (v?.monde > 0) poser('/virage', 'monde', v.monde);
      });
    }

    /* Et quand quelqu'un attend un duel. Une file ne vit que deux minutes, le
       temps qu'un joueur est devant son écran : quand elle existe, c'est que
       quelqu'un attend **maintenant**, et le dire est la seule chance qu'il
       trouve du monde. Le sticker dit combien **de duels** attendent un
       joueur (5 octobre 2026) : toutes les files où quelqu'un attend, et non
       plus les seuls présents de la plus pertinente — c'est le nombre que
       l'accueil annonce (« 3 duels attendent un joueur »), et deux nombres
       différents sous le même mot ne se comprendraient pas.

       Même retenue qu'au-dessus, et pour les deux mêmes raisons : l'accueil
       nomme déjà le club qui manque sur son bouton d'entrée — « il manque 2
       supporters de Vissel Kobe », ce qu'un sticker ne dira jamais — et sur
       l'écran du duel, on y est. */
    if (!['/', '/duel-nvn'].includes(chemin)) {
      void pastille('tbf-etat-duel', '/api/nvn/attentes', (d) => {
        const n = duelsEnAttente(d?.attentes);
        return n > 0 ? n : null;
      }).then((n) => {
        if (n) poser('/duel-nvn', 'attend', n);
      });
    }

    /* Les missions à récupérer, lues dans la clé que le hub et l'écran des
       MISSIONS retiennent (contrat R10, voir `missionsDe`) : au montage ;
       après chaque annonce `tbf:bourse` — une réclamation réécrit la clé,
       puis l'annonce, et le sticker suit sans attendre l'écran suivant ; et
       au retour par la flèche du navigateur, qui peut rendre la page telle
       qu'on l'avait quittée, d'avant une réclamation faite ailleurs.

       **Seulement quand la clé a été réécrite.** Le kiosque annonce son état
       chaque seconde le temps que la réserve se recharge ; relire alors une
       clé inchangée retirerait, passé la minute, le sticker qu'on a vu fermé
       sur le bouton et qu'on vient chercher en ouvrant. Pour la même raison,
       l'ouverture du tiroir ne relit rien : rien d'autre qu'une annonce ne
       réécrit la clé pendant qu'une page est ouverte.

       **Pas sur l'écran des MISSIONS**, qui les montre toutes, en grand,
       chacune avec son geste : la même retenue que pour le kiosque (nav.js)
       et pour le direct sur le Virage. Et pas sans joueur connu (`qui`) :
       sur le hub, c'est la page qui pose l'état (voir `poser`, plus haut). */
    const quiMissions = qui == null || qui === '' ? null : String(qui);
    if (quiMissions !== null && chemin !== '/aide') {
      let lu;
      const relireMissions = () => {
        let brut = null;
        try { brut = sessionStorage.getItem(CLE_MISSIONS); } catch { /* fermé : rien de retenu */ }
        if (brut === lu) return;
        lu = brut;
        const n = missionsDe(brut, quiMissions);
        poser('/aide', n > 0 ? 'pret' : null, n);
      };
      relireMissions();
      window.addEventListener('tbf:bourse', relireMissions);
      window.addEventListener('pageshow', (e) => { if (e.persisted) relireMissions(); });
    }

    monte = { tiroir, voile, ouvrir, poser };
    return monte;
  }

  /* **Poser un état sans garder le tiroir sous la main.** Une page ne monte
     qu'un tiroir, et l'accueil appelle `monter` sans retenir ce qu'elle rend :
     `TBF_MENU.poser('/boosters', 'pret', 4)` vaut l'appel sur le tiroir monté,
     et ne fait rien tant qu'aucun ne l'est. Voir `poser`, dans `monter`. */
  const poser = (href, etat, pastilleTexte) => monte?.poser(href, etat, pastilleTexte);

  window.TBF_MENU = { chemin, TITRES, ICONES, MENU, item, monter, poser, suisJeAdmin,
    auVirage, duelsEnAttente };
})();
