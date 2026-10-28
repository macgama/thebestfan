/**
 * La visite guidée de l'accueil : sept arrêts, la première fois.
 *
 * Demandée par Gaël le 18 octobre 2026 (fil « Tutoriel du joueur ») : un
 * joueur qui arrive doit savoir où tout se trouve, sans lire une page. La
 * visite montre les choses **là où elles sont** — un projecteur sur la
 * tuile, une bulle à côté — et renvoie, à la fin, vers la page « Comment
 * jouer » (`/comment-jouer`), qui explique tout le reste.
 *
 * ## Quand elle paraît
 *
 * Une fois par appareil, sur le hub (le joueur connecté), quand l'écran
 * d'ouverture est parti et qu'aucun moment fort ne tient l'écran. Elle se
 * garde dans `localStorage` (`tbf.visite`) : pas de colonne en base pour
 * une politesse — au pire, un joueur qui change de téléphone la revoit une
 * fois, et elle se passe d'un doigt.
 *
 * `/?visite=1` la relance : c'est le bouton « Revoir la visite » de la
 * page « Comment jouer ». Un navigateur piloté (`navigator.webdriver`) ne
 * la voit pas d'elle-même — les suites de l'accueil cliquent sur les tuiles,
 * et un voile posé dessus les ferait toutes tomber ; `visite-ui` la
 * demande par l'adresse.
 *
 * ## Ce qu'elle montre
 *
 * Un arrêt dont l'élément n'est pas à l'écran (absent, caché, sans taille)
 * est sauté : la visite ne pointe jamais le vide. Les textes sont en
 * français dans ce fichier ; `langue.js` les traduit quand ils entrent dans
 * la page, comme tout le reste.
 *
 * ## Et les autres pages
 *
 * Demandé par Gaël le 28 octobre 2026 (fil « Mettre le tutoriel à niveau »,
 * choix « Bulles à la 1re visite ») : Mes Fanzzy, la fiche d'un Fanzzy (ses
 * âges et l'évolution par les écharpes), la collection, les amis et le KOP
 * ont chacun leur petite visite, la première fois qu'on les ouvre. Même
 * moteur, même voile, une clé par page (`tbf.visite.<page>`), et la même
 * porte : `?visite=1` sur l'adresse de la page. La fiche n'a pas d'adresse
 * à elle seule : elle se guette sur /fanzzy (où elle s'ouvre par-dessus) et
 * sur /fanzzy/<id>, et seulement pour un Fanzzy qu'on a — c'est là qu'elle
 * a quelque chose à montrer.
 */
(() => {
  const params = new URLSearchParams(location.search);
  const forcee = params.get('visite') === '1';

  /* Les arrêts, dans l'ordre où l'œil parcourt l'accueil. `cible` est un
     sélecteur ; sans cible, la bulle se pose au milieu. */
  const ACCUEIL = [
    { titre: 'Bienvenue dans la tribune !',
      texte: 'Une petite visite pour savoir où tout se trouve. Tu peux la passer, '
        + 'et la revoir quand tu veux depuis « Comment jouer », dans le menu.' },
    { cible: '#pile',
      titre: 'Ton Fanzzy',
      texte: 'C’est ton supporter. Il n’a pas de force : il a un cri, et ce cri '
        + 'est un geste que tu fais toi-même en jouant. Il grandit avec des écharpes.' },
    { cible: '.rail .tbf-case[href="/virage"]',
      titre: 'Le Grand Virage',
      texte: 'Pendant un vrai match, deux tribunes tirent sur la même corde. '
        + 'Entre, choisis ton camp et chante en faisant les gestes.' },
    /* La tuile, et non le grand bouton du bas : celui-ci devient « ENTRER
       DANS LE VIRAGE » pendant un match du club, et la bulle du duel
       éclairait alors le Virage. */
    { cible: '.rail .tbf-case[href="/duel-nvn"]',
      titre: 'Le duel de tribunes',
      texte: 'Ton deck contre celui d’autres supporters, sur un vrai match du jour. '
        + 'Les gestes réussis et les cartes d’action font gagner ta tribune.' },
    { cible: '.tbf-monnaie.ech',
      cible2: '.tbf-monnaie.pack',
      titre: 'Tes écharpes et tes boosters',
      texte: 'Un booster donne des Fanzzy, de l’équipement et des cartes d’action. '
        + 'Les écharpes font grandir tes Fanzzy et s’échangent à la boutique.' },
    { cible: '#burger',
      titre: 'Le menu',
      texte: 'Tout le jeu est là : les missions du jour, les mini-jeux, ton deck, '
        + 'ton KOP, tes amis, la boutique, et « Comment jouer », qui explique tout.' },
    { titre: 'À toi de jouer !',
      texte: 'Commence par les missions : elles te guident pas à pas, et chacune rapporte quelque chose.',
      fin: true,
      liens: [['/aide', 'Voir les missions', 'or'], ['/comment-jouer', 'Comment jouer']],
      bouton: 'C’est parti' },
  ];

  /* Mes Fanzzy : l'onglet MON FANZZY, celui qui s'ouvre. */
  const FANZZY = [
    { titre: 'Mes Fanzzy',
      texte: 'Ici vivent tes supporters : celui qui te représente, et tous ceux que tu as gagnés.' },
    { cible: '#tscene',
      titre: 'Ton avatar',
      texte: 'C’est lui qui entre au coup d’envoi. Ses stickers disent la poussée de son cri, '
        + 'sa famille et son âge. Touche-le pour ouvrir sa fiche.' },
    { cible: '#tvide',
      titre: 'Ta place',
      texte: 'Elle attend ton avatar, celui qui entre au coup d’envoi : '
        + 'choisis-le dans le classeur, parmi les Fanzzy que tu as.' },
    { cible: '#cri',
      titre: 'Son cri',
      texte: 'Touche-le pour l’entendre. En match, son cri désigne le geste que tu fais toi-même : '
        + 'c’est ta main qui pousse la tribune.' },
    { cible: '.nav [data-go="dex"]',
      titre: 'Le classeur',
      texte: 'Tous les Fanzzy du jeu, série par série. Ceux que tu as sont en couleur : '
        + 'choisis-y ton avatar, ou ouvre la fiche d’un autre.' },
    { cible: '.vers-deck',
      titre: 'Ton deck',
      texte: 'Les Fanzzy que tu emmènes en duel, avec leur équipement et tes cartes d’action. '
        + 'Le premier est ton titulaire.' },
    { titre: 'Faire grandir',
      texte: 'Un Fanzzy grandit avec tes écharpes, depuis sa fiche : chaque âge lui donne un nouveau '
        + 'dessin, un nouveau nom et une nouvelle histoire.',
      fin: true, liens: [['/comment-jouer#fanzzy', 'Comment jouer']] },
  ];

  /* La fiche d'un Fanzzy qu'on a (celle d'un autre n'offre qu'OUVRIR UN
     BOOSTER) : ses âges, et l'évolution. */
  const FICHE = [
    { cible: '#fiche-vitrine',
      titre: 'Sa fiche',
      texte: 'Ta carte, telle que les autres la voient. Tout ce que tu touches ici se montre '
        + 'd’abord sur elle.' },
    { cible: '#fiche-inventaire .tbf-ages',
      titre: 'Ses âges',
      texte: 'Chaque Fanzzy a trois âges : commune, rare, puis épique. La rareté, c’est son âge, '
        + 'et aucun booster ne donne une rare ou une épique : il faut le faire grandir.' },
    { cible: '#fiche-actions [data-evoluer]',
      titre: 'Évoluer',
      texte: 'Le passage à l’âge suivant se paie en écharpes, et le bouton dit combien. '
        + 'Les écharpes se gagnent avec les missions, les duels, le Virage et la collection.' },
    { cible: '#fiche-inventaire',
      titre: 'Tenues et expressions',
      texte: 'Touche une pièce pour l’essayer sur la carte, puis garde-la. Une tenue ne change que '
        + 'l’allure : jamais la force.' },
    { cible: '#fiche-lier',
      titre: 'Ton club',
      texte: 'Lié à ton club, il pousse plus fort et rapporte plus dans les matchs de ce club.' },
    { titre: 'À toi de le faire grandir',
      texte: 'Garde tes écharpes pour celui que tu joues le plus : c’est lui qui ira le plus loin.',
      fin: true, liens: [['/comment-jouer#fanzzy', 'Comment jouer']] },
  ];

  /* La collection : le niveau de collectionneur, puis les rayons. */
  const COLLECTION = [
    { titre: 'Ta collection',
      texte: 'Tout ce que tu as gagné, rangé et compté : les Fanzzy, mais aussi leurs états, leurs '
        + 'tenues, l’équipement, les cartes d’action, les stades et les cartes Ultimate.' },
    { cible: '#collectionneur',
      titre: 'Collectionneur',
      texte: 'Chaque objet différent te rapproche d’un cran, et chaque cran rapporte des écharpes, '
        + 'parfois un booster. Quand un cran est prêt, RÉCUPÉRER le verse.' },
    { cible: '#rayons',
      titre: 'Les rayons',
      texte: 'Ouvre un rayon pour feuilleter ses pages. Une case grise est à gagner ; une pastille '
        + 'dit ce qui est nouveau depuis ta dernière visite.' },
    { titre: 'Bonne chasse !',
      texte: 'Les tenues et les cartes Ultimate se collectionnent aussi, mais ne comptent pas dans les crans.',
      fin: true, liens: [['/comment-jouer#collection', 'Comment jouer']] },
  ];

  /* Les amis : les trois onglets. */
  const AMIS = [
    { titre: 'Tes amis',
      texte: 'Un ami est un lien entre deux supporters. Tu vois s’il est au Virage ou en duel, '
        + 'tu peux le défier aux tirs au but et l’inviter dans ton KOP.' },
    { cible: '[data-vue="trouver"]',
      titre: 'Trouver',
      texte: 'Cherche un pseudo, ou parcours les supporters de tes clubs, puis demande-le en ami.' },
    { cible: '[data-vue="demandes"]',
      titre: 'Les demandes',
      texte: 'Ceux qui veulent être tes amis, et les invitations dans un KOP, t’attendent ici.' },
    { cible: '.convier [data-convier]',
      titre: 'Faire venir quelqu’un',
      texte: 'Envoie ton lien à quelqu’un qui ne joue pas encore : vous serez amis dès son arrivée.' },
    { titre: 'Plus on est de fous…',
      texte: 'Tu peux aussi te montrer hors ligne, depuis le menu.',
      fin: true, liens: [['/comment-jouer#ensemble', 'Comment jouer']] },
  ];

  /* Le KOP : membre, sa bande ; sinon, les clubs où en rejoindre un. */
  const KOP = [
    { titre: 'Le KOP',
      texte: 'La bande des supporters de ton club. Tu peux avoir des amis partout, '
        + 'mais tu n’es que d’un seul KOP.' },
    { cible: '.kop-chiffres',
      titre: 'Le pot commun',
      texte: 'Quand tu joues pour ton club, une part de tes gains tombe dans le pot. '
        + 'Ce qui est versé y reste : le pot paie les bonus du KOP.' },
    { cible: '.kop-tribune',
      titre: 'Ta bande',
      texte: 'Les membres du KOP, en tribune. Invite tes amis depuis la page Amis.' },
    { cible: '.kop-vote, [data-proposer]',
      titre: 'Les bonus votés',
      texte: 'Un membre propose un bonus, le KOP vote, et le pot le paie. '
        + 'Adopté, il aide tous les membres au Virage.' },
    { cible: '.club[data-club]',
      titre: 'Rejoins ton KOP',
      texte: 'Rejoins un KOP de ton club, c’est libre. En créer un demande le PASS de tribune.' },
    { titre: 'Ensemble, plus fort',
      texte: 'Plus le KOP joue, plus le pot grossit, et plus ses bonus poussent fort.',
      fin: true, liens: [['/comment-jouer#ensemble', 'Comment jouer']] },
  ];

  const CSS = `
  .tbf-visite{position:fixed;inset:0;z-index:2147483000;pointer-events:auto}
  .tbf-visite-voile{position:absolute;inset:0;background:rgba(5,7,10,.78)}
  .tbf-visite-trou{position:absolute;border-radius:14px;pointer-events:none;
    box-shadow:0 0 0 3px var(--projo,#F5C33B),0 0 0 200vmax rgba(5,7,10,.78);
    transition:left .25s ease,top .25s ease,width .25s ease,height .25s ease}
  .tbf-visite[data-trou] .tbf-visite-voile{background:transparent}
  .tbf-visite-bulle{position:absolute;left:50%;translate:-50% 0;
    width:min(calc(100vw - 32px),420px);box-sizing:border-box;
    background:var(--panneau,#0C1118);color:var(--craie,#F2EEE4);
    border:1px solid rgba(242,238,228,.18);border-radius:14px;padding:16px 16px 14px;
    box-shadow:0 10px 30px rgba(0,0,0,.5);font-family:var(--ui,system-ui,sans-serif)}
  .tbf-visite-bulle h2{margin:0 0 6px;font-family:var(--banner,Oswald,sans-serif);
    font-weight:700;font-size:19px;letter-spacing:.04em;text-transform:uppercase;color:var(--projo,#F5C33B)}
  .tbf-visite-bulle p{margin:0;font-size:14.5px;line-height:1.5}
  .tbf-visite-pied{display:flex;align-items:center;gap:10px;margin-top:14px}
  .tbf-visite-pas{font-size:12.5px;font-weight:600;opacity:.85;margin-right:auto;white-space:nowrap}
  .tbf-visite-passer{background:none;border:0;color:var(--craie,#F2EEE4);font:inherit;
    font-size:13.5px;font-weight:600;text-decoration:underline;text-underline-offset:3px;
    min-height:44px;padding:0 8px;cursor:pointer}
  .tbf-visite-pied .tbf-plaque{min-height:44px;padding:10px 16px;font-size:14px}
  .tbf-visite-fin{display:flex;flex-direction:column;gap:10px;margin-top:14px}
  .tbf-visite-fin .tbf-plaque{width:100%}
  `;

  function enVue(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') return null;
    return r;
  }

  /** La place des deux cibles réunies, quand l'arrêt en nomme deux. */
  function zone(a) {
    const r1 = enVue(document.querySelector(a.cible));
    if (!r1) return null;
    const r2 = a.cible2 ? enVue(document.querySelector(a.cible2)) : null;
    if (!r2) return r1;
    const left = Math.min(r1.left, r2.left), top = Math.min(r1.top, r2.top);
    const right = Math.max(r1.right, r2.right), bottom = Math.max(r1.bottom, r2.bottom);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  function lancer(v, fini) {
    const arrets = v.arrets.filter((a) => !a.cible || zone(a));
    if (!document.getElementById('tbf-visite-css')) {
      const st = document.createElement('style');
      st.id = 'tbf-visite-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    const racine = document.createElement('div');
    racine.className = 'tbf-visite';
    racine.setAttribute('role', 'dialog');
    racine.setAttribute('aria-modal', 'true');
    racine.setAttribute('aria-labelledby', 'tbf-visite-titre');
    racine.innerHTML = '<div class="tbf-visite-voile"></div><div class="tbf-visite-trou" hidden></div>'
      + '<div class="tbf-visite-bulle" aria-live="polite"><h2 id="tbf-visite-titre"></h2><p></p>'
      + '<div class="tbf-visite-pied"></div></div>';
    document.body.appendChild(racine);
    const trou = racine.querySelector('.tbf-visite-trou');
    const bulle = racine.querySelector('.tbf-visite-bulle');
    const pied = racine.querySelector('.tbf-visite-pied');
    let i = 0;

    const finir = () => {
      try { localStorage.setItem(v.cle, '1'); } catch { /* vaut pour la visite */ }
      racine.remove();
      removeEventListener('resize', placer);
      removeEventListener('keydown', clavier, true);
      if (forcee) {
        try { history.replaceState(null, '', location.pathname + location.hash); } catch { /* tant pis */ }
      }
      fini?.();
    };

    function placer() {
      const a = arrets[i];
      const r = a.cible ? zone(a) : null;
      const marge = 6;
      if (r) {
        racine.dataset.trou = '';
        trou.hidden = false;
        Object.assign(trou.style, { left: `${r.left - marge}px`, top: `${r.top - marge}px`,
          width: `${r.width + marge * 2}px`, height: `${r.height + marge * 2}px` });
        const h = innerHeight;
        const haut = bulle.offsetHeight;
        // Sous la cible s'il y a la place, sinon au-dessus.
        let top = r.bottom + marge + 12;
        if (top + haut > h - 12) top = Math.max(12, r.top - marge - 12 - haut);
        bulle.style.top = `${top}px`;
      } else {
        delete racine.dataset.trou;
        trou.hidden = true;
        bulle.style.top = `${Math.max(12, (innerHeight - bulle.offsetHeight) / 2)}px`;
      }
    }

    function montrer() {
      const a = arrets[i];
      bulle.querySelector('h2').textContent = a.titre;
      bulle.querySelector('p').textContent = a.texte;
      if (a.fin) {
        pied.className = 'tbf-visite-fin';
        pied.innerHTML = (a.liens ?? []).map(([href, mot, ton]) =>
          `<a class="tbf-plaque"${ton ? ` data-ton="${ton}"` : ''} href="${href}">${mot}</a>`).join('')
          + `<button type="button" class="tbf-visite-passer" data-fin>${a.bouton ?? 'Compris'}</button>`;
        for (const l of pied.querySelectorAll('a')) l.addEventListener('click', finir);
        pied.querySelector('[data-fin]').addEventListener('click', finir);
      } else {
        pied.className = 'tbf-visite-pied';
        pied.innerHTML = `<span class="tbf-visite-pas">${i + 1} / ${arrets.length}</span>`
          + '<button type="button" class="tbf-visite-passer" data-passer>Passer</button>'
          + '<button type="button" class="tbf-plaque" data-ton="or" data-suivant>Suivant</button>';
        pied.querySelector('[data-passer]').addEventListener('click', finir);
        pied.querySelector('[data-suivant]').addEventListener('click', () => { i += 1; montrer(); });
      }
      placer();
      // La bulle a pu changer de hauteur avec sa traduction : on la repose.
      requestAnimationFrame(placer);
      (pied.querySelector('[data-suivant]') ?? pied.querySelector('a'))?.focus({ preventScroll: true });
    }

    function clavier(e) {
      if (e.key === 'Escape') { e.preventDefault(); finir(); }
    }

    addEventListener('resize', placer);
    addEventListener('keydown', clavier, true);
    montrer();
  }

  /* Un écran libre : ni dialogue, ni moment fort, ni visite déjà ouverte. */
  const libre = () => !document.querySelector('dialog[open], .tbf-moment.on, .tbf-moment[data-on], .tbf-visite');

  /* On attend le hub, la fin de l'ouverture et un écran libre. */
  function accueilPret() {
    const hub = document.getElementById('hub');
    if (!hub || !hub.classList.contains('on')) return false;
    const ouv = document.getElementById('ouverture');
    if (ouv && ouv.isConnected && !ouv.classList.contains('partie') && getComputedStyle(ouv).display !== 'none'
      && getComputedStyle(ouv).visibility !== 'hidden') return false;
    if (!libre()) return false;
    return !!enVue(document.getElementById('burger'));
  }
  const vu = (sel) => !!enVue(document.querySelector(sel));
  /* Le « Chargement… » des amis, tel que la page l'écrit : parti, la liste
     est là (la page refait son corps d'un bloc). */
  const chargement = document.querySelector('#corps > .vide');

  /* Les visites, page par page. `ici` dit si la page en porte une ; `pret`,
     si l'écran est en état de la montrer. `guet` : combien de temps on la
     guette — la fiche, qui s'ouvre quand le joueur la touche, tout le temps
     de la page. */
  const PAGES = [
    { cle: 'tbf.visite', arrets: ACCUEIL, ici: () => location.pathname === '/', pret: accueilPret },
    { cle: 'tbf.visite.fanzzy', arrets: FANZZY, ici: () => location.pathname === '/fanzzy',
      pret: () => libre() && vu('#s-equipe.on #tscene, #s-equipe.on #tvide')
        && !document.querySelector('#detail.on') },
    { cle: 'tbf.visite.fiche', arrets: FICHE, ici: () => /^\/fanzzy(\/[^/]+)?\/?$/.test(location.pathname),
      pret: () => libre() && vu('#fiche-vitrine')
        && !!document.querySelector('#fiche-actions > *')
        && !document.querySelector('#fiche-actions a[href="/boosters"]'),
      guet: Infinity },
    { cle: 'tbf.visite.collection', arrets: COLLECTION, ici: () => location.pathname === '/collection',
      pret: () => libre() && vu('#rayons') && !document.querySelector('#vitr.on') },
    { cle: 'tbf.visite.amis', arrets: AMIS, ici: () => location.pathname === '/amis',
      pret: () => libre() && vu('#onglets') && !chargement?.isConnected },
    { cle: 'tbf.visite.kop', arrets: KOP, ici: () => location.pathname === '/kop',
      pret: () => libre() && !document.getElementById('charge') && vu('#corps') },
  ];

  const aVoir = PAGES.filter((v) => {
    if (!v.ici()) return false;
    if (forcee) return true;
    let deja = false;
    try { deja = localStorage.getItem(v.cle) === '1'; } catch { /* sans stockage : on la montre */ }
    return !deja && !navigator.webdriver;
  });
  if (!aVoir.length) return;

  /* Une à la fois, dans l'ordre : sur /fanzzy, celle de la page d'abord,
     puis celle de la fiche quand le joueur en ouvre une. Au plus une
     demi-minute par visite, sauf `guet` : passé ce délai, elle attendra la
     prochaine fois. */
  function guetter(v, suite) {
    const debut = Date.now();
    const tour = () => {
      if (v.pret()) {
        setTimeout(() => { if (v.pret()) lancer(v, suite); else setTimeout(tour, 400); }, 900);
        return;
      }
      if (Date.now() - debut < (v.guet ?? 30000)) setTimeout(tour, 400);
      else suite();
    };
    tour();
  }
  const enchainer = () => { const v = aVoir.shift(); if (v) guetter(v, enchainer); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', enchainer);
  else enchainer();
})();
