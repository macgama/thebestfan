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

  const ENTREES = [
    { href: '/', k: 'accueil', t: 'ACCUEIL', d: 'M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    { href: '/virage', k: 'virage', t: 'VIRAGE', d: 'M3 20l9-16 9 16zM7 20l5-9 5 9' },
    // Le duel de tribunes. Il pointe sur le tir à la corde, pas sur l'ancien
    // tour par tour de /duel, qui n'est plus mis en avant.
    { href: '/duel-nvn', k: 'duel', t: 'DUEL', d: 'M4 4l7 7M20 4l-7 7M12 13v7M8 20h8' },
    { href: '/fanzzy', k: 'fanzzy', t: 'FANZZY', d: 'M4 4h13l3 3v13H4zM8 8h6M8 12h8M8 16h5' },
    // Les matchs du jour passent devant le télétexte : c'est ce qu'on vient
    // chercher neuf fois sur dix. Les classements restent à un toucher.
    { href: '/matchs', k: 'teletext', t: 'MATCHS', d: 'M3 5h18v14H3zM3 9h18M8 9v10' },
    { href: '/classement', k: 'classement', t: 'CLASSEMENT',
      d: 'M6 21V9M12 21V4M18 21v-7M3 21h18' },
    { href: '/profil', k: 'profil', t: 'PROFIL',
      d: 'M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7' },
  ];

  /* Ce qui reste ici plutôt que dans ui.css : la barre du bas est entièrement
     construite en JavaScript, ses règles n'ont donc aucun sens sans elle. Le
     reste de l'habillage — décor, barre du haut, menu — est stylé par la
     feuille commune, que chaque page charge. */
  const css = `
  :root{--nav-h:62px}
  body{padding-bottom:calc(var(--nav-h) + env(safe-area-inset-bottom)) !important}
  body.tbf-jeu{padding-bottom:0 !important}
  body.tbf-jeu #app{padding-bottom:calc(var(--nav-h) * .55 + env(safe-area-inset-bottom))}
  #tbf-nav{position:fixed;left:0;right:0;bottom:0;height:calc(var(--nav-h) + env(safe-area-inset-bottom));
    padding-bottom:env(safe-area-inset-bottom);z-index:60;display:flex;
    background:linear-gradient(180deg,rgba(8,11,16,.75),#080B10 55%);
    border-top:1px solid rgba(242,238,228,.11);backdrop-filter:blur(10px)}
  #tbf-nav a{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
    text-decoration:none;color:#F2EEE4;opacity:.42;font-family:"Oswald","Arial Narrow",Impact,sans-serif;
    font-size:8px;letter-spacing:.08em;position:relative;transition:opacity .18s}
  #tbf-nav a.on{opacity:1;color:var(--c)}
  #tbf-nav a.on::before{content:"";position:absolute;top:0;left:26%;right:26%;height:2px;
    background:var(--c);border-radius:0 0 3px 3px;box-shadow:0 0 12px var(--c)}
  #tbf-nav svg{width:20px;height:20px}
  #tbf-nav.tbf-discret{background:linear-gradient(180deg,rgba(8,11,16,.4),rgba(8,11,16,.92) 55%);
    transition:opacity .45s,transform .45s}
  #tbf-nav.tbf-cache{opacity:.12;transform:translateY(58%)}
  #tbf-nav .pip{position:absolute;top:9px;right:calc(50% - 17px);width:7px;height:7px;border-radius:50%;
    background:#E0402C;box-shadow:0 0 8px #E0402C;animation:tbfblink 1.3s infinite}
  @keyframes tbfblink{0%,100%{opacity:1}50%{opacity:.25}}
  .tbf-spark{position:fixed;width:3px;height:3px;border-radius:50%;z-index:0;pointer-events:none;opacity:0}
  @media (prefers-reduced-motion:reduce){#tbf-nav a{transition:none}}`;

  const COUL = { accueil:'#F2EEE4', virage:'#F5C33B', duel:'#E0402C', fanzzy:'#8257DA',
                 teletext:'#C2CAD6', classement:'#3C82E8', profil:'#1E9E6A' };

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  if (ECRANS_DE_JEU.includes(chemin)) document.body.classList.add('tbf-jeu');

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
    if (!app || ECRANS_DE_JEU.includes(chemin)) return;

    let user = null;
    try {
      const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
      if (r.ok) user = (await r.json()).user;
    } catch { /* hors ligne */ }
    if (!user) return;

    const haut = document.createElement('header');
    haut.className = 'tbf-haut';
    haut.innerHTML = `
      <a class="pan tbf-moi" href="/profil">
        <span class="tbf-pastille">${(user.pseudo ?? '?').trim().charAt(0).toLowerCase() || '?'}</span>
        <span><b></b><small></small></span>
      </a>
      <div class="tbf-bourse">
        <div class="pan tbf-jeton" data-jeton="ech"><i></i><span data-ech>0</span></div>
        <div class="pan tbf-jeton" data-jeton="pack"><i></i><span data-pack>0</span></div>
        <button class="pan tbf-burger" aria-label="Menu" aria-expanded="false"
          aria-controls="tbf-tiroir"><span></span><span></span><span></span></button>
      </div>`;
    // `textContent` et non une interpolation : un pseudo est écrit par le
    // joueur, il n'a rien à faire dans du HTML assemblé à la main.
    haut.querySelector('.tbf-moi b').textContent = user.pseudo ?? '';
    app.prepend(haut);

    const tiroir = document.createElement('nav');
    tiroir.id = 'tbf-tiroir';
    tiroir.className = 'tbf-tiroir';
    tiroir.setAttribute('aria-label', 'Le reste du jeu');
    tiroir.hidden = true;
    tiroir.innerHTML = item('/deck', 'deck', 'Mon deck')
      + item('/profil', 'profil', 'Mon profil')
      + item('/equipes', 'clubs', 'Mes clubs')
      + item('/kop', 'kop', 'Mon KOP')
      + item('/amis', 'amis', 'Mes amis')
      + item('/teletext', 'teletext', 'Télétexte')
      + '<hr>'
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
    try {
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
        if (scarves != null) haut.querySelector('[data-ech]').textContent = scarves;
        if (packs != null) haut.querySelector('[data-pack]').textContent = packs;
      },
    };

    return { tiroir, haut };
  }

  const enHaut = barreDuHaut();

  /* --------------------------------------------------- la barre du bas */

  const nav = document.createElement('nav');
  nav.id = 'tbf-nav';
  nav.innerHTML = ENTREES.map((e) => {
    const actif = chemin === e.href || (e.href !== '/' && chemin.startsWith(e.href))
      || (e.href === '/matchs' && chemin === '/teletext');
    return `<a href="${e.href}" class="${actif ? 'on' : ''}" style="--c:${COUL[e.k]}" data-k="${e.k}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
        stroke-linecap="round" stroke-linejoin="round"><path d="${e.d}"/></svg>${e.t}</a>`;
  }).join('');
  document.body.appendChild(nav);

  if (ECRANS_DE_JEU.includes(chemin)) {
    nav.classList.add('tbf-discret');
    let minuterie = null;
    const reveiller = () => {
      nav.classList.remove('tbf-cache');
      clearTimeout(minuterie);
      minuterie = setTimeout(() => nav.classList.add('tbf-cache'), 4000);
    };
    reveiller();
    // Toute action dans la page repousse la disparition ; l'inaction la
    // ramène. C'est le comportement d'une barre d'application vidéo.
    for (const evt of ['pointerdown', 'pointerup', 'scroll']) {
      document.addEventListener(evt, reveiller, { passive: true });
    }
  }

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

  /* Pastille rouge sur le virage quand un match des clubs suivis est en cours. */
  (async () => {
    try {
      const r = await fetch('/api/virage/live', { credentials: 'same-origin' });
      if (!r.ok) return;
      const { matchs = [] } = await r.json();
      if (!matchs.some((m) => m.open)) return;
      const a = nav.querySelector('[data-k="virage"]');
      if (a) a.insertAdjacentHTML('beforeend', '<span class="pip"></span>');
    } catch { /* module non monté */ }
  })();
})();
