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
 *      n'ouvre. On la garde pour que le jeu puisse la reproposer au bon
 *      moment, par `TBF_PWA.installer()` : c'est l'entrée « Installer
 *      l'application » du tiroir, dans `menu.js`, qui s'en sert.
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
  /* **Le jeu est revenu.** L'écran d'attente de `sw.js` espace ses tentatives —
     six secondes, douze, vingt-quatre — et compte ses essais ici. Cette page-ci
     s'est ouverte, donc le serveur répond : le compteur repart de zéro, sinon
     la prochaine coupure commencerait à une minute d'attente pour rien. */
  try { sessionStorage.removeItem('tbf-attente'); } catch { /* sans importance */ }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        /* **On redemande la version d'à côté, à chaque chargement.**
         *
         * Le navigateur vérifie déjà de lui-même, mais à son rythme et avec ses
         * propres règles de fraîcheur. Un service worker fautif, lui, ne se
         * remplace pas tout seul : il intercepte les navigations, survit au
         * rechargement, et la seule façon d'en sortir est qu'un nouveau
         * s'installe. Le jour où celui-ci a mis le site hors service, la
         * rapidité de ce remplacement était **la** différence entre dix
         * secondes de panne et une journée.
         *
         * Ça ne coûte rien : la réponse fait quelques kilo-octets et n'est
         * suivie d'une installation que si le fichier a changé. */
        reg?.update?.().catch(() => { /* le navigateur vérifiera à son tour */ });
      }).catch((e) => {
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

  /* ----------------------------------------------------- les notifications

     Ce que la page du compte et la déconnexion demandent ; le serveur est
     dans `src/server/notifications/index.js`, l'affichage dans `sw.js`.

     Ici et non dans la page du compte, parce que **la déconnexion** en a
     besoin et qu'elle se fait aussi depuis le tiroir (`menu.js`) : un
     téléphone qu'on rend ne doit plus annoncer les votes du KOP de celui qui
     s'en est servi. Ce fichier est le seul que toutes les pages chargent. */
  const NOTIF = '/api/notifications';
  const appel = async (chemin, methode = 'GET', corps) => {
    const r = await fetch(NOTIF + chemin, {
      method: methode, credentials: 'same-origin',
      headers: corps ? { 'content-type': 'application/json' } : undefined,
      body: corps ? JSON.stringify(corps) : undefined,
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json.error || `notifications ${r.status}`);
    return json;
  };
  /* La clé publique du serveur, en octets : `subscribe` ne prend pas le
     base64url que le serveur sert. */
  const octets = (b64) => {
    const brut = atob((b64 + '='.repeat((4 - b64.length % 4) % 4))
      .replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(brut, (c) => c.charCodeAt(0));
  };
  const inscription = async () => {
    if (!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.getRegistration('/');
    return (await reg?.pushManager?.getSubscription?.()) ?? null;
  };

  window.TBF_NOTIF = {
    /**
     * Où en est cet appareil. `raison` dit pourquoi on ne peut rien proposer :
     * `eteintes` (le serveur), `ios` (un iPhone hors de l'application
     * installée : Safari n'y reçoit rien), `navigateur` (pas de notifications
     * du tout), `refusees` (le joueur a dit non à la fenêtre du navigateur).
     */
    async etat() {
      const s = await appel('').catch(() => ({ actif: false }));
      if (!s.actif) return { possible: false, raison: 'eteintes' };
      const outille = 'serviceWorker' in navigator && 'PushManager' in window
        && 'Notification' in window;
      if (!outille) {
        return { possible: false, raison: etat.ios && !etat.installe ? 'ios' : 'navigateur' };
      }
      if (Notification.permission === 'denied') return { possible: false, raison: 'refusees' };
      const ins = await inscription().catch(() => null);
      const lu = ins ? await appel('/etat', 'POST', { endpoint: ins.endpoint })
        .catch(() => ({ sujets: null })) : { sujets: null };
      return { possible: true, sujets: lu.sujets ?? { kop: false, duel: false } };
    },

    /**
     * Pose les cases de cet appareil. La première case cochée ouvre la fenêtre
     * du navigateur ; toutes décochées, l'appareil est oublié. Rend les cases
     * telles que le serveur les a gardées, ou lève avec la raison.
     */
    async poser(sujets) {
      const veut = Boolean(sujets.kop || sujets.duel);
      let ins = await inscription();
      if (!veut) {
        if (ins) {
          await appel('/appareil', 'DELETE', { endpoint: ins.endpoint }).catch(() => {});
          await ins.unsubscribe().catch(() => {});
        }
        return { kop: false, duel: false };
      }
      if (Notification.permission !== 'granted') {
        const p = await Notification.requestPermission();
        if (p !== 'granted') throw new Error(p === 'denied' ? 'refusees' : 'sans_reponse');
      }
      const { cle } = await appel('');
      const reg = await navigator.serviceWorker.ready;
      if (!ins) {
        try {
          ins = await reg.pushManager.subscribe({ userVisibleOnly: true,
            applicationServerKey: octets(cle) });
        } catch (e) {
          /* Une inscription d'avant, faite avec une autre clé : on la défait
             et l'on recommence, une fois. */
          const vieille = await reg.pushManager.getSubscription();
          if (!vieille) throw e;
          await vieille.unsubscribe();
          ins = await reg.pushManager.subscribe({ userVisibleOnly: true,
            applicationServerKey: octets(cle) });
        }
      }
      const r = await appel('/appareil', 'PUT', { abonnement: ins.toJSON(), sujets });
      return r.sujets ?? { kop: false, duel: false };
    },

    /** Oublie cet appareil : à appeler **avant** la déconnexion, qui ferme la session. */
    async oublier() {
      try {
        const ins = await inscription();
        if (!ins) return;
        await appel('/appareil', 'DELETE', { endpoint: ins.endpoint }).catch(() => {});
        await ins.unsubscribe().catch(() => {});
      } catch { /* rien à oublier */ }
    },
  };

  window.addEventListener('appinstalled', () => {
    etat.installe = true;
    etat.possible = false;
    proposition = null;
    window.dispatchEvent(new CustomEvent('tbf-pwa'));
  });
})();
