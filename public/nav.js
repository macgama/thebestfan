/**
 * L'habillage commun : décor, barre du haut, barre du bas.
 *
 * Un seul fichier inclus partout plutôt que le même code recopié dans quinze
 * pages : le jour où une entrée change, elle change une fois.
 *
 * Il pose trois choses :
 *
 *   — **le décor**, la photo de tribune de l'accueil, assombrie par un voile.
 *     C'est ce qui fait que toutes les pages appartiennent visiblement au même
 *     jeu. Il était bien plus effacé avant ; l'accueil a montré qu'une page
 *     posée sur une vraie tribune se lit aussi bien et respire beaucoup mieux.
 *
 *   — **la barre du haut** : qui je suis, ce que je possède, et le menu qui
 *     mène à tout ce qui n'a pas sa place dans la barre du bas. Elle ne
 *     s'affiche que pour un joueur connecté — sur une page publique, un
 *     bandeau de compte vide ne dit rien de bon.
 *
 *   — **la barre du bas**, la navigation entre les sept sections.
 *
 * L'apparence vit dans `ui.css`, pas ici. Ce fichier ne porte que ce qui
 * demande du code : où l'on est, ce qu'on a le droit de voir, et quand la
 * barre du bas doit s'effacer.
 *
 * Rien ne s'affiche sur les écrans où ça gênerait : la connexion, la cérémonie
 * d'arrivée, et l'accueil qui porte sa propre navigation dans ses deux rails.
 */
(() => {
  // Écrans sans habillage : la connexion et la cérémonie d'arrivée sont des
  // parcours dont on ne sort pas au milieu. L'accueil est un écran de jeu
  // plein cadre : ses deux rails portent la navigation, et la barre du bas
  // passerait sous le bouton d'entrée.
  const SANS_BARRE = ['/', '/compte', '/bienvenue'];

  // Écrans de jeu : la barre du bas est là, mais elle s'efface dès qu'on joue
  // et revient au moindre arrêt. Sans elle, le Virage était un cul-de-sac ;
  // toujours affichée, elle mangerait la place et provoquerait des sorties
  // accidentelles en plein chant. La barre du haut, elle, ne s'y montre pas du
  // tout : pendant un duel, son solde d'écharpes n'intéresse personne.
  const ECRANS_DE_JEU = ['/duel-nvn', '/virage'];
  const chemin = location.pathname.replace(/\/$/, '') || '/';
  if (SANS_BARRE.includes(chemin)) return;

  /**
   * Le menu, et lui seul.
   *
   * ## Ce qu'il remplace
   *
   * Il y avait **deux** navigations, et elles ne disaient pas la même chose.
   * La barre du bas menait à l'accueil, au Virage, au duel, au classeur, aux
   * matchs, au classement et au profil. Le tiroir menait au deck, au profil,
   * aux clubs, au KOP, aux amis et au télétexte. Aucune des deux n'était
   * complète, et le KOP — qui est au centre du jeu — n'était accessible que
   * par celle qu'on ouvre exprès.
   *
   * C'est le même défaut que le jeu a déjà corrigé trois fois ailleurs : une
   * règle écrite à deux endroits. « Où puis-je aller ? » n'a qu'une bonne
   * réponse, et elle tient maintenant dans une seule liste.
   *
   * ## Pourquoi en rubriques
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
      ['/teletext', 'teletext', 'Classements et buteurs'],
      ['/classement', 'classement', 'Classement des supporters'],
    ] },
  ];


  /* Ce qui reste ici plutôt que dans ui.css : une seule déclaration, et elle
     n'a de sens qu'avec ce fichier. Tout l'habillage — décor, barre du haut,
     menu — est stylé par la feuille commune, que chaque page charge.

     Pas d'accent grave dans ce texte : il vit dans un gabarit de chaîne, et
     un seul le referme au mauvais endroit. Le fichier a déjà été cassé comme
     ça une fois. */
  const css = `
  /* La hauteur réservée en bas vaut zéro : la barre du bas n'existe plus.
     Neuf pages calculent pourtant encore leur bas avec cette variable, en
     retombant sur 62px quand elle manque. La garder à zéro les fait toutes
     tomber juste, sans toucher à neuf fichiers ni risquer d'en oublier un. */
  :root{--nav-h:0px}

  /* Le dégagement des deux boutons flottants, ecrit une seule fois.

     Sur un ecran de jeu, la barre du haut ne pousse pas le jeu vers le bas :
     elle flotte dessus. Les deux en-tetes de jeu doivent donc reserver la
     place a gauche et a droite, et ils le faisaient avec un 58px recopie dans
     chaque page. Le jour ou le bouton grandit, il en reste un a corriger.

     Quarante-deux pixels de bouton, dix de marge, dix de respiration. */
  :root{--tbf-haut-g:62px;--tbf-haut-d:62px}
  .tbf-spark{position:fixed;width:3px;height:3px;border-radius:50%;z-index:0;pointer-events:none;opacity:0}`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /**
   * La largeur de la colonne de cette page, donnée au menu.
   *
   * Les pages ne font pas toutes la même largeur — quatre cent quarante pour
   * le classeur, quatre cent soixante pour le profil, huit cent vingt pour le
   * kiosque, mille cent pour l'administration. Le menu s'ancre au bord droit
   * de **la colonne**, et sans cette mesure il se calait sur la largeur
   * commune : sur le kiosque il dépassait de trente pixels et flottait à côté
   * de la page qu'il sert.
   *
   * On la **lit** sur la colonne elle-même plutôt que de demander à dix-huit
   * pages de la redire : deux endroits qui déclarent la même largeur finissent
   * par ne plus s'accorder. Une largeur exprimée autrement qu'en pixels —
   * `none`, un pourcentage — ne se transpose pas : on garde alors la valeur
   * par défaut de la feuille.
   *
   * Cette mesure servait la barre du bas ; elle lui a survécu parce que le
   * besoin, lui, n'a jamais été celui de la barre.
   */
  {
    const colonne = document.getElementById('app') ?? document.querySelector('main');
    const large = colonne ? getComputedStyle(colonne).maxWidth : '';
    if (/^\d+(\.\d+)?px$/.test(large)) {
      document.documentElement.style.setProperty('--tbf-colonne', large);
    }
  }

  /* ------------------------------------------------------------- décor */

  /**
   * La photo de tribune, sous un voile.
   *
   * Le format est choisi par le navigateur, pas deviné : un `.avif` servi à un
   * navigateur qui ne le lit pas ne déclenche même pas d'erreur visible, il
   * laisse juste un fond noir.
   */
  const EXT = (() => {
    try {
      const c = document.createElement('canvas');
      if (c.toDataURL('image/avif').startsWith('data:image/avif')) return '.avif';
      if (c.toDataURL('image/webp').startsWith('data:image/webp')) return '.webp';
    } catch { /* pas de canvas */ }
    return '.jpg';
  })();

  const decor = document.createElement('div');
  decor.className = 'tbf-decor';
  const voile = document.createElement('div');
  // `dense`: sur une page de contenu, le voile doit gagner. Le réglage de
  // l'accueil est fait pour un écran où un personnage occupe le centre ; sur
  // une liste, la même transparence met la foule en concurrence avec le texte.
  voile.className = 'tbf-grad dense';
  document.body.prepend(decor, voile);
  {
    const img = new Image();
    img.onload = () => { decor.style.backgroundImage = `url("${img.src}")`; decor.classList.add('on'); };
    // Le décor d'avant reste en repli : une mise en ligne où l'image manque
    // laisserait sinon une page noire, et une page noire ne dit pas pourquoi.
    img.onerror = () => { img.onerror = null; img.src = '/img/hero' + EXT; };
    img.src = '/img/accueil' + EXT;
  }

  /* --------------------------------------------------- la barre du haut */

  const ICONES = {
    // Reprises de l'ancienne barre du bas, qui avait les siennes de son côté.
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
    // Une flèche vers la gauche, pour rentrer. Volontairement pas un chevron
    // seul : à quarante pixels, un chevron se confond avec un bouton de repli.
    retour: 'M15 5l-7 7 7 7',
  };
  const item = (href, cle, texte, classe = '') =>
    `<a href="${href}" class="${classe}"><svg viewBox="0 0 24 24"><path d="${ICONES[cle]}"/></svg>${texte}</a>`;

  /**
   * Monte la barre du haut, si le joueur est connecté.
   *
   * On interroge le compte avant de construire quoi que ce soit : afficher un
   * bandeau « — · 0 écharpes » à un visiteur non connecté lui apprendrait
   * seulement qu'il lui manque quelque chose, sans dire quoi.
   */
  async function barreDuHaut() {
    // Toutes les pages n'ont pas d'#app : deux d'entre elles avaient un <main>
    // nu, et la barre n'y apparaissait pas — sans erreur, sans rien. Un repli
    // vaut mieux qu'une page qui perd son bandeau en silence.
    const app = document.getElementById('app') ?? document.querySelector('main');
    if (!app) return;

    /* Sur un écran de jeu, la barre du haut se réduit à son seul bouton.
     *
     * Le duel et le Virage n'avaient pas de barre du haut — la place y est
     * comptée, et le pseudo, les écharpes et les boosters n'ont rien à y
     * faire pendant qu'on joue. Tant que la barre du bas existait, ce n'était
     * pas grave : elle servait de sortie. Elle est partie, et ces deux écrans
     * se sont retrouvés sans **aucun** moyen d'en sortir autrement que par le
     * bouton du navigateur.
     *
     * On y garde donc le bouton, et rien d'autre : de quoi partir, pas de
     * quoi distraire. */
    const enJeu = ECRANS_DE_JEU.includes(chemin);

    let user = null;
    try {
      const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (r.ok) user = (await r.json()).user;
    } catch { /* hors ligne */ }
    if (!user) return;

    const boutonHTML = `<button class="pan tbf-burger" aria-label="Menu" aria-expanded="false"
          aria-controls="tbf-tiroir"><span></span><span></span><span></span></button>`;

    /* La flèche de retour, en haut à gauche.
     *
     * Le menu est devenu la seule navigation quand la barre du bas est partie,
     * et revenir à l'accueil demandait deux gestes — ouvrir le tiroir, puis
     * viser la première ligne. C'est deux de trop pour le mouvement le plus
     * fréquent du jeu.
     *
     * Elle ne paraît pas sur l'accueil : un bouton qui mène là où l'on est
     * déjà fait douter de l'endroit où l'on se trouve. */
    const retourHTML = chemin === '/' ? '' :
      `<a class="pan tbf-retour" href="/" aria-label="Revenir à l’accueil"
          ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONES.retour}"/></svg></a>`;

    const haut = document.createElement('header');
    haut.className = 'tbf-haut' + (enJeu ? ' tbf-haut-jeu' : '');
    haut.innerHTML = enJeu
      ? `${retourHTML}<div class="tbf-bourse">${boutonHTML}</div>`
      : `
      ${retourHTML}
      <a class="pan tbf-moi" href="/profil">
        <span class="tbf-pastille">${(user.pseudo ?? '?').trim().charAt(0).toLowerCase() || '?'}</span>
        <span><b></b><small></small></span>
      </a>
      <div class="tbf-bourse">
        <div class="pan tbf-jeton" data-jeton="ech"><i></i><span data-ech>0</span></div>
        <div class="pan tbf-jeton" data-jeton="pack"><i></i><span data-pack>0</span></div>
        ${boutonHTML}
      </div>`;
    // `textContent` et non une interpolation : un pseudo est écrit par le
    // joueur, il n'a rien à faire dans du HTML assemblé à la main. En jeu, la
    // barre est réduite au bouton : il n'y a pas de pseudo à écrire.
    if (!enJeu) haut.querySelector('.tbf-moi b').textContent = user.pseudo ?? '';
    app.prepend(haut);

    const tiroir = document.createElement('nav');
    tiroir.id = 'tbf-tiroir';
    tiroir.className = 'tbf-tiroir';
    tiroir.setAttribute('aria-label', 'Le reste du jeu');
    tiroir.hidden = true;
    /* La page où l'on est se marque, et ne se propose pas.
       Sans ça le menu offre d'aller là où on est déjà, ce qui est le meilleur
       moyen de faire douter quelqu'un de l'endroit où il se trouve. */
    const ici = (href) => chemin === href
      || (href === '/matchs' && chemin === '/teletext' && false);

    tiroir.innerHTML = `<a class="tbf-tiroir-ici" href="/">${
      ICONES.accueil ? `<svg viewBox="0 0 24 24"><path d="${ICONES.accueil}"/></svg>` : ''
    }L\u2019accueil</a>`
      + MENU.map((r) => `<div class="tbf-rubrique">${r.titre}</div>`
        + r.liens.map(([href, cle, texte]) =>
          item(href, cle, texte, ici(href) ? 'on' : '')).join('')).join('')
      + '<hr>'
      + item('/profil', 'profil', 'Mon profil')
      + item('/compte', 'compte', 'Mon compte')
      + item('#', 'sortie', 'Se déconnecter', 'sortie');
    const rideau = document.createElement('div');
    rideau.className = 'tbf-voile';
    document.body.append(tiroir, rideau);

    const bouton = haut.querySelector('.tbf-burger');
    const ouvrir = (oui) => {
      // `hidden` et la classe : la classe anime, l'attribut sort vraiment le
      // menu de l'ordre de tabulation. Sans lui, la tabulation traverse un
      // menu invisible.
      if (oui) tiroir.hidden = false;
      requestAnimationFrame(() => {
        tiroir.classList.toggle('on', oui);
        rideau.classList.toggle('on', oui);
        bouton.setAttribute('aria-expanded', String(oui));
        if (!oui) {
          setTimeout(() => { if (!tiroir.classList.contains('on')) tiroir.hidden = true; }, 200);
        }
      });
    };
    bouton.addEventListener('click', () => ouvrir(!tiroir.classList.contains('on')));
    rideau.addEventListener('click', () => ouvrir(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') ouvrir(false); });

    tiroir.querySelector('.sortie').addEventListener('click', async (e) => {
      e.preventDefault();
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
      catch { /* hors ligne : on recharge quand même, la session locale ne sert plus */ }
      location.href = '/';
    });

    // La bourse et le club suivi arrivent après : la barre est déjà en place,
    // donc rien ne saute quand ils se remplissent.
    // En jeu il n'y a ni bourse ni club affiché : rien à remplir, et surtout
    // rien à demander au serveur pendant qu'on joue.
    if (!enJeu) try {
      const st = await fetch('/api/me/state', { credentials: 'same-origin' })
        .then((r) => r.json());
      haut.querySelector('[data-ech]').textContent = st.scarves ?? 0;
      haut.querySelector('[data-pack]').textContent = st.packs ?? 0;
      const principal = st.follows?.find((f) => f.is_main) ?? st.follows?.[0];
      haut.querySelector('.tbf-moi small').textContent = principal
        ? `${principal.name} · ${st.slots.used}/${st.slots.total} clubs`
        : 'aucun club suivi';
    } catch { /* module non monté : la barre reste à zéro plutôt que d'échouer */ }

    /**
     * De quoi tenir la bourse à jour depuis une page.
     *
     * Ouvrir un booster, acheter une évolution, faire évoluer un Fanzzy :
     * toutes ces actions changent le solde, et la barre du haut est le seul
     * endroit où il s'affiche désormais. Sans cette poignée, elle resterait
     * sur le chiffre du chargement — un joueur qui vient de dépenser
     * quarante-cinq écharpes les verrait toujours à l'écran.
     */
    window.TBF_BARRE = {
      bourse(scarves, packs) {
        // Les jetons n'existent pas sur un écran de jeu : on ne les cherche
        // qu'après s'être assuré qu'ils sont là.
        const e = haut.querySelector('[data-ech]');
        const p = haut.querySelector('[data-pack]');
        if (e && scarves != null) e.textContent = scarves;
        if (p && packs != null) p.textContent = packs;
      },
    };

    return { tiroir, haut };
  }

  const enHaut = barreDuHaut();

  /* ------------------------------------------- plus de barre du bas

     Il y avait une barre fixe en bas de chaque écran. Elle est partie, et avec
     elle la seconde navigation qui ne disait pas la même chose que le menu.

     Deux choses s'en vont avec elle. Les **soixante-deux pixels** qu'elle
     réservait sur toute la hauteur du jeu — sur un téléphone, c'est un dixième
     de l'écran repris à ce qu'on est venu regarder. Et sa disparition
     automatique sur les écrans de jeu, qui existait justement parce qu'elle
     gênait : une barre qu'il faut effacer pour pouvoir jouer est une barre qui
     n'avait rien à faire là.

     `--nav-h` reste déclarée, à zéro. Neuf pages calculent encore leur bas
     avec elle — `calc(var(--nav-h,62px) + 18px)` — et les laisser retomber sur
     la valeur de repli les aurait toutes décollées de soixante-deux pixels. La
     variable vaut mieux que neuf modifications et neuf occasions d'en oublier
     une. */

  /* Braises discrètes : le décor doit vivre sans distraire de la page. */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(() => {
      if (document.hidden) return;
      const s = document.createElement('div');
      s.className = 'tbf-spark';
      s.style.left = (8 + Math.random() * 84) + '%';
      s.style.bottom = '60px';
      s.style.background = Math.random() > 0.4 ? '#F5C33B' : '#E0402C';
      document.body.appendChild(s);
      s.animate([
        { opacity: 0, transform: 'translateY(0)' },
        { opacity: .55, transform: `translateY(-${100 + Math.random() * 140}px)`, offset: .6 },
        { opacity: 0, transform: `translateY(-${230 + Math.random() * 180}px) translateX(${Math.random() * 50 - 25}px)` },
      ], { duration: 4200 + Math.random() * 2600, easing: 'cubic-bezier(.3,.6,.5,1)' })
        .onfinish = () => s.remove();
    }, 1400);
  }

  /* Entrée d'administration, ajoutée seulement si le compte y a droit. */
  (async () => {
    try {
      const r = await fetch('/api/admin/suis-je', { credentials: 'same-origin' });
      if (!r.ok) return;
      const { admin } = await r.json();
      if (!admin) return;
      const a = document.createElement('a');
      a.href = '/admin';
      a.style.setProperty('--c', '#E0402C');
      a.className = chemin === '/admin' ? 'on' : '';
      a.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7zM9 12l2 2 4-4"/></svg>ADMIN`;
      nav.appendChild(a);

      // Et dans le menu du haut, juste avant la déconnexion.
      const monte = await enHaut;
      monte?.tiroir.querySelector('.sortie')
        ?.insertAdjacentHTML('beforebegin', item('/admin', 'admin', 'Administration'));
    } catch { /* module absent */ }
  })();

  /* Pastille rouge quand un match des clubs suivis est en cours.
     Elle vivait sur la barre du bas ; elle se pose maintenant sur le bouton du
     menu et sur la ligne du Virage à l'intérieur — c'est-à-dire là où on la
     verra de toute façon, et là où elle mène. */
  (async () => {
    try {
      const r = await fetch('/api/virage/live', { credentials: 'same-origin' });
      if (!r.ok) return;
      const { matchs = [] } = await r.json();
      if (!matchs.some((m) => m.open)) return;
      const monte = await enHaut;
      monte?.haut.querySelector('.tbf-burger')
        ?.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
      monte?.tiroir.querySelector('a[href="/virage"]')
        ?.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
    } catch { /* module non monté */ }
  })();
})();
