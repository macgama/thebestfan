/**
 * « Deviens testeur de l'appli Android » : la plaque de l'accueil.
 *
 * Demande de Gaël (4 novembre 2026) : trouver les 12 testeurs que Google
 * exige parmi les joueurs. La plaque se pose sur la scène du hub, en haut à
 * droite, et mène à /beta. Elle ne se montre :
 *   - que sur un téléphone Android (un iPhone n'a rien à y faire) ;
 *   - jamais dans l'appli elle-même (elle s'ouvre avec un référent
 *     `android-app://` : on le note pour toujours) ;
 *   - plus pendant 7 jours après une visite de /beta (`tbf-beta-vu`).
 */
(function () {
  const SEPT_JOURS = 7 * 24 * 3600 * 1000;
  const lire = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch { /* fermé */ } };

  if (document.referrer.startsWith('android-app://')) ecrire('tbf-appli-android', '1');

  function doitMontrer() {
    if (!/Android/i.test(navigator.userAgent)) return false;
    if (lire('tbf-appli-android')) return false;
    const vu = Number(lire('tbf-beta-vu') || 0);
    return !(vu && Date.now() - vu < SEPT_JOURS);
  }

  function poser() {
    const scene = document.getElementById('scene');
    if (!scene || document.getElementById('betaPlaque') || !doitMontrer()) return;
    const a = document.createElement('a');
    a.className = 'beta-plaque tbf-plaque';
    a.id = 'betaPlaque';
    a.href = '/beta';
    a.dataset.ton = 'flare';
    a.setAttribute('aria-label', 'Deviens testeur de l’appli Android');
    a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 18c0 .55.45 1 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8zm17 0A1.5 1.5 0 0 0 19 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8zm-4.97-5.84 1.3-1.3a.5.5 0 1 0-.7-.7l-1.48 1.48A5.96 5.96 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15a.5.5 0 1 0-.7.7l1.31 1.31A5.98 5.98 0 0 0 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg>
      <span><b>APPLI ANDROID</b><small>DEVIENS TESTEUR</small></span>`;
    scene.appendChild(a);
  }

  const partir = () => {
    let essais = 0;
    const voir = () => {
      if (document.getElementById('hub')?.classList.contains('on')) { poser(); return; }
      if (++essais < 40) setTimeout(voir, 250);
    };
    voir();
  };
  if (document.getElementById('ouverture')) addEventListener('tbf:ouverture-finie', partir, { once: true });
  else if (document.readyState === 'loading') addEventListener('DOMContentLoaded', partir, { once: true });
  else partir();
})();
