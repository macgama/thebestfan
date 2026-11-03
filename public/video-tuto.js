/**
 * Les vidéos tutoriel de « Comment jouer ».
 *
 * Demandée par Gaël le 3 novembre 2026 (fil « Créer une vidéo tuto sur les
 * Fanzzy ») : « pour les personnes qui n'aiment pas lire ». Une rubrique de
 * la page porte un bouton « Voir la vidéo » ; le toucher ouvre la vidéo dans
 * la colonne du téléphone, par-dessus la page.
 *
 *     <button class="tbf-plaque" data-video-tuto="tuto-fanzzy-1" hidden>
 *       Voir la vidéo</button>
 *     <ol class="video-sous-titres" data-pour="tuto-fanzzy-1" hidden>
 *       <li data-de="0" data-a="4.5">Un Fanzzy, c'est un supporter.</li> …
 *     </ol>
 *
 * **Aucun texte n'est gravé dans l'image.** Le site parle cinq langues : les
 * phrases vivent dans la page, en `<li>`, que `langue.js` traduit comme tout
 * le reste, et ce script affiche celle du moment en gros, sur le tiers bas de
 * la vidéo. Un seul fichier vidéo sert donc toutes les langues, et une phrase
 * se corrige sans retourner le film.
 *
 * **Le bouton reste caché tant que la vidéo n'est pas sur le serveur.** Les
 * vidéos ne sont pas dans git (voir .gitignore) : elles partent au serveur
 * avec les images, par scripts/envoyer-images.sh. Un déploiement du code
 * avant l'envoi ne montre donc pas un bouton qui ouvrirait un écran noir.
 *
 * **Une version par langue quand la vidéo parle.** Avec une voix off, le
 * fichier de la langue du joueur s'appelle `tuto-fanzzy-1-de.mp4` ; à
 * défaut, c'est `tuto-fanzzy-1.mp4` qui sert. Les phrases restent affichées
 * dans les deux cas (sous-titres, son coupé).
 *
 * Le fichier porte un numéro (`tuto-fanzzy-1.mp4`) : /video est servi avec un
 * an de cache, une vidéo refaite prend le numéro suivant.
 *
 * Script classique, pas module : comme tout ce qui vit dans `public/`.
 */
(() => {
  const CSS = `
  .vtuto{position:fixed;inset:0;z-index:140;display:flex;justify-content:center;
    background:rgba(3,4,6,.94);animation:vtutoin .18s ease-out}
  @keyframes vtutoin{from{opacity:0}}
  .vtuto-col{position:relative;width:min(100vw,480px);height:100%;display:flex;
    align-items:center;justify-content:center;
    padding:calc(env(safe-area-inset-top,0px) + 8px) 0 calc(var(--bas,0px) + 8px)}
  /* Le cadre épouse la vidéo (9:16, le plus grand qui tienne) : la phrase se
     pose sur son tiers bas, au-dessus des commandes du lecteur. */
  .vtuto-cadre{position:relative;height:min(100%,calc(min(100vw,480px) * 16 / 9));aspect-ratio:9/16;max-width:100%}
  .vtuto video{display:block;width:100%;height:100%;object-fit:contain;background:#000;border-radius:10px}
  .vtuto-phrase{position:absolute;left:14px;right:14px;bottom:max(64px,14%);
    margin:0;text-align:center;pointer-events:none;
    font-family:var(--banner);font-weight:700;font-size:clamp(21px,6.4vw,29px);line-height:1.15;
    letter-spacing:.01em;color:var(--craie,#F2EEE4);text-wrap:balance;
    text-shadow:0 0 2px #000,0 2px 0 #000,0 0 14px rgba(0,0,0,.9);
    -webkit-text-stroke:1px rgba(0,0,0,.55);paint-order:stroke fill;
    opacity:0;translate:0 8px;transition:opacity .2s,translate .2s}
  .vtuto-phrase.on{opacity:1;translate:0 0}
  .vtuto-phrase b{color:var(--projo,#F5C33B)}
  .vtuto-fermer{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);right:12px;
    width:44px;height:44px;border-radius:50%;border:0;cursor:pointer;
    background:rgba(5,7,10,.72);color:var(--craie,#F2EEE4);font-size:22px;line-height:44px;
    box-shadow:inset 0 0 0 1px rgba(242,238,228,.25)}
  .vtuto-fermer:focus-visible{outline:2px solid var(--projo,#F5C33B);outline-offset:2px}
  /* Le triangle de lecture : ::before et ::after sont déjà la matière de la
     plaque (ui.css), il se pose donc en fond, devant le texte. */
  [data-video-tuto]{padding-left:2.1em;background-repeat:no-repeat;background-size:.95em;
    background-position:calc(50% - 4.6em) 50%;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 12'%3E%3Cpath d='M0 0l10 6-10 6z' fill='%230b0d10'/%3E%3C/svg%3E")}
  `;

  function phrases(nom) {
    const ol = document.querySelector(`.video-sous-titres[data-pour="${nom}"]`);
    if (!ol) return [];
    return [...ol.querySelectorAll('li')].map((li) => ({
      de: Number(li.dataset.de) || 0,
      a: Number(li.dataset.a) || 0,
      html: li.innerHTML,
    }));
  }

  function ouvrir(nom, bouton, fichier) {
    if (document.querySelector('.vtuto')) return;
    const liste = phrases(nom);
    const boite = document.createElement('div');
    boite.className = 'vtuto';
    boite.setAttribute('role', 'dialog');
    boite.setAttribute('aria-modal', 'true');
    boite.setAttribute('aria-label', bouton.textContent.trim());
    boite.innerHTML = `<div class="vtuto-col">
      <div class="vtuto-cadre">
        <video src="/video/${fichier}.mp4" poster="/video/${nom}.jpg" playsinline autoplay controls
          controlslist="nodownload noplaybackrate nofullscreen" disablepictureinpicture preload="auto"></video>
        <p class="vtuto-phrase" aria-live="polite"></p>
      </div>
      <button type="button" class="vtuto-fermer" aria-label="Fermer">✕</button>
    </div>`;
    /* La phrase « Fermer » du bouton passe par le dictionnaire : elle n'est
       pas dans la page au chargement. */
    const fermerB = boite.querySelector('.vtuto-fermer');
    fermerB.setAttribute('aria-label', window.TBF_LANGUE?.t?.('Fermer') ?? 'Fermer');
    const video = boite.querySelector('video');
    const phrase = boite.querySelector('.vtuto-phrase');
    let courante = -1;
    const suivre = () => {
      const t = video.currentTime;
      const i = liste.findIndex((p) => t >= p.de && t < p.a);
      if (i === courante) return;
      courante = i;
      if (i < 0) { phrase.classList.remove('on'); return; }
      phrase.innerHTML = liste[i].html;
      phrase.classList.add('on');
    };
    video.addEventListener('timeupdate', suivre);
    video.addEventListener('seeked', suivre);
    /* timeupdate ne bat que quatre fois par seconde : assez pour une phrase,
       mais une image par image rend l'entrée nette. */
    let rafId = 0;
    const boucle = () => { suivre(); rafId = requestAnimationFrame(boucle); };
    video.addEventListener('play', () => { cancelAnimationFrame(rafId); boucle(); });
    video.addEventListener('pause', () => cancelAnimationFrame(rafId));

    const fermer = () => {
      cancelAnimationFrame(rafId);
      video.pause();
      video.removeAttribute('src');
      video.load();
      boite.remove();
      document.removeEventListener('keydown', clavier);
      document.documentElement.style.overflow = '';
      bouton.focus();
    };
    const clavier = (e) => { if (e.key === 'Escape') fermer(); };
    fermerB.addEventListener('click', fermer);
    boite.addEventListener('click', (e) => { if (e.target === boite || e.target.classList.contains('vtuto-col')) fermer(); });
    document.addEventListener('keydown', clavier);
    document.documentElement.style.overflow = 'hidden';
    document.body.append(boite);
    fermerB.focus({ preventScroll: true });
    /* Le son : le toucher du bouton est un geste, la lecture part avec le
       son. Un navigateur qui refuse quand même (économie d'énergie) laisse
       la vidéo en pause sur son affiche, et les commandes sont là. */
    video.play().catch(() => {});
  }

  function brancher() {
    const boutons = document.querySelectorAll('[data-video-tuto]');
    if (!boutons.length) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.append(style);
    for (const b of boutons) {
      const nom = b.dataset.videoTuto;
      if (!/^[a-z0-9-]+$/.test(nom)) continue;
      /* La version dans la langue du joueur (sa voix off), sinon la vidéo
         commune. Le bouton ne se montre que si l'une des deux est servie. */
      const langue = window.TBF_LANGUE?.langue ?? 'fr';
      const essayer = (f) => fetch(`/video/${f}.mp4`, { method: 'HEAD' })
        .then((r) => (r.ok ? f : null)).catch(() => null);
      let fichier = null;
      b.addEventListener('click', () => { if (fichier) ouvrir(nom, b, fichier); });
      essayer(`${nom}-${langue}`)
        .then((f) => f ?? essayer(nom))
        .then((f) => { if (f) { fichier = f; b.hidden = false; } });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();
})();
