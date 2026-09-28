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
  /* Écrans sans habillage : la cérémonie d'arrivée est un parcours dont on ne
     sort pas au milieu. L'accueil est un écran de jeu plein cadre : ses deux
     rails portent la navigation.

     **`/compte` en est sorti, et c'est une correction.** Elle y était au nom de
     la même règle — « un parcours dont on ne sort pas » —, ce qui est vrai du
     visiteur qui se connecte et faux de tous les autres : cette adresse est
     aussi « Mon compte » dans le tiroir, donc une destination ordinaire pour
     quelqu'un de connecté. Il y arrivait par le menu et s'y retrouvait **sans
     barre, sans titre, sans flèche et sans menu** — c'est-à-dire sans aucun
     moyen de revenir, hors du bouton du navigateur.

     C'est mot pour mot ce que raconte le commentaire de la flèche, plus bas,
     à propos des visiteurs envoyés sur la page des matchs : « ils s'y
     retrouvaient sans aucun moyen de revenir […] la dernière chose à faire à
     quelqu'un qu'on est en train de convaincre. » On l'a refait ici, sur
     l'écran où l'on gère son compte. */
  const SANS_BARRE = ['/', '/bienvenue'];

  /* Le décor, lui, reste à la porte de la connexion. La barre répare un défaut
     de navigation ; poser en plus la photo de tribune changerait l'allure d'un
     écran qui a été dessiné sans elle, et ce n'est pas ce qu'on vient corriger. */
  const SANS_DECOR = ['/compte'];

  /* Écrans qui portent **leur propre** barre du haut.
   *
   * L'administration a la sienne, taillée pour une colonne de mille cent
   * pixels : un titre, le compte qui agit, et son menu. Ce fichier lui en
   * posait une seconde par-dessus, avec le même titre — « Administration »
   * figure dans `TITRES` — et un second bouton de menu.
   *
   * Personne ne l'avait vu, parce qu'elle ne durait pas : la barre est
   * ajoutée **dans** la colonne, et la première vue de l'administration
   * réécrit cette colonne en entier. La barre commune apparaissait puis
   * disparaissait, emportant sa flèche de retour avec elle.
   *
   * On ne la monte donc plus là. Le décor, lui, reste : il est déjà à l'écran
   * aujourd'hui, et ce n'est pas ce qu'on vient corriger. La flèche de cette
   * page est écrite dans son propre en-tête, et la poignée ci-dessous la
   * reconnaît comme les autres. */
  const SANS_HAUT = ['/admin'];

  // Écrans de jeu : la barre du bas est là, mais elle s'efface dès qu'on joue
  // et revient au moindre arrêt. Sans elle, le Virage était un cul-de-sac ;
  // toujours affichée, elle mangerait la place et provoquerait des sorties
  // accidentelles en plein chant. La barre du haut, elle, ne s'y montre pas du
  // tout : pendant un duel, son solde d'écharpes n'intéresse personne.
  const ECRANS_DE_JEU = ['/duel-nvn', '/virage'];
  const chemin = location.pathname.replace(/\/$/, '') || '/';
  if (SANS_BARRE.includes(chemin)) return;

  /* ------------------------------------------------- d'où l'on revient

     **Le repli de la flèche, et rien d'autre.** Le geste ordinaire est
     `history.back()` — on revient là où l'on était, quel que soit le chemin
     pris. Cette table ne sert qu'au cas où il n'y a nulle part où revenir :
     un lien partagé ouvert dans un onglet neuf, l'application lancée depuis
     l'écran d'accueil du téléphone, un favori.

     Elle reste **courte et sûre**. Deux rattachements seulement, parce que
     deux seulement sont évidents : la fiche d'un Fanzzy appartient au
     classeur, le kiosque aussi — on y va pour remplir celui-là. Tout le reste
     rentre à l'accueil, qui est le bon repli faute de mieux. Inventer une
     hiérarchie là où le jeu n'en a pas donnerait une flèche qui emmène
     ailleurs qu'on ne l'attend, c'est-à-dire le défaut qu'on répare. */
  const parentDe = (ou) => (/^\/fanzzy\/.+/.test(ou) ? '/fanzzy'
    : ({ '/boosters': '/fanzzy', '/abonnement': '/boutique' })[ou] ?? '/');

  /** Une adresse de chez nous ? Une adresse illisible n'en est pas une. */
  const memeSite = (u) => {
    try { return new URL(u, location.href).origin === location.origin; }
    catch { return false; }
  };

  /* La pile d'historique telle qu'elle était en arrivant. Tout ce qui s'y
     ajoute ensuite a été poussé **par cette page** — voir ci-dessous. */
  const pileAuDepart = history.length;

  /**
   * Y a-t-il un « avant » où revenir, et est-il à nous ?
   *
   * Deux cas, et il faut les deux.
   *
   * **On vient d'une page du jeu.** Le référent le dit ; s'il est vide ou
   * étranger, revenir en arrière ferait sortir du jeu, ce qu'une flèche
   * intérieure ne doit jamais faire. `history.length` ne suffit pas à le
   * prouver : il vaut au moins 1 sur un onglet neuf.
   *
   * **Ou la page a elle-même empilé quelque chose.** Le classeur pousse une
   * adresse en ouvrant la fiche d'un Fanzzy, la collection en ouvrant une
   * carte : il y a alors un panneau ouvert par-dessus l'écran, et la flèche
   * doit le refermer — c'est ce que le joueur attend, et c'est exactement ce
   * que fait déjà le bouton retour du téléphone.
   *
   * Sur le seul référent, ce cas-là était manqué dès qu'on arrivait par un
   * favori, une adresse tapée ou l'application installée : le référent est vide
   * dans les trois, et la flèche quittait le classeur au lieu de refermer la
   * fiche posée dessus. La comparaison avec la pile d'arrivée le rattrape, sans
   * que cette barre ait à connaître les panneaux de qui que ce soit.
   */
  const peutRevenir = () => history.length > pileAuDepart
    || (history.length > 1 && memeSite(document.referrer));

  /* **Le retour, quand il y a quelque chose où revenir.**
   *
   * Posé sur le document, et non sur la flèche : une page peut écrire la sienne
   * dans son propre en-tête — l'administration le fait — et une poignée
   * attachée à l'élément que ce fichier fabrique ne l'aurait jamais vue. La
   * règle du retour est la même partout ; elle appartient donc au document, pas
   * à un bouton en particulier.
   *
   * En phase de bulle, donc en dernier. Les deux écrans de jeu interceptent
   * déjà `.tbf-retour` en phase de **capture**, pour demander confirmation
   * avant de quitter une tribune, et ils arrêtent la propagation : leur geste
   * passe avant celui-ci et n'arrive jamais jusqu'ici. Inchangé.
   *
   * On laisse le navigateur faire dans trois cas, et chacun compte : un clic
   * déjà traité par quelqu'un d'autre, un clic avec un modificateur — on ouvre
   * volontairement dans un onglet, et `history.back()` y serait absurde — et
   * l'absence d'un « avant » qui soit à nous. Dans ce dernier cas le lien fait
   * exactement ce pour quoi il est écrit : remonter au parent.
   */
  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('.tbf-retour')) return;
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!peutRevenir()) return;
    e.preventDefault();
    history.back();
  });

  /**
   * Le menu vient de menu.js, et de nulle part ailleurs.
   *
   * Ce fichier portait la liste des destinations, les icônes et la
   * construction du tiroir. L'accueil, qui ne charge pas ce fichier, s'était
   * écrit le sien à la main : cinq lignes contre onze, et une déconnexion qui
   * ne demandait rien d'un côté pendant qu'elle demandait de l'autre.
   *
   * Tout cela vit désormais dans menu.js — une seule liste, un seul tiroir,
   * une seule confirmation de sortie. Voir l'en-tête de ce fichier.
   */
  const { TITRES, ICONES } = window.TBF_MENU;


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

     Quarante-quatre pixels de bouton, dix de marge, dix de respiration.

     **La respiration est un luxe de grand ecran.** Sur trois cent soixante
     pixels, ces deux degagements prennent cent vingt-huit pixels, soit plus du
     tiers de la largeur — et ce tiers est pris a l en-tete du virage, ou
     s affichent les deux clubs et le score. L audit d interface a mesure la
     consequence : TA TRIBUNE coupe de trente-six pixels, EN FACE de dix-huit.

     Sous quatre cent vingt pixels, on garde le bouton et la marge, on rend la
     respiration. Le bouton ne se touche pas moins bien pour autant : il fait
     toujours ses quarante-quatre pixels. */
  :root{--tbf-haut-g:64px;--tbf-haut-d:64px}
  @media (max-width:420px){:root{--tbf-haut-g:52px;--tbf-haut-d:52px}}
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
   * Le format n'est plus deviné. Le canvas à qui on le demandait répondait ce
   * qu'il savait **écrire**, ce qui ne dit rien de ce que le navigateur sait
   * **afficher** : personne n'encode l'AVIF, Safari n'encode pas le WebP, et
   * tous les deux les lisent. Le raisonnement complet est dans
   * `fanzzy-etats.js`, avec le trou qu'il a creusé sur l'accueil.
   *
   * Ici la faute ne se voyait pas — le décor existe aussi en JPEG, il arrivait
   * donc, simplement six fois plus lourd que nécessaire sur tout ce qui n'est
   * pas Chrome. Le WebP est lu partout depuis 2020 et chaque décor a le sien ;
   * le JPEG reste en repli par `onerror`, pour le navigateur d'avant.
   */
  const EXT = '.webp';

  if (!SANS_DECOR.includes(chemin)) {
    const decor = document.createElement('div');
    decor.className = 'tbf-decor';
    const voile = document.createElement('div');
    // `dense`: sur une page de contenu, le voile doit gagner. Le réglage de
    // l'accueil est fait pour un écran où un personnage occupe le centre ; sur
    // une liste, la même transparence met la foule en concurrence avec le texte.
    voile.className = 'tbf-grad dense';
    document.body.prepend(decor, voile);
    const img = new Image();
    img.onload = () => { decor.style.backgroundImage = `url("${img.src}")`; decor.classList.add('on'); };
    /* Deux replis, dans cet ordre : le décor d'avant, puis le JPEG. Une mise en
       ligne où l'image manque laisserait sinon une page noire, et une page
       noire ne dit pas pourquoi ; un navigateur sans WebP — il en reste —
       aurait eu la même, sans qu'on sache non plus. */
    const replis = ['/img/hero' + EXT, '/img/accueil.jpg', '/img/hero.jpg'];
    img.onerror = () => {
      const suivant = replis.shift();
      if (!suivant) { img.onerror = null; return; }
      img.src = suivant;
    };
    img.src = '/img/accueil' + EXT;
  }

  /* --------------------------------------------------- la barre du haut */


  /**
   * Monte la barre du haut, si le joueur est connecté.
   *
   * On interroge le compte avant de construire quoi que ce soit : afficher un
   * bandeau « — · 0 écharpes » à un visiteur non connecté lui apprendrait
   * seulement qu'il lui manque quelque chose, sans dire quoi.
   */
  async function barreDuHaut() {
    // Les écrans qui ont déjà la leur : voir `SANS_HAUT`. Le décor est posé,
    // la poignée de la flèche est posée, il ne reste qu'à ne pas doubler la
    // barre.
    if (SANS_HAUT.includes(chemin)) return;

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

    /* **Une seule promesse par page.** La question « qui es-tu ? » se posait
       ici et, sur la page des matchs, une seconde fois pour décider ce que
       voit un visiteur sans compte. Deux appels identiques au même serveur,
       c'est deux réponses possibles à la même question : on la retient sous
       `window.TBF_MOI`, et le premier des deux scripts à passer la pose.

       Rendre `null` en cas d'échec plutôt que lever : hors ligne, la barre
       ne se monte pas, et c'est exactement ce qu'on avait avant. */
    const user = await (window.TBF_MOI ??= fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.user ?? null)
      .catch(() => null));
    /* **La barre ne se montait pas du tout pour un visiteur.**

       C'était défendable tant qu'elle ne portait qu'un menu : quelqu'un sans
       compte n'a pas de deck à ouvrir ni de classeur à lire, et un tiroir
       plein de portes fermées est une liste de refus.

       Mais elle porte aussi **la flèche de retour**, et là c'est l'inverse :
       la vitrine envoie les visiteurs sur la page des matchs — « TOUS LES
       MATCHS › », juste au-dessus du bouton d'inscription — et ils s'y
       retrouvaient sans **aucun** moyen de revenir. Pas de barre, pas de
       menu, pas de lien : le bouton du navigateur, ou rien. C'est la
       dernière chose à faire à quelqu'un qu'on est en train de convaincre.

       Le menu reste donc réservé à ceux qui ont un compte, et la sortie
       s'ouvre à tout le monde — c'est justement le visiteur qui en a le
       plus besoin, puisque c'est le seul qui ne connaît pas les lieux. */
    const boutonHTML = user
      ? `<button class="pan tbf-burger" aria-label="Menu" aria-expanded="false"
          aria-controls="tbf-tiroir"><span></span><span></span><span></span></button>`
      : '';

    /* La flèche de retour, en haut à gauche.
     *
     * Le menu est devenu la seule navigation quand la barre du bas est partie,
     * et revenir demandait deux gestes — ouvrir le tiroir, puis viser la
     * première ligne. C'est deux de trop pour le mouvement le plus fréquent du
     * jeu.
     *
     * Elle ne paraît pas sur l'accueil : un bouton qui mène là où l'on est
     * déjà fait douter de l'endroit où l'on se trouve.
     *
     * ## Elle ne revenait pas
     *
     * C'était `href="/"`, étiqueté « Revenir à l'accueil », **sous une icône de
     * flèche arrière**. Depuis la fiche d'un Fanzzy elle ne remontait pas au
     * classeur ; depuis un booster elle ne remontait pas au kiosque : elle
     * rentrait à la maison, toujours, et il fallait refaire tout le chemin. Une
     * icône qui promet une chose et en fait une autre se lit comme une panne —
     * et c'est ainsi qu'elle a été rapportée.
     *
     * Elle revient donc **d'où l'on vient**, et l'adresse du lien devient ce
     * qu'elle n'était pas : un **repli**, pour qui arrive directement sur un
     * écran profond — un lien partagé, l'application installée, un favori. */
    const parent = parentDe(chemin);
    const retourHTML = chemin === '/' ? '' :
      `<a class="pan tbf-retour" href="${parent}" aria-label="Revenir"
          ><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONES.retour}"/></svg></a>`;

    /* Une flèche, un titre, un menu.

       Elle portait aussi l'avatar avec le pseudo et le club, et deux jetons de
       monnaie. Sur trois cent soixante pixels, les cinq se disputaient la place
       — le pseudo tronqué, le club réduit à « Lausanne … » — et rien de tout ça
       ne disait **où l'on est**, qui est la seule chose qu'on demande à une
       barre. Le pseudo et le club vivent sur le profil, qui est fait pour eux ;
       les soldes s'affichent là où ils décident de quelque chose, c'est-à-dire
       à la boutique et au kiosque.

       Le titre pousse le menu à droite : il devient le centre de gravité de la
       barre au lieu d'un élément de plus dans une file. */
    const haut = document.createElement('header');
    haut.className = 'tbf-haut' + (enJeu ? ' tbf-haut-jeu' : '');
    /* **Ce titre-là est le titre de la page**, et il en est le seul.
     *
     * Chaque écran en portait deux, parfois trois : la barre disait « Deck »,
     * l'onglet allumé disait « DECK », et un `h1` juste en dessous disait
     * « MON DECK ». Trois fois le même mot sur trois centimètres, dont deux
     * qui n'apprenaient rien à personne.
     *
     * C'est celui-ci qu'on garde, pour une raison mesurable : la barre ne
     * défile pas — elle est en `flex:none` en tête de la colonne — donc il
     * reste lisible quand on est descendu au bas d'un classeur. Un titre de
     * page, lui, sort de l'écran au premier geste.
     *
     * Il devient donc un vrai `h1`, et les pages ont abandonné le leur. Un
     * `span` quand la table n'a pas de titre : un `h1` vide serait pire que
     * pas de `h1` du tout — un lecteur d'écran l'annoncerait et ne dirait
     * rien. Les écrans sans entrée dans `TITRES` sont ceux qui se nomment
     * eux-mêmes, comme l'accueil, qui n'a même pas cette barre. */
    const titre = TITRES[chemin] ?? '';
    const balise = titre ? 'h1' : 'span';
    haut.innerHTML = `${retourHTML}<${balise} class="tbf-ou"></${balise}>${boutonHTML}`;
    /* `textContent` et non une interpolation : le titre vient d'une table
       écrite ici, mais la règle vaut pour tout ce qu'on pose dans du HTML
       assemblé à la main — on ne fait pas d'exception « parce que cette
       valeur-là est sûre », c'est ainsi qu'on finit par en faire une mauvaise. */
    haut.querySelector('.tbf-ou').textContent = titre;
    app.prepend(haut);

    /* La poignée de la flèche est posée une fois pour toutes sur le document,
       tout en haut de ce fichier : elle vaut aussi pour les pages qui écrivent
       leur propre flèche. */

    /* ------------------------------------------- recharger pendant une partie

       On ne peut pas empêcher un rechargement, et il ne faudrait pas : le
       navigateur garde toujours son bouton, et une page dont on ne peut pas
       sortir est un piège. Ce qu'on peut faire est de prévenir quand il coûte
       quelque chose.

       Le jeu se remet seul — le Virage se rejoint à la reconnexion, le duel
       reprend sa place — mais la corde retombe pendant les deux secondes du
       rechargement, et un joueur qui recharge par réflexe ne le sait pas.

       Le navigateur n'affiche ce message que si le joueur a déjà touché la
       page : c'est une règle du navigateur, pas un oubli, et elle nous
       arrange — on ne prévient donc jamais quelqu'un qui n'a rien commencé. */
    if (enJeu) {
      window.addEventListener('beforeunload', (e) => {
        if (!document.body.classList.contains('tbf-en-partie')) return;
        e.preventDefault();
        // Le texte est ignoré par tous les navigateurs depuis longtemps ; seul
        // le fait de l'appeler compte. On l'écrit quand même : le jour où l'un
        // d'eux le réaffiche, il vaut mieux qu'il dise quelque chose.
        e.returnValue = 'Ta partie est en cours.';
        return e.returnValue;
      });
    }

    /* Le bandeau d'annonce. En arrière-plan, et sans `await` : personne
       n'attend une phrase. S'il n'y a rien à dire, rien n'est ajouté au
       document — un bandeau vide occupe de la place et fait douter. */
    fetch('/api/public/reglages', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const a = d?.annonce;
        if (!a?.texte) return;
        const b = document.createElement('div');
        b.className = 'tbf-annonce ton-' + (a.ton ?? 'info');
        b.setAttribute('role', 'status');
        /* `textContent` et non une interpolation : ce texte est écrit dans un
           champ d'administration, et un champ d'administration reste une
           entrée. On ne monte pas du HTML avec. */
        b.textContent = a.texte;
        haut.after(b);
      })
      .catch(() => {});

    /* Le tiroir, monté par menu.js sur le bouton que cette barre vient de
       dessiner. Sa liste, son entrée d’administration, la pastille du direct
       et la confirmation de déconnexion ne sont plus l’affaire de ce fichier :
       l’accueil monte exactement le même, et deux menus qui divergent est la
       faute que menu.js existe pour empêcher. */
    /* Pas de bouton pour un visiteur, donc rien à monter. `monter` sur
       `null` ne lèverait pas — elle se contente de ne rien faire — mais un
       appel qui ne fait rien se relit dix fois avant qu'on comprenne
       pourquoi. */
    if (user) window.TBF_MENU.monter(haut.querySelector('.tbf-burger'));

    /* Plus de bourse à remplir ici.

       Cet endroit appelait `/api/me/state` à chaque chargement de page pour
       écrire dans les jetons et la ligne du club — qui ne sont plus dans la
       barre. Une requête réseau sur vingt écrans pour ne rien afficher. Elle
       était protégée par un `try`, donc rien ne cassait : c'est ce qui rend ce
       genre de reste dangereux, il ne se signale pas.

       Les soldes s'affichent là où ils décident de quelque chose : la boutique,
       le kiosque et le carnet les montrent dans leur propre page. */

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
      /**
       * Dire qu'une partie tourne — ou qu'elle ne tourne plus.
       *
       * Seule la page sait : le Virage l'est dès qu'il a rejoint une salle, le
       * duel dès qu'un adversaire est en face. La barre ne peut pas le deviner,
       * et deviner mal préviendrait au mauvais moment — ce qui apprend à
       * ignorer l'avertissement.
       */
      enPartie(oui) {
        document.body.classList.toggle('tbf-en-partie', Boolean(oui));
      },

    };

  }

  barreDuHaut();

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

})();
