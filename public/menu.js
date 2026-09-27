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
 * l'entrée d'administration et la pastille du direct vivent donc ici, et nulle
 * part ailleurs. `nav.js` l'appelle pour les pages de contenu ; l'accueil
 * l'appelle pour lui-même. Le jour où une entrée change, elle change une fois.
 *
 * ## Ce que ce fichier ne fait pas
 *
 * Il ne pose pas de barre du haut, pas de décor, pas de bouton. Il reçoit le
 * bouton que la page a déjà dessiné — chaque page a le sien, et celui de
 * l'accueil est une plaque qui suit la hauteur de sa rangée. Ce fichier
 * branche l'ouverture, remplit le tiroir et gère la sortie.
 *
 * L'apparence vit dans `ui.css` (`.tbf-tiroir`, `.tbf-rubrique`, `.tbf-voile`).
 */
(() => {
  const chemin = location.pathname.replace(/\/$/, '') || '/';

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
    '/profil': 'Profil', '/compte': 'Compte', '/aide': 'Aide',
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
    compte: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6M12 3v3M12 18v3M3 12h3M18 12h3',
    admin: 'M12 3l7 3v5c0 4.4-2.9 8.2-7 10-4.1-1.8-7-5.6-7-10V6zM9 12l2 2 4-4',
    sortie: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 8l-4 4 4 4M6 12h9',
    // Un panier : deux roues et une anse. Reconnaissable à vingt pixels.
    boutique: 'M6 6h15l-1.5 9h-12zM6 6L5 3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
    // Un paquet fermé, avec sa bande à déchirer en haut.
    pack: 'M4 8h16v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 8l1.5-4h13L20 8M9 4v4M15 4v4',
    // Une flèche vers la gauche, pour rentrer. Volontairement pas un chevron
    // seul : à quarante pixels, un chevron se confond avec un bouton de repli.
    retour: 'M15 5l-7 7 7 7',
    // Un point d'interrogation dans un cercle. Le plus banal des pictogrammes,
    // et c'est exactement la raison de le garder : celui-là doit se reconnaître
    // sans apprentissage, par quelqu'un qui cherche déjà quelque chose.
    aide: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M9.4 9.3a2.6 2.6 0 1 1 3.2 2.5c-.7.2-1.1.8-1.1 1.5v.6M12 17.2h.01',
    // Un métronome : le socle, la tige, le poids. Le seul objet du jeu qui ne
    // serve qu'à s'exercer — et il dit le rythme, qui est ce que la moitié des
    // gestes demandent.
    repetition: 'M9 21h6l-1.2-15h-3.6zM7 21h10M12 6v9M10.4 12h3.2',
  };

  /**
   * Les destinations, en rubriques.
   *
   * Onze destinations à plat, c'est un mur. Rangées par ce qu'on vient y
   * faire — jouer, collectionner, suivre le football — on retrouve la sienne
   * sans lire les autres. L'ordre à l'intérieur d'une rubrique est celui de
   * la fréquence, pas de l'alphabet.
   */
  const MENU = [
    { titre: 'JOUER', liens: [
      ['/virage', 'virage', 'Le Grand Virage'],
      ['/duel-nvn', 'duel', 'Duel de tribunes'],
      // Le KOP est au centre du jeu : il ouvre la rubrique de ce qu'on fait à
      // plusieurs, et il n'est plus derrière un second menu.
      ['/kop', 'kop', 'Mon KOP'],
      ['/deck', 'deck', 'Mon deck'],
      ['/boosters', 'pack', 'Mes boosters'],
      ['/boutique', 'boutique', 'La boutique'],
      /* Juste après la boutique, et pas ailleurs : c'est le même geste — on
         vient dépenser. Il manquait, et la seule façon d'atteindre l'écran de
         l'abonnement était de connaître son adresse. */
      ['/abonnement', 'boutique', 'L’abonnement'],
      /* Dernière de JOUER, et bien dans JOUER : on y va pour jouer, pas parce
         qu'on est perdu. Après les deux écrans qu'elle prépare et jamais avant
         eux — ce n'est pas une étape à franchir pour entrer au Virage, c'est
         un endroit où revenir quand un geste résiste. */
      ['/repetition', 'repetition', 'La répétition'],
    ] },
    { titre: 'MA COLLECTION', liens: [
      /* **Elle n'était dans aucun menu.** L'en-tête de ce fichier promet « la
         seule liste des destinations du jeu », et `menu-smoke.mjs` le redit :
         « ce qui n'y est pas n'existe pas ». La collection n'y était pas. On
         ne pouvait l'atteindre que par une carte de l'accueil — donc jamais
         depuis les vingt-trois autres écrans, et jamais du tout pour qui ne
         l'avait pas remarquée là.

         En tête de la rubrique parce qu'elle la résume : elle compte tout ce
         qui se gagne, Fanzzy compris, quand les trois autres entrées n'en
         montrent chacune qu'une part. */
      ['/collection', 'collection', 'Ma collection'],
      ['/fanzzy', 'fanzzy', 'Mes Fanzzy'],
      ['/carnet', 'carnet', 'Mon carnet'],
      ['/amis', 'amis', 'Mes amis'],
    ] },
    { titre: 'LE FOOTBALL', liens: [
      ['/matchs', 'teletext', 'Les matchs du jour'],
      ['/equipes', 'clubs', 'Mes clubs'],
      ['/teletext', 'teletext', 'Toutes les compétitions'],
      ['/classement', 'classement', 'Classement des supporters'],
    ] },
  ];

  const item = (href, cle, texte, classe = '') =>
    `<a href="${href}" class="${classe}"><svg viewBox="0 0 24 24"><path d="${ICONES[cle]}"/></svg>${texte}</a>`;

  /* Une seule interrogation du serveur pour toute la page, quel que soit le
     nombre d'appelants. L'accueil demandait `role` à `/api/auth/me` pendant
     que `nav.js` demandait `/api/admin/suis-je` : deux sources pour la même
     question, et `estAdmin` est celle qui fait foi côté serveur. */
  let promesseAdmin = null;
  const suisJeAdmin = () => {
    promesseAdmin ??= fetch('/api/admin/suis-je', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { admin: false }))
      .then((j) => Boolean(j.admin))
      .catch(() => false);
    return promesseAdmin;
  };

  /**
   * Monte le tiroir et le branche sur un bouton déjà dessiné par la page.
   *
   * @param {HTMLElement} bouton le bouton « menu » de la page.
   * @returns {{tiroir: HTMLElement, voile: HTMLElement, ouvrir: (oui:boolean)=>void}}
   */
  function monter(bouton) {
    const tiroir = document.createElement('nav');
    tiroir.id = 'tbf-tiroir';
    tiroir.className = 'tbf-tiroir';
    tiroir.setAttribute('aria-label', 'Le reste du jeu');
    tiroir.hidden = true;

    /* La page où l'on est se marque, et ne se propose pas.
       Sans ça le menu offre d'aller là où on est déjà, ce qui est le meilleur
       moyen de faire douter quelqu'un de l'endroit où il se trouve. */
    const ici = (href) => chemin === href;

    tiroir.innerHTML = `<a class="tbf-tiroir-ici${chemin === '/' ? ' on' : ''}" href="/"
        ><svg viewBox="0 0 24 24"><path d="${ICONES.accueil}"/></svg>L’accueil</a>`
      + MENU.map((r) => `<div class="tbf-rubrique">${r.titre}</div>`
        + r.liens.map(([href, cle, texte]) =>
          item(href, cle, texte, ici(href) ? 'on' : '')).join('')).join('')
      + '<hr>'
      /* En tête du pied, avant le profil et le compte : c'est la seule entrée
         qu'on cherche **parce qu'on est perdu**, et quelqu'un de perdu ne lit
         pas un menu jusqu'au bout. Elle ne rejoint pas les rubriques du
         dessus : elles disent où l'on joue, celle-ci dit comment. */
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
      + item('/aide', 'aide', 'Aide et premiers pas', ici('/aide') ? 'on' : '')
      + item('/profil', 'profil', 'Mon profil', ici('/profil') ? 'on' : '')
      + item('/compte', 'compte', 'Mon compte', ici('/compte') ? 'on' : '')
      + item('#', 'sortie', 'Se déconnecter', 'sortie')
      /* **La version, tout en bas, et sur toutes les pages.**

         Un joueur qui signale un défaut décrit ce qu'il voit ; il ne peut pas
         dire sur quelle version il le voit. Sans ce numéro, chaque retour
         commence par « as-tu rechargé ? » — une question qui fait porter au
         joueur la charge de notre déploiement.

         Et le mot **bêta** n'est pas de la modestie : il prévient que les
         soldes peuvent bouger et qu'une saison peut être rejouée. Un joueur
         prévenu pardonne, un joueur surpris s'en va.

         Le tiroir est le seul élément présent sur **toutes** les pages —
         c'est déjà pour ça que la marque d'abonnement y vit. */
      + '<div class="tbf-version" id="tbf-version"></div>';

    const voile = document.createElement('div');
    voile.className = 'tbf-voile';
    document.body.append(tiroir, voile);

    bouton.setAttribute('aria-controls', 'tbf-tiroir');
    bouton.setAttribute('aria-expanded', 'false');

    const ouvrir = (oui) => {
      // `hidden` et la classe : la classe anime, l'attribut sort vraiment le
      // menu de l'ordre de tabulation. Sans lui, la tabulation traverse un
      // menu invisible.
      if (oui) tiroir.hidden = false;
      requestAnimationFrame(() => {
        tiroir.classList.toggle('on', oui);
        voile.classList.toggle('on', oui);
        bouton.setAttribute('aria-expanded', String(oui));
        if (!oui) {
          setTimeout(() => { if (!tiroir.classList.contains('on')) tiroir.hidden = true; }, 200);
        }
      });
    };
    /* L'état de l'abonnement, demandé une fois et sans bloquer.
       *
       * Sous garde entière : cette route peut ne pas être montée, la table
       * peut manquer, le joueur peut ne pas être connecté. Dans tous ces cas
       * la marque reste cachée — c'est exactement ce qu'elle doit faire, et
       * un menu ne tombe pas parce qu'un abonnement est injoignable. */
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

    void (async () => {
      try {
        const r = await fetch('/api/abonnement', { credentials: 'same-origin' });
        if (!r.ok) return;
        const a = await r.json();
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

    bouton.addEventListener('click', () => ouvrir(!tiroir.classList.contains('on')));
    voile.addEventListener('click', () => ouvrir(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ouvrir(false); });

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
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
      catch { /* hors ligne : on recharge quand même, la session locale ne sert plus */ }
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
    async function pastille(cle, url, decide) {
      try {
        const vu = JSON.parse(sessionStorage.getItem(cle) || 'null');
        if (vu && Date.now() - vu.t < DUREE_PASTILLE) return vu.on;
      } catch { /* pas de mémoire ici : on demande, comme avant */ }
      let on = false;
      try {
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) return false;
        on = Boolean(decide(await r.json()));
      } catch { return false; }
      try { sessionStorage.setItem(cle, JSON.stringify({ t: Date.now(), on })); }
      catch { /* tant pis : on redemandera */ }
      return on;
    }

    /* Un match des clubs suivis est en cours : sur le bouton pour qu'on la voie
       sans ouvrir, sur la ligne du Virage pour qu'on sache où elle mène.

       `mien` : la liste couvre tous les matchs en direct, et une pastille
       allumée en permanence ne prévient plus de rien.

       **Sauf sur les deux écrans qui montrent déjà le match.** L'accueil
       affiche la rencontre en cours dans sa bande du bas, le Grand Virage en
       donne la liste entière : une pastille y dit, en six pixels et sans le
       nommer, ce que l'écran raconte en toutes lettres juste à côté. Et elle le
       dit au prix de `/api/virage/live`, la route la plus chère du jeu —
       demandée une seconde fois sur ces deux pages, puisque toutes deux
       l'appellent déjà pour leur propre compte. Une pastille redondante n'est
       pas neutre : elle coûte un aller-retour, et elle apprend à ne plus
       regarder les pastilles. */
    if (!['/', '/virage'].includes(chemin)) {
      void pastille('tbf-pip-virage', '/api/virage/live',
        (d) => d?.matchs?.some((m) => m.open && m.mien)).then((on) => {
        if (!on) return;
        bouton.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
        tiroir.querySelector('a[href="/virage"]')
          ?.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
      });
    }

    /* Et la même pastille quand quelqu'un attend un duel. Une file ne vit que
       deux minutes, le temps qu'un joueur est devant son écran : quand elle
       existe, c'est que quelqu'un attend **maintenant**, et le dire est la
       seule chance qu'il trouve du monde. Deux pastilles au plus, jamais
       allumées pour rien.

       Même retenue qu'au-dessus, et pour les deux mêmes raisons : l'accueil
       nomme déjà le club qui manque sur son bouton d'entrée — « il manque 2
       supporters de Vissel Kobe », ce qu'un point rouge ne dira jamais — et sur
       l'écran du duel, on y est. */
    if (!['/', '/duel-nvn'].includes(chemin)) {
      void pastille('tbf-pip-duel', '/api/nvn/attentes',
        (d) => ((d?.alerte?.camps?.[0] ?? 0) + (d?.alerte?.camps?.[1] ?? 0)) > 0)
        .then((on) => {
          if (!on) return;
          const duel = tiroir.querySelector('a[href="/duel-nvn"]');
          if (!duel) return;
          duel.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
          // Sur le bouton aussi, s'il n'y en a pas déjà une : on prévient d'une
          // chose à faire, pas de laquelle.
          if (!bouton.querySelector('.pip')) {
            bouton.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
          }
        });
    }

    return { tiroir, voile, ouvrir };
  }

  window.TBF_MENU = { chemin, TITRES, ICONES, MENU, item, monter, suisJeAdmin };
})();
