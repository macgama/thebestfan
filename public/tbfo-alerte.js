/**
 * **« Ton club perd au TBFO ! »** — l'alerte du match qui se joue.
 *
 * Idée 3 acceptée par Gaël (8 novembre 2026, « les 4 idées m'intéressent ») :
 * pendant un vrai match, si un club que je suis a moins de points TBFO en jeu
 * que son adversaire, la page où je suis me le dit, avec un duel pour ce
 * camp et le Virage à un toucher, pour aller faire pencher la balance.
 *
 * Lu dans `/api/club/alertes` (`classements/exploits.js`) toutes les
 * 90 secondes, onglet visible seulement. Une alerte écartée (PLUS TARD) ne
 * revient que si l'écart se creuse ; une alerte vue reste en place tant que
 * le club est mené, et s'en va quand il revient. Jamais pendant un duel, au
 * Virage, dans l'administration ni la cérémonie d'arrivée. Monté par `nav.js`.
 */
(() => {
  if (window.TBF_TBFO_ALERTE) return;
  const chemin = location.pathname.replace(/\/$/, '') || '/';
  const JAMAIS = ['/admin', '/duel-nvn', '/virage', '/bienvenue', '/repetition', '/diagnostic', '/compte'];
  if (JAMAIS.includes(chemin)) return;

  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ECH[c]);
  const CADENCE_MS = 90_000;
  const CLE = 'tbf-tbfo-alerte';
  let el = null;
  let arret = false;

  /* Les alertes écartées : match -> écart au moment du PLUS TARD. */
  const ecartees = () => {
    try {
      const o = JSON.parse(sessionStorage.getItem(CLE) || '{}');
      return o && typeof o === 'object' ? o : {};
    } catch { return {}; }
  };
  function ecarter(a) {
    const o = ecartees();
    o[a.match] = a.score[1] - a.score[0];
    try { sessionStorage.setItem(CLE, JSON.stringify(o)); } catch { /* tant pis */ }
  }

  function style() {
    if (document.getElementById('tbf-alerte-style')) return;
    const s = document.createElement('style');
    s.id = 'tbf-alerte-style';
    s.textContent = `
.tbf-alerte{position:relative;display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;
  width:min(440px,calc(100vw - 20px));margin:0 auto;padding:10px 12px 10px 10px;border-radius:12px;color:#fff;
  background:linear-gradient(115deg,#7a0f08,#c8281a 55%,#7a0f08);border:2px solid #111;
  box-shadow:0 0 0 2px #ff6a5a,0 6px 0 #111,0 0 28px rgba(255,80,60,.55);font-family:var(--ui,system-ui);
  overflow:hidden;isolation:isolate;pointer-events:auto}
.tbf-alerte::before{content:"";position:absolute;inset:0;z-index:-1;opacity:.16;
  background:repeating-linear-gradient(-45deg,#000 0 10px,transparent 10px 20px)}
.tbf-alerte .ecu{position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center}
.tbf-alerte .ecu img{width:46px;height:46px;object-fit:contain;filter:drop-shadow(2px 3px 0 #000)}
.tbf-alerte .ecu b{position:absolute;right:-6px;bottom:-4px;background:#111;color:#ff8a7a;border-radius:4px;
  font:700 10px var(--banner,Oswald,sans-serif);padding:1px 4px;letter-spacing:.06em}
.tbf-alerte .t{min-width:0}
.tbf-alerte .t small{display:block;font:600 10.5px var(--banner,Oswald,sans-serif);letter-spacing:.18em;color:#ffd0c8}
.tbf-alerte .t strong{display:block;font:700 19px/1.05 var(--banner,Oswald,sans-serif);letter-spacing:.04em;
  text-shadow:2px 2px 0 #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tbf-alerte .t span{display:block;font-size:12px;line-height:1.3;margin-top:3px}
.tbf-alerte .t span b{font-family:var(--banner,Oswald,sans-serif);font-size:14px}
.tbf-alerte .gestes{grid-column:1 / -1;display:flex;gap:6px;margin-top:6px}
.tbf-alerte .gestes a,.tbf-alerte .gestes button{flex:1;display:flex;align-items:center;justify-content:center;min-height:38px;
  border:0;border-radius:6px;text-decoration:none;cursor:pointer;font:600 12.5px var(--banner,Oswald,sans-serif);letter-spacing:.05em;
  white-space:nowrap;padding:0 6px}
.tbf-alerte .duel{background:var(--projo,#F5C33B);color:#111;box-shadow:0 3px 0 #8a6a12;flex:1.6}
.tbf-alerte .vir{background:#14804f;color:#fff;box-shadow:0 3px 0 #0d4d33}
.tbf-alerte .tard{background:transparent;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4);flex:.8}
@media (prefers-reduced-motion:no-preference){
  .tbf-alerte{animation:tbf-alerte-in .45s cubic-bezier(.2,1.4,.4,1) both}
  .tbf-alerte .ecu b{animation:tbf-alerte-bat 1.1s ease-in-out infinite}}
@keyframes tbf-alerte-in{from{transform:translateY(30px) scale(.9);opacity:0}to{transform:none;opacity:1}}
@keyframes tbf-alerte-bat{50%{transform:scale(1.18)}}`;
    document.head.append(s);
  }

  function pile() {
    let p = document.querySelector('body > .tbf-pile');
    if (!p) {
      p = document.createElement('div');
      p.className = 'tbf-pile';
      document.body.append(p);
    }
    return p;
  }

  function retirer() { el?.remove(); el = null; }

  function montrer(a) {
    const cle = `${a.match}:${a.score.join('-')}:${a.points.join('-')}`;
    if (el?.dataset.cle === cle) return;
    retirer();
    style();
    const ecart = a.score[1] - a.score[0];
    const q = new URLSearchParams({ match: String(a.match), camp: String(a.camp) });
    el = document.createElement('div');
    el.className = 'tbf-alerte';
    el.setAttribute('role', 'alert');
    el.dataset.cle = cle;
    el.innerHTML = `<span class="ecu">${a.club.logo ? `<img src="${esc(a.club.logo)}" alt="">` : ''}
        <b>${a.minute != null ? `${esc(a.minute)}’` : 'LIVE'}</b></span>
      <span class="t"><small>⚠ TON CLUB PERD AU TBFO</small>
        <strong>${esc(a.club.name)} ${esc(a.points[0])}–${esc(a.points[1])} ${esc(a.adverse.name)}</strong>
        <span>${ecart > 0 ? `Il manque <b>${ecart + 1}</b> duel${ecart + 1 > 1 ? 's' : ''} gagné${ecart + 1 > 1 ? 's' : ''} pour repasser devant`
          : 'Le Virage d’en face fait la différence'} · duels ${esc(a.score[0])}–${esc(a.score[1])}</span></span>
      <span class="gestes"><a class="duel" href="/duel-nvn?${q}">⚡ UN DUEL</a>
        <a class="vir" href="/virage?match=${Number(a.match)}">VIRAGE</a>
        <button type="button" class="tard">PLUS TARD</button></span>`;
    el.querySelector('.tard').addEventListener('click', () => { ecarter(a); retirer(); });
    pile().append(el);
    try { navigator.vibrate?.([60, 40, 60]); } catch { /* sans vibreur */ }
  }

  async function lire() {
    if (arret || document.hidden) return;
    try {
      const r = await fetch('/api/club/alertes', { credentials: 'same-origin' });
      if (r.status === 401) { arret = true; retirer(); return; }
      if (!r.ok) return;
      const j = await r.json();
      const ec = ecartees();
      const a = (Array.isArray(j?.alertes) ? j.alertes : [])
        .find((x) => !(String(x.match) in ec) || (x.score[1] - x.score[0]) > Number(ec[x.match]));
      if (a) montrer(a); else retirer();
    } catch { /* un réseau qui hoquette : on réessaiera */ }
  }

  setTimeout(lire, chemin === '/' ? 5000 : 2500);
  setInterval(lire, CADENCE_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(lire, 1200); });
  window.TBF_TBFO_ALERTE = { lire, montrer };
})();
