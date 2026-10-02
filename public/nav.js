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

  /* ------------------------------------------------ le HUD replié (lot 2)

     Ce que je possède, sur les écrans qui ont la barre du haut, sans lui
     reprendre sa place : à droite, avant le menu, un sticker rond de 36 px
     (zone de touche de 44) — le buste de mon Fanzzy, l'anneau d'XP autour,
     mon niveau collé en bas à droite. Au toucher, une bande kraft se déplie
     sous la barre avec les deux jetons, écharpes et boosters, trois
     secondes, puis se replie. À partir de 560 px, la bande est une rangée de
     la barre, toujours visible (ui.css, « le HUD replié de la barre ») —
     sauf sur les écrans qui ont déjà leur bourse (`BOURSE_EN_PAGE`).

     **D'où viennent les valeurs.** `/api/niveau` pour l'anneau et le
     chiffre ; `/api/fanzzy/state` pour les deux soldes **et le personnage**.
     La direction nommait `/api/me/state`, qui porte les soldes mais pas
     l'avatar : seul le portefeuille de `/api/fanzzy/state` le rend résolu
     (lignée, âge montré, tenue portée — `construireAvatar`, côté serveur),
     et le recomposer ici à partir de l'identifiant brut redonnerait au jeu
     une septième recette du « qui montrer », quand le serveur a justement
     réuni les six autres en une seule. Deux requêtes au lieu de trois, et le
     même personnage que sur l'accueil.

     **Mais pas derrière une page qui vient de la faire.** C'est la lecture
     la plus lourde du joueur — le portefeuille, la collection entière, les
     âges, la saison, les états —, et elle écrit en base quand la réserve est
     pleine. Une page qui l'a lue l'annonce (`tbf:bourse`, plus bas) et le
     HUD prend ce qu'elle a reçu ; il ne relit alors que le niveau.

     **Trente secondes dans l'onglet** (`sessionStorage`), comme les états du
     tiroir : d'un écran à l'autre, le HUD se dessine aussitôt avec ce qu'il
     sait, au lieu de clignoter le temps d'un aller-retour. Plus vieux que
     ça, il se dessine quand même avec la valeur retenue, puis se relit et
     fait compter ce qui a changé. Sans rien de retenu, il attend la réponse :
     un « niveau 1 » posé par défaut mentirait pendant la seconde du
     chargement, qui est celle où on le regarde. */
  const CLE_HUD = 'tbf-hud';
  const DUREE_HUD = 30_000;

  /* **Les écrans qui lisent l'état eux-mêmes en arrivant**, et l'annoncent :
     le kiosque et le classeur, par `load()` de cartes.js. Le HUD n'y relit
     pas l'état quand ce qu'il a retenu est vieux : il attend l'annonce, qui
     porte la même réponse. Si elle ne vient pas — la page n'a pas pu se
     charger —, il relit au bout de `REPLI_ANNONCE`, comme ailleurs : une
     route qui cesserait d'annoncer retarderait le HUD, elle ne l'éteindrait
     pas. */
  const ANNONCENT_LEUR_ETAT = ['/boosters', '/fanzzy'];
  const REPLI_ANNONCE = 6000;

  /* **Les écrans qui ont déjà leur bourse.** La boutique et le kiosque
     affichent les deux soldes dans la page, juste sous la barre, là où ils
     servent à décider. Les jetons dépliés à demeure dans la barre, à partir
     de 560 px, les redisaient cinquante pixels plus haut, avec d'autres
     pictogrammes : le même chiffre deux fois, dessiné de deux façons. Le
     sticker reste ; sous 560 px, le toucher déplie toujours la bande, comme
     partout — c'est un geste qu'on fait, pas un doublon qu'on subit. */
  const BOURSE_EN_PAGE = ['/boutique', '/boosters'];

  /* **Retenu au nom du joueur.** L'onglet survit à une déconnexion : sans
     ce nom, quelqu'un qui se reconnecte sous un autre compte dans la
     demi-minute verrait les soldes et le visage du précédent. */
  let joueur = null;
  const lireHud = () => {
    try {
      const d = JSON.parse(sessionStorage.getItem(CLE_HUD) || 'null');
      return d && joueur && d.qui === joueur ? d : null;
    } catch { return null; }
  };
  const retenirHud = (d) => {
    try { sessionStorage.setItem(CLE_HUD, JSON.stringify(d)); }
    catch { /* stockage fermé : on relira au prochain écran, comme avant */ }
  };

  const memeAvatar = (a, b) => Boolean(a && b)
    && a.id === b.id && a.evo === b.evo && a.skin === b.skin;

  /** L'avatar résolu par le serveur, ramené à ce que le HUD dessine. */
  const avatarDe = (a) => (a?.id ? { id: String(a.id), age: String(a.age ?? a.id),
    evo: Number(a.evo) || 1, skin: String(a.skin || 'base') } : null);

  /** Le niveau, ou `null` sans réponse lisible : jamais un « niveau 1 » par défaut. */
  const niveauDe = (niv) => (Number(niv?.niveau) > 0 ? { niveau: Number(niv.niveau),
    dans: Number(niv.dans) || 0, pour: Number(niv.pour) || 0, max: Boolean(niv.max) } : null);

  const lireJson = (url) => fetch(url, { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null);
  /* Une ligne en base : l'XP du joueur. C'est la seule lecture que le HUD
     fait derrière une page qui vient d'annoncer son état. */
  const lireNiveau = () => lireJson('/api/niveau').then(niveauDe);

  /**
   * Ce qu'une annonce dit du portefeuille : les soldes qu'elle porte, et
   * l'avatar si elle en parle — `null` est une réponse (« pas de Fanzzy »),
   * une clé absente n'en est pas une. `null` si elle ne dit rien.
   */
  function portefeuilleDe(src) {
    if (!src || typeof src !== 'object') return null;
    const nombre = (v) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
    const w = { scarves: nombre(src.scarves), packs: nombre(src.packs) };
    if ('avatar' in src) w.avatar = avatarDe(src.avatar);
    return w.scarves === undefined && w.packs === undefined && !('avatar' in w) ? null : w;
  }

  /* L'état que cartes.js tient pour la page, une fois `load()` passé. Avant,
     `S` porte des valeurs de départ — zéro écharpe, la réserve pleine — qui
     ne sont pas celles du joueur ; seul `load()` y pose `avatar`, et c'est
     ce qui dit qu'il est passé. */
  const etatDeLaPage = () => {
    const S = window.TBF_CARTES?.S;
    return S && 'avatar' in S ? portefeuilleDe(S) : null;
  };

  /* **Quand la page a lu l'état, ou l'a changé.** `tbf:bourse` dit « voici
     l'état du joueur, tel que le serveur vient de le rendre ». Deux formes :

       — **avec `detail`**, le portefeuille lui-même ou ce qu'on en sait
         (`scarves`, `packs`, `avatar`, chacun facultatif), ou la réponse
         entière qui le porte en `wallet` : celle d'une page qui vient de
         recevoir une réponse du serveur — un booster ouvert, un achat — et
         n'a qu'à la relayer ;
       — **sans**, celle de cartes.js : `load()` vient de remplir
         `TBF_CARTES.S`, soldes et avatar résolu, et c'est là qu'on lit.
         Une annonce nue sur une page sans cet état — l'aide, qui sait
         qu'elle vient de verser un booster mais pas combien il en reste —
         dit seulement « ça a changé » : le HUD relit alors tout, comme avant.

     Le HUD prend ces valeurs telles quelles. Il relisait `/api/fanzzy/state`
     à chaque annonce, et laissait passer la première, celle du chargement :
     sur le kiosque et le classeur, il doublait donc la lecture de la page
     dès que ce qu'il avait retenu dépassait la demi-minute.

     **Une page qui change le portefeuille sans l'annoncer laisse le HUD en
     retard**, et l'écran suivant avec lui pendant trente secondes : c'est à
     elle de relayer ce que le serveur lui a rendu. Rien ici ne le devine.

     L'écoute est posée **dès ce script**, et non avec le HUD : celui-ci
     attend la réponse de « qui es-tu ? », et l'annonce du chargement peut
     arriver avant lui. Elle est gardée, et il la prend en se montant. */
  let annonce = null;
  let changeSansDonnee = false;
  let surBourse = null;
  window.addEventListener('tbf:bourse', (e) => {
    const w = portefeuilleDe(e.detail?.wallet ?? e.detail) ?? etatDeLaPage();
    if (surBourse) surBourse(w);
    else if (w) annonce = { ...annonce, ...w };
    else changeSansDonnee = true;
  });

  /** Une valeur du HUD, prête à retenir. Le portrait déjà trouvé suit tant
      que c'est le même personnage : voir `portraits`. */
  function composer({ scarves, packs, avatar }, niveau, t) {
    const avant = lireHud();
    return { qui: joueur, t, scarves, packs, avatar,
      portrait: memeAvatar(avant?.avatar, avatar) ? (avant.portrait ?? null) : null,
      niveau };
  }

  /** La lecture complète, quand aucune page ne l'a faite. `null` sans solde. */
  async function chargerHud() {
    const [etat, niveau] = await Promise.all([lireJson('/api/fanzzy/state'), lireNiveau()]);
    const w = portefeuilleDe(etat?.wallet);
    if (w?.scarves === undefined) return null;
    const d = composer({ scarves: w.scarves, packs: w.packs ?? 0, avatar: w.avatar ?? null },
      niveau, Date.now());
    retenirHud(d);
    return d;
  }

  /**
   * Les adresses où chercher le buste, de la plus juste à la plus sûre.
   *
   * Le portrait est rangé par lignée, âge et tenue
   * (`/img/fanzzy/RP1/e2/base/portrait.webp`), mais toutes les tenues n'en ont
   * pas, et une lignée dessinée à plat n'a que son buste (`TR2-buste.webp`).
   * Quand `fanzzy-etats.js` est chargé et prêt, il sait lequel existe et y
   * ajoute la révision ; sinon on descend la chaîne au premier refus — la
   * tenue, puis le premier âge, puis le buste à plat. Un sticker vide vaut
   * mieux qu'une image cassée : au bout de la chaîne, la craie seule.
   */
  function portraits(av) {
    const l = [];
    const E = window.TBF_ETATS;
    if (E?.pret?.()) {
      const r = E.portrait(av.id, { evo: av.evo, skin: av.skin });
      if (r?.src) l.push(r.src);
    }
    const p = (evo, skin) => `/img/fanzzy/${av.id}/e${evo}/${skin}/portrait.webp`;
    l.push(p(av.evo, av.skin));
    if (av.skin !== 'base') l.push(p(av.evo, 'base'));
    if (av.evo > 1) l.push(p(1, 'base'));
    l.push(`/img/fanzzy/${av.age}-buste.webp`, `/img/fanzzy/${av.id}-buste.webp`);
    return [...new Set(l)];
  }

  const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

  /**
   * Monte le HUD dans la barre, entre le titre et le menu.
   *
   * @param {HTMLElement} haut  la barre.
   * @param {{poser: Function}|null} menu  le tiroir monté par menu.js, qui
   *   reçoit l'état des boosters : c'est ici qu'on connaît la réserve.
   * @param {string} qui  l'identifiant public du joueur, qui signe le cache.
   */
  function monterHud(haut, menu, qui) {
    joueur = qui == null ? null : String(qui);
    const large = window.matchMedia('(min-width:560px)');
    let boite = null;
    let vu = null;

    /* La boîte n'est construite qu'à la première donnée : sans elle, pas de
       HUD du tout — un sticker sans visage ni chiffre ne dit rien. */
    function construire() {
      boite = document.createElement('div');
      boite.className = 'tbf-hud';
      boite.innerHTML = '<button type="button" class="tbf-avatar tbf-avatar--barre"'
        + ' aria-controls="tbf-hud-bande" aria-expanded="false"><span class="tbf-anneau"></span></button>'
        + '<div class="tbf-ticket tbf-hud-bande" id="tbf-hud-bande">'
        + '<a class="tbf-monnaie" href="/boutique"><img src="/img/gains/echarpes.webp" alt="">'
        + '<b>0</b><i class="tbf-monnaie-plus" aria-hidden="true">+</i></a>'
        + '<a class="tbf-monnaie" href="/boosters"><svg viewBox="0 0 24 24" aria-hidden="true"><path'
        + ` d="${ICONES.pack}"/></svg><b>0</b><i class="tbf-monnaie-plus" aria-hidden="true">+</i></a>`
        + '</div>';
      for (const a of boite.querySelectorAll('.tbf-monnaie')) {
        if (a.getAttribute('href') === chemin) a.setAttribute('aria-current', 'page');
        // Le frémissement se pose à chaque changement et se retire à sa fin :
        // laissée, la classe ne rejouerait plus au changement suivant.
        a.addEventListener('animationend', () => a.classList.remove('tbf-vibre'));
      }
      haut.insertBefore(boite, haut.querySelector('.tbf-burger'));
      brancher();
    }

    /* ------------------------------------------ le dépliage, trois secondes

       `.ouverte` sur la bande, et `aria-expanded` sur le sticker ; la feuille
       déplie en 240 ms et ne cache la bande (`visibility`) qu'une fois
       repliée — elle sort alors de la tabulation sans `hidden`.

       **Trois secondes, sauf si on y est.** Un doigt posé dessus, ou le focus
       du clavier sur un des deux jetons, retient la bande : la replier sous
       le focus le ferait tomber sur le corps de la page. Elle se replie au
       toucher suivant, à Échap, ou trois secondes après qu'on l'a quittée.

       **À partir de 560 px, rien ne se déplie** : les jetons sont dans la
       barre. Le sticker n'a alors plus rien à montrer — il mène au profil,
       comme celui de l'accueil, et le dit. Sur un écran qui a sa bourse
       (`BOURSE_EN_PAGE`), la bande est alors cachée (`hidden`, que la
       feuille commune rend absolu) : elle sort aussi de la tabulation et de
       ce que lit un lecteur d'écran, qui entendrait sinon deux fois les
       mêmes soldes. */
    const bourseEnPage = BOURSE_EN_PAGE.includes(chemin);
    let minuterie = 0;
    function brancher() {
      const avatar = boite.querySelector('.tbf-avatar');
      const bande = boite.querySelector('.tbf-hud-bande');
      const replier = () => {
        clearTimeout(minuterie);
        bande.classList.remove('ouverte');
        if (!large.matches) avatar.setAttribute('aria-expanded', 'false');
      };
      const patienter = () => {
        clearTimeout(minuterie);
        minuterie = setTimeout(() => {
          if (bande.matches(':hover, :focus-within')) patienter(); else replier();
        }, 3000);
      };
      avatar.addEventListener('click', () => {
        if (large.matches) {
          const ou = vu?.avatar ? '/profil' : '/fanzzy';
          if (ou !== chemin) location.href = ou;
          return;
        }
        if (bande.classList.contains('ouverte')) { replier(); return; }
        bande.classList.add('ouverte');
        avatar.setAttribute('aria-expanded', 'true');
        patienter();
      });
      bande.addEventListener('focusout', () => {
        if (bande.classList.contains('ouverte')) patienter();
      });
      bande.addEventListener('mouseleave', () => {
        if (bande.classList.contains('ouverte')) patienter();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape' || e.defaultPrevented || !bande.classList.contains('ouverte')) return;
        const dedans = bande.contains(document.activeElement);
        replier();
        if (dedans) avatar.focus({ preventScroll: true });
      });
      const regler = () => {
        if (large.matches) {
          replier();
          avatar.removeAttribute('aria-expanded');
          avatar.removeAttribute('aria-controls');
        } else {
          avatar.setAttribute('aria-controls', 'tbf-hud-bande');
          avatar.setAttribute('aria-expanded', String(bande.classList.contains('ouverte')));
        }
        bande.hidden = bourseEnPage && large.matches;
        if (vu) libeller(vu);
      };
      large.addEventListener?.('change', regler);
      regler();
    }

    /** Ce que le sticker annonce, selon ce qu'il fait à cette largeur. */
    function libeller(d) {
      const avatar = boite.querySelector('.tbf-avatar');
      const niv = d.niveau ? `Niveau ${d.niveau.niveau}` : '';
      avatar.setAttribute('aria-label', large.matches
        ? (d.avatar ? `Mon profil${niv ? ' — ' + niv.toLowerCase() : ''}` : 'Choisis ton Fanzzy')
        : `${niv ? niv + ' — m' : 'M'}es écharpes et mes boosters`);
    }

    /** Pose les valeurs : à la première, sans bruit ; ensuite, en comptant. */
    function afficher(d) {
      if (!boite) construire();
      const avatar = boite.querySelector('.tbf-avatar');
      const anneau = avatar.querySelector('.tbf-anneau');

      /* Le visage. Reconstruit seulement quand le personnage change : une
         image qu'on remplace se recharge, et c'est le clignotement qu'on
         cherche à éviter. */
      const autre = !vu || ((Boolean(vu.avatar) || Boolean(d.avatar))
        && !memeAvatar(vu.avatar, d.avatar));
      if (autre) {
        avatar.classList.toggle('tbf-avatar--vide', !d.avatar);
        const craie = () => {
          const s = document.createElement('span');
          s.className = 'tbf-avatar-buste';
          return s;
        };
        /* L'adresse qui a répondu — ou le constat qu'aucune ne répond, noté
           `false` — est retenue avec le reste : l'écran suivant ne repassera
           pas par les refus. */
        const noter = (portrait) => {
          const r = lireHud();
          if (r && memeAvatar(r.avatar, d.avatar) && r.portrait !== portrait) {
            retenirHud({ ...r, portrait });
          }
        };
        if (!d.avatar || d.portrait === false) {
          anneau.replaceChildren(craie());
        } else {
          const img = document.createElement('img');
          img.className = 'tbf-avatar-buste';
          img.alt = '';
          img.decoding = 'async';
          const sources = [...new Set([d.portrait, ...portraits(d.avatar)].filter(Boolean))];
          let i = 0;
          img.onerror = () => {
            i += 1;
            if (i < sources.length) { img.src = sources[i]; return; }
            img.onerror = null;
            img.replaceWith(craie());
            noter(false);
          };
          img.onload = () => noter(img.getAttribute('src'));
          img.src = sources[0];
          anneau.replaceChildren(img);
        }
      }

      /* L'anneau et le niveau. Sans réponse du niveau, ni chiffre ni
         remplissage : une ligne sans donnée disparaît. Au dernier niveau,
         l'anneau est plein — il n'y a plus rien à remplir. */
      const n = d.niveau;
      const part = n ? (n.max ? 100 : Math.round(Math.min(1, n.dans / (n.pour || 1)) * 100)) : 0;
      anneau.style.setProperty('--p', `${part}%`);
      let pastille = avatar.querySelector('.tbf-avatar-niv');
      if (n && !pastille) {
        pastille = document.createElement('b');
        pastille.className = 'tbf-sticker tbf-sticker--rond tbf-avatar-niv';
        avatar.append(pastille);
      }
      if (n) pastille.textContent = String(n.niveau);
      else pastille?.remove();
      libeller(d);

      /* Les deux jetons. Ils comptent jusqu'à leur nouvelle valeur et
         frémissent — seulement si on les voyait déjà : un premier affichage
         se pose, il ne compte pas depuis zéro. */
      const [echarpes, boosters] = boite.querySelectorAll('.tbf-monnaie');
      for (const [a, cle, mots] of [[echarpes, 'scarves', ['écharpe', 'écharpes']],
        [boosters, 'packs', ['booster', 'boosters']]]) {
        const b = a.querySelector('b');
        const apres = d[cle];
        a.setAttribute('aria-label', pluriel(apres, ...mots)
          + (cle === 'scarves' ? ' — où en gagner' : ''));
        if (vu && vu[cle] !== apres && window.FX?.compter) {
          window.FX.compter(b, vu[cle], apres);
          a.classList.remove('tbf-vibre');
          void a.offsetWidth;
          a.classList.add('tbf-vibre');
        } else b.textContent = String(apres);
      }

      /* Les boosters à ouvrir sont l'état « prêt » du tiroir — le « 4 » or
         sur leur tuile, et sur le menu s'il n'y a rien de plus urgent. Pas
         sur le kiosque lui-même : la page compte déjà sa réserve, en grand,
         juste à côté. */
      menu?.poser?.('/boosters', d.packs > 0 && chemin !== '/boosters' ? 'pret' : null, d.packs);
      vu = d;
    }

    /* ------------------------------------------ d'où viennent les valeurs

       Dans cet ordre :
         1. ce qui est retenu, aussitôt — même vieux, il vaut mieux qu'un
            sticker vide le temps d'un aller-retour ;
         2. ce que la page a déjà annoncé (`annonce`, ou l'état de cartes.js
            lu avant même ce script) : pris tel quel, sans relire ;
         3. sinon, si ce qui est retenu a passé la demi-minute, ou si une
            annonce nue a dit que l'état a changé : sur un écran qui lit
            l'état lui-même (`ANNONCENT_LEUR_ETAT`), on attend son annonce —
            le niveau part tout de suite, pour arriver avec elle ; ailleurs,
            on relit.

       **La dernière source gagne** (`tour`) : une relecture partie avant
       une annonce ne la recouvre pas en revenant avec l'état d'avant. */
    let tour = 0;
    let repli = 0;
    let attenteNiveau = 0;
    let niveauEnRoute = null;

    const relire = () => {
      clearTimeout(repli);
      niveauEnRoute = null;
      const n = ++tour;
      chargerHud().then((d) => { if (d && n === tour) afficher(d); });
    };

    /** Une annonce de la page : le portefeuille, tel qu'elle vient de le recevoir. */
    function recevoir(w) {
      clearTimeout(repli);
      const n = ++tour;
      const avant = vu ?? lireHud();
      const scarves = w.scarves ?? avant?.scarves;
      const packs = w.packs ?? avant?.packs;
      /* Une annonce partielle, sur un HUD qui ne sait rien encore : l'autre
         solde ne se devine pas. */
      if (scarves === undefined || packs === undefined) { relire(); return; }
      const avatar = 'avatar' in w ? w.avatar : (avant?.avatar ?? null);
      const change = !avant || avant.scarves !== scarves || avant.packs !== packs
        || ((Boolean(avant.avatar) || Boolean(avatar)) && !memeAvatar(avant.avatar, avatar));
      const perime = !avant || Date.now() - avant.t >= DUREE_HUD;
      /* Retenu avec l'heure de la dernière lecture complète, et non celle de
         l'annonce : le niveau qu'on garde n'a pas été relu, lui. */
      const d = composer({ scarves, packs, avatar }, avant?.niveau ?? null, avant?.t ?? 0);
      retenirHud(d);
      if (!change && !perime) { afficher(d); return; }

      /* Le niveau se relit quand le portefeuille a bougé — l'XP suit les
         gestes qui le font bouger — ou quand ce qu'on en sait est vieux. Avec
         quelque chose à l'écran, les soldes se posent tout de suite et le
         niveau suit ; sans rien, on l'attend pour se dessiner d'un coup (voir
         « trente secondes », plus haut). Une rafale d'annonces — le kiosque
         en fait une par seconde le temps que la réserve se recharge — ne
         demande le niveau qu'une fois, trois cents millisecondes après la
         dernière. */
      const finir = (niv) => {
        if (n !== tour) return;
        const f = composer(d, niv ?? d.niveau, niv ? Date.now() : d.t);
        retenirHud(f);
        afficher(f);
      };
      if (vu) afficher(d);
      clearTimeout(attenteNiveau);
      if (niveauEnRoute) {
        const p = niveauEnRoute;
        niveauEnRoute = null;
        p.then(finir);
      } else {
        attenteNiveau = setTimeout(() => lireNiveau().then(finir), vu ? 300 : 0);
      }
    }

    /* Une annonce sans donnée : on relit tout, une fois par rafale. */
    let relecture = 0;
    surBourse = (w) => {
      if (w) { recevoir(w); return; }
      clearTimeout(relecture);
      relecture = setTimeout(relire, 300);
    };
    const retenu = lireHud();
    if (retenu) afficher(retenu);
    const deja = annonce ?? etatDeLaPage();
    annonce = null;
    if (deja) recevoir(deja);
    else if (changeSansDonnee || !retenu || Date.now() - retenu.t >= DUREE_HUD) {
      if (ANNONCENT_LEUR_ETAT.includes(chemin)) {
        niveauEnRoute = lireNiveau();
        repli = setTimeout(relire, REPLI_ANNONCE);
      } else relire();
    }

    /* Revenir par la flèche du navigateur peut rendre la page telle qu'on
       l'avait quittée, sans la relancer : le HUD y serait resté d'avant
       l'achat. On le relit, comme l'accueil relit sa bourse — la page,
       elle, ne relit rien, et n'annoncera donc rien. */
    window.addEventListener('pageshow', (e) => {
      if (!e.persisted) return;
      const r = lireHud();
      if (r && Date.now() - r.t < DUREE_HUD) { tour += 1; afficher(r); return; }
      relire();
    });
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

    /* Une flèche, un titre, un menu — et, replié, ce que je possède.

       Elle portait aussi l'avatar avec le pseudo et le club, et deux jetons de
       monnaie. Sur trois cent soixante pixels, les cinq se disputaient la place
       — le pseudo tronqué, le club réduit à « Lausanne … » — et rien de tout ça
       ne disait **où l'on est**, qui est la seule chose qu'on demande à une
       barre. Le pseudo et le club vivent sur le profil, qui est fait pour eux.

       Les soldes et le niveau reviennent au lot 2, mais **repliés** : un
       sticker rond de trente-six pixels, le buste de son Fanzzy dans l'anneau
       d'XP, qui déplie les deux jetons au toucher. Il prend la place d'un
       bouton, pas celle du titre — voir `monterHud`, plus haut.

       Le titre se range à gauche, juste après la flèche, et pousse à droite ce
       qui le suit — le HUD et le menu (ui.css, « le nom de l'écran, sur son
       scotch »). */
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
       dessiner. Sa liste, son entrée d’administration, les états de ses
       tuiles et la confirmation de déconnexion ne sont plus l’affaire de ce
       fichier : l’accueil monte exactement le même, et deux menus qui
       divergent est la faute que menu.js existe pour empêcher. */
    /* Pas de bouton pour un visiteur, donc rien à monter. `monter` sur
       `null` ne lèverait pas — elle se contente de ne rien faire — mais un
       appel qui ne fait rien se relit dix fois avant qu'on comprenne
       pourquoi. */
    const menu = user ? window.TBF_MENU.monter(haut.querySelector('.tbf-burger')) : null;

    /* **Le HUD replié**, pour un joueur connecté, hors des deux écrans de jeu :
       pendant un duel, son solde d'écharpes n'intéresse personne (le HUD de
       match est l'affaire d'un autre lot). Un visiteur n'a ni niveau ni
       solde : rien à replier. */
    if (user && !enJeu) monterHud(haut, menu, user.id ?? user.pseudo);

    /**
     * Ce qu'une page peut encore dire à la barre : qu'une partie tourne.
     *
     * Cette poignée tenait aussi la bourse à jour — `bourse()`, qu'appelaient
     * les boosters et le carnet quand leur solde changeait. Elle est partie
     * avec les jetons, et ne revient pas avec le HUD : celui-ci prend ce
     * qu'une page annonce de l'état du joueur (`tbf:bourse`, voir plus haut —
     * émis par cartes.js, ou par une page avec le portefeuille en `detail`),
     * sans qu'aucune page ait à le connaître. Un événement plutôt qu'une
     * poignée : il est entendu même avant que cette barre existe, et une page
     * sans barre — le hub, un écran de jeu — peut l'émettre sans rien vérifier.
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

  /* Braises discrètes : le décor doit vivre sans distraire de la page.

     Elles sont la définition même d'une animation décorative : le calme
     « animations » du tiroir les éteint. Relu à chaque braise et non au
     chargement, pour que l'interrupteur agisse sous les yeux de qui le
     touche — l'attribut est posé par menu.js, chargé avant ce fichier. */
  const decorCalme = () =>
    (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    setInterval(() => {
      if (document.hidden || decorCalme()) return;
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
