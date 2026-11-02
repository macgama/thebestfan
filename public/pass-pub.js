/**
 * La pub du PASS de saison sur l'accueil (demande de Gaël du 2 novembre 2026).
 *
 * Trois endroits, et une seule règle : **on ne la montre jamais à qui a déjà
 * le PASS de la saison**, ni quand il n'y a rien à acheter.
 *
 *   1. La vitrine (pas connecté) : une bande or sous les trois promesses,
 *      écrite dans `index.html` (`#vPass`) ; ce fichier n'y touche pas.
 *   2. L'accueil connecté : une plaque or « PASS 1 » posée sur la scène
 *      (`#passPlaque`), qui mène à la page du PASS.
 *   3. **Une fois par jour**, juste après l'écran de chargement : le spot du
 *      PASS en plein écran, quelques secondes — la tenue de la saison sur
 *      des Fanzzy qui défilent, ce que le PASS donne, son prix — puis
 *      « VOIR LE PASS » ou « PLUS TARD ». Il se ferme d'un geste à tout
 *      moment : une pub qu'on ne peut pas passer se fait détester, et le
 *      PASS avec elle.
 *
 * Le jour est celui du téléphone, gardé par compte dans `localStorage`
 * (`tbf-pass-spot:<id>`). Sans stockage, le spot ne se montre pas : mieux
 * vaut pas de pub qu'une pub à chaque ouverture.
 *
 * Le spot attend la fin du chargement (`tbf:ouverture-finie`), et cède la
 * place à la visite guidée d'un premier jour : un joueur qui découvre le jeu
 * apprend d'abord à jouer.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[<>&"]/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  const calme = () => matchMedia('(prefers-reduced-motion: reduce)').matches
    || /animations/.test(document.documentElement.dataset.calme ?? '');

  /* Les Fanzzy du spot : les mêmes que la vitrine de la page du PASS. */
  const VITRINE = window.TBF_PASS?.VITRINE ?? [['RP1', 3], ['AN5', 2], ['RP20', 3], ['AN1', 1]];

  const jour = () => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  };
  const cle = (id) => `tbf-pass-spot:${id}`;
  const dejaVu = (id) => {
    try { return localStorage.getItem(cle(id)) === jour(); } catch { return true; }
  };
  const marquer = (id) => { try { localStorage.setItem(cle(id), jour()); } catch { /* sans stockage */ } };

  const lire = () => (window.TBF_ABO ??= fetch('/api/abonnement', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null)).catch(() => null));

  /** Ce que la pub peut promettre, ou `null` s'il n'y a rien à vendre. */
  function offreDe(a) {
    if (!a || a.error || a.actif) return null;
    const couvre = a.offre?.couvre ?? [];
    if (!(a.offre?.aAcheter ?? []).length || !couvre.length) return null;
    const p = couvre[0];
    return {
      numero: p.numero, nom: String(p.nom ?? '').replace(/^PASS \d+ · /, ''), tenue: p.tenue,
      couleur: p.couleur, prix: a.offre?.article?.prixTexte ?? null,
      echarpes: Number(a.offre?.echarpes) || null, packs: Number(a.offre?.article?.packs) || 0,
      deux: couvre.length > 1,
    };
  }

  /* ----------------------------------------------- la plaque de l'accueil */

  function plaque(o) {
    const scene = $('scene');
    if (!scene || $('passPlaque')) return;
    const a = document.createElement('a');
    a.className = 'pass-plaque tbf-plaque';
    a.id = 'passPlaque';
    a.href = '/abonnement';
    a.dataset.ton = 'or';
    a.setAttribute('aria-label', `Le PASS ${o.numero} : ${o.nom}`);
    a.innerHTML = `${window.TBF_PASS ? window.TBF_PASS.badge({ saison: o.numero, couleur: o.couleur }) : ''}
      <span><b>${esc(`PASS ${o.numero}`)}</b><small>${esc(o.nom)}</small></span>`;
    scene.appendChild(a);
  }

  /* ------------------------------------------------------------- le spot */

  function spot(o, userId) {
    const images = VITRINE.map(([id, age], i) => `<img alt="" loading="eager"
      src="/img/fanzzy/${id}/e${age}/${esc(o.tenue)}/pousse.webp" onerror="this.remove()"${
      i === 0 ? ' class="on"' : ''}>`).join('');
    const prix = [o.prix, o.echarpes ? `${o.echarpes.toLocaleString('fr')} écharpes` : null]
      .filter(Boolean).join(' ou ');
    const voile = document.createElement('div');
    voile.className = 'pass-spot';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.setAttribute('aria-labelledby', 'passSpotTitre');
    voile.style.setProperty('--pass', /^#[0-9a-f]{3,8}$/i.test(o.couleur ?? '') ? o.couleur : '#c9772e');
    voile.innerHTML = `
      <button type="button" class="pass-spot-x" data-fermer aria-label="Fermer">×</button>
      <div class="pass-spot-defile" aria-hidden="true">${images}</div>
      <div class="pass-spot-texte">
        <span class="pass-spot-sur">NOUVEAU</span>
        <h2 id="passSpotTitre"><span>${esc(`PASS ${o.numero}`)}</span>${esc(o.nom)}</h2>
        <ol class="pass-spot-lignes">
          <li>La tenue de la saison sur tes Fanzzy</li>
          <li>Ton badge et ton cadre de carte</li>
          ${o.packs ? `<li>${esc(`${o.packs} boosters dès l’achat`)}</li>` : ''}
          <li>Des boosters qui reviennent plus vite</li>
        </ol>
        <p class="pass-spot-prix">${esc(prix)}${o.deux ? ' · 2 saisons' : ''}<small>Payé une fois · tout le jeu reste gratuit</small></p>
        <div class="pass-spot-boutons">
          <a class="tbf-plaque tbf-bloc" data-ton="or" href="/abonnement">VOIR LE PASS</a>
          <button type="button" class="pass-spot-tard" data-fermer>Plus tard</button>
        </div>
      </div>
      <i class="pass-spot-jauge" aria-hidden="true"></i>`;
    document.body.appendChild(voile);
    marquer(userId);

    /* Le défilé : une image toutes les 900 ms, puis le dernier carton reste. */
    const imgs = [...voile.querySelectorAll('.pass-spot-defile img')];
    imgs.forEach((im) => window.TBF_PASS?.cadrer?.(im, { marge: 0.12 }));
    let i = 0;
    const t = calme() ? null : setInterval(() => {
      const vivantes = imgs.filter((x) => x.isConnected);
      if (vivantes.length < 2) return;
      vivantes[i % vivantes.length]?.classList.remove('on');
      i += 1;
      vivantes[i % vivantes.length]?.classList.add('on');
    }, 900);

    const avant = document.activeElement;
    const fermer = () => {
      clearInterval(t);
      voile.classList.add('pass-spot-part');
      setTimeout(() => voile.remove(), 300);
      removeEventListener('keydown', echap);
      avant?.focus?.();
    };
    const echap = (e) => { if (e.key === 'Escape') fermer(); };
    addEventListener('keydown', echap);
    voile.addEventListener('click', (e) => { if (e.target.closest('[data-fermer]')) fermer(); });
    requestAnimationFrame(() => {
      voile.classList.add('on');
      voile.querySelector('.pass-spot-tard')?.focus({ preventScroll: true });
    });
  }

  /* -------------------------------------------------------------- départ */

  async function accueil() {
    const hub = $('hub');
    if (!hub?.classList.contains('on')) return;
    const a = await lire();
    const o = offreDe(a);
    if (!o) return;
    plaque(o);
    let userId = null;
    try {
      userId = (await (window.TBF_MOI ??= fetch('/api/auth/me', { credentials: 'same-origin' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j?.user ?? null)
        .catch(() => null)))?.id ?? null;
    } catch { /* sans compte lisible, pas de spot */ }
    if (!userId || dejaVu(userId)) return;
    /* Un temps après le rideau : la visite guidée d'un premier jour, si elle
       part, passe avant. */
    setTimeout(() => {
      if (document.querySelector('.tbf-visite, dialog[open], .pass-spot')) return;
      if (/[?&]visite=1/.test(location.search)) return;
      spot(o, userId);
    }, 1200);
  }

  const partir = () => {
    /* Le hub s'ouvre après `/api/auth/me` : on attend qu'il soit là. */
    let essais = 0;
    const voir = () => {
      if ($('hub')?.classList.contains('on')) { accueil(); return; }
      if (++essais < 40) setTimeout(voir, 250);
    };
    voir();
  };
  if (document.getElementById('ouverture')) addEventListener('tbf:ouverture-finie', partir, { once: true });
  else if (document.readyState === 'loading') addEventListener('DOMContentLoaded', partir, { once: true });
  else partir();
})();
