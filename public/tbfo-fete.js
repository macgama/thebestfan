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
  const vus = (qui) => new Set((Array.isArray(lireTout()[qui]) ? lireTout()[qui] : []).map(Number));
  function retenir(qui, ids) {
    const o = lireTout();
    const l = [...new Set([...(Array.isArray(o[qui]) ? o[qui] : []), ...ids].map(Number))].slice(-40);
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
.tbf-tbfo-scene{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;height:100%}
.tbf-tbfo-ecu{width:64px;height:64px;object-fit:contain;filter:drop-shadow(2px 3px 0 #111)}
.tbf-tbfo-ecu--eux{width:46px;height:46px;opacity:.75}
.tbf-tbfo-sc{font-family:var(--banner,Oswald,sans-serif);font-size:44px;line-height:1;color:#fff;
  -webkit-text-stroke:1.5px #111;text-shadow:3px 3px 0 #111;letter-spacing:.04em;white-space:nowrap}
.tbf-tbfo-sc small{display:block;font-size:11px;letter-spacing:.14em;-webkit-text-stroke:0;text-shadow:none;
  color:var(--projo,#F5C33B);text-align:center;margin-top:4px}
.tbf-tbfo-ligne{display:flex;justify-content:space-between;gap:10px;font-size:13px;padding:3px 0}
.tbf-tbfo-ligne b{font-family:var(--banner,Oswald,sans-serif);letter-spacing:.04em}
@media (prefers-reduced-motion:no-preference){
  .tbf-tbfo-ecu--nous{animation:tbf-tbfo-saut .7s cubic-bezier(.2,1.4,.4,1) .35s both}}
@keyframes tbf-tbfo-saut{from{transform:translateY(40px) scale(.4);opacity:0}to{transform:none;opacity:1}}`;
    document.head.append(s);
  }

  const ecusson = (c, cls) => (c?.logo
    ? `<img class="tbf-tbfo-ecu ${cls}" src="${esc(c.logo)}" alt="" decoding="async">` : '');

  /** Le titre d'un match : ce que la tribune a gagné. */
  function titreDe(v) {
    if (v.issue === 'V') return v.viragegagne ? 'VICTOIRE + VIRAGE !' : 'VICTOIRE TBFO !';
    if (v.issue === 'N') return v.viragegagne ? 'NUL + VIRAGE !' : 'MATCH NUL TBFO';
    return 'VIRAGE GAGNÉ !';
  }

  /** Ouvre la fête d'une liste de matchs TBFO payés. Rend le bouton touché. */
  async function feter(liste) {
    const N = await caseCommune();
    if (!N?.annoncer || !liste?.length) return undefined;
    style();
    const sans = doux();
    const colle = (ms) => (sans ? '' : ` tbf-colle" style="--d:${ms}ms`);
    const total = liste.reduce((s, v) => s + (Number(v.echarpes) || 0), 0);
    const v = liste[0];
    const un = liste.length === 1;
    const scene = `<span class="tbf-tbfo-scene">${ecusson(v.club, 'tbf-tbfo-ecu--nous')}
      <span class="tbf-tbfo-sc">${esc(v.score[0])}–${esc(v.score[1])}<small>SCORE TBFO</small></span>
      ${ecusson(v.adverse, 'tbf-tbfo-ecu--eux')}</span>`;
    const ech = `<span class="tbf-sticker tbf-sticker--prix tbf-niv-ech${colle(1150)}"><img
      src="/img/gains/echarpes.webp" alt="" decoding="async"><b>+${esc(total)}</b> ÉCHARPES</span>`;
    const virage = un && v.viragegagne && v.virage
      ? `<span class="tbf-sticker${colle(1320)}" data-ton="or">VIRAGE ${esc(v.virage[0])}–${esc(v.virage[1])}</span>` : '';
    const detail = un ? '' : `<div class="tbf-tbfo-detail">${liste.map((x) => `<div class="tbf-tbfo-ligne">
      <span>${esc(x.club.name)} ${esc(x.score[0])}–${esc(x.score[1])} ${esc(x.adverse.name)}</span>
      <b>+${esc(x.echarpes)}</b></div>`).join('')}</div>`;
    const de = un
      ? `${esc(v.club.name)} ${esc(v.score[0])}–${esc(v.score[1])} ${esc(v.adverse.name)} · tu étais dans la tribune`
      : `${liste.length} matchs TBFO pour tes tribunes`;
    const choix = await N.annoncer({
      nomDeLaFete: un ? `Match TBFO : ${v.club.name}` : `${liste.length} matchs TBFO`,
      quoi: un ? String(v.club.name).toUpperCase() : 'TES TRIBUNES ONT GAGNÉ',
      titre: un ? titreDe(v) : 'LA TRIBUNE PAIE !',
      petit: true,
      de,
      butin: `${ech}${virage}${detail}`,
      promesse: `<div class="tbf-niv-libelle">LE PROCHAIN MATCH T’ATTEND</div>
        <span class="tbf-sticker tbf-sticker--jalon">UN DUEL DE PLUS FAIT PENCHER LA BALANCE</span>`,
      scene, avant: 0, n: 0, ecarpes: total, son: 'parfait',
      boutons: [{ texte: 'VOIR MON CLUB', valeur: 'club' }],
    });
    try { window.TBF_SON?.club?.(v.club.id); } catch { /* pas de son */ }
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
        .filter((v) => v && !deja.has(Number(v.match)) && Number(v.echarpes) > 0);
      if (!neuves.length) return;
      const aller = await feter(neuves);
      retenir(qui, neuves.map((v) => v.match));
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
