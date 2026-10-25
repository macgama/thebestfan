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

  /* ---------------------------------------------------- la mise à jour

     **Une page ouverte ne savait pas qu'elle était d'hier.** Les pages sont
     servies neuves à chaque navigation (`no-store`, adresses estampillées :
     voir `src/server/empreintes.js`). Mais une application posée sur l'écran
     d'un téléphone ne navigue pas : on la rouvre, elle revient telle qu'on
     l'avait laissée, parfois des jours plus tard, avec le code d'avant la mise
     en ligne — un client d'hier qui parle au serveur d'aujourd'hui.

     Chaque page porte donc la construction dont elle est faite
     (`<meta name="tbf-construction">`, posé par `page()` dans `server.js`), et
     `/api/version` dit celle que le serveur sert. Quand elles diffèrent, un
     écran « mise à jour » recouvre le jeu une seconde et la page se recharge.

     On demande quand ça peut avoir changé : à l'ouverture, au retour de
     l'application au premier plan, au retour du réseau, et toutes les cinq
     minutes tant qu'elle est sous les yeux — une mise en ligne coupe de toute
     façon le direct, le serveur redémarre.

     **Comme le service worker, ça échoue ouvert.** Pas de réponse, une réponse
     sans construction, un serveur d'essai sans cette route : rien ne se passe.
     Et deux rechargements qui ne ramènent pas la bonne construction (un proxy
     qui s'obstine) font abandonner : mieux vaut une page d'hier qu'une page
     qui se recharge sans fin. */
  (() => {
    const SUIVI = 'tbf-maj';
    const lireSuivi = () => {
      try { return JSON.parse(sessionStorage.getItem(SUIVI) || 'null'); } catch { return null; }
    };
    const ecrireSuivi = (v) => {
      try {
        if (v) sessionStorage.setItem(SUIVI, JSON.stringify(v));
        else sessionStorage.removeItem(SUIVI);
      } catch { /* navigation privée : pas de garde, on n'insiste pas */ }
    };

    /* La construction de cette page. Sans la balise — une page servie hors de
       `page()` —, la première réponse du serveur sert de repère : la page ne
       se rechargera qu'à la mise en ligne suivante. */
    let mienne = document.querySelector('meta[name="tbf-construction"]')?.content || null;

    /* Revenue d'une mise à jour : le suivi n'a plus d'objet, et l'adresse perd
       le `?maj=` du second essai, qui n'a servi qu'à passer à côté d'un cache. */
    const suivi = lireSuivi();
    if (suivi && mienne && suivi.cible === mienne) ecrireSuivi(null);
    try {
      const u = new URL(location.href);
      if (u.searchParams.has('maj')) {
        u.searchParams.delete('maj');
        history.replaceState(history.state, '', u.pathname + u.search + u.hash);
      }
    } catch { /* l'adresse reste telle quelle : sans conséquence */ }

    let lancee = false;
    let derniere = 0;

    /* Un joueur qui écrit (un message, un nom de KOP, un réglage) ne perd pas
       ce qu'il tape : on attend qu'il quitte le champ. */
    const ecrit = () => {
      const a = document.activeElement;
      return Boolean(a && (a.isContentEditable
        || (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)
          && !/^(button|submit|checkbox|radio|range)$/i.test(a.type || ''))));
    };

    const ECRAN_STYLE = `
      #tbf-maj{position:fixed;inset:0;z-index:2147483647;display:flex;
        align-items:center;justify-content:center;text-align:center;
        background:#05070A;color:#F2EEE4;
        font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
        animation:tbf-maj-entre .25s ease-out}
      #tbf-maj div{padding:32px;max-width:340px;line-height:1.7}
      #tbf-maj b{display:block;font-size:19px;letter-spacing:.12em;margin-bottom:14px;color:#F5C33B}
      #tbf-maj small{display:block;opacity:.7;font-size:13px}
      #tbf-maj i{display:block;height:4px;margin:24px auto 0;width:180px;border-radius:2px;
        background:rgba(245,195,59,.18);overflow:hidden}
      #tbf-maj i::after{content:"";display:block;height:100%;width:100%;background:#F5C33B;
        transform-origin:left;animation:tbf-maj-charge 1.4s ease-in-out forwards}
      @keyframes tbf-maj-entre{from{opacity:0}to{opacity:1}}
      @keyframes tbf-maj-charge{from{transform:scaleX(.05)}to{transform:scaleX(1)}}
      @media (prefers-reduced-motion:reduce){#tbf-maj,#tbf-maj i::after{animation:none}}`;

    const montrer = () => {
      if (document.getElementById('tbf-maj') || !document.body) return;
      const style = document.createElement('style');
      style.textContent = ECRAN_STYLE;
      const ecran = document.createElement('section');
      ecran.id = 'tbf-maj';
      ecran.setAttribute('role', 'status');
      ecran.setAttribute('aria-live', 'assertive');
      ecran.innerHTML = '<div><b>MISE À JOUR DU JEU</b>'
        + '<small>Une nouvelle version vient d’arriver. On recharge, tu ne perds rien.</small>'
        + '<i aria-hidden="true"></i></div>';
      document.head.appendChild(style);
      document.body.appendChild(ecran);
    };

    const lancer = async (cible) => {
      const avant = lireSuivi();
      const essais = avant?.cible === cible ? avant.essais : 0;
      if (essais >= 2) {
        // Deux rechargements pour rien : on n'insiste plus pour cette construction.
        mienne = cible;
        console.warn('[maj] la nouvelle construction ne vient pas :', cible);
        return;
      }
      lancee = true;
      ecrireSuivi({ cible, essais: essais + 1 });
      montrer();
      /* Le service worker d'à côté d'abord, s'il a changé lui aussi : la page
         rechargée doit tomber sur le nouveau. Plafonné, il ne doit pas retenir
         l'écran. */
      const sw = (async () => {
        try { await (await navigator.serviceWorker?.getRegistration?.('/'))?.update?.(); }
        catch { /* il se mettra à jour à son tour */ }
      })();
      await Promise.all([
        Promise.race([sw, new Promise((ok) => setTimeout(ok, 3000))]),
        new Promise((ok) => setTimeout(ok, 1400)),
      ]);
      if (essais === 0) { location.reload(); return; }
      /* Le second essai change l'adresse : un proxy qui a gardé l'ancienne page
         ne peut pas la rendre pour celle-ci. */
      const u = new URL(location.href);
      u.searchParams.set('maj', cible);
      location.replace(u.href);
    };

    const verifier = async (presse = false) => {
      if (lancee || document.visibilityState === 'hidden') return;
      if (!presse && Date.now() - derniere < 30_000) return;
      derniere = Date.now();
      let servie;
      try {
        const r = await fetch('/api/version', { cache: 'no-store', credentials: 'same-origin' });
        if (!r.ok) return;
        servie = (await r.json())?.construction;
      } catch { return; }
      if (typeof servie !== 'string' || !/^[0-9a-f]{6,40}$/.test(servie)) return;
      if (!mienne) { mienne = servie; return; }
      if (servie === mienne) return;
      if (ecrit()) {
        document.addEventListener('focusout', () => setTimeout(() => verifier(true), 300),
          { once: true });
        return;
      }
      await lancer(servie);
    };

    window.TBF_MAJ = { verifier: () => verifier(true) };

    if (document.readyState === 'complete') verifier(true);
    else window.addEventListener('load', () => verifier(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') verifier(true);
    });
    // Revenue du cache arrière du navigateur : c'est la page d'avant, telle quelle.
    window.addEventListener('pageshow', (e) => { if (e.persisted) verifier(true); });
    window.addEventListener('online', () => verifier(true));
    setInterval(() => verifier(), 5 * 60_000);
  })();

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
  /* Les cases, telles que le serveur les nomme (`SUJETS`). */
  const SUJETS = ['kop', 'duel', 'club', 'virage', 'amis'];
  const aucune = () => Object.fromEntries(SUJETS.map((s) => [s, false]));
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
      return { possible: true, sujets: lu.sujets ?? aucune() };
    },

    /**
     * Pose les cases de cet appareil. La première case cochée ouvre la fenêtre
     * du navigateur ; toutes décochées, l'appareil est oublié. Rend les cases
     * telles que le serveur les a gardées, ou lève avec la raison.
     */
    async poser(sujets) {
      const veut = SUJETS.some((s) => sujets[s]);
      let ins = await inscription();
      if (!veut) {
        if (ins) {
          await appel('/appareil', 'DELETE', { endpoint: ins.endpoint }).catch(() => {});
          await ins.unsubscribe().catch(() => {});
        }
        return aucune();
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
      return r.sujets ?? aucune();
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

  /* **Le jeu ouvert** : `sw.js` ne montre pas la notification par-dessus, il
     nous la passe. On la pose en bandeau, sur un appui elle mène où elle
     parle — sauf si l'on y est déjà, ou si `duel-rappel.js` la dit déjà
     (l'invitation d'un ami en duel, avec son pseudo). */
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      const m = e.data;
      if (m?.type !== 'tbf-notif' || !m.titre) return;
      if (m.tag === 'amis-duel') return;
      let cible;
      try { cible = new URL(m.url || '/', location.origin); } catch { return; }
      if (cible.origin !== location.origin) return;
      const ici = (p) => p.replace(/\/$/, '') || '/';
      if (ici(cible.pathname) === ici(location.pathname)) return;
      let pile = document.querySelector('body > .tbf-pile');
      if (!pile) {
        pile = document.createElement('div');
        pile.className = 'tbf-pile';
        document.body.append(pile);
      }
      pile.querySelector(`[data-notif="${CSS.escape(String(m.tag ?? ''))}"]`)?.remove();
      const a = document.createElement('a');
      a.className = 'tbf-toast tbf-notif-bandeau';
      a.href = cible.pathname + cible.search;
      a.dataset.notif = String(m.tag ?? '');
      a.setAttribute('role', 'status');
      a.style.cssText = 'flex-direction:column;align-items:flex-start;gap:2px;text-decoration:none';
      const titre = document.createElement('span');
      titre.textContent = m.titre;
      const corps = document.createElement('small');
      corps.textContent = m.corps || '';
      corps.style.cssText = 'font-weight:400;letter-spacing:0;opacity:.85;font-size:12px';
      a.append(titre, corps);
      pile.append(a);
      setTimeout(() => a.remove(), 10_000);
    });
  }

  window.addEventListener('appinstalled', () => {
    etat.installe = true;
    etat.possible = false;
    proposition = null;
    window.dispatchEvent(new CustomEvent('tbf-pwa'));
  });
})();
