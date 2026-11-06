/**
 * **L'appel d'un ami**, annoncé en grand au joueur connecté.
 *
 * Demande de Gaël du 6 novembre 2026 : « lors d'une demande d'ami, est-ce
 * que l'autre USER reçoit une alerte ? ou juste une pastille ? ce serait bien
 * une alerte pour lui dire qu'il a une demande. la même chose s'il est
 * connecté et qu'un USER lui demande de jouer un duel ou de le rejoindre. »
 *
 * Jusque-là, une demande d'ami et une invitation dans un KOP ne posaient
 * qu'un chiffre violet sur une tuile, et l'invitation en duel un petit
 * bandeau (`duel-rappel.js`). Ce fichier les annonce dans **la case des
 * fêtes** (`niveau-fete.js`, `TBF_NIVEAU.annoncer`), comme le cadeau de
 * l'administration : le Fanzzy de celui qui appelle arrive dans la case, une
 * bulle lui sort de la bouche, son pseudo claque en grand, et un bouton
 * répond tout de suite.
 *
 * ## Trois appels
 *
 *   — **une demande d'ami** : ACCEPTER (la réponse part d'ici), sinon PLUS
 *     TARD ; plusieurs à la fois : la plus récente, et VOIR LES DEMANDES ;
 *   — **une invitation en duel** (`duel-rappel.js` la lit dans
 *     `/api/nvn/moi` et nous la passe, `TBF_APPEL.duel`) : REJOINDRE LE DUEL
 *     mène au vestiaire ; PLUS TARD laisse le petit bandeau du rappel, qui
 *     reste le chemin pour y aller ensuite ;
 *   — **une invitation dans un KOP** : REJOINDRE LE KOP (la réponse part
 *     d'ici, puis la page du KOP), sinon PLUS TARD.
 *
 * ## Où, et quand
 *
 * Chargé par `nav.js` sur toutes les pages d'un joueur connecté, et par
 * l'accueil. Les demandes d'ami et de KOP sont lues dans `/api/amis/alertes`
 * peu après l'arrivée, toutes les quarante-cinq secondes tant que la page
 * est visible, au retour sur l'onglet, et tout de suite quand une
 * notification du téléphone arrive pendant que le jeu est ouvert (`pwa.js`).
 * L'invitation en duel arrive à la cadence du rappel, dix secondes. Jamais
 * pendant un duel ni au Virage (on y joue), ni dans l'administration, ni
 * pendant la cérémonie d'arrivée ; pas de demande d'ami sur la page des amis,
 * qui les montre déjà.
 *
 * ## Une fois
 *
 * Chaque appel n'est annoncé qu'**une fois par appareil** : la page retient
 * ceux qu'elle a montrés, signés du joueur (`tbf-appel-vu`). Le chiffre
 * violet, lui, reste tant qu'on n'a pas répondu. Aucune colonne en base.
 */
(() => {
  if (window.TBF_APPEL) return;

  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ECH[c]);
  const doux = () => (typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');

  const chemin = location.pathname.replace(/\/$/, '') || '/';
  /* Là où l'on ne dérange pas : on joue, on administre, on s'inscrit. */
  const JAMAIS = ['/admin', '/duel-nvn', '/virage', '/bienvenue', '/repetition', '/diagnostic'];
  const ici = !JAMAIS.includes(chemin);
  /* La page des amis montre déjà les demandes, avec leurs boutons. */
  const surLesAmis = chemin === '/amis';

  /* ------------------------------------------------ la mémoire de l'appareil */
  const CLE = 'tbf-appel-vu';
  const lireTout = () => {
    try {
      const o = JSON.parse(localStorage.getItem(CLE) || 'null');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch { return {}; }
  };
  const vus = (qui) => new Set(Array.isArray(lireTout()[qui]) ? lireTout()[qui] : []);
  function retenir(qui, cles) {
    const o = lireTout();
    const l = Array.isArray(o[qui]) ? o[qui].filter((c) => !cles.includes(c)) : [];
    l.push(...cles);
    delete o[qui];
    o[qui] = l.slice(-80);
    const comptes = Object.keys(o);
    while (comptes.length > 4) delete o[comptes.shift()];
    try { localStorage.setItem(CLE, JSON.stringify(o)); } catch { /* vaut pour rien */ }
  }
  const cleAmi = (d) => `a:${d.id}:${d.depuis ?? ''}`;
  const cleKop = (k) => `k:${k.kopId}:${k.depuis ?? ''}`;
  const cleDuel = (inv) => `d:${inv.code}`;

  const moi = () => (window.TBF_MOI ??= fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j?.user ?? null)
    .catch(() => null));

  /* --------------------------------------------- ce qu'on charge à la demande */
  const scripts = new Map();
  function script(src, present) {
    if (present()) return Promise.resolve(true);
    if (!scripts.has(src)) {
      scripts.set(src, new Promise((ok) => {
        const s = document.createElement('script');
        s.src = src;
        s.addEventListener('load', () => ok(true), { once: true });
        s.addEventListener('error', () => ok(false), { once: true });
        document.head.append(s);
      }));
    }
    return scripts.get(src);
  }
  /* La case commune, et de quoi dessiner le Fanzzy d'un autre : la page des
     amis les a déjà ; une autre page les charge la première fois. */
  async function outils() {
    await script('/fanzzy-etats.js', () => Boolean(window.TBF_ETATS));
    await script('/fanzzy-art.js', () => Boolean(window.FZART));
    const E = window.TBF_ETATS;
    if (typeof E?.charger === 'function' && !E.pret?.()) {
      await Promise.race([E.charger(), new Promise((r) => setTimeout(r, 1250))]);
    }
    await script('/niveau-fete.js', () => Boolean(window.TBF_NIVEAU?.annoncer));
    return window.TBF_NIVEAU ?? null;
  }

  /** Le Fanzzy de celui qui appelle, en joie, ou `null`. */
  function dessin(avatar) {
    if (!avatar?.id) return null;
    try {
      return window.FZART?.dessinAvatar?.({ ...avatar, id: String(avatar.id) }, 'plein',
        { etat: 'victoire' }) ?? null;
    } catch { return null; }
  }

  /* --------------------------------------------------------------- dessins */

  /* Le petit écusson au coin de la scène : deux écharpes croisées pour le
     duel, un supporter et un « + » pour un ami, le drapeau pour un KOP. Au
     trait d'encre, comme la cocarde qu'il remplace. */
  const ICONES = {
    ami: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#7B5CFF" stroke="#111" stroke-width="3"/>
      <circle cx="20" cy="19" r="6" fill="#F2EEE4" stroke="#111" stroke-width="2.5"/>
      <path d="M9 36c1-7 6-10 11-10s10 3 11 10Z" fill="#F2EEE4" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M36 15v12M30 21h12" stroke="#111" stroke-width="7" stroke-linecap="round"/>
      <path d="M36 15v12M30 21h12" stroke="#F5C33B" stroke-width="3.5" stroke-linecap="round"/></svg>`,
    duel: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#E0402C" stroke="#111" stroke-width="3"/>
      <path d="M13 13l22 22M35 13L13 35" stroke="#111" stroke-width="7" stroke-linecap="round"/>
      <path d="M13 13l22 22" stroke="#F5C33B" stroke-width="4" stroke-linecap="round"/>
      <path d="M35 13L13 35" stroke="#F2EEE4" stroke-width="4" stroke-linecap="round"/></svg>`,
    kop: `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#F5C33B" stroke="#111" stroke-width="3"/>
      <path d="M17 36V12" stroke="#111" stroke-width="3" stroke-linecap="round"/>
      <path d="M17 13h16l-4 6 4 6H17Z" fill="#E0402C" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  };

  /** La scène : la bulle de celui qui appelle et l'écusson de l'appel. */
  const scene = (sorte, bulle, id) => `<span class="tbf-appel-scene" id="${id}" data-appel="${sorte}">
      <span class="tbf-appel-bulle">${esc(bulle)}</span>
      <span class="tbf-appel-icone">${ICONES[sorte] ?? ''}</span>
    </span>`;

  /** La bulle saute, l'écusson tourne, le Fanzzy salue : dès que la case
      est posée (la file peut la faire attendre derrière une autre fête). */
  function guetter(id) {
    let guet = true;
    const tour = () => {
      if (!guet) return;
      const el = document.getElementById(id);
      if (!el) { requestAnimationFrame(tour); return; }
      if (doux()) return;
      const anim = (x, kf, o) => { try { return x?.animate(kf, o); } catch { return null; } };
      const deg = (n) => `${n}deg`;
      anim(el.querySelector('.tbf-appel-bulle'), [{ scale: '0', opacity: 0 }, { scale: '1.15', opacity: 1, offset: 0.6 },
        { scale: '1', opacity: 1 }], { duration: 420, delay: 520, easing: 'cubic-bezier(.2,1.4,.35,1)', fill: 'backwards' });
      anim(el.querySelector('.tbf-appel-icone'), [{ scale: '0', rotate: deg(-90) }, { scale: '1.2', rotate: deg(10), offset: 0.6 },
        { scale: '1', rotate: deg(0) }], { duration: 460, delay: 300, easing: 'cubic-bezier(.2,1.3,.35,1)', fill: 'backwards' });
      /* Le Fanzzy salue : deux petits balancements, une fois arrivé. */
      const perso = el.closest('.tbf-niv-scene')?.querySelector('.tbf-niv-perso');
      setTimeout(() => anim(perso, [{ rotate: deg(0) }, { rotate: deg(-5), offset: 0.25 }, { rotate: deg(5), offset: 0.5 },
        { rotate: deg(-3), offset: 0.75 }, { rotate: deg(0) }], { duration: 900, easing: 'ease-in-out' }), 700);
      setTimeout(() => window.FX?.particules?.({ x: el.clientWidth * 0.3, y: el.clientHeight * 0.3, n: 14, papier: true,
        distance: 90, duree: 900, dans: el.closest('.tbf-niv-scene') ?? el,
        couleurs: ['#7B5CFF', window.FX?.couleurs?.or ?? '#F5C33B', '#F2EEE4'] }), 620);
    };
    requestAnimationFrame(tour);
    return () => { guet = false; };
  }

  /** Un mot bref en bas de l'écran, après une réponse. */
  function bandeau(texte) {
    let p = document.querySelector('body > .tbf-pile');
    if (!p) {
      p = document.createElement('div');
      p.className = 'tbf-pile';
      document.body.append(p);
    }
    const t = document.createElement('div');
    t.className = 'tbf-toast';
    t.setAttribute('role', 'status');
    t.textContent = texte;
    p.append(t);
    setTimeout(() => t.remove(), 4000);
  }
  /* La pastille violette relira à la page suivante. */
  const oublierPastille = () => { try { sessionStorage.removeItem('tbf-etat-amis'); } catch { /* rien */ } };
  const poster = (url, corps) => fetch(url, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
    .then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) }))
    .catch(() => ({ ok: false, j: null }));

  /* ----------------------------------------------------------- les annonces */

  /** Ouvre la case d'un appel. Rend le bouton touché. */
  async function annoncer({ sorte, avatar, bulle, quoi, titre, de, promesse, boutons, son }) {
    const N = await outils();
    if (!N?.annoncer) return undefined;
    const id = `tbf-appel-${Date.now().toString(36)}`;
    const fin = guetter(id);
    try {
      return await N.annoncer({
        nomDeLaFete: quoi, quoi, titre: `<b>${esc(titre)}</b>`, petit: String(titre).length > 11,
        de, promesse, src: dessin(avatar), scene: scene(sorte, bulle, id),
        avant: 0, n: 0, ecarpes: 0, son, boutons, fermer: 'PLUS TARD',
      });
    } finally { fin(); }
  }

  async function demandeAmi(liste) {
    const d = liste[0];
    const autres = liste.length - 1;
    /* Hors d'une clé `de` : le relevé des langues la prend pour l'allemand. */
    const phrase = autres === 0 ? 'veut devenir ton pote de tribune !'
      : autres === 1 ? 'veut devenir ton pote de tribune ! Une autre demande t’attend.'
        : `veut devenir ton pote de tribune ! ${autres} autres demandes t’attendent.`;
    const choix = await annoncer({
      sorte: 'ami', avatar: d.avatar, bulle: 'ON SE SUIT ?',
      quoi: autres ? `${liste.length} DEMANDES D’AMI` : 'DEMANDE D’AMI',
      titre: d.pseudo,
      de: phrase,
      promesse: '<div class="tbf-niv-libelle">ENTRE AMIS : GESTES, CADEAUX, DUELS ENSEMBLE</div>',
      boutons: [{ texte: 'ACCEPTER', valeur: 'accepter' },
        ...(autres ? [{ texte: 'VOIR LES DEMANDES', valeur: 'voir' }] : [])],
      son: 'carillon',
    });
    if (choix === 'accepter') {
      const r = await poster('/api/amis/reponse', { id: d.id, ok: true });
      oublierPastille();
      if (r.ok) bandeau(`${String(d.pseudo ?? '').toUpperCase()} ET TOI, VOUS ÊTES POTES !`);
      else location.href = '/amis?vue=demandes';
    } else if (choix === 'voir') {
      location.href = '/amis?vue=demandes';
    }
  }

  async function invitationKop(k) {
    const phrase = !k.de ? 'On t’invite à rejoindre un KOP'
      : k.club ? `${esc(k.de)} t’invite à rejoindre son KOP · ${esc(k.club)}`
        : `${esc(k.de)} t’invite à rejoindre son KOP`;
    const choix = await annoncer({
      sorte: 'kop', avatar: k.avatar, bulle: 'REJOINS-NOUS !',
      quoi: 'INVITATION DANS UN KOP', titre: k.nom || 'UN KOP',
      de: phrase,
      promesse: '<div class="tbf-niv-libelle">UN KOP, C’EST DES VOTES ET DES GAINS À PLUSIEURS</div>',
      boutons: [{ texte: 'REJOINDRE LE KOP', valeur: 'rejoindre' }],
      son: 'carillon',
    });
    if (choix === 'rejoindre') {
      const r = await poster('/api/amis/kop/reponse', { kopId: k.kopId, ok: true });
      oublierPastille();
      location.href = r.ok ? '/kop' : '/amis?vue=demandes';
    }
  }

  async function invitationDuel(inv) {
    let avatar = null;
    if (inv.deId) {
      try {
        const r = await fetch(`/api/amis/alertes?visage=${encodeURIComponent(inv.deId)}`,
          { credentials: 'same-origin', cache: 'no-store' });
        if (r.ok) avatar = (await r.json())?.visage?.avatar ?? null;
      } catch { /* sans visage : la case seule */ }
    }
    const clubs = [inv.club?.name, inv.enFaceClub?.name].filter(Boolean).join(' – ');
    const phrase = clubs ? `te défie en duel ${esc(inv.format ?? '')} · ${esc(clubs)}`
      : `te défie en duel ${esc(inv.format ?? '')}`;
    const choix = await annoncer({
      sorte: 'duel', avatar, bulle: 'ON JOUE ?',
      quoi: 'INVITATION EN DUEL', titre: inv.de || 'UN AMI',
      de: phrase,
      promesse: '<div class="tbf-niv-libelle">IL T’ATTEND AU VESTIAIRE</div>',
      boutons: [{ texte: 'REJOINDRE LE DUEL', valeur: 'rejoindre' }],
      son: 'charge',
    });
    if (choix === 'rejoindre') {
      const q = new URLSearchParams({ duel: inv.code, match: String(inv.fixtureId ?? ''),
        format: inv.format ?? '' });
      location.href = `/duel-nvn?${q}`;
    }
  }

  /* -------------------------------------------------------- la vérification */

  let enCours = false;
  /** Un appel à la fois : la case n'en montre qu'un, la file des fêtes fait
      attendre les autres, et cette garde évite d'en empiler deux du même. */
  const enAttente = [];
  async function suivant() {
    if (enCours) return;
    const t = enAttente.shift();
    if (!t) return;
    enCours = true;
    try { await t(); } catch { /* un réseau qui hoquette : on réessaiera */ } finally {
      enCours = false;
      void suivant();
    }
  }
  const pret = () => ici && !document.hidden && !document.getElementById('ouverture');

  let lecture = false;
  async function verifier() {
    if (!pret() || enCours || lecture) return;
    lecture = true;
    try {
      const u = await moi();
      if (!u?.id) return;
      const qui = String(u.id);
      const r = await fetch('/api/amis/alertes', { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      const deja = vus(qui);
      const amis = (Array.isArray(j?.demandes) ? j.demandes : []).filter((d) => !deja.has(cleAmi(d)));
      const kops = (Array.isArray(j?.kops) ? j.kops : []).filter((k) => !deja.has(cleKop(k)));
      if (amis.length && !surLesAmis) {
        retenir(qui, amis.map(cleAmi));
        enAttente.push(() => demandeAmi(amis));
      }
      if (kops.length && !surLesAmis) {
        retenir(qui, kops.map(cleKop));
        for (const k of kops.slice(0, 2)) enAttente.push(() => invitationKop(k));
      }
      void suivant();
    } catch { /* on réessaiera */ } finally {
      lecture = false;
    }
  }

  /** L'invitation en duel que `duel-rappel.js` vient de lire. */
  async function duel(inv) {
    if (!inv?.code || !pret()) return;
    const u = await moi();
    if (!u?.id) return;
    const qui = String(u.id);
    if (vus(qui).has(cleDuel(inv))) return;
    retenir(qui, [cleDuel(inv)]);
    enAttente.push(() => invitationDuel(inv));
    void suivant();
  }

  if (ici) {
    setTimeout(verifier, chemin === '/' ? 3400 : 1600);
    setInterval(verifier, 45000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(verifier, 900); });
  }

  window.TBF_APPEL = { verifier, duel };
})();
