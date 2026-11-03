/**
 * La vitrine vivante : la page d'accueil de qui n'a pas encore de compte.
 *
 * Demande de Gaël (3 novembre 2026) : « améliorer la page d'accueil et la
 * rendre un peu plus vivante — gaming (animation). Attention, le PASS s'ouvre
 * le 1er décembre. » Le hub connecté vit déjà (`accueil-vivant.js`) ; la
 * vitrine, elle, était posée d'un bloc et ne bougeait plus.
 *
 * Trois choses, sans un octet de vidéo :
 *
 * - **l'entrée**, une fois le rideau de chargement levé : le nom du jeu
 *   tombe lettre par lettre et « BEST » claque en or, les trois promesses
 *   sautent l'une après l'autre, le direct glisse, la porte « PRENDRE MA
 *   PLACE » tombe avec une onde de choc, et les visages se distribuent
 *   comme des cartes qu'on retourne ;
 * - **la vie**, toutes les six à onze secondes et jamais deux fois la même
 *   chose : un éclat d'or court sur « BEST », un reflet et des étincelles
 *   sur la porte, une ola sur les trois promesses, un visage qui saute, des
 *   flashs de photographes dans la tribune, des braises qui montent ;
 * - **le PASS « bientôt »** : avant son ouverture, la bande du PASS porte un
 *   sticker BIENTÔT et un compte à rebours (« J-28 », puis les heures le
 *   dernier jour). La date vient du serveur (la saison annoncée, servie avec
 *   `/api/fanzzy/jouables`) ; sans annonce, le 1er décembre 2026.
 *
 * Et un **but** : quand le battement de la vitrine rapporte un score qui a
 * bougé, la ligne du match s'allume et un sticker « BUT ! » y claque.
 *
 * ## Pas une animation sans fin de plus
 *
 * La vitrine a déjà deux boucles CSS (l'emblème qui flotte, le point du
 * direct). Tout ici est joué une fois, au script (`Element.animate`), puis
 * relancé par une minuterie espacée : rien ne tourne dans un onglet caché ni
 * sous l'écran de chargement. Le mode calme du tiroir et « moins de
 * mouvement » éteignent tout, l'entrée comprise ; le compte à rebours, lui,
 * reste — c'est une information, pas un décor. Tout se joue dans `#app`, qui
 * est la colonne : rien ne déborde sur un écran large.
 */
(() => {
  if (window.TBF_VITRINE_VIVANTE) return;

  /** Le jour d'ouverture du PASS 1 si le serveur n'annonce rien (Gaël, 3 novembre 2026). */
  const OUVERTURE_PAR_DEFAUT = '2026-12-01';

  const $ = (id) => document.getElementById(id);
  const doux = () => (typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');
  const hasard = (a, b) => a + Math.random() * (b - a);
  const anim = (el, images, o) => {
    try { return el?.animate(images, o) ?? null; } catch { return null; }
  };
  const ressort = 'cubic-bezier(.2,1.35,.35,1)';

  const css = document.createElement('style');
  css.textContent = `
  .vv-l{display:inline-block;will-change:transform}
  .logo em .vv-l{text-shadow:0 0 0 rgba(245,195,59,0)}
  .vv-calque{position:absolute;inset:0;z-index:2;overflow:hidden;pointer-events:none}
  .vv-calque.vv-devant{z-index:4}
  .vv-flash{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;opacity:0;
    mix-blend-mode:screen;
    background:radial-gradient(circle,#fff 0 12%,rgba(255,250,235,.9) 20%,rgba(255,240,200,0) 50%),
      linear-gradient(90deg,transparent 0 47%,#fff 50%,transparent 53% 100%) center/100% 3px no-repeat,
      linear-gradient(0deg,transparent 0 47%,#fff 50%,transparent 53% 100%) center/3px 100% no-repeat}
  .vv-braise{position:absolute;bottom:-8px;width:4px;height:4px;border-radius:50%;opacity:0;
    background:#FFD66B;box-shadow:0 0 6px 2px rgba(245,195,59,.75)}
  .vv-etincelle{position:absolute;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;border-radius:50%;
    background:#FFE08A;box-shadow:0 0 6px 2px rgba(255,200,70,.85);pointer-events:none;opacity:0}
  .vv-onde{position:absolute;inset:0;border-radius:inherit;pointer-events:none;opacity:0;
    box-shadow:0 0 0 3px rgba(255,214,107,.9),0 0 24px 6px rgba(224,64,44,.55)}
  .vv-reflet{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}
  .vv-reflet i{position:absolute;top:0;bottom:0;left:0;width:34%;opacity:0;
    background:linear-gradient(105deg,transparent,rgba(255,250,235,.45),transparent)}
  .cta,.vpass,.sc{position:relative}
  .eventail i{transform-style:preserve-3d;transition:transform .18s ease,box-shadow .18s ease}
  .eventail i:hover{transform:translateY(-4px) rotate(-2deg);
    box-shadow:0 6px 16px rgba(0,0,0,.45),0 0 0 1px rgba(245,195,59,.55)}
  .vv-but{position:absolute;right:46px;top:50%;--rot:-8deg;translate:0 -50%;z-index:2;
    --face:var(--flare,#E0402C);--lettre:var(--craie,#F4EFE6)}
  .sc.vv-allume{box-shadow:0 0 0 1px rgba(224,64,44,.9),0 0 18px rgba(224,64,44,.45)}
  @media (prefers-reduced-motion:reduce){.vv-calque,.vv-reflet{display:none}
    .eventail i{transition:none}.eventail i:hover{transform:none}}
  html[data-calme~="animations"] :is(.vv-calque,.vv-reflet){display:none}
  html[data-calme~="animations"] .eventail i:hover{transform:none}`;
  document.head.append(css);

  /* ------------------------------------------------------- les calques */

  let calque = null; // derrière la vitrine : les flashs, dans la foule
  let devant = null; // devant elle : les braises et les étincelles
  let lettres = [];
  let best = [];

  /** Le nom du jeu, lettre par lettre : le texte reste le même pour qui le lit. */
  function decouperLogo() {
    const logo = document.querySelector('#vitrine .logo');
    if (!logo || logo.dataset.vv) return;
    logo.dataset.vv = '1';
    const couper = (noeud) => {
      const frag = document.createDocumentFragment();
      for (const c of noeud.textContent) {
        const s = document.createElement('span');
        s.className = 'vv-l';
        s.textContent = c;
        frag.append(s);
      }
      noeud.replaceWith(frag);
    };
    for (const n of [...logo.childNodes]) {
      if (n.nodeType === 3 && n.textContent.trim()) couper(n);
      else if (n.nodeName === 'EM' && n.firstChild) couper(n.firstChild);
    }
    lettres = [...logo.querySelectorAll('.vv-l')];
    best = [...logo.querySelectorAll('em .vv-l')];
  }

  function poser() {
    const app = $('app');
    if (app && !calque) {
      calque = document.createElement('div');
      calque.className = 'vv-calque';
      calque.setAttribute('aria-hidden', 'true');
      /* Devant le décor, derrière la vitrine (z-index 3). */
      const vitrine = $('vitrine');
      if (vitrine) vitrine.before(calque); else app.prepend(calque);
      devant = calque.cloneNode();
      devant.classList.add('vv-devant');
      app.append(devant);
    }
    const cta = document.querySelector('#vitrine .cta');
    if (cta && !cta.querySelector('.vv-reflet')) {
      const r = document.createElement('span');
      r.className = 'vv-reflet';
      r.setAttribute('aria-hidden', 'true');
      r.append(document.createElement('i'));
      cta.append(r);
    }
    decouperLogo();
  }

  /* ---------------------------------------------------------- l'entrée */

  function entrer() {
    if (doux()) return;
    const v = $('vitrine');
    const emb = v.querySelector('.embleme');
    anim(emb, [{ opacity: 0, transform: 'scale(.2) rotate(-200deg)' },
      { opacity: 1, transform: 'scale(1.18) rotate(10deg)', offset: 0.7 },
      { opacity: 1, transform: 'scale(1) rotate(0)' }],
    { duration: 700, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'backwards' });

    lettres.forEach((l, k) => {
      anim(l, [{ opacity: 0, transform: 'translateY(-46px) scale(1.8)', filter: 'blur(4px)' },
        { opacity: 1, transform: 'translateY(3px) scale(.96)', filter: 'blur(0)', offset: 0.75 },
        { opacity: 1, transform: 'none', filter: 'blur(0)' }],
      { duration: 420, delay: 220 + k * 45, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'backwards' });
    });
    const finLogo = 220 + lettres.length * 45 + 380;
    /* « BEST » claque : un éclat d'or et la page qui tremble. */
    setTimeout(() => {
      best.forEach((l, k) => anim(l, [{ textShadow: '0 0 0 rgba(245,195,59,0)' },
        { textShadow: '0 0 18px rgba(255,214,107,1)', offset: 0.3 },
        { textShadow: '0 0 0 rgba(245,195,59,0)' }], { duration: 700, delay: k * 40 }));
      anim(v.querySelector('.pitch'), [{ transform: 'none' }, { transform: 'translate(-3px,2px)' },
        { transform: 'translate(3px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'none' }],
      { duration: 260 });
    }, finLogo);

    const montee = (el, delai, de = '0 16px') => anim(el,
      [{ opacity: 0, translate: de }, { opacity: 1, translate: '0 0' }],
      { duration: 420, delay: delai, easing: ressort, fill: 'backwards' });
    for (const [sel, d] of [['.logo small', 480], ['.beta', 560], ['.claim', 640], ['.sell', 720]]) {
      montee(v.querySelector(sel), d);
    }
    v.querySelectorAll('.bullet').forEach((b, k) => anim(b,
      [{ opacity: 0, transform: 'scale(.55) rotate(-6deg)' },
        { opacity: 1, transform: 'scale(1.08) rotate(1deg)', offset: 0.6 },
        { opacity: 1, transform: 'none' }],
      { duration: 460, delay: 780 + k * 110, easing: 'ease-out', fill: 'backwards' }));

    montee($('vDirect'), 1050, '-40px 0');
    v.querySelectorAll('#vScores .sc').forEach((s, k) => montee(s, 1150 + k * 90, '-30px 0'));

    const cta = v.querySelector('.cta');
    anim(cta, [{ opacity: 0, transform: 'translateY(-60px) scale(1.15)' },
      { opacity: 1, transform: 'translateY(4px) scale(.97)', offset: 0.6 },
      { opacity: 1, transform: 'translateY(-2px) scale(1.01)', offset: 0.8 },
      { opacity: 1, transform: 'none' }],
    { duration: 620, delay: 1300, easing: 'ease-out', fill: 'backwards' });
    setTimeout(() => { onde(cta); etincelles(cta, 14); }, 1300 + 380);
    montee(v.querySelector('.second'), 1500);
    montee($('vPass'), 1600, '40px 0');

    v.querySelectorAll('#vEventail i').forEach((f, k) => anim(f,
      [{ opacity: 0, transform: `translateY(40px) rotate(${hasard(-14, 14)}deg) rotateY(90deg)` },
        { opacity: 1, transform: 'translateY(-6px) rotateY(0)', offset: 0.7 },
        { opacity: 1, transform: 'none' }],
      { duration: 520, delay: 1700 + k * 90, easing: 'ease-out', fill: 'backwards' }));
  }

  /* --------------------------------------------------------- les effets */

  /** Une onde de choc autour d'un bloc. */
  function onde(el) {
    if (!el) return;
    const o = document.createElement('span');
    o.className = 'vv-onde';
    o.setAttribute('aria-hidden', 'true');
    el.append(o);
    const a = anim(o, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.12,1.5)' }],
      { duration: 600, easing: 'ease-out' });
    if (a) a.onfinish = () => o.remove(); else o.remove();
  }

  /** Des étincelles qui partent des bords d'un bloc. */
  function etincelles(el, n = 10) {
    if (!el || !devant) return;
    const r = el.getBoundingClientRect();
    const c = devant.getBoundingClientRect();
    for (let k = 0; k < n; k++) {
      const s = document.createElement('i');
      s.className = 'vv-etincelle';
      const gauche = Math.random() < 0.5;
      const x = (gauche ? r.left + 6 : r.right - 6) - c.left;
      const y = r.top + hasard(0.2, 0.8) * r.height - c.top;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      devant.append(s);
      const dx = (gauche ? -1 : 1) * hasard(20, 70);
      const dy = hasard(-60, 20);
      const a = anim(s, [{ opacity: 1, transform: 'translate(0,0) scale(1)' },
        { opacity: 0, transform: `translate(${dx}px,${dy}px) scale(.3)` }],
      { duration: hasard(500, 900), delay: k * 18, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'backwards' });
      if (a) a.onfinish = () => s.remove(); else s.remove();
    }
  }

  /* ------------------------------------------------------------ la vie */

  /** Un éclat d'or court sur « BEST », lettre après lettre. */
  function briller() {
    best.forEach((l, k) => anim(l, [
      { transform: 'none', textShadow: '0 0 0 rgba(245,195,59,0)' },
      { transform: 'translateY(-5px) scale(1.12)', textShadow: '0 0 14px rgba(255,220,120,1)', offset: 0.4 },
      { transform: 'none', textShadow: '0 0 0 rgba(245,195,59,0)' }],
    { duration: 520, delay: k * 85, easing: 'ease-in-out' }));
  }

  /** La porte appelle : un reflet, un petit saut, des étincelles. */
  function appeler() {
    const cta = document.querySelector('#vitrine .cta');
    if (!cta) return;
    anim(cta.querySelector('.vv-reflet i'), [{ opacity: 0, translate: '-120% 0' },
      { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0, translate: '320% 0' }],
    { duration: 1000, easing: 'ease-in-out' });
    anim(cta, [{ transform: 'none' }, { transform: 'scale(1.035) rotate(-.6deg)', offset: 0.35 },
      { transform: 'scale(.99)', offset: 0.7 }, { transform: 'none' }],
    { duration: 520, delay: 250, easing: 'ease-out' });
    setTimeout(() => etincelles(cta, 8), 380);
  }

  /** La ola sur les trois promesses. */
  function ola() {
    document.querySelectorAll('#vitrine .bullet').forEach((b, k) => anim(b, [
      { transform: 'none', borderColor: 'var(--trait)' },
      { transform: 'translateY(-7px)', borderColor: 'rgba(245,195,59,.8)', offset: 0.4 },
      { transform: 'none', borderColor: 'var(--trait)' }],
    { duration: 520, delay: k * 130, easing: 'ease-in-out' }));
  }

  /** Un visage saute dans la galerie, et l'or passe derrière lui. */
  function visage() {
    const tous = [...document.querySelectorAll('#vEventail i')].filter((i) => i.offsetParent);
    const f = tous[Math.floor(Math.random() * tous.length)];
    if (!f) return;
    anim(f, [{ transform: 'none', boxShadow: 'none' },
      { transform: 'translateY(-12px) rotate(-5deg) scale(1.08)',
        boxShadow: '0 0 0 1px rgba(245,195,59,.8),0 0 18px rgba(245,195,59,.5)', offset: 0.35 },
      { transform: 'translateY(0) rotate(3deg)', offset: 0.65 },
      { transform: 'none', boxShadow: 'none' }],
    { duration: 760, easing: 'ease-out' });
  }

  /** Les photographes de la tribune. */
  function flashs() {
    if (!calque) return;
    const n = Math.round(hasard(3, 6));
    for (let k = 0; k < n; k++) {
      const f = document.createElement('i');
      f.className = 'vv-flash';
      f.style.left = `${hasard(4, 96)}%`;
      f.style.top = `${hasard(3, 92)}%`;
      f.style.scale = String(hasard(0.5, 1.1));
      calque.append(f);
      const a = anim(f, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }],
        { duration: 300, delay: k * hasard(80, 240), easing: 'ease-out', fill: 'backwards' });
      if (a) a.onfinish = () => f.remove(); else f.remove();
    }
  }

  /** Des braises d'or qui montent du bas de l'écran, une poignée. */
  function braises() {
    if (!devant) return;
    for (let k = 0; k < 14; k++) {
      const b = document.createElement('i');
      b.className = 'vv-braise';
      b.style.left = `${hasard(2, 98)}%`;
      devant.append(b);
      const h = devant.clientHeight || 600;
      const a = anim(b, [{ opacity: 0, transform: 'translate(0,0)' },
        { opacity: 0.95, offset: 0.15 },
        { opacity: 0, transform: `translate(${hasard(-40, 40)}px,-${hasard(0.35, 0.75) * h}px)` }],
      { duration: hasard(2200, 3600), delay: k * hasard(60, 160), easing: 'ease-out', fill: 'backwards' });
      if (a) a.onfinish = () => b.remove(); else b.remove();
    }
  }

  /** Un reflet d'or sur la bande du PASS, et son sticker qui frétille. */
  function lustrer() {
    const p = $('vPass');
    if (!p || !p.offsetParent) return;
    let r = p.querySelector('.vv-reflet');
    if (!r) {
      r = document.createElement('span');
      r.className = 'vv-reflet';
      r.setAttribute('aria-hidden', 'true');
      r.append(document.createElement('i'));
      p.append(r);
    }
    anim(r.firstChild, [{ opacity: 0, translate: '-120% 0' }, { opacity: 1, offset: 0.2 },
      { opacity: 1, offset: 0.8 }, { opacity: 0, translate: '320% 0' }], { duration: 1100 });
    anim(p.querySelector('.vpass-bientot:not([hidden])'), [{ transform: 'none' },
      { transform: 'rotate(-10deg) scale(1.1)', offset: 0.25 }, { transform: 'rotate(4deg)', offset: 0.5 },
      { transform: 'rotate(-3deg)', offset: 0.75 }, { transform: 'none' }],
    { duration: 600, delay: 300 });
  }

  const VIES = [briller, appeler, ola, visage, flashs, braises, lustrer];
  let derniere = -1;
  let minuterie = 0;
  const visible = () => {
    const v = $('vitrine');
    return v && v.style.display !== 'none' && !$('hub')?.classList.contains('on');
  };
  const couverte = () => Boolean(($('ouverture') && !$('ouverture').classList.contains('partie')) || document.querySelector('#tbf-tiroir.on')
    || document.querySelector('[role="alertdialog"], dialog[open]'));

  function vivre() {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      if (!visible()) return;
      if (!document.hidden && !doux() && !couverte()) {
        let k = Math.floor(Math.random() * VIES.length);
        if (k === derniere) k = (k + 1) % VIES.length;
        derniere = k;
        VIES[k]();
      }
      vivre();
    }, hasard(6000, 11000));
  }

  /* ----------------------------------------------------------- les buts

     `scoresVitrine` réécrit les lignes à chaque battement ; chacune porte
     `data-id` et `data-buts`. On garde le total d'avant : s'il a monté, c'est
     un but, et la ligne le dit. Le premier remplissage ne compte pas. */
  let butsVus = null;
  function guetterButs() {
    const sc = $('vScores');
    if (!sc) return;
    const lire = () => new Map([...sc.querySelectorAll('.sc[data-id]')]
      .map((l) => [l.dataset.id, Number(l.dataset.buts) || 0]));
    butsVus = lire();
    new MutationObserver(() => {
      const maintenant = lire();
      for (const [id, n] of maintenant) {
        const avant = butsVus?.get(id);
        if (avant !== undefined && n > avant) feterBut([...sc.querySelectorAll('.sc')].find((l) => l.dataset.id === id));
      }
      butsVus = maintenant;
    }).observe(sc, { childList: true });
  }

  function feterBut(ligne) {
    if (!ligne) return;
    ligne.classList.add('vv-allume');
    const s = document.createElement('span');
    s.className = 'tbf-sticker vv-but';
    s.textContent = 'BUT !';
    ligne.append(s);
    if (!doux()) {
      anim(s, [{ opacity: 0, transform: 'scale(2.4)' }, { opacity: 1, transform: 'scale(.9)', offset: 0.5 },
        { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
      anim(ligne, [{ transform: 'none' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' },
        { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 320 });
      etincelles(ligne, 12);
      flashs();
    }
    setTimeout(() => { ligne.classList.remove('vv-allume'); s.remove(); }, 6000);
  }

  /* ------------------------------------------------ le PASS « bientôt » */

  /** Minuit à Zurich, ce jour-là, en millisecondes. */
  function minuitZurich(jour) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(jour ?? ''));
    if (!m) return NaN;
    const utc = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    let decalage = 60;
    try {
      const nom = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', timeZoneName: 'shortOffset' })
        .formatToParts(new Date(utc)).find((p) => p.type === 'timeZoneName')?.value ?? '';
      const o = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(nom);
      if (o) decalage = (o[1] === '-' ? -1 : 1) * (Number(o[2]) * 60 + Number(o[3] ?? 0));
    } catch { /* l'heure d'hiver */ }
    return utc - decalage * 60000;
  }

  const deux = (n) => String(n).padStart(2, '0');

  let chrono = 0;
  async function bientot() {
    const p = $('vPass');
    if (!p) return;
    let annonce = null;
    try { annonce = await window.FZART?.prochaine?.(); } catch { /* sans annonce */ }
    const jour = annonce?.ouvre && Number(annonce.numero) >= 1 ? annonce.ouvre : OUVERTURE_PAR_DEFAUT;
    const cible = minuitZurich(jour);
    if (!Number.isFinite(cible) || Date.now() >= cible) return;

    /* La date dans la langue de la page : « 1er décembre », « December 1 »… */
    const langue = document.documentElement.lang || 'fr';
    let date = jour;
    try {
      date = new Intl.DateTimeFormat(langue, { day: 'numeric', month: 'long', timeZone: 'Europe/Zurich' })
        .format(new Date(cible + 12 * 3600000));
    } catch { /* la date brute */ }
    if (/^fr/.test(langue)) date = date.replace(/^1 /, '1er ');
    const sticker = p.querySelector('.vpass-bientot');
    const texte = p.querySelector('.vpass-texte');
    const compte = p.querySelector('.vpass-chrono');
    if (texte) texte.innerHTML = `Ouvre le <strong>${date}</strong>. Le jeu reste gratuit.`;
    if (sticker) sticker.hidden = false;
    p.dataset.bientot = jour;
    p.setAttribute('aria-label', `Le PASS de saison ouvre le ${date}`);

    const tic = () => {
      const reste = cible - Date.now();
      if (reste <= 0) {
        clearInterval(chrono);
        if (compte) compte.textContent = '›';
        if (sticker) sticker.hidden = true;
        if (texte) texte.textContent = 'C’est ouvert ! Le jeu reste gratuit.';
        delete p.dataset.bientot;
        return;
      }
      const jours = Math.ceil(reste / 86400000);
      if (compte) {
        compte.classList.add('vv-chrono');
        compte.textContent = reste > 86400000 ? `J-${jours}`
          : `${deux(Math.floor(reste / 3600000))}:${deux(Math.floor(reste / 60000) % 60)}:${
            deux(Math.floor(reste / 1000) % 60)}`;
      }
    };
    tic();
    /* Une fois par minute, puis chaque seconde le dernier jour. */
    const pas = () => (cible - Date.now() > 86400000 ? 60000 : 1000);
    let rythme = pas();
    chrono = setInterval(function battre() {
      tic();
      if (pas() !== rythme) { clearInterval(chrono); rythme = pas(); chrono = setInterval(battre, rythme); }
    }, rythme);
  }

  /* ------------------------------------------------------------ le départ

     La vitrine ne se montre qu'à qui n'a pas de compte : on attend que la
     page l'ait décidé (`tbf:vitrine`, posé par `garnirVitrine`) et que le
     rideau de chargement soit levé, puis tout entre et commence à vivre. */
  let parti = false;
  function demarrer() {
    if (parti) return;
    const t0 = Date.now();
    const guetter = () => {
      if (parti) return;
      /* Le rideau compte comme levé dès qu'il part en fondu (`.partie`) : la
         vitrine entre pendant qu'il s'efface, au lieu d'apparaître en entier
         puis de rejouer son entrée. */
      const rideau = $('ouverture');
      if (window.TBF_VITRINE && (!rideau || rideau.classList.contains('partie')) && visible()) {
        parti = true;
        poser();
        bientot();
        guetterButs();
        /* Une image de délai : les blocs de preuve viennent de s'ouvrir. */
        requestAnimationFrame(() => { entrer(); vivre(); });
        return;
      }
      if (Date.now() - t0 < 40000) setTimeout(guetter, 120);
    };
    const rideau = $('ouverture');
    if (rideau) {
      new MutationObserver((_m, o) => { if (rideau.classList.contains('partie')) { o.disconnect(); guetter(); } })
        .observe(rideau, { attributes: true, attributeFilter: ['class'] });
    }
    guetter();
  }

  window.TBF_VITRINE_VIVANTE = { briller, appeler, ola, visage, flashs, braises, lustrer, feterBut, minuitZurich };

  addEventListener('tbf:vitrine', demarrer);
  if (window.TBF_VITRINE) demarrer();
})();
