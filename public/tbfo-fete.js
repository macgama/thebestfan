/**
 * Le match TBFO gagné, fêté chez ceux qui l'ont joué.
 *
 * Choix de Gaël du 7 novembre 2026 (carte « Victoire 20, nul 5, Virage
 * +10 ») : chaque joueur qui a poussé la tribune d'un club sur un vrai match
 * reçoit des écharpes quand ce club gagne (ou fait nul) le match TBFO, et de
 * plus s'il gagne le Virage, avec une alerte qui donne envie de continuer.
 *
 * Le serveur règle et verse (`/api/club/victoires`, grand livre, une fois par
 * match). Cette page ne fait que fêter : la même case que les autres fêtes
 * (`niveau-fete.js`, `TBF_NIVEAU.annoncer`), à la même file. Les deux écussons
 * face à face, le score TBFO, le Virage, les écharpes ; le bouton mène à la
 * page du club, où le prochain match attend.
 *
 * Chargé par `nav.js` sur toutes les pages d'un joueur connecté, et par
 * l'accueil. Jamais pendant un duel, au Virage, dans l'administration ou la
 * cérémonie d'arrivée. Ce qui a été fêté est retenu sur l'appareil, signé du
 * joueur.
 *
 * **Et les exploits** (Gaël, 8 novembre 2026) : la même fête dit le derby de
 * la semaine (écharpes ×2), l'homme du match TBFO et le champion TBFO d'une
 * saison finie (`type` de chaque ligne : match, hdm, champion).
 */
(() => {
  if (window.TBF_TBFO_FETE) return;

  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ECH[c]);
  const doux = () => (typeof matchMedia === 'function'
      && matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (document.documentElement.dataset.calme ?? '').split(' ').includes('animations');

  const chemin = location.pathname.replace(/\/$/, '') || '/';
  const JAMAIS = ['/admin', '/duel-nvn', '/virage', '/bienvenue', '/repetition', '/diagnostic'];
  const ici = !JAMAIS.includes(chemin);

  /* ------------------------------------------------ la mémoire de l'appareil */
  const CLE = 'tbf-tbfo-vu';
  const lireTout = () => {
    try {
      const o = JSON.parse(localStorage.getItem(CLE) || 'null');
      return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
    } catch { return {}; }
  };
  /* Une ligne fêtée se retient par sa clé : le numéro du match pour une
     victoire (comme avant), `hdm:<match>`, `champ:<ligue>-<saison>`. */
  const cleDe = (v) => String(v?.cle ?? v?.match ?? '');
  const vus = (qui) => new Set((Array.isArray(lireTout()[qui]) ? lireTout()[qui] : []).map(String));
  function retenir(qui, ids) {
    const o = lireTout();
    const l = [...new Set([...(Array.isArray(o[qui]) ? o[qui] : []), ...ids].map(String))].slice(-60);
    delete o[qui];
    o[qui] = l;
    const cles = Object.keys(o);
    while (cles.length > 4) delete o[cles.shift()];
    try { localStorage.setItem(CLE, JSON.stringify(o)); } catch { /* vaut pour rien */ }
  }

  const moi = () => (window.TBF_MOI ??= fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => j?.user ?? null)
    .catch(() => null));

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

  /* Le style de la scène : deux écussons et le score, au trait d'encre. */
  function style() {
    if (document.getElementById('tbf-tbfo-style')) return;
    const s = document.createElement('style');
    s.id = 'tbf-tbfo-style';
    s.textContent = `
.tbf-niv-scene:has(.tbf-tbfo-star,.tbf-tbfo-coupe){height:124px}
.tbf-tbfo-scene{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:100%}
.tbf-tbfo-ecu{width:64px;height:64px;object-fit:contain;filter:drop-shadow(2px 3px 0 #111)}
.tbf-tbfo-ecu--eux{width:46px;height:46px;opacity:.75}
.tbf-tbfo-sc{font-family:var(--banner,Oswald,sans-serif);font-size:44px;line-height:1;color:#fff;
  -webkit-text-stroke:1.5px #111;text-shadow:3px 3px 0 #111;letter-spacing:.04em;white-space:nowrap}
.tbf-tbfo-sc small{display:block;font-size:11px;letter-spacing:.14em;-webkit-text-stroke:0;text-shadow:none;
  color:var(--projo,#F5C33B);text-align:center;margin-top:4px}
.tbf-tbfo-ligne{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:3px 0}
.tbf-tbfo-ligne b{font-family:var(--banner,Oswald,sans-serif);letter-spacing:.04em}
.tbf-tbfo-star{position:relative;display:flex;align-items:center;justify-content:center;width:96px;height:92px}
.tbf-tbfo-star::before{content:"";position:absolute;inset:0;background:var(--projo,#F5C33B);
  clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%);
  filter:drop-shadow(3px 4px 0 #111)}
.tbf-tbfo-star img{position:relative;width:40px;height:40px;object-fit:contain;margin-top:10px}
.tbf-tbfo-coupe{display:flex;flex-direction:column;align-items:center;gap:0}
.tbf-tbfo-coupe .c{position:relative;width:96px;height:80px;background:linear-gradient(90deg,#c9961f,#ffe08a 45%,#c9961f);
  border-radius:0 0 48px 48px;border:3px solid #111;box-shadow:4px 4px 0 #111;display:flex;align-items:center;justify-content:center}
.tbf-tbfo-coupe .c::before,.tbf-tbfo-coupe .c::after{content:"";position:absolute;top:8px;width:22px;height:34px;
  border:5px solid #c9961f;border-radius:50%}
.tbf-tbfo-coupe .c::before{left:-24px;border-right-color:transparent}.tbf-tbfo-coupe .c::after{right:-24px;border-left-color:transparent}
.tbf-tbfo-coupe .c img{width:46px;height:46px;object-fit:contain}
.tbf-tbfo-coupe .p{width:22px;height:16px;background:#c9961f;border:3px solid #111;border-top:0}
.tbf-tbfo-coupe .s{width:70px;height:14px;background:#2a2014;border:3px solid #111;border-radius:3px}
@media (prefers-reduced-motion:no-preference){
  .tbf-tbfo-ecu--nous{animation:tbf-tbfo-saut .7s cubic-bezier(.2,1.4,.4,1) .35s both}}
@keyframes tbf-tbfo-saut{from{transform:translateY(40px) scale(.4);opacity:0}to{transform:none;opacity:1}}`;
    document.head.append(s);
  }

  const ecusson = (c, cls) => (c?.logo
    ? `<img class="tbf-tbfo-ecu ${cls}" src="${esc(c.logo)}" alt="" decoding="async">` : '');

  /** Le titre d'un match : ce que la tribune a gagné. */
  function titreDe(v) {
    if (v.type === 'hdm') return 'HOMME DU MATCH !';
    if (v.type === 'champion') return 'CHAMPION TBFO !';
    const d = v.derby ? ' AU DERBY' : '';
    if (v.issue === 'V') return v.viragegagne ? `VICTOIRE${d} + VIRAGE !` : `VICTOIRE TBFO${d} !`;
    if (v.issue === 'N') return v.viragegagne ? 'NUL + VIRAGE !' : `MATCH NUL TBFO${d}`;
    return 'VIRAGE GAGNÉ !';
  }

  /** Une ligne du détail, quand plusieurs choses se fêtent ensemble. */
  function ligneDe(x) {
    const quoi = x.type === 'champion'
      ? `🏆 ${esc(x.club.name)} champion · ${esc(x.ligue?.name ?? '')}`
      : x.type === 'hdm'
        ? `★ Homme du match · ${esc(x.club.name)}–${esc(x.adverse.name)}`
        : `${esc(x.club.name)} ${esc((x.pts ?? x.score)[0])}–${esc((x.pts ?? x.score)[1])} ${esc(x.adverse.name)}${x.derby ? ' · DERBY' : ''}`;
    return `<div class="tbf-tbfo-ligne"><span>${quoi}</span><b>+${esc(x.echarpes)}</b></div>`;
  }

  /** Ouvre la fête d'une liste de matchs TBFO payés. Rend le bouton touché. */
  async function feter(liste) {
    const N = await caseCommune();
    if (!N?.annoncer || !liste?.length) return undefined;
    style();
    const sans = doux();
    const colle = (ms) => (sans ? '' : ` tbf-colle" style="--d:${ms}ms`);
    /* Le plus beau d'abord : le titre de champion, l'homme du match, puis
       les victoires. */
    const rang = { champion: 0, hdm: 1 };
    const tri = [...liste].sort((a, b) => (rang[a.type] ?? 2) - (rang[b.type] ?? 2));
    const total = tri.reduce((s, v) => s + (Number(v.echarpes) || 0), 0);
    const v = tri[0];
    const un = tri.length === 1;
    let scene;
    if (v.type === 'champion') {
      scene = `<span class="tbf-tbfo-scene"><span class="tbf-tbfo-coupe tbf-tbfo-ecu--nous"><span class="c">${v.club?.logo
        ? `<img src="${esc(v.club.logo)}" alt="">` : ''}</span><span class="p"></span><span class="s"></span></span></span>`;
    } else if (v.type === 'hdm') {
      scene = `<span class="tbf-tbfo-scene"><span class="tbf-tbfo-star tbf-tbfo-ecu--nous">${v.club?.logo
        ? `<img src="${esc(v.club.logo)}" alt="">` : ''}</span></span>`;
    } else {
      scene = `<span class="tbf-tbfo-scene">${ecusson(v.club, 'tbf-tbfo-ecu--nous')}
        <span class="tbf-tbfo-sc">${esc((v.pts ?? v.score)[0])}–${esc((v.pts ?? v.score)[1])}<small>${v.pts ? 'POINTS TBFO' : 'SCORE TBFO'}</small></span>
        ${ecusson(v.adverse, 'tbf-tbfo-ecu--eux')}</span>`;
    }
    const ech = `<span class="tbf-sticker tbf-sticker--prix tbf-niv-ech${colle(1150)}"><img
      src="/img/gains/echarpes.webp" alt="" decoding="async"><b>+${esc(total)}</b> ÉCHARPES</span>`;
    const virage = un && v.type !== 'hdm' && v.type !== 'champion' && v.viragegagne && v.virage
      ? `<span class="tbf-sticker${colle(1320)}" data-ton="or">VIRAGE ${esc(v.virage[0])}–${esc(v.virage[1])}</span>` : '';
    const derby = un && v.derby
      ? `<span class="tbf-sticker${colle(1420)}" data-ton="or">⚔ DERBY ×${esc(v.coef ?? 2)}</span>` : '';
    const titre = v.type === 'hdm' || v.type === 'champion'
      ? `<span class="tbf-sticker${colle(1320)}" data-ton="or">${v.type === 'hdm' ? '★ TITRE : HOMME DU MATCH' : '🏆 TITRE : CHAMPION TBFO'}</span>` : '';
    const detail = un ? '' : `<div class="tbf-tbfo-detail">${tri.map(ligneDe).join('')}</div>`;
    const de = !un ? `${tri.length} récompenses TBFO pour tes tribunes`
      : v.type === 'champion'
        ? `${esc(v.club.name)} finit premier du championnat TBFO ${esc(v.ligue?.name ?? '')} ${esc(v.saison ?? '')} · merci à toute la tribune`
        : v.type === 'hdm'
          ? `${esc(v.club.name)}–${esc(v.adverse.name)} · ${Number(v.gagnes) > 0 ? `${Number(v.gagnes)} duel${Number(v.gagnes) > 1 ? 's' : ''} gagné${Number(v.gagnes) > 1 ? 's' : ''}, ` : ''}personne n’a fait mieux que toi`
          : `${esc(v.club.name)} ${esc((v.pts ?? v.score)[0])}–${esc((v.pts ?? v.score)[1])} ${esc(v.adverse.name)} · tu étais dans la tribune`;
    const choix = await N.annoncer({
      nomDeLaFete: un ? `${titreDe(v)} ${v.club?.name ?? ''}` : `${tri.length} récompenses TBFO`,
      quoi: un ? String(v.type === 'champion' ? (v.ligue?.name ?? v.club.name) : v.club.name).toUpperCase()
        : 'TES TRIBUNES ONT GAGNÉ',
      titre: un ? titreDe(v) : 'LA TRIBUNE PAIE !',
      petit: true,
      de,
      butin: `${ech}${titre}${virage}${derby}${detail}`,
      promesse: `<div class="tbf-niv-libelle">LE PROCHAIN MATCH T’ATTEND</div>
        <span class="tbf-sticker tbf-sticker--jalon">UN DUEL DE PLUS FAIT PENCHER LA BALANCE</span>`,
      scene, avant: 0, n: 0, ecarpes: total, son: 'parfait',
      boutons: v.type === 'hdm' && v.match
        ? [{ texte: 'VOIR LE MATCH', valeur: 'match' }, { texte: 'VOIR MON CLUB', valeur: 'club' }]
        : [{ texte: 'VOIR MON CLUB', valeur: 'club' }],
    });
    try { window.TBF_SON?.club?.(v.club.id); } catch { /* pas de son */ }
    if (choix === 'match') return `/tbfo/${Number(v.match)}`;
    return choix === 'club' ? `/club/${Number(v.club.id)}` : undefined;
  }

  let enCours = false;
  async function verifier() {
    if (!ici || enCours || document.hidden) return;
    if (document.getElementById('ouverture')) return;
    enCours = true;
    try {
      const u = await moi();
      if (!u?.id) return;
      const qui = String(u.id);
      const r = await fetch('/api/club/victoires', { credentials: 'same-origin' });
      if (!r.ok) return;
      const j = await r.json();
      const deja = vus(qui);
      const neuves = (Array.isArray(j?.victoires) ? j.victoires : [])
        .filter((v) => v && !deja.has(cleDe(v)) && (Number(v.echarpes) > 0 || v.type === 'hdm'));
      if (!neuves.length) return;
      const aller = await feter(neuves);
      retenir(qui, neuves.map(cleDe));
      dispatchEvent(new CustomEvent('tbf:bourse', { detail: { wallet: null, niveau: null } }));
      if (aller) location.href = aller;
    } catch { /* un réseau qui hoquette : on réessaiera */ } finally {
      enCours = false;
    }
  }

  if (ici) {
    setTimeout(verifier, chemin === '/' ? 3400 : 2000);
    setInterval(verifier, 120000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(verifier, 900); });
  }

  window.TBF_TBFO_FETE = { verifier, feter };
})();
