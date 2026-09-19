/**
 * Le décor derrière un Fanzzy.
 *
 * ## Pourquoi il existe
 *
 * Les personnages étaient détourés sur du noir. Un dégradé teinté par la
 * famille passait derrière, et c'était tout : le Gamin au Tambour de LA TRIBUNE
 * et le Loup du BESTIAIRE se tenaient devant exactement le même vide, à la
 * nuance de bleu près. Deux cent quatre-vingts personnages, un seul lieu.
 *
 * Or ce jeu raconte **où** les gens se tiennent. Une série est un endroit avant
 * d'être une étagère — la tribune, le comptoir, l'autoroute de nuit, le salon.
 * Un personnage devant son endroit se reconnaît d'un coup d'œil, et la
 * collection cesse d'être une liste pour devenir une galerie.
 *
 * ## Les quatre choses qu'un fond dit
 *
 * Chacune agit sur une couche différente, et elles ne se marchent pas dessus :
 *
 *   1. **La série** décide du *lieu* : la silhouette du décor. C'est la couche
 *      qu'on lit en premier, et la seule qui dessine des formes reconnaissables.
 *   2. **La tenue** décide de l'*époque* : la palette entière bascule. Le même
 *      comptoir en nocturne, en ocre préhistorique ou en cendre apocalyptique.
 *      C'est ce qui fait qu'une tenue se voit **de loin** au lieu de se
 *      chercher sur le costume.
 *   3. **L'âge** décide de la *lumière* : un projecteur au premier, trois au
 *      deuxième, une couronne au troisième. Une légendaire a sa propre lumière,
 *      qui ne se gagne pas — elle se tire.
 *   4. **La famille** décide de l'*accent* : la couleur du halo et un motif
 *      discret — des ondes pour la Voix, des cercles de peau pour la Percussion,
 *      des fanions pour le Tifo.
 *
 * ## Ce qu'il n'est pas
 *
 * Ce n'est pas un dessin d'illustrateur, et ça ne doit pas essayer de l'être :
 * un décor trop chargé vole la vedette au personnage, qui est le sujet. Des
 * aplats, des silhouettes, une lumière. Tout ce qui se lit en un dixième de
 * seconde, rien de plus.
 *
 * Il est **déterministe** : deux appels pour la même carte rendent exactement
 * le même SVG. Sans ça, le fond changerait à chaque rendu de la fiche.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  if (window.TBF_FOND) return;

  /* ------------------------------------------------------------ les palettes

     Une par tenue, et c'est la tenue qui pèse le plus lourd à l'écran. Trois
     couleurs suffisent : le ciel, le sol, et la brume entre les deux.

     Une tenue inconnue — l'administration peut en créer sans livraison — prend
     celle de base. Un décor qui disparaîtrait à la sortie d'une tenue serait
     pire qu'un décor qui ne change pas. */
  const EPOQUES = {
    base:          { haut: '#2B4160', bas: '#070C13', brume: '#6E8CAE' },
    prehistorique: { haut: '#6A4322', bas: '#120A04', brume: '#C08A4E' },
    apocalyptique: { haut: '#4A3A2C', bas: '#0B0806', brume: '#A8845E' },
    nocturne:      { haut: '#1C3055', bas: '#04070E', brume: '#4E74B8' },
    pluie:         { haut: '#33434F', bas: '#080C10', brume: '#7E95A6' },
    derby:         { haut: '#521F26', bas: '#0D0508', brume: '#B04A56' },
    anniv:         { haut: '#3B2C55', bas: '#0A0710', brume: '#8E72C8' },
    promo:         { haut: '#1F4E3C', bas: '#050D0A', brume: '#46A07C' },
    legende:       { haut: '#584512', bas: '#0C0904', brume: '#C8A63A' },
  };

  /** L'accent de chaque famille. Les mêmes six couleurs que partout ailleurs. */
  const FAMILLE = {
    voix: '#F5C33B', perc: '#3C82E8', tifo: '#8257DA',
    pyro: '#E0402C', depl: '#1E9E6A', fide: '#C2CAD6',
  };

  /* ---------------------------------------------------------------- le hasard

     Semé sur l'identifiant : le même personnage a toujours le même décor, et
     deux voisins n'ont jamais le même. `FZART.seeded` fait déjà exactement ça —
     on s'en sert plutôt que d'en écrire un second, qui dériverait. */
  /**
   * Deux couleurs mêlées, pour le ciel d'une légendaire.
   *
   * On **mêle** au lieu de remplacer : une légendaire de LES REVENANTS garde son
   * violet de nuit sous l'or, une légendaire des ÉPOQUES garde son ocre. Un ciel
   * doré identique pour les douze séries effacerait la série au moment précis où
   * la carte est la plus regardée.
   *
   * @param {string} a  couleur d'origine, `#rrggbb`
   * @param {string} b  couleur versée dedans
   * @param {number} t  la part de `b`, de 0 à 1
   */
  const melange = (a, b, t) => {
    const lire = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [r1, g1, b1] = lire(a);
    const [r2, g2, b2] = lire(b);
    const m = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
    return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
  };

  const graine = (cle) => (window.FZART?.seeded?.(cle)
    ?? (() => { let n = 1; return () => (n = (n * 16807) % 2147483647) / 2147483647; })());

  /* ---------------------------------------------------------------- les lieux

     Une fonction par série. Chacune reçoit `(p, r)` — la palette de l'époque et
     le tirage semé — et rend les formes du décor, dans un carré de 100 × 100.

     ## La règle qui les tient toutes

     **Un décor est une silhouette.** Du noir sur un ciel éclairé, plus deux ou
     trois sources de lumière franches. Pas des formes claires posées sur du
     sombre : le premier jet faisait ça, et donnait une bouillie où les gradins,
     la foule et les ondes de la Voix se mélangeaient sans qu'aucun ne se lise.

     C'est aussi ce qu'on voit vraiment dans un stade la nuit — on est dans le
     noir, la lumière est au-dessus.

     ## Deux contraintes de cadre

     Le personnage occupe **le bas**, et il est détouré : tout ce qui doit se
     voir se dessine au-dessus de y = 70, et ce qui est en dessous ne sert qu'à
     lui donner un sol.

     Le cadre est recadré en `slice` : ses bords partent selon la forme du
     conteneur. Rien d'important ne se met à moins de dix unités du bord.

     Elles sont volontairement courtes. Une silhouette qui demande vingt formes
     n'est plus une silhouette. */
  const LIEUX = {
    /* LA TRIBUNE — les gradins en contre-plongée, et la foule en ombre.
       Les rangs sont **noirs**, de plus en plus opaques en descendant : c'est ce
       qui creuse la profondeur sans une seule ligne de perspective. */
    TR: (p, r) => {
      let s = '';
      for (let i = 0; i < 6; i++) {
        const y = 18 + i * 11;
        s += `<rect x="-4" y="${y}" width="108" height="11" fill="#000"
          opacity="${(0.14 + i * 0.09).toFixed(2)}"/>`;
        // La foule assise sur ce rang : de petites têtes alignées sur la marche,
        // jamais régulières. C'est l'irrégularité qui fait la foule.
        for (let k = 0; k < 17; k++) {
          s += `<circle cx="${(1 + k * 6.1 + r() * 2.6).toFixed(1)}" cy="${(y + 2.4).toFixed(1)}"
            r="${(0.95 + r() * 0.5).toFixed(2)}" fill="#000"
            opacity="${(0.3 + i * 0.1).toFixed(2)}"/>`;
        }
      }
      // La main courante, éclairée par en dessous : la seule ligne claire.
      return `${s}<rect x="-4" y="83" width="108" height="1.4" fill="${p.brume}" opacity=".9"/>
        <rect x="-4" y="84.4" width="108" height="16" fill="#000" opacity=".62"/>`;
    },

    /* LES MÉTIERS DU STADE — le couloir de service : deux portes, un néon. */
    MS: (p) => `
      <rect x="-4" y="-4" width="108" height="104" fill="#000" opacity=".42"/>
      <rect x="12" y="14" width="76" height="5" rx="2.5" fill="#EAF2FF" opacity=".85"/>
      <rect x="12" y="19" width="76" height="14" fill="#EAF2FF" opacity=".1"/>
      <rect x="4" y="36" width="24" height="58" fill="#000" opacity=".62"/>
      <rect x="72" y="36" width="24" height="58" fill="#000" opacity=".62"/>
      <rect x="4" y="36" width="24" height="58" fill="none" stroke="${p.brume}"
        stroke-width="1.2" opacity=".5"/>
      <rect x="72" y="36" width="24" height="58" fill="none" stroke="${p.brume}"
        stroke-width="1.2" opacity=".5"/>`,

    /* LE BESTIAIRE DES GRADINS — la rangée de sièges vue de tout près, de nuit.
       Les dossiers font une frise noire : c'est là-dessous qu'on se cache. */
    BG: (p, r) => {
      let s = `<rect x="-4" y="46" width="108" height="54" fill="#000" opacity=".5"/>`;
      for (let i = 0; i < 7; i++) {
        s += `<rect x="${-6 + i * 17}" y="40" width="13" height="24" rx="4"
          fill="#000" opacity=".8"/>`;
      }
      // Les yeux, dans le noir. Deux par paire, et jamais au même endroit.
      for (let i = 0; i < 3; i++) {
        const x = 12 + r() * 72;
        const y = 74 + r() * 14;
        s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${p.brume}"
            opacity=".9"/>
          <circle cx="${(x + 5).toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${p.brume}"
            opacity=".9"/>`;
      }
      return s;
    },

    /* LES REVENANTS — le virage après minuit : des rangs vides, la lune, la brume. */
    RV: (p, r) => {
      let s = `<circle cx="76" cy="20" r="13" fill="#E4EDF8" opacity=".65"/>
        <circle cx="76" cy="20" r="24" fill="#E4EDF8" opacity=".08"/>`;
      for (let i = 0; i < 5; i++) {
        s += `<rect x="-4" y="${34 + i * 12}" width="108" height="12" fill="#000"
          opacity="${(0.2 + i * 0.1).toFixed(2)}"/>`;
      }
      for (let i = 0; i < 4; i++) {
        s += `<ellipse cx="${(10 + r() * 80).toFixed(1)}" cy="${(58 + r() * 34).toFixed(1)}"
          rx="${(22 + r() * 22).toFixed(1)}" ry="6" fill="#C8D8EA" opacity=".13"/>`;
      }
      return s;
    },

    /* CE QUI TRAÎNE AU STADE — le sol de béton après le match, et un plot. */
    OB: (p, r) => {
      let s = `<rect x="-4" y="56" width="108" height="44" fill="#000" opacity=".55"/>
        <polygon points="12,90 21,66 29,66 38,90" fill="#E08A2C" opacity=".8"/>
        <rect x="10" y="88" width="30" height="3" rx="1.5" fill="#E08A2C" opacity=".8"/>`;
      for (let i = 0; i < 12; i++) {
        s += `<rect x="${(4 + r() * 90).toFixed(1)}" y="${(64 + r() * 30).toFixed(1)}"
          width="${(3 + r() * 5).toFixed(1)}" height="1.6" rx=".8"
          transform="rotate(${(r() * 70 - 35).toFixed(0)} 50 80)"
          fill="${p.brume}" opacity=".55"/>`;
      }
      return s;
    },

    /* LES ÉPOQUES — une arche, et derrière elle une lumière qui n'est pas d'ici. */
    EP: (p) => `
      <path d="M16 96 L16 48 a34 26 0 0 1 68 0 L84 96 Z" fill="#EAD9A6" opacity=".22"/>
      <path d="M16 96 L16 48 a34 26 0 0 1 68 0 L84 96 Z" fill="none" stroke="#000"
        stroke-width="7" opacity=".75"/>
      <rect x="-4" y="-4" width="24" height="104" fill="#000" opacity=".72"/>
      <rect x="80" y="-4" width="24" height="104" fill="#000" opacity=".72"/>
      <rect x="34" y="60" width="32" height="40" fill="#EAD9A6" opacity=".14"/>`,

    /* LE VIRAGE IMPOSSIBLE — une faille dans le ciel. Rien n'est droit. */
    IM: (p, r) => {
      let d = 'M50 -4';
      for (let i = 1; i <= 8; i++) {
        d += ` L${(50 + (r() * 30 - 15)).toFixed(1)} ${-4 + i * 13}`;
      }
      return `<rect x="-4" y="-4" width="108" height="104" fill="#000" opacity=".34"/>
        <path d="${d}" stroke="#C9A7FF" stroke-width="16" fill="none" opacity=".12"/>
        <path d="${d}" stroke="#DCC6FF" stroke-width="2.6" fill="none" opacity=".9"/>
        <rect x="-4" y="86" width="108" height="14" fill="#000" opacity=".6"/>`;
    },

    /* LES VIP — la loge : la baie vitrée éclairée, le lustre, la nappe. */
    VP: (p) => `
      <rect x="-4" y="-4" width="108" height="104" fill="#000" opacity=".6"/>
      <rect x="8" y="14" width="84" height="52" fill="#9FC4EA" opacity=".3"/>
      <rect x="8" y="14" width="84" height="52" fill="none" stroke="#000"
        stroke-width="4" opacity=".8"/>
      <line x1="50" y1="14" x2="50" y2="66" stroke="#000" stroke-width="3" opacity=".8"/>
      <circle cx="50" cy="8" r="6" fill="#F5C33B" opacity=".85"/>
      <circle cx="50" cy="8" r="15" fill="#F5C33B" opacity=".14"/>
      <rect x="-4" y="76" width="108" height="24" fill="#F2EEE4" opacity=".3"/>`,

    /* LA GASTRONOMIE DE COMPTOIR — le zinc éclairé, la tireuse, les gobelets. */
    GC: (p, r) => {
      let s = `<rect x="-4" y="-4" width="108" height="104" fill="#000" opacity=".55"/>
        <rect x="-4" y="66" width="108" height="5" fill="#DCE4EE" opacity=".55"/>
        <rect x="-4" y="71" width="108" height="29" fill="#000" opacity=".7"/>
        <rect x="70" y="40" width="7" height="26" rx="2.5" fill="#000" opacity=".85"/>
        <rect x="64" y="34" width="19" height="7" rx="3" fill="#000" opacity=".85"/>
        <rect x="10" y="10" width="80" height="4" rx="2" fill="#F5C33B" opacity=".55"/>`;
      for (let i = 0; i < 5; i++) {
        s += `<rect x="${(8 + i * 12 + r() * 3).toFixed(1)}" y="56" width="8" height="10"
          rx="1.5" fill="#F2EEE4" opacity=".4"/>`;
      }
      return s;
    },

    /* LES GALÈRES DE DÉPLACEMENT — l'autoroute de nuit : la bande, les lampadaires. */
    GD: (p, r) => {
      let s = `<rect x="-4" y="52" width="108" height="48" fill="#000" opacity=".68"/>
        <polygon points="28,100 72,100 57,52 43,52" fill="#F2EEE4" opacity=".07"/>`;
      for (let i = 0; i < 6; i++) {
        const y = 54 + i * 8;
        const w = 1.2 + i * 0.9;
        s += `<rect x="${(50 - w / 2).toFixed(1)}" y="${y}" width="${w.toFixed(1)}"
          height="${(3 + i * 1.2).toFixed(1)}" fill="#F2EEE4" opacity=".75"/>`;
      }
      for (let i = 0; i < 3; i++) {
        const x = 10 + i * 36 + r() * 6;
        s += `<rect x="${x.toFixed(1)}" y="14" width="2" height="40" fill="#000" opacity=".85"/>
          <circle cx="${(x + 1).toFixed(1)}" cy="14" r="3.6" fill="#F5C33B" opacity=".9"/>
          <circle cx="${(x + 1).toFixed(1)}" cy="14" r="11" fill="#F5C33B" opacity=".13"/>`;
      }
      return s;
    },

    /* LES PHÉNOMÈNES MÉTÉO — le ciel seul. Des nuages bas, et la pluie de biais. */
    MT: (p, r) => {
      let s = '';
      for (let i = 0; i < 5; i++) {
        s += `<ellipse cx="${(8 + r() * 84).toFixed(1)}" cy="${(12 + r() * 30).toFixed(1)}"
          rx="${(22 + r() * 20).toFixed(1)}" ry="${(7 + r() * 5).toFixed(1)}"
          fill="#000" opacity=".5"/>`;
      }
      for (let i = 0; i < 30; i++) {
        const x = r() * 108 - 4;
        const y = 14 + r() * 80;
        s += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}"
          x2="${(x + 8).toFixed(1)}" y2="${(y + 5).toFixed(1)}"
          stroke="#DCEAF8" stroke-width="1.1" opacity=".5"/>`;
      }
      return `${s}<rect x="-4" y="88" width="108" height="12" fill="#000" opacity=".55"/>`;
    },

    /* LES HÉROS DU CANAPÉ — le salon, la nuit : l'écran est la seule lumière. */
    HC: (p) => `
      <rect x="-4" y="-4" width="108" height="104" fill="#000" opacity=".68"/>
      <polygon points="20,54 80,54 104,100 -4,100" fill="#9FC4EA" opacity=".13"/>
      <rect x="20" y="16" width="60" height="38" rx="3" fill="#9FC4EA" opacity=".5"/>
      <rect x="20" y="16" width="60" height="38" rx="3" fill="none" stroke="#000"
        stroke-width="4" opacity=".85"/>
      <rect x="-6" y="74" width="112" height="26" rx="8" fill="#000" opacity=".85"/>
      <circle cx="90" cy="42" r="5" fill="#F5C33B" opacity=".8"/>
      <circle cx="90" cy="42" r="14" fill="#F5C33B" opacity=".13"/>`,
  };

  /* Une série inconnue — il en arrive — prend les gradins. C'est le lieu le plus
     neutre du jeu, et il ne ment sur rien. */
  const lieu = (set) => LIEUX[set] ?? LIEUX.TR;

  /* ------------------------------------------------------------- les motifs

     L'accent de famille, en fond très discret. Il ne doit pas se lire comme une
     forme : c'est une texture qui teinte, et qui donne à deux Fanzzy de la même
     famille un air de parenté sans qu'on sache dire pourquoi. */
  const MOTIFS = {
    // La Voix : des ondes concentriques qui partent de la bouche du personnage.
    voix: (c) => [1, 2, 3].map((i) => `<circle cx="50" cy="72" r="${14 + i * 13}"
      fill="none" stroke="${c}" stroke-width="1.2" opacity="${(0.13 - i * 0.03).toFixed(2)}"/>`).join(''),
    // La Percussion : la peau du tambour, frappée au centre.
    perc: (c) => [1, 2, 3, 4].map((i) => `<ellipse cx="50" cy="80" rx="${10 + i * 12}"
      ry="${(4 + i * 4).toFixed(1)}" fill="none" stroke="${c}" stroke-width="1"
      opacity="${(0.14 - i * 0.026).toFixed(3)}"/>`).join(''),
    // Le Tifo : des fanions en guirlande, tout en haut.
    tifo: (c) => [0, 1, 2, 3, 4, 5, 6].map((i) => `<polygon
      points="${i * 16},4 ${i * 16 + 12},4 ${i * 16 + 6},16" fill="${c}" opacity=".2"/>`).join(''),
    // La Pyro : la fumée qui monte, en volutes larges.
    pyro: (c) => [0, 1, 2].map((i) => `<ellipse cx="${24 + i * 26}" cy="${34 + i * 9}"
      rx="${16 + i * 5}" ry="${11 + i * 4}" fill="${c}" opacity=".1"/>`).join(''),
    // Le Déplacement : l'écharpe tendue, en travers.
    depl: (c) => `<path d="M-6 58 q26 -16 52 0 t52 0" fill="none" stroke="${c}"
      stroke-width="8" opacity=".11" stroke-linecap="round"/>`,
    // La Fidélité : les rayures du maillot, verticales et régulières.
    fide: (c) => [0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 18}" y="-4" width="7"
      height="108" fill="${c}" opacity=".07"/>`).join(''),
  };

  /* ------------------------------------------------------------- la lumière

     L'âge, et rien d'autre. Elle se lit tout de suite parce qu'elle change la
     quantité de lumière dans le cadre, pas sa forme.

     Une légendaire n'a pas d'âge : elle a sa lumière à elle, la couronne dorée,
     et c'est le seul endroit du décor où la famille ne décide pas de la
     couleur. Une légendaire est dorée parce qu'elle est légendaire. */
  /**
   * La gloire d'une légendaire.
   *
   * Elle avait un halo doré, un anneau fin et huit pastilles. C'était juste, et
   * ça ne se voyait pas : à la taille d'une vignette de classeur, un anneau à
   * trente pour cent d'opacité sur du noir est du noir. Une légendaire tombe
   * une fois sur vingt boosters, et le décor ne le disait pas.
   *
   * Ce qui le dit, c'est **la gloire** — l'éventail de rayons qui part de
   * derrière le personnage. C'est le vocabulaire de l'apparition, il se lit à
   * quarante pixels comme à quatre cents, et aucune autre carte du jeu n'en a.
   *
   * Vingt-quatre rayons, larges au bord et pointus au centre, d'opacité
   * alternée : l'alternance suffit à donner l'impression que la lumière tourne,
   * sans une seule animation. C'est important — ce décor est dessiné vingt fois
   * sur une grille, et vingt rotations coûteraient une page qui rame pour un
   * effet que personne ne regarde.
   *
   * Le reste monte d'un cran : le halo passe de 34 % à 55 %, l'anneau devient
   * double, et les éclats sont vingt au lieu de huit, de tailles inégales.
   */
  /**
   * Ce que chaque rareté ajoute au décor.
   *
   * ## Le défaut qu'on corrige
   *
   * La montée en puissance existait — « un projecteur au premier âge, trois au
   * troisième » — mais elle suivait l'**âge**, pas la rareté, et son amplitude
   * tenait dans quelques centièmes d'opacité. Une commune, une rare et une
   * épique se tenaient devant exactement le même fond : seule la légendaire
   * avait sa lumière. Trois quarts du catalogue ne se distinguaient donc que
   * par la couleur d'un liseré de cadre, à côté de la carte, et pas du tout
   * quand on regardait le personnage.
   *
   * Or la rareté **est** la progression dans ce jeu : elle suit le stade, et le
   * stade s'achète en écharpes. Ce qu'on paie doit se voir.
   *
   * ## Ce que ça ne dit pas
   *
   * Rien sur la puissance. Voir `shared/niveau.js` : le niveau ne donne
   * aucune puissance, et la rareté pas davantage — elle dit d'où vient le
   * personnage et ce qu'on a mis dedans. Un décor plus riche est du **confort**,
   * au sens où l'abonnement l'entend, pas un avantage.
   *
   * ## Pourquoi c'est dessiné et non peint
   *
   * Un fond peint par série et par rareté ferait cinquante-deux images, quatre
   * de plus à chaque saison, et surtout il ne saurait pas changer d'époque avec
   * la tenue — ce que la palette fait ici en une ligne. Le décor reste dessiné
   * par le jeu, comme le dit `fanzzy-invites.mjs` : il ne vient jamais de
   * l'image.
   *
   * `halo` est l'aura derrière le personnage, `anneaux` le nombre de cercles
   * qui l'entourent, `poussiere` les éclats en suspension, `ciel` de combien on
   * éclaircit le haut. Quatre chiffres, quatre marches qu'on distingue de loin.
   */
  /**
   * Les décors peints disponibles, en `<SÉRIE>-<rareté>`.
   *
   * Réécrite par `scripts/fonds-images.mjs` — ne pas modifier à la main, comme
   * la liste ILLUSTRES de `fanzzy-art.js`. Une entrée qui ne correspond à aucun
   * fichier ferait un décor vide, c'est-à-dire pire que pas de décor du tout.
   */
  const FONDS = new Set([
    'RP-commune',
    'RP-epique',
    'RP-legendaire',
    'RP-rare',
  ]);

  /**
   * L'adresse de la plaque d'une carte, ou `null` s'il faut la dessiner.
   *
   * **Seulement sur la tenue de base**, et c'est la condition qui compte. Une
   * tenue fait basculer toute la palette du décor : le même lieu en nocturne,
   * en ocre préhistorique, en cendre apocalyptique. C'est ce qui rend une tenue
   * visible de loin, au lieu de se chercher sur le costume. Une plaque peinte
   * en fin d'été ne devient pas préhistorique — la poser sous une tenue qui
   * l'est ferait mentir la seule chose qu'on voit.
   *
   * Le format suit `TBF_ETATS.EXT` comme le reste des images du jeu, et le
   * serveur sert l'AVIF à qui l'accepte — voir `src/server/images/index.js`.
   */
  function plaque(set, rar, skin) {
    if (skin && skin !== 'base') return null;
    const cle = `${set}-${rar ?? 'commune'}`;
    if (!FONDS.has(cle)) return null;
    const ext = window.TBF_ETATS?.EXT ?? '.webp';
    return `/img/fonds/${cle}${ext}`;
  }

  const PALIERS = {
    commune:    { halo: 0.00, anneaux: 0, poussiere: 0,  ciel: 0,    teinte: null },
    rare:       { halo: 0.16, anneaux: 1, poussiere: 6,  ciel: 0.10, teinte: '#5FA8FF' },
    epique:     { halo: 0.30, anneaux: 2, poussiere: 14, ciel: 0.18, teinte: '#B98CFF' },
    legendaire: { halo: 0.42, anneaux: 3, poussiere: 22, ciel: 0.26, teinte: '#F5C33B' },
  };
  const palier = (rar) => PALIERS[rar] ?? PALIERS.commune;

  /**
   * L'aura : un disque derrière le personnage, des anneaux, de la poussière.
   *
   * Elle est **centrée sur le buste** et non sur le cadre — c'est le
   * personnage qu'elle auréole, pas le décor. Sans ça elle se lisait comme une
   * tache de lumière au sol.
   *
   * Déterministe, comme tout le module : la poussière est semée par la graine
   * du personnage, donc deux épiques n'ont pas la même, et la même carte a
   * toujours la sienne.
   */
  function aura(rar, u, r) {
    const P = palier(rar);
    if (!P.halo) return '';
    const c = P.teinte;
    const anneaux = Array.from({ length: P.anneaux }, (_, i) => `<circle cx="50" cy="62"
      r="${(30 + i * 9).toFixed(1)}" fill="none" stroke="${c}"
      stroke-width="${(1.1 - i * 0.28).toFixed(2)}"
      opacity="${(P.halo * (0.62 - i * 0.14)).toFixed(3)}"/>`).join('');
    const poussiere = Array.from({ length: P.poussiere }, () => {
      const a = r() * Math.PI * 2;
      const d = 22 + r() * 40;
      return `<circle cx="${(50 + Math.cos(a) * d).toFixed(1)}"
        cy="${(62 + Math.sin(a) * d * 0.92).toFixed(1)}"
        r="${(0.5 + r() * 1.5).toFixed(1)}" fill="${c}"
        opacity="${(0.25 + r() * 0.45).toFixed(2)}"/>`;
    }).join('');
    return `<circle cx="50" cy="62" r="46" fill="url(#au${u})"/>${anneaux}${poussiere}`;
  }

  function lumiere(stage, legendaire, accent, u, r) {
    if (legendaire) {
      const RAYONS = 24;
      const gloire = Array.from({ length: RAYONS }, (_, i) => {
        const a = (i / RAYONS) * Math.PI * 2;
        const b = ((i + 0.42) / RAYONS) * Math.PI * 2;
        // Du centre vers le bord : deux points loin, un point près. Un triangle
        // fin, donc, et non un secteur — un secteur ferait un disque strié.
        const x1 = (50 + Math.cos(a) * 72).toFixed(1);
        const y1 = (74 + Math.sin(a) * 72).toFixed(1);
        const x2 = (50 + Math.cos(b) * 72).toFixed(1);
        const y2 = (74 + Math.sin(b) * 72).toFixed(1);
        return `<path d="M50 74L${x1} ${y1}L${x2} ${y2}Z" fill="#F5C33B"
          opacity="${i % 2 ? '.075' : '.04'}"/>`;
      }).join('');

      /* Les éclats. Semés par la graine du personnage : deux légendaires n'ont
         pas la même poussière, et c'est ce qui empêche le décor de se lire
         comme un gabarit. */
      const eclats = Array.from({ length: 20 }, () => {
        const a = r() * Math.PI * 2;
        const d = 26 + r() * 44;
        return `<circle cx="${(50 + Math.cos(a) * d).toFixed(1)}"
          cy="${(74 + Math.sin(a) * d * 0.9).toFixed(1)}"
          r="${(0.7 + r() * 1.8).toFixed(1)}" fill="#FFE596"
          opacity="${(0.35 + r() * 0.45).toFixed(2)}"/>`;
      }).join('');

      return `<g opacity=".9">${gloire}</g>
        <circle cx="50" cy="74" r="62" fill="url(#or${u})"/>
        <circle cx="50" cy="74" r="41" fill="none" stroke="#FFE596" stroke-width="0.7"
          opacity=".45"/>
        <circle cx="50" cy="74" r="37" fill="none" stroke="#F5C33B" stroke-width="1.6"
          opacity=".26"/>
        ${eclats}`;
    }
    const n = Math.min(3, Math.max(1, Number(stage) || 1));
    // Un projecteur au premier âge, trois au troisième. Ils s'écartent en
    // s'ajoutant : le personnage passe d'éclairé à cerné.
    const xs = n === 1 ? [50] : n === 2 ? [30, 70] : [22, 50, 78];
    return xs.map((x) => `<ellipse cx="${x}" cy="${70 - (3 - n) * 4}"
      rx="${34 - n * 3}" ry="${44 - n * 3}" fill="${accent}"
      opacity="${(0.04 + n * 0.028).toFixed(3)}"/>`).join('')
      + `<circle cx="50" cy="88" r="${24 + n * 7}" fill="url(#h${u})"/>`;
  }

  let uid = 0;

  /**
   * Le décor d'un Fanzzy, en SVG.
   *
   * @param {object} f
   * @param {string} f.id     l'identifiant, qui sème le hasard
   * @param {string} f.set    la série — le lieu
   * @param {string} f.type   la famille — l'accent et le motif
   * @param {number} f.stage  l'âge, 1 à 3 — la lumière
   * @param {string} f.rar    la rareté ; `legendaire` a sa propre lumière
   * @param {string} [f.skin] la tenue — l'époque, donc la palette
   * @returns {string} un SVG complet, prêt à poser dans un conteneur
   */
  function fond(f = {}) {
    const p = EPOQUES[f.skin || 'base'] ?? EPOQUES.base;
    const accent = FAMILLE[f.type] ?? '#F5C33B';
    const u = 'fd' + (uid++);
    const r = graine(`${f.id ?? 'x'}|${f.set ?? ''}|${f.skin ?? 'base'}`);
    const legendaire = f.rar === 'legendaire';
    /* **La plaque remplace le lieu, pas le reste.** Le motif de famille, la
       lumière de l'âge et l'aura de rareté se posent par-dessus comme avant :
       c'est ce qui garde une carte peinte et une carte dessinée dans le même
       jeu, au lieu d'en faire deux collections. */
    const peint = plaque(f.set, f.rar, f.skin);

    /* **Le cadre est en portrait, et c'est la correction la plus importante du
       module.**

       Il était carré. Avec `slice`, un carré posé dans une vitrine de 370 × 565
       s'agrandit pour couvrir : le facteur d'échelle est 5,65, et on ne voit
       plus que les deux tiers du milieu. Chaque forme sortait donc une fois et
       demie trop grosse — les têtes de la foule, dessinées à trois unités de
       diamètre, arrivaient en pastilles de dix-sept pixels, et les gradins en
       bandes de soixante. Le décor n'était pas mal dessiné : il était trop
       gros pour qu'on le reconnaisse.

       En 100 × 150, le facteur tombe à 3,8 et le cadre entier se voit. Les
       lieux restent dessinés dans leur carré d'origine — leur code n'a pas
       bougé — et sont posés **en bas** : le demi-cadre gagné au-dessus est du
       ciel, ce qu'un cadrage en portrait demande de toute façon. */
    return `<svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="c${u}" x1="0" y1="0" x2="0" y2="1">
          <!-- Le ciel monte d'un cran à chaque palier : c'est ce qui se voit en
               vignette, à vingt pixels, là où l'aura est trop fine. -->
          <stop offset="0" stop-color="${legendaire ? melange(p.haut, '#6A4E12', 0.5)
            : palier(f.rar).teinte ? melange(p.haut, palier(f.rar).teinte, palier(f.rar).ciel)
            : p.haut}"/>
          <stop offset="1" stop-color="${legendaire ? melange(p.bas, '#241A05', 0.45) : p.bas}"/>
        </linearGradient>
        <radialGradient id="h${u}">
          <stop offset="0" stop-color="${accent}" stop-opacity=".3"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
        </radialGradient>
        <!-- L'aura de rareté. Transparente au bord : elle doit **fondre** dans
             le ciel, sinon elle se lit comme un disque posé dessus. -->
        <radialGradient id="au${u}">
          <stop offset="0" stop-color="${palier(f.rar).teinte ?? accent}" stop-opacity="${
            (palier(f.rar).halo * 0.55).toFixed(3)}"/>
          <stop offset=".6" stop-color="${palier(f.rar).teinte ?? accent}" stop-opacity="${
            (palier(f.rar).halo * 0.18).toFixed(3)}"/>
          <stop offset="1" stop-color="${palier(f.rar).teinte ?? accent}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="or${u}">
          <stop offset="0" stop-color="#FFE596" stop-opacity=".42"/>
          <stop offset=".55" stop-color="#F5C33B" stop-opacity=".2"/>
          <stop offset="1" stop-color="#F5C33B" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <!-- L'ordre des couches, et il compte.

           1. **Le ciel**, éclairé, du haut vers le bas. C'est la seule surface
              claire du décor ; tout le reste s'y découpe.
           2. **Le lieu**, en silhouette noire. Il mange le ciel.
           3. **Le motif de famille**, par-dessus la silhouette et non dessous.
              Dessous, il disparaissait entièrement derrière les aplats noirs —
              c'était le cas au premier jet, et la famille ne se voyait plus.
           4. **La lumière de l'âge**, par-dessus tout : elle éclaire la scène,
              elle n'en fait pas partie.
           5. **Le pied d'ombre**, en dernier, qui pose le personnage au sol. -->
      ${peint
        ? `<image href="${peint}" x="-4" y="-4" width="108" height="158"
             preserveAspectRatio="xMidYMid slice"/>`
        : `<rect x="-4" y="-4" width="108" height="158" fill="url(#c${u})"/>`}
      <g transform="translate(0,50)">
        ${peint ? '' : lieu(f.set)(p, r)}
        ${(MOTIFS[f.type] ?? (() => ''))(accent)}
        ${lumiere(f.stage, legendaire, accent, u, r)}
        <!-- L'aura de rareté vient **après** la lumière d'âge : les deux
             s'additionnent, et c'est voulu — une épique au troisième âge doit
             écraser une épique au premier, sans cesser d'être une épique. -->
        ${aura(f.rar, u, r)}
        <!-- Le pied d'ombre. Sans lui le personnage flotte : il est détouré,
             donc rien ne le rattache au sol du décor. -->
        <ellipse cx="50" cy="97" rx="30" ry="5" fill="#000" opacity=".5"/>
      </g>
    </svg>`;
  }

  /** Pose le décor dans un conteneur, devant lequel le personnage se dessine. */
  function poser(el, f) {
    if (!el) return;
    let n = el.querySelector(':scope > .tbf-fond');
    if (!n) {
      n = document.createElement('div');
      n.className = 'tbf-fond';
      el.prepend(n);
    }
    n.innerHTML = fond(f);
  }

  window.TBF_FOND = { fond, poser, EPOQUES, FAMILLE, LIEUX };
})();
