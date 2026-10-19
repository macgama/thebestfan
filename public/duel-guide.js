/* =======================================================================
   Le premier duel guidé : les bulles qui expliquent.

   Un débutant jouait son premier duel sans un mot d'aide : dix cartes, une
   corde, un souffle, et un adversaire qui chantait déjà. Le serveur monte
   ici un duel d'apprentissage (`nvn:tuto`, voir « le premier duel » dans
   `src/server/nvn/index.js`) sur un match fictif, contre un bot qui laisse
   le temps ; ce fichier dit quoi faire, **au moment où il faut le faire**.

   Trois temps, et chacun se passe **en le faisant** : on ne passe pas une
   bulle en appuyant sur « suivant », on la passe en chantant, puis en jouant
   une carte. C'est la règle des Premiers pas (`aide/index.js`) : la seule
   preuve qu'on a compris, c'est de l'avoir fait.

     1. toucher une carte de chant, et faire le geste ;
     2. voir la corde : le chant la tire, au bout c'est un but ;
     3. jouer une carte d'action quand elle s'allume.

   Le jeu ne s'arrête jamais : les bulles ne couvrent rien et ne prennent
   aucun appui, sauf leur propre bouton. La page n'a qu'à appeler
   `TBF_GUIDE.debut()` au coup d'envoi et `TBF_GUIDE.fin()` au bilan ; tout
   le reste se lit dans la page elle-même.

   Les textes sont en français : `langue.js` les traduit à l'affichage.
   ======================================================================= */
(() => {
  const CSS = `
  .tbf-guide{position:fixed;left:50%;translate:-50% 0;z-index:60;
    width:min(calc(100vw - 32px),400px);box-sizing:border-box;pointer-events:none;
    background:var(--panneau,#0C1118);color:var(--craie,#F2EEE4);
    border:2px solid var(--projo,#F5C33B);border-radius:14px;padding:12px 14px;
    box-shadow:0 10px 30px rgba(0,0,0,.55);font-family:var(--ui,system-ui,sans-serif);
    transition:top .25s ease,opacity .2s ease}
  .tbf-guide[hidden]{display:none}
  .tbf-guide h2{margin:0 0 4px;font-family:var(--banner,Oswald,sans-serif);font-weight:700;
    font-size:17px;letter-spacing:.04em;text-transform:uppercase;color:var(--projo,#F5C33B)}
  .tbf-guide p{margin:0;font-size:14px;line-height:1.45}
  .tbf-guide .tbf-plaque{pointer-events:auto;margin-top:10px;min-height:44px;width:100%}
  .tbf-guide-pas{display:block;margin-top:6px;font-size:12px;font-weight:600;opacity:.8}
  .tbf-guide-cible{outline:3px solid var(--projo,#F5C33B);outline-offset:4px;border-radius:12px;
    animation:tbf-guide-pouls 1.2s ease-in-out infinite}
  @keyframes tbf-guide-pouls{50%{outline-color:transparent}}
  @media (prefers-reduced-motion:reduce){.tbf-guide-cible{animation:none}}
  `;

  let bulle = null;
  let cible = null;
  let etape = -1;
  let veille = 0;
  let actif = false;

  function poser() {
    if (bulle) return;
    if (!document.getElementById('tbf-guide-css')) {
      const st = document.createElement('style');
      st.id = 'tbf-guide-css';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    bulle = document.createElement('div');
    bulle.className = 'tbf-guide';
    bulle.setAttribute('role', 'status');
    bulle.setAttribute('aria-live', 'polite');
    bulle.hidden = true;
    bulle.innerHTML = '<h2></h2><p></p><small class="tbf-guide-pas"></small>';
    document.body.appendChild(bulle);
    addEventListener('resize', placer);
  }

  function eclairer(el) {
    cible?.classList.remove('tbf-guide-cible');
    cible = el ?? null;
    cible?.classList.add('tbf-guide-cible');
  }

  /** Au-dessus de la cible s'il y a la place, sinon en dessous. */
  function placer() {
    if (!bulle || bulle.hidden) return;
    const r = cible?.getBoundingClientRect();
    const h = bulle.offsetHeight;
    if (!r || r.height < 2) {
      bulle.style.top = `${Math.max(12, innerHeight * 0.18)}px`;
      return;
    }
    let top = r.top - 14 - h;
    if (top < 12) top = Math.min(innerHeight - h - 12, r.bottom + 14);
    bulle.style.top = `${Math.max(12, top)}px`;
  }

  function dire({ titre, texte, el = null, bouton = null, pas = null }) {
    poser();
    bulle.querySelector('h2').textContent = titre;
    bulle.querySelector('p').textContent = texte;
    bulle.querySelector('.tbf-guide-pas').textContent = pas ? `${pas} / 3` : '';
    bulle.querySelector('.tbf-plaque')?.remove();
    if (bouton) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tbf-plaque';
      b.dataset.ton = 'flare';
      b.textContent = bouton.texte;
      b.addEventListener('click', bouton.action, { once: true });
      bulle.appendChild(b);
    }
    eclairer(el);
    bulle.hidden = false;
    requestAnimationFrame(placer);
  }

  function taire() {
    if (bulle) bulle.hidden = true;
    eclairer(null);
  }

  const $ = (id) => document.getElementById(id);
  const gesteOuvert = () => $('mini')?.classList.contains('on');

  /* ------------------------------------------------------------ les temps */

  const ETAPES = [
    // 1. Le chant.
    {
      montrer() {
        dire({ pas: 1, titre: 'Chante !', el: $('chants'),
          texte: 'Touche une carte de chant en bas de l’écran, puis fais le geste qu’elle demande. Plus tu es juste, plus ta tribune pousse.' });
      },
      // Le geste s'ouvre : la bulle se tait, la fenêtre du geste a sa consigne.
      // Il se referme : le chant est parti.
      suivre(t) {
        if (gesteOuvert()) { t.vu = true; taire(); return false; }
        return Boolean(t.vu);
      },
    },
    // 2. La corde.
    {
      montrer() {
        dire({ pas: 2, titre: 'La corde', el: document.querySelector('#arene .tbf-corde'),
          texte: 'Chaque chant tire le foulard vers le but d’en face. Amène-le au bout : c’est un but pour ta tribune. Celle d’en face tire dans l’autre sens.',
          bouton: { texte: 'COMPRIS', action: () => suivant() } });
      },
      suivre: () => false,
    },
    // 3. La carte d'action.
    {
      montrer(t) {
        const jouable = document.querySelector('#mainCartes [data-jouer]');
        t.jouable = Boolean(jouable);
        dire({ pas: 3, titre: 'Une carte d’action', el: $('mainCartes'),
          texte: jouable
            ? 'Joue une carte d’action : touche-la. Elle coûte du souffle, et chacune a son effet (pousser, gêner l’adversaire, protéger ta tribune).'
            : 'Tes cartes d’action coûtent du souffle. Ton souffle se recharge tout seul : touche une carte dès qu’elle s’allume.' });
        t.ecoute = (e) => { if (e.target.closest('[data-jouer]')) t.jouee = true; };
        $('mainCartes')?.addEventListener('click', t.ecoute);
      },
      suivre(t) {
        if (gesteOuvert()) return false;
        // La consigne change quand une carte s'allume.
        if (!t.jouable && document.querySelector('#mainCartes [data-jouer]')) this.montrer(t);
        return Boolean(t.jouee);
      },
      quitter(t) { $('mainCartes')?.removeEventListener('click', t.ecoute); },
    },
    // 4. À lui.
    {
      montrer() {
        dire({ titre: 'À toi de jouer !',
          texte: 'Enchaîne chants et cartes. La première tribune à trois buts gagne, sinon celle qui mène au bout des trois minutes.',
          bouton: { texte: 'C’EST PARTI', action: () => suivant() } });
      },
      suivre: () => false,
    },
  ];
  let tenue = {};

  function suivant() {
    ETAPES[etape]?.quitter?.(tenue);
    etape += 1;
    tenue = {};
    if (etape >= ETAPES.length) { arreter(); return; }
    ETAPES[etape].montrer(tenue);
  }

  function veiller() {
    if (!actif) return;
    const e = ETAPES[etape];
    if (e && e.suivre(tenue)) suivant();
    else if (e && !gesteOuvert() && bulle?.hidden && etape === 0 && !tenue.vu) e.montrer(tenue);
    placer();
  }

  function arreter() {
    actif = false;
    clearInterval(veille);
    ETAPES[etape]?.quitter?.(tenue);
    taire();
  }

  window.TBF_GUIDE = {
    /** Au coup d'envoi du duel guidé : la première bulle attend que
        l'affiche se retire et que la tribune soit là. */
    debut() {
      if (actif) return;
      actif = true;
      etape = -1;
      clearInterval(veille);
      const pret = () => $('jeu')?.classList.contains('on') && $('affiche')?.hidden !== false
        && document.querySelector('#chants [data-chant]');
      const attendre = setInterval(() => {
        if (!actif) { clearInterval(attendre); return; }
        if (!pret()) return;
        clearInterval(attendre);
        suivant();
        veille = setInterval(veiller, 250);
      }, 300);
    },
    /** Au bilan, ou en quittant : plus rien ne parle. */
    fin: arreter,
  };
})();
