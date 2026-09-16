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
    '/profil': 'Profil', '/compte': 'Compte', '/admin': 'Administration',
    '/diagnostic': 'Diagnostic',
  };

  const ICONES = {
    virage: 'M3 20l9-16 9 16zM7 20l5-9 5 9',
    duel: 'M4 4l7 7M20 4l-7 7M12 13v7M8 20h8',
    fanzzy: 'M4 4h13l3 3v13H4zM8 8h6M8 12h8M8 16h5',
    carnet: 'M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2zM5 18h14M9 8h6',
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
    ] },
    { titre: 'MA COLLECTION', liens: [
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
      + item('/profil', 'profil', 'Mon profil', ici('/profil') ? 'on' : '')
      + item('/compte', 'compte', 'Mon compte', ici('/compte') ? 'on' : '')
      + item('#', 'sortie', 'Se déconnecter', 'sortie');

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

    /* Pastille rouge quand un match des clubs suivis est en cours : sur le
       bouton pour qu'on la voie sans ouvrir, sur la ligne du Virage pour
       qu'on sache où elle mène. */
    fetch('/api/virage/live', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.matchs?.some((m) => m.open)) return;
        bouton.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
        tiroir.querySelector('a[href="/virage"]')
          ?.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
      })
      .catch(() => {});

    return { tiroir, voile, ouvrir };
  }

  window.TBF_MENU = { chemin, TITRES, ICONES, MENU, item, monter, suisJeAdmin };
})();
