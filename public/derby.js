/**
 * **Le derby de la semaine** (idée 2, acceptée par Gaël le 8 novembre 2026).
 *
 * Chaque semaine, le vrai match qui réunit le plus de supporters des deux
 * clubs devient le derby : ses écharpes de tribune sont multipliées
 * (`tbfo.derby_coef`, ×2 par défaut). Ce script le met en avant là où la
 * page lui réserve une place :
 *
 *   — `[data-derby="bandeau"]` : une ligne dorée (l'accueil) ;
 *   — `[data-derby="carte"]` : l'affiche du choc, écussons face à face, le
 *     score TBFO quand il se joue, et le bouton du duel (les matchs).
 *
 * Lu dans `/api/club/derby` (`classements/exploits.js`), relu chaque minute
 * quand le derby se joue. Rien ne paraît sans derby. `window.TBF_DERBY.id()`
 * rend l'id du derby pour qui veut le marquer (`a-jouer.js`).
 */
(() => {
  if (window.TBF_DERBY) return;
  const ECH = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ECH[c]);
  const EN_JEU = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT', 'SUSP']);
  const FINIS = new Set(['FT', 'AET', 'PEN']);

  let lecture = null;
  const lire = () => (lecture ??= fetch('/api/club/derby', { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null)).then((j) => j?.derby ?? null).catch(() => null));

  function style() {
    if (document.getElementById('tbf-derby-style')) return;
    const s = document.createElement('style');
    s.id = 'tbf-derby-style';
    s.textContent = `
.tbf-derby-b{display:flex;align-items:center;gap:8px;min-height:34px;padding:4px 10px;border-radius:8px;text-decoration:none;
  color:#111;background:repeating-linear-gradient(90deg,#F5C33B 0 26px,#ffd85e 26px 52px);border:2px solid #111;
  box-shadow:0 3px 0 #111;font:600 12px var(--banner,Oswald,sans-serif);letter-spacing:.08em;overflow:hidden;white-space:nowrap}
.tbf-derby-b img{width:22px;height:22px;object-fit:contain;flex:none}
.tbf-derby-b .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}
.tbf-derby-b em{font-style:normal;background:#111;color:#F5C33B;border-radius:4px;padding:1px 6px;flex:none}
.tbf-derby-b.live em{color:#ff8a7a}
.tbf-derby-c{position:relative;display:block;margin:4px 0 12px;border-radius:12px;overflow:hidden;isolation:isolate;text-decoration:none;
  color:#fff;background:#0b0e12;border:2px solid #F5C33B;box-shadow:0 0 0 2px #111,0 6px 0 #111,0 0 26px rgba(245,195,59,.3)}
.tbf-derby-c .fond{position:absolute;inset:0;z-index:-1;display:flex}
.tbf-derby-c .fond i{flex:1}
.tbf-derby-c .fond i:first-child{background:linear-gradient(160deg,var(--a),#000 120%);clip-path:polygon(0 0,100% 0,82% 100%,0 100%);margin-right:-9%}
.tbf-derby-c .fond i:last-child{background:linear-gradient(200deg,var(--b),#000 120%);clip-path:polygon(18% 0,100% 0,100% 100%,0 100%);margin-left:-9%}
.tbf-derby-c .ruban{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:5px 10px;background:#111;
  font:600 11px var(--banner,Oswald,sans-serif);letter-spacing:.18em;color:#F5C33B}
.tbf-derby-c .ruban b{background:#F5C33B;color:#111;border-radius:4px;padding:1px 7px;letter-spacing:.06em}
.tbf-derby-c .face{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:6px;padding:12px 10px 8px}
.tbf-derby-c .club{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}
.tbf-derby-c .club img{width:58px;height:58px;object-fit:contain;filter:drop-shadow(0 4px 0 rgba(0,0,0,.6))}
.tbf-derby-c .club span{font:600 13px var(--banner,Oswald,sans-serif);letter-spacing:.04em;max-width:100%;overflow:hidden;
  text-overflow:ellipsis;white-space:nowrap;text-shadow:0 2px 0 #000}
.tbf-derby-c .club small{font-size:10.5px;opacity:.85}
.tbf-derby-c .mil{text-align:center;font-family:var(--banner,Oswald,sans-serif)}
.tbf-derby-c .mil strong{display:block;font-size:34px;line-height:1;text-shadow:3px 3px 0 #000}
.tbf-derby-c .mil small{display:block;font-size:10.5px;letter-spacing:.14em;color:#F5C33B;margin-top:3px}
.tbf-derby-c .bas{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 10px 10px;font-size:12px}
.tbf-derby-c .bas span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 0 #000}
.tbf-derby-c .bas b{flex:none;background:var(--projo,#F5C33B);color:#111;border-radius:6px;padding:6px 10px;
  font:600 12.5px var(--banner,Oswald,sans-serif);letter-spacing:.06em;box-shadow:0 3px 0 #8a6a12}
@media (prefers-reduced-motion:no-preference){.tbf-derby-c .mil strong{animation:tbf-derby-pouls 2.4s ease-in-out infinite}}
@keyframes tbf-derby-pouls{50%{transform:scale(1.07)}}`;
    document.head.append(s);
  }

  const coul = (c, def) => (/^#[0-9a-f]{3,8}$/i.test(c ?? '') ? c : def);
  function quand(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(document.documentElement.lang || 'fr',
      { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  function bandeau(d) {
    const live = EN_JEU.has(d.statut);
    const t = d.tbfo;
    /* Les points en grand (Gaël, 9 novembre 2026). */
    const pts = t && !t.vide && t.points ? t.points.join('–') : '0–0';
    const etat = live ? `TBFO ${pts} · ${d.minute ?? ''}’`
      : FINIS.has(d.statut) ? `TBFO ${pts}` : quand(d.coup).toUpperCase();
    return `<a class="tbf-derby-b${live ? ' live' : ''}" href="/tbfo/${Number(d.id)}">⚔
      ${d.home.logo ? `<img src="${esc(d.home.logo)}" alt="">` : ''}<span class="n">DERBY : ${esc(d.home.name)} – ${esc(d.away.name)}</span>
      ${d.away.logo ? `<img src="${esc(d.away.logo)}" alt="">` : ''}<em>${esc(etat)} · ×${Number(d.coef) || 2}</em></a>`;
  }

  function carte(d) {
    const live = EN_JEU.has(d.statut), fini = FINIS.has(d.statut);
    const t = d.tbfo;
    const mil = t && !t.vide && t.points ? `${t.points[0]}–${t.points[1]}` : live || fini ? '0–0' : 'VS';
    const sous = live ? `POINTS TBFO · ${esc(d.minute ?? '')}’` : fini ? 'POINTS TBFO FINAUX' : esc(quand(d.coup).toUpperCase());
    const x = Number(d.coef) || 2;
    const prime = (Number(d.victoire) || 20) * x;
    const action = fini ? 'LE RÉSUMÉ' : '⚡ JOUER LE DERBY';
    const lien = fini ? `/tbfo/${Number(d.id)}` : `/duel-nvn?${new URLSearchParams({ match: String(d.id) })}`;
    return `<a class="tbf-derby-c" href="${lien}" style="--a:${coul(d.home.couleurs?.[0], '#c8281a')};--b:${coul(d.away.couleurs?.[0], '#2f6fd0')}">
      <span class="fond"><i></i><i></i></span>
      <span class="ruban"><span>⚔ LE DERBY DE LA SEMAINE</span><b>ÉCHARPES ×${x}</b></span>
      <span class="face">
        <span class="club">${d.home.logo ? `<img src="${esc(d.home.logo)}" alt="">` : ''}<span>${esc(d.home.name)}</span>
          <small>${Number(d.home.fans) || 0} supporters</small></span>
        <span class="mil"><strong>${esc(mil)}</strong><small>${sous}</small></span>
        <span class="club">${d.away.logo ? `<img src="${esc(d.away.logo)}" alt="">` : ''}<span>${esc(d.away.name)}</span>
          <small>${Number(d.away.fans) || 0} supporters</small></span>
      </span>
      <span class="bas"><span>${fini ? 'Le derby est joué : qui a fait pencher la balance ?'
        : `${prime} écharpes pour chaque joueur de la tribune gagnante`}</span><b>${action}</b></span>
    </a>`;
  }

  async function poser() {
    const lieux = [...document.querySelectorAll('[data-derby]')];
    if (!lieux.length) return null;
    const d = await lire();
    if (!d) { lieux.forEach((l) => { l.hidden = true; }); return null; }
    style();
    for (const l of lieux) {
      l.innerHTML = l.dataset.derby === 'carte' ? carte(d) : bandeau(d);
      l.hidden = false;
    }
    return d;
  }

  async function demarrer() {
    const d = await poser();
    if (d && EN_JEU.has(d.statut)) {
      setInterval(() => { if (!document.hidden) { lecture = null; poser(); } }, 60_000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer, { once: true });
  else demarrer();

  window.TBF_DERBY = { id: () => lire().then((d) => (d ? { id: Number(d.id), coef: Number(d.coef) || 2 } : null)), poser };
})();
