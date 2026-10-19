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
 */
(() => {
  const CLE = 'tbf.visite';
  const params = new URLSearchParams(location.search);
  const forcee = params.get('visite') === '1';

  let vue = false;
  try { vue = localStorage.getItem(CLE) === '1'; } catch { /* sans stockage : on la montre */ }
  if (!forcee && (vue || navigator.webdriver)) return;

  /* Les arrêts, dans l'ordre où l'œil parcourt l'accueil. `cible` est un
     sélecteur ; sans cible, la bulle se pose au milieu. */
  const ARRETS = [
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
      fin: true },
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

  function lancer() {
    const arrets = ARRETS.filter((a) => !a.cible || zone(a));
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
      try { localStorage.setItem(CLE, '1'); } catch { /* vaut pour la visite */ }
      racine.remove();
      removeEventListener('resize', placer);
      removeEventListener('keydown', clavier, true);
      if (forcee) {
        try { history.replaceState(null, '', location.pathname); } catch { /* tant pis */ }
      }
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
        pied.innerHTML = '<a class="tbf-plaque" data-ton="or" href="/aide">Voir les missions</a>'
          + '<a class="tbf-plaque" href="/comment-jouer">Comment jouer</a>'
          + '<button type="button" class="tbf-visite-passer" data-fin>C’est parti</button>';
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

  /* On attend le hub, la fin de l'ouverture et un écran libre. Au plus une
     demi-minute : passé ce délai, la visite attendra la prochaine fois. */
  const debut = Date.now();
  function pret() {
    const hub = document.getElementById('hub');
    if (!hub || !hub.classList.contains('on')) return false;
    const ouv = document.getElementById('ouverture');
    if (ouv && ouv.isConnected && !ouv.classList.contains('partie') && getComputedStyle(ouv).display !== 'none'
      && getComputedStyle(ouv).visibility !== 'hidden') return false;
    if (document.querySelector('dialog[open], .tbf-moment.on, .tbf-moment[data-on]')) return false;
    return !!enVue(document.getElementById('burger'));
  }
  function guetter() {
    if (pret()) { setTimeout(() => { if (pret()) lancer(); else setTimeout(guetter, 400); }, 900); return; }
    if (Date.now() - debut < 30000) setTimeout(guetter, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guetter);
  else guetter();
})();
