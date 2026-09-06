/**
 * Barre de navigation commune.
 *
 * Un seul fichier inclus partout plutôt que la même barre recopiée dans neuf
 * pages : le jour où une entrée change, elle change une fois. Elle apporte
 * aussi le décor ambiant — fond assombri et braises — pour que toutes les
 * pages appartiennent visiblement au même jeu.
 *
 * Elle ne s'affiche pas sur les écrans où elle gênerait : la connexion, la
 * cérémonie d'arrivée, et les deux écrans de jeu où chaque pixel compte.
 */
(() => {
  // Écrans où la barre n'a pas sa place : la connexion et la cérémonie
  // d'arrivée, qui sont des parcours dont on ne sort pas au milieu.
  const SANS_BARRE = ['/compte', '/bienvenue'];

  // Écrans de jeu : la barre est là, mais elle s'efface dès qu'on joue et
  // revient au moindre arrêt. Sans elle, le Virage était un cul-de-sac ;
  // toujours affichée, elle mangerait la place et provoquerait des sorties
  // accidentelles en plein chant.
  const ECRANS_DE_JEU = ['/duel', '/duel-nvn', '/virage'];
  const chemin = location.pathname.replace(/\/$/, '') || '/';
  if (SANS_BARRE.includes(chemin)) return;

  const ENTREES = [
    { href: '/', k: 'accueil', t: 'ACCUEIL', d: 'M3 9l9-6 9 6v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
    { href: '/virage', k: 'virage', t: 'VIRAGE', d: 'M3 20l9-16 9 16zM7 20l5-9 5 9' },
    { href: '/fanzzy', k: 'fanzzy', t: 'FANZZY', d: 'M4 4h13l3 3v13H4zM8 8h6M8 12h8M8 16h5' },
    // Les matchs du jour passent devant le télétexte : c'est ce qu'on vient
    // chercher neuf fois sur dix. Les classements restent à un toucher.
    { href: '/matchs', k: 'teletext', t: 'MATCHS', d: 'M3 5h18v14H3zM3 9h18M8 9v10' },
    { href: '/classement', k: 'classement', t: 'CLASSEMENT',
      d: 'M6 21V9M12 21V4M18 21v-7M3 21h18' },
    { href: '/profil', k: 'profil', t: 'PROFIL',
      d: 'M12 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7' },
  ];

  const css = `
  :root{--nav-h:62px}
  body{padding-bottom:calc(var(--nav-h) + env(safe-area-inset-bottom)) !important}
  body.tbf-jeu{padding-bottom:0 !important}
  body.tbf-jeu #app{padding-bottom:calc(var(--nav-h) * .55 + env(safe-area-inset-bottom))}
  #tbf-amb{position:fixed;inset:0;z-index:-2;background-size:cover;background-position:center 25%;
    opacity:0;transition:opacity 1.8s;pointer-events:none}
  #tbf-amb.on{opacity:.16}
  #tbf-veil{position:fixed;inset:0;z-index:-1;pointer-events:none;
    background:radial-gradient(120% 70% at 50% 20%,transparent,rgba(4,6,10,.75) 65%,#04060A)}
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
  .tbf-spark{position:fixed;width:3px;height:3px;border-radius:50%;z-index:-1;pointer-events:none;opacity:0}
  @media (prefers-reduced-motion:reduce){#tbf-nav a{transition:none}}`;

  const COUL = { accueil:'#F2EEE4', virage:'#F5C33B', fanzzy:'#8257DA',
                 teletext:'#C2CAD6', classement:'#3C82E8', profil:'#1E9E6A' };

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  if (ECRANS_DE_JEU.includes(chemin)) document.body.classList.add('tbf-jeu');

  // Décor : la même illustration que l'accueil, très assombrie.
  const amb = document.createElement('div');
  amb.id = 'tbf-amb';
  const veil = document.createElement('div');
  veil.id = 'tbf-veil';
  document.body.append(amb, veil);
  const img = new Image();
  img.onload = () => { amb.style.backgroundImage = `url("${img.src}")`; amb.classList.add('on'); };
  img.onerror = () => {};
  img.src = 'img/hero.avif';

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
