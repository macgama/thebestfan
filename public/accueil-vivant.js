/**
 * L'accueil vivant : la tribune autour du Fanzzy ne reste pas figée.
 *
 * Demande de Gaël (24 octobre 2026) : « animer l'accueil ». Le hub avait déjà
 * son personnage qui flotte, arrive, salue et saute ; le décor, lui, ne
 * bougeait jamais. Ce fichier lui donne trois choses, sans un octet de vidéo :
 *
 * - **l'entrée des tuiles** : à l'arrivée, les deux rails se posent l'un
 *   après l'autre, depuis leur bord, au lieu d'être là d'un coup ;
 * - **la vie de la tribune** : de temps en temps, et jamais deux fois de
 *   suite la même chose, des flashs de photographes crépitent dans le décor,
 *   un projecteur balaie la scène derrière le personnage, ou un reflet passe
 *   sur le bouton d'entrée ;
 * - **le niveau qui monte** : quand une réclamation fait monter le joueur,
 *   la pastille de niveau saute et l'anneau d'XP s'allume.
 *
 * ## Pas une animation sans fin de plus
 *
 * Le hub tient un budget de **trois animations infinies** (voir la note de
 * `.halo` dans `index.html`) : le flottement, la fumée des soirs de match, le
 * sticker des boosters. Ici tout est joué une fois, au script, et relancé par
 * une minuterie espacée (neuf à seize secondes) : rien ne tourne en boucle,
 * rien ne joue dans un onglet caché, ni sous la fête de niveau ou un moment
 * fort. Le mode calme et « moins de mouvement » éteignent tout, l'entrée des
 * tuiles comprise.
 */
(() => {
  if (window.TBF_ACCUEIL_VIVANT) return;

  const doux = () => (typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');
  const $ = (id) => document.getElementById(id);
  const hasard = (a, b) => a + Math.random() * (b - a);
  const anim = (el, images, o) => {
    try { return el.animate(images, o); } catch { return null; }
  };

  /* La feuille : trois calques posés par ce script, et rien d'autre. */
  const css = document.createElement('style');
  css.textContent = `
  .av-ciel{position:absolute;inset:34px 0 0;overflow:hidden;pointer-events:none;
    -webkit-mask-image:radial-gradient(ellipse 62% 60% at 50% 50%,#000 55%,transparent 100%);
    mask-image:radial-gradient(ellipse 62% 60% at 50% 50%,#000 55%,transparent 100%)}
  .av-flash{position:absolute;width:64px;height:64px;margin:-32px 0 0 -32px;opacity:0;
    mix-blend-mode:screen;
    background:radial-gradient(circle,#fff 0 13%,rgba(255,252,240,.95) 20%,rgba(255,240,200,0) 50%),
      linear-gradient(90deg,transparent 0 47%,rgba(255,255,255,1) 50%,transparent 53% 100%) center/100% 4px no-repeat,
      linear-gradient(0deg,transparent 0 47%,rgba(255,255,255,1) 50%,transparent 53% 100%) center/4px 100% no-repeat}
  .av-projo{position:absolute;top:-10%;bottom:-10%;left:0;width:70%;opacity:0;mix-blend-mode:screen;
    background:linear-gradient(100deg,transparent 0 30%,rgba(255,236,190,.3) 44%,
      rgba(255,244,215,.45) 50%,rgba(255,236,190,.3) 56%,transparent 70%)}
  .av-reflet{position:absolute;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}
  .av-reflet i{position:absolute;top:0;bottom:0;left:0;width:38%;opacity:0;
    background:linear-gradient(105deg,transparent,rgba(255,250,235,.38),transparent)}
  @media (prefers-reduced-motion:reduce){.av-ciel,.av-reflet{display:none}}
  html[data-calme~="animations"] :is(.av-ciel,.av-reflet){display:none}`;
  document.head.append(css);

  /* ------------------------------------------------- l'entrée des tuiles */

  let entres = false;
  function entrerTuiles() {
    if (entres || doux()) return;
    entres = true;
    document.querySelectorAll('#hub .rail').forEach((rail, r) => {
      const cote = r === 0 ? -1 : 1;
      rail.querySelectorAll('.tbf-case').forEach((tuile, k) => {
        anim(tuile, [{ opacity: 0, translate: `${cote * 26}px 0`, rotate: `${cote * -4}deg` },
          { opacity: 1, translate: '0 0', rotate: '0deg' }],
        { duration: 380, delay: 60 + k * 55 + r * 25, easing: 'cubic-bezier(.2,1.3,.35,1)',
          fill: 'backwards' });
      });
    });
    const bas = document.querySelector('#hub .bas');
    if (bas) {
      anim(bas, [{ opacity: 0, translate: '0 18px' }, { opacity: 1, translate: '0 0' }],
        { duration: 360, delay: 260, easing: 'cubic-bezier(.2,1.2,.35,1)', fill: 'backwards' });
    }
  }

  /* ------------------------------------------------- la vie de la tribune */

  let ciel = null;
  let projo = null;
  let reflet = null;

  function poser() {
    const scene = $('scene');
    if (scene && !ciel) {
      ciel = document.createElement('div');
      ciel.className = 'av-ciel';
      ciel.setAttribute('aria-hidden', 'true');
      projo = document.createElement('i');
      projo.className = 'av-projo';
      ciel.append(projo);
      /* Derrière le personnage, devant le décor : juste après lui. */
      const decor = $('decor');
      if (decor) decor.after(ciel); else scene.prepend(ciel);
    }
    const entrer = $('entrer');
    if (entrer && !reflet) {
      reflet = document.createElement('span');
      reflet.className = 'av-reflet';
      reflet.setAttribute('aria-hidden', 'true');
      reflet.append(document.createElement('i'));
      entrer.append(reflet);
    }
  }

  /** Les photographes de la tribune : trois à cinq éclairs, en rafale. */
  function flashs() {
    if (!ciel) return;
    const n = Math.round(hasard(3, 5));
    for (let k = 0; k < n; k++) {
      const f = document.createElement('i');
      f.className = 'av-flash';
      f.style.left = `${hasard(8, 92)}%`;
      f.style.top = `${hasard(4, 42)}%`;
      f.style.scale = String(hasard(0.6, 1.2));
      ciel.append(f);
      const a = anim(f, [{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 0 }],
        { duration: 320, delay: k * hasard(90, 260), easing: 'ease-out', fill: 'backwards' });
      if (a) a.onfinish = () => f.remove(); else f.remove();
    }
  }

  /** Un projecteur passe derrière lui, d'un bord à l'autre. */
  function balayage() {
    if (!projo) return;
    const sens = Math.random() < 0.5 ? 1 : -1;
    anim(projo, [{ opacity: 0, translate: `${sens * -80}% 0` },
      { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 },
      { opacity: 0, translate: `${sens * 120}% 0` }],
    { duration: 2600, easing: 'cubic-bezier(.45,0,.55,1)' });
  }

  /** Un reflet glisse sur la bâche d'entrée : on peut toujours y aller. */
  function luire() {
    const i = reflet?.firstChild;
    if (!i) return;
    anim(i, [{ opacity: 0, translate: '-120% 0' }, { opacity: 1, offset: 0.2 },
      { opacity: 1, offset: 0.8 }, { opacity: 0, translate: '300% 0' }],
    { duration: 1100, easing: 'ease-in-out' });
  }

  const VIES = [flashs, balayage, luire];
  let derniere = -1;
  let minuterie = 0;

  /* Rien ne joue sous un écran qui couvre la scène : la fête de niveau, le
     moment fort, l'écran d'ouverture, le menu ouvert, une boîte de dialogue. */
  const couverte = () => Boolean($('ouverture') || document.querySelector('.tbf-niv-fond')
    || $('moment')?.classList.contains('on') || document.querySelector('[role="alertdialog"]')
    || document.querySelector('#tbf-tiroir.on'));

  function vivre() {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      if (!document.hidden && !doux() && !couverte() && $('hub')?.classList.contains('on')) {
        let k = Math.floor(Math.random() * VIES.length);
        if (k === derniere) k = (k + 1) % VIES.length;
        derniere = k;
        VIES[k]();
      }
      vivre();
    }, hasard(9000, 16000));
  }

  /* ------------------------------------------------- le niveau qui monte */

  addEventListener('tbf:bourse', (e) => {
    if (!e.detail?.niveau?.monte || doux()) return;
    /* Après la fête : la pastille saute quand le joueur revient au hub. */
    const t0 = Date.now();
    const apres = () => {
      if (document.querySelector('.tbf-niv-fond') && Date.now() - t0 < 120000) {
        setTimeout(apres, 300);
        return;
      }
      const p = $('nivPastille');
      if (p && !p.hidden) {
        anim(p, [{ scale: '1' }, { scale: '1.7', offset: 0.35 }, { scale: '.9', offset: 0.7 }, { scale: '1' }],
          { duration: 620, easing: 'cubic-bezier(.3,1.4,.4,1)' });
      }
      const a = $('anneau');
      if (a) {
        anim(a, [{ filter: 'drop-shadow(0 0 0 rgba(245,195,59,0))' },
          { filter: 'drop-shadow(0 0 10px rgba(245,195,59,.95))', offset: 0.3 },
          { filter: 'drop-shadow(0 0 0 rgba(245,195,59,0))' }], { duration: 1400 });
      }
    };
    setTimeout(apres, 900);
  });

  /* ------------------------------------------------------------ le départ

     Le hub s'ouvre quand le serveur a dit qui joue, et l'écran d'ouverture
     le couvre parfois encore : on attend les deux, puis les tuiles entrent
     et la tribune commence à vivre. */
  function demarrer() {
    const t0 = Date.now();
    const guetter = () => {
      const hub = $('hub');
      if (hub?.classList.contains('on') && !$('ouverture')) {
        poser();
        entrerTuiles();
        vivre();
        return;
      }
      if (Date.now() - t0 < 30000) setTimeout(guetter, 120);
    };
    guetter();
  }
  /* Les trois vies, nommées : une suite ou un banc peut en jouer une sans
     attendre la minuterie. */
  window.TBF_ACCUEIL_VIVANT = { flashs, balayage, luire };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer, { once: true });
  } else demarrer();
})();
