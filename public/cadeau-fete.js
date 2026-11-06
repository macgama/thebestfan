/**
 * Le cadeau de l'administration, annoncé au joueur.
 *
 * Demande de Gaël du 6 novembre 2026 : « Lorsque l'Admin offre qqch depuis la
 * zone Admin, il faudrait une alerte chez le USER pour qu'il sache qu'il a
 * gagné qqch. Une alerte gaming qui donne envie et pour que le USER se dise
 * qu'il est chanceux d'avoir obtenu qqch. »
 *
 * ## Où, et quand
 *
 * Chargé par `nav.js` sur toutes les pages d'un joueur connecté, et par
 * l'accueil (qui n'a pas la barre). Il demande `/api/cadeaux` peu après
 * l'arrivée, puis toutes les quarante-cinq secondes tant que la page est
 * visible, et au retour sur l'onglet : un cadeau offert pendant que le joueur
 * est en ligne arrive **en direct**, une minute au plus après le geste de
 * l'admin ; offert pendant son absence, à sa prochaine visite. Jamais pendant
 * un duel ni au Virage (on y joue : il attend la page d'après), ni dans
 * l'administration, ni pendant la cérémonie d'arrivée.
 *
 * ## La même case que les autres fêtes
 *
 * La case est celle de la montée de niveau, de la mission réussie et du
 * niveau de la voie PASS (`niveau-fete.js`, `TBF_NIVEAU.annoncer`) : une seule
 * mise en scène, et **une seule file** — un cadeau qui arrive pendant une
 * montée de niveau attend qu'on l'ait refermée. Ce fichier n'y ajoute que sa
 * scène : un paquet qui tombe, tremble trois fois, et saute ; le Fanzzy offert
 * en sort, s'il y en a un, au milieu d'une gerbe de confettis. Le son est le
 * sien (« cadeau », `son.js`) : le roulement, le pop, la pluie de notes.
 *
 * ## Une fois, partout
 *
 * Le serveur retient le dernier cadeau vu (`user_wallet.cadeau_vu`). La page
 * le retient aussi, signé du joueur, et l'envoie (`?depuis=`) : sans la
 * colonne en base, c'est cette mémoire qui empêche de refêter le même cadeau
 * à chaque page.
 */
(() => {
  if (window.TBF_CADEAU) return;

  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ECH[c]);
  const doux = () => (typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');

  const chemin = location.pathname.replace(/\/$/, '') || '/';
  /* Là où l'on ne dérange pas : on joue, on administre, on s'inscrit. */
  const JAMAIS = ['/admin', '/duel-nvn', '/virage', '/bienvenue', '/repetition', '/diagnostic'];
  const ici = !JAMAIS.includes(chemin);

  /* ------------------------------------------------ la mémoire de l'appareil */
  const CLE = 'tbf-cadeau-vu';
  const lireTout = () => {
    try {
      const o = JSON.parse(localStorage.getItem(CLE) || 'null');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch { return {}; }
  };
  const lireVu = (qui) => Number(lireTout()[qui]) || 0;
  function retenirVu(qui, n) {
    const o = lireTout();
    const v = Math.max(Number(o[qui]) || 0, Number(n) || 0);
    delete o[qui];
    o[qui] = v;
    const cles = Object.keys(o);
    while (cles.length > 4) delete o[cles.shift()];
    try { localStorage.setItem(CLE, JSON.stringify(o)); } catch { /* vaut pour rien */ }
  }

  const moi = () => (window.TBF_MOI ??= fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j?.user ?? null)
    .catch(() => null));

  /* La case commune : `niveau-fete.js`, chargé à la demande. */
  let chargement = null;
  function caseCommune() {
    if (window.TBF_NIVEAU?.annoncer) return Promise.resolve(window.TBF_NIVEAU);
    chargement ??= new Promise((ok) => {
      const s = document.createElement('script');
      s.src = '/niveau-fete.js';
      s.addEventListener('load', () => ok(window.TBF_NIVEAU ?? null), { once: true });
      s.addEventListener('error', () => ok(null), { once: true });
      document.head.append(s);
    });
    return chargement;
  }

  /* --------------------------------------------------------------- dessins */

  /* Le paquet : une boîte rouge, son ruban or, son nœud, au trait d'encre
     (le FAIT MAIN des cases). Le couvercle est un groupe à part : c'est lui
     qui saute. */
  const PAQUET = `<svg class="tbf-cadeau-paquet" viewBox="0 0 120 120" aria-hidden="true">
    <g class="tbf-cadeau-boite" stroke="#111" stroke-width="3" stroke-linejoin="round">
      <rect x="22" y="56" width="76" height="56" rx="3" fill="#E0402C"/>
      <rect x="53" y="56" width="14" height="56" fill="#F5C33B"/>
      <path d="M22 66h76" stroke-opacity=".35"/>
    </g>
    <g class="tbf-cadeau-couvercle" stroke="#111" stroke-width="3" stroke-linejoin="round">
      <path d="M58 40c-10-14-30-12-27-2 2 7 17 6 27 2Z" fill="#F5C33B"/>
      <path d="M62 40c10-14 30-12 27-2-2 7-17 6-27 2Z" fill="#F5C33B"/>
      <rect x="16" y="40" width="88" height="18" rx="3" fill="#E0402C"/>
      <rect x="53" y="40" width="14" height="18" fill="#F5C33B"/>
    </g>
  </svg>`;

  /* Les petits dessins des gains sans image : le billet du PASS, le ticket
     de l'abonnement, la pièce d'équipement. Au trait, `currentColor`. */
  const BILLET = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4Z"/><path d="M9 7v10" stroke-dasharray="2 2"/></svg>`;
  const ETOILE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z"/></svg>`;

  const RARETES = { commune: 'COMMUNE', rare: 'RARE', epique: 'ÉPIQUE', legendaire: 'LÉGENDAIRE' };
  const MOIS = (j) => (j % 365 === 0 ? `${j / 365} AN${j > 365 ? 'S' : ''}`
    : j % 30 === 0 ? `${j / 30} MOIS` : `${j} JOURS`);

  /** Le dessin d'un Fanzzy offert, au premier âge, s'il est connu de la page. */
  function dessinFanzzy(id, age = 1, skin = 'base') {
    try {
      const E = window.TBF_ETATS;
      if (E?.pret?.()) {
        const r = E.resoudre(String(id), { evo: age, skin, etat: 'victoire' })
          ?? E.resoudre(String(id), { evo: age, skin });
        if (r?.src) return r.src;
      }
      if (typeof window.FZART?.dessinAvatar === 'function') {
        return window.FZART.dessinAvatar({ id: String(id), evo: age, skin }, 'plein', { etat: 'victoire' }) ?? null;
      }
    } catch { /* pas de dessin : le paquet seul */ }
    return null;
  }
  async function dessinsPrets() {
    const E = window.TBF_ETATS;
    if (typeof E?.charger !== 'function' || E.pret?.()) return;
    await Promise.race([E.charger(), new Promise((r) => setTimeout(r, 1250))]);
  }

  /**
   * Ce que la case dit, cadeau par cadeau. **Le serveur envoie la donnée, la
   * page écrit la phrase** (la règle de `niveau-fete.js`).
   */
  function stickers(cadeaux, colle) {
    const l = [];
    let k = 0;
    const d = () => colle(1150 + (k++) * 170);
    for (const c of cadeaux) {
      if (c.sorte === 'echarpes') {
        l.push(`<span class="tbf-sticker tbf-sticker--prix tbf-niv-ech${d()}"><img
          src="/img/gains/echarpes.webp" alt="" decoding="async"><b>+${esc(c.n)}</b> ÉCHARPES</span>`);
      } else if (c.sorte === 'boosters') {
        l.push(`<span class="tbf-sticker tbf-sticker--prix${d()}" data-ton="or"><b>+${esc(c.n)}</b> ${
          c.n > 1 ? 'BOOSTERS' : 'BOOSTER'}</span>`);
      } else if (c.sorte === 'fanzzy') {
        const rar = RARETES[c.rar] ?? '';
        l.push(`<span class="tbf-cadeau-ligne"><span class="tbf-sticker${d()}" data-ton="or">${ETOILE}FANZZY ${
          esc(String(c.nom ?? '').toUpperCase())}</span>${rar ? `<small>${esc(rar)}</small>` : ''}</span>`);
      } else if (c.sorte === 'skin') {
        l.push(`<span class="tbf-cadeau-ligne"><span class="tbf-sticker${d()}">${ETOILE}TENUE ${
          esc(String(c.nom ?? '').toUpperCase())}</span><small>pour ${esc(c.nomFanzzy)}</small></span>`);
      } else if (c.sorte === 'ultime') {
        l.push(`<span class="tbf-cadeau-ligne"><span class="tbf-sticker${d()}" data-ton="or">${ETOILE}CARTE ULTIMATE</span>
          <small>pour ${esc(c.nomFanzzy)}</small></span>`);
      } else if (c.sorte === 'stuff') {
        l.push(`<span class="tbf-sticker${d()}">${ETOILE}${esc(String(c.nom ?? '').toUpperCase())}</span>`);
      } else if (c.sorte === 'pass') {
        l.push(`<span class="tbf-cadeau-ligne"><span class="tbf-sticker${d()}" data-ton="or">${BILLET}LE PASS ${
          esc(c.saison)}</span>${c.nom && c.nom !== `PASS ${c.saison}` ? `<small>${esc(c.nom)}</small>` : ''}</span>`);
      } else if (c.sorte === 'abonnement') {
        l.push(`<span class="tbf-sticker${d()}">${BILLET}${c.jours ? `ABONNEMENT ${esc(MOIS(c.jours))}`
          : 'ABONNEMENT OFFERT'}</span>`);
      } else if (c.sorte === 'distinction') {
        const badge = window.TBF_PASS?.distinctions?.([c.distinction], '') ?? '';
        l.push(`<span class="tbf-cadeau-ligne"><span class="tbf-sticker${d()}" data-ton="or">${badge}BADGE ${
          esc(String(c.nom ?? '').toUpperCase())}</span>${c.texte ? `<small>${esc(c.texte)}</small>` : ''}</span>`);
      }
    }
    return l.join('');
  }

  /* --------------------------------------------------- la scène qui s'ouvre */

  /**
   * Joue le paquet : il tombe, tremble trois fois, le couvercle saute dans
   * un éclair, les confettis jaillissent et le Fanzzy offert sort de la
   * boîte. Sans mouvement : la boîte ouverte, le Fanzzy debout, tout de suite.
   */
  function jouerScene(scene) {
    const paquet = scene.querySelector('.tbf-cadeau-paquet');
    const couvercle = scene.querySelector('.tbf-cadeau-couvercle');
    const perso = scene.querySelector('.tbf-cadeau-perso');
    const eclat = scene.querySelector('.tbf-cadeau-eclat');
    const F = window.FX;
    const ouvrir = () => {
      scene.classList.add('tbf-cadeau-ouvert');
    };
    if (doux()) { ouvrir(); return; }
    /* Le son part avec la case : le roulement pendant que le paquet
       tremble, le pop quand il saute (son.js, « cadeau »). */
    setTimeout(() => F?.son?.('cadeau'), 250);
    const anim = (el, kf, o) => { try { return el?.animate(kf, o); } catch { return null; } };
    anim(paquet, [{ translate: '0 -90px', scale: '.6', opacity: 0 }, { translate: '0 6px', scale: '1.04', opacity: 1, offset: 0.7 },
      { translate: '0 0', scale: '1', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,1.2,.35,1)', fill: 'backwards' });
    /* Trois secousses, de plus en plus fortes : il y a quelque chose dedans. */
    [0, 1, 2].forEach((i) => anim(paquet, [{ rotate: '0deg' }, { rotate: `${-(5 + i * 3)}deg`, offset: 0.25 },
      { rotate: `${5 + i * 3}deg`, offset: 0.75 }, { rotate: '0deg' }],
    { duration: 170, delay: 250 + i * 200, easing: 'ease-in-out' }));
    setTimeout(() => {
      ouvrir();
      anim(couvercle, [{ translate: '0 0', rotate: '0deg', opacity: 1 },
        { translate: '-14px -70px', rotate: '-32deg', opacity: 0 }],
      { duration: 520, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      anim(eclat, [{ scale: '.2', opacity: 1 }, { scale: '2.6', opacity: 0 }],
        { duration: 600, easing: 'ease-out', fill: 'forwards' });
      anim(paquet, [{ scale: '1 1' }, { scale: '1.12 .86', offset: 0.3 }, { scale: '1 1' }],
        { duration: 300, easing: 'ease-out' });
      if (perso) {
        perso.style.opacity = '';
        anim(perso, [{ translate: '0 70px', scale: '.4', opacity: 0 }, { translate: '0 -8px', scale: '1.06', opacity: 1, offset: 0.7 },
          { translate: '0 0', scale: '1', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.2,1.3,.35,1)', fill: 'backwards' });
      }
      F?.particules?.({ x: scene.clientWidth / 2, y: scene.clientHeight * 0.62, n: 44, papier: true,
        distance: 150, duree: 1200, dans: scene,
        couleurs: [F.couleurs?.or ?? '#F5C33B', '#E0402C', F.couleurs?.craie ?? '#F2EEE4'] });
      try { navigator.vibrate?.([20, 40, 20, 40, 90]); } catch { /* pas de moteur */ }
    }, 870);
  }

  /* ------------------------------------------------------------- la fête */

  let enCours = false;

  /** Ouvre la fête d'une liste de cadeaux. Rend le bouton touché. */
  async function feter(cadeaux) {
    const N = await caseCommune();
    if (!N?.annoncer || !cadeaux?.length) return undefined;
    await dessinsPrets();
    const sans = doux();
    const colle = (ms) => (sans ? '' : ` tbf-colle" style="--d:${ms}ms`);
    const fz = cadeaux.find((c) => c.sorte === 'fanzzy')
      ?? cadeaux.find((c) => c.sorte === 'skin' || c.sorte === 'ultime');
    const src = fz ? dessinFanzzy(fz.fanzzy, fz.age ?? 1, fz.sorte === 'skin' ? fz.skin : 'base') : null;
    const id = `tbf-cadeau-${Date.now().toString(36)}`;
    const scene = `<span class="tbf-cadeau-scene${src ? ' tbf-cadeau-scene--perso' : ''}" id="${id}">
        <i class="tbf-cadeau-eclat"></i>
        ${src ? `<img class="tbf-cadeau-perso" alt="" decoding="async" src="${esc(src)}"${sans ? '' : ' style="opacity:0"'}>` : ''}
        ${PAQUET}
      </span>`;
    const ech = cadeaux.find((c) => c.sorte === 'echarpes');
    const boutons = [];
    if (cadeaux.some((c) => ['fanzzy', 'skin', 'ultime', 'stuff'].includes(c.sorte))) {
      boutons.push({ texte: 'VOIR MA COLLECTION', valeur: 'collection' });
    } else if (cadeaux.some((c) => c.sorte === 'boosters')) {
      boutons.push({ texte: 'OUVRIR MES BOOSTERS', valeur: 'boosters' });
    }
    const un = cadeaux.length === 1;
    /* Guetter la case pour jouer sa scène dès qu'elle est posée : la file
       peut la faire attendre derrière une autre fête. */
    let guet = true;
    const guetter = () => {
      if (!guet) return;
      const el = document.getElementById(id);
      if (el) { jouerScene(el); return; }
      requestAnimationFrame(guetter);
    };
    requestAnimationFrame(guetter);
    const choix = await N.annoncer({
      nomDeLaFete: un ? 'Cadeau reçu' : `${cadeaux.length} cadeaux reçus`,
      quoi: un ? 'UN CADEAU POUR TOI !' : `${cadeaux.length} CADEAUX POUR TOI !`,
      titre: 'JACKPOT !',
      de: 'L’équipe TheBestFan pense à toi. Quelle chance !',
      butin: stickers(cadeaux, colle),
      promesse: '<div class="tbf-niv-libelle">OFFERT PAR L’ÉQUIPE THEBESTFAN</div>',
      scene, avant: 0, n: 0, ecarpes: ech?.n ?? 0, son: 'tic',
      boutons,
    });
    guet = false;
    return choix;
  }

  /* -------------------------------------------------------- la vérification */

  async function verifier() {
    if (!ici || enCours || document.hidden) return;
    /* La cérémonie d'arrivée et l'écran de chargement de l'accueil d'abord. */
    if (document.getElementById('ouverture')) return;
    enCours = true;
    try {
      const u = await moi();
      if (!u?.id) return;
      const qui = String(u.id);
      const r = await fetch(`/api/cadeaux?depuis=${lireVu(qui)}`, { credentials: 'same-origin' });
      if (!r.ok) return;
      const j = await r.json();
      const cadeaux = Array.isArray(j?.cadeaux) ? j.cadeaux : [];
      const jusqua = Number(j?.jusqua) || 0;
      if (!cadeaux.length) { if (jusqua) retenirVu(qui, jusqua); return; }
      const choix = await feter(cadeaux);
      /* Vu, quoi qu'on ait touché : la fête ne revient pas. */
      retenirVu(qui, jusqua);
      fetch('/api/cadeaux/vu', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jusqua }) })
        .catch(() => {});
      /* Le solde affiché a changé : la barre relit (comme après un bonus). */
      if (cadeaux.some((c) => c.sorte === 'echarpes' || c.sorte === 'boosters')) {
        dispatchEvent(new CustomEvent('tbf:bourse', { detail: { wallet: null, niveau: null } }));
      }
      if (choix === 'collection') location.href = '/collection';
      else if (choix === 'boosters') location.href = '/boosters';
    } catch { /* un réseau qui hoquette : on réessaiera */ } finally {
      enCours = false;
    }
  }

  if (ici) {
    setTimeout(verifier, chemin === '/' ? 2600 : 1200);
    setInterval(verifier, 45000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(verifier, 600); });
  }

  window.TBF_CADEAU = { verifier, feter, stickers };
})();
