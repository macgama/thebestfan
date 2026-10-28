/**
 * **Le rappel du duel**, sur toutes les pages sauf celle du duel.
 *
 * Un duel qui attend ne meurt plus quand on quitte son écran (voir « un duel
 * qui attend », `src/server/nvn/index.js`) : sa place reste, les autres la
 * voient, et c'est ici qu'on rappelle le joueur parti voir ailleurs. Trois
 * cas, un seul affiché à la fois, du plus pressant au plus calme :
 *
 *   — **quelqu'un est arrivé en face** : le duel n'attend plus que lui ;
 *   — **un ami l'invite** dans son duel : un appui l'amène au vestiaire ;
 *   — **son duel attend** encore personne : un rappel discret, pour qu'il
 *     sache qu'il est ouvert et qu'il peut y revenir.
 *
 * Lu dans `/api/nvn/moi` (mémoire seule côté serveur, aucune requête en
 * base), toutes les `CADENCE_MS`, onglet visible seulement ; plus vite quand
 * un adversaire attend. Rien sans compte : la première réponse 401 arrête
 * tout. Monté par `nav.js`.
 *
 * **Et les duels des autres** (28 octobre 2026) : la même réponse porte les
 * files où quelqu'un attend. Quand elles changent, la page en est prévenue
 * par l'événement `tbf:attentes` (`detail.attentes`, la liste de
 * `/api/nvn/attentes`) : l'accueil rallume son « Quelqu'un t'attend », le
 * tiroir son sticker, sans qu'on recharge.
 */
(() => {
  const chemin = location.pathname.replace(/\/$/, '') || '/';
  if (['/duel-nvn', '/compte', '/admin', '/diagnostic', '/bienvenue'].includes(chemin)) return;
  if (window.TBF_RAPPEL_DUEL) return;
  window.TBF_RAPPEL_DUEL = true;

  /* Dix secondes et non plus vingt : une file de duel ne vit que deux
     minutes avant les bots, et c'est cette lecture qui l'annonce aux autres. */
  const CADENCE_MS = 10_000;
  const PRESSE_MS = 5_000;
  /** Les invitations écartées d'un « PLUS TARD », pour cet onglet. */
  const ecartees = new Set();
  let el = null;
  let minuterie = null;
  let arret = false;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function pile() {
    let p = document.querySelector('body > .tbf-pile');
    if (!p) {
      p = document.createElement('div');
      p.className = 'tbf-pile';
      document.body.append(p);
    }
    return p;
  }

  function retirer() {
    el?.remove();
    el = null;
  }

  /** Le bandeau : un mot, et un ou deux boutons. `cle` évite de le refaire
      à chaque lecture quand rien n'a changé. */
  function montrer(cle, html, gestes) {
    if (el?.dataset.cle === cle) return;
    retirer();
    el = document.createElement('div');
    el.className = 'tbf-toast tbf-rappel-duel';
    el.setAttribute('role', 'status');
    el.dataset.cle = cle;
    el.innerHTML = html;
    pile().append(el);
    for (const [sel, fn] of Object.entries(gestes ?? {})) {
      el.querySelector(sel)?.addEventListener('click', fn);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
.tbf-rappel-duel{justify-content:space-between;flex-wrap:wrap}
.tbf-rappel-duel .mot{flex:1 1 160px;min-width:0}
.tbf-rappel-duel .mot small{display:block;font-weight:400;letter-spacing:0;opacity:.8;font-size:12px}
.tbf-rappel-duel .gestes{display:flex;gap:8px;flex:none}
.tbf-rappel-duel a,.tbf-rappel-duel button{font:inherit;font-size:12px;letter-spacing:.08em;
  padding:7px 11px;border-radius:5px;border:0;cursor:pointer;text-decoration:none;
  background:var(--flare,#E0402C);color:#fff}
.tbf-rappel-duel .calme{background:transparent;color:inherit;box-shadow:inset 0 0 0 1px rgba(242,238,228,.3)}`;
  document.head.append(style);

  function rendre(d) {
    const f = d?.file;
    const clubs = (x) => [x?.club?.name, x?.enFaceClub?.name].filter(Boolean).join(' – ');
    if (f?.adversaire) {
      montrer(`adv:${f.fixtureId}:${f.format}`,
        `<span class="mot">TON ADVERSAIRE EST LÀ
          <small>Ton duel ${esc(f.format)} n’attend plus que toi.</small></span>
         <span class="gestes"><a href="/duel-nvn">JOUER</a></span>`);
      return true;
    }
    const inv = (d?.invitations ?? []).find((i) => !ecartees.has(i.code));
    if (inv) {
      const q = new URLSearchParams({ duel: inv.code, match: String(inv.fixtureId),
        format: inv.format });
      montrer(`inv:${inv.code}`,
        `<span class="mot">${esc(inv.de)} T’INVITE EN DUEL
          <small>${esc(inv.format)}${clubs(inv) ? ` · ${esc(clubs(inv))}` : ''}</small></span>
         <span class="gestes"><button class="calme" data-plus-tard>PLUS TARD</button>
           <a href="/duel-nvn?${q}">REJOINDRE</a></span>`,
        { '[data-plus-tard]': () => { ecartees.add(inv.code); retirer(); } });
      return false;
    }
    if (f) {
      montrer(`file:${f.fixtureId}:${f.format}`,
        `<span class="mot">TON DUEL T’ATTEND
          <small>${esc(f.format)}${clubs(f) ? ` · ${esc(clubs(f))}` : ''} · on te prévient si quelqu’un arrive</small></span>
         <span class="gestes"><a class="calme" href="/duel-nvn">Y ALLER</a></span>`);
      return false;
    }
    retirer();
    return false;
  }

  /** Ce qui distingue deux états des files : le match, le format, les camps. */
  let filesVues = null;
  function annoncerFiles(attentes) {
    if (!Array.isArray(attentes)) return;
    const sig = JSON.stringify(attentes.map((a) => [a.fixtureId, a.format, a.camps]));
    /* La première lecture ne fait que retenir : la page vient de lire les
       files elle-même en s'ouvrant. */
    if (filesVues !== null && sig !== filesVues) {
      window.dispatchEvent(new CustomEvent('tbf:attentes', { detail: { attentes } }));
    }
    filesVues = sig;
  }

  async function lire() {
    clearTimeout(minuterie);
    if (arret) return;
    if (document.visibilityState !== 'visible') return;
    let presse = false;
    try {
      const r = await fetch('/api/nvn/moi', { credentials: 'same-origin', cache: 'no-store' });
      // Sans compte, ou sans duel sur ce serveur : rien à rappeler, jamais.
      if (r.status === 401 || r.status === 404) { arret = true; retirer(); return; }
      if (r.ok) {
        const d = await r.json();
        presse = rendre(d);
        annoncerFiles(d?.attentes);
      }
    } catch { /* hors ligne : on réessaie au tour suivant */ }
    minuterie = setTimeout(lire, presse ? PRESSE_MS : CADENCE_MS);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void lire();
  });
  /* Qui est connecté : la même question que `nav.js`, retenue sous
     `window.TBF_MOI` — un visiteur ne déclenche donc aucun 401. */
  void (window.TBF_MOI ??= fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j?.user ?? null)
    .catch(() => null)).then((u) => { if (u) void lire(); else arret = true; });
})();
