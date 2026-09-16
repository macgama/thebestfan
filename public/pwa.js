/**
 * L'application installée : plein écran, et une icône sur l'appareil.
 *
 * ## Pourquoi un fichier à part
 *
 * Il devait être chargé par les **vingt** pages, et aucun fichier commun ne
 * l'est : `nav.js` manque sur quatre écrans — l'accueil, le compte, la
 * bienvenue, l'administration — et `menu.js` sur deux. Un joueur qui arrive
 * par `/compte`, ce qui est le cas de tous les nouveaux, n'aurait jamais rien
 * proposé. `scripts/verif-pages.mjs` tient la liste à jour à notre place.
 *
 * ## Les trois choses qu'il fait
 *
 *   1. **Il inscrit le service worker.** C'est la seule pièce qui manquait
 *      pour que Chrome propose « Installer l'application » — le manifeste et
 *      les icônes étaient là depuis le début. Sur iPhone, « Sur l'écran
 *      d'accueil » n'en a jamais eu besoin.
 *
 *   2. **Il tient l'orientation.** Portrait sur téléphone, libre sur
 *      tablette : les écrans sont dessinés en colonne de neuf cents pixels au
 *      plus, et en paysage sur un téléphone la corde et les chants se
 *      retrouveraient à l'étroit. Sur une tablette il y a la place, et bloquer
 *      le portrait s'y ressent comme un défaut. Le manifeste ne peut pas faire
 *      cette différence — il verrouille tout ou rien — d'où ce verrou-ci, posé
 *      seulement quand l'écran est petit.
 *
 *   3. **Il retient la proposition d'installation.** Le navigateur ne la fait
 *      qu'une fois, très tôt, et l'enterre ensuite dans un menu que personne
 *      n'ouvre. On la garde pour que la page puisse la reproposer au bon
 *      moment, par `TBF_PWA.installer()`.
 */
(() => {
  /* Ce que la page peut demander. Posé tout de suite, même si rien n'est
     disponible : une page qui teste `TBF_PWA?.possible` avant de dessiner un
     bouton ne doit pas dépendre de l'ordre de chargement. */
  const etat = {
    /** Une proposition d'installation est-elle en main ? */
    possible: false,
    /** Le jeu tourne-t-il déjà comme une application installée ? */
    installe: matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true,
    /** Un iPhone ou un iPad : Safari n'a pas de fenêtre d'installation.
     *
     * Il n'envoie aucun événement et n'expose aucune commande : on ne peut
     * qu'expliquer le geste — Partager, puis « Sur l'écran d'accueil ». La
     * page qui invite en a besoin, sinon elle proposerait un bouton qui ne
     * fait rien à la moitié des joueurs. */
    ios: /iphone|ipad|ipod/i.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    /** Ouvre la fenêtre d'installation. Rend `true` si le joueur a accepté. */
    installer: async () => false,
  };
  window.TBF_PWA = etat;

  /* ------------------------------------------------------ le service worker

     `load` et non tout de suite : l'inscription déclenche un téléchargement,
     et le faire pendant que la page se monte retarderait ce que le joueur
     attend vraiment. Elle n'a aucune urgence — elle ne sert qu'à la visite
     suivante. */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((e) => {
        // Un échec n'empêche rien : le jeu marche exactement pareil sans lui,
        // on perd seulement la proposition d'installation sur Android.
        console.warn('[pwa] service worker refusé :', e.message);
      });
    });
  }

  /* -------------------------------------------------------- l'orientation

     Six cents pixels sur le petit côté : c'est la frontière habituelle entre
     un téléphone et une tablette, et elle se lit sur l'écran de l'appareil et
     non sur la fenêtre — une fenêtre se redimensionne, un téléphone non.

     `lock` n'est permis qu'à une application installée : ailleurs il lève, et
     c'est très bien ainsi. On ne verrouille pas l'orientation du navigateur de
     quelqu'un. */
  const estUnTelephone = Math.min(screen.width, screen.height) < 600;
  if (etat.installe && estUnTelephone) {
    try { screen.orientation?.lock?.('portrait').catch(() => {}); }
    catch { /* pas permis ici : on laisse l'appareil décider */ }
  }

  /* --------------------------------------------------- l'invitation à installer

     Le navigateur envoie cet événement une fois, tôt, et sans rien demander à
     personne. Si on ne le retient pas, la proposition est perdue et il ne
     reste que l'entrée de menu du navigateur, que personne ne trouve. */
  let proposition = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    proposition = e;
    etat.possible = true;
    etat.installer = async () => {
      if (!proposition) return false;
      proposition.prompt();
      const { outcome } = await proposition.userChoice;
      // Une proposition ne sert qu'une fois : refusée, elle ne revient pas.
      proposition = null;
      etat.possible = false;
      window.dispatchEvent(new CustomEvent('tbf-pwa'));
      return outcome === 'accepted';
    };
    /* La page a pu se dessiner avant : on la prévient qu'il y a désormais
       quelque chose à proposer. */
    window.dispatchEvent(new CustomEvent('tbf-pwa'));
  });

  window.addEventListener('appinstalled', () => {
    etat.installe = true;
    etat.possible = false;
    proposition = null;
    window.dispatchEvent(new CustomEvent('tbf-pwa'));
  });
})();
