/**
 * L'annonce de l'appli Android sur l'accueil.
 *
 * Demande de Gaël (4 novembre 2026) : trouver les 12 testeurs que Google
 * exige parmi les joueurs ; le 5 novembre, elle se montre aussi sur le site
 * web (« on pourrait faire de la pub »). Le 6 novembre, Gaël trouve la plaque
 * rouge trop envahissante : « plus discrète, et qui disparaisse (comme une
 * publicité éphémère) ».
 *
 * C'est donc un petit bandeau sombre qui glisse en haut de la scène du hub,
 * reste 7 secondes (une fine jauge montre le temps qui reste) puis s'efface.
 * Il mène à /beta :
 *   - sur Android : « Appli Android · deviens testeur » ;
 *   - ailleurs (iPhone, ordinateur) : « Appli Android · bientôt sur Google
 *     Play » ; /beta y montre le QR code à scanner avec un téléphone Android.
 * Il ne revient pas à chaque visite :
 *   - jamais dans l'appli elle-même (elle s'ouvre avec un référent
 *     `android-app://` : on le note pour toujours) ;
 *   - pas avant 3 jours après s'être montré (`tbf-beta-annonce`) ;
 *   - pas avant 30 jours si le joueur l'a fermé d'un geste (×) ;
 *   - pas avant 7 jours après une visite de /beta (`tbf-beta-vu`).
 */
(function () {
  const JOUR = 24 * 3600 * 1000;
  const DUREE = 7000;
  const lire = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, v); } catch { /* fermé */ } };

  if (document.referrer.startsWith('android-app://')) ecrire('tbf-appli-android', '1');

  const recent = (k, jours) => {
    const t = Number(lire(k) || 0);
    return t > Date.now() ? true : Boolean(t && Date.now() - t < jours * JOUR);
  };
  function doitMontrer() {
    if (lire('tbf-appli-android')) return false;
    return !recent('tbf-beta-vu', 7) && !recent('tbf-beta-annonce', 3);
  }

  function poser() {
    const scene = document.getElementById('scene');
    if (!scene || document.getElementById('betaAnnonce') || !doitMontrer()) return;
    const android = /Android/i.test(navigator.userAgent);
    ecrire('tbf-beta-annonce', String(Date.now()));

    const boite = document.createElement('div');
    boite.className = 'beta-annonce';
    boite.id = 'betaAnnonce';
    boite.setAttribute('role', 'status');
    boite.style.setProperty('--duree', `${DUREE}ms`);
    boite.innerHTML = `<a class="beta-annonce-lien" id="betaPlaque" href="/beta"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 18c0 .55.45 1 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8zm17 0A1.5 1.5 0 0 0 19 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8zm-4.97-5.84 1.3-1.3a.5.5 0 1 0-.7-.7l-1.48 1.48A5.96 5.96 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15a.5.5 0 1 0-.7.7l1.31 1.31A5.98 5.98 0 0 0 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/></svg><span><b>Appli Android</b> · ${android ? 'deviens testeur' : 'bientôt sur Google Play'}</span></a><button type="button" class="beta-annonce-x" aria-label="Fermer">×</button><i class="beta-annonce-jauge" aria-hidden="true"></i>`;

    let minuteur = 0;
    const partir = () => {
      clearTimeout(minuteur);
      if (!boite.isConnected || boite.classList.contains('beta-annonce-part')) return;
      boite.classList.remove('on');
      boite.classList.add('beta-annonce-part');
      setTimeout(() => boite.remove(), 400);
    };
    /* Un toucher sur l'annonce n'est pas un toucher sur la scène : il ne fait
       pas sauter le Fanzzy ni ne change d'âge (index.html, « Glisser le doigt »). */
    for (const t of ['pointerdown', 'pointerup']) boite.addEventListener(t, (e) => e.stopPropagation());
    /* Délégué à la boîte : la traduction (langue.js) peut refaire son contenu. */
    boite.addEventListener('click', (e) => {
      if (!e.target.closest?.('.beta-annonce-x')) return;
      ecrire('tbf-beta-annonce', String(Date.now() + 27 * JOUR));
      partir();
    });
    scene.appendChild(boite);
    requestAnimationFrame(() => requestAnimationFrame(() => boite.classList.add('on')));
    minuteur = setTimeout(partir, DUREE);
  }

  const partir = () => {
    let essais = 0;
    const voir = () => {
      if (document.getElementById('hub')?.classList.contains('on')) { setTimeout(poser, 1200); return; }
      if (++essais < 40) setTimeout(voir, 250);
    };
    voir();
  };
  if (document.getElementById('ouverture')) addEventListener('tbf:ouverture-finie', partir, { once: true });
  else if (document.readyState === 'loading') addEventListener('DOMContentLoaded', partir, { once: true });
  else partir();
})();
